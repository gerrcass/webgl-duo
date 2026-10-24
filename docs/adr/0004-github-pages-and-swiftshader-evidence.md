# GitHub Pages plus Playwright/SwiftShader evidence, not a screenshot service

The app is a static Vite build deployed to GitHub Pages from `main` by the
official Pages actions. Browser evidence is produced by Playwright with
Chromium and SwiftShader in CI, using `?test=1` for deterministic framing. This
keeps the delivery path free of servers, secrets and paid services, while still
proving that WebGL2 initialises, the canvas has real pixels, and every UI state
is reachable. We accept that SwiftShader is slow; evidence runs have generous
timeouts and do not gate on frame rate.

**Status:** accepted
