import {
  ContractNode,
  FunctionDefinitionNode,
  SourceFileNode,
  Node,
  StatementNode,
  NullaryOpNode,
  StateAccessNode,
  StateAssignNode,
  StateVariableNode,
  ParameterNode,
  BlockNode,
  RequireNode,
  TimeOpNode,
  FunctionCallNode,
  IdentifierNode,
  IntLiteralNode,
  BinaryOpNode,
  VariableDefinitionNode,
} from '../ast/AST.js';
import { IntType, AddressType, Type, PrimitiveType, encodeComputedBlockhashKey } from '@solidcash/utils';
import { NullaryOperator, BinaryOperator } from '../ast/Operator.js';
import { TimeOp, GlobalFunction } from '../ast/Globals.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Oracle-backed `block.*` reads + the per-contract owner-update path (docs/block-and-transaction-properties.md).
 *
 * Each referenced field is desugared to a read of an injected register of the contract's own state
 * (`uint32`, or `address` for the variable-length coinbase); a stateless contract that uses block.*
 * becomes stateful so the read rides the master spend. block.basefee = Floor(1000*totalFees/size).
 *
 * Owner duty to refresh: a baked owner key (`__blockOracleOwner`, an immutable pubkey register seeded at
 * genesis) + an injected `__updateBlockOracle(sig, ...fields)` that requires the owner signature and the
 * freshness/anti-over-reporting bound `tx.time >= number` (the owner cannot report a height above the
 * chain), then writes each register. block.chainid is a separate baked constant (NOT here).
 *
 * Runs before semantic analysis so injected decls/reads/writes resolve normally. Under
 * solidityImportCompat, `block.timestamp` keeps the native tx.locktime mapping (porting) instead.
 */
const FIELD_VAR: Partial<Record<NullaryOperator, string>> = {
  [NullaryOperator.BLOCK_NUMBER]: '__block_number',
  [NullaryOperator.BLOCK_TIMESTAMP]: '__block_timestamp',
  [NullaryOperator.BLOCK_DIFFICULTY]: '__block_difficulty',
  [NullaryOperator.BLOCK_SIZE]: '__block_size',
  [NullaryOperator.BLOCK_TOTAL_FEES]: '__block_totalFees',
  [NullaryOperator.BLOCK_COINBASE]: '__block_coinbase',
};

const OWNER_VAR = '__blockOracleOwner';
const SIG_PARAM = '__blockOracleSig';
const UPDATE_FN = '__updateBlockOracle';

// coinbase is the full coinbase-output-0 locking bytecode (variable length, inline address/pushdata
// encoding); every other field is a uint32.
function registerType(varName: string): Type {
  return varName === '__block_coinbase' ? new AddressType() : new IntType(false, 32);
}

// param name written into register `__block_<field>` by the update function.
function setterParam(varName: string): string {
  return `__set_${varName.slice('__block_'.length)}`;
}

export default class SynthesizeBlockOracle extends AstTraversal {
  private used = new Set<string>();
  private loc: unknown;
  // Set when the contract references blockhash(n): surfaced to the artifact so the keeper knows to
  // maintain the project-global (n->hash) oracle (docs/block-and-transaction-properties.md).
  usesBlockhash = false;
  private fnUsesBlockhash = false;
  // Distinct blockhash read keys in the current function - each rides its own oracle slot (param name for a
  // direct-identifier n; a per-call-site placeholder for a computed n).
  private fnBlockhashArgs = new Set<string>();
  // Per-function counter for computed-n blockhash reads (each is its own slot).
  private fnComputedBlockhashCount = 0;
  // Names declared in the contract (state vars) and current function (params + locals), so a bare `now` that is
  // actually a declared variable is NOT aliased to block.timestamp (Solidity <0.7 global; a plain var in >=0.7).
  private stateVarNames = new Set<string>();
  private fnDeclaredNames = new Set<string>();
  private warnedShims = new Set<string>();


  // One-time compiler warning for an EVM primitive that has no BCH analogue and is lowered as a shim.
  private warnShim(key: string, message: string): void {
    if (this.warnedShims.has(key)) return;
    this.warnedShims.add(key);
    console.warn(message);
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    // gasleft() -> fixed 1000000: BCH has no gas metering. A literal (not a revert) so ported code that
    // gates on a gas budget keeps running; warn it is a shim.
    if (node.identifier.name === 'gasleft' && node.parameters.length === 0) {
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
      // gets its own per-call-site slot; the SDK resolves it from the auto-derivation probe trace (the covenant
      // computes n on-stack). Only the slot COUNT matters here (codegen assigns the concrete keys), so mark
      // each computed call site with a unique placeholder.
      const nArg = node.parameters[0];
      if (nArg instanceof IdentifierNode) {
        this.fnBlockhashArgs.add(nArg.name);
      } else {
        // Stamp a stable per-call-site index (this pass visits each call once; codegen visits twice).
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
    this.fnUsesBlockhash = false;
    this.fnBlockhashArgs = new Set();
    this.fnComputedBlockhashCount = 0;
    this.fnDeclaredNames = new Set([...this.stateVarNames]);
    for (const p of node.parameters) this.fnDeclaredNames.add(p.name);
    for (const rn of node.returnNames ?? []) if (rn) this.fnDeclaredNames.add(rn);
    this.collectLocalNames(node.body);
    const result = super.visitFunctionDefinition(node) as FunctionDefinitionNode;
    if (this.fnUsesBlockhash) {
      result.usesBlockhash = true;
      result.blockhashSlotCount = this.fnBlockhashArgs.size;
    }
    this.fnUsesBlockhash = prev;
    this.fnBlockhashArgs = prevArgs;
    this.fnComputedBlockhashCount = prevComputed;
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
      const ts = new NullaryOpNode(NullaryOperator.BLOCK_TIMESTAMP);
      ts.location = node.location;
      return this.visit(ts);
    }
    return node;
  }

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.used = new Set();
    this.loc = node.location;
    this.stateVarNames = new Set(node.stateVariables.map((sv) => sv.name));
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;

    // blockhash(n) brands its (n->hash) oracle to the contract's own category, so the reader must be stateful.
    node.usesBlockhash = [...node.functions, node.constructorDef, node.fallbackDef, node.receiveDef]
      .some((f) => f?.usesBlockhash);

    if (this.used.size === 0) return node;

    const fields = [...this.used];
    for (const varName of fields) {
      if (!node.stateVariables.some((sv) => sv.name === varName)) {
        node.stateVariables.push(this.at(new StateVariableNode(registerType(varName), varName)) as StateVariableNode);
      }
    }
    this.injectOwnerUpdate(node, fields);
    return node;
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    const varName = FIELD_VAR[node.operator];
    if (varName) {
      this.used.add(varName);
      return this.stateAccess(varName, node);
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
      this.used.add('__block_totalFees');
      this.used.add('__block_size');
      const lit = new IntLiteralNode(1000n);
      lit.location = node.location;
      const mul = new BinaryOpNode(lit, BinaryOperator.MUL, this.stateAccess('__block_totalFees', node));
      mul.location = node.location;
      const div = new BinaryOpNode(mul, BinaryOperator.DIV, this.stateAccess('__block_size', node));
      div.location = node.location;
      return div;
    }
    return node;
  }

  // Inject the immutable owner-key register + the owner-gated, freshness-bound update function.
  private injectOwnerUpdate(node: ContractNode, fields: string[]): void {
    if (!node.stateVariables.some((sv) => sv.name === OWNER_VAR)) {
      const owner = new StateVariableNode(PrimitiveType.PUBKEY, OWNER_VAR);
      owner.immutable = true;
      // The key is security-critical and fixed-width, while preceding user fields may include variable-width
      // addresses whose conservative commitment footprint cannot be inferred from their runtime locking script.
      // Isolate it so synthesis cannot overflow an otherwise full user-state commitment or shift later offsets.
      owner.isolatedNft = true;
      node.stateVariables.push(this.at(owner) as StateVariableNode);
    }

    const params = [this.at(new ParameterNode(PrimitiveType.SIG, SIG_PARAM)) as ParameterNode];
    for (const varName of fields) {
      params.push(this.at(new ParameterNode(registerType(varName), setterParam(varName))) as ParameterNode);
    }

    const body: StatementNode[] = [];
    const checkSig = this.at(new FunctionCallNode(
      this.at(new IdentifierNode('checkSig')) as IdentifierNode,
      [this.at(new IdentifierNode(SIG_PARAM)) as IdentifierNode, this.stateAccessRaw(OWNER_VAR)],
    )) as FunctionCallNode;
    body.push(this.at(new RequireNode(checkSig, 'block oracle: owner signature required')) as RequireNode);

    // Anti-over-reporting: bind the written height to the chain (tx.time >= number). Height-only, since
    // nLocktime is height XOR time; if block.number is unused there is no native temporal anchor.
    if (this.used.has('__block_number')) {
      body.push(this.at(new TimeOpNode(
        TimeOp.CHECK_LOCKTIME, this.at(new IdentifierNode(setterParam('__block_number'))) as IdentifierNode,
        'block oracle: number exceeds chain height',
      )) as TimeOpNode);
    }

    for (const varName of fields) {
      body.push(this.at(new StateAssignNode(
        varName, this.at(new IdentifierNode(setterParam(varName))) as IdentifierNode,
      )) as StateAssignNode);
    }

    const updateFn = this.at(
      new FunctionDefinitionNode(UPDATE_FN, params, this.at(new BlockNode(body)) as BlockNode),
    ) as FunctionDefinitionNode;
    // X72. This pass can run AFTER message-bus route synthesis (compiler.ts runs route synthesis early
    // whenever a handler touches a collection, has an effect or returns). Route synthesis only names a
    // rejection reason for the entry points that exist when it runs, so this one reached the artifact as
    // `eligible: false` with the reason key absent - a refusal with no reason. State the reason the absence
    // channel already uses for the same condition (compiler.ts `messageBusAbsenceMessage`). When route
    // synthesis runs after this pass it examines this function like any other and overwrites both fields.
    updateFn.messageBusEligible = false;
    updateFn.messageBusRejectionReason = 'not-examined-by-route-synthesis';
    node.functions.push(updateFn);
  }

  private stateAccess(name: string, src: NullaryOpNode): StateAccessNode {
    const sa = new StateAccessNode(name);
    sa.location = src.location;
    return sa;
  }

  private stateAccessRaw(name: string): StateAccessNode {
    return this.at(new StateAccessNode(name)) as StateAccessNode;
  }

  private at<T extends Node>(n: T): T {
    n.location = this.loc as T['location'];
    return n;
  }
}
