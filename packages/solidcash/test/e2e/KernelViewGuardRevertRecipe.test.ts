import { compileStringMulti } from '@solidcash/solidc';
import { afterEach, describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import {
  getMaterializationMode, setMaterializationMode,
} from '../../src/message-bus/materialization-mode.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel source revert after an external view guard', () => {
  const previous = getMaterializationMode();
  afterEach(() => setMaterializationMode(previous));

  it('surfaces the guard reason before a dynamic write under recipe mode', async () => {
    setMaterializationMode('recipe');
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IRegistry { function isMember(address account) external view returns (bool); }
      contract Registry {
        mapping(address => bool) public members;
        function enroll(address account) public { this.members[account] = true; }
        function isMember(address account) public view returns (bool) { return this.members[account]; }
      }
      contract Board {
        bytes[] notes;
        function initialize() public { require(true); }
        function post(address registry, address reviewer, bytes memory note) public {
          if (reviewer != address(0)) {
            require(IRegistry(registry).isMember(reviewer), "reviewer not registered");
          }
          this.notes.push(note);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x5a), provider);
    const outsider = new Signer(new Uint8Array(32).fill(0x5b), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const registry = await getContractFactory(artifacts.Registry, signer).deploy();
    const board = await upgrades.deployProxy(getContractFactory(artifacts.Board, signer), []);
    board.implementation._registerResolvedExternal('IRegistry', registry);
    const note = new Uint8Array(160).fill(0x42);
    expect(getMaterializationMode()).toBe('recipe');
    await expect(board.forward('post', [registry.inner.lockingBytecode, outsider.getAddress(), note]).send())
      .rejects.toThrow(/reviewer not registered/);
  }, 180_000);
});
