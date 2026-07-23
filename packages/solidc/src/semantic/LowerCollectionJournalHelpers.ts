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
  ReturnNode,
  SourceFileNode,
  StatementNode,
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
  private current?: Candidate;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const collections = new Map(node.collections.map((collection) => [collection.name, collection]));
    for (const fn of node.functions) {
      if (!fn.body || fn.returnTypes.length !== 0
        || !(fn.modifiers.includes(FunctionModifier.INTERNAL)
          || fn.modifiers.includes(FunctionModifier.PRIVATE))) continue;
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
      const names = new Set(accesses.map((access) => access.name));
      if (names.size !== 1) continue;
      const collection = collections.get(accesses[0].name);
      if (!collection || collection.innermostValueType.toString().endsWith('[]')) continue;
      const parameterNames = new Set(fn.parameters.map((parameter) => parameter.name));
      const canonicalKeys = accesses[0].keys.map((key) =>
        key instanceof IdentifierNode && parameterNames.has(key.name) ? key.name : undefined);
      if (canonicalKeys.some((key) => key === undefined)) continue;
      if (accesses.some((access) => access.keys.length !== canonicalKeys.length
        || access.keys.some((key, i) => !(key instanceof IdentifierNode) || key.name !== canonicalKeys[i]))) continue;
      const journalName = `__cj_${fn.name}`;
      this.candidates.set(`${fn.name}/${fn.parameters.length}`, {
        fn, collection: accesses[0].name, keyParameters: canonicalKeys as string[], journalName,
        valueType: collection.innermostValueType,
      });
    }

    // Rewrite call sites before changing arities.
    for (const fn of node.functions) {
      if (!fn.body) continue;
      this.current = this.candidates.get(`${fn.name}/${fn.parameters.length}`);
      fn.body = this.rewriteBlock(fn.body);
    }
    this.current = undefined;

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
    return node;
  }

  private rewriteBlock(block: BlockNode): BlockNode {
    block.statements = (block.statements ?? []).map((statement) => this.rewriteStatement(statement));
    return block;
  }

  private rewriteStatement(statement: StatementNode): StatementNode {
    if (statement instanceof FunctionCallStatementNode) {
      const key = `${statement.call.identifier.name}/${statement.call.parameters.length}`;
      const target = this.candidates.get(key);
      if (target) return this.rewriteCall(statement.call, target);
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
    if (this.current && node.name === this.current.collection) {
      return this.at(new IdentifierNode(this.current.journalName), node);
    }
    return super.visitMappingAccess(node);
  }

  visitArrayAccess(node: ArrayAccessNode): Node {
    if (this.current && node.array instanceof IdentifierNode
      && node.array.name === this.current.collection) {
      return this.at(new IdentifierNode(this.current.journalName), node);
    }
    return super.visitArrayAccess(node);
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
