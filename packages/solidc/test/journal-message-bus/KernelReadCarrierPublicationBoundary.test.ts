import { describe, expect, it } from 'vitest';
import { compileString } from '../../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

const source = (
  contractName: string,
  sourceCollection: string,
  destinationCollection: string,
  handlerName: string,
): string => `contract ${contractName}() {
  mapping(int => int) ${sourceCollection};
  mapping(int => int) ${destinationCollection};
  function seed(int key, int value) public {
    this.${sourceCollection}[key] = value;
    this.${destinationCollection}[key] = 0;
    require(true);
  }
  function ${handlerName}(int count) public {
    for (int index = 0; index < count; index = index + 1) {
      this.${destinationCollection}[index] = this.${sourceCollection}[index];
    }
    require(true);
  }
}`;

describe('kernel read-carrier publication boundary', () => {
  it('publishes compiler-authenticated read carriers in every compile path', () => {
    const variants = [
      { code: source('First', 'left', 'right', 'transferRows'), handler: 'transferRows' },
      { code: source('Second', 'before', 'after', 'apply'), handler: 'apply' },
    ];

    for (const { code, handler } of variants) {
      for (const optimizeForCompilationSpeed of [false, true]) {
        const artifact = compileString(code, {
          ...KERNEL,
          optimizeForCompilationSpeed,
          suppressWarnings: true,
          __artifactCache: false,
          __strictNoInternalRecovery: true,
        });
        expect(artifact.messageBus).toMatchObject({
          convention: 'kernel-row-loop',
          available: true,
          routeInBytecode: true,
        });
        const published = artifact.messageBus?.handlers.find((candidate) => candidate.name === handler);
        expect(published).toMatchObject({ eligible: true, selector: expect.stringMatching(/^[0-9a-f]{8}$/) });
        expect(artifact.messageBus?.kernelEntryJournal?.capabilities).toContainEqual({
          kind: 'internal-read-carrier',
          version: 1,
          scopes: expect.arrayContaining([expect.objectContaining({
            handlerSelector: published!.selector,
          })]),
        });
      }
    }
  }, 60_000);
});
