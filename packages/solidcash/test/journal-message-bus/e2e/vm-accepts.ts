import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';

/**
 * Evaluate every input of a composed message-bus transaction under BCH-2026.
 *
 * Libauth's VM reports success via `stateSuccess`. An earlier helper spelling
 * (`testSuccess`) does not exist on this VM and, when wrapped in try/catch,
 * falsely pins residuals as red (see KernelDiamondReturnCompose).
 */
export const messageBusVmAccepts = (builder: TransactionBuilder): boolean => {
  try {
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true);
  } catch {
    return false;
  }
};
