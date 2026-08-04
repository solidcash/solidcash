import { BytesType, computeFunctionSelector, computeFunctionSignature } from '@solidcash/utils';
import {
  AbiEncodeWithSelectorNode,
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

const CONTEXT = '__internal__msgData';

/**
 * Threads the original entry calldata through direct internal/private calls that read `msg.data`.
 *
 * OP_INVOKE changes OP_ACTIVEBYTECODE, so an internal subroutine cannot reconstruct the entry unlocking
 * bytecode itself. A compiler-only bytes parameter carries the value instead. Public/external callers construct
 * `selector ++ abi.encode(parameters)`; tainted internal callers forward their own hidden context.
 *
 * This pass is intentionally name-unambiguous: overloaded internal functions are left for semantic call-graph
 * resolution rather than guessed from the pre-semantic AST.
 */
export default class LowerInternalMsgDataContext extends AstTraversal {
  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const unique = new Map<string, FunctionDefinitionNode>();
    const duplicated = new Set<string>();
    for (const fn of node.functions) {
      if (unique.has(fn.name)) duplicated.add(fn.name);
      else unique.set(fn.name, fn);
    }
    for (const name of duplicated) unique.delete(name);

    const internal = new Set(
      [...unique.values()]
        .filter((fn) => fn.visibility === 'internal' || fn.visibility === 'private')
        .map((fn) => fn.name),
    );
    const tainted = new Set<string>();
    for (const name of internal) {
      if (this.readsMsgData(unique.get(name)!)) tainted.add(name);
    }

    // If h() calls tainted g(), h must receive and forward the same entry context.
    for (let changed = true; changed;) {
      changed = false;
      for (const name of internal) {
        if (tainted.has(name)) continue;
        if (this.callsAny(unique.get(name)!, tainted)) {
          tainted.add(name);
          changed = true;
        }
      }
    }
    if (tainted.size === 0) return node;

    for (const name of tainted) {
      const fn = unique.get(name)!;
      const context = new ParameterNode(new BytesType(), CONTEXT, ['memory']);
      context.location = fn.location;
      context.syntheticallyUsed = true;
      fn.parameters.push(context);
      this.replaceMsgData(fn.body);
    }

    for (const caller of node.functions) {
      this.rewriteCalls(caller.body, caller, unique, tainted);
    }
    return node;
  }

  private callsAny(fn: FunctionDefinitionNode, names: Set<string>): boolean {
    let found = false;
    this.walk(fn.body, (node) => {
      if (node instanceof FunctionCallNode && names.has(node.identifier.name)) found = true;
    });
    return found;
  }

  private readsMsgData(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (node) => {
      if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_DATA) found = true;
    });
    return found;
  }

  private entryData(fn: FunctionDefinitionNode, src: Node): AbiEncodeWithSelectorNode {
    const types = fn.parameters.map((p) => p.type.toString().replace(/address payable/g, 'address'));
    const selector = new HexLiteralNode(computeFunctionSelector(computeFunctionSignature(fn.name, types)));
    selector.type = new BytesType(4);
    selector.location = src.location;
    const args = fn.parameters.map((p) => {
      const id = new IdentifierNode(p.name);
      id.location = src.location;
      return id;
    });
    const encoded = new AbiEncodeWithSelectorNode(selector, args);
    encoded.location = src.location;
    return encoded;
  }

  private rewriteCalls(
    node: Node | undefined,
    caller: FunctionDefinitionNode,
    unique: Map<string, FunctionDefinitionNode>,
    tainted: Set<string>,
  ): void {
    if (!node) return;
    if (node instanceof FunctionCallNode && tainted.has(node.identifier.name)
      && unique.get(node.identifier.name)) {
      const value = tainted.has(caller.name)
        ? new IdentifierNode(CONTEXT)
        : this.entryData(caller, node);
      value.location = node.location;
      node.parameters.push(value);
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location'
        || key === 'resolvedFunction' || key === 'definition' || key === 'namedOverloadCandidates') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof Node) this.rewriteCalls(value, caller, unique, tainted);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node) this.rewriteCalls(item, caller, unique, tainted);
      }
    }
  }

  private replaceMsgData(node: Node | undefined): void {
    if (!node) return;
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location'
        || key === 'resolvedFunction' || key === 'definition' || key === 'namedOverloadCandidates') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof NullaryOpNode && value.operator === NullaryOperator.MSG_DATA) {
        const read = new IdentifierNode(CONTEXT);
        read.location = value.location;
        (node as unknown as Record<string, unknown>)[key] = read;
      } else if (value instanceof Node) {
        this.replaceMsgData(value);
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          const item = value[i];
          if (item instanceof NullaryOpNode && item.operator === NullaryOperator.MSG_DATA) {
            const read = new IdentifierNode(CONTEXT);
            read.location = item.location;
            value[i] = read;
          } else if (item instanceof Node) {
            this.replaceMsgData(item);
          }
        }
      }
    }
  }

  private walk(node: Node | undefined, visit: (node: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location'
        || key === 'resolvedFunction' || key === 'definition' || key === 'namedOverloadCandidates') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof Node) this.walk(value, visit);
      else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) this.walk(item, visit);
    }
  }
}
