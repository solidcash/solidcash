import { describe, it, expect } from 'vitest';
import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Per-iteration C2 UPDATE loop `for(i) m[k[i]] += v[i]` (the multitransfer CREDIT half to EXISTING recipients). Each
// iteration co-spends k[i]'s OWN entry at input[master+blockSize+i], verifies its slot == keyToSlot(k[i]), and mints
// the updated entry (oldValue op v[i]) at output[master+blockSize+i]. 1:1 co-spend/mint, source order = counter order
// (no permutation); the covenant binds each credit to keyToSlot(k[i]) AND to v[i], and pins entry-input-count ==
// entry-output-count == N (no orphan / no extra), so supply is conserved. A recipient with no existing entry, or a
// duplicate recipient, fails CLOSED (clear SDK error - insert-in-loop / double-co-spend are separate covenants).
const SRC = `contract Token() {
  mapping(int => int) bal;
  function setBal(int a, int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.bal[a] = v; }
  function airdrop(int[] recipients, int[] amounts, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (int i = 0; i < recipients.length; i++) { this.bal[recipients[i]] += amounts[i]; }
  }
  function debitAll(int[] accounts, int[] amounts, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (int i = 0; i < accounts.length; i++) { this.bal[accounts[i]] -= amounts[i]; }
  }
  function chk(int a, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(this.bal[a] == exp); }
}`;

describe('C2 diff-key per-iteration UPDATE loop (multitransfer credit to existing recipients)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xd200;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => {
    await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 200000n });
  };

  const setup = async (): Promise<{ contract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    valOf: (k: bigint) => Promise<bigint | undefined>;
    call: (fn: string, ...a: unknown[]) => Promise<{ txid: string }>; }> => {
    const art = compileString(SRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract, categoryId } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const ea = getEntryNftAddress(contract.inner, categoryId, 'bal');
    const valOf = async (k: bigint): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(bigIntToVmNumber(k)));
      return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    };
    const call = (fn: string, ...a: unknown[]): Promise<{ txid: string }> => {
      type C = Record<string, (...args: unknown[]) => { send: () => Promise<{ txid: string }> }>;
      return (contract as unknown as C)[fn](...a, alicePub, sig).send();
    };
    return { contract, valOf, call };
  };

  it('credits N existing recipients by their per-key amounts (exact), wrong value reverts', async () => {
    const { contract, valOf, call } = await setup();
    await fund(contract.address); await call('setBal', 3n, 100n);
    await fund(contract.address); await call('setBal', 7n, 200n);
    await fund(contract.address); await call('setBal', 5n, 50n);

    await fund(contract.address);
    await call('airdrop', [3n, 7n, 5n], [10n, 20n, 5n]);
    expect(await valOf(3n)).toBe(110n);
    expect(await valOf(7n)).toBe(220n);
    expect(await valOf(5n)).toBe(55n);

    await fund(contract.address); await expect(call('chk', 7n, 220n)).resolves.toBeDefined();
    await fund(contract.address); await expect(call('chk', 7n, 200n)).rejects.toThrow(); // not the pre-credit value
  });

  it('the -= variant debits existing accounts', async () => {
    const { contract, valOf, call } = await setup();
    await fund(contract.address); await call('setBal', 1n, 500n);
    await fund(contract.address); await call('setBal', 2n, 300n);
    await fund(contract.address);
    await call('debitAll', [1n, 2n], [50n, 100n]);
    expect(await valOf(1n)).toBe(450n);
    expect(await valOf(2n)).toBe(200n);
  });

  it('fails closed on a recipient with NO existing entry (insert-in-loop unsupported)', async () => {
    const { contract, call } = await setup();
    await fund(contract.address); await call('setBal', 3n, 100n);
    await fund(contract.address);
    // 9 has no entry -> the SDK cannot co-spend it -> clear error (not a silent skip / wrong store).
    await expect(call('airdrop', [3n, 9n], [10n, 20n])).rejects.toThrow(/no existing entry|not supported|already hold/i);
  });

  it('fails closed on a duplicate recipient (each entry co-spent once)', async () => {
    const { contract, call } = await setup();
    await fund(contract.address); await call('setBal', 3n, 100n);
    await fund(contract.address);
    await expect(call('airdrop', [3n, 3n], [10n, 20n])).rejects.toThrow(/duplicate/i);
  });
});
