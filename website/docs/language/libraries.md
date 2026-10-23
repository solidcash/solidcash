---
title: Libraries & Using-For
---

SolidCash has the same `library` keyword as Solidity, the same `using ... for` attachment, and the same
operator overloading. It also has a third mechanism Solidity does not need: **external library precompiles**,
which is how expensive primitives like `keccak256` are shared without duplicating bytecode.

## Inline libraries

A library whose functions are all `internal`, `private` or unmarked is a compile-time construct. Those
functions are inlined at every call site, exactly like Solidity's internal library functions. An inline-only
library still has an ABI-only declaration artifact, but its `bytecode` is empty and it cannot be deployed.

A library function without an explicit visibility is `internal`. Only a function marked `public` or `external`
is an entry point of the library's own artifact. Called from an importing contract, a public function which does
not touch the library's declared state is still inlined; a public function which touches that state takes the
deployed delegate-library path described below.

```solidity
pragma solidcash ^0.14.0;

library SafeMath {
    function add(int a, int b) internal returns (int) {
        int r = a + b;
        require(r >= a);
        return r;
    }
}

contract Vault() {
    function deposit(int balance, int amount) {
        require(SafeMath.add(balance, amount) > 0);
    }
}
```

Libraries may also declare `struct`, `enum`, `type`, `event`, `error` and `constant` members, which are
referenced with `Library.Member`:

```solidity
library Rebase {
    struct Data { uint256 base; uint256 elastic; }

    function addElastic(Data storage d, uint256 n) internal {
        d.elastic += n;
    }
}

contract Pool() {
    Rebase.Data total;
    using Rebase for Rebase.Data;

    function grow(uint256 n) public {
        this.total.addElastic(n);
    }
}
```

This is Solidity's `storage self` pattern, and it works the same way: `self` is one of possibly many struct
instances in the caller's state. Storage-pointer parameters have no on-stack value, so such a function is
inlined at each call site with the parameter aliased to the argument's state path. See
[Data Locations](/docs/language/data-locations#storage-parameters).

## Using-for

`using L for T` attaches a library's functions to a type so they can be called with method syntax. The
receiver becomes the first argument.

```solidity
library SafeMath {
    function add(int a, int b) internal returns (int) {
        int r = a + b;
        require(r >= a);
        return r;
    }
}

using SafeMath for int;

contract Calculator() {
    function run(int x, int y) {
        require(x.add(y) > 0);      // same as SafeMath.add(x, y)
    }
}
```

`using L for *` attaches the library to every type:

```solidity
library Utils {
    function double(int a) internal returns (int) { return a * 2; }
}

contract Consumer() {
    using Utils for *;

    function run(int x) {
        require(x.double() == x * 2);
    }
}
```

A directive inside a contract applies to that contract; a file-level directive applies to the whole file. The
`global` keyword (`using L for T global;`) also makes a file-level attachment visible to every file that imports
this one. Under `evmCompat` the Solidity rules apply: a file-level directive must name its type (`for *` is
allowed only inside a contract), and `global` is allowed only on a user-defined value type.

### Selective attachment

The braced form attaches specific functions rather than a whole library:

```solidity
library MathLib {
    function add(int a, int b) internal returns (int) { return a + b; }
    function sub(int a, int b) internal returns (int) { return a - b; }
}

using { MathLib.add } for int;

contract Selective() {
    function run(int x, int y) {
        require(x.add(y) >= 0);
    }
}
```

### Operator overloading

The same braced form maps functions onto operators for user-defined value types:

```solidity
type Amount is int;

function addAmount(Amount a, Amount b) pure returns (Amount) {
    return Amount.wrap(Amount.unwrap(a) + Amount.unwrap(b));
}

using { addAmount as + } for Amount global;

contract Ledger() {
    function total(int raw) {
        Amount a = Amount.wrap(raw);
        Amount b = Amount.wrap(1);
        require(Amount.unwrap(a + b) > 0);
    }
}
```

Operators bind only on a user-defined value type. Write the binding as above: a file-level
`using { f as op } for T global;` directive naming a `pure` free function whose parameters are all of type `T`.
This is the form Solidity requires, and `evmCompat` enforces it: a binding inside a contract, without `global`,
or to a function that is not `pure` is rejected there. A comparison operator must return `bool`, every other
operator returns `T`, and only `-` and `~` may be unary.

The overloadable operators are `+ - * / % **`, `== != < <= > >=`, and `& | ^ ~`.

## Deployed delegate libraries

:::caution Experimental
Deployed delegate libraries are experimental in 0.14.0-beta.1 and outside the stable compatibility promise. Prefer an
inline library unless the code must move to a co-spent input.
:::

A library with a `public` or `external` function compiles to its own executable artifact. When such a function
touches state declared by the library, it is automatically marked as a delegate entry point. Calls imported as
`L.f(...)` then run against the consuming contract's state, which is the BCH analogue of a
Solidity `DELEGATECALL`-linked library.

```solidity
pragma solidcash ^0.14.0;

library Counter {
    uint256 count;

    function incrementBy(uint256 n) public {
        this.count += n;
    }
}
```

The library declares the **state shape** it operates on. A consumer that imports it calls `Counter.incrementBy(n)`,
and the compiler rewrites that to a delegatecall against a synthesized `address __libAddr_Counter` constructor
argument. That address becomes part of the consumer's locking bytecode, so a spender cannot substitute a different
library. The compiler also records the library name, function, selector and reconstructible arguments in the
consumer ABI.

The SDK co-spends the linked library automatically after the deployed instance has been registered. With a
manually assembled deployment, link the consumer to the library locking bytecode and register the live instance:

```ts
import { Contract } from 'solidcash';
import { StatefulContract } from 'solidcash/stateful';
import { hexToBin } from '@bitauth/libauth';

const library = StatefulContract.withCategory(
  new Contract(counterArtifact, [], { provider }),
  counterCategory,
);

const appInner = new Contract(
  appArtifact,
  [hexToBin(library.inner.lockingBytecode)], // __libAddr_Counter
  { provider },
);
const app = StatefulContract.withCategory(appInner, appCategory);

app.registerLibrary('Counter', library);
await app.call.bumpBy(2n).send();
```

An SDK `ContractBundle` can carry the whole artifact graph and resolve a deployed library from the linked locking
bytecode and provider index, avoiding manual `registerLibrary()` for bundle-managed deployments. A missing or
wrongly linked instance is a build error, not an optional call.

### Layout compatibility

Because the library runs against the caller's state, the consumer's state layout must **lead with the library's
fields**, in the same order, with the same names and types. This is the same rule as EVM upgradeable-proxy
storage-layout compatibility. It is checked twice: at compile time when both layouts are in one compilation,
and again by the SDK at build time.

### Return values

A delegate library call has **no synchronous return**. BCH has no cross-input call, so a library function
cannot hand a value back to the caller's script; using a library call as a value (`r = L.f(x)`) is a compile
error. Results are communicated through the shared state: the library writes a state field and the caller
reads it from its own state afterwards.

Value-returning pure helpers belong in an inline library or an external library precompile instead.

### Arguments

Library-call arguments are positional and must be either a forwarded parameter of the enclosing function or a
compile-time literal:

```solidity
pragma solidcash ^0.14.0;

import "./counter.scash";

contract App() {
    uint256 count;   // must match the library's leading state layout

    function bumpBy(uint256 n) public { Counter.incrementBy(n); }   // forwarded parameter
    function bumpOne() public { Counter.incrementBy(1); }           // literal
}
```

Computed expressions and state reads are rejected with a clear error: the delegatecall data is not on chain,
so the SDK is the courier and has to be able to reconstruct the arguments.

### Contention and branding

A deployed library is a co-spent UTXO, so a globally shared one would serialize all of its users. Compiling
with the `brandLibrary` option pins the library to its owning consumer's category and requires that consumer's
master to be co-spent. The library then rides the master's existing serialization and adds no marginal
contention. Shard by minting a per-consumer branded copy.

Construct the linked instance with the helper rather than manually reversing category bytes:

```ts
const libraryInner = StatefulContract.brandedLibrary(
  brandedCounterArtifact,
  appCategory,
  { provider },
);
const library = StatefulContract.withCategory(libraryInner, libraryCategory);
app.registerLibrary('Counter', library);
```

`registerLibrary()` checks that a branded artifact carries the calling contract's category. The on-chain library
covenant independently checks the same brand against the co-spent master.

:::note
Whoever controls the master can re-mint a branded library, which means swappable logic without changing the
consumer's address. That is the same trust surface as an EVM upgradeable proxy. Use an immutable,
non-minting brand for libraries that are meant to be frozen.
:::

## External library precompiles

There is a third, lower-level mechanism: a **precompile**, a Script bytecode subroutine invoked with
`OP_INVOKE` inside the caller's own script. A precompile is described by a function name, a hex-encoded Script
blob and an input/output ABI. It is pure stack computation: it has no SolidCash state layout, deployment ABI or
source-level `library` declaration.

| | External library (precompile) | Deployed library contract |
| --- | --- | --- |
| Layer | a Script bytecode subroutine | a source-language contract abstraction |
| Execution | `OP_INVOKE` within the caller's script | a separate co-spent contract evaluation |
| State | pure: inputs to outputs on the stack | touches the caller's state |
| Reuse storage | inline in the redeem script, or a side-car blob UTXO | a deployed contract UTXO |
| Linking | by hash (content-addressed) | by address / category brand |
| Returns a value | yes (synchronous subroutine) | no (via shared state) |

### Register a custom precompile

Pass precompiled Script and its ABI through `userLibraries`:

```ts
import { compileString } from 'solidc';

const incLibrary = {
  name: 'inc',
  code: '8b', // OP_1ADD
  abi: {
    inputs: [{ name: 'x', type: 'int' }],
    outputs: [{ type: 'int' }],
  },
};

const artifact = compileString(source, {
  userLibraries: [incLibrary],
});
```

The source may then call `inc(x)` like a built-in function. Names cannot shadow a built-in library. The compiler
type-checks the declared ABI but treats the bytecode as trusted build input: publish and audit the exact blob with
the artifact.

The current `userLibraries` interface accepts an already compiled hex blob; compiling a `.scash` file directly
into a precompile blob is not a compiler entry point. This is distinct from compiling a source-level `library`
into a deployed delegate-library artifact.

### Inline selection and blob side-cars

By default, a blob of at most 256 bytes used at exactly one contract-wide call site is inlined. Otherwise the
artifact selects a self-preserving blob side-car. Override the choice per name or disable the heuristic:

```ts
const sidecarArtifact = compileString(source, {
  userLibraries: [incLibrary],
  inlineLibraries: { inc: false },
});

const noAutomaticInlining = compileString(source, {
  userLibraries: [incLibrary],
  disableAutoInline: true,
});
```

An inline descriptor needs no extra UTXO. For a side-car descriptor, the consuming script reads the last input,
extracts the blob range published in `artifact.externalLibraries`, and verifies its `hash256` before invoking it.
The side-car covenant recreates itself as the last output. Stateful consumers salt its address with their category;
stateless consumers use the shared all-zero salt.

Provision the blob UTXO once before the first call. `send()` discovers, co-spends and recreates it automatically;
explicit `build()` or `debug()` workflows must resolve the required side-car first:

```ts
import { resolveLibraryBlob } from '@solidcash/utils';
import { TransactionBuilder } from 'solidcash';

const descriptor = artifact.externalLibraries!.find((item) => item.name === 'inc')!;
const blob = resolveLibraryBlob(descriptor);

const deployment = new TransactionBuilder({ provider });
await deployment.addSidecarDeployIfNeeded(blob); // pass category bytes as salt for a stateful consumer
// Add a funding input and change as usual, then send the deployment transaction.

await spendBuilder.addRequiredSidecars(); // before synchronous build() or debug()
```

One transaction currently supports only one distinct blob-side-car identity. Calls which require different blobs
or different category salts must be separated or the relevant blobs must be inlined.

`keccak256` is registered through the same name/ABI registry, but runtime Keccak uses the stronger
compute-and-commit result-NFT protocol rather than the blob loader. Literal calls are folded at compile time. See
[Cryptography](/docs/language/cryptography) and
[Computation Sidecars & Result NFTs](/docs/language/computation-sidecars) for provisioning and capacity details.

## Why inline versus deploy is your choice

There is no free shared code on Bitcoin Cash. A transaction can only read the bytecode of inputs it **spends**,
so using library code means either embedding it (duplicated bytes, no contention) or co-spending the UTXO that
holds it (shared bytes, plus lifecycle and contention). EVM code is freely shareable with zero contention; BCH
has no equivalent.

This, rather than a code-size cap, is what should drive the choice:

- **Inline** by default. It is simplest and adds no co-spent inputs.
- **Deploy** when the contract outgrows a single input's script-size and operation-cost budget. Each input
  carries its own budget, so moving logic to a co-spent UTXO multiplies the budget available.

## See also

- [Functions](/docs/language/functions) - visibility, free functions and function types
- [Data Locations](/docs/language/data-locations) - `storage` parameters and aliasing
- [Cryptography](/docs/language/cryptography) - the keccak256 and ecrecover side-cars
- [Script Limits](/docs/compiler/script-limits) - the per-input budgets that drive externalisation
