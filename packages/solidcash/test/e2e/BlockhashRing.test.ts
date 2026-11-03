import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  blockhashOracleLockingBytecode, buildBlockhashSlotCommitment, decodeBlockhashSlotCommitment, hash160,
  type BlockhashSlotFields,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import type { Output, Utxo } from '../../src/interfaces.js';
import {
  BlockOracleUpdater, blockhashSlotRetireUnlocker, blockhashSlotUpdateUnlocker,
} from '../../src/oracle/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { aliceAddress, alicePkh, alicePriv } from '../fixture/vars.js';

const SOURCE = 'contract Reader(){ function check(int n, bytes32 expected) { require(blockhash(n) == expected); } }';
const ZERO = new Uint8Array(32);
const HASH = new Uint8Array(32).fill(0xb7);
const FORGED = new Uint8Array(32).fill(0xee);
const ALICE_LOCK = Uint8Array.from([0x76, 0xa9, 0x14, ...alicePkh, 0x88, 0xac]);

describe('blockhash ring', () => {
  const artifact = compileString(SOURCE);

  type Deployed = Awaited<ReturnType<typeof StatefulContract.deploy>>;

  async function deploy(provider: MockNetworkProvider, blockhashDepth?: number | 'now'): Promise<Deployed> {
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 500_000n }));
    return StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo, funder: new SignatureTemplate(alicePriv).unlockP2PKH(), changeAddress: aliceAddress,
      ...(blockhashDepth === undefined ? {} : { blockhashDepth }),
    });
  }

  async function slots(
    provider: MockNetworkProvider, categoryId: string,
  ): Promise<Array<{ utxo: Utxo; fields: BlockhashSlotFields }>> {
    const lock = blockhashOracleLockingBytecode(hexToBin(categoryId));
    return (await provider.getUtxosForLockingBytecode(lock)).map((utxo) => ({
      utxo, fields: decodeBlockhashSlotCommitment(hexToBin(utxo.token!.nft!.commitment))!,
    }));
  }

  function keeper(provider: MockNetworkProvider, deployed: Deployed): BlockOracleUpdater {
    return new BlockOracleUpdater({
      contract: deployed.contract.inner, categoryId: deployed.categoryId, keeperKey: provider.blockOracleOwnerKey,
      rpc: { request: async (): Promise<never> => { throw new Error('unused'); } },
    });
  }

  function verdict(provider: MockNetworkProvider, builder: TransactionBuilder): true | string {
    const vm = createVirtualMachineBch2026ForProvider(provider);
    return vm.stateSuccess(vm.evaluate({
      inputIndex: 0, sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    }));
  }

  it('mints blockhashDepth slots at genesis, one for now', async () => {
    const provider = new MockNetworkProvider();
    const owner = hash160(provider.blockOracleOwnerPublicKey);
    const four = await deploy(provider, 4);
    const ring = await slots(provider, four.categoryId);
    expect(ring.map(({ fields }) => fields.n).sort()).toEqual([0n, 1n, 2n, 3n]);
    for (const { utxo, fields } of ring) {
      expect(utxo.satoshis).toBe(1_200n);
      expect(utxo.token).toMatchObject({ category: four.categoryId, amount: 0n, nft: { capability: 'mutable' } });
      expect(fields).toEqual({ n: fields.n, hash: ZERO, ownerPkh: owner, depth: 4 });
    }
    const now = await deploy(provider, 'now');
    expect((await slots(provider, now.categoryId)).map(({ fields }) => [fields.n, fields.depth])).toEqual([[0n, 1]]);
    await expect(deploy(provider, 0)).rejects.toThrow(/blockhashDepth/);
  }, 120_000);

  it('writes block n into its slot, and blockhash(n) reads it', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider, 4);
    const owner = hash160(provider.blockOracleOwnerPublicKey);
    const n = BigInt(await provider.getBlockHeight()) - 1n;
    await keeper(provider, deployed).writeBlockhashSlot(n, HASH);
    const written = binToHex(buildBlockhashSlotCommitment(n, HASH, owner, 4));
    const holding = async (): Promise<string | undefined> => (await slots(provider, deployed.categoryId))
      .find(({ fields }) => fields.n === n)?.utxo.token?.nft?.commitment;
    expect(await holding()).toBe(written);
    await expect(keeper(provider, deployed).writeBlockhashSlot(n, HASH)).rejects.toThrow(/already holds/);
    await expect(deployed.contract.call.check(n, HASH).send()).resolves.toHaveProperty('txid');
    expect(await holding()).toBe(written);
    // A slot below the depth that was never written reads the zero hash. n = 0 is left out: the SDK sets a
    // height locktime only for a largest n above 0.
    const unwritten = [1n, 2n, 3n].find((s) => s !== n % 4n)!;
    await expect(deployed.contract.call.check(unwritten, ZERO).send()).resolves.toHaveProperty('txid');
    await expect(deployed.contract.call.check(n, ZERO).send()).rejects.toThrow();
  }, 120_000);

  it('refuses an update by a non-owner, back in time, off its residue or ahead of nLockTime', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider, 4);
    const owner = hash160(provider.blockOracleOwnerPublicKey);
    const n = BigInt(await provider.getBlockHeight()) - 1n;
    await keeper(provider, deployed).writeBlockhashSlot(n, HASH);
    const category = hexToBin(deployed.categoryId);
    const lock = blockhashOracleLockingBytecode(category);
    const { utxo } = (await slots(provider, deployed.categoryId)).find(({ fields }) => fields.n === n)!;
    const update = (next: bigint, key = provider.blockOracleOwnerKey, locktime = Number(next)): true | string => {
      const commitment = buildBlockhashSlotCommitment(next, FORGED, owner, 4);
      const token = { ...utxo.token!, nft: { capability: 'mutable' as const, commitment: binToHex(commitment) } };
      return verdict(provider, new TransactionBuilder({ provider })
        .addInput(utxo, blockhashSlotUpdateUnlocker(category, key, commitment))
        .addOutput({ to: lock, amount: utxo.satoshis, token })
        .setLocktime(locktime));
    };
    expect(update(n + 4n)).toBe(true);
    expect(update(n + 4n, alicePriv)).not.toBe(true);
    expect(update(n - 4n)).not.toBe(true);
    expect(update(n + 1n)).not.toBe(true);
    expect(update(n + 5n)).not.toBe(true);
    expect(update(n + 4n, provider.blockOracleOwnerKey, Number(n + 3n))).not.toBe(true);

    // A retire burns the NFT: an output that carries it is refused.
    const retire = (token?: Output['token']): true | string => verdict(provider,
      new TransactionBuilder({ provider, allowImplicitNftBurn: true })
        .addInput(utxo, blockhashSlotRetireUnlocker(category, provider.blockOracleOwnerKey))
        .addOutput({ to: ALICE_LOCK, amount: 1_000n, ...(token === undefined ? {} : { token }) }));
    expect(retire()).toBe(true);
    expect(retire(utxo.token)).not.toBe(true);
    await keeper(provider, deployed).retireBlockhashSlot(n);
    expect((await slots(provider, deployed.categoryId)).map(({ fields }) => fields.n).sort()).toEqual([0n, 1n, 2n]);
  }, 120_000);

  it('refuses a slot minted beside a master call', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider, 4);
    const owner = hash160(provider.blockOracleOwnerPublicKey);
    const n = BigInt(await provider.getBlockHeight()) - 1n;
    await keeper(provider, deployed).writeBlockhashSlot(n, HASH);
    const builder = await deployed.contract.call.check(n, HASH).build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const master = builder.inputs.findIndex((input) => input.token?.nft?.capability === 'minting');
    const lock = binToHex(blockhashOracleLockingBytecode(hexToBin(deployed.categoryId)));
    const slot = transaction.outputs.find((output) => binToHex(output.lockingBytecode) === lock)!;
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const settles = (outputs: typeof transaction.outputs): true | string => vm.stateSuccess(vm.evaluate({
      inputIndex: master, sourceOutputs, transaction: { ...transaction, outputs },
    }));
    expect(master).toBeGreaterThanOrEqual(0);
    expect(settles(transaction.outputs)).toBe(true);
    expect(settles([...transaction.outputs, { lockingBytecode: ALICE_LOCK, valueSatoshis: 1_000n }])).toBe(true);
    const forged = {
      ...slot,
      token: {
        ...slot.token!,
        nft: { ...slot.token!.nft!, commitment: buildBlockhashSlotCommitment(n - 1n, FORGED, owner, 4) },
      },
    };
    expect(settles([...transaction.outputs, forged])).not.toBe(true);
  }, 120_000);
});
