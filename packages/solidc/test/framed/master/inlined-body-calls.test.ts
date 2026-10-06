import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { Artifact, ArtifactMap } from '@solidcash/utils';
import { compileFileMulti } from '../../../src/compileFile.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * A body the lowering folded into its callers carries no definition of its own.
 *
 * Lowering an internal call that crosses into another contract folds the callee's statements into each call site,
 * so the callee survives as a declaration rather than as an invocation. A per-call master emits the definitions its
 * own program can reach, so that declaration is left out: emitting it would compile its calls against a frame no
 * entry assembles, and the call sites that actually run belong to the entries the fold placed them in.
 *
 * The sources are `.sol`, which is the pipeline that folds such a call, and every fact is read from the shipped
 * compile: the served entry list, the published call sites, and the absence of a contract-wide refusal.
 */

const SOURCE = [
  '// SPDX-License-Identifier: MIT',
  'pragma solidity ^0.8.24;',
  'interface IPeek { function peek() external returns (uint); }',
  'contract Helper {',
  '    IPeek public target;',
  '    uint public seen;',
  '    function work() internal {',
  '        uint r = target.peek();',
  '        require(r == 42, "0-001");',
  '    }',
  '    function a() external { work(); }',
  '    function b() external { work(); }',
  '}',
].join('\n');

interface PublishedSite {
  readonly kind: string;
  readonly site: number;
  readonly callIndex?: number;
  readonly segmentIndex?: number;
}

interface PublishedEntry {
  readonly functionName: string;
  readonly calls: readonly { readonly functionName: string; readonly selector: string }[];
  readonly sites: { readonly sites: readonly PublishedSite[] };
}

/** Compiles one `.sol` source through the shipped multi-contract entry, in the per-call convention. */
function compileSol(source: string, name = 'Helper'): ArtifactMap {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'percall-sol-'));
  const file = path.join(dir, `${name}.sol`);
  fs.writeFileSync(file, source);
  try {
    return compileFileMulti(file, { composition: 'per-call', solidityImportCompat: true } as never);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** The entry table one artifact's composition publishes, empty when it publishes none. */
function entriesOf(artifact: Pick<Artifact, 'composition'>): readonly PublishedEntry[] {
  return artifact.composition?.stopSites?.entries ?? [];
}

describe('a body folded into its callers', () => {
  const artifacts = compileSol(SOURCE);

  it('compiles without refusing the contract or an entry', () => {
    expect(artifacts.Helper).toBeDefined();
    expect(publishedRefusals(artifacts)).toEqual([]);
  });

  it('binds the folded call at each caller entry that runs it', () => {
    const entries = entriesOf(artifacts.Helper!);
    for (const name of ['Helper.a()', 'Helper.b()']) {
      const entry = entries.find((candidate) => candidate.functionName === name);
      expect(entry, `${name} publishes an entry`).toBeDefined();
      expect(entry!.calls.map((call) => call.functionName)).toEqual(['peek']);
      expect(entry!.sites.sites.filter((site) => site.kind === 'call')
        .map(({ kind, site, callIndex }) => ({ kind, site, callIndex }))).toEqual([
        { kind: 'call', site: 0, callIndex: 0 },
      ]);
      // The call closes the first segment, so the entry also publishes where each following segment starts.
      expect(entry!.sites.sites.filter((site) => site.kind === 'segmentClose').map((site) => site.segmentIndex))
        .toEqual([0, 1]);
    }
  });

  it('leaves the folded body out of the published entry list', () => {
    const names = entriesOf(artifacts.Helper!).map((entry) => entry.functionName);
    expect(names).not.toContain('Helper.work()');
  });
});
