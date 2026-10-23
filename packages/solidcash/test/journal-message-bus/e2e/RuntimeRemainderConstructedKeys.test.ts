import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';

const SOURCE = `contract RuntimeRemainderKeys() {
  mapping(int => int) slots;

  function fill(int[] memory keys, int base, int limit) internal pure {
    int cursor = 0;
    while (cursor < limit) {
      keys[cursor] = base + cursor;
      cursor = cursor + 1;
    }
  }

  function write(int count, int base, int runtimeLimit, pubkey pk, sig s) public {
    int[] memory keys = new int[](count);
    fill(keys, base, runtimeLimit % 4);
    for (int cursor = 0; cursor < count; cursor = cursor + 1) {
      this.slots[keys[cursor]] = cursor + 1;
    }
    require(checkSig(s, pk) && count == 3);
  }

  function check(int key, int value, pubkey pk, sig s) public {
    require(checkSig(s, pk));
    require(this.slots[key] == value);
  }
}`;

describe('runtime-remainder constructed keys', () => {
  it('fails closed until replay-selected entry identities have an authenticated carrier', () => {
    const artifact = compileString(SOURCE, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'write'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
    expect(artifact.abi.find((entry) => entry.name === 'write')).toBeDefined();
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'check'))
      .toMatchObject({ eligible: true });
  });
});
