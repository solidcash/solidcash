import {
  BlockNode,
  BinaryOpNode,
  BoolLiteralNode,
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
  DeleteStateNode,
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
  MappingFieldAssignNode,
  Node,
  NullaryOpNode,
  ParameterNode,
  RequireNode,
  ReturnNode,
  SourceFileNode,
  StateAccessNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  StateArrayPopNode,
  StateArrayPushNode,
  StateAssignNode,
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
  kernelArgumentConditionActivation, kernelBooleanArgumentIndices, stableKernelArgumentIndices,
} from './KernelEntryActivation.js';
import {
  ArrayType, IntType, MappingType, type Type,
} from '@solidcash/utils';
import { throwKernelCatalogDiagnostic } from '../kernel-admission-catalog.js';

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
  /** Chunk-backed state arrays threaded through the same row invocation as the entry journals. */
  dynamicEntries: DynamicJournalEntry[];
  /** Source ABI results carried after the pending journal values in the helper's combined return tuple. */
  resultTypes: Type[];
}

interface DynamicJournalEntry {
  state: string;
  journalName: string;
  valueType: ArrayType;
  mutates: boolean;
}

interface ActiveDynamicCache {
  entry: DynamicJournalEntry;
  name: string;
  index: number;
  mutates: boolean;
}

/** Strip the compiler's synthetic batch-clone prefix so a diagnostic names the handler the user wrote. */
const sourceHandlerName = (name: string): string => name
  .replace(/^__message_bus_(?:resource|handler|dynamic|array|graph)_/, '')
  .replace(/_self_alias$/, '');

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
  /** Earlier physical caches whose runtime key tuple can identify the same entry. */
  runtimeAliases?: ActiveMultiCacheLocal[];
  /** Per-call value selected from `local` or one of `runtimeAliases`. */
  runtimeValueName?: string;
  /** Index of the physical cache which supplied `runtimeValueName`. */
  runtimeOwnerName?: string;
}

interface ActiveMultiCache {
  target: MultiCandidate;
  locals: ActiveMultiCacheLocal[];
  calls: WeakMap<FunctionCallNode, ActiveMultiCacheBinding[]>;
  /** Temps declared once beside the cache locals. A row-loop declaration would push again every iteration. */
  hoistedTemps?: Array<{ name: string; type: Type; initial?: ExpressionNode }>;
}

const COLLECTION_CACHE_LOADED_MASK = '__cj_cache_loaded_mask';
const COLLECTION_CACHE_DIRTY_MASK = '__cj_cache_dirty_mask';
const DYNAMIC_CACHE_DIRTY_MASK = '__dcj_cache_dirty_mask';

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
  /** One whole-array value per route, shared by every selected row touching that state array. */
  private activeDynamicCaches = new Map<string, ActiveDynamicCache>();
  /** Dynamic chunk-backed state arrays of the contract under rewrite (name set, for writer footprints). */
  private dynamicStateNames = new Set<string>();
  /** Function bodies by `name/arity`, for the transitive dynamic-write footprint below. */
  private functionByKey = new Map<string, FunctionDefinitionNode>();
  private dynamicFootprintCache = new Map<FunctionDefinitionNode, Set<string>>();
  /**
   * Dynamic states whose pooled cache is forbidden in the function currently being rewritten: some writer of
   * that array is NOT threaded through the journal, so a cache flush would write the pre-call value back over
   * the writer's own committed state.
   */
  private rewriteBlockedStates: Set<string> | undefined;
  /** Candidates a rewritten call site actually supplies the journal value to. A candidate no call site threads
   * must keep its direct signature: `resolveMulti` deliberately refuses to rewrite a call inside a body whose
   * array has an unthreaded writer, and unshifting the callee's parameter anyway leaves the two sides disagreeing
   * on the arity (`handler-route-generation-unsupported` with a parameter-list error in generated source). */
  private threadedSingles = new Set<Candidate>();
  private threadedMultis = new Set<MultiCandidate>();
  /** Route dispatchers load only selected-row caches; selected compiler handlers already own their resources. */
  private lazyMultiCaches = true;

  constructor(private readonly enablePooledDynamicArrays = false) { super(); }

  private journalAccessActivations(fn: FunctionDefinitionNode): ReadonlyMap<Node, ExternalCallExpression> {
    const activations = new Map<Node, ExternalCallExpression>();
    if (!this.enablePooledDynamicArrays || !fn.body) return activations;
    const argumentsByName = stableKernelArgumentIndices(fn);
    const booleanArguments = kernelBooleanArgumentIndices(fn);
    const combine = (outer: ExternalCallExpression | undefined, inner: ExternalCallExpression): ExternalCallExpression =>
      outer === undefined ? inner : { kind: 'binary', operator: '&&', left: outer, right: inner };
    const scan = (node: Node, activation?: ExternalCallExpression, representable = true): void => {
      if (node instanceof BranchNode) {
        const condition = kernelArgumentConditionActivation(node.condition, argumentsByName, booleanArguments);
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
    // Capture the route before generated cache loads/flushes are installed. A raw access already in this body
    // must never be mistaken for one of those authenticated accesses when discharging an occurrence guard.
    const rawCollections = (fn: FunctionDefinitionNode): Set<string> => {
      const names = new Set<string>();
      const locals = new Set(fn.parameters.map((parameter) => parameter.name));
      this.walk(fn.body, (child) => { if (child instanceof VariableDefinitionNode) locals.add(child.name); });
      this.walk(fn.body, (child) => {
        if (child instanceof MappingAccessNode || child instanceof MappingAssignNode
          || child instanceof MappingDeleteNode || child instanceof MappingFieldAssignNode) names.add(child.name);
        else if (child instanceof ArrayAccessNode && child.array instanceof IdentifierNode
          && !locals.has(child.array.name)) names.add(child.array.name);
        else if ((child instanceof ArrayAssignNode || child instanceof ArrayDeleteNode)
          && !locals.has(child.name)) names.add(child.name);
        // An unresolved function pointer can reach an unjournalled helper; no collection is proven pooled.
        else if (child instanceof IndirectCallNode) for (const name of collections.keys()) names.add(name);
      });
      return new Set([...names].filter((name) => collections.has(name)));
    };
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
    const routes = node.functions.filter((fn) => fn.messageBusRoute).map((fn) => ({
      fn, raw: rawCollections(fn), callees: callees(fn), pooled: new Set<FunctionDefinitionNode>(),
    }));
    const dynamicArrays = new Map(node.stateVariables.filter((state) =>
      state.isDynamic && state.type instanceof ArrayType)
      .map((state) => [state.name, state.type as ArrayType]));
    this.dynamicStateNames = new Set(dynamicArrays.keys());
    this.functionByKey = new Map(node.functions.map((fn) => [`${fn.name}/${fn.parameters.length}`, fn]));
    this.dynamicFootprintCache = new Map();
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
        // KERNEL_* admission catalog: fence-map item 9 — catalog-coded refuse (was plain Error without KERNEL_*).
        throwKernelCatalogDiagnostic(
          'KERNEL_LAYOUT',
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
      const statements = fn.body?.statements ?? [];
      const terminalReturn = statements[statements.length - 1];
      let returnCount = 0;
      this.walk(fn.body, (candidate) => { if (candidate instanceof ReturnNode) returnCount += 1; });
      // A compiler-owned pooled route clone may need two independent channels at its one physical exit: pending
      // collection values for the route journal, followed by the source ABI result for its authenticated row.
      // This is not specific to outgoing graph/effect handlers: a leaf getter sharing a route-wide collection
      // pool has exactly the same frame. Leaving that getter out of the journal strands its entry read inside the
      // OP_INVOKE body, where a decoded row expression allocates a second, unbound physical entry slot and returns
      // the collection default. Keep the admission deliberately structural: one top-level terminal return, no
      // early branch. `forceCollectionJournalPool` is compiler-owned and marks precisely these shared route frames.
      const pooledTerminalResult = !!(fn.graphEmissionHandler || fn.forceCollectionJournalPool)
        && fn.returnTypes.length > 0
        && terminalReturn instanceof ReturnNode && returnCount === 1
        && terminalReturn.expressions.length === fn.returnTypes.length;
      if (!fn.body || (fn.returnTypes.length !== 0 && !pooledTerminalResult)
        || !(fn.modifiers.includes(FunctionModifier.INTERNAL)
          || fn.modifiers.includes(FunctionModifier.PRIVATE))
        // Compiler-owned graph clones retain `inheritedFrom` so private storage access is checked in the source
        // declaration's scope. They are nevertheless concrete helpers owned by this route and must be journalled.
        || (fn.inheritedFrom && !fn.graphEmissionHandler && !fn.forceCollectionJournalPool)
        || constructorCalls.has(fn.name)
        || (nameCounts.get(fn.name) ?? 0) > 1) continue;
      // An ordinary journal helper must own its complete collection footprint. If it calls a separate
      // collection-touching helper, the later inline pass can pull that helper's physical accesses into this
      // OP_INVOKE body, adding direct-route resource witnesses after the call sites were journal-rewritten.
      // Compiler-owned pooled route clones have their own transitive resource accounting below.
      if (!fn.graphEmissionHandler && !fn.forceCollectionJournalPool
        && [...callees(fn)].some((callee) => callee !== fn && touchesCollection(callee))) continue;
      // X118. An event emitted inside a value-threaded OP_INVOKE handler is dropped at the subroutine exit, so
      // code generation refuses this shape outright. It compiles on the pre-existing inline path, so do not
      // select it: the journal is an optimisation, and taking it here costs the whole contract.
      let emitsEvent = false;
      this.walk(fn.body, (candidate) => {
        if (candidate instanceof EmitStatementNode) emitsEvent = true;
      });
      // A message-bus graph clone does not emit directly from the OP_INVOKE frame: code generation projects its
      // event into the authenticated route-owned effect frame. It can therefore share the value-threaded
      // collection-journal exit. Ordinary internal helpers still have no such projection and retain X118's gate.
      if (emitsEvent && !fn.graphEmissionHandler) continue;
      // A kernel counter-loop write owns its own trailing upsert journal.  It
      // must not prevent this helper from value-threading a separate fixed
      // entry read/write: e.g. `target[i] = source[0]` needs `source[0]` to
      // share the route-wide cache while `target[i]` remains on the runtime
      // row journal.  Entry slots are assigned by the preceding semantic pass
      // and are stable on the cloned body at this point.
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
      // A compiler-owned row clone can combine an independently indexed chunk-backed state array with its
      // fixed entry journal. A raw StateArrayAssign inside the OP_INVOKE body would re-open the persisted array
      // for every row, so row two observes the transaction pre-state and the final pending write no longer
      // matches the source-order execution. Thread the whole array value through the clone beside the entry
      // tuple instead. The wrapper installs one shared cache and flushes it once after the row loop.
      const dynamicNames = new Set<string>();
      if (this.enablePooledDynamicArrays && fn.forceCollectionJournalPool) {
        this.walk(fn.body, (candidate) => {
          if ((candidate instanceof StateAccessNode || candidate instanceof StateAssignNode
            || candidate instanceof DeleteStateNode
            || candidate instanceof StateArrayAssignNode || candidate instanceof StateArrayDeleteNode
            || candidate instanceof StateArrayPushNode || candidate instanceof StateArrayPopNode)
            && dynamicArrays.has(candidate.name)) dynamicNames.add(candidate.name);
          if (candidate instanceof MappingAccessNode && dynamicArrays.has(candidate.name)) {
            dynamicNames.add(candidate.name);
          }
        });
      }
      // The dynamic journal threads the whole array value, so it does not depend on the array's element key being
      // a parameter. A row clone whose only threadable state is such an array must still be admitted when its
      // FIXED entry accesses are not journalable (an unsupported shape, or no entry access at all): leaving it out
      // strands the array write inside the OP_INVOKE body, where every row re-opens the transaction pre-state and
      // the caller's pooled write-back republishes the value it seeded. The entry accesses then keep their existing
      // physical handling, exactly as they do when the function is not pooled.
      //
      // A non-parameter (expression) key is deliberately NOT covered: a loop-varying key is what the runtime
      // journal transport exists for, and claiming such a handler for this pooled journal would remove it from
      // that mechanism while leaving the entry write physical. Only a handler whose entry keys are all parameters
      // (so the entry leg is either journalable or unsupported as a whole) is admitted for the array alone.
      const dynamicOnlyAdmission = dynamicNames.size > 0 && fn.forceCollectionJournalPool === true;
      if ((unsupported || accesses.length === 0) && !dynamicOnlyAdmission) continue;
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
      // A rejected entry journal must not leave a partially built one behind: the dynamic-only admission threads
      // the array alone and keeps those accesses physical.
      if (unsupported || !stableKeys) distinct.clear();
      if ((unsupported || distinct.size === 0) && !dynamicOnlyAdmission) continue;
      const dynamicWrites = this.dynamicWriteFootprint(fn);
      const dynamicEntries: DynamicJournalEntry[] = [...dynamicNames].map((state, index) => ({
        state,
        journalName: `__dcj_${fn.name}_${index}`,
        valueType: dynamicArrays.get(state)!,
        mutates: dynamicWrites.has(state),
      }));
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
      if (hasEarlyReturn && !pooledTerminalResult) {
        throwKernelCatalogDiagnostic(
          'KERNEL_LAYOUT',
          `Collection journal helper '${sourceHandlerName(fn.name)}' cannot contain an early return; `
          + 'its journalled entry values are flushed only at the single function exit',
          {
            gate: 'journal-early-return',
            handler: sourceHandlerName(fn.name),
          },
        );
      }
      if (distinct.size > 1 || fn.forceCollectionJournalPool || pooledTerminalResult) {
        this.multiCandidates.set(`${fn.name}/${fn.parameters.length}`, {
          fn, entries: [...distinct.values()], dynamicEntries,
          resultTypes: pooledTerminalResult ? [...fn.returnTypes] : [],
        });
        continue;
      }
      const [entry] = distinct.values();
      const journalName = `__cj_${fn.name}`;
      this.candidates.set(`${fn.name}/${fn.parameters.length}`, {
        fn, collection: entry.collection, keyParameters: entry.keyParameters, journalName,
        valueType: entry.valueType,
      });
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_ROUTE === '1') {
      console.error('collection-journal-message-bus-candidates', JSON.stringify({
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
        graphFunctions: node.functions.filter((fn) => fn.graphEmissionHandler).map((fn) => fn.name),
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
      const route = routes.find((candidate) => candidate.fn === fn);
      if (route) route.pooled = new Set(this.activeMultiCaches.keys());
      // A pooled dynamic array may only be cached here when EVERY writer of that array in this body is threaded
      // through the journal tuple. A writer that is not (a call emitted directly, or a direct state write) keeps
      // its own frame authoritative, and the pooled flush after the row loop would write this body's PRE-call
      // value back over it - the row's committed write silently disappears while its own verification passes.
      this.rewriteBlockedStates = this.currentMulti ? undefined : this.unthreadedDynamicWriters(fn);
      this.activeDynamicCaches = this.currentMulti
        ? new Map()
        : this.prepareDynamicCaches(fn.body);
      this.lazyMultiCaches = !(fn.graphEmissionHandler || fn.forceCollectionJournalPool);
      fn.body = this.rewriteBlock(fn.body);
      // Dynamic chunks precede newly inserted entry outputs. Publish their selected pending values before the
      // entry flush computes that prefix, including when an untouched sibling's dirty guard is false.
      if (this.activeDynamicCaches.size > 0) this.installDynamicCaches(fn.body);
      if (this.activeMultiCaches.size > 0) this.installMultiCaches(fn.body);
    };
    // Callers first. A candidate's OWN body is rewritten in the same shape - its writes and reads are moved onto
    // the journal locals its unshifted parameter carries - but whether it is journaled at all is only known once
    // every call site has been visited (`threadedSingles`/`threadedMultis`). Rewriting a candidate body up front
    // therefore leaves journal symbols behind in a helper whose signature stays direct, which the type checker
    // reports as `Undefined reference to symbol __cj_/__dcj_...`: the same arity/symbol disagreement as unshifting
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
    this.rewriteBlockedStates = undefined;
    this.activeMultiCaches = new Map();
    this.activeDynamicCaches = new Map();
    this.lazyMultiCaches = true;

    // Turn each selected helper into a state-independent value handler. It is
    // now safe for normal OP_DEFINE/OP_INVOKE lowering.
    for (const candidate of this.candidates.values()) {
      // No call site supplies this helper's journal value (every caller was blocked), so it keeps its direct
      // signature and its own frame owns the write.
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
      const sourceReturn = candidate.resultTypes.length > 0
        ? candidate.fn.body!.statements!.pop() as ReturnNode : undefined;
      candidate.fn.parameters.unshift(
        ...candidate.dynamicEntries.map((entry) =>
          this.at(new ParameterNode(entry.valueType, entry.journalName, []), candidate.fn)),
        ...candidate.entries.map((entry) =>
          this.at(new ParameterNode(entry.valueType, entry.journalName, []), candidate.fn)));
      for (const parameter of candidate.fn.parameters) {
        // Graph handlers may use an ordinary argument again inside a conditional effect after the journal
        // assignment (OZ ERC20 `_approve`: assign `value`, then emit Approval(..., value)). The pre-lowering
        // liveness metadata describes the original mapping statement and can classify that assignment operand
        // as its last use; OP_ROLL then removes the declared argument from the OP_INVOKE frame and the later
        // conditional encoder reads an adjacent empty journal value. Keep the small declared handler frame
        // stable through its single exit, just as the entry-key parameters already are.
        if (candidate.fn.graphEmissionHandler || candidate.fn.forceCollectionJournalPool
          || candidate.entries.some((entry) => entry.keyParameters.includes(parameter.name))) {
          parameter.syntheticallyUsed = true;
        }
      }
      candidate.fn.returnTypes = [
        ...candidate.dynamicEntries.map((entry) => entry.valueType),
        ...candidate.entries.map((entry) => entry.valueType),
        ...candidate.resultTypes,
      ];
      candidate.fn.returnNames = [];
      const body = candidate.fn.body!;
      body.statements ??= [];
      body.statements.push(this.at(new ReturnNode([
        ...candidate.dynamicEntries.map((entry) =>
          this.at(new IdentifierNode(entry.journalName), candidate.fn)),
        ...candidate.entries.map((entry) => this.at(new IdentifierNode(entry.journalName), candidate.fn)),
        ...(sourceReturn?.expressions ?? []),
      ]), sourceReturn ?? candidate.fn));
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
    for (const route of routes) {
      // Every reachable helper must now be free of physical accesses to a discharged resource. This rejects
      // mixed pooled/unpooled readers as well as writers: a later read must observe the previous row's value.
      const unpooled = new Set(route.raw);
      const visited = new Set<FunctionDefinitionNode>();
      const inspect = (fn: FunctionDefinitionNode): void => {
        if (visited.has(fn)) return;
        visited.add(fn);
        for (const name of rawCollections(fn)) unpooled.add(name);
        for (const target of callees(fn)) inspect(target);
      };
      for (const target of route.callees) inspect(target);
      const discharged = new Set<string>();
      for (const source of node.functions) {
        const selector = source.messageBusKernelJournalDispositionSelectorHex;
        if (!source.isEntryPoint || source.messageBusFixedChunkableWriteMaxRows !== 1
          || !selector || !source.messageBusFixedChunkableResources?.length) continue;
        const resources = new Set(source.messageBusFixedChunkableResources.map((resource) => resource.collection));
        if ([...resources].some((name) => unpooled.has(name))) continue;
        const variants = [...route.callees].filter((fn) =>
          fn.messageBusKernelJournalDispositionSelectorHex === selector);
        if (variants.length === 0 || variants.some((fn) => {
          const candidate = [...this.threadedMultis].find((entry) => entry.fn === fn);
          return !route.pooled.has(fn) || !candidate || fn.collectionJournal !== true
            || [...resources].some((name) => !candidate.entries.some((entry) =>
              entry.collection === name && entry.mutates));
        })) continue;
        // Do not publish a capability unless this exact route contains its compiler-stamped guard.
        let guarded = false;
        this.walk(route.fn.body, (child) => {
          if (child instanceof RequireNode && child.messageBusFixedChunkableWriteGuard === selector) guarded = true;
        });
        if (!guarded) continue;
        source.messageBusPooledChunkableWrite = true;
        discharged.add(selector);
      }
      if (discharged.size === 0) continue;
      this.walk(route.fn.body, (child) => {
        if (!(child instanceof BlockNode)) return;
        child.statements = child.statements?.filter((statement) =>
          !discharged.has(statement.messageBusFixedChunkableWriteGuard ?? ''));
      });
      let remainingGuard = false;
      this.walk(route.fn.body, (child) => {
        if (child instanceof RequireNode && child.messageBusFixedChunkableWriteGuard) remainingGuard = true;
      });
      if (!remainingGuard) route.fn.body.statements = route.fn.body.statements?.filter((statement) =>
        !(statement instanceof VariableDefinitionNode && statement.name === '__message_bus_fixed_chunkable_write_count'));
    }
    return node;
  }

  private rewriteBlock(block: BlockNode): BlockNode {
    block.statements = (block.statements ?? []).flatMap((statement) => this.rewriteStatement(statement));
    return block;
  }

  /**
   * Resolve a journal candidate for a call. Candidates are registered by name AND arity, but arity MUTATES:
   * semantic analysis appends synthetic parameters after registration, and a compiler-generated message-bus
   * route writes some of those synthetics at the call site itself. The exact key then misses on both sides -
   * the callee keeps a leading `__cj_` parameter its call site never supplies. Fall back to the name when it
   * identifies exactly one candidate; an overloaded name keeps the strict arity match.
   */
  private resolveMulti(name: string, argumentCount: number): MultiCandidate | undefined {
    const resolved = this.resolveMultiCandidate(name, argumentCount);
    if (resolved === undefined) return undefined;
    // Inside a body whose array has an unthreaded writer, a journaled call must fall back to the direct form so
    // the callee's own frame owns the write (see `rewriteBlockedStates`).
    if (this.rewriteBlockedStates !== undefined
      && resolved.dynamicEntries.some((entry) => this.rewriteBlockedStates!.has(entry.state))) {
      return undefined;
    }
    return resolved;
  }

  private resolveMultiCandidate(name: string, argumentCount: number): MultiCandidate | undefined {
    const exact = this.multiCandidates.get(`${name}/${argumentCount}`);
    if (exact) return exact;
    // Only when the call carries MORE arguments than the registered arity: that is the "route wrote a synthetic
    // itself" case. A call with FEWER arguments is under-supplied for some other reason and must keep failing.
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
    if (statement instanceof AssignNode && statement.expression instanceof FunctionCallNode) {
      const target = this.resolveMulti(
        statement.expression.identifier.name, statement.expression.parameters.length,
      );
      if (target?.resultTypes.length === 1) {
        this.threadedMultis.add(target);
        return this.rewriteMultiResultCall(statement.expression, target, [{
          name: statement.identifier.name,
          type: target.resultTypes[0],
          existing: true,
        }]);
      }
    }
    if (statement instanceof TupleAssignmentNode && statement.tuple instanceof FunctionCallNode) {
      const target = this.resolveMulti(statement.tuple.identifier.name, statement.tuple.parameters.length);
      if (target && target.resultTypes.length === statement.elements.length) {
        this.threadedMultis.add(target);
        return this.rewriteMultiResultCall(statement.tuple, target, statement.elements);
      }
    }
    if (this.currentMulti && statement instanceof StateArrayAssignNode) {
      const entry = this.dynamicEntry(statement.name);
      if (entry) return this.at(new ArrayAssignNode(
        entry.journalName,
        this.rewriteExpression(statement.index),
        this.rewriteExpression(statement.value),
      ), statement);
    }
    if (this.currentMulti && statement instanceof StateArrayDeleteNode) {
      const entry = this.dynamicEntry(statement.name);
      if (entry) return this.at(new ArrayDeleteNode(
        entry.journalName, this.rewriteExpression(statement.index),
      ), statement);
    }
    if (this.currentMulti && statement instanceof StateArrayPushNode) {
      const entry = this.dynamicEntry(statement.name);
      if (entry) {
        const push = this.at(new ArrayPushNode(
          entry.journalName, this.rewriteExpression(statement.value),
        ), statement);
        push.noArg = statement.noArg;
        return push;
      }
    }
    if (this.currentMulti && statement instanceof StateArrayPopNode) {
      const entry = this.dynamicEntry(statement.name);
      if (entry) return this.at(new ArrayPopNode(entry.journalName), statement);
    }
    if (this.currentMulti && statement instanceof StateAssignNode) {
      const entry = this.dynamicEntry(statement.name);
      if (entry) return this.at(new AssignNode(
        this.at(new IdentifierNode(entry.journalName), statement),
        this.rewriteExpression(statement.expression),
      ), statement);
    }
    if (this.currentMulti && statement instanceof DeleteStateNode) {
      const entry = this.dynamicEntry(statement.name);
      if (entry) return this.at(new AssignNode(
        this.at(new IdentifierNode(entry.journalName), statement),
        createDefaultValueExpression(entry.valueType, statement.location),
      ), statement);
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
    // Kernel dispatch is a desugared `for` (`{ init; while { body; update } }`). Assignment-form
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
    const dynamic = this.dynamicEntry(node.name);
    if (dynamic) {
      let read: ExpressionNode = this.at(new IdentifierNode(dynamic.journalName), node);
      for (const key of node.keys) {
        read = this.at(new ArrayAccessNode(read, this.rewriteExpression(key)), node);
      }
      return read;
    }
    const multi = this.multiEntry(node.name, node.keys);
    if (multi) return this.at(new IdentifierNode(multi.journalName), node);
    if (this.current && node.name === this.current.collection) {
      return this.at(new IdentifierNode(this.current.journalName), node);
    }
    return super.visitMappingAccess(node);
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    // Solidity WITHOUT `this.` parses `arr[i]` as an ArrayAccessNode on the array-name identifier, while the
    // mapping form reaches visitMappingAccess. Both must resolve a POOLED dynamic state array (`S[] s` threaded
    // through a compiler-owned row clone) to its in-flight journal value: the write side already targets the
    // journal (a desugared StateArrayAssignNode), so without this branch a read of a field the same handler has
    // just written re-materializes the persisted pre-state array and diverges from the value the row publishes.
    if (node.array instanceof IdentifierNode) {
      const dynamic = this.dynamicEntry(node.array.name);
      if (dynamic) {
        return this.at(new ArrayAccessNode(
          this.at(new IdentifierNode(dynamic.journalName), node),
          this.rewriteExpression(node.index),
        ), node);
      }
    }
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
      return this.rewriteMultiCall(node.call, multiTarget)[0];
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

  visitStateAccess(node: StateAccessNode): Node {
    const dynamic = this.dynamicEntry(node.name);
    if (dynamic) return this.at(new IdentifierNode(dynamic.journalName), node);
    return super.visitStateAccess(node);
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

  private rewriteMultiCall(call: FunctionCallNode, target: MultiCandidate): StatementNode[] {
    if (target.resultTypes.length > 0) {
      throwKernelCatalogDiagnostic(
        'KERNEL_LAYOUT',
        `Result-producing collection journal '${target.fn.name}' requires an assignment target`,
        { gate: 'journal-result-assignment', handler: target.fn.name },
      );
    }
    return [this.rewriteMultiResultCall(call, target, [])];
  }

  private rewriteMultiResultCall(
    call: FunctionCallNode,
    target: MultiCandidate,
    resultElements: TupleAssignmentNode['elements'],
  ): StatementNode {
    const cache = this.activeMultiCaches.get(target.fn);
    if (!cache) {
      throwKernelCatalogDiagnostic(
        'KERNEL_INTERNAL_DEFECT',
        `Missing function-scoped collection journal for '${target.fn.name}'`,
        { gate: 'journal-function-scope-missing', handler: target.fn.name },
      );
    }
    const callLocals = cache.calls.get(call);
    if (!callLocals) {
      throwKernelCatalogDiagnostic(
        'KERNEL_INTERNAL_DEFECT',
        `Missing call-scoped collection journal for '${target.fn.name}'`,
        { gate: 'journal-call-scope-missing', handler: target.fn.name },
      );
    }
    const originalArgs = call.parameters.map((argument) => cloneNode(argument) as ExpressionNode);
    const dynamicLocals = target.dynamicEntries.map((entry) => {
      const dynamicCache = this.activeDynamicCaches.get(entry.state);
      if (!dynamicCache) {
        throwKernelCatalogDiagnostic(
          'KERNEL_INTERNAL_DEFECT',
          `Missing dynamic-state journal for '${target.fn.name}:${entry.state}'`,
          { gate: 'journal-dynamic-cache-missing', handler: target.fn.name, state: entry.state },
        );
      }
      return dynamicCache;
    });
    const invoked = this.at(new FunctionCallNode(
      this.at(new IdentifierNode(call.identifier.name), call),
      [
        ...dynamicLocals.map(({ name }) => this.at(new IdentifierNode(name), call)),
        ...callLocals.map(({ local, runtimeValueName }) =>
          this.at(new IdentifierNode(runtimeValueName ?? local.name), call)),
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
    const runtimeDeclarations: StatementNode[] = [];
    const runtimeSelections: StatementNode[] = [];
    for (const binding of callLocals) {
      const { runtimeAliases, runtimeOwnerName, runtimeValueName } = binding;
      if (!runtimeAliases?.length || !runtimeOwnerName || !runtimeValueName) continue;
      const linearArgument = binding.local.keyIdentity.some((identity) =>
        (target.fn.collectionJournalLinearKeyPools ?? []).some((pool) =>
          identity === `parameter:${pool.argumentName}`));
      const laneSelection = linearArgument && runtimeAliases.every((alias) =>
        alias.keyIdentity.every((identity) => identity.startsWith('parameter:__message_bus_key_')));
      if (laneSelection) {
        const laneCache = [...this.activeMultiCaches.values()].find((candidate) => candidate.calls.has(call));
        const temps = [
          { name: runtimeValueName, type: binding.entry.valueType },
          { name: runtimeOwnerName, type: new IntType(false, 256) },
        ];
        if (laneCache) {
          laneCache.hoistedTemps ??= [];
          laneCache.hoistedTemps.push(...temps);
        } else {
          for (const temp of temps) {
            runtimeDeclarations.push(this.at(new VariableDefinitionNode(
              temp.type, [], temp.name, createDefaultValueExpression(temp.type, call.location),
            ), call));
          }
        }
      } else {
        runtimeDeclarations.push(this.at(new VariableDefinitionNode(
          binding.entry.valueType, [], runtimeValueName,
          createDefaultValueExpression(binding.entry.valueType, call.location),
        ), call));
        runtimeDeclarations.push(this.at(new VariableDefinitionNode(
          new IntType(false, 256), [], runtimeOwnerName,
          this.at(new IntLiteralNode(BigInt(binding.local.index)), call),
        ), call));
      }
      // The decoded argument names the same entry as one lane. Loading it too would co-spend that entry.
      let selection = laneSelection
        ? this.at(new BlockNode([
          this.at(new RequireNode(this.at(new BoolLiteralNode(false), call)), call),
        ]), call)
        : this.at(new BlockNode([
          loadLocal(binding.local),
          this.at(new AssignNode(
            this.at(new IdentifierNode(runtimeValueName), call),
            this.at(new IdentifierNode(binding.local.name), call),
          ), call),
        ]), call);
      for (let index = runtimeAliases.length - 1; index >= 0; index--) {
        const alias = runtimeAliases[index];
        const matched: StatementNode[] = [
          this.at(new AssignNode(
            this.at(new IdentifierNode(runtimeValueName), call),
            this.at(new IdentifierNode(alias.name), call),
          ), call),
          this.at(new AssignNode(
            this.at(new IdentifierNode(runtimeOwnerName), call),
            this.at(new IntLiteralNode(BigInt(alias.index)), call),
          ), call),
        ];
        if (laneSelection) matched.unshift(loadLocal(alias));
        selection = this.at(new BlockNode([this.at(new BranchNode(
          this.runtimeAliasCondition(binding.local, alias, call, !laneSelection),
          this.at(new BlockNode(matched), call),
          selection,
        ), call)]), call);
      }
      runtimeSelections.push(...(selection.statements ?? []));
    }
    const ordinaryBindings = new Map<string, ActiveMultiCacheBinding[]>();
    for (const binding of callLocals) {
      if (binding.runtimeValueName) continue;
      const group = ordinaryBindings.get(binding.local.name) ?? [];
      group.push(binding);
      ordinaryBindings.set(binding.local.name, group);
    }
    const loads = this.lazyMultiCaches ? [...ordinaryBindings.values()].map((bindings): StatementNode => {
      const load = loadLocal(bindings[0].local);
      if (bindings.some((binding) => binding.entry.loadActivation === undefined)) return load;
      const guard = bindings.map((binding) => this.journalActivationAtCall(
        binding.entry.loadActivation!, originalArgs, call,
      )).reduce((left, right) => this.at(new BinaryOpNode(
        left, BinaryOperator.OR, right,
      ), call));
      return this.at(new BranchNode(guard, this.at(new BlockNode([load]), call)), call);
    }) : [];
    // A void pooled handler touching one entry still returns a single journal value, not a one-element tuple.
    let capture: StatementNode;
    if (dynamicLocals.length === 0 && callLocals.length === 1 && resultElements.length === 0) {
      capture = this.at(new AssignNode(
        this.at(new IdentifierNode(
          callLocals[0].runtimeValueName ?? callLocals[0].local.name,
        ), call), invoked,
      ), call);
    } else {
      capture = this.at(new TupleAssignmentNode(
        [
          ...dynamicLocals.map(({ entry, name }) => ({
            name, type: entry.valueType, existing: true,
          })),
          ...callLocals.map(({ entry, local, mutates, runtimeValueName }) => ({
            name: runtimeValueName ?? local.name, type: entry.valueType, existing: true,
            // A read-only helper returns the cache solely because every pooled helper shares one physical tuple
            // convention. Its value is provably unchanged, so discard that tuple field instead of rotating it
            // through the route's deep frame and writing it back to the same local. Writers still replace the
            // shared cache and are marked dirty below.
            skip: !mutates,
          })),
          ...resultElements,
        ],
        invoked,
        true,
      ), call);
    }
    const ordinaryDirtyBindings = new Map<string, ActiveMultiCacheBinding[]>();
    for (const binding of callLocals) {
      if (!binding.mutates || binding.runtimeValueName) continue;
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
    const runtimeDirties = callLocals.flatMap((binding): StatementNode[] => {
      if (!binding.mutates || !binding.runtimeValueName || !binding.runtimeOwnerName) return [];
      const owners = [...new Map([
        binding.local, ...(binding.runtimeAliases ?? []),
      ].map((local) => [local.index, local])).values()];
      return owners.map((owner) => {
        const ownerCondition = this.at(new BinaryOpNode(
          this.at(new IdentifierNode(binding.runtimeOwnerName!), call),
          BinaryOperator.EQ,
          this.at(new IntLiteralNode(BigInt(owner.index)), call),
        ), call);
        const condition = binding.entry.activation === undefined ? ownerCondition
          : this.at(new BinaryOpNode(
            this.journalActivationAtCall(binding.entry.activation, originalArgs, call),
            BinaryOperator.AND, ownerCondition,
          ), call);
        return this.at(new BranchNode(
          condition,
          this.at(new BlockNode([
            this.at(new AssignNode(
              this.at(new IdentifierNode(owner.name), call),
              this.at(new IdentifierNode(binding.runtimeValueName!), call),
            ), call),
            this.setCacheMaskBit(COLLECTION_CACHE_DIRTY_MASK, owner.index, call),
          ]), call),
        ), call);
      });
    });
    return this.at(new BlockNode([
      ...runtimeDeclarations, ...loads, ...runtimeSelections, capture,
      ...ordinaryDirties, ...runtimeDirties,
      ...target.dynamicEntries.filter(({ mutates }) => mutates).map(({ state }) =>
        this.setCacheMaskBit(DYNAMIC_CACHE_DIRTY_MASK, this.activeDynamicCaches.get(state)!.index, call)),
    ]), call);
  }

  private prepareMultiCaches(
    body: BlockNode,
    wrapperParameters: Set<string>,
  ): Map<FunctionDefinitionNode, ActiveMultiCache> {
    const caches = new Map<FunctionDefinitionNode, ActiveMultiCache>();
    // One physical entry gets one pending journal value per wrapper, however many different handlers touch it.
    // Keeping a pool per callee was enough while a route admitted a single handler; with several handlers over
    // one collection it allocated a separate cache local - and therefore a separate vmap slot - per handler for
    // the same entry, which the SDK reports as a duplicate upsert slot.
    const sharedLocals: ActiveMultiCache['locals'] = [];
    const calls: FunctionCallNode[] = [];
    const debugRoute = (globalThis as { process?: { env?: Record<string, string> } })
      .process?.env?.SOLIDC_DEBUG_ROUTE === '1';
    const debugCalls: Array<{
      target: string;
      runtimeAliases: boolean;
      bindings: Array<{ local: string; keys: string[]; aliases: string[] }>;
    }> = [];
    let runtimeAliasCallOrdinal = 0;
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
          throwKernelCatalogDiagnostic(
            'KERNEL_LAYOUT',
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
      const linearPools = target.fn.collectionJournalLinearKeyPools ?? [];
      if (linearPools.length > 0) {
        for (const entry of target.entries) {
          const keys = keysFor(entry);
          const keyName = keys.length === 1 && keys[0] instanceof IdentifierNode ? keys[0].name : undefined;
          const lanePrefix = `__message_bus_key_${entry.collection}_`;
          const pool = keyName === undefined ? undefined
            : linearPools.find((candidate) => candidate.argumentName === keyName
              && candidate.lanes.some((lane) => lane.startsWith(lanePrefix)));
          if (!pool) continue;
          for (const lane of pool.lanes) {
            const laneIdentity = `parameter:${lane}`;
            const existing = cache.locals.find((local) => local.entry.collection === entry.collection
              && local.keyIdentity.length === 1 && local.keyIdentity[0] === laneIdentity);
            if (existing) {
              existing.mutates ||= entry.mutates;
              continue;
            }
            cache.locals.push({
              entry,
              name: `__cj_cache_${sharedLocals.length}`,
              keys: [this.at(new IdentifierNode(lane), call)],
              keyIdentity: [laneIdentity],
              index: sharedLocals.length,
              mutates: entry.mutates,
            });
          }
        }
      }
      const earlierLocals = [...cache.locals];
      const runtimeAliasOrdinal = target.fn.collectionJournalRuntimeAliases
        ? runtimeAliasCallOrdinal++ : undefined;
      const callLocals = target.entries.map((entry, entryIndex): ActiveMultiCacheBinding => {
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
        const runtimeAliases = runtimeAliasOrdinal === undefined ? [] : earlierLocals.filter((candidate) =>
          candidate !== local
          && candidate.entry.collection === entry.collection
          && candidate.keys.length === keys.length);
        // A later writer can select an earlier cache which was introduced by a read-only handler. Promote that
        // physical cache to a possible writer so installMultiCaches reserves its dirty bit and conditional flush.
        if (entry.mutates) for (const alias of runtimeAliases) alias.mutates = true;
        return {
          entry,
          local,
          mutates: entry.mutates,
          ...(runtimeAliases.length > 0 && runtimeAliasOrdinal !== undefined ? {
            runtimeAliases,
            runtimeValueName: `__cj_runtime_value_${runtimeAliasOrdinal}_${entryIndex}`,
            runtimeOwnerName: `__cj_runtime_owner_${runtimeAliasOrdinal}_${entryIndex}`,
          } : {}),
        };
      });
      for (const binding of callLocals) {
        const lanes = binding.runtimeAliases ?? [];
        const laneBacked = lanes.length > 0 && lanes.every((alias) => alias.keyIdentity.every((identity) =>
          identity.startsWith('parameter:__message_bus_key_')));
        // A function-level flush cannot name the row-loop argument. Lane parameters own that write.
        if (laneBacked && binding.local.keyIdentity.some((identity) => identity.includes('__message_bus_arg_'))) {
          binding.local.mutates = false;
        }
      }
      cache.calls.set(call, callLocals);
      if (debugRoute) {
        debugCalls.push({
          target: target.fn.name,
          runtimeAliases: target.fn.collectionJournalRuntimeAliases === true,
          bindings: callLocals.map((binding) => ({
            local: binding.local.name,
            keys: binding.local.keyIdentity,
            aliases: (binding.runtimeAliases ?? []).map((alias) => alias.name),
          })),
        });
      }
    }
    if (debugRoute && caches.size > 0) {
      console.error('collection-journal-message-bus-pool', JSON.stringify({
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

  private prepareDynamicCaches(body: BlockNode): Map<string, ActiveDynamicCache> {
    const caches = new Map<string, ActiveDynamicCache>();
    this.walk(body, (node) => {
      if (!(node instanceof FunctionCallNode)) return;
      const target = this.resolveMulti(node.identifier.name, node.parameters.length);
      if (!target) return;
      for (const entry of target.dynamicEntries) {
        if (this.rewriteBlockedStates?.has(entry.state)) continue;
        const existing = caches.get(entry.state);
        if (existing) existing.mutates ||= entry.mutates;
        else caches.set(entry.state, {
          entry,
          name: `__dcj_cache_${entry.state}`,
          index: caches.size,
          mutates: entry.mutates,
        });
      }
    });
    return caches;
  }

  /** Every dynamic state array `fn` writes, following named internal calls (memoised, cycle-safe). */
  private dynamicWriteFootprint(
    fn: FunctionDefinitionNode, visiting = new Set<FunctionDefinitionNode>(),
  ): Set<string> {
    const cached = this.dynamicFootprintCache.get(fn);
    if (cached) return cached;
    const written = new Set<string>();
    if (visiting.has(fn)) return written;
    visiting.add(fn);
    this.walk(fn.body, (node) => {
      if ((node instanceof StateAssignNode || node instanceof DeleteStateNode
        || node instanceof StateArrayAssignNode || node instanceof StateArrayDeleteNode
        || node instanceof StateArrayPushNode || node instanceof StateArrayPopNode)
        && this.dynamicStateNames.has(node.name)) {
        written.add(node.name);
      }
      if (node instanceof FunctionCallNode) {
        const callee = this.functionByKey.get(`${node.identifier.name}/${node.parameters.length}`);
        if (!callee || callee === fn) return;
        for (const state of this.dynamicWriteFootprint(callee, visiting)) written.add(state);
      }
    });
    visiting.delete(fn);
    this.dynamicFootprintCache.set(fn, written);
    return written;
  }

  /**
   * Dynamic states written in `fn` by something the pooled journal does NOT thread: a direct state write, or a
   * call that is not a journal candidate for that array. `null`-free set: empty means every writer is threaded.
   */
  private unthreadedDynamicWriters(fn: FunctionDefinitionNode): Set<string> {
    const blocked = new Set<string>();
    this.walk(fn.body, (node) => {
      if ((node instanceof StateAssignNode || node instanceof DeleteStateNode
        || node instanceof StateArrayAssignNode || node instanceof StateArrayDeleteNode
        || node instanceof StateArrayPushNode || node instanceof StateArrayPopNode)
        && this.dynamicStateNames.has(node.name)) {
        blocked.add(node.name);
      }
      if (!(node instanceof FunctionCallNode)) return;
      const target = this.resolveMultiCandidate(node.identifier.name, node.parameters.length);
      const threaded = new Set((target?.dynamicEntries ?? []).map((entry) => entry.state));
      const callee = this.functionByKey.get(`${node.identifier.name}/${node.parameters.length}`);
      if (!callee) return;
      for (const state of this.dynamicWriteFootprint(callee)) {
        if (!threaded.has(state)) blocked.add(state);
      }
    });
    return blocked;
  }

  private installDynamicCaches(body: BlockNode): void {
    const caches = [...this.activeDynamicCaches.values()];
    if (caches.length === 0) return;
    const declarations = caches.map(({ entry, name }) => this.at(new VariableDefinitionNode(
      entry.valueType, [], name, this.at(new StateAccessNode(entry.state), body),
    ), body));
    const writable = caches.filter(({ mutates }) => mutates);
    const dirtyWords = Math.ceil((Math.max(-1, ...writable.map(({ index }) => index)) + 1) / 256);
    for (let word = 0; word < dirtyWords; word += 1) {
      declarations.push(this.at(new VariableDefinitionNode(
        new IntType(false, 256), [], `${DYNAMIC_CACHE_DIRTY_MASK}_${word}`,
        this.at(new IntLiteralNode(0n), body),
      ), body));
    }
    // Decoding an uninitialized variable-width array canonicalizes its zero-byte storage to a one-byte empty
    // array. An unselected sibling must not flush that representation as a write. Like entry caches, dynamic
    // caches become dirty only when a mutating helper actually runs; read-only helpers never authorize a flush.
    const writes = writable.map(({ entry, name, index }) => this.at(new BranchNode(
      this.cacheMaskIsSet(DYNAMIC_CACHE_DIRTY_MASK, index, body),
      this.at(new BlockNode([this.at(new StateAssignNode(
        entry.state, this.at(new IdentifierNode(name), body),
      ), body)]), body),
    ), body));
    const statements = body.statements ?? [];
    // A compiler-owned caller ends with a terminal `return` (a route hands its results blob back). Appending the
    // write-back after it makes the whole flush unreachable: the value the callee threaded back is discarded and
    // the caller republishes the value the cache was seeded with - for a chunk-backed resource a contradictory
    // pin on the same chunk run, since the callee's own write is what the program ends up committing. Mirror the
    // entry-journal flush: lift the terminal return out, flush before it and before any nested exit, and
    // re-append it last so the later all-paths-return analysis still sees one top-level exit.
    const tailReturn = statements.length > 0 && statements[statements.length - 1] instanceof ReturnNode
      ? statements.pop()! as ReturnNode
      : undefined;
    body.accept(new FlushCollectionCachesBeforeReturns(writes));
    const rewritten = body.statements ?? [];
    const tail: StatementNode[] = [];
    if (!tailReturn && rewritten.length > 0 && rewritten[rewritten.length - 1] instanceof RequireNode) {
      tail.unshift(rewritten.pop()!);
    }
    body.statements = [...declarations, ...rewritten, ...writes, ...(tailReturn ? [tailReturn] : tail)];
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
    if (key instanceof IdentifierNode && (wrapperParameters.has(key.name)
      || key.name.startsWith('__message_bus_key_')
      || key.name.startsWith('__message_bus_arg_'))) {
      // Kernel row-decoded arguments are wrapper locals (`__message_bus_arg_*`), not formal parameters.
      // They are still one identity per physical entry of this invocation.
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
    // write-backs. Values are loaded lazily at the rewritten call site: a compiler-authored route contains every
    // possible handler, but only the selected row has a physical entry resource. Loading every cache at function
    // entry made an untaken handler validate a dummy slot (and writing every cache created phantom upserts).
    const pooled = [...new Set([...this.activeMultiCaches.values()].flatMap((cache) => cache.locals))];
    const caches = [{ locals: pooled }];
    const hoistedTemps = [...this.activeMultiCaches.values()].flatMap((cache) =>
      (cache.hoistedTemps ?? []).map(({ name, type, initial }) => this.at(new VariableDefinitionNode(
        type, [], name, initial ?? createDefaultValueExpression(type, body.location),
      ), body)));
    const declarations = caches.flatMap((cache) => cache.locals.map(({ entry, name, keys }) => {
      let initial: ExpressionNode;
      if (this.lazyMultiCaches) {
        initial = createDefaultValueExpression(entry.valueType, body.location);
      } else {
        const read = this.at(new MappingAccessNode(entry.collection, keys.map((key) =>
          cloneNode(key) as ExpressionNode)), body);
        read.fromModifier = entry.sourceScope;
        initial = read;
      }
      return this.at(new VariableDefinitionNode(entry.valueType, [], name, initial), body);
    }));
    if (this.lazyMultiCaches && pooled.length > 0) {
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
      ...hoistedTemps, ...declarations, ...rewritten, ...writes, ...(tailReturn ? [tailReturn] : tail),
    ];
  }

  private cacheMaskBit(index: number, source: Node): IntLiteralNode {
    return this.at(new IntLiteralNode(1n << BigInt(index % 256)), source);
  }

  private runtimeAliasCondition(
    current: ActiveMultiCacheLocal,
    candidate: ActiveMultiCacheLocal,
    source: Node,
    requireLoaded = true,
  ): ExpressionNode {
    const keyEquality = current.keys.map((key, index) => this.at(new BinaryOpNode(
      cloneNode(key) as ExpressionNode,
      BinaryOperator.EQ,
      cloneNode(candidate.keys[index]) as ExpressionNode,
    ), source)).reduce((combined, equality) => this.at(new BinaryOpNode(
      combined,
      BinaryOperator.AND,
      equality,
    ), source));
    if (!requireLoaded) return keyEquality;
    return this.at(new BinaryOpNode(
      this.cacheMaskIsSet(COLLECTION_CACHE_LOADED_MASK, candidate.index, source),
      BinaryOperator.AND,
      keyEquality,
    ), source);
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

  private dynamicEntry(state: string): DynamicJournalEntry | undefined {
    return this.currentMulti?.dynamicEntries.find((entry) => entry.state === state);
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
