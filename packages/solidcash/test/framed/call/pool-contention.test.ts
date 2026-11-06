import { beforeEach, describe, expect, it } from 'vitest';
import {
  binToHex, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import { validatorAddress, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate, Signer } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import type { PreparedTransaction } from '../../../src/network/NetworkProvider.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { registerDeployment } from '../../../src/stateful/deployment-registry.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { aliceAddress, alicePkh, alicePriv, bobPkh, bobPriv, carolPkh } from '../../fixture/vars.js';

/**
 * What two independent calls spend in common, composed against the same chain as two users' wallets would be.
 *
 * Only one of two transactions that spend one outpoint can be mined, so every outpoint two compositions share makes
 * one of them compose again. `Token`, `Pair` and `Router` are the shapes of a token, a pair and a router, compiled the
 * way the DEX compiles them, one master per entry. Each case composes one pair of calls twice: with pools as listed,
 * which is what every caller took before each call ordered them itself, and with the two calls drawing different
 * UTXOs, which is what independent callers usually do.
 *
 * What stays shared is what the frames must spend: a record their code reads or writes.
 */

const SOURCE = `pragma solidity ^0.8.0;
interface IERC20 {
  function transfer(address to, uint256 value) external returns (bool);
  function transferFrom(address from, address to, uint256 value) external returns (bool);
  function balanceOf(address who) external view returns (uint256);
}
interface IPair { function swap(uint256 amount0Out, uint256 amount1Out, address to) external; }
contract Token {
  uint256 public totalSupply;
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
  function mint(address to, uint256 value) external {
    totalSupply += value; balanceOf[to] += value; emit Transfer(address(0), to, value);
  }
  function approve(address spender, uint256 value) external returns (bool) {
    allowance[msg.sender][spender] = value; emit Approval(msg.sender, spender, value); return true;
  }
  function transfer(address to, uint256 value) external returns (bool) {
    balanceOf[msg.sender] -= value; balanceOf[to] += value; emit Transfer(msg.sender, to, value); return true;
  }
  function transferFrom(address from, address to, uint256 value) external returns (bool) {
    allowance[from][msg.sender] -= value; balanceOf[from] -= value; balanceOf[to] += value;
    emit Transfer(from, to, value); return true;
  }
}
contract Pair {
  address public token0;
  address public token1;
  uint256 public reserve0;
  uint256 public reserve1;
  mapping(address => mapping(address => uint256)) public allowance;
  event Approval(address indexed owner, address indexed spender, uint256 value);
  constructor(address a, address b) { token0 = a; token1 = b; }
  function approve(address spender, uint256 value) external returns (bool) {
    allowance[msg.sender][spender] = value; emit Approval(msg.sender, spender, value); return true;
  }
  function sync() external {
    reserve0 = IERC20(token0).balanceOf(address(this));
    reserve1 = IERC20(token1).balanceOf(address(this));
  }
  function swap(uint256 amount0Out, uint256 amount1Out, address to) external {
    if (amount0Out > 0) IERC20(token0).transfer(to, amount0Out);
    if (amount1Out > 0) IERC20(token1).transfer(to, amount1Out);
    uint256 balance0 = IERC20(token0).balanceOf(address(this));
    uint256 balance1 = IERC20(token1).balanceOf(address(this));
    require(balance0 * balance1 >= reserve0 * reserve1, "K");
    reserve0 = balance0;
    reserve1 = balance1;
  }
}
contract Router {
  address public owner;
  constructor() { owner = msg.sender; }
  function swapOnPair(address pair, address tokenIn, uint256 amountIn, uint256 amount0Out, uint256 amount1Out) external {
    require(owner != address(0), "owner");
    IERC20(tokenIn).transferFrom(msg.sender, pair, amountIn);
    IPair(pair).swap(amount0Out, amount1Out, msg.sender);
  }
}`;

const OPTIONS = {
  composition: 'framed', evmCompat: true, addressForm: 'bytecode', forceStateful: true, tagSingletonDataNfts: true,
  commitmentLimit: 128, suppressWarnings: true, split: 'func',
} as const;
const compiled = (name: string): FunctionSplitBundle =>
  compileStringSplit(SOURCE, { ...OPTIONS, primaryContractName: name } as never) as FunctionSplitBundle;
const TOKEN = compiled('Token');
const PAIR = compiled('Pair');
const ROUTER = compiled('Router');
const VALIDATOR = framedValidator.buildValidatorProgram();

const lockOfPkh = (fill: number): Uint8Array => encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(fill));
const ALICE = encodeLockingBytecodeP2pkh(alicePkh);
const BOB = encodeLockingBytecodeP2pkh(bobPkh);
const CAROL = encodeLockingBytecodeP2pkh(carolPkh);
const DAVE = lockOfPkh(0x44);
const SEED_AMOUNT = 1_000_000n;

/** A chain that hands a composition back instead of mining it, so two calls are composed against one state. */
class ComposingProvider extends MockNetworkProvider {
  public composing = false;

  public composed: PreparedTransaction | undefined;

  public override async sendPreparedTransaction(prepared: PreparedTransaction): Promise<string> {
    if (!this.composing) return super.sendPreparedTransaction(prepared);
    this.composed = prepared;
    return binToHex(hash256(prepared.rawBytes).reverse());
  }
}

type Handle = {
  connect(signer: Signer): Record<string, (...args: unknown[]) => { send(): Promise<unknown> }>;
};
interface Deployed { readonly name: string; readonly categoryId: string; readonly lock: Uint8Array; readonly contract: Handle }

interface Chain {
  readonly provider: ComposingProvider;
  readonly alice: Signer;
  readonly bob: Signer;
  readonly tokens: Readonly<Record<'a' | 'b' | 'c' | 'd', Deployed>>;
  readonly pairs: Readonly<Record<'x' | 'y' | 'z', Deployed>>;
  readonly router: Deployed;
  /** What each outpoint of a pool or a record is, as the case names it. */
  roleOf(outpoint: string): Promise<string>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Chain> | undefined;

/** Four tokens, three pairs over them seeded with liquidity, and a router both users have approved. */
async function deployed(): Promise<Chain> {
  run ??= (async (): Promise<Chain> => {
    const provider = new ComposingProvider({ consensusLimits: COMPOSITION_LIMITS });
    const alice = new Signer(alicePriv, provider);
    const bob = new Signer(bobPriv, provider);
    let serial = 0xa000;
    const coin = (satoshis: bigint): Utxo => {
      serial += 1;
      return { txid: serial.toString(16).padStart(64, '0'), vout: 0, satoshis };
    };
    for (let at = 0; at < 60; at += 1) {
      await provider.addUtxo(binToHex(ALICE), coin(3_000_000n));
      await provider.addUtxo(binToHex(BOB), coin(3_000_000n));
    }
    const deploy = async (name: string, bundle: FunctionSplitBundle, args: readonly unknown[] = []): Promise<Deployed> => {
      const fundingUtxo = coin(30_000_000n);
      await provider.addUtxo(binToHex(ALICE), fundingUtxo);
      const { categoryId, contract } = await deployStatefulContract(bundle.logical, args as never, {
        provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
        functionSplit: bundle,
      } as never);
      const lock = validatorAddress(hexToBin(categoryId), VALIDATOR);
      registerDeployment(provider, {
        contractName: bundle.logical.contractName, address: binToHex(lock), lockingBytecode: binToHex(lock),
        contract: { inner: { artifact: bundle.logical }, categoryId },
      } as never);
      return { name, categoryId, lock, contract: contract as unknown as Handle };
    };
    const tokens = {
      a: await deploy('A', TOKEN), b: await deploy('B', TOKEN), c: await deploy('C', TOKEN), d: await deploy('D', TOKEN),
    };
    const pairs = {
      x: await deploy('X', PAIR, [tokens.a.lock, tokens.b.lock]),
      y: await deploy('Y', PAIR, [tokens.c.lock, tokens.d.lock]),
      z: await deploy('Z', PAIR, [tokens.a.lock, tokens.c.lock]),
    };
    const router = await deploy('Router', ROUTER);
    const send = (who: Signer, target: Deployed, entry: string, ...args: unknown[]): Promise<unknown> =>
      target.contract.connect(who)[entry]!(...args).send();
    for (const token of Object.values(tokens)) {
      for (const holder of [ALICE, BOB, CAROL, DAVE]) await send(alice, token, 'mint', holder, SEED_AMOUNT);
      await send(alice, token, 'approve', router.lock, SEED_AMOUNT);
      await send(bob, token, 'approve', router.lock, SEED_AMOUNT);
    }
    for (const [pair, token0, token1] of [
      [pairs.x, tokens.a, tokens.b], [pairs.y, tokens.c, tokens.d], [pairs.z, tokens.a, tokens.c],
    ] as const) {
      await send(alice, token0, 'mint', pair.lock, SEED_AMOUNT);
      await send(alice, token1, 'mint', pair.lock, SEED_AMOUNT);
      await send(alice, pair, 'sync');
    }
    const facetLocks = framedValidator.buildValidatorFacets().map((code) => encodeLockingBytecodeP2sh32(hash256(code)));
    const roleOf = async (outpoint: string): Promise<string> => {
      const named = async (pools: readonly (readonly [string, readonly Utxo[]])[]): Promise<string | undefined> =>
        pools.find(([, pool]) => pool.some((utxo) => `${utxo.txid}:${utxo.vout}` === outpoint))?.[0];
      for (const [at, lock] of facetLocks.entries()) {
        const role = await named([[`facet-${at + 1}`, await provider.getUtxosForLockingBytecode(lock)]]);
        if (role !== undefined) return role;
      }
      for (const [target, bundle] of [
        ...Object.values(tokens).map((token) => [token, TOKEN] as const),
        ...Object.values(pairs).map((pair) => [pair, PAIR] as const),
        [router, ROUTER] as const,
      ]) {
        const live = await readFramedDeployment(provider, target.categoryId, bundle.logical.stateLayout!);
        const role = await named([
          [`${target.name} master`, live.masters], [`${target.name} validator`, live.validators],
          [`${target.name} record`, live.records], [`${target.name} node`, live.collectionNodes],
        ]);
        if (role !== undefined) return role;
      }
      return 'a coin of the caller';
    };
    return {
      provider, alice, bob, tokens, pairs, router, roleOf, snapshot: await provider.takeSnapshot(),
    };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  chain.provider.poolRandom = () => 0;
  return chain;
}

interface Composition { readonly outpoints: readonly string[]; readonly hex: string }

/** One call composed and checked by the machine, against the chain as it stands. Nothing reaches the chain. */
async function compose(
  chain: Chain, who: Signer, target: Deployed, entry: string, args: readonly unknown[], source: () => number,
): Promise<Composition> {
  const { provider } = chain;
  provider.poolRandom = source;
  provider.composing = true;
  try {
    await target.contract.connect(who)[entry]!(...args).send();
  } finally {
    provider.composing = false;
  }
  const { transaction, rawHex } = provider.composed!;
  return {
    outpoints: transaction.inputs.map((input) => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`),
    hex: rawHex,
  };
}

/** The roles of the outpoints two compositions both spend, sorted and each named once. */
async function sharedRoles(chain: Chain, one: Composition, two: Composition): Promise<readonly string[]> {
  const spent = new Set(one.outpoints);
  const shared = two.outpoints.filter((outpoint) => spent.has(outpoint));
  return [...new Set(await Promise.all(shared.map(chain.roleOf)))].sort();
}

/** A source under which pools come back reversed: two calls then draw the two ends of every pool. */
const reversing = (): (() => number) => {
  let rank = 1;
  return () => {
    rank -= 1e-6;
    return rank;
  };
};
const listed = (): (() => number) => () => 0;

/** A small source of evenly spread numbers, so a run can be repeated. */
const seeded = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

describe('what two independent calls spend in common', () => {
  beforeEach(async () => {
    await deployed();
  }, 600_000);

  it('transfers of two tokens share the facets as listed, and nothing once they draw apart', async () => {
    const chain = await deployed();
    const { alice, bob, tokens: { a, b } } = chain;
    const first = await compose(chain, alice, a, 'transfer', [CAROL, 1n], listed());
    expect(await sharedRoles(chain, first, await compose(chain, bob, b, 'transfer', [DAVE, 1n], listed())))
      .toStrictEqual(['facet-1', 'facet-2']);

    const second = await compose(chain, bob, b, 'transfer', [DAVE, 1n], reversing());
    expect(await sharedRoles(chain, first, second)).toStrictEqual([]);
    // Composed against the same state and sharing nothing, both are mined.
    await chain.provider.sendRawTransaction(first.hex);
    await chain.provider.sendRawTransaction(second.hex);
  }, 120_000);

  it('transfers of one token by two users share its record once they draw apart', async () => {
    const chain = await deployed();
    const { alice, bob, tokens: { a } } = chain;
    const first = await compose(chain, alice, a, 'transfer', [CAROL, 1n], listed());
    expect(await sharedRoles(chain, first, await compose(chain, bob, a, 'transfer', [DAVE, 1n], listed())))
      .toStrictEqual(['A master', 'A record', 'A validator', 'facet-1', 'facet-2']);
    expect(await sharedRoles(chain, first, await compose(chain, bob, a, 'transfer', [DAVE, 1n], reversing())))
      .toStrictEqual(['A record']);
  }, 120_000);

  it('an approval beside a sync shares the records the sync reads', async () => {
    const chain = await deployed();
    const { alice, bob, pairs: { x } } = chain;
    const first = await compose(chain, bob, x, 'approve', [CAROL, 1n], listed());
    expect(await sharedRoles(chain, first, await compose(chain, alice, x, 'sync', [], listed())))
      .toStrictEqual(['X record', 'X validator', 'facet-1', 'facet-2']);
    expect(await sharedRoles(chain, first, await compose(chain, alice, x, 'sync', [], reversing())))
      .toStrictEqual(['X record']);
  }, 120_000);

  it('swaps on two pairs of different tokens share only the router\'s record', async () => {
    const chain = await deployed();
    const { alice, bob, router, tokens: { a, c }, pairs: { x, y } } = chain;
    const first = await compose(chain, alice, router, 'swapOnPair', [x.lock, a.lock, 1000n, 0n, 900n], listed());
    const second = (source: () => number): Promise<Composition> =>
      compose(chain, bob, router, 'swapOnPair', [y.lock, c.lock, 1000n, 0n, 900n], source);
    expect(await sharedRoles(chain, first, await second(listed())))
      .toStrictEqual(['Router master', 'Router record', 'Router validator', 'facet-1', 'facet-2']);
    expect(await sharedRoles(chain, first, await second(reversing()))).toStrictEqual(['Router record']);
  }, 180_000);

  it('swaps on two pairs that share a token share its record too', async () => {
    const chain = await deployed();
    const { alice, bob, router, tokens: { a }, pairs: { x, z } } = chain;
    const first = await compose(chain, alice, router, 'swapOnPair', [x.lock, a.lock, 1000n, 0n, 900n], listed());
    const second = (source: () => number): Promise<Composition> =>
      compose(chain, bob, router, 'swapOnPair', [z.lock, a.lock, 1000n, 0n, 900n], source);
    expect(await sharedRoles(chain, first, await second(listed()))).toStrictEqual([
      'A master', 'A record', 'Router master', 'Router record', 'Router validator', 'facet-1', 'facet-2',
    ]);
    expect(await sharedRoles(chain, first, await second(reversing()))).toStrictEqual(['A record', 'Router record']);
  }, 180_000);

  it('a swap settles on whichever of the pools\' UTXOs it draws', async () => {
    const chain = await deployed();
    const { alice, provider, router, tokens: { a, b }, pairs: { x } } = chain;
    for (const seed of [1, 2, 3]) {
      const composed = await compose(
        chain, alice, router, 'swapOnPair', [x.lock, a.lock, 1000n, 0n, 900n], seeded(seed),
      );
      await provider.sendRawTransaction(composed.hex);
    }
    // Three swaps of 1000 in for 900 out, each read back through the chain the last one left.
    const balanceOf = (token: Deployed, who: Uint8Array): Promise<unknown> =>
      token.contract.connect(alice).balanceOf!(who) as unknown as Promise<unknown>;
    expect(await balanceOf(a, x.lock)).toBe(SEED_AMOUNT + 3_000n);
    expect(await balanceOf(b, x.lock)).toBe(SEED_AMOUNT - 2_700n);
  }, 240_000);
});
