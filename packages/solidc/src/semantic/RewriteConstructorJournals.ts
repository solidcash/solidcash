/**
 * A4.4 / B7.3: the deployer program's rewrite of a constructor's collection accesses into journal code.
 *
 * At genesis there is no list of entry coins to read or insert into, so `create` keeps one journal per collection: a
 * hidden local of the constructor, a byte string, empty when `create` starts. A write `m[k] = v` appends the record
 * slot ‖ size ‖ value; a read `m[k]` looks for the last record with the key's slot, or gives the value type's
 * default. Step 12 then verifies the finished list the SDK lays out against the journals (A4.4, "The check").
 *
 * The rewrite runs in the deployer program only, right after the helpers the constructor reaches have been inlined
 * into it and before any pass that reasons about collections, so none of those passes acts on the constructor
 * (A4.4, "The journal"). It refuses what the journal cannot carry soundly, with A4.1's reasons:
 * - `genesis-site`: a function the constructor still calls by name that accesses a collection, which would be a
 *   subroutine holding no journal;
 * - `ctor-collection-shape`: an access inside a loop, an access to an array kept as a collection, an iteration, a
 *   write that is not a statement of its own, a statement that accesses a collection and also holds a call that is
 *   not inert, an assignment or an increment or decrement, an access that does not name every key, a value that
 *   takes more than one coin, a write of a struct whose encoding may exceed what an entry holds, and an unsorted
 *   collection.
 */
import {
  ArrayType, BytesType, EnumType, FixedType, IntType, PrimitiveType, StructType, ValueType, isChunkableValueType,
  type Type,
} from '@solidcash/utils';
import {
  ArrayAccessNode, ArrayAssignNode, AssignmentExpressionNode, BlockNode, BranchNode, CollectionIterationNode,
  DoWhileNode, ExpressionNode, ExpressionStatementNode, FunctionCallNode, FunctionDefinitionNode, IdentifierNode,
  IntLiteralNode, JournalAppendNode, JournalLookNode, MappingAccessNode, MappingAssignNode, MappingDeleteNode,
  MappingFieldAssignNode, MethodCallNode, ParameterNode, TupleIndexOpNode, AssignNode, ReturnNode,
  FunctionCallStatementNode,
  Node, SourceFileNode, StatementNode, UnaryOpNode, VariableDefinitionNode, WhileNode, FunctionModifier,
  storageAliasKeys, storageParameterCopies, type CollectionNode,
} from '../ast/AST.js';
import { UnaryOperator } from '../ast/Operator.js';
import { DeployerUnsupportedError } from '../Errors.js';

/** The reserved name of a collection's journal (A3: names starting `__solidcash_` are the compiler's). */
export function journalNameOf(collection: string): string {
  return `__solidcash_journal_${collection}`;
}

const SKIPPED_KEYS = new Set(['location', 'definition', 'resolvedFunction', 'functionReference', 'symbolTable', 'type',
  'referencedContract', 'stateVariable', 'collection', 'sourceCallNode']);

function childrenOf(node: Node): Array<{ key: string; index?: number; child: Node }> {
  const out: Array<{ key: string; index?: number; child: Node }> = [];
  for (const [key, value] of Object.entries(node)) {
    if (SKIPPED_KEYS.has(key)) continue;
    if (value instanceof Node) out.push({ key, child: value });
    else if (Array.isArray(value)) {
      value.forEach((item, index) => { if (item instanceof Node) out.push({ key, index, child: item }); });
    }
  }
  return out;
}

function walk(node: Node, visit: (node: Node) => void, seen = new Set<Node>()): void {
  if (seen.has(node)) return;
  seen.add(node);
  visit(node);
  for (const { child } of childrenOf(node)) walk(child, visit, seen);
}

/** The value bytes an entry holds: its commitment is slot ‖ next ‖ value, at most 128 bytes (A4.4, "Bounds"). */
export const JOURNAL_VALUE_LIMIT = 64;

/**
 * The most bytes a struct's encoding can take: one push per field as `emitPushdataEncode` frames it, a nested struct
 * inline. A string names a field the journal does not bound.
 */
export function journalStructBound(type: Type): number | string {
  const push = (length: number): number => length + (length <= 75 ? 1 : length <= 255 ? 2 : 3);
  if (type instanceof ValueType) return journalStructBound(type.underlyingType);
  if (type === PrimitiveType.BOOL) return 1;
  if (type === PrimitiveType.PUBKEY) return 34;
  // bytes1 is framed as an int-like push of one byte; bytesN, N > 1, as N then N bytes.
  if (type instanceof BytesType && type.bound !== undefined) return type.bound === 1 ? 2 : push(type.bound);
  // `byteWidth` is the sign-magnitude width, the longest minimal script number of the type's range.
  if (type instanceof IntType || type instanceof FixedType) return push(type.byteWidth);
  if (type instanceof StructType) {
    let total = 0;
    for (const field of type.fields) {
      const bound = journalStructBound(field.type);
      if (typeof bound === 'string') return bound;
      total += bound;
    }
    return total;
  }
  return `a field of type ${type.toString()}`;
}

/** A4.4 "Bounds": a record is the slot (32 bytes), the value's size (2 bytes), then the value. */
export const JOURNAL_RECORD_HEADER = 34;

/** A4.4 "Bounds": a journal is one stack item, at most 10,000 bytes. */
export const JOURNAL_ITEM_LIMIT = 10_000;

/** A4.4 "Bounds": the operation budget of a 10,000-byte `create` input, (10,000 + 41) × 800. */
export const CREATE_OPERATION_BUDGET = (10_000 + 41) * 800;

/**
 * The most bytes a value takes in a record, as the write path stores it: an int-like value as a minimal number, a
 * bytesN or a pubkey verbatim, a struct encoded; JOURNAL_VALUE_LIMIT, which every append checks, for any other.
 */
export function journalValueBound(type: Type): number {
  if (type instanceof ValueType) return journalValueBound(type.underlyingType);
  if (type === PrimitiveType.BOOL) return 1;
  if (type instanceof EnumType) return 2;
  if (type instanceof IntType || type instanceof FixedType) return Math.min(JOURNAL_VALUE_LIMIT, type.byteWidth);
  if (type instanceof BytesType && type.bound !== undefined) return Math.min(JOURNAL_VALUE_LIMIT, type.bound);
  if (type === PrimitiveType.PUBKEY) return 33;
  if (type instanceof StructType) {
    const bound = journalStructBound(type);
    return typeof bound === 'number' ? Math.min(JOURNAL_VALUE_LIMIT, bound) : JOURNAL_VALUE_LIMIT;
  }
  return JOURNAL_VALUE_LIMIT;
}

/** A collection's journal in `create`: its append sites, one entry row each, its looks, and its value bound. */
export interface JournalShape {
  readonly appends: number;
  readonly looks: number;
  readonly valueBound: number;
}

/**
 * D22: operation costs of `create`'s journals, measured on traced runs in the BCH 2026 VM and rounded up.
 * - A scan of a journal, per record: 1,971 for the loop's instructions inline, up to 2,373 where the optimizer outlines
 *   its body (`scanRecord`), plus 3.003 per byte of the record and the records after it, which its three splits push
 *   (`scanByte`). Picking the journal first pushes its bytes.
 * - Step 12's second scan, per record: 1,938 (`coverRecord`), 1,268 per entry it is compared with (`coverEntry`), 32
 *   bytes pushed per entry slot it splits (`coverByte` per byte), and 3.003 per journal byte as a scan.
 * - Outside the loops: an append with its row, the census's count of the row included, at most 49,100 with a struct
 *   value built from four fields (`append`); a look, the use of the value included, at most 18,900 (`look`); a written
 *   collection's HEAD and its census, about 23,000 (`collection`); and the copies of the journal (`copyByte` per byte)
 *   and of step 12's list of entry slots (`slotByte` per row and entry).
 */
const JOURNAL_COSTS = {
  scanRecord: 2_400, scanByte: 3.01, coverRecord: 2_000, coverEntry: 1_300, coverByte: 1,
  append: 50_000, look: 20_000, collection: 25_000, copyByte: 3, slotByte: 64,
} as const;

/** The margin the bound keeps over the measured costs. */
const JOURNAL_COST_MARGIN = 1.25;

/**
 * A4.4 "Bounds": an upper bound of the operation cost a journal adds to `create`. Every look and every row of step 12 is
 * taken to scan a journal that holds every append, every row to hold an entry, and step 12's second scan to compare
 * every record with every entry.
 */
export function journalCostBound(shape: JournalShape): number {
  const c = JOURNAL_COSTS;
  const s = shape.appends;
  const r = JOURNAL_RECORD_HEADER + shape.valueBound;
  const bytes = r * s;
  // A scan of s records of r bytes: the j-th record from the end leaves j records to split.
  const scan = s * c.scanRecord + (c.scanByte * r * s * (s + 1)) / 2 + bytes;
  const looks = shape.looks * (c.look + scan);
  if (s === 0) return Math.ceil(JOURNAL_COST_MARGIN * looks);
  const appends = s * c.append + c.copyByte * r * s * s + c.slotByte * s * s;
  // Step 12: a scan for each row, then the second scan, each record against every entry's 32-byte slot.
  const check = c.collection + s * scan + s * c.coverRecord + s * s * c.coverEntry
    + (c.coverByte * 32 * s * s * (s + 1)) / 2 + (c.scanByte * r * s * (s + 1)) / 2 + bytes;
  return Math.ceil(JOURNAL_COST_MARGIN * (appends + looks + check));
}

/**
 * Rewrite the constructor's collection accesses into journal code, and declare the journals. Returns the names of the
 * collections the constructor accesses. Does nothing for a contract with no constructor or no collection access.
 */
export function rewriteConstructorJournals(ast: SourceFileNode): string[] {
  const contract = ast.contract;
  const create = contract.constructorDef;
  if (create?.body === undefined) return [];
  const collections = new Map<string, CollectionNode>(
    contract.collections.map((collection) => [collection.name, collection]),
  );
  const refuse = (node: Node, detail: string): never => {
    throw new DeployerUnsupportedError(node, 'ctor-collection-shape', detail);
  };
  // Before the semantic pass a read is still the parser's index chain: `m[k]` an ArrayAccessNode, a literal key a
  // TupleIndexOpNode, `m[a][b]` a chain of them over the bare name; `this.m[k]` and a nested write are already
  // mapping nodes, and `m[k] = v` (also `m[k] += v`) is an ArrayAssignNode. A name means the collection, since no
  // declaration in the constructor may take a collection's name (refused below).
  const flattenChain = (node: Node): { name: string; keys: ExpressionNode[] } | undefined => {
    const keys: ExpressionNode[] = [];
    let current: Node = node;
    for (;;) {
      if (current instanceof ArrayAccessNode) {
        keys.unshift(current.index);
        current = current.array;
      } else if (current instanceof TupleIndexOpNode) {
        const key = new IntLiteralNode(BigInt(current.index));
        key.location = current.location;
        keys.unshift(key);
        current = current.tuple;
      } else break;
    }
    if (keys.length === 0 || !(current instanceof IdentifierNode) || !collections.has(current.name)) return undefined;
    return { name: current.name, keys };
  };
  const namesCollection = (node: Node): string | undefined => {
    if (node instanceof MappingAccessNode || node instanceof MappingAssignNode || node instanceof MappingFieldAssignNode
      || node instanceof MappingDeleteNode || node instanceof ArrayAssignNode) {
      return collections.has(node.name) ? node.name : undefined;
    }
    if (node instanceof ArrayAccessNode || node instanceof TupleIndexOpNode) return flattenChain(node)?.name;
    if (node instanceof CollectionIterationNode) {
      return collections.has(node.collectionName) ? node.collectionName : undefined;
    }
    return undefined;
  };
  const touchesCollection = (node: Node): boolean => {
    let found = false;
    walk(node, (candidate) => { if (namesCollection(candidate) !== undefined) found = true; });
    return found;
  };

  // genesis-site: every function the constructor still reaches by name is a subroutine of `create`, which holds no
  // journal; the inliners have brought every collection helper they could into the constructor.
  const functionsByName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of [...contract.functions, ...(ast.freeFunctions ?? [])]) {
    const short = fn.name.slice(fn.name.lastIndexOf('.') + 1);
    for (const name of new Set([fn.name, short])) functionsByName.set(name, [...(functionsByName.get(name) ?? []), fn]);
  }
  const reached = new Set<FunctionDefinitionNode>();
  const queue: FunctionDefinitionNode[] = [create];
  while (queue.length > 0) {
    const fn = queue.pop()!;
    if (reached.has(fn) || fn.body === undefined) continue;
    reached.add(fn);
    walk(fn.body, (node) => {
      const name = node instanceof FunctionCallNode ? node.identifier.name
        : node instanceof MethodCallNode ? node.methodName : undefined;
      if (name === undefined) return;
      for (const callee of functionsByName.get(name) ?? []) queue.push(callee);
      for (const callee of functionsByName.get(name.slice(name.lastIndexOf('.') + 1)) ?? []) queue.push(callee);
    });
  }
  for (const fn of reached) {
    if (fn === create || fn.body === undefined || !touchesCollection(fn.body)) continue;
    throw new DeployerUnsupportedError(fn, 'genesis-site',
      `the constructor calls '${fn.name}', which accesses a collection and stays a subroutine`);
  }

  // A call is inert when every function its name may reach is pure or view and accesses no collection (A4.1).
  const inert = (name: string): boolean => {
    const candidates = [...(functionsByName.get(name) ?? []), ...(functionsByName.get(name.slice(name.lastIndexOf('.') + 1)) ?? [])];
    if (candidates.length === 0) return true;
    return candidates.every((fn) => (fn.modifiers.includes(FunctionModifier.PURE)
        || fn.modifiers.includes(FunctionModifier.VIEW))
      && (fn.body === undefined || !touchesCollection(fn.body)));
  };
  // A4.1: a statement that accesses a collection holds no other effect: its own write apart, no assignment, no
  // increment or decrement, no call that is not inert. Its reads then run before its write, in any order.
  const checkStatement = (statement: Node): void => {
    walk(statement, (node) => {
      if (node instanceof AssignmentExpressionNode) refuse(node, 'a statement that accesses a collection also assigns');
      if (node instanceof UnaryOpNode && (node.operator === UnaryOperator.PREFIX_INCREMENT
        || node.operator === UnaryOperator.PREFIX_DECREMENT || node.operator === UnaryOperator.POSTFIX_INCREMENT
        || node.operator === UnaryOperator.POSTFIX_DECREMENT)) {
        refuse(node, 'a statement that accesses a collection also increments or decrements');
      }
      if (node instanceof FunctionCallNode && !inert(node.identifier.name)) {
        refuse(node, `a statement that accesses a collection also calls '${node.identifier.name}'`);
      }
      if (node instanceof MethodCallNode && !inert(node.methodName)) {
        refuse(node, `a statement that accesses a collection also calls '${node.methodName}'`);
      }
    });
  };

  // O9: no declaration in the constructor takes a collection's name, so the name means the collection everywhere.
  walk(create.body, (node) => {
    const declared = node instanceof VariableDefinitionNode || node instanceof ParameterNode ? node.name : undefined;
    if (declared !== undefined && collections.has(declared)) {
      refuse(node, `the constructor declares '${declared}', the name of a collection`);
    }
  });
  for (const parameter of create.parameters) {
    if (collections.has(parameter.name)) refuse(parameter, `the constructor's parameter '${parameter.name}' names a collection`);
  }
  const accessed = new Set<string>();
  const keysFor = (collection: CollectionNode, keys: ExpressionNode[], node: Node, writes = false): void => {
    if (keys.length !== collection.allKeyTypes.length) refuse(node, `an access to '${collection.name}' does not name every key`);
    if (!collection.sorted) refuse(node, `the constructor accesses '${collection.name}', which is not a sorted collection`);
    // A4.1: a use of `T storage x = m[k]` re-evaluates k, which Solidity evaluated once at the binding.
    for (const key of keys) {
      walk(key, (candidate) => {
        if (storageAliasKeys.has(candidate)) {
          refuse(node, `the constructor accesses '${collection.name}' through a storage local whose binding holds a `
            + 'key that is not a literal');
        }
      });
    }
    const type = collection.innermostValueType;
    if (isChunkableValueType(type)) {
      refuse(node, `the constructor accesses '${collection.name}', whose value takes more than one coin`);
    }
    // A record holds one entry's value, which the append checks at run time; a struct is refused here when it may
    // not fit, so that no creation of C can fail for it.
    if (writes && type instanceof StructType) {
      const bound = journalStructBound(type);
      if (typeof bound === 'string') {
        refuse(node, `the constructor writes '${collection.name}', whose value ${type.name} holds ${bound}, whose `
          + 'encoded size the journal does not bound');
      }
      if ((bound as number) > JOURNAL_VALUE_LIMIT) {
        refuse(node, `the constructor writes '${collection.name}', whose value ${type.name} may encode to ${bound} `
          + `bytes, more than the ${JOURNAL_VALUE_LIMIT} an entry holds`);
      }
    }
  };
  // Rewrite bottom-up, so a read in a write's key or value is a look before the write becomes an append.
  const rewrite = (node: Node, loops: number): Node => {
    if (node instanceof CollectionIterationNode && collections.has(node.collectionName)) {
      refuse(node, `the constructor iterates over '${node.collectionName}'`);
    }
    // A read chain is one access with all its keys: rewrite its keys, then the chain as one look.
    const chain = node instanceof ArrayAccessNode || node instanceof TupleIndexOpNode ? flattenChain(node) : undefined;
    if (chain !== undefined) {
      const collection = collections.get(chain.name)!;
      if (loops > 0) refuse(node, `the constructor accesses '${chain.name}' inside a loop`);
      if (collection.type instanceof ArrayType) refuse(node, `the constructor accesses '${chain.name}', an array kept as a collection`);
      const keys = chain.keys.map((key) => rewrite(key, loops) as ExpressionNode);
      keysFor(collection, keys, node);
      accessed.add(chain.name);
      const look = new JournalLookNode(journalNameOf(chain.name), chain.name, keys);
      look.location = node.location;
      return look;
    }
    const isLoop = node instanceof WhileNode || node instanceof DoWhileNode || node instanceof CollectionIterationNode;
    for (const { key, index, child } of childrenOf(node)) {
      const replaced = rewrite(child, loops + (isLoop ? 1 : 0));
      if (replaced === child) continue;
      if (index === undefined) (node as unknown as Record<string, unknown>)[key] = replaced;
      else ((node as unknown as Record<string, unknown[]>)[key])[index] = replaced;
    }
    const name = namesCollection(node);
    if (name === undefined) return node;
    const collection = collections.get(name)!;
    if (loops > 0) refuse(node, `the constructor accesses '${name}' inside a loop`);
    if (collection.type instanceof ArrayType) {
      refuse(node, `the constructor accesses '${name}', an array kept as a collection`);
    }
    if (node instanceof ArrayAssignNode) {
      const keys = [node.index];
      keysFor(collection, keys, node, true);
      accessed.add(name);
      const append = new JournalAppendNode(journalNameOf(name), name, keys, node.value);
      append.location = node.location;
      return append;
    }
    // `m[k].f = v`, `m[k].a.b = v`: the member path of a struct kept whole, every member a field of the one before.
    if (node instanceof MappingFieldAssignNode) {
      const field = [node.fieldName, ...(node.trailingMembers ?? [])];
      let type: Type = collection.innermostValueType;
      for (const member of field) {
        const found = type instanceof StructType ? type.fields.find((candidate) => candidate.name === member) : undefined;
        if (found === undefined) {
          refuse(node, `the constructor writes '${name}' at '${field.join('.')}', which is not a field of its value`);
        }
        type = found!.type;
      }
      keysFor(collection, node.keys, node, true);
      accessed.add(name);
      const append = new JournalAppendNode(journalNameOf(name), name, node.keys, node.expression, field);
      append.location = node.location;
      return append;
    }
    if (node instanceof MappingDeleteNode) return node; // refused as a delete (A4.1)
    if (node instanceof MappingAccessNode) {
      if (node.arrayIndex !== undefined) refuse(node, `the constructor reads an element of an array value of '${name}'`);
      keysFor(collection, node.keys, node);
      accessed.add(name);
      const look = new JournalLookNode(journalNameOf(name), name, node.keys);
      look.location = node.location;
      return look;
    }
    const write = node as MappingAssignNode;
    if (write.arrayIndex !== undefined || write.arrayPush === true || write.arrayPop === true) {
      refuse(node, `the constructor writes an element of an array value of '${name}'`);
    }
    keysFor(collection, write.keys, node, true);
    accessed.add(name);
    const append = new JournalAppendNode(journalNameOf(name), name, write.keys, write.expression);
    append.location = node.location;
    return append;
  };

  // The statement rules, on the source the inliners left, before any access is rewritten.
  const checkBlock = (block: Node, parent: Node | undefined): void => {
    if ((block instanceof MappingAssignNode || block instanceof MappingFieldAssignNode || block instanceof ArrayAssignNode)
      && collections.has(block.name)
      && !(parent instanceof BlockNode) && !(parent instanceof ExpressionStatementNode) && !(parent instanceof BranchNode)) {
      refuse(block, 'a collection write is not a statement of its own');
    }
    if (block instanceof BlockNode) {
      for (const statement of block.statements ?? []) {
        if (statement instanceof StatementNode && !(statement instanceof BlockNode) && !(statement instanceof BranchNode)
          && !(statement instanceof WhileNode) && !(statement instanceof DoWhileNode) && touchesCollection(statement)) {
          checkStatement(statement);
        }
      }
    }
    for (const { child } of childrenOf(block)) {
      if (child instanceof MappingAccessNode && (block instanceof MappingAssignNode)) continue;
      checkBlock(child, block);
    }
  };
  checkBlock(create.body, undefined);
  // A4.1: a modifier's `storage` parameter bound to a collection or an entry holds a copy, so its writes are lost.
  walk(create.body, (node) => {
    if (node instanceof VariableDefinitionNode && storageParameterCopies.has(node) && node.expression !== undefined
      && touchesCollection(node.expression)) {
      refuse(node, 'a modifier\'s storage parameter is bound to an entry of a collection, which its expansion copies, '
        + 'so the modifier\'s writes through it would be lost');
    }
  });
  rewrite(create.body, 0);
  if (accessed.size === 0) return [];

  // The journals: hidden locals declared before anything else of the constructor's body, base bodies included.
  const declarations = [...accessed].map((name) => {
    const declaration = new VariableDefinitionNode(new BytesType(), [], journalNameOf(name));
    declaration.compilerGenerated = true;
    declaration.allowUnused = true;
    declaration.location = create.body!.location;
    return declaration;
  });
  create.body.statements = [...declarations, ...(create.body.statements ?? [])];
  return [...accessed];
}

/**
 * Whether the constructor, or a function it reaches by name, accesses a collection: only then does the deployer
 * program inline the constructor's helpers early and rewrite its accesses, so every other deployer is unchanged.
 */
export function constructorReachesCollections(ast: SourceFileNode): boolean {
  const contract = ast.contract;
  const create = contract.constructorDef;
  if (create?.body === undefined) return false;
  const names = new Set(contract.collections.map((collection) => collection.name));
  const functionsByName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of [...contract.functions, ...(ast.freeFunctions ?? [])]) {
    const short = fn.name.slice(fn.name.lastIndexOf('.') + 1);
    for (const name of new Set([fn.name, short])) functionsByName.set(name, [...(functionsByName.get(name) ?? []), fn]);
  }
  const seen = new Set<FunctionDefinitionNode>();
  const queue: FunctionDefinitionNode[] = [create];
  let found = false;
  while (queue.length > 0 && !found) {
    const fn = queue.pop()!;
    if (seen.has(fn) || fn.body === undefined) continue;
    seen.add(fn);
    let foundHere = false;
    walk(fn.body, (node) => {
      if ((node instanceof MappingAccessNode || node instanceof MappingAssignNode || node instanceof MappingFieldAssignNode
        || node instanceof MappingDeleteNode || node instanceof ArrayAssignNode) && names.has(node.name)) foundHere = true;
      if (node instanceof ArrayAccessNode || node instanceof TupleIndexOpNode) {
        let base: Node = node;
        while (base instanceof ArrayAccessNode || base instanceof TupleIndexOpNode) {
          base = base instanceof ArrayAccessNode ? base.array : base.tuple;
        }
        if (base instanceof IdentifierNode && names.has(base.name)) foundHere = true;
      }
      if (node instanceof CollectionIterationNode && names.has(node.collectionName)) foundHere = true;
      const name = node instanceof FunctionCallNode ? node.identifier.name
        : node instanceof MethodCallNode ? node.methodName : undefined;
      if (name !== undefined) {
        for (const callee of functionsByName.get(name) ?? []) queue.push(callee);
        for (const callee of functionsByName.get(name.slice(name.lastIndexOf('.') + 1)) ?? []) queue.push(callee);
      }
    });
    if (foundHere) found = true;
  }
  return found;
}

/**
 * A4.1's statement rules, on the source before any helper is inlined, in the constructor and every function it
 * reaches by name (B7.3, "right after modifier expansion"). A call that may write a collection stands only as a whole
 * statement, `f(…);`, `x = f(…);`, `T x = f(…);` or `return f(…);`, with no call that is not inert, assignment,
 * increment or decrement in its arguments: an inliner hoists a returning helper's body before its statement, which
 * would otherwise move its writes among the statement's other operands. A statement that accesses a collection holds
 * no other effect (checked again on the inlined program by the rewrite).
 */
export function checkConstructorCollectionShapes(ast: SourceFileNode): void {
  const contract = ast.contract;
  const create = contract.constructorDef;
  if (create?.body === undefined) return;
  const names = new Set(contract.collections.map((collection) => collection.name));
  const functionsByName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of [...contract.functions, ...(ast.freeFunctions ?? [])]) {
    const short = fn.name.slice(fn.name.lastIndexOf('.') + 1);
    for (const name of new Set([fn.name, short])) functionsByName.set(name, [...(functionsByName.get(name) ?? []), fn]);
  }
  const calleesOf = (name: string): FunctionDefinitionNode[] => [
    ...(functionsByName.get(name) ?? []), ...(functionsByName.get(name.slice(name.lastIndexOf('.') + 1)) ?? []),
  ];
  const callName = (node: Node): string | undefined => (node instanceof FunctionCallNode ? node.identifier.name
    : node instanceof MethodCallNode ? node.methodName : undefined);
  const writesDirectly = (body: Node | undefined): boolean => {
    let found = false;
    if (body !== undefined) {
      walk(body, (node) => {
        if ((node instanceof MappingAssignNode || node instanceof MappingFieldAssignNode || node instanceof ArrayAssignNode
          || node instanceof MappingDeleteNode) && names.has(node.name)) found = true;
      });
    }
    return found;
  };
  // A function may write a collection when it does, or calls by name one that may.
  const writers = new Set<FunctionDefinitionNode>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const fn of [...contract.functions, ...(ast.freeFunctions ?? [])]) {
      if (writers.has(fn) || fn.body === undefined) continue;
      let writes = writesDirectly(fn.body);
      if (!writes) {
        walk(fn.body, (node) => {
          const name = callName(node);
          if (name !== undefined && calleesOf(name).some((callee) => writers.has(callee))) writes = true;
        });
      }
      if (writes) {
        writers.add(fn);
        grew = true;
      }
    }
  }
  const mayWrite = (node: Node): boolean => {
    const name = callName(node);
    return name !== undefined && calleesOf(name).some((callee) => writers.has(callee));
  };
  const effectful = (node: Node): boolean => {
    let found = false;
    walk(node, (candidate) => {
      if (candidate instanceof AssignmentExpressionNode) found = true;
      if (candidate instanceof UnaryOpNode && (candidate.operator === UnaryOperator.PREFIX_INCREMENT
        || candidate.operator === UnaryOperator.PREFIX_DECREMENT || candidate.operator === UnaryOperator.POSTFIX_INCREMENT
        || candidate.operator === UnaryOperator.POSTFIX_DECREMENT)) found = true;
      const name = callName(candidate);
      if (name !== undefined && calleesOf(name).some((callee) => !(callee.modifiers.includes(FunctionModifier.PURE)
        || callee.modifiers.includes(FunctionModifier.VIEW)))) found = true;
    });
    return found;
  };
  const refuse = (node: Node, detail: string): never => {
    throw new DeployerUnsupportedError(node, 'ctor-collection-shape', detail);
  };
  // The call a whole statement makes, when the statement is one of the four shapes; undefined otherwise.
  const wholeCall = (statement: Node): Node | undefined => {
    if (statement instanceof FunctionCallStatementNode) return statement.call;
    if (statement instanceof ExpressionStatementNode
      && (statement.expression instanceof FunctionCallNode || statement.expression instanceof MethodCallNode)) {
      return statement.expression;
    }
    if (statement instanceof AssignNode && statement.identifier instanceof IdentifierNode
      && !names.has(statement.identifier.name)
      && (statement.expression instanceof FunctionCallNode || statement.expression instanceof MethodCallNode)) {
      return statement.expression;
    }
    if (statement instanceof VariableDefinitionNode
      && (statement.expression instanceof FunctionCallNode || statement.expression instanceof MethodCallNode)) {
      return statement.expression;
    }
    if (statement instanceof ReturnNode && statement.expressions.length === 1
      && (statement.expressions[0] instanceof FunctionCallNode || statement.expressions[0] instanceof MethodCallNode)) {
      return statement.expressions[0];
    }
    return undefined;
  };
  const argumentsOf = (call: Node): Node[] => (call instanceof FunctionCallNode ? call.parameters
    : call instanceof MethodCallNode ? [call.object, ...call.parameters] : []);
  const checkBody = (body: Node): void => {
    walk(body, (node) => {
      if (!(node instanceof BlockNode)) return;
      for (const statement of node.statements ?? []) {
        if (statement instanceof BlockNode || statement instanceof BranchNode || statement instanceof WhileNode
          || statement instanceof DoWhileNode) continue;
        const call = wholeCall(statement);
        walk(statement, (candidate) => {
          if (candidate !== call && mayWrite(candidate)) {
            refuse(candidate, 'a call that may write a collection is not a whole statement of its own');
          }
        });
        if (call !== undefined && mayWrite(call) && argumentsOf(call).some((argument) => effectful(argument))) {
          refuse(call, 'a call that may write a collection has an effect in its arguments');
        }
      }
    });
  };
  const reached = new Set<FunctionDefinitionNode>();
  const queue: FunctionDefinitionNode[] = [create];
  while (queue.length > 0) {
    const fn = queue.pop()!;
    if (reached.has(fn) || fn.body === undefined) continue;
    reached.add(fn);
    checkBody(fn.body);
    walk(fn.body, (node) => {
      const name = callName(node);
      if (name !== undefined) queue.push(...calleesOf(name));
    });
  }
}

/** The journal appends of a body, per collection: A4.4's append sites s_c. */
export function journalAppendSites(body: Node | undefined): Map<string, number> {
  const sites = new Map<string, number>();
  if (body === undefined) return sites;
  walk(body, (node) => {
    if (node instanceof JournalAppendNode) sites.set(node.collectionName, (sites.get(node.collectionName) ?? 0) + 1);
  });
  return sites;
}
