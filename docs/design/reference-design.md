# iPhone Duo — Reference Design Sheet

This sheet is the single source of truth for the 3D model. All renderer units are
metres; every number below is millimetres. Any geometry code that disagrees with
this sheet is a bug. The device is fictional; the design language is a concept
study, not an Apple product.

## 1. Identity

| Field | Value |
|---|---|
| Product | iPhone Duo (concept) |
| Category | Book-style inward-folding smartphone |
| Generation | 2026 concept |
| Tagline | Two screens. One device. |
| Default colourway | Dusk Titanium |

## 2. Envelope

| Property | Open | Closed |
|---|---:|---:|
| Height | 150.40 | 150.40 |
| Width | 136.60 | 72.00 |
| Depth (body) | 5.20 | 10.40 |
| Depth (incl. plateau) | 7.15 | 12.35 |
| Mass | 239 g | 239 g |

- Fold axis: vertical, centred; hinge spine diameter 7.40 mm.
- Half body width: 64.60 mm.
- Outer corner radius (plan): 11.60 mm on the free edge of each half.
- Plan-view corner radius at the hinge ends: 8.00 mm.
- Rail chamfer: 0.35 mm at 45°, then a 0.55 mm round-over.
- Closed gap between halves: 0.28 mm.
- Display-to-body edge: 2.00 mm side, 1.90 mm top/bottom (inner).

## 3. Displays

### 3.1 Inner (main) display
| Field | Value |
|---|---|
| Diagonal | 7.78 in (marketed 7.8") |
| Active area | 132.60 × 146.60 mm |
| Resolution | 1968 × 2176 |
| Density | 377 ppi |
| Refresh | 1–120 Hz LTPO |
| Peak brightness | 2,000 nits (HDR) |
| Cover glass | Ceramic Shield 2, 0.55 mm |
| Camera | 24 MP under-display, top centre |
| Crease | 10.0 mm flexible bridge, 1.8 mm bend radius |

### 3.2 Cover display
| Field | Value |
|---|---|
| Diagonal | 5.90 in |
| Active area | 62.80 × 136.10 mm |
| Resolution | 1179 × 2556 |
| Density | 477 ppi |
| Refresh | 1–120 Hz LTPO |
| Cutout | 24.0 × 7.5 mm pill (width × height), 4.2 mm from visible active top |
| Cover glass | Ceramic Shield 2, 0.55 mm |
| Visible active area | 62.80 × 79.00 mm (see §11.5) |

### 3.3 Screen content
- **Cover:** Duo OS lock screen — 09:41, "Saturday, 24 October", weather
  (18° / clear), two stacked notifications, aurora depth wallpaper. Warm-white
  text, no logos.
- **Inner:** Duo OS home — aurora wallpaper, 6-widget grid (weather, calendar,
  music, photos, battery, notes), four-icon dock, status bar with Wi-Fi, cellular,
  battery. Balanced with real optical margins.
- Both canvases render at 2× their logical size; type is optically aligned to the
  display, not scaled arbitrarily.

## 4. Frame and surfaces

- **Rail:** grade-5 titanium, brushed along the long axis, clear coat 0.12,
  anisotropy 0.65, base roughness 0.34, envMapIntensity 0.62: a brushed
  Dusk Titanium edge with one controlled anisotropic highlight, never a white
  chrome outline. Colour tint per colourway.
- **Front/inner glass:** near-black, roughness 0.045, clearcoat 1.0, IOR 1.52,
  faint micro-scratch roughness map (0.015 amplitude).
- **Rear glass:** matte, roughness 0.42, clearcoat 0.25, subtle 0.06 mm orange-peel
  normal; tinted per colourway.
- **Camera plateau:** 7000-series aluminium, satin, roughness 0.32, chamfer
  0.45 mm, raised 1.95 mm above rear glass, 57.0 × 57.0 mm, 16.0 mm corner radius.
- **Hinge spine:** polished titanium, roughness 0.10, clearcoat 1.0, 60 fine
  circumferential grooves (0.06 mm deep) over the centre 44 mm; end caps polished
  with a 0.2 mm step.
- **Hinge gasket:** dark elastomer, roughness 0.85, metalness 0.
- **Antenna bands:** 0.45 mm wide, 5 per half, colour matched to rail but 0.08
  rougher.
- **Apple mark:** 12.0 mm tall, mirror-polished, centred on the rear of the right
  half, 22 mm above the bottom edge.
- **Wordmark:** "iPhone" 1.6 mm cap height, 0.08 mm engraved, 5.5 mm below the mark.

### 4.1 Material construction constants

These values make the §4 material families reproducible. They are renderer
constants, not new product dimensions; the millimetre values are physical.

| Constant | Value | Used by |
|---|---:|---|
| Rail metalness / environment gain | 1.0 / 1.35 | titanium rail |
| Rail anisotropy rotation | 90° (brushing along Y) | titanium rail |
| Brushed roughness contrast | 0.16 | brushed-metal map |
| Front glass clearcoat roughness | 0.03 | Ceramic Shield |
| Micro-scratch tile scale | 9.0 mm | glass roughness map |
| Rear glass clearcoat roughness | 0.35 | matte rear |
| Orange-peel bump wavelength | 1.2 mm | rear normal map |
| Fingerprint roughness strength | 0.18 | rear smudge map |
| Plateau metalness / clearcoat | 0.95 / 0.05 | 7000-series aluminium |
| Sapphire IOR / roughness | 1.77 / 0.06 | lens covers |
| Gasket colour / roughness | `#050507` / 0.85 | hinge elastomer |
| Display emissive placeholder | 0.8 | inner display |

Procedural map texel sizes: brushed 512, micro-scratch 256, orange-peel 512,
fingerprint 256. Brushed metal repeats 3×, micro-scratch 2×, fingerprint 2×3.
No map is downloaded; all are generated from canvas/data buffers at runtime.


## 5. Camera system

Triple cluster in the plateau, triangular layout, optical axes normal to the rear.

| Element | Position (from plateau centre) | Diameter |
|---|---|---:|
| Main 48 mm Fusion | (−13.0, +12.0) | 16.8 mm |
| Ultra Wide 13 mm | (−13.0, −5.0) | 14.8 mm |
| Telephoto 77 mm | (+2.0, +3.0) | 14.8 mm |
| Flash | (+16.0, +16.0) | 6.0 mm |
| LiDAR | (+16.0, −1.0) | 6.6 mm |
| Microphone | (+16.0, −12.0) | 1.6 mm |

- Lens stack: sapphire cover (0.45 mm), black bezel ring, 6-element barrel,
  coated front element with a blue-violet interference tint, inner iris.
- Each lens is recessed 0.35 mm below the plateau surface.
- Flash is a dual-tone LED: warm inner disc, cool outer ring.
- LiDAR is a dark ruby window with a fine concentric texture.

## 6. Edges, ports and controls

| Feature | Location | Size |
|---|---|---|
| USB-C | bottom centre of right half | 8.30 × 2.60 mm, 1.20 mm deep |
| Speaker holes | 6 per side of USB-C | Ø 1.10 mm, 2.00 mm pitch |
| Microphones | 2 bottom, 1 top | Ø 0.80 mm |
| Power / Touch ID | right rail, upper | 16.0 × 2.60 mm |
| Volume up/down | right rail, below power | 10.5 × 2.20 mm each |
| Action button | left rail, upper | 6.50 × 2.20 mm |
| Camera Control | left rail, lower | 11.0 × 2.40 mm, flush sapphire |
| SIM tray | none (eSIM only) | — |

- Button protrusion: 0.55 mm, polished chamfer, matte top.
- Port interior: black, with a visible tongue and 24 gold contacts.
- Speaker holes are true holes (dark cavity), not decals.

## 7. Hinge mechanics

- Two pivot barrels, 7.40 mm outer diameter, 148.0 mm long.
- Rotation: 0° fully closed to 180° fully open; UI detents at 30/60/90/120/150.
  Fold angle is degrees of openness, so the 158° presentation pose is 22° from
  closed and still shows the inner display alongside the rear design.
- The display bridge follows a circular arc of radius 1.8 mm; its length is held
  constant (10.0 mm) through the fold so no stretching is visible.
- Half-to-half clearance at the free edges: 0.28 mm closed.
- A 0.20 mm dark seam line runs the full height between the two barrels.
- The hinge cap carries five concentric lathe rings; no branding.

## 8. Colourways

| Name | Rail tint (linear) | Rear glass | Plateau | UI accent |
|---|---|---|---|---|
| Frost Titanium | `#c9c6c0` | `#e7e4dd` | `#bdb9b2` | `#7aa7ff` |
| Noir Titanium | `#3b3b3e` | `#1d1d1f` | `#343437` | `#9a9aa2` |
| Dusk Titanium | `#5a5f6e` | `#2c3140` | `#4d5363` | `#8b7dff` |
| Bloom Titanium | `#c8a794` | `#e8d3c6` | `#b99986` | `#ff9f7a` |

The display content, black bezel and lens glass do not change with colourway.

## 9. Studio set

- Floor: 4.0 m gradient sweep, near-black at the horizon, 8% grey at camera.
- Backdrop: seamless, cool neutral; a soft vertical falloff behind the device.
- Lights: key softbox 1.2 × 0.8 m at 45° camera-left, 3.2 m; rim strip
  0.25 × 2.4 m camera-right; warm fill 0.8 × 0.8 m low front-left.
- Camera: 85 mm equivalent, f/8 look, framed from 0.72 m from device centre so
  the full 150.40 mm envelope sits inside the 16.1° vertical field with studio
  margin; target at hinge mid-height; orbit limits 0.28–0.72 m.
- Exposure: key-driven; no clipped rail highlights, display whites at 0.92.

## 10. Accuracy rules

1. No dimension may be introduced in code without being added to this sheet.
2. Every part is built in metres from these millimetres.
3. Left/right halves are mirror-symmetric except for the camera plateau, cover
   display, port, and button placement.
4. The inner display is one continuous active area split across two panels; the
   bridge is geometry, not a texture.
5. No external models, HDRIs or bitmap UI assets. Everything is generated.
6. The page must state that this is an independent concept, not an Apple product.

## 11. Derived envelope relations

These identities are the testable contract between the sheet's numbers:

- Open width = 2 × half body width + hinge spine diameter
  (2 × 64.60 + 7.40 = 136.60 mm).
- Closed width = half body width + hinge spine diameter
  (64.60 + 7.40 = 72.00 mm). The free edge is 68.30 mm from the fold axis and
  the spine extends 3.70 mm beyond it on the other side.
- Closed body depth = 2 × body depth (2 × 5.20 = 10.40 mm); add the 1.95 mm
  plateau raise for the 12.35 mm case.
- Inner display = open envelope minus the 2.00 mm side and 1.90 mm top/bottom
  display edges (132.60 × 146.60 mm).

The hinge barrel diameter is fixed at 7.40 mm by §7; the open and registered
display dimensions are fixed by §3.1. The half width is therefore derived, not
independently invented.

### 11.1 Closed register and the 0.28 mm clearance

The three sheet numbers 5.20 mm body depth, 0.28 mm closed gap and 10.40 mm
closed depth do not sum as 5.20 + 0.28 + 5.20 = 10.68 mm. The 10.40 mm envelope
is the **rail-to-rail register**, so the 0.28 mm cannot be an air gap added
between two full-depth bodies. The honest relation is:

| Quantity | Value | Meaning |
|---|---:|---|
| Rail half depth | 5.20 | rail land to rear face |
| Display recess | 0.14 | display surface behind its rail land |
| Closed register | 2 × 5.20 = 10.40 | rail lands in contact |
| Display clearance | 2 × 0.14 = 0.28 | facing display surfaces at the free edge |

The free-edge rails are the mechanical stop. Each display is recessed 0.14 mm
below its rail lip, so the two displays meet the sheet's 0.28 mm clearance while
the outer envelope stays exactly 10.40 mm. The 12.35 mm plateau case is
10.40 + 1.95, measured from the rear rail face; the rear glass is flush with
that face. A closed stack of 10.68 mm is therefore not this design.

### 11.2 Hinge spine

A 7.40 mm full cylinder cannot fit inside a 5.20 mm half body without protruding
in front of the inner display. The spine is therefore **two half-barrel shells**
(one per half) that share the fold axis and occupy the rear of the barrel only:

- Each shell is a 7.40 mm outer-diameter, 0.60 mm-wall, 148.0 mm-long arc with
  annular end caps. The 0.20 mm seam is the gap between the two shells at the
  rearmost point.
- The front of the barrel is the **display channel** (a 24° opening at each side
  of the fold), so the open device keeps its 5.20 mm body depth and 7.15 mm
  plateau depth.
- When the halves close, the two shells rotate around the shared axis and the
  assembled barrel sits inside the 10.40 mm closed envelope; the closed
  silhouette outside the barrel is the two rail stacks and the spine edge.

### 11.3 Display bridge

The inner display is split at the fold into two rigid panels with inner edges
5.00 mm from the fold axis; the 10.0 mm bridge spans between them. The bridge
centreline is a constant-developed-length C1 cubic strip tangent to both panels.
The solver holds exactly 10.00 mm at every angle (asserted at 0°, 90°, 158° and
180°). Its solved minimum radius of curvature, by openness, is:

| Fold (openness) | 30° | 60° | 90° | 120° | 158° | 180° |
|---|---:|---:|---:|---:|---:|---:|
| Minimum radius (mm) | 0.08 | 0.28 | 0.67 | 1.50 | 8.05 | flat (∞) |

The 1.8 mm figure in §7 is the nominal crease radius; the fixed 10.0 mm length
crosses it at roughly 123° open (57° from closed) and becomes a broad arc at the
158° presentation pose. At 0° the strip is a constant-length hairpin between two
panels 0.28 mm apart, not a stretched 1.8 mm arc. The mechanical constraint that
is preserved is the developed length; ticket 05 turns the hairpin into the soft
optical crease with the crease shader. A future waterdrop hinge that dives at the
panel edge (rather than staying tangent) is the route to a 1.8 mm radius at full
closure; it would need a new sheet dimension for the dive angle.

### 11.4 Construction dimensions added by the hinge ticket

| Dimension | Value | Where |
|---|---:|---|
| Display recess | 0.14 | §2, §11.1 |
| Front glass inset from outer outline | 1.20 | §2 |
| Barrel shell wall | 0.60 | §7 |
| Barrel display-channel opening | 24° total | §7 |
| Plateau top inset | 8.00 | §5 |

The bridge anchor at 5.00 mm is derived from the 10.0 mm bridge, not a new
number. The plateau centre is derived from the half width and the top inset.

### 11.5 Cover display and plateau

The 136.10 mm active panel and the 57.00 mm camera plateau cannot both be fully
visible on the 150.40 mm rear face. The plateau occupies 85.40–142.40 mm above
the bottom rail, so the cover panel is exposed only below it. The panel is
still the sheet's 62.80 × 136.10 mm part; its top 55.70 mm is **behind the
plateau and never lit**, not overlaid with artwork. The lock screen is composed
for the exposed pane, which is what the user sees when the device is closed.

| Quantity | Value | Meaning |
|---|---:|---|
| Full active panel | 62.80 × 136.10 | §3.2, bottom 5.00 mm above the rail |
| Plateau footprint | 57.00 × 57.00 | 8.00 mm top inset; bottom at 85.40 |
| Guard band | 1.40 | black bezel between the lit pane and the plateau |
| Visible active area | 62.80 × 79.00 | the only lit cover pixels |
| Hidden active area | 55.70 | behind the plateau; no mesh, no artwork |
| Bottom inset | 5.00 | optical margin above the bottom rail |

The cutout is read as **24.0 mm wide × 7.5 mm tall** (not 24 mm tall): the
sheet's "7.5 × 24.0" is height × width, the only orientation consistent with a
top-centre camera bar. It sits 4.20 mm below the visible active top. Solving
the layout this way keeps a real active panel, a real 0.55 mm cover glass and a
real plateau; nothing overlaps a lit display with the camera island.

## 12. Revision log

- 2026-10-24 — Reconciled §2 with the display and hinge sections: half body
  width 64.30 → 64.60 mm and closed width 71.60 → 72.00 mm. With the old values,
  open width was 136.00 mm and could not contain the 132.60 mm active area plus
  the specified 2.00 mm display edges. Added §11 derived relations and the
  revision log. §9 camera framing distance changed from 0.42 m to 0.72 m: an
  85 mm equivalent lens at 0.42 m sees 119 mm vertically and cannot frame the
  150.40 mm envelope. At 0.72 m the envelope fills 74% of the frame height,
  leaving the studio margin used by the hero composition.
- 2026-10-25 — Hinge ticket. Resolved the 5.20 + 0.28 + 5.20 ≠ 10.40 conflict
  with the §11.1 effective stack: the rail lands register at 10.40 mm and a
  0.14 mm display recess per half yields the 0.28 mm free-edge display
  clearance. Replaced the "full barrel" reading of §7 with the two rear
  half-barrel shells and a display channel, because a 7.40 mm cylinder cannot
  fit inside a 5.20 mm body. Added the bridge solver's honest radius table
  (§11.3): the 10.0 mm developed length is preserved, the nominal 1.8 mm radius
  is not achievable at full closure. Added the construction dimensions in
  §11.4. The hero default is the sheet's 158° presentation angle and the page
  now exposes a 0–180° fold control with detents at 30/60/90/120/150.
- 2026-10-25 — Display ticket. Added §11.5: the cover panel is exposed only
  below the 57 mm plateau (62.80 × 79.00 mm visible, 55.70 mm hidden behind the
  island). Resolved the 7.5 × 24.0 mm cutout as width × height so the pill is a
  24.0 × 7.5 mm top-centre bar, not a 24 mm tall slot. The inner artwork is one
  1968 × 2176 canvas; the bridge maps its own 10 mm arc-length slice, so the
  composition stays continuous at every fold angle.
- 2026-10-25 — Fold-angle convention corrected to degrees of **openness**:
  0° closed, 180° open. The sheet's "158° presentation angle" and user story 8
  require a hero that shows both the inner display and the rear design, which a
  158° closure pose cannot do. §7, the bridge table in §11.3 and the page copy
  now use openness; the mechanical clearances are unchanged at the endpoints.

- 2026-10-25 — Art-direction pass after the hero review. The rail moved to a
  satin Dusk Titanium response (roughness 0.68, envMapIntensity 0.16, tint gain
  0.58) and the studio softboxes were dimmed to stop the chrome-like white
  outline; the PMREM and grade now use one output pass and 0.006 Balanced grain.
  Rail, glass and plate outlines are tessellated at 40 segments. A residual
  dashed specular seam at the rail/glass silhouette under SwiftShader remains a
  known follow-up (it is not a geometry crack or a z-fighting artifact). The
  390 px hero fills more of the stage, but the device still overlaps the
  headline; the mobile composition needs another art-direction pass.
