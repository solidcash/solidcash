/**
 * phase-boundary extract: SC lifecycle extract — static upgrade API.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  buildPushdataCommitment,
  containerMasterRetires,
  parsePushdataCommitment,
  hasDataNftIndexTags,
  type Artifact,
  type StateValue,
} from '@solidcash/utils';
import { Contract } from '../Contract.js';
import { ownCoinRefusal } from '../framed/deploy/own-coin.js';
import type { Utxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import {
  createDestroyDataNftUnlocker,
  createEntryNftUnlocker,
  createSatoshiContainerUnlocker,
  createTokenContainerUnlocker,
  getDataNftAddress,
  getEntryNftAddress,
  getSatoshiContainerAddress,
  getTokenContainerAddress,
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

  // The old covenant re-mints each container in its own form, so a replacement whose containers take the other form
  // (the destroy arm, `containerMasterRetires`) would hold them at a lock its code never derives.
  const oldAbi = oldContract.inner.artifact.abi;
  const migratesContainers = oldAbi.some((fn) => fn.blockLayout?.slots
    .some((slot) => slot.kind === 'satoshiContainer' || slot.kind === 'tokenContainer'));
  if (migratesContainers && containerMasterRetires(oldAbi) !== containerMasterRetires(newArtifact.abi)) {
    throw new Error(
      `Upgrade cannot migrate the containers of '${oldContract.name}' to '${newArtifact.contractName}': exactly one `
      + 'of them retires its master (a selfdestruct entry), so their container covenants differ.',
    );
  }

  const previousLayout = oldContract.inner.artifact.stateLayout;
  const requiredNftIndices = upgradeAbi.requiredNftIndices
    ?? Array.from({ length: oldContract.inner.stateLayout!.dataNftCount }, (_, i) => i);
  // This API explicitly decodes and rebuilds commitments. A changed tag format must rebuild every old record;
  // otherwise an unspent record would retain bytes the replacement cannot decode.
  if (previousLayout && hasDataNftIndexTags(previousLayout) !== hasDataNftIndexTags(newArtifact.stateLayout)) {
    const rebuilt = new Set(requiredNftIndices);
    if (Array.from({ length: previousLayout.dataNftCount }, (_, index) => index)
      .some((index) => !rebuilt.has(index))) {
      throw new Error(
        'Upgrade layout incompatibility: changing data NFT index-tag encoding requires re-encoding '
        + 'every existing data NFT; the upgrade function omits a record.',
      );
    }
  }

  const categoryId = oldContract.categoryId;
  const addressType = options.addressType ?? oldContract.inner.addressType;

  // The funding coin is proven at the funder's own lock before anything is sent or signed, as a deployment's is, so a
  // BCMR identity output (docs/bcmr/DESIGN.md 4.4) is refused.
  if (options.fundingUtxo && options.funder) {
    const coinRefusal = await ownCoinRefusal(
      provider, options.fundingUtxo, options.funder.generateLockingBytecode(), { role: 'funder' },
    );
    if (coinRefusal !== undefined) throw new Error(coinRefusal);
  }

  // Get on-chain state to find the master UTXO
  let onChainState = await oldContract.getFullState();
  if (!onChainState.masterUtxo) {
    throw new Error(
      `Master UTXO not found for contract '${oldContract.name}' `
      + `(category ${categoryId}). Ensure the contract is deployed and the master UTXO exists.`,
    );
  }

  let masterUtxo = onChainState.masterUtxo;

  // Create the new contract instance self-pinned to the same categoryId
  const newContract = new Contract(newArtifact, newConstructorArgs as any, {
    provider,
    addressType,
    category: hexToBin(categoryId),
  });

  // CRYPTO-4 entry batched migration: drain every collection's entries at the replacement-bound entry covenant,
  // one entry per transaction, behind the migrateRecords entry's authorization, before the upgrade moves the
  // master. The replacement-bound covenant only becomes spendable once the upgrade runs, so the order matters.
  const collections = oldContract.inner.artifact.stateLayout?.collections ?? [];
  if (collections.length > 0) {
    const migrateAbi = oldContract.inner.artifact.abi.find((f) => (
      f.modifiers?.includes('migrateRecords')
      && (options.migrateRecordsFunctionName === undefined || f.name === options.migrateRecordsFunctionName)
    ));
    if (!migrateAbi) {
      throw new Error(
        'Upgrade migrates mapping/array entries, but the old contract declares no migrateRecords entry. '
        + 'Add a migrateRecords function and pass migrateRecordsFunctionArgs.',
      );
    }
    if (!options.migrateRecordsFunctionArgs) {
      throw new Error(
        'Upgrade migrates mapping/array entries; pass migrateRecordsFunctionArgs (the migrateRecords entry args).',
      );
    }
    const migrateArgs = [...options.migrateRecordsFunctionArgs, addressToLockScript(newContract.tokenAddress)];
    const changeAddr = options.changeAddress
      ?? (options.funder ? options.funder.generateLockingBytecode() : undefined)
      ?? oldContract.inner.address;
    const { TransactionBuilder: RecordTxBuilder } = await import('../TransactionBuilder.js');
    for (const collection of collections) {
      const entryAddress = getEntryNftAddress(oldContract.inner, categoryId, collection.signature);
      for (let guard = 0; guard < 20_000; guard++) {
        const entries = await provider.getUtxos(entryAddress);
        const entry = entries.find((utxo) => utxo.token !== undefined);
        if (!entry) break;
        const state = await oldContract.getFullState();
        const master = state.masterUtxo;
        if (!master) throw new Error('Master UTXO not found during entry migration.');

        const builder = new RecordTxBuilder({ provider });
        builder.addInput(master, (oldContract.inner.unlock as any)[migrateAbi.name](...migrateArgs));
        builder.addInput(entry, createEntryNftUnlocker(oldContract.inner, 0, categoryId, collection.signature));
        // Fee funder (a fresh dummy UTXO each batch on the mock provider).
        const funder: Utxo = {
          txid: (guard + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 10_000n,
        };
        await (provider as any).addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), funder);
        builder.addInput(funder, {
          generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
          generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
        });
        builder.addOutput({
          to: oldContract.inner.tokenAddress,
          amount: master.satoshis,
          token: {
            category: categoryId,
            amount: master.token?.amount ?? 0n,
            nft: { capability: 'minting', commitment: master.token?.nft?.commitment ?? '' },
          },
        });
        builder.addOutput({
          to: getEntryNftAddress(newContract, categoryId, collection.signature),
          amount: entry.satoshis,
          token: entry.token,
        });
        builder.addOutput({ to: changeAddr, amount: 1000n }); // placeholder, adjusted below
        const recordFee = await computeFeeFromBuilder(builder);
        const changeAmount = funder.satoshis - recordFee;
        if (changeAmount > 0n) {
          builder.outputs[builder.outputs.length - 1] = {
            ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
          };
        } else {
          builder.outputs.pop();
        }
        await builder.send();
      }
    }
  }

  // The entry migration re-created the master, so refresh the on-chain state before the upgrade spends it.
  onChainState = await oldContract.getFullState();
  masterUtxo = onChainState.masterUtxo!;

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
  // CRYPTO-4 data-NFT migration: spend each old data NFT with flag=2 (destroy, which still binds the old master
  // lock while the old master is an input), then re-mint a copy at the replacement-bound covenant.
  const dataNftUnlockers = filteredDataNftUtxos.map(
    () => createDestroyDataNftUnlocker(oldContract.inner, 0, categoryId),
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

  // CRYPTO-4 satoshi-container migration: the container (bound to the old master lock) is spent with its flag=1
  // master path, drained at its input index, and re-minted at the replacement-bound covenant. The contract keeps
  // a container when any entry's block layout reserves its slot; the container UTXO must exist to migrate (it
  // always does once the contract has held BCH, since transfers recreate it at the same covenant).
  const keepsSatoshiContainer = oldContract.inner.artifact.abi.some((fn) =>
    fn.blockLayout?.slots.some((slot) => slot.kind === 'satoshiContainer'));
  let satoshiContainerUtxo: Utxo | undefined;
  if (keepsSatoshiContainer) {
    const satoshiAddress = getSatoshiContainerAddress(oldContract.inner, categoryId);
    const containerUtxos = await provider.getUtxos(satoshiAddress);
    satoshiContainerUtxo = containerUtxos.find((utxo) => utxo.token === undefined);
    if (!satoshiContainerUtxo) {
      throw new Error(
        `Upgrade migrates the satoshi container, but none exists at ${satoshiAddress}. `
        + 'Fund the satoshi container (or drain it) before upgrading.',
      );
    }
    // Input 1+N: the old satoshi container, spent by the old master still at the old lock.
    builder.addInput(satoshiContainerUtxo, createSatoshiContainerUnlocker(oldContract.inner, 0, categoryId));
  }

  // CRYPTO-4 token-container migration: every coin at each category's container lock is spent with its flag=1
  // master path, drained at its input index, and re-minted at the replacement-bound covenant carrying its category,
  // amount and value. A reserve can be spread over several coins at one lock, and the compiled upgrade migrates the
  // whole run of token inputs that starts here, so the band holds all of them and the funding input ends it. A
  // container keyed by a state variable (BchNative's) is named by the contract's state; one keyed by an argument
  // only the caller can name.
  const tokenAccesses = oldAbi.flatMap((fn) => fn.tokenContainerAccesses ?? []);
  const keepsTokenContainers = oldAbi.some((fn) => fn.blockLayout?.slots.some((slot) => slot.kind === 'tokenContainer'));
  const tokenContainerUtxos: Array<{ utxo: Utxo; tokenContainerCategoryId: string }> = [];
  if (keepsTokenContainers) {
    const named = (options.tokenContainerCategoryIds ?? []).map((id) => id.toLowerCase());
    if (named.length === 0 && tokenAccesses.some((access) => access.keySource !== 'state' && access.keySource !== 'own')) {
      throw new Error(
        `Upgrade migrates the token containers of '${oldContract.name}', which an argument keys: pass `
        + 'tokenContainerCategoryIds, the categories whose containers move.',
      );
    }
    const stateValues = tokenAccesses.some((access) => access.keySource === 'state')
      ? await oldContract.getState() as Record<string, unknown> : {};
    const keyed = tokenAccesses.flatMap((access) => {
      if (access.keySource === 'own') return [categoryId];
      const value = access.keySource === 'state' && access.keyStateVariable !== undefined
        ? stateValues[access.keyStateVariable] : undefined;
      return value instanceof Uint8Array ? [binToHex(value)] : [];
    });
    for (const tcCatId of [...new Set([...named, ...keyed])]) {
      const tcAddress = getTokenContainerAddress(oldContract.inner, categoryId, tcCatId);
      for (const utxo of (await provider.getUtxos(tcAddress)).filter((coin) => coin.token?.category === tcCatId)) {
        tokenContainerUtxos.push({ utxo, tokenContainerCategoryId: tcCatId });
        builder.addInput(utxo, createTokenContainerUnlocker(oldContract.inner, 0, categoryId, tcCatId));
      }
    }
  }

  // The old data NFTs are destroyed (flag=2) and re-minted at the replacement's lock with their values carried
  // into the new state layout: parse the old commitment with the old layout, then rebuild with the new layout so
  // new fields are initialised with default values. Additional data NFTs the longer layout needs are minted from
  // the caller-provided funding UTXO.
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

  // CRYPTO-4 data-NFT migration layout, matching the compiler's census and re-mint verification. When the
  // satoshi container migrates too, its zero-value drain occupies out[N+1] and its re-mint out[2N+2]:
  //   out[0]         = new master
  //   out[1..N]      = a non-category pad band (the flag=2 destroy covenant requires output[INPUTINDEX] to hold a
  //                    DIFFERENT category, so a re-mint cannot sit at the old input's index)
  //   out[N+1]       = the satoshi container's zero-value drain (when present)
  //   out[N+2..2N+1] = re-minted data NFTs at the replacement-bound covenant, each carrying its old commitment
  //   out[2N+2]      = the satoshi container re-mint at the replacement-bound covenant (when present)
  //   out[2N+3..]    = added data NFTs for the extended layout
  // A zero-value bare OP_RETURN pad needs no funding and is exempt from dust.
  const oldNftCount = filteredDataNftUtxos.length;
  for (let i = 0; i < oldNftCount; i++) {
    builder.addOutput({ to: Uint8Array.of(0x6a), amount: 0n });
  }

  // The satoshi container's flag=1 master path requires output[INPUTINDEX] to be a zero-value drain; its re-mint
  // carries the container's value at the replacement-bound covenant. The token container's master path requires the
  // same zero-value/zero-token drain at its input index (one output later when the satoshi container is present).
  if (satoshiContainerUtxo) {
    builder.addOutput({ to: Uint8Array.of(0x6a), amount: 0n });
  }
  for (let containerIndex = 0; containerIndex < tokenContainerUtxos.length; containerIndex++) {
    builder.addOutput({ to: Uint8Array.of(0x6a), amount: 0n });
  }

  // Re-mint existing data NFTs with their old values carried into the new layout.
  for (let i = 0; i < oldNftCount; i++) {
    const nftUtxo = filteredDataNftUtxos[i];
    const nftIdx = requiredNftIndices[i];

    const newCommitment = buildPushdataCommitment(newLayout, oldState, nftIdx);

    builder.addOutput({
      to: getDataNftAddress(newContract, categoryId),
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

  if (satoshiContainerUtxo) {
    builder.addOutput({
      to: getSatoshiContainerAddress(newContract, categoryId),
      amount: satoshiContainerUtxo.satoshis,
    });
  }

  // Re-mint each token container coin at the replacement-bound covenant, carrying its foreign token and value.
  for (const { utxo, tokenContainerCategoryId } of tokenContainerUtxos) {
    builder.addOutput({
      to: getTokenContainerAddress(newContract, categoryId, tokenContainerCategoryId),
      amount: utxo.satoshis,
      token: utxo.token,
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
