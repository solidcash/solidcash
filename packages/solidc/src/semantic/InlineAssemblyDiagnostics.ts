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

// call / staticcall / delegatecall in statement position (`ok := call(...)`) now lower to the external-call
// covenant (LowerInlineAssembly), so they are not listed here. callcode has no BCH analogue.
const YUL_NEEDS_TYPED_TARGET: Record<string, string> = {
  callcode: 'callcode has no BCH analogue',
};

function noBchEquivalent(name: string): string | undefined {
  if (name.startsWith('verbatim')) return 'raw EVM bytecode injection cannot be translated to BCH script';
  return YUL_NO_BCH_EQUIVALENT[name] ?? YUL_NEEDS_TYPED_TARGET[name];
}

// Yul builtins LowerInlineAssembly lowers to solidc AST (arithmetic/bitwise/shift/comparison, storage +
// transient, memory, calldata, keccak, revert). Keep in sync with LowerInlineAssembly's ARITH_OPS / BITWISE_OPS /
// CMP_OPS and its `name === '...'` handlers - used only to name the actual blocker in the diagnostic below.
const LOWERABLE_BUILTINS = new Set<string>([
  'add', 'sub', 'mul', 'div', 'sdiv', 'mod', 'smod', 'exp',
  'and', 'or', 'xor', 'not', 'shl', 'shr', 'sar', 'byte',
  'lt', 'slt', 'gt', 'sgt', 'eq', 'iszero',
  'sload', 'sstore', 'tload', 'tstore', 'mload', 'mstore',
  // mcopy + msize lower via the runtime __yulmem buffer (P7); mstore8 is still deferred.
  'mcopy', 'msize',
  'calldataload', 'calldatasize', 'keccak256', 'erc7201', 'revert',
  // nullary context builtins -> msg.*/tx.*/block.* NullaryOps
  'caller', 'callvalue', 'origin', 'gasprice', 'chainid', 'number', 'timestamp', 'difficulty',
  'prevrandao', 'basefee', 'blobbasefee', 'gaslimit', 'coinbase',
  'blockhash', 'gas', 'codesize', 'selfbalance', 'addmod', 'mulmod', 'pop', 'invalid', 'stop', 'signextend',
  'blobhash',
]);

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

// Diagnose a Yul inline-assembly block that LowerInlineAssembly could NOT lower (a lowered block never reaches
// here). LowerInlineAssembly handles a large Yul subset (arithmetic/bitwise/comparison, storage/transient,
// memory, calldata, keccak, revert, if/switch/for/let); this names the actual reason a given block fell through:
// a builtin with no BCH analogue (fundamental), a local function definition, a builtin not yet lowered, or - when
// every builtin is individually lowerable - an unsupported control-flow / access-pattern combination.
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

  // Name the builtins that blocked lowering (mcopy, codesize, return, log*, gas, ...) rather than claiming Yul is
  // wholesale unsupported - most of it is lowered. If every builtin is lowerable, the blocker is structural.
  const unlowerable = [...new Set(w.calls.map((c) => c.name))].filter((n) => !LOWERABLE_BUILTINS.has(n));
  if (unlowerable.length > 0) {
    throw new UnsupportedInlineAssemblyError(
      node,
      `Yul builtin(s) not yet lowerable to BCH script: ${unlowerable.sort().join(', ')}`,
    );
  }

  throw new UnsupportedInlineAssemblyError(
    node,
    'this Yul block is not yet lowerable to BCH script (its builtins are individually supported, but this '
    + 'control-flow / memory-access combination is not)',
  );
}
