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
  TernaryOpNode,
  FunctionCallNode,
  CollectionNode,
  FunctionDefinitionNode,
} from '../ast/AST.js';
import {
  Type, MappingType, ArrayType, StructType, PrimitiveType,
} from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';

/**
 * If-conversion for a conditional mapping delete. A `delete m[k]` inside an if/else branch does not actually
 * remove the entry on the taken path: the covenant places no output constraint on a branch-touched entry slot
 * (it can't statically tell the delete ran), so the SDK recreates the entry with its old value. Rewrite the
 * whole branch into unconditional predicated writes that read the current value on the not-taken path:
 *
 * ```
 * if (cond) { delete m[k]; }   ->   m[k] = cond ? <default> : m[k];
 * ```
 *
 * The result is an ordinary UNCONDITIONAL entry write of a conditionally-chosen value, which already round-trips
 * soundly (taken -> default = soft delete; not-taken -> current value = preserved) with no conditional-entry
 * covenant machinery. Runs pre-semantic so SymbolTable/TypeCheck resolve and type the new nodes.
 *
 * Scoped to the sound, bounded shape: a branch with NO else whose body is only mapping deletes on plain
 * scalar-valued mappings. A single delete is always safe (the condition runs once, exactly as before);
 * multiple deletes are converted only when the condition is side-effect-free (no calls), since each predicated
 * write re-evaluates it. Anything else is left untouched (falls through to existing behavior, no regression).
 * The early-return form (remove()'s deletes after a guard) is a separate, deeper case and is not handled here.
 */
export default class IfConvertConditionalDelete extends AstTraversal {
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

  // Returns the replacement statements if the branch is a convertible conditional-delete, else undefined.
  private tryConvertBranch(node: BranchNode): StatementNode[] | undefined {
    if (node.elseBlock) return undefined;
    const stmts = node.ifBlock.statements ?? [];
    if (stmts.length === 0) return undefined;

    const deletes: MappingDeleteNode[] = [];
    for (const s of stmts) {
      if (!(s instanceof MappingDeleteNode)) return undefined;
      const valueType = this.scalarMappingValueType(s.name, s.keys.length);
      if (!valueType) return undefined;
      deletes.push(s);
    }

    // A single delete re-uses the condition once (always safe); multiple require a side-effect-free condition.
    if (deletes.length > 1 && this.hasCall(node.condition)) return undefined;

    return deletes.map((del) => this.buildPredicatedWrite(del, node.condition));
  }

  // `delete m[keys]` under `cond`  ->  `m[keys] = cond ? default : m[keys]`.
  private buildPredicatedWrite(del: MappingDeleteNode, cond: ExpressionNode): StatementNode {
    const valueType = this.scalarMappingValueType(del.name, del.keys.length)!;
    const def = createDefaultValueExpression(valueType, del.location);
    const read = new MappingAccessNode(del.name, del.keys.map((k) => cloneNode(k) as ExpressionNode));
    read.location = del.location;
    const ternary = new TernaryOpNode(cloneNode(cond) as ExpressionNode, def, read);
    ternary.location = del.location;
    const write = new MappingAssignNode(del.name, del.keys, ternary);
    write.location = del.location;
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
