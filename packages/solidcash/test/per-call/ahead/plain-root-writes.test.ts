import { describe, expect, it } from 'vitest';
import {
  USER_LOCK, compilePerCall, deployPlain, enterPlain, newWorld, refusedVerdicts, type PlainDeployment, type World,
} from './composition-world.js';

/**
 * Walls ahead: a plain deployment's own writes on the plain call path (`callPerCallEntry`), with no call at all. The
 * plain path declares one sorted collection's writes per call and no chunked mapping value
 * (`call/entry-records.ts`, `planCallMappingBatch`), where the hop plans one batch per collection and lays a
 * value's chunk run:
 *
 * - an ERC-20 `transferFrom` entered by a user (the allowance and both balances: two collections),
 * - a profile that stores a `string` per address (a chunked mapping value).
 *
 * The control mints (one collection, fixed-width values) and settles. Each case pins the refusal met today; its
 * title says what should settle once the plain path plans what the hop plans. The file runs only under
 * `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Coin {',
  '  uint256 public supply;',
  '  mapping(address => uint256) internal balances;',
  '  mapping(address => mapping(address => uint256)) internal allowances;',
  '  function mint(address to, uint256 amount) external { supply += amount; balances[to] += amount; }',
  '  function transferFrom(address from, address to, uint256 amount) external {',
  '    require(allowances[from][msg.sender] >= amount, "allowance");',
  '    allowances[from][msg.sender] -= amount;',
  '    require(balances[from] >= amount, "balance");',
  '    balances[from] -= amount;',
  '    balances[to] += amount;',
  '  }',
  '}',
  'contract Profiles {',
  '  uint256 public count;',
  '  mapping(address => string) public names;',
  '  function setName(string calldata name) external { names[msg.sender] = name; count += 1; }',
  '}',
].join('\n');

const OTHER = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x5e), 0x88, 0xac]);

interface Chain { readonly world: World; readonly coin: PlainDeployment; readonly profiles: PlainDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const artifacts = compilePerCall(SOURCE);
    const world = await newWorld(0x5b);
    const coin = await deployPlain(world, artifacts.Coin!);
    const profiles = await deployPlain(world, artifacts.Profiles!);
    return { world, coin, profiles };
  })();
  return chainRun;
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a plain root\'s own writes (plain call path)', () => {
  it('settles a mint: one collection, fixed-width values (control)', async () => {
    const { world, coin } = await chain();
    const outcome = await enterPlain(world, coin, 'mint', [USER_LOCK, 100n]);
    expect(outcome.error).toBeUndefined();
    expect(refusedVerdicts(outcome.result!)).toBeUndefined();
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 600_000);

  it('refuses transferFrom, which writes two collections (should settle once served)', async () => {
    const { world, coin } = await chain();
    const outcome = await enterPlain(world, coin, 'transferFrom', [USER_LOCK, OTHER, 10n]);
    expect(outcome.error!.message).toBe('entry "transferFrom" touches 3 mapping entry(ies) across 2 sorted batch(es), '
      + 'and a call declares one collection\'s writes');
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);

  it('refuses a string stored per address (should settle once served)', async () => {
    const { world, profiles } = await chain();
    const outcome = await enterPlain(world, profiles, 'setName', ['alice']);
    expect(outcome.error!.message).toBe('entry "setName" writes mapping "names", whose values chunk, so the created '
      + 'node\'s run of chunk records cannot be declared from the call alone');
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);
});
