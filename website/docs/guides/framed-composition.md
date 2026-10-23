---
title: Framed Composition
description: The experimental framed calling convention. Every entry into a contract runs as its own frame, calls run in EVM order, and each contract's state settles once per transaction.
---

:::caution Experimental
The framed convention is experimental in 0.14.0-beta.1. Composed external state mutation, a call that changes another
contract's state, is outside the release's stability promise. The framed artifact fields, the SDK entry points and
the source shapes the compiler accepts can change between releases. Do not put significant value behind a framed
deployment without an independent review.
:::

The **framed convention** is a second way to compile stateful contracts that call each other. Every entry into a
contract runs as a **frame** on an input of its own, so one transaction can enter the same contract several times,
in the order the EVM would run the calls. However many times a transaction enters a contract, the contract's state
is spent once and written once.

Select it with the compiler option `composition: 'framed'`. The default is `'direct'`. The compiler publishes the
convention on `artifact.composition`, and the SDK routes deployment and calls by it, so the usual stateful calls keep
working.

```ts
import { compileString } from 'solidc';

const artifact = compileString(source, { composition: 'framed' });
artifact.composition?.convention; // 'framed'; absent on a direct artifact
```

## Three ways to compose

Bitcoin Cash has no call opcode. A call between contracts is a set of inputs in one transaction, each running its own
script and checking the others through introspection (see
[Cross-Contract Calls & Results](/docs/language/cross-contract-calls)). SolidCash lays those inputs out in one of
three ways:

| | Direct (default) | Message bus | Framed |
| --- | --- | --- | --- |
| Selected by | Default | Inferred by the compiler when the call graph needs it | `composition: 'framed'` |
| A contract in one transaction | One co-spent input | One participant input that runs every call made to it | One master input per entry, and its records once |
| The same contract called twice, or a cycle | Needs the message bus | Yes, as rows of one shared call manifest | Yes, as separate frames |
| Call order | None: every input checks the same finished transaction | The manifest's depth-first rows | The EVM's order |
| `msg.sender` | Derived from the transaction's inputs | The caller recorded in the manifest | Checked for each frame by the scripts |
| Status | Stable, except a call that changes another contract's state (experimental) | Experimental | Experimental |

The [message bus](/docs/guides/message-bus) keeps one input per contract and runs every call made to that contract
inside it. The framed convention gives every entry its own input, running the contract's own code, and proves the
calls between those inputs with a validator. A framed artifact carries no message-bus route, and every contract a
framed transaction enters must itself be compiled framed.

## How a framed transaction works

### Masters

A framed contract owns a pool of **master** UTXOs: minting NFTs of its token category at the lock of its compiled
program. Each entry into the contract spends one master, runs, and recreates the master unchanged. A transaction
that enters the contract three times spends three masters. The deployment creates the pool, 12 masters by default,
and the pool size is the most entries one transaction can make into the contract.

### Records

The contract's state lives once, in **record** UTXOs of its category: data NFTs for its fields, nodes for its
mappings and chunk runs for long values, at covenant locks derived from the category. A frame reads and writes
records only through the views its witness block declares. When several frames run on one contract, each starts
from the view the frame before it left. The transaction spends each record once and recreates it once, with the
final value.

### The validator

Each contract also owns a pool of **validator** UTXOs at its own address, 4 by default. A validator input checks
what one master cannot see: which frame called which, with what kind of call and as which `msg.sender`, in what
order, and the settlement of each contract the transaction enters more than once. The rules let a lone call that
makes no external call settle through its master alone, but every call the SDK composes spends one validator of the
contract the user enters and recreates it in place. The validator pool therefore bounds how many compositions can
start at the contract at the same time.

The validator is one fixed program that every framed contract shares. Its checks run in the validator input and in
shared facet inputs, which each composition spends and recreates. Every framed genesis funds one coin for each
facet.

A composed transaction therefore holds the caller's coin, one master input per frame, each entered contract's
records once, a validator with its facets, and any containers or oracle inputs the frames need. Its outputs recreate
the masters, the validator and the facets unchanged, write each record once, and carry the events and sends the
frames made.

### Frames and call order

Each entry runs in a frame of one kind:

| Frame | Entered by | Records it runs on |
| --- | --- | --- |
| `ROOT` | A user's call: a signed P2PKH input | Its own contract's |
| `CALL` | A message call from another frame, such as a call to another contract or a value send | Its own contract's |
| `STATIC` | A call to a `view` or `pure` entry | Its own contract's, read-only |
| `DELEGATE` | A proxy's fallback forwarding to its implementation | The proxy's |

An external call splits the calling frame's body into **segments**. The validator orders the frames depth first:
the caller's first segment, then every frame its first call enters, then its second segment, and so on. That is the
order in which the EVM runs the same calls. A callee sees the state its caller wrote before the call, and a frame
that re-enters a contract that is still running sees the writes of every frame that ran before it. A `STATIC` frame,
and every frame it enters, writes no record, emits no event and sends no value.

If any frame fails, the transaction is invalid and nothing settles. Before it sends anything, the SDK evaluates every
frame and reports the failure the execution meets first: the innermost refusing frame, with its source line and
reason.

### Addresses and `msg.sender`

A framed contract's address, `address(this)`, is the P2SH32 address of its validator lock. It depends only on the
contract's token category, so it is known as soon as the category exists. The SDK handle's `address` and
`getAddress()` return it. Behind a proxy, the address is the proxy's.

:::danger
Only a mutable NFT of the contract's category can spend from that address. BCH sent there in a plain output is not a
payment to the contract and cannot be spent again. Pay a contract through a `payable` entry or
`framedCall.sendFramedValue` (see [Value, tokens and balance](#value-tokens-and-balance)).
:::

Inside a frame, `msg.sender`, `tx.origin` and `address(this)` follow Solidity: `msg.sender` changes on every message
call and on nothing else.

| Where the code runs | `msg.sender` | `tx.origin` |
| --- | --- | --- |
| A user's call | The user: the lock of the P2PKH input that signs and pays for the call | The user |
| An internal call or a modifier | Unchanged | Unchanged |
| `this.g()`, or `address(this).call(...)` | `address(this)` | Unchanged |
| A call to another contract, a `view` call, or a value send that runs the callee's `receive()` or `fallback()` | The calling contract's address | Unchanged |
| `address(this).delegatecall(...)`, or an implementation running behind a proxy | Unchanged | Unchanged |

Inside `this.g()`, `msg.value` is 0 and `msg.sig` is the selector of `g`. Behind a proxy, `address(this)` is the
proxy's address.

The scripts check these values; the transaction builder does not choose them. A user's frame requires the caller's
signature to use `SIGHASH_ALL` (alone or with `SIGHASH_UTXOS`), and every other frame's `msg.sender` is checked by the
validator against the frame that called it. On the direct path `msg.sender` is read from the inputs a transaction
co-spends; here it is a call edge the transaction proves.

A user's signature authorizes every call in the transaction that names the user's input as its caller. It covers
every output, but not the other inputs' witnesses, which say which calls are made. Sign only framed transactions you
composed or decoded yourself.

An `address` argument travels as its whole locking bytecode, and the `addressForm` option decides how a body packs
it (see [Solidity Import Compatibility](/docs/compiler/solidity-import-compat)).

## When to use it

Use the framed convention when:

- one transaction must enter the same contract more than once: a callee that calls back into a contract that is
  still running, a contract called several times, or a guard field read while a call is in flight (the SDK does
  not yet serve a call back into the contract the user entered; see
  [Calls into other contracts](#calls-into-other-contracts));
- you port Solidity code that depends on the EVM's call order and on `msg.sender` changing at each message call;
- a contract is too large for one input and divides naturally into its entries (`split: 'func'`, below).

Keep the default direct convention when:

- every contract in the call graph is used once per transaction: direct composition is simpler and works with
  every network provider;
- the contract needs a shape the framed compiler refuses (see
  [What the convention refuses](#what-the-convention-refuses));
- the application must call its contracts through the Electrum provider on chipnet or mainnet today (see
  [Limits](#limits)).

## Enable it

### Compiler API

Pass `composition: 'framed'` to any compile function:

```ts
import { compileFileMulti, compileString } from 'solidc';

const tally = compileString(source, { composition: 'framed' });
const protocol = compileFileMulti('Protocol.scash', { composition: 'framed', evmCompat: true });
```

An unknown convention name fails with `FRAMED_CODEGEN_UNAVAILABLE` rather than falling back to the default. The
options reference is in [Compiler](/docs/compiler).

### SolidHat

Set the convention once for the whole project in `solidcash.config.ts`:

```ts title="solidcash.config.ts"
import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  composition: 'framed',
});
```

The top-level `composition` field overrides a `composition` key in the `compiler` options map. With it set,
`ethers.getCreateAddress` predicts framed addresses (see
[Child deployments and predicted addresses](#child-deployments-and-predicted-addresses)).

### solidc CLI

The CLI has no composition flag of its own. `--split func` compiles one framed master per ABI entry and turns the
framed convention on for that compile:

```bash
solidc Token.scash --split func --output Token.split.json   # a FunctionSplitBundle
solidc Token.scash --split func --size                      # bytes of the logical artifact and of each master
```

`--split size` is the direct convention's size packer; see
[Large Contracts & Split Bundles](/docs/compiler/large-contracts). For one framed artifact without a split, use the
compile API or SolidHat. From the API, `compileFileSplit(path, { split: 'func', composition: 'framed' })` returns the
same `FunctionSplitBundle` (`format: 'solidcash-split-v2'`): a `logical` artifact for the whole contract and one
framed master per entry in `shards`. `split: 'func'` without `composition: 'framed'` fails with
`SPLIT_FUNC_REQUIRES_FRAMED`.

## Deploy

The regular stateful SDK deploys framed artifacts. `getContractFactory(artifact, signer).deploy(...)`,
`StatefulContract.deploy` and SolidHat's `ethers.getContractFactory` route an artifact whose
`composition.convention` is `'framed'` to the framed genesis. The genesis mints the master pool, the validator pool,
a coin for each validator facet, and the records and events the constructor's own frame computed, so it needs more
satoshis than a direct genesis.

The examples below use this contract. Compiled with the defaults it is a direct contract; compiled with
`composition: 'framed'` it is a framed one.

```solidity
pragma solidcash ^0.14.0;

contract Tally {
    int public total;

    function add(int by) {
        this.total = this.total + by;
        require(this.total >= 0);
    }

    function current() view returns (int) {
        return this.total;
    }
}
```

```ts
import { compileString } from 'solidc';
import { Signer, randomUtxo } from 'solidcash';
import { MockNetworkProvider } from 'solidcash/network/mock';
import { getContractFactory } from 'solidcash/contract-factory';

const artifact = compileString(tallySource, { composition: 'framed' });
const provider = new MockNetworkProvider();
const signer = new Signer(privateKey, provider);
// A vout-0 coin creates the category; another coin pays for calls.
await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 0, satoshis: 1_000_000n }));
await provider.addUtxo(signer.getAddress(), randomUtxo({ vout: 1, satoshis: 200_000n }));

const tally = await getContractFactory(artifact, signer).deploy();
```

Framed deploy options, passed as the trailing overrides object of `deploy(...)` or in `StatefulContract.deploy`'s
options:

| Option | Default | Meaning |
| --- | --- | --- |
| `threadCount` | 12 | Masters in the pool: the most entries one transaction can make into the contract |
| `validatorCount` | 4 | Validators at the contract's address: how many compositions can start at it at once |
| `functionSplit` | none | The `split: 'func'` bundle whose `logical` artifact is deployed; the genesis mints a master pool at each entry's lock |

- The constructor runs as the contract's first frame, entered by the deployer. Through a factory, `msg.sender` in the
  constructor is the deploying signer's P2PKH lock. `StatefulContract.deploy` takes `senderLockingBytecode`, or the
  funder's lock when it is a P2PKH lock. A constructor that reads `msg.sender` when no P2PKH lock is known is refused.
- The funding coin must sit at output index 0 and at the funder's own lock.
- The contract's own category holds only its masters, validators and records. A fungible token the contract issues
  needs a category of its own: pass `nativeToken.funding` (see [Contract Deployment](/docs/guides/deployment)).
- `StatefulContract.split` and `StatefulContract.merge` resize the master pool through the contract's `split(n)` and
  `merge(n)` functions (see [Lifecycle](#lifecycle)).

## Call and read

A framed handle exposes the usual `call` namespace. Instead of building a covenant spend, it composes the call:
it plans the frames, runs every one of them to learn the values their witnesses need, checks the whole transaction,
and only then broadcasts it.

```ts
await tally.call.add(4n);                        // composed, checked, then broadcast
const total = await tally.call.current();        // 4n: a read, evaluated locally, nothing is sent

const preview = await tally.call.add(1n).compose(); // derived and checked, not sent
console.log(preview.accepted, preview.verdicts, preview.values);

await tally.connect(otherSigner).call.add(2n);   // the same entry, called by another user
```

- Awaiting a call sends a writing entry and resolves to its `TransactionDetails`; `.send()` does the same.
- A `view` or `pure` entry is answered as a read: the SDK derives its frame over the live records, evaluates it
  locally and returns the value. `.staticCall()` returns the full read result.
- `.compose()` derives and checks a call without sending it. It returns every participant's verdict and the entry's
  decoded return values.
- `.withValue(amount)` attaches satoshis to a call of a `payable` entry. The signer pays them into the contract's
  containers.
- An `address` argument can be given as a signer or a contract handle; the SDK passes its address.
- The caller pays with its largest unreserved tokenless coin. A caller with no coin still learns the entry's own
  revert reason, from a simulation, before it is told that it cannot pay.
- The direct call builder's modifiers (time and age locks, extra outputs) have no framed equivalent yet.

Sends made through one provider wait for earlier sends that could spend the same masters, validators, records,
caller coins or facets, so you can start several calls without awaiting each one. Every composition spends a facet
coin, so framed sends through one provider currently run one after another.
`framedQueue.framedSendQueue(provider).drain()` resolves once every queued send has settled. Calls through a framed
proxy handle are not queued yet: await one before you start the next.

### Calls into other contracts

When an entry calls another contract, the SDK plans the callee frames from the entry's own code. The contract handle
finds each callee among the deployments registered on the provider object: contracts deployed through
`getContractFactory(...).deploy()` or `upgrades.deployProxy` with that provider, matched by the address the call
targets and then by interface name. To reach contracts deployed elsewhere, call through
`framedCall.callFramedEntry` and name them in `externals`:

```ts
import { framedCall } from 'solidcash/framed';

const result = await framedCall.callFramedEntry({
  provider,
  artifact: vaultArtifact,
  categoryId: vaultCategoryId,
  functionName: 'release',
  args: [7n],
  callerUtxo,                                     // a tokenless coin at the caller's own P2PKH lock
  callerLockingBytecode: signer.getLockingBytecode(),
  funder: signer.unlockP2PKH(),
  changeAddress: signer.getAddress(),
  externals: { Token: { artifact: tokenArtifact, categoryId: tokenCategoryId } },
});
console.log(result.accepted, result.broadcast?.txid, result.values);
```

`callFramedEntry` returns the derived transaction, every participant's verdict, the entry's decoded return values
and, when every participant was accepted, the broadcast receipt. A frame the machine refuses comes back with
`accepted: false` and a `refusal` report, and nothing is sent. Pass `publish: false` to derive without sending,
`value` for a `payable` entry, `tokenDeposits` to pay fungible tokens into the contract's containers, and `split`
with the bundle for a `split: 'func'` deployment. Each call is matched to an `externals` entry by the address it
targets, and a call that no entry matches falls back to the provider's registered deployments.

The SDK refuses by name, before it builds anything, a call shape it does not settle yet. One such shape today is a
call back into the contract the user entered, such as `IA(address(this)).g()`, or A calling B and B calling A again.
A callee contract can be re-entered; the entered contract cannot yet.

### Reads

```ts
import { framedDeploy, framedRead } from 'solidcash/framed';

const read = await framedRead.readFramedEntry({
  provider, artifact: tallyArtifact, categoryId, functionName: 'current', args: [],
});
if (read.accepted) console.log(read.value);

const state = await framedDeploy.readFramedState(provider, categoryId, tallyArtifact.stateLayout!);
console.log(state.byNft[0]);                     // decoded fields of the first data NFT
```

`readFramedEntry` runs a read-only entry off chain and sends nothing; it takes `externals` for the contracts the
entry reads. `readFramedState` decodes a deployment's records by category.

## Results and receipts

Awaiting a writing call resolves to the transaction's `TransactionDetails`. For the entry's return values, use
`.compose()` or `callFramedEntry`, whose result carries `values` and `value`.

Each event a frame emits is an NFT output at an event covenant of the emitting contract's category.
`framedReceipt.compositionEventLogs` reads them back from a call's `draft`: one log per event, with the emitting
contract's address (a callee's event names the callee), the event name, and its fields by name and in declared
order.

```ts
import { framedReceipt } from 'solidcash/framed';

for (const log of framedReceipt.compositionEventLogs(result.draft, [vaultArtifact, tokenArtifact])) {
  console.log(log.contract, log.eventName, log.args);
}
```

`framedReceipt.compositionLogListeners()` delivers the same logs to handlers registered per emitting address.

## What the convention refuses

The framed compiler serves a subset of contract shapes. It reports the rest in three places.

**The whole contract, at compile time.** The compile fails with `FRAMED_CODEGEN_UNAVAILABLE` and names the reason
when the contract:

- creates contracts with `new C(...)`;
- holds function pointers;
- keeps inline assembly the compiler cannot lower in a file-level function that an entry reaches;
- has no entry point;
- has a constructor that makes an external call or a value send, or emits an event from a loop;
- declares a `split(n)` or `merge(n)` function of another shape than the one in [Lifecycle](#lifecycle).

**One entry, at compile time.** An entry the master cannot serve stays in the ABI and the dispatcher, but its
program fails whenever it is reached, and the contract's other entries keep compiling. The artifact lists such
entries on `composition.refusedEntries`, each as `{ functionName, reason }` with a name such as `Vault.sweep()`. (A
direct artifact lists its refused functions on `refusedFunctions` instead.) Reasons include:

- a low-level call whose payload the compiler cannot name statically, or a `delegatecall` to code other than the
  contract's own (the generated proxy's forward is served);
- inline assembly in the entry's own body that the compiler cannot lower;
- `blockhash(n)`: every entry of a contract that reads it is refused;
- reading the balance of an address other than the contract's own;
- a few loop shapes that read a run-time number of side-car inputs.

```ts
for (const { functionName, reason } of artifact.composition?.refusedEntries ?? []) {
  console.warn(`${functionName} is not served framed: ${reason}`);
}
```

A call that reaches a refused entry is refused before anything is sent, naming the entry and the compiler's reason
(`FRAMED_HOST_ENTRY_REFUSED: Vault.sweep() is refused by the compiler: ...`). A refused constructor makes the
deployment fail with its reason in the same way.

**At call time.** Every refusal below is raised before anything is broadcast:

- `framedComposer.FramedCompositionRefusedError` (message `FRAMED_COMPOSITION_REFUSED: ...`) when a frame's own code
  refuses. `report.innermost` names the frame, its entry, the source line and the `require` message or custom error,
  and `errorArgs` holds the custom error's arguments.
- `framedComposer.FramedComposerError` with a code such as `FRAMED_POOL_EXHAUSTED` when a pool cannot cover the
  transaction.
- `framedCall.FramedCallError` and `framedRead.FramedReadError` for a call or read that cannot be built from what it
  was given.

```ts
import { framedComposer } from 'solidcash/framed';

try {
  await tally.call.add(-10n);
} catch (error) {
  if (error instanceof framedComposer.FramedCompositionRefusedError) {
    const frame = error.report.innermost;
    console.log(frame?.functionName, frame?.reason.line, frame?.reason.message, error.errorArgs);
  }
}
```

In SolidHat tests, `revertedWith` and `revertedWithCustomError(...).withArgs(...)` read these refusals.

## Value, tokens and balance

- A contract's BCH balance is the value of its satoshi containers. Value reaches a contract only as the `msg.value`
  of one of its frames: a `payable` entry called with `withValue(...)`, a value send from another contract, or
  `framedCall.sendFramedValue(...)`, which runs the contract's `receive()` (or a `payable` `fallback()`) as an EVM
  transfer does.
- A value send in a body (`this.transfer(to, amount)`, or `call{value: v}` in Solidity source) pays a user with an
  output, and pays a contract by running its `receive()` or `fallback()` with that `msg.value`.
- An entry that reads its own balance is listed on `composition.balanceReaders`; the SDK spends every container of the
  contract for it.
- [Token containers](/docs/language/token-containers) work as on the direct path: fungible tokens of another category
  sit at the contract's container for that category, and a frame that pays from one spends it and recreates it with
  the rest. `callFramedEntry` takes `tokenDeposits` to pay tokens into a container.

## Proxies

`upgrades.deployProxy` routes a framed implementation to the framed deployment. It needs a `Signer` runner and
creates two geneses, the implementation's and the proxy's.

```ts
import { getContractFactory } from 'solidcash/contract-factory';
import { upgrades, type FramedArtifact } from 'solidcash/stateful';

const factory = getContractFactory(vaultArtifact as FramedArtifact, signer);
const vault = await upgrades.deployProxy(factory, [signer.getLockingBytecode()]); // a FramedProxyHandle
console.log(vault.proxyDeployment.proxy.categoryId, vault.proxyDeployment.implementation.categoryId);
await vault.call.deposit(5n);
```

- The proxy is generated from the implementation's published state layout. It declares the same fields at the same
  coordinates and has one `fallback` that forwards its call data, with `delegatecall`, to the address in its
  `implementation` field. A hand-written proxy that forwards with inline assembly is refused at compile time.
- Calls through the proxy run the implementation's code as a `DELEGATE` frame on the proxy's records:
  `msg.sender` is the proxy's caller and `address(this)` is the proxy's address. The handle's calls, reads and
  public getters go to the proxy.
- The initializer always runs, through the proxy (`initialize` unless `initializer` names another entry), with the
  positional arguments you pass. `initializer: false` is refused. By default the proxy's genesis is minted already
  holding the state the initializer computes, so no uninitialized proxy is ever on chain. `initializeAs: 'hop'` runs
  the initializer as a separate transaction after the genesis; it is the one way an initializer that calls another
  contract can run, and the SDK broadcasts the transactions back to back only after the hop is accepted.
- The generated proxy has no upgrade entry. If the implementation declares `address implementation`, the proxy
  forwards to that field, so an implementation entry that you guard can rewrite it. Otherwise the proxy keeps the
  address in a record of its own that no implementation entry writes, and the proxy cannot be upgraded.
- Compile a replacement implementation with `upgradesFrom` (for example
  `upgradesFrom: { VaultV2: vaultV1Artifact.stateLayout! }`). The compile fails with `FRAMED_UPGRADE_LAYOUT` when the
  new layout would read the proxy's records differently.

See [Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies) for the direct convention's proxies.

## Block data and time

- `block.timestamp` and `block.number` read the block oracle, as on the direct path. Deployment pins the provider's
  oracle lock into the masters, and a call whose entry reads the oracle co-spends the oracle input. See
  [Block Data & Oracles](/docs/guides/block-oracles).
- `blockhash(n)` is not served: every entry of a contract that reads it is refused.
- `tx.time` is the transaction's locktime. The SDK fixes it once, before it derives any frame, so every frame of a
  transaction reads the same value. A constructor that gates on `tx.time` is refused at deployment.

## Child deployments and predicted addresses

`new C(...)` inside a framed contract is refused at compile time, so deploy children from the SDK instead. A framed
deployment's address derives from its category, and the category is the txid of the coin its genesis spends.
Reading a signer's nonce reserves the coins its next deployments will spend, which lets you predict their addresses:

```ts
import { framedDeploy } from 'solidcash/framed';
import { getContractFactory } from 'solidcash/contract-factory';

const nonce = await signer.getNonce();             // reserves genesis coins for the next deployments
const predicted = framedDeploy.predictCreateAddress(signer.getAddress(), nonce); // locking bytecode
const child = await getContractFactory(childArtifact, signer).deploy();         // spends the reserved coin
```

In a SolidHat project configured for the framed convention, `ethers.getCreateAddress({ from, nonce })` returns the
same prediction. See [Contract Creation & Lifecycle](/docs/language/contract-creation) for the direct convention's
`new`.

## Lifecycle

A framed master serves the contract's `split(n)` and `merge(n)` functions beside its entries: `split(n)` mints `n`
more masters and `merge(n)` retires `n` of them. Each takes exactly two parameters, the count and a signature. Its
body may hold only `require` statements: one `checkSig` of that signature against a constant public key, and bounds
on the count against integer literals. The artifact lists them on `composition.lifecycle`. Call them through
`StatefulContract.split` and `StatefulContract.merge` (see [Contract Concurrency](/docs/guides/concurrency)).

## Limits

The chain's limits apply to every input of a framed transaction:

- **10,000 bytes of unlocking bytecode per input.** A master input carries the contract's whole compiled program,
  the entry's arguments and the frame's witness block. A contract whose program and witnesses do not fit must be
  compiled with `split: 'func'`, which gives every entry a master program of its own. If one entry is still too
  large, move part of its work into a second entry the contract calls on itself, as in the fragment below.
- **Transaction size.** Every frame carries its own copy of its program, so a transaction that runs many frames
  grows quickly. Relay policy accepts transactions up to 100,000 bytes.
- **Operation cost.** Each input's budget comes from the length of its own unlocking bytecode, 800 units per byte.
  The validator reads and hashes the witnesses of every frame it covers, so a wide composition can exceed its budget
  even when every master fits.
- **128-byte NFT commitments.** On chain, each record's and each event's commitment holds at most 128 bytes, so
  state spreads over data NFTs, mapping nodes and chunk runs, as on the direct path.
- **Pools.** The master pool bounds the entries one transaction makes into a contract, and the validator pool bounds
  how many compositions can start at it at once. A transaction that needs more is refused with
  `FRAMED_POOL_EXHAUSTED`.
- **Providers.** Calls and reads find a deployment's masters, validators and records by listing its category's
  UTXOs, which needs a provider that implements `getUtxosByTokenCategory`. The mock and regtest providers do. The
  Electrum provider does not, so framed contracts cannot be called or read through it yet.
- **Mock limits.** A green run on the mock under relaxed limits does not prove a framed transaction is valid on chain.
  Test under the real limits; see [BCH Script & Transaction Limits](/docs/compiler/script-limits).

Compiled with `split: 'func'`, the fragment below runs a token transfer as two frames, each on its own input. The
second half is an entry that only the contract itself may call:

```solidity
function transfer(address to, uint256 value) public returns (bool) {
    address from = msg.sender;
    require(this.balances[from] >= value);
    this.balances[from] = this.balances[from] - value;
    this.credit(to, value);   // a message call: msg.sender is address(this) inside credit
    emit Transfer(from, to, value);
    return true;
}

function credit(address to, uint256 value) public {
    require(msg.sender == address(this));
    this.balances[to] = this.balances[to] + value;
}
```

## The artifact

`artifact.composition` is present only on a framed artifact:

| Field | Meaning |
| --- | --- |
| `convention` | `'framed'` |
| `placeholders` | Where deployment fills the category, the contract's address and the validator's hash into the program |
| `stopSites` | Each entry's external calls and write segments, which the SDK resumes from while it derives a call |
| `refusedEntries` | Entries the master cannot serve, with the reason |
| `balanceReaders` | Entries that read the contract's own balance |
| `lifecycle` | The `split(n)` and `merge(n)` functions the master serves outside its ABI |

See [Artifacts](/docs/compiler/artifacts) for the rest of the artifact.

## The `solidcash/framed` entry point

The contract handle covers most applications. The `solidcash/framed` subpath exposes the layers beneath it:

| Namespace | Purpose | Main entries |
| --- | --- | --- |
| `framedCall` | Enter a deployed contract's entry and broadcast | `callFramedEntry`, `sendFramedValue`, `FramedFunctionCall`, `FramedCallError` |
| `framedRead` | Run a read-only entry off chain | `readFramedEntry`, `FramedReadError` |
| `framedReceipt` | Decode the events a composition emitted | `compositionEventLogs`, `compositionLogListeners` |
| `framedDeploy` | Genesis, pools, records and address prediction | `deployFramedStatefulContract`, `readFramedDeployment`, `readFramedState`, `predictCreateAddress` |
| `framedQueue` | Serialize sends that share resources | `framedSendQueue`, `CompositionQueue` |
| `framedComposer` | Plan, derive, lay out and assemble a composition | `FramedCompositionRefusedError`, `FramedComposerError` |
| `framedReference` | An independent reference model of the validator's checks, for audits and tests | `decideReference` |

## Related pages

- [Cross-Contract Calls & Results](/docs/language/cross-contract-calls): typed calls, results and the direct path.
- [Atomic Calls with the Message Bus](/docs/guides/message-bus): the other experimental composition model.
- [Large Contracts & Split Bundles](/docs/compiler/large-contracts): `--split size` and `--split func`.
- [Upgrades, Proxies & Delegatecall](/docs/language/upgrades-proxies): proxies on the direct path.
- [Contract Deployment](/docs/guides/deployment): genesis funding, identity outputs and `nativeToken`.
- [Block Data & Oracles](/docs/guides/block-oracles): the block oracle framed entries co-spend.
