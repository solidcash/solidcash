# Reusable SolidCash contracts

## `BchNative`

`BchNative.scash` adds a CashTokens-backed wrap/unwrap boundary to a ledger token. It owns the reserve,
quarantine clock, and pending-deposit state, while the token supplies balance and policy hooks:

```solidity
import { BchNative } from "solidcash/contracts/BchNative.scash";
import { BlackList } from "solidcash/contracts/BlackList.scash";

contract MyToken(address initialOwner) is ERC20, BchNative, BlackList {

    function _nativeAdmin() internal view override returns (address) { return this.owner; }
    function _blacklistAdmin() internal view override returns (address) { return this.owner; }
    function _nativeCredit(address account, int amount) internal override {
        this.balances[account] = this.balances[account] + amount;
    }
    function _nativeDebit(address account, int amount) internal override {
        require(this.balances[account] >= amount);
        this.balances[account] = this.balances[account] - amount;
    }
    function _nativeCanWrap(address account) internal view override returns (bool) {
        return !this.blacklisted[account];
    }
    function _nativeCanDeposit(address account) internal view override returns (bool) {
        return !this.blacklisted[account];
    }
    function _nativeCanUnwrap(address account) internal view override returns (bool) {
        return !this.blacklisted[account];
    }
    function _nativeCanClaim(address account) internal view override returns (bool) {
        return !this.blacklisted[account];
    }
    function _nativeCanCancel(address account) internal view override returns (bool) {
        return true;
    }

    function openSelf() {
        address account = msg.sender;
        require(this.balances[account] == 0);
        this.balances[account] = 0;
        this.blacklisted[account] = false;
    }
}
```

`BlackList.scash` is an independent optional behavior: it owns blacklist state and administration, and has no
dependency on either ERC20 or `BchNative`. The policy hooks deliberately keep all blacklist concerns outside
`BchNative`. Tokens without blacklisting can return `true`; tokens composing `BlackList` can veto wrap, unwrap,
or claim by reading the inherited mapping in their concrete hooks. Cancellation has a separate hook so a token can allow rejected deposits to
return to bearer form rather than confiscating them.

`setBacking` is one-shot and admin-gated. `wrap` proves the backing container grows by the claimed amount and
credits the ledger immediately. `withdraw` debits ledger balance and transfers real fungible CashTokens to a
P2PKH recipient. Tokens that need delayed admission may instead use `deposit` and `claimDeposit`; those routes
have separate policy hooks from direct wrapping.

If the ERC20 uses sorted mappings, it should expose a direct account-opening path like `openSelf()` in the
example above. This creates the caller's balance row before `claimDeposit` updates it and avoids turning a
later inherited or split route into an unsupported first-touch insert.
