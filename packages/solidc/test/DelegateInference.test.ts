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
      `, { messageBus: true, solidityImportCompat: true });

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
      // OP_INPUTINDEX would make the handler read executor+slot. Its hidden owner argument is selected with PICK.
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
      const findHelperInvoke = (bytecode: string) => {
        const instructions = decodeAuthenticationInstructions(hexToBin(bytecode));
        const index = instructions.findIndex((instruction, i) => i > 0
          && instruction.opcode === OpcodesBCH.OP_INVOKE
          && readNumber(instructions[i - 1]) === helperId);
        expect(index).toBeGreaterThan(0);
        return { index, instructions };
      };

      // The route handler copies four declared arguments and, immediately beneath them, its authenticated
      // participant owner. This checks the call edge as well as the helper body: widening only the callee frame
      // leaves its parameters shifted even though the helper itself contains no OP_INPUTINDEX.
      const routedHandler = Object.values(artifact.debug?.invokeDebug ?? {})
        .find((candidate) => candidate.name === '__message_bus_graph_apply');
      expect(routedHandler).toBeDefined();
      const routedCall = findHelperInvoke(routedHandler!.bytecode);
      let routedCursor = routedCall.index - 2;
      for (let argument = 0; argument < 4; argument += 1) {
        expect(routedCall.instructions[routedCursor].opcode).toBe(OpcodesBCH.OP_ROLL);
        expect(readNumber(routedCall.instructions[routedCursor - 1])).toBeDefined();
        routedCursor -= 2;
      }
      expect(routedCall.instructions[routedCursor].opcode).toBe(OpcodesBCH.OP_PICK);

      // The independently compiled ABI entry invokes that same widened helper. Its compute block starts beside
      // the active delegate executor, so the fifth hidden argument is OP_INPUTINDEX rather than a participant
      // owner PICK. Entry-point sub-traversals must retain the contract-wide outlined-call ABI to emit it.
      const applySelector = artifact.abi.find((entry) => entry.name === 'apply')?.selector;
      expect(applySelector).toBeDefined();
      const directCall = findHelperInvoke(artifact.functionBodies?.[applySelector!]!);
      const precedingInvoke = directCall.instructions
        .findLastIndex((instruction, i) => i < directCall.index
          && instruction.opcode === OpcodesBCH.OP_INVOKE);
      expect(directCall.instructions.slice(precedingInvoke + 1, directCall.index - 1)
        .some((instruction) => instruction.opcode === OpcodesBCH.OP_INPUTINDEX)).toBe(true);
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
          mapping(address => bytes) public notes;
          address public sink;
          modifier initializer() { _; }
          function initialize(address value) public initializer { sink = value; }
          function apply(bytes memory value) public {
            uint pong = Sink(sink).ping(address(this));
            payload = value;
            notes[msg.sender] = value;
            require(pong >= 0);
          }
        }
      `, { messageBus: true, solidityImportCompat: true, maximumInputBytes: 100_000 });

      expect(artifact.messageBus?.route?.modifiers).toContain('delegate');
      expect(artifact.messageBus?.route?.inputs.some((input) => (
        input.name === '__internal__valueChunkOutputBase'
      ))).toBe(true);
      const route = decodeAuthenticationInstructions(hexToBin(
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
      // Invoked handlers can leave runtime-only values above the route's tracked frame. Reading a long-lived
      // dynamic journal value for its chunk count must therefore use DEPTH-bottomOrdinal, not a fixed PICK depth.
      expect(route.some((instruction, index) => instruction.opcode === OpcodesBCH.OP_DEPTH
        && readNumber(route[index + 1]) !== undefined
        && route[index + 2]?.opcode === OpcodesBCH.OP_SUB
        && route[index + 3]?.opcode === OpcodesBCH.OP_PICK
        && route[index + 4]?.opcode === OpcodesBCH.OP_SIZE
        && route[index + 5]?.opcode === OpcodesBCH.OP_NIP)).toBe(true);
      // The route executes before its full reserved participant capacity. State reads use the authenticated proxy
      // witness from the stable ABI frame, never INPUTINDEX - blockSize (which is negative for a wide route).
      expect(route.some((instruction, index) => instruction.opcode === OpcodesBCH.OP_DEPTH
        && readNumber(route[index + 1]) !== undefined
        && route[index + 2]?.opcode === OpcodesBCH.OP_SUB
        && route[index + 3]?.opcode === OpcodesBCH.OP_PICK
        && route[index + 4]?.opcode === OpcodesBCH.OP_UTXOTOKENCATEGORY)).toBe(true);
      const blockSize = artifact.messageBus!.route!.blockLayout!.blockSize;
      // The delegated route executor sits at the compiler-published owner-block boundary. Its entry covenant
      // binds the proxy witness to that exact offset; ordinary delegates retain their compact data-NFT distance.
      expect(route.some((instruction, index) => instruction.opcode === OpcodesBCH.OP_INPUTINDEX
        && readNumber(route[index + 1]) === BigInt(blockSize)
        && route[index + 2]?.opcode === OpcodesBCH.OP_SUB
        && route[index + 3]?.opcode === OpcodesBCH.OP_NUMEQUALVERIFY)).toBe(true);
      expect(route.some((instruction, index) => instruction.opcode === OpcodesBCH.OP_INPUTINDEX
        && readNumber(route[index + 1]) === BigInt(blockSize)
        && route[index + 2]?.opcode === OpcodesBCH.OP_SUB
        && route[index + 3]?.opcode === OpcodesBCH.OP_UTXOTOKENCATEGORY)).toBe(false);
      // A legacy delegate owns the transaction suffix, but a compiler route owns a balanced participant block.
      // Reject the legacy `TXOUTPUTCOUNT - 1 - ceil(size/120)` dynamic-write anchor in that routed body.
      const suffixAnchoredWrite = route.some((instruction, index) =>
        instruction.opcode === OpcodesBCH.OP_TXOUTPUTCOUNT
        && route[index + 1]?.opcode === OpcodesBCH.OP_1SUB
        && route.slice(index + 2, index + 7).some((candidate, offset) =>
          candidate.opcode === OpcodesBCH.OP_PICK
          && route[index + 3 + offset]?.opcode === OpcodesBCH.OP_SIZE));
      expect(suffixAnchoredWrite).toBe(false);
      // An explicit trailingBase retains the reserved return slot as padding even when the call emits no return
      // event. Reject the compact-layout `returnOutputIdx < 0` adjustment in this balanced route.
      expect(route.some((instruction, index) =>
        instruction.opcode === OpcodesBCH.OP_0
        && route[index + 1]?.opcode === OpcodesBCH.OP_LESSTHAN
        && route[index + 2]?.opcode === OpcodesBCH.OP_SUB)).toBe(false);
      const routedHandler = Object.values(artifact.debug?.invokeDebug ?? {})
        .find((candidate) => candidate.name === '__message_bus_graph_apply');
      expect(routedHandler).toBeDefined();
      const handler = decodeAuthenticationInstructions(hexToBin(routedHandler!.bytecode));
      // address(this) remains the exact active executing input bytecode, independently of the state owner.
      expect(handler.some((instruction, index) =>
        instruction.opcode === OpcodesBCH.OP_INPUTINDEX
        && handler[index + 1]?.opcode === OpcodesBCH.OP_UTXOBYTECODE)).toBe(true);
    } finally {
      warn.mockRestore();
      log.mockRestore();
    }
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
        solidityImportCompat: true,
        maximumInputBytes: 1_000_000,
        optimizeForCompilationSpeed: true,
        suppressWarnings: true,
      });
      const routedHandler = Object.values(artifact.debug?.invokeDebug ?? {})
        .find((candidate) => candidate.name === '__message_bus_graph_apply');
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
      const partialThenDynamicRead = instructions.findIndex((instruction, index) => (
        readNumber(instruction) !== undefined
        && instructions[index + 1]?.opcode === OpcodesBCH.OP_PICK
        && readNumber(instructions[index + 2]) !== undefined
        && instructions[index + 3]?.opcode === OpcodesBCH.OP_ADD
        && readNumber(instructions[index + 4]) !== undefined
        && instructions[index + 5]?.opcode === OpcodesBCH.OP_PICK
        && instructions[index + 6]?.opcode === OpcodesBCH.OP_1
        && instructions[index + 7]?.opcode === OpcodesBCH.OP_ADD
        && instructions[index + 8]?.opcode === OpcodesBCH.OP_UTXOTOKENCOMMITMENT
      ));
      expect(partialThenDynamicRead).toBeGreaterThanOrEqual(0);
      const routeTrailingBase = artifact.messageBus!.route.blockLayout!.trailingBase;
      expect(routeTrailingBase).toBeDefined();
      expect(readNumber(instructions[partialThenDynamicRead + 2])).toBe(BigInt(routeTrailingBase!));
      const baseOwnerDepth = readNumber(instructions[partialThenDynamicRead]);
      const dynamicOwnerDepth = readNumber(instructions[partialThenDynamicRead + 4]);
      expect(dynamicOwnerDepth).toBe(baseOwnerDepth! + 1n);

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

    const bodies = [
      artifact.functionBodies?.[apply!.selector!],
      ...Object.values(artifact.debug?.invokeDebug ?? {}).map((entry) => entry.bytecode),
    ].filter((body): body is string => body !== undefined)
      .map((body) => decodeAuthenticationInstructions(hexToBin(body)));
    const proxyStorageRead = bodies.some((instructions) => instructions.some((instruction, index) => (
      instruction.opcode === OpcodesBCH.OP_INPUTINDEX
      && instructions[index + 1]?.opcode === OpcodesBCH.OP_2
      && instructions[index + 2]?.opcode === OpcodesBCH.OP_SUB
      && instructions[index + 3]?.opcode === OpcodesBCH.OP_1ADD
      && instructions[index + 4]?.opcode === OpcodesBCH.OP_UTXOTOKENCOMMITMENT
    )));
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
});
