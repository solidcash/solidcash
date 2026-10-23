import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel nested raw return ownership', () => {
  it('publishes a direct writer result for both the callee and its nested consumer', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IVault { function move(address ledger, uint recipient, uint amount) external; }
      interface ILedger { function move(uint recipient, uint amount) external returns (bool); }
      contract Ledger {
        mapping(uint => uint) public balances;
        event Moved(uint from, uint to, uint amount);
        function seed(uint holder, uint amount) public { this.balances[holder] = amount; }
        function move(uint recipient, uint amount) public returns (bool) {
          require(this.balances[7] >= amount);
          this.balances[7] -= amount;
          this.balances[recipient] += amount;
          emit Moved(7, recipient, amount);
          return true;
        }
      }
      contract Vault {
        uint public count;
        function move(address ledger, uint recipient, uint amount) public {
          (bool success, bytes memory result) = ledger.call(abi.encodeCall(ILedger.move, (recipient, amount)));
          require(success);
          require(abi.decode(result, (bool)));
          this.count += 1;
        }
      }
      contract Caller {
        uint public count;
        function initialize() public { this.count = 0; }
        function run(address vault, address ledger, uint recipient, uint amount) public {
          IVault(vault).move(ledger, recipient, amount);
          this.count += 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x68), provider);
    for (let index = 0; index < 25; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const ledger = await getContractFactory(artifacts.Ledger, signer).deploy();
    const vault = await getContractFactory(artifacts.Vault, signer).deploy();
    const caller = await upgrades.deployProxy(getContractFactory(artifacts.Caller, signer), []);
    caller.implementation._registerResolvedExternal('IVault', vault);
    vault._registerResolvedExternal('ILedger', ledger);
    vault._registerResolvedExternal('__raw__', ledger);
    const recipient = 8n;
    await expect(ledger.call.seed(7n, 100n).send()).resolves.toBeDefined();
    await expect(ledger.call.seed(recipient, 1n).send()).resolves.toBeDefined();

    const call = caller.forward('run', [vault.inner.lockingBytecode, ledger.inner.lockingBytecode, recipient, 40n]);
    const prepared = await (call as unknown as {
      _applyOverrides(): Promise<StatefulTransactionBuilder>;
    })._applyOverrides();
    const producer = prepared.getExternalCallUtxoGroups().find((group) => group.categoryId === ledger.categoryId);
    expect(producer?.blockLayout?.slots.some((slot) => slot.kind === 'returnEvent')).toBe(true);
    expect(producer?.returnEventInBlock).toBe(true);
    await expect(call.send()).resolves.toBeDefined();

    expect((await vault.getState()).count).toBe(1n);
    expect((await caller.proxy.getState()).count).toBe(1n);
    expect((await ledger.getEntries('balances')).map((entry) => entry.value).sort()).toEqual([41n, 60n]);
  }, 180_000);
});
