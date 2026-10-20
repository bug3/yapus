// A token before and after `git`, `gh` or `git-<name>`; a path, quote, assignment or
// shell operator may stand beside it, a dot or a letter may not.
const GIT_MENTION = /(?:^|[\s;&|()<>`'"/=])(?:git(?:-[a-z0-9-]*)?|gh)(?=$|[\s;&|()<>`'"])/iu;

// Whether the text names git or gh as a word, so a command the gate cannot read
// still gets refused when it may run one.
export function mentionsGit(text: string): boolean {
  return GIT_MENTION.test(text);
}
