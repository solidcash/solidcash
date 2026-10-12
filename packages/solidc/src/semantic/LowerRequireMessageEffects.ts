import {
  ArrayType, BytesType, PrimitiveType, StructType, type Type,
} from '@solidcash/utils';
import {
  AddressSendExpressionNode,
  AssignmentExpressionNode,
  BlockNode,
  BoolLiteralNode,
  ErrorDefinitionNode,
  ExpressionNode,
  ExternalFunctionCallNode,
  FunctionCallNode,
  FunctionCallStatementNode,
  FunctionModifier,
  IdentifierNode,
  IndirectCallNode,
  InstantiationNode,
  LowLevelCallNode,
  MethodCallNode,
  MethodCallStatementNode,
  Node,
  RequireNode,
  SourceFileNode,
  StatementNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { Modifier } from '../ast/Globals.js';

// Members whose call writes its receiver or moves value, whatever the program declares.
const WRITING_MEMBERS = new Set(['push', 'pop', 'transfer', 'send', 'call', 'delegatecall']);
// Fields linking to other parts of the graph rather than holding a child.
const LINKS = new Set([
  'location', 'type', 'definition', 'symbolTable', 'resolvedFunction', 'functionReference', 'referencedContract',
  'errorDefinition', 'namedOverloadCandidates',
]);

const bareName = (name: string): string => name.slice(name.lastIndexOf('.') + 1);

/**
 * Whether evaluating `node` may write state: an assignment, a deployment, a value transfer, an external, low-level
 * or indirect call, or a call to a function named in `writers` (declared neither pure nor view). Without
 * `writers`, any call counts.
 */
export function mayWriteState(node: Node, writers?: ReadonlySet<string>): boolean {
  if (node instanceof StatementNode || node instanceof AssignmentExpressionNode || node instanceof InstantiationNode
    || node instanceof AddressSendExpressionNode || node instanceof LowLevelCallNode
    || node instanceof IndirectCallNode || node instanceof ExternalFunctionCallNode) return true;
  if (node instanceof FunctionCallNode && (writers === undefined || node.callOptions !== undefined
    || writers.has(bareName(node.identifier.name)))) return true;
  if (node instanceof MethodCallNode && (writers === undefined || node.callOptions !== undefined
    || WRITING_MEMBERS.has(node.methodName) || writers.has(node.methodName))) return true;
  for (const [key, value] of Object.entries(node)) {
    if (LINKS.has(key)) continue;
    if (value instanceof Node && mayWriteState(value, writers)) return true;
    if (Array.isArray(value) && value.some((item) => item instanceof Node && mayWriteState(item, writers))) return true;
  }
  return false;
}

/**
 * solc evaluates a require's custom-error arguments, or its dynamic string message, after the condition and whether
 * or not the condition holds. BCH has no revert data, so codegen never evaluates them. Hoist those that may write
 * state into statements before the require, after the condition, so their writes persist when it holds. A require
 * whose message cannot write state is left as it is. Runs on the resolved program, before any lowering.
 */
export default function lowerRequireMessageEffects(ast: SourceFileNode): void {
  new RequireMessageEffects(ast).walk(ast);
}

class RequireMessageEffects {
  private readonly seen = new WeakSet<object>();
  private readonly lowered = new WeakMap<RequireNode, StatementNode[]>();
  private writerNames?: Set<string>;
  private errors?: ErrorDefinitionNode[];
  private index = 0;

  constructor(private readonly ast: SourceFileNode) {}

  // Statement lists are rewritten in place. Expressions hold no user-written require.
  walk(node: Node): void {
    if (node instanceof ExpressionNode || this.seen.has(node)) return;
    this.seen.add(node);
    const fields = node as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(node)) {
      if (LINKS.has(key)) continue;
      if (Array.isArray(value)) {
        if (this.seen.has(value)) continue;
        this.seen.add(value);
        if (value.some((item) => item instanceof RequireNode)) {
          const statements = value.flatMap((item) => (item instanceof RequireNode ? this.lower(item) : [item]));
          if (statements.length !== value.length) value.splice(0, value.length, ...statements);
        }
        for (const item of value) if (item instanceof Node) this.walk(item);
      } else if (value instanceof RequireNode) {
        const statements = this.lower(value);
        if (statements.length > 1) fields[key] = this.at(new BlockNode(statements), value);
      } else if (value instanceof Node) {
        this.walk(value);
      }
    }
  }

  private lower(require: RequireNode): StatementNode[] {
    const done = this.lowered.get(require);
    if (done !== undefined) return done;
    const effects = this.effects(require);
    require.messageExpression = undefined;
    const statements: StatementNode[] = [];
    // The condition runs first; a literal one reads nothing an effect could change.
    if (effects.length > 0 && !(require.expression instanceof BoolLiteralNode)) {
      require.expression = this.hoist(require.expression, PrimitiveType.BOOL, statements);
    }
    statements.push(...effects, require);
    this.lowered.set(require, statements);
    return statements;
  }

  // Statements evaluating the message's writes, in source order. The message is rewritten to read their results.
  private effects(require: RequireNode): StatementNode[] {
    const effects: StatementNode[] = [];
    const { errorName, messageExpression } = require;
    if (errorName !== undefined && this.isError(errorName)) {
      const error = this.error(errorName, require.args.length);
      if (error === undefined || !require.args.some((arg) => this.writes(arg))) return effects;
      require.args = require.args.map((arg, i) => (this.writes(arg)
        ? this.hoist(arg, error.parameters[i].type, effects) : arg));
    } else if (errorName !== undefined) {
      // A call-form string message `f(args)`: the symbol table drops it, so the whole call runs here.
      const call = this.at(new FunctionCallNode(this.at(new IdentifierNode(errorName), require), require.args), require);
      if (!this.writes(call)) return effects;
      effects.push(this.at(new FunctionCallStatementNode(call), require));
      require.errorName = undefined;
      require.args = [];
    } else if (messageExpression !== undefined && this.writes(messageExpression)) {
      effects.push(...this.messageEffects(messageExpression));
    }
    return effects;
  }

  // A dynamic message: a call runs as its own statement, and a qualified error evaluates its writing arguments.
  private messageEffects(message: ExpressionNode): StatementNode[] {
    const effects: StatementNode[] = [];
    const callee = message instanceof FunctionCallNode ? message.identifier.name
      : message instanceof MethodCallNode ? message.methodName : undefined;
    if ((message instanceof FunctionCallNode || message instanceof MethodCallNode)
      && callee !== undefined && this.isError(callee)) {
      const error = this.error(callee, message.parameters.length);
      message.parameters.forEach((arg, i) => {
        if (error !== undefined && this.writes(arg)) this.hoist(arg, error.parameters[i].type, effects);
      });
    } else if (message instanceof FunctionCallNode) {
      effects.push(this.at(new FunctionCallStatementNode(message), message));
    } else if (message instanceof MethodCallNode) {
      effects.push(this.at(new MethodCallStatementNode(message), message));
    } else {
      this.hoist(message, PrimitiveType.STRING, effects);
    }
    return effects;
  }

  private hoist(expression: ExpressionNode, type: Type, into: StatementNode[]): IdentifierNode {
    const name = `__require_effect_${this.index++}`;
    const reference = type instanceof ArrayType || type instanceof StructType
      || (type instanceof BytesType && type.bound === undefined) || type === PrimitiveType.STRING;
    const definition = this.at(
      new VariableDefinitionNode(type, reference ? [Modifier.MEMORY] : [], name, expression), expression,
    );
    definition.allowUnused = true;
    into.push(definition);
    return this.at(new IdentifierNode(name), expression);
  }

  private writes(expression: ExpressionNode): boolean {
    return mayWriteState(expression) && mayWriteState(expression, this.writers());
  }

  private writers(): Set<string> {
    if (this.writerNames === undefined) {
      const names = new Set<string>();
      const contracts = [this.ast.contract, this.ast.libraryContract, ...this.ast.importedContracts];
      for (const fn of [...this.ast.freeFunctions, ...contracts.flatMap((contract) => contract?.functions ?? [])]) {
        if (!fn.modifiers.includes(FunctionModifier.PURE) && !fn.modifiers.includes(FunctionModifier.VIEW)) {
          names.add(bareName(fn.name));
        }
      }
      for (const fn of this.ast.interfaceDefinitions.flatMap((definition) => definition.functions)) {
        if (fn.stateMutability !== 'pure' && fn.stateMutability !== 'view') names.add(bareName(fn.name));
      }
      this.writerNames = names;
    }
    return this.writerNames;
  }

  private errorList(): ErrorDefinitionNode[] {
    this.errors ??= [
      ...this.ast.errorDefinitions,
      ...this.ast.libraryErrorDefinitions,
      ...[this.ast.contract, this.ast.libraryContract, ...this.ast.importedContracts]
        .flatMap((contract) => contract?.errorDefinitions ?? []),
      ...this.ast.interfaceDefinitions.flatMap((definition) => definition.errorDefinitions),
    ];
    return this.errors;
  }

  private isError(name: string): boolean {
    return this.errorList().some((error) => bareName(error.name) === bareName(name));
  }

  private error(name: string, arity: number): ErrorDefinitionNode | undefined {
    return this.errorList().find((error) => bareName(error.name) === bareName(name)
      && error.parameters.length === arity);
  }

  private at<T extends Node>(node: T, origin: Node): T {
    node.location = origin.location;
    return node;
  }
}
