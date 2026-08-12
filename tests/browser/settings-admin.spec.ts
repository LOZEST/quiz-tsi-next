import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email: string) {
  await page.goto('login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill('test-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/whiteboard$/);
}

test('switches the whole app to dark mode from Settings', async ({ page }) => {
  await login(page, 'user@example.test');
  await page.goto('settings');
  await page.getByRole('radio', { name: 'Sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Sombre' })).toBeChecked();
});

test('lets an owner promote another account from the admin page', async ({
  page,
}) => {
  await login(page, 'owner@example.test');
  await page.goto('admin');
  await expect(page.getByText('user@example.test')).toBeVisible();
  await page.getByLabel('Rôle de user@example.test').selectOption('admin');
  await expect(page.getByLabel('Rôle de user@example.test')).toHaveValue(
    'admin',
  );
});

test('hides role controls from an admin', async ({ page }) => {
  await login(page, 'admin@example.test');
  await page.goto('admin');
  await expect(page.getByText('user@example.test')).toBeVisible();
  await expect(page.getByLabel(/^Rôle de /)).toHaveCount(0);
});

test('denies admin access to a plain user', async ({ page }) => {
  await login(page, 'user@example.test');
  await page.goto('admin');
  await expect(
    page.getByRole('heading', { name: /accès refusé|refusé/i }),
  ).toBeVisible();
});
