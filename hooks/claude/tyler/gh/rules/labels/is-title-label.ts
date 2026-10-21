import { labelNames } from '../../../../../shared/labels/read-labels.ts';

// Whether the label states something the title of a pull request already says.
export function isTitleLabel(name: string): boolean {
  return name.startsWith(labelNames.typePrefix)
    || name.startsWith(labelNames.scopePrefix)
    || name === labelNames.breaking;
}
