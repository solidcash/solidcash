/**
 * Fixture staging for drop-in Hardhat projects.
 *
 * A Hardhat-era project keeps its Solidity sources, application `src/`, and Mocha suite in its own tree, while the
 * gate that compiles and runs it works from a fixture directory. This module materializes that fixture as *relative
 * symlinks* back into the checkout, so the gate never copies sources and can never drift from them:
 *
 * - Contract sources are mirrored as one symlink per `.sol` file because the compile walker treats a *file*
 *   symlink as a compilable target but deliberately skips `@scope` / `node_modules` directories. Those skipped
 *   directories are mirrored as directory symlinks instead, so `./@openzeppelin/...` style relative imports used
 *   by vendored sources still resolve.
 * - Test and `src/` trees are linked whole so their internal relative imports work unchanged.
 *
 * Staging is idempotent: a correct link is left alone, a stale link is repointed, and a real file in the way is
 * reported and left untouched unless `force` is set.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Fixture directory used when a caller does not name one. */
export const DEFAULT_FIXTURE_DIR = '.solidhat';

/** A single symlink to materialize, both paths relative to the fixture root. */
export interface ProjectFixtureLink {
  /** Path created by the fixture (for example `.solidhat/project/src`). */
  link: string;
  /** Existing path in the checkout the link points at (for example `examples/app/src`). */
  target: string;
}

/** A directory whose Solidity sources become compile targets in the fixture. */
export interface ProjectFixtureContractMirror {
  /** Directory relative to the fixture root, for example `examples/app/contracts`. */
  directory: string;
  /**
   * Top-level `.sol` file names to mirror as compile targets. Omit to mirror every top-level `.sol` file. All
   * subdirectories are always mirrored recursively; vendored (`@scope`, `node_modules`) subtrees become directory
   * symlinks so relative imports keep resolving.
   */
  files?: readonly string[];
}

/** A directory copied (not linked) into the fixture, refreshed on every staging run. */
export interface ProjectFixtureCopy {
  /** Destination directory inside the fixture, relative to the fixture root. */
  directory: string;
  /** Existing directory in the checkout, relative to the fixture root. */
  target: string;
}

export interface ProjectFixtureOptions {
  /** Root that hosts the fixture; every other path is relative to it (usually the SolidHat project root). */
  root: string;
  /** Fixture directory relative to `root` (default {@link DEFAULT_FIXTURE_DIR}). */
  fixtureDir?: string;
  /** Subdirectory of the fixture holding mirrored contract sources (default `contracts`). */
  contractsDirName?: string;
  /** Subdirectory of the fixture holding the ported project tree (default `project`). */
  projectDirName?: string;
  /** Contract source trees to mirror into `<fixtureDir>/<contractsDirName>`. */
  contractMirrors?: readonly ProjectFixtureContractMirror[];
  /** Extra links (project `src`, ported test files, and so on). */
  links?: readonly ProjectFixtureLink[];
  /**
   * Directories copied into the fixture. Hardhat-era deployment scripts write beside themselves (`config.json`)
   * and resolve `../typechain-types` relative to their own file, so a script under test must own a real directory
   * in the fixture; a symlink back into the checkout would let a test overwrite a committed fixture.
   */
  copies?: readonly ProjectFixtureCopy[];
  /** Directories created when missing, such as a generated TypeChain output tree. */
  directories?: readonly string[];
  /** Replace an existing real file or directory occupying a link path. Defaults to `false`. */
  force?: boolean;
}

/** One staged entry plus whether the on-disk link currently matches the requested target. */
export interface ProjectFixtureEntry {
  link: string;
  target: string;
  absoluteLink: string;
  /** `true` when the link exists and resolves to `target`. */
  ok: boolean;
  /** Why the entry is not usable, when it is not. */
  reason?: string;
}

export interface ProjectFixture {
  root: string;
  fixtureDir: string;
  contractsDir: string;
  projectDir: string;
  entries: readonly ProjectFixtureEntry[];
  /** Re-check every staged link without touching the filesystem. */
  verify(): ProjectFixtureEntry[];
}

/** Directory names the SolidCash compile walker skips as vendored dependency trees. */
const isVendoredDirectory = (name: string): boolean => name === 'node_modules' || name.startsWith('@');

const relativeLink = (fromDirectory: string, to: string): string =>
  path.relative(fromDirectory, to).split(path.sep).join('/') || '.';

/** Create or repoint `linkPath`, refusing to clobber unrelated content unless `force` is set. */
function ensureLink(linkPath: string, targetPath: string, force: boolean): ProjectFixtureEntry {
  const parent = path.dirname(linkPath);
  fs.mkdirSync(parent, { recursive: true });
  const desired = relativeLink(parent, targetPath);
  const absoluteLink = linkPath;
  let current: string | undefined;
  try {
    current = fs.readlinkSync(linkPath);
  } catch (error) {
    // ENOENT: nothing there. EINVAL: something is there but it is not a symlink - fall through to the
    // real-file check below so the caller gets an actionable "not a symlink" reason instead of a raw errno.
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'EINVAL') {
      return { link: linkPath, target: targetPath, absoluteLink, ok: false, reason: (error as Error).message };
    }
  }
  if (current === undefined) {
    if (fs.existsSync(linkPath)) {
      if (!force) {
        return { link: linkPath, target: targetPath, absoluteLink, ok: false, reason: 'existing file is not a symlink' };
      }
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
  } else if (current === desired) {
    return { link: linkPath, target: targetPath, absoluteLink, ok: true };
  } else {
    fs.unlinkSync(linkPath);
  }
  fs.symlinkSync(desired, linkPath);
  return { link: linkPath, target: targetPath, absoluteLink, ok: true };
}

/** Mirror `.sol` targets and vendored directories from `sourceDir` into `destinationDir`. */
function mirrorContracts(
  sourceDir: string,
  destinationDir: string,
  files: readonly string[] | undefined,
  force: boolean,
  entries: ProjectFixtureEntry[],
  root: string,
): void {
  fs.mkdirSync(destinationDir, { recursive: true });
  const children = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const child of children) {
    const sourcePath = path.join(sourceDir, child.name);
    const destinationPath = path.join(destinationDir, child.name);
    if (child.isDirectory()) {
      if (isVendoredDirectory(child.name)) {
        entries.push(ensureLink(destinationPath, sourcePath, force));
        continue;
      }
      mirrorContracts(sourcePath, destinationPath, undefined, force, entries, root);
      continue;
    }
    if (!child.name.endsWith('.sol')) continue;
    if (files && !files.includes(child.name)) continue;
    if (!fs.existsSync(sourcePath)) continue;
    entries.push(ensureLink(destinationPath, sourcePath, force));
  }
}

/**
 * Remove fixture-owned symlinks that the current mirror no longer describes. Stale links matter: a dangling
 * `.sol` symlink left behind by a renamed source makes the compile walker throw on `statSync` instead of
 * reporting a moved project.
 */
function pruneStaleLinks(directory: string, keep: ReadonlySet<string>): void {
  if (!fs.existsSync(directory)) return;
  for (const child of fs.readdirSync(directory, { withFileTypes: true })) {
    const childPath = path.join(directory, child.name);
    if (child.isDirectory()) {
      pruneStaleLinks(childPath, keep);
      if (fs.readdirSync(childPath).length === 0) fs.rmdirSync(childPath);
      continue;
    }
    if (child.isSymbolicLink() && !keep.has(childPath)) fs.unlinkSync(childPath);
  }
}

/**
 * Materialize (or verify) a SolidHat fixture tree made of relative symlinks into the checkout.
 *
 * @throws when a mirrored source tree is missing, so a moved project fails the gate instead of silently compiling
 * an empty artifact set.
 */
export function stageProjectFixture(options: ProjectFixtureOptions): ProjectFixture {
  const root = path.resolve(options.root);
  const fixtureDir = path.resolve(root, options.fixtureDir ?? DEFAULT_FIXTURE_DIR);
  const contractsDir = path.join(fixtureDir, options.contractsDirName ?? 'contracts');
  const projectDir = path.join(fixtureDir, options.projectDirName ?? 'project');
  const force = options.force === true;
  const entries: ProjectFixtureEntry[] = [];

  for (const mirror of options.contractMirrors ?? []) {
    const sourceDir = path.resolve(root, mirror.directory);
    if (!fs.existsSync(sourceDir)) throw new Error(`Fixture contract directory not found: ${sourceDir}`);
    mirrorContracts(sourceDir, contractsDir, mirror.files, force, entries, root);
  }
  if ((options.contractMirrors ?? []).length > 0) {
    pruneStaleLinks(contractsDir, new Set(entries.map((entry) => entry.absoluteLink)));
  }

  for (const link of options.links ?? []) {
    const targetPath = path.resolve(root, link.target);
    if (!fs.existsSync(targetPath)) throw new Error(`Fixture link target not found: ${targetPath}`);
    entries.push(ensureLink(path.resolve(root, link.link), targetPath, force));
  }

  for (const copy of options.copies ?? []) {
    const sourceDir = path.resolve(root, copy.target);
    if (!fs.existsSync(sourceDir)) throw new Error(`Fixture copy target not found: ${sourceDir}`);
    const destinationDir = path.resolve(root, copy.directory);
    fs.rmSync(destinationDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(destinationDir), { recursive: true });
    fs.cpSync(sourceDir, destinationDir, { recursive: true });
  }

  for (const directory of options.directories ?? []) {
    fs.mkdirSync(path.resolve(root, directory), { recursive: true });
  }

  const verify = (): ProjectFixtureEntry[] => entries.map((entry) => {
    const expected = relativeLink(path.dirname(entry.absoluteLink), entry.target);
    try {
      return fs.readlinkSync(entry.absoluteLink) === expected
        ? { ...entry, ok: true, reason: undefined }
        : { ...entry, ok: false, reason: `points at ${fs.readlinkSync(entry.absoluteLink)}` };
    } catch (error) {
      return { ...entry, ok: false, reason: (error as Error).message };
    }
  });

  return { root, fixtureDir, contractsDir, projectDir, entries, verify };
}
