---
name: migrate-memory
description: Create .yapus/memory in this project and sort its auto memory into it; print the steps first and make them with apply
allowed-tools: Bash(bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/memory/migrate:*)
disable-model-invocation: true
---

!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/memory/migrate "${CLAUDE_PROJECT_DIR}" $ARGUMENTS`

Show the output above to the person as it is, then follow it.
