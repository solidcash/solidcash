import { describe, it, expect, vi, afterEach } from 'vitest';
import { compileString } from '../direct-compile.js';
import { StatefulContract, resolveDeployReads } from '../../src/index.js';

// A contract whose constructor reads token0()/token1() from a pool - hoisted to deploy inputs
// (__ctorread_*), each carrying a deployReads hint. See docs/deploy-external-reads.md.
const SRC = 'interface IPool { function token0() external view returns (address);'
  + ' function token1() external view returns (address); }'
  + ' interface IERC20 { function tf(address a, uint v) external; }'
  + ' contract C { IPool immutable pool; IERC20 immutable token0; IERC20 immutable token1;'
  + ' constructor(address _p) { pool = IPool(_p); token0 = IERC20(pool.token0()); token1 = IERC20(pool.token1()); }'
  + ' function f() external { token0.tf(msg.sender, 1); token1.tf(msg.sender, 1); } }';

describe('resolveDeployReads (SDK auto-resolution of constructor external reads)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits deployReads hints that map each hoisted input to a target read', () => {
    const artifact = compileString(SRC, { solidityImportCompat: true, enforceFinalRequire: false });
    expect(artifact.stateLayout?.deployReads).toEqual([
      { input: '__ctorread_pool_token0_0', addressInput: '_p', contractType: 'IPool', read: 'token0' },
      { input: '__ctorread_pool_token1_1', addressInput: '_p', contractType: 'IPool', read: 'token1' },
    ]);
  });

  it('reads the target state on-chain and returns the full positional constructor args', async () => {
    const artifact = compileString(SRC, { solidityImportCompat: true, enforceFinalRequire: false });
    // Stub the on-chain read: the pool exposes token0/token1 state variables.
    const atSpy = vi.spyOn(StatefulContract, 'at').mockResolvedValue({
      getState: async () => ({ token0: 'pool-token0-addr', token1: 'pool-token1-addr' }),
    } as unknown as Awaited<ReturnType<typeof StatefulContract.at>>);

    const args = await resolveDeployReads(
      artifact,
      { _p: 'pool-address' },
      { runner: {} as never, artifacts: { IPool: {} as never } },
    );

    // _pool stays as provided; the two hoisted inputs are filled from the pool's state, in ctor-input order.
    expect(args).toEqual(['pool-address', 'pool-token0-addr', 'pool-token1-addr']);
    expect(atSpy).toHaveBeenCalledTimes(2);
    expect(atSpy.mock.calls[0][0]).toBe('pool-address'); // read from the resolved _pool address
  });

  it('errors clearly when the target artifact is not registered', async () => {
    const artifact = compileString(SRC, { solidityImportCompat: true, enforceFinalRequire: false });
    await expect(
      resolveDeployReads(artifact, { _p: 'pool-address' }, { runner: {} as never, artifacts: {} }),
    ).rejects.toThrow(/no artifact registered for target type 'IPool'/);
  });

  it('errors clearly when the address input is missing', async () => {
    const artifact = compileString(SRC, { solidityImportCompat: true, enforceFinalRequire: false });
    await expect(
      resolveDeployReads(artifact, {}, { runner: {} as never, artifacts: { IPool: {} as never } }),
    ).rejects.toThrow(/must be supplied as an address string/);
  });
});
