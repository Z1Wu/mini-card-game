# GitHub Pages host for CI artifacts

This branch is managed automatically. The \`ci-runs/\` directory is populated by the \`browser-e2e\` job in \`.github/workflows/ci.yml\`, which publishes the recorded three-player E2E video (\`full-game.webm\`) for each pull-request workflow run.

Videos are served at:

\`\`\`
https://z1wu.github.io/mini-card-game/ci-runs/pr-\<N\>-\<run-id\>.webm
\`\`\`

Old files are pruned to keep the last 30 webms.

Do not commit to this branch manually.
