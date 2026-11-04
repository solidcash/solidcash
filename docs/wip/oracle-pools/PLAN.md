# Oracle pools: backport plan

Status: in progress, 2026-11-04. Branch `feat/oracle-pools` from master `320a1e9d3`; a port to `sushi-port-node`
follows once the sushi-port session signals (it reads that branch's dist). The design is TRE rev. 39 decision 47
(branch `tre`, `analysis/tre/tre-rev39-addendum.md`, section 6c), settled by the user on 2026-11-04.

## Design in brief

- **Pools:** a pool is one token category, the pool category `P`, of mutable NFTs that any contract may read.
  Oracle coins belong to no contract.
- **Coin kinds:** block-info coins and ring slots share `P` and differ by covenant, so each sits at its own address.
  One baton, a minting NFT of `P` at its own lock, lets the owner grow and tune the pool.
- **Pins:** every pool covenant starts with `PIN(P, capability)`: `push(P || cap) OP_INPUTINDEX
  OP_UTXOTOKENCATEGORY OP_EQUALVERIFY`. This salts each pool's addresses.
- **Read path:** anyone may include a pool coin in any transaction. The output at the coin's own index must be its
  exact recreation: same lock, category and capability, and commitment, and at least its value. No input or output
  walk.
- **Owner paths:**
  - updates and writes;
  - the stop, a flags bit;
  - the sweep, which burns the coin;
  - key rotation.
  The owner is the key hash in the commitment.
- **Binding:** a contract binds to `P` through a hidden contract parameter `__oraclePool` (bytes32), appended as
  `__brand` is. A creator passes its own value to every contract it creates.
  - A `block.*` read checks the input's `OP_UTXOTOKENCATEGORY == P || 0x01` and `flags == 0x00`.
  - A `blockhash` read checks the same category and `flags == 0x80`.
  - A read checks no lock.
- **Genesis:** a deployment mints a pool shaped by its contract tree, or binds to an existing pool.

## Formats (single source for this branch)

- Block-info commitment:
  - layout: `flags (1) || owner key hash (20) || number || timestamp || difficulty || size || totalFees || coinbase`;
  - each numeric field is master's 5-byte encoding (4 LE and a 0x00);
  - `coinbase` is a 1-byte length, then its bytes.
- Slot commitment: `flags (1) || n (4 LE) || hash (32) || owner key hash (20) || depth (2 LE)`, 59 B.
- Baton commitment: `owner key hash (20) || depth (2 LE)`.
- `flags`:
  - bit 7 is the kind: 0 for block-info, 1 for a slot;
  - block-info bit 0 marks `number` stopped and bit 1 marks `timestamp` stopped;
  - slot bit 0 marks the slot stopped.
- Pool coins hold 1,200 sat each.

## Covenant rules

- **Block-info update** (owner-signed, recreated at its own index, kind bit 0):
  - A height-locked update (`OP_TXLOCKTIME < 500,000,000`) may raise `number`, bounded by CLTV, and write
    difficulty, size, totalFees and coinbase. It keeps `timestamp`, and may clear bit 0.
  - A time-locked update may raise `timestamp`, bounded by CLTV. It keeps the other fields, and may clear bit 1.
  - Either may set either bit; neither rewinds.
- **Slot write** (owner-signed): `n' > n`, `(n' - n) mod depth == 0`, CLTV height `n'`, any hash. Owner and depth are
  kept, the kind bit stays set, and the stop bit is cleared.
- **Stop:** owner-signed; set stop bits and change nothing else.
- **Sweep:** owner-signed; no recreation, and no output may carry `P` (a walk on this path only). A swept mutable coin
  frees its one-NFT allowance, and the baton an unlimited one, which could otherwise mint a readable forgery.
- **Rotate:** owner-signed; a new owner hash, nothing else changed.
- **Baton mint** (owner-signed by the baton commitment's key). It walks the outputs and admits:
  - exactly one minting output: its own recreation at its index;
  - recreations of co-spent pool coins at their own indices (their covenants check them);
  - block-info outputs at the info lock whose commitment equals a co-spent live info input's;
  - slot outputs at the slot lock with the kind bit set, stop bit clear, the baton's owner and depth, and `n` no
    greater than a height-type `OP_TXLOCKTIME`;
  - no fungible amount of `P`.
- **Baton update and sweep:** owner-signed. The update may change the depth or rotate the owner.

## Phases

1. **utils**, a new module `packages/utils/src/oracle-pool.ts`: codecs, the three covenants, locks and unlocking
   builders. VM tests.
2. **SDK**, a new module `packages/solidcash/src/oracle/pool/`:
   - pool genesis from ordinary transactions: info coins at the tip's fields; slots holding the last `depth` real
     blocks; the baton;
   - `PoolKeeper`:
     - atomic refresh of all info coins, one transaction per locktime type;
     - the newest slot each block;
     - growth through the baton;
     - stop, sweep and rotate;
   - coin selection: a random live coin of the right kind, at aligned indices;
   - a mock pool made by ordinary transactions and refreshed on each mined block.
3. **Compiler on master:**
   - the `__oraclePool` parameter;
   - reads by category and flags, with ring exact-`n` and the zero for a same residue at least 256 newer;
   - drop master's block-info lock sentinel, the `(n -> hash)` pairs and the keeper baton;
   - a creator passes the binding to its children;
   - statefulness rules unchanged.
4. **SDK on master:**
   - a deploy option `oraclePool` (a category or a new pool), and the provider default;
   - fill `__oraclePool`;
   - co-spend pool coins;
   - retire the per-contract oracle deployment and the pair co-spend.
5. **Tests and docs:**
   - e2e on mocknet;
   - update the oracle e2e files: BlockOracle, BlockOracleValue, BlockhashKeeperDeployment, the CRYPTO-4 and -5
     audits, KernelCalleeOnlyBlockOracle, TransitiveBlockhashOutState;
   - the website guide, AGENTS.md and the security ledger. The pools fix ORACLE-1, -2 and -5 on master at the root.
6. **Port to `sushi-port-node`:** replace its per-contract oracles (ORACLE-4, the per-contract ring, GENESIS-1's
   oracle part, the oracle output pins), after the sushi-port session's signal.
