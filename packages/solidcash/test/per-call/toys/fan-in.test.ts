import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { hexOf, seededAddress } from '../shapes/harness.js';

/**
 * Fan-in: `Hub.go` approves `Vault` on `Token`, then calls `Vault.pull`, which calls `Token.transferFrom`. The
 * shipped per-call compiler refuses `Token.transferFrom`, whose allowance check reads the mapping before writing it.
 */

const TOKEN = hexOf(seededAddress('fan in token'));
const VAULT = hexOf(seededAddress('fan in vault'));
const HUB = hexOf(seededAddress('fan in hub'));

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IToken {'
  + '   function approve(address spender, int amount);'
  + '   function transferFrom(address holder, address recipient, int amount);'
  + ' }'
  + ' interface IPull { function pull(int amount); }'
  + ' contract Token {'
  + '   mapping(address => int) allowance;'
  + '   function approve(address spender, int amount) { this.allowance[spender] = amount; require(true); }'
  + '   function transferFrom(address holder, address recipient, int amount) {'
  + '     require(this.allowance[recipient] >= amount);'
  + '     this.allowance[recipient] = this.allowance[recipient] - amount;'
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Vault {'
  + `   function pull(int amount) { IToken(0x${TOKEN}).transferFrom(0x${HUB}, 0x${VAULT}, amount); require(true); }`
  + ' }'
  + ' contract Hub {'
  + `   function go(int amount) { IToken(0x${TOKEN}).approve(0x${VAULT}, amount);`
  + `     IPull(0x${VAULT}).pull(amount); require(true); }`
  + ' }';

/** The code and message the shipped compile raises, or a failure when it accepts the source. */
function compileRefusal(source: string): { readonly code?: string; readonly message: string } {
  try {
    compileStringMulti(source, { composition: 'per-call' });
  } catch (error) {
    const refusal = error as { code?: string; message: string };
    return { code: refusal.code, message: refusal.message };
  }
  throw new Error('the shipped per-call compiler accepted the source, so there is no refusal to record');
}

describe('a caller approving a vault that pulls through the token', () => {
  it('is refused today: the pull reads and writes the allowance mapping, which one master cannot derive', () => {
    const refusal = compileRefusal(SOURCE);
    expect(refusal.code).toBe('PER_CALL_CODEGEN_UNAVAILABLE');
    expect(refusal.message).toMatch(/the body writes a mapping at slot 0 as a read\/write/);
  });
});
