import { makeCallResolver } from "@solidcash/solidcash/dist/framed/proxy/call-resolution.js";
import { resolveMasterPoolSize } from "@solidcash/solidcash/dist/framed/deploy/pool.js";
import type { Artifact, FunctionSplitBundle } from "@solidcash/utils";

/**
 * The pool a pair is created with. `createPair`'s own input checks every output of the pair's category, and 2/1 is
 * the largest pool that fits mainnet's 10,000-byte input limit (the SDK default of 12/4 does not).
 */
export const PAIR_POOL = { masters: 2, validators: 1 } as const;

/**
 * The child a `createPair` call mints, with the pool the factory was deployed for.
 *
 * `callFramedEntry` infers a creating entry's child from the registry, but that inference uses the SDK's default
 * pool. The factory's child locks and output count were fixed by `PAIR_POOL` at deployment, so the call must state
 * the same pool. The folded `initialize` arguments are resolved from the call's own arguments, as the factory body
 * computes them (it sorts the two locks).
 */
export function pairCreation(
  factory: Artifact,
  pair: { artifact: Artifact; bundle: FunctionSplitBundle },
  tokenA: Uint8Array,
  tokenB: Uint8Array,
) {
  const site = (factory.composition as { creates?: { contractName?: string; foldedCall?: { argumentSources: unknown[] } }[] } | undefined)
    ?.creates?.find((candidate) => candidate.contractName === "UniswapV2Pair");
  const folded = site?.foldedCall;
  if (folded === undefined) throw new Error("the factory folds no pair initializer");
  const resolver = makeCallResolver({
    artifact: factory as never, functionName: "createPair", args: [tokenA, tokenB], stateValues: {},
  } as never);
  const args = folded.argumentSources.map((source) => resolver.resolve(source as never, 0));
  return {
    artifact: pair.artifact,
    split: pair.bundle,
    pool: resolveMasterPoolSize(PAIR_POOL),
    initializer: { functionName: "initialize", args },
  };
}
