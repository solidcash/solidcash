import { describe, it, expect, vi } from 'vitest';
import { formatArtifact } from '@solidcash/utils';
import {
  decodeAuthenticationInstructions, hexToBin, OpcodesBCH, vmNumberToBigInt,
} from '@bitauth/libauth';
import { compileString } from '../src/index.js';

// Compiler-side rules for inferring the proxy-implementation (delegate) build. Source never writes `delegate`;
// the SDK-facing behaviour is covered in solidcash/test/e2e/DelegateInferred.test.ts.
// See docs/delegatecall.md.

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
      }`, { evmCompat: true, forceStateful: true });
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

  it('marks an entry point whose only proxy-state write is a bare mapping entry', () => {
    expect(markedNames(`contract C() {
      mapping(int => int) balances;
      function seed(int k, int v) public { balances[k] = v; }
      function drop(int k) public { delete balances[k]; }
    }`)).toEqual(['seed', 'drop']);
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

  it('does not infer dynamic-state context from a shadowing source parameter', () => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract ShadowedDynamic {
        bytes public payload;
        function lengthOf(bytes memory payload) public pure returns (uint) {
          return payload.length;
        }
      }
    `, { evmCompat: true, maximumInputBytes: 100_000 });
    expect(artifact.abi.find((entry) => entry.name === 'lengthOf')?.inputs.some((input) => (
      input.name === '__internal__dynamicChunkInputBase'
    ))).toBe(false);
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

  it('binds an ordinary delegate executor to the one compact distance whatever its block holds', () => {
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

    // The forward pins a direct delegate one master/data block after the proxy, so the prologue admits exactly that
    // distance after its `proxy != delegate` check. A second one, the full block, would let the witness name a master
    // the forward did not place.
    const offsetGate = instructions.findIndex((instruction, index) => (
      instruction.opcode === OpcodesBCH.OP_DUP
      && instructions[index + 1]?.opcode === OpcodesBCH.OP_INPUTINDEX
      && instructions[index + 2]?.opcode === OpcodesBCH.OP_NUMNOTEQUAL
      && instructions[index + 3]?.opcode === OpcodesBCH.OP_VERIFY
    ));
    expect(offsetGate).toBeGreaterThanOrEqual(0);
    const gate = instructions.slice(offsetGate + 4, offsetGate + 8);
    expect(gate[0]?.opcode).toBe(OpcodesBCH.OP_INPUTINDEX);
    expect(readNumber(gate[1])).toBe(BigInt(compactOffset));
    expect(gate[2]?.opcode).toBe(OpcodesBCH.OP_SUB);
    expect(gate[3]?.opcode).toBe(OpcodesBCH.OP_NUMEQUALVERIFY);

    // Later state reads reuse the authenticated proxy parameter. The bottom-relative parameter copy is stable under
    // untracked helper operands above the declared ABI frame.
    const stateRead = instructions.findIndex((instruction, index) => (
      index >= offsetGate + 8 && instruction.opcode === OpcodesBCH.OP_UTXOTOKENCOMMITMENT
    ));
    expect(stateRead).toBeGreaterThanOrEqual(0);
    const stateReadOwnerWindow = instructions.slice(Math.max(offsetGate + 8, stateRead - 8), stateRead);
    expect(stateReadOwnerWindow.some((instruction) => instruction.opcode === OpcodesBCH.OP_DEPTH)).toBe(true);
    expect(stateReadOwnerWindow.some((instruction) => instruction.opcode === OpcodesBCH.OP_PICK)).toBe(true);
    expect(stateReadOwnerWindow.some((instruction) => instruction.opcode === OpcodesBCH.OP_INPUTINDEX)).toBe(false);

    // Entry and effect slots follow the executor: no body selects between an executor and a proxy-master base.
    const bodies = [instructions, ...Object.values(artifact.debug?.invokeDebug ?? {})
      .map((candidate) => decodeAuthenticationInstructions(hexToBin(candidate.bytecode)))];
    expect(bodies.some((body) => body.some((instruction, index) => (
      instruction.opcode === OpcodesBCH.OP_DUP
      && body[index + 1]?.opcode === OpcodesBCH.OP_INPUTINDEX
      && readNumber(body[index + 2]) === BigInt(compactOffset)
      && body[index + 3]?.opcode === OpcodesBCH.OP_SUB
      && body[index + 4]?.opcode === OpcodesBCH.OP_NUMEQUAL
      && body[index + 5]?.opcode === OpcodesBCH.OP_IF
    )))).toBe(false);
    // The event commitment is still equality-checked after constructing its value.
    expect(bodies.some((body) => body.some((instruction, index) => (
      instruction.opcode === OpcodesBCH.OP_OUTPUTTOKENCOMMITMENT
      && body[index + 1]?.opcode === OpcodesBCH.OP_EQUALVERIFY
    )))).toBe(true);
  });
});
