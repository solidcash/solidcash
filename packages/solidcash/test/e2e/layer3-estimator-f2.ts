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
 *      count. E1 carries 1,787 blob bytes over thirteen rows where C1 carries 1,323 over eleven, so the blob
 *      rate is not bounded by the calibration and E1 is still under-predicted, now by 3.5%. What HAS been
 *      fixed is the part that was arithmetic rather than payload: the 4,542-byte redeem script is carried as
 *      a constant instead of fitted. C2's fixture comment that the projection is "a pure function of
 *      participant and invocation count" is about its INSTRUCTION COUNT, and does not transfer to its bytes.
 *   6. CONTROLLER DENSITY IS NOT A FUNCTION OF SLOT COUNT. FIXED, by re-driving it on rows. F2 drove it on
 *      slots and missed E1 by 9.6%; the quantity is not even monotone in slots (E1 reaches 0.6368x on
 *      nineteen where C1 reaches 0.6182x on thirty-eight), and it IS ordered by rows, which is also the
 *      mechanism - the controller's unlocking bytecode is the transcript. Re-driven, E1 is predicted 0.8049x
 *      against 0.6368x measured.
 *
 * AND THREE X70 FOUND, on forty-five real corpus contracts built as one-participant graphs. All three are
 * fixed; the last one only halfway, and the half that is not fixed is stated rather than papered over:
 *
 *   7. AN UPPER ENVELOPE BOUNDS NOTHING BELOW ITS SMALLEST CALIBRATION POINT, and F2 flagged only the upper
 *      end. Fixed by `applyEnvelope`, which returns the measurement at the smallest calibrated driver, and by
 *      `check`, which now reports both ends.
 *   8. A FITTED LINE CAN PREDICT A P2SH INPUT SHORTER THAN THE SCRIPT IT REDEEMS. F2's projection coefficient
 *      had an intercept of 4,095 for a 4,542-byte covenant. Fixed structurally - the covenant redeem is a
 *      descriptor constant and only the argument blob is fitted - and backstopped arithmetically.
 *   9. RANKING UPPER BOUNDS OF DIFFERENT TIGHTNESS DOES NOT RANK LIMITS. The master-density coefficient
 *      over-predicts its own calibration points by up to 284% and the corpus by up to 601%, because nothing
 *      in the descriptor separates contract bodies; the script-byte coefficient over-predicts by at most 10%.
 *      So 0.5758x is named ahead of 0.5002x on a population that measures 0.2177x and 0.4651x. NOT FIXED - it
 *      needs per-contract cost measurements, not another fit - and `bindingUnresolved` now reports the set
 *      the ranking cannot separate, which contained the true binder on all forty-five.
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
  /**
   * Compiled redeem-script bytes of the generated projection verifier and root controller, when the caller
   * has them. Both are one compile away - `new Contract(compileString(layer3.generateGraphProjectionVerifier()),
   * []).bytecode.length / 2` - so they are inside the stated input boundary: a compile, no UTXO, no builder,
   * no VM. Defaulted from the calibration when absent, which is a STALE default the moment either covenant
   * moves, so a caller measuring a commit other than the calibration's should pass them.
   */
  projectionRedeemBytes?: number;
  controllerRedeemBytes?: number;
}

export interface LimitPrediction {
  limit: string;
  regime: 'consensus' | 'standard';
  predicted: number;
  allowed: number;
  ratio: number;
  where: string;
  /**
   * The SAME limit with each coefficient's demonstrated over-prediction taken back out - the de-biased ratio
   * the limits are RANKED by. `ratio` stays the conservative upper bound and is what every verdict, every
   * published magnitude and every screening threshold reads; this exists only to order them. See
   * `ratioFloorOf` for what is discounted and what is not.
   */
  ratioFloor: number;
}

export interface Estimate {
  shape: string;
  inputCount: number;
  outputCount: number;
  serializedBytes: number;
  worstUnlockingBytes: number;
  worstDensityRatio: number;
  worstSigCheckRatio: number;
  /**
   * Every limit, ordered by DE-BIASED utilization (`ratioFloor`): the first is the one predicted to bind.
   *
   * X78: ordering these by `ratio` ranked upper bounds of wildly different tightness against each other, and
   * an upper bound that is 284% loose is not evidence that it is the larger quantity. On the forty-five
   * corpus contracts that named density on 45/45 where script bytes bound on 45/45. Ordering by the de-biased
   * ratio names the measured binder on 45/45 of the corpus, on the four capstones and on the held-out graph.
   * `worstRatio` below, NOT `limits[0].ratio`, is the conservative headline.
   */
  limits: LimitPrediction[];
  /**
   * The largest PREDICTED ratio over every limit - the conservative headline, and the quantity the verdict is
   * taken from. It was `limits[0].ratio` before the ranking changed; it is a named field now so that
   * re-ordering the list can never quietly weaken a capacity claim.
   */
  worstRatio: number;
  /**
   * Limits that CANNOT BE RULED OUT as the real binder, the leader included. Ranking upper bounds is only
   * sound when they are equally tight, and here they are not: the master-density coefficient over-predicts
   * its own calibration points by up to 284% while the script-byte coefficient over-predicts by at most 10%,
   * so the larger of the two numbers is not the closer of the two limits.
   *
   * INTERVAL DOMINANCE, which is what a set of bounds can honestly say. Each limit occupies
   * `[ratioFloor, ratio]`. A limit is RULED OUT only when its whole interval lies below some other limit's
   * floor, so the set is every limit whose `ratio` reaches the largest `ratioFloor` on the shape. X70
   * compared against the LEADER's floor alone, which on the corpus rows was the loosest floor of the six and
   * left three limits unresolved where two is what the arithmetic supports.
   */
  bindingUnresolved: string[];
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
  /** Largest over-prediction the byte coefficient behind `unlockingBytes` showed on the calibration set. */
  bytesSlack: number;
  /** Largest over-prediction the density coefficient behind `densityRatio` showed on the calibration set. */
  densitySlack: number;
  /**
   * The part of `unlockingBytes` that is a DESCRIPTOR CONSTANT rather than a fitted quantity: the compiled
   * redeem script this input pushes. Zero for a class with no redeem term of its own. It is carried
   * separately because it is exact, so no slack may be discounted from it - a P2SH input can no more be
   * shorter than the script it redeems in a de-biased estimate than in a conservative one.
   */
  exactBytes: number;
  /** `unlockingBytes` with the byte coefficient's demonstrated local over-prediction taken back out. */
  bytesFloor: number;
  /** `densityRatio` with the density coefficient's demonstrated local over-prediction taken back out. */
  densityFloor: number;
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
  /**
   * SMALLEST driver value the envelope was calibrated on. Below it the line is an extrapolation TOO, and that
   * is the direction F2 shipped blind to: `check` flagged only the upper end, and `applyEnvelope` evaluated
   * the line wherever it was asked. See `applyEnvelope` for what is done about it and why that is sound.
   */
  minimumDriver: number;
  /** Largest MEASURED value at `minimumDriver`. The bound `applyEnvelope` returns below the range. */
  minimumValue: number;
  /** Per-point over-prediction as a fraction of the measured value, on the calibration set. */
  overPrediction: number[];
  /**
   * Driver value of each calibration point, parallel to `overPrediction`.
   *
   * Retained because the MAXIMUM over-prediction is the wrong number to de-bias a prediction with: it is the
   * slack at the loosest point on the whole calibration set, wherever that point sits. `localSlack` uses
   * these to read the slack the envelope demonstrated AT the driver being predicted, which at a calibration
   * driver is that point's own slack and is zero wherever the envelope touches the measurement.
   */
  drivers: number[];
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
  const minimumDriver = Math.min(...points.map((point) => point.x));
  const atMinimum = points.filter((point) => point.x === minimumDriver).map((point) => point.y);
  return {
    intercept,
    slope,
    maximumDriver,
    minimumDriver,
    minimumValue: Math.max(...atMinimum) * (1 + safetyMargin),
    overPrediction: points.map((point) => (intercept + slope * point.x) / point.y - 1),
    drivers: points.map((point) => point.x),
  };
}

/**
 * The over-prediction this envelope DEMONSTRATED at the driver being predicted, or `undefined` outside the
 * calibrated range, where it demonstrated nothing.
 *
 * WHY LOCAL AND NOT THE MAXIMUM. `slackOf` reports the loosest point on the whole calibration set. Discounting
 * by it says "this coefficient can be 284% loose", which is true SOMEWHERE and false at the point being
 * predicted: the controller-density envelope is exact on C2 and 30.8% loose on another shape, so de-biasing
 * C2's own prediction by 30.8% pushes a limit that binds exactly below one that does not. The bracketing
 * points - the nearest calibration driver at or below, and the nearest at or above - are the two the
 * prediction actually sits between, and at an exact calibration driver they collapse to that driver's points.
 *
 * OUTSIDE THE RANGE IT RETURNS `undefined`, and the caller floors the fitted part at zero. That is not
 * pessimism for its own sake: below the calibrated minimum `applyEnvelope` returns a MEASUREMENT taken at a
 * larger driver and `applyBodyEnvelope` returns a line no measurement covers, so the calibration bounds the
 * true value from above and says nothing whatever about how small it can be. The corpus is the demonstration:
 * the projection blob is clamped to 460 bytes where the built graphs carry 109.
 *
 * THIS IS A RANKING HEURISTIC AND IS LABELLED ONE. Nothing conservative rests on it - `ratio`, `predicted`,
 * `serializedBytes`, `worstUnlockingBytes`, `worstRatio` and `verdict` are all untouched upper bounds. What it
 * decides is which limit is NAMED first and which limits stay in `bindingUnresolved`.
 */
const localSlack = (envelope: Envelope, driver: number): number | undefined => {
  if (driver < envelope.minimumDriver || driver > envelope.maximumDriver) return undefined;
  let below = -Infinity;
  let above = Infinity;
  for (const x of envelope.drivers) {
    if (x <= driver && x > below) below = x;
    if (x >= driver && x < above) above = x;
  }
  let worst = 0;
  envelope.drivers.forEach((x, index) => {
    if (x === below || x === above) worst = Math.max(worst, envelope.overPrediction[index]);
  });
  return worst;
};

/** A fitted quantity with its local slack taken back out; the exact part is never discounted. */
const deBias = (predicted: number, exact: number, slack: number | undefined): number =>
  exact + (slack === undefined ? 0 : Math.max(0, predicted - exact) / (1 + slack));

/**
 * Evaluate an envelope. BELOW THE CALIBRATED RANGE IT RETURNS THE MEASURED VALUE AT THE SMALLEST CALIBRATED
 * DRIVER RATHER THAN THE FITTED LINE. This is the X70 fix, and the reasoning is the whole of its warrant.
 *
 * "Upper envelope" is a statement about the calibration points and nothing else: the line lies on or above
 * every one of them. Between them it can dip below the true curve (F2 measured that at -0.31% on an
 * interpolated density), and OUTSIDE them it carries no relation to the curve at all. F2 flagged the upper
 * end and evaluated the line wherever it was asked, so a driver BELOW the calibrated range was extrapolated
 * silently - and the linear program that fits these lines actively pushes them into that error, because it
 * minimises total predicted value over points that all sit at the high end, which buys a small intercept with
 * a large slope. F3 then built forty-five one-participant graphs, whose driver is 2 against a calibrated
 * minimum of 6, and the projection term extrapolated to 4,441 bytes for an input whose redeem script ALONE is
 * 4,542. All forty-five were under-predicted on the limit that actually bound them.
 *
 * WHY THE MEASURED POINT AND NOT THE LINE AT THAT POINT. Every driver here is a count or a size and every
 * quantity modelled against it is monotone non-decreasing in it: more participants, more invocations, more
 * slots, more sidecars never make a script shorter or a cost smaller. So for `d < dmin`, `y(d) <= y(dmin)`,
 * and `y(dmin)` is not estimated - it is a MEASUREMENT, the calibration point itself. Substituting the line's
 * value at `dmin` would be sound too, since the line dominates that point, but it is strictly looser for no
 * gain: on the master-density coefficient the line reads 0.5758 at its minimum where the measurement reads
 * 0.1598, and that 3.6x of unnecessary slack is enough to make the estimator name the WRONG binding limit.
 *
 * WHAT THIS BOUND RESTS ON, stated as plainly as the rest: monotonicity in the driver, and the calibration
 * set covering the smallest driver honestly. It is the same standing assumption every coefficient here makes
 * (`fitUpperEnvelope` refuses a negative slope for exactly this reason), applied one step further out. The
 * caller is additionally told, through `outOfRange`, that the driver left the calibrated range downwards.
 *
 * IN-SAMPLE THIS CHANGES NOTHING, by construction: every calibration driver is at or above the minimum.
 */
const applyEnvelope = (envelope: Envelope, driver: number): number => (
  driver < envelope.minimumDriver
    ? envelope.minimumValue
    : envelope.intercept + envelope.slope * driver
);

/**
 * The evaluation for a coefficient whose quantity is NOT a function of the driver, which below the calibrated
 * range means the monotonicity argument above does not apply and the line's value there is the best that can
 * be justified. Two coefficients need it, and WHICH two was measured rather than assumed.
 *
 * THE LINE THAT DIVIDES THEM is whether the quantity is a property of the GRAPH or of a USER CONTRACT.
 *
 * Everything the graph itself produces - the transcript, the argument blobs, the two generated covenants and
 * their costs, the P2PKH fee input - is a function of participant, invocation and slot counts, is monotone in
 * them, and gets `applyEnvelope`. Measured on the forty-five corpus contracts, all of those hold with room:
 * the projection blob's floor is 460 bytes against 109 measured, the master blob's 596 against at most 545,
 * the controller's density floor 0.4067x against 0.21x measured.
 *
 * MASTER AND SIDECAR DENSITY ARE NOT. A density ratio is `cost / (bytes * 800)` and a participant's cost is
 * set by its own CONTRACT BODY, which the descriptor does not carry and this estimator has never claimed to
 * model (limitation 2). Clamping those to the measurement at the smallest calibrated driver assumes the
 * smallest calibrated graph's participants are as expensive per byte as any participant, and the corpus says
 * flatly otherwise: A13's masters reach 0.1598x where real corpus masters at ONE participant reach 0.3673x,
 * which under-predicted 34 of 45 by up to 56.5% until this split was made. So those two are evaluated at the
 * LINE, which for the master coefficient is the flat maximum over every calibration master, 0.5758x.
 *
 * The cost of being right about this is the binding-LIMIT prediction, and it is stated rather than traded
 * away: 0.5758x outranks the 0.5002x script prediction, so density is still named first on a population that
 * measures 0.2177x. That is limitation 1 - no driver in the descriptor separates contract bodies - and it is
 * a missing MEASUREMENT, not a missing fit. `bindingUnresolved` reports what the model can honestly say.
 */
const applyBodyEnvelope = (envelope: Envelope, driver: number): number =>
  envelope.intercept + envelope.slope * Math.max(driver, envelope.minimumDriver);

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
  /**
   * Projection unlocking bytes ABOVE its compiled redeem script - the transcript blob and its pushes - over
   * participants + invocations. THE REDEEM SCRIPT IS NOT ENVELOPED, and that is the second half of the X70
   * fix. The projection verifier is ONE generated covenant: its redeem script is a fixed number of bytes that
   * the same compile the descriptor already needs will report, and every proof slot's unlocking script pushes
   * the whole of it. Folding that constant into a fitted line let the linear program trade it for slope and
   * produce an intercept BELOW the constant, which is not a modelling inaccuracy but an arithmetic
   * impossibility - no P2SH input can be shorter than the script it redeems. Modelled the way the master term
   * has always been modelled - a given redeem plus an enveloped argument blob - the constant is carried
   * exactly and a change to the covenant moves the prediction instead of silently invalidating it.
   */
  projectionArgBytes: Envelope;
  /** Projection density ratio over participants + invocations: the driver C2's own fixture identifies. */
  projectionDensity: Envelope;
  /** Controller unlocking bytes above its compiled redeem script, over participants + invocations. */
  controllerArgBytes: Envelope;
  /**
   * Controller density ratio over participants + invocations.
   *
   * F2 drove this off the SLOT count, reasoning that the controller scans every transaction output. The real
   * held-out graph contradicted that and F2 recorded the contradiction as blind spot 6 without acting on it:
   * E1 reaches 0.6368x on nineteen slots where C1 reaches 0.6182x on thirty-eight, so the quantity is not
   * monotone in slots at all and the envelope missed E1 by 9.6%. It IS ordered by row count - E1 carries
   * thirteen rows against C1's eleven - which is also the mechanism, since the controller's own unlocking
   * bytecode is the transcript and the transcript is rows. Re-driven on rows the same E1 point is predicted
   * 0.8048x against 0.6368x measured, i.e. conservative, and the four calibration points are unaffected.
   */
  controllerDensity: Envelope;
  /**
   * Compiled redeem-script bytes of the generated projection verifier and root controller, as MEASURED in the
   * calibration set. These are not fitted: one covenant each, one compile, one length. They are the defaults
   * for a descriptor that does not carry its own, and a descriptor that does carry its own overrides them -
   * which is what makes a change to either covenant move the prediction instead of quietly invalidating it.
   */
  projectionRedeemBytes: number;
  controllerRedeemBytes: number;
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
  // BOTH ENDS. F2 reported only the upper one, which is how forty-five one-participant graphs were answered
  // confidently from a coefficient calibrated at six participants and up, and answered wrong.
  const check = (driver: number, envelope: Envelope, what: string): void => {
    if (driver > envelope.maximumDriver) {
      outOfRangeSet.add(`${what} ${driver} exceeds the calibrated maximum ${envelope.maximumDriver}`);
    }
    if (driver < envelope.minimumDriver) {
      outOfRangeSet.add(`${what} ${driver} is below the calibrated minimum ${envelope.minimumDriver}`);
    }
  };
  const classes: ClassPrediction[] = [];
  // The slack a coefficient showed on its OWN calibration points. Carried through to the prediction because
  // it is what makes two ratios comparable, or shows that they are not.
  const slackOf = (envelope: Envelope): number => Math.max(0, ...envelope.overPrediction);
  const push = (
    klass: InputClass, count: number, unlockingBytes: number, ratio: number,
    bytesEnvelope: Envelope, densityEnvelope: Envelope,
    bytesDriver: number, densityDriver: number, exactBytes = 0,
  ): void => {
    classes.push({
      klass,
      count,
      unlockingBytes,
      densityRatio: ratio,
      operationCost: ratio * (unlockingBytes + BCH_2026_CONSENSUS.densityControlBaseLength)
        * BCH_2026_CONSENSUS.operationCostBudgetPerByte,
      bytesSlack: slackOf(bytesEnvelope),
      densitySlack: slackOf(densityEnvelope),
      exactBytes,
      bytesFloor: deBias(unlockingBytes, exactBytes, localSlack(bytesEnvelope, bytesDriver)),
      densityFloor: deBias(ratio, 0, localSlack(densityEnvelope, densityDriver)),
    });
  };

  check(rows, family.masterArgBytes, 'participants + invocations');
  check(spec.participants, family.masterDensity, 'participant count');
  const argBytes = applyEnvelope(family.masterArgBytes, rows);
  const masterBytes = spec.redeemBytes.map((redeem) => redeem + argBytes);
  push('master', geometry.masters, Math.max(...masterBytes),
    applyBodyEnvelope(family.masterDensity, spec.participants),
    family.masterArgBytes, family.masterDensity,
    rows, spec.participants, Math.max(...spec.redeemBytes));

  const feeBytes = applyEnvelope(calibration.feeBytes, 0);
  push('fee', geometry.fees, feeBytes, applyEnvelope(calibration.feeDensity, 0),
    calibration.feeBytes, calibration.feeDensity, 0, 0);

  let sidecarSerialized = 0;
  let sidecarSerializedFloor = 0;
  if (geometry.sidecars > 0) {
    check(geometry.slots, calibration.sidecarBytes, 'slot count');
    check(geometry.sidecars, calibration.sidecarSerialized, 'sidecar count');
    push('sidecar', geometry.sidecars, applyEnvelope(calibration.sidecarBytes, geometry.slots),
      applyBodyEnvelope(calibration.sidecarDensity, geometry.slots),
      calibration.sidecarBytes, calibration.sidecarDensity, geometry.slots, geometry.slots);
    sidecarSerialized = applyEnvelope(calibration.sidecarSerialized, geometry.sidecars);
    sidecarSerializedFloor = deBias(sidecarSerialized, 0,
      localSlack(calibration.sidecarSerialized, geometry.sidecars));
  }
  // THE TWO GENERATED COVENANTS. Each is a FIXED redeem script carried exactly plus an enveloped argument
  // blob, which is the construction the master term has always used. `redeemFloor` is the arithmetic fact the
  // fitted version could violate and did: a P2SH input pushes the script it redeems, so its unlocking
  // bytecode cannot be shorter than that script, whatever any coefficient says.
  const redeemFloor = (redeem: number, predicted: number): number => Math.max(redeem, predicted);
  const projectionRedeem = spec.projectionRedeemBytes ?? calibration.projectionRedeemBytes;
  const controllerRedeem = spec.controllerRedeemBytes ?? calibration.controllerRedeemBytes;
  if (geometry.projections > 0) {
    check(rows, calibration.projectionArgBytes, 'participants + invocations');
    push('projection', geometry.projections,
      redeemFloor(projectionRedeem, projectionRedeem + applyEnvelope(calibration.projectionArgBytes, rows)),
      applyEnvelope(calibration.projectionDensity, rows),
      calibration.projectionArgBytes, calibration.projectionDensity, rows, rows, projectionRedeem);
  }
  if (geometry.controllers > 0) {
    check(rows, calibration.controllerDensity, 'participants + invocations');
    push('controller', geometry.controllers,
      redeemFloor(controllerRedeem, controllerRedeem + applyEnvelope(calibration.controllerArgBytes, rows)),
      applyEnvelope(calibration.controllerDensity, rows),
      calibration.controllerArgBytes, calibration.controllerDensity, rows, rows, controllerRedeem);
  }

  const byClass = new Map(classes.map((row) => [row.klass, row]));
  check(geometry.outputs, family.outputsSerialized, 'output count');
  const overheadBytes = 4 + varintLength(geometry.inputs) + varintLength(geometry.outputs) + 4;
  const serializedBytes = overheadBytes
    + masterBytes.reduce((sum, bytes) => sum + inputSerializedBytes(bytes), 0)
    + inputSerializedBytes(feeBytes)
    + sidecarSerialized
    + geometry.projections * inputSerializedBytes(byClass.get('projection')?.unlockingBytes ?? 0)
    + geometry.controllers * inputSerializedBytes(byClass.get('controller')?.unlockingBytes ?? 0)
    + applyEnvelope(family.outputsSerialized, geometry.outputs);
  // THE SAME SUM, TERM BY TERM, WITH EACH TERM'S OWN SLACK TAKEN BACK OUT. X70 gave the two size limits a
  // slack of zero on the grounds that they are "exact arithmetic on the descriptor", which is true of the
  // arithmetic and false of its inputs: every byte in this sum comes from the same enveloped class
  // predictions as the script limit. A serialized total that is dominated by exact redeem scripts is a TIGHT
  // prediction (3.3% over on C1, 10.0% on C3) and deserves to be ranked as one, which a single worst-case
  // discount over the whole sum would not do.
  const masterArgFloor = deBias(argBytes, 0, localSlack(family.masterArgBytes, rows));
  const serializedFloor = overheadBytes
    + spec.redeemBytes.reduce((sum, redeem) => sum + inputSerializedBytes(redeem + masterArgFloor), 0)
    + inputSerializedBytes(deBias(feeBytes, 0, localSlack(calibration.feeBytes, 0)))
    + sidecarSerializedFloor
    + geometry.projections * inputSerializedBytes(byClass.get('projection')?.bytesFloor ?? 0)
    + geometry.controllers * inputSerializedBytes(byClass.get('controller')?.bytesFloor ?? 0)
    + deBias(applyEnvelope(family.outputsSerialized, geometry.outputs), 0,
      localSlack(family.outputsSerialized, geometry.outputs));

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

  // THE DE-BIASED RATIO PER LIMIT. Each is the same quantity with its own coefficients' demonstrated LOCAL
  // over-prediction taken back out, and with every exact term - a redeem script, a serialization overhead, a
  // SigChecks allowance computed from a measured floor - left alone. `bytesFloor` on the worst class, not the
  // worst class's floor, is deliberately a MAX over classes: de-biasing can reorder which class is widest.
  const floorBytes = Math.max(...classes.map((row) => row.bytesFloor));
  const floorDensity = Math.max(...classes.map((row) => row.densityFloor));
  const limits: LimitPrediction[] = ([
    {
      limit: 'standard relay transaction size',
      regime: 'standard',
      predicted: serializedBytes,
      allowed: BCH_2026_STANDARD.maximumTransactionSize,
      ratio: serializedBytes / BCH_2026_STANDARD.maximumTransactionSize,
      ratioFloor: serializedFloor / BCH_2026_STANDARD.maximumTransactionSize,
      where: 'transaction',
    },
    {
      limit: 'consensus transaction size',
      regime: 'consensus',
      predicted: serializedBytes,
      allowed: BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
      ratio: serializedBytes / BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
      ratioFloor: serializedFloor / BCH_2026_CONSENSUS.maximumTransactionLengthBytes,
      where: 'transaction',
    },
    {
      limit: 'unlocking bytecode length',
      regime: 'consensus',
      predicted: worstUnlockingBytes,
      allowed: BCH_2026_CONSENSUS.maximumBytecodeLength,
      ratio: worstUnlockingBytes / BCH_2026_CONSENSUS.maximumBytecodeLength,
      ratioFloor: floorBytes / BCH_2026_CONSENSUS.maximumBytecodeLength,
      where: classes.find((row) => row.unlockingBytes === worstUnlockingBytes)!.klass,
    },
    {
      limit: 'operation-cost density',
      regime: 'standard',
      predicted: worstDensity.operationCost,
      allowed: (worstDensity.unlockingBytes + BCH_2026_CONSENSUS.densityControlBaseLength)
        * BCH_2026_CONSENSUS.operationCostBudgetPerByte,
      ratio: worstDensity.densityRatio,
      ratioFloor: floorDensity,
      where: worstDensity.klass,
    },
    {
      // Exact: one check on the smallest signed input, whose allowance is arithmetic on a MEASURED floor.
      limit: 'per-input SigChecks',
      regime: 'consensus',
      predicted: signed > 0 ? 1 : 0,
      allowed: sigCheckLimit,
      ratio: worstSigCheckRatio,
      ratioFloor: worstSigCheckRatio,
      where: 'fee',
    },
    {
      // Exact: the descriptor's own signed-input count against a consensus constant.
      limit: 'transaction SigChecks',
      regime: 'consensus',
      predicted: signed,
      allowed: BCH_2026_CONSENSUS.maximumTransactionSignatureChecks,
      ratio: signed / BCH_2026_CONSENSUS.maximumTransactionSignatureChecks,
      ratioFloor: signed / BCH_2026_CONSENSUS.maximumTransactionSignatureChecks,
      where: 'transaction',
    },
  // ORDERED BY THE DE-BIASED RATIO, WITH ONE KEY AHEAD OF IT: a limit the shape is predicted to EXCEED
  // outranks one it is merely predicted to approach. Without that key the named binder can contradict the
  // verdict - at eight participants there are corpus rows whose relay size is predicted over 1.0 while
  // density has the larger de-biased ratio, and answering "OVER, binds on density" tells a user to cut the
  // wrong thing. `worstRatio` decides OVER; this makes `limits[0]` agree with it.
  ] as LimitPrediction[]).sort((left, right) =>
    Number(right.ratio > 1) - Number(left.ratio > 1)
    || right.ratioFloor - left.ratioFloor
    || right.ratio - left.ratio);

  // WHICH LIMITS THE RANKING CANNOT SEPARATE, by interval dominance: a limit survives unless its whole
  // `[ratioFloor, ratio]` interval sits below some other limit's floor. Taking the largest floor on the shape
  // rather than the leader's own is what tightens the set - on the corpus rows the leader's floor was the
  // loosest of the six.
  const bestFloor = Math.max(...limits.map((row) => row.ratioFloor));
  const bindingUnresolved = limits
    .filter((row) => row.ratio >= bestFloor - 1e-12)
    .map((row) => row.limit);
  // CONSERVATISM IS TAKEN FROM THE MAXIMUM PREDICTED RATIO, NOT FROM `limits[0]`. Before X78 those were the
  // same thing; they are not any more, and a verdict read off a re-ordered list would silently under-report.
  const worstRatio = Math.max(...limits.map((row) => row.ratio));

  return {
    shape: spec.name,
    inputCount: geometry.inputs,
    outputCount: geometry.outputs,
    serializedBytes,
    worstUnlockingBytes,
    worstDensityRatio: worstDensity.densityRatio,
    worstSigCheckRatio,
    limits,
    worstRatio,
    bindingUnresolved,
    verdict: worstRatio > 1 ? 'OVER' : 'FITS',
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
  projections?: { count: number; redeemBytes: number; unlockingBytes: number; maximumStandardCost: number };
  controller?: { redeemBytes: number; unlockingBytes: number; standardCost: number };
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
      redeemBytes: classification.projectionRedeemBytes,
      unlockingBytes: Math.max(...projectionRows.map((row) => row.unlockingBytes)),
      maximumStandardCost: Math.max(...projectionRows.map((row) => row.standardCost)),
    },
    controller: classification.controller === undefined ? undefined : {
      redeemBytes: classification.controllerRedeemBytes,
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
  const projectionArgPoints: EnvelopePoint[] = [];
  const projectionDensityPoints: EnvelopePoint[] = [];
  const controllerArgPoints: EnvelopePoint[] = [];
  const controllerDensityPoints: EnvelopePoint[] = [];
  let projectionRedeem = 0;
  let controllerRedeem = 0;
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
    // THE ARGUMENT BLOB, not the whole script: the redeem script of each generated covenant is carried as the
    // measured constant it is, and only what the input pushes ON TOP of it is fitted.
    if (sample.projections !== undefined) {
      projectionRedeem = Math.max(projectionRedeem, sample.projections.redeemBytes);
      projectionArgPoints.push({
        x: rows,
        y: sample.projections.unlockingBytes - sample.projections.redeemBytes,
        label: `${spec.name}/projection-args`,
      });
      projectionDensityPoints.push({
        x: rows,
        y: densityOf(sample.projections.maximumStandardCost, sample.projections.unlockingBytes),
        label: `${spec.name}/projection-density`,
      });
    }
    if (sample.controller !== undefined) {
      controllerRedeem = Math.max(controllerRedeem, sample.controller.redeemBytes);
      controllerArgPoints.push({
        x: rows,
        y: sample.controller.unlockingBytes - sample.controller.redeemBytes,
        label: `${spec.name}/controller-args`,
      });
      controllerDensityPoints.push({
        x: rows,
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
    projectionArgBytes: fit(projectionArgPoints),
    projectionDensity: fit(projectionDensityPoints),
    controllerArgBytes: fit(controllerArgPoints),
    controllerDensity: fit(controllerDensityPoints),
    feeBytes: fit(feeBytePoints),
    feeDensity: fit(feeDensityPoints),
    projectionRedeemBytes: projectionRedeem,
    controllerRedeemBytes: controllerRedeem,
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
  /**
   * Redeem-script bytes of the two generated covenants, recovered the same way. Zero for the binding sweep,
   * which has neither. These are what let the calibration carry the covenant sizes as MEASURED CONSTANTS
   * instead of folding them into a fitted intercept.
   */
  projectionRedeemBytes: number;
  controllerRedeemBytes: number;
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
      projectionRedeemBytes: 0,
      controllerRedeemBytes: 0,
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
    projectionRedeemBytes: redeemBytes[projectionStart],
    controllerRedeemBytes: redeemBytes[controller],
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
    // The two numbers a reader needs to see are different jobs: the RANKED leader answers "what do I cut",
    // and `worstRatio` answers "how close am I". Printing only the first would restate X70's mistake.
    `worst<=${prediction.worstRatio.toFixed(4)}x`,
    `unresolved=[${prediction.bindingUnresolved.join('; ')}]`,
    prediction.verdict,
    prediction.outOfRange.length === 0 ? 'in-range' : `OUT-OF-RANGE(${prediction.outOfRange.length})`,
  ].join(' | ');
}
