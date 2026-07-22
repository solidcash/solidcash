import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveConfig, solidcashConfigSchema } from '../src/config.js';
import { diagnoseProject } from '../src/doctor.js';

const temporary: string[] = [];
afterEach(() => temporary.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

describe('SolidHat doctor', () => {
  it('reports missing outputs and unsafe or manually edited typegen trees', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'solidhat-doctor-'));
    temporary.push(root);
    fs.mkdirSync(path.join(root, 'contracts'));
    fs.mkdirSync(path.join(root, 'contracts', 'generated'));
    fs.writeFileSync(path.join(root, 'contracts', 'generated', 'manual.ts'), 'export const manual = true;');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { hardhat: '^3.0.0' } }));
    const config = resolveConfig({
      typegen: { targets: [{ target: 'ethers6', outDir: './contracts/generated' }] },
    }, root);
    const codes = diagnoseProject(config, root).map((finding) => finding.code);
    expect(codes).toContain('artifacts-missing');
    expect(codes).toContain('typegen-inside-sources');
    expect(codes).toContain('manual-generated-file');
  });

  it('exports a strict editor-consumable configuration schema', () => {
    expect(solidcashConfigSchema.additionalProperties).toBe(false);
    expect(solidcashConfigSchema.properties.typegen.properties.targets.items.properties.target.enum)
      .toEqual(['ethers5', 'ethers6']);
  });
});
