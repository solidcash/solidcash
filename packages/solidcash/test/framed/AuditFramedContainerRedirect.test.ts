import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { buildTokenContainerCovenantScript, scriptToBytecode } from '@solidcash/utils';
import { compileStringMulti } from '../../../solidc/src/compiler.js';
import { framedValidator } from '@solidcash/solidc';
import { callFramedEntry, sendFramedValue } from '../../src/framed/call/index.js';
import { TransactionBuilder } from '../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import {
  deployMaster, readSatoshiContainers, satoshiContainerUnlockingBytecode,
} from '../../src/framed/deploy/index.js';
import { createUnlockingBytecode, scriptToLockingBytecode } from '../../src/utils.js';
import { encodeFunctionArgument } from '../../src/index.js';
import { expectScriptRejection } from '../test-util.js';
import { callerOf, currentCaller, deploy } from './call/value-harness.js';

/**
 * FRAMED-CONT-1 (docs/security/security-audit-2026-10-16.md): a standalone framed spend (no validator input) that handles
 * no value used to leave its containers unprotected. The container covenants are built without a master lock for
 * the framed convention, and the master's container accounting only looked at the satoshi lock.
 *
 * These cases drive the shipped framed call harness: the honest no-value call is captured, then the same
 * transaction is rebuilt with the container co-spent and its value/tokens redirected. The forged spend must be
 * refused and the captured honest spend must settle.
 */
const SOURCE = `pragma solidcash ^0.14.0;
contract Vault {
  int public count;
  function touch(int by) { this.count = this.count + by; require(true); }
  receive() external payable { require(true); }
}`;

const vault = compileStringMulti(SOURCE, { composition: 'framed' }).Vault!;

/** Capture the shipped no-value call's broadcast bytes, then rewind the chain to before it. */
async function captureNoValueCall(deployed: Awaited<ReturnType<typeof deploy>>): Promise<{
  hex: string; masterIndex: number; masterUnlocking: Uint8Array;
}> {
  const snapshot = await deployed.provider.takeSnapshot();
  const result = await callFramedEntry({
    ...(await currentCaller(deployed)),
    functionName: 'touch',
    args: [1n],
  });
  expect(result.accepted).toBe(true);
  expect(result.broadcast).toBeDefined();
  const masterIndex = result.draft.layout.participants[0]!.index;
  const hex = result.broadcast!.hex;
  const masterUnlocking = decodeTransactionUnsafe(hexToBin(hex)).inputs[masterIndex]!.unlockingBytecode.slice();
  await snapshot.restore();
  return { hex, masterIndex, masterUnlocking };
}

describe('FRAMED-CONT-1: a standalone framed spend keeps its containers', () => {
  it('refuses a satoshi container redirect and settles the same call without the container', async () => {
    const deployed = await deploy(vault);
    // A value send creates the contract's satoshi container through the shipped path.
    await sendFramedValue({ ...callerOf(deployed), value: 3_000n });
    const { hex, masterIndex } = await captureNoValueCall(deployed);
    const container = (await readSatoshiContainers(deployed.provider, deployed.categoryId))[0]!;

    const forged = decodeTransactionUnsafe(hexToBin(hex)) as ReturnType<typeof decodeTransactionUnsafe>;
    forged.inputs.push({
      outpointTransactionHash: hexToBin(container.txid),
      outpointIndex: container.vout,
      sequenceNumber: 0xffffffff,
      unlockingBytecode: satoshiContainerUnlockingBytecode(deployed.categoryId, masterIndex),
    });
    // The appended container input adds a covenant redeem script to the unlocking size; take the relay fee from
    // the caller's change (the last output of the captured call).
    const change = forged.outputs[forged.outputs.length - 1]!;
    change.valueSatoshis -= 10_000n;
    forged.outputs.push({ lockingBytecode: deployed.callerLock, valueSatoshis: container.satoshis });

    const outcome = await deployed.provider.sendRawTransaction(binToHex(encodeTransaction(forged)))
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).not.toBe('ACCEPTED');
    expectScriptRejection(outcome, masterIndex);

    // The captured call without the container settles.
    await expect(deployed.provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
  }, 300_000);

  it('refuses a foreign token container redirect and keeps the preserved container', async () => {
    const deployed = await deploy(vault);
    const heldCategory = 'ab'.repeat(31) + '54';
    const covenant = buildTokenContainerCovenantScript(
      hexToBin(deployed.categoryId), hexToBin(heldCategory),
    );
    const tokenLock = scriptToLockingBytecode(covenant, 'p2sh32');
    const container = {
      txid: 'ad'.repeat(32), vout: 0, satoshis: 5_000n,
      token: {
        category: heldCategory, amount: 0n,
        nft: { capability: 'mutable' as const, commitment: 'aa'.repeat(8) },
      },
    };
    await deployed.provider.addUtxo(binToHex(tokenLock), container);
    const masterLock = deployMaster(
      vault, hexToBin(deployed.categoryId), framedValidator.buildValidatorProgram(),
    ).lockingBytecode;
    const master = (await deployed.provider.getUtxosForLockingBytecode(masterLock))
      .find((utxo) => utxo.token?.nft?.capability === 'minting')!;
    expect(master).toBeDefined();
    // The framed authority scan reads the authority input's unlocking for the master's >128-byte redeem, so take
    // the real derived master unlock from the same contract's shipped call.
    const { masterUnlocking } = await captureNoValueCall(deployed);

    // The container input is index 0; its authorizing master is the input at index 1. The VM evaluates only input 0,
    // so the master's own script never runs, but its unlocking bytes are inspected.
    const rawUnlocker = (lockingBytecode: Uint8Array, unlockingBytecode: Uint8Array): never => ({
      generateLockingBytecode: (): Uint8Array => lockingBytecode,
      generateUnlockingBytecode: (): Uint8Array => unlockingBytecode,
    }) as never;
    // The container's authority argument names the real master input (index 1); its own unlocking is the captured
    // framed master unlock, which is what the framed authority scan inspects.
    const unlocking = createUnlockingBytecode('p2sh32', scriptToBytecode(covenant), [
      encodeFunctionArgument(1n, 'bigint'), encodeFunctionArgument(1n, 'bigint'),
    ]);
    const tokenOutput = (lockingBytecode: Uint8Array): any => ({
      to: lockingBytecode, amount: container.satoshis,
      token: {
        category: heldCategory, amount: 0n,
        nft: { capability: 'mutable', commitment: 'aa'.repeat(8) },
      },
    });
    const evaluate = (lockingBytecode: Uint8Array): unknown => {
      const builder = new TransactionBuilder({ provider: deployed.provider, allowImplicitNftBurn: true });
      builder.addInput({ ...container, unlocker: rawUnlocker(tokenLock, unlocking) });
      builder.addInput({ ...master, unlocker: rawUnlocker(masterLock, masterUnlocking) });
      builder.addOutput(tokenOutput(lockingBytecode));
      builder.addOutput({ to: Uint8Array.from([0x6a]), amount: 0n });
      const program = builder.buildLibauthProgram();
      const vm = createVirtualMachineBch2026ForProvider(deployed.provider);
      return vm.stateSuccess(vm.evaluate({ inputIndex: 0, ...program }));

    };

    // The tokens moved to the caller's lock fail the container's own keep.
    const redirected = evaluate(deployed.callerLock);
    expect(redirected).not.toBe(true);
    // The unchanged container recreated at the same index is accepted.
    expect(evaluate(tokenLock)).toBe(true);
  }, 300_000);
});
