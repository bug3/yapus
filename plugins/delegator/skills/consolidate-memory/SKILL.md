---
name: consolidate-memory
description: Create .yapus/memory in this project and sort its auto memory into it; show the steps and make them after the person's ok
allowed-tools: Bash(bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/memory/consolidate:*)
disable-model-invocation: true
---

!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/memory/consolidate "${CLAUDE_PROJECT_DIR}"`

Show the output above to the person as it is, then follow it. To make listed steps, run the same command with the word apply after the project directory, only after the person's ok to that list.
