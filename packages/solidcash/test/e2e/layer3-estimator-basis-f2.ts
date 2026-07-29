import type { MeasuredShape } from './layer3-estimator-f2.js';

/**
 * THE RECORDED HALF OF F2's CALIBRATION BASIS: the four composed capstone shapes, measured at the commit
 * named below, distilled by `distill` from what `layer3-estimator-probe.ts` observed the capstones' OWN
 * builders produce. The sweep rows of F1's table are not here: `Layer3EstimatorF2.test.ts` rebuilds and
 * re-measures those live, so three of the seven calibration shapes are measured in the same process that
 * judges the estimator.
 *
 * WHY RECORDED AND NOT REBUILT. Re-running C1, C2, C3 and A13 costs roughly fifteen minutes per run of the
 * estimator test and measures byte-identical transactions. The decision is about cost, not about evidence:
 * every figure below was produced by the same `assessEnvelope` the live half uses, run to completion on a
 * relaxed density ceiling with every other consensus knob real, re-checked with NOTHING relaxed at both the
 * real consensus and the real standard profile, and with a knob-liveness control that bites on the same
 * bytes. Those three facts are asserted against this file rather than trusted.
 *
 * MEASURED AT `ffef8568`, and THREE FIGURES DISAGREE WITH F1's TABLE, which was taken at `4ac40b82`:
 *
 *   shape          F1 serialized   here      F1 worst script   here    F1 density   here      binds
 *   A13 graph          23,734     23,845          5,094       5,131      0.4067    0.4067    script bytes
 *   C2 cycle           53,101     53,249          5,386       5,423      0.6491    0.6491    op-cost density
 *   C1 DeFi            63,130     63,315          7,451       7,451      0.6182    0.6182    script bytes
 *   C3 max graph      100,354    100,650          5,968       6,005      0.9217    0.9217    RELAY SIZE
 *
 * Every operation-cost density reproduces to four decimals and every binding limit is the same one. What
 * moved is BYTES, in one direction, by 111 to 296: the seven commits between `4ac40b82` and `ffef8568`
 * include X11, X12 and SEC-14, which pin a delegated collection output count and mark zero-parameter events.
 * C3's relay overrun therefore grew from 354 bytes to 650, and its binding ratio from 1.0035x to 1.0065x.
 * The direction matters more than the size: F1's costed fixes for C3 were sized against 354.
 *
 * NOTHING HERE IS A `CONSENSUS_FIT` OR `POLICY_FIT` CLAIM. These are point-in-time readings of four shapes at
 * one commit on `MockNetworkProvider`, exactly as F1 recorded them, and F1 declined to assert `CONSENSUS_FIT`
 * on that basis. This file inherits that refusal.
 */
export const F2_BASIS_COMMIT = 'ffef8568';

export const F2_BASIS: MeasuredShape[] =
[
  {
    'name': 'A13 graph',
    'spec': {
      'name': 'A13 graph',
      'family': 'graph',
      'participants': 3,
      'invocations': 3,
      'blockSizes': [
        1,
        1,
        1,
      ],
      'redeemBytes': [
        1352,
        1352,
        1135,
      ],
      'signedInputs': 1,
    },
    'inputCount': 8,
    'outputCount': 8,
    'serializedBytes': 23845,
    'maximumOutputSerializedBytes': 78,
    'totalOutputSerializedBytes': 454,
    'masters': [
      {
        'redeemBytes': 1352,
        'unlockingBytes': 1911,
        'standardCost': 237259,
      },
      {
        'redeemBytes': 1352,
        'unlockingBytes': 1948,
        'standardCost': 238446,
      },
      {
        'redeemBytes': 1135,
        'unlockingBytes': 1684,
        'standardCost': 220485,
      },
    ],
    'projections': {
      'count': 3,
      'unlockingBytes': 5131,
      'maximumStandardCost': 1214879,
    },
    'controller': {
      'unlockingBytes': 1977,
      'standardCost': 656626,
    },
    'fee': {
      'unlockingBytes': 126,
      'standardCost': 29091,
      'signatureChecks': 1,
    },
    'worstUnlockingBytes': 5131,
    'worstDensityRatio': 0.4067306739,
    'worstSigCheckRatio': 0.25,
    'bindingLimit': 'unlocking bytecode length',
    'bindingRatio': 0.5131,
    'refusedAtConsensus': 0,
    'refusedAtStandard': 0,
    'knobControlBites': true,
  },
  {
    'name': 'C2 cycle',
    'spec': {
      'name': 'C2 cycle',
      'family': 'graph',
      'participants': 4,
      'invocations': 5,
      'blockSizes': [
        66,
        2,
        2,
        3,
      ],
      'redeemBytes': [
        3762,
        1656,
        1792,
        1882,
      ],
      'signedInputs': 64,
    },
    'inputCount': 79,
    'outputCount': 79,
    'serializedBytes': 53249,
    'maximumOutputSerializedBytes': 154,
    'totalOutputSerializedBytes': 3920,
    'masters': [
      {
        'redeemBytes': 3762,
        'unlockingBytes': 4725,
        'standardCost': 2195317,
      },
      {
        'redeemBytes': 1656,
        'unlockingBytes': 2544,
        'standardCost': 894508,
      },
      {
        'redeemBytes': 1792,
        'unlockingBytes': 2681,
        'standardCost': 910810,
      },
      {
        'redeemBytes': 1882,
        'unlockingBytes': 2725,
        'standardCost': 1159267,
      },
    ],
    'sidecars': {
      'count': 69,
      'maximumUnlockingBytes': 266,
      'totalSerializedBytes': 12130,
      'worstCostUnlockingBytes': 126,
      'worstCostStandardCost': 29091,
    },
    'projections': {
      'count': 4,
      'unlockingBytes': 5423,
      'maximumStandardCost': 1739262,
    },
    'controller': {
      'unlockingBytes': 2268,
      'standardCost': 1198938,
    },
    'fee': {
      'unlockingBytes': 126,
      'standardCost': 29091,
      'signatureChecks': 1,
    },
    'worstUnlockingBytes': 5423,
    'worstDensityRatio': 0.6490569511,
    'worstSigCheckRatio': 0.25,
    'bindingLimit': 'operation-cost density (standard hash pricing)',
    'bindingRatio': 0.6490569511,
    'refusedAtConsensus': 0,
    'refusedAtStandard': 0,
    'knobControlBites': true,
  },
  {
    'name': 'C1 DeFi',
    'spec': {
      'name': 'C1 DeFi',
      'family': 'graph',
      'participants': 5,
      'invocations': 6,
      'blockSizes': [
        2,
        5,
        2,
        3,
        19,
      ],
      'redeemBytes': [
        1952,
        5411,
        1629,
        1959,
        3401,
      ],
      'signedInputs': 18,
    },
    'inputCount': 38,
    'outputCount': 38,
    'serializedBytes': 63315,
    'maximumOutputSerializedBytes': 144,
    'totalOutputSerializedBytes': 2399,
    'masters': [
      {
        'redeemBytes': 1952,
        'unlockingBytes': 3736,
        'standardCost': 647144,
      },
      {
        'redeemBytes': 5411,
        'unlockingBytes': 7451,
        'standardCost': 1174602,
      },
      {
        'redeemBytes': 1629,
        'unlockingBytes': 3093,
        'standardCost': 566383,
      },
      {
        'redeemBytes': 1959,
        'unlockingBytes': 3374,
        'standardCost': 755279,
      },
      {
        'redeemBytes': 3401,
        'unlockingBytes': 4816,
        'standardCost': 835595,
      },
    ],
    'sidecars': {
      'count': 26,
      'maximumUnlockingBytes': 265,
      'totalSerializedBytes': 4987,
      'worstCostUnlockingBytes': 126,
      'worstCostStandardCost': 29091,
    },
    'projections': {
      'count': 5,
      'unlockingBytes': 5994,
      'maximumStandardCost': 2245022,
    },
    'controller': {
      'unlockingBytes': 2839,
      'standardCost': 1424386,
    },
    'fee': {
      'unlockingBytes': 126,
      'standardCost': 29091,
      'signatureChecks': 1,
    },
    'worstUnlockingBytes': 7451,
    'worstDensityRatio': 0.6182230903,
    'worstSigCheckRatio': 0.25,
    'bindingLimit': 'unlocking bytecode length',
    'bindingRatio': 0.7451,
    'refusedAtConsensus': 0,
    'refusedAtStandard': 0,
    'knobControlBites': true,
  },
  {
    'name': 'C3 max graph',
    'spec': {
      'name': 'C3 max graph',
      'family': 'graph',
      'participants': 8,
      'invocations': 8,
      'blockSizes': [
        2,
        66,
        2,
        2,
        3,
        2,
        2,
        19,
      ],
      'redeemBytes': [
        1759,
        2136,
        1629,
        1594,
        1838,
        1594,
        1591,
        3486,
      ],
      'signedInputs': 81,
    },
    'inputCount': 108,
    'outputCount': 108,
    'serializedBytes': 100650,
    'maximumOutputSerializedBytes': 83,
    'totalOutputSerializedBytes': 5357,
    'masters': [
      {
        'redeemBytes': 1759,
        'unlockingBytes': 3287,
        'standardCost': 1181940,
      },
      {
        'redeemBytes': 2136,
        'unlockingBytes': 3560,
        'standardCost': 1321572,
      },
      {
        'redeemBytes': 1629,
        'unlockingBytes': 3100,
        'standardCost': 1165193,
      },
      {
        'redeemBytes': 1594,
        'unlockingBytes': 3064,
        'standardCost': 1149577,
      },
      {
        'redeemBytes': 1838,
        'unlockingBytes': 3263,
        'standardCost': 1508269,
      },
      {
        'redeemBytes': 1594,
        'unlockingBytes': 3064,
        'standardCost': 1149845,
      },
      {
        'redeemBytes': 1591,
        'unlockingBytes': 3061,
        'standardCost': 1149679,
      },
      {
        'redeemBytes': 3486,
        'unlockingBytes': 4910,
        'standardCost': 1669440,
      },
    ],
    'sidecars': {
      'count': 90,
      'maximumUnlockingBytes': 266,
      'totalSerializedBytes': 16186,
      'worstCostUnlockingBytes': 126,
      'worstCostStandardCost': 29091,
    },
    'projections': {
      'count': 8,
      'unlockingBytes': 6005,
      'maximumStandardCost': 3076543,
    },
    'controller': {
      'unlockingBytes': 2850,
      'standardCost': 2131662,
    },
    'fee': {
      'unlockingBytes': 126,
      'standardCost': 29091,
      'signatureChecks': 1,
    },
    'worstUnlockingBytes': 6005,
    'worstDensityRatio': 0.9216802145,
    'worstSigCheckRatio': 0.25,
    'bindingLimit': 'standard transaction size',
    'bindingRatio': 1.0065,
    'refusedAtConsensus': 0,
    'refusedAtStandard': 0,
    'knobControlBites': true,
  },
];
