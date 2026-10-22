/**
 * A framed send from a container holding a minting NFT mints the NFT the source asked for, and the container keeps its
 * minting NFT (spec 4b, DECISIONS D38-D39). The master pins the send's category with the capability byte the source
 * names, so a minting or mutable NFT at an immutable send is refused, and so is a minting NFT at an output no send pins.
 * While a minting container is spent its master releases nothing, and the container's covenant keeps its full category
 * in place, so a container that comes back without its minting NFT is refused.
 */
import { binToHex, decodeTransactionUnsafe, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileString } from '../../../solidc/src/compiler.js';
import { callFramedEntry, type FramedCallResult } from '../../src/framed/call/index.js';
import { framedTokenContainerLockingBytecode } from '../../src/framed/call/token-containers.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { SignatureTemplate } from '../../src/index.js';
import { deployStatefulContract } from '../../src/stateful/sc-deploy.js';
import { aliceAddress, alicePkh, alicePriv, bobPkh } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const MINTER = `
pragma solidcash >=0.8.0;

contract Minter() {
    bytes32 immutable series;
    int public minted;

    constructor(bytes32 series_) {
        this.series = series_;
    }

    function mint(address to, bytes commitment) {
        bytes32 category = this.series;
        this.minted = this.minted + 1;
        this.tokens[category].transferNft(to, commitment, 0);
    }
}
`;

const SERIES = 'e4'.repeat(32);
const COMMITMENT = 'c0de';
const HELD_TXID = 'e5'.repeat(32);
const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
const bobLock = encodeLockingBytecodeP2pkh(bobPkh);
const alice = new SignatureTemplate(alicePriv);

type Transaction = ReturnType<typeof decodeTransactionUnsafe>;
type Output = Transaction['outputs'][number];

interface Minted {
  readonly provider: MockNetworkProvider;
  readonly container: Uint8Array;
  readonly honest: FramedCallResult;
  /** The verdict of input `inputIndex` on the honest transaction as `change` leaves it. */
  verdict(inputIndex: number, change?: (transaction: Transaction) => void): unknown;
}

/** An NFT of the series. */
const nft = (capability: 'none' | 'mutable' | 'minting', commitment: string): NonNullable<Output['token']> => ({
  category: hexToBin(SERIES), amount: 0n, nft: { capability, commitment: hexToBin(commitment) },
});

/** The NFTs of the series a lock holds, as commitment and capability. */
async function nftsAt(provider: MockNetworkProvider, lock: Uint8Array): Promise<string[]> {
  return (await provider.getUtxosForLockingBytecode(lock))
    .filter((utxo) => utxo.token?.category === SERIES && utxo.token.nft !== undefined)
    .map((utxo) => `${utxo.token!.nft!.commitment}:${utxo.token!.nft!.capability}`)
    .sort();
}

let minted: Promise<Minted> | undefined;

/** A deployment whose container holds the series' minting NFT, and one honest mint to bob, broadcast. */
function mint(): Promise<Minted> {
  minted ??= (async (): Promise<Minted> => {
    const artifact = compileString(MINTER, { composition: 'framed', suppressWarnings: true });
    const provider = new MockNetworkProvider();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    await fundShippedFacets(provider);
    const coin = async (txid: string, satoshis: bigint): Promise<Utxo> => {
      const utxo = { txid: txid.repeat(32), vout: 0, satoshis };
      await provider.addUtxo(binToHex(aliceLock), utxo);
      return utxo;
    };
    const { categoryId } = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo: await coin('f1', 3_000_000n), funder: alice.unlockP2PKH(), changeAddress: aliceAddress,
      initArgs: [hexToBin(SERIES)],
    });
    const container = framedTokenContainerLockingBytecode(categoryId, SERIES);
    await provider.addUtxo(binToHex(container), {
      txid: HELD_TXID, vout: 0, satoshis: 1_000n,
      token: { category: SERIES, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
    const honest = await callFramedEntry({
      provider, artifact, categoryId, functionName: 'mint', args: [bobLock, hexToBin(COMMITMENT)],
      callerUtxo: await coin('c1', 300_000n), callerLockingBytecode: aliceLock, funder: alice.unlockP2PKH(), vm,
    });
    return {
      provider, container, honest,
      verdict: (inputIndex, change) => {
        const transaction = decodeTransactionUnsafe(hexToBin(honest.broadcast!.hex)) as Transaction;
        change?.(transaction);
        return vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs: honest.sourceOutputs, transaction }));
      },
    };
  })();
  return minted;
}

describe('a framed send from a container holding a minting NFT', () => {
  it('mints the immutable NFT the source asked for and leaves the container minting', async () => {
    const { provider, container, honest } = await mint();
    expect(honest.verdicts.filter((verdict) => !verdict.accepted)).toEqual([]);
    expect(honest.broadcast).toBeDefined();
    expect(await nftsAt(provider, container)).toEqual([':minting']);
    expect(await nftsAt(provider, bobLock)).toEqual([`${COMMITMENT}:none`]);
  }, 900_000);

  it('refuses a minting or mutable NFT at the send, a minting NFT no send pins, and a container that gives up its '
    + 'minting NFT', async () => {
    const { container, honest, verdict } = await mint();
    const masterIndex = honest.draft.layout.participants[0]!.index;
    const { inputs, outputs } = decodeTransactionUnsafe(hexToBin(honest.broadcast!.hex));
    const held = inputs.findIndex((input) => binToHex(input.outpointTransactionHash) === HELD_TXID);
    const send = outputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(bobLock));
    expect(held).toBeGreaterThan(masterIndex);
    expect(send).toBe(held + 1);
    expect(verdict(masterIndex)).toBe(true);
    expect(verdict(held)).toBe(true);
    const at = (index: number, output: Output) => (transaction: Transaction): void => {
      transaction.outputs[index] = output;
    };

    // The send's category, capability byte included, is the immutable NFT the source asked for.
    for (const capability of ['minting', 'mutable'] as const) {
      expect(verdict(masterIndex, at(send, { ...outputs[send]!, token: nft(capability, COMMITMENT) }))).not.toBe(true);
    }
    // No NFT of the series leaves the lock but the sends, though the minting NFT is spent.
    const extra = (token?: Output['token']) => (transaction: Transaction): void => {
      const change = transaction.outputs.pop()!;
      transaction.outputs.push({ lockingBytecode: aliceLock, valueSatoshis: 1_000n, ...(token && { token }) }, change);
    };
    expect(verdict(masterIndex, extra())).toBe(true);
    expect(verdict(masterIndex, extra(nft('minting', '')))).not.toBe(true);

    // Drained, the container passes its own covenant, and its master refuses it: a minting container releases nothing,
    // nor when the minting NFT moves to the recipient in the send's place.
    const drained = at(held, { lockingBytecode: Uint8Array.of(0x6a), valueSatoshis: 0n });
    expect(verdict(held, drained)).toBe(true);
    expect(verdict(masterIndex, drained)).not.toBe(true);
    expect(verdict(masterIndex, (transaction) => {
      drained(transaction);
      at(send, { ...outputs[send]!, token: nft('minting', '') })(transaction);
    })).not.toBe(true);
    // Kept at its lock, it keeps its full category: no NFT, or a mutable or immutable one, is refused.
    const stripped = at(held, { lockingBytecode: container, valueSatoshis: outputs[held]!.valueSatoshis });
    expect(verdict(held, stripped)).not.toBe(true);
    expect(verdict(masterIndex, stripped)).not.toBe(true);
    for (const capability of ['mutable', 'none'] as const) {
      expect(verdict(held, at(held, { ...outputs[held]!, token: nft(capability, '') }))).not.toBe(true);
    }
  }, 900_000);
});
