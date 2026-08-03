import { describe, it, expect } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { getEntryNftAddress, SortedList, bytesToSlotValue } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

const verifyFailure = 'messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// C2 default mode backs every mapping with the authenticated linked-list model, so
// reads are unforgeable (exclusion-proven on absent) = Solidity storage parity, WITHOUT naming each mapping.
// End-to-end: deploy (HEAD auto-minted) -> write -> present read -> absent read (proven default, not omittable).
const SRC = `contract C() {
  mapping(int => bigint) balances;
  function set(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); balances[k] = v; }
  function check(int k, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(balances[k] == exp); }
}`;

describe('C2 default mode (every mapping is C2)', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xa00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (addr: string): Promise<void> => {
    await provider.addUtxo(addr, { txid: uid(), vout: 0, satoshis: 100000n });
  };

  it('a plain mapping deploys + reads/writes with exclusion proofs', async () => {
    const art = compileString(SRC, { forceStateful: true });
    expect(art.stateLayout?.collections?.find((c) => c.name === 'balances')?.sorted).toBe(true); // C2 without naming it

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    const categoryId = contract.categoryId!;
    const ea = getEntryNftAddress(new Contract(art, [], { provider }).withCategory(hexToBin(categoryId)), categoryId, 'balances');
    expect(SortedList.fromUtxos(await provider.getUtxos(ea)).all.some((e) => bytesToSlotValue(e.slot) === 0n)).toBe(true);

    await fund(contract.address);
    expect((await contract.set(5n, 10n, alicePub, sig).send()).txid).toBeDefined(); // write balances[5]=10

    await fund(contract.address);
    expect((await contract.check(5n, 10n, alicePub, sig).send()).txid).toBeDefined(); // present read matches
    await fund(contract.address);
    expect((await contract.check(3n, 0n, alicePub, sig).send()).txid).toBeDefined(); // absent -> proven default 0
    await fund(contract.address);
    // Absent claimed nonzero -> revert.
    await expect(contract.check(3n, 7n, alicePub, sig).send()).rejects.toThrow(verifyFailure);
  });

  it('a C2 mapping WRITE via an internal (subroutine-candidate) helper compiles + round-trips', async () => {
    // `balances[k] = v` inside an internal `_set` used to fail "Block layout not available" (a C2 write needs the
    // entry-slot block layout only an entry point has). InlineStoragePointerCalls now inlines a helper that
    // directly OR transitively writes a sorted mapping into its entry-point caller - the OZ _mint/_approve shape.
    const src = `contract C() {
      mapping(int => bigint) balances;
      function _set(int k, int v) internal { balances[k] = v; }
      function _setVia(int k, int v) internal { _set(k, v); }
      function set(int k, int v, pubkey pk, sig s) { require(checkSig(s, pk)); _setVia(k, v); }
      function check(int k, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(balances[k] == exp); }
    }`;
    const art = compileString(src, { forceStateful: true });
    expect(art.abi.some((f) => f.name === '_set' || f.name === '_setVia')).toBe(false); // helpers inlined, not subroutines

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    await fund(contract.address);
    expect((await contract.set(7n, 42n, alicePub, sig).send()).txid).toBeDefined(); // write via the inlined helper chain
    await fund(contract.address);
    expect((await contract.check(7n, 42n, alicePub, sig).send()).txid).toBeDefined(); // read back the persisted value
  });

  it('a NESTED C2 mapping with a computed key (allow[hash160(pk)][b]) writes + reads (multi-key expression key)', async () => {
    // `allow[hash160(pk)][b]` is a nested (composite-key) sorted mapping whose FIRST key is an EXPRESSION
    // (hash160(pk)), not a bare param - the covenant emitSortedKeyHash now tracks the accumulator so an expression
    // key past the first hashes correctly; the SDK auto-derives the computed key (evalComputedKey). This is the
    // ERC-20 `allowances[owner][spender]` shape. slot = sha256(sha256(H(pk)) ++ sha256(b)) (keyToSlotMulti).
    const src = `contract C() {
      mapping(bytes20 => mapping(int => bigint)) allow;
      function approve(int b, int v, pubkey pk, sig s) { require(checkSig(s, pk)); allow[hash160(pk)][b] = v; }
      function check(bytes20 owner, int b, int exp, pubkey pk, sig s) { require(checkSig(s, pk)); require(allow[owner][b] == exp); }
    }`;
    const art = compileString(src, { forceStateful: true });

    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {}, changeAddress: p2pkh.address,
    });
    await fund(contract.address);
    expect((await contract.approve(9n, 100n, alicePub, sig).send()).txid).toBeDefined(); // allow[hash160(pk)][9] = 100
    await fund(contract.address);
    expect((await contract.check(alicePkh, 9n, 100n, alicePub, sig).send()).txid).toBeDefined(); // read back at (H(pk), 9)
    await fund(contract.address);
    // Wrong value reverts.
    await expect(contract.check(alicePkh, 9n, 7n, alicePub, sig).send()).rejects.toThrow(verifyFailure);
  });
});
