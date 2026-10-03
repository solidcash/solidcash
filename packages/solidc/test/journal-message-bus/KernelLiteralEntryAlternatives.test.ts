import { describe, expect, it } from 'vitest';
import { compileString } from '../../dist/compiler.js';

const compileKeys = (secondKey: number): ReturnType<typeof compileString> => compileString(
  `pragma solidcash >=0.8.0;
    interface ICounter { function bump() external; }
    contract Coordinator() {
      mapping(int => int) balances;
      function poke(address counter, int value) public {
        this.balances[3] = value;
        this.balances[${secondKey}] = value + 1;
        ICounter(counter).bump();
      }
    }`, {
    forceStateful: true,
    messageBus: true,
    messageBusKernel: true,
    maximumInputBytes: 1_000_000,
    suppressWarnings: true,
  },
);

describe('kernel literal entry alternatives', () => {
  it('reuses one physical entry when two writes name the same literal key', () => {
    const artifact = compileKeys(3);
    const handler = artifact.delegateArtifact!.messageBus!.handlers.find((entry) => entry.name === 'poke')!;
    expect(handler).toMatchObject({ eligible: true });
    expect(handler.batchKeyWitnesses?.map((entry) => entry.expressionLabel)).toEqual(['const:3']);
    expect(new Set(handler.physicalEntrySlots).size).toBe(1);
  });

  it('publishes separate authenticated entry slots for distinct literal keys', () => {
    const artifact = compileKeys(4);
    const handler = artifact.delegateArtifact!.messageBus!.handlers.find((entry) => entry.name === 'poke')!;
    expect(handler).toMatchObject({ eligible: true });
    expect(handler.batchKeyWitnesses?.map((entry) => entry.expressionLabel))
      .toEqual(['const:3', 'const:4']);
    expect(new Set(handler.physicalEntrySlots).size).toBe(2);
    const routeNames = artifact.delegateArtifact!.messageBus!.route.inputs.map((entry) => entry.name);
    expect(routeNames).toContain('__message_bus_key_balances_0');
    expect(routeNames).toContain('__message_bus_key_balances_0_row');
  });
});
