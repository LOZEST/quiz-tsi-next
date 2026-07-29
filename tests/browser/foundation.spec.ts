import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const destinations = [
  ['Tableau blanc', 'whiteboard', 'Tableau blanc'],
  ['Mon parcours', 'progress', 'Mon parcours'],
  ['Banque de questions', 'questions', 'Banque de questions'],
  ['Réglages', 'settings', 'Réglages'],
] as const;

test('loads login without a hash route', async ({ page }) => {
  await page.goto('login');
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
});

test('navigates through the four destinations and marks each active', async ({
  page,
}) => {
  await page.goto('whiteboard');

  for (const [label, route, heading] of destinations) {
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    const link = page.getByRole('link', { name: label });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/quiz-tsi-next/${route}$`));
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await expect(page.getByRole('link', { name: label })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.getByRole('button', { name: 'Fermer le menu' }).click();
  }
});

test('closes the drawer with Escape and restores focus', async ({ page }) => {
  await page.goto('whiteboard');
  const trigger = page.getByRole('button', { name: 'Ouvrir le menu' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('offers 44px targets, skip navigation and visible focus', async ({
  page,
}) => {
  await page.goto('whiteboard');
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', {
    name: 'Aller au contenu principal',
  });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await skipLink.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  const trigger = page.getByRole('button', { name: 'Ouvrir le menu' });
  const box = await trigger.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);

  await trigger.focus();
  const outlineWidth = await trigger.evaluate(
    (element) => getComputedStyle(element).outlineWidth,
  );
  expect(Number.parseFloat(outlineWidth)).toBeGreaterThan(0);
});

test('reduces motion when requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('whiteboard');
  const duration = await page
    .getByRole('button', { name: 'Ouvrir le menu' })
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
});

test('reloads a Pages deep route and preserves query and hash', async ({
  page,
}) => {
  await page.goto('questions?type=course#details');
  await expect(
    page.getByRole('heading', { name: 'Banque de questions' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Banque de questions' }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /\/quiz-tsi-next\/questions\?type=course#details$/,
  );
});

test('reloads every foundation route through the real Pages fallback', async ({
  page,
}) => {
  for (const route of [
    'login',
    'whiteboard',
    'progress',
    'questions',
    'settings',
    'account',
    'admin',
    'unknown',
  ]) {
    await page.goto(route);
    await page.reload();
    await expect(page.locator('body')).not.toBeEmpty();
    expect(new URL(page.url()).hash.startsWith('#/')).toBe(false);
  }
  await expect(
    page.getByRole('heading', { name: 'Page introuvable' }),
  ).toBeVisible();
});

test('keeps the shell usable in the configured viewport', async ({
  page,
  viewport,
}) => {
  await page.goto('whiteboard');
  const mainBox = await page.locator('#main-content').boundingBox();
  expect(mainBox).not.toBeNull();
  expect(mainBox?.width).toBeLessThanOrEqual(viewport?.width ?? Infinity);
  await expect(
    page.getByRole('button', { name: 'Ouvrir le menu' }),
  ).toBeVisible();
});

test('has no serious or critical axe violations in the shell', async ({
  page,
}) => {
  await page.goto('whiteboard');
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter(({ impact }) =>
    ['serious', 'critical'].includes(impact ?? ''),
  );
  expect(severe).toEqual([]);
});
