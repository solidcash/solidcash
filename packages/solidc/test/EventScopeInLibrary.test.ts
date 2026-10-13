import { describe, it, expect } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { compileString } from './direct-compile.js';

// A bare event name inside a library function follows Solidity's scope: the library's own events, then file-level
// ones. The calling contract's same-named event, and other libraries' events, are not visible there.

const topic = (signature: string): string => bytesToHex(keccak_256(utf8ToBytes(signature)));

const SOURCE = `
event Ping();

library Decoy {
    event Ping(uint256);
}

library Plain {
    function sel() internal pure returns (bytes32) {
        return Ping.selector;
    }
}

library Own {
    event Ping(bool);

    function sel() internal pure returns (bytes32) {
        return Ping.selector;
    }
}

contract Holder {
    event Ping(uint256);

    function plain(bytes32 expected) external pure {
        require(Plain.sel() == expected);
    }

    function own(bytes32 expected) external pure {
        require(Own.sel() == expected);
    }
}
`;

describe('bare event selector inside a library function', () => {
  it('resolves the library event, else the file-level event, not the calling contract event', () => {
    // Each folded selector is a 32-byte push in the emitted bytecode.
    const emitted = JSON.stringify(compileString(SOURCE, { evmCompat: true }));
    expect(emitted).toContain(topic('Ping()'));
    expect(emitted).toContain(topic('Ping(bool)'));
    expect(emitted).not.toContain(topic('Ping(uint256)'));
  });
});
