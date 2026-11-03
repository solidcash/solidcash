import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  blockhashOracleLockingBytecode, buildBlockhashSlotCommitment, decodeBlockhashSlotCommitment, hash160,
  type Artifact, type BlockhashSlotFields,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { ContractFactory, StatefulContract } from '../../src/stateful/index.js';
import { HDSigner } from '../../src/HDSigner.js';
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
// A reader of the block below block.number, whose ring needs one slot: any depth from 1 deploys it.
const RECENT = 'contract Recent(){ function check(bytes32 expected) { require(blockhash(block.number - 1) == expected); } }';
// A reader of the block five below block.number, whose ring needs five slots.
const BACK5 = 'contract Back(){ function check(bytes32 expected) { require(blockhash(block.number - 5) == expected); } }';
// The EVM idiom for an expired commitment: a block older than the last 256 hashes to zero.
const EXPIRY_SOURCE = 'contract Expiry(){ function expired(int n) { require(blockhash(n) == 0); } }';
const ZERO = new Uint8Array(32);
const HASH = new Uint8Array(32).fill(0xb7);
const NEWER = new Uint8Array(32).fill(0xc5);
const FORGED = new Uint8Array(32).fill(0xee);
const ALICE_LOCK = Uint8Array.from([0x76, 0xa9, 0x14, ...alicePkh, 0x88, 0xac]);

describe('blockhash ring', () => {
  const artifact = compileString(SOURCE);
  const recent = compileString(RECENT);
  const back5 = compileString(BACK5);

  type Deployed = Awaited<ReturnType<typeof StatefulContract.deploy>>;

  async function deploy(
    provider: MockNetworkProvider, blockhashDepth?: number | 'now', reader: Artifact = artifact,
  ): Promise<Deployed> {
    // A full ring of 256 slots holds 307,200 satoshis.
    const fundingUtxo = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 1_000_000n }));
    return StatefulContract.deploy(reader, [], {
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

  it('mints the depth bounded reads need by default, refuses a smaller one, and leaves unbounded reads to the deployer',
    async () => {
    const provider = new MockNetworkProvider();
    expect(recent.blockhashDepth).toBe(1);
    expect(back5.blockhashDepth).toBe(5);
    expect(artifact.blockhashDepth).toBeUndefined();
    expect((await slots(provider, (await deploy(provider, undefined, recent)).categoryId)).map(({ fields }) => fields))
      .toEqual([{ n: 0n, hash: ZERO, ownerPkh: hash160(provider.blockOracleOwnerPublicKey), depth: 1 }]);
    const any = await slots(provider, (await deploy(provider)).categoryId);
    expect(any).toHaveLength(256);
    expect(any.every(({ fields }) => fields.depth === 256)).toBe(true);
    expect(await slots(provider, (await deploy(provider, 4)).categoryId)).toHaveLength(4);
    expect(await slots(provider, (await deploy(provider, 'now')).categoryId)).toHaveLength(1);
    await expect(deploy(provider, 4, back5)).rejects.toThrow(/blockhashDepth 4 is below the 5 slots/);
  }, 120_000);

  it('mints blockhashDepth slots at genesis, one for now', async () => {
    const provider = new MockNetworkProvider();
    const owner = hash160(provider.blockOracleOwnerPublicKey);
    const four = await deploy(provider, 4, recent);
    const ring = await slots(provider, four.categoryId);
    expect(ring.map(({ fields }) => fields.n).sort()).toEqual([0n, 1n, 2n, 3n]);
    for (const { utxo, fields } of ring) {
      expect(utxo.satoshis).toBe(1_200n);
      expect(utxo.token).toMatchObject({ category: four.categoryId, amount: 0n, nft: { capability: 'mutable' } });
      expect(fields).toEqual({ n: fields.n, hash: ZERO, ownerPkh: owner, depth: 4 });
    }
    const now = await deploy(provider, 'now', recent);
    expect((await slots(provider, now.categoryId)).map(({ fields }) => [fields.n, fields.depth])).toEqual([[0n, 1]]);
    await expect(deploy(provider, 0, recent)).rejects.toThrow(/blockhashDepth/);
  }, 120_000);

  it('passes the ring options through a contract factory', async () => {
    const provider = new MockNetworkProvider();
    const signer = HDSigner.fromPhrase('test test test test test test test test test test test junk', provider);
    await provider.addUtxo(signer.getAddress(), { txid: '5a'.repeat(32), vout: 0, satoshis: 10_000_000n });
    const contract = await new ContractFactory(recent, signer).deploy({ blockhashDepth: 2 });
    expect((await slots(provider, contract.categoryId)).map(({ fields }) => fields.n).sort()).toEqual([0n, 1n]);
  });

  it('writes block n into its slot, and blockhash(n) reads it', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider);
    const owner = hash160(provider.blockOracleOwnerPublicKey);
    const n = BigInt(await provider.getBlockHeight()) - 1n;
    await keeper(provider, deployed).writeBlockhashSlot(n, HASH);
    const written = binToHex(buildBlockhashSlotCommitment(n, HASH, owner, 256));
    const holding = async (): Promise<string | undefined> => (await slots(provider, deployed.categoryId))
      .find(({ fields }) => fields.n === n)?.utxo.token?.nft?.commitment;
    expect(await holding()).toBe(written);
    await expect(keeper(provider, deployed).writeBlockhashSlot(n, HASH)).rejects.toThrow(/already holds/);
    await expect(deployed.contract.call.check(n, HASH).send()).resolves.toHaveProperty('txid');
    expect(await holding()).toBe(written);
    // Slot 0 was never written (n is not a multiple of the depth): blockhash(0) reads the zero hash under a
    // height locktime of 0. A wrong hash is refused.
    expect(n % 256n).not.toBe(0n);
    await expect(deployed.contract.call.check(0n, ZERO).send()).resolves.toHaveProperty('txid');
    await expect(deployed.contract.call.check(n, ZERO).send()).rejects.toThrow();
  }, 120_000);

  it('refuses an update by a non-owner, back in time, off its residue or ahead of nLockTime', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider, 4, recent);
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
    const deployed = await deploy(provider);
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

  it('reads zero for a block older than a full ring keeps, as the EVM does', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider);
    const n = BigInt(await provider.getBlockHeight()) - 300n;
    const holding = async (block: bigint): Promise<string | undefined> => (await slots(provider, deployed.categoryId))
      .find(({ fields }) => fields.n === block)?.utxo.token?.nft?.commitment;
    await keeper(provider, deployed).writeBlockhashSlot(n, HASH);
    await expect(deployed.contract.call.check(n, HASH).send()).resolves.toHaveProperty('txid');
    // The slot of block n takes block n + 256, so n is older than the last 256 blocks. The read keeps the slot.
    await keeper(provider, deployed).writeBlockhashSlot(n + 256n, NEWER);
    const newer = await holding(n + 256n);
    await expect(deployed.contract.call.check(n, ZERO).send()).resolves.toHaveProperty('txid');
    expect(await holding(n + 256n)).toBe(newer);
    await expect(deployed.contract.call.check(n + 256n, NEWER).send()).resolves.toHaveProperty('txid');

    const expiry = await deploy(provider, undefined, compileString(EXPIRY_SOURCE, { evmCompat: true }));
    await keeper(provider, expiry).writeBlockhashSlot(n + 256n, NEWER);
    await expect(expiry.contract.call.expired(n).send()).resolves.toHaveProperty('txid');
    await expect(expiry.contract.call.expired(n + 256n).send()).rejects.toThrow();
    await expect(deployed.contract.call.check(n, HASH).send()).rejects.toThrow();
  }, 120_000);

  it('refuses a block a shallower ring no longer holds, or one its keeper has not written', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider, 4);
    const n = BigInt(await provider.getBlockHeight()) - 10n;
    await keeper(provider, deployed).writeBlockhashSlot(n, HASH);
    await keeper(provider, deployed).writeBlockhashSlot(n + 4n, NEWER);
    const held = (await slots(provider, deployed.categoryId)).map(({ fields }) => fields.n).sort((a, b) => Number(a - b));
    const ring = `the blockhash ring of category ${deployed.categoryId} \\(depth 4\\) holds blocks ${held.join(', ')}`;
    await expect(deployed.contract.call.check(n, ZERO).send()).rejects
      .toThrow(new RegExp(`blockhash\\(${n}\\): ${ring}; block ${n} is older than the ring keeps`));
    await expect(deployed.contract.call.check(n + 5n, ZERO).send()).rejects
      .toThrow(new RegExp(`blockhash\\(${n + 5n}\\): ${ring}; block ${n + 5n} is not yet written by its keeper`));
  }, 120_000);

  it('refuses on chain a zero read from a slot of another residue, an older slot or a shallower ring', async () => {
    const provider = new MockNetworkProvider();
    const deployed = await deploy(provider);
    const owner = hash160(provider.blockOracleOwnerPublicKey);
    const n = BigInt(await provider.getBlockHeight()) - 600n;
    const commitmentOf = async (block: bigint): Promise<Uint8Array> => hexToBin(
      (await slots(provider, deployed.categoryId)).find(({ fields }) => fields.n === block)!.utxo.token!.nft!.commitment,
    );
    await keeper(provider, deployed).writeBlockhashSlot(n - 256n, HASH);
    const older = await commitmentOf(n - 256n);
    await keeper(provider, deployed).writeBlockhashSlot(n + 256n, HASH);
    await keeper(provider, deployed).writeBlockhashSlot(n + 257n, HASH);
    const otherResidue = await commitmentOf(n + 257n);

    // The honest zero read of block n, its slot holding n + 256. Each case hands the reader another commitment
    // in that slot and in its recreation, so only the reader's own check can refuse it.
    const builder = await deployed.contract.call.check(n, ZERO).build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const master = builder.inputs.findIndex((input) => input.token?.nft?.capability === 'minting');
    const lock = binToHex(blockhashOracleLockingBytecode(hexToBin(deployed.categoryId)));
    const at = sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode) === lock);
    type VmOutput = (typeof sourceOutputs)[number];
    const carrying = (output: VmOutput, commitment: Uint8Array): VmOutput => ({
      ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } },
    });
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const reads = (commitment: Uint8Array): true | string => vm.stateSuccess(vm.evaluate({
      inputIndex: master,
      sourceOutputs: sourceOutputs.map((output, index) => (index === at ? carrying(output, commitment) : output)),
      transaction: {
        ...transaction,
        outputs: transaction.outputs.map((output, index) => (index === at ? carrying(output, commitment) : output)),
      },
    }));
    expect(master).toBeGreaterThanOrEqual(0);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(reads(sourceOutputs[at].token!.nft!.commitment)).toBe(true);
    expect(reads(otherResidue)).not.toBe(true);
    expect(reads(older)).not.toBe(true);
    // A newer block in a ring under 256 deep proves nothing about the EVM's window.
    expect(reads(buildBlockhashSlotCommitment(n + 256n, HASH, owner, 4))).not.toBe(true);
  }, 120_000);
});
