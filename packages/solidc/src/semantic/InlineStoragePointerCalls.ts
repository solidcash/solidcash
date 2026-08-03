import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  StatementNode,
  BlockNode,
  FunctionCallStatementNode,
  VariableDefinitionNode,
  IdentifierNode,
  ExpressionNode,
  BranchNode,
  WhileNode,
  DoWhileNode,
  UncheckedNode,
  MappingAccessNode,
  ArrayAccessNode,
  AssignNode,
  StateAssignNode,
  StateAccessNode,
  DeleteStateNode,
  MappingAssignNode,
  MappingDeleteNode,
  ArrayAssignNode,
  StateArrayAssignNode,
  MappingFieldAssignNode,
  ReturnNode,
  FunctionCallNode,
  TupleAssignmentNode,
  ConsoleStatementNode,
  EmitStatementNode,
  TokenContainerMethodStatementNode,
  TransferStatementNode,
  LowLevelCallNode,
  LowLevelCallStatementNode,
  MethodCallNode,
  InstantiationNode,
} from '../ast/AST.js';
import { StructType, MappingType } from '@solidcash/utils';
import { tagModifierStateAccess } from './ModifierExpansionTransformation.js';
import { Modifier } from '../ast/Globals.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { substituteInFunction } from './InheritanceExpansionTransformation.js';
import { collectAmbiguousInlineKeys, inlineKey } from './inlineOverloadGuard.js';
import { AmbiguousInlineOverloadError, GraphEmissionEffectError } from '../Errors.js';

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

export default class InlineStoragePointerCalls extends AstTraversal {
  constructor(private readonly inlineSolidityInitializers = false) { super(); }
  private funcByName: Map<string, FunctionDefinitionNode> = new Map();
  // Overload-aware callee lookup keyed by inlineKey(name, arity): a name-only map returns the wrong overload for a
  // call whose arity differs (OZ ERC20 `_approve/3` -> `_approve/4`), so the arity-mismatched call is never inlined
  // yet the callee is still dropped by name -> "Undefined reference to symbol _approve".
  private funcByKey: Map<string, FunctionDefinitionNode> = new Map();
  // H8: <name>/<arity> keys that more than one overload shares - inlining one by that key is ambiguous.
  private ambiguousInlineKeys: Set<string> = new Set();
  private inlinedFns: Set<string> = new Set();
  private collectionNames: Set<string> = new Set();
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
  private exprStack: string[] = [];

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
    this.funcByName = new Map();
    this.funcByKey = new Map();
    for (const fn of [...node.functions, ...this.freeFns]) {
      this.funcByName.set(fn.name, fn);
      this.funcByKey.set(inlineKey(fn.name, fn.parameters.length), fn);
    }
    this.ambiguousInlineKeys = collectAmbiguousInlineKeys([...node.functions, ...this.freeFns]);
    this.collectionNames = new Set(node.collections.map((c) => c.name));
    // Mapping (not array) collections: an element write-back for a struct storage-pointer bound to `m[k]` is a
    // MappingAssign, but an array element `arr[i]` is a StateArrayAssign - keep them apart so neither gets the
    // other's node (an array accessed as `arr[i]` parses to a MappingAccessNode too).
    this.mappingNames = new Set(node.collections.filter((c) => c.type instanceof MappingType).map((c) => c.name));
    // C2 (sorted) collections: a WRITE to one co-spends the sorted-list entry slots (block layout), like a read,
    // so a void helper writing a sorted mapping must also inline (a plain-entry-model write works as a subroutine).
    this.sortedCollectionNames = new Set(node.collections.filter((c) => c.sorted).map((c) => c.name));
    const allFns = [...node.functions, ...(node.fallbackDef ? [node.fallbackDef] : [])];
    this.transitiveSortedWriters = this.computeTransitiveSortedWriters(allFns);
    this.stateVarNames = new Set(node.stateVariables.map((sv) => sv.name));
    this.constructorCalledFns = new Set();
    if (node.constructorDef?.body) {
      this.walk(node.constructorDef.body, (candidate) => {
        if (candidate instanceof FunctionCallNode) this.constructorCalledFns.add(candidate.identifier.name);
      });
    }
    // Effect metadata is populated after this pass. Build the equivalent pre-semantic call-graph closure so a
    // scalar writer which deploys/calls externally through an internal helper stays on the established inline
    // path rather than becoming an OP_INVOKE journal with missing physical effect context.
    this.journalEffectFns = new Set();
    const directEffect = (fn: FunctionDefinitionNode): boolean => {
      if (!fn.body) return false;
      let found = false;
      this.walk(fn.body, (candidate) => {
        if (candidate instanceof InstantiationNode || candidate instanceof MethodCallNode
          || candidate instanceof LowLevelCallNode || candidate instanceof LowLevelCallStatementNode) found = true;
        else if (candidate instanceof FunctionCallNode) {
          const name = candidate.identifier.name;
          const dot = name.lastIndexOf('.');
          if (dot > 0 && !name.startsWith('super.') && !this.funcByName.has(name)) found = true;
        }
      });
      return found;
    };
    for (const fn of node.functions) if (fn.body && directEffect(fn)) this.journalEffectFns.add(fn.name);
    let effectClosureChanged = true;
    while (effectClosureChanged) {
      effectClosureChanged = false;
      for (const fn of node.functions) {
        if (!fn.body || this.journalEffectFns.has(fn.name)) continue;
        let reachesEffect = false;
        this.walk(fn.body, (candidate) => {
          if (candidate instanceof FunctionCallNode
            && this.journalEffectFns.has(candidate.identifier.name)) reachesEffect = true;
        });
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
    for (const fn of node.functions) {
      // A graph emission handler executes behind OP_INVOKE precisely so its hidden transcript/caller/result
      // frame authenticates every reached edge. Flattening one into __scb1 makes __scb1 the current function at
      // code generation, so its external calls take the ordinary-call path and no emission row is ever
      // recomputed and compared - the transcript can then state any target and any arguments. Same guard, and
      // the same reason, as InlineExternalCallHelpers and InlineReturningStateHelpers. Reachable only when
      // route synthesis ran BEFORE this pass (compiler.ts synthesizeBatchBeforeLowering).
      //
      // X29 replaced SEC-6's refusal for the `emit` / `transfer` carrying clones: they stay behind OP_INVOKE
      // too, which is what keeps their edges bound, and their effect is no longer dropped because the ROUTE now
      // reserves an owner-local frame per dispatch site on their behalf (SymbolTableTraversal
      // planGraphEffectFrames) and pushes the site ordinal as hidden context, against which the subroutine
      // resolves its own event/transfer OUTPUT indices (GenerateTargetTraversal emitGraphEffectSlotIndex).
      if (this.keepsGraphEmissionBinding(fn)) continue;
      // SEC-7. A TOKEN-CONTAINER operation is still refused, and for the reason X29 removed for events and
      // transfers rather than an unexamined one: `this.tokens[c].transfer(..)` needs a co-spent tokenContainer
      // INPUT slot as well as its tcTransfer outputs, and an input slot is not a per-site output frame - it
      // shifts every later input index in the block and is co-spent once for the whole route, not once per
      // dispatch site. Flattening the clone instead is exactly what SEC-6 measured forgeable, so the shape is
      // refused rather than published with unbound edges.
      //
      // Scoped to a clone that actually HAS an outgoing edge. `graphTailHandlers` also admits a handler that
      // merely reads msg.sender / msg.value in a graph route, and such a clone has no external call for the
      // transcript to misstate - flattening it loses nothing and refusing it would refuse a sound shape.
      if (fn.graphEmissionHandler && this.hasOutgoingCall(fn)) {
        throw new GraphEmissionEffectError(fn, fn.name.replace(/^__scb_(graph|resource)_/, ''),
          this.hasTokenContainerEffects(fn) ? 'a token-container operation' : 'a storage-pointer parameter');
      }
      // Any state access disqualifies an OP_INVOKE subroutine: entry reads need block-layout slots, and
      // scalar reads/writes live in the ENTRY traversal's commitment model (a subroutine's are invisible
      // to it). Inline all state-touching void callees; entry points keep their definition (still
      // dispatchable), internal helpers are dropped below.
      const scalarJournalEligible = this.isScalarJournalEligible(fn);
      // CashToken-container transfers are transaction effects rather than
      // value-like state: their authenticated input/output slots and transfer
      // occurrence indices belong to the physical entry point. Until an
      // independently verified effect journal exists, inline these helpers so
      // every operation remains visible to the ordinary sequential covenant
      // pre-scan. This is Release 3's sound, non-aggregating token path.
      const hasTokenContainerEffects = this.hasTokenContainerEffects(fn);
      const hasPhysicalEffects = this.hasPhysicalEffects(fn);
      if (fn.body && fn.returnTypes.length === 0
        && (this.hasStoragePointerParam(fn)
          || (this.isInternalHelper(fn) && !valueReferenced.has(fn.name)
            && (this.readsEntry(fn) || (this.touchesScalarState(fn) && !scalarJournalEligible)
              || hasTokenContainerEffects
              || hasPhysicalEffects
              || this.transitiveSortedWriters.has(fn.name)
              || (this.inlineSolidityInitializers && /^__.*_init(?:_unchained)?$/.test(fn.name)))))) {
        this.inlinedFns.add(fn.name);
      } else if (fn.body && fn.returnTypes.length === 0 && !this.isInternalHelper(fn)
        && !valueReferenced.has(fn.name)
        && (this.readsEntry(fn) || (this.touchesScalarState(fn) && !scalarJournalEligible)
          || hasPhysicalEffects
          || this.transitiveSortedWriters.has(fn.name))) {
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
          || this.keepsGraphEmissionBinding(fn) || valueReferenced.has(fn.name)) continue;
        let callsSelected = false;
        this.walk(fn.body, (candidate) => {
          if (candidate instanceof FunctionCallNode && this.inlinedFns.has(candidate.identifier.name)) {
            callsSelected = true;
          }
        });
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
    // Library free-functions (`Lib.fn`) taking a STRUCT storage pointer are inlined too, but ONLY struct ones:
    // array/mapping storage-pointer library fns (the `using Lib for T[]` path) have their own machinery a broad
    // inlining would wrongly intercept. Scoping to StructType keeps that path intact (SBE-23).
    for (const fn of this.freeFns) {
      if (fn.body && fn.returnTypes.length === 0 && this.hasStructStoragePointerParam(fn)) {
        this.inlinedFns.add(fn.name);
      }
    }
    // Value-returning single-`return` storage-pointer functions (contract or library, e.g. a `using L for
    // mapping` helper `at(mapping storage a, uint i) returns (uint) { return a[i]; }`) are inlined in expression
    // position: the call is replaced by the substituted return expression (`m.at(k)` -> `L.at(m, k)` -> `m[k]`).
    this.exprInlinableFns = new Map();
    for (const fn of [...node.functions, ...this.freeFns]) {
      if (this.isSingleReturnStoragePointerFn(fn)) this.exprInlinableFns.set(fn.name, fn);
    }
    if (this.inlinedFns.size === 0 && this.exprInlinableFns.size === 0) return node;

    // Inline calls in every function body AND the constructor/fallback/receive - a constructor calling an
    // inherited `_mint`-style entry-reading helper is the common ERC20 pattern, and the helper is dropped below.
    for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
      if (fn?.body) {
        fn.body.statements = this.inlineStatements(fn.body.statements ?? [], [inlineKey(fn.name, fn.parameters.length)]);
      }
    }
    // Expression-position inlining of value-returning storage-pointer calls (after the void statement inlining;
    // the two function sets are disjoint - void vs value-returning). Traverse via the visitor so a call in any
    // expression slot (`return f(..)`, `x = f(..)`, `f(..)[k]`) is replaced.
    if (this.exprInlinableFns.size > 0) {
      for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
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

  // A graph emission handler clone that must stay behind OP_INVOKE to keep its emission binding. Since X29 that
  // includes clones carrying an `emit` or a `transfer`: the route reserves their OUTPUT frames, one per dispatch
  // site, so leaving them subroutines no longer loses the effect. A token-container operation still needs a
  // co-spent INPUT slot, which no per-site output frame can express, so it stays excluded (refused above).
  private keepsGraphEmissionBinding(fn: FunctionDefinitionNode): boolean {
    if (!fn.graphEmissionHandler || this.hasTokenContainerEffects(fn) || this.hasStoragePointerParam(fn)) {
      return false;
    }
    // Effect-carrying clones are kept ONLY when they have an outgoing edge, which is the whole defect surface:
    // an edge is what a transcript can misstate. `graphTailHandlers` also admits an edge-free handler that
    // merely reads msg.value or msg.sender (Release 4's value batch is exactly that), and flattening one loses
    // nothing while un-flattening it moves its transfer covenant behind OP_INVOKE - measured to break the SDK's
    // auto-derivation of the transfer outputs. Keep every edge-free clone on the established path.
    return !this.hasPhysicalEffects(fn) || this.hasOutgoingCall(fn);
  }

  // An outgoing external edge, in the pre-semantic shapes this pass sees: `IFoo(a).m()` is a MethodCall until
  // LowerExternalCalls runs, and `a.call/staticcall/delegatecall(..)` is either a LowLevelCall or a dotted
  // FunctionCall. Mirrors the `methodCallCount` test compiler.ts applies at route synthesis.
  private hasOutgoingCall(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (node) => {
      if (found) return;
      if (node instanceof MethodCallNode || node instanceof LowLevelCallNode
        || node instanceof LowLevelCallStatementNode) found = true;
      else if (node instanceof FunctionCallNode
        && /\.(call|staticcall|delegatecall)$/.test(node.identifier?.name ?? '')) found = true;
    });
    return found;
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
    this.walk(fn.body, (candidate) => {
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
    });
    return !unsupported && this.writesScalarState(fn);
  }

  private writesScalarState(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body!, (candidate) => {
      if ((candidate instanceof StateAssignNode || candidate instanceof DeleteStateNode)
        && this.stateVarNames.has(candidate.name)) found = true;
    });
    return found;
  }

  // Names referenced as VALUES: an IdentifierNode occurrence that is not the identifier of a plain call.
  // Such a function is used as a function pointer and must stay a real (subroutine) definition.
  private collectValueReferencedNames(node: ContractNode): Set<string> {
    const callIdentifiers = new Set<Node>();
    const referenced = new Set<string>();
    const bodies = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef];
    for (const fn of bodies) {
      if (!fn?.body) continue;
      this.walk(fn.body, (n) => {
        if (n instanceof FunctionCallNode && n.identifier) callIdentifiers.add(n.identifier);
      });
      this.walk(fn.body, (n) => {
        if (n instanceof IdentifierNode && !callIdentifiers.has(n)) referenced.add(n.name);
      });
    }
    return referenced;
  }

  // Reads or writes a plain (scalar) state variable: a `this.x` access/assign OF A DECLARED STATE VAR (a
  // bare `s.x = v` on a named return desugars to a state-assign node that SymbolTable later resolves
  // contextually - the name gate keeps those out), or a bare identifier read/assign of a state-var name
  // that is NOT shadowed by a param/local (a shadowed match would alpha-rename-break the clone).
  private touchesScalarState(fn: FunctionDefinitionNode): boolean {
    const shadowed = new Set(fn.parameters.map((p) => p.name));
    this.walk(fn.body, (n) => { if (n instanceof VariableDefinitionNode) shadowed.add(n.name); });
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if ((n instanceof StateAccessNode || n instanceof StateAssignNode) && this.stateVarNames.has(n.name)) {
        found = true;
      } else if (n instanceof IdentifierNode && this.stateVarNames.has(n.name) && !shadowed.has(n.name)) {
        found = true;
      } else if (n instanceof AssignNode && this.stateVarNames.has(n.identifier.name)
        && !shadowed.has(n.identifier.name)) {
        found = true;
      }
    });
    return found;
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
    return stmts.length === 1 && stmts[0] instanceof ReturnNode && stmts[0].expressions.length === 1;
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
      if (this.ambiguousInlineKeys.has(inlineKey(callee.name, callee.parameters.length))) {
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
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      if (n instanceof MappingAccessNode && this.collectionNames.has(n.name)) found = true;
      else if (n instanceof ArrayAccessNode && n.array instanceof IdentifierNode
        && this.collectionNames.has(n.array.name)) found = true;
    });
    return found;
  }

  // A function DIRECTLY writes a sorted (C2) mapping entry: a MappingAssign/Field/Delete or single-key ArrayAssign
  // on a sorted collection. A C2 write co-spends the sorted-list entry slots (block layout), which only an entry
  // point has, so a void helper doing it cannot be an OP_INVOKE subroutine (the plain-entry-model write is fine).
  private directlyWritesSortedEntry(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (n) => {
      if (found) return;
      // A single-key mapping write `m[k] = v` is an ArrayAssignNode; nested / struct-field / delete forms are
      // MappingAssign / MappingFieldAssign / MappingDelete. All co-spend the sorted entry when the collection is C2.
      if ((n instanceof ArrayAssignNode || n instanceof MappingAssignNode || n instanceof MappingFieldAssignNode
        || n instanceof MappingDeleteNode) && this.sortedCollectionNames.has(n.name)) found = true;
    });
    return found;
  }

  private hasTokenContainerEffects(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (node) => {
      if (node instanceof TokenContainerMethodStatementNode) found = true;
    });
    return found;
  }

  private hasPhysicalEffects(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (node) => {
      if (node instanceof EmitStatementNode || node instanceof TransferStatementNode
        || node instanceof TokenContainerMethodStatementNode) found = true;
    });
    return found;
  }

  // The set of contract functions that DIRECTLY or TRANSITIVELY require an entry-point layout. A caller of a
  // state-touching helper becomes state-touching after that helper is inlined, so selecting only direct readers
  // leaves wrapper chains such as OZ ERC20 `_transfer -> _update -> _balances[...]` as layout-less subroutines.
  // Compute the full fixpoint before rewriting any bodies.
  private computeTransitiveSortedWriters(fns: FunctionDefinitionNode[]): Set<string> {
    const names = new Set(fns.map((f) => f.name));
    const calleesOf = (f: FunctionDefinitionNode): Set<string> => {
      const out = new Set<string>();
      this.walk(f.body, (n) => {
        if (n instanceof FunctionCallNode && n.identifier && names.has(n.identifier.name)) out.add(n.identifier.name);
      });
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
        const callee = this.funcByKey.get(key) ?? this.funcByName.get(name);
        if (callee) this.reorderNamedTail(stmt.call, callee);
        if (callee && this.inlinedFns.has(name) && !stack.includes(inlineKey(name, callee.parameters.length))
          && stmt.call.parameters.length === callee.parameters.length) {
          if (this.ambiguousInlineKeys.has(inlineKey(name, stmt.call.parameters.length))) {
            throw new AmbiguousInlineOverloadError(stmt.call, name, stmt.call.parameters.length);
          }
          out.push(...this.inlineCall(callee, stmt.call.parameters, stack));
          continue;
        }
      }
      out.push(stmt);
    }
    return out;
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

  // Produce [value-param-binding decls..., renamed+substituted body...] for one inlined call site.
  private inlineCall(callee: FunctionDefinitionNode, args: Node[], stack: string[]): StatementNode[] {
    const n = this.counter++;
    const cloned = cloneNode(callee) as FunctionDefinitionNode;

    const rename = new Map<string, string>();
    const subs = new Map<string, ExpressionNode>();
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
        } else if (arg instanceof IdentifierNode) {
          // A bare state-var argument is aliased by NAME (covers reads and writes, incl. mapping-assign
          // targets whose container is a string field).
          rename.set(p.name, arg.name);
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
      } else {
        rename.set(p.name, `${PREFIX}${n}_${p.name}`);
      }
    });
    this.walk(cloned.body, (node) => {
      if (node instanceof VariableDefinitionNode && !rename.has(node.name) && !subs.has(node.name)) {
        rename.set(node.name, `${PREFIX}${n}_${node.name}`);
      }
    });
    // Rename value params/locals first (storage-param refs are untouched), then substitute storage
    // params with their (un-renamed) argument expressions.
    this.applyRename(cloned.body, rename);
    substituteInFunction(cloned, subs);
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
    return [...bindings, ...rmwPrologue, ...inlined, ...rmwEpilogue];
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
    this.walk(root, (n) => {
      if (n instanceof IdentifierNode) {
        n.name = rn(n.name);
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
    });
  }

  // Pre-order walk over child Nodes (and Node arrays); skips Type/symbol-table fields.
  private walk(node: Node | undefined, visit: (n: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) this.walk(v, visit);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) this.walk(it, visit);
    }
  }
}
