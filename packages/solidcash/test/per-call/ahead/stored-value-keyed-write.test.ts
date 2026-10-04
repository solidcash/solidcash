import { describe, expect, it } from 'vitest';
import { PerCallProxyDeployError } from '../../../src/per-call/proxy/index.js';
import {
  USER_LOCK, compilePerCall, compileProject, deployPlain, deployProxied, enterPlain, enterProxied, newWorld,
  refusedVerdicts, type PlainDeployment, type ProxiedDeployment, type World,
} from './composition-world.js';

/**
 * Walls ahead: a mapping write keyed by a value the body read out of another mapping, the escrow and marketplace
 * pattern "credit the party the record names" (`owed[deal.payee] += deal.amount`, a sale crediting
 * `proceeds[listing.seller]`, OpenZeppelin ERC721 debiting `_balances[_ownerOf(id)]`). One wall stands, the third;
 * the first two are served:
 *
 * 1. Under the project build's options (`messageBus: true`, as the fixture's config sets it) the unit compiles. It
 *    failed in the message-bus route generated for `open` while the memory-copy spelling crashed code generation
 *    (2); the direct spelling compiled under those options all along.
 * 2. With the per-call options alone, the memory-copy spelling (`Deal memory d = deals[id]; owed[d.payee] += ...`)
 *    compiles: the derivation follows the local `d` to `deals[id]` (`support.ts`, `deriveKeyExpression`) and keys
 *    the write exactly as the direct spelling does, so it meets wall 3 with the same key. Code generation crashed on
 *    it until the emitted key stopped naming `d`, which the derivation runs before.
 * 3. The direct spelling (`owed[deals[id].payee] += deals[id].amount`) compiles, and the hop's own planner refuses
 *    it: its key resolution reads the call's arguments, the sender, constants and the record's scalar state, never
 *    another collection's node (`proxy/entry-writes.ts`, `resolveHopKey`; the plain path's
 *    `call/entry-records.ts`, `resolveKeys`). The deal is opened first, keyed by a parameter, as the control.
 *
 * The file runs only under `PER_CALL_AHEAD=1`.
 */

const escrow = (release: readonly string[]): string => [
  'pragma solidity ^0.8.20;',
  'contract Escrow {',
  '  struct Deal { address payee; uint256 amount; }',
  '  address public implementation;',
  '  uint256 public opened;',
  '  mapping(uint256 => Deal) public deals;',
  '  mapping(address => uint256) public owed;',
  '  function initialize(uint256 start) public { opened = start; }',
  '  function open(uint256 id, address payee, uint256 amount) external { deals[id] = Deal(payee, amount); }',
  '  function release(uint256 id) external {',
  ...release,
  '  }',
  '}',
].join('\n');

/** The memory-copy spelling, as most sources write it. */
const COPY_SOURCE = escrow([
  '    Deal memory d = deals[id];',
  '    require(d.amount > 0, "empty");',
  '    owed[d.payee] += d.amount;',
]);
/** The same release read straight off the mapping. */
const DIRECT_SOURCE = escrow([
  '    require(deals[id].amount > 0, "empty");',
  '    owed[deals[id].payee] += deals[id].amount;',
]);

const KEY_LABEL = 'field:payee(map:deals(id:id))';

interface Chain { readonly world: World; readonly proxied: ProxiedDeployment; readonly plain: PlainDeployment }
let chainRun: Promise<Chain> | undefined;
function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const artifact = compilePerCall(DIRECT_SOURCE).Escrow!;
    const world = await newWorld(0x53);
    const proxied = await deployProxied(world, artifact, [1n]);
    const plain = await deployPlain(world, artifact);
    return { world, proxied, plain };
  })();
  return chainRun;
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a write keyed by a value read from another mapping', () => {
  it('compiles under the project options, as the direct spelling does', () => {
    expect(compileProject(COPY_SOURCE).Escrow!.composition?.refusedEntries ?? []).toStrictEqual([]);
  }, 300_000);

  it('compiles the memory-copy spelling, keyed as the direct spelling is', () => {
    const artifact = compilePerCall(COPY_SOURCE).Escrow!;
    expect(artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
    const access = artifact.abi.find((entry) => entry.name === 'release')?.entryAccesses
      ?.find((candidate) => candidate.collection === 'owed');
    expect(access?.keySources?.[0]?.expressionLabel).toBe(KEY_LABEL);
  }, 300_000);

  it('compiles the direct spelling: the key is a mapping entry the master holds', async () => {
    const { proxied } = await chain();
    expect(proxied.artifact.composition?.refusedEntries ?? []).toStrictEqual([]);
  }, 600_000);

  it('through the hop: opens a deal (control), then refuses its release (should settle once served)', async () => {
    const { world, proxied } = await chain();
    const opened = await enterProxied(world, proxied, 'open', [1n, USER_LOCK, 50n]);
    expect(opened.error).toBeUndefined();
    expect(refusedVerdicts(opened.result!)).toBeUndefined();
    const released = await enterProxied(world, proxied, 'release', [1n]);
    expect(released.error).toBeInstanceOf(PerCallProxyDeployError);
    expect(released.error!.message).toBe('the implementation\'s "release" entry writes mapping "owed" at a key this '
      + `hop cannot resolve from its call data (${KEY_LABEL})`);
    expect(released.coinSpent).toBe(false);
  }, 600_000);

  it('through the plain path: refuses the release the same way (should settle once served)', async () => {
    const { world, plain } = await chain();
    const released = await enterPlain(world, plain, 'release', [1n]);
    expect(released.error!.message).toBe('entry "release" touches mapping "owed" at a key the frame\'s arguments do '
      + `not determine (${KEY_LABEL})`);
    expect(released.coinSpent).toBe(false);
  }, 600_000);
});
