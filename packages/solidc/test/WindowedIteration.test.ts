import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

describe('windowed (paginated) sorted-mapping iteration', () => {
  it('compiles the `.window(cursor, K)` form and publishes the cursor and bound', () => {
    const artifact = compileString(`
      contract Window() {
        bytes32 cursor;
        enumerable mapping(bytes32 => int) values;
        function page() public {
          int sum = 0;
          for (int v of this.values.window(cursor, 5)) {
            sum = sum + v;
          }
          require(sum >= 0);
        }
      }
    `, { messageBus: false, suppressWarnings: true });

    const page = artifact.abi.find((f) => f.name === 'page')!;
    expect(page).toBeDefined();
    expect(page.collectionIterations).toHaveLength(1);
    expect(page.collectionIterations![0]).toMatchObject({
      collection: 'values',
      mode: 'values',
      windowCursor: 'cursor',
      windowBound: 5,
    });
  });

  it('rejects a cursor that is not a bytes32 state variable', () => {
    expect(() => compileString(`
      contract Bad() {
        int cursor;
        enumerable mapping(bytes32 => int) values;
        function page() public {
          for (int v of this.values.window(cursor, 5)) {
            require(v >= 0);
          }
          require(true);
        }
      }
    `, { messageBus: false, suppressWarnings: true })).toThrow(/bytes32 state variable/);
  });
});
