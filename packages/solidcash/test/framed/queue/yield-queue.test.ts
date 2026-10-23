import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { FrameKind, hexToBytes } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import { SignatureTemplate, TransactionBuilder } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import { libauthOutputToSolidCashOutput } from '../../../src/utils.js';
import {
  createComposedDerivationHost, deriveComposition, participant,
  type CompositionDraft, type CompositionDraftPlan, type DraftSourceOutput,
} from '../../../src/framed/composer/index.js';
import {
  CompositionQueue, type QueuedSend, type SendResources,
} from '../../../src/framed/queue/index.js';
import { alicePriv } from '../../fixture/vars.js';
import { compileAndDeploy, entryName, master, type DeployedContract } from '../shapes/harness.js';

/**
 * The queue that serializes sends whose compositions could touch the same resources.
 *
 * Each case drives the shipped path — real sources through `compileStringMulti` with the framed option, the
 * shipped deployment, the shipped composer and derivation — and then broadcasts the derived transaction through a
 * `MockNetworkProvider` with the outpoints the masters actually sit on plus a change output for the relay fee, the
 * way the proxy initialization is broadcast. The queue decides which sends may run at once; the provider's UTXO
 * view is what says whether the state the sends produced is the one the next send was built against.
 */

/** The entry every case calls. */
const ENTRY = 'ping';

/** Two contracts, so a send on one is disjoint from a send on the other. */
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Alpha { function ping() { require(true); } }'
  + ' contract Beta { function ping() { require(true); } }';

const MASTER_A = 'alpha-master';
const MASTER_B = 'beta-master';

/** The root frame's caller signs with `SIGHASH_ALL | SIGHASH_UTXOS`, which this lock and signer agree on. */
const SIGNER = new SignatureTemplate(alicePriv);
const USER_UNLOCKER = SIGNER.unlockP2PKH();
const USER_LOCK = USER_UNLOCKER.generateLockingBytecode();

/** The value a master sits at, and the value each funding input carries. */
const MASTER_VALUE = 20_000n;
const FUNDING_VALUE = 100_000n;

/** One send as it landed: the plan it composed, the sources it spent, and the provider's receipt. */
interface SendResult {
  readonly txid: string;
  readonly plan: CompositionDraftPlan;
  readonly draft: CompositionDraft;
  /** The outpoints the send actually spent, the master first and the funding input second. */
  readonly sources: readonly Utxo[];
  /** The master's source output, with the outpoint it sat on. */
  readonly master: Utxo;
}

interface Fixture {
  readonly provider: MockNetworkProvider;
  readonly artifacts: ReturnType<typeof compileAndDeploy>['artifacts'];
  readonly contracts: Readonly<Record<string, DeployedContract>>;
}

/** Compiles and deploys the two contracts, funding each master and one input per send. */
async function fixture(masterTxids: Readonly<Record<string, string>>, fundingTxids: readonly string[]): Promise<Fixture> {
  const { artifacts, contracts } = compileAndDeploy(SOURCE, { Alpha: 'yield queue alpha', Beta: 'yield queue beta' });
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  for (const [name, masterTxid] of Object.entries(masterTxids)) {
    const contract = contracts[name]!;
    await provider.addUtxo(binToHex(contract.lockingBytecode), {
      txid: masterTxid,
      vout: 0,
      satoshis: MASTER_VALUE,
      token: { category: binToHex(contract.category), amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  for (const fundingTxid of fundingTxids) {
    await provider.addUtxo(binToHex(USER_LOCK), { txid: fundingTxid, vout: 0, satoshis: FUNDING_VALUE });
  }
  return { provider, artifacts, contracts };
}

/** The one live master UTXO of a contract, refusing when the contract has none. */
async function liveMaster(provider: MockNetworkProvider, contract: DeployedContract): Promise<Utxo> {
  const utxos = await provider.getUtxosForLockingBytecode(contract.lockingBytecode);
  const first = utxos[0];
  if (first === undefined) throw new Error(`no live master UTXO for "${contract.name}"`);
  return first;
}

/** A master's source output as the one the live UTXO describes. */
function sourceFromUtxo(contract: DeployedContract, utxo: Utxo): DraftSourceOutput {
  const token = utxo.token;
  if (token?.nft === undefined) throw new Error(`the master UTXO of "${contract.name}" carries no NFT`);
  return {
    lockingBytecode: contract.lockingBytecode,
    valueSatoshis: utxo.satoshis,
    token: {
      category: hexToBytes(token.category),
      amount: token.amount,
      nft: { capability: token.nft.capability, commitment: hexToBytes(token.nft.commitment) },
    },
  };
}

/** The plan one send composes: one master entered by a signed user, no records. */
function planFor(
  built: Fixture,
  contractName: string,
  contract: DeployedContract,
  masterId: string,
  masterUtxo: Utxo,
): CompositionDraftPlan {
  return {
    blocks: [{ contract: contractName, masters: [masterId], state: [] }],
    userInputs: [{ id: 'user', index: 1 }],
    masters: [master({
      master: masterId,
      contract: contractName,
      entry: ENTRY,
      program: contract.program,
      facts: {
        contract: contractName,
        functionName: entryName(contractName, ENTRY),
        kind: FrameKind.ROOT,
        callerIsUser: true,
        originEqualsCaller: true,
        makesExternalCall: false,
        mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: contract.address, value: 0n },
      enteredBy: 'user',
      origin: 'user',
    })],
    inputs: {
      [masterId]: { source: sourceFromUtxo(contract, masterUtxo) },
      user: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: FUNDING_VALUE },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
  };
}

/** Builds and broadcasts a composed plan: the master on its live outpoint, a signed input, and BCH change. */
async function broadcast(
  built: Fixture,
  contractName: string,
  contract: DeployedContract,
  masterId: string,
  funding: Utxo,
  plan: CompositionDraftPlan,
): Promise<SendResult> {
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [built.artifacts[contractName]!], plan,
  });
  deriveComposition([
    { contract: contractName, functionName: entryName(contractName, ENTRY), kind: FrameKind.ROOT, master: masterId },
  ], host);

  const program = draft.programFor(masterId);
  const masterIndex = participant(draft.layout, masterId).index;
  const masterSource = program.sourceOutputs[masterIndex]!;
  const masterUtxo = await liveMaster(built.provider, contract);
  const masterUnlocker: Unlocker = {
    generateLockingBytecode: () => masterSource.lockingBytecode,
    generateUnlockingBytecode: () => program.transaction.inputs[masterIndex]!.unlockingBytecode,
  };

  const builder = new TransactionBuilder({ provider: built.provider, skipAutomaticCoSpends: true });
  builder.setLocktime(program.transaction.locktime ?? 0);
  const sequence = program.transaction.inputs[masterIndex]?.sequenceNumber;
  builder.addInput(masterUtxo, masterUnlocker, sequence === undefined ? undefined : { sequence });
  builder.addInput(funding, USER_UNLOCKER);

  // Every participant recreates in place; the funder's recreation is replaced by change, which pays the fee.
  const settled = draft.layout.participantCount + draft.trailingOutputs.length;
  for (const output of program.transaction.outputs.slice(0, settled)) {
    builder.addOutput(libauthOutputToSolidCashOutput(output));
  }
  builder.addBchChangeOutputIfNeeded({ to: USER_LOCK, feeRate: 1 });

  const transaction = builder.buildLibauthTransaction();
  const rawBytes = encodeTransaction(transaction);
  const rawHex = binToHex(rawBytes);
  const txid = await built.provider.sendPreparedTransaction({ rawHex, rawBytes, transaction });
  return { txid, plan, draft, master: masterUtxo, sources: [masterUtxo, funding] };
}

/** A send that reads the live master when its turn comes, then builds and broadcasts against it. */
function sendFor(
  built: Fixture,
  contractName: string,
  masterId: string,
  fundingTxid: string,
): QueuedSend<SendResult> {
  const contract = built.contracts[contractName]!;
  const resources: SendResources = [masterId];
  const funding: Utxo = { txid: fundingTxid, vout: 0, satoshis: FUNDING_VALUE };
  return {
    resources,
    plan: async () => planFor(built, contractName, contract, masterId, await liveMaster(built.provider, contract)),
    run: (plan) => broadcast(built, contractName, contract, masterId, funding, plan),
  };
}

describe('a queue of sends whose compositions share resources', () => {
  it('serializes two sends launched from the same live master so the second spends the first\'s output', async () => {
    const f = await fixture({ Alpha: 'a1'.repeat(31) + '5e' }, ['b1'.repeat(31) + '4e', 'b2'.repeat(31) + '4d']);
    const contract = f.contracts.Alpha!;
    const registered = await liveMaster(f.provider, contract);
    const queue = new CompositionQueue();

    // Enqueued before the first is awaited: the second must not be built from the same master outpoint.
    const first = queue.enqueue(sendFor(f, 'Alpha', MASTER_A, 'b1'.repeat(31) + '4e'));
    const second = queue.enqueue(sendFor(f, 'Alpha', MASTER_A, 'b2'.repeat(31) + '4d'));
    const [one, two] = await Promise.all([first, second]);

    // The first spent the registered master; the second spent the output the first created for it.
    expect(one.master).toStrictEqual(registered);
    expect(two.master.txid).toBe(one.txid);
    expect(two.master.vout).toBe(0);
    // The second's plan was built from the live master UTXO, which is the first's own recreated output.
    const secondSource = two.plan.inputs[MASTER_A]!.source;
    expect(secondSource.lockingBytecode).toStrictEqual(contract.lockingBytecode);
    expect(secondSource.token?.category).toStrictEqual(contract.category);
    expect(secondSource.valueSatoshis).toBe(two.master.satoshis);

    // One master UTXO remains, at the second send's output; the original outpoint is gone.
    const live = await f.provider.getUtxosForLockingBytecode(contract.lockingBytecode);
    expect(live).toHaveLength(1);
    expect(live[0]!.txid).toBe(two.txid);
    expect(live[0]!.vout).toBe(0);
    expect(await f.provider.getRawTransaction(one.txid)).toMatch(/^[0-9a-f]+$/);
    expect(await f.provider.getRawTransaction(two.txid)).toMatch(/^[0-9a-f]+$/);
  });

  it('lets two sends with disjoint resources both complete', async () => {
    const f = await fixture(
      { Alpha: 'a2'.repeat(31) + '5d', Beta: 'a3'.repeat(31) + '5c' },
      ['b3'.repeat(31) + '4c', 'b4'.repeat(31) + '4b'],
    );
    const queue = new CompositionQueue();

    const alpha = queue.enqueue(sendFor(f, 'Alpha', MASTER_A, 'b3'.repeat(31) + '4c'));
    const beta = queue.enqueue(sendFor(f, 'Beta', MASTER_B, 'b4'.repeat(31) + '4b'));
    const [one, two] = await Promise.all([alpha, beta]);

    expect(one.txid).not.toBe(two.txid);
    // Each master moved to the output its own send created, and neither touched the other's.
    for (const [contract, result] of [[f.contracts.Alpha!, one], [f.contracts.Beta!, two]] as const) {
      const live = await f.provider.getUtxosForLockingBytecode(contract.lockingBytecode);
      expect(live).toHaveLength(1);
      expect(live[0]!.txid).toBe(result.txid);
    }
  });

  it('keeps a failed send from blocking a disjoint one or its own overlap successor', async () => {
    const f = await fixture(
      { Alpha: 'a4'.repeat(31) + '5b', Beta: 'a5'.repeat(31) + '5a' },
      ['b5'.repeat(31) + '4a', 'b6'.repeat(31) + '49'],
    );
    const contract = f.contracts.Alpha!;
    const registered = await liveMaster(f.provider, contract);
    const queue = new CompositionQueue();

    const failing: QueuedSend<SendResult> = {
      resources: [MASTER_A],
      plan: async () => planFor(f, 'Alpha', contract, MASTER_A, await liveMaster(f.provider, contract)),
      // Stands in for a broadcast the provider refuses: the send consumed nothing, so its resources are still live.
      run: async () => { throw new Error('broadcast refused'); },
    };
    const refused = queue.enqueue(failing);
    const successor = queue.enqueue(sendFor(f, 'Alpha', MASTER_A, 'b5'.repeat(31) + '4a'));
    const disjoint = queue.enqueue(sendFor(f, 'Beta', MASTER_B, 'b6'.repeat(31) + '49'));

    const outcomes = await Promise.allSettled([refused, successor, disjoint]);
    expect(outcomes[0]!.status).toBe('rejected');
    expect((outcomes[0] as PromiseRejectedResult).reason).toMatchObject({ message: 'broadcast refused' });
    const [afterRefusal, other] = outcomes.slice(1) as Array<PromiseFulfilledResult<SendResult>>;
    expect(afterRefusal.status).toBe('fulfilled');
    expect(other.status).toBe('fulfilled');

    // The overlap successor ran against the still-live master: it is the one that spent the registered outpoint.
    expect(afterRefusal.value.master).toStrictEqual(registered);
    const live = await f.provider.getUtxosForLockingBytecode(contract.lockingBytecode);
    expect(live).toHaveLength(1);
    expect(live[0]!.txid).toBe(afterRefusal.value.txid);
  });
});
