import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  for (const colorScheme of ['dark', 'light'] as const) {
    test(`05-training renders on ${vp.name} in ${colorScheme} scheme`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', (err) => errors.push(err.message));

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.emulateMedia({ colorScheme });
      await page.goto('/microgpt-3d-tutorial/05-training/');

      await expect(page.getByRole('heading', { name: /05.*training/i })).toBeVisible();

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(1_500);

      // Generate mode (default): the panel explains temperature; the slider exists.
      const genPanel = page.getByTestId('generate-panel');
      await expect(genPanel).toBeVisible({ timeout: 10_000 });
      await expect(genPanel).toContainText('temperature');
      await expect(page.getByRole('slider', { name: /temperature/i })).toBeVisible();

      // Switch to Train mode → the real Adam step panel appears.
      await page.getByRole('radio', { name: 'Train' }).click();
      const trainPanel = page.getByTestId('train-panel');
      await expect(trainPanel).toBeVisible({ timeout: 10_000 });
      await expect(trainPanel).toContainText(/mean cross-entropy/i);
      await expect(trainPanel).toContainText(/lm_head\[\d+\]\[\d+\]/);

      await page.screenshot({ path: `/tmp/05-training-${vp.name}-${colorScheme}.png`, fullPage: true });
      expect(errors, `console errors (${vp.name}/${colorScheme}):\n${errors.join('\n')}`).toEqual([]);
    });
  }
}
