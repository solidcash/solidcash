import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../src/compiler.js';

describe('interface declaration metadata', () => {
  const source = `pragma solidity ^0.8.20;
    error FileOnly();
    event FileEvent();
    interface IAlerts {
      error TooSmall(uint256 supplied, uint256 required);
      event Changed(address indexed owner, uint256 value);
    }
    interface IUnrelated { error Unrelated(bool flag); }
  `;

  it('keeps interface-owned errors and indexed events in declaration-only multi output', () => {
    const artifacts = compileStringMulti(source, { evmCompat: true, compileDeclarations: [] });
    expect(artifacts.IAlerts).toMatchObject({
      isLibrary: true, bytecode: '',
      errors: [{ name: 'TooSmall', signature: 'TooSmall(uint256,uint256)', parameters: [
        { name: 'supplied', type: 'uint256' }, { name: 'required', type: 'uint256' },
      ] }],
      events: [{ name: 'Changed', signature: 'Changed(address,uint256)', parameters: [
        { name: 'owner', type: 'address', indexed: true }, { name: 'value', type: 'uint256' },
      ] }],
    });
    expect(artifacts.IUnrelated.errors?.map((entry) => entry.name)).toEqual(['Unrelated']);
    expect(artifacts.IUnrelated.events).toBeUndefined();
  });

  it('does not duplicate interface metadata after semantic registration in single output', () => {
    const artifact = compileString(source.slice(0, source.indexOf('interface IUnrelated')),
      { evmCompat: true });
    expect(artifact.errors?.map((entry) => entry.signature)).toEqual(['TooSmall(uint256,uint256)']);
    expect(artifact.events?.map((entry) => entry.signature)).toEqual(['Changed(address,uint256)']);
  });

  it('includes inherited declarations once across a diamond without leaking unrelated file declarations', () => {
    const artifacts = compileStringMulti(`${source}
      interface ILeft is IAlerts {}
      interface IRight is IAlerts {}
      interface ILeaf is ILeft, IRight { error LeafOnly(); }
    `, { evmCompat: true, compileDeclarations: [] });
    expect(artifacts.ILeaf.errors?.map((entry) => entry.signature)).toEqual([
      'LeafOnly()', 'TooSmall(uint256,uint256)',
    ]);
    expect(artifacts.ILeaf.events?.map((entry) => entry.signature)).toEqual(['Changed(address,uint256)']);
  });
});
