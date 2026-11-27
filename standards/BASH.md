---
paths:
  - "**/*.sh"
  - "hooks/git/commit-msg"
  - "hooks/git/reference-transaction"
  - "hooks/git/forward"
---

# Bash

## BASH-1. Start every bash script with `#!/usr/bin/env bash` and write only syntax that bash 3.2 runs.

## BASH-2. Check the status of every command whose failure changes what the script does next, `cd` included.

## BASH-3. Call a utility POSIX defines only with the options POSIX defines for it.

## BASH-4. Find a script's own directory by `cd -P` into the directory of `${BASH_SOURCE[0]}`.

## BASH-5. Run a command as a child, not with `exec`, when the script acts on its exit status.
