import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

const SOURCE = `pragma solidcash >=0.8.0;
  contract GuardedLookup() {
    mapping(string => string) values;
    function initialize() public delegate { this.values["key"] = "stored value"; }
    function guardedRead(string key) public delegate returns (string) {
      require(bytes(this.values[key]).length != 0);
      return this.values[key];
    }
    function unguardedRead(string key) public delegate returns (string) {
      return this.values[key];
    }
  }`;

describe('repeated verified-mapping reads through a delegate', () => {
  it('preserves one dynamic key across a guard read and return read', async () => {
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    for (let index = 1; index <= 20; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: index.toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 1_000_000n,
      });
    }
    const artifact = compileString(SOURCE, { solidityImportCompat: true });
    const read = artifact.abi.find((candidate) => candidate.name === 'guardedRead')!;
    expect(read.entryAccesses).toHaveLength(1);
    expect(artifact.functionBodies?.[read.selector!]).toBeDefined();
    expect(artifact.bytecode).toContain('OP_INVOKE');

    const proxy = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    await proxy.waitForDeployment();
    await expect((proxy as any).unguardedRead('key')).resolves.toBe('stored value');
    await expect((proxy as any).guardedRead('key')).resolves.toBe('stored value');
  }, 300_000);
});
