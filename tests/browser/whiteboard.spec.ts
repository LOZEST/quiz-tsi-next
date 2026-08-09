import { expect, test, type Page } from '@playwright/test';

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
  await page.getByLabel('Gaucher').check();
  await expect(page.getByLabel('Gaucher')).toBeChecked();
  await page.getByRole('button', { name: 'Fermer le menu' }).click();
  expect(await canvas.boundingBox()).toEqual(canvasBeforeMenu);
  const leftTools = await page
    .getByRole('group', { name: 'Outils d’écriture' })
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
    .getByRole('group', { name: 'Outils d’écriture' })
    .boundingBox();
  expect(rightTools!.x).toBeGreaterThan(page.viewportSize()!.width * 0.7);

  await page.getByRole('button', { name: 'Gomme' }).click();
  await expect(page.getByRole('button', { name: 'Gomme' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Stylo' }).click();
  await expect(page.getByRole('button', { name: 'Grille' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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
    .getByRole('group', { name: 'Outils d’écriture' })
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
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(viewport!.height);
  expect(writingTools!.x).toBeGreaterThan(viewport!.width * 0.7);
  expect(writingTools!.x + writingTools!.width).toBeLessThanOrEqual(
    viewport!.width,
  );
  expect(history!.x).toBeLessThan(viewport!.width * 0.3);
  expect(history!.y).toBeGreaterThan(viewport!.height * 0.7);
  expect(questionActions).not.toBeNull();
  expect(questionActions!.y).toBeGreaterThan(viewport!.height * 0.7);
  await expect(page.getByRole('button', { name: 'Indice' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Correction' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Suivante' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Stylo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gomme' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grille' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

async function openRevisionOptions(page: Page) {
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('button', { name: 'Options du parcours' }).click();
}

test('uses the controlled PR4 bank and dependent free revision filters', async ({
  page,
}) => {
  await login(page);
  const card = page.getByRole('article', { name: 'Question active' });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Suites géométriques|Produit matriciel/);
  await openRevisionOptions(page);
  await page.getByLabel('Partie').selectOption('analysis');
  await page
    .getByRole('combobox', { name: 'Chapitre', exact: true })
    .selectOption('sequences');
  await page.getByLabel('Notion').selectOption('geometric-sequences');
  await page.getByLabel('Type de question').selectOption('reflex');
  await expect(page.getByLabel('Difficulté')).toHaveCount(0);
  await expect(card).toContainText('Réflexe');
  await page.getByLabel('Type de question').selectOption('');
  await expect(page.getByLabel('Difficulté')).toHaveValue('');
});

test('protects a drawn draft and atomically changes the question', async ({
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
  await page.getByRole('button', { name: 'Suivante' }).click();
  const dialog = page.getByRole('dialog', { name: 'Changer de question' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(card).toHaveText(initial ?? '');
  await page.getByRole('button', { name: 'Suivante' }).click();
  await dialog.getByRole('button', { name: 'Changer maintenant' }).click();
  await expect(card).not.toHaveText(initial ?? '');
});

test('restores focus to the filter that cancels a draft change', async ({
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
  const dialog = page.getByRole('dialog', { name: 'Changer de question' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(filter).toHaveValue('');
  await expect(filter).toBeFocused();
});

test('keeps the reflex deadline while reducing the card and navigating', async ({
  page,
}) => {
  await login(page);
  await page.evaluate(() => {
    globalThis.__QTSI_TEST_NOW__ = 1_000;
  });
  await openRevisionOptions(page);
  await page.getByLabel('Type de question').selectOption('reflex');
  await page.getByRole('button', { name: 'Fermer le menu' }).click();
  const card = page.getByRole('article', { name: 'Question active' });
  await expect(card.getByText('60 s restantes')).toBeVisible();
  await card.getByRole('button', { name: 'Réduire' }).click();
  await page.evaluate(() => {
    globalThis.__QTSI_TEST_NOW__! += 2_000;
  });
  await page.waitForTimeout(300);
  await card.getByRole('button', { name: 'Afficher la question' }).click();
  await expect(card.getByText('58 s restantes')).toBeVisible();
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('link', { name: 'Réglages' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.evaluate(() => {
    globalThis.__QTSI_TEST_NOW__! += 5_000;
  });
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await page.getByRole('link', { name: 'Tableau blanc' }).click();
  await expect(page).toHaveURL(/\/whiteboard$/);
  await expect(
    page
      .getByRole('article', { name: 'Question active' })
      .getByText('53 s restantes'),
  ).toBeVisible();
});

test('keeps the only compatible question active', async ({ page }) => {
  await login(page);
  await openRevisionOptions(page);
  await page.getByLabel('Partie').selectOption('algebra');
  await page
    .getByRole('combobox', { name: 'Chapitre', exact: true })
    .selectOption('matrices');
  await page.getByLabel('Notion').selectOption('matrix-products');
  await page.getByRole('button', { name: 'Fermer le menu' }).click();
  const card = page.getByRole('article', { name: 'Question active' });
  const current = await card.textContent();
  const canvas = page.getByTestId('whiteboard-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + 90, box!.y + 170);
  await page.mouse.down();
  await page.mouse.move(box!.x + 190, box!.y + 210, { steps: 5 });
  await page.mouse.up();
  const next = page.getByRole('button', { name: 'Suivante' });
  await next.click();
  const dialog = page.getByRole('dialog', { name: 'Changer de question' });
  await dialog.getByRole('button', { name: 'Changer maintenant' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(next).toBeFocused();
  await expect(card).toHaveText(current ?? '');
  await expect(page.getByRole('button', { name: 'Annuler' })).toBeEnabled();
  await expect(
    page.getByText('Aucune autre question compatible n’est disponible.'),
  ).toBeVisible();
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
  await expect(page.getByText('Suites géométriques')).toBeVisible();
  await expect(page.getByText('2/4')).toBeVisible();
  await page.getByLabel('Type de séance').selectOption('weak-points');
  await expect(page.getByText(/Produit matriciel/)).toBeVisible();
  await page.getByLabel('Type de séance').selectOption('chapter-test');
  await page
    .getByRole('combobox', { name: 'Chapitre', exact: true })
    .selectOption('sequences');
  await page.getByLabel('40').check();
  await expect(page.getByText(/40 questions/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Commencer/ })).toHaveCount(0);
});
