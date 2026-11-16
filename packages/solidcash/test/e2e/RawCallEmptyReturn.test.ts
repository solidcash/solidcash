import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, RawCallCalleeRequiredError } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { registerDeployment } from '../../src/stateful/index.js';
import { binToHex, hexToBin } from '@bitauth/libauth';

// A raw low-level call carries the callee's returndata in a call-record carrier. A callee that declares no outputs
// returns nothing, so the carrier must encode an EMPTY inline field rather than the legacy `0101` sentinel (which
// the caller would read as two bytes of data and ABI-decode as a 32-byte word). The false case pins the other
// half: a canonical all-zero boolean is an authenticated `false`, not the zero seed that state-writing calls
// replace with success. A call whose payload has bytes runs on its co-spent target, so EVM's `(false, "")` for a
// target that cannot run it has no spend: the SDK refuses such a call by name before building it.

const VOID_CALLEE = `pragma solidcash >=0.8.0;
contract VoidCallee {
  bigint stored;
  function set(uint v) external { this.stored = v; }
}`;

const RAW_CALLER = `pragma solidcash >=0.8.0;
contract RawCaller {
  bool ok;
  function callVoid(address target, bigint v) external {
    (bool success, bytes data) = target.call(abi.encodeWithSelector(0x60fe47b1, v));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'RAW_CALL_FAILED');
    this.ok = true;
  }
}`;

const FALSE_CALLEE = `pragma solidcash >=0.8.0;
contract FalseCallee {
  bigint touched;
  function transfer(address, uint) external returns (bool) {
    this.touched = 1;
    return false;
  }
}`;

const BOOL_CALLER = `pragma solidcash >=0.8.0;
contract BoolCaller {
  bool ok;
  function callBool(address target) external {
    (bool success, bytes data) = target.call(abi.encodeWithSelector(0xa9059cbb, address(this), 1));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'BOOL_CALL_FAILED');
    this.ok = true;
  }
}`;

const MISSING_SELECTOR_CALLER = `pragma solidcash >=0.8.0;
contract MissingSelectorCaller {
  bool ok;
  function callMissing(address target) external {
    (bool success, bytes data) = target.call(abi.encodeWithSelector(0xdeadbeef, target));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'MISSING_FAILED');
    this.ok = true;
  }
}`;

const REVERTING_CALLEE = `pragma solidcash >=0.8.0;
contract RevertingCallee {
  bigint touched;
  function transfer(address, uint) external returns (bool) {
    require(false, 'CALLEE_REVERTED');
    this.touched = 1;
    return true;
  }
}`;

const EVM_OPTIONS = { evmCompat: true, forceStateful: true } as const;

const deploy = async (
  provider: ReturnType<typeof createTestProvider>, source: string,
): Promise<{ contract: StatefulContract; address: Uint8Array }> => {
  const artifact = compileString(source, EVM_OPTIONS);
  const base = new Contract(artifact, [], { provider });
  const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {});
  const address = hexToBin(base.withCategory(hexToBin(setup.categoryId)).lockingBytecode);
  const contract = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
  // The caller resolves a raw target through the deployment registry, the same lookup a Hardhat factory fills.
  registerDeployment(provider, {
    contractName: artifact.contractName,
    address: contract.target,
    lockingBytecode: binToHex(address),
    contract,
  });
  return { contract, address };
};

describe('raw call returndata carriers', () => {
  it('reads an empty carrier as empty bytes for a void callee', async () => {
    const provider = createTestProvider();
    const callee = await deploy(provider, VOID_CALLEE);
    const caller = await deploy(provider, RAW_CALLER);

    await caller.contract.callVoid(callee.address, 7n)
      .withExternalCall(callee.contract, 'set', [7n])
      .send();

    expect((await callee.contract.getState()).stored).toBe(7n);
    expect((await caller.contract.getState()).ok).toBe(true);
  });

  it('keeps an authenticated false bool instead of the success default', async () => {
    const provider = createTestProvider();
    const callee = await deploy(provider, FALSE_CALLEE);
    const caller = await deploy(provider, BOOL_CALLER);

    await expect(caller.contract.callBool(callee.address)
      .withExternalCall(callee.contract, 'transfer', [caller.address, 1n])
      .send()).rejects.toThrow(/BOOL_CALL_FAILED/);
  });

  it('refuses a call whose target has no function for its payload', async () => {
    const provider = createTestProvider();
    const callee = await deploy(provider, VOID_CALLEE);
    const caller = await deploy(provider, MISSING_SELECTOR_CALLER);

    // No `withExternalCall`: the planner pins the deployment and finds no function for the payload's selector. The
    // caller's covenant requires the target co-spent and running the call, so nothing can answer it.
    const sent = caller.contract.callMissing(callee.address).send();
    await expect(sent).rejects.toThrow(RawCallCalleeRequiredError);
    await expect(sent).rejects.toThrow(/no function for the payload/);
  });

  it('refuses a call whose co-spent callee would revert', async () => {
    const provider = createTestProvider();
    const callee = await deploy(provider, REVERTING_CALLEE);
    const caller = await deploy(provider, BOOL_CALLER);

    // The planner proves the invocation on the callee's own covenant first. The call must run there, and it fails,
    // so the SDK names that failure rather than plan a spend that cannot pass.
    const sent = caller.contract.callBool(callee.address).send();
    await expect(sent).rejects.toThrow(RawCallCalleeRequiredError);
    await expect(sent).rejects.toThrow(/the target fails the call/);
  });
});
