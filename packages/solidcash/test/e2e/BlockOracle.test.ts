import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { hexToBin, binToHex } from '@bitauth/libauth';
import {
  Contract,
  TransactionBuilder,
} from '../../src/index.js';
import {
  StatefulContract,
  getContractFactory,
} from '../../src/stateful/index.js';
import { resolveBlockhashCoSpend } from '../../src/oracle/index.js';
import { randomUtxo } from '../../src/utils.js';
import {
  createTestProvider, createFeeFunder, setupStatefulUtxos, fundedSigner, mintTestOraclePool, TEST_ORACLE_POOL_KEY,
} from '../test-util.js';
import { PoolKeeper } from '../../src/oracle/pool/index.js';
import { keccakComputeLockingBytecode, poolSlotLockingBytecode } from '@solidcash/utils';
import { keccak_256 } from '@noble/hashes/sha3.js';

const TXID = /^[0-9a-f]{64}$/;
const verifyFailure = /failed at input 0: Program failed an OP_(EQUAL)?VERIFY operation/;

// Mine a block and take its height and hash. The provider's oracle pool holds a slot of each of the last 256 blocks,
// at the chain's hashes, so a blockhash reader reads block n from it, and the locktime n is final under the new tip.
async function allocHeight(provider: ReturnType<typeof createTestProvider>): Promise<{ n: number; hash: Uint8Array }> {
  const before = await provider.getBlockHeight();
  await provider.mine(1);
  const n = before + 1;
  return { n, hash: hexToBin(await provider.getBlockHash(n)) };
}

// block.chainid is uint256 (Solidity parity); the baked network selector is a minimal int on-stack. The
// contract requires it equals an unlock arg (numeric compare), so the spend only succeeds when the value
// compiled for `chainId` matches what the caller expects under the VM.
// Compiled with { forceStateful: true } so this zero-state covenant is a stateful contract (master-NFT
// self-pin, empty stateLayout), and can be spent with the short `sc.check(expected).send()` call instead of a
// hand-rolled TransactionBuilder - no dummy state field.
const SOURCE = `
contract ChainIdCheck() {
    function check(uint256 expected) {
        require(block.chainid == expected);
    }
}`;

// User-land selector chainId -> the uint256 block.chainid value (its unsigned byte, `chainId & 0xff`):
// mainnet 0, chipnet 1, testnet4 2, regtest (-1) -> 255.
const NETWORKS = [
  { name: 'mainnet', chainId: 0, expected: 0 },
  { name: 'chipnet', chainId: 1, expected: 1 },
  { name: 'testnet4', chainId: 2, expected: 2 },
  { name: 'regtest', chainId: -1, expected: 255 },
];

// A no-arg contract whose body hardcodes a network-byte check.
const LITERAL_SRC = 'contract C() { function f() { require(block.chainid == 0); } }';

describe('block.chainid e2e', () => {
  for (const net of NETWORKS) {
    it(`bakes ${net.name} (chainId ${net.chainId}) as ${net.expected} and enforces it on the VM`, async () => {
      const factory = getContractFactory(
        compileString(SOURCE, { chainId: net.chainId, forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      const tx = await sc.check(BigInt(net.expected));
      expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
    });

    it(`rejects a mismatched chain id for ${net.name}`, async () => {
      const factory = getContractFactory(
        compileString(SOURCE, { chainId: net.chainId, forceStateful: true }), await fundedSigner(),
      );
      const sc = await factory.deploy();
      await expect(sc.check(BigInt(net.expected === 0 ? 1 : 0))).rejects.toThrow(verifyFailure);
    });
  }

  it('defaults to mainnet (0) when chainId is omitted', async () => {
    const factory = getContractFactory(compileString(LITERAL_SRC, { forceStateful: true }), await fundedSigner());
    const sc = await factory.deploy();
    const tx = await sc.f();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a chipnet-compiled contract fails a hardcoded mainnet check (1 != 0)', async () => {
    const factory = getContractFactory(
      compileString(LITERAL_SRC, { chainId: 1, forceStateful: true }), await fundedSigner(),
    );
    const sc = await factory.deploy();
    await expect(sc.f()).rejects.toThrow(verifyFailure);
  });
});

describe('block.chainid compilation', () => {
  it('bakes a different value per chainId', () => {
    const mainnet = compileString(SOURCE, { chainId: 0 }).bytecode;
    const chipnet = compileString(SOURCE, { chainId: 1 }).bytecode;
    const regtest = compileString(SOURCE, { chainId: -1 }).bytecode;
    expect(mainnet).not.toEqual(chipnet);
    expect(chipnet).not.toEqual(regtest);
    expect(mainnet).not.toEqual(regtest);
  });

  it('defaults to mainnet when chainId is omitted (same bytecode as chainId 0)', () => {
    expect(compileString(SOURCE).bytecode).toEqual(compileString(SOURCE, { chainId: 0 }).bytecode);
  });
});

// block.* reads slice a block-info coin of the oracle pool the reader binds. The reader is stateless. Values are
// real mainnet block 956830. basefee is Floor(1000 * totalFees / size) = Floor(1000*31792/9075) = 3503.
const ORACLE_READER = `
contract BlockReader() {
    function check(int eNumber, int eTimestamp, int eDiff, int eSize, int eFees, int eBasefee, bytes eCoinbase) {
        require(block.number == eNumber);
        require(block.timestamp == eTimestamp);
        require(block.difficulty == eDiff);
        require(block.size == eSize);
        require(block.totalFees == eFees);
        require(block.basefee == eBasefee);
        require(block.coinbase == eCoinbase);
    }
}`;

const BLOCK = {
  number: 956830n,
  timestamp: 1782384635n,
  difficulty: 0x18026c88n,
  size: 9075n,
  totalFees: 31792n,
  basefee: 3503n, // Floor(1000 * 31792 / 9075)
  coinbase: hexToBin('76a914f1c075a01882ae0972f95d3a4177c86c852b7d9188ac'), // p2pkh, 25 bytes
};

// A pool whose info coins hold BLOCK; the provider's own pool publishes the chain's tip instead.
function blockPool(provider: ReturnType<typeof createTestProvider>): Promise<string> {
  return mintTestOraclePool(provider, {
    number: BLOCK.number,
    timestamp: BLOCK.timestamp,
    difficulty: BLOCK.difficulty,
    size: BLOCK.size,
    totalFees: BLOCK.totalFees,
    coinbase: BLOCK.coinbase,
  });
}

/** A reader of `source` bound to `oraclePool`. Every block.* reader is stateful, so it is set up with its state. */
async function statefulReader(
  provider: ReturnType<typeof createTestProvider>, source: string, oraclePool: string,
): Promise<StatefulContract> {
  const artifact = compileString(source);
  const contract = new Contract(artifact, [], { provider, oraclePool });
  const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {});
  return StatefulContract.withCategory(contract, categoryId);
}

async function spendReader(
  number: bigint, timestamp: bigint, difficulty: bigint, size: bigint, fees: bigint, basefee: bigint,
  coinbase: Uint8Array,
): Promise<string> {
  const provider = createTestProvider();
  const sc = await statefulReader(provider, ORACLE_READER, await blockPool(provider));
  const tx = await (sc as any).check(number, timestamp, difficulty, size, fees, basefee, coinbase).send();
  return tx.txid;
}

describe('block.* oracle reads e2e', () => {
  const artifact = compileString(ORACLE_READER);

  it('takes the pool binding and no per-contract register', () => {
    expect(artifact.usesBlockOracle).toBe(true);
    expect(artifact.constructorInputs.map((input) => input.name)).toEqual(['__oraclePool']);
    expect(artifact.abi.map((fn) => fn.name)).not.toContain('__updateBlockOracle');
    expect(artifact.stateLayout?.variables.map((variable) => variable.name) ?? []).not.toContain('__block_number');
  });

  it('reads every block.* field (incl. coinbase) and derives basefee from the commitment', async () => {
    const txid = await spendReader(
      BLOCK.number, BLOCK.timestamp, BLOCK.difficulty, BLOCK.size, BLOCK.totalFees, BLOCK.basefee, BLOCK.coinbase,
    );
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong block.number', async () => {
    await expect(spendReader(
      999999n, BLOCK.timestamp, BLOCK.difficulty, BLOCK.size, BLOCK.totalFees, BLOCK.basefee, BLOCK.coinbase,
    )).rejects.toThrow(/OP_VERIFY|non-truthy/);
  });

  it('rejects a wrong derived basefee', async () => {
    await expect(spendReader(
      BLOCK.number, BLOCK.timestamp, BLOCK.difficulty, BLOCK.size, BLOCK.totalFees, 3504n, BLOCK.coinbase,
    )).rejects.toThrow(/OP_VERIFY|non-truthy/);
  });

  it('rejects a wrong block.coinbase', async () => {
    await expect(spendReader(
      BLOCK.number, BLOCK.timestamp, BLOCK.difficulty, BLOCK.size, BLOCK.totalFees, BLOCK.basefee,
      hexToBin('76a914000000000000000000000000000000000000000088ac'),
    )).rejects.toThrow(/OP_VERIFY|non-truthy/);
  });
});

// A read inside an internal helper: the caller carries the oracle index and forwards it on the call.
const INTERNAL_READER = `
contract InternalReader() {
    function readTime(int expected) internal {
        require(block.timestamp == expected);
    }
    function check(int expected) {
        readTime(expected);
        require(expected > 0);
    }
}`;

describe('block.* read behind an internal call e2e', () => {
  const spend = async (expected: bigint): Promise<string> => {
    const provider = createTestProvider();
    const sc = await statefulReader(provider, INTERNAL_READER, await blockPool(provider));
    const tx = await (sc as any).check(expected).send();
    return tx.txid;
  };

  it('gives the caller the oracle index and forwards it to the reader', async () => {
    const check = compileString(INTERNAL_READER).abi.find((fn) => fn.name === 'check');
    expect(check?.usesBlockOracle).toBe(true);
    expect(check?.inputs.map((input) => input.name)).toContain('__internal__blockOracleInputIndex');
    expect(await spend(BLOCK.timestamp)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong timestamp read through the forwarded index', async () => {
    await expect(spend(BLOCK.timestamp + 1n)).rejects.toThrow(/OP_VERIFY|non-truthy/);
  });
});

// The owner is the key hash in a pool coin's commitment. An update is a spend of that covenant, signed by the key
// named there, with tx.time >= the new block number. It is not a function of the reader. The covenant's owner, CLTV
// and no-rewind rules are pinned in the CRYPTO-4 and CRYPTO-5 audit files.
const READ_BACK = `
contract BlockOracleOwned() {
    function readBack(int eNumber, int eTimestamp) {
        require(block.number == eNumber);
        require(block.timestamp == eTimestamp);
    }
}`;

describe('block.* owner-update path e2e', () => {
  it('does not put an owner key or an update function on the reader', () => {
    const artifact = compileString(READ_BACK);
    expect(artifact.abi.map((fn) => fn.name)).not.toContain('__updateBlockOracle');
    expect(artifact.stateLayout?.variables ?? []).toEqual([]);
  });

  // Mock chain tip is height 133700. The covenant's CLTV is tx.time >= number, and a locktime above the tip
  // is non-final, so an update cannot name a height the chain has not reached.
  it('owner replaces the commitment, and a reader slices the new fields', async () => {
    const provider = createTestProvider();
    // The pool starts below the new height, and a height update keeps the timestamp (audit CRYPTO-6).
    const oraclePool = await mintTestOraclePool(provider, {
      number: 99_999n, timestamp: 1700000000n, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
    });
    const keeper = new PoolKeeper({ provider, category: oraclePool, ownerKey: TEST_ORACLE_POOL_KEY });
    const txids = await keeper.refreshInfo({
      number: 100000n, timestamp: 1700000000n, difficulty: 0n, size: 1n, totalFees: 0n,
      coinbase: hexToBin('00'),
    });
    expect(txids).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/)]);
    const sc = await statefulReader(provider, READ_BACK, oraclePool);
    const tx = await (sc as any).readBack(100000n, 1700000000n).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

// blobhash(i) has no BCH analogue (no EIP-4844 blobs) -> always bytes32(0). blockhash(n) reads a ring slot of the
// reader's oracle pool (below).
const B32_ZERO = `0x${'00'.repeat(32)}`;

async function spendBlob(expectHex: string): Promise<string> {
  const provider = createTestProvider();
  const artifact = compileString(`contract Blob(){ function f(){ require(blobhash(5) == ${expectHex}); } }`);
  const contract = new Contract(artifact, [], { provider });
  const utxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
  const feeFunder = await createFeeFunder(provider, 20000n);
  const tx = await new TransactionBuilder({ provider })
    .addInput(utxo, contract.unlock.f())
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: contract.address, amount: 110000n })
    .send();
  return tx.txid;
}

describe('blobhash / blockhash', () => {
  it('blobhash(i) returns bytes32(0) (no blobs on BCH)', async () => {
    expect(await spendBlob(B32_ZERO)).toMatch(/^[0-9a-f]{64}$/);
  });

  // block.blobbasefee has no BCH analogue (no EIP-4844 blobs); it aliases block.basefee (a real, non-zero
  // base fee) rather than 0, which would zero out / divide-by-zero downstream computations.
  it('block.blobbasefee aliases block.basefee (identical bytecode + registers)', () => {
    const base = compileString('contract A(){ function f(int e){ require(block.basefee == e); } }');
    const blob = compileString('contract B(){ function f(int e){ require(block.blobbasefee == e); } }');
    expect(blob.bytecode).toEqual(base.bytecode);
    expect(blob.stateLayout?.variables.map((v) => v.name) ?? []).not.toContain('__blockOracleOwner');
    expect(blob.abi.map((fn) => fn.name)).not.toContain('__updateBlockOracle');
  });

  // block.gaslimit + gasleft() are fixed shims (1000000): BCH has no gas metering. A constant (not 0/revert)
  // keeps ported gas-budget checks running; the compiler warns. 1000000 = 0x40420f.
  it('block.gaslimit and gasleft() lower to the fixed shim 1000000 (no oracle)', () => {
    const gl = compileString('contract A(){ function f(int e){ require(block.gaslimit == e); } }');
    const gf = compileString('contract B(){ function f(int e){ require(gasleft() == e); } }');
    expect(gl.bytecode).toContain('40420f'); // 1000000 little-endian
    expect(gf.bytecode).toContain('40420f');
    expect(gl.usesBlockOracle).toBeUndefined(); // pure constant - not oracle-backed
    expect(gl.stateLayout).toBeDefined(); // a block.* read - stateful by rule
    expect(gf.stateLayout).toBeUndefined();
  });

  // block.prevrandao: no randomness on BCH. A transaction-local shim - abs(int(sha256(input[0] prevout
  // txid))), grindable by the tx-builder - with NO oracle co-spend or state. Compiler warns. It is uint256, as in
  // Solidity, so it compares against a uint256: comparing it with an int256 is a type error.
  it('block.prevrandao lowers to abs(int(sha256(input[0] prevout txid))), no oracle', () => {
    const p = compileString('contract A(){ function f(uint256 e){ require(block.prevrandao % 6 == e); } }');
    expect(p.bytecode).toContain('OP_0 OP_OUTPOINTTXHASH OP_SHA256 OP_BIN2NUM OP_ABS');
    expect(p.usesBlockOracle).toBeUndefined(); // transaction-local - no oracle co-spend
    expect(p.stateLayout).toBeDefined(); // a block.* read - stateful by rule
  });

  it('blobhash rejects a non-zero expectation', async () => {
    await expect(spendBlob(`0x01${'00'.repeat(31)}`)).rejects.toThrow(
      'Blob.scash:1 Require statement failed at input 0 in contract Blob.scash at line 1.',
    );
  });

  it('blockhash(n) compiles with no oracle option, binds a pool and forces the contract stateful', () => {
    // A read takes a ring slot of the pool the hidden __oraclePool input binds; the statefulness rule still makes
    // a blockhash reader stateful.
    const a = compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }');
    expect(a.usesBlockhash).toBe(true);
    expect(a.constructorInputs.map((input) => input.name)).toContain('__oraclePool');
    expect(a.stateLayout).toBeDefined();
  });

  it('compiler marks usesBlockhash on a blockhash reader only', () => {
    const withBh = compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }');
    const noBh = compileString(`contract B(){ function f(){ require(blobhash(0) == ${B32_ZERO}); } }`);
    expect(withBh.usesBlockhash).toBe(true);
    expect(noBh.usesBlockhash).toBeUndefined();
  });

  it('records blockhashReads metadata (param name / computed key) for SDK auto-injection', () => {
    const direct = compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }');
    expect(direct.abi.find((fn) => fn.name === 'f')?.blockhashReads).toEqual(['bn']);

    // Computed n (any non-identifier expression) is recorded as a framed-site <computed:i> key; the SDK
    // resolves n from the auto-derivation probe trace (the covenant computes it on-stack).
    const computed = compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn + 1) == h); } }');
    expect(computed.abi.find((fn) => fn.name === 'f')?.blockhashReads).toEqual(['<computed:0>']);
  });
});

// blockhash(n) reads a ring slot of the reader's oracle pool, here the provider's, by the slot's category and flags;
// the SDK finds the slot holding n, co-spends it at the reader's blockhashOracle block-layout slot, recreates it and
// sets the locktime the read requires (tx.time >= n). blockhash forces the reader stateful.
const BH_SRC = 'contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }';

async function statefulBlockhashReader(
  provider: ReturnType<typeof createTestProvider>, source: string, state: Record<string, bigint | Uint8Array> = {},
): Promise<{ artifact: ReturnType<typeof compileString>; sc: any; categoryId: string }> {
  const artifact = compileString(source);
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, state, {
    saltContract: true,
  });
  return { artifact, sc: StatefulContract.withCategory(contract, categoryId), categoryId };
}

describe('blockhash(n) e2e (oracle pool slots)', () => {
  it('returns the hash the pool slot holds for n', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    const { sc } = await statefulBlockhashReader(provider, BH_SRC);
    expect((await sc.f(BigInt(n), hash).send()).txid).toMatch(TXID);
  });

  it('rejects a wrong expected hash', async () => {
    const provider = createTestProvider();
    const { n } = await allocHeight(provider);
    const { sc } = await statefulBlockhashReader(provider, BH_SRC);
    await expect(sc.f(BigInt(n), hexToBin('bb'.repeat(32))).send()).rejects.toThrow(verifyFailure);
  });

  it('resolveBlockhashCoSpend returns null for a block the ring has not reached', async () => {
    const provider = createTestProvider();
    const tip = await provider.getBlockHeight();
    expect(await resolveBlockhashCoSpend(provider, provider.oraclePoolCategory!, BigInt(tip + 1))).toBeNull();
  });

  it('resolveBlockhashCoSpend yields the slot holding n and its exact recreation at the slot lock', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    const pool = provider.oraclePoolCategory!;
    const cospend = await resolveBlockhashCoSpend(provider, pool, BigInt(n));
    expect(cospend).not.toBeNull();
    expect(cospend!.exact).toBe(true);
    expect(cospend!.locktime).toBe(n); // tx.time floor = n
    expect(cospend!.utxo.token?.category).toBe(pool);
    expect(cospend!.utxo.token?.nft?.commitment.slice(10, 74)).toBe(binToHex(hash));
    const slotLock = poolSlotLockingBytecode(hexToBin(pool));
    expect(cospend!.recreateOutput.to).toEqual(slotLock);
    expect(cospend!.recreateOutput.token).toEqual(cospend!.utxo.token);
    expect(binToHex(cospend!.unlocker.generateLockingBytecode())).toBe(binToHex(slotLock));
  });

  // Two reads in one reader, each to its own n: each identifier-arg read rides its own consecutive blockhashOracle
  // block-layout slot (the k-th read reads input[base + k]), each matched to its own slot.
  it('reads two blockhashes, each matched to its own n', async () => {
    const provider = createTestProvider();
    const a = await allocHeight(provider);
    const b = await allocHeight(provider);
    const src = 'contract B(){ function f(int x, bytes32 hx, int y, bytes32 hy){'
      + ' require(blockhash(x)==hx); require(blockhash(y)==hy); } }';
    const { artifact, sc } = await statefulBlockhashReader(provider, src);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.blockhashReads).toEqual(['x', 'y']);
    expect((await sc.f(BigInt(a.n), a.hash, BigInt(b.n), b.hash).send()).txid).toMatch(TXID);
  });
});

// FRONT-REGION + keccak: a contract that reads blockhash(n) AND hashes a COMPLEX/nested keccak arg. The
// blockhashOracle slot sits before the keccakSideCar slots, shifting the side-car base past 1 + dataNftCount.
// The complex-arg probe positions the pool slot (+ its recreation + the freshness locktime) so it can reach the
// keccak call and read each preimage off the trace at the shifted base.
describe('keccak256 + blockhash front-region (stateful)', () => {
  const KC = 'ee'.repeat(31) + '11'; // side-car own NFT category
  const SRC = 'contract B(){ int c;'
    + ' function f(int bn, bytes32 bh, bytes p, bytes32 e){'
    + ' require(blockhash(bn) == bh); require(keccak256(keccak256(p)) == e); this.c = this.c + 1; } }';

  it('resolves a nested keccak alongside a blockhash read (front-region slot before the side-cars)', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    const { artifact, sc, categoryId } = await statefulBlockhashReader(provider, SRC, { c: 0n });
    // The keccak side-car base is shifted past the data NFT count by the blockhashOracle slot.
    const fnAbi = artifact.abi.find((f) => f.name === 'f');
    expect(fnAbi?.blockhashReads).toEqual(['bn']);
    expect(fnAbi?.keccakPreimageParams).toEqual([null, 'p']);
    const kSlots = fnAbi?.blockLayout?.slots.filter((slot) => slot.kind === 'keccakSideCar') ?? [];
    const dataNftCount = fnAbi?.blockLayout?.slots.filter((slot) => slot.kind === 'dataNft').length ?? 0;
    expect(kSlots[0].offset).toBeGreaterThan(1 + dataNftCount); // a front-region slot precedes it

    // Two branded keccak side-cars (nested = two calls).
    const scLock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
    for (let i = 0; i < 2; i++) {
      await provider.addUtxo(scLock, {
        txid: (0xc0 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: KC, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const preimage = hexToBin('34'.repeat(20));
    const expected = keccak_256(keccak_256(preimage)); // keccak(keccak(p))
    expect((await sc.f(BigInt(n), hash, preimage, expected).send()).txid).toMatch(TXID);
  });

  // Dynamic keccak LOOP alongside a blockhash read: the trailing side-car region starts at blockSize (which now
  // includes the blockhashOracle slot). The loop probe positions the slot so the trailing base is right.
  const LOOP_SRC = 'contract L(){ bytes32 acc;'
    + ' function run(int bn, bytes32 bh, bytes32 x, int rounds, bytes32 target){'
    + ' require(blockhash(bn) == bh); bytes32 h = x;'
    + ' for (int i = 0; i < rounds; i++) { h = keccak256(h); } require(h == target); this.acc = h; } }';

  it('resolves a dynamic keccak loop alongside a blockhash read (trailing base past the oracle slot)', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    const seed = hexToBin('56'.repeat(32));
    let target = seed; for (let i = 0; i < 3; i++) target = keccak_256(target);
    const { artifact, sc, categoryId } = await statefulBlockhashReader(provider, LOOP_SRC, { acc: seed });
    expect(artifact.abi.find((f) => f.name === 'run')?.keccakLoopReads).toBe(true);
    const scLock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
    for (let i = 0; i < 5; i++) {
      await provider.addUtxo(scLock, {
        txid: (0xd0 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: KC, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    expect((await sc.run(BigInt(n), hash, seed, 3n, target).send()).txid).toMatch(TXID);
  });
});

// Stateful blockhash reader: the slot co-spend rides a block-layout slot (not a trailing append), and the index param
// is filled deterministically (master input index + slot offset).
const BH_STATEFUL_SRC = `
pragma solidcash >=0.8.0;
contract BH() {
    bigint counter;
    function bump(int bn, bytes32 h) {
        this.counter = this.counter + 1;
        require(blockhash(bn) == h);
    }
}
`;

describe('blockhash(n) stateful reader', () => {
  it('reads blockhash from a stateful function via the block-layout slot', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    const { sc } = await statefulBlockhashReader(provider, BH_STATEFUL_SRC, { counter: 5n });
    expect((await sc.bump(BigInt(n), hash).send()).txid).toMatch(TXID);
  });
});

// A computed read whose n is not a call arg: the compiler records a framed-site <computed:i> key (own slot); the SDK
// extracts n from the auto-derivation probe trace (the covenant computes it on-stack), then co-spends the slot for
// it. n is never re-derived in JS.
describe('blockhash(x - 1) computed read (probe-trace extraction)', () => {
  it('extracts n from an arbitrary param expression', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    const src = 'contract B(){ function f(int x, bytes32 h){ require(blockhash(x - 1) == h); } }';
    const { artifact, sc } = await statefulBlockhashReader(provider, src);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.blockhashReads).toEqual(['<computed:0>']);
    expect((await sc.f(BigInt(n) + 1n, hash).send()).txid).toMatch(TXID);
  });
});

// tx.gasprice: the CURRENT transaction's realized fee rate (sat/KB) = 1000*(sum in - sum out)/tx_size,
// reconstructed entirely from introspection (no oracle): value loops for the fee, bytecode-size loops +
// fixed per-element overheads for the size. See block-and-transaction-properties.md.
describe('tx.gasprice (current-tx fee rate, sat/KB)', () => {
  it('lowers to the fee/size formula via introspection loops, no oracle', () => {
    const g = compileString('contract A(){ function f(int e){ require(tx.gasprice == e); } }');
    expect(g.bytecode).toContain('OP_UTXOVALUE');                       // sum input sats
    expect(g.bytecode).toContain('OP_OUTPUTVALUE');                     // sum output sats
    expect(g.bytecode).toContain('OP_INPUTBYTECODE OP_SIZE OP_NIP');    // sum unlocking-script lengths
    expect(g.bytecode).toContain('OP_OUTPUTBYTECODE OP_SIZE OP_NIP');   // sum locking-script lengths
    expect(g.bytecode).toContain('e803 OP_MUL');                        // * 1000
    expect(g.bytecode).toContain('OP_DIV');                             // / size
    expect(g.stateLayout).toBeUndefined();                             // current tx only - no oracle register
  });

  it('computes a positive fee rate on a real spend (loops + introspection execute on the VM)', async () => {
    const provider = createTestProvider();
    const artifact = compileString('contract A(){ function f(){ require(tx.gasprice >= 1); } }');
    const contract = new Contract(artifact, [], { provider });
    const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    const feeFunder = await createFeeFunder(provider, 20000n);
    const tx = await new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.f())
      .addInput(feeFunder.utxo, feeFunder.unlocker)
      .addOutput({ to: contract.address, amount: 110000n }) // in 120000 - out 110000 = 10000 sat fee
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
