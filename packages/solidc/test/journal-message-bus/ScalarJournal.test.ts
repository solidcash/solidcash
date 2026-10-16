import { hexToBin } from '@bitauth/libauth';
import { bytecodeToAsm } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { compileString as compileMessageBusString } from '../../src/compiler.js';

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
    expect(journalized.debug.bytecode.length / 2).toBeLessThan(1_300);
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

  it('keeps a returning event writer on the same authenticated collection route', () => {
    const artifact = compileMessageBusString(`pragma solidcash >=0.8.0;
      contract Token {
        mapping(address => uint) balances;
        mapping(address => mapping(address => uint)) allowances;
        event Approval(address indexed owner, address indexed spender, uint value);
        function balanceOf(address who) public view returns (uint) { return balances[who]; }
        function approve(address spender, uint value) public returns (bool) {
          address owner = msg.sender;
          allowances[owner][spender] = value;
          emit Approval(owner, spender, value);
          return true;
        }
      }
    `, { forceStateful: true, messageBus: true, maximumInputBytes: 10_000_000 });

    expect(artifact.messageBus?.handlers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'balanceOf', eligible: true, outputs: [{ type: 'uint256' }] }),
      expect.objectContaining({
        name: 'approve',
        eligible: true,
        physicalEntrySlots: [0],
        outputs: [{ type: 'bool' }],
        // A top-level kernel emit settles on the handler's runtime stream, not in an event window.
        runtimeLoopEvents: [expect.objectContaining({
          eventSignatures: ['Approval(address,address,uint256)'], stream: true,
        })],
      }),
    ]));
    expect(artifact.invocationAnalysis?.functions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'approve',
        effects: ['events'],
      }),
      expect.objectContaining({
        name: '__message_bus1',
        reads: ['collection:allowances:*', 'collection:balances:*'],
        writes: ['collection:allowances:*'],
        effects: ['events'],
      }),
    ]));
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

  it('inlines _checkInitializing into a delegate initialize after late IRSH on the message-bus path', () => {
    // MarketplaceData.initialize is inferred `delegate` and compiled with messageBus. A later IRSH
    // reduces `_isInitializing()` into `_checkInitializing`; without a follow-up void-helper inline
    // the check stays an OP_INVOKE body that reads INPUTINDEX+1 (impl data / entry pad) instead of
    // the proxy pending write.
    const artifact = compileMessageBusString(`pragma solidity ^0.8.0;
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
        function _checkInitializing() internal view {
          require(_isInitializing());
        }
        function _isInitializing() private view returns (bool) {
          return _initializing;
        }
      }
      contract FlagReader is Initializable {
        address public marketplace;
        function initialize(address marketplace_) public initializer {
          _checkInitializing();
          marketplace = marketplace_;
        }
      }
    `, {
      forceStateful: true, evmCompat: true, messageBus: true, maximumInputBytes: 10_000_000,
    });
    const init = artifact.abi.find((entry) => entry.name === 'initialize');
    expect(init?.modifiers).toEqual(expect.arrayContaining(['delegate']));
    const helpers = Object.values(artifact.debug.invokeDebug ?? {});
    expect(helpers.some((helper) => helper.name === '_checkInitializing')).toBe(false);
  });

  it('keeps the public result/effect route when compilation-speed optimization skips external admission', () => {
    const source = `pragma solidcash >=0.8.0;
      contract Token {
        mapping(address => uint) balances;
        mapping(address => mapping(address => uint)) allowances;
        event Approval(address indexed owner, address indexed spender, uint value);
        function balanceOf(address who) public view returns (uint) { return balances[who]; }
        function approve(address spender, uint value) public returns (bool) {
          address owner = msg.sender;
          allowances[owner][spender] = value;
          emit Approval(owner, spender, value);
          return true;
        }
      }
    `;
    const normal = compileMessageBusString(source, {
      forceStateful: true, messageBus: true, maximumInputBytes: 10_000_000,
    });
    const fast = compileMessageBusString(source, {
      forceStateful: true,
      messageBus: true,
      maximumInputBytes: 10_000_000,
      optimizeForCompilationSpeed: true,
    });
    const eligible = (artifact: typeof normal): string[] => artifact.messageBus?.handlers
      .filter((handler) => handler.eligible).map((handler) => handler.name) ?? [];
    expect(eligible(fast)).toEqual(eligible(normal));
    expect(eligible(fast)).toEqual(['balanceOf', 'approve']);
    // Both compilation profiles reserve the kernel's complete envelope-derived row band.
    expect(normal.messageBus?.maximumRows).toBe(255);
    expect(fast.messageBus?.maximumRows).toBe(255);
  });

  it('composes independent cross-row aliases for an ERC-20 approve and transferFrom route', () => {
    const artifact = compileMessageBusString(`pragma solidity ^0.8.0;
      contract Token {
        mapping(address => uint) balances;
        mapping(address => mapping(address => uint)) allowances;
        event Approval(address indexed owner, address indexed spender, uint value);
        function approve(address spender, uint value) public returns (bool) {
          allowances[msg.sender][spender] = value;
          emit Approval(msg.sender, spender, value);
          return true;
        }
        function transferFrom(address from, address to, uint value) public returns (bool) {
          uint allowed = allowances[from][msg.sender];
          require(allowed >= value);
          allowances[from][msg.sender] = allowed - value;
          balances[from] = balances[from] - value;
          balances[to] = balances[to] + value;
          return true;
        }
      }
    `, {
      forceStateful: true,
      evmCompat: true,
      messageBus: true,
      maximumInputBytes: 10_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });

    expect(artifact.messageBus?.maximumRows).toBe(255);
    expect(artifact.messageBus?.handlers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'approve', eligible: true, physicalEntrySlots: [0] }),
      expect.objectContaining({
        name: 'transferFrom', eligible: true,
        physicalEntrySlots: [3, 2, 0],
        physicalEntrySlotAlternatives: [[3, 4, 5, 6, 7, 8, 9, 10], [2], [0, 1]],
      }),
    ]));
    // The allowance's alternate lane precedes both balance lanes. The destination balance additionally owns
    // the eight-row key pool; every published physical slot must name an actual co-spent entry in that order.
    expect(artifact.messageBus?.route.entryAccesses?.map(({ slotIndex, collection }) => [slotIndex, collection]))
      .toEqual([
        [0, 'allowances'], [1, 'allowances'],
        ...Array.from({ length: 9 }, (_, index) => [index + 2, 'balances']),
      ]);
    expect(artifact.messageBus?.route.entryAccesses?.map((access) => access.collection))
      .toEqual(expect.arrayContaining(['allowances', 'balances']));
    // Runtime cache selection must stay linear in independently aliasable entries. Expanding every alias choice
    // into a Cartesian dispatcher produced tens of megabytes for the corresponding production ERC-20 route.
    expect(artifact.debug.bytecode.length).toBeLessThan(2_000_000);
  }, 120_000);
});
