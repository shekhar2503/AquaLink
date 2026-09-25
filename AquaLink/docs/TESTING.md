# AquaLink testing strategy

The test suite is split by failure domain so local and CI output identifies whether a regression belongs to data/scoring, the frontend contract, React rendering, or a complete browser journey.

## Backend

`pytest` covers scoring boundaries, recommendation branches, dataset schema and derived-value validation, metadata contracts, forecast validation and regression behavior, geography, data confidence rules, SQLite IoT persistence, and API success/failure responses.

Tests that write telemetry use isolated temporary SQLite databases. They do not populate `backend/aqualink.db`.

## Frontend

- Node contract tests cover record normalization, authoritative thresholds, CSV export, forecast normalization, and risk aggregation.
- Vitest, jsdom, and Testing Library cover fallback loading, forecast rendering, data-source warnings, state semantics, year controls, navigation, and theme controls.
- Playwright Chromium covers dashboard loading, theme persistence, map filtering, location drill-down, backend/frontend forecast consistency, and fallback warnings.

OpenStreetMap tiles are blocked during E2E tests because map markers and decision logic do not require an external tile service.

## Remaining gaps

- Browser E2E currently runs Chromium only; Firefox, WebKit, and mobile-device projects are not in CI.
- Leaflet rendering is checked through marker interaction, not pixel-level map snapshots.
- Recharts canvas/SVG geometry is not snapshot-tested; accessible tables and backend values are asserted instead.
- No physical IoT hardware, MQTT broker, PostgreSQL, PostGIS, or external government data service is required or tested.
- Visual regression and load/performance testing remain out of scope.
