# SolidCash for Visual Studio Code

Syntax highlighting, hover documentation, code navigation, bracket matching, comments, folding,
indentation, and starter snippets for SolidCash (`.scash`) smart contracts.

## Features

### Syntax highlighting

The TextMate grammar covers the Solidity-compatible surface as well as SolidCash features including
BCH units and cryptographic types, state collections, lifecycle modifiers, transaction
introspection, ABI helpers, and locking-bytecode constructors.

Inside `assembly { ... }` blocks it highlights Bitcoin Script opcodes, the Yul control keywords and
`:=` / `->`, the supported Yul builtins (`sload`, `mstore`, `iszero`, `caller`, `log0`, ...) and the
`.slot` / `.offset` accessors. Builtins the compiler rejects (`create`, `create2`, `verbatim_*`, `pc`,
`datasize`, `dataoffset`, `datacopy`, `linkersymbol`, `leave`, `byte`) are scoped as invalid, so they
read as errors before you compile. Nested Yul blocks keep assembly scoping.

### Hover documentation

Hovering a token shows a short description with a link to the matching page on
[solidcash.org](https://solidcash.org/docs):

- keywords and declarations (`contract`, `library`, `modifier`, `require`, `emit`, `unchecked`, ...)
- visibility, data-location and lifecycle modifiers (`enumerable`, `packed`, `immutable`, `unsafe`,
  `upgrade`, `deploy`, `split`, `merge`, ...)
- types, including generated widths with their exact ranges (`bytes20`, `uint96`, `ufixed128x18`), the
  BCH types `pubkey`, `sig`, `datasig`, and the integer model: `int` / `uint` are the bounded,
  overflow-checked `int256` / `uint256` aliases, while `bigint` is the unbounded VM-native integer
- global functions with their signatures (`checkSig`, `checkDataSig`, `hash160`, `keccak256`,
  `toPaddedBytes`, `blockhash`, `ecrecover*`, ...)
- introspection and globals, resolved through the whole expression, so `tx.outputs[0].value`,
  `tx.inputs[i].tokenCategory`, `msg.sender`, `this.age` and `block.timestamp` each get their own
  entry
- member operations (`.lockingBytecode`, `.nftCommitment`, `.transferNft`, `.delegatecall`,
  `.entries`, ...), ABI helpers, value and time units
- Bitcoin Script opcodes inside `assembly { ... }` blocks

Hovering your own declarations shows the declaration line, what it is, where it lives, and the doc
comment above it (`///`, `/** ... */`, or a plain comment).

### Go to definition

Cmd+click (Ctrl+click on Windows and Linux), F12, and peek definition resolve:

- function, modifier, event, error, struct, enum, contract, interface, library and UDVT names
- state variables through `this.`, struct fields through a typed receiver, and enum members
- locals, function parameters, contract (constructor) parameters, and `let` bindings in assembly
- inherited members, following the `is` base list
- library and interface members (`SafeMath.sub(...)`, `IToken(addr).transfer(...)`)
- import paths, which are also underlined as clickable links, plus each name in an
  `import { A as B } from "..."` binding list

Imports resolve exactly as the compiler resolves them: relative to the importing file, then through
`node_modules` walking up from it, then as a sibling file, trying `.scash` before `.sol`. Unsaved
editor changes are used in preference to what is on disk.

### Symbols

Contracts and their members populate the outline view, breadcrumbs, and workspace symbol search
(Cmd+T / Ctrl+T).

## Limitations

Analysis is a tolerant scanner, not the compiler front end, so navigation keeps working while a file
is mid-edit but does not type check. Types are followed one level (a receiver's declared type), so a
member of a deeply chained expression may fall back to matching the name anywhere in the import
graph, which VS Code then offers as a short pick list.

## Development

Open this directory in VS Code and press `F5` to launch an Extension Development Host, then open a
`.scash` file. There is no build step: the extension is plain CommonJS with no dependencies, and only
`src/extension.js` touches the vscode API. The grammar, documentation database, scanner and resolver
are therefore checkable directly, and the providers are checked against a stubbed vscode API, without
installing anything:

```sh
npm test
```

Build an installable VSIX with:

```sh
npm run package
```

## References

The extension structure and TextMate scope conventions were informed by the MIT-licensed
[CashScript VS Code extension](https://github.com/CashScript/vscode-cashscript) and
[Solidity VS Code extension](https://github.com/juanfranblanco/vscode-solidity). The supported
language tokens are derived from `packages/solidc/src/grammar/SolidCash.g4` in this repository, the
builtin signatures from `packages/solidc/src/ast/Globals.ts`, and the descriptions from the
`website/docs` and `packages/solidc/docs` pages they link to.
