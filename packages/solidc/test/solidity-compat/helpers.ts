import {
  compileString as compileStringRaw,
  compileStringMulti as compileStringMultiRaw,
  type CompileOptions,
} from '../../src/index.js';

// This corpus verifies Solidity language lowering. Atomic routing is covered by its dedicated compiler and SDK
// suites; final-require safety is covered by SafetyDefaults.test.ts. Keep no-effect corpus snippets permissive;
// individual cases can still opt into either production policy explicitly.
export const compileString = (
  source: string, options: CompileOptions = {},
): ReturnType<typeof compileStringRaw> =>
  compileStringRaw(source, {
    messageBus: false, enforceFinalRequire: false, allowUnsafeOperations: true, ...options,
  });

export const compileStringMulti = (
  source: string, options: CompileOptions = {},
): ReturnType<typeof compileStringMultiRaw> =>
  compileStringMultiRaw(source, {
    messageBus: false, enforceFinalRequire: false, allowUnsafeOperations: true, ...options,
  });

export { compileStringRaw, compileStringMultiRaw };
