import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import {
  buildAnonymousEventNftCovenantScript, buildEntryNftCovenantScript, buildEventNftCovenantScript,
  buildPushdataCommitment, bytesEqual, computeCollectionHash, computeEventNameHash, encodeChunkableValueTail,
  encodeEventCommitment, encodeIntegerValue, encodePushdataValue, hash256, scriptToBytecode, sha256, validatorAddress,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { buildValidatorProgram } from '../../../../solidc/src/framed/validator/index.js';
import { COMPOSITION_LIMITS, compositionMachine, compositionProvider } from '../../../../solidc/test/framed/machine.js';
import {
  Contract,
  SignatureTemplate,
  encodeFunctionArgument,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  chunkRecordLockingBytecode, deployMaster, deriveFramedGenesis,
} from '../../../src/framed/deploy/index.js';
import {
  planChunkRun, planMappingBatch, planMappingWrite, type MappingWritePlan,
} from '../../../src/framed/composer/index.js';
import { headSentinelCommitment } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * Deriving a framed contract's genesis by running its constructor frame.
 *
 * A framed master carries its frame in the witness block leading its own unlocking bytecode, so the direct
 * deployment's synthetic unlocking is refused by the head before the constructor runs. The derivation here builds
 * the block, runs the shipped, placeholder-filled master in the BCH-2026 machine, and learns the commitments the
 * constructor body computes. The machine accepts only when the record the frame declares and the transaction's
 * output both carry exactly the value the body computed, so a transaction that writes a different value is refused
 * — which is what the mutated control below pins.
 *
 * The SDK cases drive the shipped entry point: `StatefulContract.deploy` detects the artifact's convention and
 * deploys through the derivation above, with no change to the caller.
 */

const CATEGORY = sha256(new TextEncoder().encode('genesis derivation'));
const VALIDATOR_PROGRAM = buildValidatorProgram();
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Vault {'
  + '   int public total;'
  + '   constructor(int seed) { this.total = seed + 1; }'
  + '   function check(int v) { require(this.total == v); }'
  + ' }';

const NOARG_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Plain {'
  + '   int public total;'
  + '   constructor() { this.total = 42; }'
  + '   function check() { require(this.total == 42); }'
  + ' }';

const artifact = compileString(SOURCE, { composition: 'framed' });
const stateLayout = artifact.stateLayout!;

/** The commitment the constructor computes for `seed + 1`, in the shipped encoder's form. */
const expectedCommitment = (total: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(stateLayout, { total }, 0), 'hex'));

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];

/** The outputs a built deployment transaction carries, as the handle exposes them for reading back. */
type DeployedTransaction = {
  readonly outputs: readonly {
    readonly lockingBytecode: Uint8Array;
    readonly token?: { readonly nft?: { readonly capability?: string; readonly commitment?: Uint8Array } };
  }[];
};

/** The machine's verdict on a derivation program. */
function accepted(program: VmProgram | undefined): boolean {
  if (program === undefined) throw new Error('the derivation published no program');
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate(program)) === true;
}

/** The program with one record's output commitment replaced, which the frame's declaration no longer matches. */
function withMutatedOutput(program: VmProgram, commitment: Uint8Array): VmProgram {
  const outputs = program.transaction.outputs.map((output, index) => (
    index === 2 && output.token !== undefined
      ? { ...output, token: { ...output.token, nft: { ...output.token.nft!, commitment } } }
      : output
  ));
  return { ...program, transaction: { ...program.transaction, outputs } };
}

describe('a framed genesis derived by running the constructor frame', () => {
  let seeded: ReturnType<typeof deriveFramedGenesis> | undefined;
  /** The derivation for argument 5, which the cases read and none changes. */
  const seededGenesis = (): ReturnType<typeof deriveFramedGenesis> => {
    seeded ??= deriveFramedGenesis({
      artifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
      constructorArgs: [5n], senderLockingBytecode: OWNER_LOCK,
    });
    return seeded;
  };

  it('publishes the convention and makes the contract address the validator address', () => {
    expect(artifact.composition?.convention).toBe('framed');
    const master = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    expect([...master.address]).toStrictEqual([...ADDRESS]);
  });

  it('learns the commitment the constructor body computed', () => {
    const genesis = seededGenesis();

    expect(genesis.commitments.length).toBe(stateLayout.dataNftCount);
    expect(genesis.commitments[0]).toBe(Buffer.from(expectedCommitment(6n)).toString('hex'));
  });

  it('derives a different state for a different constructor argument', () => {
    const genesis = deriveFramedGenesis({
      artifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
      constructorArgs: [41n], senderLockingBytecode: OWNER_LOCK,
    });

    expect(genesis.commitments[0]).toBe(Buffer.from(expectedCommitment(42n)).toString('hex'));
    expect(accepted(genesis.program)).toBe(true);
  });

  it('derives a contract whose constructor takes no argument', () => {
    const plain = compileString(NOARG_SOURCE, { composition: 'framed' });
    const genesis = deriveFramedGenesis({
      artifact: plain, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
      constructorArgs: [], senderLockingBytecode: OWNER_LOCK,
    });

    expect(accepted(genesis.program)).toBe(true);
  });

  it('refuses the same transaction when the record output is mutated off the computed value', () => {
    const genesis = seededGenesis();

    expect(accepted(genesis.program)).toBe(true);
    expect(accepted(withMutatedOutput(genesis.program!, expectedCommitment(7n)))).toBe(false);
  });
});

/**
 * A constructor that emits. The event's payload is what the body computes and cannot be declared in advance, so the
 * derivation learns it from the body's own comparison against the output the block lists. The control mutates that
 * payload off the computed value and the machine refuses the transaction.
 */
const EMITTING_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Registry {'
  + '   int public count;'
  + '   event Registered(int id, string name);'
  + '   constructor(int id) { this.count = id + 1; emit Registered(id, "alpha"); }'
  + '   function check(int v) { require(this.count == v); }'
  + ' }';

const emittingArtifact = compileString(EMITTING_SOURCE, { composition: 'framed' });
const emittingLayout = emittingArtifact.stateLayout!;

/** The lock an event output carries under `category`: the P2SH32 of the covenant the body rebuilds. */
function eventCovenantLockFor(category: Uint8Array, signature: string): Uint8Array {
  const covenant = scriptToBytecode(buildEventNftCovenantScript(category, computeEventNameHash(signature)));
  return encodeLockingBytecodeP2sh32(hash256(covenant));
}

/** The program with the event output's commitment replaced, so the body's payload comparison no longer matches. */
function withMutatedEventPayload(program: VmProgram, index: number, commitment: Uint8Array): VmProgram {
  const outputs = program.transaction.outputs.map((output, at) => (
    at === index && output.token !== undefined
      ? { ...output, token: { ...output.token, nft: { ...output.token.nft!, commitment } } }
      : output
  ));
  return { ...program, transaction: { ...program.transaction, outputs } };
}

describe('a framed genesis whose constructor emits an event', () => {
  let emitting: ReturnType<typeof deriveFramedGenesis> | undefined;
  const emittingGenesis = (): ReturnType<typeof deriveFramedGenesis> => {
    emitting ??= deriveFramedGenesis({
      artifact: emittingArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [5n], senderLockingBytecode: OWNER_LOCK,
    });
    return emitting;
  };
  const registered = emittingArtifact.events!.find((definition) => definition.name === 'Registered')!;
  const eventOutputIndex = (program: VmProgram): number => program.transaction.outputs.findIndex((output) => (
    bytesEqual(output.lockingBytecode, eventCovenantLockFor(CATEGORY, registered.signature))
  ));

  it('carries the payload the constructor body computed at the output the block lists', () => {
    const program = emittingGenesis().program!;
    const index = eventOutputIndex(program);
    expect(index).toBeGreaterThanOrEqual(0);
    const expected = encodeEventCommitment(registered.parameters, [5n, 'alpha']);
    expect(Array.from(program.transaction.outputs[index]!.token!.nft!.commitment)).toStrictEqual(Array.from(expected));
  });

  it('accepts the derivation and refuses an event payload off the computed value', () => {
    const genesis = emittingGenesis();
    expect(accepted(genesis.program)).toBe(true);

    const index = eventOutputIndex(genesis.program!);
    const offValue = encodeEventCommitment(registered.parameters, [6n, 'alpha']);
    expect(accepted(withMutatedEventPayload(genesis.program!, index, offValue))).toBe(false);
  });

  it('publishes the event with the covenant lock and the commitment the body computed', () => {
    const genesis = emittingGenesis();
    expect(genesis.events.map((event) => event.eventSignature)).toStrictEqual([registered.signature]);
    const event = genesis.events[0]!;
    const expectedLock = eventCovenantLockFor(CATEGORY, registered.signature);
    expect(Array.from(event.lockingBytecode)).toStrictEqual(Array.from(expectedLock));
    const expected = encodeEventCommitment(registered.parameters, [5n, 'alpha']);
    expect(Array.from(event.commitment)).toStrictEqual(Array.from(expected));
  });

  it('materializes the event and the record in the deployment transaction the SDK builds', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: '22'.repeat(31) + 'dd', vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funding.address, fundingUtxo);

    const { tx } = await StatefulContract.deploy(emittingArtifact, [5n], {
      provider,
      fundingUtxo,
      funder: funding.unlock.spend(alicePub, signature),
      changeAddress: funding.address,
    });
    const outputs = (tx as unknown as DeployedTransaction).outputs;
    const category = new Uint8Array(Buffer.from(fundingUtxo.txid, 'hex'));

    // The event output sits at the covenant the body rebuilt and carries the payload it computed.
    const eventOutput = outputs.find(
      (output) => bytesEqual(output.lockingBytecode, eventCovenantLockFor(category, registered.signature)),
    );
    expect(eventOutput).toBeDefined();
    expect(eventOutput!.token?.nft?.capability).toBe('none');
    const expectedPayload = encodeEventCommitment(registered.parameters, [5n, 'alpha']);
    expect(Array.from(eventOutput!.token?.nft?.commitment ?? new Uint8Array()))
      .toStrictEqual(Array.from(expectedPayload));

    // The state the constructor wrote is minted at the same deployment, through the shipped encoder.
    const recordCommitment = buildPushdataCommitment(emittingLayout, { count: 6n }, 0);
    expect(outputs.some((output) => output.token?.nft?.commitment !== undefined
      && Buffer.from(output.token.nft.commitment).toString('hex') === recordCommitment)).toBe(true);
  });

  it('serves an anonymous event, whose covenant embeds no signature hash', () => {
    const anonymousArtifact = compileString(
      'pragma solidcash ^0.14.0;'
      + ' contract Beacon {'
      + '   int public count;'
      + '   event Ping(int value) anonymous;'
      + '   constructor(int id) { this.count = id; emit Ping(id); }'
      + '   function check(int v) { require(this.count == v); }'
      + ' }',
      { composition: 'framed' },
    );
    const definition = anonymousArtifact.events!.find((event) => event.name === 'Ping')!;
    const genesis = deriveFramedGenesis({
      artifact: anonymousArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [7n], senderLockingBytecode: OWNER_LOCK,
    });
    expect(accepted(genesis.program)).toBe(true);

    const covenant = scriptToBytecode(buildAnonymousEventNftCovenantScript(CATEGORY));
    const lock = encodeLockingBytecodeP2sh32(hash256(covenant));
    const index = genesis.program!.transaction.outputs.findIndex((output) => bytesEqual(output.lockingBytecode, lock));
    expect(index).toBeGreaterThanOrEqual(0);
    const output = genesis.program!.transaction.outputs[index]!;
    const expected = encodeEventCommitment(definition.parameters, [7n]);
    expect(Array.from(output.token!.nft!.commitment)).toStrictEqual(Array.from(expected));
  });
});

/**
 * A constructor that emits without writing state.
 *
 * The event output is still the body's own even when the constructor leaves the state alone: it is materialized
 * beside the record outputs, whose commitments stay at the pre-state. The control mutates the payload off the value
 * the body computed and the machine refuses the transaction.
 */
const ANNOUNCE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Announcer {'
  + '   int public seq;'
  + '   event Announced(int value);'
  + '   constructor(int value) { emit Announced(value); }'
  + '   function check() { require(true); }'
  + ' }';

const announceArtifact = compileString(ANNOUNCE_SOURCE, { composition: 'framed' });
const announced = announceArtifact.events!.find((definition) => definition.name === 'Announced')!;

describe('a framed genesis whose constructor emits without writing state', () => {
  let announcing: ReturnType<typeof deriveFramedGenesis> | undefined;
  const announceGenesis = (): ReturnType<typeof deriveFramedGenesis> => {
    announcing ??= deriveFramedGenesis({
      artifact: announceArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [9n], senderLockingBytecode: OWNER_LOCK,
    });
    return announcing;
  };

  it('accepts the derivation and publishes the event the body emitted', () => {
    const genesis = announceGenesis();
    expect(accepted(genesis.program)).toBe(true);
    expect(genesis.events.map((event) => event.eventSignature)).toStrictEqual([announced.signature]);
    const expected = encodeEventCommitment(announced.parameters, [9n]);
    expect(Array.from(genesis.events[0]!.commitment)).toStrictEqual(Array.from(expected));
  });

  it('refuses an event payload off the value the frame computed', () => {
    const genesis = announceGenesis();
    const program = genesis.program!;
    const index = program.transaction.outputs.findIndex(
      (output) => bytesEqual(output.lockingBytecode, eventCovenantLockFor(CATEGORY, announced.signature)),
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const offValue = encodeEventCommitment(announced.parameters, [10n]);
    expect(accepted(withMutatedEventPayload(program, index, offValue))).toBe(false);
  });
});

/**
 * A constructor that writes one mapping entry. A genesis starts from an empty sorted list, so the write is an
 * insertion: the head sentinel is relinked to the new key's slot and the new node is created carrying the value.
 * The nodes come from the shipped planner against the empty list, and the block's segment declares the pair, which
 * is what the master's own batch derivation reads and its settlement chains.
 */
const MAPPING_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Registry {'
  + '   int public count;'
  + '   mapping(address => int) public balances;'
  + '   constructor(address admin, int seed) { this.count = seed + 1; this.balances[admin] = seed; }'
  + '   function touch() { require(true); }'
  + ' }';

const mappingArtifact = compileString(MAPPING_SOURCE, { composition: 'framed' });
const mappingStateLayout = mappingArtifact.stateLayout!;
const MAPPING_ADMIN = new Uint8Array(20).fill(7);
const MAPPING_SEED = 5n;

/** The nodes the shipped planner materializes for the constructor's write against the empty list. The constructor
 * argument reaches the frame through the shipped encoder, so the plan keys the same normalized form. */
const mappingWritePlan = planMappingWrite({
  keys: [encodeFunctionArgument(MAPPING_ADMIN, 'address') as Uint8Array],
  value: encodeIntegerValue(MAPPING_SEED),
  inventory: [headSentinelCommitment()],
  encodeValue: (value) => value,
});
const MAPPING_HEAD_AFTER = mappingWritePlan.written[0]!.after;
const MAPPING_CREATED = mappingWritePlan.written[1]!.after;

/** The entry covenant the mapping's nodes sit at, derived from the collection's signature. */
const mappingEntryLock = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(
  buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(mappingStateLayout.collections![0]!.signature)),
)));

let mapping: ReturnType<typeof deriveFramedGenesis> | undefined;
const mappingGenesis = (): ReturnType<typeof deriveFramedGenesis> => {
  mapping ??= deriveFramedGenesis({
    artifact: mappingArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
    provider: compositionProvider(), constructorArgs: [MAPPING_ADMIN, MAPPING_SEED],
    senderLockingBytecode: OWNER_LOCK,
  });
  return mapping;
};

/** The index of the entry output whose commitment is `commitment`, or `-1` when none carries it. */
function entryOutputIndex(program: VmProgram | undefined, commitment: Uint8Array): number {
  return program!.transaction.outputs.findIndex((output) => (
    bytesEqual(output.lockingBytecode, mappingEntryLock)
    && bytesEqual(output.token?.nft?.commitment ?? new Uint8Array(0), commitment)
  ));
}

/** The program with the output at `index` carrying a commitment off the value a frame computed. */
function withOutputCommitment(program: VmProgram, index: number, commitment: Uint8Array): VmProgram {
  const outputs = program.transaction.outputs.map((output, at) => (
    at === index && output.token !== undefined
      ? { ...output, token: { ...output.token, nft: { ...output.token.nft!, commitment } } }
      : output
  ));
  return { ...program, transaction: { ...program.transaction, outputs } };
}

describe('a framed genesis whose constructor writes a mapping entry', () => {
  it('mints the record, the relinked head and the created node from the shipped encoders', () => {
    const genesis = mappingGenesis();
    expect(genesis.commitments).toStrictEqual([buildPushdataCommitment(mappingStateLayout, { count: 6n }, 0)]);
    expect(genesis.entries).toStrictEqual([
      { collection: 'balances', commitment: Buffer.from(MAPPING_HEAD_AFTER).toString('hex') },
      { collection: 'balances', commitment: Buffer.from(MAPPING_CREATED).toString('hex') },
    ]);
    // The head sentinel is relinked to the key's slot and the created node carries the value the write stored.
    expect(Buffer.from(MAPPING_HEAD_AFTER).toString('hex'))
      .not.toBe(Buffer.from(headSentinelCommitment()).toString('hex'));
  });

  it('builds a transaction whose entry outputs carry those commitments, accepted by the machine', () => {
    const genesis = mappingGenesis();
    const headIndex = entryOutputIndex(genesis.program, MAPPING_HEAD_AFTER);
    const createdIndex = entryOutputIndex(genesis.program, MAPPING_CREATED);
    expect(headIndex).toBeGreaterThanOrEqual(0);
    expect(createdIndex).toBeGreaterThanOrEqual(0);
    expect(accepted(genesis.program)).toBe(true);
  });

  it('refuses a created node the frame did not compute', () => {
    const genesis = mappingGenesis();
    expect(accepted(genesis.program)).toBe(true);
    const index = entryOutputIndex(genesis.program, MAPPING_CREATED);
    const wrong = new Uint8Array(MAPPING_CREATED);
    wrong[wrong.length - 1] = 0x09;
    expect(accepted(withOutputCommitment(genesis.program!, index, wrong))).toBe(false);
  });

  it('refuses a relinked head the frame did not compute', () => {
    const genesis = mappingGenesis();
    const index = entryOutputIndex(genesis.program, MAPPING_HEAD_AFTER);
    const wrong = new Uint8Array(MAPPING_HEAD_AFTER);
    wrong[32] = 0x01;
    expect(accepted(withOutputCommitment(genesis.program!, index, wrong))).toBe(false);
  });

  it('derives a mapping-only constructor, whose whole state is the list it writes', () => {
    const plain = compileString(
      'pragma solidcash ^0.14.0;'
      + ' contract Reg {'
      + '   mapping(address => int) public balances;'
      + '   constructor(address admin) { this.balances[admin] = 1; }'
      + '   function touch() { require(true); }'
      + ' }',
      { composition: 'framed' },
    );
    const genesis = deriveFramedGenesis({
      artifact: plain, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [MAPPING_ADMIN], senderLockingBytecode: OWNER_LOCK,
    });
    expect(genesis.commitments).toStrictEqual([]);
    expect(genesis.entries.map((entry) => entry.collection)).toStrictEqual(['balances', 'balances']);
    expect(accepted(genesis.program)).toBe(true);
  });

  it('derives a constructor that writes two collections, one batch per collection in the order it verifies them', () => {
    const multi = compileString(
      'pragma solidcash ^0.14.0;'
      + ' contract Multi {'
      + '   mapping(address => int) public first;'
      + '   mapping(address => int) public second;'
      + '   constructor(address who) { this.first[who] = 1; this.second[who] = 2; }'
      + '   function touch() { require(true); }'
      + ' }',
      { composition: 'framed' },
    );
    const genesis = deriveFramedGenesis({
      artifact: multi, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [MAPPING_ADMIN], senderLockingBytecode: OWNER_LOCK,
    });
    // Each collection's own head is relinked to its own node, which carries the value the body wrote under the key.
    const planned = (value: bigint): MappingWritePlan => planMappingWrite({
      keys: [encodeFunctionArgument(MAPPING_ADMIN, 'address') as Uint8Array],
      value: encodeIntegerValue(value),
      inventory: [headSentinelCommitment()],
      encodeValue: (encoded) => encoded,
    });
    expect(genesis.entries).toStrictEqual([
      ...planned(1n).written.map((node) => ({ collection: 'first', commitment: binToHex(node.after) })),
      ...planned(2n).written.map((node) => ({ collection: 'second', commitment: binToHex(node.after) })),
    ]);
    expect(accepted(genesis.program)).toBe(true);
  });

  it('derives a struct literal as a mapping value, the node carrying the encoding the body computed', () => {
    const seeded = compileString(
      'pragma solidcash ^0.14.0;'
      + ' struct Terms { address who; int start; }'
      + ' contract Seeded {'
      + '   mapping(int => Terms) public terms;'
      + `   constructor(address who) { this.terms[7] = Terms(0x${binToHex(encodeLockingBytecodeP2pkh(alicePkh))}, 5); }`
      + '   function touch() { require(true); }'
      + ' }',
      { composition: 'framed' },
    );
    const genesis = deriveFramedGenesis({
      artifact: seeded, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [MAPPING_ADMIN], senderLockingBytecode: OWNER_LOCK,
    });
    const value = encodeChunkableValueTail(encodePushdataValue(
      { who: encodeLockingBytecodeP2pkh(alicePkh), start: 5n }, 'Terms', seeded.structs,
    ));
    const plan = planMappingWrite({
      keys: [encodeIntegerValue(7n)], value, inventory: [headSentinelCommitment()], encodeValue: (encoded) => encoded,
    });
    expect(genesis.entries).toStrictEqual(plan.written.map((node) => ({
      collection: 'terms', commitment: binToHex(node.after),
    })));
    expect(accepted(genesis.program)).toBe(true);
  });
});

/**
 * A constructor that writes two keys of one mapping, which the body verifies as one sorted batch.
 *
 * The genesis starts from the empty list, so both targets insert: the batch planner relinks the shared head
 * sentinel and creates one node per target. The values are the body's to compute, so each created node's
 * commitment is learned from the body's own close rather than declared in advance.
 */
const BATCH_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Split {'
  + '   int public count;'
  + '   mapping(address => int) public balances;'
  + '   constructor(address first, address second, int seed) {'
  + '     this.count = seed + 1;'
  + '     this.balances[first] = seed;'
  + '     this.balances[second] = seed + 1;'
  + '   }'
  + '   function touch() { require(true); }'
  + ' }';

const batchArtifact = compileString(BATCH_SOURCE, { composition: 'framed' });
const batchLayout = batchArtifact.stateLayout!;
const BATCH_FIRST = new Uint8Array(20).fill(0x31);
const BATCH_SECOND = new Uint8Array(20).fill(0x32);
const BATCH_SEED = 8n;

/** The batch the shipped planner materializes for the constructor's two writes against the empty list. The
 * constructor arguments reach the frame through the shipped encoder, so the plan keys the same normalized form. */
const batchPlan = planMappingBatch({
  writes: [
    { keys: [encodeFunctionArgument(BATCH_FIRST, 'address') as Uint8Array], value: BATCH_SEED },
    { keys: [encodeFunctionArgument(BATCH_SECOND, 'address') as Uint8Array], value: BATCH_SEED + 1n },
  ],
  inventory: [headSentinelCommitment()],
  encodeValue: encodeIntegerValue,
});

/** The entry covenant the batch's nodes sit at. */
const batchEntryLock = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(
  buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(batchLayout.collections![0]!.signature)),
)));

let batch: ReturnType<typeof deriveFramedGenesis> | undefined;
const batchGenesis = (): ReturnType<typeof deriveFramedGenesis> => {
  batch ??= deriveFramedGenesis({
    artifact: batchArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
    provider: compositionProvider(), constructorArgs: [BATCH_FIRST, BATCH_SECOND, BATCH_SEED],
    senderLockingBytecode: OWNER_LOCK,
  });
  return batch;
};

/** The index of the entry output carrying `commitment`, or `-1` when none carries it. */
function batchEntryOutputIndex(program: VmProgram | undefined, commitment: Uint8Array): number {
  return program!.transaction.outputs.findIndex((output) => (
    bytesEqual(output.lockingBytecode, batchEntryLock)
    && bytesEqual(output.token?.nft?.commitment ?? new Uint8Array(0), commitment)
  ));
}

describe('a framed genesis whose constructor writes one mapping as a sorted batch', () => {
  it('mints the relinked head and both created nodes from the shipped batch planner', () => {
    const genesis = batchGenesis();
    expect(genesis.commitments).toStrictEqual([
      buildPushdataCommitment(batchLayout, { count: BATCH_SEED + 1n }, 0),
    ]);
    expect(genesis.entries).toStrictEqual(batchPlan.written.map((node) => ({
      collection: 'balances', commitment: Buffer.from(node.after).toString('hex'),
    })));
  });

  it('builds a transaction whose entry outputs carry those commitments, accepted by the machine', () => {
    const genesis = batchGenesis();
    expect(batchPlan.written.every((node) => batchEntryOutputIndex(genesis.program, node.after) >= 0)).toBe(true);
    expect(accepted(genesis.program)).toBe(true);
  });

  it('refuses a created node the frame did not compute', () => {
    const genesis = batchGenesis();
    const created = batchPlan.written.filter((node) => !node.existed);
    const index = batchEntryOutputIndex(genesis.program, created[0]!.after);
    expect(index).toBeGreaterThanOrEqual(0);
    const wrong = new Uint8Array(created[0]!.after);
    wrong[wrong.length - 1] = 0x7f;
    expect(accepted(withOutputCommitment(genesis.program!, index, wrong))).toBe(false);
  });
});

/**
 * A constructor that writes a dynamic value, a sorted batch and an event in one frame, the shape the marketplace
 * token contract's constructor has.
 *
 * The dynamic value's chunk records and the batch's node records share one segment: the batch settlement holds
 * the segment's records past its groups to the chunks the body pinned, so the running chunk width must count the
 * dynamic-state chunks the same way it counts a sorted mapping's value chunks.
 */
const BATCH_DYNAMIC_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   string public label;'
  + '   mapping(address => int) public balances;'
  + '   event Moved(address who, int amount);'
  + '   constructor(string text, address first, address second) {'
  + '     this.label = text;'
  + '     this.balances[first] = 1;'
  + '     this.balances[second] = 2;'
  + '     emit Moved(first, 1);'
  + '   }'
  + '   function touch() { require(true); }'
  + ' }';

const batchDynamicArtifact = compileString(BATCH_DYNAMIC_SOURCE, { composition: 'framed' });

describe('a framed genesis whose constructor writes a dynamic value, a sorted batch and an event', () => {
  const derive = (): ReturnType<typeof deriveFramedGenesis> => deriveFramedGenesis({
    artifact: batchDynamicArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
    provider: compositionProvider(), constructorArgs: ['ledger', BATCH_FIRST, BATCH_SECOND],
    senderLockingBytecode: OWNER_LOCK,
  });

  it('accepts the frame and carries the header, the batch nodes and the event', () => {
    const genesis = derive();
    expect(genesis.commitments).toHaveLength(1);
    expect(genesis.entries).toHaveLength(3);
    expect(genesis.chunks).toHaveLength(1);
    expect(genesis.events).toHaveLength(1);
    expect(accepted(genesis.program)).toBe(true);
  });
});

/**
 * A constructor frame beside a call-making entry the master serves.
 *
 * The entry reads another contract and writes a mapping, so it publishes a call site; the head fixes one call
 * count for every body behind its dispatcher, and the served bound is one. A master that makes a call cannot stand
 * alone, so the deployment's constructor frame now carries a validator reference, which the derivation builds, and
 * the probe closes on a declaration rather than on the head's standalone refusal.
 */
const SERVED_CALL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IOracle { function get(int id) view returns (int); }'
  + ' contract Feed {'
  + '   address public oracle;'
  + '   mapping(int => int) public log;'
  + '   constructor(address o) { this.oracle = o; }'
  + '   function readBack(int id) {'
  + '     int x = IOracle(this.oracle).get(id);'
  + '     this.log[id] = x + 1;'
  + '     require(true);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

const servedCallArtifact = compileString(SERVED_CALL_SOURCE, { composition: 'framed' });
const servedCallLayout = servedCallArtifact.stateLayout!;
const ORACLE_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(5));

describe('a framed genesis beside a call-making entry the master serves', () => {
  const refinedGenesis = (): ReturnType<typeof deriveFramedGenesis> => deriveFramedGenesis({
    artifact: servedCallArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
    provider: compositionProvider(), constructorArgs: [ORACLE_LOCK], senderLockingBytecode: OWNER_LOCK,
  });

  it('serves the call-making entry and publishes the call site for its read', () => {
    const composition = servedCallArtifact.composition!;
    expect(composition.refusedEntries ?? []).toStrictEqual([]);
    const entry = (name: string): readonly { readonly functionName: string }[] =>
      composition.stopSites?.entries.find((candidate) => candidate.functionName === name)?.calls ?? [];
    expect(entry('Feed.readBack()').map((call) => call.functionName)).toStrictEqual(['get']);
    expect(entry('Feed.ping()')).toStrictEqual([]);
  });

  it('accepts the constructor frame and carries the state the constructor computed', () => {
    const genesis = refinedGenesis();
    expect(accepted(genesis.program)).toBe(true);
    const expected = buildPushdataCommitment(servedCallLayout, { oracle: ORACLE_LOCK }, 0);
    expect(genesis.commitments[0]).toBe(expected);
  });
});

/**
 * A constructor that writes a dynamic value from its own parameter.
 *
 * A `string` is not held in the data NFT that declares it: the NFT carries the value's length and the bytes live in
 * a run of chunk NFTs. The value is one of the constructor's arguments, so the deployment can state the run before
 * the body runs and declare it; the body's own close still settles the header commitment. A later literal write
 * replaces an earlier one, and the artifact publishes that literal, so the deployment states it.
 */
const DYNAMIC_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Named {'
  + '   string public name;'
  + '   constructor(string n) { this.name = n; }'
  + '   function peek() external returns (int) { return 0; }'
  + ' }';

const dynamicArtifact = compileString(DYNAMIC_SOURCE, { composition: 'framed' });
const dynamicLayout = dynamicArtifact.stateLayout!;

const dynamicGenesis = (value: string): ReturnType<typeof deriveFramedGenesis> => deriveFramedGenesis({
  artifact: dynamicArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
  provider: compositionProvider(), constructorArgs: [value], senderLockingBytecode: OWNER_LOCK,
});

const utf8 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'utf8'));

describe('a framed genesis whose constructor writes a dynamic value', () => {
  it('accepts the frame and carries the header and chunk the body computed', () => {
    const genesis = dynamicGenesis('hello');
    expect(accepted(genesis.program)).toBe(true);
    // The data NFT carries the value's length, from the shipped pushdata encoder.
    expect(genesis.commitments[0]).toBe(buildPushdataCommitment(dynamicLayout, { name: 'hello' }, 0));
    const run = planChunkRun({ layout: dynamicLayout, variable: 'name', spent: new Uint8Array(0), written: utf8('hello') });
    expect(genesis.chunks.map((chunk) => chunk.commitment)).toStrictEqual(
      run.written.chunks.map((commitment) => Buffer.from(commitment).toString('hex')),
    );
    expect(genesis.chunks.map((chunk) => chunk.index)).toStrictEqual([0]);
  });

  it('places a run of more than one chunk for a value that crosses a chunk boundary', () => {
    const value = 'x'.repeat(200);
    const genesis = dynamicGenesis(value);
    expect(accepted(genesis.program)).toBe(true);
    const run = planChunkRun({
      layout: dynamicLayout, variable: 'name', spent: new Uint8Array(0), written: utf8(value),
    });
    expect(run.written.chunks).toHaveLength(2);
    expect(genesis.chunks.map((chunk) => chunk.commitment)).toStrictEqual(
      run.written.chunks.map((commitment) => Buffer.from(commitment).toString('hex')),
    );
  });

  it('states the literal the last write leaves, which the artifact publishes over the concat', () => {
    // The constructor writes a concat and then the literal "c". The value the body leaves is the literal, and
    // the artifact publishes that source, so the deployment states its run. A value no source names, such as a
    // concat of constructor arguments, is refused by name rather than planned.
    const runtime = compileString(
      'pragma solidcash ^0.14.0;'
      + ' contract Named {'
      + '   string public name;'
      + '   constructor(int n) { this.name = string.concat("a", "b"); this.name = "c"; }'
      + '   function peek() external returns (int) { return 0; }'
      + ' }',
      { composition: 'framed' },
    );
    expect(runtime.abi.find((row) => row.name === '__construct')?.dynamicWriteSources?.name)
      .toMatchObject({ kind: 'literal', value: 'c', type: 'string' });
    const genesis = deriveFramedGenesis({
      artifact: runtime, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [1n], senderLockingBytecode: OWNER_LOCK,
    });
    expect(accepted(genesis.program)).toBe(true);
    expect(genesis.commitments[0]).toBe(buildPushdataCommitment(runtime.stateLayout!, { name: 'c' }, 0));
    const run = planChunkRun({
      layout: runtime.stateLayout!, variable: 'name', spent: new Uint8Array(0), written: utf8('c'),
    });
    expect(genesis.chunks.map((chunk) => chunk.commitment)).toStrictEqual(
      run.written.chunks.map((commitment) => Buffer.from(commitment).toString('hex')),
    );
  });

  it('mints the chunk at the value covenant in the deployment transaction the SDK builds', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: '24'.repeat(31) + 'db', vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funding.address, fundingUtxo);

    const { tx } = await StatefulContract.deploy(dynamicArtifact, ['hello'], {
      provider,
      fundingUtxo,
      funder: funding.unlock.spend(alicePub, signature),
      changeAddress: funding.address,
    });
    const outputs = (tx as unknown as DeployedTransaction).outputs;
    // The deployment mints the category from the funding outpoint, which is the category the chunk covenant uses.
    const lock = chunkRecordLockingBytecode(fundingUtxo.txid, 'name', 'string');
    const chunkOutput = outputs.find((output) => bytesEqual(output.lockingBytecode, lock));
    expect(chunkOutput).toBeDefined();
    expect(chunkOutput!.token?.nft?.capability).toBe('mutable');
    const run = planChunkRun({ layout: dynamicLayout, variable: 'name', spent: new Uint8Array(0), written: utf8('hello') });
    expect(chunkOutput!.token?.nft?.commitment).toStrictEqual(run.written.chunks[0]);
  });
});

/**
 * A constructor the compiler refused.
 *
 * The refused body is emitted as one that fails whenever the head dispatches to it, so a genesis that probed it
 * would stop at that stub with an opcode. Before the compiler refused a constructor's balance read, the probe
 * answered it with the derivation's own synthetic inputs and the deployment minted that as state. The artifact
 * publishes the refusal, and the deployment reads it and refuses by name before it builds or broadcasts anything.
 */
const BALANCE_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Peek {'
  + '   int public seen;'
  + '   constructor(address who) { this.seen = who.balance; }'
  + '   function note() { this.seen = this.seen + 1; require(true); }'
  + ' }';

const PEEK_REFUSAL = 'the constructor of "Peek" is refused by the compiler (Peek.__construct()): the constructor reads '
  + 'the balance of an address other than its own, which a transaction shows only in the inputs it spends';

describe('a framed genesis whose constructor the compiler refused', () => {
  const refusedArtifact = compileString(BALANCE_SOURCE, { composition: 'framed' });

  it('is refused by name, with the reason the artifact publishes', () => {
    expect(refusedArtifact.composition?.refusedEntries?.map((entry) => entry.functionName))
      .toStrictEqual(['Peek.__construct()']);
    expect(() => deriveFramedGenesis({
      artifact: refusedArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [OWNER_LOCK], senderLockingBytecode: OWNER_LOCK,
    })).toThrow(PEEK_REFUSAL);
  });

  it('answers with the publication whatever the refusal, rather than probing the body', () => {
    // The served constructor of the vault, with a refusal stated on its artifact: the derivation reads the
    // publication, so a body it could have run is still refused by the reason stated.
    const stated = {
      ...artifact,
      composition: {
        ...artifact.composition!,
        refusedEntries: [{ functionName: 'Vault.__construct()', reason: 'stated for this case' }],
      },
    };
    const options = {
      category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
      constructorArgs: [5n], senderLockingBytecode: OWNER_LOCK,
    };
    expect(() => deriveFramedGenesis({ ...options, artifact: stated }))
      .toThrow('the constructor of "Vault" is refused by the compiler (Vault.__construct()): stated for this case');
    // An entry's refusal is not the constructor's: the same artifact refusing only `check` still derives.
    const entryRefused = {
      ...artifact,
      composition: {
        ...artifact.composition!,
        refusedEntries: [{ functionName: 'Vault.check()', reason: 'stated for this case' }],
      },
    };
    expect(deriveFramedGenesis({ ...options, artifact: entryRefused }).commitments[0])
      .toBe(Buffer.from(expectedCommitment(6n)).toString('hex'));
  });

  it('refuses through the shipped deployment, which builds and broadcasts nothing', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: '25'.repeat(31) + 'da', vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funding.address, fundingUtxo);

    await expect(StatefulContract.deploy(refusedArtifact, [OWNER_LOCK], {
      provider,
      fundingUtxo,
      funder: funding.unlock.spend(alicePub, signature),
      changeAddress: funding.address,
    })).rejects.toThrow(PEEK_REFUSAL);
    // The funding coin is still unspent and the category it would have minted holds nothing.
    expect((await provider.getUtxos(funding.address)).map((utxo) => utxo.txid)).toContain(fundingUtxo.txid);
    expect(await provider.getUtxosByTokenCategory(fundingUtxo.txid)).toStrictEqual([]);
  });

  it('refuses by name a constructor that runs a body the master cannot serve', async () => {
    // The constructor invokes a refused entry, whose stub its probe used to stop at with an opcode; the closure
    // refuses the constructor with that body, and the deployment answers with the reason.
    const runner = compileString('pragma solidcash ^0.14.0;'
      + ' contract Runner {'
      + '   int public seen;'
      + '   constructor() { bad(); this.seen = 1; }'
      + '   function bad() returns (function(int) external returns (int)) { revert("no"); }'
      + '   function note() { this.seen = this.seen + 1; require(true); }'
      + ' }', { composition: 'framed' });
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: '26'.repeat(31) + 'd9', vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funding.address, fundingUtxo);

    await expect(StatefulContract.deploy(runner, [], {
      provider,
      fundingUtxo,
      funder: funding.unlock.spend(alicePub, signature),
      changeAddress: funding.address,
    })).rejects.toThrow('the constructor of "Runner" is refused by the compiler (Runner.__construct()): it runs '
      + '\'bad\', which the master cannot serve');
    expect(await provider.getUtxosByTokenCategory(fundingUtxo.txid)).toStrictEqual([]);
  });
});

/**
 * A constructor that hashes a runtime value.
 *
 * A body that calls keccak256 reads one compute side-car per call immediately after the frame's own input, so the
 * genesis co-spends them the way a call site lays them for an entry: the frame's own arguments state each call's
 * preimage where the artifact names one, and the side-car's own builder commits the hash the body reads back, so
 * the state the deployment mints is the value the constructor stored. A preimage the artifact does not name is one
 * the body computes: the plan lays that side-car around a placeholder and the loop settles the witness from the
 * body's own bind, exactly as it learns an unstated write. The control is a hash inside a loop, whose side-car
 * count the artifact cannot fix.
 */
const HASH_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Hasher {'
  + '   bytes32 public h;'
  + '   constructor(bytes32 seed) { this.h = keccak256(seed); }'
  + '   function peek() returns (bytes32) { return this.h; }'
  + ' }';

const hashArtifact = compileString(HASH_SOURCE, { composition: 'framed' });
const hashLayout = hashArtifact.stateLayout!;
const HASH_SEED = new Uint8Array(32).fill(0x5a);

/** The commitment the constructor's own write produces for the hash of a preimage. */
const hashCommitment = (preimage: Uint8Array, layout = hashLayout): string =>
  buildPushdataCommitment(layout, { h: Uint8Array.from(keccak_256(preimage)) }, 0);

const hashGenesis = (seed: Uint8Array = HASH_SEED): ReturnType<typeof deriveFramedGenesis> =>
  deriveFramedGenesis({
    artifact: hashArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
    provider: compositionProvider(), constructorArgs: [seed], senderLockingBytecode: OWNER_LOCK,
  });

describe('a framed genesis whose constructor hashes a runtime value', () => {
  it('serves the body, co-spends its compute side-car and carries the hash it read back', () => {
    const constructorAbi = hashArtifact.abi.find((row) => row.name === '__construct')!;
    expect(hashArtifact.composition?.refusedEntries ?? []).toStrictEqual([]);
    expect(constructorAbi.keccakCompute).toBe(true);
    expect(constructorAbi.keccakPreimageParams).toStrictEqual(['seed']);

    const genesis = hashGenesis();
    expect(accepted(genesis.program)).toBe(true);
    expect(genesis.commitments).toStrictEqual([hashCommitment(HASH_SEED)]);
  });

  it('lays the side-car immediately after the frame\'s own input, carrying the hash as its commitment', () => {
    const program = hashGenesis().program!;
    const sideCar = program.transaction.inputs[program.inputIndex + 1]!;
    expect(sideCar.unlockingBytecode.length).toBeGreaterThan(0);
    expect(Array.from(program.transaction.outputs[program.inputIndex + 1]!.token!.nft!.commitment))
      .toStrictEqual(Array.from(keccak_256(HASH_SEED)));
  });

  it('settles a preimage the artifact does not name, from the body\'s own bind', () => {
    const computed = compileString('pragma solidcash ^0.14.0;'
      + ' contract Hasher {'
      + '   bytes32 public h;'
      + '   constructor(bytes seed) { this.h = keccak256(bytes.concat(seed, hex"01")); }'
      + '   function peek() returns (bytes32) { return this.h; }'
      + ' }', { composition: 'framed' });
    const seed = new Uint8Array([3, 1, 4, 1, 5]);
    const genesis = deriveFramedGenesis({
      artifact: computed, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [seed], senderLockingBytecode: OWNER_LOCK,
    });

    expect(accepted(genesis.program)).toBe(true);
    expect(genesis.commitments).toStrictEqual([
      hashCommitment(new Uint8Array([...seed, 0x01]), computed.stateLayout!),
    ]);
  });

  it('mints the hash in the deployment transaction the SDK builds', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: '27'.repeat(31) + 'd8', vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funding.address, fundingUtxo);

    const { tx } = await StatefulContract.deploy(hashArtifact, [HASH_SEED], {
      provider,
      fundingUtxo,
      funder: funding.unlock.spend(alicePub, signature),
      changeAddress: funding.address,
    });
    const outputs = (tx as unknown as DeployedTransaction).outputs;
    expect(outputs.some((output) => output.token?.nft?.commitment !== undefined
      && Buffer.from(output.token.nft.commitment).toString('hex') === hashCommitment(HASH_SEED))).toBe(true);
  });

  it('refuses a hash inside a loop, whose side-car count the artifact cannot fix, by name', () => {
    const looping = compileString('pragma solidcash ^0.14.0;'
      + ' contract Hasher {'
      + '   bytes32 public h;'
      + '   constructor(bytes32 seed, int turns) {'
      + '     for (int i = 0; i < turns; i = i + 1) { this.h = keccak256(seed); }'
      + '   }'
      + '   function peek() returns (bytes32) { return this.h; }'
      + ' }', { composition: 'framed' });

    expect(() => deriveFramedGenesis({
      artifact: looping, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [HASH_SEED, 2n], senderLockingBytecode: OWNER_LOCK,
    })).toThrow(/hashes inside a loop, so how many compute side-cars it co-spends is the loop's to decide/);
  });

  it('refuses a body that publishes the hash with no framed entry to count its side-cars by', () => {
    // A hand-built publication: the artifact says the body computes, and names no call, so nothing states how many
    // side-cars its frame reads. The refusal answers that rather than building a frame the machine cannot run.
    const stated = {
      ...hashArtifact,
      abi: hashArtifact.abi.map((row) => (row.name === '__construct' ? { ...row, keccakPreimageParams: [] } : row)),
    };
    expect(() => deriveFramedGenesis({
      artifact: stated, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [HASH_SEED], senderLockingBytecode: OWNER_LOCK,
    })).toThrow(/publishes keccakCompute with no framed entry, so this deployment cannot tell how many compute/);
  });
});

/**
 * A constructor that hashes a runtime value beside a dynamic write.
 *
 * The compiler publishes the source of a dynamic value a constructor writes only when it can state the value on
 * every completing path. A call it cannot resolve to a declared body is charged as a possible mutation of any
 * dynamic value, and a call to a global builtin — which computes from its own operands and writes nothing — used to
 * carry that charge too, so a constructor that hashed before it stored lost the source of what it stored and no
 * genesis could state the run its write creates. With the builtin ruled out, the source is published and the frame
 * settles through the shipped deploy path: the record carries the hash the body read back and the chunk the shipped
 * encoder sizes. The control is a value a call the replay cannot rule out produces, which stays unstated and is
 * refused by name.
 */
const HASHED_DYNAMIC_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Tag {'
  + '   bytes32 public digest;'
  + '   string public label;'
  + '   constructor(bytes32 seed, string text) { this.digest = keccak256(seed); this.label = text; }'
  + '   function peek() returns (bytes32) { return this.digest; }'
  + ' }';

const hashedDynamicArtifact = compileString(HASHED_DYNAMIC_SOURCE, { composition: 'framed' });
const hashedDynamicLayout = hashedDynamicArtifact.stateLayout!;
const HASHED_SEED = new Uint8Array(32).map((_unused, index) => (index * 13 + 7) & 0xff);
const HASHED_TEXT = 'tagged';

/** The commitment the constructor's own writes produce, through the shipped pushdata encoder. */
const hashedDynamicCommitment = (layout = hashedDynamicLayout): string =>
  buildPushdataCommitment(layout, { digest: Uint8Array.from(keccak_256(HASHED_SEED)), label: HASHED_TEXT }, 0);

const hashedDynamicGenesis = (): ReturnType<typeof deriveFramedGenesis> => deriveFramedGenesis({
  artifact: hashedDynamicArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
  provider: compositionProvider(), constructorArgs: [HASHED_SEED, HASHED_TEXT], senderLockingBytecode: OWNER_LOCK,
});

describe('a framed genesis whose constructor hashes beside a dynamic write', () => {
  it('publishes the dynamic source and settles the frame the shipped encoders describe', () => {
    const constructorAbi = hashedDynamicArtifact.abi.find((row) => row.name === '__construct')!;
    expect(constructorAbi.keccakCompute).toBe(true);
    expect(constructorAbi.dynamicWriteSources?.label)
      .toMatchObject({ kind: 'source', source: { kind: 'forward', paramIndex: 1 } });

    const genesis = hashedDynamicGenesis();
    expect(accepted(genesis.program)).toBe(true);
    expect(genesis.commitments).toStrictEqual([hashedDynamicCommitment()]);
    const run = planChunkRun({
      layout: hashedDynamicLayout, variable: 'label', spent: new Uint8Array(0), written: utf8(HASHED_TEXT),
    });
    expect(genesis.chunks.map((chunk) => chunk.commitment))
      .toStrictEqual(run.written.chunks.map((commitment) => Buffer.from(commitment).toString('hex')));
  });

  it('mints the hash and the chunk in the deployment transaction the SDK builds', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = {
      txid: Buffer.from(sha256(new TextEncoder().encode('a hashed dynamic genesis'))).toString('hex'),
      vout: 0, satoshis: 500_000n,
    };
    await provider.addUtxo(funding.address, fundingUtxo);

    const { tx } = await StatefulContract.deploy(hashedDynamicArtifact, [HASHED_SEED, HASHED_TEXT], {
      provider,
      fundingUtxo,
      funder: funding.unlock.spend(alicePub, signature),
      changeAddress: funding.address,
    });
    const outputs = (tx as unknown as DeployedTransaction).outputs;
    expect(outputs.some((output) => output.token?.nft?.commitment !== undefined
      && Buffer.from(output.token.nft.commitment).toString('hex') === hashedDynamicCommitment())).toBe(true);
    const chunk = outputs.find(
      (output) => bytesEqual(output.lockingBytecode, chunkRecordLockingBytecode(fundingUtxo.txid, 'label', 'string')),
    );
    expect(chunk).toBeDefined();
    expect(chunk!.token?.nft?.capability).toBe('mutable');
  });

  it('refuses a dynamic value a call the replay cannot rule out produces, by name', () => {
    const concatenated = compileString('pragma solidcash ^0.14.0;'
      + ' contract Tag {'
      + '   bytes32 public digest;'
      + '   string public label;'
      + '   constructor(bytes32 seed, string left, string right) {'
      + '     this.digest = keccak256(seed);'
      + '     this.label = string.concat(left, right);'
      + '   }'
      + '   function peek() returns (bytes32) { return this.digest; }'
      + ' }', { composition: 'framed' });

    expect(concatenated.abi.find((row) => row.name === '__construct')?.dynamicWriteSources?.label).toBeUndefined();
    expect(() => deriveFramedGenesis({
      artifact: concatenated, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
      provider: compositionProvider(), constructorArgs: [HASHED_SEED, 'left', 'right'], senderLockingBytecode: OWNER_LOCK,
    })).toThrow(/writes dynamic "label", which the artifact publishes no value source for/);
  });
});

/**
 * A constructor that hashes three runtime values, two named by the artifact and one the body computes.
 *
 * The frame reads one compute side-car per call, in the order the body makes them, so the genesis co-spends three
 * after its own input: the two the artifact names take the corresponding argument as their preimage, and the third
 * is one the body computes, learned from the body's own bind the way an unstated write is. The state the
 * deployment mints carries all three hashes the constructor stored.
 */
const TRIO_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Trio {'
  + '   bytes32 public first;'
  + '   bytes32 public second;'
  + '   bytes32 public third;'
  + '   constructor(bytes32 a, bytes32 b) {'
  + '     this.first = keccak256(a);'
  + '     this.second = keccak256(b);'
  + '     this.third = keccak256(bytes.concat(a, b));'
  + '   }'
  + '   function peek() returns (bytes32) { return this.first; }'
  + ' }';

const trioArtifact = compileString(TRIO_SOURCE, { composition: 'framed' });
const trioLayout = trioArtifact.stateLayout!;
/** Two distinct 32-byte seeds, filled from different strides so neither repeats a pattern the project forbids. */
const TRIO_SEED_A = new Uint8Array(32).map((_, index) => (index * 7 + 3) & 0xff);
const TRIO_SEED_B = new Uint8Array(32).map((_, index) => (index * 11 + 5) & 0xff);

const trioGenesis = (): ReturnType<typeof deriveFramedGenesis> => deriveFramedGenesis({
  artifact: trioArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
  provider: compositionProvider(), constructorArgs: [TRIO_SEED_A, TRIO_SEED_B], senderLockingBytecode: OWNER_LOCK,
});

describe('a framed genesis whose constructor hashes three runtime values', () => {
  const hashes = (): readonly Uint8Array[] => [
    Uint8Array.from(keccak_256(TRIO_SEED_A)),
    Uint8Array.from(keccak_256(TRIO_SEED_B)),
    Uint8Array.from(keccak_256(new Uint8Array([...TRIO_SEED_A, ...TRIO_SEED_B]))),
  ];

  it('serves the shape, naming the two parameter preimages and leaving the computed one unnamed', () => {
    const constructorAbi = trioArtifact.abi.find((row) => row.name === '__construct')!;
    expect(trioArtifact.composition?.refusedEntries ?? []).toStrictEqual([]);
    expect(constructorAbi.keccakCompute).toBe(true);
    expect(constructorAbi.keccakPreimageParams).toStrictEqual(['a', 'b', null]);
  });

  it('co-spends one side-car per call, in body order, carrying the hash each call read back', () => {
    const genesis = trioGenesis();
    expect(accepted(genesis.program)).toBe(true);
    const program = genesis.program!;
    const expected = hashes();
    for (let i = 0; i < 3; i += 1) {
      const output = program.transaction.outputs[program.inputIndex + 1 + i]!;
      expect(Array.from(output.token!.nft!.commitment)).toStrictEqual(Array.from(expected[i]!));
    }
  });

  it('mints the three hashes through the shipped encoder', () => {
    const [first, second, third] = hashes();
    expect(trioGenesis().commitments).toStrictEqual([
      buildPushdataCommitment(trioLayout, { first, second, third }, 0),
    ]);
  });
});
