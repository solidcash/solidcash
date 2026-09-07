import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

type CompiledArtifact = ReturnType<typeof compileString>;
type MessageBusHandler = NonNullable<CompiledArtifact['messageBus']>['handlers'][number];

const handler = (source: string, name = 'materialize'): {
  artifact: CompiledArtifact; selected: MessageBusHandler;
} => {
  const artifact = compileString(source, KERNEL);
  const selected = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
  expect(selected, `missing handler ${name}`).toBeDefined();
  return { artifact, selected: selected! };
};

describe('kernel bounded child-deployment next slice', () => {
  it('expands an exact literal loop into ordered sites with varying constructor, salt, and value recipes', () => {
    const { artifact, selected } = handler(`
      contract Unit(int seed) { int marker; }
      contract Coordinator() {
        function materialize() public {
          for (int i = 0; i < 3; i = i + 1) {
            Unit child = new Unit{salt: bytes32(i + 10), value: 1000 + i}(i);
          }
          require(true);
        }
      }
    `);

    expect(selected).toMatchObject({ eligible: true });
    expect(selected.childDeployments).toHaveLength(3);
    expect(selected.childDeployments?.map((site) => ({
      siteIndex: site.siteIndex,
      occurrence: site.occurrence,
      spanOffset: site.spanOffset,
      transferIndex: site.value?.transferIndex,
    }))).toEqual([
      { siteIndex: 0, occurrence: 'once', spanOffset: 0, transferIndex: 0 },
      { siteIndex: 1, occurrence: 'once', spanOffset: 2, transferIndex: 1 },
      { siteIndex: 2, occurrence: 'once', spanOffset: 4, transferIndex: 2 },
    ]);
    expect(selected.childDeployments?.every((site) =>
      site.constructorArgs.every((recipe) => recipe.kind !== 'expression')
      && site.salt?.kind !== 'expression'
      && site.value?.amount.kind !== 'expression')).toBe(true);
    expect(new Set(selected.childDeployments?.map((site) => JSON.stringify({
      constructorArgs: site.constructorArgs, salt: site.salt, value: site.value?.amount,
    }))).size).toBe(3);
    const deploySlots = artifact.messageBus?.route.blockLayout?.slots.filter((slot) =>
      slot.slotIndex === 0 && (slot.kind === 'deploy' || slot.kind === 'deployDataNft')) ?? [];
    expect(deploySlots).toHaveLength(6);
  });

  it('expands a fixed-array-length loop into one exact site per element', () => {
    const { selected } = handler(`
      contract Unit() { int marker; }
      contract Coordinator() {
        int[2] seeds;
        function materialize() public {
          for (int i = 0; i < seeds.length; i = i + 1) {
            Unit child = new Unit();
          }
          require(true);
        }
      }
    `);

    expect(selected).toMatchObject({ eligible: true });
    expect(selected.childDeployments?.map((site) => ({
      siteIndex: site.siteIndex, occurrence: site.occurrence, spanOffset: site.spanOffset,
    }))).toEqual([
      { siteIndex: 0, occurrence: 'once', spanOffset: 0 },
      { siteIndex: 1, occurrence: 'once', spanOffset: 2 },
    ]);
  });

  it('publishes an independent activation recipe for every conditionally reached fixed iteration', () => {
    const { selected } = handler(`
      contract Unit(int seed) { int marker; }
      contract Coordinator() {
        function materialize(int limit) public {
          for (int i = 0; i < 3; i = i + 1) {
            if (limit > i) { Unit child = new Unit(i); }
          }
          require(true);
        }
      }
    `);

    expect(selected).toMatchObject({ eligible: true });
    expect(selected.childDeployments).toHaveLength(3);
    expect(selected.childDeployments?.every((site) =>
      site.occurrence === 'conditional' && site.activation !== undefined)).toBe(true);
    expect(new Set(selected.childDeployments?.map((site) => JSON.stringify(site.activation))).size).toBe(3);
  });

  it('erases an exact zero-trip loop without publishing phantom deployment authority', () => {
    const { artifact, selected } = handler(`
      contract Unit() { int marker; }
      contract Coordinator() {
        function materialize() public {
          for (int i = 0; i < 0; i = i + 1) { Unit child = new Unit(); }
          require(true);
        }
      }
    `);

    expect(selected).toMatchObject({ eligible: true });
    expect(selected.childDeployments).toBeUndefined();
    expect(artifact.messageBus?.route.blockLayout?.slots.some((slot) =>
      slot.kind === 'deploy' || slot.kind === 'deployDataNft')).toBe(false);
  });

  it.each([
    ['a runtime trip count', 'for (int i = 0; i < n; i = i + 1) { Unit child = new Unit(); }'],
    ['a break-bearing fixed loop', `for (int i = 0; i < 3; i = i + 1) {
      Unit child = new Unit(); if (n == i) { break; }
    }`],
    ['a continue-bearing fixed loop', `for (int i = 0; i < 3; i = i + 1) {
      if (n == i) { continue; } Unit child = new Unit();
    }`],
  ])('keeps %s refused instead of claiming a fixed occurrence set', (_label, loop) => {
    const { selected } = handler(`
      contract Unit() { int marker; }
      contract Coordinator() {
        function materialize(int n) public { ${loop} require(true); }
      }
    `);
    expect(selected).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(selected.childDeployments).toEqual([
      expect.objectContaining({ occurrence: 'loop', siteIndex: 0 }),
    ]);
  });

  it('admits multiple value-bearing child sites and an ordinary transfer in one exact transfer frame', () => {
    const { selected } = handler(`
      contract Compact() { int marker; }
      contract Wide() { int first; int second; int third; }
      contract Coordinator() {
        function materialize(address recipient, int amount) public {
          Compact first = new Compact{value: amount}();
          Wide second = new Wide{value: amount + 1}();
          this.transfer(recipient, amount + 2);
          require(true);
        }
      }
    `);

    expect(selected).toMatchObject({ eligible: true });
    expect(selected.childDeployments?.map((site) => site.value?.transferIndex)).toEqual([0, 1]);
    expect(selected.transfers?.map((transfer) => transfer.transferIndex)).toEqual([2]);
  });

  it('refuses the whole handler when any sibling value recipe is not materializable', () => {
    const { selected } = handler(`
      contract Unit() { int marker; }
      contract Coordinator() {
        function materialize(int amount, bytes seed) public {
          Unit first = new Unit{value: amount}();
          Unit second = new Unit{value: int(sha256(seed))}();
          require(true);
        }
      }
    `);
    expect(selected).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
