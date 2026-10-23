import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import {
  asmToScript, chainCategory, hash256, scriptToBytecode, validatorAddress, validatorTemplateHash,
} from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { fillPlaceholders } from '../../../../solidc/src/framed/master/placeholders.js';
import type { FramedTransaction as ModelledTransaction } from '../../../../solidc/src/framed/validator/index.js';
import { seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';
import {
  deployMaster, verifyMasterDeployment, type DeployedMaster,
} from '../../../src/framed/deploy/index.js';
import { PROGRAM, accepted, decisionOf, expectRefusal, laidOut, reference } from './validator-machine.js';
import { abbaPlan } from '../validator/plans.js';
import { materialise } from '../validator/fixture.js';

/**
 * A contract address belongs to exactly one category.
 *
 * `addrV(category)` is the P2SH32 lock of `push(pin(category)) || program`, so the category is hashed into the
 * address and two categories cannot share one. The binding is enforced in two places. On chain the shipped
 * validator program's address rule compares a covered frame's presented `self` with the address derived from that
 * frame's own category, and refuses a frame that presents another category's address. Off chain, and only there,
 * `verifyMasterDeployment` re-derives `addrV(category)` and reads a deployment's reserved slots back: the machine
 * itself has no category-to-address rule, and a slot and a presented address that agree on a foreign address are
 * accepted (see `standalone-address-slot.test.ts`). Each refusal below stands beside the faithful spend or
 * deployment it mutates.
 */

const CATEGORY = seededCategory('address binding');
const FOREIGN_CATEGORY = seededCategory('address binding foreign');
const ADDRESS = validatorAddress(CATEGORY, PROGRAM);
const FOREIGN_ADDRESS = validatorAddress(FOREIGN_CATEGORY, PROGRAM);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Sample {'
  + '   function ping() { require(true); }'
  + ' }';

const artifact = compileString(SOURCE, { composition: 'framed' });
const originalProgram = scriptToBytecode(asmToScript(artifact.bytecode));
const placeholders = artifact.composition!.placeholders;

/** A deployment whose filled bytes and stated address need not agree, so the gate's read-back is what is asked. */
function deployment(script: Uint8Array, address: Uint8Array): DeployedMaster {
  return { script, address, lockingBytecode: encodeLockingBytecodeP2sh32(hash256(script)) };
}

/** The reference composition with its root frame presenting the other contract's own address. */
function crossCategorySpend(): { transaction: ModelledTransaction; index: number } {
  const composition = laidOut(abbaPlan());
  const root = composition.blocks.get('A.f')!;
  const callee = composition.blocks.get('B.g')!;
  // B's address is derived from B's category, which the root's own category does not derive.
  const foreign = callee.self;
  root.self = foreign;
  // A message frame's sender is its caller's presented address; keeping them equal leaves the address rule as the
  // only rule the frame breaks.
  callee.sender = foreign;
  return { transaction: materialise(composition), index: composition.validatorIndex };
}

describe('a contract address is derived from one category', () => {
  it('accepts the reference composition, so the frame refusal below is real bytes being refused', () => {
    const { transaction, index } = reference();
    expect(decisionOf(transaction, index).rejection).toBeUndefined();
    expect(accepted(transaction, index)).toBe(true);
  });

  it('refuses a frame presenting an address its own category does not derive', () => {
    // The frame rule is enforced on chain: the derivation names it and the shipped program refuses the same bytes.
    const { transaction, index } = crossCategorySpend();
    expectRefusal(transaction, index, 'V11_SELF_NOT_CONTRACT_ADDRESS');
  });

  it('accepts the deployment whose category slot holds the category its address derives from', () => {
    const deployed = deployMaster(artifact, CATEGORY, PROGRAM);
    expect([...deployed.address]).toStrictEqual([...ADDRESS]);
    expect(() => verifyMasterDeployment(deployed, artifact, CATEGORY, PROGRAM)).not.toThrow();
  });

  it('refuses a deployment presenting another category\'s address, and accepts it at its own category', () => {
    const foreign = deployMaster(artifact, FOREIGN_CATEGORY, PROGRAM);
    expect([...foreign.address]).toStrictEqual([...FOREIGN_ADDRESS]);
    expect(() => verifyMasterDeployment(foreign, artifact, CATEGORY, PROGRAM))
      .toThrow(/the deployed address is not addrV\(category\)/);
    // The same deployment read against the category it derives its address from is accepted, so the refusal pins the
    // category binding rather than a malformed script.
    expect(() => verifyMasterDeployment(foreign, artifact, FOREIGN_CATEGORY, PROGRAM)).not.toThrow();
  });

  it('refuses a reserved category slot holding a foreign category', () => {
    // This half is enforced only in the deployment gate: the machine has no category-to-address rule, and the master
    // head compares its slot with the presented address but never derives an address from the category.
    const script = fillPlaceholders(originalProgram, placeholders, {
      category: chainCategory(FOREIGN_CATEGORY), contractAddress: ADDRESS, templateHash: validatorTemplateHash(PROGRAM),
    });
    expect(() => verifyMasterDeployment(deployment(script, ADDRESS), artifact, CATEGORY, PROGRAM))
      .toThrow(/the category slot does not read back as the filled category/);
  });

  it('refuses a reserved address slot holding another contract\'s address', () => {
    const script = fillPlaceholders(originalProgram, placeholders, {
      category: chainCategory(CATEGORY), contractAddress: FOREIGN_ADDRESS, templateHash: validatorTemplateHash(PROGRAM),
    });
    expect(() => verifyMasterDeployment(deployment(script, ADDRESS), artifact, CATEGORY, PROGRAM))
      .toThrow(/the address slot does not read back as the filled address/);
  });
});
