import { ImportResolverFn } from '@solidcash/utils';
import { SourceFileNode, ImportNode } from './ast/AST.js';
import { cloneNode } from './ast/clone.js';
import { parseCode } from './compiler.js';
import { UnresolvedImportError, ImportSymbolNotFoundError, UnsafeImportPathError } from './Errors.js';

export class ImportResolver {
  private resolvedFiles = new Map<string, SourceFileNode>();

  constructor(private resolver: ImportResolverFn, private solidityImportCompat = false) {}

  resolve(ast: SourceFileNode, currentFileId: string): SourceFileNode {
    // Register this file up-front so a cyclic import back to it reuses this in-progress AST (see the loop).
    if (!this.resolvedFiles.has(currentFileId)) this.resolvedFiles.set(currentFileId, ast);
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

      // Circular imports are legal in Solidity (A imports B, B imports A). Register each file BEFORE recursing
      // into its own imports so a cycle back to it reuses the in-progress AST instead of re-parsing and
      // recursing forever. A genuinely-invalid cycle (circular inheritance) is still caught downstream by
      // InheritanceExpansionTransformation / the interface-inheritance check.
      let importedAst = this.resolvedFiles.get(resolvedId);
      if (!importedAst) {
        importedAst = parseCode(resolved.source, undefined, this.solidityImportCompat);
        this.resolvedFiles.set(resolvedId, importedAst);
        this.resolve(importedAst, resolvedId);
      }

      importNode.resolvedAst = importedAst;
      this.mergeImports(ast, importedAst, importNode);
    }

    // Dedup definitions imported via multiple statements from the same file (e.g. a wildcard
    // `import "./Foo.sol"` plus a named `import {Point} from "./Foo.sol"`): both reference the SAME cached
    // node, so deduping by identity removes the redundant copy. Distinct same-named definitions from different
    // files keep separate nodes and still collide downstream (a genuine redefinition).
    ast.importedContracts = [...new Set(ast.importedContracts)];
    ast.constantDefinitions = [...new Set(ast.constantDefinitions)];
    ast.enumDefinitions = [...new Set(ast.enumDefinitions)];
    ast.structDefinitions = [...new Set(ast.structDefinitions)];
    ast.typeDefinitions = [...new Set(ast.typeDefinitions)];
    ast.eventDefinitions = [...new Set(ast.eventDefinitions)];
    ast.errorDefinitions = [...new Set(ast.errorDefinitions)];
    ast.interfaceDefinitions = [...new Set(ast.interfaceDefinitions)];
    ast.freeFunctions = [...new Set(ast.freeFunctions)];
    ast.usingForDirectives = [...new Set(ast.usingForDirectives)];
    ast.declaredLibraryNames = [...new Set(ast.declaredLibraryNames)];

    return ast;
  }

  private mergeImports(
    target: SourceFileNode,
    source: SourceFileNode,
    importNode: ImportNode,
  ): void {
    // Convey a state-touching (delegate) library's declared layout so a consumer's L.f() call site can verify
    // its own state layout matches (SynthesizeLibraryDelegateCalls). See docs/library-contracts.md (3b).
    if (source.isLibrary && source.libraryContract && source.libraryName) {
      target.importedLibraryLayouts.set(source.libraryName, source.libraryContract.stateVariables);
    }
    // Library names travel with every import kind: `using L for T` must know L exists even when all of
    // L's functions were inlined away (storage-pointer fns) or L is empty.
    target.declaredLibraryNames.push(...source.declaredLibraryNames);
    source.libraryFunctionSignatures.forEach((v, k) => target.libraryFunctionSignatures.set(k, v));
    target.libraryModifierDefinitions.push(...source.libraryModifierDefinitions);
    source.libraryEventSignatures.forEach((v, k) => target.libraryEventSignatures.set(k, v));
    source.libraryAnonymousEvents.forEach((name) => target.libraryAnonymousEvents.add(name));
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
          const { name, alias } = binding;
          // Check if importing a library namespace (e.g. import { SafeMath } from "math_lib.scash"). A file may
          // declare SEVERAL libraries (Sablier's DataTypes.sol: Lockup, LockupDynamic, ..); `libraryName` is only
          // the last, so match any declared one. Library structs/enums are registered BARE (namespaced type refs
          // `Lockup.CreateWithDurations` strip to `CreateWithDurations`), so importing one library pulls the
          // file's bare types wholesale - sound while bare names stay unique across the file's libraries.
          if (source.isLibrary && (source.libraryName === name || source.declaredLibraryNames.includes(name))) {
            // Import all namespaced functions, constants, enums, structs, types, events, using-for from this
            // library (or interface-only file, whose placeholder name is its first interface). Merge ALL the file's
            // constants, not only `${name}.`-prefixed ones: the merged free functions may reference constants a
            // TRANSITIVELY imported library declared (OZ Strings.toHexString reads `HEX_DIGITS`, registered
            // `Strings.HEX_DIGITS` - dropped by the name filter when Strings arrives via MessageHashUtils/EIP712).
            target.freeFunctions.push(...source.freeFunctions);
            target.constantDefinitions.push(...source.constantDefinitions);
            target.enumDefinitions.push(...source.enumDefinitions);
            target.structDefinitions.push(...source.structDefinitions);
            target.typeDefinitions.push(...source.typeDefinitions);
            target.eventDefinitions.push(...source.eventDefinitions);
            target.errorDefinitions.push(...source.errorDefinitions);
            target.interfaceDefinitions.push(...source.interfaceDefinitions);
            target.usingForDirectives.push(...source.usingForDirectives);
          } else if (!source.isLibrary && source.contract.name === name) {
            target.importedContracts.push(source.contract);
            // A selectively-imported contract needs its file's whole dependency closure: FILE-LEVEL types/structs/
            // enums (OZ EIP712's `ShortString` = `type ShortString is bytes32`), the interfaces it implements
            // (IERC20), and the library free functions + using-for it relies on (`using ShortStrings for *` ->
            // `name.toShortStringWithFallback(..)`). The wildcard branch carries all of these; the by-name contract
            // branch omitted them, so the contract compiled against unresolved types/symbols.
            target.importedContracts.push(...source.importedContracts);
            target.typeDefinitions.push(...source.typeDefinitions);
            target.structDefinitions.push(...source.structDefinitions);
            target.enumDefinitions.push(...source.enumDefinitions);
            target.constantDefinitions.push(...source.constantDefinitions);
            target.interfaceDefinitions.push(...source.interfaceDefinitions);
            target.eventDefinitions.push(...source.eventDefinitions);
            target.errorDefinitions.push(...source.errorDefinitions);
            target.freeFunctions.push(...source.freeFunctions);
            target.usingForDirectives.push(...source.usingForDirectives);
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
              if (alias) {
                const aliased = cloneNode(enumDef);
                aliased.name = alias;
                target.enumDefinitions.push(aliased);
              } else {
                target.enumDefinitions.push(enumDef);
              }
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
        // Namespace-qualified enum references (`import "./x.sol" as X; X.Color.Red`) are parsed as nested field
        // accesses. Register cloned compound enum names so SymbolTableTraversal can collapse `X.Color` as a type
        // namespace before it attempts to resolve X as a runtime identifier. Keep the bare imports above for
        // compatibility with existing SolidCash namespace-import behavior.
        if (importNode.alias) {
          target.enumDefinitions.push(...source.enumDefinitions.map((ed) => {
            const qualified = cloneNode(ed);
            qualified.name = `${importNode.alias}.${ed.name}`;
            return qualified;
          }));
        }
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
