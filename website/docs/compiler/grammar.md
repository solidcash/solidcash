---
title: Language Grammar
description: Structural grammar map for current SolidCash source
---

The normative grammar is the ANTLR4 grammar `SolidCash.g4` in the compiler's source. Its generated lexer and parser
files are build products and are never edited by hand.

This page is a readable map of the current grammar rather than a second, manually copied grammar. For semantic
rules (types, visibility, storage backends, or whether a parsed operation can be authenticated), follow the linked
language pages. Parsing a construct does not by itself guarantee that every type or state shape is lowerable.

## Compilation unit

A source file starts with pragmas and imports, followed by file-level declarations and contract-like declarations:

```text
source
  := pragma* import*
     (pragma | constant | struct | enum | valueType | error | event |
      freeFunction | usingDirective | interface | library | contract)* EOF

import
  := 'import' path ';'                                  -- wildcard
   | 'import' path 'as' name ';'                        -- namespace
   | 'import' '{' name ('as' name)? (',' ...)* '}' 'from' path ';'   -- selective
```

Imports must come before every other declaration. Pragmas may come before the imports or anywhere after them.

```solidity
pragma solidcash ^0.14.0;

import "./Base.scash";
import { Pair, helper } from "./Library.scash";
import "./Types.scash" as Types;

uint256 constant LIMIT = 100;
struct Point { uint256 x; uint256 y; }
enum Status { Pending, Active, Done }
type TokenId is bytes32;
error InvalidAmount(uint256 amount);
event Updated(address indexed actor, uint256 value);

function twice(uint256 value) pure returns (uint256) { return value * 2; }
using Math for uint256;

interface ICounter { function increment() external; }
library Math { function inc(uint256 value) internal pure returns (uint256) { return value + 1; } }
contract Counter(address owner) is Base(owner) { /* ... */ }
```

- A wildcard import brings in every file-level declaration of the imported file.
- A namespace import makes the file's declarations available qualified, as `Types.Point` or `Types.Status.Active`.
- A selective import names declarations. An `as` rename only takes effect for an enum; other names keep their
  declared name.
- `import * as Types from "./Types.scash";` does not parse. Write `import "./Types.scash" as Types;`.
- A non-relative path such as `"@scope/pkg/Math.scash"` resolves through `node_modules`; `.scash` is tried when the
  extension is omitted.
- Files may import each other (circular imports compile); an inheritance cycle is an error.

`pragma solidity`, `.sol` imports, and additional Solidity-tolerance syntax are accepted by the
[Solidity import compatibility pipeline](./solidity-import-compat.md).

## Contract declarations

The structural forms are:

```text
contract      := 'abstract'? 'contract' name contractParameters? inheritance? '{' contractMember* '}'
interface     := 'interface' name ('is' name (',' name)*)? '{' interfaceMember* '}'
library       := 'library' name '{' libraryMember* '}'
inheritance   := 'is' baseSpecifier (',' baseSpecifier)*
baseSpecifier := name argumentList?
```

Contract parameters (`contract C(pubkey owner)`, list optional) are native SolidCash values baked into the
covenant bytecode. An explicit `constructor(...) { ... }` is a deploy-time state initializer. A contract body can
contain, in any order:

- enum, struct, value-type, event, and error declarations;
- constants and state variables;
- `using` directives;
- custom modifiers;
- at most one constructor, one `fallback` and one `receive` function; and
- ordinary and abstract (bodyless) functions.

An interface body holds enums, structs, value types, events, errors, `using` directives, bodyless functions, a
bodyless `fallback`, and state declarations with the visibility first (`public uint256 totalSupply;`,
`public mapping(address => uint256) balances;`). A library body holds enum, struct, value-type, event, error and
constant declarations, state variables, `using` directives, modifiers and functions.

C3 linearization follows Solidity: for `D is B, C` where both `B` and `C` are `is A`, the order is D, C, B, A. See
[Contract Structure](/docs/language/contracts), [Imports & Interfaces](/docs/language/imports-interfaces), and
[Inheritance](/docs/language/inheritance).

## State declarations

```text
stateVariable := visibility? type modifier* name ('=' expression)? ';'
               | type modifier* visibility modifier* name ('=' expression)? ';'
collection    := visibility? 'enumerable'? mappingType modifier* name ';'
               | visibility? arrayType modifier* name ('=' expression)? ';'
mappingType   := 'mapping' '(' keyType keyName? '=>' (type | mappingType | arrayType) valueName? ')'
arrayType     := (type | mappingType | functionType | arrayType) '[' expression? ']'
```

Visibility is `public`, `internal`, `private` or `external`. Other declaration keywords are `constant`,
`immutable`, `transient`, `memory`, `calldata`, `storage`, and `packed`, subject to declaration-specific semantic
checks. A public state variable may also carry `override`.

Every mapping uses the authenticated [vmap](../language/verified-mappings.md) backend. The `enumerable` prefix
only enables source-level iteration; it does not select a different physical mapping format. Array backend
selection is described in [Arrays](../language/arrays.md).

## Functions and modifiers

```text
function
  := 'function' name parameterList (functionModifier | modifierInvocation)*
     returnsClause? (';' | block)

constructor := 'constructor' parameterList ('public' | 'internal' | 'external' | 'payable')*
               baseInvocation* modifierInvocation* block
fallback    := 'fallback' parameterList fallbackModifier* 'external' fallbackModifier* modifierInvocation*
               returnsClause? block
receive     := 'receive' '(' ')' 'external' 'payable' block     -- external and payable in either order
modifierDef := 'modifier' name parameterList? ('virtual' | override)* (block | ';')
returns     := 'returns' '(' parameter (',' parameter)* ')'
```

A function with no visibility keyword is public. Function modifiers include:

- visibility: `external`, `public`, `internal`, `private`;
- mutability: `pure`, `view`, `payable`;
- inheritance: `virtual`, `override`, `override(A, B)`;
- custom modifier invocations, including a named base's modifier (`Base.onlyOwner(s)`); and
- BCH lifecycle keywords: `unsafe`, `unsafe(1)`, `unsafe(2)`, `upgrade`, `migrateRecords`, `selfdestruct`,
  `split(n)` and `merge(n)`, where `n` names an integer parameter, plus the optional `deploy`.

Child deployment is inferred from `new C(...)` in the function body. Writing `deploy` is optional; it is a
contextual keyword, so a function may still be named `deploy`. `migrateRecords` marks the function that moves
mapping entries to the new bytecode during an `upgrade`. Proxy implementation builds are inferred too: write
ordinary `public`/`external` functions and consume `artifact.delegateArtifact`. The parser still accepts a legacy
`delegate` modifier from older sources; do not use it in new code. See [Functions](../language/functions.md),
[Function Modifiers](../language/modifiers.md), and
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
string | bytes | bytesN | byte              -- native mode also allows N above 32, e.g. bytes65
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

`delete` is a statement (`delete x;`, `delete this.x;`, `delete this.balances[key];`), not an expression operator.

Mapping iteration adds four specialized loop headers:

```solidity
for (V value of this.map) { ... }                      // values
for (K key in this.map) { ... }                        // keys
for (K key, V value of this.map.entries) { ... }       // key/value pairs
for (V value of this.map.window(cursor, 10)) { ... }   // at most 10 values, resuming from cursor
```

Each requires an `enumerable mapping` and has additional vmap completeness and key-preimage rules. In the windowed
form, `cursor` is a `bytes32` state variable that stores where the walk stopped, and the bound is a positive
integer literal. Each call visits at most that many entries and writes the cursor back, so a large mapping can be
processed page by page.

## Expressions and precedence

From tightest binding to loosest:

| Level | Forms |
| ---: | --- |
| 1 | Parentheses |
| 2 | Type casts |
| 3 | Calls and call options, `new C(...)` including `{value: ...}` / `{salt: ...}` options |
| 4 | Index, tuple index, and slice (`x[i]`, `x[a:b]`) |
| 5 | Member access |
| 6 | Postfix `++`, `--` |
| 7 | Prefix `++`, `--`, unary `-`, `!`, `~` |
| 8 | `**` (right associative) |
| 9 | `*`, `/`, `%` |
| 10 | `+`, `-` |
| 11 | `<<`, `>>` |
| 12 | `&` |
| 13 | `^` |
| 14 | `\|` |
| 15 | `<`, `<=`, `>`, `>=` |
| 16 | `==`, `!=` |
| 17 | `&&` (short-circuiting) |
| 18 | `\|\|` (short-circuiting) |
| 19 | `?:` (right associative) |
| 20 | Assignment and compound assignment (right associative, statement level) |

As in Solidity, the bitwise operators bind tighter than comparisons: `x & y == z` is `(x & y) == z`.

Calls include positional and named arguments, member/bound calls, `super` and explicitly qualified base calls,
ABI helpers, external contract calls, low-level address calls, library/using-for dispatch, and built-in
functions. Semantic passes resolve overloads and reject an ambiguous target.

## Literals

```solidity
42
-7                       // unary minus applied to 7
1_000_000
1e6
1.5
true
false
"UTF-8 text"
'text'
unicode"snow \u2603"
0xdeadbeef
hex"cafe babe"
date("2025-12-31T14:30:00")
1 bitcoin
500 satoshis
7 days
1 ether
```

Decimal literals are contextually typed for fixed-point values. `hex"..."` and `hex'...'` accept whitespace in
the payload. `date(...)` takes the full `YYYY-MM-DDThh:mm:ss` form and is read as UTC. The BCH units are `sats`,
`satoshis`, `finney`, `bits` and `bitcoin`; the time units are `seconds`, `minutes`, `hours`, `days` and `weeks`;
`wei`, `gwei` and `ether` are porting units. All are lowered to integer scale factors. See
[Types & Operators](../language/types.md) and [Global Variables](../language/globals.md#globally-available-units).

## Inline assembly

The text inside `assembly { ... }` is classified as either structured Yul or a native BCH opcode sequence. Yul
has its own lexer/parser and lowering boundary, including functions, loops, memory, supported EVM-context shims,
and virtual storage slots. A parsed Yul builtin without a sound BCH lowering produces a named diagnostic.

See [Inline Assembly](../language/assembly.md) and
[EVM Storage & ERC-7201 Compatibility](../language/evm-storage-compat.md).

## Grammar and compatibility transforms

The compiler's Solidity compatibility transformations run around the parser and therefore cannot always be
represented as one context-free grammar production. The emitted artifact and compiler diagnostics are the
authority for whether a particular source shape is supported by a selected option set.
