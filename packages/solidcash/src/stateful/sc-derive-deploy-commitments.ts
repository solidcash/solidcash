/**
 * phase-boundary extract: SC lifecycle extract — constructor probe / derive deploy commitments.
 */

import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex, binsAreEqual, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import {
  buildAnonymousEventNftCovenantScript,
  buildChunkCommitment,
  buildEntryNftCovenantScript,
  buildEventNftCovenantScript,
  buildInitialStateCommitments,
  computeCollectionHash,
  computeEventNameHash,
  Op,
  type Artifact,
  type StateLayout,
  splitValueIntoChunks,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { Contract } from '../Contract.js';
import type { Utxo } from '../interfaces.js';
import { buildKeccakComputeSidecar, extractKeccakPreimageFromTrace } from '../keccak/keccakComputeSidecar.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import {
  addressToLockScript, generateLibauthSourceOutputs, scriptToLockingBytecode,
} from '../utils.js';
import {
  createDataNftUnlocker,
  createEntryNftUnlocker,
  getDynamicChunkAddress,
  getEntryNftAddress,
} from './covenant-helpers.js';
import { reduceProbeTrace } from './faithful-probe-trace.js';
import { evalComputedKey } from './route-expression-key.js';
import {
  bytesToSlotValue,
  decodeEntryCommitment,
  encodeEntryCommitment,
  headSentinelCommitment,
  keyToSlotMulti,
  SortedList,
} from './SortedList.js';
import type { DeployOptions } from './stateful-lifecycle-types.js';
import {
  decodeScriptNumber,
  extractCommitmentMapFromTrace,
} from './trace-commitment-helpers.js';
import { extractVerifiedValuesFromTrace } from './trace-verified-value-helpers.js';

const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]);

export async function deriveDeployCommitments<T extends Artifact>(
  contract: Contract<T>,
  artifact: T,
  stateLayout: StateLayout,
  categoryId: string,
  dataNftAddress: string,
  masterAmount: bigint,
  dataNftAmount: bigint,
  options: DeployOptions,
): Promise<{
    stateCommitments: string[];
    entryCommitments: string[];
    trailingEntryCommitments: string[];
    eventCommitments: string[];
    dynamicChunkCommitments: Record<string, string>;
    transferOutputs: Array<{ lockingBytecode: Uint8Array; amount: bigint }>;
  }> {
  const constructorAbi = artifact.abi.find((f) => f.name === '__construct');
  const entryAccesses = constructorAbi?.entryAccesses ?? [];
  const entryCount = entryAccesses.length;
  const entryOutputCount = entryCount;
  const transferCount = constructorAbi?.transferCount ?? 0;
  const emitInfos = constructorAbi?.emits ?? [];
  const emitCount = emitInfos.length;
  // A runtime loop's writes are published as the loop, not as entry accesses, so the probe plans no node for them:
  // a loop that writes an entry leaves the derivation without the node, which a refusal names as its cause.
  const loopWrite = [...constructorAbi?.sortedUpsertLoopInfo ?? [], ...constructorAbi?.sortedInsertLoopInfo ?? []][0];
  const unplannedCause = loopWrite === undefined ? ''
    : ` The constructor writes verified mapping '${loopWrite.collection}' in a runtime loop, whose nodes a deployment `
      + 'cannot plan.';
  // A stateful `new` in the constructor mints its child inside the genesis transaction, which carries no child
  // genesis input or outputs: the probe would read a missing input, so refuse with the cause instead.
  const constructorChildren = [...new Set((constructorAbi?.deployTargets ?? []).map((target) => target.contractName))];
  if (constructorChildren.length > 0) {
    throw new Error(
      `Constructor of '${artifact.contractName}' creates stateful contract `
      + `${constructorChildren.map((name) => `'${name}'`).join(', ')} with 'new'; a deployment does not create child `
      + 'contracts in its genesis transaction. Create them from a function after deployment.',
    );
  }

  // Explicit initial state seeds fields the constructor does not write (for example compiler-injected immutable
  // block-oracle ownership). Constructor execution still derives and authenticates its writes over this pre-state.
  const zeroCommitments = buildInitialStateCommitments(
    stateLayout, options.initialState ?? {}, options.provider.consensusLimits?.maximumNftCommitmentBytes,
  );

  // Synthetic master UTXO (contract's locking script + minting NFT). It spends the category's genesis outpoint, as
  // the real genesis's input 0 does: the constructor arm runs only where input 0 spends `(category, 0)`.
  const syntheticMaster: Utxo = {
    txid: categoryId, vout: 0, satoshis: masterAmount,
    token: {
      category: categoryId, amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  };

  // Contract unlockers accept only user-visible arguments and fill compiler-internal witnesses themselves.
  const initArgs = [...(options.initArgs ?? [])];
  const senderLockingBytecode = options.funder.generateLockingBytecode();
  const visibleInputs = constructorAbi?.inputs.filter((input) => !input.name.startsWith('__internal__')) ?? [];
  const { StatefulContract: SC } = await import('./StatefulContract.js');
  const constructorReplay = new SC(contract, categoryId) as any;
  const replayedDynamicValues = new Map<string, FunctionArgument>();
  for (const [name, expression] of Object.entries(constructorAbi?.dynamicWriteSources ?? {})) {
    const value = constructorReplay._evaluateExternalExpression(
      expression, initArgs, artifact, options.initialState, visibleInputs,
    );
    if (value !== undefined) replayedDynamicValues.set(name, value as FunctionArgument);
  }
  const resolveConstructorKey = (label: string | undefined): Uint8Array | undefined => {
    if (label === 'nullop:msg.sender' || label === 'sender:msg.sender') return senderLockingBytecode;
    // A key that is one of the constructor's own parameters is published by its bare name.
    const expression = label !== undefined && /^[A-Za-z_$][\w$]*$/.test(label) ? `id:${label}` : label;
    // A constructor body may reference either an explicit `__construct` argument or a contract parameter.
    // The latter is encoded into the redeem script and therefore is not repeated in the constructor ABI.
    return evalComputedKey(expression, initArgs, visibleInputs)
      ?? evalComputedKey(expression, contract.constructorArgs, artifact.constructorInputs);
  };
  const sortedPlans = new Map<string, {
    proofOffset: number;
    targetNext: Map<number, Uint8Array>;
    targetCommitment: Map<number, Uint8Array>;
    predecessorCommitment: string;
    trailingOutput: number;
    targetRank: Map<number, bigint>;
    rows: Uint8Array;
  }>();
  const constructorTargetSlots = new Map<number, Uint8Array>();
  const sortedCollections = [...new Set(entryAccesses.filter((access) => (
    stateLayout.collections?.find((item) => item.name === access.collection)?.sorted
  )).map((access) => access.collection))];
  for (const [collectionIndex, collectionName] of sortedCollections.entries()) {
    const collection = stateLayout.collections!.find((item) => item.name === collectionName)!;
    const accesses = entryAccesses.map((access, index) => ({ access, index })).filter(
      ({ access }) => access.collection === collectionName,
    );
    const headUtxo: Utxo = {
      txid: `${'00'.repeat(31)}ee`, vout: collectionIndex, satoshis: dataNftAmount,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: binToHex(headSentinelCommitment()) },
      },
    };
    const list = SortedList.fromUtxos([headUtxo]);
    const writes = accesses.map(({ access, index }) => {
      const labels = access.keySources?.map((source, keyIndex) => (
        source.expressionLabel ?? source.paramName ?? access.keyParams?.[keyIndex]
      )) ?? access.keyParams;
      const keys = labels.map((label) => resolveConstructorKey(label));
      if (keys.some((key) => key === undefined)) {
        const missing = labels[keys.findIndex((key) => key === undefined)];
        throw new Error(
          `Cannot derive constructor vmap key '${missing ?? '<unknown>'}' for ${collectionName}.`,
        );
      }
      const slot = keyToSlotMulti(keys as Uint8Array[], collection);
      constructorTargetSlots.set(index, slot);
      return { slot, value: new Uint8Array() };
    });
    const plan = list.planBatchUpsert(writes);
    const targetNext = new Map<number, Uint8Array>();
    const targetCommitment = new Map<number, Uint8Array>();
    for (const [localIndex, { index }] of accesses.entries()) {
      const output = plan.outputs.find((candidate) => binsAreEqual(candidate.slot, writes[localIndex].slot));
      if (output === undefined) throw new Error(`Missing constructor vmap target plan for ${collectionName}.`);
      targetNext.set(index, decodeEntryCommitment(output.commitment).nextKey);
      targetCommitment.set(index, output.commitment);
    }
    const predecessor = plan.outputs.find((output) => bytesToSlotValue(output.slot) === 0n);
    if (predecessor === undefined) throw new Error(`Missing constructor vmap HEAD plan for ${collectionName}.`);
    const linearRows = accesses.map(({ index }) => ({
      index, slot: constructorTargetSlots.get(index)!, next: targetNext.get(index)!,
    })).sort((a, b) => bytesToSlotValue(a.slot) < bytesToSlotValue(b.slot) ? -1 : 1);
    const targetRank = new Map(linearRows.map((row, rank) => [row.index, BigInt(rank)]));
    sortedPlans.set(collectionName, {
      proofOffset: constructorAbi?.blockLayout?.slots.find(
        (slot) => slot.kind === 'entry' && slot.slotIndex === accesses[0].index,
      )?.offset ?? (1 + stateLayout.dataNftCount + accesses[0].index),
      targetNext, targetCommitment,
      predecessorCommitment: binToHex(predecessor.commitment),
      trailingOutput: (constructorAbi?.blockLayout?.blockSize ?? (
        1 + stateLayout.dataNftCount + entryCount + emitCount + transferCount
      )) + collectionIndex,
      targetRank,
      rows: Uint8Array.from(linearRows.flatMap((row) => [...row.slot, ...row.next])),
    });
  }
  const internalInitArgs: FunctionArgument[] = [];
  for (const input of constructorAbi?.inputs.slice(visibleInputs.length) ?? []) {
    if (input.name === '__internal__msgSenderCategory') internalInitArgs.push(new Uint8Array(32));
    else if (input.name === '__internal__msgSenderAnchorIdx') internalInitArgs.push(-1n);
    else if (input.name === '__internal__valueChunkOutputBase') internalInitArgs.push(-1n);
    else if (input.name.startsWith('__internal__valueWitness_')
      || input.name.startsWith('__internal__leadingPushValue_')) {
      // Genesis has no prior chunked mapping value or earlier same-transaction array push. The constructor
      // probe learns any newly published continuation outputs from the layout-relative sentinel above.
      internalInitArgs.push(new Uint8Array());
    } else {
      const match = input.name.match(/^__internal__vmapBatch(Slot|Proof|Next|PredOut|Rank)_(\d+)$/);
      if (match) {
        const slotIndex = Number(match[2]);
        const access = entryAccesses[slotIndex];
        const plan = sortedPlans.get(access.collection);
        const targetSlot = constructorTargetSlots.get(slotIndex);
        if (plan === undefined || targetSlot === undefined) throw new Error(`Missing constructor vmap witness ${input.name}.`);
        if (match[1] === 'Slot') internalInitArgs.push(targetSlot);
        else if (match[1] === 'Proof') internalInitArgs.push(BigInt(plan.proofOffset));
        else if (match[1] === 'Next') internalInitArgs.push(plan.targetNext.get(slotIndex)!);
        else if (match[1] === 'Rank') internalInitArgs.push(plan.targetRank.get(slotIndex)!);
        else {
          const batch = constructorAbi?.sortedBatchInfo?.find((candidate) => candidate.collection === access.collection);
          const first = plan.targetRank.get(slotIndex) === 0n;
          internalInitArgs.push(BigInt(!batch?.linear || first ? plan.trailingOutput : -1));
        }
      } else if (input.name.startsWith('__internal__vmapBatchRows_')) {
        const collection = input.name.slice('__internal__vmapBatchRows_'.length);
        const plan = sortedPlans.get(collection);
        if (plan === undefined) throw new Error(`Missing constructor vmap rows witness ${input.name}.`);
        internalInitArgs.push(plan.rows);
      } else if (input.name === '__internal__vmapBatchTrailingCount') {
        internalInitArgs.push(BigInt(sortedCollections.length));
      } else if (/^__internal__(valueWitness|leadingPushValue)_\d+$/.test(input.name)) {
        // At genesis no node holds a value to witness, and no earlier write pushes ahead of the constructor's.
        internalInitArgs.push(new Uint8Array());
      } else if (input.name === '__internal__valueChunkOutputBase') {
        // A value's chunks would trail the block's entry outputs; an inline value has none.
        internalInitArgs.push(BigInt((constructorAbi?.blockLayout?.blockSize ?? 1) + sortedCollections.length));
      } else {
        throw new Error(`Unsupported constructor internal witness '${input.name}'.`);
      }
    }
  }



  const requiredIndices = constructorAbi?.requiredNftIndices
    ?? Array.from({ length: stateLayout.dataNftCount }, (_, i) => i);
  // Constructors are evaluated off-chain against a synthetic transaction. A category-branded keccak side-car
  // cannot pre-exist before genesis (the category is the funding outpoint), so materialize faithful synthetic
  // side-car inputs at the constructor's fixed block slots and progressively learn complex preimages from the
  // master trace. The real genesis only publishes the already-derived state; it does not spend these probes.
  const constructorKeccakParams = constructorAbi?.keccakPreimageParams ?? [];
  const constructorKeccakBatchCount = Math.ceil(constructorKeccakParams.length / 3);
  const constructorKeccakSalt = hexToBin(categoryId).slice().reverse();
  const constructorKeccakBase = constructorAbi?.blockLayout?.slots
    .find((slot) => slot.kind === 'keccakSideCar')?.offset;
  const constructorKeccakPreimages: (Uint8Array | null)[] = constructorKeccakParams.map((param) => {
    if (!param) return null;
    const inputIndex = visibleInputs.findIndex((input) => input.name === param);
    const value = inputIndex >= 0 ? initArgs[inputIndex] : undefined;
    return value instanceof Uint8Array ? value : null;
  });
  const syntheticKeccakUtxos: Utxo[] = Array.from({ length: constructorKeccakBatchCount }, (_, index) => ({
    txid: `${'00'.repeat(31)}eb`, vout: index, satoshis: dataNftAmount,
    token: {
      category: categoryId, amount: 0n,
      nft: { capability: 'mutable', commitment: '' },
    },
  }));
  const constructorSlotOffset = (kind: string, slotIndex: number): number | undefined =>
    constructorAbi?.blockLayout?.slots.find(
      (slot) => slot.kind === kind && (slot.slotIndex ?? 0) === slotIndex,
    )?.offset;
  const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');
  // Sparse probes omit OP_INPUTBYTECODE unless listed; constructors with keccak need full traces
  // on small contracts and carefully instrumented sparse traces on large ones. Prefer full debug
  // when the constructor is modest enough that cloning the trace is safe.
  // The sparse observer is an approximation of the faithful trace (it records only the inspected opcodes and
  // the EQUALVERIFY adjacent to each). SOLIDCASH_FAITHFUL_DEPLOY_PROBE=1 forces the faithful path so a
  // derivation failure can be attributed to the contract rather than to the observer.
  const useSparseProbe = !(globalThis as any).process?.env?.SOLIDCASH_FAITHFUL_DEPLOY_PROBE
    && (options.provider.consensusLimits?.maximumInputBytes ?? 10_000) > 10_000;
  const allEventDefs = artifact.events ?? [];
  // A failing commitment equality stops VM execution, so one probe may reveal only the next unresolved
  // constructor output. Bound the work by every output family that can be learned in sequence, plus a final
  // validation run. Repeated-state detection below still refuses an oscillating derivation.
  const maxDeployIterations = Math.max(
    5,
    constructorKeccakPreimages.filter((preimage) => preimage === null).length
      + entryOutputCount
      + sortedCollections.length
      + emitCount
      + (constructorAbi?.dynamicWrites?.length ?? 0)
      + requiredIndices.length
      + 2,
  );
  const seenDeployKeys = new Set<string>();

  let deployConverged = false;
  let currentCommitments = [...zeroCommitments];
  let stateCommitments: string[] = [];
  let entryCommits: string[] = Array.from({ length: entryOutputCount }, () => '');
  const usesVmapBatchWitnesses = constructorAbi?.inputs.some(
    (input) => input.name.startsWith('__internal__vmapBatch'),
  ) ?? false;
  // Scalar vmap insertion recreates P' in the fixed entry slot and places NEW after the block. Batched insertion
  // places its targets in fixed slots and trails the shared predecessor. Only the unknown value-bearing side
  // is left blank for VM inference.
  for (const [index, access] of entryAccesses.entries()) {
    const plan = sortedPlans.get(access.collection);
    if (!plan) continue;
    entryCommits[index] = usesVmapBatchWitnesses
      ? binToHex(plan.targetCommitment.get(index)!)
      : plan.predecessorCommitment;
  }
  let trailingEntryCommits = sortedCollections.map(
    (collectionName) => usesVmapBatchWitnesses
      ? sortedPlans.get(collectionName)!.predecessorCommitment
      : '',
  );
  // Event covenants split the immutable commitment's 32-byte event-name prefix before the constructor reaches
  // its equality check. An empty placeholder therefore aborts before the trace can reveal the expected value.
  // Seed a structurally valid prefix; the first trace replaces it with the authenticated full commitment.
  const eventCommits: string[] = Array.from({ length: emitCount }, () => '00'.repeat(32));
  const dynamicChunkCommits: Record<string, string> = {};
  let reservedChunkNames: string[] = [];
  let transferOuts: Array<{
    lockingBytecode: Uint8Array; amount: bigint;
  }> = [];

  for (let iter = 0; iter < maxDeployIterations; iter++) {
    // Rebuild synthetic data NFTs with current commitments
    const iterDataNfts: Utxo[] = Array.from(
      { length: stateLayout.dataNftCount }, (_, i) => ({
        txid: '00'.repeat(32), vout: i + 1, satoshis: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: {
            capability: 'mutable' as const,
            // A constructor always executes from its original zero/explicit pre-state. Only the synthetic
            // OUTPUT placeholders converge; feeding a prior result back as input repeats non-idempotent writes.
            commitment: zeroCommitments[i],
          },
        },
      }),
    );

    const constructorUnlocker = (contract.unlock as any).__construct(
      ...initArgs, ...internalInitArgs,
    );
    const dataNftUnlockers = iterDataNfts.map(
      () => createDataNftUnlocker(contract, 0, categoryId),
    );

    // Build probe transaction
    const probeBuilder = new CovenantTransactionBuilder({
      provider: options.provider,
    });
    probeBuilder.addInput(syntheticMaster, constructorUnlocker);
    iterDataNfts.forEach(
      (nft, i) => probeBuilder.addInput(nft, dataNftUnlockers[i]),
    );

    const constructorKeccakSidecars = syntheticKeccakUtxos.map((utxo, batch) => buildKeccakComputeSidecar(
      constructorKeccakPreimages.slice(batch * 3, batch * 3 + 3)
        .map((preimage) => preimage ?? new Uint8Array(0)),
      constructorKeccakSalt, utxo, true,
    ));
    constructorKeccakSidecars.forEach(({ unlocker }, index) => {
      probeBuilder.addInput(syntheticKeccakUtxos[index], unlocker);
    });

    // Constructor vmap writes are probed against a synthetic empty HEAD. The real genesis is funder-authorized,
    // but the probe must present the same authenticated predecessor shape the runtime upsert code consumes.
    const materializedProofs = new Set<number>();
    for (let e = 0; e < entryCount; e++) {
      const access = entryAccesses[e];
      const collection = stateLayout.collections?.find((item) => item.name === access.collection);
      if (collection?.sorted) {
        const plan = sortedPlans.get(access.collection)!;
        if (!materializedProofs.has(plan.proofOffset)) {
          materializedProofs.add(plan.proofOffset);
          probeBuilder.addInput({
            txid: `${'00'.repeat(31)}ee`, vout: sortedCollections.indexOf(access.collection),
            satoshis: dataNftAmount,
            token: {
              category: categoryId, amount: 0n,
              nft: { capability: 'mutable', commitment: binToHex(headSentinelCommitment()) },
            },
          }, createEntryNftUnlocker(contract, 0, categoryId, access.collection));
        } else {
          probeBuilder.addInput(
            { txid: `${'00'.repeat(31)}ec`, vout: e, satoshis: dataNftAmount },
            options.funder,
          );
        }
        continue;
      }
      const collectionSig = stateLayout.collections?.find(
        (candidate) => candidate.name === access.collection,
      )?.signature ?? access.collection;
      const entryLockingBytecode = scriptToLockingBytecode(
        buildEntryNftCovenantScript(hexToBin(categoryId), computeCollectionHash(collectionSig)),
        contract.addressType,
      );
      probeBuilder.addInput(
        { txid: `${'00'.repeat(31)}ee`, vout: e, satoshis: dataNftAmount },
        {
          generateLockingBytecode: (): Uint8Array => entryLockingBytecode,
          generateUnlockingBytecode: (): Uint8Array => DUMMY_FUNDER_UNLOCKING_BYTECODE,
        },
      );
    }

    // Conditional event slots are output-bearing block positions too; materialize matching no-token inputs so
    // input/output positional checks see the exact genesis layout.
    for (const [eventIndex, emitInfo] of emitInfos.entries()) {
      const eventDef = allEventDefs.find((event) => event.signature === emitInfo.eventSignature);
      const eventScript = eventDef?.anonymous === true
        ? buildAnonymousEventNftCovenantScript(hexToBin(categoryId))
        : buildEventNftCovenantScript(hexToBin(categoryId), computeEventNameHash(emitInfo.eventSignature));
      const eventLockingBytecode = scriptToLockingBytecode(eventScript, contract.addressType);
      probeBuilder.addInput(
        { txid: `${'00'.repeat(31)}ed`, vout: eventIndex, satoshis: dataNftAmount },
        {
          generateLockingBytecode: (): Uint8Array => eventLockingBytecode,
          generateUnlockingBytecode: (): Uint8Array => DUMMY_FUNDER_UNLOCKING_BYTECODE,
        },
      );
    }

    // Direct msg.sender resolves to tx.origin, the first native P2PKH source output. Keep the real funder after
    // the fixed constructor block so it supplies identity without shifting any positional covenant slots. The
    // master spends the funding coin's outpoint, so the funder keeps its lock and value at a probe-only one.
    probeBuilder.addInput({ ...options.fundingUtxo, txid: `${'00'.repeat(31)}ef`, vout: 0 }, options.funder);

    // Output 0: master preserved
    probeBuilder.addOutput({
      to: constructorUnlocker.generateLockingBytecode(),
      amount: masterAmount,
      token: syntheticMaster.token,
    });

    // Outputs 1..dataNftCount: data NFTs
    iterDataNfts.forEach((nft, i) => {
      probeBuilder.addOutput({
        to: dataNftUnlockers[i].generateLockingBytecode(),
        amount: dataNftAmount,
        token: {
          category: categoryId,
          amount: 0n,
          nft: {
            capability: 'mutable' as const,
            commitment: currentCommitments[i],
          },
        },
      });
    });

    for (const sidecar of constructorKeccakSidecars) probeBuilder.addOutput(sidecar.recreate);

    // Entry NFT outputs. Previously learned commitments are fed into the next probe iteration so a constructor
    // whose mapping write precedes scalar writes can progress past the entry equality checks.
    let probeEntryCommitmentIndex = 0;
    for (const access of entryAccesses) {
      const collectionSig = stateLayout.collections?.find(
        (c) => c.name === access.collection,
      )?.signature ?? access.collection;
      const collectionHash = computeCollectionHash(collectionSig);
      const covenantScript = buildEntryNftCovenantScript(
        hexToBin(categoryId), collectionHash,
      );
      const lockingBytecode = scriptToLockingBytecode(
        covenantScript, contract.addressType,
      );
      probeBuilder.addOutput({
        to: lockingBytecode,
        amount: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: {
            capability: 'mutable' as const,
            commitment: entryCommits[probeEntryCommitmentIndex++] ?? '',
          },
        },
      });
    }

    // Transfer placeholder outputs
    for (let i = 0; i < transferCount; i++) {
      probeBuilder.addOutput({
        to: encodeLockingBytecodeP2pkh(new Uint8Array(20)),
        amount: dataNftAmount,
      });
    }

    // Event NFT placeholder outputs
    for (const [eventIndex, emitInfo] of emitInfos.entries()) {
      const eventDef = allEventDefs.find(
        (e) => e.signature === emitInfo.eventSignature,
      );
      const isAnonymous = eventDef?.anonymous === true;
      const covenantScript = isAnonymous
        ? buildAnonymousEventNftCovenantScript(hexToBin(categoryId))
        : buildEventNftCovenantScript(
          hexToBin(categoryId),
          computeEventNameHash(emitInfo.eventSignature),
        );
      const lockingBytecode = scriptToLockingBytecode(
        covenantScript, contract.addressType,
      );
      probeBuilder.addOutput({
        to: lockingBytecode,
        amount: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: { capability: 'none' as const, commitment: eventCommits[eventIndex] },
        },
      });
    }

    for (const [index, collectionName] of sortedCollections.entries()) {
      probeBuilder.addOutput({
        to: getEntryNftAddress(contract, categoryId, collectionName),
        amount: dataNftAmount,
        token: {
          category: categoryId, amount: 0n,
          nft: {
            capability: 'mutable',
            commitment: trailingEntryCommits[index],
          },
        },
      });
    }

    // Dynamic constructor writes trail the fixed block. Direct parameter assignments (the Solidity-compatible
    // pattern used by ERC20(name, symbol)) are known exactly, so use their real commitments in every probe.
    reservedChunkNames = [];
    for (const variable of stateLayout.variables ?? []) {
      if (!variable.dynamic || !constructorAbi?.dynamicWrites?.includes(variable.name)) continue;
      const normalized = variable.name.replace(/^_+/, '');
      const inputIndex = visibleInputs.findIndex(
        (input) => input.name.replace(/^_+/, '').replace(/_+$/, '') === normalized,
      );
      const raw = replayedDynamicValues.get(variable.name)
        ?? (inputIndex >= 0 ? options.initArgs?.[inputIndex] : undefined);
      const value = typeof raw === 'string' ? utf8ToBin(raw) : raw instanceof Uint8Array ? raw : undefined;
      if (value === undefined) {
        reservedChunkNames.push(variable.name);
        probeBuilder.addOutput({
          to: addressToLockScript(getDynamicChunkAddress(
            contract, categoryId, variable.name, variable.type,
          )),
          amount: dataNftAmount,
          token: {
            category: categoryId, amount: 0n,
            nft: {
              capability: 'mutable' as const,
              commitment: dynamicChunkCommits[variable.name] ?? '',
            },
          },
        });
        continue;
      }
      const lockingBytecode = addressToLockScript(getDynamicChunkAddress(
        contract, categoryId, variable.name, variable.type,
      ));
      for (const [chunkIndex, chunkData] of splitValueIntoChunks(value).entries()) {
        probeBuilder.addOutput({
          to: lockingBytecode,
          amount: dataNftAmount,
          token: {
            category: categoryId, amount: 0n,
            nft: {
              capability: 'mutable' as const,
              commitment: buildChunkCommitment(
                chunkIndex, chunkData, options.provider.consensusLimits?.maximumNftCommitmentBytes,
              ),
            },
          },
        });
      }
    }

    // Run VM debug and extract commitments
    const transaction = probeBuilder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(
      probeBuilder.inputs,
    );
    const program = { inputIndex: 0, sourceOutputs, transaction };
    let fullTrace: AuthenticationProgramStateCommon[];
    if (useSparseProbe) {
      // Large private-network contracts can execute millions of instructions. vm.debug() clones every state,
      // including its stack, so probing a several-hundred-kilobyte initializer can consume many gigabytes.
      // Commitment/transfer extraction only needs the inspected opcode and its adjacent EQUALVERIFY state.
      const sparseTrace: AuthenticationProgramStateCommon[] = [];
      const observedOpcodes = new Set<number>([
        Op.OP_OUTPUTTOKENCOMMITMENT,
        Op.OP_OUTPUTBYTECODE,
        Op.OP_OUTPUTVALUE,
        Op.OP_OUTPUTTOKENAMOUNT,
        Op.OP_OUTPUTTOKENCATEGORY,
        Op.OP_EQUALVERIFY,
      ]);
      // Complex constructor keccak arguments are learned at the contract's OP_INPUTBYTECODE side-car read.
      // Retaining this one additional state is still sparse, and reduceProbeTrace removes it again before the
      // output-pin extractors run.
      if (constructorKeccakPreimages.some((preimage) => preimage === null)) {
        observedOpcodes.add(Op.OP_INPUTBYTECODE);
      }
      let awaitingVerification = false;
      const vm = createVirtualMachineBch2026ForProvider(options.provider, {
        opcodes: observedOpcodes,
        beforeOperation: (unknownState) => {
          const state = unknownState as AuthenticationProgramStateCommon;
          const opcode = state.instructions[state.ip]?.opcode;
          if (opcode === Op.OP_EQUALVERIFY && !awaitingVerification) return;
          sparseTrace.push({
            ...state,
            stack: state.stack.slice(),
            alternateStack: state.alternateStack.slice(),
            controlStack: state.controlStack.slice(),
          });
          awaitingVerification = opcode !== Op.OP_EQUALVERIFY;
        },
      });
      const finalState = vm.evaluate(program) as AuthenticationProgramStateCommon;
      fullTrace = [...sparseTrace, finalState];
    } else {
      fullTrace = createVirtualMachineBch2026ForProvider(options.provider).debug(
        program,
      ) as AuthenticationProgramStateCommon[];
    }

    if (constructorKeccakPreimages.some((preimage) => preimage === null)) {
      if (constructorKeccakBase === undefined) {
        throw new Error('Constructor publishes keccak preimages without a keccakSideCar block-layout slot.');
      }
      try {
        const { callIndex, preimage } = extractKeccakPreimageFromTrace(
          fullTrace, constructorKeccakBase, constructorKeccakPreimages.length, constructorKeccakBatchCount,
        );
        if (constructorKeccakPreimages[callIndex] === null) {
          constructorKeccakPreimages[callIndex] = preimage;
          continue;
        }
      } catch (error) {
        // State/event placeholder checks can stop an earlier convergence iteration before the keccak read.
        // Let the ordinary commitment-learning pass advance those slots, then retry on the next iteration.
        if (!(error instanceof Error)
          || error.message !== 'keccak256 preimage extraction: no side-car read found in the probe trace.') {
          throw error;
        }
      }
    }

    // Keep the faithful trace above for computed keccak preimages and diagnostics, but give all output-pin
    // extractors the same reduced trace shape as evaluateProbeTrace's sparse observer. Without this reduction,
    // outlined constructor checks insert OP_INVOKE/alt-stack instructions between an introspection read and its
    // EQUALVERIFY, making every state/event placeholder look undiscoverable.
    const probeTrace = reduceProbeTrace(fullTrace);

    // Learn entry commitments even from a trace that stops at their placeholder equality check. On the next
    // iteration those commitments are present, allowing execution to reach later state/event derivations.
    const learnedEntryCommits = [...entryCommits];
    let learnedAnyEntry = false;
    if (entryOutputCount > 0) {
      const entryOutputBase = constructorSlotOffset('entry', 0) ?? (1 + stateLayout.dataNftCount);
      for (const [outputIndex, commitment] of extractCommitmentMapFromTrace(probeTrace, {
        min: entryOutputBase,
        max: entryOutputBase + entryOutputCount,
      }, true)) {
        learnedEntryCommits[outputIndex - entryOutputBase] = commitment;
        learnedAnyEntry = true;
      }
    }
    let entryLearningChanged = false;
    if (learnedAnyEntry) {
      for (let index = 0; index < learnedEntryCommits.length; index++) {
        if (learnedEntryCommits[index] !== entryCommits[index]) {
          entryLearningChanged = true;
          break;
        }
      }
    }
    if (entryLearningChanged) {
      entryCommits = learnedEntryCommits;
      continue;
    }
    if (!usesVmapBatchWitnesses) {
      const learnedTrailing = [...trailingEntryCommits];
      let trailingChanged = false;
      for (const [collectionIndex, collectionName] of sortedCollections.entries()) {
        const outputIndex = sortedPlans.get(collectionName)!.trailingOutput;
        const learned = extractCommitmentMapFromTrace(probeTrace, {
          min: outputIndex, max: outputIndex + 1,
        }, false, true).get(outputIndex);
        if (learned !== undefined && learned !== learnedTrailing[collectionIndex]) {
          learnedTrailing[collectionIndex] = learned;
          trailingChanged = true;
        }
      }
      if (trailingChanged) {
        trailingEntryCommits = learnedTrailing;
        continue;
      }
    }

    // An emit may execute before the constructor reaches its final state commitment checks. Learn event
    // placeholders first, using the authoritative block-layout offsets (keccak/oracle slots can precede them),
    // so the next iteration can advance into state derivation.
    let eventLearningChanged = false;
    for (let eventIndex = 0; eventIndex < emitCount; eventIndex++) {
      const outputIndex = constructorSlotOffset('event', eventIndex);
      if (outputIndex === undefined) continue;
      const learned = extractCommitmentMapFromTrace(
        probeTrace, { min: outputIndex, max: outputIndex + 1 }, true, true,
      ).get(outputIndex);
      if (learned !== undefined && learned !== eventCommits[eventIndex]) {
        eventCommits[eventIndex] = learned;
        eventLearningChanged = true;
      }
    }
    if (eventLearningChanged) continue;

    // Extract state commitments with output-index range filtering
    const stateOutputRange = {
      min: 1, max: 1 + requiredIndices.length,
    };
    let stateCommitmentMap = extractCommitmentMapFromTrace(probeTrace, stateOutputRange);
    if (stateCommitmentMap.size === 0) {
      // A constructor helper may perform the failing pin inside OP_INVOKE after the redeem-phase slice. Fall
      // back to the complete trace only when the scoped scan found nothing, and retain its first tightly-coupled
      // pin so later unrelated subroutine verifications at the same numeric output index cannot overwrite it.
      stateCommitmentMap = extractCommitmentMapFromTrace(probeTrace, stateOutputRange, true, true);
    }
    // A mapping-only contract has no scalar/data-NFT commitments to learn; its constructor evidence is carried
    // entirely by the entry commitments below. An empty state map is only an error when fixed state outputs exist.
    if (requiredIndices.length > 0 && stateCommitmentMap.size === 0) {
      const failedStep = [...fullTrace].reverse().find((step) => step.error);
      const vmError = failedStep?.error;
      const vmLocation = failedStep === undefined
        ? ''
        : ` at instruction ${failedStep.ip}/${failedStep.instructions.length}`;
      const vmStack = failedStep === undefined
        ? ''
        : ` (stack: ${failedStep.stack.slice(-4).map((item) => binToHex(item)).join(', ')})`;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_ROUTE
        && failedStep) {
        console.error('constructor-probe-failure', {
          iter, currentCommitments, entryCommits, trailingEntryCommits, eventCommits,
          ip: failedStep.ip,
          instructions: failedStep.instructions.map((instruction) => instruction.opcode),
          instructionWindow: failedStep.instructions.slice(
            Math.max(0, failedStep.ip - 8), failedStep.ip + 9,
          ).map((instruction) => instruction.opcode),
          error: failedStep.error,
          stack: failedStep.stack.map((item) => binToHex(item)),
        });
      }
      throw new Error(
        'Failed to derive initial state commitments from '
        + 'constructor. Ensure the constructor writes all '
        + 'state variables.'
        + (vmError === undefined ? '' : ` VM error${vmLocation}: ${vmError}${vmStack}`)
        + unplannedCause,
      );
    }

    // A subroutine-aware trace slice may expose only the last failing verification, so a partial positional
    // list cannot be assumed to be a prefix. Map each observed output slot back to its exact required NFT.
    for (const [outputIndex, commitment] of stateCommitmentMap) {
      const compactIndex = outputIndex - stateOutputRange.min;
      const nftIndex = requiredIndices[compactIndex];
      if (nftIndex !== undefined) currentCommitments[nftIndex] = commitment;
    }
    stateCommitments = requiredIndices.map((nftIndex) => currentCommitments[nftIndex]);

    // Extract entry commitments
    if (entryOutputCount > 0) {
      const entryOutputBase = constructorSlotOffset('entry', 0) ?? (1 + stateLayout.dataNftCount);
      const entryOutputRange = {
        min: entryOutputBase,
        max: entryOutputBase + entryOutputCount,
      };
      for (const [outputIndex, commitment] of extractCommitmentMapFromTrace(probeTrace, entryOutputRange, true)) {
        entryCommits[outputIndex - entryOutputBase] = commitment;
      }
    }

    // Extract event commitments
    if (emitCount > 0) {
      for (let eventIndex = 0; eventIndex < emitCount; eventIndex++) {
        const outputIndex = constructorSlotOffset('event', eventIndex);
        if (outputIndex === undefined) continue;
        const commitment = extractCommitmentMapFromTrace(
          probeTrace, { min: outputIndex, max: outputIndex + 1 }, true,
        ).get(outputIndex);
        if (commitment !== undefined) eventCommits[eventIndex] = commitment;
      }
    }

    // Extract transfer outputs
    if (reservedChunkNames.length > 0) {
      const chunkBase = (constructorAbi?.blockLayout?.blockSize
        ?? (1 + stateLayout.dataNftCount + entryOutputCount + transferCount + emitCount))
        + sortedCollections.length;
      const chunkRange = { min: chunkBase, max: chunkBase + reservedChunkNames.length };
      for (const [outputIndex, commitment] of extractCommitmentMapFromTrace(probeTrace, chunkRange, true)) {
        const name = reservedChunkNames[outputIndex - chunkBase];
        if (name !== undefined) dynamicChunkCommits[name] = commitment;
      }
    }

    // Extract transfer outputs
    transferOuts = [];
    if (transferCount > 0) {
      const tBase = constructorSlotOffset('transfer', 0)
        ?? (1 + stateLayout.dataNftCount + constructorKeccakBatchCount + entryOutputCount);
      const bytecodes = extractVerifiedValuesFromTrace(
        probeTrace, Op.OP_OUTPUTBYTECODE,
        { min: tBase, max: tBase + transferCount },
      );
      const amounts = extractVerifiedValuesFromTrace(
        probeTrace, Op.OP_OUTPUTVALUE,
        { min: tBase, max: tBase + transferCount },
      );
      if (
        bytecodes.length >= transferCount
        && amounts.length >= transferCount
      ) {
        transferOuts = Array.from(
          { length: transferCount }, (_, i) => ({
            lockingBytecode: bytecodes[i],
            amount: decodeScriptNumber(amounts[i]),
          }),
        );
      }
    }

    // Once the complete constructor probe validates, every learned output placeholder is a fixed point.
    if (!fullTrace.some((step) => step.error !== undefined)) {
      deployConverged = true;
      break;
    }

    // Oscillation detection: if we've seen this exact commitment set before,
    // the derivation is cycling without converging.
    const deployKey = stateCommitments.join('|') + '||' + entryCommits.join('|')
      + '||' + trailingEntryCommits.join('|') + '||' + eventCommits.join('|')
      + '||' + reservedChunkNames.map((name) => dynamicChunkCommits[name] ?? '').join('|');
    if (seenDeployKeys.has(deployKey)) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_DEPLOY === '1') {
        // eslint-disable-next-line no-console
        console.error('constructor-probe-oscillation', {
          iter, stateCommitments, entryCommits, trailingEntryCommits, eventCommits,
          error: [...fullTrace].reverse().find((step) => step.error)?.error,
        });
      }
      throw new Error(
        'Deploy derivation oscillation detected: commitment state is cycling without converging. '
        + (unplannedCause.trim() || 'This may indicate conflicting covenant constraints in the constructor.'),
      );
    }
    seenDeployKeys.add(deployKey);
  }

  if (!deployConverged) {
    throw new Error(
      `Constructor commitment derivation did not converge after ${maxDeployIterations} probes.${unplannedCause}`,
    );
  }

  // Conditional constructor writes reserve fixed entry outputs even when their branch is not taken. The batch
  // probe plans against every potential target, so a materialized node can initially point through an empty
  // (nonexistent) output. Genesis is funder-authorized rather than covenant-spent: rebuild each vmap collection's
  // links over only the entries the trace actually materialized, preserving their computed values.
  for (const [collectionIndex, collectionName] of usesVmapBatchWitnesses ? sortedCollections.entries() : []) {
    const materialized = entryAccesses
      .map((access, index) => ({ access, index, commitment: entryCommits[index] }))
      .filter(({ access, commitment }) => access.collection === collectionName && commitment.length >= 128)
      .map(({ index, commitment }) => ({ index, ...decodeEntryCommitment(hexToBin(commitment)) }))
      .sort((a, b) => {
        const av = bytesToSlotValue(a.slot);
        const bv = bytesToSlotValue(b.slot);
        return av < bv ? -1 : av > bv ? 1 : 0;
      });
    for (let i = 0; i < materialized.length; i++) {
      const entry = materialized[i];
      entryCommits[entry.index] = binToHex(encodeEntryCommitment(
        entry.slot, materialized[i + 1]?.slot ?? new Uint8Array(32), entry.value,
      ));
    }
    trailingEntryCommits[collectionIndex] = binToHex(encodeEntryCommitment(
      new Uint8Array(32), materialized[0]?.slot ?? new Uint8Array(32),
    ));
  }

  return {
    // `stateCommitments` contains only constructor-required indices. Return the complete converged state so
    // untouched, explicitly seeded NFTs are materialized rather than becoming undefined genesis commitments.
    stateCommitments: currentCommitments,
    entryCommitments: entryCommits,
    trailingEntryCommitments: trailingEntryCommits,
    eventCommitments: eventCommits,
    dynamicChunkCommitments: { ...dynamicChunkCommits },
    transferOutputs: transferOuts,
  };
}
