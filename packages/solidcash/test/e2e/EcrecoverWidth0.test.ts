import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { ethers } from 'ethers';
import { ecrecoverComputeLockingBytecode } from '@solidcash/utils';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A recovery side-car's OWN NFT category (distinct from the consuming contract's).
const SIDECAR_CAT = 'ee'.repeat(32);

const leBytes = (h: string): Uint8Array => hexToBin(h.replace(/^0x/, '')).slice().reverse();
const toLeBytes = (v: bigint): Uint8Array => {
  const b = new Uint8Array(32);
  let x = v;
  for (let i = 0; x > 0n; i++, x >>= 8n) b[i] = Number(x & 0xffn);
  return b;
};

// A measured width-0 signature: probeEcrecoverSplit throws for this (h,v,r,s) because the GLV ladder (L=127) has no
// 2-covenant split that fits both side-cars' ~8M op-budget. The 3-covenant split recovers the same owner.
const WIDTH0 = {
  digest: '398eed067d4a815e6ba5220239bf7ebf7b4fcf2c51faee52f0db375644c0aa67',
  v: 27,
  r: 'd94a22918b3e004b321a8d499c70d153be8a3bd7c85591c5709bf8013e8af39c',
  s: '6a8ff1cd7003b7480a579bbd9d5ba68e17a04e0d3842226b6cb651176def9d32',
};

const STATEFUL = `
contract StatefulAuth(pubkey owner) {
    int count;
    function bump(bytes32 h, int v, bytes32 r, bytes32 s) {
        require(ecrecoverPubKey(h, v, r, s) == owner);
        this.count = this.count + 1;
    }
}`;

describe('ecrecover width-0 signatures (3-covenant A->M->B split)', () => {
  it('recovers a width-0 signature through the A/M/B3 split and rejects a tampered witness', async () => {
    const sig = ethers.Signature.from({ r: `0x${WIDTH0.r}`, s: `0x${WIDTH0.s}`, v: WIDTH0.v });
    const owner = hexToBin(
      ethers.SigningKey.computePublicKey(
        ethers.SigningKey.recoverPublicKey(`0x${WIDTH0.digest}`, sig), true,
      ).slice(2),
    );
    const h = leBytes(WIDTH0.digest), r = leBytes(WIDTH0.r), s = leBytes(WIDTH0.s);

    const artifact = compileString(STATEFUL);
    expect(artifact.abi.find((fn) => fn.name === 'bump')?.ecrecoverCompute).toBe(true);
    // The fixed block reserves three ecrecoverSideCar slots per call (A, M, B).
    const slots = artifact.abi.find((fn) => fn.name === 'bump')?.blockLayout?.slots.filter(
      (slot) => slot.kind === 'ecrecoverSideCar',
    );
    expect(slots?.length).toBe(3);

    const provider = createTestProvider();
    const contract = new Contract(artifact, [owner], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { count: 0n }, { saltContract: true },
    );
    const salt = hexToBin(categoryId).slice().reverse(); // branded: the covenant/resolve use the reversed category
    for (const role of ['A', 'B', 'M', 'B3'] as const) {
      await provider.addUtxo(binToHex(ecrecoverComputeLockingBytecode(salt, role)), {
        ...randomUtxo({ satoshis: 100_000n }),
        token: { category: SIDECAR_CAT, amount: 0n, nft: { capability: 'mutable', commitment: '' } },
      });
    }

    const sc = StatefulContract.withCategory(contract, categoryId);
    const tx = await sc.bump(h, BigInt(WIDTH0.v), r, s).send();
    expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);
    // The require passed, so the recovered key equaled `owner`; the 3-way path advanced the contract state.
    expect((await sc.getState()).count).toBe(1n);

    // A tampered witness recovers a different key and the contract require fails closed.
    const tampered = toLeBytes(BigInt(`0x${WIDTH0.s}`) + 1n);
    await expect(sc.bump(h, BigInt(WIDTH0.v), r, tampered).send())
      .rejects.toThrow(/OP_VERIFY|non-truthy/);
    expect((await sc.getState()).count).toBe(1n);
  }, 300_000);
});
