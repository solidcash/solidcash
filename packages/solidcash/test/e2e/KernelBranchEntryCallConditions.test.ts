import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel external calls retain branch entry conditions', () => {
  it.each([0n, 1n])('keeps calls reached before and after a state write (initial=%s)', async (initial) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IRecorder { function record(uint value) external; }
      contract Recorder {
        uint public total;
        uint public count;
        function record(uint value) public { this.total += value; this.count += 1; }
      }
      contract Controller {
        struct Record { uint status; }
        Record[] public records;
        function initialize() public { require(true); }
        function seed(uint status) public { this.records.push(Record(status)); }
        function run(address recorder, uint key) public {
          Record storage entry = records[key];
          if (entry.status == 1) {
            IRecorder(recorder).record(10);
            entry.status = 0;
            IRecorder(recorder).record(20);
          } else {
            entry.status = 1;
            IRecorder(recorder).record(30);
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6c), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const recorder = await getContractFactory(artifacts.Recorder, signer).deploy();
    const controller = await upgrades.deployProxy(getContractFactory(artifacts.Controller, signer), []);
    controller.implementation._registerResolvedExternal('IRecorder', recorder);
    await controller.forward('seed', [initial]).send();
    await controller.forward('run', [recorder.inner.lockingBytecode, 0n]).send();
    expect(await recorder.getState()).toMatchObject({ total: 30n, count: initial === 1n ? 2n : 1n });
    expect((await controller.proxy.getState()).records).toEqual([{ status: initial === 1n ? 0n : 1n }]);
  }, 180_000);
});
