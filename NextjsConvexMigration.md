# NextjsConvexMigration

## What Was Implemented

- Refactored runtime entrypoint to a Next.js + Convex-first workflow.
- Migrated backend capabilities from the legacy tRPC/Express surface into Convex modules.
- Ported major user routes into Next.js App Router pages.
- Added Convex-backed realtime subscriptions, geolocation proximity queries, upload pipeline, AI actions, and RAG/agent modules.
- Archived the legacy Expo route tree under `legacy/expo-app`.

## Key Modules

- `app/`:
  - `page.tsx` live map + marker interaction.
  - `sightings/page.tsx` feed + trending + convoy tabs.
  - `camera/page.tsx` browser camera capture.
  - `submit/page.tsx` upload + AI enrichment + submission.
  - `sighting/[id]/page.tsx` detail + voting.
  - `plate/[licensePlate]/page.tsx` timeline + watch + export + agent prompt.
  - `widget/page.tsx` embeddable map view.
  - `api/health/route.ts` health endpoint.

- `convex/`:
  - `schema.ts` expanded production schema + indexes.
  - `_utils.ts` normalization, geo helpers, chunking, scoring, rate limits.
  - `sightings.ts`, `votes.ts`, `plates.ts`, `trending.ts`, `convoy.ts`, `anomaly.ts`, `proximity.ts`, `export.ts`, `share.ts`, `delta.ts`, `recentPlates.ts`.
  - `files.ts` upload URL + metadata registration.
  - `ai.ts` ALPR/vehicle analysis + embeddings action surface.
  - `rag.ts`, `ragIngest.ts` ingestion/retrieval.
  - `agents.ts` citation-aware run orchestration and run status persistence.

- `src/lib/`:
  - `convex-client.tsx` Convex provider wiring.
  - `convex-refs.ts` typed function reference helpers.
  - `device-id.ts`, `geo.ts`, and shared domain typing.

## Data Flow

1. Client pages subscribe using Convex `useQuery` for realtime updates.
2. User actions call Convex mutations (votes, sightings, watch updates, file registration, RAG ingestion).
3. Uploads:
   - `files:generateUploadUrl` -> direct browser upload -> `files:registerUpload`.
4. Sighting creation optionally invokes AI extraction and writes structured metadata.
5. RAG ingestion chunks and indexes contextual records.
6. Agent run executes retrieval and returns evidence/citations while persisting run state.

## Security and Validation

- Validators are present on all exposed Convex functions.
- Rate limiting exists on high-risk write paths:
  - submissions
  - votes / vote removal
  - watch updates
  - upload URL generation
- Errors for missing AI config and failed uploads are explicit.

## Verification Results

- `pnpm check`: passed
- `pnpm test`: passed (Convex integration suite is skipped when Convex URL is not configured)
- `pnpm build`: passed

## Notes

- Legacy Expo and server implementation remain in the repository under archived paths for reference and rollback.
- New runtime defaults to Next.js + Convex scripts in `package.json`.
