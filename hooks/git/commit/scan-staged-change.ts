import { getScanVerdict, type ScanVerdict } from '../../shared/scanner/get-scan-verdict.ts';
import { runScanner } from '../../shared/scanner/run-scanner.ts';

// The verdict on the staged change of the repository at cwd. The scanner
// keeps git's own environment: for a commit that names files, git points
// GIT_INDEX_FILE at the index the commit will use, and the scan must read it.
export async function scanStagedChange(
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<ScanVerdict> {
  const outcome = await runScanner({ subcommand: ['git', '--staged'], cwd, env });

  return getScanVerdict(outcome, 'the staged change');
}
