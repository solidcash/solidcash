/**
 * NFTs in framed token containers (spec 4b), on real consensus limits. An issuer mints tickets from the minting NFT
 * its container holds, reading that NFT's commitment, and a forged extra mint is refused by its master. An escrow
 * takes NFTs in as deposits, beside its sends too, and releases them: an immutable NFT by its commitment, one with an
 * empty commitment included, a mutable one as anything it can become, from one frame or two. Each send is made from a
 * container its run spends last, and every container a master owns holds the category it is named for.
 */
import {
  binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../../solidc/src/compiler.js';
import { validatorAddress } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc';
import { callFramedEntry, type FramedCallResult } from '../../src/framed/call/index.js';
import { framedTokenContainerLockingBytecode } from '../../src/framed/call/token-containers.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { SignatureTemplate } from '../../src/index.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { aliceAddress, alicePkh, alicePriv, bobPkh, carolPkh } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';
import { expectScriptRejection } from '../test-util.js';

const ISSUER = `
pragma solidcash >=0.8.0;

contract Issuer() {
    bytes32 immutable series;
    int public issued;

    constructor(bytes32 series_) {
        this.series = series_;
    }

    function issue(address to) {
        bytes32 category = this.series;
        bytes stamp = this.tokens[category].nftCommitment;
        this.issued = this.issued + 1;
        this.tokens[category].transferNft(to, stamp, 0);
    }
}
`;

const ESCROW = `
pragma solidcash >=0.8.0;

contract Escrow() {
    bytes32 immutable collection;
    int public held;

    constructor(bytes32 collection_) {
        this.collection = collection_;
    }

    function hold() {
        bytes32 category = this.collection;
        int reserve = this.tokens[category].tokenAmount;
        this.held = this.held + 1 + reserve;
    }

    function release(address to, bytes commitment, int capability) {
        bytes32 category = this.collection;
        this.tokens[category].transferNft(to, commitment, capability);
    }
}
`;

const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const bobLock = encodeLockingBytecodeP2pkh(bobPkh);
const carolLock = encodeLockingBytecodeP2pkh(carolPkh);
const alice = new SignatureTemplate(alicePriv);

/** A deployment of `source` with `category` as its constructor's, and a call helper funded by fresh coins. */
async function deployed(source: string, category: string): Promise<{
  provider: MockNetworkProvider; categoryId: string; container: Uint8Array;
  coin: (txid: string, satoshis: bigint, token?: Utxo['token']) => Promise<Utxo>;
  call: (functionName: string, args: unknown[], callerUtxo: Utxo, extra?: object) => Promise<FramedCallResult>;
}> {
  const artifact = compileString(source, { composition: 'framed', suppressWarnings: true });
  const provider = new MockNetworkProvider();
  const vm = createVirtualMachineBch2026ForProvider(provider);
  await fundShippedFacets(provider);
  const coin = async (txid: string, satoshis: bigint, token?: Utxo['token']): Promise<Utxo> => {
    const utxo = { txid: txid.repeat(32), vout: 0, satoshis, ...(token === undefined ? {} : { token }) };
    await provider.addUtxo(binToHex(aliceLock), utxo);
    return utxo;
  };
  const { categoryId } = await deployStatefulContract(artifact, [], {
    provider, fundingUtxo: await coin('f1', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
    initArgs: [hexToBin(category)],
  });
  const call = (
    functionName: string, args: unknown[], callerUtxo: Utxo, extra: object = {},
  ): Promise<FramedCallResult> => callFramedEntry({
    provider, artifact, categoryId, functionName, args: args as never, callerUtxo,
    callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(), vm, ...extra,
  });
  return { provider, categoryId, container: framedTokenContainerLockingBytecode(categoryId, category), coin, call };
}

/** The NFTs of `category` a lock holds, as commitment and capability. */
async function nftsAt(provider: MockNetworkProvider, lock: Uint8Array, category: string): Promise<string[]> {
  return (await provider.getUtxosForLockingBytecode(lock))
    .filter((utxo) => utxo.token?.category === category && utxo.token.nft !== undefined)
    .map((utxo) => `${utxo.token!.nft!.commitment}:${utxo.token!.nft!.capability}`)
    .sort();
}

function settled(result: FramedCallResult): void {
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
  expect(result.broadcast).toBeDefined();
}

describe('NFTs in framed token containers', () => {
  it('mints tickets from a minting NFT it holds, and refuses an extra mint', async () => {
    const series = 'e7'.repeat(32);
    const { provider, container, coin, call } = await deployed(ISSUER, series);
    await provider.addUtxo(binToHex(container), {
      txid: 'e8'.repeat(32), vout: 0, satoshis: 1_000n,
      token: { category: series, amount: 0n, nft: { capability: 'minting', commitment: 'cc' } },
    });

    settled(await call('issue', [bobLock], await coin('c1', 300_000n)));
    expect(await nftsAt(provider, bobLock, series)).toEqual(['cc:none']);
    expect(await nftsAt(provider, container, series)).toEqual(['cc:minting']);

    // The honest issue, captured, then the chain rewound to before it; the same transaction mints one more ticket.
    const callerUtxo = await coin('c2', 300_000n);
    const snapshot = await provider.takeSnapshot();
    const honest = await call('issue', [carolLock], callerUtxo);
    settled(honest);
    const masterIndex = honest.draft.layout.participants[0]!.index;
    await snapshot.restore();
    const forge = (token: Utxo['token']): ReturnType<typeof decodeTransactionUnsafe> => {
      const forged = decodeTransactionUnsafe(hexToBin(honest.broadcast!.hex)) as ReturnType<typeof decodeTransactionUnsafe>;
      const change = forged.outputs.pop()!;
      change.valueSatoshis -= 5_000n;
      forged.outputs.push({
        lockingBytecode: aliceLock, valueSatoshis: 1_000n,
        ...(token === undefined ? {} : {
          token: { category: hexToBin(token.category), amount: 0n, nft: { capability: 'none' as const, commitment: hexToBin('dd') } },
        }),
      });
      forged.outputs.push(change);
      return forged;
    };
    const minted = forge({ category: series, amount: 0n, nft: { capability: 'none', commitment: 'dd' } });
    const outcome = await provider.sendRawTransaction(binToHex(encodeTransaction(minted)))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).not.toBe('ACCEPTED');
    expectScriptRejection(outcome, masterIndex);
    // The master accepts the same transaction with a plain coin in the ticket's place: the extra ticket is what it refuses.
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const masterAccepts = (transaction: ReturnType<typeof decodeTransactionUnsafe>): unknown =>
      vm.stateSuccess(vm.evaluate({ inputIndex: masterIndex, sourceOutputs: honest.sourceOutputs, transaction }));
    expect(masterAccepts(forge(undefined))).toBe(true);
    expect(masterAccepts(minted)).not.toBe(true);
  }, 900_000);

  it('mints a ticket from a callee frame', async () => {
    const source = `${ISSUER}
interface IIssuer {
    function issue(address to);
}

contract Hub() {
    address immutable issuer;

    constructor(address issuer_) {
        this.issuer = issuer_;
    }

    function issueVia(address to) {
        IIssuer(this.issuer).issue(to);
    }
}
`;
    const compiled = compileStringMulti(source, { composition: 'framed', suppressWarnings: true });
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    await fundShippedFacets(provider);
    const coin = async (txid: string): Promise<Utxo> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis: 3_000_000n };
      await provider.addUtxo(binToHex(aliceLock), utxo);
      return utxo;
    };
    const series = 'ea'.repeat(32);
    const issuer = await deployStatefulContract(compiled.Issuer!, [], {
      provider, fundingUtxo: await coin('b1'), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      initArgs: [hexToBin(series)],
    });
    const hub = await deployStatefulContract(compiled.Hub!, [], {
      provider, fundingUtxo: await coin('b2'), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      initArgs: [validatorAddress(hexToBin(issuer.categoryId), framedValidator.buildValidatorProgram())],
    });
    const container = framedTokenContainerLockingBytecode(issuer.categoryId, series);
    await provider.addUtxo(binToHex(container), {
      txid: 'eb'.repeat(32), vout: 0, satoshis: 1_000n,
      token: { category: series, amount: 0n, nft: { capability: 'minting', commitment: '0f' } },
    });
    settled(await callFramedEntry({
      provider, artifact: compiled.Hub!, categoryId: hub.categoryId, functionName: 'issueVia', args: [bobLock],
      callerUtxo: await coin('b3'), callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(), vm,
      externals: { Issuer: { artifact: compiled.Issuer!, categoryId: issuer.categoryId } },
    }));
    expect(await nftsAt(provider, bobLock, series)).toEqual(['0f:none']);
    expect(await nftsAt(provider, container, series)).toEqual(['0f:minting']);
  }, 900_000);

  it('takes NFTs in as deposits and releases an immutable one and a mutable one', async () => {
    const collection = 'e9'.repeat(32);
    const { provider, container, coin, call } = await deployed(ESCROW, collection);
    const immutable = await coin('d1', 1_000n, {
      category: collection, amount: 0n, nft: { capability: 'none', commitment: 'a1' },
    });
    const mutable = await coin('d2', 1_000n, {
      category: collection, amount: 0n, nft: { capability: 'mutable', commitment: 'b2' },
    });
    settled(await call('hold', [], await coin('c3', 300_000n), {
      tokenDeposits: [immutable, mutable].map((utxo) => ({ utxo, unlocker: alice.unlockP2PKH(), amount: 0n })),
    }));
    expect(await nftsAt(provider, container, collection)).toEqual(['a1:none', 'b2:mutable']);

    // The same call that releases one takes another in.
    const another = await coin('d3', 1_000n, {
      category: collection, amount: 0n, nft: { capability: 'none', commitment: 'c3' },
    });
    settled(await call('release', [bobLock, hexToBin('a1'), 0n], await coin('c4', 300_000n), {
      tokenDeposits: [{ utxo: another, unlocker: alice.unlockP2PKH(), amount: 0n }],
    }));
    expect(await nftsAt(provider, bobLock, collection)).toEqual(['a1:none']);
    expect(await nftsAt(provider, container, collection)).toEqual(['b2:mutable', 'c3:none']);

    // A mutable NFT cannot become a minting one.
    await expect(call('release', [carolLock, hexToBin('99'), 2n], await coin('c5', 300_000n)))
      .rejects.toThrow(/no container of its contract can make/);
    settled(await call('release', [carolLock, hexToBin('e5'), 1n], await coin('c6', 300_000n)));
    expect(await nftsAt(provider, carolLock, collection)).toEqual(['e5:mutable']);
    expect(await nftsAt(provider, container, collection)).toEqual(['c3:none']);
  }, 900_000);

  it('holds an immutable NFT with an empty commitment and releases it', async () => {
    const collection = 'f0'.repeat(32);
    const { provider, container, coin, call } = await deployed(ESCROW, collection);
    const blank = await coin('d1', 1_000n, { category: collection, amount: 0n, nft: { capability: 'none', commitment: '' } });
    settled(await call('hold', [], await coin('c1', 300_000n), {
      tokenDeposits: [{ utxo: blank, unlocker: alice.unlockP2PKH(), amount: 0n }],
    }));
    expect(await nftsAt(provider, container, collection)).toEqual([':none']);
    // Beside a fungible amount the VM sees no such NFT, so a coin holding both is no deposit.
    const hidden = await coin('d2', 1_000n, { category: collection, amount: 5n, nft: { capability: 'none', commitment: '' } });
    await expect(call('hold', [], await coin('c2', 300_000n), {
      tokenDeposits: [{ utxo: hidden, unlocker: alice.unlockP2PKH(), amount: 5n }],
    })).rejects.toThrow(/goes alone/);
    settled(await call('release', [bobLock, new Uint8Array(), 0n], await coin('c3', 300_000n)));
    expect(await nftsAt(provider, bobLock, collection)).toEqual([':none']);
    expect(await nftsAt(provider, container, collection)).toEqual([]);
  }, 900_000);

  it('releases NFTs of one category from two frames of one contract', async () => {
    const source = `${ESCROW}
interface IEscrow {
    function release(address to, bytes commitment, int capability);
}

contract Hub() {
    address immutable escrow;

    constructor(address escrow_) {
        this.escrow = escrow_;
    }

    function releaseTwo(address to, bytes first, bytes second) {
        IEscrow(this.escrow).release(to, first, 0);
        IEscrow(this.escrow).release(to, second, 0);
    }
}
`;
    const compiled = compileStringMulti(source, { composition: 'framed', suppressWarnings: true });
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    await fundShippedFacets(provider);
    const coin = async (txid: string): Promise<Utxo> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis: 3_000_000n };
      await provider.addUtxo(binToHex(aliceLock), utxo);
      return utxo;
    };
    const collection = 'f3'.repeat(32);
    const escrow = await deployStatefulContract(compiled.Escrow!, [], {
      provider, fundingUtxo: await coin('b1'), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      initArgs: [hexToBin(collection)],
    });
    const hub = await deployStatefulContract(compiled.Hub!, [], {
      provider, fundingUtxo: await coin('b2'), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      initArgs: [validatorAddress(hexToBin(escrow.categoryId), framedValidator.buildValidatorProgram())],
    });
    const container = framedTokenContainerLockingBytecode(escrow.categoryId, collection);
    for (const [txid, commitment] of [['e1', 'a1'], ['e2', 'b1']] as const) {
      await provider.addUtxo(binToHex(container), {
        txid: txid.repeat(32), vout: 0, satoshis: 1_000n,
        token: { category: collection, amount: 0n, nft: { capability: 'none', commitment } },
      });
    }
    // The first frame sends the NFT the second container holds, so the call plans each frame's container again.
    settled(await callFramedEntry({
      provider, artifact: compiled.Hub!, categoryId: hub.categoryId, functionName: 'releaseTwo',
      args: [bobLock, hexToBin('b1'), hexToBin('a1')], callerUtxo: await coin('b3'), callerLockingBytecode: aliceLock,
      funder: alice.unlockP2PKH(), vm, externals: { Escrow: { artifact: compiled.Escrow!, categoryId: escrow.categoryId } },
    }));
    expect(await nftsAt(provider, bobLock, collection)).toEqual(['a1:none', 'b1:none']);
    expect(await nftsAt(provider, container, collection)).toEqual([]);
  }, 900_000);

  it('makes a send from a mutable NFT, which then cannot also leave to an output no send pins', async () => {
    const collection = 'f6'.repeat(32);
    const { provider, container, coin, call } = await deployed(ESCROW, collection);
    const held = async (txid: string, nft: NonNullable<NonNullable<Utxo['token']>['nft']>): Promise<Utxo> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis: 1_000n, token: { category: collection, amount: 0n, nft } };
      await provider.addUtxo(binToHex(container), utxo);
      return utxo;
    };
    const immutable = await held('f7', { capability: 'none', commitment: 'a1' });
    await held('f8', { capability: 'mutable', commitment: 'b2' });
    const callerUtxo = await coin('c1', 300_000n);
    const snapshot = await provider.takeSnapshot();
    const honest = await call('release', [bobLock, hexToBin('a1'), 0n], callerUtxo);
    settled(honest);
    await snapshot.restore();
    const masterIndex = honest.draft.layout.participants[0]!.index;
    const decoded = (): ReturnType<typeof decodeTransactionUnsafe> =>
      decodeTransactionUnsafe(hexToBin(honest.broadcast!.hex)) as ReturnType<typeof decodeTransactionUnsafe>;
    const backing = decoded().inputs.findIndex((input) => binToHex(input.outpointTransactionHash) === immutable.txid);
    expect(backing).toBeGreaterThan(masterIndex);
    // The send made from the mutable NFT in the immutable one's place, and an output after it.
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const masterAccepts = (token: Utxo['token'] | undefined): unknown => {
      const transaction = decoded();
      const change = transaction.outputs.pop()!;
      const nft = (capability: 'none' | 'mutable' | 'minting', commitment: string): { category: Uint8Array;
        amount: bigint; nft: { capability: typeof capability; commitment: Uint8Array } } => ({
        category: hexToBin(collection), amount: 0n, nft: { capability, commitment: hexToBin(commitment) },
      });
      transaction.outputs.push({
        lockingBytecode: aliceLock, valueSatoshis: 1_000n,
        ...(token === undefined ? {} : { token: nft(token.nft!.capability, token.nft!.commitment) }),
      }, change);
      const sourceOutputs = honest.sourceOutputs.map((output, index) => (index !== backing ? output
        : { ...output, token: nft('mutable', 'b2') }));
      return vm.stateSuccess(vm.evaluate({ inputIndex: masterIndex, sourceOutputs, transaction }));
    };
    expect(masterAccepts(undefined)).toBe(true);
    expect(masterAccepts({ category: collection, amount: 0n, nft: { capability: 'mutable', commitment: 'b2' } }))
      .not.toBe(true);
  }, 900_000);

  it('refuses a container of another category in a master\'s run, which it would count as the reserve', async () => {
    const collection = 'f9'.repeat(32);
    const { provider, container, coin, call } = await deployed(ESCROW, collection);
    const held = async (txid: string, token: NonNullable<Utxo['token']>): Promise<Utxo> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis: 1_000n, token };
      await provider.addUtxo(binToHex(container), utxo);
      return utxo;
    };
    const large = await held('fa', { category: collection, amount: 100n });
    const small = await held('fb', { category: collection, amount: 1n });
    await held('fc', { category: collection, amount: 0n, nft: { capability: 'none', commitment: 'a1' } });
    const callerUtxo = await coin('c1', 300_000n);
    const snapshot = await provider.takeSnapshot();
    const honest = await call('release', [bobLock, hexToBin('a1'), 0n], callerUtxo);
    settled(honest);
    await snapshot.restore();
    const masterIndex = honest.draft.layout.participants[0]!.index;
    const decoded = (): ReturnType<typeof decodeTransactionUnsafe> =>
      decodeTransactionUnsafe(hexToBin(honest.broadcast!.hex)) as ReturnType<typeof decodeTransactionUnsafe>;
    const indexOf = (utxo: Utxo): number => decoded().inputs
      .findIndex((input) => binToHex(input.outpointTransactionHash) === utxo.txid);
    const [largeAt, smallAt] = [indexOf(large), indexOf(small)];
    expect(smallAt).toBe(largeAt + 1);
    // The small container's tokens of `category`, grown by 50 in place, with 50 fewer of the collection kept and paid
    // out: of the collection itself that is a deposit and a withdrawal, of another category a draw on the reserve.
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const masterAccepts = (category: string): unknown => {
      const transaction = decoded();
      transaction.outputs[largeAt] = {
        ...transaction.outputs[largeAt]!, token: { category: hexToBin(collection), amount: 50n },
      };
      transaction.outputs[smallAt] = {
        lockingBytecode: container, valueSatoshis: 1_000n, token: { category: hexToBin(category), amount: 51n },
      };
      const change = transaction.outputs.pop()!;
      transaction.outputs.push({
        lockingBytecode: aliceLock, valueSatoshis: 1_000n, token: { category: hexToBin(collection), amount: 50n },
      }, change);
      const sourceOutputs = honest.sourceOutputs.map((output, index) => (index !== smallAt ? output
        : { ...output, token: { category: hexToBin(category), amount: 1n } }));
      return vm.stateSuccess(vm.evaluate({ inputIndex: masterIndex, sourceOutputs, transaction }));
    };
    expect(masterAccepts(collection)).toBe(true);
    expect(masterAccepts('fd'.repeat(32))).not.toBe(true);
  }, 900_000);
});
