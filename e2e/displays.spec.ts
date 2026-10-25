import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const SHOT_DIR = '/tmp/opencode/iphone-duo-notes/ticket-05';

interface ScreenProbe {
  hash: number;
  unique: number;
  min: number;
  max: number;
  dominantShare: number;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const status = window.__duoApp?.getState().status;
      return status === 'ready' || status === 'fallback';
    },
    null,
    { timeout: 90_000 },
  );
  expect(await page.evaluate(() => window.__duoApp!.getState().status)).toBe('ready');
}

async function setFold(page: Page, degrees: number): Promise<void> {
  await page.evaluate((value) => window.__duoApp!.setFoldAngle(value), degrees);
  await page.waitForFunction(
    (value) => Math.round(window.__duoApp!.getState().foldAngle) === value,
    degrees,
  );
}

/**
 * Sample a normalised crop of the live render. The crop is the screen region of
 * the current composition; a blank or flat display cannot produce thousands of
 * distinct values or a low dominant-colour share.
 */
async function probeScreen(
  page: Page,
  crop: { x: number; y: number; width: number; height: number },
): Promise<ScreenProbe> {
  return page.evaluate(async (region) => {
    const blob = await window.__duoApp!.captureScreenshot();
    if (!blob) throw new Error('no canvas screenshot');
    const bitmap = await createImageBitmap(blob);
    const probe = document.createElement('canvas');
    probe.width = 320;
    probe.height = 320;
    const context = probe.getContext('2d');
    if (!context) throw new Error('2D probe unavailable');
    context.drawImage(
      bitmap,
      region.x * bitmap.width,
      region.y * bitmap.height,
      region.width * bitmap.width,
      region.height * bitmap.height,
      0,
      0,
      320,
      320,
    );
    const data = context.getImageData(0, 0, 320, 320).data;
    let hash = 2166136261;
    let min = 255;
    let max = 0;
    const counts = new Map<number, number>();
    for (let index = 0; index < data.length; index += 4) {
      const value = (data[index]! << 16) | (data[index + 1]! << 8) | data[index + 2]!;
      hash = Math.imul(hash ^ value, 16777619) >>> 0;
      counts.set(value, (counts.get(value) ?? 0) + 1);
      const luminance = (data[index]! + data[index + 1]! + data[index + 2]!) / 3;
      min = Math.min(min, luminance);
      max = Math.max(max, luminance);
    }
    const dominant = Math.max(...counts.values());
    return {
      hash,
      unique: counts.size,
      min,
      max,
      dominantShare: dominant / (320 * 320),
    };
  }, crop);
}

test('the closed cover display is a legible Duo OS lock screen', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1&view=rear');
  await ready(page);
  await mkdir(SHOT_DIR, { recursive: true });

  await setFold(page, 0);
  await expect(page.locator('[data-ref="fold-output"]')).toHaveText('0°');

  const cover = await probeScreen(page, {
    x: 0.52,
    y: 0.43,
    width: 0.19,
    height: 0.46,
  });
  expect(cover.unique).toBeGreaterThan(900);
  expect(cover.max - cover.min).toBeGreaterThan(90);
  expect(cover.dominantShare).toBeLessThan(0.35);

  await page.locator('#stage').screenshot({ path: `${SHOT_DIR}/cover-lock-rear-0.png` });
  expect(errors).toEqual([]);
});

test('the inner home screen is artwork, not a flat display, and survives the fold', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1');
  await ready(page);
  await mkdir(SHOT_DIR, { recursive: true });

  const hashes = new Set<number>();
  for (const angle of [90, 158, 180] as const) {
    await setFold(page, angle);
    const inner = await probeScreen(page, {
      x: 0.53,
      y: 0.14,
      width: 0.4,
      height: 0.76,
    });
    expect(inner.unique, `inner artwork at ${angle}°`).toBeGreaterThan(1200);
    expect(inner.max - inner.min).toBeGreaterThan(80);
    expect(inner.dominantShare).toBeLessThan(0.2);
    hashes.add(inner.hash);

    await page.locator('#stage').screenshot({
      path: `${SHOT_DIR}/inner-home-${angle}.png`,
    });
  }

  // Hashing the same region at three fold angles proves the panel+bridge
  // mapping changes with the rig without tearing into a flat frame.
  expect(hashes.size).toBe(3);
  expect(errors).toEqual([]);
});
