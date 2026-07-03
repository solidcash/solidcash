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
  TernaryOpNode,
  FunctionCallNode,
  CollectionNode,
  FunctionDefinitionNode,
} from '../ast/AST.js';
import {
  Type, MappingType, ArrayType, StructType, PrimitiveType,
} from '@solidcash/utils';
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
 */
export default class IfConvertConditionalEntryOp extends AstTraversal {
  // Mappings are CollectionNodes (node.collections), not stateVariables, pre-semantic.
  private mappings: Map<string, CollectionNode> = new Map();

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
    if (node.elseBlock) return undefined;
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
