import { binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { addressToGraphEmissionBytes, encodePushdataValue } from '@solidcash/utils';
import {
  encodeMessageBatch, encodeMessageBusArguments, projectGraphEmissionAddressArgs,
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
});
