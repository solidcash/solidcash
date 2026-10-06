/**
 * Which contract shapes a framed master program can be emitted for.
 *
 * A master's head is one prefix that runs before the entry bodies. When the contract has a single entry point the
 * whole program is the head followed by that inlined body; with several, the head is followed by a selector
 * dispatcher that OP_DEFINEs each entry body with its four-byte selector and OP_INVOKEs the one the unlocking
 * bytecode's leading selector names.
 *
 * Everything else is refused with a named reason rather than compiled into a program that claims the framed
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
  isOutputOnlyBlockSlot,
} from '@solidcash/utils';
import type { CompilerOptions, PublishedLoopEffects, Type } from '@solidcash/utils';
import { hexToBin } from '@bitauth/libauth';
import {
  ArrayAccessNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  ArrayPopNode,
  ArrayPushNode,
  AssemblyStatementNode,
  AssignNode,
  BinaryOpNode,
  BlockNode,
  BoolLiteralNode,
  BranchNode,
  CastNode,
  CollectionIterationNode,
  ConstantDefinitionNode,
  ContractNode,
  DeleteLocalNode,
  DeleteStateNode,
  DoWhileNode,
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
  IndirectCallNode,
  InterfaceNode,
  IntLiteralNode,
  LiteralNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  MappingFieldAssignNode,
  MethodCallNode,
  MethodCallStatementNode,
  NewArrayNode,
  Node,
  NullaryOpNode,
  ParameterNode,
  ReturnNode,
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
  TupleAssignmentNode,
  UnaryOpNode,
  UncheckedNode,
  VariableDefinitionNode,
  WhileNode,
} from '../../ast/AST.js';
import { cloneNodeReplacing } from '../../ast/clone.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from '../../ast/Operator.js';
import { walkInvocationAst } from '../../analysis/InvocationAnalysis.js';
import { isDirectOwnerTransferNode } from '../../semantic/branchOps.js';
import type { MasterCallSite, MasterTailShape, SiteArgument } from './frame-tail.js';
import { BATCH_DERIVATION_SLOT_ORDER, batchDerivationSlotName } from './batch-witness-derivation.js';
import { bodyLoopEffects, loopEffectKinds } from './loop-effects.js';

/**
 * Synthetic parameters that carry the direct path's transaction-level sender category.
 *
 * A framed master takes `msg.sender` from its witness block instead, so these parameters are not part of its
 * frame and must not be expected on the stack (nor offered to the SDK as inputs).
 */
const FRAME_PARAMETERS = new Set(['__internal__msgSenderCategory', '__internal__msgSenderAnchorIdx']);

/**
 * The direct path's return-event output index.
 *
 * A framed master settles the value its entry computed against the witness `retval` field, not against a
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
  // The direct path pins a delegate call to a co-spent delegate master through this operand. A framed body binds
  // its delegate record against the witness block instead, so the operand is neither supplied nor read.
  '__internal__delegateInputIndex',
]);

/** A long mapping value a body reads, one per value-witness slot; the head supplies it from the frame's block. */
const VALUE_WITNESS_PARAMETER = /^__internal__valueWitness_(\d+)$/;

/**
 * The direct convention's operand for the co-spent proxy master's input index.
 *
 * Solidity-compatible upgradeable contracts mark their entries `delegate` by initializer inference, which injects
 * this operand. A framed delegate frame runs on the records its own witness block declares, so the operand names
 * an input the head never reads and never leaves: the body that carries it is refused as the shape it is.
 */
const PROXY_MASTER_WITNESS_PARAMETER = '__internal__proxyMasterIndex';

/** The selector or call data an internal body that reads `msg.sig` or `msg.data` takes from its every call site. */
const MESSAGE_CONTEXT_PARAMETERS = new Set(['__internal__msgSig', '__internal__msgData']);

/**
 * The direct convention's fold operands: pushes earlier rows made, their complete form, and the first output of a
 * written long value's chunks. A framed frame reads an entry's current value itself and finds its chunk outputs by
 * address, so the body neither receives nor reads them.
 */
function isFoldParameter(name: string): boolean {
  return /^__internal__leadingPushValue_\d+$/.test(name)
    || /^__internal__completePushValue_\d+$/.test(name)
    || name === '__internal__valueChunkOutputBase';
}

/** The value-witness slots a body reads: one past the highest slot its parameters name. */
export function valueWitnessSlotsOf(fn: FunctionDefinitionNode): number {
  return Math.max(fn.framedValueWitnessSlots ?? 0, valueWitnessSlotsInParameters(fn));
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
export function stripFrameParameters(
  contract: ContractNode, fileConstants: readonly ConstantDefinitionNode[] = [],
): void {
  const constants = constantNames(contract, fileConstants);
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
    fn.framedValueWitnessSlots = valueWitnessSlotsOf(fn);
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
    // A multi-target batch is classified as a dense linear row batch for the direct convention. The framed master
    // derives the operands itself and settles the batch through the general per-target arm, which reads no rank or
    // row, so a derivable batch is reclassified here before the body is emitted.
    if (derived !== undefined) {
      for (const batch of fn.sortedBatchInfo ?? []) {
        if (batch.slotIndices.length > 1 && batch.linear === true) batch.linear = undefined;
      }
      // A batch whose node another batch's key reads is declared ahead of it, and the published batches carry that
      // order to a builder, so the frame declares the groups in the order the derivation reads them.
      const order = batchDerivationOrder(fn, constants);
      if (order.kind === 'order' && order.batches.some((batch, index) => batch !== fn.sortedBatchInfo?.[index])) {
        fn.sortedBatchInfo = [...order.batches];
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
    // back from that output, which a framed master does not write: its frame records the returned value in
    // `retval`, and the body takes the call's result from its own witness record, so the operand is neither
    // supplied nor read and is stripped from the published interface like the others.
    || /^__internal__externalReturnOutputIdx\d*$/.test(name)
    // The direct path authenticates a result longer than a return event holds through this operand, the preimage
    // of the digest the event commits, one per returning slot. A framed body takes the result from its own
    // witness record, so the operand is neither supplied nor read either.
    || /^__internal__externalReturnPreimage\d*$/.test(name)
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
 * only computes later. A read of the frame's own record is held as the record the frame declares, which the master
 * reads in the segment the body reads it in.
 */
export interface FramedBatchKey {
  /** A parameter the body holds, read at its own stack depth. */
  readonly paramName?: string;
  /** A tracked frame value the head left: the frame's sender for `msg.sender`, the origin for `tx.origin`. */
  readonly frameSlot?: string;
  /** An expression whose operands the body holds at its start, which the master emits for the derivation. */
  readonly expression?: ExpressionNode;
  /**
   * The segment the expression's reads of the frame's own record resolve against, as the calls the body makes before
   * it reads them; absent for the first segment, where the derivation runs.
   */
  readonly stateSegment?: number;
  /**
   * The batch targets, by slot, whose node the expression reads: such a node is read through the operands its own
   * group yields, so the derivation emits the key once that target is derived (`framedBatchDerivationRounds`).
   */
  readonly targetReads?: readonly number[];
}

/**
 * The constant names a key expression may read at compile time: the contract's own and inherited ones and the
 * unit's file-level ones, which code generation inlines alike.
 */
function constantNames(
  contract: ContractNode, fileConstants: readonly ConstantDefinitionNode[],
): ReadonlySet<string> {
  return new Set([...fileConstants, ...contract.constantDefinitions].map((definition) => definition.name));
}

/** A target key the master can hold where it derives the slot, or the fact that stops it from holding one. */
type BatchKeyResolution =
  | { readonly kind: 'key'; readonly key: FramedBatchKey }
  | { readonly kind: 'refusal'; readonly reason: string };

/** Every key of one target's write, in source order, or the fact that stops the master from holding one. */
type BatchKeysResolution =
  | { readonly kind: 'keys'; readonly keys: readonly FramedBatchKey[] }
  | { readonly kind: 'refusal'; readonly reason: string };

/**
 * One key of a body's write to `slot`, or why the master cannot hold it where it derives the slot.
 *
 * A bare parameter is the body's own argument, and `msg.sender`/`tx.origin` are frame values the head leaves
 * tracked, so both are already on the stack. Any other key is derivable only when the body's own write carries an
 * expression whose every leaf is such a value, a compile-time constant, a value the frame's record holds, or a
 * collection element whose address is fixed: such a value exists at the top of the body, where the derivation
 * runs, whereas a value the body only computes later does not. A record value is the one the body's own read sees
 * (`deriveKeyExpression`).
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
  // A constant is a compile-time value code generation inlines wherever it is read, so the derivation emits it as the
  // body's own key does; a local is followed to the one declaration that binds it. A `new T[](1)` key filled by one
  // `local[0] = value` is that value: the array itself is not what the write hashes.
  const expression = boundKeyExpression(keyNode, entry, constants);
  if (expression === undefined) {
    return {
      kind: 'refusal',
      reason: `the body writes a mapping at slot ${slot} whose key ${keyIndex} '${source.canonical}' is the local `
        + `'${keyNode instanceof IdentifierNode ? keyNode.name : '?'}', which is not bound to a single `
        + 'compile-time value',
    };
  }
  const unavailable = keyOperandUnavailable(expression, constants, entry);
  if (unavailable !== undefined) {
    return {
      kind: 'refusal',
      reason: `the body writes a mapping at slot ${slot} whose key ${keyIndex} '${source.canonical}' reads `
        + `${unavailable}, and a master derives a target slot only from a bare parameter, the frame's sender, a `
        + 'value of its own record, or a compile-time value the body holds at its start',
    };
  }
  const derived = deriveKeyExpression(expression, entry, constants);
  if (derived.kind === 'refusal') {
    return {
      kind: 'refusal',
      reason: `the body writes a mapping at slot ${slot} whose key ${keyIndex} '${source.canonical}' reads `
        + derived.reason,
    };
  }
  return {
    kind: 'key',
    key: {
      expression: derived.expression,
      ...(derived.segment ? { stateSegment: derived.segment } : {}),
      ...(derived.targetReads === undefined ? {} : { targetReads: derived.targetReads }),
    },
  };
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
  const keys: FramedBatchKey[] = [];
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
 * The expression a key stands for after inliner copies and a single literal-index element store.
 *
 * An identifier is followed to the one local that binds it. `local[N]` with one `local[N] = value` and no other
 * write of `local` is `value`: inlining `_update(id, new address[](0), disallowed)` leaves the write key as
 * `disallowed[0]`, and the element store is what was hashed.
 */
function boundKeyExpression(
  node: ExpressionNode,
  entry: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
): ExpressionNode | undefined {
  const resolved = node instanceof IdentifierNode && !constants.has(node.name)
    ? resolveKeyIdentifier(node.name, entry, constants, new Set())
    : node;
  if (resolved === undefined) return undefined;
  return singleLiteralElement(resolved, entry) ?? resolved;
}

/**
 * The local a literal-index read belongs to.
 *
 * The array is that local, or the one `new T[](N)` it was copied from. Inlining a helper argument substitutes the
 * allocation into the key (`disallowed[0]` becomes `(new address[](1))[0]`), and N identifies the local when only
 * one allocation of that size exists.
 */
function arrayElementLocal(array: ExpressionNode, entry: FunctionDefinitionNode): string | undefined {
  if (array instanceof IdentifierNode) return array.name;
  if (!(array instanceof NewArrayNode) || !(array.size instanceof IntLiteralNode)) return undefined;
  const size = array.size.value;
  let name: string | undefined;
  let count = 0;
  walkInvocationAst(entry.body, (node) => {
    if (!(node instanceof VariableDefinitionNode) || !(node.expression instanceof NewArrayNode)) return;
    if (!(node.expression.size instanceof IntLiteralNode) || node.expression.size.value !== size) return;
    count += 1;
    name = node.name;
  });
  return count === 1 ? name : undefined;
}

/**
 * The one value stored at a literal index of a local array, or undefined when that store is not a single assignment.
 *
 * Any other write of the array (another index, a push, a pop, a delete, or a whole-array assign) leaves the element
 * unresolved, so the caller refuses the key rather than hashing a value the body may not still hold.
 */
function singleLiteralElement(node: ExpressionNode, entry: FunctionDefinitionNode): ExpressionNode | undefined {
  if (!(node instanceof ArrayAccessNode) || !(node.index instanceof IntLiteralNode)) return undefined;
  const name = arrayElementLocal(node.array, entry);
  if (name === undefined) return undefined;
  const index = node.index.value;
  let value: ExpressionNode | undefined;
  let count = 0;
  let otherWrite = false;
  walkInvocationAst(entry.body, (current) => {
    if (current instanceof ArrayAssignNode && current.name === name) {
      if (current.index instanceof IntLiteralNode && current.index.value === index) {
        count += 1;
        value = current.value;
      } else otherWrite = true;
    } else if ((current instanceof ArrayPushNode || current instanceof ArrayPopNode
      || current instanceof ArrayDeleteNode) && current.name === name) {
      otherWrite = true;
    } else if (current instanceof AssignNode && current.identifier.name === name) otherWrite = true;
  });
  return !otherWrite && count === 1 ? value : undefined;
}

/**
 * The expression a key identifier stands for, following the one local declaration that binds it, or undefined when
 * no such declaration exists.
 *
 * Lowering rewrites a source key to a synthetic local in two documented places. An inlined call with a storage
 * pointer copies its value arguments into `__spN_<name>` locals before the substituted write, and an inlined
 * external-call helper copies every argument into an `__inlN_<name>` local. Following the declaration recovers the
 * argument the copy was made from, which the master can emit at the top of the body when it is itself compile-time.
 * A local bound to a constant resolves to the constant, which code generation inlines. A local bound to a parameter
 * resolves to that parameter: it is the call argument, not another local. A name bound more than once, or one bound
 * to a value the walk cannot follow to a single expression, is left unresolved so the caller refuses it.
 */
function resolveKeyIdentifier(
  name: string,
  entry: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
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
  if (!(definition instanceof IdentifierNode)) return definition;
  // A parameter or a constant is the value the copy was made from. Recursing would look for a local of that name
  // and miss it, which is how an `__inlN_jobId = jobId` key was refused as unbound.
  const bound = definition;
  if (constants.has(bound.name) || entry.parameters.some((parameter) => parameter.name === bound.name)) {
    return bound;
  }
  return resolveKeyIdentifier(bound.name, entry, constants, seen);
}

/**
 * The operand of a key expression that is not one the shape admits, or undefined when the expression is one.
 *
 * A literal and a compile-time constant exist at compile time. A cast, a unary operator, a binary operator and a
 * ternary are pure, so they are admitted exactly when their operands are, and a field read is admitted exactly when
 * the value it reads through is. A `msg.sender`/`tx.origin` read and a bare parameter are stack values the body
 * holds where the derivation runs; a local resolves to the single expression that binds it. A state value is one the
 * frame's record declares, read whole when it is one key-sized item or through a field of the record that holds it,
 * and a mapping or array element is a value the body holds only where its address is fixed. Every other node (a
 * call, an environment value, a value whose bytes live in a chunk run) is a value the shape does not derive from,
 * and the returned phrase names it so the refusal says which operand stopped it.
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
      // The entry is read where the derivation runs from the node the frame declares for it, and the read proves that
      // node is the one at its key. A node the body's own batch also writes is read through the operands its group
      // yields, so the key is derived after that group, from the value the node held before the body writes it
      // (`deriveKeyExpression`, `batchDerivationOrder`).
      for (const key of current.keys) {
        const inner = walk(key, underField);
        if (inner !== undefined) return inner;
      }
      return undefined;
    }
    if (current instanceof ArrayAccessNode) {
      const element = singleLiteralElement(current, entry);
      if (element !== undefined) return walk(element, underField);
      return walk(current.array, underField) ?? walk(current.index, underField);
    }
    if (current instanceof NullaryOpNode) {
      return current.operator === NullaryOperator.MSG_SENDER || current.operator === NullaryOperator.TX_ORIGIN
        ? undefined
        : `the ${current.operator} value`;
    }
    if (current instanceof IdentifierNode) {
      if (constants.has(current.name) || params.has(current.name)) return undefined;
      if (seen.has(current.name)) return `the value '${current.name}'`;
      const definition = resolveKeyIdentifier(current.name, entry, constants, new Set(seen));
      if (definition === undefined) return `the value '${current.name}'`;
      seen.add(current.name);
      const inner = walk(definition, underField);
      seen.delete(current.name);
      return inner;
    }
    // A field the body reads out of a state record is a value it holds, and so is a whole value that is one item.
    if (current instanceof StateAccessNode) {
      if (!underField) {
        return current.stateVariable !== undefined && isKeySizedStateValue(current.stateVariable)
          ? undefined : `the state value '${current.name}'`;
      }
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
 * True for a state value a key hashes as one item: one the record holds inline, not a value whose bytes live in a
 * chunk run, nor a mapping, array, struct or tuple.
 */
function isKeySizedStateValue(variable: StateVariableNode): boolean {
  const type = variable.type;
  return variable.isDynamic !== true && !(type instanceof ArrayType || type instanceof MappingType
    || type instanceof StructType || type instanceof TupleType || type instanceof TokenContainerType
    || type instanceof FunctionType);
}

/**
 * A key re-expressed where the derivation runs, the segment its record reads resolve against, and the batch targets
 * whose nodes it reads.
 */
type DerivedKeyExpression =
  | {
    readonly kind: 'key';
    readonly expression: ExpressionNode;
    readonly segment?: number;
    readonly targetReads?: readonly number[];
  }
  | { readonly kind: 'refusal'; readonly reason: string };

/**
 * The key expression the derivation emits, re-expressed in the values the body holds where the derivation runs, or
 * why the master cannot hold the value the body's own read sees.
 *
 * A local is followed to the single expression that binds it. A read of the frame's own record takes the value the
 * body's read takes: the value the nearest straight-line assignment ahead of it left, folded as the published key
 * label folds it (`SymbolTableTraversal.stateAssignedBefore`), or, where the body has not written the value, the
 * record the frame declares in the segment the read runs in. A read behind a write no straight line folds (in a
 * branch, a loop, a function the body invokes, or ahead of a call) is refused, as is one in a segment the source does
 * not fix, and so are reads in two segments, since the derivation reads its key in one. The expression is the body's
 * own node unless something was re-expressed, so a key that needs neither keeps the bytes it compiled to.
 *
 * A read of a node the body's own batch writes takes the view its target's group begins with, which is the value the
 * body's read sees only where the body reads it before writing it, in the segment the batch's writes land in: a read
 * the body makes after the node's write, or in another segment, is refused. Such a read is answered from the target's
 * derived operands, so the key names the targets it reads (`batchDerivationOrder`).
 */
function deriveKeyExpression(
  expression: ExpressionNode,
  entry: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
): DerivedKeyExpression {
  const params = new Set(entry.parameters.map((parameter) => parameter.name));
  const isLocal = (node: Node): node is IdentifierNode => node instanceof IdentifierNode
    && !constants.has(node.name) && !params.has(node.name);
  const readsRecord = (node: Node): node is StateAccessNode => node instanceof StateAccessNode
    && node.stateVariable !== undefined;
  const targets = new Set((entry.sortedBatchInfo ?? []).flatMap((batch) => batch.slotIndices));
  const readsTarget = (node: Node): node is MappingAccessNode => node instanceof MappingAccessNode
    && node.isPackedStateArrayAccess !== true && targets.has(node.entrySlotIndex);
  let needed = false;
  walkSyntax(expression, (node) => {
    if (readsRecord(node) || isLocal(node) || readsTarget(node)) needed = true;
    return !needed;
  });
  if (!needed) return { kind: 'key', expression };
  const places = bodyReadPlaces(entry);
  const segments = new Set<number>();
  const targetReads = new Set<number>();
  const derive = (root: ExpressionNode, seen: ReadonlySet<string>): ExpressionNode | string => {
    const replacements = new Map<Node, ExpressionNode>();
    let refusal: string | undefined;
    walkSyntax(root, (node) => {
      if (refusal !== undefined) return false;
      if (readsRecord(node)) {
        const value = readValue(node, seen);
        if (typeof value === 'string') refusal = value;
        else if (value !== node) replacements.set(node, value);
        return false;
      }
      if (isLocal(node)) {
        const definition = seen.has(node.name)
          ? undefined : resolveKeyIdentifier(node.name, entry, constants, new Set(seen));
        const value = definition === undefined
          ? `the value '${node.name}', which is not bound to a single value`
          : derive(definition, new Set([...seen, node.name]));
        if (typeof value === 'string') refusal = value;
        else replacements.set(node, value);
        return false;
      }
      if (readsTarget(node)) {
        refusal = targetReadUnavailable(node);
        targetReads.add(node.entrySlotIndex);
      }
      return true;
    });
    if (refusal !== undefined) return refusal;
    return replacements.size === 0 ? root : cloneNodeReplacing(root, (candidate) => replacements.get(candidate));
  };
  // The body reads the node where its batch's writes land, before it writes the node: its own read takes the view
  // the target's group begins with there, which is the view the derivation reads.
  const writeSegment = framedBatchWriteSegment(entry);
  const targetReadUnavailable = (read: MappingAccessNode): string | undefined => {
    const value = `the mapping entry '${read.name}' at a node the body also writes`;
    const position = places.order.get(read);
    const calls = places.calls.get(read);
    if (position === undefined || calls === undefined || places.repeating.has(read) || writeSegment === undefined
      || calls.least !== calls.most || calls.least !== writeSegment) {
      return `${value}, outside the segment the body's batch writes land in, and a master reads such a node for a `
        + 'key only in the segment it derives the batch from';
    }
    if ((places.mappingWrites.get(read.entrySlotIndex) ?? []).some((write) => write <= position)
      || places.invocations.some(({ at, target }) => at <= position && reachesMappingWrite(target))) {
      return `${value}, after the body writes it, and a master derives a key out of a node the body writes only from `
        + 'the value the node holds before the write';
    }
    return undefined;
  };
  const readValue = (read: StateAccessNode, seen: ReadonlySet<string>): ExpressionNode | string => {
    const value = `the state value '${read.name}'`;
    const assign = assignedBefore(read, places);
    if (assign !== undefined) {
      const unavailable = keyOperandUnavailable(assign.expression, constants, entry);
      return unavailable === undefined ? derive(assign.expression, seen)
        : `${value}, which the body assigned from ${unavailable}, and a master derives a target slot only from a `
          + 'bare parameter, the frame\'s sender, a value of its own record, or a compile-time value the body holds '
          + 'at its start';
    }
    const position = places.order.get(read);
    if (position === undefined) return `${value} outside the body, which a master does not place in a segment`;
    if ((places.writes.get(read.name) ?? []).some((write) => write <= position)) {
      return `${value} after the body writes it, and a master folds a write into a key only from the one `
        + 'straight-line assignment ahead of the read, with no call between them';
    }
    const calls = places.calls.get(read);
    if (places.repeating.has(read) || calls === undefined || calls.least !== calls.most) {
      return `${value} after calls the source does not fix, and a master reads a key's record only in a segment the `
        + 'source names';
    }
    segments.add(calls.least);
    return read;
  };
  const derived = derive(expression, new Set());
  if (typeof derived === 'string') return { kind: 'refusal', reason: derived };
  // A node the body writes is read in the segment its batch is declared in, so the key's record values are read there.
  if (targetReads.size > 0) segments.add(writeSegment!);
  if (segments.size > 1) {
    return {
      kind: 'refusal',
      reason: `values of its record in ${segments.size} segments, and a master reads a key's record in one`,
    };
  }
  const [segment] = segments;
  return {
    kind: 'key',
    expression: derived,
    ...(segment === undefined ? {} : { segment }),
    ...(targetReads.size === 0 ? {} : { targetReads: [...targetReads] }),
  };
}

/** One straight-line statement of a body: what it may write, whether it is opaque, and the state assignment it is. */
interface StraightLineStatement {
  readonly writes: ReadonlySet<string>;
  readonly opaque: boolean;
  readonly assign?: StateAssignNode;
}

/**
 * Where a body reads each of its nodes.
 *
 * `statements` and `positions` number the straight line as the published key labels number it, `calls` is how many
 * calls the path made before the node's statement (undefined where the source does not fix it), `repeating` holds
 * the nodes a loop can run again, `order` is each node's place in the walk, and `writes` is where each state value
 * is written: after the write's own operands, directly or through a function the body invokes. `mappingWrites` is
 * where the body writes each mapping entry slot and `invocations` where it invokes one of its contract's functions,
 * both past their own operands.
 */
interface BodyReadPlaces {
  readonly statements: readonly StraightLineStatement[];
  readonly positions: ReadonlyMap<Node, number>;
  readonly calls: ReadonlyMap<Node, CallRange>;
  readonly repeating: ReadonlySet<Node>;
  readonly order: ReadonlyMap<Node, number>;
  readonly writes: ReadonlyMap<string, readonly number[]>;
  readonly mappingWrites: ReadonlyMap<number, readonly number[]>;
  readonly invocations: readonly { readonly at: number; readonly target: FunctionDefinitionNode }[];
}

/** True for a write of a mapping entry. */
function isMappingWrite(node: Node): node is MappingAssignNode | MappingDeleteNode | MappingFieldAssignNode {
  return node instanceof MappingAssignNode || node instanceof MappingDeleteNode || node instanceof MappingFieldAssignNode;
}

/** True when a function writes a mapping entry, directly or through a function it invokes. */
function reachesMappingWrite(fn: FunctionDefinitionNode, seen = new Set<FunctionDefinitionNode>()): boolean {
  if (seen.has(fn)) return false;
  seen.add(fn);
  let writes = false;
  walkInvocationAst(fn.body, (node) => {
    if (writes) return;
    const target = invokedFunction(node);
    writes = isMappingWrite(node) || (target !== undefined && reachesMappingWrite(target, seen));
  });
  return writes;
}

/** The state value or local a node writes, by name, or undefined for a node that writes neither. */
function writtenName(node: Node): string | undefined {
  if (node instanceof StateAssignNode || node instanceof DeleteStateNode || node instanceof StateArrayPushNode
    || node instanceof StateArrayPopNode || node instanceof StateArrayAssignNode || node instanceof StateArrayDeleteNode) {
    return node.name;
  }
  if (node instanceof AssignNode || node instanceof DeleteLocalNode) return node.identifier.name;
  return undefined;
}

/** The function a node invokes: a resolved call, or a reference an indirect invocation runs. */
function invokedFunction(node: Node): FunctionDefinitionNode | undefined {
  if (node instanceof FunctionCallNode) return node.resolvedFunction;
  if (node instanceof IdentifierNode) return node.functionReference;
  return undefined;
}

/**
 * True for a node the published key labels treat as a barrier to folding (`indexCanonStatements`): a call of any
 * kind, an invocation of one of the contract's own functions, assembly, or a try.
 */
function opaqueToFolding(node: Node): boolean {
  return node instanceof AssemblyStatementNode || node instanceof FunctionCallStatementNode
    || node instanceof MethodCallStatementNode || node instanceof MethodCallNode || node instanceof TryCatchNode
    || node instanceof ExternalFunctionCallNode || node instanceof LowLevelCallNode
    || node instanceof LowLevelCallStatementNode || node instanceof IndirectCallNode
    || invokedFunction(node) !== undefined;
}

/** The state values a function writes, directly or through the functions it invokes. */
function stateWrittenBy(
  fn: FunctionDefinitionNode,
  known: Map<FunctionDefinitionNode, ReadonlySet<string>>,
): ReadonlySet<string> {
  const cached = known.get(fn);
  if (cached !== undefined) return cached;
  const written = new Set<string>();
  // A recursive invocation reads what is known so far, which is every write the cycle can reach once it closes.
  known.set(fn, written);
  walkInvocationAst(fn.body, (node) => {
    const name = node instanceof AssignNode || node instanceof DeleteLocalNode ? undefined : writtenName(node);
    if (name !== undefined) written.add(name);
    const target = invokedFunction(node);
    if (target !== undefined) for (const inner of stateWrittenBy(target, known)) written.add(inner);
  });
  return written;
}

/** Where a body reads each of its nodes, as `BodyReadPlaces` states it. */
function bodyReadPlaces(entry: FunctionDefinitionNode): BodyReadPlaces {
  const statements: StraightLineStatement[] = [];
  const positions = new Map<Node, number>();
  const number = (statement: Node): void => {
    if (statement instanceof BlockNode) {
      for (const inner of statement.statements ?? []) number(inner);
      return;
    }
    if (statement instanceof UncheckedNode) {
      number(statement.block);
      return;
    }
    const position = statements.length;
    const writes = new Set<string>();
    let opaque = false;
    walkInvocationAst(statement, (node) => {
      const earlier = positions.get(node);
      positions.set(node, earlier === undefined || earlier === position ? position : -1);
      const name = writtenName(node);
      if (name !== undefined) writes.add(name);
      if (node instanceof TupleAssignmentNode) {
        for (const element of node.elements) if (element.name !== undefined) writes.add(element.name);
      }
      if (opaqueToFolding(node)) opaque = true;
    });
    statements.push({ writes, opaque, ...(statement instanceof StateAssignNode ? { assign: statement } : {}) });
  };
  if (entry.body !== undefined) number(entry.body);

  // The calls before each statement, walked path by path as the batch write's own segment is.
  const calls = new Map<Node, CallRange>();
  const repeating = new Set<Node>();
  const place = (value: unknown, incoming: CallRange): void => walkInvocationAst(value, (node) => {
    if (!calls.has(node)) calls.set(node, incoming);
  });
  const walkBlock = (block: BlockNode | undefined, incoming: CallRange): CallRange => {
    let range = incoming;
    for (const statement of block?.statements ?? []) range = walkStatement(statement, range);
    return range;
  };
  const walkStatement = (statement: Node, incoming: CallRange): CallRange => {
    if (statement instanceof BlockNode) return walkBlock(statement, incoming);
    if (statement instanceof UncheckedNode) return walkBlock(statement.block, incoming);
    if (statement instanceof BranchNode) {
      place(statement.condition, incoming);
      const afterCondition = advanceCallRange(incoming, statement.condition);
      const thenRange = walkBlock(statement.ifBlock, afterCondition);
      const elseRange = statement.elseBlock === undefined ? afterCondition : walkBlock(statement.elseBlock, afterCondition);
      return joinCallRanges(thenRange, elseRange);
    }
    if (statement instanceof SwitchNode || statement instanceof CollectionIterationNode
      || statement instanceof WhileNode || statement instanceof DoWhileNode) {
      const fixed = callFreeNestedBlocks(statement) === undefined ? undefined : incoming;
      if (!(statement instanceof SwitchNode)) walkInvocationAst(statement, (node) => { repeating.add(node); });
      place(statement, fixed);
      return fixed;
    }
    if (statement instanceof TryCatchNode) {
      // A catch block is not an executable path, matching the invocation walk.
      place(statement.expression, incoming);
      return walkBlock(statement.tryBlock, advanceCallRange(incoming, statement.expression));
    }
    place(statement, incoming);
    return advanceCallRange(incoming, statement);
  };
  walkBlock(entry.body, { least: 0, most: 0 });

  // Every node's place in the walk, and where each state value is written: past the write's own operands, so a read
  // in the value a write stores is not behind it.
  const order = new Map<Node, number>();
  const writes = new Map<string, number[]>();
  const mappingWrites = new Map<number, number[]>();
  const invocations: { at: number; target: FunctionDefinitionNode }[] = [];
  const known = new Map<FunctionDefinitionNode, ReadonlySet<string>>();
  const seen = new Set<object>();
  const visit = (value: unknown): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    order.set(value, order.size);
    if (value instanceof TryCatchNode) {
      visit(value.expression);
      visit(value.tryBlock);
    } else {
      for (const key in value) {
        if (RESOLVED_AST_FIELDS.has(key)) continue;
        const child = value[key as keyof Node];
        if (child instanceof Node) visit(child);
        else if (Array.isArray(child)) for (const item of child) visit(item);
      }
    }
    const name = value instanceof AssignNode || value instanceof DeleteLocalNode ? undefined : writtenName(value);
    const target = invokedFunction(value);
    const written = [...(name === undefined ? [] : [name]), ...(target === undefined ? [] : stateWrittenBy(target, known))];
    for (const variable of written) writes.set(variable, [...(writes.get(variable) ?? []), order.size]);
    if (isMappingWrite(value)) {
      mappingWrites.set(value.entrySlotIndex, [...(mappingWrites.get(value.entrySlotIndex) ?? []), order.size]);
    }
    if (target !== undefined) invocations.push({ at: order.size, target });
  };
  visit(entry.body);
  return { statements, positions, calls, repeating, order, writes, mappingWrites, invocations };
}

/**
 * The straight-line assignment whose value a state read takes, or undefined when the read takes the value the frame
 * started the segment with, or one no straight line fixes.
 *
 * This is `SymbolTableTraversal.stateAssignedBefore` over the body code generation sees: the nearest statement ahead
 * of the read that assigns the value and nothing else, with no other write of it, call, invocation or assembly from
 * there to the read. The read's own statement may write the value only as that statement's own assignment.
 */
function assignedBefore(read: StateAccessNode, places: BodyReadPlaces): StateAssignNode | undefined {
  const position = places.positions.get(read);
  if (position === undefined || position < 0) return undefined;
  const assigns = (statement: StraightLineStatement): boolean =>
    !statement.opaque && statement.assign?.name === read.name && statement.writes.size === 1;
  const own = places.statements[position]!;
  if (own.opaque || (own.writes.has(read.name) && !assigns(own))) return undefined;
  for (let index = position - 1; index >= 0; index -= 1) {
    const statement = places.statements[index]!;
    if (assigns(statement)) return statement.assign;
    if (statement.opaque || statement.writes.has(read.name)) return undefined;
  }
  return undefined;
}

/**
 * The batch a body can settle from its own frame, or undefined for a shape the derivation does not cover.
 *
 * Every one of a body's entry accesses is one write to a distinct target with at most the read of that same
 * target beside it, each target's key is one value the body holds where the derivation runs (a bare parameter, the
 * frame's sender, a value of its own record, or a compile-time expression) or reads out of a node another target's
 * group yields once derived (`batchDerivationOrder`), and no target aliases another at run time. Under those
 * conditions the segment declares one record group per target, in the order the batches and their targets are listed
 * here, so the master can read each group back and derive that target's operands, and a read in the same access
 * resolves from the same group.
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
      if (access.inLoop === true || aliasesOutsideBatch(access, batch)
        || (access.runtimeAliasPriorSlots?.length ?? 0) > 0) return undefined;
    }
    derivable.push({
      slots: [...batch.slotIndices], collection: batch.collection, wasLinear: batch.linear === true,
    });
  }
  // Every target's keys resolve, and a key that reads a node the body writes has an order to be derived after it.
  if (batchDerivationOrder(entry, constants).kind === 'refusal') return undefined;
  return derivable;
}

/** One sorted batch as semantic analysis classified it. */
type SortedBatch = NonNullable<FunctionDefinitionNode['sortedBatchInfo']>[number];

/** The order a body's batches are declared and derived in, and the rounds the derivation runs, or why it has none. */
type BatchDerivationOrder =
  | {
    readonly kind: 'order';
    /** The batches in the order the frame declares their groups. */
    readonly batches: readonly SortedBatch[];
    /** The targets each round of the derivation derives, by slot: consecutive runs of the declared order. */
    readonly rounds: readonly (readonly number[])[];
  }
  | { readonly kind: 'refusal'; readonly reason: string };

/**
 * The order a body's batches are declared and derived in, and the rounds the derivation runs.
 *
 * A key the body reads out of a node its own batch writes is read through the operands that node's group yields, so
 * that group is derived first: the batch that writes the node is declared ahead of the batch whose key reads it, each
 * batch keeping its own targets' order, and the derivation starts a new round at a target whose key reads a node the
 * round it would join derives. Batches no key orders keep the order semantic analysis gave them, so a body whose keys
 * read no such node is one round in that order. Keys that read each other's nodes, and a key that reads a node its own
 * collection's batch declares at or after it, have no such order and are refused.
 */
function batchDerivationOrder(entry: FunctionDefinitionNode, constants: ReadonlySet<string>): BatchDerivationOrder {
  const batches = entry.sortedBatchInfo ?? [];
  const reads = new Map<number, ReadonlySet<number>>();
  for (const slot of batches.flatMap((batch) => batch.slotIndices)) {
    const resolved = resolveBatchKeys(entry, slot, constants);
    if (resolved.kind === 'refusal') return resolved;
    reads.set(slot, new Set(resolved.keys.flatMap((key) => key.targetReads ?? [])));
  }
  const readsOf = (slot: number): readonly number[] => [...(reads.get(slot) ?? [])];
  const derivedFirst = 'and a master derives a key out of a node the body writes only once that node\'s group is derived';
  for (const batch of batches) {
    for (const [position, slot] of batch.slotIndices.entries()) {
      const source = readsOf(slot).find((read) => batch.slotIndices.indexOf(read) >= position);
      if (source !== undefined) {
        return {
          kind: 'refusal',
          reason: `the body writes a mapping at slot ${slot} whose key reads the node it writes at slot ${source}, `
            + `which the frame declares ${source === slot ? 'as that same target' : 'after it'}, ${derivedFirst}`,
        };
      }
    }
  }
  // Each batch follows the batches whose nodes its keys read, and otherwise keeps its place.
  const batchOf = (slot: number): number => batches.findIndex((batch) => batch.slotIndices.includes(slot));
  const placed: number[] = [];
  while (placed.length < batches.length) {
    const next = batches.findIndex((batch, index) => !placed.includes(index) && batch.slotIndices.every((slot) =>
      readsOf(slot).every((source) => batchOf(source) === index || placed.includes(batchOf(source)))));
    if (next < 0) {
      const unplaced = batches.filter((_batch, index) => !placed.includes(index));
      return {
        kind: 'refusal',
        reason: `the body writes mappings ${unplaced.map((batch) => `'${batch.collection}'`).join(', ')} whose keys `
          + `read each other's nodes, ${derivedFirst}`,
      };
    }
    placed.push(next);
  }
  const ordered = placed.map((index) => batches[index]!);
  const rounds: number[][] = [[]];
  for (const slot of ordered.flatMap((batch) => batch.slotIndices)) {
    if (readsOf(slot).some((source) => rounds.at(-1)!.includes(source))) rounds.push([]);
    rounds.at(-1)!.push(slot);
  }
  return { kind: 'order', batches: ordered, rounds };
}

/**
 * The rounds a framed master derives a body's batch targets in, by slot, or undefined for a body it derives none
 * for. The batches are declared in the derivation's order by then (`stripFrameParameters`), so each round is a run of
 * the declared targets.
 */
export function framedBatchDerivationRounds(
  entry: FunctionDefinitionNode,
  constants: ReadonlySet<string>,
): readonly (readonly number[])[] | undefined {
  const order = batchDerivationOrder(entry, constants);
  return order.kind === 'order' ? order.rounds : undefined;
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
 * True for a write a `delete` of another key of its mapping follows (swap-and-pop's `m[last] = v; delete m[k]`)
 * where that delete is no target of the same batch. Where it is, the frame declares the write skipped wherever the
 * two keys meet at run time, and the delete wins as on the EVM.
 */
function aliasesOutsideBatch(
  access: NonNullable<FunctionDefinitionNode['entryAccesses']>[number], batch: SortedBatch,
): boolean {
  return access.aliasCondDeleteSlot !== undefined && !batch.slotIndices.includes(access.aliasCondDeleteSlot);
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
export function framedBatchKeys(
  entry: FunctionDefinitionNode,
  slot: number,
  constants: ReadonlySet<string>,
): readonly FramedBatchKey[] | undefined {
  const resolved = resolveBatchKeys(entry, slot, constants);
  return resolved.kind === 'keys' ? resolved.keys : undefined;
}

/**
 * The sorted-batch operands a framed master derives from its own frame, or undefined for a shape it cannot.
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
 * A body that writes a mapping carries the direct convention's batch operands. A framed master derives those
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
    const batch = batches.find((candidate) => candidate.slotIndices.includes(slot))!;
    if (aliasesOutsideBatch(access, batch) || (access.runtimeAliasPriorSlots?.length ?? 0) > 0) {
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
  const order = batchDerivationOrder(entry, constants);
  if (order.kind === 'refusal') return order.reason;
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
 * How many value sends a value reaches. A send is a call into its recipient's `receive()` where the recipient is a
 * contract, which the code decides by the lock at run time, so each is a call the source does not fix (spec 4b).
 */
function sendsIn(value: unknown): number {
  let sends = 0;
  walkInvocationAst(value, (node) => {
    if (isDirectOwnerTransferNode(node)) sends += 1;
  });
  return sends;
}

/**
 * Advances a call range past a value, or undefined when the value makes an open number of calls.
 *
 * A value that reaches no call contributes none on any path, even when the count walk cannot descend through it:
 * the walk answers a statement carrying a nested branch as open, and lowering leaves such branches inside
 * expressions (an unchecked arithmetic block keeps a disabled overflow check as `if (false) revert`). That branch
 * decides values rather than calls, so the segment the code after it runs in is the one the code before it reached.
 * A value send may make a call or none, so it widens the range by one.
 */
function advanceCallRange(range: CallRange, value: unknown, countSends = true): CallRange {
  if (range === undefined) return undefined;
  const sends = countSends ? sendsIn(value) : 0;
  if (!reachesAnyCall(value)) return sends === 0 ? range : { least: range.least, most: range.most + sends };
  const calls = callsInExpression(value);
  return calls === undefined ? undefined : { least: range.least + calls, most: range.most + calls + sends };
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
  if (reachesExternalCall(statement) || sendsIn(statement) > 0) return undefined;
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
export function framedBatchWriteSegment(entry: FunctionDefinitionNode): number | undefined {
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
    // A write an `unchecked` block holds runs where the block stands, after the calls the walk had reached.
    if (statement instanceof UncheckedNode) return walkBlock(statement.block, incoming);
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
 * For each value send of an entry, in transfer order, how many external calls the entry makes before it, or
 * undefined when the source does not fix that number for every send (spec 4b).
 *
 * A send to a contract is a call made where the send is, so a builder places its record past the calls before it
 * and past the calls the earlier sends to contracts made, which only the recipients a builder resolves can tell. A
 * statement that both sends and calls, and a send in a loop or a switch, leave the number open.
 */
export function framedSendCallsBefore(entry: FunctionDefinitionNode): readonly number[] | undefined {
  const count = entry.transferInfos?.length ?? 0;
  if (count === 0) return undefined;
  const before = new Map<number, number>();
  let open = false;
  const place = (value: Node, incoming: CallRange): void => {
    walkInvocationAst(value, (node) => {
      if (!isDirectOwnerTransferNode(node)) return;
      const index = (node as { readonly transferIndex?: number }).transferIndex;
      if (index === undefined || incoming === undefined || incoming.least !== incoming.most
        || reachesAnyCall(value) || before.has(index)) {
        open = true;
        return;
      }
      before.set(index, incoming.least);
    });
  };
  const walkBlock = (block: BlockNode | undefined, incoming: CallRange): CallRange => {
    let range = incoming;
    for (const statement of block?.statements ?? []) range = walkStatement(statement, range);
    return range;
  };
  const walkStatement = (statement: Node, incoming: CallRange): CallRange => {
    if (statement instanceof BranchNode) {
      place(statement.condition, incoming);
      const afterCondition = advanceCallRange(incoming, statement.condition, false);
      const thenRange = walkBlock(statement.ifBlock, afterCondition);
      const elseRange = statement.elseBlock === undefined
        ? afterCondition
        : walkBlock(statement.elseBlock, afterCondition);
      return joinCallRanges(thenRange, elseRange);
    }
    if (statement instanceof BlockNode) return walkBlock(statement, incoming);
    if (statement instanceof UncheckedNode) return walkBlock(statement.block, incoming);
    if (statement instanceof SwitchNode || statement instanceof CollectionIterationNode
      || statement instanceof WhileNode || statement instanceof DoWhileNode) {
      if (sendsIn(statement) > 0) open = true;
      return reachesExternalCall(statement) ? undefined : incoming;
    }
    if (statement instanceof TryCatchNode) {
      place(statement.expression, incoming);
      // A catch block is not an executable path, matching the invocation walk.
      return walkBlock(statement.tryBlock, advanceCallRange(incoming, statement.expression, false));
    }
    place(statement, incoming);
    return advanceCallRange(incoming, statement, false);
  };
  walkBlock(entry.body, { least: 0, most: 0 });
  const placed = Array.from({ length: count }, (_unused, index) => before.get(index));
  return open || placed.some((calls) => calls === undefined) ? undefined : placed as number[];
}

/**
 * True when every one of a body's derivable batch writes runs after every call the body reaches.
 *
 * A call closes the segment the code before it runs in, so a write no call follows lands in the last segment the
 * execution opens, whichever arm ran: its index is how many calls the execution made, which the witness block
 * declares. A call textually after the write is the only way one can execute after it, so every call's place in the
 * invocation walk lying below every write's is exactly the fact the derivation needs to read that segment at run
 * time. A write in a loop is refused elsewhere, so the walk order decides this. A value send is a call where its
 * recipient is a contract, so it counts as one.
 */
export function framedBatchWriteFollowsEveryCall(entry: FunctionDefinitionNode): boolean {
  const slots = new Set((entry.sortedBatchInfo ?? []).flatMap((batch) => batch.slotIndices));
  if (slots.size === 0) return false;
  let order = 0;
  let lastCall = -1;
  let firstWrite = Number.POSITIVE_INFINITY;
  walkInvocationAst(entry.body, (node) => {
    if (node instanceof ExternalFunctionCallNode || node instanceof LowLevelCallStatementNode
      || node instanceof LowLevelCallNode || isDirectOwnerTransferNode(node)) {
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
 * True when a body's verified-mapping batch and the run of chunk records its dynamic write grows can land in
 * different segments, which its frame serves by addressing the run in the run's own segment.
 *
 * The batch's records are declared in the segment the batch's write lands in, a fixed one here, and the run's in the
 * segment the epilogue pins it in, the last; a call after the batch's write sets the two apart. The frame then reads
 * and pins the run in its own segment past the records every segment declares ahead of any group, and counts the
 * batch's groups ahead of it only where the two segments are one, so a builder declares the run in that segment
 * alone and keeps no batch record there. The run's position has to be a constant of the layout there: a run-time
 * loop's nodes, or an input the frame does not declare as a record, keep the body on the shared segment, as does a
 * second dynamic value, whose run a builder lays beside the batch's records.
 */
export function framedRunApartFromBatch(entry: FunctionDefinitionNode): boolean {
  if (framedBatchWriteSegment(entry) === undefined || framedBatchWriteFollowsEveryCall(entry)) return false;
  if ((entry.sortedUpsertLoopInfo?.length ?? 0) > 0) return false;
  if ((entry.entryAccesses ?? []).some((access) => access.inLoop === true)) return false;
  const layout = entry.blockLayout;
  const declared = new Set(['master', 'dataNft', 'entry', 'keccakSideCar', 'ecrecoverSideCar']);
  if (layout === undefined || layout.slots.some((slot) => !isOutputOnlyBlockSlot(slot) && !declared.has(slot.kind))) {
    return false;
  }
  const grown = new Set(framedWriteSteps(entry, framedBatchSlots(entry))
    .filter((step) => writesSizedField(step.statement))
    .map((step) => (step.statement as { readonly stateVariable?: StateVariableNode }).stateVariable?.name));
  return grown.size === 1;
}

/**
 * The segment an entry's own record write is declared in, as the artifact publishes it for a builder.
 *
 * A fixed number is the count of external calls the entry makes before the write; `'last'` is the last segment the
 * run opens, which is where a write every call precedes lands and where a write to a field whose bytes the record
 * only sizes lands whatever the source order. A builder reads the same fact code generation does and declares the
 * write's records in that one segment rather than refusing the entry.
 */
export type FramedWriteSegment = number | 'last';

/**
 * True for a write to a record the entry's own frame holds: a data-NFT field, a dynamic value's record, or a
 * target of the verified mapping batch the entry plans.
 *
 * A call closes the segment the code before it runs in, so which segment such a write is declared in is the number
 * of calls the entry's own source makes before it — the ones before its statement, and any the statement's own
 * expression makes, since the store is emitted after the expression it computes.
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
  // A value send is a call where its recipient is a contract, so it counts as one.
  let order = 0;
  let lastCall = -1;
  let firstWrite = Number.POSITIVE_INFINITY;
  walkInvocationAst(entry.body, (node) => {
    if (node instanceof ExternalFunctionCallNode || node instanceof LowLevelCallStatementNode
      || node instanceof LowLevelCallNode || isDirectOwnerTransferNode(node)) {
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
export function framedWriteSegment(entry: FunctionDefinitionNode): FramedWriteSegment | undefined {
  const batchSlots = framedBatchSlots(entry);
  const facts = framedWriteSteps(entry, batchSlots).map(writeStepSegment);
  if (facts.length === 0) return undefined;
  if (facts.every((fact) => fact !== undefined && fact === facts[0])) return facts[0];
  // The write's own segment is not fixed: every call has to precede it for the run's last segment to be the answer.
  return entryRecordWritesFollowEveryCall(entry, batchSlots) ? 'last' : undefined;
}

/** The record slots the entry's verified mapping batch writes: the only mapping writes its own frame declares. */
function framedBatchSlots(entry: FunctionDefinitionNode): ReadonlySet<number> {
  return new Set((entry.sortedBatchInfo ?? []).flatMap((batch) => batch.slotIndices));
}

/** One record write the entry's own source makes, with the calls its own path made before it. */
interface FramedWriteStep {
  readonly statement: Node;
  /** The calls the path that reaches this write made before it, or undefined when the source does not fix them. */
  readonly calls: CallRange;
  /**
   * The calls made before the frame first holds the write's field: before the outermost branch, switch or loop around
   * the write, which holds every write inside it from its start, or before the write's own statement.
   */
  readonly heldFrom: CallRange;
  /**
   * True when every call site of the body stands before this write, so the write runs after whatever calls the
   * execution made.
   *
   * The calls before a write are a count that varies with the arms taken, but a write no call site follows sits
   * past all of them: its segment is the segment the run's own call count names, whichever arms it took.
   */
  readonly followsEveryCall: boolean;
}

/**
 * The resolved AST fields a syntax walk must not descend into, matching `walkInvocationAst`.
 *
 * A node keeps the definitions, symbols and types it resolved to; walking them would leave the body being analysed,
 * and a shared resolved node would be revisited.
 */
const RESOLVED_AST_FIELDS = new Set([
  'resolvedFunction', 'functionReference', 'definition', 'symbolTable', 'referencedContract', 'stateVariable',
  'collection', 'type', 'location', 'name', 'functionId', 'error', 'opRolls', 'selectorHex', 'abiType',
]);

/** True for a node that makes an external call, a low-level call or a value send. */
function isCallSiteNode(node: Node): boolean {
  return node instanceof ExternalFunctionCallNode || node instanceof LowLevelCallNode
    || node instanceof LowLevelCallStatementNode || isDirectOwnerTransferNode(node);
}

/**
 * Walks the syntax children of a node, telling the visitor whether an enclosing construct can run its body again.
 *
 * The walk mirrors `walkInvocationAst`: a catch block is not an executable path, and resolved references are not
 * descended into. `repeating` becomes true once the walk enters a loop, an iteration or a switch arm.
 */
function walkSyntax(
  value: unknown,
  visit: (node: Node, repeating: boolean) => boolean | void,
  repeating = false,
  seen = new Set<object>(),
): void {
  if (!(value instanceof Node) || seen.has(value)) return;
  seen.add(value);
  if (visit(value, repeating) === false) return;
  const next = repeating || value instanceof WhileNode || value instanceof DoWhileNode
    || value instanceof CollectionIterationNode || value instanceof SwitchNode;
  if (value instanceof TryCatchNode) {
    walkSyntax(value.expression, visit, next, seen);
    walkSyntax(value.tryBlock, visit, next, seen);
    return;
  }
  for (const key in value) {
    if (RESOLVED_AST_FIELDS.has(key)) continue;
    const child = value[key as keyof Node];
    if (child instanceof Node) walkSyntax(child, visit, next, seen);
    else if (Array.isArray(child)) for (const item of child) walkSyntax(item, visit, next, seen);
  }
}

/**
 * True when `target` runs after every call site the body can reach, read from the source rather than a call count.
 *
 * A count cannot locate a write that follows a run-time loop's calls, because such a loop makes a number the count
 * walk refuses to bound. The source can: a write no call site follows, sitting in no construct whose body can run
 * again, lands in the last segment the execution opens whatever the loop's trip count — an entry guard's release
 * after a call-making loop, for one. A write inside such a loop is left unstated rather than placed in a segment a
 * later turn could change.
 */
function writeFollowsEveryCall(entry: FunctionDefinitionNode, target: Node): boolean {
  const body = entry.body;
  if (body === undefined) return false;
  let reached = false;
  let repeatingAtTarget = false;
  let callAfter = false;
  walkSyntax(body, (node, repeating) => {
    if (callAfter) return false;
    if (node === target) {
      reached = true;
      repeatingAtTarget = repeating;
      // A call in the write's own expression evaluates before its store, so it is not a call after the write.
      return false;
    }
    if (reached && isCallSiteNode(node)) {
      callAfter = true;
      return false;
    }
    return true;
  });
  return reached && !repeatingAtTarget && !callAfter;
}

/** The record writes the entry's own source makes, in the order the walk reaches them. */
function framedWriteSteps(
  entry: FunctionDefinitionNode,
  batchSlots: ReadonlySet<number>,
): readonly FramedWriteStep[] {
  const steps: FramedWriteStep[] = [];
  // The most calls any one path makes: a write the walk reaches with every one of them behind it follows them all.
  const mostCalls = callCountRange(entry.body, true)?.most;
  // `held` is where the outermost construct around the statement started, which pre-allocates the writes inside it.
  type Held = { readonly from: CallRange } | undefined;
  const walkBlock = (block: BlockNode | undefined, incoming: CallRange, held: Held): CallRange => {
    let range = incoming;
    for (const statement of block?.statements ?? []) range = walkStatement(statement, range, held);
    return range;
  };
  const walkStatement = (statement: Node, incoming: CallRange, held: Held): CallRange => {
    if (writesEntryRecord(statement, batchSlots)) {
      // The write's own expression is emitted before the store, so a call the statement itself makes closes a
      // segment the write lands past: the calls before it are the ones the walk had reached, plus its own.
      const afterWrite = advanceCallRange(incoming, statement);
      steps.push({
        statement,
        calls: afterWrite,
        heldFrom: held === undefined ? incoming : held.from,
        followsEveryCall: (mostCalls !== undefined && afterWrite !== undefined && afterWrite.most === mostCalls)
          || writeFollowsEveryCall(entry, statement),
      });
      return afterWrite;
    }
    const opens: Held = held ?? { from: incoming };
    if (statement instanceof BranchNode) {
      const afterCondition = advanceCallRange(incoming, statement.condition);
      const thenRange = walkBlock(statement.ifBlock, afterCondition, opens);
      const elseRange = statement.elseBlock === undefined
        ? afterCondition
        : walkBlock(statement.elseBlock, afterCondition, opens);
      return joinCallRanges(thenRange, elseRange);
    }
    if (statement instanceof BlockNode) return walkBlock(statement, incoming, held);
    // An `unchecked` block only drops overflow checks: its writes run in sequence with the code around it, so they
    // are steps of the path the walk is on, held where the statement itself is.
    if (statement instanceof UncheckedNode) return walkBlock(statement.block, incoming, held);
    if (statement instanceof SwitchNode || statement instanceof CollectionIterationNode
      || statement instanceof WhileNode || statement instanceof DoWhileNode) {
      // A loop, switch or iteration makes a number of calls its own bound decides; a call-free one makes none, and a
      // write inside it lands in the segment the code before it runs in, so the walk descends into it.
      const nested = callFreeNestedBlocks(statement);
      if (nested === undefined) return undefined;
      for (const block of nested) walkBlock(block, incoming, opens);
      return incoming;
    }
    if (statement instanceof TryCatchNode) {
      // A catch block is not an executable path, matching the invocation walk.
      return walkBlock(statement.tryBlock, advanceCallRange(incoming, statement.expression), held);
    }
    return advanceCallRange(incoming, statement);
  };
  walkBlock(entry.body, { least: 0, most: 0 }, undefined);
  return steps;
}

/** The segment one write lands in: the calls before a sized field's write past, or where that write's run is. */
function writeStepSegment(step: FramedWriteStep): FramedWriteSegment | undefined {
  if (writesSizedField(step.statement)) return 'last';
  if (step.calls !== undefined && step.calls.least === step.calls.most) return step.calls.least;
  // The calls before the write vary with the arms taken, but no call site follows it: it lands in the segment the
  // run's own call count names, which is the last one the execution opens.
  return step.followsEveryCall ? 'last' : undefined;
}

/**
 * One write of an entry, and the segment its records are declared in.
 *
 * Exactly one identity is set, naming the write the segment belongs to: `record` is one of the entry's own data-NFT
 * records, `collection` is the verified mapping a batch write targets, `variable` is the dynamic value whose run of
 * chunk records a write occupies, and `turns` is a mapping write a run-time loop makes once per turn. A builder
 * declares each write's records in its own segment.
 */
export interface FramedWriteSegmentFact {
  readonly record?: number;
  readonly collection?: string;
  readonly variable?: string;
  /** For a fact with `turns`, the calls a turn makes before its write. */
  readonly segment: FramedWriteSegment;
  /** A run-time loop's write, whose turns land where the loop's own calls move them (`framedTurnWrites`). */
  readonly turns?: FramedWriteTurns;
  /**
   * For a write to a dynamic value's element, the fields the write provably copies back unchanged.
   *
   * The source spells a partial element update as a whole-element construction whose untouched fields are read
   * back out of the element. Such a field keeps the value the frame started with, so a guarded call that only
   * reads it is decided by the incoming state. Absent means the write's effect on the fields is not known, which
   * is the conservative case. Only a write to a variable sets this; a record or collection write never does.
   */
  readonly preservedFields?: readonly string[];
  /**
   * For a write to a data record, the state variable(s) whose write rebuilt that record.
   *
   * A record holds several state variables, and a write to one of them rebuilds the whole commitment while leaving
   * the others' values as they were. Naming the written variable is what lets a guarded call that reads another
   * field of the same record stay decided by the incoming state. Absent means the written variables are not known.
   */
  readonly writtenVariables?: readonly string[];
  /**
   * For a dynamic value's run, true when the frame addresses the run in its own segment apart from the entry's
   * batch (`framedRunApartFromBatch`): a builder declares the run in that segment alone, with no batch record kept
   * there, so the run's segment and the batch's may differ. Absent means the run is read past the batch's groups.
   */
  readonly apart?: true;
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

export function framedWriteSegments(
  entry: FunctionDefinitionNode,
): readonly FramedWriteSegmentFact[] | undefined {
  const facts: FramedWriteSegmentFact[] = [];
  const admit = (identity: string, fact: FramedWriteSegmentFact): boolean => {
    const known = facts.find((candidate) => identityOfWrite(candidate) === identity);
    if (known !== undefined) return known.segment === fact.segment;
    facts.push(fact);
    return true;
  };
  const steps = framedWriteSteps(entry, framedBatchSlots(entry));
  // The sorted batch is one write however many targets it names: the derivation reads one segment for all of
  // them, so a body whose batches the walk does not place in one segment publishes no fact rather than a wrong one.
  const collections = [...new Set((entry.sortedBatchInfo ?? []).map((batch) => batch.collection))];
  const batchSegment = framedBatchWriteSegment(entry)
    ?? (framedBatchWriteFollowsEveryCall(entry) ? 'last' : undefined);
  if (collections.length > 0 && (batchSegment === undefined
    || !collections.every((collection) => admit(`mapping:${collection}`, { collection, segment: batchSegment })))) {
    return undefined;
  }
  // A batch target the walk does not reach is a write inside a loop or a switch, which the walk cannot place: the
  // emitter refuses such a body's derivation rather than reading a segment the write does not land in.
  const reached = new Set(steps
    .filter((step) => step.statement instanceof MappingAssignNode || step.statement instanceof MappingDeleteNode)
    .map((step) => (step.statement as MappingAssignNode | MappingDeleteNode).entrySlotIndex));
  if ([...framedBatchSlots(entry)].some((slot) => !reached.has(slot))) return undefined;
  const records = framedRecordWriteSegments(steps, entry);
  if (records === undefined) return undefined;
  for (const [record, list] of records.segments) {
    for (const segment of list) {
      const written = records.writtenVariables.get(record)?.get(segment);
      if (!admit(`record:${record}@${String(segment)}`, {
        record,
        segment,
        ...(written === undefined || written.length === 0 ? {} : { writtenVariables: [...written] }),
      })) return undefined;
    }
  }
  // A dynamic value's bytes live in the run of chunk records the epilogue pins in the last segment, whatever the
  // source position of the write that grows it.
  const apart = collections.length > 0 && framedRunApartFromBatch(entry);
  for (const variable of records.variables) {
    if (!admit(`dynamic:${variable.name}`, {
      variable: variable.name,
      segment: 'last',
      ...(variable.preservedFields === undefined ? {} : { preservedFields: variable.preservedFields }),
      ...(apart ? { apart: true } : {}),
    })) return undefined;
  }
  // A run-time loop's write is not a step the walk places: its turns land where the loop's own calls move them.
  for (const { offset, ...turns } of framedTurnWrites(entry)) {
    if (!admit(`turns:${turns.slot}`, { segment: offset, turns })) return undefined;
  }
  return facts.length > 0 ? facts : (writesOwnRecord(entry) ? undefined : []);
}

/** The identity one published write is keyed by, as `framedWriteSegments` builds it. */
function identityOfWrite(fact: FramedWriteSegmentFact): string {
  if (fact.record !== undefined) return `record:${fact.record}@${String(fact.segment)}`;
  if (fact.collection !== undefined) return `mapping:${fact.collection}`;
  if (fact.turns !== undefined) return `turns:${fact.turns.slot}`;
  return `dynamic:${fact.variable}`;
}

/** Where the turns of a run-time loop that makes calls land its mapping write, as `PublishedWriteTurns` states it. */
export interface FramedWriteTurns {
  readonly collection: string;
  /** The entry slot the loop's write names. */
  readonly slot: number;
  /** The entry's call site whose call each turn makes first, an index of `entry.externalCalls`. */
  readonly site: number;
  /** The calls every turn makes. */
  readonly stride: number;
}

/** One loop write `framedTurnWrites` places, with the calls a turn makes before it. */
interface FramedTurnWrite extends FramedWriteTurns {
  readonly offset: number;
}

/** A loop statement of an entry's body that no other loop encloses, with the block whose statement it is. */
interface OuterLoop {
  readonly loop: WhileNode | DoWhileNode;
  readonly parent: BlockNode;
}

/** The loops of a body no other loop encloses, in the order the walk reaches them. */
function outerLoops(body: BlockNode | undefined): readonly OuterLoop[] {
  const found: OuterLoop[] = [];
  const walkBlock = (block: BlockNode | undefined): void => {
    for (const statement of block?.statements ?? []) walkStatement(statement, block!);
  };
  const walkStatement = (statement: Node, parent: BlockNode): void => {
    if (statement instanceof WhileNode || statement instanceof DoWhileNode) found.push({ loop: statement, parent });
    else if (statement instanceof BlockNode) walkBlock(statement);
    else if (statement instanceof BranchNode) {
      walkBlock(statement.ifBlock);
      walkBlock(statement.elseBlock);
    } else if (statement instanceof SwitchNode) {
      for (const arm of statement.cases) walkBlock(arm.body);
      walkBlock(statement.defaultCase);
    } else if (statement instanceof TryCatchNode) walkBlock(statement.tryBlock);
  };
  walkBlock(body);
  return found;
}

/** True for a statement that writes a record of the frame's state other than through a mapping node. */
function writesNonNodeRecord(node: Node): boolean {
  return node instanceof StateAssignNode || node instanceof StateArrayPushNode || node instanceof StateArrayPopNode
    || node instanceof StateArrayAssignNode || node instanceof StateArrayDeleteNode
    || node instanceof MappingFieldAssignNode;
}

/**
 * The calls one turn of a loop makes before `write`, or undefined when no one count holds: a branch, switch or
 * nested loop decides whether the write runs, or the calls before it vary with the path.
 */
function callsBeforeWriteInTurn(block: BlockNode, write: Node): number | undefined {
  let found: number | undefined;
  let open = false;
  const contains = (value: unknown): boolean => {
    let inside = false;
    walkInvocationAst(value, (node) => { if (node === write) inside = true; });
    return inside;
  };
  const walkBlock = (inner: BlockNode | undefined, calls: number): number | undefined => {
    let running: number | undefined = calls;
    for (const statement of inner?.statements ?? []) {
      if (running === undefined || found !== undefined) return running;
      if (statement === write) {
        const own = callsInExpression(statement);
        if (own === undefined) open = true;
        else found = running + own;
        return running;
      }
      if (statement instanceof BlockNode) {
        running = walkBlock(statement, running);
        continue;
      }
      if (contains(statement)) {
        open = true;
        return undefined;
      }
      const range = statementCallRange(statement);
      running = range === undefined || range.least !== range.most ? undefined : running + range.least;
    }
    return running;
  };
  walkBlock(block, 0);
  return open ? undefined : found;
}

/**
 * The mapping writes run-time loops make once per turn while the loops' own bodies make calls, each with where its
 * turns land; a loop whose turns the source does not fix contributes none, and its write stays unplaced.
 *
 * A call closes the segment the code before it runs in, so turn `t` of such a loop writes past every call the turns
 * before it made. The facts hold exactly when every turn makes the same calls in the same order: the condition
 * reaches no call, every call of the body runs on every path and binds an external call site of its own, the body
 * sends no value, and its one mapping write runs on every path after a fixed number of the turn's calls. The turn's
 * first call then sits at the frame position of that site's first call plus `t` strides, which a builder knows from
 * the calls it plans. A loop body that writes anything else, or writes two collections, is left unplaced.
 *
 * A collection two loops write is one run only when the loops are statements of one block and no other loop writes
 * it: each loop's teardown counts the transaction's nodes of the collection, which code generation chains across
 * such loops (`framedLoopChains`). A collection written any other way beside a loop is left unplaced.
 */
export function framedTurnWrites(entry: FunctionDefinitionNode): readonly FramedTurnWrite[] {
  const accesses = entry.entryAccesses ?? [];
  const sites = entry.externalCalls ?? [];
  const inLoop = (slot: number): boolean => accesses.find((access) => access.slotIndex === slot)?.inLoop === true;
  const placed: (FramedTurnWrite & OuterLoop & { readonly index: number })[] = [];
  const writers = new Map<string, number>();
  for (const outer of outerLoops(entry.body)) {
    const { loop } = outer;
    const writes: (MappingAssignNode | MappingDeleteNode)[] = [];
    let other = false;
    walkInvocationAst(loop.block, (node) => {
      if ((node instanceof MappingAssignNode || node instanceof MappingDeleteNode) && inLoop(node.entrySlotIndex)) {
        writes.push(node);
      } else if (writesNonNodeRecord(node) || node instanceof MappingAssignNode || node instanceof MappingDeleteNode) {
        other = true;
      }
    });
    for (const write of writes) {
      const name = accesses.find((access) => access.slotIndex === write.entrySlotIndex)?.collection;
      if (name !== undefined) writers.set(name, (writers.get(name) ?? 0) + 1);
    }
    if (!reachesCallRecord(loop.block) || writes.length !== 1 || other) continue;
    if (reachesCallRecord(loop.condition) || sendsIn(loop) > 0 || reachesLazilyEvaluatedCall(loop.block)) continue;
    const walk = callsOnEveryPath(loop.block);
    if (!('pathCount' in walk) || walk.pathCount < 1 || walk.calls.length !== walk.pathCount) continue;
    const calls: Node[] = [];
    walkInvocationAst(loop.block, (node) => {
      if (node instanceof ExternalFunctionCallNode || node instanceof LowLevelCallStatementNode
        || node instanceof LowLevelCallNode) calls.push(node);
    });
    // Each call is a site of its own, reached once per turn in the order the walk reaches it.
    const nested = calls.some((call) => {
      let inner = 0;
      walkInvocationAst(call, (node) => { if (calls.includes(node)) inner += 1; });
      return inner > 1;
    });
    const site = sites.findIndex((slot) => slot.sourceCallNode === calls[0]);
    if (nested || calls.length !== walk.pathCount || site < 0) continue;
    const write = writes[0]!;
    const offset = callsBeforeWriteInTurn(loop.block, write);
    const collection = accesses.find((access) => access.slotIndex === write.entrySlotIndex)?.collection;
    if (offset === undefined || collection === undefined) continue;
    placed.push({
      collection, slot: write.entrySlotIndex, site, stride: walk.pathCount, offset, ...outer,
      index: (outer.parent.statements ?? []).indexOf(loop),
    });
  }
  const batched = new Set((entry.sortedBatchInfo ?? []).map((batch) => batch.collection));
  const returnsBetween = (parent: BlockNode, from: number, to: number): boolean => {
    let returns = false;
    for (const statement of (parent.statements ?? []).slice(from + 1, to)) {
      walkInvocationAst(statement, (node) => { if (node instanceof ReturnNode) returns = true; });
    }
    return returns;
  };
  return placed.filter((write, _position, all) => {
    const run = all.filter((candidate) => candidate.collection === write.collection);
    // Every loop that writes the collection is placed, in one block's statement order with no return between them,
    // and no batch writes it.
    return !batched.has(write.collection) && run.length === writers.get(write.collection)
      && run.every((candidate, position) => candidate.parent === run[0]!.parent
        && (position === 0 || (candidate.index > run[position - 1]!.index
          && !returnsBetween(candidate.parent, run[position - 1]!.index, candidate.index))));
  }).map(({ collection, slot, site, stride, offset }) => ({ collection, slot, site, stride, offset }));
}

/**
 * The loop slots whose run of records continues the run an earlier loop of the same collection began, each with the
 * slot of the run's first loop and whether it is the run's last.
 *
 * Code generation keeps such loops' counters across them and counts the collection's nodes once, at the last
 * loop's teardown, and every loop of the run addresses its records from the first loop's position.
 */
export function framedLoopChains(
  entry: FunctionDefinitionNode,
): ReadonlyMap<number, { readonly first: number; readonly last: boolean }> {
  const chains = new Map<number, { readonly first: number; readonly last: boolean }>();
  const turns = framedTurnWrites(entry);
  for (const write of turns) {
    const run = turns.filter((candidate) => candidate.collection === write.collection);
    if (run.length < 2) continue;
    chains.set(write.slot, { first: run[0]!.slot, last: run.at(-1)!.slot === write.slot });
  }
  return chains;
}

/** The segments each written data record is declared in, and the dynamic values the entry's writes grow. */
interface FramedRecordWriteSegments {
  /** Every segment each written data record is declared in, in segment order. */
  readonly segments: ReadonlyMap<number, readonly FramedWriteSegment[]>;
  /** The state variables whose write rebuilt each data record, per segment. */
  readonly writtenVariables: ReadonlyMap<number, ReadonlyMap<FramedWriteSegment, readonly string[]>>;
  /** The dynamic values a write grows, whose run of chunk records the epilogue pins. */
  readonly variables: readonly FramedDynamicWrite[];
}

/** Segment order: the counted segments first, then the run's own last one. */
function segmentOrder(left: FramedWriteSegment, right: FramedWriteSegment): number {
  if (left === right) return 0;
  if (left === 'last') return 1;
  if (right === 'last') return -1;
  return left - right;
}

/** One dynamic value an entry writes, with the element fields every write to it provably leaves unchanged. */
interface FramedDynamicWrite {
  readonly name: string;
  /** The intersection of the fields the writes preserve; absent when any write's effect is unknown. */
  readonly preservedFields?: readonly string[];
}

/** True when two expressions are the same compile-time key: an identifier of the same name, or the same literal. */
function sameWrittenKey(left: ExpressionNode | undefined, right: ExpressionNode | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left.constructor !== right.constructor) return false;
  if (left instanceof IdentifierNode && right instanceof IdentifierNode) return left.name === right.name;
  if (left instanceof LiteralNode && right instanceof LiteralNode) return String(left.value) === String(right.value);
  return false;
}

/** True when an element read's base reaches `variableName` at the key the write targets. */
function readsSameElement(base: Node, variableName: string, key: ExpressionNode | undefined): boolean {
  if (base instanceof MappingAccessNode) {
    return base.name === variableName && sameWrittenKey(base.keys?.[0], key);
  }
  if (base instanceof StateAccessNode) {
    return base.name === variableName && key === undefined;
  }
  if (base instanceof ArrayAccessNode && base.array instanceof IdentifierNode) {
    return base.array.name === variableName && sameWrittenKey(base.index, key);
  }
  return false;
}

/** The fields a whole-element construction copies back unchanged, or undefined when its effect is not known. */
function preservedFieldsOfConstruction(
  value: ExpressionNode | undefined, key: ExpressionNode | undefined, variableName: string,
): readonly string[] | undefined {
  if (!(value instanceof FunctionCallNode)) return undefined;
  const preserved: string[] = [];
  for (const parameter of value.parameters ?? []) {
    if (!(parameter instanceof FieldAccessNode)) continue;
    if (!readsSameElement(parameter.expression, variableName, key)) continue;
    if (!preserved.includes(parameter.name)) preserved.push(parameter.name);
  }
  return preserved;
}

/** The intersection of two preserved-field sets, keeping only the fields both leave unchanged. */
function intersectFields(left: readonly string[], right: readonly string[]): string[] {
  return left.filter((field) => right.includes(field));
}

/**
 * The fields the element writes the source makes to `variableName` provably copy back unchanged.
 *
 * The source spells a partial element update as a whole-element construction whose untouched fields are read back
 * out of the element, so every field not named by the construction keeps the value the frame started with. The
 * write statements may have been redirected through the compiler's dynamic-array cache local, so the cache's own
 * element writes are read beside the state's: either spelling carries the same construction. A push, pop, delete
 * or whole-array assign changes the element set itself, so it leaves the answer unknown.
 */
function preservedElementFields(entry: FunctionDefinitionNode, variableName: string): readonly string[] | undefined {
  const cache = `__dlcache_${variableName}`;
  let start: string[] | undefined;
  let coarse = false;
  const include = (fields: readonly string[]): void => {
    start = start === undefined ? [...fields] : intersectFields(start, fields);
  };
  const consider = (value: ExpressionNode | undefined, key: ExpressionNode | undefined, base: string): void => {
    const fields = preservedFieldsOfConstruction(value, key, base);
    if (fields === undefined) coarse = true;
    else include(fields);
  };
  walkInvocationAst(entry.body, (node) => {
    if (coarse) return;
    if (node instanceof StateArrayAssignNode && (node.name === variableName || node.name === cache)) {
      consider(node.value, node.index, node.name === variableName ? variableName : cache);
    } else if (node instanceof ArrayAssignNode && node.name === cache) {
      consider(node.value, node.index, cache);
    } else if ((node instanceof StateArrayPushNode || node instanceof StateArrayPopNode
      || node instanceof StateArrayDeleteNode) && (node.name === variableName || node.name === cache)) {
      coarse = true;
    } else if ((node instanceof ArrayPushNode || node instanceof ArrayPopNode || node instanceof ArrayDeleteNode)
      && node.name === cache) {
      coarse = true;
    } else if (node instanceof AssignNode && node.identifier.name === cache) {
      coarse = true;
    } else if (node instanceof StateAssignNode && node.name === variableName
      && !(node.expression instanceof IdentifierNode && node.expression.name === cache)) {
      coarse = true;
    }
  });
  return coarse || start === undefined ? undefined : start;
}

/**
 * The segments each of the entry's own data records is declared in, or undefined when one is not fixed.
 *
 * A record is rebuilt from the fields the body holds where the segment that wrote them closes, so every segment a
 * write of it lands in is a segment its declaration changes in: one a guard writes on entry and on exit is declared
 * in both, whatever record it is. The segments are published in the order the writes land in, which is what a
 * builder needs to chain them — the value between two of them is not the plan's to state. A write to a field the
 * record only sizes takes the record with it into the run's last segment wherever the source makes it, because the
 * record is only rebuilt once the chunk run is written there. A call the frame makes while it holds none of the
 * record's dynamic fields still closes the record where its other fields' writes left it, so such a record is
 * declared written in each segment one of those writes lands in before the frame first holds a dynamic field, and
 * in the last. A write the source does not locate leaves the whole entry unstated, which the builder refuses by name.
 */
function framedRecordWriteSegments(
  steps: readonly FramedWriteStep[],
  entry: FunctionDefinitionNode,
): FramedRecordWriteSegments | undefined {
  const sized = new Set<number>();
  // The fewest calls any path makes before the frame holds one of a record's dynamic fields; undefined where the
  // place a dynamic write is held from is not fixed.
  const dynamicHeld = new Map<number, number | undefined>();
  const variables = new Map<string, Set<string> | null>();
  const segments = new Map<number, Set<FramedWriteSegment>>();
  const writtenVariables = new Map<number, Map<FramedWriteSegment, Set<string>>>();
  for (const step of steps) {
    if (step.statement instanceof MappingAssignNode || step.statement instanceof MappingDeleteNode) continue;
    const stateVariable = (step.statement as { readonly stateVariable?: StateVariableNode }).stateVariable;
    if (stateVariable === undefined) return undefined;
    if (stateVariable.isDynamic === true) {
      sized.add(stateVariable.nftIndex);
      const held = step.heldFrom?.least;
      const before = dynamicHeld.has(stateVariable.nftIndex)
        ? dynamicHeld.get(stateVariable.nftIndex) : Number.POSITIVE_INFINITY;
      dynamicHeld.set(stateVariable.nftIndex,
        held === undefined || before === undefined ? undefined : Math.min(before, held));
      const names = writtenVariables.get(stateVariable.nftIndex) ?? new Map<FramedWriteSegment, Set<string>>();
      const lastName = names.get('last') ?? new Set<string>();
      lastName.add(stateVariable.name);
      names.set('last', lastName);
      writtenVariables.set(stateVariable.nftIndex, names);
      const preserved = preservedElementFields(entry, stateVariable.name);
      const incoming = preserved === undefined ? null : new Set(preserved);
      const previous = variables.has(stateVariable.name) ? variables.get(stateVariable.name)! : undefined;
      if (previous === undefined) variables.set(stateVariable.name, incoming);
      else if (previous === null || incoming === null) variables.set(stateVariable.name, null);
      else for (const field of [...previous]) if (!incoming.has(field)) previous.delete(field);
      continue;
    }
    const segment = writeStepSegment(step);
    if (segment === undefined) return undefined;
    const forRecord = segments.get(stateVariable.nftIndex) ?? new Set<FramedWriteSegment>();
    forRecord.add(segment);
    segments.set(stateVariable.nftIndex, forRecord);
    const names = writtenVariables.get(stateVariable.nftIndex) ?? new Map<FramedWriteSegment, Set<string>>();
    const atSegment = names.get(segment) ?? new Set<string>();
    atSegment.add(stateVariable.name);
    names.set(segment, atSegment);
    writtenVariables.set(stateVariable.nftIndex, names);
  }
  const written = new Map<number, readonly FramedWriteSegment[]>();
  for (const [record, at] of segments) {
    // Every segment the record's own writes land in is published, in segment order: the emitter closes a written
    // record in each of them, so a builder places a record's declarations in all of them rather than in one. A sized
    // record is closed at a call only while the frame holds none of its dynamic fields.
    const held = dynamicHeld.get(record);
    written.set(record, sized.has(record)
      ? [...[...at].filter((segment): segment is number => typeof segment === 'number' && held !== undefined
        && segment < held).sort((left, right) => left - right), 'last']
      : [...at].sort(segmentOrder));
  }
  for (const record of sized) if (!written.has(record)) written.set(record, ['last']);
  const dynamicWrites: FramedDynamicWrite[] = [...variables].map(([name, fields]) =>
    (fields === null ? { name } : { name, preservedFields: [...fields] }));
  const recordWriters = new Map<number, ReadonlyMap<FramedWriteSegment, readonly string[]>>();
  for (const [record, perSegment] of writtenVariables) {
    recordWriters.set(record, new Map([...perSegment].map(([segment, names]) => [segment, [...names]] as const)));
  }
  return { segments: written, writtenVariables: recordWriters, variables: dynamicWrites };
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
 * it to the body as an argument. A framed master takes no such argument list: its frame declares where the
 * contract's records are, and the run sits a fixed width past that declaration, so the head derives the coordinate
 * from the frame and leaves it where the body reads it.
 */
export function derivableDynamicChunkNames(fn: FunctionDefinitionNode): Set<string> | undefined {
  return fn.usesDynamicChunkInputBase === true ? new Set([DYNAMIC_CHUNK_BASE_PARAMETER]) : undefined;
}

export interface FramedMasterShapeInput {
  readonly contract: ContractNode;
  /** The options the unit compiles with, which bound the recurrence a loop's effects are counted by. */
  readonly compilerOptions?: CompilerOptions;
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
  /** The bodies code generation refused for a loop guard their published recipe cannot carry, with the reason. */
  readonly loopGuardRefusals?: ReadonlyMap<string, string>;
  /** The unit's file-level constants, which a body reads as it reads the contract's own. */
  readonly fileConstants?: readonly ConstantDefinitionNode[];
}

/** One entry's external calls, in execution order, which that entry's own sites bind. */
export interface FramedEntryCallSites {
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
  readonly writeSegment?: FramedWriteSegment;
  /**
   * The segment each of the entry's own writes is declared in, one fact per write.
   *
   * A body whose writes do not all land in one segment publishes no single `writeSegment`, but each of its writes
   * still names its own segment here, which is what lets a builder place each write's records in the segment code
   * generation places them in. An empty list is a body that writes no record of its own, and absent means a write's
   * segment is not fixed, which the builder refuses by name.
   */
  readonly writeSegments?: readonly FramedWriteSegmentFact[];
  /** For each value send, in transfer order, how many external calls the entry makes before it, when fixed. */
  readonly sendCallsBefore?: readonly number[];
  /** The effects the entry makes once per turn of a loop, as runs a builder expands by the turns. */
  readonly loopEffects?: PublishedLoopEffects;
}

export interface FramedMasterShapeAssessment {
  readonly supported: boolean;
  /** Why the whole contract is refused, phrased as a fact about the master rather than about one body. */
  readonly reason?: string;
  /** One descriptor list per entry, in entry order; each entry's sites resolve against its own list. */
  readonly entryCalls?: readonly FramedEntryCallSites[];
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
 * a framed master is assessed, so the accesses are no longer state reads even though the nodes remain.
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

/** Assesses whether the contract can be emitted as a framed master program. */
export function assessFramedMasterShape(input: FramedMasterShapeInput): FramedMasterShapeAssessment {
  const { contract } = input;
  markDynamicStateBodies(contract);
  const constants = constantNames(contract, input.fileConstants ?? []);
  const refuse = (reason: string): FramedMasterShapeAssessment => ({ supported: false, reason });
  if (contract.constructorDef) {
    // The constructor runs as one more selector-dispatched body behind the same head, so it is admitted exactly when
    // its body asks the head for nothing the head does not already carry: it makes no external call (the head's call
    // records are the entries'), it makes no send (the head fixes one send list for every body), and it needs no
    // side-car input the head does not locate. Its event count is pinned by its own body against the head's region.
    const refusal = unsupportedConstructorShape(contract.constructorDef, constants);
    if (refusal !== undefined) return refuse(refusal);
  }
  // receive() is an entry like any other: a framed frame always carries call data, and a value send's carries the
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
  // The effects each body makes once per turn of a loop, published beside its calls for a builder to lay.
  const loopEffectsByEntry = new Map<string, PublishedLoopEffects>();
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
      refuseBody(fn, 'inline assembly is not composed framed');
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
        + `input index through the hidden parameter '${proxyMasterWitness.name}', and a framed master serves a `
        + 'delegate frame from the records its own frame declares instead');
    }
    const hidden = fn.parameters.filter((parameter) =>
      isUndeclaredHiddenParameter(fn, parameter.name, constants));
    if (hidden.length > 0) {
      refuseBody(fn, `the body carries the hidden parameter '${hidden[0].name}', which the master head does not `
        + 'supply');
    }
    // An event, a send or a hash a loop repeats takes as many outputs or side-cars as the loop turns: the head checks
    // the run of them the block lists, and the body binds each where it makes it and pins how many it made, so a
    // builder only has to know their order. A body whose order no builder could reconstruct is refused on its own.
    // A lowering that turns a loop into a counted trailing stream journals its effects for the direct convention,
    // which a master does not read.
    if ((fn.runtimeLoopEvents?.length ?? 0) > 0 || (fn.runtimeLoopTransfers?.length ?? 0) > 0) {
      refuseBody(fn, 'a loop lowered into a counted trailing stream journals its events and sends for the direct '
        + 'convention, which a master does not read');
    }
    const loopEffects = bodyLoopEffects(fn, input.compilerOptions ?? {});
    if (loopEffects.reason !== undefined) refuseBody(fn, loopEffects.reason);
    if (loopEffects.effects !== undefined) loopEffectsByEntry.set(fn.name, loopEffects.effects);
    // A hash a loop reaches only through another function's body is one this body's own walk does not count.
    if (fn.keccakCompute && fn.keccakInLoop === true && loopEffects.effects?.hashes === undefined) {
      refuseBody(fn, 'a keccak256 call a loop reaches through another function reads one side-car per turn, which '
        + 'the body\'s own count of side-cars does not include');
    }
    // A balance read takes out what each send statement's slot holds, which a loop's send overwrites per turn.
    if (loopEffects.effects?.sends !== undefined && balanceReads(fn.body).own) {
      refuseBody(fn, 'the body reads its contract\'s balance and sends from a loop, so the amount it has sent is no '
        + 'sum of its send statements');
    }
    if (fn.usesBlockhash || contract.usesBlockhash) {
      refuseBody(fn, 'a blockhash read needs a co-spent oracle input the master head does not locate');
    }
    // A recovery loop reads its pair per iteration from a run-time counter, which the head would have to place a
    // variable number of inputs for; the straight-line framed pair is what the head locates.
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
    // A loop guard the published recipe cannot carry is found by code generation, which compiles again with it here.
    const loopGuard = input.loopGuardRefusals?.get(fn.name);
    if (loopGuard !== undefined) {
      refuseBody(fn, loopGuard);
      if (!entryNames.has(fn.name)) stubbed.add(fn.name);
    }
  }
  const { constructorDef } = contract;
  const constructorLoopGuard = constructorDef && input.loopGuardRefusals?.get(constructorDef.name);
  if (constructorDef && constructorLoopGuard !== undefined) refuseBody(constructorDef, constructorLoopGuard);
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
  // A body the master serves as a subroutine - a `this.f()` self-call - compiles as a define sub-traversal, which
  // returns at the body's values and never reaches the sorted-batch transition epilogue or the segment close
  // (GenerateTargetTraversal.visitFunctionDefinition). Its caller carries none of the callee's writes either: the
  // caller's own accesses name the call, not the mapping nodes the callee writes. So a sorted-mapping write the
  // callee derives keeps only the inline per-target output pin its body emits, while the predecessor relink of an
  // insert, the distinct-target check and the collection's node-count census go unproven - a forged segment could
  // settle two nodes for one key, or a node the list skips. Where the write's segment lands does not matter, because
  // no transition is emitted in any of these frames. Refuse such a body by name, whatever its caller's calls; called
  // directly, its own entry frame emits the transition and settles it.
  const subroutineNames = new Set<string>();
  for (const names of invokes.values()) for (const name of names) subroutineNames.add(name);
  for (const name of subroutineNames) {
    const fn = entryPoints.find((entry) => entry.name === name);
    if (fn === undefined || refusals.has(name)) continue;
    if (derivableBatchWitnessNames(fn, constants) === undefined) continue;
    refuseBody(fn, 'the body derives a sorted-mapping write and is run as a subroutine by a self-call, whose frame '
      + 'never emits the batch transition that proves the write\'s topology (the predecessor relink, the '
      + 'distinct-target check and the node count); call it directly so its own entry frame proves it');
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

  const calls = deriveFramedMasterCallSites(input.interfaces, served, stateVariableNames);
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
      if (framedBatchWriteSegment(fn) !== undefined) continue;
      if (framedBatchWriteFollowsEveryCall(fn)) continue;
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
  const tail = deriveFramedTailShape(
    bodies,
    undefined,
    // An emit the survey found belongs to a body; the bodies the master serves are the ones whose emits it has to
    // account for, since a refused body's emit is part of what refuses it.
    bodies.some((body) => (body.emitInfos?.length ?? 0) > 0),
  );
  if (tail.reason !== undefined) return refuse(tail.reason);
  const entryCalls = calls.entryCalls.filter((entry) => !refusals.has(entry.entryName)).map((entry) => {
    const loopEffects = loopEffectsByEntry.get(entry.entryName);
    return loopEffects === undefined ? entry : { ...entry, loopEffects };
  });
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
 * The bodies a direct artifact publishes as refused, given the bodies refused on their own: the callable ones among
 * those (an entry point, receive(), the fallback or the constructor), and every callable body that runs one, since a
 * refused body is emitted as a refusal wherever it is reached.
 */
export function directRefusedEntries(
  contract: ContractNode, refusals: ReadonlyMap<string, string>,
): [string, string][] {
  const callable = [
    contract.constructorDef, ...contract.functions.filter((fn) => fn.isEntryPoint), contract.receiveDef,
    contract.fallbackDef,
  ].filter((fn): fn is FunctionDefinitionNode => fn !== undefined);
  const bodies = [...callable, ...contract.functions.filter((fn) => !fn.isEntryPoint)];
  const invokes = new Map(bodies.map((fn) => [fn.name, invokedFunctionNames(fn.body)]));
  const reached = closeRefusalsOverInvocations(invokes, refusals);
  return callable.flatMap((fn): [string, string][] => {
    const own = refusals.get(fn.name);
    if (own !== undefined) return [[fn.name, own]];
    const via = reached.get(fn.name);
    return via === undefined ? [] : [[fn.name, `it runs '${via.name}', which is refused: ${via.reason}`]];
  });
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
  // A genesis lists the events its constructor's source fixes, one per emit, and plans no loop's turns.
  if ((constructorDef.runtimeLoopEvents?.length ?? 0) > 0 || loopEffectKinds(constructorDef).has('events')) {
    return 'the constructor emits an event from a loop, whose turns its genesis does not count';
  }
  if (constructorDef.usesBlockhash) {
    return 'the constructor reads a blockhash, which needs a co-spent oracle input the master head does not locate';
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
export interface FramedTailDerivation {
  readonly tail?: MasterTailShape;
  readonly reason?: string;
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
 * A listed send's recipient lock is a run-time value, so the tail cannot check the output's shape; the body that
 * computed the send pins the lock and the value it computed at the listed output, and the region is as wide as the
 * most sends any body lists. A body that emits or sends from a loop makes as many as the loop turns, so its master's
 * head parks that region as a run instead: the first listed output and the declared count, the run checked whole,
 * and each body binds its k-th effect at the run's k-th output. A loop a lowering turned into a counted trailing
 * stream journals its effects for the direct convention, which no head reads. Segments are not fixed here: the
 * records a segment touches are decided by settlement, so the head walks each segment's declared count.
 */
export function deriveFramedTailShape(
  entryPoints: readonly FunctionDefinitionNode[],
  constructorDef: FunctionDefinitionNode | undefined,
  emitsEvent: boolean,
): FramedTailDerivation {
  const bodies = constructorDef === undefined ? entryPoints : [...entryPoints, constructorDef];
  let maxEventCount = 0;
  for (const body of bodies) {
    if ((body.runtimeLoopEvents?.length ?? 0) > 0 || (body.runtimeLoopTransfers?.length ?? 0) > 0) {
      return { reason: 'a loop lowered into a counted trailing stream journals its events and sends for the direct '
        + 'convention, which a master does not read' };
    }
    maxEventCount = Math.max(maxEventCount, body.emitInfos?.length ?? 0);
  }
  if (emitsEvent && maxEventCount === 0) {
    return { reason: 'the contract emits an event that is not attributed to a body, so the master cannot fix '
      + 'how many events the tail holds' };
  }
  // Every body's transfers take the region's first positions in their own source order, and a body that lists
  // fewer requires the no-index sentinel at the positions past its own, so bodies may list different numbers.
  const sendCount = Math.max(0, ...bodies.map((body) => bodySendSlots(body)));
  const valueWitnessCount = Math.max(0, ...bodies.map((body) => valueWitnessSlotsOf(body)));
  const looped = bodies.map((body) => loopEffectKinds(body));
  const eventRun = looped.some((kinds) => kinds.has('events'));
  const sendRun = looped.some((kinds) => kinds.has('sends'));
  return {
    tail: {
      maxEventCount, sendCount, valueWitnessCount,
      ...(eventRun ? { eventRun: true } : {}),
      ...(sendRun ? { sendRun: true } : {}),
    },
  };
}

/** The call sites each entry makes, or why the head cannot check them. */
type CallSitesDerivation = {
  readonly supported: true;
  readonly entryCalls: readonly FramedEntryCallSites[];
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
function deriveFramedMasterCallSites(
  interfaces: readonly InterfaceNode[],
  entryPoints: readonly FunctionDefinitionNode[],
  stateVariables: ReadonlySet<string>,
): CallSitesDerivation {
  const entryCalls: FramedEntryCallSites[] = [];
  const refusals = new Map<string, string>();
  for (const entry of entryPoints) {
    const derived = deriveEntryCallSites(interfaces, entry, stateVariables);
    if (derived.reason !== undefined) {
      refusals.set(entry.name, derived.reason);
      continue;
    }
    const writeSegment = framedWriteSegment(entry);
    const writeSegments = framedWriteSegments(entry);
    const sendCallsBefore = framedSendCallsBefore(entry);
    entryCalls.push({
      entryName: entry.name,
      calls: derived.calls,
      pathCount: derived.pathCount,
      ...(callsRepeat(entry.body) ? { repeats: true } : {}),
      ...(writeSegment === undefined ? {} : { writeSegment }),
      ...(writeSegments === undefined ? {} : { writeSegments }),
      ...(sendCallsBefore === undefined ? {} : { sendCallsBefore }),
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

/**
 * The fewest and most calls a block makes on any one path, or undefined when a construct leaves the count open.
 * With `countSends`, a value send counts as a call some paths make, as it is one where its recipient is a contract.
 */
function callCountRange(block: BlockNode | undefined, countSends = false): { least: number; most: number } | undefined {
  let least = 0;
  let most = 0;
  for (const statement of block?.statements ?? []) {
    const range = statementCallRange(statement, countSends);
    if (range === undefined) return undefined;
    least += range.least;
    most += range.most;
  }
  return { least, most };
}

/** The fewest and most calls one statement makes on any one path, or undefined when it leaves the count open. */
function statementCallRange(statement: Node, countSends = false): { least: number; most: number } | undefined {
  if (statement instanceof BranchNode) {
    const inCondition = callsInExpression(statement.condition);
    const sendsInCondition = countSends ? sendsIn(statement.condition) : 0;
    const inIf = callCountRange(statement.ifBlock, countSends);
    const inElse = statement.elseBlock === undefined
      ? { least: 0, most: 0 }
      : callCountRange(statement.elseBlock, countSends);
    if (inCondition === undefined || inIf === undefined || inElse === undefined) return undefined;
    return {
      least: inCondition + Math.min(inIf.least, inElse.least),
      most: inCondition + sendsInCondition + Math.max(inIf.most, inElse.most),
    };
  }
  if (statement instanceof BlockNode) return callCountRange(statement, countSends);
  // A statement that sends makes a call where its recipient is a contract, so its sends widen the range; a send in
  // a loop is refused elsewhere, and one in a switch counts on every arm, which only widens it further.
  if (countSends && !(statement instanceof TryCatchNode) && sendsIn(statement) > 0) {
    const own = callsInExpression(statement);
    return own === undefined ? undefined : { least: own, most: own + sendsIn(statement) };
  }
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
    const inTry = callCountRange(statement.tryBlock, countSends);
    if (inExpression === undefined || inTry === undefined) return undefined;
    const sendsInExpression = countSends ? sendsIn(statement.expression) : 0;
    return { least: inExpression + inTry.least, most: inExpression + sendsInExpression + inTry.most };
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

/** Why a low-level call whose shape a framed master does not bind is refused. */
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
  return hasForwardingFallback(contract);
}

/**
 * True when the contract's fallback forwards the call data it received to an address the contract holds, whether
 * it is the only body or one a dispatcher reaches beside other entries.
 */
export function hasForwardingFallback(contract: ContractNode): boolean {
  return contract.fallbackDef !== undefined
    && isForwardingFallback(contract.fallbackDef, new Set(contract.stateVariables.map((state) => state.name)));
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
  // A value send is such a call where its recipient is a contract.
  if ((entry.sortedBatchInfo?.length ?? 0) > 0 && (varying || (entry.transferInfos?.length ?? 0) > 0)
    && framedBatchWriteSegment(entry) === undefined
    && !framedBatchWriteFollowsEveryCall(entry)) {
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
    // A `call` mode is a low-level `.call` the lowering typed from its payload, whose spelling chose a message frame.
    if (slot.callMode !== undefined
      && slot.callMode !== ExternalCallMode.REGULAR
      && slot.callMode !== ExternalCallMode.STATICCALL
      && !(slot.callMode === ExternalCallMode.CALL && slot.sourceCallNode?.lowLevelRoute !== undefined)) {
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
    // settled by the segments rather than by a co-spent input this master locates. An opaque return is the direct
    // path's own machinery, which a framed body does not emit.
    if (slot.opaqueReturn === true) {
      return { calls: [], reason: `the call to '${slot.functionName}' takes the direct path's return-event or `
        + 'value-transfer machinery, which a framed body does not emit' };
    }
    // A call value is carried by the site's own record, not by a transfer of the body's: the caller's code computes
    // the amount where it calls and the site holds the record's `value` to it, the validator holds the callee's frame
    // value to the record (V5), and the value rule charges it to the caller's containers and credits the callee's (V7,
    // or the head of a frame that settles alone). A read takes no value; an amount computed by another call would bind
    // that call's record out of the order the calls run in; and a value send of the body's own beside it is numbered
    // over arms that still count the call's value, so each is refused by name.
    const carriesValue = slot.callValueEffect === true;
    if (carriesValue && isReadCall(slot, interfaces)) {
      return { calls: [], reason: `the call to '${slot.functionName}' carries a value into a read, which a static `
        + 'frame never takes' };
    }
    if (carriesValue && reachesAnyCall(slot.sourceCallNode?.callOptions?.value)) {
      return { calls: [], reason: `the call to '${slot.functionName}' computes its value with another call, whose `
        + 'record would be bound out of the order the calls run in' };
    }
    if (carriesValue && (entry.transferInfos?.length ?? 0) > 0) {
      return { calls: [], reason: `the call to '${slot.functionName}' carries a value beside a value send of the `
        + 'body\'s own, whose numbering a framed body does not reconcile with the call\'s yet' };
    }
    const target = siteTarget(slot);
    if ('reason' in target) return { calls: [], reason: target.reason };
    // A call routed to the target's fallback carries its payload's own selector, which no method of it names.
    const selector = slot.compileTimeSelector ?? slot.sourceCallNode?.lowLevelRoute?.fallback?.selector
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
      ...(carriesValue ? { valueFromStack: true } : {}),
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


