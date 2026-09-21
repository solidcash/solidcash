import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizeGeneratedArtifact, writeArtifactIfChanged, } from '../tasks/artifact-freshness.js';
describe('generated artifact freshness', () => {
    const temporaryDirectories = [];
    afterEach(() => {
        for (const directory of temporaryDirectories.splice(0)) {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    });
    it('ignores generation timestamps but preserves every material byte', () => {
        expect(normalizeGeneratedArtifact('{\n  "updatedAt":"old",\n  "bytecode":"aa"\n}'))
            .toBe(normalizeGeneratedArtifact('{\n  "updatedAt":"new",\n  "bytecode":"aa"\n}'));
        expect(normalizeGeneratedArtifact("{\n  updatedAt: 'old',\n  bytecode: 'aa'\n}"))
            .not.toBe(normalizeGeneratedArtifact("{\n  updatedAt: 'new',\n  bytecode: 'bb'\n}"));
        expect(normalizeGeneratedArtifact('{\n    "updatedAt":"semantic",\n  "bytecode":"aa"\n}'))
            .not.toBe(normalizeGeneratedArtifact('{\n    "updatedAt":"changed",\n  "bytecode":"aa"\n}'));
        expect(normalizeGeneratedArtifact('{\n  "bytecode":"aa"\n}\n'))
            .toBe(normalizeGeneratedArtifact('{\n  "bytecode":"aa"\n}'));
    });
    it('touches an equivalent artifact and rewrites a material change', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-artifact-freshness-'));
        temporaryDirectories.push(directory);
        const output = path.join(directory, 'artifact.json');
        const original = '{\n  "updatedAt":"old",\n  "bytecode":"aa"\n}';
        fs.writeFileSync(output, original);
        fs.utimesSync(output, new Date(0), new Date(0));
        expect(writeArtifactIfChanged(output, '{\n  "updatedAt":"new",\n  "bytecode":"aa"\n}')).toBe(false);
        expect(fs.readFileSync(output, 'utf8')).toBe(original);
        expect(fs.statSync(output).mtimeMs).toBeGreaterThan(0);
        const changed = '{\n  "updatedAt":"new",\n  "bytecode":"bb"\n}';
        expect(writeArtifactIfChanged(output, changed)).toBe(true);
        expect(fs.readFileSync(output, 'utf8')).toBe(changed);
    });
});
//# sourceMappingURL=artifact-freshness.test.js.map