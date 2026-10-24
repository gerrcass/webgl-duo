# Procedural geometry and textures, no external 3D or image assets

Every part of the device and the studio is generated at runtime from
`docs/design/reference-design.md`. We do not ship a GLB, an HDRI, screen
screenshots or texture bitmaps. This keeps dimensions inspectable, makes
colourways and quality tiers parametric, removes asset licensing, and keeps the
app a single auditable codebase. The cost is substantially more geometry and
texture code; that cost is accepted because the project's differentiator is
physical accuracy and the ability to change a millimetre in one place.

**Status:** accepted
