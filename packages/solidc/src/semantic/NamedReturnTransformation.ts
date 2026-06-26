import {
  FunctionDefinitionNode,
  ReturnNode,
  BlockNode,
  Node,
  ContractNode,
  ParameterNode,
  SourceFileNode,
  VariableDefinitionNode,
  IdentifierNode,
  RequireNode,
  BoolLiteralNode,
} from '../ast/AST.js';
import { createDefaultValueExpression } from '../ast/defaults.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Desugars named return values into ordinary locals + explicit returns. For:
 *
 * ```
 * function f() returns (int sum) { sum = a + b; return; }
 * ```
 * the named returns become default-initialized locals at the top of the body, and every bare
 * `return;` is rewritten to `return <names>;`:
 * ```
 * function f() returns (int) { int sum = 0; sum = a + b; return sum; }
 * ```
 *
 * Runs before semantic analysis so the synthesised declarations and identifier references resolve
 * normally. Reuses the existing variable/return machinery (no codegen changes).
 */
export default class NamedReturnTransformation extends AstTraversal {
  private currentReturnNames: string[] = [];

  constructor(private solidityImportCompat: boolean = false) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    for (let i = 0; i < node.freeFunctions.length; i++) {
      node.freeFunctions[i] = this.visit(node.freeFunctions[i]) as FunctionDefinitionNode;
    }
    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    // receive()/fallback() are stored separately (__receive/__fallback); visit them so an empty body is
    // synthesized like any other void function.
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    // Empty-body function with (unnamed) return types: Solidity returns the type defaults. Synthesize
    // `return <defaults>;` so it compiles. Porting mode only - native keeps EmptyFunctionError as a guard.
    if (this.solidityImportCompat && node.body && (node.body.statements?.length ?? 0) === 0
      && node.returnTypes.length > 0 && node.returnNames.length === 0) {
      const ret = new ReturnNode(node.returnTypes.map((t) => createDefaultValueExpression(t, node.location)));
      ret.location = node.location;
      node.body.statements = [ret];
      return node;
    }

    // Empty-body VOID function (e.g. `receive() external payable {}`, an empty payable `deposit()`): Solidity
    // accepts the call and does nothing. Synthesize `require(true);` so it compiles - a state-preserving no-op
    // spend path. Porting mode only - native keeps EmptyFunctionError as a guard. Constructors may stay empty
    // (parent-only) and abstract functions have no body, so both are excluded.
    if (this.solidityImportCompat && node.body && (node.body.statements?.length ?? 0) === 0
      && node.returnTypes.length === 0 && node.name !== '__construct') {
      const cond = new BoolLiteralNode(true);
      cond.location = node.location;
      const req = new RequireNode(cond);
      req.location = node.location;
      node.body.statements = [req];
      return node;
    }

    if (node.returnNames.length === 0 || !node.body) {
      return node;
    }

    // Prepend a default-initialized local for each named return.
    const defaults = node.returnNames.map((name, i) => {
      const def = new VariableDefinitionNode(
        node.returnTypes[i], [], name, createDefaultValueExpression(node.returnTypes[i], node.location),
      );
      def.location = node.location;
      return def;
    });
    node.body.statements = [...defaults, ...(node.body.statements ?? [])];

    // Solidity returns the named values implicitly at the end of the function. If the body does not already
    // end in a return, append `return <names>;` so functions that just assign the named returns are valid.
    const stmts = node.body.statements;
    if (!(stmts[stmts.length - 1] instanceof ReturnNode)) {
      const implicitReturn = new ReturnNode(node.returnNames.map((name) => {
        const id = new IdentifierNode(name);
        id.location = node.location;
        return id;
      }));
      implicitReturn.location = node.location;
      stmts.push(implicitReturn);
    }

    const previous = this.currentReturnNames;
    this.currentReturnNames = node.returnNames;
    node.body = this.visit(node.body) as BlockNode;
    this.currentReturnNames = previous;
    return node;
  }

  visitReturn(node: ReturnNode): Node {
    // A bare `return;` returns the current values of the named returns.
    if (this.currentReturnNames.length > 0 && node.expressions.length === 0) {
      node.expressions = this.currentReturnNames.map((name) => {
        const id = new IdentifierNode(name);
        id.location = node.location;
        return id;
      });
    }
    return node;
  }
}
