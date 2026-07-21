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
- CI now runs for stacked pull requests regardless of their temporary base branch.

## Room architecture

- Added a backwards-compatible room hub; legacy clients remain in `default`, while new clients can create/join isolated room codes before login.
- Added configurable empty-room expiry via `ROOM_TTL_SECONDS`.
- Authenticated connections cannot switch rooms without disconnecting, preventing cross-room identity leakage.
- Added E2E coverage for room isolation, missing-room errors, legacy compatibility, reconnect, switch guards, and TTL cleanup.

## CI maintenance

- Upgraded action runtimes to `checkout@v7`, `setup-node@v7`, and the published `setup-uv@v8.3.2` tag to remove Node 20 runtime deprecation warnings.

## 2026-07-20 local merged-version smoke check

- Fast-forwarded local `main` to the four merged pull requests and launched the backend on port 8765 and frontend on port 3000.
- Restored the frontend dependency tree with `npm ci` because the previous ignored `node_modules` directory was incomplete after cleanup.
- Browser verification passed: the login screen rendered correctly, `render_game_to_text` reported an active WebSocket connection, and no console errors were captured.

## 2026-07-21 recorded multiplayer test

- Automated and recorded a complete three-player browser match using the demo player1-player3 accounts.
- The match completed in 15 turns with every player at one remaining card; all plays used the Harmony action to exercise the standard turn and settlement path deterministically.
- Verified the 23.76-second, 1280x720 WebM by decoding and visually inspecting frames from the lobby, early game, midgame, late game, and final settlement.
- No page or console errors were captured. The post-recording login smoke check also remained connected to the WebSocket backend.
- Follow-up: the settlement UI correctly displayed Player 3 as winner, but `render_game_to_text` returned `winner_id: null`; align the test hook with the `game_over` event/local winner state.

## Recorded browser E2E procedure

- Added `npm run test:e2e`, which builds the frontend with an isolated WebSocket URL, starts dedicated backend/frontend services on ports 8876/3100, runs three browser sessions through a complete match, and cleans up both services.
- The procedure asserts 15 turns, all players reaching one card, 15 cards in the harmony area, a visible settlement winner, winner parity in `render_game_to_text`, and zero browser console/page errors.
- Each run writes a fresh WebM, full settlement screenshot, and JSON report beneath `frontend/test-results/full-game/`; the directory is ignored by Git.
- Fixed the game-over handler so the winner from the `game_over` message is also written to the shared game store and exposed by `render_game_to_text`.
- Added a Browser E2E CI job that installs Chromium, runs the procedure after backend/frontend checks, and uploads artifacts for 14 days even on failure.
- Verification: the recorded E2E passed twice after startup hardening; latest run completed 15 turns with Player 2 as winner and zero browser errors. Existing 61 backend tests and frontend lint also pass.
