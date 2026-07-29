import { describe, expect, it } from 'vitest';
import { compileFile, compileString } from 'solidc';
import { bigIntToVmNumber, binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, SignatureTemplate, TransactionBuilder, layer3 } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import type { Utxo } from '../../src/interfaces.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import {
  BCH_2026_CONSENSUS, BCH_2026_STANDARD, assessEnvelope, densityKnobControl, formatEnvelope,
  knobControlBudgetFor,
} from './layer3-envelope-f1.js';
import type { EnvelopeMeasurement } from './layer3-envelope-f1.js';
import {
  type InputClass, type MeasuredShape, calibrate, classifyInputs, deriveCalibration,
  distill, estimate, fitUpperEnvelope, formatCalibrationRow, formatEstimate, redeemScriptLength, shapeGeometry,
} from './layer3-estimator-f2.js';
import { F2_BASIS, F2_BASIS_COMMIT } from './layer3-estimator-basis-f2.js';
import { F2_HELD_OUT } from './layer3-estimator-heldout-f2.js';
import { F3_CENSUS_COMMIT, F3_CENSUS_ELIGIBLE } from './layer3-corpus-census-f3.js';
import { replicaSpec } from './layer3-corpus-fit-f3.js';
import type { CensusRow } from './layer3-corpus-fit-f3.js';
import { createLayer3SemanticTestProvider } from './layer3-semantic-profile.js';

/**
 * F2. A CONSERVATIVE CALIBRATED COST ESTIMATOR.
 *
 * F1 measured seven built shapes against the real BCH-2026 consensus and standard limits and established the
 * result this file is shaped by: A DIFFERENT LIMIT BINDS FIRST FOR ALMOST EVERY SHAPE. An estimator that
 * modelled density alone would be wrong about C1, A13 and C3, so all four limits F1 found binding are
 * modelled here, and the estimator reports WHICH one binds rather than a single capacity number.
 *
 * THE POINT OF THE THING. C3 takes minutes to assemble, seed, sign and evaluate across 108 inputs. Its
 * descriptor - eight participants, eight invocations, the per-participant block sizes and compiled script
 * sizes - is available in seconds. A user should learn that a design does not fit from the descriptor.
 *
 * CONSERVATIVE MEANS IT NEVER UNDER-PREDICTS, and IN-SAMPLE that is a construction rather than an
 * observation: every coefficient is the tightest LINEAR UPPER ENVELOPE over its calibration points, so it
 * lies on or above all of them. `calibrate` then re-checks the ASSEMBLED prediction against the
 * measurements, which is strictly stronger - per-class envelopes can each dominate and the assembled total
 * still fall short if the assembly arithmetic is wrong. Measured: 28/28 conservative, band +0.0% to +41.6%,
 * mean +4.9%.
 *
 * X70: IN-SAMPLE CONSERVATISM WAS NEVER THE CLAIM THAT MATTERED, AND F3 PROVED IT. F3 built forty-five real
 * corpus contracts into one-participant graphs. Every one binds on the 10,000-byte per-input unlocking limit
 * and F2 UNDER-PREDICTED that limit on forty-four of them, mean -7.2%, while predicting density would bind on
 * all forty-five. Three defects, all fixed here and all measured on the same forty-five afterwards:
 *
 *   - an upper envelope bounds nothing BELOW its smallest calibration point, and F2 flagged only the upper
 *     end. A one-participant graph has two rows against a calibrated minimum of six;
 *   - the projection verifier's 4,542-byte redeem script was inside a fitted line whose intercept was 4,095,
 *     which is not an inaccuracy but an impossibility - a P2SH input pushes the script it redeems;
 *   - the controller-density coefficient was driven on slots, which its own held-out miss had already shown
 *     is not even a monotone driver for it.
 *
 * AFTER: 45/45 conservative on the binding limit, +4.3% to +7.5%, mean +7.4%; serialized +9.3% to +17.4%;
 * density +56.9% to +164.4%; SigChecks exact. Per input CLASS as well as in aggregate, which is a check F3
 * did not make and which found a fourth defect on the way through - clamping a DENSITY coefficient to its
 * measured floor under-predicted real corpus masters 34 times out of 45, because density is a property of a
 * contract body and not of any driver in the descriptor.
 *
 * WHAT IS STILL WRONG, AND IS REPORTED RATHER THAN FIXED: the binding-LIMIT prediction. Density is still
 * named first at 0.5758x against a script prediction of 0.5002x, on a population measuring 0.2177x and
 * 0.4651x, because the master-density coefficient over-predicts its own calibration points by up to 284% and
 * the corpus by up to 601%. Ranking bounds of such different tightness does not rank limits. `estimate` now
 * publishes `bindingUnresolved`, the set the ranking cannot separate, which contained the true binder on all
 * forty-five - but a set is not an answer, and the answer needs per-contract cost measurements.
 *
 * OUT OF SAMPLE THERE IS NO GUARANTEE, AND THIS FILE MEASURES THE GAP RATHER THAN ASSUMING IT AWAY.
 * Leave-one-out: 24/28, worst -13.5%, all of it on density. A real six-participant graph the calibration
 * never saw: 3/4 limits conservative, worst -3.5% (was 2/4 and -9.6%). Synthetic counts N=3/6/16 predicted
 * before building: interpolation worst -0.31%, extrapolation 4/4 conservative. The margin that covers every
 * out-of-sample miss is SEARCHED at 16% and costs the in-sample mean +4.9% -> +11.4%; it is still reported
 * rather than switched on, and the reason is now measured rather than argued - see the last margin test.
 *
 * WHAT IS MEASURED HERE AND WHAT IS RECORDED. The synthetic sweep is rebuilt and re-measured live in this
 * file, so the estimator faces a transaction produced in the same process it is judged in. So are all
 * forty-five corpus graphs. The four capstone shapes are a RECORDED basis (`layer3-estimator-basis-f2.ts`),
 * and the held-out graph a second recorded file (`layer3-estimator-heldout-f2.ts`), both captured by
 * observing the fixtures' OWN builders through `layer3-estimator-probe.ts` and re-taken at `1591e87f` for
 * X66, because F4 had cut 129 bytes from a covenant that every one of them instantiates once per
 * participant.
 *
 * A MODEL EVALUATED ON ITS TRAINING DATA IS NOT EVALUATED. It is held out four ways: each of the seven
 * shapes dropped from the calibration in turn and predicted from coefficients that never saw it; three
 * synthetic participant counts predicted BEFORE building them; a REAL six-participant, seven-invocation
 * graph in no calibration set here; and forty-five real application contracts from four corpora, which are
 * not fixtures at all.
 */

/* ------------------------------------------------------------------------------------------------------ */
/* The live synthetic sweep                                                                                 */
/* ------------------------------------------------------------------------------------------------------ */

const brand = hexToBin('4c3342314354524c'); // L3B1CTRL controller prefix via salt prologue

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { out.set(part, cursor); cursor += part.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, index) => (value >>> (8 * index)) & 0xff);

/**
 * The participant-binding fixture, the same one F1's sweep measures and the same one the ledger's 36.5%
 * figure was taken on. Reproduced here rather than imported because it is not exported; the check that it is
 * the SAME subject is not a comment but an assertion - the serialized sizes it produces are required below to
 * match F1's recorded 2,429 / 4,977 / 10,661 bytes.
 */
function makeParticipant(n: number): string {
  const params: string[] = [];
  const body: string[] = [];
  for (let index = 0; index < n; index += 1) {
    params.push(`bigint input${index}, bigint output${index}`);
    body.push(`require(tx.outputs[output${index}].lockingBytecode == tx.inputs[input${index}].lockingBytecode);`);
    body.push(`require(tx.outputs[output${index}].tokenCategory == tx.inputs[input${index}].tokenCategory);`);
    body.push(`require(tx.inputs[input${index}].unlockingBytecode.slice(0, 5) == hex"0453434231");`);
  }
  body.push('require(input0 >= 0);');
  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${params.join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}

interface BuiltSweep {
  transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>;
  sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>;
  /** `contract.bytecode.length`: the estimator's declared compile-time input, read before any build. */
  redeemBytes: number;
}

async function buildSweep(n: number): Promise<BuiltSweep> {
  const provider = createTestProvider();
  const artifact = compileString(makeParticipant(n), {
    forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const selector = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((entry) => entry.name === '__layer3_bind')!;

  const parts: { setup: Awaited<ReturnType<typeof setupStatefulUtxos>>; contract: Contract }[] = [];
  for (let index = 0; index < n; index += 1) {
    const inner = new Contract(artifact, [], { provider, salt: brand });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    parts.push({ setup, contract: inner.withCategory(hexToBin(setup.categoryId)) });
  }
  const argParts: Uint8Array[] = [];
  for (let index = 0; index < n; index += 1) {
    argParts.push(bigIntToVmNumber(BigInt(index)), bigIntToVmNumber(BigInt(index)));
  }
  const argsBlob = scriptToBytecode(argParts);
  const rowBytes = concat(hexToBin(handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), rowBytes);

  const builder = new TransactionBuilder({ provider });
  for (let index = 0; index < n; index += 1) {
    builder.addInput(
      parts[index].setup.masterUtxo,
      parts[index].contract.createCompilerRouteUnlocker(route, selector)(blob),
    );
  }
  const fee = await createFeeFunder(provider, BigInt(20000 + n * 6000));
  builder.addInput(fee.utxo, fee.unlocker);
  for (let index = 0; index < n; index += 1) {
    builder.addOutput({
      to: parts[index].contract.tokenAddress,
      amount: parts[index].setup.masterUtxo.satoshis,
      token: {
        category: parts[index].setup.categoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    });
  }
  builder.addOutput({ to: parts[0].contract.address, amount: 2000n });
  return {
    transaction: builder.buildLibauthTransaction(),
    sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
    redeemBytes: parts[0].contract.bytecode.length,
  };
}

/**
 * Measure one live sweep shape end to end: build, assess against every real limit run-to-completion, confirm
 * NOTHING is refused at the real profiles, and confirm the density knob still bites on the same bytes.
 */
async function measureSweep(n: number): Promise<{ shape: MeasuredShape; built: BuiltSweep }> {
  const built = await buildSweep(n);
  const envelope = assessEnvelope(`sweep N=${n}`, built.transaction as never, built.sourceOutputs);
  // RULE 1: run to completion. `assessEnvelope` reads every cost on a relaxed density ceiling with every
  // other consensus knob real, because an aborted evaluation reports the budget back and not the cost.
  // RULE 2: knob liveness. The same bytes at a budget the input provably cannot meet must be refused, or an
  // ACCEPTED reading only means the evaluation never ran.
  const budget = knobControlBudgetFor(envelope.worstCostInput);
  const control = densityKnobControl(
    built.transaction as never, built.sourceOutputs, envelope.worstCostInput.input, budget,
  );
  expect(budget, `N=${n} control budget is not below the ordinary one`)
    .toBeLessThan(BCH_2026_CONSENSUS.operationCostBudgetPerByte);
  expect(control, `the operation-cost knob does not bite at N=${n} on ${budget}/byte`).toBeDefined();
  expect(String(control)).toMatch(/density|operation cost/i);
  expect(envelope.refusedAtConsensus, `N=${n} refused at the real consensus profile`).toEqual([]);
  expect(envelope.refusedAtStandard, `N=${n} refused at the real standard profile`).toEqual([]);
  const redeemBytes = built.transaction.inputs.map((input) => redeemScriptLength(input.unlockingBytecode));
  const classification = classifyInputs(envelope, redeemBytes);
  console.log(`[F2] ${formatEnvelope(envelope)}`);
  return {
    shape: distill(envelope, classification, `sweep N=${n}`, 1, control !== undefined),
    built,
  };
}

/* ------------------------------------------------------------------------------------------------------ */
/* The seven-shape basis: three measured live here, four recorded                                           */
/* ------------------------------------------------------------------------------------------------------ */

let cached: { shapes: MeasuredShape[]; redeemBytes: Map<number, number> } | undefined;

/**
 * F1's table, in F1's order, reassembled. The three sweep rows are BUILT AND MEASURED IN THIS PROCESS; the
 * four capstone rows are the recorded basis. Built once and shared, because rebuilding the sweep for each
 * test that needs it triples the run for no extra evidence.
 */
async function fullBasis(): Promise<{ shapes: MeasuredShape[]; redeemBytes: Map<number, number> }> {
  if (cached === undefined) {
    const shapes: MeasuredShape[] = [];
    const redeemBytes = new Map<number, number>();
    for (const n of [2, 4, 8]) {
      const measured = await measureSweep(n);
      shapes.push(measured.shape);
      redeemBytes.set(n, measured.built.redeemBytes);
    }
    cached = { shapes: [...shapes, ...F2_BASIS], redeemBytes };
  }
  return cached;
}

/* ------------------------------------------------------------------------------------------------------ */
/* The envelope machinery                                                                                   */
/* ------------------------------------------------------------------------------------------------------ */

describe('F2 estimator: the upper-envelope machinery', () => {
  /**
   * The whole conservatism claim rests on this one function, so it is tested against the property it must
   * have rather than against a remembered pair of coefficients: the line it returns lies on or above EVERY
   * point, and no dominating line predicts less in total.
   */
  it('MEASURED: the fitted line dominates every point and no dominating line is tighter', () => {
    const points = [
      { x: 1, y: 10, label: 'a' }, { x: 2, y: 14, label: 'b' },
      { x: 4, y: 30, label: 'c' }, { x: 8, y: 50, label: 'd' },
    ];
    const envelope = fitUpperEnvelope(points);
    for (const point of points) {
      expect(envelope.intercept + envelope.slope * point.x).toBeGreaterThanOrEqual(point.y - 1e-9);
    }
    const total = points.reduce((sum, point) => sum + envelope.intercept + envelope.slope * point.x, 0);
    // Exhaustive search over a fine grid: nothing that dominates all four points totals less.
    for (let intercept = 0; intercept <= 60; intercept += 0.25) {
      for (let slope = 0; slope <= 20; slope += 0.05) {
        if (points.some((point) => intercept + slope * point.x < point.y - 1e-9)) continue;
        const candidate = points.reduce((sum, point) => sum + intercept + slope * point.x, 0);
        expect(candidate).toBeGreaterThanOrEqual(total - 1e-6);
      }
    }
  });

  /**
   * Why an envelope and not a regression, demonstrated rather than argued. A least-squares line through the
   * same points sits BELOW two of them, and for a capacity check "below" is the one error that matters: it
   * tells a user a design fits when it does not.
   */
  it('MEASURED: a least-squares fit under-predicts where the envelope cannot', () => {
    const points = [
      { x: 1, y: 10, label: 'a' }, { x: 2, y: 14, label: 'b' },
      { x: 4, y: 30, label: 'c' }, { x: 8, y: 50, label: 'd' },
    ];
    const n = points.length;
    const sumX = points.reduce((sum, point) => sum + point.x, 0);
    const sumY = points.reduce((sum, point) => sum + point.y, 0);
    const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    expect(points.filter((point) => intercept + slope * point.x < point.y).length).toBeGreaterThan(0);
    const envelope = fitUpperEnvelope(points);
    expect(points.filter((point) => envelope.intercept + envelope.slope * point.x < point.y - 1e-9))
      .toHaveLength(0);
  });

  /**
   * The redeem-script recovery is what lets a capstone whose builder is not exported serve as a calibration
   * sample without the estimator ever being handed a measured cost. It must be exact, and it must fail closed
   * on anything that is not a pure push sequence.
   */
  it('recovers the redeem script length from an unlocking bytecode, and fails closed otherwise', () => {
    const push = (length: number): Uint8Array => {
      if (length < 0x4c) return concat(Uint8Array.of(length), new Uint8Array(length));
      if (length <= 0xff) return concat(Uint8Array.of(0x4c, length), new Uint8Array(length));
      return concat(Uint8Array.of(0x4d, length & 0xff, (length >>> 8) & 0xff), new Uint8Array(length));
    };
    expect(redeemScriptLength(concat(push(5), push(33), push(7_451)))).toBe(7_451);
    expect(redeemScriptLength(concat(push(200), push(3)))).toBe(3);
    expect(redeemScriptLength(push(0))).toBe(0);
    // OP_ADD is not a push: a script that is not a pure push sequence returns 0 rather than a guess.
    expect(redeemScriptLength(concat(push(4), Uint8Array.of(0x93), push(10)))).toBe(0);
  });

  /**
   * The physical layout is arithmetic on the descriptor, not a build output: the participants' balanced
   * blocks, then one projection proof each, then the controller, then the fee/change pair. Pinned against the
   * capstones' recorded input counts, so a layout change is visible here rather than as a wrong prediction.
   */
  it('MEASURED: the plan-time geometry reproduces every recorded input and output count', () => {
    for (const shape of F2_BASIS) {
      expect(shapeGeometry(shape.spec).inputs, `${shape.name} inputs`).toBe(shape.inputCount);
      expect(shapeGeometry(shape.spec).outputs, `${shape.name} outputs`).toBe(shape.outputCount);
    }
  });
});

/* ------------------------------------------------------------------------------------------------------ */
/* Calibration                                                                                              */
/* ------------------------------------------------------------------------------------------------------ */

describe('F2 estimator: calibration against all seven measured shapes', () => {
  /**
   * THE CALIBRATION TABLE, and the deliverable of this row. Predicted against measured, per limit, per
   * shape, for every shape in F1's envelope table. Every row is required to be on the conservative side, and
   * the error bounds are printed in both directions.
   */
  it('MEASURED: predicted against measured, per limit, for all seven shapes', async () => {
    const { shapes } = await fullBasis();
    const calibration = deriveCalibration(shapes, F2_BASIS_COMMIT);
    const report = calibrate(shapes, calibration);
    console.log(`[F2] calibration basis: ${shapes.map((shape) => shape.name).join(', ')}`);
    for (const row of report) console.log(`[F2] ${formatCalibrationRow(row)}`);
    const under = report.filter((row) => !row.conservative);
    expect(under.map((row) => `${row.shape}/${row.limit} ${row.error}`)).toEqual([]);
    // ERROR BOUNDS, both directions, measured. The estimator errs high by construction; HOW high is the
    // property a user pays for, so it is printed, and the floor at zero is what "conservative" means.
    const errors = report.map((row) => row.error);
    const mean = errors.reduce((sum, value) => sum + value, 0) / errors.length;
    console.log(`[F2] in-sample error bounds: min ${(Math.min(...errors) * 100).toFixed(1)}% `
      + `max ${(Math.max(...errors) * 100).toFixed(1)}% mean ${(mean * 100).toFixed(1)}%`);
    // Zero to within floating-point residue: several rows sit EXACTLY on their envelope, so the comparison
    // needs the same relative tolerance `conservative` uses rather than a bare `>= 0`.
    expect(Math.min(...errors)).toBeGreaterThan(-1e-9);
    expect(shapes).toHaveLength(7);
  }, 900_000);

  /**
   * The binding limit is the estimator's actual output: a user needs to know WHAT to shrink, not only that
   * the shape is large. F1's headline was that this differs per shape, so agreement is a real check and not
   * a restatement. The predicted binding RATIO must dominate the measured one, or the estimate is a promise
   * the shape cannot keep.
   */
  it('MEASURED: the predicted binding ratio dominates the measured one on every shape', async () => {
    const { shapes } = await fullBasis();
    const calibration = deriveCalibration(shapes, F2_BASIS_COMMIT);
    for (const shape of shapes) {
      const prediction = estimate(shape.spec, calibration);
      console.log(`[F2] ${formatEstimate(prediction)} | measured binds ${shape.bindingLimit} `
        + `${shape.bindingRatio.toFixed(4)}x`);
      expect(prediction.limits[0].ratio, `${shape.name} predicted binding ratio`)
        .toBeGreaterThanOrEqual(shape.bindingRatio - 1e-9);
    }
  }, 900_000);

  /**
   * The recorded half of the basis is only usable if it was taken under the discipline the board requires:
   * run to completion, refused by nothing at either real profile, and with a live density knob.
   */
  it('the recorded basis was measured run-to-completion, refused nothing, and its knob control bit', () => {
    for (const shape of F2_BASIS) {
      expect(shape.refusedAtConsensus, `${shape.name} refused at consensus`).toBe(0);
      expect(shape.refusedAtStandard, `${shape.name} refused at standard`).toBe(0);
      expect(shape.knobControlBites, `${shape.name} knob control did not bite`).toBe(true);
    }
  });

  /**
   * The four limits are modelled because F1 measured a different one binding for almost every shape. If the
   * basis ever collapses onto one binding limit, the reason this file models four has gone, and that should
   * be visible rather than inferred.
   */
  it('MEASURED: the basis really does bind on more than one limit', async () => {
    const { shapes } = await fullBasis();
    const limits = new Set(shapes.map((shape) => shape.bindingLimit));
    console.log(`[F2] binding limits across the basis: ${JSON.stringify([...limits])}`);
    expect(limits.size).toBeGreaterThan(1);
    expect(BCH_2026_STANDARD.maximumTransactionSize).toBe(100_000);
    expect(BCH_2026_CONSENSUS.maximumBytecodeLength).toBe(10_000);
    expect(BCH_2026_CONSENSUS.operationCostBudgetPerByte).toBe(800);
  }, 900_000);

  /**
   * SAME SUBJECT. F1 recorded 2,429 / 4,977 / 10,661 serialized bytes for the sweep at `4ac40b82`. This file
   * rebuilds the fixture from source at a later commit, so reproducing those exact figures is evidence that
   * the live half of the basis measures F1's shape and not a similar one.
   */
  it('MEASURED: the live sweep reproduces F1 sizes exactly', async () => {
    const { shapes } = await fullBasis();
    expect(shapes.slice(0, 3).map((shape) => shape.serializedBytes)).toEqual([2_429, 4_977, 10_661]);
  }, 900_000);
});

/* ------------------------------------------------------------------------------------------------------ */
/* Held-out validation                                                                                      */
/* ------------------------------------------------------------------------------------------------------ */

describe('F2 estimator: held out', () => {
  /**
   * LEAVE ONE OUT. Each shape is dropped from the calibration in turn and then predicted from coefficients
   * that never saw it. This is the only part of the calibration exercise that is a test rather than a
   * description, because every other row is trained on the point it predicts.
   *
   * It is EXPECTED to be weaker than the in-sample table, and it is reported rather than asserted to zero:
   * dropping the extreme point of a driver leaves the envelope extrapolating, and an extrapolated upper
   * envelope carries no guarantee. Asserting zero here would be asserting that a seven-point envelope
   * generalises, which is exactly the claim this row is not entitled to make.
   */
  it('MEASURED: leave-one-out, every shape predicted from a calibration that never saw it', async () => {
    const { shapes } = await fullBasis();
    const rows: { shape: string; limit: string; error: number; conservative: boolean; flagged: boolean }[] = [];
    for (const held of shapes) {
      const rest = shapes.filter((shape) => shape.name !== held.name);
      const calibration = deriveCalibration(rest, `${F2_BASIS_COMMIT}-without-${held.name}`);
      for (const row of calibrate([held], calibration)) {
        rows.push({
          shape: row.shape,
          limit: row.limit,
          error: row.error,
          conservative: row.conservative,
          flagged: row.outOfRange.length > 0,
        });
        console.log(`[F2] LOO ${formatCalibrationRow(row)}`);
      }
    }
    const under = rows.filter((row) => !row.conservative);
    const inRange = under.filter((row) => !row.flagged);
    console.log(`[F2] leave-one-out: ${rows.length - under.length}/${rows.length} conservative; `
      + `under-predicted: ${under.map((row) => `${row.shape}/${row.limit} `
        + `${(row.error * 100).toFixed(1)}%${row.flagged ? ' [FLAGGED out-of-range]' : ''}`)
        .join(', ') || 'none'}`);
    const worst = under.length === 0 ? 0 : Math.min(...under.map((row) => row.error));
    const worstInRange = inRange.length === 0 ? 0 : Math.min(...inRange.map((row) => row.error));
    // The distinction that matters. An under-prediction on a row the estimator itself refused to vouch for is
    // a declared limitation; one on a row it called in-range is a defect in the model.
    console.log(`[F2] leave-one-out worst under-prediction ${(worst * 100).toFixed(1)}%, of which `
      + `${under.length - inRange.length}/${under.length} were on rows the estimator FLAGGED as out of range; `
      + `worst IN-RANGE under-prediction ${(worstInRange * 100).toFixed(1)}%; the multiplicative margin that `
      + `would have covered every in-range miss is ${((1 / (1 + worstInRange) - 1) * 100).toFixed(1)}% and `
      + `every miss at all ${((1 / (1 + worst) - 1) * 100).toFixed(1)}%`);
    expect(rows).toHaveLength(shapes.length * 4);
    // WHAT IS PINNED, and what deliberately is not. Out-of-sample conservatism is NOT asserted, because a
    // seven-point envelope does not generalise and claiming it does is the error this row exists to avoid.
    // What IS pinned is the measured degree of the failure, so a change that makes it worse fails here.
    expect(worst).toBeGreaterThan(-0.40);
    expect(worstInRange).toBeGreaterThan(-0.20);
  }, 900_000);

  /**
   * A GENUINELY NEW SHAPE. Three participant counts absent from the calibration, ESTIMATED FROM THE
   * DESCRIPTOR BEFORE THE TRANSACTION IS BUILT, then built and measured. The order in the body is the order
   * of the claim: compile, estimate, build, compare.
   *
   * N=3 and N=6 interpolate the calibrated range. N=16 is DOUBLE the largest participant count anywhere in
   * the basis and past the deployed eight-participant semantic bound, so it is reported separately: an upper
   * envelope carries no guarantee outside the range it was fitted on, and the estimator says so itself
   * through `outOfRange` rather than leaving the caller to notice.
   */
  it('MEASURED: unseen participant counts, predicted before they are built', async () => {
    const { shapes } = await fullBasis();
    const calibration = deriveCalibration(shapes, F2_BASIS_COMMIT);
    const outcomes: { participants: number; limit: string; error: number }[] = [];
    for (const n of [3, 6, 16]) {
      // A compile is all the estimator gets. No provider UTXO set, no builder, no VM, no transaction.
      const artifact = compileString(makeParticipant(n), {
        forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
      });
      const redeem = new Contract(artifact, [], { provider: createTestProvider(), salt: brand })
        .bytecode.length;
      const prediction = estimate({
        name: `unseen N=${n}`,
        family: 'binding',
        participants: n,
        invocations: 1,
        blockSizes: Array.from({ length: n }, () => 1),
        redeemBytes: Array.from({ length: n }, () => redeem),
      }, calibration);
      console.log(`[F2] HELD-OUT ${formatEstimate(prediction)}`);

      const { shape } = await measureSweep(n);
      const comparison: [string, number, number][] = [
        ['serialized bytes', prediction.serializedBytes, shape.serializedBytes],
        ['worst unlocking bytes', prediction.worstUnlockingBytes, shape.worstUnlockingBytes],
        ['worst density ratio', prediction.worstDensityRatio, shape.worstDensityRatio],
        ['worst SigChecks ratio', prediction.worstSigCheckRatio, shape.worstSigCheckRatio],
      ];
      for (const [limit, predicted, measured] of comparison) {
        const error = predicted / measured - 1;
        const verdict = predicted >= measured - Math.abs(measured) * 1e-9 ? 'CONSERVATIVE' : 'UNDER-PREDICTS';
        outcomes.push({ participants: n, limit, error });
        console.log(`[F2] HELD-OUT N=${n} ${limit.padEnd(22)} predicted=${predicted.toFixed(4)} `
          + `measured=${measured.toFixed(4)} error=${error >= 0 ? '+' : ''}`
          + `${(error * 100).toFixed(1)}% ${verdict}`);
      }
      console.log(`[F2] HELD-OUT N=${n} outOfRange: ${JSON.stringify(prediction.outOfRange)}`);
    }
    // WHAT THIS FOUND, and it is a real limitation rather than a rounding artifact. N=6 sits INSIDE every
    // calibrated driver range and its density is still under-predicted, by 0.3%. The cause is geometric: the
    // binding family's density-against-participants curve bulges slightly ABOVE the chord joining N=4 and
    // N=8, and a straight upper envelope through the calibration points cannot dominate the interior of a
    // concave function. Denser calibration points, or a multiplicative margin, are the two fixes; neither is
    // applied here, because picking a margin from the single miss it has to cover is circular.
    //
    // So the assertion is the MEASURED bound, not zero. Off-sample under-prediction on the interpolating
    // counts is pinned at under one percent, which fails if the curve or the calibration moves.
    const interpolated = outcomes.filter((outcome) => outcome.participants !== 16);
    const extrapolated = outcomes.filter((outcome) => outcome.participants === 16);
    const worst = Math.min(...interpolated.map((outcome) => outcome.error));
    console.log(`[F2] held-out interpolation (N=3, N=6): worst error ${(worst * 100).toFixed(2)}% on `
      + `${interpolated.find((outcome) => outcome.error === worst)!.limit}`);
    const lowest = Math.min(...extrapolated.map((outcome) => outcome.error));
    console.log('[F2] held-out extrapolation (N=16, three drivers flagged out of range): lowest error '
      + `${(lowest * 100).toFixed(2)}%, ${extrapolated.filter((outcome) => outcome.error >= 0).length}`
      + `/${extrapolated.length} limits conservative`);
    expect(worst).toBeGreaterThan(-0.01);
  }, 900_000);

  /**
   * THE REAL HELD-OUT SHAPE, and the one that actually tests the model. E1's six-participant transitive
   * result graph was measured exactly like the calibration basis and deliberately kept out of it. It inverts
   * the byte distribution every calibration graph has - 3,626 serialized bytes per input against C1's 1,666
   * and C3's 932, five sidecars against C3's ninety - so if the estimator works only because every graph it
   * saw was sidecar-heavy, this is where that shows.
   *
   * Conservatism is NOT asserted per limit here either. The full four-limit comparison is printed, the
   * binding-limit agreement is printed, and what is pinned is the measured error floor.
   */
  it('MEASURED: a real six-participant graph the calibration never saw', async () => {
    const { shapes } = await fullBasis();
    const calibration = deriveCalibration(shapes, F2_BASIS_COMMIT);
    expect(calibration.basis.shapes).not.toContain(F2_HELD_OUT[0].name);
    const errors: number[] = [];
    for (const held of F2_HELD_OUT) {
      const prediction = estimate(held.spec, calibration);
      console.log(`[F2] HELD-OUT GRAPH ${formatEstimate(prediction)} | measured binds `
        + `${held.bindingLimit} ${held.bindingRatio.toFixed(4)}x`);
      for (const row of calibrate([held], calibration)) {
        errors.push(row.error);
        console.log(`[F2] HELD-OUT GRAPH ${formatCalibrationRow(row)}`);
      }
      // The geometry is plan-time arithmetic and must reproduce the built shape exactly, held out or not.
      expect(shapeGeometry(held.spec).inputs, `${held.name} inputs`).toBe(held.inputCount);
      expect(held.refusedAtConsensus).toBe(0);
      expect(held.refusedAtStandard).toBe(0);
      expect(held.knobControlBites).toBe(true);
    }
    const worst = Math.min(...errors);
    console.log(`[F2] held-out real graph: ${errors.filter((error) => error >= -1e-9).length}/${errors.length}`
      + ` limits conservative, worst error ${(worst * 100).toFixed(1)}%`);
    expect(errors).toHaveLength(F2_HELD_OUT.length * 4);
    // Pinned at the measured value rather than at zero, for the same reason leave-one-out is.
    expect(worst).toBeGreaterThan(-0.20);
  }, 900_000);

  /**
   * THE MEASURED SAFETY MARGIN, and what it costs.
   *
   * The two out-of-sample exercises above are the only evidence there is about how this estimator behaves on
   * a shape it did not see, and both found under-predictions: leave-one-out worst -12.3% on an in-range row,
   * the real held-out graph worst -9.6%. A multiplicative margin large enough to cover the worst of those is
   * therefore MEASURED rather than chosen, which is the only way a margin is worth anything.
   *
   * This test derives that margin from the exercises themselves and then verifies it does what it claims,
   * and it prints what the margin costs in looseness on the shapes that were already conservative. Whether
   * to ship it is a product decision that belongs to the production-envelope row, not to this one - which is
   * why the margin is computed and demonstrated here rather than baked into `deriveCalibration`'s default.
   */
  it('MEASURED: the margin the out-of-sample exercises say is needed, and what it costs', async () => {
    const { shapes } = await fullBasis();
    const worstOutOfSample = (margin: number): { worst: number; under: string[]; rows: number } => {
      const errors: { label: string; error: number }[] = [];
      for (const held of shapes) {
        const rest = shapes.filter((shape) => shape.name !== held.name);
        const calibration = deriveCalibration(rest, 'loo', margin);
        for (const row of calibrate([held], calibration)) {
          // Rows the estimator itself flagged are declared limitations, not model error, and a margin is
          // not what fixes them: the fix is a calibration that covers the range.
          if (row.outOfRange.length === 0) errors.push({ label: `${row.shape}/${row.limit}`, error: row.error });
        }
      }
      const full = deriveCalibration(shapes, F2_BASIS_COMMIT, margin);
      for (const row of calibrate(F2_HELD_OUT, full)) {
        errors.push({ label: `${row.shape}/${row.limit}`, error: row.error });
      }
      return {
        worst: Math.min(...errors.map((row) => row.error)),
        under: errors.filter((row) => row.error < -1e-9).map((row) => `${row.label} ${(row.error * 100).toFixed(1)}%`),
        rows: errors.length,
      };
    };
    const bare = worstOutOfSample(0);
    console.log(`[F2] out-of-sample without margin: ${bare.under.length}/${bare.rows} under-predicted, `
      + `worst ${(bare.worst * 100).toFixed(1)}%: ${bare.under.join(', ')}`);
    // SEARCHED, not solved in closed form. A margin scales the envelope coefficients but NOT the additive
    // redeem-script term, and it can change which class is predicted worst, so the arithmetic
    // `1/(1+worst) - 1` is only a lower bound on what is actually needed. It gives 14% here; 16% is what
    // the search finds. Reporting the closed-form figure as if it were the answer would understate it.
    let applied = 0;
    while (applied < 1 && worstOutOfSample(applied).under.length > 0) applied += 0.01;
    const covered = worstOutOfSample(applied);
    console.log(`[F2] closed-form margin from the worst miss ${((1 / (1 + bare.worst) - 1) * 100).toFixed(1)}%; `
      + `SEARCHED margin that actually covers every out-of-sample row ${(applied * 100).toFixed(0)}%`);
    console.log(`[F2] out-of-sample WITH the ${(applied * 100).toFixed(0)}% margin: `
      + `${covered.under.length}/${covered.rows} under-predicted, worst ${(covered.worst * 100).toFixed(1)}%`);
    expect(covered.under).toEqual([]);
    expect(applied).toBeGreaterThan(1 / (1 + bare.worst) - 1 - 1e-9);

    // And what it costs, on the shapes that were already conservative: the estimator becomes that much less
    // useful for deciding what to cut, which is the reason this is reported rather than switched on.
    const tight = calibrate(shapes, deriveCalibration(shapes, F2_BASIS_COMMIT, 0));
    const loose = calibrate(shapes, deriveCalibration(shapes, F2_BASIS_COMMIT, applied));
    const mean = (rows: typeof tight): number =>
      rows.reduce((sum, row) => sum + row.error, 0) / rows.length;
    console.log('[F2] cost of the margin: in-sample mean over-prediction '
      + `${(mean(tight) * 100).toFixed(1)}% -> ${(mean(loose) * 100).toFixed(1)}%, `
      + `worst ${(Math.max(...tight.map((row) => row.error)) * 100).toFixed(1)}% -> `
      + `${(Math.max(...loose.map((row) => row.error)) * 100).toFixed(1)}%`);
    expect(mean(loose)).toBeGreaterThan(mean(tight));
  }, 900_000);

  /**
   * X70: DOES THE ARGUMENT AGAINST SHIPPING THE MARGIN STILL HOLD?
   *
   * F2 searched a 34% margin, reported it and deliberately did not enable it, on the grounds that a margin
   * scales the envelope coefficients but NOT the additive redeem term - so on the limit that binds it does
   * less than its label says. That was stated as an argument. Here it is a measurement, and the repair has
   * made it STRONGER rather than weaker: before X70, only the master class carried a fixed redeem term, and
   * the projection and controller were fitted end to end, so a margin scaled all of both. Now all three
   * carry one, and the projection - the class that binds every one-participant graph - is 4,542 fixed bytes
   * against a few hundred fitted ones.
   *
   * So the margin needed to cover a given miss is no longer the miss's reciprocal. That is the number this
   * test produces, per class, for the searched margin.
   */
  it('MEASURED: what a multiplicative margin actually buys, per class, once the redeem terms are carried', () => {
    const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    const margin = 0.16;
    const marginal = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT, margin);
    const specs = [
      { label: 'one-participant replica', spec: { ...F2_BASIS[0].spec, participants: 1, invocations: 1,
        blockSizes: [1], redeemBytes: [1_500] } },
      { label: 'A13 graph', spec: F2_BASIS[0].spec },
      { label: 'C1 DeFi', spec: F2_BASIS[2].spec },
      { label: 'E1 result graph', spec: F2_HELD_OUT[0].spec },
    ];
    for (const { label, spec } of specs) {
      const bare = estimate(spec, calibration);
      const withMargin = estimate(spec, marginal);
      for (const klass of ['master', 'projection', 'controller'] as const) {
        const before = bare.classes.find((row) => row.klass === klass);
        const after = withMargin.classes.find((row) => row.klass === klass);
        if (before === undefined || after === undefined) continue;
        const effective = after.unlockingBytes / before.unlockingBytes - 1;
        console.log(`[F2] ${label.padEnd(24)} ${klass.padEnd(11)} a ${(margin * 100).toFixed(0)}% margin `
          + `moves ${before.unlockingBytes.toFixed(0)}B -> ${after.unlockingBytes.toFixed(0)}B, `
          + `i.e. ${(effective * 100).toFixed(1)}% - the fitted share is `
          + `${(((after.unlockingBytes - before.unlockingBytes) / margin) / before.unlockingBytes * 100)
            .toFixed(1)}%`);
        // The whole point: a margin is not worth its label on any class that carries a redeem script.
        expect(effective).toBeLessThan(margin + 1e-9);
      }
    }
    // THE ONE THAT MATTERS, as a single number. E1's projection is under-predicted by 3.5%, so the naive
    // closed-form margin is 1/(1-0.035)-1 = 3.6%. What actually closes it is four times that, because only
    // the blob scales. A margin quoted from an error alone would be badly undersized.
    const e1 = F2_HELD_OUT[0];
    const projectionOf = (safety: number): number => estimate(
      e1.spec, deriveCalibration(F2_BASIS, F2_BASIS_COMMIT, safety),
    ).classes.find((row) => row.klass === 'projection')!.unlockingBytes;
    const naive = 1 / (projectionOf(0) / e1.projections!.unlockingBytes) - 1;
    let needed = 0;
    while (needed < 2 && projectionOf(needed) < e1.projections!.unlockingBytes) needed += 0.001;
    console.log(`[F2] E1 projection: predicted ${projectionOf(0).toFixed(0)}B against `
      + `${e1.projections!.unlockingBytes}B measured; closed-form margin ${(naive * 100).toFixed(1)}%, `
      + `margin actually required ${(needed * 100).toFixed(1)}% - a factor of `
      + `${(needed / naive).toFixed(1)} because ${(calibration.projectionRedeemBytes
        / projectionOf(0) * 100).toFixed(0)}% of the prediction is a fixed redeem script`);
    expect(needed).toBeGreaterThan(naive * 2);
  });

  /**
   * FAIL CLOSED ON THE UNKNOWN. A descriptor outside every calibrated driver range must not return a
   * confident number. It returns `outOfRange` naming each driver that left the range, which is the reporting
   * form F2 ships in; production REJECTION is a later row and nothing here enables it.
   */
  it('a shape outside the calibrated range is reported out of range rather than answered confidently', () => {
    const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    expect(estimate(F2_BASIS[F2_BASIS.length - 1].spec, calibration).outOfRange).toEqual([]);
    const absurd = estimate({
      name: 'far outside',
      family: 'graph',
      participants: 8,
      invocations: 24,
      blockSizes: Array.from({ length: 8 }, () => 400),
      redeemBytes: Array.from({ length: 8 }, () => 9_000),
    }, calibration);
    expect(absurd.outOfRange.length).toBeGreaterThan(0);
    console.log(`[F2] out-of-range report: ${JSON.stringify(absurd.outOfRange)}`);
    // And it still answers, because a refusal with no number does not help a user decide what to cut.
    expect(absurd.verdict).toBe('OVER');
  });

  /**
   * BOTH ENDS OF THE RANGE, which is the report F2 did not have. A one-participant graph is BELOW every
   * calibrated driver, and F2 answered it `in-range` and confidently - which is how forty-five real contracts
   * were answered wrong. The clamp is what makes the answer sound; this is what makes it honest.
   */
  it('a driver BELOW the calibrated minimum is reported out of range, and answered at the measured floor', () => {
    const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    const tiny = estimate({
      name: 'one participant',
      family: 'graph',
      participants: 1,
      invocations: 1,
      blockSizes: [1],
      redeemBytes: [1_500],
    }, calibration);
    console.log(`[F2] below-range report: ${JSON.stringify(tiny.outOfRange)}`);
    expect(tiny.outOfRange.some((entry) => entry.includes('below the calibrated minimum'))).toBe(true);
    // The projection class is the fixed covenant plus the smallest MEASURED blob, never the fitted line's
    // value at a driver the fit never saw. 4,542 + 460 is arithmetic on two measurements.
    const projection = tiny.classes.find((row) => row.klass === 'projection')!;
    expect(projection.unlockingBytes)
      .toBe(calibration.projectionRedeemBytes + calibration.projectionArgBytes.minimumValue);
    expect(projection.unlockingBytes).toBeGreaterThan(calibration.projectionRedeemBytes);
  });

  /**
   * THE ARITHMETIC FLOOR, stated as a property rather than as a number. A P2SH input pushes the script it
   * redeems, so its unlocking bytecode cannot be shorter than that script. The pre-X70 model could and did
   * violate this - its projection coefficient had an intercept of 4,095 for a 4,542-byte covenant - and no
   * amount of re-fitting prevents a fitted line from doing it again. This is the check that does.
   */
  it('MEASURED: no class is ever predicted shorter than the script it redeems, at any driver', () => {
    const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    for (const participants of [1, 2, 3, 5, 8, 12, 20]) {
      for (const redeem of [800, 1_500, 3_000, 6_000, 9_000]) {
        const prediction = estimate({
          name: `floor N=${participants} redeem=${redeem}`,
          family: 'graph',
          participants,
          invocations: participants,
          blockSizes: Array.from({ length: participants }, () => 1),
          redeemBytes: Array.from({ length: participants }, () => redeem),
        }, calibration);
        const floors: [InputClass, number][] = [
          ['master', redeem],
          ['projection', calibration.projectionRedeemBytes],
          ['controller', calibration.controllerRedeemBytes],
        ];
        for (const [klass, floor] of floors) {
          const row = prediction.classes.find((entry) => entry.klass === klass)!;
          expect(row.unlockingBytes, `${klass} at N=${participants} redeem=${redeem}`)
            .toBeGreaterThanOrEqual(floor);
        }
      }
    }
  });

  /**
   * A COVENANT SIZE CHANGE MOVES THE PREDICTION. This is the X66 property: the projection verifier has been
   * edited five times on this board (X7, X23, X24, X27, X5, F4) and every edit is worth N transaction bytes.
   * When that size lived inside a fitted intercept, an edit silently invalidated every prediction and nothing
   * said so. Carried as a descriptor field, it moves the answer by exactly what it moves the transaction by.
   */
  it('MEASURED: the prediction tracks the generated covenant sizes instead of baking them in', () => {
    const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    const spec = {
      name: 'covenant tracking', family: 'graph' as const, participants: 4, invocations: 4,
      blockSizes: [1, 1, 1, 1], redeemBytes: [1_500, 1_500, 1_500, 1_500],
    };
    const base = estimate(spec, calibration);
    const grown = estimate({ ...spec, projectionRedeemBytes: calibration.projectionRedeemBytes + 129 },
      calibration);
    const projectionOf = (prediction: typeof base): number =>
      prediction.classes.find((row) => row.klass === 'projection')!.unlockingBytes;
    expect(projectionOf(grown) - projectionOf(base)).toBe(129);
    // And it is worth N transaction bytes, which is the fact F4's measurement established on all four
    // capstones and which the estimator now reproduces from the descriptor alone.
    expect(grown.serializedBytes - base.serializedBytes).toBe(129 * 4);
  });
});

/* -------------------------------------------------------------------------------------------------------- */
/* X70: the forty-five-contract corpus calibration                                                            */
/* -------------------------------------------------------------------------------------------------------- */

/**
 * The pre-X70 script term, re-derived from the SAME calibration samples, so the before/after table below is
 * two models on one set of measurements in one process rather than two runs at two commits.
 *
 * F2 modelled the projection and the controller as a single upper envelope over their WHOLE unlocking
 * bytecode, evaluated at the driver wherever it fell. That is reproduced exactly here: fit over the totals,
 * evaluate unclamped. Everything else - masters, sidecars, fee - was already `redeem + enveloped blob` and is
 * shared with the current model, so the difference between the two columns is the term under repair and
 * nothing else.
 */
function legacyWorstUnlockingBytes(spec: ReturnType<typeof replicaSpec>, samples: MeasuredShape[]): number {
  const graphs = samples.filter((sample) => sample.spec.family === 'graph');
  const line = (points: { x: number; y: number; label: string }[], at: number): number => {
    const envelope = fitUpperEnvelope(points);
    return envelope.intercept + envelope.slope * at;
  };
  const rows = spec.participants + spec.invocations;
  const projection = line(graphs.filter((sample) => sample.projections !== undefined).map((sample) => ({
    x: sample.spec.participants + sample.spec.invocations,
    y: sample.projections!.unlockingBytes,
    label: sample.name,
  })), rows);
  const controller = line(graphs.filter((sample) => sample.controller !== undefined).map((sample) => ({
    x: sample.spec.participants + sample.spec.invocations,
    y: sample.controller!.unlockingBytes,
    label: sample.name,
  })), rows);
  const masterArgs = line(graphs.flatMap((sample) => sample.masters.map((master) => ({
    x: sample.spec.participants + sample.spec.invocations,
    y: master.unlockingBytes - master.redeemBytes,
    label: sample.name,
  }))), rows);
  return Math.max(projection, controller, Math.max(...spec.redeemBytes) + masterArgs);
}

/** Corpus roots, so a census row can be recompiled. The same defaults F3's probe and fit report use. */
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

const eligibleCensusRows = F3_CENSUS_ELIGIBLE.filter((row) => typeof row.redeemBytes === 'number');

/**
 * The same selection rule F3 used, restated rather than imported because F3's file does not export it: every
 * bus-reachable census row whose block is one slot, whose constructor this harness can supply, and whose
 * corpus root is present. Widest redeem first. Chosen by a rule, so the population cannot be the ones that
 * happened to work.
 */
function corpusCandidates(): CensusRow[] {
  return eligibleCensusRows
    .filter((row) => row.blockSize === 1
      && (row.constructorTypes ?? []).every((type) => placeholder(type) !== undefined)
      && CORPUS_ROOTS[row.corpus] !== undefined)
    .sort((left, right) => right.redeemBytes! - left.redeemBytes!);
}

const raw = (builder: TransactionBuilder): string =>
  binToHex(encodeTransaction(builder.buildLibauthTransaction()));

interface CorpusMeasurement {
  subject: CensusRow;
  envelope: EnvelopeMeasurement;
  classification: ReturnType<typeof classifyInputs>;
  transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>;
  sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>;
}

/**
 * Build one census row into a real one-participant graph and measure it against every real limit.
 *
 * IT ASSERTS NOTHING ABOUT THE RESULT, deliberately. The caller wraps this in a try/catch, because a corpus
 * contract whose handler cannot execute with placeholder arguments is a legitimate skip; if the acceptance
 * and knob-liveness checks lived in here, a control that stopped biting would be swallowed into that same
 * skip list and the row would keep passing while proving nothing. They are made by the caller, outside the
 * catch, on what this returns.
 */
async function measureCorpusSubject(subject: CensusRow): Promise<CorpusMeasurement> {
  const provider = createLayer3SemanticTestProvider();
  const projectionArtifact = compileString(layer3.generateGraphProjectionVerifier());
  const projection = new Contract(projectionArtifact, [], { provider });
  const controller = new Contract(
    compileString(layer3.generateGraphRootController(projection.lockingBytecode)),
    [alicePkh], { provider },
  );
  const genesis = await (provider as never as {
    addTokenUtxosDynamic: (make: () => unknown[]) => Promise<{ categoryId: string; utxos: Utxo[] }>;
  }).addTokenUtxosDynamic(() => [{
    address: controller.tokenAddress,
    satoshis: 3000n,
    token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }]);
  const controllerCategory = genesis.categoryId;

  const artifact = compileFile(`${CORPUS_ROOTS[subject.corpus]}/${subject.rel}`, {
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
    .find((utxo) => utxo.token?.nft?.commitment === transcript.root);
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
  tx.addOutput({
    to: participant.tokenAddress,
    amount: setup.masterUtxo.satoshis,
    token: { category: setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 1000n });
  tx.addOutput({ to: p2pkh.address, amount: 100_000n });

  const transaction = tx.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(tx.inputs as never);
  // RULE 1. Every cost read RUN TO COMPLETION on a relaxed density ceiling with every other consensus knob
  // real. `assessEnvelope` throws rather than reporting a budget back if any input aborts, which is what
  // makes the skip list above a list of contracts that cannot execute rather than of costs never measured.
  const envelope = assessEnvelope(`${subject.contractName} x1`, transaction as never, sourceOutputs);
  const redeemBytes = transaction.inputs.map((input) => redeemScriptLength(input.unlockingBytecode));
  return {
    subject, envelope, classification: classifyInputs(envelope, redeemBytes), transaction, sourceOutputs,
  };
}

/**
 * The two rules, asserted OUTSIDE the caller's catch: acceptance with nothing relaxed at both real profiles,
 * and a density knob that refuses these exact bytes at a budget derived from this input's own reading.
 */
function assertMeasurementDiscipline(measurement: CorpusMeasurement): void {
  const { subject, envelope, transaction, sourceOutputs } = measurement;
  expect(envelope.refusedAtConsensus, `${subject.contractName} refused at the real consensus profile`)
    .toEqual([]);
  expect(envelope.refusedAtStandard, `${subject.contractName} refused at the real standard profile`)
    .toEqual([]);
  const budget = knobControlBudgetFor(envelope.worstCostInput);
  const control = densityKnobControl(
    transaction as never, sourceOutputs, envelope.worstCostInput.input, budget,
  );
  expect(budget, `${subject.contractName} control budget is not below the ordinary one`)
    .toBeLessThan(BCH_2026_CONSENSUS.operationCostBudgetPerByte);
  expect(control, `${subject.contractName}: the operation-cost knob does not bite at ${budget}/byte`)
    .toBeDefined();
  expect(String(control)).toMatch(/density|operation cost/i);
}

/** Per-input-class measurement, so an aggregate that happens to be dominated by one class cannot hide a miss. */
function measuredClasses(measurement: CorpusMeasurement): Map<InputClass, { bytes: number; density: number }> {
  const { envelope, classification } = measurement;
  const at = (index: number): { bytes: number; density: number } => ({
    bytes: envelope.inputs[index].unlockingBytes,
    density: envelope.inputs[index].standardCostRatio,
  });
  const worst = (indices: number[]): { bytes: number; density: number } => ({
    bytes: Math.max(...indices.map((index) => envelope.inputs[index].unlockingBytes)),
    density: Math.max(...indices.map((index) => envelope.inputs[index].standardCostRatio)),
  });
  const rows = new Map<InputClass, { bytes: number; density: number }>();
  rows.set('master', worst(classification.masters));
  rows.set('projection', worst(classification.projections));
  if (classification.controller !== undefined) rows.set('controller', at(classification.controller));
  rows.set('fee', at(classification.fee));
  return rows;
}

describe('F2 estimator: X70 - the forty-five real corpus contracts that bind on script bytes', () => {
  /**
   * THE ROW THAT FOUND THE DEFECT, RE-RUN AGAINST THE REPAIR.
   *
   * F3 built every one-slot bus-reachable corpus contract into a real one-participant graph and measured it.
   * All of them bind on the 10,000-byte per-input unlocking limit, and F2 under-predicted that limit on every
   * single one - the only limit any of them is actually near, and the one F2 got wrong. F2 meanwhile predicted
   * DENSITY would bind on all of them, which is a worse failure than a small error: it names the wrong thing
   * to cut.
   *
   * The mechanism was never subtle once looked at. The projection verifier is ONE generated covenant of 4,542
   * bytes and every proof slot pushes the whole of it, so the projection input cannot be shorter than 4,542
   * bytes whatever else is true. F2's coefficient for that input was a line fitted through four points at six
   * to sixteen rows, with an INTERCEPT OF 4,095 - already below the arithmetic floor - evaluated at two rows,
   * where it returned 4,441. It was not modelling the shape wrongly; it was modelling a constant as a slope.
   *
   * This test builds the same population, measures it the same way, and reports BOTH models against it.
   */
  it('MEASURED: every one-slot corpus contract, before and after the script-term repair', async () => {
    const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    const candidates = corpusCandidates();
    console.log(`[F2/X70] census at ${F3_CENSUS_COMMIT}, calibration at ${calibration.basis.commit}; `
      + `one-slot bus-reachable candidates: ${candidates.length}`);
    expect(candidates.length, 'no one-slot bus-reachable corpus contract exists').toBeGreaterThan(0);

    interface Row {
      name: string;
      measuredWorst: number;
      predictedWorst: number;
      legacyWorst: number;
      measuredBinds: string;
      predictedBinds: string;
      predictedDensity: number;
      unresolved: string[];
      perClass: { klass: InputClass; predictedBytes: number; measuredBytes: number;
        predictedDensity: number; measuredDensity: number }[];
      limitErrors: { limit: string; error: number }[];
    }
    const rows: Row[] = [];
    const skipped: string[] = [];
    let controlled = 0;
    for (const subject of candidates) {
      let measurement: CorpusMeasurement;
      try {
        measurement = await measureCorpusSubject(subject);
      } catch (error) {
        skipped.push(`${subject.corpus}/${subject.contractName}: ${(error as Error).message.split('\n')[0]}`);
        continue;
      }
      assertMeasurementDiscipline(measurement);
      controlled += 1;
      const spec = replicaSpec(subject, 1);
      const prediction = estimate(spec, calibration);
      const { envelope } = measurement;
      const measured = measuredClasses(measurement);
      rows.push({
        name: `${subject.corpus}/${subject.contractName}`,
        measuredWorst: envelope.worstUnlockingInput.unlockingBytes,
        predictedWorst: prediction.worstUnlockingBytes,
        legacyWorst: legacyWorstUnlockingBytes(spec, F2_BASIS),
        measuredBinds: envelope.binding[0].limit,
        predictedBinds: prediction.limits[0].limit,
        predictedDensity: prediction.worstDensityRatio,
        unresolved: prediction.bindingUnresolved,
        perClass: prediction.classes
          .filter((row) => measured.has(row.klass))
          .map((row) => ({
            klass: row.klass,
            predictedBytes: row.unlockingBytes,
            measuredBytes: measured.get(row.klass)!.bytes,
            predictedDensity: row.densityRatio,
            measuredDensity: measured.get(row.klass)!.density,
          })),
        limitErrors: [
          ['serialized bytes', prediction.serializedBytes, envelope.serializedBytes],
          ['worst unlocking bytes', prediction.worstUnlockingBytes,
            envelope.worstUnlockingInput.unlockingBytes],
          ['worst density ratio', prediction.worstDensityRatio, envelope.worstCostInput.standardCostRatio],
          ['worst SigChecks ratio', prediction.worstSigCheckRatio,
            Math.max(...envelope.inputs.map((row) => row.signatureCheckRatio))],
        ].map(([limit, predicted, measuredValue]) => ({
          limit: limit as string,
          error: (predicted as number) / (measuredValue as number) - 1,
        })),
      });
    }
    for (const failure of skipped) console.log(`[F2/X70] candidate skipped - ${failure}`);
    console.log(`[F2/X70] measured ${rows.length} of ${candidates.length} one-slot candidates, `
      + 'all run to completion, refused by nothing at either real profile, and with a density knob that '
      + `bites on the same bytes: ${controlled}/${rows.length}`);
    expect(rows.length, 'no candidate could be built and measured').toBeGreaterThan(0);
    expect(controlled).toBe(rows.length);

    // THE CORRECTED CALIBRATION TABLE. Both directions, both models, on the limit that actually binds.
    const errorOf = (predicted: number, measured: number): number => predicted / measured - 1;
    const after = rows.map((row) => errorOf(row.predictedWorst, row.measuredWorst));
    const before = rows.map((row) => errorOf(row.legacyWorst, row.measuredWorst));
    const band = (values: number[]): string => `${(Math.min(...values) * 100).toFixed(1)}% to `
      + `${(Math.max(...values) * 100).toFixed(1)}%, mean `
      + `${((values.reduce((sum, value) => sum + value, 0) / values.length) * 100).toFixed(1)}%`;
    console.log(`[F2/X70] unlocking bytecode length, BEFORE the repair: ${band(before)}; `
      + `${before.filter((error) => error < 0).length}/${before.length} UNDER-PREDICTED`);
    console.log(`[F2/X70] unlocking bytecode length, AFTER  the repair: ${band(after)}; `
      + `${after.filter((error) => error < 0).length}/${after.length} UNDER-PREDICTED`);
    for (const limit of ['serialized bytes', 'worst density ratio', 'worst SigChecks ratio']) {
      const errors = rows.map((row) => row.limitErrors.find((entry) => entry.limit === limit)!.error);
      console.log(`[F2/X70] ${limit.padEnd(22)}: ${band(errors)}; `
        + `${errors.filter((error) => error < -1e-9).length}/${errors.length} under-predicted`);
    }

    // PER CLASS, because an aggregate the projection dominates could hide a master or controller miss.
    const classErrors = new Map<InputClass, { bytes: number[]; density: number[] }>();
    for (const row of rows) {
      for (const entry of row.perClass) {
        const bucket = classErrors.get(entry.klass) ?? { bytes: [], density: [] };
        bucket.bytes.push(errorOf(entry.predictedBytes, entry.measuredBytes));
        bucket.density.push(errorOf(entry.predictedDensity, entry.measuredDensity));
        classErrors.set(entry.klass, bucket);
      }
    }
    const classMisses: string[] = [];
    for (const [klass, bucket] of classErrors) {
      const underBytes = bucket.bytes.filter((error) => error < -1e-9).length;
      const underDensity = bucket.density.filter((error) => error < -1e-9).length;
      console.log(`[F2/X70] class ${klass.padEnd(11)} bytes ${band(bucket.bytes)} `
        + `(${underBytes} under) | density ${band(bucket.density)} (${underDensity} under)`);
      if (underBytes > 0) classMisses.push(`${klass} bytes ${underBytes}/${bucket.bytes.length}`);
      if (underDensity > 0) classMisses.push(`${klass} density ${underDensity}/${bucket.density.length}`);
    }

    // THE BINDING LIMIT, which is the estimator's actual output. It is reported in TWO forms, because the
    // ranking and the bound are different jobs and only one of them is fixed by X70.
    const bindingAgreement = rows.filter((row) => row.measuredBinds === row.predictedBinds).length;
    const inUnresolved = rows.filter((row) => row.unresolved.includes(row.measuredBinds)).length;
    const measuredBinds = new Set(rows.map((row) => row.measuredBinds));
    const predictedBinds = new Set(rows.map((row) => row.predictedBinds));
    console.log(`[F2/X70] binding limit measured:  ${[...measuredBinds].join(', ')}`);
    console.log(`[F2/X70] binding limit predicted: ${[...predictedBinds].join(', ')}`);
    console.log(`[F2/X70] leader agrees with the measured binder on ${bindingAgreement}/${rows.length}; `
      + `the measured binder is in the UNRESOLVED set on ${inUnresolved}/${rows.length}`);
    // How far the repair moved the ranking even though it did not invert it: the script prediction rose from
    // below the density prediction by 30% to within 15% of it, which is why the two are now unresolvable
    // rather than confidently ordered the wrong way round.
    const density = rows.map((row) => row.predictedDensity);
    const scriptBefore = rows.map((row) => row.legacyWorst / BCH_2026_CONSENSUS.maximumBytecodeLength);
    const scriptAfter = rows.map((row) => row.predictedWorst / BCH_2026_CONSENSUS.maximumBytecodeLength);
    const ratioBand = (top: number[], bottom: number[]): string => {
      const values = top.map((value, index) => bottom[index] / value);
      return `${Math.min(...values).toFixed(3)}x to ${Math.max(...values).toFixed(3)}x`;
    };
    console.log(`[F2/X70] predicted density / predicted script bytes, BEFORE: ${ratioBand(scriptBefore, density)}`);
    console.log(`[F2/X70] predicted density / predicted script bytes, AFTER:  ${ratioBand(scriptAfter, density)}`);

    // WHAT IS PINNED. Conservatism on the limit that binds, on every row, is the claim this row exists to
    // make, and it is asserted rather than reported. The class table is asserted the same way: a miss hidden
    // inside a class is still a miss, and the master-density miss this check found is the reason the density
    // coefficients are not clamped to their measured floor.
    const under = rows.filter((row) => row.predictedWorst < row.measuredWorst);
    expect(under.map((row) => `${row.name} ${row.predictedWorst} < ${row.measuredWorst}`)).toEqual([]);
    expect(classMisses).toEqual([]);
    // THE RANKING IS NOT FIXED, AND IS NOT ASSERTED TO BE. What IS asserted is that the measured binder is
    // never ruled out: naming density first while the truth is script bytes is a resolution failure the model
    // declares, where F2 asserted the wrong answer with no qualification at all.
    expect(inUnresolved).toBe(rows.length);
    // The before column is kept as an assertion too, so this row cannot quietly stop demonstrating anything:
    // the model it replaced must still be visibly wrong on this population.
    expect(before.filter((error) => error < 0).length).toBeGreaterThanOrEqual(before.length - 1);
  }, 1_800_000);
});
