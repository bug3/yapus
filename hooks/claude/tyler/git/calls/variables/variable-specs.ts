// Programs that set, export or remove the variables they name.
const VARIABLE_PROGRAMS: readonly string[] = [
  'export',
  'declare',
  'typeset',
  'local',
  'readonly',
  'unset',
];

// Variables whose value git or ssh runs as a program.
const PROGRAM_VARIABLES: readonly string[] = [
  'GIT_SEQUENCE_EDITOR',
  'GIT_EDITOR',
  'EDITOR',
  'VISUAL',
  'GIT_EXTERNAL_DIFF',
  'GIT_SSH_COMMAND',
  'GIT_SSH',
  'GIT_ASKPASS',
  'SSH_ASKPASS',
  'GIT_PROXY_COMMAND',
  'GIT_EXEC_PATH',
  'GIT_PAGER',
  'PAGER',
];

// Variables that name hooks git installs (`git clone`, `git init`); no value passes.
const HOOK_VARIABLES: readonly string[] = ['GIT_TEMPLATE_DIR'];

// The literal values of a program variable that run nothing the gate must read.
const HARMLESS_PROGRAMS: readonly string[] = ['true', ':', 'cat', ''];

// What may follow a program variable's name in a word that sets it.
const WATCHED_SUFFIXES: readonly string[] = ['=', '+=', '[', '++', '--'];

// Options of these programs holding `n` make a name refer to another variable.
const NAMEREF_PROGRAMS: readonly string[] = ['declare', 'typeset', 'local'];
const NAMEREF_OPTION = /^-[A-Za-z]*n/;

// Programs whose operands the shell evaluates as arithmetic, and programs that do so with
// an option holding `i` (`declare -i`), where `a[$(cmd)]` runs cmd.
const ARITHMETIC_PROGRAMS: readonly string[] = ['let', 'integer'];
const INTEGER_PROGRAMS: readonly string[] = ['declare', 'typeset', 'local'];
const INTEGER_OPTION = /^-[A-Za-z]*i/;

// `[[` evaluates the operands of these operators as arithmetic.
const TEST_COMMAND = '[[';
const ARITHMETIC_OPERATORS: readonly string[] = ['-eq', '-ne', '-lt', '-le', '-gt', '-ge'];

// A word that runs a command when the shell evaluates it as arithmetic.
const EVALUATED = /\$\(|`|\$\{/;

// A literal subscript holding one: arithmetic evaluates a variable's value again, so
// `x='a[$(cmd)]'; (( x ))` runs cmd with no substitution in the arithmetic word.
const DEFERRED_SUBSCRIPT = /\[.*(?:\$\(|`|\$\{)/;

export const variableSpecs = {
  variablePrograms: VARIABLE_PROGRAMS,
  programVariables: PROGRAM_VARIABLES,
  harmlessPrograms: HARMLESS_PROGRAMS,
  hookVariables: HOOK_VARIABLES,
  watchedSuffixes: WATCHED_SUFFIXES,
  namerefPrograms: NAMEREF_PROGRAMS,
  namerefOption: NAMEREF_OPTION,
  arithmeticPrograms: ARITHMETIC_PROGRAMS,
  integerPrograms: INTEGER_PROGRAMS,
  integerOption: INTEGER_OPTION,
  testCommand: TEST_COMMAND,
  arithmeticOperators: ARITHMETIC_OPERATORS,
  evaluated: EVALUATED,
  deferredSubscript: DEFERRED_SUBSCRIPT,
};
