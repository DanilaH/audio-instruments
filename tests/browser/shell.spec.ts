import { expect, test } from '@playwright/test';

for (const path of ['/', '/privacy']) {
  test(`${path} renders without page errors`, async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));

    await page.goto(path);
    await expect(page.locator('body')).toBeVisible();

    expect(errors).toEqual([]);
  });
}

test('homepage exposes no planned tool links', async ({ page }) => {
  await page.goto('/');

  const plannedLinks = page.locator('[data-tool-status="planned"] a');
  await expect(plannedLinks).toHaveCount(0);
});

test('desktop shell has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );

  expect(hasOverflow).toBe(false);
});
