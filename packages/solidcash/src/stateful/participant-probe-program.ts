import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { bytesEqual } from '@solidcash/utils';
import { isContractUnlocker } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

/**
 * A composed participant is derived in isolation, but its identity and dynamic-storage input witnesses name
 * the final transaction's inputs. Rebase those witnesses only in the generated probe program. In particular,
 * never change the shared unlocker's parameters: the composer must still publish the absolute coordinate.
 * The original covenant authenticates the same resources in both coordinate spaces.
 */
export function buildParticipantProbeProgram(
  builder: TransactionBuilder, blockBase: number, outputBase?: number,
): ReturnType<TransactionBuilder['buildLibauthProgram']> {
  const program = builder.buildLibauthProgram();
  if (blockBase === 0 && (outputBase === undefined || outputBase === 0)) return program;
  for (const [inputIndex, input] of builder.inputs.entries()) {
    const { unlocker } = input;
    if (!isContractUnlocker(unlocker)) continue;
    const params = [...unlocker.params];
    let changed = false;
    for (const [parameterIndex, parameter] of unlocker.abiFunction.inputs.entries()) {
      if (parameter.name === '__internal__blockOracleInputIndex') {
        // A composed index names the one oracle input of the aggregate, possibly in another participant's
        // block. The probe reads the copy this participant's own block carries.
        const lock = unlocker.contract.blockOracleLock;
        const local = lock === undefined ? -1
          : program.sourceOutputs.findIndex((output) => bytesEqual(output.lockingBytecode, lock));
        if (local >= 0 && params[parameterIndex] !== BigInt(local)) {
          params[parameterIndex] = BigInt(local);
          changed = true;
        }
        continue;
      }
      const dynamic = parameter.name === '__internal__dynamicChunkInputBase';
      const dynamicOutput = parameter.name === '__internal__dynamicChunkOutputBase';
      if (!dynamic && !dynamicOutput && parameter.name !== '__internal__graphSelfIdentityInput') continue;
      const value = params[parameterIndex];
      if (typeof value !== 'bigint') continue;
      // Dynamic storage can retain its read coordinate while disabling broad writes: -(base + 3).
      // -1/-2 are sentinels, not encoded coordinates; identity witnesses have no negative encoding.
      const inactiveWrite = dynamic && value < -2n;
      if (value < 0n && !inactiveWrite) continue;
      const absoluteIndex = inactiveWrite ? -value - 3n : value;
      const coordinateBase = dynamicOutput ? outputBase ?? (blockBase === 0 ? 0 : undefined) : blockBase;
      if (coordinateBase === undefined) {
        throw new Error(`Participant ${parameter.name} requires an explicit output base for its local probe`);
      }
      const localIndex = absoluteIndex - BigInt(coordinateBase);
      const limit = dynamicOutput ? program.transaction.outputs.length : program.sourceOutputs.length;
      if (localIndex < 0n || localIndex >= BigInt(limit)) {
        throw new Error(`Participant ${parameter.name} is outside its local probe ${dynamicOutput ? 'outputs' : 'inputs'}`);
      }
      params[parameterIndex] = inactiveWrite ? -(localIndex + 3n) : localIndex;
      changed = true;
    }
    if (!changed) continue;
    const selector = unlocker.abiFunction.selector;
    if (selector === undefined) throw new Error('Participant probe route is missing its selector');
    const localUnlocker = unlocker.contract.createCompilerRouteUnlocker(
      unlocker.abiFunction, hexToBin(selector),
    )(...params);
    program.transaction.inputs[inputIndex].unlockingBytecode = localUnlocker.generateUnlockingBytecode({
      ...program, inputIndex,
    });
  }
  return program;
}
