import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { isContractUnlocker } from '../../src/interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel scalar entry output frame', () => {
  it.each([0, 140])('updates a scalar entry beside dynamic state and an external call (%s bytes)', async (payloadBytes) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface ISink { function touch() external; }
      contract Sink {
        int public visits;
        function initialize() public { this.visits = 0; }
        function touch() public { this.visits = this.visits + 1; require(true); }
      }
      contract Writer {
        struct Record { int key; bytes payload; }
        Record[] public records;
        mapping(int => bool) public flags;
        address sink;
        function initialize(address target) public { this.sink = target; }
        function seed(int initialKey, bytes memory value) public {
          this.records.push(Record(initialKey, value)); this.flags[initialKey] = true; require(true);
        }
        function update(int index, bytes memory value) public {
          Record memory record = this.records[index];
          ISink(this.sink).touch();
          this.records[index].payload = value;
          this.flags[record.key] = false;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
      optimizeForCompilationSpeed: true, sortedMappingsAll: false });
    expect(artifacts.Writer.delegateArtifact?.abi.find((entry) => entry.name === 'update')?.sortedBatchInfo)
      .toBeUndefined();
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6d), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const sink = await upgrades.deployProxy(getContractFactory(artifacts.Sink, signer), []);
    const writer = await upgrades.deployProxy(getContractFactory(artifacts.Writer, signer), [
      await sink.proxy.getAddress(),
    ]);
    writer.implementation._registerResolvedExternal('ISink', sink.proxy);
    await writer.forward('seed', [7n, new Uint8Array(payloadBytes).fill(0x31)]).send();
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const value = new Uint8Array(180).fill(0x32);
    const composition = messageBus.compose({ preparedCalls: [
      { contract: writer.proxy, executionArtifact: writer.implementation.inner.artifact,
        executor: writer.implementation, functionName: 'update', args: [0n, value] },
      { contract: sink.proxy, executionArtifact: sink.implementation.inner.artifact,
        executor: sink.implementation, functionName: 'touch', args: [], callsiteId: 0 },
    ], funder: fee, changeAddress: fee.unlocker.generateLockingBytecode() });
    const tx = await composition.build();
    const transaction = tx.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(tx.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(vm.evaluate({
      inputIndex, sourceOutputs, transaction,
    })) === true)).toBe(true);
    const routeInput = tx.inputs.findIndex((input) => isContractUnlocker(input.unlocker)
      && input.unlocker.contract.artifact.contractName === 'Writer');
    expect(routeInput).toBeGreaterThanOrEqual(0);
    const oldEntry = (await writer.proxy.getEntries('flags'))[0];
    const entryOutput = transaction.outputs.findIndex((output) => output.token?.nft !== undefined
      && binToHex(output.token.nft.commitment).startsWith(binToHex(oldEntry.slot!)));
    expect(entryOutput).toBeGreaterThanOrEqual(0);
    expect(transaction.outputs[entryOutput].token!.nft!.commitment).toHaveLength(64);
    for (const mutation of ['lock', 'value'] as const) {
      const tampered = structuredClone(transaction);
      if (mutation === 'lock') tampered.outputs[entryOutput].lockingBytecode = Uint8Array.of(0x51);
      else tampered.outputs[entryOutput].token!.nft!.commitment = Uint8Array.of(
        ...tampered.outputs[entryOutput].token!.nft!.commitment, 1,
      );
      expect(vm.stateSuccess(vm.evaluate({ inputIndex: routeInput, sourceOutputs, transaction: tampered })))
        .not.toBe(true);
    }
    await composition.send();
    expect((await writer.proxy.getEntries('flags'))[0].value).toBe(false);
    expect((await writer.proxy.getState()).records).toMatchObject([{ key: 7n, payload: value }]);
    expect((await sink.proxy.getState()).visits).toBe(1n);
  }, 180_000);
});
