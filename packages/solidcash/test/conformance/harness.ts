// Differential conformance harness: one source corpus compiled by BOTH solc (EVM) and solidc (BCH),
// evaluated on BOTH VMs, asserting value-identical results. The EVM side is the reference; the BCH
// side proves it matches by a require(<computed> == <expected>) oracle fed the EVM result.
import {
  compileEvm, evalEvm, ethersAbiEncode, ethersAbiEncodePacked, ethersSelector,
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

// The on-chain check that an abi expression's bytes equal the ethers constant, as ONE source valid on BOTH VMs
// (both self-verify on-chain via assertBothAccept). Returns null when no cheap symmetric form exists (a misaligned
// length: selector+args, packed>32) - the caller then uses the baked-constant cross-check. Keccak-free, byte-exact,
// and cheap: no per-byte loop (that blows the BCH op-cost budget past ~32 bytes).
//   <=32 bytes  -> truncate to bytesN and compare (a single value-type ==)
//   multiple/32 -> slice into 32-byte words via abi.decode-as-bytes32 and compare each (a few SPLITs + word ==)
function abiCheckLogic(expr: string, expected: string): string | null {
  const nbytes = (expected.length - 2) / 2;
  if (nbytes >= 1 && nbytes <= 32) {
    return `require(bytes${nbytes}(${expr}) == bytes${nbytes}(hex"${expected.slice(2)}"));`;
  }
  if (nbytes % 32 === 0) {
    const n = nbytes / 32;
    const decls = Array.from({ length: n }, (_, i) => `bytes32 w${i}`).join(', ');
    const schema = Array.from({ length: n }, () => 'bytes32').join(', ');
    const checks = Array.from({ length: n },
      (_, i) => `require(w${i} == 0x${expected.slice(2 + i * 64, 2 + (i + 1) * 64)});`).join('\n    ');
    return `(${decls}) = abi.decode(${expr}, (${schema}));\n    ${checks}`;
  }
  return null;
}

// Build a symmetric-if-possible / cross-checked-otherwise abi case around a check expression + its ethers const.
function abiCaseFrom(o: {
  params: string; expr: string; expected: string; args: readonly unknown[]; label: string;
}): ConformanceCase {
  const logic = abiCheckLogic(o.expr, o.expected);
  if (logic !== null) {
    return {
      solidity: `${SPDX}contract C {\n  function f(${o.params}) public pure {\n    ${logic}\n  }\n}\n`,
      scash: `contract Conf() {\n  function f(${o.params}) {\n    ${logic}\n  }\n}\n`,
      evmFn: 'f', bchFn: 'f', args: o.args, evmCompat: true, bothAccept: true, expectedConst: o.expected, label: o.label,
    };
  }
  return {
    solidity: `${SPDX}contract C {\n  function f(${o.params}) public pure returns (bytes memory) {\n`
      + `    return ${o.expr};\n  }\n}\n`,
    scash: `contract Conf() {\n  function f(${o.params}) {\n    require(${o.expr} == ${o.expected});\n  }\n}\n`,
    evmFn: 'f', bchFn: 'f', args: o.args, evmCompat: true, expectedConst: o.expected, label: o.label,
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
  return abiCaseFrom({
    params: o.params, expr: `${fn}(${o.encodeArgs})`, expected, args: o.args,
    label: o.label ?? `${fn}(${o.encodeArgs})`,
  });
}

// Build an abi.encode(struct) case: define a struct with the given fields, construct it from params, and encode
// it. A struct's ABI encoding is its tuple encoding; a fixed-width (all-static) struct encodes inline (field words).
export function abiStructCase(o: {
  fields: readonly { type: string; name: string }[]; values: readonly unknown[]; label?: string;
}): ConformanceCase {
  const structDef = `struct P { ${o.fields.map((f) => `${f.type} ${f.name};`).join(' ')} }`;
  // dynamic field types (bytes/string/T[]) need an explicit `memory` on the Solidity function param
  const dyn = (t: string): boolean => t === 'bytes' || t === 'string' || t.endsWith('[]');
  const params = o.fields.map((f) => `${f.type}${dyn(f.type) ? ' memory' : ''} ${f.name}`).join(', ');
  const ctorArgs = o.fields.map((f) => f.name).join(', ');
  const tupleType = `tuple(${o.fields.map((f) => toEthers(f.type)).join(',')})`;
  const expected = ethersAbiEncode([tupleType], [o.values]);
  const solidity = `${SPDX}contract C {\n  ${structDef}\n`
    + `  function f(${params}) public pure returns (bytes memory) {\n`
    + `    P memory p = P(${ctorArgs});\n    return abi.encode(p);\n  }\n}\n`;
  const scash = `contract Conf() {\n  ${structDef}\n  function f(${params}) {\n`
    + `    P p = P(${ctorArgs});\n    require(abi.encode(p) == ${expected});\n  }\n}\n`;
  return {
    solidity, scash, evmFn: 'f', bchFn: 'f', args: o.values, evmCompat: true,
    expectedConst: expected, label: o.label ?? `abi.encode(${tupleType})`,
  };
}

// Build an abi.encode(struct, dynamicTail) case: a static-composite struct followed by a dynamic arg. Exercises
// the head-size generalization - the static struct occupies >32 bytes in the head, so the tail's offset must
// account for the struct's full size, not one word.
export function abiStructMixedCase(o: {
  fields: readonly { type: string; name: string }[]; values: readonly unknown[];
  tailType: string; tailName: string; tailValue: unknown; label?: string;
}): ConformanceCase {
  const structDef = `struct P { ${o.fields.map((f) => `${f.type} ${f.name};`).join(' ')} }`;
  // bytes/string need an explicit `memory` data location on the Solidity side; SolidCash tolerates it.
  const params = [...o.fields.map((f) => `${f.type} ${f.name}`), `${o.tailType} memory ${o.tailName}`].join(', ');
  const ctorArgs = o.fields.map((f) => f.name).join(', ');
  const tupleType = `tuple(${o.fields.map((f) => toEthers(f.type)).join(',')})`;
  const expected = ethersAbiEncode([tupleType, toEthers(o.tailType)], [o.values, o.tailValue]);
  const solidity = `${SPDX}contract C {\n  ${structDef}\n`
    + `  function f(${params}) public pure returns (bytes memory) {\n`
    + `    P memory p = P(${ctorArgs});\n    return abi.encode(p, ${o.tailName});\n  }\n}\n`;
  const scash = `contract Conf() {\n  ${structDef}\n  function f(${params}) {\n`
    + `    P p = P(${ctorArgs});\n    require(abi.encode(p, ${o.tailName}) == ${expected});\n  }\n}\n`;
  return {
    solidity, scash, evmFn: 'f', bchFn: 'f', args: [...o.values, o.tailValue], evmCompat: true,
    expectedConst: expected, label: o.label ?? `abi.encode(${tupleType}, ${toEthers(o.tailType)})`,
  };
}

// Dispatch an abi case to the right assertion: single-word cases run the identical bytes32-compare covenant on
// both VMs (assertBothAccept); larger/dynamic cases use the baked-constant cross-check (assertEncodeConformant).
export function assertAbi(c: ConformanceCase): Promise<void> {
  return c.bothAccept ? assertBothAccept(c) : assertEncodeConformant(c);
}

// Build an abi.encodeWithSignature case: the 4-byte selector is keccak256(signature)[:4] (evmCompat), followed
// by the standard ABI encoding of the args. `encodeArgs` references the params (empty for a no-arg signature).
export function sigCase(o: {
  signature: string; params: string; encodeArgs: string; args: readonly unknown[]; label?: string;
}): ConformanceCase {
  const types = paramTypes(o.params);
  const byName = argsByName(o.params, o.args);
  const names = o.encodeArgs.split(',').map((s) => s.trim()).filter(Boolean);
  const selector = ethersSelector(o.signature);
  const expected = selector + ethersAbiEncode(names.map((n) => types[n]), names.map((n) => byName[n])).slice(2);
  const argList = names.length ? `, ${o.encodeArgs}` : '';
  return abiCaseFrom({
    params: o.params, expr: `abi.encodeWithSignature("${o.signature}"${argList})`, expected, args: o.args,
    label: o.label ?? `encodeWithSignature(${o.signature})`,
  });
}

// Build an abi.encodeCall case: an interface method reference + a parenthesized arg tuple. The selector is
// keccak256(canonicalSig)[:4] (evmCompat), followed by the standard ABI encoding of the args. Both sides declare
// the interface so solc and solidc resolve the same method signature.
export function callCase(o: {
  ifaceName: string; ifaceDecl: string; method: string; canonicalSig: string;
  params: string; encodeArgs: string; args: readonly unknown[]; label?: string;
}): ConformanceCase {
  const types = paramTypes(o.params);
  const byName = argsByName(o.params, o.args);
  const names = o.encodeArgs.split(',').map((s) => s.trim()).filter(Boolean);
  const selector = ethersSelector(o.canonicalSig);
  const expected = selector + ethersAbiEncode(names.map((n) => types[n]), names.map((n) => byName[n])).slice(2);
  const iface = `interface ${o.ifaceName} { ${o.ifaceDecl} }`;
  const expr = `abi.encodeCall(${o.ifaceName}.${o.method}, (${o.encodeArgs}))`;
  return {
    solidity: `${SPDX}${iface}\ncontract C {\n  function f(${o.params}) public pure returns (bytes memory) {\n`
      + `    return ${expr};\n  }\n}\n`,
    scash: `${iface}\ncontract Conf() {\n  function f(${o.params}) {\n    require(${expr} == ${expected});\n  }\n}\n`,
    evmFn: 'f', bchFn: 'f', args: o.args, evmCompat: true, expectedConst: expected,
    label: o.label ?? `encodeCall(${o.canonicalSig})`,
  };
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
  return abiCaseFrom({
    params: o.params, expr: `abi.encodeWithSelector(${o.selectorAndArgs})`, expected, args: o.args,
    label: o.label ?? `encodeWithSelector(${o.selectorAndArgs})`,
  });
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

// abi.decode of a dynamic array, tested BCH-side: decode an ethers-encoded T[] blob on-chain and compare each
// element (and the length) to the inputs. Exercises emitEvmArrayDecode (offset/length + per-element word rebuild).
export function bchArrayDecodeCase(o: {
  elemType: string; values: readonly unknown[]; label?: string;
}): { scash: string; args: readonly unknown[]; label: string } {
  const blob = ethersAbiEncode([`${toEthers(o.elemType)}[]`], [o.values]);
  const expParams = o.values.map((_, i) => `${o.elemType} e${i}`).join(', ');
  const checks = o.values.map((_, i) => `require(x[${i}] == e${i});`).join('\n    ');
  const params = expParams.length > 0 ? `bytes blob, ${expParams}` : 'bytes blob';
  const scash = `contract Conf() {\n  function f(${params}) {\n`
    + `    ${o.elemType}[] x = abi.decode(blob, (${o.elemType}[]));\n`
    + `    require(x.length == ${o.values.length});\n    ${checks}\n  }\n}\n`;
  return { scash, args: [blob, ...o.values], label: o.label ?? `decode<${o.elemType}[]>` };
}

// abi.decode of a fixed-size array T[N]: decode an ethers T[N] blob (inline element words) and compare each
// element. Exercises the fixed-array decode route (emitEvmWordsToArray with no offset/length to strip).
export function bchFixedArrayDecodeCase(o: {
  elemType: string; size: number; values: readonly unknown[]; label?: string;
}): { scash: string; args: readonly unknown[]; label: string } {
  const blob = ethersAbiEncode([`${toEthers(o.elemType)}[${o.size}]`], [o.values]);
  const expParams = o.values.map((_, i) => `${o.elemType} e${i}`).join(', ');
  const checks = o.values.map((_, i) => `require(x[${i}] == e${i});`).join('\n    ');
  const scash = `contract Conf() {\n  function f(bytes blob, ${expParams}) {\n`
    + `    ${o.elemType}[${o.size}] x = abi.decode(blob, (${o.elemType}[${o.size}]));\n    ${checks}\n  }\n}\n`;
  return { scash, args: [blob, ...o.values], label: o.label ?? `decode<${o.elemType}[${o.size}]>` };
}

// abi.decode of a NESTED array T[][] (array of value-element arrays): decode an ethers T[][] blob and compare
// each inner element x[i][j] and length. Exercises the recursive emitEvmDecodeElement (inner value-array rebuild).
export function bchNestedArrayDecodeCase(o: {
  elemType: string; rows: readonly (readonly unknown[])[]; label?: string;
}): { scash: string; args: readonly unknown[]; label: string } {
  const t = toEthers(o.elemType);
  const blob = ethersAbiEncode([`${t}[][]`], [o.rows]);
  const params: string[] = ['bytes blob'];
  const checks: string[] = [`require(x.length == ${o.rows.length});`];
  const args: unknown[] = [blob];
  o.rows.forEach((row, i) => {
    checks.push(`require(x[${i}].length == ${row.length});`);
    row.forEach((v, j) => {
      params.push(`${o.elemType} e${i}_${j}`); checks.push(`require(x[${i}][${j}] == e${i}_${j});`); args.push(v);
    });
  });
  const scash = `contract Conf() {\n  function f(${params.join(', ')}) {\n`
    + `    ${o.elemType}[][] x = abi.decode(blob, (${o.elemType}[][]));\n    ${checks.join('\n    ')}\n  }\n}\n`;
  return { scash, args, label: o.label ?? `decode<${o.elemType}[][]>` };
}

// abi.decode of a fixed-width struct: decode an ethers tuple blob into a struct and compare each field.
// Exercises emitEvmStructDecode (tuple words -> pushdata fields).
export function bchStructDecodeCase(o: {
  fields: readonly { type: string; name: string }[]; values: readonly unknown[]; label?: string;
}): { scash: string; args: readonly unknown[]; label: string } {
  const structDef = `struct P { ${o.fields.map((f) => `${f.type} ${f.name};`).join(' ')} }`;
  const tupleType = `tuple(${o.fields.map((f) => toEthers(f.type)).join(',')})`;
  const blob = ethersAbiEncode([tupleType], [o.values]);
  const expParams = o.fields.map((_, i) => `e${i}`).map((n, i) => `${o.fields[i].type} ${n}`).join(', ');
  const checks = o.fields.map((f, i) => `require(p.${f.name} == e${i});`).join('\n    ');
  const scash = `contract Conf() {\n  ${structDef}\n  function f(bytes blob, ${expParams}) {\n`
    + `    P p = abi.decode(blob, (P));\n    ${checks}\n  }\n}\n`;
  return { scash, args: [blob, ...o.values], label: o.label ?? `decode<${tupleType}>` };
}

// abi.decode of TWO dynamic arrays (multi-param offset-following): decode an ethers (T[], T[]) blob and check
// both arrays' lengths + elements. Exercises the array branch in emitEvmAbiDecodeDynamic.
export function bch2ArrayDecodeCase(o: {
  type: string; a: readonly unknown[]; b: readonly unknown[]; label?: string;
}): { scash: string; args: readonly unknown[]; label: string } {
  const t = toEthers(o.type);
  const blob = ethersAbiEncode([`${t}[]`, `${t}[]`], [o.a, o.b]);
  const aParams = o.a.map((_, i) => `${o.type} a${i}`);
  const bParams = o.b.map((_, i) => `${o.type} b${i}`);
  const params = ['bytes blob', ...aParams, ...bParams].join(', ');
  const aChecks = o.a.map((_, i) => `require(x[${i}] == a${i});`).join('\n    ');
  const bChecks = o.b.map((_, i) => `require(y[${i}] == b${i});`).join('\n    ');
  const scash = `contract Conf() {\n  function f(${params}) {\n`
    + `    (${o.type}[] x, ${o.type}[] y) = abi.decode(blob, (${o.type}[], ${o.type}[]));\n`
    + `    require(x.length == ${o.a.length});\n    ${aChecks}\n`
    + `    require(y.length == ${o.b.length});\n    ${bChecks}\n  }\n}\n`;
  return { scash, args: [blob, ...o.a, ...o.b], label: o.label ?? `decode<${o.type}[], ${o.type}[]>` };
}

// abi.decode of a MIXED schema of scalars and arrays (e.g. (uint256, uint256[])). Each entry is a scalar
// (arr=false, one value) or an array (arr=true, its elements). Checks each decoded scalar / array length+elements.
export function bchDecodeSchemaCase(o: {
  entries: readonly { type: string; arr: boolean; values: readonly unknown[] }[]; label?: string;
}): { scash: string; args: readonly unknown[]; label: string } {
  const ethTypes = o.entries.map((e) => (e.arr ? `${toEthers(e.type)}[]` : toEthers(e.type)));
  const jsValues = o.entries.map((e) => (e.arr ? e.values : e.values[0]));
  const blob = ethersAbiEncode(ethTypes, jsValues);
  const decodeTypes = o.entries.map((e) => (e.arr ? `${e.type}[]` : e.type)).join(', ');
  const decls = o.entries.map((e, i) => `${e.arr ? `${e.type}[]` : e.type} x${i}`).join(', ');
  const params: string[] = ['bytes blob'];
  const checks: string[] = [];
  const args: unknown[] = [blob];
  o.entries.forEach((e, i) => {
    if (e.arr) {
      checks.push(`require(x${i}.length == ${e.values.length});`);
      e.values.forEach((_, j) => { params.push(`${e.type} e${i}_${j}`); checks.push(`require(x${i}[${j}] == e${i}_${j});`); });
      args.push(...e.values);
    } else {
      params.push(`${e.type} e${i}_0`);
      checks.push(`require(x${i} == e${i}_0);`);
      args.push(e.values[0]);
    }
  });
  const scash = `contract Conf() {\n  function f(${params.join(', ')}) {\n`
    + `    (${decls}) = abi.decode(blob, (${decodeTypes}));\n    ${checks.join('\n    ')}\n  }\n}\n`;
  return { scash, args, label: o.label ?? `decode<${decodeTypes}>` };
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
    const raw = toks.slice(0, -1).join('');
    const arr = raw.endsWith('[]');
    let base = arr ? raw.slice(0, -2) : raw;
    if (base === 'uint') base = 'uint256';
    if (base === 'int') base = 'int256';
    map[toks[toks.length - 1]] = arr ? `${base}[]` : base;
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
