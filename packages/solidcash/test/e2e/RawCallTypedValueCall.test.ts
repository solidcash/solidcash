import { binToHex, hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract, RawCallCalleeRequiredError } from '../../src/index.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import { StatefulContract, getSatoshiContainerAddress, registerDeployment } from '../../src/stateful/index.js';
import { compileString } from '../direct-compile.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A low-level call whose payload names a function that declares a result is compiled as the raw external call that
// reads its callee's record, whatever its options: `{value: v}` stays the call's value, and `{gas: g}` is an inert
// hint. Each form below that names such a function publishes the record read. A direct build refuses the value: it
// would pay the call's target, the callee's master lock, where the coin is stuck and the callee never sees it.

const EVM_OPTIONS = { evmCompat: true, forceStateful: true } as const;

/** A token whose transfer records the amount and answers `true`. */
const TOKEN = `pragma solidity ^0.8.0;
contract Token {
  uint256 public moved;
  function transfer(address, uint256 amount) external returns (bool) {
    moved = amount;
    return true;
  }
}`;

/** The typed payload sent with a value: directly, and through an inlined OpenZeppelin-style helper. */
const VALUE_PAYER = `pragma solidity ^0.8.0;
interface IToken { function transfer(address to, uint256 amount) external returns (bool); }
library ValueCall {
  function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
    (bool success, bytes memory returndata) = target.call{value: value}(data);
    require(success, "CALL_FAILED");
    return returndata;
  }
}
contract ValuePayer {
  IToken public token;
  uint256 public paid;
  function payDirect(uint256 amount, uint256 v) external {
    (bool ok, bytes memory data) = address(token).call{value: v}(abi.encodeCall(IToken.transfer, (address(this), amount)));
    require(ok && (data.length == 0 || abi.decode(data, (bool))), "PAY_FAILED");
    paid = paid + amount;
  }
  function payThroughHelper(uint256 amount, uint256 v) external {
    bytes memory data = ValueCall.functionCallWithValue(
      address(token), abi.encodeCall(IToken.transfer, (address(this), amount)), v);
    require(data.length == 0 || abi.decode(data, (bool)), "PAY_FAILED");
    paid = paid + amount;
  }
}`;

const INTERFACE = 'interface IToken { function transfer(address to, uint256 amount) external returns (bool); }';
const CHECK = 'require(ok && (data.length == 0 || abi.decode(data, (bool)))); n = n + 1;';

/** Each payload form that names `IToken.transfer`, which declares a `bool` result. */
const TYPED_FORMS: ReadonlyArray<readonly [string, string]> = [
  ['abi.encodeCall(token.transfer, ..) with token a parameter',
    `function f(IToken token, uint256 v) external {
      (bool ok, bytes memory data) = address(token).call(abi.encodeCall(token.transfer, (address(this), v))); ${CHECK} }`],
  ['abi.encodeCall(token.transfer, ..) with token a local',
    `function f(address t, uint256 v) external { IToken token = IToken(t);
      (bool ok, bytes memory data) = address(token).call(abi.encodeCall(token.transfer, (address(this), v))); ${CHECK} }`],
  ['abi.encodeCall(stored.transfer, ..) with stored an interface-typed state variable',
    `function f(uint256 v) external {
      (bool ok, bytes memory data) = address(stored).call(abi.encodeCall(stored.transfer, (address(this), v))); ${CHECK} }`],
  ['abi.encodeWithSelector(stored.transfer.selector, ..) with stored a state variable',
    `function f(uint256 v) external {
      (bool ok, bytes memory data) = address(stored).call(abi.encodeWithSelector(stored.transfer.selector, address(this), v));
      ${CHECK} }`],
  ['a {gas: g} option alone',
    `function f(IToken token, uint256 v) external {
      (bool ok, bytes memory data) = address(token).call{gas: 50000}(abi.encodeCall(token.transfer, (address(this), v)));
      ${CHECK} }`],
];

type Provider = ReturnType<typeof createTestProvider>;
type Deployed = { contract: any; address: Uint8Array };

let containerCoins = 0;

/** Deploys `artifact` with `state`; a `balance` funds its satoshi container, which pays the contract's `{value:}`. */
const deploy = async (
  provider: Provider, artifact: Artifact, state: Record<string, unknown>, balance?: bigint,
): Promise<Deployed> => {
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, state);
  const inner = base.withCategory(hexToBin(setup.categoryId));
  const address = hexToBin(inner.lockingBytecode);
  const contract = StatefulContract.withCategory(inner, setup.categoryId);
  registerDeployment(provider, {
    contractName: artifact.contractName, address: contract.target, lockingBytecode: binToHex(address), contract,
  });
  if (balance !== undefined) {
    containerCoins += 1;
    await (provider as MockNetworkProvider).addUtxo(getSatoshiContainerAddress(inner, setup.categoryId), {
      txid: containerCoins.toString(16).padStart(64, 'c'), vout: 0, satoshis: balance,
    });
  }
  return { contract, address };
};

describe('a low-level call whose payload names a function that declares a result', () => {
  it.each(TYPED_FORMS)('publishes the record read: %s', (_, body) => {
    const artifact = compileString(`pragma solidity ^0.8.0; ${INTERFACE}
      contract Forms { IToken public stored; uint256 public n; ${body} }`, EVM_OPTIONS);
    const calls = artifact.abi.find((fn) => fn.name === 'f')!.externalCalls ?? [];
    expect(calls.some((call) => (call as { rawReadsRecord?: boolean }).rawReadsRecord === true)).toBe(true);
  });
});

describe('a typed payload sent with {value: v} to its co-spent callee is refused before building', () => {
  const tokenArtifact = compileString(TOKEN, EVM_OPTIONS);
  const payerArtifact = compileString(VALUE_PAYER, EVM_OPTIONS);
  const VALUE = 2_000n;

  /** The refusal of a raw call's value to its co-spent callee, which names where the value would go. */
  const isValueRefusal = (error: unknown): boolean => error instanceof RawCallCalleeRequiredError
    && error.reason === 'value to a co-spent callee' && /satoshi container/.test(error.message);

  it.each([
    ['payDirect', 'through call{value: v} on a state-variable target'],
    ['payThroughHelper', 'through an inlined functionCallWithValue'],
  ])('%s: refuses the value sent %s', async (entry) => {
    const call = payerArtifact.abi.find((fn) => fn.name === entry)!.externalCalls
      ?.find((candidate) => (candidate as { rawReadsRecord?: boolean }).rawReadsRecord === true);
    expect(call?.callValueEffect).toBe(true);
    const provider = createTestProvider();
    const token = await deploy(provider, tokenArtifact, { moved: 0n });
    const payer = await deploy(provider, payerArtifact, { token: token.address, paid: 0n }, 50_000n);

    const refusal = await payer.contract[entry](5n, VALUE)
      .withExternalCall(token.contract, 'transfer', [payer.address, 5n]).build().then(() => undefined, (e: unknown) => e);
    expect(isValueRefusal(refusal)).toBe(true);
  });

  it('refuses the auto-resolved call the same way, and sends nothing', async () => {
    const provider = createTestProvider();
    const token = await deploy(provider, tokenArtifact, { moved: 0n });
    const payer = await deploy(provider, payerArtifact, { token: token.address, paid: 0n }, 50_000n);

    const refusal = await payer.contract.payDirect(5n, VALUE).send().then(() => undefined, (e: unknown) => e);
    expect(isValueRefusal(refusal)).toBe(true);
    expect((await token.contract.getState()).moved).toBe(0n);
    expect((await payer.contract.getState()).paid).toBe(0n);
  });
});
