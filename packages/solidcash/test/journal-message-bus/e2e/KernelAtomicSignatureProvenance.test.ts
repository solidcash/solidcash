import {
  binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructions, hexToBin,
} from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  SignatureTemplate,
  type TransactionBuilder,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import {
  decodeAtomicMessageEnvelope, encodeAtomicMessageEnvelope,
} from '../../../src/message-bus/atomic.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { alicePriv, alicePub } from '../../fixture/vars.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    result.set(part, cursor);
    cursor += part.length;
  }
  return result;
};

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

const verifierAccepts = (builder: TransactionBuilder, category: string): boolean => {
  const inputIndex = builder.inputs.findIndex((input) => input.token?.category === category
    && input.token.nft?.commitment.startsWith('4c335631'));
  if (inputIndex < 0) throw new Error('test could not locate the participant verifier');
  const transaction = builder.buildLibauthTransaction();
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return vm.stateSuccess(vm.evaluate({
    inputIndex, sourceOutputs: generateLibauthSourceOutputs(builder.inputs), transaction,
  })) === true;
};

/** Replace the globally authenticated envelope and its participant-local digest commitments. */
const mutateEnvelope = (
  builder: TransactionBuilder,
  mutate: (manifest: ReturnType<typeof decodeAtomicMessageEnvelope>) =>
  ReturnType<typeof decodeAtomicMessageEnvelope>,
): void => {
  const verifierIndices = builder.inputs.map((input, index) => ({ input, index }))
    .filter(({ input }) => input.token?.nft?.commitment.startsWith('4c335631'))
    .map(({ index }) => index);
  const verifierUnlockers = verifierIndices.map((index) => builder.inputs[index].unlocker!);
  const first = decodeAuthenticationInstructions(
    builder.buildLibauthTransaction().inputs[verifierIndices[0]].unlockingBytecode,
  )[0];
  if (!first || !('data' in first)) throw new Error('test could not locate the atomic envelope');
  const changedEnvelope = encodeAtomicMessageEnvelope(mutate(decodeAtomicMessageEnvelope(first.data)));
  const changedManifest = changedEnvelope.slice(8);

  for (const [participant, verifierIndex] of verifierIndices.entries()) {
    const original = verifierUnlockers[participant];
    builder.inputs[verifierIndex] = {
      ...builder.inputs[verifierIndex],
      unlocker: {
        ...original,
        generateUnlockingBytecode: (options) => {
          const instructions = decodeAuthenticationInstructions(original.generateUnlockingBytecode(options));
          instructions[0] = { ...instructions[0], data: changedEnvelope };
          return encodeAuthenticationInstructions(instructions);
        },
      },
    };
    const params = original.params;
    const activeBase = params[1];
    const localRows = params[2];
    const localBatch = params[3];
    if (typeof activeBase !== 'bigint' || typeof localRows !== 'bigint'
      || !(localBatch instanceof Uint8Array)) throw new Error('invalid verifier test frame');
    const digestParts = [
      sha256(changedManifest), uint16(Number(activeBase)), uint16(Number(localRows)), sha256(localBatch),
    ];
    for (const value of params.slice(4, 11)) {
      if (typeof value === 'bigint') digestParts.push(uint16(Number(value)));
      else if (value instanceof Uint8Array) digestParts.push(sha256(value));
      else throw new Error('invalid verifier graph value');
    }
    const output = builder.outputs[verifierIndex];
    output.token!.nft!.commitment = `${builder.inputs[verifierIndex].token!.nft!.commitment.slice(0, 12)}`
      + binToHex(sha256(concat(...digestParts)));
  }
};

describe('kernel atomic transaction-signature provenance', () => {
  it('consumes exact KTS1 policy and rejects row, path, parameter, body, and protocol drift', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const kernel = {
      forceStateful: true, messageBus: true, messageBusKernel: true,
    } as const;
    const leafArtifact = compileString(`contract SignedLeaf() {
      struct Authorization { sig first; sig second; pubkey firstAuthority; pubkey secondAuthority; }
      int marker;
      function checkFirst(Authorization selected) internal {
        require(checkSig(selected.first, selected.firstAuthority));
      }
      function checkSecond(Authorization selected) internal {
        require(checkSig(selected.second, selected.secondAuthority));
      }
      function set(Authorization authorization, int next) public {
        checkFirst(authorization);
        checkSecond(authorization);
        this.marker = next;
        require(true);
      }
    }`, kernel);
    const leafBase = new Contract(leafArtifact, [], { provider });
    const leafSetup = await setupStatefulUtxos(
      provider, leafBase, leafArtifact.stateLayout!, { marker: 0n }, { saltContract: true },
    );
    const leaf = StatefulContract.withCategory(
      leafBase.withCategory(hexToBin(leafSetup.categoryId)), leafSetup.categoryId,
    );
    const rootArtifact = compileString(`
      struct Authorization { sig first; sig second; pubkey firstAuthority; pubkey secondAuthority; }
      interface ISignedLeaf { function set(Authorization authorization, int next); }
      contract SignatureRoot(address target) {
        function forward(Authorization authorization, int next) public {
          ISignedLeaf(target).set(authorization, next);
          require(true);
        }
      }
    `, kernel);
    const rootBase = new Contract(rootArtifact, [leaf.inner.lockingBytecode], { provider });
    const rootSetup = await setupStatefulUtxos(
      provider, rootBase, rootArtifact.stateLayout!, {}, { saltContract: true },
    );
    const root = StatefulContract.withCategory(
      rootBase.withCategory(hexToBin(rootSetup.categoryId)), rootSetup.categoryId,
    );
    expect(leafArtifact.messageBus?.atomicMessageBus?.protocolVersions).toContain(4);
    expect(rootArtifact.messageBus?.atomicMessageBus?.protocolVersions).toContain(4);
    expect(rootArtifact.messageBus?.handlers.find((handler) => handler.name === 'forward')
      ?.usesTransactionSignature).not.toBe(true);
    const signedHandler = leafArtifact.messageBus?.handlers.find((handler) => handler.name === 'set');
    expect(signedHandler?.transactionSignaturePolicy?.coveredBytecodes).toEqual([
      expect.objectContaining({ parameterIndex: 0, leafIndex: 0 }),
      expect.objectContaining({ parameterIndex: 0, leafIndex: 1 }),
    ]);
    expect(signedHandler?.transactionSignaturePolicy?.coveredBytecodes?.[0].bytecode)
      .not.toBe(signedHandler?.transactionSignaturePolicy?.coveredBytecodes?.[1].bytecode);

    const build = async (): Promise<TransactionBuilder> => {
      const authorization = {
        first: new SignatureTemplate(alicePriv), second: new SignatureTemplate(alicePriv),
        firstAuthority: alicePub, secondAuthority: alicePub,
      };
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      return messageBus.compose({
        calls: [root.call.forward(authorization, 7n), leaf.call.set(authorization, 7n)],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      }).build();
    };
    expect(vmAccepts(await build())).toBe(true);

    const mutateFrame = async (offsetFromStart: number): Promise<void> => {
      const hostile = await build();
      mutateEnvelope(hostile, (manifest) => {
        const index = manifest.rows.findIndex((row) => row.transactionSignatureFrameHex);
        const frame = hexToBin(manifest.rows[index].transactionSignatureFrameHex!);
        frame[offsetFromStart] ^= 1;
        return { ...manifest, rows: manifest.rows.map((row, candidate) => candidate === index
          ? { ...row, transactionSignatureFrameHex: binToHex(frame) } : row) };
      });
      // Evaluate the verifier NFT itself: participant CHECKSIG inputs are intentionally not used as this oracle,
      // because rebinding the verifier digest changes outputs covered by their SIGHASH_ALL signatures too.
      expect(verifierAccepts(hostile, leafSetup.categoryId)).toBe(false);
    };

    // Parameter index, aggregate path, and covered OP_INVOKE body hash remain syntactically valid KTS1 frames.
    await mutateFrame(6);
    await mutateFrame(11);
    await mutateFrame(44);

    const wrongRow = await build();
    mutateEnvelope(wrongRow, (manifest) => {
      const signed = manifest.rows.findIndex((row) => row.transactionSignatureFrameHex);
      const unsigned = manifest.rows.findIndex((row, index) => row.kind === 0 && index !== signed);
      const frame = manifest.rows[signed].transactionSignatureFrameHex;
      return { ...manifest, rows: manifest.rows.map((row, index) => index === signed
        ? { ...row, transactionSignatureFrameHex: undefined }
        : index === unsigned ? { ...row, transactionSignatureFrameHex: frame } : row) };
    });
    expect(verifierAccepts(wrongRow, leafSetup.categoryId)).toBe(false);

    const downgraded = await build();
    mutateEnvelope(downgraded, (manifest) => ({
      participants: manifest.participants.map(({ outputLockingBytecode: _output, lifecycle: _lifecycle, ...rest }) => rest),
      rows: manifest.rows.map(({ transactionSignatureFrameHex: _frame, ...row }) => row),
    }));
    expect(verifierAccepts(downgraded, leafSetup.categoryId)).toBe(false);
  }, 180_000);
});
