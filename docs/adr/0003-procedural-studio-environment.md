# A procedural studio environment instead of an imported HDRI

Lighting and reflections come from a PMREM-processed environment built from
emissive softbox geometry and a gradient studio sweep. An HDRI would look
plausible but would add a megabyte-scale binary, make the look non-deterministic
across downloads, and hide the lighting decisions in an opaque file. The
procedural set is tuned once, re-used by every quality tier, and can be captured
for tests. Glass and titanium rely on environment importance sampling, so the
environment is treated as part of the product design, not decoration.

**Status:** accepted
