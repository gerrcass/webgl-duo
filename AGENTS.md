# AGENTS.md

## What this project is

A browser-based, photorealistic 3D product launch page for **iPhone Duo**, a
fictional book-style folding iPhone. Everything is rendered live with Three.js:
no 3D model downloads, no HDRIs, no screen bitmaps. The product is an independent
concept study, not an Apple product.

## Read before you touch anything

- `GLOSSARY.md` — the project's precise vocabulary. Use these words in issues,
  commits and test names.
- `docs/design/reference-design.md` — the dimensional source of truth. Every
  geometry constant comes from this sheet; add new dimensions here first.
- `docs/adr/` — binding technique decisions (Three.js vanilla, procedural
  assets, procedural studio, GitHub Pages evidence, disclaimer).
- `docs/agents/issue-tracker.md` — how work is published and closed.
- `docs/design/grill-session-2026-10-24.md` — why the objective is shaped this
  way. Read it once; it is the design rationale.

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

CI runs typecheck, unit tests, build, then Playwright. A change is done only when
all four pass locally.

## Non-negotiable invariants

1. **Real-world scale.** Scene units are metres. The device is ~0.15 units tall.
   Never scale the model to "look right" in the viewport; move the camera.
2. **One source of truth.** Dimensions live in the domain reference module and
   in the design sheet. No magic numbers in geometry code.
3. **Procedural only.** Generate geometry and textures in code. A new binary
   asset needs an ADR.
4. **The fold is a rig, not an animation trick.** Both halves parent to the hinge;
   the display bridge follows a constant-length arc. Unit tests assert clearance
   at 0°, 90°, 158° and 180°.
5. **Screens are rendered content.** Draw Duo OS into a canvas at device scale;
   do not use flat colour planes or copied assets.
6. **Deterministic evidence.** `?test=1` disables intro motion, locks the fold
   angle and colourway, and fixes the camera preset. Evidence shots must not
   depend on timing.
7. **No blank canvas.** WebGL2 failure, context loss, and slow load all have a
   designed fallback poster.

## Working style

- Work one ticket at a time on its own branch, in its own worktree, based on the
  integration branch. Rebase or merge the integration branch tip before reporting
  done.
- Every ticket starts with a failing test at the highest available seam (domain
  module or `DuoApp` facade), then implementation. Include a browser assertion
  when the ticket changes a visible state.
- Keep the public surface of `DuoApp` small: mount, dispose, setColourway,
  setFoldAngle, setPreset, setExploded, setQuality, getState. Tests and the DOM
  both use it.
- Commit in small logical steps with imperative messages. Do not commit build
  output, `node_modules`, or evidence noise.
- Update `README.md` when the user-visible experience or commands change.

## Delegation model

All implementation and review subagents must use provider instance `opencode`,
model `openrouter/deepseek/deepseek-v4.1-flash-1017`, option
`variant=max`. Do not fall back to another model if a call fails; report the
failure instead. When using the T3 `delegate_task` tool, pass that target
explicitly.
