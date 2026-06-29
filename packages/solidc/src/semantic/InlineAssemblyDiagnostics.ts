import { AssemblyStatementNode } from '../ast/AST.js';
import {
  YulBlockNode, YulStatementNode, YulExpressionNode, YulFunctionCallNode, YulFunctionDefinitionNode,
  YulVariableDeclarationNode, YulAssignmentNode, YulIfNode, YulSwitchNode, YulForLoopNode,
  YulExpressionStatementNode,
} from '../ast/YulAST.js';
import { UnsupportedInlineAssemblyError } from '../Errors.js';

// Yul builtins with genuinely no BCH analogue (see docs/yul-inline-assembly.md "Genuinely out"). Kept tight
// on purpose: anything that is value-computation OR routes to an existing solidcash primitive is NOT here -
// it gets the "codegen not yet implemented" message instead. In particular calldata* / codesize / codecopy
// are routable (calldata = msg.sig ++ abi-encoded args; own code = this.activeBytecode), so they are deferred,
// not rejected.
const YUL_NO_BCH_EQUIVALENT: Record<string, string> = {
  pc: 'the EVM program counter has no BCH analogue',
  datasize: 'EVM bytecode-object builtin has no BCH analogue',
  dataoffset: 'EVM bytecode-object builtin has no BCH analogue',
  datacopy: 'EVM bytecode-object builtin has no BCH analogue',
  linkersymbol: 'the EVM library-linking placeholder has no BCH analogue',
  // Yul create deploys runtime init bytecode (from memory). BCH deploys a typed compiled contract via `new`,
  // not arbitrary runtime bytecode, so the Yul form is untranslatable (the high-level `new C(...)` is the path).
  create: 'deploying runtime bytecode has no BCH analogue (use a typed `new Contract(...)`, not Yul create)',
  create2: 'deploying runtime bytecode has no BCH analogue (use a typed `new Contract(...)`, not Yul create2)',
};

// Routable in principle, but only to a KNOWN target interface with a constant selector. The proxy/forwarding
// patterns in practice forward opaque/arbitrary calldata to an opaque address, which has no BCH analogue.
const YUL_NEEDS_TYPED_TARGET: Record<string, string> = {
  call: 'a low-level call needs a known target interface and a constant selector to route to a typed external '
    + 'call; forwarding opaque calldata is not supported (use `IContract(addr).method(...)`)',
  delegatecall: 'a low-level delegatecall needs a known target; forwarding opaque calldata to an opaque '
    + 'implementation (the proxy pattern) has no BCH analogue',
  staticcall: 'a low-level staticcall needs a known target interface and a constant selector to route to a '
    + 'typed external call; forwarding opaque calldata is not supported',
  callcode: 'callcode has no BCH analogue',
};

function noBchEquivalent(name: string): string | undefined {
  if (name.startsWith('verbatim')) return 'raw EVM bytecode injection cannot be translated to BCH script';
  return YUL_NO_BCH_EQUIVALENT[name] ?? YUL_NEEDS_TYPED_TARGET[name];
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
