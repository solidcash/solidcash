import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { solidcashArtifactsPath } from '../src/artifact-paths.js';
import { loadArtifactByName } from '../src/hre.js';

const dirs: string[] = [];
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-artifacts-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('SolidCash artifact namespace', () => {
  it('lives beneath the configured artifact root', () => {
    expect(solidcashArtifactsPath('/project/artifacts')).toBe('/project/artifacts/solidcash');
  });

  it('only resolves factory artifacts from the SolidCash namespace', () => {
    const root = tempDir();
    const namespaced = path.join(root, 'solidcash', 'contracts', 'Token.sol');
    const hardhat = path.join(root, 'contracts', 'Token.sol');
    fs.mkdirSync(namespaced, { recursive: true });
    fs.mkdirSync(hardhat, { recursive: true });
    fs.writeFileSync(path.join(hardhat, 'Token.json'), JSON.stringify({ bytecode: 'hardhat', abi: [] }));
    fs.writeFileSync(path.join(namespaced, 'Token.json'), JSON.stringify({ bytecode: 'solidcash', abi: [] }));

    expect(loadArtifactByName(root, 'Token').bytecode).toBe('solidcash');
  });
});
