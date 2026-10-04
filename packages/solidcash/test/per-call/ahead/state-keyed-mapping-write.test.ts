import { describe, expect, it } from 'vitest';
import { PerCallProxyDeployError } from '../../../src/per-call/proxy/index.js';
import {
  USER_LOCK, compileProject, deployProxied, enterProxied, newWorld, refusedVerdicts, type ProxiedDeployment,
  type World,
} from './composition-world.js';

/**
 * Walls ahead: a mapping write keyed by one of the contract's own scalar state variables, the id-counter pattern
 * (`items[nextId] = ...; nextId++`, OpenZeppelin v5 dropped `Counters`, so `uint256 _nextId` is the idiom) and the
 * stored-recipient pattern (`credit[treasury] += fee`). The compiler refuses the entry: a per-call master derives a
 * write's target slot only from a bare parameter, the frame's sender, or a compile-time value, and a bare state read
 * is none of those (`solidc/src/per-call/master/support.ts`, `keyOperandUnavailable`). The hop already resolves a
 * `state:` key label from the deployment's own records (`evalComputedKey`), so the SDK half is in place.
 *
 * The marketplace's escrow ids pass because they read `Counters.Counter._value`, a field of a state struct, which
 * the same check admits. The control writes the same struct keyed by a parameter and settles.
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Registry {',
  '  struct Item { address owner; uint256 price; }',
  '  address public implementation;',
  '  uint256 public nextId;',
  '  address public treasury;',
  '  mapping(uint256 => Item) public items;',
  '  mapping(address => uint256) public credit;',
  '  function initialize(address treasury_) public { treasury = treasury_; nextId = 1; }',
  '  function create(uint256 price) external {',
  '    items[nextId] = Item(msg.sender, price);',
  '    nextId = nextId + 1;',
  '  }',
  '  function createAt(uint256 id, uint256 price) external {',
  '    items[id] = Item(msg.sender, price);',
  '  }',
  '  function pay(uint256 amount, uint256 fee) external {',
  '    credit[msg.sender] += amount;',
  '    credit[treasury] += fee;',
  '  }',
  '}',
].join('\n');

const KEY_RULE = 'and a master derives a target slot only from a bare parameter, the frame\'s sender, or a '
  + 'compile-time value the body holds at its start';

interface Chain { readonly world: World; readonly registry: ProxiedDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x52);
    const registry = await deployProxied(world, compileProject(SOURCE).Registry!, [USER_LOCK]);
    return { world, registry };
  })();
  return chainRun;
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a mapping write keyed by a scalar state variable', () => {
  it('settles the same struct write keyed by a parameter (control)', async () => {
    const { world, registry } = await chain();
    const outcome = await enterProxied(world, registry, 'createAt', [7n, 100n]);
    expect(outcome.error).toBeUndefined();
    expect(refusedVerdicts(outcome.result!)).toBeUndefined();
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 600_000);

  it('refuses the id-counter write `items[nextId]` (should settle once served)', async () => {
    const { world, registry } = await chain();
    const outcome = await enterProxied(world, registry, 'create', [100n]);
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toMatch(new RegExp('^the implementation\'s "create" entry is refused by the '
      + 'compiler \\(Registry\\.create\\(\\)\\): the body writes a mapping at slot \\d+ whose key 0 \'state:nextId\' '
      + 'reads the state value \'nextId\', '));
    expect(outcome.error!.message.endsWith(KEY_RULE)).toBe(true);
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);

  it('refuses the stored-recipient write `credit[treasury]` (should settle once served)', async () => {
    const { world, registry } = await chain();
    const outcome = await enterProxied(world, registry, 'pay', [10n, 1n]);
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toMatch(new RegExp('^the implementation\'s "pay" entry is refused by the '
      + 'compiler \\(Registry\\.pay\\(\\)\\): the body writes a mapping at slot \\d+ whose key 0 \'state:treasury\' '
      + 'reads the state value \'treasury\', '));
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);
});
