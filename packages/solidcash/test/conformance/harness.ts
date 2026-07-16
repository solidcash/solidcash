// Differential conformance harness: one source corpus compiled by BOTH solc (EVM) and solidc (BCH),
// evaluated on BOTH VMs, asserting value-identical results. The EVM side is the reference; the BCH
// side proves it matches by a require(<computed> == <expected>) oracle fed the EVM result.
import { compileEvm, evalEvm } from './evm.js';
import { compileBch, evalBchCheck, evalBchRejects } from './bch.js';

const SPDX = '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n';

export interface ConformanceCase {
  // solidity: `contract C { function <evmFn>(...) returns (T) { ... } }`
  solidity: string;
  // scash: `contract Conf() { function <bchFn>(<same inputs>, T __expected) { require(... == __expected); } }`
  scash: string;
  evmFn: string;
  bchFn: string;
  args: readonly unknown[]; // inputs, shared by both sides (JS values both encoders accept: bigint, hex, bool)
  evmCompat?: boolean; // compile the BCH side with evmCompat (EVM-faithful abi encoding)
  label?: string;
}

// Run one case: eval the EVM reference, then assert the BCH covenant accepts that result. Throws on mismatch.
export async function assertConformant(c: ConformanceCase): Promise<void> {
  const { decoded } = await evalEvm(compileEvm(c.solidity), c.evmFn, c.args);
  const pass = await evalBchCheck(compileBch(c.scash, c.evmCompat), c.bchFn, [...c.args, ...decoded]);
  if (!pass) {
    const tag = c.label ? ` [${c.label}]` : '';
    throw new Error(
      `Conformance MISMATCH${tag}: EVM ${c.evmFn}(${fmt(c.args)}) = ${fmt(decoded)}, `
      + 'but the BCH covenant rejected that as its computed result',
    );
  }
}

// Build a single-expression case. `expr` is used verbatim on both sides unless `bchExpr` overrides it.
// The common Solidity/SolidCash subset shares param and type syntax, so most cases need only one string.
export function exprCase(o: {
  params: string; // shared parameter list, e.g. 'int a, int b' ('' for none)
  retType: string; // shared return/expected type, e.g. 'int', 'uint', 'bytes32', 'bool'
  expr: string;
  args: readonly unknown[];
  bchExpr?: string; // override the expression on the BCH side if syntax must differ
  unchecked?: boolean; // wrap the arithmetic in unchecked { } on both sides
  label?: string;
}): ConformanceCase {
  const paramsSep = o.params.length > 0 ? `${o.params}, ` : '';
  const evmStmt = `return ${o.expr};`;
  const bchStmt = `require((${o.bchExpr ?? o.expr}) == __expected);`;
  const evmBody = o.unchecked ? `unchecked { ${evmStmt} }` : evmStmt;
  const bchBody = o.unchecked ? `unchecked { ${bchStmt} }` : bchStmt;
  return {
    solidity: `${SPDX}contract C {\n  function f(${o.params}) public pure returns (${o.retType}) {\n`
      + `    ${evmBody}\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${paramsSep}${o.retType} __expected) {\n`
      + `    ${bchBody}\n  }\n}\n`,
    evmFn: 'f',
    bchFn: 'f',
    args: o.args,
    label: o.label ?? o.expr,
  };
}

// A case where the operation must REVERT on BOTH sides (e.g. checked over/underflow, division by zero).
export type RevertCase = ConformanceCase;

// Assert the EVM reference AND the BCH covenant both reject the operation.
export async function assertReverts(c: RevertCase): Promise<void> {
  const tag = c.label ? ` [${c.label}]` : '';
  let evmReverted = false;
  try {
    await evalEvm(compileEvm(c.solidity), c.evmFn, c.args);
  } catch {
    evmReverted = true;
  }
  if (!evmReverted) throw new Error(`Revert MISMATCH${tag}: expected EVM to revert, but it returned a value`);
  const bchRejected = await evalBchRejects(compileBch(c.scash), c.bchFn, c.args);
  if (!bchRejected) throw new Error(`Revert MISMATCH${tag}: expected the BCH covenant to reject, but it accepted`);
}

// Build a revert case: `expr` must overflow/underflow/divide-by-zero under checked semantics.
export function revertCase(o: {
  params: string; retType: string; expr: string; args: readonly unknown[]; label?: string;
}): RevertCase {
  return {
    solidity: `${SPDX}contract C {\n  function f(${o.params}) public pure returns (${o.retType}) {\n`
      + `    return ${o.expr};\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${o.params}) {\n`
      + `    ${o.retType} __r = ${o.expr};\n    require(__r == __r);\n  }\n}\n`,
    evmFn: 'f',
    bchFn: 'f',
    args: o.args,
    label: o.label ?? o.expr,
  };
}

// Build an inline-assembly case: `yul` is a Yul body that assigns the result word to `r`.
// EVM assembly is inherently unchecked (ops wrap mod 2^256, div/mod by zero return 0).
export function asmCase(o: {
  params: string; retType: string; yul: string; args: readonly unknown[]; label?: string;
}): ConformanceCase {
  const paramsSep = o.params.length > 0 ? `${o.params}, ` : '';
  return {
    solidity: `${SPDX}contract C {\n  function f(${o.params}) public pure returns (${o.retType} r) {\n`
      + `    assembly { ${o.yul} }\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${paramsSep}${o.retType} __expected) {\n`
      + `    ${o.retType} r = 0;\n    assembly { ${o.yul} }\n    require(r == __expected);\n  }\n}\n`,
    evmFn: 'f',
    bchFn: 'f',
    args: o.args,
    label: o.label ?? o.yul,
  };
}

// Build an abi.encode / abi.encodePacked case. The Solidity side returns the encoding as `bytes`; the BCH
// side (compiled with evmCompat) asserts it produces the same bytes. `encodeArgs` is the argument list inside
// abi.encode(...), referencing the params.
export function abiCase(o: {
  params: string; encodeArgs: string; args: readonly unknown[]; packed?: boolean; label?: string;
}): ConformanceCase {
  const fn = o.packed ? 'abi.encodePacked' : 'abi.encode';
  const paramsSep = o.params.length > 0 ? `${o.params}, ` : '';
  return {
    solidity: `${SPDX}contract C {\n  function f(${o.params}) public pure returns (bytes memory) {\n`
      + `    return ${fn}(${o.encodeArgs});\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${paramsSep}bytes __expected) {\n`
      + `    require(${fn}(${o.encodeArgs}) == __expected);\n  }\n}\n`,
    evmFn: 'f',
    bchFn: 'f',
    args: o.args,
    evmCompat: true,
    label: o.label ?? `${fn}(${o.encodeArgs})`,
  };
}

// Build an abi.encodeWithSelector case. `selectorAndArgs` is the full argument list to
// abi.encodeWithSelector(...) - the selector first, then the encoded args.
export function selCase(o: {
  params: string; selectorAndArgs: string; args: readonly unknown[]; label?: string;
}): ConformanceCase {
  const paramsSep = o.params.length > 0 ? `${o.params}, ` : '';
  return {
    solidity: `${SPDX}contract C {\n  function f(${o.params}) public pure returns (bytes memory) {\n`
      + `    return abi.encodeWithSelector(${o.selectorAndArgs});\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${paramsSep}bytes __expected) {\n`
      + `    require(abi.encodeWithSelector(${o.selectorAndArgs}) == __expected);\n  }\n}\n`,
    evmFn: 'f',
    bchFn: 'f',
    args: o.args,
    evmCompat: true,
    label: o.label ?? `encodeWithSelector(${o.selectorAndArgs})`,
  };
}

function fmt(vals: readonly unknown[]): string {
  return vals.map((v) => (typeof v === 'bigint' ? v.toString() : JSON.stringify(v))).join(', ');
}
