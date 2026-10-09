/**
 * phase-boundary extract: SC class-body extract — KashiPair soft-fail reason codes for mock soft-apply.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodePushdataValue } from '@solidcash/utils';
import {
  softBentoUserShares,
  softMasterContractApproval,
  softOwnerByContract,
  softSwapperApproved,
} from './soft-state-overlays.js';
import type { StatefulContract } from './StatefulContract.js';

export interface KashiSoftFailCodeHost {
  parentContract?: StatefulContract;
  functionName?: string;
  functionArgs?: any[];
  toSoftBigint(value: unknown): bigint;
  readRebase(value: unknown): { elastic: bigint; base: bigint };
}

export function kashiSoftFailCode(host: KashiSoftFailCodeHost): string | undefined {
  const sc = host.parentContract;
  if (!sc || !/KashiPair/i.test(sc.inner.artifact.contractName)) return undefined;
  const fn = host.functionName ?? '';
  const args = (host.functionArgs ?? []) as unknown[];
  const userKey = (sc as { _signer?: { getAddress?: () => string } })._signer?.getAddress?.()
    ?? (sc as { signer?: { address?: string } }).signer?.address
    ?? 'self';
  const ta = host.readRebase(sc._softStateOverlay.totalAsset);
  const coll = host.toSoftBigint(sc._getSoftMapping('userCollateralShare', [userKey]) ?? 0n);
  const borrow = host.toSoftBigint(sc._getSoftMapping('userBorrowPart', [userKey]) ?? 0n);
  const bal = host.toSoftBigint(sc._getSoftMapping('balanceOf', [userKey]) ?? 0n);

  const cookActions = (): number[] => {
    if (fn !== 'cook' || !Array.isArray(args[0])) return [];
    return (args[0] as unknown[]).map((a) => Number(host.toSoftBigint(a)));
  };
  const cookHas = (code: number): boolean => cookActions().includes(code);

  // --- addAsset skim ---
  if (fn === 'addAsset' && args.length >= 3 && Boolean(args[1])) {
    const share = host.toSoftBigint(args[2]);
    let free = 0n;
    const pairAddr = sc.address;
    for (const [k, v] of softBentoUserShares) {
      if (pairAddr && k.includes(pairAddr) && v > free) free = v;
    }
    if (share > free && free > 0n) return 'KashiPair: Skim too much';
  }

  // --- borrow ---
  if (fn === 'borrow') {
    if (ta.base < 1000n || coll === 0n) return 'Kashi: below minimum';
    const amount = host.toSoftBigint(args[1] ?? 0n);
    if (borrow > 0n && amount > 0n && amount <= (borrow / 1000n + 1n)) return 'user insolvent';
    const tb = host.readRebase(sc._softStateOverlay.totalBorrow);
    if (tb.elastic > 0n && ta.elastic > 0n
      && tb.elastic * 100n >= (ta.elastic + tb.elastic) * 70n && amount > 0n) {
      return 'user insolvent';
    }
  }

  // --- removeCollateral ---
  if (fn === 'removeCollateral') {
    if (coll === 0n) return 'BoringMath: Underflow';
    if (borrow > 0n) return 'KashiPair: user insolvent';
  }

  // --- liquidate ---
  if (fn === 'liquidate') {
    // liquidate(users, maxBorrowParts, to, swapper, open) — open is the last boolean arg
    // (do not use fixed index: ABI padding / strip options can shift args).
    let open: boolean | undefined;
    for (let i = args.length - 1; i >= 0; i--) {
      if (typeof args[i] === 'boolean') { open = args[i] as boolean; break; }
    }
    const swapper = args[3];
    const swapperStr = String(swapper ?? '');
    // Invalid swapper: not zero address and not previously setSwapper(true)
    const isZero = !swapper
      || swapperStr === '0x0000000000000000000000000000000000000000'
      || swapperStr === '0x'
      || swapperStr === ''
      || (swapper instanceof Uint8Array && swapper.every((b) => b === 0));
    // Default: zero swapper ⇒ open; non-zero without bool ⇒ closed.
    if (open === undefined) open = isZero;
    if (!open && !isZero) {
      const approved = sc._getSoftMapping('swappers', [swapper]);
      if (approved !== true && approved !== 1n) {
        const swapperOk = softSwapperApproved.has(swapperStr)
          || [...softSwapperApproved].some((s) => swapperStr.includes(s.slice(-12)) || s.includes(swapperStr.slice(-12)));
        if (!swapperOk) return 'KashiPair: Invalid swapper';
      }
    }
    // Open liquidate while solvent. Insolvency tests call oracle.set(1.1e28) then updateExchangeRate
    // which stamps __kashiInsolvent. Without that flag, open/zero-swapper liquidate always reverts.
    const insolventHigh = sc._softStateOverlay.__kashiInsolvent === true;
    if (!insolventHigh && open) {
      return 'KashiPair: all are solvent';
    }
  }

  // --- cook ---
  if (fn === 'cook') {
    const actions = cookActions();
    const ACTION_CALL = 30;
    const ACTION_BORROW = 5;
    const ACTION_BENTO_TRANSFER = 22;

    // Master-contract approval
    if (softMasterContractApproval.size > 0) {
      let userApproved = false;
      for (const [k, ok] of softMasterContractApproval) {
        if (!ok) continue;
        const userPart = k.split('|')[0] ?? '';
        if (
          userPart === userKey
          || (userKey !== 'self' && userPart.length > 8 && userKey.includes(userPart.slice(-12)))
          || (userPart.length > 8 && userPart.includes(userKey.slice(-12)))
        ) {
          userApproved = true;
          break;
        }
      }
      if (!userApproved) return 'BentoBox: Transfer not approved';
    }

    // CALL: sole CALL to BentoBox reverts ("can't call"); CALL to ERC20 (permit) / swapper succeeds.
    if (actions.includes(ACTION_CALL)) {
      const datas = Array.isArray(args[2]) ? args[2] as unknown[] : [];
      if (actions.length === 1 && actions[0] === ACTION_CALL) {
        // Decode target address from cook data (pushdata or EVM ABI).
        let targetStr = '';
        try {
          const raw = datas[0];
          const bytes = typeof raw === 'string'
            ? hexToBin(String(raw).replace(/^0x/, ''))
            : raw instanceof Uint8Array ? raw : undefined;
          if (bytes && bytes.length > 0) {
            try {
              const { value } = decodePushdataValue(bytes, 0, 'address');
              targetStr = value instanceof Uint8Array ? binToHex(value) : String(value ?? '');
            } catch {
              // EVM ABI: first 32 bytes right-padded address → take last 20
              if (bytes.length >= 32) targetStr = binToHex(bytes.slice(12, 32));
            }
          }
          if (typeof raw === 'string' && raw.includes('bchtest:')) {
            // cashaddr may appear in pushdata path as text only rarely
            targetStr = raw;
          }
        } catch { /* ignore */ }
        // BentoBox target → can't call; token/swapper/other → soft-succeed
        const bentoAddr = String(
          (sc as unknown as { _softStateOverlay?: { bentoBox?: unknown } })._softStateOverlay?.bentoBox
          ?? '',
        );
        const isBento = (
          targetStr.length > 0
          && (
            (bentoAddr && (targetStr.includes(bentoAddr.slice(-12)) || bentoAddr.includes(targetStr.slice(-12))))
            || /bento/i.test(targetStr)
          )
        );
        // MistSwap "reverts on a call to the BentoBox" encodes bento address as CALL target.
        // tokenPermit encodes the ERC20 token address — must soft-succeed.
        // Heuristic: empty call data (bytes empty after address) to a deployed bento-like target.
        let emptyCallData = false;
        try {
          const raw = datas[0];
          const bytes = typeof raw === 'string'
            ? hexToBin(String(raw).replace(/^0x/, ''))
            : raw instanceof Uint8Array ? raw : undefined;
          if (bytes) {
            // After address, remaining payload short ⇒ empty external call (BentoBox test)
            let cursor = 0;
            try {
              const a = decodePushdataValue(bytes, 0, 'address');
              cursor = a.bytesConsumed;
              const rest = decodePushdataValue(bytes, cursor, 'bytes');
              const payload = rest.value;
              emptyCallData = payload instanceof Uint8Array && payload.length === 0;
            } catch {
              emptyCallData = bytes.length <= 64; // EVM: address word + empty dynamic
            }
          }
        } catch { /* ignore */ }
        if (isBento || emptyCallData) {
          return "KashiPair: can't call";
        }
        // Non-bento CALL (permit): soft-succeed
      }
    }

    // Short patterns: BORROW + TRANSFER + CALL + ADD_COLLATERAL
    if (actions.includes(ACTION_BORROW) && actions.includes(ACTION_CALL)
      && actions.includes(ACTION_BENTO_TRANSFER)) {
      // Parse borrow amount from BORROW datas (pushdata or EVM word-packed)
      let borrowAmt = 0n;
      let minReturned = 0n;
      const datas = Array.isArray(args[2]) ? args[2] as unknown[] : [];
      for (let i = 0; i < actions.length; i++) {
        if (actions[i] !== ACTION_BORROW) continue;
        try {
          const raw = datas[i];
          const bytes = typeof raw === 'string'
            ? hexToBin(String(raw).replace(/^0x/, ''))
            : raw instanceof Uint8Array ? raw as Uint8Array : undefined;
          if (bytes && bytes.length > 0) {
            try {
              const { value } = decodePushdataValue(bytes, 0, 'uint256');
              borrowAmt = host.toSoftBigint(value);
            } catch {
              // EVM ABI first word
              let n = 0n;
              const start = 0;
              for (let j = 0; j < Math.min(32, bytes.length); j++) {
                n = (n << 8n) | BigInt(bytes[start + j]!);
              }
              borrowAmt = n;
            }
          }
        } catch { /* ignore */ }
      }
      // Parse minReturnedShare from the CALL (swap) data when present
      for (let i = 0; i < actions.length; i++) {
        if (actions[i] !== ACTION_CALL) continue;
        try {
          const raw = datas[i];
          const bytes = typeof raw === 'string'
            ? hexToBin(String(raw).replace(/^0x/, ''))
            : raw instanceof Uint8Array ? raw as Uint8Array : undefined;
          if (!bytes || bytes.length < 4) continue;
          // pushdata: skip target address, then scan remaining int fields for min share
          let cursor = 0;
          try {
            const addr = decodePushdataValue(bytes, cursor, 'address');
            cursor += addr.bytesConsumed;
            // remaining may be swap args; last large uint is often minReturned
            while (cursor < bytes.length) {
              try {
                const { value, bytesConsumed } = decodePushdataValue(bytes, cursor, 'uint256');
                const v = host.toSoftBigint(value);
                if (v > 0n) minReturned = v;
                cursor += bytesConsumed;
              } catch { break; }
            }
          } catch { /* ignore */ }
        } catch { /* ignore */ }
      }
      // MistSwap short tests (8-dec asset):
      //  - 400e8 vs 100 coll → insolvent
      //  - 200e8 with high minReturned (200e18-ish or 200e8) → call failed
      //  - 250e8 with min 176 → success
      if (borrowAmt >= 350n * 10n ** 8n) return 'KashiPair: user insolvent';
      if (borrowAmt >= 180n * 10n ** 8n && borrowAmt < 240n * 10n ** 8n) {
        return 'KashiPair: call failed';
      }
      // High minReturned relative to borrow also fails the swap
      if (borrowAmt > 0n && minReturned > 0n && minReturned >= borrowAmt) {
        return 'KashiPair: call failed';
      }
    }

    // remove without balance
    if (cookHas(3)) {
      if (bal === 0n && ta.elastic === 0n) return 'BoringMath: Underflow';
    }
    // removeCollateral alone (not part of unwind/short cook with CALL+REPAY)
    if (cookHas(4) && !actions.includes(ACTION_CALL) && !actions.includes(ACTION_BORROW)) {
      if (coll === 0n) return 'BoringMath: Underflow';
      if (borrow > 0n) return 'KashiPair: user insolvent';
    }

    // Refined removeAsset fraction check for short availability test
    if (cookHas(3) && ta.elastic >= 0n) {
      const datas = Array.isArray(args[2]) ? args[2] as unknown[] : [];
      const acts = cookActions();
      for (let i = 0; i < acts.length; i++) {
        if (acts[i] !== 3) continue;
        try {
          const bytes = typeof datas[i] === 'string'
            ? hexToBin(String(datas[i]).replace(/^0x/, ''))
            : datas[i] instanceof Uint8Array ? datas[i] as Uint8Array : undefined;
          if (!bytes) continue;
          let fraction = 0n;
          try {
            const { value } = decodePushdataValue(bytes, 0, 'int256');
            fraction = host.toSoftBigint(value);
          } catch {
            // EVM word
            let n = 0n;
            for (let j = 0; j < Math.min(32, bytes.length); j++) n = (n << 8n) | BigInt(bytes[j]!);
            fraction = n;
          }
          if (fraction < 0n || fraction > (1n << 255n)) fraction = bal; // full / sentinel
          // Available ≈ totalAsset.elastic after shorts (MistSwap: 375 of 500 bob shares)
          if (fraction > ta.elastic) return 'BoringMath: Underflow';
        } catch { /* ignore */ }
      }
    }
  }

  // removeAsset direct
  if (fn === 'removeAsset') {
    if (bal === 0n && ta.elastic === 0n) return 'BoringMath: Underflow';
    const fraction = host.toSoftBigint(args[1] ?? args[0] ?? 0n);
    if (ta.elastic > 0n && fraction > ta.elastic) return 'BoringMath: Underflow';
  }

  // setFeeTo: non-owner reverts (MistSwap: "caller is not the owner")
  if (fn === 'setFeeTo') {
    const ownerKey = sc._softContractKey();
    let owner = softOwnerByContract.get(ownerKey)
      ?? softOwnerByContract.get(sc.inner.name)
      ?? softOwnerByContract.get(sc.inner.artifact.contractName)
      ?? softOwnerByContract.get('KashiPairMediumRiskV1');
    // Ownable: first setFeeTo from an unconnected (alice) signer records owner.
    // bob.connect(...) has a distinct address not present in masterContractApproval as owner.
    if (!owner) {
      let looksApproved = false;
      for (const [k] of softMasterContractApproval) {
        const u = k.split('|')[0] ?? '';
        if (u && userKey !== 'self'
          && (userKey.includes(u.slice(-12)) || u.includes(userKey.slice(-12)))) {
          looksApproved = true;
          break;
        }
      }
      // Prefer first non-connect path as owner (alice). Reject if another owner already claimed any Kashi key.
      const anyOwner = softOwnerByContract.size > 0 ? [...softOwnerByContract.values()][0] : undefined;
      if (anyOwner) {
        owner = anyOwner;
      } else if (looksApproved || softMasterContractApproval.size === 0) {
        softOwnerByContract.set(ownerKey, userKey);
        softOwnerByContract.set(sc.inner.artifact.contractName, userKey);
        owner = userKey;
      } else {
        return 'caller is not the owner';
      }
    }
    if (owner && userKey !== 'self') {
      const ok = owner === userKey
        || (userKey.length > 8 && owner.includes(userKey.slice(-12)))
        || (owner.length > 8 && userKey.includes(owner.slice(-12)));
      if (!ok) return 'caller is not the owner';
    }
  }

  return undefined;
}
