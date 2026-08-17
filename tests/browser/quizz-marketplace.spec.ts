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

  await page.getByLabel('Nouveau quizz').fill('Quizz e2e marketplace');
  await page.getByRole('button', { name: 'Créer', exact: true }).click();
  await expect(page.getByText('Quizz e2e marketplace')).toBeVisible();

  await page
    .getByRole('button', { name: 'Publier sur la marketplace' })
    .click();
  const publishDialog = page.getByRole('dialog', {
    name: 'Publier sur la marketplace',
  });
  await expect(publishDialog).toBeVisible();
  await publishDialog
    .getByLabel('Description (facultatif)')
    .fill('Un Quizz de test end-to-end.');
  await publishDialog.getByRole('button', { name: 'Publier' }).click();
  await expect(
    publishDialog.getByText('Ton Quizz est publié sur la marketplace'),
  ).toBeVisible();
  await publishDialog.getByRole('button', { name: 'Fermer' }).click();

  await logout(page);
  await login(page, 'admin@example.test');
  await page.goto('marketplace');
  const card = page
    .locator('article')
    .filter({ hasText: 'Quizz e2e marketplace' });
  // Visible immediately, with no moderation step in between.
  await expect(card).toBeVisible();

  await card.getByRole('button', { name: 'Aperçu' }).click();
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
  await expect(card.getByText('Quizz certifié')).toBeVisible();

  await card.getByRole('button', { name: 'Ajouter à mon espace' }).click();
  await expect(
    page.getByText('Le Quizz a été ajouté à ton espace.'),
  ).toBeVisible();

  // A dismissible rating popup appears right after a successful subscribe.
  const ratePrompt = page.getByRole('dialog', { name: 'Noter ce Quizz' });
  await expect(ratePrompt).toBeVisible();
  await ratePrompt.getByRole('button', { name: 'Plus tard' }).click();
  await expect(ratePrompt).toBeHidden();

  await page.goto('questions');
  await expect(page.getByText('Abonnements')).toBeVisible();
  await expect(page.getByText('Quizz e2e marketplace')).toBeVisible();

  await page.goto('marketplace');
  await card.getByRole('button', { name: 'Aperçu' }).click();
  const ratingAfterSubscribe = page.getByRole('radiogroup', {
    name: 'Noter ce Quizz',
  });
  const fifthStar = ratingAfterSubscribe.getByRole('radio').nth(4);
  await expect(fifthStar).toBeEnabled();
  await fifthStar.click();
  await expect(page.getByText('Merci pour ta note.')).toBeVisible();
});
