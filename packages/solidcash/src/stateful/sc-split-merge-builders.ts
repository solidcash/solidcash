/**
 * phase-boundary extract: SC class-body extract — split/merge transaction builder construction.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { blockOracleLockingBytecode, blockOracleReadUnlocking, type Artifact } from '@solidcash/utils';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { Output, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { pickBlockOracleCoin } from '../oracle/block-oracle-lock.js';
import type { StatefulContract } from './StatefulContract.js';

/** The block-info oracle coin a split co-spends, and the output that recreates it or copies it. */
export interface SplitBlockOracle {
  utxo: Utxo;
  unlocker: Unlocker;
  output(): Output;
}

/**
 * A direct genesis mints one block-info oracle coin per master, so a direct split co-spends one coin on its read path
 * and copies it once per new master; its masters admit exactly those copies. A framed or message-bus compile keeps
 * one coin, and its split pins the coin's recreation alone.
 */
export async function splitBlockOracle(
  provider: NetworkProvider, artifact: Artifact, categoryId: string,
): Promise<SplitBlockOracle | undefined> {
  if (artifact.usesBlockOracle !== true || artifact.compiler?.options?.messageBus === true
    || artifact.composition !== undefined) {
    return undefined;
  }
  const category = hexToBin(categoryId);
  const lock = blockOracleLockingBytecode(category);
  const utxo = pickBlockOracleCoin(await provider.getUtxosForLockingBytecode(lock), lock);
  if (utxo?.token?.nft === undefined) throw new Error('block oracle UTXO is not available');
  const { category: coinCategory, amount } = utxo.token;
  const { capability, commitment } = utxo.token.nft;
  return {
    utxo,
    unlocker: {
      generateLockingBytecode: (): Uint8Array => lock,
      generateUnlockingBytecode: (): Uint8Array => blockOracleReadUnlocking(category),
    },
    output: (): Output => ({
      to: lock, amount: utxo.satoshis, token: { category: coinCategory, amount, nft: { capability, commitment } },
    }),
  };
}

export interface SplitMergeBuilderHost {
  functionName?: string;
  functionArgs?: any[];
  parentContract?: StatefulContract;
  splitFundingConfig?: {
    utxos: Utxo[];
    unlocker: Unlocker;
    changeAddress: string;
    newMintingAmount?: bigint;
    fee?: bigint;
  };
  mergeConfig?: {
    consumedMasters: Utxo[];
    fundingUtxos?: Utxo[];
    fundingUnlocker?: Unlocker;
    changeAddress: string;
    fee?: bigint;
  };
  computeFeeFromBuilder(builder: TransactionBuilder): Promise<bigint>;
}

export async function buildSplitTransactionBuilder(
  host: SplitMergeBuilderHost,
  abiFunction: { inputs: readonly { name: string }[]; splitCountParam?: string },
  maxFeeOverride?: bigint,
): Promise<TransactionBuilder> {
  const sc = host.parentContract!;
  const contract = sc.inner;
  const categoryId = sc.categoryId;
  const config = host.splitFundingConfig!;

  // Extract split count from args
  const countParamIndex = abiFunction.inputs.findIndex(
    (p) => p.name === abiFunction.splitCountParam,
  );
  const splitCount = Number(host.functionArgs![countParamIndex]);
  const newMintingAmount = config.newMintingAmount ?? 1200n;

  // Get master UTXO
  const tokenUtxos = await contract.provider.getUtxos(contract.tokenAddress);
  const masterUtxo = tokenUtxos.find(
    (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
  );
  if (!masterUtxo) {
    throw new Error(`Master UTXO not found for contract '${contract.name}' (category ${categoryId}).`);
  }

  const oracle = await splitBlockOracle(contract.provider, contract.artifact, categoryId);
  const oracleCopies = oracle === undefined ? 0n : oracle.utxo.satoshis * BigInt(splitCount);

  const { TransactionBuilder: TxBuilder } = await import('../TransactionBuilder.js');
  const builder = new TxBuilder({
    provider: contract.provider,
    ...(maxFeeOverride != null ? { maximumFeeSatoshis: maxFeeOverride } : {}),
  });

  // A block.* reader's oracle coin leads, recreated at its index.
  if (oracle !== undefined) builder.addInput(oracle.utxo, oracle.unlocker);

  // The master UTXO (unlocked with split function)
  builder.addInput(masterUtxo, contract.unlock[host.functionName!]!(...host.functionArgs!));

  // Then the funding UTXOs
  for (const fundingUtxo of config.utxos) {
    builder.addInput(fundingUtxo, config.unlocker);
  }

  if (oracle !== undefined) builder.addOutput(oracle.output());

  // The master preserved
  builder.addOutput({
    to: contract.tokenAddress,
    amount: masterUtxo.satoshis,
    token: {
      category: categoryId,
      amount: 0n,
      nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
    },
  });

  // N new minting NFTs
  for (let i = 0; i < splitCount; i++) {
    builder.addOutput({
      to: contract.tokenAddress,
      amount: newMintingAmount,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    });
  }

  // One copy of the oracle coin per new master, which the funding pays for.
  for (let i = 0; oracle !== undefined && i < splitCount; i++) builder.addOutput(oracle.output());

  // Compute fee from actual transaction size (1 sat/byte minimum relay fee).
  // Add a placeholder change output before estimating so the fee accounts for it.
  builder.addOutput({ to: config.changeAddress, amount: 1000n }); // placeholder
  const fee = config.fee ?? await host.computeFeeFromBuilder(builder);

  // Change output
  const totalFunding = config.utxos.reduce((sum, u) => sum + u.satoshis, 0n);
  const changeAmount = totalFunding - (newMintingAmount * BigInt(splitCount)) - oracleCopies - fee;
  if (changeAmount < 0n) {
    builder.outputs.pop(); // remove placeholder
    throw new Error(
      `Insufficient funding for split: need ${newMintingAmount * BigInt(splitCount) + oracleCopies + fee} sats `
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

  return builder;
}

export async function buildMergeTransactionBuilder(
  host: SplitMergeBuilderHost,
  abiFunction: { inputs: readonly { name: string }[]; mergeCountParam?: string },
  maxFeeOverride?: bigint,
): Promise<TransactionBuilder> {
  const sc = host.parentContract!;
  const contract = sc.inner;
  const categoryId = sc.categoryId;
  const config = host.mergeConfig!;

  // Validate count
  const countParamIndex = abiFunction.inputs.findIndex(
    (p) => p.name === abiFunction.mergeCountParam,
  );
  const mergeCount = Number(host.functionArgs![countParamIndex]);
  if (config.consumedMasters.length !== mergeCount) {
    throw new Error(
      `Merge count is ${mergeCount} but ${config.consumedMasters.length} consumed UTXOs provided.`,
    );
  }

  // Get surviving master UTXO (exclude consumed UTXOs to prevent self-consuming merge)
  const consumedOutpoints = new Set(config.consumedMasters.map((u) => `${u.txid}:${u.vout}`));
  const tokenUtxos = await contract.provider.getUtxos(contract.tokenAddress);
  const masterUtxo = tokenUtxos.find(
    (u) => u.token?.category === categoryId
      && u.token?.nft?.capability === 'minting'
      && !consumedOutpoints.has(`${u.txid}:${u.vout}`),
  );
  if (!masterUtxo) {
    throw new Error(`Master UTXO not found for contract '${contract.name}' (category ${categoryId}). All minting UTXOs may be in the consumed set.`);
  }

  const { TransactionBuilder: TxBuilder } = await import('../TransactionBuilder.js');
  const builder = new TxBuilder({
    provider: contract.provider,
    allowImplicitNftBurn: true,
    ...(maxFeeOverride != null ? { maximumFeeSatoshis: maxFeeOverride } : {}),
  });

  // Input 0: surviving master UTXO
  builder.addInput(masterUtxo, contract.unlock[host.functionName!]!(...host.functionArgs!));

  // Inputs 1..N: consumed master UTXOs (same function + args)
  for (const consumed of config.consumedMasters) {
    builder.addInput(consumed, contract.unlock[host.functionName!]!(...host.functionArgs!));
  }

  // Inputs N+1+: funding UTXOs
  const fundingUtxos = config.fundingUtxos ?? [];
  for (const fundingUtxo of fundingUtxos) {
    builder.addInput(fundingUtxo, config.fundingUnlocker!);
  }

  // Output 0: surviving master preserved, carrying every consumed master's value and fungible amount
  // (audit MERGE-1: the covenant requires the survivor to hold the summed totals).
  const consumedSatoshis = config.consumedMasters.reduce((sum, u) => sum + u.satoshis, 0n);
  const consumedFt = config.consumedMasters.reduce((sum, u) => sum + (u.token?.amount ?? 0n), 0n);
  builder.addOutput({
    to: contract.tokenAddress,
    amount: masterUtxo.satoshis + consumedSatoshis,
    token: {
      category: categoryId,
      amount: (masterUtxo.token?.amount ?? 0n) + consumedFt,
      nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
    },
  });

  // Compute fee from actual transaction size (1 sat/byte minimum relay fee).
  // Add a placeholder change output before estimating so the fee accounts for it.
  builder.addOutput({ to: config.changeAddress, amount: 1000n }); // placeholder
  const fee = config.fee ?? await host.computeFeeFromBuilder(builder);

  // Change output (funding minus fee; the consumed masters settle into the survivor)
  const fundingSatoshis = fundingUtxos.reduce((sum, u) => sum + u.satoshis, 0n);
  const changeAmount = fundingSatoshis - fee;
  if (changeAmount < 0n) {
    builder.outputs.pop(); // remove placeholder
    throw new Error(
      `Insufficient funding for merge: need ${fee} sats for fee `
      + `but only have ${fundingSatoshis} sats from funding UTXOs.`,
    );
  }
  if (changeAmount > 0n) {
    builder.outputs[builder.outputs.length - 1] = {
      ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
    };
  } else {
    builder.outputs.pop(); // remove placeholder - no change needed
  }

  return builder;
}
