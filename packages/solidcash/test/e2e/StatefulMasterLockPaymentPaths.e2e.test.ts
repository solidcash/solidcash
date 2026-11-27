/**
 * A8 beyond a stateful call: a payment to a stateful master lock is refused wherever the SDK sends it, and recognised
 * for every master form whose lock spends only a coin carrying its minting NFT.
 *
 * - a plain TransactionBuilder send, which never reaches the stateful call path;
 * - a framed master, whose prologue requires the minting NFT as a direct master's pin(X) does, and a master compiled
 *   for P2SH20, whose records and container bind the category alone;
 * - a framed contract's address, its validator lock, whose program requires the category's mutable NFT.
 *
 * A wallet script that holds a minting NFT but binds no SolidCash record or container is still paid.
 */
import { describe, expect, it } from 'vitest';
import {
  OpcodesBch, binToHex, createVirtualMachineBch2026, decodeAuthenticationInstructions, encodeAuthenticationInstructions,
  encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress, type Output,
} from '@bitauth/libauth';
import {
  buildDataNftCovenantScript, buildSatoshiContainerCovenantScript, validatorAddress, validatorRedeemScript,
} from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { framedValidator } from '@solidcash/solidc/runtime';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import {
  StatefulContract, StatefulMasterPaymentError, refusePaymentsToStatefulMasters,
} from '../../src/stateful/index.js';
import { getSatoshiContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { framedContractAddress } from '../../src/framed/deploy/stateful.js';
import { satoshiContainerLockingBytecode } from '../../src/framed/deploy/records.js';
import { addressToLockScript, scriptToLockingBytecode } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
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

  it('recognises a framed master and names its container', async () => {
    const provider = new MockNetworkProvider({
      consensusLimits: {
        maximumInputBytes: 10_000_000, maximumStackItemBytes: 10_000_000, maximumTransactionBytes: 100_000_000,
      },
    });
    const vault = compileStringMulti(`pragma solidcash ^0.53.0;
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

  it('refuses a payment to a framed contract\'s address, which spends only its category\'s mutable NFT', async () => {
    const provider = new MockNetworkProvider({
      consensusLimits: {
        maximumInputBytes: 10_000_000, maximumStackItemBytes: 10_000_000, maximumTransactionBytes: 100_000_000,
      },
    });
    const vault = compileStringMulti(`pragma solidcash ^0.53.0;
contract Vault {
  int public count;
  function touch(int by) { this.count = this.count + by; require(true); }
  receive() external payable { require(true); }
}`, { composition: 'framed' }).Vault!;
    const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' });
    if (typeof change === 'string') throw new Error(change);
    const fundingUtxo: Utxo = { txid: 'e3'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.seedUtxo(binToHex(aliceLock), fundingUtxo);
    const deployed = await StatefulContract.deploy(vault, [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: change.address,
    } as never);
    const { categoryId } = deployed;
    // The contract's address is addrV(category), where its validator pool sits: coins carrying the mutable NFT.
    const address = framedContractAddress(provider.network, categoryId);
    expect(deployed.contract.address).toBe(address);
    const lock = addressToLockScript(address);
    const pool = await provider.getUtxosForLockingBytecode(lock);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((coin) => coin.token?.category === categoryId && coin.token.nft?.capability === 'mutable'))
      .toBe(true);

    // On the machine: a coin at the address spent through the only script its lock admits, the validator's redeem.
    // Holding the pool's mutable NFT the input passes the program's own-token check and fails later, on a transcript
    // the program cannot read; holding no token, or a fungible amount of the category, it fails that check itself.
    const redeem = validatorRedeemScript(hexToBin(categoryId), framedValidator.buildValidatorProgram());
    const instructions = decodeAuthenticationInstructions(redeem);
    const ownTokenCheck = instructions.findIndex((instruction, at) => instruction.opcode === OpcodesBch.OP_INPUTINDEX
      && instructions[at + 1]?.opcode === OpcodesBch.OP_UTXOTOKENCATEGORY
      && instructions[at + 2]?.opcode === OpcodesBch.OP_EQUALVERIFY);
    expect(ownTokenCheck).toBeGreaterThan(0);
    const vm = createVirtualMachineBch2026();
    const failsAt = (token: Output['token']): number => {
      const state = vm.evaluate({
        inputIndex: 0,
        sourceOutputs: [{ lockingBytecode: lock, valueSatoshis: 5_000n, ...(token === undefined ? {} : { token }) }],
        transaction: {
          version: 2,
          locktime: 0,
          inputs: [{
            outpointTransactionHash: hexToBin('e4'.repeat(32)), outpointIndex: 0, sequenceNumber: 0xffffffff,
            unlockingBytecode: Uint8Array.from([...encodeDataPush(Uint8Array.of(0x50)), ...encodeDataPush(redeem)]),
          }],
          outputs: [{ lockingBytecode: aliceLock, valueSatoshis: 4_000n }],
        },
      });
      expect(vm.stateSuccess(state)).not.toBe(true);
      expect(binToHex(encodeAuthenticationInstructions(state.instructions))).toBe(binToHex(redeem));
      // The machine moves past an instruction whether or not it fails: the failing one is the one before.
      return state.ip - 1;
    };
    const mutable = {
      category: hexToBin(categoryId), amount: 0n, nft: { capability: 'mutable', commitment: new Uint8Array() },
    };
    expect(failsAt(mutable as Output['token'])).toBeGreaterThan(ownTokenCheck + 2);
    expect(failsAt(undefined)).toBe(ownTokenCheck + 2);
    expect(failsAt({ category: hexToBin(categoryId), amount: 5n } as Output['token'])).toBe(ownTokenCheck + 2);

    // The SDK refuses such a payment wherever it is sent, naming the contract's satoshi container.
    const container = lockingBytecodeToCashAddress({
      bytecode: satoshiContainerLockingBytecode(categoryId), prefix: 'bchtest', tokenSupport: true,
    });
    if (typeof container === 'string') throw new Error(container);
    const refused = refusePaymentsToStatefulMasters(provider, [], [{ to: lock, amount: 5_000n }]);
    await expect(refused).rejects.toThrow(StatefulMasterPaymentError);
    await expect(refusePaymentsToStatefulMasters(provider, [], [{ to: address, amount: 5_000n }]))
      .rejects.toThrow(`${address}, the address of the framed contract with category ${categoryId}`);
    await expect(refusePaymentsToStatefulMasters(provider, [], [{ to: lock, amount: 5_000n }]))
      .rejects.toThrow(container.address);
    const coin: Utxo = { txid: 'e5'.repeat(32), vout: 0, satoshis: 50_000n };
    await provider.seedUtxo(binToHex(aliceLock), coin);
    await expect(new TransactionBuilder({ provider })
      .addInput(coin, alice.unlockP2PKH())
      .addOutput({ to: address, amount: 6_000n })
      .addOutput({ to: aliceLock, amount: 43_000n })
      .send()).rejects.toThrow(container.address);
    // A validator the transaction spends names the address with no lookup: here a category with nothing on chain.
    const elsewhere = 'c9'.repeat(32);
    const elsewhereLock = validatorAddress(hexToBin(elsewhere), framedValidator.buildValidatorProgram());
    const validatorInput = {
      txid: 'e6'.repeat(32), vout: 0, satoshis: 1_000n,
      token: { category: elsewhere, amount: 0n, nft: { capability: 'mutable' as const, commitment: '' } },
      unlocker: { generateLockingBytecode: () => elsewhereLock, generateUnlockingBytecode: () => new Uint8Array() },
    };
    await expect(refusePaymentsToStatefulMasters(new MockNetworkProvider(), [validatorInput as never], [
      { to: elsewhereLock, amount: 5_000n },
    ])).rejects.toThrow(`category ${elsewhere}, its validator lock`);
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
