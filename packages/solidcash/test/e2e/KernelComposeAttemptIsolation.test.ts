import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel composition attempt isolation', () => {
  it('admits a valid return-dependent call after a rejected call with the same initial claims', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISequence {
        function next() external view returns (uint);
        function save(uint value) external;
      }
      contract Sequence {
        uint public current;
        function next() public view returns (uint) { return this.current + 1; }
        function save(uint value) public { this.current = value; }
      }
      contract Recorder {
        uint public count;
        function initialize() public { this.count = 0; }
        function record(address sequence, bool valid) public {
          uint next = ISequence(sequence).next();
          require(valid, "entry rejected");
          ISequence(sequence).save(next);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x69), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const sequence = await getContractFactory(artifacts.Sequence, signer).deploy();
    const recorder = await upgrades.deployProxy(getContractFactory(artifacts.Recorder, signer), []);
    recorder.implementation._registerResolvedExternal('ISequence', sequence);
    await expect(recorder.forward('record', [sequence.inner.lockingBytecode, false]).send())
      .rejects.toThrow();
    expect((await sequence.getState()).current).toBe(0n);
    expect((await recorder.proxy.getState()).count).toBe(0n);
    await recorder.forward('record', [sequence.inner.lockingBytecode, true]).send();
    expect((await sequence.getState()).current).toBe(1n);
    expect((await recorder.proxy.getState()).count).toBe(1n);
    await recorder.forward('record', [sequence.inner.lockingBytecode, true]).send();
    expect((await sequence.getState()).current).toBe(2n);
    expect((await recorder.proxy.getState()).count).toBe(2n);
  }, 180_000);
});
