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

// The literal values of a program variable that run nothing the gate must read.
const HARMLESS_PROGRAMS: readonly string[] = ['true', ':', 'cat', ''];

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

export const variableSpecs = {
  variablePrograms: VARIABLE_PROGRAMS,
  programVariables: PROGRAM_VARIABLES,
  harmlessPrograms: HARMLESS_PROGRAMS,
  arithmeticPrograms: ARITHMETIC_PROGRAMS,
  integerPrograms: INTEGER_PROGRAMS,
  integerOption: INTEGER_OPTION,
  testCommand: TEST_COMMAND,
  arithmeticOperators: ARITHMETIC_OPERATORS,
  evaluated: EVALUATED,
};
