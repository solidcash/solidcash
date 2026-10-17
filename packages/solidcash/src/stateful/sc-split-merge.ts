/**
 * phase-boundary extract: SC lifecycle extract — static split / merge APIs.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodeTransactionUnsafe } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import {
  assertFinalizedBytesWithCovenant, inputSubjectsOfBuilder,
} from '../message-bus/preflight.js';
import type {
  MergeOptions, MergeResult, SplitOptions, SplitResult,
} from './stateful-lifecycle-types.js';


async function computeFeeFromBuilder(builder: TransactionBuilder): Promise<bigint> {
  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  const tx = builder.buildLibauthTransaction();
  return BigInt(encodeTransaction(tx).byteLength);
}

export async function splitStatefulContract(options: SplitOptions): Promise<SplitResult> {
  const {
    provider, contract, splitFunctionName, splitFunctionArgs,
    funder, fundingUtxos, changeAddress,
  } = options;
  // A framed master serves split(n) in its lifecycle arm, outside its ABI.
  if (contract.inner.artifact.composition?.convention === 'framed') {
    const { resizeOptionsFromCall, resizeFramedPool } = await import('../framed/deploy/resize.js');
    const tx = await resizeFramedPool('split', resizeOptionsFromCall('split', {
      provider, contract, functionName: splitFunctionName, args: splitFunctionArgs, fundingUtxos, funder,
      changeAddress, ...(options.newMintingAmount === undefined ? {} : { masterAmount: options.newMintingAmount }),
    }));
    return { tx, categoryId: contract.categoryId };
  }

  // Validate the split function exists and has the 'split' modifier
  const splitAbi = contract.inner.artifact.abi.find(
    (f) => f.name === splitFunctionName,
  );
  if (!splitAbi) {
    throw new Error(`Function '${splitFunctionName}' not found in contract '${contract.name}'.`);
  }
  if (!splitAbi.modifiers?.includes('split')) {
    throw new Error(
      `Function '${splitFunctionName}' does not have the 'split' modifier.`,
    );
  }

  // Find the count parameter
  const splitCountParam = splitAbi.splitCountParam;
  if (!splitCountParam) {
    throw new Error(`Split function '${splitFunctionName}' missing splitCountParam in ABI.`);
  }
  const countParamIndex = splitAbi.inputs.findIndex((p) => p.name === splitCountParam);
  if (countParamIndex === -1) {
    throw new Error(`Split count parameter '${splitCountParam}' not found in function inputs.`);
  }
  const splitCount = Number(splitFunctionArgs[countParamIndex]);
  if (splitCount < 1 || !Number.isInteger(splitCount)) {
    throw new Error(`Split count must be a positive integer, got ${splitCount}.`);
  }

  const newMintingAmount = options.newMintingAmount ?? 1200n;
  const categoryId = contract.categoryId;

  // Get master UTXO directly (split/merge don't need full state with data NFTs)
  const tokenUtxos = await provider.getUtxos(contract.inner.tokenAddress);
  const masterUtxo = tokenUtxos.find(
    (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
  );
  if (!masterUtxo) {
    throw new Error(`Master UTXO not found for contract '${contract.name}' (category ${categoryId}).`);
  }

  // Build transaction
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  const builder = new TransactionBuilder({
    provider,
    ...(options.maxFee != null ? { maximumFeeSatoshis: options.maxFee } : {}),
  });

  // Input 0: master UTXO (unlocked with split function)
  const unlockingArgs = [...splitFunctionArgs];
  builder.addInput(masterUtxo, contract.inner.unlock[splitFunctionName]!(...unlockingArgs));

  // Input 1+: funding UTXOs
  for (const fundingUtxo of fundingUtxos) {
    builder.addInput(fundingUtxo, funder);
  }

  // Output 0: master preserved (same LBC, same token, same commitment)
  builder.addOutput({
    to: contract.inner.tokenAddress,
    amount: masterUtxo.satoshis,
    token: {
      category: categoryId,
      amount: 0n,
      nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
    },
  });

  // Outputs 1..N: new minting NFTs
  for (let i = 0; i < splitCount; i++) {
    builder.addOutput({
      to: contract.inner.tokenAddress,
      amount: newMintingAmount,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    });
  }

  // Compute fee from actual transaction size (1 sat/byte minimum relay fee).
  // Add a placeholder change output before estimating so the fee accounts for it.
  builder.addOutput({ to: changeAddress, amount: 1000n }); // placeholder
  const actualFee = options.fee ?? await computeFeeFromBuilder(builder);
  const totalFunding = fundingUtxos.reduce((sum, u) => sum + u.satoshis, 0n);
  const changeAmount = totalFunding - (newMintingAmount * BigInt(splitCount)) - actualFee;
  if (changeAmount < 0n) {
    builder.outputs.pop(); // remove placeholder
    throw new Error(
      `Insufficient funding for split: need ${newMintingAmount * BigInt(splitCount) + actualFee} sats `
      + `(${splitCount} x ${newMintingAmount} + ${actualFee} fee), but only ${totalFunding} sats available.`,
    );
  }
  if (changeAmount > 0n) {
    builder.outputs[builder.outputs.length - 1] = {
      ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
    };
  } else {
    builder.outputs.pop(); // remove placeholder - no change needed
  }

  // Build and send directly (bypass debug step which doesn't handle covenant unlockers)
  const { hash256 } = await import('@bitauth/libauth/build/lib/crypto/combinations.js');
  const { hexToBin: localHexToBin } = await import('@bitauth/libauth/build/lib/format/hex.js');

  const rawTx = builder.build();
  const rawTxBin = localHexToBin(rawTx);
  const decoded = decodeTransactionUnsafe(rawTxBin);

  // X163, the finalized-bytes gate at the static `split` site. `changeAmount` above is pure arithmetic -
  // `totalFunding - newMintingAmount * splitCount - fee` - and the only floor on it is zero, so any funding
  // that leaves a small positive remainder produces a below-dust change output. MEASURED: funding of exactly
  // `2 * 1200 + 2000 + 100` leaves 100 satoshis against a 576-satoshi threshold for a 44-byte output, and the
  // mock provider accepts it (`enforceDust: false` by default), so nothing in the repo objected.
  //
  // The dust output ALSO evades `addOutput`'s own policy check, and not by accident: the placeholder is added
  // at 1000 satoshis and then overwritten by index on `builder.outputs`, which is the one path into an output
  // that no validator sees. That is the same construction X131 row 2b uses deliberately to reach the gate.
  //
  // X175. THIS SITE HAS NO `debug()` AHEAD OF IT, by design, so the byte gate used to be the FIRST decider and
  // a split that broke its covenant AND paid dust reported only the dust. The ordering no longer decides
  // anything: `assertFinalizedBytesWithCovenant` asks the covenant whenever the bytes are refused and reports
  // BOTH, so neither objection can absorb a test written against the other.
  assertFinalizedBytesWithCovenant(builder, decoded, inputSubjectsOfBuilder(builder));

  const txid = await provider.sendRawTransaction(rawTx);

  // Verify txid matches locally computed hash to detect compromised providers
  const expectedTxid = binToHex(hash256(rawTxBin).reverse());
  if (txid !== expectedTxid) {
    throw new Error(
      `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
      + 'The network provider may be compromised.',
    );
  }

  return { tx: { ...decoded, txid, hex: rawTx } as any, categoryId };
}


export async function mergeStatefulContract(options: MergeOptions): Promise<MergeResult> {
  const {
    provider, contract, mergeFunctionName, mergeFunctionArgs,
    funder, consumedMasterUtxos, fundingUtxos, changeAddress,
  } = options;
  // A framed master serves merge(n) in its lifecycle arm; the consumed masters are the ones retired.
  if (contract.inner.artifact.composition?.convention === 'framed') {
    const { resizeOptionsFromCall, resizeFramedPool } = await import('../framed/deploy/resize.js');
    const tx = await resizeFramedPool('merge', resizeOptionsFromCall('merge', {
      provider, contract, functionName: mergeFunctionName, args: mergeFunctionArgs, fundingUtxos, funder,
      changeAddress, retire: consumedMasterUtxos,
    }));
    return { tx, categoryId: contract.categoryId };
  }

  // Validate the merge function exists and has the 'merge' modifier
  const mergeAbi = contract.inner.artifact.abi.find(
    (f) => f.name === mergeFunctionName,
  );
  if (!mergeAbi) {
    throw new Error(`Function '${mergeFunctionName}' not found in contract '${contract.name}'.`);
  }
  if (!mergeAbi.modifiers?.includes('merge')) {
    throw new Error(
      `Function '${mergeFunctionName}' does not have the 'merge' modifier.`,
    );
  }

  // Validate count
  const mergeCountParam = mergeAbi.mergeCountParam;
  if (!mergeCountParam) {
    throw new Error(`Merge function '${mergeFunctionName}' missing mergeCountParam in ABI.`);
  }
  const countParamIndex = mergeAbi.inputs.findIndex((p) => p.name === mergeCountParam);
  if (countParamIndex === -1) {
    throw new Error(`Merge count parameter '${mergeCountParam}' not found in function inputs.`);
  }
  const mergeCount = Number(mergeFunctionArgs[countParamIndex]);
  if (mergeCount < 1 || !Number.isInteger(mergeCount)) {
    throw new Error(`Merge count must be a positive integer, got ${mergeCount}.`);
  }
  if (consumedMasterUtxos.length !== mergeCount) {
    throw new Error(
      `Merge count is ${mergeCount} but ${consumedMasterUtxos.length} consumed UTXOs provided.`,
    );
  }

  const categoryId = contract.categoryId;

  // Validate consumed master UTXOs have correct category and minting capability
  for (const consumed of consumedMasterUtxos) {
    if (!consumed.token || consumed.token.category !== categoryId) {
      throw new Error(
        `Consumed master UTXO (${consumed.txid}:${consumed.vout}) has wrong category: `
        + `expected '${categoryId}', got '${consumed.token?.category ?? 'none'}'.`,
      );
    }
    if (consumed.token.nft?.capability !== 'minting') {
      throw new Error(
        `Consumed master UTXO (${consumed.txid}:${consumed.vout}) must have 'minting' capability, `
        + `got '${consumed.token.nft?.capability ?? 'none'}'.`,
      );
    }
  }

  // Get surviving master UTXO directly (merge doesn't need full state with data NFTs)
  // Exclude consumed UTXOs so the surviving master is never one being consumed
  const consumedOutpoints = new Set(consumedMasterUtxos.map((u) => `${u.txid}:${u.vout}`));
  const tokenUtxos = await provider.getUtxos(contract.inner.tokenAddress);
  const masterUtxo = tokenUtxos.find(
    (u) => u.token?.category === categoryId
      && u.token?.nft?.capability === 'minting'
      && !consumedOutpoints.has(`${u.txid}:${u.vout}`),
  );
  if (!masterUtxo) {
    throw new Error(`Master UTXO not found for contract '${contract.name}' (category ${categoryId}). All minting UTXOs may be in the consumed set.`);
  }

  // Build transaction (merge intentionally burns consumed minting NFTs)
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  const builder = new TransactionBuilder({
    provider,
    allowImplicitNftBurn: true,
    ...(options.maxFee != null ? { maximumFeeSatoshis: options.maxFee } : {}),
  });

  // Input 0: surviving master UTXO
  const unlockingArgs = [...mergeFunctionArgs];
  builder.addInput(masterUtxo, contract.inner.unlock[mergeFunctionName]!(...unlockingArgs));

  // Inputs 1..N: consumed master UTXOs (same function + args)
  for (const consumed of consumedMasterUtxos) {
    builder.addInput(consumed, contract.inner.unlock[mergeFunctionName]!(...unlockingArgs));
  }

  // Input N+1+: funding UTXOs
  for (const fundingUtxo of fundingUtxos) {
    builder.addInput(fundingUtxo, funder);
  }

  // Output 0: surviving master preserved, carrying every consumed master's value and fungible amount
  // (audit MERGE-1: the covenant requires the survivor to hold the summed totals).
  const consumedSatoshis = consumedMasterUtxos.reduce((sum, u) => sum + u.satoshis, 0n);
  const consumedFt = consumedMasterUtxos.reduce((sum, u) => sum + (u.token?.amount ?? 0n), 0n);
  const survivorFt = masterUtxo.token?.amount ?? 0n;
  builder.addOutput({
    to: contract.inner.tokenAddress,
    amount: masterUtxo.satoshis + consumedSatoshis,
    token: {
      category: categoryId,
      amount: survivorFt + consumedFt,
      nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
    },
  });

  // Compute fee from actual transaction size (1 sat/byte minimum relay fee).
  // Add a placeholder change output before estimating so the fee accounts for it.
  builder.addOutput({ to: changeAddress, amount: 1000n }); // placeholder
  const actualMergeFee = options.fee ?? await computeFeeFromBuilder(builder);
  const totalFunding = fundingUtxos.reduce((sum, u) => sum + u.satoshis, 0n);
  const changeAmount = totalFunding - actualMergeFee;
  if (changeAmount < 0n) {
    builder.outputs.pop(); // remove placeholder
    // The consumed masters' satoshis are pinned to the survivor, so only the funding inputs can pay the fee.
    throw new Error(
      `Insufficient funding for merge: need ${actualMergeFee} sats for fee `
      + `but only have ${totalFunding} sats from funding UTXOs.`,
    );
  }
  if (changeAmount > 0n) {
    builder.outputs[builder.outputs.length - 1] = {
      ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
    };
  } else {
    builder.outputs.pop(); // remove placeholder - no change needed
  }

  // Build and send directly (bypass debug step which doesn't handle covenant unlockers)
  const { hash256 } = await import('@bitauth/libauth/build/lib/crypto/combinations.js');
  const { hexToBin: localHexToBin } = await import('@bitauth/libauth/build/lib/format/hex.js');

  const rawTx = builder.build();
  const rawTxBin = localHexToBin(rawTx);
  const decoded = decodeTransactionUnsafe(rawTxBin);

  // X163, the finalized-bytes gate at the static `merge` site. Same arithmetic hazard as split, from the other
  // direction: `changeAmount` is `consumedSatoshis + totalFunding - fee`, and merge's whole purpose is to
  // reclaim the satoshis the consumed masters were holding. Those are typically 1,200 each - a few hundred
  // above the dust floor - so a fee that eats most of the reclaim leaves a change output under it. MEASURED
  // at 100 satoshis against 576, accepted by the mock and refused `64: dust` by a node.
  //
  // Merge also runs with `allowImplicitNftBurn: true`, so the builder's own burn check is off and the
  // consumed masters vanish into that change output. Refusing here is refusing before an intentional burn
  // whose proceeds the network would not have relayed.
  //
  // X175. Nothing debugs ahead of this site either, so the gate reports the covenant alongside the byte rule
  // rather than in place of it.
  assertFinalizedBytesWithCovenant(builder, decoded, inputSubjectsOfBuilder(builder));

  const txid = await provider.sendRawTransaction(rawTx);

  // Verify txid matches locally computed hash to detect compromised providers
  const expectedTxid = binToHex(hash256(rawTxBin).reverse());
  if (txid !== expectedTxid) {
    throw new Error(
      `Txid mismatch: provider returned '${txid}', expected '${expectedTxid}'. `
      + 'The network provider may be compromised.',
    );
  }

  return { tx: { ...decoded, txid, hex: rawTx } as any, categoryId };
}
