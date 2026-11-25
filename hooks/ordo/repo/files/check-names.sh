#!/usr/bin/env bash
set -u

# Checks every segment of every path git keeps in the work tree, tracked or
# untracked but not ignored, from its top level. A segment passes when it is
# lowercase words joined by hyphens, parts by underscores, with a UTC time
# such as 2026-04-11T22-06-47Z as one word, when it is in the uppercase class
# of names such as README.md, or when a tool owns it. Go, Python and PHP files
# are skipped, their folders are not. It exits 0 when every path passes and 2
# otherwise, with one stderr line per failing path.

# The ranges below mean ASCII letters only in the C locale.
export LC_ALL=C

readonly UTC_TIME='[0-9]+(-[0-9]+)*T[0-9]+(-[0-9]+)*Z'
readonly UNIT="([a-z0-9]+|$UTC_TIME)"
readonly WORD="$UNIT(-$UNIT)*"
readonly NAME="$WORD(_$WORD)*"
readonly CHOSEN="^\\.?$NAME(\\.$NAME)*$"
readonly UPPERCASE='^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*(\.[a-z0-9]+)*$'
readonly NEXT_PAGE='^_(app|document)(\.[a-z0-9]+)+$'
readonly BRACKET_ROUTE='^\[[][A-Za-z0-9._-]+\](\.[a-z0-9]+)*$'
readonly SASS_PARTIAL="^_$NAME\\.(scss|sass)$"
readonly RULE='is not lowercase words joined by hyphens, parts by underscores; rename it'

fail() {
  printf '%s\n' "yapus names: $1" >&2
  exit 2
}

# A name a tool fixes; a folder is given with a trailing slash.
is_tool_owned() {
  case $1 in
    Makefile | Dockerfile | _index.md | .DS_Store) return 0 ;;
    __tests__/ | __mocks__/ | __snapshots__/ | _posts/ | _drafts/ | __pycache__/) return 0 ;;
    Cargo.lock | Cargo.toml | Chart.lock | Chart.yaml) return 0 ;;
    CMakeLists.txt | CMakePresets.json | CMakeUserPresets.json) return 0 ;;
    Project.toml | JuliaProject.toml | Manifest.toml | JuliaManifest.toml) return 0 ;;
  esac

  [[ ${1%/} =~ $NEXT_PAGE ]] || [[ ${1%/} =~ $BRACKET_ROUTE ]] || [[ ${1%/} =~ $SASS_PARTIAL ]]
}

is_passing() {
  [[ ${1%/} =~ $CHOSEN ]] || [[ ${1%/} =~ $UPPERCASE ]] || is_tool_owned "$1"
}

# Sets failing to the first segment of path that fails, or to nothing when
# every segment passes; a global, not stdout, spares a subshell per path.
find_failing_segment() {
  local rest=$1 segment
  failing=''

  while [ "${rest#*/}" != "$rest" ]; do
    segment=${rest%%/*}/
    rest=${rest#*/}

    # Go reads the files below testdata as test input and go mod vendor
    # writes the ones below vendor, whatever their names.
    case $segment in
      testdata/ | vendor/) return 0 ;;
    esac

    is_passing "$segment" || { failing=${segment%/}; return 0; }
  done

  case $rest in
    *.go | *.py | *.pyi | *.php) return 0 ;;
  esac

  is_passing "$rest" || failing=$rest
}

# Reads NUL-separated paths on stdin; returns 1 when any path fails. During a
# merge, git lists a conflicted path once per stage, one after another.
check_paths() {
  local path previous='' status=0

  while IFS= read -r -d '' path; do
    [ "$path" != "$previous" ] || continue
    previous=$path
    [ -e "$path" ] || [ -L "$path" ] || continue
    find_failing_segment "$path"
    [ -n "$failing" ] || continue
    printf '%s\n' "yapus names: $path: $failing $RULE" >&2
    status=1
  done

  return "$status"
}

if ! command -v git >/dev/null 2>&1; then
  fail 'git not found; install git'
fi

# git's own first error line tells a directory outside any work tree from a
# repository git refuses, such as one owned by another user.
if ! top=$(git rev-parse --show-toplevel 2>/dev/null); then
  error=$(git rev-parse --show-toplevel 2>&1 >/dev/null)
  fail "$(pwd): ${error%%$'\n'*}"
fi

if ! cd -- "$top" 2>/dev/null; then
  fail "cannot enter $top; check its permissions"
fi

# No limit of its own on git: the CI job's timeout bounds the run.
git ls-files -z --cached --others --exclude-standard | check_paths
statuses=("${PIPESTATUS[@]}")

if [ "${statuses[0]}" -ne 0 ]; then
  fail "git ls-files failed with exit ${statuses[0]}; run it in $top to see why"
fi

[ "${statuses[1]}" -eq 0 ] || exit 2
