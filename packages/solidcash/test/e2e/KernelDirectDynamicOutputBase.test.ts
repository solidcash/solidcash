import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { isContractUnlocker } from '../../src/interfaces.js';
import { Signer } from '../../src/index.js';
import { getContractFactory } from '../../src/stateful/index.js';
import {
  createMessageBusCapstoneTestProvider, createMessageBusSemanticTestProvider,
} from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

describe('ordinary direct dynamic output coordinates', () => {
  it('authenticates rewritten chunks after returning and void callees through growth and shrinkage', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IProbe { function ping(uint256 value) external returns (uint256); }
      interface ISink { function note(uint256 value) external; }
      contract Probe {
        uint256 public calls;
        function ping(uint256 value) public returns (uint256) { calls++; return value; }
      }
      contract Sink {
        uint256 public total;
        function note(uint256 value) public { total += value; }
      }
      contract Ledger {
        bytes public value;
        address probe;
        address sink;
        constructor(address first, address second) { probe = first; sink = second; }
        function settle(bytes memory next) public {
          value = next;
          uint256 length = IProbe(probe).ping(next.length);
          ISink(sink).note(length);
        }
      }`, {
      forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
    });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x65), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 0x65).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifacts.Probe, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const ledger = await getContractFactory(artifacts.Ledger, signer).deploy(
      probe.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    ledger._registerResolvedExternal('IProbe', probe);
    ledger._registerResolvedExternal('ISink', sink);
    let total = 0n;
    for (const length of [121, 181, 1]) {
      const next = new Uint8Array(length).fill(length % 0xff);
      const builder = await ledger.call.settle(next).build();
      const rootIndex = builder.inputs.findIndex((input) => input.token?.category === ledger.categoryId
        && input.token.nft?.capability === 'minting');
      const unlocker = builder.inputs[rootIndex].unlocker;
      if (!isContractUnlocker(unlocker)) throw new Error('Missing direct ledger unlocker');
      const outputIndex = unlocker.abiFunction.inputs.findIndex((input) =>
        input.name === '__internal__dynamicChunkOutputBase');
      const returnIndex = unlocker.abiFunction.inputs.findIndex((input) =>
        input.name === '__internal__externalReturnOutputIdx');
      expect(outputIndex).toBeGreaterThanOrEqual(0);
      expect(returnIndex).toBeGreaterThanOrEqual(0);
      const actual = unlocker.params[outputIndex] as bigint;
      const oldAnchor = (unlocker.params[returnIndex] as bigint) + 1n;
      expect(actual).not.toBe(oldAnchor);
      expect(builder.outputs[Number(actual)].token?.category).toBe(ledger.categoryId);
      expect(messageBusVmAccepts(builder)).toBe(true);
      unlocker.params[outputIndex] = oldAnchor;
      unlocker.syncEncodedArgsFromParams?.();
      expect(messageBusVmAccepts(builder)).toBe(false);
      unlocker.params[outputIndex] = actual;
      unlocker.syncEncodedArgsFromParams?.();
      expect(messageBusVmAccepts(builder)).toBe(true);
      await builder.send();
      expect((await ledger.getState()).value).toEqual(next);
      total += BigInt(length);
      expect((await sink.getState()).total).toBe(total);
    }
    expect((await probe.getState()).calls).toBe(3n);
  }, 180_000);

  it('selects a conditional returning call using the authenticated oracle clock', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IProbe { function ping(uint256 value) external returns (uint256); }
      interface ISink { function note(uint256 value) external; }
      contract Probe {
        uint256 public calls;
        function ping(uint256 value) public returns (uint256) { calls++; return value; }
      }
      contract Sink {
        uint256 public total;
        function note(uint256 value) public { total += value; }
      }
      contract ClockLedger {
        bytes public value;
        address probe;
        address sink;
        constructor(address first, address second) { probe = first; sink = second; }
        function settle(bytes memory next, uint256 deadline) public {
          value = next;
          if (block.timestamp >= deadline) {
            uint256 length = IProbe(probe).ping(next.length);
            require(length == next.length, "wrong length");
          }
          ISink(sink).note(next.length);
        }
      }`, {
      forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
    });
    const provider = createMessageBusSemanticTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x67), provider);
    for (let index = 0; index < 16; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 0x67).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifacts.Probe, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const ledger = await getContractFactory(artifacts.ClockLedger, signer).deploy(
      probe.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    expect(ledger.inner.artifact.usesBlockOracle).toBe(true);
    const optionalCall = ledger.inner.artifact.abi.find((fn) => fn.name === 'settle')!.externalCalls![0];
    expect(optionalCall.occurrence).toBe('conditional');
    // Deployment bootstraps the mock chain's height and clock; choose deadlines from that settled tip.
    const now = BigInt(provider.getBlockTime());
    ledger._registerResolvedExternal('IProbe', probe);
    ledger._registerResolvedExternal('ISink', sink);
    for (const [deadline, calls] of [[now + 3600n, 0n], [now - 3600n, 1n]]) {
      const next = new Uint8Array(121).fill(Number(calls) + 1);
      const call = ledger.call.settle(next, deadline);
      const builder = await call.build();
      expect(builder.inputs.some((input) => input.token?.category === probe.categoryId)).toBe(calls === 1n);
      expect(messageBusVmAccepts(builder)).toBe(true);
      await call.send();
      expect((await ledger.getState()).value).toEqual(next);
      expect((await probe.getState()).calls).toBe(calls);
    }
    expect((await sink.getState()).total).toBe(242n);
  }, 180_000);

});
