import { hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '../../src/compiler.js';

const OPTIONS = { messageBus: true as const, forceStateful: true, messageBusKernel: true };

const VOID_SOURCE = `
pragma solidcash ^0.13.0;
contract Acc() {
  int x;
  function add(int n) public {
    this.x = this.x + n;
    require(true);
  }
}
`;

const RETURN_SOURCE = `
pragma solidcash ^0.13.0;
contract Acc() {
  int x;
  function add(int n) public {
    this.x = this.x + n;
    require(true);
  }
  function get() public returns (int) {
    return this.x;
  }
}
`;

const TWO_JOURNAL_HANDLER_SOURCE = `
pragma solidcash ^0.13.0;
contract Store() {
  mapping(int => int) values;
  function write(int n, int value) public {
    for (int i = 0; i < n; i = i + 1) { this.values[i] = value; }
    require(true);
  }
  function erase(int n) public {
    for (int i = 0; i < n; i = i + 1) { delete this.values[i]; }
    require(true);
  }
}
`;

const routeAsm = (artifact: ReturnType<typeof compileString>): string => {
  const body = artifact.functionBodies?.['53434231'];
  expect(body).toBeDefined();
  return bytecodeToAsm(Uint8Array.from(Buffer.from(body!, 'hex')));
};

const selectorPushCount = (asm: string, selectorHex: string): number => {
  const needle = selectorHex.toLowerCase();
  let count = 0;
  let from = 0;
  const haystack = asm.replace(/\s+/g, '').toLowerCase();
  while (from < haystack.length) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
};

describe('message-bus kernel loop route', () => {
  it('dispatches a void handler from one row loop rather than unrolled rowCount bands', () => {
    const artifact = compileString(VOID_SOURCE, OPTIONS);
    expect(artifact.messageBus).toBeDefined();
    expect(artifact.compiler.options?.messageBusKernel).toBe(true);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.available).toBe(true);
    expect(artifact.messageBus?.maximumRows).toBeGreaterThanOrEqual(2);
    const add = artifact.messageBus?.handlers.find((handler) => handler.name === 'add');
    expect(add?.eligible).toBe(true);
    expect(add?.selector).toMatch(/^[0-9a-f]{8}$/);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
    expect(selectorPushCount(asm, add!.selector)).toBe(1);
    expect(artifact.debug.bytecode.length / 2).toBeLessThan(8_000);
  });

  it('captures returning scalar results inside the same runtime loop', () => {
    const artifact = compileString(RETURN_SOURCE, OPTIONS);
    expect(artifact.messageBus).toBeDefined();
    const get = artifact.messageBus?.handlers.find((handler) => handler.name === 'get');
    const add = artifact.messageBus?.handlers.find((handler) => handler.name === 'add');
    expect(get?.eligible).toBe(true);
    expect(add?.eligible).toBe(true);
    expect(get?.outputs?.some((output) => output.type.includes('int'))).toBe(true);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
    expect(selectorPushCount(asm, get!.selector)).toBe(1);
    expect(selectorPushCount(asm, add!.selector)).toBe(1);
    expect(artifact.debug.bytecode.length / 2).toBeLessThan(12_000);
  });

  it('keeps the unknown-selector revert on the loop route', () => {
    const artifact = compileString(RETURN_SOURCE, OPTIONS);
    const asm = routeAsm(artifact);
    // `revert("unknown batch selector")` lowers to a failing OP_0 OP_VERIFY on the dispatch else arm.
    expect(asm.toLowerCase()).toMatch(/op_else op_0 op_verify/);
  });

  it('publishes maximumRows as a runtime bound, not an AST copy count', () => {
    const artifact = compileString(RETURN_SOURCE, OPTIONS);
    expect(artifact.messageBus?.maximumRows).toBeGreaterThanOrEqual(2);
    expect(artifact.messageBus?.route.inputs.some((input) => input.name === 'batchBlob')).toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
  });

  it('dispatches event-emitting handlers from the runtime row loop without a new clone family', () => {
    const artifact = compileString(`
pragma solidcash ^0.13.0;
contract Acc() {
  event Ping(int n);
  int x;
  function ping(int n) public {
    emit Ping(n);
    require(true);
  }
}
`, OPTIONS);
    const ping = artifact.messageBus?.handlers.find((handler) => handler.name === 'ping');
    expect(ping?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => /^__message_bus_(graph|array|resource)_/.test(fn.name))).toBe(false);
    expect(artifact.invocationAnalysis?.functions.some((fn) =>
      /^__message_bus_(graph|array|resource)_/.test(fn.name))).toBe(false);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
    expect(selectorPushCount(asm, ping!.selector)).toBe(1);
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
  });

  it('journals a reusable scalar helper as one OP_INVOKE body on the kernel route', () => {
    const artifact = compileString(`
pragma solidcash ^0.13.0;
contract Acc() {
  int x;
  function bump(int n) internal { this.x = ((this.x + n) * 3 - n) / 2; }
  function add(int a, int b, int c) public {
    bump(a);
    bump(b);
    bump(c);
    require(a >= 0);
  }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'add')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => /^__message_bus_(graph|array|resource)_/.test(fn.name))).toBe(false);
    expect(artifact.invocationAnalysis?.functions.some((fn) =>
      /^__message_bus_(graph|array|resource)_/.test(fn.name))).toBe(false);
    const bump = artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'bump');
    expect(bump).toBeDefined();
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'add')?.calls)
      .toContain(bump?.id);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
    const add = artifact.messageBus?.handlers.find((handler) => handler.name === 'add');
    expect(selectorPushCount(asm, add!.selector)).toBe(1);
    const addAsm = bytecodeToAsm(hexToBin(artifact.functionBodies![add!.selector]));
    // bump is function id 0 (first declared). Three call sites share one defined body.
    expect([...addAsm.replace(/\s+/g, ' ').matchAll(/OP_0 OP_INVOKE/g)]).toHaveLength(3);
  });

  it('threads one route-owned record carrier through each direct journal-aware handler', () => {
    const artifact = compileString(TWO_JOURNAL_HANDLER_SOURCE, OPTIONS);
    const write = artifact.messageBus?.handlers.find((handler) => handler.name === 'write');
    const erase = artifact.messageBus?.handlers.find((handler) => handler.name === 'erase');
    expect(write).toMatchObject({ eligible: true });
    expect(erase).toMatchObject({ eligible: true });

    const records = artifact.messageBus?.route.inputs.filter(
      (input) => input.name === '__internal__kernelJournalRecords',
    );
    expect(records).toHaveLength(1);
    expect(records?.[0]?.type).toBe('bytes[]');

    // The carrier is immutable in this transport-only stage: the route snapshots it before dispatch and binds
    // the returned value back to that snapshot before its existing dense-prefix length check.
    const asm = routeAsm(artifact);
    expect(asm).toContain('OP_EQUALVERIFY');
    expect(selectorPushCount(asm, write!.selector)).toBe(1);
    expect(selectorPushCount(asm, erase!.selector)).toBe(1);
  });
});
