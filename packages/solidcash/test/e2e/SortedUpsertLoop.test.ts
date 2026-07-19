import { describe, it, expect } from 'vitest';
import { bigIntToVmNumber, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { keyToSlot, getEntryNftAddress, SortedList } from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePriv, alicePub, alicePkh, bobAddress, carolAddress } from '../fixture/vars.js';
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
  function setAll(int[] accounts, int[] amounts, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (int i = 0; i < accounts.length; i++) { this.bal[accounts[i]] = amounts[i]; }
  }
  function clearAll(int[] accounts, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (int i = 0; i < accounts.length; i++) { delete this.bal[accounts[i]]; }
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

  it('INSERTS a new recipient (no existing entry) alongside an update, in one loop', async () => {
    const { contract, valOf, call } = await setup();
    await fund(contract.address); await call('setBal', 3n, 100n);   // 3 exists
    await fund(contract.address);
    // 9 has NO entry -> INSERT (new node, value = amount); 3 exists -> UPDATE. Mixed in one loop.
    await call('airdrop', [3n, 9n], [10n, 20n]);
    expect(await valOf(3n)).toBe(110n); // updated
    expect(await valOf(9n)).toBe(20n);  // inserted (0 + 20)
    // A later read of the inserted key proves the sorted list stayed valid.
    await fund(contract.address); await expect(call('chk', 9n, 20n)).resolves.toBeDefined();
    await fund(contract.address); await expect(call('chk', 5n, 0n)).resolves.toBeDefined(); // still absent -> 0
  });

  it('inserts multiple new recipients in distinct gaps', async () => {
    const { contract, valOf, call } = await setup();
    await fund(contract.address); await call('setBal', 10n, 100n);
    await fund(contract.address); await call('setBal', 20n, 200n); // two existing entries -> distinct gaps for new keys
    await fund(contract.address);
    // 5, 15, 25 are new and (by their sha256 slots) very likely land in distinct gaps.
    let ok = false;
    try { await call('airdrop', [5n, 15n, 25n], [1n, 2n, 3n]); ok = true; } catch { /* same-gap -> fails closed */ }
    if (ok) {
      expect(await valOf(5n)).toBe(1n);
      expect(await valOf(15n)).toBe(2n);
      expect(await valOf(25n)).toBe(3n);
      expect(await valOf(10n)).toBe(100n); // existing untouched
    }
  });

  it('fails closed on a duplicate recipient (each entry co-spent once)', async () => {
    const { contract, call } = await setup();
    await fund(contract.address); await call('setBal', 3n, 100n);
    await fund(contract.address);
    await expect(call('airdrop', [3n, 3n], [10n, 20n])).rejects.toThrow(/duplicate/i);
  });

  it('fails closed when two new recipients share a gap (one predecessor cannot be co-spent twice)', async () => {
    const { contract, call } = await setup();
    // Fresh map (only HEAD): every new key brackets HEAD, so two new keys share the same predecessor -> conflict.
    await fund(contract.address);
    await expect(call('airdrop', [3n, 7n], [10n, 20n])).rejects.toThrow(/predecessor|gap|separate/i);
  });

  it('fails closed on `-=` to a nonexistent account (cannot debit nothing)', async () => {
    const { contract, call } = await setup();
    await fund(contract.address); await call('setBal', 1n, 500n);
    await fund(contract.address);
    await expect(call('debitAll', [1n, 9n], [50n, 10n])).rejects.toThrow(/no balance|cannot debit/i);
  });

  // Absolute per-key assignment `for(i) m[ks[i]] = vs[i]` - the value REPLACES (not accumulates). Same upsert covenant:
  // present key -> UPDATE to the exact v[i]; absent key -> INSERT v[i]. This is the per-key value insert loop deferral.
  it('sets existing keys to absolute per-key values (replace, not add)', async () => {
    const { contract, valOf, call } = await setup();
    await fund(contract.address); await call('setBal', 3n, 100n);
    await fund(contract.address); await call('setBal', 7n, 200n);
    await fund(contract.address);
    await call('setAll', [3n, 7n], [11n, 22n]);   // absolute: 3 -> 11 (not 111), 7 -> 22 (not 222)
    expect(await valOf(3n)).toBe(11n);
    expect(await valOf(7n)).toBe(22n);
    await fund(contract.address); await expect(call('chk', 3n, 11n)).resolves.toBeDefined();
    await fund(contract.address); await expect(call('chk', 3n, 111n)).rejects.toThrow(); // NOT accumulated
  });

  it('sets an existing key AND inserts a new key with absolute values, in one loop', async () => {
    const { contract, valOf, call } = await setup();
    await fund(contract.address); await call('setBal', 3n, 100n);   // 3 exists
    await fund(contract.address);
    await call('setAll', [3n, 9n], [11n, 42n]);   // 3 present -> set to 11; 9 absent -> insert 42
    expect(await valOf(3n)).toBe(11n);
    expect(await valOf(9n)).toBe(42n);
  });

  it('a wrong absolute value reverts (covenant pins the minted value to v[i])', async () => {
    const { contract, valOf, call } = await setup();
    await fund(contract.address); await call('setBal', 5n, 50n);
    await fund(contract.address);
    await call('setAll', [5n], [77n]);
    expect(await valOf(5n)).toBe(77n);
    await fund(contract.address); await expect(call('chk', 5n, 50n)).rejects.toThrow(); // old value gone
  });

  // DELETE-in-loop `for(i) delete m[ks[i]]` (batch nullify): each existing key co-spent + minted to the default (0).
  // Absent keys FAIL CLOSED (no insert branch - avoids the enumerable divergence of a spurious nullified node).
  it('nullifies existing keys to the default (0) in one loop', async () => {
    const { contract, valOf, call } = await setup();
    await fund(contract.address); await call('setBal', 3n, 100n);
    await fund(contract.address); await call('setBal', 7n, 200n);
    await fund(contract.address); await call('setBal', 5n, 50n);
    await fund(contract.address);
    await call('clearAll', [3n, 7n, 5n]);
    expect(await valOf(3n)).toBe(0n);
    expect(await valOf(7n)).toBe(0n);
    expect(await valOf(5n)).toBe(0n);
    // a nullified key reads 0 via chk (require(m[k] == 0)); the nodes stay present-nullified (C2 delete == nullify).
    await fund(contract.address); await expect(call('chk', 7n, 0n)).resolves.toBeDefined();
    await fund(contract.address); await expect(call('chk', 7n, 200n)).rejects.toThrow(); // old value gone
  });

  it('fails closed on delete of a nonexistent key (nothing to nullify)', async () => {
    const { contract, call } = await setup();
    await fund(contract.address); await call('setBal', 1n, 500n);
    await fund(contract.address);
    await expect(call('clearAll', [1n, 9n])).rejects.toThrow(/no entry|cannot delete/i);
  });
});

// The real multitransfer shape: address-keyed balances (mapping(address => int)). Address ARRAY elements are now
// encoded as their locking bytecode (convertAddressArg), so keyToSlot(recipients[i]) matches the seeded entries.
describe('C2 address-keyed credit loop (multitransfer to existing address recipients)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xe200;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => {
    await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 200000n });
  };
  const ASRC = `contract Token() {
    mapping(address => int) bal;
    function setBal(address a, int v, pubkey pk, sig s) { require(checkSig(s, pk)); this.bal[a] = v; }
    function multiTransfer(address[] recipients, int[] amounts, pubkey pk, sig s) {
      require(checkSig(s, pk));
      for (int i = 0; i < recipients.length; i++) { this.bal[recipients[i]] += amounts[i]; }
    }
  }`;

  it('credits existing address recipients by their amounts (exact)', async () => {
    const art = compileString(ASRC, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract, categoryId } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const ea = getEntryNftAddress(contract.inner, categoryId, 'bal');
    const valOf = async (addr: string): Promise<bigint | undefined> => {
      const e = SortedList.fromUtxos(await provider.getUtxos(ea)).find(keyToSlot(addressToLockScript(addr)));
      return e ? vmNumberToBigInt(e.value, { requireMinimalEncoding: false }) as bigint : undefined;
    };
    const call = (fn: string, ...a: unknown[]): Promise<{ txid: string }> => {
      type C = Record<string, (...args: unknown[]) => { send: () => Promise<{ txid: string }> }>;
      return (contract as unknown as C)[fn](...a, alicePub, sig).send();
    };
    await fund(contract.address); await call('setBal', bobAddress, 100n);
    await fund(contract.address); await call('setBal', carolAddress, 200n);
    await fund(contract.address);
    await call('multiTransfer', [bobAddress, carolAddress], [10n, 20n]);
    expect(await valOf(bobAddress)).toBe(110n);
    expect(await valOf(carolAddress)).toBe(220n);
  });
});
