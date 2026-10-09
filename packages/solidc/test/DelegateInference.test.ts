import { describe, it, expect, vi } from 'vitest';
import { formatArtifact } from '@solidcash/utils';
import {
  decodeAuthenticationInstructions, hexToBin, OpcodesBCH, vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileString } from '../src/index.js';

// Compiler-side rules for inferring the proxy-implementation (delegate) build. Source never writes `delegate`;
// the SDK-facing behaviour is covered in solidcash/test/e2e/DelegateInferred.test.ts.
// See docs/delegatecall.md and docs/delegate-modifier-drop-evaluation.md.

const markedNames = (src: string): string[] => {
  // This suite classifies delegate eligibility, including intentionally hostile low-level targets. Production
  // compilation rejects those by default; opt out here so the inference-specific assertions remain isolated.
  const variant = compileString(src, { allowUnsafeOperations: true }).delegateArtifact;
  if (!variant) return [];
  return variant.abi.filter((f) => f.modifiers?.includes('delegate')).map((f) => f.name);
};

describe('delegate inference', () => {
  it('infers proxy state writes from bare Solidity assignments without promoting shadowed locals', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        uint256 value;
        function setValue(uint256 next) public { value = next; require(true); }
        function helper(uint256 next) internal { value = next; }
        function setThroughHelper(uint256 next) public { helper(next); require(true); }
        function localOnly() public {
          uint256 value = 0;
          value = 1;
          require(value == 1);
        }
      }`, { evmCompat: true, forceStateful: true, messageBus: true });
    const delegated = artifact.delegateArtifact?.abi
      .filter((fn) => fn.modifiers?.includes('delegate')).map((fn) => fn.name);
    expect(delegated).toEqual(['setValue', 'setThroughHelper']);
  });

  it('marks a state-writing entry point', () => {
    expect(markedNames(`contract C() {
      bigint counter;
      function f() public { this.counter = this.counter + 1; }
    }`)).toEqual(['f']);
  });

  it('sees a state write that is only reachable through an internal helper', () => {
    expect(markedNames(`contract C() {
      bigint counter;
      function helper(bigint x) internal { this.counter = x; }
      function f(bigint x) public { helper(x); }
    }`)).toEqual(['f']);
  });

  it('carries msg.sender through a modifier helper closure in the delegate entry point', () => {
    const artifact = compileString(`contract Governed {
      address _owner;
      bigint counter;
      mapping(string => string) tags;
      function sender() internal view returns (address) { return msg.sender; }
      function checkOwner() internal view { require(sender() == _owner); }
      modifier onlyOwner() { checkOwner(); _; }
      function update(string key, string value) public onlyOwner { tags[key] = value; }
      function touch() public { this.counter = this.counter + 1; }
    }`);
    expect(artifact.delegateArtifact).toBeDefined();
    expect(artifact.delegateArtifact?.abi.find((fn) => fn.name === 'update')).toBeDefined();
    expect(artifact.delegateArtifact?.abi.find((fn) => fn.name === 'touch')?.modifiers).toContain('delegate');
  });

  it('excludes a transfer reached through a helper chain', () => {
    expect(markedNames(`contract C() {
      bigint counter;
      function inner(address r) internal { payable(r).transfer(1000); }
      function outer(address r) internal { inner(r); }
      function f(address r) public { this.counter = this.counter + 1; outer(r); }
    }`)).toEqual([]);
  });

  it('excludes a function that issues a delegatecall itself', () => {
    // delegate + delegatecall skips every state covenant and emitDelegateSelfPreservation.
    expect(markedNames(`contract C() {
      event E(int v);
      bigint counter;
      function f(address t) public { emit E(1); t.delegatecall(0x1234); }
    }`)).toEqual([]);
  });

  it('terminates on mutually recursive helpers', () => {
    expect(markedNames(`contract C() {
      bigint counter;
      function ping(bigint x) internal returns (bigint) { if (x > 0) { return this.pong(x - 1); } return 0; }
      function pong(bigint x) internal returns (bigint) { if (x > 0) { return this.ping(x - 1); } return 1; }
      function f(bigint x) public { this.counter = this.ping(x); }
    }`)).toEqual(['f']);
  });

  it('emits no variant for a contract that cannot be an implementation', () => {
    expect(compileString(`contract R() {
      bigint v;
      function get() public view returns (bigint) { return this.v; }
    }`).delegateArtifact).toBeUndefined();
  });

  it('retains the legacy source-level delegate modifier during migration', () => {
    expect(() => compileString(`contract C() {
      bigint counter;
      function f() delegate { this.counter = this.counter + 1; }
    }`)).not.toThrow();
  });

  it('never fails a valid standalone compile, and reports why the variant was skipped', () => {
    // The variant compile is best-effort. Whatever happens, the standalone artifact must still be produced -
    // and if the variant is dropped for an unexpected reason, that reason must not vanish silently.
    const logged: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { logged.push(a.join(' ')); });
    try {
      const artifact = compileString(`contract C() {
        bigint counter;
        function f() public { this.counter = this.counter + 1; }
      }`);
      expect(artifact.bytecode).toBeTruthy();
      expect(logged.filter((l) => l.includes('could not build the delegate'))).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });

  // The variant is a second full compile, and most contracts are never used behind a proxy, so it is built on
  // first read rather than on every compile. Emitted artifacts must still carry it: serialization reads the
  // property like any other, which is what these two assertions pin down.
  it('survives serialization, so written artifacts carry the variant', () => {
    const src = `contract C() {
      bigint counter;
      function f() public { this.counter = this.counter + 1; }
    }`;
    const roundTripped = JSON.parse(JSON.stringify(compileString(src)));
    expect(roundTripped.delegateArtifact).toBeDefined();
    expect(roundTripped.delegateArtifact.abi.find((f: { name: string }) => f.name === 'f').modifiers)
      .toContain('delegate');

    expect(formatArtifact(compileString(src), 'json')).toContain('delegateArtifact');
    expect(formatArtifact(compileString(src), 'ts')).toContain('delegateArtifact');
  });

  it('reads back the same variant every time', () => {
    const artifact = compileString(`contract C() {
      bigint counter;
      function f() public { this.counter = this.counter + 1; }
    }`);
    expect(artifact.delegateArtifact).toBe(artifact.delegateArtifact);
  });

  it('keeps the nested artifact complete, including source', () => {
    const artifact = compileString(`contract C() {
      bigint counter;
      function f() public { this.counter = this.counter + 1; }
    }`);
    expect(artifact.source).toContain('contract C()');
    expect(artifact.delegateArtifact!.source).toBe(artifact.source);
  });

  it('settles explicitly requested dynamic storage inside the delegate message-bus route', () => {
    const artifact = compileString(`contract C() {
      address[] members;
      address[] admins;
      mapping(address => int) scores;
      function register(address member) public {
        scores[member] = 1;
        members.push(member);
      }
      function addAdmin(address admin) public { admins.push(admin); }
      function memberCount() public view returns (uint) {
        return members.length;
      }
      function registered(address member) public view returns (bool) {
        return scores[member] > 0;
      }
    }`, { messageBus: true });
    const route = artifact.delegateArtifact?.messageBus?.route;
    expect(route).toBeDefined();
    expect(route?.dynamicReads).toContain('members');
    expect(route?.dynamicWrites).toContain('members');
    expect(route?.dynamicWrites).toContain('admins');
    expect(artifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'register')?.eligible)
      .toBe(true);
    expect(artifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'memberCount')?.eligible)
      .toBe(true);
    expect(artifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'addAdmin')?.eligible)
      .toBe(true);
    expect(artifact.delegateArtifact?.messageBus?.handlers.find((handler) => handler.name === 'registered')?.eligible)
      .toBe(true);
  });

  it('bases routed recovery sidecars on the authenticated participant owner, not the delegate executor', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      // The initializer marks the Solidity-compatible public surface as a proxy implementation. The outgoing
      // edge forces a compiler-owned graph handler. Recovery is deliberately outlined into a file-level helper:
      // that helper is shared by the ordinary entry and the route, whose compute-block bases differ.
      const artifact = compileString(`pragma solidity ^0.8.20;
        interface Sink { function ping(address who) external; }
        function recoverForRoute(bytes32 h, uint8 v, bytes32 r, bytes32 s) returns (address) {
          return ecrecover(h, v, r, s);
        }
        contract RoutedRecovery {
          address public last;
          address public sink;
          modifier initializer() { _; }
          function initialize(address value) public initializer { sink = value; }
          function apply(bytes32 h, uint8 v, bytes32 r, bytes32 s) public {
            bytes32 digest = keccak256(abi.encode(h, v));
            address who = recoverForRoute(digest, v, r, s);
            last = who;
            Sink(sink).ping(who);
          }
        }
      `, { messageBus: true, evmCompat: true });

      expect(artifact.messageBus?.route?.modifiers).toContain('delegate');
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply')?.keccakPreimageParams)
        .toEqual([null]);
      // File-level helpers are code-generated OP_INVOKE bodies, but intentionally are not contract invocation
      // summaries. Inspect the stable debug record emitted for the actual outlined body.
      const helper = Object.values(artifact.debug?.invokeDebug ?? {})
        .find((candidate) => candidate.name === 'recoverForRoute');
      expect(helper).toBeDefined();
      const body = helper?.bytecode;
      expect(body).toBeTypeOf('string');
      const opcodes = decodeAuthenticationInstructions(hexToBin(body!)).map((instruction) => instruction.opcode);
      expect(opcodes).toContain(OpcodesBCH.OP_INPUTBYTECODE);
      // OP_INPUTINDEX would make this shared helper read executor+slot. Its caller threads the authenticated
      // compute-block base through the helper frame instead.
      expect(opcodes).not.toContain(OpcodesBCH.OP_INPUTINDEX);

      const helperEntry = Object.entries(artifact.debug?.invokeDebug ?? {})
        .find(([, candidate]) => candidate.name === 'recoverForRoute');
      expect(helperEntry).toBeDefined();
      const helperId = BigInt(helperEntry![0]);
      const readNumber = (instruction: { opcode: number; data?: Uint8Array }): bigint | undefined => {
        if (instruction.opcode === OpcodesBCH.OP_0) return 0n;
        if (instruction.opcode === OpcodesBCH.OP_1NEGATE) return -1n;
        if (instruction.opcode >= OpcodesBCH.OP_1 && instruction.opcode <= OpcodesBCH.OP_16) {
          return BigInt(instruction.opcode - OpcodesBCH.OP_1 + 1);
        }
        if (!instruction.data) return undefined;
        const decoded = vmNumberToBigInt(instruction.data, { requireMinimalEncoding: false });
        return typeof decoded === 'bigint' ? decoded : undefined;
      };
      const findHelperInvoke = (bytecode: string): {
        index: number; instructions: ReturnType<typeof decodeAuthenticationInstructions>;
      } => {
        const instructions = decodeAuthenticationInstructions(hexToBin(bytecode));
        const index = instructions.findIndex((instruction, i) => i > 0
          && instruction.opcode === OpcodesBCH.OP_INVOKE
          && readNumber(instructions[i - 1]) === helperId);
        expect(index).toBeGreaterThan(0);
        return { index, instructions };
      };

      // The route handler copies four declared arguments and forwards two authenticated hidden coordinates.
      // This checks the call edge as well as the helper body: widening only the callee frame leaves its
      // parameters shifted even though the helper itself contains no OP_INPUTINDEX.
      const routedHandler = Object.values(artifact.debug?.invokeDebug ?? {})
        .find((candidate) => candidate.name === '__message_bus_handler_apply');
      expect(routedHandler).toBeDefined();
      const routedCall = findHelperInvoke(routedHandler!.bytecode);
      let routedCursor = routedCall.index - 2;
      for (let argument = 0; argument < 4; argument += 1) {
        expect(routedCall.instructions[routedCursor].opcode).toBe(OpcodesBCH.OP_ROLL);
        expect(readNumber(routedCall.instructions[routedCursor - 1])).toBeDefined();
        routedCursor -= 2;
      }
      // The outlined helper receives both the row-selected recovery A coordinate and the authenticated
      // compute-block base. Each is copied from the route's hidden frame before the four source arguments.
      expect(routedCall.instructions[routedCursor].opcode).toBe(OpcodesBCH.OP_PICK);
      expect(readNumber(routedCall.instructions[routedCursor - 1])).toBeDefined();
      expect(routedCall.instructions[routedCursor - 2].opcode).toBe(OpcodesBCH.OP_PICK);
      expect(readNumber(routedCall.instructions[routedCursor - 3])).toBeDefined();

      // The independently compiled ABI entry invokes the same widened helper, but derives recovery A from its
      // own compute base. Both hidden coordinates must survive the entry-point sub-traversal's outlined-call ABI.
      const applySelector = artifact.abi.find((entry) => entry.name === 'apply')?.selector;
      expect(applySelector).toBeDefined();
      const directCall = findHelperInvoke(artifact.functionBodies?.[applySelector!]!);
      let directCursor = directCall.index - 2;
      for (let argument = 0; argument < 4; argument += 1) {
        expect(directCall.instructions[directCursor].opcode).toBe(OpcodesBCH.OP_ROLL);
        expect(readNumber(directCall.instructions[directCursor - 1])).toBeDefined();
        directCursor -= 2;
      }
      expect(directCall.instructions[directCursor].opcode).toBe(OpcodesBCH.OP_INVOKE);
      expect(readNumber(directCall.instructions[directCursor - 1])).toBeDefined();
      expect(directCall.instructions[directCursor - 2].opcode).toBe(OpcodesBCH.OP_ADD);
      expect(readNumber(directCall.instructions[directCursor - 3])).toBeDefined();
      expect(directCall.instructions[directCursor - 4].opcode).toBe(OpcodesBCH.OP_INVOKE);
    } finally {
      warn.mockRestore();
      log.mockRestore();
    }
  });

  it('bases routed dynamic outputs on the participant block while address(this) reads the executor bytecode', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const artifact = compileString(`pragma solidity ^0.8.20;
        interface Sink { function ping(address who) external returns (uint); }
        contract RoutedDynamic {
          bytes public payload;
          mapping(address => uint) public notes;
          address public sink;
          modifier initializer() { _; }
          function initialize(address value) public initializer { sink = value; }
          function apply(bytes memory value) public {
            uint prior = payload.length;
            uint pong = Sink(sink).ping(address(this));
            payload = value;
            notes[msg.sender] = prior;
            require(pong >= prior);
          }
        }
      `, { messageBus: true, evmCompat: true, maximumInputBytes: 100_000 });

      expect(artifact.messageBus?.route?.modifiers).toContain('delegate');
      // Compact direct delegates and generated route handlers share one explicit transaction coordinate for the
      // first chunk-backed input. The route forwards it by name across the OP_INVOKE boundary.
      expect(artifact.messageBus?.route?.inputs.some((input) => (
        input.name === '__internal__dynamicChunkInputBase'
      ))).toBe(true);
      expect(artifact.abi.find((entry) => entry.name === 'apply')?.inputs.some((input) => (
        input.name === '__internal__dynamicChunkInputBase'
      ))).toBe(true);
      const route = decodeAuthenticationInstructions(hexToBin(
        artifact.functionBodies?.[artifact.messageBus!.route!.selector]!,
      ));
      const routedHandler = Object.values(artifact.debug?.invokeDebug ?? {})
        .find((candidate) => candidate.name?.startsWith('__message_bus_')
          && candidate.name.endsWith('_apply'));
      expect(routedHandler).toBeDefined();
      const readNumber = (instruction?: { opcode: number; data?: Uint8Array }): bigint | undefined => {
        if (instruction === undefined) return undefined;
        if (instruction.opcode === OpcodesBCH.OP_0) return 0n;
        if (instruction.opcode >= OpcodesBCH.OP_1 && instruction.opcode <= OpcodesBCH.OP_16) {
          return BigInt(instruction.opcode - OpcodesBCH.OP_1 + 1);
        }
        if (!instruction.data) return undefined;
        const decoded = vmNumberToBigInt(instruction.data, { requireMinimalEncoding: false });
        return typeof decoded === 'bigint' ? decoded : undefined;
      };
      // The route executes before its full reserved participant capacity. State reads use the authenticated proxy
      // witness from the stable ABI frame, never INPUTINDEX - blockSize (which is negative for a wide route).
      // Whole-program outlining can move this exact span behind an OP_INVOKE once the dynamic-base argument is
      // threaded into the route. Inspect the route and its compiler-published invoke bodies, not only the caller.
      const routePrograms = [route, ...Object.values(artifact.debug?.invokeDebug ?? {}).map((candidate) =>
        decodeAuthenticationInstructions(hexToBin(candidate.bytecode)))];
      expect(routePrograms.some((program) => program.some((instruction, index) =>
        instruction.opcode === OpcodesBCH.OP_DEPTH
          && readNumber(program[index + 1]) !== undefined
          && program[index + 2]?.opcode === OpcodesBCH.OP_SUB
          && program[index + 3]?.opcode === OpcodesBCH.OP_PICK
          && program[index + 4]?.opcode === OpcodesBCH.OP_UTXOTOKENCATEGORY))).toBe(true);
      const blockSize = artifact.messageBus!.route!.blockLayout!.blockSize;
      // The delegated route executor sits at the compiler-published owner-block boundary. Its entry covenant
      // binds the proxy witness to that exact offset; ordinary delegates retain their compact data-NFT distance.
      // The optimiser may fuse the preceding INPUTINDEX-producing preservation span into an invoke helper, but
      // the route must retain the exact published block-size subtraction and equality check at this boundary.
      expect(route.some((instruction, index) => readNumber(instruction) === BigInt(blockSize)
        && route[index + 1]?.opcode === OpcodesBCH.OP_SUB
        && route[index + 2]?.opcode === OpcodesBCH.OP_NUMEQUALVERIFY)).toBe(true);
      expect(route.some((instruction, index) => instruction.opcode === OpcodesBCH.OP_INPUTINDEX
        && readNumber(route[index + 1]) === BigInt(blockSize)
        && route[index + 2]?.opcode === OpcodesBCH.OP_SUB
        && route[index + 3]?.opcode === OpcodesBCH.OP_UTXOTOKENCATEGORY)).toBe(false);
      // A legacy delegate owns the transaction suffix, but a compiler route owns a balanced participant block.
      // Reject the legacy `TXOUTPUTCOUNT - 1 - ceil(size/120)` dynamic-write anchor in that routed body.
      const suffixAnchoredWrite = routePrograms.some((program) => program.some((instruction, index) =>
        instruction.opcode === OpcodesBCH.OP_TXOUTPUTCOUNT
        && program[index + 1]?.opcode === OpcodesBCH.OP_1SUB
        && program.slice(index + 2, index + 7).some((candidate, offset) =>
          candidate.opcode === OpcodesBCH.OP_PICK
          && program[index + 3 + offset]?.opcode === OpcodesBCH.OP_SIZE)));
      expect(suffixAnchoredWrite).toBe(false);
      // An explicit trailingBase retains the reserved return slot as padding even when the selected row emits no
      // return event. The compiler-owned balanced layout, rather than an inferred compact suffix, is authoritative.
      expect(artifact.messageBus!.route!.blockLayout!.trailingBase).toBeDefined();
      // address(this) remains the exact active executing input bytecode, independently of the state owner.
      expect(routePrograms.some((program) => program.some((instruction, index) =>
        instruction.opcode === OpcodesBCH.OP_INPUTINDEX
        && program[index + 1]?.opcode === OpcodesBCH.OP_UTXOBYTECODE))).toBe(true);
    } finally {
      warn.mockRestore();
      log.mockRestore();
    }
  });

  it('does not infer dynamic-state context from a shadowing source parameter', () => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract ShadowedDynamic {
        bytes public payload;
        function lengthOf(bytes memory payload) public pure returns (uint) {
          return payload.length;
        }
      }
    `, { messageBus: true, evmCompat: true, maximumInputBytes: 100_000 });
    expect(artifact.abi.find((entry) => entry.name === 'lengthOf')?.inputs.some((input) => (
      input.name === '__internal__dynamicChunkInputBase'
    ))).toBe(false);
  });

  it('tracks a live trailing index while graph handlers read dynamic lengths', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const artifact = compileString(`pragma solidity ^0.8.20;
        interface Lookup { function lookup(string key) external returns (string); }
        contract RoutedLoopWrite {
          string[] public records;
          mapping(uint => mapping(address => bool)) public allowed;
          address public lookup;
          modifier initializer() { _; }
          function initialize(address value) public initializer { lookup = value; }
          function apply(string[] memory tags, address[] memory workers) public {
            uint hits = 0;
            for (uint i = 0; i < tags.length; i++) {
              if (bytes(Lookup(lookup).lookup(tags[i])).length != 0) hits = hits + 1;
            }
            records.push(tags[0]);
            for (uint i = 0; i < workers.length; i++) allowed[hits][workers[i]] = true;
            require(hits >= 0);
          }
        }
      `, {
        messageBus: true,
        evmCompat: true,
        maximumInputBytes: 1_000_000,
        optimizeForCompilationSpeed: true,
        suppressWarnings: true,
      });
      const routedHandler = Object.values(artifact.debug?.invokeDebug ?? {})
        .find((candidate) => candidate.name === '__message_bus_entry_apply');
      expect(routedHandler).toBeDefined();
      const instructions = decodeAuthenticationInstructions(hexToBin(routedHandler!.bytecode));
      const routeInstructions = decodeAuthenticationInstructions(hexToBin(
        artifact.functionBodies?.[artifact.messageBus!.route!.selector]!,
      ));
      const readNumber = (instruction: { opcode: number; data?: Uint8Array }): bigint | undefined => {
        if (instruction.opcode === OpcodesBCH.OP_0) return 0n;
        if (instruction.opcode >= OpcodesBCH.OP_1 && instruction.opcode <= OpcodesBCH.OP_16) {
          return BigInt(instruction.opcode - OpcodesBCH.OP_1 + 1);
        }
        if (!instruction.data) return undefined;
        const decoded = vmNumberToBigInt(instruction.data, { requireMinimalEncoding: false });
        return typeof decoded === 'bigint' ? decoded : undefined;
      };
      // The runtime mapping loop and the records.push write share the handler's trailing frame. Immediately before
      // the dynamic chunk's OUTPUTBYTECODE check, the output index must add both the accumulated loop-entry width
      // and the dynamic-loop index. Without the first PICK+ADD both covenants claim trailingBase.
      expect(routeInstructions.some((instruction, index) => (
        instruction.opcode === OpcodesBCH.OP_OUTPUTBYTECODE
        && routeInstructions[index - 1]?.opcode === OpcodesBCH.OP_DUP
        && routeInstructions[index - 2]?.opcode === OpcodesBCH.OP_ADD
        && routeInstructions[index - 3]?.opcode === OpcodesBCH.OP_PICK
        && routeInstructions[index - 5]?.opcode === OpcodesBCH.OP_ADD
        && routeInstructions[index - 6]?.opcode === OpcodesBCH.OP_PICK
      ))).toBe(true);
      const routeTrailingBase = artifact.messageBus!.route.blockLayout!.trailingBase;
      expect(routeTrailingBase).toBeDefined();
      const partialThenDynamicRead = instructions.findIndex((instruction, index) => (
        instruction.opcode === OpcodesBCH.OP_PICK
        && readNumber(instructions[index + 1]) === BigInt(routeTrailingBase!)
        && instructions[index + 2]?.opcode === OpcodesBCH.OP_ADD
        && readNumber(instructions[index + 3]) !== undefined
        && instructions[index + 4]?.opcode === OpcodesBCH.OP_PICK
        && instructions[index + 5]?.opcode === OpcodesBCH.OP_1
        && instructions[index + 6]?.opcode === OpcodesBCH.OP_ADD
        && instructions[index + 7]?.opcode === OpcodesBCH.OP_UTXOTOKENCOMMITMENT
      ));
      expect(partialThenDynamicRead).toBeGreaterThanOrEqual(0);

      // Category checks in an outlined route handler must use its authenticated physical-owner argument. The
      // generic shared helper is defined in an active-input frame; invoking it here would compare an entry NFT
      // against the executing implementation category rather than the proxy/participant which owns the entry.
      const ownerBasedCategoryCheck = instructions.findIndex((instruction, index) => (
        readNumber(instruction) === 32n
        && instructions[index + 1]?.opcode === OpcodesBCH.OP_SPLIT
        && instructions[index + 2]?.opcode === OpcodesBCH.OP_DROP
        && readNumber(instructions[index + 3]) !== undefined
        && instructions[index + 4]?.opcode === OpcodesBCH.OP_PICK
        && instructions[index + 5]?.opcode === OpcodesBCH.OP_UTXOTOKENCATEGORY
        && readNumber(instructions[index + 6]) === 32n
        && instructions[index + 7]?.opcode === OpcodesBCH.OP_SPLIT
        && instructions[index + 8]?.opcode === OpcodesBCH.OP_DROP
        && instructions[index + 9]?.opcode === OpcodesBCH.OP_EQUALVERIFY
      ));
      expect(ownerBasedCategoryCheck).toBeGreaterThanOrEqual(0);

      // Runtime mapping loops settle their active rows inside the outlined graph handler. The aggregate route
      // reserves a fixed capacity slot for that handler, but an empty loop intentionally leaves it unfunded and
      // without an output. It must not append an unconditional second transition covenant for the reserved slot.
      expect(instructions.some((instruction) =>
        instruction.opcode === OpcodesBCH.OP_OUTPUTTOKENCOMMITMENT)).toBe(true);
      expect(instructions.some((instruction) =>
        instruction.opcode === OpcodesBCH.OP_OUTPUTTOKENCATEGORY)).toBe(true);
      const entryOffset = artifact.messageBus?.route?.blockLayout?.slots
        .find((slot) => slot.kind === 'entry')?.offset;
      expect(entryOffset).toBeDefined();
      const repeatsHandlerEntryTransition = routeInstructions.some((instruction, index) => (
        instruction.opcode === OpcodesBCH.OP_DEPTH
        && routeInstructions[index + 1]?.opcode === OpcodesBCH.OP_1SUB
        && routeInstructions[index + 2]?.opcode === OpcodesBCH.OP_PICK
        && readNumber(routeInstructions[index + 3]) === BigInt(entryOffset!)
        && routeInstructions[index + 4]?.opcode === OpcodesBCH.OP_ADD
        && routeInstructions[index + 5]?.opcode === OpcodesBCH.OP_OUTPUTTOKENCOMMITMENT
      ));
      expect(repeatsHandlerEntryTransition).toBe(false);
    } finally {
      warn.mockRestore();
      log.mockRestore();
    }
  });

  it('keeps participant-owner reads aligned while routed sorted upserts hold raw operands', () => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface Gate { function ok(address who) external returns (bool); }
      contract RoutedWhitelist {
        uint[] jobs;
        mapping(uint => mapping(address => bool)) allowed;
        function publish(address gate, address[] memory workers) public {
          require(Gate(gate).ok(msg.sender));
          jobs.push(0);
          uint id = jobs.length - 1;
          for (uint i = 0; i < workers.length; i++) allowed[id][workers[i]] = true;
          require(true);
        }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusGraphContext: true,
      evmCompat: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    });
    const routedHandler = Object.values(artifact.debug?.invokeDebug ?? {})
      .find((candidate) => candidate.name === '__message_bus_entry_publish');
    expect(routedHandler).toBeDefined();
    const instructions = decodeAuthenticationInstructions(hexToBin(routedHandler!.bytecode));

    // Each sorted-write covenant builds `owner + trailingBase + counter`, with the authenticated owner read
    // from the outlined entry's hidden frame. Check every emitted output-bytecode site rather than depending on
    // a fixed number of sites: the optimizer may merge identical transition checks.
    const readNumber = (instruction: { opcode: number; data?: Uint8Array }): bigint | undefined => {
      if (instruction.opcode === OpcodesBCH.OP_0) return 0n;
      if (instruction.opcode >= OpcodesBCH.OP_1 && instruction.opcode <= OpcodesBCH.OP_16) {
        return BigInt(instruction.opcode - OpcodesBCH.OP_1 + 1);
      }
      if (!instruction.data) return undefined;
      const decoded = vmNumberToBigInt(instruction.data, { requireMinimalEncoding: false });
      return typeof decoded === 'bigint' ? decoded : undefined;
    };
    const routeTrailingBase = artifact.messageBus!.route!.blockLayout!.trailingBase;
    expect(routeTrailingBase).toBeDefined();
    const outputBytecodeIndices = instructions.flatMap((instruction, index) =>
      instruction.opcode === OpcodesBCH.OP_OUTPUTBYTECODE ? [index] : []);
    expect(outputBytecodeIndices.length).toBeGreaterThanOrEqual(2);
    for (const index of outputBytecodeIndices) {
      expect(instructions[index - 10]?.opcode).toBe(OpcodesBCH.OP_PICK);
      expect(readNumber(instructions[index - 9])).toBe(BigInt(routeTrailingBase!));
      expect(instructions[index - 8]?.opcode).toBe(OpcodesBCH.OP_ADD);
      expect(instructions[index - 6]?.opcode).toBe(OpcodesBCH.OP_PICK);
      expect(instructions[index - 5]?.opcode).toBe(OpcodesBCH.OP_ADD);
      expect(instructions[index - 3]?.opcode).toBe(OpcodesBCH.OP_PICK);
      expect(instructions[index - 2]?.opcode).toBe(OpcodesBCH.OP_ADD);
      expect(instructions[index - 1]?.opcode).toBe(OpcodesBCH.OP_DUP);
      expect(instructions.slice(index - 10, index).some((part) =>
        part.opcode === OpcodesBCH.OP_INPUTINDEX)).toBe(false);
    }
  });

  it('stays lazy when the compile cache clones the artifact', () => {
    const previous = process.env.SOLIDC_COMPILE_CACHE;
    process.env.SOLIDC_COMPILE_CACHE = '1';
    try {
      const artifact = compileString(`contract CachedDelegate() {
        bigint counter;
        function f() public { this.counter = this.counter + 1; }
      }`);
      const descriptor = Object.getOwnPropertyDescriptor(artifact, 'delegateArtifact');
      expect(descriptor?.get).toBeTypeOf('function');
      expect(artifact.delegateArtifact).toBeDefined();
    } finally {
      if (previous === undefined) delete process.env.SOLIDC_COMPILE_CACHE;
      else process.env.SOLIDC_COMPILE_CACHE = previous;
    }
  });

  it('reads state-pinned external-call targets from proxy storage, not executor-adjacent NFTs', () => {
    const artifact = compileString(`
      interface Sink { function ping() external; }
      contract DelegateTarget {
        Sink sink;
        uint counter;
        function apply() public delegate {
          counter = counter + 1;
          sink.ping();
        }
      }
    `);
    const apply = artifact.abi.find((entry) => entry.name === 'apply');
    expect(apply?.modifiers).toContain('delegate');

    const readNumber = (instruction?: { opcode: number; data?: Uint8Array }): bigint | undefined => {
      if (instruction === undefined) return undefined;
      if (instruction.opcode === OpcodesBCH.OP_0) return 0n;
      if (instruction.opcode >= OpcodesBCH.OP_1 && instruction.opcode <= OpcodesBCH.OP_16) {
        return BigInt(instruction.opcode - OpcodesBCH.OP_1 + 1);
      }
      if (!instruction.data) return undefined;
      const decoded = vmNumberToBigInt(instruction.data, { requireMinimalEncoding: false });
      return typeof decoded === 'bigint' ? decoded : undefined;
    };
    const decodeBody = (bytecode: string): Array<{ opcode: number; data?: Uint8Array }> => (
      decodeAuthenticationInstructions(hexToBin(bytecode))
    );
    // Whole-program outlining lifts the repeated bottom-ordinal proxy index into one helper. That helper is
    // exactly `DEPTH <1> SUB PICK <1> ADD`: the authenticated proxy master, plus one, which is its data NFT.
    const bottomPlusOne = (instructions: Array<{ opcode: number; data?: Uint8Array }>): boolean => {
      if (instructions[0]?.opcode !== OpcodesBCH.OP_DEPTH) return false;
      let cursor = 1;
      if (instructions[cursor]?.opcode === OpcodesBCH.OP_1SUB) cursor += 1;
      else if (readNumber(instructions[cursor]) === 1n
        && instructions[cursor + 1]?.opcode === OpcodesBCH.OP_SUB) cursor += 2;
      else return false;
      if (instructions[cursor]?.opcode !== OpcodesBCH.OP_PICK) return false;
      cursor += 1;
      if (instructions[cursor]?.opcode === OpcodesBCH.OP_1ADD) cursor += 1;
      else if (readNumber(instructions[cursor]) === 1n
        && instructions[cursor + 1]?.opcode === OpcodesBCH.OP_ADD) cursor += 2;
      else return false;
      return cursor === instructions.length;
    };
    const decoded = [
      { id: undefined as bigint | undefined, instructions: decodeBody(artifact.functionBodies?.[apply!.selector!] ?? '') },
      ...Object.entries(artifact.debug?.invokeDebug ?? {}).map(([id, entry]) => ({
        id: BigInt(id),
        instructions: decodeBody(entry.bytecode),
      })),
    ].filter((body) => body.instructions.length > 0);
    const bodies = decoded.map((body) => body.instructions);
    const bottomPlusOneIds = new Set(decoded.flatMap((body) => (
      body.id !== undefined && bottomPlusOne(body.instructions) ? [body.id] : []
    )));
    const proxyStorageRead = bodies.some((instructions) => instructions.some((instruction, index) => {
      if (instruction.opcode !== OpcodesBCH.OP_DEPTH) return false;
      const pick = instructions[index + 1]?.opcode === OpcodesBCH.OP_1SUB ? index + 2
        : instructions[index + 1]?.opcode === OpcodesBCH.OP_1
          && instructions[index + 2]?.opcode === OpcodesBCH.OP_SUB ? index + 3 : -1;
      if (instructions[pick]?.opcode !== OpcodesBCH.OP_PICK) return false;
      return (instructions[pick + 1]?.opcode === OpcodesBCH.OP_1ADD
        && instructions[pick + 2]?.opcode === OpcodesBCH.OP_UTXOTOKENCOMMITMENT)
        || (instructions[pick + 1]?.opcode === OpcodesBCH.OP_1
          && instructions[pick + 2]?.opcode === OpcodesBCH.OP_ADD
          && instructions[pick + 3]?.opcode === OpcodesBCH.OP_UTXOTOKENCOMMITMENT);
    })) || bodies.some((instructions) => instructions.some((instruction, index) => {
      const helperId = readNumber(instructions[index - 1]);
      return instruction.opcode === OpcodesBCH.OP_INVOKE
        && helperId !== undefined
        && bottomPlusOneIds.has(helperId)
        && instructions[index + 1]?.opcode === OpcodesBCH.OP_UTXOTOKENCOMMITMENT;
    }));
    expect(proxyStorageRead).toBe(true);

    // The implementation executes two inputs after the proxy master: proxy master, its one data NFT, executor.
    // INPUTINDEX+1 therefore selects an executor-owned sibling, never the state used to pin `sink`.
    const executorAdjacentRead = bodies.some((instructions) => instructions.some((instruction, index) => (
      instruction.opcode === OpcodesBCH.OP_INPUTINDEX
      && instructions[index + 1]?.opcode === OpcodesBCH.OP_1ADD
      && instructions[index + 2]?.opcode === OpcodesBCH.OP_UTXOTOKENCOMMITMENT
    )));
    expect(executorAdjacentRead).toBe(false);
  });

  it('binds ordinary delegate executors to compact or fully balanced layouts without widening the ABI frame', () => {
    const artifact = compileString(`
      contract BalancedDelegate {
        uint counter;
        mapping(uint => uint) values;
        event Applied(uint key);
        function apply(uint key) public delegate {
          counter = counter + 1;
          values[key] = counter;
          emit Applied(key);
        }
      }
    `);
    const apply = artifact.abi.find((entry) => entry.name === 'apply')!;
    const instructions = decodeAuthenticationInstructions(hexToBin(
      artifact.functionBodies?.[apply.selector!]!,
    ));
    const readNumber = (instruction?: { opcode: number; data?: Uint8Array }): bigint | undefined => {
      if (!instruction) return undefined;
      if (instruction.opcode === OpcodesBCH.OP_0) return 0n;
      if (instruction.opcode >= OpcodesBCH.OP_1 && instruction.opcode <= OpcodesBCH.OP_16) {
        return BigInt(instruction.opcode - OpcodesBCH.OP_1 + 1);
      }
      if (!instruction.data) return undefined;
      const decoded = vmNumberToBigInt(instruction.data, { requireMinimalEncoding: false });
      return typeof decoded === 'bigint' ? decoded : undefined;
    };
    const compactOffset = 1 + apply.requiredNftIndices!.length;
    const balancedOffset = apply.blockLayout!.blockSize;
    expect(balancedOffset).toBeGreaterThan(compactOffset);

    const offsetGate = instructions.findIndex((instruction, index) => (
      instruction.opcode === OpcodesBCH.OP_DUP
      && instructions[index + 1]?.opcode === OpcodesBCH.OP_INPUTINDEX
      && readNumber(instructions[index + 2]) === BigInt(compactOffset)
      && instructions[index + 3]?.opcode === OpcodesBCH.OP_SUB
      && instructions[index + 4]?.opcode === OpcodesBCH.OP_NUMEQUAL
      && instructions[index + 5]?.opcode === OpcodesBCH.OP_OVER
      && instructions[index + 6]?.opcode === OpcodesBCH.OP_INPUTINDEX
      && readNumber(instructions[index + 7]) === BigInt(balancedOffset)
      && instructions[index + 8]?.opcode === OpcodesBCH.OP_SUB
      && instructions[index + 9]?.opcode === OpcodesBCH.OP_NUMEQUAL
      && instructions[index + 10]?.opcode === OpcodesBCH.OP_BOOLOR
      && instructions[index + 11]?.opcode === OpcodesBCH.OP_VERIFY
      && instructions[index + 12]?.opcode === OpcodesBCH.OP_DROP
    ));
    expect(offsetGate).toBeGreaterThanOrEqual(0);

    // A balanced invocation places entry/funder inputs between the proxy state and executor. Once the prologue
    // admits that layout, later state reads must reuse the authenticated proxy parameter rather than silently
    // reverting to `INPUTINDEX - compactOffset`. The bottom-relative parameter copy is stable under untracked
    // helper operands above the declared ABI frame.
    const stateRead = instructions.findIndex((instruction, index) => (
      index > offsetGate + 12 && instruction.opcode === OpcodesBCH.OP_UTXOTOKENCOMMITMENT
    ));
    expect(stateRead).toBeGreaterThanOrEqual(0);
    const stateReadOwnerWindow = instructions.slice(Math.max(offsetGate + 13, stateRead - 8), stateRead);
    expect(stateReadOwnerWindow.some((instruction) => instruction.opcode === OpcodesBCH.OP_DEPTH)).toBe(true);
    expect(stateReadOwnerWindow.some((instruction) => instruction.opcode === OpcodesBCH.OP_PICK)).toBe(true);
    expect(stateReadOwnerWindow.some((instruction) => instruction.opcode === OpcodesBCH.OP_INPUTINDEX)).toBe(false);

    const entryOffset = apply.blockLayout!.slots.find((slot) => slot.kind === 'entry')!.offset;
    const resourceBaseHelper = Object.entries(artifact.debug?.invokeDebug ?? {}).find(([, candidate]) => {
      const body = decodeAuthenticationInstructions(hexToBin(candidate.bytecode));
      return body.some((instruction, index) => (
        instruction.opcode === OpcodesBCH.OP_DUP
        && body[index + 1]?.opcode === OpcodesBCH.OP_INPUTINDEX
        && readNumber(body[index + 2]) === BigInt(compactOffset)
        && body[index + 3]?.opcode === OpcodesBCH.OP_SUB
        && body[index + 4]?.opcode === OpcodesBCH.OP_NUMEQUAL
        && body[index + 5]?.opcode === OpcodesBCH.OP_IF
        && body[index + 6]?.opcode === OpcodesBCH.OP_DROP
        && body[index + 7]?.opcode === OpcodesBCH.OP_INPUTINDEX
        && body[index + 8]?.opcode === OpcodesBCH.OP_ENDIF
      ));
    });
    expect(resourceBaseHelper).toBeDefined();
    const resourceBaseHelperId = BigInt(resourceBaseHelper![0]);
    const authenticatedEntryRead = instructions.findIndex((instruction, index) => (
      instruction.opcode === OpcodesBCH.OP_INVOKE
      && readNumber(instructions[index - 1]) === resourceBaseHelperId
      && readNumber(instructions[index + 1]) === BigInt(entryOffset)
      && instructions[index + 2]?.opcode === OpcodesBCH.OP_ADD
      && instructions.slice(index + 3, index + 7)
        .some((candidate) => candidate.opcode === OpcodesBCH.OP_UTXOBYTECODE
          || candidate.opcode === OpcodesBCH.OP_UTXOTOKENCOMMITMENT)
    ));
    expect(authenticatedEntryRead).toBeGreaterThanOrEqual(0);

    // Output-only effects use the same authenticated physical base. Compact execution keeps the executor base;
    // a fully balanced invocation retains the proxy-master base. The category read addresses the published event
    // slot, and the event commitment is still equality-checked after constructing its value.
    const eventOffset = apply.blockLayout!.slots.find((slot) => slot.kind === 'event')!.offset;
    const authenticatedEventIndex = instructions.some((instruction, index) => (
      instruction.opcode === OpcodesBCH.OP_INVOKE
      && readNumber(instructions[index - 1]) === resourceBaseHelperId
      && readNumber(instructions[index + 1]) === BigInt(eventOffset)
      && instructions[index + 2]?.opcode === OpcodesBCH.OP_ADD
      && instructions[index + 3]?.opcode === OpcodesBCH.OP_OUTPUTTOKENCATEGORY
    ));
    expect(authenticatedEventIndex).toBe(true);
    expect(instructions.some((instruction, index) => instruction.opcode === OpcodesBCH.OP_OUTPUTTOKENCOMMITMENT
      && instructions[index + 1]?.opcode === OpcodesBCH.OP_EQUALVERIFY)).toBe(true);

    // The protocol-wide immutable-event scan must use that same selected base. A bare OP_INPUTINDEX would reject
    // every honest balanced event even though its per-slot covenant passed. The selector may be outlined or inline.
    const authenticatedImmutableEventScan = instructions.some((instruction, index) => (
      instruction.opcode === OpcodesBCH.OP_TXOUTPUTCOUNT
      && instructions[index + 1]?.opcode === OpcodesBCH.OP_1SUB
      && ((instructions[index - 1]?.opcode === OpcodesBCH.OP_INVOKE
        && readNumber(instructions[index - 2]) === resourceBaseHelperId)
        || (instructions[index - 9]?.opcode === OpcodesBCH.OP_DUP
          && instructions[index - 8]?.opcode === OpcodesBCH.OP_INPUTINDEX
          && readNumber(instructions[index - 7]) === BigInt(compactOffset)
          && instructions[index - 6]?.opcode === OpcodesBCH.OP_SUB
          && instructions[index - 5]?.opcode === OpcodesBCH.OP_NUMEQUAL
          && instructions[index - 4]?.opcode === OpcodesBCH.OP_IF
          && instructions[index - 3]?.opcode === OpcodesBCH.OP_DROP
          && instructions[index - 2]?.opcode === OpcodesBCH.OP_INPUTINDEX
          && instructions[index - 1]?.opcode === OpcodesBCH.OP_ENDIF))
    ));
    expect(authenticatedImmutableEventScan).toBe(true);
  });
});
