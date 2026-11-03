import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import {
  asmToBytecode, blockOracleFieldValue, blockOracleLockingBytecode, bytesEqual, findBlockOracleLockSlots, hash160,
  type FunctionSplitBundle,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { framedCall, framedDeploy } from '../../../src/framed/index.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A child that reads `block.timestamp`, created inside its creator's transaction.
 *
 * Every block.* reader owns a block-info oracle of its own category, and a child's category `K` exists only once its
 * creation spends the caller's coin. So the child's masters derive their oracle's lock from their own token rather
 * than carrying a lock per category, which keeps them at the one lock per entry its creator names; the child's
 * genesis, minted by the creating transaction, mints that oracle; and the creator's check of the outputs of `K`
 * admits it. The creator's constants come from the public `framedDeploy.framedChildConstants`, once, and serve every
 * child it creates.
 */

const FRAMED = { composition: 'framed' as const, evmCompat: true, suppressWarnings: true, split: 'func' as const };

const SOURCE = `pragma solidity ^0.8.0;
contract Clock {
  uint256 public stamp;
  uint256 public ticks;
  function touch() external { stamp = block.timestamp; ticks = ticks + 1; }
}
contract Factory {
  uint256 public made;
  function make(bytes32 salt) external returns (address clock) {
    bytes memory code = type(Clock).creationCode;
    assembly { clock := create2(0, add(code, 32), mload(code), salt) }
    made = made + 1;
  }
}`;

const VALIDATOR = framedValidator.buildValidatorProgram();
const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
const callerAddress = (() => {
  const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
  if (typeof encoded === 'string') throw new Error(encoded);
  return encoded.address;
})();

let coins = 0;
/** A fresh genesis-eligible coin at the caller's lock: its txid is the category a creation it pays for mints. */
const freshCoin = async (provider: MockNetworkProvider, satoshis: bigint): Promise<Utxo> => {
  coins += 1;
  const coin = { txid: (0x7a0 + coins).toString(16).padStart(64, '0'), vout: 0, satoshis };
  await provider.addUtxo(binToHex(callerLock), coin);
  return coin;
};

const shardsOf = (primaryContractName: string): FunctionSplitBundle =>
  compileStringSplit(SOURCE, { ...FRAMED, primaryContractName }) as FunctionSplitBundle;

/** Refusals of a framed call, for an assertion message. */
const refusals = (result: { verdicts: readonly { id: string; accepted: boolean; objection?: string }[] }): string =>
  result.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');

/** A commitment as hex, whether the transaction view holds it as bytes or as hex. */
const commitmentHex = (commitment: Uint8Array | string): string =>
  (typeof commitment === 'string' ? commitment : binToHex(commitment)).toLowerCase();

/** The live oracle of category `categoryId`: the mutable NFT of that category at the lock it gives. */
async function oracleOf(provider: MockNetworkProvider, categoryId: string): Promise<Utxo | undefined> {
  return (await provider.getUtxosForLockingBytecode(blockOracleLockingBytecode(hexToBin(categoryId))))
    .find((utxo) => utxo.token?.category === categoryId && utxo.token.nft?.capability === 'mutable');
}

describe('a child that reads block.timestamp, created in its creator\'s transaction', () => {
  const clock = shardsOf('Clock');
  const factory = shardsOf('Factory');
  const touchShard = clock.shards.find((shard) => shard.function === 'touch')!;

  /** A factory deployed with the clock's constants, as the public SDK computes them. */
  const deployFactory = async (provider: MockNetworkProvider): Promise<{
    readonly constants: framedDeploy.FramedChildConstants;
    readonly categoryId: string;
    readonly split: FunctionSplitBundle;
  }> => {
    const constants = framedDeploy.framedChildConstants({
      artifact: clock.logical, split: clock, provider, pool: { masters: 1, validators: 1 },
    });
    const { childLocks, childCollections, childOutputCount, childPool, childBlockOracleOwner } = constants;
    const funding = await freshCoin(provider, 1_500_000n);
    const { categoryId } = await deployStatefulContract(factory.logical, [], {
      provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
      threadCount: 1, validatorCount: 1, functionSplit: factory, childLocks, childCollections, childOutputCount,
      childPool, childBlockOracleOwner,
    });
    return { constants, categoryId, split: framedDeploy.functionSplitFor(provider, categoryId) ?? factory };
  };

  it('has masters that derive their oracle lock, so each entry has one lock for every category', () => {
    expect(touchShard.artifact.usesBlockOracle).toBe(true);
    expect(touchShard.artifact.blockOracleLockSlots).toBeUndefined();
    expect(findBlockOracleLockSlots(asmToBytecode(touchShard.artifact.bytecode))).toEqual([]);
    const first = framedDeploy.deployMaster(touchShard.artifact, new Uint8Array(32).fill(0x31), VALIDATOR);
    const second = framedDeploy.deployMaster(touchShard.artifact, new Uint8Array(32).fill(0x32), VALIDATOR);
    expect(binToHex(first.lockingBytecode)).toBe(binToHex(second.lockingBytecode));
  });

  it('is created with its own oracle, reads it, and a second child of another category works from the same constants',
    async () => {
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      // The factory's constants, from the public SDK, once: the clock's locks, collections and genesis output count,
      // which counts the clock's own oracle.
      const { constants, categoryId: factoryCategory, split: factorySplit } = await deployFactory(provider);
      const { childLocks, childOutputCount } = constants;
      expect(childLocks).toHaveLength(clock.shards.length + clock.internalCuts.length);
      const withoutOracle = framedDeploy.childGenesisOutputCount({
        artifact: { ...clock.logical, usesBlockOracle: false }, category: new Uint8Array(32).fill(9),
        validatorProgram: VALIDATOR, provider, split: clock, pool: constants.childPool, ownerLock: callerLock,
      });
      expect(childOutputCount).toBe(withoutOracle + 1);
      const owner = binToHex(hash160(provider.blockOracleOwnerPublicKey));

      const created: string[] = [];
      for (const salt of [new Uint8Array(32), new Uint8Array(32).fill(1)]) {
        // The creation: the caller's fresh coin is the clock's category `K`.
        const coin = await freshCoin(provider, 9_000_000n);
        const creation = await framedCall.callFramedEntry({
          provider, artifact: factory.logical, categoryId: factoryCategory, functionName: 'make', args: [salt],
          callerUtxo: coin, callerLockingBytecode: callerLock, funder, split: factorySplit,
          vm: compositionMachine(), validatorProgram: VALIDATOR,
          creates: { artifact: clock.logical, split: clock, pool: constants.childPool },
        });
        expect(creation.accepted, refusals(creation)).toBe(true);
        const categoryId = coin.txid;
        const category = hexToBin(categoryId);
        created.push(categoryId);

        // The genesis the creating transaction minted holds the clock's masters at the factory's constant locks and
        // the clock's own oracle, at the lock its category gives, naming the network's oracle owner.
        const ofK = creation.transaction.outputs.filter((output) => output.token !== undefined
          && bytesEqual(output.token.category, category));
        expect(ofK).toHaveLength(childOutputCount);
        for (const lock of childLocks) {
          expect(ofK.some((output) => bytesEqual(output.lockingBytecode, lock)
            && output.token!.nft?.capability === 'minting'), `master at ${binToHex(lock).slice(0, 16)}`).toBe(true);
        }
        const oracleLock = blockOracleLockingBytecode(category);
        const oracleOutputs = ofK.filter((output) => bytesEqual(output.lockingBytecode, oracleLock));
        expect(oracleOutputs).toHaveLength(1);
        expect(oracleOutputs[0]!.token!.nft?.capability).toBe('mutable');
        expect(commitmentHex(oracleOutputs[0]!.token!.nft!.commitment).slice(0, 40)).toBe(owner);
        const oracle = await oracleOf(provider, categoryId);
        expect(oracle, 'the clock\'s oracle is live').toBeDefined();

        // A later call on the clock reads its own oracle: the block time the network keeps in it.
        provider.increaseTime(3_600);
        await provider.mine();
        const now = blockOracleFieldValue(hexToBin((await oracleOf(provider, categoryId))!.token!.nft!.commitment), 'timestamp');
        expect(now).toBe(BigInt(provider.getBlockTime()));
        const caller = await freshCoin(provider, 900_000n);
        const touched = await framedCall.callFramedEntry({
          provider, artifact: clock.logical, categoryId, functionName: 'touch',
          callerUtxo: caller, callerLockingBytecode: callerLock, funder, split: clock,
          vm: compositionMachine(), validatorProgram: VALIDATOR,
        });
        expect(touched.accepted, refusals(touched)).toBe(true);
        if (created.length === 1) {
          // The clock's masters hold its minting NFT, so a call beside a read could mint a look-alike oracle with
          // fields of its choosing at the lock they derive: each refuses an output there that is not the oracle input
          // at its index recreated unchanged.
          const forged = await framedCall.callFramedEntry({
            provider, artifact: clock.logical, categoryId, functionName: 'touch',
            callerUtxo: await freshCoin(provider, 900_000n), callerLockingBytecode: callerLock, funder, split: clock,
            vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
            extraOutputs: [{
              to: blockOracleLockingBytecode(category), amount: 1_200n,
              token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: 'ff'.repeat(46) } },
            }],
          });
          expect(forged.accepted).toBe(false);
          // The master's own pin refuses it, beside the validator's census of the clock's outputs.
          expect(forged.verdicts.find((verdict) => verdict.id === 'master')?.accepted).toBe(false);
        }
        const { byNft } = await framedDeploy.readFramedState(provider, categoryId, clock.logical.stateLayout!);
        const state = Object.assign({}, ...byNft) as Record<string, unknown>;
        expect(state.stamp).toBe(now);
        expect(state.ticks).toBe(1n);
      }

      // Two children, two categories, two oracles: each reads its own, from masters at the same locks.
      expect(created[0]).not.toBe(created[1]);
      const { byNft } = await framedDeploy.readFramedState(provider, factoryCategory, factory.logical.stateLayout!);
      expect((Object.assign({}, ...byNft) as Record<string, unknown>).made).toBe(2n);
    }, 600_000);

  it('refuses a creation that mints the child a second oracle', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const { constants, categoryId, split } = await deployFactory(provider);
    const coin = await freshCoin(provider, 9_000_000n);
    type Creation = ReturnType<typeof framedCall.callFramedEntry>;
    const plan = (extraOutputs?: Parameters<typeof framedCall.callFramedEntry>[0]['extraOutputs']): Creation =>
      framedCall.callFramedEntry({
        provider, artifact: factory.logical, categoryId, functionName: 'make', args: [new Uint8Array(32)],
        callerUtxo: coin, callerLockingBytecode: callerLock, funder, split,
        vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
        creates: { artifact: clock.logical, split: clock, pool: constants.childPool },
        ...(extraOutputs === undefined ? {} : { extraOutputs }),
      });
    const honest = await plan();
    expect(honest.accepted, refusals(honest)).toBe(true);
    // A look-alike at the clock's own oracle lock, whose fields its minter chose: a reader takes the first oracle input
    // it finds, so a second one would let a caller pick the time.
    const forged = await plan([{
      to: blockOracleLockingBytecode(hexToBin(coin.txid)), amount: 1_200n,
      token: { category: coin.txid, amount: 0n, nft: { capability: 'mutable', commitment: 'ff'.repeat(46) } },
    }]);
    expect(forged.accepted).toBe(false);
    expect(forged.verdicts.find((verdict) => !verdict.accepted)?.objection ?? '').toMatch(/VERIFY|verify/);
  }, 600_000);
});
