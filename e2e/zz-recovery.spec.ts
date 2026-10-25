import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const status = window.__duoApp?.getState().status;
      return status === 'ready' || status === 'fallback';
    },
    null,
    { timeout: 120_000 },
  );
  expect(await page.evaluate(() => window.__duoApp!.getState().status)).toBe(
    'ready',
  );
}

test('context loss shows a notice and recovers; capture still produces pixels', async ({
  page,
}) => {
  await page.goto('/?test=1');
  await ready(page);

  await page.evaluate(() => {
    const canvas = document.querySelector('#stage canvas');
    canvas?.dispatchEvent(
      new Event('webglcontextlost', { bubbles: true, cancelable: true }),
    );
  });
  await expect(page.locator('body')).toHaveAttribute('data-context', 'lost');
  await expect(page.locator('#live-status')).toContainText(
    /unavailable|restore|reload/i,
  );

  await page.evaluate(() => {
    document
      .querySelector('#stage')
      ?.dispatchEvent(new Event('webglcontextrestored', { bubbles: true }));
  });
  await expect(page.locator('body')).toHaveAttribute('data-context', 'restored');
  await page.waitForFunction(
    () => window.__duoApp?.getState().status === 'ready',
    null,
    { timeout: 120_000 },
  );
  await expect(page.locator('#stage canvas')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
      ),
  );

  await page.locator('[data-ref="screenshot"]').click();
  await page.waitForFunction(
    () => Number(document.body.dataset.capture ?? '0') > 10_000,
    null,
    { timeout: 60_000 },
  );
  const bytes = await page.evaluate(() =>
    Number(document.body.dataset.capture ?? '0'),
  );
  expect(bytes).toBeGreaterThan(10_000);
});
