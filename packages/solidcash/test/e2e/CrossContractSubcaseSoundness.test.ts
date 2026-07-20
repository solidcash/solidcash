import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin, vmNumberToBigInt, bigIntToVmNumber } from '@bitauth/libauth';
import { Contract, StatefulContract, SignatureTemplate, keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Cross-contract callee sorted writes support scalar UPDATE/INSERT/msg.sender (see CrossContractSortedWrite). Two
// harder callee shapes are NOT wired yet and MUST stay fail-closed (the VM rejects the tx), never a silent wrong
// write: (A) a CHUNKED (>60 B) value, (B) a LOOP write. This locks that in - "fail-closed OR correct, never
// silent-wrong": a throw passes; a sent tx must read back the CORRECT value (so an accidental silent write is caught).
describe('cross-contract callee subcase soundness (fail-closed, never silent-wrong)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0x7c00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => { await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 300000n }); };
  const deploy = async (art: any, ctorArgs: any[]): Promise<any> => {
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    return StatefulContract.deploy(art, ctorArgs, {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
  };
  const sent = async (fn: () => Promise<any>): Promise<boolean> => {
    try { await fn(); return true; } catch { return false; }
  };

  it('(A) chunked (>60 B) value cross-contract is fail-closed or correct', async () => {
    const IBANK = `interface IBank { function setBlob(int k, bytes v); }`;
    const BANK = `pragma solidcash >=0.8.0;\n${IBANK}\ncontract Bank() is IBank {
      mapping(int => bytes) blob;
      function setBlob(int k, bytes v) { this.blob[k] = v; }
      function chk(int k, bytes exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.blob[k] == exp); }
    }`;
    const CALLER = `pragma solidcash >=0.8.0;\n${IBANK}\ncontract Caller(bytes bankAddr) { bigint calls; function poke(int k, bytes v, pubkey pk, sig s) { require(checkSig(s, pk)); IBank(bankAddr).setBlob(k, v); this.calls = this.calls + 1; } }`;
    const artBank = compileString(BANK, { forceStateful: true });
    const artCaller = compileString(CALLER, { forceStateful: true });
    const { contract: bank, categoryId: catBank } = await deploy(artBank, []);
    await fund(bank.address);
    await bank.setBlob(2n, Uint8Array.from([0x01])).send(); // seed
    const bankAddr = bank.inner.withCategory(hexToBin(catBank)).lockingBytecode;
    const { contract: caller } = await deploy(artCaller, [bankAddr]);
    await fund(caller.address);
    const big = new Uint8Array(80).fill(0x5a);
    const didSend = await sent(() => caller.poke(9n, big, alicePub, sig).withExternalCall(bank, 'setBlob', [9n, big]).send());
    if (didSend) {
      // NOT fail-closed -> the write MUST be correct (chk reverts on a wrong value, failing this test).
      await fund(bank.address);
      expect((await bank.chk(9n, big, alicePub, sig).send()).txid).toBeDefined();
    } // else: fail-closed (VM rejected), which is the currently-expected, sound outcome.
    expect(true).toBe(true);
  });

  it('(B) loop write cross-contract is fail-closed or correct', async () => {
    const IBANK = `interface IBank { function credit(int[] ks, int[] vs); }`;
    const BANK = `pragma solidcash >=0.8.0;\n${IBANK}\ncontract Bank() is IBank { mapping(int => int) bal; function credit(int[] ks, int[] vs) { for (int i = 0; i < ks.length; i++) { this.bal[ks[i]] = this.bal[ks[i]] + vs[i]; } } }`;
    const CALLER = `pragma solidcash >=0.8.0;\n${IBANK}\ncontract Caller(bytes bankAddr) { bigint calls; function poke(int[] ks, int[] vs, pubkey pk, sig s) { require(checkSig(s, pk)); IBank(bankAddr).credit(ks, vs); this.calls = this.calls + 1; } }`;
    const artBank = compileString(BANK, { forceStateful: true });
    const artCaller = compileString(CALLER, { forceStateful: true });
    const { contract: bank, categoryId: catBank } = await deploy(artBank, []);
    await fund(bank.address);
    await bank.credit([3n], [10n]).send(); // seed bal[3]=10
    const bankAddr = bank.inner.withCategory(hexToBin(catBank)).lockingBytecode;
    const { contract: caller } = await deploy(artCaller, [bankAddr]);
    await fund(caller.address);
    const didSend = await sent(() => caller.poke([3n], [5n], alicePub, sig).withExternalCall(bank, 'credit', [[3n], [5n]]).send());
    const ea = getEntryNftAddress(bank.inner, catBank, 'bal');
    const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(bigIntToVmNumber(3n)));
    const bal3 = e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    // Fail-closed: bal[3] stays the seeded 10. If it sent, it MUST be the correct 15 (never a silent wrong value).
    expect(bal3).toBe(didSend ? 15n : 10n);
  });
});
