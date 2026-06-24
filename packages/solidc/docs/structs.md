# Structs in SolidCash

A struct is a named record of fields, like a Solidity `struct`. Structs group related values into one type
that can be a local variable, a state variable, a mapping value, an array element, or a function parameter or
return. This document covers how to define and use them, how they are encoded on chain, and the current
capability boundaries (verified against the compiler).

## TL;DR

```solidity
struct Point { int x; int y; }              // definition

Point p = Point(1, 2);                       // positional construction
Point q = Point({ y: 2, x: 1 });             // named construction (reorderable)
int a = p.x;                                 // field read
p.x = 9;                                     // local field write (top-level field only)
```

- Define structs at **contract, file, library, or interface** level.
- Fields may be any value type, an array type (`int[]`, `bytes20[3]`), or a nested struct.
- A struct value is stored as its fields encoded back to back.
- Field writes work everywhere - local structs, state struct variables, mapping values, and array elements -
  including nested chains (`b.a.x = v`). They desugar to a struct rebuild.

## Defining structs

```
struct Identifier { type field; type field; ... }   // one or more fields, each `type name;`
```

Structs can be declared in several scopes:

- **Contract level** - visible inside that contract.
- **File level** - declared outside any contract; importable across files.
- **Library** and **interface** bodies - for shared/ported definitions.

```solidity
struct User { bytes20 addr; string name; int balance; }   // file-level, importable

contract Registry() {
    mapping(bytes20 => User) users;
    ...
}
```

### Allowed field types

A field may be any of:

- `int`/`uint`/`intN`/`uintN`, `bigint`, `bool`
- `bytesN`, `bytes`, `string`
- `pubkey`, `sig`, `datasig`, `address`, an `enum`
- a **nested struct**
- an **array type** (`int[] xs;`, `bytes20[3] ps;`)

Nested structs may be arbitrarily deep. A struct that (directly or transitively) contains itself is rejected
with a circular-definition error.

## Constructing structs

Positional construction lists field values in declaration order:

```solidity
Point p = Point(1, 2);
C val = C(B(A(42), 10), 20);    // nested
```

Named construction lets you reorder fields, omit fields (omitted fields take their zero value), or pass none
at all (`{}` -> all defaults):

```solidity
Person p1 = Person({ age: 30, name: "Alice" });   // reordered
Person p2 = Person({ name: "Bob" });              // age defaults to 0
Person p3 = Person({});                            // name "", age 0
```

Zero values match the `delete` / uninitialized semantics: `int` -> 0, `bool` -> false, `bytesN` -> zero
bytes, `string`/`bytes` -> empty, nested struct -> all-default.

## Using structs

### Field access (reads)

Reads support arbitrary nesting:

```solidity
require(this.data.inner.x > 0);              // state struct, nested
require(this.payments[key].from.amount > 0); // mapping value, nested
require(val.mid.inner.x == 42);              // local, deeply nested
```

### Field writes

A field write is compiled as a read-modify-write that rebuilds the struct, and works on every kind of struct
location - local, state variable, mapping value, and array element - including arbitrarily nested chains:

```solidity
Point p = Point(1, 2);
p.x = 9;                          // local: desugars to p = Point(9, p.y)

this.data.x = 9;                  // state struct variable
this.users[pkh].name = newName;   // mapping value
arr[i].a = 9;                     // array element
b.a.x = 9;                        // nested chain (rebuilds inner then outer)
```

### As state variables, mapping values, parameters, returns

```solidity
contract C() {
    struct P { int x; int y; }
    P data;                                   // state variable
    mapping(int => P) items;                  // mapping value (nested struct values OK)

    function makeP(int x, int y) returns (P) { return P(x, y); }   // return
    function useP(P p) { require(p.x > 0); }                       // parameter
}
```

## Storage encoding

A struct **value** is the concatenation of its fields, each encoded with the standard pushdata framing and
laid out in declaration order (recursively for nested structs):

```
struct value = encode(field_0) ++ encode(field_1) ++ ...
```

So a `User { bytes20 addr; string name; int balance; }` is `addr` (framed bytes) followed by `name` (framed
string) followed by `balance` (framed int). State struct variables live in the contract's data-NFT
commitment; mapping struct values live in the entry-NFT commitment for that key.

A struct is **fixed-width** when every field is fixed-width (`isFixedWidthType` is true for each field). For a
fixed-width struct, the packed width is the sum of the field widths (`fixedWidthBytes` = sum of field
byte-widths), and the struct can be a chunk-packed array element with O(1) indexing. Any `string`, unbounded
`bytes`, or `bigint` field makes the struct variable-width.

## Structs in arrays

```solidity
struct Pair { int a; int b; }            // fixed-width struct

Pair[] arr = [Pair(1, 2), Pair(3, 4)];
arr.push(Pair(5, 6));                     // push
Pair first = arr[0];                      // index read
int a0 = arr[0].a;                        // field of an element (read)
arr[0] = Pair(10, 20);                    // whole-element assign
arr[0].a = 9;                             // element field write (rebuilds the element)
arr.pop();                                // pop
arr.delete(0);                            // delete (swap-with-last)
```

Both fixed-width and variable-width struct arrays use the **chunk-packed** backend:

- **Fixed-width** structs (all fields fixed-width) use the flat-stream layout: O(1) indexing, element `i` at
  byte offset `i * fixedWidthBytes`.
- **Variable-width** structs (a `string`/`bytes`/`bigint` field) use the framed layout, navigated by walking
  each element's inner field frames (O(n) indexing).

Element field writes (`arr[i].field = v`, and the storage-pointer form `T t = arr[i]; t.field = v`) desugar to
a whole-element rebuild (`arr[i] = T(arr[i].f0, .., v, ..)`), reusing the element read and whole-element
assign. See `arrays.md` for backend details.

## Type identity and casting

Two struct types are equal when they have the **same name** and the **same fields** (matching names and types,
in order). A `StructType -> StructType` cast is a no-op at the VM level (the blob is unchanged), so it only
needs the two types to be structurally identical.

## ABI / artifact representation

Struct definitions are emitted into the artifact (and `stateLayout`) as:

```ts
interface StructDefinitionInfo {
  name: string;
  fields: readonly { name: string; type: string }[];
}
```

Field `type` strings use the canonical type names (e.g. `int256`, `bytes20`, `string`, or a nested struct's
name). Tools read these to encode/decode struct values.

## SDK usage

Struct values cross the SDK boundary as plain JS records keyed by field name:

```ts
{ addr: alicePkhBytes, name: "Alice", balance: 100n }
```

- **`string` fields** accept JS strings (auto UTF-8 encoded).
- **byte-typed fields** (`bytesN`, `bytes`, `pubkey`, ...) must be `Uint8Array` (a JS string would be UTF-8
  encoded, not hex-decoded).
- **integer fields** are `bigint`; **bool fields** are `boolean`.
- Omitted/`undefined` fields fall back to the type's default value.

## Capabilities

Verified against the current compiler:

- **Reads** are unrestricted: arbitrary nesting works for locals, state variables, mapping values, and array
  elements (`this.payments[k].from.amount`, `val.mid.inner.x`).
- **Field writes** work on every struct location - local, state variable, mapping value, array element -
  including nested chains (`b.a.x = v`, `this.d.a.x = v`). Each desugars to a struct rebuild.
- **Array-typed fields** (`int[]`, `bytes20[3]`, ...) are supported: construct (`Bag([1,2,3], 7)`), read,
  index (`b.xs[i]`), and `.length`.
- **`struct[]` arrays** (both fixed-width and variable-width elements) support
  push/pop/index/whole-element-assign/delete and element-field writes (`arr[i].field = v`).

## See also

- `arrays.md` - array backends, including chunk-packed fixed-width struct arrays.
- `integers.md` - the integer field types and their fixed-/variable-width encoding.
- `dynamic-storage.md` - how unbounded values (and `string`/`bytes` struct fields) are chunked across UTXOs.
