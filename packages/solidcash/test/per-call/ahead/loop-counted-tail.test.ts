import { describe, expect, it } from 'vitest';
import { PerCallProxyDeployError } from '../../../src/per-call/proxy/index.js';
import {
  compilePerCall, deployProxied, enterProxied, newWorld, refusedVerdicts, type ProxiedDeployment, type World,
} from './composition-world.js';

/**
 * Walls ahead: a loop over the caller's own array that pays once per turn, a refund loop that pays each address,
 * entered through a generated proxy. The compiler serves it: the body pins each send at the next output of the run
 * its frame lists, and the plain call path settles it (`call/loop-turn-effects.test.ts`, with the loops that emit
 * and hash per turn, which settle through the hop too). The hop lists no send for the implementation's frame (the
 * walls report's rank 5, native value through a proxy), so it refuses the entry by name before any plan. The
 * control loops over the same array writing a scalar only, and settles. The file runs only under
 * `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Batcher {',
  '  address public implementation;',
  '  uint256 public count;',
  '  function initialize(uint256 start) public { count = start; }',
  '  function tally(uint256[] calldata ids) external {',
  '    for (uint256 i = 0; i < ids.length; i++) { count += ids[i]; }',
  '  }',
  '  function refund(address[] calldata to, uint256 each) external {',
  '    for (uint256 i = 0; i < to.length; i++) { payable(to[i]).transfer(each); }',
  '    count += 1;',
  '  }',
  '}',
].join('\n');

interface Chain { readonly world: World; readonly batcher: ProxiedDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x57);
    const batcher = await deployProxied(world, compilePerCall(SOURCE).Batcher!, [7n]);
    return { world, batcher };
  })();
  return chainRun;
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a loop that pays per turn, through a proxy', () => {
  it('settles a loop over the caller\'s array that writes a scalar only (control)', async () => {
    const { world, batcher } = await chain();
    const outcome = await enterProxied(world, batcher, 'tally', [[1n, 2n, 3n]]);
    expect(outcome.error).toBeUndefined();
    expect(refusedVerdicts(outcome.result!)).toBeUndefined();
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 600_000);

  it('refuses a value send per turn through the hop, by name (should settle once the hop lists sends)', async () => {
    const { world, batcher } = await chain();
    const outcome = await enterProxied(world, batcher, 'refund', [[new Uint8Array(25)], 1_000n]);
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toBe('the implementation\'s "refund" entry sends value from a loop, and the hop '
      + 'lists no send for the implementation\'s frame');
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);
});
