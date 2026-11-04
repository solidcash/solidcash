import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { applyOraclePool, findOraclePoolSlots } from '@solidcash/utils';

/**
 * Whether a published body is the one the VM ran. A framed reader's body carries pool slots, which its deployment
 * fills with its pool's binding, so the binding the run carried is written over them first.
 */
export function matchesExecutedBody(programHex: string, executedHex: string): boolean {
  const program = hexToBin(programHex);
  const executed = executedHex.toLowerCase();
  if (program.length * 2 !== executed.length) return false;
  const slots = findOraclePoolSlots(program);
  if (slots.length === 0) return programHex.toLowerCase() === executed;
  const at = slots[0]! + 1;
  const binding = hexToBin(executed.slice(at * 2, (at + 32) * 2));
  return binToHex(applyOraclePool(program, binding.reverse(), slots)) === executed;
}
