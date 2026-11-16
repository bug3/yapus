import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const VITEPRESS = join(ROOT, 'node_modules', 'vitepress', 'bin', 'vitepress.js');
const BUILD_TIMEOUT_MS = 120000;
const HOME_PAGE = 'index.html';
const README_PAGES: readonly string[] = [
  HOME_PAGE,
  'quick-start.html',
  'delegator.html',
  'ordo.html',
];
const HEADING_2_ID = /<h2 id="([^"]+)"/gu;
const HEADING_1_ID = '<h1 id=';
const INTERNAL_ADDRESS = /(?<=href=")\/[^"#]*/gu;
const DIRECTORY_END = /\/$/u;
// The hero text, the tagline and the description, as the home page holds them.
const HOME_LINES: readonly RegExp[] = [
  /(?<=<span class="text"[^>]*>)[^<]+/u,
  /(?<=<p class="tagline"[^>]*>)[^<]+/u,
  /(?<=<meta name="description" content=")[^"]+/u,
];

// One build serves every test in the file; its output stays out of the
// repository.
const OUT_DIR = mkdtempSync(join(tmpdir(), 'yapus-site-'));
const build = spawnSync(process.execPath, [VITEPRESS, 'build', 'docs', '--outDir', OUT_DIR], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: BUILD_TIMEOUT_MS,
});

after(() => {
  rmSync(OUT_DIR, { recursive: true, force: true });
});

test('builds the site with exit code 0', () => {
  assert.equal(build.status, 0, build.stderr);
});

test('builds one page per README section and per standard', () => {
  const pages = readdirSync(OUT_DIR, { encoding: 'utf8', recursive: true })
    .filter((path) => path.endsWith('.html') && path !== '404.html')
    .sort();

  assert.deepEqual(pages, getPages().sort());
});

test('gives each README page its own section alone', () => {
  const sections = README_PAGES
    .map((page) => readPage(page).matchAll(HEADING_2_ID))
    .map((matches) => [...matches].map((match) => match[1]));

  assert.deepEqual(sections, [['features'], ['quick-start'], ['delegator'], ['ordo']]);
});

test('gives every standard page its title', () => {
  const untitled = getStandardPages()
    .filter((page) => !readPage(page).includes(HEADING_1_ID));

  assert.deepEqual(untitled, []);
});

test('links every internal address to a built file', () => {
  const dead = getPages()
    .flatMap((page) => getLinkedFiles(readPage(page)))
    .filter((path) => !existsSync(join(OUT_DIR, path)));

  assert.deepEqual([...new Set(dead)], []);
});

test('takes the hero lines and the description from the README', () => {
  const home = readPage(HOME_PAGE);
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  const lines = HOME_LINES.map((pattern) => pattern.exec(home)?.[0]);

  assert.deepEqual(lines.filter((line) => line !== undefined && readme.includes(line)), lines);
});

function getPages(): string[] {
  return [...README_PAGES, ...getStandardPages()];
}

function getStandardPages(): string[] {
  return readdirSync(join(ROOT, 'standards'))
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => `standards/${ name.slice(0, -'.md'.length) }.html`);
}

// The files the internal links of a page name: an address without its
// fragment, a directory as its index.html.
function getLinkedFiles(html: string): string[] {
  return [...html.matchAll(INTERNAL_ADDRESS)]
    .map((match) => match[0].replace(DIRECTORY_END, `/${ HOME_PAGE }`));
}

function readPage(path: string): string {
  return readFileSync(join(OUT_DIR, path), 'utf8');
}
