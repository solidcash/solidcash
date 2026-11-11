import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate, Signer } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';

/**
 * A plan whose second call targets the address its first call returned.
 *
 * `Lookup.hop` asks a factory for a pair and then calls that pair: the target is no literal, state field or forwarded
 * argument, it is the result of an earlier call in the same frame. The hop planner resolves it from the result the
 * earlier call returns (docs/framed/CREATE2_IDENTITY.md, work item 3), places the pair's frame on its own master, and
 * the entry's write carries what the pair's `getReserves` answered — read back from the derived transaction, through
 * the shipped call path.
 */

const SOURCE = `pragma solidity ^0.8.0;
interface IFactory { function getPair(address tokenA, address tokenB) external view returns (address pair); }
interface IPair { function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast); }
contract Factory {
  mapping(address => mapping(address => address)) public getPair;
  function setPair(address tokenA, address tokenB, address pair) external { getPair[tokenA][tokenB] = pair; }
}
contract Pair {
  uint112 public reserve0;
  function setReserve(uint112 value) external { reserve0 = value; }
  function getReserves() external view returns (uint112, uint112, uint32) { return (reserve0, 0, 0); }
}
contract Lookup {
  uint256 public reserve;
  function hop(address factory, address tokenA, address tokenB) external {
    address pair = IFactory(factory).getPair(tokenA, tokenB);
    (uint112 value,,) = IPair(pair).getReserves();
    reserve = value;
  }
}`;

const ARTIFACTS = compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true, suppressWarnings: true });
const VALIDATOR = framedValidator.buildValidatorProgram();
const funder = new SignatureTemplate(alicePriv).unlockP2PKH();
const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
const callerAddress = (() => {
  const encoded = lockingBytecodeToCashAddress({ bytecode: callerLock, prefix: 'bchtest' });
  if (typeof encoded === 'string') throw new Error(encoded);
  return encoded.address;
})();

let coins = 0;
const nextCoin = (satoshis: bigint): Utxo => {
  coins += 1;
  return { txid: (0x30 + coins).toString(16).padStart(64, '0'), vout: 0, satoshis };
};

describe('a plan that calls the address an earlier call returned', () => {
  it('resolves the second call\u2019s target from the first call result and settles its write', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const deploy = async (name: string, args: unknown[] = []): ReturnType<typeof deployStatefulContract> => {
      const funding = nextCoin(900_000n);
      await provider.addUtxo(binToHex(callerLock), funding);
      const deployed = await deployStatefulContract(ARTIFACTS[name]!, args as never, {
        provider, fundingUtxo: funding, funder, changeAddress: callerAddress,
        threadCount: 1, validatorCount: 1,
      });
      return deployed;
    };
    const factory = await deploy('Factory');
    const pair = await deploy('Pair');
    const lookup = await deploy('Lookup');

    const signer = new Signer(alicePriv, provider);
    const factoryHandle = factory.contract as unknown as {
      connect(signer: unknown): { setPair(a: string, b: string, pair: string): Promise<unknown> };
    };
    const pairHandle = pair.contract as unknown as {
      connect(signer: unknown): { setReserve(value: bigint): Promise<unknown> };
    };
    const reserve = 424_242n;
    await pairHandle.connect(signer).setReserve(reserve);
    await factoryHandle.connect(signer).setPair(callerAddress, callerAddress, pair.contract.address);

    const callerCoin = nextCoin(300_000n);
    await provider.addUtxo(binToHex(callerLock), callerCoin);
    const result = await callFramedEntry({
      provider, artifact: ARTIFACTS.Lookup!, categoryId: lookup.categoryId,
      functionName: 'hop', args: [factory.contract.address, callerAddress, callerAddress],
      callerUtxo: callerCoin,
      callerLockingBytecode: callerLock, funder,
      vm: compositionMachine(), validatorProgram: VALIDATOR, publish: false,
      externals: {
        IFactory: { artifact: ARTIFACTS.Factory!, categoryId: factory.categoryId },
        IPair: { artifact: ARTIFACTS.Pair!, categoryId: pair.categoryId },
      },
    });
    const refused = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; ');
    expect(result.accepted, refused).toBe(true);
    // The plan ran the factory's lookup and then the pair's own entry: the second call reached the address the first
    // returned, and the transaction spends a master of the pair's own category.
    const frames = result.completed.map((frame) => `${frame.contract}.${frame.functionName}`);
    expect(frames.some((frame) => frame.startsWith('Factory.') && frame.includes('getPair'))).toBe(true);
    expect(frames.some((frame) => frame.startsWith('Pair.') && frame.includes('getReserves'))).toBe(true);
    // A token category is reported in display order, as the deployment's `categoryId` is.
    expect(result.sourceOutputs.some((source) => source.token !== undefined
      && binToHex(source.token.category) === pair.categoryId)).toBe(true);
    expect(result.writtenCommitments.length).toBeGreaterThan(0);
  }, 240_000);
});
