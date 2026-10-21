// An option of a gh action: pflag matches a long name exactly (no prefixes) and
// a flag takes no value except `=true` or `=false`.
export interface OptionSpec {
  readonly long: string;
  readonly short?: string;
  readonly kind: 'value' | 'flag';
}

// The options of one gh action, with where they were read from.
export interface ActionSpec {
  readonly command: string;
  readonly source: string;
  readonly options: readonly OptionSpec[];
}

export const ghCommands = {
  readerReasons: {
    unknownOption: (command: string, shown: string): string =>
      `\`${ command } ${ shown }\` is not an option the gate knows; a person runs it`,
    missingValue: (command: string, shown: string): string =>
      `\`${ command } ${ shown }\` has no value; write the value after the option`,
    badBoolean: (command: string, shown: string): string =>
      `\`${ command } ${ shown }\` takes only true or false; write \`${ shown }=true\``
      + ` or \`${ shown }=false\``,
  },
} as const;
