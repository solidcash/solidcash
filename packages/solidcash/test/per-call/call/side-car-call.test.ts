import { describe, expect, it, beforeAll } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { SHARED_LIBRARY_SALT, buildPushdataCommitment, bytesToHex, keccakComputeLockingBytecode } from '@solidcash/utils';
import { ethers } from 'ethers';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { computeEcrecoverWitness } from '../../../src/ecrecover/ecrecoverRecovery.js';
import { probeEcrecoverSplit } from '../../../src/ecrecover/ecrecoverComputeSidecar.js';
import { participant } from '../../../src/per-call/composer/index.js';
import { PerCallSideCarPoolError, callPerCallEntry } from '../../../src/per-call/call/index.js';
import type { Artifact } from '@solidcash/utils';
import type NetworkProvider from '../../../src/network/NetworkProvider.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * A call whose entry hashes through keccak256 and recovers a signer, on the shipped call path.
 *
 * The entry recovers the key that signed a digest it hashes itself, one keccak256 call nested in another as a
 * signed-message digest is, and bumps a counter only when that key is the owner's. The call path reads the
 * recovery's and the hashes' side-cars off the entry's ABI row, spends live side-car UTXOs at the covenants' shared
 * locks (the mock network is provisioned with them), and leaves every value the body computes to the derivation. The
 * machine's verdict on every input, and the record the broadcast writes, are the assertions.
 */

const CATEGORY_HEX = '66'.repeat(32);
const CALLER_TXID = '77'.repeat(32);
const PREFIX = new TextEncoder().encode('per-call signed digest:');
const LEFT = new TextEncoder().encode('per-call side-car call');
/** The digest the entry hashes: the bytes the recovery builtin reads, little-endian. */
const DIGEST = keccak_256(Uint8Array.from([...PREFIX, ...keccak_256(LEFT)]));

/** A signature over the digest whose ladder splits within the side-cars' budget, with the key that made it. */
interface Signer {
  readonly v: number;
  readonly r: Uint8Array;
  readonly s: Uint8Array;
  readonly owner: Uint8Array;
}

const leBytes = (hex: string): Uint8Array => hexToBin(hex.replace(/^0x/, '')).slice().reverse();

/** Signs the digest with fresh wallets until the shipped split probe accepts the signature. */
function splittableSigner(): Signer {
  const probeUtxo = (odd: boolean): never => ({
    txid: (odd ? 'bb' : 'aa').repeat(32), vout: 1, satoshis: 100_000n,
    token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
  }) as never;
  const signed = `0x${binToHex(DIGEST.slice().reverse())}`;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const wallet = ethers.Wallet.createRandom();
    const { r, s, v } = wallet.signingKey.sign(signed);
    const signer = { v, r: leBytes(r), s: leBytes(s), owner: hexToBin(wallet.signingKey.compressedPublicKey.slice(2)) };
    try {
      probeEcrecoverSplit(computeEcrecoverWitness(DIGEST, v, signer.r, signer.s), SHARED_LIBRARY_SALT,
        probeUtxo(false), probeUtxo(true));
    } catch {
      continue;
    }
    return signer;
  }
  throw new Error('no signature with a two-covenant split after 200 draws');
}

let signer: Signer;
let guard: Artifact;

beforeAll(() => {
  signer = splittableSigner();
  guard = compileStringMulti('pragma solidcash ^0.13.0;'
    + ' contract Guard {'
    + '   int public counter;'
    + '   function bump(bytes prefix, bytes left, int v, bytes32 r, bytes32 s) {'
    + '     bytes32 h = keccak256(bytes.concat(prefix, keccak256(left)));'
    + `     require(ecrecoverPubKey(h, v, r, s) == pubkey(0x${binToHex(signer.owner)}));`
    + '     this.counter = this.counter + 1;'
    + '   }'
    + '   function current() view returns (int) { return this.counter; }'
    + ' }', { composition: 'per-call' }).Guard!;
}, 120_000);

/** The commitment the shipped encoder materializes for one counter value. */
const commitment = (value: bigint): string => buildPushdataCommitment(guard.stateLayout!, { counter: value }, 0);

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerLock: Uint8Array;
  readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
}

/** Deploys the contract through the shipped deployment and funds the caller's coin at its P2PKH lock. */
async function deploy(): Promise<Deployed> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signature = new SignatureTemplate(alicePriv);
  const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo = { txid: CATEGORY_HEX, vout: 0, satoshis: 500_000n };
  await provider.addUtxo(funder.address, fundingUtxo);
  const deployment = await deployStatefulContract(guard, [], {
    provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
  });
  return {
    provider, categoryId: deployment.categoryId, callerLock: encodeLockingBytecodeP2pkh(alicePkh),
    funder: signature.unlockP2PKH(),
  };
}

/** Calls `bump` with the signature through the shipped call path, on a caller coin funded for it. */
async function bump(deployed: Deployed, txid: string, provider: NetworkProvider = deployed.provider):
ReturnType<typeof callPerCallEntry> {
  const callerUtxo = { txid, vout: 0, satoshis: 300_000n };
  await deployed.provider.addUtxo(binToHex(deployed.callerLock), callerUtxo);
  return callPerCallEntry({
    provider,
    artifact: guard,
    categoryId: deployed.categoryId,
    functionName: 'bump',
    args: [PREFIX, LEFT, BigInt(signer.v), signer.r, signer.s],
    callerUtxo,
    callerLockingBytecode: deployed.callerLock,
    funder: deployed.funder,
    vm: compositionMachine(),
  });
}

describe('a call whose entry hashes and recovers through compute side-cars', () => {
  it('spends live side-cars after its master, learns what the body computes, and broadcasts; twice', async () => {
    const deployed = await deploy();
    const first = await bump(deployed, CALLER_TXID);
    expect(first.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    const ids = ['master/recovery-A0', 'master/recovery-B0', 'master/keccak-0', 'master/keccak-1'];
    const masterIndex = participant(first.draft.layout, 'master').index;
    expect(ids.map((id) => participant(first.draft.layout, id).index))
      .toStrictEqual(ids.map((_, offset) => masterIndex + 1 + offset));
    expect(bytesToHex(first.writtenCommitments[0]!)).toBe(commitment(1n));
    expect(first.broadcast).toBeDefined();

    // Every side-car recreates at its own lock, so the pool the first call spent is the one the second spends.
    const lock = keccakComputeLockingBytecode(SHARED_LIBRARY_SALT, true);
    const pool = await deployed.provider.getUtxosForLockingBytecode(lock);
    expect(pool.map((utxo) => utxo.txid)).toStrictEqual([first.broadcast!.txid, first.broadcast!.txid]);
    const second = await bump(deployed, '88'.repeat(32));
    expect(second.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(bytesToHex(second.writtenCommitments[0]!)).toBe(commitment(2n));
    expect(second.broadcast).toBeDefined();
  }, 120_000);

  it('refuses by name a call on a network whose side-car pool is short', async () => {
    const deployed = await deploy();
    // A provider that cannot mint stand-ins, as a real network cannot.
    const unminted = Object.assign(Object.create(deployed.provider) as MockNetworkProvider, { addUtxo: undefined });
    await expect(bump(deployed, CALLER_TXID, unminted)).rejects.toThrow(PerCallSideCarPoolError);
  }, 120_000);
});
