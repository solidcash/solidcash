import {
  ArrayAssignNode,
  AssignNode,
  BlockNode,
  ExpressionNode,
  FieldAccessNode,
  FunctionCallNode,
  FunctionDefinitionNode,
  IdentifierNode,
  MappingFieldAssignNode,
  Node,
  SourceFileNode,
  StateArrayAssignNode,
  ArrayAccessNode,
  IntLiteralNode,
  ContractNode,
  StatementNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { ArrayType, StructType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';

/**
 * An array-field element WRITE on a LOCAL/PARAM struct var whose struct type was IMPORTED - `escrow.split[j] = v`
 * on `Escrow memory escrow` (Unicrow) - is mis-built by the AstBuilder as a mapping-field assign: the struct type
 * is unknown at parse time (not in localStructTypes), so `x.field[i] = v` falls through to the `MappingFieldAssign`
 * default, which later errors "Undefined mapping 'escrow'". Now that imports are merged and types re-resolved,
 * rewrite it into the same read-modify-rebuild the AstBuilder emits for a same-file struct local:
 *
 *   T tmp = escrow.split; tmp[j] = v; escrow = Escrow(escrow.f0, .., tmp, ..);
 *
 * Runs pre-semantic, after modifier expansion + reresolveImportedStructTypes and before LowerMemoryModel (which
 * lowers the resulting local-struct assignment). Scoped to LOCAL/PARAM struct receivers (a real mapping name is
 * not a struct-typed local, and a STATE struct var needs a state-assign roundtrip - left to the AstBuilder path).
 */
export default class RedesugarImportedStructFieldWrites extends AstTraversal {
  private counter = 0;
  // State ARRAY name -> its element struct type (`JobPost[] jobs`). A `JobPost storage jp = jobs[id]; jp.field = v`
  // storage-pointer write inlines to `jobs[id].field = v`, mis-built as MappingFieldAssign(jobs, [id], field, v)
  // when JobPost is imported. Resolve it to a read-modify-write of the array element (the EACC MarketplaceV2/V3).
  private stateArrayStructs: Map<string, StructType> = new Map();

  visitSourceFile(node: SourceFileNode): Node {
    const contract = node.contract;
    if (!contract) return node;
    this.stateArrayStructs = this.collectStateArrayStructs(contract);
    const fns: (FunctionDefinitionNode | undefined)[] = [
      ...contract.functions, contract.constructorDef, contract.fallbackDef, contract.receiveDef,
      ...(node.freeFunctions ?? []),
    ];
    for (const fn of fns) if (fn?.body) this.processFunction(fn);
    return node;
  }

  private collectStateArrayStructs(contract: ContractNode): Map<string, StructType> {
    const m = new Map<string, StructType>();
    const add = (name: string, t: unknown): void => {
      if (t instanceof ArrayType && t.elementType instanceof StructType) m.set(name, t.elementType);
    };
    for (const sv of contract.stateVariables) add(sv.name, sv.type);
    for (const col of contract.collections) add(col.name, col.type);
    return m;
  }

  private processFunction(fn: FunctionDefinitionNode): void {
    // LOCAL/PARAM struct types only (state struct vars need a state-assign roundtrip, not a local reassign).
    const localStructs = new Map<string, StructType>();
    for (const p of fn.parameters ?? []) if (p.type instanceof StructType) localStructs.set(p.name, p.type);
    this.walk(fn.body, (n) => {
      if (n instanceof VariableDefinitionNode && n.type instanceof StructType) localStructs.set(n.name, n.type);
    });
    // A storage-pointer `S storage p = arr[id]` is inlined+dropped, so there is no local struct - the state-array
    // rebuild path still applies, so run whenever there are local structs OR state arrays.
    if (localStructs.size === 0 && this.stateArrayStructs.size === 0) return;
    this.transform(fn.body, localStructs);
  }

  // Rewrite eligible MappingFieldAssign statements in every statement list within the subtree.
  private transform(node: Node | undefined, localStructs: Map<string, StructType>): void {
    if (!node) return;
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i += 1) {
          if (v[i] instanceof Node) {
            const rebuilt = v[i] instanceof MappingFieldAssignNode
              ? this.rebuild(v[i] as MappingFieldAssignNode, localStructs) : undefined;
            if (rebuilt) v[i] = rebuilt;
            this.transform(v[i] as Node, localStructs);
          }
        }
      } else if (v instanceof Node) {
        this.transform(v, localStructs);
      }
    }
  }

  // `struct.field = value` (scalar) or `struct.field[idx] = value` (array element), both mis-built as a
  // MappingFieldAssign on an imported-typed struct local -> struct-rebuild block, or undefined when it is not a
  // struct-local field write (a real mapping-field assign, or an unsupported multi-index shape).
  private rebuild(node: MappingFieldAssignNode, localStructs: Map<string, StructType>): BlockNode | undefined {
    // State-array element field write `arr[id].field = v` (mis-built from a storage-ptr `S storage p = arr[id];
    // p.field = v`): read the element into a local, rebuild the field, write the element back.
    const arrStruct = node.keys.length === 1 && !localStructs.has(node.name)
      ? this.stateArrayStructs.get(node.name) : undefined;
    if (arrStruct) return this.rebuildStateArrayElem(node, arrStruct);
    const structT = localStructs.get(node.name);
    if (!structT) return undefined;
    const field = structT.fields.find((f) => f.name === node.fieldName);
    if (!field) return undefined;
    const isArrayElem = node.keys.length === 1 && field.type instanceof ArrayType;
    if (node.keys.length !== 0 && !isArrayElem) return undefined;

    const loc = node.location;
    const id = (n: string): IdentifierNode => { const x = new IdentifierNode(n); x.location = loc; return x; };
    const fieldOf = (v: string, f: string): FieldAccessNode => { const fa = new FieldAccessNode(id(v), f); fa.location = loc; return fa; };

    // Scalar `struct.field = v`: the field's new value is v directly. Array `struct.field[i] = v`: read the field
    // into a tmp, write the element, then use the tmp as the field's new value.
    const stmts: StatementNode[] = [];
    let newFieldValue: ExpressionNode;
    if (isArrayElem) {
      const tmp = `__inlv_${this.counter++}`;
      const decl = new VariableDefinitionNode(field.type, [], tmp, fieldOf(node.name, node.fieldName));
      decl.location = loc;
      const elemAssign = new ArrayAssignNode(tmp, node.keys[0], node.expression);
      elemAssign.location = loc;
      stmts.push(decl as StatementNode, elemAssign);
      newFieldValue = id(tmp);
    } else {
      newFieldValue = node.expression;
    }
    const ctor = new FunctionCallNode(id(structT.name),
      structT.fields.map((f) => (f.name === node.fieldName ? newFieldValue : fieldOf(node.name, f.name))));
    ctor.location = loc;
    const back = new AssignNode(id(node.name), ctor);
    back.location = loc;
    stmts.push(back);
    const block = new BlockNode(stmts);
    block.location = loc;
    return block;
  }

  // `arr[id].field = v` (state array of a resolved struct) -> `S __t = arr[id]; __t.field = v; arr[id] = __t;`. The
  // local write reuses the scalar/array-field rebuild; the write-back is a StateArrayAssign (arr[id] = __t).
  private rebuildStateArrayElem(node: MappingFieldAssignNode, structT: StructType): BlockNode | undefined {
    const loc = node.location;
    const tmp = `__sav_${this.counter++}`;
    const arrId = new IdentifierNode(node.name); arrId.location = loc;
    const read = new ArrayAccessNode(arrId, cloneNode(node.keys[0]) as ExpressionNode); read.location = loc;
    const decl = new VariableDefinitionNode(structT, [], tmp, read); decl.location = loc;
    // The field write moves to the local `__t` (no array index - that indexed the state array, not the field).
    const localWrite = new MappingFieldAssignNode(tmp, [], node.fieldName, node.expression); localWrite.location = loc;
    const rebuilt = this.rebuild(localWrite, new Map([[tmp, structT]]));
    if (!rebuilt) return undefined;
    const back = new StateArrayAssignNode(node.name, cloneNode(node.keys[0]) as ExpressionNode,
      (() => { const x = new IdentifierNode(tmp); x.location = loc; return x; })());
    back.location = loc;
    const block = new BlockNode([decl as StatementNode, ...rebuilt.statements, back]);
    block.location = loc;
    return block;
  }

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
