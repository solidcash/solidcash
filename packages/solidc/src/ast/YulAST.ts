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

// A block is native BCH-ASM (not Yul) when it is empty or every statement is a bare path/literal opcode
// (e.g. `OP_1 OP_ADD`). Any structural Yul (let/:=/call/control-flow) makes it Yul.
export function isBchAsmBlock(block: YulBlockNode): boolean {
  return block.statements.every(
    (s) => s instanceof YulExpressionStatementNode
      && (s.expression instanceof YulPathNode || s.expression instanceof YulLiteralNode),
  );
}
