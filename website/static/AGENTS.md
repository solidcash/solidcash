# SolidCash -- AI Agent Reference

Reference for AI coding agents that write SolidCash contracts or port Solidity contracts to Bitcoin Cash. It
covers SolidCash 0.14.0-beta.1. This file is served at https://solidcash.org/AGENTS.md; the full documentation is
at https://solidcash.org/docs.

SolidCash is a smart-contract language for Bitcoin Cash (BCH) with Solidity syntax. The `solidc` compiler turns
`.scash` sources, and `.sol` sources under the `evmCompat` option, into Bitcoin Script artifacts. The `solidcash`
TypeScript SDK and the SolidHat project tool deploy, call and test them. SolidCash is not an EVM: contract state
lives in CashToken NFT commitments, a contract call is a co-spend inside one transaction, and limits are bytes and
operation cost per input instead of gas. It started as a fork of CashScript but is not backwards compatible with
it, so CashScript examples do not apply.

## Rules for Agents

1. Solidity syntax, BCH semantics. Read "Key Differences from Solidity" before porting. Most code ports, but
   `msg.sender`, `msg.value`, addresses, events, `try`/`catch`, `block.*` values and storage behave differently.
2. Authorize with signatures. Take a `sig` parameter and check it against a stored or constructor `pubkey` with
   `checkSig`, or verify oracle data with `checkDataSig`. Do not rely on `msg.sender == owner` alone: the
   transaction builder chooses which inputs a transaction co-spends, and the compiler warns on every read.
3. Every public or external spend path must verify something (`require`, `assert`, `revert`, a time lock) or
   change state. A path that does neither is spendable by anyone, so the compiler rejects it by default.
4. Treat compiler warnings as porting work. Each one marks a construct whose BCH meaning differs from Solidity.
5. Do not invent syntax or SDK calls. When something is missing here, check https://solidcash.org/docs. A
   construct outside the supported subset fails with a named diagnostic; redesign it rather than forcing it.
6. Do not weaken safety to get a green build. Keep `enforceFinalRequire`, `enforceLocktimeGuard` and
   `allowUnsafeOperations` at their defaults, and avoid `unsafe` lifecycle tiers and `unsafe_*` casts unless the
   user asks for them.
7. Respect real limits: 10,000 bytes of unlocking bytecode per input, 128-byte NFT commitments, and an operation
   cost budget per input. The mock network provider can run relaxed limits, so a green mock test does not prove
   a transaction is valid on mainnet. See "Limits and Costs".
8. Experimental profiles are outside the stable promise: composed external state mutation, custom delegate
   forwarding beyond the built-in proxy, and message-bus kernel composition. Say so when a design depends on one.
9. 0.14.0-beta.1 is a beta and security hardening is ongoing. Do not advise putting significant value behind a contract
   without an independent review.

## Key Differences from Solidity

```text
State          NFT commitments on the contract's UTXOs; no storage slots; one spend is one execution
Mappings       verified mappings: one entry NFT per key, absence proven on read; iterable only if `enumerable`
Calls          co-spent inputs and outputs in one transaction; no call stack, no re-entrancy
msg.sender     caller's locking bytecode, or tx.origin for a direct spend; authorize with checkSig instead
msg.value      net satoshi change of the contract's satoshi container
address        full variable-length locking bytecode, not 20 bytes; `.transfer`/`.send` need `address payable`
Integers       int/uint are checked 256-bit like Solidity; bigint is arbitrary precision and never wraps
Encoding       numbers are little-endian sign-magnitude (int256 takes 33 bytes); natively bytes32(x)[0] is the low byte
Hashing        keccak256 is real (a co-spent side-car computes it); selectors are sha256 unless evmCompat
Events         NFT-commitment records, not logs; no bloom filter, no topics
Errors         revert and custom errors abort the transaction; error arguments are artifact metadata
try/catch      compiles, but a failed call fails the whole transaction, so catch bodies never run
block.*        oracle-backed reads or documented shims, not native VM state
Gas            none; limits are bytes, stack size and operation cost per input; fees are per byte
immutable      assigned once in the constructor, stored in the state NFT rather than in bytecode
Contention     two transactions spending the same state UTXO conflict; only one confirms
```

## Porting a Solidity Contract

There are two routes, and both target the same compiler.

- **Compile the Solidity source with `evmCompat: true`.** The compiler accepts `pragma solidity`, resolves `.sol`
  imports including package paths such as `@openzeppelin/contracts/...`, synthesizes callable public getters, and
  switches `abi.*`, selectors, `interfaceId` and event selectors to EVM encoding and keccak256. Without the flag,
  `pragma solidity` is a diagnostic that names the option. New SolidHat projects set `compiler: { evmCompat: true }`
  in `solidcash.config.ts`; it applies to `.scash` sources too, so remove it explicitly for native ABI and selectors.
- **Rewrite as native `.scash`** with `pragma solidcash ^0.14.0;`. Native mode uses compact Script ABI framing and
  sha256-derived selectors, and gives the most control over bytecode size. Prefer it for new BCH-only contracts.

Both modes accept bare state access (`balanceOf[a] += x`) as well as the explicit `this.balanceOf[a]` form.
`evmCompat` changes ABI bytes, selectors and some storage layouts, so choose the mode before the first deployment.

```ts
import { compileFileMulti } from 'solidc';
const artifacts = compileFileMulti('contracts/Token.sol', { evmCompat: true }); // one artifact per contract
```

### Workflow

1. Compile the complete source graph with `compileFileMulti` so every declaration and contract is visible.
2. Fix parser and type errors without changing protocol behavior.
3. Review every warning and every use of addresses, `msg.*`, `block.*`, external calls, assembly and storage.
4. Apply the adaptations below.
5. Inspect each artifact: ABI, state layout, external-call metadata, side-cars, and bytecode size against the
   10,000-byte input limit.
6. Test state transitions and adversarial substitutions in the BCH VM under real limits, then deploy with the SDK
   factory, the proxy profile or a split bundle.

### Adaptations

```text
onlyOwner / access control   store the owner pubkey; take a sig; require(checkSig(s, owner))
ERC-20 ledger                mapping balances backed by entry NFTs; the sender proves `from` with a pubkey + sig;
                             prefer native CashTokens for freely transferable fungible assets
Oracle data                  checkDataSig(datasig, message, oraclePubkey)
Deadlines, vesting           require(tx.time >= t) for absolute time, require(this.age >= n) for relative time
Upgradeable proxy            the built-in upgrades.deployProxy profile; initialize through the proxy
Calling another contract     declare an interface; call IFoo(target).f(args) with the callee's address
Events                       NFT-commitment records read through SDK receipts, filters or listeners
Custom errors                artifact metadata; failures surface in SDK preflight, not as on-chain revert data
Re-entrancy guards           compile and are harmless; there is no re-entrancy to guard against
Unbounded storage loops      bounded by per-input operation cost, not gas; paginate
Large contracts              split bundles (compileFileSplit, solidc --split size) or less code per contract
gasleft(), block.gaslimit    fixed shims; remove gas-budget logic
block.prevrandao             grindable by the transaction builder; never use it as randomness
transient state              lowered to a zero-initialized per-function local
__gap arrays                 omitted under evmCompat; they reserve nothing on BCH
20-byte addresses            address is full locking bytecode; uint160/bytes20 narrowing warns (see addressForm)
```

### Not supported (redesign instead)

- Storage-slot layout assumptions. `contract C layout at <base>` is accepted, but a base the compiler can evaluate
  only shifts EVM-visible slot numbers (`.slot`, `sload`/`sstore`); state still lives in NFTs.
- Synchronous calls and call stacks: a failed call cannot be caught, so `catch` bodies never run, and a low-level
  call's `success` is always true.
- Gas metering, EIP-55 checksummed address literals, blob fields.
- `external` function-pointer arrays (`function(..) external[]` with push): a known failure.
- Satoshi or token movement inside delegate (proxy) execution, fallback-only transparent proxies, circular
  cross-contract address references.
- `hardhat-deploy` scripts, tags and dependency graphs; universal third-party chai matchers.

## Toolchain

Six npm packages, all versioned 0.14.0-beta.1. They ship as ESM only and target Node.js 22 or newer. The commands
below resolve these names from npm; a 404 means that release is not published yet.

```text
solidc                      -- compiler: CLI `solidc` and the compileFile/compileString API
solidcash                   -- SDK: Contract, TransactionBuilder, StatefulContract, providers, signers
@solidcash/utils            -- shared artifact/ABI types and script helpers (a dependency of the others)
@solidcash/testing          -- Hardhat-style runtime: config, HRE, tasks, network helpers, chai shim (CLI `solidcash`)
@solidcash/solidhat         -- project tooling built on @solidcash/testing (CLI `solidhat`)
@solidcash/create-solidhat  -- project scaffolder behind `npm create @solidcash/solidhat`
```

```sh
npm create @solidcash/solidhat@latest my-app -- --yes  # new project; --yes accepts defaults and installs
npx @solidcash/solidhat --init --dry-run               # preview adding SolidHat to an existing (Hardhat) project
npm install solidcash                                  # SDK only
npm install --save-dev solidc                          # compiler API and CLI (or: npm install -g solidc)
```

Create flags (after `--`): `--template typescript|javascript|empty`, `--package-manager npm|yarn|pnpm`,
`--hardhat 2|3`, `--ethers 5|6`, `--sample`, `--no-sample`, `--dry-run`, `--force`, `--yes`, `--install`,
`--no-install`. Without a TTY there are no prompts, and packages install only with `--yes` or `--install`.
A project gets `solidcash.config.ts`, `vitest.solidhat.config.ts`, samples in `contracts/`, `test/` and
`scripts/deploy.ts` (not with `empty`); compiles go to `artifacts/solidcash/`.

```text
contracts/                  .scash and .sol sources
test/                       Vitest tests
scripts/deploy.ts           network-selectable deployment script
solidcash.config.ts         compiler, paths, typegen, accounts, networks
vitest.solidhat.config.ts   SolidHat preset and test include pattern
artifacts/solidcash/        generated artifacts (ignored)
typechain-types/            generated bindings
```

### solidc CLI

```text
solidc <file> [options]    -- e.g. solidc Counter.scash -o Counter.artifact.ts -f ts
-o, --output <path>        -- write the artifact to a file (default: stdout)
-f, --format <json|ts>     -- json (default) or ts (`export default {...} as const`, typed imports)
-h, --hex | -A, --asm      -- print the script as hex or ASM instead of an artifact (help is -?, not -h)
-c, --opcount | -s, --size -- print the opcode count or byte size (size excludes constructor args)
--split <off|size|func>    -- size: root + facet bundle for an over-limit contract; func: one framed master per entry
--suppress-warnings | --no-source-map  -- hide warnings | skip source maps (faster, weaker failure attribution)
--no-message-bus           -- forbid inferred message-bus composition (fails if the contract needs it)
-S | -L                    -- skip function parameter type enforcement | skip the injected tx.time locktime guard
--allow-unverified-paths   -- unsafe: a path with no verification and no state covenant warns instead of failing
--allow-unsafe-operations  -- unsafe: admit caller-controlled delegatecall/selfdestruct authority
```

`--asm`/`--hex` exclude `--output` and `--split size|func`; a bare `--split` is refused. A script over 10,000 bytes
gets a warning that BCH will not accept it. The CLI has no Solidity-mode flag.

### Compile API (Node.js)

```ts
import { compileFile, compileFileMulti, compileFileSplit, compileString } from 'solidc';

const artifact = compileFile(new URL('./Counter.scash', import.meta.url)); // the last concrete contract
const all = compileFileMulti('Protocol.scash');                    // ArtifactMap keyed by contract name
const split = compileFileSplit('Large.scash', { split: 'size' });  // SplitArtifactBundle
const fromText = compileString(source, { files: { 'Lib.scash': libSource } }); // in-memory imports
```

```text
evmCompat: true              -- Solidity mode: `pragma solidity`, .sol imports, EVM ABI word encoding
primaryContractName          -- choose the contract compiled into the single artifact
enforceFinalRequire          -- default true: a path with no verification and no state covenant is an error
enforceLocktimeGuard, enforceFunctionParameterTypes  -- default true; allowUnsafeOperations default false
optimise: false              -- debugging only: exact failing source lines, bigger script; never deploy it
chainId                      -- block.chainid as chainId & 0xff: mainnet 0, chipnet 1, testnet4 2, regtest 255
maximumInputBytes, commitmentLimit  -- default 10,000 and 128 (BCH); raise them only for private test networks
```

An artifact is what the SDK consumes: `contractName`, `constructorInputs`, `abi` (selectors, effect metadata),
`bytecode` (ASM without constructor args), `source`, `compiler`, `stateLayout`, `events`, `errors`, `debug`. Keep
the exact artifact of every deployment (https://solidcash.org/docs/compiler/artifacts). Solidity sources:
`compileFile('Token.sol', { evmCompat: true })` compiles the documented subset (new SolidHat projects set
`evmCompat: true` in their config); see https://solidcash.org/docs/compiler/solidity-import-compat.

## Language Reference

The compiler default is native mode. `evmCompat: true` enables Solidity compatibility (`pragma solidity`, `.sol`
imports, keccak256 selectors, EVM-style casts and ABI, stricter checks). It also applies to `.scash` sources, which
is why generated SolidHat projects use EVM ABI encoding until you remove the option. Rules hold in both modes
unless marked (native) or (evmCompat). Solidity shapes the parser accepts beyond the documented subset are
(experimental): https://solidcash.org/docs/basics/solidity-parity

### Source File Structure

```solidity
pragma solidcash ^0.14.0;                    // native: only `solidcash`; `pragma solidity` needs evmCompat
import "./Base.scash";                       // wildcard: every file-level declaration
import "./Types.scash" as T;                 // namespace: qualified types (T.Point, T.Color.Red)
import { Pair, helper } from "./Lib.scash";  // selective; an `as` rename resolves only for enums
import "@scope/pkg/Math.scash";              // package path via node_modules; `.scash` is tried if omitted
uint256 constant MAX = 100;                  // file level also takes struct, enum, type, error, event,
function double(int x) pure returns (int) { return x * 2; }   // free functions, library, using, interface
contract Vault(pubkey admin) is Base(admin) { /* members in any order */ }
```

- Imports must precede all other declarations (pragmas may go anywhere). `import * as X from "f";` does not parse
  for a file path: write `import "f" as X;`. Files may import each other; an inheritance cycle is an error.
- Contract members may come in any order; at most one `constructor`, `fallback` and `receive`. Contract
  parameters (`contract C(pubkey owner)`, list optional) are baked into each instance's bytecode.
- With several contracts in a file `solidc` compiles the last; the project `compile` task emits one per contract.

### Types

```solidity
bool                                 // no implicit conversion from integers
int  uint                            // aliases of int256 / uint256: EVM ranges, overflow-checked
int8 .. int256  uint8 .. uint256     // 8-bit steps; N/8 + 1 bytes on chain (sign-magnitude)
bigint                               // arbitrary precision, never range-checked or wrapped
fixed  ufixed  fixedMxN  ufixedMxN   // fixed = fixed128x18; M = 8..256 (step 8), N = 0..80 decimals
string  bytes  bytesN  byte          // byte = bytes1; (native) bytesN may exceed 32, e.g. bytes65
pubkey  sig  datasig                 // ~33 / ~65 / ~64 bytes; convert implicitly to bytes
address  address payable             // full locking bytecode, variable length; payable for .transfer/.send
T[N]  T[]  mapping(K => V)           // arrays: locals, params, state; mappings: state only (Mappings and Arrays)
function(int) internal returns (int) // function type
Point  Status  Price  IToken         // struct, enum, value type; an interface/contract name types an address
```

Bounded arithmetic is checked per operation as in Solidity 0.8: overflow, underflow and division or modulo by zero
fail the script; shifts truncate to the type and never fail. Mixed signed/unsigned operands need a cast (see Type
Casting); literals fit any integer type. `**` needs an unsigned exponent type (`uintN`, `bigint` or a literal).

```solidity
unchecked { uint8 w = uint8(255) + uint8(1); }   // wraps modulo 2^N to 0
uint256 constant FEE = 1000;                     // file, contract or library level; compile-time, inlined
uint256 immutable cap;                           // set once in the constructor; lives in the state NFT
enum Priority { LOW = 1, MEDIUM = 5, HIGH }      // explicit values (extension); HIGH = 6; int(p), Priority(n)
type Price is uint64;                            // value type: file, contract, library or interface level
Price q = Price.wrap(v);  uint64 u = Price.unwrap(q);   // (native) also Price(v) and uint64(q)
fixed128x18 total = 1.5 * 2.0 + 0.25;            // * and / rescale; natively `1.5 * 2` is a type error
bytes memory buf = new bytes(32);                // memory is the default; assigning aliases the buffer
Account storage acc = this.accounts[user];       // storage local: alias of a struct, array or mapping path
```

- A bytecode constant is a `constant` or a contract parameter, not an `immutable`. (native) A `constant` local is
  write-protected. Fixed-point is a SolidCash extension (solc never implemented it; warned once).
- Data locations: native sources never need one; `.sol` units need one where Solidity 0.5+ does. A `calldata`
  value is read-only; a `storage` parameter (`mapping(K => V) storage m`) inlines its function per call.

### Literals

```solidity
42  1_000_000  1e6  2.5e3          // integers; `-7` is unary minus applied to 7
1.5  0.05                          // decimal literals are fixed-point values
"text"  'text'  "a" "b"            // escapes allowed; adjacent literals concatenate
unicode"snow \u2603"               // unicode string literal with \u escapes
0xdeadbeef  0x                     // hex bytes (0x is empty); coerces to an integer where one is expected
hex"dead beef"  hex'01_02'         // spaces and underscores are ignored
date("2025-12-31T14:30:00")        // UTC Unix timestamp at compile time; the full form is required
500 sats  1 bitcoin  0.5 bitcoin   // satoshis = sats = 1, finney = 10, bits = 100, bitcoin = 1e8
7 days  2 hours                    // seconds, minutes, hours, days, weeks
1 ether  1 gwei  1 wei             // porting units, nominal 1e18 / 1e9 / 1 (evmCompat rejects finney)
```

SolidCash defines `finney` as 10 sats and `bits` as 100 sats.

### Operators

Tightest first. Solidity precedence: `&`, `^`, `|` bind tighter than comparisons (`x & y == z` is `(x & y) == z`).

```solidity
(x)  T(x)  new C(args)  new T[](n)          // grouping; cast (see Type Casting); creation
f(a, b)  f({b: 2, a: 1})                    // call; named arguments in any order
x[i]  x[a:b]  x[a:]  t[1]  x.member         // index, slice, tuple index (literal only), member
x++  x--   then   ++x  --x  -x  !x  ~x      // postfix, then prefix and unary
**   then   *  /  %   then   +  -           // ** is right-associative; + also concatenates string/bytes
<<  >>   then  &   then  ^   then  |
<  <=  >  >=   then   ==  !=   then   &&   then   ||   // && and || short-circuit
c ? a : b                                   // right-associative
=  +=  -=  *=  /=  %=  &=  |=  ^=  <<=  >>=  // statement level; chains like a = b = c
```

`type(T).max` is introspection, not a cast; `delete` is a statement, not an operator.

### Statements

```solidity
int x = 42;  int y;                           // the type is required (no var); y defaults to 0
x += 1; x++; --x; y = x = 5;                  // compound, increment, chained assignment
(int q, bool ok) = f(); (, bool only) = f();  // destructuring; an empty slot skips a value
(x, y) = (y, x);  { int scoped = 1; }         // swap; nested block scope
string h, string w = "Hello World".split(6);  // tuple declaration without parentheses
if (x > y) { x = y; } else if (x == y) { x = 0; } else { y = x; }
for (int i = 0; i < 10; i++) { if (i == 3) continue; if (i > 8) break; y += i; }
while (x > 0) { x -= 1; }  do { x += 1; } while (x < 3);
switch (x) { case 1: y = 10; case 2: y = 20; break; default: y = 0; }   // no fall-through
require(x > 0);  require(x > 0, "reason");  require(x > 0, Unauthorized(msg.sender));
assert(y >= 0);  revert Unauthorized(msg.sender);  revert("reason");  revert();
return (q, ok);  emit Moved(msg.sender, 5);   // also `return;` and `return v;`
delete x;  delete this.counter;  delete this.balances[key];
console.log("x:", x);                         // names and literals only
```

- Every spend path of a `public`/`external` function must reach a `require`, `assert`, `revert` or time check,
  or write state, else compilation fails (`enforceFinalRequire`, default on). `require` messages and
  `console.log` exist only in debug evaluation. Loops have no fixed limit; the operation cost budget bounds them.
- (native) A local or parameter may not reuse an enclosing name (evmCompat lets a parameter shadow a state
  variable or function). Unused variables only warn.

### Functions

```solidity
function spend(sig s) { require(checkSig(s, owner)); }             // no visibility = public
function deposit(int n) external { require(n > 0); }               // entry point only
function helper(int a) internal returns (int) { return a * 2; }    // also private; subroutine or inlined
function total() public view returns (int) { return this.counter; }
function stats(int a, int b) internal pure returns (int sum, int diff) { sum = a + b; diff = a - b; }
int r = helper({a: 21});                                           // named arguments; overloading works
constructor(int initial) { this.counter = initial; }               // deploy-time state initialiser
fallback(bytes input) external { require(input.length > 0); }      // or fallback() external; warned
receive() external payable { require(tx.outputs[0].value >= 546); }  // warned: discouraged on BCH
```

- `public` and `external` functions are entry points chosen by a 4-byte selector (sha256-derived natively,
  keccak256 under evmCompat). Calling an `external` function internally is an error. Entry arguments are
  untrusted; bounded types, enums and `bool` are range-checked on entry by default.
- `pure` reads no state or environment; `view` only reads; neither may write state, create or make low-level calls.
- Falling off the end returns the named values or type defaults. An entry point may declare returns, which a
  cross-contract caller receives through a return-event NFT.
- Internal calls are real subroutines (`OP_DEFINE`/`OP_INVOKE`), so recursion works. Function pointers:
  `function(int, int) internal returns (int) op = useAdd ? add : mul;` then `op(a, b)`. Internal pointers work,
  also in arrays and mappings; one external pointer works but a `function(..) external[]` array fails to lower.

### Modifiers

```solidity
modifier onlyOwner(sig s) { require(checkSig(s, owner)); _; }
modifier timelocked { require(this.age >= 100); _; }          // parameter list optional
modifier around() virtual { _; require(tx.time >= 1000); }    // code after _ runs after the body
modifier hook() virtual;                                      // abstract: no body, must be virtual
function withdraw(sig s) onlyOwner(s) timelocked { require(true); }   // applied left to right
function act(sig s) Base.onlyOwner(s) { require(true); }              // a named base's modifier
```

A modifier needs at least one `_`; each `_` inlines the body again. Modifiers are inlined at compile time (no call
frame), take `virtual`/`override` and also apply to constructors. Built-in keywords: `external public internal
private`, `pure view payable`, `virtual override override(A, B)`; lifecycle keywords are under Contract Lifecycle.

### Inheritance and Interfaces

```solidity
contract Ownable(pubkey owner) { modifier onlyOwner(sig s) { require(checkSig(s, owner)); _; } }
abstract contract Capped() { function cap() internal pure virtual returns (int); }   // no body: abstract
contract Token(pubkey owner) is Ownable(owner), Capped {
    int supply;
    function cap() internal pure override returns (int) { return 1000; }
    function mint(sig s, int n) onlyOwner(s) { require(this.supply + n <= cap()); this.supply += n; }
}
interface IToken is IBase {
    public uint256 totalSupply;                      // visibility FIRST inside an interface
    public mapping(address => uint256) balances;     // public or external state and collections
    event Transfer(address indexed from, address indexed to, uint256 amount);
    function transfer(address to, uint256 amount) external returns (bool);
}
```

- C3 linearization in Solidity order: bases most-base-like first, the rightmost wins. For `D is B, C` (both
  `is A`) the order is D, C, B, A: `super.f()` in D runs C's, whose `super.f()` runs B's; `B.f()` calls B's
  directly. `override` requires a `virtual` base. Under evmCompat a function from two bases needs
  `override(B, C)`; natively a bare `override` is enough.
- Abstract contracts cannot be deployed; evmCompat requires `virtual` on bodyless functions. Base parameters: pass
  `is Base(args)` or `constructor(..) Base(args)`, else (native) they become the child's parameters, merged by name.
- Interfaces may also declare enums, structs, value types, errors, `using` and a bodyless `fallback`; their state
  declarations are a SolidCash extension for external reads (`IToken(target).totalSupply`, see Cross-Contract
  Calls). A contract listing an interface in `is` must implement its functions (`override` optional).

### Libraries and using-for

```solidity
library SafeMath { function add(uint256 a, uint256 b) internal pure returns (uint256) { return a + b; } }
using SafeMath for uint256;              // x.add(y) is SafeMath.add(x, y): the receiver is the first argument
using { SafeMath.add } for uint256;      // attach chosen library or free functions
using SafeMath for *;                    // attach to every type
using SafeMath for uint256 global;       // also visible to importers (evmCompat: value types only)
type Amount is uint256;
function addAmt(Amount a, Amount b) pure returns (Amount) { return Amount.wrap(Amount.unwrap(a) + Amount.unwrap(b)); }
using { addAmt as + } for Amount global; // operator binding
```

- Library functions are inlined at each call (`SafeMath.add(a, b)` or via `using`); an unmarked one is
  `internal`. Libraries may also declare structs, enums, value types, events, errors, constants and modifiers,
  referenced as `Lib.Name`; `storage` parameters (`Data storage self`) alias the caller's state.
- Operators bind only on value types, from pure free functions, in a file-level `using {f as op} for T global;`
  (evmCompat requires exactly this). Comparisons return `bool`, others the value type; only `-` and `~` may be
  unary. Bindable: `+ - * / % ** == != < <= > >= & | ^ ~`.
- (experimental) A library whose `public`/`external` functions touch state it declares compiles to a deployed
  delegate library that runs against the caller's state; its calls return no value.

### Events and Errors

```solidity
event Transfer(address indexed from, address indexed to, uint256 amount);   // up to 3 indexed
event Note(string text) anonymous;                                          // shared address; up to 4 indexed
error InsufficientBalance(uint256 requested, uint256 available);
emit Transfer(from, to, amount);  emit Transfer({from: from, to: to, amount: amount});
revert InsufficientBalance(amount, balance);
revert InsufficientBalance({requested: amount, available: balance});
try IRisky(target).compute() returns (int r) { this.last = r; } catch { this.last = 0; }
```

- Declared at file, contract, library or interface level; events can be overloaded. Each reached `emit` creates
  an immutable NFT output in the contract's category carrying the encoded arguments, not an EVM log.
- Errors are ABI metadata only: a failed spend carries no revert data; the reason shows in preflight and debug.
- `try` runs its block, but a failed BCH script aborts the whole transaction, so `catch` (also `catch Error(string
  memory r)` and `catch (bytes memory d)`) never runs (warned). evmCompat requires an external call or `new`.

### Inline Assembly and Yul

```solidity
assembly {                               // Yul: a block with let, :=, if, switch, for or function
    let t := add(a, 1)
    if gt(t, 10) { t := sub(t, 1) }
    r := t                               // high-level locals and parameters are readable and writable
}
assembly { OP_1 OP_DROP }                // native BCH Script: only OP_ codes and hex pushes
```

- Yul subset: `let`, `:=`, `if`, `switch`, `for`, `break`, `continue`, blocks and local functions (inlined: no
  recursion; `leave` only unconditionally at the top level). Builtins: arithmetic, bitwise (incl. `byte`,
  `signextend`, `clz`), comparison, `pop`, memory (`mload mstore mstore8 mcopy msize keccak256 return revert`),
  `stop`, `invalid`, `sload`/`sstore` (virtual slots over state, `.slot`/`.offset`, `erc7201`), `tload`/`tstore`
  (per-spend local), context (`caller callvalue origin address balance selfbalance chainid number timestamp
  coinbase difficulty prevrandao blockhash blobhash`, gas values are fixed shims), code/calldata/returndata
  copies, `log0..log4` (event NFTs) and `call staticcall delegatecall` (low-level calls). Rejected with a named
  diagnostic: `create create2 verbatim_* pc datasize dataoffset datacopy linkersymbol callcode selfdestruct`.
- Memory is little-endian: `mstore8(p, v)` then `mload(p)` gives `v & 0xff`, not `v << 248`; re-derive packed
  offsets when porting. A signed variable enters as sign-magnitude (`sar`, `signextend`, `shl` fail closed on a
  negative one). `exp` loops once per exponent bit.
- Native blocks: stack effects are tracked, types are not; untrackable opcodes are rejected and every block warns.
  See https://solidcash.org/docs/language/assembly

### Stateful Contracts

A contract is stateful when it declares state variables (mappings and arrays included), emits events or calls
`blockhash` (or with compiler option `forceStateful: true`). State lives in 128-byte CashToken NFT commitments
under a minting master NFT; each change spends those UTXOs and the covenant checks the recreated outputs. Stateful
contracts use `p2sh32`; the SDK derives all state inputs and outputs. See
https://solidcash.org/docs/language/stateful-contracts and https://solidcash.org/docs/language/storage-model

```solidity
contract Counter(pubkey admin) {
    int public counter;           // field in a data NFT
    string label;                 // length in a data NFT, bytes in 120-byte chunk NFTs
    int constant MAX = 100;       // compiled into the bytecode, no state
    bytes20 immutable deployer;   // assigned once in the constructor, still stored in a data NFT
    bool transient locked;        // per-spend local, zeroed on every call (warned)
    constructor() { this.deployer = hash160(admin); }
    function increment(sig s) { require(checkSig(s, admin)); this.counter += 1; }
}
```

- `this.x` reads and writes state; a bare `x` works unless a local shadows it. `delete this.x;` resets it. A state
  variable named like a built-in (`balance`, `category`, `tokens`, `categoryId`) hides that built-in.
- A constructor may write mappings; token containers cannot be used in a constructor.
- EVM storage bridge: assembly `sload`/`sstore`, `.slot`/`.offset`, OpenZeppelin `StorageSlot` and `erc7201(...)`
  resolve at compile time onto these NFTs (an arbitrary slot uses a hidden `mapping(uint256 => uint256)`); it is
  not an EVM storage emulator. See https://solidcash.org/docs/language/evm-storage-compat

### Mappings and Arrays

Every mapping is a verified mapping (vmap): one mutable entry NFT per key in an authenticated sorted list. A read
proves the stored value or the key's absence (then it returns the type default), so a transaction builder cannot
hide an entry. The SDK finds and co-spends the witnesses. See https://solidcash.org/docs/language/verified-mappings

```solidity
mapping(bytes20 => int) public balances;
mapping(address owner => mapping(address spender => uint256 amount)) allowances;  // named keys, nested
mapping(bytes20 => User) public users;               // struct values; large values chunk
enumerable mapping(bytes20 => int) public holders;   // required for iteration
this.balances[k] = v;   this.balances[k] += v;       // authenticated upsert / read-modify-write
delete this.balances[k];                             // writes the default value
this.users[k].name = newName;                        // partial struct update
User storage u = this.users[k];                      // storage alias of the entry
for (int v of this.holders) { }                      // values
for (bytes20 k in this.holders) { }                  // keys
for (bytes20 k, int v of this.holders.entries) { }   // key/value pairs
```

- Iterating a plain (non-`enumerable`) mapping is a compile error. A loop co-spends every entry NFT and proves the
  list complete, so cost grows with the entry count; do not iterate a mapping an attacker can grow. Shapes the
  compiler cannot prove (for example writes to several mappings in one runtime loop) fail to compile.
- Keys are not on chain: before a key or entry loop, pass encoded keys through the SDK
  (`sc.setIterationKeys('holders', [key1, key2])`). Key and entry loops support single-key mappings only.

```solidity
string[] public items;              // unbounded T[]: dense chunk-packed array (default)
bytes20[] packed public committee;  // packed: one data-NFT field, fixed-width elements, fits 128 bytes
uint32[4] packed public weights;    // bounded packed array
uint256[1000] slots;                // non-packed T[N]: sparse entry-NFT collection, no length/push/pop
this.items.push(x);  this.items.push();  this.items.pop();  this.items[i] = x;
uint256 n = this.items.length;  this.items.delete(i);   // delete(i): swap-with-last, order not kept
for (string s of this.items) { }
```

Dense arrays are rebuilt whole on each access (O(n), must fit the 10,000-byte stack-item limit). Under
`evmCompat` a bounded `T[N]` is one packed field. See https://solidcash.org/docs/language/arrays

### Tokens and Satoshis

A stateful contract holds BCH in its satoshi container and CashTokens in one token container per held category;
both are covenant UTXOs bound to the contract's category. See https://solidcash.org/docs/language/token-containers

```solidity
this.tokens[cat].tokenAmount           -- bigint: fungible amount in the container inputs
this.tokens[cat].nftCount              -- bigint: NFTs in the container inputs
this.tokens[cat].tokenCategory         -- bytes: raw category of the routed input (+ capability byte)
this.tokens[cat].nftCommitment         -- bytes
this.outState.tokens[cat].tokenAmount  -- bigint: after the call (also .nftCount)
this.tokens[cat].transfer(lockingBytecode, amount);                     // send fungible tokens
this.tokens[cat].transferNft(lockingBytecode, commitment, capability);  // 0 immutable, 1 mutable, 2 minting
```

- `cat` is a display-order `bytes32` category: a direct function parameter, or a local set from `this.category`.
- An ordinary call cannot fully drain a fungible-only container, send the only NFT of an NFT-only container, or
  give up a minting NFT. To deposit, add the token input in the SDK and call `.tokenContainerDeposit(cat, amount)`.

```solidity
this.transfer(lockingBytecode, amount);      // pay sats from the satoshi container
payable(to).transfer(amount);                // same payment
bool ok = payable(to).send(amount);          // same; always true (a missing output fails the tx)
(bool sent, ) = to.call{value: amount}("");  // same; sent is always true
require(this.balance >= amount);             // satoshi-container inputs of this tx
require(this.outState.balance >= floor);     // satoshi-container outputs of this tx
```

- `this.balance` is the contract's own BCH (fund it at deploy with SDK `initialBalance`). `addr.balance` sums this
  transaction's inputs locked to `addr`, not a chain-wide balance; prefer `this.balance` to `address(this).balance`.

### Global Variables

```solidity
this.activeInputIndex                 -- bigint: index of the input being evaluated
this.activeBytecode                   -- bytes: bytecode of the contract being evaluated
this.categoryId                       -- bytes: raw category of the active input (consensus order, + capability)
this.category                         -- bytes32: own category in display order (stateful)
address(this)                         -- address: the active input's locking bytecode
tx.version, tx.locktime, tx.inputs.length, tx.outputs.length   -- bigint
tx.inputs[i].value / .outpointIndex / .sequenceNumber / .tokenAmount   -- bigint
tx.inputs[i].lockingBytecode / .unlockingBytecode / .nftCommitment     -- bytes
tx.inputs[i].outpointTransactionHash  -- bytes32
tx.inputs[i].tokenCategory            -- bytes: 0x if none; 32 raw bytes + 0x01 mutable / 0x02 minting
tx.outputs[i].value / .lockingBytecode / .tokenCategory / .nftCommitment / .tokenAmount
```

Raw `tokenCategory` and `this.categoryId` use consensus byte order: split off the capability byte and reverse the
32 bytes before comparing with a display-order ID, or use `this.category`. `tokenAmount` is at most 64-bit.

```solidity
msg.sender    -- address: lock of the calling contract (its co-spent master NFT is checked), else tx.origin
msg.value     -- bigint: net change of this contract's satoshi container (outputs minus inputs)
msg.sig       -- bytes4: selector of the current public/external function (compile-time constant)
msg.data      -- bytes: this input's unlocking bytecode without the redeem script
tx.origin     -- address: locking bytecode of the first P2PKH input that holds no tokens
tx.gasprice   -- uint32: this transaction's fee rate in sat/kB
```

- `msg.data` exists on the normal entry path. It is unavailable inside an internal subroutine
  (`MsgDataInSubroutineError`) and in a single-entry framed master (`FRAMED_CODEGEN_UNAVAILABLE`).
- The compiler warns on every read of `msg.sender` and `tx.origin`. Both derive from the co-spent inputs, which the
  transaction builder picks, so authorize with `checkSig`, `checkMultiSig` or `checkDataSig`, not `msg.sender` alone.
- `msg.value` is not readable in `view` public/external functions or a non-payable constructor; `pure` functions
  cannot read `msg.sender`, `msg.value`, `tx.origin`, `tx.gasprice` or `block.*`. `evmCompat` types `msg.value`
  and `.length` as `uint256`.

```solidity
block.number, block.timestamp  -- uint32: height / time last written to the block-info oracle (they lag)
block.difficulty               -- uint32: raw nBits, not randomness
block.coinbase                 -- address: locking bytecode of coinbase output 0
block.size, block.totalFees    -- uint32: block bytes / block fees in sats (BCH extensions)
block.basefee                  -- uint32: 1000 * totalFees / size in sat/kB; block.blobbasefee aliases it
block.chainid                  -- uint256: chainId option & 0xff (mainnet 0, chipnet 1, testnet4 2, regtest 255)
block.prevrandao               -- uint256: abs(int(sha256(input 0 outpoint txid))), set by the tx builder
block.gaslimit, gasleft()      -- always 1000000
bytes32 blockhash(int n)       -- from a per-height oracle NFT of the contract's own category
bytes32 blobhash(int i)        -- always zero
```

- `block.number` and `block.timestamp` warn that they lag the oracle. `blobbasefee`, `prevrandao`, `gaslimit` and
  `gasleft()` are compiler-warned shims; none of these values is randomness. For deadlines prefer `tx.time` /
  `this.age`, which need no oracle. For randomness use commit-reveal or a `checkDataSig` oracle.
- Oracle fields co-spend one shared block-info oracle UTXO read-only (only its owner updates it); the SDK adds the
  input. A live provider needs `blockOracleCategory`; `MockNetworkProvider` has its own oracle. `blockhash(n)`
  makes the contract stateful and is called through `StatefulContract`; a missing `(n, hash)` NFT is an error,
  not zero. See https://solidcash.org/docs/guides/block-oracles

### Time Locks

```solidity
require(tx.time >= deadline);             // absolute: OP_CHECKLOCKTIMEVERIFY on nLocktime
require(this.age >= delay, "too early");  // relative: OP_CHECKSEQUENCEVERIFY on this input's nSequence
```

- Only valid as the left side of `>=` in `require`; read raw values with `tx.locktime` and
  `tx.inputs[i].sequenceNumber`. `tx.time` below 500,000,000 is a block height, above it a Unix time; `this.age`
  counts blocks, or 512-second units for a time-based sequence.
- The spending transaction must carry a matching lock: SDK `setLocktime(n)` on the `TransactionBuilder`, and
  `addInput(utxo, unlocker, { sequence })` with a BIP68 value (time-based: `(1 << 22) | units`).

### Locking Bytecode

```solidity
new LockingBytecodeP2PKH(bytes20 pkh)          -- bytes25
new LockingBytecodeP2SH20(bytes20 scriptHash)  -- bytes23: hash160 of the script; prefer P2SH32
new LockingBytecodeP2SH32(bytes32 scriptHash)  -- bytes35: hash256 of the script
new LockingBytecodeNullData(bytes[] chunks)    -- bytes: OP_RETURN output, each chunk at most 255 bytes
require(tx.outputs[0].lockingBytecode == new LockingBytecodeP2PKH(pkh));
require(tx.outputs[1].lockingBytecode == new LockingBytecodeNullData([0x6d02, bytes("memo")]));
address payee = new LockingBytecodeP2SH32(scriptHash);   // P2PKH/P2SH results assign to address
```

### Built-in Functions

`bigint` parameters accept any integer type; `abs`, `min` and `max` keep a bounded argument type.

```solidity
bigint abs(bigint a)   bigint min(bigint a, bigint b)   bigint max(bigint a, bigint b)
bool within(bigint x, bigint lower, bigint upper)  -- lower <= x < upper
bigint addmod(bigint x, bigint y, bigint k)        -- (x + y) % k, no intermediate overflow
bigint mulmod(bigint x, bigint y, bigint k)        -- (x * y) % k, no intermediate overflow
bytes toPaddedBytes(bigint value, bigint length)   -- OP_NUM2BIN; bytesN when length is a literal
string intToString(bigint value)                   -- decimal text
bigint stringToInt(string value)                   -- parses decimal text
uint256 erc7201(string namespaceId)                -- ERC-7201 namespaced storage slot
```

### Cryptography

```solidity
bytes20 ripemd160(any x)   bytes20 sha1(any x)   bytes32 sha256(any x)   -- one opcode each
bytes20 hash160(any x)     bytes32 hash256(any x)   -- ripemd160(sha256(x)), sha256(sha256(x))
bytes32 keccak256(bytes x) -- real Keccak-256 (Ethereum-identical) via a co-spent side-car
bool checkSig(sig s, pubkey pk)
bool checkMultiSig(sig[] sigs, pubkey[] pks)         -- ECDSA signatures
bool checkDataSig(datasig s, bytes msg, pubkey pk)   -- signature over sha256(msg), not msg
pubkey ecrecoverPubKey(bytes32 hash, int v, bytes32 r, bytes32 s)
address ecrecoverP2pkh(bytes32 hash, int v, bytes32 r, bytes32 s)   -- signer's BCH P2PKH lock
bytes20 ecrecoverEvm(bytes32 hash, int v, bytes32 r, bytes32 s)     -- signer's Ethereum address
require(checkMultiSig([s1, s2], [pk1, pk2, pk3]));
bytes32 role = keccak256("MINTER_ROLE");    // literal argument: folded at compile time
require(ecrecoverEvm(digest, v, r, s) == signer);
```

- Hash an address through `bytes(...)`: `hash160(bytes(msg.sender))`. NULLFAIL: a non-empty invalid signature
  aborts the script; pass `0x` to make a check return `false`.
- `keccak256` and `ecrecover*` run in co-spent compute side-cars (recovery takes two inputs per call;
  `ecrecoverEvm` adds a keccak side-car). The SDK co-spends them; a real network needs them provisioned, one per
  call site. Prefer `checkDataSig` when the key is known. See https://solidcash.org/docs/language/cryptography
  and https://solidcash.org/docs/language/computation-sidecars
- Bare Solidity `ecrecover(hash, v, r, s)` exists only with compiler option `ecrecover: 'p2pkh'` or `'evm'`.

### ABI Encoding

```solidity
bytes data = abi.encode(uint256(42), true, hex"cafe");
bytes packed = abi.encodePacked(x, tag, flag);
bytes c1 = abi.encodeWithSelector(sel, to, amount);                          // sel is a bytes4
bytes c2 = abi.encodeWithSignature("transfer(address,uint256)", to, amount);
bytes c3 = abi.encodeCall(IToken.transfer, (to, amount));                    // arity and types checked
(uint256 n, bool ok, bytes b) = abi.decode(data, (uint256, bool, bytes));
bytes4 label = abi.decodeAt(data, (int, bytes4, bool), 1);                   // literal schema index
```

- Native format (default): minimal little-endian pushdata framing and sha256 selectors (also for `msg.sig`,
  dispatch and `interfaceId`), not Ethereum ABI. `evmCompat: true` (required by `pragma solidity`, set in new SolidHat
  projects) emits 32-byte big-endian words, head/tail encoding and keccak256 selectors. `abi.decodeAt` is for the
  native format only.
- `encodePacked` is ambiguous for adjacent dynamic values; do not hash it for authorization. A native `address`
  is a full locking bytecode; carry an Ethereum address as `uint160` for EVM-identical bytes. See
  https://solidcash.org/docs/language/abi-encoding

### String and Bytes Members

```solidity
uint256 n = b.length;                    // byte length (UTF-8 bytes for a string)
bytes1 first = b[0];                     // one byte, bounds-checked
bytes left, bytes right = b.split(4);    // (b[0:4], b[4:]); b.split(4)[0] takes one part
bytes mid = b.slice(1, 3);               // end index exclusive
bytes h = b[0:4];                        // index-range slices: b[i:j], b[i:], b[:j]
bytes r = b.reverse();
bytes j = a + b;                         // + concatenates bytes and strings
string g = string.concat("x", s, "y");
bytes k = bytes.concat(b4, s, b);
```

An out-of-range index, `split` or `slice` fails the script.

### Type Introspection

```solidity
type(int8).min, type(uint256).max    -- bounds, typed as that integer type
type(fixed128x18).min / .max
type(Color).min / .max               -- first and last enum value
type(IToken).interfaceId             -- bytes4: XOR of the interface's own selectors (ERC-165)
type(MyContract).name                -- string (also for interfaces and libraries)
type(MyContract).creationCode        -- bytes: redeem script without constructor arguments; .runtimeCode is equal
```

BCH prepends constructor arguments to the redeem script, so CREATE2-style address math over `creationCode` does
not match `new MyContract(args)` (warned).

### Type Casting

```solidity
int(b)  uint64(x)  bigint(x)  bool(x)       // integers and bool
bytes(n)  bytes32(n)  bytes1(b2)            // bytesN(int) pads; narrowing bytesN keeps the leftmost bytes
string(b)  bytes(s)                         // string <-> bytes, no conversion code
pubkey(b)  sig(b)  datasig(b)               // these also convert implicitly to bytes
address(lockingBytecode)  payable(addr)     // payable(...) enables transfer/send
bytes20(addr)  uint160(addr)                // P2PKH hash at offset 3; lossy, warned
unsafe_int(b)  unsafe_bool(n)  unsafe_bytes20(b)   // reinterpret: no conversion opcodes, no length check
```

- Native: an integer cast that loses value or flips sign fails the script, and `bytesN(int)` / `int(bytesN)` use
  little-endian VM numbers. Under `evmCompat`, narrowing truncates, same-width int/uint reinterprets two's
  complement, and bytesN conversions are big-endian, as on the EVM.
- `bigint` values (introspection fields, `.length`, built-in results) assign implicitly to `int`/`uintN`
  (range-checked on write). Integer to fixed-point multiplies by `10^N`; fixed-point to integer truncates.

### Contract Lifecycle

A stateful contract (state variables, mappings, arrays or events) is a CashToken category: a minting master NFT
plus data NFTs holding its state. Creating, upgrading and destroying it mints, re-mints and burns those UTXOs.
Lifecycle functions must be externally callable. Docs: https://solidcash.org/docs/language/contract-creation

```solidity
contract Child(pubkey owner) { int counter; function bump() public { this.counter += 1; } }
contract Factory(pubkey admin) {
    int created;
    function create(sig s) public {            // deploy entry: inferred from `new`, writing `deploy` is optional
        require(checkSig(s, admin));
        new Child(admin);                      // mints the child's genesis: a new category
        this.created += 1;
    }
}
```

```solidity
Child c = new Child(admin);                    // keep a typed handle
new Child{salt: salt}(admin);                  // deterministic address (CREATE2 analogue)
new Child{value: amount}(admin);               // fund the child with satoshis
c.initialize(amount, owner);                   // straight-line initializer right after `new`: folded into genesis
bytes code = type(Child).creationCode;         // redeem script (runtimeCode alias); EVM CREATE2 math does not apply
```

- `deploy`, `upgrade`, `split` and `merge` entries need an unconditional `require(checkSig(s, key))` with a key the
  caller cannot choose (constructor argument, state or constant); a direct compile rejects one without it
  (`UnauthorizedLifecycleError`).
- `new` of a stateful child works only in a stateful contract's function. The child is an output, so the same
  transaction cannot call it beyond a folded initializer (`DeployThenCallError`), and a `require` inside that
  initializer does not run. Deploy sites in branches or loops must create the same child (`ConditionalDeployError`).
- SDK: `await factory.call.create(sig)` deploys with the connected signer; `.deploy({ fundingUtxo, funder,
  changeAddress })` funds it explicitly (the vout-0 funding UTXO becomes the child's category); `.send()` takes the
  non-deploying path. `StatefulContract.deployFrom({...})` is the static form.

```solidity
function destroy(sig s) public { require(checkSig(s, admin)); selfdestruct(beneficiary); }   // pins the payout
function sweep(sig s) selfdestruct { require(checkSig(s, admin)); }    // modifier form: burns state, no recipient pin
```

- `selfdestruct(to)` requires one output, paid to `to`, with a fee below 2,000 satoshis, as a direct statement of the
  body; a caller-chosen `to` needs a signature by a key the caller cannot choose. Bare `selfdestruct;` is a no-op.
  CashTokens are not moved (transfer them out first); event NFTs younger than 144 blocks stay behind.
- Run it with `StatefulContract.selfdestructTo({ provider, contract, destroyFunctionName, destroyFunctionArgs,
  recipient })`, an alias of `StatefulContract.destroy`; a plain `sc.call.destroy(...)` is refused.
  Docs: https://solidcash.org/docs/language/selfdestruct

```solidity
function gate(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }   // unsafe = unsafe(0): no covenant checks
function keep(sig s) unsafe(1) { require(checkSig(s, admin)); }        // keeps master NFT + minting uniqueness
function hold(sig s) unsafe(2) { require(checkSig(s, admin)); }        // tier 1 + no value decrease
```

- Tier 0 lets anyone who passes the guards steal, duplicate or burn the master and rewrite state. `unsafe(1)` and
  `unsafe(2)` bodies cannot write state, touch entries, emit events, move value, use token containers, call or read
  other contracts, or deploy. Every tier warns; none combines with `pure`, `view` or a lifecycle modifier.

### Upgrades and Proxies

A native `upgrade` keeps the category id and moves the master NFT to new bytecode, so the address changes. A proxy
keeps its address and state NFTs while a co-spent implementation authorizes each state change.
Docs: https://solidcash.org/docs/language/upgrades-proxies

```solidity
contract LedgerV1(pubkey admin) {
    mapping(bytes20 => int) public balances;
    function set(sig s, bytes20 k, int v) { require(checkSig(s, admin)); this.balances[k] = v; }
    function migrateEntry(sig s) migrateRecords { require(checkSig(s, admin)); }   // only if entries exist
    function migrate(sig s) upgrade { require(checkSig(s, admin)); }               // authorizes the move only
}
```

- A hidden witness binds the replacement bytecode the SDK chose; its constructor body does not run. Data-NFT state
  is re-minted unchanged, so keep the new layout an extension of the old (new fields start at defaults). Satoshi and
  token containers move with the master; mapping entries move one per transaction through `migrateRecords`. Values
  kept in chunk NFTs do not migrate yet; the SDK refuses an upgrade that would strand one.
- Run it with `StatefulContract.upgrade({ provider, oldContract, upgradeFunctionName, upgradeFunctionArgs,
  newArtifact, newConstructorArgs, fundingUtxo, funder, changeAddress, migrateRecordsFunctionArgs })`.
- Proxy implementations are ordinary contracts (`contract Impl() { int public counter; function increment() public
  { this.counter += 1; } }`). For each externally callable function that writes state, emits an event or makes a
  low-level call, the compiler publishes a proxy-context build as `artifact.delegateArtifact` (SDK:
  `contract.asDelegate()`), where `this.x` is the co-spent proxy's state; it is a separate script with its own
  address. Left out: `view`, `pure`, `internal`, `private`, `unsafe` and lifecycle functions, functions that
  delegatecall, and functions (helpers included) that move satoshis or use token containers. Proxy and
  implementation must declare the same state fields with the same names, types and positions.
- Stable profile: `upgrades.deployProxy(getContractFactory(implArtifact, signer), { counter: 5n })` from
  `solidcash/stateful`, then `proxy.increment().send()`. Its proxy bakes in the implementation's lock: no mutable
  implementation pointer (`upgrades.upgradeProxy` refuses it). Updating a mapping entry works, inserting a key is
  rejected. An `initialize` function is auto-detected and run through the proxy; `{ initializer: false }` seeds
  state at genesis instead.

Custom proxies and manual `delegatecall` (experimental):

```solidity
contract Forwarder(pubkey admin) {
    int counter;                                   // same layout as the implementation
    function forward(bytes input, address impl, sig s) external {
        require(checkSig(s, admin)); impl.delegatecall(input); require(input.length > 0);
    }
}
```

- The target must be bound to a constructor argument, state or constant, or chosen under a signature by such a key
  (`UntrustedDelegatecallTargetError`). A forwarder cannot write its own state or delegatecall in a loop. Deploy it
  with `upgrades.deployProxy(factory, state, { proxy: forwarderArtifact, auth: () => [adminSig] })`;
  `upgrades.upgradeProxy(proxy, newFactory)` re-targets only this parameter-mode shape.
- The delegate must sit one forwarder block after the forwarding input, because the delegate derives the proxy
  master it authorizes as `itsInputIndex - (1 + dataNftCount)`. A forwarder that lays its delegate at a fixed
  distance publishes it as a `bigint __proxyBlockSize` constructor input; the forward then also requires
  `delegateIndex == this.activeInputIndex + __proxyBlockSize`. The built-in proxy does this. Without the input the
  forwarder keeps the identity-and-payload pin only, so place the delegate adjacent yourself.
- A message-bus route call through a forwarder lays the delegate after the implementation's route block instead
  (`messageBus.route.blockLayout.blockSize` in its artifact). Publish that distance beside the first as a
  `bigint __proxyRouteBlockSize` constructor input: the forward then requires the route distance when the forwarded
  selector is the route selector `0x53434231` and `__proxyBlockSize` for any other selector, and it requires the
  delegate's first push to be that exact four-byte selector. The built-in proxy publishes both and `deployProxy`
  fills them in. A forwarder with only `__proxyBlockSize` uses that one distance for every call.
- Deployed libraries (`L.f(...)` on a library function touching library state) use the same delegate co-spend
  (experimental). Not supported in 0.14.0-beta.1: fallback-only transparent proxies, value or token movement in
  delegate mode.

### Cross-Contract Calls

A call is a co-spend: caller and callee are inputs of one atomic transaction, each running its own covenant. There
is no call stack or re-entrancy, and a failing callee invalidates the transaction (`try`/`catch` compiles, but catch
bodies are dead code). Docs: https://solidcash.org/docs/language/cross-contract-calls

```solidity
interface ICounter {
    public uint256 count;                           // readable state: visibility comes first
    public mapping(address => uint256) balances;
    function add(uint256 amount) external returns (uint256);
    function ping() external;
    function deposit() external payable;
}
```

```solidity
uint256 c = ICounter(counter).count;                  // callee state as spent in this tx
uint256 b = ICounter(counter).balances[who];          // mapping read, with membership proof
uint256 n = ICounter(counter).outState.count;         // callee state after this tx (its replacement output)
uint256 r = ICounter(counter).add(5);                 // typed call (mutating the callee: experimental)
ICounter(counter).add.call(5);                        // explicit stateful mode, return not consumed
ICounter(counter).ping.staticcall();                  // read-only: callee state must be preserved
ICounter(counter).deposit{value: amount}();           // plus an authenticated BCH output to the callee
(bool ok, bytes memory data) = target.call(payload);  // low-level: opaque bytes; ok is always true
target.staticcall(payload);                           // low-level read-only; delegatecall: see proxies
```

- Target identity: `counter` is an `address`, the callee master's locking bytecode. The caller checks that the
  co-spent master has exactly that lock, and the callee's covenant bakes in its category, so one address names one
  instance; a 32-byte category id is not a call target. Targets come from a constructor or function parameter,
  state or a literal (`UnpinnedExternalCallTargetError`). Interface-typed handles work (`contract C(IERC20 token)`).
- SDK: connect instances by category, `StatefulContract.withCategory(inner, categoryId, { externals: { ICounter:
  counterSc } })`, or per call with `.withExternalCall(counterSc)`. The SDK finds inputs; the covenants enforce
  target, selector and arguments.
- A stateful callee returns values in a return-event NFT output, the record of the call it answers (a digest of the
  selector and arguments, then the result, or its hash past 96 bytes); the caller reads only its own call's record.
  Read off chain with `sc.call.f(args).staticCall()`.
- Low-level calls bind the target and an opaque return, not the payload against the callee's invocation; prefer a
  typed interface when dispatch identity matters. Void typed calls over an address array work in loops.
- `msg.sender` in a callee is the calling contract's address, or `tx.origin` (the first non-token P2PKH input) when
  no contract calls it. It is derived from the transaction's inputs, not a call frame: authorize with `checkSig`.

### Composition and the Message Bus

- Direct composition is the default: each contract in the call graph is one co-spent input. When one transaction
  must invoke the same contract twice, or calls form a cycle (`A -> B -> A`), the compiler infers a message-bus
  route (experimental): every participant verifies one shared call manifest and settles its state once, and a bus
  row's `msg.sender` is the caller recorded in that manifest.
- `messageBus: false` compiles direct-only and fails with `MESSAGE_BUS_REQUIRED` when the source needs a bus. The
  default convention is the kernel row loop (`artifact.messageBus.convention === 'kernel-row-loop'`);
  `messageBusKernel: false` (legacy unroll) is for compatibility tests only.
- Compose only when `artifact.messageBus.available` is true and each selected `artifact.messageBus.handlers` entry is
  `eligible`, and check `artifact.messageBus.deployability` (`assertDeployabilityCertificate` from
  `@solidcash/utils`) before broadcasting: a compiled route can exceed the 10,000-byte limit. Handlers using `split`,
  `merge`, `selfdestruct`, `unsafe(0|1)` or a foreign `delegatecall` get a `KERNEL_*` refusal and stay direct-only.
  Docs: https://solidcash.org/docs/guides/message-bus

```ts
await messageBus.compose({ calls: [caller.call.prepare(1n), callee.call.settle(1n)],   // from 'solidcash/message-bus'
  funder: feeUtxo, changeAddress }).send();          // calls in depth-first order; the fee input's lock is tx.origin
await counter.batch([{ function: 'add', args: [1n] }, { function: 'add', args: [2n] }]).send();   // one contract
```

### Concurrency: Split, Merge and Threads

One master UTXO serializes every call to a stateful contract. Threads are extra master minting NFTs of the same
category; each owns a disjoint set of data NFTs and serves only functions whose ABI `requiredNftIndices` fall in that
set. A state variable declared `external` gets its own data NFT, the unit threads partition.
Docs: https://solidcash.org/docs/guides/concurrency, https://solidcash.org/docs/sdk/threading

```solidity
contract Sharded(pubkey admin) {
    external int west;                             // own data NFT
    external int east;
    function incWest() public { this.west = this.west + 1; }
    function incEast() public { this.east = this.east + 1; }
    function fork(int n, sig s) split(n) { require(n >= 1); require(checkSig(s, admin)); }  // mints n new masters
    function join(int n, sig s) merge(n) { require(n >= 1); require(checkSig(s, admin)); }  // burns n masters
}
```

- The modifier argument names an integer parameter. `split` keeps the running master and mints `n` more; `merge`
  burns `n` co-spent masters into the running one. Both follow the `unsafe(1)` body restrictions, need a trusted-key
  `checkSig`, and combine with no other lifecycle modifier, `unsafe`, `pure`, `view`, `internal` or `private`.
- Threads do not partition mapping entries, chunks, satoshi or token containers, external contract inputs, a bus
  verifier or shared funding coins: calls sharing any of these still conflict.

```ts
const threads = await new ThreadManager(sc).discover();     // 'solidcash/stateful'; deploy with { threadCount: 2 }
await threads[1].call('incEast').send();                    // refused unless this thread owns east's data NFT
await sc.call.fork(1n, adminSig).withSplitFunding([utxo], signer.unlockP2PKH(), changeAddress).send();
await sc.call.join(1n, adminSig).withConsumedMasters([threads[1].masterUtxo], changeAddress)
  .withMergeFunding([feeUtxo], signer.unlockP2PKH()).send();
```

## SDK

```ts
import { Contract, TransactionBuilder, SignatureTemplate, Signer, Network, randomUtxo } from 'solidcash';
import { MockNetworkProvider } from 'solidcash/network/mock';         // not exported from the root
import { ElectrumNetworkProvider } from 'solidcash/network/electrum'; // not exported from the root
import { StatefulContract, ContractFactory, upgrades } from 'solidcash/stateful';
// Also: solidcash/{hdsigner,contract-factory,message-bus,oracle,bcmr,walletconnect}
```

### Non-stateful contracts

```ts
// contract P2PKH(bytes20 pkh) { function spend(pubkey pk, sig s) { ... checkSig(s, pk) ... } }
const provider = new MockNetworkProvider();            // or new ElectrumNetworkProvider('chipnet')
const alice = new SignatureTemplate(alicePrivateKey);  // WIF, hex or 32 bytes
const contract = new Contract(artifact, [alicePkh], { provider }); // addressType defaults to 'p2sh32'
await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100_000n })); // mock-only fixture
const [utxo] = await contract.getUtxos();
const details = await new TransactionBuilder({ provider })
  .addInput(utxo, contract.unlock.spend(alice.publicKey, alice))
  .addOutput({ to: recipientAddress, amount: 90_000n }) // fee = inputs - outputs
  .send();                                              // evaluates locally, then broadcasts
```

Builder: `addInput(utxo, unlocker, { sequence })`, `addInputs`, `alice.unlockP2PKH()` for a wallet input,
`addOutput({ to, amount, token })`, `addOpReturnOutput(chunks)`, `addBchChangeOutputIfNeeded({ to, feeRate })`,
`addTokenChangeOutputIfNeeded({ category, to })`, `setLocktime(n)` (for `tx.time`), `build()` (hex), `send()`
(`{ txid, hex, wait() }`). Options: `maximumFeeSatoshis`, `maximumFeeSatsPerByte`, `allowImplicitNftBurn`.

### Stateful contracts

```ts
const [owner] = await provider.getSigners(1);                // mock only: funded HDSigners
const sig = new SignatureTemplate(owner.privateKey);          // `sig` arguments stay explicit
const factory = new ContractFactory(counterArtifact, owner);  // a Signer runner funds and signs
const counter = await factory.deploy(owner.publicKey, { initialState: { count: 0n } }); // last object = options
await counter.waitForDeployment();                            // also categoryId, deploymentTransaction().txid
await counter.increment(sig);                                 // awaiting a call builds, funds and sends it
const receipt = await counter.call.increment(sig).send();     // explicit form; receipt.events is decoded
const builder = await counter.call.increment(sig).build();    // TransactionBuilder, e.g. for debug()
const total = await counter.call.total().staticCall();        // view return value, nothing sent
const count = await counter.state.count();                    // getState(): all; getEntries('map'): entries
const logs = await counter.queryFilter('Incremented');        // [{ eventName, args, txid, vout }]; also on/off
const sc = await StatefulContract.at(addressOrCategoryId, artifact, signerOrProvider, { constructorArgs });
const sc2 = StatefulContract.withCategory(new Contract(artifact, ctorArgs, { provider }), categoryId);
const asBob = sc.connect(bob);                                // also attach(categoryId), withProvider(provider)
```

Generated bindings also expose direct public-state getters such as `await counter.count()`; the base SDK form is
`await counter.state.count()`.

A provider runner reads; a Signer runner also funds and signs. Always pass `constructorArgs` when the SDK may spend
the contract: a P2SH address does not reveal its redeem script. Lower-level lifecycle builders:

```ts
await StatefulContract.deploy(artifact, ctorArgs, { provider, fundingUtxo, funder, changeAddress, initialState });
await StatefulContract.upgrade({ provider, oldContract, upgradeFunctionName, upgradeFunctionArgs,
  newArtifact, newConstructorArgs });                // -> { contract, tx, categoryId, leftBehind }
await StatefulContract.deployFrom({ provider, factory, deployFunctionName, deployFunctionArgs,
  childArtifact, fundingUtxo, funder, changeAddress }); // -> { factory, child, tx, childCategoryId }
await StatefulContract.destroy({ provider, contract, destroyFunctionName, destroyFunctionArgs, recipient });
await StatefulContract.split({ ... });  await StatefulContract.merge({ ... });
```

- `deploy` returns `{ contract, tx, categoryId }`; `fundingUtxo` must be a plain `vout: 0` output (its txid
  becomes the CashToken category). `destroy` returns `{ txs, totalReclaimed, leftBehind }`.
- Child deploys: `await factory.call.createChild(args).deploy(options)` after `factory.registerChild(childArtifact)`,
  or via `ContractBundle.from(compileFileMulti(file), { provider, signer })`. `upgrade` needs the `upgrade` modifier.
- Experimental: `messageBus.compose({ calls, funder, changeAddress }).send()` (`solidcash/message-bus`),
  `sc.batch([...])`, and cross-contract state mutation wired through `externals`.

### Providers, signers, debugging

```text
MockNetworkProvider (solidcash/network/mock)     -- in-process BCH 2026 VM: getSigners, addUtxo, addTokenUtxos,
                                                    mine, increaseTime, takeSnapshot, reset
ElectrumNetworkProvider (solidcash/network/electrum)  -- mainnet, chipnet, testnet4, testnet3; { hostname }
RegtestNetworkProvider (solidcash)               -- BCHN regtest RPC (localhost:18443, user/password), mines on send
BitcoinRpcNetworkProvider, FullStackNetworkProvider (solidcash)  -- no CashToken data: not for stateful/token use
new SignatureTemplate(key, sighash?, algorithm?) -- `sig` args; default SIGHASH_ALL|SIGHASH_UTXOS, Schnorr
new Signer(privateKey, provider)                 -- address, publicKey, pkh, getUtxos(), unlockP2PKH(), signMessage()
HDSigner.fromPhrase(mnemonic, provider, path?)   -- solidcash/hdsigner; also fromSeed, createRandom, signersFromMnemonic
builder.debug()                  -- evaluates every input; FailedRequireError names the require and source line
console.log(...) in a contract   -- printed when debug() runs (send() runs it first)
builder.getVmResourceUsage(true) -- per-input table: op cost, sig checks, hash iterations
builder.getBitauthUri()          -- step through in BitAuth IDE (the URI embeds private keys)
```

A stateful call has no `debug()`: use `(await sc.call.fn(args).build()).debug()`. Compile with `optimise: false`
for exact failing lines (https://solidcash.org/docs/guides/debugging).

## Testing and SolidHat

```sh
npx solidhat compile [sources...]    # cached graph compile; writes artifacts/solidcash and bindings
npx solidhat test [files] [-t name]  # compiles first (skip with --no-compile), then runs Vitest
npx solidhat deploy [script] | run <script>  # compile first (skip with --no-compile), then run
npx solidhat typegen [--watch]       # TypeChain-style ethers5/ethers6 bindings
npx solidhat doctor [--json] | clean # check the project | remove artifacts, cache and bindings
npx solidhat init --from-hardhat     # write solidcash.config.ts from hardhat.config.*
npx solidhat node                    # describe the in-process mock network
```

`compile` also refreshes the configured `typegen` targets under `typechain-types/`; a binding error aborts the
compile.

`--network <name>` selects a configured network. npm scripts: `solidhat:compile|typegen|test|deploy|clean` (flags
after `--`). Without SolidHat, install the runtime and use the same preset:

```sh
npm install --save-dev @solidcash/testing vitest
```

```ts
import hre, { ethers, network, upgrades } from '@solidcash/testing';
import { solidcashHardhatPreset } from '@solidcash/testing/vitest-preset';
```

Its `solidcash` CLI does not compile before `test`.

### Generated test configuration

The scaffold writes this `vitest.solidhat.config.ts` for the default Hardhat 3 / Ethers 6 target:

```ts
import { defineConfig } from 'vitest/config';
import { solidhatPreset } from '@solidcash/solidhat/vitest-preset';

export default defineConfig(solidhatPreset({ hardhat: 3, ethers: 6 }, {
  test: { include: ['test/**/*.test.{ts,js}'] },
}));
```

### A complete stateful test

This example uses:

```solidity
contract Counter(pubkey admin) {
    int public counter;
    function increment(sig s) { require(checkSig(s, admin), "not admin"); this.counter += 1; }
}
```

```ts
import { describe, expect, it } from 'vitest';
import { ethers } from '@solidcash/solidhat/hardhat3';
import { SignatureTemplate } from 'solidcash';

async function deployCounter() {
  const [admin, outsider] = await ethers.getSigners(2);
  const Counter = await ethers.getContractFactory('Counter', admin);
  const counter = await Counter.deploy(admin.publicKey);
  await counter.waitForDeployment();
  return { counter, admin, outsider };
}

describe('Counter', () => {
  it('lets the admin change state', async () => {
    const { counter, admin } = await deployCounter();
    await counter.increment(new SignatureTemplate(admin.privateKey));
    expect(await counter.counter()).toBe(1n);
  });

  it('rejects an outsider', async () => {
    const { counter, outsider } = await deployCounter();
    await expect(counter.increment(new SignatureTemplate(outsider.privateKey)))
      .toBeRevertedWith(/not admin/);
  });
});
```

Generated bindings expose direct public-state getters such as `await counter.counter()`; the base SDK form is
`await counter.state.counter()`. `SignatureTemplate` and `toBeRevertedWith` come from the SDK and preset.

Run one file or one test with `npx solidhat test test/Counter.test.ts -t 'lets the admin'`.

### Project configuration

```ts
// solidcash.config.ts
import { defineConfig } from '@solidcash/solidhat/config';

export default defineConfig({
  compiler: { evmCompat: true },                   // generated default (EVM ABI); also paths: {...}
  typegen: { targets: [{ target: 'ethers6', layout: 'typechain', outDir: 'typechain-types' }] },
  mnemonic: process.env.SOLIDCASH_MNEMONIC,        // default: the public Hardhat test mnemonic
  accounts: { count: 1, satoshis: 100_000_000n },  // also path, initialIndex; funded on mock and regtest
  networks: {                                      // types: mock, regtest, electrum, bitcoin-rpc
    mock: { type: 'mock' },
    regtest: { type: 'regtest', rpc: { url: 'http://127.0.0.1:18443', user: 'user', password: 'password' } },
    // Electrum/bitcoin-rpc: explicit mnemonic, one per chain (BCH signatures carry no chain id); never funded
    chipnet: { type: 'electrum', network: 'chipnet', mnemonic: process.env.SOLIDCASH_MNEMONIC_CHIPNET },
    mainnet: { type: 'electrum', network: 'mainnet', mnemonic: process.env.SOLIDCASH_MNEMONIC_MAINNET },
  },
  defaultNetwork: 'mock',
});
```

### Deployment script

```ts
// scripts/deploy.ts -- npx solidhat deploy --network regtest
import { ethers, network, upgrades } from '@solidcash/solidhat/hardhat3';

const [deployer] = await ethers.getSigners(1);
const Counter = await ethers.getContractFactory('Counter', deployer); // or 'contracts/Counter.scash:Counter'
const counter = await Counter.deploy(); // pass constructor args here for a parameterized contract
await counter.waitForDeployment();
console.log(network.name, await counter.getAddress(), counter.deploymentTransaction().txid);
const box = await upgrades.deployProxy(await ethers.getContractFactory('Box', deployer), [42n]);
await box.store(7n);                                  // calls forward through the proxy
```

`deployProxy(factory, initialState?, options?)` takes initializer arguments or a state record and runs
`initialize(...)` when present; `{ initializer: false }` seeds state at genesis. The built-in proxy pins its
implementation and cannot be upgraded in place. Custom `proxy` artifacts and `upgrades.upgradeProxy` (param-mode
custom proxies only) are experimental.

Entry points: `@solidcash/solidhat/hardhat2` and `/hardhat3` export `hre`, `ethers`, `network`, `config`, `run` and
`upgrades`; `await network.connect(name?)` returns a fresh `{ ethers, provider, networkHelpers }`. `/ethers5` gives
ethers v5 namespaces and `BigNumber`, `/ethers6` the v6 utilities, `/vitest-preset` `solidhatPreset`. The generated
Vitest config aliases `hardhat`, `ethers`, `chai`, `@nomicfoundation/hardhat-network-helpers`,
`@nomicfoundation/hardhat-chai-matchers` and `@openzeppelin/hardhat-upgrades` to the BCH runtime, so ported tests
keep their imports. `loadFixture` needs a named function; `time.increase(s)` mines a block and moves
`block.timestamp`; `setBalance` only adds a UTXO; `impersonateAccount` throws by design.

```ts
import { expect } from 'chai';  // the BCH chai shim under the SolidHat preset
await expect(counter.increment(sig)).to.emit(counter, 'Incremented').withArgs(1n);
await expect(counter.increment(badSig)).to.be.revertedWith('not owner');
await expect(() => shop.pay(sig)).to.changeBchBalance(seller, 1_000n);  // also changeTokenBalance(cat, acct, n)

import 'solidcash/vitest';      // native matchers; the SolidHat preset registers them already
expect(builder).toFailRequireWith(/Insufficient/); // toFailRequire, toLog: an unsent TransactionBuilder
await expect(sc.call.withdraw(1n)).toBeRevertedWith(/not owner/); // also toBeReverted, toRevert, toRevertWith
await expect(sc.call.transfer(to, 10n)).toEmit(sc, 'Transfer', { to, amount: 10n }); // sends the call
```

Give native matchers the unsent call or builder, never a `.send()` receipt. `revertedWithCustomError(c, name)`
checks `.withArgs(...)` only when the failure carries the arguments.

### Mock limits are not mainnet limits

The mock runs the real BCH 2026 VM with the real operation-cost density (800 per byte), but relaxes sizes by
default: 1,000,000-byte input scripts, stack items and NFT commitments, 10,000,000-byte transactions, relaxed hash
iterations and no dust rule. A green mock test does not prove a transaction is valid on mainnet. `solidhat compile`
takes its input and commitment ceilings from the selected network, so compiling against the default mock can pack
state or skip splits in ways BCH rejects. To test under real limits, give the mock production values:

```ts
// networks.mock in solidcash.config.ts, or new MockNetworkProvider({ consensusLimits, policy })
mock: { type: 'mock', policy: { enforceDust: true }, consensus: { maximumInputBytes: 10_000,
  maximumStackItemBytes: 10_000, maximumTransactionBytes: 100_000, maximumNftCommitmentBytes: 128 } },
```

Then compile publishable artifacts with `npx solidhat compile --network regtest` (10,000-byte inputs, 128-byte
commitments) and get real BCHN admission with `npx solidhat deploy --network regtest` before chipnet or mainnet.
`solidhat test --network <name>` affects only the pre-test compile; Vitest workers use `defaultNetwork`, so point it
at the production-shaped mock or `regtest`, or `await network.connect('regtest')` in the test. Only a real node
checks hash-iteration limits (the mock takes integers only). See https://solidcash.org/docs/tooling/solidhat and
https://solidcash.org/docs/tooling/testing-framework.

## Limits and Costs

```text
Unlocking bytecode per input   10,000 bytes (consensus); a P2SH contract's whole script counts against it
NFT commitment                 128 bytes per NFT (consensus)
Stack element                  10,000 bytes (consensus)
Operation cost per input       (41 + unlocking bytecode length) * 800 (consensus)
Transaction size               100,000 bytes standard, 1,000,000 consensus
Output locking bytecode        201 bytes standard (also the P2S contract size limit)
OP_RETURN data                 220 bytes of payload per transaction, standard
Dust                           444 + 3 * output size in sats; 1,000 sats is the usual safe value
Minimum relay fee              1 sat/byte
```

- SolidCash bytecode is larger than the equivalent EVM bytecode, because emulating EVM primitives and effects on
  the BCH VM costs bytes and operations. Check sizes with `solidc <file> --size`.
- An oversized stateful contract can compile into a split bundle: a state-owning root plus delegate facets
  (`compileFileSplit`, `solidc <file> --split size`).
- A loop-heavy function in a short script can run out of operation budget. The deploy-time `salt` option pads the
  script to buy budget.
- A contract's state UTXO can be spent once, so concurrent users of one contract conflict. Use `split`/`merge`
  threads for throughput.
- The default mock provider relaxes these sizes. See "Mock limits are not mainnet limits" under Testing and
  SolidHat before trusting a green test.

## Further Reading

```text
Getting started            https://solidcash.org/docs/basics/getting-started
Coming from Solidity       https://solidcash.org/docs/basics/solidity-parity
Platform differences       https://solidcash.org/docs/basics/platform-differences
Solidity import mode       https://solidcash.org/docs/compiler/solidity-import-compat
Types                      https://solidcash.org/docs/language/types
Global variables           https://solidcash.org/docs/language/globals
Built-in functions         https://solidcash.org/docs/language/builtin-functions
Stateful contracts         https://solidcash.org/docs/language/stateful-contracts
Cross-contract calls       https://solidcash.org/docs/language/cross-contract-calls
Upgrades and proxies       https://solidcash.org/docs/language/upgrades-proxies
Stateful SDK               https://solidcash.org/docs/sdk/stateful-contracts
SolidHat                   https://solidcash.org/docs/tooling/solidhat
Test matchers              https://solidcash.org/docs/sdk/test-matchers
Script limits              https://solidcash.org/docs/compiler/script-limits
Large contracts            https://solidcash.org/docs/compiler/large-contracts
Migration notes            https://solidcash.org/docs/releases/migration-notes
```
