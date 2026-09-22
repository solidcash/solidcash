import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageProjectFixture } from '../src/project-fixture.js';

/** Build a throwaway checkout with `contracts/` sources and an app tree. */
function makeCheckout(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'solidhat-fixture-'));
  fs.mkdirSync(path.join(root, 'app/contracts/vendor/@openzeppelin/contracts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app/contracts/Token.sol'), 'contract Token {}');
  fs.writeFileSync(path.join(root, 'app/contracts/Other.sol'), 'contract Other {}');
  fs.writeFileSync(path.join(root, 'app/contracts/vendor/Library.sol'), 'contract Library {}');
  fs.writeFileSync(path.join(root, 'app/contracts/vendor/@openzeppelin/contracts/Context.sol'), 'contract Context {}');
  fs.mkdirSync(path.join(root, 'app/src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app/src/index.ts'), 'export const app = 1;');
  fs.mkdirSync(path.join(root, 'app/test'), { recursive: true });
  fs.writeFileSync(path.join(root, 'app/test/app.test.ts'), 'describe("x", () => {});');
  return root;
}

const options = (root: string): Parameters<typeof stageProjectFixture>[0] => ({
  root,
  fixtureDir: '.solidhat',
  contractMirrors: [{ directory: 'app/contracts', files: ['Token.sol'] }],
  links: [
    { link: '.solidhat/project/src', target: 'app/src' },
    { link: '.solidhat/project/test/app.test.ts', target: 'app/test/app.test.ts' },
  ],
  directories: ['.solidhat/project/typechain-types'],
});

describe('stageProjectFixture', () => {
  it('mirrors selected contract targets and vendored directories as relative symlinks', () => {
    const root = makeCheckout();
    const fixture = stageProjectFixture(options(root));

    expect(fixture.contractsDir).toBe(path.join(root, '.solidhat/contracts'));
    // Only the requested top-level target is linked; sibling sources stay out of the compile set.
    expect(fs.readlinkSync(path.join(fixture.contractsDir, 'Token.sol'))).toBe('../../app/contracts/Token.sol');
    expect(fs.existsSync(path.join(fixture.contractsDir, 'Other.sol'))).toBe(false);
    // Subdirectories are mirrored recursively so relative imports keep resolving ...
    expect(fs.existsSync(path.join(fixture.contractsDir, 'vendor/Library.sol'))).toBe(true);
    // ... and a vendored `@scope` directory becomes a directory symlink rather than a compile target.
    const vendored = path.join(fixture.contractsDir, 'vendor/@openzeppelin');
    expect(fs.lstatSync(vendored).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(vendored, 'contracts/Context.sol'))).toBe(true);
    expect(fixture.verify().every((entry) => entry.ok)).toBe(true);
  });

  it('links the ported project tree and creates generated output directories', () => {
    const root = makeCheckout();
    stageProjectFixture(options(root));
    expect(fs.lstatSync(path.join(root, '.solidhat/project/src')).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(path.join(root, '.solidhat/project/src/index.ts')))
      .toBe(fs.realpathSync(path.join(root, 'app/src/index.ts')));
    expect(fs.statSync(path.join(root, '.solidhat/project/typechain-types')).isDirectory()).toBe(true);
  });

  it('is idempotent and repoints a stale link', () => {
    const root = makeCheckout();
    stageProjectFixture(options(root));
    const srcLink = path.join(root, '.solidhat/project/src');
    fs.unlinkSync(srcLink);
    fs.symlinkSync('../../app/test', srcLink);

    const second = stageProjectFixture(options(root));
    expect(fs.readlinkSync(srcLink)).toBe('../../app/src');
    expect(second.verify().every((entry) => entry.ok)).toBe(true);
  });

  it('prunes dangling links left by a renamed source', () => {
    const root = makeCheckout();
    const fixture = stageProjectFixture(options(root));
    fs.symlinkSync('../../app/contracts/Gone.sol', path.join(fixture.contractsDir, 'Gone.sol'));

    stageProjectFixture(options(root));
    expect(fs.existsSync(path.join(fixture.contractsDir, 'Gone.sol'))).toBe(false);
  });

  it('refuses to replace a real file unless forced', () => {
    const root = makeCheckout();
    const fixture = stageProjectFixture(options(root));
    const linkPath = path.join(fixture.contractsDir, 'Token.sol');
    fs.unlinkSync(linkPath);
    fs.writeFileSync(linkPath, 'real file');

    const blocked = stageProjectFixture(options(root));
    expect(blocked.entries.some((entry) => entry.reason === 'existing file is not a symlink')).toBe(true);
    expect(fs.readFileSync(linkPath, 'utf8')).toBe('real file');

    stageProjectFixture({ ...options(root), force: true });
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
  });

  it('throws when a mirrored source tree is missing', () => {
    const root = makeCheckout();
    expect(() => stageProjectFixture({
      ...options(root),
      contractMirrors: [{ directory: 'app/missing' }],
    })).toThrow('Fixture contract directory not found');
  });
});
