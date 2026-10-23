import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  evmCompat: true, suppressWarnings: true, maximumInputBytes: 1_000_000,
} as const;

describe('kernel forwarded Solidity target identity', () => {
  it.each([20, 32] as const)('authenticates a forwarded %i-byte address in the full VM', async (width) => {
    const provider = createMessageBusCapstoneTestProvider();
    const participant = async (source: string): Promise<StatefulContract> => {
      const artifact = compileString(source, KERNEL);
      const base = new Contract(artifact, [], { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const leaf = await participant(`pragma solidity ^0.8.0;
      contract Leaf {
        uint public stored;
        function store(uint n) public { stored = n; require(true); }
      }`);
    const root = await participant(`pragma solidity ^0.8.0;
      interface ILeaf { function store(uint n) external; }
      contract Root {
        function run(address destination, uint n) public { ILeaf(destination).store(n); require(true); }
      }`);
    const payload = lockingBytecodeToSolidityAddressPayload(hexToBin(leaf.inner.lockingBytecode))!;
    expect(payload).toHaveLength(20);
    const sourceTarget = width === 32 ? Uint8Array.of(...new Uint8Array(12), ...payload) : payload;
    const callsiteId = root.inner.artifact.abi.find((entry) => entry.name === 'run')!.externalCalls![0].callsiteId;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const compose = (destination: Uint8Array): ReturnType<typeof messageBus.compose> => messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'run', args: [destination, 41n] },
        { contract: leaf, functionName: 'store', args: [41n], callsiteId,
          targetLockingBytecode: leaf.inner.lockingBytecode },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    // An authentic descriptor cannot override a foreign or noncanonical forwarded source address.
    await expect(compose(new Uint8Array(width).fill(0xff)).build()).rejects.toThrow(/target proof disagrees/);
    if (width === 32) {
      const malformed = sourceTarget.slice();
      malformed[0] = 1;
      await expect(compose(malformed).build()).rejects.toThrow(/target proof disagrees/);
    }
    const composition = compose(sourceTarget);
    const builder = await composition.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    expect((await leaf.getState()).stored).toBe(41n);
  }, 180_000);
});
