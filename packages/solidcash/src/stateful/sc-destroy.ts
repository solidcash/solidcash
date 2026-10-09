/**
 * phase-boundary extract: SC lifecycle extract — destroy / selfdestruct sweep (+ batch builder).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodeTransactionUnsafe } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { FunctionArgument } from '../Argument.js';
import type { TransactionDetails, Utxo } from '../interfaces.js';
import {
  assertFinalizedBytesWithCovenant, inputSubjectsOfBuilder, type FinalizedByteSubject,
} from '../message-bus/preflight.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import {
  createAnonymousEventNftUnlocker,
  createDestroyDataNftUnlocker,
  createEntryNftUnlocker,
  createEventNftUnlocker,
  createSatoshiContainerUnlocker,
  createTokenContainerUnlocker,
  getAnonymousEventNftAddress,
  getEntryNftAddress,
  getEventNftAddress,
  getSatoshiContainerAddress,
  getTokenContainerAddress,
} from './covenant-helpers.js';
import { StateReader } from './StateReader.js';
import type { DestroyOptions, DestroyResult } from './stateful-lifecycle-types.js';
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

export interface DestroyBatch {
  hex: string;
  reclaimed: bigint;
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
    kind: 'data' | 'entry' | 'event'
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
        builder.addInput(nftInput.utxo, unlocker);
        break;
      }
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
    if (reclaimed < 0n) {
      throw new Error(
        'Destroy batch cannot preserve its master and pay the finalized relay fee. '
        + `Available fee value: ${totalInputSats - masterAmount} satoshis.`,
      );
    }
    if (reclaimed > 0n) {
      builder.outputs[builder.outputs.length - 1] = {
        ...builder.outputs[builder.outputs.length - 1], amount: reclaimed,
      };
    } else {
      builder.outputs.pop(); // remove placeholder - no reclaim
    }
    const hex = builder.build();
    return {
      hex, reclaimed: reclaimed > 0n ? reclaimed : 0n, subjects: inputSubjectsOfBuilder(builder), builder,
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

  // 5. Satoshi container UTXO (deterministic address)
  const satoshiContainerInputs: Array<{ utxo: Utxo }> = [];
  try {
    const satContainerAddr = getSatoshiContainerAddress(
      contract.inner, categoryId,
    );
    const satContainerUtxos = await provider.getUtxos(satContainerAddr);
    for (const utxo of satContainerUtxos) {
      satoshiContainerInputs.push({ utxo });
    }
  } catch {
    // Satoshi container may not exist
  }

  // 6. Token container UTXOs (best-effort from extra category IDs)
  const tokenContainerInputs: Array<{
    utxo: Utxo; tokenContainerCategoryId: string;
  }> = [];
  for (const tcCatId of options.tokenContainerCategoryIds ?? []) {
    try {
      const tcAddr = getTokenContainerAddress(
        contract.inner, categoryId, tcCatId,
      );
      const tcUtxos = await provider.getUtxos(tcAddr);
      for (const utxo of tcUtxos) {
        tokenContainerInputs.push({
          utxo, tokenContainerCategoryId: tcCatId,
        });
      }
    } catch {
      // Token container may not exist
    }
  }

  // Collect all non-master inputs for destruction
  type NftInput = {
    utxo: Utxo;
    kind: 'data' | 'entry' | 'event'
    | 'satoshiContainer' | 'tokenContainer';
    collection?: string;
    eventSignature?: string;
    tokenContainerCategoryId?: string;
  };
  const allNftInputs: NftInput[] = [
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
    ...satoshiContainerInputs.map((s) => ({
      utxo: s.utxo, kind: 'satoshiContainer' as const,
    })),
    ...tokenContainerInputs.map((tc) => ({
      utxo: tc.utxo, kind: 'tokenContainer' as const,
      tokenContainerCategoryId: tc.tokenContainerCategoryId,
    })),
  ];

  const totalInputs = masterUtxos.length + allNftInputs.length;
  const builtTxs: DestroyBatch[] = [];

  if (totalInputs <= maxInputsPerTx) {
    // Single transaction: destroy everything at once
    const result = await buildDestroyTransactionHex(
      contract, categoryId, fee, recipient,
      masterUtxos, allNftInputs,
      destroyFunctionName, destroyFunctionArgs,
      true, options.maxFee,
    );
    builtTxs.push(result);
  } else {
    // Batch mode: prebuild ALL transactions before submitting any
    const primaryMaster = { ...masterUtxos[0] };
    const remainingMasters = masterUtxos.slice(1);
    let remainingNfts = [...allNftInputs];

    while (remainingNfts.length > 0) {
      const batchSize = Math.min(remainingNfts.length, maxInputsPerTx - 1);
      const isFinal = batchSize >= remainingNfts.length
        && remainingMasters.length + 1 + batchSize <= maxInputsPerTx;

      const batch = remainingNfts.splice(0, batchSize);

      if (isFinal) {
        const result = await buildDestroyTransactionHex(
          contract, categoryId, fee, recipient,
          [primaryMaster, ...remainingMasters], batch,
          destroyFunctionName, destroyFunctionArgs,
          true, options.maxFee,
        );
        builtTxs.push(result);
        remainingMasters.length = 0; // Clear to prevent duplicate post-loop batch
      } else {
        const result = await buildDestroyTransactionHex(
          contract, categoryId, fee, recipient,
          [primaryMaster], batch,
          destroyFunctionName, destroyFunctionArgs,
          false, options.maxFee,
        );
        builtTxs.push(result);
        // Compute txid locally to track master UTXO across batches without broadcasting
        const { hash256: localHash256 } = await import('@bitauth/libauth/build/lib/crypto/combinations.js');
        const { binToHex: localBinToHex } = await import('@bitauth/libauth/build/lib/format/hex.js');

        const localTxid = localBinToHex(localHash256(hexToBin(result.hex)).reverse());
        primaryMaster.txid = localTxid;
        primaryMaster.vout = 0;
      }
    }

    // If there are remaining masters (multi-threaded) that weren't included yet
    if (remainingMasters.length > 0 && remainingNfts.length === 0) {
      const result = await buildDestroyTransactionHex(
        contract, categoryId, fee, recipient,
        [primaryMaster, ...remainingMasters], [],
        destroyFunctionName, destroyFunctionArgs,
        true, options.maxFee,
      );
      builtTxs.push(result);
    }
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

  return { txs, totalReclaimed };
}
