import { partForms } from '../../../../../shared/part-forms.ts';
import { ghCommands } from '../gh-commands.ts';

const FORM = new RegExp(`^(${ partForms.scope }): (\\S.*)$`);

export interface IssueTitle {
  readonly scope: string;
  readonly symptom: string;
}

// The scope and symptom of an issue title `<scope>: <symptom>` that is at most
// the longest title, or undefined. The scope is not looked up here.
export function readIssueTitle(title: string): IssueTitle | undefined {
  const [, scope, symptom] = FORM.exec(title) ?? [];

  return scope === undefined || symptom === undefined
    || Array.from(title).length > ghCommands.maxIssueTitle
    ? undefined
    : { scope, symptom };
}
