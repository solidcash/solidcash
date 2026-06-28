import { Type } from '@solidcash/utils';
import {
  VariableDefinitionNode,
  ParameterNode,
  IdentifierNode,
  Node,
  StateVariableNode,
  ConstantDefinitionNode,
} from './AST.js';

export class Symbol {
  references: IdentifierNode[] = [];
  private constructor(
    public name: string,
    public type: Type,
    public symbolType: SymbolType,
    public definition?: Node,
    public parameters?: Type[],
  ) {}

  static variable(node: VariableDefinitionNode | ParameterNode): Symbol {
    return new Symbol(node.name, node.type, SymbolType.VARIABLE, node);
  }

  static global(name: string, type: Type): Symbol {
    return new Symbol(name, type, SymbolType.VARIABLE);
  }

  static function(name: string, type: Type, parameters: Type[]): Symbol {
    return new Symbol(name, type, SymbolType.FUNCTION, undefined, parameters);
  }

  static class(name: string, type: Type, parameters: Type[]): Symbol {
    return new Symbol(name, type, SymbolType.CLASS, undefined, parameters);
  }

  static stateVariable(node: StateVariableNode): Symbol {
    return new Symbol(node.name, node.type, SymbolType.STATE_VARIABLE, node);
  }

  static constant(node: ConstantDefinitionNode): Symbol {
    return new Symbol(node.name, node.type, SymbolType.CONSTANT, node);
  }

  static enumType(name: string, type: Type): Symbol {
    return new Symbol(name, type, SymbolType.CONSTANT);
  }

  toString(): string {
    let str = `${this.type} ${this.name}`;
    if (this.parameters) {
      str += ` (${this.parameters})`;
    }
    return str;
  }
}

export enum SymbolType {
  VARIABLE = 'variable',
  FUNCTION = 'function',
  CLASS = 'class',
  STATE_VARIABLE = 'state_variable',
  CONSTANT = 'constant',
}

export class SymbolTable {
  symbols: Map<String, Symbol> = new Map<String, Symbol>();

  constructor(
    public parent?: SymbolTable,
  ) {}

  set(symbol: Symbol): void {
    this.symbols.set(symbol.name, symbol);
  }

  get(name: string): Symbol | undefined {
    return this.symbols.get(name) ?? this.parent?.get(name);
  }

  getFromThis(name: string): Symbol | undefined {
    return this.symbols.get(name);
  }

  toString(): string {
    return `[${Array.from(this.symbols).map((e) => e[1])}]`;
  }

  unusedSymbols(): Symbol[] {
    return Array.from(this.symbols)
      .map((e) => e[1])
      .filter((s) => s.references.length === 0 && s.definition !== undefined
        && !(s.definition as { forwardedToLibrary?: boolean }).forwardedToLibrary);
  }
}
