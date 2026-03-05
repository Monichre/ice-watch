# Web UI Redesign Pseudocode

## Goal

Redesign all primary app surfaces for elite web presentation while preserving existing product behavior and API contracts.

## Aesthetic Direction

- Use a "civic intelligence console" style.
- Keep dark atmospheric background and high-contrast semantic accents.
- Use distinctive typography:
  - Display: Unbounded
  - Body: Manrope
  - Mono/meta: JetBrains Mono
- Emphasize depth with subtle blur, layered surfaces, and controlled glow.

## Shared Foundation

1. Update `theme.config.js`
   - Expand token set for shell, panel, ring, and elevated surfaces.
   - Keep existing token names used by NativeWind and `useColors`.

2. Update `lib/theme-provider.tsx`
   - Keep `SchemeColors` sync logic.
   - Remove debug logging.
   - Set root CSS vars every scheme switch.

3. Update `global.css`
   - Import new fonts.
   - Add base html/body gradient mesh and scrollbar styles.
   - Add utility classes for glass panels, web rails, and focus rings.

4. Update `components/screen-container.tsx`
   - Add optional web-only content width limit.
   - Keep defaults backward compatible.

## Navigation Shell

1. Update `app/(tabs)/_layout.tsx`
   - Keep routes unchanged.
   - Use floating, blurred dock on web with larger tap targets.
   - Keep native behavior for non-web.

## Map Rendering Core

1. Update `components/leaflet-map.tsx`
   - Keep props and callbacks unchanged.
   - Improve marker HTML and popup visuals.
   - Improve cluster icon styling and control placement.
   - Preserve heatmap and user-location features.

## Screen Redesign (Preserve Behavior)

1. `app/(tabs)/index.tsx`
   - Keep all query/filter/map features.
   - Improve panel composition, spacing, hierarchy, and control rails.
   - Add desktop-aware layout adjustments.

2. `app/(tabs)/sightings.tsx`
   - Keep tabs, sorting, swipe-to-vote, and data sources.
   - Redesign list and cards with stronger typographic hierarchy.

3. `app/sighting/[id].tsx`
   - Keep vote/share/export and map embedding.
   - Redesign credibility and AI blocks into premium card system.

4. `app/plate/[licensePlate].tsx`
   - Keep watch/share/export/map/timeline behavior.
   - Improve timeline readability and map/stat surfaces.

5. `app/camera.tsx`
   - Keep camera + GPS + capture pipeline unchanged.
   - Refine overlays, controls, and permission states for web.

6. `app/submit.tsx`
   - Keep payload and submission logic unchanged.
   - Redesign form hierarchy, chips, and ALPR picker styling.

7. `app/widget.tsx`
   - Keep embedding behavior and marker updates unchanged.
   - Refine widget badge and popup styling.

## Verification

1. Run `pnpm check`.
2. Run `pnpm lint`.
3. Validate critical route flows:
   - `/` map interactions
   - `/sightings` tabs + voting
   - `/sighting/[id]` voting/share/export
   - `/plate/[licensePlate]` watch/share/export
   - `/camera` -> `/submit` -> submit mutation
   - `/widget` map render
4. Record outcomes and residual risks in `WebUiRedesign.md` and `tasks/todo.md`.
