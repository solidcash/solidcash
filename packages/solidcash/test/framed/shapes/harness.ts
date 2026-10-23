/**
 * Driving the shipped composer for one composition.
 *
 * Every shape here compiles its sources through the shipped `compileStringMulti` with the framed convention,
 * deploys each contract through the shipped `deployMaster`, hands the resulting plan to the shipped composer,
 * derives it with the shipped derivation, and asks the BCH-2026 machine for a verdict on every contract input.
 * Nothing in this file supplies a coordinate: the layout, the frame references, the callee indices and the
 * validator transcript all come from `composeDraft`/`assembleComposition`.
 */

import { binToHex, createVirtualMachineBch2026, encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  FrameKind,
  computeFunctionSelector,
  computeFunctionSignature,
  validatorAddress,
  type Artifact,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import {
  FACET_SATOSHIS,
  createComposedDerivationHost,
  deriveComposition,
  layoutTransaction,
  requireLearnedViews,
  type CompositionDraft,
  type CompositionDraftPlan,
  type DraftCall,
  type DraftInput,
  type DraftMaster,
  type DraftRecordEntry,
  type ContractBlock,
  type DraftSourceOutput,
  type EntryFacts,
  type FrameRequest,
  type FrameWitness,
  type TransactionLayout,
} from '../../../src/framed/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend,
} from '../../../../solidc/test/framed/master/validator-input.js';

export const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
export const EMPTY = new Uint8Array(0);
/** A P2PKH lock for the user inputs that enter a composition; its signature is filler, as every framed test's is. */
export const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

export type ArtifactMap = ReturnType<typeof compileStringMulti>;
export type ContractInput = { readonly id: string; readonly index: number };
type VirtualMachine = ReturnType<typeof createVirtualMachineBch2026>;

/** A compiled, deployed contract: its filled program, its address and the lock its masters sit at. */
export interface DeployedContract {
  readonly name: string;
  readonly category: Uint8Array;
  readonly address: Uint8Array;
  readonly program: Uint8Array;
  readonly lockingBytecode: Uint8Array;
}

/** Compiles a multi-contract source framed and deploys each named contract at its own seeded category. */
export function compileAndDeploy(
  source: string,
  labels: Readonly<Record<string, string>>,
): { readonly artifacts: ArtifactMap; readonly contracts: Readonly<Record<string, DeployedContract>> } {
  const artifacts = compileStringMulti(source, { composition: 'framed' });
  const contracts: Record<string, DeployedContract> = {};
  for (const [name, label] of Object.entries(labels)) {
    const category = seededCategory(label);
    const deployed = deployMaster(artifacts[name] as Artifact, category, VALIDATOR_PROGRAM);
    contracts[name] = {
      name,
      category,
      address: deployed.address,
      program: deployed.script,
      lockingBytecode: deployed.lockingBytecode,
    };
  }
  return { artifacts, contracts };
}

/** The entry identity a compiled artifact's stop-site table is keyed on. */
export function entryName(contract: string, entry: string): string {
  return `${contract}.${entry}()`;
}

/** A function's four-byte dispatcher selector, taken from the compiled artifact's ABI. */
export function selectorOf(artifacts: ArtifactMap, contract: string, entry: string): Uint8Array {
  const selector = artifacts[contract]!.abi.find((row) => row.name === entry)!.selector!;
  return new Uint8Array(Buffer.from(selector, 'hex'));
}

/** A selector computed from a signature, for a call whose callee compiles in the same unit. */
export function selectorOfSignature(entry: string): Uint8Array {
  return computeFunctionSelector(computeFunctionSignature(entry, []));
}

/** The address a contract at the given seeded category sits at, `addrV(category)`. */
export function seededAddress(label: string): Uint8Array {
  return validatorAddress(seededCategory(label), VALIDATOR_PROGRAM);
}

/** A byte string as the hex a source embeds in an address literal. */
export function hexOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function token(
  category: Uint8Array,
  capability: 'minting' | 'mutable',
  commitment: Uint8Array = EMPTY,
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } {
  return { category, amount: 0n, nft: { capability, commitment } };
}

/** A master's source output: the deployed master UTXO the input recreates in place. */
export function masterInput(contract: DeployedContract): DraftSourceOutput {
  return { lockingBytecode: contract.lockingBytecode, valueSatoshis: 20_000n, token: token(contract.category, 'minting') };
}

/** A user input: a signed P2PKH whose filler signature a root frame reads the hash type of. */
export function userInput(): DraftInput {
  return {
    source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    unlockingBytecode: callerUnlockingBytecode(),
  };
}

/** What one execution of a shape declares, with the frame and facts the composer's admission rules read. */
export interface MasterSpec {
  readonly master: string;
  readonly contract: string;
  readonly entry: string;
  readonly program: Uint8Array;
  readonly frame: FrameWitness;
  readonly facts: EntryFacts;
  readonly enteredBy: string;
  readonly origin: string;
  readonly calls?: readonly DraftCall[];
  readonly segments?: readonly (readonly DraftRecordEntry[])[];
  readonly argumentPushes?: readonly Uint8Array[];
  readonly dispatches?: boolean;
}

/** Builds the draft master a plan lists, filling the defaults a stateless, event-free execution has. */
export function master(spec: MasterSpec): DraftMaster {
  const calls = spec.calls ?? [];
  return {
    master: spec.master,
    contract: spec.contract,
    functionName: entryName(spec.contract, spec.entry),
    program: spec.program,
    facts: spec.facts,
    frame: spec.frame,
    enteredBy: spec.enteredBy,
    origin: spec.origin,
    calls,
    retval: EMPTY,
    // A master has one segment per call plus a final one; a stateless execution declares no records in any.
    segments: spec.segments ?? Array.from({ length: calls.length + 1 }, () => []),
    events: [],
    sends: [],
    argumentPushes: spec.argumentPushes ?? [],
    redeemScript: spec.program,
    ...(spec.dispatches === undefined ? {} : { dispatches: spec.dispatches }),
  };
}

/** The user input ids a plan's roots are entered by, in the order the layout places them. */
export function userInputs(ids: readonly string[], firstIndex: number): readonly { id: string; index: number }[] {
  return ids.map((id, offset) => ({ id, index: firstIndex + offset }));
}

/** A validator input for a shape's category; the composer builds the transcript itself. */
export function validatorFor(category: Uint8Array): ReturnType<typeof validatorSpend> {
  return validatorSpend(category, { roots: [], masters: [], settles: [] });
}

/**
 * The facets the shipped validator program binds, keyed by every validator a plan's blocks host.
 *
 * A validator runs as a head plus one input per facet, so a plan that states a coordinate from its own blocks has
 * to place the facet the head binds after it; a plan laid out without them composes one participant short.
 */
export function shippedFacets(blocks: readonly ContractBlock[]): Map<string, readonly Uint8Array[]> {
  const facets = framedValidator.buildValidatorFacets();
  const map = new Map<string, readonly Uint8Array[]>();
  for (const block of blocks) {
    if (block.validator !== undefined) map.set(block.validator.id, facets);
  }
  return map;
}

/** Lays out a plan's blocks with the facet inputs the shipped validator program binds. */
export function layoutWithFacets(blocks: readonly ContractBlock[]): TransactionLayout {
  return layoutTransaction(blocks, shippedFacets(blocks));
}

/** Distinct outpoints for funded facet UTXOs, so one provider can hold several funded compositions. */
let facetFunding = 0;

/**
 * Adds a live UTXO at each facet lock the shipped validator program binds.
 *
 * A composition that broadcasts spends one input per facet, and a facet holds no token and pins no category, so any
 * UTXO of its code serves. A test that only derives its composition needs none: the composer synthesises the facet's
 * source.
 */
export async function fundShippedFacets(provider: {
  addUtxo(lockingBytecode: string, utxo: {
    readonly txid: string; readonly vout: number; readonly satoshis: bigint;
  }): Promise<unknown>;
}): Promise<void> {
  for (const code of framedValidator.buildValidatorFacets()) {
    facetFunding += 1;
    await provider.addUtxo(binToHex(encodeLockingBytecodeP2sh32(hash256(code))), {
      txid: `7e${facetFunding.toString(16).padStart(2, '0')}`.padEnd(64, '0'),
      vout: 0,
      satoshis: FACET_SATOSHIS,
    });
  }
}

/** The outcome of one shape run: the composer's draft, the derivation's result, and the machine's verdicts. */
export interface ShapeOutcome {
  readonly draft: CompositionDraft;
  readonly completed: readonly FrameRequest[];
  readonly transaction: NonNullable<Parameters<VirtualMachine['evaluate']>[0]['transaction']>;
  readonly contractInputs: readonly ContractInput[];
  readonly verdicts: readonly {
    readonly index: number;
    readonly participant: string;
    readonly accepted: boolean;
    readonly objection?: string;
  }[];
}

/** Composes, derives and evaluates a shape; every participant's input is asked of the real machine. */
export function composeAndDerive(
  plan: CompositionDraftPlan,
  artifacts: readonly Pick<Artifact, 'composition'>[],
  roots: readonly FrameRequest[],
): ShapeOutcome {
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts, plan });
  const derived = deriveComposition(roots, host);
  requireLearnedViews(draft);
  const program = draft.programFor(plan.masters[0]!.master);
  const vm: VirtualMachine = compositionMachine();
  const contractInputs = draft.layout.participants.map((placed) => ({ id: placed.id, index: placed.index }));
  const verdicts = contractInputs.map((input) => {
    const state = vm.evaluate({
      inputIndex: input.index,
      sourceOutputs: program.sourceOutputs,
      transaction: program.transaction,
    });
    return vm.stateSuccess(state) === true
      ? { index: input.index, participant: input.id, accepted: true }
      : { index: input.index, participant: input.id, accepted: false, objection: String(state.error) };
  });
  return {
    draft,
    completed: derived.completed,
    transaction: program.transaction,
    contractInputs,
    verdicts,
  };
}

/** A root request for one entry of one contract, as the derivation driver takes it. */
export function rootOf(contract: string, entry: string, masterId: string): FrameRequest {
  return { contract, functionName: entryName(contract, entry), kind: FrameKind.ROOT, master: masterId };
}
