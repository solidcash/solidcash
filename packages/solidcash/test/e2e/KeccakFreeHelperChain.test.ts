import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { SHARED_LIBRARY_SALT, keccakComputeLockingBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, TransactionBuilder, randomUtxo, type Unlocker } from '../../src/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';

/**
 * keccak256 inside a file-level free function. As an OP_INVOKE subroutine the helper read its side-cars by its own
 * call ordinals and count, which the calling entry point never published, so the SDK probe found no side-car read
 * (erc7201-style `slotOf(id)`: two chained hashes of a runtime string). The helper now inlines into its caller.
 */
const SOURCE = `
function slotOf(string memory id) pure returns (uint256) {
    return uint256(keccak256(bytes.concat(bytes32(uint256(keccak256(bytes(id))) - 1))) & ~bytes32(uint256(0xff)));
}
function digestOf(string memory s) pure returns (bytes32) {
    return keccak256(bytes(s));
}
contract Slots {
    function slot(string memory id, uint256 expected) public pure {
        require(slotOf(id) == expected);
    }
    function digests(string memory a, string memory b, bytes32 ea, bytes32 eb) public pure {
        require(digestOf(a) == ea);
        require(digestOf(b) == eb);
    }
    function slotAndLiteral(string memory id, uint256 expected, uint256 literalExpected) public pure {
        require(slotOf(id) == expected && slotOf("lit.ns") == literalExpected);
    }
}`;

const ARTIFACT = compileString(SOURCE, { evmCompat: true });

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const toBig = (bytes: Uint8Array): bigint => BigInt(`0x${binToHex(bytes)}`);
const word = (value: bigint): Uint8Array => hexToBin(value.toString(16).padStart(64, '0'));
const slotOf = (id: string): bigint => toBig(keccak_256(word(toBig(keccak_256(utf8(id))) - 1n))) & ~0xffn;

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

describe('keccak256 inside a free helper function', () => {
  it('publishes every inlined helper call on the entry point', () => {
    // The off-chain model reproduces the EIP-7201 example slot.
    expect(slotOf('example.main')).toBe(0x183a6125c38840424c4a85fa12bab2ab606c4b6d0e7cc73c0c06ba5300eab500n);
    const calls = (name: string): number => (ARTIFACT.abi.find((fn) => fn.name === name) as
      { keccakPreimageParams?: unknown[] } | undefined)?.keccakPreimageParams?.length ?? 0;
    expect([calls('slot'), calls('digests'), calls('slotAndLiteral')]).toEqual([2, 2, 4]);
  });

  it('computes a chained slot of a runtime string parameter', async () => {
    await spend('slot', ['example.main', slotOf('example.main')]);
    // A final require leaves its result on the stack: a wrong slot fails as a non-truthy evaluation.
    await expect(spend('slot', ['example.main', slotOf('example.main') + 256n]))
      .rejects.toThrow(/non-truthy value on top of the stack|require/);
  }, 120000);

  it('hashes two independent strings through the same helper', async () => {
    await spend('digests', ['alpha', 'beta', keccak_256(utf8('alpha')), keccak_256(utf8('beta'))]);
  }, 120000);

  it('reduces a helper call with a literal argument in place behind a short-circuit', async () => {
    await spend('slotAndLiteral', ['ns.one', slotOf('ns.one'), slotOf('lit.ns')]);
  }, 120000);
});
