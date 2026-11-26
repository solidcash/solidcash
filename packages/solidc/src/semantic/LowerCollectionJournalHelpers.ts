import {
  BlockNode,
  BinaryOpNode,
  BranchNode,
  AssignNode,
  CollectionIterationNode,
  DoWhileNode,
  SwitchNode,
  TryCatchNode,
  UncheckedNode,
  WhileNode,
  ArrayAccessNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  ArrayPopNode,
  ArrayPushNode,
  ContractNode,
  EmitStatementNode,
  ExpressionNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  FunctionDefinitionNode,
  FunctionModifier,
  IdentifierNode,
  IndirectCallNode,
  IntLiteralNode,
  LiteralNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  Node,
  NullaryOpNode,
  ParameterNode,
  RequireNode,
  ReturnNode,
  SourceFileNode,
  StatementNode,
  TupleAssignmentNode,
  UnaryOpNode,
  VariableDefinitionNode,
  type ExternalCallExpression,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import {
  argumentConditionActivation, booleanArgumentIndices, stableArgumentIndices,
} from './ArgumentConditionActivation.js';
import {
  ArrayType, IntType, MappingType, type Type,
} from '@solidcash/utils';
import { SolidcDiagnosticError } from '../Errors.js';

/** Fail closed with a stable diagnostic code for an invariant the lowering relies on. */
function throwJournalDiagnostic(
  code: string, message: string, detail: Readonly<Record<string, unknown>> = {},
): never {
  throw new SolidcDiagnosticError(code as never, message, detail);
}

interface Candidate {
  fn: FunctionDefinitionNode;
  collection: string;
  keyParameters: string[];
  journalName: string;
  valueType: Type;
}

interface JournalEntry {
  collection: string;
  keyParameters: string[];
  journalName: string;
  valueType: Type;
  /** The helper can change this entry; read-only journal values never require a physical write-back. */
  mutates: boolean;
  /** Exact source-argument guard for one conditional mutation; a skipped call must not dirty this cache. */
  activation?: ExternalCallExpression;
  /** Exact guard for every source access; an inactive entry needs no physical preload. */
  loadActivation?: ExternalCallExpression;
  /** Scope in which the source helper legally accessed an inherited private collection. */
  sourceScope?: string;
}

interface MultiCandidate {
  fn: FunctionDefinitionNode;
  entries: JournalEntry[];
}

/** The helper name a diagnostic shows: the name without a `_self_alias` suffix. */
const sourceHandlerName = (name: string): string => name.replace(/_self_alias$/, '');

interface ActiveMultiCacheLocal {
  entry: JournalEntry;
  name: string;
  keys: ExpressionNode[];
  keyIdentity: string[];
  index: number;
  /** At least one helper sharing this physical cache can change it. */
  mutates: boolean;
}

interface ActiveMultiCacheBinding {
  entry: JournalEntry;
  local: ActiveMultiCacheLocal;
  /** This particular helper can change the shared entry. */
  mutates: boolean;
}

interface ActiveMultiCache {
  target: MultiCandidate;
  locals: ActiveMultiCacheLocal[];
  calls: WeakMap<FunctionCallNode, ActiveMultiCacheBinding[]>;
}

const COLLECTION_CACHE_LOADED_MASK = '__cj_cache_loaded_mask';
const COLLECTION_CACHE_DIRTY_MASK = '__cj_cache_dirty_mask';

/** A lowered counter-loop entry is settled by its dedicated trailing journal, not this fixed-entry cache. */
const isRuntimeCounterEntry = (node: MappingAccessNode | MappingAssignNode | MappingDeleteNode): boolean =>
  node.keys.some((key) => key instanceof ArrayAccessNode
    && key.array instanceof IdentifierNode
    && key.array.name.startsWith('__internal__vmapCounterPerm_'));

/** Sink a cloned collection-cache flush immediately before every non-tail control-flow return. */
class FlushCollectionCachesBeforeReturns extends AstTraversal {
  constructor(private readonly writes: StatementNode[]) { super(); }

  visitReturn(node: ReturnNode): Node {
    const returned = super.visitReturn(node) as ReturnNode;
    const block = new BlockNode([
      ...this.writes.map((write) => cloneNode(write) as StatementNode),
      returned,
    ]);
    block.location = node.location;
    return block;
  }
}

/**
 * Release 3's first collection-journal lowering.
 *
 * A reusable void helper which reads/writes one concrete mapping entry is
 * converted to a value handler. The physical wrapper performs the authenticated
 * entry read and the single write-back, while the OP_INVOKE body receives and
 * returns the pending value:
 *
 *   _add(k, n)                       balances[k] =
 *     balances[k] += n;       ->       _add(__journal, k, n);
 *
 * This deliberately handles only parameter-keyed, whole-value scalar entries.
 * Unsupported/dynamically discovered keys retain the established inline path;
 * they are never silently journalled.
 */
export default class LowerCollectionJournalHelpers extends AstTraversal {
  private candidates = new Map<string, Candidate>();
  private multiCandidates = new Map<string, MultiCandidate>();
  private current?: Candidate;
  private currentMulti?: MultiCandidate;
  private activeMultiCaches = new Map<FunctionDefinitionNode, ActiveMultiCache>();
  /** Candidates a rewritten call site actually supplies the journal value to. A candidate no call site threads
   * must keep its direct signature: unshifting the callee's parameter anyway leaves the two sides disagreeing
   * on the arity (a parameter-list error in generated source). */
  private threadedSingles = new Set<Candidate>();
  private threadedMultis = new Set<MultiCandidate>();

  constructor(private readonly enableAccessActivations = false) { super(); }

  private journalAccessActivations(fn: FunctionDefinitionNode): ReadonlyMap<Node, ExternalCallExpression> {
    const activations = new Map<Node, ExternalCallExpression>();
    if (!this.enableAccessActivations || !fn.body) return activations;
    const argumentsByName = stableArgumentIndices(fn);
    const booleanArguments = booleanArgumentIndices(fn);
    const combine = (outer: ExternalCallExpression | undefined, inner: ExternalCallExpression): ExternalCallExpression =>
      outer === undefined ? inner : { kind: 'binary', operator: '&&', left: outer, right: inner };
    const scan = (node: Node, activation?: ExternalCallExpression, representable = true): void => {
      if (node instanceof BranchNode) {
        const condition = argumentConditionActivation(node.condition, argumentsByName, booleanArguments);
        const supported = representable && condition !== undefined;
        scan(node.ifBlock, supported ? combine(activation, condition!) : undefined, supported);
        if (node.elseBlock) scan(node.elseBlock, supported ? combine(activation, {
          kind: 'unary', operator: '!', expression: condition,
        }) : undefined, supported);
        return;
      }
      if (representable && (node instanceof MappingAccessNode || node instanceof MappingAssignNode
        || node instanceof MappingDeleteNode || node instanceof ArrayAccessNode
        || node instanceof ArrayAssignNode || node instanceof ArrayDeleteNode)) {
        if (activation !== undefined) activations.set(node, activation);
      }
      // These scopes can skip or repeat a write independently of the surrounding replayable argument guard.
      if (node instanceof WhileNode || node instanceof DoWhileNode || node instanceof CollectionIterationNode
        || node instanceof SwitchNode || node instanceof TryCatchNode) return;
      for (const [field, value] of Object.entries(node)) {
        if (['location', 'resolvedFunction', 'functionReference', 'definition', 'collection', 'symbolTable',
          'stateVariable', 'type'].includes(field)) continue;
        if (value instanceof Node) scan(value, activation, representable);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) {
          scan(item, activation, representable);
        }
      }
    };
    scan(fn.body);
    return activations;
  }

  private journalActivationAtCall(
    activation: ExternalCallExpression, args: readonly ExpressionNode[], source: Node,
  ): ExpressionNode {
    if (activation.kind === 'source' && activation.source?.kind === 'forward'
      && activation.source.paramIndex !== undefined && args[activation.source.paramIndex]) {
      return cloneNode(args[activation.source.paramIndex]) as ExpressionNode;
    }
    if (activation.kind === 'literal' && activation.type === 'bigint' && activation.value !== undefined) {
      return this.at(new IntLiteralNode(BigInt(activation.value)), source);
    }
    if (activation.kind === 'unary' && activation.operator === '!' && activation.expression) {
      return this.at(new UnaryOpNode(
        UnaryOperator.NOT, this.journalActivationAtCall(activation.expression, args, source),
      ), source);
    }
    if (activation.kind === 'binary' && activation.left && activation.right
      && Object.values(BinaryOperator).includes(activation.operator as BinaryOperator)) {
      return this.at(new BinaryOpNode(
        this.journalActivationAtCall(activation.left, args, source),
        activation.operator as BinaryOperator,
        this.journalActivationAtCall(activation.right, args, source),
      ), source);
    }
    throw new Error('Unsupported replayable collection-journal activation');
  }

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const collections = new Map(node.collections.map((collection) => [collection.name, collection]));
    const callees = (fn: FunctionDefinitionNode): Set<FunctionDefinitionNode> => {
      const targets = new Set<FunctionDefinitionNode>();
      this.walk(fn.body, (child) => {
        if (!(child instanceof FunctionCallNode)) return;
        // Arity changes during journalling. Overloads are conservatively included; a unique generated clone
        // keeps its identity independent of appended synthetic operands.
        for (const target of node.functions) if (target.name === child.identifier.name) targets.add(target);
      });
      return targets;
    };
    const dynamicArrays = new Set(node.stateVariables.filter((state) =>
      state.isDynamic && state.type instanceof ArrayType).map((state) => state.name));
    const constructorCalls = new Set<string>();
    this.walk(node.constructorDef?.body, (candidate) => {
      if (candidate instanceof FunctionCallNode) constructorCalls.add(candidate.identifier.name);
    });
    const nameCounts = new Map<string, number>();
    for (const fn of node.functions) nameCounts.set(fn.name, (nameCounts.get(fn.name) ?? 0) + 1);
    const touchesCollection = (fn: FunctionDefinitionNode): boolean => {
      let touches = false;
      this.walk(fn.body, (candidate) => {
        if ((candidate instanceof MappingAccessNode || candidate instanceof MappingAssignNode
          || candidate instanceof MappingDeleteNode) && collections.has(candidate.name)) touches = true;
        else if (candidate instanceof ArrayAccessNode && candidate.array instanceof IdentifierNode
          && collections.has(candidate.array.name)) touches = true;
        else if ((candidate instanceof ArrayAssignNode || candidate instanceof ArrayDeleteNode)
          && collections.has(candidate.name)) touches = true;
      });
      return touches;
    };
    // `LowerDynamicStateJournalHelpers` runs immediately before this pass. A helper which directly combines one
    // chunk-backed bytes/string write with a collection entry is deliberately left on the ordinary dynamic frame,
    // and this pass value-threads its collection entry; those two physical journals compose and settle. A helper
    // which reaches the collection only through another call can still arrive here already dynamic-journalled:
    // lifting the callee's pending entry through every intermediate OP_INVOKE exit is not implemented yet. Its
    // collection access would otherwise remain in a subroutine with no block layout (or leave a clone call at the
    // wrong synthetic arity), so keep that transitive shape behind a stable diagnostic.
    //
    // The access does not have to be written in the handler. A state-touching callee is inlined into its
    // caller, and this pass's own call-site rewrite puts the entry read and the write-back in the CALLER, so
    // a collection reached through an intra-contract call lands in the same OP_INVOKE body. A body-only walk
    // therefore missed every indirect shape and let the internal error return unchanged; the reach is
    // computed over the intra-contract call graph instead. A function-pointer callsite names no target, so
    // `callGraphReach` over-approximates it to every address-taken contract function rather than admitting it.
    for (const fn of node.functions) {
      if (!fn.body || fn.parameters[0]?.name !== `__dj_${fn.name}`) continue;
      const reach = this.callGraphReach(fn, node, touchesCollection);
      if (reach.via) {
        throwJournalDiagnostic(
          'JOURNAL_LAYOUT',
          `Handler '${sourceHandlerName(fn.name)}' writes unbounded bytes/string state and also reaches a `
          + 'collection entry. The dynamic-storage journal and the collection journal do not share one exit, '
          + 'so this handler cannot flush both; split the unbounded write and the collection access into '
          + 'separate handlers'
          + (reach.via === fn.name ? '' : ` (the collection entry is reached through '${
            sourceHandlerName(reach.via)}')`),
          {
            gate: 'journal-exit-split',
            handler: sourceHandlerName(fn.name),
            via: sourceHandlerName(reach.via),
          },
        );
      }
    }
    for (const fn of node.functions) {
      if (!fn.body || fn.returnTypes.length !== 0
        || !(fn.modifiers.includes(FunctionModifier.INTERNAL)
          || fn.modifiers.includes(FunctionModifier.PRIVATE))
        || fn.inheritedFrom
        || constructorCalls.has(fn.name)
        || (nameCounts.get(fn.name) ?? 0) > 1) continue;
      // A journal helper must own its complete collection footprint. If it calls a separate
      // collection-touching helper, the later inline pass can pull that helper's physical accesses into this
      // OP_INVOKE body, adding resource witnesses after the call sites were journal-rewritten.
      if ([...callees(fn)].some((callee) => callee !== fn && touchesCollection(callee))) continue;
      // X118. An event emitted inside a value-threaded OP_INVOKE handler is dropped at the subroutine exit, so
      // code generation refuses this shape outright. It compiles on the pre-existing inline path, so do not
      // select it: the journal is an optimisation, and taking it here costs the whole contract.
      let emitsEvent = false;
      this.walk(fn.body, (candidate) => {
        if (candidate instanceof EmitStatementNode) emitsEvent = true;
      });
      if (emitsEvent) continue;
      // A counter-loop write owns its own trailing upsert journal. It must not prevent this helper from
      // value-threading a separate fixed entry read/write: e.g. `target[i] = source[0]` needs `source[0]` to
      // share the cache while `target[i]` remains on the runtime journal. Entry slots are assigned by the
      // preceding semantic pass.
      const runtimeLoopSlots = new Set((fn.entryAccesses ?? [])
        .filter((entry) => entry.inLoop)
        .map((entry) => entry.slotIndex));
      const accesses: Array<{
        name: string;
        keys: ExpressionNode[];
        node: MappingAccessNode | MappingAssignNode | MappingDeleteNode
        | ArrayAccessNode | ArrayAssignNode | ArrayDeleteNode;
      }> = [];
      let unsupported = false;
      this.walk(fn.body, (candidate) => {
        if (candidate instanceof FunctionCallNode && candidate.identifier.name === fn.name) unsupported = true;
        if (candidate instanceof MappingAccessNode || candidate instanceof MappingAssignNode
          || candidate instanceof MappingDeleteNode) {
          // A synthesized public getter can reach this late pass with a mapping-value array index still appended
          // to `keys` (the ordinary resolver normally separates it into `arrayIndex`). It is not a second physical
          // mapping key: normalize the same representation here before deciding whether the helper is journalable.
          // Array-element journal helpers remain deliberately unsupported; leaving the index in `keys` instead
          // threaded the whole array as though it were one indexed element and later emitted `array.field` reads.
          const collection = collections.get(candidate.name);
          if ((candidate instanceof MappingAccessNode || candidate instanceof MappingAssignNode)
            && candidate.arrayIndex === undefined
            && collection?.type instanceof MappingType
            && collection.innermostValueType instanceof ArrayType
            && candidate.keys.length === collection.allKeyTypes.length + 1) {
            candidate.arrayIndex = candidate.keys.pop();
          }
          if (candidate instanceof MappingAccessNode && dynamicArrays.has(candidate.name)) return;
          if (runtimeLoopSlots.has(candidate.entrySlotIndex) || isRuntimeCounterEntry(candidate)) return;
          if ((candidate instanceof MappingAccessNode && candidate.arrayIndex)
            || (candidate instanceof MappingAssignNode && candidate.arrayIndex)) unsupported = true;
          accesses.push({ name: candidate.name, keys: candidate.keys, node: candidate });
        } else if (candidate instanceof ArrayAccessNode && candidate.array instanceof IdentifierNode
          && collections.has(candidate.array.name)) {
          accesses.push({ name: candidate.array.name, keys: [candidate.index], node: candidate });
        } else if ((candidate instanceof ArrayAssignNode || candidate instanceof ArrayDeleteNode)
          && collections.has(candidate.name)) {
          accesses.push({ name: candidate.name, keys: [candidate.index], node: candidate });
        } else if (candidate.constructor.name === 'MappingFieldAssignNode') unsupported = true;
      });
      if (unsupported || accesses.length === 0) continue;
      const parameterNames = new Set(fn.parameters.map((parameter) => parameter.name));
      const normalized = accesses.map((access) => ({
        ...access,
        keyParameters: access.keys.map((key) =>
          key instanceof IdentifierNode && parameterNames.has(key.name) ? key.name : undefined),
      }));
      const stableKeys = !normalized.some((access) =>
        access.keyParameters.some((key) => key === undefined));
      if (!stableKeys) continue;
      const leafAccesses = stableKeys ? normalized.filter((access) => !normalized.some((other) =>
        other !== access
        && other.name === access.name
        && other.keyParameters.length > access.keyParameters.length
        && access.keyParameters.every((key, index) => key === other.keyParameters[index]))) : [];
      const accessActivations = this.journalAccessActivations(fn);
      const mutationGuards = new Map<string, ExternalCallExpression[]>();
      const unguardedMutations = new Set<string>();
      const accessGuards = new Map<string, ExternalCallExpression[]>();
      const unguardedAccesses = new Set<string>();
      for (const access of leafAccesses) {
        const identity = `${access.name}[${access.keyParameters.join(',')}]`;
        const guard = accessActivations.get(access.node);
        if (guard === undefined) unguardedAccesses.add(identity);
        else accessGuards.set(identity, [...(accessGuards.get(identity) ?? []), guard]);
        if (access.node instanceof MappingAccessNode || access.node instanceof ArrayAccessNode) continue;
        if (guard === undefined) unguardedMutations.add(identity);
        else mutationGuards.set(identity, [...(mutationGuards.get(identity) ?? []), guard]);
      }
      const distinct = new Map<string, JournalEntry>();
      for (const access of leafAccesses) {
        const collection = collections.get(access.name);
        if (!collection) {
          unsupported = true;
          break;
        }
        const keyParameters = access.keyParameters as string[];
        const identity = `${access.name}[${keyParameters.join(',')}]`;
        const mutates = !(access.node instanceof MappingAccessNode
          || access.node instanceof ArrayAccessNode);
        const existing = distinct.get(identity);
        if (existing) {
          existing.mutates ||= mutates;
        } else {
          distinct.set(identity, {
            collection: access.name,
            keyParameters,
            journalName: `__cj_${fn.name}_${distinct.size}`,
            valueType: collection.innermostValueType,
            mutates,
            sourceScope: fn.inheritedFrom,
          });
        }
      }
      // A shared journal is dirty exactly when at least one of its guarded source mutation sites runs.
      // Any unguarded or unsupported site makes that condition unconditional instead.
      for (const [identity, entry] of distinct) {
        if (!unguardedAccesses.has(identity)) {
          const seenAccesses = new Set<string>();
          for (const guard of accessGuards.get(identity) ?? []) {
            const key = JSON.stringify(guard);
            if (seenAccesses.has(key)) continue;
            seenAccesses.add(key);
            entry.loadActivation = entry.loadActivation === undefined ? guard
              : { kind: 'binary', operator: '||', left: entry.loadActivation, right: guard };
          }
        }
        if (!entry.mutates || unguardedMutations.has(identity)) continue;
        const seen = new Set<string>();
        for (const guard of mutationGuards.get(identity) ?? []) {
          const key = JSON.stringify(guard);
          if (seen.has(key)) continue;
          seen.add(key);
          entry.activation = entry.activation === undefined ? guard
            : { kind: 'binary', operator: '||', left: entry.activation, right: guard };
        }
      }
      if (unsupported || distinct.size === 0) continue;
      // Every journalled entry value leaves through the single exit this pass appends below. A bare early
      // `return;` in the helper leaves before that exit, so it cannot carry the pending values back. The
      // wrapper-level check further down already rejects an early return in the CALLER for the same reason;
      // an early return in the helper itself was never checked, and because this pass runs before type
      // checking the user saw 'Return type mismatch: expected (bigint, bigint) but found ()' pointing at
      // their own `return;` rather than a diagnostic. Reject it by name.
      let hasEarlyReturn = false;
      this.walk(fn.body, (candidate) => {
        if (candidate instanceof ReturnNode) hasEarlyReturn = true;
      });
      if (hasEarlyReturn) {
        throwJournalDiagnostic(
          'JOURNAL_LAYOUT',
          `Collection journal helper '${sourceHandlerName(fn.name)}' cannot contain an early return; `
          + 'its journalled entry values are flushed only at the single function exit',
          {
            gate: 'journal-early-return',
            handler: sourceHandlerName(fn.name),
          },
        );
      }
      if (distinct.size > 1) {
        this.multiCandidates.set(`${fn.name}/${fn.parameters.length}`, { fn, entries: [...distinct.values()] });
        continue;
      }
      const [entry] = distinct.values();
      const journalName = `__cj_${fn.name}`;
      this.candidates.set(`${fn.name}/${fn.parameters.length}`, {
        fn, collection: entry.collection, keyParameters: entry.keyParameters, journalName,
        valueType: entry.valueType,
      });
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_TRACE === '1') {
      console.error('collection-journal-candidates', JSON.stringify({
        contract: node.name,
        candidates: [...this.candidates.keys()],
        multiCandidates: [...this.multiCandidates.entries()].map(([key, candidate]) => ({
          key,
          entries: candidate.entries.map((entry) => ({
            collection: entry.collection,
            keys: entry.keyParameters,
            journalName: entry.journalName,
          })),
        })),
      }, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
    }

    // Rewrite call sites before changing arities.
    const candidateFunctions = new Set<FunctionDefinitionNode>([
      ...[...this.candidates.values()].map((candidate) => candidate.fn),
      ...[...this.multiCandidates.values()].map((candidate) => candidate.fn),
    ]);
    const rewriteBody = (fn: FunctionDefinitionNode): void => {
      if (!fn.body) return;
      this.current = this.resolveSingle(fn.name, fn.parameters.length);
      this.currentMulti = this.resolveMulti(fn.name, fn.parameters.length);
      this.activeMultiCaches = this.currentMulti
        ? new Map()
        : this.prepareMultiCaches(fn.body, new Set(fn.parameters.map(({ name }) => name)));
      fn.body = this.rewriteBlock(fn.body);
      if (this.activeMultiCaches.size > 0) this.installMultiCaches(fn.body);
    };
    // Callers first. A candidate's OWN body is rewritten in the same shape - its writes and reads are moved onto
    // the journal locals its unshifted parameter carries - but whether it is journaled at all is only known once
    // every call site has been visited (`threadedSingles`/`threadedMultis`). Rewriting a candidate body up front
    // therefore leaves journal symbols behind in a helper whose signature stays direct, which the type checker
    // reports as `Undefined reference to symbol __cj_...`: the same arity/symbol disagreement as unshifting
    // a parameter no call site supplies.
    for (const fn of node.functions) {
      if (!fn.body || candidateFunctions.has(fn)) continue;
      rewriteBody(fn);
    }
    for (const fn of node.functions) {
      if (!fn.body || !candidateFunctions.has(fn)) continue;
      const candidate = this.candidates.get(`${fn.name}/${fn.parameters.length}`);
      const multiCandidate = this.multiCandidates.get(`${fn.name}/${fn.parameters.length}`);
      if (candidate === undefined && multiCandidate === undefined) continue;
      const threaded = (candidate !== undefined && this.threadedSingles.has(candidate))
        || (multiCandidate !== undefined && this.threadedMultis.has(multiCandidate));
      if (!threaded) continue;
      rewriteBody(fn);
    }
    this.current = undefined;
    this.currentMulti = undefined;
    this.activeMultiCaches = new Map();

    // Turn each selected helper into a state-independent value handler. It is
    // now safe for normal OP_DEFINE/OP_INVOKE lowering.
    for (const candidate of this.candidates.values()) {
      // No call site supplies this helper's journal value, so it keeps its direct signature and its own frame
      // owns the write.
      if (!this.threadedSingles.has(candidate)) continue;
      const valueType = candidate.valueType;
      candidate.fn.parameters.unshift(this.at(new ParameterNode(
        valueType, candidate.journalName, [],
      ), candidate.fn));
      for (const parameter of candidate.fn.parameters) {
        if (candidate.keyParameters.includes(parameter.name)) parameter.syntheticallyUsed = true;
      }
      candidate.fn.returnTypes = [valueType];
      const body = candidate.fn.body!;
      body.statements ??= [];
      body.statements.push(this.at(
        new ReturnNode([this.at(new IdentifierNode(candidate.journalName), candidate.fn)]), candidate.fn,
      ));
      candidate.fn.collectionJournal = true;
    }
    for (const candidate of this.multiCandidates.values()) {
      if (!this.threadedMultis.has(candidate)) continue;
      candidate.fn.parameters.unshift(...candidate.entries.map((entry) =>
        this.at(new ParameterNode(entry.valueType, entry.journalName, []), candidate.fn)));
      for (const parameter of candidate.fn.parameters) {
        if (candidate.entries.some((entry) => entry.keyParameters.includes(parameter.name))) {
          parameter.syntheticallyUsed = true;
        }
      }
      candidate.fn.returnTypes = candidate.entries.map((entry) => entry.valueType);
      candidate.fn.returnNames = [];
      const body = candidate.fn.body!;
      body.statements ??= [];
      body.statements.push(this.at(new ReturnNode(
        candidate.entries.map((entry) => this.at(new IdentifierNode(entry.journalName), candidate.fn)),
      ), candidate.fn));
      // This pass runs between semantic traversals. The first traversal's
      // entry metadata describes the pre-lowered storage body; leaving it on
      // the node would make the second traversal retain vmap witness parameters
      // for accesses which no longer exist.
      candidate.fn.entryAccesses = undefined;
      candidate.fn.sortedBatchInfo = undefined;
      candidate.fn.blockLayout = undefined;
      this.invalidateSemanticMetadata(candidate.fn);
      candidate.fn.collectionJournal = true;
    }
    return node;
  }

  private rewriteBlock(block: BlockNode): BlockNode {
    block.statements = (block.statements ?? []).flatMap((statement) => this.rewriteStatement(statement));
    return block;
  }

  /**
   * Resolve a journal candidate for a call. Candidates are registered by name AND arity, but arity MUTATES:
   * semantic analysis appends synthetic parameters after registration, and a compiler-generated call can write
   * some of those synthetics at the call site itself. The exact key then misses on both sides -
   * the callee keeps a leading `__cj_` parameter its call site never supplies. Fall back to the name when it
   * identifies exactly one candidate; an overloaded name keeps the strict arity match.
   */
  private resolveMulti(name: string, argumentCount: number): MultiCandidate | undefined {
    const exact = this.multiCandidates.get(`${name}/${argumentCount}`);
    if (exact) return exact;
    // Only when the call carries MORE arguments than the registered arity: a synthetic operand was appended to it.
    // A call with FEWER arguments is under-supplied for some other reason and must keep failing.
    const byName = [...this.multiCandidates.entries()]
      .filter(([key]) => key.slice(0, key.lastIndexOf('/')) === name
        && argumentCount >= Number(key.slice(key.lastIndexOf('/') + 1)))
      .map(([, value]) => value);
    return byName.length === 1 ? byName[0] : undefined;
  }

  private resolveSingle(name: string, argumentCount: number): Candidate | undefined {
    const exact = this.candidates.get(`${name}/${argumentCount}`);
    if (exact) return exact;
    const byName = [...this.candidates.entries()]
      .filter(([key]) => key.slice(0, key.lastIndexOf('/')) === name
        && argumentCount >= Number(key.slice(key.lastIndexOf('/') + 1)))
      .map(([, value]) => value);
    return byName.length === 1 ? byName[0] : undefined;
  }

  private rewriteStatement(statement: StatementNode): StatementNode | StatementNode[] {
    if (statement instanceof FunctionCallStatementNode) {
      const multiTarget = this.resolveMulti(
        statement.call.identifier.name, statement.call.parameters.length,
      );
      if (multiTarget) {
        this.threadedMultis.add(multiTarget);
        return this.rewriteMultiCall(statement.call, multiTarget);
      }
      const target = this.resolveSingle(statement.call.identifier.name, statement.call.parameters.length);
      if (target) {
        this.threadedSingles.add(target);
        return this.rewriteCall(statement.call, target);
      }
    }
    // A pooled helper returns no source result, so only an empty tuple can take its call.
    if (statement instanceof TupleAssignmentNode && statement.tuple instanceof FunctionCallNode
      && statement.elements.length === 0) {
      const target = this.resolveMulti(statement.tuple.identifier.name, statement.tuple.parameters.length);
      if (target) {
        this.threadedMultis.add(target);
        return this.rewriteMultiCall(statement.tuple, target);
      }
    }
    if (this.currentMulti && statement instanceof MappingAssignNode) {
      const entry = this.multiEntry(statement.name, statement.keys);
      if (entry) {
        if (statement.arrayPush) {
          const push = this.at(new ArrayPushNode(
            entry.journalName, this.rewriteExpression(statement.expression),
          ), statement);
          push.noArg = statement.noArg;
          return push;
        }
        if (statement.arrayPop) return this.at(new ArrayPopNode(entry.journalName), statement);
        return this.at(new AssignNode(
          this.at(new IdentifierNode(entry.journalName), statement),
          this.rewriteExpression(statement.expression),
        ), statement);
      }
    }
    if (this.currentMulti && statement instanceof MappingDeleteNode) {
      const entry = this.multiEntry(statement.name, statement.keys);
      if (entry) {
        return this.at(new AssignNode(
          this.at(new IdentifierNode(entry.journalName), statement),
          createDefaultValueExpression(entry.valueType, statement.location),
        ), statement);
      }
    }
    if (this.currentMulti && statement instanceof ArrayAssignNode) {
      const entry = this.multiEntry(statement.name, [statement.index]);
      if (entry) {
        return this.at(new AssignNode(
          this.at(new IdentifierNode(entry.journalName), statement),
          this.rewriteExpression(statement.value),
        ), statement);
      }
    }
    if (this.currentMulti && statement instanceof ArrayDeleteNode) {
      const entry = this.multiEntry(statement.name, [statement.index]);
      if (entry) {
        return this.at(new AssignNode(
          this.at(new IdentifierNode(entry.journalName), statement),
          createDefaultValueExpression(entry.valueType, statement.location),
        ), statement);
      }
    }
    if (this.current && statement instanceof MappingAssignNode
      && statement.name === this.current.collection) {
      if (statement.arrayPush) {
        const push = this.at(new ArrayPushNode(
          this.current.journalName, this.rewriteExpression(statement.expression),
        ), statement);
        push.noArg = statement.noArg;
        return push;
      }
      if (statement.arrayPop) return this.at(new ArrayPopNode(this.current.journalName), statement);
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), statement),
        this.rewriteExpression(statement.expression),
      ), statement);
    }
    if (this.current && statement instanceof ArrayAssignNode
      && statement.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), statement),
        this.rewriteExpression(statement.value),
      ), statement);
    }
    if (this.current && statement instanceof MappingDeleteNode
      && statement.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), statement),
        createDefaultValueExpression(this.current.valueType, statement.location),
      ), statement);
    }
    if (this.current && statement instanceof ArrayDeleteNode
      && statement.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), statement),
        createDefaultValueExpression(this.current.valueType, statement.location),
      ), statement);
    }
    if (statement instanceof BranchNode) {
      statement.condition = this.rewriteExpression(statement.condition);
      statement.ifBlock = this.rewriteBlock(statement.ifBlock);
      if (statement.elseBlock) statement.elseBlock = this.rewriteBlock(statement.elseBlock);
      return statement;
    }
    // A desugared `for` is `{ init; while { body; update } }`. Assignment-form
    // invokes of returning journal helpers live in that while body; visiting only if/else left them
    // at the pre-journal arity and failed typecheck (`bool` pending prepended, call site unchanged).
    if (statement instanceof BlockNode) return this.rewriteBlock(statement);
    if (statement instanceof WhileNode) {
      statement.condition = this.rewriteExpression(statement.condition);
      statement.block = this.rewriteBlock(statement.block);
      return statement;
    }
    if (statement instanceof DoWhileNode) {
      statement.block = this.rewriteBlock(statement.block);
      statement.condition = this.rewriteExpression(statement.condition);
      return statement;
    }
    if (statement instanceof UncheckedNode) {
      statement.block = this.rewriteBlock(statement.block);
      return statement;
    }
    if (statement instanceof SwitchNode) {
      statement.expression = this.rewriteExpression(statement.expression);
      statement.cases = statement.cases.map((switchCase) => {
        switchCase.body = this.rewriteBlock(switchCase.body);
        return switchCase;
      });
      if (statement.defaultCase) statement.defaultCase = this.rewriteBlock(statement.defaultCase);
      return statement;
    }
    // Use the ordinary visitor for expression-bearing statement shapes. The
    // dedicated mapping/call cases above are the only statement replacements.
    return this.visit(statement) as StatementNode;
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    const multi = this.multiEntry(node.name, node.keys);
    if (multi) return this.at(new IdentifierNode(multi.journalName), node);
    if (this.current && node.name === this.current.collection) {
      return this.at(new IdentifierNode(this.current.journalName), node);
    }
    return super.visitMappingAccess(node);
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    if (this.currentMulti) {
      const flattened = this.flattenArrayAccess(node);
      const multi = flattened && this.multiEntry(flattened.collection, flattened.keys);
      if (multi) return this.at(new IdentifierNode(multi.journalName), node);
    }
    if (this.current && node.array instanceof IdentifierNode
      && node.array.name === this.current.collection) {
      return this.at(new IdentifierNode(this.current.journalName), node);
    }
    return super.visitArrayAccess(node);
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    const multiTarget = this.resolveMulti(node.call.identifier.name, node.call.parameters.length);
    if (multiTarget) {
      // A multi-journal invocation lowers to one tuple-capture statement, so
      // generic traversal through nested loop/switch wrappers can replace it
      // directly even when rewriteBlock did not own the immediate statement
      // list.
      return this.rewriteMultiCall(node.call, multiTarget);
    }
    const target = this.resolveSingle(node.call.identifier.name, node.call.parameters.length);
    return target ? this.rewriteCall(node.call, target) : super.visitFunctionCallStatement(node);
  }

  visitMappingAssign(node: MappingAssignNode): Node {
    const multi = this.multiEntry(node.name, node.keys);
    if (multi) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(multi.journalName), node),
        this.rewriteExpression(node.expression),
      ), node);
    }
    if (this.current && node.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node),
        this.rewriteExpression(node.expression),
      ), node);
    }
    return super.visitMappingAssign(node);
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    const multi = this.multiEntry(node.name, [node.index]);
    if (multi) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(multi.journalName), node),
        this.rewriteExpression(node.value),
      ), node);
    }
    if (this.current && node.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node),
        this.rewriteExpression(node.value),
      ), node);
    }
    return super.visitArrayAssign(node);
  }

  visitMappingDelete(node: MappingDeleteNode): Node {
    const multi = this.multiEntry(node.name, node.keys);
    if (multi) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(multi.journalName), node),
        createDefaultValueExpression(multi.valueType, node.location),
      ), node);
    }
    if (this.current && node.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node),
        createDefaultValueExpression(this.current.valueType, node.location),
      ), node);
    }
    return super.visitMappingDelete(node);
  }

  visitArrayDelete(node: ArrayDeleteNode): Node {
    const multi = this.multiEntry(node.name, [node.index]);
    if (multi) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(multi.journalName), node),
        createDefaultValueExpression(multi.valueType, node.location),
      ), node);
    }
    if (this.current && node.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node),
        createDefaultValueExpression(this.current.valueType, node.location),
      ), node);
    }
    return super.visitArrayDelete(node);
  }

  private rewriteExpression(expression: ExpressionNode): ExpressionNode {
    return this.visit(expression) as ExpressionNode;
  }

  private rewriteCall(call: FunctionCallNode, target: Candidate): StatementNode {
    const args = call.parameters.map((argument) => cloneNode(argument) as ExpressionNode);
    const keyArgs = target.keyParameters.map((name) => {
      const index = target.fn.parameters.findIndex((parameter) => parameter.name === name);
      return cloneNode(call.parameters[index]) as ExpressionNode;
    });
    const insideSameEntry = this.current?.collection === target.collection
      && this.current.keyParameters.length === target.keyParameters.length
      && keyArgs.every((argument, i) =>
        argument instanceof IdentifierNode && argument.name === this.current!.keyParameters[i]);
    const read = insideSameEntry
      ? this.at(new IdentifierNode(this.current!.journalName), call)
      : this.at(new MappingAccessNode(target.collection, keyArgs.map((key) =>
        cloneNode(key) as ExpressionNode)), call);
    if (read instanceof MappingAccessNode) read.fromModifier = target.fn.inheritedFrom;
    const invoked = this.at(new FunctionCallNode(
      this.at(new IdentifierNode(call.identifier.name), call), [read, ...args],
    ), call);
    if (insideSameEntry) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current!.journalName), call), invoked,
      ), call);
    }
    const write = this.at(new MappingAssignNode(target.collection, keyArgs, invoked), call);
    write.fromModifier = target.fn.inheritedFrom;
    return write;
  }

  private rewriteMultiCall(call: FunctionCallNode, target: MultiCandidate): StatementNode {
    const cache = this.activeMultiCaches.get(target.fn);
    if (!cache) {
      throwJournalDiagnostic(
        'JOURNAL_INTERNAL_DEFECT',
        `Missing function-scoped collection journal for '${target.fn.name}'`,
        { gate: 'journal-function-scope-missing', handler: target.fn.name },
      );
    }
    const callLocals = cache.calls.get(call);
    if (!callLocals) {
      throwJournalDiagnostic(
        'JOURNAL_INTERNAL_DEFECT',
        `Missing call-scoped collection journal for '${target.fn.name}'`,
        { gate: 'journal-call-scope-missing', handler: target.fn.name },
      );
    }
    const originalArgs = call.parameters.map((argument) => cloneNode(argument) as ExpressionNode);
    const invoked = this.at(new FunctionCallNode(
      this.at(new IdentifierNode(call.identifier.name), call),
      [
        ...callLocals.map(({ local }) => this.at(new IdentifierNode(local.name), call)),
        ...originalArgs,
      ],
    ), call);
    const loadLocal = (local: ActiveMultiCacheLocal): StatementNode => {
      const read = this.at(new MappingAccessNode(local.entry.collection, local.keys.map((key) =>
        cloneNode(key) as ExpressionNode)), call);
      read.fromModifier = local.entry.sourceScope;
      const load = this.at(new AssignNode(
        this.at(new IdentifierNode(local.name), call), read,
      ), call);
      return this.at(new BranchNode(
        this.cacheMaskIsClear(COLLECTION_CACHE_LOADED_MASK, local.index, call),
        this.at(new BlockNode([
          load,
          this.setCacheMaskBit(COLLECTION_CACHE_LOADED_MASK, local.index, call),
        ]), call),
      ), call);
    };
    const ordinaryBindings = new Map<string, ActiveMultiCacheBinding[]>();
    for (const binding of callLocals) {
      const group = ordinaryBindings.get(binding.local.name) ?? [];
      group.push(binding);
      ordinaryBindings.set(binding.local.name, group);
    }
    const loads = [...ordinaryBindings.values()].map((bindings): StatementNode => {
      const load = loadLocal(bindings[0].local);
      if (bindings.some((binding) => binding.entry.loadActivation === undefined)) return load;
      const guard = bindings.map((binding) => this.journalActivationAtCall(
        binding.entry.loadActivation!, originalArgs, call,
      )).reduce((left, right) => this.at(new BinaryOpNode(
        left, BinaryOperator.OR, right,
      ), call));
      return this.at(new BranchNode(guard, this.at(new BlockNode([load]), call)), call);
    });
    // A multi-entry handler returns one journal value per entry.
    const capture = this.at(new TupleAssignmentNode(
      callLocals.map(({ entry, local, mutates }) => ({
        name: local.name, type: entry.valueType, existing: true,
        // A read-only helper returns the cache solely because every pooled helper shares one physical tuple
        // convention. Its value is provably unchanged, so discard that tuple field instead of writing it back
        // to the same local. Writers still replace the shared cache and are marked dirty below.
        skip: !mutates,
      })),
      invoked,
      true,
    ), call);
    const ordinaryDirtyBindings = new Map<string, ActiveMultiCacheBinding[]>();
    for (const binding of callLocals) {
      if (!binding.mutates) continue;
      const group = ordinaryDirtyBindings.get(binding.local.name) ?? [];
      group.push(binding);
      ordinaryDirtyBindings.set(binding.local.name, group);
    }
    const ordinaryDirties = [...ordinaryDirtyBindings.values()].map((bindings): StatementNode => {
      const { local } = bindings[0];
      const mark = this.setCacheMaskBit(COLLECTION_CACHE_DIRTY_MASK, local.index, call);
      const activation = bindings.length === 1 ? bindings[0].entry.activation : undefined;
      return activation === undefined ? mark : this.at(new BranchNode(
        this.journalActivationAtCall(activation, originalArgs, call),
        this.at(new BlockNode([mark]), call),
      ), call);
    });
    return this.at(new BlockNode([...loads, capture, ...ordinaryDirties]), call);
  }

  private prepareMultiCaches(
    body: BlockNode,
    wrapperParameters: Set<string>,
  ): Map<FunctionDefinitionNode, ActiveMultiCache> {
    const caches = new Map<FunctionDefinitionNode, ActiveMultiCache>();
    // One physical entry gets one pending journal value per wrapper, however many different handlers touch it.
    // A pool per callee would allocate a separate cache local - and therefore a separate vmap slot - per handler
    // for the same entry, which the SDK reports as a duplicate upsert slot.
    const sharedLocals: ActiveMultiCache['locals'] = [];
    const calls: FunctionCallNode[] = [];
    const debugTrace = (globalThis as { process?: { env?: Record<string, string> } })
      .process?.env?.SOLIDC_DEBUG_TRACE === '1';
    const debugCalls: Array<{
      target: string;
      bindings: Array<{ local: string; keys: string[] }>;
    }> = [];
    this.walk(body, (node) => {
      if (node instanceof FunctionCallNode
        && this.resolveMulti(node.identifier.name, node.parameters.length)) calls.push(node);
    });
    for (const call of calls) {
      const target = this.resolveMulti(
        call.identifier.name, call.parameters.length,
      );
      if (!target) continue;
      const keysFor = (entry: JournalEntry): ExpressionNode[] => entry.keyParameters.map((name) => {
        const parameterIndex = target.fn.parameters.findIndex((parameter) => parameter.name === name);
        return cloneNode(call.parameters[parameterIndex]) as ExpressionNode;
      });
      const identitiesFor = (keys: ExpressionNode[]): string[] => keys.map((key) => {
        const identity = this.canonicalCacheKey(key, wrapperParameters);
        if (identity === undefined) {
          throwJournalDiagnostic(
            'JOURNAL_LAYOUT',
            `Collection journal helper '${target.fn.name}' requires a stable key expression; `
            + `use a wrapper parameter, literal, or transaction global (found ${key.constructor.name}: ${
              key instanceof IdentifierNode ? key.name : key.toString()})`,
            {
              gate: 'journal-unstable-key',
              handler: target.fn.name,
              keyNode: key.constructor.name,
            },
          );
        }
        return identity;
      });
      const cache = caches.get(target.fn) ?? {
        target,
        locals: sharedLocals,
        calls: new WeakMap(),
      };
      if (!caches.has(target.fn)) caches.set(target.fn, cache);
      const callLocals = target.entries.map((entry): ActiveMultiCacheBinding => {
        const keys = keysFor(entry);
        const keyIdentity = identitiesFor(keys);
        const prior = cache.locals.find((local) =>
          local.entry.collection === entry.collection
          && local.keyIdentity.length === keyIdentity.length
          && local.keyIdentity.every((candidate, keyIndex) =>
            candidate === keyIdentity[keyIndex]));
        let local: ActiveMultiCacheLocal;
        if (prior) {
          prior.mutates ||= entry.mutates;
          local = prior;
        } else {
          local = {
            entry,
            // Pool-scoped, not callee-scoped: the name identifies the entry inside this wrapper.
            name: `__cj_cache_${sharedLocals.length}`,
            keys,
            keyIdentity,
            index: sharedLocals.length,
            mutates: entry.mutates,
          };
          cache.locals.push(local);
        }
        return { entry, local, mutates: entry.mutates };
      });
      cache.calls.set(call, callLocals);
      if (debugTrace) {
        debugCalls.push({
          target: target.fn.name,
          bindings: callLocals.map((binding) => ({
            local: binding.local.name,
            keys: binding.local.keyIdentity,
          })),
        });
      }
    }
    if (debugTrace && caches.size > 0) {
      console.error('collection-journal-pool', JSON.stringify({
        calls: debugCalls,
        pools: [...caches.entries()].map(([key, cache]) => ({
          key: key.name,
          targetEntries: cache.target.entries.map((entry) => ({
            collection: entry.collection,
            keys: entry.keyParameters,
            journalName: entry.journalName,
            mutates: entry.mutates,
          })),
          locals: cache.locals.map((local) => ({
            name: local.name,
            collection: local.entry.collection,
            keyIdentity: local.keyIdentity,
            mutates: local.mutates,
          })),
        })),
      }, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
    }
    return caches;
  }

  /**
   * Match the storage layer's identity for the call-site forms Release 3
   * supports. Wrapper parameters remain symbolic; literals use their parsed
   * value; nullary transaction/message globals use their operator. More
   * complex expressions are rejected instead of being assigned a weaker
   * identity which could create two stale locals for one physical entry.
   */
  private canonicalCacheKey(
    key: ExpressionNode,
    wrapperParameters: Set<string>,
  ): string | undefined {
    if (key instanceof IdentifierNode && wrapperParameters.has(key.name)) {
      return `parameter:${key.name}`;
    }
    if (key instanceof LiteralNode) {
      return `literal:${key.constructor.name}:${key.toString()}`;
    }
    if (key instanceof NullaryOpNode) return `nullary:${key.operator}`;
    return undefined;
  }

  private installMultiCaches(body: BlockNode): void {
    // Every cache shares one locals pool, so collapse to the distinct locals before emitting declarations and
    // write-backs. Values are loaded lazily at the rewritten call site: only a handler call that runs has a physical
    // entry resource. Loading every cache at function entry made an untaken handler validate a dummy slot (and
    // writing every cache created phantom upserts).
    const pooled = [...new Set([...this.activeMultiCaches.values()].flatMap((cache) => cache.locals))];
    const caches = [{ locals: pooled }];
    const declarations = caches.flatMap((cache) => cache.locals.map(({ entry, name }) => {
      const initial = createDefaultValueExpression(entry.valueType, body.location);
      return this.at(new VariableDefinitionNode(entry.valueType, [], name, initial), body);
    }));
    if (pooled.length > 0) {
      const loadedWordCount = Math.ceil((Math.max(...pooled.map(({ index }) => index)) + 1) / 256);
      for (let word = 0; word < loadedWordCount; word += 1) {
        declarations.push(this.at(new VariableDefinitionNode(
          new IntType(false, 256), [], `${COLLECTION_CACHE_LOADED_MASK}_${word}`,
          this.at(new IntLiteralNode(0n), body),
        ), body));
      }
    }
    if (pooled.some(({ mutates }) => mutates)) {
      const dirtyWordCount = Math.ceil((Math.max(...pooled.filter(({ mutates }) => mutates)
        .map(({ index }) => index)) + 1) / 256);
      for (let word = 0; word < dirtyWordCount; word += 1) {
        declarations.push(
          this.at(new VariableDefinitionNode(
            new IntType(false, 256), [], `${COLLECTION_CACHE_DIRTY_MASK}_${word}`,
            this.at(new IntLiteralNode(0n), body),
          ), body),
        );
      }
    }
    const writes = caches.flatMap((cache) => cache.locals.filter(({ mutates }) => mutates)
      .map(({ entry, name, keys, index }) => {
        const write = this.at(new MappingAssignNode(
          entry.collection,
          keys.map((key) => cloneNode(key) as ExpressionNode),
          this.at(new IdentifierNode(name), body),
        ), body);
        write.fromModifier = entry.sourceScope;
        const flush = this.at(new BranchNode(
          this.cacheMaskIsSet(COLLECTION_CACHE_DIRTY_MASK, index, body),
          this.at(new BlockNode([write]), body),
        ), body);
        flush.preserveConditionalEntryWrites = true;
        return flush;
      }));
    const statements = body.statements ?? [];
    // Keep a top-level tail return structurally visible to the later all-paths-return analysis. Its flush is
    // inserted immediately before it; only earlier/nested returns need block replacement.
    const tailReturn = statements.length > 0 && statements[statements.length - 1] instanceof ReturnNode
      ? statements.pop() as ReturnNode
      : undefined;
    // Preserve every earlier/nested exit as one block containing a cloned flush and its return. The later
    // EarlyReturnTransformation can then unify control flow without moving the return ahead of the write-backs.
    body.accept(new FlushCollectionCachesBeforeReturns(writes));
    // A top-level tail return stays structurally visible to the all-paths-return analysis and follows the writes.
    const rewritten = body.statements ?? [];
    const tail: StatementNode[] = [];
    if (!tailReturn && rewritten.length > 0 && rewritten[rewritten.length - 1] instanceof RequireNode) {
      tail.unshift(rewritten.pop()!);
    }
    body.statements = [
      ...declarations, ...rewritten, ...writes, ...(tailReturn ? [tailReturn] : tail),
    ];
  }

  private cacheMaskBit(index: number, source: Node): IntLiteralNode {
    return this.at(new IntLiteralNode(1n << BigInt(index % 256)), source);
  }

  private cacheMaskIsSet(name: string, index: number, source: Node): ExpressionNode {
    const wordName = `${name}_${Math.floor(index / 256)}`;
    return this.at(new BinaryOpNode(
      this.at(new BinaryOpNode(
        this.at(new IdentifierNode(wordName), source),
        BinaryOperator.BIT_AND,
        this.cacheMaskBit(index, source),
      ), source),
      BinaryOperator.NE,
      this.at(new IntLiteralNode(0n), source),
    ), source);
  }

  private cacheMaskIsClear(name: string, index: number, source: Node): ExpressionNode {
    const wordName = `${name}_${Math.floor(index / 256)}`;
    return this.at(new BinaryOpNode(
      this.at(new BinaryOpNode(
        this.at(new IdentifierNode(wordName), source),
        BinaryOperator.BIT_AND,
        this.cacheMaskBit(index, source),
      ), source),
      BinaryOperator.EQ,
      this.at(new IntLiteralNode(0n), source),
    ), source);
  }

  private setCacheMaskBit(name: string, index: number, source: Node): AssignNode {
    const wordName = `${name}_${Math.floor(index / 256)}`;
    return this.at(new AssignNode(
      this.at(new IdentifierNode(wordName), source),
      this.at(new BinaryOpNode(
        this.at(new IdentifierNode(wordName), source),
        BinaryOperator.BIT_OR,
        this.cacheMaskBit(index, source),
      ), source),
    ), source);
  }

  private multiEntry(collection: string, keys: ExpressionNode[]): JournalEntry | undefined {
    if (!this.currentMulti) return undefined;
    return this.currentMulti.entries.find((entry) =>
      entry.collection === collection
      && entry.keyParameters.length === keys.length
      && keys.every((key, index) =>
        key instanceof IdentifierNode && key.name === entry.keyParameters[index]));
  }

  private flattenArrayAccess(node: ArrayAccessNode): {
    collection: string;
    keys: ExpressionNode[];
  } | undefined {
    const keys: ExpressionNode[] = [node.index];
    let base: ExpressionNode = node.array;
    while (base instanceof ArrayAccessNode) {
      keys.unshift(base.index);
      base = base.array;
    }
    return base instanceof IdentifierNode ? { collection: base.name, keys } : undefined;
  }

  private invalidateSemanticMetadata(root: Node): void {
    const seen = new Set<Node>();
    const walk = (node: Node): void => {
      if (seen.has(node)) return;
      seen.add(node);
      (node as Node & { symbolTable?: unknown }).symbolTable = undefined;
      if (node instanceof IdentifierNode) {
        node.definition = undefined;
        node.functionReference = undefined;
      }
      if (node instanceof FunctionCallNode) node.resolvedFunction = undefined;
      for (const [key, child] of Object.entries(node)) {
        if (['resolvedFunction', 'functionReference', 'definition', 'collection',
          'symbolTable', 'stateVariable'].includes(key)) continue;
        if (child instanceof Node) walk(child);
        else if (Array.isArray(child)) {
          for (const item of child) if (item instanceof Node) walk(item);
        }
      }
    };
    walk(root);
  }

  /**
   * Does `root` reach a collection entry, directly or through an intra-contract call?
   *
   * Returns the name of the first function whose own body touches a collection. Calls that resolve to no
   * contract function and to no local binding are builtins, casts, free functions and external-contract
   * calls; none of them can touch THIS contract's collections, so they are ignored.
   *
   * A call through a name bound inside the function - or an `IndirectCallNode` - is a function-pointer
   * dispatch whose target is not named at the callsite. Rejecting those outright fails closed on shapes that
   * compile today: a local or parameter pointer assigned a known handler is analysable, and two such contracts
   * were measured compiling before this reach existed. The target set is over-approximated instead, to every
   * contract function whose NAME is taken somewhere in the contract without being called - the only way a
   * pointer to an intra-contract function can be produced. A foreign pointer cannot reach these collections.
   */
  private callGraphReach(
    root: FunctionDefinitionNode,
    contract: ContractNode,
    touchesCollection: (fn: FunctionDefinitionNode) => boolean,
  ): { via?: string } {
    const functions = contract.functions;
    const byKey = new Map<string, FunctionDefinitionNode>();
    const byName = new Map<string, FunctionDefinitionNode[]>();
    for (const fn of functions) {
      byKey.set(`${fn.name}/${fn.parameters.length}`, fn);
      const overloads = byName.get(fn.name);
      if (overloads) overloads.push(fn);
      else byName.set(fn.name, [fn]);
    }
    // Inline state-variable initializers are lowered into the constructor, so its body must be scanned too.
    const addressTaken = this.addressTakenFunctions(
      [...functions.map((fn) => fn.body), contract.constructorDef?.body], byName,
    );
    const seen = new Set<FunctionDefinitionNode>();
    const queue: FunctionDefinitionNode[] = [root];
    while (queue.length > 0) {
      const fn = queue.shift()!;
      if (seen.has(fn) || !fn.body) continue;
      seen.add(fn);
      if (touchesCollection(fn)) return { via: fn.name };
      const bound = new Set(fn.parameters.map((parameter) => parameter.name));
      this.walk(fn.body, (child) => {
        if (child instanceof VariableDefinitionNode) bound.add(child.name);
      });
      this.walk(fn.body, (child) => {
        if (child instanceof IndirectCallNode) {
          queue.push(...addressTaken);
          return;
        }
        if (!(child instanceof FunctionCallNode)) return;
        const name = child.identifier.name;
        const exact = byKey.get(`${name}/${child.parameters.length}`);
        if (exact) queue.push(exact);
        else if (byName.has(name)) queue.push(...byName.get(name)!);
        else if (bound.has(name)) queue.push(...addressTaken);
      });
    }
    return {};
  }

  /** Contract functions whose name appears somewhere other than as a callsite's own callee identifier. */
  private addressTakenFunctions(
    bodies: Array<BlockNode | undefined>,
    byName: Map<string, FunctionDefinitionNode[]>,
  ): FunctionDefinitionNode[] {
    const callees = new Set<Node>();
    const referenced = new Set<string>();
    for (const body of bodies) {
      this.walk(body, (child) => {
        if (child instanceof FunctionCallNode) callees.add(child.identifier);
      });
    }
    for (const body of bodies) {
      this.walk(body, (child) => {
        if (child instanceof IdentifierNode && !callees.has(child) && byName.has(child.name)) {
          referenced.add(child.name);
        }
      });
    }
    return [...referenced].flatMap((name) => byName.get(name) ?? []);
  }

  private walk(value: unknown, visit: (node: Node) => void, seen = new Set<object>()): void {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    visit(value);
    for (const [key, child] of Object.entries(value)) {
      if (['resolvedFunction', 'definition', 'collection', 'stateVariable', 'symbolTable'].includes(key)) continue;
      if (child instanceof Node) this.walk(child, visit, seen);
      else if (Array.isArray(child)) for (const item of child) this.walk(item, visit, seen);
    }
  }

  private at<T extends Node>(node: T, source: Node): T {
    node.location = source.location;
    return node;
  }
}
