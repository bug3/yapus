// The longest topic name: a topic of a few words fits, and the paths of five
// plans stay a small part of the recall's budget.
const MAX_LENGTH = 64;

// A name in the form of NAME-1 in standards/NAMES.md: words of lowercase
// ASCII letters and digits, a hyphen between the words of a part and an
// underscore between parts, so a committed plan directory passes the name
// check. It starts with a letter or a digit, so '.', '..' and a hidden name
// are no topic. A name reaches the main agent as context, so one from a
// repository the person did not write cannot carry a space, a line break or
// punctuation that reads as an instruction or splits one path into two.
const TOPIC_NAME = /^[a-z0-9]+([-_][a-z0-9]+)*$/u;

export function isTopicName(name: string): boolean {
  return name.length <= MAX_LENGTH && TOPIC_NAME.test(name);
}
