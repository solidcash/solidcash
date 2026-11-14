/**
 * A8 beyond a stateful call: a payment to a stateful master lock is refused wherever the SDK sends it, and recognised
 * for every master form whose lock spends only a coin carrying its minting NFT.
 *
 * - a plain TransactionBuilder send, and a message-bus composition, which never reach the stateful call path;
 * - a framed master, whose prologue requires the minting NFT as a direct master's pin(X) does, and a master compiled
 *   for P2SH20, whose records and container bind the category alone.
 *
 * A wallet script that holds a minting NFT but binds no SolidCash record or container is still paid.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { buildDataNftCovenantScript, buildSatoshiContainerCovenantScript, type Artifact } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import {
  StatefulContract, StatefulMasterPaymentError, refusePaymentsToStatefulMasters,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { scriptToLockingBytecode } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';

const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const alice = new SignatureTemplate(alicePriv);

/** A master coin: the minting NFT of `category` at `lock`. */
const masterCoin = (txid: string, category: string): Utxo => ({
  txid: txid.repeat(32), vout: 0, satoshis: 1_000n,
  token: { category, amount: 0n, nft: { capability: 'minting', commitment: '' } },
});

describe('a payment to a stateful master lock, beyond the stateful call path (A8)', () => {
  it('refuses a plain TransactionBuilder send to a master address and pays its container', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const funding: Utxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 200_000n };
    await provider.seedUtxo(binToHex(aliceLock), funding);
    const target = await StatefulContract.deploy(compileString(`contract Target {
    int x;
    function spend(address to, int amount) public { this.transfer(to, amount); this.x = this.x + 1; }
}`, { suppressWarnings: true } as never), [], {
      provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), initialState: { x: 0n }, initialBalance: 2_000n,
      changeAddress: change.address, senderLockingBytecode: aliceLock,
    } as never);
    const containerAddress = getSatoshiContainerAddress(target.contract.inner, target.categoryId);
    const pay = async (to: Uint8Array | string, txid: string): Promise<unknown> => {
      const coin: Utxo = { txid: txid.repeat(32), vout: 0, satoshis: 50_000n };
      await provider.seedUtxo(binToHex(aliceLock), coin);
      return new TransactionBuilder({ provider })
        .addInput(coin, alice.unlockP2PKH())
        .addOutput({ to, amount: 6_000n })
        .addOutput({ to: aliceLock, amount: 43_000n })
        .send();
    };
    const master = hexToBin(target.contract.inner.lockingBytecode);
    await expect(pay(master, 'f2')).rejects.toThrow(StatefulMasterPaymentError);
    await expect(pay(master, 'f3')).rejects.toThrow(containerAddress);
    await expect(pay(containerAddress, 'f4')).resolves.toBeDefined();
  }, 300_000);

  it('refuses a composed call that pays a master lock', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifacts = compileStringMulti(`interface IPayer { function pay(bytes recipient, int amount); }
contract Payer() {
  int n;
  function pay(bytes recipient, int amount) public { this.transfer(recipient, amount); require(true); }
}
contract Driver(address payer) {
  function run(bytes recipient, int amount) public { IPayer(payer).pay(recipient, amount); require(true); }
}`, { forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000, suppressWarnings: true });
    const connect = async (artifact: Artifact, args: Uint8Array[] = []): Promise<StatefulContract> => {
      const base = new Contract(artifact, args, { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      return StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
    };
    const payer = await connect(artifacts.Payer);
    const driver = await connect(artifacts.Driver, [hexToBin(payer.inner.lockingBytecode)]);
    await provider.addUtxo(getSatoshiContainerAddress(payer.inner, payer.categoryId), {
      txid: 'd6'.repeat(32), vout: 1, satoshis: 30_000n,
    });
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const wallet = fee.unlocker.generateLockingBytecode();
    const send = (recipient: Uint8Array): Promise<unknown> => messageBus.compose({
      preparedCalls: [
        { contract: driver, functionName: 'run', args: [recipient, 2_000n] },
        { contract: payer, functionName: 'pay', args: [recipient, 2_000n] },
      ],
      funder: fee, changeAddress: wallet,
    }).send();
    // The payer's own master lock, which the composition spends: the transaction shows it is a master.
    await expect(send(hexToBin(payer.inner.lockingBytecode))).rejects.toThrow(StatefulMasterPaymentError);
    await expect(send(wallet)).resolves.toBeDefined();
  }, 300_000);

  it('recognises a framed master and names its container', async () => {
    const provider = new MockNetworkProvider({
      consensusLimits: {
        maximumInputBytes: 10_000_000, maximumStackItemBytes: 10_000_000, maximumTransactionBytes: 100_000_000,
      },
    });
    const vault = compileStringMulti(`pragma solidcash ^0.50.0;
contract Vault {
  int public count;
  function touch(int by) { this.count = this.count + by; require(true); }
  receive() external payable { require(true); }
}`, { composition: 'framed' }).Vault!;
    const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const fundingUtxo: Utxo = { txid: 'e1'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(binToHex(aliceLock), fundingUtxo);
    const deployed = await StatefulContract.deploy(vault, [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: change.address,
    } as never);
    // A framed contract's masters are its category's minting NFTs, at the lock its master program derives.
    const masters = (await provider.getUtxosByTokenCategory(deployed.categoryId))
      .filter((coin) => coin.token?.nft?.capability === 'minting');
    expect(masters.length).toBeGreaterThan(0);
    const master = masters[0]!.lockingBytecode!;
    const container = scriptToLockingBytecode(buildSatoshiContainerCovenantScript(hexToBin(deployed.categoryId)), 'p2sh32');
    await provider.addUtxo(binToHex(container), { txid: 'e2'.repeat(32), vout: 0, satoshis: 3_000n });
    const containerAddress = lockingBytecodeToCashAddress({ bytecode: container, prefix: 'bchtest', tokenSupport: true });
    if (typeof containerAddress === 'string') throw new Error(containerAddress);
    await expect(refusePaymentsToStatefulMasters(provider, [], [{ to: master, amount: 5_000n }]))
      .rejects.toThrow(containerAddress.address);
  }, 300_000);

  it('recognises a P2SH20 master by its record, and pays a minting-NFT script with none', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const category = 'c8'.repeat(32);
    const master = Uint8Array.from([0xa9, 0x14, ...new Uint8Array(20).fill(0x5d), 0x87]);
    await provider.seedUtxo(binToHex(master), masterCoin('a8', category));
    const payment = [{ to: master, amount: 5_000n }];
    // No record and no container bound to it: a wallet script holding a minting NFT, which is paid.
    await expect(refusePaymentsToStatefulMasters(provider, [], payment)).resolves.toBeUndefined();
    const record = scriptToLockingBytecode(buildDataNftCovenantScript(hexToBin(category)), 'p2sh20');
    await provider.seedUtxo(binToHex(record), {
      txid: 'a9'.repeat(32), vout: 0, satoshis: 1_000n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment: '00' } },
    });
    await expect(refusePaymentsToStatefulMasters(provider, [], payment)).rejects.toThrow(StatefulMasterPaymentError);
  }, 300_000);
});
