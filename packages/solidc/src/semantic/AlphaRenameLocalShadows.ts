import {
  Node,
  FunctionDefinitionNode,
  BlockNode,
  VariableDefinitionNode,
  IdentifierNode,
  ArrayPushNode,
  ArrayPopNode,
  ArrayAssignNode,
  ArrayDeleteNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';

/**
 * Give a local that shadows an outer local/parameter a unique target-stack name.
 *
 * Solidity scopes the new binding only after its initializer, so `uint x = x;` reads the OUTER x and subsequent
 * references read the inner one. Symbol analysis already has lexical scopes, but target codegen addresses stack
 * locals by name; alpha-renaming removes that representation collision without changing source semantics.
 */
export default class AlphaRenameLocalShadows extends AstTraversal {
  private scopes: Map<string, string>[] = [];
  private blockDepth = -1;
  private counter = 0;

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (!node.body) return node;
    const savedScopes = this.scopes;
    const savedDepth = this.blockDepth;
    this.scopes = [new Map(node.parameters.map((parameter) => [parameter.name, parameter.name]))];
    this.blockDepth = -1;
    node.body = this.visit(node.body) as BlockNode;
    this.scopes = savedScopes;
    this.blockDepth = savedDepth;
    return node;
  }

  visitBlock(node: BlockNode): Node {
    this.blockDepth += 1;
    this.scopes.push(new Map());
    node.statements = this.visitOptionalList(node.statements) as typeof node.statements;
    this.scopes.pop();
    this.blockDepth -= 1;
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    // The initializer is evaluated before the declaration enters scope.
    if (node.expression) node.expression = this.visit(node.expression);
    const sourceName = node.name;
    const shadows = this.resolve(sourceName) !== undefined;
    // Same-function-body declarations retain the normal duplicate diagnostic. Only a genuinely nested lexical
    // block may shadow an active binding.
    const targetName = shadows && this.blockDepth > 0
      ? `__shadow_${sourceName}_${this.counter++}` : sourceName;
    node.name = targetName;
    this.scopes[this.scopes.length - 1].set(sourceName, targetName);
    return node;
  }

  visitIdentifier(node: IdentifierNode): Node {
    const renamed = this.resolve(node.name);
    if (renamed) node.name = renamed;
    return node;
  }

  // Local-array operations carry their base as a string rather than an IdentifierNode.
  visitArrayPush(node: ArrayPushNode): Node {
    node.name = this.resolve(node.name) ?? node.name;
    node.value = this.visit(node.value);
    return node;
  }

  visitArrayPop(node: ArrayPopNode): Node {
    node.name = this.resolve(node.name) ?? node.name;
    return node;
  }

  visitArrayAssign(node: ArrayAssignNode): Node {
    node.name = this.resolve(node.name) ?? node.name;
    node.index = this.visit(node.index);
    node.value = this.visit(node.value);
    return node;
  }

  visitArrayDelete(node: ArrayDeleteNode): Node {
    node.name = this.resolve(node.name) ?? node.name;
    node.index = this.visit(node.index);
    return node;
  }

  private resolve(name: string): string | undefined {
    for (let index = this.scopes.length - 1; index >= 0; index -= 1) {
      const resolved = this.scopes[index].get(name);
      if (resolved !== undefined) return resolved;
    }
    return undefined;
  }
}
