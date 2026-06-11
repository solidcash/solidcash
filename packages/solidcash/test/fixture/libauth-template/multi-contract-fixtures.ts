import { TransactionBuilder, Contract, MockNetworkProvider, SignatureTemplate, randomNFT, randomToken, randomUtxo } from '../../../src/index.js';
import BarArtifact from '../Bar.artifact.js';
import FooArtifact from '../Foo.artifact.js';
import twtArtifact from '../transfer_with_timeout.artifact.js';
import hodlVaultArtifact from '../hodl_vault.artifact.js';
import { aliceAddress, alicePkh, alicePriv, alicePub, aliceTokenAddress, bobPkh, bobPriv, bobPub, carolPriv, carolPub, oracle, oraclePub } from '../vars.js';
import { WalletTemplate } from '@bitauth/libauth';

const provider = new MockNetworkProvider();

export interface Fixture {
  name: string;
  transaction: Promise<TransactionBuilder>;
  template: WalletTemplate;
}

export const fixtures: Fixture[] = [
  {
    name: 'Foo + Bar + P2PKH UTXOs',
    transaction: (async () => {
      // TODO: Foo contract is just P2PKH contract with extra log, see if we can use P2PKH contract instead
      const fooContract = new Contract(FooArtifact, [bobPkh], { provider });
      await provider.addUtxo(fooContract.address, randomUtxo());

      const tokenA = randomToken({ amount: 100000000n });
      const nftB = randomNFT({
        nft: {
          capability: 'minting',
          commitment: '00',
        },
      });

      const barContract = new Contract(BarArtifact, [alicePkh], { provider });
      await provider.addUtxo(barContract.address, randomUtxo());
      await provider.addUtxo(barContract.address, randomUtxo());
      await provider.addUtxo(barContract.address, randomUtxo());

      const aliceTemplate = new SignatureTemplate(alicePriv);
      await provider.addUtxo(aliceAddress, randomUtxo());
      await provider.addUtxo(aliceAddress, randomUtxo({ token: tokenA }));
      await provider.addUtxo(aliceAddress, randomUtxo({ token: nftB }));

      const bobTemplate = new SignatureTemplate(bobPriv);

      const utxos = await provider.getUtxos(aliceAddress);
      const fooContractUtxos = await fooContract.getUtxos();
      const barContractUtxos = await barContract.getUtxos();

      return new TransactionBuilder({ provider })
        .addInputs([utxos[0], utxos[1], utxos[2]], aliceTemplate.unlockP2PKH())
        .addInput(barContractUtxos[0], barContract.unlock.funcA())
        .addInput(barContractUtxos[1], barContract.unlock.execute(alicePub, aliceTemplate))
        .addInput(fooContractUtxos[0], fooContract.unlock.execute(bobPub, bobTemplate))
        .addInput(barContractUtxos[2], barContract.unlock.funcB())
        .addOutput({ to: fooContract.address, amount: 8000n })
        .addOutput({ to: aliceTokenAddress, amount: 800n, token: tokenA })
        .addOutput({ to: aliceTokenAddress, amount: 1000n, token: nftB })
        .addOpReturnOutput(['hello', 'world']);

    })(),
    template: {
      '$schema': 'https://ide.bitauth.com/authentication-template-v0.schema.json',
      'description': 'Imported from solidcash',
      'name': 'SolidCash Generated Debugging Template',
      'supported': [
        'BCH_2026_05',
      ],
      'version': 0,
      'entities': {
        'signer_0': {
          'scripts': [
            'p2pkh_placeholder_lock_0',
            'p2pkh_placeholder_unlock_0',
          ],
          'description': 'P2PKH data for input 0',
          'name': 'P2PKH Signer (input #0)',
          'variables': {
            'signature_0': {
              'description': '',
              'name': 'P2PKH Signature (input #0)',
              'type': 'WalletData',
            },
            'public_key_0': {
              'description': '',
              'name': 'P2PKH public key (input #0)',
              'type': 'WalletData',
            },
          },
        },
        'signer_1': {
          'scripts': [
            'p2pkh_placeholder_lock_1',
            'p2pkh_placeholder_unlock_1',
          ],
          'description': 'P2PKH data for input 1',
          'name': 'P2PKH Signer (input #1)',
          'variables': {
            'signature_1': {
              'description': '',
              'name': 'P2PKH Signature (input #1)',
              'type': 'WalletData',
            },
            'public_key_1': {
              'description': '',
              'name': 'P2PKH public key (input #1)',
              'type': 'WalletData',
            },
          },
        },
        'signer_2': {
          'scripts': [
            'p2pkh_placeholder_lock_2',
            'p2pkh_placeholder_unlock_2',
          ],
          'description': 'P2PKH data for input 2',
          'name': 'P2PKH Signer (input #2)',
          'variables': {
            'signature_2': {
              'description': '',
              'name': 'P2PKH Signature (input #2)',
              'type': 'WalletData',
            },
            'public_key_2': {
              'description': '',
              'name': 'P2PKH public key (input #2)',
              'type': 'WalletData',
            },
          },
        },
        'Bar_input3_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'Bar (input #3)',
          'scripts': [
            'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
            'Bar_funcA_input3_unlock',
          ],
          'variables': {
            'pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'Bar_body_input3_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'Bar funcA body (input #3)',
          'scripts': [
            'Bar_funcA_body_lock',
            'Bar_funcA_body_input3_unlock',
          ],
          'variables': {
            'body_pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
          },
        },
        'Bar_input4_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'Bar (input #4)',
          'scripts': [
            'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
            'Bar_execute_input4_unlock',
          ],
          'variables': {
            'pk': {
              'description': '"pk" parameter of function "execute"',
              'name': 'pk',
              'type': 'WalletData',
            },
            's': {
              'description': '"s" parameter of function "execute"',
              'name': 's',
              'type': 'WalletData',
            },
            'pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'Bar_body_input4_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'Bar execute body (input #4)',
          'scripts': [
            'Bar_execute_body_lock',
            'Bar_execute_body_input4_unlock',
          ],
          'variables': {
            'body_pk': {
              'description': '"pk" parameter of function "execute"',
              'name': 'pk',
              'type': 'WalletData',
            },
            'body_s': {
              'description': '"s" parameter of function "execute"',
              'name': 's',
              'type': 'Key',
            },
            'body_pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
          },
        },
        'Foo_input5_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'Foo (input #5)',
          'scripts': [
            'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
            'Foo_execute_input5_unlock',
          ],
          'variables': {
            'pk': {
              'description': '"pk" parameter of function "execute"',
              'name': 'pk',
              'type': 'WalletData',
            },
            's': {
              'description': '"s" parameter of function "execute"',
              'name': 's',
              'type': 'Key',
            },
            'pkh_foo': {
              'description': '"pkh_foo" parameter of this contract',
              'name': 'pkh_foo',
              'type': 'WalletData',
            },
          },
        },
        'Bar_input6_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'Bar (input #6)',
          'scripts': [
            'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
            'Bar_funcB_input6_unlock',
          ],
          'variables': {
            'pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'Bar_body_input6_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'Bar funcB body (input #6)',
          'scripts': [
            'Bar_funcB_body_lock',
            'Bar_funcB_body_input6_unlock',
          ],
          'variables': {
            'body_pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
          },
        },
      },
      'scripts': {
        'p2pkh_placeholder_unlock_0': {
          'passes': [
            'P2PKH_spend_input0_evaluate',
          ],
          'name': 'P2PKH Unlock (input #0)',
          'script': '<signature_0>\n<public_key_0>',
          'unlocks': 'p2pkh_placeholder_lock_0',
        },
        'p2pkh_placeholder_lock_0': {
          'lockingType': 'standard',
          'name': 'P2PKH Lock (input #0)',
          'script': 'OP_DUP\nOP_HASH160 <$(<public_key_0> OP_HASH160\n)> OP_EQUALVERIFY\nOP_CHECKSIG',
        },
        'p2pkh_placeholder_unlock_1': {
          'passes': [
            'P2PKH_spend_input1_evaluate',
          ],
          'name': 'P2PKH Unlock (input #1)',
          'script': '<signature_1>\n<public_key_1>',
          'unlocks': 'p2pkh_placeholder_lock_1',
        },
        'p2pkh_placeholder_lock_1': {
          'lockingType': 'standard',
          'name': 'P2PKH Lock (input #1)',
          'script': 'OP_DUP\nOP_HASH160 <$(<public_key_1> OP_HASH160\n)> OP_EQUALVERIFY\nOP_CHECKSIG',
        },
        'p2pkh_placeholder_unlock_2': {
          'passes': [
            'P2PKH_spend_input2_evaluate',
          ],
          'name': 'P2PKH Unlock (input #2)',
          'script': '<signature_2>\n<public_key_2>',
          'unlocks': 'p2pkh_placeholder_lock_2',
        },
        'p2pkh_placeholder_lock_2': {
          'lockingType': 'standard',
          'name': 'P2PKH Lock (input #2)',
          'script': 'OP_DUP\nOP_HASH160 <$(<public_key_2> OP_HASH160\n)> OP_EQUALVERIFY\nOP_CHECKSIG',
        },
        'Bar_funcA_input3_unlock': {
          'passes': [
            'Bar_funcA_input3_evaluate',
          ],
          'name': 'funcA (input #3)',
          'script': '// function selector\n<function_index> // bytes4 = <0xb8f031f1>\n\n// "funcA" function parameters\n// none\n',
          'unlocks': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
        },
        'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock': {
          'lockingType': 'p2sh32',
          'name': 'Bar',
          'script': '// "Bar" contract constructor parameters\n<pkh_bar> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>\n\n// bytecode\n                                                                       /* pragma solidcash >=0.10.2;                             */\n                                                                       /*                                                        */\n                                                                       /* contract Bar(bytes20 pkh_bar) {                        */\n<0x52529c77> <0xb8f031f1> OP_DEFINE                                    /*     function funcA() {                                 */\n                                                                       /*         require(2==2);                                 */\n                                                                       /*     }                                                  */\n                                                                       /*                                                        */\n<0x52529c77> <0xe1516928> OP_DEFINE                                    /*     function funcB() {                                 */\n                                                                       /*         require(2==2);                                 */\n                                                                       /*     }                                                  */\n                                                                       /*                                                        */\n<0x78a988ac> <0x53f23b6b> OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE /*     function execute(pubkey pk, sig s) {               */\n                                                                       /*         console.log("Bar \'execute\' function called."); */\n                                                                       /*         require(hash160(pk) == pkh_bar);               */\n                                                                       /*         require(checkSig(s, pk));                      */\n                                                                       /*     }                                                  */\n                                                                       /* }                                                      */\n                                                                       /*                                                        */',
        },
        'Bar_funcA_body_lock': {
          'lockingType': 'standard',
          'name': 'Bar funcA (function body)',
          'script': '                      /* pragma solidcash >=0.10.2;                             */\n                      /*                                                        */\n                      /* contract Bar(bytes20 pkh_bar) {                        */\n                      /*     function funcA() {                                 */\nOP_2 OP_2 OP_NUMEQUAL /*         require(2==2);                                 */\nOP_NIP                /*     }                                                  */\n                      /*                                                        */\n                      /*     function funcB() {                                 */\n                      /*         require(2==2);                                 */\n                      /*     }                                                  */\n                      /*                                                        */\n                      /*     function execute(pubkey pk, sig s) {               */\n                      /*         console.log("Bar \'execute\' function called."); */\n                      /*         require(hash160(pk) == pkh_bar);               */\n                      /*         require(checkSig(s, pk));                      */\n                      /*     }                                                  */\n                      /* }                                                      */\n                      /*                                                        */',
        },
        'Bar_funcA_body_input3_unlock': {
          'passes': [
            'Bar_funcA_body_input3_evaluate',
          ],
          'name': 'funcA body (input #3)',
          'script': '// "funcA" function parameters\n// none\n\n// "Bar" constructor parameters\n<body_pkh_bar> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>',
          'unlocks': 'Bar_funcA_body_lock',
        },
        'Bar_execute_input4_unlock': {
          'passes': [
            'Bar_execute_input4_evaluate',
          ],
          'name': 'execute (input #4)',
          'script': expect.stringContaining('// "execute" function parameters\n<s> // sig = <0x'),
          'unlocks': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
        },
        'Bar_execute_body_lock': {
          'lockingType': 'standard',
          'name': 'Bar execute (function body)',
          'script': '                                  /* pragma solidcash >=0.10.2;                             */\n                                  /*                                                        */\n                                  /* contract Bar(bytes20 pkh_bar) {                        */\n                                  /*     function funcA() {                                 */\n                                  /*         require(2==2);                                 */\n                                  /*     }                                                  */\n                                  /*                                                        */\n                                  /*     function funcB() {                                 */\n                                  /*         require(2==2);                                 */\n                                  /*     }                                                  */\n                                  /*                                                        */\n                                  /*     function execute(pubkey pk, sig s) {               */\n                                  /*         console.log("Bar \'execute\' function called."); */\nOP_OVER OP_HASH160 OP_EQUALVERIFY /*         require(hash160(pk) == pkh_bar);               */\nOP_CHECKSIG                       /*         require(checkSig(s, pk));                      */\n                                  /*     }                                                  */\n                                  /* }                                                      */\n                                  /*                                                        */',
        },
        'Bar_execute_body_input4_unlock': {
          'passes': [
            'Bar_execute_body_input4_evaluate',
          ],
          'name': 'execute body (input #4)',
          'script': '// "execute" function parameters\n<body_s.schnorr_signature.all_outputs_all_utxos> // sig\n<body_pk> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n\n// "Bar" constructor parameters\n<body_pkh_bar> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>',
          'unlocks': 'Bar_execute_body_lock',
        },
        'Foo_execute_input5_unlock': {
          'passes': [
            'Foo_execute_input5_evaluate',
          ],
          'name': 'execute (input #5)',
          'script': '// "execute" function parameters\n<s.schnorr_signature.all_outputs_all_utxos> // sig\n<pk> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>\n',
          'unlocks': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
        },
        'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock': {
          'lockingType': 'p2sh32',
          'name': 'Foo',
          'script': '// "Foo" contract constructor parameters\n<pkh_foo> // bytes20 = <0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0>\n\n// bytecode\n                                  /* pragma solidcash >=0.10.2;                                   */\n                                  /*                                                              */\n                                  /* contract Foo(bytes20 pkh_foo) {                              */\n                                  /*     // Require pk to match stored pkh and signature to match */\n                                  /*     function execute(pubkey pk, sig s) {                     */\n                                  /*         console.log("Foo \'execute\' function called.");       */\nOP_OVER OP_HASH160 OP_EQUALVERIFY /*         require(hash160(pk) == pkh_foo);                     */\nOP_CHECKSIG                       /*         require(checkSig(s, pk));                            */\n                                  /*     }                                                        */\n                                  /* }                                                            */\n                                  /*                                                              */',
        },
        'Bar_funcB_input6_unlock': {
          'passes': [
            'Bar_funcB_input6_evaluate',
          ],
          'name': 'funcB (input #6)',
          'script': '// function selector\n<function_index> // bytes4 = <0xe1516928>\n\n// "funcB" function parameters\n// none\n',
          'unlocks': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
        },
        'Bar_funcB_body_lock': {
          'lockingType': 'standard',
          'name': 'Bar funcB (function body)',
          'script': '                      /* pragma solidcash >=0.10.2;                             */\n                      /*                                                        */\n                      /* contract Bar(bytes20 pkh_bar) {                        */\n                      /*     function funcA() {                                 */\n                      /*         require(2==2);                                 */\n                      /*     }                                                  */\n                      /*                                                        */\n                      /*     function funcB() {                                 */\nOP_2 OP_2 OP_NUMEQUAL /*         require(2==2);                                 */\nOP_NIP                /*     }                                                  */\n                      /*                                                        */\n                      /*     function execute(pubkey pk, sig s) {               */\n                      /*         console.log("Bar \'execute\' function called."); */\n                      /*         require(hash160(pk) == pkh_bar);               */\n                      /*         require(checkSig(s, pk));                      */\n                      /*     }                                                  */\n                      /* }                                                      */\n                      /*                                                        */',
        },
        'Bar_funcB_body_input6_unlock': {
          'passes': [
            'Bar_funcB_body_input6_evaluate',
          ],
          'name': 'funcB body (input #6)',
          'script': '// "funcB" function parameters\n// none\n\n// "Bar" constructor parameters\n<body_pkh_bar> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>',
          'unlocks': 'Bar_funcB_body_lock',
        },
      },
      'scenarios': {
        'P2PKH_spend_input0_evaluate': {
          'name': 'Evaluate P2PKH spend (input #0)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_1',
                  'overrides': {
                    'bytecode': {
                      'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcA_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xb8f031f1',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input4_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Foo_execute_input5_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcB_input6_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xe1516928',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 8000,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': undefined,
                },
                'valueSatoshis': 800,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'minting',
                    'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
              {
                'lockingBytecode': '6a0568656c6c6f05776f726c64',
                'token': undefined,
                'valueSatoshis': 0,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_1',
                'overrides': {
                  'bytecode': {
                    'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': undefined,
              },
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'minting',
                  'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                },
              },
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'P2PKH_spend_input1_evaluate': {
          'name': 'Evaluate P2PKH spend (input #1)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_0',
                  'overrides': {
                    'bytecode': {
                      'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcA_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xb8f031f1',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input4_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Foo_execute_input5_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcB_input6_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xe1516928',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 8000,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': undefined,
                },
                'valueSatoshis': 800,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'minting',
                    'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
              {
                'lockingBytecode': '6a0568656c6c6f05776f726c64',
                'token': undefined,
                'valueSatoshis': 0,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_0',
                'overrides': {
                  'bytecode': {
                    'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': undefined,
              },
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'minting',
                  'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                },
              },
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'P2PKH_spend_input2_evaluate': {
          'name': 'Evaluate P2PKH spend (input #2)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_0',
                  'overrides': {
                    'bytecode': {
                      'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_1',
                  'overrides': {
                    'bytecode': {
                      'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcA_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xb8f031f1',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input4_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Foo_execute_input5_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcB_input6_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xe1516928',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 8000,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': undefined,
                },
                'valueSatoshis': 800,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'minting',
                    'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
              {
                'lockingBytecode': '6a0568656c6c6f05776f726c64',
                'token': undefined,
                'valueSatoshis': 0,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_0',
                'overrides': {
                  'bytecode': {
                    'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_1',
                'overrides': {
                  'bytecode': {
                    'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': undefined,
              },
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'minting',
                  'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                },
              },
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Bar_funcA_input3_evaluate': {
          'name': 'Evaluate Bar funcA (input #3)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0xb8f031f1',
              'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_0',
                  'overrides': {
                    'bytecode': {
                      'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_1',
                  'overrides': {
                    'bytecode': {
                      'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input4_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Foo_execute_input5_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcB_input6_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xe1516928',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 8000,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': undefined,
                },
                'valueSatoshis': 800,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'minting',
                    'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
              {
                'lockingBytecode': '6a0568656c6c6f05776f726c64',
                'token': undefined,
                'valueSatoshis': 0,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_0',
                'overrides': {
                  'bytecode': {
                    'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_1',
                'overrides': {
                  'bytecode': {
                    'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': undefined,
              },
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'minting',
                  'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                },
              },
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Bar_funcA_body_input3_evaluate': {
          'name': 'Evaluate Bar funcA body (input #3)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_0',
                  'overrides': {
                    'bytecode': {
                      'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_1',
                  'overrides': {
                    'bytecode': {
                      'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input4_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Foo_execute_input5_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcB_input6_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xe1516928',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 8000,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': undefined,
                },
                'valueSatoshis': 800,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'minting',
                    'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
              {
                'lockingBytecode': '6a0568656c6c6f05776f726c64',
                'token': undefined,
                'valueSatoshis': 0,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_0',
                'overrides': {
                  'bytecode': {
                    'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_1',
                'overrides': {
                  'bytecode': {
                    'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': undefined,
              },
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'minting',
                  'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                },
              },
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Bar_execute_input4_evaluate': {
          'name': 'Evaluate Bar execute (input #4)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0x53f23b6b',
              'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_0',
                  'overrides': {
                    'bytecode': {
                      'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_1',
                  'overrides': {
                    'bytecode': {
                      'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcA_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xb8f031f1',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Foo_execute_input5_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcB_input6_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xe1516928',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 8000,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': undefined,
                },
                'valueSatoshis': 800,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'minting',
                    'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
              {
                'lockingBytecode': '6a0568656c6c6f05776f726c64',
                'token': undefined,
                'valueSatoshis': 0,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_0',
                'overrides': {
                  'bytecode': {
                    'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_1',
                'overrides': {
                  'bytecode': {
                    'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': undefined,
              },
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'minting',
                  'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                },
              },
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Bar_execute_body_input4_evaluate': {
          'name': 'Evaluate Bar execute body (input #4)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'body_pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {
                'body_s': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_0',
                  'overrides': {
                    'bytecode': {
                      'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_1',
                  'overrides': {
                    'bytecode': {
                      'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcA_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xb8f031f1',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Foo_execute_input5_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcB_input6_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xe1516928',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 8000,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': undefined,
                },
                'valueSatoshis': 800,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'minting',
                    'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
              {
                'lockingBytecode': '6a0568656c6c6f05776f726c64',
                'token': undefined,
                'valueSatoshis': 0,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_0',
                'overrides': {
                  'bytecode': {
                    'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_1',
                'overrides': {
                  'bytecode': {
                    'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': undefined,
              },
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'minting',
                  'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                },
              },
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Foo_execute_input5_evaluate': {
          'name': 'Evaluate Foo execute (input #5)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
            },
            'keys': {
              'privateKeys': {
                's': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_0',
                  'overrides': {
                    'bytecode': {
                      'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_1',
                  'overrides': {
                    'bytecode': {
                      'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcA_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xb8f031f1',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input4_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcB_input6_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xe1516928',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 8000,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': undefined,
                },
                'valueSatoshis': 800,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'minting',
                    'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
              {
                'lockingBytecode': '6a0568656c6c6f05776f726c64',
                'token': undefined,
                'valueSatoshis': 0,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_0',
                'overrides': {
                  'bytecode': {
                    'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_1',
                'overrides': {
                  'bytecode': {
                    'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': undefined,
              },
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'minting',
                  'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                },
              },
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Bar_funcB_input6_evaluate': {
          'name': 'Evaluate Bar funcB (input #6)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0xe1516928',
              'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_0',
                  'overrides': {
                    'bytecode': {
                      'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_1',
                  'overrides': {
                    'bytecode': {
                      'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcA_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xb8f031f1',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input4_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Foo_execute_input5_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 8000,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': undefined,
                },
                'valueSatoshis': 800,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'minting',
                    'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
              {
                'lockingBytecode': '6a0568656c6c6f05776f726c64',
                'token': undefined,
                'valueSatoshis': 0,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_0',
                'overrides': {
                  'bytecode': {
                    'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_1',
                'overrides': {
                  'bytecode': {
                    'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': undefined,
              },
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'minting',
                  'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                },
              },
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Bar_funcB_body_input6_evaluate': {
          'name': 'Evaluate Bar funcB body (input #6)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_0',
                  'overrides': {
                    'bytecode': {
                      'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_1',
                  'overrides': {
                    'bytecode': {
                      'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_funcA_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0xb8f031f1',
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input4_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Foo_execute_input5_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 8000,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': undefined,
                },
                'valueSatoshis': 800,
              },
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'minting',
                    'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
              {
                'lockingBytecode': '6a0568656c6c6f05776f726c64',
                'token': undefined,
                'valueSatoshis': 0,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_0',
                'overrides': {
                  'bytecode': {
                    'signature_0': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_0': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_1',
                'overrides': {
                  'bytecode': {
                    'signature_1': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_1': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': undefined,
              },
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                    'public_key_2': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'minting',
                  'commitment': expect.stringMatching(/^[0-9a-f]{2}$/),
                },
              },
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Foo_432c93902a8a8e49ef246028e707cddaa67a39af46b2b3c11c196cd09c931746_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_foo': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
  {
    name: 'Simple 1 contract input & 1 contract output',
    transaction: (async () => {
      const contract = new Contract(BarArtifact, [alicePkh], { provider });
      await provider.addUtxo(contract.address, randomUtxo());

      const contractUtxos = await contract.getUtxos();

      return new TransactionBuilder({ provider })
        .addInput(
          contractUtxos[0],
          contract.unlock.funcA(),
        )
        .addOutput({ to: contract.address, amount: 10_000n });
    })(),
    template: {
      '$schema': 'https://ide.bitauth.com/authentication-template-v0.schema.json',
      'description': 'Imported from solidcash',
      'name': 'SolidCash Generated Debugging Template',
      'supported': [
        'BCH_2026_05',
      ],
      'version': 0,
      'entities': {
        'Bar_input0_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'Bar (input #0)',
          'scripts': [
            'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
            'Bar_funcA_input0_unlock',
          ],
          'variables': {
            'pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'Bar_body_input0_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'Bar funcA body (input #0)',
          'scripts': [
            'Bar_funcA_body_lock',
            'Bar_funcA_body_input0_unlock',
          ],
          'variables': {
            'body_pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
          },
        },
      },
      'scripts': {
        'Bar_funcA_input0_unlock': {
          'passes': [
            'Bar_funcA_input0_evaluate',
          ],
          'name': 'funcA (input #0)',
          'script': '// function selector\n<function_index> // bytes4 = <0xb8f031f1>\n\n// "funcA" function parameters\n// none\n',
          'unlocks': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
        },
        'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock': {
          'lockingType': 'p2sh32',
          'name': 'Bar',
          'script': '// "Bar" contract constructor parameters\n<pkh_bar> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>\n\n// bytecode\n                                                                       /* pragma solidcash >=0.10.2;                             */\n                                                                       /*                                                        */\n                                                                       /* contract Bar(bytes20 pkh_bar) {                        */\n<0x52529c77> <0xb8f031f1> OP_DEFINE                                    /*     function funcA() {                                 */\n                                                                       /*         require(2==2);                                 */\n                                                                       /*     }                                                  */\n                                                                       /*                                                        */\n<0x52529c77> <0xe1516928> OP_DEFINE                                    /*     function funcB() {                                 */\n                                                                       /*         require(2==2);                                 */\n                                                                       /*     }                                                  */\n                                                                       /*                                                        */\n<0x78a988ac> <0x53f23b6b> OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE /*     function execute(pubkey pk, sig s) {               */\n                                                                       /*         console.log("Bar \'execute\' function called."); */\n                                                                       /*         require(hash160(pk) == pkh_bar);               */\n                                                                       /*         require(checkSig(s, pk));                      */\n                                                                       /*     }                                                  */\n                                                                       /* }                                                      */\n                                                                       /*                                                        */',
        },
        'Bar_funcA_body_lock': {
          'lockingType': 'standard',
          'name': 'Bar funcA (function body)',
          'script': '                      /* pragma solidcash >=0.10.2;                             */\n                      /*                                                        */\n                      /* contract Bar(bytes20 pkh_bar) {                        */\n                      /*     function funcA() {                                 */\nOP_2 OP_2 OP_NUMEQUAL /*         require(2==2);                                 */\nOP_NIP                /*     }                                                  */\n                      /*                                                        */\n                      /*     function funcB() {                                 */\n                      /*         require(2==2);                                 */\n                      /*     }                                                  */\n                      /*                                                        */\n                      /*     function execute(pubkey pk, sig s) {               */\n                      /*         console.log("Bar \'execute\' function called."); */\n                      /*         require(hash160(pk) == pkh_bar);               */\n                      /*         require(checkSig(s, pk));                      */\n                      /*     }                                                  */\n                      /* }                                                      */\n                      /*                                                        */',
        },
        'Bar_funcA_body_input0_unlock': {
          'passes': [
            'Bar_funcA_body_input0_evaluate',
          ],
          'name': 'funcA body (input #0)',
          'script': '// "funcA" function parameters\n// none\n\n// "Bar" constructor parameters\n<body_pkh_bar> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>',
          'unlocks': 'Bar_funcA_body_lock',
        },
      },
      'scenarios': {
        'Bar_funcA_input0_evaluate': {
          'name': 'Evaluate Bar funcA (input #0)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0xb8f031f1',
              'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 10000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Bar_funcA_body_input0_evaluate': {
          'name': 'Evaluate Bar funcA body (input #0)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Bar_funcA_body_lock',
                },
                'token': undefined,
                'valueSatoshis': 10000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
  {
    name: 'HodlVault + twtContract',
    transaction: (async () => {
      const twtContract = new Contract(twtArtifact, [bobPub, carolPub, 100000n], { provider });
      const hodlVault = new Contract(hodlVaultArtifact, [alicePub, oraclePub, 99000n, 30000n], { provider });
      const bobSignatureTemplate = new SignatureTemplate(bobPriv);

      const to = hodlVault.address;
      const amount = 10000n;
      const message = oracle.createMessage(100000n, 30000n);
      const oracleSig = oracle.signMessage(message);
      await provider.addUtxo(twtContract.address, randomUtxo());
      await provider.addUtxo(hodlVault.address, randomUtxo());
      const hodlVaultUtxos = await hodlVault.getUtxos();
      const twtContractUtxos = await twtContract.getUtxos();

      return new TransactionBuilder({ provider })
        .addInput(hodlVaultUtxos[0], hodlVault.unlock.spend(new SignatureTemplate(alicePriv), oracleSig, message))
        .addInput(twtContractUtxos[0], twtContract.unlock.timeout(bobSignatureTemplate))
        .addOutput({ to, amount })
        .setLocktime(1000000);
    })(),
    template: {
      '$schema': 'https://ide.bitauth.com/authentication-template-v0.schema.json',
      'description': 'Imported from solidcash',
      'name': 'SolidCash Generated Debugging Template',
      'supported': [
        'BCH_2026_05',
      ],
      'version': 0,
      'entities': {
        'HodlVault_input0_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'HodlVault (input #0)',
          'scripts': [
            'HodlVault_1a81f76f65bab937da712fa486de9c43ef671b4b97b33f0556cb131dda07c5e3_lock',
            'HodlVault_spend_input0_unlock',
          ],
          'variables': {
            'ownerSig': {
              'description': '"ownerSig" parameter of function "spend"',
              'name': 'ownerSig',
              'type': 'Key',
            },
            'oracleSig': {
              'description': '"oracleSig" parameter of function "spend"',
              'name': 'oracleSig',
              'type': 'WalletData',
            },
            'oracleMessage': {
              'description': '"oracleMessage" parameter of function "spend"',
              'name': 'oracleMessage',
              'type': 'WalletData',
            },
            'ownerPk': {
              'description': '"ownerPk" parameter of this contract',
              'name': 'ownerPk',
              'type': 'WalletData',
            },
            'oraclePk': {
              'description': '"oraclePk" parameter of this contract',
              'name': 'oraclePk',
              'type': 'WalletData',
            },
            'minBlock': {
              'description': '"minBlock" parameter of this contract',
              'name': 'minBlock',
              'type': 'WalletData',
            },
            'priceTarget': {
              'description': '"priceTarget" parameter of this contract',
              'name': 'priceTarget',
              'type': 'WalletData',
            },
          },
        },
        'TransferWithTimeout_input1_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'TransferWithTimeout (input #1)',
          'scripts': [
            'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
            'TransferWithTimeout_timeout_input1_unlock',
          ],
          'variables': {
            'senderSig': {
              'description': '"senderSig" parameter of function "timeout"',
              'name': 'senderSig',
              'type': 'WalletData',
            },
            'sender': {
              'description': '"sender" parameter of this contract',
              'name': 'sender',
              'type': 'WalletData',
            },
            'recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'timeout': {
              'description': '"timeout" parameter of this contract',
              'name': 'timeout',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'TransferWithTimeout_body_input1_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'TransferWithTimeout timeout body (input #1)',
          'scripts': [
            'TransferWithTimeout_timeout_body_lock',
            'TransferWithTimeout_timeout_body_input1_unlock',
          ],
          'variables': {
            'body_senderSig': {
              'description': '"senderSig" parameter of function "timeout"',
              'name': 'senderSig',
              'type': 'Key',
            },
            'body_sender': {
              'description': '"sender" parameter of this contract',
              'name': 'sender',
              'type': 'WalletData',
            },
            'body_recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'body_timeout': {
              'description': '"timeout" parameter of this contract',
              'name': 'timeout',
              'type': 'WalletData',
            },
          },
        },
      },
      'scripts': {
        'HodlVault_spend_input0_unlock': {
          'passes': [
            'HodlVault_spend_input0_evaluate',
          ],
          'name': 'spend (input #0)',
          'script': '// "spend" function parameters\n<oracleMessage> // bytes8 = <0xa086010030750000>\n<oracleSig> // datasig = <0x569e137142ebdb96127b727787d605e427a858e8b17dc0605092d0019e5fc9d58810ee74c8ba9f9a5605268c9913e50f780f4c3780e06aea7f50766829895b4b>\n<ownerSig.schnorr_signature.all_outputs_all_utxos> // sig\n',
          'unlocks': 'HodlVault_1a81f76f65bab937da712fa486de9c43ef671b4b97b33f0556cb131dda07c5e3_lock',
        },
        'HodlVault_1a81f76f65bab937da712fa486de9c43ef671b4b97b33f0556cb131dda07c5e3_lock': {
          'lockingType': 'p2sh32',
          'name': 'HodlVault',
          'script': '// "HodlVault" contract constructor parameters\n<priceTarget> // int = <0x3075>\n<minBlock> // int = <0xb88201>\n<oraclePk> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>\n<ownerPk> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n\n// bytecode\n                                                             /* // This contract forces HODLing until a certain price target has been reached                                          */\n                                                             /* // A minimum block is provided to ensure that oracle price entries from before this block are disregarded              */\n                                                             /* // i.e. when the BCH price was $1000 in the past, an oracle entry with the old block number and price can not be used. */\n                                                             /* // Instead, a message with a block number and price from after the minBlock needs to be passed.                        */\n                                                             /* // This contract serves as a simple example for checkDataSig-based contracts.                                          */\n                                                             /* contract HodlVault(                                                                                                    */\n                                                             /*     pubkey ownerPk,                                                                                                    */\n                                                             /*     pubkey oraclePk,                                                                                                   */\n                                                             /*     int minBlock,                                                                                                      */\n                                                             /*     int priceTarget                                                                                                    */\n                                                             /* ) {                                                                                                                    */\n                                                             /*     function spend(                                                                                                    */\n                                                             /*         sig ownerSig,                                                                                                  */\n                                                             /*         datasig oracleSig,                                                                                             */\nOP_6 OP_PICK OP_SIZE OP_8 OP_EQUALVERIFY OP_DROP             /*         bytes8 oracleMessage                                                                                           */\n                                                             /*     ) {                                                                                                                */\n                                                             /*         // message: { blockHeight, price }                                                                             */\nOP_6 OP_PICK OP_4 OP_SPLIT                                   /*         bytes4 blockHeightBin, bytes4 priceBin = oracleMessage.split(4);                                               */\nOP_SWAP OP_BIN2NUM                                           /*         int blockHeight = int(blockHeightBin);                                                                         */\nOP_SWAP OP_BIN2NUM                                           /*         int price = int(priceBin);                                                                                     */\n                                                             /*                                                                                                                        */\n                                                             /*         // Check that blockHeight is after minBlock and not in the future                                              */\nOP_OVER OP_5 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY         /*         require(blockHeight >= minBlock);                                                                              */\nOP_SWAP OP_CHECKLOCKTIMEVERIFY OP_DROP                       /*         require(tx.time >= blockHeight);                                                                               */\n                                                             /*                                                                                                                        */\n                                                             /*         // Check that current price is at least priceTarget                                                            */\nOP_3 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY                 /*         require(price >= priceTarget);                                                                                 */\n                                                             /*                                                                                                                        */\n                                                             /*         // Handle necessary signature checks                                                                           */\nOP_3 OP_ROLL OP_4 OP_ROLL OP_3 OP_ROLL OP_CHECKDATASIGVERIFY /*         require(checkDataSig(oracleSig, oracleMessage, oraclePk));                                                     */\nOP_CHECKSIG                                                  /*         require(checkSig(ownerSig, ownerPk));                                                                          */\n                                                             /*     }                                                                                                                  */\n                                                             /* }                                                                                                                      */\n                                                             /*                                                                                                                        */',
        },
        'TransferWithTimeout_timeout_input1_unlock': {
          'passes': [
            'TransferWithTimeout_timeout_input1_evaluate',
          ],
          'name': 'timeout (input #1)',
          'script': expect.stringContaining('// "timeout" function parameters\n<senderSig> // sig = <0x'),
          'unlocks': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
        },
        'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock': {
          'lockingType': 'p2sh32',
          'name': 'TransferWithTimeout',
          'script': '// "TransferWithTimeout" contract constructor parameters\n<timeout> // int = <0xa08601>\n<recipient> // pubkey = <0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90>\n<sender> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>\n\n// bytecode\n                                                                               /* contract TransferWithTimeout(                                             */\n                                                                               /*     pubkey sender,                                                        */\n                                                                               /*     pubkey recipient,                                                     */\n                                                                               /*     int timeout                                                           */\n                                                                               /* ) {                                                                       */\n                                                                               /*     // Require recipient\'s signature to match                             */\n<0x537a7bac7777> <0x3486e360> OP_DEFINE                                        /*     function transfer(sig recipientSig) {                                 */\n                                                                               /*         require(checkSig(recipientSig, recipient));                       */\n                                                                               /*     }                                                                     */\n                                                                               /*                                                                           */\n                                                                               /*     // Require timeout time to be reached and sender\'s signature to match */\n<0x537a7cad7cb16d51> <0x2203057b> OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE /*     function timeout(sig senderSig) {                                     */\n                                                                               /*         require(checkSig(senderSig, sender));                             */\n                                                                               /*         require(tx.time >= timeout);                                      */\n                                                                               /*     }                                                                     */\n                                                                               /* }                                                                         */\n                                                                               /*                                                                           */',
        },
        'TransferWithTimeout_timeout_body_lock': {
          'lockingType': 'standard',
          'name': 'TransferWithTimeout timeout (function body)',
          'script': '                                       /* contract TransferWithTimeout(                                             */\n                                       /*     pubkey sender,                                                        */\n                                       /*     pubkey recipient,                                                     */\n                                       /*     int timeout                                                           */\n                                       /* ) {                                                                       */\n                                       /*     // Require recipient\'s signature to match                             */\n                                       /*     function transfer(sig recipientSig) {                                 */\n                                       /*         require(checkSig(recipientSig, recipient));                       */\n                                       /*     }                                                                     */\n                                       /*                                                                           */\n                                       /*     // Require timeout time to be reached and sender\'s signature to match */\n                                       /*     function timeout(sig senderSig) {                                     */\nOP_3 OP_ROLL OP_SWAP OP_CHECKSIGVERIFY /*         require(checkSig(senderSig, sender));                             */\nOP_SWAP OP_CHECKLOCKTIMEVERIFY         /*         require(tx.time >= timeout);                                      */\nOP_2DROP OP_1                          /*     }                                                                     */\n                                       /* }                                                                         */\n                                       /*                                                                           */',
        },
        'TransferWithTimeout_timeout_body_input1_unlock': {
          'passes': [
            'TransferWithTimeout_timeout_body_input1_evaluate',
          ],
          'name': 'timeout body (input #1)',
          'script': '// "timeout" function parameters\n<body_senderSig.schnorr_signature.all_outputs_all_utxos> // sig\n\n// "TransferWithTimeout" constructor parameters\n<body_timeout> // int = <0xa08601>\n<body_recipient> // pubkey = <0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90>\n<body_sender> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>',
          'unlocks': 'TransferWithTimeout_timeout_body_lock',
        },
      },
      'scenarios': {
        'HodlVault_spend_input0_evaluate': {
          'name': 'Evaluate HodlVault spend (input #0)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'oracleSig': '0x569e137142ebdb96127b727787d605e427a858e8b17dc0605092d0019e5fc9d58810ee74c8ba9f9a5605268c9913e50f780f4c3780e06aea7f50766829895b4b',
              'oracleMessage': '0xa086010030750000',
              'ownerPk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'oraclePk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'minBlock': '0xb88201',
              'priceTarget': '0x3075',
            },
            'keys': {
              'privateKeys': {
                'ownerSig': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'HodlVault_1a81f76f65bab937da712fa486de9c43ef671b4b97b33f0556cb131dda07c5e3_lock',
                  'overrides': {
                    'bytecode': {
                      'ownerPk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'oraclePk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'minBlock': '0xb88201',
                      'priceTarget': '0x3075',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 10000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_timeout_input1_evaluate': {
          'name': 'Evaluate TransferWithTimeout timeout (input #1)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0x2203057b',
              'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
              'timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'HodlVault_spend_input0_unlock',
                  'overrides': {
                    'bytecode': {
                      'oracleSig': '0x569e137142ebdb96127b727787d605e427a858e8b17dc0605092d0019e5fc9d58810ee74c8ba9f9a5605268c9913e50f780f4c3780e06aea7f50766829895b4b',
                      'oracleMessage': '0xa086010030750000',
                      'ownerPk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'oraclePk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'minBlock': '0xb88201',
                      'priceTarget': '0x3075',
                    },
                    'keys': {
                      'privateKeys': {
                        'ownerSig': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'HodlVault_1a81f76f65bab937da712fa486de9c43ef671b4b97b33f0556cb131dda07c5e3_lock',
                  'overrides': {
                    'bytecode': {
                      'ownerPk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'oraclePk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'minBlock': '0xb88201',
                      'priceTarget': '0x3075',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 10000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'HodlVault_1a81f76f65bab937da712fa486de9c43ef671b4b97b33f0556cb131dda07c5e3_lock',
                'overrides': {
                  'bytecode': {
                    'ownerPk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    'oraclePk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'minBlock': '0xb88201',
                    'priceTarget': '0x3075',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_timeout_body_input1_evaluate': {
          'name': 'Evaluate TransferWithTimeout timeout body (input #1)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'body_recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
              'body_timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {
                'body_senderSig': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'HodlVault_spend_input0_unlock',
                  'overrides': {
                    'bytecode': {
                      'oracleSig': '0x569e137142ebdb96127b727787d605e427a858e8b17dc0605092d0019e5fc9d58810ee74c8ba9f9a5605268c9913e50f780f4c3780e06aea7f50766829895b4b',
                      'oracleMessage': '0xa086010030750000',
                      'ownerPk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'oraclePk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'minBlock': '0xb88201',
                      'priceTarget': '0x3075',
                    },
                    'keys': {
                      'privateKeys': {
                        'ownerSig': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'HodlVault_1a81f76f65bab937da712fa486de9c43ef671b4b97b33f0556cb131dda07c5e3_lock',
                  'overrides': {
                    'bytecode': {
                      'ownerPk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'oraclePk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'minBlock': '0xb88201',
                      'priceTarget': '0x3075',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 10000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'HodlVault_1a81f76f65bab937da712fa486de9c43ef671b4b97b33f0556cb131dda07c5e3_lock',
                'overrides': {
                  'bytecode': {
                    'ownerPk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                    'oraclePk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'minBlock': '0xb88201',
                    'priceTarget': '0x3075',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
  {
    name: '4 twtContract inputs',
    transaction: (async () => {
      const twtContract = new Contract(twtArtifact, [bobPub, carolPub, 100000n], { provider });
      await provider.addUtxo(twtContract.address, randomUtxo());
      await provider.addUtxo(twtContract.address, randomUtxo());
      await provider.addUtxo(twtContract.address, randomUtxo());
      await provider.addUtxo(twtContract.address, randomUtxo());

      const twtContractUtxos = await twtContract.getUtxos();

      const bobTemplate = new SignatureTemplate(bobPriv);
      const carolTemplate = new SignatureTemplate(carolPriv);

      return new TransactionBuilder({ provider })
        .addInput(twtContractUtxos[0], twtContract.unlock.timeout(bobTemplate)) // should succeed
        .addInput(twtContractUtxos[1], twtContract.unlock.timeout(carolTemplate)) // should fail (wrong sig)
        .addInput(twtContractUtxos[2], twtContract.unlock.transfer(carolTemplate)) // should succeed
        .addInput(twtContractUtxos[3], twtContract.unlock.transfer(bobTemplate)) // should fail (wrong sig)
        .addOutput({ to: twtContract.address, amount: 20_000n })
        .setLocktime(1000000);
    })(),
    template: {
      '$schema': 'https://ide.bitauth.com/authentication-template-v0.schema.json',
      'description': 'Imported from solidcash',
      'name': 'SolidCash Generated Debugging Template',
      'supported': [
        'BCH_2026_05',
      ],
      'version': 0,
      'entities': {
        'TransferWithTimeout_input0_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'TransferWithTimeout (input #0)',
          'scripts': [
            'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
            'TransferWithTimeout_timeout_input0_unlock',
          ],
          'variables': {
            'senderSig': {
              'description': '"senderSig" parameter of function "timeout"',
              'name': 'senderSig',
              'type': 'WalletData',
            },
            'sender': {
              'description': '"sender" parameter of this contract',
              'name': 'sender',
              'type': 'WalletData',
            },
            'recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'timeout': {
              'description': '"timeout" parameter of this contract',
              'name': 'timeout',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'TransferWithTimeout_body_input0_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'TransferWithTimeout timeout body (input #0)',
          'scripts': [
            'TransferWithTimeout_timeout_body_lock',
            'TransferWithTimeout_timeout_body_input0_unlock',
          ],
          'variables': {
            'body_senderSig': {
              'description': '"senderSig" parameter of function "timeout"',
              'name': 'senderSig',
              'type': 'Key',
            },
            'body_sender': {
              'description': '"sender" parameter of this contract',
              'name': 'sender',
              'type': 'WalletData',
            },
            'body_recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'body_timeout': {
              'description': '"timeout" parameter of this contract',
              'name': 'timeout',
              'type': 'WalletData',
            },
          },
        },
        'TransferWithTimeout_input1_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'TransferWithTimeout (input #1)',
          'scripts': [
            'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
            'TransferWithTimeout_timeout_input1_unlock',
          ],
          'variables': {
            'senderSig': {
              'description': '"senderSig" parameter of function "timeout"',
              'name': 'senderSig',
              'type': 'WalletData',
            },
            'sender': {
              'description': '"sender" parameter of this contract',
              'name': 'sender',
              'type': 'WalletData',
            },
            'recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'timeout': {
              'description': '"timeout" parameter of this contract',
              'name': 'timeout',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'TransferWithTimeout_body_input1_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'TransferWithTimeout timeout body (input #1)',
          'scripts': [
            'TransferWithTimeout_timeout_body_lock',
            'TransferWithTimeout_timeout_body_input1_unlock',
          ],
          'variables': {
            'body_senderSig': {
              'description': '"senderSig" parameter of function "timeout"',
              'name': 'senderSig',
              'type': 'Key',
            },
            'body_sender': {
              'description': '"sender" parameter of this contract',
              'name': 'sender',
              'type': 'WalletData',
            },
            'body_recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'body_timeout': {
              'description': '"timeout" parameter of this contract',
              'name': 'timeout',
              'type': 'WalletData',
            },
          },
        },
        'TransferWithTimeout_input2_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'TransferWithTimeout (input #2)',
          'scripts': [
            'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
            'TransferWithTimeout_transfer_input2_unlock',
          ],
          'variables': {
            'recipientSig': {
              'description': '"recipientSig" parameter of function "transfer"',
              'name': 'recipientSig',
              'type': 'WalletData',
            },
            'sender': {
              'description': '"sender" parameter of this contract',
              'name': 'sender',
              'type': 'WalletData',
            },
            'recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'timeout': {
              'description': '"timeout" parameter of this contract',
              'name': 'timeout',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'TransferWithTimeout_body_input2_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'TransferWithTimeout transfer body (input #2)',
          'scripts': [
            'TransferWithTimeout_transfer_body_lock',
            'TransferWithTimeout_transfer_body_input2_unlock',
          ],
          'variables': {
            'body_recipientSig': {
              'description': '"recipientSig" parameter of function "transfer"',
              'name': 'recipientSig',
              'type': 'Key',
            },
            'body_sender': {
              'description': '"sender" parameter of this contract',
              'name': 'sender',
              'type': 'WalletData',
            },
            'body_recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'body_timeout': {
              'description': '"timeout" parameter of this contract',
              'name': 'timeout',
              'type': 'WalletData',
            },
          },
        },
        'TransferWithTimeout_input3_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'TransferWithTimeout (input #3)',
          'scripts': [
            'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
            'TransferWithTimeout_transfer_input3_unlock',
          ],
          'variables': {
            'recipientSig': {
              'description': '"recipientSig" parameter of function "transfer"',
              'name': 'recipientSig',
              'type': 'WalletData',
            },
            'sender': {
              'description': '"sender" parameter of this contract',
              'name': 'sender',
              'type': 'WalletData',
            },
            'recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'timeout': {
              'description': '"timeout" parameter of this contract',
              'name': 'timeout',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'TransferWithTimeout_body_input3_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'TransferWithTimeout transfer body (input #3)',
          'scripts': [
            'TransferWithTimeout_transfer_body_lock',
            'TransferWithTimeout_transfer_body_input3_unlock',
          ],
          'variables': {
            'body_recipientSig': {
              'description': '"recipientSig" parameter of function "transfer"',
              'name': 'recipientSig',
              'type': 'Key',
            },
            'body_sender': {
              'description': '"sender" parameter of this contract',
              'name': 'sender',
              'type': 'WalletData',
            },
            'body_recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'body_timeout': {
              'description': '"timeout" parameter of this contract',
              'name': 'timeout',
              'type': 'WalletData',
            },
          },
        },
      },
      'scripts': {
        'TransferWithTimeout_timeout_input0_unlock': {
          'passes': [
            'TransferWithTimeout_timeout_input0_evaluate',
          ],
          'name': 'timeout (input #0)',
          'script': expect.stringContaining('// "timeout" function parameters\n<senderSig> // sig = <0x'),
          'unlocks': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
        },
        'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock': {
          'lockingType': 'p2sh32',
          'name': 'TransferWithTimeout',
          'script': '// "TransferWithTimeout" contract constructor parameters\n<timeout> // int = <0xa08601>\n<recipient> // pubkey = <0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90>\n<sender> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>\n\n// bytecode\n                                                                               /* contract TransferWithTimeout(                                             */\n                                                                               /*     pubkey sender,                                                        */\n                                                                               /*     pubkey recipient,                                                     */\n                                                                               /*     int timeout                                                           */\n                                                                               /* ) {                                                                       */\n                                                                               /*     // Require recipient\'s signature to match                             */\n<0x537a7bac7777> <0x3486e360> OP_DEFINE                                        /*     function transfer(sig recipientSig) {                                 */\n                                                                               /*         require(checkSig(recipientSig, recipient));                       */\n                                                                               /*     }                                                                     */\n                                                                               /*                                                                           */\n                                                                               /*     // Require timeout time to be reached and sender\'s signature to match */\n<0x537a7cad7cb16d51> <0x2203057b> OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE /*     function timeout(sig senderSig) {                                     */\n                                                                               /*         require(checkSig(senderSig, sender));                             */\n                                                                               /*         require(tx.time >= timeout);                                      */\n                                                                               /*     }                                                                     */\n                                                                               /* }                                                                         */\n                                                                               /*                                                                           */',
        },
        'TransferWithTimeout_timeout_body_lock': {
          'lockingType': 'standard',
          'name': 'TransferWithTimeout timeout (function body)',
          'script': '                                       /* contract TransferWithTimeout(                                             */\n                                       /*     pubkey sender,                                                        */\n                                       /*     pubkey recipient,                                                     */\n                                       /*     int timeout                                                           */\n                                       /* ) {                                                                       */\n                                       /*     // Require recipient\'s signature to match                             */\n                                       /*     function transfer(sig recipientSig) {                                 */\n                                       /*         require(checkSig(recipientSig, recipient));                       */\n                                       /*     }                                                                     */\n                                       /*                                                                           */\n                                       /*     // Require timeout time to be reached and sender\'s signature to match */\n                                       /*     function timeout(sig senderSig) {                                     */\nOP_3 OP_ROLL OP_SWAP OP_CHECKSIGVERIFY /*         require(checkSig(senderSig, sender));                             */\nOP_SWAP OP_CHECKLOCKTIMEVERIFY         /*         require(tx.time >= timeout);                                      */\nOP_2DROP OP_1                          /*     }                                                                     */\n                                       /* }                                                                         */\n                                       /*                                                                           */',
        },
        'TransferWithTimeout_timeout_body_input0_unlock': {
          'passes': [
            'TransferWithTimeout_timeout_body_input0_evaluate',
          ],
          'name': 'timeout body (input #0)',
          'script': '// "timeout" function parameters\n<body_senderSig.schnorr_signature.all_outputs_all_utxos> // sig\n\n// "TransferWithTimeout" constructor parameters\n<body_timeout> // int = <0xa08601>\n<body_recipient> // pubkey = <0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90>\n<body_sender> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>',
          'unlocks': 'TransferWithTimeout_timeout_body_lock',
        },
        'TransferWithTimeout_timeout_input1_unlock': {
          'passes': [
            'TransferWithTimeout_timeout_input1_evaluate',
          ],
          'name': 'timeout (input #1)',
          'script': expect.stringContaining('// "timeout" function parameters\n<senderSig> // sig = <0x'),
          'unlocks': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
        },
        'TransferWithTimeout_timeout_body_input1_unlock': {
          'passes': [
            'TransferWithTimeout_timeout_body_input1_evaluate',
          ],
          'name': 'timeout body (input #1)',
          'script': '// "timeout" function parameters\n<body_senderSig.schnorr_signature.all_outputs_all_utxos> // sig\n\n// "TransferWithTimeout" constructor parameters\n<body_timeout> // int = <0xa08601>\n<body_recipient> // pubkey = <0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90>\n<body_sender> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>',
          'unlocks': 'TransferWithTimeout_timeout_body_lock',
        },
        'TransferWithTimeout_transfer_input2_unlock': {
          'passes': [
            'TransferWithTimeout_transfer_input2_evaluate',
          ],
          'name': 'transfer (input #2)',
          'script': expect.stringContaining('// "transfer" function parameters\n<recipientSig> // sig = <0x'),
          'unlocks': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
        },
        'TransferWithTimeout_transfer_body_lock': {
          'lockingType': 'standard',
          'name': 'TransferWithTimeout transfer (function body)',
          'script': '                                /* contract TransferWithTimeout(                                             */\n                                /*     pubkey sender,                                                        */\n                                /*     pubkey recipient,                                                     */\n                                /*     int timeout                                                           */\n                                /* ) {                                                                       */\n                                /*     // Require recipient\'s signature to match                             */\n                                /*     function transfer(sig recipientSig) {                                 */\nOP_3 OP_ROLL OP_ROT OP_CHECKSIG /*         require(checkSig(recipientSig, recipient));                       */\nOP_NIP OP_NIP                   /*     }                                                                     */\n                                /*                                                                           */\n                                /*     // Require timeout time to be reached and sender\'s signature to match */\n                                /*     function timeout(sig senderSig) {                                     */\n                                /*         require(checkSig(senderSig, sender));                             */\n                                /*         require(tx.time >= timeout);                                      */\n                                /*     }                                                                     */\n                                /* }                                                                         */\n                                /*                                                                           */',
        },
        'TransferWithTimeout_transfer_body_input2_unlock': {
          'passes': [
            'TransferWithTimeout_transfer_body_input2_evaluate',
          ],
          'name': 'transfer body (input #2)',
          'script': '// "transfer" function parameters\n<body_recipientSig.schnorr_signature.all_outputs_all_utxos> // sig\n\n// "TransferWithTimeout" constructor parameters\n<body_timeout> // int = <0xa08601>\n<body_recipient> // pubkey = <0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90>\n<body_sender> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>',
          'unlocks': 'TransferWithTimeout_transfer_body_lock',
        },
        'TransferWithTimeout_transfer_input3_unlock': {
          'passes': [
            'TransferWithTimeout_transfer_input3_evaluate',
          ],
          'name': 'transfer (input #3)',
          'script': expect.stringContaining('// "transfer" function parameters\n<recipientSig> // sig = <0x'),
          'unlocks': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
        },
        'TransferWithTimeout_transfer_body_input3_unlock': {
          'passes': [
            'TransferWithTimeout_transfer_body_input3_evaluate',
          ],
          'name': 'transfer body (input #3)',
          'script': '// "transfer" function parameters\n<body_recipientSig.schnorr_signature.all_outputs_all_utxos> // sig\n\n// "TransferWithTimeout" constructor parameters\n<body_timeout> // int = <0xa08601>\n<body_recipient> // pubkey = <0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90>\n<body_sender> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>',
          'unlocks': 'TransferWithTimeout_transfer_body_lock',
        },
      },
      'scenarios': {
        'TransferWithTimeout_timeout_input0_evaluate': {
          'name': 'Evaluate TransferWithTimeout timeout (input #0)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0x2203057b',
              'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
              'timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input2_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                  'overrides': {
                    'bytecode': {
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_timeout_body_input0_evaluate': {
          'name': 'Evaluate TransferWithTimeout timeout body (input #0)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'body_recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
              'body_timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {
                'body_senderSig': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input2_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_body_lock',
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_timeout_input1_evaluate': {
          'name': 'Evaluate TransferWithTimeout timeout (input #1)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0x2203057b',
              'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
              'timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input0_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input2_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                  'overrides': {
                    'bytecode': {
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_timeout_body_input1_evaluate': {
          'name': 'Evaluate TransferWithTimeout timeout body (input #1)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'body_recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
              'body_timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {
                'body_senderSig': '81597823a901865622658cbf6d50c0286aa1d70fa1af98f897e34a0623a828ff',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input0_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input2_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_body_lock',
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_transfer_input2_evaluate': {
          'name': 'Evaluate TransferWithTimeout transfer (input #2)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0x3486e360',
              'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
              'timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input0_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                  'overrides': {
                    'bytecode': {
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_transfer_body_input2_evaluate': {
          'name': 'Evaluate TransferWithTimeout transfer body (input #2)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'body_recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
              'body_timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {
                'body_recipientSig': '81597823a901865622658cbf6d50c0286aa1d70fa1af98f897e34a0623a828ff',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input0_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input3_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_body_lock',
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_transfer_input3_evaluate': {
          'name': 'Evaluate TransferWithTimeout transfer (input #3)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0x3486e360',
              'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
              'timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input0_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input2_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                  'overrides': {
                    'bytecode': {
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_transfer_body_input3_evaluate': {
          'name': 'Evaluate TransferWithTimeout transfer body (input #3)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'body_recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
              'body_timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {
                'body_recipientSig': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input0_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x2203057b',
                      'senderSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_input2_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x3486e360',
                      'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                      'timeout': '0xa08601',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 1000000,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_body_lock',
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'TransferWithTimeout_9b1112352e75971217815cafc4fef4e8a5291cc83f93a72d3530c53255c8ba07_lock',
                'overrides': {
                  'bytecode': {
                    'sender': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    'recipient': '0x0260e6133d3432b4555a387e5ed82c448019f0c0d39b5a6324c3a586c4c3590c90',
                    'timeout': '0xa08601',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
  {
    // TODO: Duplicate input scenarios with the same function call have the same name
    name: 'Duplicate function calls',
    transaction: (async () => {
      const barContract = new Contract(BarArtifact, [alicePkh], { provider });
      await provider.addUtxo(barContract.address, randomUtxo());
      await provider.addUtxo(barContract.address, randomUtxo());

      const barContractUtxos = await barContract.getUtxos();

      const aliceTemplate = new SignatureTemplate(alicePriv);
      const bobTemplate = new SignatureTemplate(bobPriv);

      return new TransactionBuilder({ provider })
        .addInput(barContractUtxos[0], barContract.unlock.execute(alicePub, aliceTemplate))
        .addInput(barContractUtxos[1], barContract.unlock.execute(bobPub, bobTemplate))
        .addOutput({ to: barContract.address, amount: 20_000n });
    })(),
    template: {
      '$schema': 'https://ide.bitauth.com/authentication-template-v0.schema.json',
      'description': 'Imported from solidcash',
      'name': 'SolidCash Generated Debugging Template',
      'supported': [
        'BCH_2026_05',
      ],
      'version': 0,
      'entities': {
        'Bar_input0_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'Bar (input #0)',
          'scripts': [
            'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
            'Bar_execute_input0_unlock',
          ],
          'variables': {
            'pk': {
              'description': '"pk" parameter of function "execute"',
              'name': 'pk',
              'type': 'WalletData',
            },
            's': {
              'description': '"s" parameter of function "execute"',
              'name': 's',
              'type': 'WalletData',
            },
            'pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'Bar_body_input0_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'Bar execute body (input #0)',
          'scripts': [
            'Bar_execute_body_lock',
            'Bar_execute_body_input0_unlock',
          ],
          'variables': {
            'body_pk': {
              'description': '"pk" parameter of function "execute"',
              'name': 'pk',
              'type': 'WalletData',
            },
            'body_s': {
              'description': '"s" parameter of function "execute"',
              'name': 's',
              'type': 'Key',
            },
            'body_pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
          },
        },
        'Bar_input1_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'Bar (input #1)',
          'scripts': [
            'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
            'Bar_execute_input1_unlock',
          ],
          'variables': {
            'pk': {
              'description': '"pk" parameter of function "execute"',
              'name': 'pk',
              'type': 'WalletData',
            },
            's': {
              'description': '"s" parameter of function "execute"',
              'name': 's',
              'type': 'WalletData',
            },
            'pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'Bar_body_input1_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'Bar execute body (input #1)',
          'scripts': [
            'Bar_execute_body_lock',
            'Bar_execute_body_input1_unlock',
          ],
          'variables': {
            'body_pk': {
              'description': '"pk" parameter of function "execute"',
              'name': 'pk',
              'type': 'WalletData',
            },
            'body_s': {
              'description': '"s" parameter of function "execute"',
              'name': 's',
              'type': 'Key',
            },
            'body_pkh_bar': {
              'description': '"pkh_bar" parameter of this contract',
              'name': 'pkh_bar',
              'type': 'WalletData',
            },
          },
        },
      },
      'scripts': {
        'Bar_execute_input0_unlock': {
          'passes': [
            'Bar_execute_input0_evaluate',
          ],
          'name': 'execute (input #0)',
          'script': expect.stringContaining('// "execute" function parameters\n<s> // sig = <0x'),
          'unlocks': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
        },
        'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock': {
          'lockingType': 'p2sh32',
          'name': 'Bar',
          'script': '// "Bar" contract constructor parameters\n<pkh_bar> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>\n\n// bytecode\n                                                                       /* pragma solidcash >=0.10.2;                             */\n                                                                       /*                                                        */\n                                                                       /* contract Bar(bytes20 pkh_bar) {                        */\n<0x52529c77> <0xb8f031f1> OP_DEFINE                                    /*     function funcA() {                                 */\n                                                                       /*         require(2==2);                                 */\n                                                                       /*     }                                                  */\n                                                                       /*                                                        */\n<0x52529c77> <0xe1516928> OP_DEFINE                                    /*     function funcB() {                                 */\n                                                                       /*         require(2==2);                                 */\n                                                                       /*     }                                                  */\n                                                                       /*                                                        */\n<0x78a988ac> <0x53f23b6b> OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE /*     function execute(pubkey pk, sig s) {               */\n                                                                       /*         console.log("Bar \'execute\' function called."); */\n                                                                       /*         require(hash160(pk) == pkh_bar);               */\n                                                                       /*         require(checkSig(s, pk));                      */\n                                                                       /*     }                                                  */\n                                                                       /* }                                                      */\n                                                                       /*                                                        */',
        },
        'Bar_execute_body_lock': {
          'lockingType': 'standard',
          'name': 'Bar execute (function body)',
          'script': '                                  /* pragma solidcash >=0.10.2;                             */\n                                  /*                                                        */\n                                  /* contract Bar(bytes20 pkh_bar) {                        */\n                                  /*     function funcA() {                                 */\n                                  /*         require(2==2);                                 */\n                                  /*     }                                                  */\n                                  /*                                                        */\n                                  /*     function funcB() {                                 */\n                                  /*         require(2==2);                                 */\n                                  /*     }                                                  */\n                                  /*                                                        */\n                                  /*     function execute(pubkey pk, sig s) {               */\n                                  /*         console.log("Bar \'execute\' function called."); */\nOP_OVER OP_HASH160 OP_EQUALVERIFY /*         require(hash160(pk) == pkh_bar);               */\nOP_CHECKSIG                       /*         require(checkSig(s, pk));                      */\n                                  /*     }                                                  */\n                                  /* }                                                      */\n                                  /*                                                        */',
        },
        'Bar_execute_body_input0_unlock': {
          'passes': [
            'Bar_execute_body_input0_evaluate',
          ],
          'name': 'execute body (input #0)',
          'script': '// "execute" function parameters\n<body_s.schnorr_signature.all_outputs_all_utxos> // sig\n<body_pk> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n\n// "Bar" constructor parameters\n<body_pkh_bar> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>',
          'unlocks': 'Bar_execute_body_lock',
        },
        'Bar_execute_input1_unlock': {
          'passes': [
            'Bar_execute_input1_evaluate',
          ],
          'name': 'execute (input #1)',
          'script': expect.stringContaining('// "execute" function parameters\n<s> // sig = <0x'),
          'unlocks': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
        },
        'Bar_execute_body_input1_unlock': {
          'passes': [
            'Bar_execute_body_input1_evaluate',
          ],
          'name': 'execute body (input #1)',
          'script': '// "execute" function parameters\n<body_s.schnorr_signature.all_outputs_all_utxos> // sig\n<body_pk> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>\n\n// "Bar" constructor parameters\n<body_pkh_bar> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>',
          'unlocks': 'Bar_execute_body_lock',
        },
      },
      'scenarios': {
        'Bar_execute_input0_evaluate': {
          'name': 'Evaluate Bar execute (input #0)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0x53f23b6b',
              'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Bar_execute_body_input0_evaluate': {
          'name': 'Evaluate Bar execute body (input #0)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'body_pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {
                'body_s': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Bar_execute_body_lock',
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Bar_execute_input1_evaluate': {
          'name': 'Evaluate Bar execute (input #1)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0x53f23b6b',
              'pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input0_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Bar_execute_body_input1_evaluate': {
          'name': 'Evaluate Bar execute body (input #1)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_pk': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'body_pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {
                'body_s': '71080d8b52ec7b12adaec909ed54cd989b682ce2c35647eec219a16f5f90c528',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'Bar_execute_input0_unlock',
                  'overrides': {
                    'bytecode': {
                      'function_index': '0x53f23b6b',
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      's': expect.stringMatching(/^0x[0-9a-f]{130}$/),
                      'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {},
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.any(String),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'Bar_execute_body_lock',
                },
                'token': undefined,
                'valueSatoshis': 20000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'Bar_a2440b1994a488c1c8be1433b440366e4f84c8b10d5bc544876629ae0fcaa25c_lock',
                'overrides': {
                  'bytecode': {
                    'pkh_bar': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'token': undefined,
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
];
