import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from '../src/index.js';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, { sortedMappingsAll: false, ...o } as any);

// The C2 sorted-linked-list mapping opt-in (CompilerOptions.sortedMappings). The covenant + SDK (SortedList) are
// proven and shipped; the source-level codegen is pending, so the compiler marks the collection sorted (metadata
// for the SDK) but FAILS CLOSED on a source-level access - it never silently compiles to the omittable entry
// model, which would reintroduce C2. See docs/sorted-mapping-c2.md.
describe('sorted mapping opt-in (C2)', () => {
  const SET = 'contract C() { mapping(int => bool) claimed;';

  it('marks the named mapping sorted in the artifact metadata', () => {
    const art = compileString(`${SET} function f() { require(true); } }`, { sortedMappings: ['claimed'], forceStateful: true });
    const col = art.stateLayout?.collections?.find((c) => c.name === 'claimed');
    expect(col?.sorted).toBe(true);
    expect(art.stateLayout?.mappings?.find((c) => c.name === 'claimed')?.sorted).toBe(true);
  });

  it('only marks the mappings named in sortedMappings', () => {
    const art = compileString(
      'contract C() { mapping(int => bool) a; mapping(int => bool) b; function f() { require(true); } }',
      { sortedMappings: ['a'], forceStateful: true },
    );
    expect(art.stateLayout?.collections?.find((c) => c.name === 'a')?.sorted).toBe(true);
    expect(art.stateLayout?.collections?.find((c) => c.name === 'b')?.sorted).toBeUndefined();
  });

  it('compiles a source-level read of a sorted mapping (emits the C2 read covenant)', () => {
    // The read codegen is implemented + VM-verified (SortedMappingCompiledRead.test.ts); it emits the proven
    // membership/bracket covenant instead of the omittable entry-model read.
    expect(() => compileString(`${SET} function f(int k) { require(!claimed[k]); } }`, { sortedMappings: ['claimed'], forceStateful: true }))
      .not.toThrow();
  });

  it('compiles a source-level WRITE of a sorted set (emits the C2 insert covenant)', () => {
    // The write codegen is implemented + VM-verified (SortedMappingCompiledWrite.test.ts); `claimed[k]=true`
    // emits the proven sorted-list insert (bracket + splice), not the omittable entry-model write.
    expect(() => compileString(`${SET} function f(int k) { claimed[k] = true; } }`, { sortedMappings: ['claimed'], forceStateful: true }))
      .not.toThrow();
  });

  it('compiles a value-typed sorted mapping upsert (mapping(int=>int) bal[k]=v)', () => {
    // The value upsert (update if present, insert if absent) is implemented + VM-verified
    // (SortedMappingValueWrite.test.ts): present -> k'[link|v], absent -> P' + NEW[k|next|v].
    const MAP = 'contract C() { mapping(int => int) bal;';
    expect(() => compileString(`${MAP} function f(int k, int v) { bal[k] = v; } }`, { sortedMappings: ['bal'], forceStateful: true }))
      .not.toThrow();
  });

  it('compiles address-keyed mappings (ERC20 balance/allowance shapes)', () => {
    // Address keys are hashed as their locking bytecode (VM-verified in SortedMappingAddressKey.test.ts).
    const B = 'contract C() { mapping(address => int) bal; function f(address a, int v) { bal[a] = v; } }';
    expect(() => compileString(B, { sortedMappings: ['bal'], forceStateful: true })).not.toThrow();
    const A = 'contract C() { mapping(address => mapping(address => int)) allow; function f(address o, address s, int v) { allow[o][s] = v; } }';
    expect(() => compileString(A, { sortedMappings: ['allow'], forceStateful: true })).not.toThrow();
  });

  it('compiles a nested / composite-key mapping (mapping(A=>mapping(B=>V)))', () => {
    // slot = sha256(sha256(a)++sha256(b)) high-bit-masked (keyToSlotMulti); each key hashed independently so any
    // key type works. VM-verified in SortedMappingNested.test.ts (ERC20-allowance shape).
    const MAP = 'contract C() { mapping(int => mapping(int => int)) allow;';
    expect(() => compileString(`${MAP} function f(int a, int b, int v) { allow[a][b] = v; } }`, { sortedMappings: ['allow'], forceStateful: true }))
      .not.toThrow();
  });

  it('compiles a fixed-width bytesN value type (raw commitment tail)', () => {
    const MAP = 'contract C() { mapping(int => bytes4) meta;';
    expect(() => compileString(`${MAP} function f(int k) { meta[k] = 0x11223344; } }`, { sortedMappings: ['meta'], forceStateful: true }))
      .not.toThrow();
  });

  it('compiles an address value type (stored verbatim as the locking-bytecode tail)', () => {
    // address is stored verbatim in the (last) value tail; variable width is unambiguous there. VM-verified in
    // SortedMappingAddressValue.test.ts.
    const MAP = 'contract C() { mapping(int => address) owner;';
    expect(() => compileString(`${MAP} function f(int k, address a) { owner[k] = a; } }`, { sortedMappings: ['owner'], forceStateful: true }))
      .not.toThrow();
  });

  it('compiles a (encodable) struct value type (stored verbatim as the blob tail)', () => {
    // A struct is stored verbatim in the value tail; a field read decodes it. VM-verified in
    // SortedMappingStructValue.test.ts.
    const MAP = 'contract C() { struct P { int x; int y; } mapping(int => P) pos;';
    expect(() => compileString(`${MAP} function f(int k) { pos[k] = P(1, 2); } }`, { sortedMappings: ['pos'], forceStateful: true }))
      .not.toThrow();
  });

  it('compiles an unbounded bytes value type (P5a: value in the 64 B tail; >64 B fails closed at the VM)', () => {
    const MAP = 'contract C() { mapping(int => bytes) blob;';
    expect(() => compileString(`${MAP} function f(int k, bytes b) { blob[k] = b; } }`, { sortedMappings: ['blob'], forceStateful: true }))
      .not.toThrow();
  });

  it('compiles delete of a sorted VALUE mapping (== set to default, via the upsert)', () => {
    // `delete bal[k]` on mapping(int=>int) is Solidity `bal[k]=0`, so it routes through the value upsert.
    const MAP = 'contract C() { mapping(int => int) bal;';
    expect(() => compileString(`${MAP} function f(int k) { require(true); delete bal[k]; } }`, { sortedMappings: ['bal'], forceStateful: true }))
      .not.toThrow();
  });

  it('compiles delete of a sorted bool set (NULLIFY == set false, Solidity delete parity)', () => {
    // Solidity `delete m[k]` == assign the default (false), not a physical removal, so a bool set is a value
    // mapping (true=0x01, false/delete=empty tail) and delete routes through the upsert-to-default. VM-verified in
    // SortedMappingBoolNullify.test.ts. So `claimed[k]=false` and `delete claimed[k]` both compile now.
    expect(() => compileString(`${SET} function f(int k) { require(true); delete claimed[k]; } }`, { sortedMappings: ['claimed'], forceStateful: true }))
      .not.toThrow();
    expect(() => compileString(`${SET} function g(int k) { claimed[k] = false; } }`, { sortedMappings: ['claimed'], forceStateful: true }))
      .not.toThrow();
  });

  it('without the opt-in, the same mapping compiles on the default entry model', () => {
    expect(() => compileString(`${SET} function f(int k) { claimed[k] = true; } }`, { forceStateful: true })).not.toThrow();
  });
});

// A sorted (C2) mapping keyed by msg.sender / tx.origin is not yet drivable: the SDK has no keySource to resolve the
// caller's slot (keyToSlot of the tx.origin P2PKH lockscript), so the covenant reverts at the VM. It now fails CLOSED
// at COMPILE with a clear, actionable message instead of compiling then reverting at runtime. deferrals "multitransfer
// (a)". A PARAMETER address key works; msg.sender used AS A VALUE (not a key) is unaffected.
describe('sorted mapping keyed by msg.sender / tx.origin fails closed at compile', () => {
  const M = 'contract C() { mapping(address => int) bal;';
  const opt = { sortedMappings: ['bal'], forceStateful: true };
  const err = /keyed by 'msg\.sender'|keyed by 'tx\.origin'|not yet supported/;

  it('write bal[msg.sender] = v fails closed with a clear message', () => {
    expect(() => compileString(`${M} function f(int v, pubkey pk, sig s) { require(checkSig(s,pk)); bal[msg.sender] = v; } }`, opt))
      .toThrow(err);
  });
  it('read bal[msg.sender] fails closed', () => {
    expect(() => compileString(`${M} function f(int e, pubkey pk, sig s) { require(checkSig(s,pk)); require(bal[msg.sender] == e); } }`, opt))
      .toThrow(err);
  });
  it('delete bal[msg.sender] fails closed', () => {
    expect(() => compileString(`${M} function f(pubkey pk, sig s) { require(checkSig(s,pk)); delete bal[msg.sender]; } }`, opt))
      .toThrow(err);
  });
  it('tx.origin key fails closed', () => {
    expect(() => compileString(`${M} function f(int v, pubkey pk, sig s) { require(checkSig(s,pk)); bal[tx.origin] = v; } }`, opt))
      .toThrow(err);
  });
  it('a PARAMETER address key still compiles (the BCH idiom)', () => {
    expect(() => compileString(`${M} function f(address a, int v, pubkey pk, sig s) { require(checkSig(s,pk)); bal[a] = v; } }`, opt))
      .not.toThrow();
  });
  it('msg.sender used AS A VALUE (not a key) still compiles', () => {
    expect(() => compileString('contract C() { mapping(int => address) owner; function f(int k, pubkey pk, sig s) { require(checkSig(s,pk)); owner[k] = msg.sender; } }', { sortedMappings: ['owner'], forceStateful: true }))
      .not.toThrow();
  });
});
