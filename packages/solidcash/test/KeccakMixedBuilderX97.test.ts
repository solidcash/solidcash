import { describe, it, expect } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from './direct-compile.js';
import {
  keccakComputeLockingBytecode, KECCAK256_SHARED_SALT, KECCAK256_COMPUTE_COVENANT_HASH,
} from '@solidcash/utils';
import { Contract, TransactionBuilder, MockNetworkProvider, SignatureTemplate } from '../src/index.js';
import { buildKeccakComputeSidecar } from '../src/keccak/keccakComputeSidecar.js';
import { randomUtxo } from '../src/utils.js';
import { alicePriv, aliceAddress } from './fixture/vars.js';

/**
 * X97. The builder funds the mixed keccak256 shape X90 proved satisfiable.
 *
 * X90 settled the covenant side: a STATELESS function with a straight-line keccak256 AND one inside a loop is
 * satisfiable and sound, proven at pinned indices (contract 0, STATEFUL side-car 1, STATELESS side-car 2 = NI-2
 * with NI=4, funder 3). What it could not do was get there through the SDK: addRequiredKeccakComputeCoSpends
 * took an early `continue` on keccakLoopReads into addStatelessKeccakLoopCoSpends, which splices only the
 * forward STATEFUL block and never funds the trailing count-relative window, so send() always failed.
 *
 * The two calls read two index families off the same transaction:
 *
 *   straight-line call p  input NI - (n - p), output NO - (n - p)   STATELESS covenant (hash256 compare)
 *   in-loop call          input/output masterIndex + 1 + counter    STATEFUL covenant (inline byte compare)
 *
 * `n` is the STATIC keccak256 call count (2 here), so codegen reserves 2 trailing slots even though only the
 * one straight-line call reads them - the in-loop call reads forward instead and leaves a HOLE. The builder now
 * fills the whole window: the resolved side-car in the straight-line slot, and an occupant in the hole (an
 * existing trailing input/output pair first, else a pad side-car). Both readings are resolved by ONE progressive
 * probe, because either family can execute first and neither converges without the other's side-cars: here the
 * straight-line call runs BEFORE the loop, which is why the old loop-only probe aborted before it ever saw an
 * iteration and reported "no side-car read found in the probe trace".
 *
 * NI and NO are free, so the families need not collide - the whole point. They DO collide at the SDK's old
 * natural layout NI=3, where NI-2 == masterIndex+1+0 == 1; that layout is now never built, and the shortfall
 * that would force it is refused BY NAME.
 */

// X83's second face, verbatim from packages/solidc/test/KeccakCompute.test.ts:61 (and X90).
const MIXED = compileString(
  'contract C { function f(bytes x, int n) public pure { bytes32 h = keccak256(x);'
  + ' for (int i = 0; i < n; i++) { h = keccak256(abi.encodePacked(h)); } require(h != 0x00); } }',
);
// A PURE dynamic loop: no straight-line call, so no count-relative window at all. The regression control.
const PURE_LOOP = compileString(`
contract HashChainStateless() {
    function verify(bytes32 x, int n, bytes32 target) {
        bytes32 h = x;
        for (int i = 0; i < n; i++) { h = keccak256(h); }
        require(h == target);
    }
}`);

const evm = (b: Uint8Array): Uint8Array => keccak_256(b);
const CAT_SL = '99'.repeat(32);
const CAT_SF = '88'.repeat(32);
const LOCK_SL = binToHex(keccakComputeLockingBytecode(KECCAK256_SHARED_SALT, false));
const LOCK_SF = binToHex(keccakComputeLockingBytecode(KECCAK256_SHARED_SALT, true));
const X = new Uint8Array(32).map((_, i) => (i * 5 + 1) & 0xff);

/** Deploy one compute side-car UTXO at the shared-salt address of the requested covenant kind. */
async function deploySidecar(provider: MockNetworkProvider, stateful: boolean, seed: number): Promise<{
  txid: string; vout: number; satoshis: bigint;
  token: { category: string; amount: bigint; nft: { capability: 'mutable'; commitment: string } };
}> {
  const utxo = {
    txid: seed.toString(16).padStart(2, '0').repeat(32),
    vout: 0,
    satoshis: 100_000n,
    token: {
      category: stateful ? CAT_SF : CAT_SL,
      amount: 0n,
      nft: { capability: 'mutable' as const, commitment: '' },
    },
  };
  await provider.addUtxo(stateful ? LOCK_SF : LOCK_SL, utxo);
  return utxo;
}

/** Classify a built input by the covenant its unlocker locks to. */
function kindOf(builder: TransactionBuilder, i: number, contractLock: string): string {
  const lock = binToHex(builder.inputs[i].unlocker.generateLockingBytecode());
  if (lock === LOCK_SL) return 'stateless';
  if (lock === LOCK_SF) return 'stateful';
  return lock === contractLock ? 'contract' : 'other';
}

const commitmentAt = (builder: TransactionBuilder, i: number): string => builder.outputs[i].token?.nft?.commitment ?? '';

describe('X97: the SDK funds the mixed straight-line + in-loop keccak256 shape', () => {
  it('POSITIVE CONTROL: send() settles on X90s pinned witness - stateless at NI-2, stateful at I+1+0 (VM)', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(MIXED, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 1_000_000n }));
    await deploySidecar(provider, true, 0x41);
    await deploySidecar(provider, false, 0x42);
    const [funder] = await provider.getUtxos(aliceAddress);

    const builder = new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(X, 1n))
      .addInput(funder, new SignatureTemplate(alicePriv).unlockP2PKH())
      .addOutput({ to: contract.address, amount: 800_000n })
      .addOutput({ to: aliceAddress, amount: 900_000n });
    // A green send() IS the deliverable: MockNetworkProvider runs the 2026 VM over the raw transaction.
    const tx = await builder.send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);

    // The builder chose NI=4 - the SAME assignment X90 hand-built and proved, not merely "a" satisfying one.
    expect(builder.inputs.length).toBe(4);
    expect(builder.outputs.length).toBe(4);
    expect(kindOf(builder, 0, contract.lockingBytecode)).toBe('contract');
    expect(kindOf(builder, 1, contract.lockingBytecode)).toBe('stateful');   // loop: I + 1 + counter = 0 + 1 + 0
    expect(kindOf(builder, 2, contract.lockingBytecode)).toBe('stateless');  // straight-line: NI - 2 = 4 - 2
    expect(kindOf(builder, 3, contract.lockingBytecode)).toBe('other');      // the funder occupies the reserved hole
    // The two index families landed on DIFFERENT inputs, which is the whole question.
    expect(builder.inputs.length - 2).toBe(2);
    expect(builder.inputs.length - 2).not.toBe(0 + 1 + 0);
    // Recreations at outputs 1 and 2: stateful self-preserves at I, stateless at (NI-2) + NO - NI = NO - 2.
    expect(commitmentAt(builder, 2)).toBe(binToHex(evm(X)));            // straight-line commits keccak256(x)
    expect(commitmentAt(builder, 1)).toBe(binToHex(evm(evm(X))));       // iteration 0 commits keccak256(keccak256(x))
  });

  it('POSITIVE CONTROL: with no funder the reserved in-loop slot is PADDED, still NI-2 (VM)', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(MIXED, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deploySidecar(provider, true, 0x31);
    await deploySidecar(provider, false, 0x33);
    await deploySidecar(provider, false, 0x34);

    // Exactly the shape X90's negative control used: contract input only, one output, no funder to fill the hole.
    const builder = new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(X, 1n))
      .addOutput({ to: contract.address, amount: 800_000n });
    const tx = await builder.send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);

    expect(builder.inputs.length).toBe(4);
    expect(kindOf(builder, 1, contract.lockingBytecode)).toBe('stateful');
    expect(kindOf(builder, 2, contract.lockingBytecode)).toBe('stateless');   // NI - 2 = 2: the READ slot
    expect(kindOf(builder, 3, contract.lockingBytecode)).toBe('stateless');   // the pad: reserved for the in-loop call
    expect(commitmentAt(builder, 2)).toBe(binToHex(evm(X)));
    // The pad is never read by the master, so it honestly commits keccak256("") - it only has to satisfy its own
    // covenant and self-preserve at (NI-1) + NO - NI = NO - 1.
    expect(commitmentAt(builder, 3)).toBe(binToHex(evm(new Uint8Array(0))));
    expect(commitmentAt(builder, 1)).toBe(binToHex(evm(evm(X))));
  });

  it('POSITIVE CONTROL: the forward block grows with the iteration count, the window stays at the end (VM)', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(MIXED, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 1_000_000n }));
    for (const seed of [0x51, 0x52, 0x53, 0x54]) await deploySidecar(provider, true, seed);
    await deploySidecar(provider, false, 0x55);
    const [funder] = await provider.getUtxos(aliceAddress);

    const builder = new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.f(X, 3n))
      .addInput(funder, new SignatureTemplate(alicePriv).unlockP2PKH())
      .addOutput({ to: contract.address, amount: 800_000n })
      .addOutput({ to: aliceAddress, amount: 900_000n });
    const tx = await builder.send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);

    // NI = 6: contract 0, three loop side-cars 1..3, the straight-line read at NI-2 = 4, funder 5.
    expect(builder.inputs.length).toBe(6);
    expect([1, 2, 3].map((i) => kindOf(builder, i, contract.lockingBytecode))).toEqual(['stateful', 'stateful', 'stateful']);
    expect(kindOf(builder, 4, contract.lockingBytecode)).toBe('stateless');
    expect(kindOf(builder, 5, contract.lockingBytecode)).toBe('other');
    expect(commitmentAt(builder, 4)).toBe(binToHex(evm(X)));
    // The forward block is the hash chain: iteration k commits keccak256 applied k+1 times to keccak256(x).
    let h = evm(X);
    for (const i of [1, 2, 3]) { h = evm(h); expect(commitmentAt(builder, i)).toBe(binToHex(h)); }
  });

  it('HOSTILE: swapping the stateless side-car at the builder-chosen index 2 for another preimage fails (VM)', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(MIXED, [], { provider });
    const y = new Uint8Array(32).fill(0x77);   // attacker's substitute preimage, y != x
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 1_000_000n }));
    const sfUtxo = await deploySidecar(provider, true, 0x61);
    const slUtxo = await deploySidecar(provider, false, 0x62);
    const [contractUtxo] = await contract.getUtxos();
    const [funder] = await provider.getUtxos(aliceAddress);

    const sf = buildKeccakComputeSidecar(evm(X), KECCAK256_SHARED_SALT, sfUtxo, true);
    // Same slot the builder picks (input 2 = NI-2), same covenant kind, WRONG preimage: the side-car honestly
    // commits keccak256(y), so nothing is forged - the master's own bind is what has to reject it.
    const hostile = buildKeccakComputeSidecar(y, KECCAK256_SHARED_SALT, slUtxo, false);

    const builder = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.f(X, 1n))
      .addInput({ ...sfUtxo }, sf.unlocker)
      .addInput({ ...slUtxo }, hostile.unlocker)     // input 2, pinned: exactly where the builder puts the real one
      .addInput(funder, new SignatureTemplate(alicePriv).unlockP2PKH())
      .addOutput({ to: contract.address, amount: 800_000n })
      .addOutput(sf.recreate)
      .addOutput(hostile.recreate)
      .addOutput({ to: aliceAddress, amount: 900_000n });

    // Pinned to a VM script failure while evaluating the CONTRACT's input (index 0): the straight-line read binds
    // `preimage == its own argument`, so the commitment it goes on to read can only be keccak256(x).
    await expect(provider.sendRawTransaction(builder.build()))
      .rejects.toThrow(/error in evaluating input index 0.*OP_VERIFY/s);
  });

  it('GUARD NEGATIVE CONTROL: a side-car shortfall is refused BY NAME, never built at the colliding NI=3', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(MIXED, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await deploySidecar(provider, true, 0x71);
    await deploySidecar(provider, false, 0x72);   // ONE stateless side-car: enough for the read, not for the pad

    // With no funder there is nothing to occupy the reserved in-loop slot, and only one stateless side-car to
    // pad it with. Appending just the one would give NI = 3, forcing NI-2 == masterIndex+1+0 == 1 - the exact
    // collision X83 intuited. The builder refuses instead, naming the shape and the shortfall.
    await expect(
      new TransactionBuilder({ provider })
        .addInputs(await contract.getUtxos(), contract.unlock.f(X, 1n))
        .addOutput({ to: contract.address, amount: 800_000n })
        .send(),
    ).rejects.toThrow(/mixed keccak256 shape \(1 straight-line call\(s\) \+ 1 in-loop call\(s\)\) needs 2 STATELESS/);
  });

  it('GUARD NEGATIVE CONTROL: the NI=3 layout the builder now avoids is genuinely rejected by the VM', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(MIXED, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 1_000_000n }));
    const sfUtxo = await deploySidecar(provider, true, 0x81);
    const sf = buildKeccakComputeSidecar(evm(X), KECCAK256_SHARED_SALT, sfUtxo, true);
    const [contractUtxo] = await contract.getUtxos();
    const [funder] = await provider.getUtxos(aliceAddress);

    // NI = 3 with the contract at 0: the straight-line read lands on NI-2 = 1, which is ALSO the loop's
    // I+1+0 = 1. One input cannot be both covenant kinds, so the STATELESS hash256 check fails against the
    // STATEFUL side-car sitting there. Both preimages are honest; only the LAYOUT is wrong.
    const builder = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.f(X, 1n))
      .addInput({ ...sfUtxo }, sf.unlocker)
      .addInput(funder, new SignatureTemplate(alicePriv).unlockP2PKH())
      .addOutput({ to: contract.address, amount: 800_000n })
      .addOutput(sf.recreate)
      .addOutput({ to: aliceAddress, amount: 900_000n });

    expect(builder.inputs.length - 2).toBe(0 + 1 + 0); // NI - 2 == I + 1 + counter: forced collision
    await expect(provider.sendRawTransaction(builder.build()))
      .rejects.toThrow(/error in evaluating input index 0.*OP_VERIFY/s);
  });

  it('REGRESSION: a PURE dynamic loop never enters the mixed path (no stateless side-cars needed) (VM)', async () => {
    // The gate is the STATELESS covenant hash, which ONLY a count-relative read bakes. A pure loop byte-compares
    // the STATEFUL covenant inline instead, so it takes the untouched loop-only path.
    expect(MIXED.bytecode.split(' ')).toContain(KECCAK256_COMPUTE_COVENANT_HASH);
    expect(PURE_LOOP.bytecode.split(' ')).not.toContain(KECCAK256_COMPUTE_COVENANT_HASH);
    // Proven behaviourally too: ZERO stateless side-cars are deployed and it still sends.
    const provider = new MockNetworkProvider();
    const contract = new Contract(PURE_LOOP, [], { provider });
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    for (const seed of [0xa1, 0xa2, 0xa3, 0xa4]) await deploySidecar(provider, true, seed);
    expect(await provider.getUtxosForLockingBytecode(LOCK_SL)).toEqual([]);

    const seed = new Uint8Array(32).fill(0x11);
    let target = seed;
    for (let i = 0; i < 2; i++) target = evm(target);
    const tx = await new TransactionBuilder({ provider })
      .addInputs(await contract.getUtxos(), contract.unlock.verify(seed, 2n, target))
      .addOutput({ to: contract.address, amount: 800_000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
