/**
 * One line per broadcast when `SOLIDCASH_TX_TRACE=1`.
 *
 * The line is the transaction the caller is about to submit: byte length, input and output
 * counts, the fee (input satoshis minus output satoshis), and the largest unlocking script.
 * Unset, this function returns before it reads the transaction.
 */

export function traceBroadcast(
  inputs: readonly { satoshis: bigint }[],
  outputs: readonly { amount: bigint }[],
  encodedInputs: readonly { unlockingBytecode?: { length: number } }[],
  bytes: number,
): void {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (env?.SOLIDCASH_TX_TRACE !== '1') return;
  const inputSats = inputs.reduce((total, input) => total + input.satoshis, 0n);
  const outputSats = outputs.reduce((total, output) => total + output.amount, 0n);
  let largestUnlock = 0;
  for (const input of encodedInputs) {
    const size = input.unlockingBytecode?.length ?? 0;
    if (size > largestUnlock) largestUnlock = size;
  }
  console.error(JSON.stringify({
    trace: 'tx',
    bytes,
    inputs: encodedInputs.length,
    outputs: outputs.length,
    fee: (inputSats - outputSats).toString(),
    largestUnlock,
  }));
}
