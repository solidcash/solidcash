import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  solidityImportCompat: true,
  suppressWarnings: true,
} as const;

const DENSITY_OR_LIMIT = /operation cost density limit|Computed-output repair convergence exhausted|BCH-2026 preflight failed|too many rows|maximumRows|row count must be between|outside 0\.\./i;

describe('kernel density-bounded compose', () => {
  it('fails closed with a named limit when a batch exceeds the kernel row ceiling', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Acc {
        mapping(uint256 => uint256) bal;
        function credit(uint256 k, uint256 v) public { bal[k] += v; require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.maximumRows).toBeTypeOf('number');
    const maxRows = artifact.messageBus!.maximumRows!;
    expect(maxRows).toBeGreaterThan(0);

    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await contract.call.credit(0n, 1n).send();

    const oversized = Array.from({ length: maxRows + 2 }, (_unused, index) => ({
      function: 'credit' as const,
      args: [BigInt(index + 1), 1n],
    }));

    // Must not hang: batch construction or build throws a named row/density limit.
    const started = Date.now();
    let thrown: unknown;
    try {
      const call = contract.batch(oversized);
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      call.addInput(funder.utxo, funder.unlocker);
      await call.build();
    } catch (error) {
      thrown = error;
    }
    expect(Date.now() - started).toBeLessThan(120_000);
    expect(thrown).toBeDefined();
    expect(String(thrown)).toMatch(DENSITY_OR_LIMIT);
  }, 180_000);

  it('settles a small same-key credit batch under the density gate', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Acc {
        mapping(uint256 => uint256) bal;
        function credit(uint256 k, uint256 v) public { bal[k] += v; require(true); }
      }`, KERNEL);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await contract.call.credit(1n, 0n).send();
    const call = contract.batch([
      { function: 'credit', args: [1n, 2n] },
      { function: 'credit', args: [1n, 3n] },
    ]);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(funder.utxo, funder.unlocker);
    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  }, 120_000);
});
