import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';

const PREFIX = 'pragma solidcash >=0.8.0; contract C() { int x;';
const HELPER_BODY = 'this.x = ((this.x + n) * 3 - n) / 2;';

describe('Release 1 scalar journal lowering', () => {
  it('marks a physical wrapper with only transitive scalar writes as state-writing', () => {
    const artifact = compileString(`${PREFIX}
      function add(int n) internal { this.x = this.x + n; }
      function run(int a, int b) { add(a); add(b); require(a >= 0); }
    }`, { forceStateful: true });

    const run = artifact.abi.find((entry) => entry.name === 'run');
    expect(run?.writesState).toBe(true);
    expect(run?.requiredNftIndices).toEqual([0]);
  });

  it('stores a multi-site scalar helper once and invokes it at every site', () => {
    const journalized = compileString(`${PREFIX}
      function update(int n) internal { ${HELPER_BODY} }
      function run(int a, int b, int c) {
        update(a); update(b); update(c); require(a >= 0);
      }
    }`, { forceStateful: true });

    // `update` is the first declared function, so it holds function id 0 - which pushes as OP_0. One stored
    // body, one OP_INVOKE per call site, is the whole point of lowering a multi-site scalar write to a helper.
    const asm = bytecodeToAsm(hexToBin(journalized.debug.bytecode));
    expect([...asm.matchAll(/OP_0 OP_INVOKE/g)]).toHaveLength(3);

    // This used to be pinned as "smaller than writing the body out three times". That comparison stopped
    // discriminating once the contract-level script itself was outlined: the hand-duplicated variant now has
    // its repeated span shared too, and compiles SMALLER than the journalized one (482 vs 554 bytes) without
    // either shape having regressed - both shrank. A budget on the shipped shape is what still catches growth.
    // Every stateful entry now also sums its satoshi container and scans for foreign containers (about 515 B).
    // The C3 count-path record pin, which holds each own-category record at its own index, added 38 B (1289 -> 1327).
    // The data-record covenant that defines its category and authority bind once (590aca164) carries those
    // definitions in the record lock a direct master rebuilds: 15 B.
    // `genesisCalls` on by default gives this record-sound contract the genesis step and its marker: 71 B over the
    // same code with the option off (1548 -> 1619), where the marker alone had been 23 B (1571).
    expect(journalized.debug.bytecode.length / 2).toBeLessThan(1_650); // B+F1: +~217 B void-record overhead
  });

  it('marks only recursion which survives tail-cycle lowering for concrete SDK preflight', () => {
    const direct = compileString(`${PREFIX}
      function run(int n) { this.x = this.x + 1; if (n > 0) run(n - 1); require(n >= 0); }
    }`, { forceStateful: true });
    expect(direct.abi.find((entry) => entry.name === 'run')?.recursiveStateHandler).toBe(true);

    const mutual = compileString(`${PREFIX}
      function a(int n) internal { this.x = this.x + 1; if (n > 0) b(n - 1); }
      function b(int n) internal { this.x = this.x + 1; if (n > 0) a(n - 1); }
      function run(int n) { a(n); require(n >= 0); }
      function flat() { this.x = this.x + 1; require(this.x > 0); }
    }`, { forceStateful: true });
    // The homogeneous a/b tail cycle is compiled into one bounded program-counter loop before journal closure
    // analysis. It no longer consumes recursive VM frames, so advertising the conservative SDK recursion fence
    // would describe source syntax rather than the executable handler.
    expect(mutual.abi.find((entry) => entry.name === 'run')?.recursiveStateHandler).toBeUndefined();
    expect(mutual.abi.find((entry) => entry.name === 'flat')?.recursiveStateHandler).toBeUndefined();
  });

  it('keeps an external-call scalar helper on the established inline path', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ICounter { function increment(); }
      contract ExternalScalar(bytes32 target) {
        int x;
        function update() internal {
          ICounter(target).increment.call();
          this.x = this.x + 1;
        }
        function run() { update(); require(this.x > 0); }
      }
    `, { forceStateful: true });

    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'update')).toBeUndefined();
    expect(artifact.abi.find((entry) => entry.name === 'run')?.externalCalls).toHaveLength(1);
  });

  it('keeps transitive cast-form external calls on the established inline path', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      interface ICounter { function increment(); }
      contract ExternalScalar(bytes32 target) {
        int x;
        function invoke() internal { ICounter(target).increment.call(); }
        function update() internal { invoke(); this.x = this.x + 1; }
        function run() { update(); require(this.x > 0); }
      }
    `, { forceStateful: true });

    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'update')).toBeUndefined();
    expect(artifact.abi.find((entry) => entry.name === 'run')?.externalCalls).toHaveLength(1);
  });

  it('keeps a deploying scalar helper on the physical entry path', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Child { int x; constructor(int value) { x = value; } }
      contract Factory {
        int count;
        function create(int value) internal { Child child = new Child(value); this.count = this.count + 1; }
        function run(int value) { create(value); require(this.count > 0); }
      }
    `, { forceStateful: true });

    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'create')).toBeUndefined();
    expect(artifact.abi.find((entry) => entry.name === 'run')?.modifiers).toContain('deploy');
  });

  it('inlines an event-bearing returning state helper into its physical event frame', () => {
    const source = `pragma solidcash >=0.8.0;
      contract EventReturn() {
        int x;
        event Changed(int value);
        function update(int n) internal returns (int) {
          this.x = this.x + n;
          emit Changed(this.x);
          if (n > 0) { return this.x; }
          return 0;
        }
        function run(int n) {
          int result = update(n);
          require(result >= 0);
        }
      }
    `;
    const artifact = compileString(source, { forceStateful: true });
    expect(artifact.abi.find((entry) => entry.name === 'run')?.emits).toEqual([
      expect.objectContaining({ eventName: 'Changed' }),
    ]);
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'update')).toBeUndefined();
  });

  it('inlines a transitive returning emit helper reached from a journal handler', () => {
    // Regression for J5: the event must stay in the caller's physical frame even though the leaf helper does not
    // itself touch state and the intermediate helper owns the scalar journal.
    const source = `pragma solidcash >=0.8.0;
      contract EmitReturn() {
        int x;
        event Changed(int value);
        function log(int v) internal returns (int) {
          emit Changed(v);
          return v + 1;
        }
        function bump(int n) internal returns (int) {
          this.x = this.x + n;
          int tag = log(n);
          if (n > 0) { return tag; }
          return 0;
        }
        function run(int n) {
          int result = bump(n);
          require(result >= 0);
        }
      }
    `;
    const artifact = compileString(source, { forceStateful: true });
    expect(artifact.abi.find((entry) => entry.name === 'run')?.emits).toEqual([
      expect.objectContaining({ eventName: 'Changed' }),
    ]);
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'log')).toBeUndefined();
  });

  it('journals an outlined view helper that reads a scalar the caller just wrote', () => {
    // OZ initializer shape: the entry writes `_initializing = true`, then an outlined `onlyInitializing`
    // check reads it back. Without downward journal admission the helper re-reads the pre-transaction NFT
    // and `require(this.initializing)` fails even though the pending write is live on the caller stack.
    const artifact = compileString(`pragma solidity ^0.8.0;
      abstract contract Initializable {
        uint64 private _initialized;
        bool private _initializing;
        modifier initializer() {
          require(!_initializing && _initialized < 1);
          _initialized = 1;
          _initializing = true;
          _;
          _initializing = false;
        }
        modifier onlyInitializing() {
          _checkInitializing();
          _;
        }
        function _checkInitializing() internal view {
          require(_isInitializing());
        }
        function _isInitializing() private view returns (bool) {
          return _initializing;
        }
      }
      contract FlagReader is Initializable {
        address public marketplace;
        mapping(string => string) public meceTags;
        function initialize(address marketplace_) public initializer {
          _checkInitializing();
          marketplace = marketplace_;
          meceTags["DA"] = "DIGITAL_AUDIO";
        }
      }
    `, { forceStateful: true, evmCompat: true });

    const helpers = artifact.invocationAnalysis?.functions ?? [];
    const checkInit = helpers.find((fn) => fn.name === '_checkInitializing' || fn.name === '_isInitializing');
    // A small fixture often inlines the helper into initialize (same stack frame as the pending write).
    // When the helper remains an OP_INVOKE body - MarketplaceData.initialize's actual shape - it must
    // receive the pending _initializing write as journal context instead of rereading the input NFT.
    if (checkInit) {
      expect(checkInit.arity).toBeGreaterThan(0);
    } else {
      expect(artifact.abi.find((entry) => entry.name === 'initialize')?.writesState).toBe(true);
    }
  });
});
