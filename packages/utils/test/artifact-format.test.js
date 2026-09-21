import { describe, expect, it } from 'vitest';
import { formatArtifact } from '../src/artifact.js';
describe('artifact formatting', () => {
    it('serializes null metadata in TypeScript artifacts', () => {
        const artifact = { contractName: 'WithNull', metadata: { ast: null } };
        expect(formatArtifact(artifact, 'ts')).toContain('ast: null');
    });
    it('does not invent a fixed upsert key from an unrelated dynamic write', () => {
        const artifact = {
            contractName: 'Registry',
            abi: [{
                    name: 'update',
                    dynamicWrites: ['records'],
                    sortedUpsertLoopInfo: [{
                            collection: 'permissions',
                            fixedKeyParams: [],
                            varyingArrayParam: 'members',
                            valueConst: '1',
                            op: 'set',
                        }],
                }],
        };
        const parsed = JSON.parse(formatArtifact(artifact, 'json'));
        expect(parsed.abi[0].sortedUpsertLoopInfo[0].fixedKeySources).toBeUndefined();
        expect(artifact.abi[0].sortedUpsertLoopInfo[0].fixedKeySources).toBeUndefined();
    });
    it('preserves the compiler-published fixed upsert key exactly', () => {
        const fixedKeySources = [{
                kind: 'expression',
                expressionLabel: 'binop:-(unop:.length(state:records),lit:1)',
            }];
        const artifact = {
            contractName: 'Registry',
            abi: [{
                    name: 'append',
                    dynamicWrites: ['records'],
                    sortedUpsertLoopInfo: [{
                            collection: 'permissions',
                            fixedKeySources,
                            varyingArrayParam: 'members',
                            valueConst: '1',
                            op: 'set',
                        }],
                }],
        };
        const parsed = JSON.parse(formatArtifact(artifact, 'json'));
        expect(parsed.abi[0].sortedUpsertLoopInfo[0].fixedKeySources).toEqual(fixedKeySources);
    });
    it('publishes the proxy mapping-growth certificate for delegate initializers', () => {
        const artifact = {
            contractName: 'MarketplaceDataV1',
            abi: [{ name: 'initialize', modifiers: ['public', 'delegate'] }],
        };
        const parsed = JSON.parse(formatArtifact(artifact, 'json'));
        expect(parsed.delegateProxyStateOutputCountPinned).toBe(true);
    });
});
//# sourceMappingURL=artifact-format.test.js.map