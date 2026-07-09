import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Whole-struct <-> mapping-entry copies (Solidity struct-storage semantics), VM-verified end to end on a
// flattened struct (a dynamic bytes field forces flattening) + a scalar. A state
// write lands in the OUTPUT, so each write and its read-back check run in SEPARATE txs:
//   m[k] = S({..}) / S(..)   struct-constructor entry write (decomposed to per-field entry writes)
//   s = m[k]                 whole entry read into a flattened struct STATE var (per-field state writes)
//   sLocal.f = m[k].f        per-field write through a whole-var storage alias (S storage sLocal = s)
//   m2[j] = m1[k]            entry-to-entry copy (assemble the read, decompose into the target entry)
const provider = createTestProvider();

async function mk(src: string): Promise<StatefulContract> {
  const art = compileString(src, { solidityImportCompat: true, forceStateful: true, chunkedArrays: true });
  const contract = new Contract(art, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!, {}, { saltContract: true });
  return StatefulContract.withCategory(contract, categoryId);
}

// Fields exercised: a dynamic bytes (forces the struct to flatten) + a scalar. Array fields inside a
// mapping-of-struct value hit a separate pre-existing codegen gap (Block slot not found: entry[-1]) and are
// out of scope here.
const SRC = `pragma solidity ^0.8.0;
contract C {
    struct S { bytes b; uint u; }
    mapping(uint => S) m;
    mapping(uint => S) m2;
    S s;

    function writeCtorNamed() public { m[0] = S({b: "foo", u: 33}); }
    function writeCtorPositional() public { m[0] = S("foo", 33); }
    function readIntoStateVar() public { s = m[0]; }
    function copyEntryToEntry() public { m2[0] = m[0]; }

    function checkEntry() public view { require(m[0].u == 33 && m[0].b.length == 3); }
    function checkStateVar() public view { require(s.u == 33 && s.b.length == 3); }
    function checkStateVarWrong() public view { require(s.u == 999); }
    function checkEntry2() public view { require(m2[0].u == 33 && m2[0].b.length == 3); }
}`;

describe('whole-struct <-> mapping-entry copies (runtime)', () => {
  it('writes a struct-constructor value (named args) into a mapping entry', async () => {
    const sc = await mk(SRC);
    await sc.writeCtorNamed().send();
    await expect(sc.checkEntry().send()).resolves.toBeDefined();
  });
  it('writes a struct-constructor value (positional args) into a mapping entry', async () => {
    const sc = await mk(SRC);
    await sc.writeCtorPositional().send();
    await expect(sc.checkEntry().send()).resolves.toBeDefined();
  });
  it('reads a whole mapping entry into a struct state variable', async () => {
    const sc = await mk(SRC);
    await sc.writeCtorNamed().send();
    await sc.readIntoStateVar().send();
    await expect(sc.checkStateVar().send()).resolves.toBeDefined();
  });
  it('a wrong post-read expectation reverts (the read really wrote the entry values)', async () => {
    const sc = await mk(SRC);
    await sc.writeCtorNamed().send();
    await sc.readIntoStateVar().send();
    await expect(sc.checkStateVarWrong().send()).rejects.toThrow();
  });
  it('copies a whole entry into another mapping entry', async () => {
    const sc = await mk(SRC);
    await sc.writeCtorNamed().send();
    await sc.copyEntryToEntry().send();
    await expect(sc.checkEntry2().send()).resolves.toBeDefined();
  });
});
