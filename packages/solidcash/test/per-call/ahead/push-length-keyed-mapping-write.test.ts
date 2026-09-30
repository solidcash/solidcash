import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  buildProxyArtifact, callPerCallProxyEntry, deployPerCallProxy,
} from '../../../src/per-call/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Walls ahead: an entry that keys a mapping write by the length its own push produced, through the shipped hop.
 *
 * The body appends to a dynamic array, reads the length that append produced, and writes a mapping at that key
 * from inside an internal function - the shape a Solidity port writes when a pusher hands the new element's index
 * to a helper that registers it. The plan has to state the same segment the body writes: the run the append grows,
 * the mapping target's own records, and the order they sit in. Where it does not, the body's read of its declared
 * record at the ordinal it computed lands past the segment's declared records and the read fails an `OP_VERIFY`
 * with no source line, which is how this wall reports.
 *
 * Pinned where HEAD stands: with the mapping write in place the hop refuses -
 * `frame "implementation-master" of Impl.append() at line 1: no source message (Program failed an OP_VERIFY
 * operation.)` - while the same entry with the mapping write removed settles and broadcasts. The two runs differ
 * in nothing else, so the mapping target it adds is what the hop lays short. Ruled out while narrowing it: the
 * shared-span outliner (the refusal is identical with `SOLIDCASH_NO_OUTLINE=1`), a key the plan cannot resolve
 * (resolution against the live state, and against the length the frame's own write produces, refuse the same way),
 * and an insert accounted as an update (seeding the key it writes changes nothing).
 *
 * The class this belongs to is the fixture's `publishJobPost`, which appends to its job array, reads the index it
 * produced, and writes its allowlist mapping from inside `_updateJobWhitelist`.
 */
const SHAPE = (mappingWrite: string): string => 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   struct Post { string title; uint amount; address who; string note; }'
  + '   address public implementation;'
  + '   Post[] public posts;'
  + '   mapping(uint256 => mapping(address => bool)) public allowlists;'
  + '   function initialize() { require(true); }'
  + '   function setAllowed(uint id, address[] who) internal {'
  + '     for (uint i = 0; i < who.length; i = i + 1) { this.allowlists[id][who[i]] = true; }'
  + '   }'
  + '   function append(string title, uint amount, string note, address[] allowed) {'
  + '     this.posts.push();'
  + '     uint id = this.posts.length - 1;'
  + '     this.posts[id].title = title;'
  + '     this.posts[id].amount = amount;'
  + '     this.posts[id].who = msg.sender;'
  + '     this.posts[id].note = note;'
  + `     ${mappingWrite}`
  + '   }'
  + ' }';

const KEYED_BY_THE_PUSH = SHAPE('setAllowed(id, allowed);');
const WITHOUT_THE_WRITE = SHAPE('require(allowed.length >= 0);');

/**
 * Each case funds from its own outpoints.
 *
 * A genesis-outpoint reservation is process-local and keyed by the outpoint, and a spend is keyed by it too, so
 * two cases sharing one txid would see the second one's coins as already spent.
 */
function coins(seed: string): {
  readonly implementation: { txid: string; vout: number; satoshis: bigint };
  readonly proxy: { txid: string; vout: number; satoshis: bigint };
  readonly caller: { txid: string; vout: number; satoshis: bigint };
  /** The coin the later call spends: the deployment's own hop already spends `caller`. */
  readonly call: { txid: string; vout: number; satoshis: bigint };
} {
  return {
    implementation: { txid: `${seed}1`.repeat(32).slice(0, 64), vout: 0, satoshis: 500_000n },
    proxy: { txid: `${seed}2`.repeat(32).slice(0, 64), vout: 0, satoshis: 500_000n },
    caller: { txid: `${seed}3`.repeat(32).slice(0, 64), vout: 0, satoshis: 100_000n },
    call: { txid: `${seed}4`.repeat(32).slice(0, 64), vout: 0, satoshis: 100_000n },
  };
}

interface World {
  readonly network: MockNetworkProvider;
  readonly signature: SignatureTemplate;
  readonly funder: ReturnType<Contract['unlock']['spend']>;
  readonly deployerLock: Uint8Array;
  readonly changeAddress: string;
}

async function wired(seed: string): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const funded = coins(seed);
  await network.addUtxo(funder.address, funded.implementation);
  await network.addUtxo(funder.address, funded.proxy);
  await network.addUtxo(binToHex(deployerLock), funded.caller);
  await network.addUtxo(binToHex(deployerLock), funded.call);
  await fundShippedFacets(network);
  return { network, signature, funder: funder.unlock.spend(alicePub, signature), deployerLock, changeAddress: funder.address };
}

/** Deploys `source` behind its own proxy and then calls `append` once through it. */
async function appendThroughTheProxy(
  source: string, seed: string,
): Promise<{ readonly accepted: boolean; readonly objection?: string }> {
  const wire = await wired(seed);
  const funded = coins(seed);
  const artifacts = compileStringMulti(source, { composition: 'per-call' });
  const deployment = await deployPerCallProxy({
    provider: wire.network,
    implementationArtifact: artifacts.Impl!,
    implementationDeploy: {
      fundingUtxo: funded.implementation, funder: wire.funder, changeAddress: wire.changeAddress,
    },
    proxyDeploy: {
      fundingUtxo: funded.proxy, funder: wire.funder, changeAddress: wire.changeAddress,
    },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: wire.deployerLock,
    callerFunding: { utxo: funded.caller, funder: wire.signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.accepted).toBe(true);

  const title = 'a title long enough that the element crosses the chunk boundary '.padEnd(72, 'x');
  const note = 'a note long enough that the element crosses the chunk boundary '.padEnd(72, 'y');
  try {
    const result = await callPerCallProxyEntry({
      provider: wire.network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'append',
      args: [title, 7n, note, [wire.deployerLock]] as never,
      callerUtxo: funded.call,
      callerLockingBytecode: wire.deployerLock,
      funder: wire.signature.unlockP2PKH(),
      changeAddress: wire.changeAddress,
      vm: compositionMachine(),
    });
    return { accepted: result.accepted, ...(result.accepted ? {} : { objection: 'refused without an objection' }) };
  } catch (error) {
    return { accepted: false, objection: (error as Error).message };
  }
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('ahead: a mapping write keyed by the frame\'s own push', () => {
  it('settles the same entry with the mapping write removed', async () => {
    const outcome = await appendThroughTheProxy(WITHOUT_THE_WRITE, '1');
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('refuses the entry that keys the mapping write by the push', async () => {
    const outcome = await appendThroughTheProxy(KEYED_BY_THE_PUSH, '9');
    expect(outcome.accepted).toBe(false);
    // The declaration the hop laid is short of the record the body's own ordinal names, so the read fails on an
    // `OP_VERIFY` the source map attributes to no line.
    expect(outcome.objection).toMatch(/did not settle through the proxy: frame "implementation-master" of /);
    expect(outcome.objection).toMatch(/no source message \(Program failed an OP_VERIFY operation\.\)/);
  }, 300_000);
});
