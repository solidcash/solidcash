import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { SHARED_LIBRARY_SALT, keccakComputeLockingBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder, randomUtxo, type Unlocker } from '../../src/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';

/**
 * Chained keccak256 calls (the erc7201 slot: a hash of a hash) over an argument the contract builds at runtime -
 * `string(abi.encode(x))`, a pure function's string result, `string.concat(a, b)`. The SDK learns every preimage
 * from VM probes. The lowered `bytes32(uint256(h) - 1)` was unbounded arithmetic, so an `h - 1` with its top bit set
 * (`example.main`) failed OP_NUM2BIN between the two reads and no probe made progress. A probe that learns nothing
 * now ends probing: the unreached calls keep the empty placeholder, so the contract reports its own failure instead
 * of "preimage extraction did not converge".
 */
const SOURCE = `
contract Namespaces {
    function label() public pure returns (string memory) {
        return "example.main";
    }
    function encodedSlot(uint256 x) public pure returns (uint256) {
        return erc7201(string(abi.encode(x)));
    }
    function checkEncoded(uint256 x, uint256 expected) public pure {
        require(encodedSlot(x) == expected);
    }
    function checkLabel(uint256 expected) public pure {
        require(erc7201(label()) == expected);
    }
    function checkConcat(string memory a, string memory b, uint256 expected) public pure {
        require(erc7201(string.concat(a, b)) == expected);
    }
    function checkGuarded(string memory a, bytes32 expected) public pure {
        bytes32 digest = keccak256(bytes(string.concat(a, "!")));
        require(digest == expected, "first digest");
        require(keccak256(bytes.concat(digest)) != bytes32(0));
    }
}`;

const ARTIFACT = compileString(SOURCE, { evmCompat: true });

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const toBig = (bytes: Uint8Array): bigint => BigInt(`0x${binToHex(bytes)}`);
const word = (value: bigint): Uint8Array => hexToBin(value.toString(16).padStart(64, '0'));
const slotOf = (id: Uint8Array): bigint => toBig(keccak_256(word(toBig(keccak_256(id)) - 1n))) & ~0xffn;

type UnlockFactory = (...args: unknown[]) => Unlocker;

const spend = async (fn: string, args: unknown[]): Promise<void> => {
  const provider = new MockNetworkProvider();
  const contract = new Contract(ARTIFACT, [], { provider });
  const keccak = ARTIFACT.externalLibraries?.find((library) => library.name === 'keccak256' && library.resultNft);
  for (let i = 0; i < Math.max(1, keccak?.minInstances ?? 1); i++) {
    await provider.addUtxo(binToHex(keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, false)), {
      ...randomUtxo({ satoshis: 100_000n }),
      token: { category: 'ee'.repeat(31) + '11', amount: 0n, nft: { capability: 'mutable', commitment: '' } },
    });
  }
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
  const unlock = contract.unlock as unknown as Record<string, UnlockFactory>;
  await new TransactionBuilder({ provider })
    .addInputs(await contract.getUtxos(), unlock[fn](...args))
    .addOutput({ to: contract.address, amount: 1_000n })
    .addOutput({ to: contract.address, amount: 900_000n })
    .send();
};

describe('keccak256 over a runtime-built argument', () => {
  it('resolves every chained call through the probe', () => {
    // The off-chain model reproduces the EIP-7201 example slot.
    expect(slotOf(utf8('example.main'))).toBe(0x183a6125c38840424c4a85fa12bab2ab606c4b6d0e7cc73c0c06ba5300eab500n);
    const params = (name: string): unknown[] | undefined => (ARTIFACT.abi.find((fn) => fn.name === name) as
      { keccakPreimageParams?: unknown[] } | undefined)?.keccakPreimageParams;
    for (const name of ['checkEncoded', 'checkLabel', 'checkConcat', 'checkGuarded']) {
      expect(params(name)).toEqual([null, null]);
    }
  });

  it('hashes string(abi.encode(x))', async () => {
    await spend('checkEncoded', [7n, slotOf(word(7n))]);
  }, 120000);

  it('hashes a string returned by a pure function', async () => {
    await spend('checkLabel', [slotOf(utf8('example.main'))]);
  }, 120000);

  it('hashes string.concat of two parameters', async () => {
    await spend('checkConcat', ['example.', 'main', slotOf(utf8('example.main'))]);
  }, 120000);

  it('reports the contract revert that stops the probe before a later call', async () => {
    await spend('checkGuarded', ['ns', keccak_256(utf8('ns!'))]);
    // The side-cars' custom unlockers leave the require unmapped: the revert surfaces as the script's own failure.
    await expect(spend('checkGuarded', ['ns', keccak_256(utf8('other'))]))
      .rejects.toThrow(/failed an OP_VERIFY operation/);
  }, 120000);
});
