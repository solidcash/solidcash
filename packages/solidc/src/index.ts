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
  type CompileOptions, type SplitCompileOptions,
} from './compiler.js';
export {
  classifySolidcEnv,
  listRegisteredSolidcEnv,
  resolveSolidcFeatureFlags,
  solidcFeatureIdentityBits,
  unknownSolidcEnvKeys,
  type SolidcEnvClass,
  type SolidcEnvEntry,
  type SolidcFeatureFlags,
} from './solidc-env-registry.js';
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
} from './define-frame-validation.js';export { type ArtifactMap, type SplitArtifactBundle, type SplitManifest } from '@solidcash/utils';
export { createMapResolver } from './createMapResolver.js';
export * from './ast/Location.js';
export * from './ast/error-listeners.js';

export const version = '0.13.1';
