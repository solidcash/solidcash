import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { addressToLockScript, lockingBytecodeToSolidityAddressPayload } from '../../../src/utils.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, bobPkh, bobPriv } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A contract stores another deployed contract's address through an owner-only setter, on the plain call path.
 *
 * Both contracts are deployed without a proxy, and the argument is the other contract's own address as its handle
 * presents it (`getAddress()`): a 35-byte P2SH32 lock. The storing contract is compiled for a wide commitment, so
 * its one state record also holds the addresses its constructor took, and the record's view outgrows 128 bytes.
 * The view the setter writes is the body's own, learned from the record's close up to the commitment the deployment
 * holds: before, the composer learned no view past 128 bytes, so the master's close compared the commitment the
 * body computed with the placeholder and failed.
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
  '  address public first;',
  '  address public second;',
  '  address public third;',
  '  event DataAddressChanged(address a);',
  '  constructor(address first_, address second_, address third_) Owned(msg.sender) {',
  '    first = first_; second = second_; third = third_;',
  '  }',
  '  function setDataAddress(address a) public onlyOwner { data = Data(a); emit DataAddressChanged(a); }',
  '}',
].join('\n');

const artifacts = compileStringMulti(SOURCE, {
  solidityImportCompat: true, composition: 'framed', commitmentLimit: 10_000_000,
} as never);

/** The owner: the user who deploys both contracts and calls the setter. */
const OWNER_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
/** A user who is not the owner. */
const STRANGER_LOCK = encodeLockingBytecodeP2pkh(bobPkh);
/** The contract-shaped addresses the registry's constructor stores, each a distinct P2SH32 lock. */
const PEER_LOCKS = [0x31, 0x32, 0x33].map((fill) => encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(fill)));

/** One mock chain with both contracts deployed by the owner without a proxy. */
interface Chain {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  /** The data contract's address as its handle presents it. */
  readonly dataAddress: string;
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
      const utxo = { txid: `75${serial.toString(16).padStart(6, '0')}`.padEnd(64, 'e'), vout: 0, satoshis: 5_000_000n };
      await provider.addUtxo(binToHex(lock), utxo);
      return utxo;
    };
    const changeAddress = new Contract(p2pkhArtifact, [alicePkh], { provider }).address;
    const deploy = async (artifact: Artifact, args: Uint8Array[]): ReturnType<typeof deployStatefulContract> =>
      deployStatefulContract(artifact, args, {
        provider, fundingUtxo: await coin(OWNER_LOCK), changeAddress,
        funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      });
    const data = await deploy(artifacts.Data!, []);
    const registry = await deploy(artifacts.Registry!, PEER_LOCKS);
    return {
      provider, artifact: artifacts.Registry!, categoryId: registry.categoryId,
      dataAddress: await data.contract.getAddress(), coin,
    };
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

/** The 20-byte identity the read path answers for an address, as hex. */
function identityOf(lock: Uint8Array): string {
  return binToHex(lockingBytecodeToSolidityAddressPayload(lock)!);
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

describe('a contract stores another contract\'s address through an owner-only setter, on the plain call path', () => {
  it('settles the owner\'s call, and the record holds the whole lock the address names', async () => {
    const world = await chain();
    const dataLock = addressToLockScript(world.dataAddress);
    expect(dataLock.length).toBe(35);
    const result = await enter(world, OWNER_LOCK, alicePriv, [world.dataAddress]);
    expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);

    // The written record is wider than 128 bytes and carries the address at its full width beside the peers.
    const record = result.writtenCommitments[0]!;
    expect(record.length).toBeGreaterThan(128);
    expect(binToHex(record)).toContain(binToHex(dataLock));
    expect(PEER_LOCKS.every((lock) => binToHex(record).includes(binToHex(lock)))).toBe(true);

    expect([await viewHex(world, 'data'), await viewHex(world, 'owner'), await viewHex(world, 'third')])
      .toStrictEqual([identityOf(dataLock), identityOf(OWNER_LOCK), identityOf(PEER_LOCKS[2]!)]);
  }, 600_000);

  it('refuses a caller who is not the owner at the frame\'s own check, with nothing broadcast', async () => {
    const world = await chain();
    const result = await enter(world, STRANGER_LOCK, bobPriv, [world.dataAddress]);
    expect(result.verdicts.find((verdict) => verdict.id === 'master')?.accepted).toBe(false);
    expect(result.broadcast).toBeUndefined();
    expect(await viewHex(world, 'owner')).toBe(identityOf(OWNER_LOCK));
  }, 600_000);
});
