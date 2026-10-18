#!/usr/bin/env bash
set -u

# Runs hooks/claude/<name>/main.ts. Claude Code lets a tool call through on any
# exit but 0 and 2, so every other exit of the hook becomes 2.

readonly INSTALL_NODE='install Node 24 or newer'

fail() {
  printf '%s\n' "yapus run.sh: $1" >&2
  exit 2
}

name=${1-}

case $name in
  '' | /* | */ | *//* | *[!a-z0-9/]*)
    fail "hook name $(printf '%q' "$name") is not segments of lowercase letters and digits joined by /; fix the hook command"
    ;;
esac

shift

if ! dir=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd); then
  fail 'cannot find its own directory; reinstall yapus'
fi

entry="$dir/$name/main.ts"

if [ ! -f "$entry" ]; then
  fail "no hook at $entry; fix the hook command"
fi

if ! command -v node >/dev/null 2>&1; then
  fail "node not found; $INSTALL_NODE"
fi

if ! major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null); then
  fail "node did not report its version; $INSTALL_NODE"
fi

case $major in
  '' | *[!0-9]*)
    fail "node reported version '$major'; $INSTALL_NODE"
    ;;
esac

if [ "$major" -lt 24 ]; then
  fail "node $major found; $INSTALL_NODE"
fi

node "$entry" "$@"
status=$?

case $status in
  0) exit 0 ;;
  2) exit 2 ;;
esac

fail "hook $name failed with exit $status; the call is blocked, fix the hook"
