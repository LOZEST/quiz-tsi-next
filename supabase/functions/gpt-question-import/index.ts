import { createClient } from 'npm:@supabase/supabase-js@2.111.0';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);
const forbidden = new Set([
  'ownerId',
  'userId',
  'source',
  'status',
  'validated',
  'partId',
  'role',
  'createdAt',
  'updatedAt',
  'questionId',
]);
const limits = {
  bytes: 1_000_000,
  questions: 100,
  segments: 100,
  text: 20_000,
};
const cleanText = (value: unknown, nullable = false): value is string | null =>
  (nullable && value === null) ||
  (typeof value === 'string' && value.length <= limits.text);
const safeSegments = (value: unknown, allowEmpty = false) =>
  Array.isArray(value) &&
  value.length <= limits.segments &&
  (allowEmpty || value.length > 0) &&
  value.every(
    (segment) =>
      record(segment) &&
      (segment.kind === 'line-break' ||
        (segment.kind === 'text' && cleanText(segment.value)) ||
        ((segment.kind === 'inline-math' || segment.kind === 'display-math') &&
          record(segment.math) &&
          segment.math.syntaxVersion === 1 &&
          cleanText(segment.math.source) &&
          String(segment.math.source).trim() !== '')),
  );
const canonical = (value: unknown): string =>
  JSON.stringify(
    Array.isArray(value)
      ? value.map((entry) => JSON.parse(canonical(entry)))
      : record(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, JSON.parse(canonical(value[key]))]),
          )
        : value,
  );
const sha256 = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
const jwtPayload = (token: string): Record<string, unknown> => {
  try {
    const encoded = token.split('.')[1] ?? '';
    return JSON.parse(
      atob(encoded.replace(/-/g, '+').replace(/_/g, '/')),
    ) as Record<string, unknown>;
  } catch {
    return {};
  }
};

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  if (request.method !== 'POST')
    return json({ requestId, code: 'method-not-allowed' }, 405);
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer '))
    return json({ requestId, code: 'missing-token' }, 401);
  const token = authorization.slice(7);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const expectedClientId = Deno.env.get('QUIZ_TSI_GPT_OAUTH_CLIENT_ID');
  if (!supabaseUrl || !anonKey || !expectedClientId)
    return json({ requestId, code: 'server-misconfigured' }, 503);
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user)
    return json({ requestId, code: 'invalid-token' }, 401);
  const claims = jwtPayload(token);
  const oauthClientId =
    typeof claims.client_id === 'string' ? claims.client_id : null;
  if (oauthClientId !== expectedClientId)
    return json({ requestId, code: 'oauth-client-forbidden' }, 403);
  const raw = await request.text();
  if (raw.length > limits.bytes)
    return json({ requestId, code: 'payload-too-large' }, 413);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ requestId, code: 'invalid-json' }, 400);
  }
  if (
    !record(payload) ||
    [...forbidden].some((key) => Object.hasOwn(payload, key)) ||
    payload.schemaVersion !== 1 ||
    typeof payload.importId !== 'string' ||
    !payload.importId.trim() ||
    payload.confirmedByUser !== true ||
    typeof payload.analysisCoverage !== 'string' ||
    !['text-and-visuals', 'text-only', 'incomplete'].includes(
      payload.analysisCoverage,
    ) ||
    !Array.isArray(payload.questions) ||
    payload.questions.length > limits.questions
  )
    return json({ requestId, code: 'invalid-envelope' }, 422);
  const payloadHash = await sha256(canonical(payload));
  const { data: replay } = await client
    .from('question_imports')
    .select('payload_hash,report')
    .eq('owner_id', userData.user.id)
    .eq('oauth_client_id', oauthClientId)
    .eq('import_id', payload.importId)
    .maybeSingle();
  if (replay)
    return replay.payload_hash === payloadHash
      ? json({ ...replay.report, replayed: true })
      : json({ requestId, code: 'import-id-conflict' }, 409);
  const accepted: number[] = [];
  const quarantined: Array<{
    index: number;
    code: string;
    path: string;
    message: string;
  }> = [];
  const warnings: Array<{
    index: number;
    code: string;
    path: string;
    message: string;
  }> = [];
  if (payload.analysisCoverage === 'text-only')
    warnings.push({
      index: -1,
      code: 'text-only',
      path: 'analysisCoverage',
      message: 'Les visuels du document n’ont pas été analysés.',
    });
  if (payload.analysisCoverage === 'incomplete')
    warnings.push({
      index: -1,
      code: 'incomplete',
      path: 'analysisCoverage',
      message: 'L’analyse du document est incomplète.',
    });
  const personalGroups = new Map<
    string,
    { courseId: string; chapterId: string | null; notionId: string | null }
  >();
  for (let index = 0; index < payload.questions.length; index += 1) {
    const entry = payload.questions[index];
    const path = `questions[${index}]`;
    if (
      !record(entry) ||
      [...forbidden].some((key) => Object.hasOwn(entry, key)) ||
      !safeSegments(entry.prompt) ||
      !safeSegments(entry.hint, true) ||
      !Array.isArray(entry.correction) ||
      !entry.correction.every(
        (step) => record(step) && safeSegments(step.content),
      )
    ) {
      quarantined.push({
        index,
        code: 'invalid-entry',
        path,
        message: 'Entrée ou contenu non sûr.',
      });
      continue;
    }
    const classification = entry.classification;
    let resolved: Record<string, unknown> | null = null;
    if (
      record(classification) &&
      classification.kind === 'official' &&
      cleanText(classification.chapterId) &&
      cleanText(classification.notionId) &&
      !Object.hasOwn(classification, 'partId')
    ) {
      const { data: notion } = await client
        .from('official_program_notions')
        .select('part_id,chapter_id,notion_id')
        .eq('notion_id', classification.notionId)
        .eq('chapter_id', classification.chapterId)
        .maybeSingle();
      if (notion)
        resolved = {
          kind: 'official',
          partId: notion.part_id,
          chapterId: notion.chapter_id,
          notionId: notion.notion_id,
        };
    } else if (
      record(classification) &&
      classification.kind === 'personal' &&
      cleanText(classification.proposedCourseTitle) &&
      String(classification.proposedCourseTitle).trim() &&
      cleanText(classification.proposedChapterTitle, true) &&
      cleanText(classification.proposedNotionTitle, true) &&
      classification.requiresUserConfirmation === true
    ) {
      const groupKey = `${classification.proposedCourseTitle}\u0000${classification.proposedChapterTitle ?? ''}\u0000${classification.proposedNotionTitle ?? ''}`;
      let group = personalGroups.get(groupKey);
      if (!group) {
        const { data: course, error } = await client
          .from('personal_courses')
          .insert({
            owner_id: userData.user.id,
            title: classification.proposedCourseTitle,
          })
          .select('id')
          .single();
        if (error || !course) {
          quarantined.push({
            index,
            code: 'personal-course-failed',
            path: `${path}.classification`,
            message: 'Cours personnel non créé.',
          });
          continue;
        }
        let chapterId: string | null = null;
        let notionId: string | null = null;
        if (classification.proposedChapterTitle) {
          const { data: chapter } = await client
            .from('personal_chapters')
            .insert({
              owner_id: userData.user.id,
              course_id: course.id,
              title: classification.proposedChapterTitle,
            })
            .select('id')
            .single();
          chapterId = chapter?.id ?? null;
        }
        if (classification.proposedNotionTitle) {
          const { data: notion } = await client
            .from('personal_notions')
            .insert({
              owner_id: userData.user.id,
              course_id: course.id,
              chapter_id: chapterId,
              title: classification.proposedNotionTitle,
            })
            .select('id')
            .single();
          notionId = notion?.id ?? null;
        }
        group = { courseId: course.id, chapterId, notionId };
        personalGroups.set(groupKey, group);
      }
      resolved = { kind: 'personal', ...group };
    }
    if (!resolved) {
      quarantined.push({
        index,
        code: 'classification-unresolved',
        path: `${path}.classification`,
        message: 'Classification non résolue.',
      });
      continue;
    }
    const now = new Date().toISOString();
    const provenance = {
      bundleId: payload.importId,
      importedAt: now,
      references: [
        {
          sourceLabel: 'ChatGPT course import',
          sourceReference:
            typeof entry.clientEntryId === 'string'
              ? entry.clientEntryId
              : String(index),
          sourceLocator: null,
        },
      ],
      chatGptImport: {
        coverage: payload.analysisCoverage,
        entryIndex: index,
        clientEntryId:
          typeof entry.clientEntryId === 'string' ? entry.clientEntryId : null,
        uncertainties: Array.isArray(entry.uncertainties)
          ? entry.uncertainties
          : [],
      },
    };
    const { error } = await client.from('questions').insert({
      id: crypto.randomUUID(),
      version: 1,
      owner_id: userData.user.id,
      source: 'private',
      status: 'draft',
      validated: false,
      classification: resolved,
      type: entry.type,
      difficulty: entry.type === 'reflex' ? null : entry.difficulty,
      content: {
        prompt: entry.prompt,
        hint: entry.hint,
        correction: entry.correction,
        uncertainties: entry.uncertainties ?? [],
      },
      parameterization: entry.parameterization ?? null,
      tags: entry.tags ?? [],
      provenance,
      created_at: now,
      updated_at: now,
    });
    if (error)
      quarantined.push({
        index,
        code: 'insert-failed',
        path,
        message: 'Brouillon non créé.',
      });
    else accepted.push(index);
  }
  const report = {
    schemaVersion: 1,
    importId: payload.importId,
    accepted,
    quarantined,
    warnings,
    replayed: false,
  };
  const { error: importError } = await client.from('question_imports').insert({
    owner_id: userData.user.id,
    oauth_client_id: oauthClientId,
    import_id: payload.importId,
    payload_hash: payloadHash,
    report,
    coverage: payload.analysisCoverage,
  });
  if (importError)
    return json({ requestId, code: 'idempotency-write-failed' }, 409);
  return json(report, accepted.length ? 200 : 422);
});
