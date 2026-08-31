import { describe, expect, it } from 'vitest';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '../../src/compiler.js';

const OPTIONS = { messageBus: true as const, forceStateful: true };

const clonePrefix = /^__message_bus_(graph|array|resource)_/;

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

const assertKernelRoute = (source: string, handlerName: string): ReturnType<typeof compileString> => {
  const artifact = compileString(source, OPTIONS);
  expect(artifact.messageBus?.version).toBe(1);
  const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === handlerName);
  expect(handler?.eligible).toBe(true);
  expect(handler?.selector).toMatch(/^[0-9a-f]{8}$/);
  expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
  expect(artifact.invocationAnalysis?.functions.some((fn) => clonePrefix.test(fn.name))).toBe(false);
  expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
  const asm = routeAsm(artifact);
  expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
  expect(selectorPushCount(asm, handler!.selector)).toBe(1);
  return artifact;
};

describe('message-bus kernel cutover route', () => {
  it('journals a parameter-keyed mapping helper on the runtime row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.13.0;
contract Ledger() {
  mapping(bytes20 => int) balances;
  function bump(bytes20 who, int n) internal {
    this.balances[who] = ((this.balances[who] + n) * 3 - n) / 2;
  }
  function credit(bytes20 who, int a, int b, int c) public {
    bump(who, a);
    bump(who, b);
    bump(who, c);
    require(a >= 0);
  }
}
`, 'credit');
    const asm = routeAsm(artifact);
    expect((asm.match(/OP_INVOKE/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(artifact.invocationAnalysis?.functions.some((fn) => fn.name === '__message_bus_entry_credit'
      || fn.name === 'bump')).toBe(true);
  });

  it('journals a msg.sender-keyed mapping write without _rN route inputs', () => {
    assertKernelRoute(`
pragma solidcash ^0.13.0;
contract Ledger() {
  mapping(address => int) balances;
  function credit(int n) public {
    this.balances[msg.sender] = this.balances[msg.sender] + n;
    require(true);
  }
}
`, 'credit');
  });

  it('captures a returning ERC-20-shaped mapping handler inside the same loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.13.0;
contract Token() {
  mapping(bytes20 => int) balances;
  function credit(bytes20 who, int n) public returns (bool) {
    this.balances[who] = this.balances[who] + n;
    return true;
  }
}
`, 'credit');
    const credit = artifact.messageBus?.handlers.find((handler) => handler.name === 'credit');
    expect(credit?.outputs?.some((output) => output.type.includes('bool'))).toBe(true);
  });

  it('dispatches a satoshi transfer from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.13.0;
contract Pay() {
  function pay(bytes recipient, int amount) public {
    this.transfer(recipient, amount);
    require(true);
  }
}
`, 'pay');
  });

  it('dispatches owner-frame delegate handlers from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.13.0;
contract Acc() {
  int x;
  function add(int n) public delegate {
    this.x = this.x + n;
    require(true);
  }
}
`, 'add');
  });

  it('dispatches a token-container transfer from the runtime row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.13.0;
contract Vault() {
  function send(bytes32 category, bytes recipient, int amount) public {
    require(this.tokens[category].tokenAmount >= amount);
    this.tokens[category].transfer(recipient, amount);
    require(true);
  }
}
`, 'send');
    const frame = artifact.messageBus!.route.graphEffectFrame;
    expect(frame).toBeDefined();
    expect(frame!.sites).toBeGreaterThanOrEqual(2);
    expect(frame!.tokenTransferWidth).toBeGreaterThanOrEqual(1);
    const route = artifact.messageBus!.route;
    const tcSlots = route.blockLayout?.slots.filter((slot) => slot.kind === 'tcTransfer') ?? [];
    expect(tcSlots.length).toBe(frame!.sites * frame!.tokenTransferWidth);
    expect(route.blockLayout?.slots.some((slot) => slot.kind === 'tokenContainer')).toBe(true);
  });

  it('dispatches a token-container NFT transfer from the runtime row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.13.0;
contract Vault() {
  function sendNft(bytes32 category, bytes recipient, bytes commitment, int capability) public {
    require(this.tokens[category].tokenAmount >= 0);
    this.tokens[category].transferNft(recipient, commitment, capability);
    require(true);
  }
}
`, 'sendNft');
    const frame = artifact.messageBus!.route.graphEffectFrame;
    expect(frame).toBeDefined();
    expect(frame!.sites).toBeGreaterThanOrEqual(2);
    expect(frame!.tokenTransferWidth).toBeGreaterThanOrEqual(1);
    expect(frame!.tokenNftTransfers).toBe(true);
    const route = artifact.messageBus!.route;
    const tcSlots = route.blockLayout?.slots.filter((slot) => slot.kind === 'tcTransfer') ?? [];
    expect(tcSlots.length).toBe(frame!.sites * frame!.tokenTransferWidth);
    expect(route.blockLayout?.slots.some((slot) => slot.kind === 'tokenContainer')).toBe(true);
  });
});
