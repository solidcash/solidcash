import { ImportResolverFn } from '@solidcash/utils';
import { SourceFileNode, ImportNode } from './ast/AST.js';
import { parseCode } from './compiler.js';
import { CircularImportError, UnresolvedImportError, ImportSymbolNotFoundError, UnsafeImportPathError } from './Errors.js';

export class ImportResolver {
  private resolvedFiles = new Map<string, SourceFileNode>();
  private resolving = new Set<string>();

  constructor(private resolver: ImportResolverFn, private solidityImportCompat = false) {}

  resolve(ast: SourceFileNode, currentFileId: string): SourceFileNode {
    for (const importNode of ast.imports) {
      // Basic path traversal sanitization: reject null bytes and paths with
      // excessive parent directory traversal (e.g. "../../../../../../etc/passwd")
      if (importNode.path.includes('\0')) {
        throw new UnsafeImportPathError(importNode.path, currentFileId);
      }

      // Normalize and check: a relative path should not traverse above the
      // directory of the current file.  Count net ".." depth to detect escape.
      if (importNode.path.startsWith('.')) {
        const segments = importNode.path.split(/[/\\]/);
        let depth = 0;
        for (const seg of segments) {
          if (seg === '..') {
            depth -= 1;
          } else if (seg !== '.' && seg !== '') {
            depth += 1;
          }
          // If depth goes negative beyond -1, it's escaping above the parent directory
          // (one level of ".." is normal for sibling directory access)
        }
        // A relative import from "dir/file.scash" importing "../../x" has net depth -1
        // which is fine (goes to parent). But "../../../../x" with net depth -4 is suspicious.
        // We disallow imports that traverse more than 10 parent levels as a safety heuristic.
        if (depth < -10) {
          throw new UnsafeImportPathError(importNode.path, currentFileId);
        }
      }

      const resolved = this.resolver(importNode.path, currentFileId);

      if (!resolved) {
        throw new UnresolvedImportError(importNode.path, currentFileId);
      }

      const resolvedId = resolved.id;

      if (this.resolving.has(resolvedId)) {
        throw new CircularImportError(resolvedId);
      }

      if (!this.resolvedFiles.has(resolvedId)) {
        this.resolving.add(resolvedId);
        const importedAst = parseCode(resolved.source, undefined, this.solidityImportCompat);
        // Recursively resolve imports in the imported file
        this.resolve(importedAst, resolvedId);
        this.resolvedFiles.set(resolvedId, importedAst);
        this.resolving.delete(resolvedId);
      }

      const importedAst = this.resolvedFiles.get(resolvedId)!;
      importNode.resolvedAst = importedAst;
      this.mergeImports(ast, importedAst, importNode);
    }

    return ast;
  }

  private mergeImports(
    target: SourceFileNode,
    source: SourceFileNode,
    importNode: ImportNode,
  ): void {
    switch (importNode.kind) {
      case 'wildcard':
        // Import everything: contract, constants, enums, structs, types,
        // errors, events, interfaces, free functions, using-for
        // Skip library placeholder contracts (they have no real contract definition)
        if (!source.isLibrary) {
          target.importedContracts.push(source.contract);
        }
        // Also import any contracts that the source itself imported
        target.importedContracts.push(...source.importedContracts);
        target.constantDefinitions.push(...source.constantDefinitions);
        target.enumDefinitions.push(...source.enumDefinitions);
        target.structDefinitions.push(...source.structDefinitions);
        target.typeDefinitions.push(...source.typeDefinitions);
        target.eventDefinitions.push(...source.eventDefinitions);
        target.errorDefinitions.push(...source.errorDefinitions);
        target.interfaceDefinitions.push(...source.interfaceDefinitions);
        target.freeFunctions.push(...source.freeFunctions);
        target.usingForDirectives.push(...source.usingForDirectives);
        break;

      case 'selective':
        if (!importNode.bindings) break;
        for (const binding of importNode.bindings) {
          const { name } = binding;
          // Check if importing a library namespace (e.g. import { SafeMath } from "math_lib.scash")
          if (source.isLibrary && source.libraryName === name) {
            // Import all namespaced functions, constants, enums, structs, types, events, using-for from this
            // library (or interface-only file, whose placeholder name is its first interface).
            target.freeFunctions.push(...source.freeFunctions);
            target.constantDefinitions.push(
              ...source.constantDefinitions.filter((c) => c.name.startsWith(`${name}.`)),
            );
            target.enumDefinitions.push(...source.enumDefinitions);
            target.structDefinitions.push(...source.structDefinitions);
            target.typeDefinitions.push(...source.typeDefinitions);
            target.eventDefinitions.push(...source.eventDefinitions);
            target.errorDefinitions.push(...source.errorDefinitions);
            target.interfaceDefinitions.push(...source.interfaceDefinitions);
            target.usingForDirectives.push(...source.usingForDirectives);
          } else if (!source.isLibrary && source.contract.name === name) {
            target.importedContracts.push(source.contract);
            // Transitively import parent contracts needed for inheritance
            this.importParentContracts(target, source, source.contract);
          } else {
            const constant = source.constantDefinitions.find((c) => c.name === name);
            const enumDef = source.enumDefinitions.find((e) => e.name === name);
            const structDef = source.structDefinitions.find((s) => s.name === name);
            const typeDef = source.typeDefinitions.find((t) => t.name === name);
            const eventDef = source.eventDefinitions.find((e) => e.name === name);
            const errorDef = source.errorDefinitions.find((e) => e.name === name);
            const freeFunc = source.freeFunctions.find((f) => f.name === name);
            const importedContract = source.importedContracts.find((c) => c.name === name);

            const iface = source.interfaceDefinitions.find((i) => i.name === name);

            if (constant) {
              target.constantDefinitions.push(constant);
            } else if (enumDef) {
              target.enumDefinitions.push(enumDef);
            } else if (structDef) {
              target.structDefinitions.push(structDef);
            } else if (typeDef) {
              target.typeDefinitions.push(typeDef);
            } else if (eventDef) {
              target.eventDefinitions.push(eventDef);
            } else if (errorDef) {
              target.errorDefinitions.push(errorDef);
            } else if (iface) {
              target.interfaceDefinitions.push(iface);
              // Also import interface-level definitions to file level
              target.structDefinitions.push(...iface.structDefinitions);
              target.enumDefinitions.push(...iface.enumDefinitions);
              target.typeDefinitions.push(...iface.typeDefinitions);
              target.eventDefinitions.push(...iface.eventDefinitions);
              // Transitively import parent interfaces
              this.importParentInterfaces(target, source, iface);
            } else if (freeFunc) {
              target.freeFunctions.push(freeFunc);
            } else if (importedContract) {
              target.importedContracts.push(importedContract);
              // Transitively import parent contracts needed for inheritance
              this.importParentContracts(target, source, importedContract);
            } else {
              throw new ImportSymbolNotFoundError(name, importNode.path);
            }
          }
        }
        break;

      case 'namespace':
        // For namespace imports, just make the contract available for cross-contract references
        // Skip library placeholder contracts
        if (!source.isLibrary) {
          target.importedContracts.push(source.contract);
        }
        target.importedContracts.push(...source.importedContracts);
        target.enumDefinitions.push(...source.enumDefinitions);
        target.structDefinitions.push(...source.structDefinitions);
        target.typeDefinitions.push(...source.typeDefinitions);
        target.eventDefinitions.push(...source.eventDefinitions);
        target.errorDefinitions.push(...source.errorDefinitions);
        target.interfaceDefinitions.push(...source.interfaceDefinitions);
        target.freeFunctions.push(...source.freeFunctions);
        // Propagate global using-for directives through namespace imports
        target.usingForDirectives.push(...source.usingForDirectives.filter((u) => u.isGlobal));
        break;
    }
  }

  /**
   * Transitively import all parent contracts that a given contract depends on via `implements`.
   */
  private importParentContracts(
    target: SourceFileNode,
    source: SourceFileNode,
    contract: { implements: string[] },
  ): void {
    for (const parentName of contract.implements) {
      // Skip if already imported
      if (target.importedContracts.some((c) => c.name === parentName)) continue;

      const parentContract = source.importedContracts.find((c) => c.name === parentName);
      if (parentContract) {
        target.importedContracts.push(parentContract);
        // Recurse for grandparent contracts
        this.importParentContracts(target, source, parentContract);
      }
    }
  }

  /**
   * Transitively import all parent interfaces that a given interface depends on.
   */
  private importParentInterfaces(
    target: SourceFileNode,
    source: SourceFileNode,
    iface: { parents: string[] },
  ): void {
    for (const parentName of iface.parents) {
      // Skip if already imported
      if (target.interfaceDefinitions.some((i) => i.name === parentName)) continue;

      const parentIface = source.interfaceDefinitions.find((i) => i.name === parentName);
      if (parentIface) {
        target.interfaceDefinitions.push(parentIface);
        // Recurse for grandparent interfaces
        this.importParentInterfaces(target, source, parentIface);
      }
    }
  }
}
