import { describe, expect, it } from 'vitest';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { buildValidatorProgram } from '../../../../solidc/src/framed/validator/index.js';
import { COMPOSITION_LIMITS } from '../../../../solidc/test/framed/machine.js';
import { Signer } from '../../../src/index.js';
import { getContractFactory } from '../../../src/stateful/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { addressToLockScript } from '../../../src/utils.js';
import type { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import {
  findDeploymentByAddress, findDeploymentByLockingBytecode,
} from '../../../src/stateful/deployment-registry.js';

/**
 * The address a deployed framed contract reports.
 *
 * A framed contract is entered at `addrV(category)` - the validator pins both its callee frames and the recorded
 * call targets to that address - so a handle must report it, not a Solidity-facing logical address. The cases below
 * deploy through the shipped factory entry point (which is what assigns the logical CREATE address the handle would
 * otherwise present) and read the reported address back as the lock script, as the provider's registry, and as the
 * lock the genesis funded.
 */

const VALIDATOR_PROGRAM = buildValidatorProgram();
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Child {'
  + '   int public total;'
  + '   constructor(int seed) { this.total = seed + 1; }'
  + '   function check(int v) { require(this.total == v); }'
  + ' }';
const artifact = compileString(SOURCE, { composition: 'framed' });

/** A signer over the relaxed mock, funded with fresh vout-0 token-free UTXOs (each its own txid). */
async function fundedSigner(
  count: number, fill: number,
): Promise<{ signer: Signer; provider: MockNetworkProvider }> {
  const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
  const signer = new Signer(new Uint8Array(32).fill(fill), provider);
  for (let index = 0; index < count; index += 1) {
    await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 5_000_000n,
    });
  }
  return { signer, provider };
}

describe('the address a framed deployment reports', () => {
  it('reports addrV(category), and the registry and the genesis agree', async () => {
    const { signer, provider } = await fundedSigner(2, 0xc1);
    const handle = await getContractFactory(artifact, signer).deploy(5n) as unknown as StatefulContract;

    const category = new Uint8Array(hexToBin(handle.categoryId));
    const addrV = validatorAddress(category, VALIDATOR_PROGRAM);

    // Both surfaces present the contract's own address, compared as lock scripts rather than address strings.
    expect([...addressToLockScript(handle.target)]).toStrictEqual([...addrV]);
    expect([...addressToLockScript(await handle.getAddress())]).toStrictEqual([...addrV]);

    // A caller resolving the reported address lands on this deployment, by address and by locking bytecode.
    expect(findDeploymentByAddress(provider, handle.target)).toBeDefined();
    expect(findDeploymentByAddress(provider, await handle.getAddress())).toBeDefined();
    expect(findDeploymentByLockingBytecode(provider, binToHex(addrV))).toBeDefined();

    // The address is real: the genesis funded UTXOs there, so it is the deployment's own address, not a stand-in.
    const atAddrV = await provider.getUtxosForLockingBytecode(addrV);
    expect(atAddrV.length).toBeGreaterThan(0);
  });
});
