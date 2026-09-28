import { compileString, compileStringMulti } from 'solidc';
import { describe, expect, it } from 'vitest';
import { getContractFactory, Signer, upgrades } from '../../src/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel repeated writes beside a direct-only participant', () => {
  it.each(['Ledger', 'ILedger'])('preserves an earlier mapping update and both later appends via %s', async (calleeType) => {
    const source = `pragma solidity ^0.8.20;
      struct Record { string note; uint256 count; }
      struct Payment { address payable recipient; uint256 amount; bool enabled; }
      interface ILedger {
        function bump(uint256 key) external;
        function append(uint256 key, bytes memory value) external;
      }
      contract Ledger {
        mapping(uint256 => Record) public records;
        mapping(uint256 => bytes[]) public messages;
        function initialize() public { require(true); }
        function seed(uint256 key, string memory note) public {
          this.records[key] = Record(note, 0);
        }
        function bump(uint256 key) public {
          this.records[key].count = this.records[key].count + 1;
        }
        function append(uint256 key, bytes memory value) public {
          this.messages[key].push(value);
        }
      }
      contract Payer {
        mapping(uint256 => Payment) public payments;
        uint256 public visits;
        function initialize() public { require(true); }
        function visit(uint256 key) public {
          Payment memory payment = this.payments[key];
          if (payment.enabled) {
            (bool success,) = payment.recipient.call{value: payment.amount}("");
            require(success);
          }
          this.visits = this.visits + 1;
        }
      }
      contract Coordinator {
        address public ledger;
        address public payer;
        uint256 public runs;
        function initialize() public { require(true); }
        function seed(address first, address second) public {
          this.ledger = first;
          this.payer = second;
        }
        function run(uint256 key) public {
          Payer(this.payer).visit(key);
          ${calleeType}(this.ledger).bump(key);
          ${calleeType}(this.ledger).append(key, hex"11");
          ${calleeType}(this.ledger).append(key, hex"22");
          this.runs = this.runs + 1;
        }
      }`;
    const options = { forceStateful: true, solidityImportCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: false } as const;
    const artifacts = compileStringMulti(source, options);
    // This scenario intentionally mixes a direct-only participant with kernel-routed siblings. Keep that
    // selection explicit instead of depending on whether a low-level call happens to pass kernel admission.
    const payerArtifact = compileString(source, { ...options, primaryContractName: 'Payer', messageBus: false });
    expect(payerArtifact.messageBus).toBeUndefined();
    for (const name of ['bump', 'append']) {
      expect(artifacts.Ledger.delegateArtifact!.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6b), provider);
    for (let index = 0; index < 24; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const ledger = await upgrades.deployProxy(getContractFactory(artifacts.Ledger, signer), []);
    const payer = await getContractFactory(payerArtifact, signer).deploy();
    const coordinator = await upgrades.deployProxy(getContractFactory(artifacts.Coordinator, signer), []);
    coordinator.implementation._registerResolvedExternal(calleeType, ledger.proxy);
    coordinator.implementation._registerResolvedExternal('Payer', payer);
    await ledger.forward('seed', [7n, 'authenticated chunked record '.repeat(5)]).send();
    await coordinator.forward('seed', [ledger.proxy.inner.lockingBytecode, payer.inner.lockingBytecode]).send();
    await expect(coordinator.forward('run', [7n]).send()).resolves.toBeDefined();
    expect((await payer.getState()).visits).toBe(1n);
    const records = await ledger.proxy.getEntries('records');
    expect(records).toHaveLength(1);
    expect(records[0].value).toMatchObject({ count: 1n });
    const messages = await ledger.proxy.getEntries('messages');
    expect(messages).toHaveLength(1);
    expect(messages[0].value).toEqual([new Uint8Array([0x11]), new Uint8Array([0x22])]);
  }, 180_000);
});
