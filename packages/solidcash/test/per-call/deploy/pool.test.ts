import { describe, expect, it } from 'vitest';
import { TokenCapability, hexToBytes, validatorAddress } from '@solidcash/utils';
import { MasterPoolDeployment } from '../../../src/per-call/deploy/index.js';
import { artifactFixture } from './fixture.js';

/**
 * The deployment pools of a per-call contract.
 *
 * Deployment funds a pool of master UTXOs at the master lock and a pool of validator UTXOs at the contract's
 * address, and the address it presents is `addrV(category)`. This drives the shipped geometry; creating the
 * category and broadcasting the genesis transaction is outside the module.
 */

const CATEGORY = new Uint8Array(32).fill(0x5a);
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52, 0x53, 0x54]);
const SIZE = { masters: 12, validators: 2 } as const;

describe('deployment pools', () => {
  it('returns addrV(category) as the contract address', () => {
    const deployment = MasterPoolDeployment.create({
      artifact: artifactFixture(),
      category: CATEGORY,
      validatorProgram: VALIDATOR_PROGRAM,
      size: SIZE,
    });

    expect([...deployment.getAddress()]).toStrictEqual([...validatorAddress(CATEGORY, VALIDATOR_PROGRAM)]);
  });

  it('returns the filled program as the master lock preimage, and not as the address', () => {
    const artifact = artifactFixture();
    const deployment = MasterPoolDeployment.create({
      artifact,
      category: CATEGORY,
      validatorProgram: VALIDATOR_PROGRAM,
      size: SIZE,
    });

    expect(deployment.getMasterProgram().length).toBe(hexToBytes(artifact.bytecode).length);
    expect(deployment.getMasterLockingBytecode().length).toBe(35);
    expect([...deployment.getMasterLockingBytecode()]).not.toStrictEqual([...deployment.getAddress()]);
  });

  it('reports the pool sizes it was created with', () => {
    const deployment = MasterPoolDeployment.create({
      artifact: artifactFixture(),
      category: CATEGORY,
      validatorProgram: VALIDATOR_PROGRAM,
      size: SIZE,
    });

    expect(deployment.getMasterCount()).toBe(SIZE.masters);
    expect(deployment.getValidatorCount()).toBe(SIZE.validators);
  });

  it('describes the two pools a genesis funds: masters at the master lock, validators at the address', () => {
    const deployment = MasterPoolDeployment.create({
      artifact: artifactFixture(),
      category: CATEGORY,
      validatorProgram: VALIDATOR_PROGRAM,
      size: SIZE,
    });

    const [masters, validators] = deployment.getGenesisPools();
    expect(masters.lockingBytecode).toStrictEqual(deployment.getMasterLockingBytecode());
    expect(masters.count).toBe(SIZE.masters);
    expect(masters.capability).toBe(TokenCapability.MINTING);
    expect([...masters.category]).toStrictEqual([...CATEGORY]);
    expect(masters.commitment.length).toBe(0);

    expect(validators.lockingBytecode).toStrictEqual(deployment.getAddress());
    expect(validators.count).toBe(SIZE.validators);
    expect(validators.capability).toBe(TokenCapability.MUTABLE);
    expect([...validators.category]).toStrictEqual([...CATEGORY]);
    expect(validators.commitment.length).toBe(0);
  });

  it('refuses a pool that holds no UTXO', () => {
    const base = {
      artifact: artifactFixture(),
      category: CATEGORY,
      validatorProgram: VALIDATOR_PROGRAM,
    };

    expect(() => MasterPoolDeployment.create({ ...base, size: { masters: 0, validators: 2 } }))
      .toThrow(/at least one/);
    expect(() => MasterPoolDeployment.create({ ...base, size: { masters: 1, validators: -1 } }))
      .toThrow(/at least one/);
  });
});
