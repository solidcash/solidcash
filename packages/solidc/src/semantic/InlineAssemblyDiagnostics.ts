import { AssemblyStatementNode } from '../ast/AST.js';
import {
  YulBlockNode, YulStatementNode, YulExpressionNode, YulFunctionCallNode, YulFunctionDefinitionNode,
  YulVariableDeclarationNode, YulAssignmentNode, YulIfNode, YulSwitchNode, YulForLoopNode,
  YulExpressionStatementNode,
} from '../ast/YulAST.js';
import { UnsupportedInlineAssemblyError } from '../Errors.js';

// Yul builtins with no BCH analogue (see docs/yul-inline-assembly.md "Genuinely out"). Anything NOT listed
// is value-computation or routes to an existing solidcash primitive, and is deferred to Yul codegen.
const YUL_NO_BCH_EQUIVALENT: Record<string, string> = {
  calldataload: 'EVM calldata has no BCH analogue',
  calldatasize: 'EVM calldata has no BCH analogue',
  calldatacopy: 'EVM calldata has no BCH analogue',
  returndatasize: 'EVM return-data buffer has no BCH analogue',
  returndatacopy: 'EVM return-data buffer has no BCH analogue',
  codesize: 'own-code introspection has no BCH analogue',
  codecopy: 'own-code introspection has no BCH analogue',
  msize: 'EVM memory size has no BCH analogue',
  pc: 'EVM program counter has no BCH analogue',
  callcode: 'EVM callcode has no BCH analogue',
  datasize: 'EVM object/linking builtin has no BCH analogue',
  dataoffset: 'EVM object/linking builtin has no BCH analogue',
  datacopy: 'EVM object/linking builtin has no BCH analogue',
  setimmutable: 'EVM object/linking builtin has no BCH analogue',
  loadimmutable: 'EVM object/linking builtin has no BCH analogue',
  linkersymbol: 'EVM object/linking builtin has no BCH analogue',
};

function noBchEquivalent(name: string): string | undefined {
  if (name.startsWith('verbatim')) return 'raw EVM bytecode injection cannot be translated to BCH script';
  return YUL_NO_BCH_EQUIVALENT[name];
}

interface Walk { calls: YulFunctionCallNode[]; fnDef: boolean; }

function walkBlock(block: YulBlockNode, w: Walk): void {
  for (const s of block.statements) walkStatement(s, w);
}

function walkStatement(s: YulStatementNode, w: Walk): void {
  if (s instanceof YulBlockNode) { walkBlock(s, w); return; }
  if (s instanceof YulVariableDeclarationNode) { if (s.value) walkExpression(s.value, w); return; }
  if (s instanceof YulAssignmentNode) { walkExpression(s.value, w); return; }
  if (s instanceof YulIfNode) { walkExpression(s.condition, w); walkBlock(s.body, w); return; }
  if (s instanceof YulSwitchNode) {
    walkExpression(s.expression, w);
    for (const c of s.cases) walkBlock(c.body, w);
    if (s.defaultBody) walkBlock(s.defaultBody, w);
    return;
  }
  if (s instanceof YulForLoopNode) {
    walkBlock(s.pre, w); walkExpression(s.condition, w); walkBlock(s.post, w); walkBlock(s.body, w);
    return;
  }
  if (s instanceof YulFunctionDefinitionNode) { w.fnDef = true; walkBlock(s.body, w); return; }
  if (s instanceof YulExpressionStatementNode) { walkExpression(s.expression, w); }
  // break / continue / leave hold no expressions
}

function walkExpression(e: YulExpressionNode, w: Walk): void {
  if (e instanceof YulFunctionCallNode) {
    w.calls.push(e);
    for (const a of e.args) walkExpression(a, w);
  }
  // path / literal hold no calls
}

// Phase 1: validate a Yul inline-assembly block and throw a clear diagnostic. Yul code generation is not
// implemented yet, so this always throws for Yul - but distinguishes "no BCH equivalent" (fundamental) from
// "not yet implemented" (value-computation / routable, coming in later phases). Native BCH-ASM is handled
// separately and is unaffected.
export function analyzeInlineAssembly(node: AssemblyStatementNode): void {
  if (!node.yulBlock) return;

  const w: Walk = { calls: [], fnDef: false };
  walkBlock(node.yulBlock, w);

  for (const call of w.calls) {
    const reason = noBchEquivalent(call.name);
    if (reason) throw new UnsupportedInlineAssemblyError(node, `'${call.name}' has no BCH equivalent (${reason})`);
  }

  if (w.fnDef) {
    throw new UnsupportedInlineAssemblyError(node, 'local Yul function definitions are not yet supported');
  }

  throw new UnsupportedInlineAssemblyError(
    node,
    'Yul code generation is not yet implemented (only native BCH-ASM assembly is currently supported)',
  );
}
