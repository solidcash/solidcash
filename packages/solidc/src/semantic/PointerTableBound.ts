import { Node } from '../ast/AST.js';
import { SolidCashError } from '../Errors.js';

/**
 * Largest pointer table the compiler expands. A proven bound above this is still a bound, but the expansion
 * would duplicate the handler body past the point where the balanced participant block stays legible, so it is
 * rejected with the same stable diagnostic rather than silently truncated.
 */
export const MAXIMUM_POINTER_TABLE_BOUND = 24;

/** Stable, exact rejection for a message-bus pointer-table loop the compiler cannot bound. */
export class PointerTableBoundError extends SolidCashError {
  constructor(node: Node, detail: string) {
    super(node, `Message-bus pointer-table loop is not compiler-bounded: ${detail}`);
  }
}

/**
 * One expanded pointer-table dispatch loop.
 *
 * `count` is the compiler-proven ceiling on reached rows and also the number of expanded syntactic callsites.
 * `guarded` distinguishes a RUNTIME-sized table, whose reached row count is `0..count` and is decided on-chain by
 * the source guard, from a fixed literal trip count, which always reaches exactly `count` rows.
 */
export interface PointerTableExpansion {
  count: number;
  guarded: boolean;
}

/** Expanded pointer-table loops per source function name, in source order. */
export type PointerTableExpansionMap = Map<string, PointerTableExpansion[]>;

/** Record one expansion for `functionName`. A function with more than one group is not coalesced. */
export function recordPointerTableExpansion(
  expansions: PointerTableExpansionMap | undefined,
  functionName: string,
  expansion: PointerTableExpansion,
): void {
  if (!expansions) return;
  const group = expansions.get(functionName) ?? [];
  group.push(expansion);
  expansions.set(functionName, group);
}
