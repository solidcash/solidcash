/**
 * The genesis layout (docs/bcmr/DESIGN.md, 4.1, 5.2 and 6.2): the authhead at output 0 and the publication at output 1
 * ahead of the masters, the token coin after the funding coin, the default snapshot time, the container key a premint
 * of the contract's own category is checked against, and the refusal of a framed premint of that category.
 */
import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileFile } from 'solidc';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../../solidc/test/framed/machine.js';
import { BCMR_PUBLICATION_PREFIX, authheadLockingBytecode, type NativeTokenOptions } from '../../src/bcmr/index.js';
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

const FRAMED = 'pragma solidcash ^0.14.0; contract C { int n;'
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

/** `output` is the authhead of `category`, holding its identity NFT for `owner`. */
function expectAuthhead(output: DeployResult['tx']['outputs'][number] | undefined, category: string, owner: Signer): void {
  expect(binToHex(output!.lockingBytecode)).toBe(binToHex(authheadLockingBytecode(category)));
  expect(binToHex(output!.token!.category)).toBe(category);
  expect(output!.token!.nft?.capability).toBe('mutable');
  expect(binToHex(output!.token!.nft!.commitment)).toBe(binToHex(owner.getLockingBytecode()));
}

// The builders of BcmrIdentityOwner.test.ts.
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
    it(`leads with the authhead and the publication, the token coin after the funding coin (${builder})`, async () => {
      const provider = newProvider();
      if (builder === 'framed') await fundShippedFacets(provider);
      const artifact = compile();
      const alice = new Signer(alicePriv, provider);
      const tag = builder === 'direct' ? 'd' : 'f';
      const [fundingUtxo, token] = [await coinAt(provider, alice, `${tag}1`), await coinAt(provider, alice, `${tag}2`)];
      const base = { provider, funder: alice.unlockP2PKH(), changeAddress: alice.getAddress(), ...options };

      const published = await StatefulContract.deploy(artifact, [], {
        ...base, fundingUtxo,
        nativeToken: { funding: token, bearer: { amount: 1000n, to: aliceTokenAddress } },
        bcmr: { name: 'Layout', timestamp: TIMESTAMP },
      });
      // The genesis creates both categories, so the token's authchain also runs through the authhead.
      expect(outpointTxids(published)).toEqual([fundingUtxo.txid, token.txid]);
      const [identity, publication, master] = published.tx.outputs;
      expectAuthhead(identity, published.categoryId, alice);
      expect(binToHex(publication!.lockingBytecode.slice(0, 6))).toBe(binToHex(BCMR_PUBLICATION_PREFIX));
      expect(master!.token?.nft?.capability).toBe('minting');

      // Without a publication the masters follow the authhead.
      const bare = await StatefulContract.deploy(artifact, [], { ...base, fundingUtxo: await coinAt(provider, alice, `${tag}3`) });
      expectAuthhead(bare.tx.outputs[0], bare.categoryId, alice);
      expect(bare.tx.outputs[1]!.token?.nft?.capability).toBe('minting');
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
