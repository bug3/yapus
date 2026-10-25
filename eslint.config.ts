import { defineConfig } from 'eslint/config';
import base from './hooks/landmark/project/files/eslint.config.ts';

// The entry file of a hook ends the process, so only number parsing stays
// restricted there.
const NUMBER_PARSING = [
  { object: 'Number', property: 'parseInt', message: 'Convert with Number().' },
  { object: 'Number', property: 'parseFloat', message: 'Convert with Number().' },
] as const;

export default defineConfig(
  base,
  {
    files: ['hooks/**/main.ts'],
    rules: {
      'no-restricted-properties': ['error', ...NUMBER_PARSING],
    },
  },
);
