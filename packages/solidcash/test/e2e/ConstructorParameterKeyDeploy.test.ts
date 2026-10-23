import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Contract,
  SignatureTemplate,
} from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { aliceAddress, alicePkh, alicePriv, alicePub, bobAddress, bobPkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

/**
 * A direct deploy whose Solidity constructor writes a verified mapping under a key it takes as a parameter.
 *
 * The constructor's ABI names such a key by the parameter's bare name, where a contract parameter's key carries an
 * `id:` expression, so the deployment derivation refused it ("Cannot derive constructor vmap key"). It now resolves
 * the bare name from the constructor's own arguments. Each deploy runs on the mock network with the message bus off;
 * a call that reads the entry back is accepted for the value the constructor wrote and refused for another.
 */

const P = 'pragma solidcash ^0.14.0;';
const KIND = Uint8Array.from([0x3c, 0x61, 0x86, 0xab]);
const OTHER_KIND = Uint8Array.from([0x52, 0x0e, 0x97, 0x14]);

let fundingNonce = 0x6e40;

/** Deploys `source` with `initArgs`; the deployed contract's `check` entry, sent with `args`. */
async function deploy(source: string, initArgs: unknown[]): Promise<(...args: unknown[]) => Promise<unknown>> {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  fundingNonce += 1;
  const fundingUtxo = { txid: fundingNonce.toString(16).padStart(64, '0'), vout: 0, satoshis: 500_000n };
  await provider.addUtxo(p2pkh.address, fundingUtxo);
  const result = await StatefulContract.deploy(compileString(source, { suppressWarnings: true }), [], {
    provider,
    fundingUtxo,
    funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: {},
    initArgs: initArgs as never,
    changeAddress: p2pkh.address,
  });
  const call = result.contract.call as unknown as Record<string, (...args: unknown[]) => { send(): Promise<unknown> }>;
  return (...args: unknown[]) => call.check!(...args).send();
}

describe('a direct constructor that writes a verified mapping under a parameter key', () => {
  it('deploys a scalar value and reads it back', async () => {
    const check = await deploy(`${P} contract C { mapping(uint => uint) m;
      constructor(uint k, uint v) { this.m[k] = v; } function check(uint k, uint e) { require(this.m[k] == e); } }`,
    [7n, 9n]);
    await check(7n, 9n);
    await expect(check(7n, 0n)).rejects.toThrow();
  });

  it('deploys a struct value and reads its field back', async () => {
    const check = await deploy(`${P} contract C { struct S { uint a; uint b; } mapping(uint => S) m;
      constructor(uint k, uint a) { this.m[k] = S(a, 2); }
      function check(uint k, uint e) { require(this.m[k].a == e); } }`, [7n, 9n]);
    await check(7n, 9n);
    await expect(check(7n, 2n)).rejects.toThrow();
  });

  it('deploys an array value, pushed or assigned whole, and reads its element back', async () => {
    const pushed = await deploy(`${P} contract C { mapping(uint => bytes4[]) logs;
      constructor(uint k, bytes4 v) { this.logs[k].push(v); }
      function check(uint k, uint i, bytes4 e) { require(this.logs[k][i] == e); } }`, [7n, KIND]);
    await pushed(7n, 0n, KIND);
    await expect(pushed(7n, 0n, OTHER_KIND)).rejects.toThrow();
    const whole = await deploy(`${P} contract C { mapping(uint => uint[]) nums;
      constructor(uint k, uint[] memory vs) { this.nums[k] = vs; }
      function check(uint k, uint i, uint e) { require(this.nums[k][i] == e); } }`, [7n, [9n]]);
    await whole(7n, 0n, 9n);
    await expect(whole(7n, 0n, 4n)).rejects.toThrow();
  });

  it('deploys under an address parameter given as a cash address', async () => {
    const check = await deploy(`${P} contract C { mapping(address => uint) m;
      constructor(address who, uint v) { this.m[who] = v; }
      function check(address who, uint e) { require(this.m[who] == e); } }`, [aliceAddress, 9n]);
    await check(aliceAddress, 9n);
    await expect(check(bobAddress, 9n)).rejects.toThrow();
  });

  it('deploys under a nested key built from two parameters', async () => {
    const check = await deploy(`${P} contract C { mapping(uint => mapping(bytes20 => uint)) m;
      constructor(uint a, bytes20 b, uint v) { this.m[a][b] = v; }
      function check(uint a, bytes20 b, uint e) { require(this.m[a][b] == e); } }`, [7n, alicePkh, 9n]);
    await check(7n, alicePkh, 9n);
    await expect(check(7n, bobPkh, 9n)).rejects.toThrow();
    await expect(check(8n, alicePkh, 9n)).rejects.toThrow();
  });

  it('names a runtime loop as the cause when its write leaves the derivation without a node', async () => {
    await expect(deploy(`${P} contract C { mapping(uint => uint) m;
      constructor(uint[] memory ks, uint v) { for (uint i = 0; i < ks.length; i++) { this.m[ks[i]] = v; } }
      function check(uint k, uint e) { require(this.m[k] == e); } }`, [[1n, 2n], 9n]))
      .rejects.toThrow('writes verified mapping \'m\' in a runtime loop');
  });
});
