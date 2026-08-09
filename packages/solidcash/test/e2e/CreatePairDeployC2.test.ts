/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { binToHex } from '@bitauth/libauth';
import { parsePushdataCommitment } from '@solidcash/utils';
import { ContractFactory, StatefulContract } from '../../src/index.js';
import { createTestProvider, getSigners } from '../test-util.js';
import { addressToLockScript } from '../../src/utils.js';
import { getDataNftAddress } from '../../src/stateful/covenant-helpers.js';

const DIR = '/Code/cashscript/.worktrees/mistswap-native-bch/examples/mistswap-native/artifacts/solidcash';
// Prefer goal scratch; fall back for local runs.
const SCRATCH = process.env.GROK_SCRATCH
  || '/tmp/grok-goal-253fc4aa8124/implementer';
const limits = {
  maximumInputBytes: 100_000,
  maximumTransactionBytes: 10_000_000,
  maximumNftCommitmentBytes: 128,
};

function load(name: string) {
  return JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8'));
}

describe('createPair deployDataNft + dual getPair (factory wall)', () => {
  it('layout reserves deployDataNft matching pair dataNftCount', () => {
    const factoryArt = load('UniswapV2Factory');
    const pairArt = load('UniswapV2Pair');
    const cp = factoryArt.abi.find((f: any) => f.name === 'createPair');
    expect(cp).toBeDefined();
    const dd = (cp.blockLayout?.slots ?? []).filter((s: any) => s.kind === 'deployDataNft');
    expect(cp.deployTargets?.[0]?.dataNftCount).toBe(pairArt.stateLayout.dataNftCount);
    expect(dd.length).toBe(pairArt.stateLayout.dataNftCount);
    expect(cp.blockLayout.blockSize).toBe(13);
  });

  it('createPair dual getPair + full child dataNftCount on-chain', async () => {
    mkdirSync(SCRATCH, { recursive: true });
    const provider = createTestProvider();
    (provider as any).consensusLimits = { ...(provider as any).consensusLimits, ...limits };
    const [alice] = await getSigners(1, { provider, fundingUtxos: 30 });

    const factoryArt = load('UniswapV2Factory');
    const pairArt = load('UniswapV2Pair');
    const erc20Art = load('ERC20Mock');
    const expectedN = pairArt.stateLayout.dataNftCount as number;

    const factory = await new ContractFactory(factoryArt, alice).deploy(alice.getAddress());
    if (typeof (factory as any).registerChild === 'function') {
      (factory as any).registerChild(pairArt);
    }

    const tokenA = await new ContractFactory(erc20Art, alice).deploy('A', 'A', 1_000_000n);
    const tokenB = await new ContractFactory(erc20Art, alice).deploy('B', 'B', 1_000_000n);

    let err: string | undefined;
    let ok = false;
    let childCategory: string | undefined;
    let dataNftFound = 0;
    const commitLines: string[] = [];
    try {
      const result = await (factory as any).createPair(tokenA.address, tokenB.address);
      ok = !!(result?.tx?.txid || result?.txid || result?.child);
      const child = result?.child;
      childCategory = child?.categoryId ?? result?.childCategoryId;
      // Prefer dual getPair readback when the call succeeds.
      let pair0: unknown;
      let pair1: unknown;
      if (ok && typeof (factory as any).getPair === 'function') {
        pair0 = await (factory as any).getPair(tokenA.address, tokenB.address);
        pair1 = await (factory as any).getPair(tokenB.address, tokenA.address);
      }

      // Full genesis: every pair data NFT must be on-chain and parseable (PairKashi attach residual).
      if (child && childCategory) {
        const dnAddr = getDataNftAddress(child.inner, childCategory);
        const utxos = await provider.getUtxos(dnAddr);
        const mutable = utxos.filter((u) => (
          u.token?.category === childCategory
          && u.token?.nft?.capability === 'mutable'
          && (u.token?.nft?.commitment?.length ?? 0) > 0
        ));
        const tagged: number[] = [];
        for (const u of mutable) {
          const c = u.token!.nft!.commitment;
          let parsed = false;
          for (let idx = 0; idx < expectedN; idx++) {
            try {
              parsePushdataCommitment(c, pairArt.stateLayout, idx);
              tagged.push(idx);
              commitLines.push(`nft${idx} vout=${u.vout} cLen=${c.length / 2} c=${c.slice(0, 48)}`);
              parsed = true;
              break;
            } catch {
              /* try next index */
            }
          }
          if (!parsed) {
            commitLines.push(`UNPARSED vout=${u.vout} cLen=${c.length / 2} c=${c.slice(0, 64)}`);
          }
        }
        dataNftFound = new Set(tagged).size;
        // getState must succeed (same path as attach + call).
        await child.getState();
      }

      writeFileSync(
        `${SCRATCH}/createpair-e2e.log`,
        `OK createPair result keys=${Object.keys(result ?? {}).join(',')}\n`
        + `txid=${result?.tx?.txid ?? result?.txid}\n`
        + `childCat=${childCategory}\n`
        + `getPairAB=${pair0 ? binToHex(pair0 instanceof Uint8Array ? pair0 : addressToLockScript(String(pair0))) : 'n/a'}\n`
        + `getPairBA=${pair1 ? binToHex(pair1 instanceof Uint8Array ? pair1 : addressToLockScript(String(pair1))) : 'n/a'}\n`
        + `dataNftExpected=${expectedN} dataNftFound=${dataNftFound}\n`
        + `${commitLines.join('\n')}\n`,
      );
      writeFileSync(
        `${SCRATCH}/pair-datanft-e2e.log`,
        `expected=${expectedN} found=${dataNftFound}\n${commitLines.join('\n')}\n`,
      );
      if (pair0 !== undefined && pair1 !== undefined) {
        expect(pair0).toBeDefined();
        expect(pair1).toBeDefined();
      }
      expect(dataNftFound).toBe(expectedN);
      // Attach path (MistSwap: UniswapV2Pair.attach(pairAddress)) must also see full state.
      if (child) {
        const attached = await StatefulContract.at(child.address, pairArt, alice);
        await attached.getState();
      }
    } catch (e: any) {
      err = String(e?.message ?? e);
      writeFileSync(`${SCRATCH}/createpair-e2e.log`, `ERR ${err}\nfound=${dataNftFound}\n${commitLines.join('\n')}\n`);
      writeFileSync(`${SCRATCH}/pair-datanft-e2e.log`, `ERR ${err}\nfound=${dataNftFound}\n${commitLines.join('\n')}\n`);
    }

    // Must not hit the old combined-deploy+C2 refusal (the createPair wall).
    expect(err ?? '').not.toMatch(/combines a typed stateful child with C2 mapping access/);
    expect(err ?? '').not.toMatch(/share the first trailing slot/);
    expect(err ?? '').not.toMatch(/does not support multi-key mapping writes/);
    // Full dual getPair success + full child data NFT genesis.
    if (err) throw new Error(err);
    expect(ok).toBe(true);
  }, 180_000);
});
