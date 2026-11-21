// The longest topic name, in UTF-16 units: a topic of a few words fits, and
// the paths of five plans stay a small part of the recall's budget.
const MAX_LENGTH = 64;

// A plain name: letters, combining marks and digits of any script, '.', '-'
// and '_', starting with a letter or a digit, so '.', '..' and a hidden name
// are no topic. A name reaches the main agent as context, so one from a
// repository the person did not write cannot carry a space, a line break or
// punctuation that reads as an instruction or splits one path into two.
const TOPIC_NAME = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}._-]*$/u;

export function isTopicName(name: string): boolean {
  return name.length <= MAX_LENGTH && TOPIC_NAME.test(name);
}
