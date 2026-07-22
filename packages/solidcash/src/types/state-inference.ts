// Maps state variable type strings to their TypeScript return types for getters.
type StateReturnTypeMap = {
  [k: `bytes${number}`]: Uint8Array;
  byte: Uint8Array;
  bytes: Uint8Array;
  bool: boolean;
  int: bigint;
  string: string;
  pubkey: Uint8Array;
};

// Process a single state variable definition into its getter return type.
type ProcessStateVariable<Variable> = Variable extends { type: infer Type }
  ? Type extends `int${number}` | `uint${number}` | `fixed${string}` | `ufixed${string}`
    ? bigint
    : Type extends 'uint' | 'bigint' | 'fixed' | 'ufixed'
      ? bigint
      : Type extends keyof StateReturnTypeMap
        ? StateReturnTypeMap[Type]
        : any
  : any;

// Process a single state variable into a getter mapping.
type ProcessStateGetter<Variable> = Variable extends { name: string; type: string }
  ? {
    [varName in Variable['name']]: () => Promise<ProcessStateVariable<Variable>>;
  }
  : {};

// Recursively convert an array of state variable definitions into a getter map.
type InternalStateGetterMap<Variables> =
  unknown extends Variables
    ? GenericStateGetterMap
    : Variables extends readonly [infer Head, ...infer Tail]
      ? ProcessStateGetter<Head> & InternalStateGetterMap<Tail>
      : Variables extends readonly []
        ? {}
        : GenericStateGetterMap;

type GenericStateGetterMap = { [varName: string]: () => Promise<any> };

type Prettify<T> = { [K in keyof T]: T[K] } & {};

// Extract variables from a stateLayout if present.
type ExtractStateVariables<TArtifact> = TArtifact extends { stateLayout: { variables: infer V } }
  ? V
  : unknown;

export type StateGetterMap<TArtifact> = Prettify<InternalStateGetterMap<ExtractStateVariables<TArtifact>>>;

// Maps state variable type strings to their setter value types.
// Struct values are represented as recursive records (nested structs supported).
export type StateValueType = bigint | boolean | Uint8Array | string | { [key: string]: StateValueType } | StateValueType[];

// Extract state variable names as a union type from an artifact.
type ExtractStateVariableNames<TArtifact> = TArtifact extends { stateLayout: { variables: readonly { name: infer N }[] } }
  ? N extends string ? N : string
  : string;

export type StateVariableNames<TArtifact> = ExtractStateVariableNames<TArtifact>;
