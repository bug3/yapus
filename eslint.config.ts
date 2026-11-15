import { defineConfig } from 'eslint/config';
import base, { NUMBER_PARSING } from './hooks/ordo/repo/files/typescript/eslint.config.ts';

export default defineConfig(
  base,
  // The entry file of a hook ends the process, so only number parsing stays
  // restricted there.
  {
    files: ['hooks/**/main.ts'],
    rules: {
      'no-restricted-properties': ['error', ...NUMBER_PARSING],
    },
  },
);
