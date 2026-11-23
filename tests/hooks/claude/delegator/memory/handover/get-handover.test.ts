import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  type Call,
  getHandover,
} from '../../../../../../hooks/claude/delegator/memory/handover/get-handover.ts';
import type { MemoryEvent } from '../../../../../../hooks/claude/delegator/memory/parse-event.ts';
import { makeMemoryProject } from '../../../../../helpers/memory/make-memory-project.ts';
import { makeTempDir } from '../../../../../helpers/make-temp-dir.ts';

const FINISHER_EVENT = 'launch delegator:finisher';
const HEADING_A = 'Project memory, .yapus/memory/rules/a.md applies to this call:';
const HEADING_B = 'Project memory, .yapus/memory/rules/b.md applies to this call:';
const HEADING_C = 'Project memory, .yapus/memory/rules/c.md applies to this call:';

// A call of session s1 in the project, with a plugin data directory of its own.
function makeCall(t: TestContext, projectDir: string | undefined): Call {
  return { stdinText: JSON.stringify({ session_id: 's1' }), dataDir: makeTempDir(t), projectDir };
}

function isFinisherLaunch(event: MemoryEvent): boolean {
  return event.kind === 'launch' && event.agentType === 'delegator:finisher';
}

function makeRule(description: string, event: string, body: string): string {
  return `---\ndescription: "${ description }"\nevent: "${ event }"\n---\n\n${ body }\n`;
}

function makeOutput(additionalContext: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext },
  });
}

test('hands a rule of the call as its body under the line that names its file', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.\n\nThen b.') },
  ]);

  assert.equal(
    getHandover(makeCall(t, projectDir), isFinisherLaunch),
    makeOutput(`${ HEADING_A }\nSay a.\n\nThen b.`),
  );
});

test('hands the rules of one call in name order with an empty line between them', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/b.md', text: makeRule('About b.', FINISHER_EVENT, 'Say b.') },
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
  ]);

  assert.equal(
    getHandover(makeCall(t, projectDir), isFinisherLaunch),
    makeOutput(`${ HEADING_A }\nSay a.\n\n${ HEADING_B }\nSay b.`),
  );
});

test('hands no rule of another event and no rule without one', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', 'launch delegator:reader', 'Say a.') },
    { path: 'rules/b.md', text: makeRule('About b.', 'gh pr merge', 'Say b.') },
    { path: 'rules/c.md', text: '---\ndescription: "About c."\n---\n\nSay c.\n' },
  ]);

  assert.equal(getHandover(makeCall(t, projectDir), isFinisherLaunch), undefined);
});

test('hands no rule that names its successor', (t) => {
  const replaced = '---\ndescription: "About a."\nevent: "launch delegator:finisher"\n'
    + 'superseded-by: "b"\n---\n\nSay a.\n';
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: replaced },
    { path: 'rules/b.md', text: makeRule('About b.', FINISHER_EVENT, 'Say b.') },
  ]);

  assert.equal(
    getHandover(makeCall(t, projectDir), isFinisherLaunch),
    makeOutput(`${ HEADING_B }\nSay b.`),
  );
});

test('hands nothing in a project with no memory directory', (t) => {
  assert.equal(getHandover(makeCall(t, makeTempDir(t)), isFinisherLaunch), undefined);
});

test('hands nothing when the project directory is unset or empty, also inside a project', (t) => {
  const workingDirectory = process.cwd();

  t.after(() => {
    process.chdir(workingDirectory);
  });
  process.chdir(makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
  ]));

  assert.deepEqual(
    [
      getHandover(makeCall(t, undefined), isFinisherLaunch),
      getHandover(makeCall(t, ''), isFinisherLaunch),
    ],
    [undefined, undefined],
  );
});

test('hands nothing in a session switched off', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
  ]);
  const call = makeCall(t, projectDir);

  writeFileSync(join(call.dataDir ?? '', 'mode'), 'off');

  assert.equal(getHandover(call, isFinisherLaunch), undefined);
});

test('hands the first rules whole and the next as its line once the sum passes the bound', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'a'.repeat(3000)) },
    { path: 'rules/b.md', text: makeRule('About b.', FINISHER_EVENT, 'b'.repeat(3000)) },
    { path: 'rules/c.md', text: makeRule('About c.', FINISHER_EVENT, 'c'.repeat(3000)) },
  ]);

  assert.equal(
    getHandover(makeCall(t, projectDir), isFinisherLaunch),
    makeOutput(
      `${ HEADING_A }\n${ 'a'.repeat(3000) }\n\n${ HEADING_B }\n${ 'b'.repeat(3000) }\n\n`
      + 'Project memory, .yapus/memory/rules/c.md applies to this call: About c. Read the file.',
    ),
  );
});

test('hands a rule as its line when its body leaves no room for the line of the next', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'a'.repeat(7900)) },
    { path: 'rules/b.md', text: makeRule('About b.', FINISHER_EVENT, 'Say b.') },
  ]);

  assert.equal(
    getHandover(makeCall(t, projectDir), isFinisherLaunch),
    makeOutput(
      `${ HEADING_A } About a. Read the file.\n\n${ HEADING_B } About b. Read the file.`,
    ),
  );
});

test('hands a body of as many characters as the bound leaves under its line', (t) => {
  const body = 'a'.repeat(8000 - HEADING_A.length - 1);
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, body) },
  ]);

  assert.equal(
    getHandover(makeCall(t, projectDir), isFinisherLaunch),
    makeOutput(`${ HEADING_A }\n${ body }`),
  );
});

test('hands a rule as its line when its body is one character past the bound', (t) => {
  const body = 'a'.repeat(8000 - HEADING_A.length);
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, body) },
  ]);

  assert.equal(
    getHandover(makeCall(t, projectDir), isFinisherLaunch),
    makeOutput(`${ HEADING_A } About a. Read the file.`),
  );
});

test('hands nothing when neither the body nor the line of a rule fits the bound', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('a'.repeat(8000), FINISHER_EVENT, 'b'.repeat(8000)) },
  ]);

  assert.equal(getHandover(makeCall(t, projectDir), isFinisherLaunch), undefined);
});

test('keeps a dollar sign and a placeholder of a description as they are', (t) => {
  const projectDir = makeMemoryProject(t, [
    {
      path: 'rules/a.md',
      text: makeRule('Costs $& at <path>.', FINISHER_EVENT, 'a'.repeat(8000)),
    },
  ]);

  assert.equal(
    getHandover(makeCall(t, projectDir), isFinisherLaunch),
    makeOutput(`${ HEADING_A } Costs $& at <path>. Read the file.`),
  );
});

test('hands a rule as its line to each later call of the session that got its body', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
  ]);
  const call = makeCall(t, projectDir);

  assert.deepEqual(
    [
      getHandover(call, isFinisherLaunch),
      getHandover(call, isFinisherLaunch),
      getHandover(call, isFinisherLaunch),
    ],
    [
      makeOutput(`${ HEADING_A }\nSay a.`),
      makeOutput(`${ HEADING_A } About a. Read the file.`),
      makeOutput(`${ HEADING_A } About a. Read the file.`),
    ],
  );
});

test('hands another session of the same data directory the body of the rule', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
  ]);
  const call = makeCall(t, projectDir);
  const otherCall = { ...call, stdinText: JSON.stringify({ session_id: 's2' }) };

  getHandover(call, isFinisherLaunch);

  assert.equal(getHandover(otherCall, isFinisherLaunch), makeOutput(`${ HEADING_A }\nSay a.`));
});

test('hands a rule the session got before as its line between two it gets whole', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
    { path: 'rules/b.md', text: makeRule('About b.', 'gh pr merge', 'Say b.') },
    { path: 'rules/c.md', text: makeRule('About c.', FINISHER_EVENT, 'Say c.') },
  ]);
  const call = makeCall(t, projectDir);

  getHandover(call, (event) => event.kind === 'gh');

  assert.equal(
    getHandover(call, () => true),
    makeOutput(
      `${ HEADING_A }\nSay a.\n\n${ HEADING_B } About b. Read the file.\n\n${ HEADING_C }\nSay c.`,
    ),
  );
});

test('hands the body of a rule that came as its line for want of room once it fits', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'a'.repeat(3000)) },
    { path: 'rules/b.md', text: makeRule('About b.', FINISHER_EVENT, 'b'.repeat(3000)) },
    { path: 'rules/c.md', text: makeRule('About c.', FINISHER_EVENT, 'c'.repeat(3000)) },
  ]);
  const call = makeCall(t, projectDir);
  const lineA = `${ HEADING_A } About a. Read the file.`;
  const lineB = `${ HEADING_B } About b. Read the file.`;
  const lineC = `${ HEADING_C } About c. Read the file.`;

  assert.deepEqual(
    [
      getHandover(call, isFinisherLaunch),
      getHandover(call, isFinisherLaunch),
      getHandover(call, isFinisherLaunch),
    ],
    [
      makeOutput(
        `${ HEADING_A }\n${ 'a'.repeat(3000) }\n\n${ HEADING_B }\n${ 'b'.repeat(3000) }\n\n${ lineC }`,
      ),
      makeOutput(`${ lineA }\n\n${ lineB }\n\n${ HEADING_C }\n${ 'c'.repeat(3000) }`),
      makeOutput(`${ lineA }\n\n${ lineB }\n\n${ lineC }`),
    ],
  );
});

test('keeps the record of a session in the plugin data directory, a rule path a line', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
    { path: 'rules/b.md', text: makeRule('About b.', FINISHER_EVENT, 'b'.repeat(8000)) },
  ]);
  const call = makeCall(t, projectDir);

  getHandover(call, isFinisherLaunch);
  getHandover(call, isFinisherLaunch);

  assert.equal(
    readFileSync(join(call.dataDir ?? '', 'handovers', 's1.log'), 'utf8'),
    '.yapus/memory/rules/a.md\n',
  );
});

test('hands the body at every call when the record cannot be written', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
  ]);
  const call = makeCall(t, projectDir);
  const whole = makeOutput(`${ HEADING_A }\nSay a.`);

  writeFileSync(join(call.dataDir ?? '', 'handovers'), 'a file in the place of the records\n');

  assert.deepEqual(
    [getHandover(call, isFinisherLaunch), getHandover(call, isFinisherLaunch)],
    [whole, whole],
  );
});

test('hands the body at every call when the record cannot be read', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
  ]);
  const call = makeCall(t, projectDir);
  const whole = makeOutput(`${ HEADING_A }\nSay a.`);

  mkdirSync(join(call.dataDir ?? '', 'handovers', 's1.log'), { recursive: true });

  assert.deepEqual(
    [getHandover(call, isFinisherLaunch), getHandover(call, isFinisherLaunch)],
    [whole, whole],
  );
});

test('hands the body at every call with no data directory or no session id to name', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
  ]);
  const call = makeCall(t, projectDir);
  const calls = [
    { ...call, dataDir: undefined },
    { ...call, dataDir: '' },
    { ...call, stdinText: '{}' },
    { ...call, stdinText: JSON.stringify({ session_id: '../s1' }) },
    { ...call, stdinText: 'no JSON' },
  ];
  const whole = makeOutput(`${ HEADING_A }\nSay a.`);

  assert.deepEqual(
    calls.flatMap((each) => [
      getHandover(each, isFinisherLaunch),
      getHandover(each, isFinisherLaunch),
    ]),
    calls.flatMap(() => [whole, whole]),
  );
});

test('records no rule in a session switched off', (t) => {
  const projectDir = makeMemoryProject(t, [
    { path: 'rules/a.md', text: makeRule('About a.', FINISHER_EVENT, 'Say a.') },
  ]);
  const call = makeCall(t, projectDir);
  const modePath = join(call.dataDir ?? '', 'mode');

  writeFileSync(modePath, 'off');
  getHandover(call, isFinisherLaunch);
  writeFileSync(modePath, 'on');

  assert.equal(getHandover(call, isFinisherLaunch), makeOutput(`${ HEADING_A }\nSay a.`));
});
