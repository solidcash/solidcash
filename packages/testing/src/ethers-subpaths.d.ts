// ethers v6 exposes its API via subpath exports (`ethers/abi`, `ethers/address`, ...) that ship runtime JS but no
// per-subpath type declarations. ethers-shim.ts re-exports from those subpaths (to avoid recursing through a
// project-wide `ethers` alias); these ambient declarations point their TYPES at the ethers root so the shim
// type-checks. Overlapping names across `export *` are de-duplicated by TS, which is fine - the shim's own
// getCreateAddress/getCreate2Address overrides are declared explicitly in ethers-shim.ts.
declare module 'ethers/abi' { export * from 'ethers'; }
declare module 'ethers/address' { export * from 'ethers'; }
declare module 'ethers/constants' { export * from 'ethers'; }
declare module 'ethers/contract' { export * from 'ethers'; }
declare module 'ethers/crypto' { export * from 'ethers'; }
declare module 'ethers/hash' { export * from 'ethers'; }
declare module 'ethers/providers' { export * from 'ethers'; }
declare module 'ethers/transaction' { export * from 'ethers'; }
declare module 'ethers/utils' { export * from 'ethers'; }
declare module 'ethers/wallet' { export * from 'ethers'; }
declare module 'ethers/wordlists' { export * from 'ethers'; }
