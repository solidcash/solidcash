import {
  compileString as compileStringRaw,
  compileStringMulti as compileStringMultiRaw,
  compileStringSplit as compileStringSplitRaw,
} from '@solidcash/solidc';

type StringOptions = NonNullable<Parameters<typeof compileStringRaw>[1]>;
type MultiOptions = NonNullable<Parameters<typeof compileStringMultiRaw>[1]>;
type SplitOptions = NonNullable<Parameters<typeof compileStringSplitRaw>[1]>;

/**
 * Compile fixtures which exercise the direct transaction APIs. Options pass through unchanged; the suites keep
 * this import as the one place that selects their compile defaults.
 */
export const compileString = (
  source: string, options: StringOptions = {},
): ReturnType<typeof compileStringRaw> => compileStringRaw(source, { ...options,
});

export const compileStringMulti = (
  source: string, options: MultiOptions = {},
): ReturnType<typeof compileStringMultiRaw> => compileStringMultiRaw(source, { ...options,
});

export const compileStringSplit = (
  source: string, options: SplitOptions,
): ReturnType<typeof compileStringSplitRaw> => compileStringSplitRaw(source, { ...options,
});
