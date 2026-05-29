import { expect, test } from '@playwright/test';

test('primitives gallery page renders canvas with all primitives', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/microgpt-3d-tutorial/primitives-gallery/');

  await expect(page.getByRole('heading', { name: /Primitives gallery/i })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2_000); // let useGLTF settle

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});
