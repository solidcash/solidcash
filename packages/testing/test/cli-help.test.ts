/**
 * `<cli> <task> --help` prints that task's own flag table.
 *
 * Spawns both shipped CLI entry points. No provider is created and no node is started: help is a pure registry read.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const clis = {
  solidhat: path.resolve(here, '../../solidhat/dist/cli.js'),
  solidcash: path.resolve(here, '../dist/cli.js'),
} as const;

function run(cli: keyof typeof clis, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [clis[cli], ...args], {
    cwd: here,
    encoding: 'utf8',
    timeout: 60_000,
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe.each(Object.keys(clis) as (keyof typeof clis)[])('%s task help', (cli) => {
  it('prints the node flag table for `node --help`', () => {
    const { status, stdout, stderr } = run(cli, ['node', '--help']);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(stdout).toContain(`Usage: ${cli} node [options]`);
    expect(stdout).toContain('Start a persistent mem-cash devnet');
    for (const flag of ['--evm-rpc', '--no-block-oracle', '--shutdown-timeout', '--bch-network']) {
      expect(stdout, `missing ${flag}`).toContain(flag);
    }
    expect(stdout).toContain('--port <value>');
    expect(stdout).toContain('--allow-origin <value...>');
    // The global init help must not stand in for the task table.
    expect(stdout).not.toContain('--init');
  }, 90_000);

  it('keeps global help for `--help` without a task', () => {
    const { status, stdout } = run(cli, ['--help']);
    expect(status).toBe(0);
    expect(stdout).toContain(cli === 'solidhat' ? 'Usage: solidhat [--init]' : 'Usage: solidcash <task>');
  }, 90_000);
});

describe('unknown task with help', () => {
  it('reports the unknown task instead of printing a bogus table', () => {
    const result = run('solidhat', ['nope', '--help']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown task "nope"');
  }, 90_000);
});
