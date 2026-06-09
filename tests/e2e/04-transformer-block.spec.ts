import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  for (const colorScheme of ['dark', 'light'] as const) {
    test(`04-transformer-block renders on ${vp.name} in ${colorScheme} scheme`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', (err) => errors.push(err.message));

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.emulateMedia({ colorScheme });
      await page.goto('/microgpt-3d-tutorial/04-transformer-block/');

      await expect(page.getByRole('heading', { name: /04.*transformer block/i })).toBeVisible();

      // LazyMount: scroll to mount the three.js chunk before asserting canvas.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(1_500);

      // Detail panel (plain DOM; the in-scene labels live inside the canvas):
      // the default stage is the Embedding, showing its exact Python slice and
      // its input shape. Scope to the panel so we don't match the MDX code block.
      const panel = page.getByTestId('block-detail');
      await expect(panel).toBeVisible({ timeout: 10_000 });
      await expect(panel.getByText("state_dict['wte'][token_id]")).toBeVisible();
      await expect(panel.getByText('token_id, pos_id')).toBeVisible();

      // The play/pause scrubber control is present and clickable.
      const playBtn = page.getByRole('button', { name: /play|pause/i }).first();
      await expect(playBtn).toBeVisible();
      await playBtn.click();

      // Review fixes: attention stage is a SUMMARY of lesson 03 (not a live reuse),
      // the Parameter Initialization section exists, and the heading shows "Sandbox"
      // (the "#" is Nextra's hover-only permalink, never part of the title text).
      await expect(page.getByText(/summarizes the same computation explained in lesson 03/i)).toBeVisible();
      await expect(page.getByText('is the lesson-03 computation reused')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /Parameter Initialization/i })).toBeVisible();
      await expect(page.locator('h2#sandbox')).toHaveText('Sandbox');
      // Three-step operation hints are shown above the sandbox.
      await expect(page.getByTestId('step-hints')).toBeVisible();

      await page.screenshot({ path: `/tmp/04-transformer-${vp.name}-${colorScheme}.png`, fullPage: true });
      expect(errors, `console errors (${vp.name}/${colorScheme}):\n${errors.join('\n')}`).toEqual([]);
    });
  }
}
