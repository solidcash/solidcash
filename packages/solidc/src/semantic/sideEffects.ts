import {
  Node, ExpressionNode, SourceFileNode, FunctionDefinitionNode, FunctionModifier, UnaryOpNode,
  AssignmentExpressionNode, FunctionCallNode, MethodCallNode, ExternalFunctionCallNode, LowLevelCallNode,
  IndirectCallNode, InstantiationNode,
} from '../ast/AST.js';
import { Class } from '../ast/Globals.js';
import { UnaryOperator } from '../ast/Operator.js';

const INC_DEC = new Set<UnaryOperator>([
  UnaryOperator.PREFIX_INCREMENT, UnaryOperator.PREFIX_DECREMENT,
  UnaryOperator.POSTFIX_INCREMENT, UnaryOperator.POSTFIX_DECREMENT,
]);
const BUILTIN_CLASSES = new Set<string>(Object.values(Class));

/** Names of the source's functions that may change state: every function not declared pure or view. */
export function stateChangingFunctionNames(source: SourceFileNode): Set<string> {
  const names = new Set<string>();
  const add = (fn: FunctionDefinitionNode): void => {
    if (!fn.modifiers.includes(FunctionModifier.PURE) && !fn.modifiers.includes(FunctionModifier.VIEW)) {
      names.add(fn.name);
    }
  };
  for (const contract of [source.contract, ...(source.importedContracts ?? [])]) {
    for (const fn of contract?.functions ?? []) add(fn);
  }
  for (const fn of source.freeFunctions ?? []) add(fn);
  for (const iface of source.interfaceDefinitions ?? []) {
    for (const fn of iface.functions) {
      if (fn.stateMutability !== 'pure' && fn.stateMutability !== 'view') names.add(fn.name);
    }
  }
  return names;
}

/**
 * True when evaluating `expr` can change state: `++`/`--`, an assignment, a call `changesState` names, or an
 * external, low-level, indirect call or contract deployment. A builtin, cast or pure/view call is side-effect free.
 */
export function hasSideEffects(expr: Node, changesState: (name: string) => boolean): boolean {
  const callee = (name: string): boolean => changesState(name) || changesState(name.split('.').pop()!);
  const walk = (node: Node): boolean => {
    if (node instanceof AssignmentExpressionNode || node instanceof LowLevelCallNode
      || node instanceof ExternalFunctionCallNode || node instanceof IndirectCallNode
      || (node instanceof UnaryOpNode && INC_DEC.has(node.operator))
      || (node instanceof InstantiationNode && !BUILTIN_CLASSES.has(node.identifier.name))
      || (node instanceof FunctionCallNode && callee(node.identifier.name))
      || (node instanceof MethodCallNode && callee(node.methodName))) return true;
    return Object.values(node).some((value) => (value instanceof ExpressionNode ? walk(value)
      : Array.isArray(value) && value.some((item) => item instanceof ExpressionNode && walk(item))));
  };
  return walk(expr);
}
