import { describe, expect, it } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

/**
 * Several keccak256 calls in one stateful function: a hash nested in another hash's argument, two sequential
 * hashes, and a free helper reached through a public function called internally. Each call must read its own
 * side-car batch member at the stateful block layout, matching the order the SDK funds them in. A string state
 * variable is hashed from its chunk run, one chunk for a short value and several for a long one.
 */
const WIDE = 'erc7201.namespace.'.repeat(8);

const SOURCE = `
function namespaceSlot(string memory id) pure returns (uint256) {
    return uint256(keccak256(bytes.concat(bytes32(uint256(keccak256(bytes(id))) - 1))) & ~bytes32(uint256(0xff)));
}

contract SlotRegistry {
    string space = "example.main";
    string wide = "${WIDE}";
    uint256 slot;
    bytes32 first;
    bytes32 second;

    function recordSlot() public {
        slot = erc7201(space);
    }
    function recordWideSlot() public {
        slot = erc7201(wide);
    }
    function checkSlot(uint256 expected) public view {
        require(slot == expected);
    }
    function recordDigests(bytes memory a, bytes memory b) public {
        first = keccak256(a);
        second = keccak256(bytes.concat(a, b));
    }
    function checkDigests(bytes32 ea, bytes32 eb) public view {
        require(first == ea && second == eb);
    }
    function helperSlot() public pure returns (uint256) {
        return namespaceSlot("ns.helper");
    }
    function checkHelperSlot(uint256 expected) public view {
        require(helperSlot() == expected);
    }
}`;

const ARTIFACT = compileString(SOURCE, { evmCompat: true, forceStateful: true, enforceFinalRequire: false });

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const toBig = (bytes: Uint8Array): bigint => BigInt(`0x${binToHex(bytes)}`);
const word = (value: bigint): Uint8Array => hexToBin(value.toString(16).padStart(64, '0'));
const slotOf = (id: string): bigint => toBig(keccak_256(word(toBig(keccak_256(utf8(id))) - 1n))) & ~0xffn;

type Deployed = { getFunction(name: string): (...args: unknown[]) => { send(): Promise<unknown> } };

const deploy = async (): Promise<Deployed> => {
  const signer = await fundedSigner(8, 10_000_000n);
  return (await getContractFactory(ARTIFACT, signer).deploy()) as unknown as Deployed;
};

describe('stateful keccak256 side-car ordinals', () => {
  it('stores and checks a nested-hash slot of a string state variable', async () => {
    expect(slotOf('example.main')).toBe(0x183a6125c38840424c4a85fa12bab2ab606c4b6d0e7cc73c0c06ba5300eab500n);
    const registry = await deploy();
    await registry.getFunction('recordSlot')().send();
    await expect(registry.getFunction('checkSlot')(slotOf('example.main')).send()).resolves.toBeDefined();
    await expect(registry.getFunction('checkSlot')(slotOf('example.main') + 256n).send()).rejects.toThrow();
  }, 300_000);

  it('stores and checks a nested-hash slot of a string state variable spanning several chunks', async () => {
    expect(utf8(WIDE).length).toBeGreaterThan(120);
    const registry = await deploy();
    await registry.getFunction('recordWideSlot')().send();
    await expect(registry.getFunction('checkSlot')(slotOf(WIDE)).send()).resolves.toBeDefined();
  }, 300_000);

  it('stores two sequential hashes, one of a parameter and one computed', async () => {
    const registry = await deploy();
    const a = utf8('alpha');
    const b = utf8('beta');
    await registry.getFunction('recordDigests')(a, b).send();
    await expect(registry.getFunction('checkDigests')(keccak_256(a), keccak_256(Uint8Array.from([...a, ...b])))
      .send()).resolves.toBeDefined();
  }, 300_000);

  it('checks a nested-hash slot from a free helper behind a public function', async () => {
    const registry = await deploy();
    await expect(registry.getFunction('checkHelperSlot')(slotOf('ns.helper')).send()).resolves.toBeDefined();
  }, 300_000);
});
