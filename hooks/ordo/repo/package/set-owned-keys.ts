import { getProjectDirectory } from '../../../shared/hooks-path/get-project-directory.ts';
import { getSection, type Section } from './get-section.ts';
import { setValue } from './set-value.ts';

const CHECK_SCRIPT =
  'tsc -p . && eslint --max-warnings 0 --flag unstable_native_nodejs_ts_config . '
  + `&& bash ${ getProjectDirectory() }/check-names.sh`;

// The keys both modes own: scripts.check, the devDependency pins,
// engines.node and type.
export function setOwnedKeys(root: Section, pins: Readonly<Record<string, string>>): void {
  setValue(getSection(root, 'scripts'), 'check', CHECK_SCRIPT);

  const devDependencies = getSection(root, 'devDependencies');

  Object.entries(pins).forEach(([name, version]) => {
    setValue(devDependencies, name, version);
  });

  setValue(getSection(root, 'engines'), 'node', '>=24');
  setValue(root, 'type', 'module');
}
