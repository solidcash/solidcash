
import AstTraversal from '../ast/AstTraversal.js';
import {
  CastNode,
  ExpressionNode,
  FunctionCallNode,
  IdentifierNode,
  InstantiationNode,
  MethodCallStatementNode,
  Node,
  NullaryOpNode,
  TypeIntrospectionNode,
  UnaryOpNode,
  VariableDefinitionNode,
  BlockNode,
  ContractNode,
  FunctionDefinitionNode,
} from '../ast/AST.js';
import { NullaryOperator } from '../ast/Operator.js';
import type { ArgSource } from '@solidcash/utils';
import { SolidcDiagnosticError } from '../Errors.js';

/** One contract a framed master creates with CREATE2, published so a builder can stand the child up at its address. */
export interface FramedCreateSite {
  /** The child contract's name, the artifact a builder deploys, for a creation from `type(C).creationCode`. */
  readonly contractName?: string;
  /**
   * For a creation from a code value the contract holds, the state variable holding it: the child's identity
   * commits to the value's keccak256, and a builder stands up the artifact its template table names for that hash.
   */
  readonly codeStateVariable?: string;
  /**
   * The initializer the creating body calls on the child it just created (`IChild(child).initialize(...)`). The
   * creating frame cannot run it — a child's masters are minted by this transaction, not spent by it — so a builder
   * folds its effects into the child's genesis state. Filled by {@link LowerFramedCreate2Address}, with the call's
   * argument sources added after semantic analysis.
   */
  initializer?: FramedCreateInitializer;
  /** The initializer's published call, filled once the call's argument sources are known. */
  foldedCall?: FramedFoldedCall;
}

/** The initializer call a creator folds into its child's genesis. */
export interface FramedCreateInitializer {
  readonly interfaceName: string;
  readonly functionName: string;
  /** The creating frame's local that holds the created child's address. */
  readonly targetLocal: string;
}

/** The folded initializer's argument sources, in parameter order. */
export interface FramedFoldedCall {
  readonly interfaceName: string;
  readonly functionName: string;
  readonly argumentSources: readonly ArgSource[];
}

/**
 * A framed master's `new C{salt: s}()` as the address the EVM's CREATE2 gives the child.
 *
 * Under the framed convention a contract's frames carry its address as `self`, and a caller binds the callee it names
 * to that value byte for byte. An EVM program names a CREATE2 child by the identity
 * `keccak256(0xff ++ deployer ++ salt ++ keccak256(initCode))[12:]`, and it may compute that identity again without
 * asking the creator (`UniswapV2Library.pairFor`). The child created here therefore presents exactly that 20-byte
 * identity, and the creating body computes it the same way any other body would: from its own address, the salt and
 * the hash of the child's creation code. The value of the expression is the identity, which is what the creator
 * stores, emits and calls.
 *
 * The child's frames run on masters of their own, so the transaction that creates it cannot also run them. The
 * builder stands the child up beforehand, with the creator as the sender its constructor sees and the identity as
 * its address, and the creating body calls it like any other contract. The child's creation code is published on
 * the artifact (`composition.creates`) so the builder knows which contract the address is for.
 *
 * Only the salted form is lowered. A plain `new C()` derives its address from the creator's nonce, which a framed
 * master does not hold, and a creation that carries value or constructor arguments has no builder support yet; each
 * is refused by name. A `type(C).creationCode` local the lowered creation was the only reader of is removed, so the
 * child's program is not embedded in the creator's.
 */
export default class LowerFramedCreate2Address extends AstTraversal {
  public readonly creates: FramedCreateSite[] = [];
  /** The state variables of the contract being lowered. */
  private stateVariables = new Set<string>();
  /** The initializers of the locals the function being lowered declares, by name. */
  private localInitializers = new Map<string, ExpressionNode | undefined>();

  visitContract(node: ContractNode): Node {
    this.stateVariables = new Set(node.stateVariables.map((variable) => variable.name));
    return super.visitContract(node);
  }

  /**
   * `IChild(created).initialize(...)` right after the creation: recorded on the create site, so the fold can drop the
   * call once its argument sources are published. The creating frame's own code cannot run the child's frame: the
   * child's masters are outputs of this transaction.
   */
  visitMethodCallStatement(node: MethodCallStatementNode): Node {
    const call = node.call;
    const object = call.object;
    if (call.methodName !== undefined && object instanceof FunctionCallNode
      && object.identifier instanceof IdentifierNode
      && object.parameters.length === 1 && object.parameters[0] instanceof IdentifierNode) {
      const interfaceName = object.identifier.name;
      const targetLocal = object.parameters[0].name;
      const childName = interfaceName.replace(/^I(?=[A-Z])/, '');
      const site = this.creates.find((candidate) => candidate.contractName === childName
        || candidate.contractName === interfaceName);
      if (site !== undefined && site.initializer === undefined) {
        site.initializer = { interfaceName, functionName: call.methodName, targetLocal };
      }
    }
    return super.visitMethodCallStatement(node);
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    this.localInitializers = new Map();
    if (node.body !== undefined) collectLocalInitializers(node.body, this.localInitializers);
    const visited = super.visitFunctionDefinition(node) as FunctionDefinitionNode;
    if (visited.body !== undefined) dropUnreadCreationCodeLocals(visited.body);
    return visited;
  }

  /**
   * A `create2` over a code value the contract holds, which the Yul lowering left as the direct convention's address
   * (`CastNode.runtimeCreate2`), as the child's EVM identity: `keccak256(0xff ++ creator ++ salt ++ keccak256(code))`.
   * An EVM program names such a child by the hash of the code it was given (`UniswapV2Library.pairFor`), so the
   * identity hashes the value the creator holds. The code is published by the state variable holding it, which a
   * builder reads to choose the artifact it stands up; a code value no state variable holds is refused by name.
   */
  visitCast(node: CastNode): Node {
    const created = node.runtimeCreate2;
    if (created === undefined) return super.visitCast(node);
    const codeStateVariable = this.codeStateVariableOf(created.code);
    if (codeStateVariable === undefined) {
      throw new SolidcDiagnosticError(
        'FRAMED_CODEGEN_UNAVAILABLE',
        '`create2` over a code value that no state variable holds has no code a builder can read to stand the '
        + 'child up',
        { requested: 'framed', reason: 'create2-runtime-code-source' },
      );
    }
    if (!this.creates.some((site) => site.codeStateVariable === codeStateVariable)) {
      this.creates.push({ codeStateVariable });
    }
    return childAddressValue(node);
  }

  /** The state variable a code value is read from: the variable itself, or a local initialized from it. */
  private codeStateVariableOf(code: ExpressionNode): string | undefined {
    if (!(code instanceof IdentifierNode)) return undefined;
    if (this.stateVariables.has(code.name)) return code.name;
    const initializer = this.localInitializers.get(code.name);
    return initializer instanceof IdentifierNode && this.stateVariables.has(initializer.name)
      ? initializer.name : undefined;
  }

  visitInstantiation(node: InstantiationNode): Node {
    const childName = node.identifier.name;
    const salt = node.callOptions?.salt;
    if (salt === undefined) {
      throw new SolidcDiagnosticError(
        'FRAMED_CODEGEN_UNAVAILABLE',
        `'new ${childName}()' takes its address from the creator's nonce, which a framed master does not hold; `
        + 'create the child with a salt (`new C{salt: s}()`)',
        { requested: 'framed', reason: 'create-without-salt' },
      );
    }
    if (node.callOptions?.value !== undefined || node.parameters.length > 0) {
      throw new SolidcDiagnosticError(
        'FRAMED_CODEGEN_UNAVAILABLE',
        `'new ${childName}{salt: ...}(...)' carries value or constructor arguments, which a framed creation does `
        + 'not stand up yet',
        { requested: 'framed', reason: 'create-with-arguments' },
      );
    }
    if (!this.creates.some((site) => site.contractName === childName)) this.creates.push({ contractName: childName });
    return childAddressValue(node);
  }
}

/**
 * The address the creation leaves: `addrV(K)`, which the creating body computes from the transaction's leading coin
 * (docs/framed/CREATE2_IDENTITY.md). The salt and the code no longer name the child; the coin's outpoint does.
 */
function childAddressValue(source: Node): ExpressionNode {
  return withLocation(new NullaryOpNode(NullaryOperator.CHILD_ADDRESS), source);
}

/** `created`, placed at `source`'s location. */
function withLocation<T extends Node>(created: T, source: Node): T {
  created.location = source.location;
  return created;
}

/** Records each local `body` declares with the expression it is initialized from. */
function collectLocalInitializers(body: BlockNode, into: Map<string, ExpressionNode | undefined>): void {
  const visit = (current: Node): void => {
    if (current instanceof VariableDefinitionNode) into.set(current.name, current.expression);
    for (const value of Object.values(current)) {
      if (value instanceof Node) visit(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) visit(item);
    }
  };
  visit(body);
}

/** Removes `bytes code = type(C).creationCode` locals nothing reads any more. */
function dropUnreadCreationCodeLocals(body: BlockNode): void {
  const reads = new Set<string>();
  const countReads = (current: Node): void => {
    if (current instanceof IdentifierNode) reads.add(current.name);
    for (const value of Object.values(current)) {
      if (value instanceof Node) countReads(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) countReads(item);
    }
  };
  const prune = (block: BlockNode): void => {
    if (block.statements === undefined) return;
    block.statements = block.statements.filter((statement) => !(statement instanceof VariableDefinitionNode
      && statement.expression instanceof TypeIntrospectionNode
      && statement.expression.property === 'creationCode'
      && !reads.has(statement.name)));
    for (const statement of block.statements) {
      walkBlocks(statement, prune);
    }
  };
  countReads(body);
  prune(body);
}

/** Visits every block nested in `node`. */
function walkBlocks(node: Node, visit: (block: BlockNode) => void): void {
  for (const value of Object.values(node)) {
    if (value instanceof BlockNode) visit(value);
    else if (value instanceof Node) walkBlocks(value, visit);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof BlockNode) visit(item);
        else if (item instanceof Node) walkBlocks(item, visit);
      }
    }
  }
}
