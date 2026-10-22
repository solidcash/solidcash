/**
 * phase-boundary extract: SC lifecycle extract — static upgrade API.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  VALUE_INLINE_LIMIT,
  buildPushdataCommitment,
  containerMasterRetires,
  parsePushdataCommitment,
  hasDataNftIndexTags,
  type AbiFunction,
  type Artifact,
  type StateValue,
} from '@solidcash/utils';
import { Contract } from '../Contract.js';
import { ownCoinRefusal } from '../framed/deploy/own-coin.js';
import { Network, type TokenDetails, type Unlocker, type Utxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript, calculateDust } from '../utils.js';
import {
  createDestroyDataNftUnlocker,
  createEntryNftUnlocker,
  createSatoshiContainerUnlocker,
  createTokenContainerUnlocker,
  getDataNftAddress,
  getDynamicChunkAddress,
  getEntryNftAddress,
  getSatoshiContainerAddress,
  getTokenContainerAddress,
  getValueChunkAddress,
  isSatoshiContainerCoin,
  isTokenContainerCoin,
} from './covenant-helpers.js';
import { tokenContainerKeyValue } from './sc-load-create-builder-token-containers.js';
import { decodeEntryCommitment } from './SortedList.js';
import type { LeftBehindCoin, UpgradeOptions, UpgradeResult } from './stateful-lifecycle-types.js';

const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]); // push 1-byte redeem script

/** The caller's coin. Each migration step returns its change to the funder's own lock for the next step. */
interface FundingCoin { readonly utxo: Utxo; readonly unlocker: Unlocker }

/** A lock-bound record the upgrade carries, keyed by its collection signature or its foreign category. */
interface PlannedRecord { readonly key: string; readonly utxo: Utxo }

type Provider = UpgradeOptions['provider'];

async function computeFeeFromBuilder(builder: TransactionBuilder): Promise<bigint> {
  const { encodeTransaction } = await import('@bitauth/libauth/build/lib/message/transaction-encoding.js');

  const tx = builder.buildLibauthTransaction();
  return BigInt(encodeTransaction(tx).byteLength);
}

const outpointOf = (utxo: Utxo): string => `${utxo.txid}:${utxo.vout}`;

const describeCoin = (utxo: Utxo): string => `${outpointOf(utxo)} (${utxo.satoshis} sat`
  + `${utxo.token ? `, ${utxo.token.amount} of ${utxo.token.category}${utxo.token.nft ? ' and an NFT' : ''}` : ''})`;

const mintingToken = (master: Utxo, categoryId: string): TokenDetails => ({
  category: categoryId,
  amount: master.token?.amount ?? 0n,
  nft: { capability: 'minting', commitment: master.token?.nft?.commitment ?? '' },
});

/** A record the covenants keep: a mutable NFT of C. Anything else at a record address is junk. */
const isRecord = (utxo: Utxo, categoryId: string): boolean => (
  utxo.token?.category.toLowerCase() === categoryId.toLowerCase() && utxo.token.nft?.capability === 'mutable'
);

/** Every entry of every collection. The entry covenant admits only a mutable NFT of C; anything else there is junk. */
async function listEntries(provider: Provider, contract: Contract<any, any>, categoryId: string): Promise<PlannedRecord[]> {
  const entries: PlannedRecord[] = [];
  for (const collection of contract.artifact.stateLayout?.collections ?? []) {
    const address = getEntryNftAddress(contract, categoryId, collection.signature);
    for (const utxo of await provider.getUtxos(address)) {
      if (isRecord(utxo, categoryId)) entries.push({ key: collection.signature, utxo });
    }
  }
  return entries;
}

/**
 * Dynamic values and mapping values past the inline limit keep their bytes in chunk NFTs bound to the master's lock,
 * and no migration path carries them, so a live chunk at an address the replacement does not share refuses.
 */
async function refuseStrandedChunks(
  provider: Provider, oldContract: Contract<any, any>, newContract: Contract<any, any>, categoryId: string,
  entries: readonly PlannedRecord[],
): Promise<void> {
  const stranded = new Map<string, number>();
  const count = async (oldAddress: string, newAddress: string, what: string): Promise<void> => {
    if (oldAddress === newAddress) return;
    const live = (await provider.getUtxos(oldAddress)).filter((utxo) => isRecord(utxo, categoryId)).length;
    if (live > 0) stranded.set(what, (stranded.get(what) ?? 0) + live);
  };
  const layout = oldContract.artifact.stateLayout;
  for (const variable of layout?.variables ?? []) {
    if (variable.dynamic !== true) continue;
    await count(
      getDynamicChunkAddress(oldContract, categoryId, variable.name, variable.type),
      getDynamicChunkAddress(newContract, categoryId, variable.name, variable.type),
      `chunk(s) of '${variable.name}'`,
    );
  }
  for (const collection of layout?.collections ?? []) {
    if (collection.chunkableValue !== true) continue;
    for (const entry of entries) {
      if (entry.key !== collection.signature) continue;
      // The value tail is len4 ++ the value, or len4 ++ root ++ head once it outgrows the inline limit.
      const { slot, value } = decodeEntryCommitment(hexToBin(entry.utxo.token?.nft?.commitment ?? ''));
      if (value.length < 36 || new DataView(value.buffer, value.byteOffset).getUint32(0, true) <= VALUE_INLINE_LIMIT) {
        continue;
      }
      const root = value.slice(4, 36);
      await count(
        getValueChunkAddress(oldContract, categoryId, collection.name, slot, root),
        getValueChunkAddress(newContract, categoryId, collection.name, slot, root),
        `value chunk(s) of '${collection.name}'`,
      );
    }
  }
  if (stranded.size > 0) {
    throw new Error(
      `Upgrade would strand ${[...stranded].map(([what, live]) => `${live} ${what}`).join(', ')} at the old lock: `
      + 'chunks are bound to the master\'s lock and no migration carries them. Clear each dynamic value, and cut '
      + `each mapping value to ${VALUE_INLINE_LIMIT} bytes or delete it, through the old contract before upgrading.`,
    );
  }
}

/** The coins of a container listing `leaveBehind` does not name; each named one is recorded with its value. */
function keptCoins(
  address: string, coins: readonly Utxo[], abandoned: ReadonlySet<string>, leftBehind: LeftBehindCoin[],
): Utxo[] {
  return coins.filter((utxo) => {
    if (!abandoned.has(outpointOf(utxo).toLowerCase())) return true;
    leftBehind.push({
      outpoint: outpointOf(utxo), address, satoshis: utxo.satoshis, ...(utxo.token !== undefined && { token: utxo.token }),
    });
    return false;
  });
}

/**
 * Every live token container, which must fill the covenant's reserved slots exactly. The covenant derives each old
 * container covenant from the coin's own category, so only a coin of its address's category is a container; a
 * tokenless or foreign-category coin there is junk it cannot carry, and stays where it is. Anyone can send a coin of
 * that category there, so the caller may abandon surplus ones with `leaveBehind`.
 */
async function planTokenContainers(
  provider: Provider, contract: Contract<any, any>, categoryId: string, foreign: readonly string[],
  state: Readonly<Record<string, unknown>>, abandoned: ReadonlySet<string>, leftBehind: LeftBehindCoin[],
): Promise<PlannedRecord[]> {
  const abi: readonly AbiFunction[] = contract.artifact.abi;
  const slots = abi.flatMap((fn) => fn.blockLayout?.slots ?? []).filter((slot) => slot.kind === 'tokenContainer').length;
  const categories = new Set(foreign.map((category) => category.toLowerCase()));
  // A container keyed by the contract's own category or an immutable is found without the caller naming it.
  for (const access of abi.flatMap((fn) => fn.tokenContainerAccesses ?? [])) {
    if (access.keySource !== 'own' && access.keySource !== 'state') continue;
    const key = tokenContainerKeyValue(access, categoryId, [], -1, state);
    categories.add((key instanceof Uint8Array ? binToHex(key) : String(key)).toLowerCase());
  }
  const containers: PlannedRecord[] = [];
  let abandonedCount = 0;
  for (const category of categories) {
    const address = getTokenContainerAddress(contract, categoryId, category);
    const live = (await provider.getUtxos(address)).filter((utxo) => isTokenContainerCoin(utxo, category));
    const kept = keptCoins(address, live, abandoned, leftBehind);
    abandonedCount += live.length - kept.length;
    containers.push(...kept.map((utxo) => ({ key: category, utxo })));
  }
  if (containers.length > slots) {
    throw new Error(
      `Upgrade would strand ${containers.length - slots} of ${containers.length} live token container(s) `
      + `(${containers.map((container) => describeCoin(container.utxo)).join(', ')}): the old covenant migrates `
      + `exactly ${slots}. Spend the extra containers through the old contract, or name the ones to abandon for good `
      + 'in leaveBehind, before upgrading.',
    );
  }
  if (containers.length < slots) {
    throw new Error(
      `Upgrade migrates exactly ${slots} token container(s), but ${containers.length} live container(s) were found `
      + `for [${[...categories].join(', ')}]${abandonedCount > 0 ? ` once leaveBehind abandons ${abandonedCount}` : ''}. `
      + 'Pass every foreign category the contract holds in tokenContainerCategoryIds, and leave behind only surplus '
      + 'containers.',
    );
  }
  return containers;
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
  const onChainState = await oldContract.getFullState();
  const masterUtxo = onChainState.masterUtxo;
  if (!masterUtxo) {
    throw new Error(
      `Master UTXO not found for contract '${oldContract.name}' `
      + `(category ${categoryId}). Ensure the contract is deployed and the master UTXO exists.`,
    );
  }

  // Create the new contract instance self-pinned to the same categoryId
  const newContract = new Contract(newArtifact, newConstructorArgs as any, {
    provider,
    addressType,
    category: hexToBin(categoryId),
  });

  // CRYPTO-4 binds every record to the master's exact lock, so whatever stays at the old lock once the upgrade moves
  // the master is unspendable for good. Plan the whole migration from complete listings, and refuse before anything
  // is broadcast when a genuine record would be left behind.
  const entries = await listEntries(provider, oldContract.inner, categoryId);
  await refuseStrandedChunks(provider, oldContract.inner, newContract, categoryId, entries);

  // Anyone can send a coin to a container address, and the old code could spend it as its container, so a surplus
  // coin blocks the upgrade unless the caller abandons it by outpoint; each abandoned coin is reported with its value.
  const abandoned = new Set((options.leaveBehind ?? []).map((outpoint) => outpoint.toLowerCase()));
  const leftBehind: LeftBehindCoin[] = [];

  // CRYPTO-4 satoshi-container migration: the container (bound to the old master lock) is spent with its flag=1
  // master path, drained at its input index, and re-minted at the replacement-bound covenant. Every tokenless coin
  // there is treasury the old code can spend, and the covenant migrates exactly one (its merge path admits a single
  // container input, so the coins cannot be consolidated).
  const keepsSatoshiContainer = oldAbi.some((fn) =>
    fn.blockLayout?.slots.some((slot) => slot.kind === 'satoshiContainer'));
  let satoshiContainerUtxo: Utxo | undefined;
  if (keepsSatoshiContainer) {
    const satoshiAddress = getSatoshiContainerAddress(oldContract.inner, categoryId);
    const listed = (await provider.getUtxos(satoshiAddress)).filter(isSatoshiContainerCoin);
    const live = keptCoins(satoshiAddress, listed, abandoned, leftBehind);
    if (live.length === 0) {
      throw new Error(listed.length > 0
        ? `leaveBehind abandons every satoshi-container UTXO at ${satoshiAddress}; the old covenant migrates exactly one.`
        : `Upgrade migrates the satoshi container, but none exists at ${satoshiAddress}. `
          + 'Fund the satoshi container (or drain it) before upgrading.');
    }
    if (live.length > 1) {
      throw new Error(
        `Upgrade would strand ${live.length - 1} of ${live.length} satoshi-container UTXOs at ${satoshiAddress} `
        + `(${live.map(describeCoin).join(', ')}): the old covenant migrates exactly one. Spend the others through `
        + 'the old contract, or name the ones to abandon for good in leaveBehind, before upgrading.',
      );
    }
    satoshiContainerUtxo = live[0];
  }

  // CRYPTO-4 token-container migration: the old containers are spent with their flag=1 master path, drained at
  // their input indices, and re-minted at the replacement-bound covenant carrying each foreign category, amount and
  // value. The compiler reserves one slot per token-container access site, and the live containers must fill them.
  const tokenContainers = await planTokenContainers(
    provider, oldContract.inner, categoryId, options.tokenContainerCategoryIds ?? [], onChainState.state,
    abandoned, leftBehind,
  );
  const unknown = [...abandoned].filter((outpoint) => !leftBehind.some((coin) => coin.outpoint.toLowerCase() === outpoint));
  if (unknown.length > 0) {
    throw new Error(
      `leaveBehind names ${unknown.join(', ')}: only a surplus satoshi- or token-container coin of `
      + `'${oldContract.name}' can be left behind.`,
    );
  }

  const filteredDataNftUtxos = requiredNftIndices.map((idx) => onChainState.dataNftUtxos[idx]);
  if (filteredDataNftUtxos.some((u) => u === undefined)) {
    throw new Error(`Missing required data NFTs on-chain. Expected indices: [${requiredNftIndices.join(', ')}], but only ${onChainState.dataNftUtxos.length} data NFTs found.`);
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

  // Build the upgrade function args (synthetic params appended): _msgSenderCategory when the function uses
  // msg.sender (zero bytes = direct call), then the authenticated replacement lock.
  const finalArgs = [
    ...upgradeFunctionArgs,
    ...(upgradeAbi.usesMsgSender ? [new Uint8Array(32)] : []),
    addressToLockScript(newContract.tokenAddress),
  ];

  // The old data NFTs are destroyed (flag=2) and re-minted at the replacement's lock with their values carried
  // into the new state layout: parse the old commitment with the old layout, then rebuild with the new layout so
  // new fields are initialised with default values. Additional data NFTs the longer layout needs are minted from
  // the caller-provided funding UTXO.
  const oldLayout = oldContract.inner.stateLayout!;
  const newLayout = newArtifact.stateLayout!;
  const dataNftAmount = 1200n;
  const newNftCount = newLayout.dataNftCount - oldLayout.dataNftCount;
  const totalNewNftCost = dataNftAmount * BigInt(Math.max(newNftCount, 0));
  if (newNftCount > 0 && (!options.fundingUtxo || !options.funder)) {
    throw new Error(
      `Upgrade extends state from ${oldLayout.dataNftCount} to ${newLayout.dataNftCount} data NFTs. `
      + 'Provide fundingUtxo and funder to cover the additional data NFT costs.',
    );
  }

  // Each entry migration is its own transaction, and a synthetic fee coin exists only on the mock, so the migration
  // pays from the caller's coin and chains its change. Outside the mock the upgrade itself needs that coin too.
  const funding: FundingCoin | undefined = options.fundingUtxo && options.funder
    ? { utxo: options.fundingUtxo, unlocker: options.funder } : undefined;
  if (funding === undefined && (entries.length > 0 || provider.network !== Network.MOCKNET)) {
    throw new Error(
      entries.length > 0
        ? `Upgrade migrates ${entries.length} mapping/array entr${entries.length === 1 ? 'y' : 'ies'}, one `
          + 'transaction each; pass fundingUtxo and funder to pay for them.'
        : `Upgrade needs a fee input on ${provider.network}; pass fundingUtxo and funder.`,
    );
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

  const { TransactionBuilder: Builder } = await import('../TransactionBuilder.js');

  // The upgrade transaction for a given master and funding coin. `cost` is what the coin pays: fee plus added NFTs.
  const buildUpgrade = async (master: Utxo, paidBy: FundingCoin | undefined): Promise<{
    builder: TransactionBuilder; cost: bigint;
  }> => {
    const builder = new Builder({
      provider,
      ...(options.maxFee !== undefined && { maximumFeeSatoshis: options.maxFee }),
    });

    // Input 0: old master UTXO (unlocked via upgrade function)
    builder.addInput(master, (oldContract.inner.unlock as any)[upgradeFunctionName](...finalArgs));

    // Inputs 1..N: data NFTs. CRYPTO-4 data-NFT migration: spend each with flag=2 (destroy, which still binds the
    // old master lock while the old master is an input), then re-mint a copy at the replacement-bound covenant.
    for (const nftUtxo of filteredDataNftUtxos) {
      builder.addInput(nftUtxo, createDestroyDataNftUnlocker(oldContract.inner, 0, categoryId));
    }

    // Input 1+N: the old satoshi container, spent by the old master still at the old lock.
    if (satoshiContainerUtxo) {
      builder.addInput(satoshiContainerUtxo, createSatoshiContainerUnlocker(oldContract.inner, 0, categoryId));
    }
    for (const container of tokenContainers) {
      builder.addInput(
        container.utxo, createTokenContainerUnlocker(oldContract.inner, 0, categoryId, container.key),
      );
    }

    // Funding input covers the fee (and new NFTs in the overflow case). Without one, the mock gets a dummy OP_TRUE
    // funder; every other network was refused above.
    if (paidBy) {
      builder.addInput(paidBy.utxo, paidBy.unlocker);
    } else {
      const dummy: Utxo = {
        txid: '00'.repeat(31) + 'fe', vout: 0, satoshis: 5000n,
      };
      await (provider as any).addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), dummy);
      builder.addInput(dummy, {
        generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
        generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
      });
    }

    // Output 0: minting NFT at NEW contract's tokenAddress (bytecode changes!)
    builder.addOutput({
      to: newContract.tokenAddress,
      amount: master.satoshis,
      token: {
        category: categoryId,
        amount: master.token?.amount ?? 0n,
        nft: { capability: 'minting', commitment: master.token?.nft?.commitment ?? '' },
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
    // carries the container's value at the replacement-bound covenant. The token container's master path requires
    // the same zero-value/zero-token drain at its input index (one output later when the satoshi container is
    // present).
    if (satoshiContainerUtxo) {
      builder.addOutput({ to: Uint8Array.of(0x6a), amount: 0n });
    }
    for (let containerIndex = 0; containerIndex < tokenContainers.length; containerIndex++) {
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

    // Re-mint each token container at the replacement-bound covenant, carrying its foreign token and value.
    for (const container of tokenContainers) {
      builder.addOutput({
        to: getTokenContainerAddress(newContract, categoryId, container.key),
        amount: container.utxo.satoshis,
        token: container.utxo.token,
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

    // Compute fee and change output from the funding input. Add a placeholder change output before fee estimation so
    // the size accounts for the change output that will be included in the final transaction.
    const fundingSatoshis = paidBy?.utxo.satoshis ?? 5000n; // 5000 for dummy funder
    // Default leftover funding satoshis to the funder's own lock (the H4 rule), never the new contract's covenant
    // address: the funder may not control that covenant, and the surplus belongs to whoever funded it.
    const changeAddr = options.changeAddress ?? options.funder?.generateLockingBytecode() ?? newContract.address;
    builder.addOutput({ to: changeAddr, amount: 1000n }); // placeholder for fee estimation
    const cost = totalNewNftCost + (options.fee ?? await computeFeeFromBuilder(builder));
    const changeAmount = fundingSatoshis - cost;
    if (changeAmount > 0n) {
      builder.outputs[builder.outputs.length - 1] = {
        ...builder.outputs[builder.outputs.length - 1], amount: changeAmount,
      };
    } else {
      builder.outputs.pop(); // remove placeholder - no change needed
    }
    return { builder, cost };
  };

  // CRYPTO-4 entry batched migration: move every listed entry to the replacement-bound entry covenant, one entry per
  // transaction, behind the migrateRecords entry's authorization, before the upgrade moves the master. The
  // replacement-bound covenant only becomes spendable once the upgrade runs, so the order matters.
  let master: Utxo = masterUtxo;
  let coin = funding;
  if (entries.length > 0) {
    const migrateAbi = oldAbi.find((f) => (
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
    const funderLock = funding!.unlocker.generateLockingBytecode();
    // [master, entry, coin] -> [master at the old lock, entry at the replacement-bound covenant, change to the funder].
    const buildEntryMigration = async (entry: PlannedRecord, from: Utxo, paidBy: FundingCoin): Promise<{
      builder: TransactionBuilder; change: bigint;
    }> => {
      const builder = new Builder({ provider });
      builder.addInput(from, (oldContract.inner.unlock as any)[migrateAbi.name](...migrateArgs));
      builder.addInput(entry.utxo, createEntryNftUnlocker(oldContract.inner, 0, categoryId, entry.key));
      builder.addInput(paidBy.utxo, paidBy.unlocker);
      builder.addOutput({
        to: oldContract.inner.tokenAddress, amount: from.satoshis, token: mintingToken(from, categoryId),
      });
      builder.addOutput({
        to: getEntryNftAddress(newContract, categoryId, entry.key), amount: entry.utxo.satoshis, token: entry.utxo.token,
      });
      builder.addOutput({ to: funderLock, amount: 1000n }); // placeholder, set below
      const change = paidBy.utxo.satoshis - await computeFeeFromBuilder(builder);
      builder.outputs[2] = { ...builder.outputs[2], amount: change };
      return { builder, change };
    };

    // Price every step before any is broadcast: the coin pays each entry's fee in turn, then the upgrade, and each
    // step's change must stay above dust to fund the next.
    let entryFees = 0n;
    for (const entry of entries) {
      entryFees += funding!.utxo.satoshis - (await buildEntryMigration(entry, master, funding!)).change;
    }
    const required = entryFees + (await buildUpgrade(master, funding)).cost
      + BigInt(calculateDust({ to: funderLock, amount: 0n }));
    if (funding!.utxo.satoshis < required) {
      throw new Error(
        `Upgrade funding of ${funding!.utxo.satoshis} satoshis cannot pay for ${entries.length} entry migration(s) `
        + `and the upgrade; it needs at least ${required}.`,
      );
    }

    const migrated = new Set<string>();
    for (const entry of entries) {
      const { builder, change } = await buildEntryMigration(entry, master, coin!);
      const tx = await builder.send();
      migrated.add(outpointOf(entry.utxo));
      // The master is re-created at the old lock (out 0) and the change at the funder's (out 2): the next step spends
      // both.
      master = { txid: tx.txid, vout: 0, satoshis: master.satoshis, token: mintingToken(master, categoryId) };
      coin = { utxo: { txid: tx.txid, vout: 2, satoshis: change }, unlocker: coin!.unlocker };
    }

    // Completeness: the master moves only when no entry is left at the old covenant.
    const left = (await listEntries(provider, oldContract.inner, categoryId))
      .filter((entry) => !migrated.has(outpointOf(entry.utxo)));
    if (left.length > 0) {
      throw new Error(
        `${left.length} entr${left.length === 1 ? 'y' : 'ies'} reached the old entry covenant during the migration; `
        + 'run the upgrade again to migrate them before the master moves.',
      );
    }
  }

  const tx = await (await buildUpgrade(master, coin)).builder.send();

  // Connect the new contract with the same categoryId
  const { StatefulContract: SC } = await import('./StatefulContract.js');
  const statefulContract = SC.withCategory(newContract, categoryId);

  return { contract: statefulContract, tx, categoryId, leftBehind };
}
