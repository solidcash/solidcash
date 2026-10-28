/**
 * A task declared in the project's `solidcash.config.mjs` is found by both CLIs, for execution and for `--help`.
 *
 * Help and dispatch used to look the task up before the config module was imported, so user tasks were reported as
 * unknown. This spawns the shipped CLI entry points against a real config that registers `probe-task`.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const clis = {
  solidhat: path.resolve(here, '../../solidhat/dist/cli.js'),
  solidcash: path.resolve(here, '../dist/cli.js'),
} as const;

let projectDir: string;

beforeAll(() => {
  projectDir = fs.mkdtempSync(path.join(here, 'fixtures/user-task-'));
  fs.writeFileSync(path.join(projectDir, 'solidcash.config.mjs'), [
    "import { defineConfig } from '@solidcash/solidhat/config';",
    "import { task } from '@solidcash/testing';",
    '',
    'export default defineConfig({});',
    '',
    "task('probe-task', 'A project-declared probe task')",
    "  .addParam('label', 'Label to echo')",
    '  .setAction(async (args) => {',
    "    console.log(`PROBE ${args.label ?? 'default'}`);",
    '  });',
    '',
  ].join('\n'));
});

afterAll(() => {
  if (projectDir !== undefined) fs.rmSync(projectDir, { recursive: true, force: true });
});

function run(cli: keyof typeof clis, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [clis[cli], ...args], {
    cwd: projectDir,
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe.each(Object.keys(clis) as (keyof typeof clis)[])('%s user-declared tasks', (cli) => {
  it('executes a task declared in solidcash.config.mjs', () => {
    const { status, stdout, stderr } = run(cli, ['probe-task', '--label', 'alpha']);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(stdout).toContain('PROBE alpha');
  }, 120_000);

  it('prints the task help for a declared task', () => {
    const { status, stdout, stderr } = run(cli, ['probe-task', '--help']);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(stdout).toContain(`Usage: ${cli} probe-task [options]`);
    expect(stdout).toContain('A project-declared probe task');
    expect(stdout).toContain('--label <value>');
  }, 120_000);
});

describe('task listing', () => {
  it('lists the project-declared task in `solidcash help`', () => {
    const { status, stdout } = run('solidcash', ['help']);
    expect(status).toBe(0);
    expect(stdout).toContain('probe-task');
  }, 120_000);

  it('still reports a genuinely unknown task', () => {
    const { status, stderr } = run('solidcash', ['definitely-not-a-task']);
    expect(status).toBe(1);
    expect(stderr).toContain('Unknown task "definitely-not-a-task"');
  }, 120_000);
});
