import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import '../src/builtin-tasks.js';
import { resolveConfig } from '../src/config.js';
import { createHardhatRuntimeEnvironment } from '../src/hre.js';
import { runTask } from '../src/tasks.js';

/**
 * A project's top-level `.scash` contract compiles as its `.sol` contracts do: its imports resolve from its own file
 * (a sibling, or a package such as `@solidcash/solidcash/contracts/BchNative.scash`), and under `split: 'func'` a
 * framed contract is published one entry per master beside its artifact. Before, the task compiled the file's text
 * with no import resolver ("Source contains imports but no importResolver provided") and never split it, so a framed
 * `.scash` contract larger than an input could not be deployed.
 */

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('the compile task on a framed .scash contract', () => {
  it('resolves its imports and publishes its per-entry split', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-scash-split-'));
    dirs.push(root);
    fs.mkdirSync(path.join(root, 'contracts'));
    fs.writeFileSync(path.join(root, 'contracts', 'Counted.scash'), [
      'pragma solidcash >=0.8.0;',
      'abstract contract Counted {',
      '    internal uint256 _count;',
      '    function count() public view returns (uint256) { return this._count; }',
      '}',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'contracts', 'Counter.scash'), [
      'pragma solidcash >=0.8.0;',
      'import { Counted } from "./Counted.scash";',
      'contract Counter() is Counted {',
      '    function bump(uint256 by) public { this._count = this._count + by; }',
      '}',
    ].join('\n'));
    const hre = createHardhatRuntimeEnvironment(resolveConfig({
      paths: { contracts: './contracts', artifacts: './artifacts', cache: './cache', tests: './test' },
      compiler: { evmCompat: true, split: 'func' },
      composition: 'framed',
    } as never, root));
    const previous = process.env.SOLIDC_COMPILE_CACHE;
    process.env.SOLIDC_COMPILE_CACHE = '0';
    try {
      await runTask('compile', { quiet: true }, hre);
    } finally {
      if (previous === undefined) delete process.env.SOLIDC_COMPILE_CACHE;
      else process.env.SOLIDC_COMPILE_CACHE = previous;
    }
    const artifacts = path.join(root, 'artifacts', 'solidcash');
    const artifact = JSON.parse(fs.readFileSync(path.join(artifacts, 'Counter.json'), 'utf8')) as {
      abi: { name: string }[]; composition?: { convention?: string };
    };
    expect(artifact.composition?.convention).toBe('framed');
    expect(artifact.abi.map((entry) => entry.name)).toEqual(expect.arrayContaining(['count', 'bump']));
    const split = JSON.parse(fs.readFileSync(path.join(artifacts, 'Counter.func.json'), 'utf8')) as {
      shards: unknown[];
    };
    expect(split.shards.length).toBeGreaterThanOrEqual(2);
  }, 120_000);
});
