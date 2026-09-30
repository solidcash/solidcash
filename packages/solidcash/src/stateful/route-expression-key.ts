/**
 * phase-boundary extract: route expression-key / visible-args / direct-mapping helpers
 * (phase-boundary extract from StatefulContract.ts).
 */

import { binToHex, hexToBin, bigIntToVmNumber, utf8ToBin } from '@bitauth/libauth';
import {
  hash160 as hash160Sync,
  hash256 as hash256Sync,
  ripemd160 as ripemd160Sync,
  sha256 as sha256Sync,
  type AbiFunction, type Artifact, type EntryAccessAbi, type StateValue,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../Argument.js';
import { addressToLockScript } from '../utils.js';
import type { ValueChunkProducerPathDisposition } from './ValueChunkProducerIdentity.js';

/**
 * Auto-evaluate a sorted mapping's COMPUTED key from the artifact's canonical expression label against the call
 * args, for the common hash-builtin + bytes-cast cases (e.g. balances[hash160(pk)] -> hash160(argPk)). This makes
 * a direct computed key resolve WITHOUT a manual withEntryKey (Solidity auto-resolves such keys). Returns
 * undefined when the label is not evaluable (a bare local `id:pkh` with no inlined definition, or an unsupported
 * op); the caller then falls back to entryKeyOverrides / placeholder.
 */
export function evalComputedKey(
  label: string | undefined, args: FunctionArgument[], inputs: readonly { name: string; type?: string }[],
  state?: Readonly<Record<string, StateValue>>,
  stateLengthDeltas?: Readonly<Record<string, bigint>>,
): Uint8Array | undefined {
  if (!label) return undefined;
  const encode = (value: unknown): Uint8Array | undefined => {
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'bigint') return bigIntToVmNumber(value);
    if (typeof value === 'number') return bigIntToVmNumber(BigInt(value));
    if (typeof value === 'boolean') return bigIntToVmNumber(value ? 1n : 0n);
    if (typeof value === 'string') return value.includes(':') ? addressToLockScript(value) : utf8ToBin(value);
    return undefined;
  };
  const splitTopLevel = (s: string): [string, string] | undefined => {
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(' || s[i] === '[' || s[i] === '{') depth++;
      else if (s[i] === ')' || s[i] === ']' || s[i] === '}') depth--;
      else if (s[i] === ',' && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
    }
    return undefined;
  };
  const evalValue = (s: string): unknown => {
    let m = s.match(/^id:(.+)$/);
    if (m) {
      const idx = inputs.findIndex((i) => i.name === m![1]);
      if (idx >= 0) {
        const bound = args[idx];
        // Route frames hand numeric parameters over as JS numbers (and some label paths as decimal strings), while the
        // expression grammar below is numeric: `binop:+` accepts bigints only. Without this normalization an
        // otherwise evaluable key - a dynamic state array indexed by `index_` - silently stays unresolved, and the
        // entry is proven at an empty key instead of the real one.
        if (typeof bound === 'number') return BigInt(bound);
        if (typeof bound === 'string' && /^-?[0-9][0-9_]*$/.test(bound)) return BigInt(bound.replace(/_/g, ''));
        return bound;
      }
      // Uniswap createPair names its sorted locals token0/token1 in vmap expressions. Reconstruct them from the
      // first two visible address arguments; those locals are not ABI parameters and therefore have no direct
      // argument index.
      if (m[1] === 'token0' || m[1] === 'token1') {
        const addressIndices = inputs
          .map((input, index) => ({ input, index }))
          .filter(({ input }) => !input.name.startsWith('__internal__')
            && (input.type === 'address' || input.type?.startsWith('address ') === true))
          .map(({ index }) => index);
        if (addressIndices.length >= 2) {
          const a = encode(args[addressIndices[0]]);
          const b = encode(args[addressIndices[1]]);
          if (a && b) {
            const [token0, token1] = binToHex(a) < binToHex(b) ? [a, b] : [b, a];
            return m[1] === 'token0' ? token0 : token1;
          }
        }
      }
      return undefined;
    }
    m = s.match(/^lit:(.+)$/);
    if (m) {
      if (m[1] === 'true') return true;
      if (m[1] === 'false') return false;
      if (/^-?[0-9][0-9_]*$/.test(m[1])) return BigInt(m[1].replace(/_/g, ''));
      if (/^0x[0-9a-f]*$/i.test(m[1])) return hexToBin(m[1].slice(2));
      return m[1];
    }
    m = s.match(/^const:(-?[0-9][0-9_]*)$/);
    if (m) return BigInt(m[1].replace(/_/g, ''));
    m = s.match(/^state:(.+)$/);
    if (m) return state?.[m[1]];
    m = s.match(/^unop:\.length\((.*)\)$/);
    if (m) {
      const stateRef = m[1].match(/^state:(.+)$/);
      const value = evalValue(m[1]);
      if (Array.isArray(value) || value instanceof Uint8Array || typeof value === 'string') {
        return BigInt(value.length) + (stateRef ? stateLengthDeltas?.[stateRef[1]] ?? 0n : 0n);
      }
      return undefined;
    }
    m = s.match(/^cast:[a-z0-9]+\((.*)\)$/i);
    if (m) return evalValue(m[1]); // a bytes/bytesN cast is identity on the underlying value
    m = s.match(/^arridx\((.*)\)$/);
    if (m) {
      const pair = splitTopLevel(m[1]);
      if (!pair) return undefined;
      const array = evalValue(pair[0]);
      const index = evalValue(pair[1]);
      const n = typeof index === 'bigint' ? Number(index) : typeof index === 'number' ? index : NaN;
      return Array.isArray(array) && Number.isSafeInteger(n) ? array[n] : undefined;
    }
    m = s.match(/^field:([^()]+)\((.*)\)$/);
    if (m) {
      const object = evalValue(m[2]);
      return object && typeof object === 'object' ? (object as Record<string, unknown>)[m[1]] : undefined;
    }
    m = s.match(/^map:([^()]+)\((.*)\)$/);
    if (m) {
      // Indexed collection access: `map:<stateArray>(<index>)`. The compiler publishes this label for an entry key
      // that reads a dynamic state array (a read route's `arbitrators[addresses[i + index_]]`). The array is a state
      // variable, so it must be supplied by the caller; an unavailable array or index keeps the label unresolved and
      // the caller's existing placeholder path applies unchanged.
      const values = state?.[m[1]];
      const index = evalValue(m[2]);
      const n = typeof index === 'bigint' ? Number(index)
        : typeof index === 'number' ? index : NaN;
      if (!Array.isArray(values) || !Number.isSafeInteger(n) || n < 0 || n >= values.length) {
        return undefined;
      }
      const element = values[n];
      if (element instanceof Uint8Array) return element;
      if (typeof element === 'bigint') return bigIntToVmNumber(element);
      if (typeof element === 'boolean') return bigIntToVmNumber(element ? 1n : 0n);
      if (typeof element === 'string' && element.includes(':')) return addressToLockScript(element);
      return undefined;
    }
    m = s.match(/^binop:([^()]+)\((.*)\)$/);
    if (m) {
      const pair = splitTopLevel(m[2]);
      if (!pair) return undefined;
      const left = evalValue(pair[0]);
      const right = evalValue(pair[1]);
      if (typeof left !== 'bigint' || typeof right !== 'bigint') return undefined;
      if (m[1] === '+') return left + right;
      if (m[1] === '-') return left - right;
      if (m[1] === '*') return left * right;
      return undefined;
    }
    m = s.match(/^ternary\((.*)\)$/);
    if (m) {
      const head = splitTopLevel(m[1]);
      const rest = head ? splitTopLevel(head[1]) : undefined;
      if (!head || !rest) return undefined;
      const cond = evalValue(head[0]);
      const taken = cond === true || cond === 1n || cond === 1;
      return evalValue(taken ? rest[0] : rest[1]);
    }
    m = s.match(/^call:(\w+)\((.*)\)$/);
    if (m) {
      // Only a hash's single argument is evaluated: a struct literal's argument list is not one value.
      const hash = { hash160: hash160Sync, ripemd160: ripemd160Sync, sha256: sha256Sync, hash256: hash256Sync }[m[1]];
      if (hash === undefined) return undefined;
      const inner = encode(evalValue(m[2]));
      return inner === undefined ? undefined : hash(inner);
    }
    return undefined;
  };
  return encode(evalValue(label));
}

const ROW_ARGS_DECODE_LABEL = /^AbiDecodeAtNode\{data=id:rowArgs,index=(\d+),schema=\[([^\]]*)\]\}$/;

export interface RouteExpressionKeyRow {
  args: readonly FunctionArgument[];
  /** Exact selected handler selector when transported by a compiler route. */
  selector?: string;
  /** Compiler-owned row arguments which are not encoded as public handler inputs. */
  internalArgs?: Readonly<Record<string, FunctionArgument>>;
  /** Source row template before runtime loop/conditional expansion. */
  sourceLogicalIndex?: number;
  /** Compiler-stable source callsite before repeated-owner collapsing. */
  sourceCallsiteId?: number;
  /** Source loop occurrence represented by this physical route row. */
  occurrenceIndex?: number;
  /** Compiler-authored program point shared by source entry mutations and graph calls. */
  sourceEffectOrdinal?: number;
  /** Exact root-to-row source occurrence transported by the compiled graph. */
  producerPath?: ValueChunkProducerPathDisposition;
  handler: AbiFunction;
}

/** `AbiDecodeAtNode{data=id:rowArgs,index=N,schema=[...]}` → argument index and handler arity. */
export function parseRowArgsDecodeLabel(label: string | undefined): {
  argumentIndex: number;
  schemaArity: number;
} | undefined {
  const decoded = label?.match(ROW_ARGS_DECODE_LABEL);
  if (!decoded) return undefined;
  return {
    argumentIndex: Number(decoded[1]),
    schemaArity: decoded[2] === '' ? 0 : decoded[2].split(',').length,
  };
}

export function visibleHandlerInputs<T extends { name: string }>(inputs: readonly T[]): T[] {
  return inputs.filter((input) => !input.name.startsWith('__internal__'));
}

export function canonicalAbiFunctionSignature(fn: AbiFunction): string {
  return `${fn.name}(${visibleHandlerInputs(fn.inputs).map((input) => input.type).join(',')})`;
}

/** Canonical eight-character form of a four-byte function selector, or `undefined` for anything else. */
function canonicalPreparedSelector(selector: string): string | undefined {
  const normalized = selector.replace(/^0x/i, '').toLowerCase();
  return /^[0-9a-f]{8}$/.test(normalized) ? normalized : undefined;
}

/**
 * Resolve the exact ABI entry point one prepared child invocation executes.
 *
 * Overloads share a name, so the first ABI entry matching a name can name a different dispatch target than the
 * caller meant while still yielding a plausible four-byte selector. Prepared producer identity must never come
 * from a name alone, so authority is taken only from:
 *
 * 1. the selector the compiler published for this callsite, matched together with the function name exactly as
 *    the compiled graph resolves it, or
 * 2. a name whose matching entries all agree on one selector, which makes the name itself exact.
 *
 * A published selector is authoritative when present, so a malformed one, or one no artifact advertises,
 * yields `undefined` rather than falling back to a name: the planner would refuse that pair, and answering it
 * with a different entry would transport authority for the wrong dispatch target. Anything else - no published
 * selector with two distinct overload selectors under one name, or an undeclared name - also yields
 * `undefined`, leaving the caller without authority rather than guessing. The legacy name-based selection still
 * sizes layouts and returns; only this identity is withheld.
 */
export function resolvePreparedProducerEntry(
  artifacts: readonly Artifact[],
  name: string,
  compilerSelector?: string,
): AbiFunction | undefined {
  if (compilerSelector !== undefined) {
    const normalized = canonicalPreparedSelector(compilerSelector);
    if (normalized === undefined) return undefined;
    for (const artifact of artifacts) {
      const exact = artifact.abi.find((candidate) => candidate.name === name
        && candidate.selector?.toLowerCase() === normalized);
      if (exact) return exact;
    }
    return undefined;
  }
  for (const artifact of artifacts) {
    const candidates = artifact.abi.filter((candidate) => candidate.name === name);
    if (candidates.length === 0) continue;
    const selectors = new Set(candidates.map((candidate) => candidate.selector?.toLowerCase() ?? ''));
    if (selectors.size === 1) return candidates[0];
  }
  return undefined;
}

/** Prefer source-level arguments only when they exactly cover the function's visible ABI. */
export function selectVisibleCallArguments<T>(
  inputs: readonly { name: string }[],
  logicalArguments: readonly T[] | undefined,
  fallbackArguments: readonly T[],
): readonly T[] {
  return logicalArguments?.length === visibleHandlerInputs(inputs).length
    ? logicalArguments : fallbackArguments;
}

export interface DirectMappingReadPlan {
  collection: string;
  keyArgumentIndices: readonly number[];
  keyTypes: readonly string[];
}

const canonicalIntegerAbiType = (type: string): string | undefined => {
  if (type === 'uint') return 'uint256';
  if (type === 'int') return 'int256';
  return /^(?:u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)|bigint)$/.test(type)
    ? type : undefined;
};

/** Resolve a direct mapping-return shortcut from compiler proof, never source names. */
export function directMappingReadPlan(
  artifact: Pick<Artifact, 'abi' | 'stateLayout'>,
  functionName: string,
): DirectMappingReadPlan | undefined {
  const functions = artifact.abi.filter((candidate) => candidate.name === functionName);
  if (functions.length !== 1) return undefined;
  const [fn] = functions;
  const proof = fn?.directMappingReturn;
  if (!fn || !proof || fn.writesState !== false || fn.outputs?.length !== 1) return undefined;
  const access = fn.entryAccesses;
  if (access?.length !== 1 || access[0].collection !== proof.collection
    || access[0].operations.length !== 1 || access[0].operations[0] !== 'read') {
    return undefined;
  }
  if (proof.keyParams.length < 1 || proof.keyParams.length > 2
    || access[0].keyParams.length !== proof.keyParams.length
    || access[0].keyParams.some((name, index) => name !== proof.keyParams[index])) return undefined;
  const collection = artifact.stateLayout?.collections?.find((candidate) => candidate.name === proof.collection);
  if (!collection || collection.kind !== 'mapping') return undefined;
  const keyTypes = collection.keyTypes ?? [collection.keyType];
  if (keyTypes.length !== proof.keyParams.length) return undefined;
  const outputIntegerType = canonicalIntegerAbiType(fn.outputs[0].type);
  const valueIntegerType = canonicalIntegerAbiType(collection.valueType);
  const exactStructType = fn.outputs[0].type === collection.valueType
    && artifact.stateLayout?.structs?.some((struct) => struct.name === collection.valueType) === true;
  if (outputIntegerType === undefined || valueIntegerType === undefined
    ? !exactStructType : outputIntegerType !== valueIntegerType) return undefined;
  const visibleInputs = visibleHandlerInputs(fn.inputs);
  const keyArgumentIndices = proof.keyParams.map((name) => visibleInputs.findIndex((input) => input.name === name));
  if (keyArgumentIndices.some((index) => index < 0) || new Set(keyArgumentIndices).size !== keyArgumentIndices.length) {
    return undefined;
  }
  if (keyArgumentIndices.some((argumentIndex, index) => {
    const inputType = canonicalIntegerAbiType(visibleInputs[argumentIndex]!.type)
      ?? visibleInputs[argumentIndex]!.type;
    const keyType = canonicalIntegerAbiType(keyTypes[index]!) ?? keyTypes[index];
    return inputType !== keyType;
  })) return undefined;
  return { collection: collection.name, keyArgumentIndices, keyTypes };
}

/** Resolve a fixed entry access by its compiler-owned physical slot, including pre-slotIndex artifacts. */
export function entryAccessAt(fn: Pick<AbiFunction, 'entryAccesses'> | undefined, slotIndex: number): EntryAccessAbi | undefined {
  return fn?.entryAccesses?.find((access, denseIndex) => (access.slotIndex ?? denseIndex) === slotIndex);
}

/**
 * Repeating an identical absolute counter-loop write is observationally idempotent: every row proves the same
 * old-to-new entry transition, so the rows may share one physical journal settlement. Relative updates (`+`/`-`),
 * differing arguments, and handlers with any other owner-local state remain row-scoped because replaying one
 * transition would not represent their sequential semantics.
 */
export function canShareIdempotentCounterLoopSettlement(params: {
  rows: readonly RouteExpressionKeyRow[];
  structs: Artifact['structs'];
  dataNftCount: number;
}): boolean {
  if (params.rows.length < 2) return false;
  const identities = params.rows.map((row): string | undefined => {
    const visible = visibleHandlerInputs(row.handler.inputs);
    if (visible.length !== row.args.length) return undefined;
    const encoded = visible.map((input, index) => (
      encodeFunctionArgument(row.args[index], input.type, params.structs)
    ));
    if (encoded.some((value) => !(value instanceof Uint8Array))) return undefined;
    return `${row.handler.selector ?? row.handler.name}:`
      + encoded.map((value) => binToHex(value as Uint8Array)).join(':');
  });
  const identity = identities[0];
  return identity !== undefined && identities.every((candidate) => candidate === identity)
    && params.rows.every((row) => {
      const loops = row.handler.sortedUpsertLoopInfo ?? [];
      const requiredNfts = row.handler.requiredNftIndices
        ?? Array.from({ length: params.dataNftCount }, (_unused, index) => index);
      return loops.length > 0
        && loops.every((loop) => (
          (loop.op === 'delete' || (loop.op === 'set'
            && loop.mutation === undefined
            && loop.valueRuntimeExpression !== true
            && loop.valueRuntimeLocal === undefined
            && (loop.valueArrayParam !== undefined
              || loop.valueScalarParam !== undefined
              || loop.valueConst !== undefined)))
          && loop.varyingArrayParam.startsWith('__internal__vmapCounterPerm_')
        ))
        && requiredNfts.length === 0
        && (row.handler.entryAccesses?.length ?? 0) === 0
        && (row.handler.dynamicWrites?.length ?? 0) === 0
        && (row.handler.sortedInsertLoopInfo?.length ?? 0) === 0
        && (row.handler.sortedInsertLoops?.length ?? 0) === 0
        && (row.handler.entryLoopWrites?.length ?? 0) === 0
        && row.handler.usesMsgSender !== true;
    });
}

/**
 * Select the message-bus row that owns an expression-keyed entry slot.
 * Later rows decode the same `rowArgs` label shape; matching is by collection + handler arity,
 * then an optional `_rN` hint, then the handler's own expression label.
 */
export function matchingRouteRowsForExpressionKey(params: {
  collection: string;
  schemaArity: number;
  expressionLabel?: string;
  rowArguments: readonly RouteExpressionKeyRow[];
  rowIndexHint?: number;
}): RouteExpressionKeyRow | undefined {
  const matching = params.rowArguments.filter((row) => {
    const visible = visibleHandlerInputs(row.handler.inputs);
    return visible.length === params.schemaArity
      && (row.handler.entryAccesses ?? []).some((candidate) => candidate.collection === params.collection);
  });
  if (matching.length === 0) return undefined;
  if (matching.length === 1) return matching[0];
  if (params.rowIndexHint !== undefined) {
    const hinted = params.rowArguments[params.rowIndexHint];
    if (hinted && matching.includes(hinted)) return hinted;
  }
  if (params.expressionLabel) {
    const byLabel = matching.filter((row) => (row.handler.entryAccesses ?? []).some((candidate) => (
      candidate.collection === params.collection
      && (candidate.keySources ?? []).some((source) => source.expressionLabel === params.expressionLabel)
    )));
    if (byLabel.length === 1) return byLabel[0];
    if (params.rowIndexHint !== undefined && byLabel[params.rowIndexHint]) {
      return byLabel[params.rowIndexHint];
    }
  }
  throw new Error(
    `Message-bus expression key for '${params.collection}' matches multiple active rows`,
  );
}

/**
 * Resolve a nested/route entry key. Expression labels that decode `rowArgs` must use THAT row's
 * handler arguments, not the route planning ABI — evaluating against the route args either
 * accidentally selected row 0 or left later-row slots funder-filled.
 */
export function resolveRouteRowExpressionKey(params: {
  expressionLabel: string | undefined;
  collection: string;
  rowArguments?: readonly RouteExpressionKeyRow[];
  routePlanningArgs: readonly FunctionArgument[];
  routeVisibleInputs: readonly { name: string; type?: string }[];
  structs?: Parameters<typeof encodeFunctionArgument>[2];
  state?: Readonly<Record<string, StateValue>>;
  rowIndexHint?: number;
}): Uint8Array | undefined {
  const parsed = parseRowArgsDecodeLabel(params.expressionLabel);
  if (parsed && params.rowArguments) {
    const matching = matchingRouteRowsForExpressionKey({
      collection: params.collection,
      schemaArity: parsed.schemaArity,
      expressionLabel: params.expressionLabel,
      rowArguments: params.rowArguments,
      rowIndexHint: params.rowIndexHint,
    });
    const visible = matching ? visibleHandlerInputs(matching.handler.inputs) : undefined;
    const value = matching?.args[parsed.argumentIndex];
    const input = visible?.[parsed.argumentIndex];
    if (value !== undefined && input) {
      const encoded = encodeFunctionArgument(value, input.type, params.structs);
      if (encoded instanceof Uint8Array) return encoded;
    }
    return undefined;
  }
  // A composed `map:<stateArray>(...)` label indexes a decoded dynamic state array by a route loop counter
  // (`map:items(binop:+(id:i,id:index_))`). The counter is a source-loop local: it is not an ABI input, so the
  // planning ABI cannot resolve it. With exactly one selected row that row's occurrence IS the counter, and the
  // label becomes evaluable against that row. More than one candidate row stays unresolved rather than guessing.
  const loopLocal = params.expressionLabel?.startsWith('map:') && params.rowArguments?.length === 1
    ? unresolvableLabelLocals(params.expressionLabel, params.routeVisibleInputs)
    : [];
  if (loopLocal.length > 0) {
    const occurrence = params.rowArguments![0].occurrenceIndex ?? 0;
    let rewritten = params.expressionLabel!;
    for (const name of loopLocal) {
      // Whole-token replacement only: `id:i` must not rewrite the `id:index_` operand that merely starts with it.
      rewritten = rewritten.replace(
        new RegExp(`id:${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`, 'g'),
        `lit:${occurrence}`,
      );
    }
    const bound = evalComputedKey(
      rewritten,
      params.routePlanningArgs as FunctionArgument[],
      params.routeVisibleInputs,
      params.state,
    );
    if (bound) return bound;
  }
  return evalComputedKey(
    params.expressionLabel,
    params.routePlanningArgs as FunctionArgument[],
    params.routeVisibleInputs,
    params.state,
  );
}

/** `id:<name>` operands of a label that no visible route input can supply (source-loop locals, row arguments). */
function unresolvableLabelLocals(
  label: string,
  visibleInputs: readonly { name: string; type?: string }[],
): string[] {
  const names: string[] = [];
  for (const match of label.matchAll(/id:([A-Za-z_$][\w$]*)/g)) {
    const name = match[1];
    if (visibleInputs.some((input) => input.name === name)) continue;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}
