import type { DuoApp } from '../app/duo-app';

declare global {
  interface Window {
    /** Present only under `?test=1` / `?debug=1`; used by Playwright and console work. */
    __duoApp?: DuoApp;
  }
}

export {};
