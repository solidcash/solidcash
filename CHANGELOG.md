# Changelog

## 0.14.0-beta.1

Release-candidate notes, drafted as 0.13.1: see [`docs/release/0.13.1/RELEASE_NOTES_0.13.1.md`](docs/release/0.13.1/RELEASE_NOTES_0.13.1.md).
Solidity compatibility: see
[`docs/release/0.13.1/SOLIDITY_COMPATIBILITY_0.13.1.md`](docs/release/0.13.1/SOLIDITY_COMPATIBILITY_0.13.1.md).

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
