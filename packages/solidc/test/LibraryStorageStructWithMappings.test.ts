import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// An iterable map kept in a library: a `storage` pointer to a struct holding mappings and a dynamic array. A
// using-for call on the contract's state struct inlines the library body onto the struct's flattened fields.
const LIBRARY = `
library Roster {
    struct Book {
        address[] keys;
        mapping(address => uint256) values;
        mapping(address => uint256) indexOf;
        mapping(address => bool) inserted;
    }

    function get(Book storage book, address key) public view returns (uint256) {
        return book.values[key];
    }

    function keyAt(Book storage book, uint256 index) public view returns (address) {
        return book.keys[index];
    }

    function size(Book storage book) public view returns (uint256) {
        return book.keys.length;
    }

    function set(Book storage book, address key, uint256 val) public {
        if (book.inserted[key]) {
            book.values[key] = val;
        } else {
            book.inserted[key] = true;
            book.values[key] = val;
            book.indexOf[key] = book.keys.length;
            book.keys.push(key);
        }
    }

    function remove(Book storage book, address key) public {
        if (!book.inserted[key]) {
            return;
        }
        delete book.inserted[key];
        delete book.values[key];
        uint256 index = book.indexOf[key];
        address lastKey = book.keys[book.keys.length - 1];
        book.indexOf[lastKey] = index;
        delete book.indexOf[key];
        book.keys[index] = lastKey;
        book.keys.pop();
    }
}
`;

const usingFor = (state: string): string => `${LIBRARY}
contract Holder {
    using Roster for Roster.Book;
    Roster.Book private ${state};

    function put(uint256 val) public { ${state}.set(msg.sender, val); }
    function read() public view returns (uint256) { return ${state}.get(msg.sender); }
    function keyAt(uint256 index) public view returns (address) { return ${state}.keyAt(index); }
    function count() public view returns (uint256) { return ${state}.size(); }
    function drop() public { ${state}.remove(msg.sender); }
}`;

const EXPLICIT = `${LIBRARY}
contract Holder {
    Roster.Book private book;

    function put(uint256 val) public { Roster.set(book, msg.sender, val); }
    function read() public view returns (uint256) { return Roster.get(book, msg.sender); }
    function drop() public { Roster.remove(book, msg.sender); }
}`;

const MAPPING_ONLY = `
library Tally {
    struct Book {
        mapping(address => uint256) values;
        mapping(address => bool) inserted;
    }

    function get(Book storage book, address key) public view returns (uint256) {
        return book.values[key];
    }

    function set(Book storage book, address key, uint256 val) public {
        book.inserted[key] = true;
        book.values[key] = val;
    }
}
contract Holder {
    using Tally for Tally.Book;
    Tally.Book private book;

    function put(uint256 val) public { book.set(msg.sender, val); }
    function read() public view returns (uint256) { return book.get(msg.sender); }
}`;

describe('library storage pointer to a struct with mappings and a dynamic array', () => {
  it('compiles using-for calls on a state struct named like the pointer parameter', () => {
    expect(compileString(usingFor('book'), { evmCompat: true }).contractName).toBe('Holder');
  });

  it('compiles using-for calls on a state struct named unlike the pointer parameter', () => {
    expect(compileString(usingFor('entries'), { evmCompat: true }).contractName).toBe('Holder');
  });

  it('compiles explicit library calls on the state struct', () => {
    expect(compileString(EXPLICIT, { evmCompat: true }).contractName).toBe('Holder');
  });

  it('compiles a mapping-only struct through using-for', () => {
    expect(compileString(MAPPING_ONLY, { evmCompat: true }).contractName).toBe('Holder');
  });

  it('compiles with automatic message-bus selection', () => {
    expect(compileString(usingFor('book'), { evmCompat: true, messageBus: undefined }).contractName)
      .toBe('Holder');
  });
});

// A storage-pointer library fn called with a MAPPING-ELEMENT argument (`L.f(m[k])` / `m[k].f()`, the BentoBox
// BoringRebase `totals[token].addElastic(x)` shape). InlineStoragePointerCalls lowers both spellings to the same
// read-modify-write template, so the direct call and the using-for method call are byte-identical.
describe('storage-pointer library fn on a mapping element (direct + using-for spellings)', () => {
  const SP_STRUCT = 'struct Total { int elastic; int base; }';
  const SP_LIBRARY = 'library L { function add(Total storage t, int d) internal { t.elastic += d; } }';

  const direct = `${SP_STRUCT}${SP_LIBRARY}
    contract C { mapping(address => Total) totals;
      function bump(address token, int d) external { L.add(totals[token], d); require(true); } }`;

  const method = `${SP_STRUCT}${SP_LIBRARY}
    contract C { using L for Total; mapping(address => Total) totals;
      function bump(address token, int d) external { totals[token].add(d); require(true); } }`;

  it('compiles L.f(m[k]) on a mapping element', () => {
    expect(compileString(direct, { evmCompat: true }).contractName).toBe('C');
  });

  it('compiles m[k].f() on a mapping element and is byte-identical to L.f(m[k])', () => {
    const a = compileString(direct, { evmCompat: true });
    const b = compileString(method, { evmCompat: true });
    expect(b.contractName).toBe('C');
    expect(b.bytecode).toBe(a.bytecode);
  });

  // The STATE-ARRAY element spelling lowers through the same RMW template. It is byte-identical to the
  // hand-written read-modify-write, so the storage-pointer lowering itself is not what a later pass rejects.
  it('lowers L.addX(this.arr[i], d) byte-identically to the hand-written RMW', () => {
    const hand = compileString('contract C { struct P { int x; int y; } P[] arr;'
      + ' function bump(int i, int d) external { P t = this.arr[i]; t.x += d; this.arr[i] = t; require(true); } }',
    { evmCompat: true });
    const lib = compileString('struct P { int x; int y; }'
      + ' library L { function addX(P storage p, int d) { p.x += d; } }'
      + ' contract C { P[] arr; function bump(int i, int d) external { L.addX(this.arr[i], d); require(true); } }',
    { evmCompat: true });
    expect(lib.bytecode).toBe(hand.bytecode);
  });
});
