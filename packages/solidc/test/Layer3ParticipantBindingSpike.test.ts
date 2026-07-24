import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const PARTICIPANT = `
pragma solidcash >=0.8.0;
contract Participant() {
  function __layer3_bind(
    bigint input0,
    bigint output0,
    bytes category0,
    bytes lockingBytecode0,
    bigint input1,
    bigint output1,
    bytes category1,
    bytes lockingBytecode1
  ) public {
    require(input0 < input1);
    require(output0 < output1);
    require(lockingBytecode0 != lockingBytecode1);
    require(category0.length == 33 && category1.length == 33);
    require(category0.slice(32, 33) == hex"02");
    require(category1.slice(32, 33) == hex"02");
    require(tx.inputs[input0].lockingBytecode == lockingBytecode0);
    require(tx.inputs[input1].lockingBytecode == lockingBytecode1);
    require(tx.inputs[input0].tokenCategory == category0);
    require(tx.inputs[input1].tokenCategory == category1);
    require(tx.outputs[output0].lockingBytecode == lockingBytecode0);
    require(tx.outputs[output1].lockingBytecode == lockingBytecode1);
    require(tx.outputs[output0].tokenCategory == category0);
    require(tx.outputs[output1].tokenCategory == category1);
    require(
      this.activeInputIndex == input0
      || this.activeInputIndex == input1
    );
  }
}
`;

describe('layer-3 participant-binding spike', () => {
  it('keeps transaction introspection rejected by the production SCB1 surface', () => {
    const artifact = compileString(PARTICIPANT, {
      forceStateful: true,
      experimentalHiddenBatch: true,
    });
    expect(artifact.hiddenBatch).toBeUndefined();
  });

  it('admits only the reserved spike handler without advertising layer-3 metadata', () => {
    const artifact = compileString(PARTICIPANT, {
      forceStateful: true,
      experimentalHiddenBatch: true,
      experimentalLayer3BindingSpike: true,
    });
    const handler = artifact.hiddenBatch?.handlers.find((candidate) =>
      candidate.name === '__layer3_bind');
    expect(handler).toMatchObject({ eligible: true });
    expect(artifact.abi.some((entry) => entry.name === '__scb1')).toBe(false);
    expect(Object.keys(artifact).some((key) => key.toLowerCase().includes('layer3'))).toBe(false);
  });
});
