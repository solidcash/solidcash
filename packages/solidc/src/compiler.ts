import { createHash, randomBytes } from 'crypto';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync,
  type Dirent,
} from 'fs';
import { createRequire } from 'module';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import {
  BailErrorStrategy, CharStream, CommonTokenStream, DefaultErrorStrategy, LexerATNSimulator,
  ParserATNSimulator, PredictionContextCache, PredictionMode,
} from 'antlr4';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  CODE_MARKER_MARKED_CREATOR, CODE_MARKER_RECORD_SOUND, CodeTailError, verifyCodeTail,
} from './generation/CodeTail.js';
import { ArmHeadError, verifyArmHeads } from './generation/ArmHeads.js';
import { hash256 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { sha256 as sha256Bytes } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  type Artifact, type ArtifactMap, ArrayType, AddressType, asmToBytecode, findOraclePoolSlots,
  ORACLE_POOL_PARAMETER, oraclePoolTreeReads, type OraclePoolReads, BytesType, type CompilerOptions,
  computeBytecodeFingerprintWithConstructorArgs, computeFunctionSelector, computeFunctionSelectorHex,
  canonicalSelectorSignature, computeFunctionSignature, EnumType, FunctionType, generateSourceMap, MappingType,
  needsOptimiserCrossCheck, scriptToBytecode, bytecodeToScript, asmToScript, Op, optimiseBytecode,
  optimiseBytecodeOld, OPTIMISER_COMPAT_CHECK_MAX_OPS, PrimitiveType, scriptToAsm, scriptsEqual, type AbiFunction,
  type ChildDeploymentSiteAbi, type FunctionSplitBundle, type SplitArtifactBundle, type DeployerAbi,
  type FunctionBlockLayout, type BlockSlotKind, type SplitStateFootprint, StructType, TupleType, type Type,
  ValueType, isDynamicStorageType, childStateLayoutDigest, abiTypeString, dynamicChunkSignature,
} from '@solidcash/utils';
import { generateArtifact, generateDeclarationArtifact, resultArrayOutputOf } from './artifact/Artifact.js';
import {
  enforceSolidcEnvPolicy,
  solidcEnvFlagEnabled,
  solidcEnvValue,
} from './solidc-env-registry.js';
import {
  assertCompositionConventionSupported,
  resolveCompositionConvention,
} from './framed/master/composition.js';
import { assessFramedMasterShape, directRefusedEntries, stripFrameParameters } from './framed/master/support.js';
import { requireUpgradeLayouts, type UpgradesFrom } from './framed/upgrade-layout.js';
import type { MasterCallSite } from './framed/master/frame-tail.js';
import {
  extractFramedLifecycle, framedLifecycleFunctions, publishLifecycle, withValidatorSettledDefinition, wrapLifecycleArm,
  type FramedLifecycleEntry,
} from './framed/master/lifecycle.js';
import {
  entryFunctionName,
  publishFramedStopSites,
  type PublishedFramedStopSites,
} from './framed/master/stop-sites.js';
import {
  alignCensusAddressOffset,
  findPlaceholderOffsets,
  isFramedMaster,
  framedConstantLockMaster,
  setFramedMaster,
} from './framed/master/master-program.js';
import { outlineFramedMasterProgram, type FramedOutlinedFunction } from './framed/master/program-outline.js';
import {
  emitCompilerWarning, withDistinctWarnings, withSuppressedWarnings, withWarningListener, type WarningListener,
} from './warnings.js';

import {
  type Ast, AssignmentExpressionNode, BinaryOpNode, BlockNode, BoolLiteralNode, ContractNode, ContractReferenceNode,
  EmitStatementNode, ExpressionNode, FieldAccessNode, FunctionCallNode, FunctionDefinitionNode,
  InterfaceFunctionNode, InterfaceNode, ExternalFunctionCallNode, ExternalOutputStateAccessNode, FunctionModifier,
  HexLiteralNode, ExpressionStatementNode, IdentifierNode, InstantiationNode, ArrayDeleteNode,
  CollectionIterationNode, StateAccessNode, StateArrayDeleteNode, LowLevelCallNode, LowLevelCallStatementNode,
  MappingAccessNode, MappingAssignNode, MappingDeleteNode, MappingFieldAssignNode, MethodCallNode,
  MethodCallStatementNode, Node, ParameterNode, RequireNode, NullaryOpNode, TupleAssignmentNode,
  VariableDefinitionNode, DeleteStateNode, SourceFileNode, StatementNode, TransferStatementNode,
  AddressTransferStatementNode, AddressSendExpressionNode, TypeIntrospectionNode, AbiDecodeNode, ReturnNode,
  TokenContainerMethodStatementNode, SelfdestructStatementNode, AssemblyStatementNode, CastNode, IntLiteralNode,
  TryCatchNode, MinerFeeStatementNode, WhileNode, DoWhileNode, TernaryOpNode, UnaryOpNode, BreakNode, ContinueNode,
  BranchNode, UncheckedNode, SwitchNode, StateVariableNode, StateVariableVisibility, StructDefinitionNode,
  exactArrayLength, TimeOpNode, type CustomModifierInvocation,
} from './ast/AST.js';
import { YulFunctionCallNode } from './ast/YulAST.js';
import AstBuilder, { lvalueKeyUnitsBuilt } from './ast/AstBuilder.js';
import { Class, GlobalFunction, TimeOp } from './ast/Globals.js';
import { ThrowingErrorListener, type SolidCashErrorListener, ForwardingErrorListener } from './ast/error-listeners.js';
import GenerateTargetTraversal, {
  assertKeccakChainBand, assertKeccakLoopBand, assertRecoveryLoopBand,
} from './generation/GenerateTargetTraversal.js';
import SolidCashLexer from './grammar/SolidCashLexer.js';
import SolidCashParser from './grammar/SolidCashParser.js';
import SymbolTableTraversal, { assignFunctionSourceEffectOrdinals } from './semantic/SymbolTableTraversal.js';
import { stampArgumentConditionalEntryActivations } from './semantic/ArgumentConditionActivation.js';
import TypeCheckTraversal from './semantic/TypeCheckTraversal.js';
import { publishStoredValueSources } from './semantic/stored-value-source.js';
import { packedStateLayoutVariables } from './semantic/packedStateLayout.js';
import EnsureFinalRequireTraversal from './semantic/EnsureFinalRequireTraversal.js';
import InjectLocktimeGuardTraversal from './semantic/InjectLocktimeGuardTraversal.js';
import EarlyReturnTransformation, { holdsUnconfinedReturn } from './semantic/EarlyReturnTransformation.js';
import confineReturns from './semantic/ConfineReturns.js';
import NamedReturnTransformation, {
  synthesizeEmptyVoidBodies, synthesizeFallThroughDefaultReturns,
} from './semantic/NamedReturnTransformation.js';
import MarkLegacyCheckedMath from './semantic/MarkLegacyCheckedMath.js';
import LowerTailRecursion from './semantic/LowerTailRecursion.js';
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
import { externalResultEncoding } from './semantic/ExternalResultEncoding.js';
import LowerForeignFunctionPointerStructFields from './semantic/LowerForeignFunctionPointerStructFields.js';
import LowerForeignFunctionPointerArrayElements from './semantic/LowerForeignFunctionPointerArrayElements.js';
import PromoteConstructorExternalReads from './semantic/PromoteConstructorExternalReads.js';
import SynthesizeLibraryDelegateCalls from './semantic/SynthesizeLibraryDelegateCalls.js';
import InlineExternalCallHelpers from './semantic/InlineExternalCallHelpers.js';
import InlineStoragePointerCalls from './semantic/InlineStoragePointerCalls.js';
import PruneInlinedConstantBranches from './semantic/PruneInlinedConstantBranches.js';
import LowerSelfLowLevelCalls from './semantic/LowerSelfLowLevelCalls.js';
import LowerStaticLowLevelCalls from './semantic/LowerStaticLowLevelCalls.js';
import LowerValueLowLevelCalls from './semantic/LowerValueLowLevelCalls.js';
import LowerSelfCallMsgData from './semantic/LowerSelfCallMsgData.js';
import LowerInternalMsgDataContext from './semantic/LowerInternalMsgDataContext.js';
import LowerInternalMsgSigContext from './semantic/LowerInternalMsgSigContext.js';
import HoistInlineDeployCalls from './semantic/HoistInlineDeployCalls.js';
import HoistChainedContractCalls from './semantic/HoistChainedContractCalls.js';
import InlineMappingReturnFunctions from './semantic/InlineMappingReturnFunctions.js';
import LowerMappingStorageAlias from './semantic/LowerMappingStorageAlias.js';
import InlineReturningStateHelpers from './semantic/InlineReturningStateHelpers.js';
import LowerCollectionJournalHelpers from './semantic/LowerCollectionJournalHelpers.js';
import LowerDynamicStateJournalHelpers from './semantic/LowerDynamicStateJournalHelpers.js';
import DesugarPostfixExpressions from './semantic/DesugarPostfixExpressions.js';
import AlphaRenameLocalShadows from './semantic/AlphaRenameLocalShadows.js';
import DesugarNestedArrayWrite from './semantic/DesugarNestedArrayWrite.js';
import DesugarExternalFunctionPointers from './semantic/DesugarExternalFunctionPointers.js';
import DesugarReturnInLoop from './semantic/DesugarReturnInLoop.js';
import UnrollFixedBoundEntryLoop from './semantic/UnrollFixedBoundEntryLoop.js';
import LowerLegacyVMapCounterLoops from './semantic/LowerLegacyVMapCounterLoops.js';
import LowerVMapCounterLoops from './semantic/LowerVMapCounterLoops.js';
import LowerInlineAssembly from './semantic/LowerInlineAssembly.js';
import LowerFramedCreate2Address, { type FramedCreateSite } from './semantic/LowerFramedCreate2Address.js';
import FoldFramedCreate2Initializer, { type FramedGenesisReplayer } from './semantic/FoldFramedCreate2Initializer.js';
import { framedChildGenesisReplay } from './framed/child-genesis-replay.js';
import LowerMemoryModel from './semantic/LowerMemoryModel.js';
import ScalarReplaceStructLocals from './semantic/ScalarReplaceStructLocals.js';
import ValidateDataLocations from './semantic/ValidateDataLocations.js';
import DesugarLocalBytesElementWrite from './semantic/DesugarLocalBytesElementWrite.js';
import CacheDynamicArrayInLoop from './semantic/CacheDynamicArrayInLoop.js';
import CacheMappingEntryInLoop from './semantic/CacheMappingEntryInLoop.js';
import DesugarDynamicArrayCopyCast from './semantic/DesugarDynamicArrayCopyCast.js';
import IfConvertConditionalEntryOp from './semantic/IfConvertConditionalEntryOp.js';
import SynthesizeBlockOracle, {
  bindOraclePool, createdPoolReads, markBlockOracleCallers, setOraclePoolBinding, takesOraclePool,
} from './semantic/SynthesizeBlockOracle.js';
import detectMappingArrayPagination from './semantic/DetectMappingArrayPagination.js';
import PruneUnreachableFreeFunctions from './semantic/PruneUnreachableFreeFunctions.js';
import PruneUnreachableMsgDataMethods from './semantic/PruneUnreachableMsgDataMethods.js';
import RedesugarImportedUsingForCalls from './semantic/RedesugarImportedUsingForCalls.js';
import RedesugarImportedStructFieldWrites from './semantic/RedesugarImportedStructFieldWrites.js';
import CoalesceStructFieldArrayWrites from './semantic/CoalesceStructFieldArrayWrites.js';
import OptimizeFixedArrayValues from './semantic/OptimizeFixedArrayValues.js';
import CoalesceStateArrayStructFieldWrites from './semantic/CoalesceStateArrayStructFieldWrites.js';
import CoalesceMappingEntryFieldWrites from './semantic/CoalesceMappingEntryFieldWrites.js';
import ReuseEntryLocalForWriteback from './semantic/ReuseEntryLocalForWriteback.js';
import RedesugarImportedUdvtWrap from './semantic/RedesugarImportedUdvtWrap.js';
import SynthesizePublicGetters from './semantic/SynthesizePublicGetters.js';
import expandModifiers, { validateModifierDefinitions } from './semantic/ModifierExpansionTransformation.js';
import {
  checkConstructorCollectionShapes, constructorReachesCollections, journalAppendSites, rewriteConstructorJournals,
} from './semantic/RewriteConstructorJournals.js';
import FoldHashLiterals from './semantic/FoldHashLiterals.js';
import LowerRuntimeSignatureSelectors from './semantic/LowerRuntimeSignatureSelectors.js';
import FoldConstantBoolBranches from './semantic/FoldConstantBoolBranches.js';
import LowerStorageSlotPointers from './semantic/LowerStorageSlotPointers.js';
import expandBreakContinue from './semantic/BreakContinueTransformation.js';
import expandInheritance, {
  assertNoReservedBaseNames, BASE_IMPL_PREFIX,
} from './semantic/InheritanceExpansionTransformation.js';
import lowerRequireMessageEffects from './semantic/LowerRequireMessageEffects.js';
import bindLvalueKeyEffects from './semantic/BindLvalueKeyEffects.js';
import autoMarkDelegateFunctions from './semantic/AutoMarkDelegateFunctions.js';
import lowerTransientStateVars from './semantic/LowerTransientStateVars.js';
import { validateStorageLayoutSpecifiers } from './semantic/ValidateStorageLayoutSpecifiers.js';
import { ImportResolver } from './ImportResolver.js';
import { createMapResolver } from './createMapResolver.js';
import { assertNoAmbiguousOverrides } from './semantic/AmbiguousOverrides.js';
import { compileFunctionSplit } from './split/function-split.js';
import { DEPLOYER_SELECTOR_CREATE, DEPLOYER_SELECTOR_SWEEP, deployerConstantsOf } from './generation/deployerConstants.js';
import {
  AbstractContractInstantiationError, CircularContractReferenceError, LibrarySelfExternalCallError,
  UndefinedReferenceError, UnknownContractTypeError, EmittingStateHelperEventError, SolidcDiagnosticError,
  CompilerRecursionLimitError, NestedSelfdestructError, UnpublishableLoopGuardError, RecursiveStructDefinitionError,
  ContractStorageTooLargeError, DeployerUnsupportedWarning, DeployerUnsupportedError, DeployerInternalError,
  DeployCycleError,
} from './Errors.js';
import {
  compilesInDirectConvention, type DeployerChild,
} from './generation/deployerChildren.js';
import { withSourceFile } from './ast/Location.js';
import { MAX_INPUT_BYTESIZE } from './constants.js';
import {
  CALL_BATCH_INPUT_RESERVE_FRACTION, CALL_BATCH_ROW_SHIFT, CALL_BATCH_SELECTOR_HEX,
} from './semantic/CallBatch.js';
import {
  analyseContractInvocations, analyseFunctionFootprint, collectNamedFunctionClosure, createFootprintAnalysisCache,
  directCallNames, emitsAnyEvent, walkInvocationAst,
} from './analysis/InvocationAnalysis.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from './ast/Operator.js';
import {
  analyzeChildDeploymentRecipes, childDeploymentCollectionDefinitions, childDeploymentGenesisEntries,
  childDeploymentGenesisState, childDeploymentStructDefinitions, childDeploymentValueRecipe,
} from './deploymentRecipes.js';
import { cloneNode, cloneNodeGraph } from './ast/clone.js';
import { hasEffectiveCallValue } from './semantic/branchOps.js';

export const DEFAULT_COMPILER_OPTIONS: CompilerOptions = {
  enforceFunctionParameterTypes: true,
  enforceLocktimeGuard: true,
  // Fail closed: an entry path without verification and without a state covenant is anyone-can-spend.
  // Callers that intentionally need this behavior must opt out explicitly.
  enforceFinalRequire: true,
  allowUnsafeOperations: false,
  commitmentLimit: 128,
  chunkedArrays: true,
  chainId: 0,
  // Explicit default so the artifact cache key records the optimisation mode that produced a cached artifact.
  optimise: true,
  composition: 'direct',
};

/** Selector identity of a source ABI entry point; compiler-internal physical operands never affect it. */
function sourceFunctionSelectorHex(fn: FunctionDefinitionNode, evmCompat = false): string {
  // Fallback/receive parameters describe their compatibility execution context, not selector-dispatched ABI
  // arguments. SymbolTableTraversal assigns both special entries their reserved zero-argument selector, so the
  // selector derived here is that one even when `fallback(bytes input)` exposes calldata in its body. Ordinary
  // functions continue to exclude only compiler-owned physical operands.
  const visibleParams = fn.isFallback || fn.isReceive
    ? []
    : fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  // The dispatch scheme follows the compile's mode; a per-entry split's selectors must match it, including
  // Solidity's canonical parameter spelling under evmCompat.
  const signature = evmCompat
    ? canonicalSelectorSignature(fn.name, visibleParams.map((parameter) => parameter.type))
    : computeFunctionSignature(fn.name,
      visibleParams.map((parameter) => parameter.type.toString().replace(/address payable/g, 'address')));
  return computeFunctionSelectorHex(signature, evmCompat);
}

function scanSourceImports(code: string): string[] {
  const specs: string[] = [];
  const importRe = /import\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?["']([^"']+)["']/g;
  let match: RegExpExecArray | null = importRe.exec(code);
  while (match) {
    specs.push(match[1]);
    match = importRe.exec(code);
  }
  return specs;
}

function importClosureFingerprint(
  code: string,
  rootFileId: string | undefined,
  resolver: CompilerOptions['importResolver'],
): string {
  const digest = createHash('sha256').update(code);
  if (!resolver || !rootFileId) return digest.digest('hex');
  const seen = new Set<string>([rootFileId]);
  const queue = scanSourceImports(code).map((spec) => ({ spec, from: rootFileId }));
  while (queue.length > 0) {
    const item = queue.pop()!;
    const resolved = resolver(item.spec, item.from);
    if (!resolved || seen.has(resolved.id)) continue;
    seen.add(resolved.id);
    digest.update('\x00');
    digest.update(resolved.id);
    digest.update('\x00');
    digest.update(resolved.source);
    for (const spec of scanSourceImports(resolved.source)) queue.push({ spec, from: resolved.id });
  }
  return digest.digest('hex');
}

/** Per-process memo of source content hashes, shared by every compiler instance (a src build beside dist). */
const SOURCE_HASH_MEMO = Symbol.for('solidc.compileCacheSourceHashes');

/** Code a compiler process can load: TypeScript sources or their emitted JavaScript, not declarations or maps. */
const isCompilerCodeFile = (name: string): boolean => /\.(?:ts|js|mjs|cjs|json)$/.test(name)
  && !name.endsWith('.d.ts');

/**
 * Content identity of the code files under each root, as root-relative paths and content hashes; a missing root
 * counts as empty. A file's hash is memoized per process by path, size, mtime, ctime and inode, so any rewrite (ctime
 * moves even when a tool restores mtime) is read again. Throws when a file vanishes while it is read.
 */
export function sourceTreeFingerprint(roots: readonly string[]): string {
  const holder = globalThis as unknown as Record<symbol, Map<string, string> | undefined>;
  const memo = (holder[SOURCE_HASH_MEMO] ??= new Map<string, string>());
  const digest = createHash('sha256');
  for (const root of roots) {
    let entries: Dirent[] = [];
    try {
      entries = readdirSync(root, { recursive: true, withFileTypes: true });
    } catch {
      // An install without one of the trees (utils sources) has nothing there to load.
    }
    const files = entries
      .filter((entry) => entry.isFile() && isCompilerCodeFile(entry.name))
      .map((entry) => join(entry.parentPath ?? (entry as { path?: string }).path ?? root, entry.name))
      .sort();
    digest.update(`\x01${files.length}\x00`);
    for (const file of files) {
      const stat = statSync(file);
      const memoKey = `${file}\x00${stat.size}\x00${stat.mtimeMs}\x00${stat.ctimeMs}\x00${stat.ino}`;
      let hash = memo.get(memoKey);
      if (hash === undefined) {
        hash = createHash('sha256').update(readFileSync(file)).digest('hex');
        memo.set(memoKey, hash);
      }
      digest.update(`${relative(root, file)}\x00${hash}\x00`);
    }
  }
  return digest.digest('hex');
}

/** The root directory and installed version of a package as resolved from `require`, if it resolves. */
function resolvedPackage(require: NodeRequire, name: string): { root: string; version: string } | undefined {
  try {
    let dir = dirname(require.resolve(name));
    while (dir !== dirname(dir)) {
      const manifest = join(dir, 'package.json');
      if (existsSync(manifest)) {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string; version?: string };
        if (parsed.name === name) return { root: dir, version: parsed.version ?? '' };
      }
      dir = dirname(dir);
    }
  } catch {
    // A bundled deployment resolves nothing; its own module tree, hashed below, carries every dependency.
  }
  return undefined;
}

/** Dependencies whose installed versions shape emitted artifacts. */
const FINGERPRINT_DEPENDENCIES = ['@solidcash/utils', '@bitauth/libauth', '@noble/hashes', 'antlr4', 'semver'];

/**
 * Identity of the compiler implementation that produced a cached artifact: the content of every solidc module this
 * instance loads (its own tree, src .ts from source or dist .js when built), both @solidcash/utils trees (a test alias
 * may load either), and the dependency and Node versions that shape emitted bytecode.
 *
 * Sizes and mtimes miss a same-size edit, and keying a from-source run on this entry module alone served the
 * previous build's artifacts after an edit to any other pass. Hashing content costs tens of milliseconds per process.
 */
function compilerBuildFingerprint(): string {
  try {
    const entry = fileURLToPath(import.meta.url);
    const require = createRequire(entry);
    const utils = resolvedPackage(require, '@solidcash/utils');
    const roots = [dirname(entry), ...(utils ? [join(utils.root, 'src'), join(utils.root, 'dist')] : [])];
    const versions = FINGERPRINT_DEPENDENCIES
      .map((name) => `${name}@${resolvedPackage(require, name)?.version ?? 'unresolved'}`);
    return createHash('sha256')
      .update(`${sourceTreeFingerprint(roots)}\x00${versions.join('\x00')}\x00node@${process.versions.node}`)
      .digest('hex');
  } catch {
    // A tree edited while it is read has no stable identity, so this process shares no entries.
    return `unstable-${randomBytes(16).toString('hex')}`;
  }
}

// Taken while this module loads, beside the code it identifies: an edit landing before a later first compile would
// otherwise file this process's artifacts under the edited sources' identity.
const COMPILER_CACHE_BUILD_ID = solidcEnvValue('SOLIDC_COMPILE_CACHE_BUILD_ID')
  ?? compilerBuildFingerprint();
if (solidcEnvFlagEnabled('SOLIDC_DEBUG_CACHE_ID')) {
  // The artifact cache key is opaque, and a wrong one silently serves the previous build's artifacts. Print the
  // identity a compile actually used.
  console.error('solidc-cache-build-id', COMPILER_CACHE_BUILD_ID);
}

/** Apply lifecycle placement rules again after custom modifier bodies have been inserted into functions. */
function validateExpandedSelfdestructs(contract: ContractNode): void {
  const containsSelfdestruct = (value: unknown, root = true): boolean => {
    if (value instanceof SelfdestructStatementNode) return !root;
    if (!(value instanceof Node)) return false;
    return Object.entries(value).some(([key, child]) => {
      if (key === 'location' || key === 'type' || key === 'symbolTable') return false;
      if (child instanceof Node) return containsSelfdestruct(child, false);
      return Array.isArray(child) && child.some((entry) => containsSelfdestruct(entry, false));
    });
  };
  for (const fn of contract.functions) {
    const direct = (fn.body.statements ?? []).some((statement) => statement instanceof SelfdestructStatementNode);
    const nested = (fn.body.statements ?? []).some((statement) => !(statement instanceof SelfdestructStatementNode)
      && containsSelfdestruct(statement));
    if (nested) throw new NestedSelfdestructError(fn, fn.name);
    if (direct && !fn.modifiers.includes(FunctionModifier.SELFDESTRUCT)) {
      fn.modifiers.push(FunctionModifier.SELFDESTRUCT);
      fn.impliedSelfdestruct = true;
    }
  }
}
type InternalAttemptFailureState = { firstError?: unknown };
/** Facts the B7.3 deployer program publishes for the artifact B7.14 writes. */
interface DeployerProgramBox {
  callSlots?: number;
  /** The child's master lock commits to `__oraclePool`; create must pin it even though genesis reads the locktime. */
  oraclePoolBinding?: boolean;
  constructorReadsSender?: boolean;
  readsBlockData?: boolean;
  constructorBlockField?: 'number' | 'timestamp';
  sidecars?: { keccak: number; ecrecover: number };
  satoshiContainer?: 'none' | 'optional' | 'required';
  genesisOutputs?: number;
  collectionRows?: { collection: string; appendSites: number }[];
  /** A4.4: each written collection's journal, as a depth from the bottom of `create`'s stack at step 12. */
  journalDepths?: Record<string, number>;
  /** Set when a `ctor-…` reason ends the deployer build. */
  reason?: string;
  /** Test hook: raise this `ctor-…` reason, for a reason with no known source shape. */
  forceReason?: string;
  /** The dispatched arms the finished program carries, by internal name. */
  arms?: string[];
  /** Contract parameter names, the band of A4.2's A in `create`'s inputs. */
  contractParameterNames?: string[];
}

/** The two protocol selectors of A4.2, independent of `evmCompat`. */

/** B7.14: the smallest `create` unlocking, with every unbounded parameter at length 0. */
function smallestCreateUnlockingSize(
  inputs: readonly { name: string; type: string }[], codeLength: number, redeemLength: number,
  callSlots: number,
): number {
  const pushHeader = (length: number): number =>
    length < 0x4c ? 1 : length <= 0xff ? 2 : length <= 0xffff ? 3 : 5;
  const argumentSize = (input: { name: string; type: string }): number => {
    if (input.name === '__internal__code') return pushHeader(codeLength) + codeLength;
    const fixed = /^bytes([0-9]+)$/.exec(input.type);
    if (fixed !== null) return 1 + Number(fixed[1]);
    if (input.type === 'address' || input.type === 'address payable') return 21;
    return 1;
  };
  const calleeList = callSlots === 0 ? 1 : 1 + 2 * callSlots;
  return 5 + calleeList + inputs.reduce((total, input) => total + argumentSize(input), 0)
    + pushHeader(redeemLength) + redeemLength;
}

/** B7.15: the serialized size of a sweep at 1 sat/B, from its unlocking: selector, redeem push, one P2PKH output. */
function sweepTransactionSize(redeemLength: number): number {
  const pushHeader = redeemLength < 0x4c ? 1 : redeemLength <= 0xff ? 2 : redeemLength <= 0xffff ? 3 : 5;
  const unlockingLength = 5 + pushHeader + redeemLength;
  const varint = unlockingLength < 0xfd ? 1 : unlockingLength <= 0xffff ? 3 : 5;
  return 4 + 1 + 36 + varint + unlockingLength + 4 + 1 + 8 + 1 + 25 + 4;
}

/**
 * B7.3: rename the constructor `create` and add `sweep`. The constructor keeps the internal name `__construct`
 * so every constructor-keyed rule (genesis reads, the delete refusal, the token-container rules, and the
 * constructor branch of code generation) applies to its body.
 */
function prepareDeployerContract(ast: Ast, options: InternalCompilerOptions): void {
  const contract = ast.contract;
  const location = contract.location;
  const create = contract.constructorDef ?? new FunctionDefinitionNode(
    '__construct', [],
    (() => {
      const body = new BlockNode([]);
      body.location = location;
      return body;
    })(),
  );
  create.name = '__construct';
  create.location = location;
  create.functionSelector = DEPLOYER_SELECTOR_CREATE;
  if (options.__deployerProgram !== undefined) {
    create.deployerTemplate = sha256Bytes.hash(options.__deployerProgram.constants.code);
  }

  // Keep exactly the functions the constructor reaches. Every other body would either become an arm or fail in
  // genesis mode for a reason the source never asked about.
  const functionsByName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of contract.functions) {
    const group = functionsByName.get(fn.name) ?? [];
    group.push(fn);
    functionsByName.set(fn.name, group);
  }
  const reached = new Set<FunctionDefinitionNode>();
  const queue = [create];
  while (queue.length > 0) {
    const fn = queue.pop()!;
    if (reached.has(fn)) continue;
    reached.add(fn);
    walkInvocationAst(fn.body, (node) => {
      if (node instanceof FunctionCallNode) {
        for (const callee of functionsByName.get(node.identifier.name) ?? []) queue.push(callee);
      }
    });
  }
  contract.functions = contract.functions.filter((fn) => reached.has(fn));
  for (const fn of reached) fn.genesisMode = true;
  // B7.3: a kept function is a body `create` calls, never an arm. A public or external one (OpenZeppelin's
  // `decimals()` under a premint, say) would otherwise become a third arm of Deploy<C>, which O1 forbids.
  for (const fn of reached) {
    if (fn === create || fn.isFallback || fn.isReceive) continue;
    if (fn.visibility === 'internal' || fn.visibility === 'private') continue;
    fn.modifiers = [...fn.modifiers.filter((modifier) => modifier !== FunctionModifier.PUBLIC
      && modifier !== FunctionModifier.EXTERNAL), FunctionModifier.INTERNAL];
  }
  // A2/A5: every body this program keeps is a genesis body. Its block reads come from the locktime, so it takes
  // no `__oraclePool` binding and no block-oracle input index; the pool is only for a live call of C.
  contract.usesBlockOracle = false;
  contract.usesBlockhash = false;
  contract.constructorDef = undefined;
  contract.fallbackDef = undefined;
  contract.receiveDef = undefined;

  const requireStatement = (expression: ExpressionNode): RequireNode => {
    const node = new RequireNode(expression);
    node.location = location;
    return node;
  };
  const int = (value: bigint): IntLiteralNode => {
    const node = new IntLiteralNode(value);
    node.location = location;
    return node;
  };
  const binary = (left: ExpressionNode, operator: BinaryOperator, right: ExpressionNode): BinaryOpNode => {
    const node = new BinaryOpNode(left, operator, right);
    node.location = location;
    return node;
  };
  const age = new TimeOpNode(TimeOp.CHECK_SEQUENCE, int(1440n));
  age.location = location;
  const outputs = new NullaryOpNode(NullaryOperator.OUTPUT_COUNT);
  outputs.location = location;
  const outputCategory = new UnaryOpNode(UnaryOperator.OUTPUT_TOKEN_CATEGORY, int(0n));
  outputCategory.location = location;
  const emptyCategory = new HexLiteralNode(new Uint8Array(0));
  emptyCategory.location = location;
  const sweepBody = new BlockNode([
    age,
    requireStatement(binary(outputs, BinaryOperator.EQ, int(1n))),
    requireStatement(binary(outputCategory, BinaryOperator.EQ, emptyCategory)),
  ]);
  sweepBody.location = location;
  const sweep = new FunctionDefinitionNode('__solidcash_sweep', [], sweepBody);
  sweep.location = location;
  sweep.functionSelector = DEPLOYER_SELECTOR_SWEEP;
  sweep.modifiers.push(FunctionModifier.PUBLIC, FunctionModifier.UNSAFE);
  sweep.unsafeTier = 0;
  contract.functions.push(create, sweep);
  if (options.__deployerTestBox?.thirdArm === true) {
    const thirdBody = new BlockNode([requireStatement(new BoolLiteralNode(true))]);
    thirdBody.location = location;
    const third = new FunctionDefinitionNode('__solidcash_third_arm', [], thirdBody);
    third.location = location;
    third.functionSelector = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);
    third.modifiers.push(FunctionModifier.PUBLIC);
    contract.functions.push(third);
  }
  void options;
}

/**
 * B7.3: compile Deploy<C> from C's pristine resolved tree. The program carries only `create` and `sweep`; its
 * artifact is the redeem script A13 publishes, and the box carries what B7.14 needs from the second compile.
 */
/**
 * A2: C reads block data when a function other than its constructor reads `block.*` (or reaches a reader by a
 * named call). The constructor's own reads come from the locktime (A5) and need no oracle.
 */
function liveFunctionReadsBlockData(contract: ContractNode): boolean {
  if (contract.fallbackDef?.usesBlockOracle === true || contract.receiveDef?.usesBlockOracle === true) return true;
  return contract.functions.some((fn) => fn.isEntryPoint === true && fn.usesBlockOracle === true);
}

/** B7.5 `ctor-base-argument`: a base constructor argument must not read state or have a side effect. */
/**
 * C and every contract it derives from in the pristine source, before inheritance expansion. A contract's direct
 * bases are the names of its `is` list that name a contract of the source; an interface adds nothing.
 */
function sourceInheritance(sourceAst: Ast): {
  root: ContractNode;
  contracts: ContractNode[];
  byName: Map<string, ContractNode>;
  ancestorsOf: (contract: ContractNode) => Set<ContractNode>;
  /** How many distinct paths of the inheritance graph lead from C to the contract, saturating at 2. */
  pathsTo: (contract: ContractNode) => number;
  /**
   * The contract's base constructor invocations and its constructor's modifier invocations. The parser keeps a
   * header item written with arguments, `B(x)` or `m(x)`, among the contract's parent invocations, and one without
   * among the constructor's modifiers: a name that is a modifier of the inheritance and not a contract is a modifier.
   */
  baseInvocationsOf: (contract: ContractNode) => CustomModifierInvocation[];
  modifierInvocationsOf: (contract: ContractNode) => CustomModifierInvocation[];
} {
  const root = sourceAst.contract;
  const byName = new Map<string, ContractNode>();
  for (const contract of [root, ...sourceAst.importedContracts]) {
    if (!byName.has(contract.name)) byName.set(contract.name, contract);
  }
  const basesOf = (contract: ContractNode): ContractNode[] => (contract.implements ?? [])
    .map((name) => byName.get(name))
    .filter((base): base is ContractNode => base !== undefined && base !== contract);
  const contracts: ContractNode[] = [];
  const reached = new Set<ContractNode>();
  const reach = (contract: ContractNode): void => {
    if (reached.has(contract)) return;
    reached.add(contract);
    contracts.push(contract);
    for (const base of basesOf(contract)) reach(base);
  };
  reach(root);
  const ancestorMemo = new Map<ContractNode, Set<ContractNode>>();
  const ancestorsOf = (contract: ContractNode): Set<ContractNode> => {
    const known = ancestorMemo.get(contract);
    if (known !== undefined) return known;
    const result = new Set<ContractNode>();
    ancestorMemo.set(contract, result); // a cycle, which the front end refuses elsewhere, ends here
    for (const base of basesOf(contract)) {
      result.add(base);
      for (const ancestor of ancestorsOf(base)) result.add(ancestor);
    }
    return result;
  };
  const pathMemo = new Map<ContractNode, number>();
  const pathsTo = (contract: ContractNode): number => {
    if (contract === root) return 1;
    const known = pathMemo.get(contract);
    if (known !== undefined) return known;
    pathMemo.set(contract, 0);
    let count = 0;
    for (const parent of contracts) {
      for (const base of basesOf(parent)) if (base === contract) count += pathsTo(parent);
    }
    const saturated = Math.min(count, 2);
    pathMemo.set(contract, saturated);
    return saturated;
  };
  const modifierNames = new Set(contracts.flatMap((contract) => (contract.modifierDefinitions ?? [])
    .map((modifier) => modifier.name)));
  const isModifier = (name: string): boolean => modifierNames.has(name) && !byName.has(name);
  const headerInvocations = (contract: ContractNode): CustomModifierInvocation[] => [
    ...(contract.parentInvocations ?? []).map((invocation) => ({
      name: invocation.parentName, args: invocation.args ?? [], location: invocation.location,
    })),
    ...(contract.constructorDef?.customModifiers ?? []),
  ];
  const baseInvocationsOf = (contract: ContractNode): CustomModifierInvocation[] => headerInvocations(contract)
    .filter((invocation) => !isModifier(invocation.name));
  const modifierInvocationsOf = (contract: ContractNode): CustomModifierInvocation[] => headerInvocations(contract)
    .filter((invocation) => isModifier(invocation.name));
  return { root, contracts, byName, ancestorsOf, pathsTo, baseInvocationsOf, modifierInvocationsOf };
}

/**
 * A4.1 `ctor-base-argument`: a base constructor argument that reads state or has a side effect. Every base
 * invocation of C's inheritance counts, in an `is` list or in a constructor's header, and state is every field and
 * collection any contract of the inheritance declares. A constructor modifier's arguments are not base arguments;
 * they belong to the modifier's unit (`ctor-construction-order`).
 */
function baseConstructorArgumentReadsState(sourceAst: Ast): boolean {
  const { contracts, baseInvocationsOf } = sourceInheritance(sourceAst);
  const stateNames = new Set(contracts.flatMap((contract) => [
    ...contract.stateVariables.map((state) => state.name),
    ...(contract.collections ?? []).map((collection) => collection.name),
  ]));
  const baseArguments = contracts.flatMap((contract) => baseInvocationsOf(contract)
    .flatMap((invocation) => invocation.args));
  {
    for (const argument of baseArguments) {
      let found = false;
      walkInvocationAst(argument, (visited) => {
        if (visited instanceof MappingAccessNode || visited instanceof StateAccessNode
          || visited instanceof MappingAssignNode || visited instanceof MappingFieldAssignNode
          || visited instanceof MappingDeleteNode || visited instanceof AssignmentExpressionNode
          || (visited instanceof FieldAccessNode && visited.name === 'balance')) {
          found = true;
        }
        if (visited instanceof IdentifierNode && stateNames.has(visited.name)) found = true;
        if (visited instanceof FunctionCallNode) found = true;
        if (visited instanceof UnaryOpNode && (visited.operator === UnaryOperator.PREFIX_INCREMENT
          || visited.operator === UnaryOperator.PREFIX_DECREMENT || visited.operator === UnaryOperator.POSTFIX_INCREMENT
          || visited.operator === UnaryOperator.POSTFIX_DECREMENT)) found = true;
      });
      if (found) return true;
    }
  }
  return false;
}

/**
 * A4.1 `ctor-construction-order`: construction that could depend on an order in which the front end builds a
 * contract differently from solc. The front end orders sibling bases in reverse, runs a constructor's modifiers
 * before its contract's state initialisers, may build a shared base once per path, and solc's two code generators
 * themselves order initialisers differently. Decided on the pristine source, per contract K of C's inheritance,
 * over K's units: its state initialisers (the statements the parser tags `stateInitializerOf`), its constructor
 * modifiers (every definition of the name in the inheritance, both parts and the arguments), and its constructor
 * body. Refused, as the spec says: units of two contracts neither of which derives from the other that touch the
 * same state; an initialiser of K and a unit of a base of K that do; a constructor modifier of K and an
 * initialiser of K that do; and a contract reached by more than one path that has a unit.
 *
 * State is every field and collection, told apart by the contract that declares it, and the satoshi balance. A
 * unit touches what any node of it names, in its contract's scope, and what every definition it calls by name
 * touches, transitively, with their modifiers; an assembly block touches everything. A read counts as a write, so
 * this refuses two units that only read the same state, which the spec allows: it errs toward refusing.
 * Returns why, or undefined.
 */
function constructionOrderDependence(sourceAst: Ast): string | undefined {
  const { root, contracts, ancestorsOf, pathsTo, modifierInvocationsOf } = sourceInheritance(sourceAst);
  const EVERYTHING = '*';
  const BALANCE = '(balance)';
  const declarations = (contract: ContractNode, inherited: boolean): Set<string> => new Set([
    ...contract.stateVariables
      .filter((state) => !state.isTransient && !(inherited && state.visibility === StateVariableVisibility.PRIVATE))
      .map((state) => state.name),
    ...(contract.collections ?? [])
      .filter((collection) => !(inherited && collection.visibility === StateVariableVisibility.PRIVATE))
      .map((collection) => collection.name),
  ]);
  const own = new Map(contracts.map((contract) => [contract, declarations(contract, false)]));
  const inheritable = new Map(contracts.map((contract) => [contract, declarations(contract, true)]));
  // The state a name means in a scope: the scope's own declaration, else an inherited one. A library or a free
  // function (no scope) may be given the consumer's layout by this front end, so it means every declaration.
  const resolve = (scope: ContractNode | undefined, name: string): string[] => {
    if (scope === undefined) {
      return contracts.filter((contract) => own.get(contract)!.has(name)).map((contract) => `${contract.name}.${name}`);
    }
    if (own.get(scope)?.has(name)) return [`${scope.name}.${name}`];
    return [...ancestorsOf(scope)].filter((ancestor) => inheritable.get(ancestor)?.has(name))
      .map((ancestor) => `${ancestor.name}.${name}`);
  };
  type Facts = { touches: Set<string>; calls: Set<string> };
  const addCall = (facts: Facts, name: string): void => {
    facts.calls.add(name);
    // `K.f`, `super.f`, a library's `L.f` and a bound `x.f` all count as the name f, with every overload of it.
    if (name.includes('.')) facts.calls.add(name.slice(name.lastIndexOf('.') + 1));
  };
  const directFacts = (roots: readonly unknown[], scope: ContractNode | undefined): Facts => {
    const facts: Facts = { touches: new Set<string>(), calls: new Set<string>() };
    const seen = new Set<object>();
    for (const rootNode of roots) {
      walkInvocationAst(rootNode, (visited) => {
        if (visited instanceof TransferStatementNode || visited instanceof AddressTransferStatementNode
          || visited instanceof AddressSendExpressionNode || visited instanceof MinerFeeStatementNode) {
          facts.touches.add(BALANCE);
        }
        if ((visited instanceof FieldAccessNode || visited instanceof StateAccessNode) && visited.name === 'balance') {
          facts.touches.add(BALANCE);
        }
        if (visited instanceof AssemblyStatementNode) facts.touches.add(EVERYTHING);
        if (visited instanceof FunctionCallNode) addCall(facts, visited.identifier.name);
        if (visited instanceof MethodCallNode) addCall(facts, visited.methodName);
        const name = (visited as { name?: unknown }).name;
        if (typeof name === 'string') {
          for (const key of resolve(scope, name)) facts.touches.add(key);
          if (name.includes('.')) {
            for (const key of resolve(scope, name.slice(name.lastIndexOf('.') + 1))) facts.touches.add(key);
          }
        }
      }, seen);
    }
    return facts;
  };
  // Every definition a name may call: a function of the inheritance, of a library or free, and a modifier.
  type Definition = { roots: unknown[]; scope: ContractNode | undefined; modifiers: readonly CustomModifierInvocation[] };
  const definitionsByName = new Map<string, Definition[]>();
  const define = (name: string, definition: Definition): void => {
    for (const key of new Set([name, name.slice(name.lastIndexOf('.') + 1)])) {
      definitionsByName.set(key, [...(definitionsByName.get(key) ?? []), definition]);
    }
  };
  for (const contract of contracts) {
    for (const fn of contract.functions) {
      define(fn.name, { roots: [fn.body], scope: contract, modifiers: fn.customModifiers ?? [] });
    }
    for (const modifier of contract.modifierDefinitions ?? []) {
      define(modifier.name, { roots: modifier.statements, scope: contract, modifiers: [] });
    }
  }
  for (const library of sourceAst.importedContracts.filter((contract) => contract.isLibraryContract)) {
    for (const fn of library.functions) {
      define(fn.name, { roots: [fn.body], scope: undefined, modifiers: fn.customModifiers ?? [] });
    }
  }
  for (const fn of sourceAst.freeFunctions ?? []) {
    define(fn.name, { roots: [fn.body], scope: undefined, modifiers: fn.customModifiers ?? [] });
  }
  const definitionFacts = new Map<Definition, Facts>();
  const factsOf = (definition: Definition): Facts => {
    const known = definitionFacts.get(definition);
    if (known !== undefined) return known;
    const facts = directFacts([...definition.roots, ...definition.modifiers.flatMap((invocation) => invocation.args)],
      definition.scope);
    for (const invocation of definition.modifiers) facts.calls.add(invocation.name);
    definitionFacts.set(definition, facts);
    return facts;
  };
  const closure = (direct: Facts): Set<string> => {
    const touches = new Set(direct.touches);
    const pending = [...direct.calls];
    const followed = new Set<string>();
    while (pending.length > 0) {
      const name = pending.pop()!;
      if (followed.has(name)) continue;
      followed.add(name);
      for (const definition of definitionsByName.get(name) ?? []) {
        const facts = factsOf(definition);
        for (const key of facts.touches) touches.add(key);
        pending.push(...facts.calls);
      }
    }
    return touches;
  };
  type Units = { initialisers: Set<string>; modifiers: Set<string>; all: Set<string>; constructs: boolean };
  const unitsOf = (contract: ContractNode): Units => {
    const constructorDef = contract.constructorDef;
    const statements: StatementNode[] = constructorDef?.body?.statements ?? [];
    const initialiserStatements = statements.filter((statement) => statement.stateInitializerOf !== undefined);
    const bodyStatements = statements.filter((statement) => statement.stateInitializerOf === undefined);
    // A base invocation passes a base its arguments (`ctor-base-argument`); the modifiers are K's own units.
    const invocations = modifierInvocationsOf(contract);
    const initialisers = closure(directFacts(initialiserStatements, contract));
    const body = closure(directFacts(bodyStatements, contract));
    const modifierFacts = directFacts(invocations.flatMap((invocation) => invocation.args ?? []), contract);
    for (const invocation of invocations) modifierFacts.calls.add(invocation.name);
    const modifiers = closure(modifierFacts);
    return {
      initialisers,
      modifiers,
      all: new Set([...initialisers, ...modifiers, ...body]),
      constructs: statements.length > 0 || invocations.length > 0,
    };
  };
  const overlap = (left: Set<string>, right: Set<string>): boolean => {
    if (left.size === 0 || right.size === 0) return false;
    if (left.has(EVERYTHING) || right.has(EVERYTHING)) return true;
    for (const key of left) if (right.has(key)) return true;
    return false;
  };
  const units = new Map(contracts.map((contract) => [contract, unitsOf(contract)]));
  for (const contract of contracts) {
    if (contract !== root && pathsTo(contract) > 1 && units.get(contract)!.constructs) {
      return `'${contract.name}' is reached through more than one base of '${root.name}' and has construction, `
        + 'which the front end may run once per path';
    }
  }
  for (const [index, left] of contracts.entries()) {
    for (const right of contracts.slice(index + 1)) {
      if (ancestorsOf(left).has(right) || ancestorsOf(right).has(left)) continue;
      if (overlap(units.get(left)!.all, units.get(right)!.all)) {
        return `the constructions of '${left.name}' and '${right.name}', neither of which derives from the other, `
          + 'touch the same state, and the front end orders sibling bases differently from solc';
      }
    }
  }
  for (const contract of contracts) {
    const ownUnits = units.get(contract)!;
    for (const base of ancestorsOf(contract)) {
      if (overlap(ownUnits.initialisers, units.get(base)!.all)) {
        return `a state initialiser of '${contract.name}' touches state the construction of its base `
          + `'${base.name}' touches, and solc's code generators order the two differently`;
      }
    }
    if (overlap(ownUnits.modifiers, ownUnits.initialisers)) {
      return `a constructor modifier of '${contract.name}' touches state its state initialisers touch, and the `
        + 'front end runs the modifier first where solc runs the initialisers first';
    }
  }
  return undefined;
}

function compileDeployerProgram(
  sourceAst: Ast,
  code: string,
  options: InternalCompilerOptions,
  constants: import('./generation/deployerConstants.js').DeployerConstants,
  oraclePoolBinding = false,
  liveReadsBlockData = false,
): { artifact: Artifact; box: DeployerProgramBox } | { reason: string; detail?: string } {
  const box: DeployerProgramBox = { oraclePoolBinding, readsBlockData: liveReadsBlockData };
  if (baseConstructorArgumentReadsState(sourceAst)) return { reason: 'ctor-base-argument' };
  const orderDependence = constructionOrderDependence(sourceAst);
  if (orderDependence !== undefined) return { reason: 'ctor-construction-order', detail: orderDependence };
  if (options.__deployerTestBox?.forceReason !== undefined) {
    box.forceReason = options.__deployerTestBox.forceReason;
  }
  const inner = {
    ...options,
    deployer: false,
    // C is stateful, so its deployer program is compiled as one, also when C declares no state of its own and
    // is stateful because it creates a stateful child (B10): the program keeps none of C's functions to show it.
    forceStateful: true,
    callBatch: false,
    callRecords: 'returning',
    genesisCalls: false,
    composition: 'direct',
    split: undefined,
    autoDelegate: false,
    __deployerProgram: {
      constants, box, thirdArm: options.__deployerTestBox?.thirdArm === true,
      genesisLayout: options.__deployerTestBox?.genesisLayout,
    },
    __parsedAst: undefined,
    __deployerConstantsBox: undefined,
    __internalAttemptFailureState: undefined,
  } as InternalCompilerOptions;
  delete (inner as { delegateVariant?: unknown }).delegateVariant;
  let artifact: Artifact;
  try {
    const programAst = cloneAst(sourceAst, 'deployer-program');
    if (sourceAst.contract.oraclePoolBindingForGenesis === true) {
      programAst.contract.oraclePoolBindingForGenesis = true;
    }
    // The program is compiler-generated: its `unsafe` sweep and its missing user entries are not source facts.
    artifact = withCompilerWarnings(true, () => compileResolvedAst(
      programAst, code, inner,
    ));
  } catch (error) {
    // A `ctor-…` reason is a signal that ends this build only; B7.14 turns it into the warning and artifact field.
    if (error instanceof DeployerUnsupportedError) {
      return { reason: error.reason, detail: error.message.replace(/^[^:]*\(\S+\): /, '') };
    }
    throw error;
  }
  return { artifact, box };
}

/** B7.8: `create`'s final ABI order is A4.2's, with every synthetic parameter behind the source argument bands. */
function arrangeDeployerParameters(ast: Ast, box: DeployerProgramBox | undefined): void {
  const contract = ast.contract;
  const create = contract.functions.find((fn) => fn.name === '__construct');
  if (create === undefined) return;
  const location = create.location;
  const parameter = (type: Type, name: string): ParameterNode => {
    const node = new ParameterNode(type, name);
    node.location = location;
    return node;
  };
  const contractParameters = [...contract.parameters];
  if (box?.oraclePoolBinding === true
    && !contractParameters.some((entry) => entry.name === ORACLE_POOL_PARAMETER)) {
    const pool = parameter(new BytesType(32), ORACLE_POOL_PARAMETER);
    contractParameters.push(pool);
  }
  create.deployerContractParameters = contractParameters;
  if (box !== undefined) box.contractParameterNames = contractParameters.map((contractParameter) => contractParameter.name);
  for (const contractParameter of contractParameters) contractParameter.deployerContractParameter = true;
  contract.parameters = [];
  const sourceParameters = create.parameters.filter((entry) => !entry.name.startsWith('__internal__'));
  const passParameters = create.parameters.filter((entry) => entry.name.startsWith('__internal__')
    && !['__internal__budgetPad', '__internal__oracleOwner', '__internal__authorIndex', '__internal__identity',
      '__internal__creatorInputIdx', '__internal__creatorList', '__internal__creatorListPos',
      '__internal__code', '__internal__deployValue', '__internal__msgSenderCategory',
      '__internal__genesisCallees', '__internal__genesisOutputBase', '__internal__genesisSidecarBase',
      '__internal__genesisCall', '__internal__returnOutputIdx']
      .includes(entry.name)
    && !entry.name.startsWith('__ctorread_') && !entry.name.startsWith('__internal__viewReturn'));
  const readingBlockData = contract.usesBlockOracle === true;
  const readsSender = box?.constructorReadsSender === true;
  create.parameters = [
    parameter(new BytesType(), '__internal__budgetPad'),
    ...(readingBlockData ? [parameter(new BytesType(20), '__internal__oracleOwner')] : []),
    parameter(PrimitiveType.BIGINT, '__internal__authorIndex'),
    parameter(PrimitiveType.BIGINT, '__internal__identity'),
    ...(readsSender ? [
      parameter(PrimitiveType.BIGINT, '__internal__creatorInputIdx'),
      parameter(new BytesType(), '__internal__creatorList'),
      parameter(PrimitiveType.BIGINT, '__internal__creatorListPos'),
    ] : []),
    parameter(PrimitiveType.BIGINT, '__internal__genesisOutputBase'),
    parameter(PrimitiveType.BIGINT, '__internal__genesisSidecarBase'),
    ...(() => {
      const callSlots = (create.externalCalls ?? []).filter(
        (slot) => !slot.loopArrayVar && !slot.inlineLoopDispatch,
      );
      const params = [...passParameters];
      if (callSlots.length <= 1) return params;
      const at = params.findIndex((entry) => entry.name === '__internal__externalCallInputBase');
      if (at < 0) return params;
      const existing = new Set(params.map((entry) => entry.name));
      const witnesses = callSlots.map((slot, index) => parameter(
        PrimitiveType.BIGINT, `__internal__extcallMasterIdx${slot.slotIndex ?? index}`,
      )).filter((entry) => !existing.has(entry.name));
      params.splice(at + 1, 0, ...witnesses);
      return params;
    })(),
    parameter(new BytesType(), '__internal__code'),
    ...contractParameters,
    ...sourceParameters,
    parameter(PrimitiveType.BIGINT, '__internal__deployValue'),
    parameter(new BytesType(32), '__internal__msgSenderCategory'),
    parameter(new BytesType(), '__internal__genesisCallees'),
  ];
}

/**
 * B7.4 (O1): the `sweep` arm is, byte for byte, O8's entry check and the three `require`s of A4.6: `1440
 * OP_CHECKSEQUENCEVERIFY`, an output count of exactly 1, and an empty token category on output 0. Recorded from a
 * build and read against A4.6 (B7.4); any difference is a `DeployerInternalError`. A test hook may replace the
 * emitted body to prove the check trips.
 */
// OP_DEPTH OP_0 OP_NUMEQUALVERIFY · 1440 OP_CHECKSEQUENCEVERIFY OP_DROP · OP_TXOUTPUTCOUNT OP_1 OP_NUMEQUALVERIFY ·
// OP_0 OP_OUTPUTTOKENCATEGORY OP_0 OP_EQUAL
const SWEEP_TEMPLATE = '74009d02a005b275c4519d00d10087';

function assertSweepTemplate(program: Artifact, override: string | undefined, node: Node): void {
  const emitted = override ?? program.functionBodies?.[binToHex(DEPLOYER_SELECTOR_SWEEP)];
  if (emitted !== SWEEP_TEMPLATE) {
    throw new DeployerInternalError(node, `the sweep arm is ${emitted ?? 'missing'}, not O1's template ${SWEEP_TEMPLATE}`);
  }
}

/** B7.8's generator check on `create`'s finished parameter list. */
function assertDeployerParameters(create: FunctionDefinitionNode): void {
  const names = create.parameters.map((parameter) => parameter.name);
  const tail = ['__internal__code', '__internal__deployValue', '__internal__msgSenderCategory',
    '__internal__genesisCallees'];
  const at = names.indexOf('__internal__code');
  if (at < 0 || names[names.length - 1] !== '__internal__genesisCallees'
    || names[names.length - 2] !== '__internal__msgSenderCategory'
    || names[names.length - 3] !== '__internal__deployValue') {
    throw new DeployerInternalError(create, `create's inputs do not end with ${tail.join(', ')}`);
  }
  if (names.some((name) => name.startsWith('__ctorread_') || name.startsWith('__internal__viewReturn'))) {
    throw new DeployerInternalError(create, 'create takes a constructor-read or view-return witness');
  }
  // B7.18 replaces the entry write path with the collection journal. Until it lands, a collection-writing
  // constructor keeps today's write witnesses rather than failing the build.
}

/**
 * B7.5: classify what the constructor does, refuse every `ctor-…` reason A4.1 names, and publish the facts the
 * deployer artifact and the SDK need.
 */
/** B7.9: A4.4's output range order, applied to the layout the constructor's body produced. */
interface GenesisLayoutRows {
  /** Contract parameters that name a token container C keeps single (A8). */
  readonly tokenRows: readonly number[];
  readonly satoshiContainer: 'none' | 'optional' | 'required';
  /** A4.4: one HEAD per sorted collection of C, in the compiler's order. */
  readonly headCollections: readonly string[];
  /** A4.4: per collection the constructor writes, in the HEADs' order, one entry row per append site of its journal. */
  readonly entryRows: readonly { collection: string; count: number }[];
}

function buildGenesisBlockLayout(
  layout: FunctionBlockLayout | undefined, rows: GenesisLayoutRows,
): FunctionBlockLayout | undefined {
  if (layout === undefined) return undefined;
  // A runtime-variable (trailing) region has no genesis form yet; keep today's layout for it.
  if (layout.trailingBase !== undefined) return layout;
  // A4.4's order: master, records, oracle, HEADs, satoshi row, token rows, the collections' entry rows, then the
  // constructor's transfers and events.
  const rank: Partial<Record<BlockSlotKind, number>> = {
    master: 0, dataNft: 1, head: 2, blockhashOracle: 2, blockInfoOracle: 2,
    satoshiContainer: 4, tokenContainer: 5, entry: 5.5, transfer: 6, tcTransfer: 6,
    event: 7, eventChunk: 7, returnEvent: 7,
  };
  const isSidecar = (kind: BlockSlotKind): boolean => kind === 'keccakSideCar' || kind === 'ecrecoverSideCar';
  // A5: a genesis read of a block field comes from the transaction's locktime, so no oracle row exists. A token
  // row exists for each parameter-named container C keeps single, whether or not the constructor reads it (A4.4,
  // "The token rows": each such coin must exist from birth); any other container opens later. The constructor's own
  // container slots are dropped: it reads a container's start as a constant (A5) and sends no tokens (A3 rule 4).
  // A constructor's collection accesses are journal code (A4.4), so any entry slot of the source layout is dropped
  // and its rows are the journal rows inserted below.
  const kept = layout.slots.filter((slot) => slot.kind !== 'blockhashOracle' && slot.kind !== 'blockInfoOracle'
    && slot.kind !== 'satoshiContainer' && slot.kind !== 'tokenContainer' && slot.kind !== 'entry'
    && slot.kind !== 'head' && !isSidecar(slot.kind));
  const inserted: { kind: BlockSlotKind; offset: number; collection?: string; slotIndex?: number }[] = [
    ...rows.headCollections.map((collection) => ({ kind: 'head' as const, offset: 0, collection })),
    ...(rows.satoshiContainer === 'none' ? [] : [{ kind: 'satoshiContainer' as const, offset: 0 }]),
    // In the order of `tokenRows`, the order the SDK lays the rows out (a stable sort keeps it); a token row's
    // slotIndex is the index of the contract parameter that names its container.
    ...rows.tokenRows.map((parameter) => ({ kind: 'tokenContainer' as const, offset: 0, slotIndex: parameter })),
    // Offset 0 like every inserted row: the stable sort keeps each collection's rows together, in the HEADs' order.
    ...rows.entryRows.flatMap(({ collection, count }) => Array.from({ length: count },
      () => ({ kind: 'entry' as const, offset: 0, collection }))),
  ];
  const slots = [...kept, ...inserted]
    .sort((left, right) => (rank[left.kind] ?? 99) - (rank[right.kind] ?? 99) || left.offset - right.offset)
    .map((slot, offset) => ({ ...slot, offset }));
  const outputs = slots.length;
  // The sidecar group follows the range: input and output at the same index (A4.4). It is not part of w_out.
  for (const [position, sidecar] of layout.slots.filter((slot) => isSidecar(slot.kind)).entries()) {
    slots.push({ ...sidecar, offset: outputs + position });
  }
  return { ...layout, blockSize: slots.length, slots };
}

function inspectDeployerConstructor(ast: Ast, options: InternalCompilerOptions): void {
  const contract = ast.contract;
  const create = contract.functions.find((fn) => fn.name === '__construct');
  if (create === undefined) throw new DeployerInternalError(contract, 'the deployer program has no create body');
  const box = options.__deployerProgram!.box;
  const refuse = (reason: string, detail: string): never => {
    throw new DeployerUnsupportedError(create, reason, detail);
  };
  // Test hooks: a reason with no known source shape (A4.1), requested explicitly by a unit test.
  if (box?.forceReason !== undefined) refuse(box.forceReason, 'requested by the test hook');

  const slots = create.externalCalls ?? [];
  if (slots.length > 37) refuse('ctor-call-count', 'the constructor has more than 37 call slots');
  const targets = new Set<string>();
  for (const slot of slots) {
    if (slot.addressIsSelf === true) refuse('ctor-self-call', 'the constructor calls C through this');
    if (slot.inlineLoopDispatch === true || slot.loopArrayVar !== undefined
      || slot.fnPtrCall === true
      || slot.addressIsMsgSender === true || slot.callOrdinal !== undefined) {
      refuse('ctor-call-shape', `the call to ${slot.interfaceName}.${slot.functionName} has a shape a call slot cannot bind`);
    }
    if (slot.callValueEffect === true) refuse('ctor-call-value', 'a constructor call cannot send value');
    // A `sig` is not part of a call record (A7), so a call that passes one could not be bound.
    if ((slot.callRecordParameterTypes ?? []).some((type) => type === PrimitiveType.SIG)) {
      refuse('ctor-call-shape', `the call to ${slot.interfaceName}.${slot.functionName} passes a sig`);
    }
    const target = slot.addressParam ?? slot.addressStateVar ?? slot.addressLiteral ?? slot.interfaceName;
    if (targets.has(target)) {
      refuse('ctor-call-shape', 'two call slots name the same target expression');
    }
    targets.add(target);
    if (slot.condition !== undefined) {
      refuse('ctor-call-conditional', `the call to ${slot.functionName} is conditional`);
    }
  }
  for (const fn of contract.functions) {
    if (fn === create) continue;
    if ((fn.externalCalls?.length ?? 0) > 0) {
      refuse('ctor-call-helper', `the helper '${fn.name}' still holds an external call`);
    }
  }

  for (const state of contract.stateVariables) {
    if (state.isDynamic || isDynamicStorageType(state.type)) {
      refuse('ctor-dynamic-state', `state '${state.name}' is dynamic`);
    }
    if (state.type instanceof FunctionType) {
      refuse('ctor-function-value', `state '${state.name}' is a function value`);
    }
  }

  // A function whose body touches a collection cannot be called from a loop of the constructor.
  const collectionAccessFns = new Set<string>();
  for (const fn of contract.functions) {
    if (fn.body === undefined) continue;
    let touches = false;
    walkInvocationAst(fn.body, (visited) => {
      if (visited instanceof MappingAccessNode || visited instanceof MappingAssignNode
        || visited instanceof MappingFieldAssignNode || visited instanceof MappingDeleteNode) touches = true;
    });
    if (touches) collectionAccessFns.add(fn.name);
  }
  // A4.1's balance rule judges calls by the bodies they name, which are all source: a function of C's inheritance, a
  // free function, a library function or one bound by `using for`, every overload of the name, and everything it
  // calls by name. `walkInvocationAst` walks one body's syntax, so the calls are followed here, by name. A send is
  // `send`, `transfer` or `payMinerFee`; a read is `this.balance`, `address(x).balance` in any cast, or a Yul
  // `selfbalance()` or `balance(...)`.
  type BalanceFacts = { reads: boolean; sends: boolean; calls: Set<string> };
  const balanceFactsOf = (body: Node | undefined): BalanceFacts => {
    const facts: BalanceFacts = { reads: false, sends: false, calls: new Set<string>() };
    if (body === undefined) return facts;
    walkInvocationAst(body, (visited) => {
      if (visited instanceof TransferStatementNode || visited instanceof AddressTransferStatementNode
        || visited instanceof AddressSendExpressionNode || visited instanceof MinerFeeStatementNode) facts.sends = true;
      if (visited instanceof FieldAccessNode && visited.name === 'balance') facts.reads = true;
      if (visited instanceof StateAccessNode && visited.name === 'balance' && visited.stateVariable === undefined) {
        facts.reads = true;
      }
      if (visited instanceof FunctionCallNode) {
        const name = visited.identifier.name;
        facts.calls.add(name);
        // `L.f`, `K.f`, `super.f` and a bound `x.f` all count as the name f, with every overload of it.
        if (name.includes('.')) facts.calls.add(name.slice(name.lastIndexOf('.') + 1));
      }
      if (visited instanceof AssemblyStatementNode) {
        const yul = visited.yulBlock;
        const seenYul = new Set<object>();
        const walkYul = (value: unknown): void => {
          if (value === null || typeof value !== 'object' || seenYul.has(value)) return;
          seenYul.add(value);
          if (Array.isArray(value)) { for (const item of value) walkYul(item); return; }
          if (value instanceof YulFunctionCallNode && (value.name === 'selfbalance' || value.name === 'balance')) {
            facts.reads = true;
          }
          for (const child of Object.values(value)) walkYul(child);
        };
        if (yul !== undefined) walkYul(yul);
        else if (/\b(selfbalance|balance)\b/.test(visited.assemblyBody)) facts.reads = true;
      }
    });
    return facts;
  };
  const factsByName = new Map<string, BalanceFacts[]>();
  for (const fn of [...contract.functions, ...ast.freeFunctions]) {
    const facts = balanceFactsOf(fn.body);
    for (const name of new Set([fn.name, fn.name.slice(fn.name.lastIndexOf('.') + 1)])) {
      factsByName.set(name, [...(factsByName.get(name) ?? []), facts]);
    }
  }
  const rootFacts = balanceFactsOf(create.body);
  let constructorSends = rootFacts.sends;
  let readsBalance = rootFacts.reads;
  const pendingNames = [...rootFacts.calls];
  const visitedNames = new Set<string>();
  while (pendingNames.length > 0) {
    const name = pendingNames.pop()!;
    if (visitedNames.has(name)) continue;
    visitedNames.add(name);
    for (const facts of factsByName.get(name) ?? []) {
      constructorSends ||= facts.sends;
      readsBalance ||= facts.reads;
      pendingNames.push(...facts.calls);
    }
  }

  let blockNumber = false;
  let blockTimestamp = false;
  let conditionalDepth = 0;
  let loopDepth = 0;
  const seen = new Set<Node>();
  const walk = (node: Node, parent?: Node): void => {
    if (seen.has(node)) return;
    seen.add(node);
    if (node instanceof SelfdestructStatementNode) refuse('ctor-selfdestruct', 'the constructor contains selfdestruct');
    if (node instanceof InstantiationNode) refuse('ctor-creates', 'the constructor contains new');
    if (node instanceof LowLevelCallNode || node instanceof LowLevelCallStatementNode) {
      refuse('ctor-lowlevel-call', 'the constructor makes a raw call');
    }
    if (node instanceof ExternalOutputStateAccessNode) {
      refuse('ctor-external-state', 'the constructor reads another contract\'s state');
    }
    if (node instanceof TokenContainerMethodStatementNode) {
      refuse('ctor-token-container', 'the constructor uses a token container method');
    }
    if (node instanceof DeleteStateNode || node instanceof MappingDeleteNode || node instanceof ArrayDeleteNode
      || node instanceof StateArrayDeleteNode) {
      refuse('ctor-collection-shape', 'the constructor deletes an entry');
    }
    if (node instanceof ReturnNode && slots.length > 0) {
      refuse('ctor-call-conditional', 'the constructor has a return and a call slot');
    }
    if (node instanceof NullaryOpNode) {
      if (node.operator === NullaryOperator.OUTPUT_COUNT
        || node.operator === NullaryOperator.MSG_SIG || node.operator === NullaryOperator.MSG_DATA) {
        if (node.operator === NullaryOperator.OUTPUT_COUNT) {
          refuse('ctor-reads-outputs', 'the constructor reads tx.outputs');
        }
        refuse('ctor-function-value', `the constructor reads ${node.operator}`);
      }
      if (node.operator === NullaryOperator.BLOCK_NUMBER) blockNumber = true;
      if (node.operator === NullaryOperator.BLOCK_TIMESTAMP) blockTimestamp = true;
      if ([NullaryOperator.BLOCK_DIFFICULTY, NullaryOperator.BLOCK_SIZE, NullaryOperator.BLOCK_TOTAL_FEES,
        NullaryOperator.BLOCK_BASEFEE, NullaryOperator.BLOCK_BLOBBASEFEE, NullaryOperator.BLOCK_GASLIMIT,
        NullaryOperator.BLOCK_PREVRANDAO, NullaryOperator.BLOCK_COINBASE, NullaryOperator.LOCKTIME]
        .includes(node.operator)) {
        refuse('ctor-block-data', `the constructor reads ${node.operator}`);
      }
    }
    if (node instanceof UnaryOpNode && (node.operator === UnaryOperator.OUTPUT_TOKEN_CATEGORY
      || node.operator === UnaryOperator.OUTPUT_NFT_COMMITMENT || node.operator === UnaryOperator.OUTPUT_VALUE
      || node.operator === UnaryOperator.OUTPUT_TOKEN_AMOUNT)) {
      refuse('ctor-reads-outputs', 'the constructor reads tx.outputs');
    }
    if (node instanceof VariableDefinitionNode && node.type instanceof FunctionType) {
      refuse('ctor-function-value', `local '${node.name}' is a function value`);
    }
    if (node instanceof ParameterNode && node.type instanceof FunctionType) {
      refuse('ctor-function-value', `parameter '${node.name}' is a function value`);
    }
    if (node instanceof MappingAccessNode && loopDepth > 0) {
      refuse('ctor-collection-shape', 'the constructor reads a collection in a loop');
    }
    if (node instanceof MappingAssignNode || node instanceof MappingFieldAssignNode) {
      if (loopDepth > 0) refuse('ctor-collection-shape', 'the constructor writes a collection in a loop');
      // The write must be a statement of its own: not an operand of another expression.
      if (!(parent instanceof BlockNode) && !(parent instanceof ExpressionStatementNode)) {
        refuse('ctor-collection-shape', 'a collection write is not a statement of its own');
      }
    }
    if (loopDepth > 0 && node instanceof FunctionCallNode
      && collectionAccessFns.has(node.identifier.name)) {
      refuse('ctor-collection-shape', `the constructor calls '${node.identifier.name}', which accesses a collection, in a loop`);
    }
    if ((node instanceof EmitStatementNode || node instanceof TransferStatementNode
      || node instanceof AddressTransferStatementNode || node instanceof AddressSendExpressionNode)
      && loopDepth > 0) {
      refuse('ctor-loop-effects', 'the constructor emits or sends inside a loop');
    }
    if (node instanceof FunctionCallNode && (node.fromThisCall === true || node.fromExternalSelfCall === true)) {
      refuse('ctor-self-call', 'the constructor calls C through this');
    }
    if ((node instanceof ExternalFunctionCallNode || node instanceof FunctionCallNode)
      && node instanceof ExternalFunctionCallNode && conditionalDepth > 0) {
      refuse('ctor-call-conditional', 'the constructor makes a call under a condition');
    }
    if (node instanceof ExternalFunctionCallNode && loopDepth > 0) {
      refuse('ctor-call-shape', 'the constructor makes a call inside a loop');
    }

    const branch = node instanceof BranchNode || node instanceof TernaryOpNode || node instanceof TryCatchNode
      || (node instanceof BinaryOpNode && (node.operator === BinaryOperator.AND || node.operator === BinaryOperator.OR));
    const loop = node instanceof WhileNode || node instanceof DoWhileNode || node instanceof CollectionIterationNode;
    if (branch) conditionalDepth += 1;
    if (loop) loopDepth += 1;
    for (const [key, child] of Object.entries(node)) {
      if (['location', 'definition', 'resolvedFunction', 'functionReference', 'symbolTable', 'type',
        'referencedContract', 'stateVariable', 'collection', 'sourceCallNode'].includes(key)) continue;
      if (child instanceof Node) walk(child, node);
      else if (Array.isArray(child)) for (const item of child) if (item instanceof Node) walk(item, node);
    }
    if (loop) loopDepth -= 1;
    if (branch) conditionalDepth -= 1;
  };
  walk(create.body);
  if (blockNumber && blockTimestamp) {
    refuse('ctor-block-data', 'the constructor reads both block.number and block.timestamp');
  }
  if (readsBalance && constructorSends) {
    refuse('ctor-collection-shape', 'the constructor reads the balance and sends satoshis');
  }

  const boxTarget = options.__deployerProgram!.box;
  if (boxTarget !== undefined) {
    boxTarget.callSlots = slots.length;
    boxTarget.constructorReadsSender = create.usesMsgSender === true;
    // A2: this is the oracle Deploy<C> mints for C's live functions. The program's own bodies are genesis bodies
    // and read the locktime, so their own block reads do not set it.
    boxTarget.readsBlockData = boxTarget.readsBlockData === true;
    boxTarget.constructorBlockField = blockNumber ? 'number' : blockTimestamp ? 'timestamp' : undefined;
    boxTarget.sidecars = {
      keccak: create.keccakCompute === true ? 1 : 0,
      ecrecover: create.ecrecoverCallCount ?? 0,
    };
    let sendsSatoshi = false;
    const writtenCollections = new Set<string>();
    walkInvocationAst(create.body, (node) => {
      if (node instanceof TransferStatementNode || node instanceof AddressTransferStatementNode
        || node instanceof AddressSendExpressionNode) sendsSatoshi = true;
      // After the journal rewrite no collection access is left in `create`: a read would take the type default
      // and a write would be minted from witnesses, neither checked against the journal, so any left is refused.
      if (node instanceof MappingAssignNode || node instanceof MappingFieldAssignNode || node instanceof MappingAccessNode) {
        writtenCollections.add(node.name);
      }
    });
    // A4.4: the rewrite turned every collection write of the constructor into a journal append. A write that is still
    // a collection write would be minted from builder-supplied witnesses with no check of the rows, so it is refused.
    if (writtenCollections.size > 0) {
      refuse('ctor-collection-shape', `the constructor writes the collection '${[...writtenCollections][0]}' outside `
        + 'its journal');
    }
    const appendSites = journalAppendSites(create.body);
    const singleSatoshi = options.__deployerProgram!.constants.singleSatoshiContainer;
    const payable = create.modifiers.includes(FunctionModifier.PAYABLE);
    boxTarget.satoshiContainer = singleSatoshi ? 'required' : payable || sendsSatoshi ? 'optional' : 'none';
    // A4.4: per collection the constructor writes, in the HEADs' order, one entry row per append site of its journal.
    boxTarget.collectionRows = options.__deployerProgram!.constants.collections
      .filter((collection) => appendSites.has(collection.name))
      .map((collection) => ({ collection: collection.name, appendSites: appendSites.get(collection.name)! }));
    boxTarget.arms = contract.functions.filter((fn) => fn.isEntryPoint).map((fn) => fn.name);
    // B7.9: the genesis range follows A4.4. E is the HEAD of a sorted collection the constructor does not write,
    // which is what today's top-level genesis mints for it.
    const constants = options.__deployerProgram!.constants;
    const tokenRows = constants.singleTokenContainerKeys
      .map((name) => contract.parameters.findIndex((parameter) => parameter.name === name))
      .filter((index) => index >= 0);
    // A4.4: one HEAD per collection, written at birth or not.
    const headCollections = constants.collections
      .filter((collection) => collection.sorted)
      .map((collection) => collection.name);
    // Test hook: a constructor layout with a trailing region, so the check below can be shown to throw.
    const layoutHook = options.__deployerProgram!.genesisLayout;
    const sourceLayout = layoutHook === 'trailing' && create.blockLayout !== undefined
      ? { ...create.blockLayout, trailingBase: create.blockLayout.blockSize } : create.blockLayout;
    // buildGenesisBlockLayout keeps a layout with a trailing region as it is, with none of A4.4's container rows, so
    // `create` would pin none of them: fail closed rather than build that deployer.
    if (sourceLayout?.trailingBase !== undefined && (boxTarget.satoshiContainer !== 'none' || tokenRows.length > 0)) {
      throw new DeployerInternalError(create,
        'the constructor\'s layout keeps a trailing region, which has no genesis form for C\'s container rows');
    }
    create.blockLayout = buildGenesisBlockLayout(sourceLayout, {
      tokenRows, satoshiContainer: boxTarget.satoshiContainer, headCollections,
      entryRows: boxTarget.collectionRows.map((row) => ({ collection: row.collection, count: row.appendSites })),
    });
    // Test hook: no genesis layout at all, so the generator's check (emitGenesisRowPins) can be shown to throw.
    if (layoutHook === 'drop') create.blockLayout = undefined;
    boxTarget.genesisOutputs = create.blockLayout?.slots
      .filter((slot) => slot.kind !== 'keccakSideCar' && slot.kind !== 'ecrecoverSideCar').length ?? 0;
    // Every entry row is a journal row (A4.4); one the rewrite did not account for would be pinned by nothing.
    const journalRows = boxTarget.collectionRows.reduce((total, row) => total + row.appendSites, 0);
    if ((create.blockLayout?.slots.filter((slot) => slot.kind === 'entry').length ?? 0) !== journalRows) {
      throw new DeployerInternalError(create, 'the genesis layout holds an entry row that is not a journal row');
    }
  }
  void box;
}

/**
 * B7.4: the finished deployer program has exactly the two arms of A4.2 and no receive or fallback. A test hook
 * may add a third entry through `__deployerProgram.box.arms`, so the check itself is exercised.
 */
function assertDeployerArms(ast: Ast, options: InternalCompilerOptions): void {
  const contract = ast.contract;
  const entries = contract.functions.filter((fn) => fn.isEntryPoint);
  const names = entries.map((fn) => fn.name).sort();
  const expected = ['__construct', '__solidcash_sweep'];
  const selectors = entries.map((fn) => (fn.functionSelector === undefined ? '' : binToHex(fn.functionSelector)));
  const expectedSelectors = [binToHex(DEPLOYER_SELECTOR_CREATE), binToHex(DEPLOYER_SELECTOR_SWEEP)];
  if (names.length !== expected.length || names.some((name, index) => name !== expected[index])) {
    throw new DeployerInternalError(contract, `Deploy<${contract.name}> dispatches ${JSON.stringify(names)}, not create and sweep`);
  }
  if (selectors.length !== expectedSelectors.length
    || expectedSelectors.some((selector) => !selectors.includes(selector))) {
    throw new DeployerInternalError(contract, `Deploy<${contract.name}> has the wrong create/sweep selectors`);
  }
  if (contract.receiveDef !== undefined || contract.fallbackDef !== undefined) {
    throw new DeployerInternalError(contract, `Deploy<${contract.name}> has a receive or fallback arm`);
  }
  void options;
}

type InternalCompilerOptions = CompilerOptions & {
  /**
   * The public options the outermost compile was given. A contract this compile creates or embeds is compiled with
   * exactly these, as its own standalone compile, so the embedded bytes are the artifact a caller deploys.
   */
  __referencedChildOptions?: CompilerOptions;
  __parsedAst?: Ast;
  /** Set on a per-entry shard whose storage-shaping passes already ran on the whole contract. */
  __functionSplitPrepared?: boolean;
  /** Frame kinds the shard's master head admits. Absent keeps the historical four. */
  __functionSplitFrameKinds?: readonly number[];
  /**
   * Set on a per-entry shard of a contract whose entries name a token container: every shard's master authorizes a
   * container spend, so each keeps the containers its entry does not name, whichever entries the shard holds.
   */
  __framedContractHoldsTokens?: boolean;
  /**
   * Set on a split shard, facet or root whose logical contract has events (`splitLogicalEventOptions`): it holds some
   * bodies only, yet pins forged logs (SEC-10) as that contract does.
   */
  __logicalContractEmitsEvent?: boolean;
  /**
   * Set beside `__logicalContractEmitsEvent`: the signatures its unsplit artifact lists. A shard lists the file-level
   * ones among them though another shard holds the body that emits them.
   */
  __logicalContractEvents?: readonly string[];
  /** Test-only audit flag: the compile skips the artifact cache and refuses a recorded internal attempt failure. */
  __strictNoInternalRecovery?: boolean;
  /** Test-only observation of the constants B7.2 derives for a deployer. */
  __deployerConstantsBox?: { constants?: import('./generation/deployerConstants.js').DeployerConstants };
  /**
   * Test-only hooks for the deployer generator checks. `journalBudget` and `journalItemLimit` lower A4.4's bounds;
   * the generator reports the journals' cost bound in `journalCost`.
   */
  __deployerTestBox?: {
    thirdArm?: boolean; forceReason?: string; sweepBody?: string; genesisLayout?: 'drop' | 'trailing'; obligationHook?: string;
    journalBudget?: number; journalItemLimit?: number; journalCost?: number;
  };
  /**
   * B8.0: the direct children a creator's `new` names, each compiled standalone with its deployer before the
   * creator's semantic passes run. B8.1's predicate is membership in this map.
   */
  __compiledDeployers?: ReadonlyMap<string, import('./generation/deployerChildren.js').DeployerChild>;
  /** Test-only observation of how many standalone child compiles B8.0 ran. */
  __deployerChildCompileCounter?: { count: number };
  /**
   * The second compile B7.3 runs: the deployer program Deploy<C>. It is internal because a source never asks for
   * it; `deployer: true` builds it and this flag reaches the recursive pipeline that produces it.
   */
  __deployerProgram?: {
    readonly constants: import('./generation/deployerConstants.js').DeployerConstants;
    box?: DeployerProgramBox;
    /** Test hook: add a third entry, so B7.4's arms check can be shown to throw. */
    readonly thirdArm?: boolean;
    readonly forceReason?: string;
    /** Test hook: drop `create`'s genesis layout, or give it a trailing region, so their checks can be shown to throw. */
    readonly genesisLayout?: 'drop' | 'trailing';
  };
  /** Compiler-owned attempt state a `__strictNoInternalRecovery` compile checks after codegen. */
  __internalAttemptFailureState?: InternalAttemptFailureState;
  /** Set once the parsed contract is admitted as a shape this compiler can emit a framed master for. */
  __framedMaster?: boolean;
  /** Each entry's own external calls, in execution order, keyed by entry name, as that entry's sites bind them. */
  __framedEntryCallSites?: ReadonlyMap<string, readonly MasterCallSite[]>;
  /** How many call records every entry's tail holds, which the master head's walk is fixed to. */
  __framedCallCount?: number;
  __framedRefusedEntries?: Map<string, string>;
  /** The CREATE2 children the master's bodies create, which the builder stands up at their EVM identities. */
  __framedCreates?: readonly FramedCreateSite[];
  /** Refused bodies no selector reaches whose definitions are emitted as refusal stubs; never published. */
  __framedStubbedDefinitions?: Map<string, string>;
  __framedBalanceReaders?: readonly string[];
  __framedEntryCallRepeats?: Map<string, boolean>;
  /** The stop-site table a driver derives the master from, one entry per entry point. */
  __framedStopSites?: PublishedFramedStopSites;
  /** Set when the master reserves a slot for the validator program's hash, i.e. it can be reached through a call. */
  __framedReservesValidatorHash?: boolean;
  /**
   * Set for a contract another contract of the compile unit creates: its masters that every spend covers reserve no
   * deployment slot, so each has one lock whatever its category, which the creator checks the child's genesis against.
   */
  __framedConstantLock?: boolean;
  /** The source's `split(n)` and `merge(n)`, served by the master's lifecycle arm rather than its head. */
  __framedLifecycle?: readonly FramedLifecycleEntry[];
  /**
   * Functions refused for a loop guard their published recipe cannot carry, by name, with the published reason. Set
   * by `compileStringUnchecked` after code generation reached the loop; never seeded by a caller.
   */
  __loopGuardRefusals?: ReadonlyMap<string, string>;
  /** Where every compile of one `compileStringUnchecked` attempt records a function it refused for its loop guard. */
  __loopGuardRefusalRecord?: Map<string, string>;
};

/**
 * The script one code-generation output publishes, together with the location data its source map is built from.
 *
 * Optimisation is the shipping default. With `optimise: false` the traversal's own instructions and location data
 * are emitted verbatim, so instruction N keeps the source location that produced it (and `debug.requires` /
 * `debug.logs` instruction pointers stay exact) - the mode a VM instruction-pointer investigation needs, at the
 * cost of a larger script. The optimiser is a pure ASM rewrite, so both outputs are semantically identical.
 */
function emitContractScript(
  optimise: boolean, traversal: GenerateTargetTraversal, constructorParamLength: number,
): ReturnType<typeof optimiseBytecode> {
  if (optimise) {
    return optimiseBytecode(
      traversal.output,
      traversal.getLocationDataForOptimisation(),
      traversal.consoleLogs,
      traversal.requires,
      constructorParamLength,
    );
  }
  return {
    script: traversal.output,
    locationData: traversal.getLocationDataForOptimisation(),
    logs: traversal.consoleLogs,
    requires: traversal.requires,
  };
}

function assertNoInternalAttemptRecovery(options: InternalCompilerOptions): void {
  // Internal frame/layout failures are compiler defects, not shape refusals.
  if (!options.__strictNoInternalRecovery) return;
  const error = options.__internalAttemptFailureState?.firstError;
  if (error !== undefined) throw error instanceof Error ? error : new Error(String(error));
}

interface OptionalLoweringFeatures {
  hasFunctionPointers: boolean;
  // A function type outside a declaration's written type: the narrower question the framed shape check asks.
  functionTypeOutsideDeclarations: boolean;
  needsBlockOracle: boolean;
  needsMsgDataContext: boolean;
  needsMsgSigContext: boolean;
  needsSpecialMethodPruning: boolean;
  needsDynamicStateJournal: boolean;
  needsCollectionJournal: boolean;
  needsExternalCallLowering: boolean;
  needsInlineAssembly: boolean;
  needsTailRecursion: boolean;
  needsReturnInLoop: boolean;
  needsNamedReturns: boolean;
  needsReturnDesugaring: boolean;
  needsNestedBranchReturn: boolean;
  needsPostfixIncDec: boolean;
  needsMappingFieldCoalesce: boolean;
  needsLoop: boolean;
  needsBreakContinue: boolean;
  needsEarlyReturn: boolean;
  needsVMapCounter: boolean;
  needsRuntimeLoopTransferCounter: boolean;
  needsRuntimeLoopEventCounter: boolean;
  needsAlphaRename: boolean;
  statefulnessSurveyComplete: boolean;
  hasContractInstantiation: boolean;
  deploysWithValue: boolean;
  emitsEvent: boolean;
}

/** True when `code` is the complete program (no external import files to search). Sibling contracts in the
 * same string are already in `code`. */
function rootSourceCoversProgram(ast: Ast): boolean {
  return ast.imports.length === 0;
}

function surveyOptionalLowerings(root: Node): OptionalLoweringFeatures {
  const mappingStorageReturn = (type: Type): boolean => type instanceof MappingType
    || (type instanceof ArrayType && mappingStorageReturn(type.elementType));
  const seenNodes = new Set<Node>();
  const seenTypes = new Set<object>();
  const seenMappingTypes = new Set<object>();
  const typeContainsFunction = (type: Type): boolean => {
    if (type instanceof FunctionType) return true;
    if (seenTypes.has(type as object)) return false;
    seenTypes.add(type as object);
    if (type instanceof ArrayType) return typeContainsFunction(type.elementType);
    if (type instanceof MappingType) {
      return typeContainsFunction(type.keyType) || typeContainsFunction(type.valueType);
    }
    if (type instanceof StructType) return type.fields.some((field) => typeContainsFunction(field.type));
    if (type instanceof TupleType) return type.elements.some(typeContainsFunction);
    return false;
  };
  const typeContainsMapping = (type: Type): boolean => {
    if (type instanceof MappingType) return true;
    if (seenMappingTypes.has(type as object)) return false;
    seenMappingTypes.add(type as object);
    if (type instanceof ArrayType) return typeContainsMapping(type.elementType);
    if (type instanceof StructType) return type.fields.some((field) => typeContainsMapping(field.type));
    if (type instanceof TupleType) return type.elements.some(typeContainsMapping);
    return false;
  };
  const pending = [root];
  let needsBlockOracle = false;
  let needsMsgDataContext = false;
  let needsMsgSigContext = false;
  let needsSpecialMethodPruning = false;
  let needsDynamicStateJournal = false;
  let needsCollectionJournal = false;
  let needsExternalCallLowering = false;
  let needsInlineAssembly = false;
  let hasContractInstantiation = false;
  let deploysWithValue = false;
  let emitsEvent = false;
  let hasFunctionPointers = false;
  let functionTypeOutsideDeclarations = false;
  let needsTailRecursion = false;
  let needsReturnInLoop = false;
  let needsNamedReturns = false;
  let needsReturnDesugaring = false;
  let needsNestedBranchReturn = false;
  let needsPostfixIncDec = false;
  let needsMappingFieldCoalesce = false;
  let needsLoop = false;
  let needsBreakContinue = false;
  let needsEarlyReturn = false;
  let needsVMapCounter = false;
  let needsRuntimeLoopTransferCounter = false;
  let needsRuntimeLoopEventCounter = false;
  let needsAlphaRename = false;
  const definedFunctionNames = new Set<string>();
  const calledFunctionNames = new Set<string>();
  const loopContains = (loop: WhileNode | DoWhileNode, effect: (candidate: Node) => boolean): boolean => {
    const seen = new Set<Node>();
    const walk = (candidate: Node): boolean => {
      if (seen.has(candidate)) return false;
      seen.add(candidate);
      if (effect(candidate)) return true;
      for (const key in candidate) {
        if (key === 'location' || key === 'type' || key === 'name' || key === 'functionId'
          || key === 'resolvedFunction' || key === 'functionReference' || key === 'definition'
          || key === 'symbolTable' || key === 'referencedContract' || key === 'stateVariable'
          || key === 'collection') continue;
        const value = (candidate as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) { if (walk(value)) return true; } else if (Array.isArray(value)) {
          for (const item of value) if (item instanceof Node && walk(item)) return true;
        }
      }
      return false;
    };
    return walk(loop.block);
  };
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (seenNodes.has(node)) continue;
    seenNodes.add(node);
    if (node instanceof AssemblyStatementNode) {
      // Yul lowering still needs the assembly pass. Other optional lowerings are surveyed from the
      // nodes they actually rewrite so pointer-free assembly (OZ ERC-7201 sstore/sload) does not
      // force msg.data / journal / oracle visitors.
      needsInlineAssembly = true;
    } else if ((node instanceof NullaryOpNode && String(node.operator).startsWith('block.'))
      || (node instanceof IdentifierNode && node.name === 'now')
      || (node instanceof FunctionCallNode
        && (node.identifier.name === 'gasleft' || node.identifier.name === GlobalFunction.BLOCKHASH))) {
      needsBlockOracle = true;
    }
    if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_DATA) {
      needsMsgDataContext = true;
      needsSpecialMethodPruning = true;
    } else if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_SIG) {
      needsMsgSigContext = true;
    }
    if (node instanceof InstantiationNode) {
      needsSpecialMethodPruning = true;
      // A built-in locking bytecode class (`new LockingBytecodeP2PKH(hash)`) builds an output, not a contract.
      if (!(Object.values(Class) as string[]).includes(node.identifier.name)) hasContractInstantiation = true;
      if (hasEffectiveCallValue(node.callOptions?.value)) deploysWithValue = true;
    } else if (node instanceof ContractReferenceNode
      || (node instanceof TypeIntrospectionNode
        && (node.property === 'creationCode' || node.property === 'runtimeCode'))) {
      needsSpecialMethodPruning = true;
    } else if (node instanceof EmitStatementNode) {
      emitsEvent = true;
    }
    if (node instanceof FunctionDefinitionNode) {
      definedFunctionNames.add(node.name);
      if (node.returnNames.length > 0) needsNamedReturns = true;
      // A helper returning a mapping storage reference has no standalone VM representation; prune it if unreached.
      if (node.returnTypes.some((type, index) =>
        node.returnModifiers?.[index]?.includes('storage') && mappingStorageReturn(type))) {
        needsSpecialMethodPruning = true;
      }
      // This pass also supplies Solidity's fall-through defaults and a safe body for empty void
      // functions. Named returns alone do not decide whether it runs.
      if (node.returnNames.length > 0 || (node.body && (
        node.returnTypes.length > 0 || (node.body.statements?.length ?? 0) === 0
      ))) needsReturnDesugaring = true;
    }
    // Declared types live in `type` / `returnTypes`, which the structural walk below deliberately skips.
    // Survey them explicitly: a pointer used only in a state variable or signature still needs lowering.
    const declaredType = (node as Node & { type?: Type }).type;
    if (declaredType && typeContainsFunction(declaredType)) hasFunctionPointers = true;
    if ((node instanceof FunctionDefinitionNode || node instanceof InterfaceFunctionNode)
      && node.returnTypes.some(typeContainsFunction)) hasFunctionPointers = true;
    // Struct fields are plain type records, not AST nodes. A declaration-only foreign function pointer
    // otherwise escapes the survey and reaches type validation before it can become a blob.
    if (node instanceof StructDefinitionNode
      && node.fields.some((field) => typeContainsFunction(field.type))) hasFunctionPointers = true;
    if (node instanceof WhileNode || node instanceof DoWhileNode) {
      needsLoop = true;
      // A counter loop whose body mints transfer or event outputs needs the counter-loop lowering even when the
      // contract has no sorted collection, so its N outputs are each derived and pinned, not one.
      if (loopContains(node, (candidate) => candidate instanceof TransferStatementNode
        || candidate instanceof TokenContainerMethodStatementNode)) needsRuntimeLoopTransferCounter = true;
      if (loopContains(node, (candidate) => candidate instanceof EmitStatementNode)) {
        needsRuntimeLoopEventCounter = true;
      }
    }
    if (node instanceof BreakNode || node instanceof ContinueNode) needsBreakContinue = true;
    if (node instanceof BranchNode || node instanceof UncheckedNode || node instanceof SwitchNode
      || node instanceof TryCatchNode
      || (node instanceof BlockNode && (node.statements ?? []).some((statement) => statement instanceof BlockNode))) {
      needsAlphaRename = true;
    }
    if (node instanceof ReturnNode) {
      needsEarlyReturn = true;
      if (needsLoop) needsReturnInLoop = true;
      needsNestedBranchReturn = true;
    }
    if (node instanceof MappingFieldAssignNode) needsMappingFieldCoalesce = true;
    // The same pass hoists an assignment used as an expression (`f(x = v)`, `(s = v) ? a : b`) and spells one in a
    // short-circuit operand as nested branches; without it a state target reaches type checking as a value form.
    if ((node instanceof UnaryOpNode && (
      node.operator === UnaryOperator.POSTFIX_INCREMENT
      || node.operator === UnaryOperator.POSTFIX_DECREMENT
      || node.operator === UnaryOperator.PREFIX_INCREMENT
      || node.operator === UnaryOperator.PREFIX_DECREMENT
    )) || node instanceof AssignmentExpressionNode) {
      needsPostfixIncDec = true;
    }
    // The same desugaring pass also lifts assignment expressions out of value positions (or into a
    // conditional branch for && / ||). They need it even when no increment/decrement occurs.
    if (node instanceof AssignmentExpressionNode) needsPostfixIncDec = true;
    if (node instanceof FunctionCallNode) calledFunctionNames.add(node.identifier.name);
    if (node instanceof ExternalFunctionCallNode || node instanceof LowLevelCallNode
      || node instanceof LowLevelCallStatementNode || node instanceof MethodCallNode
      || node instanceof MethodCallStatementNode || node.constructor.name.startsWith('External')
      || (node instanceof FunctionCallNode && node.identifier.name.includes('.'))) {
      needsExternalCallLowering = true;
    }
    if (node instanceof ContractNode) {
      if (node.collections.length > 0) needsCollectionJournal = true;
      if (node.collections.some((collection) => collection.sorted)) needsVMapCounter = true;
      if (node.stateVariables.some((state) => state.isDynamic || state.type === PrimitiveType.STRING
        || (state.type instanceof BytesType && state.type.bound === undefined))) {
        needsDynamicStateJournal = true;
      }
    }
    // A declaration keeps its written type under `type`, which the key walk below skips (it is an expression's
    // inferred type elsewhere), so a function-pointer local, parameter, state variable or return shows only here.
    const declaredTypes = node instanceof VariableDefinitionNode || node instanceof ParameterNode
      || node instanceof StateVariableNode ? [node.type]
      : node instanceof FunctionDefinitionNode ? node.returnTypes : [];
    if (declaredTypes.some((type) => type !== undefined && typeContainsFunction(type))) hasFunctionPointers = true;
    for (const key in node) {
      if (key === 'location' || key === 'type' || key === 'name' || key === 'functionId' || key === 'resolvedFunction' || key === 'functionReference' || key === 'definition' || key === 'symbolTable' || key === 'referencedContract' || key === 'stateVariable' || key === 'collection') continue;
      const value = node[key as keyof Node] as unknown;
      if (value instanceof FunctionType
        || ((value instanceof ArrayType || value instanceof MappingType
          || value instanceof StructType || value instanceof TupleType)
          && typeContainsFunction(value))) {
        // Keep walking so assembly / msg.data / journal / oracle flags reflect the rest of the tree
        // instead of forcing every optional lowering the moment a FunctionType appears (OZ imports).
        hasFunctionPointers = true;
        functionTypeOutsideDeclarations = true;
      }
      if ((value instanceof ArrayType || value instanceof MappingType
        || value instanceof StructType || value instanceof TupleType)
        && typeContainsMapping(value)) {
        needsSpecialMethodPruning = true;
        needsCollectionJournal = true;
      }
      if (value instanceof Node) pending.push(value);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node) pending.push(item);
      }
    }
  }
  needsTailRecursion = [...calledFunctionNames].some((name) => definedFunctionNames.has(name));
  return {
    hasFunctionPointers,
    functionTypeOutsideDeclarations,
    needsBlockOracle,
    needsMsgDataContext,
    needsMsgSigContext,
    needsSpecialMethodPruning,
    needsDynamicStateJournal,
    needsCollectionJournal,
    needsExternalCallLowering,
    needsInlineAssembly,
    needsTailRecursion,
    needsReturnInLoop,
    needsNamedReturns,
    needsReturnDesugaring,
    needsNestedBranchReturn,
    needsPostfixIncDec,
    needsMappingFieldCoalesce,
    needsLoop,
    needsBreakContinue,
    needsEarlyReturn,
    needsVMapCounter,
    needsRuntimeLoopTransferCounter,
    needsRuntimeLoopEventCounter,
    needsAlphaRename,
    statefulnessSurveyComplete: true,
    hasContractInstantiation,
    deploysWithValue,
    emitsEvent,
  };
}

/** The message bus's options other than the `messageBus*` family, removed with it. */
const REMOVED_BUS_OPTIONS = new Set(['ownerAltAnchor', 'handlerBandModel']);

/** A removed bus option is refused whatever its value: ignoring it would compile something other than was asked. */
function refuseRemovedCompilerOptions(options: CompilerOptions): void {
  const removed = Object.keys(options).filter((key) => key.startsWith('messageBus') || REMOVED_BUS_OPTIONS.has(key));
  if (removed.length === 0) return;
  const names = removed.map((key) => `'${key}'`).join(', ');
  throw new SolidcDiagnosticError('REMOVED_COMPILER_OPTION', `${removed.length > 1 ? 'the options' : 'the option'} `
    + `${names} ${removed.length > 1 ? 'were' : 'was'} removed with the message bus; delete `
    + `${removed.length > 1 ? 'them' : 'it'} from the compiler options. A contract that took a message-bus route `
    + 'compiles to the direct convention.', { options: removed });
}

function normalizeCompilerOptions(options: CompilerOptions): InternalCompilerOptions {
  refuseRemovedCompilerOptions(options);
  // Composition convention is resolved and checked before any lowering: the two conventions produce different
  // addresses and unlocking bytecode, so a request whose code generation is absent must refuse rather than emit
  // an artifact for the other convention. The resolved value replaces the request in the normalized options.
  const compositionConvention = resolveCompositionConvention(options.composition);
  assertCompositionConventionSupported(compositionConvention);
  // B6.2: `callRecords: 'all'` is a direct-convention option.
  if (options.callRecords === 'all' && compositionConvention === 'framed') {
    throw new Error("callRecords: 'all' is not available on a framed compile: "
      + "that convention binds a callee's result in its own way, and a void entry has no result to bind");
  }
  // Debug switch for the whole run: emitting the code generator's bytecode verbatim makes an instruction pointer
  // name the exact source line that produced it, which is what a VM-failure investigation needs. An explicit
  // option still wins, and the resolved value lands in the artifact cache key.
  // production SOLIDC env hot-set: instrumented no-optimise goes through the registry reader (unknown names cannot flip it).
  const optimise = options.optimise
    ?? !solidcEnvFlagEnabled('SOLIDC_NO_OPTIMISE');
  // Production-semantics SOLIDC_* features: explicit CompilerOptions win; else env via registry.
  // Unknown SOLIDC_* keys are ignored (never silently alter bytecode).
  const normalized = {
    ...DEFAULT_COMPILER_OPTIONS,
    ...options,
    composition: compositionConvention,
    optimise,
    // Compiler-owned locals are generated source and never user-actionable warning locations.
    __suppressGeneratedSourceWarnings: true,
    // Recorded once, from the options as the caller gave them so a normalized copy keeps the original.
    __referencedChildOptions: (options as InternalCompilerOptions).__referencedChildOptions
      ?? publicCompilerOptions(options),
  } as InternalCompilerOptions;
  // Solidity's builtin returns the canonical 20-byte EVM address. Preserve an explicit projection override.
  if (normalized.evmCompat && options.ecrecover === undefined) normalized.ecrecover = 'evm';
  return normalized;
}

export interface CompileOptions extends CompilerOptions {
  errorListener?: SolidCashErrorListener;
  /**
   * Receives each compiler warning instead of the default `console.log` print. `suppressWarnings` still
   * discards warnings, including for a listener set on the same compile. Compose with `defaultWarningListener`
   * to print and collect.
   */
  warningListener?: WarningListener;
  /** Select a named top-level contract instead of the source file's last concrete contract. */
  primaryContractName?: string;
  /**
   * Fully compile only these contract names. Other imported concrete contracts are omitted from the
   * ArtifactMap (interfaces still get ABI-only artifacts). Project compilation uses this so an importing
   * root does not pay a second full pipeline for declarations its declaring file will compile.
   */
  compileDeclarations?: readonly string[];
  /**
   * Per contract name, the state layout of the implementation the contract replaces behind a framed proxy. The
   * compile refuses, by name, a contract that would read those records differently (`framed/upgrade-layout.ts`).
   */
  upgradesFrom?: UpgradesFrom;
}

function compilerProfileEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_PROFILE === '1';
}

function profileLog(label: string, startedAt: number, extra?: Record<string, unknown>): void {
  if (!compilerProfileEnabled()) return;
  console.error('[solidc-profile]', JSON.stringify({
    label, ms: Date.now() - startedAt, ...extra,
  }));
}

function cloneAst(ast: Ast, reason: string): Ast {
  const started = Date.now();
  // A whole-program AST is a graph: a diamond import can share one parsed subtree through several paths.
  // Expanding each alias independently is exponential on dependency-heavy libraries and can exhaust the heap
  // before lowering starts. Preserve aliases inside this isolated snapshot; local inlining still uses cloneNode.
  const cloned = cloneNodeGraph(ast);
  profileLog('clone', started, { reason, contract: ast.contract?.name });
  return cloned;
}

/**
 * Cached, clone-on-hit parse of an imported source file.
 *
 * A project compile resolves its whole import graph once per root, and the imported sources are the part that
 * cannot be shared: every pipeline mutates the AST it is given. The multi-declaration compiler already relies on
 * exactly this pattern inside one root (`cloneAst(probe, 'multi-primary')` - "cloning it (~25ms) is much cheaper
 * than re-lexing large Solidity sources for every imported primary (~650ms+)"). Extending it across roots is the
 * same trade: measured on a multi-import corpus the duplicate parses of shared imports are 944ms of a 19.7s
 * ten-root compile.
 *
 * The cache holds a pristine snapshot. The parse it returns to the caller is the freshly parsed tree on a miss
 * and an independent clone on a hit, so no two compilations ever lower the same nodes.
 */
const importedParseCache = new Map<string, Ast>();
const MAXIMUM_CACHED_IMPORTED_PARSES = 24;

export function parseImportedFileCached(
  source: string, evmCompat: boolean, fileId: string,
): Ast {
  const key = `${evmCompat ? '1' : '0'}\x00${fileId}\x00${source}`;
  const cached = importedParseCache.get(key);
  if (cached !== undefined) {
    // Refresh recency for the small bound below.
    importedParseCache.delete(key);
    importedParseCache.set(key, cached);
    return cloneAst(cached, 'imported-parse-cache');
  }
  const ast = parseCode(source, undefined, evmCompat, true, fileId);
  importedParseCache.set(key, cloneAst(ast, 'imported-parse-cache-store'));
  if (importedParseCache.size > MAXIMUM_CACHED_IMPORTED_PARSES) {
    const oldest = importedParseCache.keys().next().value as string | undefined;
    if (oldest !== undefined) importedParseCache.delete(oldest);
  }
  return ast;
}

/** Options of the string entry points, which can also resolve imports from an in-memory map of sources. */
export interface CompileStringOptions extends CompileOptions {
  /**
   * Import sources keyed by path, for filesystem-free import resolution (shorthand for
   * `importResolver: createMapResolver(files)`). A relative import resolves against the importing file's path.
   */
  files?: Record<string, string>;
}

/**
 * Turn the `files` shorthand into the import resolver it stands for. Other options keep their descriptors, as in
 * withoutUpgradesFrom: a rest copy would read every accessor before the pass-token sanitation boundary.
 */
function withFilesResolver<T extends CompileStringOptions>(options: T): Omit<T, 'files'> {
  if (!Object.prototype.hasOwnProperty.call(options, 'files')) return options as Omit<T, 'files'>;
  const { files } = options;
  const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(options);
  delete descriptors.files;
  const remaining = Object.defineProperties({}, descriptors) as Omit<T, 'files'>;
  if (files === undefined) return remaining;
  if (remaining.importResolver !== undefined) {
    throw new Error('Pass either files or importResolver to the compiler, not both');
  }
  return Object.defineProperty(remaining, 'importResolver', {
    value: createMapResolver(files), enumerable: true, writable: true, configurable: true,
  });
}

export interface SplitCompileOptions extends CompileOptions {
  /**
   * Maximum redeem-script bytes for each generated shard, honoured literally.
   *
   * Omit it and the default is the BCH per-input limit, against which the planner additionally budgets the
   * constructor arguments and the widest entry point's own arguments - because that cap covers the whole
   * unlocking bytecode, not just the redeem script.
   */
  maxShardBytes?: number;
  /**
   * Count each framed shard's witness block against `maxShardBytes` beside its redeem script. The block shares a
   * framed master's input with the script, so with a cap that is the input limit the pair fits the input. The block
   * is estimated from what the shard publishes, at the widest view each of its records can hold.
   */
  framedWitnessReserve?: boolean;
  /** Split eligible entry points even when the original artifact already fits. Useful for testing/tuning. */
  forceSplit?: boolean;
  /** Keep named public entry points in the state-owning root instead of delegating them. */
  rootFunctions?: readonly string[];
}

// Optional process-wide memoization of pure string compiles (same code+options -> same artifact).
// Off by default; enabled via SOLIDC_COMPILE_CACHE=1 (test harness sets it) since compilation is
// deterministic. Skipped when a custom errorListener/importResolver is present (non-serializable).
// When SOLIDC_COMPILE_CACHE_DIR is also set, hits/misses are shared across vitest workers via disk
// (each worker has its own Map; the directory is the cross-process layer).
const compileCache = new Map<string, Artifact>();
const diagnosticConsoleLog = console.log;
const diagnosticConsoleWarn = console.warn;

/**
 * Keep warning suppression scoped to one synchronous compiler entry point, including its nested variant passes.
 * A caller-supplied `warningListener` is installed around this, so a suppressed inner compile hides warnings
 * from that listener and restores it on the way out.
 */
function withCompilerWarnings<T>(suppress: boolean | undefined, compile: () => T): T {
  if (!suppress) return compile();
  return withSuppressedWarnings(compile);
}

/** Install `warningListener` for one public compile. Suppression still wins when both are set. */
function runWithWarningListener<T>(
  options: { suppressWarnings?: boolean, warningListener?: WarningListener }, compile: () => T,
): T {
  const listener = options.warningListener;
  const invoke = (): T => withCompilerWarnings(options.suppressWarnings, () => withDistinctWarnings(compile));
  if (listener === undefined || options.suppressWarnings) return invoke();
  return withWarningListener(listener, invoke);
}

function compileCacheLimit(): number {
  const configured = Number(solidcEnvValue('SOLIDC_COMPILE_CACHE_MAX_ENTRIES') ?? 128);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : 128;
}

function compileCacheGet(cacheKey: string): Artifact | undefined {
  const artifact = compileCache.get(cacheKey);
  if (artifact) {
    // Refresh insertion order: long-running watch sessions retain hot fixtures, not every historical edit.
    compileCache.delete(cacheKey);
    compileCache.set(cacheKey, artifact);
  }
  return artifact;
}

const compileMultiCache = new Map<string, ArtifactMap>();
let artifactCacheHits = 0;

function recordArtifactCacheHit(detail: Record<string, unknown>): void {
  artifactCacheHits += 1;
  profileLog('artifact-cache', Date.now(), detail);
}

function artifactCacheEnabled(
  options: CompilerOptions, errorListener: SolidCashErrorListener | undefined, suppressWarnings: boolean,
  warningListener?: WarningListener,
): boolean {
  const internal = options as InternalCompilerOptions;
  // Attempt auditing is meaningful only for a fresh pipeline. A cached artifact has no attempts to observe and
  // would let strict mode report a vacuous success after a prior non-strict compilation populated the cache.
  if (internal.__strictNoInternalRecovery) return false;
  // TODO(remove SOLIDC_COMPILE_CACHE): the compile task now passes `__artifactCache` by default, so this
  // variable is only a legacy switch plus the test harness's way in (`packages/solidcash/vitest.setup.ts` sets
  // it, and `DelegateInference` and `CompileCacheDisk` toggle it). Migrate those to `__artifactCache` and a
  // `--no-cache` task flag, then delete the boolean read here.
  // `SOLIDC_COMPILE_CACHE_DIR`/`_MAX_ENTRIES`/`_BUILD_ID` are separate knobs and stay.
  const want = solidcEnvFlagEnabled('SOLIDC_COMPILE_CACHE') || options.__artifactCache === true;
  return want
    && !errorListener
    // A cached artifact is returned without re-running the passes, so a listener would never observe it.
    && !warningListener
    && (options.__artifactCache === true || !options.importResolver)
    && !solidcEnvFlagEnabled('SOLIDCASH_NO_OUTLINE')
    && (suppressWarnings
      || (console.log === diagnosticConsoleLog && console.warn === diagnosticConsoleWarn));
}

function cacheableCompilerOptions(options: CompilerOptions): Record<string, unknown> {
  const keyOptions = { ...options } as Record<string, unknown>;
  delete keyOptions.importResolver;
  delete keyOptions.__artifactCache;
  delete keyOptions.__referencedChildOptions;
  delete keyOptions.__parsedAst;
  delete keyOptions.__strictNoInternalRecovery;
  delete keyOptions.__internalAttemptFailureState;
  // Derived from the source and the public options by the compile that sets it.
  delete keyOptions.__loopGuardRefusals;
  delete keyOptions.__loopGuardRefusalRecord;
  return keyOptions;
}

/**
 * SOLIDC env registry: public cache-identity builder for audit proofs.
 * Execution-affecting CompilerOptions (+ feature identity bits) must change this key;
 * observation-only knobs (e.g. SOLIDC_COMPILE_CACHE_DIR) must not.
 */
/** Read straight from the environment and change emitted bytecode, so they belong in the cache key. */
const BYTECODE_CHANGING_ENV = [
  'SOLIDC_DEBUG_STREAM_PICK_OFFSET',
  'SOLIDC_ROW_ASSERT',
  'SOLIDC_ROW_HEAD_CHECK',
  'SOLIDC_ROW_STACK_CLEAN',
] as const;

function bytecodeChangingEnvIdentity(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (!env) return '';
  const bits: Record<string, string> = {};
  for (const name of BYTECODE_CHANGING_ENV) {
    const value = env[name];
    if (value !== undefined && value !== '') bits[name] = value;
  }
  return Object.keys(bits).length > 0 ? `\x00${JSON.stringify(bits)}` : '';
}

export function buildArtifactCacheKey(
  code: string, options: CompilerOptions, primaryContractName: string | undefined,
): string {
  const closure = importClosureFingerprint(code, options.rootFileId, options.importResolver);
  return `artifact-v5\x00${COMPILER_CACHE_BUILD_ID}\x00${primaryContractName ?? ''}`
    + `\x00${closure}\x00${code}\x00${JSON.stringify(cacheableCompilerOptions(options))}`
    + bytecodeChangingEnvIdentity();
}

function buildMultiArtifactCacheKey(
  code: string, options: CompilerOptions, compileDeclarations: readonly string[] | undefined,
): string {
  const names = compileDeclarations ? [...compileDeclarations].sort().join(',') : '*';
  return `multi-v1\x00${names}\x00${buildArtifactCacheKey(code, options, '')}`;
}

function cloneArtifactMap(map: ArtifactMap, suppressWarnings: boolean): ArtifactMap {
  const cloned: ArtifactMap = {};
  for (const [name, artifact] of Object.entries(map)) {
    cloned[name] = cloneArtifact(artifact, suppressWarnings);
  }
  return cloned;
}

function compileCacheSet(cacheKey: string, artifact: Artifact): void {
  compileCache.delete(cacheKey);
  const limit = compileCacheLimit();
  while (compileCache.size >= limit) {
    const oldest = compileCache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    compileCache.delete(oldest);
  }
  compileCache.set(cacheKey, artifact);
}

/** Strip lazy `delegateArtifact` so JSON / structuredClone do not force a second compile pass. */
function artifactWithoutDelegate(artifact: Artifact): Artifact {
  return Object.fromEntries(
    Object.keys(artifact)
      .filter((key) => key !== 'delegateArtifact')
      .map((key) => [key, artifact[key as keyof Artifact]]),
  ) as unknown as Artifact;
}

function diskCachePath(cacheKey: string): string | undefined {
  const dir = solidcEnvValue('SOLIDC_COMPILE_CACHE_DIR');
  if (!dir) return undefined;
  const hash = createHash('sha256').update(cacheKey).digest('hex');
  return join(dir, `${hash}.json`);
}

/**
 * Multi-declaration disk entries live beside the single-artifact entries. The `multi-` prefix on the hashed key
 * keeps the two namespaces apart, and the stored payload is tagged so a version skew cannot be misread as a
 * single artifact.
 */
const MULTI_DISK_ENTRY_MARKER = 'solidc-multi-artifact-map';
const MULTI_DISK_ENTRY_VERSION = 1;

function diskMultiCachePath(cacheKey: string): string | undefined {
  const dir = solidcEnvValue('SOLIDC_COMPILE_CACHE_DIR');
  if (!dir) return undefined;
  const hash = createHash('sha256').update(`multi\x00${cacheKey}`).digest('hex');
  return join(dir, `${hash}.json`);
}

/** A disk entry is the sha256 of its key plus `.json`; a writer's temp file appends `.<pid>.<random>.tmp`. */
const DISK_ENTRY_NAME = /^[0-9a-f]{64}\.json$/;
const DISK_TEMP_NAME = /^[0-9a-f]{64}\.json\.\d+\.[0-9a-f]{12}\.tmp$/;
/** Every compiler edit files a full entry set under a new build identity, so the directory needs a bound. */
const DISK_CACHE_MAX_BYTES = 2 ** 30;
let diskCachePrunedDir: string | undefined;

/**
 * Write a cache entry so a concurrent reader never sees a partial file: a unique temp file in the same directory,
 * then an atomic rename. Workers racing on one key rename identical content, so the last rename wins harmlessly.
 */
function writeCacheEntryAtomically(file: string, data: string): void {
  const temp = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(temp, data);
    renameSync(temp, file);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}

/**
 * Bound a cache directory to `maxBytes`: the least recently used entries go (a hit refreshes an entry's mtime) until
 * it holds three quarters of that, and so do temp files a crashed writer left over an hour ago. Files with names
 * the cache does not write are never touched.
 */
export function pruneCompileCacheDir(dir: string, maxBytes = DISK_CACHE_MAX_BYTES): void {
  const entries: { file: string; size: number; used: number }[] = [];
  let total = 0;
  for (const name of readdirSync(dir)) {
    const temp = DISK_TEMP_NAME.test(name);
    if (!temp && !DISK_ENTRY_NAME.test(name)) continue;
    const file = join(dir, name);
    const stat = statSync(file, { throwIfNoEntry: false });
    if (!stat) continue;
    if (!temp) {
      entries.push({ file, size: stat.size, used: stat.mtimeMs });
      total += stat.size;
    } else if (Date.now() - stat.mtimeMs > 3_600_000) {
      rmSync(file, { force: true });
    }
  }
  if (total <= maxBytes) return;
  entries.sort((a, b) => a.used - b.used);
  for (const entry of entries) {
    if (total <= maxBytes * 0.75) break;
    rmSync(entry.file, { force: true });
    total -= entry.size;
  }
}

/** Create the cache directory and, once per process, bound it before the first write. */
function prepareDiskCacheDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
  if (diskCachePrunedDir === dir) return;
  diskCachePrunedDir = dir;
  try {
    pruneCompileCacheDir(dir);
  } catch {
    // Pruning is best-effort, like the cache.
  }
}

/** Mark an entry used, so pruning drops first the ones no current build reads. */
function touchDiskEntry(file: string): void {
  try {
    const now = new Date();
    utimesSync(file, now, now);
  } catch {
    // A concurrent prune removed it; the copy already read stays valid.
  }
}

function diskCacheGet(cacheKey: string): Artifact | undefined {
  const file = diskCachePath(cacheKey);
  if (!file || !existsSync(file)) return undefined;
  try {
    const artifact = JSON.parse(readFileSync(file, 'utf8')) as Artifact;
    touchDiskEntry(file);
    return artifact;
  } catch {
    return undefined;
  }
}

/**
 * Read a whole multi-declaration artifact map. A project compile asks for every declaration from a fresh
 * process, so without this layer the multi cache could only ever serve within one process and every CLI
 * invocation still paid the full `parseAndResolve` just to enumerate declarations.
 */
function diskMultiCacheGet(cacheKey: string): ArtifactMap | undefined {
  const file = diskMultiCachePath(cacheKey);
  if (!file || !existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
      marker?: unknown; version?: unknown; artifacts?: unknown;
    };
    if (parsed?.marker !== MULTI_DISK_ENTRY_MARKER || parsed.version !== MULTI_DISK_ENTRY_VERSION) {
      return undefined;
    }
    const artifacts = parsed.artifacts;
    if (!artifacts || typeof artifacts !== 'object') return undefined;
    const map: ArtifactMap = {};
    for (const [name, artifact] of Object.entries(artifacts as Record<string, Artifact>)) {
      if (artifact && typeof artifact === 'object') map[name] = artifact;
    }
    if (Object.keys(map).length === 0) return undefined;
    touchDiskEntry(file);
    return map;
  } catch {
    return undefined;
  }
}

function diskMultiCacheSet(cacheKey: string, map: ArtifactMap): void {
  const file = diskMultiCachePath(cacheKey);
  if (!file) return;
  try {
    prepareDiskCacheDir(solidcEnvValue('SOLIDC_COMPILE_CACHE_DIR')!);
    // Lazy delegate variants are stripped for the same reason as the single-artifact entries: serializing them
    // would force a second codegen pass per declaration. Re-attached on the read path instead.
    const artifacts: Record<string, Artifact> = {};
    for (const [name, artifact] of Object.entries(map)) {
      artifacts[name] = artifactWithoutDelegate(artifact);
    }
    writeCacheEntryAtomically(file, JSON.stringify({
      marker: MULTI_DISK_ENTRY_MARKER, version: MULTI_DISK_ENTRY_VERSION, artifacts,
    }));
  } catch {
    // Cache is best-effort; a full disk or race must not fail the compile.
  }
}

function diskCacheSet(cacheKey: string, artifact: Artifact): void {
  const file = diskCachePath(cacheKey);
  if (!file) return;
  try {
    prepareDiskCacheDir(solidcEnvValue('SOLIDC_COMPILE_CACHE_DIR')!);
    // Primary artifact only - re-attaching the lazy delegate on every disk hit would re-run codegen.
    writeCacheEntryAtomically(file, JSON.stringify(artifactWithoutDelegate(artifact)));
  } catch {
    // Cache is best-effort; a full disk or race must not fail the compile.
  }
}

/**
 * Clone an artifact without forcing its lazy delegate variant. `structuredClone()` reads enumerable getters,
 * which would eagerly run the second compiler pass whenever SOLIDC_COMPILE_CACHE=1 (including the SDK tests).
 * Keep the cache's artifact as the single variant owner; each returned clone materializes its own cloned variant
 * only when a consumer actually reads `delegateArtifact`.
 */
function cloneArtifact(artifact: Artifact, suppressWarnings = false): Artifact {
  const delegateDescriptor = Object.getOwnPropertyDescriptor(artifact, 'delegateArtifact');
  if (!delegateDescriptor?.get) return structuredClone(artifact);

  const withoutDelegate = artifactWithoutDelegate(artifact);
  const cloned = structuredClone(withoutDelegate);
  let memo: Artifact | undefined;
  let built = false;
  Object.defineProperty(cloned, 'delegateArtifact', {
    enumerable: true,
    configurable: true,
    get(): Artifact | undefined {
      if (!built) {
        const variant = withCompilerWarnings(
          suppressWarnings,
          () => delegateDescriptor.get!.call(artifact) as Artifact | undefined,
        );
        memo = variant ? structuredClone(variant) : undefined;
        built = true;
      }
      return memo;
    },
    set(value: Artifact | undefined): void { memo = value; built = true; },
  });
  return cloned;
}

/** Identity of one source function: name plus declaration position, so two overloads stay distinct. */
function sourceFunctionKey(fn: FunctionDefinitionNode): string {
  const start = fn.location?.start;
  return `${fn.name}@${start ? `${start.line}:${start.column}` : '?'}`;
}

/**
 * Preserve the requirement for an absolute dynamic-state input coordinate across journal lowering. Later
 * transformations can replace state reads/writes with value-threaded locals, at which point a fresh footprint
 * scan can no longer rediscover the physical chunk dependency. Source declaration identity remains stable across
 * those transformations, so it, not generated names, carries the fact to logical entries and OP_INVOKE handlers.
 */
function markDynamicChunkInputBaseFunctions(
  ast: Ast,
  inheritedKeys: ReadonlySet<string> = new Set(),
  writeKeys: Set<string> = new Set(),
): Set<string> {
  const keys = new Set(inheritedKeys);
  const dynamicStateNames = new Set(ast.contract.stateVariables
    .filter((state) => state.isDynamic || state.isPacked || isDynamicStorageType(state.type))
    .map((state) => state.name));
  if (dynamicStateNames.size === 0) return keys;

  const functions = ast.contract.functions;
  const byName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of functions) {
    const group = byName.get(fn.name) ?? [];
    group.push(fn);
    byName.set(fn.name, group);
  }
  const footprintCache = createFootprintAnalysisCache(dynamicStateNames);
  for (const fn of functions) {
    const sourceKey = sourceFunctionKey(fn);
    const footprint = analyseFunctionFootprint(fn, byName, footprintCache);
    const writesDynamicState = footprint.writes.some((resource) => {
      // Element/field mutations are collection resources before semantic lowering; whole-value writes use
      // state resources. Both refer to the same declared dynamic continuation family.
      const name = resource.startsWith('state:') ? resource.slice('state:'.length)
        : resource.startsWith('collection:') ? resource.split(':')[1] : undefined;
      return name !== undefined && dynamicStateNames.has(name);
    });
    if (writesDynamicState || writeKeys.has(sourceKey)) {
      writeKeys.add(sourceKey);
    }
    const directlyRequiresBase = [...footprint.reads, ...footprint.writes].some((resource) =>
      resource.startsWith('state:') && dynamicStateNames.has(resource.slice('state:'.length)));
    if (directlyRequiresBase || keys.has(sourceKey)) {
      fn.usesDynamicChunkInputBase = true;
      keys.add(sourceKey);
    }
  }
  return keys;
}

/**
 * Compiles one contract, refusing each function whose loop upsert writes under a guard its published recipe cannot
 * carry: each attempt records such a function, and the compile reruns with the recorded functions refused until none
 * is new. Retries are silent; one warning per refused function is printed.
 */
function compileStringUnchecked(code: string, compilerOptions: CompileOptions = {}): Artifact {
  // A failed attempt lowered the tree its caller parsed, so a retry parses its own.
  const artifact = compileStringRefusingLoopGuards(code, compilerOptions);
  return artifact;
}

function compileStringRefusingLoopGuards(code: string, compilerOptions: CompileOptions = {}): Artifact {
  const inherited = (compilerOptions as InternalCompilerOptions).__loopGuardRefusals;
  const refusals = new Map(inherited ?? []);
  for (let attempt = 0; ; attempt += 1) {
    const found = new Map<string, string>();
    const options = {
      ...compilerOptions,
      ...(attempt > 0 && { suppressWarnings: true, __loopGuardRefusals: new Map(refusals) }),
      __loopGuardRefusalRecord: found,
    } as InternalCompilerOptions as CompileOptions;
    // A failed attempt lowered the tree its caller parsed, so a retry parses its own.
    if (attempt > 0) delete (options as InternalCompilerOptions).__parsedAst;
    let artifact: Artifact | undefined;
    let failure: unknown;
    try {
      artifact = attempt === 0 ? compileStringUncheckedAttempt(code, options)
        : withCompilerWarnings(true, () => compileStringUncheckedAttempt(code, options));
    } catch (error) {
      failure = error;
      if (error instanceof UnpublishableLoopGuardError) {
        found.set(error.functionName, `${error.code}: ${error.reason}`);
      }
    }
    const fresh = [...found].filter(([name]) => !refusals.has(name));
    if (fresh.length === 0) {
      if (artifact === undefined) throw failure;
      for (const [name, reason] of refusals) {
        if (!inherited?.has(name)) emitCompilerWarning(`Warning: function '${name}' is refused: ${reason}`);
      }
      return settleCallBatch(code, compilerOptions, artifact);
    }
    for (const [name, reason] of fresh) refusals.set(name, reason);
  }
}

/**
 * The multi-call entry stays where the contract with it leaves a tenth of the per-input limit (at most the consensus
 * limit) for its spends' pushes. Otherwise the contract compiles without it, and says so. A compile whose frame
 * candidates ended with no entry compiles without their shift witnesses, so its bytes are the plain contract's.
 */
function settleCallBatch(code: string, compilerOptions: CompileOptions, artifact: Artifact): Artifact {
  if (compilerOptions.callBatch !== true) return artifact;
  const carried = typeof artifact.callBatch === 'object';
  // A frame candidate's witnesses: an entry shift, or a void entry's record index.
  const takesFrameWitness = artifact.abi.some((fn) => fn.inputs.some((input) => input.name === CALL_BATCH_ROW_SHIFT
    || (input.name === '__internal__returnOutputIdx' && (fn.outputs?.length ?? 0) === 0)));
  if (!carried && !takesFrameWitness) return artifact;
  const limit = Math.min(compilerOptions.maximumInputBytes ?? MAX_INPUT_BYTESIZE, MAX_INPUT_BYTESIZE);
  const room = Math.floor(limit * (1 - CALL_BATCH_INPUT_RESERVE_FRACTION));
  const bytes = asmToBytecode(artifact.bytecode).length;
  if (carried && bytes <= room) return artifact;
  const options = { ...compilerOptions, callBatch: false } as InternalCompilerOptions;
  delete options.__parsedAst;
  const plain = withCompilerWarnings(true, () => compileStringUnchecked(code, options as CompileOptions));
  if (!carried) return plain;
  emitCompilerWarning(`Warning: contract '${artifact.contractName}' carries no multi-call entry: with it the contract `
    + `is ${bytes} bytes, past the ${room} bytes that leave its spends room under the ${limit}-byte per-input `
    + 'limit, so each call to it takes a spend of its own.');
  plain.callBatch = false;
  return plain;
}

function compileStringUncheckedAttempt(code: string, compilerOptions: CompileOptions = {}): Artifact {
  const {
    errorListener, warningListener, primaryContractName, suppressWarnings = false, ...artifactCompilerOptions
  } = compilerOptions;
  const internalOptions = artifactCompilerOptions as InternalCompilerOptions;
  if (internalOptions.__strictNoInternalRecovery && !internalOptions.__internalAttemptFailureState) {
    internalOptions.__internalAttemptFailureState = {};
  }
  delete artifactCompilerOptions.compileDeclarations;
  const parsedAst = (compilerOptions as InternalCompilerOptions).__parsedAst;
  delete (artifactCompilerOptions as InternalCompilerOptions).__parsedAst;
  // The options as the caller gave them, kept for the contracts this compile embeds.
  internalOptions.__referencedChildOptions ??= publicCompilerOptions(artifactCompilerOptions);
  // A caller-supplied tree can be a projected split facet rather than the artifact described by `code`.
  // Never return an ordinary source-cache hit in place of that physical AST.
  const cacheable = parsedAst === undefined
    && artifactCacheEnabled(artifactCompilerOptions, errorListener, suppressWarnings, warningListener);
  let cacheKey = '';
  if (cacheable) {
    cacheKey = buildArtifactCacheKey(code, artifactCompilerOptions, primaryContractName);
    const memHit = compileCacheGet(cacheKey);
    if (memHit) {
      recordArtifactCacheHit({ hit: 'memory', primary: primaryContractName });
      return cloneArtifact(memHit, suppressWarnings);
    }
    const diskHit = diskCacheGet(cacheKey);
    if (diskHit) {
      recordArtifactCacheHit({ hit: 'disk', primary: primaryContractName });
      // Disk stores the primary artifact only (JSON cannot preserve the lazy getter).
      // Re-attach delegateArtifact before promoting so a cold worker matches a warm one.
      const diskOptions = normalizeCompilerOptions(artifactCompilerOptions);
      attachDelegateVariant(diskHit, code, diskOptions, errorListener, primaryContractName, true);
      compileCacheSet(cacheKey, diskHit);
      return cloneArtifact(diskHit, suppressWarnings);
    }
  }
  const mergedCompilerOptions = normalizeCompilerOptions(artifactCompilerOptions);
  if (parsedAst !== undefined) mergedCompilerOptions.__parsedAst = parsedAst;
  const ast = parsedAst ?? parseAndResolve(code, mergedCompilerOptions, errorListener, primaryContractName);
  const artifact = compileResolvedAst(ast, code, mergedCompilerOptions);
  assertNoInternalAttemptRecovery(mergedCompilerOptions);
  attachDelegateVariant(
    artifact, code, mergedCompilerOptions, errorListener, primaryContractName,
    cacheable || !suppressWarnings,
  );
  if (cacheable) {
    compileCacheSet(cacheKey, artifact);
    diskCacheSet(cacheKey, artifact);
  }
  return cacheable ? cloneArtifact(artifact, suppressWarnings) : artifact;
}

/**
 * The options without `upgradesFrom`, which only the layout check after the compile reads. Each other option keeps
 * its descriptor, so an accessor is read where the pipeline reads it (the pass-token sanitation boundary first),
 * not evaluated here by a spread.
 */
function withoutUpgradesFrom(options: CompileOptions): CompileOptions {
  if (!Object.prototype.hasOwnProperty.call(options, 'upgradesFrom')) return options;
  const descriptors = Object.getOwnPropertyDescriptors(options);
  delete descriptors.upgradesFrom;
  return Object.defineProperties({}, descriptors) as CompileOptions;
}

export function compileString(code: string, options: CompileStringOptions = {}): Artifact {
  refuseRemovedCompilerOptions(options);
  if (options.split !== undefined && options.split !== 'off') {
    throw new Error(
      "compileString does not accept split 'size' or 'func'; use compileStringSplit. split is 'off', 'size', or 'func'",
    );
  }
  let compilerOptions: CompileOptions = withFilesResolver(options);
  if (compilerOptions.split === 'off') {
    // A copy: without `files` the resolver hands back the caller's own options object, which must not change.
    compilerOptions = Object.defineProperties({}, Object.getOwnPropertyDescriptors(compilerOptions)) as CompileOptions;
    delete compilerOptions.split;
  }
  // SOLIDC env registry: when SOLIDC_STRICT_UNKNOWN_ENV=1 (CI), refuse unknown SOLIDC_* before any compile work.
  enforceSolidcEnvPolicy();
  const { upgradesFrom } = compilerOptions;
  const artifactOptions = withoutUpgradesFrom(compilerOptions);
  return runWithWarningListener(compilerOptions, () => {
    try {
      const artifact = compileStringUnchecked(code, artifactOptions);
      requireUpgradeLayouts({ [artifact.contractName]: artifact }, upgradesFrom);
      return artifact;
    } catch (cause) {
      if (cause instanceof RangeError && cause.message === 'Maximum call stack size exceeded') {
        throw new CompilerRecursionLimitError();
      }
      throw cause;
    }
  });
}

/** Clear the in-process compile memo Map (tests / cold-worker simulation). Does not touch disk. */
export function clearCompileCache(): void {
  compileCache.clear();
  compileMultiCache.clear();
  artifactCacheHits = 0;
}

/** Current in-process memo entry count (cache diagnostics and tests). */
export function getCompileCacheEntryCount(): number {
  return compileCache.size;
}

/** Hits served from the in-process or disk artifact cache since the last clear. */
export function getArtifactCacheHitCount(): number {
  return artifactCacheHits;
}

/**
 * Compile the same source a second time with its proxy-implementable functions in delegate mode, and attach the
 * result as `artifact.delegateArtifact`. This is what lets source stay free of a `delegate` keyword: the caller
 * never chooses the mode, the SDK selects the variant when the contract is used behind a proxy.
 *
 * Skipped when the contract cannot be an implementation (no eligible function), when already compiling a
 * variant (no recursion), and for library artifacts (AstBuilder already auto-marks those in place).
 */
const DELEGATE_INELIGIBLE_MODIFIERS: string[] = [
  'pure', 'view', 'internal', 'private', 'unsafe', 'upgrade', 'deploy', 'selfdestruct', 'split', 'merge',
  'delegate',
];

function attachDelegateVariant(
  artifact: Artifact, code: string, mergedCompilerOptions: CompilerOptions,
  errorListener?: SolidCashErrorListener, primaryName?: string, reportVariantFailure = true,
): void {
  if (mergedCompilerOptions.autoDelegate || artifact.isLibrary) return;
  // A master program runs at the contract's own address and is never selected as a proxy implementation, so a
  // second delegate-mode compile of the same source would only produce an unusable artifact.
  if (artifact.composition?.convention === 'framed') return;
  // Solidity initializer inference marks the primary artifact itself as a proxy implementation. Do not attach a
  // second delegate pass to that already-delegate artifact: synthetic ABI helpers such as __updateBlockOracle
  // have no visibility modifier and previously looked like another candidate, producing a much larger hybrid
  // artifact which the SDK then preferred over the correct primary implementation.
  if (artifact.abi.some((fn) => fn.modifiers?.includes(FunctionModifier.DELEGATE))) return;
  if (mergedCompilerOptions.delegateArtifactContracts !== undefined
    && !mergedCompilerOptions.delegateArtifactContracts.includes(artifact.contractName)) return;
  // Cheap pre-filter on the standalone ABI, so only contracts that could BE an implementation pay for the second
  // compile: stateful, with an externally-callable state-writing function carrying no disqualifying modifier.
  // Conservative in the same direction as writesState (a false positive costs one wasted compile, never a
  // missing variant); AutoMarkDelegateFunctions makes the real decision.
  const hasStatefulBacking = !!artifact.stateLayout || !!artifact.usesBlockhash
    || !!mergedCompilerOptions.forceStateful || artifact.abi.some((f) => (f.emits?.length ?? 0) > 0);
  if (!hasStatefulBacking) return;
  const couldBeImplementation = artifact.abi.some((f) => f.writesState !== false
    && f.modifiers?.some((modifier) => modifier === FunctionModifier.PUBLIC
      || modifier === FunctionModifier.EXTERNAL)
    && !f.isFallback && !f.isReceive
    && !f.modifiers?.some((m) => DELEGATE_INELIGIBLE_MODIFIERS.includes(m)));
  if (!couldBeImplementation) return;

  const buildVariant = (): Artifact | undefined => {
    // Proxy implementation bytecode is selected by the SDK for delegate execution.
    const variantOptions = {
      ...mergedCompilerOptions,
      autoDelegate: true,
    };
    const out = { delegateFunctionsMarked: 0 };
    let variantFailure: string | undefined;
    let built: Artifact | undefined;
    // The variant recompiles the same source, so every warning would otherwise be printed a second time.
    const { log, warn } = console;
    console.log = (): void => {};
    console.warn = (): void => {};
    try {
      const variantAst = parseAndResolve(code, variantOptions, errorListener, primaryName);
      let variant = compileResolvedAst(
        variantAst, code, variantOptions, false, false, out,
      );
      if (out.delegateFunctionsMarked > 0) built = variant;
    } catch (e) {
      // The delegate variant is an extra capability, never a reason to fail a valid standalone compile. But do
      // not swallow the reason: otherwise asDelegate() reports "no delegate variant" with no trace of why.
      variantFailure = e instanceof Error ? e.message : String(e);
    } finally {
      console.log = log;
      console.warn = warn;
    }
    if (variantFailure !== undefined && reportVariantFailure) {
      emitCompilerWarning(
        `Warning: could not build the delegate (proxy-implementation) variant of '${artifact.contractName}': `
        + `${variantFailure}. The contract itself compiled; it just cannot be used behind a proxy.`,
      );
    }
    return built;
  };

  // Build on first read, not on every compile. The variant is a second full pass over the same source, and most
  // contracts are never used behind a proxy - so paying for it up front doubles the cost of compiling anything
  // that merely COULD be an implementation. Reading `.delegateArtifact` builds it once and caches the result;
  // JSON.stringify / formatArtifact read it like any other property, so emitted artifacts still carry it.
  let memo: Artifact | undefined;
  let built = false;
  Object.defineProperty(artifact, 'delegateArtifact', {
    enumerable: true,
    configurable: true,
    get(): Artifact | undefined {
      if (!built) { memo = buildVariant(); built = true; }
      return memo;
    },
    set(value: Artifact | undefined): void { memo = value; built = true; },
  });
}

// Parse + (optionally re-select a non-default primary contract) + resolve imports. The default primary is the
// LAST top-level contract (AstBuilder); `primaryName` re-selects one for compileStringMulti's per-contract pass.
function parseAndResolve(
  code: string, mergedCompilerOptions: CompilerOptions, errorListener?: SolidCashErrorListener,
  primaryName?: string,
): Ast {
  const parseResolveStarted = Date.now();
  const filesBefore = parseProfileTotals.files;
  const msBefore = parseProfileTotals.ms;
  const sllBefore = parseProfileTotals.sllFails;
  // `console` is tokenized as part of the built-in `console.log` statement, so it is not a general Identifier in
  // the Solidity selective-import grammar. Normalize Hardhat's equivalent named import before parsing.
  const parseSource = code.includes('hardhat/console.sol')
    ? code.replace(
      /import\s*\{\s*console\s*\}\s*from\s*(["'])hardhat\/console\.sol\1\s*;/g,
      (statement) => 'import "hardhat/console.sol";'.padEnd(statement.length, ' '),
    )
    : code;
  // Lexing + parsing
  let ast = parseCode(parseSource, errorListener, mergedCompilerOptions.evmCompat,
    mergedCompilerOptions.chunkedArrays, undefined, mergedCompilerOptions.rootFileId);
  // parseCode leaves read-modify-write keys unbound in a source with imports (see bindLvalueKeyEffects).
  const lvalueKeysUnbound = ast.imports.length > 0;
  // Hardhat's console library is a compiler/runtime debugging hook, not a source dependency that SolidCash
  // should parse or link. Its calls are represented by ConsoleStatementNode and already emit no BCH bytecode,
  // while retaining artifact log metadata for the SDK debugger. Accept both Solidity import spellings without
  // requiring hardhat to be installed or invoking a caller-provided resolver.
  ast.imports = ast.imports.filter((importNode) => importNode.path !== 'hardhat/console.sol');
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
      mergedCompilerOptions.importResolver, mergedCompilerOptions.evmCompat,
    );
    ast = resolver.resolve(ast, mergedCompilerOptions.rootFileId ?? 'main');
  }

  if (primaryName) setPrimaryContract(ast, primaryName);
  // With every file's declarations known; before the type repair below, which also types the bound keys' temps.
  if (lvalueKeysUnbound) bindLvalueKeyEffects(ast);

  // Types are resolved during parse, before imports merge, so an imported struct used as an array element
  // (`Todo[]` where `Todo` is imported) parses to a named AddressType placeholder. Now that imported struct
  // definitions are merged (and the primary is chosen), re-resolve those placeholders to the real StructType.
  if (hadImports) reresolveImportedStructTypes(ast);
  assertNoRecursiveStructDefinitions(ast);
  if ((mergedCompilerOptions.rootFileId ?? '').endsWith('.sol')) {
    assertNoAmbiguousOverrides([
      ...(ast.contract ? [ast.contract] : []), ...(ast.importedContracts ?? []), ...(ast.interfaceDefinitions ?? []),
    ]);
  }
  // Before any lowering, with every file's declarations known: hoisted message effects lower like source statements.
  lowerRequireMessageEffects(ast);
  profileLog('parseAndResolve', parseResolveStarted, {
    files: parseProfileTotals.files - filesBefore,
    sllFails: parseProfileTotals.sllFails - sllBefore,
    parseCodeMs: parseProfileTotals.ms - msBefore,
  });
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

/** A source function's selector cannot be the multi-call entry's (semantic/CallBatch.ts). */
export function assertNoReservedCallBatchSelector(
  functions: readonly Pick<FunctionDefinitionNode, 'name' | 'functionSelector' | 'location'>[],
): void {
  const collision = functions.find((fn) => fn.functionSelector
    && binToHex(fn.functionSelector) === CALL_BATCH_SELECTOR_HEX);
  if (!collision) return;
  throw new SolidcDiagnosticError(
    'CALL_BATCH_RESERVED_SELECTOR_COLLISION',
    `source function selector collides with the reserved multi-call selector 0x${CALL_BATCH_SELECTOR_HEX}`,
    {
      selector: CALL_BATCH_SELECTOR_HEX,
      functionName: collision.name,
      sourceLocation: {
        line: collision.location.start.line,
        column: collision.location.start.column,
      },
    },
  );
}

/** True when a body names a token container. */
function namesTokenContainer(body: BlockNode): boolean {
  let names = false;
  walkInvocationAst(body, (node) => {
    if (node instanceof TokenContainerMethodStatementNode
      || (node instanceof MappingAccessNode && node.name === 'tokens' && node.keys.length === 1)) names = true;
  });
  return names;
}

/** True when any body of the contract names a token container. */
function contractNamesTokenContainer(contract: ContractNode): boolean {
  return [...contract.functions, ...(contract.receiveDef ? [contract.receiveDef] : []),
    ...(contract.fallbackDef ? [contract.fallbackDef] : [])].some((fn) => namesTokenContainer(fn.body));
}

/**
 * What a user should do about a rejection reason, for the reasons whose remedy is exact. A reason with no entry
 * is still named; inventing a remedy for one would be worse than stating the refusal alone.
 */

function packedStateDataNftCount(contract: ContractNode, commitmentLimit: number, tagSingletonDataNfts = false): number {
  const variables = packedStateLayoutVariables(contract, commitmentLimit, tagSingletonDataNfts);
  return variables.length === 0 ? 0 : Math.max(...variables.map((variable) => variable.nftIndex)) + 1;
}

function childDeploymentSites(
  root: FunctionDefinitionNode,
  compiledBytecodes: ReadonlyMap<string, Uint8Array>,
  commitmentLimit: number,
  helperFunctions: readonly FunctionDefinitionNode[] = [],
  tagSingletonDataNfts = false,
): ChildDeploymentSiteAbi[] {
  const sites: ChildDeploymentSiteAbi[] = [];
  // Every site this function can report requires an InstantiationNode in the body, and
  // `hasContractInstantiation` is set for every contract instantiation the symbol pass sees. When the flag is
  // strictly false there is nothing to report, so the recipe analysis plus the whole-body walk below are
  // skipped. Only the returned array is consumed by the caller.
  if (root.hasContractInstantiation === false) return sites;
  const visibleInputs = root.parameters.filter((parameter) => !parameter.name.startsWith('__internal__'));
  const inputIndex = new Map(visibleInputs.map((parameter, index) => [parameter.name, index]));
  const inputTypes = new Map(visibleInputs.map((parameter) => [parameter.name, abiTypeString(parameter.type)]));
  const recipeAnalysis = analyzeChildDeploymentRecipes(root, helperFunctions);
  const active: Array<{ fn: FunctionDefinitionNode; siteStart: number }> = [{ fn: root, siteStart: 0 }];
  let spanOffset = 0;

  const source = (expression: ExpressionNode): ChildDeploymentSiteAbi['constructorArgs'][number] =>
    childDeploymentValueRecipe(
      expression, inputIndex, false, inputTypes, undefined, undefined, undefined, new Set(), helperFunctions,
    ) ?? { kind: 'expression' };
  const saltSource = (expression: ExpressionNode): NonNullable<ChildDeploymentSiteAbi['salt']> => {
    if (expression instanceof IdentifierNode && inputIndex.has(expression.name)) {
      return { kind: 'handlerInput', inputIndex: inputIndex.get(expression.name)! };
    }
    if (expression instanceof HexLiteralNode) return { kind: 'literal', value: binToHex(expression.value) };
    return childDeploymentValueRecipe(
      expression, inputIndex, false, inputTypes, undefined, undefined, undefined, new Set(), helperFunctions,
    ) ?? { kind: 'expression' };
  };
  const combineActivation = (
    outer: ChildDeploymentSiteAbi['activation'], inner: ChildDeploymentSiteAbi['activation'],
  ): ChildDeploymentSiteAbi['activation'] => outer === undefined ? inner
    : inner === undefined ? outer : {
      kind: 'binary', operator: '&&', resultType: 'bool', left: outer, right: inner,
    };

  const walk = (
    value: unknown,
    occurrence: ChildDeploymentSiteAbi['occurrence'],
    seen: WeakSet<object>,
    activation?: ChildDeploymentSiteAbi['activation'],
  ): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, occurrence, seen, activation);
      return;
    }
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);

    if (value instanceof InstantiationNode && value.isStatefulDeploy && value.referencedContract) {
      const analyzed = recipeAnalysis.get(value);
      const child = value.referencedContract;
      const dataNftOutputCount = packedStateDataNftCount(child, commitmentLimit, tagSingletonDataNfts);
      const creationBytecode = compiledBytecodes.get(child.name);
      if (!creationBytecode) throw new Error(`Missing compiled child body for deployment topology '${child.name}'`);
      const genesisState = value.constructorStateFoldComplete === true
        ? childDeploymentGenesisState(
          value.foldedStateInit, child.stateVariables, inputIndex, inputTypes, false, analyzed?.aliases,
          analyzed?.aliasDefinitions, child.functions,
        )
        : undefined;
      const genesisEntries = value.constructorStateFoldComplete === true
        ? childDeploymentGenesisEntries(
          value.foldedCollectionEntries, inputIndex, inputTypes, analyzed?.aliases, analyzed?.aliasDefinitions,
          child.collections,
        ) : undefined;
      const childLayoutDigest = childStateLayoutDigest({
        variables: child.stateVariables.map((state) => ({
          name: state.name,
          type: state.type instanceof EnumType ? 'bigint' : abiTypeString(state.type),
          nftIndex: state.nftIndex ?? 0,
          fieldIndex: state.fieldIndex ?? 0,
          ...(state.isDynamic && { dynamic: true }),
          ...(state.isPacked && { packed: true }),
        })),
        dataNftCount: dataNftOutputCount,
        commitmentLimit,
        ...(tagSingletonDataNfts && dataNftOutputCount === 1 && { taggedDataNfts: true }),
        structs: childDeploymentStructDefinitions(child.stateVariables),
        collections: childDeploymentCollectionDefinitions(child.collections),
      });
      const entryNftOutputCount = genesisEntries?.length ?? 0;
      const spanWidth = 1 + dataNftOutputCount + entryNftOutputCount;
      sites.push({
        siteIndex: sites.length,
        contractName: child.name,
        occurrence,
        spanOffset,
        spanWidth,
        ...(activation && { activation }),
        genesisInputCount: 1,
        masterOutputCount: 1,
        dataNftOutputCount,
        ...(entryNftOutputCount > 0 && { entryNftOutputCount }),
        totalOutputCount: spanWidth,
        categorySource: 'genesis-input-outpoint-txhash',
        constructorArgs: childDeploymentArguments(child, value.parameters.map((parameter, index) => (analyzed
          ? analyzed.constructorArgs[index] ?? { kind: 'expression' }
          : source(parameter)))),
        ...(value.callOptions?.salt && {
          salt: analyzed ? analyzed.salt ?? { kind: 'expression' } : saltSource(value.callOptions.salt),
        }),
        ...(hasEffectiveCallValue(value.callOptions?.value) && {
          value: {
            transferIndex: value.transferIndex,
            amount: analyzed?.value ?? { kind: 'expression' },
          },
        }),
        creationBytecode: binToHex(creationBytecode),
        childLayoutDigest,
        ...(value.hasFoldedChildCall && { hasFoldedChildCall: true as const }),
        ...(genesisState && { genesisState }),
        ...(genesisEntries && genesisEntries.length > 0 && { genesisEntries }),
      });
      spanOffset += spanWidth;
    }

    if (value instanceof BranchNode) {
      const condition = childDeploymentValueRecipe(value.condition, inputIndex, true, inputTypes);
      const nestedOccurrence = occurrence === 'loop' || occurrence === 'recursive' ? occurrence : 'conditional';
      const positive = condition ? combineActivation(activation, condition) : undefined;
      walk(value.ifBlock, nestedOccurrence, new WeakSet<object>(), positive);
      if (value.elseBlock) {
        const negative = condition ? combineActivation(activation, {
          kind: 'unary', operator: '!', resultType: 'bool', operand: condition,
        }) : undefined;
        walk(value.elseBlock, nestedOccurrence, new WeakSet<object>(), negative);
      }
      return;
    }
    if (value instanceof SwitchNode) {
      const nestedOccurrence = occurrence === 'loop' || occurrence === 'recursive' ? occurrence : 'conditional';
      const discriminant = childDeploymentValueRecipe(value.expression, inputIndex, true, inputTypes);
      let defaultActivation = activation;
      for (const arm of value.cases) {
        const armValue = childDeploymentValueRecipe(arm.value, inputIndex, true, inputTypes);
        const matches: ChildDeploymentSiteAbi['activation'] = discriminant && armValue ? {
          kind: 'binary', operator: '==', resultType: 'bool', left: discriminant, right: armValue,
        } : undefined;
        // The generated switch is a cascading IF/ELSE chain. Include every prior miss in this arm's activation
        // so even repeated/equivalent case expressions cannot authorize a later site when an earlier case won.
        walk(arm.body, nestedOccurrence, new WeakSet<object>(),
          matches ? combineActivation(defaultActivation, matches) : undefined);
        const misses: ChildDeploymentSiteAbi['activation'] = discriminant && armValue ? {
          kind: 'binary', operator: '!=', resultType: 'bool', left: discriminant, right: armValue,
        } : undefined;
        defaultActivation = misses ? combineActivation(defaultActivation, misses) : undefined;
      }
      if (value.defaultCase) {
        walk(value.defaultCase, nestedOccurrence, new WeakSet<object>(), defaultActivation);
      }
      return;
    }
    if (value instanceof TryCatchNode) {
      // Catch clauses are unreachable on BCH: a failed foreign operation aborts script evaluation. Both the
      // operation and its success body therefore retain their enclosing successful-path occurrence.
      walk(value.expression, occurrence, new WeakSet<object>(), activation);
      walk(value.tryBlock, occurrence, new WeakSet<object>(), activation);
      return;
    }

    // Source `for` loops are represented by WhileNode with a non-zero forLoopUpdateCount.
    const nestedOccurrence = value instanceof WhileNode || value instanceof DoWhileNode
      ? 'loop'
      : value instanceof BranchNode || value instanceof SwitchNode || value instanceof TryCatchNode
        ? occurrence === 'loop' || occurrence === 'recursive' ? occurrence : 'conditional'
        : occurrence;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'referencedContract' || key === 'resolvedFunction' || key === 'definition'
        || key === 'symbolTable') continue;
      walk(child, nestedOccurrence, seen, activation);
    }

    if (value instanceof FunctionCallNode && value.resolvedFunction
      && !value.resolvedFunction.isEntryPoint) {
      const target = value.resolvedFunction;
      const cycleAt = active.findIndex((frame) => frame.fn === target);
      if (cycleAt >= 0) {
        // This preparatory metadata must not turn a recursive deployment into a finite row claim.
        for (let index = active[cycleAt].siteStart; index < sites.length; index++) {
          sites[index].occurrence = 'recursive';
        }
        return;
      }
      active.push({ fn: target, siteStart: sites.length });
      // A helper called twice represents two physical sites, so each expansion receives a fresh seen-set.
      walk(target.body, nestedOccurrence, new WeakSet<object>(), activation);
      active.pop();
    }
  };

  walk(root.body, 'once', new WeakSet<object>());
  return sites;
}

/**
 * Whether a body of the contract calls another of the contract's functions by name. A call to itself is the
 * recursion lowering's, and `this.f()` is a message call, whose callee does not keep the caller's sender.
 */
const callsOwnFunction = (contract: ContractNode): boolean => {
  const names = new Set(contract.functions.map((fn) => fn.name));
  let found = false;
  let caller = '';
  const visited = new WeakSet<Node>();
  const walk = (node: Node): void => {
    if (found || visited.has(node)) return;
    visited.add(node);
    if (node instanceof FunctionCallNode && !node.fromThisCall && names.has(node.identifier.name)
      && node.identifier.name !== caller) {
      found = true;
      return;
    }
    for (const [field, value] of Object.entries(node)) {
      if (['location', 'resolvedFunction', 'functionReference', 'definition', 'collection', 'symbolTable',
        'stateVariable', 'type'].includes(field)) continue;
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node) walk(item);
      }
    }
  };
  for (const fn of [contract.constructorDef, ...contract.functions, contract.fallbackDef, contract.receiveDef]) {
    if (fn?.body === undefined) continue;
    caller = fn.name;
    walk(fn.body);
  }
  return found;
};

// Compile a parsed+resolved AST (whose `contract` is the chosen primary) into a single Artifact. Shared by
// compileString and compileStringMulti.
function compileResolvedAst(
  ast: Ast, code: string, mergedCompilerOptions: CompilerOptions, omitConstructor = false,
  fnPtrArraysPreLowered = false,
  out?: { delegateFunctionsMarked: number },
): Artifact {
  const resolvedStarted = Date.now();
  let phaseStarted = resolvedStarted;
  let currentPhase = 'start';
  const contractName = ast.contract?.name;
  // B7.3: the deployer program is a second compile of C's source. Take the pristine tree before any pass mutates it.
  const isDeployerProgram = (mergedCompilerOptions as InternalCompilerOptions).__deployerProgram !== undefined;
  const deployerSourceAst = mergedCompilerOptions.deployer === true && !isDeployerProgram
    ? cloneAst(ast, 'deployer-source') : undefined;
  // The inline-assembly blocks each body reaches are read from the program as it arrived. A later pass rewrites
  // the blocks the lowering supports, so the reachability a framed body is refused by is taken here and matched
  // against what the lowering left in place further down.
  const framedBodyAssembly = mergedCompilerOptions.composition === 'framed'
    ? captureBodyAssemblyBlocks(ast.contract, ast.freeFunctions)
    : undefined;
  const mark = (phase: string): void => {
    profileLog(`resolved:${phase}`, phaseStarted, { contract: contractName });
    currentPhase = phase;
    phaseStarted = Date.now();
  };
  const throwProfile = (error: unknown): never => {
    profileLog('resolved:throw', resolvedStarted, {
      contract: contractName,
      after: currentPhase,
      message: error instanceof Error ? error.message.split('\n')[0].slice(0, 240) : String(error).slice(0, 240),
    });
    throw error;
  };
  // Capture this relation on the parsed source tree. Later reference and memory lowerings replace an array write
  // with shared-buffer operations, but retain the external call node itself through the pipeline.
  for (const fn of ast.contract.functions) {
    const seen = new Set<object>();
    const visit = (value: unknown): void => {
      if (!(value instanceof Node) || seen.has(value)) return;
      seen.add(value);
      if (value instanceof ExternalFunctionCallNode || value instanceof MethodCallNode) {
        value.resultArrayOutput = resultArrayOutputOf(fn.body, value);
      }
      for (const [key, child] of Object.entries(value)) {
        if (['location', 'definition', 'resolvedFunction', 'functionReference', 'symbolTable',
          'referencedContract', 'stateVariable', 'collection'].includes(key)) continue;
        if (child instanceof Node) visit(child);
        else if (Array.isArray(child)) child.forEach(visit);
      }
    };
    visit(fn.body);
  }
  // A library file compiled directly: if its primary library has explicitly public/external functions, lower
  // it to a stateless contract artifact (docs/library-contracts.md Phase 2). A library with only inline
  // (internal/unmarked) functions has no entry point and cannot be compiled standalone.
  if (ast.isLibrary) {
    if (!ast.libraryContract) {
      // A standalone interface, a file-level enum/struct, or an inline-only library has no executable contract;
      // emit a minimal ABI-only declaration artifact (like solc: ABI + empty bytecode) instead of erroring.
      // The file's free functions are still semantically validated below, so give them the return desugarings the
      // executable path applies: an unmodified `b = expr;` on a named return reads a symbol this branch would
      // otherwise never declare. Run before validation, exactly as the executable lane does.
      ast = ast.accept(new NamedReturnTransformation()) as Ast;
      // Inline-only library functions still require source-level parameter/return location validation before
      // this early declaration-artifact return.
      ast = ast.accept(new ValidateDataLocations(
        mergedCompilerOptions.evmCompat ?? false, mergedCompilerOptions.rootFileId,
      )) as Ast;
      // Interfaces/declaration-only files still require semantic validation (X184). A generic-storage library,
      // however, has already representation-lowered its storage pointer names for later import/inlining; running
      // the ordinary contract symbol pass here mistakes those placeholders for unresolved source identifiers.
      if (!ast.libraryName || !ast.declaredLibraryNames.includes(ast.libraryName)) {
        ast = ast.accept(new SymbolTableTraversal(mergedCompilerOptions)) as Ast;
        ast = ast.accept(new TypeCheckTraversal(
          true, mergedCompilerOptions.evmCompat ?? false, mergedCompilerOptions.rootFileId,
          mergedCompilerOptions.composition === 'framed',
        )) as Ast;
      }
      // Emit a minimal ABI-only declaration artifact (like solc: ABI + empty bytecode) instead of erroring.
      return generateDeclarationArtifact(ast, code, mergedCompilerOptions);
    }
    ast.contract = ast.libraryContract;
    ast.isLibrary = false;
    const prefix = `${ast.libraryName}.`;
    // Public/external library functions were promoted into `libraryContract`; remove only those duplicates.
    // Private/internal helpers remain inline free functions because promoted entry points may still reach them
    // directly or through a library-scoped `using {L.helper} for T` binding.
    const promoted = new Set(ast.contract.functions
      .filter((f) => f.modifiers.includes(FunctionModifier.PUBLIC)
        || f.modifiers.includes(FunctionModifier.EXTERNAL))
      .map((f) => `${prefix}${f.name}`));
    ast.freeFunctions = ast.freeFunctions.filter((f) => !promoted.has(f.name));

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

  validateAbstractContractInstantiations(ast);
  validateLibrarySelfExternalCalls(ast);
  validateKnownUserTypes(ast);
  validateInheritedPrivateFunctionAccess(ast);
  if (mergedCompilerOptions.evmCompat) {
    validateFunctionNamespaceShadows(ast);
  }

  // Desugar `using L for T` method calls in each contract's OWN lexical scope BEFORE inheritance/modifier expansion
  // inline+substitute parent constructors/modifiers. A parent ctor's `name.toShortStringWithFallback(fb)` becomes
  // `ShortStrings.toShortStringWithFallback(name, fb)` (a real arg node) while `name` is still the parent's param, so
  // the constructor-arg substitution can then rewrite it - it cannot reach a receiver embedded in a call identifier.
  if (!(rootSourceCoversProgram(ast) && !code.includes('using '))) {
    ast = ast.accept(new RedesugarImportedUsingForCalls(true)) as Ast;
  }

  // Inheritance expansion (after import resolution, before modifier expansion)
  // Split facets arrive here after the logical contract has already been flattened. Keep this idempotent even
  // when an earlier library-selection step replaced `ast.contract`: source override lists name bases which no
  // longer exist on the synthetic facet and have already served their validation purpose.
  if (ast.contract.isSplitFacet) {
    ast.contract.implements = [];
    ast.contract.parentInvocations = [];
    for (const fn of ast.contract.functions) {
      fn.overrideBases = [];
      fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.OVERRIDE);
    }
  }
  const hasRootOverride = ast.contract.functions.some((fn) => fn.modifiers.includes(FunctionModifier.OVERRIDE))
    || ast.contract.modifierDefinitions.some((modifier) => modifier.isOverride)
    || [ast.contract.fallbackDef, ast.contract.receiveDef].some((fn) =>
      fn?.modifiers.includes(FunctionModifier.OVERRIDE));
  if (ast.contract.parentInvocations.length > 0 || ast.contract.implements.length > 0
    || ast.importedContracts.some((contract) => contract.implements.length > 0)
    || (mergedCompilerOptions.evmCompat && hasRootOverride)) {
    ast = expandInheritance(ast, mergedCompilerOptions.evmCompat ?? false);
  }
  detectMappingArrayPagination(ast.contract);
  assertStorageWithinEvmSlots(ast.contract);

  // OpenZeppelin upgradeable bases reserve future EVM storage slots with private fixed arrays named `__gap`.
  // They carry no runtime value and are never read; materializing them in CashToken commitments can consume
  // kilobytes (e.g. uint256[50]) while providing none of their EVM layout benefit. In Solidity-compat mode,
  // preserve their intended meaning by omitting the reservation from BCH state altogether.
  if (mergedCompilerOptions.evmCompat) {
    ast.contract.stateVariables = ast.contract.stateVariables.filter((variable) => variable.name !== '__gap');
  }

  // Validate source-level location and modifier rules before storage/memory pointer lowerings erase the
  // declarations that carry them. This mirrors solc's declaration type checking and keeps lowerings simpler.
  ast = ast.accept(new ValidateDataLocations(
    mergedCompilerOptions.evmCompat ?? false, mergedCompilerOptions.rootFileId,
  )) as Ast;
  ast = ast.accept(new OptimizeFixedArrayValues()) as Ast;

  // Every mapping uses the authenticated vmap backend. There is no omission-prone legacy mapping fallback.
  for (const col of ast.contract.collections) col.sorted = true;

  // A standalone abstract contract has no deployable bytecode; emit an ABI-only declaration artifact (solc
  // parity - abstract contracts have an ABI + empty bytecode), like interface / decl-only files.
  if (ast.contract.isAbstract) {
    // Declaration artifacts still undergo source-level modifier validation. Expansion/code generation are
    // unnecessary, but an implemented modifier without `_` remains invalid Solidity.
    validateModifierDefinitions(ast);
    return generateDeclarationArtifact(ast, code, mergedCompilerOptions);
  }

  // A foreign fn-ptr ARRAY (dispatch table) with a fixed method -> a plain `address[]` state var + the shipped
  // array-element co-spend `IFace(fns[i]).m()`. Runs FIRST so the moved array is a native `address[]` to every
  // later pass (the fn-ptr array parses as a COLLECTION; a plain address array is a dynamic-array STATE VAR).
  // X169: the split path already ran this on the COMPLETE function set (`prepareSplitAst`). Re-running it on a
  // shard's filtered set would re-decide a table this pass declined there, and the decision appends state
  // variables - see `assertSplitLayoutsAgree`.
  // A per-entry shard already ran this pass on the complete function set (`prepareSplitAst`). Re-running it on
  // the filtered closure would append different state and break `assertSplitLayoutsAgree`.
  const functionSplitPrepared = (mergedCompilerOptions as InternalCompilerOptions).__functionSplitPrepared === true;
  if (!fnPtrArraysPreLowered && !functionSplitPrepared && !ast.contract.isSplitFacet
    && !(rootSourceCoversProgram(ast) && !code.includes('function(') && !code.includes('function ('))) {
    ast = ast.accept(new LowerForeignFunctionPointerArrayElements()) as Ast;
  }

  // Fold keccak256/sha256 of a string/hex literal to a compile-time bytes32 constant (role ids, EIP-712
  // domains, EVM storage slots). Both fold to their REAL hash (keccak256 -> real keccak, Ethereum-identical).
  if (!(rootSourceCoversProgram(ast) && !code.includes('keccak256') && !code.includes('sha256'))) {
    ast = ast.accept(new FoldHashLiterals()) as Ast;
  }

  // A NON-literal `abi.encodeWithSignature(sig, args)` hashes a runtime string in Solidity. Under evmCompat lower
  // it to `abi.encodeWithSelector(bytes4(keccak256(bytes(sig))), args)` so the keccak256 side-car supplies the
  // selector; the literal form was folded by the symbol pass, and native keeps its OP_SHA256 codegen path.
  if (mergedCompilerOptions.evmCompat
    && !(rootSourceCoversProgram(ast) && !code.includes('encodeWithSignature'))) {
    ast = ast.accept(new LowerRuntimeSignatureSelectors()) as Ast;
  }

  // Solidity public state-var/mapping auto-getters -> real entry-point functions, so a ported callee invoked
  // via a getter (`timeLock.lockTime(addr)`) actually dispatches it. Gated on evmCompat.
  if (mergedCompilerOptions.evmCompat) {
    ast = ast.accept(new SynthesizePublicGetters(true)) as Ast;
  }

  // Solidity has no `delegate` lifecycle keyword. An OZ-style upgradeable implementation identifies itself via
  // an `initializer`/`reinitializer` modifier; every externally callable implementation function (including the
  // synthesized public-state getters above) is intended to execute in the proxy's state context. Mark that surface
  // before modifier expansion consumes the custom-modifier metadata. Native SolidCash sources remain explicit.
  // The direct convention expresses that context by handing the entry the co-spent proxy master's input index as
  // `__internal__proxyMasterIndex`. A framed master reads its frames' blocks instead, and a DELEGATE frame is a
  // frame kind the head establishes rather than a property of a body, so the marking and its operand do not apply
  // to this convention.
  if (mergedCompilerOptions.evmCompat && mergedCompilerOptions.composition !== 'framed'
    && ast.contract.functions.some((fn) => fn.customModifiers.some(
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

  // Delegate entries address the co-spent proxy block. Outlined internal helpers address the implementation
  // input instead, so `onlyOwner` / `_checkInitializing` read the wrong NFT. Force those helpers into the
  // delegate entry whether the variant came from `autoDelegate` or Solidity initializer inference.
  const inlineDelegateStateHelpers = (mergedCompilerOptions.autoDelegate ?? false)
    || ast.contract.functions.some((fn) => fn.modifiers.includes(FunctionModifier.DELEGATE));
  // The SDK signs over an entry point's body, so a helper's transaction-signature check is inlined into it.
  const signatureChecksInlined = true;
  // Auto-delegate compilation is an explicit whole-artifact owner context even before every function is marked.
  const oracleDelegateExecutionContext = mergedCompilerOptions.autoDelegate === true;

  // Modifier expansion (before semantic analysis)
  const hasCustomModifiers = ast.contract.modifierDefinitions.length > 0
    || ast.libraryModifierDefinitions.length > 0
    || ast.contract.functions.some((fn) => fn.customModifiers.length > 0)
    || (ast.contract.constructorDef?.customModifiers.length ?? 0) > 0
    || (ast.contract.fallbackDef?.customModifiers.length ?? 0) > 0
    || (ast.contract.receiveDef?.customModifiers.length ?? 0) > 0
    || ast.freeFunctions.some((fn) => fn.customModifiers.length > 0);
  if (hasCustomModifiers) ast = expandModifiers(ast);
  if (!(rootSourceCoversProgram(ast) && !code.includes('selfdestruct'))) {
    validateExpandedSelfdestructs(ast.contract);
  }

  // Lower `transient` state vars to per-function locals after modifier expansion. A transient reference in a
  // modifier argument/body is now visible in the concrete function body, and public getters synthesized above
  // receive the same zero-initialized transaction-local binding as ordinary functions.
  if (!(rootSourceCoversProgram(ast) && !code.includes('transient'))) {
    ast = lowerTransientStateVars(ast);
  }

  // A4.4/B7.3: in the deployer program, a constructor that reaches a collection keeps journals. Inline the helpers it
  // reaches into it first, then rewrite every collection access of the constructor
  // into journal code, before any pass that reasons about collections can act on it.
  if (isDeployerProgram && constructorReachesCollections(ast)) {
    checkConstructorCollectionShapes(ast);
    ast = ast.accept(new InlineStoragePointerCalls(
      mergedCompilerOptions.evmCompat ?? false, inlineDelegateStateHelpers,
      mergedCompilerOptions.composition === 'framed', signatureChecksInlined,
    )) as Ast;
    ast = ast.accept(new InlineReturningStateHelpers(
      mergedCompilerOptions.evmCompat ?? false, mergedCompilerOptions.composition === 'framed', signatureChecksInlined,
    )) as Ast;
    ast = ast.accept(new InlineStoragePointerCalls(
      mergedCompilerOptions.evmCompat ?? false, inlineDelegateStateHelpers,
      mergedCompilerOptions.composition === 'framed', signatureChecksInlined,
    )) as Ast;
    rewriteConstructorJournals(ast);
  }

  // OZ StorageSlot / ERC-7201 idiom: `XSlot storage d = StorageSlot.getXSlot(SLOT); d.value = v` (PARAM factory)
  // and `S storage $ = _getXStorage(); $.f = v` (ERC-7201 CONST factory) -> the __evm_storage register / promoted
  // packed state. Consumes the slot-pointer factory's assembly before it reaches LowerInlineAssembly. Runs AFTER
  // expandModifiers so factory uses inside OZ initializer/reinitializer modifiers (now inlined into fn bodies) are
  // rewritten too (else the factory method is dropped with a dangling call left in the modifier body).
  if (!(rootSourceCoversProgram(ast) && !code.includes('assembly'))) {
    ast = ast.accept(new LowerStorageSlotPointers()) as Ast;
  }

  // A framed body lowers tail recursion this early as well, before helper inlining; the late pass below is
  // idempotent.
  if (mergedCompilerOptions.composition === 'framed') {
    ast = ast.accept(new LowerTailRecursion(false)) as Ast;
    // Reduce the straight-line pure helpers a child deployment's values call to their expressions.
    const deploymentHelperFolder = new SymbolTableTraversal(mergedCompilerOptions);
    const deploymentHelperFunctions = ast.contract.functions;
    for (const fn of deploymentHelperFunctions) {
      walkInvocationAst(fn.body, (node) => {
        if (node instanceof InstantiationNode) {
          deploymentHelperFolder.inlineChildDeploymentHelpers(node, deploymentHelperFunctions);
        }
      });
    }
  }
  // Capture logical source effects before later lowering rearranges physical journal settlement around them.
  for (const fn of [...ast.contract.functions, ...ast.freeFunctions]) {
    assignFunctionSourceEffectOrdinals(fn);
  }
  // Dynamic-state syntax is still present here. Preserve its physical input-base requirement by stable source
  // identity before collection/dynamic journal lowering value-threads those accesses through ordinary locals.
  const dynamicChunkWriteFunctionKeys = new Set<string>();
  const dynamicChunkInputBaseFunctionKeys = markDynamicChunkInputBaseFunctions(
    ast, new Set(), dynamicChunkWriteFunctionKeys,
  );

  // Redo the using-for method desugar for calls whose receiver is an IMPORTED struct (unknown at parse time, so
  // the AstBuilder left `x.method()` raw): `x.method(args)` -> `L.method(x, args)`. After modifier expansion (so
  // inlined modifier bodies are covered) and reresolveImportedStructTypes (types resolved), before the inline
  // passes (a `T storage`-taking library method is inlined-and-dropped there).
  if (!(rootSourceCoversProgram(ast) && !code.includes('using '))) {
    ast = ast.accept(new RedesugarImportedUsingForCalls()) as Ast;
  }

  // A field write on a LOCAL/PARAM struct var whose struct type was IMPORTED (`escrow.split[j]=v`, `escrow.claimed=v`
  // on `Escrow memory escrow`) was mis-built at parse - the type was unknown, so the AstBuilder emitted a mapping-field
  // assign (array field) or a field-dropping StateAssign (scalar field). Rewrite both into the read-modify-rebuild
  // block the AstBuilder emits for a same-file struct local. Before LowerMemoryModel (which lowers the rebuild).
  if (!(rootSourceCoversProgram(ast) && !code.includes('struct '))) {
    ast = ast.accept(new RedesugarImportedStructFieldWrites()) as Ast;
  }

  // `T.wrap(x)` / `T.unwrap(x)` on an IMPORTED user-defined value type (unknown at parse, so the AstBuilder left it
  // a dangling `T.wrap` FunctionCall) -> the identity cast the AstBuilder emits for a same-file UDVT. PRB-math's
  // UD2x18/UD60x18 converters + constants reach this transitively via Sablier.
  if (!(rootSourceCoversProgram(ast) && !code.includes('.wrap') && !code.includes('.unwrap'))) {
    ast = ast.accept(new RedesugarImportedUdvtWrap()) as Ast;
  }

  // Preserve straight-line foreign function-pointer ternaries before control-flow normalization splits
  // their initialized declaration into a declaration plus branch assignments. The later invocation remains
  // for aliases introduced by the intervening contract-member/function-pointer passes.
  const {
    hasFunctionPointers, functionTypeOutsideDeclarations, needsBlockOracle, needsMsgDataContext, needsMsgSigContext,
    needsSpecialMethodPruning, needsDynamicStateJournal, needsCollectionJournal,
    needsExternalCallLowering, needsInlineAssembly,
    needsTailRecursion, needsReturnInLoop, needsNamedReturns, needsReturnDesugaring, needsNestedBranchReturn,
    needsPostfixIncDec, needsMappingFieldCoalesce, needsLoop, needsBreakContinue,
    needsEarlyReturn, needsVMapCounter, needsRuntimeLoopTransferCounter, needsRuntimeLoopEventCounter,
    needsAlphaRename, statefulnessSurveyComplete, hasContractInstantiation, deploysWithValue, emitsEvent,
  } = surveyOptionalLowerings(ast);
  // The survey above answers for the whole unit, which for a multi-artifact compile is every sibling contract as
  // well. A statefulness question is about one contract's own declarations and bodies, so under the framed
  // convention — where each contract becomes one master program — the hint is taken from the contract being
  // compiled rather than from its siblings beside it.
  const statefulnessHintSource = mergedCompilerOptions.composition === 'framed'
    ? surveyOptionalLowerings(ast.contract)
    : { hasContractInstantiation, deploysWithValue, emitsEvent };
  const contractStatefulnessHint = statefulnessSurveyComplete && ast.freeFunctions.length === 0
    ? statefulnessHintSource
    : undefined;
  if (hasFunctionPointers) ast = ast.accept(new DesugarExternalFunctionPointers()) as Ast;

  // Desugar `return` inside a loop -> flag + break + post-loop return (before break/continue expansion so the
  // injected breaks are lowered; internal functions can't raw-return from inside a loop's balanced stack).
  if (needsTailRecursion) {
    ast = ast.accept(new LowerTailRecursion(mergedCompilerOptions.composition !== 'framed')) as Ast;
  }
  if (needsReturnInLoop) ast = ast.accept(new DesugarReturnInLoop()) as Ast;

  // Unroll a FIXED-BOUND for-loop that writes a mapping into N static writes (which the per-slot machinery already
  // handles - a mapping write in a RUNTIME loop is rejected by EntryWriteInLoopError). Before break/continue
  // expansion (so raw break/continue still gate it out) + SymbolTableTraversal (so the static writes get slots).
  // A fixed loop that pays, sends or emits unrolls too: the counter-loop lowering below admits no literal-bound
  // `for`, journals no send and refuses an effect in a nested loop, while a rolled loop's effect has one output
  // register for every turn. A framed body binds a looped effect where it makes it.
  const unrollLoopEffects = mergedCompilerOptions.composition !== 'framed';
  if (needsLoop) ast = ast.accept(new UnrollFixedBoundEntryLoop(unrollLoopEffects)) as Ast;

  // Keep direct compilation's narrow permutation ABI stable unless a looped payment or emit needs the richer
  // lowering, which pins each iteration's effect. A framed body binds a looped effect where it makes it instead
  // (framed/master/loop-effects.ts).
  const needsRuntimeLoopCounter = needsRuntimeLoopTransferCounter
    || (needsRuntimeLoopEventCounter && mergedCompilerOptions.composition !== 'framed');
  if (needsVMapCounter && needsLoop && !needsRuntimeLoopCounter) {
    ast = ast.accept(new LowerLegacyVMapCounterLoops()) as Ast;
  } else if ((needsVMapCounter || needsRuntimeLoopCounter) && needsLoop
    && mergedCompilerOptions.composition !== 'framed') {
    ast = ast.accept(new LowerVMapCounterLoops()) as Ast;
  }

  // Break/continue expansion (before semantic analysis)
  // DesugarReturnInLoop and LowerTailRecursion can introduce synthetic breaks after the survey was taken.
  // Expand those too: an unlowered break in a recursive base case becomes a no-op in codegen, so the
  // recursive tail runs even after the base result was selected.
  if (needsBreakContinue || needsReturnInLoop || needsTailRecursion) {
    ast = expandBreakContinue(ast);
  }

  // Prove legacy checked-math wrapper shapes before named-return desugaring changes their minimal source form.
  if (mergedCompilerOptions.evmCompat) ast = ast.accept(new MarkLegacyCheckedMath()) as Ast;

  // Named-return desugar (before semantic analysis): named returns become default-init locals.
  // The lanes admit this pass differently. The default composition runs it wherever a function has return types
  // or an empty body (needsReturnDesugaring), since the pass also supplies Solidity's fall-through defaults and
  // empty void bodies. Per-call runs it only where a function names its returns and does those two steps alone
  // otherwise (below), so every other function keeps the lowering its pinned codegen has.
  const runsReturnDesugaring = mergedCompilerOptions.composition === 'framed'
    ? needsNamedReturns
    : needsReturnDesugaring;
  if (runsReturnDesugaring) ast = ast.accept(new NamedReturnTransformation()) as Ast;
  // The survey skips that pass when no function names its returns, but the pass is also where an empty void
  // function gets its `require(true)` no-op body. Run that step alone then, so an empty hook or entry point still
  // compiles and every other function keeps the lowering it had.
  else synthesizeEmptyVoidBodies(ast);

  // A return nested under further conditions with fall-through (internal fns) -> flag + gated tail +
  // terminal return (after NamedReturn so implicit tails are explicit; before semantic so locals resolve).
  if (needsNestedBranchReturn) ast = ast.accept(new DesugarNestedBranchReturn()) as Ast;
  // The skipped pass is also where a function with unnamed return types gets its fall-through default return. Add
  // it here, after the nested-return desugar has given its functions their terminal return, and only where the
  // final check would refuse the function, so every function that returns or reverts keeps its lowering.
  if (!runsReturnDesugaring) synthesizeFallThroughDefaultReturns(ast);
  // Any other return the early-return nesting would leave statements after -> flag + gated tail, in every function,
  // fallback, receive and constructor (after every pass above has placed its returns).
  if (needsNestedBranchReturn) ast = confineReturns(ast);

  // Drop unused compatibility-library low-level-call / assembly helpers before journal and memory lowering, which
  // would otherwise spend seconds on them; the late prune remains so a later pass can still root a helper.
  if (ast.freeFunctions.length > 0) ast = ast.accept(new PruneUnreachableFreeFunctions()) as Ast;

  // Solidity permits a nested block local to shadow an outer local/parameter. Target stack slots are named, so
  // alpha-rename the inner binding (and its lexical uses) before later lowerings and symbol analysis.
  if (needsAlphaRename) ast = ast.accept(new AlphaRenameLocalShadows()) as Ast;

  // Postfix `lvalue++`/`lvalue--` used as an expression -> read + a hoisted increment (before semantic analysis).
  if (needsPostfixIncDec) ast = ast.accept(new DesugarPostfixExpressions()) as Ast;

  // Reuse an already-taken entry-read local for the whole-struct write-back of a field-write run, before
  // CoalesceMappingEntryFieldWrites would re-read the entry for the same write-back.
  // `reuseEntryLocalForWriteback: false` is the measurement-only escape hatch the size-regression test uses.
  if (needsMappingFieldCoalesce && mergedCompilerOptions.reuseEntryLocalForWriteback !== false) {
    ast = ast.accept(new ReuseEntryLocalForWriteback()) as Ast;
  }

  // Coalesce consecutive whole-field writes to the same vmap mapping entry (`m[k].a=x; m[k].b=y`) into one entry
  // read + one whole-struct write, replacing N sorted-mapping upserts with one.
  if (needsMappingFieldCoalesce) ast = ast.accept(new CoalesceMappingEntryFieldWrites()) as Ast;

  // Coalesce a run of consecutive element writes to the same fixed-array field of a memory struct local (each
  // desugared to a whole-struct rebuild) into one read + one rebuild. After RedesugarImportedStructFieldWrites (so
  // imported-struct triples exist), before LowerMemoryModel (which lowers the rebuild).
  if (!(rootSourceCoversProgram(ast) && !code.includes('struct '))) {
    ast = ast.accept(new CoalesceStructFieldArrayWrites()) as Ast;
  }

  // Scalar replacement: a struct local used only for field reads becomes one local per field, so it never goes
  // through the pushdata struct encoder/decoder. After the field-write coalescers (a rebuilt local is not a
  // candidate), before LowerMemoryModel. `scalarReplaceStructLocals: false` keeps the old lowering.
  if (code.includes('struct ') && mergedCompilerOptions.scalarReplaceStructLocals !== false) {
    ast = ast.accept(new ScalarReplaceStructLocals()) as Ast;
  }

  // Memory model: lower local `memory` reference types to linear-buffer pointer ops before the value-copy
  // desugars, so nested writes compose in place. The safety gate falls unsupported locals back to value-copy.
  if (!(rootSourceCoversProgram(ast) && !code.includes('memory') && !code.includes('calldata'))) {
    ast = ast.accept(new LowerMemoryModel()) as Ast;
  }

  // Nested local-array element write `b[i][j] = v` -> read-modify-write over single-level ops (before semantic).
  // Fixed arrays spell their bound between the brackets (`S[1]`), but indexed struct-field writes on them are
  // represented by the same pre-semantic MappingFieldAssign node as dynamic arrays. Any bracketed source can
  // therefore require this safe no-op traversal; checking only the empty `[]` spelling skips the fixed case.
  if (!(rootSourceCoversProgram(ast) && !code.includes('['))) {
    ast = ast.accept(new DesugarNestedArrayWrite()) as Ast;
  }

  // Value-copy the local `bytes` element writes (`b[i] = v`) LowerMemoryModel did not convert to a pointer byte-
  // splice, including bytes-field temps introduced by DesugarNestedArrayWrite.
  if (!(rootSourceCoversProgram(ast) && !code.includes('bytes['))) {
    ast = ast.accept(new DesugarLocalBytesElementWrite()) as Ast;
  }

  // A gratuitous internal fn-ptr state-var alias (`ev = eval; ev(x)`) -> the direct call (`eval(x)`), removing the
  // alias var. Sidesteps a higher-order internal-fn-ptr type mismatch; before any fn-ptr lowering.
  if (hasFunctionPointers) ast = ast.accept(new EliminateInternalFnPtrAlias()) as Ast;

  // A contract instance's method as a fn-ptr VALUE (`o.m` / `(new C()).m`) -> the recognised `C(o).m` member
  // form (inline-new hoisted to a named deploy local). Before the fn-ptr passes so the member flows through.
  if (hasFunctionPointers) ast = ast.accept(new DesugarContractMemberFnPtr()) as Ast;

  // A foreign fn-ptr RETURNED from / PASSED through a side-effect-free single-return helper (`make(a){ return
  // IFoo(a).m; }`, `eval(y){ return y(7); }`) -> beta-reduced into its call sites. Before InterproceduralStoreFold
  // so a helper-returned `x(..)` call (`eval(x)` -> `x(7)`) is present for the fold to rewrite.
  if (hasFunctionPointers) ast = ast.accept(new InlineForeignFunctionPointerReturns()) as Ast;

  // Interprocedural deploy fold through a store helper (store_function core): `store(C(o).m); x(..)` rewrites the
  // same-tx `x(..)` to `o.m(..)` so a freshly-deployed child called via a stored fn-ptr folds. Before the split.
  if (hasFunctionPointers) ast = ast.accept(new InterproceduralStoreFold()) as Ast;

  // A foreign fn-ptr PASSED to a DIFFERENT contract over an external call (`IB(b).register(ITarget(t).m, ..)`)
  // -> split the fn-ptr member arg into (address, selector) to match the callee's lowered fn-ptr param.
  if (hasFunctionPointers) ast = ast.accept(new SplitExternalCallFnPtrArgs()) as Ast;

  // Straight-line foreign external function pointer `function() external f = IFoo(addr).method; f(args)` ->
  // `IFoo(addr).method(args)` (the existing external call); before the external-call passes + semantic.
  if (hasFunctionPointers) ast = ast.accept(new DesugarExternalFunctionPointers()) as Ast;

  // A foreign external fn-ptr STATE var holding a fixed method on a runtime address (`function() external x;
  // x = IFoo(a).m; x(v)`) -> an `address` state var + the state-address external call `IFoo(x).m(v)`.
  if (hasFunctionPointers) ast = ast.accept(new LowerForeignFunctionPointerVars()) as Ast;
  // A foreign fn-ptr STRUCT FIELD holding a fixed method (nested analogue of the state-var pass) -> an
  // interface-typed field + the shipped struct-field-chain call `s.field.m()`. Before the address-local synth.
  if (hasFunctionPointers) {
    ast = ast.accept(new LowerForeignFunctionPointerStructFields()) as Ast;
    ast = ast.accept(new LowerForeignFunctionPointerParams()) as Ast;
  }
  // A foreign fn-ptr STATE var holding a RECEIVED value (`x = y`, method carried in the value) -> an `address`
  // field + a `bytes4 __fnsel_x` companion + the state-address external call with a runtime selector. Runs after
  // the PARAM lowering (which splits `y` into address + `__fnsel_y`) that this pass reads the selector from.
  if (hasFunctionPointers) ast = ast.accept(new LowerForeignFunctionPointerStorage()) as Ast;
  // A foreign fn-ptr ARRAY holding RECEIVED values (`fns.push(p)`) -> `address[]` + a parallel `bytes[]`
  // selector array + the per-element on-chain-selector dispatch loop with SDK-filled witness master indices
  // (the array analogue of the storage pass). After the param lowering that splits `p` -> `__fnsel_p`.
  if (hasFunctionPointers) ast = ast.accept(new LowerReceivedFnPtrArray()) as Ast;
  // A RECEIVED-value foreign fn-ptr in a struct field (method carried in the value) -> a bytes BLOB
  // `selector ++ address`; a call slices it into an audited state-address external call. After the fixed-method
  // struct-field pass (only received-value fields remain).
  if (hasFunctionPointers) ast = ast.accept(new LowerBlobFunctionPointers()) as Ast;

  // Lower supported Yul inline assembly to equivalent main-AST statements (value computation + control flow).
  if (needsInlineAssembly) ast = ast.accept(new LowerInlineAssembly()) as Ast;
  // A framed master's CREATE2 child is addressed by its EVM identity and stood up by the builder beforehand, so the
  // creation lowers to that identity here, after the Yul `create2` became `new C{salt}()`. Published so a builder
  // knows which child an address names (`composition.creates`).
  if (mergedCompilerOptions.composition === 'framed') {
    const create2 = new LowerFramedCreate2Address();
    ast = ast.accept(create2) as Ast;
    if (create2.creates.length > 0) (mergedCompilerOptions as InternalCompilerOptions).__framedCreates = create2.creates;
  }

  // Inline void helpers that make external calls into their internal call sites (the external co-spend can't
  // cross an OP_INVOKE boundary); reduces to the entry-point-body external-call case. A call through a function
  // pointer parameter becomes an external call only in the pointer lowering above, after the survey.
  if (needsExternalCallLowering || hasFunctionPointers) ast = ast.accept(new InlineExternalCallHelpers()) as Ast;

  // `address(this).call(payload)` -> a plain internal call (+ constant true success). Before the inline
  // passes so a state-touching callee (incl. the fallback) is inlined into the entry point like any other.
  if (needsExternalCallLowering) ast = ast.accept(new LowerSelfLowLevelCalls()) as Ast;
  // A payload handed to a helper whose own body makes the low-level call (`Address.functionCall`, and the
  // `SafeERC20` chain behind it) names a method only once that helper is inlined into its caller: the payload
  // local the lowering follows is the helper's parameter, which becomes a caller local when the body is spliced
  // in. The helper inliners run later in the ordinary pipeline, so under the framed convention they run once
  // here, before the lowering, and a namable payload across such a helper is served as its typed call.
  // Sampled before the inliner below deletes the helpers it splices in. The later fold decides from this,
  // because the definitions are already gone by the time the ordinary helper survey runs.
  let framedInlinedHelpers = false;
  if (mergedCompilerOptions.composition === 'framed' && needsExternalCallLowering) {
    const framedHasHelpers = ast.freeFunctions.length > 0
      || ast.contract.functions.some((fn) => fn.modifiers.includes(FunctionModifier.INTERNAL)
        || fn.modifiers.includes(FunctionModifier.PRIVATE));
    if (framedHasHelpers) {
      framedInlinedHelpers = true;
      ast = ast.accept(new InlineStoragePointerCalls(
        mergedCompilerOptions.evmCompat ?? false,
        inlineDelegateStateHelpers,
        mergedCompilerOptions.composition === 'framed',
        signatureChecksInlined,
      )) as Ast;
      ast = ast.accept(new InlineReturningStateHelpers(
        mergedCompilerOptions.evmCompat ?? false,
        mergedCompilerOptions.composition === 'framed',
        signatureChecksInlined,
      )) as Ast;
    }
  }
  // A low-level call whose payload names an interface method (`addr.call(abi.encodeCall(I.f, (args)))`, or the
  // selector or signature spelling) denotes the typed call `I(addr).f(args)`, or the target's fallback for a
  // signature none of its methods has. It is rewritten to that call before semantic analysis, so the framed
  // convention - which compiles typed calls but refuses the raw calldata form - serves it as the call its spelling
  // denotes. After LowerSelfLowLevelCalls, so a self-call has already been lowered.
  if (mergedCompilerOptions.composition === 'framed' && needsExternalCallLowering) {
    ast = ast.accept(new LowerStaticLowLevelCalls(mergedCompilerOptions.evmCompat === true)) as Ast;
    // A value-carrying low-level call with no payload (`to.call{value: v}("")`) denotes the send it pays, which the
    // convention pins at a listed output only a P2PKH lock can hold (W2).
    ast = ast.accept(new LowerValueLowLevelCalls()) as Ast;
  }
  // A high-level `this.f(args)` also creates fresh calldata. Reconstruct msg.data from f's selector + live
  // parameters so the direct OP_INVOKE lowering does not depend on OP_ACTIVEBYTECODE inside the subroutine.
  if (needsMsgDataContext) {
    ast = ast.accept(new LowerSelfCallMsgData(mergedCompilerOptions.evmCompat === true)) as Ast;
  }
  // Internal/private msg.data readers receive the originating entry calldata through a compiler-only parameter.
  if (needsMsgDataContext) {
    ast = ast.accept(new LowerInternalMsgDataContext(
      mergedCompilerOptions.composition === 'framed', mergedCompilerOptions.evmCompat === true,
    )) as Ast;
  }
  // msg.sig retains the originating public/external selector across internal/private OP_INVOKE calls.
  if (needsMsgSigContext) {
    ast = ast.accept(new LowerInternalMsgSigContext(
      mergedCompilerOptions.composition === 'framed', mergedCompilerOptions.evmCompat === true,
      true,
    )) as Ast;
  }

  // `(new C()).m(args)` -> `C __newcall_N = new C(); __newcall_N.m(args)`, so the deploy-then-call fold
  // machinery (which tracks named deploy locals) applies to inline deploy receivers too.
  if (hasContractInstantiation) ast = ast.accept(new HoistInlineDeployCalls()) as Ast;

  // `A.getter().m(args)` (getter returns a contract) -> `IReturn __chaincall_N = A.getter(); __chaincall_N.m(..)`,
  // so the chained call on the getter's (integrity-bound) return dispatches via the audited interface-local path.
  if (needsExternalCallLowering) ast = ast.accept(new HoistChainedContractCalls()) as Ast;
  // A public collection getter/update can also be called from another public entry. Inline that call while
  // the callee still has its source arity; journal lowering below appends private witness parameters to its
  // dispatched definition, which an ordinary source call cannot supply.
  if (needsCollectionJournal
    && mergedCompilerOptions.composition !== 'framed') {
    const publicNames = new Set(ast.contract.functions.filter((fn) => fn.isEntryPoint).map((fn) => fn.name));
    const callsPublic = ast.contract.functions.some((fn) => {
      let found = false;
      walkInvocationAst(fn.body, (candidate) => {
        if (candidate instanceof FunctionCallNode && !candidate.fromThisCall
          && publicNames.has(candidate.identifier.name)) found = true;
      });
      return found;
    });
    if (callsPublic) ast = ast.accept(new InlineReturningStateHelpers(
      mergedCompilerOptions.evmCompat ?? false,
    )) as Ast;
  }
  // Lower eligible single-entry mapping helpers to value-threaded OP_INVOKE handlers before the legacy
  // entry-reading inline passes see them.
  if (needsDynamicStateJournal) {
    ast = ast.accept(new LowerDynamicStateJournalHelpers()) as Ast;
  }
  if (needsCollectionJournal) {
    ast = ast.accept(new LowerCollectionJournalHelpers(mergedCompilerOptions.composition === 'framed')) as Ast;
  }

  // Inline value-returning private helpers that read a state entry at their expression call sites (hoist the
  // body, capture the return in a temp). Same block-layout reason as the void case below; run first so a void
  // helper containing such a call is resolved before it is itself inlined.
  const hasInternalHelpers = ast.freeFunctions.length > 0
    || ast.contract.functions.some((fn) => fn.modifiers.includes(FunctionModifier.INTERNAL)
      || fn.modifiers.includes(FunctionModifier.PRIVATE));
  // Public entry points can also be called internally. A state/collection- or call-touching public callee owns
  // compiler-owned witnesses that do not exist as source-level arguments at its call site; inline that body into
  // the caller's physical frame before SymbolTableTraversal adds those parameters. In the direct convention,
  // a void `this.f()` has the same inherited execution context and needs that frame too. Returning self-calls
  // retain their existing invoked-read fence after pending mapping writes. Keep the dispatched definition.
  const publicEntryNames = new Set(ast.contract.functions.filter((fn) => fn.isEntryPoint).map((fn) => fn.name));
  const directVoidSelfCallKeys = new Set(ast.contract.functions
    .filter((fn) => fn.returnTypes.length === 0 && mergedCompilerOptions.composition !== 'framed')
    .map((fn) => `${fn.name}/${fn.parameters.length}`));
  let hasInternallyCalledPublicEntry = false;
  let hasDirectVoidSelfCall = false;
  if (publicEntryNames.size > 0) {
    for (const fn of ast.contract.functions) {
      if (!fn.body) continue;
      const found = { internalCall: false, directVoidSelfCall: false };
      walkInvocationAst(fn.body, (node) => {
        if (!(node instanceof FunctionCallNode) || !publicEntryNames.has(node.identifier.name)) return;
        if (!node.fromThisCall) found.internalCall = true;
        else if (directVoidSelfCallKeys.has(`${node.identifier.name}/${node.parameters.length}`)) {
          found.directVoidSelfCall = true;
        }
      });
      hasDirectVoidSelfCall ||= found.directVoidSelfCall;
      hasInternallyCalledPublicEntry = found.internalCall;
      if (hasInternallyCalledPublicEntry) break;
    }
  }
  // An entry another body calls by name is inlined there too (callsOwnFunction, which leaves a self-call to the
  // recursion lowering). The public-entry survey above is the default composition's.
  const inlinesOwnCalls = hasInternalHelpers || callsOwnFunction(ast.contract)
    || (mergedCompilerOptions.composition !== 'framed' && hasInternallyCalledPublicEntry);
  if (inlinesOwnCalls) {
    ast = ast.accept(new InlineReturningStateHelpers(
      mergedCompilerOptions.evmCompat ?? false,
      mergedCompilerOptions.composition === 'framed',
      signatureChecksInlined,
    )) as Ast;
  }

  // Inline void calls to functions taking `storage` reference params; a storage pointer has no value
  // representation, so the callee is substituted into the caller as direct state access.
  // The IRSH above can still expose scalar state inside a previously context-only void wrapper (`_checkInitializing` after
  // `_isInitializing()` is reduced). Without a follow-up inline, that wrapper stays an OP_INVOKE
  // body and a delegate `initialize` re-reads the pre-tx NFT (or INPUTINDEX+1 on the impl).
  // This pass originally handled only explicit `storage` parameters, so the source-text fast path below used
  // to skip it when that word was absent. It now also keeps scalar helpers with transaction effects (typed/
  // low-level calls, deploys, events and transfers) in the physical entry frame. Those shapes need no `storage`
  // token in source, and skipping the pass leaves the effect behind OP_INVOKE without a block layout. Run it
  // whenever an internal helper exists; the traversal's own eligibility checks retain the cheap no-op path.
  // An entry another body calls by name is inlined there too: a mapping write's batch witnesses are the entry's own
  // parameters, which that call does not pass.
  if ((inlinesOwnCalls || hasDirectVoidSelfCall)) {
    ast = ast.accept(new InlineStoragePointerCalls(
      mergedCompilerOptions.evmCompat ?? false,
      inlineDelegateStateHelpers,
      mergedCompilerOptions.composition === 'framed',
      signatureChecksInlined,
    )) as Ast;
  }
  // Physical-slot discovery must see only reachable writes in a helper expanded with a literal argument (for
  // example a generic mint/burn helper called with a zero endpoint). Keep this before SymbolTableTraversal,
  // which allocates entry/data slots from the body it receives. A framed entry keeps the literal-decided arms:
  // it publishes the skipped write's access and condition so the frame can declare the record that write keeps.
  if (hasInternalHelpers || hasInternallyCalledPublicEntry) {
    ast = ast.accept(new PruneInlinedConstantBranches(
      mergedCompilerOptions.composition !== 'framed',
    )) as Ast;
  }
  // A function returning a REASSIGNED `mapping storage` pointer (`returns (mapping storage r){ r=a; r=b; }`) is
  // resolved by straight-line dataflow into its side effects + the mapping it finally aliases, and inlined at call
  // sites - producing bare `mapping storage m = <mapping>` aliases the next pass handles.
  if (needsCollectionJournal) ast = ast.accept(new InlineMappingReturnFunctions()) as Ast;
  // A `mapping(..) storage m = get()` local (get() inlined above to a bare mapping or `c ? a : b`) has no runtime
  // value; rewrite each `m[k]` use to the underlying mapping (or a branch/ternary) and drop the declaration.
  if (needsCollectionJournal) ast = ast.accept(new LowerMappingStorageAlias()) as Ast;

  // A boolean literal substituted for a bool param at an inline site (`_refund(jobId, false)`) leaves an arm of the
  // branch on it that never runs; drop it, so a write in that arm never reaches the entry's write analysis. Per-call
  // entries keep the arms only literals decide; a framed constructor folds them too, as its genesis refuses a read
  // after a branch arm's write to an entry the read may name (`_mint` inlines `_update(address(0), to, v)`).
  if (hasInternalHelpers || framedInlinedHelpers) {
    ast = ast.accept(new FoldConstantBoolBranches(
      mergedCompilerOptions.composition === 'framed' ? 'constructor' : true,
    )) as Ast;
  }

  // Re-run the fixed-bound unroll AFTER inlining: a `new T[](N)` literal substituted for an array param at an
  // inline site (`_updateAllowlist(id, allowed, new address[](0))`) now makes the loop bound compile-time
  // constant. N==0 unrolls to zero iterations, eliminating the provably-dead loop before its body (e.g. a vmap
  // sorted-mapping write over the empty array) reaches the entry-slot pre-scan / codegen. The first pass (before
  // inlining) can't see the literal, and everything it could unroll it already did, so this pass only fires on
  // these post-inline new-array-bound loops, and on a fixed loop whose effect an inlined helper made.
  if (needsLoop) ast = ast.accept(new UnrollFixedBoundEntryLoop(unrollLoopEffects)) as Ast;

  // A whole dynamic-array copy with a differing element type (`bytes10[] = bytes8[]`) desugars to a delete +
  // per-element casting push loop; must precede CacheDynamicArrayInLoop so the emitted push-in-loop is cached.
  const shouldDesugarDynamicArrayCopy = needsLoop || !(rootSourceCoversProgram(ast) && !code.includes('[]'));
  const dynamicArrayCopyDesugar = new DesugarDynamicArrayCopyCast();
  if (shouldDesugarDynamicArrayCopy) ast = ast.accept(dynamicArrayCopyDesugar) as Ast;
  ast = ast.accept(new CoalesceStateArrayStructFieldWrites()) as Ast;
  // A dynamic (chunk-backed) array written inside a loop can't use the once-per-function pending-value write
  // model; cache it in a local, mutate the local in the loop, flush back once. The copy-cast pass immediately
  // above can synthesize such a loop from loop-free source, so the pass also runs when that one made a loop.
  if (needsLoop || dynamicArrayCopyDesugar.didSynthesizeLoop) {
    ast = ast.accept(new CacheDynamicArrayInLoop()) as Ast;
  }
  // A vmap (sorted) mapping ARRAY value written in a loop `for(..) m[k][j]=v` is cached the same way: read m[k] once,
  // mutate the local array in the runtime loop, flush `m[k] = local` as one upsert (never unroll the loop).
  // Loop-free same-key writes (`m[k]=m[k]+a; m[k]=m[k]+b`) also need the one-upsert cache. A framed body keeps the
  // cache inside the segments its own accesses run in, so the upsert lands where the source writes the entry.
  // A mapping the body composes stays uncached.
  if (needsLoop || needsCollectionJournal) {
    ast = ast.accept(new CacheMappingEntryInLoop(mergedCompilerOptions.composition === 'framed')) as Ast;
  }

  // A conditional `delete m[k]` inside a branch does not delete on the taken path (the covenant can't statically
  // tell it ran). If-convert it to an unconditional predicated write `m[k] = cond ? default : m[k]`.
  if (needsCollectionJournal) ast = ast.accept(new IfConvertConditionalEntryOp(
    mergedCompilerOptions.composition === 'framed', mergedCompilerOptions.composition !== 'framed',
  )) as Ast;

  // Constructor external reads (`token0 = IERC20(pool.token0())`) -> synthesized deploy-input params (BCH has
  // no on-chain constructor; the read is resolved off-chain at deploy). Runs before the target-address synth.
  // B7.3: in the deployer program a constructor's external call is a call slot, not a deploy input.
  if (needsExternalCallLowering && !isDeployerProgram) ast = ast.accept(new PromoteConstructorExternalReads()) as Ast;
  // A branch-local interface-cast external-call target variable -> hoist its DECLARATION to the body top so the
  // co-spend reads it at the epilogue (UniswapV2Pair mint's `migrator`); the external calls stay conditional.
  if (needsExternalCallLowering) ast = ast.accept(new HoistBranchLocalExtcallTargets()) as Ast;
  // Interface-typed state vars used as external-call targets -> synthesized address locals (reuses the
  // local-interface-var dispatch).
  if (needsExternalCallLowering) ast = ast.accept(new SynthesizeExternalAddressLocals()) as Ast;
  // A NON-LOOP param-rooted array-element target `IERC20(path[path.length-1]).m()` -> hoist to a function-top
  // address local so it is a fixed-slot co-spend (not mistaken for a per-iteration loop-array dispatch).
  if (needsExternalCallLowering) ast = ast.accept(new HoistNonLoopArrayElemExtcallTargets()) as Ast;
  // A contract/interface-typed external-call target LOCAL declared in a branch (e.g. a `restricted` modifier's
  // if-wrapper) is popped before the epilogue's co-spend verification -> capture it into a function-top local.
  const branchTargetCapture = needsExternalCallLowering ? new CaptureBranchExternalCallTargets() : undefined;
  if (branchTargetCapture) ast = ast.accept(branchTargetCapture) as Ast;
  // Capturing branch-local targets introduces compiler-owned `__extcap_` aliases after the first address
  // synthesis pass. Re-run the idempotent provenance pass so nested Address/SafeERC20 fallbacks trace those
  // aliases back to the same body-top state/parameter target as their first conditional branch. That re-run
  // exists solely for those aliases, so when the capture above prepended nothing it is a strict no-op.
  if (needsExternalCallLowering && branchTargetCapture?.capturedAny === true) {
    ast = ast.accept(new SynthesizeExternalAddressLocals()) as Ast;
  }
  // `L.f()` calls to a state-touching (delegate) library -> a delegatecall against the caller's state (with a
  // synthesized library-address constructor arg). See docs/library-contracts.md (3b sugar).
  if (ast.freeFunctions.length > 0 || ast.declaredLibraryNames.length > 0) {
    ast = ast.accept(new SynthesizeLibraryDelegateCalls(mergedCompilerOptions.evmCompat === true)) as Ast;
  }
  // Oracle-backed block.* reads stay reads of a pool coin's commitment. No state is injected.
  const blockOracle = new SynthesizeBlockOracle(
    mergedCompilerOptions.evmCompat ?? false,
    oracleDelegateExecutionContext,
  );
  // A split root's forwarder no longer contains the read, but the prepare pass already marked the function.
  // Re-run so that mark is cleared. Yul builtins become block.* reads only after assembly lowering, which the
  // initial survey cannot see, so sources that had assembly are resurveyed.
  const oracleAlreadyMarked = ast.contract.usesBlockOracle
    || ast.contract.functions.some((fn) => fn.usesBlockOracle === true)
    || ast.contract.constructorDef?.usesBlockOracle === true
    || ast.contract.fallbackDef?.usesBlockOracle === true
    || ast.contract.receiveDef?.usesBlockOracle === true;
  if (!isDeployerProgram && (needsBlockOracle || oracleAlreadyMarked
    || (needsInlineAssembly && surveyOptionalLowerings(ast).needsBlockOracle))) {
    ast = ast.accept(blockOracle) as Ast;
  }

  // Drop free/library functions the contract never reaches (OZ libraries ship many unused helpers). Runs last,
  // after every synthesis pass, so no reachable call is missed; conservative by name so nothing live is dropped.
  if (ast.freeFunctions.length > 0) ast = ast.accept(new PruneUnreachableFreeFunctions()) as Ast;

  // Drop dead internal/private methods that read msg.data (e.g. inherited OZ `Context._msgData`, never called):
  // msg.data is only reconstructible at an entry point, so a dead one would fail the whole compile. Conservative
  // by name (every non-internal method is a root), so nothing live is dropped.
  if (needsSpecialMethodPruning) ast = ast.accept(new PruneUnreachableMsgDataMethods()) as Ast;

  // Facets are deployed as branded delegate-only libraries and never execute the logical contract's constructor.
  // Several normalization passes can synthesize or reconstruct a constructor after inheritance flattening, so
  // enforce omission at the semantic boundary rather than relying only on the early facet mutation.
  if (omitConstructor) ast.contract.constructorDef = undefined;

  // Storage-lowering passes can synthesize mappings after the source collections were normalized above
  // (notably assembly sstore/sload and ERC-7201 storage pointers). Keep the backend invariant global: every
  // mapping, including compiler-generated mappings, uses authenticated vmap storage.
  for (const col of ast.contract.collections) col.sorted = true;

  // Internal helper expansion may splice externally calling statements into an entry after the first source
  // effect survey. Their cloned ordinals are local to the helper, so keeping them would falsely place a nested
  // call before its caller's already-numbered producers. Re-number the final physical bodies before the late
  // semantic passes publish callsite metadata.
  if (needsExternalCallLowering || hasInternalHelpers || hasInternallyCalledPublicEntry) {
    for (const fn of [...ast.contract.functions, ...ast.freeFunctions]) {
      assignFunctionSourceEffectOrdinals(fn);
    }
  }
  // Delegate-variant compile: mark the proxy-implementable functions now that the function set is final (after
  // inheritance/modifier/getter expansion) and before SymbolTableTraversal injects _proxyMasterIndex. `delegate`
  // is never written in source; see AutoMarkDelegateFunctions.
  if (mergedCompilerOptions.autoDelegate && out) {
    out.delegateFunctionsMarked = autoMarkDelegateFunctions(ast, mergedCompilerOptions.forceStateful ?? false);
  }

  // Propagate logical msg.sender use through the named internal-call closure before the body-local semantic
  // survey injects entry-point context. Modifier expansion commonly leaves `entry -> _checkOwner -> _msgSender`;
  // surveying only the entry body cannot see the NullaryOp and a delegate build then reaches code generation
  // without either a category witness or an authenticated hidden caller. Name-level closure resolution matches
  // the compiler's existing conservative internal-call analysis and deliberately errs toward carrying context.
  if (!(rootSourceCoversProgram(ast) && !code.includes('msg.sender'))) {
    const byName = new Map<string, FunctionDefinitionNode[]>();
    const directSenderNames = new Set<string>();
    // A library call (`L.f()`, run on the caller's frame as a delegatecall is) reads the caller's msg.sender too.
    const senderScope = [...ast.contract.functions, ...ast.freeFunctions];
    for (const fn of senderScope) {
      const group = byName.get(fn.name) ?? [];
      group.push(fn);
      byName.set(fn.name, group);
      let direct = fn.usesMsgSender === true;
      walkInvocationAst(fn.body, (node) => {
        if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_SENDER) direct = true;
      });
      if (direct) directSenderNames.add(fn.name);
    }
    if (directSenderNames.size > 0) {
      for (const fn of senderScope) {
        if ([...collectNamedFunctionClosure(fn, byName)].some((name) => directSenderNames.has(name))) {
          fn.usesMsgSender = true;
        }
      }
    }
  }

  // A caller of a block.* reader carries the oracle index to forward it.
  if (needsBlockOracle || ast.contract.usesBlockOracle) markBlockOracleCallers(ast.contract, ast.freeFunctions);

  // An entry's msg.data reads the unlocking frame, which can include compiler-hidden witnesses in addition
  // to source-visible arguments. The internal-context lowering above replaces helper reads with a synthetic
  // parameter, so survey both remaining reads and that parameter before publishing the ABI's `usesMsgData`.
  // Propagate through named calls conservatively, as for msg.sender; an SDK must not mistake an indirect
  // reader for a direct method whose calldata is fully described by its visible ABI.
  if (needsMsgDataContext) {
    const byName = new Map<string, FunctionDefinitionNode[]>();
    const directDataNames = new Set<string>();
    for (const fn of ast.contract.functions) {
      const group = byName.get(fn.name) ?? [];
      group.push(fn);
      byName.set(fn.name, group);
      let direct = fn.usesMsgData === true
        || fn.parameters.some((parameter) => parameter.name === '__internal__msgData');
      walkInvocationAst(fn.body, (node) => {
        if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_DATA) direct = true;
      });
      if (direct) directDataNames.add(fn.name);
    }
    if (directDataNames.size > 0) {
      for (const fn of ast.contract.functions) {
        if ([...collectNamedFunctionClosure(fn, byName)].some((name) => directDataNames.has(name))) {
          fn.usesMsgData = true;
        }
      }
    }
  }

  // Reapply the pre-lowering requirement to the final logical functions and compiler-owned OP_INVOKE handlers,
  // while also discovering any dynamic-state dependency synthesized after the first survey.
  markDynamicChunkInputBaseFunctions(ast, dynamicChunkInputBaseFunctionKeys, dynamicChunkWriteFunctionKeys);

  // Recovery compute is funded by the physical entrypoint even when the builtin sits behind imported/library
  // helpers (e.g. ECDSA.recover -> two tryRecover overloads -> ecrecover). Symbol resolution happens in the next
  // pass, so establish this name-level closure now, while imported free/library functions are still available.
  // SymbolTableTraversal's direct-body survey remains authoritative for direct calls and argument metadata.
  if (!(rootSourceCoversProgram(ast) && !code.includes('ecrecover'))) {
    const functions = [...ast.contract.functions, ...ast.freeFunctions];
    const byName = new Map<string, FunctionDefinitionNode[]>();
    for (const fn of functions) (byName.get(fn.name) ?? byName.set(fn.name, []).get(fn.name)!).push(fn);
    if (solidcEnvFlagEnabled('SOLIDC_DEBUG_RECOVERY_PRE')) {
      for (const fn of ast.contract.functions) {
        const calls = [...directCallNames(fn)];
        if (!calls.some((name) => name.toLowerCase().includes('recover'))) continue;
        console.error('recovery-pre-closure', {
          contract: ast.contract.name, function: fn.name, calls,
          closure: [...collectNamedFunctionClosure(fn, byName)],
          knownRecoveryFunctions: [...byName.keys()].filter((name) => name.toLowerCase().includes('recover')),
        });
      }
    }
    type RecoverySummary = { total: number; evm: number; inLoop: boolean; flags: boolean[] };
    const direct = new WeakMap<FunctionDefinitionNode, RecoverySummary>();
    const recoveryName = (name: string): 'plain' | 'evm' | undefined => {
      if (name === GlobalFunction.ECRECOVER_EVM
        || (name === 'ecrecover' && mergedCompilerOptions.ecrecover === 'evm')) return 'evm';
      if (name === GlobalFunction.ECRECOVER_PUBKEY || name === GlobalFunction.ECRECOVER_P2PKH
        || (name === 'ecrecover' && mergedCompilerOptions.ecrecover !== undefined)) return 'plain';
      return undefined;
    };
    const survey = (fn: FunctionDefinitionNode): RecoverySummary => {
      const cached = direct.get(fn);
      if (cached) return cached;
      const result: RecoverySummary = { total: 0, evm: 0, inLoop: false, flags: [] };
      const seen = new Set<Node>();
      const walk = (node: Node, loopDepth: number): void => {
        if (seen.has(node)) return;
        seen.add(node);
        const nextDepth = loopDepth + (node instanceof WhileNode || node instanceof DoWhileNode
          || node instanceof CollectionIterationNode ? 1 : 0);
        if (node instanceof FunctionCallNode) {
          const kind = recoveryName(node.identifier.name);
          if (kind) {
            result.total += 1;
            result.flags.push(kind === 'evm');
            if (kind === 'evm') result.evm += 1;
            if (nextDepth > 0) result.inLoop = true;
          }
        }
        for (const key in node) {
          if (key === 'resolvedFunction' || key === 'functionReference' || key === 'definition'
            || key === 'symbolTable' || key === 'referencedContract' || key === 'stateVariable'
            || key === 'collection') continue;
          const child = node[key as keyof Node];
          if (child instanceof Node) walk(child, nextDepth);
          else if (Array.isArray(child)) for (const item of child) if (item instanceof Node) walk(item, nextDepth);
        }
      };
      if (fn.body) walk(fn.body, 0);
      direct.set(fn, result);
      return result;
    };
    const closureRecovery = new Map<string, RecoverySummary>();
    const summaryForName = (name: string): RecoverySummary => {
      const cached = closureRecovery.get(name);
      if (cached) return cached;
      const result: RecoverySummary = { total: 0, evm: 0, inLoop: false, flags: [] };
      // Seed before walking the closure so recursive components terminate conservatively.
      closureRecovery.set(name, result);
      const roots = byName.get(name) ?? [];
      const reachedNames = new Set<string>();
      for (const root of roots) {
        for (const reached of collectNamedFunctionClosure(root, byName)) reachedNames.add(reached);
      }
      for (const reached of reachedNames) {
        for (const candidate of byName.get(reached) ?? []) {
          const local = survey(candidate);
          result.total += local.total;
          result.evm += local.evm;
          result.inLoop ||= local.inLoop;
          result.flags.push(...local.flags);
        }
      }
      return result;
    };
    const callIntoRecoveryLoop = (fn: FunctionDefinitionNode): boolean => {
      let found = false;
      const seen = new Set<Node>();
      const walk = (node: Node, loopDepth: number): void => {
        if (found || seen.has(node)) return;
        seen.add(node);
        const nextDepth = loopDepth + (node instanceof WhileNode || node instanceof DoWhileNode
          || node instanceof CollectionIterationNode ? 1 : 0);
        if (nextDepth > 0 && node instanceof FunctionCallNode
          && summaryForName(node.identifier.name).total > 0) {
          found = true;
          return;
        }
        for (const key in node) {
          if (key === 'resolvedFunction' || key === 'functionReference' || key === 'definition'
            || key === 'symbolTable' || key === 'referencedContract' || key === 'stateVariable'
            || key === 'collection') continue;
          const child = node[key as keyof Node];
          if (child instanceof Node) walk(child, nextDepth);
          else if (Array.isArray(child)) for (const item of child) if (item instanceof Node) walk(item, nextDepth);
        }
      };
      if (fn.body) walk(fn.body, 0);
      return found;
    };
    for (const fn of ast.contract.functions) {
      const recovery = summaryForName(fn.name);
      if (recovery.total < 1) continue;
      fn.ecrecoverCompute = true;
      fn.ecrecoverCallCount = recovery.total;
      fn.ecrecoverClosureEvmFlags = recovery.flags;
      if (recovery.evm > 0) fn.ecrecoverEvmCallCount = recovery.evm;
      if (recovery.inLoop || callIntoRecoveryLoop(fn)) fn.ecrecoverLoopReads = true;
    }
  }

  // A lowering above can place a statement after a return it leaves in place: a write-back flush after a switch one
  // of whose cases returns, say, which already precedes that return. Lower those returns too, so each path runs the
  // statement once. A function that still returns from a loop is left to EarlyReturnTransformation's refusal.
  ast = confineReturns(ast, true);

  // B8.0: a direct creator's `new` sites need facts about each child (its deployer's DEPLOY(C), w_out, call slots,
  // constructor reads) before the creator's symbol pass. Compile each named child standalone with its deployer here,
  // and let the later referenced-contract pass take its code from this map instead of compiling it again.
  const gatheredDeployers = gatherDeployerChildren(ast, code, mergedCompilerOptions as InternalCompilerOptions);
  if (gatheredDeployers !== undefined) {
    (mergedCompilerOptions as InternalCompilerOptions).__compiledDeployers = gatheredDeployers;
    prepareMarkedCreator(ast, gatheredDeployers, mergedCompilerOptions as InternalCompilerOptions);
  }

  mark('lowering');
  // B7.3: the deployer program is the second compile's shape. Build its two arms once every pass that adds,
  // merges or inlines functions has run, and before the semantic pass assigns selectors and block layouts.
  if ((mergedCompilerOptions as InternalCompilerOptions).__deployerProgram !== undefined) {
    prepareDeployerContract(ast, mergedCompilerOptions as InternalCompilerOptions);
  }
  // Semantic analysis
  const semanticStarted = Date.now();
  ast = ast.accept(new SymbolTableTraversal(mergedCompilerOptions, contractStatefulnessHint)) as Ast;
  if (ast.contract.functions.some((fn) => fn.callBatchCandidate === true)) {
    assertNoReservedCallBatchSelector(ast.contract.functions);
  }
  if (mergedCompilerOptions.composition === 'framed') {
    for (const fn of ast.contract.functions) stampArgumentConditionalEntryActivations(fn);
  }
  profileLog('resolved:symbol', semanticStarted, { contract: contractName });
  for (const fn of ast.contract.functions) {
    if (!fn.entryAccesses) continue;
    for (const entry of fn.entryAccesses) {
      entry.keySources = entry.keySources.map((source, index) => (
        source.kind === 'param' && /_sender(?:_|$)/.test(entry.keyParams[index] ?? '')
          ? { kind: 'msgSender', senderOp: 'msg.sender', canonical: 'nullop:msg.sender' }
          : source
      ));
    }
  }
  // Ordinary direct writers can follow several physical callee blocks, including a non-returning callee
  // after the last returned event. Neither that event nor the old input chunk identifies the output band.
  // Preserve the source write footprint across journal lowering and publish the materialized coordinate;
  // the dynamic-write covenant still verifies every chunk's exact lock, category, and commitment there.
  // Framed entries use their declared record coordinates, and delegates retain their suffix convention.
  if (mergedCompilerOptions.composition !== 'framed') {
    for (const fn of ast.contract.functions) {
      if (!fn.isEntryPoint
        || fn.modifiers.includes(FunctionModifier.DELEGATE)
        || !dynamicChunkWriteFunctionKeys.has(sourceFunctionKey(fn))
        || ((fn.externalCalls?.length ?? 0) === 0 && (fn.lowLevelCalls?.length ?? 0) === 0)
        || fn.parameters.some((parameter) => parameter.name === '__internal__dynamicChunkOutputBase')) continue;
      const dynamicOutputBase = new ParameterNode(PrimitiveType.BIGINT, '__internal__dynamicChunkOutputBase');
      dynamicOutputBase.location = fn.location;
      fn.parameters.push(dynamicOutputBase);
    }
  }

  const typeCheckStarted = Date.now();
  ast = ast.accept(new TypeCheckTraversal(
    true, mergedCompilerOptions.evmCompat ?? false, mergedCompilerOptions.rootFileId,
    mergedCompilerOptions.composition === 'framed',
  )) as Ast;
  profileLog('resolved:typecheck', typeCheckStarted, { contract: contractName });
  // A creator's `initialize` on the child it just made runs in a later transaction, so its effects are folded into
  // the child's genesis state: the call is published on the create site and dropped from the creating body. Each
  // creation of a child this unit holds gets the genesis its creating body replays (docs/framed/CREATE2_IDENTITY.md,
  // "The genesis replay").
  if (mergedCompilerOptions.composition === 'framed') {
    const creates = (mergedCompilerOptions as InternalCompilerOptions).__framedCreates as FramedCreateSite[] | undefined;
    if (creates !== undefined && creates.length > 0) {
      const replayer = framedGenesisReplayer(ast, mergedCompilerOptions);
      ast = ast.accept(new FoldFramedCreate2Initializer(creates, replayer)) as Ast;
    }
  }
  publishStoredValueSources(ast.contract, ast.structDefinitions);
  const finalRequireStarted = Date.now();
  ast = ast.accept(new EnsureFinalRequireTraversal(
    mergedCompilerOptions.enforceFinalRequire, mergedCompilerOptions.allowUnsafeOperations,
    mergedCompilerOptions.composition === 'framed',
  )) as Ast;
  profileLog('resolved:finalRequire', finalRequireStarted, { contract: contractName });

  // Inject synthetic tx.locktime guard where tx.locktime is used without a protocol-enforcing time check
  if (mergedCompilerOptions.enforceLocktimeGuard
    && !(rootSourceCoversProgram(ast) && !code.includes('tx.locktime') && !code.includes('tx.time'))) {
    ast = ast.accept(new InjectLocktimeGuardTraversal()) as Ast;
  }

  // Early return transformation (rewrites return statements into nested if-else). A return a later pass placed is
  // nested too, and the transformation refuses one it cannot end a path at.
  // A framed body's bare return ends the frame, whose tail still runs, so it is not sealed (SEM-1 is direct-only).
  if (needsEarlyReturn || holdsUnconfinedReturn(ast)) {
    ast = ast.accept(new EarlyReturnTransformation(false, mergedCompilerOptions.composition !== 'framed',
      mergedCompilerOptions.composition !== 'framed')) as Ast;
  }

  // Compile referenced contracts in dependency order
  const referencedStarted = Date.now();
  const compiledBytecodes = ast.importedContracts.length === 0
    ? new Map<string, Uint8Array>()
    : compileReferencedContracts(ast, code, mergedCompilerOptions);
  foldPublishedCreationCodeHashes(ast.contract, compiledBytecodes);
  // Code generation rewrites bodies in place. Snapshot deployment provenance at the last semantic boundary so
  // publication does not depend on which representation the backend chose for a body.
  const deploymentTopologyKey = (fn: FunctionDefinitionNode): string => `${fn.name}(${fn.parameters
    .filter((parameter) => !parameter.name.startsWith('__internal__'))
    .map((parameter) => parameter.type.toString()).join(',')})`;
  const childDeploymentsBySignature = new Map<string, ChildDeploymentSiteAbi[]>();
  for (const fn of ast.contract.functions) {
    const deployments = childDeploymentSites(
      fn, compiledBytecodes, mergedCompilerOptions.commitmentLimit!, ast.contract.functions,
      mergedCompilerOptions.tagSingletonDataNfts,
    );
    if (deployments.length > 0) childDeploymentsBySignature.set(deploymentTopologyKey(fn), deployments);
  }
  profileLog('resolved:referenced', referencedStarted, {
    contract: contractName, imported: ast.importedContracts.length, compiled: compiledBytecodes.size,
  });

  if (emitsEvent) refuseEmittingReturningStateHelpers(ast.contract);

  mark('semantic');
  // B7.5/B7.4: classify the constructor, publish the facts, then require the two arms of A4.2.
  if (isDeployerProgram) {
    inspectDeployerConstructor(ast, mergedCompilerOptions as InternalCompilerOptions);
    const deployerCreate = ast.contract.functions.find((fn) => fn.name === '__construct');
    if (deployerCreate !== undefined) {
      arrangeDeployerParameters(ast, (mergedCompilerOptions as InternalCompilerOptions).__deployerProgram?.box);
      assertDeployerParameters(deployerCreate);
    }
    assertDeployerArms(ast, mergedCompilerOptions as InternalCompilerOptions);
  }
  // Code generation
  if (mergedCompilerOptions.composition === 'framed') {
    // `split(n)` and `merge(n)` resize the master pool in an arm beside the head, so the head never serves them.
    const lifecycle = extractFramedLifecycle(ast.contract);
    if (lifecycle.length > 0) {
      const lifecycleFunctions = new Set(framedLifecycleFunctions(ast.contract));
      ast.contract.functions = ast.contract.functions.filter((fn) => !lifecycleFunctions.has(fn));
      (mergedCompilerOptions as InternalCompilerOptions).__framedLifecycle = lifecycle;
    }
    // A framed compile emits one master program per contract. The shapes that program can carry are checked here,
    // after semantic analysis, so a contract whose frame the head cannot supply refuses by name instead of
    // compiling into a master that would violate its own frame rules.
    // The unit-wide survey above answers for every contract at once, so a sibling's emit would refuse a contract
    // whose own bodies emit nothing: a master's event region is sized by the bodies it runs, so the question is
    // asked of this contract alone.
    const contractEmitsEvent = surveyOptionalLowerings(ast.contract).emitsEvent;
    // A body that reaches inline assembly the lowering rewrote is served. A body that still reaches a block the
    // lowering left in its OWN body is refused per body, so the contract's other bodies keep compiling. A block
    // left in a definition the body reaches refuses the contract: the definition is emitted behind no stub, so the
    // assembly would reach every master of the contract. The reachability is matched by block identity against the
    // captured program, so a body only counts a block it really reaches.
    const survivingAssembly = survivingAssemblyBlocks(ast);
    const assemblyBodies = new Set<string>();
    let assemblyInReachedDefinition = false;
    for (const [name, blocks] of framedBodyAssembly ?? []) {
      for (const block of blocks) {
        if (survivingAssembly.inBodies.has(block)) assemblyBodies.add(name);
        else if (survivingAssembly.inFreeFunctions.has(block)) assemblyInReachedDefinition = true;
      }
    }
    if (assemblyInReachedDefinition) {
      throw new SolidcDiagnosticError(
        'FRAMED_CODEGEN_UNAVAILABLE',
        'the framed composition convention does not support this contract: inline assembly is not composed '
        + 'framed',
        { requested: 'framed', reason: 'inline assembly is not composed framed', contract: ast.contract.name },
      );
    }
    const assessment = assessFramedMasterShape({
      contract: ast.contract,
      compilerOptions: mergedCompilerOptions,
      interfaces: ast.interfaceDefinitions,
      hasContractInstantiation,
      // A pointer that is only declared is lowered like any other; a body still holding one after that is refused
      // on its own by the shape check, so the whole contract is refused only where it always was.
      hasFunctionPointers: functionTypeOutsideDeclarations,
      assemblyBodies,
      emitsEvent: contractEmitsEvent,
      loopGuardRefusals: (mergedCompilerOptions as InternalCompilerOptions).__loopGuardRefusals,
      fileConstants: ast.constantDefinitions,
    });
    if (!assessment.supported) {
      throw new SolidcDiagnosticError(
        'FRAMED_CODEGEN_UNAVAILABLE',
        `the framed composition convention does not support this contract: ${assessment.reason}`,
        { requested: 'framed', reason: assessment.reason, contract: ast.contract.name },
      );
    }
    stripFrameParameters(ast.contract, ast.constantDefinitions);
    // A master admits a user's frame and a callee's. A callee's frame is covered by a validator that binds the
    // facts a master cannot see, so the master has to recognise the validator it names however its entry runs:
    // every master reserves the validator program's hash slot. A master that also makes calls keeps one
    // descriptor list per entry, because the records are bound where each entry's own source makes the call; only
    // the count the head fixes is shared, so the entries must declare the same number of calls.
    const entryCalls = assessment.entryCalls ?? [];
    (mergedCompilerOptions as InternalCompilerOptions).__framedEntryCallSites = new Map(
      entryCalls.map((entry) => [entry.entryName, entry.calls]),
    );
    (mergedCompilerOptions as InternalCompilerOptions).__framedEntryCallRepeats = new Map(
      entryCalls.map((entry) => [entry.entryName, entry.repeats === true]),
    );
    (mergedCompilerOptions as InternalCompilerOptions).__framedCallCount = assessment.callCount ?? 0;
    (mergedCompilerOptions as InternalCompilerOptions).__framedRefusedEntries = new Map(
      (assessment.refusedEntries ?? []).map((entry) => [entry.entryName, entry.reason]),
    );
    (mergedCompilerOptions as InternalCompilerOptions).__framedStubbedDefinitions = new Map(
      (assessment.stubbedDefinitions ?? []).map((body) => [body.name, body.reason]),
    );
    (mergedCompilerOptions as InternalCompilerOptions).__framedBalanceReaders = assessment.balanceReaders ?? [];
    (mergedCompilerOptions as InternalCompilerOptions).__framedReservesValidatorHash = true;
    // The stop sites a builder resumes from, published per entry so a driver can look one up by the identity its
    // `FrameRequest.functionName` carries. Each entry publishes its own calls, so a driver names the callees that
    // entry's sites bind. No `read` site is published: the compiler does not hold the record identity a read
    // resolves to.
    (mergedCompilerOptions as InternalCompilerOptions).__framedStopSites = publishFramedStopSites(
      ast.contract.name,
      entryCalls,
    );
    setFramedMaster(mergedCompilerOptions as InternalCompilerOptions);
  }
  // The children are compiled, so a creator knows which of them take the pool binding it passes on.
  bindOraclePool(ast.contract, ast.freeFunctions, isFramedMaster(mergedCompilerOptions as InternalCompilerOptions));
  // B8.7 rule 2: after every transformation that moves statements, declare the created-children local in the arms
  // that hold a sender-reading site, so code generation's stack model and the program agree.
  injectCreatedChildrenLocals(ast, (mergedCompilerOptions as InternalCompilerOptions).__compiledDeployers);
  // A framed program is generated in the compilation-speed mode.
  const traversal = new GenerateTargetTraversal(mergedCompilerOptions.composition === 'framed'
    ? { ...mergedCompilerOptions, optimizeForCompilationSpeed: true }
    : mergedCompilerOptions);
  traversal.compiledBytecodes = compiledBytecodes;
  try {
    ast = ast.accept(traversal) as Ast;
  } catch (error) {
    throwProfile(error);
  }
  mark('codegen');
  for (const fn of ast.contract.functions) {
    assertRecoveryLoopBand(fn);
    assertKeccakLoopBand(fn);
    assertKeccakChainBand(fn);
  }

  const constructorParamLength = ast.contract.parameters.length;

  // Bytecode optimisation. The emitted bytecode is the new optimiser's output; optimiseBytecodeOld is only a
  // backwards-compat cross-check, and it runs its own up-to-1000-pass fixpoint, prohibitively slow on very large
  // scripts (e.g. big fixed-size arrays). Skip the cross-check above a size threshold - it never changes output.
  const optimisationResult = emitContractScript(
    mergedCompilerOptions.optimise !== false, traversal, constructorParamLength,
  );

  if (mergedCompilerOptions.optimise !== false
    && mergedCompilerOptions.optimizeForCompilationSpeed !== true
    && traversal.output.length <= OPTIMISER_COMPAT_CHECK_MAX_OPS
    && needsOptimiserCrossCheck(traversal.output)) {
    const optimisedBytecodeOld = optimiseBytecodeOld(traversal.output);
    if (!scriptsEqual(optimisedBytecodeOld, optimisationResult.script)) {
      console.error(scriptToAsm(optimisedBytecodeOld));
      console.error(scriptToAsm(optimisationResult.script));
      throw new Error('New bytecode optimisation is not backwards compatible, please report this issue to the SolidCash team');
    }
  }

  // The census baked its address offset before this rewrite. Point it at the slot the finished script contains.
  // The comparison above is the two optimisers against each other, so the retarget stays outside it.
  let framedOutlinedFunctions: FramedOutlinedFunction[] = [];
  if (isFramedMaster(mergedCompilerOptions as InternalCompilerOptions)) {
    const reservesValidatorHash = (mergedCompilerOptions as InternalCompilerOptions)
      .__framedReservesValidatorHash === true;
    const constantLockMaster = framedConstantLockMaster(mergedCompilerOptions as InternalCompilerOptions);
    // The lifecycle arm wraps the optimised master, so the census is retargeted after it moves the master's bytes.
    const lifecycle = (mergedCompilerOptions as InternalCompilerOptions).__framedLifecycle;
    // A master that asks whether a validator settles it beside another master of its contract computes the answer
    // once, ahead of its own head, and every segment that asks invokes it. A lifecycle spend carries no witness block
    // to read the answer from, so the definition sits inside the master's arm.
    Object.assign(optimisationResult, withValidatorSettledDefinition(optimisationResult, ast.contract.location));
    if (lifecycle !== undefined) {
      Object.assign(optimisationResult, wrapLifecycleArm(optimisationResult, lifecycle, ast.contract.location));
    }
    // The whole program's repeated spans are shared once it is final, the lifecycle arm included, and before the
    // census retarget, which reads the offsets the definitions move. An unoptimised compile keeps the generator's
    // own instructions, and `SOLIDCASH_NO_OUTLINE` keeps it inline.
    if (mergedCompilerOptions.optimise !== false && !solidcEnvFlagEnabled('SOLIDCASH_NO_OUTLINE')) {
      const outlined = outlineFramedMasterProgram(optimisationResult, reservesValidatorHash, constantLockMaster);
      Object.assign(optimisationResult, outlined.parts);
      framedOutlinedFunctions = outlined.functions;
    }
    optimisationResult.script = alignCensusAddressOffset(
      optimisationResult.script, reservesValidatorHash, constantLockMaster,
    );
  }

  // Attach debug information
  const functionDebug = traversal.entryPointDebugInfo.size > 0
    ? Object.fromEntries(traversal.entryPointDebugInfo)
    : undefined;
  // A function the framed pass defined runs in its own instruction space, as a compiler helper does, and holds no
  // require or log site: those stay in the program.
  const invokeDebug = traversal.invokeDebugInfo.size > 0 || framedOutlinedFunctions.length > 0
    ? {
      ...Object.fromEntries(traversal.invokeDebugInfo),
      ...Object.fromEntries(framedOutlinedFunctions.map((fn) => [fn.id, {
        bytecode: binToHex(scriptToBytecode(fn.script)),
        name: `outlined master span ${fn.id}`,
        requires: [],
        logs: [],
        sourceMap: generateSourceMap(fn.locationData, mergedCompilerOptions.sourceMap !== false),
      }])),
    }
    : undefined;

  // A helper body an entry OP_INVOKEs runs in its own instruction space, so its `require` pointers are recorded
  // under `invokeDebug` and never on the emitted program's own `requires`. A refusal report reads `requires` at
  // the failing frame's pointer, so republish those pointers beside the program's own, at the same relative
  // positions, and a failure inside the helper names the helper's message and line.
  const requires = isFramedMaster(mergedCompilerOptions as InternalCompilerOptions)
    ? [...optimisationResult.requires, ...[...traversal.invokeDebugInfo.values()].flatMap((info) => info.requires)]
    : optimisationResult.requires;

  const debug = {
    bytecode: binToHex(scriptToBytecode(optimisationResult.script)),
    // Marks the trace as exactly attributable: the emitted instructions are the generator's own.
    ...(mergedCompilerOptions.optimise === false && { optimise: false }),
    sourceMap: generateSourceMap(optimisationResult.locationData, mergedCompilerOptions.sourceMap !== false),
    logs: optimisationResult.logs,
    requires,
    ...(functionDebug && { functionDebug }),
    ...(invokeDebug && { invokeDebug }),
  };

  // Extract function body bytecodes for multi-function OP_INVOKE dispatch (keyed by selector hex)
  const functionBodies = traversal.entryPointBytecodes.size > 0
    ? Object.fromEntries(
      [...traversal.entryPointBytecodes.entries()].map(([selectorHex, bytecode]) => [selectorHex, binToHex(bytecode)]),
    )
    : undefined;

  const fingerprint = computeBytecodeFingerprintWithConstructorArgs(optimisationResult.script, constructorParamLength);

  mark('optimise');
  // Publish only the source snapshots which can be projected into the deliberately narrow, data-only replay ABI.
  // This runs after all semantic validation but before artifact construction.
  const artifact = generateArtifact(
    ast, optimisationResult.script, code, debug, mergedCompilerOptions, functionBodies, fingerprint,
  );
  // B7.0: the deployer option concerns this contract only. A plain compile builds none; an unsupported contract
  // records why and warns instead of failing.
  if (mergedCompilerOptions.deployer === true) {
    // B7.0: computed before any decision about the deployer, so it is present also when the deployer is refused.
    const byName = new Map<string, FunctionDefinitionNode[]>();
    for (const fn of [...ast.contract.functions, ...(ast.contract.constructorDef === undefined
      ? [] : [ast.contract.constructorDef])]) {
      const list = byName.get(fn.name) ?? [];
      list.push(fn);
      byName.set(fn.name, list);
    }
    const seen = new Set<FunctionDefinitionNode>();
    const queue = ast.contract.constructorDef === undefined ? [] : [ast.contract.constructorDef];
    let constructorWritesCollections = false;
    while (queue.length > 0 && !constructorWritesCollections) {
      const fn = queue.pop()!;
      if (seen.has(fn)) continue;
      seen.add(fn);
      let writesCollections = false;
      walkInvocationAst(fn.body, (visited) => {
        if (visited instanceof MappingAssignNode || visited instanceof MappingFieldAssignNode) {
          writesCollections = true;
        }
        if (visited instanceof FunctionCallNode) {
          for (const callee of byName.get(visited.identifier.name) ?? []) queue.push(callee);
        }
      });
      if (writesCollections) constructorWritesCollections = true;
    }
    if (constructorWritesCollections) artifact.constructorWritesCollections = true;
    // B7.2: computed once the artifact exists; the deployer program consumes them in B7.3.
    const constants = deployerConstantsOf(artifact, ast.contract);
    const constantsBox = (mergedCompilerOptions as InternalCompilerOptions).__deployerConstantsBox;
    if (constantsBox !== undefined) constantsBox.constants = constants;
    const split = requestsSplit(mergedCompilerOptions);
    const constructorParameters = ast.contract.constructorDef?.parameters ?? [];
    const unsupportedParameter = constructorParameters.some((parameter) => parameter.type instanceof StructType
      || parameter.type instanceof ArrayType || parameter.type instanceof FunctionType);
    const inlineLibrary = artifact.externalLibraries?.some((library) => library.resultNft !== true) === true;
    // A4.1 `single-container-key`: C keeps its token containers single (A8) and a function names a container by a
    // category that is not a contract parameter (C's own category, a state value, a parameter of the function).
    // A4.4 gives a row only to a contract parameter's container (`singleTokenContainerKeys`), so any other single
    // coin could not be required at birth. This is the complement of that filter, over the same functions; a name
    // decides it, since nothing may redeclare a contract parameter's name.
    const contractParameterNames = new Set(ast.contract.parameters.map((parameter) => parameter.name));
    const unrequiredSingleKey = ast.contract.singleTokenContainer !== true ? undefined
      : [ast.contract.constructorDef, ast.contract.fallbackDef, ast.contract.receiveDef, ...ast.contract.functions]
        .flatMap((fn) => (fn === undefined ? [] : (fn.tokenContainerAccesses ?? []).map((access) => ({ fn, access }))))
        .find(({ access }) => !(access.keySource === 'param' && contractParameterNames.has(access.keyParam)));
    const reason = !artifact.stateLayout || mergedCompilerOptions.composition === 'framed' ? 'not-stateful-direct'
      : ast.contract.usesBlockhash === true ? 'blockhash-ring'
        // A live block read names its oracle pool by the contract argument `__oraclePool`, which A carries, so the
        // code is the same for every category; only a read with no such binding would make it differ.
        : liveFunctionReadsBlockData(ast.contract)
          && !artifact.constructorInputs.some((input) => input.name === ORACLE_POOL_PARAMETER) ? 'code-not-constant'
          : artifact.composition !== undefined || split
            ? 'lock-composition'
            : unsupportedParameter ? 'param-type'
              : inlineLibrary ? 'inline-library'
                : unrequiredSingleKey !== undefined ? 'single-container-key'
                  : undefined;
    if (reason !== undefined) {
      artifact.deployerUnsupported = reason;
      const detail = reason === 'not-stateful-direct'
        ? 'a deployer exists only for a direct stateful contract'
        : reason === 'blockhash-ring' ? 'a blockhash ring would have to be minted at genesis'
          : reason === 'lock-composition' ? 'its master lock is not the plain pin and code P2SH32 lock'
            : reason === 'param-type' ? 'a constructor parameter has a struct, array or function type'
              : reason === 'inline-library' ? 'an inline external library puts an OP_DROP between the pin and the arguments'
                : `C keeps its token containers single and '${unrequiredSingleKey!.fn.name}' names one by `
                + `'${unrequiredSingleKey!.access.keyParam}', which is not a contract parameter, so that coin cannot `
                + 'be required at birth';
      emitCompilerWarning(new DeployerUnsupportedWarning(artifact.contractName, reason, detail).message);
    } else if (deployerSourceAst !== undefined && !isDeployerProgram) {
      // A block reader's master lock commits to the `__oraclePool` binding; the deployer's create must pin it even
      // though its own genesis block reads come from the locktime.
      if (artifact.constructorInputs.some((input) => input.name === ORACLE_POOL_PARAMETER)
        || takesOraclePool(ast.contract)) {
        deployerSourceAst.contract.oraclePoolBindingForGenesis = true;
      }
      const built = compileDeployerProgram(deployerSourceAst, code, mergedCompilerOptions as InternalCompilerOptions,
        constants, artifact.constructorInputs.some((input) => input.name === ORACLE_POOL_PARAMETER),
        liveFunctionReadsBlockData(ast.contract));
      if ('reason' in built) {
        artifact.deployerUnsupported = built.reason;
        emitCompilerWarning(new DeployerUnsupportedWarning(
          artifact.contractName, built.reason,
          ('detail' in built ? built.detail : undefined) ?? 'the constructor uses a construct the deployer cannot compile',
        ).message);
      } else {
        const program = built.artifact;
        assertSweepTemplate(program, (mergedCompilerOptions as { __deployerTestBox?: { sweepBody?: string } })
          .__deployerTestBox?.sweepBody, deployerSourceAst.contract);
        const createAbi = program.abi.find((fn) => fn.name === '__construct');
        const sweepAbi = program.abi.find((fn) => fn.name === '__solidcash_sweep');
        const callSlots = built.box.callSlots ?? 0;
        const body = constants.code;
        const bytecodeBytes = asmToBytecode(program.bytecode);
        const unlockingSize = smallestCreateUnlockingSize(
          createAbi?.inputs ?? [], body.length, bytecodeBytes.length, callSlots,
        );
        if (unlockingSize > 10000) {
          artifact.deployerUnsupported = 'unlocking-too-large';
          emitCompilerWarning(new DeployerUnsupportedWarning(
            artifact.contractName, 'unlocking-too-large',
            `even the smallest create unlocking is ${unlockingSize} bytes, past the 10,000-byte limit`,
          ).message);
        } else {
        // B7.14: a constructor with a call slot makes C's born code end with `push32(hash256(Deploy<C>)) OP_DROP`.
        // The body, which TEMPLATE hashes, stays the same with and without a deployer.
          const deployerHash = hash256(bytecodeBytes);
          const bornCode = callSlots > 0 ? Uint8Array.from([...body, 0x20, ...deployerHash, 0x75]) : body;
          if (callSlots > 0) {
            const script = [...bytecodeToScript(asmToBytecode(artifact.bytecode)), deployerHash,
              Op.OP_DROP];
            artifact.bytecode = scriptToAsm(script);
          }
          const lockingBytecode = Uint8Array.from([0xaa, 0x20, ...deployerHash, 0x87]);
          const deployerAbi: DeployerAbi = {
            version: 1,
            bytecode: binToHex(bytecodeBytes),
            lockingBytecode: binToHex(lockingBytecode),
            template: binToHex(sha256Bytes.hash(body)),
            code: binToHex(bornCode),
            birthTrailer: callSlots > 0,
            coinValue: BigInt(1200 + Math.ceil(sweepTransactionSize(bytecodeBytes.length) / 100) * 100).toString(),
            sweepAge: 1440,
            abi: [
              ...(createAbi === undefined ? [] : [{ ...createAbi, name: 'create', selector: binToHex(DEPLOYER_SELECTOR_CREATE) }]),
              ...(sweepAbi === undefined ? [] : [{ ...sweepAbi, name: 'sweep', selector: binToHex(DEPLOYER_SELECTOR_SWEEP) }]),
            ],
            genesisOutputs: built.box.genesisOutputs ?? 0,
            callSlots,
            satoshiContainer: built.box.satoshiContainer ?? 'none',
            tokenRows: constants.singleTokenContainerKeys
              .map((name) => artifact.constructorInputs.findIndex((input) => input.name === name))
              .filter((index) => index >= 0),
            collectionRows: (built.box.collectionRows ?? []).map((row) => ({
              ...row,
              ...(built.box.journalDepths?.[row.collection] === undefined
                ? {} : { journalDepth: built.box.journalDepths[row.collection] }),
            })),
            // A2: a function of C other than its constructor reads block data (the constructor's reads use the locktime).
            readsBlockData: liveFunctionReadsBlockData(ast.contract),
            constructorReadsSender: built.box.constructorReadsSender === true,
            ...(built.box.constructorBlockField === undefined
              ? {} : { constructorBlockField: built.box.constructorBlockField }),
            sidecars: built.box.sidecars ?? { keccak: 0, ecrecover: 0 },
          };
          // B7.14 (O4): the born code ends with the trailer exactly when callSlots > 0, and it names this deployer.
          if (callSlots > 0) {
            const trailer = [...bornCode.slice(-34)];
            if (trailer[0] !== 0x20 || trailer[33] !== 0x75
            || trailer.slice(1, 33).some((byte, index) => byte !== deployerHash[index])) {
              throw new DeployerInternalError(ast.contract, 'the birth trailer does not name this deployer');
            }
          }
          artifact.deployer = deployerAbi;
        }
      }
    }
  }
  if (isFramedMaster(mergedCompilerOptions as InternalCompilerOptions)) {
    // The slots are located in the finished script, after the optimiser: emission records them, but only the
    // emitted bytes say where they survived. A master that can be reached through a call reserves the third slot
    // for the validator program's hash; one that stands alone reserves two.
    const reservesValidatorHash = (mergedCompilerOptions as InternalCompilerOptions)
      .__framedReservesValidatorHash === true;
    // A constant-lock master reserves no slot: its lock is the same for every category it is deployed as.
    const composition: NonNullable<Artifact['composition']> = {
      convention: 'framed',
      placeholders: framedConstantLockMaster(mergedCompilerOptions as InternalCompilerOptions)
        ? { version: 1, constantLock: true }
        : { version: 1, ...findPlaceholderOffsets(scriptToBytecode(optimisationResult.script), reservesValidatorHash) },
    };
    // The stop sites a builder resumes each served entry from.
    const stopSites = (mergedCompilerOptions as InternalCompilerOptions).__framedStopSites;
    if (stopSites !== undefined) composition.stopSites = stopSites;
    // The bodies the master cannot serve are published beside the table: the entry stays callable by selector, its
    // program refuses every frame, and a builder reads why here rather than guessing from a failed spend.
    const refused = (mergedCompilerOptions as InternalCompilerOptions).__framedRefusedEntries;
    if (refused !== undefined && refused.size > 0) {
      composition.refusedEntries = [...refused].map(([name, reason]) => ({
        functionName: entryFunctionName(ast.contract.name, name),
        reason,
      }));
    }
    // The entries that read their own balance: a builder spends every container of the contract for them.
    const balanceReaders = (mergedCompilerOptions as InternalCompilerOptions).__framedBalanceReaders ?? [];
    if (balanceReaders.length > 0) {
      composition.balanceReaders = balanceReaders.map((name) => entryFunctionName(ast.contract.name, name));
    }
    const lifecycle = (mergedCompilerOptions as InternalCompilerOptions).__framedLifecycle;
    if (lifecycle !== undefined) composition.lifecycle = publishLifecycle(lifecycle);
    const creates = (mergedCompilerOptions as InternalCompilerOptions).__framedCreates;
    if (creates !== undefined && creates.length > 0) {
      composition.creates = creates.map((site) => ({
        ...(site.contractName === undefined ? {} : { contractName: site.contractName }),
        ...(site.codeStateVariable === undefined ? {} : { codeStateVariable: site.codeStateVariable }),
        ...(site.foldedCall === undefined ? {} : { foldedCall: site.foldedCall }),
      }));
    }
    artifact.composition = composition;
  } else {
    // A direct artifact names its functions refused for a loop guard as a master names its refused entries, with
    // every entry that runs one: the program fails wherever it reaches a refusal, and a builder reports why.
    const loopGuardRefusals = (mergedCompilerOptions as InternalCompilerOptions).__loopGuardRefusals;
    const refusedFunctions = loopGuardRefusals === undefined ? []
      : directRefusedEntries(ast.contract, loopGuardRefusals).map(([name, reason]) => ({
        functionName: entryFunctionName(ast.contract.name, name),
        reason,
      }));
    if (refusedFunctions.length > 0) artifact.refusedFunctions = refusedFunctions;
  }

  mark('artifact');
  profileLog('resolved', resolvedStarted, {
    contract: artifact.contractName,
    bytecodeBytes: artifact.debug?.bytecode ? artifact.debug.bytecode.length / 2 : undefined,
  });
  // Solidity-compatible upgradeable contracts are marked delegate in the primary compilation pass (the
  // initializer/reinitializer inference above), rather than through the lazy `autoDelegate` variant. They use
  // the same pinned delegate covenant and must publish the same certificate; otherwise the SDK keeps the
  // default proxy's strict output-cardinality check and valid mapping-growing initializers fail at input 0.
  const hasCompilerDelegate = artifact.abi.some((fn) => fn.modifiers?.includes(FunctionModifier.DELEGATE));
  if (mergedCompilerOptions.autoDelegate || hasCompilerDelegate) {
    artifact.delegateProxyStateOutputCountPinned = true;
  }
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
  const abiByFunctionId = new Map([...invocationFunctionById].map(([id, fn]) => {
    const selector = selectorById.get(id);
    const abi = selector
      ? artifact.abi.find((candidate) => candidate.selector === selector)
      : artifact.abi.find((candidate) => candidate.name === fn.name
        && candidate.inputs.filter((input) => !input.name.startsWith('__internal__')).length
          === fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__')).length);
    return [id, abi] as const;
  }));
  artifact.invocationAnalysis = {
    version: 1,
    protocolVersions: [1],
    functions: invocationAnalysis.functions.map((summary) => {
      const abi = abiByFunctionId.get(summary.id);
      const externalCalls = abi?.externalCalls ?? [];
      const bounded = !summary.footprint.unknown
        && externalCalls.every((call) =>
          call.occurrence === 'once' || call.maximumOccurrences !== undefined);
      return ({
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
        ...(abi?.outputs?.length && { outputs: abi.outputs }),
        ...(externalCalls.some((call) => call.hasReturnValues || call.opaqueReturn) && {
          resultDependencies: externalCalls
            .filter((call) => call.hasReturnValues || call.opaqueReturn)
            .map((call) => ({
              callsiteId: call.callsiteId!,
              returnTypes: call.returnTypes ?? [],
              ...(call.resultEncoding && { resultEncoding: call.resultEncoding }),
              opaque: !!call.opaqueReturn,
            })),
        }),
        ...(abi?.resultConsumers?.length && { resultConsumers: abi.resultConsumers }),
        bounded,
        ...(bounded && {
          maximumDirectInvocations: externalCalls.reduce(
            (total, call) => total + (call.maximumOccurrences ?? 1), 0,
          ),
        }),
        ...(externalCalls.length && { externalCalls }),
        ...(abi?.externalOutStateReads?.length && { externalOutStateReads: abi.externalOutStateReads }),
        ...(abi?.emits?.length && { emits: abi.emits }),
        ...(abi?.transferCount !== undefined && { transferCount: abi.transferCount }),
        ...(abi?.transfers?.length && { transfers: abi.transfers }),
        ...(abi?.tokenContainerAccesses?.length && { tokenContainerAccesses: abi.tokenContainerAccesses }),
        ...(abi?.dynamicReads?.length && { dynamicReads: abi.dynamicReads }),
        ...(abi?.dynamicWrites?.length && { dynamicWrites: abi.dynamicWrites }),
        ...(abi?.blockLayout && { blockLayout: abi.blockLayout }),
        ...(abi?.ecrecoverArgParams?.length && { ecrecoverArgParams: abi.ecrecoverArgParams }),
      });
    }),
    components: invocationAnalysis.components,
  };

  // This contract reads blockhash(n): its pool needs ring slots, and the SDK co-spends the slot for n.
  if (blockOracle.usesBlockhash) artifact.usesBlockhash = true;
  // The reads of the bound contracts it creates shape a pool its deployment mints.
  const childPoolReads = createdPoolReads(ast.contract, ast.freeFunctions);
  if (childPoolReads !== undefined) artifact.createdPoolReads = childPoolReads;
  if (ast.contract.usesBlockOracle) {
    // A direct reader takes P as its `__oraclePool` input; a framed one carries it in pool slots.
    if (isFramedMaster(mergedCompilerOptions as InternalCompilerOptions)) {
      const slots = findOraclePoolSlots(asmToBytecode(artifact.bytecode));
      // A framed entry the master refuses runs none of its body, so a contract whose only clock read is in such a
      // body reads no pool.
      const refusedOnly = (artifact.composition?.refusedEntries?.length ?? 0) > 0;
      if (slots.length > 0) {
        artifact.usesBlockOracle = true;
        artifact.oraclePoolSlots = slots;
      } else if (!refusedOnly) {
        throw new Error(`'${artifact.contractName}' reads the block oracle but did not publish its pool slot`);
      }
    } else {
      artifact.usesBlockOracle = true;
      if (!takesOraclePool(ast.contract)) {
        throw new Error(`'${artifact.contractName}' reads the block oracle but takes no ${ORACLE_POOL_PARAMETER}`);
      }
    }
  }
  const artifactBytes = asmToBytecode(artifact.bytecode).length;
  const maximumInputBytes = mergedCompilerOptions.maximumInputBytes ?? MAX_INPUT_BYTESIZE;
  // A contract over the limit with the multi-call entry is compiled again without it (settleCallBatch).
  if (artifactBytes > maximumInputBytes && artifact.callBatch === undefined) {
    const message = `Contract '${artifact.contractName}' is ${artifactBytes} bytes, exceeding the configured `
      + `${maximumInputBytes}-byte input-script limit by ${artifactBytes - maximumInputBytes}. `
      + 'Every spend of it is invalid at consensus; it cannot be deployed without splitting '
      + '(compileFileSplit / compileStringSplit) or reduction.';
    // Append rather than overwrite diagnostics already recorded by other compiler passes.
    artifact.diagnostics = [
      ...(artifact.diagnostics ?? []),
      { severity: 'error', code: 'contract-size-limit', message },
    ];
    // A compiler warning is diagnostic only. The SDK refuses to deploy code no input can spend on its provider's
    // network, and a spend of it fails at consensus. A default compile takes the direct build when that one fits.
    console.warn(`Error: ${message}`);
  }
  // B8.10: the deployer of every child type this contract creates, by contract name.
  const childDeployers = (mergedCompilerOptions as InternalCompilerOptions).__compiledDeployers;
  if (childDeployers !== undefined && childDeployers.size > 0) {
    const entries: Record<string, NonNullable<Artifact['deployer']>> = {};
    for (const [name, child] of childDeployers) {
      if (child.abi !== undefined) entries[name] = child.abi;
    }
    if (Object.keys(entries).length > 0) artifact.childDeployers = entries;
  }
  // B8.7: a marked creator publishes the flag, and every entry but `receive` ends its ABI with the digest input.
  if (ast.contract.createsSenderReadingChildren === true) {
    artifact.createsSenderReadingChildren = true;
    for (const fn of ast.contract.functions) {
      if (fn.isEntryPoint !== true || fn.name === '__construct' || fn.isReceive || fn.isFallback) continue;
      if (fn.parameters[fn.parameters.length - 1]?.name !== '__internal__createdChildren') {
        throw new DeployerInternalError(fn,
          `'${fn.name}' does not end with the created-children parameter`);
      }
    }
  }
  // O4 (B6.4, B7.14) on the code this artifact gives, after every pass. The flags are those of the contract's facts:
  // bit 0 exactly for a marked creator (O3), bit 1 for a record-sound contract (O5).
  if (ast.contract.codeTailApplied === true) {
    const expectedFlags = (ast.contract.recordSound === true ? CODE_MARKER_RECORD_SOUND : 0)
      | (ast.contract.createsSenderReadingChildren === true ? CODE_MARKER_MARKED_CREATOR : 0);
    if ((ast.contract.codeMarkerFlags ?? 0) !== expectedFlags) {
      throw new DeployerInternalError(ast.contract,
        `O4: the code marker's flags ${ast.contract.codeMarkerFlags ?? 0} are not the contract's ${expectedFlags}`);
    }
    const trailer = artifact.deployer?.birthTrailer === true
      ? hexToBin(artifact.deployer.lockingBytecode).slice(2, 34) : undefined;
    try {
      verifyCodeTail(asmToBytecode(artifact.bytecode), { flags: expectedFlags, trailer });
    } catch (error) {
      if (error instanceof CodeTailError) throw new DeployerInternalError(ast.contract, `O4: ${error.message}`);
      throw error;
    }
    if (artifact.deployer !== undefined && binToHex(asmToBytecode(artifact.bytecode)) !== artifact.deployer.code) {
      throw new DeployerInternalError(ast.contract, 'B7.14: the artifact\'s code is not the code Deploy<C> gives birth to');
    }
  }
  // O8 (B6.0) on the code this artifact gives, after every pass: each arm of a direct stateful master begins with its
  // exact-stack check.
  const exactStack = traversal.exactStackArms;
  if (exactStack.arms.length > 0) {
    try {
      verifyArmHeads(asmToBytecode(artifact.bytecode), exactStack.arms, {
        redeemLengthBlock: exactStack.redeemLengthBlock, poolBinding: exactStack.poolBinding,
      });
    } catch (error) {
      if (error instanceof ArmHeadError) throw new DeployerInternalError(ast.contract, `O8: ${error.message}`);
      throw error;
    }
  }
  return artifact;
}

/**
 * The child's constructor inputs as a creating site fills them: its arguments when the child takes them as contract
 * parameters, then the creator's own `__oraclePool` for a bound child, which no recipe describes yet.
 */
function childDeploymentArguments(
  child: ContractNode, siteArguments: ChildDeploymentSiteAbi['constructorArgs'][number][],
): ChildDeploymentSiteAbi['constructorArgs'][number][] {
  if (!takesOraclePool(child)) return siteArguments;
  const baked = child.parameters.some((parameter) => parameter.name !== ORACLE_POOL_PARAMETER);
  return [...(baked ? siteArguments : []), { kind: 'expression' }];
}

function validateAbstractContractInstantiations(ast: Ast): void {
  const contracts = [ast.contract, ...ast.importedContracts];
  const abstractNames = new Set(contracts.filter((contract) => contract.isAbstract).map((contract) => contract.name));
  if (abstractNames.size === 0) return;

  const visited = new WeakSet<Node>();
  const walk = (node: Node): void => {
    if (visited.has(node)) return;
    visited.add(node);
    if (node instanceof InstantiationNode && abstractNames.has(node.identifier.name)) {
      throw new AbstractContractInstantiationError(node, node.identifier.name);
    }
    for (const value of Object.values(node)) {
      if (value instanceof Node) walk(value);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node) walk(item);
      }
    }
  };
  for (const contract of contracts) walk(contract);
}

// Solidity resolves a contract-scope function before a type namespace with the same name. Perform this check on
// the source AST, before inheritance expansion rewrites `Base.f()` to an internal base-dispatch alias and loses
// the original ambiguous spelling.
function validateFunctionNamespaceShadows(ast: Ast): void {
  const contracts = [ast.contract, ...ast.importedContracts];
  const contractsByName = new Map(contracts.map((contract) => [contract.name, contract]));

  for (const contract of contracts) {
    const functionNames = new Set(contract.functions.map((fn) => fn.name));
    if (functionNames.size === 0) continue;
    const visited = new WeakSet<Node>();
    const walk = (node: Node): void => {
      if (visited.has(node)) return;
      visited.add(node);
      if (node instanceof FunctionCallNode && node.identifier.name.includes('.')) {
        const [qualifier, member] = node.identifier.name.split('.', 2);
        const namespace = contractsByName.get(qualifier);
        if (functionNames.has(qualifier)
          && namespace?.functions.some((candidate) => candidate.name === member)) {
          throw new UndefinedReferenceError(node.identifier);
        }
      }
      for (const value of Object.values(node)) {
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) {
          for (const item of value) if (item instanceof Node) walk(item);
        }
      }
    };
    walk(contract);
  }
}

// Solc validates every library body even when that helper is unreachable from the selected primary contract.
// Catch `library L { using L for *; ... x.publicMember(); }` before dead-helper pruning removes the body.
function validateLibrarySelfExternalCalls(ast: Ast): void {
  const libraryFunctions = new Map(ast.freeFunctions
    .filter((fn) => fn.isLibraryFunction && fn.name.includes('.'))
    .map((fn) => [fn.name, fn]));
  if (libraryFunctions.size === 0) return;

  for (const fn of libraryFunctions.values()) {
    const libraryName = fn.name.slice(0, fn.name.indexOf('.'));
    const hasSelfWildcard = ast.usingForDirectives.some((directive) =>
      directive.declaringLibraryName === libraryName
      && directive.libraryName === libraryName
      && directive.isWildcard);
    if (!hasSelfWildcard) continue;
    const visited = new WeakSet<Node>();
    const walk = (node: Node): void => {
      if (visited.has(node)) return;
      visited.add(node);
      if (node instanceof FunctionCallNode && node.identifier.name.includes('.')) {
        const methodName = node.identifier.name.slice(node.identifier.name.lastIndexOf('.') + 1);
        const targetName = `${libraryName}.${methodName}`;
        const target = libraryFunctions.get(targetName);
        if (target && (target.modifiers.includes(FunctionModifier.PUBLIC)
          || target.modifiers.includes(FunctionModifier.EXTERNAL))) {
          throw new LibrarySelfExternalCallError(node, targetName);
        }
      }
      for (const value of Object.values(node)) {
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) {
          for (const item of value) if (item instanceof Node) walk(item);
        }
      }
    };
    walk(fn);
  }
}

// Parser-time named AddressType values are deliberately permissive so forward and imported contract/interface/
// aggregate types can resolve later. Once imports are merged, any placeholder whose name still has no declaration
// is a genuine unknown user type (including one nested inside a struct or function type).
function validateKnownUserTypes(ast: Ast): void {
  const contracts = [ast.contract, ...ast.importedContracts];
  const knownNames = new Set<string>([
    ...contracts.map((contract) => contract.name),
    ...ast.interfaceDefinitions.map((iface) => iface.name),
    ...ast.structDefinitions.map((definition) => definition.name),
    ...ast.enumDefinitions.map((definition) => definition.name),
    ...ast.typeDefinitions.map((definition) => definition.name),
    ...contracts.flatMap((contract) => contract.structDefinitions.map((definition) => definition.name)),
    ...contracts.flatMap((contract) => contract.enumDefinitions.map((definition) => definition.name)),
    ...contracts.flatMap((contract) => contract.typeDefinitions.map((definition) => definition.name)),
    ...ast.interfaceDefinitions.flatMap((iface) => iface.structDefinitions.map((definition) => definition.name)),
    ...ast.interfaceDefinitions.flatMap((iface) => iface.enumDefinitions.map((definition) => definition.name)),
    ...ast.interfaceDefinitions.flatMap((iface) => iface.typeDefinitions.map((definition) => definition.name)),
  ]);
  const typeSeen = new WeakSet<object>();
  const validateType = (type: Type, owner: Node): void => {
    if (typeof type !== 'object' || type === null || typeSeen.has(type as object)) return;
    typeSeen.add(type as object);
    if (type instanceof AddressType && type.interfaceName) {
      if (type.interfaceName.startsWith('__slotptr_')) return;
      const bare = type.interfaceName.slice(type.interfaceName.lastIndexOf('.') + 1);
      if (!knownNames.has(type.interfaceName) && !knownNames.has(bare)) {
        throw new UnknownContractTypeError(owner, type.interfaceName);
      }
      return;
    }
    if (type instanceof ArrayType) validateType(type.elementType, owner);
    else if (type instanceof MappingType) {
      validateType(type.keyType, owner);
      validateType(type.valueType, owner);
    } else if (type instanceof StructType) {
      for (const field of type.fields) validateType(field.type, owner);
    } else if (type instanceof FunctionType) {
      for (const parameter of type.parameterTypes) validateType(parameter, owner);
      for (const result of type.returnTypes) validateType(result, owner);
    } else if (type instanceof TupleType) {
      for (const element of type.elements) validateType(element, owner);
    } else if (type instanceof ValueType) {
      validateType(type.underlyingType, owner);
    }
  };

  const visited = new WeakSet<Node>();
  const walk = (node: Node): void => {
    if (visited.has(node)) return;
    visited.add(node);
    for (const value of Object.values(node)) {
      if (value instanceof Node) walk(value);
      else if (value instanceof ArrayType || value instanceof AddressType || value instanceof MappingType
        || value instanceof StructType || value instanceof FunctionType || value instanceof TupleType
        || value instanceof ValueType) {
        validateType(value, node);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (item instanceof Node) walk(item);
          else if (item instanceof ArrayType || item instanceof AddressType || item instanceof MappingType
            || item instanceof StructType || item instanceof FunctionType || item instanceof TupleType
            || item instanceof ValueType) {
            validateType(item, node);
          } else if (item && typeof item === 'object' && 'type' in item) {
            const fieldType = (item as { type?: Type }).type;
            if (fieldType instanceof ArrayType || fieldType instanceof AddressType
              || fieldType instanceof MappingType || fieldType instanceof StructType
              || fieldType instanceof FunctionType || fieldType instanceof TupleType
              || fieldType instanceof ValueType) {
              validateType(fieldType, node);
            }
          }
        }
      }
    }
  };
  walk(ast);
}

// Private ancestor functions are cloned during inheritance flattening so an inherited PUBLIC function can keep
// calling its own private helper. They must not thereby enter the derived contract's lexical lookup scope.
function validateInheritedPrivateFunctionAccess(ast: Ast): void {
  const contracts = [ast.contract, ...ast.importedContracts];
  const byName = new Map(contracts.map((contract) => [contract.name, contract]));
  const ancestorsOf = (contract: ContractNode): ContractNode[] => {
    const result: ContractNode[] = [];
    const seen = new Set<string>();
    const visit = (name: string): void => {
      if (seen.has(name)) return;
      seen.add(name);
      const ancestor = byName.get(name);
      if (!ancestor) return;
      result.push(ancestor);
      for (const parent of ancestor.implements) visit(parent);
    };
    for (const parent of contract.implements) visit(parent);
    return result;
  };

  for (const contract of contracts) {
    const ancestors = ancestorsOf(contract);
    if (ancestors.length === 0) continue;
    const ownFunctionNames = new Set(contract.functions.map((fn) => fn.name));
    const privateByName = new Map<string, Set<string>>();
    for (const ancestor of ancestors) {
      for (const fn of ancestor.functions.filter((candidate) => candidate.visibility === 'private')) {
        const origins = privateByName.get(fn.name) ?? new Set<string>();
        origins.add(ancestor.name);
        privateByName.set(fn.name, origins);
      }
    }
    if (privateByName.size === 0) continue;

    for (const fn of contract.functions) {
      const visited = new WeakSet<Node>();
      const walk = (node: Node): void => {
        if (visited.has(node)) return;
        visited.add(node);
        if (node instanceof FunctionCallNode) {
          const dot = node.identifier.name.indexOf('.');
          const qualifier = dot >= 0 ? node.identifier.name.slice(0, dot) : undefined;
          const name = dot >= 0 ? node.identifier.name.slice(dot + 1) : node.identifier.name;
          const privateOrigins = privateByName.get(name);
          const invalidBare = qualifier === undefined && !ownFunctionNames.has(name) && !!privateOrigins;
          const invalidQualified = qualifier !== undefined && !!privateOrigins?.has(qualifier);
          if (invalidBare || invalidQualified) throw new UndefinedReferenceError(node.identifier);
        }
        for (const value of Object.values(node)) {
          if (value instanceof Node) walk(value);
          else if (Array.isArray(value)) {
            for (const item of value) if (item instanceof Node) walk(item);
          }
        }
      };
      walk(fn);
    }
  }
}

/**
 * Compile EVERY top-level declaration in `code` (and its imports) to its own Artifact, keyed by name -
 * solc's `contracts[name]` model. Each concrete contract / library is compiled with itself as the primary
 * (the others available as siblings/imports); each interface yields an ABI-only declaration artifact.
 * Abstract contracts are excluded (not deployable). `compileString` is unchanged (single primary artifact).
 * See docs/multi-contract-artifacts.md.
 */
/**
 * The contracts the given contracts create: every `type(C).creationCode` and every `new C(...)` names its child. The
 * walk follows each node's fields once, so references back up the tree (a resolved contract) end it.
 */
function framedCreationTargetsOf(contracts: readonly ContractNode[]): string[] {
  const targets = new Set<string>();
  const seen = new WeakSet<object>();
  const walk = (value: unknown): void => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (value instanceof TypeIntrospectionNode && value.property === 'creationCode') targets.add(value.typeArgText);
    if (value instanceof InstantiationNode) targets.add(value.identifier.name);
    for (const field of Object.values(value)) walk(field);
  };
  for (const contract of contracts) walk(contract);
  return [...targets];
}

/**
 * The contracts a source creates, by `type(C).creationCode` or `new C(...)`, its imports included. A project compiler
 * gathers them across every source and passes them to each compile (`framedCreationTargets`), since a creator and its
 * child need not share a source.
 */
export function framedCreationTargetsOfSource(code: string, options: CompileStringOptions = {}): string[] {
  const parsed = parseAndResolve(code, normalizeCompilerOptions(withFilesResolver(options)), options.errorListener);
  return framedCreationTargetsOf(
    [...parsed.importedContracts, parsed.contract].filter((contract): contract is ContractNode => contract !== undefined),
  );
}

export function compileStringMulti(code: string, options: CompileStringOptions = {}): ArtifactMap {
  refuseRemovedCompilerOptions(options);
  const compilerOptions: CompileOptions = withFilesResolver(options);
  const { upgradesFrom } = compilerOptions;
  return runWithWarningListener(compilerOptions, () => {
    const artifacts = compileStringMultiUnchecked(code, withoutUpgradesFrom(compilerOptions));
    requireUpgradeLayouts(artifacts, upgradesFrom);
    return artifacts;
  });
}

function compileStringMultiUnchecked(code: string, compilerOptions: CompileOptions): ArtifactMap {
  // compileMultiCache has its own early return and therefore owns the same pass-token sanitation boundary as the
  // single-artifact entry point. Per-contract compilation is never reached on a multi-artifact cache hit.
  const {
    errorListener, warningListener, compileDeclarations, suppressWarnings = false, ...artifactCompilerOptions
  } = compilerOptions;
  const mergedCompilerOptions = normalizeCompilerOptions(artifactCompilerOptions);
  const requested = compileDeclarations === undefined ? undefined : new Set(compileDeclarations);
  const cacheable = artifactCacheEnabled(
    artifactCompilerOptions, errorListener, suppressWarnings, warningListener,
  );
  const multiCacheKey = cacheable
    ? buildMultiArtifactCacheKey(code, artifactCompilerOptions, compileDeclarations)
    : '';
  if (multiCacheKey) {
    const cached = compileMultiCache.get(multiCacheKey);
    if (cached) {
      recordArtifactCacheHit({
        hit: 'memory',
        multi: true,
        artifacts: Object.keys(cached),
      });
      return cloneArtifactMap(cached, suppressWarnings);
    }
    const diskCached = diskMultiCacheGet(multiCacheKey);
    if (diskCached) {
      // Disk stores artifacts without their lazy `delegateArtifact` getter (JSON cannot preserve it). Re-attach
      // per declaration so a cold worker matches a warm one, exactly as the single-artifact disk path does.
      for (const [name, diskArtifact] of Object.entries(diskCached)) {
        // One options object per declaration: the getter reads it later.
        const diskOptions = normalizeCompilerOptions(artifactCompilerOptions);
        attachDelegateVariant(diskArtifact, code, diskOptions, errorListener, name, true);
      }
      // Promote into the process-local map so sibling declarations in this process skip the disk read.
      compileMultiCache.set(multiCacheKey, diskCached);
      recordArtifactCacheHit({
        hit: 'disk',
        multi: true,
        artifacts: Object.keys(diskCached),
      });
      return cloneArtifactMap(diskCached, suppressWarnings);
    }
  }

  // Enumerate the top-level contracts (after import resolution, so imported deps are included). The default
  // parse leaves the last as primary; the full set is [...importedContracts, contract].
  const probeStarted = Date.now();
  const probe = parseAndResolve(code, mergedCompilerOptions, errorListener);  profileLog('multi-probe', probeStarted, {
    imported: probe.importedContracts.length,
    interfaces: (probe.interfaceDefinitions ?? []).length,
  });
  const allContracts = [...probe.importedContracts, probe.contract].filter(Boolean);
  const interfaces = probe.interfaceDefinitions ?? [];
  // The contracts another contract of the unit creates: their masters carry no deployment slot, so each shard has one
  // lock its creator can check the child's genesis against (docs/framed/CREATE2_IDENTITY.md).
  const creationTargets = new Set([
    ...framedCreationTargetsOf(allContracts.filter((contract): contract is ContractNode => contract !== undefined)),
    ...(artifactCompilerOptions.framedCreationTargets ?? []),
  ]);
  // Taken from the pristine probe: the last primary's pipeline consumes it.
  const implementers = artifactCompilerOptions.callBatch === undefined
    ? interfaceImplementers(interfaces, allContracts) : new Map<string, string[]>();

  const map: ArtifactMap = {};
  const seen = new Set<string>();
  for (const iface of interfaces) {
    map[iface.name] = generateInterfaceArtifact(probe, iface.name, code, mergedCompilerOptions);
  }
  for (const contract of allContracts) {
    if (!contract || seen.has(contract.name)) continue;
    seen.add(contract.name);
    // Before Solidity 0.7, an `internal` constructor was the way to mark a contract abstract. The parser
    // deliberately accepts that legacy spelling without rewriting `isAbstract` (single-contract compilation
    // still needs the declaration for inheritance), but solc's multi-artifact output must not expose it as a
    // deployable contract. In particular, compiling such a constructor as an entry point gives inherited
    // constructor effects (events/state writes) no transaction block layout.
    if (contract.isAbstract
      || contract.constructorDef?.modifiers.includes(FunctionModifier.INTERNAL)) continue;
    if (requested && !requested.has(contract.name)) {
      profileLog('multi-skip', Date.now(), { primary: contract.name });
      continue;
    }
    // Re-parse + resolve fresh per contract (the per-contract pipeline mutates the AST); select it as primary.
    // Use the same complete pipeline as the single-artifact API.
    // The probe AST is the complete import graph. Cloning it (~25ms) is much cheaper than re-lexing
    // large Solidity sources for every imported primary (~650ms+). The last contract can consume the
    // probe itself; every other primary gets an isolated clone with itself selected.
    const contractStarted = Date.now();
    const parsedAst = contract === probe.contract ? probe : cloneAst(probe, 'multi-primary');
    if (contract !== probe.contract) setPrimaryContract(parsedAst, contract.name);
    map[contract.name] = compileStringUnchecked(code, {
      ...artifactCompilerOptions,
      errorListener,
      suppressWarnings,
      primaryContractName: contract.name,
      __parsedAst: parsedAst,
      ...(creationTargets.has(contract.name) ? { __framedConstantLock: true } : {}),
    } as CompileOptions);
    const compiled = map[contract.name];
    profileLog('multi-contract', contractStarted, {
      primary: contract.name,
      bytecodeBytes: compiled.debug?.bytecode ? compiled.debug.bytecode.length / 2 : undefined,
    });
  }

  // A direct caller here that calls one callee several times runs those calls in one spend of it: a contract here
  // implementing the interface it calls takes the multi-call entry, unless the options say otherwise.
  for (const name of repeatedDirectCallees(map, implementers)) {
    map[name] = compileStringUnchecked(code, {
      ...artifactCompilerOptions, callBatch: true, errorListener, suppressWarnings, primaryContractName: name,
    } as CompileOptions);
  }

  if (multiCacheKey) {
    compileMultiCache.set(multiCacheKey, map);
    diskMultiCacheSet(multiCacheKey, map);
  }
  return map;
}

/**
 * Per interface, the contracts implementing it: those naming it as a base, or declaring each of its methods by name
 * and parameter types. A contract called through its own type implements itself.
 */
function interfaceImplementers(
  interfaces: readonly InterfaceNode[], contracts: readonly ContractNode[],
): Map<string, string[]> {
  const signature = (fn: { name: string; parameters: readonly ParameterNode[] }): string =>
    `${fn.name}(${fn.parameters.map((parameter) => parameter.type.toString()).join(',')})`;
  const implementers = new Map(contracts.map((contract) => [contract.name, [contract.name]]));
  for (const iface of interfaces) {
    const methods = iface.functions.map(signature);
    implementers.set(iface.name, contracts.filter((contract) => contract.implements.includes(iface.name)
      || (methods.length > 0 && methods.every((method) => contract.functions.some((fn) => signature(fn) === method))))
      .map((contract) => contract.name));
  }
  return implementers;
}

/** The contracts compiled here without the multi-call entry whose interface a direct caller here calls several times. */
function repeatedDirectCallees(map: ArtifactMap, implementers: ReadonlyMap<string, readonly string[]>): string[] {
  const callees = new Set<string>();
  for (const artifact of Object.values(map)) {
    for (const call of artifact.abi.flatMap((fn) => fn.externalCalls ?? [])) {
      if (call.callOrdinal === undefined) continue;
      for (const name of implementers.get(call.interfaceName) ?? []) callees.add(name);
    }
  }
  return [...callees].filter((name) => map[name] !== undefined && map[name].callBatch === undefined);
}

type PlannedFunction = {
  name: string;
  parameters: number;
  closure: Set<string>;
  footprint: SplitStateFootprint;
};

type SplitHelperCutProfile = {
  name: string;
  returns: boolean;
  readsLocalState: boolean;
  writesState: boolean;
  externalCalls: boolean;
  sendsValue: boolean;
  unknown: boolean;
};

const LIFECYCLE_MODIFIERS = new Set([
  FunctionModifier.DEPLOY, FunctionModifier.UPGRADE, FunctionModifier.SELFDESTRUCT,
  FunctionModifier.SPLIT, FunctionModifier.MERGE, FunctionModifier.UNSAFE,
]);

/** Drop split-planning keys so a nested `compileString` does not see a mode it refuses. */
function stripSplitPlanning(options: CompilerOptions): CompilerOptions {
  const rest = { ...options } as CompilerOptions & {
    split?: unknown;
    maxShardBytes?: unknown;
    forceSplit?: unknown;
    rootFunctions?: unknown;
  };
  delete rest.split;
  delete rest.maxShardBytes;
  delete rest.forceSplit;
  delete rest.rootFunctions;
  return rest;
}

function splitModeOf(split: CompilerOptions['split']): 'off' | 'size' | 'func' {
  const mode = split ?? 'size';
  if (mode !== 'off' && mode !== 'size' && mode !== 'func') {
    throw new Error("split must be 'off', 'size', or 'func'");
  }
  return mode;
}

/**
 * The logical-contract event options of a split's shards, facets and root: set when the unsplit artifact, which the
 * SDK reads the split through, lists an event, or a body the probe holds emits one. The artifact decides an emit in a
 * library or free function, which sits in no contract body before inlining.
 */
function splitLogicalEventOptions(
  logical: Artifact, probe: Ast | undefined,
): Pick<InternalCompilerOptions, '__logicalContractEmitsEvent' | '__logicalContractEvents'> {
  const events = (logical.events ?? []).map((event) => event.signature);
  return events.length > 0 || (probe !== undefined && emitsAnyEvent(probe.contract))
    ? { __logicalContractEmitsEvent: true, __logicalContractEvents: events } : {};
}

/** Per-entry framed split. The size packer below is not used. */
function runFunctionSplit(code: string, compilerOptions: SplitCompileOptions): FunctionSplitBundle {
  const { errorListener } = compilerOptions;
  let probe: Ast | undefined;
  let logical: Artifact | undefined;
  return compileFunctionSplit({
    code,
    options: compilerOptions,
    host: {
      prepare(source, options) {
        probe = prepareSplitAst(
          source, normalizeCompilerOptions(stripSplitPlanning(options)), errorListener, compilerOptions.primaryContractName,
        );
        return probe;
      },
      compileMonolith(source, options) {
        logical = compileString(source, { ...stripSplitPlanning(options), errorListener });
        return logical;
      },
      compileParsed(source, options, ast, frameKinds) {
        // A contract the unit (or the project, through the option) creates: its shards carry no deployment slot.
        const creationTarget = probe !== undefined && new Set([
          ...framedCreationTargetsOf([...probe.importedContracts, probe.contract].filter(
            (contract): contract is ContractNode => contract !== undefined,
          )),
          ...(options.framedCreationTargets ?? []),
        ]).has(probe.contract.name);
        return compileStringUnchecked(source, {
          ...stripSplitPlanning(options),
          errorListener,
          __parsedAst: ast,
          __functionSplitPrepared: true,
          __functionSplitFrameKinds: frameKinds,
          ...(creationTarget ? { __framedConstantLock: true } : {}),
          ...(probe !== undefined && contractNamesTokenContainer(probe.contract)
            ? { __framedContractHoldsTokens: true } : {}),
          ...(logical === undefined ? {} : splitLogicalEventOptions(logical, probe)),
        } as InternalCompilerOptions);
      },
      cloneAst,
      byteSize,
      spendReserve(artifact, budgetWholeSpend) {
        return budgetWholeSpend ? widestSpendReserve(artifact, artifact.constructorInputs) : 0;
      },
      fingerprint(artifact) {
        return splitStateLayoutFingerprint(artifact.stateLayout);
      },
      assertLayouts: assertSplitLayoutsAgree,
      selectorHex: sourceFunctionSelectorHex,
      helperCuts(entry) {
        if (probe === undefined) return [];
        const byName = new Map<string, FunctionDefinitionNode[]>();
        for (const fn of probe.contract.functions) {
          (byName.get(fn.name) ?? byName.set(fn.name, []).get(fn.name)!).push(fn);
        }
        const cache = createFootprintAnalysisCache(new Set(
          probe.contract.stateVariables.map((state) => state.name),
        ));
        const plan: PlannedFunction = {
          name: entry.name,
          parameters: entry.parameters.length,
          closure: collectNamedFunctionClosure(entry, byName),
          footprint: analyseFunctionFootprint(entry, byName, cache),
        };
        const interfaceNames = new Set(probe.interfaceDefinitions.map((iface) => iface.name));
        return splitHelperCutProfiles(plan, byName, cache, probe.contract, interfaceNames);
      },
      cloneLogical(artifact) {
        return cloneArtifact(artifact);
      },
    },
  });
}

/**
 * Compile a contract into a statically-linked one-hop root/facet bundle, or into a framed per-entry bundle when
 * `split` is `'func'`. Ordinary compile entry points retain their existing Artifact return type and bytecode.
 * The splitter operates on fresh ASTs for every shard, so the normal mutating compiler pipeline remains isolated
 * per artifact. Omitting `split` keeps the size packer (`state-affinity-best-fit-v2`).
 */
export function compileStringSplit(
  code: string,
  options: SplitCompileOptions & CompileStringOptions & { split: 'func' },
): FunctionSplitBundle;
export function compileStringSplit(
  code: string,
  options: SplitCompileOptions & CompileStringOptions & { split: 'off' },
): Artifact;
export function compileStringSplit(
  code: string,
  options: SplitCompileOptions & CompileStringOptions & { split?: 'size' },
): SplitArtifactBundle;
export function compileStringSplit(
  code: string,
  options?: SplitCompileOptions & CompileStringOptions,
): Artifact | SplitArtifactBundle | FunctionSplitBundle;
export function compileStringSplit(
  code: string, options: SplitCompileOptions & CompileStringOptions = {},
): Artifact | SplitArtifactBundle | FunctionSplitBundle {
  refuseRemovedCompilerOptions(options);
  const compilerOptions: SplitCompileOptions = withFilesResolver(options);
  return runWithWarningListener(
    compilerOptions,
    () => compileStringSplitUnchecked(code, compilerOptions),
  );
}

function compileStringSplitUnchecked(
  code: string, compilerOptions: SplitCompileOptions,
): Artifact | SplitArtifactBundle | FunctionSplitBundle {
  const split = splitModeOf(compilerOptions.split);
  if (split === 'off') {
    return compileString(code, stripSplitPlanning(compilerOptions));
  }
  if (split === 'func') return runFunctionSplit(code, compilerOptions);
  if (compilerOptions.composition === 'framed') {
    throw new SolidcDiagnosticError(
      'SPLIT_SIZE_REFUSES_FRAMED',
      "split 'size' refuses composition 'framed'",
      { split: 'size', composition: 'framed' },
    );
  }
  const {
    maxShardBytes = MAX_INPUT_BYTESIZE, forceSplit = false, rootFunctions = [], errorListener,
    // The outer compile already installed it; it must not ride into the per-shard artifact options.
    // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
    warningListener: _warningListener,
    ...artifactOptions
  } = compilerOptions;
  // compileString refuses split 'size'; every compile below is an ordinary one.
  delete artifactOptions.split;
  // Budget the whole SPEND, not just the redeem script - but only against the real consensus cap. An explicit
  // `maxShardBytes` is a tuning knob expressed in redeem-script bytes and is honoured literally; the default is
  // the BCH per-input limit, which covers redeem script + constructor arguments + the call's own arguments +
  // the redeem push. Planning on redeem bytes alone against THAT cap emits bundles which pass every check made
  // here and are still unspendable (measured: a facet under the cap deployed at 10,030 bytes once its brand was
  // baked in, and the bundle's first spend was refused at consensus).
  const budgetWholeSpend = compilerOptions.maxShardBytes === undefined;
  const spendReserve = (artifact: Artifact, constructorInputs: readonly { type: string }[]): number => (
    budgetWholeSpend ? widestSpendReserve(artifact, constructorInputs) : 0);
  const merged = normalizeCompilerOptions(artifactOptions);
  const baseline = compileString(code, { ...artifactOptions, errorListener });
  // Split preparation is source-wide and independent of physical placement. Keep one template and clone it for
  // each candidate compilation; reparsing imports and re-expanding inheritance/modifiers for
  // every packing probe made split compilation scale with (candidate count * front-end cost).
  const probe = prepareSplitAst(code, merged, errorListener, compilerOptions.primaryContractName);
  Object.assign(merged, splitLogicalEventOptions(baseline, probe));
  const logicalName = probe.contract.name;
  const functions = probe.contract.functions;
  const byName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of functions) (byName.get(fn.name) ?? byName.set(fn.name, []).get(fn.name)!).push(fn);
  const interfaceNames = new Set(probe.interfaceDefinitions.map((iface) => iface.name));
  const overloadedEntries = [...byName.entries()].filter(([, defs]) => defs.filter((fn) => fn.isEntryPoint).length > 1);
  if (forceSplit && overloadedEntries.length > 0) {
    throw new Error(
      `Cannot split '${logicalName}': overloaded entry points require selector-keyed SDK routing: `
      + overloadedEntries.map(([name]) => name).join(', '),
    );
  }

  // Keep read-only selectors on the root for ordinary/forced splits. If the unsplit contract itself exceeds BCH
  // consensus capacity, they must become delegate-return facets too; otherwise an oversized query surface can
  // leave the forwarding root undeployable (BoringHelperV1).
  const moveReadOnlyEntries = byteSize(baseline) > maxShardBytes;
  // Split planning runs before semantic resolution of Solidity-compatible bare state identifiers. Give its
  // footprint survey the contract namespace so inherited helpers like ReentrancyGuard._nonReentrantBefore are
  // not misreported as effect-free cut candidates; the analyzer still excludes shadowing locals.
  const splitFootprintCache = createFootprintAnalysisCache(new Set(
    probe.contract.stateVariables.map((state) => state.name),
  ));
  const rootFunctionNames = new Set(rootFunctions);
  const plans = (baseline.stateLayout
    ? functions.filter((fn) => isMovableSplitEntry(fn, moveReadOnlyEntries)
      && !rootFunctionNames.has(fn.name)) : []).map((fn) => ({
    name: fn.name,
    parameters: fn.parameters.length,
    closure: collectNamedFunctionClosure(fn, byName),
    footprint: analyseFunctionFootprint(fn, byName, splitFootprintCache),
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
  // Every facet is deployed as a branded delegate library, so it always carries exactly one 32-byte brand.
  const measuredBytes = new Map<string, number>();
  const measuredArtifacts = new Map<string, Artifact>();
  const groupKey = (group: PlannedFunction[]): string => group.map((plan) => plan.name).sort().join(',');
  // The EFFECTIVE spend size, not the artifact size: redeem script + the brand a branded delegate library
  // always carries + the widest single entry point's own arguments. The cap covers all of it.
  const measure = (group: PlannedFunction[]): number => {
    const key = groupKey(group);
    const cached = measuredBytes.get(key);
    if (cached !== undefined) return cached;
    const artifact = compileFacet(probe, code, merged, group, 'ProbeFacet');
    const bytes = byteSize(artifact) + spendReserve(artifact, artifact.constructorInputs);
    measuredArtifacts.set(key, artifact);
    measuredBytes.set(key, bytes);
    return bytes;
  };
  // A hard-closure union is not the only way to satisfy a call edge between two planned entries. The caller's
  // facet needs the callee's BODY, not its entry-point arm - and the arm is the expensive half when the callee
  // takes dynamic parameters, because it carries selector dispatch and ABI decoding on top of the covenant.
  // `compileFacet` demotes a planned entry it did not receive to a plain internal helper, so dissolving an
  // oversized union into singletons keeps every call satisfiable while charging each facet only what it uses.
  // Only unions that DO NOT FIT are dissolved: a union that fits keeps its exact previous grouping and bytes,
  // and phase one immediately re-merges any dissolved pair that turns out to fit anyway.
  groups = groups.flatMap((group) => (
    group.length > 1 && measure(group) > maxShardBytes ? group.map((plan) => [plan]) : [group]
  ));
  // A singleton is an indivisible physical closure: every facet containing that entry must also contain this
  // body and its internal callees. Test these before the quadratic affinity search. Besides producing the useful
  // handler/closure diagnostic directly, this prevents a large contract with one impossible entry from spending
  // minutes compiling every larger pair even though none can remove bytes from the required closure.
  const overCapacityClosures: Array<{
    handlers: string[]; callChain: string[]; helperCuts: ReturnType<typeof splitHelperCutProfiles>;
    measured: number; redeemBytes: number; reserveBytes: number;
  }> = [];
  for (const group of [...groups].sort((a, b) => groupKey(a).localeCompare(groupKey(b)))) {
    if (group.length !== 1) continue;
    const measured = measure(group);
    if (measured <= maxShardBytes) continue;
    const artifact = measuredArtifacts.get(groupKey(group))!;
    const handlers = group.map((plan) => plan.name);
    const callChain = group.flatMap((plan) => [
      plan.name, ...[...plan.closure].filter((fn) => fn !== plan.name),
    ]);
    const helperCuts = splitHelperCutProfiles(
      group[0], byName, splitFootprintCache, probe.contract, interfaceNames,
    );
    overCapacityClosures.push({
      handlers, callChain, helperCuts, measured,
      redeemBytes: byteSize(artifact), reserveBytes: spendReserve(artifact, artifact.constructorInputs),
    });
  }
  if (overCapacityClosures.length > 0) {
    const first = overCapacityClosures[0];
    const remaining = overCapacityClosures.slice(1);
    throw new SolidcDiagnosticError(
      'SPLIT_CLOSURE_CAPACITY',
      `Cannot split '${logicalName}': indivisible closure '${first.handlers.join(', ')}' is `
        + `${first.measured} bytes (limit ${maxShardBytes}).`
        + (remaining.length > 0 ? ` Also over capacity: ${remaining.map((closure) =>
          `'${closure.handlers.join(', ')}' ${closure.measured} bytes`).join(', ')}.` : ''),
      {
        contractName: logicalName, facet: 'singleton',
        handlers: first.handlers, callChain: first.callChain, helperCuts: first.helperCuts,
        measured: first.measured, limit: maxShardBytes, overCapacityClosures,
      },
    );
  }
  // Pairwise best-fit is quadratic in physical compilations. Above this frontier, keep the already-valid hard
  // closure groups rather than spending minutes proving that optional combinations do not fit (UniswapV2Pair
  // has nine groups and 36 pairs, with two verifier passes per probe). This can produce more facets, never a
  // larger or semantically weaker one; every selected group is still measured against the consensus limit.
  const exhaustivePacking = groups.length <= 32;
  if (exhaustivePacking) {
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
  }

  // Four or more shards means one more co-spent input than the root plus two facets. The smallest facet is
  // often cheaper as ordinary root bodies: the root already spends one input, and those entries no longer need
  // a delegate of their own. Keep the move only when that rebuilt root still fits the whole-spend cap. An
  // explicit maxShardBytes is a redeem-script tuning knob; callers that set it are asking for that packing,
  // so the move is limited to the default consensus budget.
  if (budgetWholeSpend && groups.length >= 3) {
    const smallest = [...groups].sort((left, right) => measure(left) - measure(right)
      || groupKey(left).localeCompare(groupKey(right)))[0];
    const active = groups.filter((group) => group !== smallest);
    let trialRootFits = false;
    try {
      const trial = cloneAst(probe, 'split-root-resident');
      const trialRoutes = new Map<string, {
        facet: string; link: string; delegateEventOffsets?: number[];
        censusedCollectionSignatures?: string[];
      }>();
      active.forEach((group, index) => {
        const artifact = measuredArtifacts.get(groupKey(group));
        if (!artifact) return;
        const link = `__facetAddr_${index}`;
        for (const plan of group) {
          const handler = (artifact.abi as readonly AbiFunction[]).find((fn) => fn.name === plan.name);
          const layout = handler?.blockLayout;
          const dataOffsets = (layout?.slots ?? [])
            .filter((slot) => slot.kind === 'dataNft').map((slot) => slot.offset);
          const delegateEventOffsets = (layout?.slots ?? [])
            .filter((slot) => slot.kind === 'event' || slot.kind === 'eventChunk')
            .map((slot) => slot.offset - dataOffsets.filter((offset) => offset < slot.offset).length);
          const censusedCollectionSignatures = [...new Set([
            ...(handler?.sortedBatchInfo ?? []).map((batch) => {
              const signature = artifact.stateLayout?.collections?.find(
                (collection) => collection.name === batch.collection,
              )?.signature;
              if (signature === undefined) {
                throw new Error(`Missing split-delegate collection signature for '${batch.collection}'`);
              }
              return signature;
            }),
            ...(handler?.dynamicWrites ?? []).map((name) => {
              const variable = artifact.stateLayout?.variables?.find(
                (candidate) => candidate.name === name && candidate.dynamic === true,
              );
              if (variable === undefined) {
                throw new Error(`Missing split-delegate dynamic-array signature for '${name}'`);
              }
              return dynamicChunkSignature(name, variable.type);
            }),
          ])];
          trialRoutes.set(plan.name, {
            facet: `${logicalName}__Facet${index}`,
            link,
            ...(delegateEventOffsets.length > 0 && { delegateEventOffsets }),
            ...(censusedCollectionSignatures.length > 0 && { censusedCollectionSignatures }),
          });
        }
      });
      prepareSplitRoot(trial.contract, trialRoutes, compilerOptions.evmCompat === true, compilerOptions.addressForm);
      trial.contract.implements = [];
      trial.contract.parentInvocations = [];
      for (const fn of trial.contract.functions) {
        fn.overrideBases = [];
        fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.OVERRIDE);
      }
      const trialOptions = { ...merged };
      const trialRoot = compileResolvedAst(
        trial, code, trialOptions, false, true,
      );
      const trialLimit = maxShardBytes - spendReserve(trialRoot, trialRoot.constructorInputs);
      trialRootFits = byteSize(trialRoot) <= trialLimit;
    } catch {
      // The root-resident attempt did not compile. The facet partition below still fits.
      trialRootFits = false;
    }
    if (trialRootFits) groups = active;
  }

  const facets: ArtifactMap = {};
  const facetRecords: Array<{ name: string; link: string; plans: PlannedFunction[]; artifact: Artifact }> = [];
  groups.sort((a, b) => a.map((p) => p.name).join(',').localeCompare(b.map((p) => p.name).join(',')));
  groups.forEach((group, index) => {
    const name = `${logicalName}__Facet${index}`;
    const measured = measuredArtifacts.get(groupKey(group));
    const artifact = measured ? cloneArtifact(measured) : compileFacet(probe, code, merged, group, name);
    // The synthetic facet name is metadata only (the branded bytecode and constructor shape are identical), so a
    // measured ProbeFacet can be reused instead of recompiling the exact same AST solely to change this label.
    artifact.contractName = name;
    const facetBytes = byteSize(artifact) + spendReserve(artifact, artifact.constructorInputs);
    if (facetBytes > maxShardBytes) {
      const handlers = group.map((plan) => plan.name);
      const callChain = group.flatMap((plan) => [plan.name, ...[...plan.closure].filter((fn) => fn !== plan.name)]);
      const helperCuts = group.flatMap((plan) => splitHelperCutProfiles(
        plan, byName, splitFootprintCache, probe.contract, interfaceNames,
      ));
      throw new SolidcDiagnosticError(
        'SPLIT_CLOSURE_CAPACITY',
        `Cannot split '${logicalName}': facet '${name}' is ${facetBytes} bytes `
          + `(limit ${maxShardBytes}); closure: ${handlers.join(', ')}.`,
        {
          contractName: logicalName, facet: name, handlers, callChain, helperCuts,
          measured: facetBytes, limit: maxShardBytes,
        },
      );
    }
    facets[name] = artifact;
    facetRecords.push({ name, link: `__facetAddr_${index}`, plans: group, artifact });
  });

  // Candidate compilation is complete, so the prepared template can become the root directly rather than paying
  // for one final full-contract clone. Every facet was compiled from an isolated clone and restored the template.
  const rootAst = probe;
  const routeByName = new Map<string, {
    facet: string; link: string; delegateEventOffsets?: number[];
    censusedCollectionSignatures?: string[];
  }>();
  for (const facet of facetRecords) for (const plan of facet.plans) {
    const handler = (facet.artifact.abi as readonly AbiFunction[]).find((fn) => fn.name === plan.name);
    const layout = handler?.blockLayout;
    const dataOffsets = (layout?.slots ?? [])
      .filter((slot) => slot.kind === 'dataNft').map((slot) => slot.offset);
    const delegateEventOffsets = (layout?.slots ?? [])
      .filter((slot) => slot.kind === 'event' || slot.kind === 'eventChunk')
      .map((slot) => slot.offset - dataOffsets.filter((offset) => offset < slot.offset).length);
    // A sorted batch emits both exact collection-address input and output scans in the facet, and a dynamic-array
    // write emits its chunk run. The root may leave these families out of its global mutable-NFT equality; the
    // facet settles their count.
    const censusedCollectionSignatures = [...new Set([
      ...(handler?.sortedBatchInfo ?? []).map((batch) => {
        const signature = facet.artifact.stateLayout?.collections?.find(
          (collection) => collection.name === batch.collection,
        )?.signature;
        if (signature === undefined) {
          throw new Error(`Missing split-delegate collection signature for '${batch.collection}'`);
        }
        return signature;
      }),
      ...(handler?.dynamicWrites ?? []).map((name) => {
        const variable = facet.artifact.stateLayout?.variables?.find(
          (candidate) => candidate.name === name && candidate.dynamic === true,
        );
        if (variable === undefined) {
          throw new Error(`Missing split-delegate dynamic-array signature for '${name}'`);
        }
        return dynamicChunkSignature(name, variable.type);
      }),
    ])];
    routeByName.set(plan.name, {
      facet: facet.name,
      link: facet.link,
      ...(delegateEventOffsets.length > 0 && { delegateEventOffsets }),
      ...(censusedCollectionSignatures.length > 0 && { censusedCollectionSignatures }),
    });
  }
  prepareSplitRoot(rootAst.contract, routeByName, compilerOptions.evmCompat === true, compilerOptions.addressForm);
  // `rootAst` is also the already-flattened logical contract. Its second compiler pass must not interpret
  // source-only override base lists against the now-empty concrete-base list.
  rootAst.contract.implements = [];
  rootAst.contract.parentInvocations = [];
  for (const fn of rootAst.contract.functions) {
    fn.overrideBases = [];
    fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.OVERRIDE);
  }
  // A split root's mutating entries are delegate forwarders. Keep every ordinary ABI selector and one-hop
  // forwarder; facet bodies retain their normal external-call lowering.
  const rootOptions = { ...merged };
  const root = compileResolvedAst(
    rootAst, code, rootOptions, false, true,
  );
  const rootShardBytes = maxShardBytes - spendReserve(root, root.constructorInputs);
  if (byteSize(root) > rootShardBytes) {
    throw new SolidcDiagnosticError(
      'SPLIT_ROOT_CAPACITY',
      `Cannot split '${logicalName}': generated root is ${byteSize(root)} bytes (limit ${maxShardBytes}).`,
      {
        contractName: logicalName,
        handlers: plans.map((plan) => plan.name),
        callChain: plans.flatMap((plan) => [plan.name, ...[...plan.closure].filter((fn) => fn !== plan.name)]),
        measured: byteSize(root),
        limit: maxShardBytes,
      },
    );
  }

  assertSplitLayoutsAgree(logicalName, root, facetRecords, baseline);

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

/**
 * Describe the internal call boundaries an oversized physical closure could eventually cut across.
 *
 * This is deliberately analysis only: split-v1 is a one-hop delegate topology, so moving even a pure helper to
 * another script needs authenticated argument/result transport, and moving a stateful helper additionally needs
 * a root-owned continuation journal. Publishing the transitive footprint in the capacity diagnostic lets a
 * future protocol select sound candidates without inferring safety from source names or a particular corpus.
 */
function splitHelperCutProfiles(
  plan: PlannedFunction,
  byName: Map<string, FunctionDefinitionNode[]>,
  footprintCache: ReturnType<typeof createFootprintAnalysisCache>,
  contract: ContractNode,
  interfaceNames: ReadonlySet<string>,
): SplitHelperCutProfile[] {
  const hasTypedExternalCall = (helper: FunctionDefinitionNode): boolean => {
    const receiverType = (type: Type): boolean => type instanceof AddressType
      && type.interfaceName !== undefined;
    const initialReceivers = new Map([
      ...contract.parameters, ...contract.stateVariables, ...helper.parameters,
    ].map((declaration) => [declaration.name, receiverType(declaration.type)]));
    const seen = new Set<Node>();
    const visit = (node: Node, receivers: Map<string, boolean>): boolean => {
      if (seen.has(node)) return false;
      seen.add(node);
      if (node instanceof BlockNode) {
        const blockReceivers = new Map(receivers);
        return (node.statements ?? []).some((statement) => visit(statement, blockReceivers));
      }
      if (node instanceof VariableDefinitionNode) {
        if (node.expression && visit(node.expression, receivers)) return true;
        receivers.set(node.name, receiverType(node.type));
        return false;
      }
      if (node instanceof TryCatchNode) {
        return visit(node.expression, receivers) || visit(node.tryBlock, receivers);
      }
      if (node instanceof FunctionCallNode) {
        const [receiver, method] = node.identifier.name.split('.', 2);
        if (method && receivers.get(receiver) === true
          && !['call', 'staticcall', 'delegatecall'].includes(method)) return true;
      }
      if (node instanceof MethodCallNode) {
        const object = node.object;
        if ((object instanceof IdentifierNode && receivers.get(object.name) === true
          && !['call', 'staticcall', 'delegatecall'].includes(node.methodName))
          || (object instanceof CastNode && receiverType(object.type))
          || (object instanceof FunctionCallNode && interfaceNames.has(object.identifier.name))) return true;
      }
      for (const [key, child] of Object.entries(node)) {
        if (['resolvedFunction', 'functionReference', 'definition', 'symbolTable', 'referencedContract',
          'stateVariable', 'collection', 'type', 'location', 'name', 'functionId', 'error',
          'opRolls', 'selectorHex', 'abiType'].includes(key)) continue;
        if (child instanceof Node && visit(child, receivers)) return true;
        if (Array.isArray(child) && child.some((item) => item instanceof Node && visit(item, receivers))) {
          return true;
        }
      }
      return false;
    };
    return helper.body !== undefined && visit(helper.body, initialReceivers);
  };
  const hasTransitiveTypedExternalCall = (helper: FunctionDefinitionNode): boolean => {
    // The pre-semantic footprint walker cannot recognize every typed receiver until lowering. A cut moves the
    // helper's whole internal closure, so inspecting only its own body would label a forwarding helper pure even
    // when the callee performs a foreign call.
    for (const name of collectNamedFunctionClosure(helper, byName, footprintCache.directCalls)) {
      for (const candidate of byName.get(name) ?? []) {
        if (hasTypedExternalCall(candidate)) return true;
      }
    }
    return false;
  };
  const profiles = new Map<string, SplitHelperCutProfile>();
  for (const name of plan.closure) {
    if (name === plan.name) continue;
    for (const helper of byName.get(name) ?? []) {
      if (helper.isEntryPoint) continue;
      const footprint = analyseFunctionFootprint(helper, byName, footprintCache);
      const key = `${helper.name}(${helper.parameters.map((parameter) => parameter.type.toString()).join(',')})`;
      profiles.set(key, {
        name: key,
        returns: helper.returnTypes.length > 0,
        readsLocalState: footprint.reads.some((resource) =>
          resource.startsWith('state:') || resource.startsWith('collection:')),
        writesState: footprint.writes.length > 0,
        externalCalls: footprint.effects.includes('external-call') || hasTransitiveTypedExternalCall(helper),
        sendsValue: footprint.effects.includes('value'),
        unknown: footprint.unknown,
      });
    }
  }
  return [...profiles.values()].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * X149. The SPLIT PLANNER'S RULER, in bytes. `artifact.bytecode` is `scriptToAsm(script)` - a listing, not a
 * script - so `.length / 2` was half a character count and every packing decision here was taken against an
 * OVERSTATED length: measured 32,432 against a real 30,981 on a large contract, and 1,332 against 283 on a small
 * stateful contract. The direction is the one that hurts: a union whose real bytes fit was refused, `maxShardBytes`
 * bit early, and `estimatedRedeemBytes` was published to the deployer wrong. Nothing about the packing algorithm
 * changes; it is now measuring what it always meant to.
 */
function byteSize(artifact: Artifact): number { return asmToBytecode(artifact.bytecode).length; }

/**
 * Bytes a shard's constructor arguments and its redeem push add on top of the redeem SCRIPT.
 *
 * The per-input cap covers the WHOLE unlocking bytecode - redeem script, constructor arguments, the call's own
 * arguments and the redeem push - so planning on `byteSize` alone emits bundles that pass every check made
 * here and are still unspendable. Observed: a facet whose artifact measured under the cap deployed at 10,030
 * bytes once its brand was baked in, and the bundle's first spend was refused at consensus.
 *
 * Conservative by type, because the values are not known at plan time. The call's own arguments are NOT
 * included - they vary per entry point - so this remains a lower bound, just a much tighter one.
 */
function constructorArgReserve(inputs: readonly { type: string }[]): number {
  const widest = (type: string): number => {
    if (/^bytes(\d+)$/.test(type)) return Number(/^bytes(\d+)$/.exec(type)![1]);
    if (type === 'address') return 35;            // p2sh32 locking bytecode, the widest form
    if (type === 'pubkey') return 33;
    if (type === 'sig' || type === 'datasig') return 72;
    if (type === 'bool') return 1;
    if (/^u?int\d*$/.test(type)) return 32;
    return 40;                                    // string/bytes/unknown: a deliberate over-estimate
  };
  // +1 per argument for its push opcode, +2 overall for the redeem script's own OP_PUSHDATA1 header.
  return inputs.reduce((total, input) => total + widest(input.type) + 1, 0) + 2;
}

/**
 * The widest unlocking bytecode any single entry point of `artifact` can require, on top of its redeem script:
 * its own arguments plus whatever constructor arguments the shard carries. Internal `__internal__*` parameters
 * are witness values the SDK supplies and count the same as visible ones.
 */
function widestSpendReserve(artifact: Artifact, constructorInputs: readonly { type: string }[]): number {
  const perEntry = artifact.abi.map((fn) => constructorArgReserve(fn.inputs));
  return constructorArgReserve(constructorInputs) + (perEntry.length > 0 ? Math.max(...perEntry) : 0);
}

/**
 * A SHARD IS ONLY A SHARD IF IT AGREES ABOUT WHAT A SLOT MEANS. Nothing here compared the root's storage
 * layout against its facets': the manifest fingerprint was taken from the unsplit BASELINE and never checked
 * against anything the bundle actually contains. Two orderings in the split path are shard-dependent -
 * `LowerStorageSlotPointers` appends one hidden state variable per ERC-7201 namespace in the order the
 * SURVIVING functions first reach it, and `prepareSplitAst` ran `SynthesizeBlockOracle` earlier than the
 * ordinary pipeline does - so a real OZ-upgradeable contract produced a root, six facets and a manifest with
 * FOUR different layouts, where facet slot 2.0 is `PausableStorage___paused` and root slot 2.0 is
 * `OwnableStorage___owner`. That bundle compiles clean and every shard fits; a spend of it writes the wrong
 * variable, and X162 BUILT that spend: with only the facet's published layout replaced, `touchC(9)` settles
 * and lands 9 in `AStorage__a`. Every check on this - here, the SDK's bundle fingerprint, and the SDK's
 * delegate-layout rule - is metadata; none is consensus. So the fix is that `prepareSplitAst` now runs both
 * appending passes on the complete function set, and this stays as the fail-closed backstop for any pass that
 * starts appending shard-dependently again (foreign function-pointer array lowering still could).
 */
export function assertSplitLayoutsAgree(
  name: string, root: Artifact, facets: Array<{ name: string; artifact: Artifact }>, baseline: Artifact,
): void {
  const slots = (artifact: Artifact): string[] =>
    (artifact.stateLayout?.variables ?? []).map((v: any) => `${v.name}@${v.nftIndex}.${v.fieldIndex}`);
  const rootSlots = slots(root);
  const firstDivergence = (other: string[]): string | undefined => {
    const width = Math.max(rootSlots.length, other.length);
    for (let i = 0; i < width; i++) if (rootSlots[i] !== other[i]) return `root has ${rootSlots[i] ?? '(none)'}, `
      + `it has ${other[i] ?? '(none)'}`;
    return undefined;
  };
  for (const facet of facets) {
    const divergence = firstDivergence(slots(facet.artifact));
    if (divergence) {
      throw new SolidcDiagnosticError(
        'SPLIT_LAYOUT_CONFLICT',
        `Cannot split '${name}': facet '${facet.name}' does not share the root's storage layout `
          + `(${divergence}). A delegate facet writes the root's state through physical slots, so a spend would `
          + 'write the wrong variable.',
        { contractName: name, facet: facet.name, callChain: [name, facet.name], divergence },
      );
    }
  }
  const baselineDivergence = firstDivergence(slots(baseline));
  if (baselineDivergence) {
    throw new SolidcDiagnosticError(
      'SPLIT_LAYOUT_CONFLICT',
      `Cannot split '${name}': the generated root does not share the unsplit contract's storage `
        + `layout (${baselineDivergence}). The published state layout would not describe the deployed bundle.`,
      { contractName: name, facet: 'root', callChain: [name, 'root'], divergence: baselineDivergence },
    );
  }
}
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

function isMovableSplitEntry(fn: FunctionDefinitionNode, includeReadOnly = false): boolean {
  return fn.isEntryPoint && !fn.name.startsWith('__') && !fn.isFallback && !fn.isReceive
    && (includeReadOnly || (!fn.modifiers.includes(FunctionModifier.VIEW)
      && !fn.modifiers.includes(FunctionModifier.PURE)))
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
  primaryContractName: string | undefined,
): Ast {
  // The split is of the contract the compile names, as the monolith it is checked against is.
  let ast = parseAndResolve(code, options, listener, primaryContractName);
  if (!(rootSourceCoversProgram(ast) && !code.includes('using '))) {
    ast = ast.accept(new RedesugarImportedUsingForCalls(true)) as Ast;
  }
  if (ast.contract.parentInvocations.length > 0 || ast.contract.implements.length > 0) {
    ast = expandInheritance(ast);
  }
  // Preserve source-level external return boundaries before facet planning demotes those entries to public
  // delegate functions. The ordinary compile runs this pass too; it is idempotent on prepared shards.
  ast = ast.accept(new OptimizeFixedArrayValues()) as Ast;
  // X169. The THIRD shard-dependent state-appending pass, and the one X162 recorded rather than built. Its
  // classification is usage-driven - a table whose writes name two methods is VARYING and gets a parallel
  // `bytes[] __fnsel_<name>` state variable, one whose surviving writes name one method is FIXED and gets none -
  // so running it per-shard gave a facet a DIFFERENT PHYSICAL SLOT MEANING than the root's: measured on a
  // two-table contract, root slot 0.2 is `__fnsel_p` where the facet holding only the fixed-classified writes
  // puts `q`. A delegate facet writes the root's state through physical slots, so that is the X162 wrong-variable
  // write with a different author. Running it here, on the complete function set, makes the decision one decision.
  // Position matches the ordinary pipeline's (after inheritance, BEFORE modifier expansion), so the root also
  // agrees with the unsplit baseline, which classifies from the same pre-expansion bodies.
  ast = ast.accept(new LowerForeignFunctionPointerArrayElements()) as Ast;
  if (ast.contract.modifierDefinitions.length > 0
    || ast.libraryModifierDefinitions.length > 0
    || ast.contract.functions.some((fn) => fn.customModifiers.length > 0)
    || (ast.contract.constructorDef?.customModifiers.length ?? 0) > 0) {
    ast = expandModifiers(ast);
  }
  // X162. Both remaining state-appending passes are SHARD-DEPENDENT and must therefore run here, on the
  // complete function set, before `compileFacet` filters it. `LowerStorageSlotPointers` appends one hidden
  // state variable per ERC-7201 namespace in the order the SURVIVING functions first reach it, so running it
  // per-shard gave the root, its facets and the manifest three different physical layouts of the same state.
  // The relative order with the block oracle matches the ordinary pipeline (slot pointers first), so the root
  // also agrees with the unsplit baseline. Both passes are idempotent once their source metadata is consumed,
  // so the ordinary pipeline's later invocations are no-ops on this AST.
  if (!(rootSourceCoversProgram(ast) && !code.includes('assembly'))) {
    ast = ast.accept(new LowerStorageSlotPointers()) as Ast;
  }
  // Sharding must happen after storage-shaping synthesis. A block.* read stays a read of a pool coin; the pass
  // marks the function and injects no state. Running it on the complete function set
  // keeps that mark on the same functions the unsplit pipeline marks.
  if (!(rootSourceCoversProgram(ast) && !code.includes('block.') && !code.includes('now'))) {
    ast = ast.accept(new SynthesizeBlockOracle(
      options.evmCompat ?? false,
      options.autoDelegate === true,
    )) as Ast;
  }
  return ast;
}

function compileFacet(prepared: Ast, code: string, options: CompilerOptions,
  plans: PlannedFunction[], facetName: string): Artifact {
  const keep = new Set(plans.flatMap((p) => [...p.closure]));
  // Clone only the physical closure this facet can retain. Cloning the complete logical function surface and
  // filtering afterward made every packing probe copy all omitted bodies, which is especially costly for the
  // large imported contracts that need splitting in the first place. The template projection is synchronous and
  // restored before any compiler pass sees it; every returned node still belongs exclusively to this candidate.
  const preparedContract = prepared.contract;
  const completeFunctions = preparedContract.functions;
  const completeConstructor = preparedContract.constructorDef;
  let ast: Ast;
  try {
    preparedContract.functions = completeFunctions.filter((fn) => keep.has(fn.name));
    preparedContract.constructorDef = undefined;
    ast = cloneAst(prepared, `facet:${facetName}`);
  } finally {
    preparedContract.functions = completeFunctions;
    preparedContract.constructorDef = completeConstructor;
  }
  const contract = ast.contract;
  // Derive getter declarations on a clone so the getter pass cannot rewrite the retained handler bodies before
  // the ordinary facet pipeline. These declarations exist only for self-typed external-call resolution.
  const getterProbe = cloneNode(contract);
  const sourceFunctionCount = getterProbe.functions.length;
  const getterProbeAst = new SourceFileNode(getterProbe);
  // The getter visitor mutates every imported contract it visits. A circular Solidity import can put the
  // logical primary back into importedContracts by identity; passing the live list here would synthesize a
  // mapping getter directly into this facet after planning, without a physical entry-slot layout. The probe
  // needs only imported contract NAMES to recognize contract-typed address getters, so carry name-only interfaces.
  getterProbeAst.interfaceDefinitions = [
    ...ast.interfaceDefinitions,
    ...ast.importedContracts.map((imported) => new InterfaceNode(imported.name, [], [], [])),
  ];
  getterProbeAst.accept(new SynthesizePublicGetters(options.evmCompat ?? false));
  const getterDeclarations = getterProbe.functions.slice(sourceFunctionCount);
  if (getterDeclarations.length > 0) {
    ast.interfaceDefinitions.push(new InterfaceNode(contract.name, [], [], getterDeclarations.map((getter) =>
      new InterfaceFunctionNode(
        getter.name,
        getter.parameters.map((parameter) => new ParameterNode(parameter.type, parameter.name)),
        getter.returnTypes,
        'view',
      ))));
  }
  // Keep the logical name through semantic rebuilding. Solidity self-typed fields and calls such as
  // `Pair masterContract; masterContract.swappers(x)` resolve against this name; the physical facet name is
  // artifact metadata and is applied after compilation.
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
  // Public getters are synthesized later than split planning. Without suppressing them here, every facet silently
  // regains every public state/collection/constant getter after its function set was filtered, publishing
  // unrelated selectors on every shard. The logical root keeps all getters and their ABI routes; a facet contains
  // only the entries assigned to it and their call closure.
  contract.flattenedPublicStructGetters = [];
  // `prepareSplitAst` has already flattened inheritance and resolved every explicit override list. Facets have no
  // Solidity base list, so retaining e.g. OZ's `override(Nonces)` would make the idempotent inheritance pass reject
  // already-resolved source metadata.
  for (const resolved of [contract, ...ast.importedContracts]) {
    for (const fn of resolved.functions) {
      fn.overrideBases = [];
      fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.OVERRIDE);
    }
  }
  const planned = new Set(plans.map((p) => `${p.name}/${p.parameters}`));
  // Match the planned entry by name and arity. An internal overload kept in the name closure must stay
  // internal; promoting every function of that name would publish it as a delegate.
  for (const fn of contract.functions) if (planned.has(`${fn.name}/${fn.parameters.length}`)) {
    fn.modifiers = fn.modifiers.filter((m) => ![
      FunctionModifier.INTERNAL, FunctionModifier.PRIVATE, FunctionModifier.EXTERNAL, FunctionModifier.PUBLIC,
      FunctionModifier.PURE, FunctionModifier.VIEW, FunctionModifier.DELEGATE,
    ].includes(m));
    fn.modifiers.push(FunctionModifier.PUBLIC, FunctionModifier.DELEGATE);
  } else if (fn.isEntryPoint) {
    // Any entry that is only KEPT here - including a root-owned view such as UniswapV2Pair.getReserves - is
    // reachable in this facet solely through an internal call from one of `plans`. Emitting its entry-point arm
    // as well would charge this facet for selector dispatch and ABI decoding it can never use. Demote it to a
    // plain internal helper; the body, and every modifier already expanded into it, is untouched. The logical
    // root retains its real selector.
    fn.modifiers = fn.modifiers.filter((m) => ![
      FunctionModifier.EXTERNAL, FunctionModifier.PUBLIC, FunctionModifier.DELEGATE,
    ].includes(m));
    fn.modifiers.push(FunctionModifier.INTERNAL);
  }
  contract.isSplitFacet = true;
  // A facet compiles through the complete compiler, like any contract.
  const artifact = compileStringUnchecked(code, { ...options, __parsedAst: ast } as InternalCompilerOptions);
  const facetInputs = artifact.constructorInputs.filter((input) => input.name !== ORACLE_POOL_PARAMETER);
  if (!artifact.isLibrary || !artifact.brandedLibrary
    || facetInputs.length !== 1 || facetInputs[0].name !== '__brand') {
    throw new Error(`Split facet '${facetName}' lost its projected branded-library compilation context`);
  }
  artifact.contractName = facetName;
  artifact.delegateOnly = true;
  return artifact;
}

function prepareSplitRoot(contract: ContractNode, routes: Map<string, {
  facet: string; link: string; delegateEventOffsets?: number[]; censusedCollectionSignatures?: string[];
}>, evmCompat = false, addressForm?: CompilerOptions['addressForm']): void {
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
    fn.splitDelegateEventOffsets = route.delegateEventOffsets;
    fn.splitDelegateCensusedCollectionSignatures = route.censusedCollectionSignatures;
    const wasReadOnly = fn.modifiers.includes(FunctionModifier.VIEW)
      || fn.modifiers.includes(FunctionModifier.PURE);
    // A split delegate implementation is flattened into a directly state-holding root by deployProxy. Its root
    // forwarder therefore becomes an ordinary covenant entry, while the facet remains `delegate`: root -> facet
    // is one delegate hop, avoiding the unsupported proxy -> implementation -> facet nested-delegate topology.
    fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.DELEGATE);
    fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.VIEW
      && modifier !== FunctionModifier.PURE);
    for (const param of fn.parameters) param.syntheticallyUsed = true;
    const visibleParams = fn.parameters.filter((p) => !p.name.startsWith('__internal__'));
    const signature = evmCompat
      ? canonicalSelectorSignature(fn.name, visibleParams.map((p) => p.type))
      : computeFunctionSignature(fn.name, visibleParams.map((p) => p.type.toString()));
    const target = new IdentifierNode(route.link); target.location = fn.location;
    const data = new HexLiteralNode(computeFunctionSelector(signature, evmCompat)); data.location = fn.location;
    if (fn.returnTypes.length === 0 || !wasReadOnly) {
      const call = new LowLevelCallStatementNode(target, data, 'delegatecall'); call.location = fn.location;
      call.synthesizedFromLibraryCall = true;
      const truth = new BoolLiteralNode(true); truth.location = fn.location;
      const guard = new RequireNode(truth); guard.location = fn.location;
      fn.body = new BlockNode([call, guard]); fn.body.location = fn.location;
      // A mutating facet owns the value computation and return-event covenant.
      // Keep the root's declared return types so its published physical layout
      // still reserves that channel, but do not attempt to decode an in-memory
      // return buffer from an independent BCH input.
      if (fn.returnTypes.length > 0) fn.splitDelegateReturnForwarder = true;
    } else {
      const call = new LowLevelCallNode(target, data, 'delegatecall'); call.location = fn.location;
      call.synthesizedFromLibraryCall = true;
      const okName = `__split_ok_${fn.name}`;
      const dataName = `__split_data_${fn.name}`;
      const capture = new TupleAssignmentNode([
        { name: okName, type: PrimitiveType.BOOL, existing: false },
        { name: dataName, type: new BytesType(), existing: false },
      ], call, true);
      capture.location = fn.location;
      const ok = new IdentifierNode(okName); ok.location = fn.location;
      const guard = new RequireNode(ok); guard.location = fn.location;
      const bytes = new IdentifierNode(dataName); bytes.location = fn.location;
      const decode = new AbiDecodeNode(bytes, fn.returnTypes); decode.location = fn.location;
      decode.trustedEncoding = true;
      // The facet returns in the wire its entry publishes, which carries an address result whole under 'bytecode'.
      decode.resultWire = externalResultEncoding(
        fn.returnTypes, { evmCompat, ...(addressForm === undefined ? {} : { addressForm }) },
      );
      let returnStatement: ReturnNode;
      const statements: StatementNode[] = [capture, guard];
      if (fn.returnTypes.length === 1) {
        returnStatement = new ReturnNode([decode]); returnStatement.location = fn.location;
      } else {
        const names = fn.returnTypes.map((_, index) => `__split_ret_${fn.name}_${index}`);
        const decoded = new TupleAssignmentNode(names.map((name, index) => ({
          name, type: fn.returnTypes[index], existing: false,
        })), decode, true);
        decoded.location = fn.location;
        statements.push(decoded);
        const results = names.map((name) => {
          const id = new IdentifierNode(name); id.location = fn.location; return id;
        });
        returnStatement = new ReturnNode(results); returnStatement.location = fn.location;
      }
      statements.push(returnStatement);
      fn.body = new BlockNode(statements); fn.body.location = fn.location;
    }
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
function generateInterfaceArtifact(
  ast: Ast, interfaceName: string, code: string, compilerOptions: CompilerOptions,
): Artifact {
  const savedLibraryName = ast.libraryName;
  ast.libraryName = interfaceName;
  try {
    return generateDeclarationArtifact(ast, code, compilerOptions);
  } finally {
    ast.libraryName = savedLibraryName;
  }
}

/**
 * Folds `keccak256(type(C).creationCode)` in the expressions a contract publishes for its external calls.
 *
 * The routing a builder evaluates is serialized before the referenced contracts are compiled, so the creation code
 * of a child is not yet known there and the serializer marks it (`creationCodeOf`). Once the children are compiled,
 * each such hash is the digest of the child's program, which is what code generation folds the body's own hash to.
 */
function foldPublishedCreationCodeHashes(contract: ContractNode, compiledBytecodes: ReadonlyMap<string, Uint8Array>): void {
  const fold = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(fold);
    if (value === null || typeof value !== 'object' || value instanceof Node || value instanceof Uint8Array) return value;
    const record = value as Record<string, unknown>;
    const args = record.args;
    if (record.kind === 'call' && record.name === 'keccak256' && Array.isArray(args) && args.length === 1) {
      const child = (args[0] as { creationCodeOf?: unknown } | undefined)?.creationCodeOf;
      const bytes = typeof child === 'string' ? compiledBytecodes.get(child) : undefined;
      if (bytes !== undefined) {
        return { kind: 'literal', type: 'bytes32', value: binToHex(Uint8Array.from(keccak_256(bytes))) };
      }
    }
    for (const key of Object.keys(record)) {
      const folded = fold(record[key]);
      if (folded !== record[key]) record[key] = folded;
    }
    return record;
  };
  for (const fn of [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions]) {
    for (const slot of fn?.externalCalls ?? []) fold(slot);
  }
}

/**
 * The genesis a framed creating body replays for a child of this unit, by name: its constructor folded with the
 * creator as `msg.sender`, then the initializer the creator calls on it over the creator's arguments.
 */
function framedGenesisReplayer(ast: Ast, compilerOptions: CompilerOptions): FramedGenesisReplayer {
  const contracts = new Map(ast.importedContracts.map((contract) => [contract.name, contract]));
  const contractTypes = new Set([
    ...ast.importedContracts.map((contract) => contract.name),
    ...(ast.contract ? [ast.contract.name] : []),
    ...ast.interfaceDefinitions.map((iface) => iface.name),
  ]);
  return (contractName, initializer) => {
    const child = contracts.get(contractName);
    if (child === undefined) {
      throw new SolidcDiagnosticError(
        'FRAMED_CODEGEN_UNAVAILABLE',
        `a framed creator replays the genesis of the "${contractName}" it creates, which this compile unit does not `
        + 'hold apart from the creator',
        { requested: 'framed', reason: 'create2-genesis-replay', contract: contractName },
      );
    }
    const visible = (fn: FunctionDefinitionNode): number => fn.parameters
      .filter((parameter) => !parameter.name.startsWith('__internal__')).length;
    const callee = initializer === undefined ? undefined : child.functions.find((fn) =>
      fn.name === initializer.functionName && visible(fn) === initializer.args.length);
    if (initializer !== undefined && callee === undefined) {
      throw new SolidcDiagnosticError(
        'FRAMED_CODEGEN_UNAVAILABLE',
        `a framed creator folds "${contractName}.${initializer.functionName}" into the child's genesis, and the child `
        + `declares no "${initializer.functionName}" of ${initializer.args.length} parameters`,
        { requested: 'framed', reason: 'create2-genesis-replay', contract: contractName },
      );
    }
    return framedChildGenesisReplay({
      child,
      compilerOptions,
      ...(callee === undefined ? {} : { initializer: { callee, args: initializer!.args } }),
      isContractType: (name) => contractTypes.has(name),
    });
  };
}

/**
 * Compile the contracts the primary creates or embeds (`new C(...)`, `type(C).creationCode`).
 * Returns a map of contract name -> compiled bytecode.
 *
 * Each one is the bytes of its own standalone compile: the source compiled with that contract selected as the
 * primary and the public options the outermost compile was given. A factory's covenant pins the child output to
 * these bytes, and the SDK predicts a create2/deployFrom address from the child artifact a standalone compile
 * produces, so the two have to be one program. The shorter pass list below still analyses the child declaration
 * this tree holds, for the layout the deploy covenant verifies; embedding its own code generation instead drifted
 * from the primary pipeline and gave a helper a different function id (`OP_1 OP_DEFINE` where the standalone child
 * has `OP_2 OP_DEFINE`): the same length, one byte apart, and every predicted address wrong.
 */
function compileReferencedContracts(
  ast: Ast,
  code: string,
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
  const childOptions = referencedChildCompilerOptions(compilerOptions);
  for (const contractName of sorted) {
    const contract = contractMap.get(contractName);
    if (!contract) continue;

    // Skip abstract contracts - they can't be compiled
    if (contract.isAbstract) continue;

    // B8.0: a deployer child was already compiled standalone with its deployer; the creator embeds no code and
    // code generation reads its binding from the DeployerAbi instead.
    const gathered = (compilerOptions as InternalCompilerOptions).__compiledDeployers?.get(contractName);
    if (gathered?.abi !== undefined) {
      compiledBytecodes.set(contractName, hexToBin(gathered.abi.code));
      continue;
    }

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
    singleAst = confineReturns(singleAst);
    singleAst = singleAst.accept(new AlphaRenameLocalShadows()) as Ast;
    singleAst = singleAst.accept(new DesugarPostfixExpressions()) as Ast;
    // Keep the referenced-contract bytecode byte-identical to its standalone compilation (see comment above).
    singleAst = singleAst.accept(new CoalesceMappingEntryFieldWrites()) as Ast;
    singleAst = singleAst.accept(new OptimizeFixedArrayValues()) as Ast;
    singleAst = singleAst.accept(new CoalesceStructFieldArrayWrites()) as Ast;
    singleAst = singleAst.accept(new LowerMemoryModel()) as Ast;
    singleAst = singleAst.accept(new DesugarNestedArrayWrite()) as Ast;
    singleAst = singleAst.accept(new DesugarLocalBytesElementWrite()) as Ast;
    singleAst = singleAst.accept(new LowerInlineAssembly()) as Ast;
    singleAst = singleAst.accept(new InlineExternalCallHelpers()) as Ast;
    singleAst = singleAst.accept(new InlineReturningStateHelpers(
      compilerOptions.evmCompat ?? false,
      compilerOptions.composition === 'framed',
      true,
    )) as Ast;
    singleAst = singleAst.accept(new LowerDynamicStateJournalHelpers()) as Ast;
    singleAst = singleAst.accept(new LowerCollectionJournalHelpers(compilerOptions.composition === 'framed')) as Ast;
    singleAst = singleAst.accept(new InlineStoragePointerCalls(
      compilerOptions.evmCompat ?? false, false, compilerOptions.composition === 'framed', true,
    )) as Ast;
    singleAst = singleAst.accept(new InlineMappingReturnFunctions()) as Ast;
    singleAst = singleAst.accept(new LowerMappingStorageAlias()) as Ast;
    singleAst = singleAst.accept(new DesugarDynamicArrayCopyCast()) as Ast;
    singleAst = singleAst.accept(new CoalesceStateArrayStructFieldWrites()) as Ast;
    singleAst = singleAst.accept(new CacheDynamicArrayInLoop()) as Ast;
    singleAst = singleAst.accept(new CacheMappingEntryInLoop(compilerOptions.composition === 'framed')) as Ast;
    singleAst = singleAst.accept(new IfConvertConditionalEntryOp(
      compilerOptions.composition === 'framed', compilerOptions.composition !== 'framed',
    )) as Ast;
    singleAst = singleAst.accept(new PromoteConstructorExternalReads()) as Ast;
    singleAst = singleAst.accept(new HoistBranchLocalExtcallTargets()) as Ast;
    singleAst = singleAst.accept(new SynthesizeExternalAddressLocals()) as Ast;
    singleAst = singleAst.accept(new HoistNonLoopArrayElemExtcallTargets()) as Ast;
    singleAst = singleAst.accept(new CaptureBranchExternalCallTargets()) as Ast;
    singleAst = singleAst.accept(new SynthesizeExternalAddressLocals()) as Ast;
    singleAst = singleAst.accept(new SynthesizeBlockOracle(
      compilerOptions.evmCompat ?? false,
      compilerOptions.autoDelegate === true,
    )) as Ast;
    // Carry the file's library free functions in ONLY for symbol resolution + type checking, AFTER the desugar/
    // inline passes have run (so their already-desugared bodies are not re-desugared, which duplicated locals).
    // This lets a child's own `using L for T` calls (`funding.sub(x)`) bind + resolve, instead of falling through
    // to an undefined-symbol error. Library functions are inline-only, so registering them for resolution is
    // sound; codegen skips their standalone bodies (only the child contract is emitted).
    const usingRoots = (ast.usingForDirectives ?? [])
      .flatMap((directive) => directive.functionBindings?.map((binding) => binding.funcName) ?? []);
    (singleAst as SourceFileNode).freeFunctions = reachableFreeFunctions(contract, ast.freeFunctions, usingRoots);
    (singleAst as SourceFileNode).constantDefinitions = ast.constantDefinitions; // library constants those fns read
    // The standalone compile is preferred below. When it fails, these bytes are what gets embedded. A modifier
    // that was never expanded would ship the child with the guard missing and no error (SEM-2).
    const childContract = singleAst.contract;
    const hasCustomModifiers = childContract.modifierDefinitions.length > 0
      || singleAst.libraryModifierDefinitions.length > 0
      || childContract.functions.some((fn) => fn.customModifiers.length > 0)
      || (childContract.constructorDef?.customModifiers.length ?? 0) > 0
      || (childContract.fallbackDef?.customModifiers.length ?? 0) > 0
      || (childContract.receiveDef?.customModifiers.length ?? 0) > 0
      || singleAst.freeFunctions.some((fn) => fn.customModifiers.length > 0);
    if (hasCustomModifiers) singleAst = expandModifiers(singleAst);
    for (const col of singleAst.contract.collections) {
      col.sorted = true;
    }
    singleAst = singleAst.accept(new SymbolTableTraversal(compilerOptions)) as Ast;
    singleAst = singleAst.accept(new TypeCheckTraversal(
      true, compilerOptions.evmCompat ?? false, compilerOptions.rootFileId,
      compilerOptions.composition === 'framed',
    )) as Ast;
    singleAst = singleAst.accept(new EnsureFinalRequireTraversal(
      compilerOptions.enforceFinalRequire, compilerOptions.allowUnsafeOperations,
      compilerOptions.composition === 'framed',
    )) as Ast;
    if (compilerOptions.enforceLocktimeGuard) {
      singleAst = singleAst.accept(new InjectLocktimeGuardTraversal()) as Ast;
    }
    singleAst = singleAst.accept(new EarlyReturnTransformation(
      false, true, compilerOptions.composition !== 'framed',
    )) as Ast;

    refuseEmittingReturningStateHelpers(singleAst.contract);

    bindOraclePool(
      singleAst.contract, singleAst.freeFunctions, isFramedMaster(compilerOptions as InternalCompilerOptions),
    );
    const traversal = new GenerateTargetTraversal(compilerOptions);
    traversal.compiledBytecodes = compiledBytecodes;
    singleAst.accept(traversal);

    const optimisationResult = emitContractScript(
      compilerOptions.optimise !== false, traversal, contract.parameters.length,
    );

    // MD2: run the same backwards-compat cross-check on referenced/child contracts too (it was only applied to
    // the top-level contract, so an optimiser divergence in a child script would have shipped unchecked).
    if (compilerOptions.optimise !== false
      && compilerOptions.optimizeForCompilationSpeed !== true
      && traversal.output.length <= OPTIMISER_COMPAT_CHECK_MAX_OPS
      && needsOptimiserCrossCheck(traversal.output)) {
      const optimisedOld = optimiseBytecodeOld(traversal.output);
      if (!scriptsEqual(optimisedOld, optimisationResult.script)) {
        throw new Error(`New bytecode optimisation is not backwards compatible (referenced contract '${contractName}'), `
          + 'please report this issue to the SolidCash team');
      }
    }

    // The pass list above analyses the child declaration this tree holds: the deploy covenant reads its packed
    // state layout and folded bodies to verify the child's genesis outputs. The bytes it embeds are the child's
    // standalone compile, which is the artifact a caller deploys and predicts the address from. A child the source
    // cannot compile on its own (an unrelated file-level helper embedding its own runtimeCode, say) has no such
    // artifact to differ from, so it keeps the bytes generated here.
    const standalone = compileReferencedContractStandalone(code, contractName, childOptions);
    // The creator encodes the arguments of the bytes it embeds, so the embedded compile decides the binding.
    if (standalone.oraclePool !== undefined) setOraclePoolBinding(contract, standalone.oraclePool);
    if (standalone.poolReads !== undefined) contract.poolTreeReads = standalone.poolReads;
    if (standalone.bytecode === undefined) {
      // The bytes generated here never expanded the child's modifiers: embedding them would drop its guards.
      const host = unexpandedModifierHost(contract, new Set([ast.contract.name, ...contractMap.keys()]));
      if (host !== undefined) {
        throw standalone.error ?? new Error(`Contract '${contractName}' cannot be embedded: its standalone compile `
          + `is unavailable and '${host}' carries modifiers the embedded pipeline does not expand`);
      }
    }
    compiledBytecodes.set(contractName, standalone.bytecode ?? scriptToBytecode(optimisationResult.script));
  }

  return compiledBytecodes;
}

/** The name of a body of `contract` that still carries a modifier invocation, or undefined when none does. */
function unexpandedModifierHost(contract: ContractNode, contractNames: Set<string>): string | undefined {
  for (const fn of [...contract.functions, contract.fallbackDef, contract.receiveDef]) {
    if (fn !== undefined && fn.customModifiers.length > 0) return fn.name;
  }
  const ctor = contract.constructorDef;
  if (ctor === undefined) return undefined;
  // A constructor's base-contract invocations share the modifier list; only a non-contract name is a modifier.
  const pending = (ctor.body.statements ?? []).some((statement) =>
    statement instanceof BlockNode && statement.pendingConstructorModifiers !== undefined);
  if (pending || ctor.customModifiers.some((invocation) => !contractNames.has(invocation.name))) return 'constructor';
  return undefined;
}

// Referenced-contract wrappers must carry the file-level helpers that child actually calls (including transitive
// helper-to-helper calls), but not unrelated helpers. Carrying all of them can create a false self-dependency:
// `C` is compiled as a child while an unrelated helper used only by `D` embeds `type(C).runtimeCode`.
function reachableFreeFunctions(
  contract: ContractNode,
  freeFunctions: FunctionDefinitionNode[],
  rootNames: string[] = [],
): FunctionDefinitionNode[] {
  if (freeFunctions.length === 0) return [];
  const byName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of freeFunctions) {
    for (const key of [fn.name, fn.name.slice(fn.name.lastIndexOf('.') + 1)]) {
      const list = byName.get(key) ?? [];
      list.push(fn);
      byName.set(key, list);
    }
  }
  const namesIn = (root: Node): string[] => {
    const names: string[] = [];
    const walk = (node: Node): void => {
      if (node instanceof IdentifierNode) names.push(node.name);
      else if (node instanceof MethodCallNode) names.push(node.methodName);
      for (const key of Object.keys(node)) {
        if (key === 'type' || key === 'symbolTable' || key === 'location' || key === 'definition'
          || key === 'resolvedFunction' || key === 'referencedContract') continue;
        const value = (node as unknown as Record<string, unknown>)[key];
        if (value instanceof Node) walk(value);
        else if (Array.isArray(value)) for (const item of value) if (item instanceof Node) walk(item);
      }
    };
    walk(root);
    return names;
  };
  const retained = new Set<FunctionDefinitionNode>();
  const seenNames = new Set<string>();
  // File-level using-for/operator bindings are semantic references even when the contract body contains only the
  // operator token (`x + y`) and therefore no identifier node naming its implementation.
  const queue = [...namesIn(contract), ...rootNames];
  while (queue.length > 0) {
    const name = queue.shift()!;
    const bare = name.slice(name.lastIndexOf('.') + 1);
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    for (const fn of [...(byName.get(name) ?? []), ...(byName.get(bare) ?? [])]) {
      if (retained.has(fn)) continue;
      retained.add(fn);
      queue.push(...namesIn(fn));
    }
  }
  return freeFunctions.filter((fn) => retained.has(fn));
}

/** The options a contract embedded by this compile is compiled with: the outermost compile's public options. */
function referencedChildCompilerOptions(compilerOptions: CompilerOptions): CompilerOptions {
  return (compilerOptions as InternalCompilerOptions).__referencedChildOptions
    ?? publicCompilerOptions(compilerOptions);
}

/** The caller-facing part of an options object: everything but the compiler's own `__` fields. */
function publicCompilerOptions(options: CompilerOptions): CompilerOptions {
  return Object.fromEntries(Object.entries(options).filter(([key]) => !key.startsWith('__'))) as CompilerOptions;
}

/**
 * Whether the options ask for a split program. `split: 'off'` asks for the plain one: `compileString` deletes it, but
 * `compileStringMulti` passes it through to every contract and to the children a creator compiles.
 */
function requestsSplit(options: CompilerOptions): boolean {
  const split = (options as { split?: unknown }).split;
  return split !== undefined && split !== 'off';
}

/** Contracts whose standalone compile an enclosing compile is waiting on, outermost first. */
const referencedContractCompileStack: string[] = [];

/**
 * B8.0: the direct `new` targets of `ast`, each compiled standalone with its deployer. Only a contract a source
 * names with `new` is included; `type(C).creationCode` and a stateless child get no entry, so B8.1's predicate
 * keeps today's binding for them. A cycle is refused rather than left to a missing bytecode error.
 */
function gatherDeployerChildren(
  ast: Ast, code: string, options: InternalCompilerOptions,
): Map<string, DeployerChild> | undefined {
  // The pre-B10 inline fold remains reachable for the regression files that assert its shape (B13.4 removes it
  // later). It is not a public option: no source or SDK path sets it.
  if ((options as { __legacyDeployFold?: boolean }).__legacyDeployFold === true) return undefined;
  if (!compilesInDirectConvention(options)) return undefined;
  // The deployer program is a synthetic compile of C's constructor: it cannot create children.
  if (options.__deployerProgram !== undefined) return undefined;
  const knownNames = new Set(ast.importedContracts.map((contract) => contract.name));
  const named = directNewContractNames(
    ast.contract, knownNames, freeFunctionsReachedFrom(ast.contract, ast.freeFunctions ?? []),
  );
  if (named.size === 0) return undefined;
  const childOptions = { ...referencedChildCompilerOptions(options), deployer: true };
  const map = new Map<string, DeployerChild>();
  for (const name of named) {
    // The library self-deploy cases reach here with the primary's own name and no state: skipping is what lets the
    // existing bytecode reference path build them instead of reporting a deployer cycle.
    if (name === ast.contract.name) {
      if (ast.contract.stateVariables.length === 0 && ast.contract.collections.length === 0) continue;
      throw new DeployCycleError(ast.contract, name);
    }
    // A stateless child never gets a deployer (B8.1); its `new` keeps today's embedding. Declaring no state does not
    // make a child stateless: one that emits, or creates a stateful child, is stateful (B10). Its own compile
    // decides, and a stateless one records `not-stateful-direct` below.
    const counter = options.__deployerChildCompileCounter;
    if (counter !== undefined) counter.count += 1;
    const result = compileReferencedDeployerStandalone(code, name, childOptions);
    if (result.cycle === true) throw new DeployCycleError(ast.contract, name);
    if (result.error !== undefined) throw result.error;
    const artifact = result.artifact;
    if (artifact === undefined) continue;
    const abi = artifact.deployer;
    // A5 refuses a live block reader's deployer as `code-not-constant` (the constant-lock form this backend
    // lacks); the creator-side name for the same child fact is A15's `child-reads-block-data`.
    const reason = artifact.deployerUnsupported === 'code-not-constant' && artifact.usesBlockOracle === true
      ? 'child-reads-block-data'
      : artifact.deployerUnsupported;
    if (abi === undefined && (reason === undefined || reason === 'not-stateful-direct')) continue;
    map.set(name, { name, artifact, abi, reason });
  }
  return map.size > 0 ? map : undefined;
}

/**
 * B8.7: a creator that makes a sender-reading child is a marked creator. Refuse the shapes whose master cannot
 * carry the unlocking check, declare the hidden `__solidcash_created` local in each arm that holds such a site,
 * and mark the contract so the code tail sets the creator flag.
 */
function prepareMarkedCreator(
  ast: Ast, children: ReadonlyMap<string, DeployerChild>, options: InternalCompilerOptions,
): void {
  const names = new Set([...children]
    .filter(([, child]) => child.abi?.constructorReadsSender === true)
    .map(([name]) => name));
  if (names.size === 0) return;
  const contract = ast.contract;
  const refuse = (detail: string): never => {
    throw new DeployerUnsupportedError(contract, 'creator-shape', detail);
  };
  if (options.composition === 'framed') {
    refuse('a marked creator must be a plain direct master, not a framed program');
  }
  if (options.callBatch === true) refuse('a marked creator has no multi-call entry');
  if (requestsSplit(options)) refuse('a marked creator cannot be split');
  if (options.autoDelegate === true
    || (options as InternalCompilerOptions & { delegateVariant?: unknown }).delegateVariant !== undefined) {
    refuse('a marked creator cannot be a proxy or delegate variant');
  }
  if (contract.fallbackDef !== undefined) refuse('a marked creator has no fallback arm');

  const countSites = (body: Node | undefined): number => {
    if (body === undefined) return 0;
    let count = 0;
    const seen = new Set<Node>();
    const walk = (value: unknown): void => {
      if (value === null || typeof value !== 'object' || seen.has(value as Node)) return;
      seen.add(value as Node);
      if (Array.isArray(value)) { for (const item of value) walk(item); return; }
      if (!(value instanceof Node)) return;
      if (value instanceof InstantiationNode && names.has(value.identifier.name)) count += 1;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'referencedContract' || key === 'definition' || key === 'symbolTable'
          || key === 'resolvedFunction' || key === 'type' || key === 'stateVariable' || key === 'collection') continue;
        walk(child);
      }
    };
    walk(body);
    return count;
  };
  for (const fn of [contract.constructorDef, contract.receiveDef, ...contract.functions]) {
    if (fn === undefined || countSites(fn.body) === 0) continue;
    if (fn.name === '__construct') refuse('the constructor creates a child');
    if (fn.isReceive) refuse('a deployer `new` cannot run in `receive`');
    if (fn === contract.fallbackDef) refuse('a deployer `new` cannot run in `fallback`');
    if (fn.isEntryPoint !== true) refuse('a deployer `new` in an invoked function body has no created-children list');
  }
  for (const fn of ast.freeFunctions) {
    if (countSites(fn.body) > 0) refuse('a deployer `new` in an invoked function body has no created-children list');
  }
  contract.createsSenderReadingChildren = true;
}

/**
 * B8.7 rule 2: declare the hidden `__solidcash_created` local in each arm that holds a sender-reading `new`. It
 * runs after every transformation that moves statements, so the local sits at the function body's start in the
 * program code generation emits.
 */
function injectCreatedChildrenLocals(ast: Ast, children: ReadonlyMap<string, DeployerChild> | undefined): void {
  if (children === undefined || ast.contract.createsSenderReadingChildren !== true) return;
  const names = new Set([...children]
    .filter(([, child]) => child.abi?.constructorReadsSender === true)
    .map(([name]) => name));
  if (names.size === 0) return;
  const countSites = (body: Node | undefined): number => {
    if (body === undefined) return 0;
    let count = 0;
    const seen = new Set<Node>();
    const walk = (value: unknown): void => {
      if (value === null || typeof value !== 'object' || seen.has(value as Node)) return;
      seen.add(value as Node);
      if (Array.isArray(value)) { for (const item of value) walk(item); return; }
      if (!(value instanceof Node)) return;
      if (value instanceof InstantiationNode && names.has(value.identifier.name)) count += 1;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'referencedContract' || key === 'definition' || key === 'symbolTable'
          || key === 'resolvedFunction' || key === 'type' || key === 'stateVariable' || key === 'collection') continue;
        walk(child);
      }
    };
    walk(body);
    return count;
  };
  for (const fn of ast.contract.functions) {
    if (!fn.isEntryPoint || fn.isReceive || fn.isFallback || countSites(fn.body) === 0) continue;
    const statements = fn.body.statements ?? [];
    if (statements.some((statement) => statement instanceof VariableDefinitionNode
      && statement.name === '__solidcash_created')) continue;
    const empty = new HexLiteralNode(new Uint8Array(0));
    empty.location = fn.location;
    const local = new VariableDefinitionNode(new BytesType(), [], '__solidcash_created', empty);
    local.location = fn.location;
    local.compilerGenerated = true;
    local.allowUnused = true;
    statements.unshift(local);
    fn.body.statements = statements;
  }
}

/**
 * The free functions the contract can reach by bare-name calls, transitively. A module's free functions are not
 * all part of every contract: compiling a child standalone must not see a `new` in a helper only the *creator*
 * calls, or it reports a creation cycle against itself.
 */
function freeFunctionsReachedFrom(
  contract: ContractNode, freeFunctions: FunctionDefinitionNode[],
): FunctionDefinitionNode[] {
  if (freeFunctions.length === 0) return [];
  const byName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of freeFunctions) {
    const list = byName.get(fn.name) ?? [];
    list.push(fn);
    byName.set(fn.name, list);
  }
  const reached = new Set<FunctionDefinitionNode>();
  const queue: FunctionDefinitionNode[] = [];
  const visit = (fn: FunctionDefinitionNode): void => {
    walkInvocationAst(fn.body, (node) => {
      if (!(node instanceof FunctionCallNode)) return;
      for (const callee of byName.get(node.identifier.name) ?? []) {
        if (reached.has(callee)) continue;
        reached.add(callee);
        queue.push(callee);
      }
    });
  };
  for (const fn of [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions]) {
    if (fn !== undefined) visit(fn);
  }
  while (queue.length > 0) visit(queue.pop()!);
  return [...reached];
}

/** The names a direct `new` in `contract` (or in a retained free function) quotes, without the transitive closure. */
function directNewContractNames(
  contract: ContractNode, knownNames: Set<string>, freeFunctions: FunctionDefinitionNode[],
): Set<string> {
  const names = new Set<string>();
  const seen = new WeakSet<object>();
  const walk = (value: unknown): void => {
    if (value === null || typeof value !== 'object' || seen.has(value as object)) return;
    seen.add(value as object);
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!(value instanceof Node)) return;
    // A call node may carry its resolved body (a library member, an inlined helper). Those bodies are walked as
    // roots when they belong to this contract; a library's `new` is the library's own deployment, not this one's.
    if (value instanceof FunctionDefinitionNode) return;
    if (value instanceof InstantiationNode
      && (knownNames.has(value.identifier.name) || value.identifier.name === contract.name)) {
      names.add(value.identifier.name);
      for (const argument of value.parameters) walk(argument);
      if (value.callOptions?.value) walk(value.callOptions.value);
      if (value.callOptions?.salt) walk(value.callOptions.salt);
      if (value.callOptions?.args) for (const argument of value.callOptions.args) walk(argument);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      // A back-reference to a child declaration would pull in that child's own `new` sites.
      if (key === 'referencedContract' || key === 'definition' || key === 'symbolTable'
        || key === 'resolvedFunction' || key === 'type' || key === 'stateVariable' || key === 'collection') continue;
      walk(child);
    }
  };
  for (const fn of [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions]) {
    if (fn !== undefined) walk(fn.body);
  }
  for (const fn of freeFunctions) walk(fn.body);
  return names;
}

/**
 * The whole artifact of `contractName`'s standalone compile, nested inside the compile that gathers it. It shares
 * the recursion stack of `compileReferencedContractStandalone`, so a creation cycle is reported instead of looped.
 */
function compileReferencedDeployerStandalone(
  code: string, contractName: string, options: CompilerOptions,
): { artifact?: Artifact; cycle?: boolean; error?: Error } {
  if (referencedContractCompileStack.includes(contractName)) return { cycle: true };
  referencedContractCompileStack.push(contractName);
  try {
    const artifact = withCompilerWarnings(true, () => compileStringUnchecked(code, {
      ...options,
      primaryContractName: contractName,
      suppressWarnings: true,
      __artifactCache: true,
    } as CompileOptions));
    return { artifact };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    referencedContractCompileStack.pop();
  }
}

/**
 * The bytes of `contractName`'s standalone compile, nested inside the compile that embeds it, or the error when the
 * source does not compile with that contract selected (neither for a creation cycle). It goes through the same
 * entry a primary does, so the embedded bytes cannot drift from the artifact. The artifact cache is keyed exactly as
 * that standalone compile, so a child the caller compiled already is reused and the retried attempts of one
 * enclosing compile build it once.
 *
 * The bytes are the artifact's published `bytecode`, the program the SDK deploys and derives the address from.
 */
function compileReferencedContractStandalone(
  code: string, contractName: string, options: CompilerOptions,
): { bytecode?: Uint8Array; oraclePool?: boolean; poolReads?: OraclePoolReads; error?: Error } {
  // A contract that creates itself, directly or through another, has no standalone compile to embed.
  if (referencedContractCompileStack.includes(contractName)) return {};
  referencedContractCompileStack.push(contractName);
  try {
    const artifact = withCompilerWarnings(true, () => compileStringUnchecked(code, {
      ...options,
      primaryContractName: contractName,
      suppressWarnings: true,
      __artifactCache: true,
    } as CompileOptions));
    return {
      bytecode: scriptToBytecode(asmToScript(artifact.bytecode)),
      oraclePool: artifact.constructorInputs.some((input) => input.name === ORACLE_POOL_PARAMETER),
      poolReads: oraclePoolTreeReads(artifact),
    };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  } finally {
    referencedContractCompileStack.pop();
  }
}

/** The bodies a framed master can run, in declaration order: the constructor, fallback, receive and entries. */
function contractBodyFunctions(contract: ContractNode): FunctionDefinitionNode[] {
  return [contract.constructorDef, contract.fallbackDef, contract.receiveDef, ...contract.functions]
    .filter((fn): fn is FunctionDefinitionNode => fn !== undefined);
}

/**
 * The inline-assembly blocks each contract body reaches, captured before any lowering rewrites them.
 *
 * A block the assembly lowering supports is replaced by the statements it lowers to, so the captured node leaves
 * the program; a block it does not support - native `assembly { OP_* }` has no Yul tree - survives as the same
 * node. A body is therefore refused framed only when a block it was captured reaching is still in the program
 * the master is built from, which serves a body whose assembly the convention can lower and refuses one whose
 * assembly it cannot.
 */
function captureBodyAssemblyBlocks(
  contract: ContractNode,
  freeFunctions: readonly FunctionDefinitionNode[],
): Map<string, Set<AssemblyStatementNode>> {
  const byName = new Map<string, FunctionDefinitionNode[]>();
  const register = (fn: FunctionDefinitionNode): void => {
    for (const key of [fn.name, fn.name.slice(fn.name.lastIndexOf('.') + 1)]) {
      const list = byName.get(key);
      if (list) list.push(fn);
      else byName.set(key, [fn]);
    }
  };
  for (const fn of freeFunctions) register(fn);
  const bodies = contractBodyFunctions(contract);
  for (const fn of bodies) register(fn);
  const captured = new Map<string, Set<AssemblyStatementNode>>();
  for (const fn of bodies) {
    const blocks = new Set<AssemblyStatementNode>();
    for (const name of collectNamedFunctionClosure(fn, byName)) {
      for (const candidate of byName.get(name) ?? []) {
        if (!candidate.body) continue;
        walkInvocationAst(candidate.body, (node) => {
          if (node instanceof AssemblyStatementNode) blocks.add(node);
        });
      }
    }
    if (blocks.size > 0) captured.set(fn.name, blocks);
  }
  return captured;
}

/**
 * The inline-assembly blocks still in the program, split by where the lowering left them.
 *
 * A block left in a contract body refuses only that body, which the master emits as a stub. A block left in a
 * file-level definition is emitted with the definition itself, behind no stub, so it refuses the contract.
 */
function survivingAssemblyBlocks(ast: Ast): {
  readonly inBodies: Set<AssemblyStatementNode>;
  readonly inFreeFunctions: Set<AssemblyStatementNode>;
} {
  const inBodies = new Set<AssemblyStatementNode>();
  const inFreeFunctions = new Set<AssemblyStatementNode>();
  const collect = (fn: FunctionDefinitionNode | undefined, sink: Set<AssemblyStatementNode>): void => {
    if (fn?.body === undefined) return;
    walkInvocationAst(fn.body, (node) => {
      if (node instanceof AssemblyStatementNode) sink.add(node);
    });
  };
  for (const fn of contractBodyFunctions(ast.contract)) collect(fn, inBodies);
  for (const fn of ast.freeFunctions) collect(fn, inFreeFunctions);
  return { inBodies, inFreeFunctions };
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
  // Reachable file-level functions are emitted alongside the primary contract and may embed sibling bytecode
  // independently of the contract body (`test() { return type(C).runtimeCode.length > 0; }`, called by D).
  // PruneUnreachableFreeFunctions has already run, so scanning the retained set does not compile dependencies for
  // dead assembly/library helpers.
  for (const fn of ast.freeFunctions ?? []) collectRefsRecursive(fn, refs, visited, knownNames);
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

// Collect SPDX tags only inside actual comments. A plain regex over the source would incorrectly inspect a string
// literal containing `SPDX-License-Identifier:`; this scanner skips quoted strings and handles line/block comments.
function spdxIdentifiersInComments(code: string): string[] {
  const identifiers: string[] = [];
  const collect = (comment: string): void => {
    const pattern = /SPDX-License-Identifier\s*:/g;
    const matches = [...comment.matchAll(pattern)];
    for (let index = 0; index < matches.length; index += 1) {
      const start = matches[index].index! + matches[index][0].length;
      const newline = comment.indexOf('\n', start);
      const next = matches[index + 1]?.index ?? comment.length;
      const end = Math.min(newline < 0 ? comment.length : newline, next);
      identifiers.push(comment.slice(start, end).trim().replace(/\\n$/, '').trim());
    }
  };
  for (let i = 0; i < code.length;) {
    const ch = code[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < code.length) {
        if (code[i] === '\\') i += 2;
        else if (code[i] === quote) { i += 1; break; } else i += 1;
      }
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i + 2);
      const comment = code.slice(i + 2, end < 0 ? code.length : end);
      collect(comment);
      i = end < 0 ? code.length : end + 1;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const comment = code.slice(i + 2, end < 0 ? code.length : end);
      collect(comment);
      i = end < 0 ? code.length : end + 2;
      continue;
    }
    i += 1;
  }
  return identifiers;
}

// Solidity requires directional formatting controls to balance within each individual comment or string token.
// This prevents a displayed source line from visually reordering text outside the token which contains the
// control. LRE/RLE/LRO/RLO open a formatting scope and PDF closes one.
function validateUnicodeDirectionMarkers(code: string): void {
  const validateToken = (token: string): void => {
    let depth = 0;
    for (const ch of token) {
      if (ch === '\u202a' || ch === '\u202b' || ch === '\u202d' || ch === '\u202e') {
        depth += 1;
      } else if (ch === '\u202c') {
        if (depth === 0) {
          throw new Error('Unicode direction override underflow in comment or string literal.');
        }
        depth -= 1;
      }
    }
    if (depth !== 0) {
      throw new Error('Mismatching directional override markers in comment or string literal.');
    }
  };

  for (let i = 0; i < code.length;) {
    const ch = code[i];
    if (ch === '"' || ch === "'") {
      const start = i;
      const quote = ch;
      i += 1;
      while (i < code.length) {
        if (code[i] === '\\') i += 2;
        else if (code[i] === quote) { i += 1; break; } else i += 1;
      }
      validateToken(code.slice(start, i));
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i + 2);
      const next = end < 0 ? code.length : end;
      validateToken(code.slice(i, next));
      i = end < 0 ? code.length : end + 1;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const next = end < 0 ? code.length : end + 2;
      validateToken(code.slice(i, next));
      i = next;
      continue;
    }
    i += 1;
  }
}

/**
 * X118. Name the one shape code generation refuses with a bare internal `Error`.
 *
 * `GenerateTargetTraversal.computeScalarJournalClosures` rejects a RETURNING internally-invoked helper that emits
 * an event: the OP_INVOKE epilogue returns before emit settlement, so the event would be silently dropped. It
 * raised `throw new Error("Returning state helper '<n>' with an event must be inlined before code generation")` -
 * an internal invariant, with no class name, no position and no remedy, reaching users on the canonical
 * solidity-by-example `ERC20.sol` in PLAIN direct-mode compilation. `_mint` there is void
 * as written; `LowerCollectionJournalHelpers` is what makes it returning.
 *
 * Placed HERE, immediately before code generation, rather than in the lowering pass that creates the shape: an
 * earlier check masks whatever a later pass would have said, and measured on four real contracts (OZ ERC1155 /
 * ERC721 / ERC777, mistswap FlexUsd) it replaced a live type or reference error with this one. From here it can
 * mask nothing - every other pass has already had its say.
 *
 * The condition mirrors the code-generation site exactly, so this refuses no program that site accepts.
 */
function refuseEmittingReturningStateHelpers(contract: ContractNode): void {
  const functions = contract.fallbackDef ? [...contract.functions, contract.fallbackDef] : contract.functions;
  const candidates = functions.filter((fn) => fn.body && fn.functionId !== undefined && fn.returnTypes.length > 0
    && (fn.emitInfos?.length ?? 0) > 0);
  if (candidates.length === 0) return;
  const walk = (node: Node, visit: (n: Node) => void, seen = new Set<Node>()): void => {
    if (seen.has(node)) return;
    seen.add(node);
    visit(node);
    for (const [key, value] of Object.entries(node)) {
      if (['resolvedFunction', 'functionReference', 'definition', 'collection', 'stateVariable',
        'symbolTable'].includes(key)) continue;
      if (value instanceof Node) walk(value, visit, seen);
      else if (Array.isArray(value)) {
        for (const item of value) if (item instanceof Node) walk(item, visit, seen);
      }
    }
  };
  // Invoked internally, by the same two forms code generation counts: a resolved internal call, and a function
  // used as a VALUE (function pointer / self-reference), which is invoked indirectly.
  const invoked = new Set<number>();
  walk(contract, (node) => {
    if (node instanceof FunctionCallNode && node.resolvedFunction?.functionId !== undefined) {
      invoked.add(node.resolvedFunction.functionId);
    }
    if (node instanceof IdentifierNode && node.functionReference?.functionId !== undefined) {
      invoked.add(node.functionReference.functionId);
    }
  });
  for (const fn of candidates) {
    if (!invoked.has(fn.functionId!)) continue;
    throw new EmittingStateHelperEventError(fn, fn.name, fn.collectionJournal === true);
  }
}

/** ANTLR's CharStream copies the source into `new Array(n)` of boxed numbers. Lexer `LA` is the hot path. */
class PackedCharStream {
  name = '<empty>';
  private readonly strdata: string;
  private _index = 0;
  private readonly _size: number;

  constructor(str: string) {
    this.strdata = str;
    this._size = str.length;
  }

  get index(): number { return this._index; }
  get size(): number { return this._size; }
  reset(): void { this._index = 0; }
  consume(): void {
    if (this._index >= this._size) throw new Error('cannot consume EOF');
    this._index += 1;
  }

  LA(offset: number): number {
    if (offset === 0) return 0;
    if (offset < 0) offset += 1;
    const i = this._index + offset - 1;
    if (i < 0 || i >= this._size) return -1;
    return this.strdata.charCodeAt(i);
  }

  LT(offset: number): number { return this.LA(offset); }
  mark(): number { return -1; }
  release(_marker: number): void { /* ANTLR CharStream marks are unused. */ }
  seek(index: number): void {
    this._index = index <= this._index ? index : Math.min(index, this._size);
  }

  getText(start: number | { start: number; stop: number }, stop?: number): string {
    if (typeof start === 'object') {
      stop = start.stop;
      start = start.start;
    }
    if (stop === undefined) stop = this._size - 1;
    if (stop >= this._size) stop = this._size - 1;
    if (start >= this._size) return '';
    return this.strdata.slice(start, stop + 1);
  }

  toString(): string { return this.strdata; }
}

const SHARED_PREDICTION_CONTEXT_CACHE = new PredictionContextCache();
const SHARED_LEXER_PREDICTION_CONTEXT_CACHE = new PredictionContextCache();
const parseProfileTotals = { files: 0, sllFails: 0, bytes: 0, ms: 0 };

// SolidCashParser.expression() prefix switch (`adaptivePredict(..., 345, ...)`). Guarded at install time by
// rule name so a grammar regen that shifts decision numbers silently falls back to ATN prediction.
const STATEMENT_DECISION = 167;
const STATEMENT_ALT_PLACEHOLDER = 1;
const STATEMENT_ALT_BLOCK = 2;
const STATEMENT_ALT_TIME_OP = 10;
const STATEMENT_ALT_REQUIRE = 11;
const STATEMENT_ALT_IF = 12;
const STATEMENT_ALT_EMIT = 15;
const STATEMENT_ALT_RETURN = 16;
const STATEMENT_ALT_LOOP = 13;
const STATEMENT_ALT_TRY = 19;
const STATEMENT_ALT_SELFDESTRUCT = 17;
const STATEMENT_ALT_SWITCH = 24;
const STATEMENT_ALT_UNCHECKED = 23;
const STATEMENT_ALT_ASSEMBLY = 18;
const STATEMENT_ALT_CONTINUE = 26;
const STATEMENT_ALT_BREAK = 25;
const STATEMENT_ALT_DELETE = 22;
const STATEMENT_ALT_ASSERT = 21;
const STATEMENT_ALT_REVERT = 20;
const STATEMENT_ALT_CONSOLE = 14;
const EXPRESSION_PREFIX_DECISION = 345;
const EXPRESSION_POSTFIX_LOOP_DECISION = 361;
const EXPRESSION_POSTFIX_INNER_DECISION = 360;
const EXPRESSION_POSTFIX_CONTINUE = 1;
const EXPRESSION_POSTFIX_STOP = 2;
const EXPRESSION_POSTFIX_INDEXED = 12;
const EXPRESSION_POSTFIX_INDEXED_CALL = 20;
const EXPRESSION_POSTFIX_METHOD = 18;
const EXPRESSION_POSTFIX_FIELD = 21;
const EXPRESSION_POSTFIX_SLICE = 15;
const EXPRESSION_POSTFIX_SPLIT = 14;
const EXPRESSION_POSTFIX_UNARY_MEMBER = 13;
const EXPRESSION_POSTFIX_INC = 22;
const EXPRESSION_POSTFIX_TERNARY = 23;
const EXPRESSION_POSTFIX_BITOR = 7;
const EXPRESSION_POSTFIX_BITXOR = 6;
const EXPRESSION_POSTFIX_BITAND = 5;
const EXPRESSION_POSTFIX_SHIFT = 4;
const EXPRESSION_POSTFIX_POW = 1;
const EXPRESSION_POSTFIX_OR = 11;
const EXPRESSION_POSTFIX_AND = 10;
const EXPRESSION_POSTFIX_CMP = 8;
const EXPRESSION_POSTFIX_EQ = 9;
const EXPRESSION_POSTFIX_MUL = 2;
const EXPRESSION_POSTFIX_ADD = 3;
const EXPRESSION_ALT_GROUPED = 1;
const EXPRESSION_ALT_CAST = 2;
const EXPRESSION_ALT_CALL = 3;
const EXPRESSION_ALT_CONSTRUCTED = 4;
const EXPRESSION_ALT_TYPE_INTROSPECTION = 5;
const EXPRESSION_ALT_ABI_ENCODE = 6;
const EXPRESSION_ALT_ABI_ENCODE_CALL = 7;
const EXPRESSION_ALT_BYTES_CONCAT = 8;
const EXPRESSION_ALT_ABI_DECODE = 9;
const EXPRESSION_ALT_ABI_DECODE_AT = 10;
const EXPRESSION_ALT_BARE_ABI = 11;
const EXPRESSION_ALT_INTROSPECTION = 12;
const EXPRESSION_ALT_UNARY = 14;
const EXPRESSION_ALT_ARRAY_LITERAL = 15;
const EXPRESSION_ALT_THIS = 16;
const EXPRESSION_ALT_NULLARY = 17;
const EXPRESSION_ALT_IDENTIFIER = 18;
const EXPRESSION_ALT_LITERAL = 19;
// yulBlock / yulStatement / yulExpression (`adaptivePredict(..., 266/267/278, ...)`).
const YUL_BLOCK_LOOP_DECISION = 266;
const YUL_BLOCK_LOOP_CONTINUE = 1;
const YUL_BLOCK_LOOP_STOP = 2;
const YUL_STATEMENT_DECISION = 267;
const YUL_EXPRESSION_DECISION = 278;
const YUL_STMT_NESTED_BLOCK = 1;
const YUL_STMT_LET = 2;
const YUL_STMT_ASSIGN = 3;
const YUL_STMT_IF = 4;
const YUL_STMT_SWITCH = 5;
const YUL_STMT_FOR = 6;
const YUL_STMT_FUNCTION = 7;
const YUL_STMT_BREAK = 8;
const YUL_STMT_CONTINUE = 9;
const YUL_STMT_LEAVE = 10;
const YUL_STMT_CALL = 11;
const YUL_STMT_PATH = 12;
const YUL_STMT_LITERAL = 13;
const YUL_EXPR_CALL = 1;
const YUL_EXPR_PATH = 2;
const YUL_EXPR_LITERAL = 3;

function skipBalanced(
  input: { LA(i: number): number }, start: number, open: number, close: number,
): number {
  let depth = 0;
  for (let i = start; i < start + 4096; i += 1) {
    const token = input.LA(i);
    if (token === -1) return i;
    if (token === open) depth += 1;
    else if (token === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return start + 4096;
}

function predictExpressionPrefix(
  input: { LA(i: number): number; LT(i: number): { text?: string | undefined } },
): number | undefined {
  const first = input.LA(1);
  const lparen = PARSER_LITERAL_TOKENS.leftParen;
  const lbrack = PARSER_LITERAL_TOKENS.leftBracket;
  if (first === lparen) {
    // `(type(T)).member` is a distinct metatype prefix, not a grouped expression.
    if (input.LA(2) === PARSER_LITERAL_TOKENS.typeKeyword) return undefined;
    const rparen = PARSER_LITERAL_TOKENS.rightParen;
    const dot = PARSER_LITERAL_TOKENS.dot;
    if ((input.LA(2) === SolidCashParser.Identifier && input.LA(3) === rparen && input.LA(4) === lparen)
      || (input.LA(2) === SolidCashParser.Identifier && input.LA(3) === dot
        && input.LA(4) === SolidCashParser.Identifier && input.LA(5) === rparen && input.LA(6) === lparen)) {
      return EXPRESSION_ALT_CALL;
    }
    return EXPRESSION_ALT_GROUPED;
  }
  if (first === SolidCashParser.Identifier) {
    // `uint(x)` is a typeCast alternative, not a call; let ATN keep that split.
    if (input.LT(1).text === 'uint') return undefined;
    const lbrace = PARSER_LITERAL_TOKENS.leftBrace;
    const dot = PARSER_LITERAL_TOKENS.dot;
    const second = input.LA(2);
    // Mirrors the grammar's hasFunctionCallAhead: `x.y(` is the namespaced call only when `y` is an Identifier; a
    // soft keyword there (`bar.leave(..)`) is a member call on the identifier.
    if (second === lparen || second === lbrace
      || (second === dot && input.LA(3) === SolidCashParser.Identifier
        && input.LA(4) === lparen && input.LA(5) !== lbrace)) {
      return EXPRESSION_ALT_CALL;
    }
    return EXPRESSION_ALT_IDENTIFIER;
  }
  if (first === SolidCashParser.NullaryOp) return EXPRESSION_ALT_NULLARY;
  if (first === SolidCashParser.NumberLiteral || first === SolidCashParser.DecimalLiteral
    || first === SolidCashParser.BooleanLiteral || first === SolidCashParser.StringLiteral
    || first === SolidCashParser.UnicodeLiteral || first === SolidCashParser.HexStringLiteral
    || first === SolidCashParser.DateLiteral || first === SolidCashParser.HexLiteral) {
    return EXPRESSION_ALT_LITERAL;
  }
  if (first === SolidCashParser.BoundedUnsignedInt || first === SolidCashParser.BoundedSignedInt
    || first === SolidCashParser.PrimitiveType || first === SolidCashParser.UnboundedBytes
    || first === SolidCashParser.BoundedBytes || first === SolidCashParser.CryptoType
    || first === SolidCashParser.UnsafeCast || first === SolidCashParser.BoundedSignedFixed
    || first === SolidCashParser.BoundedUnsignedFixed
    || first === PARSER_LITERAL_TOKENS.address || first === PARSER_LITERAL_TOKENS.payable
    || first === PARSER_LITERAL_TOKENS.fixed || first === PARSER_LITERAL_TOKENS.ufixed) {
    const second = input.LA(2);
    if (second === lparen || second === lbrack) return EXPRESSION_ALT_CAST;
  }
  if (first === PARSER_LITERAL_TOKENS.thisKeyword) return EXPRESSION_ALT_THIS;
  if (first === PARSER_LITERAL_TOKENS.newKeyword) return EXPRESSION_ALT_CONSTRUCTED;
  if (first === PARSER_LITERAL_TOKENS.txOutputs || first === PARSER_LITERAL_TOKENS.txInputs) {
    return EXPRESSION_ALT_INTROSPECTION;
  }
  if (first === PARSER_LITERAL_TOKENS.typeKeyword) return EXPRESSION_ALT_TYPE_INTROSPECTION;
  if (first === PARSER_LITERAL_TOKENS.minus || first === PARSER_LITERAL_TOKENS.bitwiseNot
    || first === PARSER_LITERAL_TOKENS.logicalNot) {
    return EXPRESSION_ALT_UNARY;
  }
  if (first === lbrack) return EXPRESSION_ALT_ARRAY_LITERAL;
  if (first === PARSER_LITERAL_TOKENS.abiEncode || first === PARSER_LITERAL_TOKENS.abiEncodePacked
    || first === PARSER_LITERAL_TOKENS.abiEncodeWithSelector || first === PARSER_LITERAL_TOKENS.abiEncodeWithSignature) {
    return input.LA(2) === lparen ? EXPRESSION_ALT_ABI_ENCODE : EXPRESSION_ALT_BARE_ABI;
  }
  if (first === PARSER_LITERAL_TOKENS.abiEncodeCall) {
    return input.LA(2) === lparen ? EXPRESSION_ALT_ABI_ENCODE_CALL : EXPRESSION_ALT_BARE_ABI;
  }
  if (first === PARSER_LITERAL_TOKENS.bytesConcat || first === PARSER_LITERAL_TOKENS.stringConcat) {
    return EXPRESSION_ALT_BYTES_CONCAT;
  }
  if (first === PARSER_LITERAL_TOKENS.abiDecode) {
    return input.LA(2) === lparen ? EXPRESSION_ALT_ABI_DECODE : EXPRESSION_ALT_BARE_ABI;
  }
  if (first === PARSER_LITERAL_TOKENS.abiDecodeAt) {
    return input.LA(2) === lparen ? EXPRESSION_ALT_ABI_DECODE_AT : EXPRESSION_ALT_BARE_ABI;
  }
  return undefined;
}

const TOKEN_TYPE_BY_LITERAL = new Map<string, number>();
function prefillParserTokenTypes(): void {
  const names = SolidCashParser.literalNames;
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    if (name !== null) TOKEN_TYPE_BY_LITERAL.set(name, i);
  }
}
prefillParserTokenTypes();
function tokenTypeByLiteral(literal: string): number | undefined {
  const cached = TOKEN_TYPE_BY_LITERAL.get(literal);
  if (cached !== undefined) return cached;
  const names = SolidCashParser.literalNames;
  for (let i = 0; i < names.length; i += 1) {
    if (names[i] === literal) {
      TOKEN_TYPE_BY_LITERAL.set(literal, i);
      return i;
    }
  }
  return undefined;
}

// Resolve grammar literals once: ANTLR's anonymous T__ indices move when a grammar rule adds a keyword.
// Named lexer tokens remain stable references; fast paths must bind literal tokens to the active grammar.
function requiredParserLiteralToken(literal: string): number {
  const token = tokenTypeByLiteral(literal);
  if (token === undefined) throw new Error(`Missing parser literal token ${literal}`);
  return token;
}
const PARSER_LITERAL_TOKENS = {
  semicolon: requiredParserLiteralToken("';'"),
  leftBrace: requiredParserLiteralToken("'{'"),
  comma: requiredParserLiteralToken("','"),
  rightBrace: requiredParserLiteralToken("'}'"),
  dot: requiredParserLiteralToken("'.'"),
  minus: requiredParserLiteralToken("'-'"),
  greaterOrEqual: requiredParserLiteralToken("'>='"),
  bitwiseNot: requiredParserLiteralToken("'~'"),
  thisKeyword: requiredParserLiteralToken("'this'"),
  assign: requiredParserLiteralToken("'='"),
  leftParen: requiredParserLiteralToken("'('"),
  rightParen: requiredParserLiteralToken("')'"),
  typeKeyword: requiredParserLiteralToken("'type'"),
  payable: requiredParserLiteralToken("'payable'"),
  leftBracket: requiredParserLiteralToken("'['"),
  rightBracket: requiredParserLiteralToken("']'"),
  fixed: requiredParserLiteralToken("'fixed'"),
  ufixed: requiredParserLiteralToken("'ufixed'"),
  address: requiredParserLiteralToken("'address'"),
  newKeyword: requiredParserLiteralToken("'new'"),
  abiEncode: requiredParserLiteralToken("'abi.encode'"),
  abiEncodePacked: requiredParserLiteralToken("'abi.encodePacked'"),
  abiEncodeWithSelector: requiredParserLiteralToken("'abi.encodeWithSelector'"),
  abiEncodeWithSignature: requiredParserLiteralToken("'abi.encodeWithSignature'"),
  abiEncodeCall: requiredParserLiteralToken("'abi.encodeCall'"),
  bytesConcat: requiredParserLiteralToken("'bytes.concat'"),
  stringConcat: requiredParserLiteralToken("'string.concat'"),
  abiDecode: requiredParserLiteralToken("'abi.decode'"),
  abiDecodeAt: requiredParserLiteralToken("'abi.decodeAt'"),
  txOutputs: requiredParserLiteralToken("'tx.outputs'"),
  txInputs: requiredParserLiteralToken("'tx.inputs'"),
  logicalNot: requiredParserLiteralToken("'!'"),
};

function installExpressionPrefixFastPath(parser: SolidCashParser): void {
  const interp = parser._interp;
  const prefixState = interp.atn.decisionToState[EXPRESSION_PREFIX_DECISION] as { ruleIndex?: number } | undefined;
  const postfixState = interp.atn.decisionToState[EXPRESSION_POSTFIX_LOOP_DECISION] as { ruleIndex?: number } | undefined;
  const postfixInnerState = interp.atn.decisionToState[EXPRESSION_POSTFIX_INNER_DECISION] as
    { ruleIndex?: number } | undefined;
  const statementState = interp.atn.decisionToState[STATEMENT_DECISION] as { ruleIndex?: number } | undefined;
  const yulBlockState = interp.atn.decisionToState[YUL_BLOCK_LOOP_DECISION] as { ruleIndex?: number } | undefined;
  const yulStatementState = interp.atn.decisionToState[YUL_STATEMENT_DECISION] as { ruleIndex?: number } | undefined;
  const yulExpressionState = interp.atn.decisionToState[YUL_EXPRESSION_DECISION] as
    { ruleIndex?: number } | undefined;
  const prefixOk = prefixState !== undefined && parser.ruleNames[prefixState.ruleIndex ?? -1] === 'expression';
  const postfixOk = postfixState !== undefined && parser.ruleNames[postfixState.ruleIndex ?? -1] === 'expression';
  const postfixInnerOk = postfixInnerState !== undefined && parser.ruleNames[postfixInnerState.ruleIndex ?? -1] === 'expression';
  const statementOk = statementState !== undefined && parser.ruleNames[statementState.ruleIndex ?? -1] === 'statement';
  const yulBlockOk = yulBlockState !== undefined && parser.ruleNames[yulBlockState.ruleIndex ?? -1] === 'yulBlock';
  const yulStatementOk = yulStatementState !== undefined
    && parser.ruleNames[yulStatementState.ruleIndex ?? -1] === 'yulStatement';
  const yulExpressionOk = yulExpressionState !== undefined
    && parser.ruleNames[yulExpressionState.ruleIndex ?? -1] === 'yulExpression';
  if (!prefixOk && !postfixOk && !postfixInnerOk && !statementOk
    && !yulBlockOk && !yulStatementOk && !yulExpressionOk) return;
  const orig = interp.adaptivePredict.bind(interp);
  const rparen = PARSER_LITERAL_TOKENS.rightParen;
  const comma = PARSER_LITERAL_TOKENS.comma;
  const semi = PARSER_LITERAL_TOKENS.semicolon;
  const rbrack = PARSER_LITERAL_TOKENS.rightBracket;
  const rbrace = PARSER_LITERAL_TOKENS.rightBrace;
  const assign = PARSER_LITERAL_TOKENS.assign;
  const lbrace = PARSER_LITERAL_TOKENS.leftBrace;
  const lbrack = PARSER_LITERAL_TOKENS.leftBracket;
  const lparen = PARSER_LITERAL_TOKENS.leftParen;
  const requireTok = tokenTypeByLiteral("'require'");
  const ifTok = tokenTypeByLiteral("'if'");
  const emitTok = tokenTypeByLiteral("'emit'");
  const returnTok = tokenTypeByLiteral("'return'");
  const forTok = tokenTypeByLiteral("'for'");
  const tryTok = tokenTypeByLiteral("'try'");
  const selfdestructTok = tokenTypeByLiteral("'selfdestruct'");
  const switchTok = tokenTypeByLiteral("'switch'");
  const uncheckedTok = tokenTypeByLiteral("'unchecked'");
  const assemblyTok = tokenTypeByLiteral("'assembly'");
  const continueTok = tokenTypeByLiteral("'continue'");
  const breakTok = tokenTypeByLiteral("'break'");
  const letTok = tokenTypeByLiteral("'let'");
  const colonEqTok = tokenTypeByLiteral("':='");
  const leaveTok = tokenTypeByLiteral("'leave'");
  const functionTok = tokenTypeByLiteral("'function'");
  const addressTok = tokenTypeByLiteral("'address'");
  const deleteTok = tokenTypeByLiteral("'delete'");
  const assertTok = tokenTypeByLiteral("'assert'");
  const revertTok = tokenTypeByLiteral("'revert'");
  const consoleTok = tokenTypeByLiteral("'console.log'");
  const doTok = tokenTypeByLiteral("'do'");
  const whileTok = tokenTypeByLiteral("'while'");
  const valueTok = tokenTypeByLiteral("'.value'");
  const sliceTok = tokenTypeByLiteral("'.slice'");
  const splitTok = tokenTypeByLiteral("'.split'");
  const reverseTok = tokenTypeByLiteral("'.reverse()'");
  const lengthTok = tokenTypeByLiteral("'.length'");
  const placeholderTok = tokenTypeByLiteral("'_'");
  const minusminusTok = tokenTypeByLiteral("'--'");
  const plusplusTok = tokenTypeByLiteral("'++'");
  const qmarkTok = tokenTypeByLiteral("'?'");
  const bitorTok = tokenTypeByLiteral("'|'");
  const bitxorTok = tokenTypeByLiteral("'^'");
  const bitandTok = tokenTypeByLiteral("'&'");
  const shrTok = tokenTypeByLiteral("'>>'");
  const shlTok = tokenTypeByLiteral("'<<'");
  const powTok = tokenTypeByLiteral("'**'");
  const ororTok = tokenTypeByLiteral("'||'");
  const andandTok = tokenTypeByLiteral("'&&'");
  const geTok = tokenTypeByLiteral("'>='");
  const leTok = tokenTypeByLiteral("'<='");
  const gtTok = tokenTypeByLiteral("'>'");
  const ltTok = tokenTypeByLiteral("'<'");
  const neqTok = tokenTypeByLiteral("'!='");
  const eqTok = tokenTypeByLiteral("'=='");
  const percentTok = tokenTypeByLiteral("'%'");
  const slashTok = tokenTypeByLiteral("'/'");
  const starTok = tokenTypeByLiteral("'*'");
  const minusTok = tokenTypeByLiteral("'-'");
  const plusTok = tokenTypeByLiteral("'+'");
  const dotTok = tokenTypeByLiteral("'.'");
  const isYulNameToken = (token: number): boolean =>
    token === SolidCashParser.Identifier
    || token === returnTok
    || token === revertTok
    || token === selfdestructTok
    || token === addressTok
    || token === SolidCashParser.BoundedBytes;
  const isYulLiteralToken = (token: number): boolean =>
    token === SolidCashParser.NumberLiteral
    || token === SolidCashParser.HexLiteral
    || token === SolidCashParser.HexStringLiteral
    || token === SolidCashParser.StringLiteral
    || token === SolidCashParser.BooleanLiteral;
  const looksLikeYulAssignment = (input: { LA(i: number): number }): boolean => {
    let i = 1;
    const consumePath = (): boolean => {
      if (!isYulNameToken(input.LA(i))) return false;
      i += 1;
      while (true) {
        const token = input.LA(i);
        if (token === lengthTok) {
          i += 1;
          continue;
        }
        if (token !== dotTok) return true;
        i += 1;
        const member = input.LA(i);
        if (member === addressTok || isYulNameToken(member)) {
          i += 1;
          continue;
        }
        return false;
      }
    };
    if (!consumePath()) return false;
    while (input.LA(i) === comma) {
      i += 1;
      if (!consumePath()) return false;
    }
    return input.LA(i) === colonEqTok;
  };
  interp.adaptivePredict = ((input, decision, ctx) => {
    if (prefixOk && decision === EXPRESSION_PREFIX_DECISION) {
      const alt = predictExpressionPrefix(input);
      if (alt !== undefined) return alt;
    }
    if (postfixOk && decision === EXPRESSION_POSTFIX_LOOP_DECISION) {
      const token = input.LA(1);
      if (token === rparen || token === comma || token === semi || token === rbrack
        || token === rbrace || token === assign || token === -1) {
        return EXPRESSION_POSTFIX_STOP;
      }
      if (token === valueTok) {
        const next = input.LA(2);
        if (next === lparen || next === lbrace) {
          return parser.precpred(ctx, 24) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
        }
        return parser.precpred(ctx, 21) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === sliceTok) {
        return parser.precpred(ctx, 27) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === splitTok) {
        return parser.precpred(ctx, 28) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === reverseTok) {
        return parser.precpred(ctx, 29) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === lengthTok) {
        const next = input.LA(2);
        if (next === lparen || next === lbrace) {
          return parser.precpred(ctx, 24) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
        }
        return parser.precpred(ctx, 29) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === minusminusTok) {
        return parser.precpred(ctx, 20) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === plusplusTok) {
        return parser.precpred(ctx, 20) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === qmarkTok) {
        return parser.precpred(ctx, 6) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === bitorTok) {
        return parser.precpred(ctx, 11) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === bitxorTok) {
        return parser.precpred(ctx, 12) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === bitandTok) {
        return parser.precpred(ctx, 13) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === shrTok) {
        return parser.precpred(ctx, 14) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === shlTok) {
        return parser.precpred(ctx, 14) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === powTok) {
        return parser.precpred(ctx, 17) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === ororTok) {
        return parser.precpred(ctx, 7) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === andandTok) {
        return parser.precpred(ctx, 8) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === geTok) {
        return parser.precpred(ctx, 10) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === leTok) {
        return parser.precpred(ctx, 10) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === gtTok) {
        return parser.precpred(ctx, 10) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === ltTok) {
        return parser.precpred(ctx, 10) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === neqTok) {
        return parser.precpred(ctx, 9) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === eqTok) {
        return parser.precpred(ctx, 9) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === percentTok) {
        return parser.precpred(ctx, 16) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === slashTok) {
        return parser.precpred(ctx, 16) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === starTok) {
        return parser.precpred(ctx, 16) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === minusTok) {
        return parser.precpred(ctx, 15) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === plusTok) {
        return parser.precpred(ctx, 15) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === dotTok) {
        return parser.precpred(ctx, 21) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
      if (token === lbrack) {
        return parser.precpred(ctx, 31) ? EXPRESSION_POSTFIX_CONTINUE : EXPRESSION_POSTFIX_STOP;
      }
    }
    if (postfixInnerOk && decision === EXPRESSION_POSTFIX_INNER_DECISION) {
      const innerTok = input.LA(1);
      if (innerTok === lbrack) {
        const after = skipBalanced(input, 1, lbrack, rbrack);
        const next = input.LA(after);
        if (next === lparen || next === lbrace) return EXPRESSION_POSTFIX_INDEXED_CALL;
        return EXPRESSION_POSTFIX_INDEXED;
      }
      if (innerTok === valueTok) {
        const next = input.LA(2);
        if (next === lparen || next === lbrace) return EXPRESSION_POSTFIX_METHOD;
        return EXPRESSION_POSTFIX_FIELD;
      }
      if (innerTok === sliceTok) return EXPRESSION_POSTFIX_SLICE;
      if (innerTok === splitTok) return EXPRESSION_POSTFIX_SPLIT;
      if (innerTok === reverseTok) return EXPRESSION_POSTFIX_UNARY_MEMBER;
      if (innerTok === lengthTok) {
        const next = input.LA(2);
        if (next === lparen || next === lbrace) return EXPRESSION_POSTFIX_METHOD;
        return EXPRESSION_POSTFIX_UNARY_MEMBER;
      }
      if (innerTok === minusminusTok) return EXPRESSION_POSTFIX_INC;
      if (innerTok === plusplusTok) return EXPRESSION_POSTFIX_INC;
      if (innerTok === qmarkTok) return EXPRESSION_POSTFIX_TERNARY;
      if (innerTok === bitorTok) return EXPRESSION_POSTFIX_BITOR;
      if (innerTok === bitxorTok) return EXPRESSION_POSTFIX_BITXOR;
      if (innerTok === bitandTok) return EXPRESSION_POSTFIX_BITAND;
      if (innerTok === shrTok) return EXPRESSION_POSTFIX_SHIFT;
      if (innerTok === shlTok) return EXPRESSION_POSTFIX_SHIFT;
      if (innerTok === powTok) return EXPRESSION_POSTFIX_POW;
      if (innerTok === ororTok) return EXPRESSION_POSTFIX_OR;
      if (innerTok === andandTok) return EXPRESSION_POSTFIX_AND;
      if (innerTok === geTok) return EXPRESSION_POSTFIX_CMP;
      if (innerTok === leTok) return EXPRESSION_POSTFIX_CMP;
      if (innerTok === gtTok) return EXPRESSION_POSTFIX_CMP;
      if (innerTok === ltTok) return EXPRESSION_POSTFIX_CMP;
      if (innerTok === neqTok) return EXPRESSION_POSTFIX_EQ;
      if (innerTok === eqTok) return EXPRESSION_POSTFIX_EQ;
      if (innerTok === percentTok) return EXPRESSION_POSTFIX_MUL;
      if (innerTok === slashTok) return EXPRESSION_POSTFIX_MUL;
      if (innerTok === starTok) return EXPRESSION_POSTFIX_MUL;
      if (innerTok === minusTok) return EXPRESSION_POSTFIX_ADD;
      if (innerTok === plusTok) return EXPRESSION_POSTFIX_ADD;
    }
    if (statementOk && decision === STATEMENT_DECISION) {
      const token = input.LA(1);
      if (token === placeholderTok) return STATEMENT_ALT_PLACEHOLDER;
      if (token === lbrace) return STATEMENT_ALT_BLOCK;
      if (token === requireTok) {
        if (input.LA(2) !== lparen) return orig(input, decision, ctx);
        // `timeOpStatement` and ordinary `requireStatement` share the `require (` prefix. Preserve the grammar's
        // exact `require ( TxVar >=` distinction in this optimized decision.
        return input.LA(3) === SolidCashParser.TxVar && input.LA(4) === PARSER_LITERAL_TOKENS.greaterOrEqual
          ? STATEMENT_ALT_TIME_OP : STATEMENT_ALT_REQUIRE;
      }
      if (token === ifTok) return STATEMENT_ALT_IF;
      if (token === emitTok) return STATEMENT_ALT_EMIT;
      if (token === returnTok) return STATEMENT_ALT_RETURN;
      if (token === forTok) return STATEMENT_ALT_LOOP;
      if (token === tryTok) return STATEMENT_ALT_TRY;
      if (token === selfdestructTok) return STATEMENT_ALT_SELFDESTRUCT;
      if (token === switchTok) return STATEMENT_ALT_SWITCH;
      if (token === uncheckedTok) return STATEMENT_ALT_UNCHECKED;
      if (token === assemblyTok) return STATEMENT_ALT_ASSEMBLY;
      if (token === continueTok) return STATEMENT_ALT_CONTINUE;
      if (token === breakTok) return STATEMENT_ALT_BREAK;
      if (token === deleteTok) return STATEMENT_ALT_DELETE;
      if (token === assertTok) return STATEMENT_ALT_ASSERT;
      if (token === revertTok) return STATEMENT_ALT_REVERT;
      if (token === consoleTok) return STATEMENT_ALT_CONSOLE;
      if (token === doTok) return STATEMENT_ALT_LOOP;
      if (token === whileTok) return STATEMENT_ALT_LOOP;
    }
    if (yulBlockOk && decision === YUL_BLOCK_LOOP_DECISION) {
      const token = input.LA(1);
      if (token === rbrace || token === -1) return YUL_BLOCK_LOOP_STOP;
      if (token === lbrace || token === letTok || token === ifTok || token === switchTok
        || token === forTok || token === functionTok || token === breakTok || token === continueTok
        || token === leaveTok || isYulNameToken(token) || isYulLiteralToken(token)) {
        return YUL_BLOCK_LOOP_CONTINUE;
      }
    }
    if (yulStatementOk && decision === YUL_STATEMENT_DECISION) {
      const token = input.LA(1);
      if (token === lbrace) return YUL_STMT_NESTED_BLOCK;
      if (token === letTok) return YUL_STMT_LET;
      if (token === ifTok) return YUL_STMT_IF;
      if (token === switchTok) return YUL_STMT_SWITCH;
      if (token === forTok) return YUL_STMT_FOR;
      if (token === functionTok) return YUL_STMT_FUNCTION;
      if (token === breakTok) return YUL_STMT_BREAK;
      if (token === continueTok) return YUL_STMT_CONTINUE;
      if (token === leaveTok) return YUL_STMT_LEAVE;
      if (isYulLiteralToken(token)) return YUL_STMT_LITERAL;
      if (isYulNameToken(token)) {
        if (looksLikeYulAssignment(input)) return YUL_STMT_ASSIGN;
        if (input.LA(2) === lparen) return YUL_STMT_CALL;
        return YUL_STMT_PATH;
      }
    }
    if (yulExpressionOk && decision === YUL_EXPRESSION_DECISION) {
      const token = input.LA(1);
      if (isYulLiteralToken(token)) return YUL_EXPR_LITERAL;
      if (isYulNameToken(token)) {
        return input.LA(2) === lparen ? YUL_EXPR_CALL : YUL_EXPR_PATH;
      }
    }
    return orig(input, decision, ctx);
  }) as typeof interp.adaptivePredict;
}

export function parseCode(
  code: string,
  errorListener: SolidCashErrorListener = ThrowingErrorListener.INSTANCE,
  evmCompat = false,
  chunkedArrays = true,
  importedFileId?: string,
  rootFileId?: string,
): Ast {
  // Solidity corpus files append diagnostic expectations after `// ----`; that trailer is test metadata, not
  // source text, and often repeats the SPDX spelling inside warning prose.
  if (evmCompat) {
    const diagnosticTrailer = code.includes('// ----') ? code.search(/\n\/\/ ----/) : -1;
    const spdxSource = diagnosticTrailer >= 0 ? code.slice(0, diagnosticTrailer) : code;
    // Large compatibility sources normally have no bidi overrides. The token walk is linear in file size; skip it unless a
    // direction marker is actually present.
    if (/[\u202a\u202b\u202c\u202d\u202e]/.test(spdxSource)) {
      validateUnicodeDirectionMarkers(spdxSource);
    }
    // Common Solidity flattener output retains one SPDX header per concatenated source and marks every boundary
    // with `// File <path>`. MistSwap ships these generated `*Flat.sol` units directly. Keep the ordinary Solidity
    // source-unit diagnostic, but admit this explicit flattened format without rewriting the user's checkout.
    const firstSpdx = spdxSource.indexOf('SPDX-License-Identifier');
    if (firstSpdx >= 0 && spdxSource.indexOf('SPDX-License-Identifier', firstSpdx + 1) >= 0) {
      const flattenedSource = spdxSource.includes('// File ') && /^\s*\/\/\s*File\s+\S+/m.test(spdxSource);
      const spdxIdentifiers = spdxIdentifiersInComments(spdxSource);
      if (!flattenedSource && new Set(spdxIdentifiers).size > 1) {
        throw new Error(
          'Multiple SPDX license identifiers found in source file. '
          + 'Use "AND" or "OR" to combine multiple licenses.',
        );
      }
    }
  }
  // Version-gated EVM instructions are ordinary Yul identifiers before their fork activates. Corpus fixtures
  // carry the requested EVM version in their harness trailer. Rename inactive spellings consistently so their
  // declarations remain legal, while an undeclared reference/call still produces the expected undefined-name
  // diagnostic. Equal-length replacements preserve all source offsets.
  if (evmCompat && code.includes('EVMVersion:')) {
    const inactiveYulNames: string[] = [];
    if (/\/\/\s*EVMVersion:\s*(?:<=\s*berlin|<\s*london)\b/i.test(code)) inactiveYulNames.push('basefee');
    if (/\/\/\s*EVMVersion:\s*<\s*paris\b/i.test(code)) inactiveYulNames.push('prevrandao');
    if (/\/\/\s*EVMVersion:\s*(?:<=\s*shanghai|<\s*cancun)\b/i.test(code)) {
      inactiveYulNames.push('blobhash', 'blobbasefee', 'mcopy', 'tload', 'tstore');
    }
    if (/\/\/\s*EVMVersion:\s*(?:=\s*prague|<\s*osaka)\b/i.test(code)) inactiveYulNames.push('clz');
    for (const name of inactiveYulNames) {
      // Do not rewrite the separate high-level `block.prevrandao` member (or any user-defined member).
      code = code.replace(new RegExp(`(?<!\\.)\\b${name}\\b`, 'g'), `${name.slice(0, -1)}_`);
    }
  }

  // A parser-recovery fixture in Solidity's corpus accepts a function header ending in the incomplete
  // `layout at` clause when only parsing is requested. The clause is not a function modifier (storage-layout
  // specifiers only belong to contracts), and has no BCH meaning. In import-compat mode, blank this exact
  // no-expression shape while retaining line/column positions; do not consume a real modifier invocation or
  // any expression between `at` and the body.
  if (evmCompat && code.includes('layout at')) {
    code = code.replace(
      /(\bfunction\b[^{};]*?)(\s+layout\s+at\s*)(?=\{)/g,
      (_m, header, clause) => header + clause.replace(/[^\r\n]/g, ' '),
    );
  }

  // Solidity's storage-layout specifier sets an EVM storage base slot. NFT-commitment state has no slot space, so
  // drop the clause so the contract parses and keep only its evaluated base (ContractNode.storageLayoutBase, set
  // below), which shifts the EVM-visible slot numbers. Anchored to a
  // contract header (so a `layout at .. {` inside a string / body is not touched) and stopping at
  // the body `{`. The clause may span lines and contain NatSpec comments; blank its non-newline characters so
  // downstream source locations keep their original line numbers. Native generated helpers have no such
  // clause; skip the two regex walks unless the source actually contains one.
  // Current Solidity grammar places the clause BEFORE inheritance (`contract C layout at 42 is A`); preserve the
  // `is A` tail rather than consuming it as part of the layout expression. Retain the older post-inheritance
  // spelling below for compatibility with sources SolidCash already accepted. solc's checks on the clause run first.
  let layoutBases: Map<string, bigint> | undefined;
  if (code.includes('layout at')) {
    const bases = withSourceFile(importedFileId, () => validateStorageLayoutSpecifiers(code));
    layoutBases = bases;
    const warnUnevaluated = (header: string): void => {
      const name = /\bcontract\s+(\w+)/.exec(header)?.[1];
      if (name !== undefined && !bases.has(name)) {
        emitCompilerWarning(`Warning: the \`layout at\` base slot of contract ${name} could not be evaluated - its EVM `
          + 'slot numbers (.slot, sload/sstore) are not offset by it.');
      }
    };
    code = code.replace(
      // eslint-disable-next-line max-len
      /(\bcontract\s+\w+\b)(\s+(?:(?:\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)\s*)*layout\s+at\s+)([^{};]+?)(\s+is\s+[^{}]*?)(?=\s*\{)/g,
      (_m, header, layoutPrefix, expr, inheritance) => {
        warnUnevaluated(header);
        return header + (layoutPrefix + expr).replace(/[^\r\n]/g, ' ') + inheritance;
      },
    );
    code = code.replace(
      // eslint-disable-next-line max-len
      /(\bcontract\s+\w+\b(?:\s+is\s+[^{}]*?)?)(\s+(?:(?:\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)\s*)*layout\s+at\s+([^{};]+?))(?=\s*\{)/g,
      (_m, header, clause) => {
        warnUnevaluated(header);
        return header + clause.replace(/[^\r\n]/g, ' ');
      },
    );
  }

  // X120. The file stamp has to cover LEXING AND PARSING, not only the AST build. An ANTLR error listener builds
  // its own `Location` from the offending token while the parse is still running, i.e. before
  // `AstBuilder.build()` opens the stamped scope, so every SYNTAX error in an imported file printed a bare
  // Line/Column that belongs to that file: `IERC5805.sol` (10 lines) reported `Mismatched input 'delegate' ... at
  // Line 63`, which is line 63 of the `IVotes.sol` it re-exports.
  //
  // `withSourceFile(undefined, ..)` for a root parse CLEARS an ambient stamp rather than inheriting one, so a
  // nested parse of compiler-generated source cannot pick up an importing file's id; the generated mark
  // wins over any file label anyway (`importedFileCaveat`).
  const parseStarted = compilerProfileEnabled() ? Date.now() : 0;
  let sllFailed = false;
  const lvalueKeyUnitsBefore = lvalueKeyUnitsBuilt();
  const ast = withSourceFile(importedFileId, () => {
    const lexer = new SolidCashLexer(new PackedCharStream(code) as unknown as CharStream);
    lexer.removeErrorListeners();
    lexer.addErrorListener(ThrowingErrorListener.INSTANCE);
    // Same sharing as the parser interpreter below: the generated lexer constructs a fresh
    // PredictionContextCache per instance, which rebuilds lexer prediction contexts on every imported file.
    lexer._interp = new LexerATNSimulator(
      lexer, SolidCashLexer._ATN, SolidCashLexer.DecisionsToDFA, SHARED_LEXER_PREDICTION_CONTEXT_CACHE,
    );
    const tokens = new CommonTokenStream(lexer);
    const parser = new SolidCashParser(tokens);
    // The TypeScript target gives every parser instance its own PredictionContextCache, so each parse rebuilds
    // the prediction contexts backing the (statically shared) DFA from scratch. The Java target shares one cache
    // across instances; do the same, so a process that parses many sources reuses that work instead of repaying it.
    parser._interp = new ParserATNSimulator(
      parser, SolidCashParser._ATN, SolidCashParser.DecisionsToDFA, SHARED_PREDICTION_CONTEXT_CACHE,
    );
    installExpressionPrefixFastPath(parser);
    parser.removeErrorListeners();
    parser.addErrorListener(ThrowingErrorListener.INSTANCE);
    // Solidity's semantic predicates (e.g. `hasFunctionCallAhead`) routinely defeat SLL. Trying SLL first on
    // `.sol` import graphs pays a full failed parse of the primary plus several library units before LL retries.
    // Native SolidCash and compiler-generated helpers still take the SLL fast path.
    const trySll = !evmCompat;
    let parseTree: ReturnType<SolidCashParser['sourceFile']>;
    const antlrStarted = compilerProfileEnabled() ? Date.now() : 0;
    if (trySll) {
      parser._interp.predictionMode = PredictionMode.SLL;
      parser._errHandler = new BailErrorStrategy();
      try {
        parseTree = parser.sourceFile();
      } catch {
        sllFailed = true;
        parser.reset();
        const llListener = new ForwardingErrorListener(errorListener);
        lexer.removeErrorListeners();
        lexer.addErrorListener(llListener);
        parser.removeErrorListeners();
        parser.addErrorListener(llListener);
        parser._interp.predictionMode = PredictionMode.LL;
        parser._errHandler = new DefaultErrorStrategy();
        parseTree = parser.sourceFile();
        llListener.throwFirstError();
      }
    } else {
      const llListener = new ForwardingErrorListener(errorListener);
      lexer.removeErrorListeners();
      lexer.addErrorListener(llListener);
      parser.removeErrorListeners();
      parser.addErrorListener(llListener);
      parser._interp.predictionMode = PredictionMode.LL;
      parser._errHandler = new DefaultErrorStrategy();
      parseTree = parser.sourceFile();
      llListener.throwFirstError();
    }

    const antlrMs = compilerProfileEnabled() ? Date.now() - antlrStarted : 0;
    // AST building
    const astStarted = compilerProfileEnabled() ? Date.now() : 0;
    const built = new AstBuilder(
      parseTree, evmCompat, chunkedArrays, code, importedFileId, rootFileId,
    ).build() as Ast;
    if (compilerProfileEnabled()) {
      profileLog('parseCode:file', parseStarted, {
        file: importedFileId ?? 'root',
        bytes: code.length,
        antlrMs,
        astBuilderMs: Date.now() - astStarted,
        sllFailed,
      });
    }
    return built;
  });
  if (compilerProfileEnabled()) {
    const ms = Date.now() - parseStarted;
    parseProfileTotals.files += 1;
    parseProfileTotals.bytes += code.length;
    parseProfileTotals.ms += ms;
    if (sllFailed) parseProfileTotals.sllFails += 1;
  }
  if (layoutBases?.size) {
    for (const contract of [ast.contract, ...ast.importedContracts]) {
      const base = contract ? layoutBases.get(contract.name) : undefined;
      if (base !== undefined) contract.storageLayoutBase = base;
    }
  }
  if (code.includes(BASE_IMPL_PREFIX)) assertNoReservedBaseNames(ast);
  // A source without imports declares every function its keys may call; one with imports binds after the merge.
  if (ast.imports.length === 0 && lvalueKeyUnitsBuilt() !== lvalueKeyUnitsBefore) bindLvalueKeyEffects(ast);
  return ast;
}

// Re-resolve array element types that parsed to a named AddressType placeholder (an imported struct not yet
// merged at parse time) to the real StructType, now that imports are merged. Scoped to the main contract's
// state variables + collections (the array-bearing declarations); a non-struct placeholder (interface array
// or a typo) is left untouched and validated downstream as before.
/**
 * solc caps a contract's storage at 2^256 slots, counting each state variable's size upper bound (no packing): a value,
 * mapping or dynamic array is one slot, a static array its length times its element, a struct the sum of its fields.
 */
function assertStorageWithinEvmSlots(contract: ContractNode): void {
  const slots = (type: Type, active: Set<StructType>): bigint => {
    if (type instanceof ArrayType && type.bound !== undefined) {
      return exactArrayLength(type)! * slots(type.elementType, active);
    }
    if (!(type instanceof StructType) || active.has(type)) return 1n;
    const nested = new Set(active).add(type);
    return type.fields.reduce((total, field) => total + slots(field.type, nested), 0n);
  };
  let total = BigInt(contract.collections.length);
  for (const variable of contract.stateVariables) {
    total += slots(variable.type, new Set());
    if (total >= 1n << 256n) throw new ContractStorageTooLargeError(contract);
  }
}

/**
 * solc refuses a struct that contains itself by value: directly, or through fixed-size arrays and other structs held
 * by value. A dynamic array or mapping ends that chain. Struct names shared by two definitions are not followed, so
 * same-named structs of different contracts cannot be mistaken for one another.
 */
function assertNoRecursiveStructDefinitions(ast: Ast): void {
  const definitions = [
    ...(ast.structDefinitions ?? []),
    ...(ast.contract?.structDefinitions ?? []),
    ...(ast.importedContracts ?? []).flatMap((contract) => contract.structDefinitions ?? []),
  ];
  const counts = new Map<string, number>();
  for (const definition of definitions) counts.set(definition.name, (counts.get(definition.name) ?? 0) + 1);
  const byName = new Map(definitions.filter((definition) => counts.get(definition.name) === 1)
    .map((definition) => [definition.name, definition]));
  const reaches = (type: Type, target: string, seen: Set<string>): boolean => {
    if (type instanceof ArrayType) return type.bound !== undefined && reaches(type.elementType, target, seen);
    const name = type instanceof StructType || type instanceof AddressType ? (type as { name?: string }).name : undefined;
    if (name === undefined || !byName.has(name)) return false;
    if (name === target) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return byName.get(name)!.fields.some((field) => reaches(field.type, target, seen));
  };
  for (const definition of byName.values()) {
    if (definition.fields.some((field) => reaches(field.type, definition.name, new Set()))) {
      throw new RecursiveStructDefinitionError(definition);
    }
  }
}

function reresolveImportedStructTypes(ast: Ast): void {
  const contract = ast.contract;
  if (!contract) return;
  const structMap = new Map<string, StructType>();
  for (const sd of ast.structDefinitions ?? []) structMap.set(sd.name, new StructType(sd.name, sd.fields));
  for (const sd of contract.structDefinitions) structMap.set(sd.name, new StructType(sd.name, sd.fields));
  // Imported/inherited enums likewise parse as named AddressType placeholders in local declarations because
  // their definitions are unavailable to AstBuilder until import resolution.
  const enumMap = new Map<string, EnumType>();
  for (const ed of ast.enumDefinitions ?? []) enumMap.set(ed.name, new EnumType(ed.name, ed.members));
  for (const imported of ast.importedContracts ?? []) {
    for (const ed of imported.enumDefinitions ?? []) enumMap.set(ed.name, new EnumType(ed.name, ed.members));
  }
  for (const ed of contract.enumDefinitions ?? []) enumMap.set(ed.name, new EnumType(ed.name, ed.members));
  // Imported user-defined value types (`type UD2x18 is uint64`) parse to the same named-AddressType placeholder as
  // imported structs when used as a param/return/var type; resolve them to the real ValueType too.
  const udvtMap = new Map<string, ValueType>();
  for (const td of ast.typeDefinitions ?? []) udvtMap.set(td.name, td.valueType);
  for (const td of contract.typeDefinitions ?? []) udvtMap.set(td.name, td.valueType);
  // Selectively importing an error/event does not expose that declaration's supporting type names in the
  // consumer's source scope, but their AST parameters still need the definitions from the originating source.
  // Walk resolved import units for type lookup only (without merging those names into the consumer symbol scope).
  const seenSources = new Set<SourceFileNode>();
  const collectImportedTypes = (source: SourceFileNode): void => {
    if (seenSources.has(source)) return;
    seenSources.add(source);
    for (const td of source.typeDefinitions ?? []) udvtMap.set(td.name, td.valueType);
    for (const sd of source.structDefinitions ?? []) structMap.set(sd.name, new StructType(sd.name, sd.fields));
    for (const ed of source.enumDefinitions ?? []) enumMap.set(ed.name, new EnumType(ed.name, ed.members));
    for (const imported of source.imports ?? []) {
      if (imported.resolvedAst) collectImportedTypes(imported.resolvedAst);
    }
  };
  collectImportedTypes(ast);
  if (structMap.size === 0 && enumMap.size === 0 && udvtMap.size === 0) return;
  const resolveName = (name: string): Type | undefined => {
    if (structMap.has(name)) return structMap.get(name)!;
    if (enumMap.has(name)) return enumMap.get(name)!;
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
    // a dynamically allocated struct array's `.elementType`, a cast's `.type`, and a function/interface-function's `returns`
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
  // Fix the primary AND every imported contract: an imported contract's own state variable with an imported
  // library-struct type is still type-checked, so its placeholder must resolve.
  // CollectionNode.type is ArrayType | MappingType; fix() resolves an imported struct placeholder in an array's
  // element OR a mapping's key/value (`mapping(uint => Escrow)`) in place, so just call it on every collection.
  const fixContract = (c: ContractNode): void => {
    for (const sv of c.stateVariables) sv.type = fix(sv.type);
    for (const col of c.collections) col.type = fix(col.type) as typeof col.type;
    // Event parameters carry plain `{name, type}` objects (not Nodes), so fixDecls's Node walk misses them: an
    // `event X(Escrow escrow)` placeholder must be resolved here too, else the event signature / emit see address.
    for (const ev of c.eventDefinitions ?? []) for (const p of ev.parameters ?? []) p.type = fix(p.type);
    for (const err of c.errorDefinitions ?? []) for (const p of err.parameters ?? []) p.type = fix(p.type);
  };
  fixContract(contract);
  for (const ic of ast.importedContracts ?? []) fixContract(ic);
  // Error parameters are plain objects rather than Nodes, so the recursive node walk below cannot reach them.
  // File-level and interface errors are both valid import targets and must receive the same placeholder repair.
  for (const err of ast.errorDefinitions ?? []) for (const p of err.parameters ?? []) p.type = fix(p.type);
  for (const iface of ast.interfaceDefinitions ?? []) {
    for (const err of iface.errorDefinitions ?? []) for (const p of err.parameters ?? []) p.type = fix(p.type);
  }
  // validateKnownUserTypes walks ImportNode.resolvedAst as well as declarations merged into the root. Repair the
  // plain-object event/error parameters in every resolved source unit too; fixDecls below handles their Node-based
  // declarations, but cannot descend into these parameter records.
  for (const source of seenSources) {
    fixContract(source.contract);
    for (const importedContract of source.importedContracts ?? []) fixContract(importedContract);
    for (const ev of source.eventDefinitions ?? []) for (const p of ev.parameters ?? []) p.type = fix(p.type);
    for (const err of source.errorDefinitions ?? []) for (const p of err.parameters ?? []) p.type = fix(p.type);
    for (const iface of source.interfaceDefinitions ?? []) {
      for (const ev of iface.eventDefinitions ?? []) for (const p of ev.parameters ?? []) p.type = fix(p.type);
      for (const err of iface.errorDefinitions ?? []) for (const p of err.parameters ?? []) p.type = fix(p.type);
    }
  }
  // Comprehensive: fix placeholder param / local / return types everywhere in the merged AST (contract +
  // imported contracts + interfaces + free functions), so imported-struct locals, params, and external-call
  // return types all resolve to the real struct.
  fixDecls(ast);
}
