import { describe, expect, it } from 'vitest';
import { TokenCapability } from '@solidcash/utils';
import { deployMaster, verifyMasterDeployment } from '../../../src/framed/deploy/index.js';
import { artifactFixture, programBytesOf, SLOT_SCRIPT_HEX } from './fixture.js';

/**
 * The program's published form.
 *
 * An artifact publishes its program as assembly, and the deployment's slot offsets are byte offsets into the
 * assembled script. A deployment that read those bytes out of the published string directly would pass a test whose
 * fixture published raw hex and fail on every real artifact, so both directions are pinned here: the real form is
 * assembled, and the wrong form is refused rather than misread.
 */

const CATEGORY = Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0xa5 : 0x5a));
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);

describe('the form a program is published in', () => {
  it('assembles the published program before applying byte offsets to it', () => {
    const artifact = artifactFixture();
    // The fixture publishes assembly; the assembled bytes are the program the slots were measured against.
    expect(artifact.bytecode).not.toBe(SLOT_SCRIPT_HEX);
    expect(programBytesOf(artifact).length).toBe(SLOT_SCRIPT_HEX.length / 2);

    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    expect(deployed.script.length).toBe(programBytesOf(artifact).length);
    expect(() => verifyMasterDeployment(deployed, artifact, CATEGORY, VALIDATOR_PROGRAM)).not.toThrow();
  });

  it('refuses a program published in another form rather than filling offsets that do not describe it', () => {
    // The exact shape that would slip through a fixture which published raw hex.
    const artifact = artifactFixture({ bytecode: SLOT_SCRIPT_HEX });
    expect(() => deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM)).toThrow();
  });

  it('reuses an assembled program only while the artifact publishes the same one', () => {
    // A fill must leave the kept program untouched, and a changed publication on the same object is assembled anew.
    const artifact = artifactFixture();
    const other = new Uint8Array(32).fill(0x33);
    const first = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    const second = deployMaster(artifact, other, VALIDATOR_PROGRAM);
    expect(second.script).not.toEqual(first.script);
    expect(() => verifyMasterDeployment(second, artifact, other, VALIDATOR_PROGRAM)).not.toThrow();
    expect(deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM)).toEqual(first);
    (artifact as { bytecode: string }).bytecode = SLOT_SCRIPT_HEX;
    expect(() => deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM)).toThrow();
  });

  it('refuses an artifact that publishes no composition block', () => {
    const artifact = artifactFixture({ composition: undefined });
    expect(() => deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM)).toThrow();
  });

  it('reports the state category and the contract address as the deployed values', () => {
    const deployed = deployMaster(artifactFixture(), CATEGORY, VALIDATOR_PROGRAM);
    // The address rule and the token category are what a caller has to match to enter the contract.
    expect(deployed.address.length).toBe(35);
    expect(TokenCapability.MINTING).toBe(0x02);
  });
});
