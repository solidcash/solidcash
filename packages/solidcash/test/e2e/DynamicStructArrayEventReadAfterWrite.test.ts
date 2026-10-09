import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import {
  StatefulContract,
  getEventNftAddress,
  readEventsFromChain,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import {
  createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos,
} from '../test-util.js';
import { createMessageBusSemanticTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const SOURCE = `pragma solidity ^0.8.20;
struct Row { bool enabled; string title; uint256 amount; }
contract DynamicStructEvent {
  Row[] rows;
  event Created(bool enabled);
  function create(bool enabled, string memory title, uint256 amount) public {
    rows.push();
    rows[0].enabled = enabled;
    rows[0].title = title;
    rows[0].amount = amount;
    emit Created(rows[0].enabled);
  }
}`;

describe('dynamic struct-array read-after-write in an event', () => {
  it('emits the field value retained by later sibling-field writes', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { solidityImportCompat: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { rows: [] }, { saltContract: true },
    );
    const stateful = StatefulContract.withCategory(contract, categoryId);

    await stateful.create(true, 'x'.repeat(100), 7n).send();

    const event = artifact.events![0];
    const address = getEventNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, event.signature);
    const logs = await readEventsFromChain(provider, address, categoryId, event);
    expect(logs.map((log) => log.values.enabled)).toEqual([true]);
  });

  it('forwards the same pending field through a generated message-bus handler', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const options = {
      forceStateful: true,
      messageBus: true,
      messageBusGraphContext: true,
      solidityImportCompat: true,
      maximumInputBytes: 1_000_000,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
    } as const;
    const sinkArtifact = compileString(`pragma solidity ^0.8.20;
      struct JobEventData { uint8 type_; bytes address_; bytes data_; uint32 timestamp_; }
      contract StructEventSink {
        bool seen;
        mapping(uint256 => JobEventData[]) public jobEvents;
        function record(uint256 id, JobEventData memory event_) public {
          require(id == 0);
          require(event_.address_.length == 0 && event_.timestamp_ == 0);
          require(event_.data_.length > 0);
          event_.timestamp_ = 1;
          jobEvents[id].push(event_);
          seen = true;
        }
        function check() public view {
          require(jobEvents[0].length == 2);
          require(jobEvents[0][0].type_ == 0
            && jobEvents[0][0].data_ == hex"${'aa'.repeat(64)}01");
          require(jobEvents[0][1].type_ == 1 && jobEvents[0][1].data_ == hex"bb");
        }
      }`, options);
    const sinkBase = new Contract(sinkArtifact, [], { provider });
    const sinkSetup = await setupStatefulUtxos(
      provider, sinkBase, sinkArtifact.stateLayout!, { seen: false }, { saltContract: true },
    );
    const sinkInner = sinkBase.withCategory(hexToBin(sinkSetup.categoryId));
    const sink = StatefulContract.withCategory(sinkInner, sinkSetup.categoryId);

    const callerArtifact = compileString(`pragma solidity ^0.8.20;
      struct Row { bool enabled; string title; uint256 amount; }
      struct JobEventData { uint8 type_; bytes address_; bytes data_; uint32 timestamp_; }
      interface StructEventSink { function record(uint256 id, JobEventData memory event_) external; }
      contract StructEventCaller(address sink) {
        Row[] rows;
        function create(bool enabled, string memory title, uint256 amount) public {
          rows.push();
          rows[0].enabled = enabled;
          rows[0].title = title;
          rows[0].amount = amount;
          StructEventSink(sink).record(0, JobEventData({
            type_: 0,
            address_: bytes(""),
            data_: bytes.concat(hex"${'aa'.repeat(64)}", abi.encodePacked(rows[0].enabled)),
            timestamp_: 0
          }));
          StructEventSink(sink).record(0, JobEventData({
            type_: 1,
            address_: bytes(""),
            data_: hex"bb",
            timestamp_: 0
          }));
          require(true);
        }
      }`, options);
    const callerBase = new Contract(callerArtifact, [sinkInner.lockingBytecode], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, { rows: [] }, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    const fee = await createBareP2pkhFeeFunder(provider, 1_000_000n);

    await messageBus.compose({
      calls: [
        caller.call.create(true, 'x'.repeat(100), 7n),
        sink.call.record(0n, {
          type_: 0n,
          address_: new Uint8Array(),
          data_: hexToBin(`${'aa'.repeat(64)}01`),
          timestamp_: 0n,
        }),
        sink.call.record(0n, {
          type_: 1n,
          address_: new Uint8Array(),
          data_: hexToBin('bb'),
          timestamp_: 0n,
        }),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }).send();
    await sink.call.check().send();
  }, 180_000);
});
