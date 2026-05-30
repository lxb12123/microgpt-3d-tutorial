import { expect, test } from '@playwright/test';

for (const colorScheme of ['dark', 'light'] as const) {
  test(`01-overview page renders in ${colorScheme} scheme`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.emulateMedia({ colorScheme });
    await page.goto('/microgpt-3d-tutorial/01-overview/');

    await expect(page.getByRole('heading', { name: /01.*overview/i })).toBeVisible();
    // Sandboxes are wrapped in <LazyMount> (Phase 3 perf fix): the three.js
    // chunk only mounts once the wrapper enters viewport. Scroll the bottom of
    // the page into view to trigger it before asserting canvas.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });

    // All three mode buttons render before weights resolve, so they're clickable
    // immediately. Switching modes should not throw.
    await page.getByRole('radio', { name: 'Forward' }).click();
    await page.getByRole('radio', { name: 'Loss' }).click();
    await page.getByRole('radio', { name: 'Sample' }).click();
    await page.waitForTimeout(1_500);

    await page.screenshot({ path: `/tmp/phase2-01-overview-${colorScheme}.png`, fullPage: true });
    expect(errors, `console errors (${colorScheme}):\n${errors.join('\n')}`).toEqual([]);
  });
}
