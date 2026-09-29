import {
  Node,
  ExpressionNode,
  SourceFileNode,
  ContractNode,
  FunctionDefinitionNode,
  BlockNode,
  StatementNode,
  WhileNode,
  VariableDefinitionNode,
  IntLiteralNode,
  IdentifierNode,
  BinaryOpNode,
  UnaryOpNode,
  AssignNode,
  ArrayAssignNode,
  ArrayPushNode,
  ArrayPopNode,
  DeleteLocalNode,
  MappingAssignNode,
  MappingFieldAssignNode,
  MappingDeleteNode,
  TupleAssignmentNode,
  BreakNode,
  ContinueNode,
  ReturnNode,
  FunctionCallNode,
  IndirectCallNode,
  MethodCallNode,
  InstantiationNode,
  NewArrayNode,
  CollectionIterationNode,
  ArrayAccessNode,
  CastNode,
  StateAccessNode,
  BranchNode,
  BoolLiteralNode,
} from '../ast/AST.js';
import { GlobalFunction } from '../ast/Globals.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import { MappingType, ArrayType, Type } from '@solidcash/utils';
import { cloneNode } from '../ast/clone.js';
import AstTraversal from '../ast/AstTraversal.js';
import { PointerTableExpansionMap, recordPointerTableExpansion } from './PointerTableBound.js';

const MAX_UNROLL = 64;

/**
 * Unrolls a FIXED-BOUND C-style for-loop whose body writes an entry-backed mapping into N STATIC copies with the
 * loop variable substituted by each constant. `for (uint i = C0; i < CN; i += S) m[k[i]] = v[i]` (C0/CN/S all
 * compile-time constants, CN an int literal or a fixed-array `.length`) becomes `m[k[C0]] = v[C0]; m[k[C0+S]] = ...`
 * - which the existing per-slot machinery already compiles soundly (a mapping write in a RUNTIME loop is rejected
 * by EntryWriteInLoopError, because one fixed entry slot can't hold N runtime entries). Distinct constant-index
 * keys get distinct entry slots, so the unrolled form is equivalent to hand-written static writes.
 *
 * Restricted to be sound: only fires when the body contains a mapping write, a keccak256 call, a contract
 * instantiation, or an indirect external function-pointer call (else unrolling is needless). A break/continue is
 * admitted only when substituting each fixed induction value makes every reached escape decision static; returns
 * and runtime-selected escapes remain rolled. Also requires
 * N <= MAX_UNROLL (avoid code blow-up). Runs before break/continue expansion + SymbolTableTraversal so the static
 * writes / keccak calls get their slots. A fixed-bound keccak256 loop unrolls to N syntactic calls (N compute
 * side-cars, each resolved by the complex-arg probe); a runtime-bound keccak loop stays flagged keccakInLoop.
 */
export default class UnrollFixedBoundEntryLoop extends AstTraversal {
  private mappingNames = new Set<string>();
  private contractNames = new Set<string>();
  private varTypes = new Map<string, Type>();
  private stateVarTypes = new Map<string, Type>();
  private collectionTypes = new Map<string, Type>();
  // Locals initialized to a `new T[](N)` literal (N compile-time), for folding `local.length`. Populated
  // post-inline when a literal array argument binds to an inline local, so the local's `.length` bound is
  // constant. Only names
  // NOT in mutatedNames (never reassigned / pushed / popped anywhere in the fn) are tracked, so the recorded
  // size always holds - the length can't change out from under the fold.
  private newArrayLocalSizes = new Map<string, bigint>();
  private mutatedNames = new Set<string>(); // names ever reassigned / push / pop / element-written in the fn

  private currentFunction = '';
  private currentFunctionNode?: FunctionDefinitionNode;
  private currentGraphRuntime = false;

  constructor(
    private readonly indirectCallsOnly = false,
    private readonly expansions?: PointerTableExpansionMap,
    private readonly fixedCollectionIterations = false,
  ) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    this.contractNames = new Set([node.contract.name, ...node.importedContracts.map((contract) => contract.name)]);
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((c) => this.visit(c) as ContractNode);
    node.freeFunctions = node.freeFunctions.map((f) => this.visit(f) as FunctionDefinitionNode);
    return node;
  }

  visitContract(node: ContractNode): Node {
    const prev = this.mappingNames;
    // Mappings are modelled as collections (entry-backed state); a mapping-typed state var also carries the type.
    this.mappingNames = new Set([
      ...node.collections.map((c) => c.name),
      ...node.stateVariables.filter((sv) => sv.type instanceof MappingType).map((sv) => sv.name),
    ]);
    const prevState = this.stateVarTypes;
    this.stateVarTypes = new Map(node.stateVariables.map((sv) => [sv.name, sv.type]));
    const prevCollections = this.collectionTypes;
    this.collectionTypes = new Map(node.collections.map((collection) => [collection.name, collection.type]));
    node.functions = node.functions.map((f) => this.visit(f) as FunctionDefinitionNode);
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    this.mappingNames = prev;
    this.stateVarTypes = prevState;
    this.collectionTypes = prevCollections;
    return node;
  }

  /**
   * A native entry-backed fixed array has a compiler-owned cardinality and identities: `T[N]` is exactly the
   * entry set 0..N-1. In message-bus mode, expand its collection iteration to the same static indexed reads a
   * user could write by hand. The ordinary entry-slot machinery then authenticates the exact count, source
   * order, and every index identity. Enumerable mappings and dynamic arrays deliberately retain their runtime
   * CollectionIterationNode and the route's named fail-closed refusal.
   *
   * MAX_UNROLL is also the existing fixed-resource expansion ceiling. Leaving a larger fixed array rolled makes
   * it hit `collection-iteration-handler-not-enabled`, rather than manufacturing a route beyond that ceiling.
   */
  visitCollectionIteration(node: CollectionIterationNode): Node {
    if (!this.fixedCollectionIterations) return super.visitCollectionIteration(node);
    const type = this.collectionTypes.get(node.collectionName);
    if (!(type instanceof ArrayType) || type.bound === undefined || type.bound > MAX_UNROLL) {
      return super.visitCollectionIteration(node);
    }

    const iterations: StatementNode[] = [];
    for (let index = 0; index < type.bound; index++) {
      const statements: StatementNode[] = [];
      if (node.keyName && node.keyType) {
        const key = new VariableDefinitionNode(
          node.keyType, [], node.keyName, new IntLiteralNode(BigInt(index)),
        );
        key.location = node.location;
        statements.push(key);
      }
      if (node.valueName && node.valueType) {
        const access = new ArrayAccessNode(
          new IdentifierNode(node.collectionName), new IntLiteralNode(BigInt(index)),
        );
        access.location = node.location;
        const value = new VariableDefinitionNode(node.valueType, [], node.valueName, access);
        value.location = node.location;
        statements.push(value);
      }
      statements.push(...(cloneNode(node.body).statements ?? []));
      const block = new BlockNode(statements);
      block.location = node.body.location;
      iterations.push(this.visit(block) as StatementNode);
    }
    const expanded = new BlockNode(iterations);
    expanded.location = node.location;
    return expanded;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const prevName = this.currentFunction;
    const prevNode = this.currentFunctionNode;
    const prevGraphRuntime = this.currentGraphRuntime;
    this.currentFunction = node.name;
    this.currentFunctionNode = node;
    this.currentGraphRuntime = node.graphRuntimeEmissionHandler === true;
    const mutationScan = this.collectMutatedNames(node.body);
    // Graph-mode unrolling only expands pointer-table loops. Skip every other function so a contract with one
    // graph edge does not try-unroll every sibling handler that merely contains a C-style loop.
    if ((this.indirectCallsOnly && !mutationScan.hasIndirectCall) || !mutationScan.hasCandidateLoop) {
      this.currentFunction = prevName;
      this.currentFunctionNode = prevNode;
      this.currentGraphRuntime = prevGraphRuntime;
      return node;
    }
    const prev = this.varTypes;
    this.varTypes = new Map(prev);
    const prevNewArr = this.newArrayLocalSizes;
    this.newArrayLocalSizes = new Map();
    const prevMutated = this.mutatedNames;
    this.mutatedNames = mutationScan.names;
    for (const p of node.parameters) this.varTypes.set(p.name, p.type);
    node.body = this.visit(node.body) as BlockNode;
    this.varTypes = prev;
    this.newArrayLocalSizes = prevNewArr;
    this.mutatedNames = prevMutated;
    this.currentFunction = prevName;
    this.currentFunctionNode = prevNode;
    this.currentGraphRuntime = prevGraphRuntime;
    return node;
  }

  // Every local name whose array LENGTH could change anywhere in the fn body: a reassignment (AssignNode), a
  // push / pop (ArrayPushNode / ArrayPopNode), or a whole-array delete (DeleteLocalNode = `delete arr`, resets to
  // empty). A `new T[](N)` binding is only trusted for the length fold if its name is NOT here, so the recorded
  // size can never be stale (sound regardless of control flow / scoping). Length-PRESERVING ops are deliberately
  // excluded so they don't over-block the fold: an element write `arr[i]=v` (ArrayAssignNode) and an element
  // delete `delete arr[i]` (ArrayDeleteNode) keep the length, so `new T[](1); a[0]=v;` stays foldable.
  private collectMutatedNames(body: Node | undefined): {
    names: Set<string>; hasCandidateLoop: boolean; hasIndirectCall: boolean;
  } {
    const names = new Set<string>();
    let hasCandidateLoop = false;
    let hasIndirectCall = false;
    const walk = (n: Node | undefined): void => {
      if (!n) return;
      if (n instanceof WhileNode || (this.fixedCollectionIterations && n instanceof CollectionIterationNode)) {
        hasCandidateLoop = true;
      }
      if (n instanceof IndirectCallNode
        || (n instanceof MethodCallNode && (n.selectorArrayVar !== undefined || n.pointerTableBroadcast))) {
        hasIndirectCall = true;
      }
      if (n instanceof AssignNode && n.identifier instanceof IdentifierNode) names.add(n.identifier.name);
      // A tuple assignment rebinds every non-skip slot. `(a, b) = (b, a)` swaps whole array values, so a
      // `new T[](N)` size recorded for `a` would otherwise stay trusted while `a` now holds b's array.
      if (n instanceof TupleAssignmentNode) {
        for (const element of n.elements) if (!element.skip && element.name) names.add(element.name);
      }
      if (n instanceof ArrayPushNode || n instanceof ArrayPopNode) names.add(n.name);
      if (n instanceof DeleteLocalNode) names.add(n.identifier.name);
      for (const key in n) {
        if (key === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) walk(e);
      }
    };
    walk(body);
    return { names, hasCandidateLoop, hasIndirectCall };
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    const stmts = node.statements ?? [];
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      if (s instanceof VariableDefinitionNode) {
        this.varTypes.set(s.name, s.type);
        // Track a `local = new T[](N literal)` binding (or a copy of one) for the length fold - but only if the
        // local is never mutated in the fn (mutatedNames), so its length is provably the recorded N.
        if (!this.mutatedNames.has(s.name)) {
          if (s.expression instanceof NewArrayNode && s.expression.size instanceof IntLiteralNode) {
            this.newArrayLocalSizes.set(s.name, s.expression.size.value);
          } else if (s.expression instanceof IdentifierNode && this.newArrayLocalSizes.has(s.expression.name)) {
            this.newArrayLocalSizes.set(s.name, this.newArrayLocalSizes.get(s.expression.name)!);
          }
        }
      }
      // The AstBuilder desugars `for` into a flattened `{ init; while }`: a loop-variable definition immediately
      // followed by its while (marked forLoopUpdateCount for the trailing update statement).
      if (s instanceof VariableDefinitionNode && s.isLoopVariable
        && i + 1 < stmts.length && stmts[i + 1] instanceof WhileNode
        && (stmts[i + 1] as WhileNode).forLoopUpdateCount > 0) {
        const unrolled = this.tryUnroll(s, stmts[i + 1] as WhileNode);
        if (unrolled) {
          out.push(...unrolled);
          i += 1; // consume the while
          continue;
        }
      }
      out.push(this.visit(s) as StatementNode);
    }
    node.statements = out;
    return node;
  }


  private tryUnroll(init: VariableDefinitionNode, w: WhileNode): StatementNode[] | undefined {
    const varName = init.name;
    if (!(init.expression instanceof IntLiteralNode)) return undefined;
    const c0 = init.expression.value;

    // Condition: `i < CN` or `i <= CN`, CN a compile-time constant.
    const cond = w.condition;
    if (!(cond instanceof BinaryOpNode)) return undefined;
    if (cond.operator !== BinaryOperator.LT && cond.operator !== BinaryOperator.LE) return undefined;
    if (!(cond.left instanceof IdentifierNode && cond.left.name === varName)) return undefined;
    const cn = this.evalBound(cond.right);
    if (cn === undefined) return undefined;
    const inclusive = cond.operator === BinaryOperator.LE;

    // Update: the trailing forLoopUpdateCount statements, expected exactly `i = i + STEP`.
    const k = w.forLoopUpdateCount;
    const all = w.block.statements ?? [];
    if (k >= all.length) return undefined;
    const bodyStmts = all.slice(0, all.length - k);
    const step = this.evalStep(all.slice(all.length - k), varName);
    if (step === undefined || step <= 0n) return undefined;

    // Enumerate the iteration values; bail if unbounded or larger than MAX_UNROLL.
    const values: bigint[] = [];
    for (let v = c0; inclusive ? v <= cn : v < cn; v += step) {
      values.push(v);
      if (values.length > MAX_UNROLL) return undefined;
    }

    // A provably-EMPTY loop (0 iterations, e.g. `for(i < (new T[](0)).length)` after an inline binds an empty
    // array arg) is DEAD CODE: drop it entirely. The body never runs, so anything in it (a vmap sorted-mapping
    // write, an external call) is unreachable - sound regardless of body content or control flow.
    if (values.length === 0) return [];
    // Fixed loops visible before route synthesis have already been expanded. A non-empty loop which becomes
    // literal only after helper inlining must remain rolled in a runtime graph clone: its authenticated dynamic
    // collection/emission journals own the reached rows. Unrolling here would manufacture fixed entry slots
    // which belong only to the unused direct source body. Empty loops above are still erased as dead code.
    if (this.currentGraphRuntime) return undefined;

    // This pass runs both before route admission and again after break/continue normalization. Remember a
    // source escape on the loop itself: the normalization necessarily replaces the raw ContinueNode/BreakNode,
    // but that must not make a later pass mistake the rewritten loop for an exactly-repeatable resource set.
    if (w.fixedUnrollForbidden) return undefined;

    // Only unroll a NON-empty loop whose body writes a mapping, calls keccak256, or deploys a child (else
    // needless). A child deployment has the same fixed-resource requirement as a mapping write: each exact
    // iteration owns an independent genesis input/output span and must therefore become an ordinary syntactic
    // site before message-bus admission assigns site and transfer ordinals. A keccak256 in
    // a runtime loop needs one compute side-car per RUNTIME call, but the block layout allocates one per SYNTACTIC
    // call; unrolling a fixed-bound loop turns the N runtime calls into N syntactic calls (each an independent
    // slot, resolved by the complex-arg probe). Static break/continue replay below preserves their source target;
    // returns and runtime-selected escapes remain rolled.
    // A function-pointer loop is ONLY an unroll trigger in indirectCallsOnly (message-bus route) mode.
    // Outside it, `fns[i](v)` in a loop is the ordinary broadcast idiom: its covenant reads and verifies the
    // WHOLE table from one index-independent receiver, and unrolling it into N single-element callsites changes
    // the direct ABI (per-element selector and master-index witnesses) that shipped broadcast callers use.
    const hasIndirectCall = this.hasIndirectCall(bodyStmts);
    const hasMappingWrite = this.hasMappingWrite(bodyStmts);
    const readsFixedLocalArray = hasMappingWrite && this.anyNode(bodyStmts, (node) => {
      if (!(node instanceof ArrayAssignNode || node instanceof MappingAssignNode
        || node instanceof MappingFieldAssignNode || node instanceof MappingDeleteNode)
        || !this.mappingNames.has(node.name)) return false;
      const keys = node instanceof ArrayAssignNode ? [node.index] : node.keys;
      return keys.some((key) => this.anyNode([key], (part) =>
        part instanceof ArrayAccessNode && part.array instanceof IdentifierNode
        && this.newArrayLocalSizes.has(part.array.name)));
    });
    if (this.indirectCallsOnly ? !hasIndirectCall
      : (!hasMappingWrite && !this.hasKeccakCall(bodyStmts)
        && !this.hasChildDeployment(bodyStmts))) return undefined;
    const hasSourceEscape = this.hasControlFlowEscape(bodyStmts);
    // A pointer-table dispatch loop with a FIXED literal trip count reaches exactly `values.length` rows. Record
    // that ceiling so the artifact can publish one bounded loop callsite instead of N indistinguishable rows.
    if (hasIndirectCall
      && this.countNodes(bodyStmts, (n) => n instanceof IndirectCallNode
        || (n instanceof MethodCallNode && (n.selectorArrayVar !== undefined || n.pointerTableBroadcast))) === 1) {
      recordPointerTableExpansion(
        this.expansions, this.currentFunction, { count: values.length, guarded: false },
      );
    }

    // Each iteration is wrapped in its own block so body-local declarations (`address user = ...`) don't collide
    // across the N copies (Solidity block scoping). A single iteration is inlined into the enclosing block so
    // message-bus admission still sees a top-level mapping write (computed-key journal).
    const result: StatementNode[] = [];
    for (const v of values) {
      const iterStmts: StatementNode[] = [];
      for (const st of bodyStmts) {
        const clone = cloneNode(st);
        this.substituteVar(clone, varName, v);
        iterStmts.push(clone);
      }
      const replay = hasSourceEscape ? this.replayStaticEscapes(iterStmts) : {
        statements: iterStmts, escape: undefined,
      };
      if (!replay) {
        w.fixedUnrollForbidden = true;
        return undefined;
      }
      if (values.length === 1) {
        for (const st of replay.statements) result.push(this.visit(st) as StatementNode);
      } else {
        const block = new BlockNode(replay.statements);
        block.location = w.block.location;
        result.push(this.visit(block) as StatementNode);
      }
      if (replay.escape === 'break') break;
    }
    if (readsFixedLocalArray && this.currentFunctionNode) {
      this.currentFunctionNode.messageBusUnprovenFixedLocalMappingKey = true;
    }
    return result;
  }

  /**
   * Execute only loop-control decisions which became compile-time booleans after substituting the fixed
   * induction value. Statements before an escape remain in source order; continue drops the rest of this
   * iteration and break also drops every later iteration. Any runtime-selected escape fails closed.
   */
  private replayStaticEscapes(
    statements: readonly StatementNode[],
  ): { statements: StatementNode[]; escape?: 'break' | 'continue' } | undefined {
    const output: StatementNode[] = [];
    for (const statement of statements) {
      if (statement instanceof ReturnNode) return undefined;
      if (statement instanceof BreakNode) return { statements: output, escape: 'break' };
      if (statement instanceof ContinueNode) return { statements: output, escape: 'continue' };
      if (statement instanceof BlockNode) {
        const nested = this.replayStaticEscapes(statement.statements ?? []);
        if (!nested) return undefined;
        const block = new BlockNode(nested.statements);
        block.location = statement.location;
        output.push(block);
        if (nested.escape) return { statements: output, escape: nested.escape };
        continue;
      }
      if (statement instanceof BranchNode && this.hasControlFlowEscape([statement])) {
        const condition = this.staticValue(statement.condition);
        if (typeof condition !== 'boolean') return undefined;
        const selected = condition ? statement.ifBlock : statement.elseBlock;
        if (!selected) continue;
        const nested = this.replayStaticEscapes(selected.statements ?? []);
        if (!nested) return undefined;
        const block = new BlockNode(nested.statements);
        block.location = selected.location;
        output.push(block);
        if (nested.escape) return { statements: output, escape: nested.escape };
        continue;
      }
      // A switch break, nested-loop escape, or any other unmodelled abrupt construct is not an outer-loop
      // decision. Retaining it during unrolling would change its target, so leave the whole loop rolled.
      if (this.hasControlFlowEscape([statement])) return undefined;
      output.push(statement);
    }
    return { statements: output };
  }

  private staticValue(node: ExpressionNode): bigint | boolean | undefined {
    if (node instanceof IntLiteralNode || node instanceof BoolLiteralNode) return node.value;
    if (node instanceof UnaryOpNode) {
      const value = this.staticValue(node.expression);
      if (node.operator === UnaryOperator.NOT && typeof value === 'boolean') return !value;
      return undefined;
    }
    if (!(node instanceof BinaryOpNode)) return undefined;
    const left = this.staticValue(node.left);
    const right = this.staticValue(node.right);
    if (left === undefined || right === undefined) return undefined;
    if (typeof left === 'boolean' && typeof right === 'boolean') {
      if (node.operator === BinaryOperator.AND) return left && right;
      if (node.operator === BinaryOperator.OR) return left || right;
      if (node.operator === BinaryOperator.EQ) return left === right;
      if (node.operator === BinaryOperator.NE) return left !== right;
      return undefined;
    }
    if (typeof left !== 'bigint' || typeof right !== 'bigint') return undefined;
    // Modulo by a non-zero literal cannot overflow. Other arithmetic and casts are deliberately not folded:
    // this pre-semantic pass has no checked-width authority, so bigint evaluation could disagree with source.
    if (node.operator === BinaryOperator.MOD) return right === 0n ? undefined : left % right;
    if (node.operator === BinaryOperator.EQ) return left === right;
    if (node.operator === BinaryOperator.NE) return left !== right;
    if (node.operator === BinaryOperator.LT) return left < right;
    if (node.operator === BinaryOperator.LE) return left <= right;
    if (node.operator === BinaryOperator.GT) return left > right;
    if (node.operator === BinaryOperator.GE) return left >= right;
    return undefined;
  }

  // A compile-time-constant loop bound: an int literal, `fixedArray.length` (a declared ArrayType with a bound),
  // or `(new T[](N)).length` with N an int literal. The last only appears AFTER inlining substitutes a
  // `new T[](N)` literal for an array parameter; N==0 unrolls
  // to ZERO iterations, eliminating a provably-dead loop whose body would otherwise reach codegen (e.g. a vmap
  // sorted mapping write over an empty array). This is why the pass is run a second time, post-inline.
  private evalBound(expr: Node): bigint | undefined {
    if (expr instanceof CastNode) return this.evalBound(expr.expression);
    if (expr instanceof IntLiteralNode) return expr.value;
    if (expr instanceof UnaryOpNode && expr.operator === UnaryOperator.SIZE) {
      if (expr.expression instanceof IdentifierNode) {
        const local = this.newArrayLocalSizes.get(expr.expression.name);
        if (local !== undefined) return local;
        const t = this.varTypes.get(expr.expression.name) ?? this.stateVarTypes.get(expr.expression.name)
          ?? this.collectionTypes.get(expr.expression.name);
        if (t instanceof ArrayType && t.bound !== undefined) return BigInt(t.bound);
      }
      if (expr.expression instanceof StateAccessNode) {
        const t = this.stateVarTypes.get(expr.expression.name);
        if (t instanceof ArrayType && t.bound !== undefined) return BigInt(t.bound);
      }
      if (expr.expression instanceof NewArrayNode && expr.expression.size instanceof IntLiteralNode) {
        return expr.expression.size.value;
      }
    }
    return undefined;
  }

  // Constant step from `i = i + STEP` (the desugared form of `i++` / `i += STEP`).
  private evalStep(post: StatementNode[], varName: string): bigint | undefined {
    if (post.length !== 1) return undefined;
    const p = post[0];
    if (!(p instanceof AssignNode)) return undefined;
    if (!(p.identifier instanceof IdentifierNode && p.identifier.name === varName)) return undefined;
    const e = p.expression;
    if (!(e instanceof BinaryOpNode && e.operator === BinaryOperator.PLUS)) return undefined;
    if (e.left instanceof IdentifierNode && e.left.name === varName && e.right instanceof IntLiteralNode) {
      return e.right.value;
    }
    if (e.right instanceof IdentifierNode && e.right.name === varName && e.left instanceof IntLiteralNode) {
      return e.left.value;
    }
    return undefined;
  }

  private hasMappingWrite(stmts: Node[]): boolean {
    // A single-key mapping write `m[k]=v` is an ArrayAssignNode; a nested / multi-key write `m[a][b]=v`, a
    // struct-field write `m[k].f=v`, or a `delete m[k]` are Mapping{Assign,FieldAssign,
    // Delete}Node. All must count so a fixed-bound loop writing one gets unrolled (else it falls to the
    // runtime-loop vmap path unnecessarily).
    return this.anyNode(stmts, (n) => (
      (n instanceof ArrayAssignNode || n instanceof MappingAssignNode
        || n instanceof MappingFieldAssignNode || n instanceof MappingDeleteNode)
      && this.mappingNames.has(n.name)));
  }

  private hasKeccakCall(stmts: Node[]): boolean {
    return this.anyNode(stmts, (n) => n instanceof FunctionCallNode && n.identifier.name === GlobalFunction.KECCAK256);
  }

  private hasChildDeployment(stmts: Node[]): boolean {
    return this.anyNode(stmts, (n) => n instanceof InstantiationNode
      && this.contractNames.has(n.identifier.name));
  }

  private hasIndirectCall(stmts: Node[]): boolean {
    return this.anyNode(stmts, (n) => n instanceof IndirectCallNode
      || (n instanceof MethodCallNode && (n.selectorArrayVar !== undefined || n.pointerTableBroadcast)));
  }

  private hasControlFlowEscape(stmts: Node[]): boolean {
    return this.anyNode(stmts, (n) => n instanceof BreakNode || n instanceof ContinueNode || n instanceof ReturnNode);
  }

  private countNodes(stmts: Node[], pred: (n: Node) => boolean): number {
    let found = 0;
    const walk = (n: Node): void => {
      if (!n) return;
      if (pred(n)) found += 1;
      for (const key in n) {
        if (key === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) walk(e);
      }
    };
    for (const s of stmts) walk(s);
    return found;
  }

  private anyNode(stmts: Node[], pred: (n: Node) => boolean): boolean {
    return this.countNodes(stmts, pred) > 0;
  }

  private substituteVar(node: Node, varName: string, value: bigint): void {
    const replace = (v: unknown): Node | undefined => {
      if (v instanceof IdentifierNode && v.name === varName) {
        const lit = new IntLiteralNode(value);
        lit.location = v.location;
        return lit;
      }
      return undefined;
    };
    if (node instanceof InstantiationNode && node.callOptions) {
      for (const option of ['value', 'gas', 'salt'] as const) {
        const expression = node.callOptions[option];
        if (!expression) continue;
        const replaced = replace(expression);
        if (replaced) node.callOptions[option] = replaced as typeof expression;
        else this.substituteVar(expression, varName, value);
      }
    }
    for (const key in node) {
      if (key === 'location' || key === 'callOptions') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      const rep = replace(v);
      if (rep) {
        (node as unknown as Record<string, unknown>)[key] = rep;
      } else if (v instanceof Node) {
        this.substituteVar(v, varName, value);
      } else if (Array.isArray(v)) {
        for (let j = 0; j < v.length; j++) {
          const r = replace(v[j]);
          if (r) v[j] = r;
          else if (v[j] instanceof Node) this.substituteVar(v[j], varName, value);
        }
      }
    }
  }
}
