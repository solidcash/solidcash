---
title: ERC-20 Tokens with BchNative
sidebar_label: ERC-20 Tokens
---

SolidCash ships an ERC-20 ledger, a port of OpenZeppelin Contracts ERC20 v5.6.1, and `BchNative`, an extension that
backs the ledger with real CashTokens. Balances, allowances and token policy live in the contract's state, where
ERC-20 code expects them. The same value can leave the contract as fungible CashTokens, which any wallet holds, sends
and trades without knowing the contract, and come back in.

This guide covers the contracts, deploying a token, Tether's USDT running unmodified, wrapping a category that
already exists, and publishing a token's metadata with BCMR.

## Two forms of one token

| Form | Where it lives | What moves it |
| --- | --- | --- |
| Ledger units | The contract's state: balances and allowances in mapping NFTs | `transfer`, `approve`, `transferFrom` |
| Bearer tokens | Fungible CashTokens of the token's category, X below | Any wallet or contract that holds them |

`BchNative` joins the two at a **reserve**, the contract's [token container](/docs/language/token-containers) for X:

- `wrap(amount)` proves that the reserve grew by exactly the native amount in the same transaction, then credits
  the caller's ledger balance.
- `unwrap(to, amount)` debits the caller's ledger balance and pays the native amount from the reserve to `to`.

A ledger `transfer` moves ownership only: the reserve keeps backing the unchanged supply, so paying bearer tokens
during a transfer would count the same value twice. Tokens paid to the reserve outside a `wrap` back no ledger units.

## The contracts

Import them from the SDK package:

```solidity
import { ERC20 } from "solidcash/contracts/ERC20.scash";
import { BchNative } from "solidcash/contracts/BchNative.scash";
```

| Contract | What it adds |
| --- | --- |
| `ERC20` | The ledger: OpenZeppelin ERC20 v5.6.1 with `_update`, `_mint`, `_burn`, the `uint256.max` infinite allowance, the Transfer and Approval events and the ERC-6093 errors. Entry points return no boolean, since a BCH transaction has no return channel. |
| `ERC20Metadata` | `name()`, `symbol()` and `decimals()`, from `ERC20Metadata(name, symbol)`. `decimals()` is 18 unless you override it. |
| `BchNative` | `wrap` and `unwrap` against the reserve of the category its constructor names. |
| `BchNativeMultiplier` | A fixed scale: one native unit backs `multiplier` ledger units. |
| `BchNativeQuarantine` | Delayed admission: `deposit`, `claimDeposit` and `cancelDeposit`, timed by the block-number oracle. |
| `BchNativeEvents` | The complete set of native lifecycle events, for indexers. |
| `BchNativeAdmin` | A quarantine period that an administrator can change. |
| `BlackList` | Blacklist state and its administration, for the policy hooks. |
| `BchNativeWrapper` | An ERC-20 over a category that already exists. See [Wrapped tokens](#wrapped-tokens). |

## A token

```solidity
pragma solidcash >=0.8.0;

import { ERC20 } from "solidcash/contracts/ERC20.scash";
import { ERC20Metadata } from "solidcash/contracts/ERC20Metadata.scash";
import { BchNative } from "solidcash/contracts/BchNative.scash";

contract MyDollar() is ERC20, ERC20Metadata("My Dollar", "MYD"), BchNative {
    constructor(bytes32 nativeCategory_) BchNative(nativeCategory_) { }

    function decimals() public view override returns (uint8) { return 6; }

    function _nativeCredit(address account, uint256 amount) internal override {
        _mint(account, amount);
    }

    function _nativeDebit(address account, uint256 amount) internal override {
        _burn(account, amount);
    }
}
```

It compiles to about 8.4 KB of the 10,000-byte script limit. Without `ERC20Metadata` it is about 7.4 KB and keeps
transfers, allowances, supply accounting and events; `examples/MinimalNativeToken.scash` in the SDK package is that
composition.

The constructor names the bearer category X as 32 bytes, in the order wallets print a category. `BchNative` keeps it
as an immutable and keys the reserve by it. The token supplies the hooks:

| Hook | Default | Override it to |
| --- | --- | --- |
| `_nativeCredit(account, amount)` | None, required | Credit ledger units on `wrap` |
| `_nativeDebit(account, amount)` | None, required | Debit ledger units on `unwrap` |
| `_nativeCanWrap(account)`, `_nativeCanUnwrap(account)` | `true` | Refuse a wrap or an unwrap, for a pause or a blacklist |
| `_nativeEmitWrapped(to, value)`, `_nativeEmitUnwrapped(from, value)` | No-op | Emit lifecycle events |
| `_nativeAmount(amount)` | The amount | Convert a ledger amount to a native one, as `BchNativeMultiplier` does |

## Wrapping and unwrapping

```ts
// Bob holds 600 tokens of X in bobCoin and wraps them: the deposit pays exactly 600 into the reserve.
await token.connect(bob).call.wrap(600n)
  .addInput(bobCoin, bob.unlockP2PKH())
  .tokenContainerDeposit(category, 600n)
  .send();

// A ledger transfer moves no CashTokens.
await token.connect(bob).call.transfer(alice.getAddress(), 250n).send();

// Alice takes her 250 out as CashTokens, to any address.
await token.connect(alice).call.unwrap(alice.getAddress(), 250n).send();

const supply = await token.call.totalSupply().staticCall();
```

`address` arguments take a CashAddress or a locking bytecode. As on the EVM, a wrap moves exactly its amount: a
deposit of 101 does not wrap 100.

## Deploying a token

```ts
import { hexToBin } from '@bitauth/libauth';
import { Signer } from 'solidcash';
import { ContractFactory } from 'solidcash/contract-factory';
import myDollarArtifact from './MyDollar.artifact.js';

const deployer = new Signer(deployerPrivateKey, provider);
const factory = new ContractFactory(myDollarArtifact, deployer);
const tokenCoin = /* a token-free coin of the deployer's at vout 0 */;

const token = await factory.deploy(hexToBin(tokenCoin.txid), {
  nativeToken: { funding: tokenCoin, reserve: 1_000_000n },
});
```

The genesis spends two coins at vout 0: the deployer's funding coin, whose txid becomes the contract's category C, and
`nativeToken.funding`, whose txid becomes the token's category X. The same txid goes to the constructor.

| `nativeToken` | The genesis | Use it when |
| --- | --- | --- |
| `{ funding, reserve }` | Creates X and premints `reserve` into the reserve | The constructor credits an initial supply, which the premint must back |
| `{ funding, bearer: { amount, to } }` | Creates X and mints `amount` to the token-aware address `to` | The ledger starts empty and holders wrap later; the first `wrap` creates the reserve |
| `{ category }` | Creates and mints nothing | The token wraps a category that already exists, see [Wrapped tokens](#wrapped-tokens) |

`reserve` and `bearer` combine. `funder` unlocks the funding coin when it belongs to another key than the deployer's,
and `scale` states a `BchNativeMultiplier` scale, described below.

Before it broadcasts anything, the SDK runs the constructor in a probe genesis and refuses:

- a contract constructed with a category other than X, naming a byte-reversed one;
- a premint that backs fewer ledger units than the constructor credits: `reserve` times the scale must reach
  `totalSupply()`;
- an amount outside 1 to 9,223,372,036,854,775,807, the CashTokens cap, alone or added together;
- a funding coin off vout 0, one the funder cannot spend, or the contract's own funding coin.

Without `nativeToken.funding`, the bearer form is the contract's own category C. Only the direct convention admits
that: a framed contract refuses fungible tokens of its own category, so a framed token needs `funding`. A category of
its own also keeps the token's identity and supply apart from the contract's state NFTs.

```text
in   0     funding coin (vout 0)          its txid is the contract's category C
in   1     nativeToken.funding (vout 0)   its txid is the token's category X
out  0     the authhead of C              the BCMR identity output
out  1     the BCMR publication           when you pass bcmr
out  ...   the contract's NFTs, the reserve and the bearer supply; change last
```

## Scaling an 18-decimal ledger

A fungible CashTokens amount caps at 9,223,372,036,854,775,807, about 9.22 x 10^18 base units, so an 18-decimal
ledger backed one to one holds at most about 9.22 whole tokens. `BchNativeMultiplier(m)` makes one native unit back
`m` ledger units:

```solidity
import { ERC20 } from "solidcash/contracts/ERC20.scash";
import { ERC20Metadata } from "solidcash/contracts/ERC20Metadata.scash";
import { BchNative } from "solidcash/contracts/BchNative.scash";
import { BchNativeMultiplier } from "solidcash/contracts/BchNativeMultiplier.scash";

// One native unit backs 10^12 ledger units, so the bearer token has 6 decimals.
contract ScaledDollar() is ERC20, ERC20Metadata("Scaled Dollar", "SCD"), BchNative, BchNativeMultiplier(1e12) {
    constructor(bytes32 nativeCategory_) BchNative(nativeCategory_) { }

    function decimals() public view override returns (uint8) { return 18; }

    // The hooks credit and debit ledger units, as in MyDollar; BchNativeMultiplier scales the reserve boundary.
    function _nativeCredit(address account, uint256 amount) internal override {
        _mint(account, amount);
    }

    function _nativeDebit(address account, uint256 amount) internal override {
        _burn(account, amount);
    }
}
```

`wrap` and `unwrap` then take ledger amounts that are multiples of `m`, and move `amount / m` native units; any other
amount is refused. Deploy with the same value in `nativeToken.scale`:

```ts
const token = await factory.deploy(hexToBin(tokenCoin.txid), {
  nativeToken: { funding: tokenCoin, reserve: 1_000_000_000n, scale: 10n ** 12n }, // backs 1,000 whole tokens
});
```

The SDK does not read the multiplier from the contract: it uses `scale` for the premint check and publishes it. For a
category the genesis creates, the scale must be a power of ten, and the bearer unit's decimals are the ledger's less
`log10(scale)`: 18 less 12 makes 6 here. When it publishes a registry, the SDK warns about an 18-decimal ledger
without a scale.

## Tether USDT, verbatim

The Ethereum mainnet source of USDT, `0xdAC17F958D2ee523a2206206994597C13D831ec7`, compiles with `evmCompat: true`
exactly as Etherscan serves it, Solidity 0.4 pragma included, to its complete ABI: transfers with the fee schedule,
allowances with the approve race guard, pause, the blacklist and `destroyBlackFunds`, `issue` and `redeem`,
ownership and deprecation. One subclass adds the CashTokens boundary, and implements only the hooks:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TetherToken} from "./TetherToken.sol";
import {BchNative} from "solidcash/contracts/BchNative.scash";

contract TetherNativeToken is TetherToken, BchNative {
    constructor(
        uint256 _initialSupply, string memory _name, string memory _symbol, uint256 _decimals, bytes32 nativeCategory_
    ) TetherToken(_initialSupply, _name, _symbol, _decimals) BchNative(nativeCategory_) { }

    function _nativeCredit(address account, uint256 amount) internal override {
        balances[account] += amount;
        _totalSupply += amount;
        emit Transfer(address(0), account, amount);
    }

    function _nativeDebit(address account, uint256 amount) internal override {
        balances[account] -= amount;
        _totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }

    // The bearer boundary follows Tether's transfer policy; a deprecated ledger admits no new wraps.
    function _nativeCanWrap(address account) internal view override returns (bool) {
        return !paused && !deprecated && !isBlackListed[account];
    }

    function _nativeCanUnwrap(address account) internal view override returns (bool) {
        return !paused && !isBlackListed[account];
    }
}
```

At about 22 KB the token is over the 10,000-byte script limit, so `compileFileSplit` splits it into a root of about
6.7 KB, which holds the state, and four facets of 8.6 to 9.3 KB (see
[Large Contracts](/docs/compiler/large-contracts)). `SplitContractBundle` deploys the facets, then the root, and takes
the same `nativeToken` and `bcmr` options as a factory:

```ts
import { hexToBin } from '@bitauth/libauth';
import { compileFileSplit } from 'solidc';
import { SplitContractBundle } from 'solidcash/stateful';

const split = compileFileSplit('TetherNativeToken.sol', { evmCompat: true, messageBus: false });
const tokenCoin = /* a token-free coin of the treasury's at vout 0 */;
const category = tokenCoin.txid; // X

// The constructor credits 1,000,000 units to the treasury, and the genesis premints the 1,000,000 X that back them.
const usdt = await SplitContractBundle.from(split, treasury).deploy(
  [1_000_000n, 'Tether USD', 'USDT', 6n, hexToBin(category)],
  { nativeToken: { funding: tokenCoin, reserve: 1_000_000n }, bcmr: { uris: { icon: 'ipfs://...' } } },
);
const { bytes, uris } = usdt.deploymentRegistry()!; // host these bytes, as below

// Hand ownership to an administrator before the treasury pays anyone: see the limitation below.
await usdt.connect(treasury).call.transferOwnership(admin.getAddress()).send();
await usdt.connect(treasury).call.transfer(alice.getAddress(), 10_000n).send();

// The CashTokens boundary, routed to its facet like every other call.
await usdt.connect(bob).call.wrap(300n)
  .addInput(bobCoin, bob.unlockP2PKH())
  .tokenContainerDeposit(category, 300n)
  .send();
await usdt.connect(bob).call.unwrap(bob.getAddress(), 120n).send();
const supply = await usdt.callStatic.totalSupply();
```

The checks of [Deploying a token](#deploying-a-token) hold for a split token too. `totalSupply()` is a facet's, so the
probe reads it through that facet, and the bundle holds the facets' geneses until the root's is built: a refused
deployment broadcasts nothing. The registry describes X as Tether USD, and C as the contract that keeps its ledger.

The SDK's test suite runs the whole USDT surface this way, beside the boundary, which follows Tether's policy: no wrap
while the token is paused or deprecated or the holder is blacklisted, and no unwrap while paused or blacklisted.
`issue` credits ledger units without a deposit, so only reserve tokens beyond the credited supply can back them.

:::caution Known limitation
Tether's `transfer` and `transferFrom` also credit the owner's fee, `balances[owner] += fee`. When the owner sends or
receives, that call writes the owner's balance twice, which one call cannot compose yet, so the SDK refuses the
transaction rather than build a wrong one. Keep the owner a separate administrator account.
:::

## Wrapped tokens

`BchNativeWrapper` is an ERC-20 over a category that already exists and that someone else minted: OpenZeppelin's
`ERC20Wrapper` for CashTokens. It cannot mint. Units enter only by `wrap`, against tokens a holder moves into the
reserve, and leave only by `unwrap`, so `totalSupply()` is exactly the amount wrapped and not yet unwrapped.

```solidity
pragma solidcash >=0.8.0;

import { BchNativeWrapper } from "solidcash/contracts/BchNativeWrapper.scash";

contract WrappedToken() is BchNativeWrapper {
    constructor(bytes32 underlying_) BchNativeWrapper(underlying_) { }
}
```

That is a complete token of about 7.5 KB, with `underlying()`, the ERC-20 views, `transfer`, `approve`,
`transferFrom`, `wrap` and `unwrap`. The supply stays honest by construction:

- The ledger is private to `BchNativeWrapper`, so a derived contract cannot write a balance or the supply.
- `totalSupply()`, `balanceOf()`, `allowance()`, `underlying()`, `wrap` and `unwrap` are final.
- `BchNative`'s credit and debit hooks always fail, so a qualified `BchNative.wrap(...)` credits nothing.

The rest is yours. `transfer`, `approve` and `transferFrom` stay virtual for policy, which reaches the ledger through
`super`, and so do the policy and event hooks. Name, symbol, decimals and scale are yours too: inherit
`ERC20Metadata` and `BchNativeMultiplier`, or write the views.

```solidity
import { BchNativeWrapper } from "solidcash/contracts/BchNativeWrapper.scash";
import { BchNativeMultiplier } from "solidcash/contracts/BchNativeMultiplier.scash";
import { ERC20Metadata } from "solidcash/contracts/ERC20Metadata.scash";

// X has 8 decimals; one unit of X backs 100 ledger units, so the ledger shows 10.
contract WrappedDollar() is BchNativeWrapper, BchNativeMultiplier(100), ERC20Metadata("Wrapped Dollar", "WRAPPED") {
    constructor(bytes32 underlying_) BchNativeWrapper(underlying_) { }

    function decimals() public view override returns (uint8) { return 10; }
}
```

`BchNativeQuarantine` does not compose with the wrapper, since its claim credits through the failing hook. An
`upgrade` or `selfdestruct` entry deploys like any other, and the supply is then only as honest as whoever can call it.

### Deploying a wrapper

Name the existing category twice, as 64 hex characters in the order wallets print: as the constructor argument, and
as `nativeToken.category`.

```ts
const category = 'f2a4...'; // X, as wallets print it
const token = await factory.deploy(hexToBin(category), {
  nativeToken: { category, scale: 100n },
});
```

The genesis creates the contract's category C alone and mints nothing: no input or output carries X, and the first
`wrap` creates the reserve. Before it broadcasts, the SDK refuses:

- `category` beside `funding`, `reserve` or `bearer`, since every fungible amount of X was created in X's own genesis;
- a contract that keys its reserve by another category, naming a byte-reversed one, or that keys no reserve by state;
- a constructor that credits any units: `totalSupply()` must read 0;
- the contract's own category as `category`.

It does not check that X exists, or the name, symbol, decimals and scale: those are your statements. Wrapping and
unwrapping then work as for any `BchNative` token.

## Deploying with BCMR

[BCMR](https://cashtokens.org/docs/bcmr/chip/) is how wallets and explorers learn a category's name, symbol, decimals
and icon. Every genesis the SDK builds leads with the category's BCMR identity output at output 0: the category's
authhead contract, which holds the identity for its owner, the deployer's lock unless you pass `identity.owner`.
Pass `bcmr` to publish a registry in the genesis itself, at output 1:

```ts
const token = await factory.deploy(hexToBin(tokenCoin.txid), {
  identity: { owner: 'bitcoincash:q...' }, // omit to own it with the deployer's lock
  bcmr: {
    description: 'A dollar ledger backed by CashTokens.',
    uris: { icon: 'ipfs://...', web: 'https://example.org' },
  },
  nativeToken: { funding: tokenCoin, reserve: 1_000_000n },
});

// The genesis commits to these exact bytes: host them at one of the URIs.
const { bytes, uris } = token.deploymentRegistry()!;
```

| `bcmr` field | Meaning |
| --- | --- |
| `name` | The identity's name; the contract's `name()` when omitted |
| `description`, `uris`, `tags` | As in the BCMR schema; `uris` takes `icon`, `web` and the schema's other identifiers |
| `token.symbol`, `token.decimals` | The contract's `symbol()` and `decimals()` when omitted |
| `token.nfts` | How the category's NFTs read; `'generated'` labels the contract's own NFTs from its artifact |
| `extensions` | Extensions of your own, kept beside the SDK's |
| `publicationUris` | Where the registry is hosted; `ipfs://` and the registry's CID when omitted |
| `timestamp` | When the snapshot takes effect; the deployment time when omitted |

When the contract publishes `name()`, `symbol()` and `decimals()`, the SDK reads them from the probe genesis and
refuses stated values that disagree: the symbol case-insensitively, the decimals after the native scale. BCMR symbols
are capitals, digits and hyphens, so state `token.symbol` when the contract's symbol holds other characters. A value
the contract does not publish must be stated.

What the registry describes depends on where the bearer tokens come from:

| Deployment | Identities in the registry | Token decimals |
| --- | --- | --- |
| `nativeToken.funding` | X, the token, with its name, symbol and reserve; and C, the contract that keeps the ledger | The bearer unit's: the ledger's less `log10(scale)` |
| No `funding` | C alone, token and contract in one | The bearer unit's, as above |
| `nativeToken.category` | C alone: X's identity is its issuer's | The ledger's own, unscaled |

A token with a premint, and every wrapper, also carries the `solidcash-native-token` extension, which names the
reserve for explorers that adopt it. CashTokens counts as reserved only the amounts held with a minting or mutable NFT,
so an explorer that does not read the extension shows the whole premint as circulating.

| Key | Value |
| --- | --- |
| `underlying` | X, for a wrapper |
| `reserveLockingBytecode` | The reserve's locking bytecode, in hex |
| `scale` | `nativeToken.scale`, as a string |
| `ledgerSupply` | `totalSupply()`, when the contract publishes it |

The publication commits to the registry's SHA-256 and lists the URIs that serve it. The default URI is `ipfs://`
followed by the registry's CID, so pin the returned bytes as one raw block, or pass `publicationUris` and host the
bytes there.

To publish a new snapshot later, the owner spends the identity with `publishMetadata`. A token category the genesis
created beside C shares C's identity output, so resolve C's identity and add the snapshot to the token's category:

```ts
import { publishMetadata, resolveIdentity, withSnapshot } from 'solidcash/bcmr';

const identity = await resolveIdentity(provider, token.categoryId); // C's identity, proven back to the genesis
const { registry } = token.deploymentRegistry()!;
const tokenCategory = tokenCoin.txid; // X
const snapshot = {
  name: 'My Dollar', description: 'Audited.', token: { category: tokenCategory, symbol: 'MYD', decimals: 6 },
};
await publishMetadata({
  provider, identity: identity!, owner: { utxo: ownerCoin, unlocker: owner.unlockP2PKH() },
  registry: withSnapshot(registry, tokenCategory, snapshot, new Date().toISOString()),
  changeAddress: owner.getAddress(),
});
```

A new snapshot replaces the previous one, so carry over the fields you keep. The owner can also transfer, freeze or
burn the identity: see [CashToken metadata](/docs/guides/deployment#cashtoken-metadata) in the deployment guide.
