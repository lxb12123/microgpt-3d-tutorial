import { expect, test } from '@playwright/test';

for (const colorScheme of ['dark', 'light'] as const) {
  test(`03-attention page renders in ${colorScheme} scheme`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.emulateMedia({ colorScheme });
    await page.goto('/microgpt-3d-tutorial/03-attention/');

    await expect(page.getByRole('heading', { name: /03.*attention/i })).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });
    // ParamSlider renders the head control as an <input type="range"
    // aria-label="head">. Playwright's `getByLabel` matches the accessibility
    // name; the spec used `getByLabelText` (a Testing Library API) which
    // doesn't exist on Page — corrected to `getByLabel`.
    await expect(page.getByLabel(/head/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2_000);

    // Click a score cell and verify the dot-product breakdown text appears.
    // The (0,0) cell is always available because every test input produces at
    // least one token (BOS + first char), and j ≤ i means [0,0] is valid.
    await page.getByText('score cells', { exact: false }).click();
    await page.getByTestId('score-cell-0-0').click();
    await expect(page.getByTestId('dot-product-breakdown')).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: `/tmp/phase2-03-attention-${colorScheme}.png`, fullPage: true });
    expect(errors, `console errors (${colorScheme}):\n${errors.join('\n')}`).toEqual([]);
  });
}
