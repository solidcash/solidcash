import { hexToBin } from '@bitauth/libauth';
import { scriptToAsm } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROXY_SOURCE, defaultProxyArtifact } from '../../src/stateful/defaultProxyArtifact.js';

/**
 * The delegate derives its state owner positionally (`proxyMasterIndex == OP_INPUTINDEX - 1 - dataNftCount`).
 * The identity and payload pins do not bind that position, so a delegate placed after a DIFFERENT master's block
 * would authorize that master while the forwarding proxy's own state covenant is skipped. A proxy publishes the
 * distance to its delegate as the constructor input `__proxyBlockSize`, which its own p2sh32 commits to.
 */
const POSITION_PIN = 'OP_INPUTINDEX OP_ADD OP_DEPTH OP_1SUB OP_PICK OP_NUMEQUALVERIFY';

describe('delegate position pin', () => {
  it('pins the delegate one published proxy block after the forwarding input', () => {
    const compiled = compileString(DEFAULT_PROXY_SOURCE, { forceStateful: true, suppressWarnings: true });
    const forward = compiled.abi.find((entry) => entry.name === '__forward')!;

    expect(compiled.constructorInputs.map((input) => input.name)).toEqual([
      'implementation', '__proxyBlockSize', '__proxyRouteBlockSize',
    ]);
    // Baking still names the implementation: the extra constructor input must not move targetBinding.input.
    expect(forward.delegateForwarding?.targetBinding).toMatchObject({ kind: 'constructorArg', input: 0 });
    expect(scriptToAsm(hexToBin(compiled.debug!.bytecode))).toContain(POSITION_PIN);
    // The shipped artifact is the same compile, so the SDK deploy path carries the pin.
    expect(defaultProxyArtifact.constructorInputs.map((input) => input.name)).toEqual([
      'implementation', '__proxyBlockSize', '__proxyRouteBlockSize',
    ]);
  });

  it('leaves a proxy that publishes no distance on the witness-only pin', () => {
    const unpublished = `pragma solidcash >=0.8.0;
      contract UnpublishedProxy(address implementation) {
        function __forward(bytes input) {
          implementation.delegatecall(input);
          require(input.length > 0);
        }
      }`;
    const compiled = compileString(unpublished, { forceStateful: true, suppressWarnings: true });
    expect(compiled.constructorInputs.map((input) => input.name)).toEqual(['implementation']);
    expect(scriptToAsm(hexToBin(compiled.debug!.bytecode))).not.toContain(POSITION_PIN);
  });
});
