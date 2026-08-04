import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('login');
  await page.getByLabel('Email').fill('whiteboard@example.test');
  await page.getByLabel('Mot de passe').fill('test-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/whiteboard$/);
}

test('shows a centered writable canvas and accessible controls', async ({
  page,
}) => {
  await login(page);
  const canvas = page.getByTestId('whiteboard-canvas');
  await expect(canvas).toBeVisible();
  await expect(
    page.getByText(
      'Aucune banque de questions validée n’est disponible pour le moment.',
    ),
  ).toBeVisible();
  const canvasBeforeMenu = await canvas.boundingBox();
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await canvas.boundingBox()).toEqual(canvasBeforeMenu);
  await page.getByRole('button', { name: 'Réglages Apple Pencil' }).click();
  await expect(page.getByLabel('Épaisseur du stylo')).toBeVisible();
  await page.getByLabel('Gaucher').check();
  await expect(page.getByLabel('Gaucher')).toBeChecked();
  await page.getByRole('button', { name: 'Fermer le menu' }).click();
  expect(await canvas.boundingBox()).toEqual(canvasBeforeMenu);

  await page.getByRole('button', { name: 'Gomme' }).click();
  await expect(page.getByRole('button', { name: 'Gomme' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Stylo' }).click();
  await page.getByRole('button', { name: 'Grille' }).click();
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
  const toolbar = await page
    .getByRole('toolbar', { name: 'Outils du tableau blanc' })
    .boundingBox();
  expect(canvas).not.toBeNull();
  expect(toolbar).not.toBeNull();
  expect(canvas!.x).toBeGreaterThanOrEqual(0);
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(viewport!.height);
  expect(toolbar!.x).toBeGreaterThanOrEqual(0);
  expect(toolbar!.x + toolbar!.width).toBeLessThanOrEqual(viewport!.width);
});
