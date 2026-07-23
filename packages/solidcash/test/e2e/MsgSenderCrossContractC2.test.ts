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

// Cross-contract dispatch must derive the callee's sorted-entry predecessor/target and key msg.sender by the
// caller's category-pinned locking bytecode. The assertion decodes the resulting C2 entry from the provider.
describe('cross-contract msg.sender-keyed C2 mapping (callee bal[msg.sender], caller = contract A)', () => {
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
});
