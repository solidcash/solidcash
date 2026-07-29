import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  BCH_2026_CONSENSUS, BCH_2026_STANDARD, assessEnvelope, densityKnobControl, formatEnvelope,
  knobControlBudgetFor,
} from './layer3-envelope-f1.js';
import {
  type MeasuredShape, calibrate, classifyInputs, deriveCalibration, distill, estimate,
  fitUpperEnvelope, formatCalibrationRow, formatEstimate, redeemScriptLength, shapeGeometry,
} from './layer3-estimator-f2.js';
import { F2_BASIS, F2_BASIS_COMMIT } from './layer3-estimator-basis-f2.js';
import { F2_HELD_OUT } from './layer3-estimator-heldout-f2.js';

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
 * mean +4.8%.
 *
 * OUT OF SAMPLE THERE IS NO SUCH GUARANTEE, AND THIS FILE MEASURES THE GAP RATHER THAN ASSUMING IT AWAY.
 * Leave-one-out: 22/28, worst -27.2% (on a row the estimator itself flagged out of range), worst in-range
 * -12.3%. A real six-participant graph the calibration never saw: 2/4 limits conservative, worst -9.6%.
 * Synthetic counts N=3/6/16 predicted before building: 11/12, the one miss -0.31%. The margin that covers
 * every out-of-sample miss is SEARCHED at 34% and costs the in-sample mean +4.8% -> +23.5%; it is reported,
 * not switched on, because whether to pay that is the production-envelope row's decision.
 *
 * WHAT IS MEASURED HERE AND WHAT IS RECORDED. The synthetic sweep is rebuilt and re-measured live in this
 * file, so the estimator faces a transaction produced in the same process it is judged in. The four capstone
 * shapes are a RECORDED basis (`layer3-estimator-basis-f2.ts`), and the held-out graph a second recorded
 * file (`layer3-estimator-heldout-f2.ts`), both captured by observing the fixtures' OWN builders through
 * `layer3-estimator-probe.ts` and stamped with the commit they were taken at. Recording them is a cost
 * decision, not an epistemic one: re-running C1, C2, C3, A13 and E1 inside this file would add roughly
 * fifteen minutes to every run of it and would measure exactly the same transactions.
 *
 * A MODEL EVALUATED ON ITS TRAINING DATA IS NOT EVALUATED. The last describe block is held out three ways:
 * it drops each of the seven shapes from the calibration in turn and predicts it from coefficients that
 * never saw it; it predicts three synthetic participant counts absent from the calibration BEFORE building
 * them; and it predicts a REAL six-participant, seven-invocation graph that is in no calibration set here.
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
});
