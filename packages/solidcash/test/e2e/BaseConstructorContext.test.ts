import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// A base constructor inlined into a derived one keeps its own context: `super` resolves from the base that wrote it
// (solc semanticTests inheritance/super_in_constructor*.sol), and its modifiers still wrap it, resolved against the
// most-derived override (modifiers/function_modifier_for_constructor.sol, ..._in_creation_context.sol).
const options = { evmCompat: true, forceStateful: true };

const SUPER_SRC = `
contract A { function f() public virtual returns (uint256 r) { return 1; } }
contract B is A { function f() public virtual override returns (uint256 r) { return super.f() | 2; } }
contract C is A { function f() public virtual override returns (uint256 r) { return super.f() | 4; } }
contract D is B, C {
  uint256 data;
  uint256 viaPointer;
  constructor() {
    data = super.f() | 8;
    function() internal returns (uint) g = super.f;
    viaPointer = g() | 16;
  }
  function f() public override (B, C) returns (uint256 r) { return data; }
}
contract E is D {
  function ok() public { require(f() == 15 && viaPointer == 23); }
  function wrong() public { require(f() == 8); }
}`;

const MODIFIER_SRC = `
contract A {
  uint256 data;
  constructor() mod1 { data |= 2; }
  modifier mod1 virtual { data |= 1; _; }
  function getData() public returns (uint256 r) { return data; }
}
contract C is A {
  modifier mod1 override { data |= 4; _; }
  function ok() public { require(getData() == 6); }
}`;

const CREATION_CONTEXT_SRC = `
contract A {
  uint256 data;
  constructor() mod1 { f1(); }
  function f1() public mod2 { data |= 0x1; }
  function f2() public { data |= 0x20; }
  function f3() public virtual {}
  modifier mod1 virtual { f2(); _; }
  modifier mod2 { f3(); if (false) _; }
  function getData() public returns (uint256 r) { return data; }
}
contract C is A {
  modifier mod1 override { f4(); _; }
  function f3() public override { data |= 0x300; }
  function f4() public { data |= 0x4000; }
  function ok() public { require(getData() == 0x4300); }
}`;

// A root base's `m(args)` constructor modifier, its argument bound to the base constructor's parameter.
const MODIFIER_ARGS_SRC = `
contract P {
  uint256 public v;
  modifier bump(uint256 k) { v += k; _; }
  constructor(uint256 x) bump(x * 10) { v += x; }
}
contract Q is P(3) {
  function ok() public view { require(v == 33); }
}`;

const deploy = async (source: string): Promise<Record<string, () => Promise<unknown>>> => {
  const contract = await getContractFactory(compileString(source, options), await fundedSigner()).deploy();
  return contract as unknown as Record<string, () => Promise<unknown>>;
};

describe('base constructor context (runtime)', () => {
  it('super in a base constructor resolves from that base (call and pointer)', async () => {
    const sc = await deploy(SUPER_SRC);
    await expect(sc.ok()).resolves.toBeDefined();
    await expect(sc.wrong()).rejects.toThrow();
  });
  it('a base constructor modifier runs the most-derived override', async () => {
    await expect((await deploy(MODIFIER_SRC)).ok()).resolves.toBeDefined();
  });
  it('a base constructor modifier calling virtual functions in creation context', async () => {
    await expect((await deploy(CREATION_CONTEXT_SRC)).ok()).resolves.toBeDefined();
  });
  it('a root base constructor modifier with an argument bound to its parameter', async () => {
    await expect((await deploy(MODIFIER_ARGS_SRC)).ok()).resolves.toBeDefined();
  });
});
