import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { bytesToHex, decodePushdataValue } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { callFramedProxyEntry, deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
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
 * Where the wall stood: with the mapping write in place the hop refused -
 * `frame "implementation-master" of Impl.append() at line 1: no source message (Program failed an OP_VERIFY
 * operation.)` - while the same entry with the mapping write removed settled and broadcast. The two runs differ
 * in nothing else, so the mapping target it adds was what the hop laid short. The key was the cause: the body
 * counts the loop's key from the length its own push produced, and the plan counted it from the length the
 * deployment held, so the declared node was the one the previous index names. The hop now states the elements the
 * entry's own append adds (`stateLengthDeltas`), exactly as the direct path already did for its upsert loops, and
 * both cases below settle and broadcast.
 *
 * Where it refuses, measured: the frame's program is the routed entry body (2325 instructions, `ip` indexes it),
 * and the failing instruction is the input pin the loop's per-turn step emits to close substitution:
 * `OP_DUP OP_UTXOBYTECODE` then the entry address, then `OP_EQUALVERIFY`, followed by `OP_DUP OP_UTXOTOKENCATEGORY`,
 * i.e. a check that both the locking bytecode and the category of an input equal values the frame holds. The pin's
 * expected address now comes from the tracked entry address by its stable bottom ordinal (as the sorted-iteration
 * entry commitment does); before that it was a hand-counted top-relative pick, and the value it reached was not
 * that address at all.
 *
 * What the pin compares, measured: the hop's plan for this entry declares its own state record at input and output
 * 3 and four records the transaction creates at outputs 5..8 - `[[3, 3], [65535, 5], [65535, 6], [65535, 7],
 * [65535, 8]]` - and nothing that holds a node of the written collection. The body names its turn's node at the
 * frame's declared record-input base plus the slot's own offset, which resolves to input 4, the index the plan gave
 * the implementation master itself; the address it pins is the collection's entry covenant under the category the
 * running covenant carries (`aa2028d7...` in the run that measured this), while input 4 holds that master
 * (`aa20ba57...`). So the refusal is the plan declaring no input where the body's loop reads its turn's node - the
 * collection this deployment holds no node of, which the hop serves for a batch write by minting the empty head and
 * has no such arm for in a run-time loop.
 *
 * The same write over a collection the deployment already holds a node of is the update arm: the initializer writes
 * one key, and the call rewrites it in place rather than splicing through the empty head.
 *
 * Ruled out while narrowing it: the shared-span outliner (the refusal was identical under
 * `SOLIDCASH_NO_OUTLINE=1`), a key the plan cannot resolve (resolving against the live state, and against the
 * length the frame's own write produces through the `stateLengthDeltas` the direct path passes, refused the same
 * way) and an insert accounted as an update (seeding the key it writes changed nothing).
 *
 * The class this belongs to is the fixture's `publishJobPost`, which appends to its job array, reads the index it
 * produced, and writes its allowlist mapping from inside `_updateJobWhitelist`.
 */
const SHAPE = (mappingWrite: string, initialize = 'require(true);'): string => 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Post { string title; uint amount; address who; string note; }'
  + '   address public implementation;'
  + '   Post[] public posts;'
  + '   mapping(uint256 => mapping(address => bool)) public allowlists;'
  + `   function initialize() { ${initialize} }`
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
/**
 * The same entry, over a collection the deployment already holds a node of.
 *
 * The deployment's own entry writes one key of the mapping, which is what puts a node of it in the state the hop
 * plans against. The loop's first turn then splices over a node the transaction spends rather than one it creates.
 */
const OVER_AN_EXISTING_NODE = SHAPE('setAllowed(id, allowed);', 'this.allowlists[0][msg.sender] = true;');

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
  return {
    network, signature, funder: funder.unlock.spend(alicePub, signature), deployerLock, changeAddress: funder.address,
  };
}

/** Deploys `source` behind its own proxy and then calls `append` once through it. */
async function appendThroughTheProxy(
  source: string, seed: string,
): Promise<{
    readonly accepted: boolean;
    readonly objection?: string;
    /** The slot each record the entry's own write creates carries, in the settled transaction. */
    readonly createdSlots: readonly string[];
    /** Each node of the written collection the settled transaction outputs, by the slot it carries. */
    readonly nodeValues: ReadonlyMap<string, Uint8Array>;
    readonly broadcastTxid?: string;
  }> {
  const wire = await wired(seed);
  const funded = coins(seed);
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  const deployment = await deployFramedProxy({
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
    const result = await callFramedProxyEntry({
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
    return {
      accepted: result.accepted,
      createdSlots: result.draft.trailingOutputs.flatMap((output) => {
        const commitment = result.transaction.outputs[output.index]?.token?.nft?.commitment;
        return commitment === undefined ? [] : [bytesToHex(decodeEntryCommitment(commitment).slot)];
      }),
      nodeValues: new Map(result.draft.layout.participants
        .filter((placed) => placed.id.startsWith('mapping-node-'))
        .flatMap((placed) => {
          const commitment = result.transaction.outputs[placed.index]?.token?.nft?.commitment;
          if (commitment === undefined) return [];
          const node = decodeEntryCommitment(commitment);
          return [[bytesToHex(node.slot), node.value] as [string, Uint8Array]];
        })),
      ...(result.broadcast === undefined ? {} : { broadcastTxid: result.broadcast.txid }),
    };
  } catch (error) {
    return { accepted: false, objection: (error as Error).message, createdSlots: [], nodeValues: new Map() };
  }
}

describe.runIf(process.env.FRAMED_AHEAD === '1')('ahead: a mapping write keyed by the frame\'s own push', () => {
  it('settles the entry that keys the mapping write by the push', async () => {
    const outcome = await appendThroughTheProxy(KEYED_BY_THE_PUSH, '9');
    expect(outcome.accepted, outcome.objection).toBe(true);
    expect(outcome.broadcastTxid).toBeDefined();
    // The loop's key is the index the append produced (the first post, index 0), so the record the entry's write
    // creates carries that key's slot beside the caller's own address.
    const key = keyToSlotMulti([bigIntToVmNumber(0n), encodeLockingBytecodeP2pkh(alicePkh)]);
    expect(outcome.createdSlots).toContain(bytesToHex(key));
  }, 300_000);

  it('rewrites the node in place when the collection already holds the key', async () => {
    const outcome = await appendThroughTheProxy(OVER_AN_EXISTING_NODE, '5');
    expect(outcome.accepted, outcome.objection).toBe(true);
    expect(outcome.broadcastTxid).toBeDefined();
    // The initializer wrote this key, so the loop's turn splices through a node the transaction spends and
    // recreates in place rather than creating one.
    const key = bytesToHex(keyToSlotMulti([bigIntToVmNumber(0n), encodeLockingBytecodeP2pkh(alicePkh)]));
    expect(outcome.createdSlots).not.toContain(key);
    // The recreated node carries the value the loop's turn stored, read back through the shipped decoder.
    const tail = outcome.nodeValues.get(key);
    expect(tail).toBeDefined();
    expect(decodePushdataValue(tail!, 0, 'bool').value).toBe(true);
  }, 300_000);
});
