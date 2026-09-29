import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

/**
 * The element source a per-call entry's append to a dynamic array publishes.
 *
 * A per-call body holds a dynamic value in a run of chunk NFTs, and an append grows that run by exactly the
 * element it pushes. The hop has to state that element before the body runs, so the entry's own append publishes
 * it in `dynamicWriteSources`, the same map a constructor's whole-value write uses, resolved against the entry's
 * call data. Only an append on every completing path is published; every other write shape stays absent and is
 * refused by name by the consumer.
 */

const sourcesOf = (source: string): Record<string, unknown> | undefined => compileString(
  source, { composition: 'per-call' },
).abi.find((entry) => entry.name === 'add')?.dynamicWriteSources as Record<string, unknown> | undefined;

describe('an entry append publishes the element it pushes', () => {
  it('publishes the frame sender an address append appends', () => {
    const sources = sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add() { this.items.push(msg.sender); }
      }
    `);
    expect(sources).toStrictEqual({ items: { kind: 'source', source: { kind: 'msgSender' } } });
  });

  it('publishes a struct instantiation over the entry arguments', () => {
    const sources = sourcesOf(`
      contract Impl {
        struct Entry { address who; uint amount; }
        address public implementation;
        Entry[] public items;
        function add(address who, uint amount) { this.items.push(Entry(who, amount)); }
      }
    `);
    expect(sources).toStrictEqual({
      items: {
        kind: 'call', name: 'Entry', type: 'Entry',
        args: [
          { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
          { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
        ],
      },
    });
  });

  it('publishes a forwarded parameter and a literal element', () => {
    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add(address who) { this.items.push(who); }
      }
    `)).toStrictEqual({ items: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } } });

    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        int[] public items;
        function add() { this.items.push(7); }
      }
    `)).toStrictEqual({ items: { kind: 'literal', value: '7', type: 'bigint' } });
  });

  it('publishes an element each arm of one branch agrees on', () => {
    // Exactly one arm runs, so the append grows the run by one element either way and the element is the join.
    const sources = sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add(address who, address other, bool choose) {
          if (choose) { this.items.push(who); } else { this.items.push(other); }
        }
      }
    `);
    expect(sources).toStrictEqual({
      items: {
        kind: 'ternary',
        condition: { kind: 'source', source: { kind: 'forward', paramIndex: 2 } },
        ifTrue: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
        ifFalse: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      },
    });
  });

  it('stays absent for a shape the run cannot be sized from', () => {    // A conditional append grows the run by zero or one, a repeated append by two, a loop by its trip count, and
    // an assignment replaces the value outright — none is the single stated element the consumer needs.
    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add(address who, bool choose) { if (choose) { this.items.push(who); } }
      }
    `)).toBeUndefined();

    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add(address who) { this.items.push(who); this.items.push(who); }
      }
    `)).toBeUndefined();

    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add(address who) { for (int i = 0; i < 3; i = i + 1) { this.items.push(who); } }
      }
    `)).toBeUndefined();

    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add(address who) { this.items = this.items; this.items.push(who); }
      }
    `)).toBeUndefined();

    // An element the compiler cannot name (a helper call) is left absent rather than guessed.
    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add(address who) { this.items.push(make(who)); }
        function make(address who) internal pure returns (address) { return who; }
      }
    `)).toBeUndefined();
  });

  it('stays absent under a convention that does not consume the entry shape', () => {
    // The direct convention has its own element-source publication; only the per-call hop reads this one.
    const artifact = compileString(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add(address who) { this.items.push(who); }
      }
    `);
    expect(artifact.abi.find((entry) => entry.name === 'add')?.dynamicWriteSources).toBeUndefined();
  });
});
