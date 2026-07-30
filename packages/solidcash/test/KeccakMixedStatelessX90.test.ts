import { describe, it, expect } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { compileString } from 'solidc';
import { keccakComputeLockingBytecode, KECCAK256_SHARED_SALT } from '@solidcash/utils';
import { Contract, TransactionBuilder, MockNetworkProvider, SignatureTemplate } from '../src/index.js';
import { buildKeccakComputeSidecar } from '../src/keccak/keccakComputeSidecar.js';
import { randomUtxo } from '../src/utils.js';
import { alicePriv, alicePub, aliceAddress } from './fixture/vars.js';

/**
 * X90. Settle the satisfiability of X83's second face.
 *
 * X83 named a mixed keccak256 shape - one call inside a loop, one outside, in the SAME function - and refused
 * it on a STATEFUL function, where the block layout reserves no side-car slot for the unlooped call. It left a
 * STATELESS variant standing that does NOT crash: it emits an artifact. Read out of that artifact's ASM, the
 * two calls disagree about both the index and the covenant kind:
 *
 *   straight-line call   input  OP_TXINPUTCOUNT OP_2 OP_SUB          -> NI - 2
 *                        check  OP_HASH256 == STATELESS covenant hash
 *                        output OP_TXOUTPUTCOUNT OP_2 OP_SUB         -> NO - 2
 *   loop call            input  OP_INPUTINDEX OP_1ADD <c> OP_PICK OP_ADD -> I + 1 + counter
 *                        check  inline 2390-byte STATEFUL covenant byte compare
 *                        output OP_INPUTINDEX OP_1ADD <c> OP_PICK OP_ADD -> I + 1 + counter
 *
 * X83's author wrote: "I believe it is unsatisfiable (fail-closed) rather than unsound, but I did not prove
 * satisfiability either way." This file settles it. The finding is that BOTH halves of that sentence need
 * correcting in opposite directions:
 *
 *   - It IS satisfiable. The two index families are not forced to collide - NI and NO are free - so a
 *     transaction that puts the two covenant kinds at DISTINCT indices exists, and the VM accepts it. Proven
 *     below at pinned indices: contract at 0, STATEFUL side-car at 1, STATELESS side-car at 2, funder at 3.
 *   - It is nonetheless SOUND, so the satisfying transaction is not an attack. Each read binds
 *     `preimage == its own argument` out of the side-car's unlocking bytecode and then reads the commitment at
 *     the index that covenant kind's own self-preservation formula provably writes:
 *        STATELESS tail `c0 c4 93 c3 94` = INPUTINDEX + TXOUTPUTCOUNT - TXINPUTCOUNT
 *                        = (NI - 2) + NO - NI = NO - 2, exactly what the master reads.
 *        STATEFUL  tail `c0`            = INPUTINDEX = I + 1 + counter, exactly what the master reads.
 *     So neither read can return a hash of anything but its own bound argument. The hostile below confirms it.
 *
 * The real defect the row was circling is neither: the SDK cannot build the satisfying transaction. On
 * `keccakLoopReads` TransactionBuilder takes an early `continue` (TransactionBuilder.ts:258) into
 * addStatelessKeccakLoopCoSpends, which splices ONLY STATEFUL side-cars at [contractIdx+1 ..] and never runs
 * the straight-line STATELESS co-spend path below it. So `send()` always fails on this artifact. That is a
 * builder gap, not a soundness hole, and it is why the shape reads as "unsatisfiable" from the SDK.
 *
 * NOT refused. It compiles today (packages/solidc/test/KeccakCompute.test.ts:61 asserts the artifact), a
 * satisfying spend exists, and nothing is forgeable - so a refusal would remove a working artifact for no
 * soundness gain.
 */

// X83's second face, verbatim from packages/solidc/test/KeccakCompute.test.ts:61.
const MIXED = compileString(
  'contract C { function f(bytes x, int n) public pure { bytes32 h = keccak256(x);'
  + ' for (int i = 0; i < n; i++) { h = keccak256(abi.encodePacked(h)); } require(h != 0x00); } }',
);

const evm = (b: Uint8Array): Uint8Array => keccak_256(b);
const CAT_SL = new Uint8Array(32).fill(0xb1); // stateless side-car's own NFT category
const CAT_SF = new Uint8Array(32).fill(0xb2); // stateful side-car's own NFT category

/** Deploy one compute side-car UTXO at the shared-salt address of the requested covenant kind. */
async function deploySidecar(
  provider: MockNetworkProvider, stateful: boolean, seed: number,
): Promise<{ txid: string; vout: number; satoshis: bigint; token: NonNullable<Awaited<ReturnType<typeof randomUtxo>>['token']> }> {
  const lock = binToHex(keccakComputeLockingBytecode(KECCAK256_SHARED_SALT, stateful));
  const utxo = {
    txid: seed.toString(16).padStart(2, '0').repeat(32),
    vout: 0,
    satoshis: 100_000n,
    token: {
      category: binToHex(stateful ? CAT_SF : CAT_SL),
      amount: 0n,
      nft: { capability: 'mutable' as const, commitment: '' },
    },
  };
  await provider.addUtxo(lock, utxo);
  return utxo;
}

describe('X90: X83 second face - a STATELESS mixed keccak256 shape, satisfiability settled', () => {
  it('the artifact exists and commits to BOTH covenant kinds at once (the premise)', () => {
    const f = MIXED.abi.find((x) => x.name === 'f') as unknown as {
      keccakInLoop?: boolean; keccakLoopReads?: boolean; keccakPreimageParams?: (string | null)[];
    };
    expect(MIXED.bytecode.length).toBeGreaterThan(0);
    expect(MIXED.stateLayout).toBeUndefined();           // stateless: no block layout, so X83's guard cannot fire
    expect(f.keccakInLoop).toBe(true);
    expect(f.keccakLoopReads).toBe(true);
    expect(f.keccakPreimageParams).toEqual(['x', null]); // 2 calls: straight-line binds `x`, loop arg computed

    const asm = MIXED.bytecode.split(' ');
    // The straight-line call reads count-relative and checks the STATELESS covenant HASH.
    expect(asm.join(' ')).toContain('OP_TXINPUTCOUNT OP_2 OP_SUB');
    expect(asm.join(' ')).toContain('OP_TXOUTPUTCOUNT OP_2 OP_SUB');
    // The loop reads absolute-forward and byte-compares the 2390-byte STATEFUL covenant inline.
    expect(asm.join(' ')).toContain('OP_INPUTINDEX OP_1ADD OP_2 OP_PICK OP_ADD');
    const begin = asm.indexOf('OP_BEGIN');
    const until = asm.indexOf('OP_UNTIL');
    const inlineCovenant = asm.findIndex((t) => t.length === 2390 * 2);
    expect(begin).toBeGreaterThan(-1);
    expect(inlineCovenant).toBeGreaterThan(begin);       // the byte compare is INSIDE the loop
    expect(inlineCovenant).toBeLessThan(until);
  });

  it('POSITIVE CONTROL: a transaction satisfies both readings at distinct pinned indices (VM)', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(MIXED, [], { provider });
    const x = new Uint8Array(32).map((_, i) => (i * 5 + 1) & 0xff);
    const h1 = evm(x);              // straight-line result; also the loop's preimage (abi.encodePacked(bytes32))

    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 1_000_000n }));
    const sfUtxo = await deploySidecar(provider, true, 0x21);
    const slUtxo = await deploySidecar(provider, false, 0x22);

    // Loop side-car (STATEFUL covenant): read at I + 1 + counter = 0 + 1 + 0 = input 1, output 1.
    const sf = buildKeccakComputeSidecar(h1, KECCAK256_SHARED_SALT, sfUtxo, true);
    // Straight-line side-car (STATELESS covenant): read at NI - 2 = 4 - 2 = input 2, output NO - 2 = 2.
    const sl = buildKeccakComputeSidecar(x, KECCAK256_SHARED_SALT, slUtxo, false);

    const [contractUtxo] = await contract.getUtxos();
    const [funder] = await provider.getUtxos(aliceAddress);

    // NI = NO = 4. The index families are disjoint: {2} for the straight-line read, {1} for the loop's.
    const builder = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.f(x, 1n))              // input 0  (I = 0)
      .addInput({ ...sfUtxo }, sf.unlocker)                          // input 1  <- loop, STATEFUL
      .addInput({ ...slUtxo }, sl.unlocker)                          // input 2  <- straight-line, STATELESS
      .addInput(funder, new SignatureTemplate(alicePriv).unlockP2PKH()) // input 3  (fee)
      .addOutput({ to: contract.address, amount: 800_000n })         // output 0
      .addOutput(sf.recreate)                                        // output 1 <- STATEFUL self-preserves here
      .addOutput(sl.recreate)                                        // output 2 <- STATELESS self-preserves here
      .addOutput({ to: aliceAddress, amount: 900_000n });            // output 3 (change)

    expect(builder.inputs.length).toBe(4);
    expect(builder.outputs.length).toBe(4);
    // The two readings resolve to DIFFERENT inputs, which is the whole question.
    const straightLineInput = builder.inputs.length - 2; // NI - 2
    const loopInput = 0 + 1 + 0;                          // I + 1 + counter
    expect(straightLineInput).toBe(2);
    expect(loopInput).toBe(1);
    expect(straightLineInput).not.toBe(loopInput);

    // build() does NOT auto-add co-spends (only send() does), so this is exactly the hand-built layout.
    const txid = await provider.sendRawTransaction(builder.build());
    expect(txid).toBeDefined();
  });

  it('NEGATIVE CONTROL: the SDK cannot build it - send() never co-spends the straight-line side-car', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(MIXED, [], { provider });
    const x = new Uint8Array(32).map((_, i) => (i * 5 + 1) & 0xff);

    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    // Give the SDK everything it could want of BOTH kinds, so the failure is the routing and not scarcity.
    await deploySidecar(provider, true, 0x31);
    await deploySidecar(provider, true, 0x32);
    await deploySidecar(provider, false, 0x33);
    await deploySidecar(provider, false, 0x34);

    // Pinned to the builder's OWN failure, not a VM rejection: the loop probe never sees the straight-line
    // side-car read because that co-spend was never spliced in.
    await expect(
      new TransactionBuilder({ provider })
        .addInputs(await contract.getUtxos(), contract.unlock.f(x, 1n))
        .addOutput({ to: contract.address, amount: 800_000n })
        .send(),
    ).rejects.toThrow('keccak256 preimage extraction: no side-car read found in the probe trace.');
  });

  it('HOSTILE: the straight-line read cannot be pointed at a side-car for a DIFFERENT preimage (VM)', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(MIXED, [], { provider });
    const x = new Uint8Array(32).map((_, i) => (i * 5 + 1) & 0xff);
    const y = new Uint8Array(32).fill(0x77);   // attacker's substitute preimage, y != x
    const h1 = evm(x);

    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 1_000_000n }));
    const sfUtxo = await deploySidecar(provider, true, 0x41);
    const slUtxo = await deploySidecar(provider, false, 0x42);

    const sf = buildKeccakComputeSidecar(h1, KECCAK256_SHARED_SALT, sfUtxo, true);
    // Same slot, same covenant kind, WRONG preimage: the side-car honestly commits keccak256(y).
    const slHostile = buildKeccakComputeSidecar(y, KECCAK256_SHARED_SALT, slUtxo, false);

    const [contractUtxo] = await contract.getUtxos();
    const [funder] = await provider.getUtxos(aliceAddress);

    const builder = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.f(x, 1n))
      .addInput({ ...sfUtxo }, sf.unlocker)
      .addInput({ ...slUtxo }, slHostile.unlocker)   // input 2 = NI - 2, the pinned straight-line index
      .addInput(funder, new SignatureTemplate(alicePriv).unlockP2PKH())
      .addOutput({ to: contract.address, amount: 800_000n })
      .addOutput(sf.recreate)
      .addOutput(slHostile.recreate)
      .addOutput({ to: aliceAddress, amount: 900_000n });

    // The master's `preimage == arg` OP_EQUALVERIFY rejects it: the read is bound to its own argument. Pinned to
    // a VM script failure while evaluating the CONTRACT's input (index 0), not a builder-side error.
    await expect(provider.sendRawTransaction(builder.build()))
      .rejects.toThrow(/error in evaluating input index 0.*OP_VERIFY/s);
  });

  it('GUARD NEGATIVE CONTROL: forcing the two readings onto ONE input fails closed (VM)', async () => {
    const provider = new MockNetworkProvider();
    const contract = new Contract(MIXED, [], { provider });
    const x = new Uint8Array(32).map((_, i) => (i * 5 + 1) & 0xff);
    const h1 = evm(x);

    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
    await provider.addUtxo(aliceAddress, randomUtxo({ satoshis: 1_000_000n }));
    const sfUtxo = await deploySidecar(provider, true, 0x51);
    const sf = buildKeccakComputeSidecar(h1, KECCAK256_SHARED_SALT, sfUtxo, true);
    const [contractUtxo] = await contract.getUtxos();
    const [funder] = await provider.getUtxos(aliceAddress);

    // NI = 3 with the contract at 0: the straight-line read lands on NI - 2 = 1, which is ALSO the loop's
    // I + 1 + 0 = 1. This is the SDK's natural layout, and it is the collision X83 intuited: one input cannot
    // be both covenant kinds, so the STATELESS hash256 check fails against the STATEFUL side-car sitting there.
    const builder = new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.f(x, 1n))              // input 0
      .addInput({ ...sfUtxo }, sf.unlocker)                          // input 1 <- BOTH readings land here
      .addInput(funder, new SignatureTemplate(alicePriv).unlockP2PKH()) // input 2
      .addOutput({ to: contract.address, amount: 800_000n })         // output 0
      .addOutput(sf.recreate)                                        // output 1
      .addOutput({ to: aliceAddress, amount: 900_000n });            // output 2

    expect(builder.inputs.length - 2).toBe(0 + 1 + 0); // NI - 2 == I + 1 + counter: forced collision
    await expect(provider.sendRawTransaction(builder.build()))
      .rejects.toThrow(/error in evaluating input index 0.*OP_VERIFY/s);
  });
});
