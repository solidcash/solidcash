import { describe, expect, it } from 'vitest';
import { Opcodes, decodeAuthenticationInstructions } from '@bitauth/libauth';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';

/**
 * A framed master's source map has one entry per instruction.
 *
 * The head, the sorted batch's derivation and the census counter are scripts a site emits whole. Emitted byte by
 * byte they gave every byte of a push its own entry, so the map ran ahead of the program past the first of them,
 * the optimiser's location bookkeeping and the published `require` positions with it, and a refusal report read
 * the wrong entry. Emitted as the instructions they decode to, the map covers the program exactly, save the zero
 * padding appended after the map is built.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   uint total;'
  + '   mapping(address => uint) balances;'
  + '   function transfer(address to, uint amount) {'
  + '     this.balances[msg.sender] = this.balances[msg.sender] - amount;'
  + '     this.balances[to] = this.balances[to] + amount;'
  + '   }'
  + '   function balanceOf(address who) view returns (uint) { return this.balances[who]; }'
  + ' }';

describe('a framed master\'s source map', () => {
  it('has one entry for every instruction before the trailing padding', () => {
    const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Ledger!;
    const instructions = decodeAuthenticationInstructions(scriptToBytecode(asmToScript(artifact.bytecode)));
    // The padding is a run of zero pushes, each dropped, appended once the map is built.
    let padding = 0;
    for (;;) {
      const drop = instructions[instructions.length - 1 - padding];
      const push = instructions[instructions.length - 2 - padding];
      const zeros = push !== undefined && 'data' in push && push.data.length > 0 && push.data.every((b) => b === 0);
      if (drop?.opcode !== Opcodes.OP_DROP || !zeros) break;
      padding += 2;
    }
    expect((artifact.debug?.sourceMap ?? '').split(';').length).toBe(instructions.length - padding);
  });
});
