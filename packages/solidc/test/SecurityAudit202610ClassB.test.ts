/**
 * Hostile VM tests for the October 2026 class-B holes.
 * Each spend compiles through this worktree and is evaluated on the BCH 2026 VM.
 */
import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import { sha256 } from '@bitauth/libauth/build/lib/crypto/default-crypto-instances.js';
import {
  asmToScript, buildDataNftCovenantScript as buildDistDataNftCovenant, buildPushdataCommitment,
  encodeIntegerValue, scriptToBytecode, type AbiFunction,
} from '@solidcash/utils';
import { compileString } from '../src/index.js';
import SignatureTemplate from '../../solidcash/src/SignatureTemplate.js';
import { Contract } from '../../solidcash/src/Contract.js';
import { TransactionBuilder } from '../../solidcash/src/TransactionBuilder.js';
import { StatefulContract } from '../../solidcash/src/stateful/index.js';
import { createTestProvider } from '../../solidcash/test/test-util.js';
import p2pkhArtifact from '../../solidcash/test/fixture/p2pkh.artifact.js';
import { alicePriv, alicePub, alicePkh } from '../../solidcash/test/fixture/vars.js';
import {
  buildDataNftCovenantScript, buildEntryNftCovenantScript, buildSatoshiContainerCovenantScript,
  buildTokenContainerCovenantScript, buildValueChunkCovenantScript, buildValueChunkCommitment,
  computeCollectionHash, encodeChunkableValueTail, valueChunkSignature,
} from '../../utils/src/state.js';
import { encodeEntryCommitment, keyToSlot } from '../../solidcash/src/stateful/SortedList.js';
import {
  persistValueChunkLock, type ValueChunkWriteDescriptor,
} from '../../solidcash/src/stateful/value-chunk-persist.js';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
type SourceOutputs = NonNullable<VmProgram['sourceOutputs']>;

const CATEGORY = Uint8Array.from({ length: 32 }, (_, i) => (0x29 + i * 17) & 0xff);
const VALUE = 20_000n;
const vm = createVirtualMachineBch2026();
const num = (value: bigint): Uint8Array => encodeIntegerValue(value);

function p2sh32(redeem: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(redeem));
}

function tokenOf(
  capability: 'minting' | 'mutable' | 'none', commitment: Uint8Array, category = CATEGORY,
): VmOutput['token'] {
  return { category, amount: 0n, nft: { capability, commitment } };
}

function input(
  index: number, unlockingBytecode: Uint8Array, outpointTransactionHash?: Uint8Array,
): VmTransaction['inputs'][number] {
  const hash = outpointTransactionHash ?? new Uint8Array(32);
  if (!outpointTransactionHash) hash[0] = index + 1;
  return { outpointIndex: 0, outpointTransactionHash: hash, sequenceNumber: 0xffffffff, unlockingBytecode };
}

function pushesOf(values: readonly Uint8Array[]): Uint8Array {
  return new Uint8Array(values.flatMap((value) => [...encodeDataPush(value)]));
}

function redeemUnlock(
  fn: AbiFunction, redeem: Uint8Array, values: Record<string, Uint8Array>, dispatch: boolean,
): Uint8Array {
  const args = fn.inputs.map((entry) => {
    const value = values[entry.name];
    if (value === undefined) throw new Error(`no value for ${fn.name}.${entry.name}`);
    return value;
  }).reverse();
  if (dispatch && fn.selector) args.unshift(hexToBin(fn.selector));
  return new Uint8Array([...pushesOf(args), ...encodeDataPush(redeem)]);
}

function verdict(sourceOutputs: SourceOutputs, transaction: VmTransaction): true | string {
  return vm.verify({ sourceOutputs, transaction });
}

describe('October 2026 class B holes', () => {
  it('CRYPTO-4 a second minting baton cannot rewrite a data record, and a contract-sized master can', () => {
    const artifact = compileString(
      'pragma solidcash ^0.14.0; contract C { int n; function touch() { this.n = this.n + 1; require(true); } }',
      { messageBus: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'touch');
    if (!fn || !artifact.stateLayout) throw new Error('touch has no layout');
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    const masterLock = p2sh32(redeem);
    const dataRedeem = scriptToBytecode(buildDataNftCovenantScript(CATEGORY, masterLock));
    const dataLock = p2sh32(dataRedeem);
    const before = hexToBin(buildPushdataCommitment(artifact.stateLayout, { n: 1n }, 0));
    const after = hexToBin(buildPushdataCommitment(artifact.stateLayout, { n: 2n }, 0));
    const forged = Uint8Array.of(9, 9, 9);
    const values: Record<string, Uint8Array> = {};
    for (const entry of fn.inputs) {
      if (entry.name.includes('vmapBatchSlot')) values[entry.name] = new Uint8Array(32);
      else if (entry.name.includes('vmapBatchProof')) values[entry.name] = num(1n);
      else if (entry.name.includes('vmapBatchNext')) values[entry.name] = new Uint8Array(32);
      else if (entry.name.includes('vmapBatchPredOut')) values[entry.name] = num(-1n);
      else if (entry.name.includes('TrailingCount')) values[entry.name] = num(0n);
      else if (entry.name.startsWith('__internal__')) values[entry.name] = new Uint8Array();
      else throw new Error(`unexpected touch input ${entry.name}`);
    }
    const dataUnlock = pushesOf([num(0n), num(1n), dataRedeem]);
    const honest: VmTransaction = {
      version: 2, locktime: 0,
      inputs: [
        input(0, redeemUnlock(fn, redeem, values, true)),
        input(1, dataUnlock),
        input(2, new Uint8Array()),
      ],
      outputs: [
        { lockingBytecode: masterLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', after) },
        { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 40_000n },
      ],
    };
    const honestSources: SourceOutputs = [
      { lockingBytecode: masterLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', before) },
      { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 100_000n },
    ];
    const batonLock = hexToBin('aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087');
    const batonUnlock = hexToBin('0151');
    const paddedRedeem = Uint8Array.of(0x75, 0x51);
    const paddedLock = p2sh32(paddedRedeem);
    const paddedUnlock = pushesOf([new Uint8Array(160), paddedRedeem]);
    const forgedSpend = (authorityLock: Uint8Array, authorityUnlock: Uint8Array): true | string => verdict([
      { lockingBytecode: authorityLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', before) },
    ], {
      version: 2, locktime: 0,
      inputs: [input(0, authorityUnlock), input(1, dataUnlock)],
      outputs: [
        { lockingBytecode: authorityLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: dataLock, valueSatoshis: VALUE, token: tokenOf('mutable', forged) },
      ],
    });
    expect(verdict(honestSources, honest), 'CRYPTO-4 authorized').toBe(true);
    expect(forgedSpend(paddedLock, paddedUnlock), 'CRYPTO-4 padded non-master').not.toBe(true);
    expect(forgedSpend(batonLock, batonUnlock), 'CRYPTO-4 keeper baton').not.toBe(true);
    const longRedeem = Uint8Array.from({ length: 180 }, (_, index) => (index === 179 ? 0x51 : 0x61));
    const longLock = p2sh32(longRedeem);
    const longUnlock = pushesOf([longRedeem]);
    expect(forgedSpend(longLock, longUnlock), 'CRYPTO-4 long non-master').not.toBe(true);
    const entryHash = Uint8Array.from({ length: 20 }, (_, index) => index + 1);
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, entryHash, masterLock));
    const rewrite = (covenantRedeem: Uint8Array, authorityLock: Uint8Array, authorityUnlock: Uint8Array): true | string => {
      const covenantLock = p2sh32(covenantRedeem);
      return verdict([
        { lockingBytecode: authorityLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: covenantLock, valueSatoshis: VALUE, token: tokenOf('mutable', before) },
      ], {
        version: 2, locktime: 0,
        inputs: [input(0, authorityUnlock), input(1, pushesOf([num(0n), num(1n), covenantRedeem]))],
        outputs: [
          { lockingBytecode: authorityLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
          { lockingBytecode: covenantLock, valueSatoshis: VALUE, token: tokenOf('mutable', forged) },
        ],
      });
    };
    expect(rewrite(entryRedeem, longLock, longUnlock), 'CRYPTO-4 entry long non-master').not.toBe(true);
    expect(rewrite(entryRedeem, batonLock, batonUnlock), 'CRYPTO-4 entry baton').not.toBe(true);
    expect(rewrite(entryRedeem, paddedLock, paddedUnlock), 'CRYPTO-4 entry pad').not.toBe(true);
    const drain = (
      containerRedeem: Uint8Array, drained: VmOutput, authorityLock = batonLock, authorityUnlock = batonUnlock,
    ): true | string => {
      const containerLock = p2sh32(containerRedeem);
      return verdict([
        { lockingBytecode: authorityLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: containerLock, valueSatoshis: 50_000n, token: drained.token },
      ], {
        version: 2, locktime: 0,
        inputs: [input(0, authorityUnlock), input(1, pushesOf([num(0n), num(1n), containerRedeem]))],
        outputs: [
          { lockingBytecode: authorityLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
          drained,
        ],
      });
    };
    const foreign = Uint8Array.from({ length: 32 }, (_, i) => (0x44 + i * 13) & 0xff);
    const satoshiRedeem = scriptToBytecode(buildSatoshiContainerCovenantScript(CATEGORY, masterLock));
    const tokenRedeem = scriptToBytecode(buildTokenContainerCovenantScript(CATEGORY, foreign, masterLock));
    const satoshiDrain = { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 50_000n };
    const tokenDrain = {
      lockingBytecode: Uint8Array.of(0x51), valueSatoshis: VALUE, token: { category: foreign, amount: 1_000n },
    };
    expect(drain(satoshiRedeem, satoshiDrain), 'CRYPTO-4 baton satoshi drain').not.toBe(true);
    expect(drain(satoshiRedeem, satoshiDrain, longLock, longUnlock), 'CRYPTO-4 long satoshi drain').not.toBe(true);
    expect(drain(satoshiRedeem, satoshiDrain, paddedLock, paddedUnlock), 'CRYPTO-4 pad satoshi drain').not.toBe(true);
    expect(drain(tokenRedeem, tokenDrain), 'CRYPTO-4 baton token drain').not.toBe(true);
    expect(drain(tokenRedeem, tokenDrain, longLock, longUnlock), 'CRYPTO-4 long token drain').not.toBe(true);
    const opener = Uint8Array.of(0x51);
    const openerLock = p2sh32(opener);
    const openerUnlock = pushesOf([opener]);
    const openerEntry = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, entryHash, openerLock));
    expect(rewrite(openerEntry, openerLock, openerUnlock), 'CRYPTO-4 entry bound master').toBe(true);
    const openerSatoshi = scriptToBytecode(buildSatoshiContainerCovenantScript(CATEGORY, openerLock));
    const openerSatoshiLock = p2sh32(openerSatoshi);
    expect(drain(openerSatoshi, {
      lockingBytecode: openerSatoshiLock, valueSatoshis: 40_000n,
    }, openerLock, openerUnlock), 'DX-1 bound master keeps the container lock').toBe(true);
    expect(drain(openerSatoshi, satoshiDrain, openerLock, openerUnlock), 'DX-1 satoshi bound master').not.toBe(true);
    const openerToken = scriptToBytecode(buildTokenContainerCovenantScript(CATEGORY, foreign, openerLock));
    const openerTokenLock = p2sh32(openerToken);
    expect(drain(openerToken, {
      lockingBytecode: openerTokenLock, valueSatoshis: VALUE,
      token: { category: foreign, amount: 600n },
    }, openerLock, openerUnlock), 'DX-2 bound master keeps the token container').toBe(true);
    expect(drain(openerToken, tokenDrain, openerLock, openerUnlock), 'DX-2 token bound master').not.toBe(true);
    const categoryId = binToHex(CATEGORY);
    const collection = 'rec';
    const chunkSlot = new Uint8Array(32);
    const chunkValue = Uint8Array.from({ length: 61 }, (_, index) => index + 1);
    const chunkWrite: ValueChunkWriteDescriptor = {
      categoryId,
      collection,
      collectionSignature: `${collection}:mapping(bytes32 => bytes)`,
      collectionHash: binToHex(computeCollectionHash(`${collection}:mapping(bytes32 => bytes)`)),
      keySlot: binToHex(chunkSlot),
      entryAccessSlot: 0,
      routeSlot: 0,
      operation: 'insert',
      outputBase: 0,
      outputCount: 1,
    };
    const published = persistValueChunkLock(categoryId, chunkValue, chunkWrite, openerLock);
    if (!published) throw new Error('message-bus value chunk published no lock');
    const publishedRedeem = scriptToBytecode(buildValueChunkCovenantScript(
      CATEGORY, computeCollectionHash(valueChunkSignature(collection)), chunkSlot,
      sha256.hash(chunkValue), openerLock,
    ));
    expect(published, 'CRYPTO-4 published value chunk lock').toEqual(p2sh32(publishedRedeem));
    const contractPublished = persistValueChunkLock(categoryId, chunkValue, chunkWrite, masterLock);
    if (!contractPublished) throw new Error('contract-bound value chunk published no lock');
    const contractRedeem = scriptToBytecode(buildValueChunkCovenantScript(
      CATEGORY, computeCollectionHash(valueChunkSignature(collection)), chunkSlot,
      sha256.hash(chunkValue), masterLock,
    ));
    expect(contractPublished, 'CRYPTO-4 contract value chunk lock').toEqual(p2sh32(contractRedeem));
    const spendLocked = (
      chunkLock: Uint8Array, chunkRedeem: Uint8Array, authorityLock: Uint8Array, authorityUnlock: Uint8Array,
    ): true | string => verdict([
      { lockingBytecode: authorityLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      { lockingBytecode: chunkLock, valueSatoshis: VALUE, token: tokenOf('mutable', before) },
    ], {
      version: 2, locktime: 0,
      inputs: [input(0, authorityUnlock), input(1, pushesOf([num(0n), num(1n), chunkRedeem]))],
      outputs: [
        { lockingBytecode: authorityLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: chunkLock, valueSatoshis: VALUE, token: tokenOf('mutable', forged) },
      ],
    });
    expect(spendLocked(contractPublished, contractRedeem, longLock, longUnlock), 'CRYPTO-4 value chunk long non-master')
      .not.toBe(true);
    expect(spendLocked(contractPublished, contractRedeem, batonLock, batonUnlock), 'CRYPTO-4 value chunk baton')
      .not.toBe(true);
    expect(spendLocked(published, publishedRedeem, openerLock, openerUnlock), 'CRYPTO-4 value chunk bound master')
      .toBe(true);
  });

  it('CRYPTO-4 a compiler-built value chunk rejects a long non-master minting NFT, and the bound master can', () => {
    const artifact = compileString(
      'pragma solidcash ^0.14.0; contract C { enumerable mapping(bytes32 => bytes) rec;'
      + ' function write(bytes32 k, bytes v) { this.rec[k] = v; require(true); } }',
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'write');
    if (!fn) throw new Error(`no write; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    if (redeem.length > 10_000) throw new Error(`write redeem is ${redeem.length} bytes`);
    const masterLock = p2sh32(redeem);
    const tagHex = [...'value-chunk'].map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    expect(artifact.bytecode.includes(tagHex), 'compiler emits the value-chunk domain').toBe(true);
    const collection = artifact.stateLayout?.collections?.find((entry) => entry.name === 'rec');
    if (!collection) throw new Error('no rec collection');
    const key = new Uint8Array(32);
    key[0] = 7;
    const value = new Uint8Array(61);
    value[60] = 9;
    const slot = keyToSlot(key);
    const root = sha256.hash(value);
    const zero = new Uint8Array(32);
    const collectionHash = computeCollectionHash(valueChunkSignature('rec'));
    const chunkRedeem = scriptToBytecode(buildValueChunkCovenantScript(
      CATEGORY, collectionHash, slot, root, masterLock,
    ));
    const chunkLock = p2sh32(chunkRedeem);
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(
      CATEGORY, computeCollectionHash(collection.signature), masterLock,
    ));
    const entryLock = p2sh32(entryRedeem);
    const longRedeem = Uint8Array.from({ length: 180 }, (_, index) => (index === 179 ? 0x51 : 0x61));
    const longLock = p2sh32(longRedeem);
    const longUnlock = pushesOf([longRedeem]);
    const chunkData = value.slice(28);
    const chunkCommitment = hexToBin(buildValueChunkCommitment(0, chunkData));
    const forgedCommitment = Uint8Array.from(chunkCommitment);
    forgedCommitment[2] = 0xff;
    const attack = verdict([
      { lockingBytecode: longLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      { lockingBytecode: chunkLock, valueSatoshis: VALUE, token: tokenOf('mutable', chunkCommitment) },
    ], {
      version: 2, locktime: 0,
      inputs: [
        input(0, longUnlock),
        input(1, pushesOf([num(0n), num(1n), chunkRedeem])),
      ],
      outputs: [
        { lockingBytecode: longLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: chunkLock, valueSatoshis: VALUE, token: tokenOf('mutable', forgedCommitment) },
      ],
    });
    expect(attack, 'CRYPTO-4 compiler value chunk long non-master').not.toBe(true);
    const values: Record<string, Uint8Array> = {
      k: key,
      v: value,
      __internal__vmapBatchSlot_0: slot,
      __internal__vmapBatchProof_0: num(1n),
      __internal__vmapBatchNext_0: zero,
      // An in-place update. predOut -2 is the inactive-row sentinel and skips the write.
      __internal__vmapBatchPredOut_0: num(-1n),
      __internal__vmapBatchTrailingCount: num(0n),
      __internal__valueWitness_0: new Uint8Array(),
      __internal__leadingPushValue_0: new Uint8Array(),
      __internal__valueChunkOutputBase: num(2n),
    };
    const before = encodeEntryCommitment(slot, zero, encodeChunkableValueTail(Uint8Array.of(3)));
    const after = encodeEntryCommitment(slot, zero, encodeChunkableValueTail(value));
    const honest = verdict([
      { lockingBytecode: masterLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', before) },
      { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: VALUE },
    ], {
      version: 2, locktime: 0,
      inputs: [
        input(0, redeemUnlock(fn, redeem, values, false)),
        input(1, pushesOf([num(0n), num(1n), entryRedeem])),
        input(2, new Uint8Array()),
      ],
      outputs: [
        { lockingBytecode: masterLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: entryLock, valueSatoshis: VALUE, token: tokenOf('mutable', after) },
        { lockingBytecode: chunkLock, valueSatoshis: VALUE, token: tokenOf('mutable', chunkCommitment) },
      ],
    });
    expect(honest, 'CRYPTO-4 compiler value chunk authorized').toBe(true);
  });

  it('CRYPTO-4 a second long value chunk cannot be an unbound lock, and both bound chunks can', () => {
    const artifact = compileString(
      'pragma solidcash ^0.14.0; contract C {'
      + ' enumerable mapping(bytes32 => bytes) a; enumerable mapping(bytes32 => bytes) b;'
      + ' function write(bytes32 k, bytes v, bytes32 k2, bytes w) {'
      + ' this.a[k] = v; this.b[k2] = w; require(true); } }',
      { messageBus: false, forceStateful: true },
    );
    const fn = artifact.abi.find((entry) => entry.name === 'write');
    if (!fn) throw new Error(`no write; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    if (redeem.length > 10_000) throw new Error(`double write redeem is ${redeem.length} bytes`);
    const masterLock = p2sh32(redeem);
    const entries = [...(fn.blockLayout?.slots ?? [])].filter((slot) => slot.kind === 'entry')
      .sort((left, right) => left.offset - right.offset);
    if (entries.length !== 2 || entries[0].slotIndex !== 0 || entries[1].slotIndex !== 1) {
      throw new Error(`entry slots ${JSON.stringify(fn.blockLayout ?? null)}`);
    }
    const collectionA = artifact.stateLayout?.collections?.find((entry) => entry.name === 'a');
    const collectionB = artifact.stateLayout?.collections?.find((entry) => entry.name === 'b');
    if (!collectionA || !collectionB) throw new Error('missing collections');
    const keyA = new Uint8Array(32);
    keyA[0] = 7;
    const keyB = new Uint8Array(32);
    keyB[0] = 9;
    const valueA = new Uint8Array(61);
    valueA[60] = 4;
    const valueB = new Uint8Array(61);
    valueB[60] = 5;
    const zero = new Uint8Array(32);
    const slotA = keyToSlot(keyA);
    const slotB = keyToSlot(keyB);
    const chunkOf = (name: string, slot: Uint8Array, value: Uint8Array, lock?: Uint8Array): Uint8Array => {
      const redeemScript = scriptToBytecode(buildValueChunkCovenantScript(
        CATEGORY, computeCollectionHash(valueChunkSignature(name)), slot, sha256.hash(value), lock,
      ));
      return p2sh32(redeemScript);
    };
    const entryOf = (signature: string): { redeem: Uint8Array; lock: Uint8Array } => {
      const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(
        CATEGORY, computeCollectionHash(signature), masterLock,
      ));
      return { redeem: entryRedeem, lock: p2sh32(entryRedeem) };
    };
    const entryA = entryOf(collectionA.signature);
    const entryB = entryOf(collectionB.signature);
    const chunkA = chunkOf('a', slotA, valueA, masterLock);
    const chunkB = chunkOf('b', slotB, valueB, masterLock);
    const unboundB = chunkOf('b', slotB, valueB);
    const commit = (value: Uint8Array): Uint8Array => hexToBin(buildValueChunkCommitment(0, value.slice(28)));
    const values: Record<string, Uint8Array> = {};
    for (const entry of fn.inputs) {
      const name = entry.name;
      if (name === 'k') values[name] = keyA;
      else if (name === 'k2') values[name] = keyB;
      else if (name === 'v') values[name] = valueA;
      else if (name === 'w') values[name] = valueB;
      else if (name === '__internal__vmapBatchSlot_0') values[name] = slotA;
      else if (name === '__internal__vmapBatchSlot_1') values[name] = slotB;
      else if (name === '__internal__vmapBatchProof_0') values[name] = num(BigInt(entries[0].offset));
      else if (name === '__internal__vmapBatchProof_1') values[name] = num(BigInt(entries[1].offset));
      else if (name.includes('vmapBatchNext')) values[name] = zero;
      else if (name.includes('vmapBatchPredOut')) values[name] = num(-1n);
      else if (name === '__internal__vmapBatchTrailingCount' || name === '__internal__valueChunkOutputBase') {
        values[name] = num(0n);
      } else if (name.startsWith('__internal__')) values[name] = new Uint8Array();
      else throw new Error(`unexpected write input ${name}`);
    }
    const beforeA = encodeEntryCommitment(slotA, zero, encodeChunkableValueTail(Uint8Array.of(1)));
    const beforeB = encodeEntryCommitment(slotB, zero, encodeChunkableValueTail(Uint8Array.of(2)));
    const afterA = encodeEntryCommitment(slotA, zero, encodeChunkableValueTail(valueA));
    const afterB = encodeEntryCommitment(slotB, zero, encodeChunkableValueTail(valueB));
    const spend = (secondChunk: Uint8Array): true | string => verdict([
      { lockingBytecode: masterLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
      { lockingBytecode: entryA.lock, valueSatoshis: VALUE, token: tokenOf('mutable', beforeA) },
      { lockingBytecode: entryB.lock, valueSatoshis: VALUE, token: tokenOf('mutable', beforeB) },
      { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: VALUE * 2n },
    ], {
      version: 2, locktime: 0,
      inputs: [
        input(0, redeemUnlock(fn, redeem, values, false)),
        input(1, pushesOf([num(0n), num(1n), entryA.redeem])),
        input(2, pushesOf([num(0n), num(1n), entryB.redeem])),
        input(3, new Uint8Array()),
      ],
      outputs: [
        { lockingBytecode: masterLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: entryA.lock, valueSatoshis: VALUE, token: tokenOf('mutable', afterA) },
        { lockingBytecode: entryB.lock, valueSatoshis: VALUE, token: tokenOf('mutable', afterB) },
        { lockingBytecode: chunkA, valueSatoshis: VALUE, token: tokenOf('mutable', commit(valueA)) },
        { lockingBytecode: secondChunk, valueSatoshis: VALUE, token: tokenOf('mutable', commit(valueB)) },
      ],
    });
    expect(spend(unboundB), 'CRYPTO-4 second value chunk unbound').not.toBe(true);
    expect(spend(chunkB), 'CRYPTO-4 both value chunks authorized').toBe(true);
  });

  it('DX-8 a delegate call cannot rewrite the implementation record, and the preserved record can', () => {
    const P = 'pragma solidcash ^0.14.0;';
    const artifact = compileString(
      `${P} contract C() { bigint counter; function touch() public { this.counter = this.counter + 1; require(true); } }`,
    ).delegateArtifact;
    if (!artifact) throw new Error('no delegate artifact');
    const fn = artifact.abi.find((entry) => entry.name === 'touch');
    if (!fn) throw new Error(`no touch; ${artifact.abi.map((entry) => entry.name).join(',')}`);
    const dataSlot = fn.blockLayout?.slots.find((slot) => slot.kind === 'dataNft');
    if (fn.blockLayout?.blockSize !== 2 || dataSlot?.offset !== 1) {
      throw new Error(`unexpected delegate layout ${JSON.stringify(fn.blockLayout ?? null)}`);
    }
    const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
    if (redeem.length > 10_000) throw new Error(`delegate redeem is ${redeem.length} bytes`);
    const delegateLock = p2sh32(redeem);
    const proxyRedeem = Uint8Array.of(0x51);
    const proxyLock = p2sh32(proxyRedeem);
    const proxyCategory = Uint8Array.from({ length: 32 }, (_, i) => (0x11 + i * 3) & 0xff);
    const field = artifact.stateLayout?.variables[0];
    if (!field || !artifact.stateLayout) throw new Error('no delegate state layout');
    const commitment = (value: bigint): Uint8Array => hexToBin(
      buildPushdataCommitment(artifact.stateLayout!, { [field.name]: value }, 0),
    );
    const proxyDataRedeem = scriptToBytecode(buildDistDataNftCovenant(proxyCategory, proxyLock));
    const proxyDataLock = p2sh32(proxyDataRedeem);
    const recordRedeem = scriptToBytecode(buildDistDataNftCovenant(CATEGORY, delegateLock));
    const recordLock = p2sh32(recordRedeem);
    // The delegate redeem defines the body and dispatches on a 4-byte selector even when it publishes no
    // message-bus route. The selector is the bottom witness item.
    const dispatch = fn.selector !== undefined;
    const values: Record<string, Uint8Array> = {};
    for (const entry of fn.inputs) {
      if (entry.name === '__internal__proxyMasterIndex') values[entry.name] = num(0n);
      else throw new Error(`unexpected delegate input ${entry.name}`);
    }
    // The prologue requires proxyIndex == INPUTINDEX - (1 + dataNftCount). The proxy block is inputs 0 and 1,
    // so the implementation master is input 2. Its own record sits after that block.
    const delegateIndex = 2;
    const record = Uint8Array.of(1, 2, 3);
    const rewritten = Uint8Array.of(9, 9, 9);
    const spend = (recordOut: Uint8Array): true | string => {
      const transaction: VmTransaction = {
        version: 2, locktime: 0,
        inputs: [
          input(0, encodeDataPush(proxyRedeem)),
          input(1, pushesOf([num(0n), num(1n), proxyDataRedeem])),
          input(delegateIndex, redeemUnlock(fn, redeem, values, dispatch)),
          input(3, pushesOf([num(BigInt(delegateIndex)), num(1n), recordRedeem])),
        ],
        outputs: [
          { lockingBytecode: proxyLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array(), proxyCategory) },
          { lockingBytecode: proxyDataLock, valueSatoshis: VALUE, token: tokenOf('mutable', commitment(1n), proxyCategory) },
          { lockingBytecode: delegateLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
          { lockingBytecode: recordLock, valueSatoshis: VALUE, token: tokenOf('mutable', recordOut) },
        ],
      };
      const sourceOutputs: SourceOutputs = [
        { lockingBytecode: proxyLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array(), proxyCategory) },
        { lockingBytecode: proxyDataLock, valueSatoshis: VALUE, token: tokenOf('mutable', commitment(0n), proxyCategory) },
        { lockingBytecode: delegateLock, valueSatoshis: VALUE, token: tokenOf('minting', new Uint8Array()) },
        { lockingBytecode: recordLock, valueSatoshis: VALUE, token: tokenOf('mutable', record) },
      ];
      return verdict(sourceOutputs, transaction);
    };
    expect(spend(record), `DX-8 authorized bus=${dispatch} redeem=${redeem.length}`).toBe(true);
    expect(spend(rewritten), 'DX-8 rewritten implementation record').not.toBe(true);
  });

  it('DX-7 a factory genesis cannot mint an extra child-category coin, and the declared genesis can', async () => {
    const P = 'pragma solidcash ^0.14.0;';
    const src = `${P} contract Child() { bigint x; function ping() { require(true); } }`
      + ' contract Factory() { function create() { Child c = new Child(); require(c.length > 0); } }';
    // The kernel route's witness is a composed batch. This spend is the direct deploy epilogue, which holds
    // the child-category bound. A direct deploy entry needs the unsafe opt-out when it has no signer.
    const options = { messageBus: false as const, forceStateful: true, allowUnsafeOperations: true };
    const factoryArtifact = compileString(src, { ...options, primaryContractName: 'Factory' });
    const childArtifact = compileString(src, { ...options, primaryContractName: 'Child' });
    const originalSend = TransactionBuilder.prototype.send;
    let injectCategory: string | undefined;
    TransactionBuilder.prototype.send = async function send(this: TransactionBuilder, raw?: true) {
      if (injectCategory !== undefined) {
        const category = injectCategory;
        injectCategory = undefined;
        const change = this.outputs.find((output) => output.token === undefined && output.amount > 2_000n);
        if (!change) throw new Error('no change output to fund the forged coin');
        change.amount -= 1_000n;
        this.addOutput({
          to: Uint8Array.of(0x51),
          amount: 1_000n,
          token: { amount: 0n, category, nft: { capability: 'none', commitment: '09' } },
        });
      }
      return originalSend.call(this, raw as true);
    } as typeof TransactionBuilder.prototype.send;
    const outcome = async (inject: boolean): Promise<string> => {
      const provider = createTestProvider();
      const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
      const parentFunding = { txid: '11'.repeat(32), vout: 0, satoshis: 200_000n };
      await provider.addUtxo(p2pkh.address, parentFunding);
      const deployed = await StatefulContract.deploy(factoryArtifact, [], {
        provider,
        fundingUtxo: parentFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: {},
        changeAddress: p2pkh.address,
      });
      const childFunding = { txid: '22'.repeat(32), vout: 0, satoshis: 80_000n };
      await provider.addUtxo(p2pkh.address, childFunding);
      injectCategory = inject ? childFunding.txid : undefined;
      try {
        await StatefulContract.deployFrom({
          provider,
          factory: deployed.contract,
          deployFunctionName: 'create',
          deployFunctionArgs: [],
          childArtifact,
          childConstructorArgs: [],
          childInitialState: { x: 0n },
          fundingUtxo: childFunding,
          funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
          changeAddress: p2pkh.address,
        });
        return 'accepted';
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };
    try {
      expect(await outcome(false), 'DX-7 authorized').toBe('accepted');
      expect(await outcome(true), 'DX-7 forged child coin').not.toBe('accepted');
    } finally {
      TransactionBuilder.prototype.send = originalSend;
    }
  });
});
