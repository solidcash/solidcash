import { binToHex, hexToBin } from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  SignatureTemplate,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { alicePriv } from '../../fixture/vars.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel native assembly data signatures', () => {
  it('executes closed OP_CHECKDATASIG forms and rejects a message tamper in the BCH-2026 VM', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const message = hexToBin('00112233445566778899aabbccddeeff');
    const tamperedMessage = message.slice();
    tamperedMessage[0] ^= 1;
    const signer = new SignatureTemplate(alicePriv);
    const signature = signer.signMessageHash(sha256(message));
    const publicKey = signer.getPublicKey();
    const pushes = (payload: Uint8Array): string => `0x${binToHex(payload)}`;
    const check = (checkedMessage: Uint8Array, verify: boolean): string => [
      pushes(signature), pushes(checkedMessage), pushes(publicKey),
      verify ? 'OP_CHECKDATASIGVERIFY' : 'OP_CHECKDATASIG OP_VERIFY',
    ].join(' ');
    const artifact = compileString(`contract DataSignature() {
      function predicate() public {
        assembly { ${check(message, false)} }
        require(true);
      }
      function verifier() public {
        assembly { ${check(message, true)} }
        require(true);
      }
      function tampered() public {
        assembly { ${check(tamperedMessage, true)} }
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
    });
    expect(artifact.messageBus?.handlers.map(({ name, eligible }) => ({ name, eligible }))).toEqual([
      { name: 'predicate', eligible: true },
      { name: 'verifier', eligible: true },
      { name: 'tampered', eligible: true },
    ]);
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );

    expect(vmAccepts(await contract.batch([{ function: 'predicate', args: [] }]).build())).toBe(true);
    expect(vmAccepts(await contract.batch([{ function: 'verifier', args: [] }]).build())).toBe(true);
    expect(vmAccepts(await contract.batch([{ function: 'tampered', args: [] }]).build())).toBe(false);
  }, 120_000);
});
