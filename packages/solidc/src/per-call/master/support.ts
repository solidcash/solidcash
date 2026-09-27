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
  AssignNode,
  BinaryOpNode,
  BoolLiteralNode,
  CastNode,
  ContractNode,
  DoWhileNode,
  EmitStatementNode,
  ExpressionNode,
  ExternalCallMode,
  ExternalCallSlot,
  FunctionCallNode,
  FunctionDefinitionNode,
  HexLiteralNode,
  IdentifierNode,
  InterfaceNode,
  IntLiteralNode,
  LiteralNode,
  MappingAssignNode,
  NullaryOpNode,
  StateAccessNode,
  StringLiteralNode,
  UnaryOpNode,
  VariableDefinitionNode,
  WhileNode,
} from '../../ast/AST.js';
import { NullaryOperator } from '../../ast/Operator.js';
import { walkInvocationAst } from '../../analysis/InvocationAnalysis.js';
import type { MasterCallSite, MasterTailShape, SiteArgument } from './frame-tail.js';
import { BATCH_DERIVATION_SLOT_ORDER, batchDerivationSlotName } from './batch-witness-derivation.js';

/**
 * Synthetic parameters that carry the direct path's transaction-level sender category.
 *
 * A per-call master takes `msg.sender` from its witness block instead, so these parameters are not part of its
 * frame and must not be expected on the stack (nor offered to the SDK as inputs).
 */
const FRAME_PARAMETERS = new Set(['__internal__msgSenderCategory', '__internal__msgSenderAnchorIdx']);

/**
 * The direct path's return-event output index.
 *
 * A per-call master settles the value its entry computed against the witness `retval` field, not against a
 * return-event output, so this operand is not part of its frame and must not be expected on the stack.
 */
const RETURN_EVENT_PARAMETERS = new Set(['__internal__returnOutputIdx']);

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
  const constants = contractConstantNames(contract);
  const functions = [
    contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions,
  ];
  for (const fn of functions) {
    if (!fn) continue;
    // The sorted-batch operands and a dynamic value's chunk-run coordinate are derived from the master's own frame,
    // so they are not supplied as arguments any more than the frame values are; publishing them would ask a caller
    // for values it cannot know.
    const derived = derivableBatchWitnessNames(fn, constants);
    const derivedDynamic = derivableDynamicChunkNames(fn);
    fn.parameters = fn.parameters.filter((parameter) =>
      !(derived?.has(parameter.name) ?? false) && !(derivedDynamic?.has(parameter.name) ?? false)
      && !FRAME_PARAMETERS.has(parameter.name) && !RETURN_EVENT_PARAMETERS.has(parameter.name)
      && !isExternalCallParameter(parameter.name));
    // A multi-target batch is classified as a dense linear row batch for the direct convention. The per-call master
    // derives the operands itself and settles the batch through the general per-target arm, which reads no rank or
    // row, so a derivable batch is reclassified here before the body is emitted.
    if (derived !== undefined) {
      for (const batch of fn.sortedBatchInfo ?? []) {
        if (batch.slotIndices.length > 1 && batch.linear === true) batch.linear = undefined;
      }
    }
  }
}

/** True for an operand the master does not take: a call index, an anchor, a per-slot master index or a selector. */
function isExternalCallParameter(name: string): boolean {
  return EXTERNAL_CALL_PARAMETERS.has(name)
    || /^__internal__extcallAnchorIdx\d+$/.test(name)
    || /^__internal__extcallMasterIdx\d+$/.test(name)
    || /^__internal__loopTargets\d+$/.test(name)
    // The direct path checks the co-spent callee's selector through this operand. A site checks its record's
    // selector against the compile-time value it folds, so a composed body neither supplies nor reads it.
    || /^__internal__externalCallSelector\d*$/.test(name);
}

/** The batch a body's own frame can settle, and the operands the master derives for it. */
interface DerivableTargetBatch {
  /** The batch's target slots, in the order the writes were planned. */
  readonly slots: readonly number[];
  /** The collection the batch writes, whose linear row witness the reclassified verification drops. */
  readonly collection: string;
  /** Whether the batch was classified as a dense linear row batch, whose rank/row operands the master does not take. */
  readonly wasLinear: boolean;
}

/** The frame slot a `msg.sender` key reads: the caller's locking bytecode, which the head leaves tracked. */
export const SENDER_FRAME_SLOT = '__internal__frameSender';
/** The frame slot a `tx.origin` key reads: the origin reference's lock, which the head computes for every frame. */
export const ORIGIN_FRAME_SLOT = '__internal__frameOrigin';

/**
 * How a derivable target's key is held where the master derives the target slot.
 *
 * One of the three fields is set. A parameter the body holds and a frame value the head left are already on the
 * stack at their own depths. A compile-time expression is a value the body only computes at its start, so the
 * master emits it there and hashes it, which is why the shape admits nothing that reads a local computed later.
 */
export interface PerCallBatchKey {
  /** A parameter the body holds, read at its own stack depth. */
  readonly paramName?: string;
  /** A tracked frame value the head left: the frame's sender for `msg.sender`, the origin for `tx.origin`. */
  readonly frameSlot?: string;
  /** A compile-time expression the body holds at its start, which the master emits for the derivation. */
  readonly expression?: ExpressionNode;
}

/** The contract-level and inherited constant names a key expression may read at compile time. */
function contractConstantNames(contract: ContractNode): ReadonlySet<string> {
  return new Set(contract.constantDefinitions.map((definition) => definition.name));
}

/** A target key the master can hold where it derives the slot, or the fact that stops it from holding one. */
type BatchKeyResolution =
  | { readonly kind: 'key'; readonly key: PerCallBatchKey }
  | { readonly kind: 'refusal'; readonly reason: string };

/**
 * The key a body's one write to `slot` reads, or why the master cannot hold it where it derives the slot.
 *
 * A bare parameter is the body's own argument, and `msg.sender`/`tx.origin` are frame values the head leaves
 * tracked, so both are already on the stack. Any other key is derivable only when the body's own write carries an
 * expression whose every operand is a literal or a compile-time constant: such a value exists at the top of the
 * body, where the derivation runs, whereas a value the body computes later does not.
 */
function resolveBatchKey(
  entry: FunctionDefinitionNode,
  slot: number,
  constants: ReadonlySet<string>,
): BatchKeyResolution {
  const access = (entry.entryAccesses ?? []).find((candidate) => candidate.slotIndex === slot);
  const source = access?.keySources?.[0];
  if (source === undefined) {
    return { kind: 'refusal', reason: `the body writes a mapping at slot ${slot} with no key source to read` };
  }
  if (source.kind === 'msgSender') {
    // The head leaves the caller's lock as the frame `sender` — the user's lock for a root frame, and the value a
    // validator binds for a callee's — and the origin reference's lock as `origin`. Those are exactly the values
    // the direct path's `msg.sender` and `tx.origin` reads resolve to.
    return {
      kind: 'key',
      key: { frameSlot: source.senderOp === 'tx.origin' ? ORIGIN_FRAME_SLOT : SENDER_FRAME_SLOT },
    };
  }
  if (source.kind === 'param') {
    if (source.paramName === undefined
      || !entry.parameters.some((parameter) => parameter.name === source.paramName)) {
      return {
        kind: 'refusal',
        reason: `the body writes a mapping at slot ${slot} whose key names the parameter `
          + `'${source.paramName ?? 'unnamed'}' it does not declare`,
      };
    }
    return { kind: 'key', key: { paramName: source.paramName } };
  }
  const keyNode = mappingWriteKey(entry, slot);
  if (keyNode === undefined) {
    return {
      kind: 'refusal',
      reason: `the body writes a mapping at slot ${slot} whose key '${source.canonical}' has no expression to read`,
    };
  }
  const identifier = keyNode instanceof IdentifierNode ? keyNode : undefined;
  const expression = identifier === undefined
    ? keyNode : resolveKeyIdentifier(identifier.name, entry, new Set());
  if (expression === undefined) {
    return {
      kind: 'refusal',
      reason: `the body writes a mapping at slot ${slot} whose key '${source.canonical}' is the local `
        + `'${identifier?.name ?? '?'}', which is not bound to a single compile-time value`,
    };
  }
  const unavailable = keyOperandUnavailable(expression, constants);
  if (unavailable !== undefined) {
    return {
      kind: 'refusal',
      reason: `the body writes a mapping at slot ${slot} whose key '${source.canonical}' reads ${unavailable}, and `
        + 'a master derives a target slot only from a bare parameter, the frame\'s sender, or a compile-time value '
        + 'the body holds at its start',
    };
  }
  return { kind: 'key', key: { expression } };
}

/**
 * The key expression of the body's own write to `slot`, or undefined when no such write is reachable in the AST.
 *
 * A single-key write carries one key; the entry access it belongs to is the same physical slot the batch named, so
 * its expression is the value the direct path would hash for that slot.
 */
function mappingWriteKey(entry: FunctionDefinitionNode, slot: number): ExpressionNode | undefined {
  let key: ExpressionNode | undefined;
  walkInvocationAst(entry.body, (node) => {
    if (key !== undefined) return;
    if (node instanceof MappingAssignNode && node.entrySlotIndex === slot && node.keys.length === 1) {
      key = node.keys[0];
    }
  });
  return key;
}

/**
 * The expression a key identifier stands for, following the one local declaration that binds it, or undefined when
 * no such declaration exists.
 *
 * Lowering rewrites a source key to a synthetic local in one documented place: an inlined call with a storage
 * pointer copies its value arguments into `__spN_<name>` locals before the substituted write, so the write's own
 * key is a read of that copy. Following the declaration recovers the argument the copy was made from, which the
 * master can emit at the top of the body when it is itself compile-time. A name bound more than once, or one bound
 * to a value the walk cannot follow to a single expression, is left unresolved so the caller refuses it.
 */
function resolveKeyIdentifier(
  name: string,
  entry: FunctionDefinitionNode,
  seen: Set<string>,
): ExpressionNode | undefined {
  if (seen.has(name)) return undefined;
  seen.add(name);
  let definition: ExpressionNode | undefined;
  let reassigned = false;
  walkInvocationAst(entry.body, (node) => {
    if (node instanceof VariableDefinitionNode && node.name === name && node.expression !== undefined) {
      definition = definition ?? node.expression;
    }
    if (node instanceof AssignNode && node.identifier.name === name) reassigned = true;
  });
  if (definition === undefined || reassigned) return undefined;
  return definition instanceof IdentifierNode
    ? resolveKeyIdentifier(definition.name, entry, seen)
    : definition;
}

/**
 * The operand of a key expression that is not one the shape admits, or undefined when the expression is one.
 *
 * A literal and a compile-time constant exist at compile time. A cast, a unary operator and a binary operator are
 * pure, so they are admitted exactly when their operands are. A `msg.sender`/`tx.origin` read is a frame value the
 * head left. Every other node — a local, a state read, a call — is a value the shape does not derive from, and the
 * returned phrase names it so the refusal says which operand stopped it.
 */
function keyOperandUnavailable(node: ExpressionNode, constants: ReadonlySet<string>): string | undefined {
  if (node instanceof LiteralNode) return undefined;
  if (node instanceof CastNode) return keyOperandUnavailable(node.expression, constants);
  if (node instanceof UnaryOpNode) return keyOperandUnavailable(node.expression, constants);
  if (node instanceof BinaryOpNode) {
    return keyOperandUnavailable(node.left, constants) ?? keyOperandUnavailable(node.right, constants);
  }
  if (node instanceof NullaryOpNode) {
    return node.operator === NullaryOperator.MSG_SENDER || node.operator === NullaryOperator.TX_ORIGIN
      ? undefined
      : `the ${node.operator} value`;
  }
  if (node instanceof IdentifierNode) {
    return constants.has(node.name) ? undefined : `the value '${node.name}'`;
  }
  if (node instanceof StateAccessNode) return `the state value '${node.name}'`;
  if (node instanceof FunctionCallNode) return `the value computed by '${node.identifier.name}'`;
  return `an ${node.constructor.name}`;
}

/**
 * The batch a body can settle from its own frame, or undefined for a shape the derivation does not cover.
 *
 * One collection is written, every one of its entry accesses is the same lone unconditional write to a distinct
 * target, each target's key is one value the body holds where the derivation runs (a bare parameter, the frame's
 * sender, or a compile-time expression), and no target aliases another at run time. Under those conditions the
 * segment declares one record group per target in write order, so the master can read the group back and derive
 * each target's operands.
 */
function derivableTargetBatch(
  entry: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
): DerivableTargetBatch | undefined {
  const batches = entry.sortedBatchInfo ?? [];
  if (batches.length !== 1) return undefined;
  const batch = batches[0]!;
  const accesses = entry.entryAccesses ?? [];
  if (accesses.length !== batch.slotIndices.length) return undefined;
  for (const slot of batch.slotIndices) {
    const access = accesses.find((candidate) => candidate.slotIndex === slot);
    if (access === undefined) return undefined;
    if (access.operations.length !== 1 || access.operations[0] !== 'write') return undefined;
    if (access.inLoop === true || access.aliasCondDeleteSlot !== undefined
      || (access.runtimeAliasPriorSlots?.length ?? 0) > 0) return undefined;
    if (access.keyParams.length !== 1) return undefined;
    if (resolveBatchKey(entry, slot, constants).kind !== 'key') return undefined;
  }
  return { slots: [...batch.slotIndices], collection: batch.collection, wasLinear: batch.linear === true };
}

/**
 * The key one derivable target reads, or undefined for a target the admission leaves refused.
 *
 * The emission uses the same resolution the admission does, so the value it emits and the emittability decision
 * cannot drift apart.
 */
export function perCallBatchKey(
  entry: FunctionDefinitionNode,
  slot: number,
  constants: ReadonlySet<string>,
): PerCallBatchKey | undefined {
  const resolved = resolveBatchKey(entry, slot, constants);
  return resolved.kind === 'key' ? resolved.key : undefined;
}

/**
 * The sorted-batch operands a per-call master derives from its own frame, or undefined for a shape it cannot.
 *
 * The derivation reads the master's witness block back and leaves, per target, the four operands the sorted-batch
 * verification consumes and, once, the trailing count. It covers one collection whose every entry is one
 * unconditional write to a distinct target whose key the body holds where the derivation runs, in place or spliced
 * in: the target's record group is then the group the segment declares for it, so the frame fixes which transition
 * ran. A dense linear batch's own rank and row operands are not part of that derivation, so the master drops them
 * and settles the batch through the general arm instead. Anything wider is left refused rather than derived
 * approximately.
 */
export function derivableBatchWitnessNames(
  entry: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
): Set<string> | undefined {
  const batch = derivableTargetBatch(entry, constants);
  if (batch === undefined) return undefined;
  const names = new Set<string>();
  for (const slot of batch.slots) {
    for (const kind of BATCH_DERIVATION_SLOT_ORDER) {
      if (kind === 'Trailing') continue;
      names.add(batchDerivationSlotName(kind, slot));
    }
    if (batch.wasLinear) names.add(`__internal__vmapBatchRank_${slot}`);
  }
  if (batch.wasLinear) names.add(`__internal__vmapBatchRows_${batch.collection}`);
  names.add(batchDerivationSlotName('Trailing', 0));
  return names;
}

/**
 * Why a body's sorted-batch writes cannot be settled from its own frame, or undefined when they can.
 *
 * A body that writes a mapping carries the direct convention's batch operands. A per-call master derives those
 * from the records its own frame declares, which it can do for one collection whose every entry is one
 * unconditional write to a distinct target whose key the body holds where the derivation runs. Anything wider —
 * several collections, a batched or aliased write, a key the body computes rather than holds — makes the record a
 * segment declares, or the transition it proves, a fact the frame does not fix. Each refusal names the access and
 * the fact that stops it.
 */
function unsupportedBatchWriteShape(
  entry: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
): string | undefined {
  const batches = entry.sortedBatchInfo ?? [];
  if (batches.length === 0) return undefined;
  if (derivableBatchWitnessNames(entry, constants) !== undefined) return undefined;
  if (batches.length !== 1) {
    return `the body writes ${batches.length} mapping collections in one execution, and a master derives the `
      + 'sorted-batch operands one collection at a time';
  }
  const batch = batches[0]!;
  const accesses = entry.entryAccesses ?? [];
  for (const slot of batch.slotIndices) {
    const access = accesses.find((candidate) => candidate.slotIndex === slot);
    if (access === undefined) return `the body writes a mapping at slot ${slot} with no entry access to read`;
    if (access.operations.length !== 1 || access.operations[0] !== 'write') {
      return `the body writes a mapping at slot ${slot} as a ${access.operations.join('/')}, and a master derives `
        + 'the sorted-batch operands only for one unconditional write per target';
    }
    if (access.inLoop === true) {
      return `the body writes a mapping at slot ${slot} in a loop, so the records it declares are not a fixed set`;
    }
    if (access.aliasCondDeleteSlot !== undefined || (access.runtimeAliasPriorSlots?.length ?? 0) > 0) {
      return `the body writes a mapping at slot ${slot} that can alias another target at run time, so its record `
        + 'is not fixed';
    }
    if (access.keyParams.length !== 1) {
      return `the body writes a mapping at slot ${slot} keyed by ${access.keyParams.length} values, and a master `
        + 'derives a target slot only for a single-key write';
    }
    const resolved = resolveBatchKey(entry, slot, constants);
    if (resolved.kind === 'refusal') return resolved.reason;
  }
  if (accesses.length !== batch.slotIndices.length) {
    return `the body touches ${accesses.length} mapping entries and writes ${batch.slotIndices.length} of them, `
      + 'and a master derives the operands only when every entry is one of the batch targets';
  }
  return 'the body writes a mapping in a shape whose record the master cannot read back from its own frame: its '
    + 'segment would not fix which transition ran';
}

/** True for a hidden operand that is neither a frame value nor a sorted-batch operand the master derives. */
function isUndeclaredHiddenParameter(
  entry: FunctionDefinitionNode,
  name: string,
  constants: ReadonlySet<string>,
): boolean {
  return name.startsWith('__internal__')
    && !FRAME_PARAMETERS.has(name)
    && !RETURN_EVENT_PARAMETERS.has(name)
    && !isExternalCallParameter(name)
    && !(derivableBatchWitnessNames(entry, constants)?.has(name) ?? false)
    && !(derivableDynamicChunkNames(entry)?.has(name) ?? false);
}

/**
 * The operand a dynamic value's chunk run is addressed from.
 *
 * A `string`, `bytes` or dynamic array is not stored in one commitment: its bytes are split into 120-byte chunk
 * NFTs, and the direct convention co-spends that run as inputs whose first absolute coordinate is this operand.
 */
export const DYNAMIC_CHUNK_BASE_PARAMETER = '__internal__dynamicChunkInputBase';

/**
 * The operand the head derives for a body that reads or writes dynamic state, or undefined for a body that does not.
 *
 * The direct convention's SDK computes the run's first coordinate from the entry's physical block layout and hands
 * it to the body as an argument. A per-call master takes no such argument list: its frame declares where the
 * contract's records are, and the run sits a fixed width past that declaration, so the head derives the coordinate
 * from the frame and leaves it where the body reads it.
 */
export function derivableDynamicChunkNames(fn: FunctionDefinitionNode): Set<string> | undefined {
  return fn.usesDynamicChunkInputBase === true ? new Set([DYNAMIC_CHUNK_BASE_PARAMETER]) : undefined;
}

export interface PerCallMasterShapeInput {
  readonly contract: ContractNode;
  /** Interface definitions in the compiled unit, for resolving the selector a call site names. */
  readonly interfaces: readonly InterfaceNode[];
  /** File-level (free/library) functions in the compiled unit; a head must be the first thing emitted. */
  readonly freeFunctionCount: number;
  readonly hasContractInstantiation: boolean;
  readonly hasFunctionPointers: boolean;
  readonly needsInlineAssembly: boolean;
  readonly emitsEvent: boolean;
}

/** One entry's external calls, in execution order, which that entry's own sites bind. */
export interface PerCallEntryCallSites {
  readonly entryName: string;
  readonly calls: readonly MasterCallSite[];
}

export interface PerCallMasterShapeAssessment {
  readonly supported: boolean;
  /** Why the shape is refused, phrased as a fact about the contract. */
  readonly reason?: string;
  /** One descriptor list per entry, in entry order; each entry's sites resolve against its own list. */
  readonly entryCalls?: readonly PerCallEntryCallSites[];
  /** How many call records every entry's tail holds, which is the count the master head's walk is fixed to. */
  readonly callCount?: number;
  /** The event-region size and send count the master's tail fixes, which the master head checks. */
  readonly tail?: MasterTailShape;
}

/** Assesses whether the contract can be emitted as a per-call master program. */
export function assessPerCallMasterShape(input: PerCallMasterShapeInput): PerCallMasterShapeAssessment {
  const { contract } = input;
  const constants = contractConstantNames(contract);
  const refuse = (reason: string): PerCallMasterShapeAssessment => ({ supported: false, reason });
  if (input.freeFunctionCount > 0) {
    return refuse('a per-call master is one program, so free functions that would be emitted before it are not supported');
  }
  if (contract.constructorDef) {
    // The constructor runs as one more selector-dispatched body behind the same head, so it is admitted exactly when
    // its body asks the head for nothing the head does not already carry: it makes no external call (the head's call
    // records are the entries'), it makes no send (the head fixes one send list for every body), and it needs no
    // side-car input the head does not locate. Its event count is pinned by its own body against the head's region.
    const refusal = unsupportedConstructorShape(contract.constructorDef, constants);
    if (refusal !== undefined) return refuse(refusal);
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
  // The head parks the frame's `retval` whenever any entry returns a value; a returning entry compares the value
  // its own code computed against it, and a void entry requires it empty. Each returning entry's shape is checked
  // one by one.
  const returningEntries = entryPoints.filter((entry) => entry.returnTypes.length > 0);
  for (const entry of returningEntries) {
    const shape = unsupportedReturnShape(entry);
    if (shape !== undefined) return refuse(shape);
  }
  for (const entry of entryPoints) {
    // A hidden parameter is an operand the direct path expects from the SDK or from a co-spent input. The head
    // supplies the frame values itself and derives the batch operands it can, so any other hidden operand would be
    // read from the wrong stack position.
    const batchShape = unsupportedBatchWriteShape(entry, constants);
    if (batchShape !== undefined) return refuse(batchShape);
    const hidden = entry.parameters.filter((parameter) =>
      isUndeclaredHiddenParameter(entry, parameter.name, constants));
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
  // A derived mapping write is settled in the segment its own code runs, which the derivation reads as the first
  // segment. A master that makes a call splits the execution, so which segment the write lands in is a fact the
  // frame does not fix and the derivation will not guess.
  const derivedBatches = [
    ...(contract.constructorDef ? [contract.constructorDef] : []),
    ...entryPoints,
  ].some((fn) => derivableBatchWitnessNames(fn, constants) !== undefined);
  if (derivedBatches && calls.callCount > 0) {
    return refuse('a verified-mapping write is derived from the segment the entry runs, but the master makes '
      + 'external calls, which split the execution into later segments');
  }
  const tail = derivePerCallTailShape(entryPoints, contract.constructorDef, input.emitsEvent);
  if (tail.reason !== undefined) return refuse(tail.reason);
  return { supported: true, entryCalls: calls.entryCalls, callCount: calls.callCount, tail: tail.tail };
}

/**
 * Why a constructor body cannot share the master head, or undefined when it can.
 *
 * The constructor is dispatched like an entry point behind the one head, so it must ask the head for nothing the
 * head fixes for the entries instead: the call records are bound where each entry makes its own call, the send
 * count is the tail the entries fix, and a side-car input is located by a hidden operand the head does not supply.
 * Its own event count is pinned by its own body against the head's event region, so a constructor may emit events
 * like any other body. A body that only reads its arguments and the contract's own state, and writes that state,
 * shares the head unchanged; a constructor that only establishes the contract's immutable references is exactly
 * that shape.
 */
function unsupportedConstructorShape(
  constructorDef: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
): string | undefined {
  const batchShape = unsupportedBatchWriteShape(constructorDef, constants);
  if (batchShape !== undefined) return `the constructor ${batchShape.replace(/^the body /, '')}`;
  const hidden = constructorDef.parameters.filter((parameter) =>
    isUndeclaredHiddenParameter(constructorDef, parameter.name, constants));
  if (hidden.length > 0) {
    return `the constructor carries the hidden parameter '${hidden[0].name}', which the master head does not supply`;
  }
  if ((constructorDef.externalCalls?.length ?? 0) > 0 || (constructorDef.lowLevelCalls?.length ?? 0) > 0) {
    return 'the constructor makes an external call, but the master head fixes one set of call records for the '
      + 'entries and binds each record where that entry makes it';
  }
  if ((constructorDef.transferInfos?.length ?? 0) > 0 || (constructorDef.runtimeLoopTransfers?.length ?? 0) > 0) {
    return 'the constructor makes a value send, but the master head fixes one tail for every body it runs';
  }
  if (constructorDef.usesBlockhash) {
    return 'the constructor reads a blockhash, which needs a co-spent oracle input the master head does not locate';
  }
  if (constructorDef.keccakCompute || constructorDef.ecrecoverCompute) {
    return 'the constructor runs a compute side-car, which needs co-spent inputs the master head does not locate';
  }
  return undefined;
}

/**
 * Why an entry's return shape cannot be settled against the witness `retval`, or undefined for the admitted one.
 *
 * A frame's `retval` holds the bytes the execution returned, and the entry's own code compares them against the
 * blob its `return` built. One scalar value is a blob the code computes and compares; several values are a
 * concatenation whose parts are not told apart here, and a composite's encoding is likewise not decoded back.
 */
function unsupportedReturnShape(entry: FunctionDefinitionNode): string | undefined {
  if (entry.returnTypes.length > 1) {
    return `the entry point '${entry.name}' returns ${entry.returnTypes.length} values, but a frame's \`retval\` `
      + 'is compared with one value the entry computed, which a tuple of several values is not yet';
  }
  const type = entry.returnTypes[0];
  if (type === undefined || isScalarArgumentType(type)) return undefined;
  return `the entry point '${entry.name}' returns ${compositeTypeName(type)}, but a frame's \`retval\` is `
    + 'compared with one scalar value the entry computed, which a composite value is not yet';
}

/** The name a return shape is refused by, when its encoding is not a blob the entry's own code compares. */
function compositeTypeName(type: Type): string {
  const resolved = type instanceof ValueType ? type.underlyingType : type;
  if (resolved instanceof StructType) return 'a struct';
  if (resolved instanceof ArrayType) return 'an array';
  if (resolved instanceof MappingType) return 'a mapping';
  if (resolved instanceof TupleType) return 'a tuple';
  if (resolved instanceof FunctionType) return 'a function pointer';
  if (resolved instanceof TokenContainerType) return 'a token container';
  return 'a composite value';
}

/** The event-region size and send count a master's tail carries, or why a compiled body cannot fix them. */
export interface PerCallTailDerivation {
  readonly tail?: MasterTailShape;
  readonly reason?: string;
}

/**
 * Derives the event-region size and send count a master's tail has to declare, from the bodies the master runs.
 *
 * A master has one head that parks a fixed-size event region, so the region is as large as the largest number of
 * events any body emits; each body pins its own emit count against the block's declared count, so two bodies may
 * emit different numbers. The constructor runs as one more body behind the head and counts here with the entries.
 * A body that emits from a loop leaves its count to the loop, which the head cannot fix. A value send is a listed
 * send only when its recipient is a user address and a call when it is a contract, and the recipient's lock type
 * is a run-time value, so the send list is not fixed by the source and a transfer is refused rather than guessed.
 * Segments are not fixed here: the records a segment touches are decided by settlement, so the head walks each
 * segment's declared count.
 */
export function derivePerCallTailShape(
  entryPoints: readonly FunctionDefinitionNode[],
  constructorDef: FunctionDefinitionNode | undefined,
  emitsEvent: boolean,
): PerCallTailDerivation {
  const bodies = constructorDef === undefined ? entryPoints : [...entryPoints, constructorDef];
  let maxEventCount = 0;
  for (const body of bodies) {
    if ((body.runtimeLoopEvents?.length ?? 0) > 0 || emitsFromLoop(body)) {
      return { reason: 'an event emitted from a loop makes the event count depend on the loop, so the master '
        + 'cannot fix how many events the tail holds' };
    }
    maxEventCount = Math.max(maxEventCount, body.emitInfos?.length ?? 0);
  }
  if (emitsEvent && maxEventCount === 0) {
    return { reason: 'the contract emits an event that is not attributed to a body, so the master cannot fix '
      + 'how many events the tail holds' };
  }
  for (const body of bodies) {
    if ((body.transferInfos?.length ?? 0) > 0 || (body.runtimeLoopTransfers?.length ?? 0) > 0) {
      return { reason: 'a value send is a listed send only when its recipient is a user address and a call when '
        + 'it is a contract, and the recipient lock is a run-time value, so the master cannot fix how many sends '
        + 'the tail holds' };
    }
  }
  return { tail: { maxEventCount, sendCount: 0 } };
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

/** The call sites each entry makes, or why the head cannot check them. */
type CallSitesDerivation =
  | {
    readonly supported: true;
    readonly entryCalls: readonly PerCallEntryCallSites[];
    readonly callCount: number;
  }
  | { readonly supported: false; readonly reason: string };

/**
 * Derives the call sites each entry of the contract makes, which that entry's own body has to check.
 *
 * A master's head is one prefix that fixes how many `calls[]` records the tail holds; the records themselves are
 * bound where each entry's source makes the call, so two entries may call different methods, targets and
 * arguments. Only the count is shared: the head walks one record per call without reading it, and a segment
 * follows each call, so the entries must declare the same number of calls or the head cannot fix the tail. Each
 * entry's list is kept apart so its sites resolve to its own descriptors, and every call is admitted only when
 * the shape the site checks describes it — a call to a compile-time address whose argument values the caller's own
 * code can hash, and whose frame kind is one the head admits: a message call or a read-only call. Anything else is
 * refused by name, because the site would have to check a shape it cannot describe.
 */
function derivePerCallMasterCallSites(
  interfaces: readonly InterfaceNode[],
  entryPoints: readonly FunctionDefinitionNode[],
): CallSitesDerivation {
  const entryCalls: PerCallEntryCallSites[] = [];
  for (const entry of entryPoints) {
    const derived = deriveEntryCallSites(interfaces, entry);
    if (derived.reason !== undefined) return { supported: false, reason: derived.reason };
    entryCalls.push({ entryName: entry.name, calls: derived.calls });
  }
  const callCount = entryCalls[0]?.calls.length ?? 0;
  if (entryCalls.some((entry) => entry.calls.length !== callCount)) {
    return {
      supported: false,
      reason: 'the entries make different numbers of external calls, but a master has one head that fixes how '
        + 'many call records the tail holds',
    };
  }
  return { supported: true, entryCalls, callCount };
}

/** The call sites one entry makes, or why the head cannot check them. */
function deriveEntryCallSites(
  interfaces: readonly InterfaceNode[],
  entry: FunctionDefinitionNode,
): { calls: MasterCallSite[]; reason?: string } {
  const calls: MasterCallSite[] = [];
  for (const slot of entry.externalCalls ?? []) {
    if (slot.callMode === ExternalCallMode.DELEGATECALL) {
      // A delegate frame runs on the caller's own records, and the head checks its own address, not its context:
      // it has no arm that recognises the caller whose records such a callee would run on.
      return { calls: [], reason: `the call to '${slot.functionName}' is a ${String(slot.callMode)}, whose callee `
        + 'runs on its caller\'s own records, and the master head has no arm that recognises such a caller' };
    }
    if (slot.callMode !== undefined
      && slot.callMode !== ExternalCallMode.REGULAR
      && slot.callMode !== ExternalCallMode.STATICCALL) {
      return { calls: [], reason: `the call to '${slot.functionName}' is a ${String(slot.callMode)}, which the `
        + 'master head has no frame kind for' };
    }
    if (slot.condition !== undefined || slot.loopArrayVar !== undefined || slot.loopIndexExpression !== undefined
      || slot.inlineLoopDispatch === true || slot.runtimeSelector !== undefined || slot.fnPtrCall === true
      || slot.opaqueReturn === true || slot.callValueEffect === true
      || (slot.requiredDataNftIndices?.length ?? 0) > 0 || (slot.batchInvocations?.length ?? 0) > 1) {
      return { calls: [], reason: `the call to '${slot.functionName}' runs conditionally, repeatedly or through a `
        + 'run-time target or selector, so its call records are not a fixed set the head can check' };
    }
    const target = siteTarget(slot);
    if ('reason' in target) return { calls: [], reason: target.reason };
    const selector = slot.compileTimeSelector
      ?? resolveInterfaceSelector(interfaces, slot.interfaceName, slot.functionName);
    if (selector === undefined) {
      return { calls: [], reason: `the call to '${slot.interfaceName}.${slot.functionName}' has no four-byte `
        + 'selector the master head can check' };
    }
    const args = encodeSiteArguments(slot, interfaces);
    if ('reason' in args) return { calls: [], reason: args.reason };
    calls.push({
      kind: isReadCall(slot, interfaces) ? FrameKind.STATIC : FrameKind.CALL,
      selector,
      target: target.bytes,
      ...(target.fromStack === true ? { targetFromStack: true } : {}),
      interfaceName: slot.interfaceName,
      functionName: slot.functionName,
      arguments: args.arguments,
    });
  }
  return { calls };
}

/**
 * The target a site's own code can hold its record to, or why it cannot.
 *
 * A compile-time address literal is folded in as a constant. A value the caller's own code computes — a read of
 * its own state, or a parameter or local — is supplied to the check on the stack, the way a run-time argument's
 * digest is, so the record is bound to the bytes the code produced. Any other target is refused by name rather
 * than bound to a value the site would have to guess.
 */
function siteTarget(
  slot: ExternalCallSlot,
): { bytes: Uint8Array; fromStack?: boolean } | { reason: string } {
  if (slot.addressLiteral !== undefined) return { bytes: hexToBin(slot.addressLiteral) };
  if (slot.addressIsMsgSender === true) {
    return { reason: `the call to '${slot.functionName}' targets the transaction's own sender, whose category the `
      + 'site would have to bind to a callee of the same category, which its target check cannot do' };
  }
  if (slot.addressStateVar !== undefined || slot.addressParam !== undefined) {
    return { bytes: new Uint8Array(0), fromStack: true };
  }
  return { reason: `the call to '${slot.functionName}' targets an address the caller's own code does not hold as `
    + 'one value, which the site cannot check its record against' };
}

/**
 * True when the site is a read, so its callee runs a static frame rather than a message frame.
 *
 * A `.staticcall` is a read by construction. A plain method read — no `.call`/`.staticcall` suffix — is a read
 * when the interface method it names is `view` or `pure`. An explicit `.call` is a message call even when the
 * method it names is `view`, because the suffix, not the method, chose the frame.
 */
function isReadCall(slot: ExternalCallSlot, interfaces: readonly InterfaceNode[]): boolean {
  if (slot.callMode === ExternalCallMode.STATICCALL) return true;
  if (slot.callMode !== undefined) return false;
  const iface = interfaces.find((candidate) => candidate.name === slot.interfaceName);
  const fn = iface?.functions.find((candidate) => candidate.name === slot.functionName);
  return fn?.stateMutability === 'view' || fn?.stateMutability === 'pure';
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


