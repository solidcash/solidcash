import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  evmCompat: true, suppressWarnings: true, maximumInputBytes: 1_000_000,
} as const;
const owner = hexToBin(`76a914${'31'.repeat(20)}88ac`);
const reviewer = hexToBin(`76a914${'42'.repeat(20)}88ac`);
const cases = [
  { name: 'struct', definitions: 'struct Peer { address who; uint amount; }', type: 'Peer',
    value: { who: owner, amount: 37n }, amount: 'peer.amount' },
  { name: 'nested struct', definitions: `struct Peer { address who; uint amount; }
    struct Envelope { Peer inner; bytes note; }`, type: 'Envelope',
  value: { inner: { who: owner, amount: 37n }, note: hexToBin('123456') }, amount: 'peer.inner.amount' },
  { name: 'fixed array', definitions: '', type: 'uint[2]', value: [37n, 41n], amount: 'peer[0]' },
  { name: 'dynamic struct array', definitions: 'struct Peer { address who; uint amount; }', type: 'Peer[]',
    value: [{ who: owner, amount: 37n }, { who: owner, amount: 41n }], amount: 'peer[0].amount' },
];

describe('kernel composite graph argument boundaries', () => {
  it.each(cases)('authenticates an address after a $name at its actual encoded boundary', async (testCase) => {
    const sinkArtifact = compileString(`pragma solidity ^0.8.0;
${testCase.definitions}
contract Sink {
  uint public stored;
  function accept(address owner, ${testCase.type} memory peer, address reviewer, uint fee) public {
    require(owner != reviewer);
    require(${testCase.amount} == 37);
    stored = fee;
    require(true);
  }
}`, KERNEL);
    const rootArtifact = compileString(`pragma solidity ^0.8.0;
${testCase.definitions}
interface ISink {
  function accept(address owner, ${testCase.type} memory peer, address reviewer, uint fee) external;
}
contract Root {
  function run(address target, address owner, ${testCase.type} memory peer, address reviewer, uint fee) public {
    ISink(target).accept(owner, peer, reviewer, fee);
    require(true);
  }
}`, KERNEL);
    const provider = createMessageBusCapstoneTestProvider();
    const connect = async (artifact: typeof sinkArtifact, state: Record<string, bigint>): Promise<StatefulContract> => {
      const base = new Contract(artifact, [], { provider });
      const seeded = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, state, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(seeded.categoryId)), seeded.categoryId);
    };
    const sink = await connect(sinkArtifact, { stored: 0n });
    const root = await connect(rootArtifact, {});
    const peer = testCase.value;
    const callsiteId = rootArtifact.abi.find((entry) => entry.name === 'run')!.externalCalls![0].callsiteId;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const compose = (claimedReviewer: Uint8Array): ReturnType<typeof messageBus.compose> => messageBus.compose({
      preparedCalls: [
        { contract: root, functionName: 'run', args: [sink.inner.lockingBytecode, owner, peer, reviewer, 5n] },
        { contract: sink, functionName: 'accept', args: [owner, peer, claimedReviewer, 5n], callsiteId },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await compose(reviewer).build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    await expect(builder.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    expect((await sink.getState()).stored).toBe(5n);
    // The callee would accept this other reviewer, but composition must reject a forged producer argument.
    const otherReviewer = hexToBin(`76a914${'53'.repeat(20)}88ac`);
    await expect(compose(otherReviewer).build()).rejects.toThrow(
      /arguments disagree with compiler-derived invocation arguments/,
    );
  }, 180_000);
});
