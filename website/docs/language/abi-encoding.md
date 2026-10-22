---
title: ABI Encoding & Call Data
---

SolidCash has two ABI wire formats. Native mode uses a compact Bitcoin Script pushdata format and SHA-256
selectors. The optional `evmCompat` mode uses Ethereum-style 32-byte head/tail encoding and Keccak-256 selectors
for the supported Solidity ABI types. Pick the format for the system at the other end of the byte string; the two
formats are not interchangeable. `pragma solidity` sources require `evmCompat`, and new SolidHat projects set
`compiler: { evmCompat: true }` in `solidcash.config.ts`.

This ABI is also distinct from the state commitment codec. State fields, vmap nodes, and chunk NFTs have their own
authenticated layouts described in [State Storage & Data Encoding](./storage-model.md).

## The `abi` functions

| Expression | Result |
| --- | --- |
| `abi.encode(a, b, ...)` | Standard encoding of the arguments |
| `abi.encodePacked(a, b, ...)` | Concatenated packed encoding |
| `abi.encodeWithSelector(selector, a, ...)` | Raw `bytes4` selector followed by standard argument encoding |
| `abi.encodeWithSignature("f(uint256)", a, ...)` | Derived selector followed by standard argument encoding |
| `abi.encodeCall(IFoo.f, (a, ...))` | Type-checked function selector and arguments |
| `abi.decode(data, (T0, T1, ...))` | Decode a complete standard encoding |
| `abi.decodeAt(data, (T0, T1, ...), i)` | Decode schema element **`i`** from native pushdata encoding |

A single-item `abi.decode(data, (T))` evaluates to `T`. A multi-item schema evaluates to a tuple and can be
destructured:

```solidity
bytes payload = abi.encode(uint256(42), true, hex"cafe");
(uint256 number, bool enabled, bytes data) =
    abi.decode(payload, (uint256, bool, bytes));
```

`abi.decodeAt`'s final argument is a zero-based **schema index** into the type tuple, not a byte offset. It must
be an integer literal:

```solidity
bytes4 label = abi.decodeAt(data, (uint256, bytes4, bool), 1);
```

It is a native-format convenience which skips the preceding pushdata-framed fields. Use `abi.decode` for EVM
head/tail data.

## Native SolidCash format

Native mode is the default. `abi.encode` concatenates each value's canonical Script-native framing:

```text
encodeNative(a) || encodeNative(b) || ...
```

Integers use minimal little-endian sign-magnitude VM numbers. Strings use UTF-8 bytes. Byte strings retain their
byte order. Arrays and structs carry enough count/framing information for the matching decoder to skip each value.
The result is compact and efficient inside BCH scripts, but it is not Ethereum ABI data.

Native `abi.encodePacked` removes the outer pushdata framing and concatenates natural encodings. Bounded integers
and fixed-point values are padded to their declared BCH width, `bool` is canonical `0x00` or `0x01`, and byte/string
data is raw.

Native function selectors are:

```text
selector = sha256(canonicalFunctionSignature)[0:4]
```

That rule applies consistently to ABI functions, external/public dispatch, `.selector`, `msg.sig`, and
`type(I).interfaceId`.

## EVM-compatible format

Compile with `evmCompat: true` when bytes must match Ethereum ABI encoders:

```ts
const artifact = compileFile('Bridge.scash', {
  evmCompat: true,
});
```

For supported types, the compiler uses EVM rules:

- integers are 32-byte, big-endian, two's-complement words in standard encoding;
- `bool` is a zero/one word;
- `bytesN` is right-padded in its 32-byte word;
- dynamic bytes, strings, arrays, structs, and tuples use head offsets and padded tails;
- packed integers use their Solidity natural width and big-endian order;
- packed dynamic bytes/string values have no length prefix; and
- selectors use `keccak256(canonicalSignature)[0:4]`.

The implementation covers static and dynamic tuples, fixed and dynamic arrays, nested dynamic arrays, and static
or dynamic structs within the compiler's supported ABI-v2 subset. Solidity `pragma abicoder v1` restrictions are
also enforced in compatibility mode; use `pragma abicoder v2` for structs and nested/dynamic-element arrays.

:::important
A native SolidCash `address` is a complete BCH locking bytecode, commonly 23, 25, or 35 bytes. It is not an
Ethereum 20-byte address. For byte-identical EVM data, carry an Ethereum-shaped address as `uint160`; use
`bytes20` only when its ABI right-alignment semantics are actually intended.
:::

`bigint`, BCH public/signature types, fixed-point types, and other BCH-only values do not have general Ethereum ABI
equivalents. Compile the exact schema: an unsupported `evmCompat` combination fails rather than silently choosing a
native encoding. In `evmCompat` mode, `abi.encodeWithSignature` accepts a signature built at runtime: a
non-literal signature lowers to `abi.encodeWithSelector(bytes4(keccak256(bytes(sig))), ...)`, so the keccak256
computation side-car that serves a runtime `keccak256` supplies the digest. A literal signature still folds to its
selector at compile time.

## Selectors and canonical signatures

A function selector excludes return types, parameter names and data locations. Under `evmCompat` the canonical
Solidity spellings are used: `uint256` for `uint`, `int256` for `int`, `uint8` for an enum, the underlying type for
a user-defined value type, parenthesized tuple syntax for a struct, and `address` for a contract type or
`address payable`. Native compiles keep the platform spelling, with address payability erased.

Prefer `abi.encodeCall` when the target function is known:

```solidity
interface IVault {
    function deposit(uint256 amount, bytes memo) external;
}

contract CallEncoder() {
    function encodeDeposit(uint256 amount, bytes memo) public pure returns (bytes) {
        return abi.encodeCall(IVault.deposit, (amount, memo));
    }
}
```

It validates arity and argument types at compile time. `abi.encodeWithSignature` accepts a string and cannot check
that its spelling agrees with the values. `abi.encodeWithSelector` is appropriate when a trusted `bytes4` selector
is already available.

The selector determines dispatch, but it does not authenticate a contract instance. A SolidCash external call
also binds the co-spent callee address/category and its state transition; see
[Cross-Contract Calls & Results](./cross-contract-calls.md).

## Packed-encoding ambiguity

Packed encoding is not self-describing. Different dynamic inputs can produce identical bytes:

```text
encodePacked("ab", "c") == encodePacked("a", "bc")
```

Do not hash packed data as an authorization or identity commitment when two or more adjacent fields are variable
length unless the application adds an unambiguous domain and length framing. `abi.encode` is the safer default for
structured commitments.

## Size and validation

Encoding and decoding happen inside one BCH VM evaluation, so the encoded value must fit the applicable stack-item
and transaction limits. The compiler validates declared type compatibility and uses the matching inverse codec;
malformed lengths, element encodings, or out-of-range schema indexes fail execution or compilation.

For SDK argument types and function overload dispatch, see [TypeScript SDK](../sdk/typescript-sdk.md). For the
compiler switches, see [The SolidCash Compiler](../compiler/compiler.md#common-compiler-options).
