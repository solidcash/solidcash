/**
 * The genesis layout (docs/bcmr/DESIGN.md, 4.1, 5.2, 6.2 and 9): the AuthKey right after the publication and its coin
 * after the token coin, the default snapshot time, the container key a premint of the contract's own category is
 * checked against, and the refusals of a framed premint of that category and of a governed deploy without its event.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileFile } from 'solidc';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';
import { BCMR_PUBLICATION_PREFIX, authGuardLockingBytecode, type NativeTokenOptions } from '../../src/bcmr/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { getTokenContainerAddress } from '../../src/stateful/covenant-helpers.js';
import { StatefulContract, type DeployResult } from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { alicePriv, aliceTokenAddress } from '../fixture/vars.js';
import { fundShippedFacets } from '../framed/shapes/harness.js';

const COUNTER = `pragma solidcash >=0.8.0;
contract Counter() {
  int count;
  function bump() { this.count = this.count + 1; require(this.count > 0); }
}`;

const FRAMED = 'pragma solidcash ^0.13.0; contract C { int n;'
  + ' function touch() { this.n = this.n + 1; require(this.n > 0); } }';

const TOKEN = new URL('../fixture/bcmr_metadata_token.scash', import.meta.url);
const TIMESTAMP = '2026-10-20T12:00:00.000Z';

// The coin helpers of BcmrDeployment.test.ts.
async function signerWithCoins(provider: MockNetworkProvider, coins = 3): Promise<Signer> {
  const [alice] = await provider.getSigners(1, { fundingUtxos: coins, genesisFundingUtxos: coins });
  return alice as unknown as Signer;
}

async function genesisCoin(signer: Signer, skip: readonly Utxo[] = []): Promise<Utxo> {
  const coin = (await signer.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined
    && utxo.satoshis >= 100_000n && !skip.some((other) => other.txid === utxo.txid));
  if (coin === undefined) throw new Error('no genesis coin left');
  return coin;
}

/** A vout-0 coin at `signer`'s lock whose txid starts with the two hex characters `tag`. */
async function coinAt(provider: MockNetworkProvider, signer: Signer, tag: string): Promise<Utxo> {
  const utxo = { txid: tag.padEnd(64, '7'), vout: 0, satoshis: 2_000_000n };
  await provider.addUtxo(signer.getAddress(), utxo);
  return utxo;
}

async function isUnspent(signer: Signer, coin: Utxo): Promise<boolean> {
  return (await signer.getUtxos()).some((utxo) => utxo.txid === coin.txid && utxo.vout === coin.vout);
}

function outpointTxids(result: DeployResult): string[] {
  return result.tx.inputs.map((input) => binToHex(input.outpointTransactionHash));
}

/** `output` is an AuthKey: an immutable NFT of `category` at `holder`'s lock. */
function expectAuthKey(output: DeployResult['tx']['outputs'][number] | undefined, category: string, holder: Signer): void {
  expect(binToHex(output!.token!.category)).toBe(category);
  expect(output!.token!.nft?.capability).toBe('none');
  expect(binToHex(output!.lockingBytecode)).toBe(binToHex(holder.getLockingBytecode()));
}

// The builders of BcmrIdentityPolicies.test.ts.
const BUILDERS = [
  {
    builder: 'direct',
    provider: (): MockNetworkProvider => new MockNetworkProvider(),
    artifact: (): Artifact => compileString(COUNTER, { forceStateful: true }),
    options: { initialState: {} },
  },
  {
    builder: 'framed',
    provider: (): MockNetworkProvider => new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS }),
    artifact: (): Artifact => compileStringMulti(FRAMED, { composition: 'framed' }).C!,
    options: {},
  },
];

describe('the leading outputs and the genesis coins (4.1)', () => {
  for (const { builder, provider: newProvider, artifact: compile, options } of BUILDERS) {
    it(`puts the AuthKey after the publication, else at output 1, its coin after the token coin (${builder})`, async () => {
      const provider = newProvider();
      if (builder === 'framed') await fundShippedFacets(provider);
      const artifact = compile();
      const alice = new Signer(alicePriv, provider);
      const tag = builder === 'direct' ? 'd' : 'f';
      const [fundingUtxo, token, authKeyFunding] = [
        await coinAt(provider, alice, `${tag}1`), await coinAt(provider, alice, `${tag}2`),
        await coinAt(provider, alice, `${tag}3`),
      ];
      const base = { provider, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), ...options };

      const published = await StatefulContract.deploy(artifact, [], {
        ...base, fundingUtxo,
        identity: { kind: 'authguard', authKeyFunding },
        nativeToken: { funding: token, bearer: { amount: 1000n, to: aliceTokenAddress } },
        bcmr: { name: 'Layout', timestamp: TIMESTAMP },
      });
      expect(outpointTxids(published)).toEqual([fundingUtxo.txid, token.txid, authKeyFunding.txid]);
      const [identity, publication, authKey, master] = published.tx.outputs;
      expect(binToHex(identity!.lockingBytecode)).toBe(binToHex(authGuardLockingBytecode(authKeyFunding.txid)));
      expect(binToHex(publication!.lockingBytecode.slice(0, 6))).toBe(binToHex(BCMR_PUBLICATION_PREFIX));
      expectAuthKey(authKey, authKeyFunding.txid, alice);
      expect(master!.token?.nft?.capability).toBe('minting');

      // Without a token coin the AuthKey coin is input 1; without a publication the AuthKey is output 1.
      const bareFunding = await coinAt(provider, alice, `${tag}4`);
      const bareKeyFunding = await coinAt(provider, alice, `${tag}5`);
      const bare = await StatefulContract.deploy(artifact, [], {
        ...base, fundingUtxo: bareFunding, identity: { kind: 'authguard', authKeyFunding: bareKeyFunding },
      });
      expect(outpointTxids(bare)).toEqual([bareFunding.txid, bareKeyFunding.txid]);
      expectAuthKey(bare.tx.outputs[1], bareKeyFunding.txid, alice);
      expect(bare.tx.outputs[2]!.token?.nft?.capability).toBe('minting');
    });
  }
});

describe('the registry snapshot (5.2)', () => {
  it('keys the snapshot by the deployment time when the publication states no timestamp', async () => {
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const fundingUtxo = await genesisCoin(alice);
    const before = Date.now();
    const result = await StatefulContract.deploy(compileString(COUNTER, { forceStateful: true }), [], {
      provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), initialState: {},
      bcmr: { name: 'Counter' },
    });
    const after = Date.now();
    const { registry } = result.registry!;
    const timestamps = Object.keys(registry.identities![result.categoryId]!);
    expect(timestamps).toHaveLength(1);
    const timestamp = timestamps[0]!;
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(registry.latestRevision).toBe(timestamp);
    expect(Date.parse(timestamp)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(timestamp)).toBeLessThanOrEqual(after);
  });
});

describe('a token of the contract\'s own category (6.2)', () => {
  it('checks a premint of the contract category against the category the contract keys its container by', async () => {
    const artifact = compileFile(TOKEN, { messageBus: false });
    const provider = new MockNetworkProvider();
    const alice = await signerWithCoins(provider);
    const funding = await genesisCoin(alice);
    const deploy = (keyCategory: string): Promise<DeployResult> => StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: funding, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(),
      initArgs: [hexToBin(keyCategory)], nativeToken: { reserve: 5000n },
    });
    await expect(deploy('ee'.repeat(32))).rejects.toThrow(
      /keys its reserve by category e{64}, but without nativeToken\.funding the token is the contract's own category/,
    );
    expect(await isUnspent(alice, funding)).toBe(true);

    // Keyed by C, the premint is C's fungible amount at the container the contract keys by C.
    const result = await deploy(funding.txid);
    const reserveLock = addressToLockScript(getTokenContainerAddress(result.contract.inner, result.categoryId,
      funding.txid));
    const reserve = result.tx.outputs.find((output) => binToHex(output.lockingBytecode) === binToHex(reserveLock));
    expect(reserve?.token?.amount).toBe(5000n);
    expect(binToHex(reserve!.token!.category)).toBe(funding.txid);
    expect(reserve!.token!.nft).toBeUndefined();
  });

  it('refuses a framed premint or bearer supply without nativeToken.funding', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const alice = new Signer(alicePriv, provider);
    const fundingUtxo = await coinAt(provider, alice, 'c8');
    const artifact = compileStringMulti(FRAMED, { composition: 'framed' }).C!;
    const tokens: NativeTokenOptions[] = [{ reserve: 1000n }, { bearer: { amount: 1000n, to: aliceTokenAddress } }];
    for (const nativeToken of tokens) {
      await expect(StatefulContract.deploy(artifact, [], {
        provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), nativeToken,
      })).rejects.toThrow(/is framed, and a framed composition refuses fungible tokens of the contract's own category/);
    }
    expect(await isUnspent(alice, fundingUtxo)).toBe(true);
  });
});

describe('a governed identity (9)', () => {
  for (const { builder, provider: newProvider, artifact: compile, options } of BUILDERS) {
    it(`refuses an artifact without MetadataUpdated(bytes32,bytes32) before broadcasting (${builder})`, async () => {
      const provider = newProvider();
      if (builder === 'framed') await fundShippedFacets(provider);
      const alice = new Signer(alicePriv, provider);
      const fundingUtxo = await coinAt(provider, alice, builder === 'direct' ? 'd9' : 'f9');
      const artifact = compile();
      // An event of that name with other parameters does not count.
      const misshapen: Artifact = {
        ...artifact,
        events: [...(artifact.events ?? []), {
          name: 'MetadataUpdated',
          signature: 'MetadataUpdated(bytes32,int256)',
          parameters: [{ name: 'registryHash', type: 'bytes32' }, { name: 'identityTxid', type: 'int256' }],
        }],
      };
      for (const candidate of [artifact, misshapen]) {
        await expect(StatefulContract.deploy(candidate, [], {
          provider, fundingUtxo, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), ...options,
          identity: { kind: 'governed' },
        })).rejects.toThrow(/emits no MetadataUpdated\(bytes32 registryHash, bytes32 identityTxid\): inherit BcmrGoverned/);
      }
      expect(await isUnspent(alice, fundingUtxo)).toBe(true);
    });
  }
});
