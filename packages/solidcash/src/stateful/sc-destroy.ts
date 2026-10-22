/**
 * phase-boundary extract: SC lifecycle extract — destroy / selfdestruct sweep (+ batch builder).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodeTransactionUnsafe } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { TransactionDetails, Utxo } from '../interfaces.js';
import {
  assertFinalizedBytesWithCovenant, inputSubjectsOfBuilder, type FinalizedByteSubject,
} from '../message-bus/preflight.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { getDustThreshold } from '../network/dust-threshold.js';
import { addressToLockScript, calculateDust } from '../utils.js';
import {
  createAnonymousEventNftUnlocker,
  createDestroyDataNftUnlocker,
  createEntryNftUnlocker,
  createEventContinuationNftUnlocker,
  createEventNftUnlocker,
  createSatoshiContainerUnlocker,
  createTokenContainerUnlocker,
  EVENT_NFT_RELATIVE_LOCK_SEQUENCE,
  getAnonymousEventNftAddress,
  getEntryNftAddress,
  getEventNftAddress,
  getEventNftContinuationAddress,
  getSatoshiContainerAddress,
  getTokenContainerAddress,
  isSatoshiContainerCoin,
  isTokenContainerCoin,
} from './covenant-helpers.js';
import { StateReader } from './StateReader.js';
import type { DestroyOptions, DestroyResult, LeftBehindCoin } from './stateful-lifecycle-types.js';
import type { ConnectedStatefulContract } from './StatefulContract.js';

async function computeFeeFromBuilder(builder: TransactionBuilder): Promise<bigint> {
  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  const tx = builder.buildLibauthTransaction();
  return BigInt(encodeTransaction(tx).byteLength);
}

/**
 * Price a destroy reclaim output against the transaction that carries its FINAL amount. ECDSA signatures are
 * DER-encoded, so changing the placeholder amount changes the sighash and can grow an unlocking by a byte. A
 * one-shot estimate can therefore underpay relay even though it measured the same builder. Fees only rise here;
 * once the re-signed transaction is no larger than the accumulated fee, the result is safely relayable.
 */
async function settleDestroyReclaimFee(
  builder: TransactionBuilder, available: bigint, feeOverride: bigint | undefined,
): Promise<{ fee: bigint; reclaimed: bigint }> {
  if (feeOverride !== undefined) return { fee: feeOverride, reclaimed: available - feeOverride };
  let fee = await computeFeeFromBuilder(builder);
  for (let attempt = 0; attempt < 32; attempt++) {
    const reclaimed = available - fee;
    if (reclaimed <= 0n) return { fee, reclaimed };
    builder.outputs[builder.outputs.length - 1] = {
      ...builder.outputs[builder.outputs.length - 1], amount: reclaimed,
    };
    const measured = await computeFeeFromBuilder(builder);
    if (measured <= fee) return { fee, reclaimed };
    fee = measured;
  }
  throw new Error('Destroy transaction fee did not converge after 32 finalized-size measurements.');
}

/**
 * Settle an automatic-fee intermediate batch whose records cannot pay its finalized fee: the master's carried value
 * (output 0) covers the shortfall, down to its own dust floor. Selfdestruct pins the minting NFT, not its value, and
 * the final batch reclaims the rest. Fees only rise, as in settleDestroyReclaimFee.
 */
async function settleDestroyMasterFee(
  builder: TransactionBuilder, totalInputSats: bigint, masterAmount: bigint,
): Promise<void> {
  const floor = BigInt(calculateDust(builder.outputs[0]));
  let fee = await computeFeeFromBuilder(builder);
  for (let attempt = 0; attempt < 32; attempt++) {
    const amount = totalInputSats - fee < masterAmount ? totalInputSats - fee : masterAmount;
    if (amount < floor) {
      throw new Error(
        'Destroy batch cannot preserve its master and pay the finalized relay fee. '
        + `Available fee value: ${totalInputSats - floor} satoshis.`,
      );
    }
    builder.outputs[0] = { ...builder.outputs[0], amount };
    const measured = await computeFeeFromBuilder(builder);
    if (measured <= fee) return;
    fee = measured;
  }
  throw new Error('Destroy transaction fee did not converge after 32 finalized-size measurements.');
}

export interface DestroyBatch {
  hex: string;
  reclaimed: bigint;
  /** An intermediate batch's master output value, which the next batch spends. */
  masterAmount?: bigint;
  subjects: (FinalizedByteSubject | undefined)[];
  /** X175: kept so a refused batch can report its covenant objection alongside its byte rule. */
  builder: TransactionBuilder;
}

export async function buildDestroyTransactionHex(
  contract: ConnectedStatefulContract,
  categoryId: string,
  feeOverride: bigint | undefined,
  recipient: string,
  masterUtxos: Utxo[],
  nftInputs: Array<{
    utxo: Utxo;
    kind: 'data' | 'entry' | 'event' | 'eventContinuation'
    | 'satoshiContainer' | 'tokenContainer';
    collection?: string;
    eventSignature?: string;
    tokenContainerCategoryId?: string;
  }>,
  destroyFunctionName: string,
  destroyFunctionArgs: FunctionArgument[],
  isFinal: boolean,
  maxFee?: bigint,
): Promise<DestroyBatch> {
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  const builder = new TransactionBuilder({
    provider: contract.inner.provider,
    allowImplicitNftBurn: true,
    ...(maxFee != null ? { maximumFeeSatoshis: maxFee } : {}),
  });

  // Input 0: primary master UTXO
  const stateInputUnlocker = (contract.inner.unlock as any)[destroyFunctionName](...destroyFunctionArgs);
  builder.addInput(masterUtxos[0], stateInputUnlocker);

  // Additional masters (for final multi-threaded destruction)
  for (let i = 1; i < masterUtxos.length; i++) {
    const additionalUnlocker = (contract.inner.unlock as any)[destroyFunctionName](...destroyFunctionArgs);
    builder.addInput(masterUtxos[i], additionalUnlocker);
  }

  // NFT inputs with appropriate unlockers
  const masterInputIndex = 0;
  for (const nftInput of nftInputs) {
    switch (nftInput.kind) {
      case 'data':
        builder.addInput(
          nftInput.utxo,
          createDestroyDataNftUnlocker(contract.inner, masterInputIndex, categoryId),
        );
        break;
      case 'entry':
        builder.addInput(
          nftInput.utxo,
          createEntryNftUnlocker(contract.inner, masterInputIndex, categoryId, nftInput.collection!),
        );
        break;
      case 'event': {
        const evDef = (contract.inner.artifact.events ?? []).find(
          (e) => e.signature === nftInput.eventSignature,
        );
        const unlocker = evDef?.anonymous
          ? createAnonymousEventNftUnlocker(contract.inner, categoryId)
          : createEventNftUnlocker(contract.inner, categoryId, nftInput.eventSignature!);
        // The event covenant's 144-block OP_CHECKSEQUENCEVERIFY needs a non-final, block-based sequence.
        builder.addInput(nftInput.utxo, unlocker, { sequence: EVENT_NFT_RELATIVE_LOCK_SEQUENCE });
        break;
      }
      case 'eventContinuation':
        builder.addInput(
          nftInput.utxo,
          createEventContinuationNftUnlocker(contract.inner, categoryId, nftInput.eventSignature!),
          { sequence: EVENT_NFT_RELATIVE_LOCK_SEQUENCE },
        );
        break;
      case 'satoshiContainer':
        builder.addInput(
          nftInput.utxo,
          createSatoshiContainerUnlocker(
            contract.inner, masterInputIndex, categoryId,
          ),
        );
        break;
      case 'tokenContainer':
        builder.addInput(
          nftInput.utxo,
          createTokenContainerUnlocker(
            contract.inner, masterInputIndex, categoryId,
            nftInput.tokenContainerCategoryId!,
          ),
        );
        break;
    }
  }

  // Calculate total input satoshis
  let totalInputSats = 0n;
  for (const master of masterUtxos) totalInputSats += master.satoshis;
  for (const nft of nftInputs) totalInputSats += nft.utxo.satoshis;

  if (!isFinal) {
    // Intermediate: recreate master UTXO at output 0
    const masterAmount = masterUtxos[0].satoshis;
    builder.addOutput({
      to: contract.tokenAddress,
      amount: masterAmount,
      token: {
        category: categoryId,
        amount: masterUtxos[0].token?.amount ?? 0n,
        nft: {
          capability: 'minting',
          commitment: masterUtxos[0].token?.nft?.commitment ?? '',
        },
      },
    });

    // Add placeholder reclaim output to estimate fee, then adjust
    builder.addOutput({ to: recipient, amount: 1000n }); // placeholder
    const { reclaimed } = await settleDestroyReclaimFee(
      builder, totalInputSats - masterAmount, feeOverride,
    );
    // An explicit fee is exact: the records pay it in full or the batch is refused.
    if (reclaimed < 0n && feeOverride !== undefined) {
      throw new Error(
        'Destroy batch cannot preserve its master and pay the finalized relay fee. '
        + `Available fee value: ${totalInputSats - masterAmount} satoshis.`,
      );
    }
    // An automatic fee leaves a sub-dust remainder to the fee: a reclaim output that small does not relay.
    const keepReclaim = reclaimed > 0n && (feeOverride !== undefined
      || reclaimed >= getDustThreshold({ lockingBytecode: addressToLockScript(recipient) }));
    if (keepReclaim) {
      builder.outputs[builder.outputs.length - 1] = {
        ...builder.outputs[builder.outputs.length - 1], amount: reclaimed,
      };
    } else {
      builder.outputs.pop(); // remove placeholder - no reclaim
      if (reclaimed < 0n) await settleDestroyMasterFee(builder, totalInputSats, masterAmount);
    }
    const hex = builder.build();
    return {
      hex, reclaimed: keepReclaim ? reclaimed : 0n, masterAmount: builder.outputs[0].amount,
      subjects: inputSubjectsOfBuilder(builder), builder,
    };
  }

  // Final: send everything to recipient. Add placeholder output for fee estimation.
  builder.addOutput({ to: recipient, amount: 1000n }); // placeholder
  const { fee, reclaimed } = await settleDestroyReclaimFee(builder, totalInputSats, feeOverride);
  if (reclaimed <= 0n) {
    throw new Error(
      'Destroy transaction has no funds to reclaim after fees. '
      + `Total inputs: ${totalInputSats}, fee: ${fee}.`,
    );
  }
  builder.outputs[builder.outputs.length - 1] = {
    ...builder.outputs[builder.outputs.length - 1], amount: reclaimed,
  };
  const hex = builder.build();
  return { hex, reclaimed, subjects: inputSubjectsOfBuilder(builder), builder };
}

export async function destroyStatefulContract(options: DestroyOptions): Promise<DestroyResult> {
  const {
    provider, contract, destroyFunctionName, destroyFunctionArgs,
    recipient,
  } = options;
  const fee = options.fee; // undefined -> auto-computed per-tx from builder size
  const maxInputsPerTx = options.maxInputsPerTx ?? 200;

  // Validate the destroy function exists and has the 'selfdestruct' modifier
  const destroyAbi = contract.inner.artifact.abi.find(
    (f) => f.name === destroyFunctionName,
  );
  if (!destroyAbi) {
    throw new Error(
      `Function '${destroyFunctionName}' not found in contract '${contract.name}'.`,
    );
  }
  if (!destroyAbi.modifiers?.includes('selfdestruct')) {
    throw new Error(
      `Function '${destroyFunctionName}' does not have the 'selfdestruct' modifier. `
      + 'Only functions with the selfdestruct modifier can be used for contract destruction.',
    );
  }

  const categoryId = contract.categoryId;
  const stateLayout = contract.inner.stateLayout;
  if (!stateLayout) {
    throw new Error(`Contract '${contract.name}' is not a stateful contract.`);
  }

  // Discover ALL UTXOs
  // 1. Master UTXOs (may be multiple for threaded contracts)
  const tokenAddressUtxos = await provider.getUtxos(contract.tokenAddress);
  const stateReader = new StateReader(stateLayout);
  const masterUtxos = stateReader.findMasterUtxos(tokenAddressUtxos, categoryId);
  if (masterUtxos.length === 0) {
    throw new Error(
      `No master UTXO found for contract '${contract.name}' (category ${categoryId}).`,
    );
  }

  // 2. Data NFT UTXOs
  const onChainState = await contract.getFullState();
  const dataNftUtxos = onChainState.dataNftUtxos;

  // 3. Entry NFT UTXOs (one address per collection)
  const entryNftInputs: Array<{ utxo: Utxo; collection: string }> = [];
  for (const collection of stateLayout.collections ?? []) {
    const entryAddress = getEntryNftAddress(contract.inner, categoryId, collection.signature);
    try {
      const entryUtxos = await provider.getUtxos(entryAddress);
      const entries = entryUtxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft,
      );
      for (const utxo of entries) {
        entryNftInputs.push({ utxo, collection: collection.signature });
      }
    } catch (err: any) {
      // Rethrow network/provider errors; only suppress "no UTXOs" scenarios
      const msg = err?.message ?? '';
      if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')
          || msg.includes('socket') || msg.includes('network') || msg.includes('fetch failed')) {
        throw new Error(
          `Network error while fetching entry NFTs for collection '${collection.signature}': ${msg}`,
        );
      }
      // No UTXOs at this address - expected when collection is empty
    }
  }

  // 4. Event NFT UTXOs (best-effort - CSV timelock may not have elapsed)
  const eventNftInputs: Array<{ utxo: Utxo; eventSignature: string }> = [];
  for (const eventDef of contract.inner.artifact.events ?? []) {
    const isAnonymous = eventDef.anonymous === true;
    const eventAddress = isAnonymous
      ? getAnonymousEventNftAddress(contract.inner, categoryId)
      : getEventNftAddress(contract.inner, categoryId, eventDef.signature);
    try {
      const eventUtxos = await provider.getUtxos(eventAddress);
      const events = eventUtxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft,
      );
      for (const utxo of events) {
        eventNftInputs.push({ utxo, eventSignature: eventDef.signature });
      }
    } catch {
      // Event address may not have any UTXOs
    }
  }

  // 4b. Wide-event continuation chunk UTXOs (best-effort, same 144-block CSV as the head).
  const eventContinuationInputs: Array<{ utxo: Utxo; eventSignature: string }> = [];
  for (const eventDef of contract.inner.artifact.events ?? []) {
    try {
      const continuationAddress = getEventNftContinuationAddress(
        contract.inner, categoryId, eventDef.signature,
      );
      const continuationUtxos = await provider.getUtxos(continuationAddress);
      const chunks = continuationUtxos.filter(
        (u) => u.token?.category === categoryId && u.token?.nft,
      );
      for (const utxo of chunks) {
        eventContinuationInputs.push({ utxo, eventSignature: eventDef.signature });
      }
    } catch {
      // Continuation address may not have any UTXOs
    }
  }

  // 5-6. Containers. A satoshi container is a tokenless coin at its address, a token container a coin of its own
  // address's category. Anyone can send coins there; anything else is junk, left in place and reported, so it cannot
  // crowd the final batch or block the sweep on a token it carries. A listing error refuses: a container missed here
  // is stranded once the master is gone.
  const leftBehind: LeftBehindCoin[] = [];
  const containersAt = async (address: string, isContainer: (utxo: Utxo) => boolean): Promise<Utxo[]> => (
    (await provider.getUtxos(address)).filter((utxo) => {
      if (isContainer(utxo)) return true;
      leftBehind.push({
        outpoint: `${utxo.txid}:${utxo.vout}`, address, satoshis: utxo.satoshis,
        ...(utxo.token !== undefined && { token: utxo.token }),
      });
      return false;
    })
  );
  const satoshiContainerUtxos = await containersAt(
    getSatoshiContainerAddress(contract.inner, categoryId), isSatoshiContainerCoin,
  );
  const tokenContainerInputs: Array<{ utxo: Utxo; tokenContainerCategoryId: string }> = [];
  for (const tcCatId of new Set((options.tokenContainerCategoryIds ?? []).map((id) => id.toLowerCase()))) {
    const tcAddr = getTokenContainerAddress(contract.inner, categoryId, tcCatId);
    for (const utxo of await containersAt(tcAddr, (coin) => isTokenContainerCoin(coin, tcCatId))) {
      tokenContainerInputs.push({ utxo, tokenContainerCategoryId: tcCatId });
    }
  }

  // Collect all non-master inputs for destruction
  type NftInput = {
    utxo: Utxo;
    kind: 'data' | 'entry' | 'event' | 'eventContinuation'
    | 'satoshiContainer' | 'tokenContainer';
    collection?: string;
    eventSignature?: string;
    tokenContainerCategoryId?: string;
  };
  const recordInputs: NftInput[] = [
    ...dataNftUtxos.map((u) => ({
      utxo: u, kind: 'data' as const,
    })),
    ...entryNftInputs.map((e) => ({
      utxo: e.utxo, kind: 'entry' as const, collection: e.collection,
    })),
    ...eventNftInputs.map((ev) => ({
      utxo: ev.utxo, kind: 'event' as const,
      eventSignature: ev.eventSignature,
    })),
    ...eventContinuationInputs.map((c) => ({
      utxo: c.utxo, kind: 'eventContinuation' as const,
      eventSignature: c.eventSignature,
    })),
  ];
  const containerInputs: NftInput[] = [
    ...satoshiContainerUtxos.map((utxo) => ({
      utxo, kind: 'satoshiContainer' as const,
    })),
    ...tokenContainerInputs.map((tc) => ({
      utxo: tc.utxo, kind: 'tokenContainer' as const,
      tokenContainerCategoryId: tc.tokenContainerCategoryId,
    })),
  ];

  const totalInputs = masterUtxos.length + recordInputs.length + containerInputs.length;
  const builtTxs: DestroyBatch[] = [];

  if (totalInputs <= maxInputsPerTx) {
    // Single transaction: destroy everything at once
    const result = await buildDestroyTransactionHex(
      contract, categoryId, fee, recipient,
      masterUtxos, [...recordInputs, ...containerInputs],
      destroyFunctionName, destroyFunctionArgs,
      true, options.maxFee,
    );
    builtTxs.push(result);
  } else {
    // Batch mode: prebuild ALL transactions before submitting any. Every container goes in the final batch beside
    // the masters: an intermediate batch recreates the master, so a direct container's pin there wants an output at
    // its own input index, which the batch lacks.
    const finalRoom = maxInputsPerTx - masterUtxos.length;
    if (containerInputs.length > finalRoom) {
      throw new Error(
        `Destroy must spend all ${containerInputs.length} container coin(s) in its final transaction beside `
        + `${masterUtxos.length} master(s), but maxInputsPerTx is ${maxInputsPerTx}: an intermediate batch `
        + 'recreates the master, and a container spent there fails its covenant. Raise maxInputsPerTx, keeping the '
        + 'final transaction within standard size.',
      );
    }
    const perBatch = maxInputsPerTx - 1;
    const finalRecords = Math.max(0, Math.min(recordInputs.length, finalRoom - containerInputs.length));
    const intermediateRecords = recordInputs.slice(0, recordInputs.length - finalRecords);
    if (intermediateRecords.length > 0 && perBatch < 1) {
      throw new Error('maxInputsPerTx must leave room for the master and a record in each intermediate destroy batch.');
    }
    const primaryMaster = { ...masterUtxos[0] };
    const { hash256: localHash256 } = await import('@bitauth/libauth/build/lib/crypto/combinations.js');

    for (let start = 0; start < intermediateRecords.length; start += perBatch) {
      const result = await buildDestroyTransactionHex(
        contract, categoryId, fee, recipient,
        [primaryMaster], intermediateRecords.slice(start, start + perBatch),
        destroyFunctionName, destroyFunctionArgs,
        false, options.maxFee,
      );
      builtTxs.push(result);
      // Compute txid locally to track master UTXO across batches without broadcasting
      primaryMaster.txid = binToHex(localHash256(hexToBin(result.hex)).reverse());
      primaryMaster.vout = 0;
      // The batch may have paid part of its fee from the master: spend it at the value it left.
      primaryMaster.satoshis = result.masterAmount ?? primaryMaster.satoshis;
    }

    const result = await buildDestroyTransactionHex(
      contract, categoryId, fee, recipient,
      [primaryMaster, ...masterUtxos.slice(1)],
      [...recordInputs.slice(recordInputs.length - finalRecords), ...containerInputs],
      destroyFunctionName, destroyFunctionArgs,
      true, options.maxFee,
    );
    builtTxs.push(result);
  }

  // Submit all prebuilt transactions sequentially
  const txs: TransactionDetails[] = [];
  let totalReclaimed = 0n;
  const { hash256 } = await import('@bitauth/libauth/build/lib/crypto/combinations.js');
  const { decodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');


  // X163, the finalized-bytes gate at the `destroy` sweep. Destroy sweeps EVERY remaining UTXO into one reclaim
  // output whose amount is `totalInputSats - fee` - arithmetic, never checked against a floor - so a contract
  // holding little more than its fee reclaims a below-dust amount and a node refuses the whole sweep
  // `64: dust`. MEASURED: a 2,400-satoshi contract swept at a 2,300-satoshi fee produces a 100-satoshi
  // reclaim against a 576-satoshi threshold, and `MockNetworkProvider` takes those bytes, because its default
  // policy is `enforceDust: false`. The existing `reclaimed <= 0n` throw is one satoshi wide and never
  // reaches this band.
  //
  // BEFORE THE LOOP, NOT INSIDE IT, and that placement is the whole reason batch mode prebuilds every
  // transaction before submitting any. The batches chain - each intermediate's master output is the next
  // one's input, by locally computed txid - so a refusal on batch `i` from inside the loop would leave
  // `0..i-1` already settled and the contract half-swept, with no path that both finishes and reports. Every
  // batch is final and decodable here, so deciding all of them first keeps the refusal atomic.
  //
  // X175. Each batch carries its own builder so a refused batch can report its covenant alongside its byte
  // rule. Only batch 0 spends inputs that exist yet - the rest chain on locally computed txids - but the
  // evaluation reads SOURCE OUTPUTS off the builder rather than the chain, so every batch is evaluable.
  for (const { hex, subjects, builder } of builtTxs) {
    assertFinalizedBytesWithCovenant(builder, decodeTransactionUnsafe(hexToBin(hex)), subjects);
  }

  for (let i = 0; i < builtTxs.length; i++) {
    const { hex, reclaimed } = builtTxs[i];
    const txBin = hexToBin(hex);
    const txid = await provider.sendRawTransaction(hex);

    // Verify txid matches locally computed hash
    const expectedTxid = binToHex(hash256(txBin).reverse());
    if (txid !== expectedTxid) {
      throw new Error(
        `Txid mismatch in batch ${i}: provider returned '${txid}', expected '${expectedTxid}'. `
        + 'The network provider may be compromised.',
      );
    }

    const libauthTx = decodeTransaction(txBin);
    if (typeof libauthTx === 'string') {
      throw new Error(`Failed to decode transaction in batch ${i}: ${libauthTx}`);
    }
    txs.push({ ...libauthTx, txid, hex });
    totalReclaimed += reclaimed;
  }

  return { txs, totalReclaimed, leftBehind };
}

/**
 * An ordinary call recreates the master and carries each record, so through a selfdestruct entry it retires nothing,
 * and the entry refuses a carried record whose state changed. Retiring the contract takes the destroy sweep.
 */
export function refuseOrdinarySelfdestructCall(artifact: Artifact, abiFunction: AbiFunction | undefined): void {
  if (!abiFunction?.modifiers?.includes('selfdestruct')) return;
  throw new Error(
    `${artifact.contractName}.${abiFunction.name}() is a selfdestruct entry: an ordinary call keeps the master and `
    + 'retires nothing. Destroy the contract with StatefulContract.destroy, or StatefulContract.selfdestructTo for '
    + 'selfdestruct(addr).',
  );
}
