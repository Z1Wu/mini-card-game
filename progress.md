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

## 2026-08-19 Issue #118 decision clarity, public history, and settlement reveal

- Goal: improve selected-card decision guidance, reconnect-safe public action history, and the four-stage settlement reveal; tutorial content is explicitly out of scope.
- Added server-owned public action entries to game state. Harmony and Doubt entries omit card names, while face-up Skill entries expose only public card/target facts; reset clears the history.
- Added a server-authoritative winner-reason payload with winner role, condition, and priority.
- Added selected-card strategy copy, three action outcome previews, explicit Criminal/Home Club unavailable states, and a collapsible public action history.
- Upgraded settlement stages with progressive item reveals, a stage track, winner presentation, and a server-backed priority explanation; reduced-motion disables delays.
- Verification: 141 backend tests and 28 frontend component tests pass; frontend lint and production build pass.
- Browser verification: the required web-game action loop captured and verified the selected-card strategy sheet; recorded desktop and 844×390 mobile matches both completed 15 turns with one public entry per play and zero console/page errors.
- Visually inspected the settled mobile decision sheet, expanded public history, and desktop/mobile winner reveal. Short-landscape settlement keeps the rematch/login actions reachable by scrolling.
- Remaining: commit, Draft PR, and CI confirmation. No known product or test TODOs remain in Issue #118 scope.

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

## 2026-08-19 Issue #122 deterministic E2E scenarios

- Scope: separate the complete-match smoke test from named deterministic gameplay scenarios, remove silent action fallbacks, report planned/observed/missing coverage, and record the actual acting players.
- Initial finding: the checkout was detached at merged commit `d85af93`; switched to the already-authorized `codex/issue-122-e2e-scenarios` branch with a clean working tree.
- Design: use server-owned named scenario fixtures enabled only by an explicit E2E runtime flag. The authenticated room host may select a known fixture; clients cannot submit arbitrary state, and production configuration rejects the flag.
- Recording plan: save every participating player's WebM and a synchronized multiview HTML/timeline artifact, avoiding a CI dependency on video-splicing tools.
- TODO: implement fixtures and tests, add desktop/full and mobile/subset runners, inspect generated screenshots/videos, run all repository checks, then publish a draft PR and verify CI.
- Implemented 12 named server-owned scenarios plus explicit waiting/result coverage. Desktop report hits 14/14 with action distribution: harmony 4, doubt 1, skill 10; missing coverage is empty.
- The complete-match smoke remains a separate three-player, 15-turn terminal/settlement check and now saves all three player videos.
- Every suite saves per-player WebMs, screenshots, `timeline.json`, and a synchronized `multiview.html` that highlights the active player without requiring ffmpeg.
- The 844x390 suite intentionally runs Home Club, Rich Girl, Class Representative, and Honor Student rather than copying the full desktop matrix.
- Fixed the current actor's wait presentation so Class Representative/Honor Student multi-step waits do not misleadingly say to choose a hand card; added component coverage.
- Visual QA: inspected desktop and mobile choice/wait/result screenshots, and played the generated four-view artifact with the required web-game Playwright client. No console/page errors were produced.
- Validation: 156 backend tests, 35 frontend tests, frontend lint/build, combined desktop E2E, and mobile E2E all pass.
- Published commit `e7e8a9d` and draft PR #123. Backend and frontend CI passed; both E2E runners were manually cancelled after more than 41 minutes because `playwright install --with-deps` hung while refreshing `azure.archive.ubuntu.com`, despite a successful Chromium cache restore.
- CI follow-up: run desktop and mobile E2E in one job backed by the version-matched official Playwright 1.61.1 Noble container. This removes the flaky apt step and avoids duplicate environment initialization; CI confirmation remains.
- Container CI reached both desktop and mobile tests in 4m35s; every E2E and artifact-upload step passed. Fixed the remaining reporting-only failures by selecting Bash for brace expansion and covering the no-preview-URL PR-comment path without the stale `videoLabel` reference.
