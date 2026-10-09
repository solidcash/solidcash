/**
 * ABI-valid default witness for an inactive position in a bounded message-bus route.
 *
 * Extracted from `message-bus.ts` so the stateful class can re-export it without loading the full message-bus
 * graph (VM, graph planner, etc.).
 */

import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { parseArrayTypeString } from '@solidcash/utils';
import { type ConstructorArgument, type FunctionArgument } from '../Argument.js';

export function inactiveMessageBusRouteWitness(type: string): FunctionArgument {
  const array = parseArrayTypeString(type);
  if (array) {
    if (array.bound === undefined) return [];
    return Array.from(
      { length: array.bound },
      () => inactiveMessageBusRouteWitness(array.elementType) as ConstructorArgument,
    );
  }
  if (type === 'bool') return false;
  if (type === 'string') return '';
  if (type === 'address' || type === 'address payable') {
    return encodeLockingBytecodeP2pkh(new Uint8Array(20));
  }
  if (type === 'byte') return new Uint8Array(1);
  const fixedBytes = type.match(/^bytes(\d+)$/);
  if (fixedBytes) return new Uint8Array(Number(fixedBytes[1]));
  if (type === 'bytes' || type === 'sig' || type === 'datasig') return new Uint8Array();
  if (type === 'pubkey') return new Uint8Array(33);
  return 0n;
}
