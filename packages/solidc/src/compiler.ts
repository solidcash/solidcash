import { CharStream, CommonTokenStream } from 'antlr4';
import { binToHex } from '@bitauth/libauth';
import {
  Artifact, ArtifactMap, ArrayType, AddressType, asmToBytecode, BytesType, CompilerOptions,
  computeBytecodeFingerprintWithConstructorArgs, computeFunctionSelector, computeFunctionSignature,
  encodeComputedBlockhashKey, EnumType, FunctionType, generateSourceMap, MappingType,
  MAX_MESSAGE_BUS_BLOB_BYTES,
  optimiseBytecode, optimiseBytecodeOld, OPTIMISER_COMPAT_CHECK_MAX_OPS, PrimitiveType, scriptToAsm,
  scriptToBytecode, bytecodeToScript, decodeInt, Op, ATOMIC_MESSAGE_BUS_DOMAIN_HEX,
  ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS, ATOMIC_MESSAGE_BUS_MAX_ROWS,
  sourceMapToLocationData, SplitArtifactBundle, SplitStateFootprint, StructType, TupleType, Type,
  ValueType, BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  messageBusVerifierLockingBytecode,
} from '@solidcash/utils';
import { generateArtifact, generateDeclarationArtifact } from './artifact/Artifact.js';
import {
  Ast, AssignNode, BinaryOpNode, BlockNode, BoolLiteralNode, ContractNode, ContractReferenceNode, EmitStatementNode,
  ExpressionNode, FieldAccessNode,
  FunctionCallNode, FunctionDefinitionNode, InterfaceFunctionNode, InterfaceNode,
  ExternalFunctionCallNode, ExternalOutputStateAccessNode, FunctionModifier, HexLiteralNode, IdentifierNode,
  InstantiationNode,
  ArrayAccessNode, ArrayAssignNode, ArrayDeleteNode, CollectionIterationNode,
  FunctionCallStatementNode,
  LowLevelCallNode, LowLevelCallStatementNode, MappingAccessNode, MappingAssignNode, MappingDeleteNode, MappingFieldAssignNode,
  MethodCallNode, MethodCallStatementNode, Node, ParameterNode, RequireNode,
  NullaryOpNode, TupleAssignmentNode, VariableDefinitionNode,
  SourceFileNode, StatementNode, TransferStatementNode, TypeIntrospectionNode, AbiDecodeNode, ReturnNode,
  TokenContainerMethodStatementNode,
  AssemblyStatementNode, CastNode, IntLiteralNode, TryCatchNode, StateVariableVisibility,
} from './ast/AST.js';
import AstBuilder from './ast/AstBuilder.js';
import { GlobalFunction } from './ast/Globals.js';
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
import LowerTailRecursion from './semantic/LowerTailRecursion.js';
import DesugarNestedBranchReturn from './semantic/DesugarNestedBranchReturn.js';
import SynthesizeExternalAddressLocals from './semantic/SynthesizeExternalAddressLocals.js';
import HoistBranchLocalExtcallTargets from './semantic/HoistBranchLocalExtcallTargets.js';
import HoistPointerTableBranchLocals from './semantic/HoistPointerTableBranchLocals.js';
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
import ExpandBoundedPointerTableLoop from './semantic/ExpandBoundedPointerTableLoop.js';
import { validateLowLevelCallShapes } from './semantic/LowLevelCallShapes.js';
import {
  PointerTableExpansion, PointerTableExpansionMap, ProvenLoopCeilingMap,
} from './semantic/PointerTableBound.js';
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
import expandModifiers, { validateModifierDefinitions } from './semantic/ModifierExpansionTransformation.js';
import FoldHashLiterals from './semantic/FoldHashLiterals.js';
import LowerStorageSlotPointers from './semantic/LowerStorageSlotPointers.js';
import expandBreakContinue from './semantic/BreakContinueTransformation.js';
import expandInheritance from './semantic/InheritanceExpansionTransformation.js';
import autoMarkDelegateFunctions from './semantic/AutoMarkDelegateFunctions.js';
import lowerTransientStateVars from './semantic/LowerTransientStateVars.js';
import { ImportResolver } from './ImportResolver.js';
import {
  AbstractContractInstantiationError, CircularContractReferenceError, LibrarySelfExternalCallError,
  UndefinedReferenceError, UnknownContractTypeError, EmittingStateHelperEventError, SolidcDiagnosticError,
} from './Errors.js';
import { generatedOriginOf, Location, Point, withGeneratedSource, withSourceFile } from './ast/Location.js';
import { MAX_INPUT_BYTESIZE } from './constants.js';
import {
  analyseContractInvocations, analyseFunctionFootprint, collectNamedFunctionClosure, directCallNames,
  walkInvocationAst,
} from './analysis/InvocationAnalysis.js';
import { BinaryOperator, NullaryOperator } from './ast/Operator.js';
import { cloneNode } from './ast/clone.js';

export const DEFAULT_COMPILER_OPTIONS: CompilerOptions = {
  enforceFunctionParameterTypes: true,
  enforceLocktimeGuard: true,
  enforceFinalRequire: false,
  commitmentLimit: 128,
  chunkedArrays: true,
  chainId: 0,
};

/** Apply compiler defaults without allowing an explicitly present `undefined` to disable a default-on feature. */
type InternalCompilerOptions = CompilerOptions & { __messageBusExplicitlyDisabled?: boolean };

function normalizeCompilerOptions(options: CompilerOptions): InternalCompilerOptions {
  const normalized = {
    ...DEFAULT_COMPILER_OPTIONS,
    ...options,
    messageBus: options.messageBus === false ? false : true,
    __messageBusExplicitlyDisabled: false,
    // Compiler-owned route locals are generated source and never user-actionable warning locations.
    __suppressGeneratedRouteWarnings: true,
  } as InternalCompilerOptions;
  // Solidity's builtin returns the canonical 20-byte EVM address. Preserve an explicit projection override.
  if (normalized.solidityImportCompat && options.ecrecover === undefined) normalized.ecrecover = 'evm';
  return normalized;
}

export interface CompileOptions extends CompilerOptions {
  errorListener?: SolidCashErrorListener;
  /** Select a named top-level contract instead of the source file's last concrete contract. */
  primaryContractName?: string;
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

/**
 * Clone an artifact without forcing its lazy delegate variant. `structuredClone()` reads enumerable getters,
 * which would eagerly run the second compiler pass whenever SOLIDC_COMPILE_CACHE=1 (including the SDK tests).
 * Keep the cache's artifact as the single variant owner; each returned clone materializes its own cloned variant
 * only when a consumer actually reads `delegateArtifact`.
 */
function cloneArtifact(artifact: Artifact): Artifact {
  const delegateDescriptor = Object.getOwnPropertyDescriptor(artifact, 'delegateArtifact');
  if (!delegateDescriptor?.get) return structuredClone(artifact);

  const withoutDelegate = Object.fromEntries(
    Object.keys(artifact)
      .filter((key) => key !== 'delegateArtifact')
      .map((key) => [key, artifact[key as keyof Artifact]]),
  ) as unknown as Artifact;
  const cloned = structuredClone(withoutDelegate);
  let memo: Artifact | undefined;
  let built = false;
  Object.defineProperty(cloned, 'delegateArtifact', {
    enumerable: true,
    configurable: true,
    get(): Artifact | undefined {
      if (!built) {
        const variant = delegateDescriptor.get!.call(artifact) as Artifact | undefined;
        memo = variant ? structuredClone(variant) : undefined;
        built = true;
      }
      return memo;
    },
    set(value: Artifact | undefined): void { memo = value; built = true; },
  });
  return cloned;
}

/**
 * X100. The channel that lets the route-generation refusal name the handler whose shape actually threw.
 *
 * `spans` is recorded by route synthesis before anything downstream can throw: one entry per EXTERNAL entry
 * point it considered, keyed by name and declaration position. `refused` is read at the visibility arm, so a
 * key in it lands `external-handler-route-generation-unsupported` on that ONE handler while its clean siblings
 * keep their route - instead of the whole contract losing its route because one sibling was gapped.
 */
interface ExternalAdmissionAttribution {
  /** Handler keys to refuse on this compile. Empty on the first attempt. */
  refused: Set<string>;
  /** One entry per external entry point route synthesis considered. Accumulated across attempts, deduped. */
  spans: { key: string; name: string; location?: Location }[];
}

/** Identity of one source handler: name plus declaration position, so two overloads stay distinct. */
function externalHandlerKey(fn: FunctionDefinitionNode): string {
  const start = fn.location?.start;
  return `${fn.name}@${start ? `${start.line}:${start.column}` : '?'}`;
}

/** Record `fn` as an external entry point the route considered. Idempotent across ladder attempts. */
function recordExternalHandlerSpan(
  attribution: ExternalAdmissionAttribution | undefined, fn: FunctionDefinitionNode,
): void {
  if (!attribution) return;
  const key = externalHandlerKey(fn);
  if (attribution.spans.some((span) => span.key === key)) return;
  attribution.spans.push({ key, name: fn.name, location: fn.location });
}

/** Name prefixes of the internal clones route synthesis dispatches a source handler through. */
const MESSAGE_BUS_CLONE_PREFIXES = [
  '__message_bus_resource_', '__message_bus_handler_', '__message_bus_graph_', '__message_bus_array_', '__message_bus_external_',
];

const withinSpan = (location: Location, point: Point): boolean => {
  const after = point.line > location.start.line
    || (point.line === location.start.line && point.column >= location.start.column);
  const before = point.line < location.end.line
    || (point.line === location.end.line && point.column <= location.end.column);
  return after && before;
};

/**
 * The external handlers a thrown route-generation error implicates, by the two channels an error can carry.
 *
 * NAME: the message names one of the internal clones route synthesis pushed - `Block layout not available while
 * compiling '__message_bus_external_deposit'` is a plain Error with no position at all, so nothing but the name is
 * available. The longest matching handler name wins, so `transfer` is not blamed for `transferFrom`.
 * POSITION: a SolidCashError carries `node.location`, and `cloneNode` shares Location objects, so a diagnostic
 * raised inside a clone still points into the handler that was cloned. Accepted only when exactly one recorded
 * span contains it; an ambiguous or generated position names no handler.
 *
 * Only external entry points are ever recorded, so the same shape spelled `public` keeps hard-throwing - that
 * asymmetry is deliberate and is what keeps the refusal a statement about the route rather than about the code.
 */
function attributeExternalHandlerRefusal(
  error: unknown, attribution: ExternalAdmissionAttribution,
): string[] {
  const candidates = attribution.spans.filter((span) => !attribution.refused.has(span.key));
  if (candidates.length === 0) return [];
  const message = error instanceof Error ? error.message : '';
  let named: string | undefined;
  for (const prefix of MESSAGE_BUS_CLONE_PREFIXES) {
    for (const span of candidates) {
      if (!message.includes(`${prefix}${span.name}`)) continue;
      if (named === undefined || span.name.length > named.length) named = span.name;
    }
  }
  if (named !== undefined) {
    return candidates.filter((span) => span.name === named).map((span) => span.key);
  }
  const location = (error as { node?: { location?: Location } } | undefined)?.node?.location;
  if (!location || generatedOriginOf(location)) return [];
  const containing = candidates.filter((span) => span.location !== undefined
    && !generatedOriginOf(span.location) && withinSpan(span.location, location.start));
  return containing.length === 1 ? [containing[0].key] : [];
}

/** Handlers the route actually admitted, or 0 when the artifact carries no route at all. */
function admittedHandlerCount(artifact: Artifact): number {
  return (artifact.messageBus?.handlers ?? []).filter((handler) => handler.eligible).length;
}

/** Rounds of one-handler-at-a-time attribution before the whole-route refusal is reached. */
const MAX_ATTRIBUTED_EXTERNAL_REFUSALS = 4;

/**
 * X73 SAFETY NET. Admitting `external` entry points must never make a contract WORSE, and a contract that used
 * to compile as a bus participant and now does not is strictly worse.
 *
 * The route's own refusals are decided at synthesis time, but whether the generated wrapper can actually be
 * compiled is not known until semantic analysis and code generation have run over it - and the corpus turned up
 * fourteen files where the newly admitted external handler reaches a route-generation gap that its refusal used
 * to hide (a parameter type the row schema cannot render, a handler whose external-call edges the graph route
 * rejects, a storage-slot writer whose clone has no block layout). Every one of those is a pre-existing route
 * limitation; X73 only made the route try.
 *
 * So compile once with the external entry points admitted, and if that throws, compile once more with them
 * refused. The retry differs in exactly one thing, so a retry that succeeds proves the admission caused the
 * failure. A retry that also throws re-raises the ORIGINAL error, and a contract with no external entry point
 * compiles identically both times - nothing is masked in either case.
 */
function compileWithExternalAdmissionFallback(
  code: string,
  mergedCompilerOptions: CompilerOptions,
  errorListener?: SolidCashErrorListener,
  primaryContractName?: string,
): Artifact {
  const attribution: ExternalAdmissionAttribution = { refused: new Set(), spans: [] };
  // Parse exactly once before entering the route-admission retry ladder. Syntax errors and custom listener
  // failures are properties of the source, not of a route candidate; replaying them at every rung duplicates
  // listener notifications and can replace the user's first diagnostic with retry noise.
  let initialAst: Ast | undefined = parseAndResolve(
    code, mergedCompilerOptions, errorListener, primaryContractName,
  );
  const compileOnce = (
    admitExternalHandlers: boolean, normalizeBareEntries = true, relaxResultRouteEffects = true,
    admitMixedScalarHandlers = true, admitBareForwardingHandlers = true,
  ): Artifact => {
    const ast = initialAst ?? parseAndResolve(code, mergedCompilerOptions, errorListener, primaryContractName);
    initialAst = undefined;
    return compileResolvedAst(
      ast, code, mergedCompilerOptions, false, admitExternalHandlers, normalizeBareEntries, relaxResultRouteEffects,
      admitMixedScalarHandlers, admitBareForwardingHandlers, attribution,
    );
  };
  if (!mergedCompilerOptions.messageBus) return compileOnce(true);
  // X76 joins the ladder for the same reason and with the same cost: normalizing the clone's bare entry
  // spelling makes the route TRY a handler its refusal used to hide, and the solc corpus turned up four files
  // where that reaches a pre-existing route-generation gap ('Block layout not available while compiling
  // __message_bus_resource_transfer', 'Graph handler .. requires forwarded identifier arguments'). Those throw for the
  // WHOLE FILE, so a sibling contract that compiles fine is dropped with it. Each rung refuses one more thing
  // than the last, the widest that compiles wins, and the FIRST error is re-raised when none does - so no
  // contract is worse off than at the narrowest rung, and nothing is masked.
  // Monotone: each rung gives up one relaxation, and the last two reproduce X73's ladder exactly - so a contract
  // that compiled at 77cd1e8c still compiles, whatever the wider rungs do.
  //
  // X94 joins as the WIDEST rung and is therefore the FIRST thing given up, which keeps the four rungs below it
  // byte-for-byte the ladder that shipped: a contract whose scalar handler reaches a route-generation gap loses
  // only that admission and lands on the previously shipped answer rather than on a narrower one.
  const ladder: [boolean, boolean, boolean, boolean][] = [
    [true, true, true, true],
    [true, true, true, false], [true, true, false, false],
    [true, false, false, false], [false, false, false, false],
  ];
  let firstError: unknown;
  let latestError: unknown;
  // The rungs that still admit every external handler. Walked exactly as the shipped ladder walks them, so a
  // contract that compiles at any of them returns the same artifact it returned before X100.
  const admittingRungs = ladder.filter((rung) => rung[0]);
  for (const [
    admitExternalHandlers, normalizeBareEntries, relaxResultRouteEffects, admitMixedScalarHandlers,
  ] of admittingRungs) {
    try {
      return compileOnce(
        admitExternalHandlers, normalizeBareEntries, relaxResultRouteEffects, admitMixedScalarHandlers,
      );
    } catch (error) {
      firstError ??= error;
      latestError = error;
      // X229. A newly admitted bare forwarder may expose a pre-existing route-generation gap. Retrying the
      // SAME rung with only that new admission disabled preserves every previously dispatchable sibling and
      // every unrelated relaxation. Falling to the next rung instead can demote a proven handler even though
      // that handler did not cause the throw.
      try {
        return compileOnce(
          admitExternalHandlers, normalizeBareEntries, relaxResultRouteEffects, admitMixedScalarHandlers, false,
        );
      } catch (withoutBareError) {
        latestError = withoutBareError;
      }
    }
  }
  // X100. Every admitting rung has thrown, which is exactly where the shipped ladder gave up on `external`
  // ALTOGETHER: the last rung stamps `external-handler-route-generation-unsupported` on every external entry
  // point that reaches the visibility arm, so two handlers that are admissible on their own are both refused and
  // a contract with no public entry point loses its route entirely. Measured on a 3-handler synthetic and on the
  // application corpus, that is a 12-contract frontier rather than a 30-handler one.
  //
  // The throw, however, is attributable: it either names one of the internal clones synthesis pushed or carries a
  // position inside the handler that was cloned. Refuse THAT handler and try again, one handler per round, so the
  // outcome is a named refusal on the gapped handler with its siblings still routed.
  let attributed: Artifact | undefined;
  for (let round = 0; round < MAX_ATTRIBUTED_EXTERNAL_REFUSALS && attributed === undefined; round += 1) {
    const named = attributeExternalHandlerRefusal(latestError, attribution);
    if (named.length === 0) break;
    for (const key of named) attribution.refused.add(key);
    try {
      attributed = compileOnce(...ladder[0]);
    } catch (error) {
      latestError = error;
    }
  }
  // A handler can be gapped AND the widest rung independently unavailable, so try the accumulated refusal set
  // against the narrower admitting rungs too. All of them are wider than the whole-route refusal below.
  if (attributed === undefined && attribution.refused.size > 0) {
    for (const rung of admittingRungs.slice(1)) {
      try {
        attributed = compileOnce(...rung);
        break;
      } catch (error) {
        latestError = error;
      }
    }
  }
  // The shipped narrowest rung, and the comparison that makes "never worse" a rule rather than an expectation:
  // `admitExternalHandlers` false refuses every external handler, so the attributed answer is kept only when it
  // admits at least as many handlers. A per-handler refusal that somehow reshaped the route into a smaller one
  // therefore loses to the answer that shipped, and a contract can only gain handlers here.
  let refusedAll: Artifact | undefined;
  try {
    refusedAll = compileOnce(false, false, false, false);
  } catch (error) {
    firstError ??= error;
  }
  if (attributed !== undefined
    && (refusedAll === undefined || admittedHandlerCount(attributed) >= admittedHandlerCount(refusedAll))) {
    return attributed;
  }
  if (mergedCompilerOptions.__messageBusVerifierProgram && attributed === undefined && firstError) {
    throw firstError instanceof Error ? firstError : new Error(String(firstError));
  }
  if (refusedAll !== undefined) return refusedAll;

  // The verifier-binder second pass is compiler-internal: falling back to a direct-only artifact would silently
  // discard the verifier program after the first pass succeeded. Surface the generated-route defect instead.
  if (mergedCompilerOptions.__messageBusVerifierProgram && firstError) {
    throw firstError instanceof Error ? firstError : new Error(String(firstError));
  }

  // Default-on route synthesis must not make an otherwise valid direct contract uncompilable. Every route rung
  // failed above, so compile once with the capability explicitly disabled. If the source itself is invalid this
  // attempt throws its original direct-mode diagnostic (rather than an incidental failure from a generated message-bus batch
  // clone); if it succeeds, the resolved compiler options truthfully publish the fallback as direct-only.
  const directOptions = { ...mergedCompilerOptions, messageBus: false };
  try {
    return compileResolvedAst(
      parseAndResolve(code, directOptions, errorListener, primaryContractName),
      code, directOptions, false, true,
    );
  } catch (directError) {
    throw directError ?? firstError;
  }
}

export function compileString(code: string, compilerOptions: CompileOptions = {}): Artifact {
  const { errorListener, primaryContractName, ...artifactCompilerOptions } = compilerOptions;
  const cacheable = process.env.SOLIDC_COMPILE_CACHE === '1'
    && !errorListener && !artifactCompilerOptions.importResolver;
  let cacheKey = '';
  if (cacheable) {
    cacheKey = `${code}\x00${JSON.stringify(artifactCompilerOptions)}`;
    const hit = compileCache.get(cacheKey);
    if (hit) return cloneArtifact(hit);
  }
  const mergedCompilerOptions = normalizeCompilerOptions(artifactCompilerOptions);
  mergedCompilerOptions.__messageBusExplicitlyDisabled = artifactCompilerOptions.messageBus === false;
  let artifact = compileWithExternalAdmissionFallback(
    code, mergedCompilerOptions, errorListener, primaryContractName,
  );
  if (process.env.SOLIDC_SKIP_MESSAGE_BUS_BINDER !== '1'
    && !artifactCompilerOptions.__messageBusVerifierProgram && artifact.messageBus?.verifierProgram) {
    const verifierProgram = artifact.messageBus.verifierProgram;
    const bindingOptions = normalizeCompilerOptions({
      ...artifactCompilerOptions,
      __messageBusVerifierProgram: verifierProgram,
    });
    artifact = compileResolvedAst(
      parseAndResolve(code, bindingOptions, errorListener, primaryContractName),
      code, bindingOptions,
    );
    if (artifact.messageBus) artifact.messageBus.verifierProgram = verifierProgram;
    if (artifact.compiler.options) delete artifact.compiler.options.__messageBusVerifierProgram;
  }
  attachDelegateVariant(artifact, code, mergedCompilerOptions, errorListener, primaryContractName);
  if (cacheable) compileCache.set(cacheKey, artifact);
  return cacheable ? cloneArtifact(artifact) : artifact;
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
  errorListener?: SolidCashErrorListener, primaryName?: string,
): void {
  if (mergedCompilerOptions.autoDelegate || artifact.isLibrary) return;
  // Cheap pre-filter on the standalone ABI, so only contracts that could BE an implementation pay for the second
  // compile: stateful, with an externally-callable state-writing function carrying no disqualifying modifier.
  // Conservative in the same direction as writesState (a false positive costs one wasted compile, never a
  // missing variant); AutoMarkDelegateFunctions makes the real decision.
  const hasStatefulBacking = !!artifact.stateLayout || !!artifact.usesBlockhash
    || !!mergedCompilerOptions.forceStateful || artifact.abi.some((f) => (f.emits?.length ?? 0) > 0);
  if (!hasStatefulBacking) return;
  const couldBeImplementation = artifact.abi.some((f) => f.writesState !== false
    && !f.isFallback && !f.isReceive
    && !f.modifiers?.some((m) => DELEGATE_INELIGIBLE_MODIFIERS.includes(m)));
  if (!couldBeImplementation) return;

  const buildVariant = (): Artifact | undefined => {
    // Proxy implementation bytecode is selected by the SDK for delegate execution, not dispatched through the
    // atomic message-bus route. Keeping route synthesis enabled here can clone the soon-to-be-delegate handlers
    // before AutoMarkDelegateFunctions rewrites their covenant shape, producing an invalid hybrid artifact.
    const variantOptions = { ...mergedCompilerOptions, autoDelegate: true, messageBus: false };
    const out = { delegateFunctionsMarked: 0 };
    let variantFailure: string | undefined;
    let built: Artifact | undefined;
    // The variant recompiles the same source, so every warning would otherwise be printed a second time.
    const { log, warn } = console;
    console.log = (): void => {};
    console.warn = (): void => {};
    try {
      const variantAst = parseAndResolve(code, variantOptions, errorListener, primaryName);
      const variant = compileResolvedAst(
        variantAst, code, variantOptions, false, true, true, true, true, true, undefined, false, out,
      );
      if (out.delegateFunctionsMarked > 0) {
        built = variant;
      }
    } catch (e) {
      // The delegate variant is an extra capability, never a reason to fail a valid standalone compile. But do
      // not swallow the reason: otherwise asDelegate() reports "no delegate variant" with no trace of why.
      variantFailure = e instanceof Error ? e.message : String(e);
    } finally {
      console.log = log;
      console.warn = warn;
    }
    if (variantFailure !== undefined) {
      console.log(
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

const MESSAGE_BUS_SELECTOR_HEX = '53434231';

export function assertNoReservedMessageBusSelector(
  functions: readonly Pick<FunctionDefinitionNode, 'name' | 'functionSelector' | 'location'>[],
): void {
  const collision = functions.find((fn) => fn.functionSelector
    && binToHex(fn.functionSelector) === MESSAGE_BUS_SELECTOR_HEX);
  if (!collision) return;
  throw new SolidcDiagnosticError(
    'MESSAGE_BUS_RESERVED_SELECTOR_COLLISION',
    'source function selector collides with reserved message-bus selector 0x53434231',
    {
      selector: MESSAGE_BUS_SELECTOR_HEX,
      functionName: collision.name,
      sourceLocation: {
        line: collision.location.start.line,
        column: collision.location.start.column,
      },
    },
  );
}

export type MessageBusStaticRejectionCode = NonNullable<
NonNullable<Artifact['messageBus']>['handlers'][number]['rejectionCode']
>;

/** Classify every published route refusal into one of callManifest-v1 section 9.2's stable classes. */
export function classifyMessageBusRejection(reason: string): MessageBusStaticRejectionCode {
  if (/foreign-(outstate|intermediate-state)/.test(reason)) return 'MESSAGE_BUS_FOREIGN_INTERMEDIATE_STATE_READ';
  if (/(future|ancestor|result-before-use)/.test(reason)) return 'MESSAGE_BUS_FUTURE_RESULT_DEPENDENCY';
  if (/(unbounded-recursion|external-recursion)/.test(reason)) return 'MESSAGE_BUS_EXTERNAL_RECURSION_UNBOUNDED';
  if (/(ambiguous-global-and-row-key|duplicate-settlement-authority)/.test(reason)) {
    return 'MESSAGE_BUS_DUPLICATE_SETTLEMENT_AUTHORITY';
  }
  if (/(stack|context|introspection-divergence|would-shrink-the-route|route-generation-unsupported)/.test(reason)) {
    return 'MESSAGE_BUS_STACK_CONTEXT_UNPRESERVABLE';
  }
  if (/(effect|event|transfer|token|signature-route-binding|resource.*cannot-be-summarized)/.test(reason)) {
    return 'MESSAGE_BUS_EFFECT_UNSUMMARIZABLE';
  }
  return 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT';
}
const MAX_MESSAGE_BUS_ROWS = 8;
const RESOURCE_SHAPED_BATCH_ROWS = 2;

type InvocationExternalCall = NonNullable<Artifact['abi'][number]['externalCalls']>[number];

/**
 * Publish an expanded pointer-table dispatch loop as ONE bounded loop callsite in the invocation analysis.
 *
 * The compiler expands a bounded table into `count` syntactic callsites so every reached row has a
 * compile-time-constant table index; the ABI keeps those physical rows because direct (non-graph) execution
 * binds each one. Graph expansion instead needs the SOURCE shape: one dispatch site whose reached-row count is a
 * runtime value with an explicit compiler-proven ceiling. Coalescing is skipped whenever the correspondence is
 * not exact, so an unrecognized shape keeps the physical rows rather than publishing a wrong bound.
 */
function coalesceExpandedPointerTable(
  functionName: string,
  calls: readonly InvocationExternalCall[],
  expansions: PointerTableExpansionMap,
): readonly InvocationExternalCall[] {
  const groups: PointerTableExpansion[] | undefined = expansions.get(functionName);
  if (!groups || groups.length !== 1) return calls;
  const { count } = groups[0];
  if (count < 1) return calls;
  const dispatch = calls
    .map((call, index) => (call.selectorArrayVar || call.fnPtrCall) ? index : -1)
    .filter((index) => index >= 0);
  if (dispatch.length !== count) return calls;
  if (dispatch[count - 1] - dispatch[0] !== count - 1) return calls;
  // Every field but the physical offset carries over; the expanded rows are `once`/`conditional`, so neither a
  // floor nor a bound provenance can be present to carry over stale.
  // The discarded field is deliberately named for destructuring; it must not survive into expanded rows.
  // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
  const { computedOffset: _computedOffset, ...first } = calls[dispatch[0]];
  const { guarded } = groups[0];
  // A guarded expansion reaches 0..count rows, decided on-chain; an unguarded one comes from a compile-time
  // trip count. The floor is only real if every expanded row is ALSO straight-line: the same fixed loop nested
  // under a branch, or holding a conditional dispatch, expands to `conditional` rows and reaches zero.
  const rows = calls.slice(dispatch[0], dispatch[count - 1] + 1);
  const exact = !guarded && rows.every((call) => (call.occurrence ?? 'once') === 'once');
  return [
    ...calls.slice(0, dispatch[0]),
    {
      ...first,
      occurrence: 'loop' as const,
      maximumOccurrences: count,
      ...(exact && { minimumOccurrences: count }),
      occurrenceBoundSource: (guarded ? 'guard' : 'literal') as 'guard' | 'literal',
    },
    ...calls.slice(dispatch[count - 1] + 1),
  ];
}

/**
 * Attach the ceiling proven for a loop the compiler left ROLLED to the ABI rows that loop produces.
 *
 * The proof runs on the source shape, where a guard's mutation analysis is meaningful; the rows are matched
 * here, where the published order is known. Matching is positional and only accepted when the number of rows
 * still missing a ceiling equals the number of proven ceilings, so a function mixing a bounded and an
 * unbounded loop publishes nothing rather than attaching a bound to the wrong row.
 */
function applyRolledLoopCeilings(
  functionName: string,
  calls: readonly InvocationExternalCall[],
  ceilings: ProvenLoopCeilingMap,
): readonly InvocationExternalCall[] {
  const proven = ceilings.get(functionName);
  if (!proven?.length) return calls;
  const open = calls
    .map((call, index) =>
      call.occurrence === 'loop' && call.maximumOccurrences === undefined ? index : -1)
    .filter((index) => index >= 0);
  if (open.length !== proven.length) return calls;
  const patched = [...calls];
  open.forEach((index, order) => {
    // A guard bounds the trip count from above only: the loop may still reach zero rows, so no floor.
    patched[index] = {
      ...calls[index], maximumOccurrences: proven[order], occurrenceBoundSource: 'guard' as const,
    };
  });
  return patched;
}

/**
 * What a user should do about a rejection reason, for the reasons whose remedy is exact. A reason with no entry
 * is still named; inventing a remedy for one would be worse than stating the refusal alone.
 */
const MESSAGE_BUS_REJECTION_REMEDIES: Record<string, string> = {
  'batched-handler-forward-call-not-enabled':
    'declare a statically bounded call shape supported by the atomic graph route, '
    + 'or move the call into its own handler',
  'unresolved-or-effectful-handler':
    'move the effect (transfer, deploy, emit) into a handler the route admits, or resolve the call target so '
    + 'the footprint is known',
  'initial-v1-route-requires-public-visibility': 'declare the handler public or external',
  'external-token-container-handler-requires-public-visibility':
    'a handler that moves a token container is invoked as itself so the token covenant binds the consumed '
    + 'container to its own parameter, which an external name cannot be: declare this handler public',
  'external-handler-route-generation-unsupported':
    'this external handler is admissible, but the route generated for it could not be compiled, so the '
    + 'public-only route was kept: the shape is a route-generation gap rather than a visibility rule',
  'external-handler-would-shrink-the-route':
    'admitting this external handler changes the shape the whole route must take, and that shape refuses more '
    + 'handlers than it admits, so the public-only route is kept: split the handler off into its own contract, '
    + 'or make the route uniform (one of returning, event-carrying, or value-carrying, not several)',
  'result-route-requires-effect-free-handlers':
    'a returning handler cannot also carry an effect; split the return and the effect into two handlers',
  'result-consuming-handler-requires-effect-free-body':
    'a handler that consumes a call result cannot also emit an event, transfer satoshis or move a token '
    + 'container: the route wrapper has to declare that effect\'s block slot, which flattens the handler into '
    + 'the wrapper and leaves its returning edge with no slot to bind - move the effect into a second handler '
    + 'that consumes no result, or drop the result and make the call a void tail call',
  'collection-iteration-handler-not-enabled':
    'a handler that ITERATES a collection reads every entry of it, and the route addresses entries through '
    + 'per-entry witnesses fixed at compile time, so an unbounded iteration has no representation in the '
    + 'block layout: read the entries the batch needs by key, or keep the iteration on the direct route',
  'mixed-scalar-and-collection-route-not-enabled':
    'a handler that addresses no collection entry is refused on two route shapes. On a route that allocates a '
    + 'ROW-LOCAL entry slot per row, those slots are bound by the entry handler\'s own row, so a row that '
    + 'addresses no entry leaves its slot with no witness to bind and no way to gate it off - give the entry '
    + 'handler a single key alternative so the route\'s entry slots become shared. On any route, a scalar '
    + 'handler is also refused when admitting it would make the route returning or event-shaped and thereby '
    + 'refuse MORE handlers than it adds. Either way, splitting the scalar-only handlers out gives them a '
    + 'route of their own',
};

/**
 * State, by name, why a requested message-bus route does not exist.
 *
 * Route synthesis records one stable reason per entry point, but the only channel that publishes those reasons
 * is `messageBus.handlers` - which is never built when no entry point survives. Rendering the same reasons
 * here makes that outcome a refusal the user can read instead of an absent field.
 */
function messageBusAbsenceMessage(
  contractName: string, functions: readonly FunctionDefinitionNode[],
): string {
  const head = `No message-bus route was synthesized for '${contractName}': it has no message-bus batch entry point and `
    + 'cannot participate in a message bus. Only the direct per-function route exists. ';
  const entryPoints = functions.filter((fn) => fn.isEntryPoint && !fn.isAbstract && !fn.messageBusRoute);
  if (entryPoints.length === 0) return `${head}The contract declares no entry point for a route to admit.`;
  const reasonOf = (fn: FunctionDefinitionNode): string => fn.messageBusRejectionReason
    ?? (fn.messageBusEligible === true
      ? 'admitted-but-route-abandoned-before-assembly'
      : 'not-examined-by-route-synthesis');
  const stated = entryPoints.map((fn) => `'${fn.name}': ${reasonOf(fn)}`).join('; ');
  const remedies = [...new Set(entryPoints.map(reasonOf))]
    .map((reason) => MESSAGE_BUS_REJECTION_REMEDIES[reason]).filter((remedy) => remedy !== undefined);
  return `${head}Rejected entry points - ${stated}.${remedies.length ? ` To admit one: ${remedies.join('; ')}.` : ''}`;
}

/** A shared call/outState group exposes the callee's final output, so source cannot read it before invoking it. */
function foreignOutStatePrecedesSharedCall(fn: FunctionDefinitionNode): boolean {
  const calls: ExternalFunctionCallNode[] = [];
  const reads: ExternalOutputStateAccessNode[] = [];
  const rawReads: { node: FieldAccessNode; interfaceName: string; addressName: string }[] = [];
  const rawCalls: { node: MethodCallNode; interfaceName: string; addressName: string }[] = [];
  const seen = new Set<Node>();
  const visit = (value: unknown): void => {
    if (!(value instanceof Node) || seen.has(value)) return;
    seen.add(value);
    if (value instanceof ExternalFunctionCallNode) calls.push(value);
    if (value instanceof ExternalOutputStateAccessNode) reads.push(value);
    if (value instanceof FieldAccessNode && value.expression instanceof FieldAccessNode
      && value.expression.name === 'outState'
      && value.expression.expression instanceof FunctionCallNode
      && value.expression.expression.identifier instanceof IdentifierNode
      && value.expression.expression.parameters[0] instanceof IdentifierNode) {
      rawReads.push({
        node: value,
        interfaceName: value.expression.expression.identifier.name,
        addressName: value.expression.expression.parameters[0].name,
      });
    }
    if (value instanceof MethodCallNode && value.object instanceof FunctionCallNode
      && value.object.identifier instanceof IdentifierNode
      && value.object.parameters[0] instanceof IdentifierNode) {
      rawCalls.push({
        node: value,
        interfaceName: value.object.identifier.name,
        addressName: value.object.parameters[0].name,
      });
    }
    for (const child of Object.values(value)) {
      if (child instanceof Node) visit(child);
      else if (Array.isArray(child)) child.forEach(visit);
    }
  };
  visit(fn.body);
  const before = (left: Node, right: Node): boolean => left.location.start.line < right.location.start.line
    || (left.location.start.line === right.location.start.line
      && left.location.start.column < right.location.start.column);
  return rawReads.some((read) => rawCalls.some((call) => call.interfaceName === read.interfaceName
    && call.addressName === read.addressName && before(read.node, call.node))) || reads.some((read) => {
    const address = read.outStateNode.addressExpression;
    if (!(address instanceof IdentifierNode)) return false;
    return calls.some((call) => call.interfaceName === read.outStateNode.interfaceName
      && call.addressExpression instanceof IdentifierNode
      && call.addressExpression.name === address.name
      && before(read.outStateNode, call));
  });
}

/** Add the compiler-owned Release 4 physical dispatcher after source lowering
 * but before symbol/type analysis. Only signature-free scalar entry points
 * (`public` or `external`) enter the initial covenant surface; every other
 * source handler receives an explicit rejection reason in artifact metadata. */
function supportsAtomicMessageBus(ast: Ast, compilerOptions: CompilerOptions): boolean {
  const { contract } = ast;
  // A atomic participant is identified by and self-preserves its master NFT. Keep this predicate in
  // lockstep with artifact stateLayout creation: a stateless contract has no participant identity or balanced
  // master block and therefore cannot soundly advertise or execute message-bus batch. `forceStateful` remains the explicit
  // way to opt a zero-storage contract into the stateful/master-NFT model.
  return contract.stateVariables.length > 0 || contract.collections.length > 0
    || !!compilerOptions.forceStateful || contract.usesBlockhash || contract.deploysStatefulChild
    || contract.deploysWithValue
    || contract.functions.some((fn) => fn.modifiers.includes(FunctionModifier.SELFDESTRUCT));
}

function synthesizeMessageBusRoute(
  ast: Ast, compilerOptions: CompilerOptions, admitExternalHandlers = true,
  normalizeBareEntries = true, relaxResultRouteEffects = true, admitMixedScalarHandlers = true,
  admitBareForwardingHandlers = true,
  attribution?: ExternalAdmissionAttribution,
): void {
  if (!compilerOptions.messageBus) return;
  const contract = ast.contract;
  assertNoReservedMessageBusSelector(contract.functions);
  const functions = contract.functions.filter((fn) => fn.isEntryPoint && !fn.isAbstract);
  // X100. Record every external entry point's span BEFORE any refusal is decided and before anything downstream
  // can throw, so the fallback can attribute a later route-generation failure to the handler containing it.
  for (const fn of functions) {
    if (fn.visibility === 'external') recordExternalHandlerSpan(attribution, fn);
  }
  const byName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of contract.functions) {
    const group = byName.get(fn.name) ?? [];
    group.push(fn);
    byName.set(fn.name, group);
  }
  // Message-bus graph rows must have a finite statically representable outgoing-edge expansion. A recursive
  // helper closure that can make an external call has no such bound: even when each execution reaches only one
  // eventual edge (SushiMaker `_convertStep`), the route cannot pre-publish how many recursive frames precede it.
  // Refuse only the optional batch route; the ordinary source entry point remains available and is compiled with
  // its direct covenant frame. Name-level resolution is deliberately conservative here, matching the closure
  // analysis used throughout route admission before overload resolution.
  const hasRecursiveClosure = (root: FunctionDefinitionNode): boolean => {
    const visited = new Set<string>();
    const active = new Set<string>();
    const visit = (name: string): boolean => {
      if (active.has(name)) return true;
      if (visited.has(name)) return false;
      visited.add(name);
      active.add(name);
      for (const candidate of byName.get(name) ?? []) {
        for (const called of directCallNames(candidate)) {
          if (byName.has(called) && visit(called)) return true;
        }
      }
      active.delete(name);
      return false;
    };
    return visit(root.name);
  };
  const dynamicState = new Set(contract.stateVariables.filter((state) => state.isDynamic
    || state.type === PrimitiveType.STRING
    || (state.type instanceof BytesType && state.type.bound === undefined)).map((state) => state.name));
  const fixedArrayCollections = new Set(contract.collections.filter((collection) =>
    collection.type instanceof ArrayType && collection.type.bound !== undefined)
    .map((collection) => collection.name));
  const disallowedModifiers = new Set([
    FunctionModifier.DEPLOY, FunctionModifier.UPGRADE, FunctionModifier.SELFDESTRUCT,
    FunctionModifier.SPLIT, FunctionModifier.MERGE, FunctionModifier.DELEGATE, FunctionModifier.UNSAFE,
  ]);
  let eligible: FunctionDefinitionNode[] = [];
  const graphTailHandlers = new Set<FunctionDefinitionNode>();
  const graphRuntimeHandlers = new Set<FunctionDefinitionNode>();
  const graphBareTailHandlers = new Set<FunctionDefinitionNode>();
  const graphMsgValueHandlers = new Set<FunctionDefinitionNode>();
  let resourceShapedHandler: FunctionDefinitionNode | undefined;
  const collectionByName = new Map(contract.collections.map((collection) => [collection.name, collection]));
  const routeKeyWitnesses = new Map<string, { name: string; type: Type }[]>();
  const fixedIterationCollections = new Set<string>();
  const fixedArrayRouteHandlers = new Set<FunctionDefinitionNode>();
  // X76(E1). A bare `m[k]` on a PACKED or DYNAMIC state array does not resolve to a mapping entry at all:
  // `SymbolTableTraversal.visitArrayAssign` sends it to `StateArrayAssignNode`, a different physical form with
  // no entry NFT. Normalizing one of those to a Mapping* node would silently retarget the write, so the bare
  // spelling is only admitted for the names that resolution itself turns into entries.
  const packedOrDynamicArrayState = new Set(contract.stateVariables
    .filter((state) => (state.isPacked || state.isDynamic) && state.type instanceof ArrayType)
    .map((state) => state.name));
  /**
   * The names a function binds itself. A bare `x[k]` on one of these is a LOCAL array element, never a
   * collection entry - the same test `analyseFunctionFootprint` and `isShadowedByLocal` apply.
   */
  const locallyBoundNames = (fn: FunctionDefinitionNode): Set<string> => {
    const bound = new Set<string>(fn.parameters.map((parameter) => parameter.name));
    walkInvocationAst(fn.body, (node) => {
      if (node instanceof VariableDefinitionNode) bound.add(node.name);
    });
    return bound;
  };
  /**
   * The bare spelling of a collection entry, flattened exactly as `SymbolTableTraversal.visitArrayAccess`
   * flattens it, or undefined for anything that is not one. `chain` names the inner `ArrayAccessNode`s the
   * flatten consumed, so a nested `m[a][b]` is reported ONCE with both keys instead of once per level.
   */
  const bareEntryAccessOf = (node: Node, bound: Set<string>): {
    name: string; keys: ExpressionNode[]; chain: readonly Node[];
  } | undefined => {
    const named = (name: string): boolean =>
      collectionByName.has(name) && !bound.has(name) && !packedOrDynamicArrayState.has(name);
    if (node instanceof ArrayAssignNode || node instanceof ArrayDeleteNode) {
      return named(node.name) ? { name: node.name, keys: [node.index], chain: [] } : undefined;
    }
    if (node instanceof ArrayAccessNode) {
      const keys: ExpressionNode[] = [node.index];
      const chain: Node[] = [];
      let base: ExpressionNode = node.array;
      while (base instanceof ArrayAccessNode) {
        chain.push(base);
        keys.unshift(base.index);
        base = base.array;
      }
      if (!(base instanceof IdentifierNode) || !named(base.name)) return undefined;
      return { name: base.name, keys, chain };
    }
    return undefined;
  };
  /**
   * X187. A method call whose receiver is a CONTRACT/INTERFACE-TYPED VARIABLE - `bar.log()` for `IBar bar` -
   * parses as a NAMESPACED FunctionCall (`bar.log`), never as a MethodCall: `SymbolTableTraversal` turns it into
   * an `ExternalFunctionCallNode` only in the FOLLOWING semantic pass, from the receiver's declared type. The
   * conservative MethodCall rejection below therefore never saw this spelling, so a handler carrying an outgoing
   * edge was admitted as a plain scalar handler - not a graph tail handler - and its route bound NO emission for
   * the edge it published in the ABI. Recover the call from the same declared type the semantic pass reads, so
   * both spellings of one call reach the same verdict.
   *
   * Later declarations win: a local or parameter that shadows a contract-typed state variable with an ordinary
   * type names an ordinary value, exactly as symbol resolution decides it.
   */
  const interfaceTypedReceivers = (candidate: FunctionDefinitionNode): Set<string> => {
    const typed = new Map<string, boolean>();
    const record = (name: string, type: Type | undefined): void => {
      typed.set(name, type instanceof AddressType && type.interfaceName !== undefined);
    };
    for (const state of contract.stateVariables) record(state.name, state.type);
    for (const parameter of candidate.parameters) record(parameter.name, parameter.type);
    walkInvocationAst(candidate.body, (node) => {
      if (node instanceof VariableDefinitionNode) record(node.name, node.type);
    });
    return new Set([...typed].filter(([, isInterface]) => isInterface).map(([name]) => name));
  };
  /** `recv.method(..)` on a contract-typed receiver, excluding the low-level forms counted separately. */
  const contractTypedReceiverCall = (node: Node, receivers: Set<string>): node is FunctionCallNode => {
    if (!(node instanceof FunctionCallNode)) return false;
    const parts = node.identifier.name.split('.');
    return parts.length === 2 && receivers.has(parts[0])
      && !['call', 'staticcall', 'delegatecall'].includes(parts[1]);
  };
  // Pre-semantic namespace calls like `abi.encodePacked(..)` parse as MethodCallNode, but they are pure
  // compiler intrinsics rather than outgoing contract edges. Counting one here turns a single real forward
  // call into a false multi-edge handler and also misclassifies the intrinsic's local initializer as a
  // call-result statement. Keep this list to namespaces the compiler owns; value receivers remain conservative.
  const intrinsicNamespaceMethodCall = (node: Node): boolean =>
    node instanceof MethodCallNode
      && node.object instanceof IdentifierNode
      && ['abi', 'bytes', 'string'].includes(node.object.name);
  for (const fn of functions) {
    const footprint = analyseFunctionFootprint(fn, byName);
    let routeSensitive = false;
    let routeUsesMsgSender = false;
    let routeUsesMsgData = false;
    let routeUsesMsgSig = false;
    let routeUsesMsgValue = false;
    let routeUsesStableOwnerIntrospection = false;
    let routeUsesOtherIntrospection = false;
    let routeUsesTxOrigin = false;
    let signatureCheck = false;
    let statefulExternalCall = false;
    let methodCallCount = 0;
    let graphHasComputedCallArguments = false;
    let graphHasLocalCallArguments = false;
    let graphHasDelegatecall = false;
    let routeUsesForeignTryCatch = false;
    let routeUsesOpaqueAssembly = false;
    for (const name of collectNamedFunctionClosure(fn, byName)) {
      for (const candidate of byName.get(name) ?? []) {
        const receivers = interfaceTypedReceivers(candidate);
        // The walker invokes this callback synchronously; none of the captured route accumulators escape.
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        walkInvocationAst(candidate.body, (node) => {
          if (node instanceof TryCatchNode) routeUsesForeignTryCatch = true;
          if (node instanceof AssemblyStatementNode) routeUsesOpaqueAssembly = true;
          if (node instanceof NullaryOpNode && [
            NullaryOperator.INPUT_INDEX, NullaryOperator.BYTECODE,
            NullaryOperator.MSG_SENDER, NullaryOperator.TX_ORIGIN,
            NullaryOperator.MSG_SIG, NullaryOperator.MSG_DATA, NullaryOperator.MSG_VALUE,
          ].includes(node.operator)) {
            routeSensitive = true;
            if (node.operator === NullaryOperator.MSG_SENDER) routeUsesMsgSender = true;
            else if (node.operator === NullaryOperator.MSG_DATA) routeUsesMsgData = true;
            else if (node.operator === NullaryOperator.MSG_SIG) routeUsesMsgSig = true;
            else if (node.operator === NullaryOperator.MSG_VALUE) routeUsesMsgValue = true;
            else if (node.operator === NullaryOperator.INPUT_INDEX) {
              routeUsesStableOwnerIntrospection = true;
            } else if (node.operator === NullaryOperator.TX_ORIGIN) routeUsesTxOrigin = true;
            else routeUsesOtherIntrospection = true;
          }
          if (node instanceof ExternalFunctionCallNode) {
            statefulExternalCall = true;
            methodCallCount += 1;
            if (node.parameters.some((parameter) => !(parameter instanceof IdentifierNode))) {
              graphHasComputedCallArguments = true;
            }
            if (node.parameters.some((parameter) => parameter instanceof IdentifierNode
              && !fn.parameters.some((input) => input.name === parameter.name))) {
              graphHasLocalCallArguments = true;
            }
          }
          if (node instanceof LowLevelCallStatementNode) {
            statefulExternalCall = true;
            methodCallCount += 1;
            if (node.callMode === 'delegatecall') graphHasDelegatecall = true;
          }
          // Method calls are resolved into external/internal/builtin forms only
          // during the following semantic pass. The initial frozen route does
          // not attempt to predict that resolution: reject them conservatively
          // so no later synthetic callee parameters can invalidate this call.
          if (node instanceof MethodCallNode && !intrinsicNamespaceMethodCall(node)) {
            statefulExternalCall = true;
            methodCallCount += 1;
            if (node.methodName === 'delegatecall') graphHasDelegatecall = true;
            if (node.parameters.some((parameter) => !(parameter instanceof IdentifierNode))) {
              graphHasComputedCallArguments = true;
            }
            if (node.parameters.some((parameter) => parameter instanceof IdentifierNode
              && !fn.parameters.some((input) => input.name === parameter.name))) {
              graphHasLocalCallArguments = true;
            }
          }
          // X187. The namespaced spelling of the same outgoing edge, recovered from the receiver's declared type.
          if (contractTypedReceiverCall(node, receivers)) {
            statefulExternalCall = true;
            methodCallCount += 1;
            if (node.parameters.some((parameter) => !(parameter instanceof IdentifierNode))) {
              graphHasComputedCallArguments = true;
            }
          }
          if (node instanceof FunctionCallNode
            && ['checkSig', 'checkMultiSig'].includes(node.identifier.name)) signatureCheck = true;
          if (node instanceof FunctionCallNode
            && /\.(call|staticcall|delegatecall)$/.test(node.identifier.name)) {
            statefulExternalCall = true;
            methodCallCount += 1;
            if (node.identifier.name.endsWith('.delegatecall')) graphHasDelegatecall = true;
          }
        });
      }
    }
    // The first semantic pass records msg.sender usage on the function even
    // when the surface member access has already been lowered away from its
    // NullaryOp representation.
    if (fn.usesMsgSender) routeUsesMsgSender = true;
    fn.usesMsgValue = routeUsesMsgValue;
    let reason: string | undefined = statefulExternalCall && hasRecursiveClosure(fn)
      ? 'external-recursion-unbounded' : undefined;
    const bodyStatements = fn.body.statements ?? [];
    // X187. A namespaced call on a contract-typed receiver is deliberately NOT counted here. Its target is a
    // synthesized `__extaddr_*` LOCAL of the handler, never a route parameter, so the wrapper-epilogue emission
    // form cannot name it (`Expected variable '__extaddr_bar' does not exist on the stack`). Leaving it out keeps
    // `graphTailStatement` false, which routes the shape to the runtime form that authenticates the row at the
    // call site itself, where that local is in scope.
    const directMethodCallCount = bodyStatements.filter((statement) =>
      statement instanceof MethodCallStatementNode).length;
    const directTypedCallCount = bodyStatements.filter((statement) =>
      statement instanceof MethodCallStatementNode
      || (statement instanceof FunctionCallStatementNode
        && contractTypedReceiverCall(statement.call, interfaceTypedReceivers(fn)))).length;
    const graphTailStatement = bodyStatements.length >= 2
      && directMethodCallCount === methodCallCount
      && bodyStatements[bodyStatements.length - 1] instanceof RequireNode
      && (bodyStatements[bodyStatements.length - 1] as RequireNode).expression
        instanceof BoolLiteralNode
      && ((bodyStatements[bodyStatements.length - 1] as RequireNode)
        .expression as BoolLiteralNode).value === true;
    const graphResultStatement = bodyStatements.some((statement) => {
      if (!(statement instanceof VariableDefinitionNode || statement instanceof TupleAssignmentNode)) return false;
      let containsCall = false;
      walkInvocationAst(statement, (candidate) => {
        if ((candidate instanceof MethodCallNode && !intrinsicNamespaceMethodCall(candidate))
          || (candidate instanceof FunctionCallNode
            && /\.(call|staticcall|delegatecall)$/.test(candidate.identifier.name))) {
          containsCall = true;
        }
      });
      return containsCall;
    });
    // X201. THE BARE FORWARDING BODY - one statement-level call, no trailing require.
    //
    // `graphTailStatement` needs two statements AND a trailing `require(true)`, so a body ending in the call
    // itself has it false unconditionally - which means this shape lands in `graphRuntimeHandlers` below, the
    // form that authenticates the emission row AT THE CALL SITE where the callee address is in scope. That is
    // the only form it may reach: the wrapper epilogue names a synthesized `__extaddr_*` LOCAL of the handler
    // on the ROUTE stack and throws instead of refusing. So `graphRuntimeHandlers` membership is made a
    // PRECONDITION here (`!graphResultStatement && !graphHasDelegatecall`) rather than a consequence.
    // MEASURED BOUNDARIES, both kept deliberately narrow.
    //
    // LOW-LEVEL forms are excluded. Admitting `callee.call(payload);` here routes it to the raw-calldata graph
    // lowering, which aborts with the INTERNAL `Graph handler '__message_bus_graph_*' requires one forwarded raw
    // calldata argument` - a throw where the handler previously got the named refusal
    // `batched-handler-forward-call-not-enabled`. Widening must not trade a named refusal for a crash.
    //
    // A straight-line multi-edge body is the one wider form admitted here: every source statement must be one
    // of the counted typed calls. Its runtime clone consumes one authenticated emission row at each callsite,
    // in source order, and requires the vector to be empty at return. Any statement before/between/after those
    // calls leaves the named refusal in place; proving that control-flow shape needs a separate reachability
    // argument rather than inheriting this straight-line proof.
    const lastStatement = bodyStatements[bodyStatements.length - 1];
    const graphBareTailStatement = bodyStatements.length >= 1
      && fn.returnTypes.length === 0
      && (methodCallCount === 1
        || (methodCallCount > 1
          && directTypedCallCount === methodCallCount
          && bodyStatements.length === directTypedCallCount))
      && !graphResultStatement && !graphHasDelegatecall
      && (lastStatement instanceof MethodCallStatementNode
        || (lastStatement instanceof FunctionCallStatementNode
          && contractTypedReceiverCall(lastStatement.call, interfaceTypedReceivers(fn))));
    // Outgoing-call handlers participate in the atomic messageEnvelope protocol by construction. Admission is
    // inferred from the handler closure; there is no compiler option that can opt a handler into the protocol.
    const graphTailCallEligible = methodCallCount >= 1
      && (graphTailStatement || graphResultStatement
        || (admitBareForwardingHandlers && graphBareTailStatement)
        || (fn.returnTypes.length === 0
          && bodyStatements[bodyStatements.length - 1] instanceof RequireNode));
    if (admitBareForwardingHandlers && graphBareTailStatement) graphBareTailHandlers.add(fn);
    const keyWitnesses: {
      routeInput: string;
      inputIndex: number;
      source?: 'argument' | 'msgSender';
      perRow?: boolean;
    }[] = [];
    // X89. A collection ITERATION - `for (k, v of this.m.entries)`, `for (k in this.m)` - reads every entry of
    // `m`, but `CollectionIterationNode` carries `collectionName` where the footprint walker reads `name`, so
    // the read never entered the footprint at all and the branch below could not fire. Same class as X26's bare
    // read, one node kind further out, and NOT harmless: the route's collection-eligibility branch is gated on
    // this, so an iteration handler was treated as scalar. It reached the route only because X88 stopped it
    // compiling - the enumerable-iteration lowering gives the handler extra parameters after the wrapper's
    // dispatch call has already been generated from the pre-lowering signature, which fails as
    // `Found parameters () in call to function '<name>' where parameters (bigint,bytes) were expected`.
    // Recovering the read here makes the route refuse the handler BY NAME instead, which is the fail-closed
    // half of the pair: fixing the arity alone would have admitted a handler whose entry reads reserve nothing.
    let iteratesCollection = false;
    walkInvocationAst(fn.body, (node) => {
      if (node instanceof CollectionIterationNode && collectionByName.has(node.collectionName)) {
        iteratesCollection = true;
      }
    });
    if (iteratesCollection || [...footprint.reads, ...footprint.writes].some((resource) =>
      resource.startsWith('collection:'))) {
      // X19: a BARE `m[k] = v` / `m[k]` is an ArrayAssign / ArrayAccess until symbol resolution decides
      // state-vs-local; only the `this.`-prefixed spelling reaches here as a Mapping* node. Walking the
      // Mapping* forms alone therefore left that spelling with an EMPTY directKeys while the footprint had
      // already reported the collection, and every such handler was rejected 'collection-helper-route-not-enabled'
      // - no message-bus batch route at all, for a write the direct route compiles. A name bound locally in this
      // function is a LOCAL array element, not a collection entry; that is the same footprint test.
      const locallyBound = locallyBoundNames(fn);
      const bareAccessOf = (node: Node): { name: string; keys: ExpressionNode[] } | undefined => {
        if (node instanceof ArrayAssignNode || node instanceof ArrayDeleteNode) {
          return locallyBound.has(node.name) ? undefined : { name: node.name, keys: [node.index] };
        }
        if (node instanceof ArrayAccessNode && node.array instanceof IdentifierNode) {
          return locallyBound.has(node.array.name)
            ? undefined : { name: node.array.name, keys: [node.index] };
        }
        return undefined;
      };
      const collectKeys = (includeBare: boolean, flattenBare = false): Map<string, number[][]> => {
        const collected = new Map<string, number[][]>();
        const consumed = new Set<Node>();
        walkInvocationAst(fn.body, (node) => {
          if (consumed.has(node)) return;
          const flattened = includeBare && flattenBare ? bareEntryAccessOf(node, locallyBound) : undefined;
          for (const inner of flattened?.chain ?? []) consumed.add(inner);
          const access = node instanceof MappingAccessNode || node instanceof MappingAssignNode
            || node instanceof MappingDeleteNode
            ? { name: node.name, keys: node.keys as ExpressionNode[] }
            : (flattened ?? (includeBare && !flattenBare ? bareAccessOf(node) : undefined));
          if (!access || !collectionByName.has(access.name)) return;
          const indices = access.keys.map((key) => {
            if (key instanceof IdentifierNode) {
              return fn.parameters.findIndex((parameter) => parameter.name === key.name);
            }
            if (key instanceof NullaryOpNode && key.operator === NullaryOperator.MSG_SENDER) return -2;
            return -1;
          });
          const group = collected.get(access.name) ?? [];
          if (!group.some((prior) => prior.length === indices.length
            && prior.every((value, index) => value === indices[index]))) group.push(indices);
          collected.set(access.name, group);
        });
        return collected;
      };
      // X19 admitted the bare spelling only where the route reaches the entry through the handler ITSELF; every
      // other shape - a second key alternative, a msg.sender key - is served by a cloned handler whose keys are
      // rewritten to synthetic entry-key parameters, and that rewrite matched only the `this.`-prefixed nodes.
      //
      // X76(E1) converges the two by NORMALIZING the clone: `normalizeBareEntryAccesses` turns the bare forms
      // into the same Mapping* nodes resolution would have produced, so the rewrite, the self-alias handler and
      // everything downstream see one shape. The self-reached set keeps its own path (no clone is made for it,
      // so nothing normalizes it) and is decided EXACTLY as before, which is what keeps those artifacts
      // byte-identical. Normalization is not available for every bare form - `ArrayDeleteNode` has no state
      // path in `SymbolTableTraversal` at all - so the widened set is gated on the forms that do normalize.
      const mappingOnlyKeys = collectKeys(false);
      const withBareKeys = collectKeys(true);
      const bareShapeIsSelfReached = [...withBareKeys].every(([name, alternatives]) => {
        const collection = collectionByName.get(name)!;
        return alternatives.length === 1 && alternatives[0].length === collection.allKeyTypes.length
          && alternatives[0].every((index) => index >= 0);
      });
      let bareShapeIsNormalizable = true;
      walkInvocationAst(fn.body, (node) => {
        if (node instanceof ArrayDeleteNode && !locallyBound.has(node.name)
          && collectionByName.has(node.name)) bareShapeIsNormalizable = false;
        // X95, MEASURED AND KEPT. Narrowing this clause to COLLECTION names only was filed as a sound widening:
        // a bare index of a name that is not a collection reserves no entry, so refusing the whole handler for
        // one looks like a loss for nothing. It is not. The names this clause catches beyond collections are
        // DYNAMIC and PACKED array state variables, which `bareEntryAccessOf` declines precisely because they
        // resolve to `StateArrayAssignNode` - and admitting the handler then puts an unbounded array write on a
        // route beside collection entries, which is the shape NEGATIVE CONTROL 3 in MessageBusGatesX76 pins as
        // refused. Measured on the corpus, the narrowing's ONLY subject is `EventSubscription.unsubscribe`,
        // whose blocking bare index is `subscriberList[i]` on `address[] public subscriberList` - that exact
        // shape. So the wider predicate buys one contract and costs the control; it stays as it was.
        if ((node instanceof ArrayAssignNode || node instanceof ArrayAccessNode)
          && bareAccessOf(node) !== undefined
          && bareEntryAccessOf(node, locallyBound) === undefined) bareShapeIsNormalizable = false;
      });
      const directKeys = bareShapeIsSelfReached
        ? withBareKeys
        : bareShapeIsNormalizable && normalizeBareEntries ? collectKeys(true, true) : mappingOnlyKeys;
      const closure = collectNamedFunctionClosure(fn, byName);
      const nonEntryCollectionOnly = directKeys.size === 0
        && [...footprint.reads, ...footprint.writes]
          .filter((resource) => resource.startsWith('collection:'))
          .every((resource) => {
            const name = resource.split(':')[1];
            return dynamicState.has(name) || name === 'tokens';
          });
      // A fixed-array collection iteration is expanded before semantic analysis into one literal-index read per
      // element. Admit that shape only when the compiler can re-derive the COMPLETE identity set 0..N-1 here.
      // This is intentionally not a general literal-key widening: a partial set, a duplicate/out-of-range index,
      // another collection in the same handler, or any enumerable mapping keeps the existing named refusal.
      const literalIdentity = (expression: ExpressionNode): bigint | undefined => {
        if (expression instanceof IntLiteralNode) return expression.value;
        if (expression instanceof CastNode) return literalIdentity(expression.expression);
        return undefined;
      };
      const fixedArrayIdentityShape = (candidate: FunctionDefinitionNode): boolean => {
        const identitiesByCollection = new Map<string, Set<bigint>>();
        let sawAccess = false;
        let valid = true;
        const candidateBound = locallyBoundNames(candidate);
        walkInvocationAst(candidate.body, (node) => {
          const bare = bareEntryAccessOf(node, candidateBound);
          const access = node instanceof MappingAccessNode || node instanceof MappingAssignNode
            || node instanceof MappingDeleteNode
            ? { name: node.name, keys: node.keys as ExpressionNode[] }
            : bare;
          if (!access) return;
          sawAccess = true;
          const identity = access.keys.length === 1 ? literalIdentity(access.keys[0]) : undefined;
          if (!fixedArrayCollections.has(access.name) || identity === undefined) {
            valid = false;
            return;
          }
          const identities = identitiesByCollection.get(access.name) ?? new Set<bigint>();
          identities.add(identity);
          identitiesByCollection.set(access.name, identities);
        });
        if (!sawAccess || !valid) return false;
        return [...identitiesByCollection].every(([name, identities]) => {
          const collection = collectionByName.get(name)!;
          const bound = collection.type instanceof ArrayType ? collection.type.bound : undefined;
          return bound !== undefined && bound <= 64 && identities.size === bound
            && Array.from({ length: bound }, (_unused, index) => BigInt(index))
              .every((identity) => identities.has(identity));
        });
      };
      const fixedIterationShape = fixedArrayIdentityShape(fn);
      if (fixedIterationShape) {
        walkInvocationAst(fn.body, (node) => {
          const bare = bareEntryAccessOf(node, locallyBound);
          const name = node instanceof MappingAccessNode || node instanceof MappingAssignNode
            || node instanceof MappingDeleteNode ? node.name : bare?.name;
          if (name && fixedArrayCollections.has(name)) fixedIterationCollections.add(name);
        });
      }
      const fixedCollectionHelperClosure = [...closure].every((name) => name === fn.name
        || [...(byName.get(name) ?? [])].every((candidate) => {
          const helperFootprint = analyseFunctionFootprint(candidate, byName);
          const touchesCollection = [...helperFootprint.reads, ...helperFootprint.writes]
            .some((resource) => resource.startsWith('collection:'));
          return !touchesCollection || fixedArrayIdentityShape(candidate);
        }));
      const hasFixedCollectionHelper = [...closure].some((name) => name !== fn.name
        && [...(byName.get(name) ?? [])].some((candidate) => fixedArrayIdentityShape(candidate)));
      if (fixedIterationShape
        || (directKeys.size === 0 && hasFixedCollectionHelper && fixedCollectionHelperClosure)) {
        fixedArrayRouteHandlers.add(fn);
      }
      // X88/X89. Refuse the ITERATION first and unconditionally. Recovering the read (above) is not by itself
      // enough: an iteration contributes no KEY, so `directKeys` stays empty and the handler's footprint has no
      // `collection:` resource either, which makes `nonEntryCollectionOnly` vacuously TRUE and lets the chain
      // below fall through with no reason at all. That is how an iteration handler reached the wrapper and
      // crashed it on arity. Nor is `directKeys.size === 0` the right test: a handler that BOTH iterates and
      // writes one keyed entry has a non-empty key set while the iteration's reads are still unreserved.
      if (iteratesCollection) {
        reason = 'collection-iteration-handler-not-enabled';
      } else if (fixedIterationShape
        || (directKeys.size === 0 && hasFixedCollectionHelper && fixedCollectionHelperClosure)) {
        // The fixed-array clone retains the literal indices. Its block layout therefore owns one authenticated
        // entry slot per identity without accepting a key/count witness from the spender.
      } else if ((!nonEntryCollectionOnly && directKeys.size === 0) || [...closure].some((name) => name !== fn.name
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
          if (alternatives.some((indices) => indices.some((index) => index === -1)
            || indices.length !== collection.allKeyTypes.length)) {
            reason = 'collection-route-requires-parameter-keyed-resource-shape';
            break;
          }
          // Only the shared (first) alternative can be caller-keyed: its witness is a single global route input
          // checked against `__message_bus_graph_caller`. A row-local alternative would need one such witness per row,
          // which the row-key encoding does not carry.
          if (alternatives.slice(1).some((indices) => indices.includes(-2))) {
            reason = 'row-local-msg-sender-collection-key-not-enabled';
            break;
          }
          // Synchronous iteration; `reason` is the intended accumulator for this surrounding route loop.
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          alternatives[0].forEach((inputIndex) => {
            if (inputIndex === -2) {
              reason = 'msg-sender-collection-key-requires-authenticated-graph-caller';
              return;
            } else {
              globalInputs.add(inputIndex);
            }
          });
          alternatives.slice(1).flat().filter((index) => index >= 0)
            .forEach((index) => perRowInputs.add(index));
        }
        if (!reason && [...perRowInputs].some((index) => globalInputs.has(index))) {
          reason = 'collection-route-has-ambiguous-global-and-row-key';
        }
        if (!reason) {
          resourceShapedHandler ??= fn;
          // Witnesses are named by the physical entry they address - collection, key position, and whether the
          // entry is shared by every row or row-local - never by the handler or its parameter names. Two
          // handlers that touch the same entry then resolve to the same route input and the same C2 slot. Naming
          // them per function is what made a second handler allocate a duplicate slot for one entry NFT.
          for (const [collectionName, alternatives] of directKeys) {
            const collection = collectionByName.get(collectionName)!;
            const safeName = collectionName.replace(/[^A-Za-z0-9_]/g, '_');
            alternatives.forEach((indices, alternativeIndex) => {
              const perRow = alternativeIndex > 0;
              indices.forEach((inputIndex, keyIndex) => {
                if (inputIndex < 0) return;
                const routeInput = perRow
                  ? `__message_bus_key_${safeName}_${keyIndex}_row`
                  : `__message_bus_key_${safeName}_${keyIndex}`;
                routeKeyWitnesses.set(routeInput, [{
                  name: routeInput, type: collection.allKeyTypes[keyIndex],
                }]);
                if (keyWitnesses.some((binding) =>
                  binding.routeInput === routeInput && binding.inputIndex === inputIndex)) return;
                keyWitnesses.push({ routeInput, inputIndex, ...(perRow && { perRow: true }) });
              });
            });
          }
        }
      } else {
        for (const [collectionName, alternatives] of directKeys) {
          const collection = collectionByName.get(collectionName)!;
          if (alternatives.length !== 1 || alternatives[0].some((index) => index === -1)
            || alternatives[0].length !== collection.allKeyTypes.length) {
            reason = 'collection-route-requires-one-parameter-keyed-entry-per-collection';
            break;
          }
          const safeName = collectionName.replace(/[^A-Za-z0-9_]/g, '_');
          const witnesses = collection.allKeyTypes.map((type, keyIndex) => ({
            name: `__message_bus_key_${safeName}_${keyIndex}`,
            type,
          }));
          for (const witness of witnesses) routeKeyWitnesses.set(witness.name, [witness]);
          // Synchronous iteration; `reason` is the intended accumulator for this surrounding route loop.
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          alternatives[0].forEach((inputIndex, keyIndex) => {
            if (inputIndex === -2) {
              reason = 'msg-sender-collection-key-requires-authenticated-graph-caller';
              return;
            } else {
              keyWitnesses.push({
                routeInput: witnesses[keyIndex].name,
                inputIndex,
                source: 'argument',
              });
            }
          });
        }
      }
    }
    // X73. `external` and `public` differ in exactly one thing: whether the name is callable from inside the
    // contract. Every other route property - entry-point status, ABI membership, block layout, the final-require
    // rule, data locations - reads the two identically, and the route's own `__message_bus1` is itself declared
    // `external`. The refusal was the dispatcher's bare `handler(args)` call, which the resolver rejects as an
    // internal call to an external function; an admitted external handler is invoked through an internal clone
    // instead (see the clone loop below), so the source rule stays enforced for user code.
    //
    // A token-container handler is the one shape that cannot be cloned: the token covenant binds the consumed
    // container to the SOURCE parameter's stack identity, and a synthetic clone emits a second, context-free
    // covenant (the same reason `tokenCategoryInputByHandler` keeps that handler on its own name). Refuse it by
    // name rather than route it through a clone that would authenticate the wrong container.
    // A plain message bus route is optional: when its current physical layout cannot
    // settle a handler, exclude that handler and keep the source entry point.
    // Previously these two shapes were cloned first and rejected only after
    // lowering, turning default-on batching into a whole-contract compile
    // failure (or, for token writes, discovering an omitted effect after the
    // unsafe route had already been constructed). Graph-route mode keeps
    // the established hard refusal because its published graph promises that
    // every admitted edge is represented.
    let writesDynamicState = footprint.writes.some((resource) =>
      resource.startsWith('state:') && dynamicState.has(resource.slice('state:'.length)));
    const reachesCollection = [...footprint.reads, ...footprint.writes]
      .some((resource) => resource.startsWith('collection:'));
    let hasTokenContainerEffect = false;
    for (const name of collectNamedFunctionClosure(fn, byName)) {
      for (const candidate of byName.get(name) ?? []) {
        const candidateLocals = locallyBoundNames(candidate);
        // walkInvocationAst is synchronous; these accumulators do not escape this iteration.
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        walkInvocationAst(candidate.body, (node) => {
          if (node instanceof TokenContainerMethodStatementNode) hasTokenContainerEffect = true;
          // Before symbol resolution, Solidity-compatible bare state writes
          // are still ordinary AssignNodes and are absent from the footprint.
          if (node instanceof AssignNode && dynamicState.has(node.identifier.name)
            && !candidateLocals.has(node.identifier.name)) writesDynamicState = true;
        });
      }
    }
    if (!reason && writesDynamicState && reachesCollection) {
      reason = 'dynamic-and-collection-route-not-enabled';
    }
    const readsTokenContainer = footprint.reads.some((resource) => resource.startsWith('collection:tokens:'));
    if (!reason && hasTokenContainerEffect && !readsTokenContainer) {
      reason = 'token-container-effect-route-not-enabled';
    }
    // Atomic participants authenticate token-container resources and settlements directly in the
    // messageEnvelope callManifest. Slotless token effects remain refused later by the existing physical-layout guard.

    const externalTokenContainer = fn.visibility === 'external'
      && [...footprint.reads, ...footprint.writes].some((resource) => resource.startsWith('collection:tokens:'));
    const visibilityRefusal = fn.visibility !== 'public' && fn.visibility !== 'external'
      ? 'initial-v1-route-requires-public-visibility'
      : fn.visibility !== 'external'
        ? undefined
        : externalTokenContainer
          ? 'external-token-container-handler-requires-public-visibility'
          // X100. The refusal is per HANDLER, not per contract: `admitExternalHandlers` false is the shipped
          // whole-route give-up, and the `refused` set is the attributed form the fallback reaches first.
          : admitExternalHandlers && !(attribution?.refused.has(externalHandlerKey(fn)) ?? false)
            ? undefined : 'external-handler-route-generation-unsupported';
    if (!reason && visibilityRefusal !== undefined) reason = visibilityRefusal;
    else if (!reason && foreignOutStatePrecedesSharedCall(fn))
      reason = 'foreign-outstate-read-precedes-shared-call-settlement';
    // A transaction signature cannot be placed inside the message-bus envelope: the signature commits the
    // transaction containing the call manifest, while the call manifest would in turn commit the signature. In
    // authenticated graph mode `sig` and `sig[]` are instead
    // positional, per-row route witnesses (generated below) and are verified
    // by the original handler against the final transaction.
    else if (!reason && (
      (signatureCheck || fn.parameters.some((parameter) =>
        ['sig', 'sig[]'].includes(parameter.type.toString())))
    )) {
      reason = 'transaction-signature-route-binding-required';
    } else if (!reason && routeSensitive
      && !(!routeUsesOtherIntrospection
        && (routeUsesStableOwnerIntrospection || routeUsesTxOrigin
          || routeUsesMsgSender || routeUsesMsgData || routeUsesMsgSig || routeUsesMsgValue))) {
      reason = 'direct-versus-batch-introspection-divergence';
    // E4. A leaf graph handler reconstructs these three values from its authenticated invocation row, but an
    // emission handler also needs that row while constructing its outgoing emission. The current lowering
    // consumes the caller/emission operand before the source handler reads it: msg.sender and msg.data reach
    // an out-of-range OP_SPLIT, while msg.sig reaches OP_VERIFY. Refuse that position by name rather than
    // publishing a route which can only fail as a malformed script. `msg.value` is deliberately absent: its
    // row-local parsed value has independent multi-row VM proof.
    } else if (!reason && graphTailCallEligible
      && (routeUsesMsgSender || routeUsesMsgData || routeUsesMsgSig)) {
      reason = 'emission-handler-logical-context-reconstruction-unsupported';
    } else if (!reason && routeUsesForeignTryCatch) {
      reason = 'foreign-try-catch-callManifest-ineligible';
    } else if (!reason && routeUsesOpaqueAssembly) {
      reason = 'opaque-assembly-effects-callManifest-ineligible';
    } else if (!reason && graphHasDelegatecall) {
      // A delegate executor shares the proxy's state authority rather than owning an independent participant
      // block. Until the atomic callManifest publishes and verifies that execution frame, advertising the
      // proxy handler as an ordinary graph edge would authorize the wrong owner/output context. Refuse every
      // surface spelling (including internal-closure calls) detected above instead of inheriting legacy slots.
      reason = 'atomic-delegate-context-unpreservable';
    } else if (!reason && statefulExternalCall && !graphTailCallEligible) {
      reason = 'batched-handler-forward-call-not-enabled';
    // Result-consuming effect handlers remain behind their authenticated graph OP_INVOKE frame. X29's
    // per-dispatch effect-site ordinal binds their event/transfer outputs, so no separate refusal is needed.
    } else if (!reason && fn.modifiers.some((modifier) => disallowedModifiers.has(modifier))) {
      reason = 'lifecycle-or-unsafe-handler';
    } else if (!reason && (footprint.unknown
      || (!graphTailCallEligible && footprint.effects.some((effect) => effect === 'external-call')))) {
      reason = 'unresolved-or-effectful-handler';
    }
    fn.messageBusEligible = reason === undefined;
    fn.messageBusRejectionReason = reason;
    fn.messageBusKeyWitnesses = reason === undefined && keyWitnesses.length > 0
      ? keyWitnesses : undefined;
    if (!reason) eligible.push(fn);
    if (!reason && (graphTailCallEligible
      || routeUsesMsgSender || routeUsesMsgData || routeUsesMsgSig || routeUsesMsgValue || routeUsesTxOrigin
      || routeUsesMsgValue)) {
      graphTailHandlers.add(fn);
    }
    if (!reason && routeUsesMsgValue) {
      graphMsgValueHandlers.add(fn);
    }
    // Void graph handlers authenticate emissions at the actual external-call
    // site. Besides making conditional/loop reachability exact, this preserves
    // the source expression which computes each argument (rather than reducing
    // it to a forwarded handler parameter in the wrapper epilogue).
    if (!reason && graphTailCallEligible && !graphHasDelegatecall
      && (graphHasComputedCallArguments || graphHasLocalCallArguments
        || (!graphResultStatement && !graphTailStatement))) {
      graphRuntimeHandlers.add(fn);
    }
  }

  // A public whole-struct state getter is represented by a compiler projection whose published return list is
  // field-shaped, while both `this.s` and an internal `s()` expression retain the whole StructType until the
  // getter lowering pass. A source-generated message-bus wrapper is parsed before that pass and cannot spell
  // the projection soundly. Keep the ordinary getter route and exclude only this synthetic handler; the
  // contract's real struct-reading/writing entry points remain batchable.
  const routeStructNames = new Set([...ast.structDefinitions, ...contract.structDefinitions]
    .map((definition) => definition.name));
  for (const fn of eligible) {
    const state = contract.stateVariables.find((candidate) => candidate.name === fn.name);
    if (fn.parameters.length === 0 && state
      && (state.type instanceof StructType || routeStructNames.has(state.type.toString()))) {
      fn.messageBusEligible = false;
      fn.messageBusRejectionReason = 'struct-state-getter-route-not-enabled';
    }
  }
  eligible = eligible.filter((fn) => fn.messageBusEligible !== false);

  const eligibleFootprint = (fn: FunctionDefinitionNode): ReturnType<typeof analyseFunctionFootprint> =>
    analyseFunctionFootprint(fn, byName);
  const carriesRawValueOption = (fn: FunctionDefinitionNode): boolean => {
    let found = false;
    walkInvocationAst(fn.body, (node) => {
      if (node instanceof ExternalFunctionCallNode && node.interfaceName === '__raw__'
        && node.callOptions?.value) found = true;
      if (node instanceof MethodCallNode && node.methodName === 'call'
        && node.callOptions?.value
        && node.callOptions.gas === undefined && node.callOptions.salt === undefined) found = true;
    });
    return found;
  };
  /**
   * The route's uniformity rules, applied to one candidate set.
   *
   * These rules pick ONE physical shape for the whole route, so they are a property of the SET and not of any
   * handler: a candidate that becomes eligible can change the shape and demote candidates that were already
   * admitted. Extracted so the set can be chosen (see the X73 note at the call site) rather than assumed.
   * Mutates the per-handler verdict fields, which the caller snapshots and restores between runs.
   */
  const applyRouteUniformity = (
    candidates: FunctionDefinitionNode[], dropMixedScalars: boolean,
  ): {
    survivors: FunctionDefinitionNode[];
    eventMode: boolean; resultMode: boolean; valueEffectMode: boolean;
    nestedCollectionMode: boolean; fixedArrayMode: boolean; tokenContainerMode: boolean;
  } => {
    let survivors = candidates;
    // X94. A handler that carries no key witness was refused as soon as ONE sibling carried one, so a scalar
    // handler was refused for the company it kept: measured on this board at 139 application and 88 solc
    // firings, all `public`, none with a collection in its own footprint.
    //
    // What the refusal has to protect is the ROW-LOCAL entry slot, and only that. Every physical entry key on a
    // route is a WRAPPER parameter - `substituteKeyWitnesses` feeds an uncloned handler's key positions from the
    // canonical route witnesses, and `bindEntryKeyParameters` rewrites a clone's keys to synthetic parameters
    // fed the same way - so `LowerCollectionJournalHelpers` hoists the entry read to the top of the wrapper and
    // its write-back to the bottom, both OUTSIDE the row dispatch. A row that addresses no entry therefore
    // flushes the reserved entry unchanged rather than leaving its post-state unconstrained. Measured: the
    // route's `blockLayout` and `entryAccesses` are IDENTICAL with and without the scalar handler admitted -
    // same slot, same offset, same wrapper parameter - so admitting one adds no covenant.
    //
    // A ROW-LOCAL witness (`perRow`) is the exception, and it fails two ways rather than one. The `_r{n}`
    // witness is bound by the entry handler's invocation AT THAT ROW, so a scalar row leaves slot `r{n}` with
    // no binder at all; and the alias gating that collapses a duplicated row key onto an earlier slot lives
    // INSIDE the entry handler's dispatch arm, so a hand-supplied key makes the derivation co-spend one entry
    // NFT twice. Both are measured, and neither is reachable by widening this predicate.
    const perRowEntryRoute = survivors.some((fn) =>
      fn.messageBusKeyWitnesses?.some((binding) => binding.perRow));
    if ((dropMixedScalars || !admitMixedScalarHandlers || perRowEntryRoute)
      && survivors.some((fn) => (fn.messageBusKeyWitnesses?.length ?? 0) > 0)) {
      for (const fn of survivors) {
        if ((fn.messageBusKeyWitnesses?.length ?? 0) === 0) {
          fn.messageBusEligible = false;
          fn.messageBusRejectionReason = 'mixed-scalar-and-collection-route-not-enabled';
        }
      }
      survivors = survivors.filter((fn) => (fn.messageBusKeyWitnesses?.length ?? 0) > 0);
    }
    let eventMode = survivors.some((fn) => eligibleFootprint(fn).effects.includes('events'));
    const resultMode = survivors.some((fn) => fn.returnTypes.length > 0);
    let valueEffectMode = survivors.some((fn) =>
      eligibleFootprint(fn).effects.includes('value') || carriesRawValueOption(fn));
    // A nested collection needs one fixed C2 entry slot per row: the composite key is only resolvable against a
    // statically known row, so the dynamic `for row < rowCount` parser cannot represent it and code generation
    // fails closed with SortedMappingCodegenPendingError. Unrolling the rows keeps ERC-20 `approve` and every
    // other multi-key handler batchable.
    const nestedCollectionMode = survivors.some((fn) => {
      let nested = false;
      walkInvocationAst(fn.body, (node) => {
        if ((node instanceof MappingAccessNode || node instanceof MappingAssignNode
          || node instanceof MappingDeleteNode)
          && (collectionByName.get(node.name)?.allKeyTypes.length ?? 0) > 1) nested = true;
      });
      return nested;
    });
    const fixedArrayMode = survivors.some((fn) => {
      let found = false;
      const bound = locallyBoundNames(fn);
      walkInvocationAst(fn.body, (node) => {
        if ((node instanceof MappingAccessNode || node instanceof MappingAssignNode
          || node instanceof MappingDeleteNode) && fixedArrayCollections.has(node.name)) found = true;
        const bare = bareEntryAccessOf(node, bound);
        if (bare && fixedArrayCollections.has(bare.name)) found = true;
      });
      return found;
    });
    // Token transfers reserve one concrete output slot per reached row. Keep each bounded row as a distinct AST
    // call site so semantic analysis and code generation allocate and populate every transfer slot; a runtime
    // parser loop has only one syntactic transfer and cannot safely materialize N independently authenticated
    // outputs.
    const tokenContainerMode = survivors.some((fn) => {
      const footprint = eligibleFootprint(fn);
      return [...footprint.reads, ...footprint.writes]
        .some((resource) => resource.startsWith('collection:tokens:'));
    });
    // Read AFTER the result filter below, which can retire the event and value shapes entirely: the modes are a
    // property of the SURVIVING set, and returning the pre-filter values sized the route for a shape no admitted
    // handler has.
    const modes = (): {
      eventMode: boolean; resultMode: boolean; valueEffectMode: boolean;
      nestedCollectionMode: boolean; fixedArrayMode: boolean; tokenContainerMode: boolean;
    } => ({
      eventMode, resultMode, valueEffectMode, nestedCollectionMode, fixedArrayMode, tokenContainerMode,
    });
    if (resultMode) {
      // X76(E1). Demote only the handler that CARRIES the effect. The test also read `eventMode`, which is a
      // property of the SET, so ONE emitting sibling refused every effect-free handler on the route - including
      // returning getters that are admitted when compiled alone. Measured on the real solidity-by-example
      // ERC-20: `balanceOf`/`allowance` are eligible until `transfer` is present, then the route vanishes.
      // Producer-returning effect handlers remain refused. A result CONSUMER is distinct: its producer result
      // is authenticated before the handler resumes, and X29 binds the consumer's effect frame by site.
      for (const fn of survivors) {
        const continuationEffect = false;
        if ((!continuationEffect && eligibleFootprint(fn).effects.length > 0)
          || (!relaxResultRouteEffects && eventMode)) {
          fn.messageBusEligible = false;
          fn.messageBusRejectionReason = 'result-route-requires-effect-free-handlers';
        }
      }
      survivors = survivors.filter((fn) => fn.messageBusEligible === true);
      // Every effect-carrying handler has just been demoted, so no survivor emits or moves value. Recomputing
      // is what lets the route exist at all here: the blocks below refuse a survivor that carries no event
      // precisely because the flag said the route was event-shaped.
      if (relaxResultRouteEffects) {
        eventMode = survivors.some((fn) => eligibleFootprint(fn).effects.includes('events'));
        valueEffectMode = survivors.some((fn) =>
          eligibleFootprint(fn).effects.includes('value') || carriesRawValueOption(fn));
      }
    }
    if (eventMode) {
      const directEventWidths = new Set<number>();
      for (const fn of survivors) {
        let directEmits = 0;
        let directTransfers = 0;
        walkInvocationAst(fn.body, (node) => {
          if (node instanceof EmitStatementNode) directEmits += 1;
          if (node instanceof TransferStatementNode) directTransfers += 1;
        });
        const effects = eligibleFootprint(fn).effects;
        const hasValue = effects.includes('value');
        if (directEmits < 1 || effects.length === 0
          || effects.some((effect) => !['events', 'value'].includes(effect))
          || (hasValue ? directTransfers !== 1 : directTransfers !== 0)) {
          fn.messageBusEligible = false;
          fn.messageBusRejectionReason = 'event-route-requires-uniform-events-and-at-most-one-value-transfer';
        } else {
          directEventWidths.add(directEmits);
        }
      }
      survivors = survivors.filter((fn) => fn.messageBusEligible === true);
      // A graph clone binds the unused suffix of a route-wide maximum event frame at the authenticated call
      // site. A wholly flattened route has no such call-site guard: different direct widths would make the
      // unrolled conditional branches reuse incompatible event indices. Keep that older shape fail-closed.
      if (directEventWidths.size > 1 && !survivors.some((fn) => graphTailHandlers.has(fn))) {
        for (const fn of survivors) {
          fn.messageBusEligible = false;
          fn.messageBusRejectionReason = 'event-route-requires-uniform-events-per-handler';
        }
        survivors = [];
      }
      if (survivors.length === 0) return { survivors, ...modes() };
    }
    if (valueEffectMode) {
      for (const fn of survivors) {
        let directTransfers = 0;
        walkInvocationAst(fn.body, (node) => {
          if (node instanceof TransferStatementNode) directTransfers += 1;
        });
        const effects = eligibleFootprint(fn).effects;
        const hasValue = effects.includes('value');
        if (resultMode || effects.some((effect) => !['events', 'value'].includes(effect))
          || (hasValue ? directTransfers !== 1 : directTransfers !== 0)) {
          fn.messageBusEligible = false;
          fn.messageBusRejectionReason = 'value-route-requires-at-most-one-direct-transfer-per-handler';
        }
      }
      survivors = survivors.filter((fn) => fn.messageBusEligible === true);
    }
    return { survivors, ...modes() };
  };

  /**
   * X73. Admitting `external` must never leave a contract with FEWER admitted handlers than its `public` entry
   * points alone would have given it. The rules above choose one shape for the whole set, so a newly eligible
   * handler can demote handlers that were already admitted - measured on a real ERC-20, where admitting the
   * event-emitting, value-returning `approve` and `transferFrom` made the route both result-shaped and
   * event-shaped, which refuses EVERY handler, including the two read-only getters that used to be admitted.
   * The contract went from a route to none at all.
   *
   * So run the rules over both candidate sets and keep the public-only answer when the wider one is strictly
   * worse. Handlers are demoted, never promoted, so restoring the snapshot between runs is enough to make the
   * second run independent of the first. A set with no external candidates runs exactly once, and a contract
   * without external entry points therefore sees byte-identical behaviour.
   */
  const verdictSnapshot = new Map(eligible.map((fn) =>
    [fn, { admitted: fn.messageBusEligible, reason: fn.messageBusRejectionReason }]));
  const restoreVerdicts = (): void => {
    for (const [fn, state] of verdictSnapshot) {
      fn.messageBusEligible = state.admitted;
      fn.messageBusRejectionReason = state.reason;
    }
  };
  /**
   * X94 NEVER SHRINK, and it is X73's guard applied to the other admission on this path. A scalar handler that
   * RETURNS makes the route result-shaped and an emitting one makes it event-shaped, and both of those refuse
   * handlers that were already admitted - so admitting a scalar handler can cost a contract more handlers than
   * it gains, exactly as admitting an `external` one could. Run the rules over both sets, keep the wider, and
   * refuse the scalar handlers by name when the narrower answer is strictly better.
   */
  const applyBestUniformity = (candidates: FunctionDefinitionNode[]): ReturnType<typeof applyRouteUniformity> => {
    const wide = applyRouteUniformity(candidates, false);
    if (!admitMixedScalarHandlers) return wide;
    const wideReasons = new Map(candidates.map((fn) => [fn, fn.messageBusRejectionReason]));
    const wideCount = wide.survivors.length;
    restoreVerdicts();
    const narrow = applyRouteUniformity(candidates, true);
    if (narrow.survivors.length > wideCount) return narrow;
    restoreVerdicts();
    for (const [fn, reason] of wideReasons) {
      if (reason === undefined) continue;
      fn.messageBusEligible = false;
      fn.messageBusRejectionReason = reason;
    }
    return wide;
  };
  const selectWithVisibilityGuard = (
    candidates: FunctionDefinitionNode[],
  ): ReturnType<typeof applyRouteUniformity> => {
    const publicCandidates = candidates.filter((fn) => fn.visibility !== 'external');
    let selected = applyBestUniformity(candidates);
    if (publicCandidates.length === candidates.length) return selected;
    const wide = { ...selected, reasons: new Map(candidates.map((fn) => [fn, fn.messageBusRejectionReason])) };
    restoreVerdicts();
    const narrow = applyBestUniformity(publicCandidates);
    if (narrow.survivors.length > wide.survivors.length) {
      for (const fn of candidates) {
        if (fn.visibility === 'external') fn.messageBusRejectionReason ??= 'external-handler-would-shrink-the-route';
        if (fn.messageBusRejectionReason !== undefined) fn.messageBusEligible = false;
      }
      selected = narrow;
    } else {
      restoreVerdicts();
      for (const [fn, reason] of wide.reasons) {
        if (reason === undefined) continue;
        fn.messageBusEligible = false;
        fn.messageBusRejectionReason = reason;
      }
    }
    return selected;
  };
  let selection = selectWithVisibilityGuard(eligible);
  if (graphBareTailHandlers.size > 0) {
    const widened = {
      ...selection,
      reasons: new Map(eligible.map((fn) => [fn, fn.messageBusRejectionReason])),
    };
    restoreVerdicts();
    const priorCandidates = eligible.filter((fn) => !graphBareTailHandlers.has(fn));
    const prior = selectWithVisibilityGuard(priorCandidates);
    const displaced = prior.survivors.some((fn) => !widened.survivors.includes(fn));
    if (displaced) {
      for (const fn of graphBareTailHandlers) {
        fn.messageBusEligible = false;
        fn.messageBusRejectionReason = 'bare-forwarding-handler-would-shrink-the-route';
      }
      selection = prior;
    } else {
      restoreVerdicts();
      for (const [fn, reason] of widened.reasons) {
        if (reason === undefined) continue;
        fn.messageBusEligible = false;
        fn.messageBusRejectionReason = reason;
      }
      selection = widened;
    }
  }
  // The resource-shaped handler is chosen while verdicts are still provisional; if the final set does not
  // contain it, nothing dispatches to its clone and the route must not be sized for it.
  if (resourceShapedHandler && !selection.survivors.includes(resourceShapedHandler)) {
    resourceShapedHandler = undefined;
  }
  eligible = selection.survivors;
  const {
    eventMode, resultMode, valueEffectMode, nestedCollectionMode, fixedArrayMode, tokenContainerMode,
  } = selection;
  if (eligible.length === 0) return;

  const selector = (fn: FunctionDefinitionNode): string => binToHex(computeFunctionSelector(
    computeFunctionSignature(fn.name, fn.parameters.map((parameter) =>
      parameter.type.toString().replace(/address payable/g, 'address'))),
  ));
  const routeMaximumRows = resourceShapedHandler ? RESOURCE_SHAPED_BATCH_ROWS : MAX_MESSAGE_BUS_ROWS;
  // message-bus batch graph handlers share one physical route. Plan blockhash reads before SynthesizeBlockOracle runs:
  // every row gets a fixed band whose width is the widest selectable handler, so a different selector cannot
  // shift any later owner's inputs. Computed reads retain the same stable per-call-site keys as the oracle pass.
  const graphBlockhashReads = new Map<FunctionDefinitionNode, string[]>();
  for (const fn of eligible.filter((candidate) => graphTailHandlers.has(candidate))) {
    const reads: string[] = [];
    let computed = 0;
    walkInvocationAst(fn.body, (node) => {
      if (!(node instanceof FunctionCallNode) || node.identifier.name !== 'blockhash') return;
      const argument = node.parameters[0];
      const key = argument instanceof IdentifierNode
        ? argument.name : encodeComputedBlockhashKey(computed++);
      if (!reads.includes(key)) reads.push(key);
    });
    if (reads.length > 0) graphBlockhashReads.set(fn, reads);
  }
  const graphBlockhashReadWidth = Math.max(0,
    ...[...graphBlockhashReads.values()].map((reads) => reads.length));
  const isTransactionSignatureType = (type: string): boolean => type === 'sig' || type === 'sig[]';
  const signatureMode = eligible.some((fn) =>
    fn.parameters.some((parameter) => isTransactionSignatureType(parameter.type.toString())));
  const signatureWitnessName = (
    handlerIndex: number, parameterIndex: number, row: number,
  ): string => `__message_bus_sig_${handlerIndex}_${parameterIndex}_r${row}`;
  // X199. THE ROUTE'S ROW FORMAT IS DECIDED OVER THE HANDLERS THE ROUTE CAN DISPATCH.
  //
  // `graphMsgValueHandlers` is filled during the FIRST per-handler pass and never revised, while `eligible`
  // is afterwards narrowed by `applyRouteUniformity` - so the raw set is a THIRD population, neither the
  // published handlers nor the final survivors, and a payable handler admitted by pass one and demoted by
  // uniformity still widened every row from 12 to 21 bytes. Intersecting with the survivors is also what makes
  // the flag REPRODUCIBLE off the artifact: `handlers[].eligible && handlers[].usesMsgValue` is the same
  // predicate, and it is the one the SDK encoder now computes (`message-bus/message-bus.ts`). Counting every
  // published handler instead would agree just as well, but it lets a handler route synthesis REFUSED size the
  // route that was admitted, and buys no admission - `buildDecodeAndCall` maps over `eligible` only.
  const logicalValueMode = eligible.some((fn) => graphMsgValueHandlers.has(fn));
  let resourceHandlerInvokeName: string | undefined;
  const graphHandlerInvokeNames = new Map<FunctionDefinitionNode, string>();
  const siblingHandlerInvokeNames = new Map<FunctionDefinitionNode, string>();
  const fixedArrayHandlerInvokeNames = new Map<FunctionDefinitionNode, string>();
  const tokenCategoryInputByHandler = new Map<FunctionDefinitionNode, number>();

  // A `msg.sender` mapping key blocks value-threaded journalling: the collection-journal lowering only accepts
  // parameter-keyed entries, so without this the batched clone re-reads and re-flushes the same physical entry
  // once per row, and two rows demand two different post-states from one output. Every msg.sender key witness is
  // already required to equal `__message_bus_graph_caller` at each row, so the rows all agree on one spender - which
  // means the clone can take it as an ordinary parameter fed by that same route witness. The direct entry point
  // is untouched and keeps reading `msg.sender`.
  // Explicit compiler-supplied entry identity.
  //
  // The collection journal identifies a pending value by the key EXPRESSION at the call site. That is fine while
  // one parameter keys one entry, but ERC-20 `transferFrom` keys `allowances[from][spender]` and
  // `balances[from]` from the same `from`, and one parameter cannot carry two different canonical witness
  // names - so two handlers over one of those entries produced two journal locals and two C2 slots for one
  // entry NFT. Instead of inferring identity, each batch clone takes one synthetic parameter per physical
  // entry key, named after that entry's canonical route input, and its mapping keys are rewritten to those
  // parameters. The key expression at every call site is then the entry's identity by construction, whatever
  // source parameter originally supplied the value. `msg.sender` keys are just another entry key here; the
  // route still requires each one to equal `__message_bus_graph_caller`.
  const ENTRY_KEY_PREFIX = '__message_bus_ek_';
  const handlerEntryKeys = new Map<FunctionDefinitionNode, {
    base: string; perRow: boolean; collection: string;
  }[]>();
  const isMappingNode = (node: Node): node is MappingAccessNode | MappingAssignNode
  | MappingDeleteNode | MappingFieldAssignNode =>
    node instanceof MappingAccessNode || node instanceof MappingAssignNode || node instanceof MappingDeleteNode
      || node instanceof MappingFieldAssignNode;
  const keySignature = (node: MappingAccessNode | MappingAssignNode | MappingDeleteNode
  | MappingFieldAssignNode): string =>
    node.keys.map((key) => {
      if (key instanceof IdentifierNode) return `p:${key.name}`;
      if (key instanceof NullaryOpNode && key.operator === NullaryOperator.MSG_SENDER) return 'sender';
      return 'other';
    }).join('|');
  /**
   * X76(E1). Rewrite the CLONE's bare `m[k]` / `m[k] = v` spellings into the Mapping* nodes
   * `SymbolTableTraversal` would have produced, before anything else looks at the clone.
   *
   * The decision is that traversal's, reproduced: a state collection name, not shadowed by a local, and not a
   * packed or dynamic state array (which resolves to `StateArrayAssignNode`, a different physical form). Doing
   * it here rather than teaching each consumer the second spelling is what keeps the entry-key rewrite, the
   * resource self-alias handler, the collection journal and code generation on one node kind. The SOURCE
   * handler is untouched, so the direct entry point still resolves exactly as it did.
   */
  const BACKREF_KEYS = new Set([
    'resolvedFunction', 'functionReference', 'definition', 'collection', 'symbolTable', 'stateVariable',
  ]);
  const normalizeBareEntryAccesses = (handler: FunctionDefinitionNode): void => {
    const bound = locallyBoundNames(handler);
    const rewrite = (node: Node): Node => {
      const bare = bareEntryAccessOf(node, bound);
      if (bare && node instanceof ArrayAccessNode) {
        return Object.assign(
          new MappingAccessNode(bare.name, bare.keys.map((key) => rewrite(key) as ExpressionNode)),
          { location: node.location },
        );
      }
      if (bare && node instanceof ArrayAssignNode) {
        return Object.assign(
          new MappingAssignNode(
            bare.name, [rewrite(node.index) as ExpressionNode], rewrite(node.value) as ExpressionNode,
          ),
          { location: node.location },
        );
      }
      for (const [key, child] of Object.entries(node)) {
        if (BACKREF_KEYS.has(key)) continue;
        if (child instanceof Node) {
          (node as unknown as Record<string, unknown>)[key] = rewrite(child);
        } else if (Array.isArray(child)) {
          for (let index = 0; index < child.length; index += 1) {
            if (child[index] instanceof Node) child[index] = rewrite(child[index] as Node);
          }
        }
      }
      return node;
    };
    if (handler.body) rewrite(handler.body);
  };
  const bindEntryKeyParameters = (
    handler: FunctionDefinitionNode, source: FunctionDefinitionNode,
  ): void => {
    normalizeBareEntryAccesses(handler);
    // Alternative order per collection decides which entry is shared by every row and which is row-local; it
    // must match the witness naming above exactly, so it is derived the same way from encounter order.
    const alternatives = new Map<string, string[]>();
    walkInvocationAst(handler.body, (node) => {
      if (!isMappingNode(node) || !collectionByName.has(node.name)) return;
      const list = alternatives.get(node.name) ?? [];
      const signature = keySignature(node);
      if (!list.includes(signature)) list.push(signature);
      alternatives.set(node.name, list);
    });
    const ordered: { base: string; perRow: boolean; collection: string }[] = [];
    const declared = new Set<string>();
    walkInvocationAst(handler.body, (node) => {
      if (!isMappingNode(node)) return;
      const collection = collectionByName.get(node.name);
      if (!collection || node.keys.length !== collection.allKeyTypes.length) return;
      const safeName = node.name.replace(/[^A-Za-z0-9_]/g, '_');
      const rowLocal = (alternatives.get(node.name) ?? []).indexOf(keySignature(node)) > 0;
      node.keys = node.keys.map((key, keyIndex) => {
        const isSender = key instanceof NullaryOpNode && key.operator === NullaryOperator.MSG_SENDER;
        const base = isSender
          ? `__message_bus_key_${safeName}_sender_${keyIndex}`
          : rowLocal
            ? `__message_bus_key_${safeName}_${keyIndex}_row`
            : `__message_bus_key_${safeName}_${keyIndex}`;
        const parameterName = `${ENTRY_KEY_PREFIX}${base}`;
        if (!declared.has(base)) {
          declared.add(base);
          ordered.push({ base, perRow: rowLocal && !isSender, collection: node.name });
          handler.parameters.push(Object.assign(
            new ParameterNode(collection.allKeyTypes[keyIndex], parameterName, []),
            { location: handler.location },
          ));
        }
        return Object.assign(new IdentifierNode(parameterName), { location: key.location });
      });
    });
    let stillReadsSender = false;
    walkInvocationAst(handler.body, (node) => {
      if (node instanceof NullaryOpNode && node.operator === NullaryOperator.MSG_SENDER) stillReadsSender = true;
    });
    // The graph handler prologue only threads the caller when the body still reads it.
    handler.usesMsgSender = stillReadsSender;
    handlerEntryKeys.set(source, ordered);
  };
  let resourceSelfAliasHandlerInvokeName: string | undefined;
  const allGraphEmissionHandlersRuntime = graphTailHandlers.size > 0
    && [...graphTailHandlers].every((handler) => graphRuntimeHandlers.has(handler));
  if (resourceShapedHandler) {
    const handler = cloneNode(resourceShapedHandler);
    handler.name = `__message_bus_resource_${resourceShapedHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.messageBusEligible = undefined;
    handler.messageBusRejectionReason = undefined;
    handler.messageBusKeyWitnesses = undefined;
    if (graphTailHandlers.has(resourceShapedHandler)) {
      handler.graphEmissionHandler = true;
      handler.graphRuntimeEmissionHandler = graphRuntimeHandlers.has(resourceShapedHandler);
      handler.graphRuntimeEmissionThreaded = handler.graphRuntimeEmissionHandler
        && allGraphEmissionHandlersRuntime;
    }
    if (eligible.length > 1) handler.forceCollectionJournalPool = true;
    bindEntryKeyParameters(handler, resourceShapedHandler);
    resourceHandlerInvokeName = handler.name;
    contract.functions.push(handler);
    const resourceEntryShape = handlerEntryKeys.get(resourceShapedHandler) ?? [];
    const varyingResourceEntry = resourceEntryShape.find((entry) => entry.perRow);
    const sharedResourceEntry = varyingResourceEntry && resourceEntryShape.find((entry) =>
      !entry.perRow && entry.collection === varyingResourceEntry.collection
      && `${entry.base}_row` === varyingResourceEntry.base);
    if (varyingResourceEntry && sharedResourceEntry) {
      const aliasHandler = cloneNode(handler);
      aliasHandler.name = `${handler.name}_self_alias`;
      let retainedVaryingRead: MappingAccessNode | undefined;
      walkInvocationAst(aliasHandler.body, (node) => {
        if (!isMappingNode(node) || node.name !== varyingResourceEntry.collection) return;
        if (node.keys.some((key) =>
          key instanceof IdentifierNode
          && key.name === `${ENTRY_KEY_PREFIX}${varyingResourceEntry.base}`)) {
          retainedVaryingRead ??= Object.assign(new MappingAccessNode(
            node.name, node.keys.map((key) => cloneNode(key) as ExpressionNode),
          ), { location: node.location });
          node.keys = node.keys.map((key) =>
            key instanceof IdentifierNode
              && key.name === `${ENTRY_KEY_PREFIX}${varyingResourceEntry.base}`
              ? Object.assign(
                new IdentifierNode(`${ENTRY_KEY_PREFIX}${sharedResourceEntry.base}`),
                { location: key.location },
              ) : key);
        }
      });
      if (retainedVaryingRead) {
        aliasHandler.body!.statements ??= [];
        aliasHandler.body!.statements.push(Object.assign(new RequireNode(
          Object.assign(new BinaryOpNode(
            retainedVaryingRead,
            BinaryOperator.EQ,
            cloneNode(retainedVaryingRead) as MappingAccessNode,
          ), { location: handler.location }),
        ), { location: handler.location }));
      }
      resourceSelfAliasHandlerInvokeName = aliasHandler.name;
      contract.functions.push(aliasHandler);
    }
  }
  // When a resource-shaped handler shares the route with others, every handler must reach its entries through
  // the same journal path. The resource-shaped one is invoked as an internal clone whose accesses the collection
  // journal hoists into wrapper caches; a sibling invoked as its public self bypasses that and allocates its own
  // C2 slot for an entry the clone already owns. Cloning the siblings too puts them in one shared pool.
  if (resourceShapedHandler && eligible.length > 1) {
    for (const sourceHandler of eligible) {
      if (sourceHandler === resourceShapedHandler || graphTailHandlers.has(sourceHandler)) continue;
      const handler = cloneNode(sourceHandler);
      handler.name = `__message_bus_handler_${sourceHandler.name}`;
      handler.modifiers = [FunctionModifier.INTERNAL];
      handler.functionId = undefined;
      handler.functionSelector = undefined;
      handler.messageBusEligible = undefined;
      handler.messageBusRejectionReason = undefined;
      handler.messageBusKeyWitnesses = undefined;
      handler.forceCollectionJournalPool = true;
      bindEntryKeyParameters(handler, sourceHandler);
      siblingHandlerInvokeNames.set(sourceHandler, handler.name);
      contract.functions.push(handler);
    }
  }
  // `delete m[k]` is only settleable through the value-threaded journal, which rewrites it to a write of the
  // collection's default. That lowering only applies to internal handlers, so a delete-bearing handler is cloned
  // even when nothing else on the route needs a clone; otherwise code generation reaches the raw delete and the
  // C2 backend fails closed on a shape the journal can in fact represent.
  for (const sourceHandler of eligible) {
    if (sourceHandler === resourceShapedHandler
      || graphTailHandlers.has(sourceHandler)
      || siblingHandlerInvokeNames.has(sourceHandler)) continue;
    let deletesEntry = false;
    walkInvocationAst(sourceHandler.body, (node) => {
      if (node instanceof MappingDeleteNode && collectionByName.has(node.name)) deletesEntry = true;
    });
    if (!deletesEntry) continue;
    const handler = cloneNode(sourceHandler);
    handler.name = `__message_bus_handler_${sourceHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.messageBusEligible = undefined;
    handler.messageBusRejectionReason = undefined;
    handler.messageBusKeyWitnesses = undefined;
    handler.forceCollectionJournalPool = true;
    bindEntryKeyParameters(handler, sourceHandler);
    siblingHandlerInvokeNames.set(sourceHandler, handler.name);
    contract.functions.push(handler);
  }
  // A route can admit getters from more than one sorted collection (for example ERC-20 `balanceOf` and
  // `allowance`). Calling those public handlers directly lets the wrapper lowering collapse their two reads
  // onto one physical journal slot: the canonical route then publishes only the last collection even though it
  // still publishes both key witnesses. Clone every fixed-entry handler into the shared journal pool so the
  // wrapper owns one authenticated cache/slot per collection identity. This is also what the resource-shaped
  // path above already does for its siblings; applying it to ordinary entry handlers keeps the physical route
  // and the per-handler ABI in agreement.
  for (const sourceHandler of eligible) {
    if (sourceHandler === resourceShapedHandler
      || graphTailHandlers.has(sourceHandler)
      || siblingHandlerInvokeNames.has(sourceHandler)) continue;
    // The pre-semantic AST has dedicated compound/field lvalue shapes which are not all Mapping* nodes yet.
    // Admission has already proven and recorded their collection key witnesses, so use that authoritative
    // result too; otherwise the route calls the public handler directly and later inlining substitutes a
    // branch-local __message_bus_arg_* into a journal initializer hoisted above the branch.
    let touchesEntry = (sourceHandler.messageBusKeyWitnesses?.length ?? 0) > 0;
    let touchesFixedArray = false;
    const bound = locallyBoundNames(sourceHandler);
    walkInvocationAst(sourceHandler.body, (node) => {
      if (isMappingNode(node) && collectionByName.has(node.name)) {
        touchesEntry = true;
        if (fixedArrayCollections.has(node.name)) touchesFixedArray = true;
      }
      const bare = bareEntryAccessOf(node, bound);
      if (bare !== undefined) {
        touchesEntry = true;
        if (fixedArrayCollections.has(bare.name)) touchesFixedArray = true;
      }
    });
    if (!touchesEntry) continue;
    // Fixed-array handlers are cloned by the dedicated pass below. Letting the generic entry clone claim one
    // first rewrites its compiler-owned literal identities (the unrolled 0..N-1 indices) to spender-facing
    // synthetic key parameters. The collection journal then correctly rejects those parameters as unstable.
    // Deferring the whole handler preserves the literal identity set and does not widen the journal's stable-key
    // rule; dynamically-cardinal collection iteration remains ineligible before clone selection reaches here.
    if (touchesFixedArray || fixedArrayRouteHandlers.has(sourceHandler)) continue;
    const handler = cloneNode(sourceHandler);
    handler.name = `__message_bus_entry_${sourceHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.messageBusEligible = undefined;
    handler.messageBusRejectionReason = undefined;
    handler.messageBusKeyWitnesses = undefined;
    handler.forceCollectionJournalPool = true;
    bindEntryKeyParameters(handler, sourceHandler);
    siblingHandlerInvokeNames.set(sourceHandler, handler.name);
    contract.functions.push(handler);
  }
  for (const sourceHandler of graphTailHandlers) {
    if (!eligible.includes(sourceHandler) || sourceHandler === resourceShapedHandler) continue;
    const handler = cloneNode(sourceHandler);
    handler.name = `__message_bus_graph_${sourceHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.messageBusEligible = undefined;
    handler.messageBusRejectionReason = undefined;
    handler.messageBusKeyWitnesses = undefined;
    handler.parameters = handler.parameters.filter((parameter) =>
      parameter.name !== '__internal__returnOutputIdx'
      && !parameter.name.startsWith('__internal__externalCallInput')
      && !parameter.name.startsWith('__internal__externalReturnOutput')
      && parameter.name !== '__internal__delegateInputIndex');
    if (graphBlockhashReads.has(sourceHandler)) {
      handler.parameters.push(new ParameterNode(PrimitiveType.BIGINT, '__internal__blockhashRowOffset'));
    }
    handler.graphEmissionHandler = true;
    handler.graphRuntimeEmissionHandler = graphRuntimeHandlers.has(sourceHandler);
    handler.graphRuntimeEmissionThreaded = handler.graphRuntimeEmissionHandler
      && allGraphEmissionHandlersRuntime;
    // A typed `{value:}` option is deliberately absent from the v1 graph projection: unlike a direct owner
    // transfer (and the one admitted raw-call option), no authenticated row field settles its recipient/amount.
    // Keep the source entry point's direct covenant and ABI metadata intact, but remove the option from the
    // synthetic graph clone. Retaining it here makes semantic analysis allocate a pending transfer which the
    // route correctly reserved no frame for, ending in the internal `transfer[0]` block-slot crash instead of
    // the SDK's named derived-block refusal.
    walkInvocationAst(handler.body, (node) => {
      if (node instanceof ExternalFunctionCallNode && node.interfaceName !== '__raw__'
        && node.callOptions?.value) {
        node.callOptions.value = undefined;
      }
      if (node instanceof MethodCallNode && !['call', 'staticcall', 'delegatecall'].includes(node.methodName)
        && node.callOptions?.value) {
        node.callOptions.value = undefined;
      }
    });
    const delegateSlots: { slotIndex: number }[] = [];
    walkInvocationAst(sourceHandler.body, (node) => {
      if (node instanceof LowLevelCallStatementNode && node.callMode === 'delegatecall') {
        delegateSlots.push({ slotIndex: node.callIndex });
      }
    });
    if (delegateSlots.length > 0) {
      handler.graphDelegateSlotCount = delegateSlots.length;
    }
    bindEntryKeyParameters(handler, sourceHandler);
    graphHandlerInvokeNames.set(sourceHandler, handler.name);
    contract.functions.push(handler);
  }
  // Token-container categories must remain function parameters: the token covenant uses the parameter's stack
  // identity to bind the consumed container. Decode the row argument and compare it to one canonical route
  // witness, then invoke the ordinary handler with that witness in the category position. This keeps both the
  // direct handler and the inlined batch body on the normal token-covenant path; a synthetic internal clone
  // would incorrectly try to emit a second, context-free token covenant.
  for (const sourceHandler of eligible) {
    const footprint = analyseFunctionFootprint(sourceHandler, byName);
    const touchesTokenContainer = [...footprint.reads, ...footprint.writes]
      .some((resource) => resource.startsWith('collection:tokens:'));
    if (!touchesTokenContainer) continue;
    let categoryInput = -1;
    walkInvocationAst(sourceHandler.body, (node) => {
      if (!(node instanceof MappingAccessNode) || node.name !== 'tokens' || node.keys.length !== 1) return;
      const key = node.keys[0];
      if (!(key instanceof IdentifierNode)) return;
      const input = sourceHandler.parameters.findIndex((parameter) => parameter.name === key.name);
      if (input < 0 || (categoryInput >= 0 && categoryInput !== input)) return;
      categoryInput = input;
    });
    if (categoryInput < 0) continue;
    const routeInput = '__message_bus_token_category';
    routeKeyWitnesses.set(routeInput, [{
      name: routeInput,
      type: new BytesType(32),
    }]);
    sourceHandler.messageBusKeyWitnesses = [
      ...(sourceHandler.messageBusKeyWitnesses ?? []),
      { routeInput, inputIndex: categoryInput, source: 'argument' },
    ];
    tokenCategoryInputByHandler.set(sourceHandler, categoryInput);
  }
  for (const sourceHandler of eligible) {
    if (sourceHandler === resourceShapedHandler || graphTailHandlers.has(sourceHandler)
      || siblingHandlerInvokeNames.has(sourceHandler)) continue;
    const footprint = analyseFunctionFootprint(sourceHandler, byName);
    const touchesDynamic = [...footprint.reads, ...footprint.writes].some((resource) =>
      resource.startsWith('state:') && dynamicState.has(resource.slice('state:'.length)));
    if (!touchesDynamic) continue;
    const handler = cloneNode(sourceHandler);
    handler.name = `__message_bus_dynamic_${sourceHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.messageBusEligible = undefined;
    handler.messageBusRejectionReason = undefined;
    handler.messageBusKeyWitnesses = undefined;
    siblingHandlerInvokeNames.set(sourceHandler, handler.name);
    contract.functions.push(handler);
  }
  for (const sourceHandler of eligible) {
    if (sourceHandler === resourceShapedHandler || graphTailHandlers.has(sourceHandler)
      || siblingHandlerInvokeNames.has(sourceHandler)) continue;
    let touchesFixedArray = false;
    const bound = locallyBoundNames(sourceHandler);
    walkInvocationAst(sourceHandler.body, (node) => {
      if ((node instanceof MappingAccessNode || node instanceof MappingAssignNode
        || node instanceof MappingDeleteNode) && fixedArrayCollections.has(node.name)) {
        touchesFixedArray = true;
      }
      const bare = bareEntryAccessOf(node, bound);
      if (bare && fixedArrayCollections.has(bare.name)) touchesFixedArray = true;
    });
    if (!touchesFixedArray && !fixedArrayRouteHandlers.has(sourceHandler)) continue;
    const handler = cloneNode(sourceHandler);
    handler.name = `__message_bus_array_${sourceHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.messageBusEligible = undefined;
    handler.messageBusRejectionReason = undefined;
    handler.messageBusKeyWitnesses = undefined;
    handler.forceCollectionJournalPool = true;
    normalizeBareEntryAccesses(handler);
    fixedArrayHandlerInvokeNames.set(sourceHandler, handler.name);
    contract.functions.push(handler);
  }
  // A function may legally have the same name as its containing contract (notably the tiny
  // expression contracts used by the location/source-map suite). In generated source, `C()` is
  // then resolved as the contract-type constructor rather than an internal call. Give that one
  // spelling an unambiguous internal target, just as we already do for external handlers.
  for (const sourceHandler of eligible) {
    if (sourceHandler.name !== contract.name || sourceHandler === resourceShapedHandler
      || graphHandlerInvokeNames.has(sourceHandler) || siblingHandlerInvokeNames.has(sourceHandler)
      || fixedArrayHandlerInvokeNames.has(sourceHandler)) continue;
    const handler = cloneNode(sourceHandler);
    handler.name = `__message_bus_handler_${sourceHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.messageBusEligible = undefined;
    handler.messageBusRejectionReason = undefined;
    handler.messageBusKeyWitnesses = undefined;
    siblingHandlerInvokeNames.set(sourceHandler, handler.name);
    contract.functions.push(handler);
  }
  // X73. An `external` handler is dispatched through an internal clone, because the wrapper's `handler(args)`
  // is an internal call and `external` means precisely "not callable that way". Some external handlers survive
  // without one - a collection or returning handler synthesized before lowering has its call rewritten by
  // LowerCollectionJournalHelpers or InlineReturningStateHelpers before the resolver ever sees it - but that is
  // an accident of which lowering happens to erase the call, not a property of the shape, so every external
  // handler that still reaches its own name gets a clone. Runs LAST: the loops above skip a handler that
  // already has a clone, and claiming one here first would suppress the dynamic-state and fixed-array clones.
  // Synthesized public collection getters can disappear from a split facet after route planning (facets suppress
  // unrelated public getters), while their direct collection-read body is still valid in the route owner's state
  // context. Give every such getter an internal clone, just like external handlers, so generated source never
  // depends on a public symbol that shard filtering may remove.
  for (const sourceHandler of eligible) {
    if (!(contract.collections.some((collection) => collection.name === sourceHandler.name)
      || contract.stateVariables.some((state) =>
        state.name === sourceHandler.name && state.type instanceof ArrayType))
      || sourceHandler === resourceShapedHandler
      || graphHandlerInvokeNames.has(sourceHandler) || siblingHandlerInvokeNames.has(sourceHandler)
      || fixedArrayHandlerInvokeNames.has(sourceHandler)) continue;
    const handler = cloneNode(sourceHandler);
    handler.name = `__message_bus_getter_${sourceHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.messageBusEligible = undefined;
    handler.messageBusRejectionReason = undefined;
    handler.messageBusKeyWitnesses = undefined;
    siblingHandlerInvokeNames.set(sourceHandler, handler.name);
    contract.functions.push(handler);
  }
  for (const sourceHandler of eligible) {
    if (sourceHandler.visibility !== 'external' || sourceHandler === resourceShapedHandler
      || graphHandlerInvokeNames.has(sourceHandler) || siblingHandlerInvokeNames.has(sourceHandler)
      || fixedArrayHandlerInvokeNames.has(sourceHandler)) continue;
    const handler = cloneNode(sourceHandler);
    handler.name = `__message_bus_external_${sourceHandler.name}`;
    handler.modifiers = [FunctionModifier.INTERNAL];
    handler.functionId = undefined;
    handler.functionSelector = undefined;
    handler.messageBusEligible = undefined;
    handler.messageBusRejectionReason = undefined;
    handler.messageBusKeyWitnesses = undefined;
    siblingHandlerInvokeNames.set(sourceHandler, handler.name);
    contract.functions.push(handler);
  }
  const buildDecodeAndCall = (
    captureResults = false, rowIndex?: number, rowExpression = String(rowIndex ?? 0),
  ): string =>
    eligible.map((fn, handlerIndex) => {
      const condition = `${handlerIndex === 0 ? 'if' : 'else if'} (rowSelector == hex"${selector(fn)}")`;
      const invokeName = fn === resourceShapedHandler
        ? resourceHandlerInvokeName!
        : (graphHandlerInvokeNames.get(fn) ?? siblingHandlerInvokeNames.get(fn)
        ?? fixedArrayHandlerInvokeNames.get(fn) ?? fn.name);
      const invoke = (args: string, selectedInvokeName = invokeName): string => {
        const constantGetter = fn.parameters.length === 0
          && contract.constantDefinitions.some((constant) => constant.name === fn.name);
        const scalarGetter = fn.parameters.length === 0
          && (constantGetter || contract.stateVariables.some((state) => state.name === fn.name))
          // A flattened public struct getter has its own compiler-generated projection body. `this.s` is the
          // whole struct value, while the getter ABI returns only its projected field shape; treating it like a
          // scalar getter assigns `S` to the first projected field type in the generated route.
          && !contract.flattenedPublicStructGetters.some((getter) => getter.name === fn.name);
        if (scalarGetter) {
          const getterExpression = constantGetter ? fn.name : `this.${fn.name}`;
          if (!captureResults || fn.returnTypes.length === 0) return `${getterExpression};`;
          const name = `__message_bus_value_${rowIndex}_${handlerIndex}_0`;
          return `${fn.returnTypes[0].toString()} ${name}; ${name} = ${getterExpression}; `
            + `__message_bus_results = bytes.concat(__message_bus_results, abi.encode(${name}));`;
        }
        if (!captureResults || fn.returnTypes.length === 0) return `${selectedInvokeName}(${args});`;
        const names = fn.returnTypes.map((_type, index) =>
          `__message_bus_value_${rowIndex}_${handlerIndex}_${index}`);
        const declarations = fn.returnTypes.map((type, index) =>
          `${type.toString()} ${names[index]};`).join(' ');
        const assignment = fn.returnTypes.length === 1
          ? `${names[0]} = ${selectedInvokeName}(${args});`
          : `(${names.join(', ')}) = ${selectedInvokeName}(${args});`;
        return `${declarations} ${assignment} __message_bus_results = bytes.concat(
        __message_bus_results, abi.encode(${names.join(', ')})
      );`;
      };
      const blockhashRowOffset = graphBlockhashReads.has(fn)
        ? (rowIndex === undefined
          ? `(${rowExpression}) * ${graphBlockhashReadWidth}`
          : String(rowIndex * graphBlockhashReadWidth))
        : undefined;
      const witnessName = (binding: { routeInput: string; perRow?: boolean }): string =>
        binding.perRow ? `${binding.routeInput}_r${rowIndex}` : binding.routeInput;
      const entryKeyArguments = (handler: FunctionDefinitionNode): string[] =>
        (handlerEntryKeys.get(handler) ?? []).map(({ base, perRow }) =>
          (perRow ? `${base}_r${rowIndex}` : base));
      if (fn.parameters.length === 0) {
        const entryOnly = [...entryKeyArguments(fn), ...(blockhashRowOffset
          ? [blockhashRowOffset, '__internal__blockhashInputIndex'] : [])];
        const senderChecks = (fn.messageBusKeyWitnesses ?? [])
          .filter((binding) => binding.source === 'msgSender')
          .map((binding) => `require(${witnessName(binding)} == __message_bus_graph_caller);`).join(' ');
        return `${condition} { require(rowArgs.length == 0); ${senderChecks} ${invoke(entryOnly.join(', '))} }`;
      }
      const decodedParameters = fn.parameters
        .map((parameter, index) => ({ parameter, index }))
        .filter(({ parameter }) => !isTransactionSignatureType(parameter.type.toString())
        && !parameter.name.startsWith('__internal__'));
      const declarations = decodedParameters.map(({ parameter, index }) =>
        `${parameter.type.toString()} __message_bus_arg_${handlerIndex}_${index}`);
      const schema = decodedParameters.map(({ parameter }) => parameter.type.toString()).join(', ');
      const keyChecks = (fn.messageBusKeyWitnesses ?? []).map((binding) =>
        binding.source === 'msgSender'
          ? `require(${witnessName(binding)} == __message_bus_graph_caller);`
          : `require(__message_bus_arg_${handlerIndex}_${binding.inputIndex} == ${witnessName(binding)});`).join(' ');
      // Declared arguments come from the row; entry keys come from the canonical witnesses this row already
      // checked, so the journal sees one identity per physical entry however the handler names its parameters.
      //
      // A handler with no batch clone has no entry-key parameters, and the journal hoists its entry reads to the
      // top of the wrapper - above the dispatch branch where `__message_bus_arg_*` is declared. Those key positions must
      // still be passed as route witnesses, which are wrapper parameters and therefore always in scope.
      const substituteKeyWitnesses = !handlerEntryKeys.has(fn);
      const witnessByInput = new Map(substituteKeyWitnesses
        ? (fn.messageBusKeyWitnesses ?? [])
          .filter((binding) => binding.source !== 'msgSender')
          .map((binding) => [binding.inputIndex, witnessName(binding)] as const)
        : []);
      const sourceCallArgs = [
        ...fn.parameters.map((parameter, i) =>
          isTransactionSignatureType(parameter.type.toString())
            ? signatureWitnessName(handlerIndex, i, rowIndex ?? 0)
            : parameter.name === '__internal__externalOutStateInputBase'
              ? (() => {
                const targetName = fn.externalOutStateReads?.find((read) => read.addressParam)?.addressParam;
                const targetIndex = fn.parameters.findIndex((candidate) => candidate.name === targetName);
                if (targetIndex < 0) throw new Error(`foreign outState target for '${fn.name}' is not parameter-bound`);
                return '__message_bus_graph_owner_input(__internal__graphSettlementTable, '
              + `__message_bus_arg_${handlerIndex}_${targetIndex})`;
              })()
              : i === tokenCategoryInputByHandler.get(fn)
                ? '__message_bus_token_category'
                : (witnessByInput.get(i) ?? `__message_bus_arg_${handlerIndex}_${i}`)),
        ...(blockhashRowOffset ? [blockhashRowOffset, '__internal__blockhashInputIndex'] : []),
      ];
      const physicalEntryArgs = entryKeyArguments(fn);
      const entryShape = handlerEntryKeys.get(fn);
      const varyingEntryIndex = entryShape?.findIndex((entry) => entry.perRow) ?? -1;
      const varyingEntry = varyingEntryIndex >= 0 ? entryShape![varyingEntryIndex] : undefined;
      const sharedEntryIndex = varyingEntry
        ? entryShape!.findIndex((entry) =>
          !entry.perRow && `${entry.base}_row` === varyingEntry.base)
        : -1;
      const callArgs = [...sourceCallArgs, ...physicalEntryArgs].join(', ');
      const outStateBoundaryChecks = '';
      const decode = declarations.length === 0
        ? 'require(rowArgs.length == 0);'
        : declarations.length === 1
          ? `${declarations[0]} = abi.decode(rowArgs, (${schema}));`
        // X71. PARENTHESISED, because the unparenthesised multi-declaration `T a, U b = ..` is
        // `typeName Identifier (',' typeName Identifier)+` in the grammar and admits no array type, so a handler
        // with an array parameter made this generator emit source the compiler's own parser rejects - reported at
        // a line number in THIS generated text, which is not a position in anything the user wrote. The
        // parenthesised form's `tupleSlot` already accepts `arrayType`, and AstBuilder builds the same
        // TupleAssignmentNode either way (only the print-only `parenthesised` flag differs), so no emitted byte
        // changes and no user program becomes newly valid.
          : `(${declarations.join(', ')}) = abi.decode(rowArgs, (${schema}));`;
      // Canonicalize the measured two-row, one-shared/one-varying resource shape before the collection journal
      // sees the callsite. A varying key which aliases the shared key or an earlier row is passed as that earlier
      // IDENTIFIER, so LowerCollectionJournalHelpers uses one cache and preserves Solidity's sequential lvalue
      // semantics. The distinct arm retains its own physical entry slot. Later semantic metadata gates that slot
      // off when one of these equality arms is taken.
      if (fn === resourceShapedHandler && rowIndex !== undefined
      && entryShape && entryShape.filter((entry) => entry.perRow).length === 1
      && sharedEntryIndex >= 0 && varyingEntry) {
        const shared = entryShape[sharedEntryIndex].base;
        const varying = `${varyingEntry.base}_r${rowIndex}`;
        // Shared-self aliasing is handled inside the clone so its call/return frame remains statically identical.
        // Only an alias to a prior row needs wrapper-level cache redirection.
        const prior = [
          shared,
          ...Array.from({ length: rowIndex }, (_unused, priorRow) =>
            `${varyingEntry.base}_r${priorRow}`),
        ];
        let dispatch = invoke(callArgs);
        for (let candidateIndex = prior.length - 1; candidateIndex >= 0; candidateIndex--) {
          const candidate = prior[candidateIndex];
          const aliasedEntryArgs = [...physicalEntryArgs];
          aliasedEntryArgs[varyingEntryIndex] = candidate;
          // Keep the shared-self case on two distinct wrapper cache locals. The handler's internal equality branch
          // canonicalizes the actual lvalue, while the untouched varying cache occupies its own return/capture slot.
          // Passing the shared IDENTIFIER twice would make the wrapper pool capture two return fields into one local,
          // corrupting the surrounding stack frame. Cross-row aliases have no within-handler collision and may safely
          // reuse the earlier row's cache directly.
          const aliasedArgs = candidate === shared
            ? callArgs : [...sourceCallArgs, ...aliasedEntryArgs].join(', ');
          const selectedInvoke = candidate === shared && resourceSelfAliasHandlerInvokeName
            ? resourceSelfAliasHandlerInvokeName : invokeName;
          dispatch = `if (${varying} == ${candidate}) { ${invoke(aliasedArgs, selectedInvoke)} } else { ${dispatch} }`;
        }
        return `${condition} { ${decode} ${keyChecks} ${outStateBoundaryChecks} ${dispatch} }`;
      }
      return `${condition} { ${decode} ${keyChecks} ${invoke(callArgs)} }`;
    }).join(' ');
  const usedRouteInputs = new Set(eligible.flatMap((fn) =>
    (fn.messageBusKeyWitnesses ?? []).map((binding) => binding.routeInput)));
  const declaredWitnessNames = new Set<string>();
  const routeKeyParameters = [...routeKeyWitnesses.values()].flat()
    .filter((witness) => usedRouteInputs.has(witness.name))
    .filter((witness) => {
      if (declaredWitnessNames.has(witness.name)) return false;
      declaredWitnessNames.add(witness.name);
      return true;
    })
    .flatMap((witness) => {
      const perRow = eligible.some((fn) => fn.messageBusKeyWitnesses?.some((binding) =>
        binding.routeInput === witness.name && binding.perRow));
      return perRow
        ? Array.from({ length: routeMaximumRows }, (_unused, row) =>
          `${witness.type.toString()} ${witness.name}_r${row}`)
        : [`${witness.type.toString()} ${witness.name}`];
    });
  const routeSignatureParameters = eligible.flatMap((fn, handlerIndex) =>
    fn.parameters.flatMap((parameter, parameterIndex) =>
      isTransactionSignatureType(parameter.type.toString())
        ? Array.from({ length: routeMaximumRows }, (_unused, row) =>
          `${parameter.type.toString()} ${signatureWitnessName(handlerIndex, parameterIndex, row)}`)
        : []));
  const graphExecutionContext = graphTailHandlers.size > 0;
  const resourceVerificationMode = eligible.some((fn) => {
    const footprint = eligibleFootprint(fn);
    return footprint.reads.length > 0 || footprint.writes.length > 0;
  }) || valueEffectMode || tokenContainerMode;
  const sidecarVerificationMode = graphBlockhashReads.size > 0 || eligible.some((fn) => {
    let found = false;
    walkInvocationAst(fn.body, (node) => {
      if (node instanceof FunctionCallNode && [
        GlobalFunction.KECCAK256,
        GlobalFunction.ECRECOVER_PUBKEY,
        GlobalFunction.ECRECOVER_P2PKH,
        GlobalFunction.ECRECOVER_EVM,
      ].includes(node.identifier.name as GlobalFunction)) found = true;
    });
    return found;
  });
  const graphRouteParameters = !graphExecutionContext ? [] : [
    'bigint __internal__graphFixedSize',
    'bigint __internal__graphBlockSize',
    'bytes __internal__graphEmissions',
    'bytes __internal__graphCallers',
    'bigint __internal__graphSettlementBoundary',
    'bytes __internal__graphCompletionPositions',
    'bytes __internal__graphSettlementTable',
    ...(graphBlockhashReadWidth > 0 ? ['bigint __internal__blockhashInputIndex'] : []),
  ];
  const verifierBinderRouteParameters = compilerOptions.__messageBusVerifierProgram
    ? ['bigint __internal__activeVerifierIndex'] : [];
  const routeParameters = [
    'bytes batchBlob', ...verifierBinderRouteParameters, ...graphRouteParameters,
    ...routeSignatureParameters, ...routeKeyParameters,
  ].join(', ');
  const graphOutStateMode = graphExecutionContext
    && eligible.some((fn) => (fn.externalOutStateReads?.length ?? 0) > 0);
  const parseGraphCaller = !graphExecutionContext ? '' : `
          address __message_bus_graph_caller;
          (__message_bus_graph_caller, __message_bus_graph_caller_cursor) = __message_bus_parse_graph_caller(
            __internal__graphCallers, __message_bus_graph_caller_cursor
          );
  `;
  const parseOneRow = (rowExpression: string, captureResults = false, rowIndex?: number): string => `
          ${parseGraphCaller}
          bytes4 rowSelector;
          bytes rowArgs;
          bigint __message_bus_graph_msg_value;
          (rowSelector, rowArgs, __message_bus_graph_msg_value, cursor) = __message_bus_parse_row(
            batchBlob, cursor, ${rowExpression}, __message_bus_version
          );
          bigint __message_bus_call_options = int(bytes.concat(rowArgs.slice(0, 1), hex"00"));
          rowArgs = rowArgs.slice(1, rowArgs.length);
          bytes __message_bus_graph_msg_data = bytes.concat(rowSelector, rowArgs);
          ${!graphOutStateMode ? '' : `require((${rowExpression} + 1) * 2
            <= __internal__graphCompletionPositions.length);
          bigint __message_bus_graph_completion = int(bytes.concat(
            __internal__graphCompletionPositions.slice(${rowExpression} * 2, (${rowExpression} + 1) * 2),
            hex"00"
          ));`}
          ${buildDecodeAndCall(captureResults, rowIndex, rowExpression)}
          else { revert("unknown batch selector"); }
  `;
  const parser = resourceShapedHandler
    ? Array.from({ length: routeMaximumRows }, (_unused, row) =>
      `{ ${parseOneRow(String(row), undefined, row)} }`).join(' ')
    : eventMode || resultMode || valueEffectMode || nestedCollectionMode || fixedArrayMode || signatureMode
      || tokenContainerMode
      ? Array.from({ length: routeMaximumRows }, (_unused, row) =>
        `if (rowCount > ${row}) { ${parseOneRow(String(row), resultMode, row)} }`).join(' ')
      : `for (bigint row = 0; row < rowCount; row = row + 1) {
        ${parseOneRow('row')}
      }`;
  const resultDeclarations = resultMode ? 'bytes __message_bus_results = hex\"\";' : '';
  const returnDeclaration = resultMode
    ? ' returns (bytes)'
    : '';
  const returnStatement = resultMode
    ? 'return __message_bus_results;'
    : '';
  const graphPrologue = '';
  const graphCallManifestLoader = '';
  const offloadedVerifier = compilerOptions.__messageBusVerifierProgram;
  const offloadedVerifierLock = offloadedVerifier
    ? binToHex(messageBusVerifierLockingBytecode(offloadedVerifier)) : '';
  const compactAtomicBinder = `
        require(tx.inputs[activeInputIndex].tokenCategory.length == 33
          && tx.inputs[activeInputIndex].tokenCategory.slice(32, 33) == hex"02"
          && tx.outputs[activeInputIndex].lockingBytecode == tx.inputs[activeInputIndex].lockingBytecode
          && tx.outputs[activeInputIndex].tokenCategory == tx.inputs[activeInputIndex].tokenCategory
          && tx.outputs[activeInputIndex].nftCommitment == tx.inputs[activeInputIndex].nftCommitment);
        bytes activeCategory = tx.inputs[activeInputIndex].tokenCategory.slice(0, 32);
        bigint activeVerifier = __internal__activeVerifierIndex;
        require(activeVerifier >= 0 && activeVerifier < tx.inputs.length
          && tx.inputs[activeVerifier].lockingBytecode == hex"${offloadedVerifierLock}"
          && tx.inputs[activeVerifier].tokenCategory.length == 33
          && tx.inputs[activeVerifier].tokenCategory.slice(0, 32) == activeCategory
          && tx.inputs[activeVerifier].tokenCategory.slice(32, 33) == hex"01");
        require(tx.inputs[activeVerifier].nftCommitment.length >= 6
          && tx.inputs[activeVerifier].nftCommitment.slice(0, 4) == hex"4c335631");
        require(tx.outputs[activeVerifier].nftCommitment == bytes.concat(
          tx.inputs[activeVerifier].nftCommitment.slice(0, 6),
          bindingDigest
        ));
  `;
  const bindingDigestGraphValues = !graphExecutionContext ? '' : `,
          bytes2(suppliedFixedSize), bytes2(suppliedBlockSize), sha256(suppliedEmissions),
          sha256(suppliedCallers), bytes2(suppliedSettlementBoundary),
          sha256(suppliedCompletionPositions), sha256(suppliedSettlementTable)`;
  const atomicCallManifestLoader = `
      function __message_bus_verify_atomic(
        bigint activeInputIndex, bigint expectedLocalRows, bytes localBatch
        ${!offloadedVerifier ? '' : ', bigint __internal__activeVerifierIndex'}
        ${!graphExecutionContext ? '' : `,
        bigint suppliedFixedSize, bigint suppliedBlockSize, bytes suppliedEmissions, bytes suppliedCallers,
        bigint suppliedSettlementBoundary, bytes suppliedCompletionPositions, bytes suppliedSettlementTable`}
      ) internal view returns (bytes) {
        bytes unlocking = tx.inputs[tx.inputs.length - 2].unlockingBytecode;
        require(unlocking.slice(0, 1) == hex"4d");
        bigint messageEnvelopeLength = int(bytes.concat(unlocking.slice(1, 3), hex"00"));
        bytes messageEnvelope = unlocking.slice(3, 3 + messageEnvelopeLength);
        bytes callManifest = messageEnvelope.slice(8, messageEnvelope.length);
        bytes bindingDigest = sha256(bytes.concat(
          sha256(callManifest), bytes2(activeInputIndex), bytes2(expectedLocalRows), sha256(localBatch)
          ${bindingDigestGraphValues}
        ));
        ${offloadedVerifier ? compactAtomicBinder : `
        require(callManifest.length >= 15 && callManifest.slice(0, 8) == hex"4c33425553310000");
        require(int(bytes.concat(callManifest.slice(8, 12), hex"00000000")) == callManifest.length);
        bigint participantCount = int(bytes.concat(callManifest.slice(12, 13), hex"00"));
        require(participantCount >= 2 && participantCount <= 8);
        bigint cursor = 13;
        bigint expectedBase = 0;
        bigint activeMembership = 0;
        bigint activeParticipant = 255;
        bigint activeFixedSize = 0;
        bigint activeBlockSize = 0;
        bigint activeMaximumSize = 0;
        bigint activeReturnOutput = 65535;
        bytes activeCategory;
        bytes participantBases = hex"";
        bytes participantSizes = hex"";
        bytes participantLbcs = hex"";
        for (bigint participant = 0; participant < participantCount; participant = participant + 1) {
          require(cursor + 45 <= callManifest.length);
          bigint base = expectedBase;
          bigint fixedSize = int(bytes.concat(callManifest.slice(cursor, cursor + 2), hex"00"));
          bigint blockSize = int(bytes.concat(callManifest.slice(cursor + 2, cursor + 4), hex"00"));
          bigint lbcLength = int(bytes.concat(callManifest.slice(cursor + 4, cursor + 6), hex"00"));
          cursor = cursor + 6;
          require(fixedSize >= 1 && blockSize >= fixedSize && lbcLength > 0);
          participantBases = bytes.concat(participantBases, bytes2(base));
          participantSizes = bytes.concat(participantSizes, bytes2(blockSize));
          expectedBase = expectedBase + blockSize;
          require(expectedBase < tx.inputs.length && cursor + lbcLength + 38 <= callManifest.length);
          bytes participantLbc = callManifest.slice(cursor, cursor + lbcLength);
          cursor = cursor + lbcLength;
          participantLbcs = bytes.concat(participantLbcs, bytes2(lbcLength), participantLbc);
          bytes category = callManifest.slice(cursor, cursor + 32);
          bigint maximumSize = int(bytes.concat(callManifest.slice(cursor + 32, cursor + 34), hex"00"));
          bigint trailingUsed = int(bytes.concat(callManifest.slice(cursor + 34, cursor + 36), hex"00"));
          bigint returnOffset = int(bytes.concat(callManifest.slice(cursor + 36, cursor + 38), hex"00"));
          bigint returnOutput = returnOffset == 65535 ? 65535 : base + returnOffset;
          cursor = cursor + 38;
          require(base < tx.inputs.length && base < tx.outputs.length);
          require(tx.inputs[base].lockingBytecode == participantLbc);
          require(tx.inputs[base].tokenCategory.length >= 33
            && tx.inputs[base].tokenCategory.slice(0, 32) == category
            && tx.inputs[base].tokenCategory.slice(32, 33) == hex"02");
          require(tx.outputs[base].lockingBytecode == participantLbc
            && tx.outputs[base].tokenCategory == tx.inputs[base].tokenCategory);
          require(blockSize == fixedSize + trailingUsed && blockSize <= maximumSize);
          require(returnOffset == 65535 || returnOffset < fixedSize);
          if (base == activeInputIndex) {
            activeMembership = activeMembership + 1;
            activeParticipant = participant;
            activeFixedSize = fixedSize;
            activeBlockSize = blockSize;
            activeMaximumSize = maximumSize;
            activeReturnOutput = returnOutput;
            activeCategory = category;
          }
        }
        // Participant prefix || one artifact-specialized verifier per participant || one fee input.
        require(activeMembership == 1 && expectedBase + participantCount + 1 == tx.inputs.length);
        bigint activeVerifier = expectedBase + activeParticipant;
        require(tx.inputs[activeVerifier].tokenCategory.length == 33
          && tx.inputs[activeVerifier].tokenCategory.slice(0, 32) == activeCategory
          && tx.inputs[activeVerifier].tokenCategory.slice(32, 33) == hex"01");
        require(tx.outputs[activeVerifier].lockingBytecode == tx.inputs[activeVerifier].lockingBytecode
          && tx.outputs[activeVerifier].tokenCategory == tx.inputs[activeVerifier].tokenCategory
          && tx.outputs[activeVerifier].tokenAmount == tx.inputs[activeVerifier].tokenAmount
          && tx.outputs[activeVerifier].value == tx.inputs[activeVerifier].value);
        require(tx.inputs[activeVerifier].nftCommitment.length >= 6
          && tx.inputs[activeVerifier].nftCommitment.slice(0, 4) == hex"4c335631");
        require(tx.outputs[activeVerifier].nftCommitment == bytes.concat(
          tx.inputs[activeVerifier].nftCommitment.slice(0, 6),
          bindingDigest
        ));
        require(tx.outputs.length == tx.inputs.length);
        require(cursor + 2 <= callManifest.length);
        bigint rowCount = int(bytes.concat(callManifest.slice(cursor, cursor + 2), hex"00"));
        require(rowCount <= 24);
        cursor = cursor + 2;
        bigint consumedLocalRows = 0;
        bigint batchCursor = 7;
        bigint batchVersion = int(bytes.concat(localBatch.slice(4, 5), hex"00"));
        bigint batchModeWidth = batchVersion == 2 ? 1 : 0;
        bigint batchValueWidth = int(bytes.concat(localBatch.slice(5, 6), hex"00")) * 9;
        bytes rowConsumers = hex"";
        bytes rowDepths = hex"";
        bytes localResultVector = hex"";
        bytes expectedEmissions = hex"";
        bytes expectedCallers = hex"";
        bytes expectedCompletionPositions = hex"";
        bytes participantBoundaries = hex"";
        for (bigint participant = 0; participant < participantCount; participant = participant + 1) {
          participantBoundaries = bytes.concat(participantBoundaries, hex"0000");
        }
        bigint activeSettlementBoundary = 0;
        bigint invocationRows = 0;
        bigint rootSubtreeEnd = 65535;
        bigint activeResourceEndpoints = 0;
        bigint activeSatoshiContainerRows = 0;
        bigint activeTokenContainerRows = 0;
        bigint activeEventRows = 0;
        bigint activeValueRows = 0;
        bigint activeTokenRows = 0;
        bigint activeSidecarRows = 0;
        bigint activeStaticInvocationRows = 0;
        bigint previousResourceTarget = -1;
        bigint previousEventTarget = -1;
        bigint previousValueTarget = -1;
        bigint previousTokenTarget = -1;
        bigint previousSidecarTarget = -1;
        bytes activeSidecarTargets = hex"";
        bigint eventsStarted = 0;
        bigint effectsStarted = 0;
        for (bigint row = 0; row < rowCount; row = row + 1) {
          require(cursor + 29 <= callManifest.length);
          bigint rowStart = cursor;
          bigint kind = int(bytes.concat(callManifest.slice(cursor, cursor + 1), hex"00"));
          bigint owner = int(bytes.concat(callManifest.slice(cursor + 1, cursor + 2), hex"00"));
          bigint consumer = int(bytes.concat(callManifest.slice(cursor + 2, cursor + 3), hex"00"));
          require(kind <= 6 && owner < participantCount && consumer < participantCount);
          bigint sourceOffset = int(bytes.concat(callManifest.slice(cursor + 6, cursor + 8), hex"00"));
          bigint targetOffset = int(bytes.concat(callManifest.slice(cursor + 8, cursor + 10), hex"00"));
          bigint completion = int(bytes.concat(callManifest.slice(cursor + 14, cursor + 16), hex"00"));
          bigint parent = int(bytes.concat(callManifest.slice(cursor + 16, cursor + 18), hex"00"));
          bigint depth = int(bytes.concat(callManifest.slice(cursor + 18, cursor + 19), hex"00"));
          bigint subtreeEnd = int(bytes.concat(callManifest.slice(cursor + 19, cursor + 21), hex"00"));
          bigint participantBase = int(bytes.concat(
            participantBases.slice(consumer * 2, consumer * 2 + 2), hex"00"
          ));
          bigint participantSize = int(bytes.concat(
            participantSizes.slice(consumer * 2, consumer * 2 + 2), hex"00"
          ));
          bigint targetSlot = participantBase + targetOffset;
          bigint sourceSlot = sourceOffset == 65535 ? 65535 : int(bytes.concat(
            participantBases.slice(owner * 2, owner * 2 + 2), hex"00"
          )) + sourceOffset;
          if (kind == 0) {
            require(effectsStarted == 0 && targetOffset == 0);
            if (row == 0) {
              require(parent == 65535 && depth == 0 && sourceOffset == 65535 && owner == consumer);
              rootSubtreeEnd = subtreeEnd;
            } else {
              require(parent < invocationRows && depth >= 1 && depth <= 7);
              require(owner == int(bytes.concat(rowConsumers.slice(parent, parent + 1), hex"00")));
              require(depth == int(bytes.concat(rowDepths.slice(parent, parent + 1), hex"00")) + 1);
              require(sourceOffset == 0);
            }
            require(subtreeEnd >= row && subtreeEnd < rowCount && completion == subtreeEnd + 1);
            rowConsumers = bytes.concat(rowConsumers, bytes1(consumer));
            rowDepths = bytes.concat(rowDepths, bytes1(depth));
            invocationRows = invocationRows + 1;
          } else {
            require((kind == 1 || kind == 2 || kind == 3 || kind == 4 || kind == 6)
              && invocationRows > 0);
            effectsStarted = 1;
            require(owner == consumer && sourceOffset == targetOffset && targetOffset < participantSize);
            require(int(bytes.concat(callManifest.slice(cursor + 3, cursor + 5), hex"00"))
              == targetOffset);
            require(callManifest.slice(cursor + 10, cursor + 14) == hex"00000000");
            require(completion == int(bytes.concat(callManifest.slice(cursor + 3, cursor + 5), hex"00")));
            if (kind == 1) {
              require(eventsStarted == 0 && targetSlot > previousResourceTarget);
              previousResourceTarget = targetSlot;
              require(int(bytes.concat(callManifest.slice(cursor + 5, cursor + 6), hex"00")) <= 4);
              require(parent == 65535 && depth == 0 && subtreeEnd == completion);
            } else if (kind == 2) {
              eventsStarted = 1;
              require(targetSlot > previousEventTarget);
              previousEventTarget = targetSlot;
              require(int(bytes.concat(callManifest.slice(cursor + 5, cursor + 6), hex"00")) == 1);
              require(parent < invocationRows
                && consumer == int(bytes.concat(rowConsumers.slice(parent, parent + 1), hex"00")));
              require(depth == int(bytes.concat(rowDepths.slice(parent, parent + 1), hex"00")));
              require(subtreeEnd == parent);
            } else if (kind == 3) {
              require(targetSlot > previousValueTarget);
              previousValueTarget = targetSlot;
              require(int(bytes.concat(callManifest.slice(cursor + 5, cursor + 6), hex"00")) == 1);
              require(parent < invocationRows
                && consumer == int(bytes.concat(rowConsumers.slice(parent, parent + 1), hex"00")));
              require(depth == int(bytes.concat(rowDepths.slice(parent, parent + 1), hex"00")));
              require(subtreeEnd == parent);
            } else if (kind == 4) {
              require(targetSlot > previousTokenTarget);
              previousTokenTarget = targetSlot;
              require(int(bytes.concat(callManifest.slice(cursor + 5, cursor + 6), hex"00")) <= 3);
              require(parent < invocationRows
                && consumer == int(bytes.concat(rowConsumers.slice(parent, parent + 1), hex"00")));
              require(depth == int(bytes.concat(rowDepths.slice(parent, parent + 1), hex"00")));
              require(subtreeEnd == parent);
            } else {
              require(targetSlot > previousSidecarTarget);
              previousSidecarTarget = targetSlot;
              require(int(bytes.concat(callManifest.slice(cursor + 5, cursor + 6), hex"00")) <= 2);
              require(parent == 65535 && depth == 0 && subtreeEnd == completion);
            }
          }
          cursor = cursor + 21;
          bytes rowSubject;
          bytes rowArguments;
          bytes rowResult;
          bytes rowEffect;
          for (bigint field = 0; field < 4; field = field + 1) {
            require(cursor + 2 <= callManifest.length);
            bigint fieldLength = int(bytes.concat(callManifest.slice(cursor, cursor + 2), hex"00"));
            cursor = cursor + 2;
            require(cursor + fieldLength <= callManifest.length);
            if (field == 0) { rowSubject = callManifest.slice(cursor, cursor + fieldLength); }
            if (field == 1) { rowArguments = callManifest.slice(cursor, cursor + fieldLength); }
            if (field == 2) { rowResult = callManifest.slice(cursor, cursor + fieldLength); }
            if (field == 3) { rowEffect = callManifest.slice(cursor, cursor + fieldLength); }
            cursor = cursor + fieldLength;
          }
          ${resourceVerificationMode ? `if (kind == 1 && owner == activeParticipant) {
            bigint resourceMode = int(bytes.concat(callManifest.slice(rowStart + 5, rowStart + 6), hex"00"));
            require(rowSubject.length > 0);
            if (resourceMode == 3) {
              require(rowArguments.length == 8 && rowResult.length == 0 && rowEffect.length == 8);
              require(tx.inputs[sourceSlot].lockingBytecode == rowSubject
                && tx.outputs[targetSlot].lockingBytecode == rowSubject
                && tx.inputs[sourceSlot].tokenCategory.length == 0
                && tx.outputs[targetSlot].tokenCategory.length == 0);
              require(tx.inputs[sourceSlot].value
                == int(bytes.concat(rowArguments, hex"00")));
              require(tx.outputs[targetSlot].value
                == int(bytes.concat(rowEffect, hex"00")));
              if (owner == activeParticipant) { activeSatoshiContainerRows = activeSatoshiContainerRows + 1; }
            } else if (resourceMode == 4) {
              require((rowArguments.length == 32 || rowArguments.length == 33)
                && rowResult.length >= 8 && rowEffect.length >= 1);
              require(tx.inputs[sourceSlot].lockingBytecode == rowSubject
                && tx.inputs[sourceSlot].tokenCategory == rowArguments
                && tx.inputs[sourceSlot].nftCommitment == rowResult.slice(8, rowResult.length));
              require(tx.inputs[sourceSlot].tokenAmount
                == int(bytes.concat(rowResult.slice(0, 8), hex"00")));
              bigint outputCategoryLength = int(bytes.concat(rowEffect.slice(0, 1), hex"00"));
              require(outputCategoryLength == 0 || outputCategoryLength == 32 || outputCategoryLength == 33);
              if (outputCategoryLength == 0) {
                require(rowEffect.length == 1 && tx.outputs[targetSlot].tokenCategory.length == 0
                  && tx.outputs[targetSlot].lockingBytecode == hex"6a" && tx.outputs[targetSlot].value == 0);
              } else {
                require(rowEffect.length >= 1 + outputCategoryLength + 8
                  && tx.outputs[targetSlot].lockingBytecode == rowSubject
                  && tx.outputs[targetSlot].tokenCategory
                    == rowEffect.slice(1, 1 + outputCategoryLength));
                require(tx.outputs[targetSlot].tokenAmount == int(bytes.concat(
                  rowEffect.slice(1 + outputCategoryLength, 9 + outputCategoryLength), hex"00")));
                require(tx.outputs[targetSlot].nftCommitment
                  == rowEffect.slice(9 + outputCategoryLength, rowEffect.length));
                require(tx.inputs[sourceSlot].value == tx.outputs[targetSlot].value);
              }
              if (owner == activeParticipant) { activeTokenContainerRows = activeTokenContainerRows + 1; }
            } else {
              require(rowArguments.length == 33 && rowArguments.slice(32, 33) == hex"01");
              if (resourceMode != 1) {
                require(tx.inputs[sourceSlot].lockingBytecode == rowSubject
                  && tx.inputs[sourceSlot].tokenCategory == rowArguments
                  && tx.inputs[sourceSlot].nftCommitment == rowResult
                  && tx.inputs[sourceSlot].tokenAmount == 0);
              } else {
                require(rowResult.length == 0 && tx.inputs[sourceSlot].tokenCategory.length == 0);
              }
              if (resourceMode != 2) {
                require(tx.outputs[targetSlot].lockingBytecode == rowSubject
                  && tx.outputs[targetSlot].tokenCategory == rowArguments
                  && tx.outputs[targetSlot].nftCommitment == rowEffect
                  && tx.outputs[targetSlot].tokenAmount == 0);
              } else {
                require(rowEffect.length == 0 && tx.outputs[targetSlot].tokenCategory.length == 0);
              }
              if (resourceMode == 0) { require(tx.inputs[sourceSlot].value == tx.outputs[targetSlot].value); }
              if (owner == activeParticipant) {
                activeResourceEndpoints = activeResourceEndpoints + (resourceMode == 0 ? 2 : 1);
              }
            }
          }` : ''}
          ${eventMode ? `if (kind == 2 && owner == activeParticipant) {
            require(rowArguments.length == 0 && rowResult.length == 0 && rowEffect.length > 0);
            require(rowSubject == tx.outputs[targetSlot].lockingBytecode);
            require(rowEffect == tx.outputs[targetSlot].nftCommitment);
            require(tx.outputs[targetSlot].tokenCategory == activeCategory
              || owner != activeParticipant);
            require(tx.outputs[targetSlot].tokenAmount == 0);
            if (owner == activeParticipant) { activeEventRows = activeEventRows + 1; }
          }` : ''}
          ${valueEffectMode ? `if (kind == 3 && owner == activeParticipant) {
            require(rowArguments.length == 0 && rowResult.length == 0 && rowEffect.length == 8);
            require(rowSubject.length > 0 && rowSubject != hex"51");
            require(tx.inputs[sourceSlot].lockingBytecode
              == hex"${BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX}");
            require(tx.inputs[sourceSlot].tokenCategory.length == 0
              && tx.outputs[targetSlot].tokenCategory.length == 0);
            require(tx.outputs[targetSlot].lockingBytecode == rowSubject);
            require(tx.outputs[targetSlot].value == int(bytes.concat(rowEffect, hex"00")));
            if (owner == activeParticipant) { activeValueRows = activeValueRows + 1; }
          }` : ''}
          ${tokenContainerMode ? `if (kind == 4 && owner == activeParticipant) {
            bigint tokenMode = int(bytes.concat(callManifest.slice(rowStart + 5, rowStart + 6), hex"00"));
            require((tokenMode == 0 && rowArguments.length == 32 && rowEffect.length == 8)
              || (tokenMode == 1 && rowArguments.length == 32)
              || (tokenMode > 1 && tokenMode <= 3 && rowArguments.length == 33
                && rowArguments.slice(32, 33) == bytes1(tokenMode - 1)));
            require(rowResult.length == 0);
            require(rowSubject.length > 0 && rowSubject != hex"51");
            require(tx.inputs[sourceSlot].lockingBytecode
              == hex"${BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX}");
            require(tx.inputs[sourceSlot].tokenCategory.length == 0);
            require(tx.outputs[targetSlot].lockingBytecode == rowSubject
              && tx.outputs[targetSlot].tokenCategory == rowArguments);
            if (tokenMode == 0) {
              require(tx.outputs[targetSlot].nftCommitment.length == 0
                && tx.outputs[targetSlot].tokenAmount == int(bytes.concat(rowEffect, hex"00"))
                && tx.outputs[targetSlot].tokenAmount > 0);
            } else {
              require(tx.outputs[targetSlot].tokenAmount == 0
                && tx.outputs[targetSlot].nftCommitment == rowEffect);
            }
            if (owner == activeParticipant) { activeTokenRows = activeTokenRows + 1; }
          }` : ''}
          ${sidecarVerificationMode ? `if (kind == 6 && owner == activeParticipant) {
            require(rowSubject.length > 0 && rowArguments.length >= 32 && rowResult.length == 0
              && rowEffect.length >= 8);
            bigint categoryLength = tx.inputs[sourceSlot].tokenCategory.length;
            require((categoryLength == 32 || categoryLength == 33)
              && rowArguments.slice(0, categoryLength) == tx.inputs[sourceSlot].tokenCategory
              && rowArguments.slice(categoryLength, rowArguments.length)
                == tx.inputs[sourceSlot].nftCommitment);
            require(tx.inputs[sourceSlot].lockingBytecode == rowSubject
              && tx.outputs[targetSlot].lockingBytecode == rowSubject
              && tx.outputs[targetSlot].tokenCategory == tx.inputs[sourceSlot].tokenCategory
              && tx.outputs[targetSlot].tokenAmount == tx.inputs[sourceSlot].tokenAmount
              && tx.outputs[targetSlot].value == tx.inputs[sourceSlot].value
              && tx.outputs[targetSlot].value
                == int(bytes.concat(rowEffect.slice(0, 8), hex"00"))
              && tx.outputs[targetSlot].nftCommitment == rowEffect.slice(8, rowEffect.length));
            if (owner == activeParticipant) {
              activeSidecarRows = activeSidecarRows + 1;
              activeSidecarTargets = bytes.concat(activeSidecarTargets, bytes2(targetSlot));
            }
          }` : ''}
          bigint priorBoundary = int(bytes.concat(
            participantBoundaries.slice(consumer * 2, consumer * 2 + 2), hex"00"
          ));
          if (kind == 0 && completion > priorBoundary) {
            participantBoundaries = bytes.concat(
              participantBoundaries.slice(0, consumer * 2), bytes2(completion),
              participantBoundaries.slice(consumer * 2 + 2, participantBoundaries.length)
            );
          }
          if (kind == 0 && row > 0 && owner == activeParticipant) {
            bytes targetLbc = tx.inputs[targetSlot].lockingBytecode;
            expectedEmissions = bytes.concat(
              expectedEmissions, bytes2(targetLbc.length), targetLbc,
              callManifest.slice(rowStart + 5, rowStart + 6),
              callManifest.slice(rowStart + 10, rowStart + 14),
              bytes2(rowArguments.length), rowArguments, bytes2(rowResult.length), rowResult
            );
          }
          if (kind == 0 && consumer == activeParticipant) {
            require(batchCursor + 12 + batchModeWidth + batchValueWidth <= localBatch.length);
            bigint batchArgsLength = int(bytes.concat(
              localBatch.slice(batchCursor + 10, batchCursor + 12), hex"00"
            ));
            bigint batchArgsStart = batchCursor + 12 + batchModeWidth + batchValueWidth;
            require(batchArgsStart + batchArgsLength <= localBatch.length);
            require(callManifest.slice(rowStart + 10, rowStart + 14)
              == localBatch.slice(batchCursor, batchCursor + 4));
            bigint callManifestMode = int(bytes.concat(callManifest.slice(rowStart + 5, rowStart + 6), hex"00"));
            if (callManifestMode % 2 == 1) {
              activeStaticInvocationRows = activeStaticInvocationRows + 1;
            }
            if (batchModeWidth == 0) { require(callManifestMode == 0); }
            else {
              require(callManifestMode
                == int(bytes.concat(localBatch.slice(batchCursor + 12, batchCursor + 13), hex"00")));
            }
            require(rowArguments == localBatch.slice(batchArgsStart, batchArgsStart + batchArgsLength));
            localResultVector = bytes.concat(localResultVector, rowResult);
            if (row == 0) {
              ${graphExecutionContext
    ? 'require(rowSubject == tx.origin);'
    : 'require(rowSubject.length == 0 || rowSubject == tx.origin);'}
            }
            else { require(rowSubject == tx.inputs[sourceSlot].lockingBytecode); }
            expectedCallers = bytes.concat(expectedCallers, bytes2(rowSubject.length), rowSubject);
            expectedCompletionPositions = bytes.concat(expectedCompletionPositions, bytes2(completion));
            if (completion > activeSettlementBoundary) { activeSettlementBoundary = completion; }
            batchCursor = batchArgsStart + batchArgsLength;
            consumedLocalRows = consumedLocalRows + 1;
          }
        }
        require(invocationRows > 0 && rootSubtreeEnd + 1 == invocationRows);
        bigint physicalResourceEndpoints = 0;
        bigint physicalSatoshiContainers = 0;
        bigint physicalTokenContainers = 0;
        bigint physicalEventOutputs = 0;
        bigint physicalValueOutputs = 0;
        bigint physicalTokenOutputs = 0;
        for (bigint slot = activeInputIndex;
          slot < activeInputIndex + activeBlockSize; slot = slot + 1) {
          bigint isSidecarSlot = 0;
          ${sidecarVerificationMode ? `for (bigint sidecar = 0;
            sidecar < activeSidecarTargets.length; sidecar = sidecar + 2) {
            if (slot == int(bytes.concat(
              activeSidecarTargets.slice(sidecar, sidecar + 2), hex"00"))) {
              isSidecarSlot = 1;
            }
          }` : ''}
          // Atomic staticcall security boundary: every participant enforces this snapshot walk from
          // its mutually authenticated local rows.
          // A return-event slot is allowed to publish the authenticated result vector, but every other slot in
          // the participant's complete balanced block must be byte-for-byte and value-for-value preserved.
          if (activeStaticInvocationRows > 0) {
            require(tx.outputs[slot].value == tx.inputs[slot].value);
            if (slot != activeReturnOutput) {
              require(tx.outputs[slot].lockingBytecode == tx.inputs[slot].lockingBytecode);
              require(tx.outputs[slot].tokenCategory == tx.inputs[slot].tokenCategory);
              require(tx.outputs[slot].nftCommitment == tx.inputs[slot].nftCommitment);
              require(tx.outputs[slot].tokenAmount == tx.inputs[slot].tokenAmount);
            }
          }
          if (tx.inputs[slot].tokenCategory.length == 33
            && tx.inputs[slot].tokenCategory.slice(0, 32) == activeCategory
            && tx.inputs[slot].tokenCategory.slice(32, 33) == hex"01") {
            physicalResourceEndpoints = physicalResourceEndpoints + 1;
          }
          if (tx.outputs[slot].tokenCategory.length == 33
            && tx.outputs[slot].tokenCategory.slice(0, 32) == activeCategory
            && tx.outputs[slot].tokenCategory.slice(32, 33) == hex"01") {
            physicalResourceEndpoints = physicalResourceEndpoints + 1;
          }
          if (tx.inputs[slot].tokenCategory.length == 0
            && tx.outputs[slot].tokenCategory.length == 0
            && tx.inputs[slot].lockingBytecode == tx.outputs[slot].lockingBytecode
            && tx.inputs[slot].lockingBytecode != hex"${BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX}") {
            physicalSatoshiContainers = physicalSatoshiContainers + 1;
          }
          if ((tx.inputs[slot].tokenCategory.length == 32 || tx.inputs[slot].tokenCategory.length == 33)
            && tx.inputs[slot].tokenCategory.slice(0, 32) != activeCategory.slice(0, 32)
            && isSidecarSlot == 0
            && tx.inputs[slot].lockingBytecode != hex"${BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX}") {
            physicalTokenContainers = physicalTokenContainers + 1;
          }
          if (tx.inputs[slot].lockingBytecode == hex"${BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX}"
            && tx.outputs[slot].tokenCategory.length == 0
            && tx.outputs[slot].lockingBytecode != hex"51") {
            physicalValueOutputs = physicalValueOutputs + 1;
          }
          if (tx.inputs[slot].lockingBytecode == hex"${BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX}"
            && (tx.outputs[slot].tokenCategory.length == 32
              || (tx.outputs[slot].tokenCategory.length == 33
                && tx.outputs[slot].tokenCategory != bytes.concat(activeCategory, hex"02")))
            // Participant-owned state/event NFTs use the participant category and are authenticated as
            // resource/event rows. A tcTransfer category is necessarily foreign to that participant in this
            // admitted shape; excluding the local category prevents trailing chunk mints from satisfying the
            // token-settlement cardinality check.
            && tx.outputs[slot].tokenCategory.slice(0, 32) != activeCategory) {
            physicalTokenOutputs = physicalTokenOutputs + 1;
          }
          if (slot != activeReturnOutput && tx.outputs[slot].tokenCategory == activeCategory
            && tx.inputs[slot].tokenCategory != activeCategory
            && tx.outputs[slot].tokenAmount == 0) {
            physicalEventOutputs = physicalEventOutputs + 1;
          }
        }
        require(activeResourceEndpoints == physicalResourceEndpoints);
        require(activeSatoshiContainerRows == physicalSatoshiContainers);
        require(activeTokenContainerRows == physicalTokenContainers);
        require(activeEventRows == physicalEventOutputs);
        require(activeValueRows == physicalValueOutputs);
        require(activeTokenRows == physicalTokenOutputs);
        require(activeSidecarRows * 2 == activeSidecarTargets.length);
        require(cursor == callManifest.length && consumedLocalRows == expectedLocalRows
          && batchCursor == localBatch.length);
        ${!graphExecutionContext ? '' : `
        require(suppliedFixedSize == activeFixedSize && suppliedBlockSize == activeMaximumSize);
        require(suppliedEmissions == expectedEmissions);
        require(suppliedCallers == expectedCallers);
        require(suppliedSettlementBoundary == activeSettlementBoundary);
        require(suppliedCompletionPositions == expectedCompletionPositions);
        bytes expectedSettlementTable = hex"";
        bigint lbcCursor = 0;
        for (bigint participant = 0; participant < participantCount; participant = participant + 1) {
          bigint lbcLength = int(bytes.concat(participantLbcs.slice(lbcCursor, lbcCursor + 2), hex"00"));
          bytes participantLbc = participantLbcs.slice(lbcCursor + 2, lbcCursor + 2 + lbcLength);
          expectedSettlementTable = bytes.concat(
            expectedSettlementTable, bytes2(lbcLength), participantLbc,
            participantBases.slice(participant * 2, participant * 2 + 2),
            participantBoundaries.slice(participant * 2, participant * 2 + 2)
          );
          lbcCursor = lbcCursor + 2 + lbcLength;
        }
        require(lbcCursor == participantLbcs.length && suppliedSettlementTable == expectedSettlementTable);`}
        if (activeReturnOutput == 65535) { require(localResultVector.length == 0); }
        else {
          require(localResultVector.length <= 126);
          bytes expectedCommitment;
          if (localResultVector.length <= 75) {
            expectedCommitment = bytes.concat(bytes1(localResultVector.length), localResultVector);
          } else {
            expectedCommitment = bytes.concat(hex"4c", bytes1(localResultVector.length), localResultVector);
          }
          require(tx.outputs[activeReturnOutput].nftCommitment == expectedCommitment);
        }
        `}
        return bytes.concat(
          bindingDigest,
          sha256(bytes.concat(hex"4c334331", bytes4(callManifest.length), callManifest))
        );
      }
  `;
  const atomicPrologue = `
        if (${offloadedVerifier && !graphExecutionContext ? '__internal__activeVerifierIndex >= 0 && ' : ''}
          tx.inputs[this.activeInputIndex].outpointIndex != 4294967295) {
          bytes __internal__atomicBindingDigest = __message_bus_verify_atomic(
            this.activeInputIndex, rowCount, batchBlob
            ${!offloadedVerifier ? '' : ', __internal__activeVerifierIndex'}
            ${!graphExecutionContext ? '' : `,
            __internal__graphFixedSize, __internal__graphBlockSize,
            __internal__graphEmissions, __internal__graphCallers,
            __internal__graphSettlementBoundary, __internal__graphCompletionPositions,
            __internal__graphSettlementTable`}
          );
        }
  `;
  const fixedIterationEntryPins = [...fixedIterationCollections].flatMap((name) => {
    const collection = collectionByName.get(name)!;
    const bound = collection.type instanceof ArrayType ? collection.type.bound ?? 0 : 0;
    return Array.from({ length: bound }, (_unused, index) =>
      `require(this.${name}[${index}] == this.${name}[${index}]);`);
  }).join('\n');
  const routeStructs = [...ast.structDefinitions, ...contract.structDefinitions]
    .filter((definition, index, all) =>
      all.findIndex((candidate) => candidate.name === definition.name) === index)
    .map((definition) => `struct ${definition.name} { ${
      definition.fields.map((field) => `${field.type.toString()} ${field.name};`).join(' ')
    } }`)
    .join('\n');
  // The route is parsed as a stand-alone source file before its functions are attached to the
  // user's AST. Preserve the named scalar declarations which occur in handler signatures and
  // route-key witnesses; otherwise the route parser guesses every unknown capitalized name is a
  // contract handle. That turns enum/UDVT decoding into address decoding and only fails later,
  // after the generated functions have been merged, with a misleading generated-source error.
  const routeEnums = [...ast.enumDefinitions, ...contract.enumDefinitions]
    .filter((definition, index, all) =>
      all.findIndex((candidate) => candidate.name === definition.name) === index)
    .map((definition) => `enum ${definition.name} { ${
      definition.members.map((member) => member.name).join(', ')
    } }`)
    .join('\n');
  const routeTypes = [...ast.typeDefinitions, ...contract.typeDefinitions]
    .filter((definition, index, all) =>
      all.findIndex((candidate) => candidate.name === definition.name) === index)
    .map((definition) => `type ${definition.name} is ${definition.valueType.underlyingType.toString()};`)
    .join('\n');
  const source = `pragma solidcash >=0.8.0;
    ${routeEnums}
    ${routeTypes}
    ${routeStructs}
    contract __MessageBusHost() {
      ${graphCallManifestLoader}
      ${atomicCallManifestLoader}
      function __message_bus_parse_row(
        bytes __message_bus_blob, bigint __message_bus_at, bigint __message_bus_expected_callsite, bigint __message_bus_version
      ) internal pure returns (bytes4, bytes, bigint, bigint) {
        require(__message_bus_at + ${logicalValueMode ? 21 : 12} <= __message_bus_blob.length);
        bytes4 __message_bus_parsed_selector = bytes4(__message_bus_blob.slice(__message_bus_at, __message_bus_at + 4));
        __message_bus_at = __message_bus_at + 4;
        bigint __message_bus_callsite = int(bytes.concat(__message_bus_blob.slice(__message_bus_at, __message_bus_at + 4), hex"00"));
        __message_bus_at = __message_bus_at + 4;
        require(__message_bus_callsite == __message_bus_expected_callsite);
        bigint __message_bus_occurrence = int(bytes.concat(__message_bus_blob.slice(__message_bus_at, __message_bus_at + 2), hex"00"));
        __message_bus_at = __message_bus_at + 2;
        require(__message_bus_occurrence == 0);
        bigint __message_bus_args_length = int(bytes.concat(__message_bus_blob.slice(__message_bus_at, __message_bus_at + 2), hex"00"));
        __message_bus_at = __message_bus_at + 2;
        bigint __message_bus_call_options = 0;
        if (__message_bus_version == 2) {
          __message_bus_call_options = int(bytes.concat(__message_bus_blob.slice(__message_bus_at, __message_bus_at + 1), hex"00"));
          require(__message_bus_call_options <= 1);
          __message_bus_at = __message_bus_at + 1;
        }
        bigint __message_bus_logical_value = 0;
        ${logicalValueMode ? `
        bigint __message_bus_value_negative = int(bytes.concat(__message_bus_blob.slice(__message_bus_at, __message_bus_at + 1), hex"00"));
        require(__message_bus_value_negative == 0 || __message_bus_value_negative == 1);
        __message_bus_at = __message_bus_at + 1;
        bigint __message_bus_value_magnitude = int(bytes.concat(
          __message_bus_blob.slice(__message_bus_at, __message_bus_at + 8), hex"00"
        ));
        __message_bus_at = __message_bus_at + 8;
        __message_bus_logical_value = __message_bus_value_negative == 1
          ? -__message_bus_value_magnitude : __message_bus_value_magnitude;
        ` : ''}
        require(__message_bus_args_length >= 0 && __message_bus_at + __message_bus_args_length <= __message_bus_blob.length);
        bytes __message_bus_parsed_args = bytes.concat(bytes1(__message_bus_call_options),
          __message_bus_blob.slice(__message_bus_at, __message_bus_at + __message_bus_args_length));
        return (
          __message_bus_parsed_selector, __message_bus_parsed_args, __message_bus_logical_value,
          __message_bus_at + __message_bus_args_length
        );
      }
      ${!graphExecutionContext ? '' : `
      function __message_bus_parse_graph_caller(
        bytes __message_bus_callers, bigint __message_bus_at
      ) internal pure returns (address, bigint) {
        require(__message_bus_at + 2 <= __message_bus_callers.length);
        bigint __message_bus_caller_length = int(bytes.concat(
          __message_bus_callers.slice(__message_bus_at, __message_bus_at + 2), hex"00"
        ));
        __message_bus_at = __message_bus_at + 2;
        require(__message_bus_at + __message_bus_caller_length <= __message_bus_callers.length);
        return (
          address(__message_bus_callers.slice(__message_bus_at, __message_bus_at + __message_bus_caller_length)),
          __message_bus_at + __message_bus_caller_length
        );
      }`}
      ${!graphOutStateMode ? '' : `
      function __message_bus_graph_owner_input(bytes __message_bus_table, address __message_bus_target) internal pure returns (bigint) {
        bigint __message_bus_at = 0;
        while (__message_bus_at < __message_bus_table.length) {
          require(__message_bus_at + 2 <= __message_bus_table.length);
          bigint __message_bus_lbc_length = int(bytes.concat(__message_bus_table.slice(__message_bus_at, __message_bus_at + 2), hex"00"));
          __message_bus_at = __message_bus_at + 2;
          require(__message_bus_at + __message_bus_lbc_length + 4 <= __message_bus_table.length);
          bytes __message_bus_lbc = __message_bus_table.slice(__message_bus_at, __message_bus_at + __message_bus_lbc_length);
          bigint __message_bus_input = int(bytes.concat(
            __message_bus_table.slice(__message_bus_at + __message_bus_lbc_length, __message_bus_at + __message_bus_lbc_length + 2), hex"00"
          ));
          if (__message_bus_lbc == __message_bus_target) { return __message_bus_input; }
          __message_bus_at = __message_bus_at + __message_bus_lbc_length + 4;
        }
        revert("foreign outState owner absent");
      }
      function __message_bus_graph_settlement(bytes __message_bus_table, address __message_bus_target) internal pure returns (bigint) {
        bigint __message_bus_at = 0;
        while (__message_bus_at < __message_bus_table.length) {
          require(__message_bus_at + 2 <= __message_bus_table.length);
          bigint __message_bus_lbc_length = int(bytes.concat(__message_bus_table.slice(__message_bus_at, __message_bus_at + 2), hex"00"));
          __message_bus_at = __message_bus_at + 2;
          require(__message_bus_at + __message_bus_lbc_length + 4 <= __message_bus_table.length);
          bytes __message_bus_lbc = __message_bus_table.slice(__message_bus_at, __message_bus_at + __message_bus_lbc_length);
          bigint __message_bus_boundary = int(bytes.concat(
            __message_bus_table.slice(__message_bus_at + __message_bus_lbc_length + 2, __message_bus_at + __message_bus_lbc_length + 4), hex"00"
          ));
          if (__message_bus_lbc == __message_bus_target) { return __message_bus_boundary; }
          __message_bus_at = __message_bus_at + __message_bus_lbc_length + 4;
        }
        revert("foreign outState owner absent");
      }`}
      function __message_bus1(${routeParameters}) external${returnDeclaration} {
        ${fixedIterationEntryPins}
        require(batchBlob.length >= 7);
        require(batchBlob.length <= ${MAX_MESSAGE_BUS_BLOB_BYTES});
        bytes __message_bus_unlock = tx.inputs[this.activeInputIndex].unlockingBytecode;
        require(__message_bus_unlock.length >= 7);
        require(__message_bus_unlock.slice(0, 5) == hex"0453434231");
        bigint __message_bus_pushOpcode = int(bytes.concat(__message_bus_unlock.slice(5, 6), hex"00"));
        if (batchBlob.length <= 75) {
          require(__message_bus_pushOpcode == batchBlob.length);
          require(__message_bus_unlock.slice(6, 6 + batchBlob.length) == batchBlob);
        } else {
          require(__message_bus_pushOpcode == 76);
          // The VM's push parser already defines batchBlob's byte count from this PUSHDATA1 length byte, and
          // minimal-data rules require this opcode for the 76..255-byte range. Do not reinterpret bytes >= 0x80
          // through Script-number casts: their sign-bit encoding is not the unsigned push length.
          require(__message_bus_unlock.slice(7, 7 + batchBlob.length) == batchBlob);
        }
        require(batchBlob.slice(0, 4) == hex"53434231");
        bigint __message_bus_version = int(bytes.concat(batchBlob.slice(4, 5), hex"00"));
        require(__message_bus_version == 1 || __message_bus_version == 2);
        require(batchBlob.slice(5, 6) == hex"${logicalValueMode ? '01' : '00'}");
        ${graphPrologue}
        bigint rowCount = int(bytes.concat(batchBlob.slice(6, 7), hex"00"));
        require(${resourceShapedHandler
    ? `rowCount == ${routeMaximumRows}`
    : `rowCount >= 1 && rowCount <= ${routeMaximumRows}`});
        ${atomicPrologue}
        bigint cursor = 7;
        ${!graphExecutionContext ? '' : 'bigint __message_bus_graph_caller_cursor = 0;'}
        ${resultDeclarations}
        ${parser}
        require(cursor == batchBlob.length);
        ${!graphExecutionContext ? ''
    : 'require(__internal__graphCompletionPositions.length == rowCount * 2);'}
        ${!graphExecutionContext
    ? ''
    : 'require(__message_bus_graph_caller_cursor == __internal__graphCallers.length);'}
        // Keep the emission witness live through compiler-owned call verification above. The generated verifier
        // consumes a copy directly, so this source-level final reference prevents last-use stack relocation.
        ${!graphExecutionContext
    ? ''
    : `${allGraphEmissionHandlersRuntime
      ? 'require(__internal__graphEmissions.length == 0);'
      : 'require(__internal__graphEmissions == __internal__graphEmissions);'}
        require(__internal__graphCallers == __internal__graphCallers);`}
        ${returnStatement}
      }
    }`;
  // X71. `source` is generated immediately above, so a parse failure here carries a Line/Column in THAT text.
  // Reported bare, it reads as a position in the user's file and is not one: it even moves by tens of lines
  // when an unrelated compile option changes the generated preamble. Say what the position is instead of
  // handing back a number the user cannot act on.
  let routeAst: Ast;
  try {
    // X92. Mark every position this parse builds as a position in generated source, so a diagnostic raised
    // LATER - during semantic analysis of the merged AST - says so too. X71's catch below covers only a
    // failure of the parse itself, which is one of the two sites this class has.
    routeAst = withGeneratedSource(
      `the message-bus route generated for '${contract.name}'`,
      () => parseCode(source, undefined, false, compilerOptions.chunkedArrays),
    );
  } catch (error) {
    throw new Error(
      `The message-bus route generated for '${contract.name}' does not parse - ${(error as Error).message}. `
      + 'That Line and Column are a position in COMPILER-GENERATED source, not in your file; they shift when '
      + 'an unrelated compile option changes the generated preamble. This is a compiler defect, and no edit to '
      + 'the contract can name that position.',
    );
  }
  const route = routeAst.contract.functions[routeAst.contract.functions.length - 1];
  route.messageBusRoute = true;
  route.graphDelegateSlotCount = eligible.reduce((maximum, handler) => {
    let count = 0;
    walkInvocationAst(handler.body, (node) => {
      if (node instanceof LowLevelCallStatementNode && node.callMode === 'delegatecall') count += 1;
    });
    return Math.max(maximum, count);
  }, 0);
  route.messageBusMaximumRows = routeMaximumRows;
  if (graphBlockhashReadWidth > 0) {
    route.messageBusBlockhashReadWidth = graphBlockhashReadWidth;
    route.blockhashSlotCount = routeMaximumRows * graphBlockhashReadWidth;
    route.messageBusBlockhashReads = Array.from({ length: routeMaximumRows }, (_unused, row) =>
      eligible.flatMap((handler) => (graphBlockhashReads.get(handler) ?? []).map((readKey, readOrdinal) => ({
        row,
        selector: selector(handler),
        readOrdinal,
        readKey,
        slotOffset: row * graphBlockhashReadWidth + readOrdinal,
      })))).flat();
  }
  route.location = contract.location;
  const helpers = routeAst.contract.functions.slice(0, -1);
  for (const helper of helpers) helper.location = contract.location;
  contract.functions.push(...helpers, route);
}

// Compile a parsed+resolved AST (whose `contract` is the chosen primary) into a single Artifact. Shared by
// compileString and compileStringMulti.
function compileResolvedAst(
  ast: Ast, code: string, mergedCompilerOptions: CompilerOptions, omitConstructor = false,
  admitExternalHandlers = true, normalizeBareEntries = true, relaxResultRouteEffects = true,
  admitMixedScalarHandlers = true, admitBareForwardingHandlers = true,
  attribution?: ExternalAdmissionAttribution,
  fnPtrArraysPreLowered = false,
  out?: { delegateFunctionsMarked: number },
): Artifact {
  // A library file compiled directly: if its primary library has explicitly public/external functions, lower
  // it to a stateless contract artifact (docs/library-contracts.md Phase 2). A library with only inline
  // (internal/unmarked) functions has no entry point and cannot be compiled standalone.
  if (ast.isLibrary) {
    if (!ast.libraryContract) {
      // A standalone interface, a file-level enum/struct, or an inline-only library has no executable contract;
      // emit a minimal ABI-only declaration artifact (like solc: ABI + empty bytecode) instead of erroring.
      // Inline-only library functions still require source-level parameter/return location validation before
      // this early declaration-artifact return.
      ast = ast.accept(new ValidateDataLocations(mergedCompilerOptions.solidityImportCompat ?? false)) as Ast;
      // Interfaces/declaration-only files still require semantic validation (X184). A generic-storage library,
      // however, has already representation-lowered its storage pointer names for later import/inlining; running
      // the ordinary contract symbol pass here mistakes those placeholders for unresolved source identifiers.
      if (!ast.libraryName || !ast.declaredLibraryNames.includes(ast.libraryName)) {
        ast = ast.accept(new SymbolTableTraversal(mergedCompilerOptions)) as Ast;
        ast = ast.accept(new TypeCheckTraversal(
          true, mergedCompilerOptions.solidityImportCompat ?? false, mergedCompilerOptions.rootFileId,
        )) as Ast;
      }
      // Emit a minimal ABI-only declaration artifact (like solc: ABI + empty bytecode) instead of erroring.
      return generateDeclarationArtifact(ast, code);
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

  if (mergedCompilerOptions.solidityImportCompat) {
    validateAbstractContractInstantiations(ast);
    validateFunctionNamespaceShadows(ast);
    validateLibrarySelfExternalCalls(ast);
    validateKnownUserTypes(ast);
    validateInheritedPrivateFunctionAccess(ast);
  }

  // Desugar `using L for T` method calls in each contract's OWN lexical scope BEFORE inheritance/modifier expansion
  // inline+substitute parent constructors/modifiers. A parent ctor's `name.toShortStringWithFallback(fb)` becomes
  // `ShortStrings.toShortStringWithFallback(name, fb)` (a real arg node) while `name` is still the parent's param, so
  // the constructor-arg substitution can then rewrite it - it cannot reach a receiver embedded in a call identifier.
  ast = ast.accept(new RedesugarImportedUsingForCalls(true)) as Ast;

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
  ast = expandInheritance(ast, mergedCompilerOptions.solidityImportCompat ?? false);

  // OpenZeppelin upgradeable bases reserve future EVM storage slots with private fixed arrays named `__gap`.
  // They carry no runtime value and are never read; materializing them in CashToken commitments can consume
  // kilobytes (e.g. uint256[50]) while providing none of their EVM layout benefit. In Solidity-compat mode,
  // preserve their intended meaning by omitting the reservation from BCH state altogether.
  if (mergedCompilerOptions.solidityImportCompat) {
    ast.contract.stateVariables = ast.contract.stateVariables.filter((variable) => variable.name !== '__gap');
  }

  // Validate source-level location and modifier rules before storage/memory pointer lowerings erase the
  // declarations that carry them. This mirrors solc's declaration type checking and keeps lowerings simpler.
  ast = ast.accept(new ValidateDataLocations(mergedCompilerOptions.solidityImportCompat ?? false)) as Ast;

  // Every mapping uses the authenticated C2 backend. There is no omission-prone legacy mapping fallback.
  for (const col of ast.contract.collections) {
    if (col.type instanceof MappingType) col.sorted = true;
  }

  // A standalone abstract contract has no deployable bytecode; emit an ABI-only declaration artifact (solc
  // parity - abstract contracts have an ABI + empty bytecode), like interface / decl-only files.
  if (ast.contract.isAbstract) {
    // Declaration artifacts still undergo source-level modifier validation. Expansion/code generation are
    // unnecessary, but an implemented modifier without `_` remains invalid Solidity.
    validateModifierDefinitions(ast);
    return generateDeclarationArtifact(ast, code);
  }

  // Materialize one syntactic edge per element of a compiler-bounded function-pointer loop before the pointer
  // table is lowered. This preserves exact invocation cardinality and lets each state-selected target/selector
  // be authenticated as an ordinary concrete graph callsite. Other loop classes retain the established pass.
  let inferredGraphEdge = false;
  walkInvocationAst(ast.contract, (node) => {
    if (node instanceof ExternalFunctionCallNode || node instanceof LowLevelCallStatementNode
      || node instanceof MethodCallNode
      || (node instanceof FunctionCallNode
        && /\.(call|staticcall|delegatecall)$/.test(node.identifier.name))) {
      inferredGraphEdge = true;
    }
  });
  const messageBusGraphMode = !!mergedCompilerOptions.messageBus
    && inferredGraphEdge;
  // Reject the low-level call shapes the callManifest row cannot bind (call options, iterated and conditional
  // callsites, more than one per handler) against the SOURCE construct, before any bus lowering unrolls a loop
  // or renames a handler. Without this the same sources reach the user as `Block slot not found: lowLevelCall[0]`
  // or as a rule naming the synthesized `__message_bus_graph_run`. Graph mode only: the direct route compiles call
  // options and iterated low-level calls today and must keep doing so.
  if (messageBusGraphMode) validateLowLevelCallShapes(ast.contract);
  const pointerTableBounds = new Map<string, PointerTableExpansion[]>();
  const rolledLoopCeilings: ProvenLoopCeilingMap = new Map<string, number[]>();
  if (messageBusGraphMode) {
    ast = ast.accept(new UnrollFixedBoundEntryLoop(true, pointerTableBounds)) as Ast;
    // A pointer-table loop whose trip count is RUNTIME-sized survives the fixed-bound pass. Admit it only when a
    // dominating source guard proves a finite ceiling, expand it to that many guarded rows, and reject every
    // other shape with one stable diagnostic. The guard stays in the emitted covenant, so a runtime table longer
    // than the published bound fails on-chain instead of executing a truncated prefix.
    ast = ast.accept(new ExpandBoundedPointerTableLoop(pointerTableBounds, rolledLoopCeilings)) as Ast;
  }

  // A foreign fn-ptr ARRAY (dispatch table) with a fixed method -> a plain `address[]` state var + the shipped
  // array-element co-spend `IFace(fns[i]).m()`. Runs FIRST so the moved array is a native `address[]` to every
  // later pass (the fn-ptr array parses as a COLLECTION; a plain address array is a dynamic-array STATE VAR).
  // X169: the split path already ran this on the COMPLETE function set (`prepareSplitAst`). Re-running it on a
  // shard's filtered set would re-decide a table this pass declined there, and the decision appends state
  // variables - see `assertSplitLayoutsAgree`.
  if (!fnPtrArraysPreLowered) {
    ast = ast.accept(new LowerForeignFunctionPointerArrayElements(messageBusGraphMode)) as Ast;
  }

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

  // Lower `transient` state vars to per-function locals after modifier expansion. A transient reference in a
  // modifier argument/body is now visible in the concrete function body, and public getters synthesized above
  // receive the same zero-initialized transaction-local binding as ordinary functions.
  ast = lowerTransientStateVars(ast);

  // A low-level call written in a MODIFIER body is invisible to the source-shape pass above, and reaches the
  // user as `Block slot not found: lowLevelCall[0]` once inlined. Re-run the same check on the expanded bodies.
  // The first pass still owns every callsite it can see, so a loop callsite keeps its loop diagnostic rather
  // than the count diagnostic the bus loop expansions would produce for it here.
  if (messageBusGraphMode) validateLowLevelCallShapes(ast.contract);

  // Message-bus synthesis sometimes runs before the main lowering pipeline so collection/effect footprints are
  // visible to its wrapper. Beta-reduce side-effect-free foreign function-pointer return/pass helpers before that
  // snapshot too; otherwise the source entry point is lowered later to an external edge while its already-cloned
  // message-bus batch wrapper still calls the pre-lowering higher-order signature (and lacks the generated edge witnesses).
  // The normal later pass remains: this early application is intentionally idempotent and covers only candidates
  // already visible after modifier expansion.
  if (mergedCompilerOptions.messageBus) {
    ast = ast.accept(new InlineForeignFunctionPointerReturns()) as Ast;
  }

  // OZ StorageSlot / ERC-7201 idiom: `XSlot storage d = StorageSlot.getXSlot(SLOT); d.value = v` (PARAM factory)
  // and `S storage $ = _getXStorage(); $.f = v` (ERC-7201 CONST factory) -> the __evm_storage register / promoted
  // packed state. Consumes the slot-pointer factory's assembly before it reaches LowerInlineAssembly. Runs AFTER
  // expandModifiers so factory uses inside OZ initializer/reinitializer modifiers (now inlined into fn bodies) are
  // rewritten too (else the factory method is dropped with a dangling call left in the modifier body).
  //
  // X115. This MUST precede the early message-bus synthesis below. A storage-slot pointer access is not a
  // Mapping* node until this pass runs, so `analyseFunctionFootprint` reported NO `collection:` resource for a
  // handler that reads or writes `__evm_storage`. The route's whole collection-eligibility branch is gated on
  // that resource, so every such handler was admitted with no key witness and no reserved entry slot, and the
  // published route could not settle a single row (owner-local: OP_EQUALVERIFY on the entry output commitment).
  // Lowering first makes the footprint honest: the same handlers are now refused BY NAME when their key is a
  // constant, and reserve a real entry slot when it is a parameter.
  ast = ast.accept(new LowerStorageSlotPointers()) as Ast;

  // A fixed-array collection iteration must expose its compiler-owned indexed accesses before deciding whether
  // the hidden route is synthesized at the early collection boundary. Otherwise an unrelated collection
  // handler can move synthesis ahead of the ordinary unroll pass and leave the iteration's stale blanket marker.
  const earlyFixedArrays = new Set(ast.contract.collections.filter((collection) =>
    collection.type instanceof ArrayType && collection.type.bound !== undefined)
    .map((collection) => collection.name));
  const hasFixedCollectionIteration = ast.contract.functions.some((fn) => {
    let found = false;
    walkInvocationAst(fn.body, (node) => {
      if (node instanceof CollectionIterationNode && earlyFixedArrays.has(node.collectionName)) found = true;
    });
    return found;
  });
  if (mergedCompilerOptions.messageBus && hasFixedCollectionIteration) {
    ast = ast.accept(new UnrollFixedBoundEntryLoop(false, undefined, true)) as Ast;
  }

  // The compiler-owned route must participate in the same helper/state
  // lowerings as source entry points. In particular, collection-bearing
  // handlers need their authenticated entry operations inlined into this
  // physical wrapper before block-layout analysis. Synthesizing it only at the
  // final semantic boundary works for scalar state but makes collection
  // effects invisible to the route.
  const messageBusFunctionsByName = new Map<string, FunctionDefinitionNode[]>();
  for (const fn of ast.contract.functions) {
    const group = messageBusFunctionsByName.get(fn.name) ?? [];
    group.push(fn);
    messageBusFunctionsByName.set(fn.name, group);
  }
  const collectionNames = new Set(ast.contract.collections.map((collection) => collection.name));
  const loweredFunctionPointerTables = new Set<string>();
  for (const collection of ast.contract.collections) {
    if (collection.type instanceof ArrayType
      && collection.type.elementType instanceof FunctionType
      && collection.type.elementType.isExternal) {
      loweredFunctionPointerTables.add(collection.name);
      loweredFunctionPointerTables.add(`__fnsel_${collection.name}`);
    }
  }
  for (const name of collectionNames) {
    if (collectionNames.has(`__fnsel_${name}`)) {
      loweredFunctionPointerTables.add(name);
      loweredFunctionPointerTables.add(`__fnsel_${name}`);
    }
  }
  for (const fn of ast.contract.functions) {
    const footprint = analyseFunctionFootprint(fn, messageBusFunctionsByName);
    for (const resource of [...footprint.reads, ...footprint.writes]) {
      if (!resource.startsWith('collection:__fnsel_')) continue;
      const selectorName = resource.slice('collection:'.length).split(':', 1)[0];
      loweredFunctionPointerTables.add(selectorName);
      loweredFunctionPointerTables.add(selectorName.slice('__fnsel_'.length));
    }
  }
  const synthesizeBatchBeforeLowering = !!mergedCompilerOptions.messageBus
    && supportsAtomicMessageBus(ast, mergedCompilerOptions)
    && ast.contract.functions.some((fn) => {
      const footprint = analyseFunctionFootprint(fn, messageBusFunctionsByName);
      return [...footprint.reads, ...footprint.writes]
        .some((resource) => {
          if (!resource.startsWith('collection:')) return false;
          const name = resource.slice('collection:'.length).split(':', 1)[0];
          return !loweredFunctionPointerTables.has(name);
        })
        // External edges are represented by graph handlers and must be cloned after higher-order/loop
        // lowering. Unlike transfers/events/deploys, the edge itself adds no owner-local block slot that
        // the early wrapper must expose.
        || footprint.effects.some((effect) => effect !== 'external-call')
        || fn.returnTypes.length > 0;
    });
  if (synthesizeBatchBeforeLowering) {
    synthesizeMessageBusRoute(
      ast, mergedCompilerOptions, admitExternalHandlers, normalizeBareEntries, relaxResultRouteEffects,
      admitMixedScalarHandlers, admitBareForwardingHandlers, attribution,
    );
  }

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

  // Preserve straight-line foreign function-pointer ternaries before control-flow normalization splits
  // their initialized declaration into a declaration plus branch assignments. The later invocation remains
  // for aliases introduced by the intervening contract-member/function-pointer passes.
  ast = ast.accept(new DesugarExternalFunctionPointers()) as Ast;

  // Desugar `return` inside a loop -> flag + break + post-loop return (before break/continue expansion so the
  // injected breaks are lowered; internal functions can't raw-return from inside a loop's balanced stack).
  ast = ast.accept(new LowerTailRecursion()) as Ast;
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

  // Solidity permits a nested block local to shadow an outer local/parameter. Target stack slots are named, so
  // alpha-rename the inner binding (and its lexical uses) before later lowerings and symbol analysis.
  ast = ast.accept(new AlphaRenameLocalShadows()) as Ast;

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

  // Nested local-array element write `b[i][j] = v` -> read-modify-write over single-level ops (before semantic).
  ast = ast.accept(new DesugarNestedArrayWrite()) as Ast;

  // Value-copy the local `bytes` element writes (`b[i] = v`) LowerMemoryModel did not convert to a pointer byte-
  // splice, including bytes-field temps introduced by DesugarNestedArrayWrite.
  ast = ast.accept(new DesugarLocalBytesElementWrite()) as Ast;

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
  ast = ast.accept(new LowerReceivedFnPtrArray(messageBusGraphMode)) as Ast;
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
  // A high-level `this.f(args)` also creates fresh calldata. Reconstruct msg.data from f's selector + live
  // parameters so the direct OP_INVOKE lowering does not depend on OP_ACTIVEBYTECODE inside the subroutine.
  ast = ast.accept(new LowerSelfCallMsgData()) as Ast;
  // Internal/private msg.data readers receive the originating entry calldata through a compiler-only parameter.
  ast = ast.accept(new LowerInternalMsgDataContext()) as Ast;
  // msg.sig retains the originating public/external selector across internal/private OP_INVOKE calls.
  ast = ast.accept(new LowerInternalMsgSigContext()) as Ast;

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
  ast = ast.accept(new InlineReturningStateHelpers(
    mergedCompilerOptions.solidityImportCompat ?? false,
  )) as Ast;

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
  // A guarded pointer-table row hoists its element + runtime-selector locals inside the branch; move only their
  // DECLARATIONS to the body top so the epilogue can read them while the reads stay conditional.
  if (messageBusGraphMode) ast = ast.accept(new HoistPointerTableBranchLocals()) as Ast;
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
  const blockOracle = new SynthesizeBlockOracle(mergedCompilerOptions.solidityImportCompat ?? false);
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

  // Delegate-variant compile: mark the proxy-implementable functions now that the function set is final (after
  // inheritance/modifier/getter expansion) and before SymbolTableTraversal injects _proxyMasterIndex. `delegate`
  // is never written in source; see AutoMarkDelegateFunctions.
  if (mergedCompilerOptions.autoDelegate && out) {
    out.delegateFunctionsMarked = autoMarkDelegateFunctions(ast, mergedCompilerOptions.forceStateful ?? false);
  }

  if (!synthesizeBatchBeforeLowering && supportsAtomicMessageBus(ast, mergedCompilerOptions)) {
    synthesizeMessageBusRoute(
      ast, mergedCompilerOptions, admitExternalHandlers, normalizeBareEntries, relaxResultRouteEffects,
      admitMixedScalarHandlers, admitBareForwardingHandlers, attribution,
    );
  }

  // Semantic analysis
  ast = ast.accept(new SymbolTableTraversal(mergedCompilerOptions)) as Ast;
  // Bare msg.sender collection accesses are normalized to compiler-owned route parameters before semantic
  // analysis. Preserve their origin in the published entry metadata: treating that synthetic parameter as a
  // source ABI argument leaves the SDK trying to read an argument the user-visible handler does not have.
  for (const fn of ast.contract.functions) {
    if (!fn.messageBusRoute || !fn.entryAccesses) continue;
    for (const entry of fn.entryAccesses) {
      entry.keySources = entry.keySources.map((source, index) => (
        source.kind === 'param' && /_sender(?:_|$)/.test(entry.keyParams[index] ?? '')
          ? { kind: 'msgSender', senderOp: 'msg.sender', canonical: 'nullop:msg.sender' }
          : source
      ));
    }
  }
  // Graph-emission handlers execute as OP_DEFINE subroutines inside the hidden route's physical participant
  // block. Their external edges are callManifest rows, not additional co-spent slots, so their independently
  // inferred function layout is intentionally absent. Dynamic state reads/writes in those handlers must still
  // address the owner's data NFTs and trailing chunks relative to the hidden route's block. Share that physical
  // layout explicitly; otherwise the code generator falls back to activeInput+1 and aliases the first fixed or
  // funding slot rather than the route's canonical trailing region.
  const messageBusRoute = ast.contract.functions.find((fn) => fn.messageBusRoute);
  const ecrecoverHandlers = ast.contract.functions.filter((fn) => !fn.messageBusRoute
    && fn.messageBusEligible && fn.ecrecoverCompute && (fn.ecrecoverCallCount ?? 0) > 0);
  if (messageBusRoute?.blockLayout && ecrecoverHandlers.length > 0) {
    const maximumCalls = Math.max(...ecrecoverHandlers.map((fn) => fn.ecrecoverCallCount!));
    const occupied = messageBusRoute.blockLayout.slots.filter((slot) => slot.kind !== 'master');
    if (occupied.length > 0) {
      throw new Error('message-bus batch ecrecover handlers cannot currently share their participant block with other slots');
    }
    messageBusRoute.messageBusMaximumRows = 1;
    messageBusRoute.ecrecoverCompute = true;
    messageBusRoute.blockLayout = {
      ...messageBusRoute.blockLayout,
      slots: [
        ...messageBusRoute.blockLayout.slots,
        ...Array.from({ length: maximumCalls * 2 }, (_, index) => ({
          kind: 'ecrecoverSideCar' as const, offset: index + 1, slotIndex: index,
        })),
      ],
      blockSize: 1 + maximumCalls * 2,
    };
  }
  if (messageBusRoute?.blockLayout) {
    for (const fn of ast.contract.functions) {
      if (fn.graphEmissionHandler || fn.name.startsWith('__message_bus_array_')) {
        fn.blockLayout = messageBusRoute.blockLayout;
      }
    }
  }
  // The bounded resource route canonicalizes a row-local mapping identity to the first equal earlier identity.
  // Record the corresponding physical-slot alternatives after entry slots have been assigned, but before
  // covenant generation. The code generator uses this to skip the duplicate slot completely; the SDK funds it
  // rather than attempting to co-spend one entry NFT twice.
  for (const fn of ast.contract.functions) {
    if (!fn.messageBusRoute || !fn.entryAccesses) continue;
    for (const entry of fn.entryAccesses) {
      if (!entry.keyParams.some((key) => /_r\d+$/.test(key))) continue;
      entry.runtimeAliasPriorSlots = fn.entryAccesses
        .filter((prior) => prior.slotIndex < entry.slotIndex
          && prior.collection === entry.collection
          && prior.keyParams.length === entry.keyParams.length)
        .map((prior) => prior.slotIndex);
    }
  }
  ast = ast.accept(new TypeCheckTraversal(
    true, mergedCompilerOptions.solidityImportCompat ?? false, mergedCompilerOptions.rootFileId,
  )) as Ast;
  ast = ast.accept(new EnsureFinalRequireTraversal(mergedCompilerOptions.enforceFinalRequire)) as Ast;

  // Inject synthetic tx.locktime guard where tx.locktime is used without a protocol-enforcing time check
  if (mergedCompilerOptions.enforceLocktimeGuard) {
    ast = ast.accept(new InjectLocktimeGuardTraversal()) as Ast;
  }

  // Early return transformation (rewrites return statements into nested if-else)
  ast = ast.accept(new EarlyReturnTransformation()) as Ast;

  // Compile referenced contracts in dependency order
  const compiledBytecodes = compileReferencedContracts(ast, mergedCompilerOptions);

  refuseEmittingReturningStateHelpers(ast.contract);

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
  // X149. `artifact.bytecode` IS NOT BYTES. `generateArtifact` publishes it as `scriptToAsm(script)` - the
  // human-readable listing, in which one 1-byte opcode occupies `OP_CHECKSIGVERIFY ` - so `.length / 2` is
  // half a character count and OVERSTATES the script on every contract: 1,332 against a real 283 on a small
  // stateful contract (4.7x), 32,432 against a real 30,981 on MarketplaceV1.
  //
  // X136 read that overstatement as a SILENT BAND ("`debug.bytecode` is the shorter of the two on every row")
  // and took `Math.max` of the two to close it. There is no band: `debug.bytecode` is
  // `binToHex(scriptToBytecode(optimisationResult.script))` of the SAME script the ASM lists, so it is the
  // exact byte count, and the max was measuring the ASM listing on every contract that reached this line. It
  // is the same script - measured twice, once correctly.
  const artifactBytes = scriptToBytecode(optimisationResult.script).length;
  if (artifactBytes > MAX_INPUT_BYTESIZE) {
    const message = `Contract '${artifact.contractName}' is ${artifactBytes} bytes, exceeding the BCH `
      + `${MAX_INPUT_BYTESIZE}-byte input-script limit by ${artifactBytes - MAX_INPUT_BYTESIZE}. `
      + 'Every spend of it is invalid at consensus; it cannot be deployed without splitting '
      + '(compileFileSplit / compileStringSplit) or reduction.';
    // X149. APPEND. This used to assign, and it is the only site on this path that does not - so any diagnostic
    // recorded before it would be dropped by the contract that most needs its other diagnostics kept.
    artifact.diagnostics = [
      ...(artifact.diagnostics ?? []),
      { severity: 'error', code: 'contract-size-limit', message },
    ];
    // X149. SAY IT OUT LOUD, from the compiler rather than from one caller of it. The diagnostic is severity
    // `error` and no consumer reads the field: not the SDK, not the benches, not the corpus probe. `solidc-cli`
    // prints its own warning, so a contract compiled through the CLI was told and a contract compiled through
    // `compileFile`/`compileString` - which is every bench, every test and every SDK user - was not. Measured
    // on this corpus: MarketplaceV1 is 20,981 bytes over in ORDINARY DIRECT MODE and compiled silently.
    // This is not the refusal; a refusal belongs at the spend boundary, where a script length is fatal rather
    // than merely measurable. It is the compiler no longer being the quietest thing in the chain.
    console.warn(`Error: ${message}`);
  }
  const messageBusRouteAbi = artifact.abi.find((fn) => fn.name === '__message_bus1');
  if (messageBusRouteAbi) artifact.abi = artifact.abi.filter((fn) => fn !== messageBusRouteAbi);
  // Message-bus graph expansion reads the source shape of a bounded pointer table: one dispatch site whose
  // reached-row count is runtime with an explicit compiler-proven ceiling. Publish that shape only for a
  // graph-route compilation, so ordinary direct dispatch keeps one ABI row per physical callsite.
  if (messageBusGraphMode && pointerTableBounds.size > 0) {
    artifact.abi = artifact.abi.map((fn) => {
      if (!fn.externalCalls?.length) return fn;
      const coalesced = coalesceExpandedPointerTable(fn.name, fn.externalCalls, pointerTableBounds);
      return coalesced === fn.externalCalls ? fn : { ...fn, externalCalls: coalesced };
    });
  }
  // A loop that keeps its rolled form publishes no ceiling of its own; attach the one the source guard proves.
  if (messageBusGraphMode && rolledLoopCeilings.size > 0) {
    artifact.abi = artifact.abi.map((fn) => {
      if (!fn.externalCalls?.length) return fn;
      const bounded = applyRolledLoopCeilings(fn.name, fn.externalCalls, rolledLoopCeilings);
      return bounded === fn.externalCalls ? fn : { ...fn, externalCalls: bounded };
    });
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
  if (mergedCompilerOptions.messageBus
    && ast.contract.functions.some((fn) => fn.messageBusRoute)) {
    const messageBusMaximumRows = ast.contract.functions.find((fn) =>
      fn.messageBusRoute)?.messageBusMaximumRows ?? MAX_MESSAGE_BUS_ROWS;
    const verifierFunction = ast.contract.functions.find((fn) => fn.name === '__message_bus_verify_atomic');
    const functionNameById = new Map(ast.contract.functions
      .filter((fn) => fn.functionId !== undefined).map((fn) => [fn.functionId!, fn.name]));
    // Compiler compact helpers occupy the reserved >= 0x80 range and are selected dynamically from IDs kept
    // in the verifier frame, so they cannot be recovered by scanning only literal OP_INVOKE predecessors.
    // User/handler functions occupy the lower range; include the verifier plus the compact-helper namespace.
    const verifierBytecodes = new Map([
      ...traversal.invokedFunctionBytecodes,
      ...traversal.outlinedSubroutineBytecodes,
    ]);
    const collectDefinitions = (script: ReturnType<typeof bytecodeToScript>): void => {
      for (let i = 2; i < script.length; i++) {
        if (script[i] !== Op.OP_DEFINE) continue;
        const body = script[i - 2];
        const encodedId = script[i - 1];
        if (!(body instanceof Uint8Array)) continue;
        let id: number | undefined;
        if (encodedId instanceof Uint8Array) {
          try {
            const decoded = decodeInt(encodedId);
            if (decoded >= BigInt(Number.MIN_SAFE_INTEGER)
              && decoded <= BigInt(Number.MAX_SAFE_INTEGER)) id = Number(decoded);
          } catch {
            // OP_DEFINE can occur as ordinary executable data; only minimally encoded numeric predecessors
            // identify compiler-emitted function definitions.
          }
        } else if (encodedId === Op.OP_0) id = 0;
        else if (encodedId >= Op.OP_1 && encodedId <= Op.OP_16) id = encodedId - Op.OP_1 + 1;
        if (id !== undefined) verifierBytecodes.set(id, body);
      }
    };
    collectDefinitions(optimisationResult.script);
    const messageBusEntryBody = traversal.entryPointBytecodes.get(MESSAGE_BUS_SELECTOR_HEX);
    if (messageBusEntryBody) collectDefinitions(bytecodeToScript(messageBusEntryBody));
    const decodeFunctionId = (encoded: ReturnType<typeof bytecodeToScript>[number]): number | undefined => {
      if (encoded instanceof Uint8Array) {
        try {
          const decoded = decodeInt(encoded);
          if (decoded >= BigInt(Number.MIN_SAFE_INTEGER) && decoded <= BigInt(Number.MAX_SAFE_INTEGER)) {
            return Number(decoded);
          }
        } catch { return undefined; }
      } else if (encoded === Op.OP_0) return 0;
      else if (encoded >= Op.OP_1 && encoded <= Op.OP_16) return encoded - Op.OP_1 + 1;
      return undefined;
    };
    // `outlinedSubroutineBytecodes` contains every shared outline in the whole contract. Most are unrelated to the
    // atomic verifier; embedding all of them can make the verifier covenant exceed BCH's 10KB script limit. Begin
    // with the verifier and the dynamically selected compact-helper namespace, then add only statically invoked
    // outlines, transitively. OP_INVOKE hard-fails on an omitted definition, so this is an exact fail-closed closure.
    const requiredVerifierIds = new Set([...traversal.invokedFunctionBytecodes.keys()]
      .filter((id) => id <= -12 || id === verifierFunction?.functionId));
    if (verifierFunction?.functionId !== undefined) requiredVerifierIds.add(verifierFunction.functionId);
    const pendingVerifierIds = [...requiredVerifierIds];
    while (pendingVerifierIds.length > 0) {
      const id = pendingVerifierIds.pop()!;
      const bytecode = verifierBytecodes.get(id);
      if (!bytecode) continue;
      const script = bytecodeToScript(bytecode);
      for (let i = 1; i < script.length; i++) {
        if (script[i] !== Op.OP_INVOKE) continue;
        const invokedId = decodeFunctionId(script[i - 1]);
        if (invokedId === undefined || requiredVerifierIds.has(invokedId) || !verifierBytecodes.has(invokedId)) continue;
        requiredVerifierIds.add(invokedId);
        pendingVerifierIds.push(invokedId);
      }
    }
    const verifierFunctionIds = [...requiredVerifierIds].sort((a, b) => a - b);
    const verifierFunctions = verifierFunctionIds.map((id) => ({
      id,
      name: functionNameById.get(id) ?? `__internal_${id}`,
      bytecode: binToHex(verifierBytecodes.get(id)!),
    }));
    artifact.messageBus = {
      version: 1,
      selector: MESSAGE_BUS_SELECTOR_HEX,
      ...(messageBusMaximumRows === RESOURCE_SHAPED_BATCH_ROWS
        && { minimumRows: RESOURCE_SHAPED_BATCH_ROWS }),
      maximumRows: messageBusMaximumRows,
      maximumBlobBytes: MAX_MESSAGE_BUS_BLOB_BYTES,
      atomicMessageBus: {
        domain: ATOMIC_MESSAGE_BUS_DOMAIN_HEX,
        messageEnvelope: {
          region: 'participant-verifiers',
          canonicalInput: 'final-participant-verifier',
          unlockingPush: 0,
        },
        maximumParticipants: ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS,
        maximumRows: ATOMIC_MESSAGE_BUS_MAX_ROWS,
      },
      ...(verifierFunction?.functionId !== undefined
        && traversal.invokedFunctionBytecodes.has(verifierFunction.functionId) && {
        verifierProgram: {
          verifyFunctionId: verifierFunction.functionId,
          inputCount: verifierFunction.parameters.length,
          inputs: verifierFunction.parameters.map((parameter) => ({
            name: parameter.name,
            type: parameter.type.toString().replace(/address payable/g, 'address'),
          })),
          functions: verifierFunctions,
        },
      }),
      route: messageBusRouteAbi!,
      handlers: ast.contract.functions.filter((fn) => !fn.messageBusRoute && fn.isEntryPoint).map((fn) => ({
        name: fn.name,
        selector: fn.functionSelector ? binToHex(fn.functionSelector) : '',
        inputs: fn.parameters.filter((parameter) => !parameter.name.startsWith('__internal__')).map((parameter) => ({
          name: parameter.name,
          type: parameter.type.toString().replace(/address payable/g, 'address'),
        })),
        ...(fn.parameters.some((parameter) =>
          ['sig', 'sig[]'].includes(parameter.type.toString()))
          && fn.functionId !== undefined && fn.functionSelector !== undefined
          && traversal.invokedFunctionBytecodes.has(fn.functionId)
          && artifact.functionBodies?.[binToHex(fn.functionSelector)] !== undefined && {
          // CHECKSIG/CHECKMULTISIG execute inside this OP_INVOKE body, not the
          // outer selector wrapper.
          signatureBytecode: binToHex(traversal.invokedFunctionBytecodes.get(fn.functionId)!),
        }),
        ...(fn.returnTypes.length > 0 && {
          outputs: fn.returnTypes.map((type) => ({
            type: type.toString().replace(/address payable/g, 'address'),
          })),
        }),
        ...(fn.usesMsgValue && { usesMsgValue: true }),
        ...(() => {
          const sourceAbi = artifact.abi.find((candidate) =>
            candidate.selector === (fn.functionSelector ? binToHex(fn.functionSelector) : undefined));
          return {
            ...(sourceAbi?.emits?.length ? { emits: sourceAbi.emits } : {}),
            ...(sourceAbi?.transfers?.length ? { transfers: sourceAbi.transfers } : {}),
            ...(sourceAbi?.tokenContainerAccesses?.length
              ? { tokenContainerAccesses: sourceAbi.tokenContainerAccesses } : {}),
            ...(sourceAbi?.ecrecoverArgParams?.length
              ? { ecrecoverArgParams: sourceAbi.ecrecoverArgParams } : {}),
          };
        })(),
        eligible: fn.messageBusEligible === true,
        // X72. A published refusal must carry a reason. Route synthesis names one for every entry point that
        // exists when it runs, but it can run BEFORE a later pass appends one (SynthesizeBlockOracle's
        // `__updateBlockOracle`), and those reached the artifact as `eligible: false` with the key absent.
        // Resolve the same way the ABSENCE channel already does (`messageBusAbsenceMessage`'s `reasonOf`).
        ...(fn.messageBusEligible !== true && {
          ...(() => {
            const reason = fn.messageBusRejectionReason ?? 'not-examined-by-route-synthesis';
            const handlerId = artifact.invocationAnalysis?.functions.find((candidate) =>
              candidate.name === fn.name
              && candidate.selector === (fn.functionSelector ? binToHex(fn.functionSelector) : undefined))?.id;
            const summary = handlerId === undefined ? undefined
              : artifact.invocationAnalysis?.functions.find((candidate) => candidate.id === handlerId);
            const rejectionCode = classifyMessageBusRejection(reason);
            const analysisFunctions = artifact.invocationAnalysis?.functions ?? [];
            const target = (candidate: typeof analysisFunctions[number]): boolean => {
              if (rejectionCode === 'MESSAGE_BUS_EFFECT_UNSUMMARIZABLE') {
                return candidate.effects.length > 0 || candidate.unknown;
              }
              if (rejectionCode === 'MESSAGE_BUS_EXTERNAL_RECURSION_UNBOUNDED') return candidate.recursive;
              if (rejectionCode === 'MESSAGE_BUS_FOREIGN_INTERMEDIATE_STATE_READ') {
                return (candidate.externalOutStateReads?.length ?? 0) > 0;
              }
              if (rejectionCode === 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT') return candidate.unknown;
              return candidate.id === handlerId;
            };
            let callChain: string[] | undefined;
            if (summary) {
              const queue: number[][] = [[summary.id]];
              const seen = new Set<number>();
              while (queue.length > 0 && !callChain) {
                const path = queue.shift()!;
                const tail = analysisFunctions.find((candidate) => candidate.id === path[path.length - 1]);
                if (!tail || seen.has(tail.id)) continue;
                seen.add(tail.id);
                if (target(tail)) {
                  callChain = path.map((id) => analysisFunctions.find((candidate) => candidate.id === id)!.name);
                } else {
                  tail.calls.forEach((id) => queue.push([...path, id]));
                }
              }
              callChain ??= [summary.name];
            }
            return {
              rejectionReason: reason,
              rejectionCode,
              rejectionContext: {
                ...(handlerId !== undefined && { handlerId }),
                functionName: fn.name,
                reason,
                sourceLocation: {
                  line: fn.location.start.line,
                  column: fn.location.start.column,
                },
                ...(callChain?.length && { callChain }),
              },
            };
          })(),
        }),
        ...(fn.messageBusKeyWitnesses && { batchKeyWitnesses: fn.messageBusKeyWitnesses }),
      })),
    };
  } else if (mergedCompilerOptions.messageBus) {
    // X15. Route synthesis names a rejection reason for every entry point, but the ONLY channel that publishes
    // those names is `messageBus.handlers` - which is not built when no entry point survives. A contract whose
    // every handler is rejected therefore reached the user as an artifact with no `messageBus` and no
    // diagnostic at all. Publish the same names here so the absence is always stated, never merely observed.
    artifact.diagnostics = [...(artifact.diagnostics ?? []), {
      severity: 'error',
      code: 'message-bus-route-not-synthesized',
      message: messageBusAbsenceMessage(artifact.contractName, ast.contract.functions),
    }];
  }
  // Marker for the off-chain keeper: this contract reads blockhash(n) -> maintain the (n->hash) oracle.
  if (blockOracle.usesBlockhash) artifact.usesBlockhash = true;
  return artifact;
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
export function compileStringMulti(code: string, compilerOptions: CompileOptions = {}): ArtifactMap {
  const { errorListener, ...artifactCompilerOptions } = compilerOptions;
  const mergedCompilerOptions = normalizeCompilerOptions(artifactCompilerOptions);
  mergedCompilerOptions.__messageBusExplicitlyDisabled = artifactCompilerOptions.messageBus === false;

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
    // Before Solidity 0.7, an `internal` constructor was the way to mark a contract abstract. The parser
    // deliberately accepts that legacy spelling without rewriting `isAbstract` (single-contract compilation
    // still needs the declaration for inheritance), but solc's multi-artifact output must not expose it as a
    // deployable contract. In particular, compiling such a constructor as an entry point gives inherited
    // constructor effects (events/state writes) no transaction block layout.
    if (contract.isAbstract
      || contract.constructorDef?.modifiers.includes(FunctionModifier.INTERNAL)) continue;
    // Re-parse + resolve fresh per contract (the per-contract pipeline mutates the AST); select it as primary.
    const artifact = compileWithExternalAdmissionFallback(
      code, mergedCompilerOptions, errorListener, contract.name,
    );
    attachDelegateVariant(artifact, code, mergedCompilerOptions, errorListener, contract.name);
    map[contract.name] = artifact;
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
  const merged = normalizeCompilerOptions(artifactOptions);
  merged.__messageBusExplicitlyDisabled = artifactOptions.messageBus === false;
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

  // Keep read-only selectors on the root for ordinary/forced splits. If the unsplit contract itself exceeds BCH
  // consensus capacity, they must become delegate-return facets too; otherwise an oversized query surface can
  // leave the forwarding root undeployable (BoringHelperV1).
  const moveReadOnlyEntries = byteSize(baseline) > maxShardBytes;
  const plans = (baseline.stateLayout
    ? functions.filter((fn) => isMovableSplitEntry(fn, moveReadOnlyEntries)) : []).map((fn) => ({
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
  const measuredArtifacts = new Map<string, Artifact>();
  const groupKey = (group: PlannedFunction[]): string => group.map((plan) => plan.name).sort().join(',');
  const measure = (group: PlannedFunction[]): number => {
    const key = groupKey(group);
    const cached = measuredBytes.get(key);
    if (cached !== undefined) return cached;
    const artifact = compileFacet(code, merged, errorListener, group, 'ProbeFacet');
    const bytes = byteSize(artifact);
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
  for (const group of [...groups].sort((a, b) => groupKey(a).localeCompare(groupKey(b)))) {
    if (group.length !== 1) continue;
    const measured = measure(group);
    if (measured <= maxShardBytes) continue;
    const handlers = group.map((plan) => plan.name);
    const callChain = group.flatMap((plan) => [
      plan.name, ...[...plan.closure].filter((fn) => fn !== plan.name),
    ]);
    throw new SolidcDiagnosticError(
      'SPLIT_CLOSURE_CAPACITY',
      `Cannot split '${logicalName}': indivisible closure '${handlers.join(', ')}' is ${measured} bytes `
        + `(limit ${maxShardBytes}).`,
      { contractName: logicalName, facet: 'singleton', handlers, callChain, measured, limit: maxShardBytes },
    );
  }
  // Pairwise best-fit is quadratic in physical compilations. Above this frontier, keep the already-valid hard
  // closure groups rather than spending minutes proving that optional combinations do not fit (UniswapV2Pair
  // has nine groups and 36 pairs, with two verifier passes per probe). This can produce more facets, never a
  // larger or semantically weaker one; every selected group is still measured against the consensus limit.
  const exhaustivePacking = groups.length <= 8;
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

  const facets: ArtifactMap = {};
  const facetRecords: Array<{ name: string; link: string; plans: PlannedFunction[]; artifact: Artifact }> = [];
  groups.sort((a, b) => a.map((p) => p.name).join(',').localeCompare(b.map((p) => p.name).join(',')));
  groups.forEach((group, index) => {
    const name = `${logicalName}__Facet${index}`;
    const measured = measuredArtifacts.get(groupKey(group));
    const artifact = measured ? cloneArtifact(measured) : compileFacet(code, merged, errorListener, group, name);
    // The synthetic facet name is metadata only (the branded bytecode and constructor shape are identical), so a
    // measured ProbeFacet can be reused instead of recompiling the exact same AST solely to change this label.
    artifact.contractName = name;
    if (byteSize(artifact) > maxShardBytes) {
      const measuredBytes = byteSize(artifact);
      const handlers = group.map((plan) => plan.name);
      const callChain = group.flatMap((plan) => [plan.name, ...[...plan.closure].filter((fn) => fn !== plan.name)]);
      throw new SolidcDiagnosticError(
        'SPLIT_CLOSURE_CAPACITY',
        `Cannot split '${logicalName}': facet '${name}' is ${measuredBytes} bytes `
          + `(limit ${maxShardBytes}); closure: ${handlers.join(', ')}.`,
        { contractName: logicalName, facet: name, handlers, callChain, measured: measuredBytes, limit: maxShardBytes },
      );
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
  // `rootAst` is also the already-flattened logical contract. Its second compiler pass must not interpret
  // source-only override base lists against the now-empty concrete-base list.
  rootAst.contract.implements = [];
  rootAst.contract.parentInvocations = [];
  for (const fn of rootAst.contract.functions) {
    fn.overrideBases = [];
    fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.OVERRIDE);
  }
  // A split root's mutating entries are delegate forwarders. Message-bus admission already refuses delegate
  // handlers (`atomic-delegate-context-unpreservable`), leaving only incidental root-owned getters on the hidden
  // route; on UniswapV2Pair that unusable getter-only route inflated the otherwise valid forwarding root to
  // 13,658 bytes. Keep every ordinary ABI selector and one-hop forwarder, but omit the root's incoming batch route.
  // Facet bodies retain their normal external-call/message-bus lowering; this changes only the synthetic root.
  const rootOptions = { ...merged, messageBus: false };
  const root = compileResolvedAst(
    rootAst, code, rootOptions, false, true, true, true, true, true, undefined,
    splitPreLowersFnPtrArrays(rootOptions),
  );
  if (byteSize(root) > maxShardBytes) {
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
 * X149. The SPLIT PLANNER'S RULER, in bytes. `artifact.bytecode` is `scriptToAsm(script)` - a listing, not a
 * script - so `.length / 2` was half a character count and every packing decision here was taken against an
 * OVERSTATED length: measured 32,432 against a real 30,981 on MarketplaceV1, and 1,332 against 283 on a small
 * stateful contract. The direction is the one that hurts: a union whose real bytes fit was refused, `maxShardBytes`
 * bit early, and `estimatedRedeemBytes` was published to the deployer wrong. Nothing about the packing algorithm
 * changes; it is now measuring what it always meant to.
 */
function byteSize(artifact: Artifact): number { return asmToBytecode(artifact.bytecode).length; }

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

/**
 * Message-bus GRAPH mode unrolls pointer-table loops (`UnrollFixedBoundEntryLoop`,
 * `ExpandBoundedPointerTableLoop`) BEFORE the fn-ptr array pass, and `prepareSplitAst` does not run those. Its
 * `loopDepth` decides broadcast-vs-single-element, so hoisting the pass ahead of them would lower different
 * callsites. Graph mode therefore keeps the post-filter route and leans on `assertSplitLayoutsAgree`, which
 * refuses the divergent bundle rather than emitting it.
 */
function splitPreLowersFnPtrArrays(_options: CompilerOptions): boolean {
  return true;
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
  // X169. The THIRD shard-dependent state-appending pass, and the one X162 recorded rather than built. Its
  // classification is usage-driven - a table whose writes name two methods is VARYING and gets a parallel
  // `bytes[] __fnsel_<name>` state variable, one whose surviving writes name one method is FIXED and gets none -
  // so running it per-shard gave a facet a DIFFERENT PHYSICAL SLOT MEANING than the root's: measured on a
  // two-table contract, root slot 0.2 is `__fnsel_p` where the facet holding only the fixed-classified writes
  // puts `q`. A delegate facet writes the root's state through physical slots, so that is the X162 wrong-variable
  // write with a different author. Running it here, on the complete function set, makes the decision one decision.
  // Position matches the ordinary pipeline's (after inheritance, BEFORE modifier expansion), so the root also
  // agrees with the unsplit baseline, which classifies from the same pre-expansion bodies.
  if (splitPreLowersFnPtrArrays(options)) {
    ast = ast.accept(new LowerForeignFunctionPointerArrayElements(false)) as Ast;
  }
  ast = expandModifiers(ast);
  // X162. Both remaining state-appending passes are SHARD-DEPENDENT and must therefore run here, on the
  // complete function set, before `compileFacet` filters it. `LowerStorageSlotPointers` appends one hidden
  // state variable per ERC-7201 namespace in the order the SURVIVING functions first reach it, so running it
  // per-shard gave the root, its facets and the manifest three different physical layouts of the same state.
  // The relative order with the block oracle matches the ordinary pipeline (slot pointers first), so the root
  // also agrees with the unsplit baseline. Both passes are idempotent once their source metadata is consumed,
  // so the ordinary pipeline's later invocations are no-ops on this AST.
  ast = ast.accept(new LowerStorageSlotPointers()) as Ast;
  // Sharding must happen after storage-shaping synthesis. Otherwise a block.* read moved into a facet injects
  // oracle registers only there, changing delegate offsets and leaving the root unable to materialize that state.
  ast = ast.accept(new SynthesizeBlockOracle()) as Ast;
  return ast;
}

function compileFacet(code: string, options: CompilerOptions, listener: SolidCashErrorListener | undefined,
  plans: PlannedFunction[], facetName: string): Artifact {
  let ast = prepareSplitAst(code, options, listener);
  const keep = new Set(plans.flatMap((p) => [...p.closure]));
  const contract = ast.contract;
  // Derive getter declarations on a clone so the getter pass cannot rewrite the retained handler bodies before
  // the ordinary facet pipeline. These declarations exist only for self-typed external-call resolution.
  const getterProbe = cloneNode(contract);
  const sourceFunctionCount = getterProbe.functions.length;
  const getterProbeAst = new SourceFileNode(getterProbe);
  getterProbeAst.importedContracts = ast.importedContracts;
  getterProbeAst.interfaceDefinitions = ast.interfaceDefinitions;
  getterProbeAst.accept(new SynthesizePublicGetters(options.solidityImportCompat ?? false));
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
  contract.functions = contract.functions.filter((fn) => keep.has(fn.name));
  // Public getters are synthesized later than split planning. Without suppressing them here, every facet silently
  // regains every public state/collection/constant getter after its function set was filtered. Besides publishing
  // unrelated selectors on every shard, those getters make each facet synthesize the full incoming message-bus
  // route (UniswapV2Pair's one-entry `approve` facet measured 13,066 bytes for this reason). The logical root keeps
  // all getters and their ABI routes; a facet contains only the entries assigned to it and their call closure.
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
  const planned = new Set(plans.map((p) => p.name));
  for (const fn of contract.functions) if (planned.has(fn.name)) {
    fn.modifiers = fn.modifiers.filter((m) => ![
      FunctionModifier.INTERNAL, FunctionModifier.PRIVATE, FunctionModifier.EXTERNAL, FunctionModifier.PUBLIC,
      FunctionModifier.PURE, FunctionModifier.VIEW, FunctionModifier.DELEGATE,
    ].includes(m));
    fn.modifiers.push(FunctionModifier.PUBLIC, FunctionModifier.DELEGATE);
  } else if (fn.isEntryPoint) {
    // Any entry that is only KEPT here - including a root-owned view such as UniswapV2Pair.getReserves - is
    // reachable in this facet solely through an internal call from one of `plans`. Emitting its entry-point arm
    // as well would charge this facet for selector dispatch, ABI decoding, and (for an otherwise delegate-only
    // facet) an entire incoming message-bus route it can never enter. Demote it to a plain internal helper; the
    // body, and every modifier already expanded into it, is untouched. The logical root retains its real selector.
    fn.modifiers = fn.modifiers.filter((m) => ![
      FunctionModifier.EXTERNAL, FunctionModifier.PUBLIC, FunctionModifier.DELEGATE,
    ].includes(m));
    fn.modifiers.push(FunctionModifier.INTERNAL);
  }
  if (contract.functions.filter((fn) => fn.isEntryPoint).length < 2) {
    const truth = new BoolLiteralNode(true); truth.location = contract.location;
    const noopGuard = new RequireNode(truth); noopGuard.location = contract.location;
    const body = new BlockNode([noopGuard]); body.location = contract.location;
    const noop = new FunctionDefinitionNode('__split_noop', [], body); noop.location = contract.location;
    noop.modifiers = [FunctionModifier.PUBLIC, FunctionModifier.DELEGATE]; contract.functions.push(noop);
  }
  contract.isSplitFacet = true;
  const artifact = compileResolvedAst(
    ast, code, options, true, true, true, true, true, true, undefined, splitPreLowersFnPtrArrays(options),
  );
  artifact.contractName = facetName;
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
    fn.modifiers = fn.modifiers.filter((modifier) => modifier !== FunctionModifier.VIEW
      && modifier !== FunctionModifier.PURE);
    for (const param of fn.parameters) param.syntheticallyUsed = true;
    const signature = computeFunctionSignature(fn.name, fn.parameters.map((p) => p.type.toString()));
    const target = new IdentifierNode(route.link); target.location = fn.location;
    const data = new HexLiteralNode(computeFunctionSelector(signature)); data.location = fn.location;
    if (fn.returnTypes.length === 0) {
      const call = new LowLevelCallStatementNode(target, data, 'delegatecall'); call.location = fn.location;
      call.synthesizedFromLibraryCall = true;
      const truth = new BoolLiteralNode(true); truth.location = fn.location;
      const guard = new RequireNode(truth); guard.location = fn.location;
      fn.body = new BlockNode([call, guard]); fn.body.location = fn.location;
    } else {
      const call = new LowLevelCallNode(target, data, 'delegatecall'); call.location = fn.location;
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
    singleAst = singleAst.accept(new AlphaRenameLocalShadows()) as Ast;
    singleAst = singleAst.accept(new DesugarPostfixExpressions()) as Ast;
    // Keep the referenced-contract bytecode byte-identical to its standalone compilation (see comment above).
    singleAst = singleAst.accept(new CoalesceMappingEntryFieldWrites()) as Ast;
    singleAst = singleAst.accept(new CoalesceStructFieldArrayWrites()) as Ast;
    singleAst = singleAst.accept(new LowerMemoryModel()) as Ast;
    singleAst = singleAst.accept(new DesugarNestedArrayWrite()) as Ast;
    singleAst = singleAst.accept(new DesugarLocalBytesElementWrite()) as Ast;
    singleAst = singleAst.accept(new LowerInlineAssembly()) as Ast;
    singleAst = singleAst.accept(new InlineExternalCallHelpers()) as Ast;
    singleAst = singleAst.accept(new InlineReturningStateHelpers(
      compilerOptions.solidityImportCompat ?? false,
    )) as Ast;
    singleAst = singleAst.accept(new LowerDynamicStateJournalHelpers()) as Ast;
    singleAst = singleAst.accept(new LowerCollectionJournalHelpers()) as Ast;
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
    singleAst = singleAst.accept(new SynthesizeBlockOracle(
      compilerOptions.solidityImportCompat ?? false,
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
    for (const col of singleAst.contract.collections) {
      if (col.type instanceof MappingType) col.sorted = true;
    }
    singleAst = singleAst.accept(new SymbolTableTraversal(compilerOptions)) as Ast;
    singleAst = singleAst.accept(new TypeCheckTraversal(
      true, compilerOptions.solidityImportCompat ?? false, compilerOptions.rootFileId,
    )) as Ast;
    singleAst = singleAst.accept(new EnsureFinalRequireTraversal(compilerOptions.enforceFinalRequire)) as Ast;
    if (compilerOptions.enforceLocktimeGuard) {
      singleAst = singleAst.accept(new InjectLocktimeGuardTraversal()) as Ast;
    }
    singleAst = singleAst.accept(new EarlyReturnTransformation()) as Ast;

    refuseEmittingReturningStateHelpers(singleAst.contract);

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
        else if (code[i] === quote) {
          i += 1; break;
        }
        else i += 1;
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
        else if (code[i] === quote) {
          i += 1; break;
        }
        else i += 1;
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
 * solidity-by-example `ERC20.sol` in PLAIN direct-mode compilation (not only under the bus). `_mint` there is void
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
  const candidates = functions.filter((fn) => fn.body && fn.functionId !== undefined && fn.returnTypes.length > 0);
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
    let emits = false;
    walk(fn.body!, (node) => { if (node instanceof EmitStatementNode) emits = true; });
    if (!emits) continue;
    // Name the handler the user wrote, not the compiler's synthetic clone spelling of it.
    throw new EmittingStateHelperEventError(fn, fn.name.replace(/^__message_bus_[a-z]+_/, ''), fn.collectionJournal === true);
  }
}

export function parseCode(
  code: string,
  errorListener: SolidCashErrorListener = ThrowingErrorListener.INSTANCE,
  solidityImportCompat = false,
  chunkedArrays = true,
  importedFileId?: string,
): Ast {
  // Solidity corpus files append diagnostic expectations after `// ----`; that trailer is test metadata, not
  // source text, and often repeats the SPDX spelling inside warning prose.
  const diagnosticTrailer = code.search(/\n\/\/ ----/);
  const spdxSource = diagnosticTrailer >= 0 ? code.slice(0, diagnosticTrailer) : code;
  if (solidityImportCompat) validateUnicodeDirectionMarkers(spdxSource);
  // Common Solidity flattener output retains one SPDX header per concatenated source and marks every boundary
  // with `// File <path>`. MistSwap ships these generated `*Flat.sol` units directly. Keep the ordinary Solidity
  // source-unit diagnostic, but admit this explicit flattened format without rewriting the user's checkout.
  const flattenedSource = /^\s*\/\/\s*File\s+\S+/m.test(spdxSource);
  const spdxIdentifiers = spdxIdentifiersInComments(spdxSource);
  if (solidityImportCompat && !flattenedSource && new Set(spdxIdentifiers).size > 1) {
    throw new Error(
      'Multiple SPDX license identifiers found in source file. '
      + 'Use "AND" or "OR" to combine multiple licenses.',
    );
  }
  // Version-gated EVM instructions are ordinary Yul identifiers before their fork activates. Corpus fixtures
  // carry the requested EVM version in their harness trailer. Rename inactive spellings consistently so their
  // declarations remain legal, while an undeclared reference/call still produces the expected undefined-name
  // diagnostic. Equal-length replacements preserve all source offsets.
  if (solidityImportCompat) {
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
  if (solidityImportCompat) {
    code = code.replace(
      /(\bfunction\b[^{};]*?)(\s+layout\s+at\s*)(?=\{)/g,
      (_m, header, clause) => header + clause.replace(/[^\r\n]/g, ' '),
    );
  }

  // Solidity's storage-layout specifier sets an EVM storage base slot;
  // it has no meaning on the UTXO model, so drop the clause so the contract parses. Anchored to a
  // contract header (so a `layout at .. {` inside a string / body is not touched) and stopping at
  // the body `{`. The clause may span lines and contain NatSpec comments; blank its non-newline characters so
  // downstream source locations keep their original line numbers. (Native code has no such clause, so the strip
  // is a no-op there.)
  // Current Solidity grammar places the clause BEFORE inheritance (`contract C layout at 42 is A`); preserve the
  // `is A` tail rather than consuming it as part of the layout expression. Retain the older post-inheritance
  // spelling below for compatibility with sources SolidCash already accepted.
  code = code.replace(
    /(\bcontract\s+\w+\b)(\s+(?:(?:\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)\s*)*layout\s+at\s+)([^{};]+?)(\s+is\s+[^{}]*?)(?=\s*\{)/g,
    (_m, header, layoutPrefix, expr, inheritance) => {
      if (/\berc7201\b/.test(expr)) {
        console.log('Warning: `layout at erc7201(...)` is not supported in SolidCash - storage is not offset by a '
          + 'base slot on the UTXO model, so the layout specifier is ignored.');
      }
      return header + (layoutPrefix + expr).replace(/[^\r\n]/g, ' ') + inheritance;
    },
  );
  code = code.replace(
    // eslint-disable-next-line max-len
    /(\bcontract\s+\w+\b(?:\s+is\s+[^{}]*?)?)(\s+(?:(?:\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)\s*)*layout\s+at\s+([^{};]+?))(?=\s*\{)/g,
    (_m, header, clause, expr) => {
      if (/\berc7201\b/.test(expr)) {
        console.log('Warning: `layout at erc7201(...)` is not supported in SolidCash - storage is not offset by a '
          + 'base slot on the UTXO model, so the layout specifier is ignored.');
      }
      return header + clause.replace(/[^\r\n]/g, ' ');
    },
  );

  // X120. The file stamp has to cover LEXING AND PARSING, not only the AST build. An ANTLR error listener builds
  // its own `Location` from the offending token while the parse is still running, i.e. before
  // `AstBuilder.build()` opens the stamped scope, so every SYNTAX error in an imported file printed a bare
  // Line/Column that belongs to that file: `IERC5805.sol` (10 lines) reported `Mismatched input 'delegate' ... at
  // Line 63`, which is line 63 of the `IVotes.sol` it re-exports.
  //
  // `withSourceFile(undefined, ..)` for a root parse CLEARS an ambient stamp rather than inheriting one, so a
  // nested parse of compiler-generated route source cannot pick up an importing file's id; the generated mark
  // wins over any file label anyway (`importedFileCaveat`).
  return withSourceFile(importedFileId, () => {
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
    const ast = new AstBuilder(
      parseTree, solidityImportCompat, chunkedArrays, code, importedFileId,
    ).build() as Ast;

    return ast;
  });
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
