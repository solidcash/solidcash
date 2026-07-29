import {
  BCH_2026_CONSENSUS, BCH_2026_STANDARD, type EnvelopeMeasurement, type InputMeasurement,
} from './layer3-envelope-f1.js';

/**
 * F2. A CONSERVATIVE CALIBRATED COST ESTIMATOR.
 *
 * F1 measured where seven built shapes land against the real BCH-2026 limits. This predicts where a shape
 * lands BEFORE it is built, so a design that cannot fit is refused at plan time rather than after 108 inputs
 * have been assembled, seeded, signed and evaluated.
 *
 * WHAT F1 ESTABLISHED THAT THIS FILE IS SHAPED BY. A DIFFERENT limit binds first for almost every shape:
 * per-input SigChecks for the smallest sweep, operation-cost density for the middle, the 10,000-byte per-input
 * script limit for C1 and A13, and the 100,000-byte standard relay ceiling for C3. An estimator that models
 * density alone would be wrong about four of the seven. All four limits are therefore modelled, and the
 * estimator reports the binding one rather than a single "capacity" number.
 *
 * THE INPUT BOUNDARY, stated exactly, because an estimator fed the answer is not an estimator. The descriptor
 * below carries only what is available WITHOUT assembling the transaction:
 *
 *   - participant and invocation counts: the graph the user wrote;
 *   - per-participant balanced block size: `artifact.blockLayout.blockSize`, a compile output;
 *   - per-participant master redeem bytes: `new Contract(artifact, args).bytecode.length`, which needs
 *     compilation and constructor arguments but no UTXO, no seeding, no signing and no VM.
 *
 * It carries NO measured transaction bytes, no per-input cost, and nothing produced by `TransactionBuilder`.
 * Compilation is seconds; assembling and evaluating C3 is minutes. That gap is the point of the estimator.
 *
 * CONSERVATIVE MEANS IT MUST NEVER UNDER-PREDICT, and that is a construction, not a hope. Every coefficient
 * is a LINEAR UPPER ENVELOPE over the calibration points - the least-total-over-prediction line that lies on
 * or above every measured point - not a least-squares fit. A regression through seven points would sit below
 * roughly half of them by construction, which for a capacity check is the one error that matters. The
 * envelope is exact arithmetic on the measurements it is given: if it dominates the calibration set it is
 * reported as dominating, and if a later measurement breaks it, `calibrate` says so instead of re-basing.
 *
 * WHAT IT CANNOT MODEL, recorded before any number is quoted:
 *
 *   1. MARGINAL COST PER RESOURCE, RESULT, CHUNK AND EVENT. F1 could not isolate these because the capstones
 *      move participant count, invocation count and slot count together. Neither can this. The estimator
 *      therefore does NOT take resource/result/chunk/event counts as separate drivers; it takes the total
 *      slot count they sum into, and its sidecar model is a per-slot upper envelope over every sidecar kind
 *      that appears in the calibration set. A shape whose sidecars are systematically more expensive than
 *      any calibration sidecar is outside the calibrated range, and `estimate` says so.
 *   2. CONTRACT BODY COST. Master-input cost is driven by that participant's own compiled script, which the
 *      estimator is given rather than predicts. A user who has not compiled cannot use this.
 *   3. RELAY POLICY BEYOND SIZE. Dust, minimum relay fee, the full `isStandard` predicate and package limits
 *      are not modelled, exactly as F1 did not measure them.
 *   4. HASH-ITERATION DENSITY. NOT MODELLED, deliberately. F1 measured worst usage at 0.1078x, an order of
 *      magnitude from binding, and the knob it would be calibrated against is under active repair:
 *      `createVirtualMachine.ts` writes one `hashDigestIterationsPerByte` into BOTH the standard and the
 *      nonstandard field, so the fixtures' 3 is 0.86x of the real consensus 3.5 and 6x the real standard 0.5.
 *      Calibrating a coefficient against a knob someone is in the middle of splitting would bake in a number
 *      with a known defect. A shape that becomes hash-bound is therefore OUTSIDE what this estimator covers,
 *      which is stated rather than silently absorbed.
 *
 * TWO MORE LIMITATIONS THE HELD-OUT GRAPH FOUND, which are not predictions of what might go wrong but
 * measurements of what did. Both are consequences of limitation 1 and both are under-predictions, which is
 * the direction that matters:
 *
 *   5. PROJECTION UNLOCKING BYTES ARE NOT A FUNCTION OF PARTICIPANTS AND INVOCATIONS. The projection
 *      verifier is one generated covenant, so its redeem script is fixed and its unlocking bytes are the
 *      transcript it carries - and the transcript carries RESULT PAYLOADS, which the descriptor does not
 *      count. E1 has thirteen rows and a 6,458-byte projection; C3 has sixteen rows and 6,005. The envelope
 *      over rows therefore under-predicted E1 by 1.8%. C2's fixture comment that the projection is "a pure
 *      function of participant and invocation count" is about its INSTRUCTION COUNT, and does not transfer
 *      to its bytes.
 *   6. CONTROLLER DENSITY IS NOT A FUNCTION OF SLOT COUNT ALONE. Slot count is the documented driver of its
 *      output scan, and it is the driver used here, but E1's controller reaches 0.6368x on nineteen slots
 *      where the envelope fitted on A13/C1/C2/C3 predicts less - under by 9.6%. The four calibration graphs
 *      move slots and rows too nearly together to separate the two terms, which is exactly the situation
 *      limitation 1 describes, so no second driver is fitted rather than fitting one through points that do
 *      not separate it.
 */

/** A shape as a user can describe it at plan time. No built transaction is required to fill this in. */
export interface GraphShapeSpec {
  name: string;
  /**
   * `graph` composes masters + one projection proof per participant + one controller + one fee input.
   * `binding` is the participant-binding sweep: masters and one fee input, no projections and no controller.
   */
  family: 'graph' | 'binding';
  participants: number;
  invocations: number;
  /** Balanced block size per participant, from `artifact.blockLayout.blockSize`. Length must be `participants`. */
  blockSizes: number[];
  /** Master redeem script bytes per participant, from the instantiated contract's bytecode length. */
  redeemBytes: number[];
  /**
   * Inputs that perform a signature check. Used for the transaction-wide SigChecks limit; the per-input one
   * assumes ONE check on the smallest signed input, which is what every shape measured does.
   */
  signedInputs?: number;
  /**
   * Unlocking bytes of the SMALLEST signed input, when the caller knows it. Defaults to the calibrated floor.
   * It is a separate field from anything else because the SigChecks allowance grows with input size, so this
   * is the one descriptor field whose conservative direction is DOWN.
   */
  signedInputUnlockingBytes?: number;
}

export interface LimitPrediction {
  limit: string;
  regime: 'consensus' | 'standard';
  predicted: number;
  allowed: number;
  ratio: number;
  where: string;
}

export interface Estimate {
  shape: string;
  inputCount: number;
  outputCount: number;
  serializedBytes: number;
  worstUnlockingBytes: number;
  worstDensityRatio: number;
  worstSigCheckRatio: number;
  /** Every limit, ordered by predicted utilization: the first is the one predicted to bind. */
  limits: LimitPrediction[];
  verdict: 'FITS' | 'OVER';
  /** Non-empty when the shape sits outside the range the coefficients were calibrated on. */
  outOfRange: string[];
  /** Per-input-class byte and cost predictions, so an overrun can be attributed rather than just reported. */
  classes: ClassPrediction[];
}

export interface ClassPrediction {
  klass: InputClass;
  count: number;
  unlockingBytes: number;
  operationCost: number;
  densityRatio: number;
}

export type InputClass = 'master' | 'sidecar' | 'projection' | 'controller' | 'fee';

/* ------------------------------------------------------------------------------------------------------ */
/* Upper-envelope fitting                                                                                   */
/* ------------------------------------------------------------------------------------------------------ */

export interface Envelope {
  intercept: number;
  slope: number;
  /** Largest driver value the envelope was calibrated on; beyond it the line is an extrapolation. */
  maximumDriver: number;
  /** Per-point over-prediction as a fraction of the measured value, on the calibration set. */
  overPrediction: number[];
}

export interface EnvelopePoint { x: number; y: number; label: string }

/**
 * The tightest linear function that lies on or above every calibration point.
 *
 * This is a two-variable linear program - minimise the total prediction subject to `a + b*x >= y` for every
 * point and `b >= 0` - whose optimum always lies on the upper convex hull, so it is solved exactly by
 * enumerating the lines through each pair of points plus the two degenerate families (a horizontal line at
 * the maximum, and a ray through the origin at the maximum rate). No iteration, no tolerance, no fit.
 *
 * `b >= 0` is imposed because every driver here is a size or a count: a negative slope would predict that
 * more participants cost fewer bytes, which is a fitting artifact rather than a model.
 */
export function fitUpperEnvelope(points: EnvelopePoint[], safetyMargin = 0): Envelope {
  if (points.length === 0) throw new Error('F2: cannot fit an envelope to zero points');
  const maximumY = Math.max(...points.map((point) => point.y));
  const maximumDriver = Math.max(...points.map((point) => point.x));
  const candidates: { intercept: number; slope: number }[] = [{ intercept: maximumY, slope: 0 }];
  // The ray through the origin at the steepest rate any point demands. Only defined when every point that
  // needs covering has a positive driver: a point at x = 0 with y > 0 cannot be covered by a ray at all.
  const rates = points.filter((point) => point.x > 0).map((point) => point.y / point.x);
  if (rates.length === points.length && rates.length > 0) {
    candidates.push({ intercept: 0, slope: Math.max(...rates) });
  }
  for (const left of points) {
    for (const right of points) {
      if (left.x === right.x) continue;
      const slope = (right.y - left.y) / (right.x - left.x);
      if (slope < 0) continue;
      candidates.push({ intercept: left.y - slope * left.x, slope });
    }
  }
  let best: { intercept: number; slope: number } | undefined;
  let bestTotal = Infinity;
  for (const candidate of candidates) {
    if (candidate.intercept < 0) continue;
    let dominates = true;
    let total = 0;
    for (const point of points) {
      const predicted = candidate.intercept + candidate.slope * point.x;
      // Strict domination, with a relative tolerance for floating-point residue only.
      if (predicted < point.y - Math.abs(point.y) * 1e-12 - 1e-9) { dominates = false; break; }
      total += predicted;
    }
    if (dominates && total < bestTotal) { bestTotal = total; best = candidate; }
  }
  if (best === undefined) throw new Error('F2: no dominating linear envelope exists for these points');
  const intercept = best.intercept * (1 + safetyMargin);
  const slope = best.slope * (1 + safetyMargin);
  return {
    intercept,
    slope,
    maximumDriver,
    overPrediction: points.map((point) => (intercept + slope * point.x) / point.y - 1),
  };
}

const applyEnvelope = (envelope: Envelope, driver: number): number => envelope.intercept + envelope.slope * driver;

/* ------------------------------------------------------------------------------------------------------ */
/* Calibration coefficients                                                                                 */
/* ------------------------------------------------------------------------------------------------------ */

/**
 * Coefficients that differ between the two families, because the two families build an unlocking script
 * differently. A composed graph's master carries an SCB1 execution blob and a transcript; the binding sweep's
 * carries a three-row blob. Sharing one envelope between them is conservative but so loose it stops being
 * useful, which is a worse failure than being narrow and saying so.
 */
export interface FamilyCalibration {
  /** Master unlocking bytes ABOVE the compiled redeem script - the argument blob - over participants+invocations. */
  masterArgBytes: Envelope;
  /** Worst master operation-cost DENSITY RATIO, over participant count. */
  masterDensity: Envelope;
  /** Total serialized bytes of every output, over the output count. */
  outputsSerialized: Envelope;
}

/**
 * The complete coefficient set. Every field is an upper envelope over the calibration measurements, produced
 * by `deriveCalibration` from measured shapes rather than written by hand, so a re-measurement re-derives it
 * and a drifted coefficient is visible as a changed number rather than as a silently wrong prediction.
 *
 * EVERY COST FIELD IS A DENSITY RATIO, NOT A COST. Bounding a cost above and its density bytes above bounds
 * NOTHING about their quotient - the first version of this file did exactly that and under-predicted C3's
 * density by 22.7% in-sample, because an over-predicted denominator cancelled an over-predicted numerator.
 * The quantity the limit is stated in is the quantity that has to be enveloped.
 */
export interface Calibration {
  graph: FamilyCalibration;
  binding: FamilyCalibration;
  /** Widest sidecar unlocking bytes, over the shape's slot count. Sidecars are heterogeneous; this is their max. */
  sidecarBytes: Envelope;
  /** Total sidecar serialized bytes over sidecar count: the driver of the relay-size result. */
  sidecarSerialized: Envelope;
  /** Worst sidecar density ratio, over slot count. */
  sidecarDensity: Envelope;
  /** Projection unlocking bytes over participants + invocations. */
  projectionBytes: Envelope;
  /** Projection density ratio over participants + invocations: the driver C2's own fixture identifies. */
  projectionDensity: Envelope;
  /** Controller unlocking bytes over participants + invocations. */
  controllerBytes: Envelope;
  /**
   * Controller density ratio over the transaction's total slot count. The controller additionally scans every
   * transaction output, which is why the slot count and not the row count is its driver.
   */
  controllerDensity: Envelope;
  /** Fee-input unlocking bytes: a P2PKH spend, constant across every shape measured. */
  feeBytes: Envelope;
  feeDensity: Envelope;
  /**
   * SMALLEST signed input observed, in unlocking bytes. The per-input SigChecks allowance is
   * `floor((unlockingBytes + 60) / 43)`, so it GROWS with the input, and a conservative prediction of that
   * ratio needs the FLOOR of the signed input's size, not its ceiling. Using the same maximum here as for
   * serialized size would predict a larger allowance than the shape gets, which is the anti-conservative
   * direction on the one limit F1 measured as binding first for the smallest shape.
   */
  signedInputBytesFloor: number;
  /** Calibration provenance, so a quoted prediction can be traced to the run that produced it. */
  basis: { commit: string; shapes: string[] };
}

/* ------------------------------------------------------------------------------------------------------ */
/* Shape geometry                                                                                           */
/* ------------------------------------------------------------------------------------------------------ */

export interface ShapeGeometry {
  masters: number;
  sidecars: number;
  projections: number;
  controllers: number;
  fees: number;
  inputs: number;
  outputs: number;
  slots: number;
}

/**
 * The physical layout `compiledGraphPhysicalLayout` computes, restated as arithmetic on the descriptor. A
 * composed graph is the participants' balanced blocks, then one projection proof each, then the controller,
 * then the fee/change pair - so its input count is a plan-time fact, not a build-time one.
 */
export function shapeGeometry(spec: GraphShapeSpec): ShapeGeometry {
  const blockTotal = spec.blockSizes.reduce((sum, size) => sum + size, 0);
  if (spec.blockSizes.length !== spec.participants || spec.redeemBytes.length !== spec.participants) {
    throw new Error(`F2: ${spec.name} descriptor does not carry one block size and redeem size per participant`);
  }
  if (spec.family === 'binding') {
    return {
      masters: spec.participants,
      sidecars: 0,
      projections: 0,
      controllers: 0,
      fees: 1,
      inputs: spec.participants + 1,
      outputs: spec.participants + 1,
      slots: spec.participants + 1,
    };
  }
  const inputs = blockTotal + spec.participants + 2;
  return {
    masters: spec.participants,
    sidecars: blockTotal - spec.participants,
    projections: spec.participants,
    controllers: 1,
    fees: 1,
    inputs,
    outputs: inputs,
    slots: inputs,
  };
}

/* ------------------------------------------------------------------------------------------------------ */
/* Estimation                                                                                               */
/* ------------------------------------------------------------------------------------------------------ */

const varintLength = (value: number): number => {
  if (value < 0xfd) return 1;
  if (value <= 0xffff) return 3;
  if (value <= 0xffff_ffff) return 5;
  return 9;
};

/** Serialized bytes one input contributes: 32-byte outpoint, 4-byte index, 4-byte sequence, then the script. */
const inputSerializedBytes = (unlocking: number): number => 40 + varintLength(unlocking) + unlocking;

/**
 * Predict where a shape lands, before it is built. Every figure returned is an UPPER bound under the
 * calibration; `outOfRange` names each driver pushed past the range the coefficients were derived on, and a
 * caller that treats an out-of-range estimate as authoritative has been told not to.
 */
export function estimate(spec: GraphShapeSpec, calibration: Calibration): Estimate {
  const geometry = shapeGeometry(spec);
  const family = calibration[spec.family];
  const rows = spec.participants + spec.invocations;
  // Deduplicated: several classes share a driver, and reporting "participants + invocations 32 exceeds ..."
  // twice tells the reader there are two problems when there is one.
  const outOfRangeSet = new Set<string>();
  const check = (driver: number, envelope: Envelope, what: string): void => {
    if (driver > envelope.maximumDriver) {
      outOfRangeSet.add(`${what} ${driver} exceeds the calibrated maximum ${envelope.maximumDriver}`);
    }
  };
  const classes: ClassPrediction[] = [];
  const push = (klass: InputClass, count: number, unlockingBytes: number, ratio: number): void => {
    classes.push({
      klass,
      count,
      unlockingBytes,
      densityRatio: ratio,
      operationCost: ratio * (unlockingBytes + BCH_2026_CONSENSUS.densityControlBaseLength)
        * BCH_2026_CONSENSUS.operationCostBudgetPerByte,
    });
  };

  check(rows, family.masterArgBytes, 'participants + invocations');
  check(spec.participants, family.masterDensity, 'participant count');
  const argBytes = applyEnvelope(family.masterArgBytes, rows);
  const masterBytes = spec.redeemBytes.map((redeem) => redeem + argBytes);
  push('master', geometry.masters, Math.max(...masterBytes),
    applyEnvelope(family.masterDensity, spec.participants));

  const feeBytes = applyEnvelope(calibration.feeBytes, 0);
  push('fee', geometry.fees, feeBytes, applyEnvelope(calibration.feeDensity, 0));

  let sidecarSerialized = 0;
  if (geometry.sidecars > 0) {
    check(geometry.slots, calibration.sidecarBytes, 'slot count');
    check(geometry.sidecars, calibration.sidecarSerialized, 'sidecar count');
    push('sidecar', geometry.sidecars, applyEnvelope(calibration.sidecarBytes, geometry.slots),
      applyEnvelope(calibration.sidecarDensity, geometry.slots));
    sidecarSerialized = applyEnvelope(calibration.sidecarSerialized, geometry.sidecars);
  }
  if (geometry.projections > 0) {
    check(rows, calibration.projectionBytes, 'participants + invocations');
    push('projection', geometry.projections, applyEnvelope(calibration.projectionBytes, rows),
      applyEnvelope(calibration.projectionDensity, rows));
  }
  if (geometry.controllers > 0) {
    check(geometry.slots, calibration.controllerDensity, 'slot count');
    push('controller', geometry.controllers, applyEnvelope(calibration.controllerBytes, rows),
      applyEnvelope(calibration.controllerDensity, geometry.slots));
  }

  const byClass = new Map(classes.map((row) => [row.klass, row]));
  check(geometry.outputs, family.outputsSerialized, 'output count');
  const serializedBytes = 4 + varintLength(geometry.inputs) + varintLength(geometry.outputs) + 4
    + masterBytes.reduce((sum, bytes) => sum + inputSerializedBytes(bytes), 0)
    + inputSerializedBytes(feeBytes)
    + sidecarSerialized
    + geometry.projections * inputSerializedBytes(byClass.get('projection')?.unlockingBytes ?? 0)
    + geometry.controllers * inputSerializedBytes(byClass.get('controller')?.unlockingBytes ?? 0)
    + applyEnvelope(family.outputsSerialized, geometry.outputs);

  const worstUnlockingBytes = Math.max(...classes.map((row) => row.unlockingBytes));
  const worstDensity = classes.reduce((best, row) => (row.densityRatio > best.densityRatio ? row : best));
  // Per-input SigChecks: the allowance is `floor((unlockingBytes + 60) / 43)`, so it GROWS with the input and
  // the tightest signed input is the SMALLEST one. ONE CHECK ON THAT INPUT is the assumption, and it is what
  // every shape measured does - including the held-out graph, which signs six inputs rather than one but
  // performs exactly one check on each, all of them 126-byte P2PKH spends at 0.2500x. A shape that puts
  // several checks on one small input is outside this and would be under-predicted; `signedInputs` counts
  // them for the transaction-wide limit but does not change the per-input one.
  const signed = spec.signedInputs ?? 1;
  const signedBytes = spec.signedInputUnlockingBytes ?? calibration.signedInputBytesFloor;
  const sigCheckLimit = Math.max(1, Math.floor((signedBytes + 60) / 43));
  const worstSigCheckRatio = signed > 0 ? 1 / sigCheckLimit : 0;

  const limits: LimitPrediction[] = [
    {
      limit: 'standard relay transaction size',
      regime: 'standard',
      predicted: serializedBytes,
      allowed: BCH_2026_STANDARD.maximumTransactionSize,
      ratio: serializedBytes / BCH_2026_STANDARD.maximumTransactionSize,
      where: 'transaction',
    },
    {
      limit: 'consensus transaction size',
      regime: 'consensus',
      predicted: serializedBytes,
      allowed: BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
      ratio: serializedBytes / BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
      where: 'transaction',
    },
    {
      limit: 'unlocking bytecode length',
      regime: 'consensus',
      predicted: worstUnlockingBytes,
      allowed: BCH_2026_CONSENSUS.maximumBytecodeLength,
      ratio: worstUnlockingBytes / BCH_2026_CONSENSUS.maximumBytecodeLength,
      where: classes.find((row) => row.unlockingBytes === worstUnlockingBytes)!.klass,
    },
    {
      limit: 'operation-cost density',
      regime: 'standard',
      predicted: worstDensity.operationCost,
      allowed: (worstDensity.unlockingBytes + BCH_2026_CONSENSUS.densityControlBaseLength)
        * BCH_2026_CONSENSUS.operationCostBudgetPerByte,
      ratio: worstDensity.densityRatio,
      where: worstDensity.klass,
    },
    {
      limit: 'per-input SigChecks',
      regime: 'consensus',
      predicted: signed > 0 ? 1 : 0,
      allowed: sigCheckLimit,
      ratio: worstSigCheckRatio,
      where: 'fee',
    },
    {
      limit: 'transaction SigChecks',
      regime: 'consensus',
      predicted: signed,
      allowed: BCH_2026_CONSENSUS.maximumTransactionSignatureChecks,
      ratio: signed / BCH_2026_CONSENSUS.maximumTransactionSignatureChecks,
      where: 'transaction',
    },
  ].sort((left, right) => right.ratio - left.ratio);

  return {
    shape: spec.name,
    inputCount: geometry.inputs,
    outputCount: geometry.outputs,
    serializedBytes,
    worstUnlockingBytes,
    worstDensityRatio: worstDensity.densityRatio,
    worstSigCheckRatio,
    limits,
    verdict: limits[0].ratio > 1 ? 'OVER' : 'FITS',
    outOfRange: [...outOfRangeSet],
    classes,
  };
}

/* ------------------------------------------------------------------------------------------------------ */
/* Calibration from measurements                                                                            */
/* ------------------------------------------------------------------------------------------------------ */

/**
 * A shape as MEASURED, distilled to exactly the quantities calibration and the error table consume. The full
 * per-input record for C3 is 108 rows; keeping the distillate rather than the dump keeps a committed basis
 * reviewable, and the distillation is code (`distill`) rather than transcription.
 *
 * Every number here is a measurement. Nothing here is ever fed to `estimate`, which sees only `spec`.
 */
export interface MeasuredShape {
  name: string;
  spec: GraphShapeSpec;
  inputCount: number;
  outputCount: number;
  serializedBytes: number;
  maximumOutputSerializedBytes: number;
  totalOutputSerializedBytes: number;
  masters: { redeemBytes: number; unlockingBytes: number; standardCost: number }[];
  sidecars?: {
    count: number;
    maximumUnlockingBytes: number;
    totalSerializedBytes: number;
    worstCostUnlockingBytes: number;
    worstCostStandardCost: number;
  };
  projections?: { count: number; unlockingBytes: number; maximumStandardCost: number };
  controller?: { unlockingBytes: number; standardCost: number };
  fee: { unlockingBytes: number; standardCost: number; signatureChecks: number };
  worstUnlockingBytes: number;
  worstDensityRatio: number;
  worstSigCheckRatio: number;
  bindingLimit: string;
  bindingRatio: number;
  refusedAtConsensus: number;
  refusedAtStandard: number;
  knobControlBites: boolean;
}

/** Turn one measured envelope plus its recovered classification into a calibration sample. */
export function distill(
  envelope: EnvelopeMeasurement,
  classification: InputClassification,
  name: string,
  invocations: number,
  knobControlBites: boolean,
): MeasuredShape {
  const at = (index: number): InputMeasurement => envelope.inputs[index];
  const spec: GraphShapeSpec = {
    name,
    family: classification.family,
    participants: classification.masters.length,
    invocations,
    blockSizes: classification.blockSizes,
    redeemBytes: classification.redeemBytes,
    signedInputs: envelope.inputs.filter((row) => row.signatureChecks > 0).length,
  };
  const sidecarRows = classification.sidecars.map(at);
  const worstSidecar = sidecarRows.length === 0
    ? undefined
    : sidecarRows.reduce((left, right) => (right.standardCostRatio > left.standardCostRatio ? right : left));
  const projectionRows = classification.projections.map(at);
  return {
    name,
    spec,
    inputCount: envelope.inputCount,
    outputCount: envelope.outputCount,
    serializedBytes: envelope.serializedBytes,
    maximumOutputSerializedBytes: Math.max(...envelope.outputSerializedBytes),
    totalOutputSerializedBytes: envelope.outputSerializedBytes.reduce((sum, bytes) => sum + bytes, 0),
    masters: classification.masters.map((index, position) => ({
      redeemBytes: classification.redeemBytes[position],
      unlockingBytes: at(index).unlockingBytes,
      standardCost: at(index).standardCost,
    })),
    sidecars: sidecarRows.length === 0 ? undefined : {
      count: sidecarRows.length,
      maximumUnlockingBytes: Math.max(...sidecarRows.map((row) => row.unlockingBytes)),
      totalSerializedBytes: classification.sidecars
        .reduce((sum, index) => sum + envelope.inputSerializedBytes[index], 0),
      worstCostUnlockingBytes: worstSidecar!.unlockingBytes,
      worstCostStandardCost: worstSidecar!.standardCost,
    },
    projections: projectionRows.length === 0 ? undefined : {
      count: projectionRows.length,
      unlockingBytes: Math.max(...projectionRows.map((row) => row.unlockingBytes)),
      maximumStandardCost: Math.max(...projectionRows.map((row) => row.standardCost)),
    },
    controller: classification.controller === undefined ? undefined : {
      unlockingBytes: at(classification.controller).unlockingBytes,
      standardCost: at(classification.controller).standardCost,
    },
    fee: {
      unlockingBytes: at(classification.fee).unlockingBytes,
      standardCost: at(classification.fee).standardCost,
      signatureChecks: at(classification.fee).signatureChecks,
    },
    worstUnlockingBytes: envelope.worstUnlockingInput.unlockingBytes,
    worstDensityRatio: envelope.worstCostInput.standardCostRatio,
    worstSigCheckRatio: Math.max(...envelope.inputs.map((row) => row.signatureCheckRatio)),
    bindingLimit: envelope.binding[0].limit,
    bindingRatio: envelope.binding[0].ratio,
    refusedAtConsensus: envelope.refusedAtConsensus.length,
    refusedAtStandard: envelope.refusedAtStandard.length,
    knobControlBites,
  };
}

const densityOf = (cost: number, unlockingBytes: number): number =>
  cost / ((unlockingBytes + BCH_2026_CONSENSUS.densityControlBaseLength)
    * BCH_2026_CONSENSUS.operationCostBudgetPerByte);

/**
 * Derive every coefficient from measured shapes. Each envelope dominates its own calibration points by
 * construction; `calibrate` then re-checks the ASSEMBLED prediction against the same measurements, which is a
 * different and stronger statement, because a per-class envelope can dominate every class and still
 * under-predict a total if the assembly arithmetic is wrong.
 *
 * A family with no samples gets a zero envelope rather than a thrown error, so that a leave-one-out run that
 * happens to empty a family still produces a row instead of failing the whole exercise. Such a row predicts
 * zero and is reported as an under-prediction, which is the honest outcome.
 */
export function deriveCalibration(
  samples: MeasuredShape[], commit: string, safetyMargin = 0,
): Calibration {
  const empty: EnvelopePoint[] = [{ x: 0, y: 0, label: 'no samples' }];
  const perFamily = (family: 'graph' | 'binding'): FamilyCalibration => {
    const rows = samples.filter((sample) => sample.spec.family === family);
    const argPoints: EnvelopePoint[] = [];
    const densityPoints: EnvelopePoint[] = [];
    const outputPoints: EnvelopePoint[] = [];
    for (const sample of rows) {
      const driver = sample.spec.participants + sample.spec.invocations;
      for (const master of sample.masters) {
        argPoints.push({
          x: driver, y: master.unlockingBytes - master.redeemBytes, label: `${sample.name}/master-args`,
        });
        densityPoints.push({
          x: sample.spec.participants,
          y: densityOf(master.standardCost, master.unlockingBytes),
          label: `${sample.name}/master-density`,
        });
      }
      outputPoints.push({
        x: sample.outputCount, y: sample.totalOutputSerializedBytes, label: `${sample.name}/outputs`,
      });
    }
    return {
      masterArgBytes: fitUpperEnvelope(argPoints.length === 0 ? empty : argPoints, safetyMargin),
      masterDensity: fitUpperEnvelope(densityPoints.length === 0 ? empty : densityPoints, safetyMargin),
      outputsSerialized: fitUpperEnvelope(outputPoints.length === 0 ? empty : outputPoints, safetyMargin),
    };
  };

  const sidecarBytePoints: EnvelopePoint[] = [];
  const sidecarSerializedPoints: EnvelopePoint[] = [];
  const sidecarDensityPoints: EnvelopePoint[] = [];
  const projectionBytePoints: EnvelopePoint[] = [];
  const projectionDensityPoints: EnvelopePoint[] = [];
  const controllerBytePoints: EnvelopePoint[] = [];
  const controllerDensityPoints: EnvelopePoint[] = [];
  const feeBytePoints: EnvelopePoint[] = [];
  const feeDensityPoints: EnvelopePoint[] = [];

  for (const sample of samples) {
    const { spec } = sample;
    const rows = spec.participants + spec.invocations;
    const geometry = shapeGeometry(spec);
    if (sample.sidecars !== undefined) {
      sidecarBytePoints.push({
        x: geometry.slots, y: sample.sidecars.maximumUnlockingBytes, label: `${spec.name}/sidecar-bytes`,
      });
      sidecarSerializedPoints.push({
        x: sample.sidecars.count,
        y: sample.sidecars.totalSerializedBytes,
        label: `${spec.name}/sidecar-serialized`,
      });
      sidecarDensityPoints.push({
        x: geometry.slots,
        y: densityOf(sample.sidecars.worstCostStandardCost, sample.sidecars.worstCostUnlockingBytes),
        label: `${spec.name}/sidecar-density`,
      });
    }
    if (sample.projections !== undefined) {
      projectionBytePoints.push({ x: rows, y: sample.projections.unlockingBytes, label: `${spec.name}/projection` });
      projectionDensityPoints.push({
        x: rows,
        y: densityOf(sample.projections.maximumStandardCost, sample.projections.unlockingBytes),
        label: `${spec.name}/projection-density`,
      });
    }
    if (sample.controller !== undefined) {
      controllerBytePoints.push({ x: rows, y: sample.controller.unlockingBytes, label: `${spec.name}/controller` });
      controllerDensityPoints.push({
        x: geometry.slots,
        y: densityOf(sample.controller.standardCost, sample.controller.unlockingBytes),
        label: `${spec.name}/controller-density`,
      });
    }
    feeBytePoints.push({ x: 0, y: sample.fee.unlockingBytes, label: `${spec.name}/fee` });
    feeDensityPoints.push({
      x: 0, y: densityOf(sample.fee.standardCost, sample.fee.unlockingBytes), label: `${spec.name}/fee-density`,
    });
  }

  const fit = (points: EnvelopePoint[]): Envelope =>
    fitUpperEnvelope(points.length === 0 ? empty : points, safetyMargin);
  return {
    graph: perFamily('graph'),
    binding: perFamily('binding'),
    sidecarBytes: fit(sidecarBytePoints),
    sidecarSerialized: fit(sidecarSerializedPoints),
    sidecarDensity: fit(sidecarDensityPoints),
    projectionBytes: fit(projectionBytePoints),
    projectionDensity: fit(projectionDensityPoints),
    controllerBytes: fit(controllerBytePoints),
    controllerDensity: fit(controllerDensityPoints),
    feeBytes: fit(feeBytePoints),
    feeDensity: fit(feeDensityPoints),
    signedInputBytesFloor: Math.min(...samples.map((sample) => sample.fee.unlockingBytes)),
    basis: { commit, shapes: samples.map((sample) => sample.name) },
  };
}

/* ------------------------------------------------------------------------------------------------------ */
/* Calibration report                                                                                       */
/* ------------------------------------------------------------------------------------------------------ */

export interface CalibrationRow {
  shape: string;
  limit: string;
  predicted: number;
  measured: number;
  /** Positive means over-prediction, which is the safe direction. Negative is an UNDER-prediction. */
  error: number;
  conservative: boolean;
  /** Drivers this shape pushed past the calibrated range. A miss on a flagged row is a declared limitation. */
  outOfRange: string[];
}

const measuredFor = (shape: MeasuredShape, limit: string): number => {
  switch (limit) {
    case 'serialized bytes': return shape.serializedBytes;
    case 'worst unlocking bytes': return shape.worstUnlockingBytes;
    case 'worst density ratio': return shape.worstDensityRatio;
    case 'worst SigChecks ratio': return shape.worstSigCheckRatio;
    default: throw new Error(`F2: no measured value for '${limit}'`);
  }
};

const predictedFor = (prediction: Estimate, limit: string): number => {
  switch (limit) {
    case 'serialized bytes': return prediction.serializedBytes;
    case 'worst unlocking bytes': return prediction.worstUnlockingBytes;
    case 'worst density ratio': return prediction.worstDensityRatio;
    case 'worst SigChecks ratio': return prediction.worstSigCheckRatio;
    default: throw new Error(`F2: no prediction for '${limit}'`);
  }
};

export const CALIBRATED_LIMITS = [
  'serialized bytes', 'worst unlocking bytes', 'worst density ratio', 'worst SigChecks ratio',
] as const;

/**
 * Predicted against measured, per limit, per shape. This is the whole claim: an estimator is worth exactly
 * its error table and nothing else.
 */
export function calibrate(samples: MeasuredShape[], calibration: Calibration): CalibrationRow[] {
  const report: CalibrationRow[] = [];
  for (const sample of samples) {
    const prediction = estimate(sample.spec, calibration);
    for (const limit of CALIBRATED_LIMITS) {
      const predicted = predictedFor(prediction, limit);
      const measured = measuredFor(sample, limit);
      report.push({
        shape: sample.name,
        limit,
        predicted,
        measured,
        error: measured === 0 ? 0 : predicted / measured - 1,
        conservative: predicted >= measured - Math.abs(measured) * 1e-9,
        outOfRange: prediction.outOfRange,
      });
    }
  }
  return report;
}

/* ------------------------------------------------------------------------------------------------------ */
/* Recovering the descriptor from a built transaction                                                       */
/* ------------------------------------------------------------------------------------------------------ */

/**
 * Length of the LAST pushed item of an unlocking bytecode: for any P2SH spend that is the redeem script, and
 * for a Layer-3 participant that is exactly `contract.bytecode.length` - the estimator's declared compile-time
 * input. Recovering it from the transaction is what lets a capstone whose builder is not exported serve as a
 * calibration sample without the estimator ever being handed a measured cost or a measured transaction size.
 *
 * Returns 0 when the script is not a pure push sequence, which fails classification closed rather than
 * guessing a length.
 */
export function redeemScriptLength(unlockingBytecode: Uint8Array): number {
  let cursor = 0;
  let last = 0;
  while (cursor < unlockingBytecode.length) {
    const opcode = unlockingBytecode[cursor];
    cursor += 1;
    let length: number;
    if (opcode === 0x00) length = 0;
    else if (opcode <= 0x4b) length = opcode;
    else if (opcode === 0x4c) {
      length = unlockingBytecode[cursor];
      cursor += 1;
    } else if (opcode === 0x4d) {
      length = unlockingBytecode[cursor] | (unlockingBytecode[cursor + 1] << 8);
      cursor += 2;
    } else if (opcode === 0x4e) {
      length = unlockingBytecode[cursor] | (unlockingBytecode[cursor + 1] << 8)
        | (unlockingBytecode[cursor + 2] << 16) | (unlockingBytecode[cursor + 3] << 24);
      cursor += 4;
    } else if (opcode === 0x4f || (opcode >= 0x51 && opcode <= 0x60)) length = 0;
    else return 0;
    if (Number.isNaN(length) || cursor + length > unlockingBytecode.length) return 0;
    last = length;
    cursor += length;
  }
  return last;
}

export interface InputClassification {
  family: 'graph' | 'binding';
  masters: number[];
  projections: number[];
  controller?: number;
  fee: number;
  sidecars: number[];
  /** Balanced block size per participant, i.e. `artifact.blockLayout.blockSize`, recovered from the layout. */
  blockSizes: number[];
  /** Per-participant redeem script bytes, recovered exactly from the unlocking bytecode. */
  redeemBytes: number[];
}

/**
 * Recover the physical layout from a built transaction, mechanically and fail-closed.
 *
 * The rule is the layout `compiledGraphPhysicalLayout` computes, read backwards: fee last, controller before
 * it, then one projection proof per participant - which are the one run of consecutive inputs sharing a single
 * redeem script, because the projection verifier is ONE generated covenant instantiated per participant. What
 * remains is the participants' balanced blocks, whose masters are the block starts.
 *
 * Masters are separated from sidecars by redeem length, and the separation is REQUIRED to be clean: the
 * smallest master must be strictly larger than the largest sidecar, and the master count must equal the
 * projection count found independently. If either check fails this throws rather than returning a guess.
 */
export function classifyInputs(
  envelope: Pick<EnvelopeMeasurement, 'inputs' | 'inputCount'>, redeemBytes: number[],
): InputClassification {
  const total = envelope.inputCount;
  if (total < 2) throw new Error('F2: cannot classify a transaction with fewer than two inputs');
  const fee = total - 1;
  const feeRow = envelope.inputs[fee];
  if (feeRow.signatureChecks < 1) throw new Error('F2: the last input is not a signing fee input');
  // The binding sweep has no projections and no controller: every non-fee input is a master of one contract.
  const prefixRedeem = redeemBytes.slice(0, fee);
  if (prefixRedeem.length > 0 && prefixRedeem.every((length) => length === prefixRedeem[0] && length > 0)) {
    return {
      family: 'binding',
      masters: prefixRedeem.map((_length, index) => index),
      projections: [],
      fee,
      sidecars: [],
      blockSizes: prefixRedeem.map(() => 1),
      redeemBytes: prefixRedeem,
    };
  }
  const controller = total - 2;
  let projectionStart = controller;
  while (projectionStart > 0 && redeemBytes[projectionStart - 1] === redeemBytes[controller - 1]
    && redeemBytes[controller - 1] > 0) {
    projectionStart -= 1;
  }
  const projections: number[] = [];
  for (let index = projectionStart; index < controller; index += 1) projections.push(index);
  if (projections.length === 0) throw new Error('F2: found no projection run before the controller');
  const prefix = projectionStart;
  const candidates = Array.from({ length: prefix }, (_value, index) => index)
    .sort((left, right) => redeemBytes[right] - redeemBytes[left]);
  const masters = candidates.slice(0, projections.length).sort((left, right) => left - right);
  const sidecars = candidates.slice(projections.length).sort((left, right) => left - right);
  const smallestMaster = Math.min(...masters.map((index) => redeemBytes[index]));
  const largestSidecar = sidecars.length === 0 ? 0 : Math.max(...sidecars.map((index) => redeemBytes[index]));
  if (smallestMaster <= largestSidecar) {
    throw new Error(
      `F2: master and sidecar redeem sizes do not separate (${smallestMaster} <= ${largestSidecar})`,
    );
  }
  if (masters[0] !== 0) throw new Error(`F2: input 0 is not a master (masters are ${masters.join(',')})`);
  const blockSizes = masters.map(
    (start, index) => (index + 1 < masters.length ? masters[index + 1] : prefix) - start,
  );
  return {
    family: 'graph',
    masters,
    projections,
    controller,
    fee,
    sidecars,
    blockSizes,
    redeemBytes: masters.map((index) => redeemBytes[index]),
  };
}

/** One console line per calibration row, in the order the board's tables read. */
export function formatCalibrationRow(row: CalibrationRow): string {
  const format = (value: number): string => (Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(4));
  return [
    row.shape.padEnd(26),
    row.limit.padEnd(22),
    `predicted=${format(row.predicted).padStart(9)}`,
    `measured=${format(row.measured).padStart(9)}`,
    `error=${(row.error * 100 >= 0 ? '+' : '')}${(row.error * 100).toFixed(1)}%`,
    row.conservative ? 'CONSERVATIVE' : 'UNDER-PREDICTS',
    row.outOfRange.length === 0 ? 'in-range' : `OUT-OF-RANGE(${row.outOfRange.length})`,
  ].join(' | ');
}

export function formatEstimate(prediction: Estimate): string {
  const first = prediction.limits[0];
  return [
    prediction.shape,
    `inputs=${prediction.inputCount}`,
    `serialized<=${prediction.serializedBytes.toFixed(0)}B`,
    `worstScript<=${prediction.worstUnlockingBytes.toFixed(0)}B`,
    `worstDensity<=${prediction.worstDensityRatio.toFixed(4)}x`,
    `binds=${first.limit} ${first.ratio.toFixed(4)}x at ${first.where}`,
    prediction.verdict,
    prediction.outOfRange.length === 0 ? 'in-range' : `OUT-OF-RANGE(${prediction.outOfRange.length})`,
  ].join(' | ');
}
