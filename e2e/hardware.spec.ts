import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const SHOT_DIR = '/tmp/opencode/iphone-duo-notes/ticket-06';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
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

test('detail view frames the camera plateau and rail within the Balanced budget', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1&view=detail');
  await ready(page);
  await mkdir(SHOT_DIR, { recursive: true });

  const probe = await page.evaluate(async () => {
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
    const unique = new Set<number>();
    for (let index = 0; index < data.length; index += 4) {
      unique.add((data[index]! << 16) | (data[index + 1]! << 8) | data[index + 2]!);
    }
    return {
      unique: unique.size,
      bytes: blob.size,
      performance: window.__duoApp!.getPerformance(),
    };
  });

  console.log(
    `[ticket-06] detail view: draw calls=${probe.performance.drawCalls} ` +
      `triangles=${probe.performance.triangles} geometries=${probe.performance.geometries} ` +
      `textures=${probe.performance.textures} programs=${probe.performance.programs}`,
  );

  expect(probe.bytes).toBeGreaterThan(10_000);
  expect(probe.unique).toBeGreaterThan(24);
  expect(probe.performance.drawCalls).toBeGreaterThan(20);
  expect(probe.performance.drawCalls).toBeLessThanOrEqual(180);
  expect(probe.performance.triangles).toBeLessThanOrEqual(350_000);

  const canvasData = await page.evaluate(
    () => document.querySelector('canvas')?.toDataURL('image/png') ?? '',
  );
  if (canvasData) {
    await mkdir(SHOT_DIR, { recursive: true });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(
      `${SHOT_DIR}/detail-canvas.png`,
      Buffer.from(canvasData.split(',')[1] ?? '', 'base64'),
    );
  }
  await page.screenshot({ path: `${SHOT_DIR}/detail-plateau.png` });
  await page.locator('#stage').screenshot({ path: `${SHOT_DIR}/detail-stage.png` });
  expect(errors).toEqual([]);
});
