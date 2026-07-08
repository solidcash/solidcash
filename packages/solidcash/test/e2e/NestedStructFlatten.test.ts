import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Recursively-flattened struct state: a struct-typed field carrying mappings expands into nested leaves
// (`str__nstr__nestedValue` state var, `str__nstr__nestedMapping` collection). Writes collapse leading
// members; reads chain through the field-access fold; `delete str` resets VALUE leaves only (Solidity
// leaves mappings intact). Also covers literal mapping keys (`m[0]`), which resolve as CONSTANT key
// sources so a pure read can locate its entry.
const provider = createTestProvider();

async function mk(src: string): Promise<StatefulContract> {
  const art = compileString(src, { solidityImportCompat: true, forceStateful: true });
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(contract, categoryId);
}

const NESTED = `pragma solidity ^0.8.0;
contract NestedFlatten {
    struct N { uint nestedValue; mapping(uint => bool) nestedMapping; }
    struct T { N nstr; uint topValue; mapping(uint => uint) topMapping; }
    T str;
    function writeAll() public {
        str.topValue = 1;
        str.nstr.nestedValue = 2;
        str.topMapping[0] = 7;
        str.nstr.nestedMapping[3] = true;
    }
    function checkAll() public view {
        require(str.topValue == 1 && str.nstr.nestedValue == 2);
        require(str.topMapping[0] == 7);
        require(str.nstr.nestedMapping[3] == true);
    }
    function wipe() public {
        delete str;
        require(str.topValue == 0 && str.nstr.nestedValue == 0);
    }
    function persist() public view {
        require(str.topMapping[0] == 7, "mapping persists across delete");
        require(str.nstr.nestedMapping[3] == true, "nested mapping persists across delete");
        require(str.topValue == 0 && str.nstr.nestedValue == 0);
    }
}`;

const DEPTH3 = `pragma solidity ^0.8.0;
contract Depth3 {
    struct A { uint v; mapping(uint => uint) m; }
    struct B { A a; uint w; }
    struct C2 { B b; mapping(uint => uint) top; }
    C2 c;
    function wr() public {
        c.b.a.v = 5;
        c.b.w = 6;
        c.b.a.m[1] = 9;
        c.top[2] = 8;
    }
    function rd() public view {
        require(c.b.a.v == 5 && c.b.w == 6);
        require(c.b.a.m[1] == 9 && c.top[2] == 8);
    }
}`;

const LITERAL_KEY = `pragma solidity ^0.8.0;
contract LiteralKey {
    mapping(uint => uint) m;
    function w() public { m[0] = 7; }
    function r() public view { require(m[0] == 7); }
}`;

describe('recursively flattened struct state (runtime)', () => {
  it('writes, reads, deletes values, and persists mappings across two nesting levels', async () => {
    const sc = await mk(NESTED);
    await expect(sc.writeAll().send()).resolves.toBeDefined();
    await expect(sc.checkAll().send()).resolves.toBeDefined();
    await expect(sc.wipe().send()).resolves.toBeDefined();
    await expect(sc.persist().send()).resolves.toBeDefined();
  });

  it('handles three levels of nesting with mappings at two depths', async () => {
    const sc = await mk(DEPTH3);
    await expect(sc.wr().send()).resolves.toBeDefined();
    await expect(sc.rd().send()).resolves.toBeDefined();
  });
});

describe('literal mapping keys resolve as constant key sources (runtime)', () => {
  it('a pure read of m[0] locates the entry written in an earlier tx', async () => {
    const sc = await mk(LITERAL_KEY);
    await expect(sc.w().send()).resolves.toBeDefined();
    await expect(sc.r().send()).resolves.toBeDefined();
  });
});
