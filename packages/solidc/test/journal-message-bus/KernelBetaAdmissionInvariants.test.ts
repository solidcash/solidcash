import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const KERNEL_REASONS = [
  'KERNEL_UNBOUNDED_KEY',
  'KERNEL_LAYOUT',
  'KERNEL_TX_SIGNATURE',
  'KERNEL_OPAQUE_EFFECT',
  'KERNEL_FOREIGN_DELEGATE',
  'KERNEL_LIFECYCLE',
] as const;

describe('kernel beta admission invariants', () => {
  it('publishes the participant owner at a stable graph route-band coordinate', () => {
    const artifact = compileString(`contract Ledger() {
      string note;
      function replace(string value) public { this.note = value; require(true); }
    }`, { ...OPTIONS, messageBusGraphContext: true });

    const inputs = artifact.messageBus?.route.inputs.map((input) => input.name);
    expect(inputs?.slice(0, 2)).toEqual([
      'batchBlob',
      '__internal__messageBusOwnerBandInput',
    ]);
  });

  it('publishes only the closed six-reason refusal catalog', () => {
    const cases = [
      {
        reason: 'KERNEL_UNBOUNDED_KEY',
        source: `contract Unit() {
          mapping(int => int) values;
          function candidate(int count) public {
            for (int cursor = 0; cursor < count; cursor = cursor + 0) {
              this.values[cursor] = cursor;
            }
            require(true);
          }
          function control() public { require(true); }
        }`,
      },
      {
        reason: 'KERNEL_LAYOUT',
        source: `contract Unit() {
          mapping(int => int) values;
          function candidate(int count) public {
            if (count > 0) { candidate(count - 1); }
            this.values[count] = count;
            require(true);
          }
          function control() public { require(true); }
        }`,
      },
      {
        reason: 'KERNEL_TX_SIGNATURE',
        source: `struct Result { bytes tag; sig authorization; }
          contract Unit(pubkey authority) {
            function candidate(bytes raw) public view returns (Result) {
              sig authorization = sig(raw);
              require(checkSig(authorization, authority));
              return Result(hex"01", authorization);
            }
            function control() public { require(true); }
          }`,
      },
      {
        reason: 'KERNEL_OPAQUE_EFFECT',
        source: `contract Unit() {
          function candidate() public {
            assembly { OP_DEPTH OP_VERIFY }
            require(true);
          }
          function control() public { require(true); }
        }`,
      },
      {
        reason: 'KERNEL_FOREIGN_DELEGATE',
        source: `contract Unit(address implementation) {
          function candidate(bytes payload) public {
            implementation.delegatecall(payload);
            require(true);
          }
          function control() public { require(true); }
        }`,
      },
      {
        reason: 'KERNEL_LIFECYCLE',
        source: `contract Unit() {
          int stored;
          function candidate() selfdestruct { require(true); }
          function control() public { require(true); }
        }`,
      },
    ] as const;

    const observed = cases.map(({ reason, source }) => {
      const artifact = compileString(source, OPTIONS);
      const candidate = artifact.messageBus?.handlers.find((handler) => handler.name === 'candidate');
      expect(candidate).toMatchObject({
        eligible: false,
        rejectionReason: reason,
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      });
      expect(artifact.messageBus?.handlers
        .filter((handler) => !handler.eligible)
        .every((handler) => KERNEL_REASONS.includes(handler.rejectionReason as typeof KERNEL_REASONS[number])))
        .toBe(true);
      return candidate!.rejectionReason;
    });

    expect(new Set(observed)).toEqual(new Set(KERNEL_REASONS));

    const fullyFrozen = compileString(`contract Unit() {
      mapping(int => int) values;
      function candidate(int count) public {
        if (count > 0) { candidate(count - 1); }
        this.values[count] = count;
        require(true);
      }
    }`, OPTIONS);
    expect(fullyFrozen.messageBus).toMatchObject({
      available: false,
      routeInBytecode: false,
      handlers: [{ eligible: false, rejectionReason: 'KERNEL_LAYOUT' }],
    });
  });

  it('derives admission and route geometry from semantics after whole-source renaming', () => {
    const source = (names: {
      contract: string;
      collection: string;
      write: string;
      recursive: string;
      key: string;
      value: string;
      depth: string;
    }): string => `contract ${names.contract}() {
      mapping(int => int) ${names.collection};
      function ${names.write}(int ${names.key}, int ${names.value}) public {
        this.${names.collection}[${names.key}] = ${names.value};
        require(true);
      }
      function ${names.recursive}(int ${names.depth}) public {
        if (${names.depth} > 0) { ${names.recursive}(${names.depth} - 1); }
        this.${names.collection}[${names.depth}] = ${names.depth};
        require(true);
      }
    }`;
    const variants = [
      {
        contract: 'Archive', collection: 'cells', write: 'store', recursive: 'descend',
        key: 'cellId', value: 'nextValue', depth: 'remaining',
      },
      {
        contract: 'Registry', collection: 'slots', write: 'assign', recursive: 'revisit',
        key: 'slotKey', value: 'replacement', depth: 'steps',
      },
    ] as const;

    const summaries = variants.map((names) => {
      const artifact = compileString(source(names), OPTIONS);
      const admitted = artifact.messageBus?.handlers.find((handler) => handler.name === names.write);
      const frozen = artifact.messageBus?.handlers.find((handler) => handler.name === names.recursive);
      const route = artifact.messageBus?.route;
      return {
        convention: artifact.messageBus?.convention,
        blockLayout: route?.blockLayout,
        routeInputTypes: route?.inputs.map((input) => input.type),
        routeAccesses: route?.entryAccesses?.map((access) => ({
          slotIndex: access.slotIndex,
          operations: access.operations,
        })),
        admitted: {
          eligible: admitted?.eligible,
          inputTypes: admitted?.inputs.map((input) => input.type),
          keyWitnesses: admitted?.batchKeyWitnesses?.map((witness) => ({
            inputIndex: witness.inputIndex,
            source: witness.source,
          })),
          physicalEntrySlots: admitted?.physicalEntrySlots,
        },
        frozen: {
          eligible: frozen?.eligible,
          rejectionReason: frozen?.rejectionReason,
          rejectionCode: frozen?.rejectionCode,
        },
      };
    });

    expect(summaries[0]).toEqual(summaries[1]);
    expect(summaries[0]).toMatchObject({
      convention: 'kernel-row-loop',
      admitted: { eligible: true, keyWitnesses: [{ inputIndex: 0, source: 'argument' }] },
      frozen: {
        eligible: false,
        rejectionReason: 'KERNEL_LAYOUT',
        rejectionCode: 'MESSAGE_BUS_UNSUPPORTED_CONSTRUCT',
      },
    });
  });
});
