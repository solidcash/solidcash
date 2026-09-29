/**
 * Planning the external calls an implementation frame makes through the proxy hop.
 *
 * A per-call body binds each external call to the k-th record of its own witness block, and that record has to
 * carry the callee's frame kind, its target, its argument digest and its result. The hop's delegate frame is a
 * body like any other, so when the entry it runs makes calls the plan states the same records a call the composer
 * builds for itself does — the calls, and the callee frames they reach.
 *
 * The artifact already publishes the facts: the entry's stop sites (`composition.stopSites`, one `call` site per
 * external call in execution order) and the ABI's routing for that call (interface, method, target, argument
 * sources). The callee's own artifact names the entry the call reaches, and its `view`/`pure` marker is the frame
 * kind the caller's code pins. Which live deployment a callee runs on is the caller's to name, keyed by the
 * interface the site calls; a call whose callee the caller does not name is refused rather than guessed at.
 *
 * What this module derives is what the plan states, never a coordinate: the layout, the caller references and the
 * callee indices stay the composer's. A callee shape whose frame the hop cannot declare — a target the caller's
 * own code computes, an occurrence the source does not fix, a callee that makes its own calls, an argument only
 * the running execution holds — is refused by name.
 */

import { hexToBin } from '@bitauth/libauth';
import {
  FrameKind,
  bytesEqual,
  validatorAddress,
  type Artifact,
  type FrameKindValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import type { DraftCall } from '../composer/draft.js';
import { readPublishedStopSites } from '../composer/index.js';
import { deployMaster, type DeployedMaster } from '../deploy/material.js';
import { readPerCallDeployment, stateRecordLockingBytecode } from '../deploy/records.js';
import { PerCallProxyDeployError } from './errors.js';

/** One contract the caller names for a call an implementation entry makes, keyed by the interface it calls. */
export interface PerCallProxyExternal {
  readonly artifact: Artifact;
  readonly categoryId: string;
}

/** One record a callee frame reads, with the live UTXO it sits on. */
export interface HopCalleeRecord {
  readonly id: string;
  readonly commitment: Uint8Array;
  readonly satoshis: bigint;
  readonly lockingBytecode: Uint8Array;
}

/** One callee frame the hop runs: the master, the live records it reads, and the UTXO each participant sits on. */
export interface HopCallee {
  readonly master: string;
  readonly contract: string;
  /** The ABI name of the entry the call reaches. */
  readonly entry: string;
  /** The published entry identity, `Contract.entry()`, matching the stop-site table. */
  readonly functionName: string;
  readonly artifact: Artifact;
  /** The callee's category, as the token category bytes and as the hex its records' covenant names. */
  readonly category: Uint8Array;
  readonly categoryId: string;
  readonly deployed: DeployedMaster;
  readonly kind: FrameKindValue;
  /** The satoshi value the callee's live master carries, which its input recreates. */
  readonly masterSatoshis: bigint;
  /** True when the entry returns a value, so the frame's `retval` is a candidate the derivation learns. */
  readonly returns: boolean;
  readonly records: readonly HopCalleeRecord[];
  /** Every participant of this callee, keyed by the id the plan places it under. */
  readonly utxos: ReadonlyMap<string, Utxo>;
}

/** What the implementation frame's calls and the callee frames they reach are planned as. */
export interface HopExternalPlan {
  readonly calls: readonly DraftCall[];
  readonly callees: readonly HopCallee[];
  /** The live UTXO of every callee participant, keyed by the id the plan places it under. */
  readonly utxos: ReadonlyMap<string, Utxo>;
}

/** The ABI routing fields a call is planned from. */
interface ExternalCallRow {
  readonly interfaceName: string;
  readonly functionName: string;
  readonly occurrence?: 'once' | 'conditional' | 'loop';
  readonly argSources?: readonly {
    readonly kind: string;
    readonly paramIndex?: number;
    readonly value?: string;
    readonly type?: string;
  }[];
}

/** The ABI fields one callee entry is read from. */
interface CalleeEntryRow {
  readonly name: string;
  readonly selector?: string;
  readonly inputs: readonly { readonly name: string; readonly type: string }[];
  readonly outputs?: readonly { readonly type: string }[];
  readonly modifiers?: readonly string[];
  readonly externalCalls?: readonly unknown[];
}

/** The entry's ABI routing, refusing an artifact that publishes none for it. */
function routingOf(artifact: Artifact, functionName: string): readonly ExternalCallRow[] {
  const row = artifact.abi.find((candidate) => candidate.name === functionName);
  if (row === undefined) {
    throw new PerCallProxyDeployError(
      `implementation "${artifact.contractName}" publishes no entry "${functionName}"`,
    );
  }
  return (row as { readonly externalCalls?: readonly ExternalCallRow[] }).externalCalls ?? [];
}

/** The callee artifact's row for the entry a call reaches, refusing one it does not publish. */
function calleeRowOf(artifact: Artifact, functionName: string): CalleeEntryRow {
  const row = artifact.abi.find((candidate) => candidate.name === functionName);
  if (row === undefined) {
    throw new PerCallProxyDeployError(
      `the callee "${artifact.contractName}" publishes no entry "${functionName}", so the hop cannot declare `
      + 'the frame the call reaches',
    );
  }
  return row as CalleeEntryRow;
}

/** The external a published call reaches: the one keyed by its interface, or the one at the target address. */
function externalOf(
  call: { readonly interfaceName: string; readonly target: string },
  externals: Readonly<Record<string, PerCallProxyExternal>>,
  validatorProgram: Uint8Array,
): PerCallProxyExternal | undefined {
  const named = externals[call.interfaceName];
  if (named !== undefined) return named;
  const target = new Uint8Array(hexToBin(call.target));
  if (target.length === 0) return undefined;
  return Object.values(externals).find((candidate) =>
    bytesEqual(validatorAddress(hexToBin(candidate.categoryId), validatorProgram), target));
}

/**
 * The frame kind the caller's own code pins for a call: a `view` or `pure` callee runs as a `STATIC` frame.
 *
 * The caller compiled that equality against its interface's own declaration, so the callee's artifact is what the
 * hop reads the marker back from.
 */
function frameKindOf(row: CalleeEntryRow): FrameKindValue {
  const readOnly = (row.modifiers ?? []).some((modifier) => modifier === 'view' || modifier === 'pure');
  return readOnly ? FrameKind.STATIC : FrameKind.CALL;
}

/** One argument as the routing serialized it, in the form the shared encoder takes. */
function literalArgument(value: string, type: string): FunctionArgument {
  if (type === 'bool') return value === 'true' || value === '1';
  if (type === 'string') return value;
  if (type.startsWith('bytes') || type === 'address') return new Uint8Array(hexToBin(value));
  return BigInt(value);
}

/**
 * The argument pushes one call carries: the selector, then each argument's canonical push, the first parameter's
 * last.
 *
 * These become the record's digest and the callee's call data alike, so they are resolved the way the body
 * resolves them — a forwarded entry argument, or a literal the routing serialized. An argument only the running
 * execution holds is refused, because the plan would have no value to state.
 */
function argumentPushesOf(
  routing: ExternalCallRow,
  row: CalleeEntryRow,
  args: readonly FunctionArgument[],
  structs: Artifact['structs'],
): Uint8Array[] {
  const inputs = row.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const sources = routing.argSources ?? [];
  if (sources.length !== inputs.length) {
    throw new PerCallProxyDeployError(
      `the call to "${routing.interfaceName}.${routing.functionName}" takes ${inputs.length} argument(s), but the `
      + `artifact publishes sources for ${sources.length}, so the hop cannot state their digest`,
    );
  }
  const encoded = sources.map((source, index): Uint8Array => {
    if (source.kind === 'literal') {
      return encodeFunctionArgument(
        literalArgument(source.value ?? '', source.type ?? ''), inputs[index]!.type, structs,
      ) as Uint8Array;
    }
    if (source.kind === 'forward' && source.paramIndex !== undefined) {
      const value = args[source.paramIndex];
      if (value === undefined) {
        throw new PerCallProxyDeployError(
          `the call to "${routing.interfaceName}.${routing.functionName}" forwards argument `
          + `${source.paramIndex}, which the hop's own call does not carry`,
        );
      }
      return encodeFunctionArgument(value, inputs[index]!.type, structs) as Uint8Array;
    }
    throw new PerCallProxyDeployError(
      `the call to "${routing.interfaceName}.${routing.functionName}" passes an argument only the running `
      + `execution holds (${source.kind}), so the hop cannot state the record's digest`,
    );
  });
  const selector = row.selector;
  if (selector === undefined) {
    throw new PerCallProxyDeployError(
      `the callee entry "${row.name}" publishes no selector, so the call carries no call data`,
    );
  }
  return [new Uint8Array(hexToBin(selector)), ...[...encoded].reverse()];
}

/** Everything the implementation frame's calls are planned from, and the live deployments they run against. */
export interface HopExternalPlanOptions {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly validatorProgram: Uint8Array;
}

/**
 * Plans the calls one implementation entry makes and the callee frames they reach.
 *
 * The published stop sites give the calls in execution order and the ABI routing gives each call its target and
 * argument sources; `externals` names the live deployment each callee runs on. The whole entry is checked before
 * any chain state is read, so a hop that cannot be planned is refused without depending on a deployment.
 */
export async function planHopExternalCalls(
  options: HopExternalPlanOptions,
): Promise<HopExternalPlan> {
  const published = readPublishedStopSites(options.artifact).entries
    .find((entry) => entry.functionName === `${options.artifact.contractName}.${options.functionName}()`);
  if (published === undefined || published.calls.length === 0) {
    return { calls: [], callees: [], utxos: new Map() };
  }
  const routing = routingOf(options.artifact, options.functionName);

  // The whole entry is validated first: which call reaches which contract, what frame each runs as, and what its
  // call data is. A shape the hop cannot declare is refused here, before either genesis or any live record is read.
  const planned = published.calls.map((call, index) => {
    const source = routing[index];
    if (source === undefined || source.interfaceName !== call.interfaceName
      || source.functionName !== call.functionName) {
      throw new PerCallProxyDeployError(
        `the entry "${options.functionName}" publishes call ${index} to `
        + `"${call.interfaceName}.${call.functionName}", which its ABI routing does not describe`,
      );
    }
    if (source.occurrence !== undefined && source.occurrence !== 'once') {
      throw new PerCallProxyDeployError(
        `the call to "${call.interfaceName}.${call.functionName}" runs ${source.occurrence}, and the hop declares `
        + 'one record per call the source fixes',
      );
    }
    if (call.target.length === 0) {
      throw new PerCallProxyDeployError(
        `the call to "${call.interfaceName}.${call.functionName}" targets an address the caller's own code `
        + 'computes, which the hop does not read back out of its frame',
      );
    }
    const external = externalOf(call, options.externals, options.validatorProgram);
    if (external === undefined) {
      throw new PerCallProxyDeployError(
        `the call to "${call.interfaceName}.${call.functionName}" targets ${call.target}, and none of the `
        + "deployment's contracts sits at that address",
      );
    }
    const row = calleeRowOf(external.artifact, call.functionName);
    if ((row.externalCalls?.length ?? 0) > 0) {
      throw new PerCallProxyDeployError(
        `the callee "${external.artifact.contractName}.${call.functionName}()" makes its own external calls, `
        + 'which the hop does not plan below this one',
      );
    }
    return {
      external,
      row,
      target: new Uint8Array(hexToBin(call.target)),
      argumentPushes: argumentPushesOf(source, row, options.args, options.artifact.structs),
      kind: frameKindOf(row),
    };
  });

  const contracts = new Set(planned.map((call) => call.external.artifact.contractName));
  if (contracts.size !== planned.length) {
    throw new PerCallProxyDeployError(
      "the entry's calls reach one contract more than once, and a composition places one block per contract",
    );
  }

  const calls: DraftCall[] = [];
  const callees: HopCallee[] = [];
  const utxos = new Map<string, Utxo>();
  for (const [index, plan] of planned.entries()) {
    const category = hexToBin(plan.external.categoryId);
    const layout = plan.external.artifact.stateLayout
      ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
    const deployment = await readPerCallDeployment(options.provider, plan.external.categoryId, layout);
    const masterUtxo = deployment.masters[0];
    if (masterUtxo === undefined) {
      throw new PerCallProxyDeployError(
        `the callee's category ${plan.external.categoryId} holds no master, which the call's frame runs on`,
      );
    }
    const master = `callee-master-${index + 1}`;
    const records = Array.from(
      { length: layout.dataNftCount },
      (_unused, nftIndex): HopCalleeRecord => {
        const utxo = deployment.records[nftIndex];
        const commitment = utxo?.token?.nft?.commitment;
        if (utxo === undefined || commitment === undefined) {
          throw new PerCallProxyDeployError(
            `the callee's category ${plan.external.categoryId} holds no record at data NFT ${nftIndex}`,
          );
        }
        return {
          id: `${master}-record-${nftIndex}`,
          commitment: new Uint8Array(hexToBin(commitment)),
          satoshis: utxo.satoshis,
          lockingBytecode: stateRecordLockingBytecode(plan.external.categoryId),
        };
      },
    );
    const masterUtxos = new Map<string, Utxo>([[master, masterUtxo]]);
    records.forEach((record, nftIndex) => masterUtxos.set(record.id, deployment.records[nftIndex]!));
    calls.push({
      kind: plan.kind, callee: master, target: plan.target, value: 0n,
      argumentPushes: plan.argumentPushes,
    });
    callees.push({
      master,
      contract: plan.external.artifact.contractName,
      entry: plan.row.name,
      functionName: `${plan.external.artifact.contractName}.${plan.row.name}()`,
      artifact: plan.external.artifact,
      category,
      categoryId: plan.external.categoryId,
      deployed: deployMaster(plan.external.artifact, category, options.validatorProgram),
      kind: plan.kind,
      masterSatoshis: masterUtxo.satoshis,
      returns: (plan.row.outputs ?? []).length > 0,
      records,
      utxos: masterUtxos,
    });
    for (const [id, utxo] of masterUtxos) utxos.set(id, utxo);
  }
  return { calls, callees, utxos };
}
