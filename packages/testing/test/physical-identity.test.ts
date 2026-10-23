import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { formatArtifact } from '@solidcash/utils';
import { deriveLogicalCreateAddress } from '@solidcash/solidcash/stateful';
import { hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { createHardhatRuntimeEnvironment } from '../src/hre.js';
import { resolveConfig } from '../src/config.js';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

const ANCHOR = `
  contract Anchor() {
    int x;
    function setX(int nextValue) { this.x = nextValue; require(nextValue >= 0); }
  }
`;

/** Write one compiled artifact where the HRE looks for it, and hand back the project directory. */
function projectWithAnchor(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-physical-'));
  temporaryDirectories.push(directory);
  const artifacts = path.join(directory, 'solidcash');
  fs.mkdirSync(artifacts);
  fs.writeFileSync(
    path.join(artifacts, 'Anchor.json'), formatArtifact(compileString(ANCHOR) as never, 'json'),
  );
  return directory;
}

async function deployAnchor(logicalIdentity: boolean): Promise<{
  address: string; lockingBytecode: string; deployer: string;
}> {
  const hre = createHardhatRuntimeEnvironment(resolveConfig({
    paths: { artifacts: projectWithAnchor() },
    networks: { mock: { type: 'mock' } },
    defaultNetwork: 'mock',
    accounts: { count: 1 },
    logicalIdentity,
  }));
  const [signer] = await hre.ethers.getSigners(1);
  await (hre.ethers.provider as { addUtxo: (address: string, utxo: object) => Promise<void> })
    .addUtxo(signer.getAddress(), { txid: '91'.repeat(32), vout: 0, satoshis: 1_000_000n });
  const factory = hre.ethers.getContractFactory('Anchor', signer);
  const deployed = await factory.deploy({ initialState: { x: 2n } });
  return {
    address: await deployed.getAddress?.() ?? deployed.address,
    lockingBytecode: deployed.inner.lockingBytecode as unknown as string,
    deployer: signer.getAddress(),
  };
}

describe('deployment identity', () => {
  it('addresses a deployment by a stable CREATE identity by default', async () => {
    const deployed = await deployAnchor(true);
    expect(deployed.address).toBe(deriveLogicalCreateAddress(deployed.deployer, 0n));
  });

  it('addresses a deployment by its own lock when the project asks for the physical form', async () => {
    const deployed = await deployAnchor(false);
    const logical = deriveLogicalCreateAddress(deployed.deployer, 0n);
    // The physical form is the contract's own locking bytecode, which is deliberately not the stable identity.
    const encoded = lockingBytecodeToCashAddress({
      bytecode: hexToBin(deployed.lockingBytecode),
      prefix: logical.slice(0, logical.indexOf(':')),
      tokenSupport: false,
    });
    expect(typeof encoded === 'string' ? encoded : '').toBe('');
    expect(deployed.address).toBe((encoded as { address: string }).address);
    expect(deployed.address).not.toBe(logical);
  });
});
