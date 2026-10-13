/**
 * A compiler warning. `message` is the full text, including the leading `Warning:`.
 * CashScript delivers the same kind of diagnostic to `warningListener` instead of printing it.
 */
export interface CompilerWarning {
  message: string;
}

/** Receives each compiler warning. When set, it replaces the default console print. */
export type WarningListener = (warning: CompilerWarning) => void;

/**
 * The print used when a compile does not pass its own listener. Pipeline warnings have always been
 * `console.log` lines, and the compiler tests read them there.
 */
export const defaultWarningListener: WarningListener = (warning) => {
  console.log(warning.message);
};

const suppressedWarningListener: WarningListener = () => {};

let currentListener: WarningListener = defaultWarningListener;
const listenerStack: WarningListener[] = [];

/** Hand one warning to the listener installed for the compile that is running. */
export function emitCompilerWarning(message: string): void {
  currentListener({ message });
}

/** Run `compile` with `listener` in place of the default print. Restores the previous listener after. */
export function withWarningListener<T>(listener: WarningListener, compile: () => T): T {
  listenerStack.push(currentListener);
  currentListener = listener;
  try {
    return compile();
  } finally {
    currentListener = listenerStack.pop() ?? defaultWarningListener;
  }
}

/** Run `compile` without emitting warnings, including warnings from a listener installed further out. */
export function withSuppressedWarnings<T>(compile: () => T): T {
  return withWarningListener(suppressedWarningListener, compile);
}
