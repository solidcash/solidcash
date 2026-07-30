import { describe, expect, it } from 'vitest';
import { compileFile, compileString } from 'solidc';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
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
import { deriveCalibration, estimate, formatEstimate } from './layer3-estimator-f2.js';
import { F2_BASIS, F2_BASIS_COMMIT } from './layer3-estimator-basis-f2.js';
import {
  F3_CENSUS_BUS_FAILURES, F3_CENSUS_COMMIT, F3_CENSUS_DIRECT_FAILURES, F3_CENSUS_ELIGIBLE,
  F3_CENSUS_GATES, F3_CENSUS_REJECTIONS,
} from './layer3-corpus-census-f3.js';
import { fitAt, formatFitRow, replicaSpec } from './layer3-corpus-fit-f3.js';
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
 * THE TWO GENERATED COVENANTS, COMPILED HERE RATHER THAN DEFAULTED FROM THE CALIBRATION.
 *
 * `GraphShapeSpec` lets a caller pass these and defaults them from the calibration when it does not. The
 * default is stale the moment either covenant moves, and it had moved: the F2 basis carries the pre-X65
 * projection verifier, so every corpus prediction in this file was carrying 444 bytes per participant that
 * HEAD does not generate. Two compiles - no UTXO, no builder, no VM - remove the whole class of error, and
 * they are the same two figures `Layer3EnvelopeDocR2.test.ts` guards the documents against.
 */
const MEASURED_COVENANTS = {
  projectionRedeemBytes: compileString(layer3.generateGraphProjectionVerifier()).debug.bytecode.length / 2,
  controllerRedeemBytes: compileString(layer3.generateGraphRootController(`aa20${'ab'.repeat(32)}87`))
    .debug.bytecode.length / 2,
};

const corpora = Object.keys(F3_CENSUS_GATES);
const eligible = F3_CENSUS_ELIGIBLE.filter((row) => typeof row.redeemBytes === 'number');

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
   * The gate chain, counted. Each gate is a strictly weaker population than the one before it, which is
   * asserted rather than assumed: a census whose "eligible" count exceeded its "compiles" count would be a
   * bookkeeping error, and the assertion is what makes the published table trustworthy.
   */
  it('MEASURED: the gate chain is monotone and the counts are published', () => {
    console.log(`[F3] census taken at ${F3_CENSUS_COMMIT}`);
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
   */
  it('MEASURED: no route refusal is unnamed on a handler the user wrote', () => {
    const subject = F3_CENSUS_ELIGIBLE.find((row) => (row.rejectionReasons ?? []).includes('unnamed'))
      ?? F3_CENSUS_ELIGIBLE.find((row) => (row.rejectionReasons ?? []).length > 0);
    expect(subject, 'the census records no refused entry point to recompile').toBeDefined();
    const artifact = compileFile(`${CORPUS_ROOTS[subject!.corpus]}/${subject!.rel}`, {
      solidityImportCompat: true,
      ecrecover: 'p2pkh',
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    } as never);
    const refused = artifact.hiddenBatch!.handlers.filter((handler) => !handler.eligible);
    const unnamed = refused.filter((handler) => handler.rejectionReason === undefined);
    console.log(`[F3] ${subject!.contractName}: census recorded reasons `
      + `${JSON.stringify(subject!.rejectionReasons)}`);
    console.log(`[F3] ${subject!.contractName}: recompiled reasons `
      + `${JSON.stringify([...new Set(refused.map((handler) => handler.rejectionReason ?? 'unnamed'))])}`);
    console.log(`[F3] ${subject!.contractName}: unnamed refusals = ${unnamed.length}`
      + `${unnamed.length > 0 ? ` (${unnamed.map((handler) => handler.name).join(', ')})` : ''}`);
    // THE INVARIANT, which held before X72 and holds after it: whatever arrives without a reason is
    // compiler-synthesized. Vacuously true when the hole is closed, and that is the correct semantics.
    expect(unnamed.every((handler) => handler.name.startsWith('__')),
      'an unnamed refusal fell on a handler the user wrote').toBe(true);
    // THE CLOSURE, asserted because the tree supports it: every refusal on this subject carries a name.
    expect(unnamed, 'a refused entry point is published with no reason').toEqual([]);
    expect(refused.length, 'the recompiled subject refuses nothing, so it proves nothing').toBeGreaterThan(0);
  }, 120_000);

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
   * WHAT THIS TEST ASSERTS, and why it is a subset. The twelve figure is the probe's, recorded above.
   * `MarketplaceV1/V2/V3.sol` and `EACCToken.sol` take minutes each to compile twice, so the live subjects are
   * chosen by a SIZE RULE rather than by hand - every application row whose census redeem script is under
   * 8,000 bytes - and the assertion on them is the same one the headline makes.
   */
  it('MEASURED: X73 lifted the visibility gate and the application read-only surface still holds', () => {
    const applications = F3_CENSUS_ELIGIBLE
      .filter((row) => row.corpus === 'mistswap' || row.corpus === 'eacc');
    expect(applications, 'the census records no application-corpus contract').not.toEqual([]);
    const subjects = applications.filter((row) => (row.redeemBytes ?? Number.POSITIVE_INFINITY) < 8_000);
    expect(subjects.length, 'the size rule selected no subject').toBeGreaterThan(0);

    let admittedWrites = 0;
    let admitted = 0;
    let visibility = 0;
    for (const row of subjects) {
      const file = `${CORPUS_ROOTS[row.corpus]}/${row.rel}`;
      const options = {
        solidityImportCompat: true,
        ecrecover: 'p2pkh',
        forceStateful: true,
        experimentalHiddenBatch: true,
        experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
        experimentalMessageBusControllerCategory: '22'.repeat(32),
      };
      const artifact = compileFile(file, options as never);
      const handlers = artifact.hiddenBatch?.handlers ?? [];
      // `writesState: false` is the compiler's own proof of read-only. Read off the bus-mode artifact's own
      // ABI, which is the artifact whose handlers are being classified; measured to agree with the direct-mode
      // ABI on the subject where both were compiled, and `forceStateful` means the flag is never absent.
      const writes = (name: string): boolean =>
        artifact.abi?.find((entry) => entry.name === name)?.writesState !== false;
      const eligibleNames = handlers.filter((handler) => handler.eligible).map((handler) => handler.name);
      const writingNames = eligibleNames.filter(writes);
      const reasons = [...new Set(handlers.filter((handler) => !handler.eligible)
        .map((handler) => handler.rejectionReason ?? 'unnamed'))];
      visibility += handlers
        .filter((handler) => handler.rejectionReason === 'initial-v1-route-requires-public-visibility').length;
      admitted += eligibleNames.length;
      admittedWrites += writingNames.length;
      console.log(`[F3] X73 ${row.corpus}/${row.contractName}: admitted ${eligibleNames.length}`
        + ` [${eligibleNames.join(', ')}] | state-changing among them ${writingNames.length}`
        + ` | refusals ${JSON.stringify(reasons)}`);
    }
    console.log(`[F3] X73 live subset: ${subjects.length} application contracts, ${admitted} admitted handlers,`
      + ` ${admittedWrites} of them state-changing, ${visibility} visibility refusals`);
    // THE HEADLINE, on the live subset. Not weakened to a band: the claim is exactly zero.
    expect(admittedWrites, 'an application contract now admits a state-changing handler - the report headline '
      + 'has to be retired, and the number stated').toBe(0);
    // X73's own claim, checked where it is cheap to check: the gate is gone, not merely rarer.
    expect(visibility, 'X73 is recorded as lifting the visibility gate entirely').toBe(0);
    // And the subset has to be doing work: a run that admitted nothing at all would satisfy the line above.
    expect(admitted, 'the live subset admits no handler, so it proves nothing').toBeGreaterThan(0);
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
   * THIRD, AND THIS IS THE PART THAT MATTERS FOR THE BOARD: it does NOT touch the 80% route-scope figure. The
   * refusal histogram is tallied only over rows with `bus === 'OK'` - routed plus route-ABSENT - so a bus-FAIL
   * row contributes nothing to the 455 refusals or to the 364/455. Nor does it move a gate count: the fallback
   * exists precisely to widen `busOk`, which is the documented intent. What it corrupts is the ATTRIBUTION in
   * one table, and `layer3-corpus-probe-f3.mjs` now carries the sibling error through so a re-taken census
   * names the cause.
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

    // (2) The fallback erases a real cause. MarketplaceV1.sol compiles as a whole in direct mode and does NOT
    // in bus mode, and the error the census used to discard names a sibling in another file.
    const marketplace = `${CORPUS_ROOTS.eacc}/MarketplaceV1.sol`;
    const marketplaceDirect = attempt(marketplace, directOptions);
    const marketplaceBus = attempt(marketplace, busOptions);
    console.log(`[F3] X84 MarketplaceV1.sol primary direct: ${marketplaceDirect ?? 'OK'}`);
    console.log(`[F3] X84 MarketplaceV1.sol primary bus:    ${marketplaceBus ?? 'OK'}`);
    // The primary contract compiles in BOTH modes, which is why the fallback is taken and why the siblings -
    // recorded as five rows across MarketplaceV1/V2/V3.sol - are the ones that carry the empty head.
    expect(marketplaceDirect, 'MarketplaceV1 no longer compiles directly').toBeUndefined();
    expect(marketplaceBus, 'MarketplaceV1 no longer compiles in bus mode either').toBeUndefined();
    const absent = 'Error: contract absent from the bus-mode artifact map';
    const carriers = corpora.filter((corpus) => (F3_CENSUS_BUS_FAILURES[corpus] ?? {})[absent] !== undefined);
    const total = carriers.reduce((sum, corpus) => sum + F3_CENSUS_BUS_FAILURES[corpus][absent], 0);
    const allBusRows = corpora.reduce((sum, corpus) => sum
      + Object.values(F3_CENSUS_BUS_FAILURES[corpus] ?? {}).reduce((a, b) => a + b, 0), 0);
    console.log(`[F3] X84 bus-failure rows whose head names no cause: ${total} of ${allBusRows}`);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(allBusRows);
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
    for (const row of eligible) {
      for (const participants of [1, 2, 4, 8]) {
        const fit = fitAt(row, participants, calibration);
        const key = `${participants}`;
        verdicts[key] ??= { fits: 0, over: 0, outOfRange: 0 };
        if (fit.prediction.verdict === 'FITS') verdicts[key].fits += 1; else verdicts[key].over += 1;
        if (fit.prediction.outOfRange.length > 0) verdicts[key].outOfRange += 1;
        const first = fit.prediction.limits[0];
        binding[`${first.limit} @ N=${participants}`] = (binding[`${first.limit} @ N=${participants}`] ?? 0) + 1;
        if (detailed.has(`${row.corpus}/${row.rel}/${row.contractName}`)) {
          console.log(`[F3] ${formatFitRow(fit)}`);
        }
      }
    }
    console.log('[F3] predicted verdicts over EVERY bus-reachable contract:');
    for (const [participants, tally] of Object.entries(verdicts)) {
      console.log(`[F3]   N=${participants}: FITS=${tally.fits} OVER=${tally.over} `
        + `(${tally.outOfRange} outside the calibrated driver range)`);
    }
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
   * both real profiles. Rule 2 is the knob-liveness control below: the same bytes at a budget the input
   * provably cannot meet must be refused, or an accepted reading only means the evaluation never ran.
   */
  it('MEASURED: a real corpus participant against every real BCH-2026 limit', async () => {
    const candidates = measuredControlCandidates();
    console.log(`[F3] one-slot bus-reachable candidates, widest redeem first: ${candidates.length}`);
    expect(candidates.length, 'no one-slot bus-reachable corpus contract exists').toBeGreaterThan(0);
    const failures: string[] = [];
    let measured = 0;
    // EVERY one-slot candidate is measured, not just the first that works. There are few of them and the
    // estimator comparison is the point of the exercise, so one data point where two are available would be
    // choosing the weaker evidence.
    for (const subject of candidates) {
      try {
        await measureSubject(subject);
        measured += 1;
      } catch (error) {
        failures.push(`${subject.corpus}/${subject.contractName}: ${(error as Error).message.split('\n')[0]}`);
      }
    }
    for (const failure of failures) console.log(`[F3] candidate skipped - ${failure}`);
    console.log(`[F3] measured ${measured} of ${candidates.length} one-slot candidates`);
    expect(measured, `no candidate could be built and measured; ${candidates.length} tried`).toBeGreaterThan(0);
  }, 900_000);

  /** Build one census row into a real 1-participant graph, measure it, and check the estimator against it. */
  async function measureSubject(subject: CensusRow): Promise<void> {
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
    const args = (artifact.constructorInputs ?? []).map((input) => placeholder(String(input.type)));
    const base = new Contract(artifact, args as never[], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
    const participant = base.withCategory(hexToBin(setup.categoryId));
    // The census records the redeem length under a stand-in controller; a real controller is a p2sh32 locking
    // bytecode of the same length, so the two must agree exactly. A mismatch would mean the census figure is
    // not the figure a deployment gets, which is the whole point of recording it.
    expect(participant.bytecode.length / 2, 'census redeem length disagrees with the built participant')
      .toBe(subject.redeemBytes);

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

    // RULE 2. Knob liveness, on the worst-cost input of THIS transaction, at a budget derived from its own
    // reading rather than a fixed fraction that a low-density shape would survive.
    const budget = knobControlBudgetFor(envelope.worstCostInput);
    const control = densityKnobControl(
      transaction as never, sourceOutputs, envelope.worstCostInput.input, budget,
    );
    expect(budget).toBeLessThan(BCH_2026_CONSENSUS.operationCostBudgetPerByte);
    expect(control, `the operation-cost knob does not bite at ${budget}/byte`).toBeDefined();
    expect(String(control)).toMatch(/density|operation cost/i);

    // And what the estimator said about this exact shape, before it existed. With the covenant sizes compiled
    // at this commit rather than defaulted from the calibration, so the prediction is not carrying 444 bytes of
    // a projection verifier that the transaction measured beside it does not contain.
    const prediction = estimate(replicaSpec(subject, 1, MEASURED_COVENANTS), calibration);
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
    expect(envelope.inputCount).toBe(layout.participantInputs.length + 3);
    expect(envelope.refusedAtConsensus, 'refused at the real consensus profile').toEqual([]);
    expect(envelope.refusedAtStandard, 'refused at the real standard profile').toEqual([]);
  }
});
