import { partForms } from '../part-forms.ts';

// An optional `!` before the colon marks a breaking change.
const FORM = new RegExp(
  `^(${ partForms.type })\\((${ partForms.scope })\\)(!?): (${ partForms.verb })(?: .+)?$`,
);

export interface SubjectParts {
  readonly type: string;
  readonly scope: string;
  readonly verb: string;
  readonly isBreaking: boolean;
}

// The parts of a subject in the form `type(scope): verb ...`, or undefined.
export function readSubjectParts(subject: string): SubjectParts | undefined {
  const [, type, scope, bang, verb] = FORM.exec(subject) ?? [];

  return type === undefined || scope === undefined || verb === undefined
    ? undefined
    : { type, scope, verb, isBreaking: bang === '!' };
}
