---
name: switch
description: Turn delegator on or off for this session, or for every session with --global
allowed-tools: Bash(bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/mode:*)
disable-model-invocation: true
---

!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/mode "${CLAUDE_PLUGIN_DATA}" "${CLAUDE_SESSION_ID}" $ARGUMENTS`

Show the first line above to the person as it is, and follow the rest of the output from now on.
