<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Track work in GitHub Issues for KyleCalvan/gym-web-app-template.
See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels.
See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout: root `GLOSSARY.md` and `docs/adr/`.
See `docs/agents/domain.md`.

## Project Guidelines

### Project Features

Implement backend functionality based on the existing frontend features, pages, and user flows.
Prioritize making existing frontend features functional before introducing additional features.
Do not create new pages or expand the project scope without informing me and obtaining approval.

### Project Reminder

Avoid overengineering, unnecessary abstractions, excessive dependencies, and overly complex architectures.

Prefer simple, maintainable, and straightforward solutions that satisfy the project requirements.

Reuse existing code, patterns, and dependencies whenever appropriate.
