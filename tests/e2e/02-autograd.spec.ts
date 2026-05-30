import { expect, test } from '@playwright/test';

for (const colorScheme of ['dark', 'light'] as const) {
  test(`02-autograd page renders in ${colorScheme} scheme`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.emulateMedia({ colorScheme });
    await page.goto('/microgpt-3d-tutorial/02-autograd/');

    await expect(page.getByRole('heading', { name: /02.*autograd/i })).toBeVisible();
    // Sandboxes are wrapped in <LazyMount> (Phase 3 perf fix): the three.js
    // chunk only mounts once the wrapper enters viewport. Scroll the bottom of
    // the page into view to trigger it before asserting canvas.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
    // Wait for the sandbox to compute root value
    await expect(page.getByText(/root\s*=/i)).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(1_500);

    await page.screenshot({ path: `/tmp/phase2-02-autograd-${colorScheme}.png`, fullPage: true });
    expect(errors, `console errors (${colorScheme}):\n${errors.join('\n')}`).toEqual([]);
  });
}
