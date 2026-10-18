// git commit -v writes the staged diff below this line; git drops it all.
const SCISSORS_LINE = '# ------------------------ >8 ------------------------';

export interface Subject {
  readonly subject: string;
}

export interface SubjectViolation {
  readonly violation: string;
}

// Without an editor git keeps lines starting with # as content.
export function getSubject(
  messageText: string,
  isEditorUsed: boolean,
): Subject | SubjectViolation {
  const lines = messageText.split('\n');
  const contentLines = isEditorUsed ? dropComments(lines) : lines;

  const subjectIndex = contentLines.findIndex((line) => !isBlank(line));
  const [subjectLine, nextLine] = subjectIndex === -1 ? [] : contentLines.slice(subjectIndex);

  if (subjectLine === undefined) {
    return { violation: 'the message is empty; write a subject line' };
  }

  const isBodySeparated = nextLine === undefined || isBlank(nextLine);

  if (!isBodySeparated) {
    return {
      violation: 'the line after the subject is not blank; leave it empty before the body',
    };
  }

  return { subject: subjectLine.trimEnd() };
}

function dropComments(lines: readonly string[]): string[] {
  const scissorsIndex = lines.indexOf(SCISSORS_LINE);
  const keptLines = scissorsIndex === -1 ? lines : lines.slice(0, scissorsIndex);

  return keptLines.filter((line) => !line.startsWith('#'));
}

function isBlank(line: string): boolean {
  return line.trim() === '';
}
