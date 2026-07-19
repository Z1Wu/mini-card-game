Original prompt: 你修复下把

## 2026-07-19

- Scope: clean repository dependencies, align supported player counts, stabilize backend E2E tests, and include E2E coverage in CI.
- Initial state: backend unit tests and clean frontend build pass; Windows E2E test output fails under GBK, and the UTF-8 run hangs without receive timeouts.
- Implemented: aligned the project on 3-5 players, added frontend dependency ignores, made E2E clients ASCII-safe with bounded receives, and isolated every E2E test with its own in-process server.
- CI now runs the complete backend suite, including E2E tests.
- Verification: all 20 backend tests pass; frontend `npm ci`, lint, and production build pass; browser smoke test shows a connected waiting-room login page with no console errors.
- Repository cleanup: removed 3,320 tracked `frontend/node_modules` files; restore local dependencies with `cd frontend && npm ci`.

## TODO

- Consider replacing the demo plaintext credential file before any public production deployment.
- Add dedicated frontend component tests when the UI begins changing frequently.
- Clarify whether the Infected card's "next turn" ability is optional and one-shot before implementing its missing interactive flow.

## Rules-engine hardening

- Added injectable seeded randomness for reproducible deals and first-player selection.
- Added strict player lifecycle invariants: unique IDs, waiting-room-only joins, and supported player counts only.
- Added WebSocket E2E coverage for duplicate identities and late joins after a game starts.
- Unsupported deck sizes now fail explicitly instead of silently producing a five-player deck.
- Added table-driven coverage for every card's harmony value and victory priority.
- Added scenario coverage for all five victory priorities, tied imprisonment, non-positive doubt totals, and settlement summaries.
- Corrected the overview's Library Committee / Discipline Committee harmony values to match the authoritative card table.
- Added a credential-safe `render_game_to_text` browser hook for route, connection, turn, and public zone-count observability.
- Browser observability distinguishes raw WebSocket transport health from authenticated-player state.
