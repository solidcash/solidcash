/**
 * The template table a CREATE2 over a code value is resolved through.
 *
 * A factory may create its children from code it holds rather than from a contract it names (a test factory given a
 * pair's EVM bytecode fixture): the identity commits to that code's hash, and the BCH contract the child's frames run
 * is the one this table names for the hash. Creation itself happens in the creator's transaction
 * (docs/framed/CREATE2_IDENTITY.md); nothing is stood up out of band.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type NetworkProvider from '../../network/NetworkProvider.js';

const TEMPLATES = Symbol.for('@solidcash/framed-create2-templates');

/** The CREATE2 templates registered on `provider`: the contract each code hash stands up, by hex hash. */
function templatesOf(provider: NetworkProvider): Map<string, string> {
  const holder = provider as unknown as Record<symbol, Map<string, string> | undefined>;
  if (holder[TEMPLATES] === undefined) {
    Object.defineProperty(provider, TEMPLATES, {
      value: new Map<string, string>(), writable: false, enumerable: false, configurable: true,
    });
  }
  return holder[TEMPLATES]!;
}

/**
 * Names the contract a CREATE2 over a code value stands up, by the value's keccak256.
 *
 * An EVM factory may create its children from code it holds rather than from a contract it names (a test factory
 * given a pair's EVM bytecode): the child's identity commits to that code's hash, and the code itself is no program
 * a BCH master runs, so the contract its frames run is the one this table names for the hash.
 */
export function registerFramedCreate2Template(
  provider: NetworkProvider, codeHash: Uint8Array, contractName: string,
): void {
  templatesOf(provider).set(binToHex(codeHash), contractName);
}

/** The contract a CREATE2 over code with this keccak256 stands up on `provider`, if one is registered. */
export function framedCreate2TemplateOf(provider: NetworkProvider, codeHash: Uint8Array): string | undefined {
  return templatesOf(provider).get(binToHex(codeHash));
}
