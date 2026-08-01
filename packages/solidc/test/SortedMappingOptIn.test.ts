import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from '../src/index.js';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, { sortedMappingsAll: false, ...o } as any);

// The C2 sorted-linked-list mapping opt-in (CompilerOptions.sortedMappings). The covenant + SDK (SortedList) are
// proven and shipped; the source-level codegen is pending, so the compiler marks the collection sorted (metadata
// for the SDK) but FAILS CLOSED on a source-level access - it never silently compiles to the omittable entry
// model, which would reintroduce C2. See docs/sorted-mapping-c2.md.
describe('sorted mapping opt-in (C2)', () => {
  const SET = 'contract C() { mapping(int => bool) claimed;';
  const assertSortedCompile = (source: string, mapping: string): ReturnType<typeof compileString> => {
    const artifact = compileString(source, { sortedMappings: [mapping], forceStateful: true });
    expect(artifact.debug.bytecode).not.toBe('');
    expect(artifact.stateLayout?.collections?.find((row) => row.name === mapping)?.sorted).toBe(true);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.entryAccesses?.length).toBeGreaterThan(0);
    return artifact;
  };

  it('marks the named mapping sorted in the artifact metadata', () => {
    const art = compileString(`${SET} function f() { require(true); } }`, { sortedMappings: ['claimed'], forceStateful: true });
    const col = art.stateLayout?.collections?.find((c) => c.name === 'claimed');
    expect(col?.sorted).toBe(true);
    expect(art.stateLayout?.mappings?.find((c) => c.name === 'claimed')?.sorted).toBe(true);
  });

  it('marks every mapping sorted under the mandatory C2 model', () => {
    const art = compileString(
      'contract C() { mapping(int => bool) a; mapping(int => bool) b; function f() { require(true); } }',
      { sortedMappings: ['a'], forceStateful: true },
    );
    expect(art.stateLayout?.collections?.find((c) => c.name === 'a')?.sorted).toBe(true);
    expect(art.stateLayout?.collections?.find((c) => c.name === 'b')?.sorted).toBe(true);
  });

  it('compiles a source-level read of a sorted mapping (emits the C2 read covenant)', () => {
    // The read codegen is implemented + VM-verified (SortedMappingCompiledRead.test.ts); it emits the proven
    // membership/bracket covenant instead of the omittable entry-model read.
    assertSortedCompile(`${SET} function f(int k) { require(!claimed[k]); } }`, 'claimed');
  });

  it('compiles a source-level WRITE of a sorted set (emits the C2 insert covenant)', () => {
    // The write codegen is implemented + VM-verified (SortedMappingCompiledWrite.test.ts); `claimed[k]=true`
    // emits the proven sorted-list insert (bracket + splice), not the omittable entry-model write.
    assertSortedCompile(`${SET} function f(int k) { claimed[k] = true; } }`, 'claimed');
  });

  it('compiles a value-typed sorted mapping upsert (mapping(int=>int) bal[k]=v)', () => {
    // The value upsert (update if present, insert if absent) is implemented + VM-verified
    // (SortedMappingValueWrite.test.ts): present -> k'[link|v], absent -> P' + NEW[k|next|v].
    const MAP = 'contract C() { mapping(int => int) bal;';
    assertSortedCompile(`${MAP} function f(int k, int v) { bal[k] = v; } }`, 'bal');
  });

  it('compiles address-keyed mappings (ERC20 balance/allowance shapes)', () => {
    // Address keys are hashed as their locking bytecode (VM-verified in SortedMappingAddressKey.test.ts).
    const B = 'contract C() { mapping(address => int) bal; function f(address a, int v) { bal[a] = v; } }';
    assertSortedCompile(B, 'bal');
    const A = 'contract C() { mapping(address => mapping(address => int)) allow; function f(address o, address s, int v) { allow[o][s] = v; } }';
    assertSortedCompile(A, 'allow');
  });

  it('compiles a nested / composite-key mapping (mapping(A=>mapping(B=>V)))', () => {
    // slot = sha256(sha256(a)++sha256(b)) high-bit-masked (keyToSlotMulti); each key hashed independently so any
    // key type works. VM-verified in SortedMappingNested.test.ts (ERC20-allowance shape).
    const MAP = 'contract C() { mapping(int => mapping(int => int)) allow;';
    assertSortedCompile(`${MAP} function f(int a, int b, int v) { allow[a][b] = v; } }`, 'allow');
  });

  it('compiles a fixed-width bytesN value type (raw commitment tail)', () => {
    const MAP = 'contract C() { mapping(int => bytes4) meta;';
    assertSortedCompile(`${MAP} function f(int k) { meta[k] = 0x11223344; } }`, 'meta');
  });

  it('compiles an address value type (stored verbatim as the locking-bytecode tail)', () => {
    // address is stored verbatim in the (last) value tail; variable width is unambiguous there. VM-verified in
    // SortedMappingAddressValue.test.ts.
    const MAP = 'contract C() { mapping(int => address) owner;';
    assertSortedCompile(`${MAP} function f(int k, address a) { owner[k] = a; } }`, 'owner');
  });

  it('compiles a (encodable) struct value type (stored verbatim as the blob tail)', () => {
    // A struct is stored verbatim in the value tail; a field read decodes it. VM-verified in
    // SortedMappingStructValue.test.ts.
    const MAP = 'contract C() { struct P { int x; int y; } mapping(int => P) pos;';
    assertSortedCompile(`${MAP} function f(int k) { pos[k] = P(1, 2); } }`, 'pos');
  });

  it('compiles an unbounded bytes value type (P5a: value in the 64 B tail; >64 B fails closed at the VM)', () => {
    const MAP = 'contract C() { mapping(int => bytes) blob;';
    assertSortedCompile(`${MAP} function f(int k, bytes b) { blob[k] = b; } }`, 'blob');
  });

  it('compiles delete of a sorted VALUE mapping (== set to default, via the upsert)', () => {
    // `delete bal[k]` on mapping(int=>int) is Solidity `bal[k]=0`, so it routes through the value upsert.
    const MAP = 'contract C() { mapping(int => int) bal;';
    assertSortedCompile(`${MAP} function f(int k) { require(true); delete bal[k]; } }`, 'bal');
  });

  it('compiles delete of a sorted bool set (NULLIFY == set false, Solidity delete parity)', () => {
    // Solidity `delete m[k]` == assign the default (false), not a physical removal, so a bool set is a value
    // mapping (true=0x01, false/delete=empty tail) and delete routes through the upsert-to-default. VM-verified in
    // SortedMappingBoolNullify.test.ts. So `claimed[k]=false` and `delete claimed[k]` both compile now.
    assertSortedCompile(`${SET} function f(int k) { require(true); delete claimed[k]; } }`, 'claimed');
    const assigned = compileString(`${SET} function g(int k) { claimed[k] = false; } }`, {
      sortedMappings: ['claimed'], forceStateful: true,
    });
    expect(assigned.abi.find((fn) => fn.name === 'g')?.entryAccesses?.length).toBeGreaterThan(0);
  });

  it('without a named opt-in, the mandatory C2 model still marks and binds the mapping', () => {
    const artifact = compileString(`${SET} function f(int k) { claimed[k] = true; } }`, { forceStateful: true });
    expect(artifact.debug.bytecode).not.toBe('');
    expect(artifact.stateLayout?.collections?.find((row) => row.name === 'claimed')?.sorted).toBe(true);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.entryAccesses?.length).toBeGreaterThan(0);
  });

  it('necessity controls: removing the access removes the metadata this slice asserts', () => {
    const noRead = compileString(`${SET} function f(int k) { require(k >= 0); } }`, {
      sortedMappings: ['claimed'], forceStateful: true,
    });
    expect(noRead.abi.find((fn) => fn.name === 'f')?.entryAccesses ?? []).toEqual([]);
    const noWrite = compileString('contract C() { mapping(int => int) bal; function f(int k, int v) '
      + '{ require(k + v >= 0); } }', { sortedMappings: ['bal'], forceStateful: true });
    expect(noWrite.abi.find((fn) => fn.name === 'f')?.entryAccesses ?? []).toEqual([]);
  });
});

// A sorted (C2) mapping keyed by msg.sender / tx.origin compiles and records a `msgSender` keySource: on BCH a direct
// call's msg.sender = tx.origin = the first native P2PKH input, so the SDK computes slot = keyToSlot(the sender's
// P2PKH lockscript) and forces the signer's native P2PKH funder. End-to-end VM proof (write/update/read + cross-sender
// isolation) is in solidcash MsgSenderC2.test.ts. Here we assert the compile side: it compiles + tags the keySource.
describe('sorted mapping keyed by msg.sender / tx.origin compiles (msgSender keySource)', () => {
  const M = 'contract C() { mapping(address => int) bal;';
  const opt = { sortedMappings: ['bal'], forceStateful: true };
  const ksOf = (src: string): unknown => compileString(src, opt).abi.find((f) => f.name === 'f')?.entryAccesses?.[0]?.keySources?.[0];

  it('write bal[msg.sender] = v compiles + records the msgSender keySource', () => {
    const ks = ksOf(`${M} function f(int v, pubkey pk, sig s) { require(checkSig(s,pk)); bal[msg.sender] = v; } }`);
    expect(ks).toMatchObject({ kind: 'msgSender', senderOp: 'msg.sender' });
  });
  it('read bal[msg.sender] compiles', () => {
    const ks = ksOf(`${M} function f(int e, pubkey pk, sig s) { require(checkSig(s,pk)); require(bal[msg.sender] == e); } }`);
    expect(ks).toMatchObject({ kind: 'msgSender' });
  });
  it('tx.origin key compiles + records senderOp tx.origin', () => {
    const ks = ksOf(`${M} function f(int v, pubkey pk, sig s) { require(checkSig(s,pk)); bal[tx.origin] = v; } }`);
    expect(ks).toMatchObject({ kind: 'msgSender', senderOp: 'tx.origin' });
  });
  it('a PARAMETER address key stays a param keySource', () => {
    const artifact = compileString(`${M} function f(address a, int v, pubkey pk, sig s) { require(checkSig(s,pk)); bal[a] = v; } }`, opt);
    expect(artifact.abi.find((fn) => fn.name === 'f')?.entryAccesses?.[0])
      .toMatchObject({ collection: 'bal', keyParams: ['a'], operations: ['write'] });
  });
  it('msg.sender used AS A VALUE (not a key) still compiles', () => {
    const artifact = compileString('contract C() { mapping(int => address) owner; function f(int k, pubkey pk, sig s) { require(checkSig(s,pk)); owner[k] = msg.sender; } }', { sortedMappings: ['owner'], forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'f')?.entryAccesses?.[0])
      .toMatchObject({ collection: 'owner', keyParams: ['k'], operations: ['write'] });
    expect(artifact.debug.bytecode).not.toBe('');
  });
});
