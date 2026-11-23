import { hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * Two calls to one stored callee, the second through a local copy no write reaches before the call:
 * `IToken t = itoken; itoken.f(a); t.g(b);`. The copy holds the stored value there, so the call keeps the stored
 * target's local: the caller compiles to the bytes of `itoken.g(b)`, and both calls run as frames of one spend of the
 * callee's master, through its multi-call entry. A local of the copy's own would name a second callee, for which the
 * builder has no second master.
 */
const DIRECT = { forceStateful: true, messageBus: false, evmCompat: true, suppressWarnings: true } as const;

const source = (second: string): string => `pragma solidity ^0.8.0;
interface IToken {
  function f(uint256 v) external;
  function g(uint256 v) external;
}
contract Token {
  uint256 public seen;
  function f(uint256 v) public { seen = seen * 10 + v; require(true); }
  function g(uint256 v) public { seen = seen * 10 + v + 5; require(true); }
}
contract Holder {
  IToken itoken;
  function setUp(address token) public { itoken = IToken(token); require(true); }
  function both(uint256 a, uint256 b) public {
    IToken t = itoken;
    itoken.f(a);
    ${second}.g(b);
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;

async function deploy(
  provider: Provider, artifact: Artifact, state: Record<string, bigint>, externals?: Record<string, unknown>,
): Promise<any> {
  const base = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, base, artifact.stateLayout!, state, { saltContract: true },
  );
  return StatefulContract.withCategory(base, categoryId, externals && { externals: externals as any });
}

const lockOf = (contract: { inner: { lockingBytecode: string } }): Uint8Array => hexToBin(contract.inner.lockingBytecode);

/** The entries the inputs spending `contractName`'s master run, in input order. */
const masterSpends = (builder: TransactionBuilder, contractName: string): string[] => builder.inputs.flatMap(
  (input) => input.token?.nft?.capability === 'minting' && 'contract' in input.unlocker
    && input.unlocker.contract.artifact.contractName === contractName ? [input.unlocker.abiFunction.name] : [],
);

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('a call through a copy of a stored target that no write reaches before the call', () => {
  it('keeps the stored target\'s bytes and runs with the call through the stored target in one callee spend',
    async () => {
      const copied = compileStringMulti(source('t'), DIRECT);
      const direct = compileStringMulti(source('itoken'), DIRECT);
      expect({ bytecode: copied.Holder!.bytecode, bodies: copied.Holder!.functionBodies })
        .toEqual({ bytecode: direct.Holder!.bytecode, bodies: direct.Holder!.functionBodies });
      expect(copied.Holder!.abi.find((fn) => fn.name === 'both')!.externalCalls!.map((call) => call.callOrdinal))
        .toEqual([{ group: 0, ordinal: 0 }, { group: 0, ordinal: 1 }]);
      expect(copied.Token!.callBatch).toEqual({ selector: '53434442' });

      const provider = createTestProvider();
      const token = await deploy(provider, copied.Token!, { seen: 0n });
      const holder = await deploy(provider, copied.Holder!, {}, { IToken: token });
      await holder.call.setUp(lockOf(token)).send();

      // f(1), then g(2): the two frames of one spend of the token's master.
      const builder = await holder.call.both(1n, 2n).build() as TransactionBuilder;
      expect(masterSpends(builder, 'Token')).toEqual(['callBatch']);
      expect(vmAccepts(builder)).toBe(true);
      await holder.call.both(1n, 2n).send();
      expect((await token.getState()).seen).toBe(17n);
    }, 300_000);
});
