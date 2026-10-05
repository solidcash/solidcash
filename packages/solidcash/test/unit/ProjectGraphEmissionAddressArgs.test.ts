import { binToHex, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { addressToGraphEmissionBytes, encodePushdataValue } from '@solidcash/utils';
import {
  encodeMessageBatch, encodeMessageBusArguments, projectGraphEmissionAddressArgs,
  projectMessageBusHandlerArguments,
} from '../../src/message-bus/message-bus.js';
import { compileString } from 'solidc';

describe('projectGraphEmissionAddressArgs', () => {
  it('leaves int-only args unchanged', () => {
    const raw = encodePushdataValue(7n, 'int256');
    const framed = encodeMessageBusArguments([raw], ['int256']);
    const projected = projectGraphEmissionAddressArgs(framed, ['int256']);
    expect(binToHex(projected)).toBe(binToHex(framed));
  });

  it('projects address args to ABI words without touching sibling ints', () => {
    const lock = new Uint8Array(35);
    lock[0] = 0xaa;
    lock[1] = 0x20;
    lock[34] = 0x87;
    for (let i = 0; i < 32; i += 1) lock[2 + i] = i + 1;
    const addr = encodePushdataValue(lock, 'address');
    const num = encodePushdataValue(7n, 'int256');
    const framed = encodeMessageBusArguments([addr, num], ['address', 'int256']);
    const projected = projectGraphEmissionAddressArgs(framed, ['address', 'int256']);
    expect(projected.length).not.toBe(framed.length);
    const word = addressToGraphEmissionBytes(lock);
    expect(binToHex(projected).includes(binToHex(word))).toBe(true);
  });

  it('projects address fields nested inside structs via encodeMessageBatch', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      struct Peer { address who; uint256 tag; }
      contract C {
        function act(Peer memory peer) public { require(peer.tag > 0); require(true); }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      solidityImportCompat: true, suppressWarnings: true,
    });
    const lock = new Uint8Array(35);
    lock[0] = 0xaa;
    lock[1] = 0x20;
    lock[34] = 0x87;
    for (let i = 0; i < 32; i += 1) lock[2 + i] = (i * 3 + 1) & 0xff;
    const native = encodePushdataValue({ who: lock, tag: 7n }, 'Peer', artifact.structs);
    expect(binToHex(native).includes(binToHex(lock))).toBe(true);
    const batch = encodeMessageBatch(artifact, [{ function: 'act', args: [{ who: lock, tag: 7n }] }]);
    const argsHex = batch.rows[0]!.argsHex;
    const word = addressToGraphEmissionBytes(lock);
    expect(argsHex.includes(binToHex(word))).toBe(true);
    expect(argsHex.includes(binToHex(lock))).toBe(false);
  });

  it('projects value addresses for handler replay while retaining native call-target locks', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface ITarget { function ping() external; }
      contract C {
        function act(address value, address target) public {
          ITarget(target).ping();
          require(value != address(0));
          require(true);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      solidityImportCompat: true, suppressWarnings: true,
    });
    const value = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x31), 0x88, 0xac);
    const target = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87);
    const projected = projectMessageBusHandlerArguments(artifact, 'act', undefined, [value, target]);

    expect(projected[0]).toEqual(addressToGraphEmissionBytes(value));
    expect(projected[1]).toEqual(target);
  });

  it('projects a CashAddress value to the same ABI word as its locking bytecode', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        function act(address value) public { require(value != address(0)); require(true); }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      solidityImportCompat: true, suppressWarnings: true,
    });
    const lock = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x31), 0x88, 0xac);
    const address = lockingBytecodeToCashAddress({ bytecode: lock, prefix: 'bchtest' });
    if (typeof address === 'string') throw new Error(address);
    const fromLock = encodeMessageBatch(artifact, [{ function: 'act', args: [lock] }]).rows[0]!.argsHex;
    const fromAddress = encodeMessageBatch(artifact, [{ function: 'act', args: [address.address] }]).rows[0]!.argsHex;
    expect(fromAddress).toBe(fromLock);
    expect(fromAddress).toBe(`20${binToHex(addressToGraphEmissionBytes(lock))}`);
  });
});
