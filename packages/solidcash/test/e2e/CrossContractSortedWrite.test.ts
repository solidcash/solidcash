import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin, vmNumberToBigInt, bigIntToVmNumber } from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate, keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Boundary #1: contract A calls Bank via withExternalCall, and Bank's function WRITES a C2 (sorted) mapping. The
// cross-contract dispatch now co-spends Bank's sorted entry (SortedList: exact for UPDATE, predecessor for INSERT)
// and mints Bank's entry output(s) with the commitment derived from Bank's VM trace.
const IBANK = 'interface IBank { function setBal(int k, int v); }';
const BANK = `pragma solidcash >=0.8.0;
${IBANK}
contract Bank() is IBank {
  mapping(int => int) bal;
  function setBal(int k, int v) { this.bal[k] = v; }
}`;
const CALLER = `pragma solidcash >=0.8.0;
${IBANK}
contract Caller(bytes bankAddr) {
  bigint calls;
  function poke(int k, int v, pubkey pk, sig s) {
    require(checkSig(s, pk));
    IBank(bankAddr).setBal(k, v);
    this.calls = this.calls + 1;
  }
}`;

describe('cross-contract callee C2 sorted write (normal key)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x1a00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => {
    await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 200000n });
  };
  const deploy = async (art: any, ctorArgs: any[]): Promise<any> => {
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    return StatefulContract.deploy(art, ctorArgs, {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
  };
  const balOf = async (bankInner: any, catBank: string, k: bigint): Promise<bigint | undefined> => {
    const ea = getEntryNftAddress(bankInner, catBank, 'bal');
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(bigIntToVmNumber(k)));
    return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
  };

  it('A calls Bank.setBal to UPDATE a present entry; bal[k] changes', async () => {
    const artBank = compileString(BANK, { forceStateful: true });
    const artCaller = compileString(CALLER, { forceStateful: true });

    const { contract: bank, categoryId: catBank } = await deploy(artBank, []);
    // Seed bal[5] = 10 with a direct (single-contract) call.
    await fund(bank.address);
    await bank.setBal(5n, 10n).send();
    expect(await balOf(bank.inner, catBank, 5n)).toBe(10n);

    // A embeds Bank's address; deploy A.
    const bankAddr = bank.inner.withCategory(hexToBin(catBank)).lockingBytecode;
    const { contract: caller } = await deploy(artCaller, [bankAddr]);

    // A calls Bank.setBal(5, 99): a cross-contract UPDATE of bal[5].
    await fund(caller.address);
    const tx = await caller.poke(5n, 99n, alicePub, sig).withExternalCall(bank, 'setBal', [5n, 99n]).send();
    expect(tx.txid).toBeDefined();
    expect(await balOf(bank.inner, catBank, 5n)).toBe(99n);
  });

  it('A calls Bank.setBal to INSERT an absent entry; bal[k] appears', async () => {
    const artBank = compileString(BANK, { forceStateful: true });
    const artCaller = compileString(CALLER, { forceStateful: true });
    const { contract: bank, categoryId: catBank } = await deploy(artBank, []);
    // Seed one entry so the list isn't empty (a fresh insert brackets HEAD or an existing node).
    await fund(bank.address);
    await bank.setBal(2n, 7n).send();
    const bankAddr = bank.inner.withCategory(hexToBin(catBank)).lockingBytecode;
    const { contract: caller } = await deploy(artCaller, [bankAddr]);
    // bal[9] is ABSENT -> a cross-contract INSERT (co-spend predecessor, mint P' at entry slot + NEW trailing).
    await fund(caller.address);
    const tx = await caller.poke(9n, 55n, alicePub, sig).withExternalCall(bank, 'setBal', [9n, 55n]).send();
    expect(tx.txid).toBeDefined();
    expect(await balOf(bank.inner, catBank, 9n)).toBe(55n);
    expect(await balOf(bank.inner, catBank, 2n)).toBe(7n); // pre-existing entry survives
  });

  it('A calls Bank.deposit; bal[msg.sender] resolves to A (the caller contract)', async () => {
    const IBANK2 = 'interface IBank2 { function deposit(int amt); }';
    const BANK2 = `pragma solidcash >=0.8.0;
${IBANK2}
contract Bank2() is IBank2 {
  mapping(address => int) bal;
  function deposit(int amt) { this.bal[msg.sender] = amt; }
}`;
    const CALLER2 = `pragma solidcash >=0.8.0;
${IBANK2}
contract User(bytes bankAddr) {
  bigint calls;
  function pay(int amt, pubkey pk, sig s) { require(checkSig(s, pk)); IBank2(bankAddr).deposit(amt); this.calls = this.calls + 1; }
}`;
    const artBank = compileString(BANK2, { forceStateful: true });
    const artCaller = compileString(CALLER2, { forceStateful: true });
    const { contract: bank, categoryId: catBank } = await deploy(artBank, []);
    const bankAddr = bank.inner.withCategory(hexToBin(catBank)).lockingBytecode;
    const { contract: caller } = await deploy(artCaller, [bankAddr]);

    await fund(caller.address);
    const tx = await caller.pay(42n, alicePub, sig).withExternalCall(bank, 'deposit', [42n]).send();
    expect(tx.txid).toBeDefined();
    // Bank.bal[A] == 42 (msg.sender resolved to the caller contract = its address locking script).
    const { addressToLockScript } = await import('../../src/utils.js');
    const ea = getEntryNftAddress(bank.inner, catBank, 'bal');
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(addressToLockScript(caller.address)));
    expect(e && vmNumberToBigInt(e.value, { requireMinimalEncoding: false })).toBe(42n);
  });
});
