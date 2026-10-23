import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { compileString } from '../../../../solidc/src/compiler.js';
import { compileFileMulti } from '../../../../solidc/src/compileFile.js';
import { buildValidatorProgram } from '../../../../solidc/src/framed/validator/index.js';
import { compositionMachine, compositionProvider } from '../../../../solidc/test/framed/machine.js';
import { sha256, type Artifact } from '@solidcash/utils';
import { deriveFramedGenesis } from '../../../src/framed/deploy/index.js';

/**
 * A contract whose state is one array, reached through a value-returning getter.
 *
 * A framed master whose entry points return a value parks the frame's `retval` and every body settles it: a void
 * body such as a constructor requires it empty. The master also parks the base of the record block a dynamic value's
 * chunks are addressed from, and that base sits above the frame slots. A body's settled stack has to register both
 * in the order the head leaves them, or a model-indexed read selects the wrong operand and the constructor refuses
 * before it settles anything.
 *
 * The Solidity and `.scash` frontends lower the same array state to the same layout, so both are pinned here beside
 * the writer form that mutates the array.
 */

const CATEGORY = sha256(new TextEncoder().encode('solidity array constructor'));
const VALIDATOR_PROGRAM = buildValidatorProgram();
const OWNER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x11));

/** Compiles one `.sol` source through the shipped multi-contract entry, in the framed convention. */
function compileSol(source: string, name = 'Impl'): Artifact {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'framed-sol-array-'));
  const file = path.join(dir, `${name}.sol`);
  fs.writeFileSync(file, source);
  try {
    return (compileFileMulti(file, { composition: 'framed', evmCompat: true } as never) as
      Record<string, Artifact>)[name]!;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** The machine's verdict on the derivation program a genesis publishes. */
function accepted(artifact: Artifact): ReturnType<typeof deriveFramedGenesis> {
  const genesis = deriveFramedGenesis({
    artifact, category: CATEGORY, validatorProgram: VALIDATOR_PROGRAM, provider: compositionProvider(),
    constructorArgs: [], senderLockingBytecode: OWNER_LOCK,
  });
  const vm = compositionMachine();
  expect(vm.stateSuccess(vm.evaluate(genesis.program!))).toBe(true);
  return genesis;
}

describe('a framed genesis for an array-state contract', () => {
  it('derives the Solidity contract whose constructor is empty', () => {
    const genesis = accepted(compileSol('pragma solidity ^0.8.20;\ncontract Impl { int[] listed; constructor() { } }'));
    // An empty array's data NFT carries the zero length, which is the pre-state commitment.
    expect(genesis.commitments).toStrictEqual(['00']);
  });

  it('derives the Solidity contract whose entry writes the array', () => {
    const writer = compileSol('pragma solidity ^0.8.20;\n'
      + 'contract Impl { int[] listed; constructor() { } function push(int t) public { listed.push(t); } }');
    accepted(writer);
  });

  it('derives the .scash control for the same layout', () => {
    const control = compileString(
      'pragma solidcash ^0.14.0;'
      + ' contract Impl {'
      + '   int[] listed;'
      + '   constructor() { }'
      + '   function push(int t) public { this.listed.push(t); }'
      + '   function peek() external returns (int) { return 0; }'
      + ' }',
      { composition: 'framed' },
    );
    const genesis = accepted(control);
    expect(genesis.commitments).toStrictEqual(['00']);
  });
});
