import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('result-dependent handler frame projection', () => {
  it('keeps forwarded struct addresses in the selected ABI lane and preserves an earlier source rejection', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      struct Payment { address worker; uint256 fee; }
      interface IProbe {
        function ready(address worker) external view returns (bool);
        function fee() external view returns (uint256);
      }
      interface ISink { function record(Payment memory payment) external returns (uint256); }
      contract Probe {
        function ready(address worker) public pure returns (bool) { return worker != address(0); }
        function fee() public pure returns (uint256) { return 100; }
      }
      contract Sink {
        address public worker;
        uint256 public total;
        function record(Payment memory payment) public returns (uint256) {
          worker = payment.worker; total += payment.fee; return total;
        }
      }
      contract Ledger {
        address public owner;
        uint256 public receipt;
        address probe;
        address sink;
        constructor(address first, address second, address creator) {
          probe = first; sink = second; owner = creator;
        }
        function settle(address worker) public {
          require(IProbe(probe).ready(worker), "not ready");
          require(worker != owner, "worker equals creator");
          Payment memory payment = Payment(worker, IProbe(probe).fee());
          receipt = ISink(sink).record(payment);
        }
      }`, {
      forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
    });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x67), provider);
    const worker = new Signer(new Uint8Array(32).fill(0x68), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 0x67).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifacts.Probe, signer).deploy();
    const sink = await getContractFactory(artifacts.Sink, signer).deploy();
    const ledger = await getContractFactory(artifacts.Ledger, signer).deploy(
      probe.inner.lockingBytecode, sink.inner.lockingBytecode, signer.getAddress(),
    );
    ledger._registerResolvedExternal('IProbe', probe);
    ledger._registerResolvedExternal('ISink', sink);
    await expect(ledger.call.settle(signer.getAddress()).send()).rejects.toThrow('worker equals creator');
    expect((await sink.getState()).total).toBe(0n);
    await ledger.call.settle(worker.getAddress()).send();
    expect((await ledger.getState()).receipt).toBe(100n);
    expect((await sink.getState()).total).toBe(100n);
    const identityWord = new Uint8Array(32);
    identityWord.set(addressToLockScript(worker.getAddress()).slice(3, 23), 12);
    expect((await sink.getState()).worker).toEqual(identityWord);
  }, 120_000);
});
