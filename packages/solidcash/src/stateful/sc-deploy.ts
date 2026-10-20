/**
 * phase-boundary extract: SC lifecycle extract — static deploy API.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import {
  buildChunkCommitment,
  buildEventNftCovenantScript,
  buildInitialStateCommitments,
  buildMessageBusVerifierCovenantScript,
  computeEventNameHash,
  messageBusVerifierCommitment,
  splitValueIntoChunks,
  type Artifact,
} from '@solidcash/utils';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import { Contract } from '../Contract.js';
import { satoshisAtLeastDust, widestRecordCommitmentBytes } from '../framed/composer/dust.js';
import { ownCoinRefusal } from '../framed/deploy/own-coin.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript, scriptToLockingBytecode } from '../utils.js';
import { identityRecord, leadingOutputs, prepareMetadata } from '../bcmr/deployment.js';
import { governedEvent, governedGuardFor } from '../bcmr/governed.js';
import { isP2pkhLock, planGenesisIdentity } from '../bcmr/identity.js';
import { deploymentNftRoles, directNftLocks, framedNftLocks } from '../bcmr/nft-roles.js';
import { BcmrError } from '../bcmr/publication.js';
import {
  getAnonymousEventNftAddress,
  getDataNftAddress,
  getDynamicChunkAddress,
  getEntryNftAddress,
  getEventNftAddress,
  getSatoshiContainerAddress,
  getTokenContainerAddress,
} from './covenant-helpers.js';
import { genesisOutpointKey, reserveGenesisOutpoint } from './genesis-reservations.js';
import { deriveDeployCommitments } from './sc-derive-deploy-commitments.js';
import { headSentinelCommitment } from './SortedList.js';
import type { DeployOptions, DeployResult } from './stateful-lifecycle-types.js';
import { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { blockhashKeeperGenesisOutput } from '../oracle/blockhash-keeper-deployment.js';

async function computeFeeFromBuilder(builder: TransactionBuilder): Promise<bigint> {
  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  const tx = builder.buildLibauthTransaction();
  return BigInt(encodeTransaction(tx).byteLength);
}

export async function deployStatefulContract<T extends Artifact>(
  artifact: T,
  constructorArgs: ConstructorArgument[],
  options: DeployOptions,
): Promise<DeployResult<T>> {
  if (!artifact.stateLayout) {
    throw new Error(`Contract ${artifact.contractName} is not a stateful contract`);
  }

  if (options.fundingUtxo.vout !== 0) {
    throw new Error(
      'Funding UTXO must be at vout 0 to create a valid token category. '
      + `Got vout ${options.fundingUtxo.vout}.`,
    );
  }

  if (!/^[0-9a-f]{64}$/i.test(options.fundingUtxo.txid)) {
    throw new Error(
      'fundingUtxo.txid must be a 64-character hex string (transaction hash). '
      + `Got '${options.fundingUtxo.txid}'.`,
    );
  }

  // The census of a framed composition refuses every fungible amount of the contract's own category (framed spec,
  // S2), so a framed contract's token is a category of its own, which `nativeToken.funding` creates.
  const framed = artifact.composition?.convention === 'framed';
  const nativeFunding = options.nativeToken?.funding;
  if (framed && options.nativeToken?.reserve !== undefined && nativeFunding === undefined) {
    throw new BcmrError(
      `${artifact.contractName} is framed, and a framed composition refuses fungible tokens of the contract's own `
      + 'category, so its premint needs a category of its own: pass nativeToken.funding '
      + '(docs/framed/SPEC_FRAMED_TRANSACTION.md, S2)',
    );
  }
  const tokenCategory = (nativeFunding?.txid ?? options.fundingUtxo.txid).toLowerCase();
  // A framed handle carries no constructor arguments: the genesis bakes them into its program.
  const reserve = options.nativeToken?.reserve === undefined ? undefined : {
    lockingBytecode: addressToLockScript(getTokenContainerAddress(
      new Contract(artifact, (framed ? [] : constructorArgs) as any, {
        provider: options.provider,
        addressType: options.addressType,
        category: hexToBin(options.fundingUtxo.txid),
        salt: options.salt,
      }),
      options.fundingUtxo.txid.toLowerCase(),
      tokenCategory,
    )),
    satoshis: options.dataNftAmount ?? 1200n,
  };
  const prepared = options.metadataProbe === true ? {} : await prepareMetadata({
    artifact,
    category: options.fundingUtxo.txid.toLowerCase(),
    deploy: options,
    probe: (probeOptions) => deployStatefulContract(artifact, constructorArgs, probeOptions),
    ...(reserve === undefined ? {} : { reserve }),
    nftRoles: async () => {
      const category = options.fundingUtxo.txid.toLowerCase();
      return deploymentNftRoles(artifact, framed
        ? await framedNftLocks(artifact, category, options.provider)
        : directNftLocks(new Contract(artifact, constructorArgs as any, {
          provider: options.provider, addressType: options.addressType, category: hexToBin(category), salt: options.salt,
        }), category));
    },
  });

  // A framed artifact's master reads its frame from the witness block leading its own unlocking bytecode, so the
  // direct probe below cannot evaluate its constructor. The artifact publishes which convention it compiled for, so
  // the caller never has to know.
  if (framed) {
    const { deployFramedStatefulContract } = await import('../framed/deploy/stateful.js');
    return deployFramedStatefulContract(artifact, constructorArgs, options, prepared);
  }

  // The category is the funding coin's txid, so the coin is proven at the funder's own lock before anything is
  // signed: a coin a provider lists there but that sits at another lock would hand the category to its owner.
  const coinRefusal = await ownCoinRefusal(
    options.provider, options.fundingUtxo, options.funder.generateLockingBytecode(),
    { role: 'funder', tokenFree: true },
  );
  if (coinRefusal !== undefined) throw new Error(coinRefusal);

  const categoryId = options.fundingUtxo.txid;
  // Mock genesis categories are deterministic across tests. Persist is keyed
  // by token category, which may not equal this funding txid, so drop all.
  StatefulTransactionBuilder.clearPersistedJobEvents();
  const contract = new Contract(artifact, constructorArgs as any, {
    provider: options.provider,
    addressType: options.addressType,
    category: hexToBin(categoryId),
    salt: options.salt,
  });

  const stateLayout = artifact.stateLayout;
  const delegateOnly = artifact.delegateOnly === true;
  const dataNftAddress = getDataNftAddress(contract, categoryId);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_ROUTE) {
    console.error('deploy-data-nft-address', { contract: artifact.contractName, categoryId, dataNftAddress });
  }

  const masterAmount = options.masterAmount ?? 1200n;
  const dataNftAmount = options.dataNftAmount ?? 1200n;
  // Genesis spends reveal the full redeem script. Near-limit contracts therefore exceed the historical fixed
  // 5,000-sat fee at the default 1 sat/byte relay rate; size the default conservatively from the actual script.
  const estimatedFee = options.fee ?? BigInt(Math.max(5000, Math.ceil(contract.bytesize) + 2000));

  const constructorAbi = artifact.abi.find((f) => f.name === '__construct');

  // Dynamic constructor writes whose values are direct parameters can be materialized exactly. Their chunk NFTs
  // follow the fixed constructor block and are required both by the derivation probe and the real genesis tx.
  const visibleConstructorInputs = constructorAbi?.inputs.filter(
    (input) => !input.name.startsWith('__internal__'),
  ) ?? [];
  const { StatefulContract: SC } = await import('./StatefulContract.js');
  const constructorReplay = new SC(contract, categoryId) as any;
  const replayedDynamicValues = new Map<string, FunctionArgument>();
  for (const [name, expression] of Object.entries(constructorAbi?.dynamicWriteSources ?? {})) {
    const value = constructorReplay._evaluateExternalExpression(
      expression, [...(options.initArgs ?? [])], artifact, options.initialState,
      visibleConstructorInputs,
    );
    if (value !== undefined) replayedDynamicValues.set(name, value as FunctionArgument);
  }
  const resolvedDynamicWriteNames = new Set<string>();
  const dynamicInitialChunks = (stateLayout.variables ?? []).flatMap((variable) => {
    if (!variable.dynamic || !constructorAbi?.dynamicWrites?.includes(variable.name)) return [];
    const normalized = variable.name.replace(/^_+/, '');
    const inputIndex = visibleConstructorInputs.findIndex(
      (input) => input.name.replace(/^_+/, '').replace(/_+$/, '') === normalized,
    );
    const raw = replayedDynamicValues.get(variable.name)
      ?? (inputIndex >= 0 ? options.initArgs?.[inputIndex] : undefined);
    const value = typeof raw === 'string' ? utf8ToBin(raw) : raw instanceof Uint8Array ? raw : undefined;
    if (value === undefined) return [];
    // A known empty value has zero chunks; it must not be mistaken for an unresolved write merely because
    // dynamicInitialChunks has no entry for it.
    resolvedDynamicWriteNames.add(variable.name);
    return splitValueIntoChunks(value).map((chunkData: Uint8Array, chunkIndex: number) => ({
      name: variable.name, type: variable.type, chunkIndex, chunkData,
      commitment: buildChunkCommitment(
        chunkIndex, chunkData, options.provider.consensusLimits?.maximumNftCommitmentBytes,
      ),
    }));
  });
  const unresolvedDynamicWriteNames = (stateLayout.variables ?? [])
    .filter((variable) => variable.dynamic && constructorAbi?.dynamicWrites?.includes(variable.name)
      && !resolvedDynamicWriteNames.has(variable.name))
    .map((variable) => variable.name);

  // Determine counts for constructor features
  const entryAccesses = delegateOnly ? [] : (constructorAbi?.entryAccesses ?? []);
  const entryCount = entryAccesses.length;
  // A vmap batch has one fixed target output per logical access. Recreated shared predecessors live after the
  // fixed block (one HEAD per initially-empty collection), rather than using the old P'/NEW pair per access.
  const entryOutputCount = entryCount;
  const trailingEntryOutputCount = new Set(entryAccesses.filter((access) => (
    stateLayout.collections?.find((item) => item.name === access.collection)?.sorted
  )).map((access) => access.collection)).size;
  const emitCount = constructorAbi?.emits?.length ?? 0;

  const threadCount = options.threadCount ?? 1;
  if (threadCount < 1 || !Number.isInteger(threadCount)) {
    throw new Error(`threadCount must be a positive integer, got ${threadCount}`);
  }
  const messageBusVerificationInputCount = options.messageBusVerificationInputCount
    ?? (artifact.messageBus?.verifierProgram ? 1 : 0);
  if (!Number.isSafeInteger(messageBusVerificationInputCount)
    || messageBusVerificationInputCount < 0 || messageBusVerificationInputCount > 0xffff) {
    throw new Error(
      `messageBusVerificationInputCount must be an unsigned 16-bit integer, got ${messageBusVerificationInputCount}`,
    );
  }

  // Output 0 is the category's BCMR identity output, never a master: every call spends a master.
  const funderLock = options.funder.generateLockingBytecode();
  const identity = await planGenesisIdentity({
    provider: options.provider,
    category: categoryId.toLowerCase(),
    ...(options.identity === undefined ? {} : { policy: options.identity }),
    deployerLock: options.senderLockingBytecode
      ?? (isP2pkhLock(funderLock) ? funderLock : addressToLockScript(options.changeAddress)),
    funder: options.funder,
    ...(options.identity?.kind !== 'governed' ? {} : {
      governed: governedGuardFor(artifact, categoryId, addressToLockScript(
        getEventNftAddress(contract, categoryId, governedEvent(artifact).event.signature),
      )),
    }),
  });
  const leading = leadingOutputs(identity, prepared);
  const leadingTotal = leading.reduce((sum, output) => sum + output.amount, 0n);
  const genesisInputs = [...(prepared.nativeInput === undefined ? [] : [prepared.nativeInput]), ...identity.inputs];
  const inputTotal = genesisInputs.reduce((sum, input) => sum + input.utxo.satoshis, options.fundingUtxo.satoshis);

  const initialBalance = options.initialBalance ?? 0n;
  const totalMaster = masterAmount * BigInt(threadCount);
  const totalDataNft = delegateOnly ? 0n : dataNftAmount * BigInt(stateLayout.dataNftCount);
  const totalEntryNft = dataNftAmount * BigInt(entryOutputCount + trailingEntryOutputCount);
  const totalEventNft = dataNftAmount * BigInt(emitCount);
  const totalDynamicNft = dataNftAmount
    * BigInt(dynamicInitialChunks.length + unresolvedDynamicWriteNames.length);
  const totalMessageBusVerifiers = dataNftAmount * BigInt(messageBusVerificationInputCount);
  const identityAnchors = options.identityAnchors ?? [];
  const totalIdentity = identityAnchors.reduce((sum, anchor) => sum + (anchor.amount ?? dataNftAmount), 0n);
  const keeperBaton = blockhashKeeperGenesisOutput(
    artifact, categoryId, options.blockhashKeeperPublicKey, options.blockhashKeeperAmount,
  );
  const totalReserve = prepared.reserveOutput?.amount ?? 0n;
  const totalRequired = (keeperBaton?.amount ?? 0n) + totalMaster + totalDataNft + totalEntryNft
    + totalEventNft + totalDynamicNft
    + totalMessageBusVerifiers + totalIdentity + initialBalance + leadingTotal + totalReserve + estimatedFee;
  const changeAmount = inputTotal - totalRequired;

  if (changeAmount < 0n) {
    throw new Error(
      `Insufficient funding: ${inputTotal} satoshis provided, `
      + `but ${totalRequired} needed `
      + `(master: ${totalMaster} (${threadCount}x${masterAmount}), data NFTs: ${totalDataNft}, `
      + `entry NFTs: ${totalEntryNft}, event NFTs: ${totalEventNft}, fee estimate: ${estimatedFee}).`,
    );
  }

  // Determine initial commitments and additional outputs
  let commitments: string[];
  let entryCommitments: string[] = [];
  let trailingEntryCommitments: string[] = [];
  let eventCommitments: string[] = [];
  let derivedChunkCommitments: Record<string, string[]> = {};
  let valueChunkOutputs: Array<{ lockingBytecode: Uint8Array; commitment: string }> = [];
  let transferOutputs: Array<{ lockingBytecode: Uint8Array; amount: bigint }> = [];

  // Check if constructor has sig params - probe won't work for those
  const hasSigParams = constructorAbi?.inputs.some((inp) => inp.type === 'sig') ?? false;

  if (delegateOnly) {
    if (options.initialState || options.initArgs || initialBalance > 0n) {
      throw new Error(`Delegate-only facet '${artifact.contractName}' cannot deploy application state or balance.`);
    }
    commitments = [];
  } else if (constructorAbi && !hasSigParams) {
    // Use inference: build probe transaction with synthetic UTXOs
    const derived = await deriveDeployCommitments(
      contract, artifact, stateLayout, categoryId, dataNftAddress,
      masterAmount, dataNftAmount, options,
    );
    commitments = derived.stateCommitments;
    entryCommitments = derived.entryCommitments;
    trailingEntryCommitments = derived.trailingEntryCommitments;
    eventCommitments = derived.eventCommitments;
    derivedChunkCommitments = derived.dynamicChunkCommitments;
    valueChunkOutputs = derived.valueChunkOutputs;
    transferOutputs = derived.transferOutputs;
  } else if (constructorAbi && hasSigParams) {
    // Sig params: probe can't create valid signatures. Require explicit initialState.
    if (!options.initialState) {
      throw new Error(
        'Constructor has signature parameters - automatic state derivation is not possible. '
        + 'Provide options.initialState with explicit initial values.',
      );
    }
    commitments = buildInitialStateCommitments(
      stateLayout, options.initialState, options.provider.consensusLimits?.maximumNftCommitmentBytes,
    );
  } else {
    // No constructor: use explicit initialState or zero-initialized defaults
    commitments = buildInitialStateCommitments(
      stateLayout, options.initialState ?? {}, options.provider.consensusLimits?.maximumNftCommitmentBytes,
    );
  }

  // Build and send actual genesis transaction
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  const builder = new TransactionBuilder({
    provider: options.provider,
    ...(options.maxFee !== undefined && { maximumFeeSatoshis: options.maxFee }),
  });
  builder.addInput(options.fundingUtxo, options.funder);
  for (const input of genesisInputs) builder.addInput(input.utxo, input.unlocker);
  // A record output carries at least its own dust threshold: the fixed amount covers outputs up to 252 bytes, and a
  // provider with a relaxed commitment limit admits wider ones (a bounded array packed into one field).
  const addFunded = (output: Parameters<typeof builder.addOutput>[0]): void => {
    builder.addOutput(output.token === undefined
      ? output : { ...output, amount: satoshisAtLeastDust(output.amount, output) });
  };

  // The identity output, the publication and the identity's own outputs lead the genesis.
  for (const output of leading) builder.addOutput(output);

  // Minting NFT(s), one per thread
  for (let t = 0; t < threadCount; t++) {
    builder.addOutput({
      to: contract.tokenAddress,
      amount: masterAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }

  // Data NFTs with initial state, after the masters. The data-NFT covenant pins a
  // record's value on every later spend, so each is funded for the widest commitment its variables pack to (a
  // value with no bound: its genesis width).
  for (let i = 0; i < (delegateOnly ? 0 : stateLayout.dataNftCount); i++) {
    const bound = widestRecordCommitmentBytes(stateLayout, i);
    const widest = '00'.repeat(Math.max((commitments[i] ?? '').length / 2, bound ?? 0));
    builder.addOutput({
      to: dataNftAddress,
      amount: satoshisAtLeastDust(dataNftAmount, {
        to: dataNftAddress,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: widest } },
      }),
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: commitments[i] } },
    });
  }

  // Entry NFT outputs (mapping writes in constructor)
  let entryCommitmentIndex = 0;
  for (const access of entryAccesses) {
    const entryNftAddress = getEntryNftAddress(contract, categoryId, access.collection);
    addFunded({
      to: entryNftAddress,
      amount: dataNftAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: entryCommitments[entryCommitmentIndex++] ?? '' },
      },
    });
  }

  // vmap (sorted) mapping HEAD sentinels: a sorted mapping needs a HEAD[slot 0 | nextKey 0] to anchor the linked
  // list, otherwise its first read/write fails "missing HEAD sentinel". A constructor that writes the mapping
  // already mints entries for it; for the rest, mint the empty-map HEAD at genesis. Sound: the genesis is
  // funder-authorized (no covenant yet) and every later read/write pins the HEAD (slot 0) via the covenant.
  for (const col of (delegateOnly ? [] : (stateLayout.collections ?? []))) {
    if (!col.sorted) continue;
    if (entryAccesses.some((a) => a.collection === col.name)) continue; // constructor already created its entries
    addFunded({
      to: getEntryNftAddress(contract, categoryId, col.name),
      amount: dataNftAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(headSentinelCommitment()) },
      },
    });
  }

  // Transfer outputs (plain BCH transfers in constructor)
  for (const transfer of transferOutputs) {
    builder.addOutput({
      to: transfer.lockingBytecode,
      amount: transfer.amount,
    });
  }

  // Event NFT outputs (emits in constructor)
  if (constructorAbi?.emits) {
    const allEventDefs = artifact.events ?? [];
    for (let i = 0; i < constructorAbi.emits.length; i++) {
      const emitInfo = constructorAbi.emits[i];
      const eventDef = allEventDefs.find((e) => e.signature === emitInfo.eventSignature);
      const isAnonymous = eventDef?.anonymous === true;
      const eventNftAddress = eventDef === undefined
        ? scriptToLockingBytecode(
          buildEventNftCovenantScript(
            hexToBin(categoryId), computeEventNameHash(emitInfo.eventSignature),
          ),
          contract.addressType,
        )
        : isAnonymous
          ? getAnonymousEventNftAddress(contract, categoryId)
          : getEventNftAddress(contract, categoryId, emitInfo.eventSignature);
      addFunded({
        to: eventNftAddress,
        amount: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'none', commitment: eventCommitments[i] ?? '' },
        },
      });
    }
  }

  // vmap predecessor recreations trail the complete fixed constructor block (including conditional events).
  // Initially every sorted collection shares its HEAD across all constructor writes, so it is emitted once.
  let trailingEntryIndex = 0;
  for (const collectionName of new Set(entryAccesses.filter((access) => (
    stateLayout.collections?.find((item) => item.name === access.collection)?.sorted
  )).map((access) => access.collection))) {
    addFunded({
      to: getEntryNftAddress(contract, categoryId, collectionName),
      amount: dataNftAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: {
          capability: 'mutable',
          commitment: trailingEntryCommitments[trailingEntryIndex++] ?? '',
        },
      },
    });
  }

  // Literal base-constructor values have no visible ABI parameter. The probe reserves and learns their chunk
  // commitments; materialize the same authenticated run in the real genesis transaction.
  for (const variable of stateLayout.variables ?? []) {
    if (!unresolvedDynamicWriteNames.includes(variable.name)) continue;
    for (const commitment of derivedChunkCommitments[variable.name] ?? []) {
      addFunded({
        to: getDynamicChunkAddress(contract, categoryId, variable.name, variable.type),
        amount: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'mutable' as const, commitment },
        },
      });
    }
  }

  // Dynamic constructor values are stored in per-variable chunk NFTs immediately after the fixed block.
  for (const chunk of dynamicInitialChunks) {
    addFunded({
      to: getDynamicChunkAddress(contract, categoryId, chunk.name, chunk.type),
      amount: dataNftAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: chunk.commitment },
      },
    });
  }

  // Constructor vmap values over 60 bytes: the value-chunk runs the converged probe's pins asked for.
  for (const { lockingBytecode, commitment } of valueChunkOutputs) {
    addFunded({
      to: lockingBytecode,
      amount: dataNftAmount,
      token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
  }

  // Composition verifier pool. All instances share the category-branded covenant address and use their
  // commitment ordinal as a stable identity. A composed transaction consumes one instance and recreates it at
  // the same input/output index, so N instances permit N independently in-flight root compositions.
  if (messageBusVerificationInputCount > 0) {
    const verifierProgram = artifact.messageBus?.verifierProgram;
    if (!verifierProgram) {
      throw new Error(`Contract '${artifact.contractName}' publishes no message bus verifier program`);
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_VERIFIER_LIMIT === '1') {
      // eslint-disable-next-line no-console
      console.error('verifier-limit', {
        contract: artifact.contractName,
        maximumInputBytes: options.provider.consensusLimits?.maximumInputBytes,
        hasLimits: !!options.provider.consensusLimits,
        providerCtor: options.provider.constructor?.name,
      });
    }
    const verifierAddress = scriptToLockingBytecode(
      buildMessageBusVerifierCovenantScript(
        verifierProgram, options.provider.consensusLimits?.maximumInputBytes ?? 10_000,
      ), 'p2sh32',
    );
    for (let instance = 0; instance < messageBusVerificationInputCount; instance++) {
      builder.addOutput({
        to: verifierAddress,
        amount: dataNftAmount,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: binToHex(messageBusVerifierCommitment(instance)) },
        },
      });
    }
  }

  // Satoshi container output (if initialBalance > 0)
  if (initialBalance > 0n) {
    const satoshiContainerAddress = getSatoshiContainerAddress(contract, categoryId);
    builder.addOutput({ to: satoshiContainerAddress, amount: initialBalance });
  }

  // The premint: the token's fungible amount, which only a genesis can create, held in the contract's token
  // container for the token's category.
  if (prepared.reserveOutput !== undefined) addFunded(prepared.reserveOutput);

  // Immutable CREATE identity anchors are category-bearing discovery records. They are intentionally appended
  // after constructor-governed outputs so existing ABI output indices remain stable.
  for (const anchor of identityAnchors) {
    builder.addOutput({
      to: anchor.to,
      amount: anchor.amount ?? dataNftAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'none', commitment: anchor.commitment },
      },
    });
  }

  // Add a placeholder change output so fee measurement includes its serialized size, then pay the exact
  // one-satoshi-per-byte relay floor. This matters for near-limit contracts whose redeem script is revealed by
  // the genesis input and whose constructor transaction is consequently larger than the contract itself.
  const totalTransferAmount = transferOutputs.reduce((sum, t) => sum + t.amount, 0n);
  if (keeperBaton !== undefined) addFunded(keeperBaton);
  builder.addOutput({ to: options.changeAddress, amount: 1000n });
  // The unsigned template contains a shorter placeholder for the funding signature. Leave enough headroom for
  // the final P2PKH unlocking bytecode (and minor serialization-length changes after the change amount is set).
  const fee = options.fee ?? (await computeFeeFromBuilder(builder)) + 1000n;
  const nonChangeOutputTotal = builder.outputs.slice(0, -1)
    .reduce((sum, output) => sum + output.amount, 0n);
  const finalChange = inputTotal - nonChangeOutputTotal - fee;
  if (finalChange < 0n) {
    throw new Error(
      `Insufficient funding: the genesis outputs require ${nonChangeOutputTotal} satoshis (constructor transfers: `
      + `${totalTransferAmount}) and the transaction requires a ${fee}-satoshi fee. `
      + 'Increase the funding UTXO amount.',
    );
  }
  if (finalChange > 0n) {
    builder.outputs[builder.outputs.length - 1] = {
      ...builder.outputs[builder.outputs.length - 1], amount: finalChange,
    };
  } else {
    builder.outputs.pop();
  }

  const tx = await builder.send();
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_ROUTE) {
    console.error('deploy-data-nft-utxos', {
      contract: artifact.contractName, dataNftAddress,
      utxos: await options.provider.getUtxos(dataNftAddress),
    });
  }

  const statefulContract = SC.withCategory(contract, categoryId);
  // A key-held identity output sits at the deployer's address, so this session's coin selection must not take it.
  if (identity.policy === 'key' && options.metadataProbe !== true) {
    reserveGenesisOutpoint(genesisOutpointKey(tx.txid, 0));
  }

  return {
    contract: statefulContract,
    tx,
    categoryId,
    identity: identityRecord(identity, tx.txid),
    ...(prepared.registry === undefined ? {} : { registry: prepared.registry }),
  };
}
