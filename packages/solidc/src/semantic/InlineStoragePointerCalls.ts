import {
  ContractNode,
  FunctionDefinitionNode,
  FunctionModifier,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  FunctionCallStatementNode,
  VariableDefinitionNode,
  IdentifierNode,
  FieldAccessNode,
  IntLiteralNode,
  ExpressionNode,
  BranchNode,
  WhileNode,
  DoWhileNode,
  UncheckedNode,
  MappingAccessNode,
  ArrayAccessNode,
  TupleIndexOpNode,
  AssignNode,
  StateAssignNode,
  StateAccessNode,
  DeleteStateNode,
  MappingAssignNode,
  MappingDeleteNode,
  ArrayAssignNode,
  StateArrayPushNode,
  StateArrayPopNode,
  StateArrayAssignNode,
  StateArrayDeleteNode,
  MappingFieldAssignNode,
  TupleAssignmentNode,
  ReturnNode,
  FunctionCallNode,
  ExternalFunctionCallNode,
  ConsoleStatementNode,
  EmitStatementNode,
  TokenContainerMethodStatementNode,
  TransferStatementNode,
  AddressTransferStatementNode,
  AddressSendExpressionNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  MethodCallNode,
  InstantiationNode,
  NullaryOpNode,
  BoolLiteralNode,
  UnaryOpNode,
  SwitchNode,
  TryCatchNode,
} from '../ast/AST.js';
import { NullaryOperator, UnaryOperator } from '../ast/Operator.js';
import { StructType, MappingType, ArrayType, PrimitiveType } from '@solidcash/utils';
import { tagModifierStateAccess } from './ModifierExpansionTransformation.js';
import { normalizeVoidInlineReturns } from './EarlyReturnTransformation.js';
import { Modifier } from '../ast/Globals.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { substituteInFunction } from './InheritanceExpansionTransformation.js';
import { collectAmbiguousInlineKeys, inlineKey } from './inlineOverloadGuard.js';
import { AmbiguousInlineOverloadError } from '../Errors.js';
import {
  pointerRootName,
  rewriteStoragePointerLength,
  rewriteStoragePointerNode,
  storagePointerTargets,
  type StoragePointerBinding,
  type StoragePointerTargets,
} from './storagePointerBinding.js';
import { readsMessageField } from './selfMessageCall.js';
import { checksTransactionSignature, namesCalledFrom } from './transactionSignatureCheck.js';

/**
 * Inlines internal calls to void functions that take `storage` reference parameters
 * (`mapping(...) storage`, `T[] storage`, `StructType storage`). In Solidity a storage parameter is a
 * compile-time reference to the caller's state, not a value; it has no on-stack representation, so the
 * callee cannot compile as an OP_INVOKE subroutine. Inlining at the call site, with each storage
 * parameter substituted by its argument's access path, reduces it to direct state access in the caller.
 *
 * ```
 * function f() public { _set(map, k, v); }
 * function _set(mapping(address => uint) storage m, address k, uint v) internal { m[k] = v; }
 * ->
 * function f() public { address __sp0_k = k; uint __sp0_v = v; map[__sp0_k] = __sp0_v; }
 * ```
 *
 * Runs before semantic analysis so the substituted accesses collect entry slots normally. Value
 * parameters and locals are alpha-renamed per call site; storage parameters are substituted. The
 * original storage-parameter function is removed (it cannot stand alone as a subroutine).
 *
 * ALSO inlines void internal/private functions that READ a state entry (a mapping/collection element, incl.
 * the read half of a compound write `m[k] += v`). Entry-access input slots live only in an entry-point's
 * block layout, so such a function cannot compile as an OP_INVOKE subroutine ("Block layout not available");
 * inlining moves the read into the entry-point caller's layout. This is what makes a Solidity `_mint`-style
 * private helper that touches a mapping work.
 */
const PREFIX = '__sp';

const RETURN_WALK_SKIP = new Set([
  'location', 'type', 'symbolTable', 'definition', 'resolvedFunction', 'functionReference', 'collection',
  'stateVariable',
]);

/**
 * Whether a statement holds a return that leaves the inlined helper: a source `return;`. A Yul `return` ends the
 * whole call frame, so it is not counted, except in a helper called as a frame of its own (`this.f()`), all it ends.
 */
function containsSourceReturn(node: Node | undefined, frame = false): boolean {
  if (!node) return false;
  if (node instanceof ReturnNode) return frame || !node.isYulReturn;
  for (const [key, value] of Object.entries(node)) {
    if (RETURN_WALK_SKIP.has(key)) continue;
    if (value instanceof Node && containsSourceReturn(value, frame)) return true;
    if (Array.isArray(value) && value.some((item) => item instanceof Node && containsSourceReturn(item, frame))) {
      return true;
    }
  }
  return false;
}

export default class InlineStoragePointerCalls extends AstTraversal {
  constructor(
    private readonly inlineSolidityInitializers = false,
    private readonly inlineDelegateStateHelpers = false,
    private readonly keepSelfMessageCalls = false,
    // Keep transaction-signature checks in the entry point (see inlinesSignatureChecks).
    private readonly inlineSignatureChecks = false,
  ) { super(); }

  private funcByName: Map<string, FunctionDefinitionNode> = new Map();
  // Overload-aware callee lookup keyed by inlineKey(name, arity): a name-only map returns the wrong overload for a
  // call whose arity differs (OZ ERC20 `_approve/3` -> `_approve/4`), so the arity-mismatched call is never inlined
  // yet the callee is still dropped by name -> "Undefined reference to symbol _approve".
  private funcByKey: Map<string, FunctionDefinitionNode> = new Map();
  // H8: <name>/<arity> keys that more than one overload shares - inlining one by that key is ambiguous.
  private ambiguousInlineKeys: Set<string> = new Set();
  private inlinedFns: Set<string> = new Set();
  private collectionNames: Set<string> = new Set();
  // Container kinds of the contract being inlined into, for rewriting a bound storage pointer's pushes, pops and
  // `.length` onto the caller's array.
  private pointerTargets?: StoragePointerTargets;
  private mappingNames: Set<string> = new Set();
  private sortedCollectionNames: Set<string> = new Set();
  private transitiveSortedWriters: Set<string> = new Set();
  private stateVarNames: Set<string> = new Set();
  private keepDefFns: Set<string> = new Set();
  private constructorCalledFns: Set<string> = new Set();
  private journalEffectFns: Set<string> = new Set();
  private freeFns: FunctionDefinitionNode[] = [];
  private counter = 0;
  // Value-returning functions with a single `return <expr>` body and a storage-pointer param: inlined in
  // EXPRESSION position (they have no standalone value representation). exprStack guards against recursion.
  private exprInlinableFns: Map<string, FunctionDefinitionNode> = new Map();
  // Ambiguity among the expression-inlinable subset only. A same-arity overload with no reducible single-return
  // body cannot be selected by this path and therefore must not make the one eligible overload ambiguous.
  private exprAmbiguousInlineKeys: Set<string> = new Set();
  private exprStack: string[] = [];
  private bodyNodes = new WeakMap<FunctionDefinitionNode, Node[]>();

  visitSourceFile(node: SourceFileNode): Node {
    this.freeFns = node.freeFunctions ?? [];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    // A struct-storage-pointer library fn is inlined at every call site and cannot stand alone (its `map__field`
    // accesses are dangling until renamed to the caller's `<arg>__field`), so drop the inlined ones.
    node.freeFunctions = (node.freeFunctions ?? []).filter((f) => !this.inlinedFns.has(f.name));
    // A `using Lib for T` directive whose library functions were ALL inlined-and-dropped is vestigial (its method
    // calls were desugared to `Lib.f(recv, ..)` then inlined). Drop it so the using-for check does not fail on the
    // now-empty library, but only when the library was actually inlined (a genuinely-undefined library must still
    // raise its error). Filter the CONTRACT node's copy, which the check reads.
    if (node.contract?.usingForDirectives?.length) {
      const remaining = [...node.freeFunctions, ...node.contract.functions].map((f) => f.name);
      const inlined = [...this.inlinedFns];
      node.contract.usingForDirectives = node.contract.usingForDirectives.filter((d) => {
        if (!d.libraryName) return true;
        const prefix = `${d.libraryName}.`;
        const stillHas = remaining.some((nm) => nm.startsWith(prefix));
        const wasInlined = inlined.some((nm) => nm.startsWith(prefix));
        return stillHas || !wasInlined;
      });
    }
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.bodyNodes = new WeakMap();
    this.funcByName = new Map();
    this.funcByKey = new Map();
    for (const fn of [...node.functions, ...this.freeFns]) {
      this.funcByName.set(fn.name, fn);
      this.funcByKey.set(inlineKey(fn.name, fn.parameters.length), fn);
    }
    this.ambiguousInlineKeys = collectAmbiguousInlineKeys([...node.functions, ...this.freeFns]);
    this.collectionNames = new Set(node.collections.map((c) => c.name));
    this.pointerTargets = storagePointerTargets(node);
    // Mapping (not array) collections: an element write-back for a struct storage-pointer bound to `m[k]` is a
    // MappingAssign, but an array element `arr[i]` is a StateArrayAssign - keep them apart so neither gets the
    // other's node (an array accessed as `arr[i]` parses to a MappingAccessNode too).
    this.mappingNames = new Set(node.collections.filter((c) => c.type instanceof MappingType).map((c) => c.name));
    // vmap (sorted) collections: a WRITE to one co-spends the sorted-list entry slots (block layout), like a read,
    // so a void helper writing a sorted mapping must also inline (a plain-entry-model write works as a subroutine).
    this.sortedCollectionNames = new Set(node.collections.filter((c) => c.sorted).map((c) => c.name));
    const allFns = [...node.functions, ...(node.fallbackDef ? [node.fallbackDef] : [])];
    this.transitiveSortedWriters = this.computeTransitiveSortedWriters(allFns);
    this.stateVarNames = new Set(node.stateVariables.map((sv) => sv.name));
    this.constructorCalledFns = new Set();
    if (node.constructorDef?.body) {
      for (const candidate of this.nodesOf(node.constructorDef)) {
        if (candidate instanceof FunctionCallNode) this.constructorCalledFns.add(candidate.identifier.name);
      }
    }
    // Effect metadata is populated after this pass. Build the equivalent pre-semantic call-graph closure so a
    // scalar writer which deploys/calls externally through an internal helper stays on the established inline
    // path rather than becoming an OP_INVOKE journal with missing physical effect context.
    this.journalEffectFns = new Set();
    const directEffect = (fn: FunctionDefinitionNode): boolean => {
      if (!fn.body) return false;
      for (const candidate of this.nodesOf(fn)) {
        if (candidate instanceof InstantiationNode || candidate instanceof MethodCallNode
          || candidate instanceof LowLevelCallNode || candidate instanceof LowLevelCallStatementNode) return true;
        else if (candidate instanceof FunctionCallNode) {
          const name = candidate.identifier.name;
          const dot = name.lastIndexOf('.');
          if (dot > 0 && !name.startsWith('super.') && !this.funcByName.has(name)) return true;
        }
      }
      return false;
    };
    for (const fn of node.functions) if (fn.body && directEffect(fn)) this.journalEffectFns.add(fn.name);
    let effectClosureChanged = true;
    while (effectClosureChanged) {
      effectClosureChanged = false;
      for (const fn of node.functions) {
        if (!fn.body || this.journalEffectFns.has(fn.name)) continue;
        let reachesEffect = false;
        for (const candidate of this.nodesOf(fn)) {
          if (candidate instanceof FunctionCallNode
            && this.journalEffectFns.has(candidate.identifier.name)) reachesEffect = true;
        }
        if (reachesEffect) {
          this.journalEffectFns.add(fn.name);
          effectClosureChanged = true;
        }
      }
    }

    this.inlinedFns = new Set();
    this.keepDefFns = new Set();
    // A function used as a VALUE (function pointer arg / stored pointer) must keep its definition and is
    // not safely droppable-after-inline; exclude such names from the state-touching criteria.
    const valueReferenced = this.collectValueReferencedNames(node);
    // A transaction-signature check covers the body it runs in, and the SDK signs over the entry point's. So a helper
    // that checks one inlines into its callers, as does an entry point another body calls by name. A DELEGATE
    // library entry does not: it runs from the library's own co-spent input.
    const calledByName = this.inlineSignatureChecks
      ? namesCalledFrom([...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef, ...this.freeFns])
      : new Set<string>();
    const checksSignature = (fn: FunctionDefinitionNode): boolean => this.inlineSignatureChecks
      && !fn.modifiers.includes(FunctionModifier.DELEGATE) && checksTransactionSignature(fn, this.funcByName);
    for (const fn of node.functions) {
      // Compiler-owned graph and detached-signature handlers are physical OP_INVOKE bodies. Their hidden
      // protocol context belongs to that invocation, so no storage/effect shape may flatten them into the route.
      if (fn.graphEmissionHandler || fn.messageBusDetachedSignatureHandler) continue;
      // Any state access disqualifies an OP_INVOKE subroutine: entry reads need block-layout slots, and
      // scalar reads/writes live in the ENTRY traversal's commitment model (a subroutine's are invisible
      // to it). Inline all state-touching void callees; entry points keep their definition (still
      // dispatchable), internal helpers are dropped below.
      // A scalar-state helper normally has enough context to remain an OP_INVOKE subroutine: both it and its
      // caller address state relative to the active covenant input. A delegate build is different. Its entry
      // points address the co-spent proxy block, while an ordinary internal helper would address the
      // implementation's own block. Keep those reads/writes in the delegate entry traversal so they inherit the
      // authenticated proxy-master basis. This also covers modifier wrappers such as
      // `entry -> _checkOwner -> owner()` after the returning getter has been reduced into `_checkOwner`.
      const scalarJournalEligible = !this.inlineDelegateStateHelpers && this.isScalarJournalEligible(fn);
      // OZ `_checkInitializing` / `_checkOwner` often still look context-only after the first IRSH
      // (ERC-7201 `$._initializing` / `owner()`). A later IRSH exposes the read, but a message-bus
      // compile can leave the wrapper as OP_INVOKE. Force those guards into the delegate entry so
      // they inherit proxy-master + pending writes instead of INPUTINDEX+1 on the impl.
      const delegateGuard = this.inlineDelegateStateHelpers
        && /^(?:_checkInitializing|_checkOwner|_requireNotPaused)$/.test(fn.name);
      // CashToken-container transfers are transaction effects rather than
      // value-like state: their authenticated input/output slots and transfer
      // occurrence indices belong to the physical entry point. Until an
      // independently verified effect journal exists, inline these helpers so
      // every operation remains visible to the ordinary sequential covenant
      // pre-scan. This is Release 3's sound, non-aggregating token path.
      const hasTokenContainerEffects = this.hasTokenContainerEffects(fn);
      const hasPhysicalEffects = this.hasPhysicalEffects(fn);
      // An assembly return halts the whole call. Inlined, it is the caller's return, as on the EVM; a subroutine
      // would only return from it, so a call left to one is refused (refuseHaltingCalls).
      const halts = this.holdsAssemblyReturn(fn);
      if (fn.body && fn.returnTypes.length === 0
        && (this.hasStoragePointerParam(fn)
          || delegateGuard
          || (this.isInternalHelper(fn) && !valueReferenced.has(fn.name)
            && (this.readsEntry(fn) || (this.touchesScalarState(fn) && !scalarJournalEligible)
              || hasTokenContainerEffects
              || hasPhysicalEffects
              || halts
              || this.transitiveSortedWriters.has(fn.name)
              || checksSignature(fn)
              || (this.inlineSolidityInitializers && /^__.*_init(?:_unchained)?$/.test(fn.name)))))) {
        this.inlinedFns.add(fn.name);
      } else if (fn.body && fn.returnTypes.length === 0 && !this.isInternalHelper(fn)
        && !valueReferenced.has(fn.name)
        && (this.readsEntry(fn) || (this.touchesScalarState(fn) && !scalarJournalEligible)
          || hasPhysicalEffects
          || halts
          || this.transitiveSortedWriters.has(fn.name)
          || (calledByName.has(fn.name) && checksSignature(fn)))) {
        this.inlinedFns.add(fn.name);
        this.keepDefFns.add(fn.name);
      }
    }
    // Modifier/base wrappers can become stateful only after their selected callees are inlined. Close over the
    // actual inlining set (rather than only direct AST state access), so `override onlyOwner {
    // super.transferOwnership(n); }` cannot leave a context-dependent preserved base body behind as OP_INVOKE.
    let addedWrapper = true;
    while (addedWrapper) {
      addedWrapper = false;
      for (const fn of node.functions) {
        if (!fn.body || fn.returnTypes.length > 0 || this.inlinedFns.has(fn.name)
          || fn.graphEmissionHandler || fn.messageBusDetachedSignatureHandler
          || valueReferenced.has(fn.name)) continue;
        let callsSelected = false;
        for (const candidate of this.nodesOf(fn)) {
          if (candidate instanceof FunctionCallNode && this.inlinedFns.has(candidate.identifier.name)) {
            callsSelected = true;
          }
        }
        if (!callsSelected) continue;
        this.inlinedFns.add(fn.name);
        if (!this.isInternalHelper(fn)) this.keepDefFns.add(fn.name);
        addedWrapper = true;
      }
    }
    // The fallback is internally callable via the self low-level-call lowering; a state-touching one must
    // inline at those call sites (its definition always stays - it is a dispatched entry point).
    if (node.fallbackDef?.body && node.fallbackDef.returnTypes.length === 0
      && (this.readsEntry(node.fallbackDef) || this.touchesScalarState(node.fallbackDef)
        || this.transitiveSortedWriters.has(node.fallbackDef.name))) {
      this.funcByName.set(node.fallbackDef.name, node.fallbackDef);
      this.funcByKey.set(inlineKey(node.fallbackDef.name, node.fallbackDef.parameters.length), node.fallbackDef);
      this.inlinedFns.add(node.fallbackDef.name);
      this.keepDefFns.add(node.fallbackDef.name);
    }
    // Library free-functions (`Lib.fn`) taking any storage pointer must inline too. A mapping/array pointer has
    // no standalone stack representation any more than a struct pointer does; leaving a void `L.set(mapping
    // storage, ...)` body behind makes its `table[k]` look like an ordinary local ArrayAssign and loses the
    // declared mapping key type. The substitution below already routes mapping writes to the caller collection.
    // Physical effects inline an internal helper (`Address.sendValue`). A DELEGATE library entry is never inlined
    // here: it runs from the library's own co-spent input, its calls lower to delegatecalls, and inlining it copies a
    // split facet into its master.
    for (const fn of this.freeFns) {
      // A deployed delegate library has its own input and covenant frame. Its public functions are not
      // storage-pointer helpers in the consumer: SynthesizeLibraryDelegateCalls must lower their calls to
      // co-spent delegatecalls, including when their bodies emit events or touch collections.
      if (fn.modifiers.includes(FunctionModifier.DELEGATE)) continue;
      if (fn.body && fn.returnTypes.length === 0 && (this.hasStoragePointerParam(fn) || this.hasPhysicalEffects(fn)
        || this.holdsAssemblyReturn(fn) || checksSignature(fn))) {
        this.inlinedFns.add(fn.name);
      }
    }
    // Value-returning single-`return` storage-pointer functions (contract or library, e.g. a `using L for
    // mapping` helper `at(mapping storage a, uint i) returns (uint) { return a[i]; }`) are inlined in expression
    // position: the call is replaced by the substituted return expression (`m.at(k)` -> `L.at(m, k)` -> `m[k]`).
    this.exprInlinableFns = new Map();
    const exprEligible: FunctionDefinitionNode[] = [];
    for (const fn of [...node.functions, ...this.freeFns]) {
      if (fn.graphEmissionHandler || fn.messageBusDetachedSignatureHandler) continue;
      if (this.isSingleReturnStoragePointerFn(fn)) this.exprInlinableFns.set(fn.name, fn);
      if (this.isSingleReturnStoragePointerFn(fn)) exprEligible.push(fn);
    }
    this.exprAmbiguousInlineKeys = collectAmbiguousInlineKeys(exprEligible);
    if (this.inlinedFns.size === 0 && this.exprInlinableFns.size === 0) return node;

    // Inline calls in every function body AND the constructor/fallback/receive - a constructor calling an
    // inherited `_mint`-style entry-reading helper is the common ERC20 pattern, and the helper is dropped below.
    // Free functions take the same substitution: one helper calling another (`post()` calling a helper with a
    // child deployment) leaves a dangling name when the callee is dropped as inlined but only contract bodies
    // were rewritten.
    for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef, ...this.freeFns]) {
      if (fn?.body) {
        fn.body.statements = this.inlineStatements(fn.body.statements ?? [], [inlineKey(fn.name, fn.parameters.length)]);
      }
    }
    // Expression-position inlining of value-returning storage-pointer calls (after the void statement inlining;
    // the two function sets are disjoint - void vs value-returning). Traverse via the visitor so a call in any
    // expression slot (`return f(..)`, `x = f(..)`, `f(..)[k]`) is replaced.
    if (this.exprInlinableFns.size > 0) {
      for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef, ...this.freeFns]) {
        if (fn?.body) { this.exprStack = []; fn.body = this.visit(fn.body) as BlockNode; }
      }
      for (const name of this.exprInlinableFns.keys()) this.inlinedFns.add(name);
    }
    // A storage parameter has no value representation, and a subroutine cannot read a state entry (the
    // entry-access input slots live only in an entry-point's block layout); so the original cannot stand
    // alone as a subroutine. Every call was inlined above, so drop it - except entry points (keepDefFns),
    // which stay dispatchable.
    node.functions = node.functions.filter((fn) => !this.inlinedFns.has(fn.name) || this.keepDefFns.has(fn.name));
    return node;
  }

  private isScalarJournalEligible(fn: FunctionDefinitionNode): boolean {
    if (!fn.body || fn.returnTypes.length > 0 || this.hasStoragePointerParam(fn) || this.readsEntry(fn)
      || this.transitiveSortedWriters.has(fn.name) || this.constructorCalledFns.has(fn.name)
      || this.journalEffectFns.has(fn.name)) return false;
    if ((fn.externalCalls?.length ?? 0) > 0 || (fn.externalReads?.length ?? 0) > 0
      || (fn.externalOutStateReads?.length ?? 0) > 0 || (fn.lowLevelCalls?.length ?? 0) > 0
      || (fn.emitInfos?.length ?? 0) > 0 || (fn.transferInfos?.length ?? 0) > 0
      || (fn.tokenContainerAccesses?.length ?? 0) > 0 || (fn.deployTargets?.length ?? 0) > 0) return false;
    let unsupported = false;
    for (const candidate of this.nodesOf(fn)) {
      const maybeState = candidate as Node & { stateVariable?: { isDynamic?: boolean } };
      if (maybeState.stateVariable?.isDynamic) unsupported = true;
      // This transform runs before emitInfos is populated. Inspect the source AST
      // directly so event-producing helpers remain inlined and their event metadata
      // is retained on every physical entry point that can execute the emit.
      if (candidate instanceof EmitStatementNode) unsupported = true;
      // The semantic effect metadata is populated after this lowering pass.
      // Inspect pre-semantic call shapes directly so external/low-level calls
      // never enter an OP_INVOKE handler which lacks their covenant context.
      if (candidate instanceof LowLevelCallNode
        || candidate instanceof LowLevelCallStatementNode
        || candidate instanceof MethodCallNode) unsupported = true;
      if (candidate instanceof FunctionCallNode) {
        const name = candidate.identifier.name;
        const dot = name.lastIndexOf('.');
        if (dot > 0 && !name.startsWith('super.') && !this.funcByName.has(name)) unsupported = true;
      }
      if (candidate instanceof MappingAccessNode || candidate instanceof MappingAssignNode
        || candidate instanceof MappingDeleteNode || candidate instanceof MappingFieldAssignNode
        || candidate instanceof ArrayAccessNode || candidate instanceof ArrayAssignNode
        || candidate instanceof StateArrayAssignNode
        || candidate.constructor.name.startsWith('StateArray')) unsupported = true;
    }
    return !unsupported && this.writesScalarState(fn);
  }

  private writesScalarState(fn: FunctionDefinitionNode): boolean {
    for (const candidate of this.nodesOf(fn)) {
      if ((candidate instanceof StateAssignNode || candidate instanceof DeleteStateNode)
        && this.stateVarNames.has(candidate.name)) return true;
    }
    return false;
  }

  // Names referenced as VALUES: an IdentifierNode occurrence that is not the identifier of a plain call.
  // Such a function is used as a function pointer and must stay a real (subroutine) definition.
  private collectValueReferencedNames(node: ContractNode): Set<string> {
    const callIdentifiers = new Set<Node>();
    const referenced = new Set<string>();
    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (!fn?.body) continue;
      for (const n of this.nodesOf(fn)) {
        if (n instanceof FunctionCallNode && n.identifier) callIdentifiers.add(n.identifier);
      }
      for (const n of this.nodesOf(fn)) {
        if (n instanceof IdentifierNode && !callIdentifiers.has(n)) referenced.add(n.name);
      }
    }
    return referenced;
  }

  // Reads or writes a plain (scalar) state variable: a `this.x` access/assign OF A DECLARED STATE VAR (a
  // bare `s.x = v` on a named return desugars to a state-assign node that SymbolTable later resolves
  // contextually - the name gate keeps those out), or a bare identifier read/assign of a state-var name
  // that is NOT shadowed by a param/local (a shadowed match would alpha-rename-break the clone).
  private touchesScalarState(fn: FunctionDefinitionNode): boolean {
    const shadowed = new Set(fn.parameters.map((p) => p.name));
    const nodes = this.nodesOf(fn);
    for (const n of nodes) if (n instanceof VariableDefinitionNode) shadowed.add(n.name);
    for (const n of nodes) {
      if ((n instanceof StateAccessNode || n instanceof StateAssignNode) && this.stateVarNames.has(n.name)) {
        return true;
      } else if (n instanceof IdentifierNode && this.stateVarNames.has(n.name) && !shadowed.has(n.name)) {
        return true;
      } else if (n instanceof AssignNode && this.stateVarNames.has(n.identifier.name)
        && !shadowed.has(n.identifier.name)) {
        return true;
      }
    }
    return false;
  }

  private hasStoragePointerParam(fn: FunctionDefinitionNode): boolean {
    return fn.parameters.some((p) => p.modifier.includes(Modifier.STORAGE));
  }

  private hasStructStoragePointerParam(fn: FunctionDefinitionNode): boolean {
    return fn.parameters.some((p) => p.modifier.includes(Modifier.STORAGE) && p.type instanceof StructType);
  }

  // A value-returning fn with a single `return <expr>;` body and a storage-pointer param: no standalone value
  // representation (the storage param is a compile-time reference), so calls inline by substituting the return expr.
  private isSingleReturnStoragePointerFn(fn: FunctionDefinitionNode): boolean {
    if (!fn.body || fn.returnTypes.length === 0) return false;
    // Non-standalone: takes a storage-pointer param OR returns a storage pointer (a mapping) - the returned
    // pointer has no runtime value, so `mapping(..) storage m = get()` must inline to the underlying mapping.
    if (!this.hasStoragePointerParam(fn) && !fn.returnTypes.some((t) => t instanceof MappingType)) return false;
    const stmts = (fn.body.statements ?? []).filter((s) => !(s instanceof ConsoleStatementNode));
    // An assembly return halts the whole call: its data is no value of the call.
    return stmts.length === 1 && stmts[0] instanceof ReturnNode && !stmts[0].isYulReturn
      && stmts[0].expressions.length === 1;
  }

  // Replace a call to a value-returning storage-pointer function with its (substituted) return expression.
  // A using-for named-arg call arrives as `L.f(recv, named...)` with fieldNames naming the tail; the inline
  // passes substitute POSITIONALLY, so reorder the tail against the callee's params before inlining.
  private reorderNamedTail(call: FunctionCallNode, callee: FunctionDefinitionNode): void {
    const fieldNames = call.fieldNames;
    if (!fieldNames || call.parameters.length !== callee.parameters.length
      || fieldNames.length !== callee.parameters.length - 1) return;
    const tailParams = callee.parameters.slice(1);
    if (!tailParams.every((p) => fieldNames.includes(p.name))) return;
    call.parameters = [
      call.parameters[0],
      ...tailParams.map((p) => call.parameters[1 + fieldNames.indexOf(p.name)]),
    ];
    call.fieldNames = undefined;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    const visited = super.visitFunctionCall(node) as FunctionCallNode; // recurse into args (nested inlinable calls)
    const callee = this.exprInlinableFns.get(visited.identifier.name);
    if (callee) this.reorderNamedTail(visited, callee);
    if (callee && !this.exprStack.includes(callee.name)
      && visited.parameters.length === callee.parameters.length) {
      if (this.exprAmbiguousInlineKeys.has(inlineKey(callee.name, callee.parameters.length))) {
        throw new AmbiguousInlineOverloadError(node, callee.name, callee.parameters.length);
      }
      this.exprStack.push(callee.name);
      const replacement = this.buildInlinedReturnExpr(callee, visited.parameters as ExpressionNode[]);
      this.exprStack.pop();
      if (replacement) return this.visit(replacement); // re-visit for nested inlinable calls in the return expr
    }
    return visited;
  }

  // Clone the callee, bind params to the call args (a bare-identifier arg renames the param; any other arg is
  // substituted by expression), then return the substituted single-return expression.
  private buildInlinedReturnExpr(
    callee: FunctionDefinitionNode, args: ExpressionNode[],
  ): ExpressionNode | undefined {
    const cloned = cloneNode(callee) as FunctionDefinitionNode;
    const rename = new Map<string, string>();
    const subs = new Map<string, ExpressionNode>();
    callee.parameters.forEach((p, i) => {
      const arg = args[i];
      if (arg instanceof IdentifierNode) rename.set(p.name, arg.name);
      else subs.set(p.name, cloneNode(arg) as ExpressionNode);
    });
    this.applyRename(cloned.body, rename);
    substituteInFunction(cloned, subs);
    const stmts = (cloned.body.statements ?? []).filter((s) => !(s instanceof ConsoleStatementNode));
    const ret = stmts[stmts.length - 1];
    if (!(ret instanceof ReturnNode) || ret.expressions.length !== 1) return undefined;
    return ret.expressions[0];
  }

  // Whether `name` is the target of a direct assignment anywhere in the body (so it cannot be safely aliased to
  // the caller's argument variable). Postfix/compound ops desugar to AssignNode before this pass.
  private isReassigned(body: Node | undefined, name: string): boolean {
    let found = false;
    this.walk(body, (n) => {
      if (!found && n instanceof AssignNode && n.identifier.name === name) found = true;
    });
    return found;
  }

  // H7: whether `name` is the target of ANY write in the body - a local reassignment (AssignNode) or a state /
  // mapping / array write. Solidity value params are copies; aliasing a value arg to `name` when the body mutates
  // `name` would make the param read the POST-mutation value, so callers fall back to a fresh temp instead.
  private isWritten(body: Node | undefined, name: string): boolean {
    let found = false;
    this.walk(body, (n) => {
      if (found) return;
      if (n instanceof AssignNode && n.identifier.name === name) found = true;
      else if ((n instanceof StateAssignNode || n instanceof MappingAssignNode
        || n instanceof StateArrayAssignNode || n instanceof MappingFieldAssignNode)
        && n.name === name) found = true;
    });
    return found;
  }

  private isInternalHelper(fn: FunctionDefinitionNode): boolean {
    return fn.isFreeFunction || fn.visibility === 'private' || fn.visibility === 'internal';
  }

  // A function reads a state entry if it reads a mapping/collection element - a MappingAccess, or a bare
  // ArrayAccess on a collection name (incl. the read half of a compound write `m[k] += v`). Such a read needs
  // an entry-access input slot, which only an entry-point's block layout provides, so a private function
  // doing it cannot be an OP_INVOKE subroutine and is inlined.
  private readsEntry(fn: FunctionDefinitionNode): boolean {
    for (const n of this.nodesOf(fn)) {
      if (n instanceof MappingAccessNode && this.collectionNames.has(n.name)) return true;
      else if (n instanceof ArrayAccessNode && n.array instanceof IdentifierNode
        && this.collectionNames.has(n.array.name)) return true;
    }
    return false;
  }

  // A function DIRECTLY writes a sorted (vmap) mapping entry: a MappingAssign/Field/Delete or single-key ArrayAssign
  // on a sorted collection. A vmap write co-spends the sorted-list entry slots (block layout), which only an entry
  // point has, so a void helper doing it cannot be an OP_INVOKE subroutine (the plain-entry-model write is fine).
  private directlyWritesSortedEntry(fn: FunctionDefinitionNode): boolean {
    for (const n of this.nodesOf(fn)) {
      // A single-key mapping write `m[k] = v` is an ArrayAssignNode; nested / struct-field / delete forms are
      // MappingAssign / MappingFieldAssign / MappingDelete. All co-spend the sorted entry when the collection is vmap.
      if ((n instanceof ArrayAssignNode || n instanceof MappingAssignNode || n instanceof MappingFieldAssignNode
        || n instanceof MappingDeleteNode) && this.sortedCollectionNames.has(n.name)) return true;
    }
    return false;
  }

  private hasTokenContainerEffects(fn: FunctionDefinitionNode): boolean {
    return this.nodesOf(fn).some((node) => node instanceof TokenContainerMethodStatementNode);
  }

  private holdsAssemblyReturn(fn: FunctionDefinitionNode): boolean {
    return this.nodesOf(fn).some((node) => node instanceof ReturnNode && node.isYulReturn);
  }

  private hasPhysicalEffects(fn: FunctionDefinitionNode): boolean {
    return this.nodesOf(fn).some((node) => {
      if (node instanceof InstantiationNode
        || node instanceof EmitStatementNode || node instanceof TransferStatementNode
        || node instanceof TokenContainerMethodStatementNode
        || node instanceof AddressTransferStatementNode
        || node instanceof AddressSendExpressionNode) return true;
      // Solidity `to.transfer(1)` / `to.send(1)` is still `to.transfer` until symbol resolution.
      const call = node instanceof FunctionCallStatementNode ? node.call
        : node instanceof FunctionCallNode ? node : undefined;
      if (!call || call.parameters.length !== 1) return false;
      const name = call.identifier.name;
      return name.endsWith('.transfer') || name.endsWith('.send');
    });
  }

  // The set of contract functions that DIRECTLY or TRANSITIVELY require an entry-point layout. A caller of a
  // state-touching helper becomes state-touching after that helper is inlined, so selecting only direct readers
  // leaves wrapper chains such as OZ ERC20 `_transfer -> _update -> _balances[...]` as layout-less subroutines.
  // Compute the full fixpoint before rewriting any bodies.
  private computeTransitiveSortedWriters(fns: FunctionDefinitionNode[]): Set<string> {
    const names = new Set(fns.map((f) => f.name));
    const calleesOf = (f: FunctionDefinitionNode): Set<string> => {
      const out = new Set<string>();
      for (const n of this.nodesOf(f)) {
        if (n instanceof FunctionCallNode && n.identifier && names.has(n.identifier.name)) out.add(n.identifier.name);
      }
      return out;
    };
    const result = new Set<string>(fns.filter((f) => (
      this.readsEntry(f) || this.touchesScalarState(f) || this.directlyWritesSortedEntry(f)
      || this.hasTokenContainerEffects(f) || this.hasPhysicalEffects(f)
    )).map((f) => f.name));
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of fns) {
        if (result.has(f.name)) continue;
        for (const c of calleesOf(f)) if (result.has(c)) { result.add(f.name); changed = true; break; }
      }
    }
    return result;
  }

  // Rewrite a statement list, replacing eligible storage-pointer-call statements with the inlined body.
  private inlineStatements(stmts: StatementNode[], stack: string[]): StatementNode[] {
    const out: StatementNode[] = [];
    for (const stmt of stmts) {
      this.recurseNestedBlocks(stmt, stack);
      if (stmt instanceof FunctionCallStatementNode) {
        // A `this.f()` self-call statement carries no plain identifier - not an inlinable name call.
        const name = stmt.call.identifier?.name;
        if (name === undefined) { out.push(stmt); continue; }
        const key = inlineKey(name, stmt.call.parameters.length);
        // Resolve the exact overload by (name, arity); fall back to the name map for a single-overload callee whose
        // arity was adjusted by reorderNamedTail. The recursion guard is keyed by (name, arity) too, so inlining
        // `_approve/4` from inside `_approve/3` is not blocked by the shared name.
        let callee = this.funcByKey.get(key) ?? this.funcByName.get(name);
        let args = stmt.call.parameters;
        // `using L for T; recv.method(x)` is still `recv.method` here. Physical-effect library helpers
        // (`Address.sendValue`) are selected for inlining by their `L.method` name; without rewriting this
        // spelling the helper is dropped and ST later reports `recv.method` as undefined on the message-bus path.
        const dot = name.lastIndexOf('.');
        if (!callee && dot > 0) {
          const method = name.slice(dot + 1);
          const matches = this.freeFns.filter((fn) => fn.name.endsWith(`.${method}`) && this.inlinedFns.has(fn.name)
            && stmt.call.parameters.length + 1 === fn.parameters.length);
          if (matches.length === 1) {
            callee = matches[0];
            const receiver = new IdentifierNode(name.slice(0, dot));
            receiver.location = stmt.call.location;
            args = [receiver, ...stmt.call.parameters];
          }
        }
        if (callee) this.reorderNamedTail(stmt.call, callee);
        if (callee && this.inlinedFns.has(callee.name) && !stack.includes(inlineKey(callee.name, callee.parameters.length))
          && args.length === callee.parameters.length && !this.keepsMessageCall(stmt.call, callee)) {
          if (this.ambiguousInlineKeys.has(inlineKey(callee.name, args.length))) {
            throw new AmbiguousInlineOverloadError(stmt.call, callee.name, args.length);
          }
          out.push(...this.inlineCall(callee, args, stack, stmt.call.sourceActivationConditions ?? [],
            stmt.call.fromThisCall === true));
          continue;
        }
      }
      out.push(stmt);
    }
    return out;
  }

  /** A framed `this.f()` whose callee reads its own message stays the call it is (`readsMessageField`). */
  private keepsMessageCall(call: FunctionCallNode, callee: FunctionDefinitionNode): boolean {
    return this.keepSelfMessageCalls && call.fromThisCall === true
      && readsMessageField(callee, (name) => this.funcByName.get(name), (fn) => this.nodesOf(fn));
  }

  private recurseNestedBlocks(stmt: StatementNode, stack: string[]): void {
    const inline = (b: BlockNode | undefined): void => {
      if (b) b.statements = this.inlineStatements(b.statements ?? [], stack);
    };
    if (stmt instanceof BranchNode) {
      inline(stmt.ifBlock);
      inline(stmt.elseBlock);
    } else if (stmt instanceof WhileNode || stmt instanceof DoWhileNode) {
      inline(stmt.block);
    } else if (stmt instanceof UncheckedNode) {
      inline(stmt.block);
    } else if (stmt instanceof BlockNode) {
      inline(stmt);
    }
  }

  // Produce [value-param-binding decls..., renamed+substituted body...] for one inlined call site. A `this.f()` call
  // (`frame`) is a frame of its own: an assembly return in it ends only that frame.
  private inlineCall(
    callee: FunctionDefinitionNode,
    args: Node[],
    stack: string[],
    callerConditions: readonly { expression: ExpressionNode; negated: boolean }[],
    frame = false,
  ): StatementNode[] {
    const n = this.counter++;
    const cloned = cloneNode(callee) as FunctionDefinitionNode;
    // Outside framed a void helper's early returns are nested away before splicing; an assembly return, which ends
    // the whole call, stays unless the helper is a frame of its own. Per-call confines them with a flag instead
    // (`confineHelperReturns`, which finds nothing left to confine after this normalization).
    if (!this.keepSelfMessageCalls) normalizeVoidInlineReturns(cloned, !frame);

    const rename = new Map<string, string>();
    const subs = new Map<string, ExpressionNode>();
    const collectionPaths = new Map<string, { name: string; keys: ExpressionNode[] }>();
    const flattenedStructPaths = new Map<string, { name: string; keys: ExpressionNode[] }>();
    const inlinedArg = new Set<string>();
    const rmwPrologue: StatementNode[] = [];
    const rmwEpilogue: StatementNode[] = [];
    callee.parameters.forEach((p, i) => {
      const arg = args[i];
      if (p.modifier.includes(Modifier.STORAGE)) {
        // A struct storage-pointer bound to a MAPPING/ARRAY element that the body WRITES (`L.f(m[k])`,
        // `arr[i].m()`) cannot be substituted: the write lowers to `AssignNode(identifier=param, S(..))`, an
        // lvalue slot expression substitution cannot turn into a mapping/array-element assign. Mirror the
        // AstBuilder's read-modify-write template instead - bind a struct local to the element, rename the
        // param to it, and write the local back after the body (`S t = m[k]; <body>; m[k] = t;`).
        const acc = this.elementAccess(arg);
        if (p.type instanceof StructType && acc && this.isWritten(callee.body, p.name)) {
          const local = `${PREFIX}${n}_${p.name}`;
          rename.set(p.name, local);
          const decl = new VariableDefinitionNode(p.type, [], local, acc.read as never);
          decl.location = arg.location ?? callee.location;
          rmwPrologue.push(decl as StatementNode);
          rmwEpilogue.push(acc.writeBack(local));
        } else if (p.type instanceof StructType && callee.isLibraryFunction) {
          const path = this.flattenedStructCollectionPath(arg, p.name, callee.body);
          if (path) {
            flattenedStructPaths.set(p.name, path);
            rename.set(p.name, path.name);
          } else if (arg instanceof IdentifierNode) {
            rename.set(p.name, arg.name);
          } else {
            subs.set(p.name, cloneNode(arg) as ExpressionNode);
          }
        } else if (p.type instanceof ArrayType) {
          // An ARRAY storage pointer aliases a collection path exactly as a mapping pointer does: binding it to
          // the path lets a push, pop, `.length` and every keyed access be rewritten onto the caller's array.
          const path = this.collectionPath(arg);
          if (path) {
            collectionPaths.set(p.name, path);
            subs.set(p.name, cloneNode(arg) as ExpressionNode);
          } else if (arg instanceof IdentifierNode) {
            rename.set(p.name, arg.name);
          } else {
            subs.set(p.name, cloneNode(arg) as ExpressionNode);
          }
        } else if (arg instanceof IdentifierNode) {
          // A bare state-var argument is aliased by NAME (covers reads and writes, incl. mapping-assign
          // targets whose container is a string field).
          rename.set(p.name, arg.name);
        } else if (p.type instanceof MappingType) {
          const path = this.collectionPath(arg);
          if (path) {
            collectionPaths.set(p.name, path);
            subs.set(p.name, cloneNode(arg) as ExpressionNode);
          } else subs.set(p.name, cloneNode(arg) as ExpressionNode);
        } else {
          // A complex read-only access path is substituted by expression.
          subs.set(p.name, cloneNode(arg) as ExpressionNode);
        }
      } else if (arg instanceof IdentifierNode && !this.isReassigned(callee.body, p.name)
        && !this.isWritten(callee.body, arg.name)) {
        // Substitute a simple identifier value arg by NAME (no local binding): a mapping key that is a caller
        // PARAMETER stays a parameter in the inlined body, so the SDK resolves it from call args (a `__sp0_k = k`
        // binding would make the key an opaque expression it cannot locate). Guarded on the param not being
        // reassigned AND the arg not being written in the callee, else the alias breaks value-copy semantics (H7).
        rename.set(p.name, arg.name);
        inlinedArg.add(p.name);
      } else if (arg instanceof NullaryOpNode
        && (arg.operator === NullaryOperator.MSG_SENDER || arg.operator === NullaryOperator.TX_ORIGIN)
        && !this.isReassigned(callee.body, p.name)) {
        // Transaction-derived sender identities are invariant for the whole invocation. Binding one inside a
        // runtime loop (e.g. OZ `_transfer(msg.sender, ...)`) obscures that invariant from vmap's same-entry
        // cache and makes the repeated debit look like an unsupported varying-key write.
        subs.set(p.name, cloneNode(arg) as ExpressionNode);
        inlinedArg.add(p.name);
      } else {
        rename.set(p.name, `${PREFIX}${n}_${p.name}`);
      }
    });
    cloned.body = this.rewriteCollectionPointerWrites(
      cloned.body, collectionPaths, flattenedStructPaths,
    ) as BlockNode;
    this.walk(cloned.body, (node) => {
      if ((callee.isLibraryFunction || callee.name.includes('.'))
        && (node instanceof AddressTransferStatementNode || node instanceof AddressSendExpressionNode)) {
        node.inlinedLibraryEffect = true;
      }
      if ((callee.isLibraryFunction || callee.name.includes('.')) && node instanceof FunctionCallNode
        && /\.(?:transfer|send)$/.test(node.identifier.name)) node.inlinedLibraryEffect = true;
      if (node instanceof VariableDefinitionNode && !rename.has(node.name) && !subs.has(node.name)) {
        rename.set(node.name, `${PREFIX}${n}_${node.name}`);
      } else if (node instanceof TupleAssignmentNode) {
        for (const element of node.elements) {
          if (!element.skip && !element.existing && element.name
            && !rename.has(element.name) && !subs.has(element.name)) {
            rename.set(element.name, `${PREFIX}${n}_${element.name}`);
          }
        }
      }
    });
    // Rename value params/locals first (storage-param refs are untouched), then substitute storage
    // params with their (un-renamed) argument expressions.
    this.applyRename(cloned.body, rename);
    substituteInFunction(cloned, subs);
    // The callee's source snapshots describe only branches inside its own body. Once it is spliced into the
    // caller, every nested call also inherits the caller's lexical path. Keep that path on the call node before
    // recursively inlining further helpers; otherwise artifact collection mistakes an untaken inner call for
    // an unconditional graph emission. Stamp after the callee-local rename/substitution so identically named
    // caller parameters cannot be rewritten as the callee's locals.
    if (callerConditions.length > 0) this.walk(cloned.body, (node) => {
      if (node instanceof FunctionCallNode || node instanceof MethodCallNode
        || node instanceof ExternalFunctionCallNode || node instanceof LowLevelCallNode
        || node instanceof LowLevelCallStatementNode) {
        // An undefined source snapshot means this call was synthesized after the source capture pass. Let
        // artifact collection recover its whole lowered ancestry; manufacturing a partial snapshot here would
        // truncate an inner branch predicate to the inherited caller depth.
        if (node.sourceActivationConditions === undefined) return;
        node.sourceActivationConditions = [
          ...callerConditions,
          ...(node.sourceActivationConditions ?? []),
        ].map(({ expression, negated }) => ({
          expression: cloneNode(expression) as ExpressionNode,
          negated,
        }));
      }
    });
    // An inherited helper's body may legitimately touch its own contract's PRIVATE state; tag the inlined
    // accesses with the defining contract (same mechanism as inlined modifier bodies).
    if (callee.inheritedFrom) tagModifierStateAccess([cloned.body], callee.inheritedFrom);

    const bindings: StatementNode[] = [];
    callee.parameters.forEach((p, i) => {
      if (p.modifier.includes(Modifier.STORAGE) || inlinedArg.has(p.name)) return;
      const def = new VariableDefinitionNode(p.type, [], rename.get(p.name)!, cloneNode(args[i]) as never);
      def.location = args[i].location ?? callee.location;
      bindings.push(def);
    });
    const inlined = this.inlineStatements(cloned.body.statements ?? [],
      [...stack, inlineKey(callee.name, callee.parameters.length)]);
    return [...bindings, ...rmwPrologue, ...this.confineHelperReturns(inlined, n, callee, frame), ...rmwEpilogue];
  }

  /**
   * A `return;` in an inlined void helper leaves the helper, not the function it is inlined into. Spliced verbatim
   * it left the caller instead: KashiPair's withdrawFees inlines accrue(), whose `if (elapsedTime == 0) return;`
   * then skipped the rest of withdrawFees. A body whose only return is its last statement drops it; otherwise each
   * return sets a fresh flag and every statement after it is gated on that flag. A Yul `return` ends the whole call
   * frame, as it does on the EVM, so it stays, unless the helper is a `frame` of its own: then it leaves the helper.
   */
  private confineHelperReturns(
    stmts: StatementNode[], n: number, callee: FunctionDefinitionNode, frame: boolean,
  ): StatementNode[] {
    const leaves = (statement: StatementNode): boolean => containsSourceReturn(statement, frame);
    if (!stmts.some(leaves)) return stmts;
    const last = stmts[stmts.length - 1];
    if (last instanceof ReturnNode && (frame || !last.isYulReturn) && !stmts.slice(0, -1).some(leaves)) {
      return stmts.slice(0, -1);
    }
    const flag = `__internal__inlineReturned_${n}`;
    const unset = new BoolLiteralNode(false);
    unset.location = callee.location;
    const declaration = new VariableDefinitionNode(PrimitiveType.BOOL, [], flag, unset);
    declaration.location = callee.location;
    declaration.allowUnused = true;
    return [declaration, ...this.gateAfterHelperReturns(stmts, flag, callee, frame)];
  }

  private gateAfterHelperReturns(
    stmts: StatementNode[], flag: string, callee: FunctionDefinitionNode, frame: boolean,
  ): StatementNode[] {
    const out: StatementNode[] = [];
    for (let index = 0; index < stmts.length; index += 1) {
      const statement = stmts[index];
      if (statement instanceof ReturnNode && (frame || !statement.isYulReturn)) {
        const set = new BoolLiteralNode(true);
        set.location = statement.location;
        const target = new IdentifierNode(flag);
        target.location = statement.location;
        const assignment = new AssignNode(target, set);
        assignment.location = statement.location;
        out.push(assignment);
        return out; // the rest of this list is unreachable
      }
      if (!containsSourceReturn(statement, frame)) {
        out.push(statement);
        continue;
      }
      out.push(this.confineNestedHelperReturns(statement, flag, callee, frame));
      const rest = stmts.slice(index + 1);
      if (rest.length > 0) {
        const read = new IdentifierNode(flag);
        read.location = statement.location;
        const notReturned = new UnaryOpNode(UnaryOperator.NOT, read);
        notReturned.location = statement.location;
        const gated = new BlockNode(this.gateAfterHelperReturns(rest, flag, callee, frame));
        gated.location = statement.location;
        const gate = new BranchNode(notReturned, gated);
        gate.location = statement.location;
        out.push(gate);
      }
      return out;
    }
    return out;
  }

  private confineNestedHelperReturns(
    statement: StatementNode, flag: string, callee: FunctionDefinitionNode, frame: boolean,
  ): StatementNode {
    const lower = (block: BlockNode | undefined): void => {
      if (block) block.statements = this.gateAfterHelperReturns(block.statements ?? [], flag, callee, frame);
    };
    if (statement instanceof BranchNode) {
      lower(statement.ifBlock);
      lower(statement.elseBlock);
    } else if (statement instanceof BlockNode) {
      lower(statement);
    } else if (statement instanceof UncheckedNode) {
      lower(statement.block);
    } else if (statement instanceof SwitchNode) {
      for (const switchCase of statement.cases) lower(switchCase.body);
      lower(statement.defaultCase);
    } else if (statement instanceof TryCatchNode) {
      lower(statement.tryBlock);
      for (const clause of statement.catchClauses) lower(clause.block);
    } else {
      // A return inside a loop is lowered to a flag and a break before this pass runs; one that is still here would
      // need a loop exit this rewrite does not have, so refuse rather than leave the caller early.
      throw new Error(
        `Cannot inline '${callee.name}': it returns from inside a ${statement.constructor.name}, and a return there `
        + 'would leave its caller',
      );
    }
    return statement;
  }

  // Resolve a storage-pointer argument like `fixedMaps[x]` to its root collection and captured prefix keys.
  private collectionPath(arg: Node): { name: string; keys: ExpressionNode[] } | undefined {
    if (arg instanceof MappingAccessNode) {
      return { name: arg.name, keys: arg.keys.map((key) => cloneNode(key) as ExpressionNode) };
    }
    const keys: ExpressionNode[] = [];
    let current: Node = arg;
    while (current instanceof ArrayAccessNode || current instanceof TupleIndexOpNode) {
      if (current instanceof ArrayAccessNode) {
        keys.unshift(cloneNode(current.index) as ExpressionNode);
        current = current.array;
      } else {
        const index = new IntLiteralNode(BigInt(current.index));
        index.location = current.location;
        keys.unshift(index);
        current = current.tuple;
      }
    }
    return current instanceof IdentifierNode && this.collectionNames.has(current.name)
      ? { name: current.name, keys } : undefined;
  }

  // A struct containing a mapping/dynamic-array field is flattened into sibling collections (`data__a`,
  // `data__b`, ...), so its original root `data` is deliberately absent from collectionNames. Recover the
  // root+key path for `Lib.f(data[k])` when at least one flattened field collection proves that root exists.
  private flattenedStructCollectionPath(
    arg: Node, parameterName: string, body: Node,
  ): { name: string; keys: ExpressionNode[] } | undefined {
    const keys: ExpressionNode[] = [];
    let current = arg;
    while (current instanceof ArrayAccessNode || current instanceof TupleIndexOpNode) {
      if (current instanceof ArrayAccessNode) {
        keys.unshift(cloneNode(current.index) as ExpressionNode);
        current = current.array;
      } else {
        const index = new IntLiteralNode(BigInt(current.index));
        index.location = current.location;
        keys.unshift(index);
        current = current.tuple;
      }
    }
    if (!(current instanceof IdentifierNode) || keys.length === 0) return undefined;
    const prefix = `${current.name}__`;
    if (![...this.collectionNames].some((name) => name.startsWith(prefix))) return undefined;
    // Do not infer a flattened root merely because an unrelated sibling collection shares its prefix. Every
    // flattened field name used by this helper must have a concrete caller-side field collection/state slot.
    const usedSuffixes = new Set<string>();
    this.walk(body, (item) => {
      const name = (item as unknown as { name?: unknown }).name;
      if (typeof name === 'string' && name.startsWith(`${parameterName}__`)) {
        usedSuffixes.add(name.slice(parameterName.length));
      }
    });
    if ([...usedSuffixes].some((suffix) =>
      !this.collectionNames.has(`${current.name}${suffix}`)
      && !this.stateVarNames.has(`${current.name}${suffix}`))) return undefined;
    return { name: current.name, keys };
  }

  // AstBuilder represents `mapping storage p; p[k] = v` as ArrayAssignNode because `p` is a local pointer name,
  // not a declared state collection. Once p binds to `root[prefix...]`, replace those writes with the concrete
  // MappingAssign path. Reads remain expression nodes and are handled by ordinary identifier substitution.
  private rewriteCollectionPointerWrites(
    node: Node, paths: Map<string, { name: string; keys: ExpressionNode[] }>,
    flattenedStructPaths: Map<string, { name: string; keys: ExpressionNode[] }> = new Map(),
    // A node this call just produced: walk its children, but never rewrite the node itself again.
    skipSelf = false,
  ): Node {
    const rooted = (
      path: { name: string; keys: ExpressionNode[] }, tail: ExpressionNode, location: Node['location'],
    ): ExpressionNode => {
      let expression: ExpressionNode = new IdentifierNode(path.name);
      expression.location = location;
      for (const key of [...path.keys, tail]) {
        const access = new ArrayAccessNode(expression, cloneNode(key) as ExpressionNode);
        access.location = location;
        expression = access;
      }
      return expression;
    };
    const flattened = (name: string): { name: string; keys: ExpressionNode[] } | undefined => {
      const separator = name.indexOf('__');
      if (separator <= 0) return undefined;
      const path = flattenedStructPaths.get(name.slice(0, separator));
      return path ? { name: `${path.name}${name.slice(separator)}`, keys: path.keys } : undefined;
    };
    const keys = (path: { keys: ExpressionNode[] }): ExpressionNode[] =>
      path.keys.map((key) => cloneNode(key) as ExpressionNode);

    // `.length` names its receiver, not the node, so resolve it from the SIZE operand.
    if (!skipSelf && this.pointerTargets && node instanceof UnaryOpNode && node.operator === UnaryOperator.SIZE) {
      const root = pointerRootName(node.expression);
      const rootPath = root ? paths.get(root) : undefined;
      if (rootPath) {
        const binding: StoragePointerBinding = {
          parameter: root!,
          name: rootPath.name,
          keys: rootPath.keys.map((key) => cloneNode(key) as ExpressionNode),
        };
        const replaced = rewriteStoragePointerLength(
          node.expression, binding, this.pointerTargets, node.location,
        );
        if (replaced) {
          return this.rewriteCollectionPointerWrites(replaced as Node, paths, flattenedStructPaths, true);
        }
      }
    }
    const pointerName = (node as unknown as { name?: unknown }).name;
    const pointerPath = !skipSelf && typeof pointerName === 'string' ? paths.get(pointerName) : undefined;
    if (pointerPath && this.pointerTargets) {
      const binding: StoragePointerBinding = {
        parameter: pointerName as string,
        name: pointerPath.name,
        keys: pointerPath.keys.map((key) => cloneNode(key) as ExpressionNode),
      };
      const replaced = rewriteStoragePointerNode(node, binding, this.pointerTargets);
      // Rewrite the replacement's children too: a prefixed key may itself read the pointer (`p[p.length - 1]`).
      if (replaced) {
        return this.rewriteCollectionPointerWrites(replaced as Node, paths, flattenedStructPaths, true);
      }
    }

    const flattenedName = (node as unknown as { name?: unknown }).name;
    const fieldPath = typeof flattenedName === 'string' ? flattened(flattenedName) : undefined;
    if (fieldPath) {
      if (node instanceof StateAssignNode) {
        const replacement = new MappingAssignNode(fieldPath.name, keys(fieldPath), node.expression);
        replacement.location = node.location;
        return replacement;
      }
      if (node instanceof StateArrayPushNode) {
        const replacement = new MappingAssignNode(fieldPath.name, keys(fieldPath), node.value);
        replacement.arrayPush = true;
        replacement.noArg = node.noArg;
        replacement.location = node.location;
        return replacement;
      }
      if (node instanceof StateArrayPopNode) {
        const replacement = new MappingAssignNode(
          fieldPath.name, keys(fieldPath), new IntLiteralNode(0n),
        );
        replacement.arrayPop = true;
        replacement.location = node.location;
        return replacement;
      }
      if (node instanceof StateArrayAssignNode) {
        const replacement = new MappingAssignNode(
          fieldPath.name, [...keys(fieldPath), node.index], node.value,
        );
        replacement.location = node.location;
        return replacement;
      }
      if (node instanceof StateArrayDeleteNode) {
        const replacement = new MappingAssignNode(
          fieldPath.name,
          [...keys(fieldPath), node.index],
          new IntLiteralNode(0n),
        );
        replacement.location = node.location;
        return replacement;
      }
      if (node instanceof MappingAssignNode) {
        node.name = fieldPath.name;
        node.keys = [...keys(fieldPath), ...node.keys];
      } else if (node instanceof MappingAccessNode) {
        node.name = fieldPath.name;
        node.keys = [...keys(fieldPath), ...node.keys];
      } else if (node instanceof MappingDeleteNode) {
        node.name = fieldPath.name;
        node.keys = [...keys(fieldPath), ...node.keys];
      } else if (node instanceof IdentifierNode || node instanceof StateAccessNode) {
        const replacement = new MappingAccessNode(fieldPath.name, keys(fieldPath));
        replacement.location = node.location;
        return replacement;
      }
    }
    if (node instanceof ArrayAssignNode) {
      const path = paths.get(node.name);
      if (path) {
        const replacement = new MappingAssignNode(
          path.name,
          [...path.keys.map((key) => cloneNode(key) as ExpressionNode), node.index],
          node.value,
        );
        replacement.location = node.location;
        return replacement;
      }
    }
    if (node instanceof ArrayAccessNode && node.array instanceof IdentifierNode) {
      const path = paths.get(node.array.name);
      if (path) return rooted(path, node.index, node.location);
    }
    if (node instanceof TupleIndexOpNode && node.tuple instanceof IdentifierNode) {
      const path = paths.get(node.tuple.name);
      if (path) {
        const index = new IntLiteralNode(BigInt(node.index));
        index.location = node.location;
        return rooted(path, index, node.location);
      }
    }
    for (const key in node) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof Node) {
        (node as unknown as Record<string, unknown>)[key] = this.rewriteCollectionPointerWrites(
          value, paths, flattenedStructPaths,
        );
      } else if (Array.isArray(value)) {
        (node as unknown as Record<string, unknown>)[key] = value.map((item) =>
          item instanceof Node ? this.rewriteCollectionPointerWrites(item, paths, flattenedStructPaths) : item);
      }
    }
    return node;
  }

  // Normalized element READ node + write-back builder for a struct storage-pointer bound to a mapping/array
  // element or bare state struct var (the RMW read + epilogue). Handles BOTH `this.m[k]` (MappingAccessNode) and
  // bare `m[k]` (ArrayAccessNode on the mapping-name identifier, how Solidity WITHOUT `this.` parses) - the bare
  // mapping form must resolve via the collection, so its read is rebuilt as a MappingAccessNode. Routed by kind
  // (a real mapping -> MappingAssign, a state array -> StateArrayAssign). Undefined for any other access shape.
  private elementAccess(arg: Node): { read: ExpressionNode; writeBack: (local: string) => StatementNode } | undefined {
    const loc = arg.location;
    const at = (n: StatementNode): StatementNode => { n.location = loc; return n; };
    const id = (l: string): IdentifierNode => { const x = new IdentifierNode(l); x.location = loc; return x; };
    const clone = (e: ExpressionNode): ExpressionNode => cloneNode(e) as ExpressionNode;
    if (arg instanceof MappingAccessNode) {
      const keys = (): ExpressionNode[] => arg.keys.map(clone);
      if (this.mappingNames.has(arg.name)) {
        return { read: clone(arg), writeBack: (l) => at(new MappingAssignNode(arg.name, keys(), id(l))) };
      }
      // An indexed state-var/collection access whose name is not a mapping is a state-array element.
      if ((this.stateVarNames.has(arg.name) || this.collectionNames.has(arg.name)) && arg.keys.length === 1) {
        return { read: clone(arg), writeBack: (l) => at(new StateArrayAssignNode(arg.name, keys()[0], id(l))) };
      }
      return undefined;
    }
    if (arg instanceof ArrayAccessNode && arg.array instanceof IdentifierNode) {
      const name = arg.array.name;
      // Bare `m[k]` (no `this.`) on a MAPPING parses as an array access on the mapping-name identifier; rebuild
      // read + write-back as mapping ops so they resolve via the collection (else "Undefined state variable").
      if (this.mappingNames.has(name)) {
        const read = new MappingAccessNode(name, [clone(arg.index)]);
        read.location = loc;
        return { read, writeBack: (l) => at(new MappingAssignNode(name, [clone(arg.index)], id(l))) };
      }
      if (this.stateVarNames.has(name) || this.collectionNames.has(name)) {
        return { read: clone(arg), writeBack: (l) => at(new StateArrayAssignNode(name, clone(arg.index), id(l))) };
      }
      return undefined;
    }
    // A bare state struct var receiver (`L.f(this.tot)`): whole-struct read-modify-write of the scalar state var.
    if (arg instanceof StateAccessNode && this.stateVarNames.has(arg.name)) {
      return { read: clone(arg), writeBack: (l) => at(new StateAssignNode(arg.name, id(l))) };
    }
    return undefined;
  }

  private applyRename(root: Node, map: Map<string, string>): void {
    // Rename `x` (exact), `x.f` (dotted member), and `x__f` (a struct storage pointer's flattened state field,
    // e.g. `map__values` -> `<arg>__values`) so the inlined body targets the caller's flattened collections.
    const rn = (name: string): string => {
      const dot = name.indexOf('.');
      if (dot > 0 && map.has(name.slice(0, dot))) return map.get(name.slice(0, dot))! + name.slice(dot);
      const us = name.indexOf('__');
      if (us > 0 && map.has(name.slice(0, us))) return map.get(name.slice(0, us))! + name.slice(us);
      return map.get(name) ?? name;
    };
    const renameNode = (n: Node): void => {
      if (n instanceof IdentifierNode) {
        n.name = rn(n.name);
      } else if (n instanceof FieldAccessNode) {
        // n.name is a STRUCT FIELD MEMBER, never a variable - never rename it. The base `expression` is still
        // walked as a child, so a renamed receiver is applied there. Without this guard, an inlined local that
        // shares a struct field's name (`string label` vs `items[id].label`) corrupts the field access to
        // `items[id].__message_bus_arg_*` / `__spN_label` -> "Struct has no field ...", which then fails the
        // autoDelegate variant build for pooled Item[] writers that use parameter names matching fields.
      } else if (n instanceof TupleAssignmentNode) {
        // Tuple lvalues are plain element descriptors rather than
        // IdentifierNodes. Keep an existing-variable capture aligned with
        // the alpha-renamed declaration when a journal-bearing wrapper is
        // itself inlined into an entry point.
        n.elements = n.elements.map((element) => (
          element.name ? { ...element, name: rn(element.name) } : element
        ));
      } else {
        const nm = (n as unknown as { name?: unknown }).name;
        if (typeof nm === 'string') (n as unknown as { name: string }).name = rn(nm);
      }
    };
    this.walk(root, (n) => {
      renameNode(n);
      // Source activation snapshots are plain-object metadata, so the executable-AST walker deliberately skips
      // them. Rename their copied expressions with the same bindings as the inlined statements they describe.
      const snapshots = (n as { sourceActivationConditions?: readonly { expression: ExpressionNode }[] })
        .sourceActivationConditions;
      for (const snapshot of snapshots ?? []) this.walk(snapshot.expression, renameNode);
    });
  }

  // Pre-order walk over child Nodes (and Node arrays); skips Type/symbol-table fields.
  private nodesOf(fn: FunctionDefinitionNode): Node[] {
    let nodes = this.bodyNodes.get(fn);
    if (nodes) return nodes;
    // All classification and closure selection completes before this pass rewrites any body. Cache only that
    // immutable pre-rewrite phase; cloned/inlined bodies continue to use walk directly below.
    nodes = [];
    this.walk(fn.body, (node) => nodes!.push(node));
    this.bodyNodes.set(fn, nodes);
    return nodes;
  }

  private walk(node: Node | undefined, visit: (n: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key in node) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) this.walk(v, visit);
      else if (Array.isArray(v)) {
        for (const it of v) if (it instanceof Node) this.walk(it, visit);
      } else if (key === 'callOptions' && v && typeof v === 'object') {
        // Call/deploy options are a plain object rather than an AST Node. They can still refer to helper
        // parameters (`new D{value: amount}()`), so descend into each expression during alpha-renaming.
        for (const optKey in v) {
          const opt = (v as unknown as Record<string, unknown>)[optKey];
          if (opt instanceof Node) this.walk(opt, visit);
        }
      }
    }
  }
}
