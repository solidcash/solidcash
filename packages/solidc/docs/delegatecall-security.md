# Delegatecall proxy security

`addr.delegatecall(input)` implements the proxy/upgrade pattern: the proxy holds the state (master + data
NFTs) and defers the state transition to a co-spent **delegate** contract (a function marked `delegate` on the
implementation). The delegate runs against the proxy's data NFTs via the injected `_proxyMasterIndex` and
authorizes the proxy's new commitment.

## The C1 hazard: a proxy cannot pin its delegate

By design a delegate serves **many** proxies, so the delegate does not verify the proxy's category or locking
bytecode - it only checks that `_proxyMasterIndex` points at a minting NFT and that the proxy preserves itself.
Symmetrically, **the proxy cannot verify which delegate authorized its state change.** The delegatecall codegen
path deliberately skips the proxy's own state covenant (the delegate is supposed to enforce it), and the
data-NFT write path leaves the output commitment to the master.

Put together: if a proxy's delegatecall function has **no access control**, ANY spender can

1. spend the proxy master via that function (master self-preservation + minting uniqueness + value
   preservation all pass), and
2. co-spend the proxy data NFT with a write flag and an **attacker-chosen commitment** (the write path checks
   category + minting presence, not the commitment),

**without co-spending any delegate at all.** Proxy state is forged arbitrarily by anyone.

## Requirement: gate delegatecall with a signature check

A delegatecall proxy MUST restrict who can trigger a state transition. Gate the delegatecall function with a
signature check so only the proxy admin can drive it (the transparent-proxy `ifAdmin` pattern):

```solidity
contract Proxy(pubkey admin) {
    bigint counter;

    // OK: only the admin can invoke the delegate; the admin is trusted to co-spend the correct delegate.
    function upgrade(bytes input, sig s) external {
        require(checkSig(s, admin));
        address impl = address(0x....);
        impl.delegatecall(input);
        require(input.length > 0);
    }
}
```

The compiler emits a warning (`SECURITY-AUDIT C1`) whenever a function issues a user-written `delegatecall`
without a `checkSig` / `checkMultiSig` / `checkDataSig` guard. A raw `fallback(bytes input)` proxy cannot carry
a signature parameter, so move the delegatecall into a guarded regular function as above.

Note this is a **trust** mitigation, not a covenant-level pin: the admin is trusted to co-spend the intended
delegate. There is no permissionless covenant that pins an arbitrary-delegate proxy, because Script cannot force
a specific input to be co-spent or observe that another input referenced this proxy.

## Library-call sugar is exempt

`L.f(args)` on a state-touching `library` desugars to a delegatecall (`SynthesizeLibraryDelegateCalls`) but is
**not** a bare proxy: the library is the delegate, wired by the compiler with layout guards (and optional
`brandLibrary` master-gate contention). The C1 warning is suppressed for library-call sugar.
