import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { buildPushdataCommitment, bytesToHex } from '@solidcash/utils';
import { framedValidator } from 'solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { deployMaster, stateRecordLockingBytecode } from '../../../src/framed/deploy/index.js';
import { participant } from '../../../src/framed/composer/index.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { fundShippedFacets } from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * Calling an entry on a deployed framed contract.
 *
 * The call runs the whole shipped path: compile, deploy through the shipped deployment entry point, classify the
 * live pools and records, plan a `ROOT` frame entered by the caller's own coin, derive it with the shipped
 * composer, evaluate every participant on the BCH-2026 machine, and broadcast the derivation on the deployment's
 * real outpoints. The record's new commitment is what the entry's own body computed, and the test reads it back out
 * of the broadcast transaction.
 *
 * The source's own `require(this.counter <= 10)` is the refusal control: the same call path, driven with an
 * argument the entry rejects, must come back unaccepted and broadcast nothing.
 */

const CATEGORY_HEX = '33'.repeat(31) + 'cc';
const CALLER_TXID = '44'.repeat(32);

// Two entries: the master dispatches by selector, so a user's frame leads with the entry's own selector.
// `bump` writes the record and returns the value it wrote, so the frame settles both its write and its `retval`.
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Counter {'
  + '   int public counter;'
  + '   function bump(int by) returns (int) {'
  + '     this.counter = this.counter + by;'
  + '     require(this.counter <= 10);'
  + '     return this.counter;'
  + '   }'
  + '   function current() view returns (int) { return this.counter; }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const counter = artifacts.Counter!;
const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const CATEGORY = new Uint8Array(Buffer.from(CATEGORY_HEX, 'hex'));
const DEPLOYED_MASTER = deployMaster(counter, CATEGORY, VALIDATOR_PROGRAM);

/** The commitment the shipped encoder materializes for one counter value. */
function commitment(value: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(counter.stateLayout!, { counter: value }, 0), 'hex'));
}

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/** Deploys the contract through the shipped deployment and funds the caller's own coin at its P2PKH lock. */
async function deploy(): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);

  const deployment = await deployStatefulContract(counter, [], {
    provider,
    fundingUtxo,
    funder: funder.unlock.spend(alicePub, signature),
    changeAddress: funder.address,
  });

  // The caller's coin sits at the caller's own P2PKH lock: a root frame binds `msg.sender` to the lock of the
  // input its caller reference names.
  const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: CALLER_TXID, vout: 0, satoshis: 200_000n };
  await provider.addUtxo(binToHex(callerLock), callerUtxo);
  // The composition broadcasts, so its facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(provider);
  return {
    provider,
    categoryId: deployment.categoryId,
    callerUtxo,
    callerLock,
    funder: signature.unlockP2PKH(),
  };
}

let deployedRun: Promise<Deployed> | undefined;

/** The deployment both cases share: the refusal broadcasts nothing, and it refuses whatever the counter holds. */
function sharedDeployment(): Promise<Deployed> {
  deployedRun ??= deploy();
  return deployedRun;
}

/** Calls `bump` with one argument through the shipped call path. */
async function bump(deployed: Deployed, by: bigint): ReturnType<typeof callFramedEntry> {
  return callFramedEntry({
    provider: deployed.provider,
    artifact: counter,
    categoryId: deployed.categoryId,
    functionName: 'bump',
    args: [by],
    callerUtxo: deployed.callerUtxo,
    callerLockingBytecode: deployed.callerLock,
    funder: deployed.funder,
    vm: compositionMachine(),
  });
}

describe('calling an entry on a deployed framed contract', () => {
  it('derives the root frame, accepts every participant and broadcasts the write', async () => {
    const deployed = await sharedDeployment();
    const result = await bump(deployed, 3n);

    // Every participant — the master, the validator and the record — is accepted by the machine.
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.accepted).toBe(true);
    // The root frame is the one the derivation completed.
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(['Counter.bump()']);

    // The entry's own body computed the write: the record ends at the commitment the shipped encoder materializes.
    const written = commitment(3n);
    expect(bytesToHex(result.writtenCommitments[0]!)).toBe(bytesToHex(written));

    // The entry's own answer is the value it returned, read back out of the frame's `retval` and decoded with the
    // shipped decoder: no value the SDK guessed.
    expect(result.values).toStrictEqual([3n]);
    expect(result.value).toBe(3n);

    // The broadcast transaction exists and its outputs recreate the master, the validator and the record.
    const { broadcast } = result;
    expect(broadcast).toBeDefined();
    const recordIndex = participant(result.draft.layout, 'record-0').index;
    const masterIndex = participant(result.draft.layout, 'master').index;
    const validatorIndex = participant(result.draft.layout, 'validator').index;
    expect([...broadcast!.outputs[masterIndex]!.lockingBytecode]).toStrictEqual([...DEPLOYED_MASTER.lockingBytecode]);
    expect(broadcast!.outputs[masterIndex]!.token!.nft!.capability).toBe('minting');
    expect([...broadcast!.outputs[validatorIndex]!.lockingBytecode]).toStrictEqual([...DEPLOYED_MASTER.address]);
    expect(broadcast!.outputs[validatorIndex]!.token!.nft!.capability).toBe('mutable');
    expect([...broadcast!.outputs[recordIndex]!.lockingBytecode])
      .toStrictEqual([...stateRecordLockingBytecode(deployed.categoryId)]);
    // The record's new commitment, read out of the broadcast transaction, is what the entry wrote.
    expect(bytesToHex(broadcast!.outputs[recordIndex]!.token!.nft!.commitment)).toBe(bytesToHex(written));
    // Master, validator, record and the caller's change: one output per participant plus change.
    expect(broadcast!.outputs.length).toBe(result.draft.layout.participantCount + 1);
  });

  it('refuses a call the entry\'s own require rejects, and broadcasts nothing', async () => {
    const shared = await sharedDeployment();
    const callerUtxo = { txid: '44'.repeat(31) + 'c2', vout: 0, satoshis: 200_000n };
    await shared.provider.addUtxo(binToHex(shared.callerLock), callerUtxo);
    // `bump(20)` leaves the counter past the entry's own `require(this.counter <= 10)`.
    const result = await bump({ ...shared, callerUtxo }, 20n);

    expect(result.accepted).toBe(false);
    // The refusing master names the machine's objection rather than being reported as accepted.
    const master = result.verdicts.find((verdict) => verdict.id === 'master');
    expect(master?.accepted).toBe(false);
    expect(master?.objection).toMatch(/OP_VERIFY/);
    // The refusal is attributed to the entry's own frame and source site, not left as a bare opcode failure.
    expect(master?.objection).toContain('Counter.bump()');
    expect(master?.objection).toMatch(/at line \d+/);
    // A refused call has no transaction to broadcast.
    expect(result.broadcast).toBeUndefined();
  });
});
