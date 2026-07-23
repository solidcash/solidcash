import {
  BlockNode,
  BranchNode,
  AssignNode,
  ArrayAccessNode,
  ArrayAssignNode,
  ArrayDeleteNode,
  ContractNode,
  ExpressionNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  FunctionDefinitionNode,
  FunctionModifier,
  IdentifierNode,
  MappingAccessNode,
  MappingAssignNode,
  MappingDeleteNode,
  Node,
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

interface ActiveMultiCache {
  target: MultiCandidate;
  locals: Array<{
    entry: JournalEntry;
    name: string;
    keys: ExpressionNode[];
  }>;
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
    for (const fn of node.functions) {
      if (!fn.body || fn.returnTypes.length !== 0
        || !(fn.modifiers.includes(FunctionModifier.INTERNAL)
          || fn.modifiers.includes(FunctionModifier.PRIVATE))
        || fn.inheritedFrom || constructorCalls.has(fn.name)
        || (nameCounts.get(fn.name) ?? 0) > 1) continue;
      const accesses: Array<{
        name: string;
        keys: ExpressionNode[];
        node: MappingAccessNode | MappingAssignNode | MappingDeleteNode | ArrayAccessNode | ArrayAssignNode | ArrayDeleteNode;
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
      if (distinct.size > 1) {
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

    // Rewrite call sites before changing arities.
    for (const fn of node.functions) {
      if (!fn.body) continue;
      this.current = this.candidates.get(`${fn.name}/${fn.parameters.length}`);
      this.currentMulti = this.multiCandidates.get(`${fn.name}/${fn.parameters.length}`);
      this.activeMultiCaches = this.currentMulti ? new Map() : this.prepareMultiCaches(fn.body);
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
      // Expression visitors cannot splice statements into their parent. All
      // supported collection handlers are void call statements, so this path
      // is reached only by generic traversal of a shape already rewritten by
      // rewriteBlock.
      return node;
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
    const originalArgs = call.parameters.map((argument) => cloneNode(argument) as ExpressionNode);
    const invoked = this.at(new FunctionCallNode(
      this.at(new IdentifierNode(call.identifier.name), call),
      [
        ...cache.locals.map(({ name }) => this.at(new IdentifierNode(name), call)),
        ...originalArgs,
      ],
    ), call);
    const capture = this.at(new TupleAssignmentNode(
      cache.locals.map(({ entry, name }) => ({
        name, type: entry.valueType, existing: true,
      })),
      invoked,
      true,
    ), call);
    return [capture];
  }

  private prepareMultiCaches(body: BlockNode): Map<string, ActiveMultiCache> {
    const caches = new Map<string, ActiveMultiCache>();
    const calls: FunctionCallStatementNode[] = [];
    this.walk(body, (node) => {
      if (node instanceof FunctionCallStatementNode) calls.push(node);
    });
    for (const statement of calls) {
      if (!(statement instanceof FunctionCallStatementNode)) continue;
      const key = `${statement.call.identifier.name}/${statement.call.parameters.length}`;
      const target = this.multiCandidates.get(key);
      if (!target) continue;
      const existing = caches.get(key);
      const keysFor = (entry: JournalEntry): ExpressionNode[] => entry.keyParameters.map((name) => {
        const parameterIndex = target.fn.parameters.findIndex((parameter) => parameter.name === name);
        return cloneNode(statement.call.parameters[parameterIndex]) as ExpressionNode;
      });
      if (existing) {
        const nextKeys = target.entries.map(keysFor);
        if (!existing.locals.every((local, entryIndex) =>
          local.keys.every((prior, keyIndex) =>
            prior instanceof IdentifierNode && nextKeys[entryIndex][keyIndex] instanceof IdentifierNode
            && prior.name === (nextKeys[entryIndex][keyIndex] as IdentifierNode).name))) {
          throw new Error(
            `Collection journal '${target.fn.name}' is called with different entry keys in one wrapper`,
          );
        }
        continue;
      }
      caches.set(key, {
        target,
        locals: target.entries.map((entry, index) => ({
          entry,
          name: `__cj_cache_${target.fn.name}_${index}`,
          keys: keysFor(entry),
        })),
      });
    }
    return caches;
  }

  private installMultiCaches(body: BlockNode): void {
    const caches = [...this.activeMultiCaches.values()];
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
    const finalGuard = statements.length > 0 && statements[statements.length - 1] instanceof RequireNode
      ? statements.pop() : undefined;
    body.statements = [...declarations, ...statements, ...writes, ...(finalGuard ? [finalGuard] : [])];
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
