import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import {
  decodePushdataValue, encodeChunkableValueTail, encodePushdataValue,
  type AbiFunction, type Artifact, type EntryAccessAbi,
} from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import type { FunctionArgument } from '../../src/Argument.js';
import { externalReturnsForCallsites } from '../../src/stateful/external-returns-for-callsites.js';
import { encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';
import { addressToLockScript } from '../../src/utils.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const options = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
  sortedMappingsAll: false,
} as const;

describe('kernel computed whole-value storage', () => {
  it('encodes a branch-computed struct only when its selected producer results are available', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x61), provider);
    for (let index = 0; index < 6; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Recipient { address owner; }
      struct Record { uint256 amount; bytes payload; uint16[2] flags; address recipient; }
      interface IMeasure { function read() external returns (uint256); }
      contract Archive() {
        mapping(uint256 => Record) records;
        function store(uint256 key, uint256 amount, bytes payload, bool measure, address meter, Recipient recipient) public {
          uint256 adjusted = amount;
          if (measure) {
            uint256 beforeValue = IMeasure(meter).read();
            uint256 afterValue = IMeasure(meter).read();
            adjusted = afterValue - beforeValue;
          }
          uint16[2] flags = [0, 100];
          records[key] = Record(adjusted, payload, flags, recipient.owner);
          require(true);
        }
      }`, options);
    const archive = await getContractFactory(artifact, signer).deploy();
    const handler = artifact.abi.find((fn) => fn.name === 'store')!;
    const access = handler.entryAccesses![0];
    expect(access.storedValueSource).toBeDefined();
    const payload = new Uint8Array(180).fill(0x51);
    const evaluator = archive as unknown as {
      _encodeStoredValueSource(
        access: EntryAccessAbi, type: string, args: FunctionArgument[], handler: AbiFunction,
        artifact: Artifact, state?: Record<string, unknown>, results?: ReadonlyMap<string, FunctionArgument>,
      ): Uint8Array | undefined;
    };
    const recipient = addressToLockScript(signer.getAddress());
    const recipientWord = new Uint8Array(32);
    recipientWord.set(recipient.slice(3, 23), 12);
    const args: FunctionArgument[] = [1n, 5n, payload, true, new Uint8Array(), { owner: recipient }];
    expect(evaluator._encodeStoredValueSource(access, 'Record', args, handler, artifact)).toBeUndefined();
    expect(evaluator._encodeStoredValueSource(access, 'Record', args.slice(0, 3), handler, artifact)).toBeUndefined();
    const results = externalReturnsForCallsites(
      [{ kind: 'expression', expression: access.storedValueSource!.expression }],
      new Map([[0, 10n], [1, 37n]]), handler.externalCalls!,
    );
    const encoded = evaluator._encodeStoredValueSource(access, 'Record', args, handler, artifact, {}, results);
    expect(encoded).toBeDefined();
    expect(decodePushdataValue(encoded!, 0, 'Record', artifact.structs).value)
      .toEqual({ amount: 27n, payload, flags: [0n, 100n], recipient: recipientWord });
    const direct = evaluator._encodeStoredValueSource(
      access, 'Record', [1n, 5n, payload, false, args[4], args[5]], handler, artifact,
    );
    expect(decodePushdataValue(direct!, 0, 'Record', artifact.structs).value)
      .toEqual({ amount: 5n, payload, flags: [0n, 100n], recipient: recipientWord });
    const forged = { ...access, storedValueSource: { ...access.storedValueSource!, mutationEffectOrdinal: 999 } };
    expect(evaluator._encodeStoredValueSource(forged, 'Record', args, handler, artifact, {}, results)).toBeUndefined();
  }, 120_000);

  it('publishes continuations and the final return of an ordinary nested computed-struct writer', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x62), provider);
    for (let index = 0; index < 30; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 amount; bytes payload; address recipient; }
      contract Archive() {
        uint256 visits;
        mapping(uint256 => Record) records;
        function touch() public returns (uint256) { this.visits = this.visits + 1; return this.visits; }
        function store(uint256 key, uint256 amount, bytes payload, address recipient) public returns (uint256) {
          uint256 adjusted = amount + 2;
          records[key] = Record(adjusted, payload, recipient);
          return adjusted;
        }
      }`, options);
    const archive = await getContractFactory(artifact, signer).deploy();
    const driverArtifact = compileString(`pragma solidity ^0.8.0;
      interface IArchive {
        function touch() external returns (uint256);
        function store(uint256 key, uint256 amount, bytes payload, address recipient) external returns (uint256);
      }
      contract Driver() {
        uint256 calls;
        function initialize() public { this.calls = 0; }
        function run(address target, bytes payload, address recipient) public {
          IArchive(target).touch();
          uint256 stored = IArchive(target).store(1, 5, payload, recipient);
          require(stored == 7);
          this.calls = this.calls + 1;
          require(true);
        }
      }`, options);
    const driver = await upgrades.deployProxy(getContractFactory(driverArtifact, signer), []);
    driver.implementation._registerResolvedExternal('IArchive', archive);
    const payload = new Uint8Array(180).fill(0x52);
    await expect(driver.forward('run', [
      await archive.getAddress(), payload, addressToLockScript(signer.getAddress()),
    ]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    expect((await archive.getEntries('records'))[0]?.value).toMatchObject({ amount: 7n, payload });
  }, 180_000);

  it('preserves amount in a probe-generated chunkable struct insert', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x64), provider);
    for (let index = 0; index < 6; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Record { uint256 amount; bytes payload; }
      contract Archive() {
        mapping(uint256 => Record) records;
        function store(uint256 key, uint256 amount, bytes payload) public {
          records[key] = Record(amount, payload);
          require(true);
        }
      }`, options);
    const archive = await getContractFactory(artifact, signer).deploy();
    const handler = artifact.abi.find((fn) => fn.name === 'store')!;
    expect(handler.entryAccesses?.[0]?.valueSource).toMatch(/^call:Record\(/);
    const payload = new Uint8Array(180).fill(0x54);
    const probe = await archive._createBuilder('store', [1n, 7n, payload], {
      abiFunction: handler, returnProbeOnly: true,
    });
    const expectedValue = encodePushdataValue({ amount: 7n, payload }, 'Record', artifact.structs);
    const expectedEntry = binToHex(encodeEntryCommitment(
      keyToSlot(bigIntToVmNumber(1n)), new Uint8Array(32), encodeChunkableValueTail(expectedValue),
    ));
    expect(probe.build().outputs.some((output) => output.token?.nft?.commitment === expectedEntry)).toBe(true);
  }, 120_000);
});
