import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileStringMulti } from '@solidcash/solidc';
import { formatArtifact } from '@solidcash/utils';
import { createHardhatRuntimeEnvironment } from '../../src/hre.js';
import { resolveConfig } from '../../src/config.js';

/**
 * The testing layer drives a contract compiled for the framed composition convention.
 *
 * `ethers.getContractFactory(name).deploy(...)` is the entry a Hardhat-style suite uses, and the handle it returns
 * is where a suite makes its calls. Both are convention-agnostic: the artifact publishes the convention it was
 * compiled for, so the deploy step, the composer, the derivation and the machine are reached without the suite
 * naming any of them. This case pins that seam, over a contract with a writing entry and a read-only one, and reads
 * the entry's own answer back through the handle rather than recomputing the state here.
 */

const COMPOSITION_LIMITS = {
  operationCostBudgetPerByte: 1_000_000,
  maximumInputBytes: 10_000_000,
  maximumTransactionBytes: 100_000_000,
  maximumStackItemBytes: 10_000_000,
  maximumNftCommitmentBytes: 10_000_000,
};

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tally {'
  + '   int public total;'
  + '   function add(int by) { this.total = this.total + by; require(this.total >= 0); }'
  + '   function current() view returns (int) { return this.total; }'
  + ' }';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

/** A project directory whose artifacts dir holds the compiled contract, the way `solidcash compile` lays it out. */
function projectWithCompiledContract(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-framed-harness-'));
  temporaryDirectories.push(directory);
  const artifacts = path.join(directory, 'solidcash', 'Tally.scash');
  fs.mkdirSync(artifacts, { recursive: true });
  for (const [name, artifact] of Object.entries(compileStringMulti(SOURCE, { composition: 'framed' }))) {
    fs.writeFileSync(path.join(artifacts, `${name}.json`), formatArtifact(artifact, 'json'));
  }
  return directory;
}

function projectHarness(directory: string): ReturnType<typeof createHardhatRuntimeEnvironment> {
  return createHardhatRuntimeEnvironment(resolveConfig({
    paths: { artifacts: directory },
    networks: { mock: { type: 'mock', consensus: COMPOSITION_LIMITS } },
    defaultNetwork: 'mock',
    accounts: { count: 1 },
  }));
}

describe('the testing layer and a framed contract', () => {
  it('deploys it and answers its entries through the handle the factory returns', async () => {
    const hre = projectHarness(projectWithCompiledContract());
    const [signer] = await hre.ethers.getSigners(1);

    const deployed = await hre.ethers.getContractFactory('Tally', signer).deploy();

    // A read-only entry is derived and evaluated without a transaction, so a fresh deployment reads as zero.
    expect(await deployed.call.current()).toBe(0n);

    // A writing entry is composed, derived, accepted and broadcast; the handle reads the state its own body wrote.
    await deployed.call.add(4n);
    expect(await deployed.call.current()).toBe(4n);
  });
});
