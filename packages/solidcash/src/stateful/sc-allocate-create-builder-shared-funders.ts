/**
 * phase-boundary extract: SC _createBuilder extract — pre-allocate shared signer funders for nested B blocks.
 */

import type { ExternalCallAbi } from '@solidcash/utils';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';

export type CreateBuilderSharedFunderExternalCall = {
  functionName?: string;
  externalContract?: {
    categoryId: string;
    inner: {
      artifact: {
        abi: ReadonlyArray<{
          name: string;
          blockLayout?: {
            slots: ReadonlyArray<{ kind: string }>;
          };
        }>;
      };
    };
  };
};

export interface AllocateCreateBuilderSharedFundersHost {
  getSignerUtxos(): Promise<Utxo[]>;
  unlockP2PKH(): UnlockableUtxo['unlocker'];
}

export interface AllocateCreateBuilderSharedFundersResult {
  sharedFunderPool: UnlockableUtxo[] | undefined;
  sharedFunderSnapshot: UnlockableUtxo[] | undefined;
}

/**
 * Conservatively count output-only funder slots across nested callee blocks and
 * snapshot the signer's plain UTXOs into a shared pool consumed by nested assembly.
 */
export async function allocateCreateBuilderSharedFunders(
  host: AllocateCreateBuilderSharedFundersHost,
  externalCalls: readonly ExternalCallAbi[],
  resolvedExternalCalls: readonly CreateBuilderSharedFunderExternalCall[],
  earlySignerUtxos: Utxo[] | undefined,
): Promise<AllocateCreateBuilderSharedFundersResult> {
  let totalBFunders = 0;
  for (let si = 0; si < externalCalls.length; si++) {
    const ecSlot = externalCalls[si];
    const ci = resolvedExternalCalls[si];
    if (!ci?.externalContract) continue;
    const bArt = ci.externalContract.inner.artifact;
    const bAbiFunc = bArt.abi.find((f) => f.name === (ci.functionName ?? ecSlot.functionName));
    const bLayout = bAbiFunc?.blockLayout;
    if (!bLayout) continue;
    const fullBlockKinds = new Set(
      ['entry', 'satoshiContainer', 'tokenContainer', 'transfer', 'tcTransfer', 'event', 'returnEvent',
        'blockhashOracle'],
    );
    if (!bLayout.slots.some((s) => fullBlockKinds.has(s.kind))) continue;
    for (const s of bLayout.slots) {
      if (['transfer', 'tcTransfer', 'event', 'returnEvent'].includes(s.kind)) totalBFunders++;
      if (s.kind === 'blockhashOracle') totalBFunders++;
      // entry/TC/SC funders also needed when UTXO doesn't exist, but we can't
      // cheaply check on-chain state here. Conservatively over-allocate:
      if (['entry', 'tokenContainer', 'satoshiContainer'].includes(s.kind)) totalBFunders++;
    }
  }
  if (totalBFunders <= 0) {
    return { sharedFunderPool: undefined, sharedFunderSnapshot: undefined };
  }
  const signerUtxos = earlySignerUtxos ?? await host.getSignerUtxos();
  const plainUtxos = signerUtxos.filter((u) => !u.token);
  // Retain the complete snapshot. Nested blocks consume only what they need, and the caller block can
  // consume the remainder without a second provider-wide wallet scan after large prior transactions.
  const sharedFunderPool = plainUtxos.map((u) => ({
    ...u, unlocker: host.unlockP2PKH(),
  }));
  return {
    sharedFunderPool,
    sharedFunderSnapshot: [...sharedFunderPool],
  };
}
