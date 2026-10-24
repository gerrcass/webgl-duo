# Domain Docs

How the engineering skills should consume this repo's domain documentation when
exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root
- **`docs/adr/`** — read ADRs that touch the area you are about to work in
- **`docs/design/reference-design.md`** — the dimensional source of truth for the
  device; required reading before touching geometry, materials, or screens

If any of these files don't exist, proceed silently.

## File structure

Single-context repo:

```
/
├── GLOSSARY.md
├── docs/
│   ├── adr/
│   └── design/
│       └── reference-design.md
└── src/
```

## Use the glossary's vocabulary

When naming a domain concept (in an issue title, a refactor proposal, a test
name), use the term as defined in `GLOSSARY.md`. In particular: **half**,
**hinge spine**, **cover display**, **inner display**, **fold angle**,
**colourway**, **plateau**, **exploded view**, and **quality tier** are precise.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than
silently overriding it. The reference design sheet is authoritative for
dimensions; the ADRs are authoritative for technique.
