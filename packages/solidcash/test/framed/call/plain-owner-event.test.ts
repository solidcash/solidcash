import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
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
import { alicePkh, alicePriv, bobPkh, bobPriv } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * An owner-guarded setter that writes a contract-typed field and emits, on the plain call path (`callFramedEntry`).
 *
 * The owner is the deployer, set by the constructor from `msg.sender`, and the setter checks it before it writes the
 * field and emits. The owner's call settles, the field and the owner read back, and the event output carries the
 * payload the body computed: a forged payload is refused by the frame itself. A caller who is not the owner is refused
 * by the frame's own check, which stops the run before the event: the call reports that refusal in its verdicts
 * rather than claiming the event's payload was never handed back.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'contract Data {',
  '  uint256 public value;',
  '  function set(uint256 v) external { value = v; }',
  '}',
  'abstract contract Owned {',
  '  address private _owner;',
  '  error UnauthorizedAccount(address account);',
  '  constructor(address initialOwner) { _owner = initialOwner; }',
  '  modifier onlyOwner() { _checkOwner(); _; }',
  '  function owner() public view virtual returns (address) { return _owner; }',
  '  function _checkOwner() internal view virtual {',
  '    if (owner() != msg.sender) revert UnauthorizedAccount(msg.sender);',
  '  }',
  '}',
  'contract Registry is Owned {',
  '  Data public data;',
  '  event DataAddressChanged(address a);',
  '  constructor() Owned(msg.sender) {}',
  '  function setDataAddress(address a) public onlyOwner { data = Data(a); emit DataAddressChanged(a); }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, { solidityImportCompat: true, composition: 'framed' } as never);

/** The owner: the user who deploys and calls the setter. */
const OWNER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
/** A user who is not the owner. */
const STRANGER_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
/** The address the setter stores, whose hash bytes are distinct. */
const TARGET_LOCK = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x5e), 0x88, 0xac]);

/** One mock chain with the registry deployed by the owner without a proxy. */
interface Chain {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly coin: (lock: Uint8Array) => Promise<Utxo>;
}

let chainRun: Promise<Chain> | undefined;

function chain(): Promise<Chain> {
  chainRun ??= (async (): Promise<Chain> => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    await fundShippedFacets(provider);
    let serial = 0;
    const coin = async (lock: Uint8Array): Promise<Utxo> => {
      serial += 1;
      const utxo = { txid: `73${serial.toString(16).padStart(6, '0')}`.padEnd(64, 'e'), vout: 0, satoshis: 5_000_000n };
      await provider.addUtxo(binToHex(lock), utxo);
      return utxo;
    };
    const artifact = artifacts.Registry!;
    // The owner's own P2PKH coin funds the genesis, so the constructor's `msg.sender` is the owner's lock.
    const changeAddress = new Contract(p2pkhArtifact, [alicePkh], { provider }).address;
    const deployment = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo: await coin(OWNER_LOCK), changeAddress,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
    });
    return { provider, artifact, categoryId: deployment.categoryId, coin };
  })();
  return chainRun;
}

/** One call of the setter, entered by the given user's own coin. */
async function enter(
  world: Chain, callerLock: Uint8Array, callerPriv: Uint8Array, args: readonly FunctionArgument[],
): Promise<FramedCallResult> {
  return callFramedEntry({
    provider: world.provider,
    artifact: world.artifact,
    categoryId: world.categoryId,
    functionName: 'setDataAddress',
    args,
    callerUtxo: await world.coin(callerLock),
    callerLockingBytecode: callerLock,
    funder: new SignatureTemplate(callerPriv).unlockP2PKH(),
    changeAddress: new Contract(p2pkhArtifact, [alicePkh], { provider: world.provider }).address,
    vm: compositionMachine(),
  });
}

/** The 20-byte hash a P2PKH lock pays, which the read path answers for an address. */
function hashOf(lock: Uint8Array): string {
  return binToHex(lock.slice(3, 23));
}

/** A view's value, read from the deployment's records through the read path, as hex. */
async function viewHex(world: Chain, functionName: string): Promise<string> {
  const read = await readFramedEntry({
    provider: world.provider, artifact: world.artifact, categoryId: world.categoryId, functionName, args: [],
    vm: compositionMachine(),
  });
  expect(read.accepted, read.objection).toBe(true);
  return binToHex(read.value as Uint8Array);
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

describe('an owner-guarded setter that writes a contract-typed field and emits, on the plain call path', () => {
  it('settles the owner\'s call, reads the field and the owner back, and refuses a forged event payload', async () => {
    const world = await chain();
    const result = await enter(world, OWNER_LOCK, alicePriv, [TARGET_LOCK]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect([await viewHex(world, 'data'), await viewHex(world, 'owner')])
      .toStrictEqual([hashOf(TARGET_LOCK), hashOf(OWNER_LOCK)]);

    // The event's output leads the trailing region, past every participant; its payload carries the address set.
    const eventIndex = result.draft.layout.participantCount;
    const transaction = structuredClone(result.transaction) as VmTransaction;
    expect(refusedOn(result, transaction)).toStrictEqual([]);
    const output = transaction.outputs[eventIndex]!;
    const payload = output.token!.nft!.commitment;
    expect(binToHex(payload)).toContain(hashOf(TARGET_LOCK));
    const forged = Uint8Array.from(payload);
    forged[forged.length - 1] ^= 0x01;
    transaction.outputs[eventIndex] = {
      ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: forged } },
    };
    expect(refusedOn(result, transaction)).toContain('master');
  }, 600_000);

  it('refuses a caller who is not the owner at the frame\'s own check, with nothing broadcast', async () => {
    const world = await chain();
    const result = await enter(world, STRANGER_LOCK, bobPriv, [STRANGER_LOCK]);
    expect(result.verdicts.find((verdict) => verdict.id === 'master')?.accepted).toBe(false);
    expect(result.broadcast).toBeUndefined();
    // The owner's field is unchanged: the stranger's call wrote nothing.
    expect(await viewHex(world, 'owner')).toBe(hashOf(OWNER_LOCK));
  }, 600_000);
});
