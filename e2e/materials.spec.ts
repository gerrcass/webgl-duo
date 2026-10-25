import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { reference } from '../src/domain/reference';

const SHOT_DIR = '/tmp/opencode/iphone-duo-notes/ticket-04';

interface Probe {
  hash: number;
  unique: number;
  bytes: number;
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

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(async () => {
    const blob = await window.__duoApp!.captureScreenshot();
    if (!blob) throw new Error('no canvas screenshot');
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D probe unavailable');
    context.drawImage(bitmap, 0, 0, 64, 64);
    const data = context.getImageData(0, 0, 64, 64).data;
    let hash = 2166136261;
    const unique = new Set<number>();
    for (let index = 0; index < data.length; index += 4) {
      const value = (data[index]! << 16) | (data[index + 1]! << 8) | data[index + 2]!;
      hash = Math.imul(hash ^ value, 16777619) >>> 0;
      unique.add(value);
    }
    return { hash, unique: unique.size, bytes: blob.size };
  });
}

test('every colourway recolours the device and UI accent without a rebuild', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1');
  await ready(page);
  await mkdir(SHOT_DIR, { recursive: true });

  await expect(page.locator('body')).toHaveAttribute('data-colourway', 'dusk');
  await page.screenshot({ path: `${SHOT_DIR}/hero-1440.png` });

  const hashes = new Set<number>();
  for (const colourway of reference.colourways) {
    await page.evaluate((id) => window.__duoApp!.setColourway(id), colourway.id);
    await expect(page.locator('body')).toHaveAttribute(
      'data-colourway',
      colourway.id,
    );

    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--accent')
        .trim(),
    );
    expect(accent).toBe(colourway.accent);

    const sample = await probe(page);
    expect(sample.bytes).toBeGreaterThan(10_000);
    expect(sample.unique).toBeGreaterThan(12);
    hashes.add(sample.hash);

    await page.locator('#stage').screenshot({
      path: `${SHOT_DIR}/colourway-${colourway.id}.png`,
    });
  }

  expect(hashes.size).toBe(reference.colourways.length);
  expect(errors).toEqual([]);
});

test('quality tiers switch post effects cleanly and keep the scene alive', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1');
  await ready(page);
  await mkdir(SHOT_DIR, { recursive: true });

  await expect(page.locator('body')).toHaveAttribute('data-quality', 'balanced');
  const baseline = await probe(page);

  for (const tier of ['cinematic', 'efficient', 'balanced'] as const) {
    await page.evaluate((value) => window.__duoApp!.setQuality(value), tier);
    await expect(page.locator('body')).toHaveAttribute('data-quality', tier);
    await page.waitForTimeout(50);

    const sample = await probe(page);
    expect(sample.bytes).toBeGreaterThan(10_000);
    expect(sample.unique).toBeGreaterThan(10);
    await page.locator('#stage').screenshot({
      path: `${SHOT_DIR}/quality-${tier}.png`,
    });

    if (tier === 'balanced') {
      // Returning to the default tier must restore a live, similar frame, not a
      // black or corrupted canvas.
      expect(sample.unique).toBeGreaterThanOrEqual(baseline.unique - 8);
    }
  }

  expect(errors).toEqual([]);
});

test('the rear detail view renders the plateau and glass families', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1&view=rear');
  await ready(page);
  await mkdir(SHOT_DIR, { recursive: true });

  const sample = await probe(page);
  expect(sample.bytes).toBeGreaterThan(10_000);
  expect(sample.unique).toBeGreaterThan(12);
  await page.locator('#stage').screenshot({
    path: `${SHOT_DIR}/rear-detail.png`,
  });
  expect(errors).toEqual([]);
});
