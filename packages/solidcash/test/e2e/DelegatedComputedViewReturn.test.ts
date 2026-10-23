import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import type { DeployedContract } from '../../src/stateful/ContractFactory.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
  interface ISource { function read() external view returns (int); }
  contract Source {
    int public value;
    function read() public view returns (int) { return value; }
  }
  contract DirectFacade {
    address public source;
    function get() public view returns (int) { return ISource(source).read() + 1; }
  }
  contract Facade {
    address public source;
    function get() public delegate returns (int) { return ISource(source).read() + 1; }
  }`, { forceStateful: true, evmCompat: true, messageBus: true,
  messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
  suppressWarnings: true, optimizeForCompilationSpeed: true });

async function fixture(): Promise<{ signer: Signer; source: DeployedContract }> {
  const provider = createMessageBusCapstoneTestProvider();
  const signer = new Signer(new Uint8Array(32).fill(0x71), provider);
  for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
    txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
  });
  const source = await getContractFactory(artifacts.Source, signer).deploy({ initialState: { value: 41n } });
  return { signer, source };
}

describe('computed external view return layout', () => {
  it('reads a computed foreign return from a direct owner', async () => {
    const { signer, source } = await fixture();
    const facade = await getContractFactory(artifacts.DirectFacade, signer).deploy({
      initialState: { source: source.address },
    });
    facade._registerResolvedExternal('ISource', source);
    expect(await facade.call.get().staticCall()).toBe(42n);
  }, 180_000);

  it('reads a computed foreign return from a delegated proxy owner', async () => {
    const { signer, source } = await fixture();
    const facade = await upgrades.deployProxy(getContractFactory(artifacts.Facade, signer), {
      source: source.address,
    });
    facade.implementation._registerResolvedExternal('ISource', source);
    expect(await facade.forward('get', []).staticCall()).toBe(42n);
  }, 180_000);
});
