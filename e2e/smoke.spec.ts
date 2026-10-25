import { expect, test, type Page } from '@playwright/test';

interface RuntimeState {
  status: string;
  motion: string;
  fallbackReason: string | null;
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  return errors;
}

async function waitUntilReady(page: Page): Promise<RuntimeState> {
  await page.waitForFunction(
    () => {
      const app = window.__duoApp;
      const status = app?.getState().status;
      return status === 'ready' || status === 'fallback';
    },
    null,
    { timeout: 90_000 },
  );

  return page.evaluate(() => {
    const state = window.__duoApp!.getState();
    return {
      status: state.status,
      motion: state.motion,
      fallbackReason: state.fallbackReason,
    };
  });
}

test('loads the live studio without console errors', async ({ page }) => {
  const errors = watchErrors(page);

  await page.goto('/?test=1');
  const state = await waitUntilReady(page);

  expect(state.status).toBe('ready');
  expect(state.motion).toBe('off');
  await expect(page.locator('body')).toHaveAttribute('data-app-state', 'ready');
  await expect(page.locator('body')).toHaveAttribute('data-render-state', 'static');

  const canvas = page.locator('#stage canvas');
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBe(1440);
  expect(box!.height).toBe(900);

  const pixels = await page.evaluate(async () => {
    const blob = await window.__duoApp!.captureScreenshot();
    if (!blob) return null;
    const bitmap = await createImageBitmap(blob);
    const probe = document.createElement('canvas');
    probe.width = 48;
    probe.height = 48;
    const context = probe.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, 48, 48);
    const data = context.getImageData(0, 0, 48, 48).data;
    let min = 255;
    let max = 0;
    for (let index = 0; index < data.length; index += 4) {
      const luminance =
        (data[index]! + data[index + 1]! + data[index + 2]!) / 3;
      min = Math.min(min, luminance);
      max = Math.max(max, luminance);
    }
    return { min, max, bytes: blob.size };
  });

  expect(pixels).not.toBeNull();
  expect(pixels!.bytes).toBeGreaterThan(10_000);
  expect(pixels!.max - pixels!.min).toBeGreaterThan(8);

  await expect(page.locator('h1')).toContainText('Two screens.');
  await expect(page.locator('[data-ref="specs"] .spec-row')).toHaveCount(10);
  await expect(page.locator('[data-ref="disclaimer"]')).toContainText(
    'not affiliated with',
  );
  expect(errors).toEqual([]);
});

test('reframes at 360, 768, 1440 and ultrawide without clipping', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1');
  await waitUntilReady(page);

  const viewports = [
    { width: 360, height: 800 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
    { width: 2560, height: 1080 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(
      ({ width }) => {
        const canvas = document.querySelector('#stage canvas');
        if (!canvas) return false;
        return Math.abs(canvas.getBoundingClientRect().width - width) < 1;
      },
      { width: viewport.width },
    );

    const layout = await page.evaluate(() => {
      const canvas = document.querySelector('#stage canvas');
      const stage = document.querySelector('#stage');
      const title = document.querySelector('h1');
      const sheet = document.querySelector('.console');
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        canvas: canvas?.getBoundingClientRect().toJSON() ?? null,
        // The stage is inset above the mobile control sheet, so the canvas
        // fills the stage box rather than the raw viewport.
        stageHeight: stage?.getBoundingClientRect().height ?? 0,
        sheetTop: sheet?.getBoundingClientRect().top ?? window.innerHeight,
        sheetFixed: sheet ? getComputedStyle(sheet).position === 'fixed' : false,
        title: title?.getBoundingClientRect().toJSON() ?? null,
      };
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth + 1);
    expect(layout.canvas?.width).toBeCloseTo(viewport.width, 0);
    expect(layout.canvas?.height).toBeCloseTo(layout.stageHeight, 0);
    // Nothing is framed behind a control: on the bottom-sheet layout the
    // canvas stops above the sheet.
    if (layout.sheetFixed) {
      expect(layout.canvas!.bottom).toBeLessThanOrEqual(layout.sheetTop + 1);
    }
    expect(layout.title).not.toBeNull();
    expect(layout.title!.left).toBeGreaterThanOrEqual(0);
    expect(layout.title!.right).toBeLessThanOrEqual(viewport.width);
  }

  expect(errors).toEqual([]);
});

test('honours prefers-reduced-motion by freezing the studio', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?debug=1');
  const state = await waitUntilReady(page);

  expect(state.status).toBe('ready');
  expect(state.motion).toBe('off');
  await expect(page.locator('body')).toHaveAttribute('data-motion', 'off');
  await expect(page.locator('body')).toHaveAttribute(
    'data-render-state',
    'static',
  );

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(errors).toEqual([]);
});

test('pauses the render loop while the document is hidden', async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto('/?debug=1');
  const state = await waitUntilReady(page);

  expect(state.status).toBe('ready');
  expect(state.motion).toBe('on');
  await expect(page.locator('body')).toHaveAttribute(
    'data-render-state',
    'running',
  );

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('body')).toHaveAttribute(
    'data-render-state',
    'paused',
  );

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('body')).toHaveAttribute(
    'data-render-state',
    'running',
  );

  expect(errors).toEqual([]);
});

test('shows the designed poster when WebGL2 is forced off', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?test=1&fallback=1');
  const state = await waitUntilReady(page);

  expect(state.status).toBe('fallback');
  expect(state.fallbackReason).toBe('forced');
  await expect(page.locator('body')).toHaveClass(/is-fallback/);
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#stage')).toBeHidden();
  await expect(page.locator('#boot')).toBeHidden();
  await expect(page.locator('[data-ref="fallback-note"]')).toContainText(
    'disabled for this test run',
  );
  await expect(page.locator('[data-ref="specs"] .spec-row')).toHaveCount(10);
  await expect(page.locator('[data-ref="disclaimer"]')).toContainText(
    'not affiliated with',
  );
  expect(errors).toEqual([]);
});
