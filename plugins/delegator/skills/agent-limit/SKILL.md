---
name: agent-limit
description: Set the subagent launch limit of this session, or of every session with --global
allowed-tools: Bash(bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/limit:*)
disable-model-invocation: true
---

!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/limit "${CLAUDE_PLUGIN_DATA}" "${CLAUDE_SESSION_ID}" $ARGUMENTS`

Show the output above to the person as it is; add nothing.
