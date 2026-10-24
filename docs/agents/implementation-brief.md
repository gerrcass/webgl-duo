# Implementation Brief — iPhone Duo

This file is the contract for the execution session. Read it with the spec and
tickets before starting.

## Sources of truth

- Spec: GitHub issue **#1** (`Spec: iPhone Duo — photoreal interactive WebGL product experience`)
- Tickets: issues **#2–#9**, in dependency order. Each has a `Blocked by` section.
- Design contract: `docs/design/reference-design.md`
- Vocabulary: `GLOSSARY.md`
- Technique decisions: `docs/adr/0001`–`0005`
- Rationale: `docs/design/grill-session-2026-10-24.md`

## Execution model

- The session starts in a worktree whose branch (`feat/iphone-duo`) is the
  **integration branch**. Do not create another integration branch and do not
  touch `main`.
- Follow the `implement-spec` workflow (`~/.config/opencode/skills/implement-spec/SKILL.md`).
  Read the spec and tickets, then work the **frontier**: any ticket whose
  blockers are all closed/merged.
- Each implementer subagent works in its own git worktree on its own branch,
  based on the integration branch tip. It must confirm the base before starting,
  merge the integration tip before reporting done, and commit its work.
- Merge each completed implementer branch into the integration branch with a
  merger subagent. Resolve conflicts in favour of the reference sheet and the
  latest interface contract. Run typecheck, unit tests and build after every
  merge. Do not merge a red branch.
- After all tickets, run the `code-review` skill on the integration branch,
  fix every finding in one implementer subagent, then re-run all checks.
- Clean up all implementer worktrees and branches when done.

## Model pin (hard requirement)

Every subagent — implementer, merger, reviewer, explorer — must run on:

- provider instance: `opencode`
- model: `openrouter/deepseek/deepseek-v4.1-flash-1017`
- option: `variant=max`

Use the T3 `delegate_task` tool with that target explicitly. Do not fall back to
another model, provider, or variant. If a delegation fails, report the failure;
do not silently continue on a different model.

## Quality bar

- TDD per ticket at the highest seam: domain module or `DuoApp` facade.
- The final result must look like a premium product launch page, not a
  scaffold. Iterate on the render with real screenshots before declaring done.
- Never regress: run `npm run typecheck`, `npm run test`, `npm run build` and
  `npm run test:e2e` before the PR is marked ready.
- Use only procedural geometry and CanvasTexture artwork. No GLB, HDRI, PNG
  screen assets, or downloaded fonts.
- The fictional-product disclaimer must remain visible in the page footer and
  README.

## PR contract

- Open one PR from `feat/iphone-duo` to `main` once the first ticket is merged.
  Start it as a draft, mark it ready only after the review pass and green checks.
- PR body uses the `pr` skill format and includes: problem, solution, what
  changed, evidence, test plan, risks, and `Fixes #1` plus `Fixes #2` … `Fixes #9`.
- Attach the evidence shots with `gh pr comment <n> --body "..." --attach <path>`
  (or `gh pr create --body-file ... --attach ...`), and commit the same shots
  under `docs/evidence/`.
- Link the PR with the T3 `link_pull_request` tool if it is available.
- Do **not** merge to `main`. Report the PR URL, head SHA, check state, and
  evidence paths. The delivery session merges after review.

## Delivery notes for this branch

- Configure GitHub Pages deployment in `.github/workflows`; it will only run on
  `main`, so do not expect a live URL from the branch.
- The README must embed a real screenshot produced from this build, not a
  mockup.
- Clean up: no leftover worktrees, no build output committed, no open tickets
  after the PR merges (the PR closes them), no draft state left behind.
