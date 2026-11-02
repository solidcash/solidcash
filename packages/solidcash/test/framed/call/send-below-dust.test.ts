import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { validatorAddress, type FunctionSplitBundle } from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringSplit } from '../../../../solidc/src/compiler.js';
import { SignatureTemplate } from '../../../src/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { functionSplitFor } from '../../../src/framed/deploy/split-registry.js';
import { alicePkh, alicePriv } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A call whose body sends native value below the dust threshold of the output that would carry it.
 *
 * `Router.addLiquidity` is Router02's `addLiquidityETH` in small. It registers the pool when the registry names none,
 * a call whose guard reads a result no fact of the caller holds, reads the pool back, deposits the value it keeps into
 * the wrapper, moves it to the pool, and refunds the rest of `msg.value` to its caller. A refund under the 546
 * satoshis a P2PKH output needs is an amount no node relays. The plan that pays it is the call's own, every
 * participant accepts it, and only the broadcast's builder refused the output; the call took that for a plan that
 * failed, planned the registry's read the other way, and reported that plan's refusal, a frame bound a record off
 * failing for a reason that has nothing to do with the refund. It is refused instead by name, with the frame that
 * sends, the amount, whom it pays and the threshold, before anything is signed. A deposit into the wrapper below the
 * threshold of the container it would pay into is refused the same way, naming the wrapper.
 */

const FRAMED = { composition: 'framed' as const, evmCompat: true, suppressWarnings: true, split: 'func' as const };

const SOURCE = `pragma solidity ^0.8.20;
interface IRegistry {
  function pools(address token, address pool) external view returns (address);
  function register(address token, address pool) external;
}
interface IWrapper {
  function deposit() external payable;
  function transfer(address to, uint256 wad) external returns (bool);
}
library TransferHelper {
  function safeTransferETH(address to, uint256 value) internal {
    (bool success,) = to.call{value: value}(new bytes(0));
    require(success, "TransferHelper: ETH_TRANSFER_FAILED");
  }
}
contract Registry {
  mapping(address => mapping(address => address)) public pools;
  function register(address token, address pool) external { pools[token][pool] = pool; }
}
contract Wrapper {
  mapping(address => uint256) public balanceOf;
  function deposit() public payable { balanceOf[msg.sender] += msg.value; }
  function transfer(address dst, uint256 wad) public returns (bool) {
    require(balanceOf[msg.sender] >= wad, "Wrapper: short");
    balanceOf[msg.sender] -= wad;
    balanceOf[dst] += wad;
    return true;
  }
}
contract Router {
  address public immutable registry;
  address public immutable wrapper;
  constructor(address r, address w) { registry = r; wrapper = w; }
  function addLiquidity(address pool, uint256 amount) external payable {
    if (IRegistry(registry).pools(wrapper, pool) == address(0)) IRegistry(registry).register(wrapper, pool);
    address registered = IRegistry(registry).pools(wrapper, pool);
    IWrapper(wrapper).deposit{value: amount}();
    assert(IWrapper(wrapper).transfer(registered, amount));
    if (msg.value > amount) TransferHelper.safeTransferETH(msg.sender, msg.value - amount);
  }
}`;

const VALIDATOR = framedValidator.buildValidatorProgram();
const FUNDER = new SignatureTemplate(alicePriv).unlockP2PKH();
const USER = encodeLockingBytecodeP2pkh(alicePkh);
const USER_ADDRESS = ((): string => {
  const encoded = lockingBytecodeToCashAddress({ bytecode: USER, prefix: 'bchtest' });
  if (typeof encoded === 'string') throw new Error(encoded);
  return encoded.address;
})();
/** The pool the router pays into: any address the wrapper books a balance for. */
const POOL = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x5d));
const VALUE = 1_000_000n;

const shardsOf = (primaryContractName: string): FunctionSplitBundle =>
  compileStringSplit(SOURCE, { ...FRAMED, primaryContractName }) as FunctionSplitBundle;
const UNITS = { Registry: shardsOf('Registry'), Wrapper: shardsOf('Wrapper'), Router: shardsOf('Router') };

interface Deployment {
  readonly bundle: FunctionSplitBundle;
  readonly categoryId: string;
  readonly address: Uint8Array;
}

interface Chain {
  readonly network: MockNetworkProvider;
  readonly registry: Deployment;
  readonly wrapper: Deployment;
  readonly router: Deployment;
  readonly coin: () => Promise<Utxo>;
}

let coins = 0;

/** The three contracts on a network that enforces dust or not, the pool registered by a first deposit. */
async function chain(enforceDust: boolean): Promise<Chain> {
  const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS, policy: { enforceDust } });
  await fundShippedFacets(network);
  const coin = async (): Promise<Utxo> => {
    coins += 1;
    const utxo = { txid: `5d${coins.toString(16).padStart(6, '0')}`.padEnd(64, 'd'), vout: 0, satoshis: 5_000_000n };
    await network.addUtxo(binToHex(USER), utxo);
    return utxo;
  };
  const deploy = async (bundle: FunctionSplitBundle, args: readonly Uint8Array[]): Promise<Deployment> => {
    const { categoryId } = await deployStatefulContract(bundle.logical, [...args] as never, {
      provider: network, fundingUtxo: await coin(), funder: FUNDER, changeAddress: USER_ADDRESS,
      threadCount: 2, validatorCount: 1, functionSplit: bundle,
    });
    return {
      bundle: functionSplitFor(network, categoryId) ?? bundle, categoryId,
      address: validatorAddress(hexToBin(categoryId), VALIDATOR),
    };
  };
  const registry = await deploy(UNITS.Registry, []);
  const wrapper = await deploy(UNITS.Wrapper, []);
  const router = await deploy(UNITS.Router, [registry.address, wrapper.address]);
  const deployed = { network, registry, wrapper, router, coin };
  const first = await addLiquidity(deployed, VALUE, await coin());
  expect(first.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return deployed;
}

/** The router's deposit of `amount` from a call carrying `VALUE`, paid with `callerUtxo`. */
function addLiquidity(c: Chain, amount: bigint, callerUtxo: Utxo): Promise<FramedCallResult> {
  return callFramedEntry({
    provider: c.network, artifact: c.router.bundle.logical, categoryId: c.router.categoryId, split: c.router.bundle,
    functionName: 'addLiquidity', args: [POOL, amount], value: VALUE,
    externals: {
      Registry: { artifact: c.registry.bundle.logical, categoryId: c.registry.categoryId },
      Wrapper: { artifact: c.wrapper.bundle.logical, categoryId: c.wrapper.categoryId },
    },
    callerUtxo, callerLockingBytecode: USER, funder: FUNDER, changeAddress: USER_ADDRESS,
    vm: compositionMachine(), validatorProgram: VALIDATOR,
  });
}

/**
 * What a call that broadcast nothing met: the error it raised, or the refusal it returned, as the handle's `send()`
 * raises it. And whether the caller's coin was left unspent.
 */
async function refused(c: Chain, amount: bigint): Promise<{ readonly error: unknown; readonly coinKept: boolean }> {
  const callerUtxo = await c.coin();
  const error = await addLiquidity(c, amount, callerUtxo).then((result) => (result.broadcast === undefined
    ? new Error(result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.id}: ${verdict.objection ?? 'refused'}`).join('; '))
    : undefined), (caught: unknown) => caught);
  const live = await c.network.getUtxosForLockingBytecode(USER);
  return { error, coinKept: live.some((utxo) => utxo.txid === callerUtxo.txid && utxo.vout === callerUtxo.vout) };
}

/** The value a broadcast pays to a lock, one output each. */
const paymentsTo = (result: FramedCallResult, lock: Uint8Array): readonly bigint[] => (result.broadcast?.outputs ?? [])
  .filter((output) => binToHex(output.lockingBytecode) === binToHex(lock))
  .map((output) => output.valueSatoshis);

describe('a call that sends native value below dust', () => {
  it('refunds exactly the dust threshold, as before', async () => {
    const c = await chain(true);
    const result = await addLiquidity(c, VALUE - 546n, await c.coin());
    expect(result.accepted).toBe(true);
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(paymentsTo(result, USER)).toContain(546n);
  }, 600_000);

  it('refuses a refund below it by name: the frame that sends, the amount, whom and the threshold', async () => {
    const c = await chain(true);
    for (const refund of [545n, 1n]) {
      const { error, coinKept } = await refused(c, VALUE - refund);
      expect(error).toMatchObject({
        name: 'FramedSendBelowDustError', code: 'FRAMED_SEND_BELOW_DUST', frame: 'Router.addLiquidity()',
        recipient: USER_ADDRESS, amount: refund, threshold: 546n,
      });
      expect((error as Error).message).toBe(`FRAMED_SEND_BELOW_DUST: Router.addLiquidity() sends ${refund} `
        + `satoshi${refund === 1n ? '' : 's'} to ${USER_ADDRESS}, below the 546-satoshi dust threshold of the output `
        + 'that would carry it, which no node relays, so the call is refused');
      expect(coinKept).toBe(true);
    }
  }, 600_000);

  it('refuses a deposit below the threshold of the container it would pay into, naming the contract', async () => {
    const c = await chain(true);
    // A container is a P2SH32 output of 44 bytes: 3 * (44 + 148) satoshis.
    const { error, coinKept } = await refused(c, 100n);
    expect(error).toMatchObject({
      code: 'FRAMED_SEND_BELOW_DUST', frame: 'Router.addLiquidity()', recipient: 'Wrapper', amount: 100n,
      threshold: 576n,
    });
    expect(coinKept).toBe(true);
  }, 600_000);

  it('pays a refund below it on a network that does not enforce dust, as before', async () => {
    const c = await chain(false);
    const result = await addLiquidity(c, VALUE - 1n, await c.coin());
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(paymentsTo(result, USER)).toContain(1n);
  }, 600_000);
});
