import {
  AssignNode,
  BlockNode,
  ContractNode,
  DeleteStateNode,
  ExpressionNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  FunctionDefinitionNode,
  FunctionModifier,
  IdentifierNode,
  Node,
  ParameterNode,
  ReturnNode,
  SourceFileNode,
  StateAccessNode,
  StateAssignNode,
  StatementNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import { BytesType, PrimitiveType, Type } from '@solidcash/utils';

interface Candidate {
  fn: FunctionDefinitionNode;
  state: string;
  journalName: string;
  valueType: Type;
}

/** Value-thread unbounded bytes/string state through reusable handlers.
 *
 * Dynamic storage remains entirely owned by the established physical wrapper:
 * it authenticates the current chunks and flushes the final replacement once.
 * The handler sees only a normal bytes/string value, so it can safely cross an
 * OP_INVOKE boundary and preserve ordered replacement/append/delete semantics.
 */
export default class LowerDynamicStateJournalHelpers extends AstTraversal {
  private candidates = new Map<string, Candidate>();
  private current?: Candidate;

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const dynamics = new Map(node.stateVariables.filter((state) =>
      state.isDynamic || state.type === PrimitiveType.STRING
      || (state.type instanceof BytesType && state.type.bound === undefined))
      .map((state) => [state.name, state]));
    for (const fn of node.functions) {
      if (!fn.body || fn.returnTypes.length !== 0
        || !(fn.modifiers.includes(FunctionModifier.INTERNAL)
          || fn.modifiers.includes(FunctionModifier.PRIVATE))) continue;
      const names = new Set<string>();
      let writes = false;
      let unsupported = false;
      this.walk(fn.body, (candidate) => {
        if (candidate instanceof FunctionCallNode && candidate.identifier.name === fn.name) unsupported = true;
        if (candidate instanceof StateAccessNode && dynamics.has(candidate.name)) names.add(candidate.name);
        if ((candidate instanceof StateAssignNode || candidate instanceof DeleteStateNode)
          && dynamics.has(candidate.name)) {
          names.add(candidate.name);
          writes = true;
        }
      });
      if (unsupported || !writes || names.size !== 1) continue;
      const state = dynamics.get([...names][0])!;
      this.candidates.set(`${fn.name}/${fn.parameters.length}`, {
        fn,
        state: state.name,
        journalName: `__dj_${fn.name}`,
        valueType: state.type,
      });
    }

    for (const fn of node.functions) {
      if (!fn.body) continue;
      this.current = this.candidates.get(`${fn.name}/${fn.parameters.length}`);
      fn.body = this.visit(fn.body) as BlockNode;
    }
    this.current = undefined;

    for (const candidate of this.candidates.values()) {
      candidate.fn.parameters.unshift(this.at(
        new ParameterNode(candidate.valueType, candidate.journalName), candidate.fn,
      ));
      candidate.fn.returnTypes = [candidate.valueType];
      const body = candidate.fn.body!;
      body.statements ??= [];
      body.statements.push(this.at(new ReturnNode([
        this.at(new IdentifierNode(candidate.journalName), candidate.fn),
      ]), candidate.fn));
      candidate.fn.collectionJournal = true;
    }
    return node;
  }

  visitStateAccess(node: StateAccessNode): Node {
    if (this.current?.state === node.name) return this.at(new IdentifierNode(this.current.journalName), node);
    return super.visitStateAccess(node);
  }

  visitStateAssign(node: StateAssignNode): Node {
    if (this.current?.state === node.name) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node),
        this.visit(node.expression) as ExpressionNode,
      ), node);
    }
    return super.visitStateAssign(node);
  }

  visitDeleteState(node: DeleteStateNode): Node {
    if (this.current?.state === node.name) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node),
        createDefaultValueExpression(this.current.valueType, node.location),
      ), node);
    }
    return super.visitDeleteState(node);
  }

  visitFunctionCallStatement(node: FunctionCallStatementNode): Node {
    const target = this.candidates.get(`${node.call.identifier.name}/${node.call.parameters.length}`);
    if (!target) return super.visitFunctionCallStatement(node);
    const read = this.current?.state === target.state
      ? this.at(new IdentifierNode(this.current.journalName), node.call)
      : this.at(new StateAccessNode(target.state), node.call);
    const invoked = this.at(new FunctionCallNode(
      this.at(new IdentifierNode(node.call.identifier.name), node.call),
      [read, ...node.call.parameters.map((arg) => cloneNode(arg) as ExpressionNode)],
    ), node.call);
    if (this.current?.state === target.state) {
      return this.at(new AssignNode(
        this.at(new IdentifierNode(this.current.journalName), node.call), invoked,
      ), node.call);
    }
    return this.at(new StateAssignNode(target.state, invoked), node.call);
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
