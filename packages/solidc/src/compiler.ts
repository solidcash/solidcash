import { CharStream, CommonTokenStream } from 'antlr4';
import { binToHex } from '@bitauth/libauth';
import { Artifact, ArtifactMap, ArrayType, AddressType, BytesType, CompilerOptions, computeBytecodeFingerprintWithConstructorArgs, computeFunctionSelector, computeFunctionSignature, EnumType, FunctionType, generateSourceMap, IntType, MappingType, optimiseBytecode, optimiseBytecodeOld, OPTIMISER_COMPAT_CHECK_MAX_OPS, PrimitiveType, scriptToAsm, scriptToBytecode, sourceMapToLocationData, SplitArtifactBundle, SplitStateFootprint, StructType, Type, ValueType } from '@solidcash/utils';
import { generateArtifact, generateDeclarationArtifact } from './artifact/Artifact.js';
import {
  Ast, BlockNode, BoolLiteralNode, ContractNode, ContractReferenceNode, EmitStatementNode,
  FunctionCallNode, FunctionDefinitionNode,
  ExternalFunctionCallNode, FunctionModifier, HexLiteralNode, IdentifierNode, InstantiationNode,
  LowLevelCallStatementNode, MappingAccessNode, MappingAssignNode, MappingDeleteNode,
  MethodCallNode, MethodCallStatementNode, Node, ParameterNode, RequireNode,
  NullaryOpNode, VariableDefinitionNode,
  SourceFileNode, TransferStatementNode, TypeIntrospectionNode,
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
import DesugarNestedBranchReturn from './semantic/DesugarNestedBranchReturn.js';
import SynthesizeExternalAddressLocals from './semantic/SynthesizeExternalAddressLocals.js';
import HoistBranchLocalExtcallTargets from './semantic/HoistBranchLocalExtcallTargets.js';
import HoistNonLoopArrayElemExtcallTargets from './semantic/HoistNonLoopArrayElemExtcallTargets.js';
import CaptureBranchExternalCallTargets from './semantic/CaptureBranchExternalCallTargets.js';
import SplitExternalCallFnPtrArgs from './semantic/SplitExternalCallFnPtrArgs.js';
import DesugarContractMemberFnPtr from './semantic/DesugarContractMemberFnPtr.js';
import InterproceduralStoreFold from './semantic/InterproceduralStoreFold.js';
import EliminateInternalFnPtrAlias from './semantic/EliminateInternalFnPtrAlias.js';
import InlineForeignFunctionPointerReturns from './semantic/InlineForeignFunctionPointerReturns.js';
import LowerForeignFunctionPointerVars from './semantic/LowerForeignFunctionPointerVars.js';
import LowerForeignFunctionPointerParams from './semantic/LowerForeignFunctionPointerParams.js';
import LowerForeignFunctionPointerStorage from './semantic/LowerForeignFunctionPointerStorage.js';
import LowerReceivedFnPtrArray from './semantic/LowerReceivedFnPtrArray.js';
import LowerBlobFunctionPointers from './semantic/LowerBlobFunctionPointers.js';
import LowerForeignFunctionPointerStructFields from './semantic/LowerForeignFunctionPointerStructFields.js';
import LowerForeignFunctionPointerArrayElements from './semantic/LowerForeignFunctionPointerArrayElements.js';
import PromoteConstructorExternalReads from './semantic/PromoteConstructorExternalReads.js';
import SynthesizeLibraryDelegateCalls from './semantic/SynthesizeLibraryDelegateCalls.js';
import InlineExternalCallHelpers from './semantic/InlineExternalCallHelpers.js';
import InlineStoragePointerCalls from './semantic/InlineStoragePointerCalls.js';
import LowerSelfLowLevelCalls from './semantic/LowerSelfLowLevelCalls.js';
import HoistInlineDeployCalls from './semantic/HoistInlineDeployCalls.js';
import HoistChainedContractCalls from './semantic/HoistChainedContractCalls.js';
import InlineMappingReturnFunctions from './semantic/InlineMappingReturnFunctions.js';
import LowerMappingStorageAlias from './semantic/LowerMappingStorageAlias.js';
import InlineReturningStateHelpers from './semantic/InlineReturningStateHelpers.js';
import LowerCollectionJournalHelpers from './semantic/LowerCollectionJournalHelpers.js';
import LowerDynamicStateJournalHelpers from './semantic/LowerDynamicStateJournalHelpers.js';
import DesugarPostfixExpressions from './semantic/DesugarPostfixExpressions.js';
import DesugarNestedArrayWrite from './semantic/DesugarNestedArrayWrite.js';
import DesugarExternalFunctionPointers from './semantic/DesugarExternalFunctionPointers.js';
import DesugarReturnInLoop from './semantic/DesugarReturnInLoop.js';
import UnrollFixedBoundEntryLoop from './semantic/UnrollFixedBoundEntryLoop.js';
import LowerC2CounterLoops from './semantic/LowerC2CounterLoops.js';
import LowerInlineAssembly from './semantic/LowerInlineAssembly.js';
import LowerMemoryModel from './semantic/LowerMemoryModel.js';
import ValidateDataLocations from './semantic/ValidateDataLocations.js';
import DesugarLocalBytesElementWrite from './semantic/DesugarLocalBytesElementWrite.js';
import CacheDynamicArrayInLoop from './semantic/CacheDynamicArrayInLoop.js';
import CacheMappingEntryInLoop from './semantic/CacheMappingEntryInLoop.js';
import DesugarDynamicArrayCopyCast from './semantic/DesugarDynamicArrayCopyCast.js';
import IfConvertConditionalEntryOp from './semantic/IfConvertConditionalEntryOp.js';
import SynthesizeBlockOracle from './semantic/SynthesizeBlockOracle.js';
import PruneUnreachableFreeFunctions from './semantic/PruneUnreachableFreeFunctions.js';
import PruneUnreachableMsgDataMethods from './semantic/PruneUnreachableMsgDataMethods.js';
import RedesugarImportedUsingForCalls from './semantic/RedesugarImportedUsingForCalls.js';
import RedesugarImportedStructFieldWrites from './semantic/RedesugarImportedStructFieldWrites.js';
import CoalesceStructFieldArrayWrites from './semantic/CoalesceStructFieldArrayWrites.js';
import CoalesceMappingEntryFieldWrites from './semantic/CoalesceMappingEntryFieldWrites.js';
import RedesugarImportedUdvtWrap from './semantic/RedesugarImportedUdvtWrap.js';
import SynthesizePublicGetters from './semantic/SynthesizePublicGetters.js';
import expandModifiers from './semantic/ModifierExpansionTransformation.js';
import FoldHashLiterals from './semantic/FoldHashLiterals.js';
import LowerStorageSlotPointers from './semantic/LowerStorageSlotPointers.js';
import expandBreakContinue from './semantic/BreakContinueTransformation.js';
import expandInheritance from './semantic/InheritanceExpansionTransformation.js';
import lowerTransientStateVars from './semantic/LowerTransientStateVars.js';
import { ImportResolver } from './ImportResolver.js';
import { CircularContractReferenceError } from './Errors.js';
import { MAX_INPUT_BYTESIZE } from './constants.js';
import {
  analyseContractInvocations, analyseFunctionFootprint, collectNamedFunctionClosure, walkInvocationAst,
} from './analysis/InvocationAnalysis.js';
import { NullaryOperator } from './ast/Operator.js';
import { cloneNode } from './ast/clone.js';

export const DEFAULT_COMPILER_OPTIONS: CompilerOptions = {
  enforceFunctionParameterTypes: true,
  enforceLocktimeGuard: true,
  enforceFinalRequire: false,
  commitmentLimit: 128,
  chunkedArrays: true,
  chainId: 0,
};

export interface CompileOptions extends CompilerOptions {
  errorListener?: SolidCashErrorListener;
}

export interface SplitCompileOptions extends CompileOptions {
  /** Maximum redeem-script bytes for each generated shard. Defaults to the BCH input limit. */
  maxShardBytes?: number;
  /** Split eligible entry points even when the original artifact already fits. Useful for testing/tuning. */
  forceSplit?: boolean;
}

// Optional process-wide memoization of pure string compiles (same code+options -> same artifact).
// Off by default; enabled via SOLIDC_COMPILE_CACHE=1 (test harness sets it) since compilation is
// deterministic. Skipped when a custom errorListener/importResolver is present (non-serializable).
const compileCache = new Map<string, Artifact>();
export function compileString(code: string, compilerOptions: CompileOptions = {}): Artifact {
  const { errorListener, ...artifactCompilerOptions } = compilerOptions;
  const cacheable = process.env.SOLIDC_COMPILE_CACHE === '1'
    && !errorListener && !artifactCompilerOptions.importResolver;
  let cacheKey = '';
  if (cacheable) {
    cacheKey = `${code}\x00${JSON.stringify(artifactCompilerOptions)}`;
    const hit = compileCache.get(cacheKey);
    if (hit) return structuredClone(hit);
  }
  const mergedCompilerOptions = { ...DEFAULT_COMPILER_OPTIONS, ...artifactCompilerOptions };
  const ast = parseAndResolve(code, mergedCompilerOptions, errorListener);
  const artifact = compileResolvedAst(ast, code, mergedCompilerOptions);
  if (cacheable) compileCache.set(cacheKey, artifact);
  return cacheable ? structuredClone(artifact) : artifact;
}

// Parse + (optionally re-select a non-default primary contract) + resolve imports. The default primary is the
// LAST top-level contract (AstBuilder); `primaryName` re-selects one for compileStringMulti's per-contract pass.
function parseAndResolve(
  code: string, mergedCompilerOptions: CompilerOptions, errorListener?: SolidCashErrorListener,
  primaryName?: string,
): Ast {
  // Lexing + parsing
  let ast = parseCode(code, errorListener, mergedCompilerOptions.solidityImportCompat,
    mergedCompilerOptions.chunkedArrays);
  const hadImports = ast.imports.length > 0;

  // Resolve imports first, so an imported contract is available for setPrimaryContract (compileStringMulti).
  if (hadImports) {
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

  if (primaryName) setPrimaryContract(ast, primaryName);

  // Types are resolved during parse, before imports merge, so an imported struct used as an array element
  // (`Todo[]` where `Todo` is imported) parses to a named AddressType placeholder. Now that imported struct
  // definitions are merged (and the primary is chosen), re-resolve those placeholders to the real StructType.
  if (hadImports) reresolveImportedStructTypes(ast);
  return ast;
}

// Make `name` the primary contract (the one compiled to the artifact); the rest stay as available siblings/
// imports. Used by compileStringMulti to compile each top-level contract in turn. No-op if not found.
function setPrimaryContract(ast: Ast, name: string): void {
  const all = [...ast.importedContracts, ast.contract].filter(Boolean);
  const target = all.find((c) => c?.name === name);
  if (!target) return;
  ast.contract = target;
  ast.importedContracts = all.filter((c) => c !== target);
}

const SCB1_SELECTOR_HEX = '53434231';
const MAX_HIDDEN_BATCH_ROWS = 8;
const RESOURCE_SHAPED_BATCH_ROWS = 2;
const MAX_HIDDEN_BATCH_BLOB_BYTES = 223;

/** Add the experimental Release 4 physical dispatcher after source lowering
 * but before symbol/type analysis. Only signature-free scalar public handlers
 * enter the initial covenant surface; every other source handler receives an
 * explicit rejection reason in artifact metadata. */
function synthesizeHiddenBatchRoute(ast: Ast, compilerOptions: CompilerOptions): void {
  if (!compilerOptions.experimentalHiddenBatch) return;
  const contract = ast.contract;
  const graphControllerLbc = compilerOptions.experimentalMessageBusController?.toLowerCase();
  const graphControllerCategory = compilerOptions.experimentalMessageBusControllerCategory?.toLowerCase();
  if (graphControllerLbc !== undefined && !/^([0-9a-f]{2})+$/.test(graphControllerLbc)) {
    throw new Error('experimentalMessageBusController must be hex-encoded locking bytecode');
  }
  if ((graphControllerLbc === undefined) !== (graphControllerCategory === undefined)
    || (graphControllerCategory !== undefined && !/^[0-9a-f]{64}$/.test(graphControllerCategory))) {
    throw new Error(
      'experimentalMessageBusController requires a 32-byte experimentalMessageBusControllerCategory',
    );
  }
  const graphControllerCategoryInternal = graphControllerCategory === undefined
    ? undefined
    : (graphControllerCategory.match(/../g) as string[]).reverse().join('');
  if (contract.functions.some((fn) => fn.functionSelector
    && binToHex(fn.functionSelector) === SCB1_SELECTOR_HEX)) {
    throw new Error('Source function selector collides with reserved hidden batch selector 0x53434231');
  }
  const functions = contract.functions.filter((fn) => fn.isEntryPoint && !fn.isAbstract);
  const byName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of contract.functions) {
    const group = byName.get(fn.name) ?? [];
    group.push(fn);
    byName.set(fn.name, group);
  }
  const dynamicState = new Set(contract.stateVariables.filter((state) => state.isDynamic
    || state.type === PrimitiveType.STRING
    || (state.type instanceof BytesType && state.type.bound === undefined)).map((state) => state.name));
  const disallowedModifiers = new Set([
    FunctionModifier.DEPLOY, FunctionModifier.UPGRADE, FunctionModifier.SELFDESTRUCT,
    FunctionModifier.SPLIT, FunctionModifier.MERGE, FunctionModifier.DELEGATE, FunctionModifier.UNSAFE,
  ]);
  let eligible: FunctionDefinitionNode[] = [];
  const graphTailHandlers = new Set<FunctionDefinitionNode>();
  let resourceShapedHandler: FunctionDefinitionNode | undefined;
  const collectionByName = new Map(contract.collections.map((collection) => [collection.name, collection]));
  const routeKeyWitnesses = new Map<string, { name: string; type: Type }[]>();
  for (const fn of functions) {
    const footprint = analyseFunctionFootprint(fn, byName);
    let routeSensitive = false;
    let signatureCheck = false;
    let statefulExternalCall = false;
    let methodCallCount = 0;
    for (const name of collectNamedFunctionClosure(fn, byName)) {
      for (const candidate of byName.get(name) ?? []) {
        walkInvocationAst(candidate.body, (node) => {
          if (node instanceof NullaryOpNode && [
            NullaryOperator.INPUT_INDEX, NullaryOperator.BYTECODE,
            NullaryOperator.MSG_SENDER, NullaryOperator.TX_ORIGIN,
            NullaryOperator.MSG_SIG, NullaryOperator.MSG_DATA, NullaryOperator.MSG_VALUE,
          ].includes(node.operator)) routeSensitive = true;
          if (node instanceof ExternalFunctionCallNode) statefulExternalCall = true;
          // Method calls are resolved into external/internal/builtin forms only
          // during the following semantic pass. The initial frozen route does
          // not attempt to predict that resolution: reject them conservatively
          // so no later synthetic callee parameters can invalidate this call.
          if (node instanceof MethodCallNode) {
            statefulExternalCall = true;
            methodCallCount += 1;
          }
          if (node instanceof FunctionCallNode
            && ['checkSig', 'checkMultiSig'].includes(node.identifier.name)) signatureCheck = true;
        });
      }
    }
    let reason: string | undefined;
    const bodyStatements = fn.body.statements ?? [];
    const graphTailStatement = bodyStatements.length >= 2
      && bodyStatements[bodyStatements.length - 2] instanceof MethodCallStatementNode
      && bodyStatements[bodyStatements.length - 1] instanceof RequireNode
      && (bodyStatements[bodyStatements.length - 1] as RequireNode).expression
        instanceof BoolLiteralNode
      && ((bodyStatements[bodyStatements.length - 1] as RequireNode)
        .expression as BoolLiteralNode).value === true;
    const graphResultStatement = bodyStatements.some((statement) => {
      if (!(statement instanceof VariableDefinitionNode)) return false;
      let containsCall = false;
      walkInvocationAst(statement, (candidate) => {
        if (candidate instanceof MethodCallNode) containsCall = true;
      });
      return containsCall;
    });
    const graphTailCallEligible = graphControllerLbc !== undefined
      && methodCallCount === 1
      && (graphTailStatement || graphResultStatement);
    const keyWitnesses: { routeInput: string; inputIndex: number; perRow?: boolean }[] = [];
    if ([...footprint.reads, ...footprint.writes].some((resource) =>
      resource.startsWith('collection:'))) {
      const directKeys = new Map<string, number[][]>();
      walkInvocationAst(fn.body, (node) => {
        if (!(node instanceof MappingAccessNode || node instanceof MappingAssignNode
          || node instanceof MappingDeleteNode)) return;
        const collection = collectionByName.get(node.name);
        if (!collection) return;
        const indices = node.keys.map((key) => key instanceof IdentifierNode
          ? fn.parameters.findIndex((parameter) => parameter.name === key.name) : -1);
        const group = directKeys.get(node.name) ?? [];
        if (!group.some((prior) => prior.length === indices.length
          && prior.every((value, index) => value === indices[index]))) group.push(indices);
        directKeys.set(node.name, group);
      });
      const closure = collectNamedFunctionClosure(fn, byName);
      if (directKeys.size === 0 || [...closure].some((name) => name !== fn.name
        && [...(byName.get(name) ?? [])].some((candidate) => {
          let touches = false;
          walkInvocationAst(candidate.body, (node) => {
            if (node instanceof MappingAccessNode || node instanceof MappingAssignNode
              || node instanceof MappingDeleteNode) touches = true;
          });
          return touches;
        }))) {
        reason = 'collection-helper-route-not-enabled';
      } else if ([...directKeys.values()].some((alternatives) => alternatives.length > 1)) {
        // A resource-shaped route has one exact physical layout: the first key
        // alternative per collection is shared by all rows, while later
        // alternatives are row-local. The initial measured shape is exactly
        // two rows and one handler, so no inactive physical entry slots exist.
        const globalInputs = new Set<number>();
        const perRowInputs = new Set<number>();
        for (const [collectionName, alternatives] of directKeys) {
          const collection = collectionByName.get(collectionName)!;
          if (alternatives.some((indices) => indices.some((index) => index < 0)
            || indices.length !== collection.allKeyTypes.length)) {
            reason = 'collection-route-requires-parameter-keyed-resource-shape';
            break;
          }
          alternatives[0].forEach((index) => globalInputs.add(index));
          alternatives.slice(1).flat().forEach((index) => perRowInputs.add(index));
        }
        if (!reason && [...perRowInputs].some((index) => globalInputs.has(index))) {
          reason = 'collection-route-has-ambiguous-global-and-row-key';
        }
        if (!reason && resourceShapedHandler && resourceShapedHandler !== fn) {
          reason = 'resource-shaped-route-requires-one-handler';
        }
        if (!reason) {
          resourceShapedHandler = fn;
          const keyInputs = [...new Set([...globalInputs, ...perRowInputs])].sort((a, b) => a - b);
          for (const inputIndex of keyInputs) {
            const parameter = fn.parameters[inputIndex];
            const perRow = perRowInputs.has(inputIndex);
            const routeInput = `__scb_key_${fn.name.replace(/[^A-Za-z0-9_]/g, '_')}`
              + `_${parameter.name.replace(/[^A-Za-z0-9_]/g, '_')}_${perRow ? 'row' : 'global'}`;
            keyWitnesses.push({ routeInput, inputIndex, ...(perRow && { perRow: true }) });
            routeKeyWitnesses.set(routeInput, [{ name: routeInput, type: parameter.type }]);
          }
        }
      } else {
        for (const [collectionName, alternatives] of directKeys) {
          const collection = collectionByName.get(collectionName)!;
          if (alternatives.length !== 1 || alternatives[0].some((index) => index < 0)
            || alternatives[0].length !== collection.allKeyTypes.length) {
            reason = 'collection-route-requires-one-parameter-keyed-entry-per-collection';
            break;
          }
          const prior = routeKeyWitnesses.get(collectionName);
          const witnesses = prior ?? collection.allKeyTypes.map((type, keyIndex) => ({
            name: `__scb_key_${collectionName.replace(/[^A-Za-z0-9_]/g, '_')}_${keyIndex}`,
            type,
          }));
          routeKeyWitnesses.set(collectionName, witnesses);
          alternatives[0].forEach((inputIndex, keyIndex) => keyWitnesses.push({
            routeInput: witnesses[keyIndex].name,
            inputIndex,
          }));
        }
      }
    }
    if (!reason && fn.visibility !== 'public') reason = 'initial-v1-route-requires-public-visibility';
    else if (!reason && (
      signatureCheck || fn.parameters.some((parameter) =>
        ['sig', 'sig[]'].includes(parameter.type.toString()))
    )) {
      reason = 'transaction-signature-route-binding-required';
    } else if (!reason && routeSensitive
      && !(compilerOptions.experimentalLayer3BindingSpike && fn.name === '__layer3_bind')) {
      reason = 'direct-versus-batch-introspection-divergence';
    } else if (!reason && statefulExternalCall && !graphTailCallEligible) {
      reason = 'batched-handler-forward-call-not-enabled';
    } else if (!reason && fn.modifiers.some((modifier) => disallowedModifiers.has(modifier))) {
      reason = 'lifecycle-or-unsafe-handler';
    } else if (!reason && (footprint.unknown
      || (!graphTailCallEligible && footprint.effects.some((effect) => effect === 'external-call')))) {
      reason = 'unresolved-or-effectful-handler';
    } else if (!reason && [...footprint.reads, ...footprint.writes].some((resource) =>
      resource.startsWith('state:') && dynamicState.has(resource.slice('state:'.length)))) {
      reason = 'dynamic-state-batch-journal-not-enabled';
    }
    fn.hiddenBatchEligible = reason === undefined;
    fn.hiddenBatchRejectionReason = reason;
    fn.hiddenBatchKeyWitnesses = reason === undefined && keyWitnesses.length > 0
      ? keyWitnesses : undefined;
    if (!reason) eligible.push(fn);
    if (!reason && graphTailCallEligible) graphTailHandlers.add(fn);
  }
  if (resourceShapedHandler?.hiddenBatchEligible) {
    for (const fn of eligible) {
      if (fn === resourceShapedHandler) continue;
      fn.hiddenBatchEligible = false;
      fn.hiddenBatchRejectionReason = 'resource-shaped-route-requires-one-handler';
    }
    eligible = [resourceShapedHandler];
  }
  if (eligible.some((fn) => (fn.hiddenBatchKeyWitnesses?.length ?? 0) > 0)) {
    for (const fn of eligible) {
      if ((fn.hiddenBatchKeyWitnesses?.length ?? 0) === 0) {
        fn.hiddenBatchEligible = false;
        fn.hiddenBatchRejectionReason = 'mixed-scalar-and-collection-route-not-enabled';
      }
    }
    eligible = eligible.filter((fn) => (fn.hiddenBatchKeyWitnesses?.length ?? 0) > 0);
  }
  const eligibleFootprint = (fn: FunctionDefinitionNode) => analyseFunctionFootprint(fn, byName);
  const eventMode = eligible.some((fn) => eligibleFootprint(fn).effects.includes('events'));
  const resultMode = eligible.some((fn) => fn.returnTypes.length > 0);
  const valueEffectMode = eligible.some((fn) => eligibleFootprint(fn).effects.includes('value'));
  let resultType: Type | undefined;
  if (resultMode) {
    resultType = eligible.find((fn) => fn.returnTypes.length > 0)?.returnTypes[0];
    for (const fn of eligible) {
      if (eventMode || fn.returnTypes.length !== 1
        || fn.returnTypes[0].toString() !== resultType?.toString()
        || eligibleFootprint(fn).effects.length > 0) {
        fn.hiddenBatchEligible = false;
        fn.hiddenBatchRejectionReason = 'result-route-requires-one-common-effect-free-return';
      }
    }
    eligible = eligible.filter((fn) => fn.hiddenBatchEligible === true);
  }
  if (eventMode) {
    for (const fn of eligible) {
      let directEmits = 0;
      walkInvocationAst(fn.body, (node) => {
        if (node instanceof EmitStatementNode) directEmits += 1;
      });
      const effects = eligibleFootprint(fn).effects;
      if (directEmits !== 1 || effects.length !== 1 || effects[0] !== 'events') {
        fn.hiddenBatchEligible = false;
        fn.hiddenBatchRejectionReason = 'event-route-requires-one-direct-event-per-handler';
      }
    }
    eligible = eligible.filter((fn) => fn.hiddenBatchEligible === true);
  }
  if (valueEffectMode) {
    for (const fn of eligible) {
      let directTransfers = 0;
      walkInvocationAst(fn.body, (node) => {
        if (node instanceof TransferStatementNode) directTransfers += 1;
      });
      const effects = eligibleFootprint(fn).effects;
      if (eventMode || resultMode || directTransfers !== 1
        || effects.length !== 1 || effects[0] !== 'value') {
        fn.hiddenBatchEligible = false;
        fn.hiddenBatchRejectionReason = 'value-route-requires-one-direct-transfer-per-handler';
      }
    }
    eligible = eligible.filter((fn) => fn.hiddenBatchEligible === true);
  }
  if (eligible.length === 0) return;

  const selector = (fn: FunctionDefinitionNode): string => binToHex(computeFunctionSelector(
    computeFunctionSignature(fn.name, fn.parameters.map((parameter) =>
      parameter.type.toString().replace(/address payable/g, 'address'))),
  ));
  const routeMaximumRows = resourceShapedHandler ? RESOURCE_SHAPED_BATCH_ROWS : MAX_HIDDEN_BATCH_ROWS;
  let resourceHandlerInvokeName: string | undefined;
  const graphHandlerInvokeNames = new Map<FunctionDefinitionNode, string>();
  if (resourceShapedHandler) {
    const handler = cloneNode(resourceShapedHandler);
    handler.name = `__scb_resource_${resourceShapedHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.hiddenBatchEligible = undefined;
    handler.hiddenBatchRejectionReason = undefined;
    handler.hiddenBatchKeyWitnesses = undefined;
    resourceHandlerInvokeName = handler.name;
    contract.functions.push(handler);
  }
  for (const sourceHandler of graphTailHandlers) {
    if (!eligible.includes(sourceHandler)) continue;
    const handler = cloneNode(sourceHandler);
    handler.name = `__scb_graph_${sourceHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.hiddenBatchEligible = undefined;
    handler.hiddenBatchRejectionReason = undefined;
    handler.hiddenBatchKeyWitnesses = undefined;
    handler.parameters = handler.parameters.filter((parameter) =>
      parameter.name !== '__internal__returnOutputIdx');
    handler.graphEmissionHandler = true;
    graphHandlerInvokeNames.set(sourceHandler, handler.name);
    contract.functions.push(handler);
  }
  const buildDecodeAndCall = (resultIndex?: number, rowIndex?: number): string =>
    eligible.map((fn, handlerIndex) => {
    const condition = `${handlerIndex === 0 ? 'if' : 'else if'} (rowSelector == hex"${selector(fn)}")`;
    const invokeName = fn === resourceShapedHandler
      ? resourceHandlerInvokeName!
      : (graphHandlerInvokeNames.get(fn) ?? fn.name);
    const invoke = (args: string): string => resultIndex === undefined
      ? `${invokeName}(${args});`
      : `__scb_result_${resultIndex} = ${invokeName}(${args});`;
    if (fn.parameters.length === 0) {
      return `${condition} { require(rowArgs.length == 0); ${invoke('')} }`;
    }
    const declarations = fn.parameters.map((parameter, i) =>
      `${parameter.type.toString()} __scb_arg_${handlerIndex}_${i}`);
    const schema = fn.parameters.map((parameter) => parameter.type.toString()).join(', ');
    const witnessName = (binding: { routeInput: string; perRow?: boolean }): string =>
      binding.perRow ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput;
    const witnessByInput = new Map((fn.hiddenBatchKeyWitnesses ?? [])
      .map((binding) => [binding.inputIndex, witnessName(binding)]));
    const keyChecks = (fn.hiddenBatchKeyWitnesses ?? []).map((binding) =>
      `require(__scb_arg_${handlerIndex}_${binding.inputIndex} == ${witnessName(binding)});`).join(' ');
    const callArgs = fn.parameters.map((_parameter, i) =>
      witnessByInput.get(i) ?? `__scb_arg_${handlerIndex}_${i}`).join(', ');
    const decode = declarations.length === 1
      ? `${declarations[0]} = abi.decode(rowArgs, (${schema}));`
      : `${declarations.join(', ')} = abi.decode(rowArgs, (${schema}));`;
    return `${condition} { ${decode} ${keyChecks} ${invoke(callArgs)} }`;
    }).join(' ');
  const usedRouteInputs = new Set(eligible.flatMap((fn) =>
    (fn.hiddenBatchKeyWitnesses ?? []).map((binding) => binding.routeInput)));
  const routeKeyParameters = [...routeKeyWitnesses.values()].flat()
    .filter((witness) => usedRouteInputs.has(witness.name))
    .flatMap((witness) => {
      const perRow = eligible.some((fn) => fn.hiddenBatchKeyWitnesses?.some((binding) =>
        binding.routeInput === witness.name && binding.perRow));
      return perRow
        ? Array.from({ length: routeMaximumRows }, (_unused, row) =>
          `${witness.type.toString()} ${witness.name}_r${row}`)
        : [`${witness.type.toString()} ${witness.name}`];
    });
  const graphRouteParameters = graphControllerLbc === undefined ? [] : [
    'bytes __internal__graphTranscript',
    'bigint __internal__graphControllerIdx',
    'bigint __internal__graphParticipantOffset',
    'bytes __internal__graphEmissions',
  ];
  const routeParameters = ['bytes batchBlob', ...graphRouteParameters, ...routeKeyParameters].join(', ');
  const parseOneRow = (rowExpression: string, resultIndex?: number, rowIndex?: number): string => `
          require(cursor + 12 <= batchBlob.length);
          bytes4 rowSelector = bytes4(batchBlob.slice(cursor, cursor + 4));
          cursor = cursor + 4;
          bigint callsite = int(bytes.concat(batchBlob.slice(cursor, cursor + 4), hex"00"));
          cursor = cursor + 4;
          require(callsite == ${rowExpression});
          bigint occurrence = int(bytes.concat(batchBlob.slice(cursor, cursor + 2), hex"00"));
          cursor = cursor + 2;
          require(occurrence == 0);
          bigint argsLength = int(bytes.concat(batchBlob.slice(cursor, cursor + 2), hex"00"));
          cursor = cursor + 2;
          require(argsLength >= 0 && cursor + argsLength <= batchBlob.length);
          bytes rowArgs = batchBlob.slice(cursor, cursor + argsLength);
          cursor = cursor + argsLength;
          ${buildDecodeAndCall(resultIndex, rowIndex)}
          else { revert("unknown batch selector"); }
  `;
  const parser = resourceShapedHandler
    ? Array.from({ length: routeMaximumRows }, (_unused, row) =>
      `{ ${parseOneRow(String(row), undefined, row)} }`).join(' ')
    : eventMode || resultMode || valueEffectMode
      ? Array.from({ length: routeMaximumRows }, (_unused, row) =>
        `if (rowCount > ${row}) { ${parseOneRow(String(row), resultMode ? row : undefined, row)} }`).join(' ')
    : `for (bigint row = 0; row < rowCount; row = row + 1) {
        ${parseOneRow('row')}
      }`;
  const resultDeclarations = resultMode
    ? Array.from({ length: MAX_HIDDEN_BATCH_ROWS }, (_unused, row) =>
      `${resultType!.toString()} __scb_result_${row};`).join(' ')
    : '';
  const returnDeclaration = resultMode
    ? ' returns (bytes)'
    : '';
  const returnStatement = resultMode
    ? `return abi.encode(${Array.from({ length: MAX_HIDDEN_BATCH_ROWS }, (_unused, row) =>
      `__scb_result_${row}`).join(', ')});`
    : '';
  const graphPrologue = graphControllerLbc === undefined ? '' : `
        require(__internal__graphControllerIdx >= 0
          && __internal__graphControllerIdx < tx.inputs.length
          && __internal__graphControllerIdx != this.activeInputIndex);
        require(tx.inputs[__internal__graphControllerIdx].lockingBytecode == hex"${graphControllerLbc}");
        require(tx.inputs[__internal__graphControllerIdx].tokenCategory.slice(0, 32)
          == hex"${graphControllerCategoryInternal}");
        require(tx.inputs[__internal__graphControllerIdx].tokenCategory.slice(32, 33) == hex"01");
        require(tx.inputs[__internal__graphControllerIdx].nftCommitment == sha256(__internal__graphTranscript));
        bytes __graph_owner_lbc = tx.inputs[this.activeInputIndex].lockingBytecode;
        bytes __graph_owner_frame = bytes.concat(
          bytes.concat(bytes2(this.activeInputIndex), bytes2(__graph_owner_lbc.length), __graph_owner_lbc),
          bytes2(batchBlob.length),
          batchBlob,
          bytes2(__internal__graphEmissions.length),
          __internal__graphEmissions
        );
        require(__internal__graphParticipantOffset >= 0
          && __internal__graphParticipantOffset + __graph_owner_frame.length <= __internal__graphTranscript.length);
        require(__internal__graphTranscript.slice(
          __internal__graphParticipantOffset,
          __internal__graphParticipantOffset + __graph_owner_frame.length
        ) == __graph_owner_frame);
  `;
  const source = `pragma solidcash >=0.8.0;
    contract __HiddenBatchHost() {
      function __scb1(${routeParameters}) external${returnDeclaration} {
        require(batchBlob.length >= 7);
        require(batchBlob.length <= ${MAX_HIDDEN_BATCH_BLOB_BYTES});
        bytes __scb_unlock = tx.inputs[this.activeInputIndex].unlockingBytecode;
        require(__scb_unlock.length >= 7);
        require(__scb_unlock.slice(0, 5) == hex"0453434231");
        bigint __scb_pushOpcode = int(bytes.concat(__scb_unlock.slice(5, 6), hex"00"));
        if (batchBlob.length <= 75) {
          require(__scb_pushOpcode == batchBlob.length);
          require(__scb_unlock.slice(6, 6 + batchBlob.length) == batchBlob);
        } else {
          require(__scb_pushOpcode == 76);
          bigint __scb_pushLength = int(bytes.concat(__scb_unlock.slice(6, 7), hex"00"));
          require(__scb_pushLength == batchBlob.length);
          require(__scb_unlock.slice(7, 7 + batchBlob.length) == batchBlob);
        }
        require(batchBlob.slice(0, 4) == hex"53434231");
        require(batchBlob.slice(4, 5) == hex"01");
        require(batchBlob.slice(5, 6) == hex"00");
        ${graphPrologue}
        bigint rowCount = int(bytes.concat(batchBlob.slice(6, 7), hex"00"));
        require(${resourceShapedHandler
    ? `rowCount == ${routeMaximumRows}`
    : `rowCount >= 1 && rowCount <= ${routeMaximumRows}`});
        bigint cursor = 7;
        ${resultDeclarations}
        ${parser}
        require(cursor == batchBlob.length);
        // Keep the emission witness live through compiler-owned call verification above. The generated verifier
        // consumes a copy directly, so this source-level final reference prevents last-use stack relocation.
        ${graphControllerLbc === undefined
    ? ''
    : 'require(__internal__graphEmissions == __internal__graphEmissions);'}
        ${returnStatement}
      }
    }`;
  const routeAst = parseCode(source, undefined, false, compilerOptions.chunkedArrays);
  const route = routeAst.contract.functions[0];
  route.hiddenBatchRoute = true;
  route.hiddenBatchMaximumRows = routeMaximumRows;
  route.location = contract.location;
  contract.functions.push(route);
}

// Compile a parsed+resolved AST (whose `contract` is the chosen primary) into a single Artifact. Shared by
// compileString and compileStringMulti.
function compileResolvedAst(
  ast: Ast, code: string, mergedCompilerOptions: CompilerOptions, omitConstructor = false,
): Artifact {
  // A library file compiled directly: if its primary library has explicitly public/external functions, lower
  // it to a stateless contract artifact (docs/library-contracts.md Phase 2). A library with only inline
  // (internal/unmarked) functions has no entry point and cannot be compiled standalone.
  if (ast.isLibrary) {
    if (!ast.libraryContract) {
      // A standalone interface, a file-level enum/struct, or an inline-only library has no executable contract;
      // emit a minimal ABI-only declaration artifact (like solc: ABI + empty bytecode) instead of erroring.
      return generateDeclarationArtifact(ast, code);
    }
    ast.contract = ast.libraryContract;
    ast.isLibrary = false;
    const prefix = `${ast.libraryName}.`;
    ast.freeFunctions = ast.freeFunctions.filter((f) => !f.name.startsWith(prefix));

    // Brand a state-touching (delegate) library: append a `bytes32 __brand` ctor arg (the owning consumer's
    // category) so the delegate covenant can pin the co-spent proxy master to it. Only meaningful when the
    // library delegates (the brand-check lives in the delegate master-validation). See docs/library-contracts.md.
    if (mergedCompilerOptions.brandLibrary
      && ast.contract.functions.some((f) => f.modifiers.includes(FunctionModifier.DELEGATE))) {
      ast.contract.isBrandedLibrary = true;
      const brandParam = new ParameterNode(new BytesType(32), '__brand');
      brandParam.location = ast.contract.location;
      brandParam.syntheticallyUsed = true; // used by the brand-check covenant, not an AST reference
      ast.contract.parameters.push(brandParam);
    }
  }

  // Desugar `using L for T` method calls in each contract's OWN lexical scope BEFORE inheritance/modifier expansion
  // inline+substitute parent constructors/modifiers. A parent ctor's `name.toShortStringWithFallback(fb)` becomes
  // `ShortStrings.toShortStringWithFallback(name, fb)` (a real arg node) while `name` is still the parent's param, so
  // the constructor-arg substitution can then rewrite it - it cannot reach a receiver embedded in a call identifier.
  ast = ast.accept(new RedesugarImportedUsingForCalls(true)) as Ast;

  // Inheritance expansion (after import resolution, before modifier expansion)
  ast = expandInheritance(ast);

  // OpenZeppelin upgradeable bases reserve future EVM storage slots with private fixed arrays named `__gap`.
  // They carry no runtime value and are never read; materializing them in CashToken commitments can consume
  // kilobytes (e.g. uint256[50]) while providing none of their EVM layout benefit. In Solidity-compat mode,
  // preserve their intended meaning by omitting the reservation from BCH state altogether.
  if (mergedCompilerOptions.solidityImportCompat) {
    ast.contract.stateVariables = ast.contract.stateVariables.filter((variable) => variable.name !== '__gap');
  }

  // Validate source-level location and modifier rules before storage/memory pointer lowerings erase the
  // declarations that carry them. This mirrors solc's declaration type checking and keeps lowerings simpler.
  ast = ast.accept(new ValidateDataLocations()) as Ast;

  // Lower `transient` state vars to per-function locals - AFTER inheritance so a base's transient var is lowered
  // into the derived contract's functions too.
  ast = lowerTransientStateVars(ast);

  // Every mapping uses the authenticated C2 backend. There is no omission-prone legacy mapping fallback.
  for (const col of ast.contract.collections) {
    if (col.type instanceof MappingType) col.sorted = true;
  }

  // A standalone abstract contract has no deployable bytecode; emit an ABI-only declaration artifact (solc
  // parity - abstract contracts have an ABI + empty bytecode), like interface / decl-only files.
  if (ast.contract.isAbstract) {
    return generateDeclarationArtifact(ast, code);
  }

  // A foreign fn-ptr ARRAY (dispatch table) with a fixed method -> a plain `address[]` state var + the shipped
  // array-element co-spend `IFace(fns[i]).m()`. Runs FIRST so the moved array is a native `address[]` to every
  // later pass (the fn-ptr array parses as a COLLECTION; a plain address array is a dynamic-array STATE VAR).
  ast = ast.accept(new LowerForeignFunctionPointerArrayElements()) as Ast;

  // Fold keccak256/sha256 of a string/hex literal to a compile-time bytes32 constant (role ids, EIP-712
  // domains, EVM storage slots). Both fold to their REAL hash (keccak256 -> real keccak, Ethereum-identical).
  ast = ast.accept(new FoldHashLiterals()) as Ast;

  // Solidity public state-var/mapping auto-getters -> real entry-point functions, so a ported callee invoked
  // via a getter (`timeLock.lockTime(addr)`) actually dispatches it. Gated on solidityImportCompat.
  ast = ast.accept(new SynthesizePublicGetters(mergedCompilerOptions.solidityImportCompat ?? false)) as Ast;

  // Solidity has no `delegate` lifecycle keyword. An OZ-style upgradeable implementation identifies itself via
  // an `initializer`/`reinitializer` modifier; every externally callable implementation function (including the
  // synthesized public-state getters above) is intended to execute in the proxy's state context. Mark that surface
  // before modifier expansion consumes the custom-modifier metadata. Native SolidCash sources remain explicit.
  if (mergedCompilerOptions.solidityImportCompat && ast.contract.functions.some((fn) => fn.customModifiers.some(
    (modifier) => modifier.name === 'initializer' || modifier.name === 'reinitializer',
  ))) {
    for (const fn of ast.contract.functions) {
      const externallyCallable = fn.modifiers.includes(FunctionModifier.PUBLIC)
        || fn.modifiers.includes(FunctionModifier.EXTERNAL);
      if (externallyCallable && !fn.modifiers.includes(FunctionModifier.DELEGATE)) {
        // Delegate execution is a state-covenant spend even for Solidity `view`/`pure` declarations; the proxy
        // shim may still expose read ergonomics, but the implementation entry itself must use delegate layout.
        fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.VIEW
          && modifier !== FunctionModifier.PURE);
        fn.modifiers.push(FunctionModifier.DELEGATE);
      }
    }
  }

  // Modifier expansion (before semantic analysis)
  ast = expandModifiers(ast);

  // The compiler-owned route must participate in the same helper/state
  // lowerings as source entry points. In particular, collection-bearing
  // handlers need their authenticated entry operations inlined into this
  // physical wrapper before block-layout analysis. Synthesizing it only at the
  // final semantic boundary works for scalar state but makes collection
  // effects invisible to the route.
  const hiddenBatchFunctionsByName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of ast.contract.functions) {
    const group = hiddenBatchFunctionsByName.get(fn.name) ?? [];
    group.push(fn);
    hiddenBatchFunctionsByName.set(fn.name, group);
  }
  const synthesizeBatchBeforeLowering = !!mergedCompilerOptions.experimentalHiddenBatch
    && ast.contract.functions.some((fn) => {
      const footprint = analyseFunctionFootprint(fn, hiddenBatchFunctionsByName);
      return [...footprint.reads, ...footprint.writes]
        .some((resource) => resource.startsWith('collection:'))
        || footprint.effects.length > 0
        || fn.returnTypes.length > 0;
    });
  if (synthesizeBatchBeforeLowering) synthesizeHiddenBatchRoute(ast, mergedCompilerOptions);

  // OZ StorageSlot / ERC-7201 idiom: `XSlot storage d = StorageSlot.getXSlot(SLOT); d.value = v` (PARAM factory)
  // and `S storage $ = _getXStorage(); $.f = v` (ERC-7201 CONST factory) -> the __evm_storage register / promoted
  // packed state. Consumes the slot-pointer factory's assembly before it reaches LowerInlineAssembly. Runs AFTER
  // expandModifiers so factory uses inside OZ initializer/reinitializer modifiers (now inlined into fn bodies) are
  // rewritten too (else the factory method is dropped with a dangling call left in the modifier body).
  ast = ast.accept(new LowerStorageSlotPointers()) as Ast;

  // Redo the using-for method desugar for calls whose receiver is an IMPORTED struct (unknown at parse time, so
  // the AstBuilder left `x.method()` raw): `x.method(args)` -> `L.method(x, args)`. After modifier expansion (so
  // inlined modifier bodies are covered) and reresolveImportedStructTypes (types resolved), before the inline
  // passes (a `T storage`-taking library method is inlined-and-dropped there).
  ast = ast.accept(new RedesugarImportedUsingForCalls()) as Ast;

  // A field write on a LOCAL/PARAM struct var whose struct type was IMPORTED (`escrow.split[j]=v`, `escrow.claimed=v`
  // on `Escrow memory escrow`) was mis-built at parse - the type was unknown, so the AstBuilder emitted a mapping-field
  // assign (array field) or a field-dropping StateAssign (scalar field). Rewrite both into the read-modify-rebuild
  // block the AstBuilder emits for a same-file struct local. Before LowerMemoryModel (which lowers the rebuild).
  ast = ast.accept(new RedesugarImportedStructFieldWrites()) as Ast;

  // `T.wrap(x)` / `T.unwrap(x)` on an IMPORTED user-defined value type (unknown at parse, so the AstBuilder left it
  // a dangling `T.wrap` FunctionCall) -> the identity cast the AstBuilder emits for a same-file UDVT. PRB-math's
  // UD2x18/UD60x18 converters + constants reach this transitively via Sablier.
  ast = ast.accept(new RedesugarImportedUdvtWrap()) as Ast;

  // Desugar `return` inside a loop -> flag + break + post-loop return (before break/continue expansion so the
  // injected breaks are lowered; internal functions can't raw-return from inside a loop's balanced stack).
  ast = ast.accept(new DesugarReturnInLoop()) as Ast;

  // Unroll a FIXED-BOUND for-loop that writes a mapping into N static writes (which the per-slot machinery already
  // handles - a mapping write in a RUNTIME loop is rejected by EntryWriteInLoopError). Before break/continue
  // expansion (so raw break/continue still gate it out) + SymbolTableTraversal (so the static writes get slots).
  ast = ast.accept(new UnrollFixedBoundEntryLoop()) as Ast;

  // Canonical dynamic C2 `m[i] = f(i)` loops execute through a hidden SDK-derived slot-order permutation.
  ast = ast.accept(new LowerC2CounterLoops()) as Ast;

  // Break/continue expansion (before semantic analysis)
  ast = expandBreakContinue(ast);

  // Named-return desugar (before semantic analysis): named returns become default-init locals.
  ast = ast.accept(new NamedReturnTransformation()) as Ast;

  // A return nested under further conditions with fall-through (internal fns) -> flag + gated tail +
  // terminal return (after NamedReturn so implicit tails are explicit; before semantic so locals resolve).
  ast = ast.accept(new DesugarNestedBranchReturn()) as Ast;

  // Postfix `lvalue++`/`lvalue--` used as an expression -> read + a hoisted increment (before semantic analysis).
  ast = ast.accept(new DesugarPostfixExpressions()) as Ast;

  // Coalesce consecutive whole-field writes to the same C2 mapping entry (`m[k].a=x; m[k].b=y`) into one entry
  // read + one whole-struct write, replacing N sorted-mapping upserts with one.
  ast = ast.accept(new CoalesceMappingEntryFieldWrites()) as Ast;

  // Coalesce a run of consecutive element writes to the same fixed-array field of a memory struct local (each
  // desugared to a whole-struct rebuild) into one read + one rebuild. After RedesugarImportedStructFieldWrites (so
  // imported-struct triples exist), before LowerMemoryModel (which lowers the rebuild).
  ast = ast.accept(new CoalesceStructFieldArrayWrites()) as Ast;

  // Memory model: lower local `memory` reference types to linear-buffer pointer ops before the value-copy
  // desugars, so nested writes compose in place. The safety gate falls unsupported locals back to value-copy.
  ast = ast.accept(new LowerMemoryModel()) as Ast;

  // Value-copy the local `bytes` element writes (`b[i] = v`) LowerMemoryModel did not convert to a pointer byte-
  // splice: rebuild the whole blob. Runs right after the memory model so converted buffers are already splices.
  ast = ast.accept(new DesugarLocalBytesElementWrite()) as Ast;

  // Nested local-array element write `b[i][j] = v` -> read-modify-write over single-level ops (before semantic).
  ast = ast.accept(new DesugarNestedArrayWrite()) as Ast;

  // A gratuitous internal fn-ptr state-var alias (`ev = eval; ev(x)`) -> the direct call (`eval(x)`), removing the
  // alias var. Sidesteps a higher-order internal-fn-ptr type mismatch; before any fn-ptr lowering.
  ast = ast.accept(new EliminateInternalFnPtrAlias()) as Ast;

  // A contract instance's method as a fn-ptr VALUE (`o.m` / `(new C()).m`) -> the recognised `C(o).m` member
  // form (inline-new hoisted to a named deploy local). Before the fn-ptr passes so the member flows through.
  ast = ast.accept(new DesugarContractMemberFnPtr()) as Ast;

  // A foreign fn-ptr RETURNED from / PASSED through a side-effect-free single-return helper (`make(a){ return
  // IFoo(a).m; }`, `eval(y){ return y(7); }`) -> beta-reduced into its call sites. Before InterproceduralStoreFold
  // so a helper-returned `x(..)` call (`eval(x)` -> `x(7)`) is present for the fold to rewrite.
  ast = ast.accept(new InlineForeignFunctionPointerReturns()) as Ast;

  // Interprocedural deploy fold through a store helper (store_function core): `store(C(o).m); x(..)` rewrites the
  // same-tx `x(..)` to `o.m(..)` so a freshly-deployed child called via a stored fn-ptr folds. Before the split.
  ast = ast.accept(new InterproceduralStoreFold()) as Ast;

  // A foreign fn-ptr PASSED to a DIFFERENT contract over an external call (`IB(b).register(ITarget(t).m, ..)`)
  // -> split the fn-ptr member arg into (address, selector) to match the callee's lowered fn-ptr param.
  ast = ast.accept(new SplitExternalCallFnPtrArgs()) as Ast;

  // Straight-line foreign external function pointer `function() external f = IFoo(addr).method; f(args)` ->
  // `IFoo(addr).method(args)` (the existing external call); before the external-call passes + semantic.
  ast = ast.accept(new DesugarExternalFunctionPointers()) as Ast;

  // A foreign external fn-ptr STATE var holding a fixed method on a runtime address (`function() external x;
  // x = IFoo(a).m; x(v)`) -> an `address` state var + the state-address external call `IFoo(x).m(v)`.
  ast = ast.accept(new LowerForeignFunctionPointerVars()) as Ast;
  // A foreign fn-ptr STRUCT FIELD holding a fixed method (nested analogue of the state-var pass) -> an
  // interface-typed field + the shipped struct-field-chain call `s.field.m()`. Before the address-local synth.
  ast = ast.accept(new LowerForeignFunctionPointerStructFields()) as Ast;
  ast = ast.accept(new LowerForeignFunctionPointerParams()) as Ast;
  // A foreign fn-ptr STATE var holding a RECEIVED value (`x = y`, method carried in the value) -> an `address`
  // field + a `bytes4 __fnsel_x` companion + the state-address external call with a runtime selector. Runs after
  // the PARAM lowering (which splits `y` into address + `__fnsel_y`) that this pass reads the selector from.
  ast = ast.accept(new LowerForeignFunctionPointerStorage()) as Ast;
  // A foreign fn-ptr ARRAY holding RECEIVED values (`fns.push(p)`) -> `address[]` + a parallel `bytes[]`
  // selector array + the per-element on-chain-selector dispatch loop with SDK-filled witness master indices
  // (the array analogue of the storage pass). After the param lowering that splits `p` -> `__fnsel_p`.
  ast = ast.accept(new LowerReceivedFnPtrArray()) as Ast;
  // A RECEIVED-value foreign fn-ptr in a struct field (method carried in the value) -> a bytes BLOB
  // `selector ++ address`; a call slices it into an audited state-address external call. After the fixed-method
  // struct-field pass (only received-value fields remain).
  ast = ast.accept(new LowerBlobFunctionPointers()) as Ast;

  // Lower supported Yul inline assembly to equivalent main-AST statements (value computation + control flow).
  ast = ast.accept(new LowerInlineAssembly()) as Ast;

  // Inline void helpers that make external calls into their internal call sites (the external co-spend can't
  // cross an OP_INVOKE boundary); reduces to the entry-point-body external-call case.
  ast = ast.accept(new InlineExternalCallHelpers()) as Ast;

  // `address(this).call(payload)` -> a plain internal call (+ constant true success). Before the inline
  // passes so a state-touching callee (incl. the fallback) is inlined into the entry point like any other.
  ast = ast.accept(new LowerSelfLowLevelCalls()) as Ast;

  // `(new C()).m(args)` -> `C __newcall_N = new C(); __newcall_N.m(args)`, so the deploy-then-call fold
  // machinery (which tracks named deploy locals) applies to inline deploy receivers too.
  ast = ast.accept(new HoistInlineDeployCalls()) as Ast;

  // `A.getter().m(args)` (getter returns a contract) -> `IReturn __chaincall_N = A.getter(); __chaincall_N.m(..)`,
  // so the chained call on the getter's (integrity-bound) return dispatches via the audited interface-local path.
  ast = ast.accept(new HoistChainedContractCalls()) as Ast;

  // Lower eligible single-entry mapping helpers to value-threaded OP_INVOKE handlers before the legacy
  // entry-reading inline passes see them.
  ast = ast.accept(new LowerDynamicStateJournalHelpers()) as Ast;
  ast = ast.accept(new LowerCollectionJournalHelpers()) as Ast;

  // Inline value-returning private helpers that read a state entry at their expression call sites (hoist the
  // body, capture the return in a temp). Same block-layout reason as the void case below; run first so a void
  // helper containing such a call is resolved before it is itself inlined.
  ast = ast.accept(new InlineReturningStateHelpers()) as Ast;

  // Inline void calls to functions taking `storage` reference params; a storage pointer has no value
  // representation, so the callee is substituted into the caller as direct state access.
  ast = ast.accept(new InlineStoragePointerCalls(mergedCompilerOptions.solidityImportCompat ?? false)) as Ast;
  // A function returning a REASSIGNED `mapping storage` pointer (`returns (mapping storage r){ r=a; r=b; }`) is
  // resolved by straight-line dataflow into its side effects + the mapping it finally aliases, and inlined at call
  // sites - producing bare `mapping storage m = <mapping>` aliases the next pass handles.
  ast = ast.accept(new InlineMappingReturnFunctions()) as Ast;
  // A `mapping(..) storage m = get()` local (get() inlined above to a bare mapping or `c ? a : b`) has no runtime
  // value; rewrite each `m[k]` use to the underlying mapping (or a branch/ternary) and drop the declaration.
  ast = ast.accept(new LowerMappingStorageAlias()) as Ast;

  // Re-run the fixed-bound unroll AFTER inlining: a `new T[](N)` literal substituted for an array param at an
  // inline site (`_updateJobWhitelist(id, allowed, new address[](0))`) now makes the loop bound compile-time
  // constant. N==0 unrolls to zero iterations, eliminating the provably-dead loop before its body (e.g. a C2
  // sorted-mapping write over the empty array) reaches the entry-slot pre-scan / codegen. The first pass (before
  // inlining) can't see the literal, and everything it could unroll it already did, so this pass only fires on
  // these post-inline new-array-bound loops.
  ast = ast.accept(new UnrollFixedBoundEntryLoop()) as Ast;

  // A whole dynamic-array copy with a differing element type (`bytes10[] = bytes8[]`) desugars to a delete +
  // per-element casting push loop; must precede CacheDynamicArrayInLoop so the emitted push-in-loop is cached.
  ast = ast.accept(new DesugarDynamicArrayCopyCast()) as Ast;
  // A dynamic (chunk-backed) array written inside a loop can't use the once-per-function pending-value write
  // model; cache it in a local, mutate the local in the loop, flush back once.
  ast = ast.accept(new CacheDynamicArrayInLoop()) as Ast;
  // A C2 (sorted) mapping ARRAY value written in a loop `for(..) m[k][j]=v` is cached the same way: read m[k] once,
  // mutate the local array in the runtime loop, flush `m[k] = local` as one upsert (never unroll the loop).
  ast = ast.accept(new CacheMappingEntryInLoop()) as Ast;

  // A conditional `delete m[k]` inside a branch does not delete on the taken path (the covenant can't statically
  // tell it ran). If-convert it to an unconditional predicated write `m[k] = cond ? default : m[k]`.
  ast = ast.accept(new IfConvertConditionalEntryOp()) as Ast;

  // Constructor external reads (`token0 = IERC20(pool.token0())`) -> synthesized deploy-input params (BCH has
  // no on-chain constructor; the read is resolved off-chain at deploy). Runs before the target-address synth.
  ast = ast.accept(new PromoteConstructorExternalReads()) as Ast;
  // A branch-local interface-cast external-call target variable -> hoist its DECLARATION to the body top so the
  // co-spend reads it at the epilogue (UniswapV2Pair mint's `migrator`); the external calls stay conditional.
  ast = ast.accept(new HoistBranchLocalExtcallTargets()) as Ast;
  // Interface-typed state vars used as external-call targets -> synthesized address locals (reuses the
  // local-interface-var dispatch).
  ast = ast.accept(new SynthesizeExternalAddressLocals()) as Ast;
  // A NON-LOOP param-rooted array-element target `IERC20(path[path.length-1]).m()` -> hoist to a function-top
  // address local so it is a fixed-slot co-spend (not mistaken for a per-iteration loop-array dispatch).
  ast = ast.accept(new HoistNonLoopArrayElemExtcallTargets()) as Ast;
  // A contract/interface-typed external-call target LOCAL declared in a branch (e.g. a `restricted` modifier's
  // if-wrapper) is popped before the epilogue's co-spend verification -> capture it into a function-top local.
  ast = ast.accept(new CaptureBranchExternalCallTargets()) as Ast;
  // `L.f()` calls to a state-touching (delegate) library -> a delegatecall against the caller's state (with a
  // synthesized library-address constructor arg). See docs/library-contracts.md (3b sugar).
  ast = ast.accept(new SynthesizeLibraryDelegateCalls()) as Ast;
  // Oracle-backed block.* reads -> injected uint32 state-var registers + desugared state reads.
  const blockOracle = new SynthesizeBlockOracle();
  ast = ast.accept(blockOracle) as Ast;

  // Drop free/library functions the contract never reaches (OZ libraries ship many unused helpers). Runs last,
  // after every synthesis pass, so no reachable call is missed; conservative by name so nothing live is dropped.
  ast = ast.accept(new PruneUnreachableFreeFunctions()) as Ast;

  // Drop dead internal/private methods that read msg.data (e.g. inherited OZ `Context._msgData`, never called):
  // msg.data is only reconstructible at an entry point, so a dead one would fail the whole compile. Conservative
  // by name (every non-internal method is a root), so nothing live is dropped.
  ast = ast.accept(new PruneUnreachableMsgDataMethods()) as Ast;

  // Facets are deployed as branded delegate-only libraries and never execute the logical contract's constructor.
  // Several normalization passes can synthesize or reconstruct a constructor after inheritance flattening, so
  // enforce omission at the semantic boundary rather than relying only on the early facet mutation.
  if (omitConstructor) ast.contract.constructorDef = undefined;

  // Storage-lowering passes can synthesize mappings after the source collections were normalized above
  // (notably assembly sstore/sload and ERC-7201 storage pointers). Keep the backend invariant global: every
  // mapping, including compiler-generated mappings, uses authenticated C2 storage.
  for (const col of ast.contract.collections) {
    if (col.type instanceof MappingType) col.sorted = true;
  }

  if (!synthesizeBatchBeforeLowering) synthesizeHiddenBatchRoute(ast, mergedCompilerOptions);

  // Semantic analysis
  ast = ast.accept(new SymbolTableTraversal(mergedCompilerOptions)) as Ast;
  ast = ast.accept(new TypeCheckTraversal()) as Ast;
  ast = ast.accept(new EnsureFinalRequireTraversal(mergedCompilerOptions.enforceFinalRequire)) as Ast;

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

  // Bytecode optimisation. The emitted bytecode is the new optimiser's output; optimiseBytecodeOld is only a
  // backwards-compat cross-check, and it runs its own up-to-1000-pass fixpoint, prohibitively slow on very large
  // scripts (e.g. big fixed-size arrays). Skip the cross-check above a size threshold - it never changes output.
  const optimisationResult = optimiseBytecode(
    traversal.output,
    sourceMapToLocationData(traversal.sourceMap),
    traversal.consoleLogs,
    traversal.requires,
    constructorParamLength,
  );

  if (traversal.output.length <= OPTIMISER_COMPAT_CHECK_MAX_OPS) {
    const optimisedBytecodeOld = optimiseBytecodeOld(traversal.output);
    if (scriptToAsm(optimisedBytecodeOld) !== scriptToAsm(optimisationResult.script)) {
      console.error(scriptToAsm(optimisedBytecodeOld));
      console.error(scriptToAsm(optimisationResult.script));
      throw new Error('New bytecode optimisation is not backwards compatible, please report this issue to the SolidCash team');
    }
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

  const artifact = generateArtifact(
    ast, optimisationResult.script, code, debug, mergedCompilerOptions, functionBodies, fingerprint,
  );
  const artifactBytes = debug.bytecode.length / 2;
  if (artifactBytes > MAX_INPUT_BYTESIZE) {
    artifact.diagnostics = [{
      severity: 'error',
      code: 'contract-size-limit',
      message: `Contract '${artifact.contractName}' is ${artifactBytes} bytes, exceeding the BCH `
        + `${MAX_INPUT_BYTESIZE}-byte input-script limit; it cannot be deployed without splitting or reduction.`,
    }];
  }
  const hiddenBatchRouteAbi = artifact.abi.find((fn) => fn.name === '__scb1');
  if (hiddenBatchRouteAbi) artifact.abi = artifact.abi.filter((fn) => fn !== hiddenBatchRouteAbi);
  const invocationAnalysis = analyseContractInvocations(ast.contract);
  const invocationFunctionById = new Map(
    [...ast.contract.functions, ast.contract.fallbackDef, ast.contract.receiveDef]
      .filter((fn): fn is FunctionDefinitionNode => !!fn && fn.functionId !== undefined)
      .map((fn) => [fn.functionId!, fn]),
  );
  const selectorById = new Map(
    [...ast.contract.functions, ast.contract.fallbackDef, ast.contract.receiveDef]
      .filter((fn): fn is FunctionDefinitionNode => !!fn && fn.functionId !== undefined)
      .map((fn) => [fn.functionId!, fn.functionSelector ? binToHex(fn.functionSelector) : undefined]),
  );
  artifact.invocationAnalysis = {
    version: 1,
    functions: invocationAnalysis.functions.map((summary) => ({
      id: summary.id,
      name: summary.name,
      arity: summary.arity + (invocationFunctionById.get(summary.id)?.journalContextArity ?? 0),
      entryPoint: summary.entryPoint,
      ...(selectorById.get(summary.id) && { selector: selectorById.get(summary.id) }),
      calls: summary.calls,
      closure: summary.closure,
      component: summary.component,
      recursive: summary.recursive,
      reads: summary.footprint.reads,
      writes: summary.footprint.writes,
      effects: summary.footprint.effects,
      unknown: summary.footprint.unknown,
    })),
    components: invocationAnalysis.components,
  };
  if (mergedCompilerOptions.experimentalHiddenBatch
    && ast.contract.functions.some((fn) => fn.hiddenBatchRoute)) {
    const hiddenBatchMaximumRows = ast.contract.functions.find((fn) =>
      fn.hiddenBatchRoute)?.hiddenBatchMaximumRows ?? MAX_HIDDEN_BATCH_ROWS;
    artifact.hiddenBatch = {
      version: 1,
      selector: SCB1_SELECTOR_HEX,
      ...(hiddenBatchMaximumRows === RESOURCE_SHAPED_BATCH_ROWS
        && { minimumRows: RESOURCE_SHAPED_BATCH_ROWS }),
      maximumRows: hiddenBatchMaximumRows,
      maximumBlobBytes: MAX_HIDDEN_BATCH_BLOB_BYTES,
      ...(mergedCompilerOptions.experimentalMessageBusController && {
        graphControllerLockingBytecode: mergedCompilerOptions.experimentalMessageBusController.toLowerCase(),
        graphControllerCategory: mergedCompilerOptions.experimentalMessageBusControllerCategory!.toLowerCase(),
      }),
      route: hiddenBatchRouteAbi!,
      handlers: ast.contract.functions.filter((fn) => !fn.hiddenBatchRoute && fn.isEntryPoint).map((fn) => ({
        name: fn.name,
        selector: fn.functionSelector ? binToHex(fn.functionSelector) : '',
        inputs: fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__')).map((parameter) => ({
          name: parameter.name,
          type: parameter.type.toString().replace(/address payable/g, 'address'),
        })),
        ...(fn.returnTypes.length > 0 && {
          outputs: fn.returnTypes.map((type) => ({
            type: type.toString().replace(/address payable/g, 'address'),
          })),
        }),
        eligible: fn.hiddenBatchEligible === true,
        ...(fn.hiddenBatchRejectionReason && { rejectionReason: fn.hiddenBatchRejectionReason }),
        ...(fn.hiddenBatchKeyWitnesses && { batchKeyWitnesses: fn.hiddenBatchKeyWitnesses }),
      })),
    };
  }
  // Marker for the off-chain keeper: this contract reads blockhash(n) -> maintain the (n->hash) oracle.
  if (blockOracle.usesBlockhash) artifact.usesBlockhash = true;
  return artifact;
}

/**
 * Compile EVERY top-level declaration in `code` (and its imports) to its own Artifact, keyed by name -
 * solc's `contracts[name]` model. Each concrete contract / library is compiled with itself as the primary
 * (the others available as siblings/imports); each interface yields an ABI-only declaration artifact.
 * Abstract contracts are excluded (not deployable). `compileString` is unchanged (single primary artifact).
 * See docs/multi-contract-artifacts.md.
 */
export function compileStringMulti(code: string, compilerOptions: CompileOptions = {}): ArtifactMap {
  const { errorListener, ...artifactCompilerOptions } = compilerOptions;
  const mergedCompilerOptions = { ...DEFAULT_COMPILER_OPTIONS, ...artifactCompilerOptions };

  // Enumerate the top-level contracts (after import resolution, so imported deps are included). The default
  // parse leaves the last as primary; the full set is [...importedContracts, contract].
  const probe = parseAndResolve(code, mergedCompilerOptions, errorListener);
  const allContracts = [...probe.importedContracts, probe.contract].filter(Boolean);
  const interfaces = probe.interfaceDefinitions ?? [];

  const map: ArtifactMap = {};
  const seen = new Set<string>();
  for (const contract of allContracts) {
    if (!contract || seen.has(contract.name)) continue;
    seen.add(contract.name);
    if (contract.isAbstract) continue; // abstract contracts are not deployable - excluded, like solc
    // Re-parse + resolve fresh per contract (the per-contract pipeline mutates the AST); select it as primary.
    const ast = parseAndResolve(code, mergedCompilerOptions, errorListener, contract.name);
    map[contract.name] = compileResolvedAst(ast, code, mergedCompilerOptions);
  }

  // Contract-less: each interface -> an ABI-only declaration artifact (function dispatch for external calls).
  for (const iface of interfaces) {
    if (map[iface.name]) continue; // a concrete contract of the same name wins
    map[iface.name] = generateInterfaceArtifact(probe, iface.name, code);
  }

  return map;
}

type PlannedFunction = {
  name: string;
  closure: Set<string>;
  footprint: SplitStateFootprint;
};

const LIFECYCLE_MODIFIERS = new Set([
  FunctionModifier.DEPLOY, FunctionModifier.UPGRADE, FunctionModifier.SELFDESTRUCT,
  FunctionModifier.SPLIT, FunctionModifier.MERGE, FunctionModifier.UNSAFE,
]);

/**
 * Compile a contract into a statically-linked one-hop root/facet bundle. This API is additive: ordinary compile
 * entry points retain their existing Artifact return type and bytecode. The splitter operates on fresh ASTs for
 * every shard, so the normal mutating compiler pipeline remains isolated per artifact.
 */
export function compileStringSplit(code: string, compilerOptions: SplitCompileOptions = {}): SplitArtifactBundle {
  const { maxShardBytes = MAX_INPUT_BYTESIZE, forceSplit = false, errorListener, ...artifactOptions } = compilerOptions;
  const merged = { ...DEFAULT_COMPILER_OPTIONS, ...artifactOptions };
  const baseline = compileString(code, { ...artifactOptions, errorListener });
  const probe = prepareSplitAst(code, merged, errorListener);
  const logicalName = probe.contract.name;
  const functions = probe.contract.functions;
  const byName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of functions) (byName.get(fn.name) ?? byName.set(fn.name, []).get(fn.name)!).push(fn);
  const overloadedEntries = [...byName.entries()].filter(([, defs]) => defs.filter((fn) => fn.isEntryPoint).length > 1);
  if (forceSplit && overloadedEntries.length > 0) {
    throw new Error(
      `Cannot split '${logicalName}': overloaded entry points require selector-keyed SDK routing: `
      + overloadedEntries.map(([name]) => name).join(', '),
    );
  }

  const plans = (baseline.stateLayout ? functions.filter((fn) => isMovableSplitEntry(fn)) : []).map((fn) => ({
    name: fn.name,
    closure: collectNamedFunctionClosure(fn, byName),
    footprint: analyseFunctionFootprint(fn, byName),
  }));

  if ((!forceSplit && byteSize(baseline) <= maxShardBytes) || plans.length === 0) {
    if (byteSize(baseline) > maxShardBytes) {
      throw new Error(splitFailureMessage(logicalName, baseline, maxShardBytes, functions));
    }
    return unsplitBundle(baseline, plans);
  }

  // Hard-union entries that call one another. Then pack the atomic groups by two objectives: preserve state/effect
  // affinity first, and minimize facet count second. Candidate ordering uses cached component sizes as a cheap
  // best-fit heuristic; acceptance always compiles the union and checks its actual optimized bytecode, including
  // shared helpers and delegate covenant overhead. This avoids eagerly recompiling every pair on every round.
  let groups = hardClosureGroups(plans);
  const measuredBytes = new Map<string, number>();
  const groupKey = (group: PlannedFunction[]): string => group.map((plan) => plan.name).sort().join(',');
  const measure = (group: PlannedFunction[]): number => {
    const key = groupKey(group);
    const cached = measuredBytes.get(key);
    if (cached !== undefined) return cached;
    const bytes = byteSize(compileFacet(code, merged, errorListener, group, 'ProbeFacet'));
    measuredBytes.set(key, bytes);
    return bytes;
  };
  // Phase one preserves the v1 affinity behavior: exhaust useful state-local merges before considering unrelated
  // functions. This bounds probing on large imported contracts because zero-affinity combinations are postponed.
  let mergedAffinity = true;
  while (mergedAffinity) {
    mergedAffinity = false;
    const candidates: Array<{
      affinity: number; left: number; right: number; plans: PlannedFunction[]; key: string;
    }> = [];
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const candidatePlans = uniquePlans([...groups[i], ...groups[j]]);
      const affinity = stateAffinity(groups[i], groups[j]);
      if (affinity > 0) candidates.push({
        affinity, left: i, right: j, plans: candidatePlans, key: groupKey(candidatePlans),
      });
    }
    candidates.sort((a, b) => b.affinity - a.affinity || a.key.localeCompare(b.key));
    const selected = candidates.find((candidate) => measure(candidate.plans) <= maxShardBytes);
    if (selected) {
      groups[selected.left] = selected.plans;
      groups.splice(selected.right, 1);
      mergedAffinity = true;
    }
  }

  // Phase two reduces facet count. At this smaller frontier, deterministic best-fit tries the fullest estimated
  // union first, while the cached real compilation remains the acceptance authority.
  let packed = true;
  while (packed) {
    packed = false;
    const candidates: Array<{
      estimate: number; left: number; right: number; plans: PlannedFunction[]; key: string;
    }> = [];
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const candidatePlans = uniquePlans([...groups[i], ...groups[j]]);
      candidates.push({
        estimate: measure(groups[i]) + measure(groups[j]),
        left: i, right: j, plans: candidatePlans, key: groupKey(candidatePlans),
      });
    }
    candidates.sort((a, b) => b.estimate - a.estimate || a.key.localeCompare(b.key));
    const selected = candidates.find((candidate) => measure(candidate.plans) <= maxShardBytes);
    if (selected) {
      groups[selected.left] = selected.plans;
      groups.splice(selected.right, 1);
      packed = true;
    }
  }

  const facets: ArtifactMap = {};
  const facetRecords: Array<{ name: string; link: string; plans: PlannedFunction[]; artifact: Artifact }> = [];
  groups.sort((a, b) => a.map((p) => p.name).join(',').localeCompare(b.map((p) => p.name).join(',')));
  groups.forEach((group, index) => {
    const name = `${logicalName}__Facet${index}`;
    const artifact = compileFacet(code, merged, errorListener, group, name);
    if (byteSize(artifact) > maxShardBytes) {
      throw new Error(`Cannot split '${logicalName}': facet '${name}' is ${byteSize(artifact)} bytes `
        + `(limit ${maxShardBytes}); closure: ${group.map((p) => p.name).join(', ')}.`);
    }
    facets[name] = artifact;
    facetRecords.push({ name, link: `__facetAddr_${index}`, plans: group, artifact });
  });

  const rootAst = prepareSplitAst(code, merged, errorListener);
  const routeByName = new Map<string, { facet: string; link: string }>();
  for (const facet of facetRecords) for (const plan of facet.plans) {
    routeByName.set(plan.name, { facet: facet.name, link: facet.link });
  }
  prepareSplitRoot(rootAst.contract, routeByName);
  const root = compileResolvedAst(rootAst, code, merged);
  if (byteSize(root) > maxShardBytes) {
    throw new Error(`Cannot split '${logicalName}': generated root is ${byteSize(root)} bytes (limit ${maxShardBytes}).`);
  }

  const routes = (baseline.abi as readonly any[]).filter((fn) => fn.type === 'function' || fn.name).map((abiFn) => {
    const plan = plans.find((p) => p.name === abiFn.name);
    const target = routeByName.get(abiFn.name)?.facet ?? 'root';
    return {
      selector: abiFn.selector ?? '', function: abiFn.name, target,
      footprint: plan?.footprint ?? emptyFootprint(),
    };
  });
  return {
    format: 'solidcash-split-v1', root, facets,
    manifest: {
      logicalContractName: logicalName,
      abi: baseline.abi,
      stateLayoutFingerprint: splitStateLayoutFingerprint(baseline.stateLayout),
      deploymentMode: 'immutable-one-hop', algorithm: 'state-affinity-best-fit-v2', routes,
      identityBinding: { scheme: 'solidcash-create-v1', owner: 'root', facetIdentity: 'physical-only' },
      facets: facetRecords.map((f) => ({
        name: f.name, functions: f.plans.map((p) => p.name), brandArgument: '__brand',
        linkArgument: f.link, delegateOnly: true, estimatedRedeemBytes: byteSize(f.artifact),
      })),
    },
  };
}

function byteSize(artifact: Artifact): number { return artifact.bytecode.length / 2; }
function emptyFootprint(): SplitStateFootprint { return { reads: [], writes: [], effects: [], unknown: false }; }
function splitStateLayoutFingerprint(layout: Artifact['stateLayout']): string {
  if (!layout) return '{}';
  const storageLayout = { ...layout };
  delete storageLayout.constructorInputs;
  return JSON.stringify(storageLayout);
}

function unsplitBundle(root: Artifact, plans: PlannedFunction[]): SplitArtifactBundle {
  return {
    format: 'solidcash-split-v1', root, facets: {},
    manifest: {
      logicalContractName: root.contractName, abi: root.abi,
      stateLayoutFingerprint: splitStateLayoutFingerprint(root.stateLayout),
      deploymentMode: 'immutable-one-hop', algorithm: 'state-affinity-best-fit-v2',
      identityBinding: { scheme: 'solidcash-create-v1', owner: 'root', facetIdentity: 'physical-only' },
      routes: (root.abi as readonly any[]).map((fn) => ({
        selector: fn.selector ?? '', function: fn.name, target: 'root' as const,
        footprint: plans.find((p) => p.name === fn.name)?.footprint ?? emptyFootprint(),
      })), facets: [],
    },
  };
}

function isMovableSplitEntry(fn: FunctionDefinitionNode): boolean {
  return fn.isEntryPoint && !fn.name.startsWith('__') && !fn.isFallback && !fn.isReceive
    && !fn.modifiers.includes(FunctionModifier.VIEW) && !fn.modifiers.includes(FunctionModifier.PURE)
    && !fn.modifiers.some((m) => LIFECYCLE_MODIFIERS.has(m));
}

function hardClosureGroups(plans: PlannedFunction[]): PlannedFunction[][] {
  const groups = plans.map((p) => [p]);
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const namesI = new Set(groups[i].map((p) => p.name));
      const namesJ = new Set(groups[j].map((p) => p.name));
      if (groups[i].some((p) => [...p.closure].some((n) => namesJ.has(n)))
        || groups[j].some((p) => [...p.closure].some((n) => namesI.has(n)))) {
        groups[i] = uniquePlans([...groups[i], ...groups[j]]); groups.splice(j, 1); changed = true; break outer;
      }
    }
  }
  return groups;
}

function uniquePlans(plans: PlannedFunction[]): PlannedFunction[] {
  return [...new Map(plans.map((p) => [p.name, p])).values()].sort((a, b) => a.name.localeCompare(b.name));
}

function stateAffinity(a: PlannedFunction[], b: PlannedFunction[]): number {
  const af = mergeFootprints(a); const bf = mergeFootprints(b);
  if (af.unknown || bf.unknown) return 1;
  const ar = new Set([...af.reads, ...af.writes]); const br = new Set([...bf.reads, ...bf.writes]);
  let score = 0;
  for (const left of ar) if ([...br].some((right) => splitResourcesOverlap(left, right))) score += 2;
  for (const e of af.effects) if (bf.effects.includes(e)) score += 1;
  return score;
}

function splitResourcesOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  if (!a.startsWith('collection:') || !b.startsWith('collection:')) return false;
  const [aKind, aName, aKey] = a.split(':'); const [bKind, bName, bKey] = b.split(':');
  return aKind === bKind && aName === bName && (aKey === '*' || bKey === '*');
}

function mergeFootprints(plans: PlannedFunction[]): SplitStateFootprint {
  const merge = (key: 'reads' | 'writes' | 'effects'): string[] => (
    [...new Set(plans.flatMap((p) => p.footprint[key]))].sort()
  );
  return {
    reads: merge('reads'), writes: merge('writes'), effects: merge('effects'),
    unknown: plans.some((p) => p.footprint.unknown),
  };
}

/** Prepare the complete logical contract before deciding physical placement. The normal compiler repeats these
 * passes, but each is idempotent after it has consumed its source metadata. This keeps split planning aware of
 * inherited entry points, inherited state, and modifier-injected calls/effects. */
function prepareSplitAst(
  code: string, options: CompilerOptions, listener: SolidCashErrorListener | undefined,
): Ast {
  let ast = parseAndResolve(code, options, listener);
  ast = ast.accept(new RedesugarImportedUsingForCalls(true)) as Ast;
  ast = expandInheritance(ast);
  ast = expandModifiers(ast);
  // Sharding must happen after storage-shaping synthesis. Otherwise a block.* read moved into a facet injects
  // oracle registers only there, changing delegate offsets and leaving the root unable to materialize that state.
  ast = ast.accept(new SynthesizeBlockOracle()) as Ast;
  return ast;
}

function compileFacet(code: string, options: CompilerOptions, listener: SolidCashErrorListener | undefined,
  plans: PlannedFunction[], facetName: string): Artifact {
  const ast = prepareSplitAst(code, options, listener);
  const keep = new Set(plans.flatMap((p) => [...p.closure]));
  const contract = ast.contract;
  contract.name = facetName;
  contract.parameters = [new ParameterNode(new BytesType(32), '__brand')];
  contract.parameters[0].location = contract.location;
  contract.parameters[0].syntheticallyUsed = true;
  contract.constructorDef = undefined;
  contract.isLibraryContract = true;
  contract.isBrandedLibrary = true;
  // A facet intentionally exposes only its assigned selectors, so it is not independently an implementation of
  // the logical contract's Solidity interfaces. The root retains the complete logical ABI.
  contract.implements = [];
  contract.parentInvocations = [];
  contract.functions = contract.functions.filter((fn) => keep.has(fn.name));
  // `prepareSplitAst` has already flattened inheritance and resolved every explicit override list. Facets are
  // renamed synthetic contracts with no Solidity base list, so retaining e.g. OZ's `override(Nonces)` would make
  // the idempotent inheritance pass validate resolved source metadata against the synthetic facet and reject it.
  for (const resolved of [contract, ...ast.importedContracts]) {
    for (const fn of resolved.functions) fn.overrideBases = [];
  }
  for (const fn of contract.functions) if (plans.some((p) => p.name === fn.name)) {
    fn.modifiers = fn.modifiers.filter((m) => ![
      FunctionModifier.INTERNAL, FunctionModifier.PRIVATE, FunctionModifier.EXTERNAL, FunctionModifier.PUBLIC,
      FunctionModifier.PURE, FunctionModifier.VIEW, FunctionModifier.DELEGATE,
    ].includes(m));
    fn.modifiers.push(FunctionModifier.PUBLIC, FunctionModifier.DELEGATE);
  }
  if (contract.functions.filter((fn) => fn.isEntryPoint).length < 2) {
    const truth = new BoolLiteralNode(true); truth.location = contract.location;
    const noopGuard = new RequireNode(truth); noopGuard.location = contract.location;
    const body = new BlockNode([noopGuard]); body.location = contract.location;
    const noop = new FunctionDefinitionNode('__split_noop', [], body); noop.location = contract.location;
    noop.modifiers = [FunctionModifier.PUBLIC, FunctionModifier.DELEGATE]; contract.functions.push(noop);
  }
  const artifact = compileResolvedAst(ast, code, options, true);
  artifact.delegateOnly = true;
  return artifact;
}

function prepareSplitRoot(contract: ContractNode, routes: Map<string, { facet: string; link: string }>): void {
  // Once moved entry bodies become forwarders, helpers reachable only from those entries belong exclusively to
  // facets. Leaving their OP_INVOKE bodies in the root defeats splitting and can keep an otherwise valid root over
  // the VM limit. Preserve helpers reachable from root-local entries and the constructor.
  const byName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of contract.functions) (byName.get(fn.name) ?? byName.set(fn.name, []).get(fn.name)!).push(fn);
  if (contract.constructorDef) byName.set(contract.constructorDef.name, [contract.constructorDef]);
  const rootHelpers = new Set<string>();
  const roots = contract.functions.filter((fn) => fn.isEntryPoint && !routes.has(fn.name));
  if (contract.constructorDef) roots.push(contract.constructorDef);
  for (const fn of roots) for (const name of collectNamedFunctionClosure(fn, byName)) rootHelpers.add(name);
  contract.functions = contract.functions.filter((fn) => fn.isEntryPoint || rootHelpers.has(fn.name));

  const links = [...new Map([...routes.values()].map((r) => [r.link, r])).values()];
  for (const route of links) {
    const param = new ParameterNode(new AddressType(), route.link); param.location = contract.location;
    contract.parameters.push(param);
  }
  for (const fn of contract.functions) {
    const route = routes.get(fn.name); if (!route) continue;
    // A split delegate implementation is flattened into a directly state-holding root by deployProxy. Its root
    // forwarder therefore becomes an ordinary covenant entry, while the facet remains `delegate`: root -> facet
    // is one delegate hop, avoiding the unsupported proxy -> implementation -> facet nested-delegate topology.
    fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.DELEGATE);
    for (const param of fn.parameters) param.syntheticallyUsed = true;
    const signature = computeFunctionSignature(fn.name, fn.parameters.map((p) => p.type.toString()));
    const target = new IdentifierNode(route.link); target.location = fn.location;
    const data = new HexLiteralNode(computeFunctionSelector(signature)); data.location = fn.location;
    const call = new LowLevelCallStatementNode(target, data, 'delegatecall'); call.location = fn.location;
    call.synthesizedFromLibraryCall = true;
    const truth = new BoolLiteralNode(true); truth.location = fn.location;
    const guard = new RequireNode(truth); guard.location = fn.location;
    fn.body = new BlockNode([call, guard]); fn.body.location = fn.location;
  }
}

function splitFailureMessage(name: string, artifact: Artifact, limit: number, functions: FunctionDefinitionNode[]): string {
  const retained = functions.filter((fn) => !isMovableSplitEntry(fn)).map((fn) => fn.name);
  return `Cannot split '${name}': artifact is ${byteSize(artifact)} bytes (limit ${limit}) and has no movable `
    + `entry point. Root-local/unsupported functions: ${retained.join(', ') || '(none)'}.`;
}

/**
 * An ABI-only declaration artifact for a single interface, reusing generateDeclarationArtifact (which keys on
 * `ast.libraryName`). Carries the interface's functions + the file's shared enums/events/errors; no bytecode.
 */
function generateInterfaceArtifact(ast: Ast, interfaceName: string, code: string): Artifact {
  const savedLibraryName = ast.libraryName;
  ast.libraryName = interfaceName;
  try {
    return generateDeclarationArtifact(ast, code);
  } finally {
    ast.libraryName = savedLibraryName;
  }
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
    // The wrapper carries the file's DEFINITIONS (sibling contracts, interfaces, enums, structs, type
    // defs, events, errors) so a child resolves them like the primary does - a chained child (C deploys
    // B, B declares `A a`) otherwise failed its contract-type validation. These are registration-only in
    // the child's fresh SymbolTable; free functions / using-for are NOT carried (their bodies were
    // already desugared by the main pipeline and re-running the singleAst desugar passes on them duplicates
    // their locals). A child's own `using L for T` calls therefore stay unresolved here (a known limit).
    let singleAst: Ast = new SourceFileNode(
      contract, [], ast.enumDefinitions, ast.structDefinitions, ast.typeDefinitions,
      ast.errorDefinitions, ast.eventDefinitions, ast.interfaceDefinitions, [], [], [],
    );
    singleAst.importedContracts = ast.importedContracts.filter((c) => c.name !== contract.name);
    // Carry the declared library NAMES (not their functions/bodies) so a child that still holds a
    // `using L for T` directive resolves it as a no-op binding: the `.method()` calls it enabled were
    // already desugared/inlined by the main pipeline, but the directive node remains and must not throw
    // UsingForUndefinedLibraryError when re-visited here.
    singleAst.declaredLibraryNames = ast.declaredLibraryNames;
    singleAst = singleAst.accept(new NamedReturnTransformation()) as Ast;
    singleAst = singleAst.accept(new DesugarNestedBranchReturn()) as Ast;
    singleAst = singleAst.accept(new DesugarPostfixExpressions()) as Ast;
    // Keep the referenced-contract bytecode byte-identical to its standalone compilation (see comment above).
    singleAst = singleAst.accept(new CoalesceMappingEntryFieldWrites()) as Ast;
    singleAst = singleAst.accept(new CoalesceStructFieldArrayWrites()) as Ast;
    singleAst = singleAst.accept(new LowerMemoryModel()) as Ast;
    singleAst = singleAst.accept(new DesugarNestedArrayWrite()) as Ast;
    singleAst = singleAst.accept(new LowerInlineAssembly()) as Ast;
    singleAst = singleAst.accept(new InlineExternalCallHelpers()) as Ast;
    singleAst = singleAst.accept(new LowerDynamicStateJournalHelpers()) as Ast;
    singleAst = singleAst.accept(new LowerCollectionJournalHelpers()) as Ast;
    singleAst = singleAst.accept(new InlineReturningStateHelpers()) as Ast;
    singleAst = singleAst.accept(new InlineStoragePointerCalls(compilerOptions.solidityImportCompat ?? false)) as Ast;
    singleAst = singleAst.accept(new InlineMappingReturnFunctions()) as Ast;
    singleAst = singleAst.accept(new LowerMappingStorageAlias()) as Ast;
    singleAst = singleAst.accept(new DesugarDynamicArrayCopyCast()) as Ast;
    singleAst = singleAst.accept(new CacheDynamicArrayInLoop()) as Ast;
    singleAst = singleAst.accept(new CacheMappingEntryInLoop()) as Ast;
    singleAst = singleAst.accept(new IfConvertConditionalEntryOp()) as Ast;
    singleAst = singleAst.accept(new PromoteConstructorExternalReads()) as Ast;
    singleAst = singleAst.accept(new HoistBranchLocalExtcallTargets()) as Ast;
    singleAst = singleAst.accept(new SynthesizeExternalAddressLocals()) as Ast;
    singleAst = singleAst.accept(new HoistNonLoopArrayElemExtcallTargets()) as Ast;
    singleAst = singleAst.accept(new CaptureBranchExternalCallTargets()) as Ast;
    singleAst = singleAst.accept(new SynthesizeBlockOracle()) as Ast;
    // Carry the file's library free functions in ONLY for symbol resolution + type checking, AFTER the desugar/
    // inline passes have run (so their already-desugared bodies are not re-desugared, which duplicated locals).
    // This lets a child's own `using L for T` calls (`funding.sub(x)`) bind + resolve, instead of falling through
    // to an undefined-symbol error. Library functions are inline-only, so registering them for resolution is
    // sound; codegen skips their standalone bodies (only the child contract is emitted).
    (singleAst as SourceFileNode).freeFunctions = ast.freeFunctions;
    (singleAst as SourceFileNode).constantDefinitions = ast.constantDefinitions; // library constants those fns read
    for (const col of singleAst.contract.collections) {
      if (col.type instanceof MappingType) col.sorted = true;
    }
    singleAst = singleAst.accept(new SymbolTableTraversal(compilerOptions)) as Ast;
    singleAst = singleAst.accept(new TypeCheckTraversal()) as Ast;
    singleAst = singleAst.accept(new EnsureFinalRequireTraversal(compilerOptions.enforceFinalRequire)) as Ast;
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

    // MD2: run the same backwards-compat cross-check on referenced/child contracts too (it was only applied to
    // the top-level contract, so an optimiser divergence in a child script would have shipped unchecked).
    if (traversal.output.length <= OPTIMISER_COMPAT_CHECK_MAX_OPS) {
      const optimisedOld = optimiseBytecodeOld(traversal.output);
      if (scriptToAsm(optimisedOld) !== scriptToAsm(optimisationResult.script)) {
        throw new Error(`New bytecode optimisation is not backwards compatible (referenced contract '${contractName}'), `
          + 'please report this issue to the SolidCash team');
      }
    }

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
  const knownNames = new Set(ast.importedContracts.map((c) => c.name));
  const visited = new WeakSet();
  collectRefsRecursive(ast.contract, refs, visited, knownNames);
  // Transitive closure: a referenced child may itself deploy/reference another sibling (C deploys B,
  // B deploys A) - A's bytecode must be compiled too, or B's codegen fails "bytecode not available".
  // Each child walk gets a fresh visited set (the primary walk may have marked the child's node without
  // descending into it).
  const byName = new Map(ast.importedContracts.map((c) => [c.name, c]));
  const walked = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const name of [...refs]) {
      const child = byName.get(name);
      if (!child || walked.has(name)) continue;
      walked.add(name);
      const before = refs.size;
      collectRefsRecursive(child, refs, new WeakSet(), knownNames);
      if (refs.size > before) grew = true;
    }
  }
  return refs;
}

function collectRefsRecursive(
  node: any, refs: Set<string>, visited: WeakSet<object>, knownNames?: Set<string>,
): void {
  if (!node || typeof node !== 'object') return;
  if (visited.has(node)) return;
  visited.add(node);

  if (node instanceof ContractReferenceNode) {
    refs.add(node.contractName);
    // Also recurse into constructor args
    for (const arg of node.constructorArgs) {
      collectRefsRecursive(arg, refs, visited, knownNames);
    }
    return;
  }

  // referencedContract is stamped by the PRIMARY's semantic pass; a not-yet-analyzed child's `new A()`
  // carries none, so also match by name against the file's known contracts (transitive closure walks).
  if (node instanceof InstantiationNode
    && (node.referencedContract || knownNames?.has(node.identifier.name))) {
    refs.add(node.identifier.name);
    for (const arg of node.parameters) {
      collectRefsRecursive(arg, refs, visited, knownNames);
    }
    if (node.callOptions?.value) collectRefsRecursive(node.callOptions.value, refs, visited, knownNames);
    if (node.callOptions?.salt) collectRefsRecursive(node.callOptions.salt, refs, visited, knownNames);
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
        if (item && typeof item === 'object') collectRefsRecursive(item, refs, visited, knownNames);
      }
    } else if (val && typeof val === 'object' && !(val instanceof Map) && !(val instanceof Set)
      && !(val instanceof Uint8Array)) {
      collectRefsRecursive(val, refs, visited, knownNames);
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

  // A referenced contract may itself deploy/reference another sibling (C deploys B, B deploys A):
  // its dependencies must compile first so their bytecode is available to its codegen.
  const depsOf = (name: string): string[] => {
    const c = contractMap.get(name);
    if (!c) return [];
    const refs = new Set<string>();
    collectRefsRecursive(c, refs, new WeakSet(), new Set(contractMap.keys()));
    refs.delete(name);
    return [...refs].filter((r) => referencedContracts.has(r));
  };

  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new CircularContractReferenceError(name);
    }
    visiting.add(name);
    for (const dep of depsOf(name)) visit(dep);
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
  // Solidity's storage-layout specifier `contract C [is ..] layout at <expr> { }` sets an EVM storage base slot;
  // it has no meaning on the UTXO model, so drop the clause so the contract parses. Anchored to a
  // `contract Name [is ..]` header (so a `layout at .. {` inside a string / body is not touched) and stopping at
  // the body `{` on the header line (`[^{};\n]`), preserving line numbers for diagnostics. (Native code has no
  // such clause, so the strip is a no-op there.)
  code = code.replace(
    /(\bcontract\s+\w+\b(?:\s+is\s+[^{}]*?)?)\s+layout\s+at\s+([^{};\n]+?)(?=\s*\{)/g,
    (_m, header, expr) => {
      if (/\berc7201\b/.test(expr)) {
        console.log('Warning: `layout at erc7201(...)` is not supported in SolidCash - storage is not offset by a '
          + 'base slot on the UTXO model, so the layout specifier is ignored.');
      }
      return header;
    },
  );

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

// Re-resolve array element types that parsed to a named AddressType placeholder (an imported struct not yet
// merged at parse time) to the real StructType, now that imports are merged. Scoped to the main contract's
// state variables + collections (the array-bearing declarations); a non-struct placeholder (interface array
// or a typo) is left untouched and validated downstream as before.
function reresolveImportedStructTypes(ast: Ast): void {
  const contract = ast.contract;
  if (!contract) return;
  const structMap = new Map<string, StructType>();
  for (const sd of ast.structDefinitions ?? []) structMap.set(sd.name, new StructType(sd.name, sd.fields));
  for (const sd of contract.structDefinitions) structMap.set(sd.name, new StructType(sd.name, sd.fields));
  // Imported user-defined value types (`type UD2x18 is uint64`) parse to the same named-AddressType placeholder as
  // imported structs when used as a param/return/var type; resolve them to the real ValueType too.
  const udvtMap = new Map<string, ValueType>();
  for (const td of ast.typeDefinitions ?? []) udvtMap.set(td.name, td.valueType);
  for (const td of contract.typeDefinitions ?? []) udvtMap.set(td.name, td.valueType);
  if (structMap.size === 0 && udvtMap.size === 0) return;
  const resolveName = (name: string): Type | undefined => {
    if (structMap.has(name)) return structMap.get(name)!;
    if (udvtMap.has(name)) return udvtMap.get(name)!;
    // Library-qualified `Counters.Counter` / `Lockup.Amounts`: library structs/UDVTs register bare.
    const dot = name.lastIndexOf('.');
    if (dot >= 0) return resolveName(name.slice(dot + 1));
    return undefined;
  };
  const fix = (t: Type): Type => {
    if (t instanceof ArrayType) { t.elementType = fix(t.elementType); return t; }
    if (t instanceof MappingType) { t.keyType = fix(t.keyType); t.valueType = fix(t.valueType); return t; }
    if (t instanceof AddressType && t.interfaceName) return resolveName(t.interfaceName) ?? t;
    return t;
  };
  // Fix every placeholder-typed param / local var in a function body too: `Escrow memory escrow` (an imported
  // struct) parses to a named-AddressType placeholder, so reads like `escrow.split[i]` type-check against a
  // non-struct and fail. Re-typing the declaration to the real struct (once imports merged) fixes the reads.
  // A visited set guards against shared / cyclic node references in the merged AST (circular imports produce
  // them), which would otherwise recurse forever.
  const seen = new Set<Node>();
  const fixDecls = (root: Node | undefined): void => {
    if (!root || seen.has(root)) return;
    seen.add(root);
    // Fix every placeholder type carried on a node: a declaration's `.type` (VariableDefinition / Parameter),
    // a `new JobPost[](n)`'s `.elementType`, a cast's `.type`, and a function/interface-function's `returns`
    // (`Escrow memory`) - all parse to named-AddressType placeholders that must resolve once imports merge, so
    // imported-struct locals, array constructions, and external-call return types all type-check. fix() is a
    // no-op on non-placeholder / non-Type values, so applying it broadly here is safe (only decl/construction
    // types are set at this pre-semantic stage; expression types are not yet computed).
    const carrier = root as unknown as { type?: Type; elementType?: Type; returnTypes?: Type[] };
    if (carrier.type) carrier.type = fix(carrier.type);
    if (carrier.elementType) carrier.elementType = fix(carrier.elementType);
    if (Array.isArray(carrier.returnTypes)) carrier.returnTypes = carrier.returnTypes.map((t) => fix(t));
    for (const key of Object.keys(root)) {
      if (key === 'type' || key === 'elementType' || key === 'symbolTable' || key === 'location') continue;
      const v = (root as unknown as Record<string, unknown>)[key];
      if (v instanceof Node) fixDecls(v);
      else if (Array.isArray(v)) for (const it of v) if (it instanceof Node) fixDecls(it);
    }
  };
  // Fix the primary AND every imported contract - an imported contract's own state var (e.g. a Unicrow with a
  // `Counters.Counter` field, imported by an arbitrator) is still type-checked, so its placeholder must resolve.
  // CollectionNode.type is ArrayType | MappingType; fix() resolves an imported struct placeholder in an array's
  // element OR a mapping's key/value (`mapping(uint => Escrow)`) in place, so just call it on every collection.
  const fixContract = (c: ContractNode): void => {
    for (const sv of c.stateVariables) sv.type = fix(sv.type);
    for (const col of c.collections) col.type = fix(col.type) as typeof col.type;
    // Event parameters carry plain `{name, type}` objects (not Nodes), so fixDecls's Node walk misses them: an
    // `event X(Escrow escrow)` placeholder must be resolved here too, else the event signature / emit see address.
    for (const ev of c.eventDefinitions ?? []) for (const p of ev.parameters ?? []) p.type = fix(p.type);
  };
  fixContract(contract);
  for (const ic of ast.importedContracts ?? []) fixContract(ic);
  // Comprehensive: fix placeholder param / local / return types everywhere in the merged AST (contract +
  // imported contracts + interfaces + free functions), so imported-struct locals, params, and external-call
  // return types all resolve to the real struct.
  fixDecls(ast);
}
