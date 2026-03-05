# Web UI Redesign

## Objective

Rebuild the frontend presentation as a web-first experience with significantly higher visual quality, while preserving existing product behavior, route contracts, and backend API integration.

## Design Direction

- **Style:** civic intelligence console with layered dark surfaces and semantic accent colors.
- **Typography system:**
  - Display: `Unbounded`
  - Body: `Manrope`
  - Metadata/telemetry: `JetBrains Mono`
- **Rendering quality:** consistent depth, panel hierarchy, spacing cadence, and desktop-optimized composition.

## Key Modules Updated

- `theme.config.js`
  - Replaced token values for a coherent web-centric palette.
- `lib/theme-provider.tsx`
  - Simplified CSS variable hydration and removed debug output.
- `lib/_core/theme.ts`
  - Updated web font stacks to match redesign typography.
- `global.css`
  - Added upgraded font imports, layered background treatment, and reusable web utility classes.
- `components/screen-container.tsx`
  - Added optional web width-constraining behavior.
- `app/(tabs)/_layout.tsx`
  - Redesigned tab shell with floating dock behavior on web.
- `components/leaflet-map.tsx`
  - Redesigned markers/popups/controls and improved center-sync behavior without reinitialization churn.
- `app/(tabs)/index.tsx`
  - Reworked desktop overlay composition, controls, telemetry panels, and selected-marker card.
- `app/(tabs)/sightings.tsx`
  - Upgraded feed/trending/convoy visual system and desktop content widths.
- `app/sighting/[id].tsx`
  - Upgraded detail information hierarchy and panel styling.
- `app/plate/[licensePlate].tsx`
  - Upgraded timeline/map/stat readability and desktop presentation.
- `app/camera.tsx`
  - Upgraded capture UI styling and prevented broken gallery-to-submit path.
- `app/submit.tsx`
  - Improved desktop form layout constraints and fixed dependency hygiene.
- `app/widget.tsx`
  - Upgraded embeddable map badge and text rendering.

## Behavior and Contract Preservation

- Preserved existing core flows:
  - map browsing and marker selection
  - vote casting and removal
  - plate tracking and exports
  - camera capture -> submit mutation
  - widget live updates
- Fixed API contract drift by enforcing `sightings.list` request limits compatible with backend validation.

## Process and Component Architecture

- **Foundation-first pass:** tokens, global CSS, theme provider.
- **Shell and primitives:** tab layout, screen container, map renderer.
- **Route redesign pass:** map tab, reports tab, sighting detail, plate detail.
- **Capture pipeline pass:** camera and submit UX.
- **Embed pass:** widget consistency.
- **Stability pass:** lint/typecheck, regression remediation.

## Data Flow Notes

- Existing tRPC data flow remains unchanged:
  - `trpc.sightings.list` feeds map and widget
  - `trpc.sightings.getById` powers sighting detail
  - `trpc.plates.getByPlate` powers plate timeline
  - `trpc.votes.cast` and `trpc.votes.remove` handle vote toggles
  - `trpc.sightings.create` handles submit pipeline
- Route parameter contracts for capture/submit remain intact for live capture flow.

## Verification

- `pnpm check` -> pass
- `pnpm lint` -> pass (no lint errors)

## Residual Risk

- Lint/TypeScript passes are clean; runtime visual validation in browser remains recommended for final polish checks at multiple breakpoints.
