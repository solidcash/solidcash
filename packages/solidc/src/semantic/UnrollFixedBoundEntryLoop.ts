import {
  Node,
  SourceFileNode,
  ContractNode,
  FunctionDefinitionNode,
  BlockNode,
  StatementNode,
  WhileNode,
  VariableDefinitionNode,
  IntLiteralNode,
  IdentifierNode,
  BinaryOpNode,
  UnaryOpNode,
  AssignNode,
  ArrayAssignNode,
  BreakNode,
  ContinueNode,
  ReturnNode,
  FunctionCallNode,
} from '../ast/AST.js';
import { GlobalFunction } from '../ast/Globals.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import { MappingType, ArrayType, Type } from '@solidcash/utils';
import { cloneNode } from '../ast/clone.js';
import AstTraversal from '../ast/AstTraversal.js';

const MAX_UNROLL = 64;

/**
 * Unrolls a FIXED-BOUND C-style for-loop whose body writes an entry-backed mapping into N STATIC copies with the
 * loop variable substituted by each constant. `for (uint i = C0; i < CN; i += S) m[k[i]] = v[i]` (C0/CN/S all
 * compile-time constants, CN an int literal or a fixed-array `.length`) becomes `m[k[C0]] = v[C0]; m[k[C0+S]] = ...`
 * - which the existing per-slot machinery already compiles soundly (a mapping write in a RUNTIME loop is rejected
 * by EntryWriteInLoopError, because one fixed entry slot can't hold N runtime entries). Distinct constant-index
 * keys get distinct entry slots, so the unrolled form is equivalent to hand-written static writes.
 *
 * Restricted to be sound: only fires when the body contains a mapping write OR a keccak256 call (else unrolling
 * is needless), never when the body has break/continue/return (unrolling changes their control flow), and
 * N <= MAX_UNROLL (avoid code blow-up). Runs before break/continue expansion + SymbolTableTraversal so the static
 * writes / keccak calls get their slots. A fixed-bound keccak256 loop unrolls to N syntactic calls (N compute
 * side-cars, each resolved by the complex-arg probe); a runtime-bound keccak loop stays flagged keccakInLoop.
 */
export default class UnrollFixedBoundEntryLoop extends AstTraversal {
  private mappingNames = new Set<string>();
  private varTypes = new Map<string, Type>();
  private stateVarTypes = new Map<string, Type>();

  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    node.importedContracts = node.importedContracts.map((c) => this.visit(c) as ContractNode);
    node.freeFunctions = node.freeFunctions.map((f) => this.visit(f) as FunctionDefinitionNode);
    return node;
  }

  visitContract(node: ContractNode): Node {
    const prev = this.mappingNames;
    // Mappings are modelled as collections (entry-backed state); a mapping-typed state var also carries the type.
    this.mappingNames = new Set([
      ...node.collections.map((c) => c.name),
      ...node.stateVariables.filter((sv) => sv.type instanceof MappingType).map((sv) => sv.name),
    ]);
    const prevState = this.stateVarTypes;
    this.stateVarTypes = new Map(node.stateVariables.map((sv) => [sv.name, sv.type]));
    node.functions = node.functions.map((f) => this.visit(f) as FunctionDefinitionNode);
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    this.mappingNames = prev;
    this.stateVarTypes = prevState;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    const prev = this.varTypes;
    this.varTypes = new Map(prev);
    for (const p of node.parameters) this.varTypes.set(p.name, p.type);
    node.body = this.visit(node.body) as BlockNode;
    this.varTypes = prev;
    return node;
  }

  visitBlock(node: BlockNode): Node {
    const out: StatementNode[] = [];
    const stmts = node.statements ?? [];
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i];
      if (s instanceof VariableDefinitionNode) this.varTypes.set(s.name, s.type);
      // The AstBuilder desugars `for` into a flattened `{ init; while }`: a loop-variable definition immediately
      // followed by its while (marked forLoopUpdateCount for the trailing update statement).
      if (s instanceof VariableDefinitionNode && s.isLoopVariable
        && i + 1 < stmts.length && stmts[i + 1] instanceof WhileNode
        && (stmts[i + 1] as WhileNode).forLoopUpdateCount > 0) {
        const unrolled = this.tryUnroll(s, stmts[i + 1] as WhileNode);
        if (unrolled) {
          out.push(...unrolled);
          i += 1; // consume the while
          continue;
        }
      }
      out.push(this.visit(s) as StatementNode);
    }
    node.statements = out;
    return node;
  }

  private tryUnroll(init: VariableDefinitionNode, w: WhileNode): StatementNode[] | undefined {
    const varName = init.name;
    if (!(init.expression instanceof IntLiteralNode)) return undefined;
    const c0 = init.expression.value;

    // Condition: `i < CN` or `i <= CN`, CN a compile-time constant.
    const cond = w.condition;
    if (!(cond instanceof BinaryOpNode)) return undefined;
    if (cond.operator !== BinaryOperator.LT && cond.operator !== BinaryOperator.LE) return undefined;
    if (!(cond.left instanceof IdentifierNode && cond.left.name === varName)) return undefined;
    const cn = this.evalBound(cond.right);
    if (cn === undefined) return undefined;
    const inclusive = cond.operator === BinaryOperator.LE;

    // Update: the trailing forLoopUpdateCount statements, expected exactly `i = i + STEP`.
    const k = w.forLoopUpdateCount;
    const all = w.block.statements ?? [];
    if (k >= all.length) return undefined;
    const bodyStmts = all.slice(0, all.length - k);
    const step = this.evalStep(all.slice(all.length - k), varName);
    if (step === undefined || step <= 0n) return undefined;

    // Only unroll loops that actually write a mapping OR call keccak256 (else needless). A keccak256 in a
    // runtime loop needs one compute side-car per RUNTIME call, but the block layout allocates one per SYNTACTIC
    // call; unrolling a fixed-bound loop turns the N runtime calls into N syntactic calls (each an independent
    // slot, resolved by the complex-arg probe). Never unroll with break/continue/return (changes control flow).
    if (!this.hasMappingWrite(bodyStmts) && !this.hasKeccakCall(bodyStmts) && !this.hasEcrecoverCall(bodyStmts)) return undefined;
    if (this.hasControlFlowEscape(bodyStmts)) return undefined;

    // Enumerate the iteration values; bail if unbounded or larger than MAX_UNROLL.
    const values: bigint[] = [];
    for (let v = c0; inclusive ? v <= cn : v < cn; v += step) {
      values.push(v);
      if (values.length > MAX_UNROLL) return undefined;
    }

    // Each iteration is wrapped in its own block so body-local declarations (`address user = ...`) don't collide
    // across the N copies (Solidity block scoping). The loop variable is substituted by its per-iteration literal.
    const result: StatementNode[] = [];
    for (const v of values) {
      const iterStmts: StatementNode[] = [];
      for (const st of bodyStmts) {
        const clone = cloneNode(st);
        this.substituteVar(clone, varName, v);
        iterStmts.push(clone);
      }
      const block = new BlockNode(iterStmts);
      block.location = w.block.location;
      result.push(this.visit(block) as StatementNode); // recurse into the wrapped body (nested loops)
    }
    return result;
  }

  // A compile-time-constant loop bound: an int literal, or `fixedArray.length` (a declared ArrayType with a bound).
  private evalBound(expr: Node): bigint | undefined {
    if (expr instanceof IntLiteralNode) return expr.value;
    if (expr instanceof UnaryOpNode && expr.operator === UnaryOperator.SIZE
      && expr.expression instanceof IdentifierNode) {
      const t = this.varTypes.get(expr.expression.name) ?? this.stateVarTypes.get(expr.expression.name);
      if (t instanceof ArrayType && t.bound !== undefined) return BigInt(t.bound);
    }
    return undefined;
  }

  // Constant step from `i = i + STEP` (the desugared form of `i++` / `i += STEP`).
  private evalStep(post: StatementNode[], varName: string): bigint | undefined {
    if (post.length !== 1) return undefined;
    const p = post[0];
    if (!(p instanceof AssignNode)) return undefined;
    if (!(p.identifier instanceof IdentifierNode && p.identifier.name === varName)) return undefined;
    const e = p.expression;
    if (!(e instanceof BinaryOpNode && e.operator === BinaryOperator.PLUS)) return undefined;
    if (e.left instanceof IdentifierNode && e.left.name === varName && e.right instanceof IntLiteralNode) {
      return e.right.value;
    }
    if (e.right instanceof IdentifierNode && e.right.name === varName && e.left instanceof IntLiteralNode) {
      return e.left.value;
    }
    return undefined;
  }

  private hasMappingWrite(stmts: Node[]): boolean {
    return this.anyNode(stmts, (n) => n instanceof ArrayAssignNode && this.mappingNames.has(n.name));
  }

  private hasKeccakCall(stmts: Node[]): boolean {
    return this.anyNode(stmts, (n) => n instanceof FunctionCallNode && n.identifier.name === GlobalFunction.KECCAK256);
  }

  // A fixed-bound ecrecoverPubKey/P2pkh/Evm loop unrolls to N syntactic calls (N recovery pairs, each its own slot);
  // the loop variable substitution turns h[i] into h[0], h[1], ... which the SDK co-spend resolves per array element.
  private hasEcrecoverCall(stmts: Node[]): boolean {
    return this.anyNode(stmts, (n) => n instanceof FunctionCallNode && (
      n.identifier.name === GlobalFunction.ECRECOVER_PUBKEY
      || n.identifier.name === GlobalFunction.ECRECOVER_P2PKH
      || n.identifier.name === GlobalFunction.ECRECOVER_EVM));
  }

  private hasControlFlowEscape(stmts: Node[]): boolean {
    return this.anyNode(stmts, (n) => n instanceof BreakNode || n instanceof ContinueNode || n instanceof ReturnNode);
  }

  private anyNode(stmts: Node[], pred: (n: Node) => boolean): boolean {
    let found = false;
    const walk = (n: Node): void => {
      if (found || !n) return;
      if (pred(n)) { found = true; return; }
      for (const key of Object.keys(n)) {
        if (key === 'location') continue;
        const v = (n as unknown as Record<string, unknown>)[key];
        if (v instanceof Node) walk(v);
        else if (Array.isArray(v)) for (const e of v) if (e instanceof Node) walk(e);
      }
    };
    for (const s of stmts) walk(s);
    return found;
  }

  private substituteVar(node: Node, varName: string, value: bigint): void {
    const replace = (v: unknown): Node | undefined => {
      if (v instanceof IdentifierNode && v.name === varName) {
        const lit = new IntLiteralNode(value);
        lit.location = v.location;
        return lit;
      }
      return undefined;
    };
    for (const key of Object.keys(node)) {
      if (key === 'location') continue;
      const v = (node as unknown as Record<string, unknown>)[key];
      const rep = replace(v);
      if (rep) {
        (node as unknown as Record<string, unknown>)[key] = rep;
      } else if (v instanceof Node) {
        this.substituteVar(v, varName, value);
      } else if (Array.isArray(v)) {
        for (let j = 0; j < v.length; j++) {
          const r = replace(v[j]);
          if (r) v[j] = r;
          else if (v[j] instanceof Node) this.substituteVar(v[j], varName, value);
        }
      }
    }
  }
}
