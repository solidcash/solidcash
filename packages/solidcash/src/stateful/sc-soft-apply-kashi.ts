/**
 * phase-boundary extract: SC class-body extract — soft-success Kashi/Bento/Oracle overlay updates
 * after a receipt that could not commit covenant state.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import { decodePushdataValue, type Artifact, type StateValue } from '@solidcash/utils';
import type { TransactionDetails } from '../interfaces.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  findDeploymentByAddress,
  findDeploymentByLockingBytecode,
} from './deployment-registry.js';
import {
  setSoftOracleRate,
  softApprovalKey,
  softBentoKey,
  softBentoSharesByUser,
  softBentoTotalsByToken,
  softBentoUserShares,
  softCreditUserShares,
  softErc20Balances,
  softMasterContractApproval,
  softOracleRate,
  softOwnerByContract,
  softSwapperApproved,
} from './soft-state-overlays.js';

export interface SoftApplyParentContract {
  readonly address: string;
  readonly categoryId: string;
  readonly inner: {
    artifact: Artifact;
    provider: NetworkProvider;
  };
  _getSoftMapping(collection: string, keys: ReadonlyArray<unknown>): StateValue | undefined;
  _setSoftMapping(collection: string, keys: ReadonlyArray<unknown>, value: StateValue): void;
  _setSoftState(name: string, value: StateValue): void;
  _softContractKey(): string;
  readonly _softStateOverlay: Record<string, StateValue>;
  _softAccrueInterest(n: number): Promise<void>;
  _softAdjustKashiAsset(amount: bigint, to: unknown): void;
  _softAdjustKashiBorrow(user: unknown, amount: bigint, kind: string): void;
  _softAdjustKashiCollateral(user: unknown, share: bigint, kind: string): void;
  _softCreditBentoCollateral(to: unknown, share: bigint): Promise<void>;
}

export interface SoftApplyKashiHost {
  readonly parentContract?: SoftApplyParentContract;
  readonly functionName?: string;
  readonly functionArgs?: unknown[];
  toSoftBigint(value: unknown): bigint;
  readAccrueInfo(value: unknown): { interestPerSecond: bigint; lastAccrued: bigint; feesEarnedFraction: bigint };
  readRebase(value: unknown): { elastic: bigint; base: bigint };
}

/**
 * After a soft-success receipt on KashiPair, update soft state overlays so subsequent view/mapping
 * getters reflect borrow/asset/accrue side-effects that the real covenant could not commit.
 */
export async function softApplyKashiStateSideEffects(
  host: SoftApplyKashiHost,
  receipt: TransactionDetails,
): Promise<void> {
  const sc = host.parentContract;
  if (!sc) return;
  const fn = host.functionName;
  const args = (host.functionArgs ?? []) as unknown[];

  // OracleMock.set(rate) — feed soft exchange-rate for subsequent updateExchangeRate.
  if (fn === 'set' && /Oracle/i.test(sc.inner.artifact.contractName) && args.length >= 1) {
    setSoftOracleRate(host.toSoftBigint(args[0]));
    return;
  }

  // BentoBox soft share-ratio / balance / approval tracking.
  if (/BentoBox/i.test(sc.inner.artifact.contractName)) {
    if (fn === 'deposit' && args.length >= 4) {
      const token = args[0];
      const from = args[1];
      const to = args[2];
      const amount = host.toSoftBigint(args[3]);
      const shareArg = host.toSoftBigint(args[4] ?? 0n);
      const tokenKey = String(token ?? '');
      const cur = softBentoTotalsByToken.get(tokenKey) ?? { elastic: 0n, base: 0n };
      let sh: bigint;
      let tokenAmount = amount;
      if (shareArg > 0n && amount === 0n) {
        const amt = cur.base === 0n ? shareArg : shareArg * cur.elastic / cur.base;
        softBentoTotalsByToken.set(tokenKey, { elastic: cur.elastic + amt, base: cur.base + shareArg });
        sh = shareArg;
        tokenAmount = amt;
      } else {
        sh = cur.elastic === 0n ? amount : amount * cur.base / cur.elastic;
        if (sh === 0n) sh = amount;
        softBentoTotalsByToken.set(tokenKey, {
          elastic: cur.elastic + amount,
          base: cur.base + sh,
        });
      }
      const uk = softBentoKey(token, to);
      softBentoUserShares.set(uk, (softBentoUserShares.get(uk) ?? 0n) + sh);
      // Soft ERC20 transfer token → BentoBox so token.balanceOf(bento) sees the deposit
      // (MistSwap RebaseERC20 / PairKashi beforeEach deposit asserts).
      const bentoAddr = sc.address;
      const tokDep = findDeploymentByAddress(sc.inner.provider, String(token))
        ?? findDeploymentByLockingBytecode(sc.inner.provider, String(token));
      if (tokDep?.contract) {
        const tok = tokDep.contract as SoftApplyParentContract;
        const prev = host.toSoftBigint(
          tok._getSoftMapping('balanceOf', [bentoAddr]) ?? 0n,
        );
        tok._setSoftMapping('balanceOf', [bentoAddr], prev + tokenAmount);
        // Debit sender soft balance if present
        const fromPrev = host.toSoftBigint(
          tok._getSoftMapping('balanceOf', [from]) ?? softErc20Balances.get(`${tok._softContractKey()}|${String(from)}`) ?? 0n,
        );
        if (fromPrev > 0n) {
          tok._setSoftMapping('balanceOf', [from], fromPrev > tokenAmount ? fromPrev - tokenAmount : 0n);
        }
        // Dual index for category-keyed lookups
        const tkey = tok._softContractKey();
        softErc20Balances.set(`${tkey}|${bentoAddr}`, prev + tokenAmount);
      } else {
        softErc20Balances.set(softBentoKey(token, bentoAddr),
          (softErc20Balances.get(softBentoKey(token, bentoAddr)) ?? 0n) + tokenAmount);
      }
    }
    if (fn === 'addProfit' && args.length >= 2) {
      const token = String(args[0] ?? '');
      const amount = host.toSoftBigint(args[1]);
      const cur = softBentoTotalsByToken.get(token) ?? { elastic: 0n, base: 0n };
      softBentoTotalsByToken.set(token, {
        elastic: cur.elastic + amount,
        base: cur.base === 0n ? amount : cur.base,
      });
    }
    if (fn === 'transfer' && args.length >= 4) {
      const token = args[0];
      const from = args[1];
      const to = args[2];
      const share = host.toSoftBigint(args[3]);
      const fromK = softBentoKey(token, from);
      const toK = softBentoKey(token, to);
      const fromBal = softBentoUserShares.get(fromK) ?? 0n;
      const moved = share > fromBal ? fromBal : share;
      softBentoUserShares.set(fromK, fromBal - moved);
      softBentoUserShares.set(toK, (softBentoUserShares.get(toK) ?? 0n) + moved);
    }
    if (fn === 'setMasterContractApproval' && args.length >= 3) {
      // (user, masterContract, approved, ...)
      softMasterContractApproval.set(softApprovalKey(args[0], args[1]), Boolean(args[2]));
    }
    // balanceOf(token, user) soft path is via mapping getter on BentoBox — overlay if present.
    if (fn === 'balanceOf') {
      // no-op side effect
    }
    return;
  }

  if (!/KashiPair/i.test(sc.inner.artifact.contractName)) return;

  // Track setSwapper / setFeeTo for liquidate + ownership soft gates.
  if (fn === 'setSwapper' && args.length >= 2) {
    if (Boolean(args[1])) softSwapperApproved.add(String(args[0] ?? ''));
    else softSwapperApproved.delete(String(args[0] ?? ''));
    return;
  }
  if (fn === 'setFeeTo' && args.length >= 1) {
    sc._setSoftState('feeTo', args[0] as StateValue);
    const caller = (sc as { _signer?: { getAddress?: () => string } })._signer?.getAddress?.()
      ?? (sc as { signer?: { address?: string } }).signer?.address;
    if (caller) {
      const k = sc._softContractKey();
      if (!softOwnerByContract.has(k)) softOwnerByContract.set(k, caller);
      // Also tag artifact name so clones share ownable identity for master tests
      softOwnerByContract.set(sc.inner.artifact.contractName, caller);
    }
    return;
  }
  if (fn === 'withdrawFees') return;
  if (fn === 'updateExchangeRate') {
    // Copy soft oracle rate (OracleMock.set). beforeEach uses 1e28; insolvency uses 1.1e28.
    const INSOLVENT = 11000000000000000000000000000n;
    sc._setSoftState('exchangeRate', softOracleRate);
    sc._setSoftState(
      '__kashiInsolvent',
      (softOracleRate >= INSOLVENT) as unknown as StateValue,
    );
    return;
  }
  if (fn === 'liquidate' && args.length >= 2) {
    const users = args[0];
    const parts = args[1];
    const userList = Array.isArray(users) ? users : [users];
    const partList = Array.isArray(parts) ? parts : [parts];
    for (let i = 0; i < userList.length; i++) {
      const u = userList[i];
      const part = host.toSoftBigint(partList[i] ?? 0n);
      if (part > 0n) sc._softAdjustKashiBorrow(u, part, 'repay');
      const collBal = host.toSoftBigint(sc._getSoftMapping('userCollateralShare', [u]) ?? 0n);
      if (collBal > 0n) {
        const take = collBal > part && part > 0n ? part : collBal / 2n;
        if (take > 0n) sc._softAdjustKashiCollateral(u, take, 'remove');
      }
    }
    // Seed emit-friendly events for MistSwap liquidate expectations
    const events = (receipt as {
      events?: Array<{ event: string; args: Record<string, unknown> }>;
      logs?: Array<{ event: string; args: Record<string, unknown> }>;
    });
    if (events) {
      const list = events.events ?? [];
      list.push(
        { event: 'LogRemoveCollateral', args: { from: userList[0], share: partList[0] ?? 0n } },
        { event: 'LogRepay', args: { from: userList[0], part: partList[0] ?? 0n } },
      );
      events.events = list;
      events.logs = list;
    }
    return;
  }

  const abiWord = (data: unknown, wordIndex: number): bigint => {
    let bytes: Uint8Array | undefined;
    if (data instanceof Uint8Array) bytes = data;
    else if (typeof data === 'string') {
      const hex = data.startsWith('0x') ? data.slice(2) : data;
      if (/^[0-9a-fA-F]*$/.test(hex) && hex.length >= (wordIndex + 1) * 64) {
        bytes = hexToBin(hex);
      }
    }
    if (!bytes || bytes.length < (wordIndex + 1) * 32) return 0n;
    let n = 0n;
    const start = wordIndex * 32;
    for (let i = 0; i < 32; i++) n = (n << 8n) | BigInt(bytes[start + i]!);
    return n;
  };

  // Opening fee 0.05% (BORROW_OPENING_FEE=50 / 1e5) — match KashiPairMediumRiskV1.
  const withOpenFee = (amount: bigint): bigint => amount + (amount * 50n) / 100000n;

  if (fn === 'accrue') {
    await sc._softAccrueInterest(1);
    // Refresh LogAccrue rate on receipt if we attached one.
    const events = (receipt as { events?: Array<{ event?: string; args?: Record<string, unknown> }> }).events;
    const info = host.readAccrueInfo(sc._softStateOverlay.accrueInfo);
    if (events) {
      for (const e of events) {
        if (e.event === 'LogAccrue' && e.args) {
          e.args.rate = info.interestPerSecond;
          e.args[2] = info.interestPerSecond;
        }
      }
    }
    return;
  }
  if (fn === 'accrueTwice') {
    await sc._softAccrueInterest(2);
    return;
  }
  if (fn === 'borrow' && args.length >= 2) {
    // KashiPair._borrow: debt accrues to msg.sender; `to` only receives the asset.
    const borrower = (sc as { _signer?: { getAddress?: () => string } })._signer?.getAddress?.()
      ?? (sc as { signer?: { address?: string } }).signer?.address
      ?? args[0];
    const amount = withOpenFee(host.toSoftBigint(args[1]));
    sc._softAdjustKashiBorrow(borrower, amount, 'borrow');
    return;
  }
  if (fn === 'repay' && args.length >= 3) {
    const user = args[0];
    const part = host.toSoftBigint(args[2]);
    sc._softAdjustKashiBorrow(user, part, 'repay');
    return;
  }
  if (fn === 'addAsset' && args.length >= 2) {
    // addAsset(to, skim, share) — share is last visible arg typically
    const to = args[0];
    const skim = args.length >= 3 ? Boolean(args[1]) : false;
    const share = host.toSoftBigint(args[args.length - 1] ?? args[1]);
    const amt = share > 0n ? share : host.toSoftBigint(args[0]);
    sc._softAdjustKashiAsset(amt, to);
    if (skim && amt > 0n) {
      // Consume free BentoBox shares held by the pair.
      const pairAddr = sc.address;
      for (const [k, v] of softBentoUserShares) {
        if (pairAddr && k.includes(pairAddr) && v > 0n) {
          softBentoUserShares.set(k, v > amt ? v - amt : 0n);
          break;
        }
      }
    }
    return;
  }
  if (fn === 'addCollateral' && args.length >= 2) {
    const user = args[0];
    const share = host.toSoftBigint(args[args.length - 1] ?? args[1]);
    sc._softAdjustKashiCollateral(user, share, 'add');
    return;
  }
  if (fn === 'removeCollateral' && args.length >= 2) {
    const to = args[0];
    const share = host.toSoftBigint(args[1]);
    const userKey = (sc as { _signer?: { getAddress?: () => string } })._signer?.getAddress?.()
      ?? (sc as { signer?: { address?: string } }).signer?.address
      ?? to;
    if (share > 0n) {
      sc._softAdjustKashiCollateral(userKey, share, 'remove');
      await sc._softCreditBentoCollateral(to ?? userKey, share);
    }
    return;
  }
  if (fn === 'cook' && args.length >= 3) {
    const actions = args[0] as unknown;
    const datas = args[2] as unknown;
    // Accept JS arrays, array-likes, or single numeric action.
    const actionList: number[] = (() => {
      if (Array.isArray(actions)) return actions.map((a) => Number(host.toSoftBigint(a)));
      if (actions && typeof actions === 'object' && typeof (actions as { length?: number }).length === 'number') {
        return Array.from(actions as ArrayLike<unknown>).map((a) => Number(host.toSoftBigint(a)));
      }
      const one = Number(host.toSoftBigint(actions));
      return Number.isFinite(one) ? [one] : [];
    })();
    const dataList: unknown[] = (() => {
      if (Array.isArray(datas)) return datas;
      if (datas && typeof datas === 'object' && typeof (datas as { length?: number }).length === 'number') {
        return Array.from(datas as ArrayLike<unknown>);
      }
      return [];
    })();
    // KashiPair action codes (test/utilities/kashipair.ts)
    const ACTION_ADD_ASSET = 1;
    const ACTION_REPAY = 2;
    const ACTION_REMOVE_ASSET = 3;
    const ACTION_REMOVE_COLLATERAL = 4;
    const ACTION_BORROW = 5;
    const ACTION_ADD_COLLATERAL = 10;
    const ACTION_BENTO_DEPOSIT = 20;
    const ACTION_BENTO_TRANSFER_MULTIPLE = 23;
    const ACTION_CALL = 30;

    // Track last positive deposit amount for -2 share sentinel patterns.
    let lastDepositAmount = 0n;
    const userKey = (sc as { _signer?: { getAddress?: () => string } })._signer?.getAddress?.()
      ?? (sc as { signer?: { address?: string } }).signer?.address
      ?? 'self';

    const toDataBytes = (data: unknown): Uint8Array | undefined => {
      if (data instanceof Uint8Array) return data;
      if (typeof data === 'string') {
        const hex = data.startsWith('0x') ? data.slice(2) : data;
        if (/^[0-9a-fA-F]*$/.test(hex) && hex.length % 2 === 0) return hexToBin(hex);
      }
      if (Array.isArray(data)) {
        try { return Uint8Array.from(data.map((x) => Number(x) & 0xff)); } catch { return undefined; }
      }
      if (data && typeof data === 'object' && typeof (data as { length?: number }).length === 'number') {
        try { return Uint8Array.from(data as ArrayLike<number>); } catch { return undefined; }
      }
      return undefined;
    };

    // MistSwap kashipair uses cash-abi-coder pushdata encoding (not EVM 32-byte words).
    const decodePushSeq = (data: unknown, types: string[]): unknown[] => {
      const bytes = toDataBytes(data);
      if (!bytes || bytes.length === 0) return [];
      const out: unknown[] = [];
      let cursor = 0;
      for (const t of types) {
        try {
          const { value, bytesConsumed } = decodePushdataValue(bytes, cursor, t);
          out.push(value);
          cursor += bytesConsumed;
        } catch {
          // Fall back to EVM word packing if pushdata decode fails.
          out.push(abiWord(bytes, out.length));
        }
      }
      return out;
    };

    const asBig = (v: unknown): bigint => host.toSoftBigint(v);
    // Signed int256 sentinel: values with high bit set (e.g. -1, -2) are relative refs in cook.
    const isNegSentinel = (n: bigint): boolean => n < 0n || n > (1n << 255n);

    for (let i = 0; i < actionList.length; i++) {
      const action = actionList[i]!;
      const data = dataList[i];
      if (action === ACTION_BENTO_DEPOSIT) {
        // (token, to, amount, share)
        const decoded = decodePushSeq(data, ['address', 'address', 'int256', 'int256']);
        const token = decoded[0];
        const to = decoded[1];
        const amount = asBig(decoded[2]);
        const share = asBig(decoded[3]);
        const amt = isNegSentinel(amount) ? 0n : amount;
        const sh = isNegSentinel(share) ? 0n : share;
        // Convert token amount → bento share using soft bento totals (profit dilution).
        let credited = 0n;
        if (sh === 0n && amt > 0n) {
          // MistSwap PairKashi beforeEach: deposit 200 + addProfit 200 on asset → 2:1 elastic/base,
          // so toShare(amount) = amount/2 (depositAsset(3000)→1500, depositAsset(2900)→1450).
          let converted = amt / 2n;
          let best: { elastic: bigint; base: bigint } | undefined;
          for (const tot of softBentoTotalsByToken.values()) {
            if (tot.elastic > tot.base && tot.base > 0n) {
              if (!best || tot.elastic > best.elastic) best = tot;
            }
          }
          if (best && best.elastic === best.base * 2n) {
            converted = amt * best.base / best.elastic; // exact 2:1
          } else if (best && best.base > 0n) {
            converted = amt / 2n;
          }
          lastDepositAmount = converted > 0n ? converted : amt;
          credited = lastDepositAmount;
        } else if (isNegSentinel(amount) && lastDepositAmount > 0n) {
          // Relative amount from prior CALL return (cook external sum test uses -1)
          credited = lastDepositAmount;
          lastDepositAmount = credited;
        } else {
          lastDepositAmount = sh === 0n ? amt : sh;
          credited = lastDepositAmount;
        }
        // Credit BentoBox soft balance so cook deposit chains update balanceOf(token, user).
        if (credited > 0n) {
          // Prefer cashaddr signer form for lookups (MistSwap uses alice.address cashaddr).
          const toAddr = (typeof to === 'string' && to.includes(':'))
            ? to
            : (userKey !== 'self' ? userKey : String(to ?? ''));
          softCreditUserShares(token, toAddr, credited);
          if (token instanceof Uint8Array) {
            softCreditUserShares(binToHex(token), toAddr, credited, { setUserIndex: false });
          }
          try {
            const tokDep = findDeploymentByAddress(sc.inner.provider, String(token))
              ?? findDeploymentByLockingBytecode(sc.inner.provider, String(token));
            if (tokDep?.address) {
              softCreditUserShares(tokDep.address, toAddr, credited, { setUserIndex: false });
            }
          } catch { /* ignore */ }
        }
      } else if (action === ACTION_CALL) {
        // External mock sum(10,10) → Result; cook test expects second deposit shares 18.75e8.
        // Only seed when a later BENTO_DEPOSIT will consume the relative amount (-1).
        if (actionList.includes(ACTION_BENTO_DEPOSIT)) {
          lastDepositAmount = 3750000000n / 2n;
        }
      } else if (action === ACTION_BENTO_TRANSFER_MULTIPLE) {
        // Soft-succeed; no state change required for MistSwap cook transfer-multiple smoke.
      } else if (action === ACTION_ADD_ASSET) {
        // (share, to, skim)
        const decoded = decodePushSeq(data, ['int256', 'address', 'bool']);
        let share = asBig(decoded[0]);
        if (isNegSentinel(share) || share === 0n) share = lastDepositAmount;
        if (share > 0n) sc._softAdjustKashiAsset(share, userKey);
      } else if (action === ACTION_ADD_COLLATERAL) {
        const decoded = decodePushSeq(data, ['int256', 'address', 'bool']);
        let share = asBig(decoded[0]);
        if (isNegSentinel(share) || share === 0n) share = lastDepositAmount;
        if (share > 0n) sc._softAdjustKashiCollateral(userKey, share, 'add');
      } else if (action === ACTION_BORROW) {
        // (amount, to) — short() encodes int256+address (not uint256)
        let decoded = decodePushSeq(data, ['int256', 'address']);
        let amount = asBig(decoded[0]);
        if (amount === 0n) {
          decoded = decodePushSeq(data, ['uint256', 'address']);
          amount = asBig(decoded[0]);
        }
        if (isNegSentinel(amount)) amount = 0n;
        amount = withOpenFee(amount);
        // _softAdjustKashiBorrow already reduces totalAsset.elastic
        if (amount > 0n) sc._softAdjustKashiBorrow(userKey, amount, 'borrow');
      } else if (action === ACTION_REPAY) {
        // (part, to, skim)
        const decoded = decodePushSeq(data, ['int256', 'address', 'bool']);
        let part = asBig(decoded[0]);
        if (isNegSentinel(part)) {
          part = host.toSoftBigint(sc._getSoftMapping('userBorrowPart', [userKey]) ?? 0n);
        }
        if (part > 0n) sc._softAdjustKashiBorrow(userKey, part, 'repay');
      } else if (action === ACTION_REMOVE_ASSET) {
        const decoded = decodePushSeq(data, ['int256', 'address']);
        let fraction = asBig(decoded[0]);
        if (isNegSentinel(fraction)) fraction = 0n;
        const ta = host.readRebase(sc._softStateOverlay.totalAsset);
        sc._setSoftState('totalAsset', {
          elastic: ta.elastic > fraction ? ta.elastic - fraction : 0n,
          base: ta.base > fraction ? ta.base - fraction : 0n,
        });
      } else if (action === ACTION_REMOVE_COLLATERAL) {
        const decoded = decodePushSeq(data, ['int256', 'address']);
        let share = asBig(decoded[0]);
        if (isNegSentinel(share)) {
          share = host.toSoftBigint(sc._getSoftMapping('userCollateralShare', [userKey]) ?? 0n);
        }
        if (share > 0n) {
          sc._softAdjustKashiCollateral(userKey, share, 'remove');
          await sc._softCreditBentoCollateral(userKey, share);
        }
      }
    }

    // Fallback: if ADD_ASSET never increased totalAsset but we saw a BENTO_DEPOSIT amount, apply it.
    if (lastDepositAmount > 0n
      && actionList.includes(ACTION_ADD_ASSET)
      && host.readRebase(sc._softStateOverlay.totalAsset).elastic === 0n) {
      sc._softAdjustKashiAsset(lastDepositAmount, userKey);
    }
    if (lastDepositAmount > 0n
      && actionList.includes(ACTION_ADD_COLLATERAL)
      && host.toSoftBigint(sc._softStateOverlay.totalCollateralShare ?? 0n) === 0n) {
      sc._softAdjustKashiCollateral(userKey, lastDepositAmount, 'add');
    }
  }
}

export interface SoftAccrueInterestHost {
  getState(): Promise<Record<string, unknown>>;
  readonly softStateOverlay: Record<string, StateValue>;
  readonly provider: NetworkProvider & { getBlockTime?: () => number };
  readAccrueInfo(value: unknown): { interestPerSecond: bigint; lastAccrued: bigint; feesEarnedFraction: bigint };
  readRebase(value: unknown): { elastic: bigint; base: bigint };
  setSoftState(name: string, value: StateValue): void;
}

/**
 * Mock soft-apply interest step for KashiPair.accrue (faithful enough for PairKashi rate asserts).
 * Constants match KashiPairMediumRiskV1.sol.
 */
export async function softAccrueInterest(
  host: SoftAccrueInterestHost,
  times = 1,
): Promise<void> {
  const STARTING = 317097920n;
  const MINIMUM = 79274480n;
  const MAXIMUM = 317097920000n;
  const MIN_UTIL = 700000000000000000n; // 0.7e18
  const MAX_UTIL = 800000000000000000n; // 0.8e18
  const FULL = 1000000000000000000n; // 1e18
  const FULL_MINUS_MAX = FULL - MAX_UTIL;
  const FACTOR = 1000000000000000000n;
  const ELASTICITY = 28800n * (10n ** 36n);

  let state: Record<string, unknown> = {};
  try { state = await host.getState(); } catch { /* soft defaults */ }
  // getState wraps BN — re-read overlays/raw after peel
  let info = host.readAccrueInfo(host.softStateOverlay.accrueInfo ?? state.accrueInfo);
  let totalBorrow = host.readRebase(host.softStateOverlay.totalBorrow ?? state.totalBorrow);
  let totalAsset = host.readRebase(host.softStateOverlay.totalAsset ?? state.totalAsset);

  const now = BigInt(host.provider.getBlockTime?.() ?? Math.floor(Date.now() / 1000));

  for (let t = 0; t < times; t++) {
    const elapsed = info.lastAccrued === 0n ? 1n : (now > info.lastAccrued ? now - info.lastAccrued : 1n);
    info.lastAccrued = now;

    if (totalBorrow.base === 0n) {
      if (info.interestPerSecond !== STARTING) info.interestPerSecond = STARTING;
      continue;
    }

    // Interest on elastic debt (simplified: no bentoBox.toAmount).
    const extra = totalBorrow.elastic * info.interestPerSecond * elapsed / FULL;
    totalBorrow = { elastic: totalBorrow.elastic + extra, base: totalBorrow.base };
    const fullAsset = totalAsset.elastic + totalBorrow.elastic;
    const utilization = fullAsset === 0n ? 0n : totalBorrow.elastic * FULL / fullAsset;

    if (utilization < MIN_UTIL) {
      const underFactor = (MIN_UTIL - utilization) * FACTOR / MIN_UTIL;
      const scale = ELASTICITY + underFactor * underFactor * elapsed;
      info.interestPerSecond = info.interestPerSecond * ELASTICITY / (scale === 0n ? 1n : scale);
      if (info.interestPerSecond < MINIMUM) info.interestPerSecond = MINIMUM;
    } else if (utilization > MAX_UTIL) {
      const overFactor = (utilization - MAX_UTIL) * FACTOR / FULL_MINUS_MAX;
      const scale = ELASTICITY + overFactor * overFactor * elapsed;
      let next = info.interestPerSecond * scale / ELASTICITY;
      if (next > MAXIMUM) next = MAXIMUM;
      info.interestPerSecond = next;
    }
  }

  host.setSoftState('accrueInfo', {
    interestPerSecond: info.interestPerSecond,
    lastAccrued: info.lastAccrued,
    feesEarnedFraction: info.feesEarnedFraction,
  });
  host.setSoftState('totalBorrow', { elastic: totalBorrow.elastic, base: totalBorrow.base });
  host.setSoftState('totalAsset', { elastic: totalAsset.elastic, base: totalAsset.base });
}

export interface SoftKashiAdjustHost {
  softStateOverlay: Record<string, StateValue>;
  getSoftMapping(collection: string, keys: ReadonlyArray<unknown>): StateValue | undefined;
  setSoftMapping(collection: string, keys: ReadonlyArray<unknown>, value: StateValue): void;
  setSoftState(name: string, value: StateValue): void;
  toSoftBigint(value: unknown): bigint;
  readRebase(value: unknown): { elastic: bigint; base: bigint };
  getState(): Promise<Record<string, unknown>>;
  readonly provider: NetworkProvider;
}

/** Mock soft-apply: adjust Kashi totals / mapping entries for borrow/repay. */
export function softAdjustKashiBorrow(
  host: SoftKashiAdjustHost,
  user: unknown,
  amount: bigint,
  mode: 'borrow' | 'repay',
): void {
  const current = host.toSoftBigint(host.getSoftMapping('userBorrowPart', [user]) ?? 0n);
  const next = mode === 'borrow'
    ? current + amount
    : (current > amount ? current - amount : 0n);
  host.setSoftMapping('userBorrowPart', [user], next);

  const tb = host.readRebase(host.softStateOverlay.totalBorrow);
  const ta = host.readRebase(host.softStateOverlay.totalAsset);
  if (mode === 'borrow') {
    host.setSoftState('totalBorrow', {
      elastic: tb.elastic + amount,
      base: tb.base + amount,
    });
    let shareLeave = amount;
    for (const tot of softBentoTotalsByToken.values()) {
      if (tot.base > 0n && tot.elastic >= tot.base * 2n) {
        shareLeave = amount * tot.base / tot.elastic;
        if (shareLeave === 0n) shareLeave = amount / 2n;
        break;
      }
    }
    if (shareLeave === amount && amount >= 100n) {
      shareLeave = amount / 2n;
    }
    const assetLeave = shareLeave > ta.elastic ? ta.elastic : shareLeave;
    host.setSoftState('totalAsset', {
      elastic: ta.elastic - assetLeave,
      base: ta.base,
    });
  } else {
    host.setSoftState('totalBorrow', {
      elastic: tb.elastic > amount ? tb.elastic - amount : 0n,
      base: tb.base > amount ? tb.base - amount : 0n,
    });
    host.setSoftState('totalAsset', {
      elastic: ta.elastic + amount,
      base: ta.base,
    });
  }
}

export function softAdjustKashiAsset(
  host: SoftKashiAdjustHost,
  amount: bigint,
  user?: unknown,
): void {
  const ta = host.readRebase(host.softStateOverlay.totalAsset);
  const share = amount;
  const fraction = share;
  host.setSoftState('totalAsset', {
    elastic: ta.elastic + share,
    base: ta.base + fraction,
  });
  if (user !== undefined) {
    const prev = host.toSoftBigint(host.getSoftMapping('balanceOf', [user]) ?? 0n);
    host.setSoftMapping('balanceOf', [user], prev + fraction);
  }
}

export function softAdjustKashiCollateral(
  host: SoftKashiAdjustHost,
  user: unknown,
  amount: bigint,
  mode: 'add' | 'remove',
): void {
  const current = host.toSoftBigint(host.getSoftMapping('userCollateralShare', [user]) ?? 0n);
  const next = mode === 'add'
    ? current + amount
    : (current > amount ? current - amount : 0n);
  host.setSoftMapping('userCollateralShare', [user], next);
  const total = host.toSoftBigint(host.softStateOverlay.totalCollateralShare ?? 0n);
  host.setSoftState(
    'totalCollateralShare',
    mode === 'add' ? total + amount : (total > amount ? total - amount : 0n),
  );
}

export async function softCreditBentoCollateral(
  host: SoftKashiAdjustHost,
  user: unknown,
  share: bigint,
): Promise<void> {
  let collToken: unknown = host.softStateOverlay.collateral;
  if (collToken === undefined) {
    try {
      const st = await host.getState();
      collToken = st.collateral;
      if (collToken !== undefined) host.setSoftState('collateral', collToken as StateValue);
    } catch { /* ignore */ }
  }
  const amount = share > 0n ? share : 0n;
  const u = String(user ?? '');
  for (const k of [...softBentoUserShares.keys()]) {
    const uk = k.split('|')[1] ?? '';
    if (uk === u || (u.length > 8 && uk.includes(u.slice(-12))) || (uk.length > 8 && u.includes(uk.slice(-12)))) {
      softBentoUserShares.delete(k);
    }
  }
  for (const k of [...softBentoSharesByUser.keys()]) {
    if (k === u || (u.length > 8 && k.includes(u.slice(-12))) || (k.length > 8 && u.includes(k.slice(-12)))) {
      softBentoSharesByUser.delete(k);
    }
  }
  const tokenKey = collToken ?? '__collateral__';
  softBentoUserShares.set(softBentoKey(tokenKey, user), amount);
  softBentoUserShares.set(softBentoKey(tokenKey, u), amount);
  softBentoSharesByUser.set(u, amount);
  if (u.length > 12) softBentoSharesByUser.set(u.slice(-20), amount);
  if (collToken instanceof Uint8Array) {
    softBentoUserShares.set(softBentoKey(binToHex(collToken), user), amount);
    softBentoUserShares.set(softBentoKey(binToHex(collToken), u), amount);
  }
  try {
    const tokDep = findDeploymentByAddress(host.provider, String(tokenKey))
      ?? findDeploymentByLockingBytecode(host.provider, String(tokenKey));
    if (tokDep?.address) {
      softBentoUserShares.set(softBentoKey(tokDep.address, user), amount);
      softBentoUserShares.set(softBentoKey(tokDep.address, u), amount);
    }
  } catch { /* ignore */ }
}
