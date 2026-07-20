import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePub, alicePriv } from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Boundary #1: a C2 (sorted) mapping keyed by msg.sender, written by the callee of a CROSS-CONTRACT call. Contract A
// calls Bank.deposit(); inside Bank, msg.sender = A (the caller contract), not an EOA. The covenant resolves it via
// the co-spent caller's minting NFT (emitMsgSenderMintingVerification -> caller LBC); the SDK must key the entry by
// keyToSlot(A's locking bytecode) and co-spend A's master as the msg.sender proof.
const IBANK = `interface IBank { function deposit(int amt); }`;
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

// DEFERRED (boundary #1). Root cause found: the cross-contract dispatch (externalCallUtxoGroups) derives only the
// callee's SCALAR data NFTs, not its sorted-mapping ENTRY co-spend - so ANY callee sorted-mapping WRITE fails on the
// VM (verified: even a normal-key `bal[k]=v` cross-contract write fails input 2 OP_OUTPUTTOKENCOMMITMENT verify).
// So the msg.sender variant is blocked on the larger missing feature: callee sorted-mapping entry derivation in the
// external group (co-spend entry/predecessor, mint P'/NEW in the callee's block layout, pin) - THEN key it by
// keyToSlot(caller LBC) + set the callee's _msgSenderCategory = caller category. The covenant already resolves a
// contract msg.sender (emitMsgSenderMintingVerification); the gap is entirely SDK callee-entry derivation. This test
// is a reproduction to un-skip once that lands. See docs/deferrals.md.
describe.skip('cross-contract msg.sender-keyed C2 mapping (callee bal[msg.sender], caller = contract A)', () => {
  it('A calls Bank.deposit(); Bank.bal[A] == amt (msg.sender = caller contract)', async () => {
    const provider = createTestProvider();
    const artBank = compileString(BANK, { forceStateful: true });
    const artCaller = compileString(CALLER, { forceStateful: true });

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
    const callerLbc = caller.withCategory(hexToBin(catCaller)).lockingBytecode;

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
});
