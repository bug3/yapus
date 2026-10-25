import type { Template } from '../../../../../hooks/landmark/project/files/read-templates.ts';

export const templates: readonly Template[] = [
  { target: '.landmark/eslint.config.ts', kind: 'owned', text: 'base lint' },
  { target: '.github/workflows/landmark.yml', kind: 'owned', text: 'workflow' },
  { target: 'eslint.config.ts', kind: 'wrapper', text: 'wrapper lint' },
];
