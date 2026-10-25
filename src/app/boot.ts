import { readLaunchOptions } from '../env';
import { reference } from '../domain/reference';
import { createDuoApp, type DuoAppSnapshot } from './duo-app';
import {
  DISCLAIMER,
  describeFold,
  fallbackNote,
  heroMeta,
  specRows,
  stageCaption,
} from './content';

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
 * Page bootstrap: fills the spec copy from the reference module, mounts the
 * facade and translates facade status into the page's designed states
 * (loading, live, fallback).
 */
export function boot(): void {
  const launch = readLaunchOptions();
  const body = document.body;

  body.classList.toggle('is-test', launch.testMode);

  const stage = requireElement<HTMLElement>('#stage');
  const bootOverlay = requireElement<HTMLElement>('#boot');
  const fallback = requireElement<HTMLElement>('#fallback');
  const fallbackNoteElement = requireElement<HTMLElement>('[data-ref="fallback-note"]');
  const liveStatus = requireElement<HTMLElement>('#live-status');
  const nav = requireElement<HTMLElement>('[data-ref="nav"]');
  const foldSlider = requireElement<HTMLInputElement>('[data-ref="fold-slider"]');
  const foldOutput = requireElement<HTMLOutputElement>('[data-ref="fold-output"]');
  const stageCaptionElement = requireElement<HTMLElement>('[data-ref="stage-caption"]');

  requireElement<HTMLElement>('[data-ref="hero-meta"]').textContent = heroMeta();
  stageCaptionElement.textContent = stageCaption(
    reference.hinge.presentationAngleDegrees,
  );
  requireElement<HTMLElement>('[data-ref="disclaimer"]').textContent = DISCLAIMER;
  renderSpecRows(requireElement<HTMLElement>('[data-ref="specs"]'));

  const app = createDuoApp({
    testMode: launch.testMode,
    reducedMotion: launch.reducedMotion,
    forceFallback: launch.forceFallback,
    quality: launch.quality,
  });

  if (launch.testMode || launch.debugMode) {
    window.__duoApp = app;
  }

  let bootTimer = 0;

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
    body.classList.add('is-fallback');
    body.classList.remove('is-ready');
    body.dataset.fallbackReason = snapshot.fallbackReason ?? 'unknown';
    stage.hidden = true;
    fallback.hidden = false;
    fallbackNoteElement.textContent = fallbackNote(snapshot);
    hideBoot(true);
    liveStatus.textContent =
      'The interactive 3D studio is unavailable. The designed poster and specifications are shown instead.';
  };

  const syncFoldControl = (snapshot: Readonly<DuoAppSnapshot>): void => {
    const degrees = Math.round(snapshot.foldAngle);
    foldSlider.value = String(degrees);
    foldSlider.setAttribute('aria-valuetext', describeFold(degrees));
    foldOutput.textContent = `${degrees}°`;
    stageCaptionElement.textContent = stageCaption(degrees);
  };

  const snapToDetent = (value: number): number => {
    for (const detent of reference.hinge.detentsDegrees) {
      if (Math.abs(value - detent) <= 2) return detent;
    }
    return value;
  };

  foldSlider.addEventListener('input', () => {
    const value = snapToDetent(Number(foldSlider.value));
    app.setFoldAngle(value);
  });

  const update = (snapshot: Readonly<DuoAppSnapshot>): void => {
    syncFoldControl(snapshot);
    if (snapshot.status === 'fallback') {
      showFallback(snapshot);
      return;
    }

    if (snapshot.status === 'ready') {
      body.classList.add('is-ready');
      body.classList.remove('is-fallback');
      body.dataset.fallbackReason = '';
      stage.hidden = false;
      fallback.hidden = true;
      liveStatus.textContent =
        'The live iPhone Duo studio is ready. Use the page sections to read the design and specification.';
      hideBoot(launch.testMode || launch.reducedMotion);
    }
  };

  app.subscribe(update);
  syncFoldControl(app.getState());

  try {
    app.mount(stage);
  } catch {
    // Defensive: the facade already converts expected failures into its
    // fallback state. This catches a page-integration mistake without leaving a
    // blank canvas or an unhandled error.
    showFallback({
      ...app.getState(),
      status: 'fallback',
      fallbackReason: 'mount-failed',
    });
    return;
  }

  update(app.getState());

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
}
