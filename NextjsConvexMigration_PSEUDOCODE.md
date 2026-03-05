# NextjsConvexMigration_PSEUDOCODE

1. Bootstrap runtime
   - Switch package scripts from Expo/Express to Next.js + Convex dev.
   - Add Next.js config and TypeScript setup for App Router.
   - Move legacy Expo `app/` to `legacy/expo-app`.
   - Promote Next.js routes into root `app/`.

2. Convex schema and index model
   - Define tables for users, sightings, votes, watch subscriptions, uploads, RAG docs/chunks, and agent runs.
   - Add indexes for plate lookup, recency, geo buckets, and status lookups.
   - Add helper functions for plate normalization, geo bucketing, distance math, chunking, embeddings, and rate limits.

3. Core backend migration to Convex functions
   - Sightings: list, getById, create, nearby, delta, tracked plates.
   - Votes: getUserVote, getCounts, cast, remove, credibility refresh.
   - Plates/trending/convoy/anomaly/export/share/proximity modules.

4. Realtime data flow
   - Replace polling cache with Convex `useQuery` live subscriptions in Next.js pages.
   - Keep mutations for vote/submit/watch actions.

5. Geolocation + proximity
   - Capture browser geolocation in camera/map/submit pages.
   - Use geo-bucket prefilter + exact distance pass in Convex proximity query.
   - Add watch subscriptions by device and plate.

6. Upload flow
   - Generate Convex upload URL via mutation.
   - Upload blob from browser directly.
   - Register file metadata and URL in `uploads`.
   - Pass storage ID + file URL into sighting creation.

7. AI + agents + RAG
   - AI actions: ALPR extraction, vehicle analysis, embedding endpoint.
   - RAG ingestion: document/chunk creation with embeddings.
   - RAG retrieval: lexical + embedding score blend with citations.
   - Agent execution: RAG synthesis run + run-state persistence.

8. Route migration
   - Implement Next routes for map, sightings feed, camera, submit, sighting detail, plate timeline, widget.
   - Add API health route.

9. Hardening
   - Add argument validators for all Convex public functions.
   - Add rate limiting for votes, uploads, watch updates, and submissions.
   - Keep clear error messages for missing AI configuration and upload failures.

10. Verification
    - Run typecheck.
    - Run tests.
    - Run Next production build.
    - Record unresolved optional items (Convex env-dependent integration tests).
