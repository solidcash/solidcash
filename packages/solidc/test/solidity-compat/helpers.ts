import {
  compileString as compileStringRaw,
  compileStringMulti as compileStringMultiRaw,
  type CompileOptions,
} from '../../src/index.js';

// This corpus verifies Solidity language lowering. Atomic routing is covered by its dedicated compiler and SDK
// suites; individual corpus cases that specifically require repeated-owner routing opt back in explicitly.
export const compileString = (
  source: string, options: CompileOptions = {},
): ReturnType<typeof compileStringRaw> =>
  compileStringRaw(source, { messageBus: false, ...options });

export const compileStringMulti = (
  source: string, options: CompileOptions = {},
): ReturnType<typeof compileStringMultiRaw> =>
  compileStringMultiRaw(source, { messageBus: false, ...options });

export { compileStringRaw, compileStringMultiRaw };
