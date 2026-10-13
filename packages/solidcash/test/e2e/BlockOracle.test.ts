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
import { Utxo } from '../../src/interfaces.js';
import {
  createTestProvider, createFeeFunder, setupStatefulUtxos, fundedSigner,
} from '../test-util.js';
import { alicePriv, bobPriv, aliceAddress } from '../fixture/vars.js';
import {
  buildBlockhashOracleCovenantScript, blockhashOracleLockingBytecode,
  buildBlockhashCommitment, scriptToBytecode, encodeInt, keccakComputeLockingBytecode,
} from '@solidcash/utils';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { BlockOracleUpdater, fetchBlockOracleFields, RpcLike } from '../../src/oracle/blockOracleUpdater.js';

const preflightFailure = (reason: string): string =>
  `messageBus: BCH-2026 preflight failed at input 0: ${reason}`;
const verifyFailure = preflightFailure('Program failed an OP_VERIFY operation.');
// The mock VM names the failing opcode. BCHN evaluates CLTV under NON-mandatory (policy) script flags during
// mempool acceptance and reports the unsatisfied locktime instead. Both forms prove the CLTV gate, and nothing
// weaker is accepted: a plain OP_VERIFY rejection would not match either branch.
const finalCltvFailure = new RegExp(
  'mandatory-script-verify-flag-failed .*error in evaluating input index 0: '
  + 'Program called an OP_CHECKLOCKTIMEVERIFY operation'
  + '|non-mandatory-script-verify-flag \\(Locktime requirement not satisfied\\)',
);

// A fixed category used only where the oracle address is expected to be EMPTY (no NFT seeded), so its value is
// immaterial. Seeded NFTs get a real genesis category (see seedOracleNfts) which the reader is compiled with.
const BH_CAT = 'cc'.repeat(32);

// Allocate a block height for a height-mode locktime test: mine (1 + headroom) blocks and take the first freshly
// mined height, so addr(n) is unique and the locktime n (+headroom, e.g. n+256 for a wipe/sweep) is final under
// the new tip. hash is that block's hash. Uniform across providers: the mock advances a simulated tip.
async function allocHeight(
  provider: ReturnType<typeof createTestProvider>, headroom = 0,
): Promise<{ n: number; hash: Uint8Array }> {
  const before = await provider.getBlockHeight();
  await provider.mine(1 + headroom);
  const n = before + 1;
  return { n, hash: hexToBin(await provider.getBlockHash(n)) };
}

interface OraclePair { n: bigint; hash: Uint8Array; satoshis?: bigint; capability?: 'none' | 'minting' }

// One lock per master category. Standalone covenant tests use BH_CAT; a reader passes its own category so
// the NFT category matches the master.
let blockhashNonce = 0;

async function seedOracleNfts(
  provider: ReturnType<typeof createTestProvider>, pairs: OraclePair[], category = BH_CAT,
): Promise<{ cat: string; entries: { addrN: Uint8Array; utxo: Utxo }[] }> {
  const lock = blockhashOracleLockingBytecode(hexToBin(category));
  const entries = [];
  for (const pair of pairs) {
    blockhashNonce += 1;
    const utxo = await provider.addUtxo(binToHex(lock), {
      txid: blockhashNonce.toString(16).padStart(64, '0'),
      vout: 0,
      satoshis: pair.satoshis ?? 1000n,
      token: {
        category,
        amount: 0n,
        nft: {
          capability: pair.capability ?? 'none',
          commitment: binToHex(buildBlockhashCommitment(pair.n, pair.hash)),
        },
      },
    });
    entries.push({ addrN: lock, utxo });
  }
  return { cat: category, entries };
}

async function seedOracleNft(
  provider: ReturnType<typeof createTestProvider>, n: bigint, hash: Uint8Array,
  opts: { satoshis?: bigint; capability?: 'none' | 'minting'; category?: string } = {},
): Promise<{ cat: string; addrN: Uint8Array; utxo: Utxo }> {
  const { cat, entries } = await seedOracleNfts(
    provider, [{ n, hash, ...opts }], opts.category,
  );
  return { cat, addrN: entries[0].addrN, utxo: entries[0].utxo };
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

// Oracle-backed block.* reads slice one shared covenant commitment. The reader is stateless. Values are
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

function seedBlock(provider: ReturnType<typeof createTestProvider>): void {
  if (!('setBlockOracleFields' in provider)) return;
  provider.setBlockOracleFields({
    number: BLOCK.number,
    timestamp: BLOCK.timestamp,
    difficulty: BLOCK.difficulty,
    size: BLOCK.size,
    totalFees: BLOCK.totalFees,
    coinbase: BLOCK.coinbase,
  });
}

async function spendReader(
  number: bigint, timestamp: bigint, difficulty: bigint, size: bigint, fees: bigint, basefee: bigint,
  coinbase: Uint8Array,
): Promise<string> {
  const provider = createTestProvider();
  seedBlock(provider);
  const contract = new Contract(compileString(ORACLE_READER), [], { provider });
  const utxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
  const feeFunder = await createFeeFunder(provider, 20000n);
  const tx = await new TransactionBuilder({ provider })
    .addInput(utxo, contract.unlock.check(number, timestamp, difficulty, size, fees, basefee, coinbase))
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: contract.address, amount: 110000n })
    .send();
  return tx.txid;
}

describe('block.* oracle reads e2e', () => {
  const artifact = compileString(ORACLE_READER);

  it('publishes a lock pin and no per-contract register', () => {
    expect(artifact.usesBlockOracle).toBe(true);
    expect(artifact.blockOracleLockSlots?.length).toBeGreaterThan(0);
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
    seedBlock(provider);
    const contract = new Contract(compileString(INTERNAL_READER), [], { provider });
    const utxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    const feeFunder = await createFeeFunder(provider, 20000n);
    const tx = await new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.check(expected))
      .addInput(feeFunder.utxo, feeFunder.unlocker)
      .addOutput({ to: contract.address, amount: 110000n })
      .send();
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

// The owner is the first 20 bytes of the oracle commitment. An update is a spend of that covenant, signed by
// the key named there, with tx.time >= the new block number. It is not a function of the reader.
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
    if (!('blockOracleOwnerKey' in provider)) return;
    const contract = new Contract(compileString(READ_BACK), [], { provider });
    const updater = new BlockOracleUpdater({
      contract, categoryId: '00'.repeat(32), keeperKey: provider.blockOracleOwnerKey, rpc: fakeRpc(100000),
    });
    // The oracle starts at the tip, and a rewind is refused (audit CRYPTO-5). A height update keeps the
    // timestamp (audit CRYPTO-6).
    provider.setBlockOracleFields({
      number: 99_999n, timestamp: 1700000000n, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin('00'),
    });
    const txid = await updater.pushUpdate({
      number: 100000n, timestamp: 1700000000n, difficulty: 0n, size: 1n, totalFees: 0n,
      coinbase: hexToBin('00'),
    });
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
    const utxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    const feeFunder = await createFeeFunder(provider, 20000n);
    const tx = await new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.readBack(100000n, 1700000000n))
      .addInput(feeFunder.utxo, feeFunder.unlocker)
      .addOutput({ to: contract.address, amount: 110000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects an update not signed by the owner', async () => {
    const provider = createTestProvider();
    if (!('blockOracleOwnerKey' in provider)) return;
    const contract = new Contract(compileString(READ_BACK), [], { provider });
    const impostor = new BlockOracleUpdater({
      contract, categoryId: '00'.repeat(32), keeperKey: bobPriv, rpc: fakeRpc(100000),
    });
    await expect(impostor.pushUpdate({
      number: 100000n, timestamp: 1700000000n, difficulty: 0n, size: 1n, totalFees: 0n,
      coinbase: hexToBin('00'),
    })).rejects.toThrow(/OP_VERIFY|EQUALVERIFY|NULLFAIL|signature/);
  });

  it('rejects an over-reported height (nLocktime < number violates the freshness bound)', async () => {
    const provider = createTestProvider();
    if (!('blockOracleOwnerKey' in provider)) return;
    const contract = new Contract(compileString(READ_BACK), [], { provider });
    const updater = new BlockOracleUpdater({
      contract, categoryId: '00'.repeat(32), keeperKey: provider.blockOracleOwnerKey, rpc: fakeRpc(100000),
    });
    // One past the tip: not below the stored number (the rewind check runs first), but above nLocktime.
    const tip = await provider.getBlockHeight();
    await expect(updater.pushUpdate({
      number: BigInt(tip + 1), timestamp: await updater.oracleTimestamp(), difficulty: 0n, size: 1n, totalFees: 0n,
      coinbase: hexToBin('00'),
    }, tip)).rejects.toThrow(/CHECKLOCKTIMEVERIFY|Locktime requirement not satisfied/);
  });
});

// Off-chain keeper: a fake BCHN JSON-RPC (one getblock verbosity-2 call inlines the coinbase tx). Height
// is 100000 so the freshness tx.time >= number is final under the mock tip; subsidy(100000) = 50 BCH, so a
// coinbase output of 50.00031792 BCH yields totalFees = 31792 sats. Drives the keeper through a real
// signed update of the on-chain registers.
const CB_HEX = '76a914f1c075a01882ae0972f95d3a4177c86c852b7d9188ac';
const FAKE_BLOCK = {
  height: 100000, time: 1782384635, bits: '18026c88', size: 9075,
  tx: [{ vout: [{ value: 50.00031792, scriptPubKey: { hex: CB_HEX } }] }],
};
function fakeRpc(tip = 100000, height = tip, mediantime?: number): RpcLike {
  // The known-block fixture data (coinbase/fees) stays fixed; only the height varies so the on-chain update is
  // final on a live chain. height < the mainnet halving (210000) keeps subsidy(height)=50 BCH, so totalFees
  // still resolves to 31792 - real regtest coinbase would follow regtest's own halving and break that math.
  const block = { ...FAKE_BLOCK, height, ...(mediantime === undefined ? {} : { mediantime }) };
  return {
    request: async (method: string, ...params: any[]) => {
      switch (method) {
        case 'getblockcount': return tip;
        case 'getblockhash': return `hash_${params[0]}`;
        case 'getblock': return block;
        default: throw new Error(`unexpected rpc ${method}`);
      }
    },
  };
}

const ORACLE_FULL = `
contract BlockOracleFull() {
    function touch(bytes expectCb) {
        require(block.number >= 0);
        require(block.timestamp >= 0);
        require(block.difficulty >= 0);
        require(block.size >= 0);
        require(block.totalFees >= 0);
        require(block.coinbase == expectCb);
    }
}`;

describe('block.* off-chain keeper (updater)', () => {
  it('fetchBlockOracleFields extracts all six fields from BCHN rpc', async () => {
    expect(await fetchBlockOracleFields(fakeRpc(), 'h')).toEqual({
      number: 100000n, timestamp: 1782384635n, difficulty: 0x18026c88n,
      size: 9075n, totalFees: 31792n, coinbase: hexToBin(CB_HEX),
    });
  });

  it('pushes a signed update when the chain is ahead, then is a no-op when caught up', async () => {
    const provider = createTestProvider();
    if (!('setBlockOracleFields' in provider)) return;
    provider.setBlockOracleFields({
      number: 100n, timestamp: 1n, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin(CB_HEX),
    });
    const contract = new Contract(compileString(ORACLE_FULL), [], { provider });
    const updater = new BlockOracleUpdater({
      contract, categoryId: '00'.repeat(32), keeperKey: provider.blockOracleOwnerKey, rpc: fakeRpc(133700),
    });
    expect(await updater.oracleHeight()).toBe(100n);

    const txid = await updater.syncOnce();
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await updater.oracleHeight()).toBe(133700n);

    expect(await updater.syncOnce()).toBeNull();
  });

  it('moves the timestamp in its own time-type update, to the last final second (audit CRYPTO-6)', async () => {
    const provider = createTestProvider();
    if (!('setBlockOracleFields' in provider)) return;
    provider.setBlockOracleFields({
      number: 100n, timestamp: 1_699_000_000n, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin(CB_HEX),
    });
    const contract = new Contract(compileString(ORACLE_FULL), [], { provider });
    // The mock stamps its last 11 headers with the tip time, so that is its median time past.
    const medianTime = provider.getBlockTime();
    const updater = new BlockOracleUpdater({
      contract, categoryId: '00'.repeat(32), keeperKey: provider.blockOracleOwnerKey,
      rpc: fakeRpc(133700, 133700, medianTime),
    });
    expect(await updater.syncOnce()).toMatch(/^[0-9a-f]{64}$/);
    expect(await updater.oracleHeight()).toBe(133700n);
    expect(await updater.oracleTimestamp()).toBe(BigInt(medianTime - 1));
    expect(await updater.syncOnce()).toBeNull();
  });

  it('rejects a keeper that is not the commitment owner', async () => {
    const provider = createTestProvider();
    if (!('setBlockOracleFields' in provider)) return;
    provider.setBlockOracleFields({
      number: 100n, timestamp: 1n, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: hexToBin(CB_HEX),
    });
    const contract = new Contract(compileString(ORACLE_FULL), [], { provider });
    const impostor = new BlockOracleUpdater({
      contract, categoryId: '00'.repeat(32), keeperKey: bobPriv, rpc: fakeRpc(133700),
    });
    await expect(impostor.syncOnce()).rejects.toThrow(/OP_VERIFY|EQUALVERIFY|NULLFAIL|signature/);
  });
});

// blobhash(i) has no BCH analogue (no EIP-4844 blobs) -> always bytes32(0); blockhash(n) is recognized
// but its n->hash oracle read codegen is pending (docs/block-and-transaction-properties.md s11).
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
  it('block.gaslimit and gasleft() lower to the fixed shim 1000000 (no oracle state)', () => {
    const gl = compileString('contract A(){ function f(int e){ require(block.gaslimit == e); } }');
    const gf = compileString('contract B(){ function f(int e){ require(gasleft() == e); } }');
    expect(gl.bytecode).toContain('40420f'); // 1000000 little-endian
    expect(gf.bytecode).toContain('40420f');
    expect(gl.stateLayout).toBeUndefined(); // pure constant - not oracle-backed, no state
    expect(gf.stateLayout).toBeUndefined();
  });

  // block.prevrandao: no randomness on BCH. A transaction-local shim - abs(int(sha256(input[0] prevout
  // txid))), grindable by the tx-builder - with NO oracle co-spend or state. Compiler warns. It is uint256, as in
  // Solidity, so it compares against a uint256: comparing it with an int256 is a type error.
  it('block.prevrandao lowers to abs(int(sha256(input[0] prevout txid))), no oracle', () => {
    const p = compileString('contract A(){ function f(uint256 e){ require(block.prevrandao % 6 == e); } }');
    expect(p.bytecode).toContain('OP_0 OP_OUTPOINTTXHASH OP_SHA256 OP_BIN2NUM OP_ABS');
    expect(p.stateLayout).toBeUndefined(); // transaction-local - no oracle register
  });

  it('blobhash rejects a non-zero expectation', async () => {
    await expect(spendBlob(`0x01${'00'.repeat(31)}`)).rejects.toThrow(
      'Blob.scash:1 Require statement failed at input 0 in contract Blob.scash at line 1.',
    );
  });

  it('blockhash(n) compiles with no oracle option and forces the contract stateful', () => {
    // The (n->hash) oracle is branded to the contract's OWN category (master-bound, docs s3) - no compile
    // option. Using blockhash therefore makes the contract stateful (it needs a master/category to anchor).
    const a = compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }');
    expect(a.usesBlockhash).toBe(true);
    expect(a.stateLayout).toBeDefined();
  });

  it('compiler marks usesBlockhash so the keeper maintains the (n->hash) oracle', () => {
    const withBh = compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }');
    const noBh = compileString(`contract B(){ function f(){ require(blobhash(0) == ${B32_ZERO}); } }`);
    expect(withBh.usesBlockhash).toBe(true);
    expect(BlockOracleUpdater.usesBlockhash(withBh)).toBe(true);
    expect(noBh.usesBlockhash).toBeUndefined();
    expect(BlockOracleUpdater.usesBlockhash(noBh)).toBe(false);
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

// blockhash(n) MVP read: the (n->hash) oracle UTXO is co-spent as the LAST input (category C_oracle +
// commitment n(4 LE)||hash); the contract verifies category + commitment.n == n + require(tx.time >= n)
// and returns hash. Held here at a trivial anyone-can-spend p2sh32 (redeem OP_1) and recreated for token
// consistency. n <= 133700 (mock tip) so the freshness locktime is final. (Hardened covenant + SDK
// auto-discovery + keeper minting are the next increment - docs/block-and-transaction-properties.md s11.)

async function spendBlockhash(
  provider: ReturnType<typeof createTestProvider>,
  argN: number, storedN: number, storedHash: Uint8Array, expectHash: Uint8Array,
): Promise<string> {
  // The (n->hash) oracle is BRANDED to the contract's own category (master-bound, docs s3). Seed the reader's
  // master AND the oracle NFT (at addr(storedN)) under ONE category, then read via StatefulContract - it
  // resolves + co-spends the oracle by the contract's categoryId at the blockhashOracle block-layout slot and
  // sets the locktime. blockhash forces the reader stateful, so it has a master/category to anchor the oracle.
  const artifact = compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }');
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {}, {
    saltContract: true,
  });
  await seedOracleNft(provider, BigInt(storedN), storedHash, { category: categoryId });
  const sc = StatefulContract.withCategory(contract, categoryId);
  const tx = await sc.f(BigInt(argN), expectHash).send();
  return tx.txid;
}

// Wipe path: after n+256 anyone may consume (burn) the (n->hash) UTXO; before n+256 the CLTV blocks it.
async function wipeBlockhash(
  provider: ReturnType<typeof createTestProvider>, storedN: number, locktime: number,
): Promise<string> {
  const { cat, addrN, utxo } = await seedOracleNft(provider, BigInt(storedN), new Uint8Array(32), { satoshis: 5000n });
  const redeem = scriptToBytecode(buildBlockhashOracleCovenantScript(hexToBin(cat)));
  const wipeUnlock = scriptToBytecode([encodeInt(1n), redeem]); // flag 1 (wipe) + redeem
  const unlocker = { generateLockingBytecode: () => addrN, generateUnlockingBytecode: () => wipeUnlock };
  const tx = await new TransactionBuilder({ provider, allowImplicitNftBurn: true })
    .addInput(utxo, unlocker)
    .addOutput({ to: aliceAddress, amount: 4000n })
    .setLocktime(locktime)
    .send();
  return tx.txid;
}

describe('blockhash(n) e2e (real (n->hash) covenant)', () => {
  it('returns the attested hash for a matching (n, hash) oracle UTXO', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    expect(await spendBlockhash(provider, n, n, hash, hash)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong expected hash', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    await expect(spendBlockhash(provider, n, n, hash, hexToBin('bb'.repeat(32))))
      .rejects.toThrow(verifyFailure);
  });

  it('rejects an oracle UTXO whose commitment.n != the requested n', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    await expect(spendBlockhash(provider, n, n - 1, hash, hash))
      .rejects.toThrow(/blockhash\((\d+)\): no \(n->hash\) oracle UTXO for block \1/);
  });

  it('anyone may wipe the (n->hash) UTXO at or after n+256', async () => {
    const provider = createTestProvider();
    const { n } = await allocHeight(provider, 256); // mine headroom so n+256 <= tip
    expect(await wipeBlockhash(provider, n, n + 256)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wipe before n+256 (CLTV blocks early cleanup)', async () => {
    const provider = createTestProvider();
    const { n } = await allocHeight(provider, 256);
    await expect(wipeBlockhash(provider, n, n + 255)).rejects.toThrow(finalCltvFailure);
  });

  it('resolveBlockhashCoSpend returns null when no UTXO sits at addr(n)', async () => {
    const provider = createTestProvider();
    const { n } = await allocHeight(provider); // a fresh height whose addr(n) is empty
    expect(await resolveBlockhashCoSpend(provider, BH_CAT, BigInt(n))).toBeNull();
  });

  it('resolveBlockhashCoSpend yields the live UTXO + a matching self-preserving recreate', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    const bn = BigInt(n);
    const { cat, addrN } = await seedOracleNft(provider, bn, hash);
    const token = {
      category: cat, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(buildBlockhashCommitment(bn, hash)) },
    };

    const cospend = await resolveBlockhashCoSpend(provider, cat, bn);
    expect(cospend).not.toBeNull();
    expect(cospend!.locktime).toBe(n); // tx.time floor = n
    expect(cospend!.recreateOutput.to).toEqual(addrN); // recreate at addr(n)
    expect(cospend!.recreateOutput.token).toEqual(token); // identity preserved
    expect(binToHex(cospend!.unlocker.generateLockingBytecode())).toBe(binToHex(addrN));
  });
});

// Auto-injection: StatefulContract reads abi.blockhashReads + the call args, resolves addr(n) under the
// contract's OWN (branded) category, and co-spends the (n->hash) oracle at its block-layout slot + recreates
// it read-only - no manual wiring. The base TransactionBuilder path is intentionally gone (blockhash forces
// the contract stateful, so the read must ride the master co-spend; see docs section 3).
describe('blockhash(n) auto-injection (StatefulContract)', () => {
  const H = hexToBin('aa'.repeat(32));
  const SRC = 'contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }';

  it('auto-co-spends the (n->hash) oracle from the call args (no manual wiring)', async () => {
    const provider = createTestProvider();
    const { n } = await allocHeight(provider);
    expect(await spendBlockhash(provider, n, n, H, H)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('errors clearly when no (n->hash) UTXO exists at addr(n)', async () => {
    const provider = createTestProvider();
    const { n } = await allocHeight(provider); // a fresh height whose addr(n) is empty
    const artifact = compileString(SRC);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, {}, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect((sc as any).f(BigInt(n), H).send()).rejects.toThrow(/no \(n->hash\) oracle UTXO/i);
  });

  // Two reads in one reader, each to its own n: each DISTINCT identifier-arg read rides its OWN consecutive
  // blockhashOracle block-layout slot (the k-th read reads input[base + k]); both oracles (same branded
  // category) are co-spent + recreated read-only, each matched to its own commitment.n.
  it('reads two blockhashes, each matched to its own n', async () => {
    const provider = createTestProvider();
    const a = await allocHeight(provider);
    const b = await allocHeight(provider);
    const n1 = BigInt(a.n); const n2 = BigInt(b.n);
    const H1 = hexToBin('11'.repeat(32)); const H2 = hexToBin('22'.repeat(32));
    const src = 'contract B(){ function f(int x, bytes32 hx, int y, bytes32 hy){'
      + ' require(blockhash(x)==hx); require(blockhash(y)==hy); } }';
    const artifact = compileString(src);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.blockhashReads).toEqual(['x', 'y']);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {}, {
      saltContract: true,
    });
    await seedOracleNft(provider, n1, H1, { category: categoryId });
    await seedOracleNft(provider, n2, H2, { category: categoryId });
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await (sc as any).f(n1, H1, n2, H2).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

// FRONT-REGION + keccak: a contract that reads blockhash(n) AND hashes a COMPLEX/nested keccak arg. The
// blockhashOracle slot sits before the keccakSideCar slots, shifting the side-car base past 1 + dataNftCount.
// The complex-arg probe positions the blockhash oracle (+ its self-preserving recreation + the freshness
// locktime) so it can reach the keccak call and read each preimage off the trace at the shifted base.
describe('keccak256 + blockhash front-region (stateful)', () => {
  const KC = 'ee'.repeat(32); // side-car own NFT category
  const SRC = 'contract B(){ int c;'
    + ' function f(int bn, bytes32 bh, bytes p, bytes32 e){'
    + ' require(blockhash(bn) == bh); require(keccak256(keccak256(p)) == e); this.c = this.c + 1; } }';

  it('resolves a nested keccak alongside a blockhash read (front-region slot before the side-cars)', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    const artifact = compileString(SRC);
    // The keccak side-car base is shifted past the data NFT count by the blockhashOracle slot.
    const fnAbi = artifact.abi.find((f) => f.name === 'f');
    expect(fnAbi?.blockhashReads).toEqual(['bn']);
    expect(fnAbi?.keccakPreimageParams).toEqual([null, 'p']);
    const kSlots = fnAbi?.blockLayout?.slots.filter((s) => s.kind === 'keccakSideCar') ?? [];
    const dataNftCount = fnAbi?.blockLayout?.slots.filter((s) => s.kind === 'dataNft').length ?? 0;
    expect(kSlots[0].offset).toBeGreaterThan(1 + dataNftCount); // a front-region slot precedes it

    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, { c: 0n }, {
      saltContract: true,
    });
    await seedOracleNft(provider, BigInt(n), hash, { category: categoryId });
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
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await (sc as any).f(BigInt(n), hash, preimage, expected).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // Dynamic keccak LOOP alongside a blockhash read: the trailing side-car region starts at blockSize (which now
  // includes the blockhashOracle slot). The loop probe positions the oracle so the trailing base is right.
  const LOOP_SRC = 'contract L(){ bytes32 acc;'
    + ' function run(int bn, bytes32 bh, bytes32 x, int rounds, bytes32 target){'
    + ' require(blockhash(bn) == bh); bytes32 h = x;'
    + ' for (int i = 0; i < rounds; i++) { h = keccak256(h); } require(h == target); this.acc = h; } }';

  it('resolves a dynamic keccak loop alongside a blockhash read (trailing base past the oracle slot)', async () => {
    const provider = createTestProvider();
    const { n, hash } = await allocHeight(provider);
    const artifact = compileString(LOOP_SRC);
    expect(artifact.abi.find((f) => f.name === 'run')?.keccakLoopReads).toBe(true);
    const contract = new Contract(artifact, [], { provider });
    const seed = hexToBin('56'.repeat(32));
    let target = seed; for (let i = 0; i < 3; i++) target = keccak_256(target);
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, { acc: seed }, {
      saltContract: true,
    });
    await seedOracleNft(provider, BigInt(n), hash, { category: categoryId });
    const scLock = binToHex(keccakComputeLockingBytecode(hexToBin(categoryId).slice().reverse(), true));
    for (let i = 0; i < 5; i++) {
      await provider.addUtxo(scLock, {
        txid: (0xd0 + i).toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 100_000n,
        token: { category: KC, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await (sc as any).run(BigInt(n), hash, seed, 3n, target).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

// Keeper minting: spend a C_oracle minting master to mint the (n,hash) oracle UTXO at addr(n). Master held
// at a trivial anyone-can-spend p2sh32 (OP_1) for the test; production gates it on the keeper key.
const MASTER_LBC = hexToBin('aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087');
const MASTER_UNLOCK = hexToBin('0151');

describe('blockhash keeper minting', () => {
  it('mints a valid (n,hash) oracle UTXO from the C_oracle master, read back via blockhash', async () => {
    const provider = createTestProvider();
    const { n: height } = await allocHeight(provider);
    const n = BigInt(height);
    const H = hexToBin('cd'.repeat(32));

    // The minting baton carries the consumer's own category, so the minted hash NFT matches the master.
    const artifact = compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }');
    const consumer = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, consumer, artifact.stateLayout!, {}, {
      saltContract: true,
    });
    const batonUtxo = await provider.addUtxo(binToHex(MASTER_LBC), {
      txid: 'a1'.repeat(32), vout: 0, satoshis: 10000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    });

    const updater = new BlockOracleUpdater({
      contract: consumer, categoryId, keeperKey: alicePriv, rpc: fakeRpc(),
      blockhashOracleCategory: categoryId,
      blockhashOracleMaster: {
        utxo: batonUtxo,
        unlocker: { generateLockingBytecode: () => MASTER_LBC, generateUnlockingBytecode: () => MASTER_UNLOCK },
      },
    });

    const mintTxid = await updater.mintBlockhashPair(n, H);
    expect(mintTxid).toMatch(/^[0-9a-f]{64}$/);

    // The minted (n->hash) NFT lives at addr_C(n); the consumer reads it via its block-layout slot.
    const sc = StatefulContract.withCategory(consumer, categoryId);
    const tx = await (sc as any).f(n, H).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

function sweepUpdater(provider: ReturnType<typeof createTestProvider>, cat: string = BH_CAT): BlockOracleUpdater {
  const consumer = new Contract(
    compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }', { blockhashOracleCategory: cat }),
    [], { provider },
  );
  return new BlockOracleUpdater({
    contract: consumer, categoryId: '00'.repeat(32), keeperKey: alicePriv, rpc: fakeRpc(), blockhashOracleCategory: cat,
  });
}

describe('blockhash keeper sweep', () => {
  it('wipes the (n->hash) pair that aged out of the window and reclaims the dust', async () => {
    const provider = createTestProvider();
    const { n: height } = await allocHeight(provider, 256); // mine headroom so n+256 <= tip
    const n = BigInt(height);
    const { cat, addrN, utxo } = await seedOracleNft(provider, n, hexToBin('ab'.repeat(32)), { satoshis: 2000n });
    // A previous failed wipe can leave another valid pair at the same branded address on persistent providers.
    // The keeper intentionally sweeps every pair there; prove this fixture's freshly seeded output is included.
    expect(await provider.getUtxosForLockingBytecode(addrN)).toContainEqual(expect.objectContaining({
      txid: utxo.txid, vout: utxo.vout,
    }));

    const txid = await sweepUpdater(provider, cat).sweepBlockhashPair(n);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await provider.getUtxosForLockingBytecode(addrN)).toHaveLength(0);
  });

  it('returns null when there is nothing to sweep at addr(n)', async () => {
    const provider = createTestProvider();
    const { n } = await allocHeight(provider); // a fresh height whose addr(n) is empty
    expect(await sweepUpdater(provider).sweepBlockhashPair(BigInt(n))).toBeNull();
  });
});

// Stateful blockhash reader: the (n->hash) co-spend rides a block-layout slot (not a trailing append), and
// the index param is filled deterministically (master input index + slot offset).
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
    const { n: height } = await allocHeight(provider);
    const n = BigInt(height); const H = hexToBin('aa'.repeat(32));
    const artifact = compileString(BH_STATEFUL_SRC);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 5n },
      { saltContract: true },
    );
    await seedOracleNft(provider, n, H, { category: categoryId });

    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await (sc as any).bump(n, H).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

// blockhash(block.number - K): a computed read whose n is NOT a call arg. The compiler records a framed-site
// <computed:i> key (own oracle slot); the SDK resolves n by extracting it from the auto-derivation probe trace
// (the covenant computes block.number - K on-stack from the co-spent __block_number register), then co-spends
// the (n->hash) oracle for it. Single source of truth - n is never re-derived in JS.
describe('blockhash(block.number - K) computed read (probe-trace extraction)', () => {
  it('extracts n from the covenant trace and co-spends the block.number - 1 oracle', async () => {
    const provider = createTestProvider();
    const oracle = await allocHeight(provider); // the (n->hash) oracle block; set block.number = n + 1
    const n = BigInt(oracle.n);
    const H = hexToBin('cd'.repeat(32));
    const src = 'contract B(){ function f(bytes32 h){ require(blockhash(block.number - 1) == h); } }';
    const artifact = compileString(src);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.blockhashReads).toEqual(['<computed:0>']);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {}, {
      saltContract: true,
    });
    await seedOracleNft(provider, n, H, { category: categoryId });
    // allocHeight left the info oracle at n. One more block makes block.number = n + 1, so
    // blockhash(block.number - 1) is the pair seeded above.
    await provider.mine(1);
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await (sc as any).f(H).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // Arbitrary computed n from pure param arithmetic (no block.* register at all): the reader is stateful only
  // because of blockhash. n = x - 1 is computed by the covenant; the SDK extracts it from the probe trace.
  it('extracts n from an arbitrary param expression (blockhash(x - 1)), no register', async () => {
    const provider = createTestProvider();
    const oracle = await allocHeight(provider);
    const n = BigInt(oracle.n); const x = n + 1n; // n = x - 1
    const H = hexToBin('ee'.repeat(32));
    const src = 'contract B(){ function f(int x, bytes32 h){ require(blockhash(x - 1) == h); } }';
    const artifact = compileString(src);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.blockhashReads).toEqual(['<computed:0>']);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {}, {
      saltContract: true,
    });
    await seedOracleNft(provider, n, H, { category: categoryId });
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await (sc as any).f(x, H).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
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
