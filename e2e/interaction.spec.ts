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

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
      ),
  );
}

test('orbit, zoom and keyboard drive the camera and reset exactly', async ({
  page,
}) => {
  await page.goto('/?test=1');
  await ready(page);

  const stage = page.locator('#stage');
  await stage.focus();
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + box!.width * 0.62, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.74, box!.y + box!.height * 0.42, {
    steps: 6,
  });
  await page.mouse.up();
  await settle(page);

  const dragged = await page.evaluate(() => window.__duoApp!.getOrbit());
  expect(Math.abs(dragged.azimuth)).toBeGreaterThan(0.02);
  expect(Math.abs(dragged.elevation)).toBeGreaterThan(0.01);

  await page.mouse.wheel(0, -420);
  await settle(page);
  const zoomed = await page.evaluate(() => window.__duoApp!.getOrbit());
  expect(zoomed.zoom).toBeLessThan(1);

  await stage.press('0');
  await settle(page);
  expect(await page.evaluate(() => window.__duoApp!.getOrbit())).toEqual({
    azimuth: 0,
    elevation: 0,
    zoom: 1,
  });

  await stage.press('ArrowLeft');
  await stage.press('+');
  await settle(page);
  const keyboard = await page.evaluate(() => window.__duoApp!.getOrbit());
  expect(keyboard.azimuth).toBeLessThan(0);
  expect(keyboard.zoom).toBeLessThan(1);
});

test('presets change the composition and exploded view restores exactly', async ({
  page,
}) => {
  await page.goto('/?test=1');
  await ready(page);

  const before = await page.evaluate(() => {
    const app = window.__duoApp!;
    app.setFoldAngle(90);
    app.setColourway('bloom');
    app.setPreset('profile');
    return app.getState();
  });
  await settle(page);
  const profile = await page.evaluate(() => window.__duoApp!.getState());
  expect(profile.preset).toBe('profile');

  await page.evaluate(() => window.__duoApp!.setExploded(true));
  await settle(page);
  await expect(page.locator('.explode-label')).toHaveCount(6);
  await expect(page.locator('body')).toHaveClass(/is-exploded/);
  expect(await page.evaluate(() => window.__duoApp!.getState().exploded)).toBe(
    true,
  );

  await page.evaluate(() => window.__duoApp!.setExploded(false));
  await settle(page);
  const restored = await page.evaluate(() => window.__duoApp!.getState());
  expect(restored.foldAngle).toBe(before.foldAngle);
  expect(restored.colourway).toBe(before.colourway);
  expect(restored.preset).toBe(before.preset);
  expect(restored.exploded).toBe(false);
  expect(await page.evaluate(() => window.__duoApp!.getOrbit())).toEqual({
    azimuth: 0,
    elevation: 0,
    zoom: 1,
  });
});
