/**
 * The NFT roles of one deployment (docs/bcmr/DESIGN.md, section 8): each lock a contract's category sits at, read
 * from the artifact and the category, with the fields its commitments push.
 *
 * Locks are derived per convention. A lock the category cannot enumerate, such as the chunks of one long mapping
 * value, is left out, and clients show such an NFT unparsed.
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  buildAnonymousEventNftCovenantScript, buildEventNftCovenantScript, buildPushdataCommitment, computeEventNameHash,
  encodeEventParameter, encodeNftIndexTag, getDefaultStateValue, hasDataNftIndexTags, hash256, scriptToBytecode,
  type Artifact, type CollectionInfo, type EventDefinitionAbi, type StateLayout, type StateVariableInfo,
} from '@solidcash/utils';
import type { Contract } from '../Contract.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  getAnonymousEventNftAddress, getDataNftAddress, getDynamicChunkAddress, getEntryNftAddress, getEventNftAddress,
} from '../stateful/covenant-helpers.js';
import { addressToLockScript } from '../utils.js';
import { authheadLockingBytecode } from './authhead.js';
import { pushedFields, type NftParseField, type NftParseRole, type NftParseType } from './nft-parse.js';

/** The locks of a deployment's roles, as its convention derives them. */
export interface DeploymentNftLocks {
  /** The category's authhead contract, which holds the identity NFT. */
  readonly authhead: Uint8Array;
  readonly masters: readonly Uint8Array[];
  /** The framed validator pool's lock, `addrV(category)`. */
  readonly validator?: Uint8Array;
  readonly records: Uint8Array;
  readonly entry: (collection: CollectionInfo) => Uint8Array;
  readonly chunk: (variable: StateVariableInfo) => Uint8Array;
  readonly event: (event: EventDefinitionAbi) => Uint8Array;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** The fields of record `nftIndex`, or undefined when one of them is not a run of pushes. */
function recordFields(layout: StateLayout, nftIndex: number): NftParseField[] | undefined {
  const fields: NftParseField[] = [];
  const variables = layout.variables
    .filter((variable) => variable.nftIndex === nftIndex)
    .sort((left, right) => left.fieldIndex - right.fieldIndex);
  for (const variable of variables) {
    if (variable.dynamic === true) {
      // A dynamic value keeps a length header here; its bytes live in chunks.
      fields.push({ id: `${variable.name}.length`, name: `${variable.name} length`, encoding: { type: 'number' } });
      continue;
    }
    const pushed = pushedFields(variable.name, variable.name, variable.type, layout.structs);
    if (pushed === undefined) return undefined;
    fields.push(...pushed);
  }
  return fields;
}

/** A record's sample: its default commitment without the index tag, which the tagged role reads first. */
function recordSample(layout: StateLayout, nftIndex: number): Uint8Array {
  const full = hexToBin(buildPushdataCommitment(layout, {}, nftIndex));
  return hasDataNftIndexTags(layout) ? full.slice(encodeNftIndexTag(nftIndex).length) : full;
}

/** An event's fields and sample, or undefined when its payload is not a run of pushes. */
function eventType(
  event: EventDefinitionAbi, key: bigint, layout: StateLayout | undefined,
): NftParseType {
  const base = {
    key,
    name: `${event.name} event`,
    description: `A ${event.name} log the contract emitted; anyone may spend it after 144 blocks.`,
  };
  if (event.parameters.length === 0) return base;
  const structs = layout?.structs ?? [];
  const fields: NftParseField[] = [];
  for (const parameter of event.parameters) {
    if (parameter.notation === 'evm') return base;
    const pushed = pushedFields(`${event.name}.${parameter.name}`, parameter.name, parameter.type, structs);
    if (pushed === undefined) return base;
    fields.push(...pushed);
  }
  const sample = concat(event.parameters.map((parameter) => encodeEventParameter(
    getDefaultStateValue(parameter.type, structs), parameter, structs,
  )));
  return { ...base, fields, sample };
}

/** The roles of a deployment of `artifact`, at the locks its convention derives. */
export function deploymentNftRoles(artifact: Artifact, locks: DeploymentNftLocks): NftParseRole[] {
  let next = 1n;
  const key = (): bigint => {
    const current = next;
    next += 1n;
    return current;
  };
  const roles: NftParseRole[] = [{
    lockingBytecode: locks.authhead,
    capability: 'mutable',
    type: {
      key: key(),
      name: 'Identity authority',
      description: 'Holds the BCMR identity; its commitment is the lock of the identity\'s owner.',
    },
  }];
  const masterType: NftParseType = {
    key: key(),
    name: 'Contract master',
    description: 'Holds the contract\'s minting authority; every call spends and recreates it.',
  };
  for (const lockingBytecode of locks.masters) roles.push({ lockingBytecode, capability: 'minting', type: masterType });
  if (locks.validator !== undefined) {
    roles.push({
      lockingBytecode: locks.validator,
      capability: 'mutable',
      type: { key: key(), name: 'Composition validator', description: 'Validates a composition of calls.' },
    });
  }

  const layout = artifact.stateLayout;
  if (layout === undefined) return roles;
  const recordType = (nftIndex: number): NftParseType => {
    const fields = recordFields(layout, nftIndex);
    const names = layout.variables.filter((variable) => variable.nftIndex === nftIndex).map(({ name }) => name);
    return {
      key: key(),
      name: layout.dataNftCount > 1 ? `State record ${nftIndex}` : 'State record',
      description: `The contract's state: ${names.join(', ') || 'none'}.`,
      ...(fields === undefined || fields.length === 0 ? {} : { fields, sample: recordSample(layout, nftIndex) }),
    };
  };
  if (layout.dataNftCount > 0) {
    roles.push(hasDataNftIndexTags(layout)
      ? {
        lockingBytecode: locks.records,
        capability: 'mutable',
        tagged: Array.from({ length: layout.dataNftCount }, (_, nftIndex) => ({
          tag: BigInt(nftIndex), type: recordType(nftIndex),
        })),
      }
      : { lockingBytecode: locks.records, capability: 'mutable', type: recordType(0) });
  }
  for (const collection of layout.collections ?? []) {
    roles.push({
      lockingBytecode: locks.entry(collection),
      capability: 'mutable',
      type: { key: key(), name: `${collection.name} entry`, description: `A node of the ${collection.name} collection.` },
    });
  }
  for (const variable of layout.variables.filter((candidate) => candidate.dynamic === true)) {
    roles.push({
      lockingBytecode: locks.chunk(variable),
      capability: 'mutable',
      type: { key: key(), name: `${variable.name} chunk`, description: `Part of the value of ${variable.name}.` },
    });
  }
  const events = artifact.events ?? [];
  for (const event of events.filter((candidate) => candidate.anonymous !== true)) {
    roles.push({ lockingBytecode: locks.event(event), capability: 'none', type: eventType(event, key(), layout) });
  }
  // Anonymous events share one lock, so they are one role and their commitments cannot be told apart.
  const anonymous = events.find((candidate) => candidate.anonymous === true);
  if (anonymous !== undefined) {
    roles.push({
      lockingBytecode: locks.event(anonymous),
      capability: 'none',
      type: { key: key(), name: 'Anonymous event', description: 'A log of an anonymous event the contract emitted.' },
    });
  }
  return roles;
}

/** The locks of a direct-convention deployment, from its category-bound contract. */
export function directNftLocks(contract: Contract<any, any>, category: string): DeploymentNftLocks {
  return {
    authhead: authheadLockingBytecode(category),
    masters: [addressToLockScript(contract.tokenAddress)],
    records: addressToLockScript(getDataNftAddress(contract, category)),
    entry: (collection) => addressToLockScript(getEntryNftAddress(contract, category, collection.name)),
    chunk: (variable) => addressToLockScript(getDynamicChunkAddress(contract, category, variable.name, variable.type)),
    event: (event) => addressToLockScript(event.anonymous === true
      ? getAnonymousEventNftAddress(contract, category)
      : getEventNftAddress(contract, category, event.signature)),
  };
}

/** The lock of a framed contract's event: P2SH32 of the event covenant. */
export function framedEventLockingBytecode(category: string, event: EventDefinitionAbi): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(
    buildEventNftCovenantScript(hexToBin(category), computeEventNameHash(event.signature)),
  )));
}

/** The locks of a framed deployment: its master, its validator pool and the covenants its category derives. */
export async function framedNftLocks(
  artifact: Artifact, category: string, provider: NetworkProvider,
): Promise<DeploymentNftLocks> {
  const { framedValidator } = await import('@solidcash/solidc/runtime');
  const { bindProviderBlockOracle } = await import('../framed/call/block-oracle.js');
  const { deployMaster } = await import('../framed/deploy/material.js');
  const {
    chunkRecordLockingBytecode, entryRecordLockingBytecode, stateRecordLockingBytecode,
  } = await import('../framed/deploy/records.js');
  // A master that reads the block oracle pins its lock, which the deployment binds before filling the master.
  bindProviderBlockOracle(provider, artifact);
  const master = deployMaster(artifact, hexToBin(category), framedValidator.buildValidatorProgram());
  return {
    authhead: authheadLockingBytecode(category),
    masters: [master.lockingBytecode],
    validator: master.address,
    records: stateRecordLockingBytecode(category),
    entry: (collection) => entryRecordLockingBytecode(category, collection.signature),
    chunk: (variable) => chunkRecordLockingBytecode(category, variable.name, variable.type),
    event: (event) => (event.anonymous === true
      ? encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildAnonymousEventNftCovenantScript(hexToBin(category)))))
      : framedEventLockingBytecode(category, event)),
  };
}
