import {
  compileString as compileStringRaw,
  compileStringMulti as compileStringMultiRaw,
} from '../../src/index.js';

// Most historical corpus fixtures use terse pre-0.5-style declarations. Keep that shorthand explicit here;
// visibility-parity tests opt back into the production default with allowOmittedFunctionVisibility: false.
export const compileString: typeof compileStringRaw = (code, options = {}) =>
  compileStringRaw(code, { allowOmittedFunctionVisibility: true, ...options });

export const compileStringMulti: typeof compileStringMultiRaw = (code, options = {}) =>
  compileStringMultiRaw(code, { allowOmittedFunctionVisibility: true, ...options });

export { compileStringRaw, compileStringMultiRaw };
