# Bash

## B1. Start every bash script with `#!/usr/bin/env bash` and write only syntax that bash 3.2 runs.

## B2. Make `set -u` the first command of every bash script, and leave `set -e` off.

## B3. Check the status of every command whose failure changes what the script does next, `cd` included.

## B4. Call external utilities only with the options POSIX defines.

## B5. Find a script's own directory by `cd -P` into the directory of `${BASH_SOURCE[0]}`.

## B6. Run a command as a child, not with `exec`, when the script acts on its exit status.
