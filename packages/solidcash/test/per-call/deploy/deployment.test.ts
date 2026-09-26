import { describe, expect, it } from 'vitest';
import { bytesToHex, chainCategory, validatorAddress } from '@solidcash/utils';
import { seededCategory } from '../../../../solidc/test/per-call/master/validator-input.js';
import { PerCallDeploymentError, deployMaster, verifyMasterDeployment } from '../../../src/per-call/deploy/index.js';
import {
  ADDRESS_PAYLOAD,
  CATEGORY_PAYLOAD,
  SLOT_SCRIPT_HEX,
  programBytesOf,
  artifactFixture,
} from './fixture.js';

/**
 * Filling a compiled master's deployment-time constants.
 *
 * A master reserves a zero-filled slot for its state category and one for its address. Deployment fills them from
 * the real category and the address `addrV(category)`, and the fill must touch nothing else: a byte moved out of a
 * slot would change live script and produce a contract that rejects every spend.
 */

const CATEGORY = new Uint8Array(32).fill(0x5a);
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52, 0x53, 0x54]);
const OTHER_PROGRAM = new Uint8Array([0x51, 0x52, 0x53, 0x55]);

/** True when every program byte outside the two slot payloads is the artifact's original byte. */
function unchangedOutsideSlots(filledHex: string): boolean {
  if (filledHex.length !== SLOT_SCRIPT_HEX.length) return false;
  for (let offset = 0; offset < SLOT_SCRIPT_HEX.length; offset += 2) {
    const index = offset / 2;
    const inCategory = index >= CATEGORY_PAYLOAD.start && index < CATEGORY_PAYLOAD.end;
    const inAddress = index >= ADDRESS_PAYLOAD.start && index < ADDRESS_PAYLOAD.end;
    if (inCategory || inAddress) continue;
    if (filledHex.slice(offset, offset + 2) !== SLOT_SCRIPT_HEX.slice(offset, offset + 2)) return false;
  }
  return true;
}

describe('filling deployment-time constants in a master', () => {
  it('writes the category and the derived address into the reserved slots and nothing else', () => {
    const artifact = artifactFixture();
    const address = bytesToHex(validatorAddress(CATEGORY, VALIDATOR_PROGRAM));
    const expected = `51757620${bytesToHex(CATEGORY)}23${address}8751`;

    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);

    expect(bytesToHex(deployed.script)).toBe(expected);
    expect(deployed.script.length).toBe(programBytesOf(artifact).length);
    expect(unchangedOutsideSlots(bytesToHex(deployed.script))).toBe(true);
  });

  it('writes a non-repeating category in the order the chain reports', () => {
    const category = seededCategory('deployment read-back');
    const artifact = artifactFixture();
    const deployed = deployMaster(artifact, category, VALIDATOR_PROGRAM);
    const slot = deployed.script.subarray(CATEGORY_PAYLOAD.start, CATEGORY_PAYLOAD.end);
    const chain = chainCategory(category);

    // A repeated byte would match either order, so this category has to differ from its reverse.
    expect([...category]).not.toStrictEqual([...chain]);
    expect([...slot]).toStrictEqual([...chain]);
    expect(() => verifyMasterDeployment(deployed, artifact, category, VALIDATOR_PROGRAM)).not.toThrow();
  });

  it('derives the contract address with the validator address rule, so the two cannot drift', () => {
    const artifact = artifactFixture();

    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);

    expect([...deployed.address]).toStrictEqual([...validatorAddress(CATEGORY, VALIDATOR_PROGRAM)]);
    // A different validator program is a different contract, so the address must move with it.
    const other = deployMaster(artifact, CATEGORY, OTHER_PROGRAM);
    expect([...other.address]).not.toStrictEqual([...deployed.address]);
  });

  it('derives a master lock that is a P2SH32 lock over the filled program and not the contract address', () => {
    const artifact = artifactFixture();

    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);

    expect(deployed.lockingBytecode.length).toBe(35);
    expect(deployed.lockingBytecode[0]).toBe(0xaa);
    expect(deployed.lockingBytecode[1]).toBe(0x20);
    expect(deployed.lockingBytecode[deployed.lockingBytecode.length - 1]).toBe(0x87);
    expect([...deployed.lockingBytecode]).not.toStrictEqual([...deployed.address]);
  });

  it('refuses an artifact that publishes no placeholder descriptor', () => {
    const bare = artifactFixture({ composition: undefined });

    expect(() => deployMaster(bare, CATEGORY, VALIDATOR_PROGRAM)).toThrow(PerCallDeploymentError);
    expect(() => deployMaster(bare, CATEGORY, VALIDATOR_PROGRAM)).toThrow(/not compiled per-call/);
  });

  it('refuses a category that is not 32 bytes', () => {
    const artifact = artifactFixture();

    expect(() => deployMaster(artifact, new Uint8Array(31).fill(0x5a), VALIDATOR_PROGRAM))
      .toThrow(/a category is 32 bytes/);
  });

  it('refuses a descriptor whose offsets do not point at the reserved pushes', () => {
    const shifted = artifactFixture({
      composition: {
        convention: 'per-call',
        placeholders: { version: 1, categoryOffset: 0, addressOffset: 36 },
      },
    });

    expect(() => deployMaster(shifted, CATEGORY, VALIDATOR_PROGRAM)).toThrow(/not a reserved/);
  });
});

describe('verifying a filled master', () => {
  it('accepts a deployment made from the artifact', () => {
    const artifact = artifactFixture();
    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);

    expect(() => verifyMasterDeployment(deployed, artifact, CATEGORY, VALIDATOR_PROGRAM)).not.toThrow();
  });

  it('rejects an address that is not addrV(category)', () => {
    const artifact = artifactFixture();
    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    const tampered = { ...deployed, address: validatorAddress(CATEGORY, OTHER_PROGRAM) };

    expect(() => verifyMasterDeployment(tampered, artifact, CATEGORY, VALIDATOR_PROGRAM))
      .toThrow(/not addrV\(category\)/);
  });

  it('rejects any byte changed outside the two slots', () => {
    const artifact = artifactFixture();
    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    const script = Uint8Array.from(deployed.script);
    script[0] = script[0]! ^ 0xff;

    expect(() => verifyMasterDeployment({ ...deployed, script }, artifact, CATEGORY, VALIDATOR_PROGRAM))
      .toThrow(/outside the slots changed/);
  });

  it('rejects a category slot that does not read back as the filled category', () => {
    const artifact = artifactFixture();
    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    const script = Uint8Array.from(deployed.script);
    script[CATEGORY_PAYLOAD.start] = 0x00;

    expect(() => verifyMasterDeployment({ ...deployed, script }, artifact, CATEGORY, VALIDATOR_PROGRAM))
      .toThrow(/category slot does not read back/);
  });

  it('rejects a master lock that is not the P2SH32 of the filled program', () => {
    const artifact = artifactFixture();
    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    const tampered = { ...deployed, lockingBytecode: deployed.address };

    expect(() => verifyMasterDeployment(tampered, artifact, CATEGORY, VALIDATOR_PROGRAM))
      .toThrow(/master lock is not/);
  });
});
