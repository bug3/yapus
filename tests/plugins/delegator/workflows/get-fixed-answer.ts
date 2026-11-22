import { join } from 'node:path';
import type { AgentCall } from './run-workflow.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

export const SCRIPT_PATH = join(ROOT, 'plugins', 'delegator', 'workflows', 'deep-dive.js');

// What the runtime gives a script for a workflow agent that was skipped or
// died; the lint refuses the literal.
export const JSON_NULL: unknown = JSON.parse('null');

// The input of the run whose prompts and lines the tests write out whole.
export const FIXED_ARGS = {
  task: 'Add a retry limit to the return gate',
  directory: '.yapus/plans/2026-11/return-retry',
  questions: [
    'Where does the return gate count a send-back?',
    'What does Claude Code do when a SubagentStop hook blocks twice?',
  ],
  paths: ['hooks/claude/gates/return', 'plugins/delegator/hooks/hooks.json'],
} as const;

// The lines a prompt of a run with the web lane gives the catalog of sources
// in, one for each row in its order, its id, kind and use as the plan's
// catalog table writes them.
export const SOURCE_LINES = [
  'arxiv (papers): preprints in physics, mathematics, computer science and nearby fields; quote the abs page, not the PDF',
  'openalex (papers): scholarly works of every field, with citation counts',
  'crossref (papers): metadata of published works, found by title or reference text',
  'europepmc (papers): life-science and medical literature',
  'pubmed (papers): biomedical papers: ids by search, then abstracts',
  'opencitations (papers): citation counts of a DOI',
  'biorxiv (papers): biology and medicine preprints by DOI; the server is biorxiv or medrxiv',
  'github (code): public repositories, files, issues, discussions, releases and advisories; 60 API requests an hour per address',
  'sourcegraph (code): code search across public repositories',
  'devdocs (docs): language and framework reference pages by DevDocs slug, such as python~3.13',
  'readthedocs (docs): search inside a project hosted on Read the Docs',
  'mdn (docs): the web platform: HTML, CSS, JavaScript and browser APIs',
  'microsoft-learn (docs): Microsoft and Azure documentation',
  'docs-rs (docs): Rust crate documentation',
  'claude-docs (docs): the Claude API and SDK documentation index',
  'npm (packages): npm package metadata, with its repository and homepage',
  'pypi (packages): Python package metadata; the version form lists its known vulnerabilities',
  'crates (packages): Rust crate metadata and versions',
  'go (packages): Go packages, their versions and vulnerabilities',
  'deps-dev (packages): licenses and advisories of a package version, across ecosystems',
  'osv (packages): one vulnerability record by its id, such as a GHSA id',
  'huggingface (models): machine-learning models and datasets',
  'nvd (advisories): CVE records with severity scores; 5 requests per 30 seconds',
  'cisa-kev (advisories): vulnerabilities known to be exploited; one large file, so ask it about one CVE',
  'endoflife (advisories): release and end-of-life dates of products',
  'hn (discussions): Hacker News stories and their comments',
  'lobsters (discussions): Lobsters stories by tag, with no search',
  "discourse-meta (discussions): the Discourse project's own forum",
  'mastodon (discussions): public posts on mastodon.social by hashtag',
  'bluesky (discussions): Bluesky accounts and their posts, with no post search',
  'lemmy (discussions): posts on lemmy.world',
  "wikipedia (overviews): English Wikipedia: search, then an article's summary",
  'wikidata (overviews): structured facts about entities by Q-id',
  'dbpedia (overviews): Wikipedia infobox facts as data; long answers',
  'rfc-editor (standards): RFC metadata and text, with section anchors',
  'ietf-datatracker (standards): RFCs and Internet-Drafts by name',
  'w3c (standards): W3C specifications and their status',
  'whatwg (standards): WHATWG living standards, such as HTML and Fetch',
  'ecmascript (standards): the ECMAScript language specification draft',
  'iana (standards): IANA registries, such as HTTP status codes and media types',
] as const;

// The ids of the catalog in its order: the first word of each of its lines.
export const SOURCE_IDS = SOURCE_LINES.map((line) => line.slice(0, line.indexOf(' ')));

// The paths a test gives where the script judges one: five that may lead
// out of the repository, each in a form of its own, then two that stay
// inside it.
export const MIXED_PATHS = [
  '/etc/hosts',
  '../x.ts',
  'hooks/../../x.ts',
  '\\x.ts',
  'C:\\x.ts',
  'hooks/run.sh',
  'a..b/x.ts',
] as const;

// What each workflow agent of the run on FIXED_ARGS returns, by its label.
// The web question names one source twice; the gather agent of the third
// question has no answer; the claims come out as one verified, one refuted
// and one undecided for the repository, and for the web one verified by its
// first vote and one by the third; the completeness agent writes no
// follow-up question; the file is written.
const FIXED_ANSWERS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['scope', {
    questions: [
      {
        lane: 'repository',
        question: 'Where does the return gate count a send-back?',
        startAt: ['hooks/claude/gates/return'],
      },
      {
        lane: 'repository',
        question: 'Which hook entries run the return gate?',
        startAt: ['plugins/delegator/hooks/hooks.json'],
      },
      { lane: 'repository', question: 'Which tests hold the verdicts of the return gate?' },
      {
        lane: 'web',
        question: 'What does Claude Code do when a SubagentStop hook blocks twice?',
        sources: ['github', 'hn', 'github'],
      },
    ],
  }],
  ['gather-repo:Q1', {
    claims: [
      {
        claim: 'The return gate sends a return over the limit back once.',
        path: 'hooks/claude/gates/return/get-return-verdict.ts',
        line: 31,
        endLine: 31,
        excerpt: 'const isOver = length > RETURN_CAP_CHARACTERS;',
      },
      {
        claim: 'The return gate keeps a count of send-backs for each session.',
        path: 'hooks/claude/gates/return/main.ts',
        line: 12,
        endLine: 12,
        excerpt: 'const sendBacks = countSendBacks(session);',
      },
    ],
    notSearched: ['hooks/claude/delegator/status'],
  }],
  ['gather-repo:Q2', {
    claims: [
      {
        claim: 'The SubagentStop entry runs the return gate for the delegator agents.',
        path: 'plugins/delegator/hooks/hooks.json',
        line: 412,
        endLine: 412,
        excerpt: '"matcher": "^delegator:"',
      },
    ],
    notSearched: [],
  }],
  ['gather-web:Q4', {
    claims: [
      {
        claim: 'A SubagentStop hook that exits with code 2 keeps the subagent running.',
        url: 'https://code.claude.com/docs/en/hooks',
        quote: 'Exit code 2 blocks the stop and shows stderr to the subagent',
      },
      {
        claim: 'Claude Code stops a subagent that a hook blocks twice in a row.',
        url: 'https://code.claude.com/docs/en/sub-agents',
        quote: 'a subagent whose stop is blocked twice is stopped',
      },
    ],
    notChecked: ['The changelog: no entry on a repeated block was looked for'],
  }],
  ['verify-repo:Q1.C1', {
    verdict: 'supported',
    evidence: 'get-return-verdict.ts:31 holds the excerpt, and :50 sends back once.',
  }],
  ['verify-repo:Q1.C2', {
    verdict: 'unsupported',
    evidence: 'main.ts:12 reads the payload; the file holds no count of send-backs.',
  }],
  ['verify-repo:Q2.C1', {
    verdict: 'unopened',
    evidence: 'hooks.json has 126 lines.',
  }],
  ['verify-web:Q4.C1.v1', {
    verdict: 'supported',
    evidence: 'The page says: Exit code 2 blocks the stop and shows stderr to the subagent',
  }],
  ['verify-web:Q4.C2.v1', {
    verdict: 'unsupported',
    evidence: 'The page names no second block.',
  }],
  ['verify-web:Q4.C2.v2', {
    verdict: 'supported',
    evidence: 'The page holds the quote under Hooks.',
  }],
  ['verify-web-third:Q4.C2.v3', {
    verdict: 'supported',
    evidence: 'The quote stands in the last paragraph of the page.',
  }],
  ['completeness', {
    unreadAreas: ['tests/hooks/claude/gates/return'],
    unansweredQuestions: ['Which tests hold the verdicts of the return gate?'],
    followUps: [],
  }],
  ['synthesize', { outcome: 'written', detail: '' }],
]);

// What the workflow agents of the run on FIXED_ARGS return when the
// completeness agent writes a repository and a web follow-up question, by
// label, where they differ from FIXED_ANSWERS. The web one names the sources
// of the scope's web question. The claims of the repository one come out as
// one verified, one refuted and one undecided, and the claim of the web one
// is verified by its first vote.
const FOLLOW_UP_ANSWERS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['completeness', {
    unreadAreas: ['tests/hooks/claude/gates/return'],
    unansweredQuestions: ['Which tests hold the verdicts of the return gate?'],
    followUps: [
      {
        lane: 'repository',
        question: 'Which tests hold the verdicts of the return gate?',
        startAt: ['tests/hooks/claude/gates/return'],
      },
      {
        lane: 'web',
        question: 'Does the Claude Code changelog name a limit on stop blocks?',
        sources: ['github', 'hn', 'github'],
      },
    ],
  }],
  ['follow-up-repo:F1', {
    claims: [
      {
        claim: 'The verdict tests send back a return over the limit.',
        path: 'tests/hooks/claude/gates/return/get-return-verdict.test.ts',
        line: 20,
        endLine: 34,
        excerpt: "test('sends back a return over the limit', () => {",
      },
      {
        claim: 'The verdict tests count the send-backs of a session.',
        path: 'tests/hooks/claude/gates/return/get-return-verdict.test.ts',
        line: 40,
        endLine: 40,
        excerpt: "test('passes a return under the limit', () => {",
      },
      {
        claim: 'The return gate has a test of its entry.',
        path: 'tests/hooks/claude/gates/return/main.test.ts',
        line: 8,
        endLine: 12,
        excerpt: "test('reads the payload', () => {",
      },
    ],
    notSearched: ['tests/hooks/claude/gates/shared'],
  }],
  ['follow-up-web:F2', {
    claims: [
      {
        claim: 'The changelog names no limit on the blocks of a stop.',
        url: 'https://code.claude.com/docs/en/changelog',
        quote: 'SubagentStop hooks can block a stop',
      },
    ],
    notChecked: [],
  }],
  ['verify-repo:F1.C1', {
    verdict: 'supported',
    evidence: 'get-return-verdict.test.ts:20 names the test.',
  }],
  ['verify-repo:F1.C2', {
    verdict: 'unsupported',
    evidence: 'get-return-verdict.test.ts:40 tests a return under the limit.',
  }],
  ['verify-web:F2.C1.v1', {
    verdict: 'supported',
    evidence: 'The page says: SubagentStop hooks can block a stop',
  }],
]);

// The stand-in for the workflow agents of a deep-dive run on FIXED_ARGS: the
// answer of a call by its label, and JSON null for a label that has none.
export function getFixedAnswer(call: AgentCall): unknown {
  return FIXED_ANSWERS.get(String(call.options.label)) ?? JSON_NULL;
}

// The stand-in for the workflow agents of a deep-dive run on FIXED_ARGS with
// a follow-up round: the answer of FOLLOW_UP_ANSWERS for a label it holds, and
// that of the fixed run otherwise. `verify-repo:F1.C3` has none.
export function getFollowUpAnswer(call: AgentCall): unknown {
  return FOLLOW_UP_ANSWERS.get(String(call.options.label)) ?? getFixedAnswer(call);
}
