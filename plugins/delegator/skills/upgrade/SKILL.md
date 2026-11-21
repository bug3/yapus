---
name: upgrade
description: Move the .yapus files of an older layout into the present one
allowed-tools: Bash(bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/upgrade:*)
---

!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" claude/delegator/upgrade "${CLAUDE_PROJECT_DIR}"`

Show the output above to the person as it is; add nothing.
