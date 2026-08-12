import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

async function login(page: Page) {
  await page.goto('login');
  await page.getByLabel('Email').fill('whiteboard@example.test');
  await page.getByLabel('Mot de passe').fill('test-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/whiteboard$/);
}

async function openPencilSettings(page: Page) {
  const trigger = page.getByRole('button', { name: 'Réglages Apple Pencil' });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true')
    await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
}

interface BrowserShape {
  kind: 'shape';
  shapeKind: string;
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number | null;
  };
}

const paletteShapes = [
  {
    label: 'Repère quadrillé',
    kind: 'grid-coordinate-system',
    slug: 'repere-quadrille',
  },
  {
    label: 'Repère gradué',
    kind: 'graduated-coordinate-system',
    slug: 'repere-gradue',
  },
  {
    label: 'Cercle trigonométrique',
    kind: 'trigonometric-circle',
    slug: 'cercle-trigonometrique',
  },
  {
    label: 'Tableau de signes/variations',
    kind: 'sign-chart',
    slug: 'tableau-variations',
  },
] as const;

async function evidencePath(testInfo: TestInfo, file: string) {
  const directory = join(
    process.cwd(),
    'docs/quality/evidence/whiteboard-tools',
  );
  await mkdir(directory, { recursive: true });
  return join(directory, `${testInfo.project.name}-${file}.png`);
}

interface BrowserScene {
  logicalWidth: number;
  logicalHeight: number;
  objects: Array<
    | BrowserShape
    | { kind: 'stroke'; points: Array<{ x: number; y: number }> }
    | { kind: 'eraser-mask'; points: Array<{ x: number; y: number }> }
  >;
}

async function dispatchPenPath(
  page: Page,
  points: Array<{ x: number; y: number }>,
  holdMs = 0,
) {
  await page.evaluate(
    async ({ path, hold }) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="whiteboard-canvas"]',
      );
      if (!canvas) throw new Error('Whiteboard canvas missing.');
      Object.defineProperties(canvas, {
        setPointerCapture: { configurable: true, value: () => undefined },
        hasPointerCapture: { configurable: true, value: () => true },
        releasePointerCapture: { configurable: true, value: () => undefined },
      });
      const emit = (type: string, sample: { x: number; y: number }) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: sample.x,
            clientY: sample.y,
            pointerId: 91,
            pointerType: 'pen',
            pressure: 0.65,
          }),
        );
      emit('pointerdown', path[0]!);
      path.slice(1).forEach((sample) => emit('pointermove', sample));
      if (hold > 0)
        await new Promise((resolve) => window.setTimeout(resolve, hold));
      emit('pointerup', path.at(-1)!);
    },
    { path: points, hold: holdMs },
  );
}

async function readWhiteboardScene(page: Page): Promise<BrowserScene> {
  return page.evaluate(async () => {
    const request = indexedDB.open('quiz-tsi-user-workspaces', 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('IndexedDB opening failed.'));
    });
    const transaction = database.transaction('whiteboardScenes', 'readonly');
    const rows = await new Promise<Array<{ scene: BrowserScene }>>(
      (resolve, reject) => {
        const getAll = transaction.objectStore('whiteboardScenes').getAll();
        getAll.onsuccess = () =>
          resolve(getAll.result as Array<{ scene: BrowserScene }>);
        getAll.onerror = () =>
          reject(getAll.error ?? new Error('Scene reading failed.'));
      },
    );
    database.close();
    const scene = rows.at(-1)?.scene;
    if (!scene) throw new Error('Whiteboard scene missing.');
    return scene;
  });
}

function shapeFrom(scene: BrowserScene): BrowserShape {
  const shape = scene.objects.find(
    (object): object is BrowserShape => object.kind === 'shape',
  );
  if (!shape) throw new Error('Shape missing.');
  return shape;
}

function localToWorld(shape: BrowserShape, x: number, y: number) {
  const geometry = shape.geometry;
  const rotation = geometry.rotation ?? 0;
  const dx = x - geometry.width / 2;
  const dy = y - geometry.height / 2;
  return {
    x:
      geometry.x +
      geometry.width / 2 +
      Math.cos(rotation) * dx -
      Math.sin(rotation) * dy,
    y:
      geometry.y +
      geometry.height / 2 +
      Math.sin(rotation) * dx +
      Math.cos(rotation) * dy,
  };
}

function logicalToScreen(
  box: { x: number; y: number; width: number; height: number },
  scene: BrowserScene,
  point: { x: number; y: number },
) {
  const scale = Math.min(
    box.width / scene.logicalWidth,
    box.height / scene.logicalHeight,
  );
  return {
    x: box.x + (box.width - scene.logicalWidth * scale) / 2 + point.x * scale,
    y: box.y + (box.height - scene.logicalHeight * scale) / 2 + point.y * scale,
  };
}

test('shows a centered writable canvas and accessible controls', async ({
  page,
}) => {
  await login(page);
  const canvas = page.getByTestId('whiteboard-canvas');
  await expect(canvas).toBeVisible();
  await expect(
    page.getByRole('article', { name: 'Question active' }),
  ).toBeVisible();
  const canvasBeforeMenu = await canvas.boundingBox();
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await canvas.boundingBox()).toEqual(canvasBeforeMenu);
  await openPencilSettings(page);
  await expect(page.getByLabel('Épaisseur du stylo')).toBeVisible();
  await expect(page.getByLabel('Afficher la grille')).toBeChecked();
  await expect(page.getByLabel('Formes magiques')).toBeChecked();
  await expect(page.getByLabel('Effacer en griffonnant')).toBeChecked();
  await expect(page.getByLabel('Objet')).toBeChecked();
  await expect(page.getByLabel('Pixel')).not.toBeChecked();
  await page.getByLabel('Pixel').check();
  await expect(page.getByLabel('Pixel')).toBeChecked();
  await page.getByLabel('Objet').check();
  await page.getByLabel('Afficher la grille').uncheck();
  await expect(page.getByLabel('Afficher la grille')).not.toBeChecked();
  await page.getByLabel('Gaucher').check();
  await expect(page.getByLabel('Gaucher')).toBeChecked();
  await page.getByRole('button', { name: 'Fermer le menu' }).click();
  expect(await canvas.boundingBox()).toEqual(canvasBeforeMenu);
  const leftTools = await page
    .getByRole('group', { name: 'Outils principaux' })
    .boundingBox();
  const rightHistory = await page
    .getByRole('group', { name: 'Historique' })
    .boundingBox();
  expect(leftTools!.x).toBeLessThan(page.viewportSize()!.width * 0.3);
  expect(rightHistory!.x).toBeGreaterThan(page.viewportSize()!.width * 0.7);
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await openPencilSettings(page);
  await page.getByLabel('Droitier').check();
  await page.getByRole('button', { name: 'Fermer le menu' }).click();
  const rightTools = await page
    .getByRole('group', { name: 'Outils principaux' })
    .boundingBox();
  expect(rightTools!.x).toBeGreaterThan(page.viewportSize()!.width * 0.7);

  const writingTool = page.getByRole('button', { name: 'Stylo' });
  await writingTool.click();
  await expect(page.getByRole('button', { name: 'Gomme' })).toBeVisible();
  await expect(
    page.getByRole('menu', { name: 'Choisir un outil' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Gomme' }).click();
  await expect(page.getByRole('button', { name: 'Stylo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Formes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grille' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Pixel|Griffonn|Rectangle magique/ }),
  ).toHaveCount(0);
});

test('draws with pointer events and restores the local scene after reload', async ({
  page,
}) => {
  await login(page);
  const canvas = page.getByTestId('whiteboard-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 100, box!.y + 160);
  await page.mouse.down();
  await page.mouse.move(box!.x + 240, box!.y + 230, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const request = indexedDB.open('quiz-tsi-user-workspaces', 2);
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () =>
            reject(request.error ?? new Error('IndexedDB opening failed.'));
        });
        const transaction = database.transaction(
          'whiteboardScenes',
          'readonly',
        );
        const count = await new Promise<number>((resolve, reject) => {
          const countRequest = transaction
            .objectStore('whiteboardScenes')
            .count();
          countRequest.onsuccess = () => resolve(countRequest.result);
          countRequest.onerror = () =>
            reject(countRequest.error ?? new Error('IndexedDB count failed.'));
        });
        database.close();
        return count;
      }),
    )
    .toBeGreaterThan(0);
  await page.reload();
  await expect(canvas).toBeVisible();
});

test('keeps the toolbar and canvas within the viewport', async ({ page }) => {
  await login(page);
  const viewport = page.viewportSize();
  const canvas = await page.getByTestId('whiteboard-canvas').boundingBox();
  const writingTools = await page
    .getByRole('group', { name: 'Outils principaux' })
    .boundingBox();
  const history = await page
    .getByRole('group', { name: 'Historique' })
    .boundingBox();
  const questionActions = await page
    .getByRole('group', { name: 'Actions de la question' })
    .boundingBox();
  expect(canvas).not.toBeNull();
  expect(writingTools).not.toBeNull();
  expect(history).not.toBeNull();
  expect(canvas!.x).toBeGreaterThanOrEqual(0);
  expect(canvas!.y).toBe(0);
  expect(canvas!.height).toBeGreaterThanOrEqual(viewport!.height * 0.98);
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(viewport!.height);
  expect(writingTools!.x).toBeGreaterThan(viewport!.width * 0.7);
  expect(writingTools!.x + writingTools!.width).toBeLessThanOrEqual(
    viewport!.width,
  );
  expect(history!.x).toBeLessThan(viewport!.width * 0.3);
  expect(history!.y).toBeGreaterThan(viewport!.height * 0.7);
  expect(questionActions).not.toBeNull();
  expect(questionActions!.y).toBeGreaterThan(viewport!.height * 0.7);
  await expect(page.getByRole('button', { name: 'Indice' })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Voir la correction' }),
  ).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Passer' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Stylo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gomme' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Formes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grille' })).toHaveCount(0);
  await expect(
    page.getByRole('group', { name: 'Outils principaux' }).getByRole('button'),
  ).toHaveCount(2);

  await page.getByRole('button', { name: 'Formes' }).click();
  const shapeMenu = page.getByRole('menu', { name: 'Choisir une forme' });
  await expect(shapeMenu.getByTestId('shape-option')).toHaveCount(4);
  for (const { label: name } of paletteShapes)
    await expect(shapeMenu.getByRole('menuitemradio', { name })).toBeVisible();
  for (const name of [
    'Droite',
    'Flèche',
    'Rectangle',
    'Carré',
    'Cercle',
    'Triangle',
    'Axes',
  ])
    await expect(
      shapeMenu.getByRole('menuitemradio', { name, exact: true }),
    ).toHaveCount(0);
  await expect(shapeMenu.getByText(/petite|moyenne|grande/i)).toHaveCount(0);
});

test('places, moves and resizes a mathematical shape with atomic history', async ({
  page,
}) => {
  await login(page);
  const canvas = page.getByTestId('whiteboard-canvas');
  const box = await canvas.boundingBox();
  await page.getByRole('button', { name: 'Formes' }).click();
  await page
    .getByRole('menuitemradio', { name: 'Tableau de signes/variations' })
    .click();
  await page.mouse.move(box!.x + 220, box!.y + 220);
  await page.mouse.down();
  await page.mouse.move(box!.x + 380, box!.y + 320, { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Formes' }).click();
  await page
    .getByRole('menuitem', { name: 'Sélectionner et modifier une forme' })
    .click();

  let scene = await readWhiteboardScene(page);
  let shape = shapeFrom(scene);
  const body = logicalToScreen(
    box!,
    scene,
    localToWorld(shape, 0, shape.geometry.height / 2),
  );
  await page.mouse.move(body.x, body.y);
  await page.mouse.down();
  await page.mouse.move(body.x + 40, body.y + 30, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => shapeFrom(await readWhiteboardScene(page)).geometry.x)
    .toBeGreaterThan(shape.geometry.x + 30);

  scene = await readWhiteboardScene(page);
  shape = shapeFrom(scene);
  const beforeResize = structuredClone(shape.geometry);
  const resizeHandle = logicalToScreen(
    box!,
    scene,
    localToWorld(shape, shape.geometry.width, shape.geometry.height),
  );
  const resizeTarget = logicalToScreen(
    box!,
    scene,
    localToWorld(shape, shape.geometry.width + 70, shape.geometry.height + 45),
  );
  await page.mouse.move(resizeHandle.x, resizeHandle.y);
  await page.mouse.down();
  await page.mouse.move(resizeTarget.x, resizeTarget.y, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => shapeFrom(await readWhiteboardScene(page)).geometry.width)
    .toBeGreaterThan(beforeResize.width + 60);
  const afterResize = structuredClone(
    shapeFrom(await readWhiteboardScene(page)).geometry,
  );

  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect
    .poll(async () => shapeFrom(await readWhiteboardScene(page)).geometry.width)
    .toBeCloseTo(beforeResize.width, 5);
  await page.getByRole('button', { name: 'Rétablir' }).click();
  await expect
    .poll(async () => shapeFrom(await readWhiteboardScene(page)).geometry.width)
    .toBeCloseTo(afterResize.width, 5);
});

test('the writing button changes the actual canvas tool immediately', async ({
  page,
}) => {
  await login(page);
  const canvas = page.getByTestId('whiteboard-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 180, box!.y + 300);
  await page.mouse.down();
  await page.mouse.move(box!.x + 320, box!.y + 300, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => (await readWhiteboardScene(page)).objects.length)
    .toBe(1);

  await page.getByRole('button', { name: 'Stylo' }).click();
  await expect(page.getByRole('button', { name: 'Gomme' })).toBeVisible();
  await page.mouse.click(box!.x + 250, box!.y + 300);
  await expect
    .poll(async () => (await readWhiteboardScene(page)).objects.length)
    .toBe(0);

  await page.getByRole('button', { name: 'Gomme' }).click();
  await expect(page.getByRole('button', { name: 'Stylo' })).toBeVisible();
  await page.mouse.move(box!.x + 180, box!.y + 340);
  await page.mouse.down();
  await page.mouse.move(box!.x + 320, box!.y + 340, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => (await readWhiteboardScene(page)).objects.length)
    .toBe(1);
});

test('supports Pencil rectangle snap, scribble delete and both eraser modes', async ({
  page,
}) => {
  await login(page);
  const canvas = page.getByTestId('whiteboard-canvas');
  const box = await canvas.boundingBox();
  const initial = await readWhiteboardScene(page);
  const screen = (point: { x: number; y: number }) =>
    logicalToScreen(box!, initial, point);

  const rectangle = [
    ...Array.from({ length: 8 }, (_, i) =>
      screen({ x: 260 + i * 25, y: 250 + (i % 2) }),
    ),
    ...Array.from({ length: 6 }, (_, i) =>
      screen({ x: 435 + (i % 2), y: 250 + i * 25 }),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      screen({ x: 435 - i * 25, y: 375 + (i % 2) }),
    ),
    ...Array.from({ length: 6 }, (_, i) =>
      screen({ x: 260 + (i % 2), y: 375 - i * 25 }),
    ),
    screen({ x: 260, y: 250 }),
  ];
  await dispatchPenPath(page, rectangle, 550);
  await expect
    .poll(async () => {
      const object = (await readWhiteboardScene(page)).objects[0];
      return object?.kind === 'stroke' ? object.points.length : 0;
    })
    .toBe(5);
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect
    .poll(async () => (await readWhiteboardScene(page)).objects.length)
    .toBe(0);

  const target = Array.from({ length: 12 }, (_, i) =>
    screen({ x: 220 + i * 28, y: 500 }),
  );
  await dispatchPenPath(page, target);
  await expect
    .poll(async () => (await readWhiteboardScene(page)).objects.length)
    .toBe(1);
  const scribble = Array.from({ length: 28 }, (_, i) =>
    screen({ x: i % 2 === 0 ? 280 : 470, y: 465 + ((i * 17) % 70) }),
  );
  await dispatchPenPath(page, scribble);
  await expect
    .poll(async () => (await readWhiteboardScene(page)).objects.length)
    .toBe(0);
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect
    .poll(async () => (await readWhiteboardScene(page)).objects.length)
    .toBe(1);

  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await openPencilSettings(page);
  await page.getByLabel('Pixel').check();
  await page.getByRole('button', { name: 'Fermer le menu' }).click();
  await page.getByRole('button', { name: 'Stylo' }).click();
  await dispatchPenPath(page, [
    screen({ x: 300, y: 500 }),
    screen({ x: 430, y: 500 }),
  ]);
  await expect
    .poll(
      async () =>
        (await readWhiteboardScene(page)).objects.filter(
          (object) => object.kind === 'stroke',
        ).length,
    )
    .toBe(2);
  await page.getByRole('button', { name: 'Annuler' }).click();
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await openPencilSettings(page);
  await page.getByLabel('Objet').check();
  await page.getByRole('button', { name: 'Fermer le menu' }).click();
  await dispatchPenPath(page, [screen({ x: 350, y: 500 })]);
  await expect
    .poll(async () => (await readWhiteboardScene(page)).objects.length)
    .toBe(0);
});

test('captures the four-card palette and every placed reference shape', async ({
  page,
}, testInfo) => {
  await login(page);
  const canvas = page.getByTestId('whiteboard-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const initialScene = await readWhiteboardScene(page);
  const start = logicalToScreen(box!, initialScene, { x: 190, y: 230 });
  const end = logicalToScreen(box!, initialScene, { x: 790, y: 610 });

  await page.getByRole('button', { name: 'Formes' }).click();
  const menu = page.getByRole('menu', { name: 'Choisir une forme' });
  await expect(menu.getByTestId('shape-option')).toHaveCount(4);
  await page.screenshot({
    path: await evidencePath(testInfo, 'palette'),
    fullPage: true,
  });

  for (const reference of paletteShapes) {
    await menu.getByRole('menuitemradio', { name: reference.label }).click();
    const placementEnd =
      reference.kind === 'trigonometric-circle'
        ? logicalToScreen(box!, initialScene, { x: 650, y: 610 })
        : end;
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(placementEnd.x, placementEnd.y, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () => shapeFrom(await readWhiteboardScene(page)).shapeKind)
      .toBe(reference.kind);
    await page.getByRole('button', { name: 'Stylo' }).click();
    await page.screenshot({
      path: await evidencePath(testInfo, reference.slug),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect
      .poll(async () => (await readWhiteboardScene(page)).objects.length)
      .toBe(0);
    if (reference !== paletteShapes.at(-1)) {
      await page.getByRole('button', { name: 'Formes' }).click();
      await expect(menu).toBeVisible();
    }
  }
});

test('opens the local progress summary and voluntary disclosure', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('link', { name: 'Mon parcours' }).click();
  await expect(page).toHaveURL(/\/progress$/);
  await expect(page.getByRole('heading', { name: 'Synthèse' })).toBeVisible();
  await expect(page.getByTestId('primary-indicator')).toHaveCount(1);
  await expect(page.getByTestId('notion-details')).toHaveCount(0);
  await page
    .getByRole('button', { name: /Bases indispensables/ })
    .first()
    .click();
  const notion = page
    .getByRole('button', { name: /Nombres et arithmétique/ })
    .first();
  if (await notion.isVisible()) {
    await notion.click();
    await expect(page.getByTestId('notion-details')).toBeVisible();
  }
  await page.goto('whiteboard');
  await expect(page.getByTestId('whiteboard-canvas')).toBeVisible();
});

async function openRevisionOptions(page: Page) {
  const openMenu = page.getByRole('button', { name: 'Ouvrir le menu' });
  if (await openMenu.isVisible()) await openMenu.click();
  const options = page.getByRole('button', { name: 'Options du parcours' });
  if ((await options.getAttribute('aria-expanded')) !== 'true')
    await options.click();
}

test('uses the complete production bank and dependent free revision filters', async ({
  page,
}) => {
  await login(page);
  const card = page.getByRole('article', { name: 'Question active' });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Calcul|Réflexe/);
  await openRevisionOptions(page);
  const drawerPanel = page.getByRole('dialog').locator(':scope > div');
  expect(
    await drawerPanel.evaluate((element) =>
      Math.max(0, element.scrollWidth - element.clientWidth),
    ),
  ).toBe(0);
  const chapterSelect = page.getByRole('combobox', {
    name: 'Chapitre',
    exact: true,
  });
  expect(
    (await chapterSelect.locator('option').allTextContents()).some((label) =>
      label.includes(' — '),
    ),
  ).toBe(false);
  await page.getByLabel('Partie').selectOption('fundamentals');
  await chapterSelect.selectOption('numbers-arithmetic');
  await page.getByLabel('Notion').selectOption('NUM-F01');
  await page.getByLabel('Type de question').selectOption('calculation');
  await expect(card).toContainText('Calcul');
  await expect(page.getByLabel('Difficulté')).toHaveValue('');
});

test('navigates a non-NUM notion through all difficulties and reflex mode', async ({
  page,
}) => {
  await login(page);
  await openRevisionOptions(page);
  const card = page.getByRole('article', { name: 'Question active' });
  await page.getByLabel('Partie').selectOption('functions-analysis');
  await page
    .getByRole('combobox', { name: 'Chapitre', exact: true })
    .selectOption('derivatives-function-study');
  await page.getByLabel('Notion').selectOption('DER-F01');
  await page.getByLabel('Type de question').selectOption('calculation');
  for (const difficulty of ['fundamental', 'standard', 'trap']) {
    await page.getByLabel('Difficulté').selectOption(difficulty);
    await expect(page.getByLabel('Difficulté')).toHaveValue(difficulty);
    await expect(card).toContainText(/Dérivées usuelles.*Calcul/i);
  }

  await page.getByLabel('Type de question').selectOption('reflex');
  await expect(page.getByLabel('Difficulté')).toHaveCount(0);
  await expect(card).toContainText(/Dérivées usuelles.*Réflexe/i);
  await page.getByRole('button', { name: 'Fermer le menu' }).click();
  const first = await card.textContent();
  await page.getByRole('button', { name: 'Passer' }).click();
  await page.getByRole('button', { name: 'Question suivante' }).click();
  await expect(card).not.toHaveText(first ?? '');
});

test('clears a drawn draft and atomically changes the question without a dialog', async ({
  page,
}) => {
  await login(page);
  const card = page.getByRole('article', { name: 'Question active' });
  const initial = await card.textContent();
  const canvas = page.getByTestId('whiteboard-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + 80, box!.y + 180);
  await page.mouse.down();
  await page.mouse.move(box!.x + 180, box!.y + 220, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Passer' }).click();
  await page.getByRole('button', { name: 'Question suivante' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Changer de question' }),
  ).toHaveCount(0);
  await expect(card).not.toHaveText(initial ?? '');
});

test('applies a filter with a draft without showing a confirmation', async ({
  page,
}) => {
  await login(page);
  const canvas = page.getByTestId('whiteboard-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + 80, box!.y + 180);
  await page.mouse.down();
  await page.mouse.move(box!.x + 180, box!.y + 220, { steps: 5 });
  await page.mouse.up();
  await openRevisionOptions(page);
  const filter = page.getByLabel('Type de question');
  await filter.selectOption('calculation');
  await expect(
    page.getByRole('dialog', { name: 'Changer de question' }),
  ).toHaveCount(0);
  await expect(filter).toHaveValue('calculation');
});

test('keeps the question stable while reducing the card and navigating', async ({
  page,
}) => {
  await login(page);
  const card = page.getByRole('article', { name: 'Question active' });
  const original = await card.textContent();
  await card.getByRole('button', { name: 'Réduire' }).click();
  await card.getByRole('button', { name: 'Afficher la question' }).click();
  await expect(card).toHaveText(original ?? '');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('link', { name: 'Réglages' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('link', { name: 'Tableau blanc' }).click();
  await expect(page).toHaveURL(/\/whiteboard$/);
  await expect(
    page.getByRole('article', { name: 'Question active' }),
  ).toHaveText(original ?? '');
});

test('keeps a compatible NUM filter active while changing question', async ({
  page,
}) => {
  await login(page);
  await openRevisionOptions(page);
  await page.getByLabel('Partie').selectOption('fundamentals');
  await page
    .getByRole('combobox', { name: 'Chapitre', exact: true })
    .selectOption('numbers-arithmetic');
  await page.getByLabel('Notion').selectOption('NUM-F01');
  await page.getByRole('button', { name: 'Fermer le menu' }).click();
  const card = page.getByRole('article', { name: 'Question active' });
  const current = await card.textContent();
  const canvas = page.getByTestId('whiteboard-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + 90, box!.y + 170);
  await page.mouse.down();
  await page.mouse.move(box!.x + 190, box!.y + 210, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Passer' }).click();
  const next = page.getByRole('button', { name: 'Question suivante' });
  await next.click();
  await expect(
    page.getByRole('dialog', { name: 'Changer de question' }),
  ).toHaveCount(0);
  await expect(card).not.toHaveText(current ?? '');
  await expect
    .poll(async () => (await readWhiteboardScene(page)).objects)
    .toEqual([]);
  await openRevisionOptions(page);
  await expect(page.getByLabel('Partie')).toHaveValue('fundamentals');
  await expect(
    page.getByRole('combobox', { name: 'Chapitre', exact: true }),
  ).toHaveValue('numbers-arithmetic');
  await expect(page.getByLabel('Notion')).toHaveValue('NUM-F01');
});

test('renders Daily empty states and Weak points calibration', async ({
  page,
}) => {
  await login(page);
  await openRevisionOptions(page);
  await page.getByLabel('Type de séance').selectOption('daily');
  await expect(
    page.getByText('Aucune révision n’est prévue aujourd’hui. Tu es à jour.'),
  ).toBeVisible();
  await page.getByLabel('Type de séance').selectOption('weak-points');
  await expect(
    page.getByText(/L’application apprend encore ton niveau/),
  ).toBeVisible();
  await page.goto('whiteboard?daily=completed');
  await openRevisionOptions(page);
  await page.getByLabel('Type de séance').selectOption('daily');
  await expect(
    page.getByText(
      'Révision du jour terminée. Toutes les notions prévues ont été révisées.',
    ),
  ).toBeVisible();
});

test('renders controlled Daily, Weak points and chapter-test states', async ({
  page,
}) => {
  await login(page);
  await page.goto('whiteboard?daily=ready&weak=ready');
  await openRevisionOptions(page);
  await page.getByLabel('Type de séance').selectOption('daily');
  await expect(page.getByText(/Calcul d’une expression/)).toBeVisible();
  await expect(page.getByText('2/4')).toBeVisible();
  await page.getByLabel('Type de séance').selectOption('weak-points');
  await expect(page.getByText(/Divisibilité/)).toBeVisible();
  await page.getByLabel('Type de séance').selectOption('chapter-test');
  await page
    .getByRole('combobox', { name: 'Chapitre', exact: true })
    .selectOption('numbers-arithmetic');
  await page.getByLabel('40').check();
  await expect(page.getByText('60 question(s) compatible(s).')).toBeVisible();
  const start = page.getByRole('button', { name: /Commencer/ });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByText('Question 1 / 40')).toBeVisible();
  await page.getByRole('button', { name: 'Question suivante' }).click();
  await expect(page.getByText('Question 2 / 40')).toBeVisible();
  await page.reload();
  await openRevisionOptions(page);
  await page.getByLabel('Type de séance').selectOption('chapter-test');
  await expect(page.getByText('Question 2 / 40')).toBeVisible();
  await page.getByRole('button', { name: 'Soumettre le test' }).click();
  const confirmation = page.getByRole('dialog', {
    name: 'Soumettre le test ?',
  });
  await confirmation.getByRole('button', { name: 'Confirmer' }).click();
  await expect(page.getByText('Réussies sans aide')).toBeVisible();
});

test('keeps the same question and canvas through hint, correction and evaluation', async ({
  page,
}) => {
  await login(page);
  const question = page.getByRole('article', { name: 'Question active' });
  const prompt = await question.textContent();
  const canvas = page.getByTestId('whiteboard-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas absent.');
  await page.mouse.move(box.x + 120, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 220, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Indice' }).click();
  await expect(
    page.getByRole('complementary', { name: 'Indice' }),
  ).toBeVisible();
  expect(await question.textContent()).toBe(prompt);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('complementary', { name: 'Indice' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Voir la correction' }).click();
  await expect(
    page.getByRole('complementary', { name: 'Correction' }),
  ).toBeVisible();
  expect(await question.textContent()).toBe(prompt);
  await expect(
    page.getByRole('button', { name: 'Partiellement réussi' }),
  ).toHaveCount(0);
  const actions = page.getByRole('group', { name: 'Actions de la question' });
  await expect(actions.getByRole('button')).toHaveText([
    'Réussi',
    'Raté',
    'Question suivante',
  ]);
  for (const name of [
    'Indice',
    'Voir la correction',
    'Passer',
    'Partiellement réussi',
    'Presque réussi',
  ])
    await expect(actions.getByRole('button', { name })).toHaveCount(0);
  await actions.getByRole('button', { name: 'Réussi' }).click();
  await expect(
    page.getByRole('complementary', { name: 'Correction' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(
    page.getByRole('complementary', { name: 'Correction' }),
  ).toHaveCount(0);
  await expect(actions.getByRole('button')).toHaveText(['Question suivante']);
  expect(await question.textContent()).toBe(prompt);
  await actions.getByRole('button', { name: 'Question suivante' }).click();
  await expect(question).not.toHaveText(prompt ?? '');
});

test('accepts a failed evaluation while the correction bubble is open', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Voir la correction' }).click();
  const correction = page.getByRole('complementary', { name: 'Correction' });
  await expect(correction).toBeVisible();
  await page.getByRole('button', { name: 'Raté' }).click();
  await expect(correction).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Question suivante' }),
  ).toBeVisible();
});
