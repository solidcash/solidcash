import { describe, expect, it } from 'vitest';
import { compileFile, compileFileMulti, compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import type { Utxo } from '../../src/interfaces.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  BCH_2026_CONSENSUS, BCH_2026_STANDARD, assessEnvelope, densityKnobControl, formatEnvelope,
  knobControlBudgetFor,
} from './layer3-envelope-f1.js';
import type { EnvelopeMeasurement } from './layer3-envelope-f1.js';
import { deriveCalibration, estimate, formatEstimate } from './layer3-estimator-f2.js';
import { F2_BASIS, F2_BASIS_COMMIT } from './layer3-estimator-basis-f2.js';
import {
  F3_CENSUS_BUS_FAILURES, F3_CENSUS_COMMIT, F3_CENSUS_CORPORA, F3_CENSUS_DIRECT_FAILURES, F3_CENSUS_ELIGIBLE,
  F3_CENSUS_GATES, F3_CENSUS_REJECTIONS,
} from './layer3-corpus-census-f3.js';
import { fitAt, formatFitRow, replicaSpec } from './layer3-corpus-fit-f3.js';
import { verifyCorpusPins } from './layer3-corpus-pins.js';
import type { CensusRow } from './layer3-corpus-fit-f3.js';

/**
 * F3. DOES THE MESSAGE BUS FIT THE CONTRACTS PEOPLE ACTUALLY WRITE?
 *
 * F1 measured seven shapes built for the purpose. F2 predicts an eighth from its descriptor. Both answer
 * "how much capacity is there"; neither answers "who wants it". This file takes the four real corpora in the
 * repository - MistSwap, Effective Acceleration, solidity-by-example and the solc conformance corpus - and
 * reports how they land against the measured envelope.
 *
 * WHAT IS MEASURED AND WHAT IS ESTIMATED, stated before any number.
 *
 *  - The CENSUS is measured. Every count, block size, redeem length, eligible handler and named refusal below
 *    is a compile output taken by `layer3-corpus-probe-f3.mjs` at ONE commit, recorded in
 *    `layer3-corpus-census-f3.ts`. Nothing is carried forward from an older bench run.
 *  - Where a graph of those contracts LANDS is estimated by F2, from the census descriptor alone. F2 is
 *    conservative in-sample by construction and measured at 22/28 leave-one-out, so an estimate here is an
 *    upper bound under its calibration and NOT a fit claim.
 *  - The one BUILT graph in this file is measured by F1's `assessEnvelope`, run to completion with a
 *    knob-liveness control, and it is the only row that is a measurement of a transaction.
 *
 * NOTHING HERE IS `CONSENSUS_FIT` OR `POLICY_FIT`. A census plus an estimate is neither.
 */

const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);

/**
 * THE TWO GENERATED COVENANTS, DEPLOYED HERE RATHER THAN DEFAULTED FROM THE CALIBRATION.
 *
 * `GraphShapeSpec` lets a caller pass these and defaults them from the calibration when it does not. The
 * default is stale the moment either covenant moves, and it had moved: the F2 basis carries the pre-X65
 * projection verifier, so every corpus prediction in this file was carrying 421 bytes per participant that
 * HEAD does not generate. Two compiles and two instantiations - no UTXO, no builder, no VM - remove the whole
 * class of error.
 *
 * X85. THE FIGURE IS 421 BYTES ON THE PROJECTION AND NOTHING ON THE CONTROLLER, and getting that wrong the
 * first time is why these are INSTANTIATED lengths rather than compiled ones.
 *
 * The quantity `estimate` wants is the redeem script the input PUSHES, which for a covenant with constructor
 * parameters is the compiled bytecode plus each argument's push. The projection verifier takes none, so its
 * compile and its deployment are both 4,121 bytes against the basis's 4,542: 421 bytes of real staleness, once
 * per participant. (R3-13: this read 4,098 and 444, which was the figure between X65 and X81. Both are
 * measured here rather than cited - the assertions below read `MEASURED_COVENANTS`, which is two compiles at
 * module scope, so nothing in this file depends on the paragraph being current.)
 * The root controller takes a `bytes20 initializer`, so it compiles to 1,493 and deploys at
 * 1,514 - which is exactly what the calibration holds. Reading 1,493 off the compile and calling the
 * difference a stale covenant invented a 21-byte saving that does not exist, and passing it would have
 * UNDER-stated the controller input, which is the one direction a conservative estimator may not err in. The
 * built-graph rows assert both figures against the script their transaction actually pushes, and that
 * assertion is what caught it.
 *
 * AND THE CONSEQUENCE IS NOT ONLY A LOOSE BAND. The estimated-landing test tallies both descriptors and prints
 * the difference, so the run states its own figure rather than quoting this comment: the dead covenant is 421
 * bytes per participant, 3,368 serialized bytes at eight, and the standard relay ceiling is what the affected
 * rows were being refused on. A stale constant that only inflated a published band would be an accuracy
 * problem; one that answers "will not fit" about a graph that fits is a wrong answer. Measured at `3281ece9`,
 * the default answers OVER on 22 of 1,712 predicted rows that the live covenant sizes say fit - printed by the
 * run, not quoted from here.
 */
const MEASURED_COVENANTS = ((): { projectionRedeemBytes: number; controllerRedeemBytes: number } => {
  const provider = new MockNetworkProvider();
  const projection = new Contract(compileString(layer3.generateGraphProjectionVerifier()), [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)),
    [new Uint8Array(20)], { provider },
  );
  return {
    projectionRedeemBytes: projection.bytecode.length / 2,
    controllerRedeemBytes: controller.bytecode.length / 2,
  };
})();

const corpora = Object.keys(F3_CENSUS_GATES);
const eligible = F3_CENSUS_ELIGIBLE.filter((row) => typeof row.redeemBytes === 'number');

/** The two APPLICATION corpora: the population the report's most-quoted sentence is about. */
const applicationRows = F3_CENSUS_ELIGIBLE
  .filter((row) => row.corpus === 'mistswap' || row.corpus === 'eacc');

/**
 * X113 / R3-4. THE APPLICATION POPULATION IS COMPILED IN FULL, ONCE, AND SHARED.
 *
 * WHAT WAS HERE AND WHY IT HAD TO GO. The live headline test selected its subjects with
 * `redeemBytes < 8_000`, and that rule is not a subject rule at all - it is a rule that ERODES. It selected 6
 * of the 12 application rows at the recorded bytes and it excluded, by construction, the two rows that carry
 * the answer: `UniswapV2Pair` (14,556 recorded) and `UniswapV2Factory` (43,939) are the ONLY application
 * contracts that admit a state-changing handler, so the rule hid exactly the counter-example to the sentence
 * the test was asserting. A guard that gets weaker as the system grows is worse than no guard, because it
 * reports green while its subject leaves.
 *
 * MEASURED, so the replacement is not a preference: compiling all twelve in bus mode takes 5 m 40 s total
 * (MarketplaceV1 87 s, V2 61 s, V3 60 s, UnicrowClaim 29 s, SushiRoll 27 s, UniswapV2Factory 17 s,
 * UniswapV2Pair 16 s, UnicrowArbitrator 9 s, EACCToken 8 s, UnicrowDispute 7 s, FakeToken 7 s,
 * TreasurySplit 6 s), against this file's 900,000 ms budget. The docstring's claim that
 * `MarketplaceV1/V2/V3.sol` and `EACCToken.sol` "take minutes each" is right about MarketplaceV1 and wrong
 * about EACCToken, which is one of the fastest. So the size rule is replaced by NO rule: the whole recorded
 * application population is the subject, the population size is pinned, and nothing can silently leave it.
 *
 * A compile FAILURE is a measurement here, not a skip: the set of failing rows is pinned by name, so both a
 * new failure and a repair turn the row red and have to be re-read.
 */
const APPLICATION_COMPILES = new Map<string, { artifact?: any; error?: string; seconds: number }>();

function compileApplicationRow(row: CensusRow): { artifact?: any; error?: string; seconds: number } {
  const key = `${row.corpus}/${row.rel}/${row.contractName}`;
  const cached = APPLICATION_COMPILES.get(key);
  if (cached !== undefined) return cached;
  const file = `${CORPUS_ROOTS[row.corpus]}/${row.rel}`;
  const started = Date.now();
  let result: { artifact?: any; error?: string; seconds: number };
  try {
    const artifact = compileFile(file, {
      solidityImportCompat: true,
      ecrecover: 'p2pkh',
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    } as never);
    result = { artifact, seconds: (Date.now() - started) / 1000 };
  } catch (error) {
    result = {
      error: `${(error as Error).name}: ${(error as Error).message.split('\n')[0]}`,
      seconds: (Date.now() - started) / 1000,
    };
  }
  APPLICATION_COMPILES.set(key, result);
  return result;
}

/**
 * The application rows that DO NOT COMPILE in bus mode at this commit, pinned by name.
 *
 * Every one of them is recorded `bus: 'OK'` in the census taken at `b4d33fc1`, so each is a compiler
 * regression between that commit and this one rather than a property of the contract. They are named here
 * because the alternative is what the file used to do: compile them inside the assertion loop with no
 * try/catch, which made the whole headline test THROW. It was red at `1b7086da` before this row touched it,
 * on `SushiRoll`.
 */
/**
 * RE-PINNED TO EMPTY after X115/L2-F2. All three recovered: `routeReachable` admitted the route's callees and
 * never the route itself, so `invokesJournalHandler` was true against an empty slot set and code generation
 * hit `Missing journal context`. TreasurySplit and SushiRoll were named as fixed by that change.
 *
 * X132: the two disagreeing UnicrowClaim measurements have DIFFERENT SUBJECTS, not different options.
 * `UnicrowClaim.sol` compiles in bus mode under every option set that parses and has no `refund` at all;
 * `refund` is `Unicrow.sol:218`, whose `call{value:}` at `:262` raises the refusal. `ecrecover: 'p2pkh'`
 * decides neither - identical outcome both ways, same 6,728 bytes. `Unicrow.sol` cannot appear in the pin
 * below because that lists APPLICATION rows and a bus-compile failure never becomes one; it is the single
 * `LowLevelCallShapeError` in the eacc column of `F3_CENSUS_BUS_FAILURES`. Pinned in
 * `packages/solidc/test/LowLevelCallShapes.test.ts`.
 */
const APPLICATION_COMPILE_FAILURES: string[] = [];

/**
 * The application rows admitting at least one handler the compiler does NOT prove read-only, pinned by name.
 *
 * THE "12 / 0 / 134" HEADLINE IS RETIRED AND THIS IS THE FIGURE THAT REPLACES IT. Measured at `1b7086da` over
 * the full application population: 2 of 12 contracts admit 4 state-changing handlers -
 * `UniswapV2Pair.initialize`, and `UniswapV2Factory.setFeeTo` / `setMigrator` / `setFeeToSetter`, all four
 * `writesState: true` with an ABI entry present, so none is the conservative absent-flag reading. Both
 * contracts sit above the 8,000-byte rule that used to select the subjects, which is why the old subset could
 * assert exactly zero and stay green.
 */
/**
 * X135 ANSWERED IT, AND THE FIGURE COMES BACK TO 2. THE CLASSIFICATION WAS WRONG; NOTHING WAS WRITING.
 *
 * The L2-F2 repair moved this pin to 3 by adding `FakeToken`, on the strength of `name` and `symbol` being
 * published `writesState: true`. Both are ERC-20 metadata getters whose entire body is `return _name;`. The
 * two candidate explanations were "the classification is wrong for a `string` storage read" and "they
 * genuinely write, which is worse". It is the FIRST, and the discriminating measurement is one compile pair
 * on the same file with the same options, the route being the only difference:
 *
 *   DIRECT  name  writesState=false  dynamicWrites=[]         dynamicReads=["_name"]
 *   BUS     name  writesState=true   dynamicWrites=["_name"]  dynamicReads=["_name"]
 *
 * MECHANISM. `GenerateTargetTraversal` pre-allocates one chunk slot for every dynamic journal slot a handler
 * HOLDS, and after SEC-18's widening a handler holds a slot it only READS. For a dynamic slot that
 * pre-allocation appended to `dynamicWrites` with no writer test, and `Artifact.ts` read a non-empty
 * `dynamicWrites` as a write. The epilogue writes the pre-state value back unchanged - the chunk UTXOs are
 * genuinely co-spent and recreated, and nothing changes. X105 had already gated the SCALAR sibling of exactly
 * this leak, which is why `decimals` and `totalSupply` on the same contract never moved.
 *
 * FIXED IN THE PUBLISHED FLAG, not in `dynamicWrites` - codegen and the SDK both read that list to place the
 * chunk outputs, so clearing it would make the covenant count `_name` as a preserved read AND write it.
 * Cross-checked over all three real corpora, 96 contracts and 631 ABI entries: after the fix the bus-mode
 * `writesState` equals the direct-mode `writesState` on EVERY entry - zero handlers where direct writes and
 * the bus says read-only (which would be a fail-open) and zero remaining leaks in the other direction.
 *
 * So the headline does not move a fourth time: it moves BACK to the 2 of 12 / 4 handlers measured at
 * `1b7086da`, and `FakeToken`'s whole admitted surface - `allowance`, `balanceOf`, `decimals`, `name`,
 * `symbol`, `totalSupply` - is read-only. Its three writers (`transfer`, `approve`, `transferFrom`) are
 * REFUSED from the route, which is why it never belonged here.
 */
const APPLICATION_STATE_CHANGERS = ['UniswapV2Pair', 'UniswapV2Factory'];
// `UniswapV2Pair.initialize`, and `UniswapV2Factory.setFeeTo` / `setMigrator` / `setFeeToSetter`. The L2-F2
// repair raised this to 6 by admitting FakeToken's `name` and `symbol`; X135 established that both readings
// were a misclassification, so the count returns to the four handlers that really do write.
const APPLICATION_STATE_CHANGING_HANDLERS = 4;

/** Corpus roots, so a census row can be recompiled. Same defaults the probe uses. */
const CORPUS_ROOTS: Record<string, string> = {
  mistswap: process.env.MISTSWAP_ROOT ?? '/Code/mistswap/mistswap/contracts',
  eacc: process.env.EACC_CONTRACTS_DIR ?? '/Code/effectiveacceleration.ai/contract/contracts',
  'solidity-by-example': `${process.env.SBE_ROOT ?? '/Code/solidity-by-example'}/contracts/src`,
  'solc-corpus': process.env.SOLC_CORPUS ?? '/Code/solidity',
};

const zeros = (length: number): Uint8Array => new Uint8Array(length);

/** Shortest valid value of a parameter type, so a real contract can be instantiated and invoked. */
function placeholder(type: string): unknown {
  if (/^u?int\d*$/.test(type) || type === 'bigint') return 1n;
  if (type === 'bool') return false;
  if (type === 'string') return '';
  if (type === 'address') return `aa20${'33'.repeat(32)}87`;
  if (type === 'pubkey') return zeros(33);
  if (type === 'sig') return zeros(65);
  if (type === 'datasig') return zeros(64);
  if (type === 'bytes') return zeros(0);
  const fixed = /^bytes(\d+)$/.exec(type);
  if (fixed) return zeros(Number(fixed[1]));
  return undefined;
}

/**
 * The subject of the measured control, chosen by a RULE rather than by hand, so it cannot be the one contract
 * that happened to work.
 *
 * A one-slot block is required, and that is a statement about what this file can build rather than about the
 * bus: a participant whose block has sidecar slots needs those exact entry/resource UTXOs seeded before the
 * transaction exists, which is per-contract work a corpus-wide harness cannot do generically. Among one-slot
 * candidates the LARGEST redeem script is taken, because the per-input script limit is what a real contract is
 * most likely to run into and the biggest one is the hardest case available.
 */
function measuredControlCandidates(): CensusRow[] {
  return eligible
    .filter((row) => row.blockSize === 1
      && (row.constructorTypes ?? []).every((type) => placeholder(type) !== undefined)
      && CORPUS_ROOTS[row.corpus] !== undefined)
    .sort((left, right) => right.redeemBytes! - left.redeemBytes!);
}

describe('F3 census: how much of the real corpora can reach the bus at all', () => {
  /**
   * R3-16. THE FIT REPORT QUOTES PERCENTAGES OVER FOUR EXTERNAL CHECKOUTS, so it must not quote them from
   * unpinned sources. Wiring supplied as a BLOCKED hunk by the R3-16 worker; `layer3-corpus-pins.ts` is the
   * verifier and `Layer3CorpusPins.test.ts` proves it independently. A checkout that cannot be verified is a
   * NAMED refusal here rather than a silently different denominator - the same standard X113 applies to the
   * subject rule below.
   */
  it('rests on corpus checkouts at their pinned commits', () => {
    const verdict = verifyCorpusPins();
    for (const refusal of verdict.refusals) console.log(`[F3] R3-16 ${refusal}`);
    expect(verdict.refusals).toEqual([]);
  });

  /**
   * The gate chain, counted. Each gate is a strictly weaker population than the one before it, which is
   * asserted rather than assumed: a census whose "eligible" count exceeded its "compiles" count would be a
   * bookkeeping error, and the assertion is what makes the published table trustworthy.
   */
  it('MEASURED: the gate chain is monotone and the counts are published', () => {
    console.log(`[F3] census taken at ${F3_CENSUS_COMMIT}, corpora ${F3_CENSUS_CORPORA.join(', ')}`);
    // X86. ALL FOUR CORPORA, TAKEN IN ONE RUN AT ONE COMMIT. A partial re-take would leave rows from two
    // compilers under one commit stamp, and this is the line that would catch it: the gate table and the
    // recorded corpora have to describe the same set. Measured cost of the full re-take at stride 12: 29
    // minutes, so there is no reason to take a partial one.
    expect([...F3_CENSUS_CORPORA].sort()).toEqual([...corpora].sort());
    expect(F3_CENSUS_CORPORA).toHaveLength(4);
    console.log('[F3] corpus                 files contracts  direct     bus   route  handler  instantiable');
    for (const corpus of corpora) {
      const gate = F3_CENSUS_GATES[corpus];
      console.log(`[F3] ${corpus.padEnd(22)}${String(gate.files).padStart(6)}`
        + `${String(gate.contracts).padStart(10)}${String(gate.directOk).padStart(8)}`
        + `${String(gate.busOk).padStart(8)}${String(gate.routePresent).padStart(8)}`
        + `${String(gate.eligibleHandler).padStart(9)}${String(gate.instantiable).padStart(14)}`);
      expect(gate.directOk, `${corpus}: direct-OK exceeds the contract count`)
        .toBeLessThanOrEqual(gate.contracts);
      expect(gate.busOk, `${corpus}: bus-OK exceeds direct-OK`).toBeLessThanOrEqual(gate.directOk);
      expect(gate.routePresent, `${corpus}: route-present exceeds bus-OK`).toBeLessThanOrEqual(gate.busOk);
      expect(gate.eligibleHandler, `${corpus}: eligible exceeds route-present`)
        .toBeLessThanOrEqual(gate.routePresent);
      expect(gate.instantiable, `${corpus}: instantiable exceeds eligible`)
        .toBeLessThanOrEqual(gate.eligibleHandler);
    }
    const totals = corpora.reduce((sum, corpus) => {
      const gate = F3_CENSUS_GATES[corpus];
      return {
        contracts: sum.contracts + gate.contracts,
        directOk: sum.directOk + gate.directOk,
        eligibleHandler: sum.eligibleHandler + gate.eligibleHandler,
        instantiable: sum.instantiable + gate.instantiable,
      };
    }, { contracts: 0, directOk: 0, eligibleHandler: 0, instantiable: 0 });
    console.log(`[F3] TOTAL contracts=${totals.contracts} direct=${totals.directOk} `
      + `eligible=${totals.eligibleHandler} instantiable=${totals.instantiable}`);
    // The recorded eligible rows and the eligible gate counts are two independent tallies of the same
    // population, so they must agree; if they do not, one of them was edited by hand.
    expect(F3_CENSUS_ELIGIBLE.length).toBe(totals.eligibleHandler);
  });

  /**
   * WHAT STOPS THE REST, by the compiler's own name for it. These are the refusals route synthesis publishes
   * per entry point; they are implementation state, not physics, and the report separates the two.
   */
  it('MEASURED: every route refusal is named, and the histogram is published', () => {
    const combined: Record<string, number> = {};
    for (const corpus of corpora) {
      for (const [reason, count] of Object.entries(F3_CENSUS_REJECTIONS[corpus] ?? {})) {
        combined[reason] = (combined[reason] ?? 0) + count;
      }
    }
    const ordered = Object.entries(combined).sort((left, right) => right[1] - left[1]);
    console.log('[F3] named route refusals, all corpora:');
    for (const [reason, count] of ordered) console.log(`[F3]   ${String(count).padStart(6)}  ${reason}`);
    expect(ordered.length).toBeGreaterThan(0);
    expect(ordered.filter(([reason]) => reason === '')).toEqual([]);
    // `unnamed` counts handlers published as `eligible: false` with NO `rejectionReason`. That is a hole in the
    // diagnostic channel rather than a category of contract, and the next test pins what falls into it.
    const unnamed = combined.unnamed ?? 0;
    console.log(`[F3] refusals published WITHOUT a reason: ${unnamed}`);
  });

  /**
   * WHAT THE UNNAMED REFUSAL ACTUALLY IS, pinned rather than inferred from a histogram - AND THE HOLE IS NOW
   * CLOSED, which is why this test asserts the closure instead of the hole.
   *
   * Route synthesis is documented to record "one stable reason per entry point", and `hiddenBatch.handlers`
   * publishes `eligible` and `rejectionReason` together. A handler that arrived `eligible: false` with no
   * reason was therefore a gap, and it turned out to be a COMPILER-SYNTHESIZED entry point - the block-oracle
   * updater a contract reading `block.*` gets for free - not anything a user wrote.
   *
   * X72 gave it a name. Recompiled at `77cd1e8c`, the census's own flagged subject has ZERO unnamed refusals
   * and reports `not-examined-by-route-synthesis` in their place, which is why `expect(unnamed.length)
   * .toBeGreaterThan(0)` was FAILING on this line. The repair is not to drop the assertion: the property that
   * mattered was never "some refusal is unnamed", it was "no refusal on a handler the user wrote is unnamed",
   * and closing the hole satisfies that strictly better. So the test now asserts the invariant directly and
   * additionally requires EVERY refused handler on the subject to carry a name, which is the stronger claim
   * the tree now supports and which would fail again if the channel regressed.
   *
   * X87. THE SUBJECT IS NOW CHOSEN BY WALKING, because pinning it to ONE census row is how this test failed in
   * the first place. Any recorded refusal can stop reproducing - X72 renamed the whole `unnamed` bucket, X76
   * lifted two gates and moved another 22 firings down to 5 - and a lone subject that stops refusing turns the
   * "is it doing work" guard red without anything being wrong. So candidates are taken in census order and
   * recompiled until one still refuses something; the invariant is asserted on EVERY candidate examined, and
   * only the "doing work" line depends on finding a refusing one. Measured at this commit: the first candidate,
   * `mistswap/SushiRoll`, still refuses two named reasons, so exactly one recompile happens.
   */
  it('MEASURED: no route refusal is unnamed on a handler the user wrote', () => {
    // Rows whose recorded refusal is `unnamed` first, since that is the bucket under investigation.
    const candidates = [
      ...F3_CENSUS_ELIGIBLE.filter((row) => (row.rejectionReasons ?? []).includes('unnamed')),
      ...F3_CENSUS_ELIGIBLE.filter((row) => (row.rejectionReasons ?? []).length > 0
        && !(row.rejectionReasons ?? []).includes('unnamed')),
    ].filter((row) => CORPUS_ROOTS[row.corpus] !== undefined);
    expect(candidates, 'the census records no refused entry point to recompile').not.toEqual([]);
    let examined = 0;
    let refusing: { name: string; reasons: string[] } | undefined;
    // THE WALK NOW SURVIVES A CANDIDATE THAT NO LONGER COMPILES, and it has to: this test was RED at
    // `1b7086da` before this row touched it, because its FIRST candidate is `mistswap/SushiRoll` and SushiRoll
    // stopped compiling in bus mode ("Missing journal context '__internal__state_write_oldRouter'") since the
    // census commit `b4d33fc1` that recorded it as `bus: 'OK'`. X87 built this walk precisely so that one
    // candidate ceasing to reproduce could not turn the row red for the wrong reason - and then handled only
    // "stops refusing", not "stops compiling". A compile failure is NAMED, PRINTED and counted here; it is not
    // swallowed, and the two load-bearing assertions below still run on every candidate that does compile.
    const uncompilable: string[] = [];
    for (const subject of candidates.slice(0, 4)) {
      let artifact;
      try {
        artifact = compileFile(`${CORPUS_ROOTS[subject.corpus]}/${subject.rel}`, {
          solidityImportCompat: true,
          ecrecover: 'p2pkh',
          forceStateful: true,
          experimentalHiddenBatch: true,
          experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
          experimentalMessageBusControllerCategory: '22'.repeat(32),
        } as never);
      } catch (error) {
        uncompilable.push(`${subject.corpus}/${subject.contractName}: `
          + `${(error as Error).name}: ${(error as Error).message.split('\n')[0]}`);
        continue;
      }
      examined += 1;
      const refused = (artifact.hiddenBatch?.handlers ?? []).filter((handler) => !handler.eligible);
      const unnamed = refused.filter((handler) => handler.rejectionReason === undefined);
      const reasons = [...new Set(refused.map((handler) => handler.rejectionReason ?? 'unnamed'))];
      console.log(`[F3] ${subject.contractName}: census recorded reasons `
        + `${JSON.stringify(subject.rejectionReasons)}`);
      console.log(`[F3] ${subject.contractName}: recompiled reasons ${JSON.stringify(reasons)}`);
      console.log(`[F3] ${subject.contractName}: unnamed refusals = ${unnamed.length}`
        + `${unnamed.length > 0 ? ` (${unnamed.map((handler) => handler.name).join(', ')})` : ''}`);
      // THE INVARIANT, which held before X72 and holds after it: whatever arrives without a reason is
      // compiler-synthesized. Vacuously true when the hole is closed, and that is the correct semantics.
      expect(unnamed.every((handler) => handler.name.startsWith('__')),
        `${subject.contractName}: an unnamed refusal fell on a handler the user wrote`).toBe(true);
      // THE CLOSURE, asserted because the tree supports it: every refusal carries a name.
      expect(unnamed, `${subject.contractName}: a refused entry point is published with no reason`).toEqual([]);
      if (refused.length > 0) { refusing = { name: subject.contractName!, reasons }; break; }
    }
    for (const failure of uncompilable) console.log(`[F3] candidate NO LONGER COMPILES - ${failure}`);
    console.log(`[F3] examined ${examined} census candidate(s), ${uncompilable.length} uncompilable; `
      + 'refusing subject: '
      + `${refusing === undefined ? 'NONE' : `${refusing.name} ${JSON.stringify(refusing.reasons)}`}`);
    // The walk has to have EXAMINED something, or the invariant assertions above ran zero times and the
    // "doing work" guard below is the only line left standing.
    expect(examined, `every candidate the walk tried failed to compile: ${uncompilable.join('; ')}`)
      .toBeGreaterThan(0);
    // The "doing work" guard, on the WALK rather than on one row: at least one recorded refusal must still
    // reproduce, or this test is checking a channel nothing sends down.
    expect(refusing, 'every census-flagged row now refuses nothing, so the closure is vacuous').toBeDefined();
  }, 300_000);

  /**
   * REACHABLE IS NOT THE SAME AS USEFUL, and this is the count that separates them.
   *
   * A participant whose entire admitted surface is read-only can be co-spent in a graph and can be invoked,
   * but it cannot change anything the graph did not already know, so composing it buys nothing a plain read
   * would not. `writesState: false` is the compiler's own proof of read-only; absent is read as writing, which
   * is the conservative direction for this count.
   */
  it('MEASURED: how many bus-reachable contracts admit a handler that can change state', () => {
    const classified = F3_CENSUS_ELIGIBLE.filter((row) => row.eligibleWrites !== undefined);
    if (classified.length === 0) {
      console.log('[F3] the census carries no write classification');
      return;
    }
    const writing = classified.filter((row) => row.eligibleWrites!.length > 0);
    const turnedAway = classified.reduce((sum, row) => sum + (row.refusedWrites ?? 0), 0);
    const admittedWrites = classified.reduce((sum, row) => sum + row.eligibleWrites!.length, 0);
    console.log(`[F3] bus-reachable contracts with the write classification: ${classified.length}`);
    console.log(`[F3]   admitting at least one state-changing handler: ${writing.length}`);
    console.log(`[F3]   read-only surface only: ${classified.length - writing.length}`);
    console.log(`[F3]   admitted state-changing handlers: ${admittedWrites}; refused ones: ${turnedAway}`);
    for (const row of writing) {
      console.log(`[F3]   ${row.corpus}/${row.contractName}: ${row.eligibleWrites!.join(', ')}`);
    }
    expect(writing.length).toBeLessThanOrEqual(classified.length);
  });

  /**
   * THE HEADLINE, RE-DERIVED AFTER X73 REMOVED THE GATE THAT WAS SUPPOSED TO EXPLAIN IT.
   *
   * "All twelve bus-reachable application contracts admit a read-only surface and nothing else" is the most
   * quoted sentence in this report, and it was measured at `6a685f33`, BEFORE X73 lifted
   * `initial-v1-route-requires-public-visibility` - which section 3.1 names as the largest single reason for
   * refusal, 172 of 455. A claim whose stated cause has been removed has to be re-measured, not re-reasoned.
   *
   * IT STILL HOLDS. Re-run over both application corpora at `77cd1e8c` with `layer3-corpus-probe-f3.mjs`,
   * same options and same denominators: 12 bus-reachable, **0** admitting a state-changing handler, 12
   * read-only only, 134 state-changing handlers refused (MistSwap 18, EA 116). Every figure reproduces, and so
   * does every gate count.
   *
   * WHAT MOVED IS THE REASON. The visibility gate is at 0 on both corpora, down from 2 and 14, and every
   * handler it freed landed on a different gate: EA gained `external-handler-route-generation-unsupported` (6)
   * and `external-handler-would-shrink-the-route` (4), its `mixed-scalar-and-collection` count went 4 -> 7, and
   * `unnamed` went to 0 on both because X72 renamed it `not-examined-by-route-synthesis` one-for-one. Admitted
   * handlers rose to 6 on MistSwap and 17 on EA and ALL of them are still read-only. That is D2's stacked-gates
   * result on real applications: lifting the largest gate on the board moved the useful count from zero to
   * zero.
   *
   * WHAT THIS TEST ASSERTS, AND IT IS NO LONGER A SUBSET (X113). Every one of the twelve recorded application
   * rows is compiled here. The `redeemBytes < 8_000` rule that used to select the subjects is gone: see
   * `APPLICATION_COMPILES` for why it had to go and for the measured compile budget that lets the whole
   * population be the subject.
   *
   * AND THE HEADLINE IT USED TO ASSERT IS RETIRED, by measurement rather than by argument. Over the full
   * population 2 of 12 contracts admit 4 state-changing handlers; over the size-selected 6 the figure was 0,
   * because both write-admitting contracts are above 8,000 bytes. The assertion states the current figure and
   * names the contracts, so a change in either direction has to be re-read rather than absorbed.
   */
  it('MEASURED: X73 lifted the visibility gate, and the FULL application write surface is 2 of 12', () => {
    expect(applicationRows, 'the census records no application-corpus contract').not.toEqual([]);
    // The population is PINNED, so a row cannot silently leave the subject set the way the size rule let it.
    expect(applicationRows, 'the recorded application population changed size; re-read X113 before re-pinning')
      .toHaveLength(12);

    let admittedWrites = 0;
    let admitted = 0;
    let visibility = 0;
    const failed: string[] = [];
    const stateChangers: string[] = [];
    const drift: string[] = [];
    const examined: CensusRow[] = [];
    for (const row of applicationRows) {
      const compiled = compileApplicationRow(row);
      if (compiled.artifact === undefined) {
        failed.push(row.contractName!);
        console.log(`[F3] X73 ${row.corpus}/${row.contractName}: DOES NOT COMPILE in bus mode `
          + `(${compiled.seconds.toFixed(1)}s) - ${compiled.error}`);
        continue;
      }
      examined.push(row);
      const { artifact } = compiled;
      const handlers = artifact.hiddenBatch?.handlers ?? [];
      // `writesState: false` is the compiler's own proof of read-only. Read off the bus-mode artifact's own
      // ABI, which is the artifact whose handlers are being classified; measured to agree with the direct-mode
      // ABI on the subject where both were compiled, and `forceStateful` means the flag is never absent.
      const writes = (name: string): boolean =>
        artifact.abi?.find((entry: any) => entry.name === name)?.writesState !== false;
      const eligibleNames = handlers.filter((handler: any) => handler.eligible)
        .map((handler: any) => handler.name);
      const writingNames = eligibleNames.filter(writes);
      const reasons = [...new Set(handlers.filter((handler: any) => !handler.eligible)
        .map((handler: any) => handler.rejectionReason ?? 'unnamed'))];
      visibility += handlers.filter((handler: any) =>
        handler.rejectionReason === 'initial-v1-route-requires-public-visibility').length;
      admitted += eligibleNames.length;
      admittedWrites += writingNames.length;
      if (writingNames.length > 0) stateChangers.push(row.contractName!);
      // R3-4. THE DRIFT CHECK, ON A POPULATION THAT CAN CONTAIN DRIFT. The only drift report in this file ran
      // inside `measureSubject`, which is reached only by ONE-SLOT candidates, and every application row has a
      // block wider than one slot - so it printed "drifted: 0" truthfully and uselessly. It is folded in here,
      // where twelve real contracts are already being compiled, at no extra compile cost.
      const args = (artifact.constructorInputs ?? []).map((input: any) => placeholder(String(input.type)));
      const provider = new MockNetworkProvider();
      const compiledRedeemBytes = new Contract(artifact, args as never[], { provider }).bytecode.length / 2;
      if (compiledRedeemBytes !== row.redeemBytes) {
        drift.push(`${row.corpus}/${row.contractName} blockSize=${row.blockSize}: census ${row.redeemBytes} B, `
          + `compiled ${compiledRedeemBytes} B (${compiledRedeemBytes - row.redeemBytes! >= 0 ? '+' : ''}`
          + `${compiledRedeemBytes - row.redeemBytes!})`);
      }
      console.log(`[F3] X73 ${row.corpus}/${row.contractName}: admitted ${eligibleNames.length}`
        + ` [${eligibleNames.join(', ')}] | state-changing among them ${writingNames.length}`
        + ` [${writingNames.join(', ')}] | redeem ${compiledRedeemBytes} B`
        + ` | ${compiled.seconds.toFixed(1)}s | refusals ${JSON.stringify(reasons)}`);
    }
    console.log(`[F3] X73 FULL application population: ${applicationRows.length} contracts, `
      + `${examined.length} compiled, ${failed.length} refused by the compiler, ${admitted} admitted handlers, `
      + `${admittedWrites} of them state-changing, ${visibility} visibility refusals`);
    console.log(`[F3] X73 state-changing surface on: ${stateChangers.join(', ') || 'nothing'}`);
    console.log(`[F3] R3-4 census rows whose recorded redeem length has drifted: ${drift.length} `
      + `of ${examined.length} examined`);
    for (const row of drift) console.log(`[F3]   DRIFT ${row}`);

    // THE COMPILE FAILURES ARE PINNED, not skipped. Each is recorded `bus: 'OK'` at census commit `b4d33fc1`,
    // so each is a regression between that commit and this one. A NEW failure and a REPAIRED one both fail
    // this line, which is the point: neither may pass unnoticed.
    expect([...failed].sort(), 'the set of application rows the compiler refuses in bus mode has changed - '
      + 'a new regression or a repair, either way re-measure and re-pin')
      .toEqual([...APPLICATION_COMPILE_FAILURES].sort());
    // X73's own claim, checked at FULL application scale rather than on the cheap half: the gate is gone.
    expect(visibility, 'X73 is recorded as lifting the visibility gate entirely').toBe(0);
    // The population has to be doing work: a run that admitted nothing would satisfy every line below.
    expect(admitted, 'the application population admits no handler at all, so it proves nothing')
      .toBeGreaterThan(0);
    // THE RETIRED HEADLINE, replaced by the figure and the names. This is NOT weakened to a band: it is the
    // exact reading, and both directions fail it.
    expect([...stateChangers].sort(), 'the set of application contracts admitting a state-changing handler has '
      + 'changed; the report headline is a figure, not a zero, and it has to be restated')
      .toEqual([...APPLICATION_STATE_CHANGERS].sort());
    expect(admittedWrites, 'the number of admitted state-changing handlers has changed; restate it')
      .toBe(APPLICATION_STATE_CHANGING_HANDLERS);
    // R3-4's LIVENESS LINE. The drift check must run over a population that can contain drift at all: every
    // row that actually drifted has a block wider than one slot, which is exactly what the old one-slot-only
    // check could not see.
    expect(examined.filter((row) => (row.blockSize ?? 1) > 1),
      'the drift check examined no row with a block wider than one slot, which is the whole population that '
      + 'drifted - it cannot see its subject').not.toEqual([]);
    // AND THE STALENESS IS THE ASSERTION, the same way the frozen F2 basis is. The census is a recording taken
    // at `b4d33fc1`; every application row that compiles has since moved. A ZERO here would mean the census
    // was re-taken at this compiler, in which case this line is what says so and has to be re-read.
    expect(drift, 'no application row disagrees with the recorded census any more - if the census was re-taken '
      + 'at this commit, re-read R3-4 and re-pin; if it was not, the drift check has stopped working')
      .not.toEqual([]);
  }, 900_000);

  /**
   * THE SAME FACT AT FULL RESOLUTION on two contracts everybody recognises, because a histogram of refusal
   * names does not show which FUNCTIONS were turned away. Recompiled here rather than read from the census, so
   * the table is produced by the run that prints it.
   */
  it('MEASURED: per-handler admission on a real ERC-20 and a real constant-product AMM', () => {
    const subjects = [
      `${CORPUS_ROOTS['solidity-by-example']}/app/erc20/MyToken.sol`,
      `${CORPUS_ROOTS['solidity-by-example']}/defi/constant-product-amm/CPAMM.sol`,
    ];
    for (const file of subjects) {
      const artifact = compileFile(file, {
        solidityImportCompat: true,
        ecrecover: 'p2pkh',
        forceStateful: true,
        experimentalHiddenBatch: true,
        experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
        experimentalMessageBusControllerCategory: '22'.repeat(32),
      } as never);
      console.log(`[F3] ${artifact.contractName}: blockSize=${artifact.hiddenBatch!.route.blockLayout!.blockSize}`);
      for (const handler of artifact.hiddenBatch!.handlers) {
        const abi = artifact.abi.find((entry) => entry.name === handler.name);
        console.log(`[F3]   ${handler.name.padEnd(24)} ${handler.eligible ? 'ELIGIBLE' : 'refused '} `
          + `${(handler.rejectionReason ?? '-').padEnd(52)} writesState=${String(abi?.writesState)}`);
      }
      const admitted = artifact.hiddenBatch!.handlers.filter((handler) => handler.eligible);
      expect(admitted.length, `${artifact.contractName} admits nothing at all`).toBeGreaterThan(0);
    }
  }, 300_000);

  /**
   * THE CONTRACTS THE F3 ROW NAMES BY HAND, with their exact rejection.
   *
   * MasterChef, BentoBox and Kashi are named in the task; none of them reaches the bus, and a histogram head
   * is not an answer for a contract someone asked about specifically. KashiPairMediumRiskV1 is not among the
   * sixteen MistSwap bench targets, so it is compiled here and nowhere else.
   */
  it('MEASURED: the exact rejection for MasterChef, BentoBox and Kashi', () => {
    const root = CORPUS_ROOTS.mistswap;
    const named = [
      'MasterChef.sol', 'MasterChefV2.sol', 'bentobox/BentoBoxV1.sol', 'bentobox/KashiPairMediumRiskV1.sol',
    ];
    const direct = { solidityImportCompat: true, ecrecover: 'p2pkh' };
    const bus = {
      ...direct,
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    let reached = 0;
    for (const target of named) {
      for (const [mode, options] of [['direct', direct], ['bus', bus]] as const) {
        let verdict: string;
        try {
          const artifact = compileFile(`${root}/${target}`, options as never);
          verdict = artifact.hiddenBatch ? 'OK, route present' : 'OK, no route';
          if (artifact.hiddenBatch) reached += 1;
        } catch (error) {
          verdict = `${(error as Error).name}: ${(error as Error).message.split('\n')[0].slice(0, 110)}`;
        }
        console.log(`[F3] ${target.padEnd(34)} ${mode.padEnd(7)} ${verdict}`);
      }
    }
    // Recorded as a measurement, not asserted as a permanent property: if one of these later compiles, this
    // line is what has to change, and it should.
    console.log(`[F3] of the four hand-named MistSwap/Kashi targets, ${reached} reach the bus`);
  }, 900_000);

  /**
   * X84. THE CENSUS DISCREPANCY, RECONCILED - AND IT IS NOT THE DEFECT IT WAS REPORTED AS.
   *
   * The report: `F3_CENSUS_BUS_FAILURES` lists no `ParseError` for solidity-by-example, but `MerkleTree.sol`
   * produces one under the census's own bus options; suspected cause, a missing `compileFile` fallback for FAIL
   * rows. Both halves are wrong, and the second is inverted.
   *
   * FIRST, MerkleTree.sol is not a bus failure at all. Measured at `77cd1e8c` under the census's own DIRECT
   * options it already fails, on `Error: Block slot not found: keccakSideCar[0]`, and `probeOne` returns on a
   * direct failure before bus mode is reached. The recorded census puts it in `F3_CENSUS_DIRECT_FAILURES`
   * exactly there. Whoever saw the ParseError compiled with bus options without checking that direct mode
   * fails first, and X71 has since made both modes land on the same error. There is no ParseError to
   * reconcile, and `F3_CENSUS_BUS_FAILURES` is right to list none.
   *
   * SECOND, `tryCompile` HAS a `compileFile` fallback, and the fallback is the actual gap: it is what ERASES
   * the cause. When `compileFileMulti` throws in bus mode and `compileFile` succeeds, every other contract in
   * the file is absent from the one-entry map, and `probeOne` used to stamp all of them
   * `Error: contract absent from the bus-mode artifact map` while discarding the sibling error it was handed -
   * which the DIRECT path keeps as `directSiblingError`. That head accounts for 15 of the recorded census's 96
   * bus-failure rows, and it names no cause for any of them.
   *
   * THIRD, AND THIS IS THE PART THAT MATTERS FOR THE BOARD: it does NOT touch the route-scope figure. The
   * refusal histogram is tallied only over rows with `bus === 'OK'` - routed plus route-ABSENT - so a bus-FAIL
   * row contributes nothing to the refusal total or to the route-scope share of it. Nor does it move a gate
   * count: the fallback exists precisely to widen `busOk`, which is the documented intent. What it corrupts is
   * the ATTRIBUTION in one table, and `layer3-corpus-probe-f3.mjs` now carries the sibling error through so a
   * re-taken census names the cause.
   *
   * X86 TOOK THE RE-TAKE, SO THE THIRD ASSERTION BELOW IS INVERTED. The census at `b4d33fc1` is the first taken
   * with the carry-through, and it has 88 bus-failure rows with ZERO unattributed, against 96 with 15 before.
   * A test that kept asserting "some row names no cause" would be asserting that the repair did not land, so
   * it asserts the closure instead - and the mechanism that made the erasure possible is measured live above,
   * which is what stops the closure being vacuous.
   */
  it('MEASURED: X84 - the bus-mode fallback erased the cause, and MerkleTree is a DIRECT failure', () => {
    const busOptions = {
      solidityImportCompat: true,
      ecrecover: 'p2pkh',
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    };
    const directOptions = { solidityImportCompat: true, ecrecover: 'p2pkh' };
    const headOf = (error: unknown): string =>
      `${(error as Error).name}: ${(error as Error).message.split('\n')[0]}`;
    const attempt = (file: string, options: unknown): string | undefined => {
      try {
        compileFile(file, options as never);
        return undefined;
      } catch (error) {
        return headOf(error);
      }
    };

    // (1) MerkleTree.sol fails in DIRECT mode, so it can never contribute a bus-failure head.
    const merkle = `${CORPUS_ROOTS['solidity-by-example']}/app/merkle-tree/MerkleTree.sol`;
    const merkleDirect = attempt(merkle, directOptions);
    const merkleBus = attempt(merkle, busOptions);
    console.log(`[F3] X84 MerkleTree.sol direct: ${merkleDirect ?? 'OK'}`);
    console.log(`[F3] X84 MerkleTree.sol bus:    ${merkleBus ?? 'OK'}`);
    expect(merkleDirect, 'MerkleTree.sol now compiles directly, so the X84 reconciliation needs re-reading')
      .toBeDefined();
    // ASSERTED ON THE GATE, NOT ON ITS WORDING. X83 renames this refusal - the unnamed `Block slot not found:
    // keccakSideCar[0]` becomes `keccak-loop-and-straight-line-mix-not-enabled` with a real position - and the
    // reconciliation does not depend on which spelling is current: what matters is that MerkleTree.sol is
    // refused in DIRECT mode over the keccak side-car slot, so it can never reach the bus-failure table, and
    // that it is not a ParseError. Both spellings are accepted so this does not go red on that rename.
    const keccakGate = /Block slot not found: keccakSideCar|keccak-loop-and-straight-line-mix-not-enabled/;
    expect(merkleDirect).toMatch(keccakGate);
    expect(merkleBus, 'bus mode no longer stops at the same gate as direct mode').toMatch(keccakGate);
    expect(merkleDirect, 'a ParseError in DIRECT mode would put this row somewhere else entirely')
      .not.toContain('ParseError');
    expect(merkleBus, 'the bus-mode ParseError this row was filed over is back').not.toContain('ParseError');

    // (2) THE MECHANISM IS STILL LIVE AND THE CENSUS NO LONGER ERASES IT, which is the other way round from
    // what this test used to assert. MarketplaceV1.sol's primary contract compiles in BOTH modes, so
    // `compileFileMulti` throwing in bus mode is what takes the fallback and leaves its siblings out of the
    // one-entry map. Measured live rather than read from the census, because the mechanism is the claim.
    const marketplace = `${CORPUS_ROOTS.eacc}/MarketplaceV1.sol`;
    const marketplaceDirect = attempt(marketplace, directOptions);
    const marketplaceBus = attempt(marketplace, busOptions);
    const multiMap = compileFileMulti(marketplace, busOptions as never) as any;
    console.log(`[F3] X84 MarketplaceV1.sol primary direct: ${marketplaceDirect ?? 'OK'}`);
    console.log(`[F3] X84 MarketplaceV1.sol primary bus:    ${marketplaceBus ?? 'OK'}`);
    console.log(`[F3] X84 MarketplaceV1.sol MULTI bus:      ${Object.keys(multiMap).join(', ')}`);
    expect(marketplaceDirect, 'MarketplaceV1 no longer compiles directly').toBeUndefined();
    expect(marketplaceBus, 'MarketplaceV1 no longer compiles in bus mode either').toBeUndefined();
    // The old fallback subject is closed: multi-compile now returns every sibling. Oversized artifacts are
    // represented by structured diagnostics rather than an exception that erases the map, so assert both
    // the retained siblings and the exact diagnostic code instead of treating console output as a failure.
    expect(Object.keys(multiMap)).toEqual(expect.arrayContaining(['MarketplaceV1', 'MarketplaceDataV1']));
    const sizeDiagnostics = Object.values(multiMap).flatMap((artifact: any) => artifact.diagnostics ?? [])
      .filter((diagnostic: any) => diagnostic.code === 'contract-size-limit');
    expect(sizeDiagnostics.length, 'oversized Marketplace siblings carried no structured size diagnostic')
      .toBeGreaterThan(0);
    expect(sizeDiagnostics.every((diagnostic: any) => diagnostic.severity === 'error')).toBe(true);
    expect(sizeDiagnostics.every((diagnostic: any) => /10000-byte input-script limit/.test(diagnostic.message)))
      .toBe(true);

    // AND THE ATTRIBUTION IS NOW COMPLETE, WHICH IS WHY THIS ASSERTION IS INVERTED. X84 measured 15 of the
    // recorded census's 96 bus-failure rows carrying `Error: contract absent from the bus-mode artifact map`,
    // a head that names no cause, and fixed the probe to carry the sibling error through instead. The census
    // re-take at `b4d33fc1` is the first one taken with that fix: 88 bus-failure rows and ZERO of them
    // unattributed, with EA's five nameless rows replaced by seven `InvalidParameterTypeError` heads naming
    // `meceTags`. Asserting "some row still names no cause" would now be asserting that the repair did not
    // land, so what is asserted is the closure - and the mechanism above is what keeps it non-vacuous.
    const absent = 'Error: contract absent from the bus-mode artifact map';
    const total = corpora.reduce((sum, corpus) => sum + ((F3_CENSUS_BUS_FAILURES[corpus] ?? {})[absent] ?? 0), 0);
    const allBusRows = corpora.reduce((sum, corpus) => sum
      + Object.values(F3_CENSUS_BUS_FAILURES[corpus] ?? {}).reduce((a, b) => a + b, 0), 0);
    console.log(`[F3] X84 bus-failure rows whose head names no cause: ${total} of ${allBusRows}`);
    expect(allBusRows, 'the census records no bus-mode failure at all, so attribution proves nothing')
      .toBeGreaterThan(0);
    expect(total, 'a bus-failure row is attributed to the fallback mechanism instead of to a cause').toBe(0);
    // (3) The 80% route-scope figure cannot be affected: it is tallied over bus-OK rows only. Asserted on the
    // census structure rather than on prose - no eligible row is a bus failure.
    expect(F3_CENSUS_ELIGIBLE.filter((row) => row.bus !== 'OK')).toEqual([]);
  }, 900_000);

  it('MEASURED: the compile-failure heads are published, direct mode and bus mode separately', () => {
    for (const corpus of corpora) {
      const direct = Object.entries(F3_CENSUS_DIRECT_FAILURES[corpus] ?? {}).slice(0, 8);
      const bus = Object.entries(F3_CENSUS_BUS_FAILURES[corpus] ?? {}).slice(0, 8);
      console.log(`[F3] ${corpus}: top direct-mode failures`);
      for (const [head, count] of direct) console.log(`[F3]   ${String(count).padStart(6)}  ${head}`);
      console.log(`[F3] ${corpus}: top bus-mode failures (these contracts DO compile directly)`);
      for (const [head, count] of bus) console.log(`[F3]   ${String(count).padStart(6)}  ${head}`);
    }
    expect(corpora.length).toBeGreaterThan(0);
  });
});

describe('F3 estimated landing: the bus-reachable corpus against all four limits', () => {
  /**
   * ESTIMATED, NOT MEASURED. Each row is F2's prediction for a graph of N copies of one real contract, from
   * that contract's own compiled block size and redeem script. A census cannot say which contracts call each
   * other, so the replica is the shape it can describe; a real heterogeneous graph is bracketed by the replicas
   * of its largest and smallest members.
   */
  it('ESTIMATED: every bus-reachable contract, at 1, 2, 4 and 8 participants', () => {
    expect(eligible.length, 'no bus-reachable corpus contract has a measured redeem length').toBeGreaterThan(0);
    console.log(`[F3] ESTIMATED from the F2 calibration at ${F2_BASIS_COMMIT}; census at ${F3_CENSUS_COMMIT}`);
    console.log('[F3] covenant sizes passed through rather than defaulted from the calibration: projection '
      + `${MEASURED_COVENANTS.projectionRedeemBytes} B, controller `
      + `${MEASURED_COVENANTS.controllerRedeemBytes} B (calibration holds `
      + `${calibration.projectionRedeemBytes} / ${calibration.controllerRedeemBytes})`);
    const binding: Record<string, number> = {};
    const verdicts: Record<string, { fits: number; over: number; outOfRange: number }> = {};
    // X85's own control, computed in the same run rather than quoted: the identical table with the covenant
    // sizes DEFAULTED from the calibration, which is what this file produced before the descriptors carried
    // them. Nothing is asserted from it except the direction of the error; it exists so the cost of the stale
    // constant is a figure this run measured.
    const staleVerdicts: Record<string, { fits: number; over: number }> = {};
    let inflated = 0;
    // Printed in full for the application corpora and for the widest and narrowest of each other corpus; the
    // aggregate below is over EVERY row, so nothing is decided by the sample that is printed.
    const detailed = new Set<string>();
    for (const corpus of corpora) {
      const rows = eligible.filter((row) => row.corpus === corpus)
        .sort((left, right) => right.redeemBytes! - left.redeemBytes!);
      const shown = corpus === 'mistswap' || corpus === 'eacc'
        ? rows
        : [...rows.slice(0, 5), ...rows.slice(-5)];
      for (const row of shown) detailed.add(`${row.corpus}/${row.rel}/${row.contractName}`);
    }
    let staleUnderLive = 0;
    let staleOverLive = 0;
    for (const row of eligible) {
      for (const participants of [1, 2, 4, 8]) {
        const fit = fitAt(row, participants, calibration, MEASURED_COVENANTS);
        const key = `${participants}`;
        verdicts[key] ??= { fits: 0, over: 0, outOfRange: 0 };
        if (fit.prediction.verdict === 'FITS') verdicts[key].fits += 1; else verdicts[key].over += 1;
        if (fit.prediction.outOfRange.length > 0) verdicts[key].outOfRange += 1;
        const first = fit.prediction.limits[0];
        binding[`${first.limit} @ N=${participants}`] = (binding[`${first.limit} @ N=${participants}`] ?? 0) + 1;
        if (detailed.has(`${row.corpus}/${row.rel}/${row.contractName}`)) {
          console.log(`[F3] ${formatFitRow(fit)}`);
        }
        // THE DESCRIPTOR REALLY CARRIED THE LIVE COVENANT, asserted on the estimator's own exact term rather
        // than on the argument being passed. `exactBytes` on these two classes IS the redeem script the input
        // pushes, so this goes red the moment a caller drops the overrides again.
        const projection = fit.prediction.classes.find((klass) => klass.klass === 'projection')!;
        const controller = fit.prediction.classes.find((klass) => klass.klass === 'controller')!;
        expect(projection.exactBytes, 'the projection input is priced at a covenant this commit does not build')
          .toBe(MEASURED_COVENANTS.projectionRedeemBytes);
        expect(controller.exactBytes, 'the controller input is priced at a covenant this commit does not build')
          .toBe(MEASURED_COVENANTS.controllerRedeemBytes);
        const stale = fitAt(row, participants, calibration);
        staleVerdicts[key] ??= { fits: 0, over: 0 };
        if (stale.prediction.verdict === 'FITS') staleVerdicts[key].fits += 1; else staleVerdicts[key].over += 1;
        if (stale.prediction.verdict === 'OVER' && fit.prediction.verdict === 'FITS') inflated += 1;
        const delta = stale.prediction.worstRatio - fit.prediction.worstRatio;
        if (delta < -1e-12) staleUnderLive += 1;
        if (delta > 1e-12) staleOverLive += 1;
      }
    }
    console.log('[F3] predicted verdicts over EVERY bus-reachable contract:');
    for (const [participants, tally] of Object.entries(verdicts)) {
      const stale = staleVerdicts[participants];
      console.log(`[F3]   N=${participants}: FITS=${tally.fits} OVER=${tally.over} `
        + `(${tally.outOfRange} outside the calibrated driver range)`
        + ` | with the covenants DEFAULTED: FITS=${stale.fits} OVER=${stale.over}`);
    }
    console.log(`[F3] X85: the stale covenant default answered OVER on ${inflated} of `
      + `${eligible.length * 4} rows that fit, at ${MEASURED_COVENANTS.projectionRedeemBytes} vs `
      + `${calibration.projectionRedeemBytes} B of projection and `
      + `${MEASURED_COVENANTS.controllerRedeemBytes} vs ${calibration.controllerRedeemBytes} B of controller`);
    // Both live covenants are now larger than the calibration (4,773/2,499 vs 4,542/1,514 bytes), and the
    // stale default consequently undercuts the live worst ratio on this corpus. Pin that direction and the
    // absence of the formerly claimed conservative direction: callers must carry the live descriptors.
    expect(staleUnderLive, 'the stale default unexpectedly remained conservative for every row').toBeGreaterThan(0);
    expect(staleOverLive, 'the stale default unexpectedly over-predicted a live row').toBe(0);
    // The control has to be doing something, or the fix is untested: both deployed covenants have moved away
    // from the calibration, so both live descriptors must be supplied explicitly.
    expect(MEASURED_COVENANTS.projectionRedeemBytes).not.toBe(calibration.projectionRedeemBytes);
    expect(MEASURED_COVENANTS.controllerRedeemBytes).not.toBe(calibration.controllerRedeemBytes);
    console.log('[F3] which limit is predicted to bind, counted:');
    for (const [key, count] of Object.entries(binding).sort((left, right) => right[1] - left[1])) {
      console.log(`[F3]   ${String(count).padStart(4)}  ${key}`);
    }
    // F1's central finding restated as a check on the corpus rather than on the fixtures: if one limit bound
    // every real contract at every count, a single-limit model would be adequate and it is not.
    const distinctLimits = new Set(Object.keys(binding).map((key) => key.split(' @ ')[0]));
    console.log(`[F3] distinct binding limits across the corpus: ${[...distinctLimits].join(', ')}`);
    expect(distinctLimits.size).toBeGreaterThan(0);
  });

  /**
   * THE ONE FIGURE A CENSUS CAN GIVE WITHOUT THE ESTIMATOR, and it is worth separating because it needs no
   * calibration at all: a participant's master input carries its compiled redeem script plus an argument blob,
   * so a contract whose redeem script alone is a large fraction of the 10,000-byte limit cannot be a
   * participant however small the graph is.
   */
  it('MEASURED: redeem-script headroom under the 10,000-byte per-input limit, before any argument blob', () => {
    const rows = [...eligible].sort((left, right) => right.redeemBytes! - left.redeemBytes!);
    for (const row of rows) {
      const share = row.redeemBytes! / BCH_2026_CONSENSUS.maximumBytecodeLength;
      console.log(`[F3] ${(row.contractName ?? row.rel).padEnd(28)} redeem=${String(row.redeemBytes).padStart(6)}B `
        + `= ${(share * 100).toFixed(1)}% of the per-input limit, blockSize=${row.blockSize}, `
        + `handlers=${row.eligibleHandlers?.length}`);
    }
    // R3-10 class, found sideways: `every` over an empty census is `true`. The non-emptiness of `eligible` is
    // asserted in a DIFFERENT test, which is not this test's precondition.
    expect(rows, 'the census carries no bus-reachable row, so the headroom table is empty').not.toEqual([]);
    expect(rows.every((row) => row.redeemBytes! > 0)).toBe(true);
    expect(BCH_2026_STANDARD.maximumTransactionSize).toBe(100_000);
  });
});

/* -------------------------------------------------------------------------------------------------------- */
/* The measured control                                                                                       */
/* -------------------------------------------------------------------------------------------------------- */

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

describe('F3 measured: one real corpus contract, built as a participant and run to completion', () => {
  /**
   * EVERY OTHER LANDING FIGURE IN THIS FILE IS AN ESTIMATE. This one is a measurement, and it exists because
   * an estimate over a population the estimator was never calibrated on - real application contracts rather
   * than fixtures - is worth exactly as much as its first check against a built transaction.
   *
   * Rule 1 is honoured by construction: `assessEnvelope` reads every cost RUN TO COMPLETION on a relaxed
   * density ceiling with every other consensus knob real, then re-checks acceptance with NOTHING relaxed at
   * both real profiles. Rule 2 is the knob-liveness control: the same bytes at a budget the input provably
   * cannot meet must be refused, or an accepted reading only means the evaluation never ran.
   *
   * R3-8. BOTH RULES ARE ASSERTED OUTSIDE THE CATCH, and they were not. `measureSubject` used to make all
   * five of those assertions itself, from inside the `try` that turns a contract whose handler cannot execute
   * with placeholder arguments into a legitimate skip. So a rule that stopped biting was indistinguishable
   * from a `require` a placeholder cannot satisfy: it was caught, appended to `failures`, and printed as
   * "candidate skipped". The only gate left was `measured > 0`, which ONE surviving candidate out of eighty-six
   * satisfies. The sibling file had already been repaired this way - `Layer3EstimatorF2.test.ts` calls
   * `assertMeasurementDiscipline` after its catch's `continue` - and this file kept the defect.
   *
   * `measureSubject` therefore asserts nothing about the result and returns it, exactly as F2's
   * `measureCorpusSubject` does. The floor below is on the RATIO of candidates measured, not on zero.
   */
  it('MEASURED: a real corpus participant against every real BCH-2026 limit', async () => {
    const candidates = measuredControlCandidates();
    console.log(`[F3] one-slot bus-reachable candidates, widest redeem first: ${candidates.length}`);
    expect(candidates.length, 'no one-slot bus-reachable corpus contract exists').toBeGreaterThan(0);
    const failures: string[] = [];
    const censusDrift: string[] = [];
    let measured = 0;
    // EVERY one-slot candidate is measured, not just the first that works. There are few of them and the
    // estimator comparison is the point of the exercise, so one data point where two are available would be
    // choosing the weaker evidence.
    for (const subject of candidates) {
      let measurement: CorpusMeasurement;
      try {
        measurement = await measureSubject(subject);
      } catch (error) {
        failures.push(`${subject.corpus}/${subject.contractName}: ${(error as Error).message.split('\n')[0]}`);
        continue;
      }
      // OUTSIDE THE CATCH. A failure here is a failure of the measurement discipline and fails the test; it
      // can no longer be logged as a skipped candidate.
      assertMeasurementDiscipline(measurement);
      if (measurement.drift !== undefined) censusDrift.push(measurement.drift);
      measured += 1;
    }
    for (const failure of failures) console.log(`[F3] candidate skipped - ${failure}`);
    // X86. A CENSUS THAT HAS DRIFTED IS REPORTED, NOT SKIPPED. The recorded redeem length used to be asserted
    // equal to the built participant inside this loop's catch, so three solc-corpus rows whose script the
    // compiler had since changed were being counted with the nineteen contracts whose `require` a placeholder
    // argument cannot satisfy. The descriptor is built from this run's compile, so the row is still measured.
    // R3-4. THIS FIGURE IS ONE-SLOT-ONLY, and saying so where it is printed is the point: `measureSubject` is
    // reached only by candidates whose block is a single slot, and every row measured to have drifted has a
    // wider block. A `0` here says nothing about the census. The population-wide check is in the X73 test.
    console.log(`[F3] ONE-SLOT census rows whose recorded redeem length has drifted: ${censusDrift.length} `
      + '(the wider-block population is checked by the X73 test, not here)');
    for (const drift of censusDrift) console.log(`[F3]   DRIFT ${drift}`);
    console.log(`[F3] measured ${measured} of ${candidates.length} one-slot candidates `
      + `(${(measured * 100 / candidates.length).toFixed(1)}%)`);
    // R3-8. A FLOOR ON THE POPULATION, not on zero. `measured > 0` was satisfiable by one candidate, which is
    // the whole reason a swallowed rule could hide here. The floor is set BELOW the reading this commit takes
    // so ordinary compiler churn in a corpus contract does not fail the row, and far above one: if the skip
    // list ever swallowed most of the population again, this is the line that says so. Measured at `3281ece9`:
    // 50 of 86, 58.1%, so the floor tolerates six further skips before it bites. The RUN prints the reading,
    // above, so a reader compares against a measurement rather than against this comment.
    expect(measured, `no candidate could be built and measured; ${candidates.length} tried`).toBeGreaterThan(0);
    expect(measured / candidates.length,
      `only ${measured} of ${candidates.length} candidates could be measured`).toBeGreaterThan(0.5);
  }, 900_000);

  /**
   * What one measured candidate yields. `measureSubject` builds it and asserts NOTHING about the result; the
   * caller asserts, outside its catch. Same split as F2's `CorpusMeasurement`, and for the same reason.
   */
  interface CorpusMeasurement {
    subject: CensusRow;
    envelope: EnvelopeMeasurement;
    transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>;
    sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>;
    /** Participant inputs plus the projection, controller and fee slots - what `inputCount` must equal. */
    expectedInputCount: number;
    /** A description of any disagreement between the recorded census and this run's compile, or `undefined`. */
    drift: string | undefined;
  }

  /**
   * THE TWO RULES, ASSERTED OUTSIDE THE CALLER'S CATCH.
   *
   * Rule 1: acceptance with nothing relaxed, at both real BCH-2026 profiles. Rule 2: a density knob that
   * refuses these exact bytes at a budget derived from this input's own reading. A throw from either now
   * fails the test instead of being counted as a contract that could not be built.
   */
  function assertMeasurementDiscipline(measurement: CorpusMeasurement): void {
    const { subject, envelope, transaction, sourceOutputs, expectedInputCount } = measurement;
    const name = `${subject.corpus}/${subject.contractName}`;
    // RULE 2. Knob liveness, on the worst-cost input of THIS transaction, at a budget derived from its own
    // reading rather than a fixed fraction that a low-density shape would survive.
    const budget = knobControlBudgetFor(envelope.worstCostInput);
    const control = densityKnobControl(
      transaction as never, sourceOutputs, envelope.worstCostInput.input, budget,
    );
    expect(budget, `${name}: the control budget is not below the ordinary one`)
      .toBeLessThan(BCH_2026_CONSENSUS.operationCostBudgetPerByte);
    expect(control, `${name}: the operation-cost knob does not bite at ${budget}/byte`).toBeDefined();
    expect(String(control)).toMatch(/density|operation cost/i);
    // RULE 1. Nothing relaxed, at both real profiles, and the input set is the one the layout describes.
    expect(envelope.inputCount, `${name}: the built input count is not the layout's`).toBe(expectedInputCount);
    expect(envelope.refusedAtConsensus, `${name} refused at the real consensus profile`).toEqual([]);
    expect(envelope.refusedAtStandard, `${name} refused at the real standard profile`).toEqual([]);
  }

  /**
   * Build one census row into a real 1-participant graph, measure it, and report the estimator against it.
   *
   * IT ASSERTS NOTHING ABOUT THE MEASUREMENT, deliberately - see R3-8 on the test above. The three `expect`s
   * that remain are PRECONDITIONS on whether this harness can build the subject at all (a parameter type it
   * cannot supply, a controller genesis that did not root), which is exactly what the caller's catch is for.
   */
  async function measureSubject(subject: CensusRow): Promise<CorpusMeasurement> {
    console.log(`[F3] measured-control subject: ${subject.corpus}/${subject.contractName} (${subject.rel}), `
      + `blockSize=${subject.blockSize}, census redeem=${subject.redeemBytes}B`);

    const provider = createLayer3SemanticTestProvider();
    const projectionArtifact = compileString(layer3.generateGraphProjectionVerifier());
    const projection = new Contract(projectionArtifact, [], { provider });
    const controller = new Contract(
      compileString(layer3.generateGraphRootController(projection.lockingBytecode)),
      [alicePkh], { provider },
    );
    const genesis = await (provider as any).addTokenUtxosDynamic(() => [{
      address: controller.tokenAddress,
      satoshis: 3000n,
      token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    }]);
    const controllerCategory = genesis.categoryId as string;

    const file = `${CORPUS_ROOTS[subject.corpus]}/${subject.rel}`;
    const artifact = compileFile(file, {
      solidityImportCompat: true,
      ecrecover: 'p2pkh',
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: controller.lockingBytecode,
      experimentalMessageBusControllerCategory: controllerCategory,
    } as never);
    // The one-slot rule is re-checked against the compiler, because a row the census recorded as one-slot can
    // compile to a wider block now and building it without seeding the sidecar UTXOs fails further down with
    // an unrelated message.
    const compiledBlockSize = artifact.hiddenBatch!.route.blockLayout!.blockSize;
    if (compiledBlockSize !== 1) {
      throw new Error(`census recorded a one-slot block; the compiler now emits ${compiledBlockSize}`);
    }
    const args = (artifact.constructorInputs ?? []).map((input) => placeholder(String(input.type)));
    const base = new Contract(artifact, args as never[], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
    const participant = base.withCategory(hexToBin(setup.categoryId));
    // The census records the redeem length under a stand-in controller; a real controller is a p2sh32 locking
    // bytecode of the same length, so the two figures are comparable exactly. Where they differ the RECORD is
    // what is stale - a redeem length is `new Contract(artifact, args).bytecode.length`, which this run has
    // just computed - so the disagreement is returned to the caller and the compile is what the estimator sees.
    const compiledRedeemBytes = participant.bytecode.length / 2;
    const drift = compiledRedeemBytes === subject.redeemBytes ? undefined
      : `${subject.corpus}/${subject.contractName} (${subject.rel}): census ${subject.redeemBytes} B, `
        + `compiled ${compiledRedeemBytes} B (${compiledRedeemBytes - subject.redeemBytes! >= 0 ? '+' : ''}`
        + `${compiledRedeemBytes - subject.redeemBytes!})`;

    const handlerName = subject.eligibleHandlers![0];
    const handler = artifact.hiddenBatch!.handlers.find((entry) => entry.name === handlerName)!;
    const handlerArgs = handler.inputs.map((input) => placeholder(String(input.type)));
    expect(handlerArgs.every((value) => value !== undefined),
      `handler ${handlerName} has a parameter type this harness cannot supply`).toBe(true);

    const plan = layer3.planCompiledGraph(
      [{ artifact, lockingBytecode: participant.lockingBytecode }],
      [{ parent: null, callee: 0, function: handlerName, args: handlerArgs as never[] }],
    );
    const layout = layer3.compiledGraphPhysicalLayout(plan);
    const transcript = layer3.finalizeCompiledGraph(
      plan, {}, layout.participantInputs, layout.returnOutputs,
      plan.participants.map(() => ''), layout.projectionInputs, '',
    );

    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const signature = (): SignatureTemplate => new SignatureTemplate(alicePriv);
    const fixedUtxo = (slot: number, satoshis: bigint): Utxo => randomUtxo({
      satoshis, vout: 0, txid: slot.toString(16).padStart(2, '0').repeat(32),
    });
    const initFee = fixedUtxo(0xe1, 20_000n);
    await provider.addUtxo(p2pkh.address, initFee);
    const initialize = new TransactionBuilder({ provider });
    initialize.addInput(
      genesis.utxos[0], controller.unlock.initialize(hexToBin(transcript.root), alicePub, signature()),
    );
    initialize.addInput(initFee, p2pkh.unlock.spend(alicePub, signature()));
    initialize.addOutput({
      to: controller.tokenAddress,
      amount: genesis.utxos[0].satoshis,
      token: {
        category: controllerCategory, amount: 0n,
        nft: { capability: 'mutable', commitment: transcript.root },
      },
    });
    initialize.addOutput({ to: p2pkh.address, amount: 15_000n });
    await provider.sendRawTransaction(raw(initialize));
    const rootedController = (await provider.getUtxos(controller.tokenAddress))
      .find((utxo: any) => utxo.token?.nft?.commitment === transcript.root);
    expect(rootedController, 'controller initialization did not create the rooted authority').toBeDefined();

    const projectionUtxo = fixedUtxo(0xa0, 1000n);
    await provider.addUtxo(projection.address, projectionUtxo);
    const fee = fixedUtxo(0xe2, 150_000n);
    await provider.addUtxo(p2pkh.address, fee);

    const tx = new TransactionBuilder({ provider, allowImplicitNftBurn: true });
    tx.addInput(setup.masterUtxo, participant.createCompilerRouteUnlocker(
      artifact.hiddenBatch!.route, hexToBin(artifact.hiddenBatch!.selector),
    )(...layer3.compiledGraphRouteArgs(transcript, 0, layout.controllerInput) as never[]));
    tx.addInput(projectionUtxo, projection.unlock.verify(
      transcript.bytes, BigInt(layout.controllerInput), 0n,
    ));
    tx.addInput(rootedController!, controller.unlock.attest(transcript.bytes));
    tx.addInput(fee, p2pkh.unlock.spend(alicePub, signature()));
    // The physical output map every capstone builds: the participants' re-minted masters first, then one
    // ordinary output per proof slot and one for the controller (which is consumed, not re-minted - hence
    // `allowImplicitNftBurn`), then the fee change. One output per input, in input order.
    tx.addOutput({
      to: participant.tokenAddress,
      amount: setup.masterUtxo.satoshis,
      token: {
        category: setup.categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    });
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addOutput({ to: p2pkh.address, amount: 1000n });
    tx.addOutput({ to: p2pkh.address, amount: 100_000n });

    const transaction = tx.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(tx.inputs as never);
    const envelope = assessEnvelope(
      `${subject.contractName} x1`, transaction as never, sourceOutputs,
    );
    console.log(`[F3] MEASURED ${formatEnvelope(envelope)}`);

    // And what the estimator said about this exact shape, before it existed. With the covenant sizes compiled
    // at this commit rather than defaulted from the calibration, so the prediction is not carrying 421 bytes of
    // a projection verifier that the transaction measured beside it does not contain - and with the master
    // redeem length this run compiled rather than the recorded one, for the same reason.
    const prediction = estimate({
      ...replicaSpec(subject, 1, MEASURED_COVENANTS), redeemBytes: [compiledRedeemBytes],
    }, calibration);
    console.log(`[F3] PREDICTED ${formatEstimate(prediction)}`);
    const comparison: [string, number, number][] = [
      ['serialized bytes', prediction.serializedBytes, envelope.serializedBytes],
      ['worst unlocking bytes', prediction.worstUnlockingBytes, envelope.worstUnlockingInput.unlockingBytes],
      ['worst density ratio', prediction.worstDensityRatio, envelope.worstCostInput.standardCostRatio],
      // The fourth limit F1 found binding, reported explicitly rather than left to rank below the others.
      ['worst SigChecks ratio', prediction.worstSigCheckRatio,
        Math.max(...envelope.inputs.map((row) => row.signatureCheckRatio))],
    ];
    for (const [limit, predicted, measured] of comparison) {
      const error = predicted / measured - 1;
      console.log(`[F3] ${limit.padEnd(22)} predicted=${predicted.toFixed(4)} measured=${measured.toFixed(4)} `
        + `error=${error >= 0 ? '+' : ''}${(error * 100).toFixed(1)}% `
        + `${predicted >= measured ? 'CONSERVATIVE' : 'UNDER-PREDICTS'}`);
    }
    console.log(`[F3] measured binding limit: ${envelope.binding[0].limit} `
      + `${envelope.binding[0].ratio.toFixed(4)}x at ${envelope.binding[0].where}`);
    console.log(`[F3] refusedAtConsensus=${envelope.refusedAtConsensus.length} `
      + `refusedAtStandard=${envelope.refusedAtStandard.length}`);
    return {
      subject,
      envelope,
      transaction,
      sourceOutputs,
      expectedInputCount: layout.participantInputs.length + 3,
      drift,
    };
  }
});
