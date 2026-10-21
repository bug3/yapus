export interface Word {
  readonly text: string;
  readonly isLiteral: boolean;
}

export interface Split {
  readonly commands: readonly (readonly Word[])[];
  // One per command, in the same order: whether the command runs apart from the
  // ones after it (in parentheses, a pipeline or the background), so that a `cd`
  // there moves none of them.
  readonly isolated: readonly boolean[];
}

export interface SplitFailure {
  readonly failure: string;
}

interface Heredoc {
  readonly delimiter: string;
  readonly isTabStripped: boolean;
}

// What the next word is when it is no word of the command: a redirection target,
// or the delimiter of a heredoc.
type Target =
  | { readonly kind: 'drop' }
  | { readonly kind: 'heredoc'; readonly isTabStripped: boolean };

type Effect = 'sequence' | 'pipe' | 'background' | 'open' | 'close';

interface Operator {
  readonly text: string;
  readonly effect: Effect;
}

interface Redirection {
  readonly text: string;
  readonly target: Target;
}

// The state of one split: where it is, the word and command being read, and
// what it gave so far.
interface Scan {
  readonly source: string;
  index: number;
  depth: number;
  word: Word | undefined;
  words: Word[];
  isAfterPipe: boolean;
  target: Target | undefined;
  readonly heredocs: Heredoc[];
  readonly commands: (readonly Word[])[];
  readonly isolated: boolean[];
}

const DROP: Target = { kind: 'drop' };

// Longest first, so that the first match is the operator written.
const OPERATORS: readonly Operator[] = [
  { text: '&&', effect: 'sequence' },
  { text: '||', effect: 'sequence' },
  { text: ';', effect: 'sequence' },
  { text: '|', effect: 'pipe' },
  { text: '&', effect: 'background' },
  { text: '(', effect: 'open' },
  { text: ')', effect: 'close' },
];

// Longest first; `2>&1` and `&>` name file descriptors, not words of the command.
const REDIRECTIONS: readonly Redirection[] = [
  { text: '<<<', target: DROP },
  { text: '<<-', target: { kind: 'heredoc', isTabStripped: true } },
  { text: '<<', target: { kind: 'heredoc', isTabStripped: false } },
  { text: '&>>', target: DROP },
  { text: '&>', target: DROP },
  { text: '>>', target: DROP },
  { text: '>&', target: DROP },
  { text: '>|', target: DROP },
  { text: '<&', target: DROP },
  { text: '<>', target: DROP },
  { text: '>', target: DROP },
  { text: '<', target: DROP },
];

// The characters a backslash escapes inside double quotes.
const DOUBLE_QUOTE_ESCAPES: readonly string[] = ['"', '\\', '$', '`'];
const FILE_DESCRIPTOR = /^\d+$/u;
const LEADING_TABS = /^\t+/u;
const UNTERMINATED_HEREDOC = 'a heredoc has no delimiter line';

// The simple commands of a Bash command line, as words, in the order written.
// It reads quotes, escapes, comments, operators, redirections and heredoc bodies;
// any other expansion leaves its text in the word, which is then not literal.
// An unbalanced quote or an unterminated heredoc is a failure.
export function splitCommands(command: string): Split | SplitFailure {
  const scan: Scan = {
    source: command,
    index: 0,
    depth: 0,
    word: undefined,
    words: [],
    isAfterPipe: false,
    target: undefined,
    heredocs: [],
    commands: [],
    isolated: [],
  };

  while (scan.index < command.length) {
    const failure = readNext(scan);

    if (failure !== undefined) {
      return { failure };
    }
  }

  endCommand(scan, false);

  return scan.heredocs.length > 0
    ? { failure: UNTERMINATED_HEREDOC }
    : { commands: scan.commands, isolated: scan.isolated };
}

function readNext(scan: Scan): string | undefined {
  const character = scan.source.charAt(scan.index);

  switch (character) {
    case ' ':
    case '\t':
      endWord(scan);
      scan.index += 1;

      return undefined;
    case '\n':
      endCommand(scan, false);
      scan.index += 1;

      return skipHeredocBodies(scan);
    case '\\':
      readEscape(scan);

      return undefined;
    case '\'':
      return readSingleQuoted(scan);
    case '"':
      return readDoubleQuoted(scan);
    case '#':
      readHash(scan);

      return undefined;
    case '$':
    case '`':
      appendAndStep(scan, character, false);

      return undefined;
    case '~':
      // Only a tilde that starts a word expands.
      appendAndStep(scan, character, scan.word !== undefined);

      return undefined;
    case '<':
    case '>':
    case '&':
    case ';':
    case '|':
    case '(':
    case ')':
      readOperator(scan);

      return undefined;
    default:
      appendAndStep(scan, character, true);

      return undefined;
  }
}

function readEscape(scan: Scan): void {
  const escaped = scan.source.charAt(scan.index + 1);

  // A backslash before a line break joins the lines; one at the end is itself.
  if (escaped === '') {
    append(scan, '\\', true);
  } else if (escaped !== '\n') {
    append(scan, escaped, true);
  }

  scan.index += 2;
}

function readSingleQuoted(scan: Scan): string | undefined {
  const close = scan.source.indexOf('\'', scan.index + 1);

  if (close < 0) {
    return 'a single quote is not closed';
  }

  append(scan, scan.source.slice(scan.index + 1, close), true);
  scan.index = close + 1;

  return undefined;
}

function readDoubleQuoted(scan: Scan): string | undefined {
  const { source } = scan;
  let text = '';
  let isLiteral = true;
  let index = scan.index + 1;

  while (index < source.length) {
    const character = source.charAt(index);
    const next = source.charAt(index + 1);

    if (character === '"') {
      append(scan, text, isLiteral);
      scan.index = index + 1;

      return undefined;
    }

    if (character === '\\' && (next === '\n' || DOUBLE_QUOTE_ESCAPES.includes(next))) {
      text += next === '\n' ? '' : next;
      index += 2;
    } else {
      isLiteral &&= character !== '$' && character !== '`';
      text += character;
      index += 1;
    }
  }

  return 'a double quote is not closed';
}

function readHash(scan: Scan): void {
  if (scan.word !== undefined) {
    appendAndStep(scan, '#', true);

    return;
  }

  const lineEnd = scan.source.indexOf('\n', scan.index);

  scan.index = lineEnd < 0 ? scan.source.length : lineEnd;
}

function readOperator(scan: Scan): void {
  const redirection = REDIRECTIONS.find(({ text }) => scan.source.startsWith(text, scan.index));

  if (redirection !== undefined) {
    readRedirection(scan, redirection);

    return;
  }

  const operator = OPERATORS.find(({ text }) => scan.source.startsWith(text, scan.index));

  // readNext sends here only the first characters of an operator or a redirection.
  if (operator === undefined) {
    throw new Error(`no operator at ${ String(scan.index) }`);
  }

  scan.index += operator.text.length;
  applyEffect(scan, operator.effect);
}

function readRedirection(scan: Scan, redirection: Redirection): void {
  const isFileDescriptor = scan.word !== undefined && scan.word.isLiteral
    && FILE_DESCRIPTOR.test(scan.word.text);

  if (isFileDescriptor) {
    scan.word = undefined;
  }

  endWord(scan);
  scan.target = redirection.target;
  scan.index += redirection.text.length;
}

function applyEffect(scan: Scan, effect: Effect): void {
  switch (effect) {
    case 'sequence':
      endCommand(scan, false);

      return;
    case 'pipe':
      endCommand(scan, true);
      scan.isAfterPipe = true;

      return;
    case 'background':
      endCommand(scan, true);

      return;
    case 'open':
      endCommand(scan, false);
      scan.depth += 1;

      return;
    case 'close':
      endCommand(scan, false);
      scan.depth = Math.max(0, scan.depth - 1);
  }
}

// The bodies of the heredocs the line just ended opened, in order.
function skipHeredocBodies(scan: Scan): string | undefined {
  for (const heredoc of scan.heredocs.splice(0)) {
    const end = findBodyEnd(scan.source, scan.index, heredoc);

    if (end === undefined) {
      return UNTERMINATED_HEREDOC;
    }

    scan.index = end;
  }

  return undefined;
}

// Where the text after the delimiter line of a heredoc starts, or undefined.
function findBodyEnd(source: string, start: number, heredoc: Heredoc): number | undefined {
  let lineStart = start;

  while (lineStart < source.length) {
    const newline = source.indexOf('\n', lineStart);
    const lineEnd = newline < 0 ? source.length : newline;
    const line = source.slice(lineStart, lineEnd);
    const compared = heredoc.isTabStripped ? line.replace(LEADING_TABS, '') : line;

    if (compared === heredoc.delimiter) {
      return Math.min(lineEnd + 1, source.length);
    }

    lineStart = lineEnd + 1;
  }

  return undefined;
}

function appendAndStep(scan: Scan, text: string, isLiteral: boolean): void {
  append(scan, text, isLiteral);
  scan.index += 1;
}

function append(scan: Scan, text: string, isLiteral: boolean): void {
  scan.word = {
    text: `${ scan.word?.text ?? '' }${ text }`,
    isLiteral: (scan.word?.isLiteral ?? true) && isLiteral,
  };
}

function endWord(scan: Scan): void {
  const { word, target } = scan;

  if (word === undefined) {
    return;
  }

  scan.word = undefined;
  scan.target = undefined;

  if (target === undefined) {
    scan.words.push(word);
  } else if (target.kind === 'heredoc') {
    scan.heredocs.push({ delimiter: word.text, isTabStripped: target.isTabStripped });
  }
}

function endCommand(scan: Scan, isEndIsolated: boolean): void {
  endWord(scan);
  scan.target = undefined;

  if (scan.words.length === 0) {
    return;
  }

  scan.commands.push(scan.words);
  scan.isolated.push(scan.depth > 0 || scan.isAfterPipe || isEndIsolated);
  scan.words = [];
  scan.isAfterPipe = false;
}
