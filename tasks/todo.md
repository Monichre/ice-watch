- [completed] Define web-first visual language and global tokens.
- [completed] Implement global browser rendering and typography upgrades.
- [completed] Redesign navigation shell and shared screen container behavior.
- [completed] Upgrade map rendering visuals and controls for desktop web.
- [completed] Redesign map home, reports, sighting detail, and plate timeline screens.
- [completed] Redesign camera, submit flow, and embeddable widget surfaces.
- [completed] Run lint/type checks and fix regressions.
- [completed] Add final review notes with results and risks.

## Review

- Completed full web-first visual overhaul across shared tokens, navigation shell, map renderer, core tabs, detail screens, capture flow, submit flow, and widget.
- Preserved all existing route and API behavior while tightening design consistency and desktop layout quality.
- Fixed regressions discovered in review:
  - Corrected `sightings.list` limits to backend-supported bounds.
  - Prevented Leaflet map reinitialization on center/zoom updates.
  - Removed broken camera gallery handoff to submit route.
  - Restored vote unselect contract by calling vote removal mutation.
- Verification:
  - `pnpm check` passed.
  - `pnpm lint` passed (only Node runtime warning about `eslint.config.js` module type, no lint errors).
