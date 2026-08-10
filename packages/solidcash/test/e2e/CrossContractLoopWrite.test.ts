/* eslint-disable max-len -- contract source fixtures remain readable as complete declarations */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin, vmNumberToBigInt, bigIntToVmNumber } from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate, keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Boundary #1 loop sub-case: contract A calls Bank via withExternalCall, and Bank's function WRITES a vmap (sorted)
// mapping in a LOOP - `for(i) this.bal[ks[i]] (+)= vs[i]`. The cross-contract dispatch co-spends each of Bank's
// existing entries (UPDATE-only) and mints Bank's trailing loop outputs with SDK-computed commitments; Bank's
// covenant verifies (a wrong commitment reverts). An absent key (insert) fails closed.
describe('cross-contract callee vmap LOOP write', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x9a00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => { await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 300000n }); };
  const deploy = async (art: any, ctorArgs: any[]): Promise<any> => {
    const f = { txid: uid(), vout: 0, satoshis: 500000n };
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

  const IBANK = 'interface IBank { function credit(int[] ks, int[] vs); function airdrop(int[] ks, int amt); function setAll(int[] ks, int[] vs); function seed(int k, int v); }';
  const BANK = `pragma solidcash >=0.8.0;
${IBANK}
contract Bank() is IBank {
  mapping(int => int) bal;
  function seed(int k, int v) { this.bal[k] = v; }
  function credit(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] = this.bal[ks[i]] + vs[i]; } }
  function airdrop(int[] ks, int amt) { for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] = this.bal[ks[i]] + amt; } }
  function setAll(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] = vs[i]; } }
}`;
  const CALLER = `pragma solidcash >=0.8.0;
${IBANK}
contract Caller(bytes bankAddr) {
  bigint calls;
  function pokeCredit(int[] ks, int[] vs, pubkey pk, sig s) { require(checkSig(s, pk)); IBank(bankAddr).credit(ks, vs); this.calls = this.calls + 1; }
  function pokeAir(int[] ks, int amt, pubkey pk, sig s) { require(checkSig(s, pk)); IBank(bankAddr).airdrop(ks, amt); this.calls = this.calls + 1; }
  function pokeSet(int[] ks, int[] vs, pubkey pk, sig s) { require(checkSig(s, pk)); IBank(bankAddr).setAll(ks, vs); this.calls = this.calls + 1; }
}`;

  const setup = async (): Promise<any> => {
    const artBank = compileString(BANK, { forceStateful: true });
    const artCaller = compileString(CALLER, { forceStateful: true });
    const { contract: bank, categoryId: catBank } = await deploy(artBank, []);
    // Seed three existing entries.
    for (const [k, v] of [[3n, 10n], [7n, 20n], [5n, 100n]] as const) { await fund(bank.address); await bank.seed(k, v).send(); }
    const bankAddr = bank.inner.withCategory(hexToBin(catBank)).lockingBytecode;
    const { contract: caller } = await deploy(artCaller, [bankAddr]);
    return { bank, catBank, caller };
  };

  it('per-key credit: A calls Bank.credit([3,7],[5,15]); bal updates by amount', async () => {
    const { bank, catBank, caller } = await setup();
    await fund(caller.address);
    const tx = await caller.pokeCredit([3n, 7n], [5n, 15n], alicePub, sig).withExternalCall(bank, 'credit', [[3n, 7n], [5n, 15n]]).send();
    expect(tx.txid).toBeDefined();
    expect(await balOf(bank.inner, catBank, 3n)).toBe(15n); // 10 + 5
    expect(await balOf(bank.inner, catBank, 7n)).toBe(35n); // 20 + 15
    expect(await balOf(bank.inner, catBank, 5n)).toBe(100n); // untouched
  });

  it('scalar airdrop: A calls Bank.airdrop([3,5], 8); each credited by 8', async () => {
    const { bank, catBank, caller } = await setup();
    await fund(caller.address);
    const tx = await caller.pokeAir([3n, 5n], 8n, alicePub, sig).withExternalCall(bank, 'airdrop', [[3n, 5n], 8n]).send();
    expect(tx.txid).toBeDefined();
    expect(await balOf(bank.inner, catBank, 3n)).toBe(18n); // 10 + 8
    expect(await balOf(bank.inner, catBank, 5n)).toBe(108n); // 100 + 8
    expect(await balOf(bank.inner, catBank, 7n)).toBe(20n); // untouched
  });

  it('absolute set: A calls Bank.setAll([3,7],[99,88]); bal replaced', async () => {
    const { bank, catBank, caller } = await setup();
    await fund(caller.address);
    const tx = await caller.pokeSet([3n, 7n], [99n, 88n], alicePub, sig).withExternalCall(bank, 'setAll', [[3n, 7n], [99n, 88n]]).send();
    expect(tx.txid).toBeDefined();
    expect(await balOf(bank.inner, catBank, 3n)).toBe(99n);
    expect(await balOf(bank.inner, catBank, 7n)).toBe(88n);
  });

  it('callee loop that ALSO writes other state (blockSize>1) fails closed cleanly', async () => {
    // Boundary: the cross-contract loop supports a callee whose loop function touches ONLY the looped mapping.
    // A callee that also updates a scalar (data NFT) needs interleaved data-NFT derivation - fail closed for now.
    const IB = 'interface IB { function creditN(int[] ks, int[] vs); function seed(int k, int v); }';
    const BANK2 = `pragma solidcash >=0.8.0;
${IB}
contract Bank2() is IB {
  bigint ops;
  mapping(int => int) bal;
  function seed(int k, int v) { this.bal[k] = v; }
  function creditN(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] = this.bal[ks[i]] + vs[i]; } this.ops = this.ops + 1; }
}`;
    const CALLER2 = `pragma solidcash >=0.8.0;
${IB}
contract vmap(bytes bankAddr) { bigint calls; function go(int[] ks, int[] vs, pubkey pk, sig s) { require(checkSig(s, pk)); IB(bankAddr).creditN(ks, vs); this.calls = this.calls + 1; } }`;
    const artBank = compileString(BANK2, { forceStateful: true });
    const artCaller = compileString(CALLER2, { forceStateful: true });
    const { contract: bank, categoryId: catBank } = await deploy(artBank, []);
    for (const [k, v] of [[3n, 10n], [7n, 20n]] as const) { await fund(bank.address); await bank.seed(k, v).send(); }
    const bankAddr = bank.inner.withCategory(hexToBin(catBank)).lockingBytecode;
    const { contract: caller } = await deploy(artCaller, [bankAddr]);
    await fund(caller.address);
    await expect(
      caller.go([3n, 7n], [1n, 2n], alicePub, sig).withExternalCall(bank, 'creditN', [[3n, 7n], [1n, 2n]]).send(),
    ).rejects.toThrow(/only the looped mapping|other state|fails closed/i);
    expect(await balOf(bank.inner, catBank, 3n)).toBe(10n); // unchanged (fail-closed)
  });

  it('absent key (insert) fails closed', async () => {
    const { bank, caller } = await setup();
    await fund(caller.address);
    // key 9 has no entry -> a cross-contract loop insert is unsupported -> throws (fail-closed).
    await expect(
      caller.pokeCredit([9n], [1n], alicePub, sig).withExternalCall(bank, 'credit', [[9n], [1n]]).send(),
    ).rejects.toThrow(/insert is not supported|no entry|fails closed/i);
  });
});
