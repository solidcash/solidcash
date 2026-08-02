/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { layer3 } from '../src/index.js';

const artifact = compileString(`pragma solidcash >=0.8.0;
  contract AuthorityBuild() {
    int counter;
    function set(int next) public { this.counter = next; require(next >= 0); }
  }`, { forceStateful: true, hiddenBatch: true });

const plan = layer3.planCompiledGraph(
  [{ artifact, lockingBytecode: '51' }],
  [{ parent: null, callee: 0, function: 'set', args: [1n] }],
);
const transcript = layer3.finalizeCompiledGraph(plan);
const layout = layer3.compiledGraphPhysicalLayout(plan);

const slots = () => Array.from({ length: layout.totalSlots }, (_unused, input) => ({
  utxo: { txid: input.toString(16).padStart(64, '0'), vout: input, satoshis: 1000n },
  unlock: { input },
  output: { to: Uint8Array.of(0x51) as unknown as string, amount: 1000n },
}));

describe('compiled graph authority acquisition/build boundary', () => {
  it('derives canonical claims internally and builds the honest physical layout', () => {
    const builder = layer3.buildCompiledGraphTransaction({}, transcript, slots());
    expect(builder).toBeDefined();
  });

  it('refuses a duplicated resource/system outpoint before adding transaction inputs', () => {
    const aliased = slots();
    aliased[1] = { ...aliased[1], utxo: { ...aliased[1].utxo, ...aliased[0].utxo } };
    expect(() => layer3.buildCompiledGraphTransaction({}, transcript, aliased)).toThrow(
      expect.objectContaining({
        code: 'L3_DUPLICATE_OUTPOINT',
        context: expect.objectContaining({ participant: 1 }),
      }),
    );
  });

  it('refuses a mutable owner whose finalized artifact is no longer transcript-capable', () => {
    const unsupported = {
      ...transcript,
      plan: {
        ...transcript.plan,
        participants: transcript.plan.participants.map((participant) => ({
          ...participant,
          artifact: { ...participant.artifact, hiddenBatch: undefined },
        })),
      },
    } as layer3.FinalizedCompiledGraph;
    expect(() => layer3.buildCompiledGraphTransaction({}, unsupported, slots())).toThrow(
      expect.objectContaining({
        code: 'L3_MUTABLE_ARTIFACT_UNSUPPORTED',
        context: expect.objectContaining({ ownerIdentity: '51', participant: 0 }),
      }),
    );
  });
});
