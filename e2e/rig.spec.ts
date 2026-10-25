import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const SHOT_DIR = '/tmp/opencode/iphone-duo-notes/ticket-03';

interface PixelFingerprint {
  hash: number;
  unique: number;
  bytes: number;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function waitUntilReady(page: Page): Promise<void> {
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

async function fingerprint(page: Page): Promise<PixelFingerprint> {
  return page.evaluate(async () => {
    const app = window.__duoApp;
    if (!app) throw new Error('DuoApp is not exposed');
    const blob = await app.captureScreenshot();
    if (!blob) throw new Error('no canvas screenshot');
    const bitmap = await createImageBitmap(blob);
    const probe = document.createElement('canvas');
    probe.width = 64;
    probe.height = 64;
    const context = probe.getContext('2d');
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

async function setFold(page: Page, degrees: number): Promise<void> {
  await page.evaluate((value) => window.__duoApp!.setFoldAngle(value), degrees);
  await page.waitForFunction(
    (value) => Math.round(window.__duoApp!.getState().foldAngle) === value,
    degrees,
  );
}

test('the hinge rig changes pixels and the accessible fold value', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1');
  await waitUntilReady(page);
  await mkdir(SHOT_DIR, { recursive: true });

  const slider = page.locator('[data-ref="fold-slider"]');
  const output = page.locator('[data-ref="fold-output"]');

  // The default pose is the sheet's 158° presentation angle.
  await expect(slider).toHaveValue('158');
  await expect(slider).toHaveAttribute('aria-valuetext', /158 degrees, presentation angle/);
  await expect(output).toHaveText('158°');

  await setFold(page, 0);
  await expect(slider).toHaveValue('0');
  await expect(slider).toHaveAttribute('aria-valuetext', /0 degrees, fully closed/);
  await expect(output).toHaveText('0°');
  const closed = await fingerprint(page);
  await page.screenshot({ path: `${SHOT_DIR}/closed.png` });

  await setFold(page, 158);
  await expect(slider).toHaveValue('158');
  await expect(slider).toHaveAttribute('aria-valuetext', /158 degrees, presentation angle/);
  const presentation = await fingerprint(page);
  await page.screenshot({ path: `${SHOT_DIR}/presentation.png` });

  // The visible control drives the same state the facade exposes, and snaps to
  // the nearest detent.
  await slider.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '91';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect
    .poll(() => page.evaluate(() => window.__duoApp!.getState().foldAngle))
    .toBe(90);
  await expect(slider).toHaveAttribute('aria-valuetext', /90 degrees open/);
  const detent = await fingerprint(page);

  await setFold(page, 180);
  await expect(slider).toHaveValue('180');
  await expect(slider).toHaveAttribute('aria-valuetext', /180 degrees, flat and open/);
  const open = await fingerprint(page);
  await page.screenshot({ path: `${SHOT_DIR}/open.png` });

  expect(open.bytes).toBeGreaterThan(10_000);
  expect(open.unique).toBeGreaterThan(12);
  expect(presentation.unique).toBeGreaterThan(12);
  expect(closed.unique).toBeGreaterThan(12);
  expect(open.hash).not.toBe(presentation.hash);
  expect(presentation.hash).not.toBe(closed.hash);
  expect(detent.hash).not.toBe(presentation.hash);
  expect(errors).toEqual([]);
});
