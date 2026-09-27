import { hexToBin } from '@bitauth/libauth';
import { isContractUnlocker } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';

/**
 * A composed participant is derived in isolation, but its public self-identity witness names the final
 * transaction's immutable anchor. Rebase that witness only in the generated probe program. In particular,
 * never change the shared unlocker's parameters: the composer must still publish the absolute coordinate.
 * The original covenant authenticates the same anchor/category/owner in both coordinate spaces.
 */
export function buildParticipantProbeProgram(
  builder: TransactionBuilder, blockBase: number,
): ReturnType<TransactionBuilder['buildLibauthProgram']> {
  const program = builder.buildLibauthProgram();
  if (blockBase === 0) return program;
  for (const [inputIndex, input] of builder.inputs.entries()) {
    const { unlocker } = input;
    if (!isContractUnlocker(unlocker)) continue;
    const parameterIndex = unlocker.abiFunction.inputs.findIndex(
      (parameter) => parameter.name === '__internal__graphSelfIdentityInput',
    );
    if (parameterIndex < 0) continue;
    const absoluteIndex = unlocker.params[parameterIndex];
    if (typeof absoluteIndex !== 'bigint' || absoluteIndex < 0n) continue;
    const localIndex = absoluteIndex - BigInt(blockBase);
    if (localIndex < 0n || localIndex >= BigInt(program.sourceOutputs.length)) {
      throw new Error('Participant self-identity anchor is outside its local probe inputs');
    }
    const selector = unlocker.abiFunction.selector;
    if (selector === undefined) throw new Error('Participant self-identity route is missing its selector');
    const params = [...unlocker.params];
    params[parameterIndex] = localIndex;
    const localUnlocker = unlocker.contract.createCompilerRouteUnlocker(
      unlocker.abiFunction, hexToBin(selector),
    )(...params);
    program.transaction.inputs[inputIndex].unlockingBytecode = localUnlocker.generateUnlockingBytecode({
      ...program, inputIndex,
    });
  }
  return program;
}
