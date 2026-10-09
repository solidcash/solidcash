import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import setup, { fixtureStaleness } from './marketplace-fixture-fresh.mjs';

/** A worktree with one artifact and one compiler build file, each at the given time in seconds. */
function worktree(artifactAt, buildAt) {
  const root = mkdtempSync(path.join(tmpdir(), 'fixture-fresh-'));
  const artifacts = path.join(root, '.marketplace/artifacts/solidcash');
  const build = path.join(root, 'packages/solidc/dist/generation');
  mkdirSync(artifacts, { recursive: true });
  mkdirSync(build, { recursive: true });
  writeFileSync(path.join(artifacts, 'Market.json'), '{}');
  writeFileSync(path.join(build, 'Generate.js'), '');
  utimesSync(path.join(artifacts, 'Market.json'), artifactAt, artifactAt);
  utimesSync(path.join(build, 'Generate.js'), buildAt, buildAt);
  return root;
}

test('a fixture compiled after the compiler build is fresh', () => {
  const root = worktree(2_000_000, 1_000_000);
  try {
    assert.equal(fixtureStaleness(root).stale, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a compiler build after the fixture makes it stale, and the setup refuses to start', () => {
  const root = worktree(1_000_000, 2_000_000);
  const saved = { root: process.env.SOLIDCASH_PROJECT_ROOT, ok: process.env.MARKETPLACE_FIXTURE_STALE_OK };
  try {
    assert.equal(fixtureStaleness(root).stale, true);
    process.env.SOLIDCASH_PROJECT_ROOT = root;
    delete process.env.MARKETPLACE_FIXTURE_STALE_OK;
    assert.throws(() => setup(), /older than the compiler build.*recompile it first/);
    process.env.MARKETPLACE_FIXTURE_STALE_OK = '1';
    assert.doesNotThrow(() => setup());
  } finally {
    if (saved.root === undefined) delete process.env.SOLIDCASH_PROJECT_ROOT;
    else process.env.SOLIDCASH_PROJECT_ROOT = saved.root;
    if (saved.ok === undefined) delete process.env.MARKETPLACE_FIXTURE_STALE_OK;
    else process.env.MARKETPLACE_FIXTURE_STALE_OK = saved.ok;
    rmSync(root, { recursive: true, force: true });
  }
});

test('a lane switch after the fixture makes it stale, because the artifacts belong to the other lane', () => {
  const root = worktree(1_000_000, 500_000);
  const saved = { root: process.env.SOLIDCASH_PROJECT_ROOT, ok: process.env.MARKETPLACE_FIXTURE_STALE_OK };
  try {
    writeFileSync(path.join(root, '.marketplace/lane'), 'proxied\n');
    utimesSync(path.join(root, '.marketplace/lane'), 2_000_000, 2_000_000);
    const found = fixtureStaleness(root);
    assert.equal(found.olderThanBuild, false);
    assert.equal(found.laneSwitchedAfterFixture, true);
    assert.equal(found.stale, true);
    process.env.SOLIDCASH_PROJECT_ROOT = root;
    delete process.env.MARKETPLACE_FIXTURE_STALE_OK;
    assert.throws(() => setup(), /artifacts in \.marketplace\/artifacts belong to the lane this one just replaced/);
    process.env.MARKETPLACE_FIXTURE_STALE_OK = '1';
    assert.doesNotThrow(() => setup());
  } finally {
    if (saved.root === undefined) delete process.env.SOLIDCASH_PROJECT_ROOT;
    else process.env.SOLIDCASH_PROJECT_ROOT = saved.root;
    if (saved.ok === undefined) delete process.env.MARKETPLACE_FIXTURE_STALE_OK;
    else process.env.MARKETPLACE_FIXTURE_STALE_OK = saved.ok;
    rmSync(root, { recursive: true, force: true });
  }
});

test('a lane stamp older than the fixture is not stale', () => {
  const root = worktree(2_000_000, 500_000);
  try {
    writeFileSync(path.join(root, '.marketplace/lane'), 'proxied\n');
    utimesSync(path.join(root, '.marketplace/lane'), 1_000_000, 1_000_000);
    const found = fixtureStaleness(root);
    assert.equal(found.laneSwitchedAfterFixture, false);
    assert.equal(found.stale, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('no compiled fixture yet is not stale', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fixture-fresh-'));
  try {
    assert.equal(fixtureStaleness(root), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
