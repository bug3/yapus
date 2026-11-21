---
name: dive-report
description: Report the workflow agents, tokens, time, models and tools of one workflow run per stage
argument-hint: <run directory>
allowed-tools: Bash(bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/dive:*)
---

!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/dive $ARGUMENTS`

Show the report above to the person as it is; add nothing.
