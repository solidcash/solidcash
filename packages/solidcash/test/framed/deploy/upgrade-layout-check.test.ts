import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { buildProxyArtifact, requireFramedUpgrade } from '../../../src/framed/proxy/index.js';

/**
 * The SDK half of the proxy-upgrade layout rule (spec 20, plan 4.7).
 *
 * Before an upgrade behind a proxy is built, the new implementation is checked against the records the proxy holds,
 * by name: the layout rule against the implementation the proxy fronts now, a selector an entry of the proxy's own
 * would capture, and a returned value the deployed fallback cannot carry. Each refusal sits beside the replacement
 * the same proxy accepts.
 */

const FIELDS = ' int public total; int public deposits; bytes32 external note;';
const DEPOSIT = ' function deposit(int by) returns (int) {'
  + ' this.total = this.total + by; this.deposits = this.deposits + 1; require(this.total >= 0); return this.total; }';
const FALLBACK = ' fallback(bytes input) external returns (bytes) { (bool ok, bytes returned) = '
  + 'this.implementation.delegatecall(input); require(ok); return returned; }';
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ` contract Vault {${FIELDS}${DEPOSIT} }`
  + ` contract VaultV2 {${FIELDS}`
  + '   function deposit(int by) returns (int) {'
  + '     this.total = this.total + 2 * by; this.deposits = this.deposits + 1; require(this.total >= 0);'
  + '     return this.total;'
  + '   }'
  + ' }'
  // `total` retyped: its record bytes would be read as another type.
  + ' contract VaultRetyped { uint public total; int public deposits; bytes32 external note;'
  + '   function deposit(uint by) returns (uint) { this.total = this.total + by; return this.total; } }'
  // The same fields reordered: `total` would be read from the field `deposits` was written to.
  + ' contract VaultReordered { int public deposits; int public total; bytes32 external note;'
  + '   function deposit(int by) returns (int) { this.total = this.total + by; return this.total; } }'
  // No entry returns a value, so the proxy generated for it forwards through a fallback that carries none.
  + ` contract VaultQuiet {${FIELDS}`
  + '   function deposit(int by) { this.total = this.total + by; require(this.total >= 0); } }'
  // A hand-written proxy serving an entry of its own beside the fallback, and an implementation sharing its selector.
  + ` contract VaultPingProxy {${FIELDS} address external implementation;`
  + `   function ping() { require(this.deposits >= 0); }${FALLBACK} }`
  + ` contract VaultPing {${FIELDS}${DEPOSIT} function ping() { require(this.total >= 0); } }`;

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const v1 = artifacts.Vault!;
const proxy = buildProxyArtifact(v1);

describe('the SDK check before an upgrade behind a framed proxy', () => {
  it('accepts a replacement that keeps every record, with new code', () => {
    expect(() => requireFramedUpgrade(proxy, v1, artifacts.VaultV2!)).not.toThrow();
  });

  it.each([
    ['a retyped field', 'VaultRetyped', 'state variable "total" changes type from int256 to uint256'],
    ['a reordered field', 'VaultReordered', 'state variable "total" moves from data NFT 0 field 0 to data NFT 0 field 1'],
  ])('refuses %s by name', (_what, contract, named) => {
    expect(() => requireFramedUpgrade(proxy, v1, artifacts[contract]!))
      .toThrow(`cannot upgrade proxy "VaultProxy" to "${contract}": ${named}`);
  });

  it('refuses a current implementation the proxy\'s records do not agree with', () => {
    expect(() => requireFramedUpgrade(proxy, artifacts.VaultReordered!, artifacts.VaultV2!))
      .toThrow(/"VaultReordered" is not the implementation its records agree with/);
  });

  it('refuses a returned value the deployed fallback cannot carry', () => {
    const quiet = artifacts.VaultQuiet!;
    const quietProxy = buildProxyArtifact(quiet);
    expect(() => requireFramedUpgrade(quietProxy, quiet, quiet)).not.toThrow();
    expect(() => requireFramedUpgrade(quietProxy, quiet, artifacts.VaultV2!))
      .toThrow(/entry "deposit" returns a value, and the proxy's fallback carries no result/);
  });

  it('refuses an entry whose selector an entry of the proxy\'s own would capture', () => {
    const pingProxy = artifacts.VaultPingProxy!;
    expect(() => requireFramedUpgrade(pingProxy, v1, artifacts.VaultV2!)).not.toThrow();
    expect(() => requireFramedUpgrade(pingProxy, v1, artifacts.VaultPing!))
      .toThrow(/entry "ping" has the selector of the proxy's own "ping"/);
  });
});
