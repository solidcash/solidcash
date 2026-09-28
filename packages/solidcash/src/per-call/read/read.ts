/**
 * An off-chain read of a deployed per-call contract.
 *
 * A read is a composition whose root frame is `STATIC`: it is derived and evaluated on the machine, changes
 * nothing, and the value its entry returned is what the caller asked for. The value is not logged anywhere: the
 * entry's body compares the blob its own `return` computed against the frame's `retval` slot, so the bytes on the
 * derived transaction are the entry's own answer. This module plans that composition over the contract's live
 * records, learns the returned bytes from that comparison, derives it with the shipped composer, and decodes the
 * value with the shipped decoder.
 *
 * A read is never broadcast. The plan spends the contract's master, a validator (the head admits a `STATIC` frame
 * only when a validator binds it) and the records the frame reads, and it recreates every one of them unchanged.
 * Locally evaluating that transaction is the whole read; the caller's provider is only ever read from.
 *
 * What the read is of: a data-NFT state record, read fresh through the deployment layer (`readPerCallDeployment`),
 * so the record the read resolves is the one the chain holds rather than a fixture. A read whose entry makes an
 * external call is not planned here: its composition reaches another contract's deployment, which this round does
 * not resolve. A mapping-backed record is not read yet either, because the deployment layer's classification is
 * built for data-NFT records.
 */

import { hexToBin } from '@bitauth/libauth';
import { createVirtualMachineBch2026ForProvider } from '../../network/createVirtualMachine.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  FrameKind,
  bytesEqual,
  decodePushdataValue,
  sha256,
  validatorRedeemScript,
  type Artifact,
  type StateValue,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import { encodeFunctionArgument } from '../../Argument.js';
import {
  deployMaster,
  readComputedDeclaration,
  readPerCallDeployment,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../deploy/index.js';
import {
  createComposedDerivationHost,
  createShippedDerivationHost,
  deriveDepthFirst,
  describeInnermost,
  layoutTransaction,
  participant,
  readPublishedStopSites,
  reportCompositionRefusal,
  type CompositionDraft,
  type CompositionDraftPlan,
  type CompositionRefusal,
  type DraftInput,
  type DraftMaster,
  type DraftRecordEntry,
} from '../composer/index.js';

/** The BCH-2026 machine a read runs and learns on. */
type ReadMachine = ReturnType<typeof createVirtualMachineBch2026ForProvider>;

/** Raised when a read cannot be planned or driven from what the caller supplied. */
export class PerCallReadError extends Error {
  public readonly name = 'PerCallReadError';

  public constructor(message: string) {
    super(message);
  }
}

/** What the caller asks a read for. */
export interface PerCallReadOptions {
  readonly provider: NetworkProvider;
  /** The deployed contract's per-call artifact. */
  readonly artifact: Artifact;
  /** The deployed contract's token category, as hex. */
  readonly categoryId: string;
  /** The read entry's ABI name. */
  readonly functionName: string;
  /** The entry's arguments, in parameter order. */
  readonly args?: readonly FunctionArgument[];
  /** The validator program the deployment used. Defaults to the shipped per-call validator's. */
  readonly validatorProgram?: Uint8Array;
  /** The machine the read is derived and evaluated on. Defaults to the provider's own. */
  readonly vm?: ReadMachine;
}

/** What a read returned, and how it landed. */
export interface PerCallReadResult {
  /** The entry's returned values, decoded with the shipped decoder, in declaration order. */
  readonly values: readonly StateValue[];
  /** The first returned value, for the common single-value read. */
  readonly value: StateValue;
  /** The bytes the derived transaction records in the read frame's `retval` slot. */
  readonly retval: Uint8Array;
  /** The machine's verdict on the read frame's own input. */
  readonly accepted: boolean;
  /** The machine's objection when the entry refused, with the frame's own source reason when one is published. */
  readonly objection?: string;
  /** The read frame's refusal, reported the same way a refused composition's is. Present only when it refused. */
  readonly refusal?: CompositionRefusal;
  /** The derived composition: the read frame, the validator and the records it spends. */
  readonly draft: CompositionDraft;
}

/** The identities the read's plan names; the layout is the only source of their coordinates. */
const READ_MASTER = 'read';
const VALIDATOR_ID = 'validator';

/** The record identity for data-NFT index `nftIndex`. */
function recordId(nftIndex: number): string {
  return `record-${nftIndex}`;
}

/**
 * The placeholder the plan records before the entry's own computation is known.
 *
 * The entry's body compares the value it computed against the frame's `retval`, so the slot has to hold something
 * for the run to reach that comparison. Domain-separating the placeholder by the master keeps it a value the
 * entry's own `return` never produces, which is what lets the run's close say which operand is the answer.
 */
function retvalPlaceholder(master: string): Uint8Array {
  return sha256(new TextEncoder().encode(`per-call read retval\u0000${master}`));
}

/** The ABI row a read names, refusing an entry the artifact does not publish. */
function requireEntry(artifact: Artifact, functionName: string): {
  readonly name: string;
  readonly selector: string;
  readonly inputs: readonly { readonly name: string; readonly type: string }[];
  readonly outputs: readonly { readonly type: string }[];
} {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  if (entry === undefined) {
    throw new PerCallReadError(`artifact "${artifact.contractName}" publishes no entry "${functionName}"`);
  }
  if (entry.selector === undefined) {
    throw new PerCallReadError(
      `entry "${functionName}" publishes no selector, so its frame cannot be dispatched to`,
    );
  }
  if ((entry.outputs ?? []).length === 0) {
    throw new PerCallReadError(`entry "${functionName}" returns nothing, so it is not a read`);
  }
  return { name: entry.name, selector: entry.selector, inputs: entry.inputs, outputs: entry.outputs ?? [] };
}

/**
 * Refuses a read entry whose source makes an external call.
 *
 * Such an entry's frame reaches another contract, so its composition needs that contract's deployment resolved to a
 * master and a target input. This round plans a read of one contract's own records only; the nested shape is
 * reported by the suite that drives it directly rather than planned here.
 */
function requireCallFreeRead(artifact: Artifact, functionName: string): void {
  const entries = readPublishedStopSites(artifact).entries;
  const entry = entries.find((candidate) =>
    candidate.functionName === `${artifact.contractName}.${functionName}()`);
  if (entry !== undefined && entry.calls.length > 0) {
    throw new PerCallReadError(
      `entry "${functionName}" makes ${entry.calls.length} external call(s), so it reads another contract and is `
      + 'not a call-free read this module can plan',
    );
  }
}

/** The entries one call-free read frame declares: one kept record entry per data-NFT record. */
function readSegments(
  layout: ReturnType<typeof layoutTransaction>,
  records: readonly { readonly commitment: Uint8Array; readonly id: string }[],
): DraftRecordEntry[] {
  return records.map((record) => {
    const index = participant(layout, record.id).index;
    return { in: index, out: index, viewIn: record.commitment, viewOut: record.commitment };
  });
}

/**
 * Decodes the bytes a read frame recorded, through the shipped pushdata decoder.
 *
 * The entry's `return` leaves each value's canonical push concatenated in declaration order, which is the same
 * field encoding a state commitment carries, so the recorded bytes decode with `decodePushdataValue` at each
 * declared type.
 */
function decodeReturnValues(
  retval: Uint8Array,
  outputs: readonly { readonly type: string }[],
  structs: readonly StructDefinitionInfo[] | undefined,
): readonly StateValue[] {
  const values: StateValue[] = [];
  let offset = 0;
  for (const output of outputs) {
    const { value, bytesConsumed } = decodePushdataValue(retval, offset, output.type, structs);
    values.push(value);
    offset += bytesConsumed;
  }
  return values;
}

/**
 * Reads a deployed contract's entry off chain.
 *
 * The entry's own computation produces the answer; this function learns it from the comparison the entry's body
 * makes against the frame's `retval`, then derives the composition and returns the decoded value. Nothing is
 * broadcast.
 */
export async function readPerCallEntry(options: PerCallReadOptions): Promise<PerCallReadResult> {
  const { provider, artifact, categoryId, functionName } = options;
  const entry = requireEntry(artifact, functionName);
  requireCallFreeRead(artifact, entry.name);
  const stateLayout = artifact.stateLayout;
  if (stateLayout === undefined) {
    throw new PerCallReadError(`contract "${artifact.contractName}" is not stateful, so it keeps no record to read`);
  }
  if ((stateLayout.mappings?.length ?? 0) > 0) {
    throw new PerCallReadError(
      `contract "${artifact.contractName}" keeps a mapping, whose entry records the deployment layer does not `
      + 'classify as data-NFT records yet',
    );
  }
  const { perCallValidator } = await import('solidc');
  const validatorProgram = options.validatorProgram ?? perCallValidator.buildValidatorProgram();

  // The live records, classified the way a deployment minted them.
  const deployment = await readPerCallDeployment(provider, categoryId, stateLayout);
  const master = deployment.masters[0];
  if (master === undefined) {
    throw new PerCallReadError(`category ${categoryId} holds no master, so the read has no frame to run`);
  }
  const validator = deployment.validators[0];
  if (validator === undefined) {
    throw new PerCallReadError(`category ${categoryId} holds no validator, which a read frame needs to be admitted`);
  }
  if (deployment.records.length < stateLayout.dataNftCount) {
    throw new PerCallReadError(
      `category ${categoryId} holds ${deployment.records.length} data-NFT record(s), and the layout names `
      + `${stateLayout.dataNftCount}`,
    );
  }

  const category = hexToBin(categoryId);
  const deployed = deployMaster(artifact, category, validatorProgram);
  // The frame's argument pushes: its selector, then each argument's own encoding with the last parameter's first,
  // which is the order a callee's body reads them off the stack in.
  const argumentPushes = [
    new Uint8Array(hexToBin(entry.selector)),
    ...(options.args ?? []).map((value, index) => {
      const input = entry.inputs[index];
      if (input === undefined) throw new PerCallReadError(`entry "${functionName}" has no parameter ${index}`);
      return encodeFunctionArgument(value, input.type, stateLayout.structs) as Uint8Array;
    }).reverse(),
  ];

  const records = Array.from({ length: stateLayout.dataNftCount }, (_unused, nftIndex) => {
    const utxo = deployment.records[nftIndex]!;
    const commitment = utxo.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallReadError(`the record at data-NFT index ${nftIndex} carries no commitment`);
    }
    return { id: recordId(nftIndex), commitment: new Uint8Array(hexToBin(commitment)) };
  });

  const blocks = [{
    contract: artifact.contractName,
    masters: [READ_MASTER],
    validator: { id: VALIDATOR_ID, settles: [] as string[] },
    state: records.map((record) => record.id),
  }];
  const layout = layoutTransaction(blocks);

  // A `STATIC` root owns its records, so its caller reference only has to be an input that is not itself; the
  // read spends no user's signature, so the first record stands in for the caller and the origin.
  const callerRef = records[0]!.id;
  const readMaster: DraftMaster = {
    master: READ_MASTER,
    contract: artifact.contractName,
    functionName: `${artifact.contractName}.${entry.name}()`,
    program: deployed.script,
    facts: {
      contract: artifact.contractName,
      functionName: entry.name,
      kind: FrameKind.STATIC,
      callerIsUser: false,
      originEqualsCaller: false,
      makesExternalCall: false,
      mastersOfContract: 1,
    },
    frame: { kind: FrameKind.STATIC, sender: deployed.address, self: deployed.address, value: 0n },
    enteredBy: callerRef,
    origin: callerRef,
    calls: [],
    retval: retvalPlaceholder(READ_MASTER),
    // A call-free read closes one segment, which declares every record it read as kept in place.
    segments: [readSegments(layout, records)],
    events: [],
    sends: [],
    argumentPushes,
    redeemScript: deployed.script,
    dispatches: true,
  };

  const recordLock = stateRecordLockingBytecode(categoryId);
  const masterInputIndex = participant(layout, READ_MASTER).index;
  const inputs: CompositionDraftPlan['inputs'] = {
    [READ_MASTER]: {
      source: {
        lockingBytecode: deployed.lockingBytecode,
        valueSatoshis: master.satoshis,
        token: { category, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
      },
    },
    [VALIDATOR_ID]: {
      source: {
        lockingBytecode: deployed.address,
        valueSatoshis: validator.satoshis,
        token: { category, amount: 0n, nft: { capability: 'mutable', commitment: new Uint8Array(0) } },
      },
    },
  };
  const inputsWithRecords: Record<string, DraftInput> = { ...inputs };
  records.forEach((record, nftIndex) => {
    inputsWithRecords[record.id] = {
      source: {
        lockingBytecode: recordLock,
        valueSatoshis: deployment.records[nftIndex]!.satoshis,
        token: { category, amount: 0n, nft: { capability: 'mutable', commitment: record.commitment } },
      },
      // A read leaves the record where it is, so it takes the covenant's read-only path.
      unlockingBytecode: stateRecordUnlockingBytecode(categoryId, masterInputIndex, 0),
    };
  });

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [],
    masters: [readMaster],
    inputs: inputsWithRecords,
    validator: {
      id: VALIDATOR_ID,
      covers: [],
      settles: [],
      redeemScript: validatorRedeemScript(category, validatorProgram),
    },
  };

  const machine = options.vm ?? createVirtualMachineBch2026ForProvider(provider);
  const { draft } = createComposedDerivationHost({ vm: machine, artifacts: [artifact], plan });

  // The entry's own computation is the answer: run the frame with the placeholder recorded and read the value its
  // body compared that placeholder with. A run that did not reach the comparison refused before returning.
  const maximumCommitmentBytes = provider.consensusLimits?.maximumNftCommitmentBytes ?? 128;
  const reading = readComputedDeclaration({
    vm: machine,
    program: draft.programFor(READ_MASTER),
    maximumCommitmentBytes: Math.max(maximumCommitmentBytes, 32),
  });
  const placeholder = draft.blockOf(READ_MASTER).retval;
  if (!reading.ok) {
    // The entry refused before it could return: report it the way a refused composition is reported, so the
    // caller reads the frame's own source reason rather than the machine's bare operation failure.
    const refusal = reportCompositionRefusal({ draft, artifacts: [artifact], vm: machine });
    return {
      values: [],
      value: 0n,
      retval: new Uint8Array(0),
      accepted: false,
      objection: refusal.innermost === undefined
        ? reading.error ?? `the read frame did not reach its return comparison (${reading.reason})`
        : describeInnermost(refusal.innermost),
      refusal,
      draft,
    };
  }
  const retval = bytesEqual(reading.declared, placeholder) ? reading.computed : reading.declared;
  draft.blockOf(READ_MASTER).retval = retval;

  // Derive the composition through the shipped driver: a call-free read closes its one segment and completes.
  const host = createShippedDerivationHost({ artifacts: [artifact], runs: draft.runs, vm: machine });
  deriveDepthFirst(
    {
      contract: artifact.contractName,
      functionName: readMaster.functionName,
      kind: FrameKind.STATIC,
      master: READ_MASTER,
    },
    host,
  );

  const program = draft.programFor(READ_MASTER);
  const state = machine.evaluate({
    inputIndex: program.inputIndex,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  const accepted = machine.stateSuccess(state) === true;
  const values = decodeReturnValues(retval, entry.outputs, stateLayout.structs);
  return {
    values,
    value: values[0] ?? 0n,
    retval,
    accepted,
    ...(accepted ? {} : { objection: String((state as { error?: unknown }).error) }),
    draft,
  };
}
