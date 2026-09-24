/**
 * token-container co-layout: inventory #9 token-container co-layout proof object + admitted read subset.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertTokenContainerCoLayoutProof,
  buildTokenContainerCoLayoutProof,
  hasTokenContainerCoLayoutGeometry,
} from '@solidcash/utils';
import { compileString } from '../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

describe('token-container co-layout token-container co-layout proof', () => {
  it('buildTokenContainerCoLayoutProof fails closed on empty / incomplete sites', () => {
    expect(() => buildTokenContainerCoLayoutProof([])).toThrow(/non-empty/);
    expect(() => buildTokenContainerCoLayoutProof([{
      handlerName: 'append',
      dynamicWrites: [],
      tokenContainerSlotIndices: [0],
      spanKind: 'tokenContainer-input-plus-trailing-dyn',
    }])).toThrow(/dynamicWrites/);
  });

  it('hasTokenContainerCoLayoutGeometry requires tokenContainer slots + dyn writes + trailing', () => {
    expect(hasTokenContainerCoLayoutGeometry({
      slots: [{ kind: 'master' }, { kind: 'tokenContainer', slotIndex: 0 }, { kind: 'trailing' }],
      dynamicWrites: ['payload'],
    })).toBe(true);
    expect(hasTokenContainerCoLayoutGeometry({
      slots: [{ kind: 'master' }, { kind: 'trailing' }],
      dynamicWrites: ['payload'],
    })).toBe(false);
  });

  it('compileString admits bytes write + tokens[category] read and stamps co-layout proof', () => {
    const artifact = compileString(`contract ParallelTokenState() {
      bytes payload;
      function append(bytes32 category, bytes suffix) public {
        this.payload = bytes.concat(this.payload, suffix);
        bytes commitment = this.tokens[category].nftCommitment;
        require(this.tokens[category].tokenAmount >= 0);
        require(commitment == commitment);
      }
    }`, KERNEL);

    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    expect(artifact.messageBus?.route.blockLayout?.slots).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'tokenContainer', slotIndex: 0 }),
    ]));
    assertTokenContainerCoLayoutProof(artifact.messageBus?.tokenContainerCoLayout);
    expect(artifact.messageBus?.tokenContainerCoLayout?.sites[0]).toMatchObject({
      handlerName: 'append',
      dynamicWrites: ['payload'],
      spanKind: 'tokenContainer-input-plus-trailing-dyn',
    });
    expect(artifact.messageBus?.tokenContainerCoLayout?.sites[0]?.tokenContainerSlotIndices)
      .toContain(0);
  });

  it('production STT remaps helper keyParam onto route token-category witnesses', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const stt = readFileSync(join(here, '../src/semantic/SymbolTableTraversal.ts'), 'utf8');
    const compiler = readFileSync(join(here, '../src/compiler.ts'), 'utf8');
    expect(stt).toContain('__message_bus_token_category');
    expect(stt).toContain('routeTokenKeyFor');
    expect(stt).toContain('token-container key params were deleted');
    expect(compiler).toContain('stampTokenContainerCoLayoutProof');
    expect(compiler).toContain('buildTokenContainerCoLayoutProof');
  });

  it('token-container co-layout transfer+dyn admits with co-spent read and stamps tcTransfer span proof', () => {
    const artifact = compileString(`contract ParallelTokenTransfer() {
      bytes payload;
      function move(bytes32 category, bytes20 to, int amount, bytes suffix) public {
        require(this.tokens[category].tokenAmount >= amount);
        this.payload = bytes.concat(this.payload, suffix);
        this.tokens[category].transfer(to, amount);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((entry) => entry.name === 'move');
    expect(handler?.eligible).toBe(true);
    expect(artifact.messageBus?.route?.blockLayout?.slots).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'tokenContainer' }),
      expect.objectContaining({ kind: 'tcTransfer' }),
      expect.objectContaining({ kind: 'trailing' }),
    ]));
    assertTokenContainerCoLayoutProof(artifact.messageBus?.tokenContainerCoLayout);
    expect(artifact.messageBus?.tokenContainerCoLayout?.sites[0]).toMatchObject({
      handlerName: 'move',
      dynamicWrites: ['payload'],
      spanKind: 'tokenContainer-tcTransfer-plus-trailing-dyn',
    });
  });

  it('token-container co-layout transfer+dyn admits even without an explicit container read (frames reserve input)', () => {
    const artifact = compileString(`contract ParallelTokenTransferBare() {
      bytes payload;
      function move(bytes32 category, bytes20 to, int amount, bytes suffix) public {
        this.payload = bytes.concat(this.payload, suffix);
        this.tokens[category].transfer(to, amount);
        require(true);
      }
    }`, KERNEL);
    const handler = artifact.messageBus?.handlers.find((entry) => entry.name === 'move');
    expect(handler?.eligible).toBe(true);
    expect(artifact.messageBus?.route?.blockLayout?.slots).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'tokenContainer' }),
      expect.objectContaining({ kind: 'tcTransfer' }),
    ]));
    expect(artifact.messageBus?.tokenContainerCoLayout?.sites[0]?.spanKind)
      .toBe('tokenContainer-tcTransfer-plus-trailing-dyn');
  });
});
