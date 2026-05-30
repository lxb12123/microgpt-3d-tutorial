import { expect, test } from '@playwright/test';

test('home page renders the microGPT 3D landing copy and lesson links', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('');

  await expect(page.getByRole('heading', { level: 1, name: /microGPT 3D/i })).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: /01 · Overview/i })).toBeVisible();
  await expect(main.getByRole('link', { name: /02 · Autograd/i })).toBeVisible();
  await expect(main.getByRole('link', { name: /03 · Attention/i })).toBeVisible();
  expect(errors, `unexpected console errors: ${errors.join('\n')}`).toEqual([]);
});
