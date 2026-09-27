import { hexToBin } from '@bitauth/libauth';
import { isContractUnlocker } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

/**
 * A composed participant is derived in isolation, but its identity and dynamic-storage input witnesses name
 * the final transaction's inputs. Rebase those witnesses only in the generated probe program. In particular,
 * never change the shared unlocker's parameters: the composer must still publish the absolute coordinate.
 * The original covenant authenticates the same resources in both coordinate spaces.
 */
export function buildParticipantProbeProgram(
  builder: TransactionBuilder, blockBase: number,
): ReturnType<TransactionBuilder['buildLibauthProgram']> {
  const program = builder.buildLibauthProgram();
  if (blockBase === 0) return program;
  for (const [inputIndex, input] of builder.inputs.entries()) {
    const { unlocker } = input;
    if (!isContractUnlocker(unlocker)) continue;
    const params = [...unlocker.params];
    let changed = false;
    for (const [parameterIndex, parameter] of unlocker.abiFunction.inputs.entries()) {
      const dynamic = parameter.name === '__internal__dynamicChunkInputBase';
      if (!dynamic && parameter.name !== '__internal__graphSelfIdentityInput') continue;
      const value = params[parameterIndex];
      if (typeof value !== 'bigint') continue;
      // Dynamic storage can retain its read coordinate while disabling broad writes: -(base + 3).
      // -1/-2 are sentinels, not encoded coordinates; identity witnesses have no negative encoding.
      const inactiveWrite = dynamic && value < -2n;
      if (value < 0n && !inactiveWrite) continue;
      const absoluteIndex = inactiveWrite ? -value - 3n : value;
      const localIndex = absoluteIndex - BigInt(blockBase);
      if (localIndex < 0n || localIndex >= BigInt(program.sourceOutputs.length)) {
        throw new Error(`Participant ${parameter.name} is outside its local probe inputs`);
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
