import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EVIDENCE_DIR = path.resolve('docs/evidence');

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const status = window.__duoApp?.getState().status;
      return status === 'ready' || status === 'fallback';
    },
    null,
    { timeout: 120_000 },
  );
  const status = await page.evaluate(() => window.__duoApp!.getState().status);
  expect(status).toBe('ready');
  // One settled frame, no intro motion in ?test=1.
  await page.evaluate(() =>
    new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
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

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, name),
    fullPage: false,
    animations: 'disabled',
  });
}

test.beforeAll(async () => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
});

test.describe('deterministic evidence', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('captures hero, folded and exploded finals', async ({ page }) => {
    await page.goto('/?test=1');
    await ready(page);
    await shot(page, 'hero-desktop.png');

    await page.evaluate(() => window.__duoApp!.setFoldAngle(90));
    await settle(page);
    await shot(page, 'folded.png');

    await page.evaluate(() => {
      window.__duoApp!.setFoldAngle(158);
      window.__duoApp!.setExploded(true);
    });
    await settle(page);
    await expect(page.locator('.explode-label')).toHaveCount(6);
    await expect(page.locator('[data-ref="explode-labels"]')).toBeVisible();
    await shot(page, 'exploded.png');

    await page.evaluate(() => window.__duoApp!.setExploded(false));
    await settle(page);
  });

  test('captures the mobile hero', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?test=1');
    await ready(page);
    await shot(page, 'hero-mobile.png');
  });

  test('captures the detail macro', async ({ page }) => {
    await page.goto('/?test=1');
    await ready(page);
    await page.evaluate(() => window.__duoApp!.setPreset('detail'));
    await settle(page);
    await shot(page, 'detail.png');
  });

  test('captures the four-finish comparison', async ({ page }) => {
    await page.goto('/?test=1');
    await ready(page);

    const dataUrl = await page.evaluate(async () => {
      const app = window.__duoApp!;
      const finishes = ['dusk', 'frost', 'bloom', 'noir'] as const;
      const tiles: ImageBitmap[] = [];
      for (const finish of finishes) {
        app.setColourway(finish);
        const blob = await app.captureScreenshot();
        if (!blob) throw new Error(`no screenshot for ${finish}`);
        tiles.push(await createImageBitmap(blob));
      }
      const tileWidth = Math.round(tiles[0]!.width / 2);
      const tileHeight = Math.round(tiles[0]!.height / 2);
      const canvas = document.createElement('canvas');
      canvas.width = tileWidth * 2;
      canvas.height = tileHeight * 2;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2d context');
      context.fillStyle = '#07080a';
      context.fillRect(0, 0, canvas.width, canvas.height);
      tiles.forEach((tile, index) => {
        context.drawImage(
          tile,
          (index % 2) * tileWidth,
          Math.floor(index / 2) * tileHeight,
          tileWidth,
          tileHeight,
        );
      });
      return canvas.toDataURL('image/png');
    });

    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    await writeFile(
      path.join(EVIDENCE_DIR, 'colourways.png'),
      Buffer.from(base64, 'base64'),
    );
  });
});

test.describe('art-direction rail crop', () => {
  test('writes a 2x rail crop for inspection', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto('/?test=1');
    await ready(page);
    await mkdir('/tmp/opencode', { recursive: true });
    await page.screenshot({
      path: '/tmp/opencode/rail-crop.png',
      clip: { x: 860, y: 150, width: 420, height: 620 },
      animations: 'disabled',
    });
    await context.close();
  });
});
