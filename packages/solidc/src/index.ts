export * from './Errors.js';
export * as utils from '@solidcash/utils';
export { compileFile, compileFileMulti, compileFileSplit } from './compileFile.js';
export {
  clearCompileCache,
  compileString, compileStringMulti, compileStringSplit, DEFAULT_COMPILER_OPTIONS, framedCreationTargetsOfSource,
  getArtifactCacheHitCount,
  type CompileOptions, type CompileStringOptions, type SplitCompileOptions,
} from './compiler.js';
export {
  assertNoUnknownSolidcEnvKeys,
  classifySolidcEnv,
  enforceSolidcEnvPolicy,
  isSolidcStrictUnknownEnvEnabled,
  listRegisteredSolidcEnv,
  solidcEnvFlagEnabled,
  solidcEnvValue,
  unknownSolidcEnvKeys,
  PRODUCTION_SOLIDC_ENV_HOT_SET,
  type SolidcEnvClass,
  type SolidcEnvEntry,
} from './solidc-env-registry.js';
export {
  type ArtifactMap, type FunctionSplitBundle, type SplitArtifactBundle, type SplitManifest,
} from '@solidcash/utils';
export { createMapResolver } from './createMapResolver.js';
export * from './ast/Location.js';
export * from './ast/error-listeners.js';
export { defaultWarningListener, type CompilerWarning, type WarningListener } from './warnings.js';

export { version } from './version.js';

// Composition conventions and the validator decision procedure a composition is checked against.
export * as composition from './framed/master/composition.js';
export * as masterPrologue from './framed/master/prologue.js';
export * as witnessReader from './framed/master/witness-reader.js';
export * as compositionPlaceholders from './framed/master/placeholders.js';
export * as framedValidator from './framed/validator/index.js';
export * as framedLifecycle from './framed/master/lifecycle.js';
