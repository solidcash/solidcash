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

/**
 * A compiler-proven trip-count ceiling for a loop that is NOT expanded, one entry per external callsite the
 * loop body holds, in source order.
 *
 * A loop holding an ordinary interface call keeps its rolled form - the covenant really loops - so the reached
 * row count stays runtime. It is still bounded whenever a dominating guard bounds the trip count by a literal,
 * and that ceiling is exactly what a graph consumer must check a chosen row count against. Nothing is recorded
 * when the guard, the loop shape or the bound's mutation analysis fails, so an absent entry always means
 * "no ceiling proven" and never "any count admitted".
 */
export type ProvenLoopCeilingMap = Map<string, number[]>;

/** Record `ceiling` for one external callsite of `functionName`, in source order. */
export function recordProvenLoopCeiling(
  ceilings: ProvenLoopCeilingMap | undefined,
  functionName: string,
  ceiling: number,
): void {
  if (!ceilings) return;
  const group = ceilings.get(functionName) ?? [];
  group.push(ceiling);
  ceilings.set(functionName, group);
}

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
