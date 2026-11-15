---
description: Install the yapus repository setup into this repository (TypeScript by default: ESLint, tsconfig, scripts; Go with the argument go: golangci-lint; both: CI workflow, scope catalog), or upgrade it to the plugin's version
argument-hint: "[typescript|go]"
allowed-tools: Bash(bash ${CLAUDE_PLUGIN_ROOT}/runtime/run.sh landmark/project:*)
---

!`bash "${CLAUDE_PLUGIN_ROOT}/runtime/run.sh" landmark/project "${CLAUDE_PLUGIN_ROOT}" "${CLAUDE_PROJECT_DIR}" $ARGUMENTS`

Show the output above to the person as it is; add nothing.
