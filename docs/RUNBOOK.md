## Runbook: Next.js + Convex Application

This runbook captures the **operational procedures** for the Next.js + Convex web application, including deployment, monitoring expectations, common issues, and rollback guidance.

> **Single source of truth**  
>
> - Runtime commands: `package.json` scripts  
> - Environment variables: `.env.example` (to be created and maintained)

---

## 1. Deployment Procedures

### 1.1 Local production build (smoke testing)

Use this flow to verify that the app builds and runs in production mode locally:

```bash
pnpm install        # if not already installed
pnpm build          # Next.js production build
pnpm start          # Next.js production server (uses PORT, defaults to 3000)
```

This will:

- Compile the Next.js app into an optimized production build.
- Start a Node.js HTTP server serving the built app.

Ensure the Convex deployment you target is reachable and correctly configured via Convex environment settings.

### 1.2 Production deployment (platform‑agnostic outline)

> **Note:** The exact production platform (e.g., Vercel, custom Node host, container platform) is not encoded in this repo. Adapt these steps to your environment.

1. **Build artifacts**
   - Run `pnpm build` in CI or your build environment.
2. **Configure environment**
   - Provide all required env vars (mirroring `.env.example`) to the hosting platform.
   - Ensure Convex deployment URLs/keys are configured per Convex documentation.
3. **Start the app**
   - Use `pnpm start` or the hosting platform’s Next.js adapter to launch the app.
4. **Smoke test**
   - Hit the main routes (home, sightings list, submit flow) and confirm 200 responses and expected UI behavior.

Capture environment‑specific details (DNS, load balancer, auto‑scaling) in your infrastructure documentation; keep this runbook focused on application‑level steps.

---

## 2. Monitoring and Alerts

At the time these docs were generated, no dedicated monitoring stack is defined in this repo (no explicit Prometheus/Grafana/Logflare/etc. configuration).

Recommended baseline:

- **Application logs**
  - Ensure stdout/stderr from the Next.js server and Convex functions are collected by your platform’s logging system.
- **Health checks**
  - Use a simple HTTP health route such as `GET /api/health` to drive uptime checks.
- **Key indicators (to monitor)**
  - Request error rates (5xx).
  - Latency on critical routes (`/submit`, `/sightings`, `/sighting/[id]`, `/plate/[licensePlate]`).
  - Convex function error rates (queries/mutations/actions).

Monitoring and alert policies should be defined in your infra/ops tooling and linked from here once in place.

---

## 3. Common Issues and Fixes

### 3.1 Convex dev server not running

**Symptoms**

- Frontend errors like “failed to connect to Convex” or hanging data loads in dev.

**Fix**

```bash
pnpm dev:convex      # start Convex dev server
pnpm dev:next        # (re)start Next.js dev server if needed
```

Ensure `pnpm dev` is running both processes when doing local development.

### 3.2 Port conflicts (Next.js / Expo)

**Symptoms**

- `EADDRINUSE` errors when starting dev servers.

**Fix**

- For Next.js:
  - Export `PORT` to an unused port, or stop the conflicting process.
  - Example: `PORT=4000 pnpm dev:next`
- For legacy Expo dev server:
  - Use `EXPO_PORT` to change the Expo web port (see `legacy:metro` script).

### 3.3 Missing or inconsistent environment variables

**Symptoms**

- Runtime errors referencing `process.env.*` or Convex misconfiguration.

**Fix**

1. Ensure `.env.example` exists and lists all required env vars.
2. Create/update local `.env.local` (and deployment environment config) to match.
3. Restart dev and/or production servers after changing env values.

---

## 4. Rollback Procedures

Rollback strategy is platform‑dependent, but the core idea is to move back to a known‑good application version.

### 4.1 Code‑level rollback

1. Identify the last known‑good commit (e.g., via `git log` or CI history).
2. Roll back locally:

```bash
# Option A: revert a specific commit
git revert <bad_commit_sha>

# Option B: temporarily check out an older commit/branch
git checkout <good_commit_sha_or_branch>
```

1. Rebuild and redeploy the app from the rolled‑back code.

### 4.2 Deployment‑level rollback

Depending on your platform:

- **Immutable deployments (e.g., Vercel, some PaaS):**
  - Use the provider’s UI/CLI to promote a previous deployment as current.
- **Custom servers / containers:**
  - Re‑deploy the previous image or build artifact.
  - Confirm environment variables match the previous working configuration.

Document and link any provider‑specific rollback runbooks from this section once they exist.

---

## 5. Obsolete or Stale Docs (Needs Review)

As of the last migration commits (2026‑03‑05), the following top‑level markdown docs were recently updated and **do not appear to be 90+ days old**:

- `NextjsConvexMigration.md`
- `NextjsConvexMigration_PSEUDOCODE.md`
- `WebUiRedesign.md`
- `WebUiRedesign_PSEUDOCODE.md`
- `design.md`
- `todo.md`
- `openmemory.md`

> **Action:** Periodically re‑run an `git log -1` check across `docs/` and these root‑level docs to identify any that have gone stale (no updates in 90+ days) and list them here for manual review.
