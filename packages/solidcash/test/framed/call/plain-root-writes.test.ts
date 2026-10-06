import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { concatBytes, encodeWitnessBlock, splitFirstPush, type Artifact, type WitnessBlock } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A plain deployment's own mapping writes on the plain call path (`callFramedEntry`), with no call beside them.
 *
 * The call path plans a root frame's writes with the hop's own planner (`hopEntryWrites`), on the root's own records,
 * nodes and category: one sorted batch per collection, and a value that chunks laid with its run of chunk records.
 * An ERC-20 `transferFrom` entered by a user writes the allowance and both balances, two collections; a profile
 * stores a `string` per address, a value long enough to take chunk records and then a short one over it; an escrow
 * opens a struct record per id, a value that chunks too; and a mint writes one collection of fixed-width values.
 * Each settles and is read back through the views. A transfer whose plan declares the allowance unspent is refused by
 * the transferring frame itself.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Coin {',
  '  uint256 public supply;',
  '  mapping(address => uint256) internal balances;',
  '  mapping(address => mapping(address => uint256)) internal allowances;',
  '  function mint(address to, uint256 amount) external { supply += amount; balances[to] += amount; }',
  '  function approve(address spender, uint256 amount) external { allowances[msg.sender][spender] = amount; }',
  '  function transferFrom(address from, address to, uint256 amount) external {',
  '    require(allowances[from][msg.sender] >= amount, "allowance");',
  '    allowances[from][msg.sender] -= amount;',
  '    require(balances[from] >= amount, "balance");',
  '    balances[from] -= amount;',
  '    balances[to] += amount;',
  '  }',
  '  function balanceOf(address who) external view returns (uint256) { return balances[who]; }',
  '  function allowance(address owner, address spender) external view returns (uint256) {',
  '    return allowances[owner][spender];',
  '  }',
  '}',
  'contract Profiles {',
  '  uint256 public count;',
  '  mapping(address => string) internal names;',
  '  function setName(string calldata name) external { names[msg.sender] = name; count += 1; }',
  '  function nameOf(address who) external view returns (string memory) { return names[who]; }',
  '}',
  'contract Escrow {',
  '  struct Deal { address payee; uint256 amount; }',
  '  mapping(uint256 => Deal) private deals;',
  '  function open(uint256 id, address payee, uint256 amount) external { deals[id] = Deal(payee, amount); }',
  '  function amountOf(uint256 id) external view returns (uint256) { return deals[id].amount; }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { solidityImportCompat: true, composition: 'framed' } as never);

/** The user who deploys and enters every call: each frame's `msg.sender`. */
const USER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
/** Another holder, whose hash bytes are distinct. */
const OTHER_LOCK = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x5e), 0x88, 0xac]);
/** Past the 60 bytes a node's tail holds inline, so the node keeps the value's digest and its bytes take chunks. */
const LONG_NAME = 'a display name long enough that its node keeps a digest and its bytes take chunk records';

/** One mock chain, the user's wallet and a coin factory. */
interface World {
  readonly provider: MockNetworkProvider;
  readonly wallet: Contract;
  readonly coin: (lock: string) => Promise<Utxo>;
}

/** A plain deployment of one contract. */
interface Deployed {
  readonly artifact: Artifact;
  readonly categoryId: string;
}

/** The chain every case runs on, and the contracts deployed on it. */
interface Chain {
  readonly world: World;
  readonly coin: Deployed;
  readonly profiles: Deployed;
  readonly escrow: Deployed;
}

let worldRun: Promise<Chain> | undefined;

/** The chain every case runs on, with the token, the profiles and the escrow deployed without a proxy. */
function chain(): Promise<Chain> {
  worldRun ??= (async (): Promise<Chain> => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider });
    await fundShippedFacets(provider);
    let serial = 0;
    const world: World = {
      provider,
      wallet,
      coin: async (lock) => {
        serial += 1;
        const utxo = { txid: `71${serial.toString(16).padStart(6, '0')}`.padEnd(64, 'd'), vout: 0, satoshis: 5_000_000n };
        await provider.addUtxo(lock, utxo);
        return utxo;
      },
    };
    const deploy = async (artifact: Artifact): Promise<Deployed> => {
      const deployment = await deployStatefulContract(artifact, [], {
        provider, fundingUtxo: await world.coin(wallet.address), changeAddress: wallet.address,
        funder: wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      });
      return { artifact, categoryId: deployment.categoryId };
    };
    return {
      world, coin: await deploy(artifacts.Coin!), profiles: await deploy(artifacts.Profiles!),
      escrow: await deploy(artifacts.Escrow!),
    };
  })();
  return worldRun;
}

/** One call of a plain deployment's entry through the plain call path, entered by the user's own coin. */
async function enter(
  world: World, deployed: Deployed, functionName: string, args: readonly FunctionArgument[],
): Promise<FramedCallResult> {
  return callFramedEntry({
    provider: world.provider,
    artifact: deployed.artifact,
    categoryId: deployed.categoryId,
    functionName,
    args,
    callerUtxo: await world.coin(binToHex(USER_LOCK)),
    callerLockingBytecode: USER_LOCK,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    changeAddress: world.wallet.address,
    vm: compositionMachine(),
  });
}

/** One call that has to settle: every participant accepted and the transaction broadcast. */
async function settle(
  world: World, deployed: Deployed, functionName: string, args: readonly FunctionArgument[],
): Promise<FramedCallResult> {
  const result = await enter(world, deployed, functionName, args);
  expect(result.verdicts.filter((verdict) => !verdict.accepted), functionName).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

/** A view's value, read from the deployment's records and nodes through the read path. */
async function view(
  world: World, deployed: Deployed, functionName: string, args: readonly FunctionArgument[] = [],
): Promise<unknown> {
  const read = await readFramedEntry({
    provider: world.provider, artifact: deployed.artifact, categoryId: deployed.categoryId, functionName,
    args: [...args], vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return read.value;
}

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

/** The participants the machine refuses on a transaction, by id. */
function refusedOn(result: FramedCallResult, transaction: VmTransaction): readonly string[] {
  const vm = compositionMachine();
  return result.draft.layout.participants.filter((placed) => vm.stateSuccess(vm.evaluate({
    inputIndex: placed.index, sourceOutputs: result.sourceOutputs, transaction,
  })) !== true).map((placed) => placed.id);
}

describe('a plain root\'s own mapping writes on the plain call path', () => {
  it('settles a mint: one collection, fixed-width values', async () => {
    const { world, coin } = await chain();
    await settle(world, coin, 'mint', [USER_LOCK, 100n]);
    expect([await view(world, coin, 'supply'), await view(world, coin, 'balanceOf', [USER_LOCK])])
      .toStrictEqual([100n, 100n]);
  }, 600_000);

  it('settles transferFrom across two collections, and reads back the balances and the allowance', async () => {
    const { world, coin } = await chain();
    await settle(world, coin, 'approve', [USER_LOCK, 50n]);
    const moved = await settle(world, coin, 'transferFrom', [USER_LOCK, OTHER_LOCK, 10n]);
    // One batch per collection: the allowance's node and the balances' nodes, each named by its collection.
    const nodes = moved.draft.layout.participants.map((placed) => placed.id)
      .filter((id) => id.startsWith('mapping-node-'));
    expect(nodes.filter((id) => id.startsWith('mapping-node-allowances-'))).toHaveLength(1);
    expect(nodes.filter((id) => id.startsWith('mapping-node-balances-')).length).toBeGreaterThan(0);
    expect([
      await view(world, coin, 'balanceOf', [USER_LOCK]),
      await view(world, coin, 'balanceOf', [OTHER_LOCK]),
      await view(world, coin, 'allowance', [USER_LOCK, USER_LOCK]),
    ]).toStrictEqual([90n, 10n, 40n]);
  }, 600_000);

  it('settles a string stored per address, through its run of chunk records, and reads it back', async () => {
    const { world, profiles } = await chain();
    await settle(world, profiles, 'setName', [LONG_NAME]);
    expect([await view(world, profiles, 'nameOf', [USER_LOCK]), await view(world, profiles, 'count')])
      .toStrictEqual([LONG_NAME, 1n]);
    // The same node rewritten in place with a value its tail holds.
    await settle(world, profiles, 'setName', ['alice']);
    expect([await view(world, profiles, 'nameOf', [USER_LOCK]), await view(world, profiles, 'count')])
      .toStrictEqual(['alice', 2n]);
  }, 600_000);

  it('settles a struct record opened per id, whose value chunks, and reads it back', async () => {
    const { world, escrow } = await chain();
    await settle(world, escrow, 'open', [1n, OTHER_LOCK, 50n]);
    await settle(world, escrow, 'open', [2n, USER_LOCK, 7n]);
    expect([await view(world, escrow, 'amountOf', [1n]), await view(world, escrow, 'amountOf', [2n])])
      .toStrictEqual([50n, 7n]);
  }, 600_000);

  it('refuses at the transferring frame a plan that declares the allowance unspent', async () => {
    const { world, coin } = await chain();
    const moved = await settle(world, coin, 'transferFrom', [USER_LOCK, OTHER_LOCK, 5n]);
    expect(refusedOn(moved, structuredClone(moved.transaction) as VmTransaction)).toStrictEqual([]);
    // The allowance's node declared as it was spent, and its output carrying that same view: only the frame's own
    // computation of the allowance it spends can tell.
    const node = moved.draft.layout.participants.find((placed) => placed.id.startsWith('mapping-node-allowances-'))!;
    const block = structuredClone(moved.draft.blockOf('master')) as WitnessBlock;
    const declared = block.segments[0]!.find((entry) => entry.in === node.index)!;
    declared.viewOut = Uint8Array.from(declared.viewIn);
    const forged = structuredClone(moved.transaction) as VmTransaction;
    const output = forged.outputs[node.index]!;
    forged.outputs[node.index] = {
      ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: Uint8Array.from(declared.viewIn) } },
    };
    const master = moved.draft.layout.participants.find((placed) => placed.id === 'master')!;
    const { rest } = splitFirstPush(forged.inputs[master.index]!.unlockingBytecode);
    forged.inputs[master.index] = {
      ...forged.inputs[master.index]!,
      unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]),
    };
    expect(refusedOn(moved, forged)).toContain('master');
  }, 600_000);
});
