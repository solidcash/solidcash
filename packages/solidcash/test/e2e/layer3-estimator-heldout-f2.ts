import type { MeasuredShape } from './layer3-estimator-f2.js';

/**
 * THE HELD-OUT SHAPE. Measured exactly like the calibration basis, and DELIBERATELY EXCLUDED from it.
 *
 * A model evaluated on its training data is not evaluated. The synthetic held-out counts in
 * `Layer3EstimatorF2.test.ts` vary one thing - participant count - inside a family the calibration already
 * covers. This is the harder test: a REAL composed graph, six independently compiled participants and seven
 * invocations at depth six, whose composition resembles no calibration shape.
 *
 * It is also the shape most likely to break the estimator, which is why it was chosen. Nineteen inputs
 * carrying 68,904 serialized bytes is 3,626 bytes per input; C1 carries 1,666 and C3 932. Its participants
 * are large and its sidecar count is small - five, against C3's ninety - so it inverts the byte distribution
 * every calibration graph has. If the estimator only works because every calibration graph is sidecar-heavy,
 * this is where that shows.
 *
 * MEASURED AT `ffef8568`, from `Layer3ResultGraph.test.ts`, test "measures the honest graph against ordinary
 * BCH-2026 capacity without a relaxed profile", observed through `layer3-estimator-probe.ts`. Six
 * participants, seven invocations, 19 inputs, 68,904 bytes, worst script 6,458, worst density 0.6368 at the
 * controller, and it binds on standard relay size at 0.6890x. Zero inputs refused at either real profile;
 * the density knob control bites on the same bytes.
 */
export const F2_HELD_OUT_COMMIT = 'ffef8568';

export const F2_HELD_OUT: MeasuredShape[] = 
[
  {
    'name': 'E1 result graph',
    'spec': {
      'name': 'E1 result graph',
      'family': 'graph',
      'participants': 6,
      'invocations': 7,
      'blockSizes': [
        1,
        2,
        2,
        2,
        2,
        2,
      ],
      'redeemBytes': [
        1661,
        1975,
        2257,
        2092,
        2084,
        1920,
      ],
      'signedInputs': 6,
    },
    'inputCount': 19,
    'outputCount': 19,
    'serializedBytes': 68904,
    'maximumOutputSerializedBytes': 78,
    'totalOutputSerializedBytes': 1071,
    'masters': [
      {
        'redeemBytes': 1661,
        'unlockingBytes': 3670,
        'standardCost': 411040,
      },
      {
        'redeemBytes': 1975,
        'unlockingBytes': 4016,
        'standardCost': 475286,
      },
      {
        'redeemBytes': 2257,
        'unlockingBytes': 4356,
        'standardCost': 548452,
      },
      {
        'redeemBytes': 2092,
        'unlockingBytes': 4130,
        'standardCost': 473174,
      },
      {
        'redeemBytes': 2084,
        'unlockingBytes': 4121,
        'standardCost': 478262,
      },
      {
        'redeemBytes': 1920,
        'unlockingBytes': 3918,
        'standardCost': 466578,
      },
    ],
    'sidecars': {
      'count': 5,
      'maximumUnlockingBytes': 126,
      'totalSerializedBytes': 835,
      'worstCostUnlockingBytes': 126,
      'worstCostStandardCost': 29091,
    },
    'projections': {
      'count': 6,
      'unlockingBytes': 6458,
      'maximumStandardCost': 2720153,
    },
    'controller': {
      'unlockingBytes': 3303,
      'standardCost': 1703622,
    },
    'fee': {
      'unlockingBytes': 126,
      'standardCost': 29091,
      'signatureChecks': 1,
    },
    'worstUnlockingBytes': 6458,
    'worstDensityRatio': 0.6368204246,
    'worstSigCheckRatio': 0.25,
    'bindingLimit': 'standard transaction size',
    'bindingRatio': 0.68904,
    'refusedAtConsensus': 0,
    'refusedAtStandard': 0,
    'knobControlBites': true,
  },
];
