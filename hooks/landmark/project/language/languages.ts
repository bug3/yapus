// The module exports a value as well as the type because a repository test
// wants each module to export the camelCase of its file name.
export const languages = ['typescript', 'go'] as const;

export type Language = (typeof languages)[number];

// The language an install takes when none is requested, and an upgrade takes
// when none is recorded.
export const DEFAULT_LANGUAGE: Language = 'typescript';
