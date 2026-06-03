import { expect, test } from '@playwright/test';

for (const colorScheme of ['dark', 'light'] as const) {
  test(`03-attention page renders in ${colorScheme} scheme`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.emulateMedia({ colorScheme });
    await page.goto('/microgpt-3d-tutorial/03-attention/');

    await expect(page.getByRole('heading', { name: /03.*attention/i })).toBeVisible();
    // Sandboxes are wrapped in <LazyMount> (Phase 3 perf fix): the three.js
    // chunk only mounts once the wrapper enters viewport. Scroll the bottom of
    // the page into view to trigger it before asserting canvas.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
    // The head control is an <input type="range" aria-label="head">. Use the
    // exact label so it doesn't also match the "multi-head" toggle.
    await expect(page.getByLabel('head', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2_000);

    // Click an "inspect q·k" key button and verify the dot-product breakdown
    // appears. j=0 is always visible (0 <= the query index for any input).
    await page.getByTestId('inspect-key-0').click();
    await expect(page.getByTestId('dot-product-breakdown')).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: `/tmp/phase2-03-attention-${colorScheme}.png`, fullPage: true });
    expect(errors, `console errors (${colorScheme}):\n${errors.join('\n')}`).toEqual([]);
  });
}
