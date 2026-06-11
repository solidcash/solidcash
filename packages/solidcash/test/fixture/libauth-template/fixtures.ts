import { Contract, HashType, MockNetworkProvider, SignatureAlgorithm, SignatureTemplate, TransactionBuilder, randomNFT, randomToken, randomUtxo } from '../../../src/index.js';
import TransferWithTimeout from '../transfer_with_timeout.artifact.js';
import Mecenas from '../mecenas.artifact.js';
import P2PKH from '../p2pkh.artifact.js';
import HoldVault from '../hodl_vault.artifact.js';
import { aliceAddress, alicePkh, alicePriv, alicePub, bobAddress, bobPkh, bobPriv, bobPub, oracle, oraclePub } from '../vars.js';
import { WalletTemplate, hexToBin } from '@bitauth/libauth';

const provider = new MockNetworkProvider();

export interface Fixture {
  name: string;
  transaction: TransactionBuilder | Promise<TransactionBuilder>;
  template: WalletTemplate;
}

export const fixtures: Fixture[] = [
  {
    name: 'TransferWithTimeout (transfer function)',
    transaction: (async () => {
      const contract = new Contract(TransferWithTimeout, [alicePub, bobPub, 100000n], { provider });
      const contractUtxo = randomUtxo();
      await provider.addUtxo(contract.address, contractUtxo);

      const tx = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.transfer(new SignatureTemplate(bobPriv)))
        .addOutput({ to: contract.address, amount: 10000n });

      return tx;
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
            'TransferWithTimeout_5cf387ecfc225badaa6c361c71b885501fe3d1fcbf5fca79bbe483b8f990c7e1_lock',
            'TransferWithTimeout_transfer_input0_unlock',
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
        'TransferWithTimeout_body_input0_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'TransferWithTimeout transfer body (input #0)',
          'scripts': [
            'TransferWithTimeout_transfer_body_lock',
            'TransferWithTimeout_transfer_body_input0_unlock',
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
        'TransferWithTimeout_transfer_input0_unlock': {
          'passes': [
            'TransferWithTimeout_transfer_input0_evaluate',
          ],
          'name': 'transfer (input #0)',
          'script': expect.stringContaining('// "transfer" function parameters\n<recipientSig> // sig = <0x'),
          'unlocks': 'TransferWithTimeout_5cf387ecfc225badaa6c361c71b885501fe3d1fcbf5fca79bbe483b8f990c7e1_lock',
        },
        'TransferWithTimeout_5cf387ecfc225badaa6c361c71b885501fe3d1fcbf5fca79bbe483b8f990c7e1_lock': {
          'lockingType': 'p2sh32',
          'name': 'TransferWithTimeout',
          'script': "// \"TransferWithTimeout\" contract constructor parameters\n<timeout> // int = <0xa08601>\n<recipient> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>\n<sender> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n\n// bytecode\n                                                                               /* contract TransferWithTimeout(                                             */\n                                                                               /*     pubkey sender,                                                        */\n                                                                               /*     pubkey recipient,                                                     */\n                                                                               /*     int timeout                                                           */\n                                                                               /* ) {                                                                       */\n                                                                               /*     // Require recipient's signature to match                             */\n<0x537a7bac7777> <0x3486e360> OP_DEFINE                                        /*     function transfer(sig recipientSig) {                                 */\n                                                                               /*         require(checkSig(recipientSig, recipient));                       */\n                                                                               /*     }                                                                     */\n                                                                               /*                                                                           */\n                                                                               /*     // Require timeout time to be reached and sender's signature to match */\n<0x537a7cad7cb16d51> <0x2203057b> OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE /*     function timeout(sig senderSig) {                                     */\n                                                                               /*         require(checkSig(senderSig, sender));                             */\n                                                                               /*         require(tx.time >= timeout);                                      */\n                                                                               /*     }                                                                     */\n                                                                               /* }                                                                         */\n                                                                               /*                                                                           */",
        },
        'TransferWithTimeout_transfer_body_lock': {
          'lockingType': 'standard',
          'name': 'TransferWithTimeout transfer (function body)',
          'script': "                                /* contract TransferWithTimeout(                                             */\n                                /*     pubkey sender,                                                        */\n                                /*     pubkey recipient,                                                     */\n                                /*     int timeout                                                           */\n                                /* ) {                                                                       */\n                                /*     // Require recipient's signature to match                             */\n                                /*     function transfer(sig recipientSig) {                                 */\nOP_3 OP_ROLL OP_ROT OP_CHECKSIG /*         require(checkSig(recipientSig, recipient));                       */\nOP_NIP OP_NIP                   /*     }                                                                     */\n                                /*                                                                           */\n                                /*     // Require timeout time to be reached and sender's signature to match */\n                                /*     function timeout(sig senderSig) {                                     */\n                                /*         require(checkSig(senderSig, sender));                             */\n                                /*         require(tx.time >= timeout);                                      */\n                                /*     }                                                                     */\n                                /* }                                                                         */\n                                /*                                                                           */",
        },
        'TransferWithTimeout_transfer_body_input0_unlock': {
          'passes': [
            'TransferWithTimeout_transfer_body_input0_evaluate',
          ],
          'name': 'transfer body (input #0)',
          'script': '// "transfer" function parameters\n<body_recipientSig.schnorr_signature.all_outputs_all_utxos> // sig\n\n// "TransferWithTimeout" constructor parameters\n<body_timeout> // int = <0xa08601>\n<body_recipient> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>\n<body_sender> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>',
          'unlocks': 'TransferWithTimeout_transfer_body_lock',
        },
      },
      'scenarios': {
        'TransferWithTimeout_transfer_input0_evaluate': {
          'name': 'Evaluate TransferWithTimeout transfer (input #0)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'function_index': '0x3486e360',
              'recipientSig': expect.stringMatching(/^0x[0-9a-f]{130}$/),
              'sender': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'recipient': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
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
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': expect.any(Number),
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_5cf387ecfc225badaa6c361c71b885501fe3d1fcbf5fca79bbe483b8f990c7e1_lock',
                  'overrides': {
                    'bytecode': {
                      'sender': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'recipient': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'timeout': '0xa08601',
                    },
                  },
                },
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
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_transfer_body_input0_evaluate': {
          'name': 'Evaluate TransferWithTimeout transfer body (input #0)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_sender': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'body_recipient': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
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
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': expect.any(Number),
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_transfer_body_lock',
                },
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
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
  {
    name: 'TransferWithTimeout (timeout function)',
    transaction: (async () => {
      const contract = new Contract(TransferWithTimeout, [alicePub, bobPub, 100000n], { provider });
      const contractUtxo = randomUtxo();
      await provider.addUtxo(contract.address, contractUtxo);

      const tx = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.timeout(new SignatureTemplate(alicePriv)))
        .addOutput({ to: contract.address, amount: 10000n })
        .setLocktime(133700);

      return tx;
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
            'TransferWithTimeout_5cf387ecfc225badaa6c361c71b885501fe3d1fcbf5fca79bbe483b8f990c7e1_lock',
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
      },
      'scripts': {
        'TransferWithTimeout_timeout_input0_unlock': {
          'passes': [
            'TransferWithTimeout_timeout_input0_evaluate',
          ],
          'name': 'timeout (input #0)',
          'script': expect.stringContaining('// "timeout" function parameters\n<senderSig> // sig = <0x'),
          'unlocks': 'TransferWithTimeout_5cf387ecfc225badaa6c361c71b885501fe3d1fcbf5fca79bbe483b8f990c7e1_lock',
        },
        'TransferWithTimeout_5cf387ecfc225badaa6c361c71b885501fe3d1fcbf5fca79bbe483b8f990c7e1_lock': {
          'lockingType': 'p2sh32',
          'name': 'TransferWithTimeout',
          'script': "// \"TransferWithTimeout\" contract constructor parameters\n<timeout> // int = <0xa08601>\n<recipient> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>\n<sender> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n\n// bytecode\n                                                                               /* contract TransferWithTimeout(                                             */\n                                                                               /*     pubkey sender,                                                        */\n                                                                               /*     pubkey recipient,                                                     */\n                                                                               /*     int timeout                                                           */\n                                                                               /* ) {                                                                       */\n                                                                               /*     // Require recipient's signature to match                             */\n<0x537a7bac7777> <0x3486e360> OP_DEFINE                                        /*     function transfer(sig recipientSig) {                                 */\n                                                                               /*         require(checkSig(recipientSig, recipient));                       */\n                                                                               /*     }                                                                     */\n                                                                               /*                                                                           */\n                                                                               /*     // Require timeout time to be reached and sender's signature to match */\n<0x537a7cad7cb16d51> <0x2203057b> OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE /*     function timeout(sig senderSig) {                                     */\n                                                                               /*         require(checkSig(senderSig, sender));                             */\n                                                                               /*         require(tx.time >= timeout);                                      */\n                                                                               /*     }                                                                     */\n                                                                               /* }                                                                         */\n                                                                               /*                                                                           */",
        },
        'TransferWithTimeout_timeout_body_lock': {
          'lockingType': 'standard',
          'name': 'TransferWithTimeout timeout (function body)',
          'script': "                                       /* contract TransferWithTimeout(                                             */\n                                       /*     pubkey sender,                                                        */\n                                       /*     pubkey recipient,                                                     */\n                                       /*     int timeout                                                           */\n                                       /* ) {                                                                       */\n                                       /*     // Require recipient's signature to match                             */\n                                       /*     function transfer(sig recipientSig) {                                 */\n                                       /*         require(checkSig(recipientSig, recipient));                       */\n                                       /*     }                                                                     */\n                                       /*                                                                           */\n                                       /*     // Require timeout time to be reached and sender's signature to match */\n                                       /*     function timeout(sig senderSig) {                                     */\nOP_3 OP_ROLL OP_SWAP OP_CHECKSIGVERIFY /*         require(checkSig(senderSig, sender));                             */\nOP_SWAP OP_CHECKLOCKTIMEVERIFY         /*         require(tx.time >= timeout);                                      */\nOP_2DROP OP_1                          /*     }                                                                     */\n                                       /* }                                                                         */\n                                       /*                                                                           */",
        },
        'TransferWithTimeout_timeout_body_input0_unlock': {
          'passes': [
            'TransferWithTimeout_timeout_body_input0_evaluate',
          ],
          'name': 'timeout body (input #0)',
          'script': '// "timeout" function parameters\n<body_senderSig.schnorr_signature.all_outputs_all_utxos> // sig\n\n// "TransferWithTimeout" constructor parameters\n<body_timeout> // int = <0xa08601>\n<body_recipient> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>\n<body_sender> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>',
          'unlocks': 'TransferWithTimeout_timeout_body_lock',
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
              'sender': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'recipient': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
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
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 133700,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_5cf387ecfc225badaa6c361c71b885501fe3d1fcbf5fca79bbe483b8f990c7e1_lock',
                  'overrides': {
                    'bytecode': {
                      'sender': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'recipient': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                      'timeout': '0xa08601',
                    },
                  },
                },
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
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'TransferWithTimeout_timeout_body_input0_evaluate': {
          'name': 'Evaluate TransferWithTimeout timeout body (input #0)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_sender': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'body_recipient': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
              'body_timeout': '0xa08601',
            },
            'keys': {
              'privateKeys': {
                'body_senderSig': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 133700,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'TransferWithTimeout_timeout_body_lock',
                },
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
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
  {
    name: 'Mecenas',
    transaction: (async () => {
      const contract = new Contract(Mecenas, [alicePkh, bobPkh, 10_000n], { provider });
      const contractUtxo = randomUtxo();
      await provider.addUtxo(contract.address, contractUtxo);

      const hardcodedFee = 1000n;
      const changeAmount = contractUtxo.satoshis - 10_000n - hardcodedFee;

      const tx = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.recvFunds())
        .addOutput({ to: aliceAddress, amount: 10_000n })
        .addOutput({ to: contract.address, amount: changeAmount })
        .setLocktime(133700);

      return tx;
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
        'Mecenas_input0_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'Mecenas (input #0)',
          'scripts': [
            'Mecenas_d3cb7ac954ae75795cad233e8fcc98b96b4332d39cbe565cda4007b0c2532a30_lock',
            'Mecenas_recvFunds_input0_unlock',
          ],
          'variables': {
            'recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'funder': {
              'description': '"funder" parameter of this contract',
              'name': 'funder',
              'type': 'WalletData',
            },
            'pledge': {
              'description': '"pledge" parameter of this contract',
              'name': 'pledge',
              'type': 'WalletData',
            },
            'function_index': {
              'description': 'Script function index to execute',
              'name': 'function_index',
              'type': 'WalletData',
            },
          },
        },
        'Mecenas_body_input0_parameters': {
          'description': 'Function body expanded view parameters',
          'name': 'Mecenas recvFunds body (input #0)',
          'scripts': [
            'Mecenas_recvFunds_body_lock',
            'Mecenas_recvFunds_body_input0_unlock',
          ],
          'variables': {
            'body_recipient': {
              'description': '"recipient" parameter of this contract',
              'name': 'recipient',
              'type': 'WalletData',
            },
            'body_funder': {
              'description': '"funder" parameter of this contract',
              'name': 'funder',
              'type': 'WalletData',
            },
            'body_pledge': {
              'description': '"pledge" parameter of this contract',
              'name': 'pledge',
              'type': 'WalletData',
            },
          },
        },
      },
      'scripts': {
        'Mecenas_recvFunds_input0_unlock': {
          'passes': [
            'Mecenas_recvFunds_input0_evaluate',
          ],
          'name': 'recvFunds (input #0)',
          'script': '// function selector\n<function_index> // bytes4 = <0xe8e62fca>\n\n// "recvFunds" function parameters\n// none\n',
          'unlocks': 'Mecenas_d3cb7ac954ae75795cad233e8fcc98b96b4332d39cbe565cda4007b0c2532a30_lock',
        },
        'Mecenas_d3cb7ac954ae75795cad233e8fcc98b96b4332d39cbe565cda4007b0c2532a30_lock': {
          'lockingType': 'p2sh32',
          'name': 'Mecenas',
          'script': expect.stringContaining('<0x00cd0376a9147b7e0288ac7e8802e803c0c676547994527994765579547993a16300cc707c949d6700cc55799d51cdc0c78851cc789d686d6d7551> <0xe8e62fca> OP_DEFINE'),
        },
        'Mecenas_recvFunds_body_lock': {
          'lockingType': 'standard',
          'name': 'Mecenas recvFunds (function body)',
          'script': expect.stringContaining('OP_0 OP_OUTPUTBYTECODE <0x76a914> OP_ROT OP_CAT <0x88ac> OP_CAT OP_EQUALVERIFY'),
        },
        'Mecenas_recvFunds_body_input0_unlock': {
          'passes': [
            'Mecenas_recvFunds_body_input0_evaluate',
          ],
          'name': 'recvFunds body (input #0)',
          'script': '// "recvFunds" function parameters\n// none\n\n// "Mecenas" constructor parameters\n<body_pledge> // int = <0x1027>\n<body_funder> // bytes20 = <0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0>\n<body_recipient> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>',
          'unlocks': 'Mecenas_recvFunds_body_lock',
        },
      },
      'scenarios': {
        'Mecenas_recvFunds_input0_evaluate': {
          'name': 'Evaluate Mecenas recvFunds (input #0)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'recipient': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
              'funder': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
              'pledge': '0x1027',
              'function_index': '0xe8e62fca',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 133700,
            'outputs': [
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'valueSatoshis': 10000,
              },
              {
                'lockingBytecode': {
                  'script': 'Mecenas_d3cb7ac954ae75795cad233e8fcc98b96b4332d39cbe565cda4007b0c2532a30_lock',
                  'overrides': {
                    'bytecode': {
                      'recipient': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                      'funder': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
                      'pledge': '0x1027',
                    },
                  },
                },
                'valueSatoshis': expect.any(Number),
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'Mecenas_recvFunds_body_input0_evaluate': {
          'name': 'Evaluate Mecenas recvFunds body (input #0)',
          'description': 'Function body expanded view.',
          'data': {
            'bytecode': {
              'body_recipient': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
              'body_funder': '0xb40a2013337edb0dfe307f0a57d5dec5bfe60dd0',
              'body_pledge': '0x1027',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 133700,
            'outputs': [
              {
                'lockingBytecode': '76a914512dbb2c8c02efbac8d92431aa0ac33f6b0bf97088ac',
                'valueSatoshis': 10000,
              },
              {
                'lockingBytecode': {
                  'script': 'Mecenas_recvFunds_body_lock',
                },
                'valueSatoshis': expect.any(Number),
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
  {
    name: 'P2PKH (sending fungible tokens)',
    transaction: (async () => {
      const contract = new Contract(P2PKH, [alicePkh], { provider });

      const regularUtxo = randomUtxo();
      const tokenUtxo = randomUtxo({ satoshis: 1000n, token: randomToken() });
      await provider.addUtxo(contract.address, regularUtxo);
      await provider.addUtxo(contract.address, tokenUtxo);

      const to = contract.tokenAddress;
      const amount = 1000n;

      const tx = new TransactionBuilder({ provider })
        .addInputs([regularUtxo, tokenUtxo], contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount, token: tokenUtxo.token });

      return tx;
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
        'P2PKH_input0_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'P2PKH (input #0)',
          'scripts': [
            'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
            'P2PKH_spend_input0_unlock',
          ],
          'variables': {
            'pk': {
              'description': '"pk" parameter of function "spend"',
              'name': 'pk',
              'type': 'WalletData',
            },
            's': {
              'description': '"s" parameter of function "spend"',
              'name': 's',
              'type': 'Key',
            },
            'pkh': {
              'description': '"pkh" parameter of this contract',
              'name': 'pkh',
              'type': 'WalletData',
            },
          },
        },
        'P2PKH_input1_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'P2PKH (input #1)',
          'scripts': [
            'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
            'P2PKH_spend_input1_unlock',
          ],
          'variables': {
            'pk': {
              'description': '"pk" parameter of function "spend"',
              'name': 'pk',
              'type': 'WalletData',
            },
            's': {
              'description': '"s" parameter of function "spend"',
              'name': 's',
              'type': 'Key',
            },
            'pkh': {
              'description': '"pkh" parameter of this contract',
              'name': 'pkh',
              'type': 'WalletData',
            },
          },
        },
      },
      'scripts': {
        'P2PKH_spend_input0_unlock': {
          'passes': [
            'P2PKH_spend_input0_evaluate',
          ],
          'name': 'spend (input #0)',
          'script': '// "spend" function parameters\n<s.schnorr_signature.all_outputs_all_utxos> // sig\n<pk> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n',
          'unlocks': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
        },
        'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock': {
          'lockingType': 'p2sh32',
          'name': 'P2PKH',
          'script': '// "P2PKH" contract constructor parameters\n<pkh> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>\n\n// bytecode\n                                  /* contract P2PKH(bytes20 pkh) {                                */\n                                  /*     // Require pk to match stored pkh and signature to match */\n                                  /*     function spend(pubkey pk, sig s) {                       */\nOP_OVER OP_HASH160 OP_EQUALVERIFY /*         require(hash160(pk) == pkh);                         */\nOP_CHECKSIG                       /*         require(checkSig(s, pk));                            */\n                                  /*     }                                                        */\n                                  /* }                                                            */\n                                  /*                                                              */',
        },
        'P2PKH_spend_input1_unlock': {
          'passes': [
            'P2PKH_spend_input1_evaluate',
          ],
          'name': 'spend (input #1)',
          'script': '// "spend" function parameters\n<s.schnorr_signature.all_outputs_all_utxos> // sig\n<pk> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n',
          'unlocks': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
        },
      },
      'scenarios': {
        'P2PKH_spend_input0_evaluate': {
          'name': 'Evaluate P2PKH spend (input #0)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {
                's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'overrides': {
                    'bytecode': {
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
                      },
                    },
                  },
                  'script': 'P2PKH_spend_input1_unlock',
                },
              },
            ],
            'locktime': expect.any(Number),
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                },
                'valueSatoshis': 1000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
                'overrides': {
                  'bytecode': {
                    'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'valueSatoshis': 1000,
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
              },
            },
          ],
        },
        'P2PKH_spend_input1_evaluate': {
          'name': 'Evaluate P2PKH spend (input #1)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {
                's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'overrides': {
                    'bytecode': {
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
                      },
                    },
                  },
                  'script': 'P2PKH_spend_input0_unlock',
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
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
                  'script': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'token': {
                  'amount': expect.stringMatching(/^[0-9]+$/),
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                },
                'valueSatoshis': 1000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
                'overrides': {
                  'bytecode': {
                    'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': 1000,
              'token': {
                'amount': expect.stringMatching(/^[0-9]+$/),
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
              },
            },
          ],
        },
      },
    },
  },
  {
    name: 'P2PKH (hardcoded signature)',
    transaction: (async () => {
      const contract = new Contract(P2PKH, [alicePkh], { provider });

      const regularUtxo = randomUtxo();
      await provider.addUtxo(contract.address, regularUtxo);

      const to = contract.tokenAddress;
      const amount = 1000n;

      const hardcodedSignature = new SignatureTemplate(alicePriv).generateSignature(hexToBin('c0ffee'));
      const tx = new TransactionBuilder({ provider })
        .addInput(regularUtxo, contract.unlock.spend(alicePub, hardcodedSignature))
        .addOutput({ to, amount });

      return tx;
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
        'P2PKH_input0_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'P2PKH (input #0)',
          'scripts': [
            'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
            'P2PKH_spend_input0_unlock',
          ],
          'variables': {
            'pk': {
              'description': '"pk" parameter of function "spend"',
              'name': 'pk',
              'type': 'WalletData',
            },
            's': {
              'description': '"s" parameter of function "spend"',
              'name': 's',
              'type': 'WalletData',
            },
            'pkh': {
              'description': '"pkh" parameter of this contract',
              'name': 'pkh',
              'type': 'WalletData',
            },
          },
        },
      },
      'scripts': {
        'P2PKH_spend_input0_unlock': {
          'passes': [
            'P2PKH_spend_input0_evaluate',
          ],
          'name': 'spend (input #0)',
          'script': '// "spend" function parameters\n<s> // sig = <0x65f72c5cce773383b45032a3f9f9255814e3d53ee260056e3232cd89e91a0a84278b35daf8938d47047e7d3bd3407fe90b07dfabf4407947af6fb09730a34c0b61>\n<pk> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n',
          'unlocks': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
        },
        'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock': {
          'lockingType': 'p2sh32',
          'name': 'P2PKH',
          'script': '// "P2PKH" contract constructor parameters\n<pkh> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>\n\n// bytecode\n                                  /* contract P2PKH(bytes20 pkh) {                                */\n                                  /*     // Require pk to match stored pkh and signature to match */\n                                  /*     function spend(pubkey pk, sig s) {                       */\nOP_OVER OP_HASH160 OP_EQUALVERIFY /*         require(hash160(pk) == pkh);                         */\nOP_CHECKSIG                       /*         require(checkSig(s, pk));                            */\n                                  /*     }                                                        */\n                                  /* }                                                            */\n                                  /*                                                              */',
        },
      },
      'scenarios': {
        'P2PKH_spend_input0_evaluate': {
          'name': 'Evaluate P2PKH spend (input #0)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              's': '0x65f72c5cce773383b45032a3f9f9255814e3d53ee260056e3232cd89e91a0a84278b35daf8938d47047e7d3bd3407fe90b07dfabf4407947af6fb09730a34c0b61',
              'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {},
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
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
                  'script': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'valueSatoshis': 1000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
  {
    name: 'P2PKH (sending NFTs)',
    transaction: (async () => {
      const contract = new Contract(P2PKH, [alicePkh], { provider });

      const regularUtxo = randomUtxo();
      const nftUtxo = randomUtxo({ satoshis: 1000n, token: randomNFT() });
      await provider.addUtxo(contract.address, regularUtxo);
      await provider.addUtxo(contract.address, nftUtxo);

      const to = contract.tokenAddress;
      const amount = 1000n;

      const tx = new TransactionBuilder({ provider })
        .addInputs([regularUtxo, nftUtxo], contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)))
        .addOutput({ to, amount, token: nftUtxo.token });

      return tx;
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
        'P2PKH_input0_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'P2PKH (input #0)',
          'scripts': [
            'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
            'P2PKH_spend_input0_unlock',
          ],
          'variables': {
            'pk': {
              'description': '"pk" parameter of function "spend"',
              'name': 'pk',
              'type': 'WalletData',
            },
            's': {
              'description': '"s" parameter of function "spend"',
              'name': 's',
              'type': 'Key',
            },
            'pkh': {
              'description': '"pkh" parameter of this contract',
              'name': 'pkh',
              'type': 'WalletData',
            },
          },
        },
        'P2PKH_input1_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'P2PKH (input #1)',
          'scripts': [
            'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
            'P2PKH_spend_input1_unlock',
          ],
          'variables': {
            'pk': {
              'description': '"pk" parameter of function "spend"',
              'name': 'pk',
              'type': 'WalletData',
            },
            's': {
              'description': '"s" parameter of function "spend"',
              'name': 's',
              'type': 'Key',
            },
            'pkh': {
              'description': '"pkh" parameter of this contract',
              'name': 'pkh',
              'type': 'WalletData',
            },
          },
        },
      },
      'scripts': {
        'P2PKH_spend_input0_unlock': {
          'passes': [
            'P2PKH_spend_input0_evaluate',
          ],
          'name': 'spend (input #0)',
          'script': '// "spend" function parameters\n<s.schnorr_signature.all_outputs_all_utxos> // sig\n<pk> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n',
          'unlocks': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
        },
        'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock': {
          'lockingType': 'p2sh32',
          'name': 'P2PKH',
          'script': '// "P2PKH" contract constructor parameters\n<pkh> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>\n\n// bytecode\n                                  /* contract P2PKH(bytes20 pkh) {                                */\n                                  /*     // Require pk to match stored pkh and signature to match */\n                                  /*     function spend(pubkey pk, sig s) {                       */\nOP_OVER OP_HASH160 OP_EQUALVERIFY /*         require(hash160(pk) == pkh);                         */\nOP_CHECKSIG                       /*         require(checkSig(s, pk));                            */\n                                  /*     }                                                        */\n                                  /* }                                                            */\n                                  /*                                                              */',
        },
        'P2PKH_spend_input1_unlock': {
          'passes': [
            'P2PKH_spend_input1_evaluate',
          ],
          'name': 'spend (input #1)',
          'script': '// "spend" function parameters\n<s.schnorr_signature.all_outputs_all_utxos> // sig\n<pk> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n',
          'unlocks': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
        },
      },
      'scenarios': {
        'P2PKH_spend_input0_evaluate': {
          'name': 'Evaluate P2PKH spend (input #0)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {
                's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'overrides': {
                    'bytecode': {
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
                      },
                    },
                  },
                  'script': 'P2PKH_spend_input1_unlock',
                },
              },
            ],
            'locktime': 0,
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'token': {
                  'amount': '0',
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'none',
                    'commitment': expect.stringMatching(/^[0-9a-f]{8}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
                'overrides': {
                  'bytecode': {
                    'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'valueSatoshis': 1000,
              'token': {
                'amount': '0',
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'none',
                  'commitment': expect.stringMatching(/^[0-9a-f]{8}$/),
                },
              },
            },
          ],
        },
        'P2PKH_spend_input1_evaluate': {
          'name': 'Evaluate P2PKH spend (input #1)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {
                's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'overrides': {
                    'bytecode': {
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
                      },
                    },
                  },
                  'script': 'P2PKH_spend_input0_unlock',
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
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
                  'script': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'token': {
                  'amount': '0',
                  'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                  'nft': {
                    'capability': 'none',
                    'commitment': expect.stringMatching(/^[0-9a-f]{8}$/),
                  },
                },
                'valueSatoshis': 1000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': {
                'script': 'P2PKH_34d9ffce86b4d136ca74e9db6f6433d3548966a6be064052e728a4c1d16aa3a5_lock',
                'overrides': {
                  'bytecode': {
                    'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': 1000,
              'token': {
                'amount': '0',
                'category': expect.stringMatching(/^[0-9a-f]{64}$/),
                'nft': {
                  'capability': 'none',
                  'commitment': expect.stringMatching(/^[0-9a-f]{8}$/),
                },
              },
            },
          ],
        },
      },
    },
  },
  {
    name: 'HodlVault (datasig)',
    transaction: (async () => {
      const contract = new Contract(HoldVault, [alicePub, oraclePub, 99000n, 30000n], { provider });
      const contractUtxo = randomUtxo();
      await provider.addUtxo(contract.address, contractUtxo);

      // given
      const message = oracle.createMessage(100000n, 30000n);
      const oracleSig = oracle.signMessage(message);
      const to = contract.address;
      const amount = 10000n;
      const aliceTemplate = new SignatureTemplate(alicePriv);

      // when
      const tx = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.spend(aliceTemplate, oracleSig, message))
        .addOutput({ to, amount })
        .setLocktime(133700);

      return tx;
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
          'script': '// \"HodlVault\" contract constructor parameters\n<priceTarget> // int = <0x3075>\n<minBlock> // int = <0xb88201>\n<oraclePk> // pubkey = <0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38>\n<ownerPk> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n\n// bytecode\n                                                             /* // This contract forces HODLing until a certain price target has been reached                                          */\n                                                             /* // A minimum block is provided to ensure that oracle price entries from before this block are disregarded              */\n                                                             /* // i.e. when the BCH price was $1000 in the past, an oracle entry with the old block number and price can not be used. */\n                                                             /* // Instead, a message with a block number and price from after the minBlock needs to be passed.                        */\n                                                             /* // This contract serves as a simple example for checkDataSig-based contracts.                                          */\n                                                             /* contract HodlVault(                                                                                                    */\n                                                             /*     pubkey ownerPk,                                                                                                    */\n                                                             /*     pubkey oraclePk,                                                                                                   */\n                                                             /*     int minBlock,                                                                                                      */\n                                                             /*     int priceTarget                                                                                                    */\n                                                             /* ) {                                                                                                                    */\n                                                             /*     function spend(                                                                                                    */\n                                                             /*         sig ownerSig,                                                                                                  */\n                                                             /*         datasig oracleSig,                                                                                             */\nOP_6 OP_PICK OP_SIZE OP_8 OP_EQUALVERIFY OP_DROP             /*         bytes8 oracleMessage                                                                                           */\n                                                             /*     ) {                                                                                                                */\n                                                             /*         // message: { blockHeight, price }                                                                             */\nOP_6 OP_PICK OP_4 OP_SPLIT                                   /*         bytes4 blockHeightBin, bytes4 priceBin = oracleMessage.split(4);                                               */\nOP_SWAP OP_BIN2NUM                                           /*         int blockHeight = int(blockHeightBin);                                                                         */\nOP_SWAP OP_BIN2NUM                                           /*         int price = int(priceBin);                                                                                     */\n                                                             /*                                                                                                                        */\n                                                             /*         // Check that blockHeight is after minBlock and not in the future                                              */\nOP_OVER OP_5 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY         /*         require(blockHeight >= minBlock);                                                                              */\nOP_SWAP OP_CHECKLOCKTIMEVERIFY OP_DROP                       /*         require(tx.time >= blockHeight);                                                                               */\n                                                             /*                                                                                                                        */\n                                                             /*         // Check that current price is at least priceTarget                                                            */\nOP_3 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY                 /*         require(price >= priceTarget);                                                                                 */\n                                                             /*                                                                                                                        */\n                                                             /*         // Handle necessary signature checks                                                                           */\nOP_3 OP_ROLL OP_4 OP_ROLL OP_3 OP_ROLL OP_CHECKDATASIGVERIFY /*         require(checkDataSig(oracleSig, oracleMessage, oraclePk));                                                     */\nOP_CHECKSIG                                                  /*         require(checkSig(ownerSig, ownerPk));                                                                          */\n                                                             /*     }                                                                                                                  */\n                                                             /* }                                                                                                                      */\n                                                             /*                                                                                                                        */',
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
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': 133700,
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
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
  // TODO: Make it work with different hashtypes and signature algorithms
  // {
  //   name: 'P2PKH (sending NFTs)',
  //   transaction: (() => {
  //     const contract = new Contract(P2PKH, [alicePkh], { provider });
  //     provider.addUtxo(contract.address, randomUtxo());

  //     const to = contract.address;
  //     const amount = 1000n;

  //     const hashtype = HashType.SIGHASH_SINGLE | HashType.SIGHASH_ANYONECANPAY;
  //     const signatureAlgorithm = SignatureAlgorithm.ECDSA;

  //     const tx = contract.functions
  //       .spend(alicePub, new SignatureTemplate(alicePriv, hashtype, signatureAlgorithm))
  //       .to(to, amount);

  //     return tx;
  //   })(),
  //   template: {} as any,
  // },
  {
    name: 'P2PKH (with P2PKH inputs & P2SH20 address type & ECDSA signature algorithm)',
    transaction: (async () => {
      const contract = new Contract(P2PKH, [alicePkh], { provider, addressType: 'p2sh20' });
      const contractUtxo = randomUtxo();
      await provider.addUtxo(contract.address, contractUtxo);

      const p2pkhUtxo = randomUtxo();
      await provider.addUtxo(aliceAddress, p2pkhUtxo);

      const bobP2pkhUtxo = randomUtxo();
      await provider.addUtxo(bobAddress, bobP2pkhUtxo);

      const to = contract.tokenAddress;
      const amount = 1000n;

      const aliceDefaultTemplate = new SignatureTemplate(alicePriv);
      const aliceCustomTemplate = new SignatureTemplate(alicePriv, HashType.SIGHASH_NONE, SignatureAlgorithm.ECDSA);
      const bobCustomTemplate = new SignatureTemplate(bobPriv, HashType.SIGHASH_ALL, SignatureAlgorithm.ECDSA);

      const tx = new TransactionBuilder({ provider })
        .addInput(p2pkhUtxo, aliceDefaultTemplate.unlockP2PKH())
        .addInput(contractUtxo, contract.unlock.spend(alicePub, aliceCustomTemplate))
        .addInput(bobP2pkhUtxo, bobCustomTemplate.unlockP2PKH())
        .addOutput({ to, amount });

      return tx;
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
        'P2PKH_input1_parameters': {
          'description': 'Contract creation and function parameters',
          'name': 'P2PKH (input #1)',
          'scripts': [
            'P2PKH_eae136efb95be487872bfe03984fc1eb80b23361_lock',
            'P2PKH_spend_input1_unlock',
          ],
          'variables': {
            'pk': {
              'description': '"pk" parameter of function "spend"',
              'name': 'pk',
              'type': 'WalletData',
            },
            's': {
              'description': '"s" parameter of function "spend"',
              'name': 's',
              'type': 'Key',
            },
            'pkh': {
              'description': '"pkh" parameter of this contract',
              'name': 'pkh',
              'type': 'WalletData',
            },
          },
        },
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
      },
      'scripts': {
        'P2PKH_spend_input1_unlock': {
          'passes': [
            'P2PKH_spend_input1_evaluate',
          ],
          'name': 'spend (input #1)',
          'script': '// "spend" function parameters\n<s.ecdsa_signature.no_outputs> // sig\n<pk> // pubkey = <0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088>\n',
          'unlocks': 'P2PKH_eae136efb95be487872bfe03984fc1eb80b23361_lock',
        },
        'P2PKH_eae136efb95be487872bfe03984fc1eb80b23361_lock': {
          'lockingType': 'p2sh20',
          'name': 'P2PKH',
          'script': '// "P2PKH" contract constructor parameters\n<pkh> // bytes20 = <0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970>\n\n// bytecode\n                                  /* contract P2PKH(bytes20 pkh) {                                */\n                                  /*     // Require pk to match stored pkh and signature to match */\n                                  /*     function spend(pubkey pk, sig s) {                       */\nOP_OVER OP_HASH160 OP_EQUALVERIFY /*         require(hash160(pk) == pkh);                         */\nOP_CHECKSIG                       /*         require(checkSig(s, pk));                            */\n                                  /*     }                                                        */\n                                  /* }                                                            */\n                                  /*                                                              */',
        },
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
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'P2PKH_spend_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{142,146}$/),
                      'public_key_2': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    },
                  },
                },
              },
            ],
            'locktime': expect.any(Number),
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'P2PKH_eae136efb95be487872bfe03984fc1eb80b23361_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'valueSatoshis': 1000,
              },
            ],
            'version': 2,
          },
          'sourceOutputs': [
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'P2PKH_eae136efb95be487872bfe03984fc1eb80b23361_lock',
                'overrides': {
                  'bytecode': {
                    'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{142,146}$/),
                    'public_key_2': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'P2PKH_spend_input1_evaluate': {
          'name': 'Evaluate P2PKH spend (input #1)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
              'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
            },
            'keys': {
              'privateKeys': {
                's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
              },
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
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
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'p2pkh_placeholder_unlock_2',
                  'overrides': {
                    'bytecode': {
                      'signature_2': expect.stringMatching(/^0x[0-9a-f]{142,146}$/),
                      'public_key_2': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                    },
                  },
                },
              },
            ],
            'locktime': expect.any(Number),
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'P2PKH_eae136efb95be487872bfe03984fc1eb80b23361_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'valueSatoshis': 1000,
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
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'p2pkh_placeholder_lock_2',
                'overrides': {
                  'bytecode': {
                    'signature_2': expect.stringMatching(/^0x[0-9a-f]{142,146}$/),
                    'public_key_2': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
        'P2PKH_spend_input2_evaluate': {
          'name': 'Evaluate P2PKH spend (input #2)',
          'description': 'An example evaluation where this script execution passes.',
          'data': {
            'bytecode': {
              'signature_2': expect.stringMatching(/^0x[0-9a-f]{142,146}$/),
              'public_key_2': '0x028f1219c918234d6bb06b4782354ff0759bd73036f3c849b88020c79fe013cd38',
            },
          },
          'transaction': {
            'inputs': [
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
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
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': {
                  'script': 'P2PKH_spend_input1_unlock',
                  'overrides': {
                    'bytecode': {
                      'pk': '0x0373cc07b54c22da627b572a387a20ea190c9382e5e6d48c1d5b89c5cea2c4c088',
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                    'keys': {
                      'privateKeys': {
                        's': '36f8155c559f3a670586bbbf9fd52beef6f96124f5a3a39c167fc24b052d24d7',
                      },
                    },
                  },
                },
              },
              {
                'outpointIndex': expect.any(Number),
                'outpointTransactionHash': expect.stringMatching(/^[0-9a-f]{64}$/),
                'sequenceNumber': 4294967294,
                'unlockingBytecode': [
                  'slot',
                ],
              },
            ],
            'locktime': expect.any(Number),
            'outputs': [
              {
                'lockingBytecode': {
                  'script': 'P2PKH_eae136efb95be487872bfe03984fc1eb80b23361_lock',
                  'overrides': {
                    'bytecode': {
                      'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                    },
                  },
                },
                'valueSatoshis': 1000,
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
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': {
                'script': 'P2PKH_eae136efb95be487872bfe03984fc1eb80b23361_lock',
                'overrides': {
                  'bytecode': {
                    'pkh': '0x512dbb2c8c02efbac8d92431aa0ac33f6b0bf970',
                  },
                },
              },
              'valueSatoshis': expect.any(Number),
            },
            {
              'lockingBytecode': [
                'slot',
              ],
              'valueSatoshis': expect.any(Number),
            },
          ],
        },
      },
    },
  },
];
