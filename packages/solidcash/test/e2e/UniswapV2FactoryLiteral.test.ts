/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '../direct-compile.js';
import { HashType, SignatureTemplate, Signer } from '../../src/index.js';
import { ContractFactory } from '../../src/stateful/index.js';
import { createTestProvider } from '../test-util.js';
import { alicePriv, aliceAddress, bobAddress } from '../fixture/vars.js';
import { addressToLockScript, lockingBytecodeToSolidityAddressPayload } from '../../src/utils.js';

// Vendored MistSwap UniswapV2Factory/UniswapV2Pair, compiled whole (no split) under the same relaxed
// input-script ceiling the marketplace uses, so the literal UniswapV2Factory.createPair acceptance runs.
const SOURCE = readFileSync(new URL('../fixture/UniswapV2.scash', import.meta.url), 'utf8');
const RELAXED = {
  evmCompat: true,
  split: 'off',
  maximumInputBytes: 100_000,
  allowUnsafeOperations: true,
} as const;
const tokenA = addressToLockScript(aliceAddress);
const tokenB = addressToLockScript(bobAddress);

describe('UniswapV2Factory.createPair (vendored source, fresh compile)', () => {
  const artifacts = compileStringMulti(SOURCE, RELAXED);
  const factoryArtifact = artifacts.UniswapV2Factory;
  const childArtifact = artifacts.UniswapV2Pair;
  const createPairAbi = factoryArtifact.abi.find((f) => f.name === 'createPair')!;

  it('layout: createPair deploys a typed pair and writes both getPair directions', () => {
    const createPair = factoryArtifact.abi.find((f) => f.name === 'createPair')!;
    expect(createPair.modifiers).toContain('deploy');
    expect(createPair.deployTargets?.[0]).toMatchObject({ contractName: 'UniswapV2Pair' });
    expect(createPair.deployTargets?.[0]?.salt).toMatchObject({ computed: true });
    expect(createPair.deployTargets?.[0]?.dataNftCount).toBe(childArtifact.stateLayout!.dataNftCount);
    expect(createPair.deployTargets?.[0]?.hasFoldedChildCall).toBe(true);
    expect(createPair.entryAccesses).toHaveLength(2);
    expect(createPair.entryAccesses?.map((e) => e.collection)).toEqual(['getPair', 'getPair']);
    expect(createPair.sortedBatchInfo?.[0]).toMatchObject({ collection: 'getPair', linear: true });
    expect(createPair.blockLayout?.slots.some((s) => s.kind === 'deployDataNft')).toBe(true);
    expect(childArtifact.stateLayout?.dataNftCount).toBeGreaterThan(0);
  });

  it('createPair deploys a pair and both getPair directions read back', async () => {
    const provider = createTestProvider();
    (provider as any).consensusLimits = {
      ...(provider as any).consensusLimits, maximumInputBytes: 100_000, maximumTransactionBytes: 10_000_000,
    };
    const signer = new Signer(alicePriv, provider);
    for (let i = 0; i < 8; i++) {
      await provider.addUtxo(signer.getAddress(), {
        txid: `a${i.toString(16).padStart(63, '0')}`,
        vout: 0,
        satoshis: 1_000_000n,
      });
    }

    const factory = await new ContractFactory(factoryArtifact, signer).deploy(
      signer.getAddress(), { initialState: {} },
    );
    await factory.deployed();
    (factory as any).registerChild(childArtifact);

    const result = await (factory as any).createPair(tokenA, tokenB);
    expect(result.tx.txid).toBeDefined();
    const child = result.child;

    // evmCompat stores an address as its 20-byte Solidity identity, which is what getPair returns; the child's
    // SDK address is the cashaddr of its locking bytecode, so narrow that to the same identity before comparing.
    const expected = lockingBytecodeToSolidityAddressPayload(
      hexToBin(child.inner.lockingBytecode as string),
    );
    const pairAB = await (factory as any).getPair(tokenA, tokenB);
    const pairBA = await (factory as any).getPair(tokenB, tokenA);
    expect(binToHex(pairAB as Uint8Array)).toBe(binToHex(expected!));
    expect(binToHex(pairBA as Uint8Array)).toBe(binToHex(expected!));
  });

  it.skipIf(process.env.TESTS_USE_REGTEST)(
    'rejects a createPair transaction whose child data-NFT output is permuted against an entry output', async () => {
      const provider = createTestProvider();
      (provider as any).consensusLimits = {
        ...(provider as any).consensusLimits, maximumInputBytes: 100_000, maximumTransactionBytes: 10_000_000,
      };
      const signer = new Signer(alicePriv, provider);
      for (let i = 0; i < 10; i++) {
        await provider.addUtxo(signer.getAddress(), {
          txid: `b${i.toString(16).padStart(63, '0')}`,
          vout: 0,
          satoshis: 1_000_000n,
        });
      }

      const factory = await new ContractFactory(factoryArtifact, signer).deploy(
        signer.getAddress(), { initialState: {} },
      );
      await factory.deployed();
      (factory as any).registerChild(childArtifact);

      // Capture the fully derived deploy WITHOUT broadcasting, so the tampered re-send below runs against
      // still-unspent inputs (the minted keccak compute side-car and any alias placeholder survive because no
      // snapshot/restore removes them). Rejection must therefore be covenant validation, not replay detection.
      let captured = '';
      const send = provider.sendRawTransaction.bind(provider);
      (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
        captured = hex;
        throw new Error('capture-only');
      };
      await expect((factory as any).createPair(tokenA, tokenB).deploy({
        funder: new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE).unlockP2PKH(),
      })).rejects.toThrow('capture-only');
      (provider as any).sendRawTransaction = send;
      expect(captured).not.toBe('');

      // The layout test pins these block-layout offsets (relative to the master input at index 0). Swap a child
      // data-NFT output with a factory entry output; the covenant authenticates each family at its own slot.
      const slots = createPairAbi.blockLayout!.slots;
      const entryIdx = slots.find((s) => s.kind === 'entry')!.offset;
      const childDataIdx = slots.find((s) => s.kind === 'deployDataNft')!.offset;

      const tx = decodeTransactionUnsafe(hexToBin(captured));
      [tx.outputs[entryIdx], tx.outputs[childDataIdx]] = [
        tx.outputs[childDataIdx], tx.outputs[entryIdx],
      ];
      await expect(send(binToHex(encodeTransaction(tx))))
        .rejects.toThrow(/mandatory-script-verify-flag-failed/);

      // The untouched transaction is the one the covenant accepts.
      await expect(send(captured)).resolves.toBeTypeOf('string');
    }, 300_000,
  );
});
