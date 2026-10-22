import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  ExpressionNode,
  BranchNode,
  MappingDeleteNode,
  MappingAssignNode,
  MappingAccessNode,
  ArrayAssignNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayDeleteNode,
  TernaryOpNode,
  UnaryOpNode,
  FunctionCallNode,
  MethodCallNode,
  IndirectCallNode,
  ExternalFunctionCallNode,
  LowLevelCallNode,
  AddressSendExpressionNode,
  InstantiationNode,
  CollectionNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  IdentifierNode,
  IntLiteralNode,
  WhileNode,
  DoWhileNode,
} from '../ast/AST.js';
import {
  type Type, MappingType, ArrayType, StructType, PrimitiveType, isChunkableValueType,
} from '@solidcash/utils';
import { UnaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';
import { Location } from '../ast/Location.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import {
  kernelArgumentConditionActivation, kernelBooleanArgumentIndices, stableKernelArgumentIndices,
} from './KernelEntryActivation.js';

/** Semantic back-references, which are not executable children of the node that holds them. */
const BACK_REFERENCES = new Set(['type', 'symbolTable', 'location', 'resolvedFunction', 'functionReference',
  'definition', 'collection', 'stateVariable']);

// A conditional mapping op normalized to its target + taken-path value.
interface EntryOp {
  name: string;
  keys: ExpressionNode[];
  takenValue: ExpressionNode;
  loc: Location;
  /** Scope in which the source write legally accessed an inherited private collection. */
  sourceScope?: string;
}

// A scalar target seen across an if/else's two arms: its op in each arm (absent = preserve the current value).
interface MergedTarget {
  name: string;
  keys: ExpressionNode[];
  loc: Location;
  sourceScope?: string;
  ifOp?: EntryOp;
  elseOp?: EntryOp;
}

/** A direct single-target batch can settle its skipped write by the compiler's runtime activity flag. */
class EntryMutationCounts extends AstTraversal {
  readonly counts = new Map<string, number>();

  visitMappingAssign(node: MappingAssignNode): Node {
    this.counts.set(node.name, (this.counts.get(node.name) ?? 0) + 1);
    return super.visitMappingAssign(node);
  }

  visitMappingDelete(node: MappingDeleteNode): Node {
    this.counts.set(node.name, (this.counts.get(node.name) ?? 0) + 1);
    return super.visitMappingDelete(node);
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    this.counts.set(node.name, (this.counts.get(node.name) ?? 0) + 1);
    return super.visitArrayAssign(node);
  }
}

/**
 * If-conversion for a conditional mapping delete or write. A `delete m[k]` or `m[k] = v` inside an if/else branch
 * does not round-trip on the taken/not-taken paths: the covenant places no output constraint on a branch-touched
 * entry slot (it can't statically tell the op ran), so the SDK recreates the entry with its old value. Rewrite
 * the whole branch into unconditional predicated writes that read the current value on the not-taken path (a
 * delete is just a write of the type default):
 *
 * ```
 * if (cond) { delete m[k]; }   ->   m[k] = cond ? <default> : m[k];
 * if (cond) { m[k] = v; }      ->   m[k] = cond ? v         : m[k];
 * ```
 *
 * The result is an ordinary UNCONDITIONAL entry write of a conditionally-chosen value, which already round-trips
 * soundly (taken -> the written/default value; not-taken -> current value = preserved) with no conditional-entry
 * covenant machinery. Runs pre-semantic so SymbolTable/TypeCheck resolve and type the new nodes.
 *
 * Scoped to the sound, bounded shape: a branch with NO else whose body is only scalar mapping deletes/writes. A
 * single op is always safe (the condition runs once); multiple ops are converted only when the condition is
 * side-effect-free (no calls), since each predicated write re-evaluates it. A condition that reads a mapping an
 * earlier write mutates is hoisted to a bool local first. Anything else is left untouched. The early-return form
 * (remove()'s ops after a guard) is not handled here.
 *
 * An if/else branch whose arms are scalar entry ops plus trailing LOCAL array ops (a chunk-array push/pop
 * CacheDynamicArrayInLoop already lowered to a local) is also handled - the IterableMapping set() shape
 * `if(inserted[k]){values[k]=v}else{inserted[k]=true;values[k]=v;idx[k]=len;keys.push(k)}`. The condition is
 * hoisted to a bool local (evaluated once: the predicated writes mutate the mappings it reads), each scalar
 * target is predicated `m[k] = cond ? ifValue : elseValue` (a missing arm preserves the current value), and the
 * local array ops stay in a slimmed `if(cond)` / `if(!cond)` block (a stack-neutral local op works in a branch).
 * Result: all entry writes are unconditional (stable output count). The branch is kept as written when an arm writes
 * one target twice, or when the merged order runs two else writes out of source order and one may observe the other.
 * The kernel keeps replayable argument-guarded writes to distinct collections in their original arms, avoiding
 * creation of an absent entry on the untaken path.
 */
export default class IfConvertConditionalEntryOp extends AstTraversal {
  constructor(
    private readonly preserveKernelArgumentConditionalWrites = false,
    private readonly preserveDirectSingletonWrites = false,
  ) { super(); }

  // Mappings are CollectionNodes (node.collections), not stateVariables, pre-semantic.
  private mappings: Map<string, CollectionNode> = new Map();
  private stableArgumentIndices: ReadonlyMap<string, number> = new Map();
  private booleanArgumentIndices: ReadonlySet<number> = new Set();
  private singletonMutations: ReadonlySet<string> = new Set();

  // Names the hoisted condition locals uniquely per converted if/else branch.
  private condCounter = 0;
  private loopDepth = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.loopDepth = 0;
    this.mappings = new Map();
    for (const c of node.collections) {
      if (c.type instanceof MappingType) this.mappings.set(c.name, c);
    }
    for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
      if (fn?.body) this.visit(fn as FunctionDefinitionNode);
    }
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const previousIndices = this.stableArgumentIndices;
    const previousBooleanIndices = this.booleanArgumentIndices;
    const previousSingletons = this.singletonMutations;
    if (this.preserveDirectSingletonWrites) {
      const survey = new EntryMutationCounts();
      survey.visit(node.body);
      this.singletonMutations = new Set([...survey.counts].filter(([, count]) => count === 1).map(([name]) => name));
    }
    this.stableArgumentIndices = stableKernelArgumentIndices(node);
    this.booleanArgumentIndices = kernelBooleanArgumentIndices(node);
    const result = super.visitFunctionDefinition(node);
    this.stableArgumentIndices = previousIndices;
    this.booleanArgumentIndices = previousBooleanIndices;
    this.singletonMutations = previousSingletons;
    return result;
  }

  private isReplayableKernelCondition(expression: ExpressionNode): boolean {
    return kernelArgumentConditionActivation(
      expression, this.stableArgumentIndices, this.booleanArgumentIndices,
    ) !== undefined;
  }

  visitWhile(node: WhileNode): Node {
    node.condition = this.visit(node.condition) as ExpressionNode;
    this.loopDepth += 1;
    node.block = this.visit(node.block) as BlockNode;
    this.loopDepth -= 1;
    return node;
  }

  visitDoWhile(node: DoWhileNode): Node {
    this.loopDepth += 1;
    node.block = this.visit(node.block) as BlockNode;
    this.loopDepth -= 1;
    node.condition = this.visit(node.condition) as ExpressionNode;
    return node;
  }

  // Rewrite qualifying branches into predicated writes; recurse into nested blocks/branches otherwise.
  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const converted = stmt instanceof BranchNode ? this.tryConvertBranch(stmt) : undefined;
      if (converted) {
        out.push(...converted);
      } else {
        out.push(this.visit(stmt) as StatementNode);
      }
    }
    node.statements = out;
    return node;
  }

  // Returns the replacement statements if the branch is a convertible conditional entry op, else undefined.
  private tryConvertBranch(node: BranchNode): StatementNode[] | undefined {
    // Lazy collection-journal flushes encode physical handler reachability. Replacing one with
    // `m[k] = dirty ? pending : m[k]` is value-equivalent only for inline entries: a chunk-backed preserve arm
    // still emits and pins a fresh trailing chunk run. Keep the compiler-authored branch so inactive handlers
    // consume and produce no write-only resources.
    if (node.preserveConditionalEntryWrites) return undefined;
    // A vmap write whose key varies in a runtime loop has its own counter-indexed conditional output protocol.
    // Preserve the branch: predicating it into `cond ? value : old` would force an ordinary fixed-slot read for
    // the not-taken arm, but this entry deliberately has no fixed block slot.
    if (this.loopDepth > 0 && (node.ifBlock.statements ?? []).some((s) => {
      const op = this.entryOpInfo(s);
      return !!op && !!this.mappings.get(op.name)?.sorted;
    })) return undefined;
    if (node.elseBlock) {
      const ifStatements = node.ifBlock.statements ?? [];
      const elseStatements = node.elseBlock.statements ?? [];
      const ifWrite = ifStatements.length === 1 ? ifStatements[0] : undefined;
      const elseWrite = elseStatements.length === 1 ? elseStatements[0] : undefined;
      const ifTarget = ifWrite && this.entryOpInfo(ifWrite);
      const elseTarget = elseWrite && this.entryOpInfo(elseWrite);
      const ifSignature = ifTarget && this.targetSig(ifTarget.name, ifTarget.keys);
      const elseSignature = elseTarget && this.targetSig(elseTarget.name, elseTarget.keys);
      // Distinct mapping targets have independent entry slots. Preserve both guarded mutations when the kernel can
      // replay the branch from its row arguments; predicating either arm would mint a zero-valued phantom node.
      if (this.preserveKernelArgumentConditionalWrites && this.isReplayableKernelCondition(node.condition)
        && ifTarget !== undefined && elseTarget !== undefined
        && ifSignature !== undefined && elseSignature !== undefined && ifSignature !== elseSignature) return undefined;
      return this.tryConvertIfElse(node);
    }
    const stmts = node.ifBlock.statements ?? [];
    if (stmts.length === 0) return undefined;

    const ops: EntryOp[] = [];
    for (const s of stmts) {
      const op = this.entryOpInfo(s);
      if (!op) return undefined;
      ops.push(op);
    }

    // Predicating a skipped write to an absent sorted key inserts a zero-valued node, which changes enumerable
    // state. Keep a direct single-target source branch; its activity flag settles the predecessor unchanged.
    if (this.preserveDirectSingletonWrites && stmts.length === 1
      && (stmts[0] instanceof MappingAssignNode || stmts[0] instanceof ArrayAssignNode)
      && this.singletonMutations.has(ops[0].name) && this.mappings.has(ops[0].name)) {
      node.keepsGuardedEntryWrite = true;
      return undefined;
    }

    // The kernel can publish an argument-authenticated activation for this bounded conditional write. Keep the
    // source branch so a false row owns no mapping mutation; if-converting it would insert an enumerable zero
    // node for an absent key even though the source never executed the write.
    if (this.preserveKernelArgumentConditionalWrites && this.isReplayableKernelCondition(node.condition)
      && stmts.every((statement) => statement instanceof MappingAssignNode
        || statement instanceof ArrayAssignNode || statement instanceof MappingDeleteNode)) return undefined;

    // A single op re-uses the condition once (always safe); multiple require a side-effect-free condition.
    if (ops.length > 1 && this.hasCall(node.condition)) return undefined;
    // A re-evaluated condition that reads a mapping an earlier write mutates would see that write: evaluate it once.
    if (ops.slice(0, -1).some((op) => this.namesMapping(node.condition, op.name))) {
      const { def, ref } = this.hoistCondition(node);
      return [def, ...ops.map((op) => this.buildPredicatedWrite(op, ref()))];
    }

    return ops.map((op) => this.buildPredicatedWrite(op, node.condition));
  }

  // `bool __ifcond_N = <condition>;` and a reference to it, for predicated writes that mutate what the condition reads.
  private hoistCondition(node: BranchNode): { def: VariableDefinitionNode; ref: () => ExpressionNode } {
    const name = `__ifcond_${this.condCounter++}`;
    const def = new VariableDefinitionNode(PrimitiveType.BOOL, [], name, cloneNode(node.condition) as ExpressionNode);
    def.location = node.location;
    const ref = (): ExpressionNode => {
      const id = new IdentifierNode(name); id.location = node.location; return id;
    };
    return { def, ref };
  }

  // An if/else whose arms are scalar entry ops + trailing local array ops -> hoist the condition, predicate every
  // scalar target across both arms, keep the local array ops in slimmed conditionals. undefined = not this shape.
  private tryConvertIfElse(node: BranchNode): StatementNode[] | undefined {
    const ifArm = this.classifyArm(node.ifBlock.statements ?? []);
    const elseArm = this.classifyArm(node.elseBlock?.statements ?? []);
    if (!ifArm || !elseArm) return undefined;
    if (ifArm.entryOps.length === 0 && elseArm.entryOps.length === 0) return undefined; // nothing to predicate
    const targets = this.mergeTargets(ifArm.entryOps, elseArm.entryOps);
    if (!targets) return undefined; // a key we cannot match across arms, or a target one arm writes twice

    // Hoist the condition: the predicated writes below mutate the mappings the condition reads, so evaluate once.
    const { def: condDef, ref: condRef } = this.hoistCondition(node);
    const out: StatementNode[] = [condDef];

    // Predicate each scalar target: `m[k] = cond ? ifValue : elseValue`; a missing arm preserves the current value.
    for (const t of targets) {
      const ifVal = t.ifOp ? t.ifOp.takenValue : this.readAccess(t.name, t.keys, t.loc, t.sourceScope);
      const elseVal = t.elseOp ? t.elseOp.takenValue : this.readAccess(t.name, t.keys, t.loc, t.sourceScope);
      const ternary = new TernaryOpNode(condRef(), ifVal, elseVal);
      ternary.location = t.loc;
      const write = new MappingAssignNode(t.name, t.keys.map((k) => cloneNode(k) as ExpressionNode), ternary);
      write.location = t.loc;
      write.fromModifier = t.sourceScope;
      out.push(write);
    }

    // Keep the local array ops (already lowered to a local by CacheDynamicArrayInLoop) in slimmed conditionals.
    if (ifArm.localOps.length > 0) out.push(this.guardedBlock(condRef(), ifArm.localOps, node.location));
    if (elseArm.localOps.length > 0) {
      const notCond = new UnaryOpNode(UnaryOperator.NOT, condRef());
      notCond.location = node.location;
      out.push(this.guardedBlock(notCond, elseArm.localOps, node.location));
    }
    return out;
  }

  // Split an arm into scalar entry ops then trailing local array ops. undefined if any statement is neither, or a
  // scalar op follows a local op (reordering the two would be unsound - the predicated writes are hoisted above).
  private classifyArm(stmts: StatementNode[]): { entryOps: EntryOp[]; localOps: StatementNode[] } | undefined {
    const entryOps: EntryOp[] = [];
    const localOps: StatementNode[] = [];
    for (const s of stmts) {
      const op = this.entryOpInfo(s);
      if (op) {
        if (localOps.length > 0) return undefined;
        entryOps.push(op);
      } else if (this.isLocalArrayOp(s)) {
        localOps.push(s);
      } else {
        return undefined;
      }
    }
    return { entryOps, localOps };
  }

  // A push/pop/index-write/delete on a LOCAL array (not a mapping - a mapping ArrayAssign is a scalar entry op).
  private isLocalArrayOp(s: StatementNode): boolean {
    if (s instanceof ArrayPushNode || s instanceof ArrayPopNode
      || s instanceof ArrayAssignNode || s instanceof ArrayDeleteNode) {
      return !this.mappings.has(s.name);
    }
    return false;
  }

  // Union the two arms' scalar ops by target (name + key signature), keeping source order. undefined if any target's
  // keys cannot be signed (so we cannot match it across arms), or an arm writes one target twice: one predicated write
  // per target keeps only the arm's last op, dropping the earlier one, its value's checks and the reads it serves.
  // The union runs the if arm's targets first, so it may run an else write before one the source runs ahead of it:
  // also undefined when either of such a pair may observe the other.
  private mergeTargets(ifOps: EntryOp[], elseOps: EntryOp[]): MergedTarget[] | undefined {
    const order: string[] = [];
    const bySig = new Map<string, MergedTarget>();
    const add = (op: EntryOp, arm: 'if' | 'else'): boolean => {
      const sig = this.targetSig(op.name, op.keys);
      if (sig === undefined) return false;
      let t = bySig.get(sig);
      if (!t) {
        t = { name: op.name, keys: op.keys, loc: op.loc, sourceScope: op.sourceScope };
        bySig.set(sig, t);
        order.push(sig);
      }
      if ((arm === 'if' ? t.ifOp : t.elseOp) !== undefined) return false;
      if (arm === 'if') t.ifOp = op; else t.elseOp = op;
      return true;
    };
    for (const op of ifOps) if (!add(op, 'if')) return undefined;
    for (const op of elseOps) if (!add(op, 'else')) return undefined;
    const merged = order.map((sig) => bySig.get(sig)!);
    const at = (op: EntryOp): number => merged.findIndex((t) => t.elseOp === op);
    for (let i = 0; i < elseOps.length; i++) {
      for (let j = i + 1; j < elseOps.length; j++) {
        if (at(elseOps[j]) < at(elseOps[i]) && this.mayObserve(elseOps[i], elseOps[j])) return undefined;
      }
    }
    return merged;
  }

  // Whether running two writes in the other order may change what either stores: one mapping (their keys may name one
  // entry), a value that names the other's mapping, or a value that makes a call.
  private mayObserve(a: EntryOp, b: EntryOp): boolean {
    return a.name === b.name || this.namesMapping(a.takenValue, b.name) || this.namesMapping(b.takenValue, a.name)
      || this.makesCall(a.takenValue) || this.makesCall(b.takenValue);
  }

  // A stable string signature for a mapping target, or undefined for a key we cannot reliably match across arms.
  private targetSig(name: string, keys: ExpressionNode[]): string | undefined {
    let sig = `${name}#`;
    for (const k of keys) {
      if (k instanceof IdentifierNode) sig += `id:${k.name},`;
      else if (k instanceof IntLiteralNode) sig += `int:${k.value},`;
      else return undefined;
    }
    return sig;
  }

  private readAccess(
    name: string, keys: ExpressionNode[], loc: Location, sourceScope?: string,
  ): ExpressionNode {
    const read = new MappingAccessNode(name, keys.map((k) => cloneNode(k) as ExpressionNode));
    read.location = loc;
    read.fromModifier = sourceScope;
    return read;
  }

  private guardedBlock(cond: ExpressionNode, stmts: StatementNode[], loc: Location): BranchNode {
    const block = new BlockNode(stmts);
    block.location = loc;
    const branch = new BranchNode(cond, block);
    branch.location = loc;
    return branch;
  }

  // Normalize a statement to (mapping name, keys, taken-path value) if it is a scalar mapping delete/write, else
  // undefined. A bare `m[k] = v` parses to ArrayAssignNode pre-semantic (state-array vs mapping resolved by name
  // later); it is a mapping op iff `name` is a mapping collection - scalarMappingValueType filters that (and
  // arrays). A delete's taken value is the type default; a write's is its assigned expression.
  private entryOpInfo(s: StatementNode): EntryOp | undefined {
    let name: string; let keys: ExpressionNode[]; let takenValue: ExpressionNode | undefined;
    if (s instanceof MappingDeleteNode) {
      ({ name, keys } = s); takenValue = undefined;
    } else if (s instanceof MappingAssignNode && !s.arrayIndex) {
      ({ name, keys } = s); takenValue = s.expression;
    } else if (s instanceof ArrayAssignNode) {
      name = s.name; keys = [s.index]; takenValue = s.value;
    } else {
      return undefined;
    }
    const valueType = this.scalarMappingValueType(name, keys.length);
    if (!valueType) return undefined;
    return {
      name,
      keys,
      takenValue: takenValue ?? createDefaultValueExpression(valueType, s.location),
      loc: s.location,
      sourceScope: s.fromModifier,
    };
  }

  // `delete m[k]` -> `m[k] = cond ? default : m[k]`; `m[k] = v` -> `m[k] = cond ? v : m[k]`. Built as
  // Mapping{Access,Assign} (name is a verified mapping), which resolve regardless of the source syntax.
  private buildPredicatedWrite(op: EntryOp, cond: ExpressionNode): StatementNode {
    const read = new MappingAccessNode(op.name, op.keys.map((k) => cloneNode(k) as ExpressionNode));
    read.location = op.loc;
    read.fromModifier = op.sourceScope;
    const ternary = new TernaryOpNode(cloneNode(cond) as ExpressionNode, op.takenValue, read);
    ternary.location = op.loc;
    const write = new MappingAssignNode(op.name, op.keys, ternary);
    write.location = op.loc;
    write.fromModifier = op.sourceScope;
    return write;
  }

  // The innermost value type of a plain state mapping after `keyCount` index levels, if it is a scalar we can
  // build a default for (not array/struct/string/unbounded-bytes/nested-mapping). undefined for anything else.
  // Chunkable values must keep their source BranchNode: predicating them into `cond ? v : m[k]` still emits
  // trailing continuation NFTs on the preserve arm (see BranchNode.preserveConditionalEntryWrites).
  private scalarMappingValueType(name: string, keyCount: number): Type | undefined {
    const coll = this.mappings.get(name);
    if (!coll) return undefined;
    let t: Type = coll.type;
    for (let i = 0; i < keyCount; i++) {
      if (!(t instanceof MappingType)) return undefined;
      t = t.valueType;
    }
    if (t instanceof MappingType || t instanceof ArrayType || t instanceof StructType) return undefined;
    if (isChunkableValueType(t)) return undefined;
    return t;
  }

  private hasCall(node: ExpressionNode): boolean {
    let found = false;
    const walk = (n: Node | undefined): void => {
      if (!n || found) return;
      if (n instanceof FunctionCallNode) { found = true; return; }
      for (const key of Object.keys(n)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) walk(it);
      }
    };
    walk(node);
    return found;
  }

  // A bare `m[k]` reads the identifier `m`; `this.m[k]` is a MappingAccess.
  private namesMapping(node: ExpressionNode, mapping: string): boolean {
    return this.holds(node, (n) => (n instanceof IdentifierNode || n instanceof MappingAccessNode) && n.name === mapping);
  }

  private makesCall(node: ExpressionNode): boolean {
    return this.holds(node, (n) => n instanceof FunctionCallNode || n instanceof MethodCallNode
      || n instanceof IndirectCallNode || n instanceof ExternalFunctionCallNode || n instanceof LowLevelCallNode
      || n instanceof AddressSendExpressionNode || n instanceof InstantiationNode);
  }

  // Whether `test` holds for a node or one of its executable children.
  private holds(node: Node, test: (n: Node) => boolean): boolean {
    if (test(node)) return true;
    for (const key of Object.keys(node)) {
      if (BACK_REFERENCES.has(key)) continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (v instanceof Node && this.holds(v, test)) return true;
      if (Array.isArray(v) && v.some((it) => it instanceof Node && this.holds(it, test))) return true;
    }
    return false;
  }
}
