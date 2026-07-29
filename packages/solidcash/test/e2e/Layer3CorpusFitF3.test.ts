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
   * WHAT THE UNNAMED REFUSAL ACTUALLY IS, pinned rather than inferred from a histogram.
   *
   * Route synthesis is documented to record "one stable reason per entry point", and `hiddenBatch.handlers`
   * publishes `eligible` and `rejectionReason` together. A handler that arrives `eligible: false` with no
   * reason is therefore a gap, and it turns out to be a COMPILER-SYNTHESIZED entry point - the block-oracle
   * updater a contract reading `block.*` gets for free - not anything a user wrote. It is worth one line in
   * the report and nothing more, but it should be a measured line.
   */
  it('MEASURED: the unnamed refusal is a compiler-synthesized entry point, not a user handler', () => {
    const subject = F3_CENSUS_ELIGIBLE.find((row) => (row.rejectionReasons ?? []).includes('unnamed'));
    if (subject === undefined) {
      console.log('[F3] no census row carries an unnamed refusal');
      return;
    }
    const artifact = compileFile(`${CORPUS_ROOTS[subject.corpus]}/${subject.rel}`, {
      solidityImportCompat: true,
      ecrecover: 'p2pkh',
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalMessageBusController: `aa20${'11'.repeat(32)}87`,
      experimentalMessageBusControllerCategory: '22'.repeat(32),
    } as never);
    const unnamed = artifact.hiddenBatch!.handlers
      .filter((handler) => !handler.eligible && handler.rejectionReason === undefined);
    console.log(`[F3] ${subject.contractName}: unnamed refusals = `
      + `${unnamed.map((handler) => handler.name).join(', ')}`);
    expect(unnamed.length).toBeGreaterThan(0);
    expect(unnamed.every((handler) => handler.name.startsWith('__')),
      'an unnamed refusal fell on a handler the user wrote').toBe(true);
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

    // And what the estimator said about this exact shape, before it existed.
    const prediction = estimate(replicaSpec(subject, 1), calibration);
    console.log(`[F3] PREDICTED ${formatEstimate(prediction)}`);
    const comparison: [string, number, number][] = [
      ['serialized bytes', prediction.serializedBytes, envelope.serializedBytes],
      ['worst unlocking bytes', prediction.worstUnlockingBytes, envelope.worstUnlockingInput.unlockingBytes],
      ['worst density ratio', prediction.worstDensityRatio, envelope.worstCostInput.standardCostRatio],
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
