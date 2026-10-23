import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { simulationProvider } from '../../../src/framed/call/handle.js';
import { registeredExternalFor } from '../../../src/framed/proxy/external-calls.js';
import {
  findDeploymentByCategory, findDeploymentByName, findDeploymentByLockingBytecode, registerDeployment,
} from '../../../src/stateful/deployment-registry.js';

/**
 * A deployment registered on a provider is found through the wrapper a caller with no coin composes over.
 *
 * The call path composes an unfunded caller over a wrapper of the provider (a stand-in coin) and resolves the
 * deployments it reaches there. A registry keyed by the provider object answers that wrapper with an empty list, so
 * every address and interface lookup misses and the call is refused as an unknown target; the registrations have to
 * be visible to whatever view of the provider a lookup is made through.
 */

const PING_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ping {'
  + '   int public seen;'
  + '   function ping(int n) { require(n >= this.seen); }'
  + ' }';

const ping = compileStringMulti(PING_SOURCE, { composition: 'framed' }).Ping!;
const CATEGORY = '5c'.repeat(31) + 'a3';
const LOCK = 'aa20' + '31'.repeat(32) + '87';

describe('a registration made on a provider', () => {
  it('resolves through the wrapper the shipped call path composes an unfunded caller over', () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    registerDeployment(provider, {
      contractName: 'Ping', address: LOCK, lockingBytecode: LOCK, contract: { artifact: ping, categoryId: CATEGORY },
    });

    const wrapped = simulationProvider(provider);
    expect(findDeploymentByLockingBytecode(wrapped, LOCK)?.contractName).toBe('Ping');
    expect(findDeploymentByName(wrapped, 'Ping')?.address).toBe(LOCK);
    expect(findDeploymentByCategory(wrapped, CATEGORY)?.contractName).toBe('Ping');
    // The resolution the hop takes for a call: the target the caller holds, under an interface name no
    // registration carries, so the match is the address the wrapper had to see.
    expect(registeredExternalFor(wrapped, hexToBin(LOCK), 'IUnregistered')?.artifact.contractName).toBe('Ping');
  });
});
