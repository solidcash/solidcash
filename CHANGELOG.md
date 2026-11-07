# Changelog

## 0.50.0

SolidCash's version numbers now depart from CashScript's: 0.50.0 follows 0.14.0-beta.1 and tracks no CashScript release.
Source files need `pragma solidcash ^0.50.0`, and all six packages move together.

- The framed validator is 4,906 bytes. Every framed address differs from an earlier build's, so deploy a new category.
- A facet recreates itself, so a stranger cannot sweep the coins every composition of a build shares.
- A record is named by its input if it is spent, and by its output, or kept at its index, if it is created.
- An internal helper must be of the caller's context category.
- A call takes a deployment's pools in an order of its own, and a frame leaves unspent the data records it only counts.
- A slow server or a node's refusal ends a call's plan search with that error, rather than another plan's refusal.
- A send keeps the relay rules when its provider publishes relaxed limits, as a mock and a devnet do. It had lost them, so
  a below-dust output settled there.
- A returning call that omits an argument its record binds is refused by name, where it crashed the compiler.
- A parent's local no longer resolves into a child's body when a deploy folds, and the direct path orders address keys as
  framed does.
- An external call's arguments and guards can read `block.number` on a root call.

### Known issues

- On the direct convention, a nested callee's external call under a false guard on `block.number` or `block.timestamp`
  spends the callee anyway and lands the wrong state, because the guard is not published on those paths. A false guard on
  state or a constant fails closed there. Root calls and the framed convention are not affected.
- `block.number` in a nested callee's external-call arguments is still unresolved on the direct convention.

## 0.14.0-beta.1

Release-candidate notes: see [`docs/release/0.14.0/RELEASE_NOTES_0.14.0.md`](docs/release/0.14.0/RELEASE_NOTES_0.14.0.md).
Solidity compatibility: see
[`docs/release/0.14.0/SOLIDITY_COMPATIBILITY_0.14.0.md`](docs/release/0.14.0/SOLIDITY_COMPATIBILITY_0.14.0.md).

### Supported in this release

- Solidity-style integer types and checked/unchecked arithmetic, structs, fixed and dynamic arrays, mappings,
  inheritance, modifiers, events, declared errors, ABI helpers, and the documented lowerable Yul subset.
- Stateful contracts backed by CashToken NFT commitments, including entry-backed mappings, chunked arrays,
  events, and the documented deploy, upgrade, destroy, split, and merge builders.
- The built-in proxy profile for scalar and data-NFT state, deployed through `upgrades.deployProxy`.
- A Hardhat-style project workflow through `@solidcash/testing` and SolidHat.
- Six aligned 0.14.0-beta.1 packages with verified exports, declarations, embedded-source maps, CLIs, and installation
  from release tarballs.

### Experimental profiles

- Composed external state mutation and custom delegate-forwarding shapes beyond the built-in proxy profile.
- Message-bus **kernel** composition. Shapes outside the frozen proof inventory stay fail-closed.
- Solidity source shapes outside the compatibility-manifest rows.

Experimental behavior is not part of the stable compatibility promise; construction must stop with a named
diagnostic when the required transaction shape cannot be produced.

### Kernel beta (message-bus calling convention)

- A compiler convention, not a second protocol; the envelope (`L3C1` / `L3BUS1`) and journal rules are unchanged.
- Admitted handlers compile as `OP_DEFINE` bodies behind one row-loop wrapper
  (`selector 53434231`, `artifact.messageBus.convention === 'kernel-row-loop'`).
- Executable surface is exactly `scripts/kernel-beta-manifest.json`; `yarn test:kernel-beta` is the gate.
- Beta limits: MarketplaceV1's kernel route is compile-compatibility evidence only (12,102 bytes over the
  10,000-byte per-input limit); dormant `0x11` read-carrier / dense final-flush publication is off; `split` /
  `merge` / `selfdestruct` / `unsafe(0|1)` / foreign `delegatecall` remain `KERNEL_*`.
