/**
 * The token fields an ERC-20-shaped deployment publishes (docs/bcmr/DESIGN.md, 6.3 to 6.7): each comes from the deploy
 * options or, when the artifact carries IERC20Metadata, from the contract's views read on a probe genesis. A view the
 * probe cannot read must be stated, the native scale must be a power of ten, and every refusal lands before anything
 * is broadcast.
 */
// cspell:ignore stETH STETH XMIN XSIL
import { hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { compileFile } from '@solidcash/solidc';
import { describe, expect, it, vi } from 'vitest';
import { NATIVE_TOKEN_EXTENSION } from '../../src/bcmr/index.js';
import type { Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type Signer from '../../src/Signer.js';
import { StatefulContract, type DeployOptions, type DeployResult } from '../../src/stateful/index.js';
import { aliceTokenAddress } from '../fixture/vars.js';

const PADDED = new URL('../fixture/bcmr_padded_token.scash', import.meta.url);
const SILENT = new URL('../fixture/bcmr_silent_token.scash', import.meta.url);
const MINIMAL = new URL('../../contracts/examples/MinimalNativeToken.scash', import.meta.url);
const TIMESTAMP = '2026-10-20T12:00:00.000Z';
const MAXIMUM_FUNGIBLE_AMOUNT = 9_223_372_036_854_775_807n;

/** A signer with a deployment coin and a coin whose txid becomes the token's own category. */
interface Coins { readonly alice: Signer; readonly funding: Utxo; readonly token: Utxo }

async function genesisCoin(signer: Signer, skip: readonly Utxo[] = []): Promise<Utxo> {
  const coin = (await signer.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined
    && utxo.satoshis >= 100_000n && !skip.some((other) => other.txid === utxo.txid));
  if (coin === undefined) throw new Error('no genesis coin left');
  return coin;
}

async function coins(provider: MockNetworkProvider): Promise<Coins> {
  const [signer] = await provider.getSigners(1, { fundingUtxos: 4, genesisFundingUtxos: 4 });
  const alice = signer as unknown as Signer;
  const funding = await genesisCoin(alice);
  return { alice, funding, token: await genesisCoin(alice, [funding]) };
}

/** Deploys `artifact` from `held`, constructed with the token coin's category; `options` override the defaults. */
function deployer(
  artifact: Artifact, provider: MockNetworkProvider, held: Coins,
): (options?: Partial<DeployOptions>) => Promise<DeployResult> {
  return (options = {}) => StatefulContract.deploy(artifact, [], {
    provider, fundingUtxo: held.funding, funder: held.alice.unlockP2PKH(), changeAddress: held.alice.getAddress(),
    initArgs: [hexToBin(held.token.txid)], ...options,
  });
}

/** Nothing was broadcast: both coins are still there. */
async function expectUnspent({ alice, funding, token }: Coins): Promise<void> {
  const live = await alice.getUtxos();
  for (const coin of [funding, token]) {
    expect(live.some((utxo) => utxo.txid === coin.txid && utxo.vout === 0)).toBe(true);
  }
}

describe('a token whose contract answers IERC20Metadata in bytes32', () => {
  const artifact = compileFile(PADDED, { messageBus: false });

  it('reads a bytes32 name and symbol, matches a stated symbol in any case, and warns about 18 decimals', async () => {
    const provider = new MockNetworkProvider();
    const held = await coins(provider);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const result = await deployer(artifact, provider, held)({
        bcmr: { token: { symbol: 'STETH' }, timestamp: TIMESTAMP }, nativeToken: { funding: held.token },
      });
      const snapshot = result.registry!.registry.identities![held.token.txid]![TIMESTAMP]!;
      expect(snapshot.name).toBe('Staked Ether');
      expect(snapshot.token).toEqual({ category: held.token.txid, symbol: 'STETH', decimals: 18 });
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/18-decimal token with no native scale/));
    } finally {
      warn.mockRestore();
    }
  });

  it('refuses a contract symbol that is not a BCMR symbol unless a symbol is stated', async () => {
    const provider = new MockNetworkProvider();
    const held = await coins(provider);
    await expect(deployer(artifact, provider, held)({
      bcmr: { timestamp: TIMESTAMP }, nativeToken: { funding: held.token },
    })).rejects.toThrow(/the contract's symbol\(\) "stETH" is not a BCMR symbol.*for example "STETH"/);
    await expectUnspent(held);
  });

  it('refuses a stated name or decimals the contract disagrees with, comparing decimals after the scale', async () => {
    const provider = new MockNetworkProvider();
    const held = await coins(provider);
    const deploy = deployer(artifact, provider, held);
    const nativeToken = { funding: held.token };
    await expect(deploy({
      bcmr: { name: 'Staked Bitcoin', token: { symbol: 'STETH' }, timestamp: TIMESTAMP }, nativeToken,
    })).rejects.toThrow(/bcmr\.name "Staked Bitcoin" disagrees with the contract's name\(\) "Staked Ether"/);
    await expect(deploy({
      bcmr: { token: { symbol: 'STETH', decimals: 8 }, timestamp: TIMESTAMP }, nativeToken,
    })).rejects.toThrow('bcmr.token.decimals 8 disagrees with the contract: decimals() 18 less log10 of the native '
      + 'scale 1 is 18');
    // 18 ledger decimals over a scale of 10^19 leave the bearer unit -1 decimals.
    await expect(deploy({
      bcmr: { token: { symbol: 'STETH' }, timestamp: TIMESTAMP }, nativeToken: { ...nativeToken, scale: 10n ** 19n },
    })).rejects.toThrow(/-1 decimals .*BCMR admits 0 to 18/);
    await expectUnspent(held);

    // One native unit backing 10^10 ledger units leaves the bearer unit 8 decimals, as stated.
    const result = await deploy({
      bcmr: { token: { symbol: 'STETH', decimals: 8 }, timestamp: TIMESTAMP },
      nativeToken: { ...nativeToken, scale: 10n ** 10n },
    });
    expect(result.registry!.registry.identities![held.token.txid]![TIMESTAMP]!.token?.decimals).toBe(8);
  });
});

describe('a token whose views the probe cannot read', () => {
  const artifact = compileFile(SILENT, { messageBus: false });

  it('requires the options to state each field whose view the probe could not read', async () => {
    const provider = new MockNetworkProvider();
    const held = await coins(provider);
    const deploy = deployer(artifact, provider, held);
    const nativeToken = { funding: held.token };
    await expect(deploy({ bcmr: { timestamp: TIMESTAMP }, nativeToken }))
      .rejects.toThrow(/bcmr\.name is required: the probe could not read the contract's name\(\)/);
    await expect(deploy({ bcmr: { name: 'Silent Dollar', timestamp: TIMESTAMP }, nativeToken }))
      .rejects.toThrow(/bcmr\.token\.symbol is required: the probe could not read the contract's symbol\(\)/);
    await expect(deploy({
      bcmr: { name: 'Silent Dollar', token: { symbol: 'XSIL' }, timestamp: TIMESTAMP }, nativeToken,
    })).rejects.toThrow(/bcmr\.token\.decimals is required: the probe could not read the contract's decimals\(\)/);
    await expectUnspent(held);
  });

  it('publishes the fields the options state in place of the views it could not read', async () => {
    const provider = new MockNetworkProvider();
    const held = await coins(provider);
    const result = await deployer(artifact, provider, held)({
      bcmr: { name: 'Silent Dollar', token: { symbol: 'XSIL', decimals: 2 }, timestamp: TIMESTAMP },
      nativeToken: { funding: held.token },
    });
    const snapshot = result.registry!.registry.identities![held.token.txid]![TIMESTAMP]!;
    expect(snapshot.name).toBe('Silent Dollar');
    expect(snapshot.token).toEqual({ category: held.token.txid, symbol: 'XSIL', decimals: 2 });
  });

  it('refuses a premint it cannot check against an unread totalSupply()', async () => {
    const provider = new MockNetworkProvider();
    const held = await coins(provider);
    await expect(deployer(artifact, provider, held)({
      nativeToken: { funding: held.token, reserve: 5000n },
    })).rejects.toThrow(/nativeToken\.reserve cannot be checked .*could not read the contract's totalSupply\(\)/);
    await expectUnspent(held);
  });
});

describe('a token without IERC20Metadata', () => {
  const artifact = compileFile(MINIMAL, { messageBus: false });

  it('refuses a native scale that is not a power of ten, though no decimals() is read', async () => {
    const provider = new MockNetworkProvider();
    const held = await coins(provider);
    const deploy = deployer(artifact, provider, held);
    const bcmr = { name: 'Minimal', token: { symbol: 'XMIN', decimals: 2 }, timestamp: TIMESTAMP };
    for (const scale of [3n, 0n]) {
      await expect(deploy({ bcmr, nativeToken: { funding: held.token, reserve: 100n, scale } }))
        .rejects.toThrow(new RegExp(`a native scale must be a power of ten .*got ${scale}$`));
    }
    await expectUnspent(held);
  });

  it('takes its fields and tags from the options alone and publishes the scale in the extension', async () => {
    const provider = new MockNetworkProvider();
    const held = await coins(provider);
    const tags = { stablecoin: { name: 'Stablecoin', description: 'Backed one to one by a reserve.' } };
    const result = await deployer(artifact, provider, held)({
      bcmr: { name: 'Minimal', token: { symbol: 'XMIN' }, tags, timestamp: TIMESTAMP },
      nativeToken: { funding: held.token, reserve: 100n, scale: 100n },
    });
    const { registry } = result.registry!;
    const snapshot = registry.identities![held.token.txid]![TIMESTAMP]!;
    // The contract publishes no decimals(), so the options may leave the decimals out.
    expect(snapshot.token).toEqual({ category: held.token.txid, symbol: 'XMIN' });
    expect(snapshot.tags).toEqual(['stablecoin']);
    expect(registry.tags).toEqual(tags);
    expect(snapshot.extensions?.[NATIVE_TOKEN_EXTENSION]).toMatchObject({ scale: '100', ledgerSupply: 'totalSupply()' });
  });

  it('bounds the premint and the bearer supply by the 64-bit fungible cap', async () => {
    const provider = new MockNetworkProvider();
    const held = await coins(provider);
    const deploy = deployer(artifact, provider, held);
    const funding = held.token;
    const bearer = (amount: bigint): { amount: bigint; to: string } => ({ amount, to: aliceTokenAddress });
    await expect(deploy({ nativeToken: { funding, reserve: 0n } }))
      .rejects.toThrow(`nativeToken.reserve must be from 1 to ${MAXIMUM_FUNGIBLE_AMOUNT}, got 0`);
    await expect(deploy({ nativeToken: { funding, reserve: MAXIMUM_FUNGIBLE_AMOUNT + 1n } }))
      .rejects.toThrow(`got ${MAXIMUM_FUNGIBLE_AMOUNT + 1n}`);
    await expect(deploy({ nativeToken: { funding, bearer: bearer(0n) } }))
      .rejects.toThrow(`nativeToken.bearer.amount must be from 1 to ${MAXIMUM_FUNGIBLE_AMOUNT}, got 0`);
    await expect(deploy({ nativeToken: { funding, reserve: MAXIMUM_FUNGIBLE_AMOUNT, bearer: bearer(1n) } }))
      .rejects.toThrow(`nativeToken.reserve and nativeToken.bearer together exceed ${MAXIMUM_FUNGIBLE_AMOUNT}`);
    await expectUnspent(held);
  });

  it('refuses a token category that is the contract category', async () => {
    const provider = new MockNetworkProvider();
    const held = await coins(provider);
    const deploy = deployer(artifact, provider, held);
    await expect(deploy({ nativeToken: { funding: held.funding } }))
      .rejects.toThrow('the token category must differ from the contract category');
    await expectUnspent(held);
  });
});
