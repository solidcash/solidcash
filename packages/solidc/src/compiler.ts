import { CharStream, CommonTokenStream } from 'antlr4';
import { binToHex } from '@bitauth/libauth';
import { Artifact, CompilerOptions, computeBytecodeFingerprintWithConstructorArgs, generateSourceMap, optimiseBytecode, optimiseBytecodeOld, scriptToAsm, scriptToBytecode, sourceMapToLocationData } from '@solidcash/utils';
import { generateArtifact } from './artifact/Artifact.js';
import {
  Ast, ContractNode, ContractReferenceNode, InstantiationNode, SourceFileNode, TypeIntrospectionNode,
} from './ast/AST.js';
import AstBuilder from './ast/AstBuilder.js';
import { ThrowingErrorListener, SolidCashErrorListener, ForwardingErrorListener } from './ast/error-listeners.js';
import GenerateTargetTraversal from './generation/GenerateTargetTraversal.js';
import SolidCashLexer from './grammar/SolidCashLexer.js';
import SolidCashParser from './grammar/SolidCashParser.js';
import SymbolTableTraversal from './semantic/SymbolTableTraversal.js';
import TypeCheckTraversal from './semantic/TypeCheckTraversal.js';
import EnsureFinalRequireTraversal from './semantic/EnsureFinalRequireTraversal.js';
import InjectLocktimeGuardTraversal from './semantic/InjectLocktimeGuardTraversal.js';
import EarlyReturnTransformation from './semantic/EarlyReturnTransformation.js';
import NamedReturnTransformation from './semantic/NamedReturnTransformation.js';
import SynthesizeExternalAddressLocals from './semantic/SynthesizeExternalAddressLocals.js';
import InlineExternalCallHelpers from './semantic/InlineExternalCallHelpers.js';
import InlineStoragePointerCalls from './semantic/InlineStoragePointerCalls.js';
import SynthesizeBlockOracle from './semantic/SynthesizeBlockOracle.js';
import expandModifiers from './semantic/ModifierExpansionTransformation.js';
import expandBreakContinue from './semantic/BreakContinueTransformation.js';
import expandInheritance from './semantic/InheritanceExpansionTransformation.js';
import { ImportResolver } from './ImportResolver.js';
import { AbstractContractNotCompilableError, CircularContractReferenceError, LibraryNotCompilableError } from './Errors.js';

export const DEFAULT_COMPILER_OPTIONS: CompilerOptions = {
  enforceFunctionParameterTypes: true,
  enforceLocktimeGuard: true,
  commitmentLimit: 128,
  chunkedArrays: true,
  chainId: 0,
};

export interface CompileOptions extends CompilerOptions {
  errorListener?: SolidCashErrorListener;
}

export function compileString(code: string, compilerOptions: CompileOptions = {}): Artifact {
  const { errorListener, ...artifactCompilerOptions } = compilerOptions;
  const mergedCompilerOptions = { ...DEFAULT_COMPILER_OPTIONS, ...artifactCompilerOptions };

  // Lexing + parsing
  let ast = parseCode(code, errorListener, mergedCompilerOptions.solidityImportCompat,
    mergedCompilerOptions.chunkedArrays);

  // Resolve imports
  if (ast.imports.length > 0) {
    if (!mergedCompilerOptions.importResolver) {
      throw new Error(
        'Source contains imports but no importResolver provided. '
        + 'Use compileFile() for Node.js, or provide a custom importResolver in options.',
      );
    }
    const resolver = new ImportResolver(
      mergedCompilerOptions.importResolver, mergedCompilerOptions.solidityImportCompat,
    );
    ast = resolver.resolve(ast, mergedCompilerOptions.rootFileId ?? 'main');
  }

  // Check if this is a library file (cannot be compiled to an artifact)
  if (ast.isLibrary) {
    throw new LibraryNotCompilableError(ast.libraryName ?? 'unknown');
  }

  // Inheritance expansion (after import resolution, before modifier expansion)
  ast = expandInheritance(ast);

  // Check if this is an abstract contract (cannot be compiled to an artifact)
  if (ast.contract.isAbstract) {
    throw new AbstractContractNotCompilableError(ast.contract.name);
  }

  // Modifier expansion (before semantic analysis)
  ast = expandModifiers(ast);

  // Break/continue expansion (before semantic analysis)
  ast = expandBreakContinue(ast);

  // Named-return desugar (before semantic analysis): named returns become default-init locals.
  ast = ast.accept(new NamedReturnTransformation(mergedCompilerOptions.solidityImportCompat)) as Ast;

  // Inline void helpers that make external calls into their internal call sites (the external co-spend can't
  // cross an OP_INVOKE boundary); reduces to the entry-point-body external-call case.
  ast = ast.accept(new InlineExternalCallHelpers()) as Ast;

  // Inline void calls to functions taking `storage` reference params; a storage pointer has no value
  // representation, so the callee is substituted into the caller as direct state access.
  ast = ast.accept(new InlineStoragePointerCalls()) as Ast;

  // Interface-typed state vars used as external-call targets -> synthesized address locals (reuses the
  // local-interface-var dispatch).
  ast = ast.accept(new SynthesizeExternalAddressLocals()) as Ast;
  // Oracle-backed block.* reads -> injected uint32 state-var registers + desugared state reads.
  const blockOracle = new SynthesizeBlockOracle(mergedCompilerOptions.solidityImportCompat);
  ast = ast.accept(blockOracle) as Ast;

  // Semantic analysis
  ast = ast.accept(new SymbolTableTraversal(mergedCompilerOptions)) as Ast;
  ast = ast.accept(new TypeCheckTraversal(mergedCompilerOptions.solidityImportCompat)) as Ast;
  ast = ast.accept(new EnsureFinalRequireTraversal(mergedCompilerOptions.solidityImportCompat)) as Ast;

  // Inject synthetic tx.locktime guard where tx.locktime is used without a protocol-enforcing time check
  if (mergedCompilerOptions.enforceLocktimeGuard) {
    ast = ast.accept(new InjectLocktimeGuardTraversal()) as Ast;
  }

  // Early return transformation (rewrites return statements into nested if-else)
  ast = ast.accept(new EarlyReturnTransformation()) as Ast;

  // Compile referenced contracts in dependency order
  const compiledBytecodes = compileReferencedContracts(ast, mergedCompilerOptions);

  // Code generation
  const traversal = new GenerateTargetTraversal(mergedCompilerOptions);
  traversal.compiledBytecodes = compiledBytecodes;
  ast = ast.accept(traversal) as Ast;

  const constructorParamLength = ast.contract.parameters.length;

  // Bytecode optimisation
  const optimisedBytecodeOld = optimiseBytecodeOld(traversal.output);
  const optimisationResult = optimiseBytecode(
    traversal.output,
    sourceMapToLocationData(traversal.sourceMap),
    traversal.consoleLogs,
    traversal.requires,
    constructorParamLength,
  );

  if (scriptToAsm(optimisedBytecodeOld) !== scriptToAsm(optimisationResult.script)) {
    console.error(scriptToAsm(optimisedBytecodeOld));
    console.error(scriptToAsm(optimisationResult.script));
    throw new Error('New bytecode optimisation is not backwards compatible, please report this issue to the SolidCash team');
  }

  // Attach debug information
  const functionDebug = traversal.entryPointDebugInfo.size > 0
    ? Object.fromEntries(traversal.entryPointDebugInfo)
    : undefined;

  const debug = {
    bytecode: binToHex(scriptToBytecode(optimisationResult.script)),
    sourceMap: generateSourceMap(optimisationResult.locationData),
    logs: optimisationResult.logs,
    requires: optimisationResult.requires,
    ...(functionDebug && { functionDebug }),
  };

  // Extract function body bytecodes for multi-function OP_INVOKE dispatch (keyed by selector hex)
  const functionBodies = traversal.entryPointBytecodes.size > 0
    ? Object.fromEntries(
      [...traversal.entryPointBytecodes.entries()].map(([selectorHex, bytecode]) => [selectorHex, binToHex(bytecode)]),
    )
    : undefined;

  const fingerprint = computeBytecodeFingerprintWithConstructorArgs(optimisationResult.script, constructorParamLength);

  const artifact = generateArtifact(ast, optimisationResult.script, code, debug, mergedCompilerOptions, functionBodies, fingerprint);
  // Marker for the off-chain keeper: this contract reads blockhash(n) -> maintain the (n->hash) oracle.
  if (blockOracle.usesBlockhash) artifact.usesBlockhash = true;
  return artifact;
}

/**
 * Compile imported contracts that are referenced via cross-contract references.
 * Returns a map of contract name -> compiled bytecode.
 */
function compileReferencedContracts(
  ast: Ast,
  compilerOptions: CompilerOptions,
): Map<string, Uint8Array> {
  const compiledBytecodes = new Map<string, Uint8Array>();

  // Collect all referenced contract names from the AST
  const referencedContracts = collectContractReferences(ast);
  if (referencedContracts.size === 0) return compiledBytecodes;

  // Build a map of available imported contracts
  const contractMap = new Map<string, ContractNode>();
  for (const c of ast.importedContracts) {
    contractMap.set(c.name, c);
  }

  // Topologically sort and compile
  const sorted = topologicalSort(referencedContracts, contractMap, ast);
  for (const contractName of sorted) {
    const contract = contractMap.get(contractName);
    if (!contract) continue;

    // Skip abstract contracts - they can't be compiled
    if (contract.isAbstract) continue;

    // Create a minimal AST wrapper and run semantic analysis passes
    // to properly populate opRolls (last-use tracking for OP_ROLL optimization).
    // Without this, imported contracts get OP_PICK + OP_NIP instead of OP_ROLL,
    // producing different (larger) bytecode than standalone compilation.
    let singleAst: Ast = new SourceFileNode(contract);
    singleAst = singleAst.accept(new NamedReturnTransformation(compilerOptions.solidityImportCompat)) as Ast;
    singleAst = singleAst.accept(new InlineExternalCallHelpers()) as Ast;
    singleAst = singleAst.accept(new InlineStoragePointerCalls()) as Ast;
    singleAst = singleAst.accept(new SynthesizeExternalAddressLocals()) as Ast;
    singleAst = singleAst.accept(new SynthesizeBlockOracle(compilerOptions.solidityImportCompat)) as Ast;
    singleAst = singleAst.accept(new SymbolTableTraversal(compilerOptions)) as Ast;
    singleAst = singleAst.accept(new TypeCheckTraversal(compilerOptions.solidityImportCompat)) as Ast;
    singleAst = singleAst.accept(new EnsureFinalRequireTraversal(compilerOptions.solidityImportCompat)) as Ast;
    if (compilerOptions.enforceLocktimeGuard) {
      singleAst = singleAst.accept(new InjectLocktimeGuardTraversal()) as Ast;
    }
    singleAst = singleAst.accept(new EarlyReturnTransformation()) as Ast;

    const traversal = new GenerateTargetTraversal(compilerOptions);
    traversal.compiledBytecodes = compiledBytecodes;
    singleAst.accept(traversal);

    const optimisationResult = optimiseBytecode(
      traversal.output,
      sourceMapToLocationData(traversal.sourceMap),
      traversal.consoleLogs,
      traversal.requires,
      contract.parameters.length,
    );

    compiledBytecodes.set(contractName, scriptToBytecode(optimisationResult.script));
  }

  return compiledBytecodes;
}

/**
 * Collect all contract names referenced via ContractReferenceNode in the AST.
 */
function collectContractReferences(ast: Ast): Set<string> {
  const refs = new Set<string>();
  if (ast.importedContracts.length === 0) return refs;
  const visited = new WeakSet();
  collectRefsRecursive(ast.contract, refs, visited);
  return refs;
}

function collectRefsRecursive(node: any, refs: Set<string>, visited: WeakSet<object>): void {
  if (!node || typeof node !== 'object') return;
  if (visited.has(node)) return;
  visited.add(node);

  if (node instanceof ContractReferenceNode) {
    refs.add(node.contractName);
    // Also recurse into constructor args
    for (const arg of node.constructorArgs) {
      collectRefsRecursive(arg, refs, visited);
    }
    return;
  }

  if (node instanceof InstantiationNode && node.referencedContract) {
    refs.add(node.identifier.name);
    for (const arg of node.parameters) {
      collectRefsRecursive(arg, refs, visited);
    }
    if (node.callOptions?.value) collectRefsRecursive(node.callOptions.value, refs, visited);
    if (node.callOptions?.salt) collectRefsRecursive(node.callOptions.salt, refs, visited);
    return;
  }

  // type(Child).creationCode / runtimeCode embeds the child's compiled bytecode.
  if (node instanceof TypeIntrospectionNode && node.contractName
    && (node.property === 'creationCode' || node.property === 'runtimeCode')) {
    refs.add(node.contractName);
    return;
  }

  // Only recurse into known AST node arrays and properties
  for (const key of Object.keys(node)) {
    // Skip back-references that cause cycles
    if (key === 'symbolTable' || key === 'definition' || key === 'resolvedFunction'
      || key === 'referencedContract' || key === 'stateVariable' || key === 'collection'
      || key === 'eventDefinition' || key === 'eventCandidates' || key === 'opRolls'
      || key === 'structType' || key === 'enumType' || key === 'type'
      || key === 'resolvedAst' || key === 'arrayType') continue;

    const val = node[key];
    if (val instanceof Array) {
      for (const item of val) {
        if (item && typeof item === 'object') collectRefsRecursive(item, refs, visited);
      }
    } else if (val && typeof val === 'object' && !(val instanceof Map) && !(val instanceof Set)
      && !(val instanceof Uint8Array)) {
      collectRefsRecursive(val, refs, visited);
    }
  }
}

/**
 * Topological sort of referenced contracts based on their dependencies.
 */
function topologicalSort(
  referencedContracts: Set<string>,
  contractMap: Map<string, ContractNode>,
  _ast: Ast,
): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new CircularContractReferenceError(name);
    }
    visiting.add(name);

    // For now, imported contracts don't have dependencies on each other
    // (they're simple standalone contracts). If they reference other contracts,
    // those would need to be resolved too.

    visiting.delete(name);
    visited.add(name);
    sorted.push(name);
  }

  for (const name of referencedContracts) {
    if (contractMap.has(name)) {
      visit(name);
    }
  }

  return sorted;
}

export function parseCode(
  code: string,
  errorListener: SolidCashErrorListener = ThrowingErrorListener.INSTANCE,
  solidityImportCompat = false,
  chunkedArrays = true,
): Ast {
  const syntaxErrorListener = new ForwardingErrorListener(errorListener);

  // Lexing (throwing on errors)
  const inputStream = new CharStream(code);
  const lexer = new SolidCashLexer(inputStream);
  lexer.removeErrorListeners();
  lexer.addErrorListener(syntaxErrorListener);
  const tokenStream = new CommonTokenStream(lexer);

  // Parsing (throwing on errors)
  const parser = new SolidCashParser(tokenStream);
  parser.removeErrorListeners();
  parser.addErrorListener(syntaxErrorListener);
  const parseTree = parser.sourceFile();
  syntaxErrorListener.throwFirstError();

  // AST building
  const ast = new AstBuilder(parseTree, solidityImportCompat, chunkedArrays).build() as Ast;

  return ast;
}
