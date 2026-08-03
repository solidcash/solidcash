import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, hexToBin,
} from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, layer3 } from '../../../src/index.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { preflightLayer3Transaction } from '../../../src/layer3/preflight.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createLayer3CapstoneTestProvider } from './layer3-semantic-profile.js';

const TRUE_RESULT = '45332211';
const FORGED_RESULT = 'ffffff7f';

const vmRejects = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.some((_input, inputIndex) => (
    vm.debug({ inputIndex, sourceOutputs, transaction }) as Array<{ error?: unknown }>
  ).some((state) => state.error !== undefined));
};

const replacePush = (
  builder: TransactionBuilder, inputIndex: number,
  replace: (data: Uint8Array, pushIndex: number) => Uint8Array | undefined,
): void => {
  const original = builder.inputs[inputIndex].unlocker!;
  builder.inputs[inputIndex] = {
    ...builder.inputs[inputIndex],
    unlocker: {
      generateLockingBytecode: () => original.generateLockingBytecode(),
      generateUnlockingBytecode: (options) => {
        const instructions = decodeAuthenticationInstructions(original.generateUnlockingBytecode(options));
        let replacements = 0;
        instructions.forEach((instruction, index) => {
          if (!('data' in instruction)) return;
          const data = replace(instruction.data, index);
          if (data === undefined) return;
          instructions[index] = { ...instruction, data };
          replacements += 1;
        });
        if (replacements !== 1) throw new Error(`audit mutation replaced ${replacements} pushes, expected one`);
        return encodeAuthenticationInstructions(instructions);
      },
    },
  };
};

const buildComposition = async (): Promise<ReturnType<typeof layer3.compose>> => {
  const provider = createLayer3CapstoneTestProvider();
  const calleeArtifact = compileString(`contract CarrierAuditCallee() {
    function settle(int next) public pure returns (int) { return next + 1; }
  }`, { forceStateful: true });
  const calleeBase = new Contract(calleeArtifact, [], { provider });
  const calleeSetup = await setupStatefulUtxos(
    provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
  );
  const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
  const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);

  const callerArtifact = compileString(`
    interface ICarrierAuditCallee { function settle(int next) returns (int); }
    contract CarrierAuditCaller(address callee) {
      function prepare(int next) public {
        int result = ICarrierAuditCallee(callee).settle(next);
        require(result >= 0);
      }
    }
  `, { forceStateful: true });
  const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(
    provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
  );
  const caller = StatefulContract.withCategory(
    callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
  );
  const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
  return layer3.compose({
    calls: [caller.call.prepare(0x11223344n), callee.call.settle(0x11223344n)],
    funder: fee,
    changeAddress: fee.unlocker.generateLockingBytecode(),
  });
};

const forgeCallerEmission = (builder: TransactionBuilder): void => replacePush(
  builder, 0, (data) => {
    const hex = binToHex(data);
    if (!hex.startsWith('2300aa20') || !hex.endsWith(TRUE_RESULT)) return undefined;
    return hexToBin(hex.slice(0, -TRUE_RESULT.length) + FORGED_RESULT);
  },
);

describe('Layer-3 canonical carrier and master binding audit regressions', () => {
  it('rejects a forged return consumed only by the caller master binder (L3-01)', async () => {
    const composition = await buildComposition();
    const canonical = await composition.build();
    expect(canonical.inputs.every((input) => input.vout !== 0xffffffff)).toBe(true);
    expect(vmRejects(canonical)).toBe(false);

    const impossibleProbe = await composition.build();
    impossibleProbe.inputs[0] = { ...impossibleProbe.inputs[0], vout: 0xffffffff };
    expect(() => preflightLayer3Transaction(impossibleProbe)).toThrow(/derivation-probe outpoint/);

    const hostile = await composition.build();
    forgeCallerEmission(hostile);
    expect(vmRejects(hostile)).toBe(true);
  }, 120_000);

  it('rejects divergent participant carriers and carries no duplicate transcript argument (L3-02/L3-03)', async () => {
    const composition = await buildComposition();
    const hostile = await composition.build();
    const verifierIndices = hostile.inputs
      .map((input, index) => ({ input, index }))
      .filter(({ input }) => input.token?.nft?.commitment.startsWith('4c335631'))
      .map(({ index }) => index);
    expect(verifierIndices).toHaveLength(2);
    expect(hostile.inputs[verifierIndices[0]].unlocker!.abiFunction.inputs.map((input) => input.name))
      .not.toContain('__internal__singleTxTranscript');

    forgeCallerEmission(hostile);
    replacePush(hostile, verifierIndices[0], (data, pushIndex) => {
      if (pushIndex !== 0 || binToHex(data).slice(0, 8) !== '4c334331') return undefined;
      const changed = data.slice();
      changed[changed.length - 1] ^= 1;
      return changed;
    });
    expect(vmRejects(hostile)).toBe(true);
  }, 120_000);
});
