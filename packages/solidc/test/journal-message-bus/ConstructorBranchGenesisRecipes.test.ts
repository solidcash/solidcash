import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

type MessageBusHandler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const selectedHandler = (constructorBody: string): MessageBusHandler | undefined => compileString(`event Seen(int value);
  contract Unit(int seed, bool choose, pubkey key, sig proof) {
    int baseline;
    int selected;
    int marker;
    constructor() { ${constructorBody} }
  }
  contract Coordinator() {
    function create(int seed, bool choose, pubkey key, sig proof) public {
      Unit unit = new Unit(seed, choose, key, proof);
      require(true);
    }
  }`, KERNEL).messageBus?.handlers.find((candidate) => candidate.name === 'create');

describe('conditional child-constructor genesis recipes', () => {
  it('publishes exact two-sided and one-sided state joins from constructor arguments and locals', () => {
    const selected = selectedHandler(`
      int adjusted = seed + 1;
      bool direction = choose;
      this.baseline = adjusted;
      this.selected = adjusted;
      if (direction) {
        this.baseline = adjusted + 5;
        this.selected = adjusted * 2;
        this.marker = int(1);
      } else {
        this.selected = adjusted + 3;
        this.marker = int(2);
      }
    `);
    expect(selected).toMatchObject({ eligible: true, childDeployments: [{ genesisState: { fields: [
      { name: 'baseline', value: {
        kind: 'conditional', condition: { kind: 'handlerInput', inputIndex: 1 },
        ifTrue: { kind: 'cast', operand: { kind: 'binary', operator: '+' } },
        ifFalse: { kind: 'cast', operand: { kind: 'binary', operator: '+' } },
      } },
      { name: 'selected', value: {
        kind: 'conditional', condition: { kind: 'handlerInput', inputIndex: 1 },
        ifTrue: { kind: 'cast', operand: { kind: 'binary', operator: '*' } },
        ifFalse: { kind: 'cast', operand: { kind: 'binary', operator: '+' } },
      } },
      { name: 'marker', value: {
        kind: 'conditional', condition: { kind: 'handlerInput', inputIndex: 1 },
        ifTrue: { kind: 'cast' }, ifFalse: { kind: 'cast' },
      } },
    ] } }] });
  });

  it.each([
    ['child-state selection', 'this.baseline = seed; if (this.baseline > 0) { this.selected = seed; }'],
    ['transaction selection', 'if (tx.inputs.length > 0) { this.selected = seed; }'],
    ['transaction selection through a local',
      'int observed = tx.locktime; if (observed > 0) { this.selected = seed; }'],
    ['signature selection', 'if (checkSig(proof, key)) { this.selected = seed; }'],
    ['signature selection through a local',
      'sig copied = proof; if (checkSig(copied, key)) { this.selected = seed; }'],
    ['child-state selection through a local',
      'this.baseline = seed; int observed = this.baseline; if (observed > 0) { this.selected = seed; }'],
    ['a branch require', 'if (choose) { this.selected = seed; require(true); }'],
    ['a branch assertion', 'if (choose) { this.selected = seed; assert(seed > 0); }'],
    ['a branch revert', 'if (choose) { this.selected = seed; } else { revert(); }'],
    ['a branch return', 'if (choose) { return; } this.selected = seed;'],
    ['a repeated branch update', 'if (choose) { while (seed > 0) { this.selected = seed; } }'],
    ['a branch resource effect', 'if (choose) { emit Seen(seed); }'],
  ])('keeps %s fenced', (_label, constructorBody) => {
    expect(selectedHandler(constructorBody)).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
  });
});
