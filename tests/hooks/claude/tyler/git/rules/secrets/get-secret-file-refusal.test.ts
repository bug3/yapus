import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getSecretFileRefusal,
} from '../../../../../../../hooks/claude/tyler/git/rules/secrets/get-secret-file-refusal.ts';
import {
  secretFiles,
} from '../../../../../../../hooks/claude/tyler/git/rules/secrets/secret-files.ts';
import {
  splitCommands,
} from '../../../../../../../hooks/claude/tyler/git/shell/split-commands.ts';

const { shown } = secretFiles.reasons;

function refusalOf(line: string): string | undefined {
  const split = splitCommands(line, undefined);

  if (split.kind === 'failure') {
    throw new Error(split.reason);
  }

  return getSecretFileRefusal(split.items, undefined);
}

test('refuses cat of .env', () => {
  assert.equal(refusalOf('cat .env'), shown('cat', '.env'));
});

test('refuses grep of .env.local', () => {
  assert.equal(refusalOf('grep TOKEN .env.local'), shown('grep', '.env.local'));
});

test('refuses a read through an input redirection', () => {
  assert.equal(refusalOf('cat < .env'), shown('cat', '.env'));
});

test('refuses a read through an input redirection after a subshell', () => {
  assert.equal(refusalOf('( cat ) < .env'), secretFiles.reasons.groupShown('.env'));
});

test('refuses git show of a revision and .env', () => {
  assert.equal(refusalOf('git show HEAD:.env'), shown('git', 'HEAD:.env'));
});

test('refuses git add of .env', () => {
  assert.equal(refusalOf('git add .env'), shown('git', '.env'));
});

test('refuses rm of .env', () => {
  assert.equal(refusalOf('rm .env'), shown('rm', '.env'));
});

test('refuses mv of .env', () => {
  assert.equal(refusalOf('mv .env x'), shown('mv', '.env'));
});

test('refuses a command in a shell string', () => {
  assert.equal(refusalOf("bash -c 'cat .env'"), shown('cat', '.env'));
});

test('refuses a command in a shell string behind a wrapper', () => {
  assert.equal(refusalOf("env A=1 sh -c 'cat .env'"), shown('cat', '.env'));
});

test('refuses an option value that names .env', () => {
  assert.equal(refusalOf('docker run --env-file=.env x'), shown('docker', '--env-file=.env'));
});

test('refuses a secret key file in a directory', () => {
  assert.equal(refusalOf('cat /keys/server.PEM'), shown('cat', '/keys/server.PEM'));
});

test('refuses git show of .env after a config option', () => {
  assert.equal(refusalOf('git -c x=1 show .env'), shown('git', '.env'));
});

test('gives a git call the reader cannot read no allowance', () => {
  assert.equal(refusalOf('git --exec-path=x status .env'), shown('git', '.env'));
});

test('refuses a secret file named inside python code', () => {
  assert.equal(
    refusalOf('python3 -c "print(open(\'.env\').read())"'),
    shown('python3', "print(open('.env').read())"),
  );
});

test('refuses a secret file named inside node code behind a wrapper', () => {
  assert.equal(
    refusalOf('env A=1 node -e "fs.readFileSync(\'.env\')"'),
    shown('env', "fs.readFileSync('.env')"),
  );
});

test('refuses a secret file named in the heredoc of an interpreter', () => {
  assert.equal(
    refusalOf("python3 <<'EOF'\nprint(open('.env').read())\nEOF"),
    shown('python3', '.env'),
  );
});

test('passes a heredoc that mentions .env for a program that runs no code', () => {
  assert.equal(refusalOf('git commit -F - <<EOF\nignore .env\nEOF'), undefined);
});

test('refuses a secret file named inside a jq filter', () => {
  assert.equal(refusalOf("jq 'input' .env"), shown('jq', '.env'));
});

test('refuses a secret file named inside a sed script', () => {
  assert.equal(refusalOf("sed 'r .env' x"), shown('sed', 'r .env'));
});

test('refuses awk over .env', () => {
  assert.equal(refusalOf("awk '{print}' .env"), shown('awk', '.env'));
});

test('passes a message that mentions .env to a program that runs no code', () => {
  assert.equal(refusalOf('git commit -m "add .env to the ignore file"'), undefined);
});

test('passes an interpreter script that names no secret file', () => {
  assert.equal(refusalOf('python3 -c "print(1)"'), undefined);
});

test('refuses a glob that reaches .env', () => {
  assert.equal(refusalOf('cat .en*'), shown('cat', '.en*'));
});

test('refuses a glob that reaches a key file', () => {
  assert.equal(refusalOf('cat *.pem'), shown('cat', '*.pem'));
});

test('refuses a bare star, which reaches every file but dotfiles', () => {
  assert.equal(refusalOf('cat *'), shown('cat', '*'));
});

test('refuses a glob behind a directory', () => {
  assert.equal(refusalOf('cat keys/id_r?a'), shown('cat', 'keys/id_r?a'));
});

test('refuses a glob in an input redirection', () => {
  assert.equal(refusalOf('cat < .en*'), shown('cat', '.en*'));
});

test('passes a glob that reaches no secret file', () => {
  assert.equal(refusalOf('cat *.ts'), undefined);
});

test('passes a glob given to ls', () => {
  assert.equal(refusalOf('ls *'), undefined);
});

test('refuses git rm of .env without --cached', () => {
  assert.equal(refusalOf('git rm .env'), shown('git', '.env'));
});

test('passes cat of .env.example', () => {
  assert.equal(refusalOf('cat .env.example'), undefined);
});

test('passes ls of .env', () => {
  assert.equal(refusalOf('ls .env'), undefined);
});

test('passes git status', () => {
  assert.equal(refusalOf('git status'), undefined);
});

test('passes git status of .env after an option', () => {
  assert.equal(refusalOf('git -C x status .env'), undefined);
});

test('passes git rm --cached of .env', () => {
  assert.equal(refusalOf('git rm --cached .env'), undefined);
});

test('passes a write to .env through an output redirection', () => {
  assert.equal(refusalOf('echo x > .env'), undefined);
});

test('passes cat of README.md', () => {
  assert.equal(refusalOf('cat README.md'), undefined);
});

test('passes an opaque word', () => {
  assert.equal(refusalOf('cat "$F"'), undefined);
});

test('passes a commit message that mentions .env', () => {
  assert.equal(refusalOf('git commit -m "ignore .env"'), undefined);
});

test('refuses a secret file named in the heredoc of a shell', () => {
  assert.equal(refusalOf("bash <<'EOF'\ncat .env\nEOF"), shown('bash', '.env'));
});

test('refuses a brace group that makes .env', () => {
  assert.equal(refusalOf('cat .{env,x}'), shown('cat', '.{env,x}'));
});

test('refuses a brace group that makes a key file', () => {
  assert.equal(refusalOf('cat x.{pem,txt}'), shown('cat', 'x.{pem,txt}'));
});

test('refuses a nested brace group that makes .env', () => {
  assert.equal(refusalOf('cat .{x,{env,y}}'), shown('cat', '.{x,{env,y}}'));
});

test('passes a brace group that makes no secret file', () => {
  assert.equal(refusalOf('cat x.{ts,txt}'), undefined);
});

test('passes a brace without a comma, which is literal', () => {
  assert.equal(refusalOf('cat .{env}'), undefined);
});
