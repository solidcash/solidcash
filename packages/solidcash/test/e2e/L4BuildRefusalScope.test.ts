import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { binToHex, decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
  Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder, layer3,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X163 ROW B - WHETHER `.build()` SHOULD CARRY THE REFUSAL. DECIDED: NO, AND THE HOLE IS STATED.
 *
 * THE HOLE IS REAL. `TransactionBuilder.build()` returns finalized hex with no byte check, so a composer who
 * builds and hands the hex to a provider gets nothing - row 1 measures exactly that on one builder, refused by
 * `send()` and admitted by `build()`. Every one of the seven live BROADCAST sites in `src/` now carries the
 * gate, so this is the last way to reach a network with unjudged bytes through the SDK.
 *
 * THE BLAST RADIUS IS MEASURED, NOT ASSUMED. `l4-overhead-probe.ts` assessed every `build()` over a 50-file,
 * 881-test corpus run (49 passed, 1 skipped) without enforcing anything:
 *
 *   builds assessed                            408    367 of them from the stateful submit path, which
 *                                                     already gates one line later - `build()` is
 *                                                     overwhelmingly an INTERNAL call, not a composer's
 *   would be refused                            11    7 `policy:output-dust`, 4 `consensus:consensus-unlocking-bytes`
 *   test files those 11 come from                2    X158 and X163 - both gate-MEASUREMENT fixtures whose
 *                                                     whole purpose is to construct refused bytes
 *   incidental refusals                          0    nothing built for the SDK's own purposes is refused
 *   existing rows a gated `build()` turns RED    5    X158 rows 1, 2, 3, 4 (their helper builds before it
 *                                                     sends, so the row errors before its assertion) and
 *                                                     X163 row 2c
 *
 * So the population cost is not zero - it is five rows of the effort's own evidence. THREE STRUCTURAL REASONS
 * say the same thing.
 *
 * 1. IT WOULD DELETE `allowNonRelayable` (row 2). The gate's policy half is suppressible for the
 *    mineable-but-unrelayable case: a transaction over the 100,000-byte relay ceiling and under the
 *    1,000,000-byte consensus ceiling is VALID, and a caller submitting straight to a miner is not wrong to
 *    build it. `build()` takes no options and is called BY `sendPreflightedLayer3Transaction` before that
 *    function applies the caller's, so a gated `build()` would refuse first and the option could never be
 *    reached. A fail-closed boundary with no escape hatch, where every sibling site has one.
 *
 * 2. IT WOULD MAKE THE EFFORT'S OWN CONTROL UNCONSTRUCTIBLE (row 3). "The mock accepts the very bytes the gate
 *    refuses" is what separates a gate that found a real defect from a gate agreeing with a decider that was
 *    going to refuse anyway - and it is only buildable because `build()` yields the refused bytes. X131 row 2,
 *    X158 rows 2 and 5, and X163 row 2c all depend on it. Closing this closes the measurement.
 *
 * 3. CONSTRUCTION IS NOT BROADCAST. `buildUnsigned()` documents its output as deliberately unfunded and
 *    unsigned, so its bytes are not finalized and no byte rule applies to them; `build()` is the same kind of
 *    primitive one step later. Refusing to CONSTRUCT is a strictly larger claim than refusing to broadcast, and
 *    the gate is not a security boundary in either case - the SDK is an untrusted witness constructor, so
 *    refusing construction protects nobody who was not already free to assemble the bytes elsewhere.
 *
 * WHAT THE COMPOSER GETS INSTEAD. `assertFinalizedTransactionBytes` and `assessFinalizedTransactionBytes` are
 * both public through the `layer3` namespace, so a composer broadcasting by hand can decide the same bytes
 * against the same rules and pass `allowNonRelayable` when they mean it. Row 4 is that path end to end.
 *
 * DELIBERATELY NOT DECIDED HERE: `generateWcTransactionObject`, which hands bytes to a wallet rather than
 * constructing them for the caller, and is the one non-broadcast hand-off with an argument for a gate. The
 * whole repository exercises it ONCE. A 1-sample blast radius is the same trap the four admin sites were
 * nearly landed on, and it is left for a measurement rather than taken on structure.
 */

const OP_TRUE_LOCKING = Uint8Array.from([0x51]);

const sendError = async (builder: TransactionBuilder): Promise<string> => {
  try { await builder.send(); return ''; } catch (error) { return (error as Error).message; }
};

/** A P2PKH spend paying `recipientAmount` to a one-byte script: 10 serialized bytes, dust floor 474. */
async function dustBuilder(recipientAmount: bigint): Promise<TransactionBuilder> {
  const provider = new MockNetworkProvider({ policy: { enforceDust: false } });
  const contract = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const utxo = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(contract.address, utxo);
  const builder = new TransactionBuilder({ provider });
  builder.addInput(utxo, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
  // Placed by index rather than through `addOutput`, which is the only way past its policy check - the same
  // construction the four stateful admin sites reach by accident when they overwrite a change placeholder.
  builder.outputs.push({ to: OP_TRUE_LOCKING, amount: recipientAmount });
  builder.addOutput({ to: contract.address, amount: 15_000n });
  return builder;
}

/**
 * `inputs` push-only inputs of `pushBytes` each, so the transaction crosses the 100,000-byte RELAY ceiling
 * while every single input stays under the 10,000-byte CONSENSUS ceiling. That separation is the whole point:
 * the result is refused by policy alone and is therefore suppressible.
 */
async function oversizeRelayBuilder(inputs: number, pushBytes: number): Promise<TransactionBuilder> {
  const provider = new MockNetworkProvider({ policy: { enforceDust: false } });
  const builder = new TransactionBuilder({ provider });
  const unlock = new Uint8Array(3 + pushBytes);
  unlock[0] = 0x4d; // OP_PUSHDATA2
  new DataView(unlock.buffer).setUint16(1, pushBytes, true);
  for (let index = 0; index < inputs; index += 1) {
    const utxo = randomUtxo({ satoshis: 1_000_000n });
    await provider.addUtxo(binToHex(OP_TRUE_LOCKING), utxo);
    builder.addInput(utxo, {
      generateUnlockingBytecode: () => unlock, generateLockingBytecode: () => OP_TRUE_LOCKING,
    } as never);
  }
  builder.addOutput({ to: OP_TRUE_LOCKING, amount: 900_000n * BigInt(inputs) });
  return builder;
}

describe('X163 Row B - the scope of the finalized-bytes refusal, and why it stops at broadcast', () => {
  it('1. THE HOLE, MEASURED: one builder, refused by `send()` and admitted by `build()`', async () => {
    // Not two shapes and not two builders: the same object is asked twice. `send()` quotes the dust
    // arithmetic; `build()` hands back the identical bytes without a word, and the provider takes them.
    const builder = await dustBuilder(100n);
    const refusal = await sendError(builder);
    expect(refusal).toMatch(
      /100 satoshis is 374 short of the 474-satoshi dust threshold for a 10-byte output \(3 \* \(10 \+ 148\)\)/,
    );

    const raw = builder.build();
    const decoded = decodeTransactionUnsafe(hexToBin(raw));
    expect(decoded.outputs[0].valueSatoshis, 'the same below-dust output survives `build()`').toBe(100n);
    // And the rules would have refused these exact bytes, so the silence is the hole and not a disagreement.
    const verdict = layer3.assessFinalizedTransactionBytes(decoded);
    expect(verdict.admitted).toBe(false);
    expect(verdict.refusals.map((row) => row.rule)).toEqual(['output-dust']);
  }, 120_000);

  it('1b. GUARD: at 474 satoshis the identical builder is admitted by both', async () => {
    // Differs from row 1 in the attacked output's value alone, so row 1 is about the dust floor and not about
    // `build()` and `send()` disagreeing on some other property of this shape.
    const builder = await dustBuilder(474n);
    expect(await sendError(builder)).toBe('');
    expect(layer3.assessFinalizedTransactionBytes(
      decodeTransactionUnsafe(hexToBin(builder.build())),
    ).admitted).toBe(true);
  }, 120_000);

  it('2. A GATED `build()` WOULD DELETE `allowNonRelayable`, which is the deciding argument', async () => {
    // 12 inputs of 9,000 pushed bytes each: past the 100,000-byte relay ceiling, under the 1,000,000-byte
    // consensus ceiling, and every input under the 10,000-byte per-input ceiling. Policy-only by construction.
    const builder = await oversizeRelayBuilder(12, 9_000);
    const raw = builder.build();
    const transaction = decodeTransactionUnsafe(hexToBin(raw));
    const verdict = layer3.assessFinalizedTransactionBytes(transaction);
    expect(verdict.serializedBytes).toBeGreaterThan(100_000);
    expect(verdict.serializedBytes).toBeLessThan(1_000_000);
    expect(verdict.refusals.map((row) => `${row.regime}:${row.rule}`))
      .toEqual(['policy:relay-transaction-size']);

    // The suppressible half: refused by default, admitted when the caller says they are going to a miner.
    expect(() => layer3.assertFinalizedTransactionBytes(transaction)).toThrow(/relay-transaction-size/);
    expect(layer3.assertFinalizedTransactionBytes(transaction, { allowNonRelayable: true }).admitted)
      .toBe(false);

    // AND THE ORDER IS THE PROBLEM. `sendPreflightedLayer3Transaction` calls `builder.build()` and only then
    // applies the caller's options, so a gate inside `build()` - which takes no options - would refuse these
    // bytes before the option that admits them could ever be read.
    const source = readFileSync(
      fileURLToPath(new URL('../../src/layer3/preflight.ts', import.meta.url)), 'utf8',
    );
    const body = source.slice(source.indexOf('export async function sendPreflightedLayer3Transaction'));
    expect(body.indexOf('builder.build()')).toBeGreaterThan(-1);
    expect(body.indexOf('builder.build()'))
      .toBeLessThan(body.indexOf('assertFinalizedTransactionBytes(transaction, options)'));
  }, 120_000);

  it('3. the "mock accepts the refused bytes" control exists ONLY because `build()` yields them', async () => {
    // The measurement this whole effort turns on: a refusal is evidence of a defect only if the decider on the
    // other side would have taken the same bytes. Constructing that control REQUIRES obtaining bytes the gate
    // refuses, and `build()` is the only way to obtain them - `send()` refuses to produce them by definition.
    const builder = await dustBuilder(100n);
    const raw = builder.build();
    expect(await sendError(builder), 'the gate refuses').toMatch(/output-dust/);
    await expect(builder.provider.sendRawTransaction(raw), 'the provider does not').resolves.toBeTypeOf('string');
  }, 120_000);

  it('4. the composer broadcasting by hand has the same decider, exported and optioned', async () => {
    // What `build()` NOT refusing costs is a check the composer must invoke, and the check is public. Both
    // halves are reachable: the default refusal and the explicit policy suppression the gated sites offer.
    const builder = await dustBuilder(100n);
    const transaction = decodeTransactionUnsafe(hexToBin(builder.build()));
    expect(() => layer3.assertFinalizedTransactionBytes(transaction)).toThrow(
      /100 satoshis is 374 short of the 474-satoshi dust threshold/,
    );
    // A policy refusal, so `allowNonRelayable` reaches it; the verdict still reports it as not admitted.
    const suppressed = layer3.assertFinalizedTransactionBytes(transaction, { allowNonRelayable: true });
    expect(suppressed.admitted).toBe(false);
    expect(suppressed.refusals.map((row) => row.rule)).toEqual(['output-dust']);
  }, 120_000);

  it('4b. GUARD: a CONSENSUS refusal is not suppressible by the same option', async () => {
    // The half `allowNonRelayable` must never reach, so row 4 cannot be read as "the option turns the gate
    // off". One input of 12,000 pushed bytes is 2,003 over the per-input consensus ceiling.
    const builder = await oversizeRelayBuilder(1, 12_000);
    const transaction = decodeTransactionUnsafe(hexToBin(builder.build()));
    expect(() => layer3.assertFinalizedTransactionBytes(transaction, { allowNonRelayable: true }))
      .toThrow(/\[consensus\] consensus-unlocking-bytes at input 0/);
  }, 120_000);
});
