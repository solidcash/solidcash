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
import { blockEndsWithReturn } from './EarlyReturnTransformation.js';
import { fallsOffEndCheck } from './EnsureFinalRequireTraversal.js';
import AstTraversal from '../ast/AstTraversal.js';
import { emitCompilerWarning } from '../warnings.js';

/**
 * Empty-body VOID function (e.g. `receive() external payable {}`, an empty payable `deposit()`, an empty internal
 * hook): Solidity accepts the call and does nothing. Synthesize `require(true);` so it compiles - a
 * state-preserving no-op spend path (with a warning). Constructors may stay empty (parent-only) and abstract
 * functions have no body, so both are excluded. (Default; was gated behind evmCompat, except empty
 * receive/fallback which were always synthesized.) Returns whether the body was synthesized.
 */
export function synthesizeEmptyVoidBody(node: FunctionDefinitionNode): boolean {
  if (!node.body || (node.body.statements?.length ?? 0) !== 0
    || node.returnTypes.length !== 0 || node.name === '__construct') {
    return false;
  }
  const isReceiveOrFallback = node.name === '__receive' || node.name === '__fallback';
  const label = isReceiveOrFallback ? (node.name === '__receive' ? 'receive()' : 'fallback()') : `${node.name}()`;
  emitCompilerWarning(`Warning: ${label} has an empty body; SolidCash synthesizes a state-preserving no-op spend `
    + 'path (require(true)). Add explicit logic if it should do more.');
  const cond = new BoolLiteralNode(true);
  cond.location = node.location;
  const req = new RequireNode(cond);
  req.location = node.location;
  node.body.statements = [req];
  return true;
}

/**
 * Apply only the empty-void-body step of the transformation, to the functions the transformation itself visits:
 * free functions and the contract's functions, receive() and fallback(). The compiler skips the whole
 * transformation when no function names its returns; this keeps an empty void function compiling in that case
 * while every other function keeps exactly the lowering it had.
 */
export function synthesizeEmptyVoidBodies(ast: SourceFileNode): void {
  const { contract } = ast;
  for (const fn of [...ast.freeFunctions, ...contract.functions, contract.fallbackDef, contract.receiveDef]) {
    if (fn) synthesizeEmptyVoidBody(fn);
  }
}

/** Append Solidity's fall-through `return <type defaults>;` to a function with unnamed return types. */
function appendFallThroughDefaultReturn(node: FunctionDefinitionNode): void {
  const stmts = node.body.statements ?? [];
  const ret = new ReturnNode(node.returnTypes.map((t) => createDefaultValueExpression(t, node.location)));
  ret.location = node.location;
  node.body.statements = [...stmts, ret];
}

/**
 * Apply only the fall-through default-return step of the transformation, and only to the functions that still
 * fall off their end: those EnsureFinalRequireTraversal would refuse (MissingReturnError, or EmptyFunctionError for
 * an empty body). The compiler skips the whole transformation when no function names its returns, and runs this
 * after DesugarNestedBranchReturn instead: that pass already gives a nested may-return function its terminal
 * return, and every function that returns or reverts on every path keeps exactly the lowering it had.
 */
export function synthesizeFallThroughDefaultReturns(ast: SourceFileNode): void {
  const { contract } = ast;
  const fallsOffEnd = fallsOffEndCheck(ast.freeFunctions);
  for (const fn of [...ast.freeFunctions, ...contract.functions, contract.fallbackDef, contract.receiveDef]) {
    if (!fn?.body || fn.isAbstract || fn.splitDelegateReturnForwarder) continue;
    if (fn.returnTypes.length === 0 || fn.returnNames.length > 0) continue;
    if (fallsOffEnd(fn)) appendFallThroughDefaultReturn(fn);
  }
}

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
    // Function with (unnamed) return types that does not already end in a return: return the type defaults on
    // fall-through (Solidity semantics; whether the body is empty or just assigns state). Synthesize a trailing
    // `return <defaults>;` so it compiles - matches the named-return handling below. (Default; was gated behind
    // evmCompat.)
    if (node.body && node.returnTypes.length > 0 && node.returnNames.length === 0) {
      // Only synthesize a fall-through default return when the body does NOT already return on every path. A
      // terminal if/else (or switch) whose branches all return needs no default - and the synthesized
      // `return <defaults>` would be dead code that still type-checks (createDefaultValueExpression yields int 0
      // for address/enum returns, mismatching the declared types). blockEndsWithReturn covers those shapes.
      if (!blockEndsWithReturn(node.body)) appendFallThroughDefaultReturn(node);
      return node;
    }

    if (synthesizeEmptyVoidBody(node)) return node;

    if (node.returnNames.length === 0 || !node.body) {
      return node;
    }

    // Prepend an uninitialized local for each named return. An uninitialized declaration zero-inits via the
    // same path as `delete`, which is correct for EVERY type - including address/pubkey/sig/datasig, which have
    // no int-0 default (createDefaultValueExpression falls through to `0` for them, tripping AssignTypeError).
    // An assigned named return overwrites this; an unassigned one returns the type's zero.
    const defaults = node.returnNames.map((name, i) => {
      const def = new VariableDefinitionNode(node.returnTypes[i], [], name);
      def.location = node.location;
      def.allowUnused = true;
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
