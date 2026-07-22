import {
  ArrayType, BytesType, MappingType, PrimitiveType, StructType, Type,
} from '@solidcash/utils';
import {
  ContractNode, FunctionDefinitionNode, FunctionModifier, Node, SourceFileNode, VariableDefinitionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { Modifier } from '../ast/Globals.js';
import { InvalidDataLocationError, InvalidModifierCombinationError } from '../Errors.js';

type Context = 'parameter' | 'return' | 'local';

/** Validate Solidity data-location and function-modifier rules before any lowering erases storage pointers. */
export default class ValidateDataLocations extends AstTraversal {
  private currentFunction?: FunctionDefinitionNode;

  visitSourceFile(node: SourceFileNode): Node {
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    this.validateFunctionModifiers(node);
    const isConstructor = node.name === '__construct';
    // File-level and library-inline functions are internal unless explicitly made public/external. The generic
    // AST visibility getter defaults an unmarked function to public because that is correct for contract members.
    const visibility = node.isFreeFunction
      && !node.modifiers.includes(FunctionModifier.PUBLIC) && !node.modifiers.includes(FunctionModifier.EXTERNAL)
      ? 'internal' : node.visibility;
    for (const parameter of node.parameters) {
      this.validateLocation(parameter.type, parameter.modifier, parameter, 'parameter', visibility, isConstructor,
        node.isFreeFunction);
    }
    node.returnTypes.forEach((type, i) => {
      this.validateLocation(type, node.returnModifiers[i] ?? [], node, 'return', visibility, false);
    });
    const previous = this.currentFunction;
    this.currentFunction = node;
    node.body = this.visit(node.body) as typeof node.body;
    this.currentFunction = previous;
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    this.validateLocation(node.type, node.modifier, node, 'local', this.currentFunction?.visibility, false);
    return super.visitVariableDefinition(node);
  }

  private isReferenceType(type: Type): boolean {
    return type instanceof ArrayType || type instanceof MappingType || type instanceof StructType
      || (type instanceof BytesType && type.bound === undefined) || type === PrimitiveType.STRING;
  }

  private locations(modifiers: string[]): string[] {
    return modifiers.filter((m) => m === Modifier.MEMORY || m === Modifier.CALLDATA || m === Modifier.STORAGE);
  }

  private validateLocation(type: Type, modifiers: string[], node: Node, context: Context, visibility?: string,
    isConstructor = false, isLibraryFunction = false): void {
    const locations = this.locations(modifiers);
    if (locations.length === 0) return;
    if (locations.length > 1) {
      throw new InvalidDataLocationError(node, `multiple data locations specified (${locations.join(', ')})`);
    }
    const location = locations[0];
    if (!this.isReferenceType(type)) {
      throw new InvalidDataLocationError(node,
        `data location '${location}' is only valid for reference types, not '${type}'`);
    }
    if (context === 'local') {
      if (location === Modifier.CALLDATA) {
        throw new InvalidDataLocationError(node, "local variables cannot have 'calldata' location");
      }
      if (type instanceof MappingType && location !== Modifier.STORAGE) {
        throw new InvalidDataLocationError(node, "mapping locals must have 'storage' location");
      }
      return;
    }
    if (context === 'return') {
      if (location === Modifier.CALLDATA && visibility !== 'internal' && visibility !== 'private') {
        throw new InvalidDataLocationError(node,
          "'calldata' return parameters are only valid on internal or private functions");
      }
      if (location === Modifier.STORAGE && visibility !== 'internal' && visibility !== 'private') {
        throw new InvalidDataLocationError(node,
          "'storage' return parameters are only valid on internal or private functions");
      }
      if (type instanceof MappingType && location !== Modifier.STORAGE) {
        throw new InvalidDataLocationError(node, "mapping return parameters must have 'storage' location");
      }
      return;
    }
    if (isConstructor && location === Modifier.CALLDATA) {
      throw new InvalidDataLocationError(node, "constructor parameters cannot have 'calldata' location");
    }
    if (location === Modifier.STORAGE && !isLibraryFunction
      && visibility !== 'internal' && visibility !== 'private') {
      throw new InvalidDataLocationError(node,
        "'storage' parameters are only valid on internal or private functions");
    }
    if (type instanceof MappingType && location !== Modifier.STORAGE) {
      throw new InvalidDataLocationError(node, "mapping parameters must have 'storage' location");
    }
  }

  private validateFunctionModifiers(node: FunctionDefinitionNode): void {
    const seen = new Set<FunctionModifier>();
    for (const modifier of node.modifiers) {
      if (seen.has(modifier)) {
        throw new InvalidModifierCombinationError(node, `modifier '${modifier}' specified more than once`);
      }
      seen.add(modifier);
    }
    const visibility = [FunctionModifier.PUBLIC, FunctionModifier.EXTERNAL,
      FunctionModifier.INTERNAL, FunctionModifier.PRIVATE].filter((m) => seen.has(m));
    if (visibility.length > 1) {
      throw new InvalidModifierCombinationError(node,
        `multiple visibility modifiers specified (${visibility.join(', ')})`);
    }
    const mutability = [FunctionModifier.PURE, FunctionModifier.VIEW, FunctionModifier.PAYABLE]
      .filter((m) => seen.has(m));
    if (mutability.length > 1) {
      throw new InvalidModifierCombinationError(node,
        `multiple state mutability modifiers specified (${mutability.join(', ')})`);
    }
  }
}
