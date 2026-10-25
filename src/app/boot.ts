import { readLaunchOptions } from '../env';
import {
  reference,
  resolveColourway,
  type ColourwayId,
} from '../domain/reference';
import { QUALITY_IDS, QUALITY_TIERS } from '../domain/quality';
import { createDuoApp, type DuoApp, type DuoAppSnapshot } from './duo-app';
import { PRESET_IDS, type PresetId } from '../domain/store';
import {
  EXPLODE_LAYER_IDS,
  type ExplodeLayerId,
} from '../domain/kinematics';
import {
  DISCLAIMER,
  describeFold,
  fallbackNote,
  heroMeta,
  specRows,
  stageCaption,
} from './content';

/** The loading budget before the designed fallback takes over. */
const BOOT_TIMEOUT_MS = 6000;

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing page element: ${selector}`);
  return element;
}

function renderSpecRows(target: HTMLElement): void {
  const rows = specRows().map((row) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'spec-row';

    const term = document.createElement('dt');
    term.textContent = row.label;

    const value = document.createElement('dd');
    value.textContent = row.value;

    wrapper.append(term, value);
    return wrapper;
  });

  target.replaceChildren(...rows);
}

/**
 * Page bootstrap. It fills every piece of copy from the reference module, owns
 * the studio controls and translates facade state into the page's designed
 * states: loading, live, slow, fallback and recovered.
 */
export function boot(): void {
  const launch = readLaunchOptions();
  const body = document.body;

  body.classList.toggle('is-test', launch.testMode);

  const stage = requireElement<HTMLElement>('#stage');
  const bootOverlay = requireElement<HTMLElement>('#boot');
  const fallback = requireElement<HTMLElement>('#fallback');
  const fallbackNoteElement = requireElement<HTMLElement>('[data-ref="fallback-note"]');
  const fallbackSpecs = requireElement<HTMLElement>('[data-ref="fallback-specs"]');
  const liveStatus = requireElement<HTMLElement>('#live-status');
  const toast = requireElement<HTMLElement>('#toast');
  const toastText = requireElement<HTMLElement>('[data-ref="toast-text"]');
  const nav = requireElement<HTMLElement>('[data-ref="nav"]');
  const foldSlider = requireElement<HTMLInputElement>('[data-ref="fold-slider"]');
  const foldOutput = requireElement<HTMLOutputElement>('[data-ref="fold-output"]');
  const stageCaptionElement = requireElement<HTMLElement>('[data-ref="stage-caption"]');
  const swatchRow = requireElement<HTMLElement>('[data-ref="swatch-row"]');
  const qualitySelect = requireElement<HTMLSelectElement>('[data-ref="quality"]');
  const qualityHint = requireElement<HTMLElement>('[data-ref="quality-hint"]');
  const screenshotButton = requireElement<HTMLButtonElement>('[data-ref="screenshot"]');
  const presetRow = requireElement<HTMLElement>('[data-ref="preset-row"]');
  const explodedButton = requireElement<HTMLButtonElement>('[data-ref="exploded"]');
  const explodeLabels = requireElement<HTMLElement>('[data-ref="explode-labels"]');

  requireElement<HTMLElement>('[data-ref="hero-meta"]').textContent = heroMeta();
  stageCaptionElement.textContent = stageCaption(
    reference.hinge.presentationAngleDegrees,
  );
  requireElement<HTMLElement>('[data-ref="disclaimer"]').textContent = DISCLAIMER;
  renderSpecRows(requireElement<HTMLElement>('[data-ref="specs"]'));
  renderSpecRows(fallbackSpecs);

  /* ---------------------------------------------------------------------- */
  /* Controls                                                               */
  /* ---------------------------------------------------------------------- */

  const swatches = reference.colourways.map((colourway) => {
    const label = document.createElement('label');
    label.className = 'swatch';
    label.dataset.colourway = colourway.id;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'colourway';
    input.value = colourway.id;
    input.className = 'swatch__input';
    input.dataset.ref = 'colourway';
    input.setAttribute('aria-label', `${colourway.name} finish`);

    const chip = document.createElement('span');
    chip.className = 'swatch__chip';
    chip.style.setProperty('--swatch', colourway.railTint);
    chip.style.setProperty('--swatch-accent', colourway.accent);
    chip.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'swatch__name';
    name.textContent = colourway.name.replace(' Titanium', '');

    label.append(input, chip, name);
    return { label, input, id: colourway.id as ColourwayId };
  });
  swatchRow.append(...swatches.map((swatch) => swatch.label));

  qualitySelect.append(
    ...QUALITY_IDS.map((id) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = QUALITY_TIERS[id].label;
      return option;
    }),
  );

  const PRESET_COPY: Record<PresetId, string> = {
    hero: 'Hero',
    profile: 'Profile',
    detail: 'Detail',
  };
  const presetButtons = new Map<PresetId, HTMLButtonElement>();
  presetRow.append(
    ...PRESET_IDS.map((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'preset';
      button.dataset.preset = preset;
      button.textContent = PRESET_COPY[preset];
      button.setAttribute('aria-pressed', String(preset === 'hero'));
      presetButtons.set(preset, button);
      return button;
    }),
  );

  const LABEL_COPY: Record<ExplodeLayerId, { name: string; detail: string }> = {
    'cover-glass': { name: 'Cover glass', detail: 'Ceramic Shield 2 · 0.55 mm' },
    'inner-display': { name: 'Inner display', detail: '7.78 in · 10 mm bridge' },
    'chassis-hinge': { name: 'Chassis & hinge', detail: 'Titanium · 148 mm spine' },
    battery: { name: 'Battery', detail: 'Dual-cell · concept pack' },
    'rear-glass': { name: 'Rear glass', detail: 'Matte · orange-peel' },
    'camera-module': { name: 'Camera module', detail: '48/13/77 mm · 57 mm plateau' },
  };
  const labelNodes = new Map<ExplodeLayerId, HTMLElement>();
  explodeLabels.append(
    ...EXPLODE_LAYER_IDS.map((id) => {
      const item = document.createElement('div');
      item.className = 'explode-label';
      item.dataset.layer = id;
      const name = document.createElement('span');
      name.className = 'explode-label__name';
      name.textContent = LABEL_COPY[id].name;
      const detail = document.createElement('span');
      detail.className = 'explode-label__detail';
      detail.textContent = LABEL_COPY[id].detail;
      item.append(name, detail);
      labelNodes.set(id, item);
      return item;
    }),
  );

  let app: DuoApp | null = null;
  let unsubscribe: (() => void) | null = null;
  let bootTimer = 0;
  let slowTimer = 0;
  let lastAnnouncedColour: ColourwayId | null = null;

  const announce = (message: string): void => {
    liveStatus.textContent = message;
  };

  const showToast = (message: string): void => {
    toastText.textContent = message;
    toast.hidden = false;
  };

  const hideToast = (): void => {
    toast.hidden = true;
  };

  const applyAccent = (colourway: ColourwayId): void => {
    const palette = resolveColourway(colourway);
    const value = palette.accent.replace('#', '');
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    const root = document.documentElement;
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--accent-soft', `rgba(${red}, ${green}, ${blue}, 0.16)`);
    root.style.setProperty('--accent-glow', `rgba(${red}, ${green}, ${blue}, 0.35)`);
    body.dataset.colourway = palette.id;
  };

  const hideBoot = (immediately: boolean): void => {
    window.clearTimeout(bootTimer);
    if (immediately) {
      bootOverlay.hidden = true;
      return;
    }
    bootTimer = window.setTimeout(() => {
      if (body.classList.contains('is-ready')) bootOverlay.hidden = true;
    }, 900);
  };

  const showFallback = (snapshot: Readonly<DuoAppSnapshot>): void => {
    window.clearTimeout(slowTimer);
    body.classList.add('is-fallback');
    body.classList.remove('is-ready');
    body.dataset.fallbackReason = snapshot.fallbackReason ?? 'unknown';
    stage.hidden = true;
    fallback.hidden = false;
    fallbackNoteElement.textContent = fallbackNote(snapshot);
    hideBoot(true);
    announce(
      'The interactive 3D studio is unavailable. The designed poster and full specification are shown instead.',
    );
    if (snapshot.fallbackReason === 'context-lost') {
      showToast(
        'The GPU context was interrupted. Restoring the studio — the poster and specification stay available.',
      );
    } else if (snapshot.fallbackReason === 'timeout') {
      showToast(
        'The studio is taking longer than expected. The designed poster is shown while it finishes.',
      );
    }
  };

  const syncFoldControl = (snapshot: Readonly<DuoAppSnapshot>): void => {
    const degrees = Math.round(snapshot.foldAngle);
    foldSlider.value = String(degrees);
    foldSlider.setAttribute('aria-valuetext', describeFold(degrees));
    foldOutput.textContent = `${degrees}°`;
    stageCaptionElement.textContent = stageCaption(degrees, snapshot.exploded);
    body.classList.toggle('is-exploded', snapshot.exploded);
  };

  const syncColourControl = (snapshot: Readonly<DuoAppSnapshot>): void => {
    for (const swatch of swatches) {
      swatch.input.checked = swatch.id === snapshot.colourway;
    }
  };

  const syncQualityControl = (snapshot: Readonly<DuoAppSnapshot>): void => {
    qualitySelect.value = snapshot.quality;
    qualityHint.textContent = QUALITY_TIERS[snapshot.quality].description;
  };

  let labelFrame = 0;

  const positionExplodeLabels = (): void => {
    if (!app) return;
    const anchors = app.getLayerAnchors();
    const stageBox = stage.getBoundingClientRect();
    const columns: Array<Array<{ id: ExplodeLayerId; y: number }>> = [[], []];
    for (const [index, id] of EXPLODE_LAYER_IDS.entries()) {
      const anchor = anchors.find((candidate) => candidate.id === id);
      if (!anchor) continue;
      columns[index < 3 ? 0 : 1]!.push({ id, y: anchor.y });
    }
    for (const column of columns) {
      column.sort((a, b) => a.y - b.y);
      let previous = Number.NEGATIVE_INFINITY;
      for (const item of column) {
        const node = labelNodes.get(item.id);
        if (!node) continue;
        let top = stageBox.top + 18 + item.y * (stageBox.height - 36);
        top = Math.max(top, previous + 44);
        top = Math.min(top, stageBox.bottom - 18);
        previous = top;
        const onLeft = columns[0] === column;
        node.style.left = `${stageBox.left + 12}px`;
        node.style.top = `${top}px`;
        node.style.setProperty('--leader', onLeft ? 'right' : 'left');
      }
    }
    // Pin the columns to the stage's outer margins, not to the layer's x, so
    // callouts never sit on top of the device.
    for (const [index, id] of EXPLODE_LAYER_IDS.entries()) {
      const node = labelNodes.get(id);
      if (!node) continue;
      const width = node.offsetWidth || 150;
      node.style.left =
        index < 3
          ? `${stageBox.left + 16}px`
          : `${stageBox.right - 16 - width}px`;
    }
  };

  const stopLabelLoop = (): void => {
    if (labelFrame) cancelAnimationFrame(labelFrame);
    labelFrame = 0;
  };

  const startLabelLoop = (): void => {
    if (labelFrame) return;
    const step = (): void => {
      positionExplodeLabels();
      labelFrame = requestAnimationFrame(step);
    };
    step();
  };

  const syncPresetControl = (snapshot: Readonly<DuoAppSnapshot>): void => {
    for (const [preset, button] of presetButtons) {
      button.setAttribute('aria-pressed', String(preset === snapshot.preset));
    }
  };

  const syncExplodedControl = (snapshot: Readonly<DuoAppSnapshot>): void => {
    explodedButton.setAttribute('aria-pressed', String(snapshot.exploded));
    explodeLabels.hidden = !snapshot.exploded;
    if (snapshot.exploded) {
      startLabelLoop();
    } else {
      stopLabelLoop();
    }
  };

  const snapToDetent = (value: number): number => {
    for (const detent of reference.hinge.detentsDegrees) {
      if (Math.abs(value - detent) <= 2) return detent;
    }
    return value;
  };

  const armSlowTimer = (): void => {
    window.clearTimeout(slowTimer);
    slowTimer = window.setTimeout(() => {
      if (!app || app.getState().status !== 'idle') return;
      body.dataset.slow = 'true';
      showFallback({ ...app.getState(), status: 'fallback', fallbackReason: 'timeout' });
    }, BOOT_TIMEOUT_MS);
  };

  const update = (snapshot: Readonly<DuoAppSnapshot>): void => {
    syncFoldControl(snapshot);
    syncColourControl(snapshot);
    syncQualityControl(snapshot);
    syncPresetControl(snapshot);
    syncExplodedControl(snapshot);
    applyAccent(snapshot.colourway);

    if (snapshot.status === 'fallback') {
      showFallback(snapshot);
      return;
    }

    if (snapshot.status === 'ready') {
      window.clearTimeout(slowTimer);
      const recovered = body.classList.contains('is-fallback');
      body.classList.add('is-ready');
      body.classList.remove('is-fallback');
      delete body.dataset.slow;
      body.dataset.fallbackReason = '';
      stage.hidden = false;
      fallback.hidden = true;
      hideToast();
      if (lastAnnouncedColour === null) {
        announce(
          'The live iPhone Duo studio is ready. Use the studio controls, or the page sections, to read the design and specification.',
        );
      } else if (recovered) {
        announce('The studio is live again.');
      }
      lastAnnouncedColour = snapshot.colourway;
      hideBoot(launch.testMode || launch.reducedMotion);
    }
  };

  const startStudio = (): void => {
    unsubscribe?.();
    unsubscribe = null;
    app?.dispose();
    app = null;
    stage.replaceChildren();

    app = createDuoApp({
      testMode: launch.testMode,
      reducedMotion: launch.reducedMotion,
      forceFallback: launch.forceFallback,
      quality: launch.quality,
      rearView: launch.view === 'rear',
      detailView: launch.view === 'detail',
    });

    if (launch.testMode || launch.debugMode) {
      window.__duoApp = app;
    }

    unsubscribe = app.subscribe(update);
    update(app.getState());

    try {
      app.mount(stage);
    } catch {
      // Defensive: the facade already converts expected failures into its
      // fallback state. This catches a page-integration mistake without leaving
      // a blank canvas or an unhandled error.
      showFallback({
        ...app.getState(),
        status: 'fallback',
        fallbackReason: 'mount-failed',
      });
      return;
    }

    update(app.getState());
    armSlowTimer();
  };

  /* ---------------------------------------------------------------------- */
  /* Wiring                                                                 */
  /* ---------------------------------------------------------------------- */

  foldSlider.addEventListener('input', () => {
    app?.setFoldAngle(snapToDetent(Number(foldSlider.value)));
  });

  foldSlider.addEventListener('change', () => {
    const degrees = Math.round(app?.getState().foldAngle ?? Number(foldSlider.value));
    announce(`Hinge at ${describeFold(degrees)}.`);
  });

  for (const swatch of swatches) {
    swatch.input.addEventListener('change', () => {
      app?.setColourway(swatch.id);
      const name = resolveColourway(swatch.id).name;
      announce(`${name} finish selected. The device and interface accent updated.`);
    });
  }

  for (const [preset, button] of presetButtons) {
    button.addEventListener('click', () => {
      app?.setPreset(preset);
      announce(`${PRESET_COPY[preset]} camera preset selected.`);
    });
  }

  explodedButton.addEventListener('click', () => {
    const next = !(app?.getState().exploded ?? false);
    app?.setExploded(next);
    announce(
      next
        ? 'Exploded view: six layers separated. Fold, finish and camera will be restored on exit.'
        : 'Exploded view closed. The previous fold, finish and camera pose are restored.',
    );
  });

  qualitySelect.addEventListener('change', () => {
    app?.setQuality(qualitySelect.value as (typeof QUALITY_IDS)[number]);
    announce(
      `${QUALITY_TIERS[qualitySelect.value as (typeof QUALITY_IDS)[number]].label} quality selected.`,
    );
  });

  screenshotButton.addEventListener('click', async () => {
    if (!app || screenshotButton.getAttribute('aria-busy') === 'true') return;
    screenshotButton.setAttribute('aria-busy', 'true');
    try {
      const blob = await app.captureScreenshot();
      if (!blob) {
        announce('The still could not be captured. The studio is not rendering.');
        return;
      }
      if (launch.testMode || launch.debugMode) {
        window.__duoLastScreenshot = blob;
        body.dataset.capture = String(blob.size);
      }
      const degrees = Math.round(app.getState().foldAngle);
      const filename = `iphone-duo-${app.getState().colourway}-${degrees}deg.png`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      announce(`Still captured and saved as ${filename}.`);
    } finally {
      screenshotButton.removeAttribute('aria-busy');
    }
  });

  // Synthetic and real context loss both land here. The facade already turns a
  // lost context into its fallback state, so this only owns the notice and the
  // recovery remount.
  stage.addEventListener(
    'webglcontextlost',
    () => {
      body.dataset.context = 'lost';
    },
    true,
  );

  stage.addEventListener(
    'webglcontextrestored',
    () => {
      body.dataset.context = 'restored';
      startStudio();
    },
    true,
  );

  // Pointer, wheel and keyboard orbit/zoom. The stage is the camera surface;
  // controls live in the console, so dragging the device never steals a slider.
  const pointers = new Map<number, { x: number; y: number }>();
  let lastDrag: { x: number; y: number } | null = null;
  let pinchDistance = 0;
  const pointerSpan = (): number => {
    const values = [...pointers.values()];
    if (values.length < 2) return 0;
    return Math.hypot(
      values[0]!.x - values[1]!.x,
      values[0]!.y - values[1]!.y,
    );
  };

  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stage.focus({ preventScroll: true });
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      lastDrag = { x: event.clientX, y: event.clientY };
    } else {
      lastDrag = null;
      pinchDistance = pointerSpan();
    }
    stage.setPointerCapture?.(event.pointerId);
  });

  stage.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const next = pointerSpan();
      if (pinchDistance > 0 && next > 0) app?.zoomBy(pinchDistance / next);
      pinchDistance = next;
      return;
    }
    if (!lastDrag) return;
    app?.orbitBy(
      (event.clientX - lastDrag.x) * 0.006,
      -(event.clientY - lastDrag.y) * 0.004,
    );
    lastDrag = { x: event.clientX, y: event.clientY };
  });

  const endPointer = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    pinchDistance = 0;
    if (pointers.size === 1) {
      const [only] = [...pointers.values()];
      lastDrag = only ? { ...only } : null;
    } else {
      lastDrag = null;
    }
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  stage.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      app?.zoomBy(Math.exp(event.deltaY * 0.0012));
    },
    { passive: false },
  );

  stage.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.16 : 0.07;
    switch (event.key) {
      case 'ArrowLeft':
        app?.orbitBy(-step, 0);
        break;
      case 'ArrowRight':
        app?.orbitBy(step, 0);
        break;
      case 'ArrowUp':
        app?.orbitBy(0, step * 0.7);
        break;
      case 'ArrowDown':
        app?.orbitBy(0, -step * 0.7);
        break;
      case '+':
      case '=':
        app?.zoomBy(0.9);
        break;
      case '-':
      case '_':
        app?.zoomBy(1.1);
        break;
      case '0':
        app?.resetOrbit();
        break;
      default:
        return;
    }
    event.preventDefault();
    announce('Camera orbit updated.');
  });

  let scrollScheduled = false;
  const updateNav = (): void => {
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
    scrollScheduled = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (scrollScheduled) return;
      scrollScheduled = true;
      window.requestAnimationFrame(updateNav);
    },
    { passive: true },
  );
  updateNav();

  startStudio();
}

declare global {
  interface Window {
    __duoLastScreenshot?: Blob;
  }
}
