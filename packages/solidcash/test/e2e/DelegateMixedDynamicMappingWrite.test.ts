import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Signer, getContractFactory, upgrades } from '../../src/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// A delegate that writes both trailing-output families in one call: a dynamic state-array chunk and a
// chunkable vmap mapping value. Their values must remain distinct while codegen builds the two covenant regions.
const SOURCE = `pragma solidcash >=0.8.0;
contract MixedDelegate() {
  address[] userAddresses;
  mapping(address => bytes) users;

  function register(bytes profile) public {
    users[msg.sender] = profile;
    userAddresses.push(msg.sender);
  }
}`;

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const byte of ['a1', 'b2', 'c3', 'd4']) {
    await provider.addUtxo(signer.getAddress(), {
      txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n,
    });
  }
  return signer;
}

describe('delegate mixed dynamic-array and chunkable mapping write', () => {
  it('keeps the array element distinct from the mapping value', async () => {
    const signer = await fundedSigner();
    const artifact = compileString(SOURCE);
    expect(artifact.delegateArtifact).toBeDefined();
    const proxy = await upgrades.deployProxy(getContractFactory(artifact, signer), { userAddresses: [] });
    const result = await (proxy as any).register(new Uint8Array(80).fill(0x5a)).send();
    expect(result.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
