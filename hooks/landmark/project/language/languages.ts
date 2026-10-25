// The module exports a value as well as the type because a repository test
// wants each module to export the camelCase of its file name.
export const languages = ['typescript', 'go'] as const;

export type Language = (typeof languages)[number];
