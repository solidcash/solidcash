---
title: Language Grammar
description: Structural grammar map for current SolidCash source
---

The normative grammar is `packages/solidc/src/grammar/SolidCash.g4`. It is an ANTLR4 grammar consumed by the
compiler; generated lexer/parser files are build products and must not be edited directly.

This page is a readable map of the current grammar rather than a second, manually copied grammar. For semantic
rules—types, visibility, storage backends, or whether a parsed operation can be authenticated—follow the linked
language pages. Parsing a construct does not by itself guarantee that every type or state shape is lowerable.

## Compilation unit

A source file contains pragmas and imports followed by file-level declarations and contract-like declarations:

```text
source
  := pragma* import*
     (constant | struct | enum | valueType | error | event |
      freeFunction | usingDirective | interface | library | contract)* EOF
```

```solidity
pragma solidcash ^0.13.0;

import "./Base.scash";
import { Pair, helper as importedHelper } from "./Library.scash";
import * as Types from "./Types.scash";

uint256 constant LIMIT = 100;
struct Pair { uint256 x; uint256 y; }
enum Status { Pending, Active, Done }
type TokenId is bytes32;
error InvalidAmount(uint256 amount);
event Updated(address indexed actor, uint256 value);

function helper(uint256 value) returns (uint256) { return value + 1; }
using Math for uint256;

interface ICounter { function increment() external; }
library Math { function twice(uint256 value) internal returns (uint256) { return value * 2; } }
contract Counter(address owner) is Base(owner) { /* ... */ }
```

`pragma solidity`, `.sol` imports, aliases, and additional Solidity-tolerance syntax are accepted by the
[Solidity import compatibility pipeline](./solidity-import-compat.md).

## Contract declarations

The structural form is:

```text
contract      := ('abstract'? 'contract' | 'interface' | 'library') name
                 contractParameters? inheritance? '{' contractItem* '}'
inheritance   := 'is' baseSpecifier (',' baseSpecifier)*
baseSpecifier := qualifiedName argumentList?
```

Contract parameters are native SolidCash values baked into the covenant bytecode. An explicit
`constructor(...) { ... }` is a deploy-time state initializer. A contract body can contain:

- enum, struct, value-type, event, and error declarations;
- constants and state variables;
- `using` directives;
- custom modifiers;
- one constructor, fallback, and receive function; and
- ordinary functions.

Declaration order is Solidity-compatible; the compiler normalizes it before semantic analysis. See
[Contract Structure](/docs/language/contracts), [Imports & Interfaces](/docs/language/imports-interfaces), and
[Inheritance](/docs/language/inheritance).

## State declarations

```text
stateVariable := type modifier* name ('=' expression)? ';'
collection    := visibility? 'enumerable'? mappingType modifier* name ';'
mappingType   := 'mapping' '(' keyType keyName? '=>' type valueName? ')'
arrayType     := (type | mappingType | functionType) '[' expression? ']'
                 ('[' expression? ']')*
```

Relevant modifiers include `public`, `internal`, `private`, `external`, `constant`, `immutable`, `transient`,
`memory`, `calldata`, `storage`, and `packed`, subject to declaration-specific semantic checks.

Every mapping uses the authenticated [vmap](../language/verified-mappings.md) backend. The `enumerable` prefix
only enables source-level iteration; it does not select a different physical mapping format. Array backend
selection is described in [Arrays](../language/arrays.md).

## Functions and modifiers

```text
function
  := 'function' name parameterList modifierInvocation*
     returnsClause? (';' | block)

constructor := 'constructor' parameterList modifierInvocation* block
fallback    := 'fallback' parameterList? modifierInvocation* returnsClause? block
receive     := 'receive' '(' ')' modifierInvocation* block
modifierDef := 'modifier' name parameterList? modifierInvocation* block
returns     := 'returns' parameterList
```

Function modifiers include visibility (`external`, `public`, `internal`, `private`), mutability (`pure`, `view`,
`payable`), inheritance (`virtual`, `override(...)`), custom modifier invocations, and BCH lifecycle modifiers
(`unsafe`, `unsafe(1)`, `unsafe(2)`, `upgrade`, `selfdestruct`, `split(name)`, `merge(name)`).

Child deployment and delegate implementation mode are inferred. `deploy` is not a source-level modifier keyword.
The parser still accepts the legacy explicit `delegate` modifier during migration, but new proxy implementations
should use ordinary `public`/`external` functions and consume `artifact.delegateArtifact`. See
[Functions](../language/functions.md), [Function Modifiers](../language/modifiers.md), and
[Contract Creation & Lifecycle](../language/contract-creation.md).

Function types are valid type expressions:

```solidity
function(uint256, uint256) internal returns (uint256) operation;
function(address, uint256) external callback;
```

Semantic analysis restricts where internal or external function handles may cross an ABI or persistent-state
boundary.

## Types

The parser recognizes:

```text
bool
int | uint | bigint
int8 .. int256 | uint8 .. uint256
fixed | ufixed | fixedMxN | ufixedMxN
string | bytes | bytes1 .. bytes32 | byte
pubkey | sig | datasig
address | address payable
mapping(K => V)
T[] | T[N]
function(...) [visibility] [mutability] returns (...)
qualified user type, struct, enum, interface, library, or contract name
```

Array suffixes compose, so `uint256[][3]`, `Pair[][]`, and similar nested types parse. Data-location and lifetime
keywords are part of declarations rather than primitive type names. Full semantics are in
[Types & Operators](../language/types.md) and [Data Locations](../language/data-locations.md).

## Statements

A block can contain:

- initialized or default-initialized variable declarations;
- simple, compound, chained, tuple, index, member, state, and collection assignments;
- `if`/`else`, `switch`/`case`/`default`, `for`, `while`, and `do`/`while`;
- `break` and `continue`;
- `require`, `assert`, `revert`, and `try`/`catch`;
- `return`, including tuple and bare named-return forms;
- `emit`, `delete`, and `console.log`;
- expression statements, including calls and increment/decrement;
- `unchecked { ... }`; and
- Yul or native BCH `assembly { ... }`.

```solidity
for (uint256 i = 0; i < values.length; i++) {
    if (values[i] == 0) continue;
    total += values[i];
}

switch (mode) {
    case 0: total = 1; break;
    default: revert InvalidAmount(total);
}
```

Mapping iteration adds three specialized loop headers:

```solidity
for (V value of this.map) { ... }
for (K key in this.map) { ... }
for (K key, V value of this.map.entries) { ... }
```

These require an `enumerable mapping` and have additional vmap completeness/key-preimage rules.

## Expressions and precedence

From tightest binding to loosest:

| Level | Forms |
| ---: | --- |
| 1 | Parentheses |
| 2 | Type casts |
| 3 | `new C(...)`, including `{value: ...}` / `{salt: ...}` options |
| 4 | Calls and call options |
| 5 | Index, tuple index, and slice (`x[i]`, `x[a:b]`) |
| 6 | Member access |
| 7 | Postfix `++`, `--` |
| 8 | Prefix `++`, `--`, unary `-`, `!`, `~`, `delete` |
| 9 | `**` (right associative) |
| 10 | `*`, `/`, `%` |
| 11 | `+`, `-` |
| 12 | `<<`, `>>` |
| 13–15 | `&`, `^`, `|` |
| 16 | `<`, `<=`, `>`, `>=` |
| 17 | `==`, `!=` |
| 18–19 | `&&`, `||` (short-circuiting) |
| 20 | `?:` (right associative) |
| 21 | Assignment and compound assignment (right associative) |

Calls include positional and named arguments, member/bound calls, `super` and explicitly qualified base calls,
ABI helpers, external contract calls, low-level address calls, library/using-for dispatch, and built-in
functions. Semantic passes resolve overloads and reject an ambiguous target.

## Literals

```solidity
42
-7
1_000_000
1e6
1.5
true
false
"UTF-8 text"
'text'
0xdeadbeef
hex"cafe babe"
date("2025-12-31T14:30:00")
1 bitcoin
500 satoshis
7 days
```

Decimal literals are contextually typed for fixed-point values. `hex"..."` and `hex'...'` accept whitespace in
the payload. Number and time units are lowered to integer scale factors. See
[Types & Operators](../language/types.md) and [Global Variables](../language/globals.md#globally-available-units).

## Inline assembly

The text inside `assembly { ... }` is classified as either structured Yul or a native BCH opcode sequence. Yul
has its own lexer/parser and lowering boundary, including functions, loops, memory, supported EVM-context shims,
and virtual storage slots. A parsed Yul builtin without a sound BCH lowering produces a named diagnostic.

See [Inline Assembly](../language/assembly.md) and
[EVM Storage & ERC-7201 Compatibility](../language/evm-storage-compat.md).

## Reading the normative grammar

When changing language syntax:

1. Edit `packages/solidc/src/grammar/SolidCash.g4`.
2. Regenerate the parser through the repository build; do not hand-edit generated parser files.
3. Update the AST builder and semantic/type/codegen passes as required.
4. Add positive and negative parser/compiler tests.
5. Update this syntax map and the topic page which defines the construct's semantics.

The compiler's Solidity compatibility transformations run around the parser and therefore cannot always be
represented as one context-free grammar production. The emitted artifact and compiler diagnostics are the
authority for whether a particular source shape is supported by a selected option set.
