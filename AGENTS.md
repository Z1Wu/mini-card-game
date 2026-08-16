# Agent Collaboration Guide

This repository uses GitHub Issues as the source of truth for development work. Read this file before making changes.

For full details, see [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md).

## Before you change code

1. Find the GitHub Issue that authorizes the work. Do not start untracked feature work.
2. Check the Issue assignee.
   - If it is unassigned, assign yourself before implementation and leave a short start comment.
   - If it is assigned to someone else, do not change the same scope unless the Issue records a handoff or explicit coordination.
3. Read the Issue's acceptance criteria, affected areas, dependencies, and linked PRs.
4. Check the working tree. Do not stage, discard, reformat, or otherwise modify unrelated local changes.

## Development rules

- One Issue has one focused branch and one PR.
- Create branches from current `main` using `codex/issue-<number>-<short-description>`.
- Keep each commit and PR within the Issue's stated scope. Create or reference a separate Issue for follow-up work.
- Record dependency order in Issues using `Depends on #<number>` or `Blocked by #<number>`.
- Treat the server as authoritative: preserve existing authentication, room isolation, and recipient-specific game-state visibility unless the Issue explicitly changes them.
- Add or update tests for behavior changes, then run the checks relevant to the changed area.

## Pull requests and handoffs

- Open a draft PR against `main` and include `Closes #<number>` in its description.
- Use the PR template to document summary, scope, validation, and collaboration notes.
- **After creating a PR, immediately check CI status** with `gh pr checks <PR-number>`. If any check fails, read the logs with `gh run view <run-id> --log-failed`, fix the root cause, push, and re-check. Never report a PR as ready without confirming CI passes or explicitly listing failing checks.
- When changing UI structure (class names, DOM hierarchy, element roles), update E2E locators in `frontend/e2e/` to match. Local unit tests (`vitest`) do not cover E2E flows — CI runs Playwright E2E separately.
- Do not merge with failing CI. Keep the Issue assigned until its PR is merged.
- When handing off work, comment on the Issue with the branch, completed work, remaining work, checks run, and known risks; then update the assignee.

## Local hygiene

- Never use destructive Git commands (`reset --hard`, `checkout --`, or broad clean commands) on a mixed working tree.
- Do not commit editor state, agent state, dependency directories, test recordings, build output, credentials, or environment files.
- Keep production credentials outside this repository. Demo plaintext credentials are for local development and automated tests only.
