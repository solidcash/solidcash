> Copied from the review worktree `/Code/cashscript/.worktrees/release-review` on 2026-11-16. The tests and their
> verdicts stay there, under `packages/solidcash/test/conformance-review/`; they are not part of the repository
> because they read SolidPool's sources from `/Code/tornado/bch-next`. The reviewer was a Fable model with no part in
> writing the code; an earlier, broader Fable review was stopped by the model's safeguards before it reported.
>
> **Lander's note.** After the review, the two test files it could not finish (BchPool and the deployers) were run
> once with its fixed harness: both passed (3 tests). Every recorded verdict is as the rules require: BchPool 67 rows,
> TokenPool 62, the BCH deployer 26, the token deployer 16, MimcHash 17. So BchPool's rows below that say "Read" also
> have a VM verdict now.

# SolidPool conformance review of SolidCash 0.51.0

Reviewed on 2026-11-16 in `/Code/cashscript/.worktrees/release-review` (0.51.0, commit `57036470e`). No code was
changed. The only files added are this report and the tests under `packages/solidcash/test/conformance-review/`.

**Result.** Of 70 rules, 67 are enforced, 1 is not enforced as worded, and 2 are unclear because they depend on the
Groth16 verifier program, which SolidCash does not compile and this review did not read.

- The one rule not enforced is a wording gap in TokenPool's source, not a compiler defect, and I found no way to use it.
- No rule about money, state, events or a pool's birth was found unenforced.
- **Half of the evidence is by reading only.** Two of my four test files stopped on mistakes in my own test code, and
  the repository's test discipline forbids a second run. BchPool has no VM verdict from me, and the deployers have
  9 of the 36 I wrote. Both files are fixed and ready for the lander to run once (about 10 seconds each).

## How each rule was judged

| Code | Meaning |
|---|---|
| **VM** | A test built the honest transaction with the SDK, the production-profile mock accepted it, and libauth's standard BCH 2026 VM rejected a copy that breaks the rule. The verdicts are in `packages/solidcash/test/conformance-review/results/`. |
| **Read** | I read the bytecode 0.51.0 emits for the function (disassembled per `OP_DEFINE` body) and found the check. Where the row says "traced", I followed the stack by hand to the operands of the check. |

The four test files, each run once by name:

| File (under `packages/solidcash/test/conformance-review/`) | Outcome |
|---|---|
| `TokenPool.conformance-review.test.ts` | Passed. 62 rows in `results/token-pool.json`, every hostile copy rejected by an `OP_VERIFY` failure. |
| `MimcHash.conformance-review.test.ts` | Passed. 17 rows in `results/mimc-hash.json`. |
| `PoolDeployers.conformance-review.test.ts` | Failed on my helper: it looked for a wallet change output the SDK's creation does not have. Before that it recorded 6 VM verdicts for the BCH deployer and 3 for the token deployer, all as the rules require (`results/bch-pool-deployer.json`, `results/token-pool-deployer.json`; the two rows marked not ok there are my own shape check and the helper's error). Fixed by reading, not run again. |
| `BchPool.conformance-review.test.ts` | Failed in my harness before any verdict: it awaited an SDK call, which is a thenable, so the deposit was sent early. Fixed by reading (the TokenPool run used the fixed harness), not run again. |

The pools were deployed with a stand-in worker lock and a stand-in verifier lock (both are constructor arguments), so
the pool's compiled code is judged without a MiMC hash or a proof. MimcHash was compiled with a one-opcode stand-in for
the `mimc` library, so what is judged is the code the compiler emits around the library call.

The compiled BchPool and TokenPool are byte-identical whether compiled alone or as the deployer's child (4,948 B and
5,986 B), so a pool born through a deployer runs the code judged here.

## Rule table

"Stated in" names the source file and line, or the document. `B` is BchPool, `T` is TokenPool, `P` the deployers,
`M` MimcHash, `U` the rules that depend on the verifier.

### BchPool

| # | Rule | Stated in | Enforced | Evidence |
|---|---|---|---|---|
| B1 | `deposit` adds exactly 10^exponent + WITHDRAW_FEE + FINISH_FEE to the satoshi container, counted over every coin at its lock | BchPool.scash 11-13, 146 | yes | Read, traced: outputs minus inputs at the lock must equal `10^e + 41000 + 90000` |
| B2 | No deposit lands while a note waits for `finish` (`stage == 0`) | BchPool.scash 13, 147 | yes | Read. Same emitter as T3, which is VM |
| B3 | In `deposit` the master is input 0 | BchPool.scash 138-139, 148 | yes | Read: `OP_INPUTINDEX 0 OP_NUMEQUALVERIFY` |
| B4 | Every function keeps the master's commitment | BchPool.scash 136-137 | yes | Read, in all three functions |
| B5 | `deposit` is refused when the tree is full | BchPool.scash 150 | yes | Read: `nextIndex < 1048576` |
| B6 | In `deposit` only the pool's own state may carry a token | BchPool.scash 152-159 | yes | Read: the loop over every input |
| B7 | A coin takes a note only if it then holds all the pool owes | BchPool.scash 161-167, ARCHITECTURE "One coin holds all the pool owes" | yes | Read, traced: output 2 must hold `1200 + notes * (10^e + 41000) + 90000` |
| B8 | `deposit` and `finish` each check ten levels: the ten inputs are at `workerLock`, and each hash's left and right values are the node and the frontier or empty subtree | BchPool.scash 109-134, 169-173, 184-186 | yes | Read. Same emitter as T13 |
| B9 | `deposit` writes `treeState`, `stage = 1`, `live + 1` and nothing else | BchPool.scash 165-174 | yes | Read: the record's whole new commitment is compared with the computed one |
| B10 | `deposit` emits `Deposit(leafIndex, commitment)` | BchPool.scash 175 | yes | Read: commitment, lock, category and immutability of output 3 |
| B11 | `finish` needs a deposited note (`stage == 1`) | BchPool.scash 182 | yes | Read |
| B12 | `finish` publishes the root: `recentRoots` shifted with the new root, `treeState`, `stage = 0`, `nextIndex + 1` | BchPool.scash 188-192 | yes | Read |
| B13 | `finish` takes at most FINISH_FEE from the satoshi container, whatever coins at its lock are spent | BchPool.scash 163-164, 193 | yes | Read: inputs at the lock may not exceed outputs at the lock plus 90,000, and the slot coin the same |
| B14 | `withdraw` acts on the statement of the last input, which is at `verifierLock` | BchPool.scash 196-212 | yes | Read, traced |
| B15 | `withdraw` pays the recipient the statement names | BchPool.scash 214-219, README "The pool checks" | yes | Read, traced: the lock of output 3 is the `recipient` whose hash with the salt equals the statement's third value |
| B16 | The statement's root is one of the pool's last 8 | BchPool.scash 100-107, 221 | yes | Read |
| B17 | A note pays once: the nullifier's slot is empty, then filled, and `live - 1` | BchPool.scash 223-238 | yes | Read, traced into the new commitment |
| B18 | `withdraw` emits `Withdraw(nullifierHash)` | BchPool.scash 239 | yes | Read |
| B19 | `withdraw` pays the recipient exactly 10^exponent satoshis, with no token | BchPool.scash 240 | yes | Read, traced: output 3's value equals the computed amount and its token category is empty |
| B20 | `withdraw` takes at most 10^exponent + WITHDRAW_FEE from the satoshi container, whatever coins at its lock are spent | BchPool.scash 163-164, 240-241 | yes | Read, traced: inputs at the lock may not exceed outputs at the lock plus the amount plus 41,000 |
| B21 | The pool keeps one plain satoshi coin: recreated at its lock, no second output at the lock, no token | BchPool.scash 23-25, ARCHITECTURE "Coins stay plain" | yes | Read. The coin's own covenant is the one T30 judged by VM |
| B22 | The master and the state record keep their lock, category and satoshis, there is one record, and no second minting NFT | ARCHITECTURE "Contract state", "Coins stay plain" | yes | Read |
| B23 | No event is forged: an NFT of the pool's category with a commitment is accepted only at the function's event slot | ARCHITECTURE "History" | yes | Read. An empty commitment and an anchor are exempt, as ARCHITECTURE says ("records at an event's address that are not events") |
| B24 | A pool born through a deployer has an exponent from 6 to 10 | BchPool.scash 51-54, 82, README "Pool deployers" | yes | Read: `Deploy<BchPool>` checks the exponent is at least 6 and under 11 |

### TokenPool

| # | Rule | Stated in | Enforced | Evidence |
|---|---|---|---|---|
| T1 | `deposit` adds exactly WITHDRAW_FEE + FINISH_FEE to the satoshi container | TokenPool.scash 165 | yes | VM: one satoshi less and one more are both rejected |
| T2 | `deposit` adds exactly 10^exponent units of `asset` to the token container | TokenPool.scash 161-162, 211-214 | yes | VM |
| T3 | No deposit lands while a note waits for `finish` | TokenPool.scash 166 | yes | VM: the same deposit against a record whose stage is 1 |
| T4 | In `deposit` the master is input 0 | TokenPool.scash 167 | yes | Read |
| T5 | Every function keeps the master's commitment | TokenPool.scash 153-154 | yes | VM in `deposit` and `withdraw`, Read in `finish` |
| T6 | `deposit` is refused when the tree is full | TokenPool.scash 169 | yes | Read |
| T7 | In `deposit` an input of any category but the pool's own and `asset` is refused | TokenPool.scash 186, README "Token pools" | yes | VM, with a control |
| T8 | A deposit coin holds a positive amount, no NFT a script can see, and under 1,500 satoshis | TokenPool.scash 179-180, 199-203 | yes | VM: 1,500 sat rejected and 1,499 accepted, a mutable NFT and an immutable NFT with a commitment rejected. Read for the positive amount |
| T9 | A deposit coin is at a P2PKH | TokenPool.scash 179, README "Token pools" | **no** | Read: the code tests only that the lock is 25 bytes long. See below |
| T10 | An asset coin at any other script lock cannot be deposited: the script-locked inputs must add up to what `this.tokens[asset]` reads | TokenPool.scash 181-187, 213 | yes | VM |
| T11 | The token coin a deposit lands on holds at least 705 satoshis | TokenPool.scash 56-58, 205 | yes | Read |
| T12 | A coin takes a note only if it then holds all the pool owes, in tokens and in fees | TokenPool.scash 216-224 | yes | VM: one unit short and one satoshi short rejected, one unit over accepted |
| T13 | `deposit` and `finish` each check ten levels through coins at `workerLock` | TokenPool.scash 126-151 | yes | VM for the worker lock in `deposit`, Read for the rest |
| T14 | `deposit` writes `treeState`, `stage = 1`, `live + 1` and nothing else | TokenPool.scash 221-231 | yes | VM |
| T15 | `deposit` emits `Deposit(leafIndex, commitment)` | TokenPool.scash 232 | yes | VM |
| T16 | `finish` needs a deposited note | TokenPool.scash 239 | yes | VM |
| T17 | `finish` publishes the root and lets the next deposit in | TokenPool.scash 245-249 | yes | VM |
| T18 | `finish` takes at most FINISH_FEE from the satoshi container | TokenPool.scash 250 | yes | VM for one satoshi more, Read for the sum over every coin at the lock |
| T19 | `finish` takes nothing from the token coin | TokenPool.scash 219-220, ARCHITECTURE "A token coin stays as it is" | yes | VM: one unit, one satoshi and a drain to a filler are rejected, and the coin recreated as it was is accepted |
| T20 | `withdraw` acts on the statement of the last input, which is at `verifierLock` | TokenPool.scash 253-269 | yes | VM, with a control |
| T21 | `withdraw` pays the recipient the statement names | TokenPool.scash 271-276 | yes | VM: another lock on the payment, and another recipient hash in the statement |
| T22 | The statement's root is one of the pool's last 8 | TokenPool.scash 278 | yes | VM |
| T23 | A note pays once, and `live - 1` | TokenPool.scash 280-295 | yes | VM: a record that already holds the nullifier, and a new state that keeps the old one |
| T24 | `withdraw` emits `Withdraw(nullifierHash)` | TokenPool.scash 296 | yes | VM |
| T25 | `withdraw` pays the recipient exactly 10^exponent units of `asset` | TokenPool.scash 297 | yes | VM: one unit less and one more |
| T26 | `withdraw` takes exactly one denomination from the token container, whatever coins at its lock are spent | TokenPool.scash 219-220 | yes | VM: one more unit out, and a second token coin drained or shrunk |
| T27 | `withdraw` takes at most WITHDRAW_FEE from the satoshi container, whatever coins at its lock are spent | TokenPool.scash 298 | yes | VM: a second satoshi coin drained is rejected, and the same coin merged is accepted |
| T28 | The pool keeps one token coin, and no transaction takes a satoshi from it | TokenPool.scash 28-31, ARCHITECTURE "A token coin stays as it is" | yes | VM in all three functions |
| T29 | No transaction hangs an NFT on the token coin or changes one | ARCHITECTURE "A token coin stays as it is" | yes | Read: the coin's covenant keeps its category with the capability byte and its commitment. The immutable NFT with an empty commitment is the documented exception |
| T30 | The pool keeps one plain satoshi coin | TokenPool.scash 28-31 | yes | VM for a token put on the coin, Read for the single output |
| T31 | Master, state record and events as B22 and B23 | ARCHITECTURE | yes | Read |
| T32 | A pool born through a deployer has an exponent from 0 to 12 and an asset that is not its own category | TokenPool.scash 95-99, README "Token pools" | yes | Read: `Deploy<TokenPool>` checks both, the category being the deployer coin's outpoint in display order |

### The deployers

| # | Rule | Stated in | Enforced | Evidence |
|---|---|---|---|---|
| P1 | A creation spends the deployer coin at output 0 of the prep, beside the author's coin at output 1 | README "Pool deployers", contract-creation.md "Deployer coins" | yes | Read |
| P2 | The pool's master is at the lock its arguments and code give, with category X and the minting capability, no commitment and 1,200 sat | README "Pool deployers" | yes | VM for the lock, Read for the rest |
| P3 | The pool's only state record is at its lock, with the empty pool's state | README "Pool deployers" | yes | VM for the lock, Read for the state, category and count |
| P4 | One plain satoshi coin of at least 1,200 sat is at its lock | README "Pool deployers" | yes | VM for the lock and for 600 and 1,199 sat, Read for the single output and for accepting more than 1,200 |
| P5 | A token pool has one token coin at its lock, of the asset, with at least one unit | TokenPoolDeployer.scash 15-17, compiler docs "Value and token transfers on deploy" | yes | VM for the lock and for a coin with no token, Read for the amount, the satoshis and the single output |
| P6 | No other token of the pool's category is made | README "Pool deployers" | yes | Read: one minting NFT, one mutable NFT, nothing else, no fungible amount |
| P7 | The pool is made with the arguments the creator was given | BchPoolDeployer.scash 24-25, TokenPoolDeployer.scash 24-25 | yes | Read: the creator compares the deployer coin's unlocking bytecode with its own arguments |
| P8 | `PoolCreated` carries the category the pool really received, the asset for a token pool, and the exponent | BchPoolDeployer.scash 9-12, TokenPoolDeployer.scash 9-13 | yes | Read. The honest events' contents were confirmed in both runs |

### MimcHash

| # | Rule | Stated in | Enforced | Evidence |
|---|---|---|---|---|
| M1 | A coin spends only beside its pool's master at input 0 | MimcHash.scash 14-15, 19 | yes | VM: no token, a mutable NFT, another category and the master at input 1 |
| M2 | A coin recreates itself at its own index with the same lock and value and no token | MimcHash.scash 15-17, 20-23 | yes | VM |
| M3 | `mimc(left, right) == out`, and a value at or over the field is refused | MimcHash.scash 24, BchPool.scash 142-143 | yes | VM for the equality with the stand-in, Read for the field bound in SolidPool's `mimc` library code |
| M4 | The unlocking bytecode is three 32-byte pushes at the offsets the pool reads | MimcHash.scash 5-8 | yes | VM: a surplus push is rejected by the clean-stack rule |

`BN254.scash` states no rule about a transaction. It compiles under 0.51.0 with the pools' options (7 functions).

### Rules that depend on the verifier

| # | Rule | Stated in | Enforced | Evidence |
|---|---|---|---|---|
| U1 | In `withdraw` the master is input 0 | BchPool.scash 138-139, ARCHITECTURE "The transactions" | unclear | `withdraw` does not check it. The source says the verifier's coins do. The verifier is generated outside SolidCash and was not in this review's material |
| U2 | The verifier pins every push of its statement, so the offset 357 cannot move, and its coins recreate themselves | BchPool.scash 57-60, ARCHITECTURE "Why three contracts" | unclear | As U1 |

`finish` needs no such rule of its own: its ten worker coins each require the master at input 0 (M1).

## Rules not enforced

### T9. A deposit coin is at a P2PKH

- **Wrongly accepted shape.** A token-pool deposit whose asset coin sits at any 25-byte locking bytecode that is not a
  P2PKH, for example a bare script of that length. The coin must still hold a positive amount of `asset`, no NFT a
  script can see, and under 1,500 satoshis.
- **Consequence.** None found for funds or for the pool's liveness. The 1,500-satoshi rule and the sum check on
  script-locked inputs do not depend on the lock being a P2PKH: a token container's lock is 35 bytes, so the two kinds
  stay apart. Such an output is non-standard to create, so only a miner can make one. This is a gap between the
  wording and the source, not a compiler defect.
- **Code locations.** `TokenPool.scash` line 202, `if (tx.inputs[i].lockingBytecode.length == 25)`. The compiled
  `deposit` (selector `89f09716`) tests `OP_UTXOBYTECODE OP_SIZE OP_NIP 25 OP_NUMEQUAL` and nothing else about the
  lock.
- **Evidence.** Read only. I did not build this transaction.

## Coverage

**Compiled.** `BchPool`, `TokenPool`, `BchPoolDeployer`, `TokenPoolDeployer`, `MimcHash` and `BN254` from copies whose
pragma says `^0.51.0`, with the options in each committed artifact's `compiler.options`. The `mimc` user library
option does not change the pools' or the deployers' bytecode.

**Bytecode read.** Every `OP_DEFINE` body of BchPool. Of TokenPool, every body that differs from BchPool's and the
token-specific parts of its three functions. BchPoolDeployer in full, and TokenPoolDeployer up to its event checks
(the rest is the same code). `Deploy<BchPool>.create`, `Deploy<TokenPool>.create`, the `sweep` arm, and MimcHash. I
decoded three of the sidecar locks the pools build: the state record, the satoshi container and the token container.
I traced the stack by hand through BchPool's `withdraw` and the value checks of its `deposit` and `finish`.

**Compiler source read.** In `packages/solidc/src/generation/GenerateTargetTraversal.ts`: the epilogue selection
(lines 12200-12520), `emitGenesisCreateEpilogue` (12848), `emitSlotScans` and the container aggregate (61078-61154),
`emitContainerStaysSingle` and `emitSingleTokenContainers` (61171-61211), `emitInputSlotScanBody` (61241-61307) and the
satoshi-container part of `emitValuePreservation` (63108-63190). I located the other emitters by name and judged them
from their output, not their source.

**Documents read.** The six contract sources, SolidPool's README and ARCHITECTURE, `website/docs/language/contracts.md`,
`contract-creation.md` and the container sections of `stateful-contracts.md`, the "Deployer coins" and "Value and token
transfers on deploy" sections of `packages/solidc/docs/contract-creation.md`, and the 0.51.0 changelog.

**Not covered.**
- BchPool has no VM verdict from this review. Its rows rest on the bytecode, on a hand trace of the money checks, and
  on TokenPool's VM verdicts where the two share an emitter.
- For the deployers, the second-coin, state, census, event and argument rules (P1, P6, P7, P8 and parts of P2 to P5)
  are by reading. The repository's own `test/e2e/DeployerGenesisPins.e2e.test.ts` tests the same pins on a
  BchPool-shaped contract; I read it and did not run it.
- The Groth16 verifier program, the real `mimc` library's hashing, and every off-chain check (`genesisProblems`, the
  client's history rules) were not judged.
- The exceptions ARCHITECTURE documents were taken as stated, not as findings: an immutable NFT with an empty
  commitment, anchors and empty records at an event's address, a coin moved back to itself, and a genesis built by hand.

**SolidPool's README is stale against 0.51.0** in three places under "Pool deployers", all in the safe direction:
- It says the chain takes a creation that pays the state record or satoshi coin elsewhere or opens the coin at 600
  sat. 0.51.0 rejected each of those in the VM.
- It says `Deploy<C>` refuses an honest satoshi coin above 1,200 sat. The 0.51.0 bytecode requires at least 1,200.
- It says a token creation through `new` is refused. The SDK built one, and the mock and the VM accepted it.

## Summary

| Enforced | Not enforced | Unclear |
|---|---|---|
| 67 | 1 | 2 |

Not enforced: **T9, "A deposit coin is at a P2PKH"** (TokenPool `deposit` tests only a 25-byte lock; no consequence
found).

Unclear: U1 and U2, which depend on the verifier program.
