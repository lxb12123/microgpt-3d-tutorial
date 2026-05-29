import { expect, test } from '@playwright/test';

test('sandbox-check page loads the hello cube without console errors', async ({ page }) => {
  const errors: string[] = [];

  await page.goto('/microgpt-3d-tutorial/sandbox-check/');

  await expect(page.getByRole('heading', { name: /Sandbox check/i })).toBeVisible();

  // The R3F canvas mounts asynchronously; wait for an actual <canvas> element to appear.
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 10_000 });

  // Attach error listeners after canvas is visible, so we only catch errors during the settle period
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  // Give R3F + useGLTF a beat to settle.
  await page.waitForTimeout(1_500);

  expect(errors, `unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
});
