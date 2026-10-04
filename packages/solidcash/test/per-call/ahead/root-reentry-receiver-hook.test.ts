import { describe, expect, it } from 'vitest';
import { PerCallProxyDeployError } from '../../../src/per-call/proxy/index.js';
import {
  USER_LOCK, compilePerCall, deployPlain, deployProxied, enterPlain, enterProxied, newWorld, recordMet,
  refusedVerdicts, type PlainDeployment, type ProxiedDeployment, type World,
} from './composition-world.js';

/**
 * Walls ahead: a contract that pulls an NFT into itself and is called back by the token's receiver hook, the
 * staking / escrow / listing pattern `nft.safeTransferFrom(msg.sender, address(this), id)` answered by
 * `onERC721Received` on the same contract. The hook re-enters the ROOT's own contract below a callee, and the hop
 * gives the root's contract one block (`proxy/external-calls.ts`, `ctx.fixed`): a callee contract re-entered is
 * served, the root re-entered is refused by name. The bare A -> B -> A.k() row of
 * `conformance/cross-contract-identity.test.ts` pins the same refusal on the plain path; this is the shape real
 * contracts reach it by, with the hook unconditional and behind ERC-721's `to.code.length > 0` check.
 *
 * The deed is minted and the locker approved as an operator first, each a plain root that settles.
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface IReceiver { function onReceived(address from, uint256 id) external returns (bool); }',
  'interface IDeed {',
  '  function transferAndNotify(address from, address to, uint256 id) external;',
  '  function transferChecked(address from, address to, uint256 id) external;',
  '}',
  'contract Deed {',
  '  uint256 public minted;',
  '  mapping(uint256 => address) public ownerOf;',
  '  mapping(address => mapping(address => bool)) public operators;',
  '  function mint(address to, uint256 id) external {',
  '    require(ownerOf[id] == address(0), "minted");',
  '    ownerOf[id] = to;',
  '    minted += 1;',
  '  }',
  '  function setOperator(address operator, bool allowed) external { operators[msg.sender][operator] = allowed; }',
  '  function transferAndNotify(address from, address to, uint256 id) external {',
  '    require(ownerOf[id] == from, "not owner");',
  '    require(operators[from][msg.sender], "not allowed");',
  '    ownerOf[id] = to;',
  '    require(IReceiver(to).onReceived(from, id), "rejected");',
  '  }',
  '  function transferChecked(address from, address to, uint256 id) external {',
  '    require(ownerOf[id] == from, "not owner");',
  '    require(operators[from][msg.sender], "not allowed");',
  '    ownerOf[id] = to;',
  '    if (to.code.length > 0) { require(IReceiver(to).onReceived(from, id), "rejected"); }',
  '  }',
  '}',
  'contract Locker {',
  '  address public implementation;',
  '  IDeed public deed;',
  '  mapping(uint256 => address) public depositor;',
  '  function initialize(IDeed deed_) public { deed = deed_; }',
  '  function deposit(uint256 id) external { deed.transferAndNotify(msg.sender, address(this), id); }',
  '  function depositChecked(uint256 id) external { deed.transferChecked(msg.sender, address(this), id); }',
  '  function onReceived(address from, uint256 id) external returns (bool) {',
  '    require(msg.sender == address(deed), "not the deed");',
  '    depositor[id] = from;',
  '    return true;',
  '  }',
  '}',
].join('\n');

const REENTRY = 'the call to "IReceiver.onReceived" reaches "Locker", which this hop already places; a contract that '
  + 'reaches itself below itself cannot be given a second block in the hop';

interface Chain { readonly world: World; readonly deed: PlainDeployment; readonly locker: ProxiedDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const artifacts = compilePerCall(SOURCE);
    const world = await newWorld(0x58);
    const deed = await deployPlain(world, artifacts.Deed!);
    const locker = await deployProxied(world, artifacts.Locker!, [deed.address]);
    return { world, deed, locker };
  })();
  return chainRun;
}

const externalsOf = (c: Chain): Record<string, never> => ({
  Deed: { artifact: c.deed.artifact, categoryId: c.deed.categoryId },
  Locker: c.locker.external,
} as never);

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a receiver hook that re-enters the root', () => {
  it('mints two deeds to the user and approves the locker (setup, plain roots)', async () => {
    const c = await chain();
    for (const [entry, args] of [
      ['mint', [USER_LOCK, 1n]], ['mint', [USER_LOCK, 2n]], ['setOperator', [c.locker.address, true]],
    ] as const) {
      const outcome = await enterPlain(c.world, c.deed, entry, args as never);
      expect(outcome.error).toBeUndefined();
      expect(refusedVerdicts(outcome.result!)).toBeUndefined();
    }
  }, 600_000);

  it('refuses a deposit whose deed calls the locker\'s hook (should settle once served)', async () => {
    const c = await chain();
    const outcome = await enterProxied(c.world, c.locker, 'deposit', [1n], externalsOf(c));
    recordMet('root-reentry-receiver-hook/deposit', outcome.error?.message);
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toContain(REENTRY);
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);

  it('refuses the ERC-721 spelling, the hook behind `to.code.length > 0` (should settle once served)', async () => {
    const c = await chain();
    const outcome = await enterProxied(c.world, c.locker, 'depositChecked', [2n], externalsOf(c));
    recordMet('root-reentry-receiver-hook/depositChecked', outcome.error?.message);
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toContain(REENTRY);
    expect(outcome.coinSpent).toBe(false);
  }, 600_000);
});
