import { describe, expect, it } from 'vitest';
import { PerCallProxyDeployError } from '../../../src/per-call/proxy/index.js';
import {
  compilePerCall, deployProxied, enterProxied, newWorld, refusedVerdicts, type ProxiedDeployment, type World,
} from './composition-world.js';

/**
 * Walls ahead: a loop over the caller's own array that emits, hashes or pays once per turn: a batch announcement
 * or airdrop that emits per item, a Merkle-proof claim (OpenZeppelin `MerkleProof.verify` hashes once per proof
 * element), a refund loop that pays each address. The compiler refuses each entry by name
 * (`solidc/src/per-call/master/support.ts`, `assessPerCallMasterShape`): the master's tail fixes the event region,
 * the send region and the side-car positions per body, and a loop makes each count a run-time value. The control
 * loops over the same array writing a scalar only, and settles. The file runs only under `PER_CALL_AHEAD=1`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Batcher {',
  '  address public implementation;',
  '  uint256 public count;',
  '  bytes32 public root;',
  '  mapping(address => bool) public claimed;',
  '  event Announced(uint256 id);',
  '  function initialize(bytes32 root_) public { root = root_; }',
  '  function tally(uint256[] calldata ids) external {',
  '    for (uint256 i = 0; i < ids.length; i++) { count += ids[i]; }',
  '  }',
  '  function announce(uint256[] calldata ids) external {',
  '    for (uint256 i = 0; i < ids.length; i++) { emit Announced(ids[i]); }',
  '    count += ids.length;',
  '  }',
  '  function claim(bytes32[] calldata proof) external {',
  '    bytes32 node = keccak256(abi.encodePacked(msg.sender));',
  '    for (uint256 i = 0; i < proof.length; i++) { node = keccak256(abi.encodePacked(node, proof[i])); }',
  '    require(node == root, "bad proof");',
  '    claimed[msg.sender] = true;',
  '  }',
  '  function refund(address[] calldata to, uint256 each) external {',
  '    for (uint256 i = 0; i < to.length; i++) { payable(to[i]).transfer(each); }',
  '    count += 1;',
  '  }',
  '}',
].join('\n');

const refusal = (entry: string, reason: string): string =>
  `the implementation's "${entry}" entry is refused by the compiler (Batcher.${entry}()): ${reason}`;

interface Chain { readonly world: World; readonly batcher: ProxiedDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const world = await newWorld(0x57);
    const batcher = await deployProxied(world, compilePerCall(SOURCE).Batcher!, [new Uint8Array(32).fill(7)]);
    return { world, batcher };
  })();
  return chainRun;
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a loop that emits, hashes or pays per turn', () => {
  it('settles a loop over the caller\'s array that writes a scalar only (control)', async () => {
    const { world, batcher } = await chain();
    const outcome = await enterProxied(world, batcher, 'tally', [[1n, 2n, 3n]]);
    expect(outcome.error).toBeUndefined();
    expect(refusedVerdicts(outcome.result!)).toBeUndefined();
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 600_000);

  it('refuses an event emitted per turn (should settle once served)', async () => {
    const { world, batcher } = await chain();
    const outcome = await enterProxied(world, batcher, 'announce', [[1n, 2n, 3n]]);
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toBe(refusal('announce', 'an event emitted from a loop makes the event count '
      + 'depend on the loop, so the master cannot fix how many events the tail holds'));
  }, 600_000);

  it('refuses a keccak256 per turn, the Merkle-proof walk (should settle once served)', async () => {
    const { world, batcher } = await chain();
    const outcome = await enterProxied(world, batcher, 'claim', [[new Uint8Array(32).fill(1)]]);
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toBe(refusal('claim', 'a keccak256 call inside a loop reads one compute side-car '
      + 'per turn, which the master head does not locate a run-time number of'));
  }, 600_000);

  it('refuses a value send per turn (should settle once served)', async () => {
    const { world, batcher } = await chain();
    const outcome = await enterProxied(world, batcher, 'refund', [[new Uint8Array(25)], 1_000n]);
    expect(outcome.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(outcome.error!.message).toBe(refusal('refund', 'a value send inside a loop makes the send count depend on '
      + 'the loop, so the master cannot fix how many sends the tail holds'));
  }, 600_000);
});
