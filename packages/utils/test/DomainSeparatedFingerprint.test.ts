/**
 * domain-separated fingerprint: domain-separated canonical binary fingerprints.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  artifactExecutionIdentityFingerprint,
  canonicalJsonBytes,
  canonicalJsonValue,
  domainSeparatedFingerprint,
  encodeFingerprintField,
  FINGERPRINT_DOMAIN_ARTIFACT_EXECUTION,
  FINGERPRINT_DOMAIN_JOURNAL_DISPOSITION,
} from '../src/domain-separated-fingerprint.js';
import { kernelJournalDispositionManifestDigest } from '../src/kernel-journal-disposition.js';

describe('domain-separated fingerprint domain-separated fingerprints', () => {
  it('same payload under two domains yields different digests', () => {
    const fields = [
      { name: 'version', value: '1' },
      { name: 'payload', value: 'hello' },
    ];
    const a = domainSeparatedFingerprint('domain.a.v1', fields);
    const b = domainSeparatedFingerprint('domain.b.v1', fields);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('field reorder changes digest; same ordered fields are stable', () => {
    const left = domainSeparatedFingerprint('dom', [
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
    const right = domainSeparatedFingerprint('dom', [
      { name: 'b', value: '2' },
      { name: 'a', value: '1' },
    ]);
    const again = domainSeparatedFingerprint('dom', [
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
    expect(left).not.toBe(right);
    expect(left).toBe(again);
  });

  it('encodeFingerprintField is length-prefixed (not JSON)', () => {
    const encoded = encodeFingerprintField('sel', 'aabb');
    // u16 name len = 3, name "sel", u32 value len = 4, value "aabb"
    expect(encoded[0]).toBe(0);
    expect(encoded[1]).toBe(3);
    expect(String.fromCharCode(encoded[2], encoded[3], encoded[4])).toBe('sel');
    expect(encoded[5]).toBe(0);
    expect(encoded[6]).toBe(0);
    expect(encoded[7]).toBe(0);
    expect(encoded[8]).toBe(4);
  });

  it('canonicalJsonValue sorts object keys recursively', () => {
    expect(canonicalJsonValue({ b: 1, a: { d: 2, c: 3 } })).toEqual({
      a: { c: 3, d: 2 },
      b: 1,
    });
    const bytes = canonicalJsonBytes({ z: 1, a: 2 });
    expect(new TextDecoder().decode(bytes)).toBe('{"a":2,"z":1}');
  });

  it('kernelJournalDispositionManifestDigest does not use JSON.stringify and is domain-separated', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../src/kernel-journal-disposition.ts'), 'utf8');
    expect(src).toContain('domainSeparatedFingerprint');
    expect(src).toContain('FINGERPRINT_DOMAIN_JOURNAL_DISPOSITION');
    const codeLines = src.split('\n').filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
    expect(codeLines.some((line) => /JSON\.stringify/.test(line))).toBe(false);

    const digest = kernelJournalDispositionManifestDigest({
      version: 1,
      handlers: [{
        selectorHex: 'aabbccdd',
        completedDescriptorDigest: '11'.repeat(32),
        mode: 'carrier',
        streams: [{
          journalAccessStreamIndex: 0,
          descriptorDigest: '22'.repeat(32),
          disposition: 'eager-journal',
        }],
      }],
    });
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    // Same logical payload under the artifact domain must differ.
    const otherDomain = domainSeparatedFingerprint(FINGERPRINT_DOMAIN_ARTIFACT_EXECUTION, [
      { name: 'version', value: '1' },
      { name: 'handler.0.selectorHex', value: 'aabbccdd' },
    ]);
    expect(digest).not.toBe(otherDomain);
    expect(FINGERPRINT_DOMAIN_JOURNAL_DISPOSITION).toContain('kernel-journal-disposition');
  });

  it('artifactExecutionIdentityFingerprint is domain-separated and stable under key reorder in nested objects', () => {
    const a = artifactExecutionIdentityFingerprint({
      contractName: 'C',
      bytecode: 'OP_1',
      fingerprint: 'aa'.repeat(32),
      abi: [{ name: 'f', selector: 'deadbeef' }],
      messageBus: { version: 1, z: 1, a: 2 },
      stateLayout: { b: 1, a: 2 },
    });
    const b = artifactExecutionIdentityFingerprint({
      contractName: 'C',
      bytecode: 'OP_1',
      fingerprint: 'aa'.repeat(32),
      abi: [{ name: 'f', selector: 'deadbeef' }],
      messageBus: { a: 2, version: 1, z: 1 },
      stateLayout: { a: 2, b: 1 },
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);

    const changed = artifactExecutionIdentityFingerprint({
      contractName: 'C',
      bytecode: 'OP_2',
      fingerprint: 'aa'.repeat(32),
      abi: [{ name: 'f', selector: 'deadbeef' }],
      messageBus: { version: 1 },
      stateLayout: {},
    });
    expect(changed).not.toBe(a);
  });

  it('worklist production path calls artifactExecutionIdentityFingerprint (structural)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      join(here, '../../solidcash/src/message-bus/worklist.ts'),
      'utf8',
    );
    expect(src).toContain('artifactExecutionIdentityFingerprint');
    expect(src).not.toMatch(/JSON\.stringify\(artifact\)/);
  });
});
