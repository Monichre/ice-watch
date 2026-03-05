## Goal

Keep documentation in sync with the current Next.js + Convex setup using `package.json` and `.env.example` as the single sources of truth for scripts and environment variables.

## Steps

1. Read `package.json` scripts
   - Parse the `scripts` object.
   - For each script, infer a concise description from its command.
   - Build a markdown table of scripts and descriptions for reuse in multiple docs.

2. Read `.env.example`
   - If the file exists:
     - Parse non-comment, non-empty lines of the form `KEY=VALUE`.
     - For each key, infer purpose and format (string, URL, boolean, etc.).
     - Build a markdown table of environment variables with name, required/optional, and description.
   - If the file does not exist:
     - Note its absence explicitly in docs.
     - Add a short TODO section describing that `.env.example` must be created before env docs can be authoritative.

3. Create `docs/` directory if missing
   - Ensure `docs/` exists to hold contribution and runbook documentation.

4. Generate `docs/CONTRIB.md`
   - Add sections:
     - Project overview (brief, high-level).
     - Development workflow (how to install dependencies and run dev servers).
     - Scripts reference (markdown table from step 1).
     - Environment setup:
       - How to use `.env.example` when present.
       - Current status if `.env.example` is missing.
     - Testing procedures (`pnpm test`, `pnpm lint`, `pnpm check`).

5. Generate `docs/RUNBOOK.md`
   - Add sections:
     - Deployment procedures:
       - Local production build: `pnpm build` + `pnpm start`.
       - High‑level production guidance without assuming a specific platform.
     - Monitoring and alerts:
       - Describe current state (likely manual monitoring) and TODOs for proper observability.
     - Common issues and fixes:
       - Port conflicts (`PORT`, `EXPO_PORT`).
       - Convex dev server not running.
       - Missing environment variables / `.env.example`.
     - Rollback procedures:
       - Use git (revert or checkout) + redeploy previous version.
       - Clearly mark platform‑specific details as TODOs if unknown.

6. Identify potentially obsolete documentation
   - List candidate documentation files (e.g., `AGENTS.md`, `design.md`, `todo.md`, any existing `docs/*.md`).
   - Use `git log -1` on each to find last modification date.
   - If last update is older than ~90 days, add it to an “Obsolete or Stale Docs (Needs Review)” section in `docs/RUNBOOK.md`.
   - If none qualify, state that explicitly.

7. Generate `UpdateDocs.md`
   - Summarize what was updated:
     - New or updated docs.
     - Any detected obsolete docs.
     - Known gaps (e.g., missing `.env.example`, missing production deployment details).

8. Verify and summarize changes
   - Run `git diff --stat` to inspect doc changes.
   - Check that `docs/CONTRIB.md`, `docs/RUNBOOK.md`, `UpdateDocs_PSEUDOCODE.md`, and `UpdateDocs.md` are present and well‑formed markdown.
