---
paths:
  - "**/*.sh"
  - "hooks/git/commit-msg"
  - "hooks/git/pre-push"
  - "hooks/git/reference-transaction"
---

# Bash

## BASH-1. Start every bash script with `#!/usr/bin/env bash` and write only syntax that bash 3.2 runs.

## BASH-3. Check the status of every command whose failure changes what the script does next, `cd` included.

## BASH-4. Call a utility POSIX defines only with the options POSIX defines for it.

## BASH-5. Find a script's own directory by `cd -P` into the directory of `${BASH_SOURCE[0]}`.

## BASH-6. Run a command as a child, not with `exec`, when the script acts on its exit status.
