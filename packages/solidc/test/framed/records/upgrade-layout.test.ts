/**
 * Section 20: the proxy-upgrade layout rule at compile time (plan 4.7).
 *
 * `upgradesFrom` names, per contract, the layout of the implementation it replaces behind a framed proxy. The
 * replacement must read every record the old code wrote the same way: each field by name, type and coordinates,
 * each struct it reaches field for field, each collection by signature and value form. A framed record is minted
 * only at genesis, so an append has no record behind the proxy and is refused too. Each refusal names what stops
 * it, beside the compatible replacement that compiles.
 */
import { describe, it, expect } from 'vitest';
import { compileStringMulti } from '../../../src/compiler.js';
import { SolidcDiagnosticError } from '../../../src/Errors.js';

const V1 = 'pragma solidcash ^0.14.0;'
  + ' struct Pos { int x; int y; }'
  + ' contract Vault {'
  + '   int public total; int public deposits; Pos public pos; bytes32 external note;'
  + '   mapping(address => int) balances;'
  + '   function deposit(int by) { this.total = this.total + by; this.deposits = this.deposits + 1; }'
  + ' }';
const reference = compileStringMulti(V1, { composition: 'framed' }).Vault!.stateLayout!;

/** A replacement named `Next`, with the given struct and declarations, compiled against the old layout. */
function next(struct: string, body: string): ReturnType<typeof compileStringMulti> {
  return compileStringMulti(
    `pragma solidcash ^0.14.0; struct Pos { ${struct} } contract Next { ${body}`
    + ' function deposit(int by) { this.deposits = this.deposits + by; } }',
    { composition: 'framed', upgradesFrom: { Next: reference } },
  );
}

const STRUCT = 'int x; int y;';
const FIELDS = 'int public total; int public deposits; Pos public pos; bytes32 external note;';
const MAPPING = 'mapping(address => int) balances;';

/** The refusal a compile raises, as its code and message. */
function refusal(compile: () => unknown): { code: string; message: string } {
  try {
    compile();
  } catch (error) {
    if (error instanceof SolidcDiagnosticError) return { code: error.code, message: error.message };
    throw error;
  }
  throw new Error('the compile was not refused');
}

describe('section 20 proxy-upgrade layout rule, at compile time', () => {
  it('compiles a replacement that keeps every record, with new code', () => {
    const compiled = next(STRUCT, `${FIELDS} ${MAPPING}`).Next!;
    expect(compiled.stateLayout!.variables).toStrictEqual(reference.variables);
  });

  it.each([
    ['a reordered field', STRUCT, `int public deposits; int public total; Pos public pos; bytes32 external note; ${MAPPING}`,
      'state variable "total" moves from data NFT 0 field 0 to data NFT 0 field 1'],
    ['a retyped field', STRUCT, `uint public total; int public deposits; Pos public pos; bytes32 external note; ${MAPPING}`,
      'state variable "total" changes type from int256 to uint256'],
    ['a renamed struct field', 'int x; int z;', `${FIELDS} ${MAPPING}`,
      'struct "Pos" field 1 changes from "y" to "z"'],
    ['a retyped struct field, which moves the field holding it', 'int x; bool y;', `${FIELDS} ${MAPPING}`,
      'state variable "pos" moves from data NFT 1 field 0'],
    ['an appended field', STRUCT, `${FIELDS} int public extra; ${MAPPING}`,
      'adds state variable "extra"'],
    ['a retyped mapping value', STRUCT, `${FIELDS} mapping(address => uint) balances;`,
      'collection "balances" changes its'],
  ])('refuses %s by name', (_what, struct, body, named) => {
    const refused = refusal(() => next(struct, body));
    expect(refused.code).toBe('FRAMED_UPGRADE_LAYOUT');
    expect(refused.message).toContain('"Next" cannot replace the implementation it upgrades');
    expect(refused.message).toContain(named);
  });
});
