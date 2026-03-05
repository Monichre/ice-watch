## UpdateDocs Summary

This document summarizes the `/update-docs` run, which treats `package.json` (scripts) and `.env.example` as the single sources of truth for development and operational documentation.

### What was added

- **`UpdateDocs_PSEUDOCODE.md`**
  - Captures the step‑by‑step pseudocode and intent for the documentation update workflow.
- **`docs/CONTRIB.md`**
  - Describes the development workflow for the Next.js + Convex stack.
  - Documents all `package.json` scripts with human‑readable descriptions.
  - Outlines environment setup expectations and testing commands.
- **`docs/RUNBOOK.md`**
  - Provides platform‑agnostic deployment steps using `pnpm build` and `pnpm start`.
  - Defines monitoring expectations, common issues, and rollback strategies.
  - Notes the current state of other markdown docs and how to periodically check for stale documentation.

### Environment variables

- No `.env.example` file was present at the project root when this run executed.
- Both `CONTRIB` and `RUNBOOK`:
  - Explicitly call out the absence of `.env.example`.
  - Recommend adding it as the authoritative list of environment variables and formats.

### Obsolete documentation

- A quick `git log -1` check on key root‑level markdown docs shows they were recently modified as part of the Next.js + Convex migration work.
- As of this run, **no obvious docs older than 90 days** were identified.
- `docs/RUNBOOK.md` includes guidance for periodically re‑running a `git log -1` sweep on `docs/` and top‑level markdown files to maintain this list over time.
