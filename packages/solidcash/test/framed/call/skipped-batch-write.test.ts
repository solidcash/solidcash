import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, utf8ToBin } from '@bitauth/libauth';
import {
  bytesToHex, concatBytes, encodeWitnessBlock, sha256, splitFirstPush, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A token whose `_update` guards each balance write on the zero address and emits its transfer, as an OpenZeppelin
 * v5 ERC-20's does, behind a generated proxy.
 *
 * A mint is `_update(address(0), to, value)` and a burn `_update(from, address(0), value)`, so one of the two balance
 * writes is one the body skips, at a key the list does not hold. The two writes are one sorted batch and each
 * publishes the condition it runs under: the hop decides it from the frame's facts and declares a skipped write's
 * group as one kept record, the predecessor of its absent key, which another write of the batch may relink. Mints,
 * transfers and burns settle, the balances and the total supply read back, and no node is created for the zero
 * address. The skipped group restated as a record the frame changes is refused by the master.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Token {',
  '  address public implementation;',
  '  address public owner;',
  '  uint256 public totalSupply;',
  '  mapping(address => uint256) private balances;',
  '  event Transfer(address indexed from, address indexed to, uint256 value);',
  '  function initialize(address admin) public { owner = admin; }',
  '  function balanceOf(address who) public view returns (uint256) { return balances[who]; }',
  '  function mint(address to, uint256 value) external {',
  '    require(msg.sender == owner, "owner only");',
  '    _update(address(0), to, value);',
  '  }',
  '  function burn(address from, uint256 value) external {',
  '    require(msg.sender == owner, "owner only");',
  '    _update(from, address(0), value);',
  '  }',
  '  function transfer(address to, uint256 value) external { _update(msg.sender, to, value); }',
  '  function _update(address from, address to, uint256 value) internal {',
  '    if (from == address(0)) { totalSupply += value; } else { balances[from] -= value; }',
  '    if (to == address(0)) { totalSupply -= value; } else { balances[to] += value; }',
  '    emit Transfer(from, to, value);',
  '  }',
  '}',
].join('\n');

const OPTIONS = { solidityImportCompat: true, composition: 'framed' } as never;
const TOKEN = compileStringMulti(SOURCE, OPTIONS).Token!;
const PROXY = buildProxyArtifact(TOKEN);

const ADMIN = encodeLockingBytecodeP2pkh(alicePkh);
const ADMIN_FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();
const account = (fill: number): Uint8Array => encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(fill));
const A = account(0x41);
const B = account(0x42);
const FRAME = 'implementation-master';

/** A 32-byte category or txid with varied bytes, taken from its label. */
function idOf(label: string): string {
  return bytesToHex(sha256(utf8ToBin(`skipped batch write ${label}`)));
}

/** The deployment behind its proxy, and how a call enters it. */
interface World {
  readonly network: MockNetworkProvider;
  /** The category the token's records and nodes sit at: the proxy's. */
  readonly records: string;
  readonly enter: (functionName: string, args: readonly FunctionArgument[]) => Promise<FramedProxyCallResult>;
}

let coins = 0;

async function coinAt(network: MockNetworkProvider, lock: string, label: string): Promise<Utxo> {
  coins += 1;
  const coin = { txid: idOf(`${label} ${coins}`), vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(lock, coin);
  return coin;
}

async function deployWorld(): Promise<World> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
  const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const changeAddress = wallet.address;
  await fundShippedFacets(network);
  const deployment = await deployFramedProxy({
    provider: network,
    implementationArtifact: TOKEN,
    proxyArtifact: PROXY,
    implementationDeploy: { fundingUtxo: await coinAt(network, wallet.address, 'implementation'), funder, changeAddress },
    proxyDeploy: { fundingUtxo: await coinAt(network, wallet.address, 'proxy'), funder, changeAddress },
    initialize: { functionName: 'initialize', args: [ADMIN] },
    callerLockingBytecode: ADMIN,
    callerFunding: { utxo: await coinAt(network, binToHex(ADMIN), 'initialize'), funder: ADMIN_FUNDER, changeAddress },
    vm: compositionMachine(),
  });
  expect(deployment.initialize.broadcast).toBeDefined();
  const enter = async (functionName: string, args: readonly FunctionArgument[]): Promise<FramedProxyCallResult> =>
    callFramedProxyEntry({
      provider: network,
      implementationArtifact: TOKEN,
      proxyArtifact: PROXY,
      proxyCategoryId: deployment.proxy.categoryId,
      implementationCategoryId: deployment.implementation.categoryId,
      functionName,
      args: [...args],
      callerUtxo: await coinAt(network, binToHex(ADMIN), functionName),
      callerLockingBytecode: ADMIN,
      funder: ADMIN_FUNDER,
      changeAddress,
      vm: compositionMachine(),
    });
  return { network, records: deployment.proxy.categoryId, enter };
}

/** Enters a call and requires it to settle: every participant accepted and the transaction broadcast. */
async function settle(
  world: World, functionName: string, args: readonly FunctionArgument[],
): Promise<FramedProxyCallResult> {
  const result = await world.enter(functionName, args);
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** A view's value, read from the deployment's records through the read path. */
async function view(world: World, functionName: string, args: readonly FunctionArgument[] = []): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.network, artifact: TOKEN, categoryId: world.records, functionName, args,
  });
  expect(read.accepted).toBe(true);
  return read.value;
}

/**
 * How many mutable NFTs the deployment's category holds, its records and its nodes: a call that creates no node
 * leaves the count as it found it, whatever event outputs it adds.
 */
async function heldCount(world: World): Promise<number> {
  return (await world.network.getUtxosByTokenCategory(world.records))
    .filter((utxo) => utxo.token?.nft?.capability === 'mutable').length;
}

/**
 * The master's verdict on a settled burn of `from`, whose skipped write kept a node, and on the same call with that
 * node's group restated as a record the frame changes: the declaration and the output it settles to alike.
 */
function expectRestatedSkipRefused(result: FramedProxyCallResult, from: Uint8Array): void {
  const frame = result.verdicts.find((verdict) => verdict.id === FRAME)!;
  expect(frame.accepted).toBe(true);
  const block = structuredClone(result.draft.blockOf(FRAME)) as WitnessBlock;
  const records = block.segments.flat();
  // The nodes sit at the lock of the debited node's input; the skipped write's group is the one node record the
  // segment declares kept.
  const lockOf = (index: number): string => binToHex(result.sourceOutputs[index]!.lockingBytecode);
  const debited = records.find((record) => record.viewIn.length >= 64
    && bytesToHex(decodeEntryCommitment(record.viewIn).slot) === bytesToHex(keyToSlotMulti([from])))!;
  const kept = records.filter((record) => record.in !== 0xffff && lockOf(record.in) === lockOf(debited.in)
    && bytesToHex(record.viewIn) === bytesToHex(record.viewOut));
  expect(kept.length).toBe(1);
  const index = kept[0]!.out;
  const restated = concatBytes([kept[0]!.viewOut, Uint8Array.of(1)]);
  for (const record of block.segments.flat()) if (record.out === index) record.viewOut = restated;
  const { rest } = splitFirstPush(result.transaction.inputs[frame.index]!.unlockingBytecode);
  const mutated = {
    ...result.transaction,
    inputs: result.transaction.inputs.map((input, at) => (at === frame.index
      ? { ...input, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]) }
      : input)),
    outputs: result.transaction.outputs.map((output, at) => (at === index
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: restated } } }
      : output)),
  };
  const vm = compositionMachine();
  const verdict = (transaction: FramedProxyCallResult['transaction']): unknown => vm.stateSuccess(
    vm.evaluate({ inputIndex: frame.index, sourceOutputs: result.sourceOutputs, transaction }),
  );
  expect(verdict(result.transaction)).toBe(true);
  expect(verdict(mutated)).not.toBe(true);
}

describe('an OpenZeppelin-v5-shaped _update whose zero-address write the body skips', () => {
  it('publishes the condition each balance write runs under', () => {
    for (const entry of ['mint', 'burn', 'transfer']) {
      const writes = TOKEN.abi.find((candidate) => candidate.name === entry)!.entryAccesses!
        .filter((access) => access.collection === 'balances' && access.operations.includes('write'));
      expect(writes.length).toBe(2);
      for (const access of writes) {
        expect(access.activation).toBeDefined();
        expect(access.activation).not.toStrictEqual({ kind: 'unsupported' });
      }
    }
  });

  it('mints, transfers and burns, the balances and the total supply read back', async () => {
    const world = await deployWorld();
    // The first mint splices its node in through the head, the predecessor the zero address's skipped write keeps.
    const nodes = await heldCount(world);
    await settle(world, 'mint', [A, 100n]);
    expect(await heldCount(world)).toBe(nodes + 1);
    expect([await view(world, 'balanceOf', [A]), await view(world, 'totalSupply')]).toStrictEqual([100n, 100n]);
    await settle(world, 'mint', [ADMIN, 50n]);
    await settle(world, 'transfer', [B, 20n]);
    await settle(world, 'transfer', [A, 5n]);
    const held = await heldCount(world);
    const burned = await settle(world, 'burn', [A, 30n]);
    expect(await heldCount(world)).toBe(held);
    const balances = [await view(world, 'balanceOf', [A]), await view(world, 'balanceOf', [ADMIN]),
      await view(world, 'balanceOf', [B])];
    expect(balances).toStrictEqual([75n, 25n, 20n]);
    expect(await view(world, 'totalSupply')).toBe(120n);
    expectRestatedSkipRefused(burned, A);
  }, 1_200_000);
});
