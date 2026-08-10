# Reusable SolidCash contracts

## `ERC20`

`ERC20.scash` is the SolidCash-native port of OpenZeppelin Contracts ERC20 v5.6.1. It retains OZ's `_update`
customization point, `_mint`/`_burn`, approval and allowance spending logic, the `uint256.max` infinite-allowance
sentinel, events, and ERC-6093 error surface. Stateful entry points do not return an EVM boolean because BCH
transactions have no synchronous return channel. Infinite allowances are explicitly carried forward so their
mapping NFT remains covenant-constrained on the UTXO ledger.

The IERC20Metadata surface is the independent `ERC20Metadata.scash` behavior. Inherit it with
`ERC20Metadata(name, symbol)` when `name`, `symbol`, and `decimals` are required. This keeps the ERC20 ledger and
allowances mandatory while allowing a minimal token to prune textual metadata state and constructor code.

For the smallest complete composition, see
[`examples/MinimalNativeToken.scash`](examples/MinimalNativeToken.scash), declared exactly as
`MinimalNativeToken is ERC20, BchNative`. Its deployed contract is 4,608 bytes; it retains transfers, full
allowances, supply accounting, and Transfer/Approval events while intentionally omitting optional metadata.

## `BchNative`

`BchNative.scash` adds a CashTokens-backed wrap/unwrap boundary to a ledger token. It derives the wrapped
category from the contract's own state NFT and owns no configuration or delayed-admission state. The token
supplies balance and policy hooks.

The minimal base emits no native lifecycle events, preserving only the mandatory OpenZeppelin ERC20 events.
It does not reference `block.number`, so a simple immediate wrap/unwrap token carries no oracle state or updater.
For a zero-quarantine token, `wrap(amount)` is the immediate admission path; inheriting quarantine solely with a
constant of zero is unnecessary and would reintroduce pending state and oracle machinery without delaying entry.

Inherit `BchNativeQuarantine` separately to add `deposit`, `claimDeposit`, `cancelDeposit`, pending state, and
the standard `block.number` oracle. Inherit `BchNativeEvents` when indexers or regulated-token policy require
the complete native lifecycle event surface. Fixed-policy quarantine tokens expose no privileged administrator;
override `_nativeQuarantineBlocks()` with a source constant. Inherit `BchNativeAdmin` when the
quarantine period must remain mutable; that behavior owns `quarantineBlocks`, initialization, its public getter,
and the setter, and the concrete token supplies `_nativeAdmin()`.
Quarantine durations and unlock heights are `uint32`, matching the standard block-number oracle. Pending amounts
retain the public `int` amount type; admission proves each amount against the bounded CashToken reserve before it
can enter state.

```solidity
import { BchNative } from "solidcash/contracts/BchNative.scash";
import { BlackList } from "solidcash/contracts/BlackList.scash";

contract MyToken(address initialOwner) is ERC20, BchNative, BlackList {

    function _blacklistAdmin() internal view override returns (address) { return this.owner; }
    function _nativeCredit(address account, uint256 amount) internal override {
        _mint(account, amount);
    }
    function _nativeDebit(address account, uint256 amount) internal override {
        _burn(account, amount);
    }
    function _nativeCanWrap(address account) internal view override returns (bool) {
        return !this.blacklisted[account];
    }
    function _nativeCanUnwrap(address account) internal view override returns (bool) {
        return !this.blacklisted[account];
    }

    function openSelf() {
        address account = msg.sender;
        require(balanceOf(account) == 0);
        _mint(account, 0);
        this.blacklisted[account] = false;
    }
}
```

`BlackList.scash` is an independent optional behavior: it owns blacklist state and administration, and has no
dependency on either ERC20 or `BchNative`. The policy hooks deliberately keep all blacklist concerns outside
`BchNative`. Immediate tokens override only wrap/unwrap hooks. Quarantine-enabled tokens can additionally veto
deposit or claim by reading the inherited mapping; cancellation remains separately controllable so rejected
deposits can return to bearer form rather than being confiscated.

`wrap(amount)` proves the own-category backing container grows by the claimed amount and credits the ledger
immediately. `withdraw(to, amount)` debits ledger balance and transfers real fungible CashTokens to any
`address` locking bytecode. Tokens that need delayed admission may instead use `deposit(amount)` and
`claimDeposit`; maturity is calculated exclusively from the compiler-managed `block.number` oracle. No public
entry point accepts a category, height, timestamp, or unlock time from its caller.

Ordinary ERC20 `transfer` and `transferFrom` move only ledger ownership: the physical reserve stays in the
container and continues backing the unchanged total supply. Moving CashTokens into or out of bearer custody is
exactly the wrap/withdraw boundary; also paying bearer tokens during an ERC20 transfer would double-represent
the same value and permit later double redemption.

If the ERC20 uses sorted mappings, it should expose a direct account-opening path like `openSelf()` in the
example above. This creates the caller's balance row before `claimDeposit` updates it and avoids turning a
later inherited or split route into an unsupported first-touch insert.
