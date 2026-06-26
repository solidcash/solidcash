import { describe, it, expect, beforeAll } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { Contract, StatefulContract, TransactionBuilder, SignatureTemplate, resolveBlockhashCoSpend } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, createFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv, bobPriv, aliceAddress } from '../fixture/vars.js';
import {
  buildBlockhashOracleCovenantScript, blockhashOracleLockingBytecode, buildBlockhashCommitment, scriptToBytecode,
  encodeInt,
} from '@solidcash/utils';
import { BlockOracleUpdater, fetchBlockOracleFields, RpcLike } from '../../src/oracle/blockOracleUpdater.js';

// block.chainid is a baked single-byte network constant (chainId & 0xff), typed bytes1, compared
// bytewise. The contract requires the baked byte equals an unlock arg, so the spend only succeeds when
// the byte compiled for `chainId` matches what the caller expects under the VM.
const SOURCE = `
contract ChainIdCheck() {
    function check(bytes1 expected) {
        require(block.chainid == expected);
    }
}`;

// User-land convention: mainnet 0, chipnet 1, testnet4 2, regtest -1 (0xff).
const NETWORKS = [
  { name: 'mainnet', chainId: 0, hex: '00' },
  { name: 'chipnet', chainId: 1, hex: '01' },
  { name: 'testnet4', chainId: 2, hex: '02' },
  { name: 'regtest', chainId: -1, hex: 'ff' },
];

async function spendCheck(chainId: number, expectedHex: string): Promise<string> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { chainId });
  const contract = new Contract(artifact, [], { provider });

  const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
  const feeFunder = await createFeeFunder(provider, 20000n);

  const tx = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.check(hexToBin(expectedHex)))
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: contract.address, amount: 110000n })
    .send();
  return tx.txid;
}

// Spend a no-arg contract whose body hardcodes a network-byte check.
async function spendLiteral(chainId: number | undefined, literalHex: string): Promise<string> {
  const provider = createTestProvider();
  const src = `contract C() { function f() { require(block.chainid == 0x${literalHex}); } }`;
  const artifact = compileString(src, chainId === undefined ? {} : { chainId });
  const contract = new Contract(artifact, [], { provider });

  const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
  const feeFunder = await createFeeFunder(provider, 20000n);

  const tx = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.f())
    .addInput(feeFunder.utxo, feeFunder.unlocker)
    .addOutput({ to: contract.address, amount: 110000n })
    .send();
  return tx.txid;
}

describe('block.chainid e2e', () => {
  for (const net of NETWORKS) {
    it(`bakes ${net.name} (chainId ${net.chainId}) as 0x${net.hex} and enforces it on the VM`, async () => {
      const txid = await spendCheck(net.chainId, net.hex);
      expect(txid).toMatch(/^[0-9a-f]{64}$/);
    });

    it(`rejects a mismatched network byte for ${net.name}`, async () => {
      const wrongHex = net.hex === '00' ? '01' : '00';
      await expect(spendCheck(net.chainId, wrongHex)).rejects.toThrow();
    });
  }

  it('defaults to mainnet (0x00) when chainId is omitted', async () => {
    const txid = await spendLiteral(undefined, '00');
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a chipnet-compiled contract fails a hardcoded mainnet check (0x01 != 0x00)', async () => {
    await expect(spendLiteral(1, '00')).rejects.toThrow();
  });
});

describe('block.chainid compilation', () => {
  it('bakes a different byte per chainId', () => {
    const mainnet = compileString(SOURCE, { chainId: 0 }).bytecode;
    const chipnet = compileString(SOURCE, { chainId: 1 }).bytecode;
    const regtest = compileString(SOURCE, { chainId: -1 }).bytecode;
    expect(mainnet).not.toEqual(chipnet);
    expect(chipnet).not.toEqual(regtest);
    // regtest -1 -> the literal byte 0xff
    expect(regtest).toContain('ff');
  });

  it('defaults to mainnet when chainId is omitted (same bytecode as chainId 0)', () => {
    expect(compileString(SOURCE).bytecode).toEqual(compileString(SOURCE, { chainId: 0 }).bytecode);
  });
});

// Oracle-backed block.* reads: each referenced field is an injected register of the contract's own
// state (uint32, or address for the variable-length coinbase). This block tests the READ path with the
// registers seeded as initial state (decoupled from the owner-update path tested below). Values are real
// mainnet block 956830. basefee is derived: Floor(1000 * totalFees / size) = Floor(1000*31792/9075) = 3503.
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

describe('block.* oracle reads e2e', () => {
  const provider = createTestProvider();
  const artifact = compileString(ORACLE_READER);
  const contract = new Contract(artifact, [], { provider });
  const stateLayout = artifact.stateLayout!;
  let categoryId: string;

  beforeAll(async () => {
    ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, {
      __block_number: BLOCK.number,
      __block_timestamp: BLOCK.timestamp,
      __block_difficulty: BLOCK.difficulty,
      __block_size: BLOCK.size,
      __block_totalFees: BLOCK.totalFees,
      __block_coinbase: BLOCK.coinbase,
      __blockOracleOwner: alicePub,
    }, { saltContract: true }));
  });

  it('injects one register per field (uint32, address for coinbase) + an immutable owner key', () => {
    expect(stateLayout.variables.map((v) => `${v.name}:${v.type}`)).toEqual([
      '__block_number:uint32', '__block_timestamp:uint32', '__block_difficulty:uint32',
      '__block_size:uint32', '__block_totalFees:uint32', '__block_coinbase:address',
      '__blockOracleOwner:pubkey',
    ]);
  });

  it('reads every block.* field (incl. coinbase) and derives basefee, matching the seeded state', async () => {
    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.check(
      BLOCK.number, BLOCK.timestamp, BLOCK.difficulty, BLOCK.size, BLOCK.totalFees, BLOCK.basefee, BLOCK.coinbase,
    ).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong block.number', async () => {
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(
      999999n, BLOCK.timestamp, BLOCK.difficulty, BLOCK.size, BLOCK.totalFees, BLOCK.basefee, BLOCK.coinbase,
    ).send()).rejects.toThrow();
  });

  it('rejects a wrong derived basefee', async () => {
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(
      BLOCK.number, BLOCK.timestamp, BLOCK.difficulty, BLOCK.size, BLOCK.totalFees, 3504n, BLOCK.coinbase,
    ).send()).rejects.toThrow();
  });

  it('rejects a wrong block.coinbase', async () => {
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.check(
      BLOCK.number, BLOCK.timestamp, BLOCK.difficulty, BLOCK.size, BLOCK.totalFees, BLOCK.basefee,
      hexToBin('76a914000000000000000000000000000000000000000088ac'),
    ).send()).rejects.toThrow();
  });
});

// Owner-update path: block.* usage injects an immutable owner key (__blockOracleOwner) + an owner-gated
// __updateBlockOracle(sig, ...fields) that requires the owner signature and the freshness/anti-over-
// reporting bound require(tx.time >= number), then writes the registers. The deployer/owner runs an
// off-chain updater (see solidcash/src/oracle/block-oracle-updater) that calls this each block.
const OWNED_ORACLE = `
contract BlockOracleOwned() {
    function readBack(int eNumber, int eTimestamp) {
        require(block.number == eNumber);
        require(block.timestamp == eTimestamp);
    }
}`;

describe('block.* owner-update path e2e', () => {
  const provider = createTestProvider();
  const artifact = compileString(OWNED_ORACLE);
  const contract = new Contract(artifact, [], { provider });
  const stateLayout = artifact.stateLayout!;
  let categoryId: string;

  beforeAll(async () => {
    ({ categoryId } = await setupStatefulUtxos(provider, contract, stateLayout, {
      __block_number: 0n, __block_timestamp: 0n, __blockOracleOwner: alicePub,
    }, { saltContract: true }));
  });

  it('injects an immutable owner key + an owner-gated __updateBlockOracle function', () => {
    expect(stateLayout.variables.map((v) => v.name)).toContain('__blockOracleOwner');
    expect(stateLayout.variables.find((v) => v.name === '__blockOracleOwner')?.immutable).toBe(true);
    expect(artifact.abi.map((f) => f.name)).toContain('__updateBlockOracle');
  });

  // Mock chain tip is height 133700, so the freshness bound tx.time >= number requires number <= 133700
  // (a real-node update at the tip would use the live height). The freshness IS the anti-over-reporting:
  // a tx claiming a height the chain has not reached is non-final and unminable.
  it('owner updates the registers (signed + fresh), and the new values read back', async () => {
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.__updateBlockOracle(new SignatureTemplate(alicePriv), 100000n, 1700000000n)
      .setState({ __block_number: 100000n, __block_timestamp: 1700000000n })
      .setLocktime(100000) // tx.time >= number (height mode), <= chain tip -> final
      .send();

    const reader = StatefulContract.withCategory(contract, categoryId);
    const tx = await reader.readBack(100000n, 1700000000n).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects an update not signed by the owner', async () => {
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.__updateBlockOracle(new SignatureTemplate(bobPriv), 100000n, 1700000000n)
      .setState({ __block_number: 100000n, __block_timestamp: 1700000000n })
      .setLocktime(100000)
      .send()).rejects.toThrow();
  });

  it('rejects an over-reported height (nLocktime < number violates the freshness bound)', async () => {
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.__updateBlockOracle(new SignatureTemplate(alicePriv), 100001n, 1700000000n)
      .setState({ __block_number: 100001n, __block_timestamp: 1700000000n })
      .setLocktime(100000) // < number -> require(tx.time >= number) fails (and 100000 <= tip, so final)
      .send()).rejects.toThrow();
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
function fakeRpc(tip = 100000): RpcLike {
  return {
    request: async (method: string, ...params: any[]) => {
      switch (method) {
        case 'getblockcount': return tip;
        case 'getblockhash': return `hash_${params[0]}`;
        case 'getblock': return FAKE_BLOCK;
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
    const artifact = compileString(ORACLE_FULL);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {
      __block_number: 0n, __block_timestamp: 0n, __block_difficulty: 0n, __block_size: 0n,
      __block_totalFees: 0n, __block_coinbase: hexToBin('00'), __blockOracleOwner: alicePub,
    }, { saltContract: true });

    const updater = new BlockOracleUpdater({ contract, categoryId, keeperKey: alicePriv, rpc: fakeRpc(100000) });
    expect(await updater.oracleHeight()).toBe(0n);

    const txid = await updater.syncOnce();
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await updater.oracleHeight()).toBe(100000n);

    expect(await updater.syncOnce()).toBeNull(); // chain not ahead -> no update
  });

  it('rejects a keeper that is not the baked owner', async () => {
    const provider = createTestProvider();
    const artifact = compileString(ORACLE_FULL);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, artifact.stateLayout!, {
      __block_number: 0n, __block_timestamp: 0n, __block_difficulty: 0n, __block_size: 0n,
      __block_totalFees: 0n, __block_coinbase: hexToBin('00'), __blockOracleOwner: alicePub,
    }, { saltContract: true });

    const impostor = new BlockOracleUpdater({ contract, categoryId, keeperKey: bobPriv, rpc: fakeRpc(100000) });
    await expect(impostor.syncOnce()).rejects.toThrow();
  });
});

// blobhash(i) has no BCH analogue (no EIP-4844 blobs) -> always bytes32(0); blockhash(n) is recognized
// but its n->hash oracle read codegen is pending (docs/block-oracle.md s11).
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
    expect(blob.stateLayout!.variables.map((v) => v.name)).toEqual(['__block_totalFees', '__block_size', '__blockOracleOwner']);
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
  // txid))), grindable by the tx-builder - with NO oracle co-spend or state. Compiler warns.
  it('block.prevrandao lowers to abs(int(sha256(input[0] prevout txid))), no oracle', () => {
    const p = compileString('contract A(){ function f(int e){ require(block.prevrandao % 6 == e); } }');
    expect(p.bytecode).toContain('OP_0 OP_OUTPOINTTXHASH OP_SHA256 OP_BIN2NUM OP_ABS');
    expect(p.stateLayout).toBeUndefined(); // transaction-local - no oracle register
  });

  it('blobhash rejects a non-zero expectation', async () => {
    await expect(spendBlob(`0x01${'00'.repeat(31)}`)).rejects.toThrow();
  });

  it('blockhash(n) requires the blockhashOracleCategory compiler option', () => {
    expect(() => compileString(`contract B(){ function f(){ require(blockhash(1) == ${B32_ZERO}); } }`))
      .toThrow(/requires the blockhashOracleCategory/);
  });

  it('compiler marks usesBlockhash so the keeper maintains the (n->hash) oracle', () => {
    const withBh = compileString(
      'contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }',
      { blockhashOracleCategory: BH_CAT },
    );
    const noBh = compileString(`contract B(){ function f(){ require(blobhash(0) == ${B32_ZERO}); } }`);
    expect(withBh.usesBlockhash).toBe(true);
    expect(BlockOracleUpdater.usesBlockhash(withBh)).toBe(true);
    expect(noBh.usesBlockhash).toBeUndefined();
    expect(BlockOracleUpdater.usesBlockhash(noBh)).toBe(false);
  });

  it('records blockhashReads metadata (the param feeding n) for SDK auto-injection', () => {
    const direct = compileString(
      'contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }',
      { blockhashOracleCategory: BH_CAT },
    );
    expect(direct.abi.find((fn) => fn.name === 'f')?.blockhashReads).toEqual(['bn']);

    // Computed n (not a direct identifier) is NOT recorded -> consumer wires resolveBlockhashCoSpend manually.
    const computed = compileString(
      'contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn + 1) == h); } }',
      { blockhashOracleCategory: BH_CAT },
    );
    expect(computed.abi.find((fn) => fn.name === 'f')?.blockhashReads).toBeUndefined();
  });
});

// blockhash(n) MVP read: the (n->hash) oracle UTXO is co-spent as the LAST input (category C_oracle +
// commitment n(4 LE)||hash); the contract verifies category + commitment.n == n + require(tx.time >= n)
// and returns hash. Held here at a trivial anyone-can-spend p2sh32 (redeem OP_1) and recreated for token
// consistency. n <= 133700 (mock tip) so the freshness locktime is final. (Hardened covenant + SDK
// auto-discovery + keeper minting are the next increment - docs/block-oracle.md s11.)
const BH_CAT = 'cc'.repeat(32);

async function spendBlockhash(argN: number, storedN: number, storedHash: Uint8Array, expectHash: Uint8Array): Promise<string> {
  const provider = createTestProvider();
  const artifact = compileString(
    'contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }',
    { blockhashOracleCategory: BH_CAT },
  );
  const contract = new Contract(artifact, [], { provider });
  const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

  // Seed the (n->hash) oracle NFT at its real covenant address addr(storedN), then resolve the co-spend
  // pieces via the SDK helper (immutable, category-pinned, read-only flag 0, self-preserving recreate).
  const cat = hexToBin(BH_CAT);
  const addrN = blockhashOracleLockingBytecode(cat, BigInt(storedN));
  const token = {
    category: BH_CAT, amount: 0n,
    nft: { capability: 'none' as const, commitment: binToHex(buildBlockhashCommitment(BigInt(storedN), storedHash)) },
  };
  await provider.addUtxo(binToHex(addrN), { txid: '11'.repeat(32), vout: 0, satoshis: 1000n, token });

  const cospend = await resolveBlockhashCoSpend(provider, BH_CAT, BigInt(storedN));
  if (!cospend) throw new Error('no (n->hash) oracle UTXO at addr(n)');

  const tx = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.f(BigInt(argN), expectHash)) // input 0
    .addInput(cospend.utxo, cospend.unlocker) // input 1 (last) = (n->hash) oracle NFT
    .addOutput({ to: contract.address, amount: 99000n }) // output 0
    .addOutput(cospend.recreateOutput) // output 1: self-preserving recreate (matching index)
    .setLocktime(argN)
    .send();
  return tx.txid;
}

// Wipe path: after n+256 anyone may consume (burn) the (n->hash) UTXO; before n+256 the CLTV blocks it.
async function wipeBlockhash(storedN: number, locktime: number): Promise<string> {
  const provider = createTestProvider();
  const cat = hexToBin(BH_CAT);
  const addrN = blockhashOracleLockingBytecode(cat, BigInt(storedN));
  const redeem = scriptToBytecode(buildBlockhashOracleCovenantScript(cat, BigInt(storedN)));
  const token = {
    category: BH_CAT, amount: 0n,
    nft: { capability: 'none' as const, commitment: binToHex(buildBlockhashCommitment(BigInt(storedN), new Uint8Array(32))) },
  };
  const nhashUtxo = { txid: '22'.repeat(32), vout: 0, satoshis: 5000n, token };
  await provider.addUtxo(binToHex(addrN), nhashUtxo);
  const wipeUnlock = scriptToBytecode([encodeInt(1n), redeem]); // flag 1 (wipe) + redeem
  const unlocker = { generateLockingBytecode: () => addrN, generateUnlockingBytecode: () => wipeUnlock };
  const tx = await new TransactionBuilder({ provider, allowImplicitNftBurn: true })
    .addInput(nhashUtxo, unlocker)
    .addOutput({ to: aliceAddress, amount: 4000n })
    .setLocktime(locktime)
    .send();
  return tx.txid;
}

describe('blockhash(n) e2e (real (n->hash) covenant)', () => {
  const HASH = hexToBin('aa'.repeat(32));

  it('returns the attested hash for a matching (n, hash) oracle UTXO', async () => {
    expect(await spendBlockhash(100000, 100000, HASH, HASH)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a wrong expected hash', async () => {
    await expect(spendBlockhash(100000, 100000, HASH, hexToBin('bb'.repeat(32)))).rejects.toThrow();
  });

  it('rejects an oracle UTXO whose commitment.n != the requested n', async () => {
    await expect(spendBlockhash(100000, 99999, HASH, HASH)).rejects.toThrow();
  });

  it('anyone may wipe the (n->hash) UTXO at or after n+256', async () => {
    expect(await wipeBlockhash(100000, 100256)).toMatch(/^[0-9a-f]{64}$/); // 100000+256 <= mock tip 133700
  });

  it('rejects a wipe before n+256 (CLTV blocks early cleanup)', async () => {
    await expect(wipeBlockhash(100000, 100255)).rejects.toThrow();
  });

  it('resolveBlockhashCoSpend returns null when no UTXO sits at addr(n)', async () => {
    expect(await resolveBlockhashCoSpend(createTestProvider(), BH_CAT, 100000n)).toBeNull();
  });

  it('resolveBlockhashCoSpend yields the live UTXO + a matching self-preserving recreate', async () => {
    const provider = createTestProvider();
    const cat = hexToBin(BH_CAT);
    const addrN = blockhashOracleLockingBytecode(cat, 100000n);
    const token = {
      category: BH_CAT, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(buildBlockhashCommitment(100000n, HASH)) },
    };
    await provider.addUtxo(binToHex(addrN), { txid: '66'.repeat(32), vout: 0, satoshis: 1000n, token });

    const cospend = await resolveBlockhashCoSpend(provider, BH_CAT, 100000n);
    expect(cospend).not.toBeNull();
    expect(cospend!.locktime).toBe(100000); // tx.time floor = n
    expect(cospend!.recreateOutput.to).toEqual(addrN); // recreate at addr(n)
    expect(cospend!.recreateOutput.token).toEqual(token); // identity preserved
    expect(binToHex(cospend!.unlocker.generateLockingBytecode())).toBe(binToHex(addrN));
  });
});

// Auto-injection: the builder reads abi.blockhashReads + the call args, resolves addr(n), and co-spends the
// (n->hash) UTXO as the last input + self-preserving recreate - no manual resolveBlockhashCoSpend wiring.
describe('blockhash(n) auto-injection (SDK)', () => {
  const N = 100000n;
  const H = hexToBin('aa'.repeat(32));
  const SRC = 'contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }';

  async function setup() {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SRC, { blockhashOracleCategory: BH_CAT }), [], { provider });
    const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    const addrN = blockhashOracleLockingBytecode(hexToBin(BH_CAT), N);
    const token = { category: BH_CAT, amount: 0n, nft: { capability: 'none' as const, commitment: binToHex(buildBlockhashCommitment(N, H)) } };
    await provider.addUtxo(binToHex(addrN), { txid: '77'.repeat(32), vout: 0, satoshis: 1000n, token });
    return { provider, contract, contractUtxo };
  }

  it('persists blockhashOracleCategory in the artifact for the SDK', () => {
    const artifact = compileString(SRC, { blockhashOracleCategory: BH_CAT });
    expect(artifact.compiler.options?.blockhashOracleCategory).toBe(BH_CAT);
  });

  it('auto-co-spends the (n->hash) UTXO from the call args (no manual wiring)', async () => {
    const { provider, contract, contractUtxo } = await setup();
    const tx = await new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.f(N, H))
      .addOutput({ to: contract.address, amount: 99000n })
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  it('errors clearly when no (n->hash) UTXO exists at addr(n)', async () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SRC, { blockhashOracleCategory: BH_CAT }), [], { provider });
    const contractUtxo = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    await expect(
      new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.f(N, H))
        .addOutput({ to: contract.address, amount: 99000n })
        .send(),
    ).rejects.toThrow(/No \(n->hash\) oracle UTXO/);
  });

  // Composition: the co-spend is NOT the last input (an unrelated input trails it). The reader locates it by
  // its synthesized index param, not OP_TXINPUTCOUNT OP_1SUB - which would read the trailing input and fail.
  it('reads the co-spend by index when it is not the last input (composition-safe)', async () => {
    const { provider, contract, contractUtxo } = await setup();
    const cospend = await resolveBlockhashCoSpend(provider, BH_CAT, N);
    if (!cospend) throw new Error('co-spend seeded by setup()');
    const trailing = { txid: '99'.repeat(32), vout: 0, satoshis: 5000n };
    await provider.addUtxo(binToHex(MASTER_LBC), trailing); // anyone-can-spend OP_1 p2sh, no token

    const tx = await new TransactionBuilder({ provider })
      .addInput(contractUtxo, contract.unlock.f(N, H)) // input 0: the reader
      .addInput(cospend.utxo, cospend.unlocker) // input 1: (n->hash) co-spend (NOT last)
      .addInput(trailing, { generateLockingBytecode: () => MASTER_LBC, generateUnlockingBytecode: () => MASTER_UNLOCK })
      .addOutput({ to: contract.address, amount: 99000n }) // output 0
      .addOutput(cospend.recreateOutput) // output 1: recreate (covenant output[1] == input[1])
      .addOutput({ to: aliceAddress, amount: 4000n }) // output 2
      .setLocktime(Number(N))
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });

  // Multiple readers with different n in one tx: the builder auto-injects both co-spends and each reader's
  // unlocker resolves its own by commitment.n (not position).
  it('auto-injects and matches multiple readers, each to its own n', async () => {
    const provider = createTestProvider();
    const contract = new Contract(compileString(SRC, { blockhashOracleCategory: BH_CAT }), [], { provider });
    const utxoA = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    const utxoB = await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

    const n1 = 100000n; const n2 = 100001n; // both <= mock tip 133700
    const h1 = hexToBin('a1'.repeat(32)); const h2 = hexToBin('b2'.repeat(32));
    const seed = async (n: bigint, h: Uint8Array, txid: string): Promise<void> => {
      const addrN = blockhashOracleLockingBytecode(hexToBin(BH_CAT), n);
      const token = { category: BH_CAT, amount: 0n, nft: { capability: 'none' as const, commitment: binToHex(buildBlockhashCommitment(n, h)) } };
      await provider.addUtxo(binToHex(addrN), { txid, vout: 0, satoshis: 1000n, token });
    };
    await seed(n1, h1, 'a1'.repeat(32));
    await seed(n2, h2, 'b2'.repeat(32));

    const tx = await new TransactionBuilder({ provider })
      .addInput(utxoA, contract.unlock.f(n1, h1)) // reader for n1
      .addInput(utxoB, contract.unlock.f(n2, h2)) // reader for n2
      .addOutput({ to: contract.address, amount: 99000n })
      .addOutput({ to: contract.address, amount: 99000n })
      .send(); // auto-injects co-spend(n1) at input/output 2 + co-spend(n2) at input/output 3
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
    const masterUtxo = {
      txid: '33'.repeat(32), vout: 0, satoshis: 10000n,
      token: { category: BH_CAT, amount: 0n, nft: { capability: 'minting' as const, commitment: '' } },
    };
    await provider.addUtxo(binToHex(MASTER_LBC), masterUtxo);
    const consumer = new Contract(
      compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }', { blockhashOracleCategory: BH_CAT }),
      [], { provider },
    );
    const updater = new BlockOracleUpdater({
      contract: consumer, categoryId: '00'.repeat(32), keeperKey: alicePriv, rpc: fakeRpc(),
      blockhashOracleCategory: BH_CAT,
      blockhashOracleMaster: {
        utxo: masterUtxo,
        unlocker: { generateLockingBytecode: () => MASTER_LBC, generateUnlockingBytecode: () => MASTER_UNLOCK },
      },
    });

    const H = hexToBin('cd'.repeat(32));
    const mintTxid = await updater.mintBlockhashPair(100000n, H);
    expect(mintTxid).toMatch(/^[0-9a-f]{64}$/);

    // The minted (n->hash) NFT is output 1 of the mint tx; a consumer co-spends it and reads blockhash(100000).
    const cat = hexToBin(BH_CAT);
    const addrN = blockhashOracleLockingBytecode(cat, 100000n);
    const redeem = scriptToBytecode(buildBlockhashOracleCovenantScript(cat, 100000n));
    const token = { category: BH_CAT, amount: 0n, nft: { capability: 'none' as const, commitment: binToHex(buildBlockhashCommitment(100000n, H)) } };
    const mintedUtxo = { txid: mintTxid, vout: 1, satoshis: 1000n, token };
    const contractUtxo = await provider.addUtxo(consumer.address, randomUtxo({ satoshis: 100000n }));
    const readUnlock = scriptToBytecode([new Uint8Array(0), redeem]);

    const tx = await new TransactionBuilder({ provider })
      .addInput(contractUtxo, consumer.unlock.f(100000n, H))
      .addInput(mintedUtxo, { generateLockingBytecode: () => addrN, generateUnlockingBytecode: () => readUnlock })
      .addOutput({ to: consumer.address, amount: 99000n })
      .addOutput({ to: addrN, amount: 1000n, token })
      .setLocktime(100000)
      .send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});

function sweepUpdater(provider: ReturnType<typeof createTestProvider>): BlockOracleUpdater {
  const consumer = new Contract(
    compileString('contract B(){ function f(int bn, bytes32 h){ require(blockhash(bn) == h); } }', { blockhashOracleCategory: BH_CAT }),
    [], { provider },
  );
  return new BlockOracleUpdater({
    contract: consumer, categoryId: '00'.repeat(32), keeperKey: alicePriv, rpc: fakeRpc(), blockhashOracleCategory: BH_CAT,
  });
}

describe('blockhash keeper sweep', () => {
  it('wipes the (n->hash) pair that aged out of the window and reclaims the dust', async () => {
    const provider = createTestProvider();
    const n = 100000n; // swept at n+256 = 100256 <= mock tip 133700
    const cat = hexToBin(BH_CAT);
    const addrN = blockhashOracleLockingBytecode(cat, n);
    const token = {
      category: BH_CAT, amount: 0n,
      nft: { capability: 'none' as const, commitment: binToHex(buildBlockhashCommitment(n, hexToBin('ab'.repeat(32)))) },
    };
    await provider.addUtxo(binToHex(addrN), { txid: '55'.repeat(32), vout: 0, satoshis: 2000n, token });
    expect(await provider.getUtxosForLockingBytecode(addrN)).toHaveLength(1);

    const txid = await sweepUpdater(provider).sweepBlockhashPair(n);
    expect(txid).toMatch(/^[0-9a-f]{64}$/);
    expect(await provider.getUtxosForLockingBytecode(addrN)).toHaveLength(0);
  });

  it('returns null when there is nothing to sweep at addr(n)', async () => {
    expect(await sweepUpdater(createTestProvider()).sweepBlockhashPair(99999n)).toBeNull();
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
    const artifact = compileString(BH_STATEFUL_SRC, { blockhashOracleCategory: BH_CAT });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { counter: 5n }, { saltContract: true },
    );

    const n = 100000n; const H = hexToBin('aa'.repeat(32));
    const addrN = blockhashOracleLockingBytecode(hexToBin(BH_CAT), n);
    const token = { category: BH_CAT, amount: 0n, nft: { capability: 'none' as const, commitment: binToHex(buildBlockhashCommitment(n, H)) } };
    await provider.addUtxo(binToHex(addrN), { txid: 'e1'.repeat(32), vout: 0, satoshis: 1000n, token });

    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await (sc as any).bump(n, H).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
  });
});
