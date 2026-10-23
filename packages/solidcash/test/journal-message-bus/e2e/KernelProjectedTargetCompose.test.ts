import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { lockingBytecodeToSolidityAddressPayload } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  evmCompat: true, suppressWarnings: true, maximumInputBytes: 1_000_000,
} as const;

describe('kernel projected Solidity call targets', () => {
  it.each([[20, true], [32, true], [32, false]] as const)(
    'authenticates a %i-byte target (canonical=%s) against the exact P2SH32 participant identity',
    async (width, canonical) => {
      const provider = createMessageBusCapstoneTestProvider();
      const leafArtifact = compileString(`pragma solidity ^0.8.0;
      contract Leaf {
        uint public stored;
        function store(uint n) public { stored = n; require(true); }
      }`, KERNEL);
      const leafBase = new Contract(leafArtifact, [], { provider });
      const leafSetup = await setupStatefulUtxos(
        provider, leafBase, leafArtifact.stateLayout!, { stored: 0n }, { saltContract: true },
      );
      const leaf = StatefulContract.withCategory(
        leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
      );
      const payload = lockingBytecodeToSolidityAddressPayload(hexToBin(leaf.inner.lockingBytecode))!;
      expect(payload).toHaveLength(20);
      const sourceTarget = width === 32
        ? Uint8Array.of(...new Uint8Array(12).fill(canonical ? 0 : 1), ...payload) : payload;
      expect(leaf.inner.lockingBytecode).toMatch(/^aa20[0-9a-f]{64}87$/u);

      const rootArtifact = compileString(`pragma solidity ^0.8.0;
      interface ILeaf { function store(uint n) external; }
      contract Root(address leaf) {
        function run(uint n) public { ILeaf(leaf).store(n); require(true); }
      }`, KERNEL);
      const rootBase = new Contract(rootArtifact, [sourceTarget], { provider });
      const rootSetup = await setupStatefulUtxos(
        provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
      );
      const root = StatefulContract.withCategory(
        rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
      );
      const callsiteId = rootArtifact.abi.find((entry) => entry.name === 'run')!.externalCalls![0].callsiteId;
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const compose = (targetLockingBytecode: string): ReturnType<typeof messageBus.compose> => messageBus.compose({
        preparedCalls: [
          { contract: root, functionName: 'run', args: [41n] },
          { contract: leaf, functionName: 'store', args: [41n], callsiteId, targetLockingBytecode },
        ],
        funder, changeAddress: funder.unlocker.generateLockingBytecode(),
      });
      await expect(compose('ff'.repeat(20)).build()).rejects.toThrow(/not an authenticated identity/);
      if (!canonical) {
        // A truthful native descriptor cannot make malformed source-side ABI padding pass the covenant.
        await expect(compose(leaf.inner.lockingBytecode).build()).rejects.toThrow(/BCH-2026 preflight failed/);
        return;
      }
      const composition = compose(binToHex(sourceTarget));
      const builder = await composition.build();
      expect(messageBusVmAccepts(builder)).toBe(true);
      await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
      expect((await leaf.getState()).stored).toBe(41n);
    },
    180_000,
  );
});
