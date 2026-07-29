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
 * MEASURED ENVELOPE AT `4ac40b82`. Every figure below was read run-to-completion through this harness, and
 * every shape was ALSO re-evaluated with nothing relaxed - zero inputs refused, at both the real consensus
 * hash allowance and the real standard one - with a knob-liveness control that bites on the same bytes.
 *
 *   shape          part  inputs  serialized   relay%   worst density        binds first
 *   A13 graph       3       8      23,734B    23.7%   0.4067x @ input 6    unlocking bytes  0.5094x
 *   C2 cycle        4      79      53,101B    53.1%   0.6491x @ input 77   op-cost density  0.6491x
 *   C1 DeFi         5      38      63,130B    63.1%   0.6182x @ input 36   unlocking bytes  0.7451x
 *   C3 max graph    8     108     100,354B   100.4%   0.9217x @ input 106  RELAY SIZE       1.0035x
 *
 * THE BINDING LIMIT IS NOT THE SAME ONE TWICE, and it is not always density. C1 binds on the 10,000-byte
 * per-input script limit, C2 on operation-cost density, C3 on the 100,000-byte standard relay ceiling. Only
 * C3 is over anything, and what it is over is a POLICY limit: it is inside every consensus limit measured.
 *
 * C3's overrun is 354 bytes, 0.35%. Costed against the measured per-slot serialized sizes: the two cheapest
 * slot pairs are 177 and 211 bytes, so removing two frees 388 and lands at 99,966. The fixture's own note
 * that 62 of its 108 slots are an unused Ledger trailing region prices the same fix at 13,048 bytes, landing
 * at 87,306 (87.3%). Equivalently, 45 bytes off each of the eight projection scripts, or 354 off the single
 * controller script, a 12.4% cut. Which slots are removable is a design question, not a measurement one.
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
   * THE POLICY GAP, stated as arithmetic on the pinned constants. Every Layer-3 "ordinary capacity" provider
   * in this repository sets a single `hashDigestIterationsPerByte`, and `createVirtualMachine.ts` writes that
   * one value into BOTH the standard and the nonstandard knob. The fixtures pass 3. That is 0.86x of the real
   * consensus allowance - mildly conservative - and 6x the real standard allowance. So a shape can pass every
   * one of those fixtures and still be unrelayable on hashing density alone, and no fixture would show it.
   */
  it('MEASURED: the single hash-iteration knob cannot express both regimes', () => {
    const fixtureKnob = 3;
    expect(fixtureKnob / BCH_2026_CONSENSUS.hashDigestIterationsPerByte).toBeCloseTo(0.857, 3);
    expect(fixtureKnob / BCH_2026_STANDARD.hashDigestIterationsPerByte).toBe(6);
    // And the cost coefficient runs the other way: relaying a hash costs three times what mining it costs.
    expect(BCH_2026_STANDARD.hashDigestIterationCost / BCH_2026_CONSENSUS.hashDigestIterationCost).toBe(3);
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
  }, 900_000);
});
