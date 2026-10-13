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
