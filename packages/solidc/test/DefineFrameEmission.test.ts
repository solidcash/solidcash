import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';
import {
  clearDefineFrameValidations,
  getDefineFrameValidations,
  validateDefineEmission,
} from '../src/define-frame-validation.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

describe('DEFINE frame emission (item 3 real path)', () => {
  it('compileString drives validateDefineEmission via GTT emitFunctionDefine', () => {
    clearDefineFrameValidations();
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        mapping(int => int) data;
        function set(int k, int v) public {
          this.data[k] = v;
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.available).toBe(true);
    const records = getDefineFrameValidations();
    expect(records.length).toBeGreaterThan(0);
    // At least one DEFINE body recorded a schema with handler id.
    expect(records.some((record) => record.schema.handlerId.length > 0)).toBe(true);
    expect(records.every((record) => record.result.ok || record.handlerName.startsWith('__'))).toBe(true);
  });

  it('validateDefineEmission fail-closes on injected anonymous live cells', () => {
    const result = validateDefineEmission({
      handlerId: 'h-bad',
      handlerName: 'bad',
      parameters: [{ name: 'x' }],
      anonymousLive: 2,
      altStackDepth: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.invariantId === 'live-anonymous-at-settlement')).toBe(true);
  });
});
