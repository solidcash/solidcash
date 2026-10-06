import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

/**
 * The element source a framed entry's append to a dynamic array publishes.
 *
 * A framed body holds a dynamic value in a run of chunk NFTs, and an append grows that run by exactly the
 * element it pushes. The hop has to state that element before the body runs, so the entry's own append publishes
 * it in `dynamicWriteSources`, the same map a constructor's whole-value write uses, resolved against the entry's
 * call data. Only an append on every completing path is published; every other write shape stays absent and is
 * refused by name by the consumer.
 */

const sourcesOf = (source: string): Record<string, unknown> | undefined => compileString(
  source, { composition: 'framed' },
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

  it('publishes the element type default a no-argument append appends', () => {
    // A no-argument `push()` appends the element type's default value, which is a constant the compiler states as
    // exactly as it states a literal: a scalar element is published as its literal, and a struct element as a
    // construction over its fields' own defaults. A field of array type defaults to a zero-length array, which the
    // shipped evaluator's `newArray` node speaks, so an element containing one stays statable rather than absent.
    expect(sourcesOf(`
      contract Impl {
        struct Detail { address who; uint amount; }
        address public implementation;
        Detail[] public items;
        function add() { this.items.push(); }
      }
    `)).toStrictEqual({
      items: {
        kind: 'call', name: 'Detail', type: 'Detail',
        args: [
          { kind: 'cast', type: 'address', expression: { kind: 'literal', value: '0', type: 'bigint' } },
          { kind: 'literal', value: '0', type: 'bigint' },
        ],
      },
    });

    expect(sourcesOf(`
      contract Impl {
        struct Entry { address who; uint amount; uint[] extra; }
        address public implementation;
        Entry[] public items;
        function add() { this.items.push(); }
      }
    `)).toStrictEqual({
      items: {
        kind: 'call', name: 'Entry', type: 'Entry',
        args: [
          { kind: 'cast', type: 'address', expression: { kind: 'literal', value: '0', type: 'bigint' } },
          { kind: 'literal', value: '0', type: 'bigint' },
          { kind: 'newArray', type: 'uint256', args: [{ kind: 'literal', value: '0', type: 'bigint' }] },
        ],
      },
    });

    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        int[] public items;
        function add() { this.items.push(); }
      }
    `)).toStrictEqual({ items: { kind: 'literal', value: '0', type: 'bigint' } });

    // The element the default names is the same element whether it is appended implicitly or spelled out.
    expect(sourcesOf(`
      contract Impl {
        struct Detail { address who; uint amount; }
        address public implementation;
        Detail[] public items;
        function add() { this.items.push(Detail(address(0), 0)); }
      }
    `)).toStrictEqual({
      items: {
        kind: 'call', name: 'Detail', type: 'Detail',
        args: [
          { kind: 'cast', type: 'address', expression: { kind: 'literal', value: '0', type: 'bigint' } },
          { kind: 'literal', value: '0', type: 'bigint' },
        ],
      },
    });
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

  it('publishes the append beside an unrelated struct write to a mapping', () => {
    // A struct construction is a lowered call, but it produces a value rather than writing a dynamic variable, so
    // it does not displace the append's one-write proof. This is the shape a registration body has.
    const sources = sourcesOf(`
      contract Impl {
        struct Entry { address who; string name; string bio; uint up; }
        address public implementation;
        mapping(address => Entry) public members;
        address[] public items;
        function add(address who, string name_, string bio_) {
          require(this.members[who].up == 0);
          this.members[who] = Entry(who, name_, bio_, 1);
          this.items.push(msg.sender);
        }
      }
    `);
    expect(sources).toStrictEqual({ items: { kind: 'source', source: { kind: 'msgSender' } } });
  });

  it('publishes an append whose operand is a construction beside an unrelated call', () => {
    const sources = sourcesOf(`
      contract Impl {
        struct Entry { address who; uint up; }
        address public implementation;
        mapping(address => uint) public counts;
        Entry[] public items;
        function add(address who) { this.counts[who] = this.counts[who] + 1; this.items.push(Entry(who, 1)); }
      }
    `);
    expect(sources).toStrictEqual({
      items: {
        kind: 'call', name: 'Entry', type: 'Entry',
        args: [
          { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
          { kind: 'literal', value: '1', type: 'bigint' },
        ],
      },
    });
  });

  it('publishes the append only the arm that completes carries', () => {
    // A guard that lowers to `if (guard) { revert } else { body }` puts the body in the only arm that completes.
    // The reverting arm completes no path at all, so it is not a second path with no write: the append is still the
    // one write on every path that completes, exactly as a `revert` before the write already is.
    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        bool public paused;
        modifier notPaused() { require(!this.paused); _; }
        function add(address who) notPaused { this.items.push(who); }
      }
    `)).toStrictEqual({ items: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } } });

    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add(address who, bool stop) {
          if (stop) { revert("stopped"); } else { this.items.push(who); }
        }
      }
    `)).toStrictEqual({ items: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } } });
  });

  it('folds the fields a rebuild writes into the element the append states', () => {
    // `push()` appends the element type's default, and each following indexed write whose own value reads the array
    // rebuilds that element in place: the run still grows by the one element the push appended, and the fields the
    // rebuilds write are folded into it, so what is published is the element the body writes rather than the
    // default the push appended. This is the shape a body that pushes an element and then fills its fields through
    // a storage pointer has.
    expect(sourcesOf(`
      contract Impl {
        struct Detail { address who; uint amount; }
        address public implementation;
        Detail[] public items;
        function add(address who) { this.items.push(); this.items[0].who = who; }
      }
    `)).toStrictEqual({
      items: {
        kind: 'call', name: 'Detail', type: 'Detail',
        args: [
          { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
          { kind: 'literal', value: '0', type: 'bigint' },
        ],
      },
    });

    // Two rebuilds compose in source order: each reads the element the previous one left, so the published element
    // carries both fields the body wrote.
    expect(sourcesOf(`
      contract Impl {
        struct Detail { address who; uint amount; }
        address public implementation;
        Detail[] public items;
        function add(address who, uint amt) { this.items.push(); this.items[0].who = who; this.items[0].amount = amt; }
      }
    `)).toStrictEqual({
      items: {
        kind: 'call', name: 'Detail', type: 'Detail',
        args: [
          { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
          { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
        ],
      },
    });

    // The same rebuild past a forwarded element: the rebuild adds no element, and the field it writes replaces the
    // one that element already carried.
    expect(sourcesOf(`
      contract Impl {
        struct Detail { address who; uint amount; }
        address public implementation;
        Detail[] public items;
        function add(address who) { this.items.push(Detail(who, 1)); this.items[0].amount = 2; }
      }
    `)).toStrictEqual({
      items: {
        kind: 'call', name: 'Detail', type: 'Detail',
        args: [
          { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
          { kind: 'literal', value: '2', type: 'bigint' },
        ],
      },
    });

    // A nested field write folds through the construction that carries it: the path a rebuild reads is resolved
    // against the stated element's own field.
    expect(sourcesOf(`
      contract Impl {
        struct Roles { address creator; address worker; }
        struct Detail { Roles roles; uint amount; }
        address public implementation;
        Detail[] public items;
        function add(address who) { this.items.push(); this.items[0].roles.creator = who; }
      }
    `)).toStrictEqual({
      items: {
        kind: 'call', name: 'Detail', type: 'Detail',
        args: [
          {
            kind: 'call', name: 'Roles', type: 'Roles',
            args: [
              { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
              { kind: 'cast', type: 'address', expression: { kind: 'literal', value: '0', type: 'bigint' } },
            ],
          },
          { kind: 'literal', value: '0', type: 'bigint' },
        ],
      },
    });

    // A field of dynamic type is folded like any other; the default it replaced was a zero-length array.
    expect(sourcesOf(`
      contract Impl {
        struct Detail { address who; string title; uint[] tags; }
        address public implementation;
        Detail[] public items;
        function add(address who, string title_) { this.items.push(); this.items[0].title = title_; }
      }
    `)).toStrictEqual({
      items: {
        kind: 'call', name: 'Detail', type: 'Detail',
        args: [
          { kind: 'cast', type: 'address', expression: { kind: 'literal', value: '0', type: 'bigint' } },
          { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
          { kind: 'newArray', type: 'uint256', args: [{ kind: 'literal', value: '0', type: 'bigint' }] },
        ],
      },
    });
  });

  it('stays absent when a rebuild writes a field the replay cannot state', () => {
    // A field value that reads state is not an expression the element vocabulary speaks, so the element the body
    // writes is left unstated rather than published as the default the push appended.
    expect(sourcesOf(`
      contract Impl {
        struct Detail { address who; uint amount; }
        address public implementation;
        address public owner;
        Detail[] public items;
        function add() { this.items.push(); this.items[0].who = this.owner; }
      }
    `)).toBeUndefined();

    // A rebuild that reads an element other than the one it writes is not a rebuild of the appended element.
    expect(sourcesOf(`
      contract Impl {
        struct Detail { address who; uint amount; }
        address public implementation;
        Detail[] public items;
        function add(address who) { this.items.push(); this.items[0].who = this.items[1].who; }
      }
    `)).toBeUndefined();

    // Two rebuilds that name different elements are not one stated element.
    expect(sourcesOf(`
      contract Impl {
        struct Detail { address who; uint amount; }
        address public implementation;
        Detail[] public items;
        function add(address who, address other) { this.items.push(); this.items[0].who = who; this.items[1].who = other; }
      }
    `)).toBeUndefined();
  });

  it('stays absent for a shape the run cannot be sized from', () => {
    // A conditional append grows the run by zero or one, a repeated append by two, a loop by its trip count, and
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

    // An indexed write replaces an element rather than appending the one stated element.
    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        function add(address who) { this.items.push(who); this.items[0] = who; }
      }
    `)).toBeUndefined();

    // An indexed write whose own value does not read the array replaces an element with an independent value; the
    // replay does not model that, so the append stays absent even though one element was pushed.
    expect(sourcesOf(`
      contract Impl {
        struct Detail { address who; uint amount; }
        address public implementation;
        Detail[] public items;
        function add(address who) { this.items.push(); this.items[0] = Detail(who, 1); }
      }
    `)).toBeUndefined();

    // An unrelated construction beside the append does not relax any of the above.
    expect(sourcesOf(`
      contract Impl {
        struct Entry { address who; uint up; }
        address public implementation;
        mapping(address => Entry) public members;
        address[] public items;
        function add(address who) { this.items.push(who); this.items.push(who); this.members[who] = Entry(who, 1); }
      }
    `)).toBeUndefined();

    expect(sourcesOf(`
      contract Impl {
        struct Entry { address who; uint up; }
        address public implementation;
        mapping(address => Entry) public members;
        address[] public items;
        function add(address who) { this.members[who] = Entry(who, 1); for (int i = 0; i < 3; i = i + 1) { this.items.push(who); } }
      }
    `)).toBeUndefined();

    expect(sourcesOf(`
      contract Impl {
        struct Entry { address who; uint up; }
        address public implementation;
        mapping(address => Entry) public members;
        address[] public items;
        function add(address who) { this.items.push(who); this.members[who] = Entry(who, 1); this.items[0] = who; }
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

  it('publishes the append beside a helper that writes elsewhere', () => {
    expect(sourcesOf(`
      contract Impl {
        address public implementation;
        address[] public items;
        mapping(address => uint) public counts;
        function add(address who) { this.items.push(who); this.mark(who); }
        function mark(address who) private { this.counts[who] = 1; }
      }
    `)).toStrictEqual({ items: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } } });
  });

  it('stays absent under a convention that does not consume the entry shape', () => {
    // The direct convention has its own element-source publication; only the framed hop reads this one.
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
