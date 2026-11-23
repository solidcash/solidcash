import { StructType, ArrayType, MappingType } from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  FunctionDefinitionNode,
  BlockNode,
  VariableDefinitionNode,
  IdentifierNode,
  FieldAccessNode,
  FunctionCallNode,
  StatementNode,
  StructDefinitionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Scalar replacement of aggregates for struct locals.
 *
 * A struct value is stored as its fields pushdata-framed back to back, so `S v = S(a, b); ... v.a ...` builds
 * the frame with an encoder subroutine and reads each field back with a decoder subroutine, even when `v` never
 * leaves the function. A two-field local costs about 200 bytes of encoder/decoder script on top of the logic.
 *
 * When a local is provably used only as a bag of fields, give each field its own local instead:
 *
 *   S v = S({ a: x, b: y });   ->   T_a __sroa_v_a = x;  T_b __sroa_v_b = y;
 *   v.a                        ->   __sroa_v_a
 *
 * The rewrite applies only when ALL of these hold, otherwise the local is left untouched:
 *  - `v` is defined exactly once in the function, by a direct construction of its own struct type that names every
 *    field exactly once (positional, or named with all fields present);
 *  - every field type is a scalar (no nested struct, array or mapping), so no field itself needs the codec;
 *  - every other mention of `v` anywhere in the function is the base of a field read `v.f` of a declared field.
 *    Any other occurrence - an assignment (field writes desugar to a whole-struct rebuild of `v`), passing `v`
 *    whole, returning it, an assembly reference, or any node that names `v` by string - disqualifies it.
 *
 * Field initializers are emitted in source argument order, which is Solidity's evaluation order.
 */
export default class ScalarReplaceStructLocals extends AstTraversal {
  private structs = new Map<string, { name: string; type: unknown }[]>();
  /** Candidate locals of the function being rewritten: name -> field name -> replacement local name. */
  private active = new Map<string, Map<string, string>>();

  visitSourceFile(node: SourceFileNode): Node {
    this.collect(node.structDefinitions);
    if (node.contract) this.collect((node.contract as ContractNode).structDefinitions);
    return super.visitSourceFile(node);
  }

  visitContract(node: ContractNode): Node {
    this.collect(node.structDefinitions);
    return super.visitContract(node);
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body) return super.visitFunctionDefinition(node);
    const saved = this.active;
    this.active = this.findCandidates(node);
    const result = this.active.size > 0 ? this.rewrite(node) : super.visitFunctionDefinition(node);
    this.active = saved;
    return result;
  }

  private rewrite(node: FunctionDefinitionNode): Node {
    node.body = this.visit(node.body!) as BlockNode;
    return node;
  }

  visitBlock(node: BlockNode): Node {
    if (this.active.size === 0) return super.visitBlock(node);
    const out: StatementNode[] = [];
    for (const statement of node.statements ?? []) {
      const fields = statement instanceof VariableDefinitionNode ? this.active.get(statement.name) : undefined;
      if (!fields) { out.push(this.visit(statement) as StatementNode); continue; }
      const def = statement as VariableDefinitionNode;
      const call = def.expression as FunctionCallNode;
      const order = call.fieldNames ?? this.fieldsOf(def)!.map((f) => f.name);
      call.parameters.forEach((arg, i) => {
        const field = this.fieldsOf(def)!.find((f) => f.name === order[i])!;
        const scalar = new VariableDefinitionNode(field.type as never, [], fields.get(field.name)!, this.visit(arg) as never);
        scalar.location = def.location;
        scalar.compilerGenerated = true;
        scalar.allowUnused = true;
        out.push(scalar);
      });
    }
    node.statements = out as typeof node.statements;
    return node;
  }

  visitFieldAccess(node: FieldAccessNode): Node {
    const base = node.expression;
    if (base instanceof IdentifierNode) {
      const replacement = this.active.get(base.name)?.get(node.name);
      if (replacement) {
        const id = new IdentifierNode(replacement);
        id.location = node.location;
        return id;
      }
    }
    return super.visitFieldAccess(node);
  }

  private collect(definitions: StructDefinitionNode[] | undefined): void {
    for (const s of definitions ?? []) if (!this.structs.has(s.name)) this.structs.set(s.name, s.fields);
  }

  private fieldsOf(def: VariableDefinitionNode): { name: string; type: unknown }[] | undefined {
    if (!(def.type instanceof StructType)) return undefined;
    const fields = def.type.fields.length > 0 ? def.type.fields : this.structs.get(def.type.name);
    return fields && fields.length > 0 ? fields : undefined;
  }

  private findCandidates(fn: FunctionDefinitionNode): Map<string, Map<string, string>> {
    const defs = new Map<string, VariableDefinitionNode[]>();
    const parameterNames = new Set(fn.parameters.map((p) => p.name));
    walk(fn.body, (value, parent, key) => {
      if (value instanceof VariableDefinitionNode) {
        const list = defs.get(value.name) ?? [];
        list.push(value);
        defs.set(value.name, list);
      }
      void parent; void key;
    });

    const result = new Map<string, Map<string, string>>();
    for (const [name, list] of defs) {
      if (list.length !== 1 || parameterNames.has(name)) continue;
      const def = list[0];
      const fields = this.fieldsOf(def);
      if (!fields || !(def.type instanceof StructType)) continue;
      if (!fields.every((f) => isScalar(f.type))) continue;
      const call = def.expression;
      if (!(call instanceof FunctionCallNode) || call.resolvedFunction) continue;
      if (!(call.identifier instanceof IdentifierNode) || call.identifier.name !== def.type.name) continue;
      if (call.parameters.length !== fields.length) continue;
      if (call.fieldNames) {
        const named = new Set(call.fieldNames);
        if (named.size !== fields.length || !fields.every((f) => named.has(f.name))) continue;
      }
      if (!this.onlyFieldReads(fn, def, new Set(fields.map((f) => f.name)))) continue;
      if (!this.allMentionsInScope(fn, def)) continue;
      result.set(name, new Map(fields.map((f) => [f.name, `__sroa_${name}_${f.name}`])));
    }
    return result;
  }

  /**
   * Every mention of the name is a mention of this local: each lies in the statements after its definition in the
   * block that holds it. A mention before it, in its own initializer, or outside that block names another binding (a
   * state variable under `evmCompat`), which the rewrite would otherwise turn into a read of this local's fields.
   */
  private allMentionsInScope(fn: FunctionDefinitionNode, def: VariableDefinitionNode): boolean {
    let scope: Node[] | undefined;
    walk(fn.body, (value) => {
      if (scope !== undefined || !(value instanceof BlockNode)) return;
      const index = (value.statements ?? []).indexOf(def as unknown as StatementNode);
      if (index >= 0) scope = value.statements!.slice(index + 1) as unknown as Node[];
    });
    if (scope === undefined) return false;
    const mentions = (root: unknown): number => {
      let count = 0;
      walk(root, (value) => { if (value instanceof IdentifierNode && value.name === def.name) count += 1; });
      return count;
    };
    return mentions(fn) === scope.reduce((total, statement) => total + mentions(statement), 0);
  }

  /** Every mention of `def.name` in the function (outside its own definition) is the base of `name.field`. */
  private onlyFieldReads(fn: FunctionDefinitionNode, def: VariableDefinitionNode, fieldNames: Set<string>): boolean {
    let ok = true;
    walk(fn, (value, parent, key) => {
      if (!ok) return;
      if (value === def) return;
      if (value instanceof IdentifierNode && value.name === def.name) {
        if (!(parent instanceof FieldAccessNode && key === 'expression' && fieldNames.has(parent.name))) ok = false;
        return;
      }
      // Any other node that names the local by string (assignment targets, array ops, assembly, ...).
      if (typeof value === 'string' && value === def.name && !(parent instanceof IdentifierNode && key === 'name')
        && !(parent === def && key === 'name')) ok = false;
    }, def);
    return ok;
  }
}

function isScalar(type: unknown): boolean {
  return !(type instanceof StructType) && !(type instanceof ArrayType) && !(type instanceof MappingType);
}

/** Reflective walk over every property of every AST node under `root` (locations and types excluded). */
function walk(
  root: unknown,
  visit: (value: unknown, parent: unknown, key: string) => void,
  skipChildrenOf?: unknown,
): void {
  const seen = new Set<unknown>();
  const go = (value: unknown, parent: unknown, key: string): void => {
    visit(value, parent, key);
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    if (!(value instanceof Node) && !Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return;
    seen.add(value);
    if (value === skipChildrenOf) {
      // The definition's own initializer may still mention the name (e.g. `S v = S(v.a, ...)` cannot occur
      // since v is not in scope there, but an outer same-named binding was alpha-renamed); scan it.
      const def = value as VariableDefinitionNode;
      if (def.expression) go(def.expression, def, 'expression');
      return;
    }
    for (const [k, v] of Object.entries(value as object)) {
      if (k === 'location' || k === 'type' || k === 'resolvedFunction' || k === 'definition'
        || k === 'referencedContract' || k === 'errorDefinition' || k === 'structType' || k === 'enumType') continue;
      if (Array.isArray(v)) v.forEach((x) => go(x, value, k));
      else go(v, value, k);
    }
  };
  go(root, undefined, '');
}
