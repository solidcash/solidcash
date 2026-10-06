import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, utf8ToBin } from '@bitauth/libauth';
import { bytesToHex, sha256 } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh, bobPriv } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A proxied root entry that writes a sorted mapping at a key held in a local array, written from a field of a
 * dynamic state array's struct element before an internal helper reads it back in a loop (Solidity-compatible).
 *
 * The compiler publishes the key as the element the local holds after its write, a ternary on the index:
 * `ternary(binop:==(lit:0,lit:0),field:helper(field:parts(map:posts(id:id_))),cast:address(lit:0))`. The hop
 * resolves an entry's mapping key from that label (`evalComputedKey`); it took the default arm, the empty
 * `address(0)`, because it compared nothing and read no struct element, so it declared a node the body does not
 * write and the body's own key check refused the frame at the write. The key is now the helper's lock: the entry
 * settles and the helper's flag reads false.
 */

/** A 32-byte category or txid that is neither one repeated byte nor a palindrome, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`written local element key ${label}`)));
}

const IMPL_CATEGORY = idOf('implementation');
const PROXY_CATEGORY = idOf('proxy');

const OWNER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
const HELPER_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
const POST = 0n;

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Desk {',
  '  struct Parts { address owner; address helper; }',
  '  struct Post { uint8 state; Parts parts; string title; }',
  '  address public implementation;',
  '  Post[] public posts;',
  '  mapping(uint256 => mapping(address => bool)) public allowed;',
  '  function initialize() public {}',
  '  function open(string calldata title_) public {',
  '    posts.push();',
  '    uint256 id = posts.length - 1;',
  '    Post storage post = posts[id];',
  '    post.parts.owner = msg.sender;',
  '    post.title = title_;',
  '  }',
  '  function take(uint256 id_) public {',
  '    posts[id_].parts.helper = msg.sender;',
  '    allowed[id_][msg.sender] = true;',
  '  }',
  '  function drop(uint256 id_) public {',
  '    Post storage post = posts[id_];',
  '    post.state = 2;',
  '    address[] memory removed = new address[](1);',
  '    removed[0] = post.parts.helper;',
  '    _drop(id_, removed);',
  '  }',
  '  function _drop(uint256 id_, address[] memory removed_) internal {',
  '    for (uint256 i = 0; i < removed_.length; i++) {',
  '      allowed[id_][removed_[i]] = false;',
  '    }',
  '  }',
  '}',
].join('\n');

/** The options an imported Solidity project compiles with under the framed composition. */
const OPTIONS = {
  solidityImportCompat: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  messageBus: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  ecrecover: 'p2pkh',
  sortedMappingsAll: false,
  composition: 'framed',
} as const;

interface Caller { readonly lock: Uint8Array; readonly funder: Unlocker }

const OWNER: Caller = { lock: OWNER_LOCK, funder: new SignatureTemplate(alicePriv).unlockP2PKH() };
const HELPER: Caller = { lock: HELPER_LOCK, funder: new SignatureTemplate(bobPriv).unlockP2PKH() };

interface World {
  readonly network: MockNetworkProvider;
  readonly artifact: ReturnType<typeof compileStringMulti>[string];
  readonly proxy: string;
  readonly implementation: string;
  readonly changeAddress: string;
  readonly nextCoin: () => Utxo;
}

/** Deploys the desk behind a generated proxy. */
async function deployWorld(): Promise<World> {
  const artifact = compileStringMulti(SOURCE, OPTIONS as never).Desk!;
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, signature);
  const changeAddress = wallet.address;
  let serial = 0;
  const nextCoin = (): Utxo => {
    serial += 1;
    return { txid: idOf(`coin ${serial}`), vout: 0, satoshis: 5_000_000n };
  };
  const implFunding = { txid: IMPL_CATEGORY, vout: 0, satoshis: 5_000_000n };
  const proxyFunding = { txid: PROXY_CATEGORY, vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(wallet.address, implFunding);
  await network.addUtxo(wallet.address, proxyFunding);
  await fundShippedFacets(network);
  const init = nextCoin();
  await network.addUtxo(binToHex(OWNER_LOCK), init);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: artifact,
    implementationDeploy: { fundingUtxo: implFunding, funder, changeAddress },
    proxyDeploy: { fundingUtxo: proxyFunding, funder, changeAddress },
    initialize: { functionName: 'initialize' },
    callerLockingBytecode: OWNER_LOCK,
    callerFunding: { utxo: init, funder: OWNER.funder },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.accepted).toBe(true);
  return {
    network, artifact,
    proxy: deployment.proxy.categoryId, implementation: deployment.implementation.categoryId,
    changeAddress, nextCoin,
  };
}

/** Enters one root entry through the proxy with a fresh coin of the caller's. */
async function enter(
  world: World, functionName: string, args: readonly FunctionArgument[], caller: Caller,
): Promise<FramedProxyCallResult> {
  const coin = world.nextCoin();
  await world.network.addUtxo(binToHex(caller.lock), coin);
  return callFramedProxyEntry({
    provider: world.network,
    implementationArtifact: world.artifact,
    proxyCategoryId: world.proxy,
    implementationCategoryId: world.implementation,
    functionName,
    args,
    callerUtxo: coin,
    callerLockingBytecode: caller.lock,
    funder: caller.funder,
    changeAddress: world.changeAddress,
    vm: compositionMachine(),
  });
}

/** The flag the proxy's records hold for `who` on the post, read through the getter. */
async function allowed(world: World, who: Uint8Array): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: world.artifact, categoryId: world.proxy,
    functionName: 'allowed', args: [POST, who],
  });
  expect(read.accepted).toBe(true);
  return read.value;
}

/** The hop settled: every frame accepted and the transaction broadcast. */
function expectSettled(result: FramedProxyCallResult): void {
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.accepted).toBe(true);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
}

describe('a mapping key held in a local array written from a state array\'s struct field', () => {
  it('publishes the key as the element the local holds after its write', () => {
    const artifact = compileStringMulti(SOURCE, OPTIONS as never).Desk!;
    const drop = artifact.abi.find((entry) => entry.name === 'drop')!;
    expect(drop.entryAccesses?.map((access) => access.keyParams)).toStrictEqual([[
      'id_', 'ternary(binop:==(lit:0,lit:0),field:helper(field:parts(map:posts(id:id_))),cast:address(lit:0))',
    ]]);
  });

  it('writes the node of the helper the post names, and the helper\'s flag reads false', async () => {
    const world = await deployWorld();
    expectSettled(await enter(world, 'open', ['a short post'], OWNER));
    expectSettled(await enter(world, 'take', [POST], HELPER));
    expect(await allowed(world, HELPER_LOCK)).toBe(true);

    expectSettled(await enter(world, 'drop', [POST], OWNER));
    expect(await allowed(world, HELPER_LOCK)).toBe(false);
  }, 600_000);
});
