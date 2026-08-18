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

test('publish, discover, certify, subscribe and rate a Quizz', async ({
  page,
}) => {
  await login(page, 'user@example.test');
  await page.goto('questions');

  await page.getByRole('button', { name: /Ajoute un quizz/ }).click();
  await page.getByLabel('Nouveau quizz').fill('Quizz e2e marketplace');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(
    page.getByLabel('Fil d’Ariane').getByText('Quizz e2e marketplace'),
  ).toBeVisible();

  // The public/privé switch only renders on the root quizz card, not inside
  // the quizz's own folder — it publishes/unpublishes directly.
  await page.getByRole('button', { name: 'Mes Quizz' }).click();
  // The underlying input is visually hidden inside its <label> (standard
  // accessible-toggle pattern) — click the label itself, exactly like a
  // real user would, so the browser's native label→input forwarding fires.
  await page.locator('label', { hasText: 'Privé' }).click();
  await expect(page.getByRole('checkbox', { name: 'Public' })).toBeChecked();

  await logout(page);
  await login(page, 'admin@example.test');
  await page.goto('marketplace');
  const card = page
    .locator('article')
    .filter({ hasText: 'Quizz e2e marketplace' });
  // Visible immediately, with no moderation step in between.
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: 'Quizz e2e marketplace' }).click();
  const dialog = page.getByRole('dialog');
  await expect(page.getByText('Aperçu en lecture seule')).toBeVisible();
  const ratingBeforeSubscribe = page.getByRole('radiogroup', {
    name: 'Noter ce Quizz',
  });
  await expect(ratingBeforeSubscribe.getByRole('radio').first()).toBeDisabled();
  await page.getByRole('button', { name: 'Fermer l’aperçu' }).click();

  await logout(page);
  await login(page, 'owner@example.test');
  await page.goto('admin');
  await expect(page.getByText('Quizz e2e marketplace')).toBeVisible();
  await page
    .getByRole('row', { name: /Quizz e2e marketplace/ })
    .getByRole('button', { name: 'Certifier' })
    .click();
  await expect(
    page
      .getByRole('row', { name: /Quizz e2e marketplace/ })
      .getByRole('button', { name: 'Décertifier' }),
  ).toBeVisible();

  await logout(page);
  await login(page, 'admin@example.test');
  await page.goto('marketplace');
  await card.getByRole('button', { name: 'Quizz e2e marketplace' }).click();
  await expect(dialog.getByText('Quizz certifié')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer l’aperçu' }).click();

  await card.getByRole('button', { name: 'Ajouter à mon espace' }).click();
  await expect(
    page.getByText('Le Quizz a été ajouté à ton espace.'),
  ).toBeVisible();

  await page.goto('questions');
  const subscriptions = page.getByRole('region', { name: 'Abonnements' });
  await expect(subscriptions).toBeVisible();
  await expect(subscriptions.getByText('Quizz e2e marketplace')).toBeVisible();

  await page.goto('marketplace');
  await card.getByRole('button', { name: 'Quizz e2e marketplace' }).click();
  const ratingAfterSubscribe = page.getByRole('radiogroup', {
    name: 'Noter ce Quizz',
  });
  const fifthStar = ratingAfterSubscribe.getByRole('radio').nth(4);
  await expect(fifthStar).toBeEnabled();
  await fifthStar.click();
  await page.getByRole('button', { name: 'Mettre un avis / note' }).click();
  await expect(page.getByText('Merci pour ta note.')).toBeVisible();
});
