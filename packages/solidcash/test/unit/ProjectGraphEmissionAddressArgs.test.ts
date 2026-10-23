import { binToHex, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { addressToGraphEmissionBytes, encodePushdataValue } from '@solidcash/utils';
import {
  encodeMessageBatch, encodeMessageBusArguments, projectGraphEmissionAddressArgs,
  projectMessageBusHandlerArguments,
} from '../../src/message-bus/message-bus.js';
import { compileString } from '@solidcash/solidc';

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
      evmCompat: true, suppressWarnings: true,
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
      evmCompat: true, suppressWarnings: true,
    });
    const value = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x31), 0x88, 0xac);
    const target = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87);
    const projected = projectMessageBusHandlerArguments(artifact, 'act', undefined, [value, target]);

    expect(projected[0]).toEqual(addressToGraphEmissionBytes(value));
    expect(projected[1]).toEqual(target);
  });

  it('retains a native low-level call target forwarded through a source expression', () => {
    // A lowered `addr.call(payload)` reached through an inlined `if` publishes its target as a source
    // expression wrapping the forwarded parameter, unlike the bare `forward` a typed `IFoo(addr).m()` emits.
    // Both name the same parameter, so both must keep it native: the caller covenant compares that exact
    // locking bytecode with the participant identity, and the route's `addr.code.length` predicate tests the
    // 23/35-byte lock, not a 32-byte ABI word.
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface IT { function approve(address spender, uint256 value) external returns (bool); }
      library L {
        function callBool(address target, bytes memory payload) internal returns (bool) {
          (bool ok, bytes memory returned) = target.call(payload);
          return ok && returned.length == 0 && target.code.length > 0;
        }
        function callVoid(address target, bytes memory payload) internal {
          (bool ok, bytes memory returned) = target.call(payload);
          require(ok && returned.length == 0);
        }
        function invoke(address target, address spender, uint256 value) internal {
          bytes memory payload = abi.encodeCall(IT.approve, (spender, value));
          if (!callBool(target, payload)) { callVoid(target, payload); }
        }
      }
      contract C {
        function act(address value, address target, address spender, uint256 amount, bool run) public {
          if (run) { L.invoke(target, spender, amount); }
          require(value != address(0));
          require(true);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      evmCompat: true, suppressWarnings: true,
    });
    const value = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x31), 0x88, 0xac);
    const target = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87);
    const projected = projectMessageBusHandlerArguments(
      artifact, 'act', undefined, [value, target, value, 7n, true],
    );

    expect(projected[0]).toEqual(addressToGraphEmissionBytes(value));
    expect(projected[1]).toEqual(target);
  });

  it('keeps a BCH transfer recipient native unless it is also forwarded into an external call', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      interface ITarget { function ping(address to, uint amount) external; }
      contract C {
        function payOnly(address payable recipient, uint amount) public {
          recipient.transfer(amount);
          require(true);
        }
        function payAndForward(address payable recipient, uint amount, address target) public {
          recipient.transfer(amount);
          ITarget(target).ping(recipient, amount);
          require(true);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      evmCompat: true, suppressWarnings: true,
    });
    const recipient = Uint8Array.of(0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x31), 0x88, 0xac);
    const target = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x42), 0x87);

    // A recipient reproduced as an output locking bytecode stays native like a call target...
    expect(projectMessageBusHandlerArguments(artifact, 'payOnly', undefined, [recipient, 2_000n])[0])
      .toEqual(recipient);
    // ...but a recipient that is also a nested call argument keeps the callee's ABI word.
    const forwarded = projectMessageBusHandlerArguments(artifact, 'payAndForward', undefined, [recipient, 2_000n, target]);
    expect(forwarded[0]).toEqual(addressToGraphEmissionBytes(recipient));
    expect(forwarded[2]).toEqual(target);
  });

  it('projects a CashAddress value to the same ABI word as its locking bytecode', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        function act(address value) public { require(value != address(0)); require(true); }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true,
      evmCompat: true, suppressWarnings: true,
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
