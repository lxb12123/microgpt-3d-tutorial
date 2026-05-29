import { expect, test } from '@playwright/test';

test('home page renders the bootstrap heading', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('');

  await expect(page.getByRole('heading', { name: /microGPT 3D Tutorial/i })).toBeVisible();
  expect(errors, `unexpected console errors: ${errors.join('\n')}`).toEqual([]);
});
