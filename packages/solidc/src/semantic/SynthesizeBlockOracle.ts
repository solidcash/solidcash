import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  NullaryOpNode,
  FunctionCallNode,
  IdentifierNode,
  IntLiteralNode,
  BinaryOpNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { DeprecatedNowError } from '../Errors.js';
import { encodeComputedBlockhashKey } from '@solidcash/utils';
import { NullaryOperator, BinaryOperator } from '../ast/Operator.js';
import { GlobalFunction } from '../ast/Globals.js';
import AstTraversal from '../ast/AstTraversal.js';
import { emitCompilerWarning } from '../warnings.js';

/**
 * Oracle-backed `block.*` reads.
 *
 * The block data lives in one raw covenant's NFT commitment, not in this contract. A read stays a
 * `block.*` nullary; codegen slices that commitment. The owner update is the oracle covenant's own
 * spend and is never added to this contract. `block.basefee` is Floor(1000 * totalFees / size) over
 * two of those slices. `block.chainid` is a separate baked constant.
 *
 * The owner's bounds live in that covenant (utils/block-oracle.ts): a height update keeps `number` below
 * 500000000, does not rewind it, CLTVs it, and keeps `timestamp`; a timestamp update runs under a
 * time-type locktime, does not rewind it, CLTVs it, and keeps `number`. `block.number` and
 * `block.timestamp` warn: each is the last value that owner wrote, not the chain's.
 */

export default class SynthesizeBlockOracle extends AstTraversal {
  private legacyNow = false;
  // Set when the contract references blockhash(n): surfaced to the artifact so the keeper knows to
  // maintain the project-global (n->hash) oracle (docs/block-and-transaction-properties.md).
  usesBlockhash = false;
  private fnUsesBlockhash = false;
  // Distinct blockhash read keys in the current function - each rides its own oracle slot (param name for a
  // direct-identifier n; a framed-site placeholder for a computed n).
  private fnBlockhashArgs = new Set<string>();
  // Per-function counter for computed-n blockhash reads (each is its own slot).
  private fnComputedBlockhashCount = 0;
  private fnUsesOracle = false;
  // Names declared in the contract (state vars) and current function (params + locals), so a bare `now` that is
  // actually a declared variable is NOT aliased to block.timestamp (Solidity <0.7 global; a plain var in >=0.7).
  private stateVarNames = new Set<string>();
  private fnDeclaredNames = new Set<string>();
  private warnedShims = new Set<string>();
  private userGasleft = false;

  constructor(
    // Strict Solidity validation is not a timestamp switch: it only turns the Solidity <0.7 `now` alias into a
    // deprecated-name error. block.timestamp routes through the oracle register in every mode.
    private strictSolidityValidation = false,
    private delegateExecutionContext = false,
  ) {
    super();
  }

  // One-time compiler warning for an EVM primitive that has no BCH analogue and is lowered as a shim.
  private warnShim(key: string, message: string): void {
    if (this.warnedShims.has(key)) return;
    this.warnedShims.add(key);
    emitCompilerWarning(message);
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    // gasleft() -> fixed 1000000: BCH has no gas metering. A literal (not a revert) so ported code that
    // gates on a gas budget keeps running; warn it is a shim.
    if (node.identifier.name === 'gasleft' && node.parameters.length === 0 && !this.userGasleft) {
      this.warnShim('gasleft', 'Warning: gasleft() has no BCH analogue (no gas metering); SolidCash lowers '
        + 'it as a fixed shim (1000000). Do not rely on its value.');
      const lit = new IntLiteralNode(1_000_000n);
      lit.location = node.location;
      return lit;
    }
    if (node.identifier.name === GlobalFunction.BLOCKHASH) {
      this.usesBlockhash = true;
      this.fnUsesBlockhash = true;
      // Each distinct n gets its own consecutive oracle slot. A direct-identifier n keys on the param name (the
      // SDK reads the arg; same param -> one slot). ANY computed n (block.number - K, arbitrary arithmetic)
      // gets its own framed-site slot; the SDK resolves it from the auto-derivation probe trace (the covenant
      // computes n on-stack). Only the slot COUNT matters here (codegen assigns the concrete keys), so mark
      // each computed call site with a unique placeholder.
      const nArg = node.parameters[0];
      if (nArg instanceof IdentifierNode) {
        this.fnBlockhashArgs.add(nArg.name);
      } else {
        // Stamp a stable framed-site index (this pass visits each call once; codegen visits twice).
        node.blockhashComputedIndex = this.fnComputedBlockhashCount++;
        this.fnBlockhashArgs.add(encodeComputedBlockhashKey(node.blockhashComputedIndex));
      }
    }
    return super.visitFunctionCall(node);
  }

  // Flag a function reading blockhash(n); SymbolTable injects the hidden co-spend input-index param after
  // it has validated the user params (the param uses the reserved __internal__ prefix).
  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const prev = this.fnUsesBlockhash;
    const prevArgs = this.fnBlockhashArgs;
    const prevComputed = this.fnComputedBlockhashCount;
    const prevOracle = this.fnUsesOracle;
    this.fnUsesBlockhash = false;
    this.fnBlockhashArgs = new Set();
    this.fnComputedBlockhashCount = 0;
    this.fnUsesOracle = false;
    this.fnDeclaredNames = new Set([...this.stateVarNames]);
    for (const p of node.parameters) this.fnDeclaredNames.add(p.name);
    for (const rn of node.returnNames ?? []) if (rn) this.fnDeclaredNames.add(rn);
    this.collectLocalNames(node.body);
    const result = super.visitFunctionDefinition(node) as FunctionDefinitionNode;
    if (this.fnUsesBlockhash) {
      result.usesBlockhash = true;
      result.blockhashSlotCount = this.fnBlockhashArgs.size;
    }
    // Re-running this pass on a split root sees a forwarder, not the read. Clear a mark left by the
    // earlier pass so a shard that no longer slices the commitment is not required to publish the lock pin.
    if (this.fnUsesOracle) result.usesBlockOracle = true;
    else result.usesBlockOracle = undefined;
    this.fnUsesBlockhash = prev;
    this.fnBlockhashArgs = prevArgs;
    this.fnComputedBlockhashCount = prevComputed;
    this.fnUsesOracle = prevOracle;
    return result;
  }

  // Record every local variable name declared anywhere in a function body (Solidity function scope is flat for
  // shadowing purposes here), so a bare `now` read that names one is left alone rather than aliased.
  private collectLocalNames(body: Node | undefined): void {
    if (!body) return;
    const walk = (n: Node | undefined): void => {
      if (!n) return;
      if (n instanceof VariableDefinitionNode) this.fnDeclaredNames.add(n.name);
      for (const key of Object.keys(n)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) walk(it);
      }
    };
    walk(body);
  }

  // Solidity <0.7 global `now` aliases `block.timestamp` (removed in 0.7, where it may be a plain variable). Alias
  // a NON-shadowed bare `now` and re-visit so it flows through the same block.timestamp lowering as an explicit ref.
  visitIdentifier(node: IdentifierNode): Node {
    if (node.name === 'now' && !this.fnDeclaredNames.has('now')) {
      if (this.strictSolidityValidation && !this.legacyNow) throw new DeprecatedNowError(node);
      const ts = new NullaryOpNode(NullaryOperator.BLOCK_TIMESTAMP);
      ts.location = node.location;
      return this.visit(ts);
    }
    return node;
  }

  visitSourceFile(node: SourceFileNode): Node {
    this.legacyNow = node.solidityLegacyNow;
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.stateVarNames = new Set(node.stateVariables.map((sv) => sv.name));
    // Solidity permits a contract function to shadow the gasleft builtin (with a compiler warning). Preserve
    // that ordinary call for semantic overload resolution rather than replacing it with the BCH gas shim.
    this.userGasleft = node.functions.some((fn) => fn.name === 'gasleft' && fn.parameters.length === 0);
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;

    // blockhash(n) brands its (n->hash) oracle to the contract's own category, so the reader must be stateful.
    const bodies = [node.functions, node.constructorDef, node.fallbackDef, node.receiveDef].flat();
    node.usesBlockhash = bodies.some((fn) => fn?.usesBlockhash);
    node.usesBlockOracle = bodies.some((fn) => fn?.usesBlockOracle);
    return node;
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    if (node.operator === NullaryOperator.BLOCK_NUMBER
      || node.operator === NullaryOperator.BLOCK_TIMESTAMP
      || node.operator === NullaryOperator.BLOCK_DIFFICULTY
      || node.operator === NullaryOperator.BLOCK_SIZE
      || node.operator === NullaryOperator.BLOCK_TOTAL_FEES
      || node.operator === NullaryOperator.BLOCK_COINBASE) {
      this.fnUsesOracle = true;
      if (node.operator === NullaryOperator.BLOCK_TIMESTAMP) {
        this.warnShim('block.timestamp', 'Warning: block.timestamp is the last value the oracle owner wrote, '
          + 'not the chain clock. A deadline stays open until that owner updates it.');
      }
      if (node.operator === NullaryOperator.BLOCK_NUMBER) {
        this.warnShim('block.number', 'Warning: block.number is the last height the oracle owner wrote. '
          + 'It is checked against the chain when the owner updates it, and it can lag the tip.');
      }
      return node;
    }
    // block.prevrandao: BCH has no randomness source. Lowered (in codegen) to a transaction-local value -
    // abs(int(sha256(input[0] prevout txid))) - so it needs no oracle. Warn: the tx-builder picks input[0],
    // so it is grindable + constant within a fixed tx. Pass through to TypeCheck/codegen unchanged.
    if (node.operator === NullaryOperator.BLOCK_PREVRANDAO) {
      this.warnShim('block.prevrandao', 'Warning: block.prevrandao has no secure randomness on BCH (no VM '
        + 'randomness, no consensus beacon). SolidCash lowers it to abs(int(sha256(input[0] prevout txid))) - '
        + 'transaction-local and fully chosen by the tx-builder (grindable). Do not use for security-sensitive '
        + 'randomness; use commit-reveal or a checkDataSig oracle.');
      return node;
    }
    // block.gaslimit -> fixed 1000000: BCH has no gas metering. A constant (not 0, not a revert) so ported
    // code that compares against a gas limit keeps working; warn it is a shim.
    if (node.operator === NullaryOperator.BLOCK_GASLIMIT) {
      this.warnShim('block.gaslimit', 'Warning: block.gaslimit has no BCH analogue (no gas metering); '
        + 'SolidCash lowers it as a fixed shim (1000000). Do not rely on its value.');
      const lit = new IntLiteralNode(1_000_000n);
      lit.location = node.location;
      return lit;
    }
    if (node.operator === NullaryOperator.BLOCK_BASEFEE || node.operator === NullaryOperator.BLOCK_BLOBBASEFEE) {
      // block.basefee = Floor(1000 * totalFees / size) sat/KB (VM divide truncates toward zero).
      // block.blobbasefee is an ALIAS for it: BCH has no EIP-4844 blobs, but returning 0 would silently
      // zero out (or divide-by-zero) downstream computations, so it aliases the real base fee. Warn once.
      if (node.operator === NullaryOperator.BLOCK_BLOBBASEFEE) {
        this.warnShim('block.blobbasefee', 'Warning: block.blobbasefee has no BCH analogue (no EIP-4844 '
          + 'blobs); it aliases block.basefee (a real, non-zero base fee) so it does not zero out '
          + 'computations. Do not rely on it as a true blob base fee.');
      }
      this.fnUsesOracle = true;
      const fees = new NullaryOpNode(NullaryOperator.BLOCK_TOTAL_FEES);
      fees.location = node.location;
      const size = new NullaryOpNode(NullaryOperator.BLOCK_SIZE);
      size.location = node.location;
      const lit = new IntLiteralNode(1000n);
      lit.location = node.location;
      const mul = new BinaryOpNode(lit, BinaryOperator.MUL, fees);
      mul.location = node.location;
      const div = new BinaryOpNode(mul, BinaryOperator.DIV, size);
      div.location = node.location;
      return div;
    }
    return node;
  }
}
