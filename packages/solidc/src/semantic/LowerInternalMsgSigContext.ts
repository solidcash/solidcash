import { BytesType, computeFunctionSelector, computeFunctionSignature } from '@solidcash/utils';
import {
  ContractNode,
  FunctionCallNode,
  FunctionDefinitionNode,
  HexLiteralNode,
  IdentifierNode,
  Node,
  NullaryOpNode,
  ParameterNode,
  SourceFileNode,
} from '../ast/AST.js';
import { NullaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';

const CONTEXT = '__internal__msgSig';

/**
 * Threads the originating external/public selector through direct internal/private call chains that read msg.sig.
 * Overloaded pre-semantic targets remain untouched rather than being guessed by name.
 */
export default class LowerInternalMsgSigContext extends AstTraversal {
  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const unique = new Map<string, FunctionDefinitionNode>();
    const duplicates = new Set<string>();
    for (const fn of node.functions) {
      if (unique.has(fn.name)) duplicates.add(fn.name);
      else unique.set(fn.name, fn);
    }
    for (const name of duplicates) unique.delete(name);

    const internal = new Set([...unique.values()]
      .filter((fn) => fn.visibility === 'internal' || fn.visibility === 'private')
      .map((fn) => fn.name));
    const tainted = new Set([...internal].filter((name) => this.readsMsgSig(unique.get(name)!)));
    for (let changed = true; changed;) {
      changed = false;
      for (const name of internal) {
        if (tainted.has(name) || !this.callsAny(unique.get(name)!, tainted)) continue;
        tainted.add(name);
        changed = true;
      }
    }
    if (tainted.size === 0) return node;

    for (const name of tainted) {
      const fn = unique.get(name)!;
      const context = new ParameterNode(new BytesType(4), CONTEXT);
      context.location = fn.location;
      context.syntheticallyUsed = true;
      fn.parameters.push(context);
      this.replaceMsgSig(fn.body);
    }
    for (const caller of node.functions) this.rewriteCalls(caller.body, caller, unique, tainted);
    return node;
  }

  private selector(fn: FunctionDefinitionNode, src: Node): HexLiteralNode {
    const types = fn.parameters
      .filter((p) => p.name !== '__internal__msgData' && p.name !== CONTEXT)
      .map((p) => p.type.toString().replace(/address payable/g, 'address'));
    const value = new HexLiteralNode(computeFunctionSelector(computeFunctionSignature(fn.name, types)));
    value.type = new BytesType(4);
    value.location = src.location;
    return value;
  }

  private rewriteCalls(
    node: Node | undefined,
    caller: FunctionDefinitionNode,
    unique: Map<string, FunctionDefinitionNode>,
    tainted: Set<string>,
  ): void {
    if (!node) return;
    if (node instanceof FunctionCallNode && tainted.has(node.identifier.name)
      && unique.has(node.identifier.name)) {
      const value = tainted.has(caller.name) ? new IdentifierNode(CONTEXT) : this.selector(caller, node);
      value.location = node.location;
      node.parameters.push(value);
    }
    this.children(node, (child) => this.rewriteCalls(child, caller, unique, tainted));
  }

  private callsAny(fn: FunctionDefinitionNode, names: Set<string>): boolean {
    let found = false;
    this.walk(fn.body, (node) => {
      if (node instanceof FunctionCallNode && names.has(node.identifier.name)) found = true;
    });
    return found;
  }

  private readsMsgSig(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (node) => {
      if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_SIG) found = true;
    });
    return found;
  }

  private replaceMsgSig(node: Node | undefined): void {
    if (!node) return;
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location'
        || key === 'resolvedFunction' || key === 'definition' || key === 'namedOverloadCandidates') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof NullaryOpNode && value.operator === NullaryOperator.MSG_SIG) {
        const read = new IdentifierNode(CONTEXT);
        read.location = value.location;
        (node as unknown as Record<string, unknown>)[key] = read;
      } else if (value instanceof Node) {
        this.replaceMsgSig(value);
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          const item = value[i];
          if (item instanceof NullaryOpNode && item.operator === NullaryOperator.MSG_SIG) {
            const read = new IdentifierNode(CONTEXT);
            read.location = item.location;
            value[i] = read;
          } else if (item instanceof Node) this.replaceMsgSig(item);
        }
      }
    }
  }

  private children(node: Node, visit: (node: Node) => void): void {
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location'
        || key === 'resolvedFunction' || key === 'definition' || key === 'namedOverloadCandidates') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof Node) visit(value);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) visit(item);
    }
  }

  private walk(node: Node | undefined, visit: (node: Node) => void): void {
    if (!node) return;
    visit(node);
    this.children(node, (child) => this.walk(child, visit));
  }
}
