import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import {
  buildAnonymousEventNftCovenantScript, buildEventNftCovenantScript, buildPushdataCommitment, bytesEqual,
  computeEventNameHash, encodeEventCommitment, hash256, scriptToBytecode, sha256, validatorAddress,
} from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { buildValidatorProgram } from '../../../../solidc/src/per-call/validator/index.js';
import { COMPOSITION_LIMITS, compositionMachine, compositionProvider } from '../../../../solidc/test/per-call/machine.js';
import { Contract, SignatureTemplate, StatefulContract } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployMaster, derivePerCallGenesis } from '../../../src/per-call/deploy/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * Deriving a per-call contract's genesis by running its constructor frame.
 *
 * A per-call master carries its frame in the witness block leading its own unlocking bytecode, so the direct
 * deployment's synthetic unlocking is refused by the head before the constructor runs. The derivation here builds
 * the block, runs the shipped, placeholder-filled master in the BCH-2026 machine, and learns the commitments the
 * constructor body computes. The machine accepts only when the record the frame declares and the transaction's
 * output both carry exactly the value the body computed, so a transaction that writes a different value is refused
 * — which is what the mutated control below pins.
 *
 * The last case drives the shipped SDK entry point: `StatefulContract.deploy` detects the artifact's convention and
 * deploys through the derivation above, with no change to the caller.
 */

const CATEGORY = sha256(new TextEncoder().encode('genesis derivation'));
const VALIDATOR_PROGRAM = buildValidatorProgram();
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(9));

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Vault {'
  + '   int public total;'
  + '   constructor(int seed) { this.total = seed + 1; }'
  + '   function check(int v) { require(this.total == v); }'
  + ' }';

const NOARG_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Plain {'
  + '   int public total;'
  + '   constructor() { this.total = 42; }'
  + '   function check() { require(this.total == 42); }'
  + ' }';

const artifact = compileString(SOURCE, { composition: 'per-call' });
const stateLayout = artifact.stateLayout!;

/** The commitment the constructor computes for `seed + 1`, in the shipped encoder's form. */
const expectedCommitment = (total: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(stateLayout, { total }, 0), 'hex'));

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];

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

describe('a per-call genesis derived by running the constructor frame', () => {
  it('publishes the convention and makes the contract address the validator address', () => {
    expect(artifact.composition?.convention).toBe('per-call');
    const master = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    expect([...master.address]).toStrictEqual([...ADDRESS]);
  });

  it('learns the commitment the constructor body computed', () => {
    const genesis = derivePerCallGenesis({
      artifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
      constructorArgs: [5n], senderLockingBytecode: OWNER_LOCK,
    });

    expect(genesis.commitments.length).toBe(stateLayout.dataNftCount);
    expect(genesis.commitments[0]).toBe(Buffer.from(expectedCommitment(6n)).toString('hex'));
  });

  it('the machine accepts the derivation transaction it published', () => {
    const genesis = derivePerCallGenesis({
      artifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
      constructorArgs: [5n], senderLockingBytecode: OWNER_LOCK,
    });

    expect(accepted(genesis.program)).toBe(true);
  });

  it('derives a different state for a different constructor argument', () => {
    const genesis = derivePerCallGenesis({
      artifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
      constructorArgs: [41n], senderLockingBytecode: OWNER_LOCK,
    });

    expect(genesis.commitments[0]).toBe(Buffer.from(expectedCommitment(42n)).toString('hex'));
    expect(accepted(genesis.program)).toBe(true);
  });

  it('derives a contract whose constructor takes no argument', () => {
    const plain = compileString(NOARG_SOURCE, { composition: 'per-call' });
    const genesis = derivePerCallGenesis({
      artifact: plain, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
      constructorArgs: [], senderLockingBytecode: OWNER_LOCK,
    });

    expect(accepted(genesis.program)).toBe(true);
  });

  it('refuses the same transaction when the record output is mutated off the computed value', () => {
    const genesis = derivePerCallGenesis({
      artifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
      constructorArgs: [5n], senderLockingBytecode: OWNER_LOCK,
    });

    expect(accepted(genesis.program)).toBe(true);
    expect(accepted(withMutatedOutput(genesis.program!, expectedCommitment(7n)))).toBe(false);
  });

  it('deploys through the shipped SDK entry point, which selects the convention from the artifact', async () => {
    // The profile the per-call suites run on: a composition's operation-cost density is above a real chain's, so a
    // budget refusal would read as a rule refusal.
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funding = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: '11'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funding.address, fundingUtxo);

    const { contract, categoryId } = await StatefulContract.deploy(artifact, [5n], {
      provider,
      fundingUtxo,
      funder: funding.unlock.spend(alicePub, signature),
      changeAddress: funding.address,
    });

    expect(categoryId).toBe(fundingUtxo.txid);
    expect(contract).toBeDefined();
    // The genesis transaction was built and broadcast: the funding outpoint was spent.
    const remaining = await provider.getUtxos(funding.address);
    expect(remaining.some((utxo) => utxo.txid === fundingUtxo.txid && utxo.vout === 0)).toBe(false);
  });
});

/**
 * A constructor that emits. The event's payload is what the body computes and cannot be declared in advance, so the
 * derivation learns it from the body's own comparison against the output the block lists. The control mutates that
 * payload off the computed value and the machine refuses the transaction.
 */
const EMITTING_SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Registry {'
  + '   int public count;'
  + '   event Registered(int id, string name);'
  + '   constructor(int id) { this.count = id + 1; emit Registered(id, "alpha"); }'
  + '   function check(int v) { require(this.count == v); }'
  + ' }';

const emittingArtifact = compileString(EMITTING_SOURCE, { composition: 'per-call' });
const emittingLayout = emittingArtifact.stateLayout!;

/** The lock an event output carries: the P2SH32 of the covenant the body rebuilds from the category and signature. */
function eventCovenantLock(signature: string): Uint8Array {
  const covenant = scriptToBytecode(buildEventNftCovenantScript(CATEGORY, computeEventNameHash(signature)));
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

describe('a per-call genesis whose constructor emits an event', () => {
  const emittingGenesis = (): ReturnType<typeof derivePerCallGenesis> => derivePerCallGenesis({
    artifact: emittingArtifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM,
    provider: compositionProvider(), constructorArgs: [5n], senderLockingBytecode: OWNER_LOCK,
  });
  const registered = emittingArtifact.events!.find((definition) => definition.name === 'Registered')!;
  const eventOutputIndex = (program: VmProgram): number => program.transaction.outputs.findIndex((output) => (
    bytesEqual(output.lockingBytecode, eventCovenantLock(registered.signature))
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

  it('derives the state the constructor wrote beside the event', () => {
    const genesis = emittingGenesis();
    const expected = new Uint8Array(Buffer.from(buildPushdataCommitment(emittingLayout, { count: 6n }, 0), 'hex'));
    expect(genesis.commitments[0]).toBe(Buffer.from(expected).toString('hex'));
  });

  it('serves an anonymous event, whose covenant embeds no signature hash', () => {
    const anonymousArtifact = compileString(
      'pragma solidcash ^0.13.0;'
      + ' contract Beacon {'
      + '   int public count;'
      + '   event Ping(int value) anonymous;'
      + '   constructor(int id) { this.count = id; emit Ping(id); }'
      + '   function check(int v) { require(this.count == v); }'
      + ' }',
      { composition: 'per-call' },
    );
    const definition = anonymousArtifact.events!.find((event) => event.name === 'Ping')!;
    const genesis = derivePerCallGenesis({
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
