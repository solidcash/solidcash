/**
 * A loop of `new C{value: v}()` beside another payment out of the same satoshi container.
 *
 * Through deployers each child's value is a deployer value the creator's container checks count beside its fixed
 * transfers. The container loses each child's value and the payment, and no more. Checked with the standard VM,
 * honest and with one satoshi moved off the container, which the creator must refuse.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, cashAddressToLockingBytecode, createVirtualMachineBch2026, decodeTransaction, encodeLockingBytecodeP2pkh,
  hexToBin, lockingBytecodeToCashAddress,
} from '@bitauth/libauth';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { clearGenesisReservations } from '../../src/stateful/genesis-reservations.js';
import { solidCashOutputToLibauthOutput } from '../../src/utils.js';
import type { Utxo } from '../../src/interfaces.js';
import { compileStringMulti } from '../direct-compile.js';
import { alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';

const vm = createVirtualMachineBch2026(true);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const bobLock = binToHex(encodeLockingBytecodeP2pkh(bobPkh));
const alice = new SignatureTemplate(alicePriv);

type Spend = { transaction: any; sourceOutputs: any[] };

/** Records every broadcast with the coins it spends, read from the ledger while they are still live. */
function captureBroadcasts(provider: MockNetworkProvider): Spend[] {
  const captured: Spend[] = [];
  const inner = provider.sendRawTransaction.bind(provider);
  provider.sendRawTransaction = async (hex: string) => {
    const transaction = decodeTransaction(hexToBin(hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    const sourceOutputs = await Promise.all(transaction.inputs.map(async (input) => {
      const spent = await provider.getLedgerOutput(binToHex(input.outpointTransactionHash), input.outpointIndex);
      if (spent === undefined) throw new Error('a spent coin is not on the ledger');
      return solidCashOutputToLibauthOutput({
        to: spent.lockingBytecode, amount: spent.satoshis, ...(spent.token === undefined ? {} : { token: spent.token }),
      });
    }));
    const txid = await inner(hex);
    captured.push({ transaction, sourceOutputs });
    return txid;
  };
  return captured;
}

/** Signs the wallet's P2PKH inputs again, as a builder signs its own transaction, and asks the standard VM. */
function verify(spend: Spend): true | string {
  const copy: Spend = structuredClone(spend);
  copy.transaction.inputs.forEach((_input: unknown, inputIndex: number) => {
    if (binToHex(copy.sourceOutputs[inputIndex].lockingBytecode) !== binToHex(aliceLock)) return;
    copy.transaction.inputs[inputIndex].unlockingBytecode = alice.unlockP2PKH().generateUnlockingBytecode({
      transaction: copy.transaction, sourceOutputs: copy.sourceOutputs, inputIndex,
    });
  });
  return vm.verify(copy as never) as true | string;
}

/** The same transaction with one satoshi moved from output `from` to output `to`. */
function moveOne(spend: Spend, from: number, to: number): Spend {
  const copy: Spend = structuredClone(spend);
  copy.transaction.outputs[from].valueSatoshis -= 1n;
  copy.transaction.outputs[to].valueSatoshis += 1n;
  return copy;
}

/** The locking bytecode of a cash address. */
function cashLock(address: string): Uint8Array {
  const result = cashAddressToLockingBytecode(address);
  if (typeof result === 'string') throw new Error(result);
  return result.bytecode;
}

const indexOf = (spend: Spend, lock: string): number => spend.transaction.outputs
  .findIndex((output: any) => binToHex(output.lockingBytecode) === lock);

describe('a loop of `new C{value: v}()` beside a payment', () => {
  it('creates two children through deployers and pays from the same container', async () => {
    clearGenesisReservations();
    const provider = new MockNetworkProvider({ profile: 'production' });
    const captured = captureBroadcasts(provider);
    const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const artifacts = compileStringMulti(`
      pragma solidcash ^0.51.0;
      contract Pay { int n; constructor() payable { this.n = msg.value; } function pay(address payable to) public { to.transfer(1000); } }
      contract LoopFactory { int made;
        function makeTwo(bytes20 to) public {
          for (int i = 0; i < 2; i = i + 1) { new Pay{value: 5000}(); }
          this.transfer(new LockingBytecodeP2PKH(to), 3000);
          this.made = this.made + 2;
        }
      }`, { allowUnsafeOperations: true } as never);
    const funding: Utxo = { txid: 'e3'.repeat(32), vout: 0, satoshis: 100_000n };
    await provider.seedUtxo(binToHex(aliceLock), funding);
    const deployed = await StatefulContract.deploy(artifacts.LoopFactory, [], {
      provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: { made: 0n }, initialBalance: 30_000n,
      changeAddress: change.address, senderLockingBytecode: aliceLock,
    } as never);
    const container = getSatoshiContainerAddress(deployed.contract.inner, deployed.contract.categoryId);
    const sum = async (address: string): Promise<bigint> => (await provider.getUtxos(address))
      .reduce((total, utxo) => total + utxo.satoshis, 0n);
    const before = await sum(container);
    const preps: Utxo[] = [{ txid: 'e4'.repeat(32), vout: 0, satoshis: 100_000n }, { txid: 'e5'.repeat(32), vout: 0, satoshis: 100_000n }];
    for (const prep of preps) await provider.seedUtxo(binToHex(aliceLock), prep);
    const result = await StatefulContract.deployFrom({
      provider, factory: deployed.contract, deployFunctionName: 'makeTwo', deployFunctionArgs: [bobPkh],
      childArtifact: artifacts.Pay, childInitialState: { n: 5000n }, childValue: 5000n,
      fundingUtxos: preps, deployments: 2, funder: alice.unlockP2PKH(), changeAddress: change.address,
    } as never);
    expect(result.children).toHaveLength(2);
    expect(before - await sum(container)).toBe(2n * 5000n + 3000n);
    const creation = captured[captured.length - 1]!;
    expect(verify(creation)).toBe(true);
    const payment = indexOf(creation, bobLock);
    expect(creation.transaction.outputs[payment].valueSatoshis).toBe(3000n);
    const kept = indexOf(creation, binToHex(cashLock(container)));
    const changeIndex = indexOf(creation, binToHex(aliceLock));
    expect(verify(moveOne(creation, kept, changeIndex))).not.toBe(true);
    expect(verify(moveOne(creation, changeIndex, kept))).toBe(true);
  }, 600_000);
});
