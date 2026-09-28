/**
 * Deploying a per-call stateful contract through the shipped SDK entry point.
 *
 * `StatefulContract.deploy` (and the factory path that reaches it) is written for the direct convention: it
 * evaluates the constructor against a synthetic transaction whose unlocking bytecode carries the direct block
 * layout, and it funds one master UTXO and one data NFT per state variable. A per-call master refuses that
 * unlocking — it reads its frame out of a witness block, which the direct shape does not carry — so the deployment
 * is routed here when the artifact publishes `composition.convention === 'per-call'`.
 *
 * The genesis transaction is the same shape the convention's pools expect: the master's minting NFT at the master
 * lock, a validator UTXO at `addrV(category)`, and one state record per data NFT carrying the commitment the
 * constructor's own frame computed. The state comes from `derivePerCallGenesis`, which runs that frame against the
 * BCH-2026 machine; nothing here supplies a commitment the constructor did not compute.
 *
 * The records are minted at the data-NFT covenant the category derives, the same lock the direct convention's data
 * NFTs sit at, so a composition spends and recreates each record under the covenant's own rules and a spent UTXO
 * there is a genuine record. `records.ts` derives that lock and the unlocking a composed spend carries, and
 * classifies a category's UTXOs to find the records again.
 */

import { hexToBin } from '@bitauth/libauth';
import { perCallValidator } from 'solidc';
import type { Artifact } from '@solidcash/utils';
import type { ConstructorArgument } from '../../Argument.js';
import { Contract } from '../../Contract.js';
import type { DeployOptions, DeployResult } from '../../stateful/stateful-lifecycle-types.js';
import { derivePerCallGenesis } from './genesis.js';
import { stateRecordLockingBytecode } from './records.js';

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
  const genesis = derivePerCallGenesis({
    artifact,
    category,
    validatorProgram,
    provider: options.provider,
    constructorArgs: constructorValues,
    ...(options.initialState === undefined ? {} : { initialState: options.initialState }),
    ...(options.provider.consensusLimits?.maximumNftCommitmentBytes === undefined
      ? {} : { maximumNftCommitmentBytes: options.provider.consensusLimits.maximumNftCommitmentBytes }),
  });

  const masterAmount = options.masterAmount ?? 1200n;
  const dataNftAmount = options.dataNftAmount ?? 1200n;
  // A state record sits at the data-NFT covenant the category derives, so a composition spends and recreates it
  // under the covenant's own rules rather than at a lock outside them.
  const recordLockingBytecode = stateRecordLockingBytecode(categoryId);
  const masterCount = options.threadCount ?? 1;
  if (!Number.isInteger(masterCount) || masterCount < 1) {
    throw new PerCallDeployError(`threadCount must be a positive integer, got ${masterCount}`);
  }

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  const builder = new TransactionBuilder({
    provider: options.provider,
    ...(options.maxFee === undefined ? {} : { maximumFeeSatoshis: options.maxFee }),
  });
  builder.addInput(options.fundingUtxo, options.funder);

  for (let index = 0; index < masterCount; index += 1) {
    builder.addOutput({
      to: genesis.master.lockingBytecode,
      amount: masterAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  // The validator pool: at least one UTXO at addrV(category), recreated in place by every composition.
  builder.addOutput({
    to: genesis.master.address,
    amount: dataNftAmount,
    token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  });
  for (const commitment of genesis.commitments) {
    builder.addOutput({
      to: recordLockingBytecode,
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
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
      `Insufficient funding: ${options.fundingUtxo.satoshis} satoshis provided, but the genesis requires `
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
