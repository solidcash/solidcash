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
`MinimalNativeToken is ERC20, BchNative`. Its script is 7,395 bytes; it retains transfers, full
allowances, supply accounting, and Transfer/Approval events while intentionally omitting optional metadata.

## `BchNative`

`BchNative.scash` adds a CashTokens-backed wrap/unwrap boundary to a ledger token. The bearer token is a CashTokens
category of its own, which the token names at construction (`constructor(bytes32 nativeCategory_)
BchNative(nativeCategory_)`) and BchNative keeps as an immutable; the reserve container is keyed by it. It is not the
contract's own category: a framed composition refuses fungible amounts of that category, and a category of its own
keeps the token's BCMR identity apart from the contract's state NFTs. A deployment creates the category in the
genesis and premints the reserve with `nativeToken: { funding, reserve }`, or mints the supply to holders with
`nativeToken: { funding, bearer }` for a token whose ledger starts empty (see `docs/bcmr/DESIGN.md`, section 6), or
names a category that already exists with `nativeToken: { category }` and mints nothing (see `BchNativeWrapper`). Under
the framed convention the token wraps and unwraps through the same container
(`docs/framed/SPEC_FRAMED_TRANSACTION.md`, 4b). BchNative owns no other configuration or delayed-admission state. The
token supplies balance and policy hooks.

It composes with unmodified third-party ledgers too: `test/fixture/oz_bch_native_token.sol` inherits the npm
OpenZeppelin ERC20, and `test/fixture/tether/TetherNativeToken.sol` inherits the Etherscan-verified USDT source
(Solidity 0.4) byte for byte, adding only the hooks.

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
import { BchNative } from "@solidcash/solidcash/contracts/BchNative.scash";
import { BlackList } from "@solidcash/solidcash/contracts/BlackList.scash";

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

## `BchNativeMultiplier`

`BchNativeMultiplier.scash` scales the `BchNative` reserve boundary for tokens whose ledger is expressed in
more precision than the CashToken reserve can hold. Fungible CashToken amounts cap at the signed 64-bit
maximum `9223372036854775807`, while an 18-decimal ERC20 ledger routinely needs more base units. Inheriting
the multiplier compresses the ledger into the reserve: one native CashToken base unit backs `multiplier`
ledger units, and `wrap`/`unwrap` convert with `native = ledger / multiplier`.

```solidity
import { BchNativeMultiplier } from "@solidcash/solidcash/contracts/BchNativeMultiplier.scash";

// One native base unit = 100 ledger units, so 500 ledger units bridge 5 CashTokens.
contract ScaledToken() is ERC20, BchNative, BchNativeMultiplier(100) {
    function _nativeCredit(address account, uint256 amount) internal override {
        _mint(account, amount);
    }
    function _nativeDebit(address account, uint256 amount) internal override {
        _burn(account, amount);
    }
}
```

The multiplier is an immutable state variable set once at construction from the inheritance-list argument,
the same pattern as `ERC20Metadata`'s name/symbol. The constructor seeds it into the initial data-NFT
commitment and no later transaction can change it, so each deployment fixes its own scale factor. It must be
positive, and boundary amounts must be an exact multiple of the multiplier so the reserve stays exactly
backed; a non-multiple amount refuses at the boundary. This is the precision trade-off in one line: a
`BchNativeMultiplier(10^12)` token supports a far larger total supply at the cost of only being able to move
ledger amounts divisible by `10^12` across the boundary. The layer overrides only BchNative's `_nativeAmount` hook,
the native amount `wrap` and `unwrap` move for a ledger amount, and keeps that override final, so it composes with
`BchNativeWrapper`, whose `wrap` and `unwrap` are final too. The optional quarantined `deposit`/`cancelDeposit` paths
in `BchNativeQuarantine` are not scaled by it, so a token composing both layers must scale those paths itself.

## `BchNativeWrapper`

`BchNativeWrapper.scash` is an ERC20 over a CashTokens category that already exists, minted by someone else:
OpenZeppelin's `ERC20Wrapper` for CashTokens. Units enter only by `wrap`, against tokens a holder moves into the
reserve, and leave only by `unwrap`. A deployment names the category with `nativeToken: { category }`; it creates no
category and mints nothing, and the SDK checks that the contract keys its reserve by that category and that
`totalSupply()` starts at 0.

```solidity
import { BchNativeWrapper } from "@solidcash/solidcash/contracts/BchNativeWrapper.scash";
import { BchNativeMultiplier } from "@solidcash/solidcash/contracts/BchNativeMultiplier.scash";
import { ERC20Metadata } from "@solidcash/solidcash/contracts/ERC20Metadata.scash";

contract MyWrapped() is BchNativeWrapper, BchNativeMultiplier(100), ERC20Metadata("Wrapped Example", "WRAPPED") {
    constructor(bytes32 underlying_) BchNativeWrapper(underlying_) { }
}
```

The ledger is ERC20.scash's, private to the wrapper with the functions that write it, and `totalSupply()`,
`balanceOf()`, `allowance()`, `underlying()`, `wrap` and `unwrap` are final, so `totalSupply()` counts exactly the
units wrapped and not yet unwrapped. BchNative's credit and debit hooks fail, so a qualified `BchNative.wrap(...)`
credits nothing. Name, symbol, decimals and the scale are the creator's: `ERC20Metadata`, `BchNativeMultiplier`, or
views and an override of `_nativeAmount` of their own. `transfer`, `approve` and `transferFrom` stay virtual for
policy, which reaches the ledger through `super`, and so do BchNative's policy and event hooks. The smallest
composition is [`examples/MinimalWrappedToken.scash`](examples/MinimalWrappedToken.scash), 7,465 bytes.
`BchNativeQuarantine` does not compose with it: its claim credits through the failing hook.

`BlackList.scash` is an independent optional behavior: it owns blacklist state and administration, and has no
dependency on either ERC20 or `BchNative`. The policy hooks deliberately keep all blacklist concerns outside
`BchNative`. Immediate tokens override only wrap/unwrap hooks. Quarantine-enabled tokens can additionally veto
deposit or claim by reading the inherited mapping; cancellation remains separately controllable so rejected
deposits can return to bearer form rather than being confiscated.

`wrap(amount)` proves the bearer category's reserve container grows by exactly the native amount, as an EVM
wrapper's `transferFrom` moves exactly what it credits, and credits the ledger immediately. `unwrap(to, amount)` debits ledger balance and transfers real fungible CashTokens to any
`address` locking bytecode. Tokens that need delayed admission may instead use `deposit(amount)` and
`claimDeposit`; maturity is calculated exclusively from the compiler-managed `block.number` oracle. No public
entry point accepts a category, height, timestamp, or unlock time from its caller.

Ordinary ERC20 `transfer` and `transferFrom` move only ledger ownership: the physical reserve stays in the
container and continues backing the unchanged total supply. Moving CashTokens into or out of bearer custody is
exactly the wrap/unwrap boundary; also paying bearer tokens during an ERC20 transfer would double-represent
the same value and permit later double redemption.

If the ERC20 uses sorted mappings, it should expose a direct account-opening path like `openSelf()` in the
example above. This creates the caller's balance row before `claimDeposit` updates it and avoids turning a
later inherited or split route into an unsupported first-touch insert.
