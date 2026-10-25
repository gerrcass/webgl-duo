# Glossary

The language of the iPhone Duo concept viewer. Keep this file free of
implementation detail; it defines what words mean, not how they are built.

## Product

**iPhone Duo** — The fictional book-style folding iPhone rendered by this
project. Always written with a capital D. It is a concept, not an Apple product.

**Duo OS** — The fictional operating system shown on the Duo's displays. Its
content is original artwork generated for this project; it is not iOS.

**Half** — One of the two rigid bodies joined by the hinge. The *left half* and
*right half* are named from the viewer's perspective when the device is open and
facing the inner display. The right half carries the rear camera plateau and the
cover display.

**Free edge** — The outer long edge of a half, opposite the hinge.

**Hinge spine** — The full-height cylindrical assembly at the fold axis. It is
the only part shared by both halves.

**Inner display** — The large folding display on the inside faces. One active
area, two rigid panels and a flexible bridge.

**Cover display** — The display on the outside of the right half, used when the
device is closed.

**Fold angle** — Degrees of openness measured from closed: 0° is fully closed,
180° is flat and open. The viewer opens at the *presentation angle* of 158°, so
the hero remains 22° from closed and shows both displays and the rear design.

**Presentation angle** — The default fold angle used for the hero composition.
Chosen for silhouette, not for any mechanical reason.

**Crease** — The visible transition in the inner display over the flexible
bridge. It must read as a soft optical seam, never a hard fold line.

## Design

**Colourway** — A named combination of rail tint, rear-glass tint, plateau tint
and UI accent. The four colourways are Frost, Noir, Dusk and Bloom Titanium.

**Plateau** — The raised rounded-square island on the rear of the right half that
houses the camera system.

**Camera cluster** — The triangular arrangement of three lenses inside the
plateau, plus flash, LiDAR and microphone.

**Antenna band** — A thin, slightly rougher line crossing a rail where the metal
is interrupted for radio transparency.

**Detent** — A fold angle at which the UI slider rests: 30°, 60°, 90°, 120°, 150°.

## Experience

**Studio** — The virtual product-photography set: gradient sweep, three lights,
reflective floor. Not the UI "studio mode".

**Hero** — The default three-quarter composition of the open device at the
presentation angle.

**Preset** — A named camera and lighting composition: Hero, Profile, Detail.

**Exploded view** — An inspection mode that separates the device into six
labelled layers along its normal. Restores exactly when exited.

**Quality tier** — One of three rendering budgets: Cinematic, Balanced,
Efficient.

**Evidence shot** — A deterministic Playwright screenshot used to prove a visual
state in a PR or the README. Query parameter `?test=1` disables motion.

**Fallback poster** — The static image and spec copy shown when WebGL2 is
unavailable or the context is lost.
