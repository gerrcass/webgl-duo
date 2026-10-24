# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues at
`github.com/gerrcass/webgl-duo`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <path>`.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`.
- **Comment**: `gh issue comment <number> --body "..."`.
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <number> --comment "..."`.
- **Blocking**: set a `Blocked by` section in the child body using issue numbers.
  The skills also read GitHub's native dependencies when present, but the text
  edge in the body is the canonical record for this repo.

## Pull requests as a triage surface

**PRs as a request surface: no.** Feature work starts from issues. PRs are
reviewed and merged by the maintainer; they are not a request queue.

## When a skill says "publish to the issue tracker"

Create a GitHub issue. Specs get the `ready-for-agent` label. Tickets get
`ready-for-agent` and a `Blocked by` section, and are linked to the spec with
`Part of #<spec>`.

## Working an issue

- A ticket is ready when every issue in its `Blocked by` section is closed.
- Claim it by assigning yourself (`gh issue edit <n> --add-assignee @me`).
- Close it from the merged PR with `Fixes #<n>` (or a closing comment including
  the PR link), then verify it is closed.
