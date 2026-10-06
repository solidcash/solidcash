import { describe, expect, it } from 'vitest';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { readPerCallEntry } from '../../../src/per-call/read/index.js';
import {
  compilePerCall, deployPlain, newWorld, recordMet, type PlainDeployment, type World,
} from './composition-world.js';

/**
 * Walls ahead: one entry that reaches two deployments of the same contract, as a view over a pair of tokens compiled
 * from one source reads both. The hop and the plain call path serve the calls (`call/two-deployments-one-contract`):
 * each deployment is its own block, its masters, records and validator coverage told apart by category.
 *
 * The off-chain read path plans its frames on its own (`read/read.ts`). It resolves a call's target from the address
 * the site bakes in or from the interface the site names, never from the address the caller's own state holds, so
 * two deployments held in state behind one interface are refused by name; past that, its blocks and record ids are
 * still keyed by the contract's name (`calleeRecordId`, the block loop of `readPerCallEntry`).
 *
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IToken { function supplyOf() external view returns (uint256); }',
  'contract Token {',
  '  uint256 public supply;',
  '  constructor(uint256 start) { supply = start; }',
  '  function supplyOf() external view returns (uint256) { return supply; }',
  '}',
  'contract Basket {',
  '  IToken public tokenA;',
  '  IToken public tokenB;',
  '  constructor(IToken a, IToken b) { tokenA = a; tokenB = b; }',
  '  function supplies() external view returns (uint256) { return tokenA.supplyOf() * 100 + tokenB.supplyOf(); }',
  '}',
].join('\n');

interface Chain {
  readonly world: World;
  readonly tokenA: PlainDeployment;
  readonly tokenB: PlainDeployment;
  readonly basket: PlainDeployment;
}
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const artifacts = compilePerCall(SOURCE);
    const world = await newWorld(0x55);
    const tokenA = await deployPlain(world, artifacts.Token!, [3n]);
    const tokenB = await deployPlain(world, artifacts.Token!, [4n]);
    const basket = await deployPlain(world, artifacts.Basket!, [tokenA.address, tokenB.address]);
    return { world, tokenA, tokenB, basket };
  })();
  return chainRun;
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: one entry reaching two deployments of one contract', () => {
  it('through the read path: refuses a view over both deployments by name (should read 304 once served)', async () => {
    const c = await chain();
    // Each token under its own name, so each call could be matched to its deployment by address.
    const externals = {
      TokenA: { artifact: c.tokenA.artifact, categoryId: c.tokenA.categoryId },
      TokenB: { artifact: c.tokenB.artifact, categoryId: c.tokenB.categoryId },
    };
    let error: Error | undefined;
    try {
      await readPerCallEntry({
        provider: c.world.network, artifact: c.basket.artifact, categoryId: c.basket.categoryId,
        functionName: 'supplies', externals, vm: compositionMachine(),
      });
    } catch (caught) {
      error = caught as Error;
    }
    recordMet('two-deployments-one-artifact/read', error?.message ?? 'accepted');
    expect(error?.message).toBe('entry "Basket.supplies()" makes 2 external call(s): "IToken.supplyOf()" at 0x is not '
      + 'supplied in externals');
  }, 600_000);
});
