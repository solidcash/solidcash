import {
  type Artifact, buildPushdataCommitment, type StateVariableInfo,
} from '@solidcash/utils';
import type { Contract } from '../Contract.js';
import type { Utxo } from '../interfaces.js';
import { readFramedState, type FramedState } from '../framed/deploy/records.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { simulatorPoolFields } from './pool/genesis.js';

/**
 * Mock-chain upkeep of `__block_*` state registers. The compiler emits none: a block.* read slices a coin of an oracle
 * pool. Only artifacts compiled before the oracle covenant carry them, and the mock writes its tip into their
 * records when it mines, as their keeper did.
 */

/** Block-info registers the mock tip refreshes. */
const MOCK_ORACLE_REGISTERS = [
  '__block_number',
  '__block_timestamp',
  '__block_difficulty',
  '__block_size',
  '__block_totalFees',
  '__block_coinbase',
] as const;

type MockUtxoStorage = {
  getUtxoByOutpoint: (key: string) => {
    outpoint: { txid: string; vout: number };
    satoshis: bigint;
    scriptHash: string;
    height: number;
    lockingBytecode: Uint8Array;
    isCoinbase?: boolean;
    tokenData?: {
      category: string;
      amount: bigint;
      nft?: { commitment: string; capability: 'none' | 'mutable' | 'minting' };
    };
  } | undefined;
  _test?: {
    utxo: {
      add: (params: {
        txid: string; vout: number; satoshis: bigint; scriptHash: string; height: number;
        lockingBytecode?: Uint8Array; isCoinbase?: boolean;
        tokenData?: {
          category: string; amount: bigint;
          nft?: { commitment: string; capability: 'none' | 'mutable' | 'minting' };
        };
      }) => void;
      remove: (params: { txid: string; vout: number }) => void;
    };
  };
};

type OracleTarget = {
  categoryId: string;
  layout: NonNullable<Artifact['stateLayout']>;
  /** The direct convention's handle; a framed target has none, its records are found by category. */
  contract?: Contract;
};

function oracleTargetsFromDeployment(deployment: { contract: unknown }): OracleTarget[] {
  const found: OracleTarget[] = [];
  const seen = new Set<string>();
  const addTarget = (categoryId: string | undefined, layout: Artifact['stateLayout'], contract?: Contract): void => {
    if (!categoryId || !layout) return;
    if (!layout.variables.some((variable) => (
      (MOCK_ORACLE_REGISTERS as readonly string[]).includes(variable.name)
    ))) return;
    const key = `${categoryId}:${layout.variables.map((variable) => variable.name).join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ categoryId, layout, ...(contract === undefined ? {} : { contract }) });
  };
  // A direct target is read through its handle.
  const push = (
    contract: Contract | undefined, categoryId: string | undefined, layout: Artifact['stateLayout'],
  ): void => {
    if (contract) addTarget(categoryId, layout, contract);
  };
  const wrapped = deployment.contract as {
    inner?: Contract;
    categoryId?: string;
    implementation?: { inner?: Contract; categoryId?: string };
    proxy?: { inner?: Contract; categoryId?: string };
    framedProxy?: unknown;
  };
  // Per-call: a proxy registers the implementation's artifact beside the proxy's category, whose records hold the
  // application state (the registers included) under the implementation's layout; a plain deployment registers its
  // stateful handle.
  const innerArtifact = wrapped.inner?.artifact;
  if (innerArtifact?.composition?.convention === 'framed') {
    const categoryId = wrapped.framedProxy === undefined ? wrapped.categoryId : wrapped.proxy?.categoryId;
    addTarget(categoryId, innerArtifact.stateLayout);
    return found;
  }
  const implArtifact = wrapped.implementation?.inner?.artifact;
  // A proxy's application state, the registers included, lives on the proxy category under the implementation layout.
  if (implArtifact?.usesBlockOracle === true) {
    push(wrapped.proxy?.inner, wrapped.proxy?.categoryId, implArtifact.stateLayout);
    push(wrapped.implementation?.inner, wrapped.implementation?.categoryId, implArtifact.stateLayout);
  }
  push(wrapped.inner, wrapped.categoryId, wrapped.inner?.artifact.stateLayout);
  return found;
}

function replaceMockNftCommitment(
  storage: MockUtxoStorage, utxo: Utxo, commitment: string,
): boolean {
  const key = `${utxo.txid}:${utxo.vout}`;
  // A full storage snapshot clones every chain and mempool entry. The indexed outpoint reader returns the
  // same confirmed NFT as an isolated copy, without cloning the whole chain for each oracle register.
  const entry = storage.getUtxoByOutpoint(key);
  if (!entry?.tokenData?.nft || entry.height <= 0 || !storage._test) return false;
  if (entry.tokenData.nft.commitment === commitment) return false;
  storage._test.utxo.remove({ txid: utxo.txid, vout: utxo.vout });
  storage._test.utxo.add({
    txid: utxo.txid,
    vout: utxo.vout,
    satoshis: entry.satoshis,
    scriptHash: entry.scriptHash,
    height: entry.height,
    lockingBytecode: entry.lockingBytecode,
    isCoinbase: entry.isCoinbase,
    tokenData: {
      category: entry.tokenData.category,
      amount: entry.tokenData.amount,
      nft: { capability: entry.tokenData.nft.capability, commitment },
    },
  });
  return true;
}

/**
 * Rewrites a framed deployment's register records in place: read by category and decoded as its entries read
 * them, re-encoded with the shipped pushdata encoder. A deployment whose records do not classify is left alone.
 */
async function syncFramedRegisters(
  provider: NetworkProvider,
  storage: MockUtxoStorage,
  target: OracleTarget,
  touched: readonly StateVariableInfo[],
  byRegister: Readonly<Record<string, bigint | Uint8Array>>,
): Promise<number> {
  const { categoryId, layout } = target;
  let onChain: FramedState;
  try {
    onChain = await readFramedState(provider, categoryId, layout);
  } catch {
    return 0;
  }
  let updated = 0;
  for (const nftIndex of new Set(touched.map((variable) => variable.nftIndex))) {
    const next = { ...onChain.byNft[nftIndex] };
    for (const variable of touched) {
      if (variable.nftIndex === nftIndex) next[variable.name] = byRegister[variable.name]!;
    }
    const commitment = buildPushdataCommitment(layout, next, nftIndex);
    if (replaceMockNftCommitment(storage, onChain.records[nftIndex]!, commitment)) updated += 1;
  }
  return updated;
}

/** Write the mock tip into every registered deployment's `__block_*` registers, in the records it reads. */
async function syncMockBlockOracleDeployments(
  provider: NetworkProvider,
  deployments: Iterable<{ contract: unknown }>,
  keeperRule = false,
): Promise<number> {
  const storage = (provider as { indexer?: { storage?: MockUtxoStorage } }).indexer?.storage;
  if (!storage?._test) return 0;
  const { getContractState, getDataNftAddress } = await import('../stateful/covenant-helpers.js');
  const { StateReader } = await import('../stateful/StateReader.js');
  const fields = simulatorPoolFields(
    await provider.getBlockHeight(), (provider as unknown as { getBlockTime: () => number }).getBlockTime(),
  );
  const byRegister: Record<string, bigint | Uint8Array> = {
    __block_number: fields.number,
    __block_timestamp: fields.timestamp,
    __block_difficulty: fields.difficulty,
    __block_size: fields.size,
    __block_totalFees: fields.totalFees,
    __block_coinbase: fields.coinbase,
  };
  let updated = 0;
  for (const deployment of deployments) {
    for (const target of oracleTargetsFromDeployment(deployment)) {
      const { contract, categoryId, layout } = target;
      const touched = layout.variables.filter((variable) => (
        (MOCK_ORACLE_REGISTERS as readonly string[]).includes(variable.name)
      ));
      if (touched.length === 0) continue;
      if (contract === undefined) {
        updated += await syncFramedRegisters(provider, storage, target, touched, byRegister);
        continue;
      }
      let onChain;
      try {
        const dataNftAddr = getDataNftAddress(contract, categoryId);
        const addresses = [contract.tokenAddress, dataNftAddr];
        onChain = await new StateReader(layout).readStateFromChain(
          contract.provider, categoryId, addresses, addresses,
        );
      } catch {
        try {
          onChain = await getContractState(contract, categoryId);
        } catch {
          continue;
        }
      }
      // An implicit refresh moves only a register behind the tip: one at or past the tip height stands, as state
      // seeded for a fixed block or an owner's update would on chain. A layout without a height register is always
      // refreshed, and an explicit tip move (mine, evm_increaseTime) refreshes unconditionally.
      if (keeperRule) {
        const recorded = onChain.state.__block_number;
        if (typeof recorded === 'bigint' && recorded >= fields.number) continue;
      }
      const next = { ...onChain.state };
      for (const variable of touched) {
        next[variable.name] = byRegister[variable.name];
      }
      const nftIndices = new Set(touched.map((variable) => variable.nftIndex));
      for (const nftIndex of nftIndices) {
        const utxo = onChain.dataNftUtxos[nftIndex];
        if (!utxo?.token?.nft) continue;
        const commitment = buildPushdataCommitment(layout, next, nftIndex);
        if (replaceMockNftCommitment(storage, utxo, commitment)) updated += 1;
      }
    }
  }
  return updated;
}

/**
 * Refresh only one contract graph (including proxy/implementation pairs), as the keeper would: a direct contract
 * whose height register is already at or past the tip is left alone.
 */
export async function syncMockBlockOracleDeployment(
  provider: NetworkProvider,
  deployment: { contract: unknown },
): Promise<number> {
  return syncMockBlockOracleDeployments(provider, [deployment], true);
}

export async function syncMockBlockOracles(provider: NetworkProvider): Promise<number> {
  const { listDeployments } = await import('../stateful/deployment-registry.js');
  return syncMockBlockOracleDeployments(provider, listDeployments(provider));
}
