/**
 * Deploying a per-call stateful contract through the shipped SDK entry point.
 *
 * `StatefulContract.deploy` (and the factory path that reaches it) is written for the direct convention: it
 * evaluates the constructor against a synthetic transaction whose unlocking bytecode carries the direct block
 * layout, and it funds one master UTXO and one data NFT per state variable. A per-call master refuses that
 * unlocking — it reads its frame out of a witness block, which the direct shape does not carry — so the deployment
 * is routed here when the artifact publishes `composition.convention === 'per-call'`.
 *
 * The genesis transaction is the same shape the convention's pools expect: a pool of master UTXOs carrying the
 * minting NFT at the master lock, a pool of validator UTXOs at `addrV(category)`, one state record per data NFT
 * carrying the commitment the constructor's own frame computed, and one output per event that frame emitted, at the
 * covenant the body rebuilt. Both pools default to the composing size and are overridden per contract through the
 * deployment options.
 * The state comes from `derivePerCallGenesis`, which runs that frame against the BCH-2026 machine; nothing here
 * supplies a commitment the constructor did not compute.
 *
 * The records are minted at the data-NFT covenant the category derives, the same lock the direct convention's data
 * NFTs sit at, so a composition spends and recreates each record under the covenant's own rules and a spent UTXO
 * there is a genuine record. `records.ts` derives that lock and the unlocking a composed spend carries, and
 * classifies a category's UTXOs to find the records again.
 */

import { binToHex, encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import { perCallValidator } from 'solidc';
import type { Artifact } from '@solidcash/utils';
import type { ConstructorArgument } from '../../Argument.js';
import { Contract } from '../../Contract.js';
import type { DeployOptions, DeployResult } from '../../stateful/stateful-lifecycle-types.js';
import { FACET_SATOSHIS } from '../composer/index.js';
import { derivePerCallGenesis } from './genesis.js';
import { resolveMasterPoolSize } from './pool.js';
import { entryRecordLockingBytecode, stateRecordLockingBytecode } from './records.js';

/** Raised when a per-call deployment cannot be built from the artifact or the options. */
export class PerCallDeployError extends Error {
  public readonly name = 'PerCallDeployError';

  public constructor(message: string) {
    super(message);
  }
}

/** The byte length of the transaction the builder would broadcast, which sizes the default fee. */
async function measuredFee(builder: { buildLibauthTransaction: () => unknown }): Promise<bigint> {
  const { encodeTransaction } = await import('@bitauth/libauth');
  return BigInt(encodeTransaction(builder.buildLibauthTransaction() as never).byteLength);
}

/**
 * Deploys a per-call stateful contract: derives the genesis state from the constructor frame, funds the master and
 * validator pools, mints one state record per data NFT, and returns the connected contract handle.
 */
export async function deployPerCallStatefulContract<T extends Artifact>(
  artifact: T,
  constructorArgs: ConstructorArgument[],
  options: DeployOptions,
): Promise<DeployResult<T>> {
  if (artifact.stateLayout === undefined) {
    throw new PerCallDeployError(`Contract ${artifact.contractName} is not a stateful contract`);
  }
  if (options.fundingUtxo.vout !== 0) {
    throw new PerCallDeployError(
      'Funding UTXO must be at vout 0 to create a valid token category. '
      + `Got vout ${options.fundingUtxo.vout}.`,
    );
  }

  const categoryId = options.fundingUtxo.txid;
  const category = new Uint8Array(hexToBin(categoryId));
  const validatorProgram = perCallValidator.buildValidatorProgram();
  // A per-call artifact publishes no `constructorInputs`, so the factory path that splits a call's arguments
  // between the constructor and the initial state cannot see that this contract takes any: the values arrive as
  // `initArgs`. A caller that reaches `StatefulContract.deploy` directly passes them as the constructor args.
  const constructorValues = constructorArgs.length > 0 ? constructorArgs : (options.initArgs ?? []);
  // The constructor's own frame is entered by the deployer, whose coin funds the genesis. A body that reads
  // `msg.sender` therefore resolves to the funder's lock, not the placeholder a frame with no stated caller uses:
  // a constructor that writes `balances[msg.sender]` (a token's mint) would otherwise seed the placeholder key.
  const funderLock = options.funder.generateLockingBytecode();
  const senderLockingBytecode = funderLock.length === 25 ? funderLock : undefined;
  // Every sorted collection an entry can write needs its empty head sentinel minted here, because a first insert
  // splices beside it. A collection the constructor's own plan writes carries the head that plan relinked, and the
  // genesis filters that one out; a caller that names extra collections (a proxy's) keeps its own too.
  const declaredHeads = (artifact.stateLayout?.collections ?? [])
    .filter((collection) => collection.sorted === true)
    .map((collection) => ({ name: collection.name, signature: collection.signature }));
  const headCollections = [...(options.headCollections ?? []), ...declaredHeads]
    .filter((collection, index, all) => all.findIndex((other) => other.name === collection.name) === index);
  const genesis = derivePerCallGenesis({
    artifact,
    category,
    validatorProgram,
    provider: options.provider,
    constructorArgs: constructorValues,
    ...(senderLockingBytecode === undefined ? {} : { senderLockingBytecode }),
    ...(options.initialState === undefined ? {} : { initialState: options.initialState }),
    ...(headCollections.length === 0 ? {} : { headCollections }),
    ...(options.provider.consensusLimits?.maximumNftCommitmentBytes === undefined
      ? {} : { maximumNftCommitmentBytes: options.provider.consensusLimits.maximumNftCommitmentBytes }),
  });

  const masterAmount = options.masterAmount ?? 1200n;
  const dataNftAmount = options.dataNftAmount ?? 1200n;
  // A state record sits at the data-NFT covenant the category derives, so a composition spends and recreates it
  // under the covenant's own rules rather than at a lock outside them.
  const recordLockingBytecode = stateRecordLockingBytecode(categoryId);
  // The pool the caller asked for, or the composing default: a caller that names `threadCount` or `validatorCount`
  // is authoritative for that count, and the deployment funds exactly the pool it resolved.
  if (options.threadCount !== undefined
    && (!Number.isInteger(options.threadCount) || options.threadCount < 1)) {
    throw new PerCallDeployError(`threadCount must be a positive integer, got ${options.threadCount}`);
  }
  if (options.validatorCount !== undefined
    && (!Number.isInteger(options.validatorCount) || options.validatorCount < 1)) {
    throw new PerCallDeployError(`validatorCount must be a positive integer, got ${options.validatorCount}`);
  }
  const pool = resolveMasterPoolSize({ masters: options.threadCount, validators: options.validatorCount });

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  const builder = new TransactionBuilder({
    provider: options.provider,
    ...(options.maxFee === undefined ? {} : { maximumFeeSatoshis: options.maxFee }),
  });
  builder.addInput(options.fundingUtxo, options.funder);

  for (let index = 0; index < pool.masters; index += 1) {
    builder.addOutput({
      to: genesis.master.lockingBytecode,
      amount: masterAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  // The validator pool: `pool.validators` UTXOs at addrV(category), recreated in place by every composition, so
  // the pool bounds how many compositions the contract can root at once.
  for (let index = 0; index < pool.validators; index += 1) {
    builder.addOutput({
      to: genesis.master.address,
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
  }
  // The facet pool: one tokenless UTXO per facet the validator program binds, at the facet's own lock. A facet
  // holds no token and pins no category, so a composition spends any UTXO of its code.
  for (const code of perCallValidator.buildValidatorFacets()) {
    builder.addOutput({
      to: encodeLockingBytecodeP2sh32(hash256(code)),
      amount: FACET_SATOSHIS,
    });
  }
  // The events the constructor's own frame emitted, at the covenant locks the body rebuilt. They lead the
  // trailing region, ahead of the records the genesis creates, which is the order a composition's outputs use; an
  // event output carries the contract's category with no capability.
  for (const event of genesis.events) {
    builder.addOutput({
      to: event.lockingBytecode,
      amount: dataNftAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'none', commitment: binToHex(event.commitment) },
      },
    });
  }
  for (const commitment of genesis.commitments) {
    builder.addOutput({
      to: recordLockingBytecode,
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
  }
  // The mapping nodes the constructor's frame materialized: the empty list's head sentinel and any node its writes
  // created. Each sits at its collection's entry covenant, so a composition spends and recreates it under the
  // covenant's own rules; the collection's signature derives that lock.
  for (const entry of genesis.entries) {
    // A collection the artifact's own layout publishes carries its signature; one only an entry writes is named by
    // the deployment, which is where the genesis learned to seed its head.
    const signature = entry.signature
      ?? artifact.stateLayout?.collections?.find((candidate) => candidate.name === entry.collection)?.signature;
    if (signature === undefined) {
      throw new PerCallDeployError(
        `genesis minted a node for collection "${entry.collection}", which the artifact does not publish`,
      );
    }
    builder.addOutput({
      to: entryRecordLockingBytecode(categoryId, signature),
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: entry.commitment } },
    });
  }
  // The chunk records the constructor's frame wrote, each at the value's own collection covenant carrying the
  // commitment the shipped chunk encoder produced for the value the constructor stored.
  for (const chunk of genesis.chunks) {
    builder.addOutput({
      to: chunk.lockingBytecode,
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: chunk.commitment } },
    });
  }

  // Immutable CREATE identity anchors: category-bearing discovery records the factory path expects to find at the
  // deploying account's logical address after the genesis.
  for (const anchor of options.identityAnchors ?? []) {
    builder.addOutput({
      to: anchor.to,
      amount: anchor.amount ?? dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment: anchor.commitment } },
    });
  }

  // A placeholder change output so the measured fee includes its serialized size, then the exact change.
  builder.addOutput({ to: options.changeAddress, amount: 1000n });
  const fee = options.fee ?? (await measuredFee(builder)) + 1000n;
  const nonChangeTotal = builder.outputs.slice(0, -1)
    .reduce((sum, output) => sum + output.amount, 0n);
  const finalChange = options.fundingUtxo.satoshis - nonChangeTotal - fee;
  if (finalChange < 0n) {
    throw new PerCallDeployError(
      `Insufficient funding for the pool of ${pool.masters} master(s) and ${pool.validators} validator(s): `
      + `${options.fundingUtxo.satoshis} satoshis provided, but the genesis requires `
      + `${nonChangeTotal + fee} (outputs ${nonChangeTotal}, fee ${fee}).`,
    );
  }
  if (finalChange > 0n) {
    builder.outputs[builder.outputs.length - 1] = {
      ...builder.outputs[builder.outputs.length - 1]!, amount: finalChange,
    };
  } else {
    builder.outputs.pop();
  }

  const tx = await builder.send();

  // A per-call artifact bakes its constructor arguments into the filled program the genesis published rather than
  // into the handle's redeem script, so the handle is built without repeating them.
  const contract = new Contract(artifact, [] as never, {
    provider: options.provider,
    ...(options.addressType === undefined ? {} : { addressType: options.addressType }),
    category,
    ...(options.salt === undefined ? {} : { salt: options.salt }),
  });
  const { StatefulContract: SC } = await import('../../stateful/StatefulContract.js');
  const statefulContract = SC.withCategory(contract, categoryId);
  return { contract: statefulContract, tx, categoryId };
}
