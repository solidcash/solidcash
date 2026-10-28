/**
 * Task registry and flag parsing for `solidhat node` / `solidcash node`.
 *
 * Imports the shipped `builtin-tasks` registration and asserts the real `node` task definition is present with its
 * flag surface, and that `parseTaskArgs` rejects typos and missing values instead of silently storing them.
 */
import './../src/builtin-tasks.js';
import { describe, expect, it } from 'vitest';
import { getTask, parseTaskArgs } from '../src/tasks.js';

const nodeTask = (): NonNullable<ReturnType<typeof getTask>> => {
  const task = getTask('node');
  if (task === undefined) throw new Error('node task is not registered');
  return task;
};

describe('node task registry', () => {
  it('registers the full flag surface', () => {
    const params = new Map(nodeTask().params.map((param) => [param.name, param]));
    for (const name of [
      'host', 'port', 'mining', 'interval', 'coinbase', 'mnemonic', 'path', 'accounts', 'balance',
      'coins', 'height', 'timestamp', 'vm', 'consensus', 'chain-id', 'bch-network', 'log-level',
      'token', 'max-connections', 'max-message-bytes', 'max-snapshots', 'shutdown-timeout',
    ]) {
      expect(params.has(name), `missing --${name}`).toBe(true);
    }
    for (const flag of [
      'interval-empty', 'random-mnemonic', 'no-fund', 'no-keys', 'evm-rpc', 'no-block-oracle',
      'json', 'quiet', 'trace', 'unsafe-expose', 'metrics', 'no-compile',
    ]) {
      expect(params.get(flag)?.isFlag, `--${flag} is not a flag`).toBe(true);
    }
    for (const array of ['allow-origin', 'allow-host']) {
      expect(params.get(array)?.isArray, `--${array} is not repeatable`).toBe(true);
    }
  });

  it('parses values, inline equals, flags, and repeatable options', () => {
    const args = parseTaskArgs(nodeTask(), [
      '--port', '0',
      '--json',
      '--mining=manual',
      '--allow-origin', 'http://localhost:3000',
      '--allow-origin=http://127.0.0.1:5173',
      '--allow-origin', 'http://a.test,http://b.test',
      '--no-keys=false',
    ]);
    expect(args.port).toBe('0');
    expect(args.json).toBe(true);
    expect(args.mining).toBe('manual');
    expect(args['allow-origin']).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://a.test',
      'http://b.test',
    ]);
    expect(args['no-keys']).toBe(false);
  });

  it('rejects an unknown option and a missing value', () => {
    expect(() => parseTaskArgs(nodeTask(), ['--prot', '9000'])).toThrow(/Unknown option --prot/);
    expect(() => parseTaskArgs(nodeTask(), ['--port'])).toThrow(/requires a value/);
  });
});
