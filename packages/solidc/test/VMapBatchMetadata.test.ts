import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

describe('vmap fixed-write batch metadata', () => {
  it('publishes chunkable-array identity on a nested collection writer', () => {
    const artifact = compileString(`contract Data() {
      mapping(int => int[]) notices;
      function appendNotice(int key, int value) {
        this.notices[key].push(value);
        require(true);
      }
    }`);
    const append = artifact.abi.find((fn) => fn.name === 'appendNotice');
    expect(append?.entryAccesses?.find((access) => access.collection === 'notices'))
      .toMatchObject({ operations: ['read', 'write'], chunkableArrayValue: true });
  });

  it('binds a chunkable-array element recipe to the exact mutated parameter and effect', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Packet { uint8 tag; bytes owner; bytes data; uint32 recordedAt; }
      contract Archive {
        mapping(uint256 => Packet[]) history;
        function append(uint256 key, Packet decoy, Packet selected) public {
          selected.recordedAt = uint32(block.timestamp);
          history[key].push(selected);
          require(true);
        }
      }
    `, { forceStateful: true, solidityImportCompat: true, messageBus: true, messageBusKernel: true });
    const access = artifact.abi.find((fn) => fn.name === 'append')?.entryAccesses?.[0];
    expect(access?.storedElementSource).toMatchObject({
      version: 1,
      mutationEffectOrdinal: access?.mutationEffectOrdinals?.[0],
      elementType: 'Packet',
      expression: {
        kind: 'call', name: 'Packet', type: 'Packet',
        args: [
          expect.objectContaining({ kind: 'field', name: 'tag' }),
          expect.objectContaining({ kind: 'field', name: 'owner' }),
          expect.objectContaining({ kind: 'field', name: 'data' }),
          expect.objectContaining({ kind: 'cast', type: 'uint32', expression: expect.objectContaining({
            kind: 'state', name: '__block_timestamp',
          }) }),
        ],
      },
    });
    expect(access?.arrayMutation).toBe('push');
    const selectedSource = access?.storedElementSource?.expression.args?.[0].expression;
    expect(selectedSource).toMatchObject({ source: { kind: 'forward', paramIndex: 2 } });
  });

  it('omits a stored-element recipe when control flow can redefine its operand', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Cell { uint256 value; uint32 writtenAt; }
      contract Archive {
        mapping(uint256 => Cell[]) history;
        function append(uint256 key, Cell selected, bool replace) public {
          if (replace) selected.writtenAt = uint32(block.timestamp);
          history[key].push(selected);
          require(true);
        }
      }
    `, { forceStateful: true, solidityImportCompat: true, messageBus: true, messageBusKernel: true });
    const access = artifact.abi.find((fn) => fn.name === 'append')?.entryAccesses?.[0];
    expect(access?.storedElementSource).toBeUndefined();
    expect(access?.arrayMutation).toBe('push');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('omits a stored-element recipe after an unsupported local mutation', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Cell { uint256 value; }
      contract Archive {
        mapping(uint256 => Cell[]) history;
        function append(uint256 key, Cell selected) public {
          delete selected;
          history[key].push(selected);
          require(true);
        }
      }
    `, { forceStateful: true, solidityImportCompat: true, messageBus: true, messageBusKernel: true });
    const access = artifact.abi.find((fn) => fn.name === 'append')?.entryAccesses?.[0];
    expect(access).toMatchObject({ arrayMutation: 'push' });
    expect(access?.storedElementSource).toBeUndefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });

  it('groups distinct fixed writes to one collection by final entry slot', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function f(int a, int b, int v) external {
        m[a] = m[a] - v;
        m[b] = m[b] + v;
        require(true);
      }
    }`, { forceStateful: true });
    const fn = artifact.abi.find((f) => f.name === 'f');
    expect(fn?.sortedBatchInfo).toEqual([{ collection: 'm', slotIndices: [0, 1], linear: true }]);
  });

  // A single fixed upsert IS batched now, deliberately. The old `> 1` gate left a lone vmap insert - ERC20Mock's
  // constructor `_balances[msg.sender] = supply` - on the scalar path, which carries no batch witnesses and
  // fails constructor derivation with OP_EQUALVERIFY against an empty key. The batch path is the shape mint and
  // transfer already use successfully, so constructors take it too. See SymbolTableTraversal.
  it('marks a single fixed upsert as a batch, so a lone vmap insert can derive', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function f(int k, int v) external { m[k] = v; require(true); }
    }`, { forceStateful: true });
    expect(artifact.abi.find((f) => f.name === 'f')?.sortedBatchInfo)
      .toEqual([{ collection: 'm', slotIndices: [0] }]);
    expect(artifact.abi.find((f) => f.name === 'f')?.entryAccesses?.[0]?.valueSource).toBe('id:v');
  });

  it('publishes exact literal and parameter-delta mapping values for faithful first probes', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function seed(int k) external { m[k] = 5; require(true); }
      function move(int a, int b, int v) external {
        m[a] = m[a] - v; m[b] = m[b] + v; require(true);
      }
    }`, { forceStateful: true });
    expect(artifact.abi.find((f) => f.name === 'seed')?.entryAccesses?.[0]?.valueSource).toBe('lit:5');
    expect(artifact.abi.find((f) => f.name === 'move')?.entryAccesses
      ?.map((access) => access.valueSource).sort())
      .toEqual(['binop:+(entry,id:v)', 'binop:-(entry,id:v)']);
  });

  it('records whole-value byte-sequence literals so the SDK can pin the first probe', () => {
    const artifact = compileString(`contract C {
      mapping(string => string) labels;
      mapping(int => bytes) payloads;
      function seed() external {
        labels["short"] = "expanded";
        payloads[0] = hex"c0ffee";
        require(true);
      }
    }`, { forceStateful: true });
    const accesses = artifact.abi.find((f) => f.name === 'seed')?.entryAccesses;
    expect(accesses?.find((access) => access.collection === 'labels')?.valueSource).toBe('lit:expanded');
    expect(accesses?.find((access) => access.collection === 'payloads')?.valueSource).toBe('lit:0xc0ffee');
  });

  it('publishes a struct constructor value without contract-specific field knowledge', () => {
    const artifact = compileString(`contract C {
      struct S { uint256 a; uint256 b; uint256 c; uint256 d; }
      mapping(uint256 => S) m;
      function seed(uint256 k, uint256 a, uint256 b, uint256 c, uint256 d) external {
        m[k] = S(a, b, c, d); require(true);
      }
    }`, { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'seed')?.entryAccesses?.[0]?.valueSource)
      .toBe('call:S(id:a,id:b,id:c,id:d)');
  });

  it('records a coalesced partial struct-field write as a constructor with preserved fields', () => {
    const artifact = compileString(`contract C {
      struct S { uint256 a; uint256 b; uint256 c; uint256 d; }
      mapping(uint256 => S) m;
      function updTwo(uint256 k, uint256 x, uint256 y) external {
        m[k].a = x; m[k].b = y; require(true);
      }
    }`, { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'updTwo')?.entryAccesses?.[0]?.valueSource)
      .toBe('call:S(id:x,id:y,field:c(map:m(id:k)),field:d(map:m(id:k)))');
  });

  it('folds sequential coalesced struct-field writes into a net constructor valueSource', () => {
    const artifact = compileString(`contract C {
      struct S { int x; int y; }
      mapping(int => S) m;
      function litThenRmw(int k) external { m[k].x = 5; m[k].x = m[k].x + 1; require(true); }
      function fromParam(int k, int a) external { m[k].x = a; m[k].y = m[k].x + 1; require(true); }
      function plusTwice(int k) external { m[k].x += 1; m[k].x += 1; require(true); }
      function plusOnce(int k) external { m[k].x = m[k].x + 1; require(true); }
    }`, { forceStateful: true });
    // The coalescer preserves the sequential expression tree. Runtime semantics are 6 and old+2 respectively;
    // valueSource need not constant-fold or reassociate those operations to describe them exactly.
    expect(artifact.abi.find((fn) => fn.name === 'litThenRmw')?.entryAccesses?.[0]?.valueSource)
      .toBe('call:S(binop:+(lit:5,lit:1),field:y(map:m(id:k)))');
    expect(artifact.abi.find((fn) => fn.name === 'fromParam')?.entryAccesses?.[0]?.valueSource)
      .toBe('call:S(id:a,binop:+(id:a,lit:1))');
    expect(artifact.abi.find((fn) => fn.name === 'plusTwice')?.entryAccesses?.[0]?.valueSource)
      .toBe('call:S(binop:+(binop:+(field:x(map:m(id:k)),lit:1),lit:1),field:y(map:m(id:k)))');
    expect(artifact.abi.find((fn) => fn.name === 'plusOnce')?.entryAccesses?.[0]?.valueSource)
      .toBe('call:S(binop:+(field:x(map:m(id:k)),lit:1),field:y(map:m(id:k)))');
  });

  it('coalesces dependent field writes keyed by a stable transaction intrinsic', () => {
    const failures: unknown[] = [];
    const artifact = compileString(`contract NeutralStore() {
      struct Pair { int left; int right; }
      mapping(address => Pair) records;
      function revise(int delta) public {
        this.records[msg.sender].left = this.records[msg.sender].left + delta;
        this.records[msg.sender].right = this.records[msg.sender].left + 1;
        require(true);
      }
    }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      __artifactCache: false, __attemptFailureBox: { failures }, __strictNoInternalRecovery: true,
    });
    expect(failures).toEqual([]);
    const revise = artifact.abi.find((fn) => fn.name === 'revise');
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'revise'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [0] });
    expect(revise?.entryAccesses).toHaveLength(1);
    expect(revise?.entryAccesses?.[0]?.valueSource).toContain('call:Pair(');
    expect(revise?.entryAccesses?.[0]?.valueSource).toContain('binop:+(');
  });

  it('records a mapping fixed-array element write as arrset valueSource', () => {
    const artifact = compileString(`contract C {
      mapping(bytes20 => bigint[3]) scores;
      function setOneScore(bytes20 user, bigint index, bigint newValue) external {
        this.scores[user][index] = newValue; require(true);
      }
    }`, { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'setOneScore')?.entryAccesses?.[0]?.valueSource)
      .toBe('arrset(id:index,id:newValue)');
  });

  it('records a follow-on literal multiply as a composed valueSource', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function f(int k) external { m[k] = 3; m[k] = m[k] * 2; require(true); }
    }`, { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'f')?.entryAccesses?.[0]?.valueSource)
      .toBe('binop:*(lit:3,lit:2)');
  });

  it('records a same-key literal copied onto a second key', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function f(int a, int b) external { m[a] = 5; m[b] = m[a]; require(true); }
    }`, { forceStateful: true });
    const sources = artifact.abi.find((fn) => fn.name === 'f')?.entryAccesses
      ?.map((access) => access.valueSource);
    expect(sources).toContain('lit:5');
  });

  it('records a single mapping read-modify-write of a literal delta as valueSource', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function bump(int k) external { m[k] = m[k] + 1; require(true); }
      function twice(int k) external { m[k] = m[k] + 1; m[k] = m[k] + 1; require(true); }
    }`, { forceStateful: true });
    expect(artifact.abi.find((f) => f.name === 'bump')?.entryAccesses?.[0]?.valueSource)
      .toBe('binop:+(entry,lit:1)');
    expect(artifact.abi.find((f) => f.name === 'twice')?.entryAccesses?.[0]?.valueSource)
      .toBe('binop:+(entry,lit:2)');
  });

  it('records unrolled fixed-array element writes as integer valueSource', () => {
    const artifact = compileString(`contract C {
      int[3] a;
      function f() external { for (int i = 0; i < 3; i++) { a[i] = i + 1; } require(true); }
    }`, { forceStateful: true });
    const sources = artifact.abi.find((fn) => fn.name === 'f')?.entryAccesses
      ?.map((access) => access.valueSource).sort();
    expect(sources).toEqual(['binop:+(lit:0,lit:1)', 'binop:+(lit:1,lit:1)', 'binop:+(lit:2,lit:1)']);
  });

  it('records a 0..n-1 invariant-key loop flush as loopLast valueSource', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function f(int k, int n) external { for (int i = 0; i < n; i++) { m[k] = i; } require(true); }
    }`, { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'f')?.entryAccesses?.[0]?.valueSource)
      .toBe('loopLast:id:n');
  });

  it('records an if-converted mapping write as a ternary valueSource', () => {
    const artifact = compileString(`contract C {
      mapping(uint256 => uint256) m;
      function setIf(uint256 k, uint256 v, bool d) external { if (d) { m[k] = v; } require(true); }
    }`, { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'setIf')?.entryAccesses?.[0]?.valueSource)
      .toBe('ternary(id:d,id:v,map:m(id:k))');
  });

  it('records a mapping rmw of a parameter delta as valueSource', () => {
    const artifact = compileString(`contract C {
      mapping(int => int) m;
      function f(int a, int b, int v) external { m[a] = m[a] - v; m[b] = m[b] + v; require(true); }
    }`, { forceStateful: true });
    const sources = artifact.abi.find((fn) => fn.name === 'f')?.entryAccesses
      ?.map((access) => access.valueSource).sort();
    expect(sources).toEqual(['binop:+(entry,id:v)', 'binop:-(entry,id:v)']);
  });

  it('records unrolled array-element writes as arridx valueSource', () => {
    const artifact = compileString(`contract C() {
      mapping(int => int) bal;
      function setAll(int[2] ks, int[2] vs) {
        for (int i = 0; i < 2; i = i + 1) { bal[ks[i]] = vs[i]; }
      }
    }`, { forceStateful: true });
    const sources = artifact.abi.find((f) => f.name === 'setAll')?.entryAccesses
      ?.map((access) => access.valueSource).sort();
    expect(sources).toEqual(['arridx(id:vs,lit:0)', 'arridx(id:vs,lit:1)']);
  });

  it('does not mislabel a constructed chunkable value as its first element parameter', () => {
    const artifact = compileString(`contract C {
      mapping(int => bytes32[]) m;
      function set(int k, bytes32 a, bytes32 b) external {
        m[k] = [a, b];
        require(true);
      }
      function direct(int k, bytes32[] value) external {
        m[k] = value;
        require(true);
      }
    }`, { forceStateful: true });
    expect(artifact.abi.find((f) => f.name === 'set')?.entryAccesses?.[0]?.valueParam).toBeUndefined();
    expect(artifact.abi.find((f) => f.name === 'direct')?.entryAccesses?.[0]?.valueParam).toBe('value');
  });

  it('keeps a delegate write scalar because its collection topology belongs to the proxy', () => {
    const artifact = compileString(`library L {
      mapping(int => int) m;
      function f(int k, int v) public { m[k] = v; }
    }`, { forceStateful: true });
    const fn = artifact.abi.find((entry) => entry.name === 'f');
    expect(fn?.modifiers).toContain('delegate');
    expect(fn?.entryAccesses).toHaveLength(1);
    expect(fn?.sortedBatchInfo).toBeUndefined();
  });

  it('batches multiple delegate writes that would otherwise reuse one predecessor', () => {
    const artifact = compileString(`library L {
      mapping(string => string) m;
      function initialize() public {
        m["a"] = "A";
        m["b"] = "B";
      }
    }`, { forceStateful: true });
    const fn = artifact.abi.find((entry) => entry.name === 'initialize');
    expect(fn?.modifiers).toContain('delegate');
    expect(fn?.sortedBatchInfo).toEqual([{ collection: 'm', slotIndices: [0, 1], linear: true }]);
  });

  it('marks only a computed write followed by an actual delete as an alias candidate', () => {
    const artifact = compileString(`contract C {
      address[] keys;
      mapping(address => int) m;
      function remove(address key) external {
        address lastKey = keys[keys.length - 1];
        m[lastKey] = m[key];
        delete m[key];
        require(true);
      }
    }`, { forceStateful: true, chunkedArrays: true });
    const accesses = artifact.abi.find((f) => f.name === 'remove')?.entryAccesses ?? [];
    expect(accesses.find((a) => a.keySources?.some((s) => s.kind === 'stateArrayLast'))?.aliasCondDeleteSlot)
      .toBe(accesses.findIndex((a) => a.keyParams.includes('key')));
  });

  it('does not mark an ordinary state-array-last write plus read as an alias candidate', () => {
    const artifact = compileString(`contract C {
      address[] keys;
      mapping(address => int) m;
      function update(address key, int value) external {
        address lastKey = keys[keys.length - 1];
        int old = m[key];
        m[lastKey] = value + old;
        require(true);
      }
    }`, { forceStateful: true, chunkedArrays: true });
    const accesses = artifact.abi.find((f) => f.name === 'update')?.entryAccesses ?? [];
    // `[].every(...)` is `true`, and the reader defaults to `[]`, so without this the guard would pass on an
    // artifact that published no entry accesses at all. Measured at this commit: 2.
    expect(accesses, 'no entry accesses published, so the alias check below has no subject').toHaveLength(2);
    expect(accesses.every((a) => a.aliasCondDeleteSlot === undefined)).toBe(true);
  });
});
