import type SignatureTemplate from '../SignatureTemplate.js';

type BytesType = Uint8Array | string;
type SignatureType = SignatureTemplate | BytesType;

type TypeMap = {
  [k: `bytes${number}`]: BytesType; // Matches any "bytes<number>" pattern
} & {
  byte: BytesType;
  bytes: BytesType;
  bool: boolean;
  int: bigint;
  string: string;
  pubkey: BytesType;
  sig: SignatureType;
  datasig: BytesType;
  address: BytesType; // locking bytecode (Uint8Array) or its hex string
  'address payable': BytesType;
};

// Map an ABI type string to its TS value type, recursing through `T[]` / `T[N]` array suffixes.
// Example: "int" -> bigint; "address[]" -> (Uint8Array | string)[]; "bytes20[3]" -> (Uint8Array | string)[]
// Branches:
// - If `Type` ends in an array suffix (bounded or not), map the element type and wrap it in an array.
// - Else if `Type` is a known leaf type, map it via `TypeMap`.
// - Else default to `any`.
type MapType<Type> = Type extends `${infer Elem}[${string}]`
  ? MapType<Elem>[]
  : Type extends keyof TypeMap
    ? TypeMap[Type]
    : any;

// Helper type to process a single parameter by mapping its `type` to a value type (see MapType).
// Example: { type: "pubkey" } -> Uint8Array | string; { type: "int[]" } -> bigint[]
// A param that is not an object with a `type` defaults to `any`.
type ProcessParam<Param> = Param extends { type: infer Type }
  ? MapType<Type>
  : any;

// Main type to recursively convert an array of parameter definitions into a tuple.
// Example: [{ type: "pubkey" }, { type: "int" }] -> [Uint8Array, bigint]
// Branches:
// - If `Params` is a tuple with a `Head` that matches `ProcessParam`, it processes the head and recurses on the `Tail`.
// - If `Params` is an empty tuple, it returns [].
// - If `Params` is not an array or tuple, it defaults to any[].
export type ParamsToTuple<Params> = Params extends readonly [infer Head, ...infer Tail]
  ? [ProcessParam<Head>, ...ParamsToTuple<Tail>]
  : Params extends readonly []
    ? []
    : any[];

// Processes a single function definition into a function mapping with parameters and return type.
// Example: { name: "transfer", inputs: [{ type: "int" }] } -> { transfer: (arg0: bigint) => ReturnType }
// Branches:
// - Branch 1: If `Function` is an object with `name` and `inputs`, it creates a function mapping.
// - Branch 2: If `Function` does not match the expected shape, it returns an empty object.
// Pick the deploy-aware return type: a function whose `modifiers` LITERALLY include 'deploy' returns
// DeployReturnType; everything else - including a generic `readonly string[]` modifiers (e.g. from a
// non-`as const` artifact) or no modifiers at all - returns ReturnType.
type DeployAwareReturn<Function, ReturnType, DeployReturnType> =
  Function extends { modifiers: readonly string[] }
    ? string extends Function['modifiers'][number]
      ? ReturnType
      : 'deploy' extends Function['modifiers'][number]
        ? DeployReturnType
        : ReturnType
    : ReturnType;

type ProcessFunction<Function, ReturnType, DeployReturnType> = Function extends { name: string; inputs: readonly any[] }
  ? {
    [functionName in Function['name']]:
    (...functionParameters: ParamsToTuple<Function['inputs']>) => DeployAwareReturn<Function, ReturnType, DeployReturnType>;
  }
  : {};

// Recursively converts an ABI into a function map with parameter typings and return type.
// Example:
// [
//   { name: "transfer", inputs: [{ type: "int" }] },
//   { name: "approve", inputs: [{ type: "address" }, { type: "int" }] }
// ] ->
// { transfer: (arg0: bigint) => ReturnType; approve: (arg0: Uint8Array | string, arg1: bigint) => ReturnType }
// Branches:
// - Branch 1: If `Abi` is `unknown` or `any`, return a default function map with generic parameters and return type.
// - Branch 2: If `Abi` is a tuple with a `Head`, process `Head` using `ProcessFunction` and recurse on the `Tail`.
// - Branch 3: If `Abi` is an empty tuple, return an empty object.
// - Branch 4: If `Abi` is not an array or tuple, return a generic function map.
type InternalAbiToFunctionMap<Abi, ReturnType, DeployReturnType> =
  // Check if Abi is typed as `any`, in which case we return a default function map
  unknown extends Abi
    ? GenericFunctionMap<ReturnType>
    : Abi extends readonly [infer Head, ...infer Tail]
      ? ProcessFunction<Head, ReturnType, DeployReturnType> & InternalAbiToFunctionMap<Tail, ReturnType, DeployReturnType>
      : Abi extends readonly []
        ? {}
        : GenericFunctionMap<ReturnType>;

type GenericFunctionMap<ReturnType> = { [functionName: string]: (...functionParameters: any[]) => ReturnType };

// Merge intersection type
// Example: {foo: "foo"} & {bar: "bar"} -> {foo: "foo", bar: "bar"}
type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type AbiToFunctionMap<T, ReturnType, DeployReturnType = ReturnType> =
  Prettify<InternalAbiToFunctionMap<T, ReturnType, DeployReturnType>>;
