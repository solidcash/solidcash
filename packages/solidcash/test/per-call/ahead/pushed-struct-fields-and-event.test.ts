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
 * Measured: the append, its field writes and the event **settle** through the shipped hop, on the mock network
 * (45 s for the pair). So the title's refusal is not the append by itself. Adding the entry's guarded write -
 * `if (allowedWorkers.length > 0) { ... }`, which the title's call does not take - refuses, and that case is this
 * file's wall: it is the same source as the settling one plus one slot, so the two cases together say which
 * declaration the entry's own code names and the plan does not.
 *
 * The file holds both boundaries: a wide struct push with every field written and one payload event is served, so a
 * change that stops serving it is a regression; and the guarded write is refused at the entry's own declared-record
 * walk, with the operands measured beside the case below.
 */
const SOURCE = (fields: string, event: string, tail = ''): string => 'pragma solidcash ^0.13.0;'
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
  + '   mapping(uint256 => mapping(address => bool)) public allowlists;'
  + '   event PostEvent(uint indexed id, EventData data);'
  + '   function initialize() { require(true); }'
  + '   function setAllowed(uint id, address[] who) internal {'
  + '     for (uint i = 0; i < who.length; i = i + 1) { this.allowlists[id][who[i]] = true; }'
  + '   }'
  + '   function publish(string title, bytes32 contentHash, bool multipleApplicants, string[] tags, address token,'
  + '                    uint amount, uint32 maxTime, string deliveryMethod, address arbitrator,'
  + '                    address[] allowedWorkers) {'
  + '     require(amount > 0, "amount");'
  + '     this.posts.push();'
  + '     uint id = this.posts.length - 1;'
  + fields
  + event
  + tail
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
/**
 * The same entry with the guarded write the fixture's own entry holds, called with an empty worker list.
 *
 * `if (allowedWorkers.length > 0)` is false for the call under test, so the loop's turns never run. The ladder's
 * first red title is this shape: it appends its element and then writes a worker mapping through a call its own
 * arguments make false. Measured, in seconds rather than in the title's twenty minutes:
 *
 *   frame "implementation-master" of Impl.publish() at line 1: no source message
 *   (Program failed an OP_VERIFY operation.)
 *
 * The failing instruction is the declared-record ordinal walk's `ordinal < count` check (`OP_SWAP OP_1 OP_PICK
 * OP_3 OP_PICK OP_LESSTHAN OP_VERIFY` in the outlined helper that carries it). Measured at that check: the count
 * the segment declares is 3 - the plan is `[[3, 3], [65535, 5], [65535, 6]]`, the frame's own record and two
 * records the transaction creates - and the ordinal the body computed is 3, one past the segment's last record.
 *
 * The offset that produces it is slot arithmetic: the body names a created record by the coordinate the loop
 * computed, and that coordinate is the frame's record base plus the slot's own offset, which counts
 * `dataNftCount + 1 + every earlier entry slot the frame does not batch`. The guarded write adds an entry slot
 * (and its loop's trailing records) to the body's layout, so every record after it moves up two positions, while
 * the plan declares nothing for a loop that takes no turns. The same source without the guarded write settles,
 * which is what makes this two positions and not the append itself.
 */
const GUARDED_WRITE_SKIPPED = SOURCE(FIELD_WRITES, '',
  '     if (allowedWorkers.length > 0) { setAllowed(id, allowedWorkers); }');

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
        [] as never,
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

  it('refuses them while the entry holds the guarded write the call does not take', async () => {
    const outcome = await post(GUARDED_WRITE_SKIPPED, '5');
    expect(outcome.accepted).toBe(false);
    // The entry's own declared-record walk names a record its segment does not declare.
    expect(outcome.objection).toMatch(/did not settle through the proxy: frame "implementation-master" of /);
    expect(outcome.objection).toMatch(/no source message \(Program failed an OP_VERIFY operation\.\)/);
  }, 300_000);
});
