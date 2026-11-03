import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import {
  asmToBytecode, blockOracleLockingBytecode, buildPushdataCommitment, bytesEqual, childMastersDigest,
  encodeBlockOracleCommitment, encodePushdataValue, hash160, parsePushdataCommitment, sha256, UNSET_BLOCK_ORACLE_FIELDS,
  type FunctionSplitBundle, type StateLayout,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { fillFramedChildSlots, framedChildConstants } from '../../../src/framed/deploy/child-constants.js';
import { childGenesisReservation, patchChildGenesisSlots } from '../../../src/framed/deploy/child-locks.js';
import { entryRecordLockingBytecode, stateRecordLockingBytecode } from '../../../src/framed/deploy/records.js';
import { functionSplitFor } from '../../../src/framed/deploy/split-registry.js';
import { makeCallResolver } from '../../../src/framed/proxy/call-resolution.js';
import { encodeEntryCommitment, headSentinelCommitment } from '../../../src/stateful/SortedList.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A creation composed by a hostile composer (docs/framed/CREATE2_IDENTITY.md, "The genesis replay").
 *
 * Whoever composes a creating transaction lays down the child's genesis. The creating body requires the outputs of
 * the child's category `K` to be exactly the genesis its folded construction produces, so each test plans an honest
 * creation, rewrites its outputs the way a composer could, and asks the machine for the creator's verdict on the
 * rewritten transaction. The composer also rewrites the folded-state `OP_RETURN` the SDK appends, which the earlier
 * category check took for the genesis: the creator no longer reads it. Every rewrite keeps the number of outputs of `K`
 * the earlier check counted where the attack allows, so each refusal is the replay's.
 */

const FRAMED = { composition: 'framed' as const, evmCompat: true, suppressWarnings: true, split: 'func' as const };

/** A pair-shaped child: Uniswap's state, its constructor, its initializer and a mint that needs `unlocked`. */
const PAIR_SOURCE = `pragma solidity ^0.8.0;
interface IPair { function initialize(address a, address b) external; }
contract Pair {
  uint256 public totalSupply;
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  address public factory;
  address public token0;
  address public token1;
  uint112 private reserve0;
  uint112 private reserve1;
  uint256 public kLast;
  uint256 private unlocked = 1;
  constructor() { factory = msg.sender; }
  function initialize(address a, address b) external {
    require(msg.sender == factory, 'FORBIDDEN');
    token0 = a;
    token1 = b;
  }
  function mint(address to, uint256 value) external {
    require(unlocked == 1, 'LOCKED');
    totalSupply = totalSupply + value;
    balanceOf[to] = balanceOf[to] + value;
  }
}
contract Factory {
  uint256 public pairs;
  function createPair(address tokenA, address tokenB) external returns (address pair) {
    require(tokenA != tokenB, 'IDENTICAL');
    (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    bytes memory code = type(Pair).creationCode;
    assembly { pair := create2(0, add(code, 32), mload(code), tokenA) }
    IPair(pair).initialize(token0, token1);
    pairs = pairs + 1;
  }
}`;

/** A child that reads block.timestamp, so its genesis mints its own block oracle. */
const CLOCK_SOURCE = `pragma solidity ^0.8.0;
contract Clock {
  uint256 public stamp;
  function touch() external { stamp = block.timestamp; }
}
contract Factory {
  uint256 public made;
  function make(bytes32 salt) external returns (address clock) {
    bytes memory code = type(Clock).creationCode;
    assembly { clock := create2(0, add(code, 32), mload(code), salt) }
    made = made + 1;
  }
}`;

const VALIDATOR = framedValidator.buildValidatorProgram();
const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
const callerAddress = (() => {
  const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
  if (typeof encoded === 'string') throw new Error(encoded);
  return encoded.address;
})();
const TOKEN_A = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x31), 0x87]);
const TOKEN_B = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x32), 0x87]);
const ATTACKER = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x66), 0x87]);
const POOL = { masters: 2, validators: 1 };

let coins = 0;
const freshCoin = async (provider: MockNetworkProvider, satoshis: bigint): Promise<Utxo> => {
  coins += 1;
  const coin = { txid: (0x9a0 + coins).toString(16).padStart(64, '0'), vout: 0, satoshis };
  await provider.addUtxo(binToHex(callerLock), coin);
  return coin;
};

type Transaction = FramedCallResult['transaction'];
type TxOutput = Transaction['outputs'][number];

/** A creation planned honestly, its category, and the creator's verdict on any rewrite of its outputs. */
interface Creation {
  readonly result: FramedCallResult;
  readonly category: Uint8Array;
  readonly categoryId: string;
  readonly outputs: () => TxOutput[];
  readonly creatorAccepts: (outputs: TxOutput[], inputs?: Transaction['inputs']) => boolean;
}

/** Deploys `primary` of `source` as a creator of `childName` and plans one honest creation through `entry`. */
async function plannedCreation(
  source: string, childName: string, entry: string, args: (child: FunctionSplitBundle) => Uint8Array[],
  initializer?: string,
): Promise<Creation & { readonly child: FunctionSplitBundle }> {
  const factory = compileStringSplit(source, { ...FRAMED, primaryContractName: 'Factory' }) as FunctionSplitBundle;
  const child = compileStringSplit(source, { ...FRAMED, primaryContractName: childName }) as FunctionSplitBundle;
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const constants = framedChildConstants({ artifact: child.logical, split: child, provider, pool: POOL });
  const { categoryId: factoryCategory } = await deployStatefulContract(factory.logical, [], {
    provider, fundingUtxo: await freshCoin(provider, 1_500_000n), funder, changeAddress: callerAddress,
    threadCount: 1, validatorCount: 1, functionSplit: factory,
    childLocks: constants.childLocks, childPool: constants.childPool, childCollections: constants.childCollections,
    ...(constants.childBlockOracleOwner === undefined ? {} : { childBlockOracleOwner: constants.childBlockOracleOwner }),
  });
  const callArgs = args(child);
  let initializerCall: { functionName: string; args: Uint8Array[] } | undefined;
  if (initializer !== undefined) {
    const folded = factory.logical.composition!.creates!.find((site) => site.contractName === childName)!.foldedCall!;
    const resolver = makeCallResolver({
      artifact: factory.logical, functionName: entry, args: callArgs, stateValues: {},
    } as never);
    initializerCall = {
      functionName: initializer,
      args: folded.argumentSources.map((argument) => resolver.resolve(argument as never, 0) as Uint8Array),
    };
  }
  const caller = await freshCoin(provider, 20_000_000n);
  const result = await callFramedEntry({
    provider, artifact: factory.logical, categoryId: factoryCategory, functionName: entry, args: callArgs,
    callerUtxo: caller, callerLockingBytecode: callerLock, funder,
    split: functionSplitFor(provider, factoryCategory) ?? factory,
    vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
    creates: {
      artifact: child.logical, split: child, pool: constants.childPool,
      ...(initializerCall === undefined ? {} : { initializer: initializerCall }),
    },
  });
  const refused = result.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
  expect(result.accepted, refused).toBe(true);
  const master = result.verdicts.find((verdict) => verdict.id === 'master')!;
  const machine = compositionMachine();
  return {
    child,
    result,
    category: hexToBin(caller.txid),
    categoryId: caller.txid,
    outputs: () => result.transaction.outputs.map((output) => ({ ...output })),
    creatorAccepts: (outputs, inputs = result.transaction.inputs) => machine.stateSuccess(machine.evaluate({
      inputIndex: master.index, sourceOutputs: result.sourceOutputs,
      transaction: { ...result.transaction, inputs, outputs: withDigest(outputs, hexToBin(caller.txid)) },
    } as never)) === true,
  };
}

const ofCategory = (output: TxOutput, category: Uint8Array): boolean =>
  output.token !== undefined && bytesEqual(output.token.category, category);
const commitmentOf = (output: TxOutput): Uint8Array => output.token?.nft?.commitment ?? new Uint8Array();
const withCommitment = (output: TxOutput, commitment: Uint8Array): TxOutput => ({
  ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } },
});

/**
 * `outputs` with the folded-state `OP_RETURN` restated over its outputs of the category, as the SDK computes it: a
 * composer that rewrites the genesis rewrites that digest too.
 */
function withDigest(outputs: TxOutput[], category: Uint8Array): TxOutput[] {
  const parts = outputs.filter((output) => ofCategory(output, category))
    .map((output) => sha256(Uint8Array.from([...output.lockingBytecode, ...commitmentOf(output)])));
  const digest = sha256(Uint8Array.from(parts.flatMap((part) => [...part])));
  return outputs.map((output) => output.lockingBytecode.length === 34 && output.lockingBytecode[0] === 0x6a
    && output.lockingBytecode[1] === 0x20 && output.token === undefined
    ? { ...output, lockingBytecode: Uint8Array.from([0x6a, 0x20, ...digest]) }
    : output);
}

/** The index of the record whose decoded state holds `field`, and its decoded values. */
function recordHolding(
  outputs: TxOutput[], categoryId: string, layout: StateLayout, field: string,
): { index: number; nftIndex: number; values: Record<string, unknown> } {
  const recordLock = stateRecordLockingBytecode(categoryId);
  const records = outputs.map((output, index) => ({ output, index }))
    .filter(({ output }) => bytesEqual(output.lockingBytecode, recordLock));
  for (const [nftIndex, { output, index }] of records.entries()) {
    const values = parsePushdataCommitment(binToHex(commitmentOf(output)), layout, nftIndex);
    if (field in values) return { index, nftIndex, values };
  }
  throw new Error(`no record holds ${field}`);
}

/** `outputs` with `field` of the child's state forged to `value`, its record re-encoded as the SDK encodes it. */
function forged(outputs: TxOutput[], categoryId: string, layout: StateLayout, field: string, value: unknown): TxOutput[] {
  const { index, nftIndex, values } = recordHolding(outputs, categoryId, layout, field);
  const commitment = hexToBin(buildPushdataCommitment(layout, { ...values, [field]: value } as never, nftIndex));
  const rewritten = [...outputs];
  rewritten[index] = withCommitment(outputs[index]!, commitment);
  return rewritten;
}

describe('a creation a hostile composer lays down', () => {
  it('is refused for each forged genesis of a pair-shaped child, and the honest one is accepted', async () => {
    const creation = await plannedCreation(PAIR_SOURCE, 'Pair', 'createPair', () => [TOKEN_A, TOKEN_B], 'initialize');
    const { child, category, categoryId, outputs, creatorAccepts } = creation;
    const layout = child.logical.stateLayout!;
    // The honest genesis, which the replay requires, and which the SDK laid down.
    expect(creatorAccepts(outputs())).toBe(true);
    // Outputs of no category of the child's are no part of it: a creator accepts a transaction that adds or drops
    // them, so a refusal below is the replay's and not the transaction's shape.
    expect(creatorAccepts([...outputs(), { lockingBytecode: callerLock, valueSatoshis: 5_000n }])).toBe(true);
    // One of the child's tokenless validator facets, which the genesis lays down after its validator.
    const firstOfChild = outputs().findIndex((output) => ofCategory(output, category));
    const facetAt = outputs().findIndex((output, index) => index > firstOfChild && output.token === undefined
      && output.lockingBytecode[0] === 0xaa);
    expect(facetAt).toBeGreaterThan(firstOfChild);
    expect(creatorAccepts(outputs().filter((_output, index) => index !== facetAt))).toBe(true);
    const token0 = recordHolding(outputs(), categoryId, layout, 'token0').values.token0 as Uint8Array;
    expect(binToHex(token0)).toBe(binToHex(TOKEN_A));

    // A wrong token: the pair would price and pay out another token than the one it was created for.
    expect(creatorAccepts(forged(outputs(), categoryId, layout, 'token0', ATTACKER))).toBe(false);
    expect(creatorAccepts(forged(outputs(), categoryId, layout, 'token1', TOKEN_A))).toBe(false);
    // Unbacked LP supply, a forged factory, and a pair locked forever.
    expect(creatorAccepts(forged(outputs(), categoryId, layout, 'totalSupply', 1_000_000n))).toBe(false);
    expect(creatorAccepts(forged(outputs(), categoryId, layout, 'factory', ATTACKER))).toBe(false);
    expect(creatorAccepts(forged(outputs(), categoryId, layout, 'unlocked', 0n))).toBe(false);
    expect(creatorAccepts(forged(outputs(), categoryId, layout, 'kLast', 7n))).toBe(false);

    // A spare master swapped for an LP-balance node at the collection's lock, the head relinked to it: the count of
    // outputs of `K` is unchanged, and every lock is one the child's genesis names.
    const balanceLock = entryRecordLockingBytecode(categoryId, layout.collections!.find((c) => c.name === 'balanceOf')!.signature!);
    const swapped = outputs();
    const masterAt = swapped.findIndex((output) => ofCategory(output, category) && output.token!.nft?.capability === 'minting');
    const masterOutput = swapped[masterAt]!;
    swapped.splice(masterAt, 1);
    const headAt = swapped.findIndex((output) => bytesEqual(output.lockingBytecode, balanceLock));
    const slot = new Uint8Array(32).fill(0x42);
    swapped[headAt] = withCommitment(swapped[headAt]!, encodeEntryCommitment(new Uint8Array(32), slot, new Uint8Array(64)));
    swapped.push({
      ...swapped[headAt]!,
      token: {
        ...swapped[headAt]!.token!,
        nft: { capability: 'mutable', commitment: encodeEntryCommitment(slot, new Uint8Array(32), encodePushdataValue(10n ** 30n, 'uint256')) },
      },
    });
    expect(swapped.filter((output) => ofCategory(output, category))).toHaveLength(
      outputs().filter((output) => ofCategory(output, category)).length,
    );
    expect(creatorAccepts(swapped)).toBe(false);
    // The node alone, beside the honest head, is one output too many.
    expect(creatorAccepts([...outputs(), swapped[swapped.length - 1]!])).toBe(false);
    const honestHead = outputs().find((output) => bytesEqual(output.lockingBytecode, balanceLock))!;
    expect(binToHex(commitmentOf(honestHead))).toBe(binToHex(headSentinelCommitment()));

    // The validator dropped, or another validator minted in place of a master.
    const validator = (output: TxOutput): boolean => ofCategory(output, category)
      && output.token!.nft?.capability === 'mutable' && commitmentOf(output).length === 0;
    expect(creatorAccepts(outputs().filter((output) => !validator(output)))).toBe(false);
    const doubledValidator = outputs().filter((output) => output !== undefined);
    const validatorOutput = doubledValidator.find(validator)!;
    doubledValidator.splice(doubledValidator.findIndex((output) => ofCategory(output, category)
      && output.token!.nft?.capability === 'minting'), 1, { ...validatorOutput });
    expect(creatorAccepts(doubledValidator)).toBe(false);

    // A master doubled, and a master dropped.
    const doubled = outputs();
    doubled.splice(masterAt, 0, { ...masterOutput });
    expect(creatorAccepts(doubled)).toBe(false);
    expect(creatorAccepts(outputs().filter((_output, index) => index !== masterAt))).toBe(false);

    // The same outputs, from a coin that is not output 0 of its transaction: its txid may be a category an earlier
    // genesis minted, whose minting NFT the composer could still hold, so `K` would not be the creation's to mint.
    const { result } = creation;
    const originAt = result.transaction.inputs.findIndex((input) => bytesEqual(input.outpointTransactionHash, category)
      || bytesEqual(Uint8Array.from(input.outpointTransactionHash).reverse(), category));
    expect(originAt).toBeGreaterThanOrEqual(0);
    expect(result.transaction.inputs[originAt]!.outpointIndex).toBe(0);
    const fromSecondOutput = result.transaction.inputs.map((input, index) => (index === originAt
      ? { ...input, outpointIndex: 1 } : input));
    expect(creatorAccepts(outputs(), fromSecondOutput)).toBe(false);

    // The authhead naming another owner, and two of them.
    const authheadAt = outputs().findIndex((output) => ofCategory(output, category)
      && output.token!.nft?.capability === 'mutable' && bytesEqual(commitmentOf(output), callerLock));
    expect(authheadAt).toBeGreaterThanOrEqual(0);
    const owned = outputs();
    owned[authheadAt] = withCommitment(owned[authheadAt]!, ATTACKER);
    expect(creatorAccepts(owned)).toBe(false);
    expect(creatorAccepts([...outputs(), { ...outputs()[authheadAt]! }])).toBe(false);
  }, 600_000);

  it('is refused for a child that reads block.* with two oracles, none, or one whose fields or owner it chose', async () => {
    const creation = await plannedCreation(CLOCK_SOURCE, 'Clock', 'make', () => [new Uint8Array(32)]);
    const { result, category, categoryId, outputs, creatorAccepts } = creation;
    expect(creatorAccepts(outputs())).toBe(true);
    const oracleLock = blockOracleLockingBytecode(category);
    const oracleAt = outputs().findIndex((output) => bytesEqual(output.lockingBytecode, oracleLock));
    expect(oracleAt).toBeGreaterThanOrEqual(0);
    const oracle = outputs()[oracleAt]!;
    // The child's oracle starts unset, naming the network's owner: no creator knows its creation's block.
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    expect(binToHex(commitmentOf(oracle))).toBe(binToHex(
      encodeBlockOracleCommitment(hash160(provider.blockOracleOwnerPublicKey), UNSET_BLOCK_ORACLE_FIELDS),
    ));
    const forgedClock = encodeBlockOracleCommitment(hash160(provider.blockOracleOwnerPublicKey), {
      ...UNSET_BLOCK_ORACLE_FIELDS, number: 900_000n, timestamp: 4_000_000_000n,
    });
    // A second oracle, whose fields a reader could take for the time.
    expect(creatorAccepts([...outputs(), withCommitment({ ...oracle }, forgedClock)])).toBe(false);
    // None: the child's reads would fail until someone mints one, at fields of their choosing.
    expect(creatorAccepts(outputs().filter((_output, index) => index !== oracleAt))).toBe(false);
    // One, starting at a time the composer chose, or naming a key the composer holds.
    const chosen = outputs();
    chosen[oracleAt] = withCommitment(oracle, forgedClock);
    expect(creatorAccepts(chosen)).toBe(false);
    const owned = outputs();
    const composerOwner = encodeBlockOracleCommitment(hash160(ATTACKER.slice(0, 33)), UNSET_BLOCK_ORACLE_FIELDS);
    owned[oracleAt] = withCommitment(oracle, composerOwner);
    expect(creatorAccepts(owned)).toBe(false);
    expect(result.transaction.outputs.filter((output) => ofCategory(output, category)
      && bytesEqual(output.lockingBytecode, oracleLock))).toHaveLength(1);
    expect(categoryId).toBe(binToHex(category));
  }, 600_000);

  it('takes its constants from the child, and a deployment refuses constants of another child or none', async () => {
    const factory = compileStringSplit(PAIR_SOURCE, { ...FRAMED, primaryContractName: 'Factory' }) as FunctionSplitBundle;
    const pair = compileStringSplit(PAIR_SOURCE, { ...FRAMED, primaryContractName: 'Pair' }) as FunctionSplitBundle;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const constants = framedChildConstants({ artifact: pair.logical, split: pair, provider, pool: POOL });
    const creating = factory.shards.find((shard) => shard.function === 'createPair')!.artifact;
    // The creating shard reserves the masters' chain, the validator count and one hash per sorted collection, and no
    // oracle owner: the pair reads no block.*.
    expect(childGenesisReservation(creating)).toEqual({ replays: true, collections: 2, blockOracle: false });
    expect(constants.childBlockOracleOwner).toBeUndefined();
    const filled = fillFramedChildSlots(factory, constants).shards.find((shard) => shard.function === 'createPair')!;
    expect(childGenesisReservation(filled.artifact)).toEqual({ replays: false, collections: 0, blockOracle: false });
    const digest = childMastersDigest(constants.childLocks, constants.childPool.masters);
    expect(binToHex(asmToBytecode(filled.artifact.bytecode))).toContain(binToHex(digest));
    // Constants that do not match the child the creator replays.
    const slots = { locks: constants.childLocks, pool: constants.childPool, collections: constants.childCollections };
    expect(() => patchChildGenesisSlots(creating, { ...slots, collections: constants.childCollections.slice(1) }))
      .toThrow(/sorted collections/);
    expect(() => patchChildGenesisSlots(creating, { ...slots, blockOracleOwner: new Uint8Array(20).fill(1) }))
      .toThrow(/replays no block oracle/);
    expect(() => patchChildGenesisSlots(creating, { ...slots, pool: { masters: 2, validators: 0 } }))
      .toThrow(/at least one validator/);
    // A creator deployed without its child's constants would refuse every creation: the deployment refuses it.
    await expect(deployStatefulContract(factory.logical, [], {
      provider, fundingUtxo: await freshCoin(provider, 1_500_000n), funder, changeAddress: callerAddress,
      threadCount: 1, validatorCount: 1, functionSplit: factory,
    })).rejects.toThrow(/replays its genesis/);
  }, 600_000);
});
