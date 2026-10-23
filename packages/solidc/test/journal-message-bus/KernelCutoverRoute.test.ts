import { describe, expect, it } from 'vitest';
import { bytecodeToAsm } from '@solidcash/utils';
import { compileString } from '../../src/compiler.js';

const OPTIONS = { messageBus: true as const, forceStateful: true, messageBusKernel: true };

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
  it('publishes active-entry callers for ordinary and delegate routes', () => {
    const source = `
pragma solidcash ^0.14.0;
interface ISink { function ping() external; }
contract Caller(address sink) {
  int marker;
  function fire() public {
    ISink(sink).ping();
    this.marker = 1;
  }
}`;
    const ordinary = compileString(source, OPTIONS);
    expect(ordinary.abi.find((entry) => entry.name === 'fire')?.externalCalls?.[0]?.callerIdentity)
      .toEqual({ version: 1, role: 'active', auth: 'input-bytecode', authOffset: 0xffff });

    const delegated = compileString(source, { ...OPTIONS, autoDelegate: true });
    expect(delegated.abi.find((entry) => entry.name === 'fire')?.externalCalls?.[0]?.callerIdentity)
      .toEqual({ version: 1, role: 'active', auth: 'input-bytecode', authOffset: 0xffff });

    const explicitDelegate = compileString(
      source.replace('function fire() public {', 'function fire() public delegate {'), OPTIONS,
    );
    expect(explicitDelegate.abi.find((entry) => entry.name === 'fire')?.externalCalls?.[0]?.callerIdentity)
      .toEqual({ version: 1, role: 'active', auth: 'input-bytecode', authOffset: 0xffff });
  });

  it('journals a parameter-keyed mapping helper on the runtime row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
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
pragma solidcash ^0.14.0;
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
pragma solidcash ^0.14.0;
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

  it('keeps a returning ERC-20 mapping writer with an event on kernel row dispatch', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Token() {
  mapping(address => mapping(address => uint)) allowances;
  event Approval(address indexed owner, address indexed spender, uint value);
  function approve(address spender, uint value) public returns (bool) {
    allowances[msg.sender][spender] = value;
    emit Approval(msg.sender, spender, value);
    return true;
  }
  function revoke(address spender) public returns (bool) {
    allowances[msg.sender][spender] = 0;
    emit Approval(msg.sender, spender, 0);
    return true;
  }
}
`, 'approve');
    const approve = artifact.messageBus?.handlers.find((handler) => handler.name === 'approve');
    expect(approve?.eligible).toBe(true);
    expect(approve?.outputs?.some((output) => output.type.includes('bool'))).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'revoke')?.eligible).toBe(true);
  });

  it('pools an explicit read-only mapping result wrapper with sibling writers', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
struct Record { uint256 stable; uint256 phase; string tail; }
contract Store {
  mapping(uint256 => Record) private records;
  function mutate(uint256 key, uint256 phase) public { records[key].phase = phase; }
  function read(uint256 key) public view returns (Record memory) { return records[key]; }
  function finish(uint256 key, uint256 phase) public { records[key].phase = phase; }
}
`, 'read');
    expect(artifact.invocationAnalysis?.functions.some((fn) => fn.name === '__message_bus_entry_read'))
      .toBe(true);
  });

  it('journals an expression-keyed mapping write on the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Ledger() {
  mapping(int => int) slots;
  int next;
  function push(int n) public {
    this.slots[this.next] = n;
    this.next = this.next + 1;
    require(true);
  }
}
`, 'push');
  });

  it('journals an expression-keyed parameter-array mapping loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Ledger() {
  mapping(int => mapping(bytes20 => int)) seen;
  int[] records;
  function create(bytes20[] keys, int[] values) public {
    this.records.push(0);
    int id = this.records.length - 1;
    for (int i = 0; i < int(keys.length); i = i + 1) {
      this.seen[id][keys[i]] = values[i];
    }
    require(true);
  }
}
`, 'create');
    const create = artifact.messageBus?.handlers.find((handler) => handler.name === 'create');
    expect(create?.batchKeyWitnesses).toBeUndefined();
    expect(artifact.abi.find((fn) => fn.name === 'create')?.sortedUpsertLoopInfo).toContainEqual(
      expect.objectContaining({
        collection: 'seen',
        varyingArrayParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
        varyingKeyExpressions: expect.any(Array),
        valueArrayParam: 'values',
        valueArrayIndexParam: expect.stringMatching(/^__internal__vmapCounterPerm_/),
      }),
    );
  });

  it('dispatches an IERC20-shaped external call from the runtime row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
interface IERC20 { function transfer(address to, int amount) returns (bool); }
contract Mixed() {
  int last;
  function ping() public { this.last = this.last + 1; require(this.last > 0); }
  function pay(IERC20 token, address to, int amount) public {
    require(token.transfer(to, amount));
  }
}
`, 'pay');
    expect(artifact.invocationAnalysis?.functions.some((fn) => fn.name === '__message_bus_handler_pay'
      || fn.name === 'pay')).toBe(true);
    expect(artifact.abi.some((fn) => fn.name === '__message_bus_graph_pay')).toBe(false);
    const ping = artifact.messageBus?.handlers.find((handler) => handler.name === 'ping');
    expect(ping?.eligible).toBe(true);
  });

  it('journals a literal local key array after unrolling it to a scalar write', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Ledger() {
  mapping(int => mapping(bytes20 => int)) seen;
  bytes20 member;
  function revoke(int id) public {
    bytes20[] xs = new bytes20[](1);
    xs[0] = this.member;
    for (int i = 0; i < xs.length; i = i + 1) {
      this.seen[id][xs[i]] = 0;
    }
    require(true);
  }
}
`, 'revoke');
  });

  it('dispatches a satoshi transfer from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Pay() {
  function pay(bytes recipient, int amount) public {
    this.transfer(recipient, amount);
    require(true);
  }
}
`, 'pay');
  });

  it('dispatches Solidity address.transfer from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract Pay {
  function denied(address payable to) public { to.transfer(1); require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    const slots = artifact.messageBus?.route.blockLayout?.slots ?? [];
    expect(slots.some((slot) => slot.kind === 'satoshiContainer')).toBe(true);
    expect(slots.some((slot) => slot.kind === 'transfer')).toBe(true);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('dispatches Solidity address.send from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract Pay {
  function denied(address payable to) public { require(to.send(1)); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    const slots = artifact.messageBus?.route.blockLayout?.slots ?? [];
    expect(slots.some((slot) => slot.kind === 'satoshiContainer')).toBe(true);
    expect(slots.some((slot) => slot.kind === 'transfer')).toBe(true);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('dispatches if/else this.transfer from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Pay() {
  function denied(bool p, bytes a, bytes b) public {
    if (p) this.transfer(a, 1); else this.transfer(b, 1);
    require(true);
  }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('dispatches if/else address.transfer from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract Pay {
  function denied(bool p, address payable a, address payable b) public {
    if (p) a.transfer(1); else b.transfer(1);
    require(true);
  }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('dispatches address.transfer from an internal helper on the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract Pay {
  function _pay(address payable to) internal { to.transfer(1); }
  function denied(address payable to) public { _pay(to); require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('journals a UDVT wrap as an expression-keyed mapping write on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
type TokenId is bytes32;
contract Ledger() {
  mapping(TokenId => int) m;
  function denied(bytes32 raw) public {
    TokenId id = TokenId.wrap(raw);
    this.m[id] = 1;
    require(TokenId.unwrap(id).length == 32);
  }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('dispatches a typed call with a struct-array argument from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
struct Rec { uint x; address y; }
interface I { function r(Rec[] memory xs) external; }
contract C {
  address dest;
  function denied(Rec[] memory xs) public { I(dest).r(xs); require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('dispatches a library-wrapped IERC20 transfer from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
interface IERC20 { function transfer(address to, uint amt) external returns (bool); }
library SafeTransfer {
  function send(IERC20 token, address to, uint amt) internal { require(token.transfer(to, amt)); }
}
contract C {
  using SafeTransfer for IERC20;
  address token;
  function denied(address to, uint amt) public { IERC20(token).send(to, amt); require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('dispatches a counter-keyed mapping loop that also makes a typed call from the row loop', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
interface I { function r(int i); }
contract Slots() {
  mapping(int => int) m;
  address dest;
  function denied(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = 1;
      I(this.dest).r(i);
    }
    require(true);
  }
  function control() public { require(true); }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('dispatches using-for Address.sendValue from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
library Address {
  function sendValue(address payable to, uint amt) internal { to.transfer(amt); }
}
contract C {
  using Address for address payable;
  function denied(address payable to) public { to.sendValue(uint(1)); require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('dispatches a library Address.sendValue from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
library Address {
  function sendValue(address payable to, uint amt) internal { to.transfer(amt); }
}
contract C {
  function denied(address payable to, uint amt) public { Address.sendValue(to, amt); require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('captures a returning UDVT inside the same loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
type TokenId is bytes32;
contract Ledger() {
  TokenId last;
  function denied() public returns (TokenId) { return this.last; }
  function control() public { require(true); }
}
`, 'denied');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('journals a counter-keyed mapping delete loop on the row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Slots() {
  mapping(int => int) m;
  function denied(int n) public {
    for (int i = 0; i < n; i = i + 1) { delete this.m[i]; }
    require(true);
  }
  function control() public { require(true); }
}
`, 'denied');
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
  });

  it('routes two fixed-width scalar mutation streams in one counter-loop execution group', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
contract Slots() {
  mapping(int => int) a;
  mapping(int => int) b;
  function denied(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.a[i] = 1; this.b[i] = 2; }
    require(true);
  }
  function control() public { require(true); }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name === '__internal__kernelJournalAccessStreams')).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('journals a do-while counter-keyed mapping loop on the row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Slots() {
  mapping(int => int) m;
  function denied(int n) public {
    int i = 0;
    do { this.m[i] = 1; i = i + 1; } while (i < n);
    require(true);
  }
  function control() public { require(true); }
}
`, 'denied');
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_') && input.name.endsWith('_post'))).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('dispatches a do-while counter-keyed mapping loop with a typed call from the row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
interface I { function r(int i); }
contract Slots() {
  mapping(int => int) m;
  address dest;
  function denied(int n) public {
    int i = 0;
    do { this.m[i] = 1; I(this.dest).r(i); i = i + 1; } while (i < n);
    require(true);
  }
  function control() public { require(true); }
}
`, 'denied');
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_') && input.name.endsWith('_post'))).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('journals fallback that wraps a UDVT mapping key on the row loop', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
type TokenId is bytes32;
contract C() {
  mapping(TokenId => int) hits;
  fallback(bytes input) external {
    this.hits[TokenId.wrap(bytes32(input))] = 1;
    require(true);
  }
  function control() public { require(true); }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === '__fallback')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('journals a fixed-point mapping value write on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Ledger() {
  mapping(int => fixed128x18) m;
  function denied(int k, fixed128x18 v) public { this.m[k] = v; require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('journals a ufixed mapping value write on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Ledger() {
  mapping(int => ufixed128x18) m;
  function denied(int k, ufixed128x18 v) public { this.m[k] = v; require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('journals a pubkey mapping value write on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Keys() {
  mapping(bytes20 => pubkey) m;
  function denied(bytes20 k, pubkey pk) public { this.m[k] = pk; require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('journals an invariant-key mapping write inside a while-true break loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Slots() {
  mapping(int => int) m;
  function denied(int k) public {
    int i = 0;
    while (true) { this.m[k] = i; break; }
    require(true);
  }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('dispatches owner-frame delegate handlers from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
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
pragma solidcash ^0.14.0;
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

  it('journals a counter-keyed mapping loop from the runtime row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Slots() {
  mapping(int => int) slots;
  function fill(int n) public {
    for (int i = 0; i < n; i = i + 1) { this.slots[i] = 1; }
    require(true);
  }
}
`, 'fill');
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name.startsWith('__internal__vmapCounterPerm_'))).toBe(true);
  });

  it('journals nested msg.sender and getter argument keys without _rN', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Registry() {
  mapping(int => mapping(address => int)) permissions;
  function consume(int id) public {
    require(this.permissions[id][msg.sender] == 1);
    this.permissions[id][msg.sender] = 0;
    require(true);
  }
  function peek(int id, address who) public {
    require(this.permissions[id][who] == 1 || this.permissions[id][who] == 0);
  }
}
`, 'consume');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'peek')).toMatchObject({
      eligible: true,
    });
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
    expect(artifact.abi.some((fn) => fn.name === '__message_bus_resource_consume')).toBe(false);
  });

  it('keeps a scalar pause handler beside a collection sibling on the row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Governed() {
  address owner;
  bool paused;
  mapping(address => int) balances;
  constructor() { this.owner = msg.sender; }
  function pause() public {
    require(msg.sender == this.owner);
    this.paused = true;
    require(this.paused);
  }
  function credit(address who, int n) public {
    this.balances[who] = this.balances[who] + n;
    require(true);
  }
}
`, 'pause');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'credit')).toMatchObject({
      eligible: true,
    });
  });

  it('journals ERC-20 transferFrom from/to as two row-arg slots on the loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Token() {
  mapping(address => int) balances;
  mapping(address => mapping(address => int)) allowances;
  function transferFrom(address from, address to, int value) public returns (bool) {
    int allowed = this.allowances[from][msg.sender];
    require(allowed >= value);
    this.allowances[from][msg.sender] = allowed - value;
    this.balances[from] = this.balances[from] - value;
    this.balances[to] = this.balances[to] + value;
    return true;
  }
}
`, 'transferFrom');
    expect(artifact.messageBus?.maximumRows).toBeGreaterThan(2);
    expect(artifact.abi.some((fn) => fn.name.startsWith('__message_bus_resource_'))).toBe(false);
    expect(artifact.messageBus?.route.inputs.some((input) =>
      input.name === '__message_bus_key_balances_0_row' || input.name.endsWith('_row'))).toBe(true);
  });

  it('journals a public mapping getter as a parameter-keyed read on the row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract Registry {
  mapping(uint => mapping(address => bool)) public permissions;
  function consume(uint id) public {
    require(permissions[id][msg.sender]);
    permissions[id][msg.sender] = false;
    require(true);
  }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'consume')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'permissions')?.eligible)
      .toBe(true);
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('journals a returning nested mapping read on the row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Registry() {
  mapping(int => mapping(address => int)) permissions;
  function lookup(int id, address who) public returns (int) {
    return this.permissions[id][who];
  }
}
`, 'lookup');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'lookup')?.outputs
      ?.some((output) => output.type.includes('int'))).toBe(true);
  });

  it('indexes ecrecover sidecars by live row instead of pinning maximumRows to 1', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract Auth {
  address last;
  function ping(bytes32 hash, uint8 v, bytes32 r, bytes32 s) public {
    last = ecrecover(hash, v, r, s);
    require(last != address(0));
  }
}
`, { ...OPTIONS, evmCompat: true, ecrecover: 'p2pkh' });
    const ping = artifact.messageBus?.handlers.find((handler) => handler.name === 'ping');
    expect(ping?.eligible).toBe(true);
    expect(artifact.messageBus?.maximumRows).toBeGreaterThan(1);
    const sidecars = artifact.messageBus?.route.blockLayout?.slots
      .filter((slot) => slot.kind === 'ecrecoverSideCar') ?? [];
    expect(sidecars.map((slot) => slot.slotIndex)).toEqual([0, 1, 2]);
    expect(sidecars.length).toBeLessThan(3 * (artifact.messageBus?.maximumRows ?? 0));
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('dispatches a complete fixed-array identity set from the runtime row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Acc() {
  int[4] scores;
  function bump() public {
    for (int i = 0; i < 4; i = i + 1) { this.scores[i] = this.scores[i] + 1; }
    require(true);
  }
}
`, 'bump');
    expect(artifact.messageBus?.maximumRows).toBeGreaterThan(1);
  });

  it('journals a mapping read with a typed interface call on the row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
interface IRegistry { function contains(address who) returns (bool); }
contract Gateway() {
  mapping(int => mapping(address => bool)) permissions;
  IRegistry registry;
  function check(int id, address who) public {
    require(this.permissions[id][msg.sender] || this.registry.contains(who));
    require(true);
  }
}
`, 'check');
    expect(artifact.abi.some((fn) => fn.name.startsWith('__message_bus_graph_'))).toBe(false);
    expect(artifact.invocationAnalysis?.functions.some((fn) =>
      fn.name === '__message_bus_entry_check' || fn.name === '__message_bus_handler_check')).toBe(true);
  });

  it('journals a mapping write with an IERC20-shaped call on the row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
interface IERC20 { function transfer(address to, int amount) returns (bool); }
contract Gateway() {
  mapping(int => mapping(address => bool)) permissions;
  function consume(int id, IERC20 token, address to, int amount) public {
    require(this.permissions[id][msg.sender]);
    this.permissions[id][msg.sender] = false;
    require(token.transfer(to, amount));
  }
}
`, 'consume');
    expect(artifact.abi.some((fn) => fn.name.startsWith('__message_bus_graph_'))).toBe(false);
  });

  it('journals an expression-keyed second mapping alternative on the row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Token() {
  mapping(address => int) balances;
  address sink;
  function move(address from, int value) public {
    this.balances[from] = this.balances[from] - value;
    this.balances[this.sink] = this.balances[this.sink] + value;
    require(true);
  }
}
`, 'move');
    expect(artifact.abi.some((fn) => fn.name.startsWith('__message_bus_resource_'))).toBe(false);
  });

  it('journals a mapping struct field write as a whole-entry update on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  struct Record { int value; }
  mapping(int => Record) records;
  function set(int key) public {
    this.records[key].value = 1;
    require(this.records[key].value == 1);
  }
}
`, 'set');
  });

  it('compiles an Address-style never-return helper used by a typed call on the row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
library Address {
  function _revert() private pure {
    assembly { revert(0, 0) }
  }
  function verify(bool success, bytes memory data) internal pure returns (bytes memory) {
    if (success) { return data; }
    _revert();
  }
}
interface IERC20 { function transfer(address to, uint256 amount) external returns (bool); }
contract Pay {
  function pay(IERC20 token, address to, uint256 amount) public {
    bytes memory ret = Address.verify(true, hex"");
    require(token.transfer(to, amount) || ret.length == 0);
  }
}
`, { ...OPTIONS, evmCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')?.eligible).toBe(true);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('journals a helper-owned permission loop after unrolling the literal key array', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Ledger() {
  mapping(int => mapping(bytes20 => int)) seen;
  bytes20 member;
  function _update(int id, bytes20[] enabled, bytes20[] disabled) internal {
    for (int i = 0; i < int(enabled.length); i = i + 1) {
      this.seen[id][enabled[i]] = 1;
    }
    for (int j = 0; j < int(disabled.length); j = j + 1) {
      this.seen[id][disabled[j]] = 0;
    }
  }
  function revoke(int id) public {
    bytes20[] xs = new bytes20[](1);
    xs[0] = this.member;
    _update(id, new bytes20[](0), xs);
    require(true);
  }
}
`, 'revoke');
  });

  it('journals a helper-owned expression key nested in a branch with a typed call', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
interface ISettlement { function release(uint id) external; }
interface IObserver { function record(address who) external; }
struct Record { uint8 state; address owner; uint resourceId; bool flagged; }
contract Registry {
  Record[] public records;
  mapping(uint => mapping(address => bool)) public permissions;
  address settlementAddress;
  IObserver observer;
  function _update(uint id, address[] memory enabled, address[] memory disabled) internal {
    for (uint i = 0; i < enabled.length; i++) { permissions[id][enabled[i]] = true; }
    for (uint j = 0; j < disabled.length; j++) { permissions[id][disabled[j]] = false; }
  }
  function _release(uint recordId, bool notifyOwner) internal {
    Record storage item = records[recordId];
    require(item.state == 1);
    item.flagged = false;
    ISettlement(settlementAddress).release(item.resourceId);
    item.state = 0;
    item.resourceId = 0;
    if (notifyOwner) {
      observer.record(item.owner);
      address[] memory xs = new address[](1);
      xs[0] = item.owner;
      _update(recordId, new address[](0), xs);
    }
    item.owner = address(0);
  }
  function release(uint recordId) public { _release(recordId, true); }
}
`, { ...OPTIONS, evmCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'release')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('constructs locking bytecode from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Pay() {
  function ping(bytes20 pkh) public {
    bytes lb = new LockingBytecodeP2PKH(pkh);
    require(lb.length == 25);
  }
}
`, 'ping');
  });

  it('dispatches a typed call and an event from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
interface IUnicrow { function refund(uint id) external; }
contract C {
  event Refunded(uint id);
  address unicrowAddress;
  function refund(uint id) public {
    IUnicrow(unicrowAddress).refund(id);
    emit Refunded(id);
    require(true);
  }
}
`, { ...OPTIONS, evmCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'refund')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('dispatches a token-container NFT transfer from the runtime row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
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

  it('journals a mapping-of-fixed-array element write on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  mapping(int => int[2]) slots;
  function denied(int k, int v) public { this.slots[k][0] = v; require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('journals a mapping-of-fixed-array element read on the row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  mapping(int => int[2]) slots;
  function denied(int k) public returns (int) { return this.slots[k][0]; }
  function control() public { require(true); }
}
`, 'denied');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.outputs
      ?.some((output) => output.type.includes('int'))).toBe(true);
  });

  it('journals a mapping-of-array push on the row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
struct Rec { uint x; }
contract C {
  mapping(uint => Rec[]) public items;
  function denied(uint k, uint x) public { items[k].push(Rec(x)); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
  });

  it('keeps a non-emitting sibling on an event-shaped kernel route', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract C {
  event E(uint x);
  function denied(uint x) public { emit E(x); require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('dispatches heterogeneous event widths from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract C {
  event E(uint x);
  event F(uint y);
  function denied(uint x) public { emit E(x); emit F(x); require(true); }
  function ping(uint x) public { emit E(x); require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'ping')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    const asm = routeAsm(artifact);
    expect(asm).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('dispatches two satoshi transfers from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Pay() {
  function denied(bytes a, bytes b) public {
    this.transfer(a, 1);
    this.transfer(b, 1);
    require(true);
  }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('dispatches a typed call with value from the runtime row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
interface I { function r(); }
contract C() {
  address a;
  function denied() public { I(this.a).r{value: 1}(); require(true); }
  function control() public { require(true); }
}
`, 'denied');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('dispatches a token-container transfer without a prior tokenAmount read', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract Vault() {
  function denied(bytes32 category, bytes recipient, int amount) public {
    this.tokens[category].transfer(recipient, amount);
    require(true);
  }
}
`, 'denied');
  });

  it('dispatches blockhash from the runtime row loop', () => {
    const artifact = assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  bytes32 last;
  function denied(int n) public { this.last = blockhash(n); require(true); }
  function control() public { require(true); }
}
`, 'denied');
    expect(artifact.usesBlockhash).toBe(true);
  });

  it('journals a packed array write on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  int[] packed scores;
  function denied(int x) public { this.scores.push(x); require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('journals a nested dynamic array write on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  int[][] nested;
  function denied(int x) public {
    this.nested.push();
    this.nested[0].push(x);
    require(true);
  }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('journals a returning dynamic-array resize without a typed call', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
struct Record { uint8 state; }
contract C {
  Record[] public records;
  function denied() public returns (uint) {
    records.push();
    uint id = records.length - 1;
    records[id].state = 1;
    return id;
  }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
  });

  it('reads this.activeBytecode from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  function denied() public { require(this.activeBytecode.length > 0); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('constructs LockingBytecodeNullData from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  function denied(bytes a, bytes b) public {
    bytes lb = new LockingBytecodeNullData([a, b]);
    require(lb.length >= 1);
  }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('dispatches two token-container categories from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  function denied(bytes32 c1, bytes32 c2, bytes to, int amt) public {
    this.tokens[c1].transfer(to, amt);
    this.tokens[c2].transfer(to, amt);
    require(true);
  }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('journals a mapping-of-struct-array field write on the row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
struct Rec { uint x; }
contract C {
  mapping(uint => Rec[]) public items;
  function denied(uint k, uint i, uint x) public { items[k][i].x = x; require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
  });

  it('journals a mapping-of-fixed-struct-array field write on the row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
struct Rec { uint x; address y; }
contract C {
  mapping(uint => Rec[2]) public items;
  function denied(uint k, uint x) public { items[k][0].x = x; require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
  });

  it('journals a mapping write that also reads blockhash on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  mapping(int => bytes32) m;
  function denied(int n) public { this.m[n] = blockhash(n); require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('dispatches a native typed .call from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
interface I { function r(); }
contract C() {
  bytes32 cat;
  function denied() public { I(this.cat).r.call(); require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('dispatches a native typed .staticcall from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
interface I { function r() returns (int); }
contract C() {
  bytes32 cat;
  int last;
  function denied() public { this.last = I(this.cat).r.staticcall(); require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('iterates an enumerable mapping on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  enumerable mapping(bytes20 => int) m;
  function denied() public { for (int v of this.m) { require(v >= 0); } }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('dispatches a try/catch around a typed call from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
interface I { function r(uint id) external; }
contract C {
  address a;
  function denied(uint id) public { try I(a).r(id) {} catch {} require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true, maximumInputBytes: 1_000_000 });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
  });

  it('journals a public dynamic-array getter on the row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract C {
  uint[] public items;
  function denied(uint x) public { items.push(x); require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'items')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
  });

  it('journals a nested counter-keyed mapping write on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  mapping(int => mapping(int => int)) m;
  function denied(int k, int n) public {
    for (int i = 0; i < n; i = i + 1) { this.m[k][i] = 1; }
    require(true);
  }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('captures a returning enum encoded as int on the row loop', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
enum Status { A, B }
contract C() {
  Status st;
  function denied() public returns (Status) { return this.st; }
  function control() public { require(true); }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('captures an enum in the middle of a mixed multi-return handler', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
contract C() {
  enum Phase { Pending, Ready }
  function inspect(uint count, bool active) public returns (uint, Phase, bool) {
    return (count, Phase.Ready, active);
  }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'inspect')).toMatchObject({
      eligible: true,
      outputs: [{ type: 'uint256' }, { type: 'Phase' }, { type: 'bool' }],
    });
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('captures a public struct getter as its Solidity field tuple on the kernel route', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
struct Rec { uint x; address y; }
contract C {
  Rec public rec;
  function denied(uint x) public { rec.x = x; require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'rec')).toMatchObject({
      eligible: true,
      outputs: [{ type: 'uint256' }, { type: 'address' }],
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('captures an enum-bearing public struct getter without changing its ABI outputs', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract C {
  enum Phase { Pending, Ready }
  struct Record { Phase phase; uint count; }
  Record public record;
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'record')).toMatchObject({
      eligible: true,
      outputs: [{ type: 'Phase' }, { type: 'uint256' }],
    });
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('captures an enum-bearing public mapping-to-struct getter', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract C {
  enum Phase { Pending, Ready }
  struct Record { Phase phase; uint count; }
  mapping(uint => Record) public records;
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'records')).toMatchObject({
      eligible: true,
      inputs: [{ name: '__getterKey1', type: 'uint256' }],
      outputs: [{ type: 'Phase' }, { type: 'uint256' }],
    });
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('journals a SolidCash dynamic-array element delete on the row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
contract C() {
  int[] items;
  function denied(int i) public { delete this.items[i]; require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('publishes fallback and receive on the kernel route', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
contract C() {
  int x;
  fallback(bytes input) external { this.x = 1; require(true); }
  receive() external payable { require(true); }
  function control() public { require(true); }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === '__fallback')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === '__receive')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('dispatches a one-argument typed .call from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
interface I { function r(int n); }
contract C() {
  bytes32 cat;
  function denied(int n) public { I(this.cat).r.call(n); require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('dispatches a one-argument typed .staticcall statement from the runtime row loop', () => {
    assertKernelRoute(`
pragma solidcash ^0.14.0;
interface I { function r(int n) returns (int); }
contract C() {
  bytes32 cat;
  function denied(int n) public { I(this.cat).r.staticcall(n); require(true); }
  function control() public { require(true); }
}
`, 'denied');
  });

  it('dispatches receive with msg.value from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract C {
  uint last;
  receive() external payable { last = msg.value; require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === '__receive')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
  });

  it('dispatches receive with a satoshi transfer from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
contract C() {
  receive() external payable { this.transfer(msg.sender, 1); require(true); }
  function control() public { require(true); }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === '__receive')).toMatchObject({
      eligible: true,
      transfers: [{
        recipient: { kind: 'msgSender' },
        recipientRecipe: { kind: 'logicalCaller', resultType: 'address' },
      }],
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
  });

  it('dispatches a caller-directed BCH effect beside a graph emission', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
interface I { function next(); }
contract C(address child) {
  function refundAndCall() public {
    this.transfer(msg.sender, 1);
    I(child).next();
    require(true);
  }
  function control() public { require(true); }
}
    `, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'refundAndCall'))
      .toMatchObject({
        eligible: true,
        transfers: [{ recipientRecipe: { kind: 'logicalCaller', resultType: 'address' } }],
      });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
  });

  it('dispatches fallback with a typed call from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
interface I { function r(); }
contract C() {
  address dest;
  fallback(bytes input) external { I(this.dest).r(); require(true); }
  function control() public { require(true); }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === '__fallback')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
  });

  it('dispatches fallback that writes a mapping and makes a typed call from the runtime row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
interface I { function r() external; }
contract C {
  address dest;
  mapping(bytes4 => uint) hits;
  fallback() external { hits[msg.sig] = 1; I(dest).r(); require(true); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === '__fallback')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'hits')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(routeAsm(artifact)).toMatch(/OP_UNTIL|OP_BEGIN/);
  });

  it('journals a modifier that keys and writes the same mapping on the row loop', () => {
    const artifact = compileString(`
pragma solidity ^0.8.0;
contract C {
  mapping(uint => address) ownerOf;
  modifier onlyOwner(uint id) { require(msg.sender == ownerOf[id]); _; }
  function denied(uint id, uint n) public onlyOwner(id) { ownerOf[id] = msg.sender; require(n >= 0); }
  function control() public { require(true); }
}
`, { ...OPTIONS, evmCompat: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
    expect(artifact.messageBus?.route.inputs.some((input) => /_r\d+$/.test(input.name))).toBe(false);
  });

  it('keeps a non-normalized void recursive mapping continuation off the kernel route as KERNEL_LAYOUT', () => {
    const artifact = compileString(`
pragma solidcash ^0.14.0;
contract C() {
  mapping(int => int) m;
  function denied(int n) public {
    if (n > 0) { denied(n - 1); }
    this.m[n] = n;
    require(true);
  }
  function control() public { require(true); }
}
`, OPTIONS);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'denied')).toMatchObject({
      eligible: false,
      rejectionReason: 'KERNEL_LAYOUT',
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'control')?.eligible).toBe(true);
    expect(artifact.abi.some((fn) => clonePrefix.test(fn.name))).toBe(false);
  });
});
