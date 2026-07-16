// Differential conformance harness: one source corpus compiled by BOTH solc (EVM) and solidc (BCH),
// evaluated on BOTH VMs, asserting value-identical results. The EVM side is the reference; the BCH
// side proves it matches by a require(<computed> == <expected>) oracle fed the EVM result.
import {
  compileEvm, evalEvm, ethersAbiEncode, ethersAbiEncodePacked,
} from './evm.js';
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
  expectedConst?: string; // abi cases: the ethers-computed expected bytes, baked into scash + cross-checked vs solc
  bothAccept?: boolean; // single-word abi: identical bytes32-compare covenant on both VMs (run via assertBothAccept)
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

// Symmetric conformance: the SAME logical contract (a self-contained `require(...)` covenant) runs on BOTH VMs
// and both must accept - no EVM-computed reference is injected. Used where the expected value is self-contained
// (e.g. a round-trip, where the result must equal the input by definition), so the two sources differ only in the
// unavoidable Solidity decorations (SPDX/pragma, `contract C`, `public pure`) and not in the logic under test.
export async function assertBothAccept(c: ConformanceCase): Promise<void> {
  const tag = c.label ? ` [${c.label}]` : '';
  try {
    await evalEvm(compileEvm(c.solidity), c.evmFn, c.args);
  } catch (e) {
    throw new Error(`Conformance${tag}: EVM rejected its own check: ${e instanceof Error ? e.message : String(e)}`);
  }
  const pass = await evalBchCheck(compileBch(c.scash, c.evmCompat), c.bchFn, c.args);
  if (!pass) throw new Error(`Conformance${tag}: EVM accepted but the BCH covenant rejected`);
}

// abi.encode/encodePacked/encodeWithSelector conformance against a baked ethers constant. Two independent layers:
// (1) solc's OWN abi output must equal the ethers constant (validates the constant against the real compiler),
// (2) the BCH covenant checks its abi output against that same baked constant. So the expected bytes are a fixed,
// human-auditable anchor that both toolchains are pinned to, not a shared live re-derivation they could both miss.
export async function assertEncodeConformant(c: ConformanceCase): Promise<void> {
  const tag = c.label ? ` [${c.label}]` : '';
  const want = c.expectedConst!.toLowerCase();
  const { decoded } = await evalEvm(compileEvm(c.solidity), c.evmFn, c.args);
  const evmBytes = String(decoded[0]).toLowerCase();
  if (evmBytes !== want) {
    throw new Error(`Conformance${tag}: solc abi output ${evmBytes} != ethers constant ${want}`);
  }
  const pass = await evalBchCheck(compileBch(c.scash, c.evmCompat), c.bchFn, c.args);
  if (!pass) throw new Error(`Conformance${tag}: the BCH covenant's abi output != the ethers constant ${want}`);
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
  const types = paramTypes(o.params);
  const byName = argsByName(o.params, o.args);
  const names = o.encodeArgs.split(',').map((s) => s.trim());
  const expected = (o.packed ? ethersAbiEncodePacked : ethersAbiEncode)(
    names.map((n) => types[n]), names.map((n) => byName[n]),
  );
  // A single-word (exactly 32-byte) abi.encode compares symmetrically via a bytes32 cast: `==` on bytes32 is a
  // value-type op both Solidity and SolidCash accept, so BOTH contracts are the identical covenant and each
  // self-verifies the exact 32 bytes (byte order, two's-complement) on-chain. Larger/packed encodings keep the
  // return + baked-constant cross-check (Solidity has no bytes memory ==).
  if (!o.packed && expected.length === 66) {
    const logic = `require(bytes32(${fn}(${o.encodeArgs})) == ${expected});`;
    return {
      solidity: `${SPDX}contract C {\n  function f(${o.params}) public pure {\n    ${logic}\n  }\n}\n`,
      scash: `contract Conf() {\n  function f(${o.params}) {\n    ${logic}\n  }\n}\n`,
      evmFn: 'f',
      bchFn: 'f',
      args: o.args,
      evmCompat: true,
      bothAccept: true,
      expectedConst: expected,
      label: o.label ?? `${fn}(${o.encodeArgs})`,
    };
  }
  return {
    solidity: `${SPDX}contract C {\n  function f(${o.params}) public pure returns (bytes memory) {\n`
      + `    return ${fn}(${o.encodeArgs});\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${o.params}) {\n`
      + `    require(${fn}(${o.encodeArgs}) == ${expected});\n  }\n}\n`,
    evmFn: 'f',
    bchFn: 'f',
    args: o.args,
    evmCompat: true,
    expectedConst: expected,
    label: o.label ?? `${fn}(${o.encodeArgs})`,
  };
}

// Dispatch an abi case to the right assertion: single-word cases run the identical bytes32-compare covenant on
// both VMs (assertBothAccept); larger/dynamic cases use the baked-constant cross-check (assertEncodeConformant).
export function assertAbi(c: ConformanceCase): Promise<void> {
  return c.bothAccept ? assertBothAccept(c) : assertEncodeConformant(c);
}

// Build an abi.encodeWithSelector case. `selectorAndArgs` is the full argument list to
// abi.encodeWithSelector(...) - the selector first, then the encoded args.
export function selCase(o: {
  params: string; selectorAndArgs: string; args: readonly unknown[]; label?: string;
}): ConformanceCase {
  const types = paramTypes(o.params);
  const byName = argsByName(o.params, o.args);
  const names = o.selectorAndArgs.split(',').map((s) => s.trim());
  const selector = String(byName[names[0]]); // first arg is the 4-byte selector, prepended raw
  const rest = names.slice(1);
  const expected = selector + ethersAbiEncode(rest.map((n) => types[n]), rest.map((n) => byName[n])).slice(2);
  return {
    solidity: `${SPDX}contract C {\n  function f(${o.params}) public pure returns (bytes memory) {\n`
      + `    return abi.encodeWithSelector(${o.selectorAndArgs});\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${o.params}) {\n`
      + `    require(abi.encodeWithSelector(${o.selectorAndArgs}) == ${expected});\n  }\n}\n`,
    evmFn: 'f',
    bchFn: 'f',
    args: o.args,
    evmCompat: true,
    expectedConst: expected,
    label: o.label ?? `encodeWithSelector(${o.selectorAndArgs})`,
  };
}

// Build an abi.decode round-trip case. The expected value of abi.decode(abi.encode(a), (T)) is `a` BY DEFINITION,
// so no EVM-computed reference is needed: both sides run the SAME self-contained covenant require(roundtrip == a)
// (run via assertBothAccept). Since abi.encode is separately proven EVM-byte-identical, decode inverting it proves
// decode is EVM-faithful. Single value type per case.
export function decodeCase(o: { type: string; value: unknown; label?: string }): ConformanceCase {
  const logic = `require(abi.decode(abi.encode(a), (${o.type})) == a);`;
  return {
    solidity: `${SPDX}contract C {\n  function f(${o.type} a) public pure {\n    ${logic}\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${o.type} a) {\n    ${logic}\n  }\n}\n`,
    evmFn: 'f',
    bchFn: 'f',
    args: [o.value],
    evmCompat: true,
    label: o.label ?? `decode<${o.type}>`,
  };
}

// Multi-value abi.decode round-trip: each decoded element must equal its corresponding input (the self-contained
// expected), so both sides run the SAME covenant. Exercises the N-word head layout.
export function decodeMultiCase(o: {
  types: readonly string[]; names: readonly string[]; values: readonly unknown[]; label?: string;
}): ConformanceCase {
  const params = o.types.map((t, i) => `${t} ${o.names[i]}`).join(', ');
  const encArgs = o.names.join(', ');
  const rets = o.types.join(', ');
  const decls = o.types.map((t, i) => `${t} x${i}`).join(', ');
  const checks = o.names.map((n, i) => `require(x${i} == ${n});`).join('\n    ');
  // Parenthesized tuple-destructuring is the shared form (valid Solidity AND SolidCash).
  const logic = `(${decls}) = abi.decode(abi.encode(${encArgs}), (${rets}));\n    ${checks}`;
  return {
    solidity: `${SPDX}contract C {\n  function f(${params}) public pure {\n    ${logic}\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${params}) {\n    ${logic}\n  }\n}\n`,
    evmFn: 'f',
    bchFn: 'f',
    args: o.values,
    evmCompat: true,
    label: o.label ?? `decode<${rets}>`,
  };
}

// abi.decode of DYNAMIC types (bytes/string), tested BCH-side: an ethers-encoded blob (the EVM reference) is
// decoded on-chain and each element compared to the original via SolidCash's `bytes ==` (Solidity has no bytes==,
// so no symmetric contract is possible here). This exercises the head-offset/tail random access directly.
export function bchDecodeCase(o: {
  types: readonly string[]; values: readonly unknown[]; label?: string;
}): { scash: string; args: readonly unknown[]; label: string } {
  const blob = ethersAbiEncode(o.types.map(toEthers), o.values);
  const expParams = o.types.map((t, i) => `${t} __e${i}`).join(', ');
  const checks = o.types.map((_, i) => `require(x${i} == __e${i});`).join('\n    ');
  const lhs = o.types.length === 1
    ? `${o.types[0]} x0`
    : `(${o.types.map((t, i) => `${t} x${i}`).join(', ')})`;
  const scash = `contract Conf() {\n  function f(bytes blob, ${expParams}) {\n`
    + `    ${lhs} = abi.decode(blob, (${o.types.join(', ')}));\n    ${checks}\n  }\n}\n`;
  return { scash, args: [blob, ...o.values], label: o.label ?? `decode<${o.types.join(', ')}>` };
}

export async function assertBchDecode(c: { scash: string; args: readonly unknown[]; label: string }): Promise<void> {
  const pass = await evalBchCheck(compileBch(c.scash, true), 'f', c.args);
  if (!pass) throw new Error(`BCH decode MISMATCH [${c.label}]: decoding an ethers-encoded blob != the inputs`);
}

function toEthers(t: string): string {
  if (t === 'uint') return 'uint256';
  if (t === 'int') return 'int256';
  return t;
}

// Parse a parameter list into { paramName: ethersType } (uint->uint256, int->int256, `T memory`->T).
function paramTypes(params: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of params.split(',').map((s) => s.trim()).filter(Boolean)) {
    const toks = p.split(/\s+/).filter((t) => t !== 'memory');
    let type = toks.slice(0, -1).join('');
    if (type === 'uint') type = 'uint256';
    if (type === 'int') type = 'int256';
    map[toks[toks.length - 1]] = type;
  }
  return map;
}

// Map positional args (in parameter order) to { paramName: value }.
function argsByName(params: string, args: readonly unknown[]): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  params.split(',').map((s) => s.trim()).filter(Boolean)
    .forEach((p, i) => { map[p.split(/\s+/).filter((t) => t !== 'memory').slice(-1)[0]] = args[i]; });
  return map;
}

function fmt(vals: readonly unknown[]): string {
  return vals.map((v) => (typeof v === 'bigint' ? v.toString() : JSON.stringify(v))).join(', ');
}
