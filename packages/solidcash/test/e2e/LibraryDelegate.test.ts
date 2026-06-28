import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { parsePushdataCommitment } from '@solidcash/utils';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';

// library-contracts 3b: a state-touching LIBRARY (docs/library-contracts.md) lowers to a delegate contract
// (auto-delegated public functions). This probes the consumer side: a proxy delegatecalls the library via the
// EXISTING delegatecall machinery (withDelegatecall), running the library's function against the PROXY's state.
// A library function written as plain Solidity (no `delegate` keyword) is the delegate impl.
const LIB = `pragma solidcash >=0.8.0;
library Counter {
  bigint counter;
  function increment() public { this.counter = this.counter + 1; }
}`;

const PROXY = `pragma solidcash >=0.8.0;
contract DelegatecallProxy() {
  bigint counter;
  function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
  fallback(bytes input) external {
    address impl = address(0x76a91489abcdefabbaabbaabbaabbaabbaabbaabbaabba88ac);
    impl.delegatecall(input);
    require(input.length > 0);
  }
}`;

describe('library-contracts 3b: consumer delegatecalls a state-touching library', () => {
  it('runs the library function against the proxy state via the existing delegatecall path', async () => {
    const provider = createTestProvider();
    const libArt = compileString(LIB);
    const proxyArt = compileString(PROXY);
    expect(libArt.isLibrary).toBe(true);

    const proxyContract = new Contract(proxyArt, [], { provider });
    const { categoryId: proxyCatId } = await setupStatefulUtxos(
      provider, proxyContract, proxyArt.stateLayout!, { counter: 0n }, { saltContract: true },
    );
    const libContract = new Contract(libArt, [], { provider });
    const { categoryId: libCatId } = await setupStatefulUtxos(
      provider, libContract, libArt.stateLayout!, { counter: 0n }, { saltContract: true },
    );

    const proxySc = StatefulContract.withCategory(proxyContract, proxyCatId);
    const libSc = StatefulContract.withCategory(libContract, libCatId);

    const tx = await proxySc.call.__fallback()
      .withDelegatecall(libSc, 'increment', [])
      .send();
    expect(tx.txid).toBeDefined();

    // The library's increment ran against the PROXY's state: proxy counter 0 -> 1.
    const proxyDataNft = getTxOutputs(tx).find(
      (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === proxyCatId,
    );
    expect(proxyDataNft).toBeDefined();
    const state = parsePushdataCommitment(proxyDataNft!.token!.nft!.commitment, proxyArt.stateLayout!, 0);
    expect(state.counter).toBe(1n);
  });
});
