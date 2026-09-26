/**
 * Which contract shapes a per-call master program can be emitted for.
 *
 * A master's head is one prefix that runs before the entry bodies. When the contract has a single entry point the
 * whole program is the head followed by that inlined body; with several, the head is followed by a selector
 * dispatcher that OP_DEFINEs each entry body with its four-byte selector and OP_INVOKEs the one the unlocking
 * bytecode's leading selector names.
 *
 * Everything else is refused with a named reason rather than compiled into a program that claims the per-call
 * convention while violating its frame rules.
 */

import {
  ArrayType,
  FixedType,
  FrameKind,
  FunctionType,
  IntType,
  MappingType,
  PrimitiveType,
  StructType,
  TokenContainerType,
  TupleType,
  ValueType,
  computeFunctionSelector,
  computeFunctionSignature,
  encodeIntegerValue,
} from '@solidcash/utils';
import type { Type } from '@solidcash/utils';
import { hexToBin } from '@bitauth/libauth';
import {
  BoolLiteralNode,
  ContractNode,
  DoWhileNode,
  EmitStatementNode,
  ExpressionNode,
  ExternalCallMode,
  ExternalCallSlot,
  FunctionDefinitionNode,
  HexLiteralNode,
  InterfaceNode,
  IntLiteralNode,
  StringLiteralNode,
  WhileNode,
} from '../../ast/AST.js';
import { walkInvocationAst } from '../../analysis/InvocationAnalysis.js';
import type { MasterCallSite, MasterTailShape, SiteArgument } from './frame-tail.js';

/**
 * Synthetic parameters that carry the direct path's transaction-level sender category.
 *
 * A per-call master takes `msg.sender` from its witness block instead, so these parameters are not part of its
 * frame and must not be expected on the stack (nor offered to the SDK as inputs).
 */
const FRAME_PARAMETERS = new Set(['__internal__msgSenderCategory', '__internal__msgSenderAnchorIdx']);

/**
 * Synthetic parameters the direct path reads a call's co-spent input through.
 *
 * A master checks a call against the witness block's call records instead of a co-spent input, so these operands
 * are not part of its frame and are not read by its body.
 */
const EXTERNAL_CALL_PARAMETERS = new Set([
  '__internal__externalCallInputBase',
  '__internal__externalReturnOutputIdx',
]);

/** Removes the frame parameters a master does not take, from every function and so from the published ABI. */
export function stripFrameParameters(contract: ContractNode): void {
  const functions = [
    contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions,
  ];
  for (const fn of functions) {
    if (!fn) continue;
    fn.parameters = fn.parameters.filter((parameter) =>
      !FRAME_PARAMETERS.has(parameter.name) && !isExternalCallParameter(parameter.name));
  }
}

/** True for a call-index operand the master does not take: the base, a fixed anchor, or a per-slot master index. */
function isExternalCallParameter(name: string): boolean {
  return EXTERNAL_CALL_PARAMETERS.has(name)
    || /^__internal__extcallAnchorIdx\d+$/.test(name)
    || /^__internal__extcallMasterIdx\d+$/.test(name)
    || /^__internal__loopTargets\d+$/.test(name);
}

export interface PerCallMasterShapeInput {
  readonly contract: ContractNode;
  /** Interface definitions in the compiled unit, for resolving the selector a call site names. */
  readonly interfaces: readonly InterfaceNode[];
  /** File-level (free/library) functions in the compiled unit; a head must be the first thing emitted. */
  readonly freeFunctionCount: number;
  readonly importCount: number;
  readonly hasContractInstantiation: boolean;
  readonly hasFunctionPointers: boolean;
  readonly needsInlineAssembly: boolean;
  readonly emitsEvent: boolean;
}

export interface PerCallMasterShapeAssessment {
  readonly supported: boolean;
  /** Why the shape is refused, phrased as a fact about the contract. */
  readonly reason?: string;
  /** The calls every entry makes, in execution order, which the master head checks. */
  readonly calls?: readonly MasterCallSite[];
  /** The event and send counts every entry fixes, which the master head checks. */
  readonly tail?: MasterTailShape;
}

/** Assesses whether the contract can be emitted as a per-call master program. */
export function assessPerCallMasterShape(input: PerCallMasterShapeInput): PerCallMasterShapeAssessment {
  const { contract } = input;
  const refuse = (reason: string): PerCallMasterShapeAssessment => ({ supported: false, reason });
  if (input.freeFunctionCount > 0) {
    return refuse('a per-call master is one program, so free functions that would be emitted before it are not supported');
  }
  if (input.importCount > 0) {
    return refuse('imported definitions are emitted before the master head, so imports are not supported');
  }
  if (contract.constructorDef) {
    return refuse('a constructor body makes the contract dispatch by selector, which the master head cannot precede');
  }
  if (contract.fallbackDef || contract.receiveDef) {
    return refuse('fallback and receive make the contract dispatch by selector, which the master head cannot precede');
  }
  const entryPoints = contract.functions.filter((fn) => fn.isEntryPoint);
  if (entryPoints.length === 0) {
    return refuse('a master is reached by dispatching a selector, so a contract with no entry point is not supported');
  }
  if (entryPoints.some((entry) => (entry.lowLevelCalls?.length ?? 0) > 0)) {
    return refuse('a low-level call needs the witness `calls[]` checks, which are not emitted yet');
  }
  if (input.hasContractInstantiation) {
    return refuse('contract creation needs the witness `CREATE` checks, which are not emitted yet');
  }
  if (input.hasFunctionPointers) {
    return refuse('a function pointer needs a call kind the frame does not carry yet');
  }
  if (input.needsInlineAssembly) {
    return refuse('inline assembly is not composed per-call');
  }
  for (const entry of entryPoints) {
    if (entry.returnTypes.length > 0) {
      return refuse(`the entry point '${entry.name}' returns a value, which is settled against the witness `
        + '`retval` field, which the master head reads but does not compare a computed value with yet');
    }
    // A hidden parameter is an operand the direct path expects from the SDK or from a co-spent input. The head
    // supplies the frame values itself, so any other hidden operand would be read from the wrong stack position.
    const hidden = entry.parameters.filter((parameter) =>
      parameter.name.startsWith('__internal__')
      && !FRAME_PARAMETERS.has(parameter.name)
      && !isExternalCallParameter(parameter.name));
    if (hidden.length > 0) {
      return refuse(`the entry point '${entry.name}' carries the hidden parameter '${hidden[0].name}', `
        + 'which the master head does not supply');
    }
    if (entry.usesBlockhash || contract.usesBlockhash) {
      return refuse('a blockhash read needs a co-spent oracle input the master head does not locate');
    }
    if (entry.keccakCompute || entry.ecrecoverCompute) {
      return refuse('a compute side-car needs co-spent inputs the master head does not locate');
    }
  }
  const calls = derivePerCallMasterCallSites(input.interfaces, entryPoints);
  if (!calls.supported) return refuse(calls.reason);
  const tail = derivePerCallTailShape(entryPoints, input.emitsEvent);
  if (tail.reason !== undefined) return refuse(tail.reason);
  return { supported: true, calls: calls.calls, tail: tail.tail };
}

/** The event and send counts a master's tail carries, or why a compiled entry cannot fix them. */
export interface PerCallTailDerivation {
  readonly tail?: MasterTailShape;
  readonly reason?: string;
}

/**
 * Derives the event and send counts a master's tail has to declare, from the entries the master runs.
 *
 * A master has one head that checks one tail, so every entry must emit the same number of events; an entry that
 * emits from a loop leaves the count to the loop, which the head cannot fix. A value send is a listed send only
 * when its recipient is a user address and a call when it is a contract, and the recipient's lock type is a
 * run-time value, so the send list is not fixed by the source and a transfer is refused rather than guessed.
 * Segments are not fixed here: the records a segment touches are decided by settlement, so the head walks each
 * segment's declared count.
 */
export function derivePerCallTailShape(
  entryPoints: readonly FunctionDefinitionNode[],
  emitsEvent: boolean,
): PerCallTailDerivation {
  let eventCount = 0;
  for (const [index, entry] of entryPoints.entries()) {
    if ((entry.runtimeLoopEvents?.length ?? 0) > 0 || emitsFromLoop(entry)) {
      return { reason: 'an event emitted from a loop makes the event count depend on the loop, so the master '
        + 'cannot fix how many events the tail holds' };
    }
    const entryEventCount = entry.emitInfos?.length ?? 0;
    if (index === 0) eventCount = entryEventCount;
    else if (entryEventCount !== eventCount) {
      return { reason: 'the entries emit different numbers of events, but a master has one head that checks one '
        + 'event list' };
    }
  }
  if (emitsEvent && eventCount === 0) {
    return { reason: 'the contract emits an event that is not attributed to an entry, so the master cannot fix '
      + 'how many events the tail holds' };
  }
  for (const entry of entryPoints) {
    if ((entry.transferInfos?.length ?? 0) > 0 || (entry.runtimeLoopTransfers?.length ?? 0) > 0) {
      return { reason: 'a value send is a listed send only when its recipient is a user address and a call when '
        + 'it is a contract, and the recipient lock is a run-time value, so the master cannot fix how many sends '
        + 'the tail holds' };
    }
  }
  return { tail: { eventCount, sendCount: 0 } };
}

/**
 * True when the entry reaches an emit statement inside a loop, so the number of events it emits depends on the
 * loop's trip count. A source loop is a `while` or `do`/`while` node after parsing, and a lowering that turns one
 * into a counted trailing stream records it in `runtimeLoopEvents` instead.
 */
function emitsFromLoop(entry: FunctionDefinitionNode): boolean {
  let found = false;
  walkInvocationAst(entry.body, (node) => {
    const isLoop = node instanceof WhileNode || node instanceof DoWhileNode;
    if (found || !isLoop) return;
    walkInvocationAst(node, (inner) => {
      if (inner instanceof EmitStatementNode && inner.runtimeLoopEvent === undefined) found = true;
    });
  });
  return found;
}

/** The call sites every entry makes, or why the head cannot check them. */
type CallSitesDerivation =
  | { readonly supported: true; readonly calls: readonly MasterCallSite[] }
  | { readonly supported: false; readonly calls: readonly MasterCallSite[]; readonly reason: string };

/**
 * Derives the call sites every entry of the contract makes, which the master head has to check.
 *
 * The head is one prefix, so it checks the same calls[] records whichever entry runs: every entry must make the
 * same calls, and only calls whose shape the head's checks describe are admitted — a call to a compile-time
 * address whose result is unused, with compile-time argument values the caller's own code can hash. Anything else
 * is refused by name, because the head would have to check a shape it cannot describe.
 */
function derivePerCallMasterCallSites(
  interfaces: readonly InterfaceNode[],
  entryPoints: readonly FunctionDefinitionNode[],
): CallSitesDerivation {
  const perEntry: MasterCallSite[][] = [];
  for (const entry of entryPoints) {
    const derived = deriveEntryCallSites(interfaces, entry);
    if (derived.reason !== undefined) return { supported: false, calls: [], reason: derived.reason };
    perEntry.push(derived.calls);
  }
  const first = perEntry[0] ?? [];
  if (perEntry.some((calls) => !sameCallSites(calls, first))) {
    return {
      supported: false,
      calls: [],
      reason: 'the entries make different external calls, but a master has one head that checks one calls[] set',
    };
  }
  return { supported: true, calls: first };
}

/** The call sites one entry makes, or why the head cannot check them. */
function deriveEntryCallSites(
  interfaces: readonly InterfaceNode[],
  entry: FunctionDefinitionNode,
): { calls: MasterCallSite[]; reason?: string } {
  const calls: MasterCallSite[] = [];
  for (const slot of entry.externalCalls ?? []) {
    if (slot.callMode !== undefined && slot.callMode !== ExternalCallMode.REGULAR) {
      // A read-only call would make the callee run a static frame, and the emitted kind branch has no arm for one,
      // so the callee would refuse it at run time. Refusing here says which shape is missing.
      return { calls: [], reason: `the call to '${slot.functionName}' is a ${String(slot.callMode)}, and a callee `
        + 'cannot yet run a static frame' };
    }
    if (slot.addressLiteral === undefined) {
      return { calls: [], reason: `the call to '${slot.functionName}' targets an address only known at run time, `
        + 'which the master head cannot check against the witness record yet' };
    }
    if (slot.condition !== undefined || slot.loopArrayVar !== undefined || slot.loopIndexExpression !== undefined
      || slot.inlineLoopDispatch === true || slot.runtimeSelector !== undefined || slot.fnPtrCall === true
      || slot.opaqueReturn === true || slot.callValueEffect === true
      || (slot.requiredDataNftIndices?.length ?? 0) > 0 || (slot.batchInvocations?.length ?? 0) > 1) {
      return { calls: [], reason: `the call to '${slot.functionName}' runs conditionally, repeatedly or through a `
        + 'runtime target, so its call records are not a fixed set the head can check' };
    }
    const selector = slot.compileTimeSelector
      ?? resolveInterfaceSelector(interfaces, slot.interfaceName, slot.functionName);
    if (selector === undefined) {
      return { calls: [], reason: `the call to '${slot.interfaceName}.${slot.functionName}' has no four-byte `
        + 'selector the master head can check' };
    }
    const args = encodeSiteArguments(slot, interfaces);
    if ('reason' in args) return { calls: [], reason: args.reason };
    calls.push({
      kind: FrameKind.CALL,
      selector,
      target: hexToBin(slot.addressLiteral),
      interfaceName: slot.interfaceName,
      functionName: slot.functionName,
      arguments: args.arguments,
    });
  }
  return { calls };
}

/**
 * The call's arguments as the site can account for them, or why the head cannot bind the record to the caller's
 * own computation.
 *
 * The site computes `SHA256(selector || argument pushes)` from these. A compile-time value has its bytes at
 * compile time, so they are folded in as a constant. A run-time value is one only the running code holds, and the
 * site turns the value on the stack into the push the wire carries, which needs a scalar the code holds as one
 * item; a value with a composite encoding is refused rather than guessed.
 */
function encodeSiteArguments(
  slot: ExternalCallSlot,
  interfaces: readonly InterfaceNode[],
): { arguments: SiteArgument[] } | { reason: string } {
  const parameters = slot.sourceCallNode?.parameters ?? [];
  if (parameters.length === 0 && (slot.argSources?.length ?? 0) > 0) {
    return { reason: `the call to '${slot.functionName}' passes arguments the compiler cannot recover, so the `
      + 'caller cannot compute the digest its record must carry' };
  }
  const declared = declaredParameterTypes(slot, interfaces);
  const siteArguments: SiteArgument[] = [];
  for (const [index, parameter] of parameters.entries()) {
    const value = compileTimeArgumentValue(parameter);
    if (value !== undefined) {
      siteArguments.push({ kind: 'constant', bytes: value });
      continue;
    }
    const type = declared[index];
    if (type === undefined || !isScalarArgumentType(type)) {
      return { reason: `the call to '${slot.functionName}' passes a run-time argument whose value the compiler `
        + 'cannot encode into one push, so the caller cannot compute the digest its record must carry' };
    }
    siteArguments.push({ kind: 'runtime', numeric: holdsAsNumber(type) });
  }
  return { arguments: siteArguments };
}

/** The declared types of the interface method the slot calls, in parameter order. */
function declaredParameterTypes(
  slot: ExternalCallSlot,
  interfaces: readonly InterfaceNode[],
): readonly Type[] {
  const iface = interfaces.find((candidate) => candidate.name === slot.interfaceName);
  const fn = iface?.functions.find((candidate) => candidate.name === slot.functionName);
  return (fn?.parameters ?? []).map((parameter) => parameter.type);
}

/**
 * True when a run-time value of `type` reaches the code as one stack item the site can encode.
 *
 * A struct, an array, a mapping, a tuple, a function pointer and a token container are several items or a
 * composite encoding, which this site does not build.
 */
function isScalarArgumentType(type: Type): boolean {
  const resolved = type instanceof ValueType ? type.underlyingType : type;
  if (resolved instanceof ArrayType || resolved instanceof StructType || resolved instanceof MappingType) {
    return false;
  }
  if (resolved instanceof TupleType || resolved instanceof FunctionType) return false;
  if (resolved instanceof TokenContainerType) return false;
  return true;
}

/** True when the VM holds a value of `type` as a number, whose minimal encoding is the canonical one. */
function holdsAsNumber(type: Type): boolean {
  const resolved = type instanceof ValueType ? type.underlyingType : type;
  return resolved === PrimitiveType.BOOL || resolved instanceof IntType || resolved instanceof FixedType;
}

/**
 * The canonical byte value of a compile-time argument expression, or undefined when it is a runtime value.
 *
 * The encodings match what the callee receives: an integer or boolean is its minimal script number, and a string
 * or byte string is its raw bytes. Anything else is a value only the running code knows.
 */
function compileTimeArgumentValue(expression: ExpressionNode): Uint8Array | undefined {
  if (expression instanceof IntLiteralNode) return encodeIntegerValue(expression.value);
  if (expression instanceof BoolLiteralNode) return encodeIntegerValue(expression.value ? 1n : 0n);
  if (expression instanceof StringLiteralNode) {
    return expression.solidityBytes ?? new TextEncoder().encode(expression.value);
  }
  if (expression instanceof HexLiteralNode) return expression.value;
  return undefined;
}

/** The selector an interface method dispatches to, from its name and declared parameter types. */
function resolveInterfaceSelector(
  interfaces: readonly InterfaceNode[],
  interfaceName: string,
  functionName: string,
): Uint8Array | undefined {
  const iface = interfaces.find((candidate) => candidate.name === interfaceName);
  const fn = iface?.functions.find((candidate) => candidate.name === functionName);
  if (!fn) return undefined;
  return computeFunctionSelector(
    computeFunctionSignature(functionName, fn.parameters.map((parameter) => parameter.type.toString())),
  );
}

/** True when two call-site lists describe the same calls, which is what lets one head check them all. */
function sameCallSites(left: readonly MasterCallSite[], right: readonly MasterCallSite[]): boolean {
  return left.length === right.length && left.every((site, index) => {
    const other = right[index];
    return other !== undefined
      && site.kind === other.kind
      && bytesEqual(site.selector, other.selector)
      && bytesEqual(site.target, other.target)
      && sameSiteArguments(site.arguments ?? [], other.arguments ?? []);
  });
}

/** True when two argument lists ask for the same pushes: the same constant bytes, or the same run-time form. */
function sameSiteArguments(left: readonly SiteArgument[], right: readonly SiteArgument[]): boolean {
  return left.length === right.length && left.every((argument, index) => {
    const other = right[index];
    if (other === undefined || argument.kind !== other.kind) return false;
    if (argument.kind === 'constant') {
      return other.kind === 'constant' && bytesEqual(argument.bytes, other.bytes);
    }
    return other.kind === 'runtime' && argument.numeric === other.numeric;
  });
}

/** Byte-wise equality, small enough not to pull in a dependency for it. */
function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}
