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
  CastNode,
  ExpressionNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { BlockhashDepthError, DeprecatedNowError } from '../Errors.js';
import {
  BLOCKHASH_MAX_DEPTH, IntType, PrimitiveType, encodeComputedBlockhashKey, type Type,
} from '@solidcash/utils';
import { NullaryOperator, BinaryOperator } from '../ast/Operator.js';
import { GlobalFunction } from '../ast/Globals.js';
import AstTraversal from '../ast/AstTraversal.js';
import { emitCompilerWarning } from '../warnings.js';
import { collectNamedFunctionClosure, walkInvocationAst } from '../analysis/InvocationAnalysis.js';

/** The block.* reads that slice the oracle commitment. basefee and blobbasefee lower to two of them. */
const ORACLE_FIELDS = new Set<NullaryOperator>([
  NullaryOperator.BLOCK_NUMBER,
  NullaryOperator.BLOCK_TIMESTAMP,
  NullaryOperator.BLOCK_DIFFICULTY,
  NullaryOperator.BLOCK_SIZE,
  NullaryOperator.BLOCK_TOTAL_FEES,
  NullaryOperator.BLOCK_COINBASE,
]);

const isIntegerType = (type: Type): boolean =>
  type instanceof IntType || type === PrimitiveType.INT || type === PrimitiveType.BIGINT;

/** `block.number`, under any integer casts. */
function isBlockNumber(node: Node | undefined): boolean {
  if (node instanceof CastNode) return isIntegerType(node.type) && isBlockNumber(node.expression);
  return node instanceof NullaryOpNode && node.operator === NullaryOperator.BLOCK_NUMBER;
}

/** Whether a body slices the oracle itself, before or after basefee lowering. */
export function readsBlockOracle(fn: FunctionDefinitionNode): boolean {
  if (fn.usesBlockOracle === true) return true;
  let found = false;
  walkInvocationAst(fn.body, (node) => {
    if (node instanceof NullaryOpNode && (ORACLE_FIELDS.has(node.operator)
      || node.operator === NullaryOperator.BLOCK_BASEFEE
      || node.operator === NullaryOperator.BLOCK_BLOBBASEFEE)) found = true;
  });
  return found;
}

/**
 * A reader takes the oracle index as a hidden parameter, so every caller has to carry it to forward it.
 * Mark the named-call closure of each reader, which also reaches a generated message-bus route through its
 * handler calls. Runs after the route exists and before SymbolTableTraversal injects the parameter.
 */
export function markBlockOracleCallers(
  contract: ContractNode, freeFunctions: readonly FunctionDefinitionNode[],
): void {
  const bodies = [
    ...contract.functions, ...freeFunctions, contract.constructorDef, contract.fallbackDef, contract.receiveDef,
  ].filter((fn): fn is FunctionDefinitionNode => fn !== undefined);
  const byName = new Map<string, FunctionDefinitionNode[]>();
  const readers = new Set<string>();
  for (const fn of bodies) {
    byName.set(fn.name, [...(byName.get(fn.name) ?? []), fn]);
    if (readsBlockOracle(fn)) readers.add(fn.name);
  }
  if (readers.size === 0) return;
  const directCalls = new WeakMap<FunctionDefinitionNode, Set<string>>();
  for (const fn of bodies) {
    if ([...collectNamedFunctionClosure(fn, byName, directCalls)].some((name) => readers.has(name))) {
      fn.usesBlockOracle = true;
    }
  }
  contract.usesBlockOracle = true;
}

/**
 * Oracle-backed `block.*` reads.
 *
 * The block data lives in the commitment of the contract's own oracle coin, a mutable NFT of its category at the
 * lock the covenant gives that category, not in this contract's state. A read stays a `block.*` nullary; codegen
 * slices that commitment. The owner update is the oracle covenant's own spend and is never added to this contract.
 * Any block.* or blockhash read makes the contract stateful. `block.basefee` is Floor(1000 * totalFees / size) over
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
  // The ring depth the reads need, the most over them: K for blockhash(block.number - K) with K a compile-time
  // constant (1 for K = 0). Any other argument leaves the reads unbounded, and the deployer picks the depth.
  blockhashDepth = 0;
  blockhashDepthBounded = true;
  private constants = new Map<string, ExpressionNode>();
  private fnUsesBlockhash = false;
  // Distinct blockhash read keys in the current function - each rides its own oracle slot (param name for a
  // direct-identifier n; a framed-site placeholder for a computed n).
  private fnBlockhashArgs = new Set<string>();
  // Per-function counter for computed-n blockhash reads (each is its own slot).
  private fnComputedBlockhashCount = 0;
  private fnUsesOracle = false;
  // Any block.* global or blockhash(n) read in the contract, oracle-backed or not.
  private readsBlockData = false;
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
      this.readsBlockData = true;
      this.fnUsesBlockhash = true;
      const depth = this.blockhashReadDepth(node);
      if (depth === undefined) this.blockhashDepthBounded = false;
      else this.blockhashDepth = Math.max(this.blockhashDepth, depth);
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

  /** The ring depth one read needs, undefined when it is unbounded. A read further back than a ring holds is refused. */
  private blockhashReadDepth(node: FunctionCallNode): number | undefined {
    const blocksBack = this.blocksBelowBlockNumber(node.parameters[0]);
    if (blocksBack === undefined || blocksBack < 0n) return undefined;
    if (blocksBack > BigInt(BLOCKHASH_MAX_DEPTH)) throw new BlockhashDepthError(node, blocksBack, BLOCKHASH_MAX_DEPTH);
    return Math.max(1, Number(blocksBack));
  }

  /** K when `argument` is `block.number - K` with K a compile-time constant, 0 for `block.number` itself. */
  private blocksBelowBlockNumber(argument: Node | undefined): bigint | undefined {
    if (isBlockNumber(argument)) return 0n;
    if (!(argument instanceof BinaryOpNode) || argument.operator !== BinaryOperator.MINUS) return undefined;
    return isBlockNumber(argument.left) ? this.constantInteger(argument.right, new Set()) : undefined;
  }

  /** A compile-time integer: a literal, a constant no local shadows, an integer cast, or a sum, difference or product. */
  private constantInteger(node: Node | undefined, seen: ReadonlySet<string>): bigint | undefined {
    if (node instanceof IntLiteralNode) return node.value;
    if (node instanceof CastNode) return isIntegerType(node.type) ? this.constantInteger(node.expression, seen) : undefined;
    if (node instanceof IdentifierNode) {
      const expression = this.constants.get(node.name);
      if (expression === undefined || seen.has(node.name) || this.fnDeclaredNames.has(node.name)) return undefined;
      return this.constantInteger(expression, new Set([...seen, node.name]));
    }
    if (!(node instanceof BinaryOpNode)) return undefined;
    const left = this.constantInteger(node.left, seen);
    const right = this.constantInteger(node.right, seen);
    if (left === undefined || right === undefined) return undefined;
    if (node.operator === BinaryOperator.PLUS) return left + right;
    if (node.operator === BinaryOperator.MINUS) return left - right;
    if (node.operator === BinaryOperator.MUL) return left * right;
    return undefined;
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
    for (const constant of node.constantDefinitions) this.constants.set(constant.name, constant.expression);
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.stateVarNames = new Set(node.stateVariables.map((sv) => sv.name));
    for (const constant of node.constantDefinitions) this.constants.set(constant.name, constant.expression);
    // Solidity permits a contract function to shadow the gasleft builtin (with a compiler warning). Preserve
    // that ordinary call for semantic overload resolution rather than replacing it with the BCH gas shim.
    this.userGasleft = node.functions.some((fn) => fn.name === 'gasleft' && fn.parameters.length === 0);
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;

    // Every block oracle is of the contract's own category, so any block.* or blockhash read makes the contract
    // stateful. The mark stays once set: a re-run on a split root sees forwarders, not the reads.
    const bodies = [node.functions, node.constructorDef, node.fallbackDef, node.receiveDef].flat();
    node.usesBlockhash = bodies.some((fn) => fn?.usesBlockhash);
    node.usesBlockOracle = bodies.some((fn) => fn?.usesBlockOracle);
    node.readsBlockData = node.readsBlockData || this.readsBlockData;
    return node;
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    if (String(node.operator).startsWith('block.')) this.readsBlockData = true;
    if (ORACLE_FIELDS.has(node.operator)) {
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
