import { binToHex, hexToBin } from '@bitauth/libauth';
import { buildChunkCommitment, splitValueIntoChunks } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { getDynamicChunkAddress } from '../../../src/stateful/covenant-helpers.js';
import { compose } from '../../../src/message-bus/index.js';
import { addressToLockScript } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, suppressWarnings: true, maximumInputBytes: 1_000_000, evmCompat: true,
} as const;

describe('kernel composition preserves unreferenced dynamic state', () => {
  it('keeps existing chunks beside a mapping mutation and runtime event', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract Store() {
      struct Record { string content; }
      string left;
      string right;
      mapping(int => int) counts;
      mapping(int => Record[]) history;
      event Recorded(int key);
      function inspect() public view returns (string, string) { return (this.left, this.right); }
      function replace(string a, string b) public {
        this.left = a;
        this.right = b;
        require(true);
      }
      function exists(int key) public view returns (bool) { return this.counts[key] > 0; }
      function touch(int key) public {
        this.counts[key] = 1;
        this.history[key].push(Record("${'payload'.repeat(30)}"));
        emit Recorded(key);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.abi.find((entry) => entry.name === 'touch')!;
    expect(handler.dynamicReads ?? []).toEqual([]);
    expect(handler.dynamicWrites ?? []).toEqual([]);
    const base = new Contract(artifact, [], { provider });
    const left = 'left';
    const right = 'right';
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, { left, right }, {
      saltContract: true,
      extraOutputs: (category) => [['left', left], ['right', right]].flatMap(([name, value]) =>
        splitValueIntoChunks(new TextEncoder().encode(value)).map((chunk, index) => ({
          address: getDynamicChunkAddress(base.withCategory(hexToBin(category)), category, name, 'string'),
          satoshis: 1200n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: buildChunkCommitment(index, chunk) } },
        }))),
    });
    const store = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    const callerArtifact = compileString(`
      interface IStore {
        function exists(int key) external view returns (bool);
        function touch(int key) external;
      }
      contract Caller() {
        function run(address target, int key) public {
          require(!IStore(target).exists(key));
          IStore(target).touch(key);
          require(true);
        }
      }
    `, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);
    const callsites = callerArtifact.abi.find((entry) => entry.name === 'run')!.externalCalls!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const call = compose({
      preparedCalls: [
        { contract: caller, functionName: 'run', args: [store.inner.lockingBytecode, 7n] },
        { contract: store, functionName: 'exists', args: [7n], callsiteId: callsites[0].callsiteId },
        { contract: store, functionName: 'touch', args: [7n], callsiteId: callsites[1].callsiteId },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await call.build();
    const chunkLocks = new Set(['left', 'right'].map((name) => binToHex(addressToLockScript(
      getDynamicChunkAddress(store.inner, setup.categoryId, name, 'string'),
    ))));
    const chunks = builder.inputs.flatMap((input, index) =>
      chunkLocks.has(binToHex(input.unlocker.generateLockingBytecode())) ? [{ input, index }] : []);
    expect(chunks).toHaveLength(2);
    for (const { input, index } of chunks) {
      expect(builder.outputs[index].token).toEqual(input.token);
    }
    await expect(call.send()).resolves.toHaveProperty('txid');
    expect(await store.getState()).toMatchObject({ left, right });
    expect(builder.outputs.some((output) => output.token?.category === setup.categoryId
      && output.token.nft?.capability === 'none')).toBe(true);
  }, 120_000);
});
