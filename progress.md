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

## 2026-08-06 multiplayer table visual pass

- Reworked the game table shell, status header, turn banner, opponent states, face-up area, and harmony area to match the existing light campus visual language without changing game messages or rules.
- Validation blocker: the WSL environment has no Node.js/pnpm; a Windows-side pnpm build against the WSL share fails while relinking `node_modules` with `EPERM`. Re-run the frontend build from a single native runtime after restoring the dependency environment.

## 2026-08-06 interaction feedback

- Added accessible live announcements for turn banners and error feedback in the game table without changing game rules or protocol messages.
- Made the game header controls wrap cleanly on narrow screens while retaining the desktop layout.

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

## 2026-07-21 refined card faces PR

- Rebasing PR #6 exposed a recorded-browser selector that assumed each card's visible text began with its role name.
- The redesigned card face places the harmony value before the name, so the test could mistake a Criminal card for a playable card and wait forever for actions that are intentionally hidden.
- Added an accessible card-name label and changed the recorded game to select a non-Criminal card through that stable contract.
- Verification passed: frontend lint, production build, and the complete 15-turn recorded browser game all succeed with zero console errors.
- Visually inspected the final settlement and auxiliary Playwright captures; role colors, emblems, values, card names, and winner presentation remain legible.
- Temporary backend/frontend validation services were stopped after the browser checks.

## 2026-07-21 security and roadmap implementation

- Began the requested development roadmap with the authoritative-server security slice.
- Bound gameplay actions to the player identity associated with the WebSocket connection and reject spoofed `player_id` payloads.
- Restricted game start/reset to the first joined player (room host).
- Replaced full-state broadcasts with recipient-specific views: each player sees only their own hand during play, while harmony/doubt card faces stay hidden until settlement.
- Added E2E regressions for private-hand visibility, spoofed actions, and host-only controls.
- Completed the first rules gap pass: Accomplice now moves a specifically selected doubt card between valid players, and Infected now offers an optional, one-shot harmony-card take at the beginning of its owner's next turn.
- Made generated card IDs opaque so hidden-zone selection identifiers no longer reveal card roles.
- Added UI flows for Accomplice and Infected plus backend unit coverage; backend suite is now 67 tests.
- Exposed room creation/joining on the login screen, added room/host presentation, and restricted start/reset controls to the host in the UI.
- Added room-aware reconnect tokens stored in session storage, automatic room rejoin/re-authentication, live connection-state subscriptions, and intentional-disconnect suppression.
- Reconnecting players now receive the correct outstanding prompt for Infected, Rich Girl, Class Representative, News Club, or Honor Student multi-step phases.
- Added PBKDF2-SHA256 password-hash support and a CLI generator for deployment user files while retaining plaintext only for local demo accounts.
- Added configurable WebSocket origin allowlisting and per-connection message rate limiting for deployments.
- Disabled the legacy unauthenticated `join_game` path in the application entrypoint by default; an explicit compatibility flag remains for older clients and isolated tests.
- Final verification: 72 backend tests pass; frontend lint and production build pass; the recorded three-browser match completes 15 turns with winner parity and zero console/page errors.
- Visually inspected the refreshed room-creation screen and final settlement screenshots; room code/controls, settlement sections, card faces, and winner presentation are legible with no observed layout regressions.
