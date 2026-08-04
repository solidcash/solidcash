import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from '../direct-compile.js';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
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

// Whole-field assign of a chunk-dynamic ARRAY leaf on a flattened struct (`s.a = arr;`): the leaf is a
// state var of its own, so the write routes like a scalar leaf.
const ARRAY_LEAF = `pragma solidity ^0.8.0;
contract ArrayLeaf {
    struct S { bytes b; uint16[] a; uint16 u; }
    S s;
    function w(uint16 v) public {
        uint16[] memory a = new uint16[](2);
        a[0] = v;
        a[1] = 14;
        s.b = "foo";
        s.a = a;
        s.u = 21;
    }
    function r(uint16 v) public view {
        require(s.u == 21 && s.a[0] == v && s.a[1] == 14 && s.b.length == 3);
    }
}`;

describe('flattened struct array-leaf whole assign (runtime)', () => {
  it('assigns a memory array to a chunk-dynamic array leaf and reads elements back', async () => {
    const art = compileString(ARRAY_LEAF, { solidityImportCompat: true, forceStateful: true, chunkedArrays: true });
    const contract = new Contract(art, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.w(13n).send()).resolves.toBeDefined();
    await expect(sc.r(13n).send()).resolves.toBeDefined();
  });
});

// State-struct ARRAY-field element writes (`m_x.a[0] = 5`) desugar to the temp roundtrip
// `X __t = m_x; __t.a[0] = 5; m_x = __t;` - byte-equivalent to the handwritten form. Runtime-sound since
// the SDK state encoder packs fixed-width array elements at their stride (it pushdata-encoded each element,
// diverging from the covenant's in-script struct encode - whole-struct writes of structs with fixed-array
// fields failed the output-commitment EQUALVERIFY).
const STATE_ELEM = `pragma solidity ^0.8.0;
contract StateElem {
    struct X { uint8 x; uint8[2] a; }
    X m_x;
    function w() public {
        m_x.x = 1;
        m_x.a[0] = 5;
        m_x.a[1] = 6;
    }
    function r() public view {
        require(m_x.x == 1 && m_x.a[0] == 5 && m_x.a[1] == 6);
    }
}`;

describe('state-struct array-field element write (runtime)', () => {
  it('writes elements through the temp roundtrip and reads them back in a later tx', async () => {
    const sc = await mk(STATE_ELEM);
    await expect(sc.w().send()).resolves.toBeDefined();
    await expect(sc.r().send()).resolves.toBeDefined();
  });
});

// Whole-struct entry copies on flattened structs: `m[0] = s` decomposes into per-field entry writes;
// whole reads (`S memory x = s;` / `= m[0];`) assemble a struct value from the leaves.
const ENTRY_COPY = `pragma solidity ^0.8.0;
contract EntryCopy {
    struct S { bytes b; uint16 u; }
    S s;
    mapping(uint => S) m;
    function seed() public {
        s.b = "foo";
        s.u = 21;
    }
    function copyToEntry() public { m[0] = s; }
    function checkEntry() public view { require(m[0].u == 21 && m[0].b.length == 3); }
    function wholeReads() public view {
        S memory x = s;
        require(x.u == 21);
        S memory y = m[0];
        require(y.u == 21);
    }
}`;

describe('whole-struct entry copies on flattened structs (runtime)', () => {
  it('copies a flattened struct into an entry and assembles whole reads back', async () => {
    const sc = await mk(ENTRY_COPY);
    await expect(sc.seed().send()).resolves.toBeDefined();
    await expect(sc.copyToEntry().send()).resolves.toBeDefined();
    await expect(sc.checkEntry().send()).resolves.toBeDefined();
    await expect(sc.wholeReads().send()).resolves.toBeDefined();
  });
});
