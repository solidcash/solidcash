/**
 * Deploying a framed stateful contract through the shipped SDK entry point.
 *
 * `StatefulContract.deploy` (and the factory path that reaches it) is written for the direct convention: it
 * evaluates the constructor against a synthetic transaction whose unlocking bytecode carries the direct block
 * layout, and it funds one master UTXO and one data NFT per state variable. A framed master refuses that
 * unlocking — it reads its frame out of a witness block, which the direct shape does not carry — so the deployment
 * is routed here when the artifact publishes `composition.convention === 'framed'`.
 *
 * The genesis transaction leads with the category's BCMR identity output (and its publication, when it publishes),
 * then takes the shape the convention's pools expect: a pool of master UTXOs carrying the minting NFT at the master
 * lock, a pool of validator UTXOs at `addrV(category)`, one state record per data NFT
 * carrying the commitment the constructor's own frame computed, and one output per event that frame emitted, at the
 * covenant the body rebuilt. Both pools default to the composing size and are overridden per contract through the
 * deployment options.
 * The state comes from `deriveFramedGenesis`, which runs that frame against the BCH-2026 machine; nothing here
 * supplies a commitment the constructor did not compute. The one exception is internal: a proxy's genesis mints the
 * state its own derived `initialize` computed (`mintedState`), so the proxy is never on chain uninitialized.
 *
 * The records are minted at the data-NFT covenant the category derives, the same lock the direct convention's data
 * NFTs sit at, so a composition spends and recreates each record under the covenant's own rules and a spent UTXO
 * there is a genuine record. `records.ts` derives that lock and the unlocking a composed spend carries, and
 * classifies a category's UTXOs to find the records again.
 */

import { encodeLockingBytecodeP2sh32, lockingBytecodeToCashAddress } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { hash256 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import { framedValidator } from '@solidcash/solidc/runtime';
import { bytesEqual, validatorAddress, type Artifact } from '@solidcash/utils';
import type { TransactionDetails } from '../../interfaces.js';
import type { ConstructorArgument } from '../../Argument.js';
import { Contract } from '../../Contract.js';
import type { DeployOptions, DeployResult } from '../../stateful/stateful-lifecycle-types.js';
import { addressToLockScript, getNetworkPrefix } from '../../utils.js';
import { leadingOutputs, type PreparedMetadata } from '../../bcmr/deployment.js';
import { identityRecord, isP2pkhLock, planGenesisIdentity } from '../../bcmr/identity.js';
import { FACET_SATOSHIS } from '../composer/index.js';
import { satoshisAtLeastDust, widestRecordCommitmentBytes } from '../composer/dust.js';
import {
  childGenesisReservation, patchChildCollectionSentinels, patchChildGenesisSlots, patchChildLockSentinels,
  patchChildOutputCount, type ChildGenesisSlots,
} from './child-locks.js';
import { deriveFramedGenesis } from './genesis.js';
import { deployMaster } from './material.js';
import { MasterPoolDeployment, resolveMasterPoolSize } from './pool.js';
import { entryRecordLockingBytecode, stateRecordLockingBytecode } from './records.js';
import { ownCoinRefusal } from './own-coin.js';
import { loadFramedCallHandle } from '../../stateful/framed-call-loader.js';
import { registerFunctionSplit } from './split-registry.js';
import { blockhashRingGenesisOutputs } from '../../oracle/blockhash-ring-deployment.js';
import { labelNextBroadcast } from '../../tx-survey.js';
import { blockOracleGenesisOutput } from '../../oracle/block-oracle-deployment.js';

/** Raised when a framed deployment cannot be built from the artifact or the options. */
export class FramedDeployError extends Error {
  public readonly name = 'FramedDeployError';

  public constructor(message: string) {
    super(message);
  }
}

/** The genesis transaction's bytes and txid, without broadcasting it. */
function unbroadcastGenesis(builder: { build: () => string }): TransactionDetails {
  const hex = builder.build();
  const bytes = hexToBin(hex);
  const decoded = decodeTransaction(bytes);
  if (typeof decoded === 'string') throw new FramedDeployError(decoded);
  return { ...decoded, txid: binToHex(hash256(bytes).reverse()), hex };
}

/** The byte length of the transaction the builder would broadcast, which sizes the default fee. */
async function measuredFee(builder: { buildLibauthTransaction: () => unknown }): Promise<bigint> {
  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  return BigInt(encodeTransaction(builder.buildLibauthTransaction() as never).byteLength);
}

/**
 * A framed deployment's own address, `addrV(category)`: the lock its frames present as `address(this)` and that a
 * contract storing its address holds. A handle attached in another process than the deploying one derives it here.
 */
export function framedContractAddress(network: string, categoryId: string): string {
  const address = lockingBytecodeToCashAddress({
    bytecode: validatorAddress(hexToBin(categoryId), framedValidator.buildValidatorProgram()),
    prefix: getNetworkPrefix(network),
    tokenSupport: true,
  });
  if (typeof address === 'string') throw new FramedDeployError(`The contract's own address is not encodable: ${address}`);
  return address.address;
}

/**
 * Deploys a framed stateful contract: derives the genesis state from the constructor frame (or takes a supplied
 * `mintedState`), funds the master and validator pools, mints the state, and returns the connected contract handle.
 */
export async function deployFramedStatefulContract<T extends Artifact>(
  artifact: T,
  constructorArgs: ConstructorArgument[],
  options: DeployOptions,
  prepared: PreparedMetadata = {},
): Promise<DeployResult<T>> {
  // A creator replays its child's genesis, and names the parts its compile could not know by placeholders: the chain
  // over the child's masters, the validators a creation funds, the child's collection hashes and its block oracle's
  // owner. They exist only now: fill them from the child's constants, on the artifact and on every shard and cut of
  // its bundle (docs/framed/CREATE2_IDENTITY.md, "The genesis replay").
  const childLocks = options.childLocks;
  const childOutputCount = options.childOutputCount;
  const childPool = options.childPool;
  const replaySlots: ChildGenesisSlots | undefined = childLocks === undefined || childLocks.length === 0
    || childPool === undefined
    ? undefined
    : {
      locks: childLocks,
      pool: childPool,
      ...(options.childCollections === undefined ? {} : { collections: options.childCollections }),
      ...(options.childBlockOracleOwner === undefined ? {} : { blockOracleOwner: options.childBlockOracleOwner }),
    };
  const programs = [artifact, ...(options.functionSplit?.shards.map((shard) => shard.artifact) ?? []),
    ...(options.functionSplit?.internalCuts.map((cut) => cut.artifact) ?? [])];
  if (replaySlots === undefined && programs.some((program) => childGenesisReservation(program).replays)) {
    throw new FramedDeployError(
      `"${artifact.contractName}" creates a child and replays its genesis: deploy it with the child's constants `
      + '(`framedDeploy.framedChildConstants`): its entry locks (`childLocks`), the pool each creation funds '
      + '(`childPool`), its collection hashes (`childCollections`) and, for a child that reads block.*, its oracle\'s '
      + 'owner (`childBlockOracleOwner`)',
    );
  }
  const withChildSlots = (target: Artifact): Artifact => {
    if (childGenesisReservation(target).replays) return patchChildGenesisSlots(target, replaySlots!);
    // A creator compiled before the replay reserves its child's master locks and output count instead.
    const withLocks = childLocks === undefined || childLocks.length === 0
      ? target : patchChildLockSentinels(target, childLocks);
    const withCount = childOutputCount === undefined ? withLocks : patchChildOutputCount(withLocks, childOutputCount);
    return options.childCollections === undefined
      ? withCount : patchChildCollectionSentinels(withCount, options.childCollections);
  };
  const patchesChild = (childLocks !== undefined && childLocks.length > 0)
    || childOutputCount !== undefined || options.childCollections !== undefined;
  const shippedArtifact = withChildSlots(artifact) as typeof artifact;
  const split = !patchesChild
    ? options.functionSplit
    : options.functionSplit === undefined ? undefined : {
      ...options.functionSplit,
      shards: options.functionSplit.shards.map((shard) => ({
        ...shard, artifact: withChildSlots(shard.artifact),
      })),
      internalCuts: options.functionSplit.internalCuts.map((cut) => ({
        ...cut, artifact: withChildSlots(cut.artifact),
      })),
    };
  if (shippedArtifact.stateLayout === undefined) {
    throw new FramedDeployError(`Contract ${artifact.contractName} is not a stateful contract`);
  }
  if (options.fundingUtxo.vout !== 0) {
    throw new FramedDeployError(
      'Funding UTXO must be at vout 0 to create a valid token category. '
      + `Got vout ${options.fundingUtxo.vout}.`,
    );
  }
  const funderLock = options.funder.generateLockingBytecode();
  // The constructor's own frame is entered by the deployer. A body that reads `msg.sender` therefore resolves to the
  // deployer's lock, not the placeholder a frame with no stated caller uses: a constructor that writes
  // `balances[msg.sender]` (a token's mint) or `owner = msg.sender` would otherwise seed the placeholder. The lock the
  // deployment states wins - a Signer's own, which its later calls carry - so the coin that funds the genesis does
  // not decide it; a deployment that states none takes the funder's lock when it is a P2PKH lock.
  const senderLockingBytecode = options.senderLockingBytecode ?? (isP2pkhLock(funderLock) ? funderLock : undefined);
  const constructorReadsSender = artifact.abi.some(
    (entry) => entry.name === '__construct' && entry.usesMsgSender === true,
  );
  if (constructorReadsSender && senderLockingBytecode === undefined) {
    throw new FramedDeployError(
      `the constructor of "${artifact.contractName}" reads msg.sender, and no 25-byte P2PKH sender lock is known. `
      + 'Pass senderLockingBytecode, or fund the deployment with a P2PKH unlocker.',
    );
  }
  // The category is the funding coin's txid, so the coin is proven at the funder's own lock before anything is
  // signed: a coin a provider lists there but that sits at another lock would hand the category to its owner.
  const coinRefusal = await ownCoinRefusal(
    options.provider, options.fundingUtxo, funderLock, { role: 'funder', tokenFree: true });
  if (coinRefusal !== undefined) throw new FramedDeployError(coinRefusal);

  const categoryId = options.fundingUtxo.txid;
  const category = new Uint8Array(hexToBin(categoryId));
  const blockhashRing = blockhashRingGenesisOutputs(
    artifact, categoryId, options.provider, options.blockhashKeeperPublicKey, options.blockhashDepth,
  );
  const blockOracle = blockOracleGenesisOutput(
    artifact, categoryId, options.provider, options.blockOracleOwnerPublicKey, options.blockOracleAmount ?? 1200n,
  );
  const validatorProgram = framedValidator.buildValidatorProgram();
  // A framed handle's sync call surface needs the framed call engine loaded before the deployment returns; start
  // the load now so it overlaps the genesis derivation and funding below, and await it before building the handle.
  const framedCallEngine = loadFramedCallHandle();
  // A framed artifact publishes no `constructorInputs`, so the factory path that splits a call's arguments
  // between the constructor and the initial state cannot see that this contract takes any: the values arrive as
  // `initArgs`. A caller that reaches `StatefulContract.deploy` directly passes them as the constructor args.
  const constructorValues = constructorArgs.length > 0 ? constructorArgs : (options.initArgs ?? []);
  // Every sorted collection an entry can write needs its empty head sentinel minted here, because a first insert
  // splices beside it and a head is minted only at genesis. A collection the constructor's own plan writes carries
  // the head that plan relinked, and the genesis filters that one out; a caller that names extra collections (a
  // proxy's: its implementation's) keeps its own too.
  const declaredHeads = (artifact.stateLayout?.collections ?? [])
    .filter((collection) => collection.sorted === true)
    .map((collection) => ({ name: collection.name, signature: collection.signature }));
  const headCollections = [...(options.headCollections ?? []), ...declaredHeads]
    .filter((collection, index, all) => all.findIndex((other) => other.name === collection.name) === index);
  // A supplied state (a proxy's, as its derived `initialize` left it) replaces the constructor frame's derivation.
  const minted = options.mintedState;
  const genesis = minted !== undefined ? undefined : deriveFramedGenesis({
    artifact: shippedArtifact,
    category,
    validatorProgram,
    provider: options.provider,
    constructorArgs: constructorValues,
    ...(senderLockingBytecode === undefined ? {} : { senderLockingBytecode }),
    ...(options.initialState === undefined ? {} : { initialState: options.initialState }),
    ...(options.recordCommitments === undefined ? {} : { recordCommitments: options.recordCommitments }),
    ...(headCollections.length === 0 ? {} : { headCollections }),
    ...(options.provider.consensusLimits?.maximumNftCommitmentBytes === undefined
      ? {} : { maximumNftCommitmentBytes: options.provider.consensusLimits.maximumNftCommitmentBytes }),
  });
  const master = genesis?.master ?? deployMaster(shippedArtifact, category, validatorProgram);

  const masterAmount = options.masterAmount ?? 1200n;
  const dataNftAmount = options.dataNftAmount ?? 1200n;
  // A state record sits at the data-NFT covenant the category derives, so a composition spends and recreates it
  // under the covenant's own rules rather than at a lock outside them.
  const recordLockingBytecode = stateRecordLockingBytecode(categoryId);
  // The pool the caller asked for, or the composing default: a caller that names `threadCount` or `validatorCount`
  // is authoritative for that count, and the deployment funds exactly the pool it resolved.
  if (options.threadCount !== undefined
    && (!Number.isInteger(options.threadCount) || options.threadCount < 1)) {
    throw new FramedDeployError(`threadCount must be a positive integer, got ${options.threadCount}`);
  }
  if (options.validatorCount !== undefined
    && (!Number.isInteger(options.validatorCount) || options.validatorCount < 1)) {
    throw new FramedDeployError(`validatorCount must be a positive integer, got ${options.validatorCount}`);
  }
  const pool = resolveMasterPoolSize({ masters: options.threadCount, validators: options.validatorCount });
  if (split !== undefined && split.logicalContractName !== shippedArtifact.contractName) {
    throw new FramedDeployError(
      `function split bundle is ${split.logicalContractName}, not ${shippedArtifact.contractName}`,
    );
  }
  // A function-split genesis mints one pool per entry lock. A monolith genesis mints the one filled master.
  const splitPools = split === undefined ? undefined : MasterPoolDeployment.createFunctionSplit({
    bundle: split, category, validatorProgram, size: pool,
  });
  if (splitPools !== undefined && !bytesEqual(splitPools.getAddress(), master.address)) {
    throw new FramedDeployError(
      `function split shards of ${shippedArtifact.contractName} do not share the genesis addrV`,
    );
  }
  const entryLocks = splitPools?.getEntryLocks() ?? [master.lockingBytecode];

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  const builder = new TransactionBuilder({
    provider: options.provider,
    ...(options.maxFee === undefined ? {} : { maximumFeeSatoshis: options.maxFee }),
  });
  // Output 0 is the category's authhead contract, never a master: every call spends a master.
  const identity = planGenesisIdentity({
    category: categoryId,
    ...(options.identity === undefined ? {} : { identity: options.identity }),
    deployerLock: senderLockingBytecode ?? addressToLockScript(options.changeAddress),
  });
  const genesisInputs = prepared.nativeInput === undefined ? [] : [prepared.nativeInput];
  const inputTotal = genesisInputs.reduce((sum, input) => sum + input.utxo.satoshis, options.fundingUtxo.satoshis);
  builder.addInput(options.fundingUtxo, options.funder);
  for (const input of genesisInputs) builder.addInput(input.utxo, input.unlocker);
  // Every token output carries at least its own dust threshold: a wide record, chunk or event is worth more than the
  // fixed amount, which covers only outputs up to 252 bytes. The change below is taken from the amounts added here.
  const addFunded = (output: Parameters<typeof builder.addOutput>[0]): void => {
    builder.addOutput(output.token === undefined
      ? output : { ...output, amount: satoshisAtLeastDust(output.amount, output) });
  };

  // The identity output and the publication lead the genesis.
  for (const output of leadingOutputs(identity, prepared)) builder.addOutput(output);

  for (const lock of entryLocks) {
    for (let index = 0; index < pool.masters; index += 1) {
      addFunded({
        to: lock,
        amount: masterAmount,
        token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
    }
  }
  // The validator pool: `pool.validators` UTXOs at addrV(category), recreated in place by every composition, so
  // the pool bounds how many compositions the contract can root at once.
  for (let index = 0; index < pool.validators; index += 1) {
    addFunded({
      to: master.address,
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
  }
  // The facet pool: one tokenless UTXO per facet the validator program binds, at the facet's own lock. A facet
  // holds no token and pins no category, so a composition spends any UTXO of its code.
  for (const code of framedValidator.buildValidatorFacets()) {
    addFunded({
      to: encodeLockingBytecodeP2sh32(hash256(code)),
      amount: FACET_SATOSHIS,
    });
  }
  // A supplied state is minted as given, and nothing else: each output has to be this category's own state.
  for (const output of minted ?? []) {
    if (output.token?.category.toLowerCase() !== categoryId.toLowerCase()
      || output.token.nft?.capability === 'minting') {
      throw new FramedDeployError('a supplied genesis state may only hold this category\'s own non-minting tokens');
    }
    addFunded(output);
  }
  // The events the constructor's own frame emitted, at the covenant locks the body rebuilt. They lead the
  // trailing region, ahead of the records the genesis creates, which is the order a composition's outputs use; an
  // event output carries the contract's category with no capability.
  for (const event of genesis?.events ?? []) {
    addFunded({
      to: event.lockingBytecode,
      amount: dataNftAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'none', commitment: binToHex(event.commitment) },
      },
    });
  }
  // A state record's covenant pins its value on every later spend, so no write can fund a record it widens: the
  // genesis funds each one for the widest commitment its own variables pack to. A record holding a value with no
  // bound (unbounded bytes, an unbounded or packed array, `int`) is funded for its genesis width and keeps that value.
  (genesis?.commitments ?? []).forEach((commitment, nftIndex) => {
    const bound = artifact.stateLayout === undefined
      ? undefined : widestRecordCommitmentBytes(artifact.stateLayout, nftIndex);
    const widest = '00'.repeat(Math.max(commitment.length / 2, bound ?? 0));
    addFunded({
      to: recordLockingBytecode,
      amount: satoshisAtLeastDust(dataNftAmount, {
        to: recordLockingBytecode,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: widest } },
      }),
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
  });
  // The mapping nodes the constructor's frame materialized: the empty list's head sentinel and any node its writes
  // created. Each sits at its collection's entry covenant, so a composition spends and recreates it under the
  // covenant's own rules; the collection's signature derives that lock.
  for (const entry of genesis?.entries ?? []) {
    // A collection the artifact's own layout publishes carries its signature; one the deployment names (a proxy's,
    // from its implementation) carries the signature the deployment gave it.
    const signature = entry.signature
      ?? artifact.stateLayout?.collections?.find((candidate) => candidate.name === entry.collection)?.signature;
    if (signature === undefined) {
      throw new FramedDeployError(
        `genesis minted a node for collection "${entry.collection}", which the artifact does not publish`,
      );
    }
    addFunded({
      to: entryRecordLockingBytecode(categoryId, signature),
      amount: dataNftAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: options.writtenHeadCommitments?.[entry.collection] ?? entry.commitment,
        },
      },
    });
  }
  // The chunk records the constructor's frame wrote, each at the value's own collection covenant carrying the
  // commitment the shipped chunk encoder produced for the value the constructor stored.
  for (const chunk of genesis?.chunks ?? []) {
    addFunded({
      to: chunk.lockingBytecode,
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: chunk.commitment } },
    });
  }

  // An initialize hop's new chunks and events are minted here, so the proxy genesis is already the initialized
  // state and a later refusal cannot leave an uninitialized proxy on the chain.
  for (const extra of options.extraOutputs ?? []) {
    addFunded(extra);
  }

  // Immutable CREATE identity anchors: category-bearing discovery records the factory path expects to find at the
  // deploying account's logical address after the genesis.
  for (const anchor of minted === undefined ? options.identityAnchors ?? [] : []) {
    addFunded({
      to: anchor.to,
      amount: anchor.amount ?? dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'none', commitment: anchor.commitment } },
    });
  }

  for (const slot of blockhashRing) addFunded(slot);
  if (blockOracle !== undefined) addFunded(blockOracle);

  // The premint: the token's fungible amount at the contract's token container for the token's own category; then the
  // bearer supply.
  if (prepared.reserveOutput !== undefined) addFunded(prepared.reserveOutput);
  if (prepared.bearerOutput !== undefined) addFunded(prepared.bearerOutput);

  // A placeholder change output so the measured fee includes its serialized size, then the exact change.
  builder.addOutput({ to: options.changeAddress, amount: 1000n });
  const fee = options.fee ?? (await measuredFee(builder)) + 1000n;
  const nonChangeTotal = builder.outputs.slice(0, -1)
    .reduce((sum, output) => sum + output.amount, 0n);
  const finalChange = inputTotal - nonChangeTotal - fee;
  if (finalChange < 0n) {
    const pools = entryLocks.length === 1
      ? `the pool of ${pool.masters} master(s) and ${pool.validators} validator(s)`
      : `the pool of ${pool.masters} master(s) at each of ${entryLocks.length} entry locks `
        + `and ${pool.validators} validator(s)`;
    throw new FramedDeployError(
      `Insufficient funding for ${pools}: `
      + `${inputTotal} satoshis provided, but the genesis requires `
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

  labelNextBroadcast(`deploy ${artifact.contractName}`);
  const tx = options.broadcast === false ? unbroadcastGenesis(builder) : await builder.send();
  // Every later frame of this category runs the shard its selector names, at that shard's lock.
  if (split !== undefined) registerFunctionSplit(options.provider, categoryId, split);

  // A framed artifact bakes its constructor arguments into the filled program the genesis published rather than
  // into the handle's redeem script, so the handle is built without repeating them.
  const contract = new Contract(artifact, [] as never, {
    provider: options.provider,
    ...(options.addressType === undefined ? {} : { addressType: options.addressType }),
    category,
    ...(options.salt === undefined ? {} : { salt: options.salt }),
  });
  const { StatefulContract: SC } = await import('../../stateful/StatefulContract.js');
  await framedCallEngine;
  const statefulContract = SC.withCategory(contract, categoryId);
  // The handle presents the contract's own address, `addrV(category)` - the address the validator pins a callee to
  // - carried rather than recomputed from the artifact. A caller resolving an address therefore lands on this
  // deployment, not on a Solidity-facing logical CREATE address.
  const ownAddress = lockingBytecodeToCashAddress({
    bytecode: master.address,
    prefix: getNetworkPrefix(options.provider.network),
    tokenSupport: true,
  });
  if (typeof ownAddress === 'string') {
    throw new FramedDeployError(`The contract's own address is not encodable: ${ownAddress}`);
  }
  (statefulContract as unknown as { _framedAddress?: string })._framedAddress = ownAddress.address;
  return {
    contract: statefulContract,
    tx,
    categoryId,
    identity: identityRecord(identity, tx.txid),
    ...(prepared.registry === undefined ? {} : { registry: prepared.registry }),
  };
}
