import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { callPerCallProxyEntry, deployPerCallProxy } from '../../../src/per-call/proxy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The entry a red ladder title calls, reduced to the part of it that call reaches, and what the reduction measured.
 *
 * The title posts a job with an empty worker list, so its entry appends one element to a dynamic array of structs
 * and fills every field of it - a string, an array of strings, a hash, three integers, two addresses and two flags -
 * then emits an event whose payload concatenates most of those fields. The mapping write the entry also holds is
 * behind `allowedWorkers_.length > 0` and is not reached by that call, so no loop is under test here.
 *
 * Measured: this shape **settles** through the shipped hop, on the mock network, with and without the event (45 s
 * for both). So the ladder title's refusal - the frame's own `OP_VERIFY`, with the run it declares for the appended
 * array reported as 2 chunks - is not the append, its field writes or the event by themselves; it is in what the
 * real entry does beside them, which is the calls it makes in the same frame (`ERC20.transferFrom`, the data
 * contract's `userRegistered`) around the append and the mapping write it never reaches.
 *
 * The file is kept because it holds that boundary: a wide struct push with every field written and one payload
 * event is served, so a future change that stops serving it is a regression rather than a narrowing of the wall.
 */
const TAGS = (): string => 'string[] public tagPool;';
const SOURCE = (fields: string, event: string): string => 'pragma solidcash ^0.13.0;'
  + ' contract Impl {'
  + '   struct EventData { uint8 type_; bytes who; bytes data_; uint32 timestamp_; }'
  + '   struct Post {'
  + '     uint8 state;'
  + '     bool whitelistWorkers;'
  + '     address creator;'
  + '     string title;'
  + '     string[] tags;'
  + '     bytes32 contentHash;'
  + '     bool multipleApplicants;'
  + '     address token;'
  + '     uint amount;'
  + '     uint32 timestamp;'
  + '     uint32 maxTime;'
  + '     string deliveryMethod;'
  + '     address arbitrator;'
  + '   }'
  + '   address public implementation;'
  + '   Post[] public posts;'
  + '   event PostEvent(uint indexed id, EventData data);'
  + '   function initialize() { require(true); }'
  + '   function publish(string title, bytes32 contentHash, bool multipleApplicants, string[] tags, address token,'
  + '                    uint amount, uint32 maxTime, string deliveryMethod, address arbitrator) {'
  + '     require(amount > 0, "amount");'
  + '     this.posts.push();'
  + '     uint id = this.posts.length - 1;'
  + fields
  + event
  + '   }'
  + ' }';

const FIELD_WRITES = '     this.posts[id].whitelistWorkers = false;'
  + '     this.posts[id].creator = msg.sender;'
  + '     this.posts[id].title = title;'
  + '     this.posts[id].tags = tags;'
  + '     this.posts[id].contentHash = contentHash;'
  + '     this.posts[id].multipleApplicants = multipleApplicants;'
  + '     this.posts[id].token = token;'
  + '     this.posts[id].amount = amount;'
  + '     this.posts[id].timestamp = uint32(1700000000);'
  + '     this.posts[id].maxTime = maxTime;'
  + '     this.posts[id].deliveryMethod = deliveryMethod;'
  + '     this.posts[id].arbitrator = arbitrator;';

const EVENT = '     emit PostEvent(id, EventData({ type_: uint8(1), who: abi.encodePacked(msg.sender),'
  + '       data_: bytes.concat(abi.encodePacked(contentHash), abi.encodePacked(multipleApplicants),'
  + '         abi.encodePacked(token), abi.encodePacked(amount), abi.encodePacked(maxTime),'
  + '         abi.encodePacked(arbitrator)), timestamp_: uint32(1700000000) }));';

const WITH_THE_EVENT = SOURCE(FIELD_WRITES, EVENT);
const WITHOUT_THE_EVENT = SOURCE(FIELD_WRITES, '');

interface Funding {
  readonly implementation: { txid: string; vout: number; satoshis: bigint };
  readonly proxy: { txid: string; vout: number; satoshis: bigint };
  readonly caller: { txid: string; vout: number; satoshis: bigint };
  readonly call: { txid: string; vout: number; satoshis: bigint };
}

function coins(seed: string): Funding {
  return {
    implementation: { txid: `${seed}1`.repeat(32).slice(0, 64), vout: 0, satoshis: 800_000n },
    proxy: { txid: `${seed}2`.repeat(32).slice(0, 64), vout: 0, satoshis: 800_000n },
    caller: { txid: `${seed}3`.repeat(32).slice(0, 64), vout: 0, satoshis: 200_000n },
    call: { txid: `${seed}4`.repeat(32).slice(0, 64), vout: 0, satoshis: 200_000n },
  };
}

async function post(source: string, seed: string): Promise<{ accepted: boolean; objection?: string }> {
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

  const artifacts = compileStringMulti(source, { composition: 'per-call' });
  const deployment = await deployPerCallProxy({
    provider: network,
    implementationArtifact: artifacts.Impl!,
    implementationDeploy: {
      fundingUtxo: funded.implementation, funder: funder.unlock.spend(alicePub, signature),
      changeAddress: funder.address,
    },
    proxyDeploy: {
      fundingUtxo: funded.proxy, funder: funder.unlock.spend(alicePub, signature),
      changeAddress: funder.address,
    },
    initialize: { functionName: 'initialize', args: [] },
    callerLockingBytecode: deployerLock,
    callerFunding: { utxo: funded.caller, funder: signature.unlockP2PKH() },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.accepted).toBe(true);

  try {
    const result = await callPerCallProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'publish',
      args: [
        'Create a marketplace in solidity',
        hexToBin('a0b16ada95e7d6bd78efb91c368a3bd6d3b0f6b77cd3f27664475522ee138ae5'),
        false,
        ['DV'],
        deployerLock,
        1_000_000n,
        120n,
        'digital',
        new Uint8Array(0),
      ] as never,
      callerUtxo: funded.call,
      callerLockingBytecode: deployerLock,
      funder: signature.unlockP2PKH(),
      changeAddress: funder.address,
      vm: compositionMachine(),
    });
    return { accepted: result.accepted, ...(result.accepted ? {} : { objection: 'refused without an objection' }) };
  } catch (error) {
    return { accepted: false, objection: (error as Error).message };
  }
}

describe.runIf(process.env.PER_CALL_AHEAD === '1')('the entry that appends a struct and emits its event', () => {
  it('settles the append and its field writes', async () => {
    const outcome = await post(WITHOUT_THE_EVENT, '1');
    expect(outcome.accepted, outcome.objection).toBe(true);
  }, 300_000);

  it('settles them with one payload event', async () => {
    const outcome = await post(WITH_THE_EVENT, '9');
    expect(outcome.accepted, outcome.objection).toBe(true);
  }, 300_000);
});
