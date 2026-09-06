import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

describe('kernel external token-container handlers', () => {
  it('preserves the source category frame for an external transfer', () => {
    const artifact = compileString(`contract Vault() {
      function move(bytes32 category, bytes recipient, int amount) external {
        this.tokens[category].transfer(recipient, amount);
        require(true);
      }
      function control() public { require(true); }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'move')).toMatchObject({
      eligible: true,
      batchKeyWitnesses: [expect.objectContaining({
        routeInput: '__message_bus_token_category', inputIndex: 0, source: 'argument',
      })],
    });
    expect(artifact.messageBus?.route.inputs).toContainEqual(expect.objectContaining({
      name: '__message_bus_token_category', type: 'bytes32',
    }));
    expect(artifact.abi.find((fn) => fn.name === 'move')?.tokenContainerAccesses).toContainEqual(
      expect.objectContaining({ keyParam: 'category', operations: ['transfer'] }),
    );
    expect(artifact.functionBodies?.[artifact.messageBus!.selector]).toBeDefined();
  });

  it('preserves distinct external category parameters and token operation kinds', () => {
    const artifact = compileString(`contract Vault() {
      function moveBoth(
        bytes32 fungibleCategory,
        bytes32 nftCategory,
        bytes recipient,
        int amount,
        bytes commitment,
        int capability
      ) external {
        this.tokens[fungibleCategory].transfer(recipient, amount);
        this.tokens[nftCategory].transferNft(recipient, commitment, capability);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((candidate) => candidate.name === 'moveBoth');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler?.batchKeyWitnesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ routeInput: '__message_bus_token_category', inputIndex: 0 }),
      expect.objectContaining({ routeInput: '__message_bus_token_category_1', inputIndex: 1 }),
    ]));
    const accesses = artifact.abi.find((fn) => fn.name === 'moveBoth')?.tokenContainerAccesses ?? [];
    expect(accesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ keyParam: 'fungibleCategory', operations: ['transfer'] }),
      expect.objectContaining({ keyParam: 'nftCategory', operations: ['transferNft'] }),
    ]));
  });

  it('does not widen the legacy visibility boundary', () => {
    const artifact = compileString(`contract Vault() {
      function move(bytes32 category, bytes recipient, int amount) external {
        this.tokens[category].transfer(recipient, amount);
        require(true);
      }
      function control() public { require(true); }
    }`, { forceStateful: true, messageBus: true, messageBusKernel: false });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'move')).toMatchObject({
      eligible: false,
    });
  });
});
