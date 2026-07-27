import {
  ArrayType, IntType, BytesType, StructType, PrimitiveType, Type, ValueType, encodeString,
} from '@solidcash/utils';
import {
  Node,
  SourceFileNode,
  ContractNode,
  BlockNode,
  StatementNode,
  FunctionDefinitionNode,
  ParameterNode,
  VariableDefinitionNode,
  AssignNode,
  StateAssignNode,
  TupleAssignmentNode,
  ArrayAssignNode,
  ArrayAccessNode,
  TupleIndexOpNode,
  FieldAccessNode,
  DeleteLocalNode,
  MappingDeleteNode,
  MappingFieldAssignNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  StateAccessNode,
  ReturnNode,
  WhileNode,
  BinaryOpNode,
  UnaryOpNode,
  CastNode,
  SliceNode,
  BytesConcatNode,
  ArrayNode,
  NewArrayNode,
  IntLiteralNode,
  HexLiteralNode,
  StringLiteralNode,
  IdentifierNode,
  ExpressionNode,
  AssemblyStatementNode,
  AbiDecodeNode,
} from '../ast/AST.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { YulNode, YulPathNode, YulFunctionCallNode } from '../ast/YulAST.js';
import { UnsupportedMemoryAliasingError } from '../Errors.js';
import {
  YULMEM,
  memReservedInit as buildReservedInit,
  memWordStore,
  memWordLoad,
  memByteStore,
  memZeroBytes,
  wordDecodeType,
} from './YulMemPrimitives.js';

// Lowers local `memory` reference types to integer pointers into a per-function linear byte buffer, so a nested
// lvalue write is an address-chain + a single in-place store that COMPOSES across statements (the value-copy
// read-modify-write re-encodes stale aggregate snapshots and does not). A per-function SAFETY GATE only converts
// a local when every use (and every alias-group member's use) is a supported lowering, else it falls back to the
// value-copy path - so the pass is non-regressing by construction. Always on. See
// docs/experimental-memory-model.md. Pure desugar to bytes ops (bytes.concat / slice / bytes32/uint casts /
// `new bytes(n)`) - no codegen changes.
//
// This first slice handles a memory DYNAMIC ARRAY of an int/uint element type: `new T[](n)`, `a[i]` read/write,
// `a.length`, and reference aliasing (`T[] memory b = a` shares the buffer). Structs and nested chains build on
// the same primitives (Phase 3). Off by default; the flag gates the whole pass, so the value-copy path is intact.
const WORD = 32n;

// The one linear-memory buffer (name + primitive lowerings imported from ./YulMemPrimitives) is shared with the Yul
// runtime-memory lowering (LowerInlineAssembly, which runs after this pass and reuses the decl if it already
// exists). One name = one EVM-faithful memory space per function; one module = one lowering of store/load/init.

export default class LowerMemoryModel extends AstTraversal {
  private byteConstantValues = new Map<string, HexLiteralNode | StringLiteralNode>();
  // Locals that are memory-model pointers (declared as a handled memory dynamic array, initialized by a fresh
  // allocation or an alias). Name -> the array type (element type used for encode/decode).
  private memArrays = new Map<string, ArrayType>();
  // Locals that are memory-model STRUCT pointers (block of 32-byte value-field words). Name -> struct type.
  private memStructs = new Map<string, StructType>();
  // Locals that are memory-model arrays whose ELEMENTS are struct pointers (`T[] memory`, T a value-field
  // struct). Separate track from memArrays so value-element ops stay untouched. Name -> array type.
  private memStructArrays = new Map<string, ArrayType>();
  // Locals that are memory-model `bytes` pointers (a [length(32)][data] block, byte-packed data). Same pointer +
  // .length + alias + boundary machinery as a value array, but element access is BYTE-granular (stride 1, one
  // byte) instead of word-granular. The taint analysis treats a bytes candidate as a value array (b[i]/.length/
  // return are supported), so only the geometry differs. Name -> bytes type.
  private memBytes = new Map<string, BytesType>();
  // Internal/private VOID helpers eligible for pass-by-reference inlining (P4): a `g(a)` call site is replaced
  // with `{ T[] memory __inl_x = a; <g body> }`, so the param aliases the caller's array. Pass-by-ref then falls
  // out of the alias convert/fallback decision - no new gate logic. Populated per-contract. See visitContract.
  private inlinable = new Map<string, FunctionDefinitionNode>();
  private usesMemory = false;
  // SAFETY GATE: names the analysis proved safe to convert this function (every use - and every alias-group
  // member's use - is a lowering we support). A candidate not in this set falls through to the value-copy path,
  // so flag-on can never regress. See analyzeConvertible + docs/experimental-memory-model.md SS6.
  private convertible = new Set<string>();
  private counter = 0;

  visitSourceFile(node: SourceFileNode): Node {
    this.byteConstantValues = new Map();
    const constants = [
      ...node.constantDefinitions,
      ...node.contract.constantDefinitions,
      ...node.importedContracts.flatMap((contract) => contract.constantDefinitions),
    ];
    for (const constant of constants) {
      if (!(constant.expression instanceof HexLiteralNode || constant.expression instanceof StringLiteralNode)) continue;
      this.byteConstantValues.set(constant.name, constant.expression);
      const dot = constant.name.lastIndexOf('.');
      if (dot >= 0 && !this.byteConstantValues.has(constant.name.slice(dot + 1))) {
        this.byteConstantValues.set(constant.name.slice(dot + 1), constant.expression);
      }
    }
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.collectInlinable(node);
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const savedMem = this.memArrays;
    const savedStructs = this.memStructs;
    const savedStructArrays = this.memStructArrays;
    const savedBytes = this.memBytes;
    const savedUses = this.usesMemory;
    const savedConv = this.convertible;
    this.memArrays = new Map();
    this.memStructs = new Map();
    this.memStructArrays = new Map();
    this.memBytes = new Map();
    this.usesMemory = false;
    if (node.body) this.inlineByteConstantInitializers(node.body);
    if (node.body) this.materializeNamedBytesReturn(node);
    if (node.body) this.materializeDecodedArrays(node.body);
    // P4 v2 (c): materialize a memory-array PARAM into the buffer (deserialize the ABI value-copy at entry) so it
    // is a pointer that a helper can mutate by reference. Only for NON-inlinable functions (an inlinable one is
    // spliced from its ORIGINAL body, so mutating it here would corrupt the inline source). Runs before the inline.
    if (node.body && !this.inlinable.has(node.name)) this.materializeParams(node);
    // P4: inline pass-by-reference helper calls BEFORE the gate, so the substituted alias decls are analyzed and
    // lowered like any other alias. Pass-by-ref (convert) vs pass-by-value (fallback) then falls out of the gate.
    if (node.body) this.inlinePassByRef(node.body);
    if (node.body) this.materializeInlineStructReferenceArgs(node.body);
    this.convertible = node.body ? this.analyzeConvertible(node.body) : new Set();
    if (node.body) {
      // A first pass over the block rewrites decls/writes/reads; if any memory array is allocated, prepend the
      // buffer decl so every `__yulmem` reference resolves. The free-memory pointer lives IN the buffer at slot
      // 0x40 (init 0x80), matching the Yul runtime `__yulmem` layout, so both memory passes share one addressing.
      node.body = this.visit(node.body) as BlockNode;
      if (this.usesMemory) {
        const memDecl = new VariableDefinitionNode(new BytesType(), [], YULMEM, this.memReservedInit());
        this.at(memDecl, node);
        node.body.statements = [memDecl, ...(node.body.statements ?? [])];
      }
    }
    this.memArrays = savedMem;
    this.memStructs = savedStructs;
    this.memStructArrays = savedStructArrays;
    this.memBytes = savedBytes;
    this.usesMemory = savedUses;
    this.convertible = savedConv;
    return node;
  }

  private inlineByteConstantInitializers(body: BlockNode): void {
    this.eachDescendant(body, (child) => {
      if (!(child instanceof VariableDefinitionNode) || !(child.expression instanceof IdentifierNode)) return;
      const value = this.byteConstantValues.get(child.expression.name);
      if (value) child.expression = cloneNode(value) as HexLiteralNode | StringLiteralNode;
    });
  }

  // A front-end struct-field rebuild can embed a fresh reference allocation directly in the constructor:
  // `s.a = new uint8[](n)` -> `s = S(new uint8[](n), ...)`. Give that allocation a named memory local so the
  // pointer/alias gate can track it and lower the struct field as a pointer word.
  private materializeInlineStructReferenceArgs(body: BlockNode): void {
    const localTypes = new Map<string, Type>();
    this.eachDescendant(body, (n) => {
      if (n instanceof VariableDefinitionNode) localTypes.set(n.name, n.type);
    });
    const process = (node: Node): void => {
      if (node instanceof BlockNode) {
        const out: StatementNode[] = [];
        for (const stmt of node.statements ?? []) {
          process(stmt);
          if (stmt instanceof AssignNode && stmt.identifier instanceof IdentifierNode
            && stmt.expression instanceof FunctionCallNode) {
            const struct = localTypes.get(stmt.identifier.name);
            if (struct instanceof StructType && stmt.expression.identifier.name === struct.name) {
              const call = stmt.expression;
              call.parameters.forEach((arg, index) => {
                const fieldIndex = call.fieldNames
                  ? struct.fields.findIndex((f) => f.name === call.fieldNames![index])
                  : index;
                const fieldType = struct.fields[fieldIndex]?.type;
                if (arg instanceof NewArrayNode && fieldType instanceof ArrayType) {
                  const name = `__mem_ctor_ref_${this.counter++}`;
                  const decl = new VariableDefinitionNode(fieldType, ['memory'], name, arg);
                  decl.location = stmt.location;
                  out.push(decl);
                  const id = new IdentifierNode(name);
                  id.location = arg.location;
                  call.parameters[index] = id;
                  localTypes.set(name, fieldType);
                }
              });
            }
          }
          out.push(stmt);
        }
        node.statements = out;
        return;
      }
      this.eachChild(node, process);
    };
    process(body);
  }

  // A straight-line named memory-bytes return assigned before Yul is a value blob in the main AST but a pointer
  // in assembly. Move its initializer into a pointer-backed local, let Yul mutate that shared buffer, then
  // serialize it back into the named return at the function boundary.
  private materializeNamedBytesReturn(node: FunctionDefinitionNode): void {
    if (!node.body || node.returnNames.length !== 1 || node.returnTypes.length !== 1) return;
    const returnType = node.returnTypes[0];
    if (!(this.isHandledMemBytes(returnType) || this.isHandledMemString(returnType))
      || !node.returnModifiers[0]?.includes('memory')) return;
    const returnName = node.returnNames[0];
    const statements = node.body.statements ?? [];
    const assignments = statements
      .map((statement, index) => ({ statement, index }))
      .filter(({ statement }) => statement instanceof AssignNode
        && statement.identifier instanceof IdentifierNode && statement.identifier.name === returnName);
    const nestedAssignments: AssignNode[] = [];
    this.eachDescendant(node.body, (child) => {
      if (child instanceof AssignNode && child.identifier instanceof IdentifierNode
        && child.identifier.name === returnName && !assignments.some(({ statement }) => statement === child)) {
        nestedAssignments.push(child);
      }
    });
    const terminal = statements[statements.length - 1];
    const canonicalReturn = terminal instanceof ReturnNode && terminal.expressions.length === 1
      && terminal.expressions[0] instanceof IdentifierNode && terminal.expressions[0].name === returnName;
    const otherReturn = statements.some((statement) => statement instanceof ReturnNode && statement !== terminal);
    if (assignments.length > 1 || otherReturn || (terminal instanceof ReturnNode && !canonicalReturn)) return;
    let usedInYul = false;
    this.eachDescendant(node.body, (n) => {
      if (!(n instanceof AssemblyStatementNode) || !n.yulBlock) return;
      this.walkYul(n.yulBlock, (child) => {
        if (child instanceof YulPathNode && child.base === returnName) usedInYul = true;
      });
    });
    if (!usedInYul) return;

    // NamedReturnTransformation (which normally runs first) prepends the default local and appends
    // `return out`. The pointer local replaces that default and the terminal return is redirected below.
    const defaultIndex = statements.findIndex((candidate) => candidate instanceof VariableDefinitionNode
      && candidate.name === returnName && candidate.expression === undefined);
    const memName = `__memret_${returnName}_${this.counter++}`;
    // `unchecked { result = new string(n); }` is the OpenZeppelin/Base64 shape: the allocation must retain the
    // unchecked arithmetic context, so it cannot be hoisted into a top-level declaration. Replace the named
    // return's default with a null pointer, rename the nested assignment target, and let visitBlock lower that
    // pointer reassignment in place.
    if (assignments.length === 0 && nestedAssignments.length === 1) {
      if (!canonicalReturn || defaultIndex < 0) return;
      const defaultDecl = statements[defaultIndex];
      this.usesMemory = true;
      this.memBytes.set(memName, returnType instanceof BytesType ? returnType : new BytesType());
      statements.splice(defaultIndex, 1, this.at(new VariableDefinitionNode(
        this.uint(), [], memName, this.intLit(0n),
      ), defaultDecl));
      this.eachDescendant(node.body, (child) => {
        if (child instanceof IdentifierNode && child.name === returnName) child.name = memName;
      });
      this.renameYulPath(node.body, returnName, memName);
      return;
    }
    if (assignments.length === 0) {
      // An uninitialized memory reference has the EVM null pointer (0), rather than a freshly allocated empty
      // bytes block. This matters to assembly which deliberately writes through a named return before assigning
      // it (`mcopy(add(dst, 31), ...)`): address arithmetic must remain relative to zero.
      if (!canonicalReturn || defaultIndex < 0) return;
      const defaultDecl = statements[defaultIndex];
      statements.splice(defaultIndex, 1, this.at(new VariableDefinitionNode(
        returnType, ['memory'], memName, this.intLit(0n),
      ), defaultDecl));
      this.renameYulPath(node.body, returnName, memName);
      (terminal as ReturnNode).expressions = [this.at(new IdentifierNode(memName), terminal)];
      return;
    }

    const { statement } = assignments[0] as { statement: AssignNode; index: number };
    if (canonicalReturn && defaultIndex >= 0) statements.splice(defaultIndex, 1);
    const index = statements.indexOf(statement);
    let init: StatementNode[];
    const sourceName = statement.expression instanceof IdentifierNode ? statement.expression.name : undefined;
    const sourceParam = sourceName !== undefined
      ? node.parameters.find((parameter) => parameter.name === sourceName
        && (this.isHandledMemBytes(parameter.type) || this.isHandledMemString(parameter.type)))
      : undefined;
    if (sourceParam) {
      init = this.deserializeBytesParam(sourceParam, memName, statement);
    } else {
      init = this.deserializeBytesExpression(statement.expression, returnType, memName, statement);
    }
    statements.splice(index, 1, ...init);
    this.renameYulPath(node.body, returnName, memName);
    if (canonicalReturn) {
      (terminal as ReturnNode).expressions = [this.at(new IdentifierNode(memName), terminal)];
    } else {
      const finalAssign = new AssignNode(new IdentifierNode(returnName), new IdentifierNode(memName));
      this.at(finalAssign, node.body);
      statements.push(finalAssign);
    }
  }

  private renameYulPath(body: BlockNode, from: string, to: string): void {
    this.eachDescendant(body, (n) => {
      if (!(n instanceof AssemblyStatementNode) || !n.yulBlock) return;
      this.walkYul(n.yulBlock, (child) => {
        if (child instanceof YulPathNode && child.base === from) child.base = to;
      });
    });
  }

  // ---- P4: pass-by-reference inlining of internal helpers ----

  // Collect internal/private helpers safe to inline for pass-by-reference. Two shapes: a VOID helper (its call is a
  // statement `g(a)`), or a VALUE helper with exactly one non-reference return type and a SINGLE TERMINAL `return E`
  // (its call is the whole RHS of `T n = g(a)` / `n = g(a)`; the return becomes `n = E`). Both exclude self-
  // recursion (would inline forever), custom modifiers (the raw body is spliced, bypassing the wrapper), and no
  // memory-ref param. The gate still decides convert vs fallback per call, so this only bounds WHAT may inline.
  private collectInlinable(node: ContractNode): void {
    this.inlinable = new Map();
    for (const fn of node.functions) {
      if (this.isPassByRefInlinable(fn)) this.inlinable.set(fn.name, fn);
    }
  }

  private isPassByRefInlinable(fn: FunctionDefinitionNode): boolean {
    const vis = fn.visibility;
    if (vis !== 'internal' && vis !== 'private') return false;
    if (fn.customModifiers.length !== 0 || !fn.body) return false;
    if (!fn.parameters.some((p) => this.isRefType(p.type))) return false;
    if (this.bodyHas(fn.body, (n) => n instanceof FunctionCallNode && n.identifier?.name === fn.name)) return false;
    const returns = this.countReturns(fn.body);
    if (fn.returnTypes.length === 0) return returns === 0; // void: no return may splice mid-caller
    // value: one non-ref return type, exactly one return, and it is the terminal statement.
    if (fn.returnTypes.length !== 1 || this.isRefType(fn.returnTypes[0]) || returns !== 1) return false;
    const stmts = fn.body.statements ?? [];
    const last = stmts[stmts.length - 1];
    return last instanceof ReturnNode && (last.expressions?.length ?? 0) === 1;
  }

  private countReturns(body: Node): number {
    let c = 0;
    this.eachDescendant(body, (n) => { if (n instanceof ReturnNode) c += 1; });
    return c;
  }

  private bodyHas(node: Node, pred: (n: Node) => boolean): boolean {
    if (pred(node)) return true;
    let found = false;
    this.eachChild(node, (c) => { if (!found && this.bodyHas(c, pred)) found = true; });
    return found;
  }

  // Replace `g(a)` statement calls to an inlinable helper (where an arg is a memory-ref local) with an inlined
  // scoped block `{ T[] memory __inl_x = a; <renamed g body> }`. Only fires when a memory-ref LOCAL is passed,
  // keeping the blast radius to the genuine pass-by-reference case.
  //
  // Iterated to a FIXPOINT: inlining a helper exposes its `__inl_*` alias bindings as new memory-ref locals, which
  // lets a call one level deeper (a delegation chain `f -> h -> g`) inline on the next pass. The depth cap bounds
  // mutual recursion (`h <-> g`): a call still un-inlined at the cap simply taints its arg via the normal gate, so
  // the whole alias chain falls back to value-copy - non-regressing.
  private inlinePassByRef(body: BlockNode): void {
    if (this.inlinable.size === 0) return;
    for (let depth = 0; depth < 8; depth++) {
      const refLocals = new Set<string>();
      this.eachDescendant(body, (n) => {
        if (n instanceof VariableDefinitionNode && n.type && this.isRefType(n.type)) refLocals.add(n.name);
      });
      if (refLocals.size === 0) return;
      if (!this.rewriteInlineCalls(body, refLocals)) return; // no inline happened -> fixpoint
    }
  }

  // Rewrite one block's statements, inlining eligible calls; recurse into nested blocks (a bare scoped block - e.g.
  // a prior inline - or the sub-blocks of a control-flow statement). Returns whether any call was inlined.
  private rewriteInlineCalls(block: BlockNode, refLocals: Set<string>): boolean {
    let changed = false;
    const out: StatementNode[] = [];
    for (const stmt of block.statements ?? []) {
      const inlined = this.tryInline(stmt, refLocals);
      if (inlined) { out.push(...inlined); changed = true; continue; }
      if (stmt instanceof BlockNode) {
        if (this.rewriteInlineCalls(stmt, refLocals)) changed = true;
      } else if (this.recurseChildBlocks(stmt, refLocals)) {
        changed = true;
      }
      out.push(stmt);
    }
    block.statements = out;
    return changed;
  }

  // Recurse into a statement's direct block children (a control-flow if/else/while/do body). Returns whether any
  // inline happened. Split out of rewriteInlineCalls so the closure is not declared inside its loop.
  private recurseChildBlocks(stmt: Node, refLocals: Set<string>): boolean {
    let changed = false;
    this.eachChild(stmt, (c) => {
      if (c instanceof BlockNode && this.rewriteInlineCalls(c, refLocals)) changed = true;
    });
    return changed;
  }

  private tryInline(stmt: StatementNode, refLocals: Set<string>): StatementNode[] | undefined {
    // Void helper: `g(a);`
    if (stmt instanceof FunctionCallStatementNode) {
      const fn = this.inlinableCallee(stmt.call, refLocals, true);
      return fn ? [this.buildInlineBlock(fn, stmt.call, stmt)] : undefined;
    }
    // Value helper as a decl init: `T n = g(a);` -> hoist `T n;`, then inline with `return E` rewritten to `n = E`.
    if (stmt instanceof VariableDefinitionNode && stmt.expression instanceof FunctionCallNode) {
      const fn = this.inlinableCallee(stmt.expression, refLocals, false);
      if (fn) {
        const holder = this.at(new VariableDefinitionNode(stmt.type, stmt.modifier, stmt.name, undefined), stmt);
        return [holder, this.buildInlineBlock(fn, stmt.expression, stmt, stmt.name)];
      }
    }
    // Value helper as an assign RHS: `n = g(a);` -> inline with `return E` rewritten to `n = E` (n already declared).
    if (stmt instanceof AssignNode && stmt.identifier instanceof IdentifierNode
      && stmt.expression instanceof FunctionCallNode) {
      const fn = this.inlinableCallee(stmt.expression, refLocals, false);
      if (fn) return [this.buildInlineBlock(fn, stmt.expression, stmt, stmt.identifier.name)];
    }
    return undefined;
  }

  // The inlinable helper a call targets, if it matches the wanted void/value shape, arity, and passes a memory-ref
  // local (the pass-by-ref trigger). Undefined otherwise.
  private inlinableCallee(call: FunctionCallNode, refLocals: Set<string>, wantVoid: boolean):
  FunctionDefinitionNode | undefined {
    if (!(call.identifier instanceof IdentifierNode)) return undefined;
    const fn = this.inlinable.get(call.identifier.name);
    if (!fn || fn.parameters.length !== call.parameters.length) return undefined;
    if (wantVoid !== (fn.returnTypes.length === 0)) return undefined;
    if (!call.parameters.some((a) => a instanceof IdentifierNode && refLocals.has(a.name))) return undefined;
    return fn;
  }

  // Build `{ <paramBindings>; <renamed g body> }`. Params + g's locals are renamed to fresh unique names so the
  // flat-namespace gate stays unambiguous across call sites; a memory-ref param binds as an ALIAS decl
  // (`T[] memory __inl_x = <arg>`), a value param as a value copy. Scoped so later passes keep the nesting. When
  // returnTarget is set (a value helper), the terminal `return E` is rewritten to `<returnTarget> = E`.
  private buildInlineBlock(fn: FunctionDefinitionNode, call: FunctionCallNode, src: Node, returnTarget?: string):
  BlockNode {
    const tag = this.counter++;
    const rename = new Map<string, string>();
    for (const p of fn.parameters) rename.set(p.name, `__inl_${p.name}_${tag}`);
    const bodyClone = cloneNode(fn.body) as BlockNode;
    this.eachDescendant(bodyClone, (n) => {
      if (n instanceof VariableDefinitionNode) rename.set(n.name, `__inl_${n.name}_${tag}`);
    });
    this.remapNames(bodyClone, rename);
    if (returnTarget !== undefined) {
      const stmts = bodyClone.statements ?? [];
      const ret = stmts[stmts.length - 1];
      if (ret instanceof ReturnNode && ret.expressions?.length === 1) {
        stmts[stmts.length - 1] = this.at(new AssignNode(new IdentifierNode(returnTarget), ret.expressions[0]), src);
      }
    }
    const bindings = fn.parameters.map((p, i) => this.at(
      new VariableDefinitionNode(p.type, p.modifier, rename.get(p.name)!, this.clone(call.parameters[i])), src));
    const block = new BlockNode([...bindings, ...(bodyClone.statements ?? [])]);
    block.scoped = true;
    return this.at(block, src);
  }

  // Rename every local/param reference found in the map. A state variable (StateAccess/StateAssign) name and a
  // member name (FieldAccess) are never locals, so their `.name` is left alone (children are still walked).
  private remapNames(node: Node, map: Map<string, string>): void {
    if (!(node instanceof StateAccessNode || node instanceof StateAssignNode || node instanceof FieldAccessNode)) {
      const nm = (node as unknown as { name?: unknown }).name;
      if (typeof nm === 'string' && map.has(nm)) (node as unknown as { name: string }).name = map.get(nm)!;
    }
    this.eachChild(node, (c) => this.remapNames(c, map));
  }

  private eachDescendant(node: Node, fn: (n: Node) => void): void {
    fn(node);
    this.eachChild(node, (c) => this.eachDescendant(c, fn));
  }

  // ---- P4 v2 (c): materialize a memory-array param into the buffer for pass-by-reference ----

  // For each memory value-array param passed to an inlinable helper, rename the param's body uses to a fresh name
  // and prepend a deserialize loop copying the ABI value-copy into a buffer array, so the helper mutates it by
  // reference. The param itself is untouched (ABI-stable); only body uses are renamed. If the buffer array does not
  // convert, the deserialize is a harmless extra copy that behaves exactly like the value-copy param (non-regress).
  private materializeParams(node: FunctionDefinitionNode): void {
    if (!node.body) return;
    for (const p of node.parameters) {
      if (this.inlinable.size > 0 && this.isHandledMemArray(p.type)
        && this.paramPassedToInlinable(node.body, p.name)) {
        const memName = `__mem_${p.name}_${this.counter++}`;
        this.remapNames(node.body, new Map([[p.name, memName]]));
        node.body.statements = [...this.deserializeParam(p, memName, node.body), ...(node.body.statements ?? [])];
        continue;
      }
      if ((this.isHandledMemBytes(p.type) || this.isHandledMemString(p.type))
        && p.modifier.includes('memory') && this.paramUsedInAssembly(node.body, p.name)) {
        const memName = `__memb_${p.name}_${this.counter++}`;
        this.eachDescendant(node.body, (n) => {
          if (n instanceof AssemblyStatementNode && n.yulBlock) {
            this.walkYul(n.yulBlock, (y) => {
              if (y instanceof YulPathNode && y.base === p.name) y.base = memName;
            });
          }
        });
        node.body.statements = [...this.deserializeBytesParam(p, memName, node.body), ...(node.body.statements ?? [])];
      }
    }
  }

  private paramUsedInAssembly(body: BlockNode, name: string): boolean {
    let found = false;
    let dedicatedDeployPattern = false;
    this.eachDescendant(body, (n) => {
      if (!(n instanceof AssemblyStatementNode) || !n.yulBlock) return;
      this.walkYul(n.yulBlock, (child) => {
        if (child instanceof YulPathNode && child.base === name) found = true;
        if (child instanceof YulFunctionCallNode && (child.name === 'create' || child.name === 'create2')) {
          dedicatedDeployPattern = true;
        }
      });
    });
    return found && !dedicatedDeployPattern;
  }

  private walkYul(node: YulNode, visit: (node: YulNode) => void): void {
    visit(node);
    for (const value of Object.values(node)) {
      if (value instanceof YulNode) this.walkYul(value, visit);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof YulNode) this.walkYul(item, visit);
      }
    }
  }

  private deserializeBytesParam(p: ParameterNode, memName: string, src: Node): StatementNode[] {
    const idxName = `__mbi_${this.counter++}`;
    const pLen = (): ExpressionNode => new UnaryOpNode(UnaryOperator.SIZE, new IdentifierNode(p.name));
    const allocation = new NewArrayNode(new BytesType(1), pLen());
    allocation.rawBytes = true;
    allocation.type = new BytesType();
    const decl = this.at(new VariableDefinitionNode(p.type, ['memory'], memName, allocation), src);
    const idxDecl = this.at(new VariableDefinitionNode(this.uint(), [], idxName, this.intLit(0n)), src);
    const sourceBytes = new CastNode(new BytesType(), new IdentifierNode(p.name), false);
    const sourceByte = new ArrayAccessNode(sourceBytes, new IdentifierNode(idxName));
    const write = this.at(new ArrayAssignNode(memName, new IdentifierNode(idxName), sourceByte), src);
    const update = this.at(this.assign(idxName, this.add(new IdentifierNode(idxName), this.intLit(1n))), src);
    const cond = this.at(new BinaryOpNode(new IdentifierNode(idxName), BinaryOperator.LT, pLen()), src);
    const loop = this.at(new WhileNode(cond, new BlockNode([write, update])), src);
    return [decl, idxDecl, loop];
  }

  // Materialize an arbitrary bytes-producing value (abi.encode/concat/call result) into the shared memory buffer.
  // Bind the value once, allocate its exact length, then copy each byte; assembly observes `memName` as the numeric
  // pointer while the normal return boundary serializes the buffer back to bytes.
  private deserializeBytesExpression(
    expression: ExpressionNode, type: Type, memName: string, src: Node,
  ): StatementNode[] {
    const valueName = `__mbv_${this.counter++}`;
    const idxName = `__mbi_${this.counter++}`;
    const value = (): IdentifierNode => new IdentifierNode(valueName);
    const valueDecl = this.at(new VariableDefinitionNode(type, [], valueName, expression), src);
    const valueLen = (): ExpressionNode => new UnaryOpNode(UnaryOperator.SIZE, value());
    const allocation = new NewArrayNode(new BytesType(1), valueLen());
    allocation.rawBytes = true;
    allocation.type = new BytesType();
    const decl = this.at(new VariableDefinitionNode(type, ['memory'], memName, allocation), src);
    const idxDecl = this.at(new VariableDefinitionNode(this.uint(), [], idxName, this.intLit(0n)), src);
    const sourceBytes = new CastNode(new BytesType(), value(), false);
    const sourceByte = new ArrayAccessNode(sourceBytes, new IdentifierNode(idxName));
    const write = this.at(new ArrayAssignNode(memName, new IdentifierNode(idxName), sourceByte), src);
    const update = this.at(this.assign(idxName, this.add(new IdentifierNode(idxName), this.intLit(1n))), src);
    const cond = this.at(new BinaryOpNode(new IdentifierNode(idxName), BinaryOperator.LT, valueLen()), src);
    const loop = this.at(new WhileNode(cond, new BlockNode([write, update])), src);
    return [valueDecl, decl, idxDecl, loop];
  }

  private paramPassedToInlinable(body: BlockNode, paramName: string): boolean {
    let found = false;
    this.eachDescendant(body, (n) => {
      if (n instanceof FunctionCallNode && n.identifier instanceof IdentifierNode
        && this.inlinable.has(n.identifier.name)
        && n.parameters.some((a) => a instanceof IdentifierNode && a.name === paramName)) found = true;
    });
    return found;
  }

  // `uint[] memory memName = new uint[](p.length); uint __mi = 0; while (__mi < p.length) { memName[__mi] = p[__mi];
  //  __mi = __mi + 1; }` - copies the value-copy param into a fresh buffer array (the inverse of the return-boundary
  // serialize). memName is a fresh alloc so the gate treats it as a normal memory candidate.
  private deserializeParam(p: ParameterNode, memName: string, src: Node): StatementNode[] {
    const arrT = p.type as ArrayType;
    const idxName = `__mi_${this.counter++}`;
    const pLen = (): ExpressionNode => new UnaryOpNode(UnaryOperator.SIZE, new IdentifierNode(p.name));
    const decl = this.at(new VariableDefinitionNode(arrT, ['memory'], memName,
      new NewArrayNode(arrT.elementType, pLen())), src);
    const idxDecl = this.at(new VariableDefinitionNode(this.uint(), [], idxName, this.intLit(0n)), src);
    const pElem = new ArrayAccessNode(new IdentifierNode(p.name), new IdentifierNode(idxName));
    const write = this.at(new ArrayAssignNode(memName, new IdentifierNode(idxName), pElem), src);
    const update = this.at(this.assign(idxName, this.add(new IdentifierNode(idxName), this.intLit(1n))), src);
    const cond = this.at(new BinaryOpNode(new IdentifierNode(idxName), BinaryOperator.LT, pLen()), src);
    const loop = this.at(new WhileNode(cond, new BlockNode([write, update])), src);
    return [decl, idxDecl, loop];
  }

  // Solidity's ABI decoder returns value-copy arrays in the high-level AST, while inline assembly observes those
  // locals as independently allocated memory pointers. Preserve the single tuple decode, rename only its declared
  // result slot to a temporary value, then copy that value into a normal fresh memory-array candidate. Subsequent
  // high-level and Yul references retain the source name and therefore share the pointer-backed allocation.
  private materializeDecodedArrays(body: BlockNode): void {
    const yulReferenced = new Set<string>();
    this.eachDescendant(body, (n) => {
      if (!(n instanceof AssemblyStatementNode) || !n.yulBlock) return;
      this.walkYul(n.yulBlock, (child) => {
        if (child instanceof YulPathNode) yulReferenced.add(child.base);
      });
    });
    if (yulReferenced.size === 0) return;

    const rewrite = (block: BlockNode): void => {
      const out: StatementNode[] = [];
      for (const statement of block.statements ?? []) {
        if (statement instanceof TupleAssignmentNode && statement.tuple instanceof AbiDecodeNode) {
          const copies: StatementNode[] = [];
          for (const element of statement.elements) {
            if (element.existing || !element.name || !yulReferenced.has(element.name)
              || !this.isHandledMemArray(element.type)) continue;
            const originalName = element.name;
            const valueName = `__mdec_${originalName}_${this.counter++}`;
            element.name = valueName;
            copies.push(...this.deserializeArrayValue(
              valueName, originalName, element.type as ArrayType, statement,
            ));
          }
          out.push(statement, ...copies);
        } else {
          out.push(statement);
        }
        this.eachChild(statement, (child) => {
          if (child instanceof BlockNode) rewrite(child);
        });
      }
      block.statements = out;
    };
    rewrite(body);
  }

  private deserializeArrayValue(
    valueName: string, memName: string, arrT: ArrayType, src: Node,
  ): StatementNode[] {
    const idxName = `__mdi_${this.counter++}`;
    const valueLen = (): ExpressionNode => new UnaryOpNode(
      UnaryOperator.SIZE, new IdentifierNode(valueName),
    );
    const decl = this.at(new VariableDefinitionNode(arrT, ['memory'], memName,
      new NewArrayNode(arrT.elementType, valueLen())), src);
    const idxDecl = this.at(new VariableDefinitionNode(this.uint(), [], idxName, this.intLit(0n)), src);
    const source = new ArrayAccessNode(new IdentifierNode(valueName), new IdentifierNode(idxName));
    const write = this.at(new ArrayAssignNode(memName, new IdentifierNode(idxName), source), src);
    const update = this.at(this.assign(idxName, this.add(new IdentifierNode(idxName), this.intLit(1n))), src);
    const cond = this.at(new BinaryOpNode(new IdentifierNode(idxName), BinaryOperator.LT, valueLen()), src);
    const loop = this.at(new WhileNode(cond, new BlockNode([write, update])), src);
    return [decl, idxDecl, loop];
  }

  // Determine which candidate memory locals are SAFE to convert: every use of the variable, and of every other
  // variable in its alias group, must be a lowering this pass supports. Any unsupported use (pass to a call,
  // return, state assign, abi.encode, reassignment, ...) taints the whole group, which then falls back to
  // value-copy. This is the invariant that makes flag-on non-regressing.

  private analyzeConvertible(body: BlockNode): Set<string> {
    // Fixed arrays only need pointer materialization when assembly observes their address. Keeping ordinary
    // fixed-array locals on the established value path avoids changing return/ABI behavior or materializing huge
    // compile-time bounds that never enter Yul.
    const yulReferenced = new Set<string>();
    this.eachDescendant(body, (n) => {
      if (!(n instanceof AssemblyStatementNode) || !n.yulBlock) return;
      this.walkYul(n.yulBlock, (child) => {
        if (child instanceof YulPathNode) yulReferenced.add(child.base);
      });
    });

    // 1. Classify candidate memory locals + their mem type. Roots: fresh alloc / struct ctor / default. Derived:
    //    a decl whose init is another candidate (ident alias) OR a ref-field/element read of one (`tmp = s.a`) -
    //    resolved to a FIXPOINT (a struct must be known a candidate before its ref-field read makes tmp one).
    const candType = new Map<string, Type>();
    const definitions = new Map<string, VariableDefinitionNode>();
    const derived = new Map<string, ExpressionNode>(); // name -> init whose type derives from another candidate
    const collect = (n: Node): void => {
      if (n instanceof VariableDefinitionNode) {
        definitions.set(n.name, n);
        const ty = n.type;
        const fresh = (n.expression instanceof NewArrayNode && !n.expression.rawBytes)
          || (ty instanceof ArrayType && ty.bound !== undefined && n.expression instanceof ArrayNode
            && yulReferenced.has(n.name))
          // An uninitialized dynamic memory array observed by assembly is a non-null pointer to a zero length
          // word in Solidity's memory model. Materialize it only when Yul needs the pointer; ordinary locals stay
          // on the established value-copy path.
          || (ty instanceof ArrayType && ty.bound === undefined && n.expression === undefined
            && yulReferenced.has(n.name))
          // A fixed memory array declaration without an initializer allocates its EVM word slots zero-filled.
          || (ty instanceof ArrayType && ty.bound !== undefined && n.expression === undefined
            && yulReferenced.has(n.name));
        // A `bytes` buffer root: `new bytes(runtimeN)` (NewArrayNode rawBytes) OR `new bytes(constN)`, which the
        // builder folds to a HexLiteralNode. Literal data is copied into the allocated buffer by lowerBytesDecl.
        // Exclude a HexLiteral carrying a codegenError: `new string(n)` with a NON-constant length folds to an
        // empty placeholder HexLiteral with codegenError set (no BCH analogue), and an empty array's `.every()` is
        // vacuously true - converting it would silently drop the error and allocate 0 bytes. `new bytes` never sets it.
        const freshBytes = (n.expression instanceof NewArrayNode && n.expression.rawBytes)
          || n.expression instanceof StringLiteralNode
          || (n.expression instanceof HexLiteralNode && !n.expression.codegenError)
          // Compiler-generated named memory return retaining Solidity's default null pointer.
          || (n.name.startsWith('__memret_') && n.expression instanceof IntLiteralNode
            && n.expression.value === 0n);
        if ((this.isHandledMemArray(ty) || this.isHandledMemStructArray(ty)) && fresh) candType.set(n.name, ty!);
        else if ((this.isHandledMemBytes(ty) || this.isHandledMemString(ty)) && freshBytes) candType.set(n.name, ty!);
        else if (this.isHandledMemStruct(ty) && (n.expression === undefined || n.expression instanceof FunctionCallNode)) {
          candType.set(n.name, ty!);
        } else if (ty && this.isRefType(ty) && n.expression && !(n.expression instanceof NewArrayNode)) {
          derived.set(n.name, n.expression);
        }
      }
      this.eachChild(n, collect);
    };
    collect(body);
    const resolveType = (expr: ExpressionNode): Type | undefined => {
      if (expr instanceof IdentifierNode) return candType.get(expr.name);
      if (expr instanceof FieldAccessNode) {
        const b = resolveType(expr.expression);
        if (b instanceof StructType) {
          const i = this.fieldIndex(b, expr.name);
          const ft = i >= 0 ? b.fields[i].type : undefined;
          if (ft && this.isRefType(ft)) return ft;
        }
        return undefined;
      }
      if (expr instanceof ArrayAccessNode || expr instanceof TupleIndexOpNode) {
        const b = resolveType(expr instanceof ArrayAccessNode ? expr.array : expr.tuple);
        if (b instanceof ArrayType && this.isRefType(b.elementType)) return b.elementType;
      }
      return undefined;
    };
    for (let changed = true; changed;) {
      changed = false;
      for (const [name, init] of derived) {
        if (candType.has(name)) continue;
        const rt = resolveType(init);
        if (rt) { candType.set(name, rt); changed = true; }
      }
    }
    const candidates = new Set<string>(candType.keys());
    if (candidates.size === 0) return new Set();
    const structCands = new Map<string, StructType>();
    const structArrayCands = new Map<string, ArrayType>();
    for (const [name, ty] of candType) {
      if (ty instanceof StructType) structCands.set(name, ty);
      else if (this.isHandledMemStructArray(ty)) structArrayCands.set(name, ty as ArrayType);
    }

    // 2. Union-find alias groups: a derived candidate shares the group of its init's base variable (`tmp = s.a`
    //    joins s's group), so a taint anywhere in the group falls the whole group back together.
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      let r = x;
      while (parent.get(r) !== undefined && parent.get(r) !== r) r = parent.get(r)!;
      return r;
    };
    const union = (a: string, b: string): void => { parent.set(find(a), find(b)); };
    const baseVar = (expr: ExpressionNode): string | undefined => {
      if (expr instanceof IdentifierNode) return expr.name;
      if (expr instanceof FieldAccessNode) return baseVar(expr.expression);
      if (expr instanceof ArrayAccessNode) return baseVar(expr.array);
      if (expr instanceof TupleIndexOpNode) return baseVar(expr.tuple);
      return undefined;
    };
    for (const c of candidates) if (!parent.has(c)) parent.set(c, c);
    for (const [name, init] of derived) {
      if (!candidates.has(name)) continue;
      const bv = baseVar(init);
      if (bv && candidates.has(bv)) union(name, bv);
    }
    // A candidate pointer stored into a struct field (a ref-typed constructor arg, in `S s = S(arr,..)` or a
    // rebuild `s = S(tmp,..)`) shares the struct's fate: if the struct falls back to value-copy the arg cannot be
    // a pointer, and vice versa. Union them.
    const unionCtorArgs = (structName: string, ctor: FunctionCallNode): void => {
      for (const arg of ctor.parameters) {
        const bv = baseVar(arg);
        if (bv && candidates.has(bv)) union(structName, bv);
      }
    };
    const scanUnions = (n: Node): void => {
      if (n instanceof VariableDefinitionNode && structCands.has(n.name) && n.expression instanceof FunctionCallNode) {
        unionCtorArgs(n.name, n.expression);
      } else if (n instanceof AssignNode && n.identifier instanceof IdentifierNode
        && structCands.has(n.identifier.name) && n.expression instanceof FunctionCallNode) {
        unionCtorArgs(n.identifier.name, n.expression);
      }
      this.eachChild(n, scanUnions);
    };
    scanUnions(body);

    // 3. Taint: walk every use; anything that is not a supported consumer of a candidate taints that candidate.
    const tainted = new Set<string>();
    // A VALUE-element array candidate (index r/w yields a value): a candidate that is not a struct/struct-array.
    const isValueArr = (e: unknown): e is IdentifierNode =>
      e instanceof IdentifierNode && candidates.has(e.name)
      && !structArrayCands.has(e.name) && !structCands.has(e.name);
    const isCallArrayArg = (e: unknown): e is IdentifierNode =>
      isValueArr(e) && candType.get(e.name) instanceof ArrayType;
    const isBytesPtr = (e: unknown): e is IdentifierNode =>
      e instanceof IdentifierNode && candidates.has(e.name)
      && (this.isHandledMemBytes(candType.get(e.name)) || this.isHandledMemString(candType.get(e.name)));
    // The base identifier of `arr[i]` (ArrayAccess or numeric-literal TupleIndexOp), if it is a struct-array cand.
    const structArrBase = (e: unknown): string | undefined => {
      if (e instanceof ArrayAccessNode && e.array instanceof IdentifierNode && structArrayCands.has(e.array.name)) {
        return e.array.name;
      }
      if (e instanceof TupleIndexOpNode && e.tuple instanceof IdentifierNode && structArrayCands.has(e.tuple.name)) {
        return e.tuple.name;
      }
      return undefined;
    };
    const walk = (n: Node | undefined): void => {
      if (!n) return;
      // Assembly composes with the pointer model: this pass and the Yul lowering share ONE __yulmem buffer with the
      // EVM-faithful [length(32)][data...] layout (base 0x80, free pointer at 0x40), so a candidate the assembly
      // reads/writes stays a POINTER (a uint __yulmem offset). `add(ptr, 0x20)` is then plain uint arithmetic and
      // the mload/mstore lower against the same buffer at the candidate's own offset - no value-copy bridge needed,
      // exactly as EVM assembly expects. Other gate checks (reassignment, pass-to-call, return) still taint. Yul is
      // opaque to this AST walk, so stop here (do not descend into the block as normal AST).
      if (n instanceof AssemblyStatementNode) return;
      // A method / `using`-attached bound call `recv.method(args)` is built as a FunctionCall whose identifier is
      // the QUALIFIED name `recv.method` (the receiver is baked into the name string, NOT a child node). If recv
      // is a candidate, this is an unhandled use -> taint it. (Falls through to walk the args below.)
      if (n instanceof FunctionCallNode && n.identifier?.name.includes('.')) {
        const recv = n.identifier.name.slice(0, n.identifier.name.indexOf('.'));
        if (candidates.has(recv)) tainted.add(recv);
      }
      // `return a;` on a value-element array is HANDLED: the boundary serializes the buffer to a value-copy array
      // (P3), so the pointer never leaks. Other return expressions walk normally.
      if (n instanceof ReturnNode) {
        if (n.expressions?.length === 1 && n.expressions[0] instanceof FunctionCallNode
          && n.expressions[0].parameters.some(isCallArrayArg)) {
          walk(n.expressions[0].identifier);
          n.expressions[0].parameters.forEach((e) => { if (!isCallArrayArg(e)) walk(e); });
          return;
        }
        for (const e of n.expressions ?? []) { if (!isValueArr(e)) walk(e); }
        return;
      }
      // `this.s = a;` writing a value-element array to state is HANDLED: the boundary serializes the buffer to a
      // value-copy array before the state write (P3), so the pointer never leaks. Non-array state writes walk.
      if (n instanceof StateAssignNode) {
        if (!isValueArr(n.expression)) walk(n.expression);
        return;
      }
      // Before symbol resolution rewrites a bare state assignment to StateAssignNode it is still `x = b`.
      // Serializing a byte-buffer pointer at that value-copy boundary is supported below.
      if (n instanceof AssignNode && n.identifier instanceof IdentifierNode
        && !candidates.has(n.identifier.name) && isBytesPtr(n.expression)) return;
      if (n instanceof ArrayAccessNode && isValueArr(n.array)) { walk(n.index); return; }
      if (n instanceof TupleIndexOpNode && isValueArr(n.tuple)) return; // numeric-literal index
      if (n instanceof UnaryOpNode && n.operator === UnaryOperator.SIZE && n.expression instanceof IdentifierNode
        && candidates.has(n.expression.name)) return; // .length (only arrays have it; value or struct element)
      if (n instanceof ArrayAssignNode && isValueArr(new IdentifierNode(n.name))) { walk(n.index); walk(n.value); return; }
      // `delete a` on a memory reference resets its pointer to zero; Yul may subsequently observe that null
      // pointer (e.g. mload(a) == mload(0) == 0).
      if (n instanceof DeleteLocalNode && candidates.has(n.identifier.name)) return;
      // `arr[i] = T(..)` struct-element construct (only a struct ctor value is handled).
      if (n instanceof ArrayAssignNode && structArrayCands.has(n.name)
        && n.value instanceof FunctionCallNode
        && n.value.identifier.name === structArrayCands.get(n.name)!.elementType.toString()) {
        walk(n.index); walk(n.value); return;
      }
      if (n instanceof MappingDeleteNode && candidates.has(n.name) && n.keys.length === 1) { walk(n.keys[0]); return; }
      // A tuple assignment `(x, y) = g()` reassigns each named element - a candidate assigned this way is not a
      // handled write, so taint it. Still walk the RHS (it may use other candidates).
      if (n instanceof TupleAssignmentNode) {
        for (const el of n.elements) if (el.name && candidates.has(el.name)) tainted.add(el.name);
        if (n.tuple) walk(n.tuple);
        n.tupleExpressions?.forEach(walk);
        return;
      }
      // `arr[i].f = v` struct-element field write (single key).
      if (n instanceof MappingFieldAssignNode && structArrayCands.has(n.name) && n.keys.length === 1) {
        walk(n.keys[0]); walk(n.expression); return;
      }
      // `arr[i].f` struct-element field read: FieldAccess over a struct-array index. Walk only the index (a
      // numeric-literal TupleIndexOp has no index expression to walk).
      if (n instanceof FieldAccessNode && structArrBase(n.expression) !== undefined) {
        if (n.expression instanceof ArrayAccessNode) walk(n.expression.index);
        return;
      }
      // Struct member read `s.f` (handled) - ONLY when f is a real field. A `using`-attached bound function
      // (`x.longdata()`) is also FieldAccess(x, name) but name is not a field: it must taint (fall back).
      if (n instanceof FieldAccessNode && n.expression instanceof IdentifierNode
        && structCands.has(n.expression.name)
        && structCands.get(n.expression.name)!.fields.some((f) => f.name === n.name)) return;
      // Struct field write / reassign `s = S(..)` (handled) - only a genuine constructor call for s's own struct
      // type; `s = someFn()` is not handled and must taint. Walk the ctor args (a candidate pointer arg is stored
      // in-place, so it is a handled use - walkCtorArg), keep the LHS.
      if (n instanceof AssignNode && n.identifier instanceof IdentifierNode && structCands.has(n.identifier.name)
        && n.expression instanceof FunctionCallNode
        && n.expression.identifier.name === structCands.get(n.identifier.name)!.name) {
        walkCtor(n.identifier.name, n.expression); return;
      }
      if (n instanceof VariableDefinitionNode && candidates.has(n.name)) {
        if (n.expression instanceof NewArrayNode) walk(n.expression.size); // fresh alloc: bound expr
        else if (n.expression instanceof ArrayNode) n.expression.elements.forEach(walk);
        else if (n.expression instanceof FunctionCallNode) walkCtor(n.name, n.expression); // struct ctor
        // else an ident/field/element alias init (`tmp = s.a`): the edge itself, do not taint the base
        return;
      }
      // Any OTHER reference to a candidate - a bare identifier read, or a name-keyed operation the pass does not
      // handle (push/pop/delete/nested/mapping/state write) - taints it. Name-keyed nodes carry the variable in a
      // string `name` field (not as an IdentifierNode child), so catch both. FieldAccessNode.name is a member
      // name, never a variable, so exclude it (its candidate expression, if any, is caught as a child).
      const nm = (n as unknown as { name?: unknown }).name;
      if (typeof nm === 'string' && candidates.has(nm) && !(n instanceof FieldAccessNode)) tainted.add(nm);
      if (n instanceof IdentifierNode) return;
      this.eachChild(n, walk);
    };
    // A struct constructor `S(a0,a1,..)`: for a REFERENCE field, the arg must be a candidate pointer (a bare
    // identifier of a convertible array/struct) - its pointer is stored in-place. Anything else for a ref field
    // (an inline `new T[]`, a foreign/value-copy array, a call result) means the struct cannot be a pointer
    // struct, so taint it. A value-field arg is walked normally.
    const walkCtor = (structName: string, ctor: FunctionCallNode): void => {
      const st = structCands.get(structName);
      ctor.parameters.forEach((arg, i) => {
        // Named-field ctor reorders: parameter i targets field ctor.fieldNames[i], not position i.
        const fi = st && ctor.fieldNames ? st.fields.findIndex((f) => f.name === ctor.fieldNames![i]) : i;
        const ft = st?.fields[fi]?.type;
        if (ft && this.isRefType(ft)) {
          if (!(arg instanceof IdentifierNode && candidates.has(arg.name))) tainted.add(structName);
        } else {
          walk(arg);
        }
      });
    };
    walk(body);

    // 4. A group is convertible iff no member is tainted.
    const taintedRoots = new Set([...tainted].map(find));
    // Falling an actual alias group back to the legacy value-copy representation silently changes Solidity
    // semantics: a later write through one name is no longer visible through the other. Until every consumer is
    // pointer-lowered, reject such a group instead of emitting observably incorrect bytecode. A single tainted
    // value has no alias to observe and can safely retain the legacy representation.
    const groups = new Map<string, string[]>();
    for (const name of candidates) {
      const root = find(name);
      groups.set(root, [...(groups.get(root) ?? []), name]);
    }
    for (const root of taintedRoots) {
      const names = groups.get(root) ?? [];
      // Compiler-generated __nlv temporaries implement an explicit read/modify/write sequence; they are not
      // source-level aliases whose identity is observable. Require at least two user bindings in the group.
      const observableNames = names.filter((name) => !name.startsWith('__'));
      if (observableNames.length > 1) {
        const definition = definitions.get(observableNames[0]);
        if (definition) throw new UnsupportedMemoryAliasingError(definition, observableNames);
      }
    }
    return new Set([...candidates].filter((c) => !taintedRoots.has(find(c))));
  }

  private eachChild(node: Node, fn: (n: Node) => void): void {
    for (const key of Object.keys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key];
      if (val instanceof Node) fn(val);
      else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) fn(v);
    }
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    for (const stmt of node.statements ?? []) {
      const expanded = stmt instanceof VariableDefinitionNode ? this.tryLowerDecl(stmt) : undefined;
      if (expanded) { out.push(...expanded); continue; }
      // Reallocation of a pointer-backed memory bytes/string local (`b = new bytes(n)`). Build the same
      // allocation sequence as a declaration, replacing only its first pointer declaration with an assignment
      // to the existing pointer. Keeping this inside the current block preserves `unchecked` arithmetic.
      if (stmt instanceof AssignNode && stmt.identifier instanceof IdentifierNode
        && this.memBytes.has(stmt.identifier.name)
        && (stmt.expression instanceof NewArrayNode || stmt.expression instanceof HexLiteralNode
          || stmt.expression instanceof StringLiteralNode)) {
        const name = stmt.identifier.name;
        const fake = this.at(new VariableDefinitionNode(
          this.memBytes.get(name)!, ['memory'], name, stmt.expression,
        ), stmt);
        const allocation = this.lowerBytesDecl(fake, this.memBytes.get(name));
        if (allocation?.[0] instanceof VariableDefinitionNode) {
          const first = allocation[0] as VariableDefinitionNode;
          out.push(this.at(new AssignNode(new IdentifierNode(name), first.expression!), stmt), ...allocation.slice(1));
          continue;
        }
      }
      // `delete d[i]` on a memory array -> store the element default (0) in place.
      if (stmt instanceof MappingDeleteNode && this.memArrays.has(stmt.name) && stmt.keys.length === 1) {
        const arrT = this.memArrays.get(stmt.name)!;
        const addr = this.elemAddr(new IdentifierNode(stmt.name), this.visit(stmt.keys[0]) as ExpressionNode);
        out.push(this.at(this.mstore(addr, this.intLit(0n), arrT.elementType), stmt));
        continue;
      }
      // `s = S(..)` on a memory struct (a field write `s.f=v` desugars to this) -> store each arg in place. Only a
      // genuine constructor for s's struct type (guarded identically in the gate, so a non-ctor assign falls back).
      if (stmt instanceof AssignNode && stmt.identifier instanceof IdentifierNode
        && this.memStructs.has(stmt.identifier.name) && stmt.expression instanceof FunctionCallNode
        && stmt.expression.identifier.name === this.memStructs.get(stmt.identifier.name)!.name) {
        const structT = this.memStructs.get(stmt.identifier.name)!;
        out.push(...this.storeStructArgs(stmt.identifier, stmt.expression, structT, stmt));
        continue;
      }
      // `arr[i] = T(..)` on a struct-element array -> allocate a T block, store its pointer at arr[i].
      if (stmt instanceof ArrayAssignNode && this.memStructArrays.has(stmt.name)
        && stmt.value instanceof FunctionCallNode) {
        const structT = this.memStructArrays.get(stmt.name)!.elementType as StructType;
        if (stmt.value.identifier.name === structT.name) {
          const sp = `__sp_${this.counter++}`;
          out.push(...this.allocStructBlock(sp, structT, stmt.value, stmt));
          const addr = this.elemAddr(new IdentifierNode(stmt.name), this.visit(stmt.index) as ExpressionNode);
          out.push(this.at(this.mstore(addr, new IdentifierNode(sp), this.uint()), stmt));
          continue;
        }
      }
      // `arr[i].f = v` on a struct-element array -> single in-place store at (arr[i] ptr) + 32*fieldIndex.
      if (stmt instanceof MappingFieldAssignNode && this.memStructArrays.has(stmt.name) && stmt.keys.length === 1) {
        const structT = this.memStructArrays.get(stmt.name)!.elementType as StructType;
        const fi = this.fieldIndex(structT, stmt.fieldName);
        if (fi >= 0) {
          const elemPtr = this.structElemPtr(stmt.name, this.visit(stmt.keys[0]) as ExpressionNode);
          const addr = this.fieldAddr(elemPtr, fi);
          out.push(this.at(this.mstore(addr, this.visit(stmt.expression) as ExpressionNode, structT.fields[fi].type), stmt));
          continue;
        }
      }
      // `return b;` / `this.s = b;` on a memory bytes pointer -> serialize to the value-copy data slice
      // __yulmem[b+32 : b+32+b.length], so the pointer never crosses the export boundary.
      if (stmt instanceof ReturnNode && stmt.expressions?.length === 1
        && stmt.expressions[0] instanceof IdentifierNode && this.memBytes.has(stmt.expressions[0].name)) {
        out.push(this.at(new ReturnNode([this.serializeBytes(stmt.expressions[0].name, stmt)]), stmt));
        continue;
      }
      if (stmt instanceof StateAssignNode && stmt.expression instanceof IdentifierNode
        && this.memBytes.has(stmt.expression.name)) {
        const sa = new StateAssignNode(stmt.name, this.serializeBytes(stmt.expression.name, stmt));
        sa.fromModifier = stmt.fromModifier;
        out.push(this.at(sa, stmt));
        continue;
      }
      if (stmt instanceof AssignNode && stmt.identifier instanceof IdentifierNode
        && stmt.expression instanceof IdentifierNode && this.memBytes.has(stmt.expression.name)
        && !this.memBytes.has(stmt.identifier.name)) {
        out.push(this.at(new AssignNode(
          new IdentifierNode(stmt.identifier.name),
          this.serializeBytes(stmt.expression.name, stmt),
        ), stmt));
        continue;
      }
      // `return a;` on a memory value-array -> serialize the buffer block into a fresh value-copy array and return
      // that (P3 boundary serialization), so the array can be a memory-model pointer (aliasing/composition) while
      // still crossing the export boundary in the value-copy blob format.
      if (stmt instanceof ReturnNode && stmt.expressions?.length === 1
        && stmt.expressions[0] instanceof IdentifierNode && this.memArrays.has(stmt.expressions[0].name)) {
        const an = stmt.expressions[0].name;
        out.push(...this.serializeArrayReturn(an, this.memArrays.get(an)!, stmt));
        continue;
      }
      // A pointer-backed array passed directly to a call in a return expression crosses back into the normal
      // value-copy ABI. Serialize each direct argument first, then call with the resulting fixed/dynamic array.
      if (stmt instanceof ReturnNode && stmt.expressions?.length === 1
        && stmt.expressions[0] instanceof FunctionCallNode) {
        const call = stmt.expressions[0];
        const setup: StatementNode[] = [];
        call.parameters = call.parameters.map((arg) => {
          if (!(arg instanceof IdentifierNode) || !this.memArrays.has(arg.name)) return arg;
          const serialized = this.serializeArray(arg.name, this.memArrays.get(arg.name)!, stmt);
          setup.push(...serialized.stmts);
          return this.at(new IdentifierNode(serialized.serName), arg);
        });
        if (setup.length > 0) {
          out.push(...setup, this.visit(stmt) as StatementNode);
          continue;
        }
      }
      // `this.s = a;` writing a memory value-array to state -> serialize the buffer into a fresh value-copy array
      // and write that (P3 boundary serialization), so the array can be a memory-model pointer (aliasing) while
      // the state write still receives the value-copy blob the state encoder expects.
      if (stmt instanceof StateAssignNode && stmt.expression instanceof IdentifierNode
        && this.memArrays.has(stmt.expression.name)) {
        const an = stmt.expression.name;
        const { stmts, serName } = this.serializeArray(an, this.memArrays.get(an)!, stmt);
        out.push(...stmts);
        const sa = new StateAssignNode(stmt.name, new IdentifierNode(serName));
        sa.fromModifier = stmt.fromModifier;
        out.push(this.at(sa, stmt));
        continue;
      }
      out.push(this.visit(stmt) as StatementNode);
    }
    node.statements = out;
    return node;
  }

  // Serialize a memory value-array pointer into a fresh value-copy array local `__ser`; returns the setup
  // statements and the local's name:
  //   uint[] __ser = new uint[](a.length); uint __i = 0; while (__i < a.length) { __ser[__i] = a[__i]; __i++; }
  // Uses value-copy `new T[]` + element writes (correct blob format) with the element values loaded from the
  // buffer, avoiding any manual re-encoding of the packed value-copy layout. Shared by every export boundary.
  private serializeArray(arrName: string, arrT: ArrayType, src: Node): { stmts: StatementNode[]; serName: string } {
    const serName = `__ser_${this.counter++}`;
    if (arrT.bound !== undefined) {
      const elements = Array.from({ length: arrT.bound }, (_, i) =>
        this.mload(this.elemAddr(new IdentifierNode(arrName), this.intLit(BigInt(i))), arrT.elementType));
      const literal = this.at(new ArrayNode(elements), src);
      literal.type = arrT;
      return {
        stmts: [this.at(new VariableDefinitionNode(arrT, [], serName, literal), src)],
        serName,
      };
    }
    const idxName = `__seri_${this.counter++}`;
    const lenAt = (): ExpressionNode => this.mload(new IdentifierNode(arrName), this.uint()); // a.length word
    // uint[] __ser = new uint[](a.length);  (a fresh value-copy array - emitted post-analysis, not converted)
    const serDecl = this.at(new VariableDefinitionNode(arrT, [], serName,
      new NewArrayNode(arrT.elementType, lenAt())), src);
    const idxDecl = this.at(new VariableDefinitionNode(this.uint(), [], idxName, this.intLit(0n)), src);
    // __ser[__i] = a[__i];  (value-copy write of the buffer-loaded element)
    const elemRead = this.mload(this.elemAddr(new IdentifierNode(arrName), new IdentifierNode(idxName)), arrT.elementType);
    const write = this.at(new ArrayAssignNode(serName, new IdentifierNode(idxName), elemRead), src);
    const update = this.at(this.assign(idxName,
      this.add(new IdentifierNode(idxName), this.intLit(1n))), src);
    const cond = this.at(new BinaryOpNode(new IdentifierNode(idxName), BinaryOperator.LT, lenAt()), src);
    const loop = this.at(new WhileNode(cond, new BlockNode([write, update])), src);
    return { stmts: [serDecl, idxDecl, loop], serName };
  }

  // `return a;` on a memory value-array -> serialize the buffer then return the value-copy array.
  private serializeArrayReturn(arrName: string, arrT: ArrayType, src: Node): StatementNode[] {
    const { stmts, serName } = this.serializeArray(arrName, arrT, src);
    return [...stmts, this.at(new ReturnNode([new IdentifierNode(serName)]), src)];
  }

  // Serialize a bytes pointer to its value-copy data: __yulmem[b+32 : b+32+b.length] - the length data bytes.
  private serializeBytes(bytesName: string, src: Node): ExpressionNode {
    const dataStart = this.add(new IdentifierNode(bytesName), this.intLit(WORD));
    const len = this.mload(new IdentifierNode(bytesName), this.uint());
    const slice = new SliceNode(this.mem(YULMEM), dataStart, this.add(this.clone(dataStart), len));
    slice.type = new BytesType();
    return this.at(slice, src);
  }

  // `T[] memory a = new T[](n)` -> allocate a length-prefixed block in `__yulmem`; `T[] memory b = a` -> pointer
  // copy (alias). Returns the replacement statements, or undefined if this decl is not a handled memory array.
  private tryLowerDecl(node: VariableDefinitionNode): StatementNode[] | undefined {
    const t = node.type;
    if (!this.convertible.has(node.name)) return undefined;
    if (this.isHandledMemStruct(t)) return this.lowerStructDecl(node, t as StructType);
    if (this.isHandledMemBytes(t) || this.isHandledMemString(t)) return this.lowerBytesDecl(node, t);
    const isStructArr = this.isHandledMemStructArray(t);
    if (!this.isHandledMemArray(t) && !isStructArr) return undefined;
    const arrT = t as ArrayType;

    // Pointer-valued init: `T[] b = a` (alias), `T[] tmp = s.a` (ref-field read), `T[] tmp = s.ts[j]` etc. -> the
    // new local holds the same pointer (shares the buffer). resolvePtr classifies which track it belongs to.
    if (node.expression) {
      const r = this.resolvePtr(node.expression);
      if (r) {
        this.usesMemory = true;
        if (this.isHandledMemStructArray(r.memType)) this.memStructArrays.set(node.name, r.memType as ArrayType);
        else if (this.isHandledMemStruct(r.memType)) this.memStructs.set(node.name, r.memType as StructType);
        else this.memArrays.set(node.name, r.memType as ArrayType);
        return [this.at(new VariableDefinitionNode(this.uint(), [], node.name, r.ptr), node)];
      }
    }

    // Allocation: `T[] memory a = new T[](n)`. Struct-element arrays use the same length-prefixed block (elements
    // are pointer words, zero = null); only the tracking map differs.
    if (node.expression instanceof NewArrayNode && !node.expression.rawBytes) {
      this.usesMemory = true;
      if (isStructArr) this.memStructArrays.set(node.name, arrT);
      else this.memArrays.set(node.name, arrT);
      const n = node.expression.size;
      const ptr = new IdentifierNode(node.name);
      // uint a = mload(0x40);   (read the free pointer)
      const decl = this.at(new VariableDefinitionNode(this.uint(), [], node.name, this.freePtr()), node);
      // mstore(0x40, a + 32 + n*32);   (bump the free pointer past this block)
      const bump = this.at(this.setFreePtr(this.add(this.clone(ptr), this.blockBytes(this.clone(n)))), node);
      // __yulmem = bytes.concat(__yulmem, new bytes(32 + n*32));   (grow by the block size, zero-filled)
      const grow = this.at(this.assign(YULMEM,
        new BytesConcatNode([this.mem(YULMEM), this.rawBytes(this.blockBytes(this.clone(n)))])), node);
      // __yulmem = <store n at a>;   (the length word)
      const setLen = this.at(this.mstore(this.at(this.clone(ptr), node), this.clone(n), arrT.elementType), node);
      return [decl, bump, grow, setLen];
    }

    // `T[] memory a;` observed from assembly points at an allocated zero length word. In particular, its pointer
    // is nonzero even though `mload(a) == 0`.
    if (arrT.bound === undefined && node.expression === undefined) {
      this.usesMemory = true;
      this.memArrays.set(node.name, arrT);
      const ptr = new IdentifierNode(node.name);
      const size = this.intLit(WORD);
      const decl = this.at(new VariableDefinitionNode(this.uint(), [], node.name, this.freePtr()), node);
      const bump = this.at(this.setFreePtr(this.add(this.clone(ptr), this.clone(size))), node);
      const grow = this.at(this.assign(YULMEM,
        new BytesConcatNode([this.mem(YULMEM), this.rawBytes(this.clone(size))])), node);
      return [decl, bump, grow];
    }

    // `T[N] memory a;`: fixed arrays have no length header in EVM memory; the pointer names element zero and the
    // declaration allocates N zero-filled 32-byte slots.
    if (arrT.bound !== undefined && (node.expression === undefined || node.expression instanceof ArrayNode)) {
      this.usesMemory = true;
      this.memArrays.set(node.name, arrT);
      const ptr = new IdentifierNode(node.name);
      const size = this.intLit(BigInt(arrT.bound) * WORD);
      const decl = this.at(new VariableDefinitionNode(this.uint(), [], node.name, this.freePtr()), node);
      const bump = this.at(this.setFreePtr(this.add(this.clone(ptr), this.clone(size))), node);
      const grow = this.at(this.assign(YULMEM,
        new BytesConcatNode([this.mem(YULMEM), this.rawBytes(this.clone(size))])), node);
      const stores = node.expression instanceof ArrayNode
        ? node.expression.elements.map((element, i) => this.at(this.mstore(
          this.elemAddr(this.clone(ptr), this.intLit(BigInt(i))), element, arrT.elementType,
        ), node))
        : [];
      return [decl, bump, grow, ...stores];
    }

    return undefined;
  }

  // `S memory s = S(a0,..)` / `S memory s;` -> malloc(32*k) a zero-filled block, then store each constructor arg
  // (an uninitialized struct leaves the zeros = all fields default). Pointer-valued init `S memory b = a` (alias)
  // or `S memory tmp = base.child` (ref-field read) shares the pointer, so a field write through the new name is
  // visible through the original (Solidity struct-reference aliasing); resolvePtr classifies the source.
  private lowerStructDecl(node: VariableDefinitionNode, structT: StructType): StatementNode[] {
    if (node.expression && !(node.expression instanceof FunctionCallNode)) {
      const r = this.resolvePtr(node.expression);
      if (r && this.isHandledMemStruct(r.memType)) {
        this.usesMemory = true;
        this.memStructs.set(node.name, r.memType as StructType);
        return [this.at(new VariableDefinitionNode(this.uint(), [], node.name, r.ptr), node)];
      }
    }
    this.memStructs.set(node.name, structT);
    const ctor = node.expression instanceof FunctionCallNode ? node.expression : undefined;
    return this.allocStructBlock(node.name, structT, ctor, node);
  }

  // `bytes memory b = new bytes(n)` -> allocate a zero-filled [length(32)][data] block (data word-aligned so an
  // assembly word-store stays inside the allocation); `bytes b = a` -> pointer alias. A constant `new bytes(constN)`
  // reaches here as an all-zero HexLiteralNode. String literals are copied into the allocated data words.
  private lowerBytesDecl(node: VariableDefinitionNode, bytesT: Type | undefined): StatementNode[] | undefined {
    if (node.name.startsWith('__memret_') && node.expression instanceof IntLiteralNode
      && node.expression.value === 0n) {
      this.usesMemory = true;
      this.memBytes.set(node.name, bytesT instanceof BytesType ? bytesT : new BytesType());
      return [this.at(new VariableDefinitionNode(this.uint(), [], node.name, this.intLit(0n)), node)];
    }
    if (node.expression instanceof IdentifierNode && this.byteConstantValues.has(node.expression.name)) {
      node.expression = cloneNode(this.byteConstantValues.get(node.expression.name)!) as HexLiteralNode | StringLiteralNode;
    }
    const isHex = node.expression instanceof HexLiteralNode;
    const isString = node.expression instanceof StringLiteralNode;
    const isAlloc = node.expression instanceof NewArrayNode || isHex || isString;
    // Pointer-valued init (alias / ref-field read): share the pointer.
    if (node.expression && !isAlloc) {
      const r = this.resolvePtr(node.expression);
      if (r && this.isHandledMemBytes(r.memType)) {
        this.usesMemory = true;
        this.memBytes.set(node.name, r.memType as BytesType);
        return [this.at(new VariableDefinitionNode(this.uint(), [], node.name, r.ptr), node)];
      }
      return undefined;
    }
    if (!isAlloc) return undefined;
    this.usesMemory = true;
    // A `string` local rides the same byte-buffer track; memBytes only marks "this name is a byte-buffer pointer",
    // so store a canonical unbounded BytesType (the boundary serializer emits an unbounded-bytes slice, which is
    // assignable to a `string` return/state var - see types.ts string<->bytes rules).
    this.memBytes.set(node.name, bytesT instanceof BytesType ? bytesT : new BytesType());
    // Length: the runtime size expr for `new bytes(n)`, or the (zero) literal's byte length for the folded constant.
    const literal = isString ? encodeString((node.expression as StringLiteralNode).value)
      : isHex ? (node.expression as HexLiteralNode).value : undefined;
    const n = (): ExpressionNode => (literal
      ? this.intLit(BigInt(literal.length))
      : this.clone((node.expression as NewArrayNode).size));
    const ptr = new IdentifierNode(node.name);
    // uint b = mload(0x40);
    const decl = this.at(new VariableDefinitionNode(this.uint(), [], node.name, this.freePtr()), node);
    // mstore(0x40, b + 32 + roundUp(n, 32));   (bump past the length word + word-aligned data)
    const bump = this.at(this.setFreePtr(this.add(this.clone(ptr), this.bytesBlockBytes(n()))), node);
    // __yulmem = bytes.concat(__yulmem, new bytes(32 + roundUp(n, 32)));   (grow, zero-filled)
    const grow = this.at(this.assign(YULMEM,
      new BytesConcatNode([this.mem(YULMEM), this.rawBytes(this.bytesBlockBytes(n()))])), node);
    // __yulmem = <store n at b>;   (the byte length)
    const setLen = this.at(this.mstore(this.at(this.clone(ptr), node), n(), this.uint()), node);
    const stores: StatementNode[] = [];
    if (literal?.some((byte) => byte !== 0)) {
      for (let offset = 0; offset < literal.length; offset += Number(WORD)) {
        const word = new Uint8Array(Number(WORD));
        word.set(literal.slice(offset, offset + Number(WORD)));
        stores.push(this.at(this.mstore(
          this.add(this.clone(ptr), this.intLit(WORD + BigInt(offset))),
          new HexLiteralNode(word),
          new BytesType(32),
        ), node));
      }
    }
    return [decl, bump, grow, setLen, ...stores];
  }

  // Allocate a struct block at `ptrName = mload(0x40)` (bump the in-buffer free pointer + grow), then store the
  // constructor args (if any). Used by both a named struct decl and an anonymous struct-array element block.
  private allocStructBlock(ptrName: string, structT: StructType, ctor: FunctionCallNode | undefined, src: Node):
  StatementNode[] {
    this.usesMemory = true;
    const size = BigInt(32 * structT.fields.length);
    const decl = this.at(new VariableDefinitionNode(this.uint(), [], ptrName, this.freePtr()), src);
    const bump = this.at(this.setFreePtr(this.add(new IdentifierNode(ptrName), this.intLit(size))), src);
    const grow = this.at(this.assign(YULMEM,
      new BytesConcatNode([this.mem(YULMEM), this.rawBytes(this.intLit(size))])), src);
    const out: StatementNode[] = [decl, bump, grow];
    if (ctor) out.push(...this.storeStructArgs(new IdentifierNode(ptrName), ctor, structT, src));
    return out;
  }

  // Store each constructor argument at its field slot (`s + 32*i`). Reads ALL args into temps first, then stores,
  // so a self-referential rebuild (`s = S(s.f1, s.f0)`, or the `s.f=v` field-write desugar `s = S(s.f0,v,s.f2)`)
  // matches value-copy's read-old-then-write semantics regardless of arg/field ordering.
  private storeStructArgs(ptr: IdentifierNode, ctor: FunctionCallNode, structT: StructType, src: Node): StatementNode[] {
    const temps: StatementNode[] = [];
    const stores: StatementNode[] = [];
    ctor.parameters.forEach((arg, i) => {
      // Named-field construction `S({b: x, a: y})` reorders args: parameter i is the value for field
      // ctor.fieldNames[i], NOT positional field i. Map to the actual field slot.
      const fi = ctor.fieldNames ? this.fieldIndex(structT, ctor.fieldNames[i]) : i;
      const tmp = `__ms_${this.counter++}`;
      const fieldT = structT.fields[fi].type;
      // A reference-typed field holds a pointer (uint); a value field holds its own type.
      const tempT = this.isRefType(fieldT) ? this.uint() : fieldT;
      temps.push(this.at(new VariableDefinitionNode(tempT, [], tmp, this.visit(arg) as ExpressionNode), src));
      stores.push(this.at(this.mstore(this.fieldAddr(this.clone(ptr), fi), new IdentifierNode(tmp), fieldT), src));
    });
    return [...temps, ...stores];
  }

  // `a[i] = v` on a memory array -> single in-place store at `a + 32 + i*32`. `b[i] = v` on memory bytes ->
  // single-byte splice at `b + 32 + i`.
  visitArrayAssign(node: ArrayAssignNode): Node {
    if (this.memBytes.has(node.name)) {
      const addr = this.byteAddr(new IdentifierNode(node.name), this.visit(node.index) as ExpressionNode);
      return this.at(this.mstoreByte(addr, this.visit(node.value) as ExpressionNode), node);
    }
    const arrT = this.memArrays.get(node.name);
    if (!arrT) return super.visitArrayAssign(node);
    const addr = this.arrayElemAddr(arrT, new IdentifierNode(node.name), this.visit(node.index) as ExpressionNode);
    return this.at(this.mstore(addr, this.visit(node.value) as ExpressionNode, arrT.elementType), node);
  }

  visitDeleteLocal(node: DeleteLocalNode): Node {
    const name = node.identifier.name;
    if (this.memArrays.has(name) || this.memStructArrays.has(name)
      || this.memBytes.has(name) || this.memStructs.has(name)) {
      return this.at(this.assign(name, this.intLit(0n)), node);
    }
    return super.visitDeleteLocal(node);
  }

  // `a[i]` read (variable index) on a memory array -> load at `a + 32 + i*32`. `b[i]` on memory bytes -> the
  // single byte at `b + 32 + i`.
  visitArrayAccess(node: ArrayAccessNode): Node {
    if (node.array instanceof IdentifierNode && this.memBytes.has(node.array.name)) {
      const addr = this.byteAddr(new IdentifierNode(node.array.name), this.visit(node.index) as ExpressionNode);
      return this.at(this.mloadByte(addr), node);
    }
    if (node.array instanceof IdentifierNode && this.memArrays.has(node.array.name)) {
      const arrT = this.memArrays.get(node.array.name)!;
      const addr = this.arrayElemAddr(
        arrT, new IdentifierNode(node.array.name), this.visit(node.index) as ExpressionNode,
      );
      return this.at(this.mload(addr, arrT.elementType), node);
    }
    // Chained base (`s.a[i]`): resolve the array pointer, load the value element.
    const b = this.resolvePtr(node.array);
    if (b && b.memType instanceof ArrayType && !this.isRefType(b.memType.elementType)) {
      const addr = this.arrayElemAddr(b.memType, b.ptr, this.visit(node.index) as ExpressionNode);
      return this.at(this.mload(addr, b.memType.elementType), node);
    }
    return super.visitArrayAccess(node);
  }

  // `a[0]` read (numeric-literal index) parses as a tuple index, not an ArrayAccess -> same load.
  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    if (node.tuple instanceof IdentifierNode && this.memBytes.has(node.tuple.name)) {
      const addr = this.byteAddr(new IdentifierNode(node.tuple.name), this.intLit(BigInt(node.index)));
      return this.at(this.mloadByte(addr), node);
    }
    if (node.tuple instanceof IdentifierNode && this.memArrays.has(node.tuple.name)) {
      const arrT = this.memArrays.get(node.tuple.name)!;
      const addr = this.arrayElemAddr(
        arrT, new IdentifierNode(node.tuple.name), this.intLit(BigInt(node.index)),
      );
      return this.at(this.mload(addr, arrT.elementType), node);
    }
    // Chained base (`s.a[0]`): resolve the array pointer, load the value element.
    const b = this.resolvePtr(node.tuple);
    if (b && b.memType instanceof ArrayType && !this.isRefType(b.memType.elementType)) {
      const addr = this.arrayElemAddr(b.memType, b.ptr, this.intLit(BigInt(node.index)));
      return this.at(this.mload(addr, b.memType.elementType), node);
    }
    return super.visitTupleIndexOp(node);
  }

  // `a.length` parses as the SIZE unary op -> the length word at `a`. Value-copy `.length` is BIGINT (coerces
  // with int and uint); match it so surrounding comparisons type-check identically.
  visitUnaryOp(node: UnaryOpNode): Node {
    if (node.operator === UnaryOperator.SIZE && node.expression instanceof IdentifierNode
      && (this.memArrays.has(node.expression.name) || this.memStructArrays.has(node.expression.name)
        || this.memBytes.has(node.expression.name))) {
      const arrT = this.memArrays.get(node.expression.name) ?? this.memStructArrays.get(node.expression.name);
      if (arrT?.bound !== undefined) return this.at(this.intLit(BigInt(arrT.bound)), node);
      const len = this.mload(new IdentifierNode(node.expression.name), this.uint());
      return this.at(new CastNode(PrimitiveType.BIGINT, len, false), node);
    }
    // `s.a.length` on a chained array pointer -> the length word at the resolved array pointer.
    if (node.operator === UnaryOperator.SIZE) {
      const b = this.resolvePtr(node.expression);
      if (b && b.memType instanceof ArrayType) {
        if (b.memType.bound !== undefined) return this.at(this.intLit(BigInt(b.memType.bound)), node);
        return this.at(new CastNode(PrimitiveType.BIGINT, this.mload(b.ptr, this.uint()), false), node);
      }
    }
    return super.visitUnaryOp(node);
  }

  // `s.f` member read on a memory struct -> load the field word at `s + 32*fieldIndex`.
  visitFieldAccess(node: FieldAccessNode): Node {
    if (node.expression instanceof IdentifierNode && this.memStructs.has(node.expression.name)) {
      const structT = this.memStructs.get(node.expression.name)!;
      const i = this.fieldIndex(structT, node.name);
      if (i >= 0) {
        return this.at(this.mload(this.fieldAddr(new IdentifierNode(node.expression.name), i),
          structT.fields[i].type), node);
      }
    }
    // `arr[i].f` member read on a struct-element array -> load (arr[i] ptr) + 32*fieldIndex.
    const saElem = this.structArrayElem(node.expression);
    if (saElem) {
      const fi = this.fieldIndex(saElem.structT, node.name);
      if (fi >= 0) {
        return this.at(this.mload(this.fieldAddr(saElem.elemPtr, fi), saElem.structT.fields[fi].type), node);
      }
    }
    // Deeper chain value-field leaf (`s.ts[j].y`): resolve the struct pointer, load the value field.
    const b = this.resolvePtr(node.expression);
    if (b && b.memType instanceof StructType) {
      const i = this.fieldIndex(b.memType, node.name);
      if (i >= 0 && !this.isRefType(b.memType.fields[i].type)) {
        return this.at(this.mload(this.fieldAddr(b.ptr, i), b.memType.fields[i].type), node);
      }
    }
    return super.visitFieldAccess(node);
  }

  // If `expr` is `arr[i]` on a struct-element array, return the element struct type + its pointer expression.
  private structArrayElem(expr: ExpressionNode): { structT: StructType, elemPtr: ExpressionNode } | undefined {
    let name: string | undefined;
    let index: ExpressionNode | undefined;
    if (expr instanceof ArrayAccessNode && expr.array instanceof IdentifierNode
      && this.memStructArrays.has(expr.array.name)) {
      name = expr.array.name;
      index = this.visit(expr.index) as ExpressionNode;
    } else if (expr instanceof TupleIndexOpNode && expr.tuple instanceof IdentifierNode
      && this.memStructArrays.has(expr.tuple.name)) {
      name = expr.tuple.name;
      index = this.intLit(BigInt(expr.index));
    }
    if (name === undefined || index === undefined) return undefined;
    const structT = this.memStructArrays.get(name)!.elementType as StructType;
    return { structT, elemPtr: this.structElemPtr(name, index) };
  }

  // ---- desugar building blocks (all normal AST that type-checks + codegens) ----

  // __yulmem init = 128-byte EVM reserved region (scratch 0x00-0x3f, free-memory pointer 0x80 at slot 0x40, zero
  // slot 0x60-0x7f). Identical layout to the Yul runtime __yulmem buffer, so pointers from both passes agree.
  private memReservedInit(): ExpressionNode {
    return buildReservedInit();
  }

  // Read the free-memory pointer (the next allocation offset) from slot 0x40 of the buffer.
  private freePtr(): ExpressionNode {
    return this.mload(this.intLit(0x40n), this.uint());
  }

  // Write the free-memory pointer back to slot 0x40.
  private setFreePtr(value: ExpressionNode): AssignNode {
    return this.mstore(this.intLit(0x40n), value, this.uint());
  }

  // mstore(addr, word): splice bytes32(word) in place at addr. UDVT elements first unwrap to their integer word;
  // all other handled element types already have a directly word-encodable representation.
  private mstore(addr: ExpressionNode, word: ExpressionNode, elemType: Type): AssignNode {
    const raw = elemType instanceof ValueType
      ? new CastNode(elemType.underlyingType, word, false)
      : word;
    raw.location = word.location;
    return memWordStore(() => this.clone(addr), raw);
  }

  // mload(addr): decode the 32-byte word at [addr : addr+32] back to the element type. No pad - the high-level side
  // reads only allocated slots. Lowering lives in ./YulMemPrimitives.
  private mload(addr: ExpressionNode, elemType: Type): ExpressionNode {
    const raw = memWordLoad(() => this.clone(addr), { decodeType: wordDecodeType(elemType) });
    return elemType instanceof ValueType ? new CastNode(elemType, raw, false) : raw;
  }

  // &a[i] = a + 32 + i*32
  private elemAddr(ptr: ExpressionNode, index: ExpressionNode): ExpressionNode {
    return this.add(this.add(ptr, this.intLit(WORD)), new BinaryOpNode(index, BinaryOperator.MUL, this.intLit(WORD)));
  }

  private arrayElemAddr(arrT: ArrayType, ptr: ExpressionNode, index: ExpressionNode): ExpressionNode {
    const offset = new BinaryOpNode(index, BinaryOperator.MUL, this.intLit(WORD));
    return arrT.bound === undefined ? this.add(this.add(ptr, this.intLit(WORD)), offset) : this.add(ptr, offset);
  }

  // &s.field_i = s + 32*i (struct block has no length header)
  private fieldAddr(ptr: ExpressionNode, i: number): ExpressionNode {
    return i === 0 ? ptr : this.add(ptr, this.intLit(BigInt(32 * i)));
  }

  // 32 + n*32: the byte size of a length-prefixed n-element block.
  private blockBytes(n: ExpressionNode): ExpressionNode {
    return this.add(this.intLit(WORD), new BinaryOpNode(n, BinaryOperator.MUL, this.intLit(WORD)));
  }

  // 32 (length word) + roundUp(n, 32) data bytes: the byte size of a `bytes` block. Data is word-aligned (like
  // EVM) so an assembly word-store into the data region stays inside the allocation.
  private bytesBlockBytes(n: ExpressionNode): ExpressionNode {
    const words = new BinaryOpNode(this.add(this.clone(n), this.intLit(31n)), BinaryOperator.DIV, this.intLit(WORD));
    return this.add(this.intLit(WORD), new BinaryOpNode(words, BinaryOperator.MUL, this.intLit(WORD)));
  }

  // &b[i] = b + 32 + i: the byte at data offset i (byte stride; the data region is byte-packed).
  private byteAddr(ptr: ExpressionNode, index: ExpressionNode): ExpressionNode {
    return this.add(this.add(ptr, this.intLit(WORD)), index);
  }

  // b[i] read -> the single byte at addr as bytes1: bytes1(__yulmem[addr : addr+1]).
  private mloadByte(addr: ExpressionNode): ExpressionNode {
    const slice = new SliceNode(this.mem(YULMEM), this.clone(addr), this.add(this.clone(addr), this.intLit(1n)));
    return new CastNode(new BytesType(1), slice, false);
  }

  // b[i] = v write -> splice one byte in place at addr. `val` is byte-typed (b's element), so the byte encoding is
  // fullWord:false (bytes1(v)). Lowering + encoding live in ./YulMemPrimitives.
  private mstoreByte(addr: ExpressionNode, val: ExpressionNode): AssignNode {
    return memByteStore(() => this.clone(addr), val, { fullWord: false });
  }

  // EVM memory arrays use one full 32-byte word per integer element regardless of source width. Decode through
  // the declared IntType so a Yul word store (e.g. 258 into uint8[]) is narrowed on the subsequent high-level
  // read exactly as Solidity does; this is not the packed storage-array representation.
  private isHandledMemArray(t: Type | undefined): boolean {
    return t instanceof ArrayType
      && (t.elementType instanceof IntType
        || (t.elementType instanceof ValueType && t.elementType.underlyingType instanceof IntType))
      && (t.bound === undefined || t.bound <= 4096);
  }

  // Handled: dynamic `bytes` (a byte-packed [length][data] block). `bytesN` (fixed) is a value word, not a block.
  private isHandledMemBytes(t: Type | undefined): boolean {
    return t instanceof BytesType && t.bound === undefined;
  }

  // A `string` local is an unbounded byte buffer on BCH (string == unbounded bytes at the byte level, mutually
  // assignable), so it rides the SAME __yulmem [length][data] block as `bytes memory`. This lets assembly address a
  // `string memory str = new string(n)` buffer directly (OZ ShortStrings.toString: mstore(str,len)/add(str,0x20)).
  private isHandledMemString(t: Type | undefined): boolean {
    return t === PrimitiveType.STRING;
  }

  // A struct each of whose fields is either a 256-bit int (a value word) or a handled ARRAY (int array or
  // struct-array), stored as a pointer word. NESTED STRUCT fields are excluded for now (`b.a.x` nested writes are
  // not yet lowered and must fall back to value-copy, which handles simple nesting). The depth guard bounds
  // recursive struct types so the analysis terminates.
  private isHandledMemStruct(t: Type | undefined, depth = 0): boolean {
    if (depth > 6 || !(t instanceof StructType)) return false;
    return t.fields.every((f) =>
      (f.type instanceof IntType && f.type.bits === 256)
      || this.isHandledMemArray(f.type) || this.isHandledMemStructArray(f.type, depth + 1));
  }

  // A reference (pointer-held) memory type: handled int array, struct-element array, or handled struct.
  private isRefType(t: Type, depth = 0): boolean {
    return this.isHandledMemArray(t) || this.isHandledMemStructArray(t, depth) || this.isHandledMemStruct(t, depth);
  }

  // An unbounded array whose elements are handled structs (`T[] memory`). Elements are POINTERS.
  private isHandledMemStructArray(t: Type | undefined, depth = 0): boolean {
    return t instanceof ArrayType && t.bound === undefined && this.isHandledMemStruct(t.elementType, depth);
  }

  // The struct-pointer stored at `arr[i]` = mload(arr + 32 + i*32).
  private structElemPtr(arrName: string, index: ExpressionNode): ExpressionNode {
    return this.mload(this.elemAddr(new IdentifierNode(arrName), index), this.uint());
  }

  // The field index of `f` in a struct type, or -1.
  private fieldIndex(structT: StructType, f: string): number {
    return structT.fields.findIndex((fld) => fld.name === f);
  }

  // Resolve an expression to the memory pointer it denotes + the type that pointer points to, dereferencing each
  // reference-typed step (mload the pointer word). Returns undefined for a non-memory or value-leaf expr.
  //   ident(x) -> {x, memType}; base.f (f ref field) -> {mload(basePtr+32*i), fieldType};
  //   base[i] (ref element) -> {mload(basePtr+32+i*32), elementType}.
  private resolvePtr(expr: ExpressionNode): { ptr: ExpressionNode, memType: Type } | undefined {
    if (expr instanceof IdentifierNode) {
      const t = this.memArrays.get(expr.name) ?? this.memStructArrays.get(expr.name)
        ?? this.memStructs.get(expr.name) ?? this.memBytes.get(expr.name);
      return t ? { ptr: new IdentifierNode(expr.name), memType: t } : undefined;
    }
    if (expr instanceof FieldAccessNode) {
      const base = this.resolvePtr(expr.expression);
      if (base && base.memType instanceof StructType) {
        const i = this.fieldIndex(base.memType, expr.name);
        const fieldT = i >= 0 ? base.memType.fields[i].type : undefined;
        if (fieldT && this.isRefType(fieldT)) {
          return { ptr: this.mload(this.fieldAddr(base.ptr, i), this.uint()), memType: fieldT };
        }
      }
      return undefined;
    }
    if (expr instanceof ArrayAccessNode || expr instanceof TupleIndexOpNode) {
      const baseExpr = expr instanceof ArrayAccessNode ? expr.array : expr.tuple;
      const idx = expr instanceof ArrayAccessNode
        ? this.visit(expr.index) as ExpressionNode : this.intLit(BigInt(expr.index));
      const base = this.resolvePtr(baseExpr);
      if (base && base.memType instanceof ArrayType && this.isRefType(base.memType.elementType)) {
        return { ptr: this.mload(this.elemAddr(base.ptr, idx), this.uint()), memType: base.memType.elementType };
      }
      return undefined;
    }
    return undefined;
  }

  private uint(): IntType { return new IntType(false, 256); }
  private intLit(v: bigint): IntLiteralNode { return new IntLiteralNode(v); }
  private mem(name: string): IdentifierNode { return new IdentifierNode(name); }
  private add(l: ExpressionNode, r: ExpressionNode): ExpressionNode { return new BinaryOpNode(l, BinaryOperator.PLUS, r); }
  private assign(name: string, expr: ExpressionNode): AssignNode { return new AssignNode(new IdentifierNode(name), expr); }
  private clone(e: ExpressionNode): ExpressionNode { return cloneNode(e) as ExpressionNode; }
  private rawBytes(size: ExpressionNode): NewArrayNode {
    return memZeroBytes(size);
  }

  // Stamp the whole freshly-built tree with the source location (codegen source maps + the optimizer need every
  // node to carry a location). Nodes that already have one - cloned user expressions - keep theirs.
  private at<T extends Node>(node: T, src: Node): T {
    this.stampTree(node, src.location);
    return node;
  }

  private stampTree(node: Node, loc: Node['location']): void {
    if (!node.location) node.location = loc;
    for (const key of Object.keys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key];
      if (val instanceof Node) this.stampTree(val, loc);
      else if (Array.isArray(val)) for (const v of val) if (v instanceof Node) this.stampTree(v, loc);
    }
  }
}
