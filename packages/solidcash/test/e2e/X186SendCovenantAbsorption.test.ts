import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
  Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { alicePkh, alicePriv, alicePub, bobPub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * X186 - THE ABSORPTION WINDOW AT `TransactionBuilder.send`, and the demonstration that it cannot recur.
 *
 * WHAT AN ABSORPTION WINDOW IS. Where the byte gate is the FIRST decider to speak, a transaction that breaks
 * its covenant AND pays dust reports the dust. A hostile test whose match is loose then passes on the gate's
 * refusal rather than on its own subject, and keeps passing after its real cause has stopped firing. That is
 * how the seventh vacuous guard on this effort was made, and the row that closed the same window at the four
 * `StatefulContract` lifecycle-admin sites (X175) contained vacuous guard #22 for the same reason one level
 * down: its negative control asserted the message did not match `/checkSig|OP_/`, and libauth phrases that
 * covenant's failure as `signature verification` / `NULLFAIL` / `Schnorr`, naming neither token. Section 4
 * below is what keeps that from happening again HERE.
 *
 * THE TWO WINDOWS AT `send`, both disclosed by X131 and neither closed by it:
 *   COVENANT INPUT    `send()` calls `this.debug()` inside `try { } catch { }` and SWALLOWS the result, on
 *                     the stated grounds that a mock provider may not supply production-quality UTXO data.
 *   CUSTOM UNLOCKER   `debug()` throws `Cannot debug a transaction with custom unlocker`, so `send()` does
 *                     not call it at all.
 * On both paths nothing had produced a covenant verdict when the gate spoke. `debug()` still speaks first for
 * a STANDARD NON-COVENANT transaction, and row 1d is what holds that distinction.
 *
 * WHAT CLOSES THEM. `assertFinalizedBytesWithCovenant`, moved out of `StatefulContract` into
 * `message-bus/preflight.ts` so `send` can share it. It cannot cost anything: the bytes are assessed FIRST and an
 * admitted verdict returns before the VM is touched (row 5a is the source-order pin), so a covenant objection
 * can only ever annotate a refusal that was already happening. No transaction that used to settle can fail.
 *
 * A WHOLE FAILURE CLASS THE INSTRUMENT USED TO MISS. `covenantObjectionOf` read `state.error`, which is set
 * only when an operation raises. A script that runs to completion leaving a FALSY item on top raises nothing,
 * so a broken covenant of that class was declared clean and its refusal reported bytes only - the absorption
 * shape surviving inside the instrument built to remove it. It now asks `vm.stateSuccess`, which libauth
 * defines as "`state.error` if there is one, else the truthiness check", so the widening is strict. Rows 2d
 * and 2e are the pin, and row 4b is why this matters for CONTROLS as much as for the gate: the sentence that
 * class produces contains neither `checkSig` nor `OP_`, so guard #22's vocabulary would have been blind to it.
 *
 * NOT A SECURITY BOUNDARY. The SDK is an untrusted witness constructor and an attacker does not call `send()`.
 * A composer reads two causes at once instead of building, funding, signing and broadcasting twice to find the
 * second one.
 */

/** `OP_1`: a one-byte locking script, so its serialized output is 10 bytes and its dust floor is exact. */
const OP_TRUE_LOCKING = Uint8Array.from([0x51]);

/** 3 * (10 + 148) for the 10-byte output every hostile below pays to. */
const DUST_FLOOR = 474n;

/**
 * `enforceDust: false` - the mock default. It sets `standard: false` and `dustRelayFeePerKb: 0n`, so the
 * provider models no relay policy at all and CANNOT be the objector. Whatever refuses below is the gate.
 */
const lenient = (): MockNetworkProvider => new MockNetworkProvider({ policy: { enforceDust: false } });

const sendError = async (builder: TransactionBuilder): Promise<string> => {
  try { await builder.send(); return ''; } catch (error) { return (error as Error).message; }
};

/**
 * A P2PKH contract spend. `covenant` sets the same `covenantUnlocker: true` field
 * `stateful/covenant-helpers.ts` sets on every covenant unlocker it builds, which is the exact field
 * `isCovenantUnlocker` reads and `send()` branches on to swallow `debug()`.
 */
async function p2pkhBuilder(
  amount: bigint, publicKey: Uint8Array, covenant: boolean,
): Promise<TransactionBuilder> {
  const provider = lenient();
  const contract = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const utxo = randomUtxo({ satoshis: 20_000n });
  await provider.addUtxo(contract.address, utxo);
  const builder = new TransactionBuilder({ provider });
  const unlocker = contract.unlock.spend(publicKey, new SignatureTemplate(alicePriv)) as Record<string, unknown>;
  if (covenant) unlocker.covenantUnlocker = true;
  builder.addInput(utxo, unlocker as never);
  builder.addOutput({ to: OP_TRUE_LOCKING, amount });
  builder.addOutput({ to: contract.address, amount: 15_000n });
  return builder;
}

/** A CUSTOM unlocker - no `contract`, no `template` - so `send()` never debugs this input. */
async function customBuilder(
  amount: bigint, locking: Uint8Array, unlock: Uint8Array,
): Promise<TransactionBuilder> {
  const provider = lenient();
  const utxo = { ...randomUtxo({ satoshis: 20_000n }), txid: '86'.repeat(32), vout: 0 };
  await provider.addUtxo(binToHex(locking), utxo);
  const builder = new TransactionBuilder({ provider });
  builder.addInput(utxo, {
    generateUnlockingBytecode: () => unlock, generateLockingBytecode: () => locking,
  } as never);
  builder.addOutput({ to: OP_TRUE_LOCKING, amount });
  builder.addOutput({ to: OP_TRUE_LOCKING, amount: 15_000n });
  return builder;
}

/** X131 rows 4/4b verbatim: one custom-unlocker input whose unlocking bytecode is `pushBytes + 3` long. */
async function oversizedInputBuilder(pushBytes: number): Promise<TransactionBuilder> {
  const provider = lenient();
  const locking = Uint8Array.from([0x51]);
  const utxo = randomUtxo({ satoshis: 2_000_000n });
  await provider.addUtxo(binToHex(locking), utxo);
  const unlock = new Uint8Array(3 + pushBytes);
  unlock[0] = 0x4d; // OP_PUSHDATA2, the minimal encoding at these sizes
  new DataView(unlock.buffer).setUint16(1, pushBytes, true);
  const builder = new TransactionBuilder({ provider });
  builder.addInput(utxo, {
    generateUnlockingBytecode: () => unlock, generateLockingBytecode: () => locking,
  } as never);
  builder.addOutput({
    to: new Contract(p2pkhArtifact, [alicePkh], { provider }).address, amount: 500_000n,
  });
  return builder;
}

/* --------------------------------------------------------------------------------------------------- */
/* THE VOCABULARY UNDER TEST. Every one of these was READ OFF the deciders, not predicted, and section 4  */
/* re-derives each from a live message so a stale constant cannot make a guard vacuous.                   */
/* --------------------------------------------------------------------------------------------------- */

/** The gate's OWN marker. Structural, so it cannot go blind when libauth rephrases a failure. */
const COVENANT_LINE = /\[covenant\] input 0: /;
/** The combined prefix. Mutually exclusive with the byte-only one below, character for character. */
const BOTH_REFUSED = /^messageBus: finalized transaction refused by its covenant and 1 byte rule\(s\)/;
const BYTES_ONLY = /^messageBus: finalized transaction refused by 1 byte rule\(s\)/;
const DUST_DETAIL = new RegExp('\\[policy\\] output-dust at output 0: 100 satoshis is 374 short of the '
  + '474-satoshi dust threshold for a 10-byte output \\(3 \\* \\(10 \\+ 148\\)\\)');

/** What libauth ACTUALLY says for each covenant break used below. Measured, not expected. */
const SENTENCE = {
  /** P2PKH with a public key that does not hash to the committed pkh: `OP_EQUALVERIFY` fails. */
  opVerify: 'Program failed an OP_VERIFY operation.',
  /** A one-byte `OP_0` locking script: no VM error at all, only a falsy final item. */
  falsyTop: 'Unsuccessful evaluation: completed with a non-truthy value on top of the stack. Top stack item: "".',
  /** `OP_1` locking under a scriptSig that also pushes: two items left on the stack. */
  leftover: 'Non-P2SH locking bytecode completed evaluation with an unexpected number of items on the stack '
    + '(must be exactly 1). Remaining stack depth: 2.',
} as const;

describe('X186 - the absorption window at TransactionBuilder.send', () => {
  /* ------------------------------------------------------------------------------------------------- */
  /* 1. The COVENANT-INPUT window: `debug()` runs and its result is swallowed                            */
  /* ------------------------------------------------------------------------------------------------- */

  it('1. BOTH: a covenant input that breaks its script AND pays dust reports the covenant AND the dust',
    async () => {
      // THE DEMONSTRATION. `bobPub` does not hash to `alicePkh`, so `require(hash160(pk) == pkh)` fails, AND
      // output 0 pays 100 satoshis against 474. `debug()` sees the first and throws; `send()` swallows it
      // because the unlocker is flagged as a covenant. Before this row the composer read the dust and nothing
      // else. Rows 1b, 1c and 1d each differ from this one in a single field.
      const message = await sendError(await p2pkhBuilder(100n, bobPub, true));
      expect(message).toMatch(BOTH_REFUSED);
      expect(message, 'the covenant objection is absorbed').toMatch(COVENANT_LINE);
      expect(message).toContain(SENTENCE.opVerify);
      expect(message, 'the byte objection is absorbed').toMatch(DUST_DETAIL);
    });

  it('1b. GUARD: the same covenant input with the RIGHT key reports the dust and no covenant line', async () => {
    // Differs from row 1 in the public key alone - same amounts, same outputs, same flag - so row 1's covenant
    // line is attributable to the key and to nothing else about the shape. This message is also byte-for-byte
    // what the site produced BEFORE this row: a byte-only refusal keeps its old text exactly.
    const message = await sendError(await p2pkhBuilder(100n, alicePub, true));
    expect(message).toMatch(BYTES_ONLY);
    expect(message, 'a covenant objection appeared without a broken covenant').not.toMatch(COVENANT_LINE);
    expect(message).toMatch(DUST_DETAIL);
  });

  it('1c. GUARD: the same broken covenant at the dust FLOOR clears the gate and the provider speaks', async () => {
    // Differs from row 1 in the payment amount alone. The bytes are admitted, so the gate never consults the
    // VM, and the objector is the PROVIDER - which produces the same sentence row 1 quoted, at the same input
    // index. That is what makes row 1's covenant line evidence rather than a string the SDK invented.
    const message = await sendError(await p2pkhBuilder(DUST_FLOOR, bobPub, true));
    expect(message, 'the byte gate spoke instead of the covenant').not.toMatch(/finalized transaction refused/);
    expect(message).toContain(`error in evaluating input index 0: ${SENTENCE.opVerify}`);
  });

  it('1d. GUARD: the identical transaction WITHOUT the covenant flag reports its require, not its bytes',
    async () => {
      // Differs from row 1 in `covenantUnlocker` alone. `debug()` is no longer swallowed, so the source-mapped
      // diagnostic surfaces and the gate is never reached. This is the row that keeps the standard path's
      // ordering intact, and the row that would go red if the fix had been applied by reordering rather than by
      // reporting both.
      const message = await sendError(await p2pkhBuilder(100n, bobPub, false));
      expect(message).toMatch(/P2PKH\.scash:4 Require statement failed at input 0/);
      expect(message).toMatch(/require\(hash160\(pk\) == pkh\)/);
      expect(message, 'the byte gate spoke before debug()').not.toMatch(/output-dust/);
      expect(message).not.toMatch(COVENANT_LINE);
    });

  /* ------------------------------------------------------------------------------------------------- */
  /* 2. The CUSTOM-UNLOCKER window: `debug()` is never called                                           */
  /* ------------------------------------------------------------------------------------------------- */

  it('2. BOTH: a custom unlocker whose script fails AND pays dust reports the covenant AND the dust',
    async () => {
      // `OP_1` locking under a scriptSig that pushes as well: the program ends with two stack items. Nothing
      // debugged this input, so before this row the gate's dust message was the whole story.
      const message = await sendError(await customBuilder(100n, Uint8Array.of(0x51), Uint8Array.of(0x51)));
      expect(message).toMatch(BOTH_REFUSED);
      expect(message).toMatch(COVENANT_LINE);
      expect(message).toContain(SENTENCE.leftover);
      expect(message).toMatch(DUST_DETAIL);
    });

  it('2b. GUARD: the same failing script at the dust FLOOR clears the gate and the provider speaks', async () => {
    // Differs from row 2 in the payment amount alone, and the provider produces row 2's sentence verbatim.
    const message = await sendError(await customBuilder(DUST_FLOOR, Uint8Array.of(0x51), Uint8Array.of(0x51)));
    expect(message).not.toMatch(/finalized transaction refused/);
    expect(message).toContain(`error in evaluating input index 0: ${SENTENCE.leftover}`);
  });

  it('2c. GUARD: the same dust payment under a script that SUCCEEDS reports the dust and no covenant line',
    async () => {
      // Differs from row 2 in the scriptSig alone - an empty one instead of a pushing one, over the identical
      // `OP_1` locking script - so row 2's covenant line is attributable to the leftover item.
      const message = await sendError(await customBuilder(100n, Uint8Array.of(0x51), new Uint8Array()));
      expect(message).toMatch(BYTES_ONLY);
      expect(message).not.toMatch(COVENANT_LINE);
      expect(message).toMatch(DUST_DETAIL);
    });

  it('2d. THE CLASS `state.error` COULD NOT SEE: a falsy final item is a covenant objection', async () => {
    // One byte apart from row 2c's locking script: `OP_0` instead of `OP_1`. No operation raises, so
    // `state.error` is undefined and the instrument used to call this covenant clean and report bytes only.
    // `vm.stateSuccess` sees it. This row is the regression pin for that widening.
    const message = await sendError(await customBuilder(100n, Uint8Array.of(0x00), new Uint8Array()));
    expect(message).toMatch(BOTH_REFUSED);
    expect(message).toMatch(COVENANT_LINE);
    expect(message).toContain(SENTENCE.falsyTop);
    expect(message).toMatch(DUST_DETAIL);
  });

  it('2e. GUARD: the same falsy-final-item script at the dust FLOOR is refused by the PROVIDER, verbatim',
    async () => {
      // Differs from row 2d in the payment amount alone. It also settles the question the widening raises -
      // whether the gate now refuses more than the node does. It does not: the node's own decider refuses
      // these bytes on its own, with row 2d's sentence character for character.
      const message = await sendError(await customBuilder(DUST_FLOOR, Uint8Array.of(0x00), new Uint8Array()));
      expect(message).not.toMatch(/finalized transaction refused/);
      expect(message).toContain(`error in evaluating input index 0: ${SENTENCE.falsyTop}`);
    });

  /* ------------------------------------------------------------------------------------------------- */
  /* 3. The subject that already existed in the population                                              */
  /* ------------------------------------------------------------------------------------------------- */

  it('3. X131 rows 4/4b are a LIVE subject: row 4 gains a covenant line and still refuses for its bytes',
    async () => {
      // A guard that can only fire on its own fixture proves nothing about the population. X131 row 4 predates
      // this row, asserts a CONSENSUS byte refusal, and is on the custom-unlocker path - so it is the
      // pre-existing send in the suite that the new code actually reaches. It gains the covenant line and
      // keeps every assertion it had, which is the whole claim: annotation, not replacement.
      const refused = await sendError(await oversizedInputBuilder(12_000));
      expect(refused).toMatch(/^messageBus: finalized transaction refused by its covenant and 1 byte rule\(s\)/);
      expect(refused).toMatch(/\[consensus\] consensus-unlocking-bytes at input 0/);
      expect(refused).toMatch(/12003 unlocking bytecode bytes is 2003 over the 10000-byte per-input script limit/);
      expect(refused).toContain(SENTENCE.leftover);

      // Row 4b's shape, 2,040 bytes smaller, is admitted by the gate - and the provider then produces row 4's
      // covenant sentence verbatim. Same two deciders, same sentence, one on each side of the byte boundary.
      const admitted = await sendError(await oversizedInputBuilder(9_960));
      expect(admitted).not.toMatch(/consensus-unlocking-bytes/);
      expect(admitted).toContain(`error in evaluating input index 0: ${SENTENCE.leftover}`);
    }, 60_000);

  /* ------------------------------------------------------------------------------------------------- */
  /* 4. The controls are checked against the vocabulary the deciders USE                                 */
  /* ------------------------------------------------------------------------------------------------- */

  it('4. every pattern asserted ABSENT above is proven able to SEE the thing it guards', async () => {
    // VACUOUS GUARD #22 IN ONE SENTENCE: a negative control matching on vocabulary the message does not use
    // cannot fail, so it guards nothing. The only defence is to show each `not.toMatch` pattern matching a
    // real message from this same file. Every pattern used in a negative position above appears here.
    const hostile = await sendError(await p2pkhBuilder(100n, bobPub, true));
    const custom = await sendError(await customBuilder(100n, Uint8Array.of(0x00), new Uint8Array()));

    // `COVENANT_LINE` is asserted absent in rows 1b, 1d and 2c. It matches both hostiles.
    expect(hostile).toMatch(COVENANT_LINE);
    expect(custom).toMatch(COVENANT_LINE);
    // `/output-dust/` is asserted absent in row 1d. It matches a message that carries a dust refusal.
    expect(hostile).toMatch(/output-dust/);
    // `/finalized transaction refused/` is asserted absent in rows 1c, 2b and 2e. It matches a gate refusal.
    expect(hostile).toMatch(/finalized transaction refused/);
    // `/consensus-unlocking-bytes/` is asserted absent in row 3's second half.
    expect(await sendError(await oversizedInputBuilder(12_000))).toMatch(/consensus-unlocking-bytes/);
    // `BYTES_ONLY` and `BOTH_REFUSED` are mutually exclusive at the anchor, so neither can absorb the other.
    expect(hostile).not.toMatch(BYTES_ONLY);
    expect(await sendError(await p2pkhBuilder(100n, alicePub, true))).not.toMatch(BOTH_REFUSED);
  }, 60_000);

  it('4b. GUARD #22 REPRODUCED: its vocabulary is blind to a class this file reports', async () => {
    // The control that let #22 through was `not.toMatch(/checkSig|OP_/)`. Run it against the falsy-final-item
    // covenant sentence and it PASSES while the covenant line is right there - the sentence contains neither
    // token. This is not a hypothetical: it is why every negative control above matches on `[covenant]`, a
    // string the GATE writes, rather than on anything libauth chose to say.
    const custom = await sendError(await customBuilder(100n, Uint8Array.of(0x00), new Uint8Array()));
    expect(custom).toMatch(COVENANT_LINE);
    expect(SENTENCE.falsyTop).not.toMatch(/checkSig|OP_/);
    // And the vocabulary IS load-bearing in the other direction: the P2PKH sentence contains `OP_`, so the
    // same control would have been live there. A control's blindness depends on the failure class, which is
    // exactly what makes vocabulary matching unsafe as a rule.
    expect(SENTENCE.opVerify).toMatch(/OP_/);
  });

  /* ------------------------------------------------------------------------------------------------- */
  /* 5. Structural: where the mechanism lives, and which sites route through it                          */
  /* ------------------------------------------------------------------------------------------------- */

  const SRC_ROOT = fileURLToPath(new URL('../../src/', import.meta.url));
  const read = (file: string): string[] => readFileSync(`${SRC_ROOT}${file}`, 'utf8').split('\n');
  /** Call lines only: not the declaration, not an import, not a comment. */
  const callsTo = (lines: string[], name: string): string[] => lines.filter(
    (line) => new RegExp(`${name}\\(`).test(line)
      && !/^\s*[*/]/.test(line) && !/^(import|export function|function)/.test(line)
      && !/^\s{2}\w+,?$/.test(line),
  );

  it('5a. the bytes are assessed FIRST and an admitted verdict returns before the VM is touched', () => {
    // THE COST CLAIM, held structurally because it is a claim about an ordering. Every send that settles -
    // the 1,159 the X126 probe measured accepted through this site, and every one since - takes the early
    // return, so this row is what makes "it cannot cost anything" checkable rather than asserted.
    const body = readFileSync(`${SRC_ROOT}message-bus/preflight.ts`, 'utf8')
      .split('export function assertFinalizedBytesWithCovenant')[1];
    expect(body.indexOf('assessFinalizedTransactionBytes(transaction, subjects)'))
      .toBeLessThan(body.indexOf('if (verdict.admitted) return;'));
    expect(body.indexOf('if (verdict.admitted) return;'))
      .toBeLessThan(body.indexOf('covenantObjectionOf(builder, transaction)'));
  });

  it('5b. STRUCTURAL: the routed sites route, and the bare gate has exactly one caller left outside preflight',
    () => {
      // THE ROW THAT MOVED WITH THE CODE. It was `L4StatefulAdminSiteGate` row 5f, counting one bare call and
      // four routed sites inside `StatefulContract.ts`; the helper now lives in `message-bus/preflight.ts` and
      // `TransactionBuilder.send` is its second caller, so the count is per file and lives here.
      //
      // A new broadcast path added later gets whichever gate its author copies from a neighbour. Every
      // neighbour at a site with no covenant verdict ahead of it now calls the routed one.
      const builder = read('TransactionBuilder.ts');
      expect(callsTo(builder, 'assertFinalizedBytesWithCovenant')).toHaveLength(1);
      expect(callsTo(builder, 'assertFinalizedTransactionBytes')).toHaveLength(0);

      const stateful = read('stateful/StatefulContract.ts');
      expect(callsTo(stateful, 'assertFinalizedBytesWithCovenant')).toHaveLength(4);
      expect(callsTo(stateful, 'assertFinalizedTransactionBytes')).toHaveLength(0);

      // Inside `preflight.ts` the bare gate keeps three callers: the covenant-clean branch of the helper
      // itself, and the two message bus entry points that run `evaluateEveryInput` BEFORE it - a guaranteed
      // covenant verdict ahead of the bytes, which is the same property by a different route.
      const preflight = read('message-bus/preflight.ts');
      const bare = callsTo(preflight, 'assertFinalizedTransactionBytes');
      expect(bare, `bare calls: ${bare.join(' | ')}`).toHaveLength(3);
      expect(bare[0]).toMatch(/if \(covenant === undefined\)/);
      const text = preflight.join('\n');
      for (const entry of ['preflightMessageBusTransaction', 'sendPreflightedMessageBusTransaction']) {
        const body = text.split(entry)[2] ?? text.split(entry)[1];
        expect(body.indexOf('evaluateEveryInput(builder, transaction)'))
          .toBeLessThan(body.indexOf('assertFinalizedTransactionBytes(transaction, options)'));
      }

      // THE RESIDUE, NAMED RATHER THAN IMPLIED. The stateful submit phase still calls the bare gate, and its
      // own `debug()` is swallowed (`covenantBuilder.debug()` inside a catch) while its strict VM preflight is
      // conditional on `strictVmPreflight` - so no covenant verdict is guaranteed ahead of it either. That
      // window is NOT closed by this row, and `L4GateAtSubmitSite` row 1 asserts `refused by 1 byte rule(s)`,
      // which the combined message would not match. Whoever routes it must update that file in the same change.
      const submit = read('stateful/StatefulTransactionBuilder.ts');
      expect(callsTo(submit, 'assertFinalizedTransactionBytes')).toHaveLength(1);
      expect(callsTo(submit, 'assertFinalizedBytesWithCovenant')).toHaveLength(0);
    });
});
