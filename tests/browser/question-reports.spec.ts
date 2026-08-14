import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email: string) {
  await page.goto('login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill('test-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/whiteboard$/);
}

async function logout(page: Page) {
  await page.goto('account');
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page).toHaveURL(/\/login/);
}

test('lets a user report a question and an admin resolve it from the admin page', async ({
  page,
}) => {
  await login(page, 'user@example.test');
  const card = page.getByRole('article', { name: 'Question active' });
  await expect(card).toBeVisible();

  await card
    .getByRole('button', { name: 'Signaler un problème sur cette question' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Signaler un problème' });
  await expect(dialog).toBeVisible();
  const submit = dialog.getByRole('button', { name: 'Envoyer' });
  await expect(submit).toBeDisabled();
  await dialog.getByRole('radio', { name: 'Correction incomplète' }).click();
  await dialog.getByLabel(/Remarque/).fill('La correction s’arrête trop tôt.');
  await submit.click();
  await expect(
    dialog.getByText('Merci, ton signalement a bien été envoyé.'),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await logout(page);
  await login(page, 'owner@example.test');
  await page.goto('admin');
  await expect(page.getByText('La correction s’arrête trop tôt.')).toBeVisible();
  await expect(page.getByText('Correction incomplète')).toBeVisible();

  const statusSelect = page.getByLabel(/Statut du signalement/);
  await statusSelect.selectOption('in_progress');
  await expect(statusSelect).toHaveValue('in_progress');

  await page.getByLabel('Filtrer par statut').selectOption('resolved');
  await expect(
    page.getByText('Aucun signalement pour ce statut.'),
  ).toBeVisible();
  await page.getByLabel('Filtrer par statut').selectOption('all');
  await expect(page.getByText('La correction s’arrête trop tôt.')).toBeVisible();

  await page
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copier pour l’IA' }).click();
  await expect(page.getByText('Copié dans le presse-papiers.')).toBeVisible();
  const clipboardText = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  expect(clipboardText).toContain('Correction incomplète');
  expect(clipboardText).toContain('La correction s’arrête trop tôt.');
});
