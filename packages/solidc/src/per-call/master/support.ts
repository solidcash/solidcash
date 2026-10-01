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
  AddressType,
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
  isDynamicStorageType,
} from '@solidcash/utils';
import type { Type } from '@solidcash/utils';
import { hexToBin } from '@bitauth/libauth';
import {
  ArrayAccessNode,
  AssignNode,
  BinaryOpNode,
  BlockNode,
  BoolLiteralNode,
  BranchNode,
  CastNode,
  CollectionIterationNode,
  ContractNode,
  DoWhileNode,
  EmitStatementNode,
  ExpressionNode,
  ExternalCallMode,
  ExternalFunctionCallNode,
  ExternalCallSlot,
  FieldAccessNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  FunctionDefinitionNode,
  HexLiteralNode,
  IdentifierNode,
  InterfaceNode,
  IntLiteralNode,
  LiteralNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  Node,
  NullaryOpNode,
  ParameterNode,
  StateAccessNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  StateArrayPopNode,
  StateArrayPushNode,
  StateAssignNode,
  StateVariableNode,
  StringLiteralNode,
  SwitchNode,
  TernaryOpNode,
  TryCatchNode,
  UnaryOpNode,
  VariableDefinitionNode,
  WhileNode,
} from '../../ast/AST.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from '../../ast/Operator.js';
import { walkInvocationAst } from '../../analysis/InvocationAnalysis.js';
import { countTransfersMinMax } from '../../semantic/branchOps.js';
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
 * are not part of its frame and are not read by its body. The per-slot names are recognised by pattern, since the
 * semantic pass injects one per returning slot.
 */
const EXTERNAL_CALL_PARAMETERS = new Set([
  '__internal__externalCallInputBase',
  // The direct path pins a delegate call to a co-spent delegate master through this operand. A per-call body binds
  // its delegate record against the witness block instead, so the operand is neither supplied nor read.
  '__internal__delegateInputIndex',
]);

/** A long mapping value a body reads, one per value-witness slot; the head supplies it from the frame's block. */
const VALUE_WITNESS_PARAMETER = /^__internal__valueWitness_(\d+)$/;

/**
 * The direct convention's operand for the co-spent proxy master's input index.
 *
 * Solidity-compatible upgradeable contracts mark their entries `delegate` by initializer inference, which injects
 * this operand. A per-call delegate frame runs on the records its own witness block declares, so the operand names
 * an input the head never reads and never leaves: the body that carries it is refused as the shape it is.
 */
const PROXY_MASTER_WITNESS_PARAMETER = '__internal__proxyMasterIndex';

/** The selector or call data an internal body that reads `msg.sig` or `msg.data` takes from its every call site. */
const MESSAGE_CONTEXT_PARAMETERS = new Set(['__internal__msgSig', '__internal__msgData']);

/**
 * The direct convention's fold operands: pushes earlier rows made, their complete form, and the first output of a
 * written long value's chunks. A per-call frame reads an entry's current value itself and finds its chunk outputs by
 * address, so the body neither receives nor reads them.
 */
function isFoldParameter(name: string): boolean {
  return /^__internal__leadingPushValue_\d+$/.test(name)
    || /^__internal__completePushValue_\d+$/.test(name)
    || name === '__internal__valueChunkOutputBase';
}

/** The value-witness slots a body reads: one past the highest slot its parameters name. */
export function valueWitnessSlotsOf(fn: FunctionDefinitionNode): number {
  return Math.max(fn.perCallValueWitnessSlots ?? 0, valueWitnessSlotsInParameters(fn));
}

/**
 * The slots the body's current parameters name.
 *
 * The head takes these parameters over, so the count is recorded when they are removed; a later pass that adds one
 * back - a mapping value read resolved after the frame was stripped - has to raise the count rather than be lost
 * behind the recorded one.
 */
function valueWitnessSlotsInParameters(fn: FunctionDefinitionNode): number {
  let slots = 0;
  for (const parameter of fn.parameters) {
    const match = VALUE_WITNESS_PARAMETER.exec(parameter.name);
    if (match !== null) slots = Math.max(slots, Number(match[1]) + 1);
  }
  return slots;
}

/** Removes the frame parameters a master does not take, from every function and so from the published ABI. */
export function stripFrameParameters(contract: ContractNode): void {
  const constants = contractConstantNames(contract);
  const functions = [
    contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions,
  ];
  // The positions each function loses, so an internal call to it drops the arguments those positions took. A call
  // writes the sender category itself only in a compiler-generated route; any other call leaves it to the hidden
  // sender context, so its arguments line up with the parameters that are not the category's.
  const stripped = new Map<FunctionDefinitionNode, ReadonlyMap<number, Set<number>>>();
  for (const fn of functions) {
    if (!fn) continue;
    // The sorted-batch operands and a dynamic value's chunk-run coordinate are derived from the master's own frame,
    // so they are not supplied as arguments any more than the frame values are; publishing them would ask a caller
    // for values it cannot know. A long value the body reads comes from the frame's block the same way.
    const derived = derivableBatchWitnessNames(fn, constants);
    const derivedDynamic = derivableDynamicChunkNames(fn);
    fn.perCallValueWitnessSlots = valueWitnessSlotsOf(fn);
    const kept = (parameter: ParameterNode): boolean =>
      !(derived?.has(parameter.name) ?? false) && !(derivedDynamic?.has(parameter.name) ?? false)
      && !FRAME_PARAMETERS.has(parameter.name) && !RETURN_EVENT_PARAMETERS.has(parameter.name)
      && !isExternalCallParameter(parameter.name)
      && !VALUE_WITNESS_PARAMETER.test(parameter.name) && !isFoldParameter(parameter.name);
    const lostAt = (parameters: readonly ParameterNode[]): Set<number> =>
      new Set(parameters.flatMap((parameter, index) => (kept(parameter) ? [] : [index])));
    const passed = fn.parameters.filter((parameter) => !FRAME_PARAMETERS.has(parameter.name));
    if (fn.parameters.some((parameter) => !kept(parameter))) {
      stripped.set(fn, new Map([[fn.parameters.length, lostAt(fn.parameters)], [passed.length, lostAt(passed)]]));
    }
    fn.parameters = fn.parameters.filter(kept);
    // A multi-target batch is classified as a dense linear row batch for the direct convention. The per-call master
    // derives the operands itself and settles the batch through the general per-target arm, which reads no rank or
    // row, so a derivable batch is reclassified here before the body is emitted.
    if (derived !== undefined) {
      for (const batch of fn.sortedBatchInfo ?? []) {
        if (batch.slotIndices.length > 1 && batch.linear === true) batch.linear = undefined;
      }
    }
  }
  // The semantic pass supplied those arguments at internal calls (a `this.f()` included), so a call would otherwise
  // push operands its callee no longer declares and leave them under its result.
  for (const fn of functions) {
    if (fn?.body === undefined) continue;
    walkInvocationAst(fn.body, (node) => {
      if (!(node instanceof FunctionCallNode) || node.resolvedFunction === undefined) return;
      const lost = stripped.get(node.resolvedFunction)?.get(node.parameters.length);
      if (lost === undefined) return;
      node.parameters = node.parameters.filter((_, index) => !lost.has(index));
    });
  }
}

/** True for an operand the master does not take: a call index, an anchor, a per-slot master index or a selector. */
function isExternalCallParameter(name: string): boolean {
  return EXTERNAL_CALL_PARAMETERS.has(name)
    || /^__internal__extcallAnchorIdx\d+$/.test(name)
    || /^__internal__extcallMasterIdx\d+$/.test(name)
    || /^__internal__loopTargets\d+$/.test(name)
    // The direct path names the output that carries a call's return event through this operand, one per returning
    // slot (the bare name when there is one, an indexed name per slot when there are several). It reads the value
    // back from that output, which a per-call master does not write: its frame records the returned value in
    // `retval`, and the body takes the call's result from its own witness record, so the operand is neither
    // supplied nor read and is stripped from the published interface like the others.
    || /^__internal__externalReturnOutputIdx\d*$/.test(name)
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
 * stack at their own depths. An expression is a value whose every operand the body already holds where it starts,
 * so the master emits it there and hashes it, which is why the shape admits nothing that reads a local the body
 * only computes later.
 */
export interface PerCallBatchKey {
  /** A parameter the body holds, read at its own stack depth. */
  readonly paramName?: string;
  /** A tracked frame value the head left: the frame's sender for `msg.sender`, the origin for `tx.origin`. */
  readonly frameSlot?: string;
  /** An expression whose operands the body holds at its start, which the master emits for the derivation. */
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

/** Every key of one target's write, in source order, or the fact that stops the master from holding one. */
type BatchKeysResolution =
  | { readonly kind: 'keys'; readonly keys: readonly PerCallBatchKey[] }
  | { readonly kind: 'refusal'; readonly reason: string };

/**
 * One key of a body's write to `slot`, or why the master cannot hold it where it derives the slot.
 *
 * A bare parameter is the body's own argument, and `msg.sender`/`tx.origin` are frame values the head leaves
 * tracked, so both are already on the stack. Any other key is derivable only when the body's own write carries an
 * expression whose every leaf is such a value, a compile-time constant, a state field the frame's record holds, or
 * a collection element whose address is fixed: such a value exists at the top of the body, where the derivation
 * runs, whereas a value the body only computes later does not.
 */
function resolveBatchKey(
  entry: FunctionDefinitionNode,
  slot: number,
  keyIndex: number,
  keyCount: number,
  constants: ReadonlySet<string>,
): BatchKeyResolution {
  const access = (entry.entryAccesses ?? []).find((candidate) => candidate.slotIndex === slot);
  const source = access?.keySources?.[keyIndex];
  if (source === undefined) {
    return {
      kind: 'refusal',
      reason: `the body writes a mapping at slot ${slot} with no key ${keyIndex} source to read`,
    };
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
        reason: `the body writes a mapping at slot ${slot} whose key ${keyIndex} names the parameter `
          + `'${source.paramName ?? 'unnamed'}' it does not declare`,
      };
    }
    return { kind: 'key', key: { paramName: source.paramName } };
  }
  const keyNode = mappingWriteKey(entry, slot, keyIndex, keyCount);
  if (keyNode === undefined) {
    return {
      kind: 'refusal',
      reason: `the body writes a mapping at slot ${slot} whose key ${keyIndex} '${source.canonical}' has no `
        + 'expression to read',
    };
  }
  const identifier = keyNode instanceof IdentifierNode ? keyNode : undefined;
  const expression = identifier === undefined
    ? keyNode : resolveKeyIdentifier(identifier.name, entry, new Set());
  if (expression === undefined) {
    return {
      kind: 'refusal',
      reason: `the body writes a mapping at slot ${slot} whose key ${keyIndex} '${source.canonical}' is the local `
        + `'${identifier?.name ?? '?'}', which is not bound to a single compile-time value`,
    };
  }
  const unavailable = keyOperandUnavailable(expression, constants, entry);
  if (unavailable !== undefined) {
    return {
      kind: 'refusal',
      reason: `the body writes a mapping at slot ${slot} whose key ${keyIndex} '${source.canonical}' reads `
        + `${unavailable}, and a master derives a target slot only from a bare parameter, the frame's sender, or a `
        + 'compile-time value the body holds at its start',
    };
  }
  return { kind: 'key', key: { expression } };
}

/**
 * Every key of a body's write to `slot`, in source order.
 *
 * A nested `m[a][b]` write carries two of them, and the slot is the masked hash of their per-key hashes
 * concatenated — the same value the body's own key hash computes and the SDK's `keyToSlotMulti` derives — so each
 * key has to be a value the master holds where it derives the slot.
 */
function resolveBatchKeys(
  entry: FunctionDefinitionNode,
  slot: number,
  constants: ReadonlySet<string>,
): BatchKeysResolution {
  const access = (entry.entryAccesses ?? []).find((candidate) => candidate.slotIndex === slot);
  const keyCount = access?.keyParams.length ?? 0;
  if (keyCount === 0) {
    return { kind: 'refusal', reason: `the body writes a mapping at slot ${slot} with no key source to read` };
  }
  const keys: PerCallBatchKey[] = [];
  for (let keyIndex = 0; keyIndex < keyCount; keyIndex += 1) {
    const resolved = resolveBatchKey(entry, slot, keyIndex, keyCount, constants);
    if (resolved.kind === 'refusal') return resolved;
    keys.push(resolved.key);
  }
  return { kind: 'keys', keys };
}

/**
 * The key expression of the body's own write to `slot`, or undefined when no such write is reachable in the AST.
 *
 * A single-key write carries one key; the entry access it belongs to is the same physical slot the batch named, so
 * its expression is the value the direct path would hash for that slot.
 */
function mappingWriteKey(
  entry: FunctionDefinitionNode,
  slot: number,
  keyIndex: number,
  keyCount: number,
): ExpressionNode | undefined {
  let key: ExpressionNode | undefined;
  walkInvocationAst(entry.body, (node) => {
    if (key !== undefined) return;
    if (node instanceof MappingAssignNode && node.entrySlotIndex === slot && node.keys.length === keyCount) {
      key = node.keys[keyIndex];
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
 * A literal and a compile-time constant exist at compile time. A cast, a unary operator, a binary operator and a
 * ternary are pure, so they are admitted exactly when their operands are, and a field read is admitted exactly when
 * the value it reads through is. A `msg.sender`/`tx.origin` read and a bare parameter are stack values the body
 * holds where the derivation runs; a local resolves to the single expression that binds it. A state value is only
 * reachable as the record its field is read through, and a mapping or array element is a value the body holds only
 * where its address is fixed. Every other node — a call, an environment value — is a value the shape does not
 * derive from, and the returned phrase names it so the refusal says which operand stopped it.
 */
function keyOperandUnavailable(
  node: ExpressionNode,
  constants: ReadonlySet<string>,
  entry: FunctionDefinitionNode,
): string | undefined {
  const params = new Set(entry.parameters.map((parameter) => parameter.name));
  const seen = new Set<string>();
  const walk = (current: ExpressionNode, underField: boolean): string | undefined => {
    if (current instanceof LiteralNode) return undefined;
    if (current instanceof CastNode) return walk(current.expression, underField);
    if (current instanceof UnaryOpNode) return walk(current.expression, underField);
    if (current instanceof BinaryOpNode) return walk(current.left, underField) ?? walk(current.right, underField);
    if (current instanceof TernaryOpNode) {
      return walk(current.condition, underField)
        ?? walk(current.ifTrue, underField)
        ?? walk(current.ifFalse, underField);
    }
    if (current instanceof FieldAccessNode) return walk(current.expression, true);
    if (current instanceof MappingAccessNode) {
      // A packed state array's element run is addressed from the frame, so the body holds the element; a verified
      // mapping's entry is a value only when the body's own plan allocated the slot it is read through. A read with
      // neither address is not a value the derivation can produce.
      if (current.isPackedStateArrayAccess !== true && current.entrySlotIndex < 0) {
        return `the mapping entry '${current.name}'`;
      }
      for (const key of current.keys) {
        const inner = walk(key, underField);
        if (inner !== undefined) return inner;
      }
      return undefined;
    }
    if (current instanceof ArrayAccessNode) return walk(current.array, underField) ?? walk(current.index, underField);
    if (current instanceof NullaryOpNode) {
      return current.operator === NullaryOperator.MSG_SENDER || current.operator === NullaryOperator.TX_ORIGIN
        ? undefined
        : `the ${current.operator} value`;
    }
    if (current instanceof IdentifierNode) {
      if (constants.has(current.name) || params.has(current.name)) return undefined;
      if (seen.has(current.name)) return `the value '${current.name}'`;
      const definition = resolveKeyIdentifier(current.name, entry, new Set(seen));
      if (definition === undefined) return `the value '${current.name}'`;
      seen.add(current.name);
      const inner = walk(definition, underField);
      seen.delete(current.name);
      return inner;
    }
    // A field the body reads out of a state record is a value it holds; the bare state read is not addressable.
    if (current instanceof StateAccessNode) {
      if (!underField) return `the state value '${current.name}'`;
      // An element of a dynamic (chunk-backed) state array is not a value the body holds at its start: its bytes
      // live in the frame's chunk run, and the derivation, emitted before the body's first statement, cannot
      // produce it there — the emitter answers the read with a shape that does not leave one key value. A key
      // reading the element, the cached copy of it the body writes through, or a field of it stays refused.
      return current.stateVariable?.isDynamic === true && current.stateVariable.type instanceof ArrayType
        ? `an element of the dynamic state array '${current.name}'`
        : undefined;
    }
    if (current instanceof FunctionCallNode) return `the value computed by '${current.identifier.name}'`;
    return `an ${current.constructor.name}`;
  };
  return walk(node, false);
}

/**
 * The batch a body can settle from its own frame, or undefined for a shape the derivation does not cover.
 *
 * Every one of a body's entry accesses is one write to a distinct target with at most the read of that same
 * target beside it, each target's key is one value the body holds where the derivation runs (a bare parameter, the
 * frame's sender, or a compile-time expression), and no target aliases another at run time. Under those conditions
 * the segment declares one record group per target, in the order the batches and their targets are listed here, so
 * the master can read each group back and derive that target's operands — and a read in the same access resolves
 * from the same group.
 *
 * A body may write several collections: `balances[to] += amount; allowances[owner][spender] -= amount` is one
 * execution over two of them, and the union of their created records is the trailing region the body declares. The
 * groups are read in the order this returns, so a plan that lays them out in another order is refused by the slot
 * each group is matched against rather than settled against the wrong node.
 */
function derivableTargetBatches(
  entry: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
): readonly DerivableTargetBatch[] | undefined {
  const batches = entry.sortedBatchInfo ?? [];
  if (batches.length === 0) return undefined;
  const accesses = entry.entryAccesses ?? [];
  if (accesses.some((access) => readsOutsideBatch(access, batches) === false)) return undefined;
  const derivable: DerivableTargetBatch[] = [];
  for (const batch of batches) {
    for (const slot of batch.slotIndices) {
      const access = accesses.find((candidate) => candidate.slotIndex === slot);
      if (access === undefined) return undefined;
      if (!isOneWrite(access.operations)) return undefined;
      if (access.inLoop === true || access.aliasCondDeleteSlot !== undefined
        || (access.runtimeAliasPriorSlots?.length ?? 0) > 0) return undefined;
      if (resolveBatchKeys(entry, slot, constants).kind !== 'keys') return undefined;
    }
    derivable.push({
      slots: [...batch.slotIndices], collection: batch.collection, wasLinear: batch.linear === true,
    });
  }
  return derivable;
}

/**
 * Whether an access outside every batch is a key the body only reads at a fixed slot (`true`), one it writes or
 * reads in a loop (`false`), or `undefined` for a batch target. A key read beside the batch is a kept record the
 * frame declares ahead of the batch's groups, which fixes the value the body saw.
 */
function readsOutsideBatch(
  access: NonNullable<FunctionDefinitionNode['entryAccesses']>[number],
  batches: NonNullable<FunctionDefinitionNode['sortedBatchInfo']>,
): boolean | undefined {
  if (access.slotIndex !== undefined && batches.some((batch) => batch.slotIndices.includes(access.slotIndex!))) {
    return undefined;
  }
  return access.inLoop !== true && access.operations.every((operation) => operation === 'read');
}

/**
 * Whether an access is one write, optionally beside the read the write's own expression performs.
 *
 * A read of a sorted entry and the write of that same entry are one transition on one node: the frame declares one
 * record group for the target, which fixes both the value the write started from and the node it produces. A read
 * of an entry the execution does not write is a separate access, a kept record of its own.
 *
 * A `delete` is that same one transition. A sorted mapping's delete lowers to an upsert of the value type's
 * default (`visitMappingDelete` routes it through `emitSortedValueUpsert`), so codegen emits a write of the target
 * node exactly as it does for an assignment. The access is classified `delete` rather than `write` only because
 * the declared value type is not one of the fixed-width kinds the classifier names, which says nothing about the
 * transition the body performs.
 */
function isOneWrite(operations: readonly string[]): boolean {
  const reads = operations.filter((operation) => operation === 'read').length;
  const writes = operations.filter((operation) => operation === 'write' || operation === 'delete').length;
  return writes === 1 && reads <= 1 && reads + writes === operations.length;
}

/**
 * The keys one derivable target reads, in source order, or undefined for a target the admission leaves refused.
 *
 * The emission uses the same resolution the admission does, so the values it emits and the emittability decision
 * cannot drift apart.
 */
export function perCallBatchKeys(
  entry: FunctionDefinitionNode,
  slot: number,
  constants: ReadonlySet<string>,
): readonly PerCallBatchKey[] | undefined {
  const resolved = resolveBatchKeys(entry, slot, constants);
  return resolved.kind === 'keys' ? resolved.keys : undefined;
}

/**
 * The sorted-batch operands a per-call master derives from its own frame, or undefined for a shape it cannot.
 *
 * The derivation reads the master's witness block back and leaves, per target, the four operands the sorted-batch
 * verification consumes and, once, the trailing count. It covers one collection whose every entry is one write to a
 * distinct target whose key the body holds where the derivation runs, in place or spliced in, together with the
 * read of that same target when the write's own expression performs one: the target's record group is then the
 * group the segment declares for it, so the frame fixes which transition ran and the value it started from. A
 * dense linear batch's own rank and row operands are not part of that derivation, so the master drops them and
 * settles the batch through the general arm instead. Anything wider is left refused rather than derived
 * approximately.
 */
export function derivableBatchWitnessNames(
  entry: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
): Set<string> | undefined {
  const batches = derivableTargetBatches(entry, constants);
  if (batches === undefined) return undefined;
  const names = new Set<string>();
  for (const batch of batches) {
    for (const slot of batch.slots) {
      for (const kind of BATCH_DERIVATION_SLOT_ORDER) {
        if (kind === 'Trailing') continue;
        names.add(batchDerivationSlotName(kind, slot));
      }
      if (batch.wasLinear) names.add(`__internal__vmapBatchRank_${slot}`);
    }
    if (batch.wasLinear) names.add(`__internal__vmapBatchRows_${batch.collection}`);
  }
  // The trailing region is the body's, so the created-record count it declares is one value over every collection.
  names.add(batchDerivationSlotName('Trailing', 0));
  return names;
}

/**
 * Why a body's sorted-batch writes cannot be settled from its own frame, or undefined when they can.
 *
 * A body that writes a mapping carries the direct convention's batch operands. A per-call master derives those
 * from the records its own frame declares, which it can do for every collection the body writes when each entry is
 * one write to a distinct target whose key the body holds where the derivation runs, with at most the read of that
 * same target beside it, and every other entry a key it only reads at a fixed slot. Anything wider (a batched or
 * aliased write, a write or a loop read outside the batch, a key the body computes rather than holds) makes the
 * record a segment declares, or the value it carries, a fact the frame does not fix. Each refusal names the access
 * and the fact that stops it.
 */
function unsupportedBatchWriteShape(
  entry: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
): string | undefined {
  const batches = entry.sortedBatchInfo ?? [];
  if (batches.length === 0) return undefined;
  if (derivableBatchWitnessNames(entry, constants) !== undefined) return undefined;
  const accesses = entry.entryAccesses ?? [];
  const slots = batches.flatMap((batch) => batch.slotIndices);
  for (const slot of slots) {
    const access = accesses.find((candidate) => candidate.slotIndex === slot);
    if (access === undefined) return `the body writes a mapping at slot ${slot} with no entry access to read`;
    if (!isOneWrite(access.operations)) {
      return `the body writes a mapping at slot ${slot} as a ${access.operations.join('/')}, and a master derives `
        + 'the sorted-batch operands only for one write per target, with at most the read of that same target '
        + 'beside it';
    }
    if (access.inLoop === true) {
      return `the body writes a mapping at slot ${slot} in a loop, so the records it declares are not a fixed set`;
    }
    if (access.aliasCondDeleteSlot !== undefined || (access.runtimeAliasPriorSlots?.length ?? 0) > 0) {
      return `the body writes a mapping at slot ${slot} that can alias another target at run time, so its record `
        + 'is not fixed';
    }
    const resolved = resolveBatchKeys(entry, slot, constants);
    if (resolved.kind === 'refusal') return resolved.reason;
  }
  const outside = accesses.find((access) => readsOutsideBatch(access, batches) === false);
  if (outside !== undefined) {
    return `the body touches mapping "${outside.collection}" outside its batch as ${outside.operations.join('/')}`
      + `${outside.inLoop === true ? ' in a loop' : ''}, and a master derives the operands beside a key it only `
      + 'reads at a fixed slot';
  }
  return 'the body writes a mapping in a shape whose record the master cannot read back from its own frame: its '
    + 'segment would not fix which transition ran';
}

/** A closed interval of the calls some path makes, or undefined when the source leaves the count open. */
type CallRange = { readonly least: number; readonly most: number } | undefined;

/** True when a value reaches any call the execution records, whatever node the walk finds it on. */
function reachesAnyCall(value: unknown): boolean {
  let reaches = false;
  walkInvocationAst(value, (node) => {
    if (node instanceof ExternalFunctionCallNode
      || node instanceof LowLevelCallStatementNode || node instanceof LowLevelCallNode) reaches = true;
  });
  return reaches;
}

/**
 * Advances a call range past a value, or undefined when the value makes an open number of calls.
 *
 * A value that reaches no call contributes none on any path, even when the count walk cannot descend through it:
 * the walk answers a statement carrying a nested branch as open, and lowering leaves such branches inside
 * expressions (an unchecked arithmetic block keeps a disabled overflow check as `if (false) revert`). That branch
 * decides values rather than calls, so the segment the code after it runs in is the one the code before it reached.
 */
function advanceCallRange(range: CallRange, value: unknown): CallRange {
  if (range === undefined) return undefined;
  if (!reachesAnyCall(value)) return range;
  const calls = callsInExpression(value);
  return calls === undefined ? undefined : { least: range.least + calls, most: range.most + calls };
}

/** The calls either of two mutually exclusive paths makes, or undefined when either leaves the count open. */
function joinCallRanges(left: CallRange, right: CallRange): CallRange {
  if (left === undefined || right === undefined) return undefined;
  return { least: Math.min(left.least, right.least), most: Math.max(left.most, right.most) };
}

/**
 * The blocks a loop or switch runs when its own body reaches no call, or undefined when it reaches one.
 *
 * A loop or switch whose body makes no external call leaves the call count where it was, so a write inside it lands
 * in the segment the code before it runs in and the walk can place it. A construct whose body reaches a call
 * decides the count at run time, which no write inside it can be placed by. A loop's body is one block; a switch's
 * arms and its default each are their own.
 */
function callFreeNestedBlocks(statement: Node): readonly BlockNode[] | undefined {
  if (reachesExternalCall(statement)) return undefined;
  if (statement instanceof SwitchNode) {
    return [
      ...statement.cases.map((arm) => arm.body),
      ...(statement.defaultCase === undefined ? [] : [statement.defaultCase]),
    ];
  }
  if (statement instanceof WhileNode || statement instanceof DoWhileNode) return [statement.block];
  if (statement instanceof CollectionIterationNode) return [statement.body];
  return undefined;
}

/**
 * How many external calls a body makes before its derivable batch write, or undefined when the source does not fix
 * that number.
 *
 * The derivation reads the segment the write's records are declared in, and a call closes the segment the code
 * before it runs in, so a write that precedes every call lands in the segment the derivation reads while one that
 * follows a call lands in a later one. The count is walked path by path: a branch's arms are joined and a
 * call-bearing loop or switch leaves it open, so a write behind a call the source does not fix — or in a body
 * whose arms make different numbers of calls — is left to the caller to refuse. A statement that reaches no call
 * contributes none, so a body whose only branches reach no call keeps the fixed segment its (absent) calls name
 * rather than being left open by a branch the count walk cannot descend through.
 */
export function perCallBatchWriteSegment(entry: FunctionDefinitionNode): number | undefined {
  const slots = new Set((entry.sortedBatchInfo ?? []).flatMap((batch) => batch.slotIndices));
  if (slots.size === 0) return undefined;
  let segment: number | undefined;
  let ambiguous = false;
  // A write a call precedes lands in the segment the write's own path reached, so a write is fixed only when
  // every path that reaches it made the same number of calls.
  const record = (calls: CallRange): void => {
    if (calls === undefined || calls.least !== calls.most) { ambiguous = true; return; }
    if (segment === undefined) segment = calls.least;
    else if (segment !== calls.least) ambiguous = true;
  };
  const walkBlock = (block: BlockNode | undefined, incoming: CallRange): CallRange => {
    let range = incoming;
    for (const statement of block?.statements ?? []) range = walkStatement(statement, range);
    return range;
  };
  const walkStatement = (statement: Node, incoming: CallRange): CallRange => {
    if (statement instanceof MappingAssignNode || statement instanceof MappingDeleteNode) {
      if (slots.has(statement.entrySlotIndex)) record(incoming);
      return advanceCallRange(incoming, statement);
    }
    if (statement instanceof BranchNode) {
      const afterCondition = advanceCallRange(incoming, statement.condition);
      const thenRange = walkBlock(statement.ifBlock, afterCondition);
      const elseRange = statement.elseBlock === undefined
        ? afterCondition
        : walkBlock(statement.elseBlock, afterCondition);
      return joinCallRanges(thenRange, elseRange);
    }
    if (statement instanceof BlockNode) return walkBlock(statement, incoming);
    if (statement instanceof SwitchNode || statement instanceof CollectionIterationNode
      || statement instanceof WhileNode || statement instanceof DoWhileNode) {
      // A loop, switch or iteration makes a number of calls its own bound decides; a call-free one makes none, and a
      // write inside it lands in the segment the code before it runs in, so the walk descends into it.
      const nested = callFreeNestedBlocks(statement);
      if (nested === undefined) return undefined;
      for (const block of nested) walkBlock(block, incoming);
      return incoming;
    }
    if (statement instanceof TryCatchNode) {
      // A catch block is not an executable path, matching the invocation walk.
      return walkBlock(statement.tryBlock, advanceCallRange(incoming, statement.expression));
    }
    return advanceCallRange(incoming, statement);
  };
  walkBlock(entry.body, { least: 0, most: 0 });
  return ambiguous ? undefined : segment;
}

/**
 * True when every one of a body's derivable batch writes runs after every call the body reaches.
 *
 * A call closes the segment the code before it runs in, so a write no call follows lands in the last segment the
 * execution opens, whichever arm ran: its index is how many calls the execution made, which the witness block
 * declares. A call textually after the write is the only way one can execute after it, so every call's place in the
 * invocation walk lying below every write's is exactly the fact the derivation needs to read that segment at run
 * time. A write in a loop is refused elsewhere, so the walk order decides this. A body that sends pays a
 * recipient's `receive()` after its own code, which is a call after every write the source shows, so a sending
 * body never qualifies.
 */
export function perCallBatchWriteFollowsEveryCall(entry: FunctionDefinitionNode): boolean {
  const slots = new Set((entry.sortedBatchInfo ?? []).flatMap((batch) => batch.slotIndices));
  if (slots.size === 0 || (entry.transferInfos?.length ?? 0) > 0) return false;
  let order = 0;
  let lastCall = -1;
  let firstWrite = Number.POSITIVE_INFINITY;
  walkInvocationAst(entry.body, (node) => {
    if (node instanceof ExternalFunctionCallNode
      || node instanceof LowLevelCallStatementNode || node instanceof LowLevelCallNode) {
      lastCall = order;
    } else if ((node instanceof MappingAssignNode || node instanceof MappingDeleteNode)
      && slots.has(node.entrySlotIndex)) {
      firstWrite = Math.min(firstWrite, order);
    }
    order += 1;
  });
  return lastCall < firstWrite;
}

/**
 * The segment an entry's own record write is declared in, as the artifact publishes it for a builder.
 *
 * A fixed number is the count of external calls the entry makes before the write; `'last'` is the last segment the
 * run opens, which is where a write every call precedes lands and where a write to a field whose bytes the record
 * only sizes lands whatever the source order. A builder reads the same fact code generation does and declares the
 * write's records in that one segment rather than refusing the entry.
 */
export type PerCallWriteSegment = number | 'last';

/**
 * True for a write to a record the entry's own frame holds: a data-NFT field, a dynamic value's record, or a
 * target of the verified mapping batch the entry plans.
 *
 * A call closes the segment the code before it runs in, so which segment such a write is declared in is the number
 * of calls the entry's own source makes before it.
 */
function writesEntryRecord(statement: Node, batchSlots: ReadonlySet<number>): boolean {
  if (statement instanceof MappingAssignNode || statement instanceof MappingDeleteNode) {
    return batchSlots.has(statement.entrySlotIndex);
  }
  return statement instanceof StateAssignNode
    || statement instanceof StateArrayPushNode || statement instanceof StateArrayPopNode
    || statement instanceof StateArrayAssignNode || statement instanceof StateArrayDeleteNode;
}

/**
 * True for a write to a field whose bytes the record does not hold: the record carries the value's length and the
 * bytes live in a run of chunk records the epilogue pins.
 *
 * Such a write is declared in the segment the epilogue runs in — the run's last one — wherever the source makes it:
 * the record is only rebuilt once the chunk run is written, so an earlier segment's close declares it kept.
 */
function writesSizedField(statement: Node): boolean {
  const stateVariable = (statement as { readonly stateVariable?: { readonly isDynamic?: boolean } }).stateVariable;
  return stateVariable?.isDynamic === true;
}

/** True when every write to the entry's own records runs after every call the entry reaches. */
function entryRecordWritesFollowEveryCall(entry: FunctionDefinitionNode, batchSlots: ReadonlySet<number>): boolean {
  // A body that sends pays a recipient's `receive()` after its own code, which is a call after every write the
  // source shows, so a sending body never qualifies.
  if ((entry.transferInfos?.length ?? 0) > 0) return false;
  let order = 0;
  let lastCall = -1;
  let firstWrite = Number.POSITIVE_INFINITY;
  walkInvocationAst(entry.body, (node) => {
    if (node instanceof ExternalFunctionCallNode
      || node instanceof LowLevelCallStatementNode || node instanceof LowLevelCallNode) {
      lastCall = order;
    } else if (writesEntryRecord(node, batchSlots)) {
      firstWrite = Math.min(firstWrite, order);
    }
    order += 1;
  });
  return lastCall < firstWrite;
}

/**
 * The segment an entry's own record write is declared in, or undefined when the artifact cannot state one.
 *
 * The body emits each write in the segment the code before it runs in, so the fact a builder needs is exactly the
 * value code generation acts on: a fixed count names the write's segment outright, a write every call precedes
 * lands in the segment the witness block's own declared call count names, and a write to a field whose bytes the
 * record only sizes lands in that same last segment wherever the source makes it. Every write the entry makes has
 * to name the same segment, because one fact is published for the entry; a write a call the source does not fix
 * follows lands in none of them, so it stays unstated and the entry is refused rather than declared in a guessed
 * segment.
 */
export function perCallWriteSegment(entry: FunctionDefinitionNode): PerCallWriteSegment | undefined {
  const batchSlots = perCallBatchSlots(entry);
  const facts = perCallWriteSteps(entry, batchSlots).map(writeStepSegment);
  if (facts.length === 0) return undefined;
  if (facts.every((fact) => fact !== undefined && fact === facts[0])) return facts[0];
  // The write's own segment is not fixed: every call has to precede it for the run's last segment to be the answer.
  return entryRecordWritesFollowEveryCall(entry, batchSlots) ? 'last' : undefined;
}

/** The record slots the entry's verified mapping batch writes: the only mapping writes its own frame declares. */
function perCallBatchSlots(entry: FunctionDefinitionNode): ReadonlySet<number> {
  return new Set((entry.sortedBatchInfo ?? []).flatMap((batch) => batch.slotIndices));
}

/** One record write the entry's own source makes, with the calls its own path made before it. */
interface PerCallWriteStep {
  readonly statement: Node;
  /** The calls the path that reaches this write made before it, or undefined when the source does not fix them. */
  readonly calls: CallRange;
}

/** The record writes the entry's own source makes, in the order the walk reaches them. */
function perCallWriteSteps(
  entry: FunctionDefinitionNode,
  batchSlots: ReadonlySet<number>,
): readonly PerCallWriteStep[] {
  const steps: PerCallWriteStep[] = [];
  const walkBlock = (block: BlockNode | undefined, incoming: CallRange): CallRange => {
    let range = incoming;
    for (const statement of block?.statements ?? []) range = walkStatement(statement, range);
    return range;
  };
  const walkStatement = (statement: Node, incoming: CallRange): CallRange => {
    if (writesEntryRecord(statement, batchSlots)) {
      steps.push({ statement, calls: incoming });
      return advanceCallRange(incoming, statement);
    }
    if (statement instanceof BranchNode) {
      const afterCondition = advanceCallRange(incoming, statement.condition);
      const thenRange = walkBlock(statement.ifBlock, afterCondition);
      const elseRange = statement.elseBlock === undefined
        ? afterCondition
        : walkBlock(statement.elseBlock, afterCondition);
      return joinCallRanges(thenRange, elseRange);
    }
    if (statement instanceof BlockNode) return walkBlock(statement, incoming);
    if (statement instanceof SwitchNode || statement instanceof CollectionIterationNode
      || statement instanceof WhileNode || statement instanceof DoWhileNode) {
      // A loop, switch or iteration makes a number of calls its own bound decides; a call-free one makes none, and a
      // write inside it lands in the segment the code before it runs in, so the walk descends into it.
      const nested = callFreeNestedBlocks(statement);
      if (nested === undefined) return undefined;
      for (const block of nested) walkBlock(block, incoming);
      return incoming;
    }
    if (statement instanceof TryCatchNode) {
      // A catch block is not an executable path, matching the invocation walk.
      return walkBlock(statement.tryBlock, advanceCallRange(incoming, statement.expression));
    }
    return advanceCallRange(incoming, statement);
  };
  walkBlock(entry.body, { least: 0, most: 0 });
  return steps;
}

/** The segment one write lands in: the calls before a sized field's write past, or where that write's run is. */
function writeStepSegment(step: PerCallWriteStep): PerCallWriteSegment | undefined {
  if (writesSizedField(step.statement)) return 'last';
  return step.calls === undefined || step.calls.least !== step.calls.most ? undefined : step.calls.least;
}

/**
 * One write of an entry, and the segment its records are declared in.
 *
 * Exactly one identity is set, naming the write the segment belongs to: `record` is one of the entry's own data-NFT
 * records, `collection` is the verified mapping a batch write targets, and `variable` is the dynamic value whose
 * run of chunk records a write occupies. A builder declares each write's records in its own segment.
 */
export interface PerCallWriteSegmentFact {
  readonly record?: number;
  readonly collection?: string;
  readonly variable?: string;
  readonly segment: PerCallWriteSegment;
}

/**
 * The segment each of an entry's own writes is declared in: an empty list for a body that makes none, undefined when
 * any of the writes it makes is unfixed.
 *
 * Code generation places each write in its own segment: a state write lands where its own path's calls put it, the
 * batch walk reads the one segment its own calls name, and the run of chunk records a dynamic write grows is pinned
 * by the epilogue in the last segment. A builder places each write's records by the same facts, so a body whose
 * writes do not all share one segment is served rather than refused. A write the source does not locate — one
 * behind a call the source does not fix, or inside a loop the walk cannot count — leaves the whole entry unstated,
 * which is what the builder refuses by name. A body that writes nothing of its own publishes an empty list rather
 * than no fact at all, so a builder tells it from a body whose write's segment is unstated.
 */
/**
 * True when the body's own source writes a record of its frame's state, at any depth.
 *
 * A body that writes nothing of its own publishes an empty write list, which tells a builder that the entry rewrites
 * nothing rather than that its write's segment is unstated. The walk covers every construct a write can sit in — a
 * loop's body, a switch's case, a branch's arm — and the two writes its statement walk cannot reach: the
 * verified-mapping batch the frame plans, and the upsert a runtime loop performs.
 */
function writesOwnRecord(entry: FunctionDefinitionNode): boolean {
  if ((entry.sortedBatchInfo?.length ?? 0) > 0 || (entry.sortedUpsertLoopInfo?.length ?? 0) > 0) return true;
  let reached = false;
  walkInvocationAst(entry.body, (node) => {
    if (reached) return;
    reached = node instanceof MappingAssignNode || node instanceof MappingDeleteNode
      || node instanceof StateAssignNode || node instanceof StateArrayPushNode
      || node instanceof StateArrayPopNode || node instanceof StateArrayAssignNode
      || node instanceof StateArrayDeleteNode;
  });
  return reached;
}

export function perCallWriteSegments(
  entry: FunctionDefinitionNode,
): readonly PerCallWriteSegmentFact[] | undefined {
  const facts: PerCallWriteSegmentFact[] = [];
  const admit = (identity: string, fact: PerCallWriteSegmentFact): boolean => {
    const known = facts.find((candidate) => identityOfWrite(candidate) === identity);
    if (known !== undefined) return known.segment === fact.segment;
    facts.push(fact);
    return true;
  };
  const steps = perCallWriteSteps(entry, perCallBatchSlots(entry));
  // The sorted batch is one write however many targets it names: the derivation reads one segment for all of
  // them, so a body whose batches the walk does not place in one segment publishes no fact rather than a wrong one.
  const collections = [...new Set((entry.sortedBatchInfo ?? []).map((batch) => batch.collection))];
  const batchSegment = perCallBatchWriteSegment(entry)
    ?? (perCallBatchWriteFollowsEveryCall(entry) ? 'last' : undefined);
  if (collections.length > 0 && (batchSegment === undefined
    || !collections.every((collection) => admit(`mapping:${collection}`, { collection, segment: batchSegment })))) {
    return undefined;
  }
  // A batch target the walk does not reach is a write inside a loop or a switch, which the walk cannot place: the
  // emitter refuses such a body's derivation rather than reading a segment the write does not land in.
  const reached = new Set(steps
    .filter((step) => step.statement instanceof MappingAssignNode || step.statement instanceof MappingDeleteNode)
    .map((step) => (step.statement as MappingAssignNode | MappingDeleteNode).entrySlotIndex));
  if ([...perCallBatchSlots(entry)].some((slot) => !reached.has(slot))) return undefined;
  const records = perCallRecordWriteSegments(steps);
  if (records === undefined) return undefined;
  for (const [record, segment] of records.segments) {
    if (!admit(`record:${record}`, { record, segment })) return undefined;
  }
  // A dynamic value's bytes live in the run of chunk records the epilogue pins in the last segment, whatever the
  // source position of the write that grows it.
  for (const variable of records.variables) {
    if (!admit(`dynamic:${variable}`, { variable, segment: 'last' })) return undefined;
  }
  return facts.length > 0 ? facts : (writesOwnRecord(entry) ? undefined : []);
}

/** The identity one published write is keyed by, as `perCallWriteSegments` builds it. */
function identityOfWrite(fact: PerCallWriteSegmentFact): string {
  if (fact.record !== undefined) return `record:${fact.record}`;
  if (fact.collection !== undefined) return `mapping:${fact.collection}`;
  return `dynamic:${fact.variable}`;
}

/** The segment each written data record is declared in, and the dynamic values the entry's writes grow. */
interface PerCallRecordWriteSegments {
  /** One segment per written data record. */
  readonly segments: ReadonlyMap<number, PerCallWriteSegment>;
  /** The dynamic values a write grows, whose run of chunk records the epilogue pins. */
  readonly variables: readonly string[];
}

/**
 * The segment each of the entry's own data records is declared in, or undefined when one is not fixed.
 *
 * A record is rebuilt from the fields the body holds where the segment that wrote them closes, so a record whose
 * every write lands in one segment is declared written there. A write to a field the record only sizes takes the
 * record with it into the run's last segment wherever the source makes it, because the record is only rebuilt once
 * the chunk run is written; such a record is declared written there and nowhere else. A record the entry writes in
 * two segments would have to be declared at both, which states a value between them that no plan knows.
 */
function perCallRecordWriteSegments(
  steps: readonly PerCallWriteStep[],
): PerCallRecordWriteSegments | undefined {
  const sized = new Set<number>();
  const variables = new Set<string>();
  const segments = new Map<number, Set<PerCallWriteSegment>>();
  for (const step of steps) {
    if (step.statement instanceof MappingAssignNode || step.statement instanceof MappingDeleteNode) continue;
    const stateVariable = (step.statement as { readonly stateVariable?: StateVariableNode }).stateVariable;
    if (stateVariable === undefined) return undefined;
    if (stateVariable.isDynamic === true) {
      sized.add(stateVariable.nftIndex);
      variables.add(stateVariable.name);
      continue;
    }
    const segment = writeStepSegment(step);
    if (segment === undefined) return undefined;
    const forRecord = segments.get(stateVariable.nftIndex) ?? new Set<PerCallWriteSegment>();
    forRecord.add(segment);
    segments.set(stateVariable.nftIndex, forRecord);
  }
  const written = new Map<number, PerCallWriteSegment>();
  for (const [record, at] of segments) {
    if (sized.has(record)) continue;
    if (at.size !== 1) return undefined;
    written.set(record, [...at][0]!);
  }
  for (const record of sized) written.set(record, 'last');
  return { segments: written, variables: [...variables] };
}

/** True for a hidden operand that is neither a frame value nor a sorted-batch operand the master derives. */
function isUndeclaredHiddenParameter(
  entry: FunctionDefinitionNode,
  name: string,
  constants: ReadonlySet<string>,
): boolean {
  return name.startsWith('__internal__')
    && !MESSAGE_CONTEXT_PARAMETERS.has(name)
    && !FRAME_PARAMETERS.has(name)
    && !RETURN_EVENT_PARAMETERS.has(name)
    && !isExternalCallParameter(name)
    && !VALUE_WITNESS_PARAMETER.test(name)
    && !isFoldParameter(name)
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
  readonly hasContractInstantiation: boolean;
  readonly hasFunctionPointers: boolean;
  /**
   * The bodies that reach an inline-assembly block the lowering left in place, by name.
   *
   * The reachability is measured against the program the master is built from, so a body whose assembly the
   * lowering rewrote is served and only a body that still reaches an unsupported block is refused.
   */
  readonly assemblyBodies: ReadonlySet<string>;
  readonly emitsEvent: boolean;
}

/** One entry's external calls, in execution order, which that entry's own sites bind. */
export interface PerCallEntryCallSites {
  readonly entryName: string;
  readonly calls: readonly MasterCallSite[];
  /** How many calls the entry's execution makes, which is the same on every path or the entry is refused. */
  readonly pathCount?: number;
  /** True when the entry's calls run inside a loop, so one execution reaches a site a number of times. */
  readonly repeats?: boolean;
  /**
   * The segment the entry's own record write is declared in, when it writes one and the fact is published.
   *
   * A builder declares the write's records in that one segment; absent means the entry writes no record, or writes
   * one whose segment the source does not fix.
   */
  readonly writeSegment?: PerCallWriteSegment;
  /**
   * The segment each of the entry's own writes is declared in, one fact per write.
   *
   * A body whose writes do not all land in one segment publishes no single `writeSegment`, but each of its writes
   * still names its own segment here, which is what lets a builder place each write's records in the segment code
   * generation places them in. An empty list is a body that writes no record of its own, and absent means a write's
   * segment is not fixed, which the builder refuses by name.
   */
  readonly writeSegments?: readonly PerCallWriteSegmentFact[];
}

export interface PerCallMasterShapeAssessment {
  readonly supported: boolean;
  /** Why the whole contract is refused, phrased as a fact about the master rather than about one body. */
  readonly reason?: string;
  /** One descriptor list per entry, in entry order; each entry's sites resolve against its own list. */
  readonly entryCalls?: readonly PerCallEntryCallSites[];
  /** The largest number of calls any entry makes on every path, which bounds the tail the head walks. */
  readonly callCount?: number;
  /** The event-region size and send count the master's tail fixes, which the master head checks. */
  readonly tail?: MasterTailShape;
  /**
   * The bodies the master cannot serve, by name, each with the fact that refuses it.
   *
   * A master is one program, but a body it cannot emit is not the contract's problem: the entry stays in the ABI
   * and the dispatcher, its body is emitted as a refusal that fails whenever it is reached, and the reason is
   * published so a builder reports which function is unsupported instead of the whole contract. The names are the
   * bodies' own; the artifact publishes each as `Contract.entry()` (`PublishedRefusedEntry.functionName`).
   */
  readonly refusedEntries?: readonly { readonly entryName: string; readonly reason: string }[];
  /**
   * The entries that read their own contract's balance, directly or through a body they reach: a builder spends
   * every container of the contract for them, since the balance a frame reads is the containers its transaction
   * spends. The names are the bodies' own; the artifact publishes each as `Contract.entry()`.
   */
  readonly balanceReaders?: readonly string[];
  /**
   * The refused bodies no selector reaches whose definitions code generation cannot emit, each with the fact that
   * refuses it: a kept subroutine that reads its contract's balance has no frame to read it from. Each is emitted
   * as a refusal stub and is not published, since no frame names it; the bodies that run it are refused with it.
   */
  readonly stubbedDefinitions?: readonly { readonly name: string; readonly reason: string }[];
}

/** True when an address expression is the contract's own, `address(this)`, whatever casts wrap it. */
export function isOwnAddress(expression: ExpressionNode): boolean {
  let current: ExpressionNode = expression;
  while (current instanceof CastNode) current = current.expression;
  return current instanceof UnaryOpNode && current.operator === UnaryOperator.INPUT_LOCKING_BYTECODE
    && current.expression instanceof NullaryOpNode && current.expression.operator === NullaryOperator.INPUT_INDEX;
}

/** Whether a body reads its own contract's balance, and whether it reads another address's. */
function balanceReads(body: BlockNode | undefined): { readonly own: boolean; readonly other: boolean } {
  let own = false;
  let other = false;
  walkInvocationAst(body, (node) => {
    if (node instanceof StateAccessNode && node.name === 'balance' && node.stateVariable === undefined) own = true;
    if (node instanceof FieldAccessNode && node.name === 'balance' && node.expression.type instanceof AddressType) {
      if (isOwnAddress(node.expression)) own = true;
      else other = true;
    }
  });
  return { own, other };
}

/**
 * The balances the constructor reads, in its own body or in any body it runs.
 *
 * A body the lowering left as a subroutine keeps its own definition, so a read inside it is reached through the
 * invocation graph rather than found in the constructor's statements.
 */
function constructorBalanceReads(
  constructorDef: FunctionDefinitionNode,
  bodies: readonly FunctionDefinitionNode[],
  invokes: ReadonlyMap<string, ReadonlySet<string>>,
): { readonly own: boolean; readonly other: boolean } {
  const byName = new Map(bodies.map((fn) => [fn.name, fn]));
  const reached = new Set<string>();
  const pending = [...invokedFunctionNames(constructorDef.body)];
  while (pending.length > 0) {
    const name = pending.pop()!;
    if (reached.has(name)) continue;
    reached.add(name);
    pending.push(...(invokes.get(name) ?? []));
  }
  const reads = [constructorDef.body, ...[...reached].map((name) => byName.get(name)?.body)]
    .map((body) => balanceReads(body));
  return { own: reads.some((read) => read.own), other: reads.some((read) => read.other) };
}

/**
 * Marks every body that touches dynamic state, so the head derives the value's chunk-run coordinate from the
 * record block the frame declares and leaves it where the body reads it, rather than the body addressing the run
 * from the input it happens to run on.
 *
 * The body's own source fixes the answer, so it is read from the access nodes here. The footprint analysis cannot
 * answer at this point: collection and dynamic lowering value-thread those accesses through ordinary locals before
 * a per-call master is assessed, so the accesses are no longer state reads even though the nodes remain.
 */
function markDynamicStateBodies(contract: ContractNode): void {
  const dynamic = new Set(contract.stateVariables
    .filter((state) => state.isDynamic || state.isPacked || isDynamicStorageType(state.type))
    .map((state) => state.name));
  if (dynamic.size === 0) return;
  const functions = [
    contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions,
  ];
  for (const fn of functions) {
    if (fn === undefined || fn.usesDynamicChunkInputBase === true) continue;
    if (touchesDynamicState(fn.body, dynamic)) fn.usesDynamicChunkInputBase = true;
  }
}

/** True when the body names one of `dynamic` at a state access site. */
function touchesDynamicState(body: BlockNode, dynamic: ReadonlySet<string>): boolean {
  let found = false;
  walkInvocationAst(body, (node) => {
    if (found) return;
    const name = (node as { readonly name?: unknown }).name;
    if (typeof name !== 'string' || !dynamic.has(name)) return;
    if (node instanceof StateAccessNode || node instanceof StateAssignNode
      || node instanceof StateArrayPushNode || node instanceof StateArrayPopNode
      || node instanceof StateArrayAssignNode || node instanceof StateArrayDeleteNode) {
      found = true;
    }
  });
  return found;
}

/** Assesses whether the contract can be emitted as a per-call master program. */
export function assessPerCallMasterShape(input: PerCallMasterShapeInput): PerCallMasterShapeAssessment {
  const { contract } = input;
  markDynamicStateBodies(contract);
  const constants = contractConstantNames(contract);
  const refuse = (reason: string): PerCallMasterShapeAssessment => ({ supported: false, reason });
  if (contract.constructorDef) {
    // The constructor runs as one more selector-dispatched body behind the same head, so it is admitted exactly when
    // its body asks the head for nothing the head does not already carry: it makes no external call (the head's call
    // records are the entries'), it makes no send (the head fixes one send list for every body), and it needs no
    // side-car input the head does not locate. Its event count is pinned by its own body against the head's region.
    const refusal = unsupportedConstructorShape(contract.constructorDef, constants);
    if (refusal !== undefined) return refuse(refusal);
  }
  // receive() is an entry like any other: a per-call frame always carries call data, and a value send's carries the
  // selector of receive().
  const entryFunctions = [
    ...contract.functions.filter((fn) => fn.isEntryPoint),
    ...(contract.receiveDef ? [contract.receiveDef] : []),
  ];
  const stateVariableNames = new Set(contract.stateVariables.map((state) => state.name));
  // A fallback is an entry too: the proxy's takes the frame's whole call data as its parameter, and any other is
  // run, as the EVM runs it, for a selector no body has.
  const fallback = contract.fallbackDef ? [contract.fallbackDef] : [];
  const entryPoints = [...entryFunctions, ...fallback];
  if (entryPoints.length === 0) {
    return refuse('a master is reached by dispatching a selector, so a contract with no entry point is not supported');
  }
  // The bodies the master runs: the contract's functions, receive() and the fallback.
  const entryBodies: readonly FunctionDefinitionNode[] = [
    ...contract.functions, ...(contract.receiveDef ? [contract.receiveDef] : []), ...fallback,
  ];
  if (input.hasContractInstantiation) {
    return refuse('contract creation needs the witness `CREATE` checks, which are not emitted yet');
  }
  if (input.hasFunctionPointers) {
    return refuse('a function pointer needs a call kind the frame does not carry yet');
  }
  // A body the master cannot serve is refused on its own, so the functions it can serve keep compiling: the
  // reasons are collected per function here and published beside the artifact, and each refused entry is emitted
  // as a body that fails whenever it is reached.
  const refusals = new Map<string, string>();
  const refuseBody = (fn: FunctionDefinitionNode, reason: string): void => {
    if (!refusals.has(fn.name)) refusals.set(fn.name, reason);
  };
  const invokes = new Map<string, Set<string>>();
  for (const fn of entryBodies) invokes.set(fn.name, invokedFunctionNames(fn.body));
  // A body that is still invoked survives as its own subroutine definition, and a definition has no entry to bind
  // the call sites it makes: the records belong to the entry that runs the call, so a definition that makes one is
  // refused. A body the lowering folded into its call sites is not invoked and is not refused here; the entries
  // that invoke a refused one are refused with it by the closure below.
  const invoked = new Set<string>();
  for (const names of invokes.values()) for (const name of names) invoked.add(name);
  // The constructor runs the bodies it invokes as subroutines too.
  if (contract.constructorDef !== undefined) {
    for (const name of invokedFunctionNames(contract.constructorDef.body)) invoked.add(name);
  }
  // The refused bodies no selector reaches whose definitions code generation cannot emit.
  const entryNames = new Set(entryPoints.map((entry) => entry.name));
  const stubbed = new Set<string>();
  for (const fn of entryBodies) {
    // A hidden parameter is an operand the direct path expects from the SDK or from a co-spent input. The head
    // supplies the frame values itself and derives the batch operands it can, so any other hidden operand would be
    // read from the wrong stack position.
    // The reasons are asked in the order the whole-contract refusal used to ask them, so the one a reader sees
    // names the shape that decides the body rather than an operand that shape injects.
    if (input.assemblyBodies.has(fn.name)) {
      refuseBody(fn, 'inline assembly is not composed per-call');
    }
    const forward = forwardDelegateCalls(fn, stateVariableNames);
    if ('reason' in forward) refuseBody(fn, forward.reason);
    const batchShape = unsupportedBatchWriteShape(fn, constants);
    if (batchShape !== undefined) refuseBody(fn, batchShape);
    // A loop that reads a long value once per turn takes a list of values for one slot, and the block lists one.
    const perTurnValue = fn.parameters.find((parameter) =>
      VALUE_WITNESS_PARAMETER.test(parameter.name) && parameter.type instanceof ArrayType);
    if (perTurnValue !== undefined) {
      refuseBody(fn, `the body reads a long mapping value once per loop turn ('${perTurnValue.name}'), and the `
        + 'frame\'s block lists one value per slot');
    }
    const proxyMasterWitness = fn.parameters.find(
      (parameter) => parameter.name === PROXY_MASTER_WITNESS_PARAMETER);
    if (proxyMasterWitness !== undefined) {
      refuseBody(fn, 'a proxy implementation\'s entry: the direct convention hands it the co-spent proxy master\'s '
        + `input index through the hidden parameter '${proxyMasterWitness.name}', and a per-call master serves a `
        + 'delegate frame from the records its own frame declares instead');
    }
    const hidden = fn.parameters.filter((parameter) =>
      isUndeclaredHiddenParameter(fn, parameter.name, constants));
    if (hidden.length > 0) {
      refuseBody(fn, `the body carries the hidden parameter '${hidden[0].name}', which the master head does not `
        + 'supply');
    }
    // The head sizes its event and send regions by the bodies it serves, so a body whose own counts are
    // not values the source fixes is refused on its own rather than refusing the contract's other bodies.
    if ((fn.runtimeLoopEvents?.length ?? 0) > 0 || emitsFromLoop(fn)) {
      refuseBody(fn, 'an event emitted from a loop makes the event count depend on the loop, so the master cannot '
        + 'fix how many events the tail holds');
    }
    if ((fn.transferInfos?.length ?? 0) > 0 || (fn.runtimeLoopTransfers?.length ?? 0) > 0) {
      const sends = sendCountRefusal(fn);
      if (sends !== undefined) refuseBody(fn, sends);
    }
    if (fn.usesBlockhash || contract.usesBlockhash) {
      refuseBody(fn, 'a blockhash read needs a co-spent oracle input the master head does not locate');
    }
    // A straight-line keccak256 call reads its compute side-car at a fixed step past the frame's own input; a call
    // inside a loop reads as many as the loop turns.
    if (fn.keccakCompute && fn.keccakInLoop === true) {
      refuseBody(fn, 'a keccak256 call inside a loop reads one compute side-car per turn, which the master head does '
        + 'not locate a run-time number of');
    }
    // A recovery loop reads its pair per iteration from a run-time counter, which the head would have to place a
    // variable number of inputs for; the straight-line per-call pair is what the head locates.
    if (fn.ecrecoverLoopReads === true) {
      refuseBody(fn, 'an ecrecover loop reads one recovery side-car pair per iteration, which the master head does '
        + 'not locate a run-time number of');
    }
    if ((fn.externalCalls?.length ?? 0) > 0 && invoked.has(fn.name)) {
      refuseBody(fn, 'the body makes an external call and is invoked as its own subroutine, so the call sites it '
        + 'makes have no entry to bind their records to');
    }
    // A balance is the value of containers a transaction spends; another address's shows only in the inputs its
    // transaction happens to spend, which is no account balance at all.
    const reads = balanceReads(fn.body);
    if (reads.other) {
      refuseBody(fn, 'the body reads the balance of an address other than its own, which a transaction shows only '
        + 'in the inputs it spends');
    }
    if (reads.own && invoked.has(fn.name)) {
      refuseBody(fn, 'the body reads its contract\'s balance and is invoked as its own subroutine, which has no '
        + 'frame to read it from');
      // A definition no selector reaches is emitted for the bodies that invoke it, and it has no frame to read the
      // balance from, so it is emitted as a refusal stub; the bodies that run it are refused with it.
      if (!entryNames.has(fn.name)) stubbed.add(fn.name);
    }
  }
  // The constructor runs only at its genesis, and no genesis shows a balance: another address's shows only in the
  // inputs a transaction spends, and the contract's own is the containers a transaction spends beside one of its
  // masters, which do not exist before the genesis. A read the constructor makes, itself or through a body it runs,
  // is refused by name rather than answered with the inputs a genesis happens to carry.
  if (contract.constructorDef !== undefined) {
    const reads = constructorBalanceReads(contract.constructorDef, entryBodies, invokes);
    if (reads.other) {
      refuseBody(contract.constructorDef, 'the constructor reads the balance of an address other than its own, '
        + 'which a transaction shows only in the inputs it spends');
    } else if (reads.own) {
      refuseBody(contract.constructorDef, 'the constructor reads its contract\'s balance, which no genesis shows: '
        + 'the balance is the containers a transaction spends beside a master of the contract, and the contract '
        + 'has no master before its genesis');
    }
  }
  // The entries that read their own balance, through any body they reach.
  const readsOwn = new Set(entryBodies.filter((fn) => balanceReads(fn.body).own).map((fn) => fn.name));
  const reachesReader = (name: string, seen: Set<string> = new Set()): boolean => {
    if (readsOwn.has(name)) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return [...(invokes.get(name) ?? [])].some((next) => reachesReader(next, seen));
  };
  const balanceReaders = [...entryPoints, ...(contract.constructorDef ? [contract.constructorDef] : [])]
    .filter((fn) => reachesReader(fn.name))
    .map((fn) => fn.name);
  // The head parks the frame's `retval` whenever any entry returns a value; a returning entry compares the value
  // its own code computed against it, and a void entry requires it empty. Each returning entry's shape is checked
  // one by one.
  for (const entry of entryPoints) {
    if (entry.returnTypes.length === 0) continue;
    const shape = unsupportedReturnShape(entry);
    if (shape !== undefined) refuseBody(entry, shape);
  }
  // A body the master serves as a subroutine derives its own sorted-batch operands from the segment its own code's
  // calls name, and a call closes the segment the code before it runs in. A self-call is a subroutine rather than a
  // record, so it closes no segment: the body's count is right exactly while the frame that invokes it is in the
  // segment that count names. A caller that has already made an external call invokes it in a later one, so the
  // body is refused by the name of the call rather than composed into a frame that cannot settle. A call the
  // caller makes *after* the invocation does not move the write, and a body whose own write precedes every call of
  // its own is placed by its own code alone; a body that reads the frame's whole declared call count instead needs
  // the whole frame to make no further call, which no caller can show here, so it is refused wherever the caller's
  // calls sit.
  for (const [caller, names] of invokes) {
    const callerBody = entryPoints.find((entry) => entry.name === caller);
    if (callerBody === undefined || refusals.has(caller) || !reachesExternalCall(callerBody.body)) continue;
    for (const name of names) {
      const fn = entryPoints.find((entry) => entry.name === name);
      if (fn === undefined || refusals.has(name)) continue;
      if (derivableBatchWitnessNames(fn, constants) === undefined) continue;
      const placedByItsOwnCode = perCallBatchWriteSegment(fn) !== undefined;
      if (placedByItsOwnCode && !invokeFollowsCall(callerBody, new Set([name]))) continue;
      refuseBody(fn, placedByItsOwnCode
        ? `the body derives a verified-mapping write and is invoked by '${caller}' after an external call: a `
          + 'subroutine reads the segment its own code names, and the caller\'s call puts the write in a later one'
        : `the body derives a verified-mapping write whose segment is the frame's whole call count, and is invoked `
          + `by '${caller}', which makes external calls`);
    }
  }
  // An entry that reaches a body the master cannot serve is refused itself: the body it would run is a refusal, so
  // the entry could never settle. The reach is what makes this a closure rather than a list. The constructor is
  // dispatched behind the same head and closed over the same way, so its genesis answers with the refusal.
  const reaches = contract.constructorDef === undefined ? invokes : new Map([
    ...invokes, [contract.constructorDef.name, invokedFunctionNames(contract.constructorDef.body)],
  ]);
  const refusedClosure = closeRefusalsOverInvocations(reaches, refusals);
  for (const body of [...entryPoints, ...(contract.constructorDef ? [contract.constructorDef] : [])]) {
    const reached = refusedClosure.get(body.name);
    if (reached !== undefined) {
      refuseBody(body, `it runs '${reached.name}', which the master cannot serve: ${reached.reason}`);
    }
  }
  const served = entryPoints.filter((entry) => !refusals.has(entry.name));

  const calls = derivePerCallMasterCallSites(input.interfaces, served, stateVariableNames);
  for (const [entryName, reason] of calls.refusals) refuseBody(
    entryPoints.find((entry) => entry.name === entryName)!, reason,
  );
  const servedWithCalls = served.filter((entry) => !refusals.has(entry.name));
  // A derived mapping write is settled in the segment its records are declared in, and a call closes the segment
  // the code before it runs in. The derivation reads the write's own segment, so a write a call precedes is served
  // like one that precedes every call. A write whose segment a varying call decides is served when every call
  // precedes it — the segment is then the block's own declared call count — and refused otherwise.
  if (calls.callCount > 0) {
    for (const fn of [...servedWithCalls, ...(contract.constructorDef ? [contract.constructorDef] : [])]) {
      if (derivableBatchWitnessNames(fn, constants) === undefined) continue;
      if (perCallBatchWriteSegment(fn) !== undefined) continue;
      if (perCallBatchWriteFollowsEveryCall(fn)) continue;
      refuseBody(fn, 'a verified-mapping write is derived from the segment its own code runs in, but the master '
        + 'makes external calls and the write does not precede them, so the segment the write lands in is a fact '
        + 'the derivation does not read');
    }
  }
  const bodies = [
    ...entryPoints.filter((entry) => !refusals.has(entry.name)),
    ...(contract.constructorDef ? [contract.constructorDef] : []),
  ];
  // The bodies the master serves still have to agree on one tail shape: the head fixes the event region's size and
  // one send count for every body behind its dispatcher. A body whose own counts vary is refused above, so what
  // remains here is the count the served bodies share.
  const tail = derivePerCallTailShape(
    bodies,
    undefined,
    // An emit the survey found belongs to a body; the bodies the master serves are the ones whose emits it has to
    // account for, since a refused body's emit is part of what refuses it.
    bodies.some((body) => (body.emitInfos?.length ?? 0) > 0),
  );
  if (tail.reason !== undefined) return refuse(tail.reason);
  const entryCalls = calls.entryCalls.filter((entry) => !refusals.has(entry.entryName));
  // The head fixes one call count for every body behind its dispatcher, and a refused body is emitted as a stub
  // that makes no call, so the count is the served bodies' bound rather than every entry the call-site pass
  // measured. Taking the unfiltered count would leave the head refusing the standalone frame a served master is
  // entitled to when the only call-making entries are the refused ones.
  const callCount = Math.max(0, ...entryCalls.map((entry) => entry.pathCount ?? entry.calls.length));
  const stubbedDefinitions = [...stubbed].map((name) => ({ name, reason: refusals.get(name)! }));
  if (entryCalls.length === 0 && contract.constructorDef === undefined) {
    // Every body is refused, so the master would dispatch only to refusals. That is still a contract whose
    // functions are each reported by name, which is what a builder needs to say which shape is missing.
    return {
      supported: true,
      entryCalls,
      callCount: 0,
      tail: tail.tail,
      ...(refusals.size > 0 ? { refusedEntries: renderRefusals(contract, entryPoints, refusals) } : {}),
      ...(balanceReaders.length > 0 ? { balanceReaders } : {}),
      ...(stubbedDefinitions.length > 0 ? { stubbedDefinitions } : {}),
    };
  }
  return {
    supported: true,
    entryCalls,
    callCount,
    tail: tail.tail,
    ...(refusals.size > 0 ? { refusedEntries: renderRefusals(contract, entryPoints, refusals) } : {}),
    ...(balanceReaders.length > 0 ? { balanceReaders } : {}),
    ...(stubbedDefinitions.length > 0 ? { stubbedDefinitions } : {}),
  };
}

/** The refusals as the entry list the assessment publishes, in entry order. */
function renderRefusals(
  contract: ContractNode,
  entryPoints: readonly FunctionDefinitionNode[],
  refusals: ReadonlyMap<string, string>,
): readonly { readonly entryName: string; readonly reason: string }[] {
  // The constructor is dispatched like an entry behind the same head, so a refusal it carries is published beside
  // the entries': a builder reads which body of the contract is unsupported, and the constructor is one.
  return [...(contract.constructorDef ? [contract.constructorDef] : []), ...entryPoints]
    .filter((body) => refusals.has(body.name))
    .map((body) => ({ entryName: body.name, reason: refusals.get(body.name)! }));
}

interface RefusedBody {
  readonly name: string;
  readonly reason: string;
}

/**
 * True when a body reaches a call to one of `callees` after making an external call on some path.
 *
 * A subroutine derives its sorted-batch operands from the segment its own code's call count names, which is the
 * segment the invocation runs in. A call the caller has already made closes that segment, so the write lands in a
 * later one; a call the caller makes after the invocation leaves the write where the invocation ran, which is why
 * only the calls that precede the site decide it. A call only some paths take still counts: the execution that took
 * that arm reaches the invocation in the later segment. The walk joins a branch's arms and treats a loop or switch
 * that reaches a call as an open count, the same way the write's own segment is walked.
 */
function invokeFollowsCall(entry: FunctionDefinitionNode, callees: ReadonlySet<string>): boolean {
  let found = false;
  const walkBlock = (block: BlockNode | undefined, incoming: CallRange): CallRange => {
    let range = incoming;
    for (const statement of block?.statements ?? []) {
      if (found) return range;
      range = walkStatement(statement, range);
    }
    return range;
  };
  const walkStatement = (statement: Node, incoming: CallRange): CallRange => {
    if (statement instanceof FunctionCallStatementNode) {
      const callee = statement.call.resolvedFunction?.name;
      // Any path that could have made a call already moves the write, so a call that only some paths take refuses
      // the body too: the range is joined over a branch's arms, and `most` is what some path reached.
      if (callee !== undefined && callees.has(callee)
        && (incoming === undefined || incoming.most >= 1)) {
        found = true;
      }
      return advanceCallRange(incoming, statement);
    }
    if (statement instanceof BranchNode) {
      const afterCondition = advanceCallRange(incoming, statement.condition);
      const thenRange = walkBlock(statement.ifBlock, afterCondition);
      const elseRange = statement.elseBlock === undefined
        ? afterCondition
        : walkBlock(statement.elseBlock, afterCondition);
      return joinCallRanges(thenRange, elseRange);
    }
    if (statement instanceof BlockNode) return walkBlock(statement, incoming);
    if (statement instanceof SwitchNode || statement instanceof CollectionIterationNode
      || statement instanceof WhileNode || statement instanceof DoWhileNode) {
      // A loop, switch or iteration makes a number of calls its own bound decides; a call-free one makes none.
      return reachesExternalCall(statement) ? undefined : incoming;
    }
    if (statement instanceof TryCatchNode) {
      // A catch block is not an executable path, matching the invocation walk.
      return walkBlock(statement.tryBlock, advanceCallRange(incoming, statement.expression));
    }
    return advanceCallRange(incoming, statement);
  };
  walkBlock(entry.body, { least: 0, most: 0 });
  return found;
}

/**
 * The bodies an entry reaches that the master cannot serve, one per entry, or nothing when it is self-contained.
 *
 * A body the master cannot emit is emitted as a refusal instead, so an entry that invokes it can never settle: the
 * relation is transitive, which is what makes the closure a walk over the invocations rather than a list.
 */
function closeRefusalsOverInvocations(
  invokes: ReadonlyMap<string, ReadonlySet<string>>,
  refusals: ReadonlyMap<string, string>,
): Map<string, RefusedBody> {
  const reached = new Map<string, RefusedBody>();
  for (const entry of invokes.keys()) {
    const seen = new Set<string>();
    const pending = [...(invokes.get(entry) ?? [])];
    let found: RefusedBody | undefined;
    while (pending.length > 0 && found === undefined) {
      const name = pending.pop()!;
      if (seen.has(name)) continue;
      seen.add(name);
      const reason = refusals.get(name);
      if (reason !== undefined) {
        found = { name, reason };
        break;
      }
      for (const next of invokes.get(name) ?? []) pending.push(next);
    }
    if (found !== undefined) reached.set(entry, found);
  }
  return reached;
}

/**
 * The names of the contract's own functions a body invokes, as code generation reaches them.
 *
 * Lowering turns an internal call into an indirect invocation, so the callee a call reaches is named either on the
 * call itself or by the reference the call's identifier carries; reading both is what keeps this walk to the edges
 * code generation actually emits, so a body the master emits as its own subroutine is recognised as invoked.
 */
function invokedFunctionNames(body: BlockNode | undefined): Set<string> {
  const names = new Set<string>();
  walkInvocationAst(body, (node) => {
    if (node instanceof FunctionCallNode) {
      const target = node.resolvedFunction;
      if (target?.name !== undefined) names.add(target.name);
    }
    if (node instanceof IdentifierNode) {
      const target = node.functionReference;
      if (target?.name !== undefined) names.add(target.name);
    }
  });
  return names;
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
  if (constructorDef.keccakCompute) {
    return 'the constructor runs a keccak compute side-car, which needs co-spent inputs the master head does not locate';
  }
  return undefined;
}

/**
 * Why an entry's return shape cannot be settled against the witness `retval`, or undefined for the admitted one.
 *
 * A frame's `retval` holds the bytes the execution returned, and the entry's own code compares them against the
 * blob its `return` built. The blob is one byte string whether the entry returns one value or several: a tuple's
 * canonical encoding is the concatenation of its values' own encodings, which is the same encoding a call's
 * arguments go through, so every value of the return has to be one the entry's code produces as part of that
 * blob. A composite value is the refusal.
 */
function unsupportedReturnShape(entry: FunctionDefinitionNode): string | undefined {
  const composite = entry.returnTypes.find((type) => !holdsAsOneEncodedItem(type));
  if (composite === undefined) return undefined;
  const among = entry.returnTypes.length > 1 ? ' among its values' : '';
  return `the entry point '${entry.name}' returns ${compositeTypeName(composite)}${among}, but a frame's `
    + '`retval` is compared with one scalar value the entry computed, which a composite value is not yet';
}

/**
 * True when a value of `type` is one item on the stack whose encoding a `return` leaves as the compared blob.
 *
 * A scalar is its own encoding. An array and a struct are values the language holds already encoded: under a
 * Solidity import the entry's `return` writes the ABI encoding of their members, and otherwise an array is its
 * length-prefixed packed elements and a struct the pushdata blob of its fields. Either way the entry's `return`
 * leaves exactly the bytes the frame's `retval` holds, so the comparison is the same one a scalar return makes. A
 * tuple, a mapping, a function pointer and a token container are several items or an encoding the body does not
 * produce.
 */
function holdsAsOneEncodedItem(type: Type): boolean {
  const resolved = type instanceof ValueType ? type.underlyingType : type;
  return isScalarArgumentType(resolved) || resolved instanceof ArrayType || resolved instanceof StructType;
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
 * Why a body's value sends cannot share the master's one send region, or undefined when they can.
 *
 * The head fixes one send region for every body it runs, so a send's position in it is a fact of the source
 * rather than of the execution. A send inside a loop makes as many as the loop turns and reaches no fixed
 * position, so it is refused. A send on one branch of a conditional keeps its position and simply does not happen
 * on the other arm: the body requires its slot to hold the no-index sentinel there, so the region states which
 * sends an execution actually made.
 */
function sendCountRefusal(body: FunctionDefinitionNode): string | undefined {
  if ((body.runtimeLoopTransfers?.length ?? 0) > 0 || sendsFromLoop(body)) {
    return 'a value send inside a loop makes the send count depend on the loop, so the master cannot fix how many '
      + 'sends the tail holds';
  }
  return undefined;
}

/** True when a value send sits inside a loop, so its position in the send region is not fixed by the source. */
function sendsFromLoop(body: FunctionDefinitionNode): boolean {
  let found = false;
  walkInvocationAst(body.body, (node) => {
    if (found || !(node instanceof WhileNode || node instanceof DoWhileNode)) return;
    if (countTransfersMinMax(node).max > 0) found = true;
  });
  return found;
}

/**
 * The sends a body's region holds, in the order its transfer statements number them.
 *
 * A transfer statement is one slot whether or not the execution reaches it, so the region's size is the source's
 * own count of them; the body's verification tells a taken slot from an untaken one.
 */
function bodySendSlots(body: FunctionDefinitionNode): number {
  return body.transferInfos?.length ?? 0;
}

/**
 * Derives the event-region size and send count a master's tail has to declare, from the bodies the master runs.
 *
 * A master has one head that parks a fixed-size event region, so the region is as large as the largest number of
 * events any body emits; each body pins its own emit count against the block's declared count, so two bodies may
 * emit different numbers. The constructor runs as one more body behind the head and counts here with the entries.
 * A body that emits from a loop leaves its count to the loop, which the head cannot fix. A listed send's recipient
 * lock is a run-time value, so the tail cannot check the output's shape; the body that computed the send pins the
 * lock and the value it computed at the listed output, and the region is as wide as the most sends any body lists.
 * A send inside a loop reaches no fixed position and is refused. Segments are not fixed here: the records a segment
 * touches are decided by settlement, so the head walks each segment's declared count.
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
      const sends = sendCountRefusal(body);
      if (sends !== undefined) return { reason: sends };
    }
  }
  // Every body's transfers take the region's first positions in their own source order, and a body that lists
  // fewer requires the no-index sentinel at the positions past its own, so bodies may list different numbers.
  const sendCount = Math.max(0, ...bodies.map((body) => bodySendSlots(body)));
  const valueWitnessCount = Math.max(0, ...bodies.map((body) => valueWitnessSlotsOf(body)));
  return { tail: { maxEventCount, sendCount, valueWitnessCount } };
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
type CallSitesDerivation = {
  readonly supported: true;
  readonly entryCalls: readonly PerCallEntryCallSites[];
  readonly callCount: number;
  /** The entries whose calls the head cannot check, by name, each with the reason. */
  readonly refusals: ReadonlyMap<string, string>;
};

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
  stateVariables: ReadonlySet<string>,
): CallSitesDerivation {
  const entryCalls: PerCallEntryCallSites[] = [];
  const refusals = new Map<string, string>();
  for (const entry of entryPoints) {
    const derived = deriveEntryCallSites(interfaces, entry, stateVariables);
    if (derived.reason !== undefined) {
      refusals.set(entry.name, derived.reason);
      continue;
    }
    const writeSegment = perCallWriteSegment(entry);
    const writeSegments = perCallWriteSegments(entry);
    entryCalls.push({
      entryName: entry.name,
      calls: derived.calls,
      pathCount: derived.pathCount,
      ...(callsRepeat(entry.body) ? { repeats: true } : {}),
      ...(writeSegment === undefined ? {} : { writeSegment }),
      ...(writeSegments === undefined ? {} : { writeSegments }),
    });
  }
  // The bound the head holds is how many records the body with the most calls declares, which is a path count
  // rather than a descriptor list: a body whose arms each call names one descriptor per arm while its execution
  // makes one call. The head reads the count each block declares and every body pins it to its own, so bodies may
  // make different numbers of calls; the bound is what says whether the master can make a call at all.
  const callCount = Math.max(0, ...entryCalls.map((entry) => entry.pathCount ?? entry.calls.length));
  return { supported: true, entryCalls, callCount, refusals };
}

/**
 * True when a body reaches an external call inside a loop.
 *
 * Such a body makes a run-time number of calls: the trip count decides how many records the execution declares
 * and which segment a read after the loop resolves against, so neither position is one the compiler can fix.
 */
export function callsRepeat(block: BlockNode | undefined): boolean {
  let repeats = false;
  walkInvocationAst(block, (node) => {
    if (repeats || !(node instanceof WhileNode || node instanceof DoWhileNode)) return;
    walkInvocationAst(node, (inner) => {
      if (inner instanceof ExternalFunctionCallNode) repeats = true;
    });
  });
  return repeats;
}

/**
 * True when a body makes a different number of calls on different paths.
 *
 * A loop that reaches a call makes as many as its trip count says, and a branch whose arms make different numbers
 * leaves the count to the arm that runs. Both leave the record positions to the execution, so the body carries how
 * many calls it has made rather than addressing records by a fixed position; a body whose paths all make the same
 * number keeps the fixed positions the head checks, so its emitted bytes are unchanged. A loop or a branch that
 * reaches no call does not change the count. A call in an operand the code evaluates only on some paths - the right
 * operand of `&&` or `||`, or an arm of a conditional expression - is skipped when the rest decides the value, so it
 * varies the count as a branch arm does.
 */
export function callsVaryOnPaths(block: BlockNode | undefined): boolean {
  const range = callCountRange(block);
  return range === undefined || range.least !== range.most || reachesLazilyEvaluatedCall(block);
}

/** True when a call sits in the right operand of `&&` or `||`, or in an arm of a conditional expression. */
function reachesLazilyEvaluatedCall(block: BlockNode | undefined): boolean {
  let reaches = false;
  walkInvocationAst(block, (node) => {
    if (reaches) return;
    if (node instanceof BinaryOpNode
      && (node.operator === BinaryOperator.AND || node.operator === BinaryOperator.OR)) {
      reaches = reachesCallRecord(node.right);
    } else if (node instanceof TernaryOpNode) {
      reaches = reachesCallRecord(node.ifTrue) || reachesCallRecord(node.ifFalse);
    }
  });
  return reaches;
}

/** True when a node reaches a call that binds a witness record, the kinds `callsIn` counts. */
function reachesCallRecord(value: unknown): boolean {
  let reaches = false;
  walkInvocationAst(value, (node) => {
    if (node instanceof ExternalFunctionCallNode || node instanceof LowLevelCallStatementNode
      || node instanceof LowLevelCallNode) {
      reaches = true;
    }
  });
  return reaches;
}

/** The fewest and most calls a block makes on any one path, or undefined when a construct leaves the count open. */
function callCountRange(block: BlockNode | undefined): { least: number; most: number } | undefined {
  let least = 0;
  let most = 0;
  for (const statement of block?.statements ?? []) {
    const range = statementCallRange(statement);
    if (range === undefined) return undefined;
    least += range.least;
    most += range.most;
  }
  return { least, most };
}

/** The fewest and most calls one statement makes on any one path, or undefined when it leaves the count open. */
function statementCallRange(statement: Node): { least: number; most: number } | undefined {
  if (statement instanceof BranchNode) {
    const inCondition = callsInExpression(statement.condition);
    const inIf = callCountRange(statement.ifBlock);
    const inElse = statement.elseBlock === undefined
      ? { least: 0, most: 0 }
      : callCountRange(statement.elseBlock);
    if (inCondition === undefined || inIf === undefined || inElse === undefined) return undefined;
    return {
      least: inCondition + Math.min(inIf.least, inElse.least),
      most: inCondition + Math.max(inIf.most, inElse.most),
    };
  }
  if (statement instanceof BlockNode) return callCountRange(statement);
  if (statement instanceof WhileNode || statement instanceof DoWhileNode) {
    // A loop whose condition or body reaches a call makes a run-time number of them; one that reaches none makes
    // none on any path.
    if (reachesExternalCall(statement.block) || reachesExternalCall(statement.condition)) return undefined;
    return { least: 0, most: 0 };
  }
  if (statement instanceof SwitchNode) {
    // A switch's arms need not agree, so one that reaches a call leaves the count open.
    return reachesExternalCall(statement) ? undefined : { least: 0, most: 0 };
  }
  if (statement instanceof CollectionIterationNode) {
    return reachesExternalCall(statement.body) ? undefined : { least: 0, most: 0 };
  }
  if (statement instanceof TryCatchNode) {
    // A catch block is not an executable path, matching the invocation walk.
    const inExpression = callsInExpression(statement.expression);
    const inTry = callCountRange(statement.tryBlock);
    if (inExpression === undefined || inTry === undefined) return undefined;
    return { least: inExpression + inTry.least, most: inExpression + inTry.most };
  }
  // Any other statement makes the calls its own expression reaches, all of them on every path.
  const own = callsInExpression(statement);
  return own === undefined ? undefined : { least: own, most: own };
}

/** How many calls an expression reaches, or undefined when a branch or loop inside it decides the count. */
function callsInExpression(value: unknown): number | undefined {
  const own = callsIn(value, [], 0);
  return typeof own === 'number' ? own : undefined;
}

/** True when a node reaches an external call anywhere inside it. */
function reachesExternalCall(value: unknown): boolean {
  let reaches = false;
  walkInvocationAst(value, (node) => {
    if (node instanceof ExternalFunctionCallNode) reaches = true;
  });
  return reaches;
}

/**
 * The external-call source nodes a body reaches inside a loop, whatever the loop is nested in.
 *
 * A loop's own calls are the ones one execution reaches a number of times, so their records are not a fixed set
 * the head can enumerate. A body may also make calls outside the loop — before it, between two of them — and those
 * are reached once at a position the head checks, so they are not marked. Matching the slots by their source node
 * keeps the marking to the calls the walk actually reached inside a loop rather than to every call of the body.
 */
function loopNestedCallNodes(block: BlockNode | undefined): ReadonlySet<Node> {
  const nested = new Set<Node>();
  walkInvocationAst(block, (node) => {
    if (!(node instanceof WhileNode || node instanceof DoWhileNode)) return;
    walkInvocationAst(node, (inner) => {
      if (inner instanceof ExternalFunctionCallNode
        || inner instanceof LowLevelCallStatementNode || inner instanceof LowLevelCallNode) {
        nested.add(inner);
      }
    });
  });
  return nested;
}

/**
 * Why the source does not fix how many calls a body makes: the statement the walk could not count.
 *
 * Each kind is named so a refusal can say what the shape actually is rather than call every one of them
 * conditional: an arm pair that makes different numbers of calls is a branch, a trip count the source does not fix
 * is a loop, and a switch is a set of arms that need not agree.
 */
export type CallSetDivergence = 'arms' | 'loop' | 'switch' | 'nested';

/** How many calls a body makes on every path, and where each one sits, or why the source does not fix that. */
export type CallSetDerivation =
  | { readonly pathCount: number; readonly calls: readonly number[] }
  | { readonly divergence: CallSetDivergence };

/**
 * How many calls a body makes on every path, and where each one sits.
 *
 * A body binds its own calls: the k-th call of the execution is the k-th record, and the code after it resumes in
 * segment k + 1. Both are positions in the execution rather than in the source, so a call inside a branch sits at
 * the same position on either arm — the record and the segment the code after the branch uses are facts of every
 * path only while the paths agree on how many calls came before. A loop's trip count is a run-time value, and a
 * switch's arms need not agree, so both are answered as a divergence rather than counted; a catch block is not an
 * executable path, which is the same reading the invocation walk takes.
 *
 * `calls[i]` is the position of the i-th call the source reaches, in the order the walk reaches it: a branch's
 * condition, then its arms as the source writes them.
 */
export function callsOnEveryPath(block: BlockNode | undefined): CallSetDerivation {
  const calls: number[] = [];
  const pathCount = countCallsOnEveryPath(block, calls, 0);
  return typeof pathCount === 'number' ? { pathCount, calls } : { divergence: pathCount };
}

/** The walking half of {@link callsOnEveryPath}, which records each call's position as the walk reaches it. */
function countCallsOnEveryPath(block: BlockNode | undefined, calls: number[], base: number): number | CallSetDivergence {
  let total = 0;
  for (const statement of block?.statements ?? []) {
    if (statement instanceof BranchNode) {
      // The arms run exclusively, so each is reached at the same position: the one the branch starts at, after the
      // condition's own calls. They have to end at the same place for the code after the branch to have a position.
      const inCondition = callsIn(statement.condition, calls, base + total);
      if (typeof inCondition !== 'number') return inCondition;
      const armBase = base + total + inCondition;
      const inIf = countCallsOnEveryPath(statement.ifBlock, calls, armBase);
      const inElse = statement.elseBlock === undefined
        ? 0
        : countCallsOnEveryPath(statement.elseBlock, calls, armBase);
      if (typeof inIf !== 'number') return inIf;
      if (typeof inElse !== 'number') return inElse;
      if (inIf !== inElse) return 'arms';
      total += inCondition + inIf;
      continue;
    }
    if (statement instanceof BlockNode) {
      const inner = countCallsOnEveryPath(statement, calls, base + total);
      if (typeof inner !== 'number') return inner;
      total += inner;
      continue;
    }
    if (statement instanceof SwitchNode) return 'switch';
    if (statement instanceof WhileNode || statement instanceof DoWhileNode) return 'loop';
    if (statement instanceof TryCatchNode) {
      const inExpression = callsIn(statement.expression, calls, base + total);
      if (typeof inExpression !== 'number') return inExpression;
      const inTry = statement.tryBlock === undefined
        ? 0
        : countCallsOnEveryPath(statement.tryBlock, calls, base + total + inExpression);
      if (typeof inTry !== 'number') return inTry;
      total += inExpression + inTry;
      continue;
    }
    const own = callsIn(statement, calls, base + total);
    if (typeof own !== 'number') return own;
    total += own;
  }
  return total;
}

/**
 * The calls one statement makes outside any nested block, or the divergence it contains.
 *
 * Their positions are contiguous from `base`, in the order the invocation walk reaches them.
 */
function callsIn(value: unknown, calls: number[], base: number): number | CallSetDivergence {
  let found = 0;
  let structured: CallSetDivergence | undefined;
  walkInvocationAst(value, (node) => {
    // A low-level forwarded delegatecall is a call the execution records too: the site binds its `DELEGATE` record
    // where the source makes it, so it occupies a position like any external call.
    if (node instanceof ExternalFunctionCallNode
      || node instanceof LowLevelCallStatementNode
      || node instanceof LowLevelCallNode) {
      calls.push(base + found);
      found += 1;
    } else if (node instanceof SwitchNode) structured ??= 'switch';
    else if (node instanceof WhileNode || node instanceof DoWhileNode) structured ??= 'loop';
    else if (node instanceof BranchNode) structured ??= 'nested';
  });
  return structured ?? found;
}

/**
 * The shapes whose call count the source does not fix and the run-time position mode does not carry.
 *
 * A loop that reaches a call and a branch whose arms make different numbers of calls are both carried: the body
 * binds the record the number of calls it has made names. What remains is a construct the walk cannot even count
 * through, so the phrase says which statement it was.
 */
type RefusedDivergence = Extract<CallSetDivergence, 'switch' | 'nested'>;

/**
 * How a refusal describes a body whose call set the source does not fix.
 *
 * The phrase says which statement the walk could not count, so a reader is not told a call is conditional when it
 * is the trip count of a loop that is the open question.
 */
function divergencePhrase(divergence: RefusedDivergence): string {
  switch (divergence) {
    case 'switch':
      return 'is in a body that switches, and its arms need not make the same number of calls';
    case 'nested':
      return 'is in a body whose call count a branch or a loop in an expression decides';
  }
}

/** A low-level delegatecall that hands the entry's own received call data to an address the caller's code holds. */
interface ForwardDelegateCall {
  /** The index the low-level call carries among the entry's low-level calls. */
  readonly callIndex: number;
}

/** Why a low-level call whose shape a per-call master does not bind is refused. */
const LOW_LEVEL_CALL_REFUSAL =
  'a low-level call needs the witness `calls[]` checks, which are not emitted yet';

/**
 * The entry's low-level delegatecalls that forward its own call data, or the fact that stops the shape.
 *
 * A proxy's fallback is one such call: `implementation.delegatecall(input)`, where `input` is the fallback's own
 * calldata parameter and `implementation` is an address the contract holds. The callee's selector and argument
 * values are the caller's own received bytes, so neither is a value the caller's code knows at compile time; the
 * site checks the callee's call data against the digest the caller computes from those bytes instead.
 *
 * Nothing wider is admitted: a delegatecall the site cannot bind to the entry's own received call data and to an
 * address the contract holds would let a record describe call data the callee never saw, so it stays refused.
 */
function forwardDelegateCalls(
  entry: FunctionDefinitionNode,
  stateVariables: ReadonlySet<string>,
): readonly ForwardDelegateCall[] | { readonly reason: string } {
  const lowLevel = entry.lowLevelCalls ?? [];
  if (lowLevel.length === 0) return [];
  const forwards: ForwardDelegateCall[] = [];
  for (const [index, call] of lowLevel.entries()) {
    if (call.callMode !== 'delegatecall') {
      return { reason: LOW_LEVEL_CALL_REFUSAL };
    }
    const node = lowLevelCallNode(entry, index);
    if (node === undefined) {
      return { reason: `the body's low-level call ${index} has no node to read its target and call data from` };
    }
    if (!isForwardedDelegate(entry, node, stateVariables)) {
      return { reason: LOW_LEVEL_CALL_REFUSAL };
    }
    forwards.push({ callIndex: index });
  }
  return forwards;
}

/**
 * True when the contract is the proxy shape: its fallback is the only body a call can reach, and it forwards its own
 * received call data to an address the contract holds. The head then leaves the call data as the fallback's one
 * parameter instead of dispatching.
 */
export function isProxyFallbackContract(contract: ContractNode): boolean {
  if (contract.fallbackDef === undefined || contract.receiveDef !== undefined
    || contract.constructorDef !== undefined || contract.functions.some((fn) => fn.isEntryPoint)) {
    return false;
  }
  return isForwardingFallback(contract.fallbackDef, new Set(contract.stateVariables.map((state) => state.name)));
}

/** True when a fallback is exactly the proxy shape the convention serves: one forwarded delegatecall to state. */
function isForwardingFallback(
  fallback: FunctionDefinitionNode,
  stateVariables: ReadonlySet<string>,
): boolean {
  const forwards = forwardDelegateCalls(fallback, stateVariables);
  return !('reason' in forwards) && forwards.length === 1;
}

/**
 * True when a low-level call is the proxy's forwarded delegatecall.
 *
 * Three facts decide it: the entry is a fallback, whose sole parameter is the call data it received; the call's
 * data operand is exactly that parameter, so the call data the callee runs is the bytes the caller received; and
 * the target is an address the contract itself holds, which binds the `DELEGATE` record's target to the code that
 * runs. Anything else — a constant or computed payload, a copied local, an ordinary function's argument, a target
 * the caller supplies — describes a call the entry's own code did not receive, and is refused.
 */
function isForwardedDelegate(
  entry: FunctionDefinitionNode,
  node: LowLevelCallStatementNode | LowLevelCallNode,
  stateVariables: ReadonlySet<string>,
): boolean {
  if (entry.isFallback !== true) return false;
  const received = entry.parameters[0]?.name;
  const data = node.data;
  if (received === undefined || !(data instanceof IdentifierNode) || data.name !== received) return false;
  return namesStateVariable(node.targetExpression, stateVariables);
}

/** True when the target expression names one of the contract's own state variables. */
function namesStateVariable(target: ExpressionNode, stateVariables: ReadonlySet<string>): boolean {
  const name = target instanceof IdentifierNode || target instanceof StateAccessNode ? target.name : undefined;
  return name !== undefined && stateVariables.has(name);
}

/** The low-level call node the entry carries at `index`, or undefined when the walk does not reach one. */
function lowLevelCallNode(
  entry: FunctionDefinitionNode,
  index: number,
): LowLevelCallStatementNode | LowLevelCallNode | undefined {
  let found: LowLevelCallStatementNode | LowLevelCallNode | undefined;
  walkInvocationAst(entry.body, (node) => {
    if (found !== undefined) return;
    if ((node instanceof LowLevelCallStatementNode || node instanceof LowLevelCallNode)
      && node.callIndex === index) {
      found = node;
    }
  });
  return found;
}

/** The call sites one entry makes, or why the head cannot check them. */
function deriveEntryCallSites(
  interfaces: readonly InterfaceNode[],
  entry: FunctionDefinitionNode,
  stateVariables: ReadonlySet<string>,
): { calls: MasterCallSite[]; reason?: string; pathCount?: number } {
  const forwards = forwardDelegateCalls(entry, stateVariables);
  if ('reason' in forwards) return { calls: [], reason: forwards.reason };
  if (forwards.length > 0 && (entry.externalCalls?.length ?? 0) > 0) {
    return { calls: [], reason: 'the body both forwards its own call data and makes a typed external call, and a '
      + 'master binds one call list whose records the frame fixes in execution order' };
  }
  const calls: MasterCallSite[] = [];
  // The position each call sits at, which the same walk answers for the whole body: a descriptor's place in this
  // list is not its place in the execution once arms can share one.
  const walk = callsOnEveryPath(entry.body);
  const positions = 'calls' in walk ? walk.calls : undefined;
  const varying = callsVaryOnPaths(entry.body);
  // A forwarded delegatecall binds the caller's own received call data, and its site is emitted at a position the
  // descriptor list fixes: the run-time position mode does not carry a forwarded call, so a body that forwards its
  // own call data and reaches the call conditionally stays refused rather than binding some other record.
  if (forwards.length > 0 && varying) {
    return { calls: [], reason: 'the body forwards its own call data conditionally, and the run-time position mode '
      + 'does not carry a forwarded call, so its call records are not a fixed set the head can check' };
  }
  // A verified-mapping write's records are declared in the segment the write lands in, and the derivation locates
  // that segment either by the fixed number of calls before it or, when the source does not fix that number, by the
  // call count the run's own block declares. The latter only names the write's segment when no call follows it, so a
  // body that writes such a collection behind a call the source does not fix stays refused unless every call
  // precedes every write rather than deriving the operands from another segment.
  if ((entry.sortedBatchInfo?.length ?? 0) > 0 && varying
    && perCallBatchWriteSegment(entry) === undefined
    && !perCallBatchWriteFollowsEveryCall(entry)) {
    return { calls: [], reason: 'the body writes a verified mapping behind a call whose occurrence the source '
      + 'does not fix, and the derived operands cannot follow the segment the write lands in' };
  }
  // Only a loop's own calls repeat. A body may make fixed calls beside a loop, and those keep the positions the
  // head checks them at; marking every site of a looping body would make the fixed ones unresumable.
  const loopNested = loopNestedCallNodes(entry.body);
  let descriptor = 0;
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
    // A body whose calls are not a fixed set — a loop whose iterations make calls, or a branch whose arms make
    // different numbers of calls — is admitted: the body binds the record the number of calls it has made names and
    // increments that number once a call's check passes, so a skipped call leaves the position where it was and the
    // positions are values the execution carries rather than facts the head checks. A switch or a branch or loop
    // inside an expression stays refused: the walk cannot even count its call descriptors.
    if ('divergence' in walk && walk.divergence !== 'loop' && walk.divergence !== 'arms') {
      return { calls: [], reason: `the call to '${slot.functionName}' ${divergencePhrase(walk.divergence)}`
        + ', so its call records are not a fixed set the head can check' };
    }
    if (slot.loopArrayVar !== undefined || slot.loopIndexExpression !== undefined
      || slot.inlineLoopDispatch === true || (slot.batchInvocations?.length ?? 0) > 1) {
      return { calls: [], reason: `the call to '${slot.functionName}' runs repeatedly, so its call records are not `
        + 'a fixed set the head can check' };
    }
    if (slot.runtimeSelector !== undefined || slot.fnPtrCall === true) {
      return { calls: [], reason: `the call to '${slot.functionName}' resolves its callee or its selector at run `
        + 'time, so the record the body binds is not a fixed one the head can check' };
    }
    // The data-NFT inputs the direct convention co-spends for a callee are not part of the shape the site checks: a
    // site reads the callee's record out of the witness block, and the records the callee's own frame declares are
    // settled by the segments rather than by a co-spent input this master locates. An opaque return and a call
    // value are the direct path's own machinery, which a per-call body does not emit.
    if (slot.opaqueReturn === true || slot.callValueEffect === true) {
      return { calls: [], reason: `the call to '${slot.functionName}' takes the direct path's return-event or `
        + 'value-transfer machinery, which a per-call body does not emit' };
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
      ...(slot.condition === undefined ? {} : { conditional: true }),
      ...(target.fromStack === true ? { targetFromStack: true } : {}),
      ...(slot.sourceCallNode !== undefined && loopNested.has(slot.sourceCallNode) ? { repeats: true } : {}),
      interfaceName: slot.interfaceName,
      functionName: slot.functionName,
      arguments: args.arguments,
      ...(positions?.[descriptor] === undefined ? {} : { ordinal: positions[descriptor]! }),
    });
    descriptor += 1;
  }
  for (const [index] of forwards.entries()) {
    // A forwarded delegatecall records the frame kind and the address, but no selector: the callee's call data is
    // the caller's own received bytes, which the site binds by hashing them rather than by comparing a selector.
    calls.push({
      kind: FrameKind.DELEGATE,
      selector: new Uint8Array(0),
      target: new Uint8Array(0),
      targetFromStack: true,
      forwarded: true,
      // The forwarded call sits at its own walk position, which is the same list the typed calls read.
      ordinal: positions?.[index] ?? index,
    });
  }
  return {
    calls,
    pathCount: forwards.length > 0 ? calls.length : ('pathCount' in walk ? walk.pathCount : undefined),
  };
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
  if (slot.addressIsSelf === true) {
    // The callee is a master of the calling contract, and the caller's own code holds its address as the frame's
    // `self`, so the site binds its record to that value as it does any computed target.
    return { bytes: new Uint8Array(0), fromStack: true };
  }
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
 * site turns the value on the stack into the push the wire carries, which needs a value the code holds as one
 * item; a value that is not one such item is refused rather than guessed.
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
    if (type === undefined || !isEncodableArgumentType(type)) {
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
 * A scalar is one item the site frames from its value. A struct and an array are also one item: the code already
 * holds each as the flattened blob the wire carries, so the site pushes that blob under its own length. A mapping,
 * a tuple, a function pointer and a token container are several items or an encoding the running code does not
 * hold as one value, which this site does not build.
 */
function isEncodableArgumentType(type: Type): boolean {
  const resolved = type instanceof ValueType ? type.underlyingType : type;
  if (resolved instanceof StructType || resolved instanceof ArrayType) return true;
  return isScalarArgumentType(resolved);
}

/** True when a value of `type` is a scalar: one stack item that is not itself a composite value. */
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


