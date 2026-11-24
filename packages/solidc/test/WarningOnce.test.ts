import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// A modifier is inlined into every entry it guards, so one `revert` site is visited once per entry.
const SOURCE = `pragma solidcash ^0.52.0;
error Paused();
contract Card {
    bool public paused;
    uint256 public count;
    modifier whenOpen() {
        if (this.paused) revert Paused();
        _;
    }
    function a() whenOpen { this.count += 1; }
    function b() whenOpen { this.count += 2; }
}`;

describe('compiler warnings', () => {
  it('prints a warning once per source site, however many entries inline it', () => {
    const warnings: string[] = [];
    compileString(SOURCE, { warningListener: (warning) => { warnings.push(warning.message); } });
    const reverts = warnings.filter((message) => message.includes('revert with a custom error fails the spend'));
    expect(reverts).toHaveLength(1);
    expect(reverts[0]).toContain('at line 7');
  });
});
