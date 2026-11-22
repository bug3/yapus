---
name: exclude
description: Turn ordo off in this project and its worktrees; add it to the exclusion list and keep the ordo standards from loading here
allowed-tools: Bash(bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" ordo/exclusion:*)
---

!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" ordo/exclusion "${CLAUDE_PROJECT_DIR}" exclude`

Show the output above to the person as it is; add nothing.
