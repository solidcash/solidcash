import { FunctionDefinitionNode } from '../ast/AST.js';

// H8: the inline passes look a callee up by name and disambiguate only by argument count, so two same-name
// same-arity overloads (e.g. f(uint256) vs f(int256)) collapse to a last-wins map entry - inlining one by that
// key can splice the WRONG body (and drop its require guard). A key is `<name>/<arity>`.
export function inlineKey(name: string, arity: number): string {
  return `${name}/${arity}`;
}

// Collect the `<name>/<arity>` keys that more than one inline-eligible function shares, i.e. the keys an inline
// pass cannot resolve unambiguously. Callers refuse to inline (throw AmbiguousInlineOverloadError) for these.
export function collectAmbiguousInlineKeys(fns: FunctionDefinitionNode[]): Set<string> {
  const seen = new Set<string>();
  const ambiguous = new Set<string>();
  for (const fn of fns) {
    const k = inlineKey(fn.name, fn.parameters.length);
    if (seen.has(k)) ambiguous.add(k);
    seen.add(k);
  }
  return ambiguous;
}
