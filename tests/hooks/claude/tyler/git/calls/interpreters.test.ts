import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCalls } from '../../../../../../hooks/claude/tyler/git/calls/get-calls.ts';
import { splitCommands } from '../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

function callsOf(line: string): unknown {
  const split = splitCommands(line, undefined);

  if (split.kind === 'failure') {
    throw new Error(split.reason);
  }

  return getCalls(split.items, undefined);
}

function unjudgeable(reason: string, shouldAlwaysDeny: boolean): unknown {
  return { kind: 'unjudgeable', reason, shouldAlwaysDeny };
}

const NONE = { kind: 'calls', calls: [] };

test('refuses python with inline code', () => {
  assert.deepEqual(
    callsOf('python -c x'),
    unjudgeable('python runs code the gate cannot read', false),
  );
});

test('does not call python running a script file', () => {
  assert.deepEqual(callsOf('python x.py'), NONE);
});

test('refuses python2 with inline code', () => {
  assert.deepEqual(
    callsOf('python2 -c x'),
    unjudgeable('python2 runs code the gate cannot read', false),
  );
});

test('does not call python2 running a script file', () => {
  assert.deepEqual(callsOf('python2 x.py'), NONE);
});

test('refuses python3 with inline code', () => {
  assert.deepEqual(
    callsOf('python3 -c x'),
    unjudgeable('python3 runs code the gate cannot read', false),
  );
});

test('does not call python3 running a script file', () => {
  assert.deepEqual(callsOf('python3 x.py'), NONE);
});

test('refuses perl with inline code', () => {
  assert.deepEqual(
    callsOf('perl -e x'),
    unjudgeable('perl runs code the gate cannot read', false),
  );
});

test('does not call perl running a script file', () => {
  assert.deepEqual(callsOf('perl x.pl'), NONE);
});

test('refuses ruby with inline code', () => {
  assert.deepEqual(
    callsOf('ruby -e x'),
    unjudgeable('ruby runs code the gate cannot read', false),
  );
});

test('does not call ruby running a script file', () => {
  assert.deepEqual(callsOf('ruby x.rb'), NONE);
});

test('refuses node with inline code', () => {
  assert.deepEqual(
    callsOf('node -e x'),
    unjudgeable('node runs code the gate cannot read', false),
  );
});

test('does not call node running a script file', () => {
  assert.deepEqual(callsOf('node x.js'), NONE);
});

test('refuses nodejs with inline code', () => {
  assert.deepEqual(
    callsOf('nodejs --eval x'),
    unjudgeable('nodejs runs code the gate cannot read', false),
  );
});

test('does not call nodejs running a script file', () => {
  assert.deepEqual(callsOf('nodejs x.js'), NONE);
});

test('refuses deno with inline code', () => {
  assert.deepEqual(
    callsOf('deno eval x'),
    unjudgeable('deno runs code the gate cannot read', false),
  );
});

test('does not call deno running a script file', () => {
  assert.deepEqual(callsOf('deno run x.ts'), NONE);
});

test('refuses bun with inline code', () => {
  assert.deepEqual(
    callsOf('bun eval x'),
    unjudgeable('bun runs code the gate cannot read', false),
  );
});

test('does not call bun running a script file', () => {
  assert.deepEqual(callsOf('bun run x.ts'), NONE);
});

test('refuses php with inline code', () => {
  assert.deepEqual(
    callsOf('php -r x'),
    unjudgeable('php runs code the gate cannot read', false),
  );
});

test('does not call php running a script file', () => {
  assert.deepEqual(callsOf('php x.php'), NONE);
});

test('refuses lua with inline code', () => {
  assert.deepEqual(
    callsOf('lua -e x'),
    unjudgeable('lua runs code the gate cannot read', false),
  );
});

test('does not call lua running a script file', () => {
  assert.deepEqual(callsOf('lua x.lua'), NONE);
});

test('refuses tclsh with inline code', () => {
  assert.deepEqual(
    callsOf('tclsh -'),
    unjudgeable('tclsh runs code the gate cannot read', false),
  );
});

test('does not call tclsh running a script file', () => {
  assert.deepEqual(callsOf('tclsh x.tcl'), NONE);
});

test('refuses osascript with inline code', () => {
  assert.deepEqual(
    callsOf('osascript -e x'),
    unjudgeable('osascript runs code the gate cannot read', false),
  );
});

test('does not call osascript running a script file', () => {
  assert.deepEqual(callsOf('osascript x.scpt'), NONE);
});

test('refuses rscript with inline code', () => {
  assert.deepEqual(
    callsOf('Rscript -e x'),
    unjudgeable('rscript runs code the gate cannot read', false),
  );
});

test('does not call rscript running a script file', () => {
  assert.deepEqual(callsOf('Rscript x.R'), NONE);
});

test('refuses julia with inline code', () => {
  assert.deepEqual(
    callsOf('julia -E x'),
    unjudgeable('julia runs code the gate cannot read', false),
  );
});

test('does not call julia running a script file', () => {
  assert.deepEqual(callsOf('julia x.jl'), NONE);
});

test('refuses a versioned interpreter with inline code, by the name before its version', () => {
  assert.deepEqual(
    callsOf('python3.12 -c x'),
    unjudgeable('python runs code the gate cannot read', false),
  );
  assert.deepEqual(
    callsOf('perl5.34 -e x'),
    unjudgeable('perl runs code the gate cannot read', false),
  );
  assert.deepEqual(
    callsOf('node18 -e x'),
    unjudgeable('node runs code the gate cannot read', false),
  );
  assert.deepEqual(
    callsOf('pypy3 -c x'),
    unjudgeable('pypy runs code the gate cannot read', false),
  );
});

test('refuses an interpreter with no file, which reads stdin', () => {
  assert.deepEqual(
    callsOf("echo 'import os' | python3"),
    unjudgeable('python3 runs code the gate cannot read', false),
  );
});

test('refuses an interpreter whose only operand is an option value, which reads stdin', () => {
  assert.deepEqual(
    callsOf("echo 'import os' | python3 -W ignore"),
    unjudgeable('python3 runs code the gate cannot read', false),
  );
});

test('does not take an option value for a script, nor refuse a script after it', () => {
  assert.deepEqual(callsOf('python3 -W ignore x.py'), NONE);
});

test('refuses an interpreter reading stdin', () => {
  assert.deepEqual(
    callsOf('python3 - <x'),
    unjudgeable('python3 runs code the gate cannot read', false),
  );
});

test('refuses an inline option after the script name', () => {
  assert.deepEqual(
    callsOf('ruby x.rb -x'),
    unjudgeable('ruby runs code the gate cannot read', false),
  );
});

test('refuses an inline letter in a short option group', () => {
  assert.deepEqual(
    callsOf('perl -lne x'),
    unjudgeable('perl runs code the gate cannot read', false),
  );
});

test('refuses node -p and -r', () => {
  assert.deepEqual(
    callsOf('node -r x.js y.js'),
    unjudgeable('node runs code the gate cannot read', false),
  );
  assert.deepEqual(
    callsOf('node --print x'),
    unjudgeable('node runs code the gate cannot read', false),
  );
});

test('does not take -r as inline code for another interpreter', () => {
  assert.deepEqual(callsOf('ruby -r x y.rb'), NONE);
});

test('refuses an interpreter given an opaque word, whatever the line says', () => {
  assert.deepEqual(
    callsOf('python3 $ARGS'),
    unjudgeable('python3 runs code the gate cannot read', true),
  );
});

test('refuses inline code attached to its option', () => {
  assert.deepEqual(
    callsOf('python3 -c\'import os; os.system("git push")\''),
    unjudgeable('python3 runs code the gate cannot read', false),
  );
});

test('refuses inline code attached to an option group', () => {
  assert.deepEqual(
    callsOf('perl -le\'system "git push"\''),
    unjudgeable('perl runs code the gate cannot read', false),
  );
});

test('refuses a long inline option with an attached value', () => {
  assert.deepEqual(
    callsOf('node --eval=x'),
    unjudgeable('node runs code the gate cannot read', false),
  );
  assert.deepEqual(
    callsOf('node --print=x'),
    unjudgeable('node runs code the gate cannot read', false),
  );
});

test('refuses an attached own inline option', () => {
  assert.deepEqual(
    callsOf('node -rx.js y.js'),
    unjudgeable('node runs code the gate cannot read', false),
  );
});

test('refuses an inline letter after a value inside an option group', () => {
  assert.deepEqual(
    callsOf('python3 -W/ignore x.py'),
    unjudgeable('python3 runs code the gate cannot read', false),
  );
});

test('does not take an option group without an inline letter', () => {
  assert.deepEqual(callsOf('python3 -u x.py'), NONE);
});
