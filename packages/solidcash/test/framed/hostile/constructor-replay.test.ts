import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import type { Artifact, StateValue } from '@solidcash/utils';
import { compositionMachine, COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { readFramedDeployment, readFramedState } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { alicePkh, alicePriv, bobPkh, bobPriv } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A constructor entered again on a live master.
 *
 * A master dispatches its constructor behind the same head as its entries, because the deployment's genesis probe
 * runs the constructor's own frame. Nothing else kept a later spend out of that arm: with stop sites for
 * `__construct` added to the artifact and the program untouched, the shipped composer built a root frame into it
 * on a live master, every input was accepted, and the constructor ran again for its new caller. The arm now
 * requires input 0 to spend the category's genesis outpoint, which only the genesis spends.
 *
 * Each contract is deployed honestly, which runs the guarded arm in the genesis probe and broadcasts the genesis,
 * and is then replayed by another user through the shipped composer with forged stop sites. The master refuses the
 * replay by the guard's name, nothing is broadcast, and the category's records and nodes keep the genesis state.
 */

const OWNED = 'pragma solidcash ^0.14.0;'
  + ' contract Owned {'
  + '   address public owner;'
  + '   int public n;'
  + '   constructor() { this.owner = msg.sender; }'
  + '   function bump() { require(msg.sender == this.owner); this.n = this.n + 1; }'
  + ' }';

/** A token whose constructor mints to its deployer, the marketplace FakeToken's shape. */
const MINTED = 'pragma solidcash ^0.14.0;'
  + ' contract Minted {'
  + '   mapping(address => int) balances;'
  + '   int public totalSupply;'
  + '   constructor() { this.totalSupply = this.totalSupply + 1000; this.balances[msg.sender] = 1000; }'
  + '   function burn() {'
  + '     require(this.balances[msg.sender] >= 1);'
  + '     this.totalSupply = this.totalSupply - 1;'
  + '     this.balances[msg.sender] = this.balances[msg.sender] - 1;'
  + '   }'
  + ' }';

const GUARD = 'a constructor runs only in its genesis';
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const bobLock = encodeLockingBytecodeP2pkh(bobPkh);

/** The category's state: the decoded first record, and every record's and node's commitment. */
interface Snapshot {
  readonly state: Readonly<Record<string, StateValue>>;
  readonly commitments: readonly string[];
}

interface Replay {
  readonly before: Snapshot;
  readonly after: Snapshot;
  readonly result: FramedCallResult;
}

async function snapshot(provider: MockNetworkProvider, categoryId: string, artifact: Artifact): Promise<Snapshot> {
  const layout = artifact.stateLayout!;
  const deployment = await readFramedDeployment(provider, categoryId, layout);
  const commitments = [...deployment.records, ...deployment.collectionNodes]
    .map((utxo) => utxo.token?.nft?.commitment ?? '').sort();
  return { state: (await readFramedState(provider, categoryId, layout)).byNft[0]!, commitments };
}

/**
 * Deploys `artifact` as Alice, then lets Bob enter `__construct` on the live master.
 *
 * The artifact publishes no stop sites for its constructor, so the replay copies those of `sibling`, an entry that
 * writes the same records. Only the metadata changes; the master program and its lock are the deployed ones.
 */
async function deployAndReplay(artifact: Artifact, sibling: string): Promise<Replay> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const fundingUtxo = { txid: '66'.repeat(32), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(binToHex(aliceLock), fundingUtxo);
  const change = lockingBytecodeToCashAddress({ bytecode: aliceLock, prefix: 'bchtest' }) as { address: string };
  const { categoryId } = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: change.address,
  });
  const before = await snapshot(provider, categoryId, artifact);

  const bobCoin = { txid: '77'.repeat(32), vout: 0, satoshis: 300_000n };
  await provider.addUtxo(binToHex(bobLock), bobCoin);
  await fundShippedFacets(provider);
  const stops = artifact.composition!.stopSites!;
  const copied = stops.entries.find((entry) => entry.functionName === `${artifact.contractName}.${sibling}()`)!;
  const name = `${artifact.contractName}.__construct()`;
  const forged = { ...copied, functionName: name, sites: { ...copied.sites, functionName: name } };
  const patched = {
    ...artifact, composition: { ...artifact.composition!, stopSites: { ...stops, entries: [...stops.entries, forged] } },
  } as Artifact;
  const result = await callFramedEntry({
    provider, artifact: patched, categoryId, functionName: '__construct', args: [],
    callerUtxo: bobCoin, callerLockingBytecode: bobLock, funder: new SignatureTemplate(bobPriv).unlockP2PKH(),
    vm: compositionMachine(),
  });
  return { before, after: await snapshot(provider, categoryId, artifact), result };
}

/**
 * The replay is refused by the master alone, under the guard's name: its validator, records and nodes accept the
 * spend the composer built. Nothing reaches the chain.
 */
function expectRefusedAtMaster({ before, after, result }: Replay): void {
  expect(result.accepted).toBe(false);
  expect(result.broadcast).toBeUndefined();
  expect(result.verdicts.filter((verdict) => !verdict.accepted).map((verdict) => verdict.id)).toStrictEqual(['master']);
  expect(result.verdicts.find((verdict) => verdict.id === 'master')?.objection).toContain(GUARD);
  expect(after).toStrictEqual(before);
}

describe('a constructor replayed on a live master', () => {
  it('keeps the owner the genesis wrote', async () => {
    const owned = compileStringMulti(OWNED, { composition: 'framed' }).Owned!;
    const replay = await deployAndReplay(owned, 'bump');
    // The honest genesis ran the guarded constructor for Alice.
    expect(binToHex(replay.before.state.owner as Uint8Array)).toBe(binToHex(aliceLock));
    expectRefusedAtMaster(replay);
  });

  it('mints only at the genesis', async () => {
    const minted = compileStringMulti(MINTED, { composition: 'framed' }).Minted!;
    const replay = await deployAndReplay(minted, 'burn');
    // The honest genesis minted once, to Alice: the supply, and her node beside the list's head.
    expect(replay.before.state.totalSupply).toBe(1000n);
    expect(replay.before.commitments).toHaveLength(3);
    expectRefusedAtMaster(replay);
  });
});
