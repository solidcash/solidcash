export * from './Errors.js';
export * as utils from '@solidcash/utils';
export { compileFile, compileFileMulti, compileFileSplit } from './compileFile.js';
export {
  assertNoReservedMessageBusSelector,
  classifyMessageBusRejection,
  clearCompileCache,
  compileString, compileStringMulti, compileStringSplit, DEFAULT_COMPILER_OPTIONS,
  ensureMessageBusAdmissionStamp,
  getArtifactCacheHitCount,
  resetPendingSpanAdmissionAnalysis,
  type CompileOptions, type CompileStringOptions, type SplitCompileOptions,
} from './compiler.js';
export {
  assertNoUnknownSolidcEnvKeys,
  classifySolidcEnv,
  enforceSolidcEnvPolicy,
  isSolidcStrictUnknownEnvEnabled,
  listRegisteredSolidcEnv,
  resolveSolidcFeatureFlags,
  solidcEnvFlagEnabled,
  solidcEnvValue,
  solidcFeatureIdentityBits,
  unknownSolidcEnvKeys,
  PRODUCTION_SOLIDC_ENV_HOT_SET,
  type SolidcEnvClass,
  type SolidcEnvEntry,
  type SolidcFeatureFlags,
} from './solidc-env-registry.js';
export {
  isKernelCatalogCode,
  KERNEL_CATALOG_CODES,
  kernelCatalogCodeFromAdmission,
  normalizeKernelAdmissionReason,
  throwKernelCatalogDiagnostic,
  type KernelCatalogCode,
} from './kernel-admission-catalog.js';
export {
  admittedHandlerNamesFromAnalysis,
  assertAdmissionSetUnchanged,
  assertPublishedHandlersMatchAdmission,
  buildAdmissionDecisionSet,
  clearPublishedHandlerAdmissionGateInvocations,
  getPublishedHandlerAdmissionGateInvocations,
  refusedHandlerNamesFromAnalysis,
  type AdmissionDecisionSet,
  type HandlerAdmissionDecision,
  type KernelAdmissionReason,
  type PublishedMessageBusHandler,
} from './admission-decision.js';
export {
  clearDefineFrameValidations,
  getDefineFrameValidations,
  validateDefineEmission,
  type DefineEmissionFrameInput,
  type DefineFrameValidationRecord,
} from './define-frame-validation.js';
export {
  assertFinalizedTypedEffectIr,
  assertPublishedChildDeploymentEffectIr,
  buildPathEffectSchedule,
  evaluatePathEffectActivation,
  hasFinalizedResultType,
  allowsPreFinalIntrinsicTypes,
  normalizePathEffectActivation,
  pathEffectActivationFromExpression,
  pathEffectScheduleFromChildDeployments,
  pathEffectScheduleFromHandlerEffects,
  selectActivePathEffects,
  type FinalizedTypedEffect,
  type FinalizedTypedEffectIrOptions,
  type FinalizedTypedEffectKind,
  type HandlerPathEffectEvent,
  type HandlerPathEffectProgramInput,
  type HandlerPathEffectStateWrite,
  type HandlerPathEffectTransfer,
  type PathEffectActivation,
  type PathEffectActivationEnvironment,
  type PathEffectActivationExpression,
  type PathEffectSchedule,
  type PublishedChildDeploymentSite,
} from './finalized-typed-effect-ir.js';
export {
  type ArtifactMap, type FunctionSplitBundle, type SplitArtifactBundle, type SplitManifest,
} from '@solidcash/utils';
export { createMapResolver } from './createMapResolver.js';
export * from './ast/Location.js';
export * from './ast/error-listeners.js';

export { version } from './version.js';

// Composition conventions and the validator decision procedure a composition is checked against.
export * as composition from './framed/master/composition.js';
export * as masterPrologue from './framed/master/prologue.js';
export * as witnessReader from './framed/master/witness-reader.js';
export * as compositionPlaceholders from './framed/master/placeholders.js';
export * as framedValidator from './framed/validator/index.js';
export * as framedLifecycle from './framed/master/lifecycle.js';
