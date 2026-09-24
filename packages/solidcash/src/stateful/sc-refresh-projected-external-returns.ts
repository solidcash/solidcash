/**
 * phase-boundary extract: SC class-body extract — refresh projected external-call return commitments on a builder.
 */

import { binToHex, hexToBin, utf8ToBin } from '@bitauth/libauth';
import { hash256 as hash256Sync } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { tryCashAddressToLockScript } from '../utils.js';
import { getDataNftLockingBytecode, getEntryNftLockingBytecode } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { encodeExternalReturnValue } from './external-return-encoding.js';
import { decodeEntryCommitment } from './SortedList.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import type { StatefulContract } from './StatefulContract.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { projectedExternalReturnCandidates } from './writer-group-selection.js';

export async function refreshProjectedExternalReturns(
  stb: StatefulTransactionBuilder,
  groups: readonly ExternalCallUtxoGroup[],
): Promise<void> {
  const candidates = projectedExternalReturnCandidates(groups);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_BUILDER_TIMING === '1') {
    console.error('projected-return-plan', {
      groups: groups.length,
      materializedGroups: stb.getExternalCallUtxoGroups().length,
      candidates: candidates.map(({ groupIndex, abiFunction }) => ({
        groupIndex, functionName: abiFunction.name,
      })),
    });
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_RETURN_SNAPSHOT === '1') {
    console.error('projected-return-candidates', candidates.map(({ groupIndex, abiFunction }) => ({
      groupIndex, functionName: abiFunction.name,
    })));
  }
  if (candidates.length === 0) return;
  const projectedOutputs = stb.materializeProjectedComputedValueChunks().outputs;

  for (const { groupIndex, abiFunction } of candidates) {
    const group = groups[groupIndex];
    const callee = (group.logicalContract ?? group.externalContract) as StatefulContract;
    const artifact = group.logicalArtifact ?? callee.inner.artifact;
    // A proxy implementation needs its own projected provider and constructor frame. Its compiler-owned route
    // handles this sequencing today; do not pretend the proxy's physical ABI is the implementation ABI.
    if (artifact !== callee.inner.artifact) continue;

    const baseProvider = callee.inner.provider;
    const byLockingBytecode = new Map<string, Utxo[]>();
    const projectedCategoryUtxos: Utxo[] = [];
    const controlledLocks = new Set<string>();
    const control = (lockingBytecode: Uint8Array | undefined): void => {
      if (lockingBytecode) controlledLocks.add(binToHex(lockingBytecode));
    };
    control(tryCashAddressToLockScript(callee.inner.tokenAddress));
    control(getDataNftLockingBytecode(group.categoryId));
    for (const collection of callee.inner.artifact.stateLayout?.collections ?? []) {
      control(getEntryNftLockingBytecode(callee.inner, group.categoryId, collection.signature));
    }

    for (const [outputIndex, output] of projectedOutputs.entries()) {
      if (output.token?.category !== group.categoryId) continue;
      const lockingBytecode = tryCashAddressToLockScript(output.to);
      if (!lockingBytecode) continue;
      const utxo: Utxo = {
        txid: binToHex(hash256Sync(utf8ToBin(
          `projected:${group.categoryId}:${outputIndex}`,
        ))),
        vout: outputIndex,
        satoshis: output.amount,
        token: {
          amount: output.token.amount,
          category: output.token.category,
          ...(output.token.nft && { nft: { ...output.token.nft } }),
        },
      };
      const key = binToHex(lockingBytecode);
      const atLock = byLockingBytecode.get(key) ?? [];
      atLock.push(utxo);
      byLockingBytecode.set(key, atLock);
      projectedCategoryUtxos.push(utxo);
    }
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RETURN_SNAPSHOT === '1') {
      console.error('projected-return-state', {
        groupIndex,
        args: (group.logicalFunctionArgs ?? group.functionArgs).map((arg) => (
          arg instanceof Uint8Array ? binToHex(arg) : String(arg)
        )),
        controlledLocks: [...controlledLocks],
        outputs: projectedOutputs.flatMap((output, outputIndex) => {
          if (output.token?.category !== group.categoryId || !output.token.nft) return [];
          const lockingBytecode = tryCashAddressToLockScript(output.to);
          const commitment = hexToBin(output.token.nft.commitment);
          const parsed = commitment.length >= 64 ? decodeEntryCommitment(commitment) : undefined;
          return [{
            outputIndex,
            lock: lockingBytecode && binToHex(lockingBytecode),
            controlled: lockingBytecode && controlledLocks.has(binToHex(lockingBytecode)),
            capability: output.token.nft.capability,
            commitment: output.token.nft.commitment,
            slot: parsed && binToHex(parsed.slot),
            value: parsed && binToHex(parsed.value),
          }];
        }),
      });
    }

    const projectedAt = (lockingBytecode: Uint8Array | string): Utxo[] | undefined => {
      const bytes = lockingBytecode instanceof Uint8Array
        ? lockingBytecode : (/^(?:bitcoincash|bchtest|bchreg):/i.test(lockingBytecode)
          ? tryCashAddressToLockScript(lockingBytecode) : hexToBin(lockingBytecode));
      if (!bytes) return undefined;
      const key = binToHex(bytes);
      return controlledLocks.has(key) ? [...(byLockingBytecode.get(key) ?? [])] : undefined;
    };
    const projectedProvider: NetworkProvider = {
      network: baseProvider.network,
      consensusLimits: baseProvider.consensusLimits,
      policy: baseProvider.policy,
      getUtxos: async (address) => projectedAt(address) ?? baseProvider.getUtxos(address),
      getUtxosForLockingBytecode: async (lockingBytecode) => projectedAt(lockingBytecode)
        ?? baseProvider.getUtxosForLockingBytecode(lockingBytecode),
      getUtxosByTokenCategory: async (categoryId) => categoryId === group.categoryId
        ? [...projectedCategoryUtxos]
        : baseProvider.getUtxosByTokenCategory?.(categoryId) ?? [],
      getBlockHeight: () => baseProvider.getBlockHeight(),
      getRawTransaction: (txid) => baseProvider.getRawTransaction(txid),
      sendRawTransaction: (txHex) => baseProvider.sendRawTransaction(txHex),
      ...(baseProvider.sendPreparedTransaction && {
        sendPreparedTransaction: (prepared) => baseProvider.sendPreparedTransaction!(prepared),
      }),
    };
    const projectedCallee = callee.withProvider(projectedProvider) as StatefulContract;
    const value = await projectedCallee._deriveReturnValue(
      abiFunction.name,
      (group.logicalFunctionArgs ?? group.functionArgs) as FunctionArgument[],
    );
    const commitment = encodeExternalReturnValue(
      value,
      abiFunction.outputs![0].type,
      artifact.structs ?? artifact.stateLayout?.structs,
      resolveExternalResultEncoding(
        abiFunction.resultEncoding,
        artifact,
        abiFunction.outputs!.map((output) => output.type),
        `function '${abiFunction.name}' result`,
      ) === 'evm-abi-v1',
      artifact.enums,
    );
    group.precomputedReturnCommitment = commitment;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_RETURN_SNAPSHOT === '1') {
      console.error('projected-return-refreshed', {
        groupIndex, functionName: abiFunction.name, value: String(value), commitment: binToHex(commitment),
      });
    }
    stb.setReturnEventOutput(
      group.categoryId, commitment, `external-call:${groupIndex}:0`,
    );
  }
}
