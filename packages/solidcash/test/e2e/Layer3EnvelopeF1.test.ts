import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  BCH_2026_CONSENSUS, BCH_2026_STANDARD, ORDINARY_LIMITS, assessEnvelope, densityKnobControl, formatEnvelope,
  hashAllowancesFor, hashKnobControl, knobControlBudgetFor,
} from './layer3-envelope-f1.js';

/**
 * F1. The measurement basis for the production envelope.
 *
 * This file pins the real BCH-2026 limits and measures the 2/4/8 participant-binding sweep against ALL of
 * them at once, consensus and standard relay policy alike. It asserts NOTHING about the capstones: those are
 * measured by observing their own builders through `layer3-envelope-probe.ts`, because a copied builder
 * measures the copy.
 *
 * NOTHING HERE IS A `CONSENSUS_FIT` OR `POLICY_FIT` CLAIM. A measurement is a point-in-time reading of one
 * shape at one commit. Promotion is the board's to make, and needs the full shape, not one sweep.
 *
 * MEASURED ENVELOPE, THE SWEEP ROWS AT `5e03daee` (X48, the two hash regimes split and each evaluated by the
 * instruction set that implements it) AND THE FOUR CAPSTONE ROWS RE-MEASURED AT `1591e87f` (X66). Every figure
 * below was read run-to-completion through this harness, and every shape was ALSO re-evaluated with nothing
 * relaxed - zero inputs refused, at the real consensus allowance AND the real standard one - with
 * knob-liveness controls that bite on the same bytes. The three sweep rows are asserted by this file; the four
 * capstone rows come from `layer3-estimator-probe.ts` observing each capstone's own builder, and are recorded
 * rather than asserted.
 *
 *   shape          part  inputs  serialized   relay%   worst density        binds first          worst hash
 *   N=2             2       3       2,429B     2.4%   0.2177x @ input 2    SigChecks  0.2500x   0.1078x std
 *   N=4             4       5       4,977B     5.0%   0.2570x @ input 1    op-cost    0.2570x   0.1078x std
 *   N=8             8       9      10,661B    10.7%   0.3630x @ input 1    op-cost    0.3630x   0.1078x std
 *   A13 graph       3       8      23,458B    23.5%   0.4067x @ input 6    script B   0.5002x   0.1078x std
 *   C2 cycle        4      79      52,733B    52.7%   0.6491x @ input 77   op-cost    0.6491x   0.1078x std
 *   C1 DeFi         5      38      62,722B    62.7%   0.6183x @ input 36   script B   0.7451x   0.1078x std
 *   C3 max graph    8     108      99,670B    99.7%   0.9218x @ input 106  RELAY SIZE 0.9967x   0.1078x std
 *
 * THE BINDING LIMIT IS NOT THE SAME ONE TWICE, and it is not always density. C1 and A13 bind on the
 * 10,000-byte per-input script limit, C2 and the sweep on operation-cost density, N=2 on per-input SigChecks,
 * C3 on the 100,000-byte standard relay ceiling. NOTHING IN THIS TABLE IS OVER ANY LIMIT ANY MORE. That is
 * the X66 change and it is a change of verdict, not of digits: C3 was 650 bytes over the relay ceiling and is
 * now 330 bytes under it, at 0.9967x, with all 108 slots intact.
 *
 * THE CORRECTED HASH REGIME MOVES NOTHING, and that is now measured rather than assumed. Every shape binds on
 * the same limit it bound on at `4ac40b82`, at the same ratio.
 *
 * WHY IT MOVES NOTHING, as a number. Worst hash usage anywhere in the envelope is 0.1078x of the real standard
 * allowance, and the input that sets it is the same one in all seven shapes: the 126-byte P2PKH fee funder, 9
 * iterations against an 83-iteration allowance. The multi-kilobyte Layer-3 covenant inputs, which do up to 177
 * iterations, top out at 0.0487x - their density budget grows with their script faster than their hashing does.
 * A shape could only be masked by the other fixtures' 3-per-byte knob if it landed between 1.0x and 6.0x of the
 * standard allowance; the envelope is 9.3x below the bottom of that window.
 *
 * THE SIZES MOVED TWICE, AND BOTH MOVES ARE ATTRIBUTABLE TO ONE COVENANT. The projection verifier is ONE
 * generated covenant instantiated once per PARTICIPANT, and each proof slot's unlocking script pushes the
 * whole redeem script, so one verifier byte is worth N transaction bytes. X5 added 37 (A13 23,734 -> 23,845,
 * C2 53,101 -> 53,249, C1 63,130 -> 63,315, C3 100,354 -> 100,650, each exactly 37 x N). F4 then removed 129
 * (A13 -> 23,458, C2 -> 52,733, C1 -> 62,722, C3 -> 99,670). A13 and C2 moved by exactly 129 x N; C1 and C3
 * moved by 129 x N less 52, which is one participant's compiled script growing 28 bytes in each plus 24 bytes
 * of output set in each. These are properties of the BUILT TRANSACTION, which no VM knob can reach.
 *
 * Every worst-DENSITY ratio reproduces, because the worst-cost input of each capstone is a controller or a
 * participant and never a projection: C2 to ten decimals and A13 to ten, C1 and C3 to four, the difference
 * being the one master whose script grew. The 2/4/8 synthetic sweep is untouched and reproduces exactly,
 * 10,661 B and 0.3630x at N=8.
 *
 * C3 IS NOW UNDER THE STANDARD RELAY CEILING, BY 330 BYTES - AND THAT OVERTURNS A CONCLUSION rather than
 * merely restating a figure. THREE TIMES OVER, which is the reason this paragraph is kept rather than
 * deleted. F1 costed a C3 fix against the pre-X5 100,354 - remove the two cheapest slot pairs, free 388, land
 * at 99,966 - and X5 made that arithmetic wrong (100,650 - 388 = 100,262). This note then costed the four-pair
 * fix at 99,840 and the 62-slot Ledger reclaim at 87,602. F4 cleared the overrun with NO slot removed at all,
 * so every one of those options is headroom rather than a plan, and the reclaim now lands at 86,622. A dated
 * table needs its consequences re-derived, not just its numbers refreshed.
 *
 * WHERE THE RE-DERIVATION STILL HAS TO LAND, reported rather than done here because the file is not this
 * row's: `Layer3ProductionEnvelopeR1.test.ts` asserts "C3 is the one shape in the basis that is actually
 * over" as the positive control of its screen test. No shape in the basis is over anything now, so that
 * control has no subject and the row's author has to choose one - a synthetic over-limit descriptor is the
 * obvious candidate, but which one is a design decision, not a re-pin.
 *
 * Every figure above was derived from a build, never copied from a recorded table. Where a fixture's own
 * comment records a different number, the difference is reported rather than reconciled here: the fixtures'
 * ASSERTIONS all still pass against these readings, which is the property that matters.
 */

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
 * The participant-binding fixture, carried over from `Layer3ScalingSpike` so the sweep measures the same
 * subject the ledger's 36.5% figure was taken on. It performs the O(N) introspection that drives operation
 * cost: output preservation plus one unlocking-bytecode read per participant.
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

async function buildSweep(n: number): Promise<{
  transaction: ReturnType<TransactionBuilder['buildLibauthTransaction']>;
  sourceOutputs: ReturnType<typeof generateLibauthSourceOutputs>;
}> {
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
  };
}

describe('F1 envelope: the limits themselves', () => {
  /**
   * These are the numbers every capacity claim on this board is measured against, so they are pinned. If a
   * libauth upgrade moves one, this fails and the board re-measures rather than silently re-basing.
   */
  it('MEASURED: the real BCH-2026 consensus and standard limits', () => {
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
   * THE POLICY GAP that X48 names, stated as arithmetic on the pinned constants, and kept because it still
   * describes every OTHER Layer-3 "ordinary capacity" fixture in this repository. Those pass a single
   * `hashDigestIterationsPerByte: 3`. Against the real allowances that is 0.86x of consensus - mildly
   * conservative - and 6x standard. A shape can pass all of them and still be unrelayable on hashing density
   * alone, and none of them would show it. The `ORDINARY_LIMITS` profile below no longer has that hole.
   */
  it('MEASURED: a single hash-iteration knob cannot express both regimes', () => {
    const fixtureKnob = 3;
    expect(fixtureKnob / BCH_2026_CONSENSUS.hashDigestIterationsPerByte).toBeCloseTo(0.857, 3);
    expect(fixtureKnob / BCH_2026_STANDARD.hashDigestIterationsPerByte).toBe(6);
    // And the cost coefficient runs the other way: relaying a hash costs three times what mining it costs.
    expect(BCH_2026_STANDARD.hashDigestIterationCost / BCH_2026_CONSENSUS.hashDigestIterationCost).toBe(3);
  });

  /**
   * X48: `ConsensusLimits` now carries the two allowances separately, so the ordinary profile states both real
   * values at once instead of two profiles each pretending to be the whole story. The regime is selected at
   * the VM, not by swapping profiles.
   */
  it('MEASURED: the ordinary profile now carries both real allowances', () => {
    expect(ORDINARY_LIMITS.hashDigestIterationsPerByteStandard).toBe(0.5);
    expect(ORDINARY_LIMITS.hashDigestIterationsPerByteNonstandard).toBe(3.5);
    // The shared fallback is the TIGHTER of the two, so any caller that ignores the split is conservative
    // rather than optimistic - the failure mode X48 found was the opposite one.
    expect(ORDINARY_LIMITS.hashDigestIterationsPerByte).toBe(0.5);
    expect(ORDINARY_LIMITS.operationCostBudgetPerByte).toBe(800);
  });
});

describe('F1 envelope: the 2/4/8 participant sweep', () => {
  it('MEASURED: per-input density, sizes and every limit, for N=2,4,8', async () => {
    const envelopes = [];
    for (const n of [2, 4, 8]) {
      const built = await buildSweep(n);
      const { transaction, sourceOutputs } = built;
      const envelope = assessEnvelope(`participant-binding N=${n}`, transaction as never, sourceOutputs);
      console.log(`[F1] ${formatEnvelope(envelope)}`);
      console.log(`[F1] N=${n} binding order: ${JSON.stringify(
        envelope.binding.map((row) => `${row.limit}=${row.ratio.toFixed(4)}`),
      )}`);
      const worst = envelope.worstHashInput;
      console.log(`[F1] N=${n} hash: iterations=${worst.hashIterations}`
        + ` stdAllowance=${worst.standardHashAllowance} consAllowance=${worst.consensusHashAllowance}`
        + ` stdCost=${worst.standardCost} consCost=${worst.consensusCost}`);
      envelopes.push({ n, envelope, built });
    }

    for (const { envelope } of envelopes) {
      // Every input runs to completion inside the ordinary 800/byte budget, and inside BOTH hash-iteration
      // allowances. Bands, not exact figures, so unrelated compiler work does not falsely fail here.
      expect(envelope.worstCostInput.standardCostRatio).toBeLessThan(1);
      expect(envelope.worstHashInput.standardHashRatio).toBeLessThan(1);
      expect(envelope.worstUnlockingInput.unlockingBytesRatio).toBeLessThan(1);
      // This sweep stays well under the relay ceiling; recorded so the contrast with the capstones, which do
      // not, is a measured one rather than an asserted one. N=8 already reaches 10.7% of it on binding alone.
      expect(envelope.standardSizeRatio).toBeLessThan(0.2);
      // ACCEPTANCE with NOTHING relaxed, in both regimes. This is what makes the reading above more than a
      // relaxed-budget artifact: these exact bytes are accepted at the real 800/byte budget, at the real 3.5
      // consensus hash allowance AND at the real 0.5 standard one.
      expect(envelope.refusedAtConsensus).toEqual([]);
      expect(envelope.refusedAtStandard).toEqual([]);
    }

    // THE KNOB-LIVENESS CONTROL. "Inside capacity at 800/byte" is only evidence if the knob can refuse these
    // exact bytes. Same transaction, same source outputs, half the density the input was measured to need:
    // it must now fail. Without this, an accepted reading may only mean the evaluation never ran.
    //
    // The control budget is DERIVED from the reading rather than fixed. A fixed quarter-of-ordinary control
    // passes vacuously here: N=2 measures 0.2177x, survives a four-fold cut, and proves nothing.
    for (const { n, envelope, built } of envelopes) {
      const budget = knobControlBudgetFor(envelope.worstCostInput);
      expect(budget).toBeLessThan(BCH_2026_CONSENSUS.operationCostBudgetPerByte);
      const error = densityKnobControl(
        built.transaction as never, built.sourceOutputs, envelope.worstCostInput.input, budget,
      );
      expect(error, `the operation-cost knob does not bite at N=${n} on ${budget}/byte`).toBeDefined();
      expect(String(error)).toMatch(/density|operation cost/i);
    }

    // THE HASH-KNOB LIVENESS CONTROL (X48), in two halves, because a read-back alone could still be a knob
    // that is read and then ignored, and a refusal alone could still come from the wrong knob.
    //
    // HALF ONE, INDEPENDENCE. One limits object setting the two allowances to different values must produce
    // two DIFFERENT initialized allowances. Before the split these two readings were the same number for any
    // input, which is exactly the defect: the nonstandard write was dead and the standard write was whatever
    // the fixture happened to pass.
    for (const { n, envelope, built } of envelopes) {
      const row = envelope.worstHashInput;
      const allowances = hashAllowancesFor(
        built.transaction as never, built.sourceOutputs, row.input, ORDINARY_LIMITS,
      );
      expect(allowances.standard).toBe(Math.floor(allowances.densityBytes * 0.5));
      expect(allowances.nonstandard).toBe(Math.floor(allowances.densityBytes * 3.5));
      expect(allowances.nonstandard, `the two hash regimes are not independent at N=${n}`)
        .toBeGreaterThan(allowances.standard);
      // And the same two figures are what `measureInputs` recorded from the run-to-completion profile, where
      // both regimes share the 3000 fallback: equal there, which is the control on the control.
      expect(row.standardHashAllowance).toBe(row.consensusHashAllowance);
    }

    // HALF TWO, REFUSAL, as a 2x2. Drive ONE knob below what the input was measured to need, leave the other
    // wide, and evaluate in BOTH regimes. The tightened knob's own regime must refuse on hash-iteration
    // density; the other regime must not, which is what proves the refusal came from the knob under test.
    for (const { n, envelope, built } of envelopes) {
      const row = envelope.worstHashInput;
      // A shape that hashes nothing would make this control vacuous, so that is checked rather than assumed.
      expect(row.hashIterations, `nothing to tighten against at N=${n}`).toBeGreaterThan(0);
      const tooTight = (row.hashIterations - 1) / row.densityBytes;
      for (const knob of ['standard', 'nonstandard'] as const) {
        const tighten = knob === 'standard' ? { standard: tooTight } : { nonstandard: tooTight };
        const ownRegime = knob === 'standard';
        const bites = hashKnobControl(
          built.transaction as never, built.sourceOutputs, row.input, tighten, ownRegime,
        );
        expect(bites, `the ${knob} hash knob does not bite at N=${n}`).toBeDefined();
        expect(String(bites)).toMatch(/hash digest iteration/i);
        const other = hashKnobControl(
          built.transaction as never, built.sourceOutputs, row.input, tighten, !ownRegime,
        );
        expect(other, `tightening ${knob} leaked into the other regime at N=${n}`).toBeUndefined();
      }
    }

    // The nonstandard instruction set reports the consensus operation cost directly. It must agree with the
    // arithmetic reprice at 64 per iteration that this harness used before it could run the regime at all.
    for (const { n, envelope } of envelopes) {
      for (const row of envelope.inputs) {
        expect(row.consensusHashIterations, `hash iterations differ by regime at N=${n} input ${row.input}`)
          .toBe(row.hashIterations);
        expect(row.consensusCost, `measured and derived consensus cost differ at N=${n} input ${row.input}`)
          .toBe(row.derivedConsensusCost);
      }
    }
  }, 900_000);
});
