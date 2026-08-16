import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const destinations = [
  ['Tableau blanc', 'whiteboard', 'Tableau blanc'],
  ['Mon parcours', 'progress', 'Mon parcours'],
  ['Mes Quizz', 'questions', 'Mes Quizz'],
  ['Réglages', 'settings', 'Réglages'],
] as const;

async function login(page: Page, role: 'user' | 'admin' | 'owner' = 'user') {
  await page.goto('login');
  await page.getByLabel('Email').fill(`${role}@example.test`);
  await page.getByLabel('Mot de passe').fill('test-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/whiteboard$/);
}

test('offers an accessible login and understandable failures', async ({
  page,
}) => {
  await page.goto('login');
  await expect(page.getByLabel('Email')).toHaveAttribute(
    'autocomplete',
    'email',
  );
  await expect(page.getByLabel('Mot de passe')).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
  await page.getByLabel('Email').fill('user@example.test');
  await page.getByLabel('Mot de passe').fill('wrong');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Email ou mot de passe incorrect.',
  );
  await expect(page.getByLabel('Mot de passe')).toBeFocused();

  await page.getByLabel('Mot de passe').fill('network-unavailable');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Connexion impossible pour le moment',
  );
});

test('protects a private route and safely returns after login', async ({
  page,
}) => {
  await page.goto('account');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.getByLabel('Email').fill('user@example.test');
  await page.getByLabel('Mot de passe').fill('test-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole('heading', { name: 'Compte' })).toBeVisible();
});

test('navigates through exactly four primary destinations', async ({
  page,
}) => {
  await login(page);
  for (const [label, route, heading] of destinations) {
    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await page.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`/${route}$`));
    if (route === 'whiteboard')
      await expect(
        page.getByRole('article', { name: 'Question active' }),
      ).toBeVisible();
    else
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
});

test('shows the account card, translated role and performs real sign-out', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.getByText('Élève')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Déconnexion' })).toHaveCount(
    0,
  );
  await page.getByRole('link', { name: /Voir le compte/ }).click();
  await expect(page.getByText('user@example.test')).toBeVisible();
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.goto('account');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

for (const [role, label] of [
  ['user', 'Élève'],
  ['admin', 'Administrateur'],
  ['owner', 'Propriétaire'],
] as const) {
  test(`enforces the ${role} administration role`, async ({ page }) => {
    await login(page, role);
    await page.goto('admin');
    if (role === 'user') {
      await expect(
        page.getByRole('heading', { name: 'Accès refusé' }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole('heading', { name: 'Administration' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
      const menu = page.getByRole('dialog', { name: 'Menu' });
      await expect(menu.getByText(label)).toBeVisible();
      await expect(
        menu.getByRole('link', { name: 'Administration' }),
      ).toBeVisible();
    }
  });
}

test('requires online verification for cached administrator permissions', async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'qtsi-controlled-auth-session',
      JSON.stringify({
        email: 'admin@example.test',
        validity: 'offline-unverified',
      }),
    );
  });
  await page.goto('admin');
  await expect(
    page.getByRole('heading', { name: 'Vérification en ligne requise' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Administration' }),
  ).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(2);
});

test('restores the authenticated session after reload', async ({ page }) => {
  await login(page, 'owner');
  await page.reload();
  await expect(
    page.getByRole('article', { name: 'Question active' }),
  ).toBeVisible();
  await page.goto('login');
  await expect(page).toHaveURL(/\/whiteboard$/);
});

test('closes the drawer with Escape and restores focus', async ({ page }) => {
  await login(page);
  const trigger = page.getByRole('button', { name: 'Ouvrir le menu' });
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('offers 44px targets, visible focus and reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  const trigger = page.getByRole('button', { name: 'Ouvrir le menu' });
  const box = await trigger.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await trigger.focus();
  expect(
    Number.parseFloat(
      await trigger.evaluate(
        (element) => getComputedStyle(element).outlineWidth,
      ),
    ),
  ).toBeGreaterThan(0);
  expect(
    Number.parseFloat(
      await trigger.evaluate(
        (element) => getComputedStyle(element).transitionDuration,
      ),
    ),
  ).toBeLessThanOrEqual(0.001);
});

test('reloads a Pages deep route without HashRouter', async ({ page }) => {
  await login(page);
  await page.goto('questions?type=course#details');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mes Quizz' })).toBeVisible();
  await expect(page).toHaveURL(/\/questions\?type=course#details$/);
  expect(new URL(page.url()).hash.startsWith('#/')).toBe(false);
});

test('has no serious or critical axe violations', async ({ page }) => {
  await login(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(({ impact }) =>
      ['serious', 'critical'].includes(impact ?? ''),
    ),
  ).toEqual([]);
});
