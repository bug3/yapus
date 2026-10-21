import { readScanner, SCANNER_PATH } from '../../../../shared/scanner/read-scanner.ts';

// The scanner the gate runs, read once, or the reason it cannot be read.
export const gateScanner = await readScanner(SCANNER_PATH);
