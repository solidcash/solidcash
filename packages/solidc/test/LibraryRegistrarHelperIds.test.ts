import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

/**
 * Compiler helper ids and the contract's own function ids stay off the ids a registrar library defines when it runs.
 *
 * A registrar blob OP_DEFINEs its own helpers at fixed ids once it is loaded. A helper or function the contract had
 * already defined at one of them makes that load fail with "function identifier previously defined", so the
 * single-byte helper pool and the function numbering must skip them.
 */

// Defines OP_1ADD at -1, 1 and 2, then the callable (invoking the helper at 2) at the id the loader pushes:
//   <8b> OP_1NEGATE OP_DEFINE <8b> OP_1 OP_DEFINE <8b> OP_2 OP_DEFINE <OP_2 OP_INVOKE> OP_SWAP OP_DEFINE
const REGISTRAR = {
  name: 'inc2',
  code: '018b4f89018b5189018b528902528a7c89',
  abi: { inputs: [{ name: 'x', type: 'int' }], outputs: [{ type: 'int' }] },
  registrar: true,
};
const REGISTRAR_IDS = ['OP_1NEGATE', 'OP_1', 'OP_2'];
const SINGLE_BYTE_IDS = new Set(['OP_1NEGATE', ...Array.from({ length: 16 }, (_unused, index) => `OP_${index + 1}`)]);

// A 32-byte constant repeated in a body, which the compiler shares through a helper.
const K = `0x${'11'.repeat(32)}`;
const body = (offset: number): string => `
        require(inc2(n) == n + ${offset});
        require(a != ${K});
        require(b != ${K});
        require(a != b || a == ${K});`;

// One entry point: its body is the top-level script. Two: their OP_DEFINE'd bodies are outlined together.
const ONE_ENTRY = `contract RegistrarIds() { function f(int n, bytes32 a, bytes32 b) {${body(1)} } }`;
const TWO_ENTRIES = `contract RegistrarIds() {
    function f(int n, bytes32 a, bytes32 b) {${body(1)} }
    function g(int n, bytes32 a, bytes32 b) {${body(2)} }
}`;

/** The single-byte ids the top-level script OP_DEFINEs. */
const singleByteDefinedIds = (asm: string): string[] => {
  const tokens = asm.split(/\s+/);
  return tokens.flatMap((token, at) => (token === 'OP_DEFINE' && SINGLE_BYTE_IDS.has(tokens[at - 1])
    ? [tokens[at - 1]] : []));
};

describe('compiler helper ids beside a registrar library', () => {
  for (const [shape, source] of [['one entry point', ONE_ENTRY], ['two entry points', TWO_ENTRIES]] as const) {
    it(`skip the ids the registrar defines (${shape})`, () => {
      const ids = singleByteDefinedIds(compileString(source, { userLibraries: [REGISTRAR] }).bytecode);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.filter((id) => REGISTRAR_IDS.includes(id))).toStrictEqual([]);
    });
  }
});

// Defines OP_1ADD at 0, 1 and 2, then the callable (invoking the helper at 2), the ids user functions start at:
//   <8b> OP_0 OP_DEFINE <8b> OP_1 OP_DEFINE <8b> OP_2 OP_DEFINE <OP_2 OP_INVOKE> OP_SWAP OP_DEFINE
const LOW_REGISTRAR = { ...REGISTRAR, name: 'inc', code: '018b0089018b5189018b528902528a7c89' };
const LOW_REGISTRAR_IDS = ['OP_0', 'OP_1', 'OP_2'];

// Internal functions each invoked more than once, so each keeps an OP_DEFINE under its own id.
const internalFunctions = (loadsLibrary: boolean): string => `contract RegistrarUserIds() {
    function h0(int x) internal pure returns (int) { return x * 3 + 1; }
    function h1(int x) internal pure returns (int) { return h0(x) * 5 + 2; }
    function h2(int x) internal pure returns (int) { return h1(x) - h0(x); }
    function h3(int x) internal pure returns (int) { return h2(x) + h1(x); }
    function f(int n) {
        require(${loadsLibrary ? 'inc(h3(n))' : 'h3(n) + 1'} == h3(n) + 1);
        require(h2(n) != h0(n));
    }
}`;

/** Every id the top-level script OP_DEFINEs, in emission order. */
const definedIds = (asm: string): string[] => {
  const tokens = asm.split(/\s+/);
  return tokens.flatMap((token, at) => (token === 'OP_DEFINE' ? [tokens[at - 1]] : []));
};

describe('contract function ids beside a registrar library', () => {
  it('skip the ids the registrar defines, so no id is defined twice', () => {
    const ids = definedIds(compileString(internalFunctions(true), { userLibraries: [LOW_REGISTRAR] }).bytecode);
    // h0..h3, the compiler helpers and the registrar's setup id.
    expect(ids.length).toBeGreaterThanOrEqual(6);
    const all = [...ids, ...LOW_REGISTRAR_IDS];
    expect(all.filter((id, at) => all.indexOf(id) !== at)).toStrictEqual([]);
  });

  it('start at 0 when no library is loaded', () => {
    const ids = definedIds(compileString(internalFunctions(false)).bytecode);
    expect(ids).toEqual(expect.arrayContaining(['OP_0', 'OP_1', 'OP_2', 'OP_3']));
  });
});
