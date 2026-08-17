import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('login');
  await page.getByLabel('Email').fill('user@example.test');
  await page.getByLabel('Mot de passe').fill('test-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/whiteboard$/);
}

test('creates a structured local draft with math and restores it after reload', async ({
  page,
}) => {
  await login(page);
  await page.goto('questions');
  await page.getByRole('button', { name: /Ajoute un quizz/ }).click();
  await page.getByPlaceholder('Nouveau quizz').fill('Arithmétique');
  await page.getByRole('button', { name: 'Créer' }).click();
  await page
    .getByRole('button', { name: 'Ajouter une question à la main' })
    .click();
  const editor = page.getByRole('dialog', { name: 'Nouvelle question' });
  const prompt = editor.getByRole('group', { name: 'Énoncé' });
  await prompt.getByLabel('Texte').fill('Calculer une puissance');
  await prompt.getByRole('button', { name: '+ Formule', exact: true }).click();
  await prompt.getByLabel('Formule en ligne').fill('sqrt(x)');
  await expect(editor.getByText('Formule valide')).toBeVisible();
  await editor.getByRole('button', { name: 'Clavier mathématique' }).click();
  await editor.getByRole('button', { name: /ℝ/ }).click();
  const correction = editor.getByRole('group', {
    name: 'Contenu de l’étape 1',
  });
  await correction.getByRole('button', { name: '+ Texte' }).click();
  await correction.getByLabel('Texte').fill('Utiliser la définition.');
  await editor
    .getByRole('button', { name: 'Enregistrer le brouillon' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Calculer une puissance' }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Arithmétique/ }).click();
  await expect(
    page.getByRole('button', { name: 'Calculer une puissance' }),
  ).toBeVisible();
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
    page.getByRole('heading', { name: 'Autoriser l’import Prépa Math' }),
  ).toBeVisible();
});
