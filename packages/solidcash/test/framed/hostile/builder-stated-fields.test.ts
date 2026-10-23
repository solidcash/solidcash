import { beforeAll, describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import {
  INDEX_NONE, concatBytes, decodeWitnessBlock, encodeWitnessBlock, splitFirstPush,
  type Artifact, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { deployFramedProxy } from '../../../src/framed/proxy/index.js';
import { callFramedProxyEntry, type FramedProxyCallResult } from '../../../src/framed/proxy/deploy.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * Every field the builder states that a frame reads, and whether the settlement refuses a transaction that
 * re-states it to a value the execution did not compute.
 *
 * The engine is the shipped path: the shipped compiler under the framed convention, the shipped deployment and
 * `callFramedEntry`, whose result carries the settled transaction and the draft its derivation ran on. Each case
 * clones the settled transaction, mutates exactly one builder-stated field — in the master's witness block, in the
 * transaction, or in the spent outputs the machine reads — and asks the shipped machine for a verdict on every
 * participant. A field that no participant refuses is a finding; the smallest change believed to close it is
 * stated in a comment and reported rather than made here.
 *
 * The contract is one entry that writes two records (an `int` and a mapping node), emits an event, sends value and
 * returns a value, so a single settlement exercises record coordinates, segment views, event and send indices, the
 * created-record region, the retval slot and the value the frame carries.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   event Moved(int indexed who, int amount);'
  + '   int public count;'
  + '   int public total;'
  + '   mapping(bytes20 => int) public owed;'
  + '   receive() external payable { require(true); }'
  + '   function record(bytes20 who, int amount) public payable returns (int) {'
  + '     this.count = this.count + 1;'
  + '     this.total = this.total + amount;'
  + '     this.owed[who] = amount;'
  + '     emit Moved(1, amount);'
  + '     this.transfer(msg.sender, 1000);'
  + '     return this.count;'
  + '   }'
  + ' }';

/** A 32-byte outpoint hash whose bytes are not all the same. */
function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

const ledger = compileStringMulti(SOURCE, { composition: 'framed' }).Ledger!;

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutputs = VmProgram['sourceOutputs'];

/** The settled composition and the artifact it was built from. */
interface Composition {
  readonly result: FramedCallResult;
  readonly artifact: Artifact;
}

let settled: Composition | undefined;

beforeAll(async () => {
  const artifact = ledger;
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: outpointHash(0x30), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  await fundShippedFacets(provider);
  const deployment = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
  });
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: outpointHash(0x51), vout: 0, satoshis: 300_000n };
  await provider.addUtxo(binToHex(user), callerUtxo);
  const result = await callFramedEntry({
    provider, artifact, categoryId: deployment.categoryId, functionName: 'record',
    args: [alicePkh, 500n], callerUtxo, callerLockingBytecode: user,
    funder: signature.unlockP2PKH(), vm: compositionMachine(), value: 2000n,
  });
  settled = { result, artifact };
}, 120_000);

function composition(): Composition {
  if (settled === undefined) throw new Error('the settlement was not built');
  return settled;
}

/** The input index the layout placed for a participant. */
function indexOf(result: FramedCallResult, id: string): number {
  return result.draft.layout.participants.find((placed) => placed.id === id)!.index;
}

/** The identifiers the layout placed; the state participants are records, the rest master/validator/facet. */
function participantIds(result: FramedCallResult): readonly string[] {
  return result.draft.layout.participants.map((placed) => placed.id);
}

/** The settled transaction, cloned so a case can mutate it without reaching the next. */
function cloned(result: FramedCallResult): VmTransaction {
  return structuredClone(result.transaction) as VmTransaction;
}

/**
 * The settled transaction with the master's witness block rebuilt from `mutate`.
 *
 * The block is the builder's own statement about the execution, so a case that changes one field re-encodes it and
 * splices the same argument and redeem bytes back after it, exactly as the composer built them.
 */
function withBlock(
  result: FramedCallResult,
  mutate: (block: WitnessBlock) => void,
): VmTransaction {
  const transaction = cloned(result);
  const block = structuredClone(result.draft.blockOf('master')) as WitnessBlock;
  mutate(block);
  const masterIndex = indexOf(result, 'master');
  const original = result.transaction.inputs[masterIndex]!.unlockingBytecode;
  const { rest } = splitFirstPush(original);
  transaction.inputs[masterIndex] = {
    ...transaction.inputs[masterIndex]!,
    unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
  return transaction;
}

/** The identifiers of the participants the machine refuses on one transaction, in layout order. */
function refusals(
  result: FramedCallResult,
  transaction: VmTransaction,
  sourceOutputs: VmSourceOutputs = result.sourceOutputs,
): readonly string[] {
  const vm = compositionMachine();
  return result.draft.layout.participants
    .filter((placed) => {
      const state = vm.evaluate({ inputIndex: placed.index, sourceOutputs, transaction });
      return vm.stateSuccess(state) !== true;
    })
    .map((placed) => placed.id);
}

/** True when the machine accepted every participant of the transaction. */
function accepted(result: FramedCallResult, transaction: VmTransaction): boolean {
  return refusals(result, transaction).length === 0;
}

const MASTER = 'master';
const VALIDATOR = 'validator';
const FACET = 'validator/1';
const RECORD = 'record-0';
const NODE = 'mapping-node-'
  + '0000000000000000000000000000000000000000000000000000000000000000';

describe('the settlement binds the frame fields a builder states', () => {
  it('accepts the settled composition every case below differs from', () => {
    const { result } = composition();
    expect(result.accepted).toBe(true);
    expect(participantIds(result)).toStrictEqual([MASTER, VALIDATOR, FACET, RECORD, NODE]);
    expect(accepted(result, cloned(result))).toBe(true);
  });

  it('refuses a frame kind the execution did not run in', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => { block.kind = 2; }));
    expect(refuses).toContain(MASTER);
    expect(refuses).toContain(FACET);
  });

  it('refuses a caller reference the execution did not come from', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => { block.callerRef = indexOf(result, RECORD); }));
    expect(refuses).toContain(MASTER);
    expect(refuses).toContain(FACET);
  });

  it('refuses an origin reference the execution did not come from', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => { block.originRef = indexOf(result, RECORD); }));
    expect(refuses).toContain(MASTER);
    expect(refuses).toContain(FACET);
  });

  it('refuses a validator reference the master does not point at', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => { block.validatorRef = INDEX_NONE; }));
    expect(refuses).toContain(VALIDATOR);
  });

  it('refuses a sender the execution did not have', () => {
    const { result } = composition();
    const stranger = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x42));
    const refuses = refusals(result, withBlock(result, (block) => { block.sender = stranger; }));
    expect(refuses).toContain(MASTER);
  });

  it('refuses an own address the execution did not have', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => {
      block.self = Uint8Array.from(block.self);
      block.self[5] = (block.self[5]! ^ 0xff) & 0xff;
    }));
    expect(refuses).toContain(MASTER);
    expect(refuses).toContain(VALIDATOR);
  });

  it('refuses a value the execution did not carry', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => { block.value = 9999n; }));
    expect(refuses).toContain(MASTER);
  });

  it('refuses a retval the execution did not compute', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => { block.retval = Uint8Array.from([0x52]); }));
    expect(refuses).toContain(MASTER);
  });

  it('refuses a declared record input that is not the one the execution read', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => {
      block.segments[0]![0]!.in = indexOf(result, NODE);
      block.segments[0]![0]!.out = indexOf(result, NODE);
    }));
    expect(refuses).toContain(MASTER);
  });

  it('refuses deleting a record the execution recreated', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => { block.segments[0]![0]!.out = INDEX_NONE; }));
    expect(refuses).toContain(MASTER);
  });

  it('refuses a segment view the record never started from', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => {
      block.segments[0]![0]!.viewIn = Uint8Array.from([0, 1]);
    }));
    expect(refuses).toContain(MASTER);
  });

  it('refuses a segment view the execution never ended at', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => {
      const view = Uint8Array.from(block.segments[0]![0]!.viewOut);
      view[view.length - 1] = (view[view.length - 1]! ^ 0xff) & 0xff;
      block.segments[0]![0]!.viewOut = view;
    }));
    expect(refuses).toContain(MASTER);
  });

  it('refuses a mapping node view the execution never ended at', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => {
      const view = Uint8Array.from(block.segments[0]![1]!.viewOut);
      view[view.length - 1] = (view[view.length - 1]! ^ 0xff) & 0xff;
      block.segments[0]![1]!.viewOut = view;
    }));
    expect(refuses).toContain(MASTER);
  });

  it('refuses a created record landing at an output the execution did not build', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => { block.segments[0]![2]!.out = 6; }));
    expect(refuses).toContain(MASTER);
  });

  it('refuses an event the frame did not emit, and an event list emptied of one it did', () => {
    const { result } = composition();
    const repointed = refusals(result, withBlock(result, (block) => { block.events = [6]; }));
    expect(repointed).toContain(MASTER);
    const emptied = refusals(result, withBlock(result, (block) => { block.events = []; }));
    expect(emptied).toContain(MASTER);
  });

  it('refuses a send the frame did not make, and a send list emptied of one it did', () => {
    const { result } = composition();
    const repointed = refusals(result, withBlock(result, (block) => { block.sends = [6]; }));
    expect(repointed).toContain(MASTER);
    const emptied = refusals(result, withBlock(result, (block) => { block.sends = []; }));
    expect(emptied).toContain(MASTER);
  });

  it('refuses a declared call count the execution did not make', () => {
    const { result } = composition();
    const refuses = refusals(result, withBlock(result, (block) => {
      block.calls = [{
        kind: 1, target: Uint8Array.from(block.self), value: 0n, calleeRef: 0,
        argsHash: new Uint8Array(32), result: new Uint8Array(0),
      }];
      block.segments = [block.segments[0]!, [block.segments[0]![0]!]];
    }));
    expect(refuses).toContain(MASTER);
  });

  it('refuses a created record that declares a start view', () => {
    // A record the transaction creates begins at the empty commitment, which the frame's own self-settlement branch
    // holds the declared `viewIn` to, so a builder cannot state a start view the execution never read. (The
    // validator's record-chain rule states the same thing; the call path plans no settled category, so the frame's
    // own check is what binds it here.)
    const { result } = composition();
    const transaction = withBlock(result, (block) => { block.segments[0]![2]!.viewIn = Uint8Array.from([1]); });
    // The mutation reached the wire: the rebuilt block states the nonempty start view.
    const { payload } = splitFirstPush(transaction.inputs[indexOf(result, MASTER)]!.unlockingBytecode);
    expect(binToHex(decodeWitnessBlock(payload).segments[0]![2]!.viewIn)).toBe('01');
    expect(accepted(result, transaction)).toBe(false);
  });

  it('refuses a segment count the wire codec cannot tie to the call count', () => {
    const { result } = composition();
    expect(() => withBlock(result, (block) => { block.segments = [block.segments[0]!, []]; }))
      .toThrow(/one more segment than calls/);
  });
});

describe('the settlement binds the transaction fields a builder states', () => {
  it('refuses an output that recreates a record with a commitment the execution did not write', () => {
    const { result } = composition();
    const transaction = cloned(result);
    const output = transaction.outputs[indexOf(result, RECORD)]!;
    const commitment = Uint8Array.from(output.token!.nft!.commitment);
    commitment[commitment.length - 1] = (commitment[commitment.length - 1]! ^ 0xff) & 0xff;
    transaction.outputs[indexOf(result, RECORD)] = {
      ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } },
    };
    expect(refusals(result, transaction)).toContain(MASTER);
  });

  it('refuses a master output that is not the master recreated in place', () => {
    const { result } = composition();
    const transaction = cloned(result);
    const output = transaction.outputs[0]!;
    const lock = Uint8Array.from(output.lockingBytecode);
    lock[lock.length - 1] = (lock[lock.length - 1]! ^ 0xff) & 0xff;
    transaction.outputs[0] = { ...output, lockingBytecode: lock };
    expect(refusals(result, transaction)).toContain(MASTER);
  });

  it('refuses a validator output whose token the execution did not recreate', () => {
    const { result } = composition();
    const index = indexOf(result, VALIDATOR);
    const withCommitment = cloned(result);
    const output = withCommitment.outputs[index]!;
    withCommitment.outputs[index] = {
      ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: Uint8Array.from([1]) } },
    };
    expect(refusals(result, withCommitment)).toContain(VALIDATOR);

    const withLock = cloned(result);
    const lock = Uint8Array.from(withLock.outputs[index]!.lockingBytecode);
    lock[lock.length - 1] = (lock[lock.length - 1]! ^ 0xff) & 0xff;
    withLock.outputs[index] = { ...withLock.outputs[index]!, lockingBytecode: lock };
    expect(refusals(result, withLock)).toContain(VALIDATOR);
  });

  it('refuses a created record output whose commitment the execution did not write', () => {
    const { result } = composition();
    const transaction = cloned(result);
    const created = transaction.outputs[8]!;
    const commitment = Uint8Array.from(created.token!.nft!.commitment);
    commitment[commitment.length - 1] = (commitment[commitment.length - 1]! ^ 0xff) & 0xff;
    transaction.outputs[8] = {
      ...created, token: { ...created.token!, nft: { ...created.token!.nft!, commitment } },
    };
    expect(refusals(result, transaction)).toContain(MASTER);
  });

  it('refuses a spent record whose commitment is not the one the execution read', () => {
    const { result } = composition();
    const index = indexOf(result, RECORD);
    const sources = result.sourceOutputs.map((source, at) => {
      if (at !== index) return source;
      const commitment = Uint8Array.from(source.token!.nft!.commitment);
      commitment[commitment.length - 1] = (commitment[commitment.length - 1]! ^ 0xff) & 0xff;
      return { ...source, token: { ...source.token!, nft: { ...source.token!.nft!, commitment } } };
    });
    const refuses = refusals(result, cloned(result), sources as unknown as VmSourceOutputs);
    expect(refuses).toContain(MASTER);
  });

  it('refuses a validator input that is not the facet the head binds', () => {
    // The head holds each facet's lock as a constant and requires the input at `head + k` to be that lock; a facet
    // input stated otherwise is refused before the facet runs.
    const { result } = composition();
    const facetIndex = indexOf(result, FACET);
    const sources = result.sourceOutputs.map((source, at) => {
      if (at !== facetIndex) return source;
      const lock = Uint8Array.from(source.lockingBytecode);
      lock[lock.length - 1] = (lock[lock.length - 1]! ^ 0xff) & 0xff;
      return { ...source, lockingBytecode: lock };
    });
    const refuses = refusals(result, cloned(result), sources as unknown as VmSourceOutputs);
    expect(refuses).toContain(VALIDATOR);
  });
});

describe('fields the settlement does not refuse', () => {
  it('does not bind the transaction locktime', () => {
    // No frame here reads `block.timestamp`, and the covenant states no locktime, so nothing refuses a changed one.
    // A body that reads time compares the locktime it saw against a constant and refuses a wrong one; otherwise the
    // caller's own signature is what commits to it. Not a state-smuggling vector on its own.
    const { result } = composition();
    const transaction = cloned(result);
    transaction.locktime = 1;
    expect(accepted(result, transaction)).toBe(true);
  });

  it('does not bind a per-input sequence number', () => {
    // As with the locktime: no frame here reads `this.age`, so nothing refuses a changed sequence. A body that
    // gates on age (`require(this.age >= n)`) is measured against this value and refuses a wrong one.
    const { result } = composition();
    const transaction = cloned(result);
    transaction.inputs = transaction.inputs.map((input) => ({ ...input, sequenceNumber: 0 }));
    expect(accepted(result, transaction)).toBe(true);
  });

  it('does not bind the outpoint an input spends', () => {
    // The witness and the covenant never read an outpoint hash; the network resolves it to the source output the
    // machine is handed, so a changed hash is rejected at relay rather than by the settlement. Not a finding to fix.
    const { result } = composition();
    const transaction = cloned(result);
    transaction.inputs = transaction.inputs.map((input, at) => at === indexOf(result, RECORD)
      ? { ...input, outpointTransactionHash: new Uint8Array(32).fill(0x77) } : input);
    expect(accepted(result, transaction)).toBe(true);
  });
});

/**
 * The dynamic run a builder states.
 *
 * A framed body holds a dynamic value in a run of chunk NFTs laid at its collection's covenant. The frame
 * declares the run's records and the record that carries the value's byte length, and the body's own close hands
 * back the length and the chunk bytes it computed. This second settlement runs the proxied path (the direct path
 * declares a dynamic value's run only beside a mapping write), appends one element to a `Post[]`, and then asks
 * whether the run's width and the chunks' commitments are bound by the settlement.
 */
const IMPL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl {'
  + '   struct Post { int id; string title; int at; }'
  + '   address public implementation;'
  + '   Post[] public posts;'
  + '   function initialize() { this.posts.push(Post(1, "seed", 2)); }'
  + '   function post(int id, string title_) {'
  + '     this.posts.push();'
  + '     int index = this.posts.length - 1;'
  + '     this.posts[index].id = id;'
  + '     this.posts[index].title = title_;'
  + '     this.posts[index].at = this.activeInputIndex;'
  + '   }'
  + ' }';

/** A title long enough that the appended element crosses the chunk boundary. */
const TITLE = 't'.repeat(130);

let proxySettled: FramedProxyCallResult | undefined;

function proxyComposition(): FramedProxyCallResult {
  if (proxySettled === undefined) throw new Error('the proxied settlement was not built');
  return proxySettled;
}

/** The identifiers of the proxy participants the machine refuses on one transaction. */
function proxyRefusals(
  result: FramedProxyCallResult,
  transaction: VmTransaction,
): readonly string[] {
  const vm = compositionMachine();
  return result.draft.layout.participants
    .filter((placed) => vm.stateSuccess(vm.evaluate({
      inputIndex: placed.index,
      sourceOutputs: result.sourceOutputs as unknown as VmSourceOutputs,
      transaction,
    })) !== true)
    .map((placed) => placed.id);
}

/** The proxied transaction with one master's witness block rebuilt from `mutate`. */
function withProxyBlock(
  result: FramedProxyCallResult,
  masterId: string,
  mutate: (block: WitnessBlock) => void,
): VmTransaction {
  const transaction = structuredClone(result.transaction) as VmTransaction;
  const block = structuredClone(result.draft.blockOf(masterId)) as WitnessBlock;
  mutate(block);
  const index = result.draft.layout.participants.find((placed) => placed.id === masterId)!.index;
  const original = result.transaction.inputs[index]!.unlockingBytecode;
  const { rest } = splitFirstPush(original);
  transaction.inputs[index] = {
    ...transaction.inputs[index]!,
    unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
  };
  return transaction;
}

describe('the settlement binds the dynamic run a builder states', () => {
  beforeAll(async () => {
    const artifacts = compileStringMulti(IMPL_SOURCE, { composition: 'framed' });
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const implFunding = { txid: outpointHash(0x60), vout: 0, satoshis: 500_000n };
    const proxyFunding = { txid: outpointHash(0x70), vout: 0, satoshis: 500_000n };
    const deployerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const initUtxo = { txid: outpointHash(0x80), vout: 0, satoshis: 100_000n };
    const callUtxo = { txid: outpointHash(0x90), vout: 0, satoshis: 100_000n };
    await network.addUtxo(funder.address, implFunding);
    await network.addUtxo(funder.address, proxyFunding);
    await fundShippedFacets(network);
    await network.addUtxo(binToHex(deployerLock), initUtxo);
    await network.addUtxo(binToHex(deployerLock), callUtxo);
    const deployment = await deployFramedProxy({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      implementationDeploy: {
        fundingUtxo: implFunding, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
      },
      proxyDeploy: {
        fundingUtxo: proxyFunding, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
      },
      initialize: { functionName: 'initialize' },
      callerLockingBytecode: deployerLock,
      callerFunding: { utxo: initUtxo, funder: signature.unlockP2PKH() },
      vm: compositionMachine(),
    });
    const result = await callFramedProxyEntry({
      provider: network,
      implementationArtifact: artifacts.Impl!,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName: 'post',
      args: [7n, TITLE],
      callerUtxo: callUtxo,
      callerLockingBytecode: deployerLock,
      funder: signature.unlockP2PKH(),
      changeAddress: funder.address,
      vm: compositionMachine(),
    });
    proxySettled = result;
  }, 180_000);

  it('accepts the proxied settlement every case below differs from', () => {
    const result = proxyComposition();
    expect(result.accepted).toBe(true);
    expect(proxyRefusals(result, structuredClone(result.transaction) as VmTransaction)).toStrictEqual([]);
  });

  it('refuses a created chunk whose commitment the execution did not write', () => {
    // The created chunk's commitment carries the bytes the body computed; the validator's settlement reads the run
    // the record's declaration names and refuses a chunk of it that is not the one the body wrote.
    const result = proxyComposition();
    const index = result.draft.trailingOutputs[0]!.index;
    const transaction = structuredClone(result.transaction) as VmTransaction;
    const output = transaction.outputs[index]!;
    if (output.token?.nft === undefined) throw new Error('the created chunk carries no commitment');
    const commitment = Uint8Array.from(output.token.nft.commitment);
    commitment[commitment.length - 1] = (commitment[commitment.length - 1]! ^ 0xff) & 0xff;
    transaction.outputs[index] = {
      ...output, token: { ...output.token, nft: { ...output.token.nft, commitment } },
    };
    expect(proxyRefusals(result, transaction)).toStrictEqual([VALIDATOR]);
  });

  it('refuses a live chunk view the execution did not read', () => {
    // The implementation frame declares the run it reads from the deployment's live chunks; a chunk view that is not
    // the live one fails the body's own read of it, and the validator's settlement refuses the same frame.
    const result = proxyComposition();
    const transaction = withProxyBlock(result, 'implementation-master', (block) => {
      const entry = block.segments[0]!.find((candidate) => candidate.in === 4)!;
      const view = Uint8Array.from(entry.viewIn);
      view[view.length - 1] = (view[view.length - 1]! ^ 0xff) & 0xff;
      entry.viewIn = view;
    });
    expect(proxyRefusals(result, transaction)).toStrictEqual([VALIDATOR, 'implementation-master']);
  });

  it('refuses a record width the execution did not write', () => {
    // The record's commitment carries the value's byte length, which names the run's width; the frame's segment view
    // and the created chunk's covenant both follow it, so a record output that states another length is refused.
    const result = proxyComposition();
    const index = result.draft.layout.participants.find((placed) => placed.id === 'proxy-record-0')!.index;
    const transaction = structuredClone(result.transaction) as VmTransaction;
    const output = transaction.outputs[index]!;
    const commitment = Uint8Array.from(output.token!.nft!.commitment);
    commitment[commitment.length - 1] = (commitment[commitment.length - 1]! ^ 0xff) & 0xff;
    transaction.outputs[index] = {
      ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } },
    };
    expect(proxyRefusals(result, transaction)).toStrictEqual([VALIDATOR]);
  });
});
