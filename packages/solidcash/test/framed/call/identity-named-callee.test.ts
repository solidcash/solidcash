import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { validatorAddress } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import {
  buildProxyArtifact, callFramedProxyEntry, deployFramedProxy, type FramedProxyCallResult,
} from '../../../src/framed/proxy/index.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import type { Utxo } from '../../../src/interfaces.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPkh } from '../../fixture/vars.js';
import { VALIDATOR_PROGRAM, fundShippedFacets } from '../shapes/harness.js';

/**
 * Addresses read back through a call result and passed on as call arguments.
 *
 * `Root.pay` (behind a generated proxy) reads `Directory.entry()`, a Solidity ABI struct holding a token's address
 * and two payees, and passes the token and one payee on to `Relay.send`, which calls `IToken(token).credit(to, n)`.
 * A Solidity ABI word carries an address as its 20-byte identity, and the root's body holds a value it reads back
 * that way as the identity (DECISIONS D13): the token's is the HASH160 of its P2SH32 lock, a key's its public key
 * hash. The relay's call data carries the lock each identity names, which the root's call site binds to the
 * identity: the token's own address, so the relay calls the token at it, and a payee's own lock, a contract's as
 * much as a key's, so the token credits the payee's own balance. The hop used to state a P2PKH lock for the token's
 * identity, which no contract sits at, and refused the credit call.
 */

/** A 32-byte value with varied bytes, `seed` chosen so each name is distinct. */
function category(seed: string): string {
  const base = '5d6e7f8091a2b3c4d5e6f708192a3b4';
  return `${seed}${base}${base}`.slice(0, 64);
}

const TOKEN_CATEGORY = category('0b');
const DIRECTORY_CATEGORY = category('1c');
const RELAY_CATEGORY = category('2d');
const ROOT_IMPL_CATEGORY = category('3e');
const ROOT_PROXY_CATEGORY = category('4f');
const ROOT_INIT_TXID = category('50');

const AMOUNT = 5n;
const ALICE_LOCK = encodeLockingBytecodeP2pkh(alicePkh);
/** A key's lock, and a contract's: the directory's own address. */
const KEY_PAYEE = encodeLockingBytecodeP2pkh(bobPkh);

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'struct Entry { address token; address keyPayee; address contractPayee; uint256 amount; }',
  'interface IDirectory { function entry() external view returns (Entry memory); }',
  'interface IRelay { function send(address to, uint256 amount, address token) external; }',
  'interface IToken { function credit(address to, uint256 amount) external returns (bool); }',
  'contract Token {',
  '  mapping(address => uint256) public balanceOf;',
  '  function credit(address to, uint256 amount) external returns (bool) {',
  '    balanceOf[to] += amount;',
  '    return true;',
  '  }',
  '}',
  'contract Directory {',
  '  address public token;',
  '  address public keyPayee;',
  '  address public contractPayee;',
  '  constructor(address token_, address keyPayee_, address contractPayee_) {',
  '    token = token_; keyPayee = keyPayee_; contractPayee = contractPayee_;',
  '  }',
  '  function entry() external view returns (Entry memory) {',
  `    return Entry(token, keyPayee, contractPayee, ${AMOUNT});`,
  '  }',
  '}',
  'contract Relay {',
  '  uint256 public sends;',
  '  function send(address to, uint256 amount, address token) external { IToken(token).credit(to, amount); }',
  '}',
  'contract Root {',
  '  address public implementation;',
  '  address public directory;',
  '  address public relay;',
  '  function initialize(address directory_, address relay_) public { directory = directory_; relay = relay_; }',
  '  function pay(uint256 which) public {',
  '    Entry memory e = IDirectory(directory).entry();',
  '    IRelay(relay).send(which == 0 ? e.keyPayee : e.contractPayee, e.amount, e.token);',
  '  }',
  '}',
].join('\n');

/** Solidity-import compile options, under which a call result crosses the boundary as a Solidity ABI tuple. */
const FIXTURE_OPTIONS = {
  evmCompat: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  messageBus: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  ecrecover: 'p2pkh',
  sortedMappingsAll: false,
  composition: 'framed',
} as const;

const compiled = compileStringMulti(SOURCE, FIXTURE_OPTIONS as never);
const { Token, Directory, Relay, Root } = compiled as Required<typeof compiled>;

/** A framed contract's address, which its category fixes before anything is deployed. */
const addressOf = (id: string): Uint8Array => validatorAddress(hexToBin(id), VALIDATOR_PROGRAM);
const CONTRACT_PAYEE = addressOf(DIRECTORY_CATEGORY);

/** A coin a genesis or a hop is funded from; a genesis's txid becomes the category it mints. */
function funding(txid: string): Utxo {
  return { txid, vout: 0, satoshis: 5_000_000n };
}

describe('addresses read back through a call result and passed on as call arguments', () => {
  it('reach the token at its own address and credit each payee\'s own lock, a key\'s or a contract\'s', async () => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    const funder = wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
    const changeAddress = wallet.address;
    const callerFunder = new SignatureTemplate(alicePriv).unlockP2PKH();
    const plain = [
      [Token, TOKEN_CATEGORY, []],
      [Directory, DIRECTORY_CATEGORY, [addressOf(TOKEN_CATEGORY), KEY_PAYEE, CONTRACT_PAYEE]],
      [Relay, RELAY_CATEGORY, []],
    ] as const;
    for (const [artifact, id, args] of plain) {
      await network.addUtxo(wallet.address, funding(id));
      await deployStatefulContract(artifact!, [...args], {
        fundingUtxo: funding(id), funder, changeAddress, provider: network,
      });
    }
    for (const id of [ROOT_IMPL_CATEGORY, ROOT_PROXY_CATEGORY]) await network.addUtxo(wallet.address, funding(id));
    await network.addUtxo(binToHex(ALICE_LOCK), funding(ROOT_INIT_TXID));
    await fundShippedFacets(network);
    const root = await deployFramedProxy({
      provider: network,
      implementationArtifact: Root!,
      proxyArtifact: buildProxyArtifact(Root!),
      implementationDeploy: { fundingUtxo: funding(ROOT_IMPL_CATEGORY), funder, changeAddress },
      proxyDeploy: { fundingUtxo: funding(ROOT_PROXY_CATEGORY), funder, changeAddress },
      initialize: { functionName: 'initialize', args: [addressOf(DIRECTORY_CATEGORY), addressOf(RELAY_CATEGORY)] },
      callerLockingBytecode: ALICE_LOCK,
      callerFunding: { utxo: funding(ROOT_INIT_TXID), funder: callerFunder, changeAddress },
      vm: compositionMachine(),
    });
    expect(root.initialize.broadcast).toBeDefined();

    let coins = 0x60;
    const pay = async (which: bigint): Promise<FramedProxyCallResult> => {
      coins += 1;
      const coin = funding(category(coins.toString(16)));
      await network.addUtxo(binToHex(ALICE_LOCK), coin);
      return callFramedProxyEntry({
        provider: network,
        implementationArtifact: Root!,
        proxyArtifact: buildProxyArtifact(Root!),
        proxyCategoryId: root.proxy.categoryId,
        implementationCategoryId: root.implementation.categoryId,
        functionName: 'pay',
        args: [which],
        externals: {
          IDirectory: { artifact: Directory!, categoryId: DIRECTORY_CATEGORY },
          IRelay: { artifact: Relay!, categoryId: RELAY_CATEGORY },
          IToken: { artifact: Token!, categoryId: TOKEN_CATEGORY },
        },
        callerUtxo: coin,
        callerLockingBytecode: ALICE_LOCK,
        funder: callerFunder,
        changeAddress,
        vm: compositionMachine(),
      });
    };
    const balanceOf = async (who: Uint8Array): Promise<unknown> => (await readFramedEntry({
      provider: network, artifact: Token!, categoryId: TOKEN_CATEGORY, functionName: 'balanceOf', args: [who],
      vm: compositionMachine(),
    })).value;

    for (const [which, payee] of [[0n, KEY_PAYEE], [1n, CONTRACT_PAYEE]] as const) {
      const result = await pay(which);
      expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
      expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
      // The relay received the token's own address, and called it there.
      const relay = result.completed.find((frame) => frame.functionName === 'Relay.send()')!;
      expect(result.draft.blockOf(relay.master).calls.map((call) => binToHex(call.target)))
        .toStrictEqual([binToHex(addressOf(TOKEN_CATEGORY))]);
      expect(await balanceOf(payee)).toBe(AMOUNT);
    }
  });
});
