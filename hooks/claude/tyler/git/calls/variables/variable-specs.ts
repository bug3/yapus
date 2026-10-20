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

export const variableSpecs = {
  variablePrograms: VARIABLE_PROGRAMS,
  programVariables: PROGRAM_VARIABLES,
  harmlessPrograms: HARMLESS_PROGRAMS,
};
