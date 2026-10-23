import {
  compileString as compileStringRaw,
  compileStringMulti as compileStringMultiRaw,
  compileStringSplit as compileStringSplitRaw,
} from '@solidcash/solidc';

type StringOptions = NonNullable<Parameters<typeof compileStringRaw>[1]>;
type MultiOptions = NonNullable<Parameters<typeof compileStringMultiRaw>[1]>;
type SplitOptions = NonNullable<Parameters<typeof compileStringSplitRaw>[1]>;

/**
 * Compile fixtures which exercise the pre-message-bus batch direct transaction APIs.
 *
 * These suites verify language and SDK behavior outside message bus. Atomic
 * composition tests deliberately import the production compiler instead so the
 * inferred message-bus batch route remains under test there.
 */
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
  source: string, options: SplitOptions,
): ReturnType<typeof compileStringSplitRaw> => compileStringSplitRaw(source, {
  messageBus: false, ...options,
});
