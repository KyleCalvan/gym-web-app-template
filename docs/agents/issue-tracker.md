# Issue tracker: GitHub

Issues and specs live in GitHub Issues for
KyleCalvan/gym-web-app-template. Use the `gh` CLI from this clone.

## Conventions

- Create: `gh issue create --title "..." --body-file <file>`.
- Read: `gh issue view <number> --json number,title,body,labels,comments`.
- List: `gh issue list --state open`, with appropriate label filters.
- Comment: `gh issue comment <number> --body-file <file>`.
- Edit body: `gh issue edit <number> --body-file <file>`.
- Label: `gh issue edit <number> --add-label "..."`.
- Remove label: `gh issue edit <number> --remove-label "..."`.
- Close: `gh issue close <number> --comment "..."`.

Use temporary UTF-8 files for multiline bodies.

When a skill says "publish to the issue tracker", create a GitHub
issue. When it says "fetch the relevant ticket", read that issue.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`, containing Notes,
  Decisions-so-far, and Fog.
- Child ticket: link it as a sub-issue of the map. If unavailable,
  add it to the map's task list and put `Part of #<map>` in its body.
- Ticket labels: `wayfinder:research`, `wayfinder:prototype`,
  `wayfinder:grilling`, or `wayfinder:task`.
- Blocking: use GitHub native issue dependencies. If unavailable,
  record `Blocked by: #<number>` at the top of the child body.
- Frontier: choose the first open, unassigned child in map order
  whose blockers are all closed.
- Claim: `gh issue edit <number> --add-assignee @me`.
- Resolve: comment with the answer, close the child, and add a
  summary and link to the map's Decisions-so-far.
