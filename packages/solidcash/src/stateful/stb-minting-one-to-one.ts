/**
 * phase-boundary extract: STB class-body extract — restore minting inputs 1:1 and strip surplus
 * minting duplicates that would fail token-container spend checks.
 */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { UnlockableUtxo } from '../interfaces.js';
import type { TokenContainerInfo } from './external-call-utxo-group.js';
import { stripSurplusMintingOutputs } from './scid-minting-return-layout.js';
import { cloneToken } from './stb-output-utils.js';

export interface MintingOneToOneHost {
  readonly allInputs: UnlockableUtxo[];
  readonly tokenContainers: readonly TokenContainerInfo[];
}

/**
 * Minting inputs are 1:1. Token-container spend checks
 * OUTPUTVALUE/AMOUNT >= UTXOVALUE/AMOUNT at INPUTINDEX; a dust-sized
 * duplicate minting at that index fails FakeToken.transferFrom.
 */
export function reassertMintingOneToOne(
  host: MintingOneToOneHost,
  builder: TransactionBuilder,
): void {
  const containerInputs = new Set(host.tokenContainers.flatMap((container) => container.utxo
    ? [`${container.utxo.txid.toLowerCase()}:${container.utxo.vout}`] : []));
  for (let index = 0; index < host.allInputs.length; index++) {
    const input = host.allInputs[index];
    if (!input?.token || input.token.nft?.capability !== 'minting') continue;
    if (!('unlocker' in input) || !input.unlocker) continue;
    // A token container can transfer its NFT and some FTs in the same transaction. Its master-authorized
    // covenant permits that split; copying the entire input to its preservation output silently undoes the FT
    // transfer and can erase the separate NFT transfer. Only contract masters require this 1:1 repair.
    if (containerInputs.has(`${input.txid.toLowerCase()}:${input.vout}`)) continue;
    // A minting master can sit after a compiler-reserved balanced frame. Materialize its earlier
    // unclaimed cells before assigning the master so probe transactions never contain sparse outputs.
    for (let slot = 0; slot < index; slot++) {
      if (builder.outputs[slot] === undefined) {
        builder.outputs[slot] = { to: Uint8Array.of(0x51), amount: 1000n };
      }
    }
    builder.outputs[index] = {
      to: input.unlocker.generateLockingBytecode(),
      amount: input.satoshis,
      token: cloneToken(input.token),
    };
    stripSurplusMintingOutputs(
      builder.outputs,
      host.allInputs,
      input.token.category ?? '',
      index,
    );
  }
}
