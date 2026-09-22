import { describe, expect, it } from 'vitest';
import {
  clearCompileCache, compileString, compileStringMulti, getArtifactCacheHitCount,
} from '../../src/compiler.js';
import {
  createKernelReadCarrierBindingToken, isKernelReadCarrierBindingToken,
} from '../../src/semantic/KernelReadCarrierAuthorization.js';

type Scope = Readonly<{
  selectorHex: string;
  completedDescriptorDigest: string;
  streamDescriptorDigests: readonly string[];
}>;
type ScopeBox = {
  hasSourceCandidate?: boolean;
  observedScopes?: readonly Scope[];
  expectedScopes?: readonly Scope[];
  verifiedScopes?: readonly Scope[];
  mismatch?: boolean;
  codegenMatchedStreams?: Set<string>;
  codegenMatchedRouteScopes?: Set<string>;
  bindingToken?: object;
};

const source = `contract C() {
  mapping(int => int) before;
  mapping(int => int) after;
  function seed(int key, int value) public {
    this.before[key] = value;
    this.after[key] = 0;
    require(true);
  }
  function copy(int count) public {
    for (int index = 0; index < count; index = index + 1) {
      this.after[index] = this.before[index];
    }
    require(true);
  }
}`;

const compile = (
  optimizeForCompilationSpeed: boolean, box: ScopeBox,
): ReturnType<typeof compileString> => compileString(source, {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  optimizeForCompilationSpeed,
  suppressWarnings: true,
  __artifactCache: false,
  __strictNoInternalRecovery: true,
  __kernelReadCarrierAuthorizationBox: box,
} as Parameters<typeof compileString>[1]);

describe('kernel read-carrier compiler scope', () => {
  it('revokes binding authority before a multi-artifact memory-cache return', () => {
    clearCompileCache();
    const cached = compileStringMulti('contract CachedMulti { function f() { require(true); } }', {
      __artifactCache: true,
      messageBus: false,
      suppressWarnings: true,
    });
    const token = createKernelReadCarrierBindingToken();
    const box: ScopeBox = { bindingToken: token };
    let reads = 0;
    const options = {
      __artifactCache: true,
      messageBus: false,
      suppressWarnings: true,
    } as Parameters<typeof compileStringMulti>[1];
    // Audit boxes ordinarily bypass artifact caching. Vary the accessor across the sanitation read and options
    // snapshot to exercise the cache return itself, rather than merely proving cleanup on another cache miss.
    Object.defineProperty(options, '__kernelReadCarrierAuthorizationBox', {
      enumerable: true,
      get: () => (++reads === 1 ? box : undefined),
    });

    const hit = compileStringMulti('contract CachedMulti { function f() { require(true); } }', options);
    expect(getArtifactCacheHitCount()).toBe(1);
    expect(hit.CachedMulti.bytecode).toBe(cached.CachedMulti.bytecode);
    expect(box.bindingToken).toBeUndefined();
    expect(isKernelReadCarrierBindingToken(token)).toBe(false);
    clearCompileCache();
  });

  it('carries only frozen completed-ABI authority across normal and speed binder passes', () => {
    const digests: string[] = [];
    for (const optimizeForCompilationSpeed of [false, true]) {
      const box: ScopeBox = {};
      const artifact = compile(optimizeForCompilationSpeed, box);
      expect(box.hasSourceCandidate).toBe(true);
      expect(box.observedScopes).toHaveLength(1);
      expect(box.verifiedScopes).toEqual(box.observedScopes);
      expect(box.expectedScopes).toBeUndefined();
      const scope = box.observedScopes![0];
      expect(scope.selectorHex).toMatch(/^[0-9a-f]{8}$/);
      expect(scope.completedDescriptorDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(scope.streamDescriptorDigests).toHaveLength(2);
      expect(Object.isFrozen(box.observedScopes)).toBe(true);
      expect(Object.isFrozen(scope)).toBe(true);
      expect(Object.isFrozen(scope.streamDescriptorDigests)).toBe(true);
      digests.push(scope.completedDescriptorDigest);

      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'copy'))
        .toMatchObject({ eligible: true });
      expect(JSON.stringify(artifact)).toContain(scope.completedDescriptorDigest);
      expect(JSON.stringify(artifact)).not.toContain('__kernelReadCarrierAuthorizationBox');
    }
    expect(new Set(digests).size).toBe(1);
  }, 120_000);

  it('does not treat caller-seeded malformed scope metadata as compiler binding authority', () => {
    const first: ScopeBox = {};
    compile(false, first);
    const scope = first.observedScopes![0];
    const hostile: ScopeBox = {
      expectedScopes: [{
        ...scope,
        streamDescriptorDigests: [scope.streamDescriptorDigests[0], '00'.repeat(32)],
      }],
    };
    expect(() => compile(false, hostile))
      .toThrow(/kernel read-carrier authorization changed during pristine verifier binding/);
    expect(hostile.mismatch).toBe(true);
    expect(hostile.verifiedScopes).toBeUndefined();
  }, 120_000);

  it('rejects exact caller-seeded scope metadata without a compiler binding token', () => {
    const first: ScopeBox = {};
    compile(false, first);
    const scope = first.observedScopes![0];
    const exact: ScopeBox = { expectedScopes: [scope] };
    expect(() => compile(false, exact))
      .toThrow(/kernel read-carrier authorization changed during pristine verifier binding/);
    expect(exact.mismatch).toBe(true);
    expect(exact.verifiedScopes).toBeUndefined();
    expect(exact.expectedScopes).toEqual([scope]);

    const wrongSelector: ScopeBox = {
      expectedScopes: [{ ...scope, selectorHex: '00000001' }],
    };
    expect(() => compile(false, wrongSelector))
      .toThrow(/kernel read-carrier authorization changed during pristine verifier binding/);
    expect(wrongSelector.mismatch).toBe(true);
  }, 120_000);

  it('revokes caller-visible binding identities before success, failure, or reuse', () => {
    const successfulToken = createKernelReadCarrierBindingToken();
    const successful: ScopeBox = { bindingToken: successfulToken };
    compile(false, successful);
    expect(successful.bindingToken).toBeUndefined();
    expect(isKernelReadCarrierBindingToken(successfulToken)).toBe(false);

    const failedToken = createKernelReadCarrierBindingToken();
    const failed: ScopeBox = { bindingToken: failedToken };
    expect(() => compileString('contract Broken( {', {
      messageBusKernel: true,
      __artifactCache: false,
      __kernelReadCarrierAuthorizationBox: failed,
    } as Parameters<typeof compileString>[1])).toThrow();
    expect(failed.bindingToken).toBeUndefined();
    expect(isKernelReadCarrierBindingToken(failedToken)).toBe(false);

    const reused: ScopeBox = { bindingToken: successfulToken };
    compile(false, reused);
    expect(reused.bindingToken).toBeUndefined();
    expect(isKernelReadCarrierBindingToken(successfulToken)).toBe(false);
  }, 120_000);
});
