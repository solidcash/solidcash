import {
  AbiFunction, Artifact, CompilerOptions, DebugInformation, Script, scriptToAsm, StateLayout, ArrayType,
  computeCollectionSignature, computeFunctionSelectorHex, ExternalInterfaceInfo, MappingType, Type, ValueType,
  EnumType, ExternalLibraryAbi, BUILTIN_LIBRARIES, resolveLibraries, sidecarCodeRange, isChunkableValueType,
  ValueProvenance, ValueProvenanceKind,
} from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';
import { version } from '../index.js';
import {
  Ast, StateVariableVisibility, InterfaceNode, InterfaceCollectionNode, ExternalCallMode,
  StructDefinitionNode, FunctionDefinitionNode, FunctionModifier, Node, ContractNode,
  ExpressionNode, TransferStatementNode, BlockNode, WhileNode, VariableDefinitionNode,
  BinaryOpNode, IdentifierNode, AssignNode, TupleAssignmentNode,
  ArrayNode, CastNode, FunctionCallNode, LiteralNode, LowLevelCallNode,
  LowLevelCallStatementNode, StateAccessNode, RequireNode, ExternalFunctionCallNode,
} from '../ast/AST.js';
import { BinaryOperator } from '../ast/Operator.js';
import { containsStatefulOperation } from '../semantic/EnsureFinalRequireTraversal.js';
import { fixedForMaximum } from '../semantic/FixedForLoop.js';
import { parameterCommitmentSource } from '../semantic/SymbolTableTraversal.js';

/** The mapping key type as the SDK must ENCODE it. An enum key is int-backed (the compiler stores/derives it as
 * its integer member value), so it encodes as 'bigint' - its VM representation - not the enum name. The enum
 * name is still surfaced in the ABI (function params); only the state-encoding key type is normalized. */
function keyEncodingTypeString(type: Type): string {
  return type instanceof EnumType ? 'bigint' : type.toString();
}

/** Unwrap ValueType to its underlying type string for ABI serialization. */
function abiTypeString(type: Type | undefined): string {
  // A contract-reference type (e.g. an imported contract used as a parameter/event type) has no resolved Type;
  // on BCH a contract handle is an address, so default to 'address' rather than crashing on undefined.toString().
  if (!type) return 'address';
  if (type instanceof ValueType) return type.underlyingType.toString();
  return type.toString().replace(/address payable/g, 'address');
}

/**
 * One `keccakPreimageParams` entry per RESERVED `keccakSideCar` slot.
 *
 * `computeBlockLayout` reserves a slot per counted keccak256 call, but code generation records a preimage param
 * only for a call it emits under this function's own traversal. A call reached through an internal helper is
 * emitted while `currentFunction` is the HELPER, so its param lands there and the entry point publishes none -
 * and the SDK, which co-spends one side-car per published param, then supplies zero side-cars for a covenant
 * that reads one. It reads whatever input sits at that index instead (measured on MistSwap's BentoBox
 * constructor: the funder's unlocking script, compared against the computed keccak argument).
 *
 * Pad the published list to the reserved slot count with `null` - the SDK's "not a direct parameter" marker,
 * which routes to its VM probe. A keccak-loop function reserves no fixed slots and is left alone.
 */
function keccakPreimageParamsFor(func: FunctionDefinitionNode): (string | null)[] {
  const recorded = func.keccakPreimageParams ?? [];
  if (func.keccakInLoop || !func.blockLayout) return recorded;
  const reserved = func.blockLayout.slots.filter((slot) => slot.kind === 'keccakSideCar').length;
  if (reserved <= recorded.length) return recorded;
  return [...recorded, ...Array.from({ length: reserved - recorded.length }, () => null)];
}

// Covenant-bypass / full-state modifiers: a function carrying one may touch any state, so treat as a writer.
const STATE_WRITING_MODIFIERS = [
  FunctionModifier.UPGRADE, FunctionModifier.SELFDESTRUCT, FunctionModifier.UNSAFE,
];

/** Multiply two reached-count factors, where undefined means "not proven" and poisons the product. */
const composeCount = (outer: number | undefined, inner: number | undefined): number | undefined =>
  outer === undefined || inner === undefined ? undefined : outer * inner;

/**
 * True when a loop body can stop short of its trip count.
 *
 * `continue` is rewritten into a branch before this runs, so it is caught by the branch rule, but a `return`
 * inside a loop survives to artifact generation as a plain sibling of the callsite: without this check
 * `for (i < 3) { if (flag) { return; } m(); }` would publish a floor of three while reaching zero.
 */
const loopCanExitEarly = (loop: WhileNode): boolean => {
  let found = false;
  const walk = (value: unknown): void => {
    if (found || !(value instanceof Node)) return;
    if (/^(ReturnNode|BreakNode|ContinueNode)$/.test(value.constructor.name)) {
      found = true;
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'location') continue;
      if (child instanceof Node) walk(child);
      else if (Array.isArray(child)) for (const item of child) walk(item);
    }
  };
  walk(loop.block);
  return found;
};

type OccurrenceInfo = {
  occurrence: 'once' | 'conditional' | 'loop';
  maximumOccurrences?: number;
  minimumOccurrences?: number;
  occurrenceBoundSource?: 'literal' | 'guard' | 'structural';
};

/**
 * Classify one callsite's reached-occurrence count inside its function.
 *
 * Two independent quantities are tracked down every path to the callsite. `reachedMaximum` is the product of
 * the trip counts of every enclosing loop and is the published CEILING; one unproven loop poisons it, and
 * nesting multiplies rather than replaces - an inner literal loop under an outer one reaches
 * `outer * inner` rows, not `inner`. `reachedExact` is the same product restricted to paths that cross no
 * branch at all, so it is a FLOOR as well as a ceiling: it survives only when every enclosing loop has a
 * compile-time trip count and nothing conditional stands between the function entry and the callsite.
 */
const occurrenceInfoOf = (
  fn: FunctionDefinitionNode, target: Node | undefined,
): OccurrenceInfo => {
  if (!target) return { occurrence: 'once' };
  let found: 'once' | 'conditional' | 'loop' = 'once';
  let maximumOccurrences: number | undefined;
  let minimumOccurrences: number | undefined;
  let literalBound = false;
  const seen = new Set<object>();
  // Loops whose trip count the enclosing block already folded in, so the generic walk does not re-enter them.
  const counted = new Set<Node>();
  const visit = (
    value: unknown, context: 'once' | 'conditional' | 'loop',
    reachedMaximum: number | undefined, reachedExact: number | undefined,
  ): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value === target) {
      found = context;
      maximumOccurrences = context === 'loop' ? reachedMaximum : 1;
      minimumOccurrences = context === 'loop' ? reachedExact : undefined;
      // `once`/`conditional` carry their provenance in the class itself, so only a loop bound - which could
      // also have come from a require guard - spends artifact bytes recording where it came from.
      literalBound = context === 'loop' && reachedMaximum !== undefined;
      return;
    }
    if (value instanceof BlockNode) {
      const statements = value.statements ?? [];
      statements.forEach((statement, index) => {
        if (statement instanceof WhileNode) {
          const trips = fixedForMaximum(statements[index - 1], statement);
          counted.add(statement);
          const exactTrips = loopCanExitEarly(statement) ? undefined : trips;
          visit(statement, 'loop', composeCount(reachedMaximum, trips), composeCount(reachedExact, exactTrips));
        } else {
          visit(statement, context, reachedMaximum, reachedExact);
        }
      });
      return;
    }
    const kind = value.constructor.name;
    const isLoop = /^(WhileNode|DoWhileNode)$/.test(kind);
    const nested = isLoop
      ? 'loop'
      : /^(BranchNode|SwitchNode|SwitchCaseNode)$/.test(kind) && context === 'once'
        ? 'conditional'
        : context;
    // A loop the enclosing block did not fold in (a do-while, or a while whose header is not a canonical
    // literal for-loop) contributes an unproven number of trips, so both quantities stop being proven.
    const childMaximum = isLoop && !counted.has(value) ? undefined : reachedMaximum;
    // Anything that can skip the callsite kills the FLOOR while leaving the ceiling intact. A ternary arm is
    // listed here but deliberately not in the `conditional` classification above: it can skip a reach, but
    // changing which class a callsite reports would change published behaviour rather than tighten a bound.
    const childExact = (isLoop && !counted.has(value))
      || /^(BranchNode|SwitchNode|SwitchCaseNode|TernaryOpNode)$/.test(kind) ? undefined : reachedExact;
    for (const [key, child] of Object.entries(value)) {
      if ([
        'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
        'referencedContract', 'stateVariable', 'collection',
      ].includes(key)) continue;
      if (child instanceof Node) visit(child, nested, childMaximum, childExact);
      else if (Array.isArray(child)) for (const item of child) visit(item, nested, childMaximum, childExact);
    }
  };
  visit(fn.body, 'once', 1, 1);
  return {
    occurrence: found,
    ...(maximumOccurrences !== undefined && { maximumOccurrences }),
    ...(minimumOccurrences !== undefined && { minimumOccurrences }),
    ...(literalBound ? { occurrenceBoundSource: 'literal' as const } : {}),
  };
};

const expressionSource = (
  expression: ExpressionNode, fn: FunctionDefinitionNode, contract: ContractNode,
): { kind: 'forward' | 'constructorArg' | 'literal' | 'expression';
  paramIndex?: number; paramName?: string; value?: string; type?: string } => {
  const shaped = expression as unknown as { name?: string; value?: unknown; type?: Type };
  if (expression.constructor.name === 'IdentifierNode' && shaped.name) {
    const visible = fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
    const parameterIndex = visible.findIndex((parameter) => parameter.name === shaped.name);
    if (parameterIndex >= 0) return { kind: 'forward', paramIndex: parameterIndex };
    if (contract.parameters.some((parameter) => parameter.name === shaped.name)) {
      return { kind: 'constructorArg', paramName: shaped.name };
    }
  }
  const kind = expression.constructor.name;
  if (kind === 'BoolLiteralNode') {
    return { kind: 'literal', value: String(shaped.value), type: 'bool' };
  }
  if (kind === 'IntLiteralNode') {
    return { kind: 'literal', value: String(shaped.value), type: shaped.type?.toString() ?? 'bigint' };
  }
  if (kind === 'StringLiteralNode') {
    return { kind: 'literal', value: String(shaped.value), type: 'string' };
  }
  if (kind === 'HexLiteralNode' && shaped.value instanceof Uint8Array) {
    return {
      kind: 'literal', value: binToHex(shaped.value), type: shaped.type?.toString() ?? 'bytes',
    };
  }
  return { kind: 'expression' };
};

const transferEffects = (
  fn: FunctionDefinitionNode, contract: ContractNode,
): readonly { transferIndex: number; recipient: ReturnType<typeof expressionSource>;
  amount: ReturnType<typeof expressionSource>; callOption?: 'value' }[] => {
  const transfers: {
    transferIndex: number; recipient: ExpressionNode; amount: ExpressionNode; callOption?: 'value';
  }[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof TransferStatementNode) transfers.push({
      transferIndex: value.transferIndex, recipient: value.lockingBytecode, amount: value.amount,
    });
    if (value instanceof ExternalFunctionCallNode && value.interfaceName === '__raw__'
      && value.callOptions?.value
      && value.valueTransferIndex >= 0) {
      transfers.push({
        transferIndex: value.valueTransferIndex,
        recipient: value.addressExpression,
        amount: value.callOptions.value,
        callOption: 'value',
      });
    }
    for (const [key, child] of Object.entries(value)) {
      if ([
        'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
        'referencedContract', 'stateVariable', 'collection',
      ].includes(key)) continue;
      if (child instanceof Node) visit(child);
      else if (Array.isArray(child)) for (const item of child) visit(item);
    }
  };
  visit(fn.body);
  return transfers.sort((a, b) => a.transferIndex - b.transferIndex).map((transfer) => ({
    transferIndex: transfer.transferIndex,
    recipient: expressionSource(transfer.recipient, fn, contract),
    amount: expressionSource(transfer.amount, fn, contract),
    ...(transfer.callOption && { callOption: transfer.callOption }),
  }));
};

/**
 * X135. True when every dynamic (chunk-backed) write this function publishes was RESERVED by the route's
 * journal rather than performed by the function.
 *
 * `GenerateTargetTraversal` pre-allocates one chunk slot per dynamic journal slot a handler HOLDS, and a
 * handler holds a slot it only READS: the epilogue then writes the pre-state value back unchanged, which is a
 * real co-spend of the chunk UTXOs and no state change at all. `dynamicWrites` stays published because the
 * build shape needs it - the SDK consumes and recreates those chunks - but a write-back is not a mutation,
 * and `writesState` is the flag that answers "output state == input state".
 *
 * Measured: ERC-20 `name()` / `symbol()` are `writesState: false` compiled DIRECT and were `true` compiled in
 * bus mode, from the same unchanged body. `decimals()` / `totalSupply()` never moved, because their journal
 * slots are scalar and X105 already gated the scalar sibling of this leak.
 *
 * SOUNDNESS. `scalarJournal` is set at GTT:2711 exactly when journal context is live AND the writer closure
 * reached this function, and that closure is transitive over internal calls (GTT:1745-1755) and over function
 * pointers (L2-F3), so a false answer cannot hide a write behind a helper. `journalContextArity` is set only
 * for a handler carrying live journal context, so DIRECT-mode dynamic writes - which carry none - are never
 * gated. The caller has already returned true for `scalarJournal`, so reaching here means "not a writer".
 */
const journalReservedDynamicWritesOnly = (func: FunctionDefinitionNode): boolean =>
  (func.journalContextArity ?? 0) > 0 && func.scalarJournal !== true;

/**
 * Conservatively decide whether a function mutates any covenant-derived state. Returns false ONLY when the body
 * has no stateful statement (state/array/mapping write, delete, emit, transfer, low-level/token-container op)
 * AND the function has no external call, child deploy, library delegate, dynamic-storage write, split/merge, or
 * covenant-bypass modifier. Any doubt -> true, so a misclassified writer never gets the SDK's derivation skip.
 */
function computeWritesState(func: FunctionDefinitionNode): boolean {
  if (func.scalarJournal) return true;
  if (containsStatefulOperation(func.body?.statements)) return true;
  if ((func.externalCalls?.length ?? 0) > 0) return true;
  if ((func.deployTargets?.length ?? 0) > 0) return true;
  if ((func.libraryDelegateCalls?.length ?? 0) > 0) return true;
  if ((func.dynamicWrites?.length ?? 0) > 0 && !journalReservedDynamicWritesOnly(func)) return true;
  if ((func.lowLevelCalls?.length ?? 0) > 0) return true;
  if (func.splitCountParam !== undefined || func.mergeCountParam !== undefined) return true;
  if (func.modifiers.some((m) => STATE_WRITING_MODIFIERS.includes(m))) return true;
  if (func.entryAccesses?.some((ea) => ea.operations.some((op) => op !== 'read'))) return true;
  return false;
}

// ----------------------------------------------------------------------------------------------------------
// X37. Value provenance: where a covenant-critical value came from, rather than what type it was spelled as.
// ----------------------------------------------------------------------------------------------------------

/**
 * How much a spender controls each provenance, weakest first.
 *
 * A value the caller passes is weakest. `computed` sits next because "the compiler could not say" is never
 * evidence of authority. The order exists so several binding sites, several key-set members, or several
 * signature guards can be folded into ONE published answer that always keeps the weakest: the published
 * field can then only ever understate the authority in force, which is a refusal, never an admission.
 */
const PROVENANCE_STRENGTH: Record<ValueProvenanceKind, number> = {
  parameter: 0, computed: 1, stateVar: 2, constructorArg: 3, literal: 4,
};

const COMPUTED_PROVENANCE: ValueProvenance = { kind: 'computed' };

const weakerProvenance = (left: ValueProvenance, right: ValueProvenance): ValueProvenance =>
  (PROVENANCE_STRENGTH[right.kind] < PROVENANCE_STRENGTH[left.kind] ? right : left);

// Links that leave the function body and reach whole other functions or contracts, where a same-named local
// would answer a different question. The same escape list the result-consumer walk below uses.
const PROVENANCE_WALK_SKIP = new Set([
  'location', 'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
  'referencedContract', 'stateVariable', 'collection',
]);

/** Which argument of each signature builtin is the KEY the signature is checked against. */
const SIGNATURE_CHECK_KEY_ARGUMENT: Record<string, number> = {
  checkSig: 1, checkMultiSig: 1, checkDataSig: 2,
};

/**
 * Everything the provenance answers need from one function body, collected in ONE walk.
 *
 * `bindings` holds every expression that can bind a local name - the declaration initializer AND every later
 * assignment. Collecting the assignments is what makes the fold sound: resolving only the declaration would
 * let `address t = impl; t = address(target); t.delegatecall(input);` publish the constructor argument while
 * the call reaches the caller's bytes. Block scoping is deliberately ignored, so two same-named locals in
 * sibling blocks fold to the weaker of the two. `bound` also holds names bound by a form with no nameable
 * expression (a tuple destructure), which must resolve to `computed` rather than escape to the outer scopes.
 *
 * Building the index up front is what keeps this affordable: resolving each alias with its own walk turned
 * artifact generation into a per-identifier re-traversal of the whole body.
 */
interface ProvenanceIndex {
  bindings: Map<string, ExpressionNode[]>;
  bound: Set<string>;
  calls: (LowLevelCallNode | LowLevelCallStatementNode)[];
  signatureChecks: FunctionCallNode[];
}

const bindName = (index: ProvenanceIndex, name: string, expression?: ExpressionNode): void => {
  index.bound.add(name);
  if (!expression) return;
  const existing = index.bindings.get(name);
  if (existing) existing.push(expression);
  else index.bindings.set(name, [expression]);
};

const indexBody = (fn: FunctionDefinitionNode): ProvenanceIndex => {
  const index: ProvenanceIndex = {
    bindings: new Map(), bound: new Set(), calls: [], signatureChecks: [],
  };
  const seen = new Set<object>();
  const walk = (value: unknown): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof VariableDefinitionNode) bindName(index, value.name, value.expression);
    else if (value instanceof AssignNode) bindName(index, value.identifier.name, value.expression);
    else if (value instanceof TupleAssignmentNode) {
      for (const element of value.elements) if (!element.skip && element.name) bindName(index, element.name);
    } else if (value instanceof LowLevelCallNode || value instanceof LowLevelCallStatementNode) {
      index.calls.push(value);
    } else if (value instanceof FunctionCallNode
      && SIGNATURE_CHECK_KEY_ARGUMENT[value.identifier.name] !== undefined) {
      index.signatureChecks.push(value);
    }
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const key in value) {
      if (PROVENANCE_WALK_SKIP.has(key)) continue;
      const child = (value as unknown as Record<string, unknown>)[key];
      if (child instanceof Node) walk(child);
      else if (Array.isArray(child)) for (const item of child) walk(item);
    }
  };
  walk(fn.body);
  return index;
};

/**
 * Resolve an expression to where its value came from.
 *
 * Casts are stripped and local aliases are followed, so a `bytes` parameter re-spelled as an address -
 * `address t = address(target); t.delegatecall(input);` - resolves to `parameter`. That is the whole point:
 * the published TYPE of a delegatecall target says nothing about who chose it, and refusing `bytes`
 * parameters is not available because every admitted class carries a `bytes` calldata parameter.
 *
 * A function parameter answers `parameter` before its bindings are consulted: reassigning a parameter only
 * narrows it on the paths that run the assignment, so the caller's value survives on the others.
 */
const provenanceOf = (
  expression: ExpressionNode | undefined, fn: FunctionDefinitionNode, contract: ContractNode | undefined,
  index: ProvenanceIndex, resolving: Set<string> = new Set(),
): ValueProvenance => {
  if (!expression) return COMPUTED_PROVENANCE;
  if (expression instanceof CastNode) return provenanceOf(expression.expression, fn, contract, index, resolving);
  if (expression instanceof LiteralNode) return { kind: 'literal' };
  if (expression instanceof StateAccessNode) return { kind: 'stateVar', name: expression.name };
  // A key set (`checkMultiSig(sigs, [a, b])`) is only as strong as its weakest member.
  if (expression instanceof ArrayNode) {
    return expression.elements.length === 0 ? COMPUTED_PROVENANCE
      : expression.elements
        .map((element) => provenanceOf(element, fn, contract, index, resolving))
        .reduce(weakerProvenance);
  }
  if (!(expression instanceof IdentifierNode)) return COMPUTED_PROVENANCE;
  const { name } = expression;
  if (fn.parameters.some((parameter) => parameter.name === name)) return { kind: 'parameter', name };
  if (resolving.has(name)) return COMPUTED_PROVENANCE; // an alias cycle - refuse rather than pick an arm
  if (index.bound.has(name)) {
    const bindings = index.bindings.get(name);
    if (!bindings) return COMPUTED_PROVENANCE;
    resolving.add(name);
    const candidates = bindings.map((binding) => provenanceOf(binding, fn, contract, index, resolving));
    // Branch-lowered locals can have several assignments with equally strong but different origins. Picking the
    // first constructor argument would falsely describe a ternary target as fixed; disagreement is computed.
    const first = JSON.stringify(candidates[0]);
    const resolved = candidates.some((candidate) => JSON.stringify(candidate) !== first)
      ? COMPUTED_PROVENANCE : candidates.reduce(weakerProvenance);
    resolving.delete(name);
    return resolved;
  }
  if (contract?.parameters.some((parameter) => parameter.name === name)) return { kind: 'constructorArg', name };
  if (contract?.stateVariables.some((variable) => variable.name === name)) return { kind: 'stateVar', name };
  if (contract?.constantDefinitions.some((constant) => constant.name === name)) return { kind: 'literal' };
  return COMPUTED_PROVENANCE;
};

/**
 * Per-callIndex target provenance for this function's low-level calls.
 *
 * The call nodes carry the same `callIndex` the symbol-table pre-scan used to build `func.lowLevelCalls`, so
 * the rows line up by that index rather than by re-deriving the pre-scan's walk order here.
 */
const lowLevelCallTargets = (
  fn: FunctionDefinitionNode, contract: ContractNode | undefined, index: ProvenanceIndex,
): (ValueProvenance | undefined)[] => {
  const targets: (ValueProvenance | undefined)[] = [];
  for (const call of index.calls) {
    const resolved = provenanceOf(call.targetExpression, fn, contract, index);
    const existing = targets[call.callIndex];
    // Two nodes claiming one index means this walk and the pre-scan disagree; publish the weakest of them.
    targets[call.callIndex] = existing ? weakerProvenance(existing, resolved) : resolved;
  }
  return targets;
};

/**
 * X51. The signature guard as the artifact publishes it: the weakest key any check in this body can be
 * satisfied against, plus what that key is PINNED to when the compiler proved a pin. Undefined when the body has
 * no signature check at all. A check whose key argument is absent resolves to `computed`, not to nothing.
 *
 * WHY THE SECOND FIELD EXISTS. `key` alone reads the standard BCH authorization idiom as unguarded:
 * `require(hash160(pk) == pkh); require(checkSig(s, pk))` publishes `{parameter, pk}`, because what makes it
 * authority is a separate require the key provenance does not describe. A consumer cannot reconstruct that from
 * types - a `bytes20` constructor argument beside a `pubkey` parameter is exactly the type reasoning X37 exists
 * to remove - so the compiler publishes the fact instead. `parameterCommitmentSource` is the same walk SEC-17's
 * diagnostic decides on, X46's writer strengthening included: a commitment against state this body already
 * overwrote from a caller parameter is not a commitment and yields nothing here either.
 *
 * THE FOLD IS THE WEAKEST, like `key`. Every check contributes a bound on the authority a spender must defeat:
 * what its key is pinned to when it is pinned, and its own key provenance when it is not. `keyCommitment` is the
 * weakest of those, so ONE unpinned parameter key anywhere in the body drags the published answer down to
 * `parameter` and no consumer allow-list admits it. The field appears only when at least one check IS pinned;
 * a body with no pin publishes no `keyCommitment`, which reads back as `unknown`. Understating the authority in
 * force is a refusal, never an admission - the same discipline `key` is folded under.
 */
const signatureGuardOf = (
  fn: FunctionDefinitionNode, contract: ContractNode | undefined, index: ProvenanceIndex,
): { key: ValueProvenance; keyCommitment?: ValueProvenance } | undefined => {
  let weakestKey: ValueProvenance | undefined;
  let weakestBound: ValueProvenance | undefined;
  let anyPinned = false;
  for (const check of index.signatureChecks) {
    const key = provenanceOf(
      check.parameters[SIGNATURE_CHECK_KEY_ARGUMENT[check.identifier.name]], fn, contract, index,
    );
    // Only a parameter can be pinned: every other kind is already something the caller does not hand in.
    const pinned = key.kind === 'parameter' && key.name !== undefined
      ? parameterCommitmentSource(key.name, fn)
      : undefined;
    if (pinned) anyPinned = true;
    const bound = pinned ? provenanceOf(pinned, fn, contract, index) : key;
    weakestKey = weakestKey ? weakerProvenance(weakestKey, key) : key;
    weakestBound = weakestBound ? weakerProvenance(weakestBound, bound) : bound;
  }
  if (!weakestKey) return undefined;
  return { key: weakestKey, ...(anyPinned && weakestBound && { keyCommitment: weakestBound }) };
};

interface ControlSite { block: BlockNode; index: number }

/**
 * X62. Prove that every delegatecall is reached only after a signature requirement on the same control-flow
 * path. Merely finding `checkSig` in the function is insufficient: a check in an optional branch authorizes no
 * code after that branch. This deliberately recognizes only requirements whose truth entails the signature
 * check (`checkSig(..)` itself, or an `&&` containing it); an `||` may succeed without evaluating the check.
 */
const signatureGuardDominatesDelegatecalls = (fn: FunctionDefinitionNode): boolean => {
  const guards: ControlSite[][] = [];
  const delegates: ControlSite[][] = [];
  const requiredCheck = (expression: ExpressionNode): boolean => {
    if (expression instanceof FunctionCallNode
      && SIGNATURE_CHECK_KEY_ARGUMENT[expression.identifier.name] !== undefined) return true;
    return expression instanceof BinaryOpNode && expression.operator === BinaryOperator.AND
      && (requiredCheck(expression.left) || requiredCheck(expression.right));
  };
  const seen = new Set<object>();
  const walk = (value: unknown, path: ControlSite[]): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof RequireNode && requiredCheck(value.expression)) guards.push(path);
    if ((value instanceof LowLevelCallNode || value instanceof LowLevelCallStatementNode)
      && value.callMode === 'delegatecall') delegates.push(path);
    if (value instanceof BlockNode) {
      for (const [index, statement] of (value.statements ?? []).entries()) {
        walk(statement, [...path, { block: value, index }]);
      }
      return;
    }
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const key in value) {
      if (PROVENANCE_WALK_SKIP.has(key)) continue;
      const child = (value as unknown as Record<string, unknown>)[key];
      if (child instanceof Node) walk(child, path);
      else if (Array.isArray(child)) for (const item of child) walk(item, path);
    }
  };
  walk(fn.body, []);
  if (delegates.length === 0) return false;
  const dominates = (guard: ControlSite[], call: ControlSite[]): boolean => {
    const guardSite = guard[guard.length - 1];
    if (!guardSite) return false;
    const callLevel = call.findIndex((site) => site.block === guardSite.block);
    if (callLevel < 0 || guard.length - 1 !== callLevel) return false;
    return guard.slice(0, -1).every((site, index) => call[index]?.block === site.block
      && call[index]?.index === site.index)
      && guardSite.index < call[callLevel].index;
  };
  return delegates.every((call) => guards.some((guard) => dominates(guard, call)));
};

/** Build the common metadata fields for an ABI function entry. */
function buildFunctionAbiMetadata(
  func: FunctionDefinitionNode, isStateful = false, contract?: ContractNode,
  interfaces: readonly InterfaceNode[] = [],
): Partial<AbiFunction> {
  const possibleSelectorTargets = (
    interfaceName: string, parameters: readonly ExpressionNode[],
  ): readonly { functionName: string; selector: string }[] => {
    const iface = interfaces.find((candidate) => candidate.name === interfaceName);
    if (!iface) return [];
    const types = parameters.map((parameter) => parameter.type?.toString());
    return iface.functions.filter((candidate) =>
      candidate.parameters.length === types.length
      && candidate.parameters.every((parameter, index) => parameter.type.toString() === types[index]))
      .map((candidate) => {
        const signature = `${candidate.name}(${candidate.parameters
          .map((parameter) => abiTypeString(parameter.type)).join(',')})`;
        return { functionName: candidate.name, selector: computeFunctionSelectorHex(signature) };
      })
      .sort((left, right) => left.selector.localeCompare(right.selector));
  };
  const resultConsumers = (): readonly {
    consumerCallsiteId: number; argument: number; producerCallsiteId: number;
  }[] => {
    const slots = func.externalCalls ?? [];
    const slotByCall = new Map<Node, number>(slots
      .filter((slot) => !!slot.sourceCallNode)
      .map((slot) => [slot.sourceCallNode!, slot.slotIndex] as const));
    const producerByDefinition = new Map<Node, number>();
    const producerByTupleName = new Map<string, number>();
    const visit = (value: unknown, action: (node: Node) => void, seen = new Set<object>()): void => {
      if (!(value instanceof Node) || seen.has(value)) return;
      seen.add(value);
      action(value);
      for (const [key, child] of Object.entries(value)) {
        if ([
          'resolvedFunction', 'functionReference', 'definition', 'symbolTable',
          'referencedContract', 'stateVariable', 'collection',
        ].includes(key)) continue;
        if (child instanceof Node) visit(child, action, seen);
        else if (Array.isArray(child)) for (const item of child) visit(item, action, seen);
      }
    };
    visit(func.body, (node) => {
      const expression = node instanceof VariableDefinitionNode
        ? node.expression : node instanceof TupleAssignmentNode ? node.tuple : undefined;
      if (!expression) return;
      let producer: number | undefined;
      visit(expression, (candidate) => {
        const slot = slotByCall.get(candidate);
        if (slot !== undefined) producer = slot;
      });
      if (producer === undefined) return;
      if (node instanceof VariableDefinitionNode) producerByDefinition.set(node, producer);
      else if (node instanceof TupleAssignmentNode) {
        node.elements.filter((element) => !element.skip && !!element.name)
          .forEach((element) => producerByTupleName.set(element.name!, producer!));
      }
    });
    const result: {
      consumerCallsiteId: number; argument: number; producerCallsiteId: number;
    }[] = [];
    for (const slot of slots) {
      slot.sourceCallNode?.parameters.forEach((parameter, argument) => {
        const producers = new Set<number>();
        visit(parameter, (candidate) => {
          if (!(candidate instanceof IdentifierNode)) return;
          const definition = candidate.definition?.definition;
          if (definition instanceof Node) {
            let producer = producerByDefinition.get(definition);
            // Tuple declarations are represented in the symbol table by synthetic VariableDefinitionNodes
            // whose initializer is the shared tuple call, rather than as children of the function body.
            if (producer === undefined && definition instanceof VariableDefinitionNode
              && definition.expression) {
              visit(definition.expression, (expression) => {
                const slotIndex = slotByCall.get(expression);
                if (slotIndex !== undefined) producer = slotIndex;
              });
            }
            if (producer !== undefined) producers.add(producer);
          }
          const tupleProducer = producerByTupleName.get(candidate.name);
          if (tupleProducer !== undefined) producers.add(tupleProducer);
        });
        for (const producerCallsiteId of producers) {
          result.push({
            consumerCallsiteId: slot.slotIndex,
            argument,
            producerCallsiteId,
          });
        }
      });
    }
    return result.sort((left, right) =>
      left.consumerCallsiteId - right.consumerCallsiteId
      || left.argument - right.argument
      || left.producerCallsiteId - right.producerCallsiteId);
  };
  const consumers = resultConsumers();
  // X37. Both walks are paid for only by a function that has the construct they describe: a body with no
  // low-level call and no signature check resolves nothing and publishes nothing.
  const provenance = indexBody(func);
  const callTargets = lowLevelCallTargets(func, contract, provenance);
  const signatureGuard = signatureGuardOf(func, contract, provenance);
  return {
    ...(isStateful && { writesState: computeWritesState(func) }),
    ...(func.scalarJournalRecursive && { recursiveStateHandler: true }),
    ...(func.requiredNftIndices !== undefined
      && { requiredNftIndices: func.requiredNftIndices }),
    ...(func.entryAccesses && func.entryAccesses.some((ea) => !ea.inLoop) && {
      // Loop mapping writes (inLoop) are surfaced via entryLoopWrites, not as fixed entry slots; exclude them
      // here so the SDK's static-entry path does not allocate a slot / derive them positionally.
      entryAccesses: func.entryAccesses.filter((ea) => !ea.inLoop).map((ea) => ({
        collection: ea.collection,
        keyParams: ea.keyParams,
        ...(ea.keySources && (ea.keySources.some((ks) => ks.kind !== 'param')
          || ea.keyParams.some((name) => /_sender(?:_|$)/.test(name))) && {
          keySources: ea.keySources.map((ks, index) => {
            const syntheticSender = ks.kind === 'param'
              && /_sender(?:_|$)/.test(ea.keyParams[index] ?? '');
            return {
              kind: syntheticSender ? 'msgSender' : ks.kind,
              ...(ks.paramName && { paramName: ks.paramName }),
              ...(ks.stateVarName && { stateVarName: ks.stateVarName }),
              ...(ks.stateArrayName && { stateArrayName: ks.stateArrayName }),
              ...(ks.kind === 'constant' && { constantValue: ks.constantValue }),
              ...((ks.kind === 'msgSender' || syntheticSender) && { senderOp: ks.senderOp ?? 'msg.sender' }),
              ...(ks.kind === 'expression' && { expressionLabel: ks.canonical }),
            };
          }),
        }),
        operations: ea.operations,
        ...(ea.aliasCondDeleteSlot !== undefined && { aliasCondDeleteSlot: ea.aliasCondDeleteSlot }),
        ...(ea.runtimeAliasPriorSlots?.length
          && { runtimeAliasPriorSlots: ea.runtimeAliasPriorSlots }),
        ...(ea.valueParam !== undefined && { valueParam: ea.valueParam }),
      })),
    }),
    ...(func.emitInfos && func.emitInfos.length > 0 && {
      emits: func.emitInfos.map((ei) => ({
        eventName: ei.eventName,
        eventSignature: ei.eventSignature,
        emitIndex: ei.emitIndex,
      })),
    }),
    ...(func.transferInfos && func.transferInfos.length > 0 && {
      transferCount: func.transferInfos.length,
      ...(contract && { transfers: transferEffects(func, contract) }),
    }),
    ...(func.deployTargets && func.deployTargets.length > 0 && {
      deployTargets: func.deployTargets.map((dt) => ({
        contractName: dt.contractName,
        dataNftCount: dt.dataNftCount,
        ...(dt.constructorArgs && { constructorArgs: dt.constructorArgs }),
        ...(dt.salt && { salt: dt.salt }),
        ...(dt.creationBytecode && { creationBytecode: dt.creationBytecode }),
      })),
    }),
    ...(func.externalReads && func.externalReads.length > 0 && {
      externalReads: func.externalReads.map((er) => ({
        interfaceName: er.interfaceName,
        kind: er.kind,
        ...(er.nftIndex !== undefined && { nftIndex: er.nftIndex }),
        ...(er.collectionName && { collectionName: er.collectionName }),
        ...(er.collectionSignature && { collectionSignature: er.collectionSignature }),
        ...(er.addressParam && { addressParam: er.addressParam }),
      })),
    }),
    ...(func.externalCalls && func.externalCalls.length > 0 && {
      externalCalls: func.externalCalls.map((ec) => ({
        callsiteId: ec.slotIndex,
        ...(ec.sourceCallNode && {
          sourceLocation: {
            line: ec.sourceCallNode.location.start.line,
            column: ec.sourceCallNode.location.start.column,
          },
        }),
        ...occurrenceInfoOf(func, ec.sourceCallNode),
        interfaceName: ec.interfaceName,
        functionName: ec.functionName,
        ...(ec.addressParam && { addressParam: ec.addressParam }),
        ...(ec.addressStateVar && { addressStateVar: ec.addressStateVar }),
        ...(ec.addressLiteral && { addressLiteral: ec.addressLiteral }),
        ...(ec.loopArrayVar && { loopArrayVar: ec.loopArrayVar }),
        ...(ec.selectorArrayVar && { selectorArrayVar: ec.selectorArrayVar }),
        ...(ec.selectorArrayVar && ec.sourceCallNode && {
          possibleTargets: possibleSelectorTargets(ec.interfaceName, ec.sourceCallNode.parameters),
        }),
        ...(ec.addressIsMsgSender && { addressIsMsgSender: true }),
        ...(ec.fnPtrCall && { fnPtrCall: true }),
        // Explicit (true AND false) for regular direct calls so the SDK skips a single-method callee's (absent)
        // witness selector; call/staticcall/delegatecall inject no selector param.
        ...(!ec.callMode && { needsSelectorVerification: !!ec.needsSelectorVerification }),
        requiredDataNftIndices: ec.requiredDataNftIndices,
        ...(ec.hasReturnValues && { hasReturnValues: true }),
        ...(ec.returnTypes && ec.returnTypes.length > 0 && {
          returnTypes: ec.returnTypes.map((t) => t.toString()),
        }),
        ...(ec.returnEventSignature && { returnEventSignature: ec.returnEventSignature }),
        ...(ec.computedOffset !== undefined && ec.computedOffset > 0 && { computedOffset: ec.computedOffset }),
        ...(ec.callMode && ec.callMode !== ExternalCallMode.REGULAR && { callMode: ec.callMode }),
        ...(ec.opaqueReturn && { opaqueReturn: true }),
        ...(ec.argSources && ec.argSources.length > 0 && { argSources: ec.argSources }),
        ...(ec.batchInvocations && {
          batchInvocations: ec.batchInvocations.map((row) => ({
            selector: binToHex(row.selector),
            logicalIndex: row.logicalIndex,
            inputs: row.parameterTypes.map((type, index) => ({
              name: `arg${index}`, type: abiTypeString(type),
            })),
            ...(row.argSources && { argSources: row.argSources }),
          })),
        }),
      })),
    }),
    ...(consumers.length > 0 && { resultConsumers: consumers }),
    ...(func.externalOutStateReads && func.externalOutStateReads.length > 0 && {
      externalOutStateReads: func.externalOutStateReads.map((os) => ({
        interfaceName: os.interfaceName,
        ...(os.addressParam && { addressParam: os.addressParam }),
        requiredDataNftIndices: os.requiredDataNftIndices,
      })),
    }),
    ...(func.tokenContainerAccesses && func.tokenContainerAccesses.length > 0 && {
      tokenContainerAccesses: func.tokenContainerAccesses.map((da) => ({
        keyParam: da.keyParam,
        ...(da.keySource && da.keySource !== 'param' && { keySource: da.keySource }),
        operations: da.operations,
        ...(da.transferCount > 1 && { transferCount: da.transferCount }),
        ...(da.transferNftCount > 1 && { transferNftCount: da.transferNftCount }),
      })),
    }),
    ...(func.usesMsgSender && { usesMsgSender: true }),
    // Absent means no signature check was proven - a body with none, or an artifact predating the field.
    // Both read as "unguarded"; absent is never a proof of authority.
    ...(signatureGuard && { signatureGuard }),
    ...(signatureGuardDominatesDelegatecalls(func) && { signatureGuardDominatesDelegatecalls: true }),
    ...(func.usedLibraries && func.usedLibraries.length > 0 && { externalLibraries: func.usedLibraries }),
    ...(func.libraryCallCounts && func.libraryCallCounts.size > 0
      && { externalLibraryCalls: Object.fromEntries(func.libraryCallCounts) }),
    ...(func.keccakCompute && { keccakCompute: true }),
    ...(keccakPreimageParamsFor(func).length > 0
      && { keccakPreimageParams: keccakPreimageParamsFor(func) }),
    ...(func.keccakInLoop && { keccakInLoop: true }),
    ...(func.keccakLoopReads && { keccakLoopReads: true }),
    ...(func.ecrecoverCompute && { ecrecoverCompute: true }),
    ...(func.ecrecoverArgParams && func.ecrecoverArgParams.length > 0
      && { ecrecoverArgParams: func.ecrecoverArgParams }),
    ...(func.ecrecoverEvmFlags && func.ecrecoverEvmFlags.some(Boolean)
      && { ecrecoverEvmFlags: func.ecrecoverEvmFlags }),
    ...(func.ecrecoverLoopReads && { ecrecoverLoopReads: true }),
    ...(func.unsafeTier !== undefined && { unsafeTier: func.unsafeTier }),
    ...(func.lowLevelCalls && func.lowLevelCalls.length > 0 && {
      lowLevelCalls: func.lowLevelCalls.map((lc, index) => ({
        callMode: lc.callMode,
        // Always published, `computed` included, so a row that carries NO `target` identifies an artifact
        // compiled before the field existed. Absent is read as unknown, never as an unconstrained target.
        target: callTargets[index] ?? COMPUTED_PROVENANCE,
      })),
    }),
    ...(func.libraryDelegateCalls && func.libraryDelegateCalls.length > 0 && {
      libraryDelegateCalls: func.libraryDelegateCalls.map((ld) => ({
        library: ld.library,
        functionName: ld.functionName,
        ...(ld.args.length > 0 && { args: ld.args }),
      })),
    }),
    ...(func.collectionIterations && func.collectionIterations.length > 0 && {
      collectionIterations: func.collectionIterations.map((ci) => ({
        collection: ci.collection,
        mode: ci.mode,
        iterationIndex: ci.iterationIndex,
      })),
    }),
    ...(func.dynamicReads && func.dynamicReads.length > 0 && { dynamicReads: [...func.dynamicReads] }),
    ...(func.dynamicWrites && func.dynamicWrites.length > 0 && { dynamicWrites: [...func.dynamicWrites] }),
    ...(func.entryLoopWrites && func.entryLoopWrites.some(
      (collection) => !func.sortedBatchInfo?.some((batch) => batch.collection === collection),
    ) && {
      // A fixed atomic batch materializes every target in its block-layout entry slots and uses only its
      // non-target predecessor rewrites as trailing outputs. It is not a runtime loop-output collection: exposing
      // it here makes the SDK attempt to decode C2 slot/link commitments as legacy key/value loop commitments.
      entryLoopWrites: func.entryLoopWrites.filter(
        (collection) => !func.sortedBatchInfo?.some((batch) => batch.collection === collection),
      ),
    }),
    ...(func.sortedInsertLoops && func.sortedInsertLoops.length > 0 && { sortedInsertLoops: [...func.sortedInsertLoops] }),
    ...(func.sortedInsertLoopInfo && func.sortedInsertLoopInfo.length > 0 && {
      sortedInsertLoopInfo: [...func.sortedInsertLoopInfo],
    }),
    ...(func.sortedUpsertLoopInfo && func.sortedUpsertLoopInfo.length > 0 && {
      sortedUpsertLoopInfo: [...func.sortedUpsertLoopInfo],
    }),
    ...(func.sortedBatchInfo && func.sortedBatchInfo.length > 0 && { sortedBatchInfo: [...func.sortedBatchInfo] }),
    ...(func.blockhashReads && func.blockhashReads.length > 0 && { blockhashReads: [...func.blockhashReads] }),
    ...(func.messageBusBlockhashReadWidth && func.messageBusBlockhashReads && {
      graphBlockhashOracle: {
        inputBaseParameter: '__internal__blockhashInputIndex' as const,
        rowCount: func.messageBusMaximumRows!,
        readWidth: func.messageBusBlockhashReadWidth,
        slotCount: func.messageBusMaximumRows! * func.messageBusBlockhashReadWidth,
        reads: [...func.messageBusBlockhashReads],
      },
    }),
    ...(func.blockLayout && { blockLayout: func.blockLayout }),
  };
}

/** Extract optional key/value name annotations from a MappingType for the artifact. */
function mappingNameFields(type: Type): Record<string, unknown> {
  if (!(type instanceof MappingType)) return {};
  const result: Record<string, unknown> = {};
  if (type.keyName) result.keyName = type.keyName;
  // Get the innermost value name and count depth
  let depth = 1;
  let inner: MappingType = type;
  while (inner.valueType instanceof MappingType) {
    inner = inner.valueType;
    depth++;
  }
  if (inner.valueName) result.valueName = inner.valueName;
  // For nested mappings, collect all key names if any are present
  if (depth > 1) {
    const keyNames: (string | undefined)[] = [];
    let cur: MappingType = type;
    keyNames.push(cur.keyName);
    while (cur.valueType instanceof MappingType) {
      cur = cur.valueType;
      keyNames.push(cur.keyName);
    }
    if (keyNames.some((n) => n !== undefined)) {
      result.keyNames = keyNames;
    }
  }
  return result;
}

// A source file with no compilable contract - a standalone interface, a file-level enum/struct, or an
// inline-only library - is a valid compilation unit in Solidity (solc emits an ABI with empty bytecode).
// Mirror that: emit a minimal artifact carrying the primary interface's ABI and any declared enums / events /
// errors, with empty bytecode. There is no executable contract, so it is not instantiable (isLibrary: true).
export function generateDeclarationArtifact(
  ast: Ast,
  source: string,
): Artifact {
  const primary = ast.interfaceDefinitions.find((i) => i.name === ast.libraryName)
    ?? ast.interfaceDefinitions[0];
  // A standalone abstract contract (compiled under solidityImportCompat) has no interface, but its own
  // public/external functions form the ABI - solc emits an ABI + empty bytecode for abstract contracts.
  const abstractContract = ast.contract?.isAbstract ? ast.contract : undefined;
  const declFunctions = primary?.functions
    ?? abstractContract?.functions.filter((fn) => fn.isEntryPoint)
    ?? [];
  const abi: AbiFunction[] = declFunctions.map((fn) => ({
    name: fn.name,
    inputs: fn.parameters.map((p) => ({ name: p.name, type: abiTypeString(p.type) })),
    ...(fn.returnTypes.length > 0 && { outputs: fn.returnTypes.map((t) => ({ type: abiTypeString(t) })) }),
  }));

  const allEnums = [
    ...(ast.enumDefinitions || []),
    ...ast.interfaceDefinitions.flatMap((i) => i.enumDefinitions || []),
    ...(abstractContract?.enumDefinitions || []),
  ];
  const enums = allEnums.length > 0
    ? allEnums.map((e) => ({
      name: e.name,
      // Enum values are ordinals; fall back to the member index if a merged/reconstructed enum lost its value
      // (some import-merge paths carry names only) rather than crashing on undefined.toString().
      members: e.members.map((m, i) => ({ name: m.name, value: (m.value ?? BigInt(i)).toString() })),
    }))
    : undefined;

  const allEventDefs = [...(ast.eventDefinitions || []), ...(abstractContract?.eventDefinitions || [])];
  const events = allEventDefs.length > 0
    ? allEventDefs.map((ev) => ({
      name: ev.name,
      signature: ev.signature,
      parameters: ev.parameters.map((p) => ({
        name: p.name,
        type: abiTypeString(p.type),
        ...(p.indexed && { indexed: true }),
      })),
      ...(ev.isAnonymous && { anonymous: true }),
    }))
    : undefined;

  const allErrors = [...(ast.errorDefinitions || []), ...(abstractContract?.errorDefinitions || [])];
  const errors = allErrors.length > 0
    ? allErrors.map((err) => ({
      name: err.name,
      signature: err.signature,
      parameters: err.parameters.map((p) => ({ name: p.name, type: abiTypeString(p.type) })),
    }))
    : undefined;

  return {
    contractName: ast.libraryName ?? abstractContract?.name ?? 'definitions',
    constructorInputs: [],
    abi,
    bytecode: '',
    source,
    isLibrary: true,
    ...(enums && { enums }),
    ...(events && { events }),
    ...(errors && { errors }),
    compiler: { name: 'solidc', version },
    updatedAt: new Date().toISOString(),
  };
}

export function generateArtifact(
  ast: Ast,
  script: Script,
  source: string,
  debug: DebugInformation,
  compilerOptions: CompilerOptions,
  functionBodies?: Record<string, string>,
  fingerprint?: string,
): Artifact {
  const { contract } = ast;

  const constructorInputs = contract.parameters
    .map((parameter) => ({ name: parameter.name, type: abiTypeString(parameter.type) }));

  // Exclude internal/private functions from the ABI (they're implementation details)
  const abiFunctions = contract.functions.filter((func) => {
    const v = func.visibility;
    return v !== 'internal' && v !== 'private';
  });

  // Mirror the stateLayout gate below: writesState is only meaningful (and only emitted) for stateful contracts.
  const isStateful = contract.stateVariables.length > 0 || contract.collections.length > 0
    || compilerOptions.forceStateful || contract.usesBlockhash || contract.deploysStatefulChild
    || contract.deploysWithValue
    || contract.functions.some((func) => func.modifiers.includes(FunctionModifier.SELFDESTRUCT));

  const abi: AbiFunction[] = abiFunctions.map((func) => ({
    name: func.name,
    ...(func.functionSelector && { selector: binToHex(func.functionSelector) }),
    inputs: func.parameters.map((parameter) => ({
      name: parameter.name,
      type: abiTypeString(parameter.type),
    })),
    ...(func.returnTypes.length > 0 && {
      outputs: func.returnTypes.map((type) => ({ type: abiTypeString(type) })),
    }),
    ...(func.modifiers.length > 0 && {
      modifiers: func.modifiers.map((m) => m.toString()),
    }),
    ...(func.nativeSelfBatchDispatcher && { nativeSelfBatchDispatcher: true }),
    ...buildFunctionAbiMetadata(func, isStateful, contract, ast.interfaceDefinitions),
    ...(func.splitCountParam && { splitCountParam: func.splitCountParam }),
    ...(func.mergeCountParam && { mergeCountParam: func.mergeCountParam }),
  }));

  if (contract.constructorDef) {
    abi.push({
      name: contract.constructorDef.name, // '__construct'
      // The selector is needed to spend down the constructor branch at genesis (the SDK deploy probe and the
      // genesis tx push it ahead of the redeem script); without it the entry dispatch underflows.
      ...(contract.constructorDef.functionSelector
        && { selector: binToHex(contract.constructorDef.functionSelector) }),
      inputs: contract.constructorDef.parameters.map((parameter) => ({
        name: parameter.name,
        type: abiTypeString(parameter.type),
      })),
      ...(contract.constructorDef.modifiers.length > 0 && {
        modifiers: contract.constructorDef.modifiers.map((m) => m.toString()),
      }),
      ...buildFunctionAbiMetadata(contract.constructorDef, false, contract, ast.interfaceDefinitions),
    });
  }

  if (contract.fallbackDef) {
    abi.push({
      name: '__fallback',
      ...(contract.fallbackDef.functionSelector && { selector: binToHex(contract.fallbackDef.functionSelector) }),
      inputs: [],
      isFallback: true,
      ...(contract.fallbackDef.modifiers.length > 0 && {
        modifiers: contract.fallbackDef.modifiers.map((m) => m.toString()),
      }),
      ...buildFunctionAbiMetadata(contract.fallbackDef, false, contract, ast.interfaceDefinitions),
    });
  }

  if (contract.receiveDef) {
    abi.push({
      name: '__receive',
      ...(contract.receiveDef.functionSelector && { selector: binToHex(contract.receiveDef.functionSelector) }),
      inputs: [],
      isReceive: true,
      modifiers: ['payable'],
      ...buildFunctionAbiMetadata(contract.receiveDef, false, contract, ast.interfaceDefinitions),
    });
  }

  const bytecode = scriptToAsm(script);

  // Struct field layouts (name + ordered field types). Emitted so the SDK can encode struct-typed function
  // and constructor arguments (Solidity encodes a struct as an ABI tuple). Shared by the top-level artifact
  // field (reachable for stateless contracts, which have no stateLayout) and the stateLayout's own copy (the
  // stateful state machinery passes the self-contained layout around, not the whole artifact).
  const structDefs = [...(ast.structDefinitions || []), ...contract.structDefinitions].map((sd) => ({
    name: sd.name,
    fields: sd.fields.map((f) => ({ name: f.name, type: f.type.toString() })),
  }));

  // Build state layout if the contract has state variables or collections, or forceStateful is set (a
  // zero-state stateful contract gets an empty stateLayout so the SDK sees it as stateful and bakes the
  // master-NFT self-pin covenant; see the forceStateful compiler option).
  let stateLayout: StateLayout | undefined;
  if (contract.stateVariables.length > 0 || contract.collections.length > 0
    || compilerOptions.forceStateful || contract.usesBlockhash || contract.deploysStatefulChild
    || contract.deploysWithValue
    || contract.functions.some((func) => func.modifiers.includes(FunctionModifier.SELFDESTRUCT))) {
    stateLayout = {
      variables: contract.stateVariables.map((sv) => ({
        name: sv.name,
        type: abiTypeString(sv.type),
        nftIndex: sv.nftIndex,
        fieldIndex: sv.fieldIndex,
        ...(sv.visibility !== StateVariableVisibility.PUBLIC && { visibility: sv.visibility }),
        ...(sv.immutable && { immutable: true }),
        ...(sv.isPacked && { packed: true }),
        ...(sv.isDynamic && { dynamic: true }),
        ...(sv.contractTypeName && { contractType: sv.contractTypeName }),
      })),
      dataNftCount: contract.stateVariables.length > 0
        ? Math.max(...contract.stateVariables.map((sv) => sv.nftIndex)) + 1
        : 0,
      commitmentLimit: compilerOptions.commitmentLimit ?? 128,
      ...(contract.constructorDef && {
        constructorInputs: contract.constructorDef.parameters.map((p) => ({
          name: p.name,
          type: abiTypeString(p.type),
        })),
      }),
      ...(contract.deployReads.length > 0 && { deployReads: contract.deployReads }),
      ...(contract.collections.length > 0 && {
        collections: contract.collections.map((coll) => ({
          name: coll.name,
          signature: computeCollectionSignature(coll.name, coll.type.toString()),
          kind: (coll.type instanceof ArrayType ? 'array' : 'mapping') as 'mapping' | 'array',
          keyType: keyEncodingTypeString(coll.keyType),
          valueType: coll.innermostValueType.toString(),
          ...(coll.depth > 1 && {
            keyTypes: coll.allKeyTypes.map(keyEncodingTypeString),
          }),
          ...mappingNameFields(coll.type),
          ...(coll.type instanceof ArrayType && {
            elementType: coll.type.elementType.toString(),
            ...(coll.type.bound !== undefined && { bound: coll.type.bound }),
          }),
          ...(coll.immutable && { immutable: true }),
          ...(coll.sorted && { sorted: true }),
          ...(coll.sorted && isChunkableValueType(coll.innermostValueType) && { chunkableValue: true }),
          ...(coll.enumerable && { enumerable: true }),
        })),
      }),
      ...(contract.collections.some((c) => !(c.type instanceof ArrayType)) && {
        mappings: contract.collections
          .filter((coll) => !(coll.type instanceof ArrayType))
          .map((coll) => ({
            name: coll.name,
            signature: computeCollectionSignature(coll.name, coll.type.toString()),
            kind: 'mapping' as const,
            keyType: keyEncodingTypeString(coll.keyType),
            valueType: coll.innermostValueType.toString(),
            ...(coll.depth > 1 && {
              keyTypes: coll.allKeyTypes.map(keyEncodingTypeString),
            }),
            ...mappingNameFields(coll.type),
            ...(coll.immutable && { immutable: true }),
            ...(coll.sorted && { sorted: true }),
            ...(coll.sorted && isChunkableValueType(coll.innermostValueType) && { chunkableValue: true }),
            ...(coll.enumerable && { enumerable: true }),
          })),
      }),
      ...(structDefs.length > 0 && { structs: structDefs }),
    };
  }

  // Build events if contract has event definitions
  // Build events from file-level (library imports), contract-level, and emitted sibling-contract event defs
  const allEventDefs = [...(ast.eventDefinitions || []), ...contract.eventDefinitions, ...contract.emittedForeignEvents]
    .filter((ev, i, a) => a.findIndex((e) => e.signature === ev.signature) === i);
  const events = allEventDefs.length > 0
    ? allEventDefs.map((ev) => ({
      name: ev.name,
      signature: ev.signature,
      parameters: ev.parameters.map((p) => ({
        name: p.name,
        type: abiTypeString(p.type),
        ...(p.indexed && { indexed: true }),
      })),
      ...(ev.isAnonymous && { anonymous: true }),
    }))
    : undefined;

  // Build errors from both file-level and contract-level error definitions
  const allErrors = [...(ast.errorDefinitions || []), ...contract.errorDefinitions];
  const errors = allErrors.length > 0
    ? allErrors.map((err) => ({
      name: err.name,
      signature: err.signature,
      parameters: err.parameters.map((p) => ({ name: p.name, type: abiTypeString(p.type) })),
    }))
    : undefined;

  // Build enums from file-level, interface-level, and contract-level enum definitions
  const allEnums = [
    ...(ast.enumDefinitions || []),
    ...ast.interfaceDefinitions.flatMap((i) => i.enumDefinitions || []),
    ...contract.enumDefinitions,
  ];
  const enums = allEnums.length > 0
    ? allEnums.map((e) => ({
      name: e.name,
      // Enum values are ordinals; fall back to the member index if a merged/reconstructed enum lost its value
      // (some import-merge paths carry names only) rather than crashing on undefined.toString().
      members: e.members.map((m, i) => ({ name: m.name, value: (m.value ?? BigInt(i)).toString() })),
    }))
    : undefined;

  // Collect external interface info from all referenced interfaces
  const referencedInterfaces = new Set<string>();
  for (const func of contract.functions) {
    if (func.externalReads) {
      for (const er of func.externalReads) {
        referencedInterfaces.add(er.interfaceName);
      }
    }
    if (func.externalCalls) {
      for (const ec of func.externalCalls) {
        referencedInterfaces.add(ec.interfaceName);
      }
    }
    if (func.externalOutStateReads) {
      for (const os of func.externalOutStateReads) {
        referencedInterfaces.add(os.interfaceName);
      }
    }
  }

  const externalInterfaces: ExternalInterfaceInfo[] | undefined = referencedInterfaces.size > 0
    ? [...referencedInterfaces].map((ifaceName) => {
      const iface = ast.interfaceDefinitions.find((i) => i.name === ifaceName);
      if (!iface) return undefined;
      return buildExternalInterfaceInfo(iface, compilerOptions, ast.interfaceDefinitions);
    }).filter((x): x is ExternalInterfaceInfo => x !== undefined)
    : undefined;

  // External script libraries the contract depends on, with a self-describing descriptor. Branded
  // (category-salted side-car) for stateful contracts; shared otherwise. See docs/external-libraries.md.
  const resolvedLibraries = resolveLibraries(compilerOptions.userLibraries);
  const allFns = [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions];
  const usedLibraryNames = [...new Set(allFns.flatMap((f) => f?.usedLibraries ?? []))];
  const inlinedNames = new Set(allFns.flatMap((f) => f?.inlinedLibraries ?? []));
  const externalLibraries: ExternalLibraryAbi[] | undefined = usedLibraryNames.length > 0
    ? usedLibraryNames.map((name) => {
      const lib = resolvedLibraries[name];
      // result-NFT (compute) model: the side-car COMPUTES keccak in its own budget and returns it in its NFT
      // commitment; the contract never loads a blob, so the inline-loader fields (blobHash/codeBegin/codeEnd) do
      // not apply (they would describe a blob that is never inlined). keccak256 is always the compute model.
      const isResultNft = name === 'keccak256' && allFns.some((f) => f?.keccakCompute);
      if (isResultNft) {
        return {
          name,
          branded: stateLayout !== undefined,
          abi: lib.abi,
          resultNft: true,
          // minInstances = the max keccak256 call count across functions (side-cars to deploy at creation);
          // unbounded flags a keccak-in-loop function whose runtime count exceeds that static minimum.
          // Count the PUBLISHED params, so a call attributed to an inlined helper still provisions its side-car.
          minInstances: Math.max(0, ...allFns.map((f) => (f ? keccakPreimageParamsFor(f).length : 0))),
          ...(allFns.some((f) => f?.keccakInLoop) && { unbounded: true }),
        };
      }
      // inline / side-car-blob model: the loader strips to codeBegin/codeEnd in the side-car input bytecode.
      const range = sidecarCodeRange(lib.blob);
      return {
        name,
        blobHash: binToHex(lib.blobHash),
        branded: stateLayout !== undefined,
        inline: inlinedNames.has(name), // inlined into the contract bytecode -> SDK skips the side-car
        codeBegin: range.codeBegin,
        codeEnd: range.codeEnd,
        abi: lib.abi,
        // built-ins resolve by name in the SDK; user libraries embed their blob
        ...(BUILTIN_LIBRARIES[name] ? {} : { code: binToHex(lib.blob) }),
      };
    })
    : undefined;

  return {
    contractName: contract.name,
    constructorInputs,
    abi,
    bytecode,
    source,
    debug,
    ...(functionBodies && { functionBodies }),
    ...(fingerprint && { fingerprint }),
    ...(stateLayout && { stateLayout }),
    ...(structDefs.length > 0 && { structs: structDefs }),
    ...(externalInterfaces && externalInterfaces.length > 0 && { externalInterfaces }),
    ...(events && { events }),
    ...(errors && { errors }),
    ...(enums && { enums }),
    ...(externalLibraries && { externalLibraries }),
    ...(contract.isLibraryContract && { isLibrary: true }),
    ...(contract.isBrandedLibrary && { brandedLibrary: true }),
    compiler: {
      name: 'solidc',
      version,
      options: {
        enforceFunctionParameterTypes: compilerOptions.enforceFunctionParameterTypes,
        enforceLocktimeGuard: compilerOptions.enforceLocktimeGuard,
        commitmentLimit: compilerOptions.commitmentLimit,
        messageBus: compilerOptions.messageBus,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

function buildExternalInterfaceInfo(
  iface: InterfaceNode,
  compilerOptions: CompilerOptions,
  allInterfaces: InterfaceNode[],
): ExternalInterfaceInfo {
  // Collect all state variables including from parent interfaces
  const allVars = getAllInterfaceStateVarsFlat(iface, allInterfaces);

  // Build state layout using same bin-packing as compiler
  const commitmentLimit = compilerOptions.commitmentLimit ?? 128;
  const variables: { name: string; type: string; nftIndex: number; fieldIndex: number; visibility?: string }[] = [];
  let nftIndex = 0;
  let fieldIndex = 0;
  let currentNftUsed = 0;

  // Collect struct definitions from the interface and parents for size computation
  const structDefs = collectInterfaceStructDefs(iface, allInterfaces);

  for (const sv of allVars) {
    const typeStr = sv.type.toString();
    const maxSize = getMaxEncodedSize(typeStr, structDefs);
    const isExternal = sv.visibility === StateVariableVisibility.EXTERNAL;
    const isStruct = structDefs.some((s) => s.name === typeStr);

    if (isExternal) {
      if (currentNftUsed > 0) { nftIndex++; fieldIndex = 0; currentNftUsed = 0; }
      variables.push({ name: sv.name, type: typeStr, nftIndex, fieldIndex: 0, visibility: 'external' });
      nftIndex++; fieldIndex = 0; currentNftUsed = 0;
    } else if (isStruct) {
      // Struct must be placed last in its NFT (same rule as SymbolTableTraversal)
      if (currentNftUsed + maxSize > commitmentLimit && currentNftUsed > 0) {
        nftIndex++; fieldIndex = 0; currentNftUsed = 0;
      }
      variables.push({ name: sv.name, type: typeStr, nftIndex, fieldIndex });
      fieldIndex++; currentNftUsed += maxSize;
      // Force next var to go to a new NFT since struct must be last
      nftIndex++; fieldIndex = 0; currentNftUsed = 0;
    } else {
      if (currentNftUsed + maxSize > commitmentLimit && currentNftUsed > 0) {
        nftIndex++; fieldIndex = 0; currentNftUsed = 0;
      }
      variables.push({ name: sv.name, type: typeStr, nftIndex, fieldIndex });
      fieldIndex++; currentNftUsed += maxSize;
    }
  }

  const dataNftCount = variables.length > 0 ? Math.max(...variables.map((v) => v.nftIndex)) + 1 : 0;

  // Collect collections
  const allCollections = getAllInterfaceCollectionsFlat(iface, allInterfaces);
  const collections = allCollections.length > 0
    ? allCollections.map((coll) => ({
      name: coll.name,
      signature: computeCollectionSignature(coll.name, coll.type.toString()),
      kind: (coll.type instanceof ArrayType ? 'array' : 'mapping') as 'mapping' | 'array',
      keyType: keyEncodingTypeString(coll.keyType),
      valueType: coll.innermostValueType.toString(),
      ...mappingNameFields(coll.type),
    }))
    : undefined;

  // Build interface function ABIs
  const ifaceFunctions = iface.functions.map((func) => {
    const paramTypes = func.parameters.map((p) => abiTypeString(p.type));
    const sig = `${func.name}(${paramTypes.join(',')})`;
    return {
      name: func.name,
      inputs: func.parameters.map((p) => ({ name: p.name, type: abiTypeString(p.type) })),
      selector: computeFunctionSelectorHex(sig),
    };
  });

  return {
    name: iface.name,
    stateLayout: {
      variables,
      dataNftCount,
      commitmentLimit,
      ...(collections && { collections }),
    },
    ...(ifaceFunctions.length > 0 && { abi: ifaceFunctions }),
  };
}

function getAllInterfaceStateVarsFlat(
  iface: InterfaceNode,
  allInterfaces: InterfaceNode[],
): typeof iface.stateVariables {
  const varMap = new Map<string, typeof iface.stateVariables[0]>();

  // Recursively collect from parent interfaces first (parents override by order)
  for (const parentName of iface.parents) {
    const parent = allInterfaces.find((i) => i.name === parentName);
    if (!parent) continue;
    for (const sv of getAllInterfaceStateVarsFlat(parent, allInterfaces)) {
      varMap.set(sv.name, sv);
    }
  }

  // Then add/override with the interface's own state variables
  for (const sv of iface.stateVariables) {
    varMap.set(sv.name, sv);
  }

  return [...varMap.values()];
}

function getAllInterfaceCollectionsFlat(
  iface: InterfaceNode,
  allInterfaces: InterfaceNode[],
): InterfaceCollectionNode[] {
  const collMap = new Map<string, InterfaceCollectionNode>();

  for (const parentName of iface.parents) {
    const parent = allInterfaces.find((i) => i.name === parentName);
    if (!parent) continue;
    for (const coll of getAllInterfaceCollectionsFlat(parent, allInterfaces)) {
      collMap.set(coll.name, coll);
    }
  }

  for (const coll of iface.collections) {
    collMap.set(coll.name, coll);
  }

  return [...collMap.values()];
}

function collectInterfaceStructDefs(
  iface: InterfaceNode,
  allInterfaces: InterfaceNode[],
): StructDefinitionNode[] {
  const structMap = new Map<string, StructDefinitionNode>();
  for (const parentName of iface.parents) {
    const parent = allInterfaces.find((i) => i.name === parentName);
    if (!parent) continue;
    for (const sd of collectInterfaceStructDefs(parent, allInterfaces)) {
      structMap.set(sd.name, sd);
    }
  }
  for (const sd of (iface.structDefinitions ?? [])) {
    structMap.set(sd.name, sd);
  }
  return [...structMap.values()];
}

function getMaxEncodedSize(typeStr: string, structDefs?: StructDefinitionNode[]): number {
  // Check struct types first (recursive sum of field sizes)
  if (structDefs) {
    const structDef = structDefs.find((s) => s.name === typeStr);
    if (structDef) {
      return structDef.fields.reduce(
        (sum, f) => sum + getMaxEncodedSize(f.type.toString(), structDefs), 0,
      );
    }
  }
  if (typeStr === 'bool') return 1;
  if (typeStr === 'bigint') return 9;
  if (typeStr === 'pubkey') return 34;
  if (typeStr === 'sig') return 74;
  if (typeStr === 'datasig') return 66;
  // Bounded int types (int8, uint256, etc.)
  const intMatch = typeStr.match(/^u?int(\d+)$/);
  if (intMatch) {
    const bits = parseInt(intMatch[1], 10);
    const dataBytes = Math.ceil((bits + 1) / 8);
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }
  // Fixed-point types (fixed128x18, ufixed64x8)
  const fixedMatch = typeStr.match(/^u?fixed(\d+)x\d+$/);
  if (fixedMatch) {
    const bits = parseInt(fixedMatch[1], 10);
    const dataBytes = Math.ceil((bits + 1) / 8);
    if (dataBytes <= 75) return dataBytes + 1;
    if (dataBytes <= 255) return dataBytes + 2;
    return dataBytes + 3;
  }
  const bytesMatch = typeStr.match(/^bytes(\d+)$/);
  if (bytesMatch) {
    const n = parseInt(bytesMatch[1], 10);
    if (n === 0) return 1;
    if (n === 1) return 2;
    if (n <= 75) return n + 1;
    if (n <= 255) return n + 2;
    return n + 3;
  }
  return 9;
}

// strip verbose debug info (and optionally source) from artifact for production use
export function stripArtifact(
  artifact: Artifact,
  options?: { stripSource?: boolean },
): Omit<Artifact, 'debug'> {
  const stripped = { ...artifact };
  delete stripped.debug;
  delete stripped.functionBodies;
  if (options?.stripSource) {
    (stripped as any).source = '';
  }
  return stripped;
}
