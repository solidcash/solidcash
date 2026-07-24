import {
  ArrayType, BytesType, MappingType, PrimitiveType, StructType, Type,
} from '@solidcash/utils';
import {
  AssignNode, BranchNode, ContractNode, FunctionDefinitionNode, FunctionModifier, IdentifierNode, Node,
  SourceFileNode, TupleAssignmentNode, VariableDefinitionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { Modifier } from '../ast/Globals.js';
import { InvalidDataLocationError, InvalidModifierCombinationError } from '../Errors.js';

type Context = 'parameter' | 'return' | 'local';

/** Validate Solidity data-location and function-modifier rules before any lowering erases storage pointers. */
export default class ValidateDataLocations extends AstTraversal {
  private currentFunction?: FunctionDefinitionNode;
  private currentContractIsAbstract = false;
  private bindingLocations = new Map<string, string>();
  private calldataLocals = new Set<string>();
  private initializedCalldataLocals = new Set<string>();

  visitSourceFile(node: SourceFileNode): Node {
    node.freeFunctions = this.visitList(node.freeFunctions) as FunctionDefinitionNode[];
    node.importedContracts = this.visitList(node.importedContracts) as ContractNode[];
    node.contract = this.visit(node.contract) as ContractNode;
    return node;
  }

  visitContract(node: ContractNode): Node {
    const previousAbstract = this.currentContractIsAbstract;
    this.currentContractIsAbstract = node.isAbstract;
    if (node.constructorDef) node.constructorDef = this.visit(node.constructorDef) as FunctionDefinitionNode;
    node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    if (node.fallbackDef) node.fallbackDef = this.visit(node.fallbackDef) as FunctionDefinitionNode;
    if (node.receiveDef) node.receiveDef = this.visit(node.receiveDef) as FunctionDefinitionNode;
    this.currentContractIsAbstract = previousAbstract;
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
        node.isLibraryFunction, isConstructor && this.currentContractIsAbstract);
    }
    node.returnTypes.forEach((type, i) => {
      this.validateLocation(type, node.returnModifiers[i] ?? [], node, 'return', visibility, false,
        node.isLibraryFunction);
    });
    const previous = this.currentFunction;
    const previousLocations = this.bindingLocations;
    const previousCalldataLocals = this.calldataLocals;
    const previousInitializedCalldataLocals = this.initializedCalldataLocals;
    this.currentFunction = node;
    this.bindingLocations = new Map(node.parameters.map((parameter) => [
      parameter.name,
      this.locations(parameter.modifier)[0],
    ]));
    this.calldataLocals = new Set();
    this.initializedCalldataLocals = new Set();
    node.body = this.visit(node.body) as typeof node.body;
    this.currentFunction = previous;
    this.bindingLocations = previousLocations;
    this.calldataLocals = previousCalldataLocals;
    this.initializedCalldataLocals = previousInitializedCalldataLocals;
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    this.validateLocation(node.type, node.modifier, node, 'local', this.currentFunction?.visibility, false);
    const location = this.locations(node.modifier)[0];
    if (location === Modifier.CALLDATA && node.expression instanceof IdentifierNode
      && this.bindingLocations.get(node.expression.name) !== Modifier.CALLDATA) {
      throw new InvalidDataLocationError(node,
        `cannot initialize calldata local '${node.name}' from non-calldata binding '${node.expression.name}'`);
    }
    const visited = super.visitVariableDefinition(node) as VariableDefinitionNode;
    this.bindingLocations.set(node.name, location);
    if (location === Modifier.CALLDATA) {
      this.calldataLocals.add(node.name);
      if (node.expression) this.initializedCalldataLocals.add(node.name);
    }
    return visited;
  }

  visitAssign(node: AssignNode): Node {
    if (this.bindingLocations.get(node.identifier.name) === Modifier.CALLDATA
      && node.expression instanceof IdentifierNode
      && this.bindingLocations.get(node.expression.name) !== Modifier.CALLDATA) {
      throw new InvalidDataLocationError(node,
        `cannot rebind calldata local '${node.identifier.name}' from non-calldata binding '${node.expression.name}'`);
    }
    node.expression = this.visit(node.expression);
    if (this.calldataLocals.has(node.identifier.name)) {
      this.initializedCalldataLocals.add(node.identifier.name);
    } else {
      node.identifier = this.visit(node.identifier) as IdentifierNode;
    }
    return node;
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    const visited = super.visitTupleAssignment(node) as TupleAssignmentNode;
    for (const element of node.elements) {
      if (element.existing && element.name && this.calldataLocals.has(element.name)) {
        this.initializedCalldataLocals.add(element.name);
      }
    }
    return visited;
  }

  visitIdentifier(node: IdentifierNode): Node {
    if (this.calldataLocals.has(node.name) && !this.initializedCalldataLocals.has(node.name)) {
      throw new InvalidDataLocationError(node,
        `calldata local '${node.name}' may be read before it is initialized`);
    }
    return node;
  }

  visitBranch(node: BranchNode): Node {
    node.condition = this.visit(node.condition);
    const localsBefore = new Set(this.calldataLocals);
    const initializedBefore = new Set(this.initializedCalldataLocals);
    node.ifBlock = this.visit(node.ifBlock) as typeof node.ifBlock;
    const initializedIf = new Set(this.initializedCalldataLocals);

    this.calldataLocals = new Set(localsBefore);
    this.initializedCalldataLocals = new Set(initializedBefore);
    if (node.elseBlock) node.elseBlock = this.visit(node.elseBlock) as typeof node.elseBlock;
    const initializedElse = new Set(this.initializedCalldataLocals);

    this.calldataLocals = localsBefore;
    this.initializedCalldataLocals = new Set(
      [...initializedIf].filter((name) => initializedElse.has(name)),
    );
    return node;
  }

  private isReferenceType(type: Type): boolean {
    return type instanceof ArrayType || type instanceof MappingType || type instanceof StructType
      || (type instanceof BytesType && type.bound === undefined) || type === PrimitiveType.STRING;
  }

  private containsMapping(type: Type): boolean {
    return type instanceof MappingType
      || (type instanceof ArrayType && this.containsMapping(type.elementType));
  }

  private locations(modifiers: string[]): string[] {
    return modifiers.filter((m) => m === Modifier.MEMORY || m === Modifier.CALLDATA || m === Modifier.STORAGE);
  }

  private validateLocation(type: Type, modifiers: string[], node: Node, context: Context, visibility?: string,
    isConstructor = false, isLibraryFunction = false, isAbstractConstructor = false): void {
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
      if (this.containsMapping(type) && location !== Modifier.STORAGE) {
        throw new InvalidDataLocationError(node, "mapping-containing locals must have 'storage' location");
      }
      return;
    }
    if (context === 'return') {
      if (location === Modifier.STORAGE && !isLibraryFunction
        && visibility !== 'internal' && visibility !== 'private') {
        throw new InvalidDataLocationError(node,
          "'storage' return parameters are only valid on internal or private functions");
      }
      if (this.containsMapping(type) && location !== Modifier.STORAGE) {
        throw new InvalidDataLocationError(node, "mapping-containing return parameters must have 'storage' location");
      }
      return;
    }
    if (isConstructor && location === Modifier.CALLDATA) {
      throw new InvalidDataLocationError(node, "constructor parameters cannot have 'calldata' location");
    }
    if (location === Modifier.STORAGE && !isLibraryFunction && !isAbstractConstructor
      && visibility !== 'internal' && visibility !== 'private') {
      throw new InvalidDataLocationError(node,
        "'storage' parameters are only valid on internal or private functions");
    }
    if (this.containsMapping(type) && location !== Modifier.STORAGE) {
      throw new InvalidDataLocationError(node, "mapping-containing parameters must have 'storage' location");
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
    // Solidity retains a legacy exception for externally callable functions named `this`, `super`, or `_`
    // (their ABI selectors are unambiguous), but reserves those names for internal/private functions.
    if (['_', 'super', 'this'].includes(node.name)
      && (node.visibility === 'internal' || node.visibility === 'private')) {
      throw new InvalidModifierCombinationError(
        node,
        `function name '${node.name}' is reserved for internal/private functions`,
      );
    }
  }
}
