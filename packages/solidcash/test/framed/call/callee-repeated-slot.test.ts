import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesToHex, validatorAddress, type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import { encodeFunctionArgument, type FunctionArgument } from '../../../src/Argument.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A callee frame whose sorted batch names one slot with two of its writes.
 *
 * `Pool.mint` mints as a liquidity pair does: a fee to the recipient the config returns, behind the product it stored,
 * and, while the supply is zero, a minimum to the zero address, each through an internal mint and under a condition
 * the plan cannot decide, since the config answers through a call and the minimum's check reads the supply the fee
 * mint may have raised. With no fee recipient both name the zero address's balance. The pool starts as a first mint
 * leaves it, so a mint makes neither write, and the batch keeps the later as a skipped target: the frame settles.
 * `InlinePool.mint` makes the same two writes inline, so the body reads both values at the frame's start, where neither
 * guard has run: the skipped target's group keeps the predecessor of a key the list holds, and the key is read through
 * the earlier target's group, which names its node.
 * `Book.credit` credits two accounts it is given; given one account twice, its run makes both writes of one slot,
 * which no batch declares, and the call is refused for it by name.
 */

const SOURCE = 'pragma solidity ^0.8.0;'
  + ' interface IConfig { function feeTo() external view returns (address); }'
  + ' contract Config { address public feeTo; }'
  + ' contract Pool { mapping(address => uint256) public balanceOf; uint256 public totalSupply; uint256 public kLast;'
  + '   IConfig public config;'
  + '   constructor(IConfig c) { config = c; totalSupply = 10; balanceOf[address(0)] = 10; }'
  + '   function _mint(address to, uint256 value) internal { totalSupply += value; balanceOf[to] += value; }'
  + '   function _mintFee() private returns (bool feeOn) {'
  + '     address feeTo = config.feeTo(); feeOn = feeTo != address(0); uint256 _kLast = kLast;'
  + '     if (feeOn) { if (_kLast != 0) { _mint(feeTo, 1); } } else if (_kLast != 0) { kLast = 0; } }'
  + '   function mint(address to, uint256 amount) external {'
  + '     bool feeOn = _mintFee(); uint256 _totalSupply = totalSupply;'
  + '     if (_totalSupply == 0) { _mint(address(0), 10); }'
  + '     _mint(to, amount); if (feeOn) kLast = totalSupply; } }'
  + ' contract InlinePool { mapping(address => uint256) public balanceOf; uint256 public totalSupply; uint256 public kLast;'
  + '   IConfig public config;'
  + '   constructor(IConfig c) { config = c; totalSupply = 10; balanceOf[address(0)] = 10; }'
  + '   function mint(address to, uint256 amount) external {'
  + '     address feeTo = config.feeTo(); bool feeOn = feeTo != address(0);'
  + '     if (feeOn) { if (kLast != 0) { balanceOf[feeTo] += 1; totalSupply += 1; } } else if (kLast != 0) { kLast = 0; }'
  + '     if (totalSupply == 0) { balanceOf[address(0)] += 10; totalSupply += 10; }'
  + '     balanceOf[to] += amount; totalSupply += amount; if (feeOn) kLast = totalSupply; } }'
  + ' contract Book { mapping(address => uint256) public held;'
  + '   function credit(address a, address b) external { held[a] += 1; held[b] += 1; } }'
  + ' contract Router { Pool public pool; Book public book; InlinePool public inlined;'
  + '   constructor(Pool p, Book b, InlinePool q) { pool = p; book = b; inlined = q; }'
  + '   function add(address to, uint256 amount) external { pool.mint(to, amount); }'
  + '   function addInline(address to, uint256 amount) external { inlined.mint(to, amount); }'
  + '   function both(address a, address b) external { book.credit(a, b); } }';

const NAMES = ['Config', 'Pool', 'Book', 'InlinePool', 'Router'] as const;

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifacts: Readonly<Record<string, Artifact>>;
  readonly categories: ReadonlyMap<string, string>;
  readonly snapshot: SnapshotRestorer;
}

let run: Promise<Deployed> | undefined;

/** The config, the pools and the book, then the router over them; each case rewinds the chain to them first. */
async function deployed(): Promise<Deployed> {
  run ??= (async (): Promise<Deployed> => {
    const compiled = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true } as never);
    const artifacts = Object.fromEntries(NAMES.map((name) => [name, compiled[name]!]));
    const { framedValidator } = await import('@solidcash/solidc');
    const validatorProgram = framedValidator.buildValidatorProgram();
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    const categories = new Map<string, string>();
    const addressOf = (name: string): Uint8Array => validatorAddress(hexToBin(categories.get(name)!), validatorProgram);
    const argsOf: Record<string, () => Uint8Array[]> = {
      Config: () => [], Pool: () => [addressOf('Config')], Book: () => [], InlinePool: () => [addressOf('Config')],
      Router: () => [addressOf('Pool'), addressOf('Book'), addressOf('InlinePool')],
    };
    for (const [index, name] of NAMES.entries()) {
      const fundingUtxo = { txid: `${'75'.repeat(31)}${(0xa0 + index).toString(16)}`, vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifacts[name]!, argsOf[name]!(), {
        provider, fundingUtxo, changeAddress: funder.address,
        funder: funder.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      categories.set(name, deployment.categoryId);
    }
    return { provider, artifacts, categories, snapshot: await provider.takeSnapshot() };
  })();
  const chain = await run;
  await chain.snapshot.restore();
  return chain;
}

let coins = 0;

/** Enters one of the router's entries with a fresh coin of the user's. */
async function enter(chain: Deployed, functionName: string, args: readonly FunctionArgument[]): Promise<FramedCallResult> {
  coins += 1;
  const user = encodeLockingBytecodeP2pkh(alicePkh);
  const callerUtxo = { txid: `${'76'.repeat(31)}${coins.toString(16).padStart(2, '0')}`, vout: 0, satoshis: 300_000n };
  await chain.provider.addUtxo(binToHex(user), callerUtxo);
  const externals = Object.fromEntries([...chain.categories]
    .map(([name, categoryId]) => [name, { artifact: chain.artifacts[name]!, categoryId }]));
  return callFramedEntry({
    provider: chain.provider, artifact: chain.artifacts.Router!, categoryId: chain.categories.get('Router')!,
    functionName, args: [...args], callerUtxo, callerLockingBytecode: user,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(), externals,
  });
}

/** The value each node of one contract's collection holds, as the account's key names it, read back from the chain. */
async function balances(chain: Deployed, contract: string, collection: string): Promise<(account: Uint8Array) => string> {
  const artifact = chain.artifacts[contract]!;
  const keys = artifact.stateLayout!.collections!.find((candidate) => candidate.name === collection)!;
  const live = await readFramedDeployment(chain.provider, chain.categories.get(contract)!, artifact.stateLayout!);
  const values = new Map((live.nodesByCollection.get(collection) ?? []).map((utxo) => {
    const node = decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment));
    return [bytesToHex(node.slot), bytesToHex(node.value)] as const;
  }));
  return (account) => values.get(bytesToHex(keyToSlotMulti([account], keys))) ?? '';
}

/** An amount as the node of a `uint256` mapping holds it. */
const amount = (value: bigint): string => bytesToHex(encodeFunctionArgument(value, 'uint256') as Uint8Array);

const ZERO = new Uint8Array(20);
const ALICE = encodeLockingBytecodeP2pkh(alicePkh);
const BOB = encodeLockingBytecodeP2pkh(bobPkh);

const settled = (result: FramedCallResult): void => {
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
};

describe('a callee frame whose sorted batch names one slot with two of its writes', () => {
  it('settles each mint, the run making neither of the two writes the batch names the zero address with', async () => {
    const chain = await deployed();
    settled(await enter(chain, 'add', [ALICE, 100n]));
    settled(await enter(chain, 'add', [ALICE, 50n]));
    const held = await balances(chain, 'Pool', 'balanceOf');
    expect(held(ZERO)).toBe(amount(10n));
    expect(held(ALICE)).toBe(amount(150n));
  });

  it('settles each mint of a pool that makes both writes inline, reading the held key at the frame\'s start', async () => {
    const chain = await deployed();
    settled(await enter(chain, 'addInline', [ALICE, 100n]));
    settled(await enter(chain, 'addInline', [ALICE, 50n]));
    const held = await balances(chain, 'InlinePool', 'balanceOf');
    expect(held(ZERO)).toBe(amount(10n));
    expect(held(ALICE)).toBe(amount(150n));
  });

  it('refuses by name a callee run that makes both writes of one slot, and settles two accounts', async () => {
    const chain = await deployed();
    await expect(enter(chain, 'both', [ALICE, ALICE])).rejects.toThrow(new RegExp('the callee "Book\\.credit\\(\\)" '
      + 'writes records this hop cannot declare: FRAMED_MAPPING_UNPLANNABLE: a sorted batch writes slot [0-9a-f]{64} '
      + 'more than once'));
    settled(await enter(chain, 'both', [ALICE, BOB]));
    const held = await balances(chain, 'Book', 'held');
    expect([held(ALICE), held(BOB)]).toStrictEqual([amount(1n), amount(1n)]);
  });
});
