import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { bigIntToVmNumber, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { calculateDust, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  BCH_2026_CONSENSUS, BCH_2026_STANDARD, ORDINARY_LIMITS, refusedInputsAt,
} from './layer3-envelope-f1.js';
import { calibrate, deriveCalibration, estimate } from './layer3-estimator-f2.js';
import { F2_BASIS, F2_BASIS_COMMIT } from './layer3-estimator-basis-f2.js';
import { F2_HELD_OUT } from './layer3-estimator-heldout-f2.js';
import { LAYER3_SEMANTIC_TEST_PROFILE } from './layer3-semantic-profile.js';
import {
  PRODUCTION_ENVELOPE_RULES, PRODUCTION_ENVELOPE_RULE_IDS, assessProductionEnvelope, dustThresholdFor,
  envelopeRule, formatScreen, formatVerdict, isPushOnly, screenProductionEnvelope, serializedOutputBytes,
  standardOutputTemplate,
} from './layer3-production-envelope-r1.js';

/**
 * R1. SELECT AND ENFORCE THE PRODUCTION ENVELOPE.
 *
 * The measurement rows are finished. F1 measured seven shapes against the real BCH-2026 limits, X49 put four
 * of them in front of a BCHN v29.0.0 node, F2 built an estimator that predicts before anything is built. This
 * file does the thing none of those did: it draws a BOUNDARY and REFUSES what is outside it.
 *
 * NOTHING HERE PROMOTES ANY SHAPE'S EVIDENCE LEVEL. The sweep at N=2/4/8 is `CONSENSUS_FIT` because a node
 * accepted and mined it; A13, C2, C1 and C3 remain `SEMANTIC` because the node returned `missing-inputs` and
 * stopped before executing anything; nothing anywhere is `POLICY_FIT`. Admitting a shape into the envelope is
 * a statement about the RULES it satisfies, not about how its evidence was obtained, and the two are kept
 * apart on purpose - F1's author declined to assert `CONSENSUS_FIT` for exactly this reason and was right.
 *
 * FOUR THINGS ARE MEASURED HERE RATHER THAN CITED, because the rule of this board is that a recorded figure
 * whose consequences were not re-derived has already produced four stale blocks:
 *
 *  1. the dust threshold, from the rule, cross-checked against the SDK's own independent implementation;
 *  2. the exact relay-size boundary, at the byte, the same way X49 measured it on the node;
 *  3. the two estimator error allowances, re-derived from the calibration at THIS commit;
 *  4. that three of the envelope's rules are structurally invisible to a per-input VM evaluation, which is
 *     what the existing Layer-3 preflight is.
 */

/* ------------------------------------------------------------------------------------------------------ */
/* Fixtures                                                                                                 */
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

/** F1's participant-binding fixture: the only family a node has accepted and mined. */
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
  redeemBytes: number;
  blockSizes: number[];
}

/**
 * `extraOutputs` is the whole point of this helper existing rather than F1's. It appends outputs AFTER the
 * graph is planned, which is what an SDK's own sidecar auto-co-spend does at `TransactionBuilder.ts:467`,
 * and it is how the plan-versus-bytes divergence below is produced from one descriptor.
 */
async function buildSweep(
  n: number, extraOutputs: { to: Uint8Array; amount: bigint }[] = [],
): Promise<BuiltSweep> {
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
  for (const output of extraOutputs) builder.addOutput(output);
  return {
    transaction: builder.buildLibauthTransaction(),
    sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
    redeemBytes: parts[0].contract.bytecode.length,
    blockSizes: Array.from({ length: n }, () => 1),
  };
}

let sweepCache: Map<number, BuiltSweep> | undefined;
async function sweeps(): Promise<Map<number, BuiltSweep>> {
  if (sweepCache === undefined) {
    sweepCache = new Map();
    for (const n of [2, 4, 8]) sweepCache.set(n, await buildSweep(n));
  }
  return sweepCache;
}

/* ------------------------------------------------------------------------------------------------------ */
/* Synthetic transactions, for the boundary measurements                                                    */
/* ------------------------------------------------------------------------------------------------------ */

const p2pkhScript = (seed: number): Uint8Array => concat(
  Uint8Array.of(0x76, 0xa9, 0x14),
  Uint8Array.from({ length: 20 }, (_value, index) => (seed + index) & 0xff),
  Uint8Array.of(0x88, 0xac),
);

interface SyntheticTransaction {
  version: number;
  locktime: number;
  inputs: { outpointIndex: number; outpointTransactionHash: Uint8Array; sequenceNumber: number;
    unlockingBytecode: Uint8Array }[];
  outputs: { lockingBytecode: Uint8Array; valueSatoshis: bigint }[];
}

/**
 * A transaction whose every output is a standard template well above dust, so a rule under test is the only
 * thing that can refuse it. `opReturnBytes` tunes the total to the byte: an OP_RETURN output is exempt from
 * dust and is a standard template, so it changes size and nothing else.
 */
function synthetic(p2pkhOutputs: number, opReturnBytes?: number): SyntheticTransaction {
  const outputs = Array.from({ length: p2pkhOutputs }, (_value, index) => ({
    lockingBytecode: p2pkhScript(index),
    valueSatoshis: 600n,
  }));
  if (opReturnBytes !== undefined) {
    outputs.push({
      lockingBytecode: concat(
        Uint8Array.of(0x6a), Uint8Array.from({ length: opReturnBytes - 1 }, () => 0x51),
      ),
      valueSatoshis: 0n,
    });
  }
  return {
    version: 2,
    locktime: 0,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(0x11),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array(0),
    }],
    outputs,
  };
}

/**
 * A transaction of EXACTLY the requested serialized size, verified by encoding it rather than by arithmetic.
 * Built the same way X49 built the ones it offered to the node - bulk P2PKH outputs plus one tail output
 * that tunes the total - so the boundary measured here is the boundary measured there.
 */
function syntheticOfExactSize(target: number): SyntheticTransaction {
  for (let opReturnBytes = 1; opReturnBytes <= 201; opReturnBytes += 1) {
    const tailBytes = 8 + 1 + opReturnBytes;
    // 50 = 4 version + 1 input-count varint + 41 input + 4 locktime. The output-count varint is 1 or 3.
    for (const countBytes of [1, 3]) {
      const bulk = (target - 50 - countBytes - tailBytes) / 34;
      if (!Number.isInteger(bulk) || bulk < 1) continue;
      const candidate = synthetic(bulk, opReturnBytes);
      if (encodeTransaction(candidate as never).length === target) return candidate;
    }
  }
  throw new Error(`R1: no synthetic transaction of exactly ${target} bytes`);
}

/* ------------------------------------------------------------------------------------------------------ */
/* 1. The rules themselves                                                                                  */
/* ------------------------------------------------------------------------------------------------------ */

describe('R1 envelope: the rules', () => {
  /**
   * Re-pinned rather than inherited. Every threshold the envelope refuses on is read out of libauth here, so
   * a libauth bump fails this file instead of silently moving the boundary the SDK enforces.
   */
  it('MEASURED: every threshold the envelope enforces, at this commit', () => {
    expect(BCH_2026_CONSENSUS).toEqual({
      maximumBytecodeLength: 10_000,
      maximumTransactionLengthBytes: 1_000_000,
      maximumStackItemLength: 10_000,
      maximumTokenCommitmentLength: 128,
      maximumTransactionSignatureChecks: 3_000,
      operationCostBudgetPerByte: 800,
      densityControlBaseLength: 41,
      hashDigestIterationsPerByte: 3.5,
      hashDigestIterationCost: 64,
    });
    expect(BCH_2026_STANDARD).toEqual({
      maximumTransactionSize: 100_000,
      maximumUnlockingBytecodeLength: 10_000,
      maximumLockingBytecodeLength: 201,
      hashDigestIterationsPerByte: 0.5,
      hashDigestIterationCost: 192,
    });
  });

  /**
   * THE RULE THE WHOLE EFFORT MISSED, re-derived rather than cited.
   *
   * X49 reported that the node refused C1 for `dust` because output 15 pays 10 satoshis to a one-byte `OP_1`
   * script against a threshold of 474. That number is reproduced here from BCHN's rule - three times the
   * relay fee on the output's serialized size plus the 148-byte allowance for the input that will spend it -
   * and cross-checked two ways:
   *
   *   - against the SDK's OWN `calculateDust`, written independently as `444 + outputSize * 3`, which is the
   *     same arithmetic with the multiplication distributed. Two implementations, one number;
   *   - against the 546-satoshi P2PKH dust limit, which every Bitcoin implementation agrees on and which
   *     falls out of the same formula with no fitting. A formula that reproduces a constant nobody in this
   *     repository chose is a formula, not a curve through one point.
   */
  it('MEASURED: the dust rule reproduces both the node figure and the universal P2PKH constant', () => {
    const c1Output = { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 10n };
    expect(serializedOutputBytes(c1Output)).toBe(10);
    expect(dustThresholdFor(c1Output)).toBe(474);
    // X49 measured the node refusing C1 at exactly this threshold, short by 464. Re-derived, not copied.
    expect(dustThresholdFor(c1Output) - Number(c1Output.valueSatoshis)).toBe(464);

    const p2pkh = { lockingBytecode: p2pkhScript(0), valueSatoshis: 1_000n };
    expect(serializedOutputBytes(p2pkh)).toBe(34);
    expect(dustThresholdFor(p2pkh)).toBe(546);

    const p2sh32 = {
      lockingBytecode: concat(Uint8Array.of(0xaa, 0x20), new Uint8Array(32).fill(7), Uint8Array.of(0x87)),
      valueSatoshis: 1_000n,
    };
    expect(serializedOutputBytes(p2sh32)).toBe(44);
    expect(dustThresholdFor(p2sh32)).toBe(576);

    // The SDK's own implementation, independently written, on the same three outputs.
    expect(calculateDust({ to: Uint8Array.of(0x51), amount: 10n })).toBe(474);
    expect(calculateDust({ to: p2pkhScript(0), amount: 1_000n })).toBe(546);
    expect(calculateDust({ to: p2sh32.lockingBytecode, amount: 1_000n })).toBe(576);
  });

  /**
   * WHY IT WAS INVISIBLE, measured rather than asserted. The rule was correct, present and reachable; it was
   * switched off. A provider that enforces dust refuses C1's output shape at `addOutput`; the Layer-3
   * semantic profile sets `enforceDust: false` and the identical call succeeds.
   *
   * This is the sharpest available argument for where the gate belongs. The check that would have caught C1
   * lives on a path a test profile can disable, and disabling it is legitimate for a SEMANTIC fixture. A
   * production envelope therefore cannot be a policy flag on the provider.
   */
  it('MEASURED: `enforceDust: false` is what hid the C1 output, not a missing rule', () => {
    const enforcing = new MockNetworkProvider({ policy: { enforceDust: true } });
    expect(() => new TransactionBuilder({ provider: enforcing })
      .addOutput({ to: Uint8Array.of(0x51), amount: 10n }))
      .toThrow(/less than the required minimum for this output-type \(474\)/);

    const relaxed = new MockNetworkProvider({ policy: { enforceDust: false } });
    expect(() => new TransactionBuilder({ provider: relaxed })
      .addOutput({ to: Uint8Array.of(0x51), amount: 10n })).not.toThrow();

    // And the profile every Layer-3 capstone runs on is the relaxed one.
    expect(LAYER3_SEMANTIC_TEST_PROFILE.policy.enforceDust).toBe(false);
    expect(LAYER3_SEMANTIC_TEST_PROFILE.evidenceLevel).toBe('SEMANTIC');
  });

  /**
   * The output templates the balanced layout produces, and the one it does not. `OP_1` is not a standard
   * scriptPubKey on a node with standardness fully enabled, which is a SECOND reason C1's placeholder is
   * unrelayable and one that no satoshi value fixes.
   */
  it('MEASURED: the standard output templates, and the shape C1 uses', () => {
    expect(standardOutputTemplate(p2pkhScript(0))).toBe('p2pkh');
    expect(standardOutputTemplate(
      concat(Uint8Array.of(0xa9, 0x14), new Uint8Array(20).fill(3), Uint8Array.of(0x87)),
    )).toBe('p2sh20');
    expect(standardOutputTemplate(
      concat(Uint8Array.of(0xaa, 0x20), new Uint8Array(32).fill(3), Uint8Array.of(0x87)),
    )).toBe('p2sh32');
    expect(standardOutputTemplate(Uint8Array.of(0x6a, 0x04, 1, 2, 3, 4))).toBe('op-return');
    expect(standardOutputTemplate(Uint8Array.of(0x51))).toBeUndefined();
  });

  it('MEASURED: push-only detection admits a P2SH spend and refuses an opcode in the scriptSig', () => {
    expect(isPushOnly(concat(Uint8Array.of(0x02, 1, 2), Uint8Array.of(0x4c, 3, 4, 5, 6)))).toBe(true);
    expect(isPushOnly(Uint8Array.of(0x51, 0x52, 0x53))).toBe(true);
    expect(isPushOnly(Uint8Array.of(0x02, 1, 2, 0x93))).toBe(false);
    expect(isPushOnly(Uint8Array.of(0x05, 1, 2))).toBe(false);
  });

  /**
   * Every rule carries a stable id, a regime, and an honest evidence label. The label is about the RULE's
   * threshold, not about any shape: three thresholds were measured on a node, the rest are libauth constants,
   * and exactly one is in the envelope on the conservative side with no measurement behind it. That one is
   * named rather than blended in.
   */
  it('MEASURED: the rule set, its evidence labels, and which rules a byte-only pass can decide', () => {
    expect(new Set(PRODUCTION_ENVELOPE_RULE_IDS).size).toBe(PRODUCTION_ENVELOPE_RULE_IDS.length);
    const nodeMeasured = PRODUCTION_ENVELOPE_RULES.filter((rule) => rule.evidence === 'NODE_MEASURED');
    expect(nodeMeasured.map((rule) => rule.id).sort())
      .toEqual(['output-dust', 'relay-transaction-size', 'scriptsig-push-only']);
    const unmeasured = PRODUCTION_ENVELOPE_RULES.filter(
      (rule) => rule.evidence === 'UNMEASURED_CONSERVATIVE',
    );
    expect(unmeasured.map((rule) => rule.id)).toEqual(['standard-output-template']);
    const byteRules = PRODUCTION_ENVELOPE_RULES.filter((rule) => rule.cost === 'bytes');
    expect(byteRules).toHaveLength(7);
    expect(PRODUCTION_ENVELOPE_RULES.filter((rule) => rule.cost === 'vm')).toHaveLength(5);
    for (const id of PRODUCTION_ENVELOPE_RULE_IDS) expect(envelopeRule(id)!.reason.length).toBeGreaterThan(40);
  });
});

/* ------------------------------------------------------------------------------------------------------ */
/* 2. The gate, on real and synthetic bytes                                                                 */
/* ------------------------------------------------------------------------------------------------------ */

describe('R1 envelope: the build-time gate', () => {
  /**
   * THE SUPPORTED CLASS, ADMITTED. The participant-binding sweep at N=2, 4 and 8 is the only family a node
   * has executed, accepted and mined. It is built here and run through every rule in the envelope, VM rules
   * included, with nothing relaxed.
   */
  it('MEASURED: the gate admits the sweep at N=2, 4 and 8, on every rule', async () => {
    for (const [n, built] of await sweeps()) {
      const verdict = assessProductionEnvelope(
        `sweep N=${n}`, built.transaction as never, built.sourceOutputs,
      );
      console.log(`[R1] ${formatVerdict(verdict)}`);
      for (const reading of verdict.readings) {
        console.log(`[R1]   ${reading.rule.padEnd(28)} ${reading.ratio.toFixed(4)}x `
          + `(${reading.measured} / ${reading.allowed}) at ${reading.where}`);
      }
      expect(verdict.refusals, `sweep N=${n} refused`).toEqual([]);
      expect(verdict.undecided).toEqual([]);
      expect(verdict.admitted).toBe(true);
    }
  }, 900_000);

  /**
   * A CORRECTION TO F1'S OWN TABLE, produced by adding one rule it did not model.
   *
   * F1 ranked the sweep's binding limit as per-input SigChecks at N=2 (0.2500x) and operation-cost density at
   * N=4 (0.2570x). Neither is the tightest rule once dust is included: the 2,000-satoshi p2sh32 change output
   * sits at 0.2880x of its 576-satoshi threshold, ahead of both. The ranking is comparable because every
   * reading is expressed the same way - the fraction of the distance to refusal - and dust is a floor
   * expressed as threshold-over-value so that 1.0000x is its boundary too.
   *
   * This is not a defect in F1. It is the direct consequence of the finding X49 made on the node: a capacity
   * measurement that does not model dust is not measuring the whole envelope, and the shape it misses first
   * is the smallest one.
   */
  it('MEASURED: with dust modelled, the tightest rule on the small sweeps is not the one F1 ranked first', async () => {
    const built = await sweeps();
    for (const n of [2, 4]) {
      const verdict = assessProductionEnvelope(
        `sweep N=${n}`, built.get(n)!.transaction as never, built.get(n)!.sourceOutputs,
      );
      const tightest = verdict.readings[0];
      console.log(`[R1] sweep N=${n} tightest rule ${tightest.rule} ${tightest.ratio.toFixed(4)}x at `
        + `${tightest.where}; F1 ranked ${n === 2 ? 'per-input SigChecks 0.2500x' : 'op-cost density 0.2570x'}`);
      expect(tightest.rule).toBe('output-dust');
      expect(tightest.ratio).toBeGreaterThan(0.25);
      expect(verdict.admitted).toBe(true);
    }
    // At N=8 the capacity rules overtake dust again, so this is a property of the small shapes rather than a
    // claim that dust always binds.
    const eight = assessProductionEnvelope(
      'sweep N=8', built.get(8)!.transaction as never, built.get(8)!.sourceOutputs,
    );
    expect(eight.readings[0].rule).toBe('operation-cost-density');
  }, 900_000);

  /**
   * THE RELAY BOUNDARY, AT THE BYTE, the same measurement X49 made on the node and for the same reason: a
   * ceiling asserted as a band is a ceiling nobody has checked. 100,000 bytes is admitted and 100,001 is
   * refused, by the rule id a diagnostic would quote.
   */
  it('MEASURED: the relay ceiling refuses at exactly one byte over, with a named rule', () => {
    const atCeiling = syntheticOfExactSize(BCH_2026_STANDARD.maximumTransactionSize);
    const overCeiling = syntheticOfExactSize(BCH_2026_STANDARD.maximumTransactionSize + 1);
    const inside = assessProductionEnvelope('at-ceiling', atCeiling as never, [], { bytesOnly: true });
    const outside = assessProductionEnvelope('over-ceiling', overCeiling as never, [], { bytesOnly: true });
    expect(inside.serializedBytes).toBe(BCH_2026_STANDARD.maximumTransactionSize);
    expect(outside.serializedBytes).toBe(BCH_2026_STANDARD.maximumTransactionSize + 1);

    expect(inside.refusals.filter((row) => row.rule === 'relay-transaction-size')).toEqual([]);
    const refusal = outside.refusals.find((row) => row.rule === 'relay-transaction-size');
    expect(refusal).toBeDefined();
    expect(refusal!.overBy).toBe(1);
    expect(refusal!.detail).toMatch(/tx-size/);
    console.log(`[R1] relay boundary: ${inside.serializedBytes}B admitted, `
      + `${outside.serializedBytes}B refused by ${refusal!.rule}`);

    // Both are far inside the CONSENSUS size ceiling, which is the distinction X49 settled by getting the
    // same bytes mined in a submitted block. Refusing here is a policy choice, and it is stated as one.
    expect(outside.refusals.filter((row) => row.rule === 'consensus-transaction-size')).toEqual([]);
  });

  /**
   * C3's OVERRUN, PRICED AGAINST THE RULE. The C3 figure is a citation - 100,650 serialized bytes at
   * `ffef8568`, measured independently by three workers - and what is measured here is the CONSEQUENCE: the
   * gate refuses at that size, by exactly 650 bytes, and admits at the largest size that would not.
   *
   * The consequence is re-derived rather than assumed for the reason this board has already been burned by:
   * F1 costed a fix against 100,354 and the fix stopped working when the figure moved to 100,650.
   */
  it('MEASURED: the gate prices C3-scale overrun by the byte, and admits the size just below', () => {
    const c3SerializedBytesAtBasis = 100_650; // CITATION: measured at `ffef8568`, not re-measured here.
    const over = c3SerializedBytesAtBasis - BCH_2026_STANDARD.maximumTransactionSize;
    expect(over).toBe(650);
    const shaped = syntheticOfExactSize(c3SerializedBytesAtBasis);
    const verdict = assessProductionEnvelope('C3-scale', shaped as never, [], { bytesOnly: true });
    expect(verdict.serializedBytes).toBe(c3SerializedBytesAtBasis);
    const refusal = verdict.refusals.find((row) => row.rule === 'relay-transaction-size')!;
    expect(refusal.overBy).toBe(650);
    console.log(`[R1] a C3-scale transaction is refused by ${refusal.rule}: ${refusal.detail}`);

    // And the largest transaction that is NOT refused, so the boundary is bracketed rather than asserted on
    // one side. F1's costed C3 fix was sized against 354 bytes and stopped working at 650; this is the same
    // arithmetic done against the rule instead of against a recorded figure.
    const justUnder = syntheticOfExactSize(BCH_2026_STANDARD.maximumTransactionSize);
    expect(assessProductionEnvelope('just-under', justUnder as never, [], { bytesOnly: true }).refusals)
      .toEqual([]);
    console.log(`[R1] C3 must shed ${over} bytes; the largest admitted transaction is `
      + `${BCH_2026_STANDARD.maximumTransactionSize} B`);
  });

  /**
   * C1's DUST OUTPUT, REFUSED, and refused TWICE for two independent reasons. The output shape is C1's
   * output 15 exactly: 10 satoshis to a one-byte `OP_1` script. The gate names the shortfall in satoshis and
   * separately names the template, which matters because raising the value to 474 fixes one refusal and not
   * the other.
   *
   * The rest of the transaction is deliberately healthy, so the refusal is attributable to the one output.
   */
  it('MEASURED: the gate refuses the exact C1 placeholder output, on two independent rules', () => {
    const healthy = synthetic(4);
    const clean = assessProductionEnvelope('healthy', healthy as never, [], { bytesOnly: true });
    expect(clean.refusals).toEqual([]);

    healthy.outputs.push({ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 10n });
    const verdict = assessProductionEnvelope('C1 placeholder', healthy as never, [], { bytesOnly: true });
    console.log(`[R1] ${formatVerdict(verdict)}`);
    for (const row of verdict.refusals) console.log(`[R1]   REFUSED ${row.rule} at ${row.where}: ${row.detail}`);

    const dust = verdict.refusals.find((row) => row.rule === 'output-dust')!;
    expect(dust.where).toBe('output 4');
    expect(dust.measured).toBe(474);
    expect(dust.allowed).toBe(10);
    expect(dust.overBy).toBe(464);
    expect(verdict.refusals.some((row) => row.rule === 'standard-output-template')).toBe(true);

    // Raising the value to the threshold closes the dust refusal and leaves the template one, which is why
    // the two are separate rules rather than one "bad output" verdict.
    healthy.outputs[4].valueSatoshis = 474n;
    const raised = assessProductionEnvelope('C1 placeholder, funded', healthy as never, [], { bytesOnly: true });
    expect(raised.refusals.map((row) => row.rule)).toEqual(['standard-output-template']);
  });

  /**
   * THE STRUCTURAL FINDING, and the reason the gate cannot be added to the existing preflight and left there.
   *
   * `preflightLayer3Transaction` evaluates every input on `createVirtualMachineBch2026ForProvider(provider)`.
   * A per-input evaluation is the wrong SHAPE of instrument for three of the envelope's rules: transaction
   * size, output dust and output template are properties of the transaction and of its outputs, and no
   * per-input script evaluation can observe any of them however correct its limits are.
   *
   * Measured here on a single transaction that is over the relay ceiling AND carries C1's dust output: the
   * per-input evaluation refuses NOTHING, at the real standard profile and at the real consensus profile,
   * while the gate refuses on two rules.
   */
  it('MEASURED: a per-input VM evaluation cannot see size, dust or template - the gate refuses anyway', () => {
    const shaped = syntheticOfExactSize(100_650);
    shaped.outputs.push({ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 10n });
    // The input EVALUATES SUCCESSFULLY - an empty scriptSig against an `OP_1` locking script leaves exactly
    // one truthy item - so the per-input verdict below is a genuine acceptance and not a masked error.
    const sourceOutputs = [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 100_000_000n }];

    const perInputStandard = refusedInputsAt(shaped as never, sourceOutputs as never, true, ORDINARY_LIMITS);
    const perInputConsensus = refusedInputsAt(shaped as never, sourceOutputs as never, false, ORDINARY_LIMITS);
    expect(perInputStandard).toEqual([]);
    expect(perInputConsensus).toEqual([]);

    const verdict = assessProductionEnvelope('oversize plus dust', shaped as never, sourceOutputs as never);
    const rules = new Set(verdict.refusals.map((row) => row.rule));
    console.log(`[R1] per-input VM refusals: ${perInputStandard.length} standard / `
      + `${perInputConsensus.length} consensus; gate refusals: ${[...rules].join(', ')}`);
    expect(rules.has('relay-transaction-size')).toBe(true);
    expect(rules.has('output-dust')).toBe(true);
    expect(verdict.admitted).toBe(false);
  });

  /**
   * THE OTHER HALF OF THE SAME FINDING: the existing preflight reads the PROVIDER's limits, and every
   * Layer-3 fixture runs on a provider whose limits are the relaxed semantic profile. Measured as a ratio
   * rather than described, because "relaxed" is not a number.
   *
   * The gate takes no provider and no limits argument, so this cannot happen to it.
   */
  it('MEASURED: the provider limits the existing preflight reads are 10x to 12,500x the real ones', () => {
    const mock = new MockNetworkProvider();
    const limits = mock.consensusLimits!;
    const ratios = {
      transactionBytes: limits.maximumTransactionBytes / BCH_2026_STANDARD.maximumTransactionSize,
      inputBytes: limits.maximumInputBytes / BCH_2026_CONSENSUS.maximumBytecodeLength,
      operationCost: limits.operationCostBudgetPerByte / BCH_2026_CONSENSUS.operationCostBudgetPerByte,
      hashIterations: limits.hashDigestIterationsPerByte / BCH_2026_STANDARD.hashDigestIterationsPerByte,
    };
    console.log(`[R1] MockNetworkProvider limits against the real ones: ${JSON.stringify(ratios)}`);
    expect(ratios.transactionBytes).toBe(100);
    expect(ratios.inputBytes).toBe(100);
    expect(ratios.operationCost).toBe(12_500);
    expect(ratios.hashIterations).toBe(20_000_000);

    const semantic = LAYER3_SEMANTIC_TEST_PROFILE.consensusLimits;
    expect(semantic.maximumTransactionBytes / BCH_2026_STANDARD.maximumTransactionSize).toBe(100);
    expect(semantic.operationCostBudgetPerByte / BCH_2026_CONSENSUS.operationCostBudgetPerByte).toBe(12_500);
  });

  /**
   * THE ANTI-BYPASS PROPERTY, demonstrated rather than asserted: A FAIL-CLOSED BOUNDARY MUST NEVER BECOME AN
   * UNCHECKED WITNESS PATH.
   *
   * One descriptor, two builds. The second appends an output after the graph is planned - which is exactly
   * what the SDK's own sidecar auto-co-spend does at `TransactionBuilder.ts:467`, and which is why a gate
   * keyed on the plan is not a gate. The plan-time screen returns the SAME verdict for both, because it sees
   * the same descriptor. The byte gate admits one and refuses the other.
   */
  it('MEASURED: one plan, two builds - the plan screen cannot tell them apart and the gate can', async () => {
    const clean = (await sweeps()).get(2)!;
    const mutated = await buildSweep(2, [{ to: Uint8Array.of(0x51), amount: 10n }]);

    const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    // The descriptor is derived from each build INDEPENDENTLY, so the claim that the two are
    // indistinguishable at plan time is a measurement rather than an artifact of sharing one object.
    const descriptorOf = (built: BuiltSweep): Parameters<typeof screenProductionEnvelope>[0] => ({
      name: 'sweep N=2',
      family: 'binding' as const,
      participants: built.blockSizes.length,
      invocations: 1,
      blockSizes: built.blockSizes,
      redeemBytes: built.blockSizes.map(() => built.redeemBytes),
    });
    expect(descriptorOf(mutated)).toEqual(descriptorOf(clean));
    const allowances = { underPrediction: 0.123, overPrediction: 0.416 };
    const cleanScreen = screenProductionEnvelope(descriptorOf(clean), calibration, allowances);
    const mutatedScreen = screenProductionEnvelope(descriptorOf(mutated), calibration, allowances);
    console.log(`[R1] plan screen, clean build:   ${formatScreen(cleanScreen)}`);
    console.log(`[R1] plan screen, mutated build: ${formatScreen(mutatedScreen)}`);
    expect(formatScreen(mutatedScreen)).toBe(formatScreen(cleanScreen));

    const cleanVerdict = assessProductionEnvelope('clean', clean.transaction as never, clean.sourceOutputs);
    const mutatedVerdict = assessProductionEnvelope(
      'mutated', mutated.transaction as never, mutated.sourceOutputs,
    );
    console.log(`[R1] ${formatVerdict(cleanVerdict)}`);
    console.log(`[R1] ${formatVerdict(mutatedVerdict)}`);
    expect(cleanVerdict.admitted).toBe(true);
    expect(mutatedVerdict.admitted).toBe(false);
    expect(mutatedVerdict.refusals.map((row) => row.rule).sort())
      .toEqual(['output-dust', 'standard-output-template']);
  }, 900_000);

  /**
   * A CHEAP CHECK MAY NARROW THE WORK, NEVER WIDEN THE ADMISSION. `bytesOnly` skips the five VM rules, and
   * every skipped rule is reported as undecided, and an undecided rule forces `admitted: false`. A caller
   * that wants the cheap answer gets INCOMPLETE, never ADMIT.
   */
  it('MEASURED: a byte-only pass reports the VM rules undecided and refuses to admit', async () => {
    const built = (await sweeps()).get(2)!;
    const full = assessProductionEnvelope('full', built.transaction as never, built.sourceOutputs);
    const cheap = assessProductionEnvelope(
      'cheap', built.transaction as never, built.sourceOutputs, { bytesOnly: true },
    );
    expect(full.admitted).toBe(true);
    expect(cheap.refusals).toEqual([]);
    expect(cheap.admitted).toBe(false);
    expect(cheap.undecided.map((row) => row.rule).sort()).toEqual([
      'hash-iteration-density', 'input-accepted', 'operation-cost-density', 'per-input-sigchecks',
      'transaction-sigchecks',
    ]);
  }, 900_000);

  /**
   * NO RULE PASSES VACUOUSLY. Every byte rule gets a transaction that trips it, so a rule that stopped being
   * checked would show up here as a missing refusal rather than as a silently widened envelope. This is the
   * same discipline as F1's knob-liveness control, applied to a gate instead of to a VM knob.
   */
  it('MEASURED: every byte rule has a case that trips it', () => {
    const cases: { rule: string; make: () => SyntheticTransaction }[] = [
      {
        rule: 'relay-transaction-size',
        make: () => syntheticOfExactSize(BCH_2026_STANDARD.maximumTransactionSize + 1),
      },
      {
        rule: 'output-dust',
        make: () => {
          const tx = synthetic(2);
          // One satoshi below the 546 every implementation agrees on for a P2PKH output.
          tx.outputs.push({ lockingBytecode: p2pkhScript(9), valueSatoshis: 545n });
          return tx;
        },
      },
      {
        rule: 'standard-output-template',
        make: () => {
          const tx = synthetic(2);
          tx.outputs.push({ lockingBytecode: Uint8Array.of(0x51, 0x51), valueSatoshis: 100_000n });
          return tx;
        },
      },
      {
        rule: 'standard-locking-bytes',
        make: () => {
          const tx = synthetic(2);
          tx.outputs.push({
            lockingBytecode: concat(Uint8Array.of(0x6a), new Uint8Array(220).fill(0x51)),
            valueSatoshis: 100_000n,
          });
          return tx;
        },
      },
      {
        rule: 'input-unlocking-bytes',
        make: () => {
          const tx = synthetic(2);
          tx.inputs[0].unlockingBytecode = concat(
            Uint8Array.of(0x4e, 0x11, 0x27, 0, 0), new Uint8Array(10_001).fill(0),
          );
          return tx;
        },
      },
      {
        rule: 'scriptsig-push-only',
        make: () => {
          const tx = synthetic(2);
          tx.inputs[0].unlockingBytecode = Uint8Array.of(0x02, 1, 2, 0x93);
          return tx;
        },
      },
      {
        rule: 'consensus-transaction-size',
        make: () => synthetic(29_500),
      },
    ];
    const tripped = new Set<string>();
    for (const scenario of cases) {
      const verdict = assessProductionEnvelope(
        scenario.rule, scenario.make() as never, [], { bytesOnly: true },
      );
      const hit = verdict.refusals.filter((row) => row.rule === scenario.rule);
      expect(hit.length, `no case trips ${scenario.rule}`).toBeGreaterThan(0);
      tripped.add(scenario.rule);
      console.log(`[R1] liveness ${scenario.rule.padEnd(28)} tripped: ${hit[0].detail}`);
    }
    // Completeness in the other direction: every byte rule in the envelope has a case above.
    const byteRules = PRODUCTION_ENVELOPE_RULES.filter((rule) => rule.cost === 'bytes').map((rule) => rule.id);
    expect([...tripped].sort()).toEqual([...byteRules].sort());
  });
});

/* ------------------------------------------------------------------------------------------------------ */
/* 3. The plan-time screen                                                                                  */
/* ------------------------------------------------------------------------------------------------------ */

describe('R1 envelope: the plan-time screen', () => {
  /**
   * THE TWO ALLOWANCES, RE-DERIVED AT THIS COMMIT. F2 reported +41.6% worst in-sample over-prediction and
   * -12.3% worst in-range out-of-sample under-prediction. Both are re-computed here from the calibration
   * rather than read out of a table, because a screen threshold derived from a stale number is a stale
   * threshold, and the whole point of the screen is that its two edges are measured.
   *
   * The basis used here is the four RECORDED capstone shapes plus the recorded held-out graph, which is a
   * citation of the transactions but not of the error figures: the errors are recomputed by running the
   * estimator against them in this process.
   */
  it('MEASURED: the over- and under-prediction allowances the screen thresholds are built from', () => {
    const full = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    const inSample = calibrate(F2_BASIS, full);
    const over = Math.max(...inSample.map((row) => row.error));
    expect(inSample.filter((row) => !row.conservative)).toEqual([]);

    const underRows: { label: string; error: number }[] = [];
    for (const held of F2_BASIS) {
      const rest = F2_BASIS.filter((shape) => shape.name !== held.name);
      for (const row of calibrate([held], deriveCalibration(rest, 'loo'))) {
        if (row.outOfRange.length === 0) underRows.push({ label: `${row.shape}/${row.limit}`, error: row.error });
      }
    }
    for (const row of calibrate(F2_HELD_OUT, full)) {
      underRows.push({ label: `${row.shape}/${row.limit}`, error: row.error });
    }
    const under = Math.min(...underRows.map((row) => row.error));
    console.log(`[R1] in-sample worst OVER-prediction ${(over * 100).toFixed(1)}%; `
      + `out-of-sample worst in-range UNDER-prediction ${(under * 100).toFixed(1)}% on `
      + `${underRows.find((row) => row.error === under)!.label}`);

    // Bands, not exact figures, so unrelated compiler work does not falsely fail this - but bands tight
    // enough that a change large enough to move a screen threshold materially still fails here.
    expect(over).toBeGreaterThan(0.1);
    expect(over).toBeLessThan(1.0);
    expect(under).toBeLessThan(0);
    expect(under).toBeGreaterThan(-0.30);
  });

  /**
   * THE ARGUMENT THE SCREEN EXISTS TO MAKE, as arithmetic: AN ESTIMATOR-ONLY GATE IS UNSOUND IN BOTH
   * DIRECTIONS, and the width of each failure is measured.
   *
   *   - refusing on `predicted > limit` produces FALSE REFUSALS across a window whose width is the
   *     over-prediction band. A13 predicts 28,938 serialized bytes and measures 23,845: at any ceiling
   *     between those two numbers, a prediction-based refusal rejects a shape the network accepts;
   *   - admitting on `predicted <= limit` produces FALSE ADMISSIONS across a window whose width is the
   *     out-of-sample under-prediction band.
   *
   * This is why the screen cannot be the gate, and why the gate does not consult the screen.
   */
  it('MEASURED: the false-refusal and false-admission windows of a prediction-only gate', () => {
    const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    const rows = F2_BASIS.map((shape) => {
      const prediction = estimate(shape.spec, calibration);
      return {
        name: shape.name,
        predicted: prediction.serializedBytes,
        measured: shape.serializedBytes,
        error: prediction.serializedBytes / shape.serializedBytes - 1,
      };
    });
    for (const row of rows) {
      console.log(`[R1] ${row.name.padEnd(16)} predicted=${row.predicted.toFixed(0)} `
        + `measured=${row.measured} falseRefusalWindow=${(row.predicted - row.measured).toFixed(0)}B`);
    }
    const a13 = rows.find((row) => row.name === 'A13 graph')!;
    // A ceiling anywhere in this window refuses a shape that fits. The window is thousands of bytes wide.
    expect(a13.predicted).toBeGreaterThan(a13.measured);
    expect(a13.predicted - a13.measured).toBeGreaterThan(2_000);
    console.log(`[R1] a prediction-only refusal at any ceiling in [${a13.measured}, `
      + `${a13.predicted.toFixed(0)}] falsely refuses A13`);
  });

  /**
   * THE SCREEN'S THREE VERDICTS, on the seven-shape basis, with thresholds derived from the two allowances
   * measured above. What is REQUIRED is one-directional and stated as such: a shape the gate would refuse
   * must never be screened CLEAR. The converse - that everything the gate admits is screened CLEAR - is NOT
   * required and does not hold, because the estimator over-predicts and a WARN on a shape that fits is the
   * safe error.
   */
  it('MEASURED: the screen never calls an over-limit shape CLEAR, and says WARN where it cannot tell', () => {
    const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    const inSample = calibrate(F2_BASIS, calibration);
    const over = Math.max(...inSample.map((row) => row.error));
    const underRows: number[] = [];
    for (const held of F2_BASIS) {
      const rest = F2_BASIS.filter((shape) => shape.name !== held.name);
      for (const row of calibrate([held], deriveCalibration(rest, 'loo'))) {
        if (row.outOfRange.length === 0) underRows.push(row.error);
      }
    }
    for (const row of calibrate(F2_HELD_OUT, calibration)) underRows.push(row.error);
    const allowances = { overPrediction: over, underPrediction: -Math.min(...underRows) };
    console.log(`[R1] screen allowances: over ${(allowances.overPrediction * 100).toFixed(1)}%, `
      + `under ${(allowances.underPrediction * 100).toFixed(1)}%`);

    for (const shape of F2_BASIS) {
      const screen = screenProductionEnvelope(shape.spec, calibration, allowances);
      const overLimit = shape.serializedBytes > BCH_2026_STANDARD.maximumTransactionSize
        || shape.worstUnlockingBytes > BCH_2026_CONSENSUS.maximumBytecodeLength
        || shape.worstDensityRatio > 1;
      console.log(`[R1] ${formatScreen(screen)} | actually ${overLimit ? 'OVER' : 'inside'} the envelope`);
      if (overLimit) {
        expect(screen.verdict, `${shape.name} is over the envelope and was screened CLEAR`).not.toBe('CLEAR');
      }
    }
    // C3 is the one shape in the basis that is actually over, and the screen must not clear it.
    const c3 = F2_BASIS.find((shape) => shape.name === 'C3 max graph')!;
    expect(c3.serializedBytes).toBeGreaterThan(BCH_2026_STANDARD.maximumTransactionSize);
    expect(screenProductionEnvelope(c3.spec, calibration, allowances).verdict).not.toBe('CLEAR');
  });

  /**
   * FAIL CLOSED ON THE UNKNOWN. A descriptor outside the calibrated driver ranges can never be CLEAR,
   * however small its numbers look: an upper envelope carries no guarantee outside the range it was fitted
   * on, and the screen refuses to launder an extrapolation into a green light.
   */
  it('MEASURED: an out-of-range descriptor is never screened CLEAR', () => {
    const calibration = deriveCalibration(F2_BASIS, F2_BASIS_COMMIT);
    const allowances = { overPrediction: 0.42, underPrediction: 0.13 };
    const tiny = screenProductionEnvelope({
      name: 'tiny but unseen',
      family: 'graph',
      participants: 8,
      invocations: 24,
      blockSizes: Array.from({ length: 8 }, () => 1),
      redeemBytes: Array.from({ length: 8 }, () => 200),
    }, calibration, allowances);
    console.log(`[R1] ${formatScreen(tiny)} | outOfRange ${JSON.stringify(tiny.outOfRange)}`);
    expect(tiny.outOfRange.length).toBeGreaterThan(0);
    expect(tiny.verdict).not.toBe('CLEAR');
  });
});
