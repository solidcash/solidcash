import {
  decodePushdataValue, type AbiFunction, type Artifact, type ExternalCallExpression, type FixedBchTransferAbi,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import { artifactUsesSolidityAbi } from '../stateful/solidityAbi.js';
import { evaluateChildDeploymentRecipe } from './compose-recipes.js';
import { loadFixedEffectEntries } from './fixed-effect-entries.js';
import { evaluateFixedEffectPredicate } from './message-bus.js';

/** Decode only the exact compiler-described row bytes; malformed rows cannot suppress a resource. */
export function decodeSelectedHandlerArguments(
  artifact: Artifact, selector: string, bytes: Uint8Array,
): FunctionArgument[] | undefined {
  const handlers = artifact.messageBus?.handlers.filter((handler) => handler.eligible
    && handler.selector.toLowerCase() === selector.toLowerCase());
  if (handlers?.length !== 1) return undefined;
  let cursor = 0;
  const args: FunctionArgument[] = [];
  try {
    for (const input of handlers[0].inputs) {
      const decoded = decodePushdataValue(bytes, cursor, input.type, artifact.structs ?? artifact.stateLayout?.structs);
      args.push(decoded.value as FunctionArgument);
      cursor += decoded.bytesConsumed;
    }
  } catch {
    return undefined;
  }
  return cursor === bytes.length ? args : undefined;
}

/**
 * A handler that reads `msg.value` authenticates it against the co-spent satoshi container, so an inactive
 * transfer branch must still publish the pass-through container that a taken `require(msg.value == 0)` reads.
 */
function handlerAuthenticatesMsgValue(artifact: Artifact, selector: string | undefined): boolean {
  if (selector === undefined) return false;
  return (artifact.messageBus?.handlers ?? []).some((handler) => handler.eligible === true
    && handler.usesMsgValue === true && handler.selector.toLowerCase() === selector.toLowerCase());
}

/** Narrow a shared route resource only from every selected handler's exact compiler-published layout. */
export function selectedSatoshiContainerRequired(
  artifact: Artifact,
  selectors: readonly (string | undefined)[],
  rowArguments?: readonly (readonly FunctionArgument[] | undefined)[],
  evaluatePredicate: (expression: ExternalCallExpression, args: readonly FunctionArgument[],
    handler: AbiFunction) => unknown = (expression, args) => evaluateFixedEffectPredicate(expression, args),
  evaluateAmount: (transfer: FixedBchTransferAbi, args: readonly FunctionArgument[],
    handler: AbiFunction) => unknown = () => undefined,
): boolean | undefined {
  const handlers = selectors.map((selector) => {
    const matches = selector === undefined ? [] : artifact.abi.filter((candidate) =>
      candidate.selector?.toLowerCase() === selector.toLowerCase());
    return matches.length === 1 ? matches[0] : undefined;
  });
  if (handlers.some((handler) => handler?.blockLayout === undefined)) return undefined;
  return handlers.some((handler, index) => {
    const required = (handler!.transferCount ?? 0) > 0
      || handler!.blockLayout!.slots.some((slot) => slot.kind === 'satoshiContainer');
    if (!required) return false;
    // A msg.value handler authenticates its taken branch against the container, so an inactive transfer must
    // not drop it: the container stays co-spent as a pass-through instead of satisfying `msg.value == 0`
    // vacuously. Handlers that never read msg.value keep the reached-transfer narrowing below.
    if (handlerAuthenticatesMsgValue(artifact, selectors[index])) return true;
    const args = rowArguments?.[index];
    const transfers = handler!.transfers;
    // Omit a union resource only when every published transfer is provably inactive from immutable row
    // arguments or an explicit authenticated context. Incomplete metadata and runtime loops remain conservative.
    if (!args || !transfers?.length || transfers.length !== handler!.transferCount
      || (handler!.runtimeLoopTransfers?.length ?? 0) > 0) return true;
    return transfers.some((transfer) => {
      if (transfer.condition && evaluatePredicate(transfer.condition, args, handler!) === false) return false;
      // A zero-value recipe owns no BCH output. Keep unknown values conservative; the completed transaction's
      // covenant VM remains the authority if a prior same-transaction write makes the effect reachable.
      return evaluateAmount(transfer, args, handler!) !== 0n;
    });
  });
}

type Selection = {
  artifact: Artifact;
  selectors: readonly (string | undefined)[];
  args: readonly (readonly FunctionArgument[] | undefined)[];
};
type StateHost = Parameters<typeof loadFixedEffectEntries>[2] & {
  getState(): Promise<unknown>;
};

/** Resolve incoming-state predicates before loading resources. The covenant still authenticates branch activity. */
export async function resolveSelectedSatoshiContainerRequired(
  { artifact, selectors, args }: Selection, host: StateHost,
): Promise<boolean | undefined> {
  const initial = selectedSatoshiContainerRequired(artifact, selectors, args);
  if (initial !== true) return initial;
  const transfers = selectors.flatMap((selector) => artifact.abi
    .filter((handler) => handler.selector?.toLowerCase() === selector?.toLowerCase())
    .flatMap((handler) => handler.transfers ?? []));
  const recipes = transfers.flatMap((transfer) => [transfer.condition?.fixedEffectRecipe, transfer.amountRecipe]);
  // Keep the argument-only path for old/unrelated handlers and avoid unnecessary state/provider queries.
  if (!recipes.some((recipe) => recipe !== undefined)
    && !transfers.some((transfer) => transfer.amount.kind === 'literal' && transfer.amount.value === '0')) {
    return initial;
  }
  const state = await host.getState() as Readonly<Record<string, FunctionArgument>>;
  const entries = await loadFixedEffectEntries(recipes, artifact, host);
  const hasLogicalCaller = (value: unknown): boolean => !!value && typeof value === 'object'
    && ((value as { kind?: string }).kind === 'logicalCaller' || Object.values(value).some(hasLogicalCaller));
  return selectedSatoshiContainerRequired(artifact, selectors, args, (expression, rowArgs, handler) => {
    if (expression.kind !== 'fixedEffectRecipe' || !expression.fixedEffectRecipe) {
      return evaluateFixedEffectPredicate(expression, rowArgs, state);
    }
    // A participant may have several graph callers. Do not substitute one physical frame's caller for every row.
    if (hasLogicalCaller(expression.fixedEffectRecipe)) return undefined;
    const result = evaluateChildDeploymentRecipe(expression.fixedEffectRecipe, rowArgs,
      handler.inputs.map((input) => input.type), artifactUsesSolidityAbi(artifact), state, undefined, entries);
    return typeof result === 'boolean' ? result : undefined;
  }, (transfer, rowArgs, handler) => {
    // The typed recipe overrides the ABI's provisional amount source, matching transfer materialization.
    if (transfer.amountRecipe) {
      if (hasLogicalCaller(transfer.amountRecipe)) return undefined;
      try {
        const value = evaluateChildDeploymentRecipe(transfer.amountRecipe, rowArgs,
          handler.inputs.map((input) => input.type), artifactUsesSolidityAbi(artifact), state, undefined, entries);
        return typeof value === 'bigint' ? value : undefined;
      } catch {
        return undefined;
      }
    }
    return transfer.amount.kind === 'literal' && transfer.amount.value !== undefined
      ? BigInt(transfer.amount.value) : undefined;
  });
}

// Bind only rows decoded from the canonical envelope, never the caller's mutable rowArguments annotations.
// This provenance is private runtime state, not a serialized artifact flag or a caller-provided skip override.
const routeSelections = new WeakMap<AbiFunction, Selection>();
export function bindSatoshiContainerSelection(route: AbiFunction, selection: Selection): void {
  routeSelections.set(route, { ...selection, selectors: [...selection.selectors], args: structuredClone(selection.args) });
}

export async function resolveSatoshiContainerRouteAbi(
  route: AbiFunction | undefined, host: StateHost,
): Promise<AbiFunction | undefined> {
  const selection = route && routeSelections.get(route);
  if (!selection) return route;
  const required = await resolveSelectedSatoshiContainerRequired(selection, host);
  if (required !== false) return route;
  // The batch planner may have already narrowed this framed route from the same authenticated row envelope.
  // Preserve its object identity in that case: other route capabilities (including the journal read carrier)
  // bind their authority to that exact object, and a redundant spread would silently discard it.
  if (route!.transferCount === 0
    && (route as AbiFunction & { messageBusActiveSatoshiContainer?: boolean })
      .messageBusActiveSatoshiContainer === false) return route;
  return { ...route!, transferCount: 0, messageBusActiveSatoshiContainer: false } as AbiFunction;
}
