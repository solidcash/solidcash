import { describe, it, expect } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { computeEvmFunctionSelector } from '@solidcash/utils';
import { getContractFactory } from '../../src/stateful/index.js';
import { fundedSigner } from '../test-util.js';

// A constructor registering ids in a `bytes4 => bool` mapping (the ERC-165 storage pattern) writes keys fixed at
// compile time: a selector, an interface id and an XOR of selectors. The compiler publishes each key as its value,
// so the deployment derives their nodes instead of refusing the constructor.
const SRC = `interface IRegistry {
  function supportsInterface(bytes4 id) external view returns (bool);
}
interface IShape {
  function area() external returns (uint256);
  function sides() external returns (uint256);
}
contract Registry is IRegistry, IShape {
  mapping(bytes4 => bool) internal supported;
  constructor() {
    supported[this.supportsInterface.selector] = true;
    supported[type(IShape).interfaceId] = true;
    supported[this.hue.selector ^ this.tint.selector] = true;
  }
  function supportsInterface(bytes4 id) public view override returns (bool) { return supported[id]; }
  function check(bytes4 id, bool expected) public view { require(supportsInterface(id) == expected); }
  function area() external override returns (uint256) { return 1; }
  function sides() external override returns (uint256) { return 4; }
  function hue() external returns (uint256) { return 2; }
  function tint() external returns (uint256) { return 3; }
}`;

const selector = (signature: string): Uint8Array => computeEvmFunctionSelector(signature);
const xor = (left: Uint8Array, right: Uint8Array): Uint8Array => left.map((byte, index) => byte ^ right[index]);

interface Call { send: () => Promise<unknown> }
type Handle = Record<'check', (id: Uint8Array, expected: boolean) => Call>;

describe('constructor mapping keys fixed at compile time (VM-verified, stateful)', () => {
  it('deploys selector, interface id and selector XOR keys, then reads registered and unregistered ids', async () => {
    const factory = getContractFactory(compileString(SRC, { evmCompat: true }), await fundedSigner(8));
    const sc = await factory.deploy() as unknown as Handle;
    const shapeId = xor(selector('area()'), selector('sides()'));
    for (const id of [selector('supportsInterface(bytes4)'), shapeId, xor(selector('hue()'), selector('tint()'))]) {
      await sc.check(id, true).send();
    }
    const unregistered = xor(shapeId, Uint8Array.of(0, 0, 0, 1));
    await sc.check(unregistered, false).send();
    // The read is real: a wrong expectation reverts.
    await expect(sc.check(unregistered, true).send()).rejects.toThrow(/VERIFY/);
  });
});
