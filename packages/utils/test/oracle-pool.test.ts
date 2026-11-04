import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, generateSigningSerializationBch, secp256k1,
  type Output, type TransactionBch,
} from '@bitauth/libauth';
import {
  POOL_COIN_SATS, POOL_FLAG_NUMBER_STOPPED, POOL_FLAG_SLOT, POOL_FLAG_SLOT_STOPPED, POOL_FLAG_TIMESTAMP_STOPPED,
  type PoolInfoFields, type PoolSlotFields,
  decodePoolBatonCommitment, decodePoolInfoCommitment, decodePoolSlotCommitment,
  encodePoolBatonCommitment, encodePoolInfoCommitment, encodePoolSlotCommitment,
  poolBatonLockingBytecode, poolBatonMintUnlocking, poolBatonRedeemScript, poolBatonSweepUnlocking,
  poolBatonUpdateUnlocking, poolInfoLockingBytecode, poolInfoReadUnlocking, poolInfoRedeemScript,
  poolInfoRotateUnlocking, poolInfoStopUnlocking, poolInfoSweepUnlocking, poolInfoUpdateUnlocking,
  poolSlotLockingBytecode, poolSlotReadUnlocking, poolSlotRedeemScript, poolSlotRotateUnlocking,
  poolSlotStopUnlocking, poolSlotSweepUnlocking, poolSlotWriteUnlocking,
} from '../src/oracle-pool.js';
import { hash160, hash256 } from '../src/hash.js';
import { Op, scriptToBytecode } from '../src/script.js';

// Every transaction runs through the standard BCH 2026 VM: token rules, standardness and every input's script. Each
// refused transaction is otherwise valid, so the refusal comes from the pool covenant at input 0.
// Kind confusion (a block-info coin read as a slot, or the reverse) is a reader-side check: both kinds share the
// category and capability, so a reader matches the flags byte. The covenants keep each kind's bit.
const vm = createVirtualMachineBch2026(true);
const SIGHASH_ALL = 0x41;

type Capability = 'none' | 'mutable' | 'minting';
type Signer = (key: Uint8Array, redeem: Uint8Array) => Uint8Array;
interface Spend { utxo: Output; unlock: (sign: Signer) => Uint8Array }

function publicKey(key: Uint8Array): Uint8Array {
  const pubkey = secp256k1.derivePublicKeyCompressed(key);
  if (typeof pubkey === 'string') throw new Error(pubkey);
  return pubkey;
}

const P = Uint8Array.from({ length: 32 }, (_v, i) => (i * 7 + 3) & 0xff);
const Q = Uint8Array.from({ length: 32 }, (_v, i) => (i * 5 + 11) & 0xff);
const ownerKey = Uint8Array.from({ length: 32 }, (_v, i) => i + 1);
const forgerKey = Uint8Array.from({ length: 32 }, (_v, i) => 64 - i);
const ownerPub = publicKey(ownerKey);
const forgerPub = publicKey(forgerKey);
const owner = hash160(ownerPub);
const newOwner = hash160(forgerPub);

const infoLock = poolInfoLockingBytecode(P);
const slotLock = poolSlotLockingBytecode(P);
const batonLock = poolBatonLockingBytecode(P);
const infoRedeem = poolInfoRedeemScript(P);
const slotRedeem = poolSlotRedeemScript(P);
const batonRedeem = poolBatonRedeemScript(P);

// Funding and change sit at a lock anyone may spend: p2sh32 of OP_1.
const anyoneRedeem = Uint8Array.of(Op.OP_1);
const anyoneLock = Uint8Array.from([0xaa, 0x20, ...hash256(anyoneRedeem), 0x87]);

const coinbase = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x33), 0x88, 0xac]);
const infoFields: PoolInfoFields = {
  flags: 0, owner, number: 900n, timestamp: 1_700_000_000n, difficulty: 0x1d00ffffn, size: 1_000n, totalFees: 500n,
  coinbase,
};
const infoWith = (fields: Partial<PoolInfoFields>): Uint8Array => encodePoolInfoCommitment({ ...infoFields, ...fields });
const info = infoWith({});

const hashA = new Uint8Array(32).fill(0xa1);
const hashB = new Uint8Array(32).fill(0xb2);
const slotFields: PoolSlotFields = { flags: POOL_FLAG_SLOT, n: 1_000n, hash: hashA, owner, depth: 4 };
const slotWith = (fields: Partial<PoolSlotFields>): Uint8Array => encodePoolSlotCommitment({ ...slotFields, ...fields });
const slot = slotWith({});
const grown = slotWith({ hash: hashB });

const baton = encodePoolBatonCommitment({ owner, depth: 4 });

function nft(
  lockingBytecode: Uint8Array, commitment: Uint8Array, capability: Capability = 'mutable', category = P,
  valueSatoshis = POOL_COIN_SATS,
): Output {
  return { lockingBytecode, valueSatoshis, token: { amount: 0n, category, nft: { capability, commitment } } };
}

function plain(valueSatoshis: bigint, token?: Output['token']): Output {
  return { lockingBytecode: anyoneLock, valueSatoshis, ...(token === undefined ? {} : { token }) };
}

const batonCoin = nft(batonLock, baton, 'minting', P, 2_000n);

const funder = (token?: Output['token']): Spend => ({
  utxo: plain(10_000n, token), unlock: () => scriptToBytecode([anyoneRedeem]),
});

/** A coin spent by `key` through `unlocking(pubkey, signature)`. */
function owned(
  utxo: Output, redeem: Uint8Array, unlocking: (pubkey: Uint8Array, signature: Uint8Array) => Uint8Array,
  key = ownerKey, pubkey = ownerPub,
): Spend {
  return { utxo, unlock: (sign) => unlocking(pubkey, sign(key, redeem)) };
}

/** Builds, signs and verifies a version-2 transaction whose inputs all enforce its locktime. */
function verify(spends: Spend[], outputs: Output[], locktime = 0): string | true {
  const sourceOutputs = spends.map((spend) => spend.utxo);
  const transaction: TransactionBch = {
    version: 2,
    locktime,
    inputs: spends.map((_spend, index) => ({
      outpointIndex: index + 1,
      outpointTransactionHash: new Uint8Array(32).fill(index + 1),
      sequenceNumber: 0xfffffffe,
      unlockingBytecode: new Uint8Array(),
    })),
    outputs,
  };
  spends.forEach((spend, inputIndex) => {
    const sign: Signer = (key, redeem) => {
      const digest = hash256(generateSigningSerializationBch(
        { inputIndex, sourceOutputs, transaction },
        { coveredBytecode: redeem, signingSerializationType: Uint8Array.of(SIGHASH_ALL) },
      ));
      const signature = secp256k1.signMessageHashSchnorr(key, digest);
      if (typeof signature === 'string') throw new Error(signature);
      return Uint8Array.from([...signature, SIGHASH_ALL]);
    };
    transaction.inputs[inputIndex]!.unlockingBytecode = spend.unlock(sign);
  });
  return vm.verify({ sourceOutputs, transaction });
}

const accepted = (result: string | true): void => {
  expect(result).toBe(true);
};

const refused = (result: string | true): void => {
  expect(result).toEqual(expect.stringContaining('error in evaluating input index 0:'));
};

const readInfo = (utxo: Output): Spend => ({ utxo, unlock: () => poolInfoReadUnlocking(P) });

/** An owner-signed update of the info coin `from` to `to`, recreated at its index. */
function updateInfo(from: Uint8Array, to: Uint8Array, locktime: number, key = ownerKey, pubkey = ownerPub): string | true {
  const spend = owned(
    nft(infoLock, from), infoRedeem, (pub, sig) => poolInfoUpdateUnlocking(P, pub, sig, to, locktime), key, pubkey,
  );
  return verify([spend], [nft(infoLock, to)], locktime);
}

/** An owner-signed write of block `n` with hashB into the slot `from`. */
function writeSlot(from: Uint8Array, n: bigint, locktime: number): string | true {
  const spend = owned(nft(slotLock, from), slotRedeem, (pub, sig) => poolSlotWriteUnlocking(P, pub, sig, n, hashB));
  return verify([spend], [nft(slotLock, slotWith({ n, hash: hashB }))], locktime);
}

/** A baton mint that co-spends the info coin at input 1 as its template and a funder at input 2. */
function mint(outputs: Output[], fund = funder()): string | true {
  const spend = owned(batonCoin, batonRedeem, (pub, sig) => poolBatonMintUnlocking(P, pub, sig, 1));
  return verify([spend, readInfo(nft(infoLock, info)), fund], outputs, 1_000);
}

const minted = (copy = info, slotCommitment = grown): Output[] => [
  batonCoin, nft(infoLock, info), nft(infoLock, copy), nft(slotLock, slotCommitment), plain(5_000n),
];

describe('oracle pool commitments', () => {
  it('lays out each commitment as the formats give it', () => {
    expect(info.length).toBe(47 + coinbase.length);
    expect(info.slice(0, 26)).toEqual(Uint8Array.from([0, ...owner, 0x84, 0x03, 0, 0, 0]));
    expect(decodePoolInfoCommitment(info)).toEqual(infoFields);
    expect(slot).toEqual(Uint8Array.from([0x80, 0xe8, 0x03, 0, 0, ...hashA, ...owner, 4, 0]));
    expect(decodePoolSlotCommitment(slot)).toEqual(slotFields);
    expect(encodePoolBatonCommitment({ owner, depth: 256 })).toEqual(Uint8Array.from([...owner, 0, 1]));
    expect(decodePoolBatonCommitment(baton)).toEqual({ owner, depth: 4 });
  });

  it('pins each covenant redeem size', () => {
    expect([infoRedeem.length, slotRedeem.length, batonRedeem.length]).toEqual([212, 201, 294]);
  });
});

describe('oracle pool block-info coin', () => {
  it('admits an honest read', () => {
    accepted(verify([readInfo(nft(infoLock, info))], [nft(infoLock, info)]));
  });

  it('refuses a read whose recreation changes the commitment, the lock or the capability, or sits elsewhere', () => {
    const coin = nft(infoLock, info);
    refused(verify([readInfo(coin)], [nft(infoLock, infoWith({ number: 901n }))]));
    refused(verify([readInfo(coin)], [nft(anyoneLock, info)]));
    refused(verify([readInfo(coin)], [nft(infoLock, info, 'none')]));
    refused(verify([readInfo(coin), funder()], [plain(9_000n), coin]));
  });

  it('refuses a coin of another category at a pool lock', () => {
    const other = nft(infoLock, info, 'mutable', Q);
    refused(verify([readInfo(other)], [other]));
  });

  it('admits a height update and a time update', () => {
    accepted(updateInfo(info, infoWith({
      number: 1_000n, difficulty: 0x1c00ffffn, size: 2_000n, totalFees: 900n, coinbase: coinbase.slice(0, 10),
    }), 1_000));
    accepted(updateInfo(info, infoWith({ timestamp: 1_700_000_600n }), 1_700_000_600));
  });

  it('lets a height update clear bit 0, but not bit 1 or the timestamp', () => {
    const restarted = infoWith({ number: 1_000n });
    accepted(updateInfo(infoWith({ flags: POOL_FLAG_NUMBER_STOPPED }), restarted, 1_000));
    refused(updateInfo(infoWith({ flags: POOL_FLAG_TIMESTAMP_STOPPED }), restarted, 1_000));
    refused(updateInfo(info, infoWith({ number: 1_000n, timestamp: 1_700_000_100n }), 1_000));
  });

  it('refuses a rewind and an update ahead of the locktime', () => {
    refused(updateInfo(info, infoWith({ number: 899n }), 1_000));
    refused(updateInfo(info, infoWith({ timestamp: 1_699_999_999n }), 1_700_000_600));
    refused(updateInfo(info, infoWith({ number: 1_001n }), 1_000));
  });

  it('refuses a forged owner signature', () => {
    const raised = infoWith({ number: 1_000n });
    refused(updateInfo(info, raised, 1_000, forgerKey, ownerPub));
    refused(updateInfo(info, raised, 1_000, forgerKey, forgerPub));
  });

  it('admits a stop, a sweep and a rotate', () => {
    const coin = nft(infoLock, info);
    const both = POOL_FLAG_NUMBER_STOPPED | POOL_FLAG_TIMESTAMP_STOPPED;
    accepted(verify(
      [owned(coin, infoRedeem, (pub, sig) => poolInfoStopUnlocking(P, pub, sig))],
      [nft(infoLock, infoWith({ flags: both }))],
    ));
    accepted(verify([owned(coin, infoRedeem, (pub, sig) => poolInfoSweepUnlocking(P, pub, sig))], [plain(1_000n)]));
    accepted(verify(
      [owned(coin, infoRedeem, (pub, sig) => poolInfoRotateUnlocking(P, pub, sig, newOwner))],
      [nft(infoLock, infoWith({ owner: newOwner }))],
    ));
  });

  it('refuses a sweep that outputs a pool-category NFT', () => {
    const sweep = owned(nft(infoLock, info), infoRedeem, (pub, sig) => poolInfoSweepUnlocking(P, pub, sig));
    refused(verify([sweep], [nft(anyoneLock, infoWith({ number: 1_000_000n }))]));
  });
});

describe('oracle pool slot', () => {
  it('admits an honest read', () => {
    accepted(verify([{ utxo: nft(slotLock, slot), unlock: () => poolSlotReadUnlocking(P) }], [nft(slotLock, slot)]));
  });

  it('admits a slot write, which clears the stop bit', () => {
    accepted(writeSlot(slot, 1_004n, 1_004));
    accepted(writeSlot(slotWith({ flags: POOL_FLAG_SLOT | POOL_FLAG_SLOT_STOPPED }), 1_008n, 1_010));
  });

  it('refuses a write not a multiple of depth, a rewind and a write ahead of the locktime', () => {
    refused(writeSlot(slot, 1_005n, 1_005));
    refused(writeSlot(slot, 996n, 1_004));
    refused(writeSlot(slot, 1_004n, 1_003));
  });

  it('admits a stop, a rotate and a sweep', () => {
    const coin = nft(slotLock, slot);
    accepted(verify(
      [owned(coin, slotRedeem, (pub, sig) => poolSlotStopUnlocking(P, pub, sig))],
      [nft(slotLock, slotWith({ flags: POOL_FLAG_SLOT | POOL_FLAG_SLOT_STOPPED }))],
    ));
    accepted(verify(
      [owned(coin, slotRedeem, (pub, sig) => poolSlotRotateUnlocking(P, pub, sig, newOwner))],
      [nft(slotLock, slotWith({ owner: newOwner }))],
    ));
    accepted(verify([owned(coin, slotRedeem, (pub, sig) => poolSlotSweepUnlocking(P, pub, sig))], [plain(1_000n)]));
  });
});

describe('oracle pool baton', () => {
  it('admits a mint of an info copy and a slot', () => {
    accepted(mint(minted()));
  });

  it('refuses a mint that adds a second minting output', () => {
    refused(mint([...minted(), nft(anyoneLock, baton, 'minting')]));
  });

  it('refuses a minted info coin unlike the co-spent one', () => {
    refused(mint(minted(infoWith({ number: 901n }))));
  });

  it('refuses a minted slot with the wrong owner or depth', () => {
    refused(mint(minted(info, slotWith({ hash: hashB, owner: newOwner }))));
    refused(mint(minted(info, slotWith({ hash: hashB, depth: 8 }))));
  });

  it('refuses a mint that carries a fungible amount of the pool category', () => {
    const outputs = minted();
    outputs[3] = { ...outputs[3]!, token: { ...outputs[3]!.token!, amount: 100n } };
    refused(mint(outputs, funder({ amount: 100n, category: P })));
  });

  it('admits an update and a sweep, and refuses either when it also mints', () => {
    const retuned = encodePoolBatonCommitment({ owner, depth: 8 });
    const retunedCoin = nft(batonLock, retuned, 'minting', P, 2_000n);
    const update = owned(batonCoin, batonRedeem, (pub, sig) => poolBatonUpdateUnlocking(P, pub, sig, retuned));
    const sweep = owned(batonCoin, batonRedeem, (pub, sig) => poolBatonSweepUnlocking(P, pub, sig));
    accepted(verify([update], [retunedCoin]));
    accepted(verify([sweep], [plain(1_500n)]));
    refused(verify([update, funder()], [retunedCoin, nft(slotLock, grown), plain(5_000n)], 1_000));
    refused(verify([sweep, funder()], [plain(5_000n), nft(slotLock, grown)], 1_000));
  });
});
