/**
 * phase-boundary extract: SC lifecycle extract — static upgrade API.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  buildPushdataCommitment,
  parsePushdataCommitment,
  type Artifact,
  type StateValue,
} from '@solidcash/utils';
import { Contract } from '../Contract.js';
import type { Utxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import {
  createDataNftUnlocker,
  getDataNftAddress,
} from './covenant-helpers.js';
import type { UpgradeOptions, UpgradeResult } from './stateful-lifecycle-types.js';

const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]); // push 1-byte redeem script

async function computeFeeFromBuilder(builder: TransactionBuilder): Promise<bigint> {
  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  const tx = builder.buildLibauthTransaction();
  return BigInt(encodeTransaction(tx).byteLength);
}

export async function upgradeStatefulContract<T extends Artifact>(
  options: UpgradeOptions<T>,
): Promise<UpgradeResult<T>> {
  const {
    provider, oldContract, upgradeFunctionName, upgradeFunctionArgs,
    newArtifact, newConstructorArgs,
  } = options;

  // Validate the upgrade function exists and has the 'upgrade' modifier
  const upgradeAbi = oldContract.inner.artifact.abi.find(
    (f) => f.name === upgradeFunctionName,
  );
  if (!upgradeAbi) {
    throw new Error(
      `Function '${upgradeFunctionName}' not found in contract '${oldContract.name}'.`,
    );
  }
  if (!upgradeAbi.modifiers?.includes('upgrade')) {
    throw new Error(
      `Function '${upgradeFunctionName}' does not have the 'upgrade' modifier. `
      + 'Only functions with the upgrade modifier can be used for contract upgrades.',
    );
  }

  // Validate new artifact is stateful
  if (!newArtifact.stateLayout) {
    throw new Error(
      `New contract '${newArtifact.contractName}' is not a stateful contract.`,
    );
  }

  // Validate state layout append-only compatibility: existing variables must keep
  // their nftIndex, fieldIndex, and type. New variables can only be appended.
  {
    const prevLayout = oldContract.inner.artifact.stateLayout;
    const nextLayout = newArtifact.stateLayout;
    if (prevLayout) {
      for (const oldVar of prevLayout.variables) {
        const newVar = nextLayout.variables.find((v) => v.name === oldVar.name);
        if (!newVar) {
          throw new Error(
            `Upgrade layout incompatibility: state variable '${oldVar.name}' exists in the old contract `
            + 'but is missing in the new contract. State layouts must be append-only - '
            + 'existing variables cannot be removed.',
          );
        }
        if (newVar.nftIndex !== oldVar.nftIndex || newVar.fieldIndex !== oldVar.fieldIndex) {
          throw new Error(
            `Upgrade layout incompatibility: state variable '${oldVar.name}' changed position `
            + `(old: nft=${oldVar.nftIndex}/field=${oldVar.fieldIndex}, `
            + `new: nft=${newVar.nftIndex}/field=${newVar.fieldIndex}). `
            + 'State layouts must be append-only - existing variables cannot be reordered.',
          );
        }
        if (newVar.type !== oldVar.type) {
          throw new Error(
            `Upgrade layout incompatibility: state variable '${oldVar.name}' changed type `
            + `(old: ${oldVar.type}, new: ${newVar.type}). `
            + 'State variable types cannot change during upgrade.',
          );
        }
      }
    }
  }

  const categoryId = oldContract.categoryId;
  const addressType = options.addressType ?? oldContract.inner.addressType;

  // Get on-chain state to find the master UTXO
  const onChainState = await oldContract.getFullState();
  if (!onChainState.masterUtxo) {
    throw new Error(
      `Master UTXO not found for contract '${oldContract.name}' `
      + `(category ${categoryId}). Ensure the contract is deployed and the master UTXO exists.`,
    );
  }

  const masterUtxo = onChainState.masterUtxo;

  // Create the new contract instance self-pinned to the same categoryId
  const newContract = new Contract(newArtifact, newConstructorArgs as any, {
    provider,
    addressType,
    category: hexToBin(categoryId),
  });

  // Determine which data NFTs the upgrade function needs
  const requiredNftIndices = upgradeAbi.requiredNftIndices
    ?? Array.from({ length: oldContract.inner.stateLayout!.dataNftCount }, (_, i) => i);

  const filteredDataNftUtxos = requiredNftIndices.map((idx) => onChainState.dataNftUtxos[idx]);
  if (filteredDataNftUtxos.some((u) => u === undefined)) {
    throw new Error(`Missing required data NFTs on-chain. Expected indices: [${requiredNftIndices.join(', ')}], but only ${onChainState.dataNftUtxos.length} data NFTs found.`);
  }

  // Build the upgrade function args (may need synthetic params appended)
  let finalArgs = [...upgradeFunctionArgs];

  // Append _msgSenderCategory if function uses msg.sender
  if (upgradeAbi.usesMsgSender) {
    finalArgs = [...finalArgs, new Uint8Array(32)]; // zero bytes = direct call
  }

  const upgradeTargetParam = upgradeAbi.inputs.find(
    (input) => input.name === '__internal__upgradeBytecode',
  );
  if (!upgradeTargetParam) {
    throw new Error(
      `Upgrade function '${upgradeFunctionName}' was compiled without an authenticated replacement-bytecode `
      + 'witness. Recompile the old contract with the current compiler before enabling upgrades.',
    );
  }
  finalArgs = [...finalArgs, addressToLockScript(newContract.tokenAddress)];

  const entryAccesses = upgradeAbi.entryAccesses;
  if (entryAccesses && entryAccesses.length > 0) {
  }


  // Create the unlocker for the old contract's upgrade function
  const stateInputUnlocker = (oldContract.inner.unlock as any)[upgradeFunctionName](...finalArgs);
  const dataNftUnlockers = filteredDataNftUtxos.map(
    () => createDataNftUnlocker(oldContract.inner, 0, categoryId),
  );

  // Build the upgrade transaction
  const { TransactionBuilder } = await import('../TransactionBuilder.js');
  const builder = new TransactionBuilder({
    provider,
    ...(options.maxFee !== undefined && { maximumFeeSatoshis: options.maxFee }),
  });

  // Input 0: old master UTXO (unlocked via upgrade function)
  builder.addInput(masterUtxo, stateInputUnlocker);

  // Inputs 1..N: data NFTs (if the upgrade function accesses state)
  for (let i = 0; i < filteredDataNftUtxos.length; i++) {
    builder.addInput(filteredDataNftUtxos[i], dataNftUnlockers[i]);
  }

  // Outputs 1..N: data NFTs with commitments rebuilt for the new state layout.
  // When the new contract extends state (appends new variables), we parse the
  // old commitment using the old layout, then rebuild using the new layout so
  // that new fields are initialised with default values.
  // When state overflows into additional NFTs, new data NFTs are minted
  // using funds from the caller-provided funding UTXO.
  const oldLayout = oldContract.inner.stateLayout!;
  const newLayout = newArtifact.stateLayout!;
  const dataNftAmount = 1200n;

  // Determine how many additional data NFTs need to be minted
  const newNftCount = newLayout.dataNftCount - oldLayout.dataNftCount;

  if (newNftCount > 0) {
    if (!options.fundingUtxo || !options.funder) {
      throw new Error(
        `Upgrade extends state from ${oldLayout.dataNftCount} to ${newLayout.dataNftCount} data NFTs. `
        + 'Provide fundingUtxo and funder to cover the additional data NFT costs.',
      );
    }
  }

  // Add funding input to cover fees (and new NFTs in overflow case).
  // When no explicit funding UTXO is provided, create a dummy OP_TRUE
  // funder on MockNetworkProvider so the fee can be paid.
  if (options.fundingUtxo && options.funder) {
    builder.addInput(options.fundingUtxo, options.funder);
  } else if ((provider as any).addUtxo) {
    // MockNetworkProvider: create a dummy funder for the fee
    const dummy: Utxo = {
      txid: '00'.repeat(31) + 'fe', vout: 0, satoshis: 5000n,
    };
    await (provider as any).addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), dummy);
    builder.addInput(dummy, {
      generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
      generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
    });
  }

  // Parse all old state values so they can be carried into the new layout
  const oldState: Record<string, StateValue> = {};
  for (let i = 0; i < filteredDataNftUtxos.length; i++) {
    const nftIdx = requiredNftIndices[i];
    const oldCommitment = filteredDataNftUtxos[i].token?.nft?.commitment ?? '';
    if (oldCommitment) {
      const parsed = parsePushdataCommitment(oldCommitment, oldLayout, nftIdx);
      Object.assign(oldState, parsed);
    }
  }

  // Output 0: minting NFT at NEW contract's tokenAddress (bytecode changes!)
  // Master UTXO satoshis will be reduced by the fee (computed below) when no
  // separate funding UTXO covers it.
  builder.addOutput({
    to: newContract.tokenAddress,
    amount: masterUtxo.satoshis, // placeholder; adjusted after fee computation
    token: {
      category: categoryId,
      amount: masterUtxo.token?.amount ?? 0n,
      nft: { capability: 'minting', commitment: masterUtxo.token?.nft?.commitment ?? '' },
    },
  });

  // Rebuild existing data NFT outputs with new-layout commitments
  for (let i = 0; i < filteredDataNftUtxos.length; i++) {
    const nftUtxo = filteredDataNftUtxos[i];
    const nftIdx = requiredNftIndices[i];

    const newCommitment = buildPushdataCommitment(newLayout, oldState, nftIdx);

    builder.addOutput({
      to: dataNftUnlockers[i].generateLockingBytecode(),
      amount: nftUtxo.satoshis,
      token: {
        category: categoryId,
        amount: nftUtxo.token?.amount ?? 0n,
        nft: {
          capability: nftUtxo.token?.nft?.capability ?? 'mutable',
          commitment: newCommitment,
        },
      },
    });
  }

  // Mint additional data NFTs for new nftIndices that overflow into new UTXOs
  if (newNftCount > 0) {
    const dataNftAddress = getDataNftAddress(newContract, categoryId);
    for (let nftIdx = oldLayout.dataNftCount; nftIdx < newLayout.dataNftCount; nftIdx++) {
      const newCommitment = buildPushdataCommitment(newLayout, oldState, nftIdx);
      builder.addOutput({
        to: dataNftAddress,
        amount: dataNftAmount,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: newCommitment },
        },
      });
    }
  }

  // Compute fee and change output from the funding input.
  // The funding input covers the fee (and any new NFT costs in overflow case).
  // Add a placeholder change output before fee estimation so the size accounts
  // for the change output that will be included in the final transaction.
  const fundingSatoshis = options.fundingUtxo?.satoshis ?? 5000n; // 5000 for dummy funder
  const totalNewNftCost = dataNftAmount * BigInt(Math.max(newNftCount, 0));
  // Default leftover funding satoshis to the funder's own lock (the H4 rule), never the new contract's covenant
  // address: the funder may not control that covenant, and the surplus belongs to whoever funded it.
  const changeAddr = options.changeAddress ?? options.funder?.generateLockingBytecode() ?? newContract.address;
  builder.addOutput({ to: changeAddr, amount: 1000n }); // placeholder for fee estimation
  const actualUpgradeFee = options.fee ?? await computeFeeFromBuilder(builder);
  const changeAmount = fundingSatoshis - totalNewNftCost - actualUpgradeFee;
  if (changeAmount > 0n) {
    builder.outputs[builder.outputs.length - 1] = {
      ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
    };
  } else {
    builder.outputs.pop(); // remove placeholder - no change needed
  }

  const tx = await builder.send();

  // Connect the new contract with the same categoryId
  const { StatefulContract: SC } = await import('./StatefulContract.js');
  const statefulContract = SC.withCategory(newContract, categoryId);

  return { contract: statefulContract, tx, categoryId };
}
