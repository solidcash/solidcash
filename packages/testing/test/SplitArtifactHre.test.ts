import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { compileStringSplit } from 'solidc';
import { formatSplitArtifactBundle } from '@solidcash/utils';
import { deriveLogicalCreateAddress } from 'solidcash';
import { createHardhatRuntimeEnvironment } from '../src/hre.js';
import { resolveConfig } from '../src/config.js';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('Hardhat split artifact discovery', () => {
  it('prefers <name>.split.json and preserves positional deploy plus CREATE identity', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-split-hre-'));
    temporaryDirectories.push(directory);
    const bundle = compileStringSplit(`
      contract AutoSplit(int seed) {
        int x;
        function setX(int nextValue) { this.x = nextValue; require(nextValue >= 0); }
        function addX(int delta) { this.x = this.x + delta; require(delta >= 0); }
      }
    `, { forceSplit: true });
    const solidcashArtifacts = path.join(directory, 'solidcash');
    fs.mkdirSync(solidcashArtifacts);
    fs.writeFileSync(
      path.join(solidcashArtifacts, 'AutoSplit.split.json'), formatSplitArtifactBundle(bundle, 'json'),
    );
    const hre = createHardhatRuntimeEnvironment(resolveConfig({
      paths: { artifacts: directory }, networks: { mock: { type: 'mock' } }, defaultNetwork: 'mock',
      accounts: { count: 1 },
    }));
    const [signer] = await hre.ethers.getSigners(1);
    await (hre.ethers.provider as any).addUtxo(signer.getAddress(), {
      txid: '91'.repeat(32), vout: 0, satoshis: 1_000_000n,
    });
    const predicted = deriveLogicalCreateAddress(signer.getAddress(), 0n);

    const factory = hre.ethers.getContractFactory('AutoSplit', signer);
    const deployed = await factory.deploy(1n, { initialState: { x: 2n } });
    expect(await deployed.getAddress?.() ?? deployed.address).toBe(predicted);
    await deployed.call.setX(3n).send();

    const rediscovered = await factory.at(predicted, [1n]);
    expect(rediscovered.categoryId).toBe(deployed.categoryId);
  });
});
