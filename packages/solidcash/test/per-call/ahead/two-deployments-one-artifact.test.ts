import { describe, expect, it } from 'vitest';
import {
  compilePerCall, deployPlain, deployProxied, enterPlain, enterProxied, newWorld, recordMet, refusedVerdicts,
  type PlainDeployment, type ProxiedDeployment, type World,
} from './composition-world.js';

/**
 * Walls ahead: one entry that reaches two deployments of the same contract, as a swap, a pair or an OTC escrow
 * reaches its two tokens (both compiled from one ERC-20 source). The plain call path refuses the shape by name
 * (`call/callees.ts`, "two deployments ... this call path does not tell apart yet"). The hop has no such check and
 * keys its own bookkeeping by the contract's NAME, not its category: the master slot it takes next
 * (`masterSlots`), the record ids (`Token-record-N`, `calleeRecordSet`) and the callee block
 * (`calleeBlocks`, `proxy/deploy.ts`) are shared by both deployments.
 *
 * The control enters one token and settles. The file runs only under `PER_CALL_AHEAD=1`.
 */

const TOKEN = [
  'interface IToken { function credit(address to, uint256 amount) external; }',
  'contract Token {',
  '  uint256 public supply;',
  '  mapping(address => uint256) internal balances;',
  '  function credit(address to, uint256 amount) external { supply += amount; balances[to] += amount; }',
  '}',
];

const SOURCE = [
  'pragma solidity ^0.8.20;',
  ...TOKEN,
  'contract Swap {',
  '  address public implementation;',
  '  IToken public tokenA;',
  '  IToken public tokenB;',
  '  function initialize(IToken a, IToken b) public { tokenA = a; tokenB = b; }',
  '  function one(uint256 amount) external { tokenA.credit(msg.sender, amount); }',
  '  function both(uint256 amount) external {',
  '    tokenA.credit(msg.sender, amount);',
  '    tokenB.credit(msg.sender, amount);',
  '  }',
  '}',
  'contract PlainSwap {',
  '  IToken public tokenA;',
  '  IToken public tokenB;',
  '  constructor(IToken a, IToken b) { tokenA = a; tokenB = b; }',
  '  function both(uint256 amount) external {',
  '    tokenA.credit(msg.sender, amount);',
  '    tokenB.credit(msg.sender, amount);',
  '  }',
  '}',
].join('\n');

interface Chain {
  readonly world: World;
  readonly tokenA: PlainDeployment;
  readonly tokenB: PlainDeployment;
  readonly swap: ProxiedDeployment;
  readonly plainSwap: PlainDeployment;
}
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const artifacts = compilePerCall(SOURCE);
    const world = await newWorld(0x55);
    const tokenA = await deployPlain(world, artifacts.Token!);
    const tokenB = await deployPlain(world, artifacts.Token!);
    const swap = await deployProxied(world, artifacts.Swap!, [tokenA.address, tokenB.address]);
    const plainSwap = await deployPlain(world, artifacts.PlainSwap!, [tokenA.address, tokenB.address]);
    return { world, tokenA, tokenB, swap, plainSwap };
  })();
  return chainRun;
}

/** Both tokens, each under its own deployment name, so each call is matched to its token by address. */
const externalsOf = (c: Chain): Record<string, { artifact: PlainDeployment['artifact']; categoryId: string }> => ({
  TokenA: { artifact: c.tokenA.artifact, categoryId: c.tokenA.categoryId },
  TokenB: { artifact: c.tokenB.artifact, categoryId: c.tokenB.categoryId },
});

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: one entry reaching two deployments of one contract', () => {
  it('settles a call into one of the two tokens (control)', async () => {
    const c = await chain();
    const outcome = await enterProxied(c.world, c.swap, 'one', [5n], externalsOf(c));
    expect(outcome.error).toBeUndefined();
    expect(refusedVerdicts(outcome.result!)).toBeUndefined();
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 600_000);

  it('through the hop: does not settle a call into both tokens (should settle once served)', async () => {
    const c = await chain();
    const outcome = await enterProxied(c.world, c.swap, 'both', [5n], externalsOf(c));
    recordMet('two-deployments-one-artifact/hop', outcome.error?.message
      ?? (outcome.result === undefined ? undefined : refusedVerdicts(outcome.result) ?? 'accepted'));
    expect(outcome.result?.broadcast).toBeUndefined();
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);

  it('through the plain path: refuses the call by name (should settle once served)', async () => {
    const c = await chain();
    const outcome = await enterPlain(c.world, c.plainSwap, 'both', [5n], externalsOf(c));
    expect(outcome.error!.message).toBe('entry "both" makes 2 external call(s): it reaches two deployments of '
      + '"Token", whose blocks and records this call path does not tell apart yet');
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);
});
