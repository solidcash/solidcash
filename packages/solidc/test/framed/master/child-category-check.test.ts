import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import {
  CHILD_GENESIS_MINTING, CHILD_GENESIS_MUTABLE, childGenesisChain, sha256, type ChildGenesisChainOutput,
} from '@solidcash/utils';
import { childGenesisChainsScript } from '../../../src/framed/master/child-category-check.js';
import { compositionMachine } from '../machine.js';

/**
 * The creating body's fold of the outputs of the child's category, on its own: a synthetic transaction whose outputs
 * are the child's genesis, run through the script the compiler emits (docs/framed/CREATE2_IDENTITY.md, "The genesis
 * replay").
 *
 * The fold's contract is `[K]` → `[K, others, masters]`: the outputs of `K`, last first, chained into the minting
 * NFTs' digest and the rest's. The test requires both to equal the chains `childGenesisChain` computes over the
 * genesis it expects, which is what the creating body does with the masters' chain its deployment filled and the
 * chain it computes itself. So an output of `K` that is added, dropped, doubled, moved or recommitted is refused, and
 * so is one that is no mutable or minting NFT, carries a fungible amount or sits at a lock that is not 35 bytes.
 * The transaction stores the category in display order; the body's `K` is the chain order, its reverse.
 */

const DISPLAY = Uint8Array.from({ length: 32 }, (_value, index) => 0x30 + index);
// `K` is the order the outpoint read and the token introspection answer; the transaction's category lives in the
// order the VM reverses on the way out.
const INTERNAL = Uint8Array.from(DISPLAY).reverse();
const K = Uint8Array.from(DISPLAY);
const OTHER = Uint8Array.from({ length: 32 }, (_value, index) => 0x70 + index);
const lock = (fill: number): Uint8Array => Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(fill), 0x87]);
const AUTHHEAD = lock(0x23);
const MASTER_A = lock(0x31);
const MASTER_B = lock(0x32);
const VALIDATOR = lock(0x21);
const RECORD = lock(0x22);
const HEAD = lock(0x44);
const FOREIGN = lock(0x11);
const P2PKH = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x11), 0x88, 0xac]);

type Capability = 'none' | 'mutable' | 'minting';
type Token = { category: Uint8Array; amount: bigint; nft?: { capability: Capability; commitment: string } };
type Output = { lockingBytecode: Uint8Array; valueSatoshis: bigint; token?: Token };

const nft = (capability: Capability, commitment = ''): Token =>
  ({ category: INTERNAL, amount: 0n, nft: { capability, commitment } });

/** A child's genesis as a creation lays it down: authhead, masters, validator, records, a head, then other outputs. */
function genesis(): Output[] {
  return [
    { lockingBytecode: AUTHHEAD, valueSatoshis: 1200n, token: nft('mutable', '76a914'.padEnd(50, '0')) },
    { lockingBytecode: MASTER_A, valueSatoshis: 1200n, token: nft('minting') },
    { lockingBytecode: MASTER_A, valueSatoshis: 1200n, token: nft('minting') },
    { lockingBytecode: MASTER_B, valueSatoshis: 1200n, token: nft('minting') },
    { lockingBytecode: MASTER_B, valueSatoshis: 1200n, token: nft('minting') },
    { lockingBytecode: VALIDATOR, valueSatoshis: 1200n, token: nft('mutable') },
    { lockingBytecode: P2PKH, valueSatoshis: 10_000n },
    { lockingBytecode: RECORD, valueSatoshis: 1200n, token: nft('mutable', '00510203') },
    { lockingBytecode: RECORD, valueSatoshis: 1200n, token: nft('mutable', '5100') },
    { lockingBytecode: HEAD, valueSatoshis: 1200n, token: nft('mutable', '00'.repeat(128)) },
    {
      lockingBytecode: P2PKH, valueSatoshis: 1_000n,
      token: { category: OTHER, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    },
  ];
}

/** The chains `childGenesisChain` gives the outputs of `K` among `outputs`: the rest's, then the masters'. */
function chains(outputs: Output[]): { others: Uint8Array; masters: Uint8Array } {
  const ofK = outputs.filter((output) => output.token?.category === INTERNAL).map((output): ChildGenesisChainOutput => ({
    capability: output.token!.nft!.capability === 'minting' ? CHILD_GENESIS_MINTING : CHILD_GENESIS_MUTABLE,
    lockingBytecode: output.lockingBytecode,
    commitment: hexToBin(output.token!.nft!.commitment),
  }));
  return {
    others: childGenesisChain(ofK.filter((output) => output.capability !== CHILD_GENESIS_MINTING)),
    masters: childGenesisChain(ofK.filter((output) => output.capability === CHILD_GENESIS_MINTING)),
  };
}

/** The fixture's commitments are hex for the JS chain; the VM's outputs carry bytes. */
function vmOutputs(outputs: Output[]): Output[] {
  return outputs.map((output) => output.token === undefined ? output : {
    ...output,
    token: {
      ...output.token,
      ...(output.token.nft === undefined ? {} : {
        nft: { ...output.token.nft, commitment: hexToBin(output.token.nft.commitment) },
      }),
    },
  } as Output);
}

/** Whether the fold over `outputs` gives the chains of `expected`, the honest genesis unless stated. */
function accepted(outputs: Output[], expected: Output[] = genesis()): boolean {
  const { others, masters } = chains(expected);
  const script = Uint8Array.from([
    ...childGenesisChainsScript(0),
    ...encodeDataPush(masters), Opcodes.OP_EQUALVERIFY,
    ...encodeDataPush(others), Opcodes.OP_EQUALVERIFY,
    Opcodes.OP_DROP, Opcodes.OP_1,
  ]);
  const transaction = {
    version: 2,
    inputs: [{
      outpointTransactionHash: new Uint8Array(32).fill(9), outpointIndex: 0, sequenceNumber: 0,
      unlockingBytecode: Uint8Array.from(encodeDataPush(K)),
    }],
    outputs: vmOutputs(outputs),
    locktime: 0,
  };
  const sourceOutputs = [{ lockingBytecode: script, valueSatoshis: 1_000n }];
  const state = compositionMachine().evaluate({ inputIndex: 0, sourceOutputs, transaction } as never);
  return (state as { error?: unknown }).error === undefined;
}

const binToHexOf = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/** The honest genesis with output `index` changed. */
const replaced = (index: number, output: Partial<Output>): Output[] => {
  const outputs = genesis();
  outputs[index] = { ...outputs[index]!, ...output };
  return outputs;
};

describe('the creating body\'s fold of the child\'s category outputs', () => {
  it('accepts the genesis it expects, whatever other categories the transaction carries', () => {
    expect(accepted(genesis())).toBe(true);
  });

  it('chains the masters apart from the rest, so each compares with its own constant', () => {
    const { others, masters } = chains(genesis());
    expect(masters).not.toEqual(others);
    // The chain the fold computes over an honest genesis is not one the expectation of another genesis accepts.
    expect(accepted(genesis(), genesis().filter((_output, index) => index !== 5))).toBe(false);
  });

  it('refuses a master moved to a lock the genesis does not name', () => {
    expect(accepted(replaced(3, { lockingBytecode: FOREIGN }))).toBe(false);
  });

  it('refuses a master doubled, and a master dropped', () => {
    const doubled = genesis();
    doubled.splice(2, 0, { lockingBytecode: MASTER_A, valueSatoshis: 1200n, token: nft('minting') });
    expect(accepted(doubled)).toBe(false);
    const dropped = genesis();
    dropped.splice(4, 1);
    expect(accepted(dropped)).toBe(false);
  });

  it('refuses a missing validator', () => {
    expect(accepted(genesis().filter((_output, index) => index !== 5))).toBe(false);
  });

  it('refuses a record whose commitment the folded state does not give', () => {
    expect(accepted(replaced(7, { token: nft('mutable', '00510204') }))).toBe(false);
    // Bricking a pair takes no more than one changed byte of its lock flag.
    expect(accepted(replaced(8, { token: nft('mutable', '5101') }))).toBe(false);
  });

  it('refuses an extra output of the child\'s category, even at a lock and with a commitment the genesis uses', () => {
    expect(accepted([...genesis(), { lockingBytecode: RECORD, valueSatoshis: 1200n, token: nft('mutable', '5100') }]))
      .toBe(false);
    expect(accepted([...genesis(), { lockingBytecode: HEAD, valueSatoshis: 1200n, token: nft('mutable', '00'.repeat(128)) }]))
      .toBe(false);
  });

  it('refuses a head swapped for a node of the same collection', () => {
    // A mapping node at the collection's lock in place of its empty head: same count and lock, another commitment.
    expect(accepted(replaced(9, { token: nft('mutable', '11'.repeat(128)) }))).toBe(false);
  });

  it('refuses a minting NFT where the genesis has a mutable one', () => {
    expect(accepted(replaced(5, { token: nft('minting') }))).toBe(false);
  });

  it('refuses a fungible amount of the child\'s category', () => {
    expect(accepted(replaced(8, { token: { ...nft('mutable', '5100'), amount: 1n } }))).toBe(false);
    const fungible = { lockingBytecode: P2PKH, valueSatoshis: 1000n, token: { category: INTERNAL, amount: 5n } };
    expect(accepted([...genesis(), fungible])).toBe(false);
  });

  it('refuses an immutable NFT of the child\'s category', () => {
    expect(accepted([...genesis(), { lockingBytecode: RECORD, valueSatoshis: 1000n, token: nft('none', '5100') }]))
      .toBe(false);
  });

  it('refuses two outputs merged into one that a chain started from nothing could not tell apart', () => {
    // The last two outputs of `K` are the first two links: the head (`first`) and the record before it (`second`).
    // A composer who chooses `K` chooses the head's lock, so it can make the first link's digest start with a mutable
    // capability byte; here the head's commitment is ground for it instead.
    const itemOf = (output: Output): Uint8Array => Uint8Array.from([
      output.token!.nft!.capability === 'minting' ? CHILD_GENESIS_MINTING : CHILD_GENESIS_MUTABLE,
      ...output.lockingBytecode, ...hexToBin(output.token!.nft!.commitment),
    ]);
    let honest = genesis();
    let digest = sha256(itemOf(honest[9]!));
    for (let grind = 0; digest[0] !== CHILD_GENESIS_MUTABLE; grind += 1) {
      honest = replaced(9, { token: nft('mutable', grind.toString(16).padStart(256, '0')) });
      digest = sha256(itemOf(honest[9]!));
    }
    // One output whose item is the first link's digest, then the second item: capability, a 35-byte lock, the rest.
    const merged = Uint8Array.from([...digest, ...itemOf(honest[8]!)]);
    const mergedOutput: Output = {
      lockingBytecode: merged.slice(1, 36), valueSatoshis: 1200n, token: nft('mutable', binToHexOf(merged.slice(36))),
    };
    const forgedOutputs = [...honest.slice(0, 8), honest[10]!, mergedOutput];
    // A chain from the empty digest folds both alike, so a creator that started there would accept the merge.
    const fromNothing = (outputs: Output[]): Uint8Array => outputs.filter((output) => output.token?.category === INTERNAL
      && output.token.nft?.capability === 'mutable').reverse()
      .reduce<Uint8Array>((chain, output) => sha256(Uint8Array.from([...chain, ...itemOf(output)])), new Uint8Array());
    expect(fromNothing(forgedOutputs)).toEqual(fromNothing(honest));
    expect(accepted(honest, honest)).toBe(true);
    expect(accepted(forgedOutputs, honest)).toBe(false);
  });

  it('refuses an output of the child\'s category at a lock that is not 35 bytes', () => {
    // Refused even when the expectation names that lock: an item reads one way only at a fixed lock width.
    expect(accepted(replaced(9, { lockingBytecode: P2PKH }), replaced(9, { lockingBytecode: lock(0x44) }))).toBe(false);
  });
});
