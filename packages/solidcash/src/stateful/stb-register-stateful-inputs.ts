/**
 * phase-boundary extract: STB build-phase extract — locktime, duplicate-input roles, unlocker checks, input registration.
 */

import { binToHex } from '@bitauth/libauth';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type {
  EntryNftInfo,
  ExternalCallUtxoGroup,
  TokenContainerInfo,
} from './external-call-utxo-group.js';

export interface RegisterStatefulInputsHost {
  readonly locktimeOverride?: number;
  readonly allInputs: readonly UnlockableUtxo[];
  readonly masterUtxo: UnlockableUtxo;
  readonly dataNftUtxos: readonly UnlockableUtxo[];
  readonly readOnlyDataNftUtxos: readonly UnlockableUtxo[];
  readonly blockhashCoSpendUtxos: readonly UnlockableUtxo[];
  readonly keccakComputeCoSpendUtxos: readonly UnlockableUtxo[];
  readonly keccakLoopSideCars: readonly UnlockableUtxo[];
  readonly ecrecoverComputeCoSpendUtxos: readonly UnlockableUtxo[];
  readonly iterationEntryInputs: readonly UnlockableUtxo[];
  readonly insertLoopPredecessorInputs: readonly UnlockableUtxo[];
  readonly dynamicChunkInputs: readonly UnlockableUtxo[];
  readonly trailingDisposalInputs: readonly UnlockableUtxo[];
  readonly externalOutStateUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallRawInputs: readonly UnlockableUtxo[];
  readonly funderUtxos: readonly UnlockableUtxo[];
  readonly entryNfts: readonly EntryNftInfo[];
  readonly tokenContainers: readonly TokenContainerInfo[];
  readonly satoshiContainerUtxo?: UnlockableUtxo;
  readonly externalIdentityAnchorUtxos: readonly UnlockableUtxo[];
  readonly logicalIdentityUtxo?: UnlockableUtxo;
  readonly sidecarUtxo?: UnlockableUtxo;
}

/**
 * Apply locktime override, refuse duplicate inputs with role diagnostics, refuse missing unlockers,
 * then register allInputs (+ optional library sidecar) on the builder.
 */
export function registerStatefulInputs(
  host: RegisterStatefulInputsHost,
  builder: TransactionBuilder,
): void {
  if (host.locktimeOverride !== undefined) builder.locktime = host.locktimeOverride;
  const seenInputs = new Map<string, number>();
  for (let index = 0; index < host.allInputs.length; index++) {
    const input = host.allInputs[index];
    const id = `${input.txid.toLowerCase()}:${input.vout}`;
    const first = seenInputs.get(id);
    if (first !== undefined) {
      const roles = (candidate: UnlockableUtxo): string[] => {
        const out: string[] = [];
        const matches = (utxo: Utxo | undefined): boolean => !!utxo
        && utxo.txid.toLowerCase() === candidate.txid.toLowerCase() && utxo.vout === candidate.vout;
        if (matches(host.masterUtxo)) out.push('master');
        host.dataNftUtxos.forEach((utxo, i) => { if (matches(utxo)) out.push(`dataNft:${i}`); });
        host.readOnlyDataNftUtxos.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`readOnlyDataNft:${i}`);
        });
        host.blockhashCoSpendUtxos.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`blockhash:${i}`);
        });
        host.keccakComputeCoSpendUtxos.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`keccak:${i}`);
        });
        host.keccakLoopSideCars.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`keccakLoop:${i}`);
        });
        host.ecrecoverComputeCoSpendUtxos.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`ecrecover:${i}`);
        });
        host.iterationEntryInputs.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`iterationEntry:${i}`);
        });
        host.insertLoopPredecessorInputs.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`insertPredecessor:${i}`);
        });
        host.dynamicChunkInputs.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`dynamicChunk:${i}`);
        });
        host.trailingDisposalInputs.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`trailingDisposal:${i}`);
        });
        host.externalOutStateUtxoGroups.forEach((group, groupIndex) => {
          if (matches(group.masterUtxo)) out.push(`outState:${groupIndex}:master`);
          group.dataNftUtxos.forEach((utxo, nftIndex) => {
            if (matches(utxo)) out.push(`outState:${groupIndex}:dataNft:${nftIndex}`);
          });
          group.blockInputs?.forEach((utxo, slot) => {
            if (matches(utxo)) out.push(`outState:${groupIndex}:block:${slot}`);
          });
        });
        host.externalCallUtxoGroups.forEach((group, groupIndex) => {
          if (matches(group.masterUtxo)) out.push(`external:${groupIndex}:master`);
          group.dataNftUtxos.forEach((utxo, nftIndex) => {
            if (matches(utxo)) out.push(`external:${groupIndex}:dataNft:${nftIndex}`);
          });
          group.blockInputs?.forEach((utxo, slot) => {
            if (matches(utxo)) out.push(`external:${groupIndex}:block:${slot}`);
          });
        });
        host.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
          if (matches(group.masterUtxo)) out.push(`lowLevel:${groupIndex}:master`);
          group.dataNftUtxos.forEach((utxo, nftIndex) => {
            if (matches(utxo)) out.push(`lowLevel:${groupIndex}:dataNft:${nftIndex}`);
          });
          group.blockInputs?.forEach((utxo, slot) => {
            if (matches(utxo)) out.push(`lowLevel:${groupIndex}:block:${slot}`);
          });
        });
        host.lowLevelCallRawInputs.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`lowLevelRaw:${i}`);
        });
        host.funderUtxos.forEach((utxo, i) => { if (matches(utxo)) out.push(`funder:${i}`); });
        host.entryNfts.forEach((entry, i) => { if (matches(entry.utxo)) out.push(`entry:${i}`); });
        host.tokenContainers.forEach((container, i) => {
          if (matches(container.utxo)) out.push(`tokenContainer:${i}`);
        });
        if (matches(host.satoshiContainerUtxo)) out.push('satoshiContainer');
        host.externalIdentityAnchorUtxos.forEach((utxo, i) => {
          if (matches(utxo)) out.push(`externalIdentityAnchor:${i}`);
        });
        if (matches(host.logicalIdentityUtxo)) out.push('logicalIdentityAnchor');
        return out;
      };
      throw new Error(
        `Duplicate stateful input ${id} at ${first}/${index}; roles `
      + `${roles(host.allInputs[first]).join(',') || 'other'} / ${roles(input).join(',') || 'other'}`
      + (() => {
        const matchingEntries = host.entryNfts.filter((entry) => entry.utxo
          && `${entry.utxo.txid.toLowerCase()}:${entry.utxo.vout}` === id).map((entry) => ({
          slotIndex: entry.slotIndex,
          collection: entry.collection,
          exists: entry.exists,
          key: entry.keyValue instanceof Uint8Array ? binToHex(entry.keyValue) : String(entry.keyValue),
          keys: entry.keyValues?.map((value) => value instanceof Uint8Array ? binToHex(value) : String(value)),
          commitment: entry.utxo?.token?.nft?.commitment,
        }));
        return matchingEntries.length === 0 ? '' : `; entries ${JSON.stringify(matchingEntries)}`;
      })(),
      );
    }
    seenInputs.set(id, index);
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
    const missingUnlockers = host.allInputs.map((input, index) => ({ input, index }))
      .filter(({ input }) => !('unlocker' in input) || input.unlocker === undefined);
    if (missingUnlockers.length > 0) {
      console.error('stateful-inputs-missing-unlockers', missingUnlockers.map(({ input, index }) => {
        const same = (candidate: Utxo | undefined): boolean => candidate?.txid === input.txid
        && candidate.vout === input.vout;
        const roles: string[] = [];
        host.externalCallUtxoGroups.forEach((group, groupIndex) => {
          if (same(group.masterUtxo)) roles.push(`external:${groupIndex}:master`);
          group.blockInputs?.forEach((candidate, slot) => {
            if (same(candidate)) roles.push(`external:${groupIndex}:block:${slot}`);
          });
        });
        host.lowLevelCallUtxoGroups.forEach((group, groupIndex) => {
          if (same(group.masterUtxo)) roles.push(`lowLevel:${groupIndex}:master`);
        });
        return {
          index, outpoint: `${input.txid}:${input.vout}`, category: input.token?.category, roles,
        };
      }));
    }
  }
  const missingUnlockers = host.allInputs
    .map((input, index) => ({ input, index }))
    .filter(({ input }) => !input || !('unlocker' in input) || input.unlocker === undefined);
  if (missingUnlockers.length > 0) {
    throw new Error(
      'Stateful input(s) missing unlocker at '
    + missingUnlockers.map(({ input, index }) => (
      `${index}:${input?.token?.category ?? 'plain'}:${input?.txid?.slice(0, 8) ?? '?'}`
    )).join(', '),
    );
  }
  builder.addInputs([...host.allInputs]);
  // Co-spend the external-library side-car as the LAST input (the covenant's library loader reads it via
  // OP_INPUTBYTECODE of the last input). Present in derivation probes and the final tx alike.
  if (host.sidecarUtxo) builder.addInputs([host.sidecarUtxo]);
}
