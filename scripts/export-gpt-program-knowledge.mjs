import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const program = JSON.parse(
  await readFile(
    resolve(root, 'src/data/program/official-program-v1.json'),
    'utf8',
  ),
);
const output = resolve(
  root,
  'docs/integrations/chatgpt-import/generated/program-knowledge.json',
);
const chapters = new Map(
  program.chapters.map((chapter) => [chapter.id, chapter]),
);
const knowledge = {
  schemaVersion: 1,
  generatedFrom: 'src/data/program/official-program-v1.json',
  notions: program.notions.map((notion) => ({
    chapterId: notion.chapterId,
    chapterLabel: chapters.get(notion.chapterId)?.label ?? '',
    notionId: notion.id,
    notionLabel: notion.label,
  })),
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(knowledge, null, 2)}\n`);
