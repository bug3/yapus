---
name: status
description: Show the delegator mode and launch limit in force, the launches of this session and the tool calls its background subagents wait on
allowed-tools: Bash(bash ${CLAUDE_PLUGIN_ROOT}/runtime/run.sh claude/delegator/status:*)
---

!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/status "${CLAUDE_PLUGIN_DATA}" "${CLAUDE_SESSION_ID}" $ARGUMENTS`

Show the output above to the person as it is; add nothing.
