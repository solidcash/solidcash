import { describe, expect, it } from 'vitest';
import { appendEarlyDelegateOutputs } from '../../src/stateful/stb-append-early-delegate-outputs.js';
import type { Output } from '../../src/interfaces.js';

const ownerCategory = '11'.repeat(31) + 'ee';
const calleeCategory = '22'.repeat(31) + 'dd';

function buildEarlyDelegateOutputs(plannedReturnOutputIndex: number): Output[] {
  const outputs: Output[] = [
    { to: Uint8Array.of(0x51), amount: 1000n }, // owner master
    { to: Uint8Array.of(0x51), amount: 1000n }, // delegate implementation master
  ];
  const builder = {
    outputs,
    addOutput(output: Output) { outputs.push(output); return this; },
  };
  appendEarlyDelegateOutputs(
    {
      delegateEntriesAfterLowLevel: true,
      delegateReturnEventAfterEvents: false,
      plannedReturnOutputIndex,
      categoryId: ownerCategory,
      lowLevelCallUtxoGroups: [],
      pendingReturnEventOutputs: [{
        categoryId: ownerCategory,
        commitment: Uint8Array.of(0x2a),
        identity: ownerCategory,
      }],
    },
    builder as never,
    {
      associatedDelegateOutputs: { has: () => false },
      appendDelegateGroupOutputs: () => {},
      appendDelegateLoopEntries: () => {},
    },
    (target, _identity, output) => target.addOutput(output),
    [],
  );
  // The next external participant is materialized after this delegate band.
  builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n,
    token: { category: calleeCategory, amount: 0n,
      nft: { capability: 'minting', commitment: '' } } });
  return outputs;
}

describe('legacy delegate return slot alignment', () => {
  it('keeps an adjacent return event before the next participant', () => {
    const outputs = buildEarlyDelegateOutputs(2);
    expect(outputs[2]?.token?.category).toBe(ownerCategory);
    expect(outputs[3]?.token?.category).toBe(calleeCategory);
  });

  it('reserves intervening balanced slots before a computed external return', () => {
    const outputs = buildEarlyDelegateOutputs(4);
    expect(outputs[2]?.token).toBeUndefined();
    expect(outputs[3]?.token).toBeUndefined();
    expect(outputs[4]?.token?.category).toBe(ownerCategory);
    expect(outputs[5]?.token?.category).toBe(calleeCategory);
  });

  it('rejects a delegated return plan that overlaps an existing physical output', () => {
    expect(() => buildEarlyDelegateOutputs(1)).toThrow(
      'Delegated return output 1 overlaps an occupied physical slot',
    );
  });
});
