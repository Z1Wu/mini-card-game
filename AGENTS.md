# Agent Collaboration Guide

Use the user request and pull request as the source of truth for development work. Read this file before making changes.

For full details, see [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md).

## Before you change code

1. Understand the user's request, scope, and acceptance criteria. Ask only when essential information is missing.
2. Check the working tree. Do not stage, discard, reformat, or otherwise modify unrelated local changes.
3. Inspect relevant code, documentation, dependencies, and existing pull requests before changing files.

## Development rules

- Use one focused branch and PR per coherent change.
- Create branches from current `main` using `codex/<short-description>`.
- Keep commits and the PR within the requested scope. Record relevant dependencies and follow-up work in the PR description.
- Treat the server as authoritative: preserve existing authentication, room isolation, and recipient-specific game-state visibility unless the user explicitly requests a change.
- Add or update tests for behavior changes, then run the checks relevant to the changed area.

## Pull requests and handoffs

- Open a regular, non-draft PR against `main`. Use a draft PR only when the user explicitly requests one.
- Use the PR template to document summary, scope, validation, and collaboration notes.
- **After creating a PR, immediately check CI status** with `gh pr checks <PR-number>`. If any check fails, read the logs with `gh run view <run-id> --log-failed`, fix the root cause, push, and re-check. Never report a PR as ready without confirming CI passes or explicitly listing failing checks.
- When changing UI structure (class names, DOM hierarchy, element roles), update E2E locators in `frontend/e2e/` to match. Local unit tests (`vitest`) do not cover E2E flows — CI runs Playwright E2E separately.
- Do not merge with failing CI.
- When handing off work, record the branch, completed work, remaining work, checks run, and known risks in the PR.

## Local hygiene

- Never use destructive Git commands (`reset --hard`, `checkout --`, or broad clean commands) on a mixed working tree.
- Do not commit editor state, agent state, dependency directories, test recordings, build output, credentials, or environment files.
- Keep production credentials outside this repository. Demo plaintext credentials are for local development and automated tests only.
