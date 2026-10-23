import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import {
  FrameKind, buildPushdataCommitment, type Artifact, type StateValue,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  Signer,
  TransactionBuilder,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import type { Unlocker, Utxo } from '../../../src/interfaces.js';
import {
  libauthOutputToSolidCashOutput, libauthTokenDetailsToSolidCashTokenDetails,
} from '../../../src/utils.js';
import { encodeFunctionArgument, type FunctionArgument } from '../../../src/Argument.js';
import {
  CreateLookahead, deployMaster, readFramedDeployment, readFramedState,
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { DEFAULT_MASTER_POOL_SIZE } from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost, deriveComposition, participant,
  type CompositionDraft, type CompositionDraftPlan,
} from '../../../src/framed/composer/index.js';
import { master, token as tokenOf } from './harness.js';
import { fundShippedFacets } from '../shapes/harness.js';
import { layoutWithFacets } from './harness.js';

/**
 * A deployment: four contracts at predicted addresses, and a token.
 *
 * Four stateful contracts have records that point at one another in a circle, so every address has to be known
 * before the first of them is deployed, and a token's balances are moved by a few transfers and approves. The
 * shape's proxy pair, deployed behind the built-in forwarder, is `deploy/proxy-initialize-broadcast.test.ts`'s.
 *
 * Everything runs the shipped path: the addresses are reserved and predicted through `CreateLookahead`, the
 * deployments are `StatefulContract.deploy` (which routes a framed artifact to the framed genesis), the calls
 * are the shipped composer plus derivation rebuilt on the outpoints the chain holds, and every state read is
 * `readFramedState`/`readFramedDeployment`.
 */

const VALIDATOR_PROGRAM = framedValidator.buildValidatorProgram();
const VALUE = 20_000n;

/** No constructors: the initial state is the initializer, so each contract serves one entry and needs no dispatch. */
const CIRCLE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Alpha { address next; function ping() { require(true); } }'
  + ' contract Beta { address next; function ping() { require(true); } }'
  + ' contract Gamma { address next; function ping() { require(true); } }'
  + ' contract Delta {'
  + '   address next;'
  + '   address prev;'
  + '   function close() { this.next = this.prev; require(true); }'
  + ' }';

const TOKEN_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Token {'
  + '   int public totalSupply;'
  + '   int public allowance;'
  + '   int public balance;'
  + '   function approve(int amount) { this.allowance = amount; require(true); }'
  + '   function transfer(int amount) {'
  + '     this.totalSupply = this.totalSupply - amount;'
  + '     this.balance = this.balance + amount;'
  + '     require(true);'
  + '   }'
  + ' }';

const CIRCLE = ['Alpha', 'Beta', 'Gamma', 'Delta'] as const;

type ArtifactMap = ReturnType<typeof compileStringMulti>;

/** The reserved funding UTXOs, one per deployment, in nonce order. */
interface Deployment {
  readonly provider: MockNetworkProvider;
  readonly circleArtifacts: ArtifactMap;
  readonly tokenArtifact: Artifact;
  /** The address predicted for nonce `i` before anything was deployed. */
  readonly predicted: readonly Uint8Array[];
  /** The reserved outpoint each deployment spent: the category its genesis minted. */
  readonly reserved: readonly Utxo[];
  /** The category each deployment minted, read back from the deployment. */
  readonly categories: readonly string[];
  /** `addrV(category)` of each deployment, read back from its category. */
  readonly addresses: readonly Uint8Array[];
  readonly tokenReserved: Utxo;
  /** The address predicted for the token's nonce, before the token was deployed. */
  readonly tokenPredicted: Uint8Array;
  readonly tokenCategory: string;
  readonly tokenAddress: Uint8Array;
  readonly userLock: Uint8Array;
  readonly funder: Unlocker;
  readonly funding: readonly Utxo[];
}

/** A signer over the relaxed mock, funded with `count` fresh vout-0 token-free UTXOs (each its own txid). */
async function fundedSigner(count: number, fill: number): Promise<{
  readonly provider: MockNetworkProvider;
  readonly signer: Signer;
  readonly utxos: readonly Utxo[];
}> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signer = new Signer(new Uint8Array(32).fill(fill), provider);
  const utxos: Utxo[] = [];
  for (let index = 0; index < count; index += 1) {
    const utxo = { txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n };
    await provider.addUtxo(signer.getAddress(), utxo);
    utxos.push(utxo);
  }
  // The hops broadcast, so each composition's facet input needs a live UTXO at the facet's lock.
  await fundShippedFacets(provider);
  return { provider, signer, utxos };
}

/** Compiles the circle and token units once, reserves five genesis coins, and deploys everything. */
async function setUp(): Promise<Deployment> {
  const { provider, signer } = await fundedSigner(5, 0xc1);
  const circleArtifacts = compileStringMulti(CIRCLE_SOURCE, { composition: 'framed' });
  const tokenUnit = compileStringMulti(TOKEN_SOURCE, { composition: 'framed' });
  const tokenArtifact = tokenUnit.Token!;

  const lookahead = CreateLookahead.open({ signer, artifact: circleArtifacts.Alpha! });
  try {
    await lookahead.reserve(5);
    // Every address is predicted before any of them is deployed: the records reference one another in a circle.
    const predicted = [0, 1, 2, 3].map((nonce) => lookahead.getCreateAddress(nonce));
    const reserved = [0, 1, 2, 3].map((nonce) => lookahead.getFundingUtxo(nonce));
    const tokenReserved = lookahead.getFundingUtxo(4);
    const tokenPredicted = lookahead.getCreateAddress(4);

    const funder = signer.unlockP2PKH();
    const categories: string[] = [];
    const addresses: Uint8Array[] = [];
    // The initial state seeds each record's `next`: Alpha -> Beta -> Gamma -> Delta, with Delta pointing back at
    // Gamma, so the graph is not yet a circle. The setter call moves Delta's `next` to its `prev`, Alpha's address,
    // which is the link that closes it.
    const initialStates: Record<string, Uint8Array>[] = [
      { next: predicted[1]! },
      { next: predicted[2]! },
      { next: predicted[3]! },
      { next: predicted[2]!, prev: predicted[0]! },
    ];
    for (let index = 0; index < CIRCLE.length; index += 1) {
      const name = CIRCLE[index]!;
      const { categoryId } = await StatefulContract.deploy(circleArtifacts[name]!, [], {
        provider,
        fundingUtxo: reserved[index]!,
        funder,
        changeAddress: signer.getAddress(),
        initialState: initialStates[index]!,
        masterAmount: VALUE,
        dataNftAmount: VALUE,
      });
      categories.push(categoryId);
      addresses.push(deployMaster(circleArtifacts[name]!, hexToBin(categoryId), VALIDATOR_PROGRAM).address);
    }

    const { categoryId: tokenCategory } = await StatefulContract.deploy(tokenArtifact, [], {
      provider,
      fundingUtxo: tokenReserved,
      funder,
      changeAddress: signer.getAddress(),
      initialState: { totalSupply: 100n },
      masterAmount: VALUE,
      dataNftAmount: VALUE,
    });
    const tokenAddress = deployMaster(tokenArtifact, hexToBin(tokenCategory), VALIDATOR_PROGRAM).address;

    // Fresh coins for the calls, added only once every deployment is placed so genesis selection cannot take one.
    const funding: Utxo[] = [];
    for (let index = 0; index < 12; index += 1) {
      const utxo = { txid: (0x100 + index).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n };
      await provider.addUtxo(signer.getAddress(), utxo);
      funding.push(utxo);
    }

    return {
      provider, circleArtifacts, tokenArtifact, predicted, reserved, categories, addresses,
      tokenReserved, tokenPredicted, tokenCategory, tokenAddress,
      userLock: funder.generateLockingBytecode(), funder, funding,
    };
  } finally {
    lookahead.release();
  }
}

let sharedSetUp: Promise<Deployment> | undefined;

/** The one deployment every case reads; none of the cases changes it. */
function deployments(): Promise<Deployment> {
  sharedSetUp ??= setUp();
  return sharedSetUp;
}

/** The four-byte selector an artifact publishes for an entry, which the shipped composer consumes as call data. */
function selectorBytes(artifact: Artifact, entry: string): Uint8Array {
  const row = artifact.abi.find((candidate) => candidate.name === entry);
  if (row?.selector === undefined) throw new Error(`artifact "${artifact.contractName}" publishes no "${entry}"`);
  return new Uint8Array(hexToBin(row.selector));
}

/** A call's argument pushes: the selector first, then the values with the first parameter's push last. */
function argumentPushes(
  artifact: Artifact, entry: string, args: readonly FunctionArgument[],
): readonly Uint8Array[] {
  const row = artifact.abi.find((candidate) => candidate.name === entry)!;
  const encoded = args.map((value, index) =>
    encodeFunctionArgument(value, row.inputs[index]!.type, artifact.structs) as Uint8Array);
  return [selectorBytes(artifact, entry), ...encoded.reverse()];
}

/** A plan input's source, with the token the deployment's own classification read back. */
type PlanSource = {
  readonly lockingBytecode: Uint8Array;
  readonly valueSatoshis: bigint;
  readonly token: ReturnType<typeof tokenOf>;
};

/** A minting NFT of a category, as a plan models a master source. */
function mintingSource(lockingBytecode: Uint8Array, valueSatoshis: bigint, category: Uint8Array): PlanSource {
  return { lockingBytecode, valueSatoshis, token: tokenOf(category, 'minting') };
}

/** One state-writing call's plan, built from the live deployment and the commitment the entry is asked to write. */
async function statefulCallPlan(options: {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly entry: string;
  readonly args?: readonly FunctionArgument[];
  readonly dispatches?: boolean;
  readonly state: Readonly<Record<string, StateValue>>;
  readonly userLock: Uint8Array;
  readonly funding: Utxo;
}): Promise<{
    readonly plan: CompositionDraftPlan;
    readonly masterId: string;
    readonly masterUtxo: Utxo;
    readonly recordUtxo: Utxo;
  }> {
  const layout = options.artifact.stateLayout!;
  const category = hexToBin(options.categoryId);
  const deployed = deployMaster(options.artifact, category, VALIDATOR_PROGRAM);
  const pools = await readFramedDeployment(options.provider, options.categoryId, layout);
  const masterUtxo = pools.masters[0]!;
  const recordUtxo = pools.records[0]!;
  const currentCommitment = hexToBin(recordUtxo.token!.nft!.commitment);
  const writtenCommitment = hexToBin(buildPushdataCommitment(layout, options.state, 0));

  const masterId = 'call-master';
  const recordId = 'call-record';
  const contract = options.artifact.contractName;
  const blocks = [{ contract, masters: [masterId], state: [recordId] }];
  const planLayout = layoutWithFacets(blocks);
  const recordIndex = participant(planLayout, recordId).index;
  const segment = [{ in: recordIndex, out: recordIndex, viewIn: currentCommitment, viewOut: writtenCommitment }];

  const masterDraft = {
    ...master({
      master: masterId,
      contract,
      entry: options.entry,
      program: deployed.script,
      facts: {
        contract, functionName: `${contract}.${options.entry}()`, kind: FrameKind.ROOT,
        callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: options.userLock, self: deployed.address, value: 0n },
      enteredBy: 'user', origin: 'user',
      ...(options.dispatches === true
        ? { argumentPushes: argumentPushes(options.artifact, options.entry, options.args ?? []) }
        : {}),
      segments: [segment],
    }),
    ...(options.dispatches === true ? { dispatches: true } : {}),
  };

  const recordLock = stateRecordLockingBytecode(options.categoryId);
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [{ id: 'user', index: planLayout.funderInputBase }],
    masters: [masterDraft],
    inputs: {
      [masterId]: {
        source: mintingSource(deployed.lockingBytecode, masterUtxo.satoshis, category),
      },
      [recordId]: {
        source: {
          lockingBytecode: recordLock, valueSatoshis: recordUtxo.satoshis,
          token: tokenOf(category, 'mutable', currentCommitment),
        },
        output: {
          lockingBytecode: recordLock, valueSatoshis: recordUtxo.satoshis,
          token: tokenOf(category, 'mutable', writtenCommitment),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(
          options.categoryId, participant(planLayout, masterId).index, 1),
      },
      user: {
        source: { lockingBytecode: options.userLock, valueSatoshis: options.funding.satoshis },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
  };
  return { plan, masterId, masterUtxo, recordUtxo };
}

/** An unlocking taken verbatim from the derived hop, so the broadcast spends the input the machine saw. */
function rawUnlocker(lockingBytecode: Uint8Array, unlockingBytecode: Uint8Array): Unlocker {
  return {
    generateLockingBytecode: () => lockingBytecode,
    generateUnlockingBytecode: () => unlockingBytecode,
  };
}

/** Rebuilds the derived call on the outpoints the chain holds, signs the caller, and broadcasts it. */
async function broadcastCall(
  options: {
    readonly provider: MockNetworkProvider;
    readonly userLock: Uint8Array;
    readonly funder: Unlocker;
    readonly funding: Utxo;
  },
  derived: {
    readonly draft: CompositionDraft;
    readonly masterId: string;
    readonly masterUtxo: Utxo;
    readonly recordUtxo: Utxo;
  },
): Promise<string> {
  const program = derived.draft.programFor(derived.masterId);
  const builder = new TransactionBuilder({ provider: options.provider, skipAutomaticCoSpends: true });
  builder.setLocktime(program.transaction.locktime ?? 0);
  for (const placed of derived.draft.layout.participants) {
    const source = program.sourceOutputs[placed.index]!;
    const unlocking = program.transaction.inputs[placed.index]!.unlockingBytecode;
    // A standalone call's participants are its master and its one state record, each on the live outpoint the
    // shipped classification read back.
    const live = placed.id === derived.masterId ? derived.masterUtxo : derived.recordUtxo;
    const utxo: Utxo = {
      txid: live.txid, vout: live.vout, satoshis: source.valueSatoshis,
      ...(source.token === undefined ? {} : { token: libauthTokenDetailsToSolidCashTokenDetails(source.token) }),
    };
    const sequence = program.transaction.inputs[placed.index]?.sequenceNumber;
    builder.addInput(utxo, rawUnlocker(source.lockingBytecode, unlocking),
      sequence === undefined ? undefined : { sequence });
  }
  builder.addInput(options.funding, options.funder);
  const settled = derived.draft.layout.participantCount + derived.draft.trailingOutputs.length;
  for (const output of program.transaction.outputs.slice(0, settled)) {
    builder.addOutput(libauthOutputToSolidCashOutput(output));
  }
  builder.addBchChangeOutputIfNeeded({ to: options.userLock, feeRate: 1 });
  const transaction = builder.buildLibauthTransaction();
  const rawBytes = encodeTransaction(transaction);
  return options.provider.sendPreparedTransaction({ rawHex: binToHex(rawBytes), rawBytes, transaction });
}

/** Composes and derives a state-writing call through the shipped host, then broadcasts it on the outpoints it holds. */
async function sendEntry(options: {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly entry: string;
  readonly args?: readonly FunctionArgument[];
  readonly dispatches?: boolean;
  readonly state: Readonly<Record<string, StateValue>>;
  readonly userLock: Uint8Array;
  readonly funder: Unlocker;
  readonly funding: Utxo;
}): Promise<string> {
  const built = await statefulCallPlan(options);
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [options.artifact], plan: built.plan,
  });
  deriveComposition([{
    contract: options.artifact.contractName,
    functionName: `${options.artifact.contractName}.${options.entry}()`,
    kind: FrameKind.ROOT,
    master: built.masterId,
  }], host);
  return broadcastCall(options, { draft, masterId: built.masterId, masterUtxo: built.masterUtxo,
    recordUtxo: built.recordUtxo });
}

/** The state one record holds, decoded by the shipped reader. */
async function readState(
  provider: MockNetworkProvider, categoryId: string, artifact: Artifact,
): Promise<Record<string, StateValue>> {
  const state = await readFramedState(provider, categoryId, artifact.stateLayout!);
  return state.byNft[0]!;
}

describe('a deployment whose addresses are predicted before anything is deployed', () => {
  it('deploys each child at the address predicted for its reserved nonce', async () => {
    const d = await deployments();
    for (let index = 0; index < CIRCLE.length; index += 1) {
      const name = CIRCLE[index]!;
      const layout = d.circleArtifacts[name]!.stateLayout!;
      // The reserved outpoint became the category the genesis minted...
      expect(d.categories[index]).toBe(d.reserved[index]!.txid);
      // ...so the address read back from that category is the predicted one.
      expect([...d.addresses[index]!]).toStrictEqual([...d.predicted[index]!]);
      const found = await readFramedDeployment(d.provider, d.categories[index]!, layout);
      // The genesis funds the contract's default pools, so the live geometry is the default one.
      expect(found.masters.length).toBe(DEFAULT_MASTER_POOL_SIZE.masters);
      expect(found.validators.length).toBe(DEFAULT_MASTER_POOL_SIZE.validators);
      expect(found.records.length).toBe(layout.dataNftCount);
      // The prediction is not off-chain only: a UTXO carrying the minted category sits at the predicted address.
      const atPredicted = await d.provider.getUtxosForLockingBytecode(d.predicted[index]!);
      expect(atPredicted.some((utxo) => utxo.token?.category?.toLowerCase() === d.categories[index]!.toLowerCase()))
        .toBe(true);
    }
  });

  it('closes the circle once the setter call links the last child back to the first', async () => {
    const d = await deployments();
    const nextOf = async (index: number): Promise<Uint8Array> => {
      const name = CIRCLE[index]!;
      return (await readState(d.provider, d.categories[index]!, d.circleArtifacts[name]!)).next as Uint8Array;
    };

    // The records reference one another, but the chain is not closed: Delta points back at Gamma.
    expect([...(await nextOf(0))]).toStrictEqual([...d.predicted[1]!]);
    expect([...(await nextOf(1))]).toStrictEqual([...d.predicted[2]!]);
    expect([...(await nextOf(2))]).toStrictEqual([...d.predicted[3]!]);
    expect([...(await nextOf(3))]).toStrictEqual([...d.predicted[2]!]);

    // The setter call moves Delta's `next` to the `prev` it holds, which is Alpha's address.
    await sendEntry({
      provider: d.provider, artifact: d.circleArtifacts.Delta!, categoryId: d.categories[3]!, entry: 'close',
      state: { next: d.predicted[0]!, prev: d.predicted[0]! }, userLock: d.userLock, funder: d.funder,
      funding: d.funding[0]!,
    });

    // Both ends read back after the call: Delta now points at Alpha, and the circle is closed.
    const delta = await readState(d.provider, d.categories[3]!, d.circleArtifacts.Delta!);
    expect([...(delta.next as Uint8Array)]).toStrictEqual([...d.predicted[0]!]);
    expect([...(delta.prev as Uint8Array)]).toStrictEqual([...d.predicted[0]!]);
    const alpha = await readState(d.provider, d.categories[0]!, d.circleArtifacts.Alpha!);
    expect([...(alpha.next as Uint8Array)]).toStrictEqual([...d.predicted[1]!]);
  });
});

describe('a token deployment and its transfers and approves', () => {
  it('settles four calls and reads the balances back through the shipped readers', async () => {
    const d = await deployments();
    const artifact = d.tokenArtifact;
    const categoryId = d.tokenCategory;

    // The token is deployed through the shipped path too: its category is the reserved outpoint and its address is
    // the prediction read back from that category.
    expect(categoryId).toBe(d.tokenReserved.txid);
    expect([...d.tokenAddress]).toStrictEqual([...d.tokenPredicted]);

    const before = await readState(d.provider, categoryId, artifact);
    expect(before.totalSupply).toBe(100n);
    expect(before.allowance).toBe(0n);
    expect(before.balance).toBe(0n);

    const send = async (entry: string, args: readonly FunctionArgument[], next: Record<string, StateValue>,
      funding: Utxo): Promise<void> => {
      await sendEntry({
        provider: d.provider, artifact, categoryId, entry, args, dispatches: true, state: next,
        userLock: d.userLock, funder: d.funder, funding,
      });
    };

    // Four transfers/approves, each read-modify-write of the token's own record.
    await send('approve', [40n], { ...before, allowance: 40n }, d.funding[1]!);
    let now = await readState(d.provider, categoryId, artifact);
    expect(now.allowance).toBe(40n);

    await send('transfer', [30n], { ...now, totalSupply: 70n, balance: 30n }, d.funding[2]!);
    now = await readState(d.provider, categoryId, artifact);

    await send('approve', [25n], { ...now, allowance: 25n }, d.funding[3]!);
    now = await readState(d.provider, categoryId, artifact);

    await send('transfer', [10n], { ...now, totalSupply: 60n, balance: 40n }, d.funding[4]!);
    now = await readState(d.provider, categoryId, artifact);

    expect(now.totalSupply).toBe(60n);
    expect(now.allowance).toBe(25n);
    expect(now.balance).toBe(40n);
  });
});
