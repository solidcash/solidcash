import {
  BlockNode,
  BranchNode,
  AssignNode,
  ArrayAccessNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  ContractNode,
  EmitStatementNode,
  ExpressionNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  FunctionDefinitionNode,
  FunctionModifier,
  IdentifierNode,
  IndirectCallNode,
  LiteralNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  Node,
  NullaryOpNode,
  ParameterNode,
  RequireNode,
  ReturnNode,
  SourceFileNode,
  StatementNode,
  TupleAssignmentNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import { Type } from '@solidcash/utils';

interface Candidate {
  fn: FunctionDefinitionNode;
  collection: string;
  keyParameters: string[];
  journalName: string;
  valueType: Type;
}

interface JournalEntry {
  collection: string;
  keyParameters: string[];
  journalName: string;
  valueType: Type;
}

interface MultiCandidate {
  fn: FunctionDefinitionNode;
  entries: JournalEntry[];
}

/** Strip the compiler's synthetic batch-clone prefix so a diagnostic names the handler the user wrote. */
const sourceHandlerName = (name: string): string => name
  .replace(/^__scb_(?:resource|handler|dynamic|array|graph)_/, '')
  .replace(/_self_alias$/, '');

interface ActiveMultiCache {
  target: MultiCandidate;
  locals: Array<{
    entry: JournalEntry;
    name: string;
    keys: ExpressionNode[];
    keyIdentity: string[];
  }>;
  calls: WeakMap<FunctionCallNode, Array<{
    entry: JournalEntry;
    name: string;
    keys: ExpressionNode[];
  }>>;
}

/**
 * Release 3's first collection-journal lowering.
 *
 * A reusable void helper which reads/writes one concrete mapping entry is
 * converted to a value handler. The physical wrapper performs the authenticated
 * entry read and the single write-back, while the OP_INVOKE body receives and
 * returns the pending value:
 *
 *   _add(k, n)                       balances[k] =
 *     balances[k] += n;       ->       _add(__journal, k, n);
 *
 * This deliberately handles only parameter-keyed, whole-value scalar entries.
 * Unsupported/dynamically discovered keys retain the established inline path;
 * they are never silently journalled.
 */
export default class LowerCollectionJournalHelpers extends AstTraversal {
  private candidates = new Map<string, Candidate>();
  private multiCandidates = new Map<string, MultiCandidate>();
  private current?: Candidate;
  private currentMulti?: MultiCandidate;
  private activeMultiCaches = new Map<string, ActiveMultiCache>();

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const collections = new Map(node.collections.map((collection) => [collection.name, collection]));
    const constructorCalls = new Set<string>();
    this.walk(node.constructorDef?.body, (candidate) => {
      if (candidate instanceof FunctionCallNode) constructorCalls.add(candidate.identifier.name);
    });
    const nameCounts = new Map<string, number>();
    for (const fn of node.functions) nameCounts.set(fn.name, (nameCounts.get(fn.name) ?? 0) + 1);
    const touchesCollection = (fn: FunctionDefinitionNode): boolean => {
      let touches = false;
      this.walk(fn.body, (candidate) => {
        if ((candidate instanceof MappingAccessNode || candidate instanceof MappingAssignNode
          || candidate instanceof MappingDeleteNode) && collections.has(candidate.name)) touches = true;
        else if (candidate instanceof ArrayAccessNode && candidate.array instanceof IdentifierNode
          && collections.has(candidate.array.name)) touches = true;
        else if ((candidate instanceof ArrayAssignNode || candidate instanceof ArrayDeleteNode)
          && collections.has(candidate.name)) touches = true;
      });
      return touches;
    };
    // `LowerDynamicStateJournalHelpers` runs immediately before this pass and converts a helper which writes
    // exactly one chunk-backed bytes/string state variable into a returning value handler. This pass then
    // declines that same helper, because its return arity is no longer zero, so its collection accesses stay
    // raw inside an OP_INVOKE body: code generation reaches them with no block layout, and a synthesized
    // batch clone reaches them with C2 witness parameters its call site never forwards. Both produced an
    // internal compiler error rather than a diagnostic - 'Block layout not available while compiling ...' and
    // a parameter-arity mismatch on '__scb_resource_...'. The two journals do not yet share one exit, so
    // reject the combination with a stable message.
    //
    // The access does not have to be written in the handler. A state-touching callee is inlined into its
    // caller, and this pass's own call-site rewrite puts the entry read and the write-back in the CALLER, so
    // a collection reached through an intra-contract call lands in the same OP_INVOKE body. A body-only walk
    // therefore missed every indirect shape and let the internal error return unchanged; the reach is
    // computed over the intra-contract call graph instead. A function-pointer callsite names no target, so
    // `callGraphReach` over-approximates it to every address-taken contract function rather than admitting it.
    for (const fn of node.functions) {
      if (!fn.body || fn.parameters[0]?.name !== `__dj_${fn.name}`) continue;
      const reach = this.callGraphReach(fn, node, touchesCollection);
      if (reach.via) {
        throw new Error(
          `Handler '${sourceHandlerName(fn.name)}' writes unbounded bytes/string state and also reaches a `
          + 'collection entry. The dynamic-storage journal and the collection journal do not share one exit, '
          + 'so this handler cannot flush both; split the unbounded write and the collection access into '
          + 'separate handlers'
          + (reach.via === fn.name ? '' : ` (the collection entry is reached through '${
            sourceHandlerName(reach.via)}')`),
        );
      }
    }
    for (const fn of node.functions) {
      if (!fn.body || fn.returnTypes.length !== 0
        || !(fn.modifiers.includes(FunctionModifier.INTERNAL)
          || fn.modifiers.includes(FunctionModifier.PRIVATE))
        || fn.inheritedFrom || constructorCalls.has(fn.name)
        || (nameCounts.get(fn.name) ?? 0) > 1) continue;
      // X118. An event emitted inside a value-threaded OP_INVOKE handler is dropped at the subroutine exit, so
      // code generation refuses this shape outright. It compiles on the pre-existing inline path, so do not
      // select it: the journal is an optimisation, and taking it here costs the whole contract.
      let emitsEvent = false;
      this.walk(fn.body, (candidate) => {
        if (candidate instanceof EmitStatementNode) emitsEvent = true;
      });
      if (emitsEvent) continue;
      const accesses: Array<{
        name: string;
        keys: ExpressionNode[];
        node: MappingAccessNode | MappingAssignNode | MappingDeleteNode
        | ArrayAccessNode | ArrayAssignNode | ArrayDeleteNode;
      }> = [];
      let unsupported = false;
      this.walk(fn.body, (candidate) => {
        if (candidate instanceof FunctionCallNode && candidate.identifier.name === fn.name) unsupported = true;
        if (candidate instanceof MappingAccessNode || candidate instanceof MappingAssignNode
          || candidate instanceof MappingDeleteNode) {
          if ((candidate instanceof MappingAccessNode && candidate.arrayIndex)
            || (candidate instanceof MappingAssignNode
              && (candidate.arrayIndex || candidate.arrayPush || candidate.arrayPop))) unsupported = true;
          accesses.push({ name: candidate.name, keys: candidate.keys, node: candidate });
        } else if (candidate instanceof ArrayAccessNode && candidate.array instanceof IdentifierNode
          && collections.has(candidate.array.name)) {
          accesses.push({ name: candidate.array.name, keys: [candidate.index], node: candidate });
        } else if ((candidate instanceof ArrayAssignNode || candidate instanceof ArrayDeleteNode)
          && collections.has(candidate.name)) {
          accesses.push({ name: candidate.name, keys: [candidate.index], node: candidate });
        } else if (candidate.constructor.name === 'MappingFieldAssignNode') unsupported = true;
      });
      if (unsupported || accesses.length === 0) continue;
      const parameterNames = new Set(fn.parameters.map((parameter) => parameter.name));
      const normalized = accesses.map((access) => ({
        ...access,
        keyParameters: access.keys.map((key) =>
          key instanceof IdentifierNode && parameterNames.has(key.name) ? key.name : undefined),
      }));
      if (normalized.some((access) => access.keyParameters.some((key) => key === undefined))) continue;
      const leafAccesses = normalized.filter((access) => !normalized.some((other) =>
        other !== access
        && other.name === access.name
        && other.keyParameters.length > access.keyParameters.length
        && access.keyParameters.every((key, index) => key === other.keyParameters[index])));
      const distinct = new Map<string, JournalEntry>();
      for (const access of leafAccesses) {
        const collection = collections.get(access.name);
        if (!collection || collection.innermostValueType.toString().endsWith('[]')) {
          unsupported = true;
          break;
        }
        const keyParameters = access.keyParameters as string[];
        const identity = `${access.name}[${keyParameters.join(',')}]`;
        if (!distinct.has(identity)) {
          distinct.set(identity, {
            collection: access.name,
            keyParameters,
            journalName: `__cj_${fn.name}_${distinct.size}`,
            valueType: collection.innermostValueType,
          });
        }
      }
      if (unsupported || distinct.size === 0) continue;
      // Every journalled entry value leaves through the single exit this pass appends below. A bare early
      // `return;` in the helper leaves before that exit, so it cannot carry the pending values back. The
      // wrapper-level check further down already rejects an early return in the CALLER for the same reason;
      // an early return in the helper itself was never checked, and because this pass runs before type
      // checking the user saw 'Return type mismatch: expected (bigint, bigint) but found ()' pointing at
      // their own `return;` rather than a diagnostic. Reject it by name.
      let hasEarlyReturn = false;
      this.walk(fn.body, (candidate) => {
        if (candidate instanceof ReturnNode) hasEarlyReturn = true;
      });
      if (hasEarlyReturn) {
        throw new Error(
          `Collection journal helper '${sourceHandlerName(fn.name)}' cannot contain an early return; `
          + 'its journalled entry values are flushed only at the single function exit',
        );
      }
      if (distinct.size > 1 || fn.forceCollectionJournalPool) {
        this.multiCandidates.set(`${fn.name}/${fn.parameters.length}`, {
          fn, entries: [...distinct.values()],
        });
        continue;
      }
      const [entry] = distinct.values();
      const journalName = `__cj_${fn.name}`;
      this.candidates.set(`${fn.name}/${fn.parameters.length}`, {
        fn, collection: entry.collection, keyParameters: entry.keyParameters, journalName,
        valueType: entry.valueType,
      });
    }

    // A wrapper-level cache is flushed at the normal function exit. Until write-back sinking handles every
    // control-flow exit, reject a return that leaves before that flush, rather than producing an artifact
    // whose authenticated entries can settle their default cache values.
    //
    // A TAIL return is not such a return. `_transfer(from, to, v); return true;` - the Solidity ERC-20
    // wrapper, and the exact shape UniswapV2ERC20, MyToken and the Unicrow tokens all write - has nothing
    // after it, so the flush is placed immediately before it by installMultiCaches and no path skips it.
    // Refusing it turned the whole file's multi-contract compile into a throw, which dropped every sibling
    // contract in the file. The three conditions below are what makes the placement exact: it is the LAST
    // top-level statement, it is the ONLY return, and it does not read an entry whose write-back now
    // precedes it.
    for (const candidate of this.multiCandidates.values()) {
      const journalled = new Set(candidate.entries.map((entry) => entry.collection));
      for (const wrapper of node.functions) {
        if (!wrapper.body) continue;
        let callsCandidate = false;
        this.walk(wrapper.body, (child) => {
          if (child instanceof FunctionCallNode
            && child.identifier.name === candidate.fn.name
            && child.parameters.length === candidate.fn.parameters.length) {
            callsCandidate = true;
          }
        });
        if (!callsCandidate) continue;
        const statements = wrapper.body.statements ?? [];
        const last = statements.length > 0 ? statements[statements.length - 1] : undefined;
        const tailReturn = last instanceof ReturnNode ? last : undefined;
        let returnCount = 0;
        this.walk(wrapper.body, (child) => {
          if (child instanceof ReturnNode) returnCount += 1;
        });
        if (returnCount === 0) continue;
        if (tailReturn !== undefined && returnCount === 1
          && !this.readsCollection(tailReturn, journalled)) continue;
        throw new Error(
          `Collection journal helper '${candidate.fn.name}' cannot be used by `
          + `'${wrapper.name}' because the wrapper contains an early return`,
        );
      }
    }

    // Rewrite call sites before changing arities.
    for (const fn of node.functions) {
      if (!fn.body) continue;
      this.current = this.candidates.get(`${fn.name}/${fn.parameters.length}`);
      this.currentMulti = this.multiCandidates.get(`${fn.name}/${fn.parameters.length}`);
      this.activeMultiCaches = this.currentMulti
        ? new Map()
        : this.prepareMultiCaches(fn.body, new Set(fn.parameters.map(({ name }) => name)));
      fn.body = this.rewriteBlock(fn.body);
      if (this.activeMultiCaches.size > 0) this.installMultiCaches(fn.body);
    }
    this.current = undefined;
    this.currentMulti = undefined;
    this.activeMultiCaches = new Map();

    // Turn each selected helper into a state-independent value handler. It is
    // now safe for normal OP_DEFINE/OP_INVOKE lowering.
    for (const candidate of this.candidates.values()) {
      const valueType = candidate.valueType;
      candidate.fn.parameters.unshift(this.at(new ParameterNode(
        valueType, candidate.journalName, [],
      ), candidate.fn));
      for (const parameter of candidate.fn.parameters) {
        if (candidate.keyParameters.includes(parameter.name)) parameter.syntheticallyUsed = true;
      }
      candidate.fn.returnTypes = [valueType];
      const body = candidate.fn.body!;
      body.statements ??= [];
      body.statements.push(this.at(
        new ReturnNode([this.at(new IdentifierNode(candidate.journalName), candidate.fn)]), candidate.fn,
      ));
      candidate.fn.collectionJournal = true;
    }
    for (const candidate of this.multiCandidates.values()) {
      candidate.fn.parameters.unshift(...candidate.entries.map((entry) =>
        this.at(new ParameterNode(entry.valueType, entry.journalName, []), candidate.fn)));
      for (const parameter of candidate.fn.parameters) {
        if (candidate.entries.some((entry) => entry.keyParameters.includes(parameter.name))) {
          parameter.syntheticallyUsed = true;
        }
      }
      candidate.fn.returnTypes = candidate.entries.map((entry) => entry.valueType);
      const body = candidate.fn.body!;
      body.statements ??= [];
      body.statements.push(this.at(new ReturnNode(candidate.entries.map((entry) =>
        this.at(new IdentifierNode(entry.journalName), candidate.fn))), candidate.fn));
      // This pass runs between semantic traversals. The first traversal's
      // entry metadata describes the pre-lowered storage body; leaving it on
      // the node would make the second traversal retain C2 witness parameters
      // for accesses which no longer exist.
      candidate.fn.entryAccesses = undefined;
      candidate.fn.sortedBatchInfo = undefined;
      candidate.fn.blockLayout = undefined;
      this.invalidateSemanticMetadata(candidate.fn);
      candidate.fn.collectionJournal = true;
    }
    return node;
  }

  private rewriteBlock(block: BlockNode): BlockNode {
    block.statements = (block.statements ?? []).flatMap((statement) => this.rewriteStatement(statement));
    return block;
  }

  private rewriteStatement(statement: StatementNode): StatementNode | StatementNode[] {
    if (statement instanceof FunctionCallStatementNode) {
      const key = `${statement.call.identifier.name}/${statement.call.parameters.length}`;
      const multiTarget = this.multiCandidates.get(key);
      if (multiTarget) return this.rewriteMultiCall(statement.call, multiTarget);
      const target = this.candidates.get(key);
      if (target) return this.rewriteCall(statement.call, target);
    }
    if (this.currentMulti && statement instanceof MappingAssignNode) {
      const entry = this.multiEntry(statement.name, statement.keys);
      if (entry) {
        return this.at(new AssignNode(
          this.at(new IdentifierNode(entry.journalName), statement),
          this.rewriteExpression(statement.expression),
        ), statement);
      }
    }
    if (this.currentMulti && statement instanceof MappingDeleteNode) {
      const entry = this.multiEntry(statement.name, statement.keys);
      if (entry) {
        return this.at(new AssignNode(
          this.at(new IdentifierNode(entry.journalName), statement),
          createDefaultValueExpression(entry.valueType, statement.location),
        ), statement);
      }
    }
    if (this.currentMulti && statement instanceof ArrayAssignNode) {
      const entry = this.multiEntry(statement.name, [statement.index]);
      if (entry) {
        return this.at(new AssignNode(
          this.at(new IdentifierNode(entry.journalName), statement),
          this.rewriteExpression(statement.value),
        ), statement);
      }
    }
    if (this.currentMulti && statement instanceof ArrayDeleteNode) {
      const entry = this.multiEntry(statement.name, [statement.index]);
      if (entry) {
        return this.at(new AssignNode(
          this.at(new IdentifierNode(entry.journalName), statement),
          createDefaultValueExpression(entry.valueType, statement.location),
        ), statement);
      }
    }
    if (this.current && statement instanceof MappingAssignNode
      && statement.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), statement),
        this.rewriteExpression(statement.expression),
      ), statement);
    }
    if (this.current && statement instanceof ArrayAssignNode
      && statement.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), statement),
        this.rewriteExpression(statement.value),
      ), statement);
    }
    if (this.current && statement instanceof MappingDeleteNode
      && statement.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), statement),
        createDefaultValueExpression(this.current.valueType, statement.location),
      ), statement);
    }
    if (this.current && statement instanceof ArrayDeleteNode
      && statement.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), statement),
        createDefaultValueExpression(this.current.valueType, statement.location),
      ), statement);
    }
    if (statement instanceof BranchNode) {
      statement.condition = this.rewriteExpression(statement.condition);
      statement.ifBlock = this.rewriteBlock(statement.ifBlock);
      if (statement.elseBlock) statement.elseBlock = this.rewriteBlock(statement.elseBlock);
      return statement;
    }
    // Use the ordinary visitor for expression-bearing statement shapes. The
    // dedicated mapping/call cases above are the only statement replacements.
    return this.visit(statement) as StatementNode;
  }

  visitMappingAccess(node: MappingAccessNode): Node {
    const multi = this.multiEntry(node.name, node.keys);
    if (multi) return this.at(new IdentifierNode(multi.journalName), node);
    if (this.current && node.name === this.current.collection) {
      return this.at(new IdentifierNode(this.current.journalName), node);
    }
    return super.visitMappingAccess(node);
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    if (this.currentMulti) {
      const flattened = this.flattenArrayAccess(node);
      const multi = flattened && this.multiEntry(flattened.collection, flattened.keys);
      if (multi) return this.at(new IdentifierNode(multi.journalName), node);
    }
    if (this.current && node.array instanceof IdentifierNode
      && node.array.name === this.current.collection) {
      return this.at(new IdentifierNode(this.current.journalName), node);
    }
    return super.visitArrayAccess(node);
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    const multiTarget = this.multiCandidates.get(`${node.call.identifier.name}/${node.call.parameters.length}`);
    if (multiTarget) {
      // A multi-journal invocation lowers to one tuple-capture statement, so
      // generic traversal through nested loop/switch wrappers can replace it
      // directly even when rewriteBlock did not own the immediate statement
      // list.
      return this.rewriteMultiCall(node.call, multiTarget)[0];
    }
    const target = this.candidates.get(`${node.call.identifier.name}/${node.call.parameters.length}`);
    return target ? this.rewriteCall(node.call, target) : super.visitFunctionCallStatement(node);
  }

  visitMappingAssign(node: MappingAssignNode): Node {
    const multi = this.multiEntry(node.name, node.keys);
    if (multi) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(multi.journalName), node),
        this.rewriteExpression(node.expression),
      ), node);
    }
    if (this.current && node.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node),
        this.rewriteExpression(node.expression),
      ), node);
    }
    return super.visitMappingAssign(node);
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    const multi = this.multiEntry(node.name, [node.index]);
    if (multi) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(multi.journalName), node),
        this.rewriteExpression(node.value),
      ), node);
    }
    if (this.current && node.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node),
        this.rewriteExpression(node.value),
      ), node);
    }
    return super.visitArrayAssign(node);
  }

  visitMappingDelete(node: MappingDeleteNode): Node {
    const multi = this.multiEntry(node.name, node.keys);
    if (multi) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(multi.journalName), node),
        createDefaultValueExpression(multi.valueType, node.location),
      ), node);
    }
    if (this.current && node.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node),
        createDefaultValueExpression(this.current.valueType, node.location),
      ), node);
    }
    return super.visitMappingDelete(node);
  }

  visitArrayDelete(node: ArrayDeleteNode): Node {
    const multi = this.multiEntry(node.name, [node.index]);
    if (multi) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(multi.journalName), node),
        createDefaultValueExpression(multi.valueType, node.location),
      ), node);
    }
    if (this.current && node.name === this.current.collection) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node),
        createDefaultValueExpression(this.current.valueType, node.location),
      ), node);
    }
    return super.visitArrayDelete(node);
  }

  private rewriteExpression(expression: ExpressionNode): ExpressionNode {
    return this.visit(expression) as ExpressionNode;
  }

  private rewriteCall(call: FunctionCallNode, target: Candidate): StatementNode {
    const args = call.parameters.map((argument) => cloneNode(argument) as ExpressionNode);
    const keyArgs = target.keyParameters.map((name) => {
      const index = target.fn.parameters.findIndex((parameter) => parameter.name === name);
      return cloneNode(call.parameters[index]) as ExpressionNode;
    });
    const insideSameEntry = this.current?.collection === target.collection
      && this.current.keyParameters.length === target.keyParameters.length
      && keyArgs.every((argument, i) =>
        argument instanceof IdentifierNode && argument.name === this.current!.keyParameters[i]);
    const read = insideSameEntry
      ? this.at(new IdentifierNode(this.current!.journalName), call)
      : this.at(new MappingAccessNode(target.collection, keyArgs.map((key) =>
        cloneNode(key) as ExpressionNode)), call);
    const invoked = this.at(new FunctionCallNode(
      this.at(new IdentifierNode(call.identifier.name), call), [read, ...args],
    ), call);
    if (insideSameEntry) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current!.journalName), call), invoked,
      ), call);
    }
    return this.at(new MappingAssignNode(target.collection, keyArgs, invoked), call);
  }

  private rewriteMultiCall(call: FunctionCallNode, target: MultiCandidate): StatementNode[] {
    const cache = this.activeMultiCaches.get(`${target.fn.name}/${target.fn.parameters.length}`);
    if (!cache) {
      throw new Error(`Missing function-scoped collection journal for '${target.fn.name}'`);
    }
    const callLocals = cache.calls.get(call);
    if (!callLocals) throw new Error(`Missing call-scoped collection journal for '${target.fn.name}'`);
    const originalArgs = call.parameters.map((argument) => cloneNode(argument) as ExpressionNode);
    const invoked = this.at(new FunctionCallNode(
      this.at(new IdentifierNode(call.identifier.name), call),
      [
        ...callLocals.map(({ name }) => this.at(new IdentifierNode(name), call)),
        ...originalArgs,
      ],
    ), call);
    // A pooled handler that touches one entry still returns a single value, not a one-element tuple.
    if (callLocals.length === 1) {
      return [this.at(new AssignNode(
        this.at(new IdentifierNode(callLocals[0].name), call), invoked,
      ), call)];
    }
    const capture = this.at(new TupleAssignmentNode(
      callLocals.map(({ entry, name }) => ({
        name, type: entry.valueType, existing: true,
      })),
      invoked,
      true,
    ), call);
    return [capture];
  }

  private prepareMultiCaches(
    body: BlockNode,
    wrapperParameters: Set<string>,
  ): Map<string, ActiveMultiCache> {
    const caches = new Map<string, ActiveMultiCache>();
    // One physical entry gets one pending journal value per wrapper, however many different handlers touch it.
    // Keeping a pool per callee was enough while a route admitted a single handler; with several handlers over
    // one collection it allocated a separate cache local - and therefore a separate C2 slot - per handler for
    // the same entry, which the SDK reports as a duplicate upsert slot.
    const sharedLocals: ActiveMultiCache['locals'] = [];
    const calls: FunctionCallStatementNode[] = [];
    this.walk(body, (node) => {
      if (node instanceof FunctionCallStatementNode) calls.push(node);
    });
    for (const statement of calls) {
      if (!(statement instanceof FunctionCallStatementNode)) continue;
      const candidateKey = `${statement.call.identifier.name}/${statement.call.parameters.length}`;
      const target = this.multiCandidates.get(candidateKey);
      if (!target) continue;
      const keysFor = (entry: JournalEntry): ExpressionNode[] => entry.keyParameters.map((name) => {
        const parameterIndex = target.fn.parameters.findIndex((parameter) => parameter.name === name);
        return cloneNode(statement.call.parameters[parameterIndex]) as ExpressionNode;
      });
      const identitiesFor = (keys: ExpressionNode[]): string[] => keys.map((key) => {
        const identity = this.canonicalCacheKey(key, wrapperParameters);
        if (identity === undefined) {
          throw new Error(
            `Collection journal helper '${target.fn.name}' requires a stable key expression; `
            + 'use a wrapper parameter, literal, or transaction global',
          );
        }
        return identity;
      });
      const cache = caches.get(candidateKey) ?? {
        target,
        locals: sharedLocals,
        calls: new WeakMap(),
      };
      if (!caches.has(candidateKey)) caches.set(candidateKey, cache);
      const callLocals = target.entries.map((entry) => {
        const keys = keysFor(entry);
        const keyIdentity = identitiesFor(keys);
        const prior = cache.locals.find((local) =>
          local.entry.collection === entry.collection
          && local.keyIdentity.length === keyIdentity.length
          && local.keyIdentity.every((candidate, keyIndex) =>
            candidate === keyIdentity[keyIndex]));
        if (prior) return prior;
        const local = {
          entry,
          // Pool-scoped, not callee-scoped: the name identifies the entry inside this wrapper.
          name: `__cj_cache_${sharedLocals.length}`,
          keys,
          keyIdentity,
        };
        cache.locals.push(local);
        return local;
      });
      cache.calls.set(statement.call, callLocals);
    }
    return caches;
  }

  /**
   * Match the storage layer's identity for the call-site forms Release 3
   * supports. Wrapper parameters remain symbolic; literals use their parsed
   * value; nullary transaction/message globals use their operator. More
   * complex expressions are rejected instead of being assigned a weaker
   * identity which could create two stale locals for one physical entry.
   */
  private canonicalCacheKey(
    key: ExpressionNode,
    wrapperParameters: Set<string>,
  ): string | undefined {
    if (key instanceof IdentifierNode && wrapperParameters.has(key.name)) {
      return `parameter:${key.name}`;
    }
    if (key instanceof LiteralNode) {
      return `literal:${key.constructor.name}:${key.toString()}`;
    }
    if (key instanceof NullaryOpNode) return `nullary:${key.operator}`;
    return undefined;
  }

  private installMultiCaches(body: BlockNode): void {
    // Every cache shares one locals pool, so collapse to the distinct locals before emitting reads/write-backs.
    const pooled = [...new Set([...this.activeMultiCaches.values()].flatMap((cache) => cache.locals))];
    const caches = [{ locals: pooled }];
    const declarations = caches.flatMap((cache) => cache.locals.map(({ entry, name, keys }) =>
      this.at(new VariableDefinitionNode(
        entry.valueType, [], name,
        this.at(new MappingAccessNode(entry.collection, keys.map((key) =>
          cloneNode(key) as ExpressionNode)), body),
      ), body)));
    const writes = caches.flatMap((cache) => cache.locals.map(({ entry, name, keys }) =>
      this.at(new MappingAssignNode(
        entry.collection,
        keys.map((key) => cloneNode(key) as ExpressionNode),
        this.at(new IdentifierNode(name), body),
      ), body)));
    const statements = body.statements ?? [];
    // The write-backs must be the wrapper's last effect. A tail `return` (admitted by visitContract only when
    // it is the wrapper's single, final statement) and the final `require` guard are both re-appended after
    // them, so nothing leaves the wrapper before its pending entry values reach state.
    const tail: StatementNode[] = [];
    if (statements.length > 0 && statements[statements.length - 1] instanceof ReturnNode) {
      tail.unshift(statements.pop()!);
    }
    if (statements.length > 0 && statements[statements.length - 1] instanceof RequireNode) {
      tail.unshift(statements.pop()!);
    }
    body.statements = [...declarations, ...statements, ...writes, ...tail];
  }

  /** Does this subtree read or write an entry of one of the named collections, in either spelling? */
  private readsCollection(root: Node, collections: Set<string>): boolean {
    let touches = false;
    this.walk(root, (candidate) => {
      if ((candidate instanceof MappingAccessNode || candidate instanceof MappingAssignNode
        || candidate instanceof MappingDeleteNode) && collections.has(candidate.name)) touches = true;
      else if (candidate instanceof ArrayAccessNode && candidate.array instanceof IdentifierNode
        && collections.has(candidate.array.name)) touches = true;
      else if ((candidate instanceof ArrayAssignNode || candidate instanceof ArrayDeleteNode)
        && collections.has(candidate.name)) touches = true;
    });
    return touches;
  }

  private multiEntry(collection: string, keys: ExpressionNode[]): JournalEntry | undefined {
    if (!this.currentMulti) return undefined;
    return this.currentMulti.entries.find((entry) =>
      entry.collection === collection
      && entry.keyParameters.length === keys.length
      && keys.every((key, index) =>
        key instanceof IdentifierNode && key.name === entry.keyParameters[index]));
  }

  private flattenArrayAccess(node: ArrayAccessNode): {
    collection: string;
    keys: ExpressionNode[];
  } | undefined {
    const keys: ExpressionNode[] = [node.index];
    let base: ExpressionNode = node.array;
    while (base instanceof ArrayAccessNode) {
      keys.unshift(base.index);
      base = base.array;
    }
    return base instanceof IdentifierNode ? { collection: base.name, keys } : undefined;
  }

  private invalidateSemanticMetadata(root: Node): void {
    const seen = new Set<Node>();
    const walk = (node: Node): void => {
      if (seen.has(node)) return;
      seen.add(node);
      (node as Node & { symbolTable?: unknown }).symbolTable = undefined;
      if (node instanceof IdentifierNode) {
        node.definition = undefined;
        node.functionReference = undefined;
      }
      if (node instanceof FunctionCallNode) node.resolvedFunction = undefined;
      for (const [key, child] of Object.entries(node)) {
        if (['resolvedFunction', 'functionReference', 'definition', 'collection',
          'symbolTable', 'stateVariable'].includes(key)) continue;
        if (child instanceof Node) walk(child);
        else if (Array.isArray(child)) {
          for (const item of child) if (item instanceof Node) walk(item);
        }
      }
    };
    walk(root);
  }

  /**
   * Does `root` reach a collection entry, directly or through an intra-contract call?
   *
   * Returns the name of the first function whose own body touches a collection. Calls that resolve to no
   * contract function and to no local binding are builtins, casts, free functions and external-contract
   * calls; none of them can touch THIS contract's collections, so they are ignored.
   *
   * A call through a name bound inside the function - or an `IndirectCallNode` - is a function-pointer
   * dispatch whose target is not named at the callsite. Rejecting those outright fails closed on shapes that
   * compile today: a local or parameter pointer assigned a known handler is analysable, and two such contracts
   * were measured compiling before this reach existed. The target set is over-approximated instead, to every
   * contract function whose NAME is taken somewhere in the contract without being called - the only way a
   * pointer to an intra-contract function can be produced. A foreign pointer cannot reach these collections.
   */
  private callGraphReach(
    root: FunctionDefinitionNode,
    contract: ContractNode,
    touchesCollection: (fn: FunctionDefinitionNode) => boolean,
  ): { via?: string } {
    const functions = contract.functions;
    const byKey = new Map<string, FunctionDefinitionNode>();
    const byName = new Map<string, FunctionDefinitionNode[]>();
    for (const fn of functions) {
      byKey.set(`${fn.name}/${fn.parameters.length}`, fn);
      const overloads = byName.get(fn.name);
      if (overloads) overloads.push(fn);
      else byName.set(fn.name, [fn]);
    }
    // Inline state-variable initializers are lowered into the constructor, so its body must be scanned too.
    const addressTaken = this.addressTakenFunctions(
      [...functions.map((fn) => fn.body), contract.constructorDef?.body], byName,
    );
    const seen = new Set<FunctionDefinitionNode>();
    const queue: FunctionDefinitionNode[] = [root];
    while (queue.length > 0) {
      const fn = queue.shift()!;
      if (seen.has(fn) || !fn.body) continue;
      seen.add(fn);
      if (touchesCollection(fn)) return { via: fn.name };
      const bound = new Set(fn.parameters.map((parameter) => parameter.name));
      this.walk(fn.body, (child) => {
        if (child instanceof VariableDefinitionNode) bound.add(child.name);
      });
      this.walk(fn.body, (child) => {
        if (child instanceof IndirectCallNode) {
          queue.push(...addressTaken);
          return;
        }
        if (!(child instanceof FunctionCallNode)) return;
        const name = child.identifier.name;
        const exact = byKey.get(`${name}/${child.parameters.length}`);
        if (exact) queue.push(exact);
        else if (byName.has(name)) queue.push(...byName.get(name)!);
        else if (bound.has(name)) queue.push(...addressTaken);
      });
    }
    return {};
  }

  /** Contract functions whose name appears somewhere other than as a callsite's own callee identifier. */
  private addressTakenFunctions(
    bodies: Array<BlockNode | undefined>,
    byName: Map<string, FunctionDefinitionNode[]>,
  ): FunctionDefinitionNode[] {
    const callees = new Set<Node>();
    const referenced = new Set<string>();
    for (const body of bodies) {
      this.walk(body, (child) => {
        if (child instanceof FunctionCallNode) callees.add(child.identifier);
      });
    }
    for (const body of bodies) {
      this.walk(body, (child) => {
        if (child instanceof IdentifierNode && !callees.has(child) && byName.has(child.name)) {
          referenced.add(child.name);
        }
      });
    }
    return [...referenced].flatMap((name) => byName.get(name) ?? []);
  }

  private walk(value: unknown, visit: (node: Node) => void, seen = new Set<object>()): void {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    visit(value);
    for (const [key, child] of Object.entries(value)) {
      if (['resolvedFunction', 'definition', 'collection', 'stateVariable', 'symbolTable'].includes(key)) continue;
      if (child instanceof Node) this.walk(child, visit, seen);
      else if (Array.isArray(child)) for (const item of child) this.walk(item, visit, seen);
    }
  }

  private at<T extends Node>(node: T, source: Node): T {
    node.location = source.location;
    return node;
  }
}
