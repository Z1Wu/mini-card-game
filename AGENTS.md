# Agent Collaboration Guide

Use the user request and pull request as the source of truth for development work. Read this file before making changes.

For full details, see [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md).

## Before you change code

1. Understand the user's request, scope, and acceptance criteria. Ask only when essential information is missing.
2. Check the working tree. Do not stage, discard, reformat, or otherwise modify unrelated local changes.
3. Inspect relevant code, documentation, dependencies, and existing pull requests before changing files.

## Development rules

- Group closely related steps that complete the same user request into one focused branch and PR; do not split a coherent change into multiple PRs just to separate small implementation steps. Keep unrelated work in separate PRs.
- Create branches from current `main` using `codex/<short-description>`.
- Keep commits and the PR within the requested scope. Record relevant dependencies and follow-up work in the PR description.
- Treat the server as authoritative: preserve existing authentication, room isolation, and recipient-specific game-state visibility unless the user explicitly requests a change.
- Add or update tests for behavior changes, then run the checks relevant to the changed area.

## Pull requests and handoffs

- Open a regular, non-draft PR against `main`. Use a draft PR only when the user explicitly requests one.
- Write PR titles and descriptions in Chinese. Keep technical identifiers, commands, and test names in their original form when needed.
- Use the PR template to document summary, scope, validation, and collaboration notes.
- **After creating a PR, immediately check CI status** with `gh pr checks <PR-number>`. If any check fails, read the logs with `gh run view <run-id> --log-failed`, fix the root cause, push, and re-check. Never report a PR as ready without confirming CI passes or explicitly listing failing checks.
- When changing UI structure (class names, DOM hierarchy, element roles), update E2E locators in `frontend/e2e/` to match. Local unit tests (`vitest`) do not cover E2E flows — CI runs Playwright E2E separately.
- Do not merge with failing CI.
- When handing off work, record the branch, completed work, remaining work, checks run, and known risks in the PR.

## Local hygiene

- Never use destructive Git commands (`reset --hard`, `checkout --`, or broad clean commands) on a mixed working tree.
- Do not commit editor state, agent state, dependency directories, test recordings, build output, credentials, or environment files.
- Keep production credentials outside this repository. Demo plaintext credentials are for local development and automated tests only.

## Parallel local worktrees

- Start a local environment from the repository root with `make setup` and `make worktree` (`make dev` is an alias). The Makefile automatically finds and locks a free port slot for the running worktree, allowing multiple worktrees to run at the same time.
- To request a specific slot, use `make worktree DEV_SLOT=<0-999>`. The command checks that its frontend, backend WebSocket, and admin API ports are available before starting; otherwise it reports the conflict. Do not hardcode ports in worktree-local instructions.
- E2E scripts select free backend and frontend ports by default. Keep generated reports under each worktree's own `frontend/test-results/` directory or set `E2E_OUTPUT_DIR` to a worktree-specific path.
- For local human acceptance, run `make e2e` to execute the CI desktop and mobile browser suites and review the generated `multiview.html`, `report.json`, screenshots, and per-player recordings under `frontend/test-results/`. Install dependencies and Chromium with `make e2e-install-browser` if needed.
