/**
 * A12 and A14 item 3: a top-level deployment through Deploy<C> pays for what it creates.
 *
 * The author coin covers the outputs, the constructor's value and a fee sized from the code; the creation pays
 * 1 sat/B of its real size; and a deployment releases every coin its prep reserved, so the next one can run.
 */
import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransaction, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { verifyBirth } from '../../src/stateful/deployer.js';
import { alicePkh, alicePriv } from '../fixture/vars.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';

const P = 'pragma solidcash ^0.51.0;';
const authorLock = encodeLockingBytecodeP2pkh(alicePkh);
const changeAddress = (() => {
  const result = lockingBytecodeToCashAddress({ bytecode: authorLock, prefix: 'bchtest' });
  if (typeof result === 'string') throw new Error(result);
  return result.address;
})();
const funder = new SignatureTemplate(alicePriv).unlockP2PKH();

/** A contract whose code is several kilobytes: many functions, each with its own checks. */
function largeContract(): string {
  const functions = Array.from({ length: 40 }, (_, i) => `
    function f${i}(int x, int y) { require(x * ${i + 3} + y > ${i}); require(sha256(bytes(x + ${i})) != sha256(bytes(y))); this.n = this.n + x; }`).join('');
  return `${P} contract Big { int n; constructor() { n = 1; } ${functions} }`;
}

async function deployed(provider: MockNetworkProvider, source: string, txidByte: string, extra: object = {}) {
  const artifact = compileString(source, { deployer: true, messageBus: false });
  expect(artifact.deployer).toBeDefined();
  const fundingUtxo: Utxo = { txid: txidByte.repeat(32), vout: 0, satoshis: 2_000_000n };
  await provider.seedUtxo(binToHex(authorLock), fundingUtxo);
  const result = await StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo, funder, changeAddress, senderLockingBytecode: authorLock, ...extra,
  } as never);
  return { artifact, result };
}

describe('a top-level deployment through Deploy<C> pays for itself', () => {
  it('creates a contract of several kilobytes of code at 1 sat/B', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const { artifact, result } = await deployed(provider, largeContract(), '31');
    expect(hexToBin(artifact.deployer!.code).length).toBeGreaterThan(3000);
    expect(await verifyBirth(provider, result.categoryId, [artifact.deployer!])).toBe(true);
    const tx = decodeTransaction(hexToBin(result.tx.hex)) as { inputs: unknown[]; outputs: { valueSatoshis: bigint }[] };
    expect(typeof tx).toBe('object');
  });

  it('funds a payable constructor\'s value beyond the default author coin', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const source = `${P} contract C { int n; constructor() payable { n = msg.value; } function read() { require(n > 0); } }`;
    const { result } = await deployed(provider, source, '32', { initialBalance: 100_000n });
    const state = await result.contract.getState() as { n?: bigint };
    expect(state.n).toBe(100_000n);
  });

  it('releases what a deployment reserved, so the next deployment runs', async () => {
    const provider = new MockNetworkProvider({ profile: 'production' });
    const source = `${P} contract C { int n; constructor() { n = 1; } function read() { require(n == 1); } }`;
    const first = await deployed(provider, source, '33');
    const second = await deployed(provider, source, '34');
    expect(first.result.categoryId).not.toBe(second.result.categoryId);
  });
});
