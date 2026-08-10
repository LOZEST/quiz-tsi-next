import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('login');
  await page.getByLabel('Email').fill('user@example.test');
  await page.getByLabel('Mot de passe').fill('test-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/whiteboard$/);
}

test('searches, filters and previews the official bank', async ({ page }) => {
  await login(page);
  await page.goto('questions');
  await page.getByLabel('Recherche').fill('Divisibilité');
  await expect(
    page
      .locator('ul')
      .filter({ has: page.getByText(/Officielle/) })
      .getByRole('button')
      .first(),
  ).toBeVisible();
  await page.getByLabel('Source').selectOption('shared');
  await expect(
    page.getByRole('heading', { name: 'Aucun résultat' }),
  ).toBeVisible();
});

test('creates a structured local draft with math and restores it after reload', async ({
  page,
}) => {
  await login(page);
  await page.goto('questions');
  await page.getByRole('button', { name: 'Créer une question' }).click();
  const editor = page.getByRole('dialog', { name: 'Nouvelle question' });
  await editor.getByLabel('Partie').selectOption('numbers');
  await editor.getByLabel('Chapitre').selectOption('numbers-arithmetic');
  await editor.getByLabel('Notion').selectOption('NUM-F01');
  await editor.getByLabel('Texte').fill('Calculer une puissance');
  await editor.getByRole('button', { name: '+ Formule', exact: true }).click();
  await editor.getByLabel('Formule en ligne').fill('sqrt(x)');
  await expect(editor.getByText('Formule valide')).toBeVisible();
  await editor.getByRole('button', { name: 'Clavier mathématique' }).click();
  await editor.getByRole('button', { name: /ℝ/ }).click();
  await editor.getByLabel('Correction').fill('Utiliser la définition.');
  await editor
    .getByRole('button', { name: 'Enregistrer le brouillon' })
    .click();
  await expect(page.getByText('Calculer une puissance')).toBeVisible();
  await expect(page.getByText('1 en attente')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Calculer une puissance')).toBeVisible();
});

test('preserves the OAuth authorization id through login and Pages routing', async ({
  page,
}) => {
  await page.goto('oauth/consent?authorization_id=authorization-test');
  await expect(page).toHaveURL(/\/login\?returnTo=.*authorization-test/);
  await page.getByLabel('Email').fill('user@example.test');
  await page.getByLabel('Mot de passe').fill('test-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(
    /\/oauth\/consent\?authorization_id=authorization-test$/,
  );
  await expect(
    page.getByRole('heading', { name: 'Autoriser l’import Quiz TSI' }),
  ).toBeVisible();
});
