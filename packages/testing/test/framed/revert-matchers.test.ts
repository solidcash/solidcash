import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileStringMulti } from 'solidc';
import { formatArtifact } from '@solidcash/utils';
import { HDSigner } from 'solidcash/hdsigner';
import type { FramedProxyHandle } from 'solidcash/stateful';
import { upgrades } from '../../src/index.js';
import { expect as chaiExpect } from '../../src/chai.js';
import { createHardhatRuntimeEnvironment } from '../../src/hre.js';
import { resolveConfig } from '../../src/config.js';

/**
 * The chai revert matchers against a framed contract.
 *
 * A framed refusal names the frame's own source reason and, for a custom error, the argument tuple it was raised
 * with. The matchers compare that reason exactly and read that tuple, so a failure whose reason differs, and a
 * failure the harness produced rather than the contract, both fail the assertion instead of passing because some
 * unrelated message happened to contain the expected text.
 */

const COMPOSITION_LIMITS = {
  operationCostBudgetPerByte: 1_000_000,
  maximumInputBytes: 10_000_000,
  maximumTransactionBytes: 100_000_000,
  maximumStackItemBytes: 10_000_000,
  maximumNftCommitmentBytes: 10_000_000,
};

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   int public total;'
  + '   pubkey external owner;'
  + '   error ExceedsLimit(int requested, int limit);'
  + '   function initialize(int start) { this.total = start + 1; require(this.total >= 0); }'
  + '   function record(int by) { require(by < 10, "amount too large"); this.total = this.total + by;'
  + ' require(this.total >= 0); }'
  + '   function withdraw(int by) { if (by > 100) { revert ExceedsLimit(by, 100); } this.total = this.total - by;'
  + ' require(this.total >= 0); }'
  // An entry whose write grows a dynamic value the artifact states no element for: the hop sizes the run it
  // declares from the record's own length, and says so after the frame description a refusal is read from.
  + '   int[] public items;'
  + '   function overfill(int by) { require(by < 10, "amount too large"); this.items.push();'
  + ' this.items[this.items.length - 1] = by; }'
  + ' }';

const UNFUNDED_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

/** A phrase from the harness failure a wallet that holds no coin is refused with, not a contract reason. */
const HARNESS_NO_COIN = 'holds no tokenless UTXO to pay the call with';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function projectWithCompiledContract(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-framed-revert-matcher-'));
  temporaryDirectories.push(directory);
  const artifacts = path.join(directory, 'solidcash', 'Ledger.scash');
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

interface LedgerCalls {
  record: (by: bigint) => unknown;
  withdraw: (by: bigint) => unknown;
  overfill: (by: bigint) => unknown;
}

/** Deploys the contract behind the generated proxy, the handle a suite calls through. */
async function deployLedger(): Promise<{
  calls: LedgerCalls;
  connect: (signer: unknown) => LedgerCalls;
  signer: ReturnType<typeof HDSigner.fromPhrase>;
}> {
  const hre = projectHarness(projectWithCompiledContract());
  const [signer] = await hre.ethers.getSigners(1);
  const deployment = await upgrades.deployProxy(
    hre.ethers.getContractFactory('Ledger', signer) as never, [5n],
  ) as unknown as FramedProxyHandle;
  return {
    calls: deployment as unknown as LedgerCalls,
    connect: (connected) => (deployment as unknown as { connect: (r: unknown) => LedgerCalls }).connect(connected),
    signer,
  };
}

describe('the chai revert matchers and a framed contract', () => {
  it('passes when the contract\'s own reason matches the expectation', async () => {
    const { calls } = await deployLedger();
    await chaiExpect(calls.record(50n)).to.be.revertedWith('amount too large');
  });

  it('fails when the contract\'s own reason differs, showing the reason it produced', async () => {
    const { calls } = await deployLedger();
    await expect(chaiExpect(calls.record(50n)).to.be.revertedWith('something else'))
      .rejects.toThrow(/amount too large/);
  });

  it('does not accept a substring of the refusal as the reason', async () => {
    const { calls } = await deployLedger();
    await expect(chaiExpect(calls.record(50n)).to.be.revertedWith('too large'))
      .rejects.toThrow(/contract's own reason/);
  });

  it('does not let a harness failure satisfy a contract-reason expectation', async () => {
    const { connect, signer } = await deployLedger();
    const calls = connect(HDSigner.fromPhrase(UNFUNDED_PHRASE, signer.provider));
    // The harness refuses this call before the contract's frame runs; a reason expectation must not be satisfied
    // by the harness's own message, even though it contains the expected text.
    await expect(chaiExpect(calls.record(4n)).to.be.revertedWith(HARNESS_NO_COIN))
      .rejects.toThrow(/before reaching a contract reason/);
  });

  it('reads a reason the hop reports beside the run it sized', async () => {
    const { calls } = await deployLedger();
    // The refusal names the frame's reason, and the hop appends what it sized the entry's declared run at.
    await chaiExpect(calls.overfill(50n)).to.be.revertedWith('amount too large');
    await expect(chaiExpect(calls.overfill(50n)).to.be.revertedWith('something else'))
      .rejects.toThrow(/contract's own reason/);
  });

  it('compares custom-error arguments: equal passes, different fails', async () => {
    const { calls } = await deployLedger();
    await chaiExpect(calls.withdraw(1000n)).to.be.revertedWithCustomError({}, 'ExceedsLimit').withArgs(1000n, 100n);
    await expect(chaiExpect(calls.withdraw(1000n)).to.be.revertedWithCustomError({}, 'ExceedsLimit').withArgs(1n, 2n))
      .rejects.toThrow(/expected 1, got 1000/);
  });

  it('refuses to verify arguments when the refusal named no tuple', async () => {
    const { calls } = await deployLedger();
    await expect(chaiExpect(calls.record(50n)).to.be.revertedWithCustomError({}, 'amount too large').withArgs(1n))
      .rejects.toThrow(/carried no argument tuple/);
  });

  it('compares the entry\'s own reason for a contract called without a proxy', async () => {
    const hre = projectHarness(projectWithCompiledContract());
    const [signer] = await hre.ethers.getSigners(1);
    const deployed = await hre.ethers.getContractFactory('Ledger', signer).deploy() as unknown as { call: LedgerCalls };
    await chaiExpect(deployed.call.record(50n)).to.be.revertedWith('amount too large');
    await expect(chaiExpect(deployed.call.record(50n)).to.be.revertedWith('something else'))
      .rejects.toThrow(/contract's own reason/);
  });
});
