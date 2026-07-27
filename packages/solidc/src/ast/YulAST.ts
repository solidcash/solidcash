import { Location } from './Location.js';

// Standalone AST for Solidity inline assembly (Yul). Kept separate from the main AST/visitor system: the
// main passes treat AssemblyStatementNode as an opaque leaf, and only Yul-specific steps (diagnostics now,
// codegen later) walk this sub-tree. Mirrors solc libyul/AST.h.

export abstract class YulNode {
  location?: Location;
}

export class YulBlockNode extends YulNode {
  constructor(public statements: YulStatementNode[]) {
    super();
  }
}

export abstract class YulStatementNode extends YulNode {}

export class YulVariableDeclarationNode extends YulStatementNode {
  constructor(public names: string[], public value?: YulExpressionNode) {
    super();
  }
}

export class YulAssignmentNode extends YulStatementNode {
  constructor(public paths: YulPathNode[], public value: YulExpressionNode) {
    super();
  }
}

export class YulIfNode extends YulStatementNode {
  constructor(public condition: YulExpressionNode, public body: YulBlockNode) {
    super();
  }
}

export class YulSwitchNode extends YulStatementNode {
  constructor(
    public expression: YulExpressionNode,
    public cases: YulCaseNode[],
    public defaultBody?: YulBlockNode,
  ) {
    super();
  }
}

export class YulCaseNode extends YulNode {
  constructor(public value: YulLiteralNode, public body: YulBlockNode) {
    super();
  }
}

export class YulForLoopNode extends YulStatementNode {
  constructor(
    public pre: YulBlockNode,
    public condition: YulExpressionNode,
    public post: YulBlockNode,
    public body: YulBlockNode,
  ) {
    super();
  }
}

export class YulFunctionDefinitionNode extends YulStatementNode {
  constructor(
    public name: string,
    public params: string[],
    public returns: string[],
    public body: YulBlockNode,
  ) {
    super();
  }
}

export class YulBreakNode extends YulStatementNode {}
export class YulContinueNode extends YulStatementNode {}
export class YulLeaveNode extends YulStatementNode {}

export class YulExpressionStatementNode extends YulStatementNode {
  constructor(public expression: YulExpressionNode) {
    super();
  }
}

export abstract class YulExpressionNode extends YulNode {}

export class YulFunctionCallNode extends YulExpressionNode {
  constructor(public name: string, public args: YulExpressionNode[]) {
    super();
  }
}

// Identifier reference, with optional member chain (e.g. `x.slot` -> base 'x', members ['slot']).
export class YulPathNode extends YulExpressionNode {
  constructor(public base: string, public members: string[] = []) {
    super();
  }
}

export enum YulLiteralKind {
  NUMBER = 'number',
  HEX = 'hex',
  HEXSTRING = 'hexstring',
  STRING = 'string',
  BOOL = 'bool',
}

export class YulLiteralNode extends YulExpressionNode {
  constructor(public kind: YulLiteralKind, public raw: string) {
    super();
  }
}

// Yul keeps every EVM instruction name reserved, including instructions which are unavailable for the
// selected EVM version and stack-manipulation instructions which have no callable inline-assembly builtin.
// Object-format helpers are likewise unavailable as user identifiers inside Solidity inline assembly.
const RESERVED_IDENTIFIERS = new Set([
  'stop', 'add', 'mul', 'sub', 'div', 'sdiv', 'mod', 'smod', 'addmod', 'mulmod', 'exp', 'signextend',
  'lt', 'gt', 'slt', 'sgt', 'eq', 'iszero', 'and', 'or', 'xor', 'not', 'byte', 'shl', 'shr', 'sar', 'clz',
  'keccak256', 'sha3',
  'address', 'balance', 'origin', 'caller', 'callvalue', 'calldataload', 'calldatasize', 'calldatacopy',
  'codesize', 'codecopy', 'gasprice', 'extcodesize', 'extcodecopy', 'returndatasize', 'returndatacopy',
  'extcodehash', 'blockhash', 'coinbase', 'timestamp', 'number', 'difficulty', 'prevrandao', 'gaslimit',
  'chainid', 'selfbalance', 'basefee', 'blobhash', 'blobbasefee',
  'pop', 'mload', 'mstore', 'mstore8', 'sload', 'sstore', 'jump', 'jumpi', 'pc', 'msize', 'gas', 'jumpdest',
  'tload', 'tstore', 'mcopy', 'push0',
  'log0', 'log1', 'log2', 'log3', 'log4',
  'create', 'call', 'callcode', 'return', 'delegatecall', 'create2', 'staticcall', 'revert', 'invalid',
  'selfdestruct',
  'datasize', 'dataoffset', 'datacopy', 'setimmutable', 'loadimmutable', 'linkersymbol',
  ...Array.from({ length: 32 }, (_, i) => `push${i + 1}`),
  ...Array.from({ length: 16 }, (_, i) => `dup${i + 1}`),
  ...Array.from({ length: 16 }, (_, i) => `swap${i + 1}`),
]);

export function findReservedYulIdentifier(block: YulBlockNode): { name: string; node: YulNode } | undefined {
  const checkNames = (names: string[], node: YulNode): { name: string; node: YulNode } | undefined => {
    const name = names.find((candidate) => RESERVED_IDENTIFIERS.has(candidate));
    return name === undefined ? undefined : { name, node };
  };
  for (const statement of block.statements) {
    let found: { name: string; node: YulNode } | undefined;
    if (statement instanceof YulVariableDeclarationNode) {
      found = checkNames(statement.names, statement);
    } else if (statement instanceof YulFunctionDefinitionNode) {
      found = checkNames([statement.name, ...statement.params, ...statement.returns], statement)
        ?? findReservedYulIdentifier(statement.body);
    } else if (statement instanceof YulBlockNode) {
      found = findReservedYulIdentifier(statement);
    } else if (statement instanceof YulIfNode) {
      found = findReservedYulIdentifier(statement.body);
    } else if (statement instanceof YulSwitchNode) {
      for (const item of statement.cases) {
        found = findReservedYulIdentifier(item.body);
        if (found) break;
      }
      found ??= statement.defaultBody ? findReservedYulIdentifier(statement.defaultBody) : undefined;
    } else if (statement instanceof YulForLoopNode) {
      found = findReservedYulIdentifier(statement.pre)
        ?? findReservedYulIdentifier(statement.post)
        ?? findReservedYulIdentifier(statement.body);
    }
    if (found) return found;
  }
  return undefined;
}

export function findYulFunctionCall(
  block: YulBlockNode,
  names: ReadonlySet<string>,
): YulFunctionCallNode | undefined {
  const expressionCall = (expression: YulExpressionNode | undefined): YulFunctionCallNode | undefined => {
    if (!(expression instanceof YulFunctionCallNode)) return undefined;
    if (names.has(expression.name)) return expression;
    for (const arg of expression.args) {
      const found = expressionCall(arg);
      if (found) return found;
    }
    return undefined;
  };
  for (const statement of block.statements) {
    let found: YulFunctionCallNode | undefined;
    if (statement instanceof YulVariableDeclarationNode) found = expressionCall(statement.value);
    else if (statement instanceof YulAssignmentNode) found = expressionCall(statement.value);
    else if (statement instanceof YulExpressionStatementNode) found = expressionCall(statement.expression);
    else if (statement instanceof YulFunctionDefinitionNode) found = findYulFunctionCall(statement.body, names);
    else if (statement instanceof YulBlockNode) found = findYulFunctionCall(statement, names);
    else if (statement instanceof YulIfNode) {
      found = expressionCall(statement.condition) ?? findYulFunctionCall(statement.body, names);
    } else if (statement instanceof YulSwitchNode) {
      found = expressionCall(statement.expression);
      for (const item of statement.cases) found ??= findYulFunctionCall(item.body, names);
      found ??= statement.defaultBody ? findYulFunctionCall(statement.defaultBody, names) : undefined;
    } else if (statement instanceof YulForLoopNode) {
      found = findYulFunctionCall(statement.pre, names) ?? expressionCall(statement.condition)
        ?? findYulFunctionCall(statement.post, names) ?? findYulFunctionCall(statement.body, names);
    }
    if (found) return found;
  }
  return undefined;
}

// A block is native BCH-ASM (not Yul) when it is empty or every statement is a bare path/literal opcode
// (e.g. `OP_1 OP_ADD`). Any structural Yul (let/:=/call/control-flow) makes it Yul.
export function isBchAsmBlock(block: YulBlockNode): boolean {
  return block.statements.every(
    (s) => s instanceof YulExpressionStatementNode
      && (s.expression instanceof YulPathNode || s.expression instanceof YulLiteralNode),
  );
}
