---
name: include
description: Turn ordo back on in this project; take it off the exclusion list and let the ordo standards load here again
allowed-tools: Bash(bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" ordo/exclusion:*)
---

!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" ordo/exclusion "${CLAUDE_PROJECT_DIR}" include`

Show the output above to the person as it is; add nothing.
