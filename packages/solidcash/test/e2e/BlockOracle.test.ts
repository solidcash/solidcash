import { describe, it, expect, beforeAll } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { Contract, StatefulContract, TransactionBuilder, SignatureTemplate } from '../../src/index.js';
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

  it('blobhash rejects a non-zero expectation', async () => {
    await expect(spendBlob(`0x01${'00'.repeat(31)}`)).rejects.toThrow();
  });

  it('blockhash(n) requires the blockhashOracleCategory compiler option', () => {
    expect(() => compileString(`contract B(){ function f(){ require(blockhash(1) == ${B32_ZERO}); } }`))
      .toThrow(/requires the blockhashOracleCategory/);
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

  // The (n->hash) oracle NFT at its real covenant address addr(storedN): immutable, category-pinned,
  // co-spent read-only (flag 0) and self-preservingly recreated at the matching output index.
  const cat = hexToBin(BH_CAT);
  const addrN = blockhashOracleLockingBytecode(cat, BigInt(storedN));
  const redeem = scriptToBytecode(buildBlockhashOracleCovenantScript(cat, BigInt(storedN)));
  const token = {
    category: BH_CAT, amount: 0n,
    nft: { capability: 'none' as const, commitment: binToHex(buildBlockhashCommitment(BigInt(storedN), storedHash)) },
  };
  const nhashUtxo = { txid: '11'.repeat(32), vout: 0, satoshis: 1000n, token };
  await provider.addUtxo(binToHex(addrN), nhashUtxo);
  const readUnlock = scriptToBytecode([new Uint8Array(0), redeem]); // flag 0 (read) + redeem
  const nhashUnlocker = { generateLockingBytecode: () => addrN, generateUnlockingBytecode: () => readUnlock };

  const tx = await new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.f(BigInt(argN), expectHash)) // input 0
    .addInput(nhashUtxo, nhashUnlocker) // input 1 (last) = (n->hash) oracle NFT
    .addOutput({ to: contract.address, amount: 99000n }) // output 0
    .addOutput({ to: addrN, amount: 1000n, token }) // output 1: self-preserving recreate (matching index)
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
});
