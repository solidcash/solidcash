// cspell:words invalidateblock setmocktime
import { Contract, SignatureTemplate } from '../../../src/index.js';
import {
  bobAddress,
  bobPub,
  carolPkh,
  carolPub,
  carolAddress,
  carolPriv,
} from '../../fixture/vars.js';
import { utxoComparator, calculateDust, randomUtxo, isNonTokenUtxo } from '../../../src/utils.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import twtArtifact from '../../fixture/transfer_with_timeout.artifact.js';
import { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createTestProvider, getTxOutputs } from '../../test-util.js';
import { compileString } from '@solidcash/solidc';
import RegtestNetworkProvider from '../../../src/network/RegtestNetworkProvider.js';
import type { Transaction } from '@bitauth/libauth';

const RPC_URL = process.env.REGTEST_RPC_URL ?? 'http://localhost:18443';
const RPC_USER = process.env.REGTEST_RPC_USER ?? 'user';
const RPC_PASSWORD = process.env.REGTEST_RPC_PASSWORD ?? 'password';

async function rpc(method: string, params: unknown[] = []): Promise<any> {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain;',
      authorization: `Basic ${Buffer.from(`${RPC_USER}:${RPC_PASSWORD}`).toString('base64')}`,
    },
    body: JSON.stringify({ jsonrpc: '1.0', id: 'timelocks', method, params }),
  });
  const body = await response.json() as { result?: any; error?: unknown };
  if (body.error) throw new Error(`BCHN RPC ${method} failed: ${JSON.stringify(body.error)}`);
  return body.result;
}

describe('Timelocks', () => {
  const provider = createTestProvider();

  let p2pkhInstance: Contract<typeof p2pkhArtifact>;
  let twtInstance: Contract<typeof twtArtifact>;

  beforeAll(async () => {
    // Note: We instantiate the contract with carolPkh to avoid mempool conflicts with other (P2PKH) tests
    p2pkhInstance = new Contract(p2pkhArtifact, [carolPkh], { provider });
    twtInstance = new Contract(twtArtifact, [bobPub, carolPub, 100000n], { provider });
    console.log(p2pkhInstance.tokenAddress);
    console.log(twtInstance.tokenAddress);
    await provider.addUtxo(p2pkhInstance.address, randomUtxo());
    await provider.addUtxo(p2pkhInstance.address, randomUtxo());
    await provider.addUtxo(twtInstance.address, randomUtxo());
    await provider.addUtxo(twtInstance.address, randomUtxo());
    await provider.addUtxo(bobAddress, randomUtxo());
    await provider.addUtxo(bobAddress, randomUtxo());
    await provider.addUtxo(carolAddress, randomUtxo());
    await provider.addUtxo(carolAddress, randomUtxo());
  });

  describe.runIf(Boolean(process.env.TESTS_USE_CHIPNET))('Locktime', () => {
    it('should fail when locktime is higher than current block height', async () => {
      const fee = 1000n;
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();

      const amount = p2pkhUtxos[0].satoshis - fee;
      const dustAmount = calculateDust({ to: p2pkhInstance.address, amount });

      if (amount < dustAmount) {
        throw new Error('Not enough funds to send transaction');
      }

      const blockHeight = await provider.getBlockHeight();

      const txPromise = new TransactionBuilder({ provider })
        .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
        .addOutput({ to: p2pkhInstance.address, amount })
        .setLocktime(blockHeight + 100)
        .send();

      await expect(txPromise).rejects.toThrow(/non-final transaction/);
    });

    it('should succeed when locktime is lower than current block height', async () => {
      const fee = 1000n;
      const p2pkhUtxos = (await p2pkhInstance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();

      const amount = p2pkhUtxos[0].satoshis - fee;
      const dustAmount = calculateDust({ to: p2pkhInstance.address, amount });

      if (amount < dustAmount) {
        throw new Error('Not enough funds to send transaction');
      }

      const blockHeight = await provider.getBlockHeight();

      const tx = await new TransactionBuilder({ provider })
        .addInput(p2pkhUtxos[0], p2pkhInstance.unlock.spend(carolPub, new SignatureTemplate(carolPriv)))
        .addOutput({ to: p2pkhInstance.address, amount })
        .setLocktime(blockHeight - 100)
        .send();

      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toEqual(expect.arrayContaining([{ to: p2pkhInstance.address, amount }]));
    });
  });

  describe.runIf(Boolean(process.env.TESTS_USE_REGTEST))('BIP68 relative timelock', () => {
    it('rejects a short sequence in script, rejects an immature valid sequence in BCHN, then accepts it', async () => {
      const artifact = compileString(`
        contract RelativeLock() {
          function spend() {
            require(this.age >= 2);
          }
        }
      `);
      const instance = new Contract(artifact, [], { provider });
      await provider.addUtxo(instance.address, randomUtxo());
      const [utxo] = (await instance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();
      const amount = utxo.satoshis - 1000n;

      const spend = (sequence: number): Promise<Transaction> => new TransactionBuilder({ provider })
        .addInput(utxo, instance.unlock.spend(), { sequence })
        .addOutput({ to: instance.address, amount })
        .send();

      // The covenant itself binds nSequence to the declared relative age.
      await expect(spend(1)).rejects.toThrow();

      // nSequence=2 satisfies OP_CHECKSEQUENCEVERIFY, but BCHN still rejects the spend until the prevout has
      // reached the consensus-defined BIP68 age. This is the proof a script-only VM cannot provide.
      await expect(spend(2)).rejects.toThrow(/non-BIP68-final|non-final/i);

      expect(provider).toBeInstanceOf(RegtestNetworkProvider);
      await (provider as RegtestNetworkProvider).mine(1);
      const tx = await spend(2);
      expect(getTxOutputs(tx, provider.network)).toEqual(expect.arrayContaining([
        { to: instance.address, amount },
      ]));
    });

    it('enforces a 512-second BIP68 age against BCHN median-time-past', async () => {
      const regtest = provider as RegtestNetworkProvider;
      expect(provider).toBeInstanceOf(RegtestNetworkProvider);
      const start = await rpc('getblockchaininfo') as {
        blocks: number; bestblockhash: string; mediantime: number;
      };
      let firstTestBlock: string | undefined;

      try {
        const timeSequence = (1 << 22) | 1; // BIP68 time flag + one 512-second unit
        const artifact = compileString(`
          contract RelativeTimeLock() {
            function spend() {
              require(this.age >= ${timeSequence});
            }
          }
        `);
        const instance = new Contract(artifact, [], { provider });
        await provider.addUtxo(instance.address, randomUtxo());
        firstTestBlock = await provider.getBlockHash(start.blocks + 1);
        const [utxo] = (await instance.getUtxos()).filter(isNonTokenUtxo).sort(utxoComparator).reverse();
        const amount = utxo.satoshis - 1000n;
        const spend = (): Promise<Transaction> => new TransactionBuilder({ provider })
          .addInput(utxo, instance.unlock.spend(), { sequence: timeSequence })
          .addOutput({ to: instance.address, amount })
          .send();

        await expect(spend()).rejects.toThrow(/non-BIP68-final|non-final/i);

        // Move MTP forward on a disposable branch. Eleven blocks replace the complete median window; the finally
        // block invalidates this branch, then mines one ordinary-time cleanup block on the preserved ancestor.
        const future = Math.max(Math.floor(Date.now() / 1000) + 600, start.mediantime + 1024);
        await rpc('setmocktime', [future]);
        await regtest.mine(11);
        const tx = await spend();
        expect(getTxOutputs(tx, provider.network)).toEqual(expect.arrayContaining([
          { to: instance.address, amount },
        ]));
      } finally {
        await rpc('setmocktime', [0]);
        if (firstTestBlock) {
          await rpc('invalidateblock', [firstTestBlock]);
          await regtest.mine(1);
        }
        expect(await provider.getBlockHash(start.blocks)).toBe(start.bestblockhash);
        expect(await provider.getBlockHeight()).toBe(start.blocks + 1);
      }
    });
  });
});
