/**
 * The identity output: output 0 of a genesis, which holds the BCMR authority of the categories the genesis creates
 * (CHIP-BCMR, "Zeroth-Descendant Transaction Chains").
 *
 * Whoever spends an identity output moves that authority, so it is never a master: every call spends a master,
 * which would end a published registry and let any caller publish another. Every genesis the SDK builds therefore
 * leads with an identity output held under one of five policies (docs/bcmr/DESIGN.md, 4.2): `key` (the default),
 * `authguard` (opt-in), `frozen`, `burned` and `governed` (section 9).
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { hash256 } from '@solidcash/utils';
import type { Output, Unlocker, Utxo } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { addressToLockScript } from '../utils.js';
import { satoshisAtLeastDust } from '../framed/composer/dust.js';
import { ownCoinRefusal } from '../framed/deploy/own-coin.js';
import { governedGuardLockingBytecode, type GovernedGuard } from './governed.js';
import { BcmrError } from './publication.js';

/** How a deployment holds its identity output. */
export type IdentityPolicy =
  /** A token-free output at a lock: the deployer's when none is stated. */
  | { readonly kind: 'key'; readonly lockingBytecode?: Uint8Array | string }
  /**
   * The AuthGuard covenant (CHIP-2023-08), opt-in: only a transaction whose input 1 holds the AuthKey, an immutable
   * NFT of its own category, spends it. That category is never the contract's: anyone may spend the contract's event
   * NFTs after 144 blocks, and AuthGuard accepts any immutable NFT of its category. Here the genesis mints that category.
   */
  | {
    readonly kind: 'authguard';
    /** A token-free coin at vout 0 whose txid becomes the AuthKey category. */
    readonly authKeyFunding: Utxo;
    /** The coin's unlocker; the deployment's funder when omitted. */
    readonly authKeyFunder?: Unlocker;
    /** Where the AuthKey goes; the deployer's lock when omitted. */
    readonly authKeyRecipient?: Uint8Array | string;
    readonly authKeyCategory?: never;
  }
  /** The AuthGuard keyed to an AuthKey category minted beforehand: the genesis mints no AuthKey. */
  | {
    readonly kind: 'authguard';
    /** The existing AuthKey category, whose holder keeps the AuthKey. */
    readonly authKeyCategory: string;
    readonly authKeyFunding?: never;
    readonly authKeyFunder?: never;
    readonly authKeyRecipient?: never;
  }
  /** An unspendable lock that is not a data carrier: the genesis stays the authhead, so its registry is final. */
  | { readonly kind: 'frozen' }
  /** `OP_RETURN`: the identity is burned and clients archive it. For categories with no user-facing token. */
  | { readonly kind: 'burned' }
  /**
   * The contract's own access control decides: a guard spends only beside the contract's matured
   * `MetadataUpdated(bytes32 registryHash, bytes32 identityTxid)` event naming its outpoint (governed.ts).
   */
  | { readonly kind: 'governed' };

export type IdentityPolicyKind = IdentityPolicy['kind'];

/** Where an identity output sits and how it is held. */
export interface IdentityRecord {
  readonly txid: string;
  readonly vout: 0;
  readonly satoshis: bigint;
  readonly policy: IdentityPolicyKind;
  readonly lockingBytecode: Uint8Array;
  /** The AuthKey category, under `authguard`. */
  readonly authKeyCategory?: string;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function assertCategory(category: string, role: string): void {
  if (!/^[0-9a-f]{64}$/.test(category)) throw new BcmrError(`${role} is 64 lowercase hex characters, got "${category}"`);
}

/** A lock stated as locking bytecode or as a CashAddress. */
export function lockOf(lock: Uint8Array | string): Uint8Array {
  return typeof lock === 'string' ? addressToLockScript(lock) : lock;
}

/** The AuthKey category an `authguard` policy keys its guard to, lowercase. */
export function authKeyCategoryOf(policy: Extract<IdentityPolicy, { kind: 'authguard' }>): string {
  if ((policy.authKeyFunding === undefined) === (policy.authKeyCategory === undefined)) {
    throw new BcmrError('an authguard identity states exactly one of authKeyFunding and authKeyCategory');
  }
  return (policy.authKeyFunding === undefined ? policy.authKeyCategory : policy.authKeyFunding.txid).toLowerCase();
}

/** True when `lockingBytecode` is a P2PKH lock. */
export function isP2pkhLock(lockingBytecode: Uint8Array): boolean {
  return lockingBytecode.length === 25 && lockingBytecode[0] === 0x76 && lockingBytecode[1] === 0xa9
    && lockingBytecode[2] === 0x14 && lockingBytecode[23] === 0x88 && lockingBytecode[24] === 0xac;
}

/**
 * AuthGuard's script after its `tokenId` push, as CashScript 0.8 compiles `AuthGuard.cash`:
 * `OP_1 OP_UTXOTOKENCATEGORY OP_EQUALVERIFY OP_1 OP_UTXOTOKENAMOUNT OP_0 OP_NUMEQUALVERIFY OP_IF OP_0 OP_OUTPUTBYTECODE
 * OP_INPUTINDEX OP_UTXOBYTECODE OP_EQUALVERIFY OP_ENDIF OP_1`. With the push it is the 48 bytes and 10 operations
 * the source states.
 */
const AUTHGUARD_BODY = Uint8Array.of(
  0x51, 0xce, 0x88, 0x51, 0xd0, 0x00, 0x9d, 0x63, 0x00, 0xcd, 0xc0, 0xc7, 0x88, 0x68, 0x51,
);

/** The AuthGuard redeem script keyed to `authKeyCategory`. */
export function authGuardRedeemScript(authKeyCategory: string): Uint8Array {
  assertCategory(authKeyCategory, 'an AuthKey category');
  // OP_UTXOTOKENCATEGORY answers in the VM's byte order, the reverse of a category's hex.
  return concat([encodeDataPush(hexToBin(authKeyCategory).reverse()), AUTHGUARD_BODY]);
}

/** The P2SH32 lock of the AuthGuard keyed to `authKeyCategory`. */
export function authGuardLockingBytecode(authKeyCategory: string): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(authGuardRedeemScript(authKeyCategory)));
}

/** Spends an AuthGuard. `keepGuarded` makes it recreate itself at output 0; false releases the identity. */
export function authGuardUnlocker(authKeyCategory: string, keepGuarded = true): Unlocker {
  const redeemScript = authGuardRedeemScript(authKeyCategory);
  return {
    generateLockingBytecode: () => authGuardLockingBytecode(authKeyCategory),
    generateUnlockingBytecode: () => concat([
      encodeDataPush(keepGuarded ? Uint8Array.of(1) : new Uint8Array(0)),
      encodeDataPush(redeemScript),
    ]),
  };
}

/** The redeem script of a frozen identity: `OP_RETURN`, so no spend of it can succeed. */
export const FROZEN_REDEEM_SCRIPT = Uint8Array.of(0x6a);

/** The lock of a frozen identity: P2SH32 of `OP_RETURN`. Anyone holding the redeem script can check it. */
export function frozenLockingBytecode(): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(FROZEN_REDEEM_SCRIPT));
}

/** The lock of a burned identity: a data carrier, which ends the authchain. */
export const BURNED_LOCKING_BYTECODE = Uint8Array.of(0x6a);

/** The output that holds an identity under `kind` at `lock` (ignored for `frozen` and `burned`). */
export function identityOutput(kind: IdentityPolicyKind, lock: Uint8Array): Output {
  if (kind === 'burned') return { to: BURNED_LOCKING_BYTECODE, amount: 0n };
  const to = kind === 'frozen' ? frozenLockingBytecode() : lock;
  return { to, amount: satoshisAtLeastDust(0n, { to }) };
}

/** The identity part of a genesis: its output 0, the inputs it adds and the outputs after the publication. */
export interface GenesisIdentity {
  readonly policy: IdentityPolicyKind;
  readonly output: Output;
  /** Inputs after the funding coin: the AuthKey category's genesis coin, under `authguard` when it mints the AuthKey. */
  readonly inputs: readonly { readonly utxo: Utxo; readonly unlocker: Unlocker }[];
  /** Outputs after the publication: the AuthKey, under `authguard` when the genesis mints it. */
  readonly trailing: readonly Output[];
  readonly authKeyCategory?: string;
}

/** Plans a genesis's identity under `policy`; `deployerLock` is the default key lock and AuthKey recipient. */
export async function planGenesisIdentity(options: {
  readonly provider: NetworkProvider;
  readonly category: string;
  readonly policy?: IdentityPolicy;
  readonly deployerLock: Uint8Array;
  readonly funder: Unlocker;
  /** The guard of a `governed` identity, keyed to the contract's MetadataUpdated event lock. */
  readonly governed?: GovernedGuard;
}): Promise<GenesisIdentity> {
  const policy = options.policy ?? { kind: 'key' };
  if (policy.kind === 'key') {
    const lock = policy.lockingBytecode === undefined ? options.deployerLock : lockOf(policy.lockingBytecode);
    return { policy: 'key', output: identityOutput('key', lock), inputs: [], trailing: [] };
  }
  if (policy.kind === 'governed') {
    if (options.governed === undefined) throw new BcmrError('a governed identity needs its contract\'s event lock');
    const to = governedGuardLockingBytecode(options.governed);
    return { policy: 'governed', output: { to, amount: satoshisAtLeastDust(0n, { to }) }, inputs: [], trailing: [] };
  }
  if (policy.kind === 'frozen' || policy.kind === 'burned') {
    return { policy: policy.kind, output: identityOutput(policy.kind, new Uint8Array(0)), inputs: [], trailing: [] };
  }
  const funding = policy.authKeyFunding;
  const authKeyCategory = authKeyCategoryOf(policy);
  assertCategory(authKeyCategory, funding === undefined ? 'authKeyCategory' : 'an AuthKey funding txid');
  if (funding !== undefined && funding.vout !== 0) {
    throw new BcmrError(`the AuthKey funding coin must be at vout 0 to create a category, got vout ${funding.vout}`);
  }
  if (authKeyCategory === options.category.toLowerCase()) {
    throw new BcmrError('the AuthKey category must differ from the contract category');
  }
  const guard = authGuardLockingBytecode(authKeyCategory);
  const output = { to: guard, amount: satoshisAtLeastDust(0n, { to: guard }) };
  // A category minted beforehand: its holder already has the AuthKey.
  if (funding === undefined) return { policy: 'authguard', output, inputs: [], trailing: [], authKeyCategory };
  const unlocker = policy.authKeyFunder ?? options.funder;
  const refusal = await ownCoinRefusal(
    options.provider, funding, unlocker.generateLockingBytecode(), { role: 'AuthKey funder', tokenFree: true },
  );
  if (refusal !== undefined) throw new BcmrError(refusal);
  const recipient = policy.authKeyRecipient === undefined ? options.deployerLock : lockOf(policy.authKeyRecipient);
  const token = { category: authKeyCategory, amount: 0n, nft: { capability: 'none' as const, commitment: '' } };
  return {
    policy: 'authguard',
    output,
    inputs: [{ utxo: funding, unlocker }],
    trailing: [{ to: recipient, amount: satoshisAtLeastDust(0n, { to: recipient, token }), token }],
    authKeyCategory,
  };
}
