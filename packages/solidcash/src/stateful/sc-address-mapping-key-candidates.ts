/**
 * phase-boundary extract: SC class-body extract — address → mapping-key alias candidates.
 */

import { hexToBin } from '@bitauth/libauth';
import type NetworkProvider from '../network/NetworkProvider.js';
import { addressToLockScript } from '../utils.js';
import {
  findDeploymentByAddressValue,
} from './deployment-registry.js';
import { logicalIdentityAddressVariants } from './logical-identity.js';

export interface AddressMappingKeyCandidatesHost {
  readonly provider: NetworkProvider;
}

/**
 * Expand an address-like value into the set of string/bytes keys a mapping read may need to try
 * (cashaddr variants, locking bytecode, deployment aliases, delegate execution locks).
 */
export function addressMappingKeyCandidates(
  host: AddressMappingKeyCandidatesHost,
  addressValue: unknown,
): Array<string | Uint8Array> {
  const keys: Array<string | Uint8Array> = [];
  const add = (value: unknown): void => {
    if (typeof value === 'string' || value instanceof Uint8Array) {
      if (!keys.some((key) => (typeof key === 'string' && key === value)
        || (key instanceof Uint8Array && value instanceof Uint8Array
          && key.length === value.length && key.every((byte, index) => byte === value[index])))) {
        keys.push(value);
      }
    }
  };
  add(addressValue);
  if (typeof addressValue === 'string') {
    try { add(addressToLockScript(addressValue)); } catch { /* not a cashaddr */ }
    for (const variant of logicalIdentityAddressVariants(addressValue)) {
      add(variant);
      try { add(addressToLockScript(variant)); } catch { /* */ }
    }
    const deployment = findDeploymentByAddressValue(host.provider, addressValue);
    const deployed = deployment?.contract as {
      _logicalAddress?: string;
      address?: string;
    } | undefined;
    if (deployment) {
      add(deployment.address);
      if (deployment.lockingBytecode) add(hexToBin(deployment.lockingBytecode));
      // The Hardhat-compatible proxy facade exposes its stable logical address, while native SolidCash
      // `address(this)` is the exact active delegate input's OP_UTXOBYTECODE. Include that authenticated
      // execution address as a read alias so a facade read using its stable address observes values
      // deliberately held by the delegate executor without changing native call or storage semantics.
      const executionLockingBytecode = (deployment.contract as {
        implementation?: { inner?: { lockingBytecode?: string } };
      }).implementation?.inner?.lockingBytecode;
      if (executionLockingBytecode) add(hexToBin(executionLockingBytecode));
    }
    if (deployed) {
      add(deployed._logicalAddress);
      add(deployed.address);
      try {
        if (deployed.address) add(addressToLockScript(deployed.address));
      } catch { /* */ }
    }
  }
  return keys;
}
