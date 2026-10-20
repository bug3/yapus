// A token before and after `git`, `gh` or `git-<name>`; a path, quote, assignment, shell
// operator, brace or glob may stand beside it, a dot or a letter may not.
const GIT_MENTION =
  /(?:^|[\s;&|()<>`/={},*?[\]])(?:git(?:-[a-z0-9-]*)?|gh)(?=$|[\s;&|()<>`{},*?[\]])/iu;

// Backslashes and quotes join pieces of a word in the shell (`g\it`, `g''it`).
const JOINERS = /[\\'"]/gu;

// Whether the text names git or gh as a word, so a command the gate cannot read
// still gets refused when it may run one.
export function mentionsGit(text: string): boolean {
  return GIT_MENTION.test(text.replace(JOINERS, ''));
}
