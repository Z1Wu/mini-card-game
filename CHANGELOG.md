# Changelog

All notable changes to this project are documented in this file.

The project follows [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-08-13

### Added

- Responsive gameplay tabletop with dedicated hand, opponent, and central-zone components, keyboard-only card selection, and a deterministic fixture page capturing 3/4/5-player layouts across four viewports.
- Four-stage settlement reveal (Harmony, Doubt, Final Identity, Winner).
- Reusable three-player browser E2E harness with collision-safe ports, per-player diagnostics, and seeded reproducible deals.
- Production startup validation: `APP_ENV=production` requires an explicitly supplied hash-only users file and concrete HTTP(S) allowed origins, failing fast before serving traffic.
- Illustrated benchmark card art and frontend component tests for Button and Card.
- Parameterized remote deploy script.

### Changed

- Aligned repository documentation with the shipped multiplayer system, including deployment, rollback, and CI/tag guidance.
- Extracted game-over settlement into a dedicated view; replaced alert dialogs with quiet feedback and live announcements.
- Polished the campus-style game UI and card presentation.

### Security

- Production deployments now reject implicit demo defaults: plaintext passwords, bundled demo users, and wildcard or missing allowed origins abort startup.

## [1.1.0] - 2026-07-21

### Added

- Isolated private multiplayer rooms with room creation, joining, reconnect, and authorization flows.
- Password hashing support and safer authentication configuration.
- Deterministic game setup and broader backend coverage for game rules and special cards.
- Recorded browser end-to-end coverage for the full game flow.
- CI-built, versioned Docker Hub images with pull-based deployment support.

### Changed

- Refined card faces, selection behavior, lobby flow, and in-game interface.
- Upgraded and pinned GitHub Actions dependencies.
- Hardened repository validation and expanded Backend, Frontend, and Browser E2E checks.

### Security

- Restricted room state and game actions to authenticated room members.
- Improved reconnect handling and protected password storage.

[1.2.0]: https://github.com/Z1Wu/mini-card-game/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Z1Wu/mini-card-game/compare/v1.0.8...v1.1.0
