import type { Artifact } from '@solidcash/utils';

// Maps SolidCash type strings to TypeScript types for event parameter matching.
type EventParamTypeMap = {
  [k: `bytes${number}`]: Uint8Array;
  byte: Uint8Array;
  bytes: Uint8Array;
  bool: boolean;
  int: bigint;
  string: string;
  pubkey: Uint8Array;
};

// Resolve a single event parameter's TypeScript type from its AbiInput.
type ResolveParamType<Param> = Param extends { type: infer T }
  ? T extends keyof EventParamTypeMap ? EventParamTypeMap[T] : any
  : any;

// -- Event name extraction --------------------------------------------------

// Extract event names as a string literal union from an artifact type.
// Falls back to `string` when the artifact is untyped (e.g. from compileString()).
export type ExtractEventNames<TArtifact> =
  TArtifact extends { events: readonly { name: infer N }[] }
    ? N extends string ? N : string
    : string;

// -- Event parameter lookup -------------------------------------------------

// Walk the events tuple to find the parameters for a given event name.
type FindEventParams<Events, Name extends string> =
  Events extends readonly [infer Head, ...infer Tail]
    ? Head extends { name: Name; parameters: infer P } ? P : FindEventParams<Tail, Name>
    : readonly [];

// -- Parameter -> matcher record ---------------------------------------------

// A single arg matcher: either a literal value or a predicate over that value.
type ArgMatcherFor<T> = T | ((value: T) => boolean);

// Recursively convert a parameters tuple to a partial record
// where each key is the parameter name and the value is a matcher.
type InternalParamsToMatcherRecord<Params> =
  Params extends readonly [infer Head, ...infer Tail]
    ? Head extends { name: infer N }
      ? N extends string
        ? { [K in N]?: ArgMatcherFor<ResolveParamType<Head>> } & InternalParamsToMatcherRecord<Tail>
        : InternalParamsToMatcherRecord<Tail>
      : InternalParamsToMatcherRecord<Tail>
    : {};

type Prettify<T> = { [K in keyof T]: T[K] } & {};

// -- Public composite types -------------------------------------------------

// Given an artifact and an event name, produce the typed expectedArgs record.
// All fields are optional (partial matching) and accept literal values or predicates.
export type EventMatcherArgs<TArtifact, Name extends string> =
  TArtifact extends { events: infer E }
    ? Prettify<InternalParamsToMatcherRecord<FindEventParams<E, Name>>>
    : Record<string, any>;

// Minimal structural interface for contracts that can emit events.
// Generic to preserve the artifact's literal type through inference.
export interface EmittingContract<TArtifact extends Artifact = Artifact> {
  artifact?: TArtifact;
  inner?: { artifact: TArtifact };
  categoryId?: string;
}
