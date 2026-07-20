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
