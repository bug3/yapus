import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isRecord } from '../../../../hooks/shared/is-record.ts';
import { findCall } from './find-call.ts';
import {
  FIXED_ARGS,
  SCRIPT_PATH,
  getFixedAnswer,
  getFollowUpAnswer,
} from './get-fixed-answer.ts';
import { runWorkflow } from './run-workflow.ts';
import type { AgentCall, WorkflowRun } from './run-workflow.ts';

const STAGE_TABLE_FIRST_LINE = '\nconst STAGES = {\n';
const STAGE_TABLE_LAST_LINE = '\n};\n';
const KINDS_FIRST_LINE = '\nconst KINDS = [\n';
const SOURCES_FIRST_LINE = '\nconst SOURCES = [\n';
const LIST_LAST_LINE = '\n];\n';
// Every model and every effort the workflow runtime takes, as a quoted name.
const MODEL_OR_EFFORT = /(['"`])(?:haiku|sonnet|opus|fable|low|medium|high|xhigh|max)\1/u;

// The keys of a row of the source catalog, the form of its id, and the start
// of each of its templates.
const SOURCE_KEYS = ['id', 'kind', 'hosts', 'use', 'templates'] as const;
const SOURCE_ID = /^[a-z0-9-]+$/u;
const TEMPLATE_START = 'https://';

// A placeholder of a template, in braces.
const PLACEHOLDER = /\{[^{}]*\}/u;

// The host of a URL ends at the first of these characters.
const HOST_END = /[/?#:]/u;

// The kinds of the test catalogs below, and a catalog the check passes: the
// host of its second row ends with the host of the first, but not after a
// dot.
const TEST_KINDS = ['code', 'discussions'] as const;
const PASSING_CATALOG = [
  {
    id: 'code-host',
    kind: 'code',
    hosts: ['example.com'],
    use: 'repositories and their files',
    templates: ['https://api.example.com/repos/{name}'],
  },
  {
    id: 'forum',
    kind: 'discussions',
    hosts: ['otherexample.com'],
    use: 'posts of one forum',
    templates: ['https://otherexample.com/search?q={terms}'],
  },
] as const;

// Catalogs the check blocks, each on one defect.
const DUPLICATE_ID_CATALOG = [
  PASSING_CATALOG[0],
  { ...PASSING_CATALOG[1], id: 'code-host' },
] as const;
const PLAIN_HTTP_CATALOG = [
  PASSING_CATALOG[0],
  { ...PASSING_CATALOG[1], templates: ['http://otherexample.com/search?q={terms}'] },
] as const;
const SHARED_HOST_CATALOG = [
  { ...PASSING_CATALOG[0], hosts: ['github.com'], templates: ['https://api.github.com/x'] },
  { ...PASSING_CATALOG[1], hosts: ['github.com'], templates: ['https://github.com/x'] },
] as const;
const ID_FORM_CATALOG = [PASSING_CATALOG[0], { ...PASSING_CATALOG[1], id: 'Forum' }] as const;
const UNKNOWN_KIND_CATALOG = [
  ...PASSING_CATALOG,
  {
    ...PASSING_CATALOG[1],
    id: 'news',
    kind: 'news',
    hosts: ['news.test'],
    templates: ['https://news.test/search?q={terms}'],
  },
] as const;
const KIND_WITHOUT_ROW_CATALOG = [PASSING_CATALOG[0]] as const;
const OFF_HOST_CATALOG = [
  PASSING_CATALOG[0],
  { ...PASSING_CATALOG[1], templates: ['https://example.org/search?q={terms}'] },
] as const;
const MALFORMED_ROW_CATALOG = [
  ...PASSING_CATALOG,
  { ...PASSING_CATALOG[1], status: 'open' },
] as const;
const HOST_PLACEHOLDER_CATALOG = [
  PASSING_CATALOG[0],
  {
    ...PASSING_CATALOG[1],
    hosts: ['{lang}.otherexample.com'],
    templates: ['https://{lang}.otherexample.com/search?q={terms}'],
  },
] as const;

interface CatalogRow {
  readonly id: string;
  readonly kind: string;
  readonly hosts: readonly string[];
  readonly use: string;
  readonly templates: readonly string[];
}

// How each workflow agent of the run on FIXED_ARGS runs, in the order of the
// labels: its label, then the agent type, the model and the effort its
// options name, with a dash for one they do not name.
const AGENTS_OF_FIXED_RUN = [
  'completeness delegator:reader opus high',
  'gather-repo:Q1 delegator:reader - -',
  'gather-repo:Q2 delegator:reader - -',
  'gather-repo:Q3 delegator:reader - -',
  'gather-web:Q4 delegator:web-researcher - -',
  'scope delegator:reader opus high',
  'synthesize - opus high',
  'verify-repo:Q1.C1 delegator:reader - -',
  'verify-repo:Q1.C2 delegator:reader - -',
  'verify-repo:Q2.C1 delegator:reader - -',
  'verify-web-third:Q4.C2.v3 delegator:web-researcher opus -',
  'verify-web:Q4.C1.v1 delegator:web-researcher - -',
  'verify-web:Q4.C2.v1 delegator:web-researcher - -',
  'verify-web:Q4.C2.v2 delegator:web-researcher - -',
] as const;

const RETURN_RULE =
  '- Return through the structured output alone: it is the one form of return here, in place of any other your rules name.';

// The label of one workflow agent of each stage that runs as a definition, in
// the run on FIXED_ARGS.
const DEFINITION_AGENT_LABELS = [
  'scope',
  'gather-repo:Q1',
  'gather-web:Q4',
  'verify-repo:Q1.C1',
  'verify-web:Q4.C1.v1',
  'verify-web-third:Q4.C2.v3',
  'completeness',
] as const;

// Those of them whose prompt holds the return rule before its last rule; the
// prompt of the web gather agent holds two rules after it.
const RULE_BEFORE_LAST_LABELS = DEFINITION_AGENT_LABELS.filter(
  (label) => label !== 'gather-web:Q4',
);

test('holds the approved meta', async () => {
  const run = await runWorkflow(SCRIPT_PATH, undefined, getFixedAnswer);

  assert.deepEqual(run.meta, {
    name: 'deep-dive',
    description:
      'Gather and verify the context of a task before its plan is written: questions, claims from the repository and the web, each checked against its source, and a research file beside the plan.',
    whenToUse:
      'When the person asks for a deep dive before a plan is written. Pass args as an object: task (the task in the person\'s words), directory (the plan\'s directory, .yapus/plans/<YYYY-MM>/<topic>, under the month that already holds the topic or else the current month, UTC), and optionally questions (a list the research must answer), paths (repository paths to start from) and lanes (a list: ["repository"], ["web"] or ["repository", "web"]; both lanes when absent).',
    phases: [
      { title: 'Scope', detail: '3 to 12 questions, each for the repository or the web' },
      {
        title: 'Gather',
        detail: 'one gather agent per question returns claims with their sources',
      },
      { title: 'Verify', detail: 'each claim checked against the lines or the page it cites' },
      {
        title: 'Completeness',
        detail:
          'unread areas, unanswered questions and up to 4 follow-up questions for one more round',
      },
      { title: 'Synthesize', detail: 'research_<digest>.md written beside the plan' },
    ],
  });
});

test('holds no import, no pipeline call and no workflow call', () => {
  assert.doesNotMatch(readFileSync(SCRIPT_PATH, 'utf8'), /import|pipeline\(|workflow\(/u);
});

test('names a model and an effort in the stage table', () => {
  assert.match(readStageTable().table, MODEL_OR_EFFORT);
});

test('names no model and no effort after the stage table', () => {
  assert.doesNotMatch(readStageTable().afterTable, MODEL_OR_EFFORT);
});

test('gives each workflow agent the agent type, model and effort of its stage', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(run.calls.map(describeAgent).toSorted(), AGENTS_OF_FIXED_RUN);
});

test('gives a follow-up gather agent the agent type, model and effort of its stage', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFollowUpAnswer);

  assert.deepEqual(
    run.calls
      .filter((call) => String(call.options.label).startsWith('follow-up'))
      .map(describeAgent)
      .toSorted(),
    ['follow-up-repo:F1 delegator:reader - -', 'follow-up-web:F2 delegator:web-researcher - -'],
  );
});

test('denies tools by name to the synthesize agent alone', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  const denyingCalls = run.calls.filter((call) => 'disallowedTools' in call.options);

  assert.deepEqual(denyingCalls.map((call) => call.options.label), ['synthesize']);
});

test('gives every workflow agent that runs as a definition the return rule once', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(
    DEFINITION_AGENT_LABELS.map((label) => listReturnRules(run, label)),
    DEFINITION_AGENT_LABELS.map(() => [RETURN_RULE]),
  );
});

test('puts the return rule on the line before the last rule of a prompt', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(
    RULE_BEFORE_LAST_LABELS.map((label) => findCall(run, label)?.prompt.split('\n').at(-2)),
    RULE_BEFORE_LAST_LABELS.map(() => RETURN_RULE),
  );
});

test('gives the synthesize agent no return rule', async () => {
  const run = await runWorkflow(SCRIPT_PATH, FIXED_ARGS, getFixedAnswer);

  assert.deepEqual(listReturnRules(run, 'synthesize'), []);
  assert.equal(findCall(run, 'synthesize')?.prompt.includes('\n## Rules\n'), true);
});

test('holds a source catalog the catalog check passes', () => {
  const kinds = readList(KINDS_FIRST_LINE);

  assert.ok(isTexts(kinds));
  assert.deepEqual(listCatalogProblems(readList(SOURCES_FIRST_LINE), kinds), []);
});

test('passes a catalog whose hosts end alike apart from a dot', () => {
  assert.deepEqual(listCatalogProblems(PASSING_CATALOG, TEST_KINDS), []);
});

test('blocks a catalog that holds one id twice', () => {
  assert.deepEqual(listCatalogProblems(DUPLICATE_ID_CATALOG, TEST_KINDS), [
    'code-host: the id stands in an earlier row',
  ]);
});

test('blocks a catalog with a template that does not start https://', () => {
  assert.deepEqual(listCatalogProblems(PLAIN_HTTP_CATALOG, TEST_KINDS), [
    'forum: the template http://otherexample.com/search?q={terms} does not start https://',
  ]);
});

test('blocks a catalog whose rows share a host', () => {
  assert.deepEqual(listCatalogProblems(SHARED_HOST_CATALOG, TEST_KINDS), [
    'code-host: the host github.com meets the host github.com of forum',
    'forum: the host github.com meets the host github.com of code-host',
  ]);
});

test('blocks a catalog with an id outside lowercase letters, digits and hyphens', () => {
  assert.deepEqual(listCatalogProblems(ID_FORM_CATALOG, TEST_KINDS), [
    'Forum: the id is not lowercase letters, digits and hyphens',
  ]);
});

test('blocks a catalog with a row of an unknown kind', () => {
  assert.deepEqual(listCatalogProblems(UNKNOWN_KIND_CATALOG, TEST_KINDS), [
    'news: the kind news is not a kind of the catalog',
  ]);
});

test('blocks a catalog with a kind that no row holds', () => {
  assert.deepEqual(listCatalogProblems(KIND_WITHOUT_ROW_CATALOG, TEST_KINDS), [
    'discussions: no row is of this kind',
  ]);
});

test('blocks a catalog with a template outside its row\'s hosts', () => {
  assert.deepEqual(listCatalogProblems(OFF_HOST_CATALOG, TEST_KINDS), [
    'forum: the template https://example.org/search?q={terms} is on none of its hosts',
  ]);
});

test('blocks a catalog with a row of another shape', () => {
  assert.deepEqual(listCatalogProblems(MALFORMED_ROW_CATALOG, TEST_KINDS), [
    'row 3: not a row of id, kind, hosts, use, templates alone',
  ]);
});

test('blocks a catalog with a placeholder in a host', () => {
  assert.deepEqual(listCatalogProblems(HOST_PLACEHOLDER_CATALOG, TEST_KINDS), [
    'forum: the host {lang}.otherexample.com holds a placeholder',
    'forum: the template https://{lang}.otherexample.com/search?q={terms} holds a placeholder in its host',
  ]);
});

// The label of a call, then the agent type, the model and the effort its
// options name, with a dash for one they do not name.
function describeAgent(call: AgentCall): string {
  const { label, agentType = '-', model = '-', effort = '-' } = call.options;

  return [label, agentType, model, effort].map((part) => String(part)).join(' ');
}

// The lines of the prompt of the call under `label` that name the structured
// output.
function listReturnRules(run: WorkflowRun, label: string): string[] {
  return (findCall(run, label)?.prompt ?? '')
    .split('\n')
    .filter((line) => line.includes('structured output'));
}

// The stage table of the script, from its first line through the line that
// closes it, and the text after that line.
function readStageTable(): { readonly table: string; readonly afterTable: string } {
  const scriptText = readFileSync(SCRIPT_PATH, 'utf8');
  const tableStart = scriptText.indexOf(STAGE_TABLE_FIRST_LINE);
  const tableEnd = scriptText.indexOf(STAGE_TABLE_LAST_LINE, tableStart);

  assert.notEqual(tableStart, -1);
  assert.notEqual(tableEnd, -1);

  return {
    table: scriptText.slice(tableStart, tableEnd),
    afterTable: scriptText.slice(tableEnd),
  };
}

// The JSON list of the script that opens on `firstLine`, through the first
// line that is `];` alone after it.
function readList(firstLine: string): unknown {
  const scriptText = readFileSync(SCRIPT_PATH, 'utf8');
  const listStart = scriptText.indexOf(firstLine);
  const listEnd = scriptText.indexOf(LIST_LAST_LINE, listStart);

  assert.notEqual(listStart, -1);
  assert.notEqual(listEnd, -1);

  return JSON.parse(`[\n${ scriptText.slice(listStart + firstLine.length, listEnd) }\n]`);
}

// What breaks the source catalog's rules, one line per problem: a list of
// rows, each with the keys of SOURCE_KEYS alone, a unique id of SOURCE_ID, a
// kind of `kinds`, a host, a use and a template; each kind held by a row;
// each template on https and on a host of its row; no placeholder in a host;
// no host of one row met by a host of another.
function listCatalogProblems(catalog: unknown, kinds: readonly string[]): string[] {
  if (!Array.isArray(catalog)) {
    return ['the catalog is not a list'];
  }

  const entries: readonly unknown[] = catalog;
  const rows = entries.map(readRow);
  const shapeProblems = rows.flatMap((row, index) =>
    row === undefined
      ? [`row ${ String(index + 1) }: not a row of ${ SOURCE_KEYS.join(', ') } alone`]
      : [],
  );
  const shapedRows = rows.filter((row) => row !== undefined);

  return [
    ...shapeProblems,
    ...listIdProblems(shapedRows),
    ...listKindProblems(shapedRows, kinds),
    ...shapedRows.flatMap(listTemplateProblems),
    ...shapedRows.flatMap(listPlaceholderProblems),
    ...listHostProblems(shapedRows),
  ];
}

// A row of the catalog, or undefined for an entry of another shape.
function readRow(entry: unknown): CatalogRow | undefined {
  if (!isRecord(entry) || Object.keys(entry).length !== SOURCE_KEYS.length) {
    return undefined;
  }

  const { id, kind, hosts, use, templates } = entry;

  if (
    typeof id !== 'string' ||
    typeof kind !== 'string' ||
    !isTexts(hosts) ||
    typeof use !== 'string' ||
    use === '' ||
    !isTexts(templates)
  ) {
    return undefined;
  }

  return { id, kind, hosts, use, templates };
}

// A list of at least one text, none of them empty.
function isTexts(texts: unknown): texts is string[] {
  return (
    Array.isArray(texts) &&
    texts.length > 0 &&
    texts.every((text) => typeof text === 'string' && text !== '')
  );
}

function listIdProblems(rows: readonly CatalogRow[]): string[] {
  return rows.flatMap(({ id }, index) => [
    ...(SOURCE_ID.test(id)
      ? []
      : [`${ id }: the id is not lowercase letters, digits and hyphens`]),
    ...(rows.findIndex((row) => row.id === id) < index
      ? [`${ id }: the id stands in an earlier row`]
      : []),
  ]);
}

function listKindProblems(rows: readonly CatalogRow[], kinds: readonly string[]): string[] {
  return [
    ...rows
      .filter(({ kind }) => !kinds.includes(kind))
      .map(({ id, kind }) => `${ id }: the kind ${ kind } is not a kind of the catalog`),
    ...kinds
      .filter((kind) => !rows.some((row) => row.kind === kind))
      .map((kind) => `${ kind }: no row is of this kind`),
  ];
}

function listTemplateProblems(row: CatalogRow): string[] {
  return row.templates.flatMap((template) => [
    ...(template.startsWith(TEMPLATE_START)
      ? []
      : [`${ row.id }: the template ${ template } does not start ${ TEMPLATE_START }`]),
    ...(row.hosts.some((host) => meetsHost(readHost(template), host))
      ? []
      : [`${ row.id }: the template ${ template } is on none of its hosts`]),
  ]);
}

// Each host of a row that holds a placeholder, and each template of the row
// whose host holds one.
function listPlaceholderProblems(row: CatalogRow): string[] {
  return [
    ...row.hosts
      .filter((host) => PLACEHOLDER.test(host))
      .map((host) => `${ row.id }: the host ${ host } holds a placeholder`),
    ...row.templates
      .filter((template) => PLACEHOLDER.test(readHost(template)))
      .map(
        (template) => `${ row.id }: the template ${ template } holds a placeholder in its host`,
      ),
  ];
}

// Each host of a row that a host of another row meets.
function listHostProblems(rows: readonly CatalogRow[]): string[] {
  return rows.flatMap((row) =>
    rows
      .filter((other) => other !== row)
      .flatMap((other) =>
        row.hosts.flatMap((host) =>
          other.hosts
            .filter((otherHost) => meetsHost(host, otherHost))
            .map(
              (otherHost) =>
                `${ row.id }: the host ${ host } meets the host ${ otherHost } of ${ other.id }`,
            ),
        ),
      ),
  );
}

// The host of a URL: the text after `://` up to the first character of
// HOST_END, lowercased.
function readHost(url: string): string {
  const afterScheme = url.slice(url.indexOf('://') + '://'.length);

  return afterScheme.split(HOST_END, 1)[0]?.toLowerCase() ?? '';
}

// Whether `host` is `rowHost` or a subdomain of it; a host that holds `@`
// meets none.
function meetsHost(host: string, rowHost: string): boolean {
  return !host.includes('@') && (host === rowHost || host.endsWith(`.${ rowHost }`));
}
