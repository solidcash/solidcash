/**
 * Planning the external calls an implementation frame makes through the proxy hop.
 *
 * A per-call body binds each external call to the k-th record of its own witness block, and that record has to
 * carry the callee's frame kind, its target, its argument digest and its result. The hop's delegate frame is a
 * body like any other, so when the entry it runs makes calls the plan states the same records a call the composer
 * builds for itself does — the calls, and the callee frames they reach. A callee frame is a body too, so a callee
 * whose own entry makes calls is planned the same way, transitively: its records are stated and its own callees are
 * placed.
 *
 * The artifact already publishes the facts: the entry's stop sites (`composition.stopSites`, one `call` site per
 * external call in execution order) and the ABI's routing for that call (interface, method, target, argument
 * sources). `call-resolution.ts` turns a routing row into the target, the argument pushes and the frame kind, from
 * the caller's own arguments, state and frame addresses. Which live deployment a callee runs on is read from the
 * address the entry's own code computes — the provider's registered deployments, or the caller's named externals —
 * and, when the address names none, from the interface the site calls.
 *
 * The occurrence the source publishes decides how many records the site fills: a `conditional` site always fills
 * one, and a `loop` site fills as many as its iteration domain reaches against the caller's own arguments. A
 * contract is placed once: the composition gives each contract one block, so a contract a call reaches twice — or
 * reaches below itself — is refused by name.
 *
 * What this module derives is what the plan states, never a coordinate: the layout, the caller references and the
 * callee indices stay the composer's. A shape the hop cannot declare — a target no route names, an argument only
 * the running execution holds, a loop width the caller's facts do not fix — is refused by name.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  bytesEqual,
  bytesToHex,
  parsePushdataCommitment,
  validatorAddress,
  type Artifact,
  type ExternalCallAbi,
  type FrameKindValue,
  type StateLayout,
} from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  findDeploymentByAddress, findDeploymentByLockingBytecode, findDeploymentByName,
} from '../../stateful/deployment-registry.js';
import type { DraftCall } from '../composer/draft.js';
import { readPublishedStopSites } from '../composer/index.js';
import { deployMaster, type DeployedMaster } from '../deploy/material.js';
import { readPerCallDeployment, stateRecordLockingBytecode } from '../deploy/records.js';
import {
  entryRowOf, makeCallResolver, resolveCallTarget, resolvePublishedCall,
  type CallResolver, type HopCallInputs,
} from './call-resolution.js';
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
  /** The calls this callee's own entry makes, in execution order, whose callees are other frames of the plan. */
  readonly calls: readonly DraftCall[];
  /** Index in `callees` of the master that calls this callee, or null for the implementation's own master. */
  readonly enteredBy: number | null;
}

/** What the implementation frame's calls and the callee frames they reach are planned as. */
export interface HopExternalPlan {
  readonly calls: readonly DraftCall[];
  readonly callees: readonly HopCallee[];
  /** The live UTXO of every callee participant, keyed by the id the plan places it under. */
  readonly utxos: ReadonlyMap<string, Utxo>;
}

/** The entry's ABI routing, refusing an artifact that publishes none for it. */
function routingOf(artifact: Artifact, functionName: string): readonly ExternalCallAbi[] {
  const row = entryRowOf(artifact, functionName);
  return (row as { readonly externalCalls?: readonly ExternalCallAbi[] }).externalCalls ?? [];
}

/**
 * How many records one published site fills.
 *
 * A `once` or `conditional` site reaches its record exactly once. A `loop` site fills the records its visits do:
 * the domain's recurrence is evaluated against the caller's own arguments, so a loop bounded by a forwarded
 * array's length fills that length and a loop bounded by a literal fills that count. A domain whose condition the
 * caller's facts do not fix — one that reads an earlier call's result, for instance — is refused by name, because
 * the plan would not know the run's width.
 */
function occurrenceCountOf(row: ExternalCallAbi, resolver: CallResolver, where: string): number {
  if ((row.occurrence ?? 'once') !== 'loop') return 1;
  const domain = row.iterationDomain;
  if (domain === undefined) {
    throw new PerCallProxyDeployError(
      `${where} runs a loop, and the artifact publishes no iteration domain to read its width from`,
    );
  }
  const initial = resolver.evaluate(domain.initialValue, 0);
  const step = resolver.evaluate(domain.stepValue, 0);
  if (typeof initial !== 'bigint' || typeof step !== 'bigint') {
    throw new PerCallProxyDeployError(
      `${where} runs a loop whose counter the caller's own arguments do not fix`,
    );
  }
  if (step === 0n) {
    throw new PerCallProxyDeployError(`${where} runs a loop whose counter never advances`);
  }
  let count = 0;
  let counter = initial;
  for (let turn = 0; turn < domain.maximumIterations; turn += 1) {
    const bindings = new Map<string, FunctionArgument>([[domain.counterName, counter]]);
    const keep = resolver.evaluate(domain.continueCondition, 0, bindings);
    if (keep === undefined) {
      throw new PerCallProxyDeployError(
        `${where} runs a loop whose bound is not fixed by the caller's own arguments, so the hop cannot state how `
        + 'many records its visits fill',
      );
    }
    if (!keep) break;
    count += 1;
    counter += step;
  }
  return count;
}

/** The live state a callee's records hold, keyed by field name, as its own body reads it. */
function liveStateValues(layout: StateLayout, commitments: readonly Uint8Array[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  commitments.forEach((commitment, nftIndex) => {
    Object.assign(values, parsePushdataCommitment(bytesToHex(commitment), layout, nftIndex));
  });
  return values;
}

/** The live deployment a registered contract names, read from its artifact and category. */
function externalOfRegistered(registered: {
  readonly contract: unknown;
}): PerCallProxyExternal | undefined {
  const contract = registered.contract as {
    readonly artifact?: Artifact;
    readonly inner?: { readonly artifact?: Artifact };
    readonly categoryId?: string;
    readonly proxy?: { readonly categoryId?: string };
  };
  const artifact = contract.inner?.artifact ?? contract.artifact;
  const categoryId = contract.proxy?.categoryId ?? contract.categoryId;
  return artifact === undefined || categoryId === undefined ? undefined : { artifact, categoryId };
}

/** The deployment one call's target address names, from the provider's registrations. */
function externalOfAddress(provider: NetworkProvider, target: Uint8Array): PerCallProxyExternal | undefined {
  const registered = findDeploymentByLockingBytecode(provider, binToHex(target))
    ?? findDeploymentByAddress(provider, binToHex(target));
  return registered === undefined ? undefined : externalOfRegistered(registered);
}

/** The deployment a call's interface names, stripping the Solidity interface's leading `I`. */
function externalOfName(provider: NetworkProvider, interfaceName: string): PerCallProxyExternal | undefined {
  for (const name of [interfaceName, interfaceName.replace(/^I/, '')]) {
    const registered = findDeploymentByName(provider, name);
    if (registered === undefined) continue;
    const external = externalOfRegistered(registered);
    if (external !== undefined) return external;
  }
  return undefined;
}

/** The planner's running state: the live deployments it resolves against and the frames it has placed. */
interface PlanContext {
  readonly provider: NetworkProvider;
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly validatorProgram: Uint8Array;
  /** Contract names already placed; a composition gives each contract one block, so a second is refused. */
  readonly contracts: Set<string>;
  /** Callee frames in placement order; a slot is reserved before the callee's own calls are planned. */
  readonly callees: HopCallee[];
  readonly utxos: Map<string, Utxo>;
}

/** The deployment a call reaches: the caller's named externals first, then the provider's registrations. */
function resolveExternal(ctx: PlanContext, row: ExternalCallAbi, target: Uint8Array): PerCallProxyExternal {
  const named = ctx.externals[row.interfaceName];
  if (named !== undefined) return named;
  const atTarget = Object.values(ctx.externals).find((candidate) =>
    bytesEqual(validatorAddress(hexToBin(candidate.categoryId), ctx.validatorProgram), target));
  if (atTarget !== undefined) return atTarget;
  const external = externalOfAddress(ctx.provider, target)
    ?? externalOfName(ctx.provider, row.interfaceName);
  if (external === undefined) {
    throw new PerCallProxyDeployError(
      `the call to "${row.interfaceName}.${row.functionName}" targets ${binToHex(target)}, and none of the `
      + "deployment's contracts sits at that address",
    );
  }
  return external;
}

/**
 * Plans the calls one entry's body makes, and — transitively — the frames each of them reaches.
 *
 * The caller's own facts (its arguments, its state, its own address and its sender) are what each call site is
 * resolved from, and the live records of each callee are read so the callee's own call sites resolve from *its*
 * facts. `enteredBy` is the index in `ctx.callees` of the master that calls this entry, or null for the
 * implementation's own master; the frames this entry reaches are appended to `ctx.callees`.
 *
 * The whole entry is validated before any live record is read: every call site's target, frame kind, record count
 * and argument pushes are resolved first, so a shape the hop cannot declare is refused without depending on a
 * deployment. Only then is each callee's live deployment read, and its own calls planned from it.
 */
async function planEntryCalls(
  ctx: PlanContext,
  caller: HopCallInputs,
  enteredBy: number | null,
): Promise<DraftCall[]> {
  const identity = `${caller.artifact.contractName}.${caller.functionName}()`;
  const published = readPublishedStopSites(caller.artifact).entries
    .find((entry) => entry.functionName === identity);
  if (published === undefined || published.calls.length === 0) return [];
  const routing = routingOf(caller.artifact, caller.functionName);
  const resolver = makeCallResolver(caller);

  // Pass one: resolve every site of this entry from the caller's own facts, so the plan is refused for its own
  // shape before any live record is read.
  const sites = published.calls.map((call, index) => {
    const row = routing[index];
    if (row === undefined || row.interfaceName !== call.interfaceName
      || row.functionName !== call.functionName) {
      throw new PerCallProxyDeployError(
        `the entry "${caller.functionName}" publishes call ${index} to `
        + `"${call.interfaceName}.${call.functionName}", which its ABI routing does not describe`,
      );
    }
    // The stop site's baked target is the address the compiler pinned into the caller's own code; the ABI routing
    // carries it as `addressLiteral` for a literal and leaves it empty for one the caller computes.
    const effective: ExternalCallAbi = row.addressLiteral === undefined && call.target.length > 0
      ? { ...row, addressLiteral: call.target }
      : row;
    const where = `the call to "${row.interfaceName}.${row.functionName}"`;
    const target = resolveCallTarget(effective, caller, resolver, 0);
    const external = resolveExternal(ctx, row, target);
    const entry = entryRowOf(external.artifact, row.functionName);
    const count = occurrenceCountOf(row, resolver, where);
    const resolved = Array.from({ length: count }, (_unused, occurrence) => (
      resolvePublishedCall(effective, external.artifact, caller, resolver, occurrence)
    ));
    if (ctx.contracts.has(external.artifact.contractName)) {
      throw new PerCallProxyDeployError(
        `${where} reaches "${external.artifact.contractName}", which this hop already places; a contract that `
        + 'reaches itself below itself, or is reached twice, cannot be given the one block a composition holds per '
        + 'contract',
      );
    }
    ctx.contracts.add(external.artifact.contractName);
    return { entry, external, resolved };
  });

  // Pass two: read each callee's live deployment, plan its own calls from the values that deployment holds, and
  // place its frame.
  const calls: DraftCall[] = [];
  for (const site of sites) {
    const { external, entry, resolved } = site;
    const category = hexToBin(external.categoryId);
    const layout = external.artifact.stateLayout ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
    const deployment = await readPerCallDeployment(ctx.provider, external.categoryId, layout);
    const masterUtxo = deployment.masters[0];
    if (masterUtxo === undefined) {
      throw new PerCallProxyDeployError(
        `the callee's category ${external.categoryId} holds no master, which the call's frame runs on`,
      );
    }
    const calleeIndex = ctx.callees.length;
    const master = `callee-master-${calleeIndex + 1}`;
    const records = Array.from(
      { length: layout.dataNftCount },
      (_unused, nftIndex): HopCalleeRecord => {
        const utxo = deployment.records[nftIndex];
        const commitment = utxo?.token?.nft?.commitment;
        if (utxo === undefined || commitment === undefined) {
          throw new PerCallProxyDeployError(
            `the callee's category ${external.categoryId} holds no record at data NFT ${nftIndex}`,
          );
        }
        return {
          id: `${master}-record-${nftIndex}`,
          commitment: new Uint8Array(hexToBin(commitment)),
          satoshis: utxo.satoshis,
          lockingBytecode: stateRecordLockingBytecode(external.categoryId),
        };
      },
    );
    const masterUtxos = new Map<string, Utxo>([[master, masterUtxo]]);
    records.forEach((record, nftIndex) => masterUtxos.set(record.id, deployment.records[nftIndex]!));
    const deployed = deployMaster(external.artifact, category, ctx.validatorProgram);
    const base: HopCallee = {
      master,
      contract: external.artifact.contractName,
      entry: entry.name,
      functionName: `${external.artifact.contractName}.${entry.name}()`,
      artifact: external.artifact,
      category,
      categoryId: external.categoryId,
      deployed,
      kind: resolved[0]!.kind,
      masterSatoshis: masterUtxo.satoshis,
      returns: (entry.outputs ?? []).length > 0,
      records,
      utxos: masterUtxos,
      calls: [],
      enteredBy,
    };
    // Reserve the slot before planning the callee's own calls, so a frame it reaches names this master as its
    // caller and sits after it.
    ctx.callees.push(base);
    const nested = await planEntryCalls(ctx, {
      artifact: external.artifact,
      functionName: entry.name,
      args: resolved[0]!.argumentValues,
      stateValues: liveStateValues(layout, records.map((record) => record.commitment)),
      selfAddress: deployed.address,
      ...(caller.selfAddress === undefined ? {} : { senderAddress: caller.selfAddress }),
    }, calleeIndex);
    ctx.callees[calleeIndex] = { ...base, calls: nested };
    for (const [id, utxo] of masterUtxos) ctx.utxos.set(id, utxo);

    for (const record of resolved) {
      calls.push({
        kind: record.kind, callee: master, target: record.target, value: 0n,
        argumentPushes: record.argumentPushes,
      });
    }
  }
  return calls;
}

/** Everything the implementation frame's calls are planned from, and the live deployments they run against. */
export interface HopExternalPlanOptions {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  /** The caller's named deployments, keyed by the interface each call reaches. */
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly validatorProgram: Uint8Array;
  /** The caller's own state, keyed by field name, as its body reads it. Defaults to empty. */
  readonly stateValues?: Readonly<Record<string, unknown>>;
  /** The caller's own locking bytecode, i.e. `address(this)`. */
  readonly selfAddress?: Uint8Array;
  /** The frame's own `msg.sender`. */
  readonly senderAddress?: Uint8Array;
  readonly constructorArgs?: readonly FunctionArgument[];
}

/**
 * Plans the calls one implementation entry makes and the callee frames they reach, transitively.
 *
 * The published stop sites give the calls in execution order and the ABI routing gives each call its target and
 * argument sources; `externals` names the live deployment each callee runs on, and the provider's registrations are
 * the fallback. Each callee's live records are read so that a callee whose own entry makes calls is planned from
 * its own facts. A shape the hop cannot declare is refused by name, and a contract reached twice is refused.
 */
export async function planHopExternalCalls(
  options: HopExternalPlanOptions,
): Promise<HopExternalPlan> {
  const ctx: PlanContext = {
    provider: options.provider,
    externals: options.externals,
    validatorProgram: options.validatorProgram,
    contracts: new Set([options.artifact.contractName]),
    callees: [],
    utxos: new Map(),
  };
  const calls = await planEntryCalls(ctx, {
    artifact: options.artifact,
    functionName: options.functionName,
    args: options.args,
    stateValues: options.stateValues ?? {},
    ...(options.selfAddress === undefined ? {} : { selfAddress: options.selfAddress }),
    ...(options.senderAddress === undefined ? {} : { senderAddress: options.senderAddress }),
    ...(options.constructorArgs === undefined ? {} : { constructorArgs: options.constructorArgs }),
  }, null);
  return { calls, callees: ctx.callees, utxos: ctx.utxos };
}
