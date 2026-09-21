import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

type KernelHandler = NonNullable<ReturnType<typeof compileString>['messageBus']>['handlers'][number];

const handler = (source: string, name = 'materialize'): KernelHandler | undefined => compileString(source, KERNEL)
  .messageBus?.handlers.find((candidate) => candidate.name === name);

const SCALAR_UNIT = `contract Unit(int seed) {
  int baseline;
  int configured;
  constructor() { this.baseline = seed; }
  function initialize(int next) public {
    this.configured = this.baseline + next;
    require(true);
  }
}`;

describe('kernel post-new child initialization admission', () => {
  it('publishes the complete constructor plus one straight-line scalar initializer genesis', () => {
    const artifact = compileString(`${SCALAR_UNIT}
      contract Coordinator() {
        int created;
        function materialize(int seed, int next) public {
          Unit unit = new Unit(seed);
          unit.initialize(next);
          this.created = this.created + 1;
          require(true);
        }
      }`, KERNEL);
    const selected = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'materialize');

    expect(selected).toMatchObject({
      eligible: true,
      childDeployments: [{
        contractName: 'Unit', occurrence: 'once', siteIndex: 0, hasFoldedChildCall: true,
        genesisState: {
          kind: 'constructor',
          fields: [
            { name: 'baseline', type: 'int256', value: { kind: 'handlerInput', inputIndex: 0 } },
            { name: 'configured', type: 'int256', value: { kind: 'binary', operator: '+' } },
          ],
        },
      }],
    });
    expect(selected?.childDeployments?.[0].genesisState?.fields[1].value).toMatchObject({
      left: { kind: 'handlerInput', inputIndex: 0 },
      right: { kind: 'handlerInput', inputIndex: 1 },
    });
    const direct = artifact.abi.find((candidate) => candidate.name === 'materialize');
    expect(direct?.deployTargets?.[0])
      .toMatchObject({
        contractName: 'Unit', hasFoldedChildCall: true,
        genesisState: { kind: 'constructor', fields: [{ name: 'baseline' }, { name: 'configured' }] },
      });
    expect(direct?.externalCalls).toBeUndefined();
  });

  it('publishes exact conditional recipes for two-sided and one-sided scalar updates', () => {
    const artifact = compileString(`contract ChoiceUnit(int seed) {
        int baseline;
        int configured;
        int marker;
        constructor() { this.baseline = seed; this.configured = seed; }
        function initialize(int next, bool choose) public {
          if (choose) {
            this.configured = this.baseline + next;
            this.marker = int(1);
          } else {
            this.configured = this.baseline - next;
            this.marker = int(2);
          }
          require(true);
        }
        function replace(int next, bool choose) public {
          if (choose) { this.configured = next; }
          require(true);
        }
      }
      contract Coordinator() {
        function choose(int seed, int next, bool direction) public {
          ChoiceUnit unit = new ChoiceUnit(seed);
          unit.initialize(next, direction);
          require(true);
        }
        function replace(int seed, int next, bool enabled) public {
          ChoiceUnit unit = new ChoiceUnit(seed);
          unit.replace(next, enabled);
          require(true);
        }
      }`, KERNEL);
    const choose = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'choose');
    expect(choose).toMatchObject({ eligible: true, childDeployments: [{ genesisState: { fields: [
      { name: 'baseline', value: { kind: 'handlerInput', inputIndex: 0 } },
      { name: 'configured', value: {
        kind: 'conditional', condition: { kind: 'handlerInput', inputIndex: 2 },
        ifTrue: { kind: 'binary', operator: '+' }, ifFalse: { kind: 'binary', operator: '-' },
      } },
      { name: 'marker', value: {
        kind: 'conditional', condition: { kind: 'handlerInput', inputIndex: 2 },
        ifTrue: { kind: 'cast', operand: { kind: 'intLiteral', value: '1' } },
        ifFalse: { kind: 'cast', operand: { kind: 'intLiteral', value: '2' } },
      } },
    ] } }] });
    const replace = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'replace');
    expect(replace).toMatchObject({ eligible: true, childDeployments: [{ genesisState: { fields: [
      { name: 'baseline', value: { kind: 'handlerInput', inputIndex: 0 } },
      { name: 'configured', value: {
        kind: 'conditional', condition: { kind: 'handlerInput', inputIndex: 2 },
        ifTrue: { kind: 'handlerInput', inputIndex: 1 },
        ifFalse: { kind: 'handlerInput', inputIndex: 0 },
      } },
    ] } }] });
  });

  it.each([
    ['transaction-dependent selection', 'if (tx.inputs.length > 0) { this.configured = next; }'],
    ['signature-dependent selection', 'if (checkSig(proof, key)) { this.configured = next; }'],
    ['a path-dependent guard', 'if (next > 0) { this.configured = next; require(next < 10); }'],
    ['a repeated update', 'while (next > 0) { this.configured = next; next = next - 1; }'],
    ['an abrupt branch', 'if (next > 0) { this.configured = next; return; }'],
    ['a collection update', 'if (next > 0) { this.values[0] = next; }'],
  ])('rejects child initialization with %s', (_label, update) => {
    const source = `contract ConditionalUnit() {
        int configured;
        int[1] values;
        function initialize(int next, pubkey key, sig proof) public {
          ${update}
          require(true);
        }
      }
      contract Coordinator() {
        function materialize(int next, pubkey key, sig proof) public {
          ConditionalUnit unit = new ConditionalUnit();
          unit.initialize(next, key, proof);
          require(true);
        }
      }`;
    expect(() => compileString(source, KERNEL)).toThrow(/Cannot call 'initialize\(\)'/);
  });

  it('publishes a pure hash recipe used by a post-new initializer', () => {
    const selected = handler(`contract HashUnit() {
        bytes32 digest;
        function initialize(bytes32 next) public { this.digest = next; require(true); }
      }
      contract Coordinator() {
        function materialize(bytes payload) public {
          HashUnit unit = new HashUnit();
          unit.initialize(sha256(payload));
          require(true);
        }
      }`);
    expect(selected).toMatchObject({ eligible: true, childDeployments: [{ genesisState: { fields: [{
      name: 'digest', value: {
        kind: 'hash', algorithm: 'sha256', resultType: 'bytes32',
        operand: { kind: 'handlerInput', inputIndex: 0, resultType: 'bytes' },
      },
    }] } }] });
  });

  it.each([
    ['control flow', `
      Unit unit = new Unit(seed);
      if (next > 0) { unit.initialize(next); }`],
    ['intervening parent mutation', `
      Unit unit = new Unit(seed);
      this.created = this.created + 1;
      unit.initialize(next);`],
    ['dynamic child state', `
      DynamicUnit unit = new DynamicUnit();
      unit.initialize(payload);`],
    ['a non-trivial child guard', `
      GuardedUnit unit = new GuardedUnit();
      unit.initialize(next);`],
  ])('keeps a post-new initializer with %s fenced', (_label, body) => {
    const selected = handler(`${SCALAR_UNIT}
      contract DynamicUnit() {
        bytes payload;
        function initialize(bytes next) public { this.payload = next; require(true); }
      }
      contract GuardedUnit() {
        int configured;
        function initialize(int next) public { this.configured = next; require(next > 0); }
      }
      contract Coordinator() {
        int created;
        function materialize(int seed, int next, bytes payload) public {
          ${body}
          require(true);
        }
      }`);
    expect(selected).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
