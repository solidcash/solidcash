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
  SourceFileNode,
} from '../ast/AST.js';
import { NullaryOperator } from '../ast/Operator.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Reconstructs `msg.data` in an external/public function that is also reached through `this.f(args)`.
 *
 * A Solidity external self-call creates fresh calldata (`selector ++ abi.encode(args)`). SolidCash lowers the
 * call to an OP_INVOKE subroutine, where OP_ACTIVEBYTECODE no longer exposes the entry unlocking bytecode.
 * Replacing the target's `msg.data` reads with the same selector/parameter encoding makes the value independent
 * of whether the function was entered through dispatch or invoked as a self-call.
 *
 * Name-overloaded targets are deliberately left alone until the call has semantic overload metadata; the common
 * unique-name case is unambiguous from the pre-semantic AST and covers the corpus shape without guessing.
 */
export default class LowerSelfCallMsgData extends AstTraversal {
  visitSourceFile(node: SourceFileNode): Node {
    if (node.contract) node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const selfCalledNames = new Set<string>();
    for (const fn of node.functions) {
      this.walk(fn.body, (child) => {
        if (child instanceof FunctionCallNode && child.fromThisCall) {
          selfCalledNames.add(child.identifier.name);
        }
      });
    }

    for (const name of selfCalledNames) {
      const matches = node.functions.filter((fn) => fn.name === name);
      if (matches.length !== 1) continue;
      const target = matches[0];
      if (!this.readsMsgData(target)) continue;
      this.replaceMsgData(target);
    }
    return node;
  }

  private readsMsgData(fn: FunctionDefinitionNode): boolean {
    let found = false;
    this.walk(fn.body, (node) => {
      if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_DATA) found = true;
    });
    return found;
  }

  private replaceMsgData(fn: FunctionDefinitionNode): void {
    const signatureTypes = fn.parameters.map((p) => p.type.toString().replace(/address payable/g, 'address'));
    const selector = computeFunctionSelector(computeFunctionSignature(fn.name, signatureTypes));

    const replacement = (src: NullaryOpNode): AbiEncodeWithSelectorNode => {
      const selectorNode = new HexLiteralNode(selector);
      selectorNode.type = new BytesType(4);
      selectorNode.location = src.location;
      const args = fn.parameters.map((p) => {
        const id = new IdentifierNode(p.name);
        id.location = src.location;
        return id;
      });
      const encoded = new AbiEncodeWithSelectorNode(selectorNode, args);
      encoded.location = src.location;
      return encoded;
    };
    this.replace(fn.body, replacement);
  }

  private replace(node: Node | undefined, make: (src: NullaryOpNode) => Node): void {
    if (!node) return;
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof NullaryOpNode && value.operator === NullaryOperator.MSG_DATA) {
        (node as unknown as Record<string, unknown>)[key] = make(value);
      } else if (value instanceof Node) {
        this.replace(value, make);
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          const item = value[i];
          if (item instanceof NullaryOpNode && item.operator === NullaryOperator.MSG_DATA) {
            value[i] = make(item);
          } else if (item instanceof Node) {
            this.replace(item, make);
          }
        }
      }
    }
  }

  private walk(node: Node | undefined, visit: (node: Node) => void): void {
    if (!node) return;
    visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'symbolTable' || key === 'location') continue;
      const value = (node as unknown as Record<string, unknown>)[key];
      if (value instanceof Node) this.walk(value, visit);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node) this.walk(item, visit);
      }
    }
  }
}
