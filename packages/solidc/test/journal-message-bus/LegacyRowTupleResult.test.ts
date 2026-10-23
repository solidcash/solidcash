import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

describe('legacy message-bus row result locals', () => {
  it('keeps dispatcher-wide event registers alive across state-writing handler arms in fast mode', () => {
    const artifact = compileString(`
      pragma solidity ^0.8.0;
      contract EventfulSettings() {
        address owner;
        bool initialized;
        address primary;
        address secondary;
        address tertiary;
        address recipient;
        uint16 fee;
        uint256 revision;

        modifier initializer() { require(!initialized); initialized = true; _; }
        modifier onlyOwner() { require(msg.sender == owner); _; }

        event AddressesChanged(address first, address second, address third);
        event RecipientChanged(address value);
        event FeeChanged(uint16 value);
        event RevisionChanged(uint256 indexed value);

        function initialize(
          address first,
          address second,
          address third,
          address destination,
          uint16 nextFee
        ) public initializer {
          owner = msg.sender;
          primary = first;
          secondary = second;
          tertiary = third;
          recipient = destination;
          fee = nextFee;
          emit AddressesChanged(first, second, third);
          emit RecipientChanged(destination);
          emit FeeChanged(nextFee);
        }

        function setRevision(uint256 value) public onlyOwner {
          revision = value;
          emit RevisionChanged(value);
        }

        function setRecipient(address value) public onlyOwner {
          recipient = value;
          emit RecipientChanged(value);
        }
      }
    `, {
      evmCompat: true,
      forceStateful: true,
      messageBus: true,
      messageBusKernel: false,
      messageBusGraphContext: true,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      maximumInputBytes: 1_000_000,
    });

    expect(artifact.messageBus?.convention).toBe('legacy-unroll');
    expect(artifact.messageBus?.handlers.filter((handler) =>
      handler.name === 'setRevision' || handler.name === 'setRecipient'))
      .toEqual([
        expect.objectContaining({ name: 'setRevision', eligible: true }),
        expect.objectContaining({ name: 'setRecipient', eligible: true }),
      ]);
    expect(artifact.messageBus!.route.blockLayout!.slots.filter((slot) => slot.kind === 'event').length)
      .toBeGreaterThanOrEqual(2);
    expect(artifact.debug?.bytecode.length).toBeGreaterThan(0);
  });

  it('remaps every target of a multi-result assignment in each unrolled row', () => {
    const artifact = compileString(`
      pragma solidcash ^0.14.0;
      contract PairState() {
        int marker;
        function pair(int value) public returns (int, bool) {
          this.marker = value;
          require(value >= 0);
          return (value, true);
        }
        function set(int value) public {
          this.marker = value;
          require(value >= 0);
        }
      }
    `, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: false,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      maximumInputBytes: 1_000_000,
    });

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pair')?.eligible).toBe(true);
    expect(artifact.debug?.bytecode.length).toBeGreaterThan(0);
  });

  it('does not mistake an index into a mapping-value array for a physical mapping key', () => {
    const artifact = compileString(`
      pragma solidity ^0.8.0;
      struct Record { uint8 kind; bytes payload; }
      contract IndexedRecords {
        mapping(uint256 => Record[]) public records;
        function append(uint256 key, bytes memory payload) public {
          records[key].push(Record(1, payload));
        }
      }
    `, {
      evmCompat: true,
      forceStateful: true,
      messageBus: true,
      messageBusKernel: false,
      messageBusGraphContext: true,
      optimizeForCompilationSpeed: true,
      suppressWarnings: true,
      maximumInputBytes: 1_000_000,
    });

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'records')?.eligible).toBe(true);
    expect(artifact.debug?.bytecode.length).toBeGreaterThan(0);
  });
});
