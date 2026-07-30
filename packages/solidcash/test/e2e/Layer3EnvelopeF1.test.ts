import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { acceptedByNode } from './layer3-semantic-profile.js';
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
 * instruction set that implements it) AND THE FOUR CAPSTONE ROWS RE-MEASURED AT `77cd1e8c`. Every figure
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
 *   A13 graph       3       8      22,126B    22.1%   0.4067x @ input 6    script B   0.4558x   0.1078x std
 *   C2 cycle        4      79      50,957B    51.0%   0.6491x @ input 77   op-cost    0.6491x   0.1078x std
 *   C1 DeFi         5      38      60,502B    60.5%   0.6183x @ input 36   script B   0.7451x   0.1078x std
 *   C3 max graph    8     108      96,118B    96.1%   0.9218x @ input 106  RELAY SIZE 0.9612x   0.1078x std
 *
 * ERRATA, R3-13. THE FOUR CAPSTONE ROWS ARE THE `77cd1e8c` READING and their serialized column has moved
 * since. X81 put 23 bytes back on the projection verifier redeem script and every shape pays it once per
 * participant, so at `3281ece9`, each read from that capstone's own capacity test:
 *
 *   A13 22,126 -> 22,195 (22.2%)   C2 50,957 -> 51,049 (51.0%)
 *   C1  60,502 -> 60,617 (60.6%)   C3  96,118 -> 96,302 (96.3%)
 *
 * +69 / +92 / +115 / +184 is 23 x N exactly on all four. ONE ratio above is a pure function of size and moves
 * with it: C3's RELAY SIZE binding ratio is 0.9630, not 0.9612, and its headroom under the 100,000-byte
 * ceiling is 3,698 bytes rather than 3,882. The three worst-DENSITY figures for C1, C2 and C3 reproduce
 * exactly at `3281ece9` (0.6183, 0.6491, 0.9218). A13's script-bytes ratio and every hash column were NOT
 * re-measured for this errata and remain the `77cd1e8c` reading. The three SWEEP rows are the ones this file
 * asserts, and they are untouched - re-broadcast and mined at 2,429 / 4,977 / 10,661 B by the node block at
 * the bottom of this file.
 *
 * THE FOUR CAPSTONE ROWS MOVED AGAIN, and the whole move is one covenant. X65 cut the projection verifier
 * 4,542 -> 4,098, and it is instantiated once per PARTICIPANT with each proof slot pushing the whole redeem
 * script, so each shape paid 444 x N: A13 -1,332, C2 -1,776, C1 -2,220, C3 -3,552. The 23,458 / 52,733 /
 * 62,722 / 99,670 this table published were the post-F4, pre-X65 readings at `1591e87f`. TWO ratios moved with
 * them and are re-derived here rather than carried: A13's binding ratio 0.5002x -> 0.4558x and C3's 0.9967x ->
 * 0.9612x. C2's 0.6491x and C1's 0.7451x reproduce exactly, and so does every worst-DENSITY ratio, because the
 * worst-cost input of each capstone is a controller or a participant and never a projection.
 *
 * THE BINDING LIMIT IS NOT THE SAME ONE TWICE, and it is not always density. C1 and A13 bind on the
 * 10,000-byte per-input script limit, C2 and the sweep on operation-cost density, N=2 on per-input SigChecks,
 * C3 on the 100,000-byte standard relay ceiling. NOTHING IN THIS TABLE IS OVER ANY LIMIT. That was the X66
 * change and it was a change of verdict, not of digits: C3 was 650 bytes over the relay ceiling, then 330
 * under it, and is now 3,882 under, with all 108 slots intact. C3's margin has stopped being a near miss.
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
 * THE SIZES HAVE NOW MOVED THREE TIMES, AND EVERY MOVE IS ATTRIBUTABLE TO ONE COVENANT. The projection
 * verifier is ONE generated covenant instantiated once per PARTICIPANT, and each proof slot's unlocking script
 * pushes the whole redeem script, so one verifier byte is worth N transaction bytes.
 *
 *   X5,  +37  per participant: A13 23,734 -> 23,845, C2 53,101 -> 53,249, C1 63,130 -> 63,315,
 *                              C3 100,354 -> 100,650. Exactly 37 x N on all four.
 *   F4,  -129 per participant: A13 -> 23,458, C2 -> 52,733, C1 -> 62,722, C3 -> 99,670. Exactly 129 x N on
 *                              A13 and C2; C1 and C3 moved by 129 x N LESS 52, one participant's compiled
 *                              script growing 28 bytes in each plus 24 bytes of output set in each.
 *   X65, -444 per participant: A13 -> 22,126, C2 -> 50,957, C1 -> 60,502, C3 -> 96,118. Exactly 444 x N on
 *                              ALL FOUR - no residue this time, re-measured at `77cd1e8c`.
 *
 * These are properties of the BUILT TRANSACTION, which no VM knob can reach.
 *
 * Every worst-DENSITY ratio reproduces across all three moves, because the worst-cost input of each capstone is
 * a controller or a participant and never a projection. The 2/4/8 synthetic sweep is untouched and reproduces
 * exactly, 10,661 B and 0.3630x at N=8. The two BINDING ratios that are functions of size did move, and are
 * re-derived above rather than carried: A13 0.5002x -> 0.4558x, C3 0.9967x -> 0.9612x.
 *
 * C3 IS NOW 3,882 BYTES UNDER THE STANDARD RELAY CEILING - AND THAT OVERTURNS A CONCLUSION rather than merely
 * restating a figure. FOUR TIMES OVER, which is the reason this paragraph is kept rather than deleted. F1
 * costed a C3 fix against the pre-X5 100,354 - remove the two cheapest slot pairs, free 388, land at 99,966 -
 * and X5 made that arithmetic wrong (100,650 - 388 = 100,262). This note then costed the four-pair fix at
 * 99,840 and the 62-slot Ledger reclaim at 87,602. F4 cleared the overrun with NO slot removed at all, so
 * every one of those options became headroom rather than a plan, and the reclaim then landed at 86,622. X65
 * moved it AGAIN, to 83,070 on the same arithmetic - which is the point: a costed option whose input keeps
 * moving is not a plan, and none of these has ever been needed. A dated table needs its consequences
 * re-derived, not just its numbers refreshed.
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
  /**
   * R3-15. THE SERIALIZED BYTES AND THE PROVIDER THAT MINTED THEIR OUTPOINTS, so the node block at the bottom
   * of this file can offer these exact bytes to BCHN rather than a copy of the builder. `createTestProvider`
   * is `RegtestNetworkProvider` under `TESTS_USE_REGTEST`, so under that flag every outpoint the sweep spends
   * is a real UTXO the node holds and the node executes the scripts instead of stopping at `missing-inputs`.
   */
  hex: string;
  provider: ReturnType<typeof createTestProvider>;
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
    hex: builder.build(),
    provider,
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

/**
 * R3-15. THE SWEEP'S NODE EVIDENCE, COMMITTED.
 *
 * X49 promoted the 2/4/8 participant-binding sweep to `CONSENSUS_FIT` - and nothing else - because those
 * three shapes were accepted and mined by a real BCHN node while A13/C2/C1/C3 only ever reached
 * `missing-inputs`. That was the correct call and it is the most carefully scoped promotion on the board. It
 * was also the one nobody could re-run: the shapes are built in exactly ONE place, `buildSweep` above, and
 * this file contained no call to `sendRawTransaction`. The bytes reached a node through a three-step manual
 * procedure whose SECOND step - submitting the captured JSONL - had no committed implementation.
 * `layer3-broadcast-probe.ts` captures; nothing submitted. So the board's highest-evidence claim had its
 * weakest reproduction path.
 *
 * This block is the missing step, and it does not need the capture at all. `buildSweep` already builds
 * through `createTestProvider`, which is `RegtestNetworkProvider` under `TESTS_USE_REGTEST`, so the outpoints
 * are real and the node can execute the scripts. Broadcasting is then one call on the same provider that
 * minted them - which is what makes a capture-and-replay round trip unnecessary, and why the replay was never
 * able to settle script validity in the first place: replayed mock outpoints exist on no chain.
 *
 * WHAT A PASS HERE ESTABLISHES: BCHN accepted each of the three shapes into its mempool and mined it, having
 * executed every input script under real BCH-2026 consensus and real standard relay policy. `acceptedByNode`
 * reads the transaction back FROM THE NODE and refuses a txid whose stored bytes differ, so "the node kept
 * exactly these bytes" is a reading rather than an inference. Nothing is relaxed: `RegtestNetworkProvider`
 * carries no `consensusLimits`.
 *
 * WHAT IT DOES NOT ESTABLISH: anything about a shape not built here, and nothing about mainnet. It is
 * evidence about three transactions, at one commit, on regtest.
 *
 * Requires the docker regtest stack; see the root CLAUDE.md. Skipped by an ordinary `yarn test`, exactly as
 * the four capstone node blocks are.
 */
describe.runIf(process.env.TESTS_USE_REGTEST)('R3-15: the 2/4/8 sweep on a real BCHN node', () => {
  it('CONSENSUS: BCHN executes, accepts and mines each of N=2, N=4 and N=8', async () => {
    const accepted: { n: number; serializedBytes: number; inputCount: number; blockHeight: number }[] = [];
    for (const n of [2, 4, 8]) {
      const built = await buildSweep(n);
      // The shape is the one this file measures everywhere else - the same builder, not a copy of it. The
      // input count is asserted so a build that silently lost a participant cannot be broadcast as the sweep.
      expect(built.transaction.inputs).toHaveLength(n + 1);
      const node = await acceptedByNode(built.provider as never, built.transaction, built.hex);
      console.log(`[R3-15] N=${n} accepted by BCHN: ${node.txid} at height ${node.blockHeight}, `
        + `${node.serializedBytes} B, ${node.inputCount} inputs`);
      // A node that accepts AND MINES a transaction has executed every input script. This is the reading
      // `missing-inputs` could never give.
      expect(node.blockHeight).toBeGreaterThan(0);
      expect(node.inputCount).toBe(n + 1);
      accepted.push({ n, serializedBytes: node.serializedBytes, inputCount: node.inputCount,
        blockHeight: node.blockHeight });
    }
    // All three, not one: the promotion was made for N=2, N=4 AND N=8, so a block that broadcast the smallest
    // and stopped would leave two thirds of it unreproduced.
    expect(accepted.map((row) => row.n)).toEqual([2, 4, 8]);
    // Monotone in participants, which is the one cross-shape property this block can check for free: a run
    // where N=8 came back no larger than N=2 would mean the three builds are not the sweep.
    expect(accepted[2].serializedBytes).toBeGreaterThan(accepted[1].serializedBytes);
    expect(accepted[1].serializedBytes).toBeGreaterThan(accepted[0].serializedBytes);
    console.log(`[R3-15] serialized bytes as mined: ${accepted.map((row) => `N=${row.n} ${row.serializedBytes}B`)
      .join(', ')}`);
  }, 900_000);
});
