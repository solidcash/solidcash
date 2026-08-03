import {
  compileFile as compileFileRaw,
  compileString as compileStringRaw, compileStringMulti as compileStringMultiRaw,
  compileStringSplit as compileStringSplitRaw,
} from '../src/index.js';

type FileOptions = NonNullable<Parameters<typeof compileFileRaw>[1]>;
type StringOptions = NonNullable<Parameters<typeof compileStringRaw>[1]>;
type MultiOptions = NonNullable<Parameters<typeof compileStringMultiRaw>[1]>;
type SplitOptions = NonNullable<Parameters<typeof compileStringSplitRaw>[1]>;

/**
 * Compile a fixture for direct-route language semantics.
 *
 * General parser/type/codegen tests must not synthesize an unrelated SCB1 route: doing so changes byte-identity
 * assertions, can replace the source diagnostic with a generated-route diagnostic, and multiplies full-suite
 * runtime. Layer-3 tests import the production compiler directly. An explicit `messageBus: true` still wins.
 */
export const compileFile = (
  sourcePath: Parameters<typeof compileFileRaw>[0], options: FileOptions = {},
): ReturnType<typeof compileFileRaw> => compileFileRaw(sourcePath, {
  messageBus: false, ...options,
});

export const compileString = (
  source: string, options: StringOptions = {},
): ReturnType<typeof compileStringRaw> => compileStringRaw(source, {
  messageBus: false, ...options,
});

export const compileStringMulti = (
  source: string, options: MultiOptions = {},
): ReturnType<typeof compileStringMultiRaw> => compileStringMultiRaw(source, {
  messageBus: false, ...options,
});

export const compileStringSplit = (
  source: string, options: SplitOptions = {},
): ReturnType<typeof compileStringSplitRaw> => compileStringSplitRaw(source, {
  messageBus: false, ...options,
});
