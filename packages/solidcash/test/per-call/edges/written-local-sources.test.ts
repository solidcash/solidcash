import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { hash160 } from '@solidcash/utils';
import type { ExternalCallAbi, ExternalCallExpression } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import {
  entryRowOf, makeCallResolver, resolveCallArguments,
} from '../../../src/per-call/proxy/call-resolution.js';

/**
 * A local the body writes after its declaration, read by a published value or argument source (Solidity-compatible).
 *
 * Element writes to a `memory` struct local are rebuilds of the whole local (CoalesceStructFieldArrayWrites), and an
 * array local is written element by element; either may run on one arm of a branch. A call argument that reads such
 * a local is published from the writes, evaluated here through the hop's own call resolver, and a mapping write's
 * value that reads one is not published, so the hop learns it from the body's close instead of stating the value
 * the local was declared with.
 */

const SOURCE = `pragma solidity ^0.8.0;
struct Terms { address owner; uint16 flag; uint16[4] shares; int16[2] marks; uint256 amount; string note; }
struct Roles { address first; address second; }
interface ISink { function log(uint256 id, bytes calldata who) external; }
interface ILedger {
  function termsOf(uint256 id) external view returns (Terms memory);
  function put(uint256 id, uint16[4] calldata s, int16[2] calldata m) external;
}
function magnitude(int16 x) pure returns (int16) { return x >= 0 ? x : -x; }
uint8 constant FIRST = 0;
uint8 constant SECOND = 1;
contract Ledger {
  mapping(uint256 => Terms) terms;
  function termsOf(uint256 id) external view returns (Terms memory) { return terms[id]; }
  function close(uint256 id) external {
    Terms memory t = terms[id];
    require(t.flag == 0, "closed");
    t.shares[0] = 10000; t.shares[1] = 0; t.shares[2] = 0; t.shares[3] = 0;
    t.marks[0] = magnitude(t.marks[0]) + 1;
    t.marks[1] = magnitude(t.marks[1]);
    terms[id].shares = t.shares;
    terms[id].marks = t.marks;
    terms[id].flag = 1;
  }
  function confirm(uint256 id) external {
    Terms memory t = terms[id];
    t.marks[0] = magnitude(t.marks[0]) + 1;
    t.marks[1] = magnitude(t.marks[1]);
    terms[id].marks = t.marks;
  }
  function put(uint256 id, uint16[4] calldata s, int16[2] calldata m) external {
    terms[id].shares = s;
    terms[id].marks = m;
  }
}
contract Arbiter {
  address ledger;
  function contest(uint256 id) external {
    address sender = msg.sender;
    Terms memory t = ILedger(ledger).termsOf(id);
    if (sender == t.owner) {
      t.shares[0] = 10000; t.shares[1] = 0;
      t.marks[0] = magnitude(t.marks[0]) + 1;
      t.marks[1] = -(magnitude(t.marks[1]));
    } else if (sender == address(this)) {
      t.shares[1] = 10000; t.shares[0] = 0;
      t.marks[0] = -(magnitude(t.marks[0]));
      t.marks[1] = magnitude(t.marks[1]) + 1;
    }
    ILedger(ledger).put(id, t.shares, t.marks);
  }
  function settle(uint256 id, uint16[2] calldata parts) external {
    Terms memory t = ILedger(ledger).termsOf(id);
    t.marks[0] = magnitude(t.marks[0]) + 1;
    t.marks[1] = magnitude(t.marks[1]);
    t.shares[FIRST] = parts[FIRST];
    t.shares[SECOND] = parts[SECOND];
    ILedger(ledger).put(id, t.shares, t.marks);
  }
}
contract Root {
  address sink;
  Roles roles;
  mapping(uint256 => mapping(address => bool)) listed;
  function drop(uint256 id, address[] memory gone) internal {
    for (uint256 i = 0; i < gone.length; i++) {
      listed[id][gone[i]] = false;
      ISink(sink).log(id, abi.encodePacked(gone[i]));
    }
  }
  function release(uint256 id) external {
    address[] memory gone = new address[](1);
    gone[0] = roles.second;
    drop(id, gone);
  }
  function note(uint256 id, address to) external {
    if (roles.first != msg.sender) { to = roles.first; }
    ISink(sink).log(id, abi.encodePacked(to));
  }
}
`;

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call', solidityImportCompat: true } as never);

const USER = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x21));
const OTHER = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x43));
const SELF = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x65), 0x87);
const SINK = {
  ...artifacts.Root!,
  abi: [{ name: 'log', selector: 'a1b2c3d4', inputs: [{ name: 'id', type: 'uint256' }, { name: 'who', type: 'bytes' }] }],
} as never;
/** An address as a Solidity-compatible result carries it: the hash a P2PKH lock names, or HASH160 of the lock. */
const identityOf = (lock: Uint8Array): Uint8Array => (lock.length === 25 ? lock.slice(3, 23) : hash160(lock));

/** The producer result node an argument source reads, which the hop keys an earlier call's result by. */
function producerOf(expression: unknown): ExternalCallExpression | undefined {
  if (expression === null || typeof expression !== 'object') return undefined;
  const node = expression as ExternalCallExpression;
  if (node.kind === 'producerResult') return node;
  for (const child of Object.values(node)) {
    const found = Array.isArray(child) ? child.map(producerOf).find(Boolean) : producerOf(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The arguments the hop states for one published call, the earlier `termsOf` result handed over as `terms`. */
function argumentsOf(
  contract: string, entry: string, callsiteId: number, args: readonly FunctionArgument[],
  options: { sender?: Uint8Array; terms?: FunctionArgument; state?: Record<string, unknown> } = {},
): readonly FunctionArgument[] {
  const artifact = artifacts[contract]!;
  const row = artifact.abi.find((candidate) => candidate.name === entry)!.externalCalls!
    .find((call) => call.callsiteId === callsiteId) as ExternalCallAbi;
  const producer = producerOf(row.argSources);
  const resolver = makeCallResolver({
    artifact, functionName: entry, args, stateValues: options.state ?? {},
    selfAddress: SELF, senderAddress: options.sender ?? USER,
    ...(producer === undefined || options.terms === undefined
      ? {} : { argumentReturns: new Map([[JSON.stringify(producer), options.terms]]) }),
  });
  // `ISink` is an interface: its entry is stated as the call names it.
  const callee = row.functionName === 'log' ? SINK : artifacts.Ledger!;
  return resolveCallArguments(row, callee, entryRowOf(callee, row.functionName), resolver, 0).values;
}

/** Terms as `termsOf` returns them to a Solidity-compatible caller: the owner is the 20-byte identity. */
const termsOf = (owner: Uint8Array): FunctionArgument => [
  identityOf(owner), 0n, [0n, 10000n, 1931n, 69n], [-2n, 3n], 100n, 'note',
] as unknown as FunctionArgument;

describe('a local written after its declaration, read by a published source', () => {
  it('publishes a struct local rebuilt on one arm of a branch from that arm, joined on the predicate', () => {
    const asOwner = argumentsOf('Arbiter', 'contest', 1, [7n], { sender: USER, terms: termsOf(USER) });
    expect(asOwner[1]).toEqual([10000n, 0n, 1931n, 69n]);
    expect(asOwner[2]).toEqual([3n, -3n]);
    const asSelf = argumentsOf('Arbiter', 'contest', 1, [7n], { sender: SELF, terms: termsOf(USER) });
    expect(asSelf[1]).toEqual([0n, 10000n, 1931n, 69n]);
    expect(asSelf[2]).toEqual([-2n, 4n]);
    const asOther = argumentsOf('Arbiter', 'contest', 1, [7n], { sender: OTHER, terms: termsOf(USER) });
    expect(asOther[1]).toEqual([0n, 10000n, 1931n, 69n]);
    expect(asOther[2]).toEqual([-2n, 3n]);
  });

  it('publishes element writes to a struct local from an argument and the local itself, at named indices', () => {
    const settled = argumentsOf('Arbiter', 'settle', 1, [7n, [8000n, 2000n]], { terms: termsOf(USER) });
    expect(settled[1]).toEqual([8000n, 2000n, 1931n, 69n]);
    expect(settled[2]).toEqual([3n, 3n]);
  });

  it('publishes an array local written element by element as the element it holds, packed as an address', () => {
    const second = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x57));
    const logged = argumentsOf('Root', 'release', 0, [7n], { state: { roles: { first: USER, second }, sink: SELF } });
    expect(logged[1]).toEqual(identityOf(second));
  });

  it('publishes a parameter rewritten on one arm as the join of both, packed as the address it is declared', () => {
    const state = { roles: { first: USER, second: OTHER }, sink: SELF };
    expect(argumentsOf('Root', 'note', 0, [7n, OTHER], { sender: USER, state })[1]).toEqual(identityOf(OTHER));
    expect(argumentsOf('Root', 'note', 0, [7n, OTHER], { sender: OTHER, state })[1]).toEqual(identityOf(USER));
  });

  it('publishes no value source for a mapping write that reads a rewritten local, and keeps a parameter one', () => {
    const sourceOf = (entry: string): string | undefined => artifacts.Ledger!.abi
      .find((candidate) => candidate.name === entry)!.entryAccesses!
      .find((access) => access.collection === 'terms')!.valueSource;
    expect(sourceOf('close')).toBeUndefined();
    expect(sourceOf('confirm')).toBeUndefined();
    expect(sourceOf('put')).toMatch(/id:s[,)]/);
    expect(sourceOf('put')).toMatch(/id:m[,)]/);
  });
});
