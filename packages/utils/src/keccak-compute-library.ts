// keccak256 "compute-and-commit" side-car library (result-NFT model). Distinct from the shipped inline
// side-car in keccak-library.ts: there the contract loads the blob and runs keccak on its OWN input budget;
// here a co-spent branded side-car input RUNS keccak in ITS OWN budget and returns the result in its NFT
// commitment, which the contract reads by introspection. See packages/solidc/docs/keccak-result-nft.md.
//
// Redeem = OP_PUSHBYTES_32 || salt(32) || COVENANT. The salt is the consuming contract's token category
// (branded). COVENANT is salt-INDEPENDENT (it reads the salt off the stack), so hash256(COVENANT) is a
// compile-time constant the contract bakes for the side-car integrity check.
//
// COVENANT (stack in [pad, P, salt], salt on top from the salt push): a CONDITIONAL brand check - if salt
// is zero (SHARED, for a stateless contract with no token category) skip it, else (BRANDED) verify input-0's
// token category == salt (spendable only alongside the contract of that category). Then drop pad, R =
// keccak(P) on a clean stack (EVM byte order), enforce the recreation output (INPUTINDEX + TXOUTPUTCOUNT -
// TXINPUTCOUNT = the last output for a single side-car; each of N side-cars maps to its own output) commits R,
// and self-preserve it. Generated from keccak-poc/gen-compute-sidecar.mjs (the regen tool) - the compiler's
// contract-side offsets + the SDK builder MUST match it byte-for-byte. STATEFUL variant below self-preserves
// via OP_INPUTINDEX (block-layout slot) instead of the offset-from-end formula.
import { hash256 } from './hash.js';
import type { Artifact } from './artifact.js';

/** The full computing-side-car COVENANT bytecode (brand + inline keccak + commit + self-preserve). 2394 B. */
export const KECCAK256_COMPUTE_COVENANT =
  '762000000000000000000000000000000000000000000000000000000000000000008763756700ce01207f758868774de00400795679865b79866079860115798652795879865d7986011279860117798654795a79865f7986011479860119798656795c79860111798601167986011b798658795e79860113798601187986011d7986007954797651987c013f998586557954797651987c013f998586557954797651987c013f998586557954797651987c013f998586557959797651987c013f9985865a7955798601117955798676012c987c0114998501187955798676012b987c01159985011f79557986760115987c012b9985012679557986765e987c0132998501127957798676011c987c01249985011979577986760114987c012c9985011b795c79867653987c013d99850122795c798676012d987c011399850129795c798676013d987c5399850115795e79867651987c013f9985011c795e79867656987c013a99850123795e7986760119987c01279985012a795e79867658987c01389985012c7901137986760112987c012e9985011d7960798676011b987c01259985011f7901157986760124987c011c998501267901157986765a987c01369985012d7901157986765f987c0131998501347901157986760138987c5899850120790117798676013e987c52998501277901177986760137987c599985012e7901177986760127987c01199985013079011c7986760129987c01179985013779011c79867652987c013e99850079557908ffffffffffffffff86557984865279527908ffffffffffffffff86577984865479547908ffffffffffffffff86547984865679567908ffffffffffffffff86567984865879587908ffffffffffffffff86587984865a795f7908ffffffffffffffff865f7984865c795c7908ffffffffffffffff8601117984865e795e7908ffffffffffffffff865e7984866079607908ffffffffffffffff866079848601127901127908ffffffffffffffff86011279848601147901197908ffffffffffffffff86011979848601167901167908ffffffffffffffff86011b79848601187901187908ffffffffffffffff860118798486011a79011a7908ffffffffffffffff86011a798486011c79011c7908ffffffffffffffff86011c798486011e7901237908ffffffffffffffff86012379848601207901207908ffffffffffffffff86012579848601227901227908ffffffffffffffff86012279848601247901247908ffffffffffffffff86012479848601267901267908ffffffffffffffff860126798486012879012d7908ffffffffffffffff86012d798486012a79012a7908ffffffffffffffff86012f798486012c79012c7908ffffffffffffffff86012c798486012e79012e7908ffffffffffffffff86012e79848601307901307908ffffffffffffffff86013079848601197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a755289517e82028800970288007c9402880097007c807e8251947f0180857e6b0800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000000800000000000000006c650288007f6b587f7cbc7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c587f7cbc7b7c7e7c7501197901197901197901197901197901197901197901197901197959790280007f77587f75860119795a7901787f77587f75860119795b7901707f77587f75860119795c7901687f77587f75860119795d7901607f77587f75860119795e7901587f77587f75860119795f7901507f77587f7586011979607901487f77587f758601197901117901407f77587f758601197901127901387f77587f758601197901137901307f77587f758601197901147901287f77587f758601197901157901207f77587f758601197901167901187f77587f7586011979011779607f77587f7586011979011879587f77587f7586011979011979587f758601197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a7501197a75528a08000000000000000186528a08000000000000808286528a08800000000000808a86528a08800000008000800086528a08000000000000808b86528a08000000008000000186528a08800000008000808186528a08800000000000800986528a08000000000000008a86528a08000000000000008886528a08000000008000800986528a08000000008000000a86528a08000000008000808b86528a08800000000000008b86528a08800000000000808986528a08800000000000800386528a08800000000000800286528a08800000000000008086528a08000000000000800a86528a08800000008000000a86528a08800000008000808186528a08800000000000808086528a08000000008000000186528a088000000080008008866c82009c6675bc7cbc7e7cbc7e7cbc7e777777777777777777777777777777777777777777c0c493c39476d27b88c0c778cd88c0ce78d1887551';

/** hash256(COVENANT); baked into the contract's side-car integrity check. */
export const KECCAK256_COMPUTE_COVENANT_HASH =
  '911e001711093698434a5851359f8ac65cb64c7eb47b713723c87d8d1f0014a0';

// STATEFUL variant. The stateless covenant self-preserves at the OUTPUT offset-from-end
// (INPUTINDEX + TXOUTPUTCOUNT - TXINPUTCOUNT), which equals the side-car index only when input/output counts
// match - true for the balanced stateless co-spend, but NOT for a stateful tx (funders, change, entries). A
// stateful side-car rides a block-layout keccakSideCar slot where its INPUT and OUTPUT share the same absolute
// index, so it self-preserves via the ACTIVE INPUT INDEX (OP_INPUTINDEX) directly. The only byte difference is
// the tail: `c0 c4 93 c3 94` (INPUTINDEX TXOUTPUTCOUNT ADD TXINPUTCOUNT SUB) -> `c0` (INPUTINDEX).
const STATELESS_SELFPRES_TAIL = 'c0c493c39476d27b88c0c778cd88c0ce78d1887551';
const STATEFUL_SELFPRES_TAIL = 'c076d27b88c0c778cd88c0ce78d1887551';

/** The STATEFUL computing-side-car COVENANT (self-preserves via OP_INPUTINDEX). 2390 B. */
export const KECCAK256_COMPUTE_STATEFUL_COVENANT =
  KECCAK256_COMPUTE_COVENANT.slice(0, -STATELESS_SELFPRES_TAIL.length) + STATEFUL_SELFPRES_TAIL;

/** hash256(STATEFUL COVENANT); baked into a stateful contract's side-car integrity check. */
export const KECCAK256_COMPUTE_STATEFUL_COVENANT_HASH =
  '9e2d6fd30973ec8e0b4056c9c6a6180a32893b3612548a57e28bf512af64aedc';

/** Redeem salt-push prefix: OP_PUSHBYTES_32 (0x20) + 32 salt bytes. COVENANT begins at this offset. */
export const KECCAK256_COMPUTE_SALT_PREFIX_LENGTH = 33;

/** Default op-budget pad (bytes) the SDK puts in the side-car unlocking so its input funds ~1 keccak block. */
export const KECCAK256_COMPUTE_PAD_LENGTH = 1000;

const hexToBytes = (h: string): Uint8Array => Uint8Array.from(h.match(/.{2}/g)!.map((b) => parseInt(b, 16)));

const COVENANT_BYTES = hexToBytes(KECCAK256_COMPUTE_COVENANT);
const STATEFUL_COVENANT_BYTES = hexToBytes(KECCAK256_COMPUTE_STATEFUL_COVENANT);

/**
 * Build the computing side-car redeem: OP_PUSHBYTES_32 || salt(32) || COVENANT.
 * salt = the consuming contract's token category (branded, 32 bytes). `stateful` selects the OP_INPUTINDEX
 * self-preservation variant (a block-layout keccakSideCar slot) over the stateless offset-from-end one.
 */
export function buildKeccakComputeRedeem(salt: Uint8Array, stateful = false): Uint8Array {
  if (salt.length !== 32) throw new Error('keccak compute side-car salt must be 32 bytes');
  return Uint8Array.from([0x20, ...salt, ...(stateful ? STATEFUL_COVENANT_BYTES : COVENANT_BYTES)]);
}

/** P2SH32 locking bytecode for the computing side-car: OP_HASH256 <hash256(redeem)> OP_EQUAL. */
export function keccakComputeLockingBytecode(salt: Uint8Array, stateful = false): Uint8Array {
  return Uint8Array.from([0xaa, 0x20, ...hash256(buildKeccakComputeRedeem(salt, stateful)), 0x87]);
}

/**
 * P2SH32 locking bytecode of the SHARED-salt STATEFUL keccak side-car. An ecrecoverEvm loop verifies its per-iteration
 * keccak side-car's integrity with OP_UTXOBYTECODE == this constant (a cheap, unambiguous 35-byte compare) instead of
 * extracting + hashing the covenant from the read unlocking. Loop keccak side-cars are always shared-salt + stateful
 * (forward self-preserving). Computed from the covenant at load, so it tracks any covenant change.
 */
export const KECCAK256_COMPUTE_STATEFUL_SHARED_LOCK = keccakComputeLockingBytecode(new Uint8Array(32), true);

/**
 * The result-NFT commitment for a single keccak256 result: the 32-byte hash in EVM byte order, verbatim.
 * (The genvar keccak already emits EVM-endian output; the side-car commits it unchanged.)
 */
export function keccakComputeResultCommitment(hash: Uint8Array): Uint8Array {
  if (hash.length !== 32) throw new Error('keccak result must be 32 bytes');
  return hash;
}

/**
 * The minimum keccak256 compute side-car instances a contract needs deployed at creation time, read from its
 * compiled artifact. `minInstances` covers the largest single function call (each call co-spends its own
 * side-car, one per keccak256 in the function). `unbounded` = a function hashes inside a loop, so the runtime
 * need exceeds the static minimum - provision extra. Returns undefined when the contract uses no keccak256.
 */
export function keccakSideCarRequirement(
  artifact: Artifact,
): { minInstances: number; unbounded: boolean } | undefined {
  const lib = artifact.externalLibraries?.find((l) => l.name === 'keccak256' && l.resultNft);
  return lib ? { minInstances: lib.minInstances ?? 0, unbounded: lib.unbounded ?? false } : undefined;
}
