import { isLongOption } from '../../calls/git-runs/is-long-option.ts';
import { runnerSpecs } from '../../calls/runner-specs.ts';
import type { Word } from '../../shell/split-commands.ts';
import { bypassCatalog } from './bypass-catalog.ts';

const SHORT_GROUP = runnerSpecs.shortGroup;

// The `key=value` words of `git clone -c`, `-cKEY=V`, `-qc KEY=V`, `--config KEY=V` and
// `--config=KEY=V`, where `--config` may be cut to a prefix; `words` follow `clone`.
export function readCloneConfigs(words: readonly Word[]): Word[] {
  const configs: Word[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const value = word === undefined ? undefined : readConfigValue(word);

    if (value === 'next') {
      index += 1;
      configs.push(...words.slice(index, index + 1));
    } else if (value !== undefined) {
      configs.push(value);
    }
  }

  return configs;
}

// The config a word holds, `next` when it is the next word, or undefined.
function readConfigValue(word: Word): Word | 'next' | undefined {
  const { text } = word;

  if (isLongOption(text, bypassCatalog.cloneConfigOption)) {
    const equals = text.indexOf('=');

    return equals === -1 ? 'next' : { ...word, text: text.slice(equals + 1) };
  }

  if (!SHORT_GROUP.test(text)) {
    return undefined;
  }

  for (let index = 1; index < text.length; index += 1) {
    const letter = text.charAt(index);

    if (letter === bypassCatalog.cloneConfigLetter) {
      const rest = text.slice(index + 1);

      return rest === '' ? 'next' : { ...word, text: rest };
    }

    // The rest of the group is this option's value.
    if (bypassCatalog.cloneValueLetters.includes(letter)) {
      return undefined;
    }
  }

  return undefined;
}
