import type { MeasuredShape } from './layer3-estimator-f2.js';

/**
 * THE RECORDED HALF OF F2's CALIBRATION BASIS: the four composed capstone shapes, measured at the commit
 * named below, distilled by `distill` from what `layer3-estimator-probe.ts` observed the capstones' OWN
 * builders produce. The sweep rows of F1's table are not here: `Layer3EstimatorF2.test.ts` rebuilds and
 * re-measures those live, so three of the seven calibration shapes are measured in the same process that
 * judges the estimator.
 *
 * WHY RECORDED AND NOT REBUILT. Re-running C1, C2, C3 and A13 measures byte-identical transactions and the
 * decision is about cost, not evidence: every figure below was produced by the same `assessEnvelope` the live
 * half uses, run to completion on a relaxed density ceiling with every other consensus knob real, re-checked
 * with NOTHING relaxed at both the real consensus and the real standard profile, and with a knob-liveness
 * control that bites on the same bytes. Those three facts are asserted against this file rather than trusted.
 *
 * RE-MEASURED AT `1591e87f` (X66). The previous basis was taken at `ffef8568` and was stale in one direction
 * on every row, because F4 then cut 129 bytes from `generateGraphProjectionVerifier`. That covenant is
 * instantiated once per PARTICIPANT and each proof slot pushes the whole redeem script, so the transaction
 * cost is N times the covenant cost. Every figure below is a fresh reading, and the differences are:
 *
 *   shape        serialized  was      delta   projection  was    binds                     was
 *   A13 graph        23,458  23,845   -387       5,002   5,131   script bytes  0.5002x     0.5131x
 *   C2 cycle         52,733  53,249   -516       5,294   5,423   op-cost       0.6491x     0.6491x
 *   C1 DeFi          62,722  63,315   -593       5,865   5,994   script bytes  0.7451x     0.7451x
 *   C3 max graph     99,670 100,650   -980       5,876   6,005   RELAY SIZE    0.9967x     1.0065x
 *
 * A13 and C2 moved by exactly 129 x N. C1 and C3 moved by 129 x N LESS 52, and that 52 is attributed rather
 * than absorbed: one participant's compiled script grew 28 bytes in each (C1 3,401 -> 3,429, C3 3,486 ->
 * 3,514) and each shape's output set grew 24 (C1 2,399 -> 2,423, C3 5,357 -> 5,381). 28 + 24 = 52, twice.
 *
 * AND THE CONSEQUENCE, WHICH IS NOT A RESTATEMENT OF THE FIGURE. C3 NO LONGER OVERRUNS THE STANDARD RELAY
 * CEILING. It sat 650 bytes over; it now sits 330 bytes UNDER, at 0.9967x, with all 108 slots intact. Every
 * costed C3 fix on this board - remove two slot pairs, remove four, reclaim the 62-slot Ledger trailing
 * region - was sized against an overrun that does not exist, and they are headroom now rather than plans.
 * The binding limit for C3 is still standard relay size; what changed is which side of it C3 is on.
 *
 * EVERY DENSITY REPRODUCES. C2 to ten decimals (0.6490569511), A13 to ten (0.4067306739), C1 and C3 to four
 * (0.6183 and 0.9218 against 0.6182 and 0.9217), the difference being the one master whose script grew.
 *
 * NOTHING HERE IS A `CONSENSUS_FIT` OR `POLICY_FIT` CLAIM. These are point-in-time readings of four shapes at
 * one commit on `MockNetworkProvider`, exactly as F1 recorded them, and F1 declined to assert `CONSENSUS_FIT`
 * on that basis. This file inherits that refusal.
 */
export const F2_BASIS_COMMIT = '1591e87f';

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
    'serializedBytes': 23458,
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
      'redeemBytes': 4542,
      'unlockingBytes': 5002,
      'maximumStandardCost': 1141005,
    },
    'controller': {
      'redeemBytes': 1514,
      'unlockingBytes': 1977,
      'standardCost': 656626,
    },
    'fee': {
      'unlockingBytes': 126,
      'standardCost': 29091,
      'signatureChecks': 1,
    },
    'worstUnlockingBytes': 5002,
    'worstDensityRatio': 0.4067306739345887,
    'worstSigCheckRatio': 0.25,
    'bindingLimit': 'unlocking bytecode length',
    'bindingRatio': 0.5002,
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
    'serializedBytes': 52733,
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
      'redeemBytes': 4542,
      'unlockingBytes': 5294,
      'maximumStandardCost': 1586963,
    },
    'controller': {
      'redeemBytes': 1514,
      'unlockingBytes': 2268,
      'standardCost': 1198938,
    },
    'fee': {
      'unlockingBytes': 126,
      'standardCost': 29091,
      'signatureChecks': 1,
    },
    'worstUnlockingBytes': 5294,
    'worstDensityRatio': 0.6490569510610654,
    'worstSigCheckRatio': 0.25,
    'bindingLimit': 'operation-cost density (standard hash pricing)',
    'bindingRatio': 0.6490569510610654,
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
        3429,
      ],
      'signedInputs': 18,
    },
    'inputCount': 38,
    'outputCount': 38,
    'serializedBytes': 62722,
    'maximumOutputSerializedBytes': 144,
    'totalOutputSerializedBytes': 2423,
    'masters': [
      {
        'redeemBytes': 1952,
        'unlockingBytes': 3736,
        'standardCost': 647144,
      },
      {
        'redeemBytes': 5411,
        'unlockingBytes': 7451,
        'standardCost': 1174650,
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
        'redeemBytes': 3429,
        'unlockingBytes': 4844,
        'standardCost': 836024,
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
      'redeemBytes': 4542,
      'unlockingBytes': 5865,
      'maximumStandardCost': 1961873,
    },
    'controller': {
      'redeemBytes': 1514,
      'unlockingBytes': 2839,
      'standardCost': 1424666,
    },
    'fee': {
      'unlockingBytes': 126,
      'standardCost': 29091,
      'signatureChecks': 1,
    },
    'worstUnlockingBytes': 7451,
    'worstDensityRatio': 0.6183446180555555,
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
        3514,
      ],
      'signedInputs': 81,
    },
    'inputCount': 108,
    'outputCount': 108,
    'serializedBytes': 99670,
    'maximumOutputSerializedBytes': 83,
    'totalOutputSerializedBytes': 5381,
    'masters': [
      {
        'redeemBytes': 1759,
        'unlockingBytes': 3287,
        'standardCost': 1181940,
      },
      {
        'redeemBytes': 2136,
        'unlockingBytes': 3560,
        'standardCost': 1321596,
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
        'redeemBytes': 3514,
        'unlockingBytes': 4938,
        'standardCost': 1670061,
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
      'redeemBytes': 4542,
      'unlockingBytes': 5876,
      'maximumStandardCost': 2701240,
    },
    'controller': {
      'redeemBytes': 1514,
      'unlockingBytes': 2850,
      'standardCost': 2131942,
    },
    'fee': {
      'unlockingBytes': 126,
      'standardCost': 29091,
      'signatureChecks': 1,
    },
    'worstUnlockingBytes': 5876,
    'worstDensityRatio': 0.9218012798339675,
    'worstSigCheckRatio': 0.25,
    'bindingLimit': 'standard transaction size',
    'bindingRatio': 0.9967,
    'refusedAtConsensus': 0,
    'refusedAtStandard': 0,
    'knobControlBites': true,
  },
];
