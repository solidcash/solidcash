import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment, readFramedState } from '../../../src/framed/deploy/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import {
  encodeFunctionArgument, type ConstructorArgument, type FunctionArgument,
} from '../../../src/Argument.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Two spellings of one mapping key, and a loop that reads a key before writing it, through the shipped call path.
 *
 * `balances[msg.sender]` and `balances[to]` are two entry slots that name one node when `to` is the caller, and so
 * are `totals[a]` and `totals[b]` when `a == b`. The EVM runs both accesses against one slot; a framed frame would
 * declare the node once per spelling. The shipped planner refuses both by name before anything is signed: a batch
 * that writes one slot twice (`planMappingBatch`), and a node read beside a write that spends it
 * (`requireDistinctNodes`). A loop that reads its key before writing it sees, on a later turn, the turn before's
 * write: an invariant key is read once into a local by the entry cache and settles with the EVM's total, and a key
 * the loop repeats from its array is refused by the same batch rule. The distinct spellings settle with the EVM's
 * values beside each refusal, read back from the chain.
 */

const CALLER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
/** Another holder, whose hash bytes are distinct. */
const OTHER_LOCK = encodeLockingBytecodeP2pkh(Uint8Array.from({ length: 20 }, (_, at) => (0x31 + at * 7) & 0xff));

const LEDGER = compileStringMulti('pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   constructor(address owner) { this.balances[owner] = 100; }'
  + '   function transfer(address to, uint amount) { this.balances[msg.sender] -= amount; this.balances[to] += amount; }'
  + ' }', { composition: 'framed' }).Ledger!;

const TALLY = compileStringMulti('pragma solidcash ^0.14.0;'
  + ' contract Tally {'
  + '   uint public count;'
  + '   mapping(uint => uint) totals;'
  + '   function seed(uint k, uint v) { this.totals[k] = v; }'
  + '   function setThenRead(uint a, uint b, uint v) { this.totals[a] = v; this.count = this.totals[b]; }'
  + ' }', { composition: 'framed' }).Tally!;

const BUMPER = compileStringMulti('pragma solidcash ^0.14.0;'
  + ' contract Bumper {'
  + '   mapping(uint => uint) totals;'
  + '   function seed(uint k, uint v) { this.totals[k] = v; }'
  + '   function bump(uint k, uint t) { for (uint i = 0; i < t; i++) { uint n = this.totals[k]; this.totals[k] = n + 1; } }'
  + '   function bumpAll(uint[] ks) { for (uint i = 0; i < ks.length; i++) { uint n = this.totals[ks[i]];'
  + '     this.totals[ks[i]] = n + 1; } }'
  + ' }', { composition: 'framed' }).Bumper!;

/** A 32-byte txid whose bytes are distinct, taken from a counter. */
let coins = 0;
function nextTxid(): string {
  coins += 1;
  return binToHex(Uint8Array.from({ length: 32 }, (_, at) => (coins * 29 + at * 11) & 0xff));
}

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly snapshot: SnapshotRestorer;
}

/** Deploys a contract once through the shipped deployment; each case rewinds the chain to it. */
function deployment(artifact: Artifact, args: readonly ConstructorArgument[]): () => Promise<Deployed> {
  let run: Promise<Deployed> | undefined;
  return async (): Promise<Deployed> => {
    run ??= (async (): Promise<Deployed> => {
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const signature = new SignatureTemplate(alicePriv);
      const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
      const fundingUtxo = { txid: nextTxid(), vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployed = await deployStatefulContract(artifact, [...args], {
        provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
      });
      await fundShippedFacets(provider);
      return { provider, artifact, categoryId: deployed.categoryId, snapshot: await provider.takeSnapshot() };
    })();
    const deployed = await run;
    await deployed.snapshot.restore();
    return deployed;
  };
}

const ledger = deployment(LEDGER, [CALLER_LOCK]);
const tally = deployment(TALLY, []);
const bumper = deployment(BUMPER, []);

/** Calls an entry through the shipped call path from a fresh coin of the caller's. */
async function call(
  deployed: Deployed, functionName: string, args: readonly FunctionArgument[],
): ReturnType<typeof callFramedEntry> {
  const callerUtxo = { txid: nextTxid(), vout: 0, satoshis: 200_000n };
  await deployed.provider.addUtxo(binToHex(CALLER_LOCK), callerUtxo);
  return callFramedEntry({
    provider: deployed.provider, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    args: [...args], callerUtxo, callerLockingBytecode: CALLER_LOCK,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
  });
}

/** Calls an entry and requires every participant accepted and the transaction broadcast. */
async function settle(deployed: Deployed, functionName: string, args: readonly FunctionArgument[]): Promise<void> {
  const result = await call(deployed, functionName, args);
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast).toBeDefined();
}

/** The value each node of a collection holds on chain, keyed by its slot. */
async function nodeValues(deployed: Deployed, collection: string): Promise<Map<string, string>> {
  const live = await readFramedDeployment(deployed.provider, deployed.categoryId, deployed.artifact.stateLayout!);
  return new Map((live.nodesByCollection.get(collection) ?? []).map((utxo) => {
    const decoded = decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment));
    return [bytesToHex(decoded.slot), bytesToHex(decoded.value)];
  }));
}

const slotOf = (key: Uint8Array | bigint, type: 'address' | 'uint256'): string =>
  bytesToHex(keyToSlotMulti([encodeFunctionArgument(key, type) as Uint8Array]));
const valueOf = (amount: bigint): string => bytesToHex(encodeFunctionArgument(amount, 'uint256') as Uint8Array);

describe('two spellings of one mapping key in one framed body', () => {
  it('refuses by name a transfer to the sender itself, which writes one node twice', async () => {
    const deployed = await ledger();
    await expect(call(deployed, 'transfer', [CALLER_LOCK, 10n]))
      .rejects.toThrow(/FRAMED_MAPPING_UNPLANNABLE: a sorted batch writes slot [0-9a-f]{64} more than once/);
    expect((await nodeValues(deployed, 'balances')).get(slotOf(CALLER_LOCK, 'address'))).toBe(valueOf(100n));
  });

  it('settles a transfer to another holder with the balances the EVM leaves', async () => {
    const deployed = await ledger();
    await settle(deployed, 'transfer', [OTHER_LOCK, 10n]);
    const held = await nodeValues(deployed, 'balances');
    expect(held.get(slotOf(CALLER_LOCK, 'address'))).toBe(valueOf(90n));
    expect(held.get(slotOf(OTHER_LOCK, 'address'))).toBe(valueOf(10n));
  });

  it('refuses by name a read of the key its write just spent, under another name', async () => {
    const deployed = await tally();
    await settle(deployed, 'seed', [7n, 3n]);
    await expect(call(deployed, 'setThenRead', [7n, 7n, 11n]))
      .rejects.toThrow(/reads a key at a mapping node it also spends for another key, which a call cannot spend twice/);
    expect((await nodeValues(deployed, 'totals')).get(slotOf(7n, 'uint256'))).toBe(valueOf(3n));
  });

  it('settles a read of another key beside the write with the value the EVM reads', async () => {
    // Both keys are held, so the write rewrites its own node rather than relinking the one the read declares.
    const deployed = await tally();
    await settle(deployed, 'seed', [7n, 3n]);
    await settle(deployed, 'seed', [9n, 4n]);
    await settle(deployed, 'setThenRead', [7n, 9n, 11n]);
    expect((await nodeValues(deployed, 'totals')).get(slotOf(7n, 'uint256'))).toBe(valueOf(11n));
    const state = await readFramedState(deployed.provider, deployed.categoryId, TALLY.stateLayout!);
    expect(state.byNft[0]).toMatchObject({ count: 4n });
  });
});

describe('a loop that reads its key before writing it', () => {
  it('settles an invariant key with the total the EVM reaches, each turn reading the turn before\'s write', async () => {
    const deployed = await bumper();
    await settle(deployed, 'seed', [7n, 3n]);
    await settle(deployed, 'bump', [7n, 2n]);
    expect((await nodeValues(deployed, 'totals')).get(slotOf(7n, 'uint256'))).toBe(valueOf(5n));
  });

  it('refuses by name a key the loop repeats from its array, and settles one turn', async () => {
    const deployed = await bumper();
    await settle(deployed, 'seed', [7n, 3n]);
    await expect(call(deployed, 'bumpAll', [[7n, 7n]]))
      .rejects.toThrow(/FRAMED_MAPPING_UNPLANNABLE: a sorted batch writes slot [0-9a-f]{64} more than once/);
    expect((await nodeValues(deployed, 'totals')).get(slotOf(7n, 'uint256'))).toBe(valueOf(3n));
    await settle(deployed, 'bumpAll', [[7n]]);
    expect((await nodeValues(deployed, 'totals')).get(slotOf(7n, 'uint256'))).toBe(valueOf(4n));
  });
});
