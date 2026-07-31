import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin, vmNumberToBigInt,
} from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Boundary #1: a C2 (sorted) mapping keyed by msg.sender, written by the callee of a CROSS-CONTRACT call. Contract A
// calls Bank.deposit(); inside Bank, msg.sender = A (the caller contract), not an EOA. The covenant resolves it via
// the co-spent caller's minting NFT (emitMsgSenderMintingVerification -> caller LBC); the SDK must key the entry by
// keyToSlot(A's locking bytecode) and co-spend A's master as the msg.sender proof.
const IBANK = 'interface IBank { function deposit(int amt); }';
const BANK = `pragma solidcash >=0.8.0;
${IBANK}
contract Bank() is IBank {
  mapping(address => int) bal;
  function deposit(int amt) { this.bal[msg.sender] = amt; }
}`;
const CALLER = `pragma solidcash >=0.8.0;
${IBANK}
contract Caller(bytes bankAddr) {
  bigint calls;
  function pay(int amt, pubkey pk, sig s) {
    require(checkSig(s, pk));
    IBank(bankAddr).deposit(amt);
    this.calls = this.calls + 1;
  }
}`;
const CALLER_SWAP = `pragma solidcash >=0.8.0;
${IBANK}
contract Caller(bytes bankAddr, bytes marker) {
  bigint calls;
  function pay(int amt) {
    IBank(bankAddr).deposit(amt);
    this.calls = this.calls + 1;
    require(marker.length > 0);
  }
}`;

// Cross-contract dispatch must derive the callee's sorted-entry predecessor/target and key msg.sender by the
// caller's category-pinned locking bytecode. The assertion decodes the resulting C2 entry from the provider.
describe('cross-contract msg.sender-keyed C2 mapping (callee bal[msg.sender], caller = contract A)', () => {
  it('A calls Bank.deposit(); Bank.bal[A] == amt (msg.sender = caller contract)', async () => {
    const provider = createTestProvider();
    const artBank = compileString(BANK, { forceStateful: true });
    const artCaller = compileString(CALLER, { forceStateful: true });
    const artCallerWithBatchExperiment = compileString(CALLER, {
      forceStateful: true,
      experimentalRepeatedExternalBatch: true,
    });
    expect(artCallerWithBatchExperiment.debug?.bytecode).toBe(artCaller.debug?.bytecode);
    expect(artCallerWithBatchExperiment.abi[0].externalCalls?.[0].batchInvocations)
      .toBeUndefined();

    // Genesis Bank first (A embeds Bank's category).
    const bank = new Contract(artBank, [], { provider });
    const { categoryId: catBank } = await setupStatefulUtxos(
      provider, bank, artBank.stateLayout!, {}, { saltContract: true },
    );
    const bankAddr = bank.withCategory(hexToBin(catBank)).lockingBytecode;
    const caller = new Contract(artCaller, [bankAddr], { provider });
    const { categoryId: catCaller } = await setupStatefulUtxos(
      provider, caller, artCaller.stateLayout!, { calls: 0n }, { saltContract: true },
    );

    const scCaller = StatefulContract.withCategory(caller, catCaller);
    const scBank = StatefulContract.withCategory(bank, catBank);
    const callerLbc = hexToBin(caller.withCategory(hexToBin(catCaller)).lockingBytecode);

    const tx = await scCaller.pay(7n, alicePub, new SignatureTemplate(alicePriv))
      .withExternalCall(scBank, 'deposit', [7n])
      .send();
    expect(tx.txid).toBeDefined();

    // Bank.bal[A's locking bytecode] == 7.
    const ea = getEntryNftAddress(scBank.inner, catBank, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(callerLbc));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(7n);
  });

  it('rejects an LBC-swapped caller while preserving the transaction shape and Bank entry output', async () => {
    const provider = createTestProvider();
    const artBank = compileString(BANK, { forceStateful: true });
    const artCaller = compileString(CALLER_SWAP, { forceStateful: true });
    const bank = new Contract(artBank, [], { provider });
    const { categoryId: catBank } = await setupStatefulUtxos(
      provider, bank, artBank.stateLayout!, {}, { saltContract: true },
    );
    const bankAddr = bank.withCategory(hexToBin(catBank)).lockingBytecode;
    const callerA = new Contract(artCaller, [bankAddr, hexToBin('aa')], { provider });
    const callerB = new Contract(artCaller, [bankAddr, hexToBin('bb')], { provider });
    const { categoryId: catA } = await setupStatefulUtxos(
      provider, callerA, artCaller.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const { categoryId: catB } = await setupStatefulUtxos(
      provider, callerB, artCaller.stateLayout!, { calls: 0n }, { saltContract: true },
    );
    const scBank = StatefulContract.withCategory(bank, catBank);
    const scA = StatefulContract.withCategory(callerA, catA);
    const scB = StatefulContract.withCategory(callerB, catB);
    const masterA = (await provider.getUtxos(callerA.withCategory(hexToBin(catA)).address))
      .find((utxo) => utxo.token?.category === catA);
    const masterB = (await provider.getUtxos(callerB.withCategory(hexToBin(catB)).address))
      .find((utxo) => utxo.token?.category === catB);
    expect(masterA).toBeDefined();
    expect(masterB).toBeDefined();

    const send = provider.sendRawTransaction.bind(provider);
    const capture = async (call: () => Promise<unknown>): Promise<string> => {
      let raw = '';
      (provider as any).sendRawTransaction = async (transaction: string): Promise<string> => {
        raw = transaction;
        throw new Error('capture-only');
      };
      try { await expect(call()).rejects.toThrow('capture-only'); } finally {
        (provider as any).sendRawTransaction = send;
      }
      expect(raw).not.toBe('');
      return raw;
    };

    const rawA = await capture(() => scA.pay(7n).withExternalCall(scBank, 'deposit', [7n]).send());
    const rawB = await capture(() => scB.pay(7n).withExternalCall(scBank, 'deposit', [7n]).send());
    const forged = decodeTransactionUnsafe(hexToBin(rawA));
    const donor = decodeTransactionUnsafe(hexToBin(rawB));
    const inputA = forged.inputs.findIndex((input) =>
      binToHex(input.outpointTransactionHash) === masterA!.txid && input.outpointIndex === masterA!.vout);
    const inputB = donor.inputs.findIndex((input) =>
      binToHex(input.outpointTransactionHash) === masterB!.txid && input.outpointIndex === masterB!.vout);
    const outputA = forged.outputs.findIndex((output) => binToHex(output.token?.category ?? new Uint8Array()) === catA);
    const outputB = donor.outputs.findIndex((output) => binToHex(output.token?.category ?? new Uint8Array()) === catB);
    expect([inputA, inputB, outputA, outputB].every((index) => index >= 0)).toBe(true);
    expect(callerA.lockingBytecode).not.toBe(callerB.lockingBytecode);
    forged.inputs[inputA] = donor.inputs[inputB];
    forged.outputs[outputA] = donor.outputs[outputB];
    expect(encodeTransaction(forged).length).toBe(hexToBin(rawA).length);

    await expect(send(binToHex(encodeTransaction(forged)))).rejects.toThrow(
      'mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 0: Program failed an OP_VERIFY operation.)',
    );

    await expect(send(rawA)).resolves.toBeTypeOf('string');
    await expect(scB.pay(9n).withExternalCall(scBank, 'deposit', [9n]).send()).resolves.toBeDefined();
  }, 300_000);
});
