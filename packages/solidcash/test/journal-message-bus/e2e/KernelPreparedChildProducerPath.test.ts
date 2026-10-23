import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import {
  getContractFactory,
  StatefulContract,
  upgrades,
} from '../../../src/stateful/index.js';
import type { PreparedAtomicMessageBusCall } from '../../../src/message-bus/compose.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';
import { messageBusVmAccepts } from './vm-accepts.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

describe('kernel prepared child producer identity', () => {
  it('retains the late child path when a delegated graph revisits one state owner', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const participant = async (source: string, args: string[] = []): Promise<StatefulContract> => {
      const artifact = compileString(source, { ...KERNEL, messageBusGraphContext: true });
      const base = new Contract(artifact, args, { provider });
      const setup = await setupStatefulUtxos(
        provider, base, artifact.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const sink = await participant(`pragma solidity ^0.8.0;
      contract PathSink {
        uint public stored;
        function store(uint value) public { stored = value; require(true); }
      }`);
    const middle = await participant(`pragma solidity ^0.8.0;
      interface IPathSink { function store(uint value) external; }
      contract PathMiddle(address sink) {
        function run() public { IPathSink(sink).store(2); require(true); }
      }`, [sink.inner.lockingBytecode]);
    middle._registerResolvedExternal('IPathSink', sink);
    const relayArtifact = compileString(`pragma solidity ^0.8.0;
      interface IPathSink { function store(uint value) external; }
      interface IPathMiddle { function run() external; }
      contract PathRelay {
        uint public runs;
        function relay(address sink, address middle) public {
          this.runs = this.runs + 1;
          IPathSink(sink).store(1);
          IPathMiddle(middle).run();
          require(true);
        }
      }`, KERNEL);
    const signer = new Signer(new Uint8Array(32).fill(0x4b), provider);
    for (let index = 0; index < 20; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const deployed = await upgrades.deployProxy(
      getContractFactory(relayArtifact, signer), { runs: 0n }, { initializer: false },
    );
    deployed.implementation._registerResolvedExternal('IPathSink', sink);
    deployed.implementation._registerResolvedExternal('IPathMiddle', middle);
    const call = (deployed as any).relay(sink.inner.lockingBytecode, middle.inner.lockingBytecode);
    const prepared = await (call as unknown as {
      _applyOverrides(): Promise<{ __preparedAtomicCalls?: PreparedAtomicMessageBusCall[] }>;
    })._applyOverrides();
    const nodes = prepared.__preparedAtomicCalls;
    expect(nodes?.map((node) => node.functionName)).toEqual(['relay', 'store', 'run', 'store']);
    expect(nodes?.map((node) => node.producerPath?.status)).toEqual([
      'complete', 'complete', 'complete', 'complete',
    ]);
    const latePath = nodes![3].producerPath!;
    expect(latePath.status).toBe('complete');
    if (latePath.status !== 'complete') throw new Error('late path is unavailable');
    expect(latePath.context.sourcePath).toHaveLength(2);

    const builder = await call.build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await sink.getState()).stored).toBe(2n);
    expect((await deployed.proxy.getState()).runs).toBe(1n);
  }, 180_000);
});
