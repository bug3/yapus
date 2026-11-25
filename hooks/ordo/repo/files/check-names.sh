#!/usr/bin/env bash
set -u

# Checks every segment of every path git keeps in the work tree, tracked or
# untracked but not ignored, from its top level. A segment passes when it is
# lowercase words joined by hyphens, parts by underscores, with a UTC time
# such as 2026-04-11T22-06-47Z as one word, when it is in the uppercase class
# of names such as README.md, or when a tool owns it. Go and Python files are
# skipped, their folders are not. It exits 0 when every path passes and 2
# otherwise, with one stderr line per failing path.

# The ranges below mean ASCII letters only in the C locale.
export LC_ALL=C

readonly UTC_TIME='[0-9]+(-[0-9]+)*T[0-9]+(-[0-9]+)*Z'
readonly UNIT="([a-z0-9]+|$UTC_TIME)"
readonly WORD="$UNIT(-$UNIT)*"
readonly NAME="$WORD(_$WORD)*"
readonly CHOSEN="^\\.?$NAME(\\.$NAME)*$"
readonly UPPERCASE='^[A-Z][A-Z0-9]*([_-][A-Z0-9]+)*(\.[a-z0-9]+(-[A-Za-z0-9]+)*)*$'
readonly NEXT_PAGE='^_(app|document|error)(\.[a-z0-9]+)+$'
readonly NEXT_APP_FOLDER="^(_$NAME|\\($NAME\\)|@$NAME)/$"
readonly UNDERSCORE_FOLDER="^_$NAME/$"
readonly BRACKET_ROUTE='^\[[][A-Za-z0-9._-]+\](\.[a-z0-9]+)*$'
readonly SASS_PARTIAL="^_$NAME\\.(scss|sass)$"
# No segment holds a slash.
readonly SKIP_BELOW=/
readonly RULE='is not lowercase words joined by hyphens, parts by underscores; rename it'

fail() {
  printf '%s\n' "yapus names: $1" >&2
  exit 2
}

# A name a tool fixes. A folder is given with a trailing slash, and parent is
# the folders above the segment, each with a trailing slash.
is_tool_owned() {
  local segment=$1 parent=/$2

  case $segment in
    Makefile | Dockerfile | _index.md | .DS_Store) return 0 ;;
    __tests__/ | __mocks__/ | __snapshots__/ | __pycache__/) return 0 ;;
    # Jekyll's site files: https://jekyllrb.com/docs/structure/
    _config.yml | _data/ | _drafts/ | _includes/ | _layouts/ | _posts/ | _sass/) return 0 ;;
    Cargo.lock | Cargo.toml | Chart.lock | Chart.yaml) return 0 ;;
    CMakeLists.txt | CMakePresets.json | CMakeUserPresets.json) return 0 ;;
    Project.toml | JuliaProject.toml | Manifest.toml | JuliaManifest.toml) return 0 ;;
  esac

  # Hugo's template folders, such as _default and _partials:
  # https://gohugo.io/templates/new-templatesystem-overview/
  case $parent in
    */layouts/*) [[ $segment =~ $UNDERSCORE_FOLDER ]] && return 0 ;;
  esac

  # Next.js's private folders, route groups and parallel routes:
  # https://nextjs.org/docs/app/getting-started/project-structure
  case $parent in
    */app/*) [[ $segment =~ $NEXT_APP_FOLDER ]] && return 0 ;;
  esac

  # The go tool ignores a folder whose name starts with an underscore:
  # https://pkg.go.dev/cmd/go
  if [ "$IN_GO_MODULE" = 1 ] && [[ $segment =~ $UNDERSCORE_FOLDER ]]; then
    return 0
  fi

  # Next.js's _app, _document and _error pages:
  # https://nextjs.org/docs/pages/getting-started/project-structure
  [[ ${segment%/} =~ $NEXT_PAGE ]] || [[ ${segment%/} =~ $BRACKET_ROUTE ]] || [[ ${segment%/} =~ $SASS_PARTIAL ]]
}

is_passing() {
  [[ ${1%/} =~ $CHOSEN ]] || [[ ${1%/} =~ $UPPERCASE ]] || is_tool_owned "$1" "$2"
}

# The folder at each depth of the last path that reached it, with its verdict:
# nothing when it passes, SKIP_BELOW when the paths below it are skipped, or
# its failing name. check_paths gives the paths in sorted order, so the paths
# of a folder come together and each folder is judged once.
folders=()
verdicts=()

# Sets failing to the first segment of path that fails, or to nothing when
# every segment passes; a global, not stdout, spares a subshell per path.
find_failing_segment() {
  local rest=$1 folder='' parent segment depth=0
  failing=''

  while [ "${rest#*/}" != "$rest" ]; do
    segment=${rest%%/*}/
    rest=${rest#*/}
    parent=$folder
    folder=$folder$segment

    if [ "${folders[depth]-}" != "$folder" ]; then
      folders[depth]=$folder
      verdicts[depth]=''

      # Go reads the files below testdata as test input and go mod vendor
      # writes the ones below vendor, whatever their names.
      case $segment in
        testdata/ | vendor/) verdicts[depth]=$SKIP_BELOW ;;
        *) is_passing "$segment" "$parent" || verdicts[depth]=${segment%/} ;;
      esac
    fi

    case ${verdicts[depth]} in
      '') ;;
      "$SKIP_BELOW") return 0 ;;
      *) failing=${verdicts[depth]}; return 0 ;;
    esac

    depth=$((depth + 1))
  done

  case $rest in
    *.go | *.py | *.pyi) return 0 ;;
  esac

  is_passing "$rest" "$folder" || failing=$rest
}

# Reads the untracked paths, an empty record, then the tracked paths, each list
# sorted and NUL-separated, and checks them merged in one sorted order; returns
# 1 when any path fails. During a merge, git lists a conflicted path once per
# stage, one after another.
check_paths() {
  local path tracked previous='' status=0 next=0
  local -a untracked=()

  while IFS= read -r -d '' path && [ -n "$path" ]; do
    untracked[${#untracked[@]}]=$path
  done

  IFS= read -r -d '' tracked || tracked=''

  while [ -n "$tracked" ] || [ "$next" -lt "${#untracked[@]}" ]; do
    if [ "$next" -lt "${#untracked[@]}" ] &&
      { [ -z "$tracked" ] || [[ ${untracked[next]} < $tracked ]]; }; then
      path=${untracked[next]}
      next=$((next + 1))
    else
      path=$tracked
      IFS= read -r -d '' tracked || tracked=''
    fi

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
  fail "$(pwd): ${error%%$'\n'*}; run it inside a git work tree, or run git status there to see why"
fi

if ! cd -- "$top" 2>/dev/null; then
  fail "cannot enter $top; check its permissions"
fi

# A go.mod at the top level marks a Go module.
if [ -e go.mod ]; then
  readonly IN_GO_MODULE=1
else
  readonly IN_GO_MODULE=0
fi

# No limit of its own on git: the CI job's timeout bounds the run. An empty
# record, which no path is, ends the untracked list.
{
  git ls-files -z --others --exclude-standard || exit
  printf '\0'
  git ls-files -z --cached
} | check_paths
statuses=("${PIPESTATUS[@]}")

if [ "${statuses[0]}" -ne 0 ]; then
  fail "git ls-files failed with exit ${statuses[0]}; run it in $top to see why"
fi

[ "${statuses[1]}" -eq 0 ] || exit 2
