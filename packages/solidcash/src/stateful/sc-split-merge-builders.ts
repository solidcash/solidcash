/**
 * phase-boundary extract: SC class-body extract — split/merge transaction builder construction.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { Unlocker, Utxo } from '../interfaces.js';
import type { StatefulContract } from './StatefulContract.js';

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

  const { TransactionBuilder: TxBuilder } = await import('../TransactionBuilder.js');
  const builder = new TxBuilder({
    provider: contract.provider,
    ...(maxFeeOverride != null ? { maximumFeeSatoshis: maxFeeOverride } : {}),
  });

  // Input 0: master UTXO (unlocked with split function)
  builder.addInput(masterUtxo, contract.unlock[host.functionName!]!(...host.functionArgs!));

  // Inputs 1+: funding UTXOs
  for (const fundingUtxo of config.utxos) {
    builder.addInput(fundingUtxo, config.unlocker);
  }

  // Output 0: master preserved
  builder.addOutput({
    to: contract.tokenAddress,
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
      to: contract.tokenAddress,
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
  builder.addOutput({ to: config.changeAddress, amount: 1000n }); // placeholder
  const fee = config.fee ?? await host.computeFeeFromBuilder(builder);

  // Change output
  const totalFunding = config.utxos.reduce((sum, u) => sum + u.satoshis, 0n);
  const changeAmount = totalFunding - (newMintingAmount * BigInt(splitCount)) - fee;
  if (changeAmount < 0n) {
    builder.outputs.pop(); // remove placeholder
    throw new Error(
      `Insufficient funding for split: need ${newMintingAmount * BigInt(splitCount) + fee} sats `
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
