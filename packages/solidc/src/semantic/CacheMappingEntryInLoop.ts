import {
  Node,
  SourceFileNode,
  ContractNode,
  FunctionDefinitionNode,
  StatementNode,
  BlockNode,
  BranchNode,
  CollectionIterationNode,
  WhileNode,
  DoWhileNode,
  UncheckedNode,
  SwitchNode,
  TryCatchNode,
  ReturnNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  MappingFieldAssignNode,
  ArrayAccessNode,
  ArrayAssignNode,
  StateArrayAssignNode,
  ArrayPushNode,
  ArrayPopNode,
  IdentifierNode,
  NullaryOpNode,
  VariableDefinitionNode,
  AssignNode,
  RequireNode,
  FieldAccessNode,
  FunctionCallNode,
  LiteralNode,
  IntLiteralNode,
  TupleAssignmentNode,
  TupleIndexOpNode,
  BoolLiteralNode,
  ExpressionNode,
  CastNode,
  UnaryOpNode,
  BinaryOpNode,
  TernaryOpNode,
  FunctionModifier,
  type ExternalCallExpression,
} from '../ast/AST.js';
import { NullaryOperator } from '../ast/Operator.js';
import { MappingType, ArrayType, StructType, Type, PrimitiveType } from '@solidcash/utils';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import {
  kernelArgumentConditionActivation, kernelBooleanArgumentIndices, stableKernelArgumentIndices,
} from './KernelEntryActivation.js';

const PREFIX = '__vmapcache_';
/** Compiler-owned immutable locals which preserve a mapping key's value at a source-order boundary. */
export const VMAP_KEY_SNAPSHOT_PREFIX = '__internal__vmapKeySnapshot_';

// A mapping key we can cache on. Only INVARIANT keys qualify: a simple identifier (invariance re-checked via
// assignsName), or a nullary tx-derived address (msg.sender / tx.origin - inherently invariant; nothing reassigns
// them and they read identically every iteration). `for(i) bal[msg.sender] -= amts[i]` (a batch debit from the
// caller - the same-key half of an ERC-20 multiTransfer) is the driving case; its flush is a single msg.sender
// vmap write, which is proven (MsgSenderVMap).
type KeyKind =
  | { kind: 'id'; name: string }
  | { kind: 'nullary'; op: NullaryOperator }
  | { kind: 'literal'; node: LiteralNode; canon: string }
  | { kind: 'expression'; node: ExpressionNode; canon: string };

const PURE_KEY_BUILTINS = new Set([
  'abs', 'min', 'max', 'within', 'addmod', 'mulmod',
  'ripemd160', 'sha1', 'sha256', 'hash160', 'hash256',
  'toPaddedBytes', 'intToString', 'stringToInt',
]);
const READ_ONLY_GUARD_BUILTINS = new Set(['checkSig', 'checkMultiSig', 'checkDataSig']);

function literalCanon(k: LiteralNode): string {
  const value = k.value instanceof Uint8Array ? [...k.value].join(',') : String(k.value);
  return `${k.constructor.name}:${value}`;
}

// canon groups accesses of the same entry; null = an unsupported key (arr[i], m[k2], expression) -> not cached, so
// the multi-write / loop write falls through to the fail-closed sorted-codegen path (sound, never a silent skip).
function expressionCanon(k: Node): string | undefined {
  if (k instanceof IdentifierNode) return `id:${k.name}`;
  if (k instanceof LiteralNode) return `literal:${literalCanon(k)}`;
  if (k instanceof NullaryOpNode
    && (k.operator === NullaryOperator.MSG_SENDER || k.operator === NullaryOperator.TX_ORIGIN)) {
    return `nullary:${k.operator}`;
  }
  if (k instanceof CastNode) {
    const inner = expressionCanon(k.expression);
    return inner ? `cast:${k.type.toString()}(${inner})` : undefined;
  }
  if (k instanceof UnaryOpNode) {
    const inner = expressionCanon(k.expression);
    return inner ? `unary:${k.operator}(${inner})` : undefined;
  }
  if (k instanceof BinaryOpNode) {
    const left = expressionCanon(k.left);
    const right = expressionCanon(k.right);
    return left && right ? `binary:${k.operator}(${left},${right})` : undefined;
  }
  if (k instanceof TernaryOpNode) {
    const condition = expressionCanon(k.condition);
    const ifTrue = expressionCanon(k.ifTrue);
    const ifFalse = expressionCanon(k.ifFalse);
    return condition && ifTrue && ifFalse ? `ternary(${condition},${ifTrue},${ifFalse})` : undefined;
  }
  if (k instanceof FieldAccessNode) {
    const inner = expressionCanon(k.expression);
    return inner ? `field:${k.name}(${inner})` : undefined;
  }
  if (k instanceof ArrayAccessNode) {
    const array = expressionCanon(k.array);
    const index = expressionCanon(k.index);
    return array && index ? `index(${array},${index})` : undefined;
  }
  if (k instanceof TupleIndexOpNode) {
    const tuple = expressionCanon(k.tuple);
    return tuple ? `tidx(${tuple},${k.index})` : undefined;
  }
  if (k instanceof FunctionCallNode) {
    const pure = PURE_KEY_BUILTINS.has(k.identifier.name)
      || k.resolvedFunction?.modifiers.includes(FunctionModifier.PURE) === true;
    if (!pure) return undefined;
    const args = k.parameters.map(expressionCanon);
    return args.every((arg): arg is string => arg !== undefined)
      ? `call:${k.identifier.name}(${args.join(',')})` : undefined;
  }
  return undefined;
}

function readOnlyGuardExpression(node: ExpressionNode, shadowedCalls: ReadonlySet<string>): boolean {
  if (node instanceof FunctionCallNode) {
    const knownBuiltin = node.resolvedFunction === undefined && !node.lexicalIndirectCall
      && !shadowedCalls.has(node.identifier.name)
      && (READ_ONLY_GUARD_BUILTINS.has(node.identifier.name)
        || PURE_KEY_BUILTINS.has(node.identifier.name));
    const safe = knownBuiltin
      || node.resolvedFunction?.modifiers.includes(FunctionModifier.PURE) === true;
    return safe && node.parameters.every((parameter) => readOnlyGuardExpression(parameter, shadowedCalls));
  }
  if (node instanceof BinaryOpNode) {
    return readOnlyGuardExpression(node.left, shadowedCalls)
      && readOnlyGuardExpression(node.right, shadowedCalls);
  }
  if (node instanceof TernaryOpNode) {
    return readOnlyGuardExpression(node.condition, shadowedCalls)
      && readOnlyGuardExpression(node.ifTrue, shadowedCalls)
      && readOnlyGuardExpression(node.ifFalse, shadowedCalls);
  }
  if (node instanceof UnaryOpNode || node instanceof CastNode || node instanceof FieldAccessNode) {
    return readOnlyGuardExpression(node.expression, shadowedCalls);
  }
  if (node instanceof ArrayAccessNode) {
    return readOnlyGuardExpression(node.array, shadowedCalls)
      && readOnlyGuardExpression(node.index, shadowedCalls);
  }
  if (node instanceof TupleIndexOpNode) return readOnlyGuardExpression(node.tuple, shadowedCalls);
  if (node instanceof MappingAccessNode) {
    return node.keys.every((key) => readOnlyGuardExpression(key, shadowedCalls));
  }
  return expressionCanon(node) !== undefined;
}

/** SDK key planning may substitute only a value that is already fixed by public arguments. */
function argumentOnlyMappingValue(node: ExpressionNode, parameters: ReadonlySet<string>): boolean {
  if (node instanceof LiteralNode) return true;
  if (node instanceof IdentifierNode) return parameters.has(node.name);
  if (node instanceof BinaryOpNode && ['+', '-', '*'].includes(node.operator)) {
    return argumentOnlyMappingValue(node.left, parameters)
      && argumentOnlyMappingValue(node.right, parameters);
  }
  return false;
}

class ProjectWrittenMappingRead extends AstTraversal {
  replaced = false;

  constructor(
    private readonly mapping: string,
    private readonly keyLabel: string,
    private readonly value: ExpressionNode,
  ) { super(); }

  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    if (node.tuple instanceof IdentifierNode && node.tuple.name === this.mapping
      && expressionCanon(new IntLiteralNode(BigInt(node.index))) === this.keyLabel) {
      this.replaced = true;
      return cloneNode(this.value);
    }
    return super.visitTupleIndexOp(node);
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    if (node.array instanceof IdentifierNode && node.array.name === this.mapping
      && expressionCanon(node.index) === this.keyLabel) {
      this.replaced = true;
      return cloneNode(this.value);
    }
    return super.visitArrayAccess(node);
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    if (node.name === this.mapping && node.keys.length === 1
      && expressionCanon(node.keys[0]) === this.keyLabel) {
      this.replaced = true;
      return cloneNode(this.value);
    }
    return super.visitMappingAccess(node);
  }
}

class ProjectCapturedMappingRead extends AstTraversal {
  replaced = false;

  constructor(private readonly name: string, private readonly value: ExpressionNode) { super(); }

  visitIdentifier(node: IdentifierNode): Node {
    if (node.name === this.name) {
      this.replaced = true;
      return cloneNode(this.value);
    }
    return node;
  }
}

class SourceMappingReadFinder extends AstTraversal {
  found = false;

  keys: ExpressionNode[] = [];

  constructor(private readonly mapping: string) { super(); }

  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    if (node.tuple instanceof IdentifierNode && node.tuple.name === this.mapping) {
      this.found = true;
      this.keys.push(new IntLiteralNode(BigInt(node.index)));
    }
    return super.visitTupleIndexOp(node);
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    if (node.array instanceof IdentifierNode && node.array.name === this.mapping
      && expressionCanon(node.index) !== undefined) {
      this.found = true;
      this.keys.push(node.index);
    }
    return super.visitArrayAccess(node);
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    if (node.name === this.mapping && node.keys.every((key) => expressionCanon(key) !== undefined)) {
      this.found = true;
      if (node.keys.length === 1) this.keys.push(node.keys[0]!);
    }
    return super.visitMappingAccess(node);
  }
}

/** Metadata projections run before semantic lowering turns source `m[k]` into a MappingAccessNode. */
class NormalizeSourceMappingReads extends AstTraversal {
  constructor(private readonly mappings: ReadonlySet<string>) { super(); }

  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    if (node.tuple instanceof IdentifierNode && this.mappings.has(node.tuple.name)) {
      const key = new IntLiteralNode(BigInt(node.index));
      key.location = node.location;
      const access = new MappingAccessNode(node.tuple.name, [key]);
      access.location = node.location;
      return access;
    }
    return super.visitTupleIndexOp(node);
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    if (node.array instanceof IdentifierNode && this.mappings.has(node.array.name)) {
      const access = new MappingAccessNode(node.array.name, [this.visit(node.index) as ExpressionNode]);
      access.location = node.location;
      return access;
    }
    return super.visitArrayAccess(node);
  }
}

function canonKeyOf(k: Node, allowExpression = false): { canon: string; key: KeyKind } | null {
  if (k instanceof IdentifierNode) return { canon: `id:${k.name}`, key: { kind: 'id', name: k.name } };
  if (k instanceof NullaryOpNode
    && (k.operator === NullaryOperator.MSG_SENDER || k.operator === NullaryOperator.TX_ORIGIN)) {
    return { canon: `nullary:${k.operator}`, key: { kind: 'nullary', op: k.operator } };
  }
  if (allowExpression && k instanceof LiteralNode) {
    const canon = literalCanon(k);
    return { canon: `literal:${canon}`, key: { kind: 'literal', node: cloneNode(k), canon } };
  }
  if (allowExpression && k instanceof ExpressionNode) {
    const canon = expressionCanon(k);
    if (canon) return {
      canon: `expression:${canon}`,
      key: { kind: 'expression', node: cloneNode(k), canon },
    };
  }
  return null;
}

/** Canonical form of one key, spelled exactly as `canonKeyOf` spells it (the form `EntryInfo.keys` keeps). */
function keyCanon(key: KeyKind): string {
  switch (key.kind) {
    case 'id': return `id:${key.name}`;
    case 'nullary': return `nullary:${key.op}`;
    case 'literal': return `literal:${key.canon}`;
    default: return `expression:${key.canon}`;
  }
}

function buildKeyNode(key: KeyKind, loc: Node['location']): Node {
  const n: Node = key.kind === 'id'
    ? new IdentifierNode(key.name)
    : key.kind === 'nullary' ? new NullaryOpNode(key.op) : cloneNode(key.node);
  n.location = loc;
  return n;
}

function keyNodeMatches(k: Node | undefined, key: KeyKind): boolean {
  if (!k) return false;
  if (key.kind === 'id') return k instanceof IdentifierNode && k.name === key.name;
  if (key.kind === 'nullary') return k instanceof NullaryOpNode && k.operator === key.op;
  if (key.kind === 'literal') return k instanceof LiteralNode && literalCanon(k) === key.canon;
  return expressionCanon(k) === key.canon;
}

function expressionParameterDependencies(node: Node, out = new Set<string>()): Set<string> {
  if (node instanceof IdentifierNode) out.add(node.name);
  if (node instanceof FunctionCallNode) {
    for (const parameter of node.parameters) expressionParameterDependencies(parameter, out);
    return out;
  }
  for (const [field, value] of Object.entries(node)) {
    if (['location', 'resolvedFunction', 'functionReference', 'definition', 'collection', 'symbolTable',
      'stateVariable', 'type'].includes(field)) continue;
    if (value instanceof Node) expressionParameterDependencies(value, out);
    else if (Array.isArray(value)) {
      for (const item of value) if (item instanceof Node) expressionParameterDependencies(item, out);
    }
  }
  return out;
}

function mutatesExpressionDependency(root: Node, dependencies: ReadonlySet<string>): boolean {
  let mutated = false;
  const scan = (node: Node): void => {
    if (mutated) return;
    if ((node instanceof AssignNode && dependencies.has(node.identifier.name))
      || (node instanceof VariableDefinitionNode && dependencies.has(node.name))
      || (node instanceof ArrayAssignNode && dependencies.has(node.name))
      || (node instanceof ArrayPushNode && dependencies.has(node.name))
      || (node instanceof ArrayPopNode && dependencies.has(node.name))) {
      mutated = true;
      return;
    }
    for (const [field, value] of Object.entries(node)) {
      if (['location', 'resolvedFunction', 'functionReference', 'definition', 'collection', 'symbolTable',
        'stateVariable', 'type'].includes(field)) continue;
      if (value instanceof Node) scan(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) scan(item);
    }
  };
  scan(root);
  return mutated;
}

/** Whether the function-wide entry cache can evaluate this key once without changing its source meaning. */
export function isFunctionEntryInvariantMappingKey(
  key: Node,
  body: Node,
  publicParameterNames: ReadonlySet<string>,
): boolean {
  if (!canonKeyOf(key, true)) return false;
  if (key instanceof LiteralNode || key instanceof NullaryOpNode) return true;
  // LowerVMapCounterLoops creates these locals at the very start of the function from a pure expression over
  // public arguments. The declaration is the snapshot's initialization, not a later mutation. Treating it as
  // an ordinary source identifier would make mutatesExpressionDependency reject the capability the snapshot
  // exists to provide.
  if (key instanceof IdentifierNode && key.name.startsWith(VMAP_KEY_SNAPSHOT_PREFIX)) return true;
  const dependencies = expressionParameterDependencies(key);
  return [...dependencies].every((name) => publicParameterNames.has(name))
    && !mutatesExpressionDependency(body, dependencies);
}

type EntryInfo = {
  mapping: string; keys: KeyKind[]; count: number; inLoop: boolean; bad: boolean;
  written: boolean; readAfterWrite: boolean; fromModifier?: string;
};

type ScalarMappingInfo = { valueType: Type; depth: number };

/**
 * A vmap (sorted) mapping ARRAY value cannot be written more than once to the SAME entry in one call: each write is its
 * own emitSortedValueUpsert, which co-spends the entry NFT + emits one output, so two of them double-spend the input
 * and the covenant OP_VERIFYs fail. This is the RUNTIME analog of CacheDynamicArrayInLoop (read-once/mutate-local/
 * write-once for STATE dynamic arrays), extended to a keyed MAPPING ENTRY m[k]. For any entry written via array ops
 * more than once (a loop `for(..) m[k][j]=v`, consecutive `m[k][0]=x; m[k][2]=z`, a conditional, a `.push` fold),
 * the entry is cached FUNCTION-wide:
 *   T[] __vmapcache_N = m[k];   <every m[k] access -> __vmapcache_N>   m[k] = __vmapcache_N;   // flushed before each return
 * The loop stays a RUNTIME loop over the LOCAL array (one covenant body, byte-limit safe); reads of m[k] redirect to
 * the local so read-after-write (`m[k][j]=m[k][j-1]+1`) reads the value being built; the vmap write is a single upsert.
 * Runs pre-semantic so the redirected accesses resolve as a local array (after DesugarReturnInLoop, so in-loop
 * returns are already flag+break). Restricted to be SOUND: single-key array-valued mapping, key `k` a simple
 * identifier NOT reassigned in the function (else the entry differs - the per-iteration sorted-insert case, left to
 * fail closed), and no whole-entry assignment of that entry (only delete / element / push / pop writes + reads).
 */
export default class CacheMappingEntryInLoop extends AstTraversal {
  private arrayMappings: Map<string, Type> = new Map(); // single-key array-valued mapping name -> array value type
  // Single-key vmap (sorted) SCALAR mapping name -> value type. A scalar vmap entry written more than once / in a loop
  // to the SAME key (`for(i) balance[k] -= amts[i]`) hits the same wall as arrays: each `m[k]=v` is its own upsert
  // that co-spends the entry NFT + emits one output, so a second one double-spends the (already-spent) input and
  // reverts. Read-once/mutate-local/write-once (a single upsert) fixes it. Gated on `sorted` (the default entry
  // model has its own write-in-loop handling); depth 1 only.
  private scalarMappings: Map<string, ScalarMappingInfo> = new Map();
  private structMappings: Map<string, StructType> = new Map();
  private sourceFunctionNames: Set<string> = new Set();
  private contractFunctionNames: Set<string> = new Set();
  private counter = 0;

  constructor(private routeSnapshotKeysOnly = false) { super(); }

  visitSourceFile(node: SourceFileNode): Node {
    this.sourceFunctionNames = new Set(node.freeFunctions.map((fn) => fn.name));
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.contractFunctionNames = new Set(node.functions.map((fn) => fn.name));
    this.arrayMappings = new Map();
    this.scalarMappings = new Map();
    this.structMappings = new Map();
    for (const col of node.collections) {
      if (col.type instanceof MappingType) {
        if (col.depth === 1 && col.innermostValueType instanceof ArrayType) {
          this.arrayMappings.set(col.name, col.innermostValueType);
        } else if (col.depth === 1 && col.sorted && col.innermostValueType instanceof StructType) {
          this.structMappings.set(col.name, col.innermostValueType);
        } else if (col.sorted && !(col.innermostValueType instanceof ArrayType)
          && !(col.innermostValueType instanceof StructType)) {
          this.scalarMappings.set(col.name, { valueType: col.innermostValueType, depth: col.depth });
        }
      }
    }
    if (this.arrayMappings.size === 0 && this.scalarMappings.size === 0 && this.structMappings.size === 0) return node;
    for (const fn of [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]) {
      // Collection-journal handlers are deliberately storage-free value
      // functions. Their original semantic metadata may still reference the
      // pre-lowered body until the next symbol pass; never synthesize physical
      // entry caching inside that handler.
      if (fn?.body && !fn.collectionJournal) this.transformFunction(fn);
    }
    return node;
  }

  private transformFunction(fn: FunctionDefinitionNode): void {
    this.publishStraightLineMappingKeyValues(fn);
    const selected = this.collectCacheableEntries(fn.body).filter((e) => !(this.routeSnapshotKeysOnly
      && e.keys.length === 1
      && !e.keys.some((key) => key.kind === 'expression'
        || (key.kind === 'id' && key.name.startsWith(VMAP_KEY_SNAPSHOT_PREFIX)))
      && !e.inLoop));
    // Every redirect runs before any declaration is inserted: a redirect replaces the node it rewrites (a write
    // becomes a dirty-marking block), so an anchored cache resolves its insertion point by statement position
    // afterwards instead of holding a node that is no longer in the body.
    // Capture source guards before any redirect rewrites a mutation site. Multiple cached entries may share a
    // branch, and a later guard scan must still see the complete source body.
    const selectedWithPlans = selected.map((e) => ({ e, guardPlan: this.replayableCacheActivation(fn, e) }));
    const prepared = selectedWithPlans.map(({ e, guardPlan }) => {
      const local = `${PREFIX}${e.mapping}_${this.counter++}`;
      const dirty = `${local}_dirty`;
      new EntryRedirect(e.mapping, e.keys, local, dirty, e.valueType).visit(fn.body);
      return { e, local, dirty, guardPlan };
    });
    // Resolve every anchor before any flush statement is inserted: an insertion shifts the statement list, and the
    // anchor is a position in the body as it stands after the redirects.
    const anchors = new Map<(typeof prepared)[number], StatementNode>();
    for (const item of prepared) {
      if (item.e.anchorIndex === undefined) continue;
      const anchor = (fn.body.statements ?? [])[item.e.anchorIndex];
      if (anchor === undefined) {
        throw new Error(
          `CacheMappingEntryInLoop: the cache anchor for '${item.e.mapping}' in '${fn.name}' is missing; the entry `
          + 'cannot be read after its key declaration.',
        );
      }
      anchors.set(item, anchor);
    }
    const anchoredDeclarations = new Map<StatementNode, StatementNode[]>();
    for (const item of prepared) {
      const { e, local, dirty, guardPlan } = item;
      const cacheRead = new MappingAccessNode(
        e.mapping,
        e.keys.map((key) => buildKeyNode(key, fn.body.location) as ExpressionNode),
      ); // T local = m[k1][k2];
      cacheRead.fromModifier = e.fromModifier;
      cacheRead.location = fn.body.location;
      const cache = new VariableDefinitionNode(e.valueType, [], local, cacheRead);
      cache.location = fn.body.location;
      const dirtyInit = new BoolLiteralNode(false);
      dirtyInit.location = fn.body.location;
      const dirtyLocal = new VariableDefinitionNode(PrimitiveType.BOOL, [], dirty, dirtyInit);
      dirtyLocal.location = fn.body.location;
      let stmts = this.insertFlushesBeforeReturns(fn.body.statements ?? [], e.mapping, e.keys, local, dirty,
        guardPlan);
      if (stmts.length === 0 || !(stmts[stmts.length - 1] instanceof ReturnNode)) {
        stmts = [...stmts, this.makeFlush(e.mapping, e.keys, local, dirty, fn.body.location, e.fromModifier,
          guardPlan)];
      }
      const anchor = anchors.get(item);
      if (anchor !== undefined) {
        // The key is a body local, so the cache read cannot hoist above its declaration: reading the entry at the
        // first use of this entry gives the value every later read must observe once the writes are redirected.
        anchoredDeclarations.set(anchor, [...(anchoredDeclarations.get(anchor) ?? []), cache, dirtyLocal]);
      } else {
        // Point-in-time key snapshots must execute before the cache read which consumes them. They are emitted as
        // a contiguous compiler-owned prefix by LowerVMapCounterLoops; retain that prefix even when several cache
        // entries are installed one after another.
        let snapshotPrefixLength = 0;
        while (stmts[snapshotPrefixLength] instanceof VariableDefinitionNode
          && (stmts[snapshotPrefixLength] as VariableDefinitionNode).name.startsWith(VMAP_KEY_SNAPSHOT_PREFIX)) {
          snapshotPrefixLength += 1;
        }
        stmts = [
          ...stmts.slice(0, snapshotPrefixLength), cache, dirtyLocal, ...stmts.slice(snapshotPrefixLength),
        ];
      }
      fn.body.statements = stmts;
    }
    if (anchoredDeclarations.size > 0) {
      const inserted: StatementNode[] = [];
      for (const statement of fn.body.statements ?? []) {
        const pending = anchoredDeclarations.get(statement);
        if (pending) inserted.push(...pending);
        inserted.push(statement);
      }
      fn.body.statements = inserted;
    }
  }

  /** Preserve source-order key recipes before the cache pass moves writers to epilogue flushes. */
  private publishStraightLineMappingKeyValues(fn: FunctionDefinitionNode): void {
    const statements = fn.body.statements ?? [];
    const parameters = new Set(fn.parameters.map((parameter) => parameter.name));
    // This pass also runs before symbol resolution. A contract/free function or lexical pointer may
    // shadow a global builtin, so a name alone cannot prove the call has no storage effects.
    const shadowedCalls = new Set([
      ...this.sourceFunctionNames, ...this.contractFunctionNames, ...parameters,
      ...statements.filter((statement): statement is VariableDefinitionNode => statement instanceof VariableDefinitionNode)
        .map((statement) => statement.name),
    ]);
    const readOnlyGuard = (statement: StatementNode): boolean => statement instanceof RequireNode
      && readOnlyGuardExpression(statement.expression, shadowedCalls)
      && statement.args.every((arg) => readOnlyGuardExpression(arg, shadowedCalls));
    const transparentStatements: boolean[] = [];
    const topLevelLocals = new Set<string>();
    for (const statement of statements) {
      transparentStatements.push(statement instanceof VariableDefinitionNode
        ? !statement.expression || argumentOnlyMappingValue(statement.expression, parameters)
        : readOnlyGuard(statement) || (statement instanceof AssignNode && !statement.isReferenceDataWrite
          && topLevelLocals.has(statement.identifier.name)
          && argumentOnlyMappingValue(statement.expression, parameters)));
      if (statement instanceof VariableDefinitionNode) topLevelLocals.add(statement.name);
    }
    const previousEffectful: number[] = [];
    let previous = -1;
    for (let index = 0; index < statements.length; index += 1) {
      previousEffectful[index] = previous;
      if (!transparentStatements[index]) previous = index;
    }
    const scalarWrite = (statement: StatementNode): {
      name: string; key: ExpressionNode; value: ExpressionNode;
    } | undefined => statement instanceof ArrayAssignNode && this.scalarMappings.has(statement.name)
      ? { name: statement.name, key: statement.index, value: statement.value }
      : statement instanceof MappingAssignNode && statement.keys.length === 1
        && this.scalarMappings.has(statement.name)
        && !statement.arrayIndex && !statement.arrayPush && !statement.arrayPop
        ? { name: statement.name, key: statement.keys[0], value: statement.expression } : undefined;
    const knownWrites = new Map<string, { key: ExpressionNode; value: ExpressionNode }>();
    const priorWriteKeys = new Map<string, ExpressionNode[]>();
    const knownCaptures = new Map<string, ExpressionNode>();
    const sourceCaptures = new Map<string, ExpressionNode>();
    const capturePreWriteCollections = new Map<string, Set<string>>();
    const declaredLocals = new Set<string>();
    let sourcePrefixSafe = true;
    const expandSourceCaptures = (source: ExpressionNode): ExpressionNode => {
      let value = cloneNode(source) as ExpressionNode;
      for (const [name, capture] of sourceCaptures) {
        value = new ProjectCapturedMappingRead(name, capture).visit(value) as ExpressionNode;
      }
      return value;
    };
    const projectKnownValues = (source: ExpressionNode): { value: ExpressionNode; replaced: boolean } => {
      let value = cloneNode(source) as ExpressionNode;
      let replaced = false;
      for (const [name, write] of knownWrites) {
        const keyLabel = expressionCanon(write.key);
        if (!keyLabel) continue;
        const projector = new ProjectWrittenMappingRead(name, keyLabel, write.value);
        value = projector.visit(value) as ExpressionNode;
        replaced ||= projector.replaced;
      }
      for (const [name, capture] of knownCaptures) {
        const projector = new ProjectCapturedMappingRead(name, capture);
        value = projector.visit(value) as ExpressionNode;
        replaced ||= projector.replaced;
      }
      return { value, replaced };
    };
    const recordCapture = (name: string, expression: ExpressionNode, allowMappingRead: boolean): void => {
      const inheritedPreWrites = new Set<string>();
      for (const [local, collections] of capturePreWriteCollections) {
        const projector = new ProjectCapturedMappingRead(local, sourceCaptures.get(local)!);
        projector.visit(cloneNode(expression));
        if (projector.replaced) collections.forEach((collection) => inheritedPreWrites.add(collection));
      }
      const source = expandSourceCaptures(expression);
      const capture = projectKnownValues(expression).value;
      const readableMappingCapture = allowMappingRead && [...this.scalarMappings.keys()].some((mapping) => {
        const finder = new SourceMappingReadFinder(mapping);
        finder.visit(capture);
        return finder.keys.length > 0 && finder.keys.every((key) => argumentOnlyMappingValue(key, parameters));
      });
      capturePreWriteCollections.set(name, inheritedPreWrites);
      sourceCaptures.set(name, source);
      if (argumentOnlyMappingValue(capture, parameters) || readableMappingCapture) {
        knownCaptures.set(name, readableMappingCapture
          ? new NormalizeSourceMappingReads(new Set(this.scalarMappings.keys()))
            .visit(cloneNode(capture)) as ExpressionNode : capture);
      } else {
        knownCaptures.delete(name);
      }
    };
    for (let index = 0; index < statements.length; index += 1) {
      if (index > 0) {
        const preceding = statements[index - 1];
        const precedingWrite = scalarWrite(preceding);
        if (precedingWrite && argumentOnlyMappingValue(precedingWrite.key, parameters)
          && argumentOnlyMappingValue(precedingWrite.value, parameters)) {
          // A write to another collection cannot invalidate this collection's known value.
          if (!knownWrites.has(precedingWrite.name)) {
            for (const [local, capture] of sourceCaptures) {
              const finder = new SourceMappingReadFinder(precedingWrite.name);
              finder.visit(capture);
              if (finder.found) capturePreWriteCollections.get(local)?.add(precedingWrite.name);
            }
          }
          knownWrites.set(precedingWrite.name, precedingWrite);
          priorWriteKeys.set(precedingWrite.name, [
            ...(priorWriteKeys.get(precedingWrite.name) ?? []), precedingWrite.key,
          ]);
        } else if (preceding instanceof VariableDefinitionNode
          && (!preceding.expression || expressionCanon(preceding.expression) !== undefined)) {
          declaredLocals.add(preceding.name);
          if (preceding.expression) {
            recordCapture(preceding.name, preceding.expression, false);
          } else {
            sourceCaptures.delete(preceding.name);
            capturePreWriteCollections.delete(preceding.name);
            knownCaptures.delete(preceding.name);
          }
        } else if (preceding instanceof AssignNode && !preceding.isReferenceDataWrite
          && declaredLocals.has(preceding.identifier.name)
          && expressionCanon(preceding.expression) !== undefined) {
          // A top-level local rebind is a point-in-time capture, just like its declaration.
          recordCapture(preceding.identifier.name, preceding.expression, true);
        } else if (readOnlyGuard(preceding)) {
          // Reaching the next statement proves the guard passed without changing collection state.
        } else {
          // Effectful calls, branches, unsupported guards, and writes end the straight-line proof.
          knownWrites.clear();
          priorWriteKeys.clear();
          knownCaptures.clear();
          sourceCaptures.clear();
          capturePreWriteCollections.clear();
          declaredLocals.clear();
          sourcePrefixSafe = false;
        }
      }
      const reader = statements[index];
      if (!(reader instanceof ArrayAssignNode || reader instanceof MappingAssignNode)) continue;
      const readerKeys = reader instanceof ArrayAssignNode && this.scalarMappings.has(reader.name)
        ? [reader.index]
        : reader instanceof MappingAssignNode && this.scalarMappings.has(reader.name)
          ? reader.keys : undefined;
      if (!readerKeys || readerKeys.length !== 1) continue;
      const writerIndex = previousEffectful[index];
      const write = writerIndex >= 0 ? scalarWrite(statements[writerIndex]) : undefined;
      if (write && argumentOnlyMappingValue(write.value, parameters)) {
        const keyLabel = expressionCanon(write.key);
        if (keyLabel) {
          const projector = new ProjectWrittenMappingRead(write.name, keyLabel, write.value);
          const projected = projector.visit(cloneNode(readerKeys[0])) as ExpressionNode;
          if (projector.replaced) reader.postWriteKeyExpressions = [projected];
        }
      }
      const projected = projectKnownValues(reader.postWriteKeyExpressions?.[0] ?? readerKeys[0]);
      if (projected.replaced) reader.postWriteKeyExpressions = [projected.value];
      // A read still sees the authenticated input state if the straight-line prefix only wrote
      // other collections. Expand captured locals at their declaration point, not after later writes.
      if (!sourcePrefixSafe) continue;
      const preWriteKey = expandSourceCaptures(readerKeys[0]);
      const preWriteCollections: string[] = [];
      // A prior write to a distinct literal key cannot change this source read. Keep every
      // earlier key, not only the last write, so a same-key mutation cannot be hidden by a later one.
      for (const [name, writtenKeys] of priorWriteKeys) {
        const finder = new SourceMappingReadFinder(name);
        finder.visit(preWriteKey);
        if (finder.keys.length > 0 && finder.keys.every((readKey) => writtenKeys.every((writtenKey) =>
          readKey instanceof IntLiteralNode && writtenKey instanceof IntLiteralNode
          && readKey.value !== writtenKey.value))) preWriteCollections.push(name);
      }
      for (const [local, collections] of capturePreWriteCollections) {
        const projector = new ProjectCapturedMappingRead(local, sourceCaptures.get(local)!);
        projector.visit(cloneNode(readerKeys[0]));
        if (projector.replaced) collections.forEach((name) => {
          if (!preWriteCollections.includes(name)) preWriteCollections.push(name);
        });
      }
      if (expressionCanon(preWriteKey) !== undefined) {
        for (let laterIndex = index + 1; laterIndex < statements.length; laterIndex += 1) {
          if (transparentStatements[laterIndex]) continue;
          const laterWrite = scalarWrite(statements[laterIndex]);
          if (!laterWrite || !argumentOnlyMappingValue(laterWrite.key, parameters)
            || !argumentOnlyMappingValue(laterWrite.value, parameters)) break;
          if (knownWrites.has(laterWrite.name) || preWriteCollections.includes(laterWrite.name)) continue;
          const finder = new SourceMappingReadFinder(laterWrite.name);
          finder.visit(preWriteKey);
          if (finder.found) preWriteCollections.push(laterWrite.name);
        }
      }
      if (preWriteCollections.length > 0) reader.preWriteMappingCollections = preWriteCollections;
    }
  }

  /** Recover the exact source-argument condition for a scalar cache's final dirty-bit flush. */
  private replayableCacheActivation(
    fn: FunctionDefinitionNode,
    entry: { mapping: string; keys: KeyKind[]; mutationCount: number; inLoop: boolean },
  ): { activation: ExternalCallExpression; valueSource?: { expression: string; parameters: string[] } } | undefined {
    if (entry.inLoop || entry.mutationCount === 0 || !this.scalarMappings.has(entry.mapping)) return undefined;
    const argumentIndices = stableKernelArgumentIndices(fn);
    const booleanArguments = kernelBooleanArgumentIndices(fn);
    const mutations: Array<{ guard: ExternalCallExpression; value?: ExpressionNode }> = [];
    let mutationCount = 0;
    let unsupported = false;
    const matches = (name: string, keys: readonly Node[]): boolean => name === entry.mapping
      && keys.length === entry.keys.length
      && keys.every((key, index) => keyNodeMatches(key, entry.keys[index]!));
    const combine = (outer: ExternalCallExpression | undefined, inner: ExternalCallExpression): ExternalCallExpression =>
      outer === undefined ? inner : { kind: 'binary', operator: '&&', left: outer, right: inner };
    const scan = (node: Node, guard?: ExternalCallExpression, representable = true): void => {
      if (node instanceof BranchNode) {
        const condition = kernelArgumentConditionActivation(node.condition, argumentIndices, booleanArguments);
        const supported = representable && condition !== undefined;
        scan(node.ifBlock, supported ? combine(guard, condition!) : undefined, supported);
        if (node.elseBlock) scan(node.elseBlock, supported ? combine(guard, {
          kind: 'unary', operator: '!', expression: condition,
        }) : undefined, supported);
        return;
      }
      if (node instanceof ReturnNode) unsupported = true;
      const mutation = node instanceof ArrayAssignNode || node instanceof StateArrayAssignNode
        ? { name: node.name, keys: [node.index] }
        : node instanceof MappingAssignNode || node instanceof MappingDeleteNode
          ? { name: node.name, keys: node.keys } : undefined;
      if (mutation && matches(mutation.name, mutation.keys)) {
        mutationCount += 1;
        if (!representable || guard === undefined) unsupported = true;
        else mutations.push({ guard, value: node instanceof ArrayAssignNode
          || node instanceof StateArrayAssignNode ? node.value
          : node instanceof MappingAssignNode ? node.expression : undefined });
      }
      const childRepresentable = representable
        && !(node instanceof WhileNode || node instanceof DoWhileNode || node instanceof CollectionIterationNode
          || node instanceof SwitchNode || node instanceof TryCatchNode);
      for (const [field, value] of Object.entries(node)) {
        if (['location', 'resolvedFunction', 'functionReference', 'definition', 'collection', 'symbolTable',
          'stateVariable', 'type'].includes(field)) continue;
        if (value instanceof Node) scan(value, childRepresentable ? guard : undefined, childRepresentable);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) {
          scan(item, childRepresentable ? guard : undefined, childRepresentable);
        }
      }
    };
    scan(fn.body);
    if (unsupported || mutationCount !== entry.mutationCount) return undefined;
    let activation: ExternalCallExpression | undefined;
    const seen = new Set<string>();
    for (const { guard } of mutations) {
      const key = JSON.stringify(guard);
      if (seen.has(key)) continue;
      seen.add(key);
      activation = activation === undefined ? guard
        : { kind: 'binary', operator: '||', left: activation, right: guard };
    }
    if (activation === undefined) return undefined;
    const final = mutations[mutations.length - 1];
    const parameters = new Set<string>();
    const serialize = (expression: ExpressionNode): string | undefined => {
      if (expression instanceof IdentifierNode) {
        const index = argumentIndices.get(expression.name);
        if (index === undefined || fn.parameters[index]?.name !== expression.name) return undefined;
        parameters.add(expression.name);
        return `id:${expression.name}`;
      }
      if (expression instanceof IntLiteralNode) return `lit:${expression.value.toString()}`;
      if (expression instanceof BinaryOpNode && ['+', '-', '*'].includes(expression.operator)) {
        const left = serialize(expression.left);
        const right = serialize(expression.right);
        return left === undefined || right === undefined ? undefined
          : `binop:${expression.operator}(${left},${right})`;
      }
      return undefined;
    };
    const serializeGuard = (guard: ExternalCallExpression): string | undefined => {
      if (guard.kind === 'source' && guard.source?.kind === 'forward'
        && guard.source.paramIndex !== undefined) {
        const parameter = fn.parameters[guard.source.paramIndex];
        if (parameter === undefined || parameter.name.startsWith('__internal__')) return undefined;
        parameters.add(parameter.name);
        return `id:${parameter.name}`;
      }
      if (guard.kind === 'literal' && (guard.value === true || guard.value === false
        || (typeof guard.value === 'string' && /^-?[0-9]+$/.test(guard.value)))) {
        return `lit:${String(guard.value)}`;
      }
      if (guard.kind === 'unary' && guard.operator === '!' && guard.expression !== undefined) {
        const inner = serializeGuard(guard.expression);
        return inner === undefined ? undefined : `unop:!(${inner})`;
      }
      if (guard.kind === 'binary' && ['&&', '||', '==', '!=', '<', '<=', '>', '>='].includes(guard.operator ?? '')
        && guard.left !== undefined && guard.right !== undefined) {
        const left = serializeGuard(guard.left);
        const right = serializeGuard(guard.right);
        return left === undefined || right === undefined ? undefined
          : `binop:${guard.operator}(${left},${right})`;
      }
      return undefined;
    };
    let valueExpression: string | undefined;
    if (final?.value && mutations.every((mutation) =>
      JSON.stringify(mutation.guard) === JSON.stringify(final.guard))) {
      valueExpression = serialize(final.value);
    } else {
      // The cache's final value is the last executed source write. Replay the pure argument guards in source
      // order; the inactive fallback is immaterial because the separate activation leaves that arm unwritten.
      let folded: string | undefined = 'lit:0';
      for (const mutation of mutations) {
        const guard = serializeGuard(mutation.guard);
        const value = mutation.value === undefined ? undefined : serialize(mutation.value);
        if (guard === undefined || value === undefined) { folded = undefined; break; }
        folded = `ternary(${guard},${value},${folded})`;
      }
      valueExpression = folded;
    }
    return { activation, ...(valueExpression !== undefined && {
      valueSource: { expression: valueExpression, parameters: [...parameters] },
    }) };
  }

  // Entries m[k] written via array ops (element/push/pop) more than once OR inside a loop, with an INVARIANT key
  // (identifier not reassigned, or msg.sender/tx.origin) and no whole-entry assign/delete. Those need
  // read-once/mutate-local/write-once.
  private collectCacheableEntries(
    body: Node,
  ): Array<{
      mapping: string; keys: KeyKind[]; valueType: Type; inLoop: boolean; mutationCount: number;
      fromModifier?: string;
      anchorIndex?: number;
    }> {
    const info = new Map<string, EntryInfo>();
    const get = (mapping: string, rawKeys: Node | Node[], allowExpression = false): EntryInfo | null => {
      const keys = Array.isArray(rawKeys) ? rawKeys : [rawKeys];
      const canonical = keys.map((key) => canonKeyOf(key, allowExpression));
      if (canonical.some((key) => key === null)) return null;
      const resolved = canonical as { canon: string; key: KeyKind }[];
      const ek = `${mapping}|${resolved.map((key) => key.canon).join('|')}`;
      let e = info.get(ek);
      if (!e) {
        e = {
          mapping, keys: resolved.map((key) => key.key), count: 0, inLoop: false, bad: false,
          written: false, readAfterWrite: false,
        };
        info.set(ek, e);
      }
      return e;
    };
    const scan = (n: Node, inLoop: boolean): void => {
      if (!n) return;
      // Before symbol resolution, source-level `m[k] = value` is still represented as ArrayAssignNode. Account for
      // that form here; the MappingAssignNode arm handles nodes synthesized by earlier lowering passes.
      if (n instanceof ArrayAssignNode && this.scalarMappings.has(n.name)) {
        const e = get(n.name, n.index, true);
        if (e) {
          e.fromModifier ??= n.fromModifier;
          e.count += 1;
          e.written = true;
          if (inLoop) e.inLoop = true;
        }
      }
      if (n instanceof ArrayAccessNode && n.array instanceof IdentifierNode
        && this.scalarMappings.has(n.array.name)) {
        const e = get(n.array.name, n.index, true);
        if (e?.written) e.readAfterWrite = true;
      }
      // X19: the same read written `this.m[k]` (or produced by an earlier lowering pass) is a MappingAccessNode,
      // not an ArrayAccessNode. Without this arm the two spellings of one read-modify-write lowered differently -
      // the bare one read-once/mutate-local/write-once, the dotted one in place - and published different
      // bytecode and a different entry-access order for byte-identical source intent.
      if (n instanceof MappingAccessNode && this.scalarMappings.has(n.name)
        && n.keys.length === this.scalarMappings.get(n.name)!.depth) {
        const e = get(n.name, n.keys, true);
        if (e?.written) e.readAfterWrite = true;
      }
      // `m[<numeric literal>]` is still a tuple index before symbol resolution lowers it to a mapping access: the
      // grammar builds `expression '[' NumberLiteral ']'` as a TupleIndexOpNode, so a read written that way stayed
      // invisible here and its entry was never recognised as read-after-write.
      if (n instanceof TupleIndexOpNode && n.tuple instanceof IdentifierNode
        && (this.scalarMappings.has(n.tuple.name) || this.structMappings.has(n.tuple.name))) {
        const literal = new IntLiteralNode(BigInt(n.index));
        literal.location = n.location;
        const e = get(n.tuple.name, [literal], true);
        if (e?.written) e.readAfterWrite = true;
      }
      // A struct entry read through an index expression (`m[k]` feeding a field access) is the same read as the
      // scalar form; without this arm only the write marked the entry and no read-after-write was recorded.
      if (n instanceof ArrayAccessNode && n.array instanceof IdentifierNode
        && (this.structMappings.has(n.array.name) || this.scalarMappings.has(n.array.name))) {
        const e = get(n.array.name, n.index, true);
        if (e?.written) e.readAfterWrite = true;
      }
      // A whole-entry `m[k] = Struct(...)` write: Solidity-facing lowering coalesces `m[k].field = v` into this
      // form before this pass runs, so it is the only write shape a struct entry is seen with here.
      if (n instanceof StateArrayAssignNode
        && (this.structMappings.has(n.name) || this.scalarMappings.has(n.name))) {
        const e = get(n.name, n.index, true);
        if (e) {
          e.count += 1;
          e.written = true;
          if (inLoop) e.inLoop = true;
        }
      }
      if (n instanceof MappingAssignNode && this.arrayMappings.has(n.name)) {
        const k0 = n.keys[0];
        // element write `m[k][j]=v` is keys=[k,j] pre-semantic; push/pop are keys=[k] + flag; whole assign is keys=[k].
        const isElementWrite = n.arrayIndex !== undefined || (n.keys.length === 2 && !n.arrayPush && !n.arrayPop);
        // canonKeyOf accepts stable identifiers and compile-time literal keys. Both identify one invariant entry
        // across the loop; literal string keys are common after inlining `Lib.set(data["abc"])`.
        const elementType = (this.arrayMappings.get(n.name) as ArrayType).elementType;
        const e = get(n.name, k0, !(elementType instanceof StructType));
        if (e) {
          if (n.arrayPush || n.arrayPop || isElementWrite) {
            e.count += 1;
            if (inLoop) e.inLoop = true;
          } else {
            e.bad = true; // whole-entry assign m[k]=v: cache reassign not handled -> do not cache this entry
          }
        }
      }
      if (n instanceof MappingDeleteNode && this.arrayMappings.has(n.name)) {
        const elementType = (this.arrayMappings.get(n.name) as ArrayType).elementType;
        const e = n.keys.length === 1
          ? get(n.name, n.keys[0], !(elementType instanceof StructType)) : null;
        if (e) {
          e.fromModifier ??= n.fromModifier;
          e.count += 1;
          e.written = true;
          if (inLoop) e.inLoop = true;
        }
      }
      // Scalar vmap mapping: a WHOLE-entry write `m[k] = expr` (an RMW `m[k] -= v` desugars to this) to an INVARIANT
      // key (identifier or msg.sender/tx.origin) is the cacheable form (read once -> mutate local -> one upsert).
      // A delete is an assignment of the type default and uses the same cache-local mutation + one-upsert flush.
      // Any array-op on a scalar mapping should not occur; if it does, mark bad (be safe).
      if (n instanceof MappingAssignNode && this.scalarMappings.has(n.name)) {
        const mapping = this.scalarMappings.get(n.name)!;
        const e = n.keys.length === mapping.depth ? get(n.name, n.keys, true) : null;
        if (e) {
          e.fromModifier ??= n.fromModifier;
          if (n.arrayIndex === undefined && !n.arrayPush && !n.arrayPop) {
            e.count += 1;
            e.written = true;
            if (inLoop) e.inLoop = true;
          } else {
            e.bad = true;
          }
        }
      }
      if (n instanceof MappingDeleteNode && this.scalarMappings.has(n.name)) {
        const mapping = this.scalarMappings.get(n.name)!;
        const e = n.keys.length === mapping.depth ? get(n.name, n.keys, true) : null;
        if (e) {
          e.fromModifier ??= n.fromModifier;
          e.count += 1;
          e.written = true;
          if (inLoop) e.inLoop = true;
        }
      }
      if (n instanceof MappingFieldAssignNode && this.structMappings.has(n.name)) {
        const e = get(n.name, n.keys[0]);
        if (e) {
          e.fromModifier ??= n.fromModifier;
          e.count += 1;
          e.written = true;
          if (inLoop) e.inLoop = true;
        }
      }
      if (n instanceof MappingDeleteNode && this.structMappings.has(n.name)) {
        const e = n.keys.length === 1 ? get(n.name, n.keys[0]) : null;
        if (e) {
          e.fromModifier ??= n.fromModifier;
          e.count += 1;
          e.written = true;
          if (inLoop) e.inLoop = true;
        }
      }
      const nowLoop = inLoop || n instanceof WhileNode || n instanceof DoWhileNode;
      for (const key of Object.keys(n)) {
        // Semantic metadata contains back-references into function definitions,
        // symbol tables, and collection declarations. Those are not executable
        // children of this function body; following them can attribute a
        // callee's or an earlier pre-lowered body's storage operations to the
        // current function and synthesize phantom cache reads/writes.
        if (['location', 'resolvedFunction', 'functionReference', 'definition',
          'collection', 'symbolTable', 'stateVariable'].includes(key)) continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) scan(v, nowLoop);
        else if (Array.isArray(v)) for (const el of v) if (el instanceof Node) scan(el, nowLoop);
      }
    };
    scan(body, false);
    const out: Array<{
      mapping: string; keys: KeyKind[]; valueType: Type; inLoop: boolean; mutationCount: number;
      fromModifier?: string;
    }> = [];
    for (const e of info.values()) {
      // A struct entry needs the local rebuild path for even one field write, but a read-only struct access must
      // stay read-only. Treating every struct entry as cacheable synthesized an unconditional whole-entry flush
      // for plain reads, widening their ABI operation from `read` to `read,write` and requiring phantom outputs.
      if (e.bad || !(e.inLoop || e.count >= 2 || e.readAfterWrite
        || (e.written && this.structMappings.has(e.mapping)))) continue;
      // key must be invariant across the function: an identifier must not be reassigned; nullary keys always are.
      // A key declared by one top-level statement is invariant too, but it is not in scope at the function entry,
      // so its cache read is anchored at the entry's first use instead of hoisted (`anchorIndex` below).
      const scope = this.nameScope(body);
      let anchorIndex: number | undefined;
      let keyUsable = true;
      for (const key of e.keys) {
        if (key.kind !== 'id' || key.name.startsWith(VMAP_KEY_SNAPSHOT_PREFIX)) continue;
        if (scope.declaredInLoop.has(key.name) || scope.reassigned.has(key.name)) { keyUsable = false; break; }
        if (!scope.assigned.has(key.name)) continue;
        // The route-snapshot instance runs before kernel route synthesis, where a handler's collection accesses are
        // the ones the message-bus covenant and the SDK's argument derivation both read by name. An anchored local
        // there changes that shape, so the anchored form stays with the ordinary pipeline; kernel handlers keep
        // their established snapshot-key caching.
        if (this.routeSnapshotKeysOnly) { keyUsable = false; break; }
        const declaration = scope.declaredTopLevel.get(key.name);
        const statements = body instanceof BlockNode ? body.statements ?? [] : [];
        const anchor = this.firstUseStatement(body, e);
        if (declaration === undefined || anchor === undefined
          || statements.indexOf(declaration) > anchor) { keyUsable = false; break; }
        anchorIndex = anchor;
      }
      if (!keyUsable) continue;
      const expressionKeys = e.keys.filter((key): key is Extract<KeyKind, { kind: 'expression' }> =>
        key.kind === 'expression');
      if (expressionKeys.length > 0) {
        const dependencies = new Set(expressionKeys.flatMap((key) =>
          [...expressionParameterDependencies(key.node)]));
        // Expression keys are hoisted to the function entry, so every runtime dependency must already be in
        // scope there and remain immutable for the complete invocation. In practice these are public arguments;
        // local aliases can be supported later by moving this cache to the loop boundary rather than pretending
        // they exist at function entry.
        if (mutatesExpressionDependency(body, dependencies)) continue;
      }
      out.push({
        mapping: e.mapping, keys: e.keys, inLoop: e.inLoop, mutationCount: e.count,
        valueType: (this.arrayMappings.get(e.mapping) ?? this.scalarMappings.get(e.mapping)?.valueType
          ?? this.structMappings.get(e.mapping))!,
        fromModifier: e.fromModifier,
        ...(anchorIndex !== undefined && { anchorIndex }),
      });
    }
    return out;
  }

  /**
   * Index of the first top-level statement that touches one entry: the anchor for a cache read whose key is a body
   * local. Reading the entry there yields the value every later read must observe once the entry's writes are
   * redirected to the cache local, and the key is in scope because its own declaration precedes this statement.
   */
  private firstUseStatement(body: Node, entry: EntryInfo): number | undefined {
    if (!(body instanceof BlockNode)) return undefined;
    const keyCanons = entry.keys.map(keyCanon);
    let found = false;
    const matches = (name: string | undefined, keys: Node[]): boolean => {
      if (name !== entry.mapping || keys.length < keyCanons.length) return false;
      return keyCanons.every((canon, index) => {
        const canonical = canonKeyOf(keys[index], true);
        return canonical !== null && canonical.canon === canon;
      });
    };
    const walk = (node: Node): void => {
      if (found) return;
      if (node instanceof ArrayAccessNode && node.array instanceof IdentifierNode
        && matches(node.array.name, [node.index])) { found = true; return; }
      if (node instanceof ArrayAssignNode && matches(node.name, [node.index])) { found = true; return; }
      if (node instanceof StateArrayAssignNode && matches(node.name, [node.index])) { found = true; return; }
      if (node instanceof MappingAccessNode && matches(node.name, node.keys)) { found = true; return; }
      if (node instanceof MappingAssignNode && matches(node.name, node.keys)) { found = true; return; }
      if (node instanceof MappingFieldAssignNode && matches(node.name, node.keys)) { found = true; return; }
      if (node instanceof TupleIndexOpNode && node.tuple instanceof IdentifierNode) {
        const literal = new IntLiteralNode(BigInt(node.index));
        literal.location = node.location;
        if (matches(node.tuple.name, [literal])) { found = true; return; }
      }
      for (const key of Object.keys(node)) {
        if (found || ['location', 'resolvedFunction', 'functionReference', 'definition',
          'collection', 'symbolTable', 'stateVariable'].includes(key)) continue;
        const child = (node as unknown as Record<string, unknown>)[key];
        if (child instanceof Node) walk(child);
        else if (Array.isArray(child)) for (const item of child) if (item instanceof Node) walk(item);
      }
    };
    const statements = body.statements ?? [];
    for (const [index, statement] of statements.entries()) {
      walk(statement);
      if (found) return index;
    }
    return undefined;
  }

  /**
   * A tuple/local declared inside the loop is a fresh per-iteration value even when no AssignNode reassigns it.
   * Treating that identifier as invariant hoists `m[key]` before the loop, outside the declaration's lexical
   * scope (Kashi cook's `(share, address to, ...) = abi.decode(datas[i], ...)` became a function-top
   * `userCollateralShare[to]` read and failed as an undefined reference).
   */
  /**
   * Names the body assigns (`AssignNode` target or any `VariableDefinitionNode`) and names it declares inside a
   * loop, collected in ONE traversal per body.
   *
   * Both predicates were previously invoked per candidate key name over the same body, so a body with N
   * identifier keys was walked 2N times by `assignsName`/`declaresNameInsideLoop`. A read-only call census
   * measured 531,664 + 532,018 recursive calls across 26/27 top-level entries over only 8/9 distinct bodies.
   * The two predicates are pure and read only node classes and names, so answering them from a name set
   * computed once is exact.
   */
  private nameScopeCache = new WeakMap<Node, {
    assigned: Set<string>;
    declaredInLoop: Set<string>;
    declaredTopLevel: Map<string, StatementNode>;
    reassigned: Set<string>;
  }>();

  private nameScope(root: Node): {
    assigned: Set<string>;
    declaredInLoop: Set<string>;
    declaredTopLevel: Map<string, StatementNode>;
    reassigned: Set<string>;
  } {
    const cached = this.nameScopeCache.get(root);
    if (cached !== undefined) return cached;
    const assigned = new Set<string>();
    const declaredInLoop = new Set<string>();
    // A key that is a body local is invariant when one top-level statement declares it and nothing assigns it
    // again: its value cannot change between the first write and the later reads the cache serves.
    const declaredTopLevel = new Map<string, StatementNode>();
    const reassigned = new Set<string>();
    if (root instanceof BlockNode) {
      for (const statement of root.statements ?? []) {
        if (statement instanceof VariableDefinitionNode) declaredTopLevel.set(statement.name, statement);
      }
    }
    // Mirrors `assignsName`: it matches an `AssignNode` target or a `VariableDefinitionNode` anywhere in the
    // body, and it skips no loop context, so every such name is recorded.
    const scanAssigned = (n: Node): void => {
      if (n instanceof AssignNode && n.identifier instanceof IdentifierNode) {
        assigned.add(n.identifier.name);
        reassigned.add(n.identifier.name);
      } else if (n instanceof VariableDefinitionNode) assigned.add(n.name);
      for (const key of Object.keys(n)) {
        if (['location', 'resolvedFunction', 'functionReference', 'definition',
          'collection', 'symbolTable', 'stateVariable'].includes(key)) continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) scanAssigned(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) scanAssigned(e);
      }
    };
    // Mirrors `declaresNameInsideLoop`, which only counts declarations that are already inside a loop.
    const scanDeclaredInLoop = (n: Node, inLoop: boolean): void => {
      const nowLoop = inLoop || n instanceof WhileNode || n instanceof DoWhileNode;
      if (nowLoop && n instanceof VariableDefinitionNode) declaredInLoop.add(n.name);
      else if (nowLoop && n instanceof TupleAssignmentNode) {
        for (const element of n.elements) {
          if (!element.skip && !element.existing && element.name) declaredInLoop.add(element.name);
        }
      }
      for (const key of Object.keys(n)) {
        if (['location', 'resolvedFunction', 'functionReference', 'definition',
          'collection', 'symbolTable', 'stateVariable'].includes(key)) continue;
        const child = (n as unknown as Record<string, unknown>)[key];
        if (child instanceof Node) scanDeclaredInLoop(child, nowLoop);
        else if (Array.isArray(child)) for (const item of child) if (item instanceof Node) scanDeclaredInLoop(item, nowLoop);
      }
    };
    // `assignsName` also counts a `VariableDefinitionNode` OUTSIDE a loop, and `declaresNameInsideLoop` counts
    // one INSIDE it; running both walks covers each predicate's own reach exactly.
    scanAssigned(root);
    scanDeclaredInLoop(root, false);
    const scope = { assigned, declaredInLoop, declaredTopLevel, reassigned };
    this.nameScopeCache.set(root, scope);
    return scope;
  }

  private declaresNameInsideLoop(root: Node, name: string): boolean {
    let found = false;
    const walk = (node: Node, inLoop: boolean): void => {
      if (found) return;
      const nowLoop = inLoop || node instanceof WhileNode || node instanceof DoWhileNode;
      if (nowLoop && node instanceof VariableDefinitionNode && node.name === name) { found = true; return; }
      if (nowLoop && node instanceof TupleAssignmentNode
        && node.elements.some((element) => !element.skip && !element.existing && element.name === name)) {
        found = true; return;
      }
      for (const key of Object.keys(node)) {
        if (['location', 'resolvedFunction', 'functionReference', 'definition',
          'collection', 'symbolTable', 'stateVariable'].includes(key)) continue;
        const child = (node as unknown as Record<string, unknown>)[key];
        if (child instanceof Node) walk(child, nowLoop);
        else if (Array.isArray(child)) for (const item of child) if (item instanceof Node) walk(item, nowLoop);
      }
    };
    walk(root, false);
    return found;
  }

  private makeFlush(
    mapping: string, keys: KeyKind[], local: string, dirty: string, loc: Node['location'], fromModifier?: string,
    guardPlan?: { activation: ExternalCallExpression; valueSource?: { expression: string; parameters: string[] } },
  ): BranchNode {
    const rhs = new IdentifierNode(local);
    rhs.location = loc;
    const keyNodes = keys.map((key) => buildKeyNode(key, loc) as ExpressionNode);
    const flush = new MappingAssignNode(mapping, keyNodes, rhs); // m[k1][k2] = local
    flush.fromModifier = fromModifier;
    flush.location = loc;
    flush.kernelValueSource = guardPlan?.valueSource;
    const flushBlock = new BlockNode([flush]);
    flushBlock.location = loc;
    const condition = new IdentifierNode(dirty);
    condition.location = loc;
    const branch = new BranchNode(condition, flushBlock);
    branch.location = loc;
    // The not-dirty arm is a physical no-op. If-converting it to a preserve write would still consume and recreate
    // chunk-backed resources, defeating the dirty bit and forcing outputs for paths which never changed the entry.
    branch.preserveConditionalEntryWrites = true;
    branch.kernelEntryActivation = guardPlan?.activation;
    return branch;
  }

  // Insert a `m[k] = local` flush before every return (recursing into if/switch/try/blocks, NOT loops - in-loop
  // returns were already rewritten to flag+break by DesugarReturnInLoop). Mirrors CacheDynamicArrayInLoop.
  private insertFlushesBeforeReturns(
    stmts: StatementNode[], mapping: string, keys: KeyKind[], local: string, dirty: string,
    guardPlan?: { activation: ExternalCallExpression; valueSource?: { expression: string; parameters: string[] } },
  ): StatementNode[] {
    const rec = (s: StatementNode[]): StatementNode[] =>
      this.insertFlushesBeforeReturns(s ?? [], mapping, keys, local, dirty, guardPlan);
    const out: StatementNode[] = [];
    for (const stmt of stmts) {
      if (stmt instanceof ReturnNode) {
        out.push(this.makeFlush(mapping, keys, local, dirty, stmt.location, undefined, guardPlan));
        out.push(stmt);
        continue;
      }
      if (stmt instanceof BranchNode) {
        stmt.ifBlock.statements = rec(stmt.ifBlock.statements ?? []);
        if (stmt.elseBlock) stmt.elseBlock.statements = rec(stmt.elseBlock.statements ?? []);
      } else if (stmt instanceof SwitchNode) {
        for (const c of stmt.cases) c.body.statements = rec(c.body.statements ?? []);
        if (stmt.defaultCase) stmt.defaultCase.statements = rec(stmt.defaultCase.statements ?? []);
      } else if (stmt instanceof TryCatchNode) {
        stmt.tryBlock.statements = rec(stmt.tryBlock.statements ?? []);
        for (const cc of stmt.catchClauses) cc.block.statements = rec(cc.block.statements ?? []);
      } else if (stmt instanceof UncheckedNode) {
        stmt.block.statements = rec(stmt.block.statements ?? []);
      } else if (stmt instanceof BlockNode) {
        stmt.statements = rec(stmt.statements ?? []);
      }
      out.push(stmt);
    }
    return out;
  }

  // Does `node` contain an assignment / declaration that writes the identifier `name` (so the key is not invariant)?
  private assignsName(node: Node, name: string): boolean {
    let found = false;
    const scan = (n: Node): void => {
      if (!n || found) return;
      if (n instanceof AssignNode && n.identifier instanceof IdentifierNode && n.identifier.name === name) found = true;
      if (n instanceof VariableDefinitionNode && n.name === name) found = true;
      for (const key of Object.keys(n)) {
        if (found || ['location', 'resolvedFunction', 'functionReference', 'definition',
          'collection', 'symbolTable', 'stateVariable'].includes(key)) continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) scan(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) scan(e);
      }
    };
    scan(node);
    return found;
  }
}

// Redirects every access of the entry m[k] (mapping, simple key identifier) to the local array `local`: WRITES
// m[k][j]=v / .push / .pop are MappingAssignNodes -> local array ops; READS m[k] / m[k][j] are ArrayAccessNodes
// (bottoming out at IdentifierNode(m)) -> local / local[j].
class EntryRedirect extends AstTraversal {
  constructor(
    private mapping: string, private keys: KeyKind[], private local: string, private dirty: string,
    private valueType: Type,
  ) { super(); }

  private withDirty(write: StatementNode, loc: Node['location']): BlockNode {
    const dirty = new IdentifierNode(this.dirty);
    dirty.location = loc;
    const value = new BoolLiteralNode(true);
    value.location = loc;
    const mark = new AssignNode(dirty, value);
    mark.location = loc;
    const block = new BlockNode([write, mark]);
    block.location = loc;
    return block;
  }

  private entryIndex(node: MappingAccessNode | MappingAssignNode): Node | undefined {
    if (node.arrayIndex) return node.arrayIndex;
    if (node.keys.length > this.keys.length) return node.keys[this.keys.length];
    return undefined;
  }

  private matches(name: string, keys: Node[]): boolean {
    return name === this.mapping && keys.length >= this.keys.length
      && this.keys.every((key, index) => keyNodeMatches(keys[index], key));
  }

  // A READ `m[k]` is ArrayAccessNode(IdentifierNode(m), <key>); `m[k][j]` nests it. Recurse first (inner
  // m[k] -> local), then collapse m[k] to `local`; the outer m[k][j] falls out as a local element read local[j].
  visitArrayAccess(node: ArrayAccessNode): Node {
    const visited = super.visitArrayAccess(node) as ArrayAccessNode;
    if (this.keys.length === 1 && visited instanceof ArrayAccessNode
      && visited.array instanceof IdentifierNode && (visited.array as IdentifierNode).name === this.mapping
      && keyNodeMatches(visited.index, this.keys[0])) {
      const id = new IdentifierNode(this.local);
      id.location = visited.location;
      return id;
    }
    return visited;
  }

  // `m[<numeric literal>]` (read) is a TupleIndexOpNode before symbol resolution: collapse it to the cache local
  // exactly like the ArrayAccessNode form, so the value written through this cache is what the read observes.
  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    const visited = super.visitTupleIndexOp(node) as TupleIndexOpNode;
    if (this.keys.length === 1 && visited instanceof TupleIndexOpNode
      && visited.tuple instanceof IdentifierNode
      && (visited.tuple as IdentifierNode).name === this.mapping) {
      const literal = new IntLiteralNode(BigInt(visited.index));
      literal.location = visited.location;
      if (keyNodeMatches(literal, this.keys[0])) {
        const id = new IdentifierNode(this.local);
        id.location = visited.location;
        return id;
      }
    }
    return visited;
  }

  visitStateArrayAssign(node: StateArrayAssignNode): Node {
    const visited = super.visitStateArrayAssign(node) as StateArrayAssignNode;
    if (visited instanceof StateArrayAssignNode && this.keys.length === 1
      && visited.name === this.mapping && keyNodeMatches(visited.index, this.keys[0])) {
      const id = new IdentifierNode(this.local);
      id.location = visited.location;
      const asgn = new AssignNode(id, visited.value);
      asgn.location = visited.location;
      return this.withDirty(asgn, visited.location);
    }
    return visited;
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    const visited = super.visitMappingAccess(node) as MappingAccessNode;
    if (visited instanceof MappingAccessNode && this.matches(visited.name, visited.keys)) {
      const idx = this.entryIndex(visited);
      if (idx) { const acc = new MappingAccessNode(this.local, [idx]); acc.location = visited.location; return acc; }
      const id = new IdentifierNode(this.local); id.location = visited.location; return id;
    }
    return visited;
  }

  visitMappingAssign(node: MappingAssignNode): Node {
    const visited = super.visitMappingAssign(node) as MappingAssignNode;
    if (visited instanceof MappingAssignNode && this.matches(visited.name, visited.keys)) {
      if (visited.arrayPush) {
        const p = new ArrayPushNode(this.local, visited.expression);
        p.noArg = visited.noArg;
        p.location = visited.location;
        return this.withDirty(p, visited.location);
      }
      if (visited.arrayPop) {
        const p = new ArrayPopNode(this.local);
        p.location = visited.location;
        return this.withDirty(p, visited.location);
      }
      const idx = this.entryIndex(visited);
      if (idx) {
        const a = new ArrayAssignNode(this.local, idx, visited.expression);
        a.location = visited.location;
        return this.withDirty(a, visited.location);
      }
      // Whole-entry write `m[k] = expr` -> `local = expr`. Only fires for a CACHED SCALAR entry: an array entry with
      // a whole write is marked `bad` (never cached), so an array EntryRedirect never reaches here for its own m[k].
      const id = new IdentifierNode(this.local); id.location = visited.location;
      const asgn = new AssignNode(id, visited.expression);
      asgn.location = visited.location;
      return this.withDirty(asgn, visited.location);
    }
    return visited;
  }

  visitMappingDelete(node: MappingDeleteNode): Node {
    const visited = super.visitMappingDelete(node) as MappingDeleteNode;
    if (!(visited instanceof MappingDeleteNode)
      || visited.keys.length !== this.keys.length
      || !this.matches(visited.name, visited.keys)) return visited;
    const local = new IdentifierNode(this.local);
    local.location = visited.location;
    const write = new AssignNode(
      local, createDefaultValueExpression(this.valueType, visited.location),
    );
    write.location = visited.location;
    return this.withDirty(write, visited.location);
  }

  visitMappingFieldAssign(node: MappingFieldAssignNode): Node {
    const visited = super.visitMappingFieldAssign(node) as MappingFieldAssignNode;
    if (!(visited instanceof MappingFieldAssignNode) || !this.matches(visited.name, visited.keys)) return visited;
    if (!(this.valueType instanceof StructType) || (visited.trailingMembers?.length ?? 0) > 0) return visited;
    const args = this.valueType.fields.map((field) => {
      if (field.name === visited.fieldName) return cloneNode(visited.expression) as typeof visited.expression;
      const base = new IdentifierNode(this.local); base.location = visited.location;
      const read = new FieldAccessNode(base, field.name); read.location = visited.location;
      return read;
    });
    const ctorName = new IdentifierNode(this.valueType.name); ctorName.location = visited.location;
    const rebuilt = new FunctionCallNode(ctorName, args); rebuilt.location = visited.location;
    const local = new IdentifierNode(this.local); local.location = visited.location;
    const write = new AssignNode(local, rebuilt); write.location = visited.location;
    return this.withDirty(write, visited.location);
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    const visited = super.visitArrayAssign(node) as ArrayAssignNode;
    if (this.keys.length === 1 && visited instanceof ArrayAssignNode
      && visited.name === this.mapping && keyNodeMatches(visited.index, this.keys[0])) {
      const id = new IdentifierNode(this.local); id.location = visited.location;
      const asgn = new AssignNode(id, visited.value);
      asgn.location = visited.location;
      return this.withDirty(asgn, visited.location);
    }
    return visited;
  }
}
