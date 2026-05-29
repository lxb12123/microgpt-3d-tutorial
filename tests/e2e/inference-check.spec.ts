import { expect, test } from '@playwright/test';

test('inference-check page loads weights and shows a probability bar chart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  // Also catch real console errors (filter out the well-known hydration noise that SceneViewer uses useSyncExternalStore for; this page doesn't use SceneViewer so it should be clean)
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/microgpt-3d-tutorial/inference-check/');

  await expect(page.getByRole('heading', { name: /Inference check/i })).toBeVisible();
  // Wait for weights to load and probs to render
  await expect(page.getByText(/Next-character probabilities/i)).toBeVisible({ timeout: 10_000 });

  expect(errors, `page errors:\n${errors.join('\n')}`).toEqual([]);
});
