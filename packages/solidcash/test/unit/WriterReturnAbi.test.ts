import { describe, expect, it } from 'vitest';
import { selectWriterReturnAbi } from '../../src/stateful/stb-inblock-writer-returns.js';

/**
 * The in-block return slot of a shared participant is published by the WRITER alias (`approve`/`transferFrom`:
 * `writesState: true`, `outputs: [bool]`), never by the participant's physical owner (`balanceOf` is a `uint256`
 * view). Resolving the owner's entry made `canonicalWriterReturnCommitment` publish the empty bool `00` for a
 * successful writer, and `SafeERC20.forceApprove` refused with `SafeERC20FailedOperation` (MarketplaceV1:98).
 */
const APPROVE = { name: 'approve', writesState: true, outputs: [{ type: 'bool' }], resultEncoding: 'evm-abi-v1' };
const TRANSFER_FROM = { name: 'transferFrom', writesState: true, outputs: [{ type: 'bool' }] };
const BALANCE_OF = { name: 'balanceOf', writesState: false, outputs: [{ type: 'uint256' }] };

const withAbi = (functions: readonly unknown[]) => ({ inner: { artifact: { abi: functions } } });

describe('in-block writer return ABI', () => {
  it('reads the writer alias entry, not the shared physical owner entry', () => {
    const owner = { functionName: 'balanceOf', logicalFunctionName: 'balanceOf', externalContract: withAbi([BALANCE_OF]) };
    const writer = {
      functionName: 'approve', logicalFunctionName: 'approve', sharedGroupIndex: 0,
      externalContract: withAbi([BALANCE_OF, APPROVE]),
    };
    expect(selectWriterReturnAbi(writer, owner)?.name).toBe('approve');
    expect(selectWriterReturnAbi(writer, owner)?.writesState).toBe(true);
  });

  it('distinguishes sibling writer aliases on one shared participant', () => {
    const owner = { functionName: 'balanceOf', externalContract: withAbi([BALANCE_OF]) };
    const approve = { functionName: 'approve', sharedGroupIndex: 0, externalContract: withAbi([BALANCE_OF, APPROVE]) };
    const transferFrom = {
      functionName: 'transferFrom', sharedGroupIndex: 0,
      externalContract: withAbi([BALANCE_OF, TRANSFER_FROM]),
    };
    expect(selectWriterReturnAbi(approve, owner)?.name).toBe('approve');
    expect(selectWriterReturnAbi(transferFrom, owner)?.name).toBe('transferFrom');
  });

  it('prefers the compiler route entry and falls back to the owner only when the alias has none', () => {
    const route = { name: 'routeApprove', writesState: true, outputs: [{ type: 'bool' }] };
    const owner = { functionName: 'balanceOf', externalContract: withAbi([BALANCE_OF]) };
    expect(selectWriterReturnAbi(
      { functionName: 'approve', compilerRoute: { abiFunction: route }, externalContract: withAbi([APPROVE]) },
      owner,
    )?.name).toBe('routeApprove');
    expect(selectWriterReturnAbi(
      { functionName: 'unknownAlias', externalContract: withAbi([BALANCE_OF]) }, owner,
    )?.name).toBe('balanceOf');
  });
});
