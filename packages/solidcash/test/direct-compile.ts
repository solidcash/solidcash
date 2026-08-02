import {
  compileString as compileStringRaw,
  compileStringMulti as compileStringMultiRaw,
} from 'solidc';

type StringOptions = NonNullable<Parameters<typeof compileStringRaw>[1]>;
type MultiOptions = NonNullable<Parameters<typeof compileStringMultiRaw>[1]>;

/**
 * Compile fixtures which exercise the pre-SCB1 direct transaction APIs.
 *
 * These suites verify language and SDK behavior outside Layer 3. Controllerless
 * composition tests deliberately import the production compiler instead so the
 * inferred SCB1 route remains under test there.
 */
export const compileString = (
  source: string, options: StringOptions = {},
): ReturnType<typeof compileStringRaw> => compileStringRaw(source, { hiddenBatch: false, ...options });

export const compileStringMulti = (
  source: string, options: MultiOptions = {},
): ReturnType<typeof compileStringMultiRaw> => compileStringMultiRaw(source, { hiddenBatch: false, ...options });
