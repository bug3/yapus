import { isLongOption } from '../../calls/git-runs/is-long-option.ts';
import type { Word } from '../../shell/split-commands.ts';
import { getUnreadableReason } from '../get-unreadable-reason.ts';
import { bypassCatalog } from './bypass-catalog.ts';
import { getKeyRefusal } from './get-key-refusal.ts';
import { readCloneConfigs } from './read-clone-configs.ts';

// A reason to refuse `git clone` or `git init` for a `--template` that installs hooks or
// a `git clone -c` key the agent may not set, or undefined; `words` follow the subcommand.
export function getCloneRefusal(subcommand: string, words: readonly Word[]): string | undefined {
  const isTemplated = bypassCatalog.templateSubcommands.some((name) => name === subcommand)
    && words.some((word) => isLongOption(word.text, bypassCatalog.templateOption));

  if (isTemplated) {
    return bypassCatalog.reasons.template;
  }

  if (subcommand !== 'clone') {
    return undefined;
  }

  for (const config of readCloneConfigs(words)) {
    const reason = config.isOpaque
      ? getUnreadableReason('git clone')
      : getKeyRefusal(config.text.split('=')[0] ?? '');

    if (reason !== undefined) {
      return reason;
    }
  }

  return undefined;
}
