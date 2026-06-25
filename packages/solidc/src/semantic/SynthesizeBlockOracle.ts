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
} from '../ast/AST.js';
import { IntType, AddressType, Type, PrimitiveType } from '@solidcash/utils';
import { NullaryOperator, BinaryOperator } from '../ast/Operator.js';
import { TimeOp } from '../ast/Globals.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Oracle-backed `block.*` reads + the per-contract owner-update path (docs/block-oracle.md).
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

  constructor(private readonly solidityImportCompat = false) {
    super();
  }

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    this.used = new Set();
    this.loc = node.location;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;

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
    if (this.solidityImportCompat && node.operator === NullaryOperator.BLOCK_TIMESTAMP) {
      const locktime = new NullaryOpNode(NullaryOperator.LOCKTIME);
      locktime.location = node.location;
      return locktime;
    }
    const varName = FIELD_VAR[node.operator];
    if (varName) {
      this.used.add(varName);
      return this.stateAccess(varName, node);
    }
    if (node.operator === NullaryOperator.BLOCK_BASEFEE) {
      // Floor(1000 * totalFees / size) - VM integer divide truncates toward zero.
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

    node.functions.push(this.at(new FunctionDefinitionNode(UPDATE_FN, params, this.at(new BlockNode(body)) as BlockNode)) as FunctionDefinitionNode);
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
