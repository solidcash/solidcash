import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

type Artifact = ReturnType<typeof compileString>;
type Handler = NonNullable<Artifact['messageBus']>['handlers'][number];

const select = (source: string, name = 'apply', solidityImportCompat = false): {
  artifact: Artifact; handler: Handler;
} => {
  const artifact = compileString(source, { ...KERNEL, solidityImportCompat });
  const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === name);
  expect(handler, `missing handler ${name}`).toBeDefined();
  return { artifact, handler: handler! };
};

const forwarded = (paramIndex: number): Record<string, unknown> => ({ kind: 'forward', paramIndex });
const source = (paramIndex: number): Record<string, unknown> => ({
  kind: 'source', source: forwarded(paramIndex),
});
const literal = (value: string): Record<string, unknown> => ({ kind: 'literal', type: 'bigint', value });
const equals = (paramIndex: number, value: string): Record<string, unknown> => ({
  kind: 'binary', operator: '==', left: source(paramIndex), right: literal(value),
});
const negated = (expression: unknown): Record<string, unknown> => ({
  kind: 'unary', operator: '!', expression,
});

describe('kernel switch and try fixed effects', () => {
  it('compiles direct switch event effects with mutually exclusive predicates', () => {
    const { handler } = select(`
      event Mark(int value);
      contract Store() {
        function apply(int choice) public {
          switch (choice) {
            case 1: emit Mark(10); break;
            default: emit Mark(20); break;
          }
          require(true);
        }
      }
    `);

    expect(handler).toMatchObject({ eligible: true });
    expect(handler.emits).toEqual([
      { eventName: 'Mark', eventSignature: 'Mark(int256)', emitIndex: 0 },
    ]);
  });

  it('compiles direct switch BCH-transfer effects', () => {
    const { handler } = select(`
      contract Store() {
        function apply(int choice, bytes recipient) public {
          switch (choice) {
            case 1: this.transfer(recipient, 11); break;
            default: this.transfer(recipient, 21); break;
          }
          require(true);
        }
      }
    `);

    expect(handler).toMatchObject({ eligible: true });
    expect(handler.transfers).toHaveLength(2);
  });

  it('shares transfer ordinals across mutually exclusive arms and publishes exact predicates', () => {
    const { handler } = select(`
      contract Store() {
        function apply(int choice, bytes first, bytes second) public {
          switch (choice) {
            case 7: this.transfer(first, 1); break;
            default: this.transfer(second, 2); break;
          }
          require(true);
        }
      }
    `);
    const casePredicate = equals(0, '7');

    expect(handler).toMatchObject({ eligible: true });
    expect(handler.transfers).toEqual([
      expect.objectContaining({
        transferIndex: 0, recipient: forwarded(1), condition: casePredicate,
      }),
      expect.objectContaining({
        transferIndex: 0, recipient: forwarded(2), condition: negated(casePredicate),
      }),
    ]);
  });

  it('allocates the maximum arm width while preserving heterogeneous arm ordinals', () => {
    const { artifact, handler } = select(`
      contract Store() {
        function apply(int choice, bytes first, bytes second) public {
          switch (choice) {
            case 1: this.transfer(first, 1); break;
            case 2: this.transfer(first, 2); this.transfer(second, 3); break;
            default: break;
          }
          require(true);
        }
      }
    `);

    expect(handler).toMatchObject({ eligible: true });
    expect(handler.transfers?.map((transfer) => transfer.transferIndex)).toEqual([0, 0, 1]);
    expect(artifact.abi.find((entry) => entry.name === 'apply')?.blockLayout?.slots
      .filter((slot) => slot.kind === 'transfer'))
      .toEqual([
        expect.objectContaining({ slotIndex: 0 }),
        expect.objectContaining({ slotIndex: 1 }),
      ]);
  });

  it('keeps a no-default zero-effect path in a conditional fixed layout', () => {
    const { artifact, handler } = select(`
      contract Store() {
        function apply(int choice, bytes recipient) public {
          switch (choice) { case 1: this.transfer(recipient, 1); break; }
          require(true);
        }
      }
    `);

    expect(handler).toMatchObject({ eligible: true, transfers: [{ transferIndex: 0 }] });
    expect(handler.transfers?.[0].condition).toEqual(equals(0, '1'));
    expect(artifact.messageBus?.route.blockLayout?.slots.find((slot) =>
      slot.kind === 'transfer' && slot.slotIndex === 0)).toMatchObject({ conditional: true });
  });

  it('composes an enclosing if predicate with each switch-arm predicate', () => {
    const { handler } = select(`
      contract Store() {
        function apply(bool enabled, int choice, bytes recipient) public {
          if (enabled) {
            switch (choice) {
              case 3: this.transfer(recipient, 1); break;
              default: this.transfer(recipient, 2); break;
            }
          }
          require(true);
        }
      }
    `);

    expect(handler).toMatchObject({ eligible: true });
    expect(handler.transfers?.map((transfer) => transfer.condition)).toEqual([
      { kind: 'binary', operator: '&&', left: source(0), right: equals(1, '3') },
      { kind: 'binary', operator: '&&', left: source(0), right: negated(equals(1, '3')) },
    ]);
  });

  it('replays a reassigned pure switch discriminator', () => {
    const { handler } = select(`
      contract Store() {
        function apply(int choice, bytes recipient) public {
          int selected = choice;
          selected = choice + 1;
          switch (selected) { case 1: this.transfer(recipient, 1); break; default: break; }
          require(true);
        }
      }
    `);

    expect(handler).toMatchObject({
      eligible: true,
      transfers: [{
        condition: {
          kind: 'binary', operator: '==',
          left: { kind: 'cast', expression: { kind: 'binary', operator: '+' } },
          right: { kind: 'literal', value: '1' },
        },
      }],
    });
  });

  it('publishes mutually exclusive activation recipes for switch-selected deployments', () => {
    const { handler } = select(`
      contract Unit() { int marker; }
      contract Store() {
        function apply(int choice) public {
          switch (choice) {
            case 5: Unit first = new Unit(); break;
            default: Unit second = new Unit(); break;
          }
          require(true);
        }
      }
    `);

    expect(handler).toMatchObject({ eligible: true });
    expect(handler.childDeployments?.map((site) => ({
      siteIndex: site.siteIndex,
      occurrence: site.occurrence,
      operator: site.activation?.kind === 'binary' ? site.activation.operator : undefined,
      inputIndex: site.activation?.kind === 'binary' && site.activation.left.kind === 'handlerInput'
        ? site.activation.left.inputIndex : undefined,
    }))).toEqual([
      { siteIndex: 0, occurrence: 'conditional', operator: '==', inputIndex: 0 },
      { siteIndex: 1, occurrence: 'conditional', operator: '!=', inputIndex: 0 },
    ]);
  });

  it('uses first-match deployment activations and arm-local constructor recipes', () => {
    const { handler } = select(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply(int choice, int seed) public {
          switch (choice) {
            case 5: int adjusted = seed + 10; Unit first = new Unit(adjusted); break;
            case 5: int adjusted = seed + 20; Unit second = new Unit(adjusted); break;
            default: Unit fallbackUnit = new Unit(seed); break;
          }
          require(true);
        }
      }
    `);

    expect(handler).toMatchObject({ eligible: true });
    const sites = handler.childDeployments!;
    expect(sites).toHaveLength(3);
    expect(sites.map((site) => site.activation)).toEqual([
      expect.objectContaining({ kind: 'binary', operator: '==' }),
      expect.objectContaining({
        kind: 'binary', operator: '&&',
        left: expect.objectContaining({ kind: 'binary', operator: '!=' }),
        right: expect.objectContaining({ kind: 'binary', operator: '==' }),
      }),
      expect.objectContaining({
        kind: 'binary', operator: '&&',
        left: expect.objectContaining({ kind: 'binary', operator: '!=' }),
        right: expect.objectContaining({ kind: 'binary', operator: '!=' }),
      }),
    ]);
    expect(sites.map((site) => site.constructorArgs?.[0])).toEqual([
      expect.objectContaining({ kind: 'cast', operand: expect.objectContaining({ kind: 'binary', operator: '+' }) }),
      expect.objectContaining({ kind: 'cast', operand: expect.objectContaining({ kind: 'binary', operator: '+' }) }),
      expect.objectContaining({ kind: 'handlerInput', inputIndex: 1 }),
    ]);
  });

  it('joins an implicit switch default into a post-switch deployment recipe', () => {
    const { handler } = select(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply(int choice, int seed) public {
          int adjusted = seed;
          switch (choice) {
            case 1: adjusted = seed + 10; break;
            case 2: adjusted = seed + 20; break;
          }
          Unit child = new Unit(adjusted);
          require(true);
        }
      }
    `);

    expect(handler).toMatchObject({ eligible: true });
    expect(handler.childDeployments).toEqual([
      expect.objectContaining({
        occurrence: 'once',
        constructorArgs: [expect.objectContaining({
          kind: 'conditional',
          ifFalse: expect.objectContaining({
            kind: 'conditional',
            ifFalse: expect.objectContaining({ kind: 'handlerInput', inputIndex: 1 }),
          }),
        })],
      }),
    ]);
  });

  it('keeps ambiguous switch exits fenced from deployment joins', () => {
    const { handler } = select(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply(int choice, int seed) public {
          int adjusted = seed;
          switch (choice) {
            case 1: if (seed > 0) { break; } adjusted = seed + 10; break;
            default: adjusted = seed + 20; break;
          }
          Unit child = new Unit(adjusted);
          require(true);
        }
      }
    `);

    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('replays branch-local and post-branch child constructor values', () => {
    const local = select(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply(bool enabled, int seed) public {
          if (enabled) { int adjusted = seed + 10; Unit selected = new Unit(adjusted); }
          else { Unit fallbackUnit = new Unit(seed); }
          require(true);
        }
      }
    `).handler;
    expect(local).toMatchObject({
      eligible: true,
      childDeployments: [
        { constructorArgs: [{ kind: 'cast', operand: { kind: 'binary', operator: '+' } }] },
        { constructorArgs: [{ kind: 'handlerInput', inputIndex: 1 }] },
      ],
    });

    const joined = select(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply(bool enabled, int seed) public {
          int adjusted = seed;
          if (enabled) { adjusted = seed + 10; }
          Unit child = new Unit(adjusted);
          require(true);
        }
      }
    `).handler;
    expect(joined).toMatchObject({
      eligible: true,
      childDeployments: [{ constructorArgs: [{
        kind: 'conditional', condition: { kind: 'handlerInput', inputIndex: 0 },
        ifFalse: { kind: 'handlerInput', inputIndex: 1 },
      }] }],
    });
  });

  it('keeps abrupt branch exits fenced from deployment joins', () => {
    const { handler } = select(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply(bool enabled, int seed) public {
          int adjusted = seed;
          if (enabled) { adjusted = seed + 10; revert("stop"); }
          Unit child = new Unit(adjusted);
          require(true);
        }
      }
    `);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('expands an exact bounded child-deployment loop into source-ordered physical sites', () => {
    const { handler } = select(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply(int base) public {
          for (int i = 0; i < 3; i = i + 1) { Unit child = new Unit(base + i); }
          require(true);
        }
      }
    `);
    expect(handler).toMatchObject({ eligible: true });
    expect(handler.childDeployments).toHaveLength(3);
    expect(handler.childDeployments?.map((site) => ({
      siteIndex: site.siteIndex, occurrence: site.occurrence,
      spanOffset: site.spanOffset, spanWidth: site.spanWidth,
    }))).toEqual([
      { siteIndex: 0, occurrence: 'once', spanOffset: 0, spanWidth: 2 },
      { siteIndex: 1, occurrence: 'once', spanOffset: 2, spanWidth: 2 },
      { siteIndex: 2, occurrence: 'once', spanOffset: 4, spanWidth: 2 },
    ]);
    expect(handler.childDeployments?.map((site) => site.constructorArgs[0])).toEqual([
      expect.objectContaining({
        kind: 'binary', operator: '+', right: expect.objectContaining({ kind: 'intLiteral', value: '0' }),
      }),
      expect.objectContaining({
        kind: 'binary', operator: '+', right: expect.objectContaining({ kind: 'intLiteral', value: '1' }),
      }),
      expect.objectContaining({
        kind: 'binary', operator: '+', right: expect.objectContaining({ kind: 'intLiteral', value: '2' }),
      }),
    ]);
  });

  it.each([
    ['a source break', 'for (int i = 0; i < 3; i = i + 1) { if (i == 1) { break; } Unit child = new Unit(i); }'],
    ['more than 64 iterations', 'for (int i = 0; i < 65; i = i + 1) { Unit child = new Unit(i); }'],
    ['a runtime count', 'for (int i = 0; i < count; i = i + 1) { Unit child = new Unit(i); }'],
  ])('keeps a child-deployment loop with %s fenced', (_label, loop) => {
    const { handler } = select(`
      contract Unit(int seed) { int marker; constructor() { this.marker = seed; } }
      contract Store() {
        function apply(int count) public {
          ${loop}
          require(count >= 0);
        }
      }
    `);
    expect(handler).toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('publishes exact switch predicates for runtime counter-loop events', () => {
    const { handler } = select(`
      event Mark(int value);
      contract Store() {
        mapping(int => int) values;
        function apply(int count, int choice) public {
          for (int i = 0; i < count; i = i + 1) {
            this.values[i] = i;
            switch (choice) {
              case 4: emit Mark(i); break;
              default: emit Mark(i + 1); break;
            }
          }
          require(true);
        }
      }
    `);
    const casePredicate = equals(1, '4');

    expect(handler).toMatchObject({ eligible: true });
    expect(handler.runtimeLoopEvents?.[0].conditions)
      .toEqual([casePredicate, negated(casePredicate)]);
  });

  it('publishes exact switch predicates for runtime counter-loop transfers', () => {
    const { handler } = select(`
      contract Store() {
        mapping(int => int) values;
        function apply(int count, int choice, bytes recipient) public {
          for (int i = 0; i < count; i = i + 1) {
            this.values[i] = i;
            switch (choice) {
              case 4: this.transfer(recipient, 1); break;
              default: this.transfer(recipient, 2); break;
            }
          }
          require(true);
        }
      }
    `);
    const casePredicate = equals(1, '4');

    expect(handler).toMatchObject({ eligible: true });
    expect(handler.runtimeLoopTransfers?.[0]).toMatchObject({
      siteCount: 2,
      conditions: [casePredicate, negated(casePredicate)],
    });
  });

  it('treats a try success body as reachable and excludes dead catch event and transfer effects', () => {
    const { handler } = select(`pragma solidity ^0.8.0;
      interface Peer { function ping(uint value) external; }
      contract Store {
        address peer;
        event Mark(uint value);
        function apply(address payable recipient) public {
          try Peer(peer).ping(1) {
            emit Mark(1);
            recipient.transfer(2);
          } catch {
            emit Mark(99);
            recipient.transfer(100);
          }
          require(true);
        }
      }
    `, 'apply', true);

    expect(handler).toMatchObject({ eligible: true });
    expect(handler.transfers).toMatchObject([
      { transferIndex: 0, amountRecipe: { kind: 'intLiteral', value: '2' } },
    ]);
    expect(handler.emits).toEqual([
      { eventName: 'Mark', eventSignature: 'Mark(uint256)', emitIndex: 0 },
    ]);
  });

  it('treats a deployment in a try success body as unconditional and excludes a dead catch deployment', () => {
    const { handler } = select(`pragma solidity ^0.8.0;
      interface Peer { function ping(uint value) external; }
      contract Unit { uint marker; constructor(uint value) { marker = value; } }
      contract Store {
        address peer;
        function apply(uint seed) public {
          try Peer(peer).ping(seed) {
            Unit reached = new Unit(seed);
          } catch {
            Unit dead = new Unit(seed + 1);
          }
          require(true);
        }
      }
    `, 'apply', true);

    expect(handler).toMatchObject({
      eligible: true,
      childDeployments: [{ siteIndex: 0, occurrence: 'once' }],
    });
    expect(handler.childDeployments).toHaveLength(1);
    expect(handler.childDeployments?.[0]).not.toHaveProperty('activation');
  });
});
