# iPhone Duo

A browser-based, photorealistic product launch page for **iPhone Duo**, an
independent concept study of a book-style folding iPhone. The device and studio
are generated procedurally with Three.js in real-world metres: no downloaded
models, HDRIs or interface bitmaps.

## Commands

```sh
npm ci
npm run dev          # Vite dev server
npm run typecheck    # tsc --noEmit
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright smoke + evidence shots
npm run build        # static production build in dist/
npm run preview      # preview the production build
```

## Status

The real two-half shell and hinge rig are in: a machined titanium rail frame,
inset inner and rear glass, a raised camera plateau, a two-barrel spine and a
constant-length inner-display bridge solved from one reference sheet. The hero
opens at the 158° presentation angle; a fold control on the page sweeps the
hinge from flat (0°) to closed (180°) with detents at 30, 60, 90, 120 and 150.
Screen artwork and the final material families land in later tickets.

`?test=1` renders a deterministic, motion-free frame for evidence.
`?fallback=1` exercises the poster shown when WebGL2 is unavailable.

## Fiction

iPhone Duo is an independent concept study. It is not an Apple product and is
not affiliated with, endorsed by, or sponsored by Apple Inc. All screen artwork
is original Duo OS artwork; no Apple assets are used.

<img src="assets/icon.svg" width="64" height="64" alt="" />
