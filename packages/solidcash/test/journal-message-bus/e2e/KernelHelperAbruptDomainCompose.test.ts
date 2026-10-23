import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('kernel finite helper abrupt-domain composition', () => {
  it('fails closed before composing a multi-arm constructed-key replay', () => {
    const artifact = compileString(`contract HelperAbruptDomainCompose() {
      mapping(int => int) records;
      function derive(int[] memory keys, int base, bool stop) internal pure {
        for (int cursor = 0; cursor < 3; cursor = cursor + 1) {
          keys[cursor] = base + cursor;
          if (cursor == 1) {
            if (stop) { break; } else { continue; }
          }
          keys[cursor] = base + cursor + 10;
        }
      }
      function apply(int count, int base, bool stop) public {
        int[] memory keys = new int[](count);
        derive(keys, base, stop);
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[keys[cursor]] = cursor + 20;
        }
        require(true);
      }
      function check(int key, int expected) public { require(this.records[key] == expected); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((candidate) => candidate.name === 'apply')?.sortedUpsertLoopInfo?.[0])
      .toMatchObject({ multiArmConstructedKeyReplay: true });
  });
});
