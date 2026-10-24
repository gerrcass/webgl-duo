# Grill session — iPhone Duo WebGL

**Date:** 2026-10-24
**Mode:** autonomous (the user delegated every decision; each recommended answer below was adopted and is binding)
**Facilitator skills:** `grilling`, `domain-modeling`

This is a record of the design tree, not a transcript. Each round lists only the
frontier that was answerable at that point. Adopted answers are marked **ADOPTED**.
Questions that depended on an earlier answer were pushed to a later round.

---

## Round 1 — What are we actually building?

### Q1. Product interpretation
"iPhone Duo" is not a shipped Apple product. Is this a dual-screen slab, a
book-style foldable, or a clamshell?

**ADOPTED:** A book-style inward-folding iPhone. Two rigid halves joined by a
full-height hinge; a continuous inner display opens to roughly tablet width; a
cover display runs the phone when closed. This is the only interpretation that
justifies the name "Duo", gives the hinge a real mechanical story, and produces
a genuinely difficult WebGL problem.

### Q2. Fidelity bar
Stylised "tech demo", or photoreal product visualisation?

**ADOPTED:** Photoreal. The target is a studio product photograph that a viewer
would initially mistake for a press render: physically based metals, glass,
sapphire, ceramic and emissive displays; observed real-world scale; soft studio
reflections; contact shadows; controlled bloom. A cartoon phone is a failure.

### Q3. Physical accuracy
Do we invent a design, or anchor to Apple's current industrial language?

**ADOPTED:** Anchor to the language of the current iPhone Pro generation —
continuous rounded-rectangle slab, flat Ceramic Shield faces, chamfered titanium
rail, rounded-square camera plateau, fine antenna bands, symmetric port/speaker
machining — then extend it coherently to a foldable. Every dimension lives in a
single reference sheet in millimetres. Nothing is eyeballed in code.

### Q4. Scope
A canvas demo, or a shippable launch page?

**ADOPTED:** A complete single-page product launch experience around the
renderer: hero, spec narrative, colourway switcher, camera/lighting presets,
fold control, exploded-view inspection, detail callouts, performance controls,
footer disclaimer. The renderer is the protagonist, not the whole product.

### Q5. Rendering stack
React Three Fiber, Babylon.js, raw WebGL2, or Three.js?

**ADOPTED:** Three.js with TypeScript, Vite, and no UI framework. Rationale:
the scene is an imperative assembly of hundreds of parametric meshes; R3F adds a
reconciler and dependency surface without helping. Raw WebGL2 would spend the
budget on a renderer instead of the product. Three.js gives us `MeshPhysicalMaterial`,
PMREM, post-processing, and a well-understood deployment story.

### Q6. Asset strategy
Import a GLB/Blender model, or generate the device procedurally?

**ADOPTED:** Procedural geometry and procedural textures, generated at runtime
from the reference sheet. No binary model to drift, license, or fail to load; mm
dimensions remain inspectable and tweakable; the whole product is one auditable
codebase. The trade-off — more geometry code — is accepted.

### Q7. Truthfulness
Should the page pretend this is a real Apple product?

**ADOPTED:** No. It is labelled as an independent concept study in the page
footer and README. The name is used as requested, with an explicit
"not affiliated with Apple" disclaimer. No real prices, no fake pre-order links.

### Q8. Definition of done
What makes this "challenging" rather than merely "working"?

**ADOPTED:**
- 60 fps at 1440×900 on a mid-range GPU in "Balanced"; stable 30 fps floor on
  integrated graphics in "Efficient".
- No texture or model downloads: first meaningful frame under 2.5 s on a warm
  cache, total JS under 220 kB gzipped (Three.js core + addons included).
- Device geometry accurate to the reference sheet within ±0.25 mm.
- Fold motion with a real hinge arc and no interpenetration at any angle.
- Screens remain legible at 70° viewing angle, with glass reflections and a
  visible but restrained crease.
- Automated Playwright evidence: desktop hero, mobile hero, folded state,
  exploded state, colourway comparison, plus a non-blank-canvas pixel assertion.
- Deployed to GitHub Pages from `main` with a screenshot in the README.

---

## Round 2 — Industrial design

### Q9. Fold direction and travel
Inward (screen protected) vs outward (screen exposed); 0–180° or a limited arc?

**ADOPTED:** Inward fold, 0° (flat) → 180° (closed). The page exposes the full
range but defaults to 158° open, the angle that reads best in three-quarter
view. Detents at 30°, 90°, 120°, 150° for the UI slider; motion is eased, never
linear.

### Q10. Dimensions
What are the canonical numbers?

**ADOPTED (see `docs/design/reference-design.md` for the full sheet):**

| Property | Open | Closed |
|---|---|---|
| Height | 150.4 mm | 150.4 mm |
| Width | 145.6 mm | 73.0 mm |
| Depth (body) | 5.20 mm | 10.40 mm |
| Depth (incl. plateau) | 7.15 mm | 12.35 mm |
| Mass | 239 g | 239 g |

Inner display 7.62 in, 2176 × 1968, 391 ppi. Cover display 5.84 in,
1440 × 2560, 501 ppi. These are internally consistent and within the envelope
of current book-style foldables.

### Q11. Materials
Which materials must be visibly distinct?

**ADOPTED:**
- **Titanium rail** — brushed, anisotropic, clear-coated; cool mid-grey base.
- **Ceramic Shield 2** — front and inner display cover glass; near-black,
  low roughness, strong grazing reflections, subtle micro-scratch roughness map.
- **Matte back glass** — low-specular, slightly grainy, colour-tinted.
- **Sapphire lens covers** — high IOR, deep black, faint blue-violet coating.
- **Polished hinge spine** — mirror-grade titanium with fine circumferential
  machining marks.
- **Anodised aluminium camera plateau** — satin, faint orange-peel.
- **Silicone/elastomer hinge gasket** — dark, high roughness, low metalness.
Each gets its own roughness/clearcoat/anisotropy configuration; no shared
"metal" material.

### Q12. Colourways
How many, and what are they?

**ADOPTED:** Four: **Frost Titanium** (cool silver), **Noir Titanium**
(graphite), **Dusk Titanium** (deep blue-violet), **Bloom Titanium** (warm
champagne). The default is Dusk. Colourways change rail tint, back-glass tint,
plateau tint and UI accent — not the display content or the black bezel.

### Q13. Camera system
How many lenses, and where?

**ADOPTED:** Triple rear system on the outer (rear) face of the right half:
48 mm Fusion Main, 13 mm Ultra Wide, 77 mm Tetraprism Telephoto, arranged in
the familiar triangular cluster inside a rounded-square plateau. Flash,
LiDAR scanner and microphone sit in the remaining quadrant. Cover display has a
centred pill cutout; inner display uses an under-display camera (no cutout).

### Q14. Hinge
What does it look like, and how does it move?

**ADOPTED:** A full-height, 8.2 mm diameter twin-barrel spine with a polished
centre cap, fine circumferential grooves and a dark elastomer gap. The two
halves pivot about the spine axis; the display is split into two rigid panels
with a 10 mm flexible bridge near the hinge. The bridge bends through the fold,
and a crease normal-map term keeps it from reading as a hard seam. There is no
visible gear train; the mechanism is implied by the caps and the light line.

### Q15. Screen content
Real iOS screenshots, a generic UI, or original content?

**ADOPTED:** Original "Duo OS" content drawn procedurally into a canvas:
- Cover: lock screen with large clock, date, weather glyph, notification stack,
  depth-effect wallpaper.
- Inner: home screen with aurora wallpaper, widget grid, dock, status bar.
No copied Apple assets. The UI is rendered at device pixel ratio, with a
carefully chosen type scale and real optical alignment. It must look designed,
not like placeholder rectangles.

### Q16. Brand marks
Include the Apple logo and "iPhone" wordmark?

**ADOPTED:** Yes, as subtle physical details on the rear glass: a centred
mirror-polished Apple mark and a fine "iPhone" line under it, both rendered as
geometry/alpha masks, not stickers. The page still carries the non-affiliation
disclaimer.

---

## Round 3 — Rendering craft

### Q17. Lighting
One big softbox, or a studio set?

**ADOPTED:** A procedural three-light studio built into a PMREM environment:
large top-left key softbox, narrow right rim strip, low warm fill, plus a
gradient studio sweep with a subtle floor reflection. Key light casts a soft
shadow; the environment supplies 90% of the specular story. No downloaded HDRIs.

### Q18. Camera and composition
Free orbit, or art-directed?

**ADOPTED:** Both. Constrained orbit (polar 35–105°, distance 24–62 cm,
target near the hinge), with three art-directed presets: **Hero** (three-quarter
open), **Profile** (edge-on hinge and thickness), **Detail** (macro on camera
plateau). Cinematic intro dolly on first load, skippable, disabled under
`prefers-reduced-motion`.

### Q19. Post-processing
Which effects earn their cost?

**ADOPTED:** ACES filmic tone mapping, subtle bloom (threshold 0.9, strength
0.22), SMAA or MSAA (quality-dependent), vignette, and film grain at 2.5%
opacity. No SSAO (contact shadows do the grounding), no SSR (environment
reflections plus a floor gradient are enough), no depth of field by default
(expensive and it softens the product); a "Cinematic" preset may enable a light
DOF pass.

### Q20. Shadowing
Shadow maps or analytic contact shadows?

**ADOPTED:** A high-resolution PCF soft shadow map from the key light for the
device onto the sweep, plus an analytic contact-shadow plane (radial gradient,
distance-faded) for the tight occlusion under the hinge and rails. The two are
composited so there is no double-darkening.

### Q21. Exploded view
Worth the complexity?

**ADOPTED:** Yes, but controlled: six layers — cover glass, inner display,
logic/hinge chassis, battery, rear glass, camera module — separate along the
device normal with eased stagger and labelled callouts. It is an inspection
mode, not a permanent state. This is the feature that proves the model is real
geometry rather than a textured box.

### Q22. Performance tiers
How do we protect weak GPUs?

**ADOPTED:** Three tiers — **Cinematic** (DPR ≤ 2, 4× MSAA, DOF, full post),
**Balanced** (default; DPR ≤ 1.5, 2× MSAA, no DOF), **Efficient** (DPR 1, no
post bloom/SMAA, reduced geometry segments, capped 30 fps target). Auto-detect
via `WEBGL_debug_renderer_info` heuristics plus an FPS watchdog that steps down
once, never oscillates. Pause rendering when the tab is hidden or the canvas is
offscreen.

### Q23. Responsiveness
How does the scene adapt?

**ADOPTED:** The camera framing is aspect-aware. On portrait mobile the device
is framed vertically and the UI becomes a bottom sheet; on desktop it is a
two-column composition with the canvas bleeding to the right edge. Touch orbit
is one finger, pinch zoom; mouse drag orbit, wheel zoom. All controls also work
from the keyboard.

### Q24. Failure modes
What happens without WebGL2, with a lost context, or on a slow network?

**ADOPTED:** A designed fallback panel with a static poster image and the spec
copy; `webglcontextlost` is caught and the renderer restores automatically with
a toast; the intro loader has a hard 6 s timeout then shows the fallback. No
blank white screen, ever.

---

## Round 4 — Verification and delivery

### Q25. Test seams
Where do we test?

**ADOPTED:** One high seam: the public `DuoApp` facade plus pure modules for
`referenceDesign`, `foldKinematics`, `colorways`, and `quality`. Unit tests hit
those pure modules. Browser tests drive the real page through Playwright,
including a WebGL2 context check and a non-blank canvas pixel assertion. No
tests reach into private scene-graph internals.

### Q26. Visual evidence
How do we know it looks right?

**ADOPTED:** Playwright captures a fixed set of evidence shots at 1600×1000 and
390×844 with deterministic time (`?test=1` disables intro animation and fixes
the fold angle). Shots are attached to the PR with `gh pr comment --attach` and
committed as `docs/evidence/*.png` for the README. A human reviews the shots
before merge; CI only enforces that the canvas is non-blank and the UI states
change.

### Q27. CI and deployment
What runs where?

**ADOPTED:** GitHub Actions: `ci` on every push/PR (typecheck, unit tests,
build, Playwright smoke with SwiftShader); `deploy` on `main` publishes `dist`
to GitHub Pages via the official Pages actions. No secrets in the renderer. The
Pages URL is recorded in README and in the repository About section.

### Q28. Repository hygiene
What does the final state look like?

**ADOPTED:** One integration branch, one PR closing the spec and every ticket,
green CI, evidence attached, squash-merged to `main`, branch and worktrees
deleted, all issue and PR state resolved. README explains the concept, controls,
accuracy strategy, how to run/test, and embeds the hero screenshot.

### Q29. Biggest risks
What could sink this?

**ADOPTED RISK LIST:**
1. **Geometry complexity vs. frame budget** — mitigate with merged BufferGeometry
   per material, instancing for speaker holes/screws, and segment LODs.
2. **Glass that looks like plastic** — mitigate with environment importance,
   clearcoat, grazing-angle falloff, and a separate reflection pass rather than
   opacity tricks.
3. **Screens that look like glowing stickers** — mitigate with canvas-rendered
   content, emissive intensity mapping, glass overlay, and off-axis dimming.
4. **Fold interpenetration** — mitigate with a kinematic rig whose clearances
   are solved from the reference sheet and asserted in unit tests.
5. **Subagent drift** — mitigate with the reference sheet, ADRs, and acceptance
   shots as the shared source of truth.
6. **GH Pages/WebGL CI** — mitigate with SwiftShader flags and a poster fallback.

---

## Contradictions surfaced and resolved

- *"Photoreal" vs. "runs everywhere"*: resolved by quality tiers and a static
  fallback, not by lowering the ceiling.
- *"Accurate to a real product" vs. "the product is fictional"*: resolved by
  defining accuracy as dimensional/material consistency with a locked reference
  sheet and Apple's design language, not resemblance to a shipped device.
- *"Fast first paint" vs. "one scene, no downloads"*: resolved by procedural
  generation and code-split post-processing; no HDR/model downloads.
- *"Exploded view" vs. "single continuous device"*: resolved by making exploded
  state an explicit mode that restores exactly, with the hinge rig as the parent
  transform for both halves.

## Shared-understanding statement

The frontier is empty. The product, its dimensions, materials, motion,
rendering pipeline, performance envelope, tests, evidence, and delivery path are
all pinned. Implementation may begin.
