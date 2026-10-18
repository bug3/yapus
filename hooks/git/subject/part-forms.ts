// The form of each part of a subject, as a regular expression source; a word
// in the catalog of a part takes the same form.
export const partForms = {
  type: '[a-z]+',
  scope: '[a-z0-9-]+',
  verb: '[a-z]+',
} as const;
