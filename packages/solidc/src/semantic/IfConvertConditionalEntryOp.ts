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
  CollectionNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  IdentifierNode,
  IntLiteralNode,
} from '../ast/AST.js';
import {
  Type, MappingType, ArrayType, StructType, PrimitiveType,
} from '@solidcash/utils';
import { UnaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';
import { Location } from '../ast/Location.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';

// A conditional mapping op normalized to its target + taken-path value.
interface EntryOp {
  name: string;
  keys: ExpressionNode[];
  takenValue: ExpressionNode;
  loc: Location;
}

// A scalar target seen across an if/else's two arms: its op in each arm (absent = preserve the current value).
interface MergedTarget {
  name: string;
  keys: ExpressionNode[];
  loc: Location;
  ifOp?: EntryOp;
  elseOp?: EntryOp;
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
 * single op is always safe (the condition runs once, exactly as before); multiple ops are converted only when the
 * condition is side-effect-free (no calls), since each predicated write re-evaluates it. Anything else is left
 * untouched (falls through to existing behavior, no regression). The early-return form (remove()'s ops after a
 * guard) is a separate, deeper case and is not handled here.
 *
 * An if/else branch whose arms are scalar entry ops plus trailing LOCAL array ops (a chunk-array push/pop that
 * CacheDynamicArrayInLoop already lowered to a local, since this pass runs after it) is also handled - the
 * IterableMapping set() shape `if(inserted[k]){values[k]=v}else{inserted[k]=true;values[k]=v;idx[k]=len;keys.push(k)}`.
 * The condition is hoisted to a bool local (the predicated writes mutate the mappings the condition reads, so it
 * must be evaluated once), each scalar target is predicated `m[k] = cond ? ifValue : elseValue` (a missing arm
 * preserves the current value), and the local array ops stay in a slimmed `if(cond)` / `if(!cond)` block (a
 * stack-neutral local op works inside a branch). Result: all entry writes are unconditional (stable output count).
 */
export default class IfConvertConditionalEntryOp extends AstTraversal {
  // Mappings are CollectionNodes (node.collections), not stateVariables, pre-semantic.
  private mappings: Map<string, CollectionNode> = new Map();

  // Names the hoisted condition locals uniquely per converted if/else branch.
  private condCounter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.mappings = new Map();
    for (const c of node.collections) {
      if (c.type instanceof MappingType) this.mappings.set(c.name, c);
    }
    for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
      if (fn?.body) this.visit(fn as FunctionDefinitionNode);
    }
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
    if (node.elseBlock) return this.tryConvertIfElse(node);
    const stmts = node.ifBlock.statements ?? [];
    if (stmts.length === 0) return undefined;

    const ops: EntryOp[] = [];
    for (const s of stmts) {
      const op = this.entryOpInfo(s);
      if (!op) return undefined;
      ops.push(op);
    }

    // A single op re-uses the condition once (always safe); multiple require a side-effect-free condition.
    if (ops.length > 1 && this.hasCall(node.condition)) return undefined;

    return ops.map((op) => this.buildPredicatedWrite(op, node.condition));
  }

  // An if/else whose arms are scalar entry ops + trailing local array ops -> hoist the condition, predicate every
  // scalar target across both arms, keep the local array ops in slimmed conditionals. undefined = not this shape.
  private tryConvertIfElse(node: BranchNode): StatementNode[] | undefined {
    const ifArm = this.classifyArm(node.ifBlock.statements ?? []);
    const elseArm = this.classifyArm(node.elseBlock?.statements ?? []);
    if (!ifArm || !elseArm) return undefined;
    if (ifArm.entryOps.length === 0 && elseArm.entryOps.length === 0) return undefined; // nothing to predicate
    const targets = this.mergeTargets(ifArm.entryOps, elseArm.entryOps);
    if (!targets) return undefined; // a key we cannot match across arms

    const out: StatementNode[] = [];
    // Hoist the condition: the predicated writes below mutate the mappings the condition reads, so evaluate once.
    const condName = `__ifcond_${this.condCounter++}`;
    const condClone = cloneNode(node.condition) as ExpressionNode;
    const condDef = new VariableDefinitionNode(PrimitiveType.BOOL, [], condName, condClone);
    condDef.location = node.location;
    out.push(condDef);
    const condRef = (): ExpressionNode => {
      const id = new IdentifierNode(condName); id.location = node.location; return id;
    };

    // Predicate each scalar target: `m[k] = cond ? ifValue : elseValue`; a missing arm preserves the current value.
    for (const t of targets) {
      const ifVal = t.ifOp ? t.ifOp.takenValue : this.readAccess(t.name, t.keys, t.loc);
      const elseVal = t.elseOp ? t.elseOp.takenValue : this.readAccess(t.name, t.keys, t.loc);
      const ternary = new TernaryOpNode(condRef(), ifVal, elseVal);
      ternary.location = t.loc;
      const write = new MappingAssignNode(t.name, t.keys.map((k) => cloneNode(k) as ExpressionNode), ternary);
      write.location = t.loc;
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

  // Union the two arms' scalar ops by target (name + key signature), keeping source order. Last write to a target
  // within an arm wins. undefined if any target's keys cannot be signed (so we cannot match it across arms).
  private mergeTargets(ifOps: EntryOp[], elseOps: EntryOp[]): MergedTarget[] | undefined {
    const order: string[] = [];
    const bySig = new Map<string, MergedTarget>();
    const add = (op: EntryOp, arm: 'if' | 'else'): boolean => {
      const sig = this.targetSig(op.name, op.keys);
      if (sig === undefined) return false;
      let t = bySig.get(sig);
      if (!t) { t = { name: op.name, keys: op.keys, loc: op.loc }; bySig.set(sig, t); order.push(sig); }
      if (arm === 'if') t.ifOp = op; else t.elseOp = op;
      return true;
    };
    for (const op of ifOps) if (!add(op, 'if')) return undefined;
    for (const op of elseOps) if (!add(op, 'else')) return undefined;
    return order.map((sig) => bySig.get(sig)!);
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

  private readAccess(name: string, keys: ExpressionNode[], loc: Location): ExpressionNode {
    const read = new MappingAccessNode(name, keys.map((k) => cloneNode(k) as ExpressionNode));
    read.location = loc;
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
    return { name, keys, takenValue: takenValue ?? createDefaultValueExpression(valueType, s.location), loc: s.location };
  }

  // `delete m[k]` -> `m[k] = cond ? default : m[k]`; `m[k] = v` -> `m[k] = cond ? v : m[k]`. Built as
  // Mapping{Access,Assign} (name is a verified mapping), which resolve regardless of the source syntax.
  private buildPredicatedWrite(op: EntryOp, cond: ExpressionNode): StatementNode {
    const read = new MappingAccessNode(op.name, op.keys.map((k) => cloneNode(k) as ExpressionNode));
    read.location = op.loc;
    const ternary = new TernaryOpNode(cloneNode(cond) as ExpressionNode, op.takenValue, read);
    ternary.location = op.loc;
    const write = new MappingAssignNode(op.name, op.keys, ternary);
    write.location = op.loc;
    return write;
  }

  // The innermost value type of a plain state mapping after `keyCount` index levels, if it is a scalar we can
  // build a default for (not array/struct/string/nested-mapping). undefined for anything else.
  private scalarMappingValueType(name: string, keyCount: number): Type | undefined {
    const coll = this.mappings.get(name);
    if (!coll) return undefined;
    let t: Type = coll.type;
    for (let i = 0; i < keyCount; i++) {
      if (!(t instanceof MappingType)) return undefined;
      t = t.valueType;
    }
    if (t instanceof MappingType || t instanceof ArrayType || t instanceof StructType) return undefined;
    if (t === PrimitiveType.STRING) return undefined; // dynamic (chunked) - not a simple scalar entry
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
}
