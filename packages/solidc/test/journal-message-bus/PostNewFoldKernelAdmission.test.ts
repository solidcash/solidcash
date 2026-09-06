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
    ['unsupported initializer expression', `
      HashUnit unit = new HashUnit();
      unit.initialize(sha256(payload));`],
    ['a non-trivial child guard', `
      GuardedUnit unit = new GuardedUnit();
      unit.initialize(next);`],
  ])('keeps a post-new initializer with %s fenced', (_label, body) => {
    const selected = handler(`${SCALAR_UNIT}
      contract DynamicUnit() {
        bytes payload;
        function initialize(bytes next) public { this.payload = next; require(true); }
      }
      contract HashUnit() {
        bytes32 digest;
        function initialize(bytes32 next) public { this.digest = next; require(true); }
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
