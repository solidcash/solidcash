/**
 * The event logs a composed transaction carries.
 *
 * A framed contract emits an event as a token NFT minted at an event covenant whose category is the emitter's.
 * Each execution's witness block lists, by output index, the event outputs that execution emitted, and the
 * composer allocates those outputs in the transaction's trailing region. The covenant a listed output carries is
 * rebuilt from the emitting contract's category and the event's signature, so the output says which of the
 * artifact's declared events it holds.
 *
 * This module reads an accepted composition back into the receipt a caller expects: one log per declared event
 * output, naming the emitting contract's `addrV(category)` — not the covenant's lock, which is the output's own
 * locking bytecode — and the decoded fields in declared parameter order. A nested frame's event is reported the
 * same way, with the callee's address, because the emitter is the frame that listed the output rather than the
 * root that started the transaction.
 *
 * The decoding itself is the shipped event decoder (`tryParseEventCommitment`), the same one the direct path's
 * receipt uses; the coordinates all come from the composer's draft, so nothing here recomputes an index.
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  buildAnonymousEventNftCovenantScript,
  buildEventNftCovenantScript,
  bytesEqual,
  computeEventNameHash,
  hash256,
  scriptToBytecode,
  validatorAddress,
  type Artifact,
  type EventDefinitionAbi,
  type StateValue,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { tryParseEventCommitment } from '../../stateful/StateReader.js';
import { blockContractName, type CompositionDraft } from '../composer/index.js';

/** One decoded event log, the receipt shape a composition's declared event outputs are read back into. */
export interface CompositionEventLog {
  /** The event's ABI name. */
  readonly eventName: string;
  /** The event's full signature, e.g. `Transfer(pubkey,int)`. */
  readonly eventSignature: string;
  /** The emitting contract's name; `address` tells two deployments of it apart. */
  readonly contract: string;
  /** The execution whose frame listed the output: the root that emitted it, or a nested callee. */
  readonly emitter: string;
  /**
   * The emitting contract's address, `addrV(category)`.
   *
   * This is not the output's own locking bytecode: an event output sits at an event covenant, whose lock is a
   * function of the category and the event signature. The address that emitted it is the contract's, which the
   * caller reads as `msg.sender` would name it.
   */
  readonly address: Uint8Array;
  /** The output the event sits at, in the derived transaction. */
  readonly outputIndex: number;
  /** The NFT commitment the output carries, as emitted. */
  readonly commitment: Uint8Array;
  /** The decoded fields, keyed by the event ABI's parameter names. */
  readonly args: Readonly<Record<string, StateValue>>;
  /** The decoded fields, in declared parameter order. */
  readonly values: readonly StateValue[];
}

/** An event output as a caller may hand it in: a locking bytecode and an NFT commitment. */
export interface CompositionEventOutput {
  readonly lockingBytecode: Uint8Array;
  readonly token?: {
    readonly nft?: { readonly commitment: Uint8Array };
  };
}

/** Options for reading a composition's event logs. */
export interface CompositionEventLogOptions {
  /** The validator program the emitter's address derives from. Defaults to the shipped framed validator's. */
  readonly validatorProgram?: Uint8Array;
  /** The derived transaction's outputs, when they are not read from the draft. */
  readonly outputs?: readonly (CompositionEventOutput | undefined)[];
}

/** The covenant lock an emitted event output carries: the P2SH32 of the covenant the emitting body rebuilds. */
function eventCovenantLock(category: Uint8Array, definition: EventDefinitionAbi): Uint8Array {
  const covenant = definition.anonymous === true
    ? buildAnonymousEventNftCovenantScript(category)
    : buildEventNftCovenantScript(category, computeEventNameHash(definition.signature));
  return encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(covenant)));
}

/**
 * The declared events an output could hold, matched by the covenant its category and signature rebuild.
 *
 * A named event's covenant commits to its signature, so at most one matches. Anonymous events share one covenant,
 * so several can match and the commitment decides which one the output carries.
 */
function declaredEvents(
  artifact: Artifact,
  category: Uint8Array,
  lockingBytecode: Uint8Array,
): readonly EventDefinitionAbi[] {
  return (artifact.events ?? []).filter(
    (definition) => bytesEqual(eventCovenantLock(category, definition), lockingBytecode),
  );
}

/**
 * The fields an output's commitment decodes to, in declared order, or `undefined` when it is not this event's.
 *
 * A zero-parameter event carries no field and its commitment is the reached-marker the emitter writes, which the
 * pushdata decoder does not walk, so it decodes trivially.
 */
function decodeFields(
  commitment: Uint8Array,
  definition: EventDefinitionAbi,
  structs: readonly StructDefinitionInfo[] | undefined,
): { readonly args: Record<string, StateValue>; readonly values: readonly StateValue[] } | undefined {
  if (definition.parameters.length === 0) return { args: {}, values: [] };
  const args = tryParseEventCommitment(binToHex(commitment), definition, structs);
  if (args === null) return undefined;
  return { args, values: definition.parameters.map((parameter) => args[parameter.name]!) };
}

/**
 * Reads an accepted composition's declared event outputs into decoded logs, in output order.
 *
 * The frames' own witness blocks are the census: an output is reported only when the execution that listed it
 * declared it, so an event-covenant output no frame lists is not a log. Each log's address is the emitting
 * contract's `addrV(category)`, derived from the category the emitting master's input carries, and its fields are
 * decoded with the artifact's own event ABI in declared order. A nested frame's event carries the callee's
 * address, because the callee is the execution that listed it.
 */
export function compositionEventLogs(
  draft: CompositionDraft,
  artifacts: readonly Artifact[],
  options: CompositionEventLogOptions = {},
): readonly CompositionEventLog[] {
  const emitters = draft.layout.participants.filter((placed) => placed.kind === 'master');
  const sample = emitters[0];
  if (sample === undefined) return [];
  const program = draft.programFor(sample.id);
  const outputs = options.outputs ?? program.transaction.outputs;
  const validatorProgram = options.validatorProgram ?? framedValidator.buildValidatorProgram();

  const logs: CompositionEventLog[] = [];
  for (const placed of emitters) {
    const listed = draft.blockOf(placed.id).events;
    if (listed.length === 0) continue;
    // A further deployment's block qualifies its contract's name; the address below tells the deployments apart.
    const contract = blockContractName(placed.contract);
    const artifact = artifacts.find((candidate) => candidate.contractName === contract);
    if (artifact === undefined) continue;
    const category = program.sourceOutputs[placed.index]?.token?.category;
    if (category === undefined) continue;
    const address = validatorAddress(category, validatorProgram);
    const structs = artifact.stateLayout?.structs ?? artifact.structs;

    for (const outputIndex of listed) {
      const output = outputs[outputIndex];
      const commitment = output?.token?.nft?.commitment;
      // A frame lists the output of an emit its body skipped with the empty commitment, which no reached emit
      // carries (a zero-parameter event writes a marker byte), so it is no log.
      if (output === undefined || commitment === undefined || commitment.length === 0) continue;
      // The output's covenant names the declared event, and a commitment that does not decode against every
      // candidate is one the frame did not compute: it is not reported.
      const decoded = declaredEvents(artifact, category, output.lockingBytecode)
        .map((definition) => ({ definition, fields: decodeFields(commitment, definition, structs) }))
        .find((candidate) => candidate.fields !== undefined);
      if (decoded?.fields === undefined) continue;
      logs.push({
        eventName: decoded.definition.name,
        eventSignature: decoded.definition.signature,
        contract,
        emitter: placed.id,
        address,
        outputIndex,
        commitment: Uint8Array.from(commitment),
        args: decoded.fields.args,
        values: decoded.fields.values,
      });
    }
  }
  return logs.sort((left, right) => left.outputIndex - right.outputIndex);
}
