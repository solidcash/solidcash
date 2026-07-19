// Minimal TypeChain stand-in. Only the `*__factory` values are used at runtime, solely as
// `{ interface: X__factory.createInterface() }` to hand our (best-effort) revertedWithCustomError matcher an
// ABI to name a custom error. The matcher matches by error name, so an empty interface is sufficient here.
const makeFactory = (): { createInterface: () => Record<string, unknown> } => ({ createInterface: () => ({}) });
export const IERC20Errors__factory = makeFactory();
export const ECDSA__factory = makeFactory();
export const OwnableUpgradeable__factory = makeFactory();
export const Initializable__factory = makeFactory();
// Type-only names imported elsewhere resolve to `any` via the .d-less stub (esbuild strips type imports).
export type Unicrow = any;
export type UnicrowDispute = any;
export type UnicrowArbitrator = any;
export type UnicrowClaim = any;
