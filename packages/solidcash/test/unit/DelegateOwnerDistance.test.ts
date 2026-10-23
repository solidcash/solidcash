import {
  decodeAuthenticationInstructions, hexToBin, OpcodesBCH as Op, vmNumberToBigInt,
} from '@bitauth/libauth';
import type { AbiFunction, Artifact } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { getContractFactory, upgrades } from '../../src/stateful/index.js';
import { defaultProxyDelegateDistances } from '../../src/stateful/upgrades.js';
import { alicePriv } from '../fixture/vars.js';
import { addProvenUtxo, createTestProvider } from '../test-util.js';

/**
 * The default proxy's forward pins its delegate at `OP_INPUTINDEX + distance`, the distance picked by the forwarded
 * selector: `__proxyRouteBlockSize` for SCB1 and `__proxyBlockSize` (1 + dataNftCount) otherwise. Each delegate entry
 * derives the proxy master it acts on from its own input index. For every entry the forward can reach, the prologue
 * must admit exactly the distance the forward pins for that entry's selector: a second admitted distance would let
 * the witness name another master than the forwarding proxy.
 */
const PROXY_MASTER = '__internal__proxyMasterIndex';
const ROUTE_SELECTOR = '53434231';

type Instructions = ReturnType<typeof decodeAuthenticationInstructions>;
type Helpers = NonNullable<NonNullable<Artifact['debug']>['invokeDebug']>;

const numberAt = (instruction: Instructions[number] | undefined): bigint | undefined => {
  if (instruction === undefined) return undefined;
  if (instruction.opcode === Op.OP_0) return 0n;
  if (instruction.opcode >= Op.OP_1 && instruction.opcode <= Op.OP_16) {
    return BigInt(instruction.opcode - Op.OP_1 + 1);
  }
  if (!('data' in instruction)) return undefined;
  const decoded = vmNumberToBigInt(instruction.data, { requireMinimalEncoding: false });
  return typeof decoded === 'bigint' ? decoded : undefined;
};

/** The body with every `<id> OP_INVOKE` of a published helper spliced in, so an outlined prologue still reads. */
const expanded = (bytecode: string, helpers: Helpers, depth = 0): Instructions => {
  const decoded = decodeAuthenticationInstructions(hexToBin(bytecode));
  const out: Instructions = [];
  for (let index = 0; index < decoded.length; index += 1) {
    const id = numberAt(decoded[index]);
    const helper = id === undefined ? undefined : helpers[id.toString()];
    if (helper !== undefined && decoded[index + 1]?.opcode === Op.OP_INVOKE && depth < 8) {
      out.push(...expanded(helper.bytecode, helpers, depth + 1));
      index += 1;
    } else {
      out.push(decoded[index]);
    }
  }
  return out;
};

/**
 * The owner distances an entry's prologue admits: each `OP_INPUTINDEX - d` its gate compares the proxy-master
 * witness against, read right after the prologue's `proxy != delegate` check. Undefined when there is no prologue.
 */
const ownerDistances = (instructions: Instructions): bigint[] | undefined => {
  const anchor = instructions.findIndex((instruction, index) => instruction.opcode === Op.OP_VERIFY
    && instructions[index - 1]?.opcode === Op.OP_NUMNOTEQUAL
    && instructions[index - 2]?.opcode === Op.OP_INPUTINDEX
    && instructions[index - 3]?.opcode === Op.OP_DUP);
  if (anchor < 0) return undefined;
  const distances: bigint[] = [];
  for (let at = anchor + 1; at < instructions.length; at += 1) {
    const { opcode } = instructions[at];
    if (opcode === Op.OP_INPUTINDEX && instructions[at + 1]?.opcode === Op.OP_1SUB) distances.push(1n);
    else if (opcode === Op.OP_INPUTINDEX && instructions[at + 2]?.opcode === Op.OP_SUB) {
      distances.push(numberAt(instructions[at + 1]) ?? -1n);
    }
    if (opcode === Op.OP_NUMEQUALVERIFY || opcode === Op.OP_VERIFY) break;
  }
  return distances;
};

interface ForwardableEntry {
  name: string;
  selector: string;
  blockSize: number;
  admitted: bigint[] | undefined;
  pinned: bigint;
}

/** Every entry the default proxy can forward to: the delegate entries by their selector and the route by SCB1. */
const forwardableEntries = (impl: Artifact): ForwardableEntry[] => {
  const [direct, route] = defaultProxyDelegateDistances(impl);
  const helpers = impl.debug?.invokeDebug ?? {};
  const bus = impl.messageBus;
  const routeEntry = bus?.available !== false && bus?.routeInBytecode !== false ? bus?.route : undefined;
  const entries: AbiFunction[] = [...impl.abi, ...(routeEntry ? [routeEntry] : [])]
    .filter((entry) => entry.inputs.some((input) => input.name === PROXY_MASTER));
  return entries.map((entry) => {
    const selector = entry === routeEntry ? entry.selector ?? ROUTE_SELECTOR : entry.selector!;
    const body = impl.functionBodies?.[selector]
      ?? (impl.functionBodies === undefined && entries.length === 1 ? impl.debug?.bytecode : undefined);
    return {
      name: entry.name,
      selector,
      blockSize: entry.blockLayout?.blockSize ?? 0,
      admitted: body === undefined ? undefined : ownerDistances(expanded(body, helpers)),
      pinned: selector === ROUTE_SELECTOR ? route : direct,
    };
  });
};

const implementationOf = (source: string, messageBus: boolean): Artifact => {
  const artifact = compileString(source, { messageBus, suppressWarnings: true });
  return artifact.delegateArtifact ?? artifact;
};

/** Each forwardable entry admits exactly the pinned distance; returns the entries for shape checks. */
const expectOneDistancePerCall = (impl: Artifact): ForwardableEntry[] => {
  const entries = forwardableEntries(impl);
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    const label = `${entry.name} (${entry.selector}, block ${entry.blockSize})`;
    expect.soft(entry.admitted, `${label}: owner distances admitted`).toEqual([entry.pinned]);
  }
  return entries;
};

const ENTRY_SOURCE = `pragma solidcash >=0.8.0;
  contract EntryDelegate() {
    bigint counter;
    mapping(int => bigint) tags;
    function bump() public { this.counter = this.counter + 1; this.tags[1] = 11; }
    function assign(bigint value) public { this.counter = value; }
  }`;

const SHAPES: { shape: string; source: string; entry: string }[] = [
  {
    shape: 'an entry slot',
    entry: 'bump',
    source: ENTRY_SOURCE,
  },
  {
    shape: 'an event slot',
    entry: 'bump',
    source: `pragma solidcash >=0.8.0;
      contract EventDelegate() {
        bigint counter;
        event Bumped(bigint value);
        function bump(bigint value) public { this.counter = this.counter + value; emit Bumped(value); }
        function assign(bigint value) public { this.counter = value; }
      }`,
  },
  {
    shape: 'a return event slot',
    entry: 'bumpAndGet',
    source: `pragma solidcash >=0.8.0;
      contract ReturningDelegate() {
        bigint counter;
        function bumpAndGet() public returns (bigint) { this.counter = this.counter + 1; return this.counter; }
        function assign(bigint value) public { this.counter = value; }
      }`,
  },
  {
    shape: 'a keccak side-car',
    entry: 'reveal',
    source: `pragma solidcash >=0.8.0;
      contract KeccakDelegate() {
        int counter;
        function reveal(bytes32 preimage, bytes32 expected) public {
          require(keccak256(preimage) == expected);
          this.counter = this.counter + 1;
        }
        function assign(int value) public { this.counter = value; }
      }`,
  },
  {
    shape: 'ecrecover side-cars',
    entry: 'poke',
    source: `pragma solidcash >=0.8.0;
      contract RecoverDelegate() {
        int count;
        function poke(bytes32 h, int v, bytes32 r, bytes32 s) public {
          pubkey signerKey = ecrecoverPubKey(h, v, r, s);
          require(signerKey.length == 33);
          this.count = this.count + 1;
        }
        function assign(int value) public { this.count = value; }
      }`,
  },
];

describe('delegate owner distance against the default proxy forward', () => {
  it('admits only the direct distance for a delegate whose block is exactly master + data', () => {
    const impl = implementationOf(`pragma solidcash >=0.8.0;
      contract ScalarDelegate() {
        bigint counter;
        function bump() public { this.counter = this.counter + 1; }
        function assign(bigint value) public { this.counter = value; }
      }`, false);
    const [direct] = defaultProxyDelegateDistances(impl);
    const bump = expectOneDistancePerCall(impl).find((entry) => entry.name === 'bump')!;
    expect(BigInt(bump.blockSize)).toBe(direct);
  });

  for (const { shape, source, entry } of SHAPES) {
    it(`admits only the direct distance for a delegate with ${shape}`, () => {
      const impl = implementationOf(source, false);
      const [direct] = defaultProxyDelegateDistances(impl);
      const forwarded = expectOneDistancePerCall(impl).find((candidate) => candidate.name === entry);
      // The shape is the one this case is about: its block is larger than the distance the forward pins.
      expect(forwarded, `${entry} is a forwardable delegate entry`).toBeDefined();
      expect(BigInt(forwarded!.blockSize)).toBeGreaterThan(direct);
    });
  }

  it('admits only the route distance for the route the forward reaches by SCB1', () => {
    const impl = implementationOf(ENTRY_SOURCE, true);
    const route = expectOneDistancePerCall(impl).find((entry) => entry.selector === ROUTE_SELECTOR);
    expect(route, 'the implementation publishes a forwardable route').toBeDefined();
    expect(route!.pinned).toBe(BigInt(impl.messageBus!.route.blockLayout!.blockSize));
  });
});

describe('an honest proxied call of a delegate with an entry slot', () => {
  it('settles through the default proxy', async () => {
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    for (let index = 0; index < 20; index += 1) await addProvenUtxo(provider, signer.getAddress());
    const artifact = compileString(ENTRY_SOURCE, { messageBus: false, suppressWarnings: true });
    const proxy = await upgrades.deployProxy(getContractFactory(artifact, signer), { counter: 0n });
    await proxy.waitForDeployment();
    const handle = proxy as unknown as { bump(): { send(): Promise<unknown> } };
    await expect(handle.bump().send()).resolves.toBeDefined();
    expect((await proxy.proxy.getState()).counter).toBe(1n);
  });
});
