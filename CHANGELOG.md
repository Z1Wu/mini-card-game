# Changelog

All notable changes to this project are documented in this file.

The project follows [Semantic Versioning](https://semver.org/).

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

[1.1.0]: https://github.com/Z1Wu/mini-card-game/compare/v1.0.8...v1.1.0
