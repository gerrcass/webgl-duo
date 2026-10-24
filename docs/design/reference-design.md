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
| Width | 136.60 | 71.60 |
| Depth (body) | 5.20 | 10.40 |
| Depth (incl. plateau) | 7.15 | 12.35 |
| Mass | 239 g | 239 g |

- Fold axis: vertical, centred; hinge spine diameter 7.40 mm.
- Half body width: 64.30 mm.
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
| Cutout | 7.5 × 24.0 mm pill, 4.2 mm from active top |
| Cover glass | Ceramic Shield 2, 0.55 mm |

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
  anisotropy 0.65, base roughness 0.28. Colour tint per colourway.
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
- Rotation: 0° open to 180° closed; UI detents at 30/60/90/120/150.
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
- Camera: 85 mm equivalent, f/8 look, at 0.42 m from device centre; target at
  hinge mid-height; orbit limits 0.28–0.72 m.
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
