import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import {
  buildValueChunkCommitment, buildValueChunkCovenantScript, computeCollectionHash,
  sha256, splitValueIntoValueChunks, valueChunkSignature,
} from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { compose } from '../../src/message-bus/compose.js';
import { scriptToLockingBytecode } from '../../src/utils.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

/**
 * `compose().build()` reaches `assembleAtomicComposition`, which publishes each transported chunk
 * through `publishedTransportedValueChunkLock(production, executionLockingBytecode)`.
 */
describe('composed value-chunk publication binds the execution lock', () => {
  it('publishes chunk outputs whose lock is the execution locking bytecode', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => bytes) left;
        mapping(int => bytes) right;
        function set(int key, bytes leftValue, bytes rightValue) public {
          this.left[key] = leftValue;
          this.right[key] = rightValue;
          require(true);
        }
      }`, KERNEL);
    expect(storeArtifact.messageBus?.available).toBe(true);
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'set')?.eligible).toBe(true);

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );
    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore {
        function set(int key, bytes leftValue, bytes rightValue) external;
      }
      contract Caller() {
        function poke(address store, int key, bytes leftValue, bytes rightValue) public {
          IStore(store).set(key, leftValue, rightValue);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);
    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'set');
    expect(callsite?.callsiteId).toBeDefined();

    await expect(store.call.set(3n, new Uint8Array(80).fill(0x11), new Uint8Array(80).fill(0x22)).send())
      .resolves.toBeDefined();

    const left = new Uint8Array(130).fill(0x71);
    const right = new Uint8Array(190).fill(0x82);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const builder = await compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, 3n, left, right],
      }, {
        contract: store,
        functionName: 'set',
        args: [3n, left, right],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).build();

    const executionLock = hexToBin(store.inner.lockingBytecode);
    expect(executionLock).toHaveLength(35);
    const slot = keyToSlotMulti([bigIntToVmNumber(3n)]);
    const outputs = builder.buildLibauthTransaction().outputs;
    for (const [collection, value] of [['left', left], ['right', right]] as const) {
      const publishedLock = scriptToLockingBytecode(buildValueChunkCovenantScript(
        hexToBin(store.categoryId),
        computeCollectionHash(valueChunkSignature(collection)),
        slot,
        sha256(value),
        executionLock,
      ), 'p2sh32');
      const unboundLock = scriptToLockingBytecode(buildValueChunkCovenantScript(
        hexToBin(store.categoryId),
        computeCollectionHash(valueChunkSignature(collection)),
        slot,
        sha256(value),
      ), 'p2sh32');
      expect(binToHex(publishedLock)).not.toBe(binToHex(unboundLock));
      const chunks = splitValueIntoValueChunks(value);
      expect(chunks.length).toBeGreaterThan(0);
      for (const [index, chunk] of chunks.entries()) {
        const commitment = buildValueChunkCommitment(index, chunk);
        const published = outputs.find((output) => {
          const nft = output.token?.nft?.commitment;
          const hex = nft instanceof Uint8Array ? binToHex(nft) : String(nft ?? '');
          return hex === commitment;
        });
        expect(published, `${collection} chunk ${index}`).toBeDefined();
        expect(binToHex(published!.lockingBytecode)).toBe(binToHex(publishedLock));
        expect(binToHex(published!.lockingBytecode)).not.toBe(binToHex(unboundLock));
      }
    }
  }, 180_000);
});
