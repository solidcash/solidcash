import { Artifact, CompilerOptions } from '@solidcash/utils';
import { version } from '../../src/index.js';

interface Fixture {
  fn: string,
  artifact: Artifact,
  compilerOptions?: CompilerOptions,
}

export const fixtures: Fixture[] = [
  {
    fn: 'p2pkh.scash',
    artifact: {
      'contractName': 'P2PKH',
      'constructorInputs': [
        {
          'name': 'pkh',
          'type': 'bytes20',
        },
      ],
      'abi': [
        {
          'name': 'spend',
          'selector': '9efe324b',
          'inputs': [
            {
              'name': 'pk',
              'type': 'pubkey',
            },
            {
              'name': 's',
              'type': 'sig',
            },
          ],
        },
      ],
      'bytecode': 'OP_OVER OP_HASH160 OP_EQUALVERIFY OP_CHECKSIG',
      'source': 'contract P2PKH(bytes20 pkh) {\n    function spend(pubkey pk, sig s) {\n        require(hash160(pk) == pkh);\n        require(checkSig(s, pk));\n    }\n}\n',
      'debug': {
        'bytecode': '78a988ac',
        'sourceMap': '3:24:3:26;:16::27:1;:8::36;4::4:33',
        'logs': [],
        'requires': [
          {
            'ip': 3,
            'line': 3,
          },
          {
            'ip': 5,
            'line': 4,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'reassignment.scash',
    artifact: {
      'contractName': 'Reassignment',
      'constructorInputs': [
        {
          'name': 'x',
          'type': 'int256',
        },
        {
          'name': 'y',
          'type': 'string',
        },
      ],
      'abi': [
        {
          'name': 'hello',
          'selector': '4a6ec480',
          'inputs': [
            {
              'name': 'pk',
              'type': 'pubkey',
            },
            {
              'name': 's',
              'type': 'sig',
            },
          ],
        },
      ],
      'bytecode': 'OP_10 OP_4 OP_SUB 14 OP_SWAP OP_2 OP_MOD OP_ADD OP_LESSTHAN OP_VERIFY 48656c6c6f20576f726c64 OP_DUP OP_ROT OP_CAT OP_2 OP_PICK OP_RIPEMD160 OP_SWAP OP_RIPEMD160 OP_EQUALVERIFY OP_ROT OP_ROT OP_CHECKSIG OP_NIP',
      'source': 'contract Reassignment(int x, string y) {\n    function hello(pubkey pk, sig s) {\n        int myVariable = 10 - 4;\n        int myOtherVariable = 20 + myVariable % 2;\n        require(myOtherVariable > x);\n\n        string hw = "Hello World";\n        hw = hw + y;\n\n        require(ripemd160(pk) == ripemd160(hw));\n        require(checkSig(s, pk));\n    }\n}\n',
      'debug': {
        'bytecode': '5a549401147c5297939f690b48656c6c6f20576f726c64767b7e5279a67ca6887b7bac77',
        'sourceMap': '3:25:3:27;:30::31;:25:::1;4:30:4:32:0;:35::45;:48::49;:35:::1;:30;5:16:5:35;:8::37;7:20:7:33:0;8:13:8:15;:18::19;:13:::1;10:26:10:28:0;;:16::29:1;:43::45:0;:33::46:1;:8::48;11:25:11:26:0;:28::30;:8::33:1;2:4:12:5',
        'logs': [],
        'requires': [
          {
            'ip': 11,
            'line': 5,
          },
          {
            'ip': 21,
            'line': 10,
          },
          {
            'ip': 25,
            'line': 11,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'if_statement.scash',
    artifact: {
      'contractName': 'IfStatement',
      'constructorInputs': [
        {
          'name': 'x',
          'type': 'int256',
        },
        {
          'name': 'y',
          'type': 'int256',
        },
      ],
      'abi': [
        {
          'name': 'hello',
          'selector': 'aa4b7226',
          'inputs': [
            {
              'name': 'a',
              'type': 'int256',
            },
            {
              'name': 'b',
              'type': 'int256',
            },
          ],
        },
      ],
      'bytecode': 'OP_2OVER OP_ADD OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_DUP OP_4 OP_PICK OP_SUB OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_DUP OP_3 OP_ROLL OP_2 OP_SUB OP_NUMEQUAL OP_IF OP_DUP OP_5 OP_PICK OP_ADD OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_4 OP_PICK OP_OVER OP_ADD OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_ROT OP_DROP OP_SWAP OP_2DUP OP_LESSTHAN OP_VERIFY OP_DROP OP_ELSE OP_DUP OP_4 OP_PICK OP_NUMEQUALVERIFY OP_ENDIF OP_DUP OP_4 OP_ROLL OP_ADD OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_3 OP_ROLL OP_NUMEQUAL OP_NIP OP_NIP OP_NIP',
      'source': 'contract IfStatement(int x, int y) {\n    function hello(int a, int b) {\n        int d = a + b;\n        d = d - a;\n        if (d == x - 2) {\n            int c = d + b;\n            d = a + c;\n            require(c > d);\n        } else {\n            require(d == a);\n        }\n        d = d + a;\n        require(d == y);\n    }\n}\n',
      'debug': {
        'bytecode': '70937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169765479947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa16976537a52949c63765579937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169547978937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697b757c6e9f6975677654799d6876547a937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169537a9c777777',
        'sourceMap': '3:16:3:21;::::1;;;;;;;;;4:12:4:13:0;:16::17;;:12:::1;;;;;;;;;5::5:13:0;:17::18;;:21::22;:17:::1;:12;:24:9:9:0;6:20:6:21;:24::25;;:20:::1;;;;;;;;;7:16:7:17:0;;:20::21;:16:::1;;;;;;;;;:12::22;;;8:20:8:25:0;::::1;:12::27;5:24:9:9;9:15:11::0;10:20:10:21;:25::26;;:12::28:1;9:15:11:9;12:12:12:13:0;:16::17;;:12:::1;;;;;;;;;13:21:13:22:0;;:8::24:1;2:4:14:5;;',
        'logs': [],
        'requires': [
          {
            'ip': 60,
            'line': 8,
          },
          {
            'ip': 66,
            'line': 10,
          },
          {
            'ip': 83,
            'line': 13,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'multifunction.scash',
    artifact: {
      'contractName': 'MultiFunction',
      'constructorInputs': [
        {
          'name': 'sender',
          'type': 'pubkey',
        },
        {
          'name': 'recipient',
          'type': 'pubkey',
        },
        {
          'name': 'timeout',
          'type': 'int256',
        },
      ],
      'abi': [
        {
          'name': 'transfer',
          'selector': '3486e360',
          'inputs': [
            {
              'name': 'recipientSig',
              'type': 'sig',
            },
          ],
        },
        {
          'name': 'timeout',
          'selector': '2203057b',
          'inputs': [
            {
              'name': 'senderSig',
              'type': 'sig',
            },
          ],
        },
      ],
      'bytecode': '537a7bac7777 3486e360 OP_DEFINE 537a7cad7cb16d51 2203057b OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
      'source': 'contract MultiFunction(\n    pubkey sender,\n    pubkey recipient,\n    int timeout\n) {\n    function transfer(sig recipientSig) {\n        require(checkSig(recipientSig, recipient));\n    }\n\n    function timeout(sig senderSig) {\n        require(checkSig(senderSig, sender));\n        require(tx.time >= timeout);\n    }\n}\n',
      'debug': {
        'bytecode': '06537a7bac7777043486e3608908537a7cad7cb16d51042203057b89748c7a82549d8a',
        'sourceMap': '6:4:8:5;;;10::13;;;1:0:14:1;;;;;;',
        'logs': [],
        'requires': [],
        'functionDebug': {
          '3486e360': {
            'requires': [
              {
                'ip': 4,
                'line': 7,
              },
            ],
            'sourceMap': '7:25:7:37;;:39::48;:8::51:1;6:4:8:5;',
            'logs': [],
          },
          '2203057b': {
            'requires': [
              {
                'ip': 3,
                'line': 11,
              },
              {
                'ip': 5,
                'line': 12,
              },
            ],
            'sourceMap': '11:25:11:34;;:36::42;:8::45:1;12:27:12:34:0;:8::36:1;10:4:13:5;',
            'logs': [],
          },
        },
      },
      'functionBodies': {
        '3486e360': '537a7bac7777',
        '2203057b': '537a7cad7cb16d51',
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'multifunction_if_statements.scash',
    artifact: {
      'contractName': 'MultiFunctionIfStatements',
      'constructorInputs': [
        {
          'name': 'x',
          'type': 'int256',
        },
        {
          'name': 'y',
          'type': 'int256',
        },
      ],
      'abi': [
        {
          'name': 'transfer',
          'selector': '320abd58',
          'inputs': [
            {
              'name': 'a',
              'type': 'int256',
            },
            {
              'name': 'b',
              'type': 'int256',
            },
          ],
        },
        {
          'name': 'timeout',
          'selector': 'a45a12c9',
          'inputs': [
            {
              'name': 'b',
              'type': 'int256',
            },
          ],
        },
      ],
      'bytecode': '70937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169765479947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697653799c6352799267006863765679937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169557978937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697b757c6e9f6975675479776876557a937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169547a9d6d6d51 320abd58 OP_DEFINE 527976529376537a9c63765479937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1696e937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697b757c6e9f697568729c7777 a45a12c9 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
      'source': 'contract MultiFunctionIfStatements(int x, int y) {\n    function transfer(int a, int b) {\n        int d = a + b;\n        d = d - a;\n        if (d == x && bool(x)) {\n            int c = d + b;\n            d = a + c;\n            require(c > d);\n        } else {\n            d = a;\n        }\n        d = d + a;\n        require(d == y);\n    }\n\n    function timeout(int b) {\n        int d = b;\n        d = d + 2;\n        if (d == x) {\n            int c = d + b;\n            d = c + d;\n            require(c > d);\n        }\n        d = b;\n        require(d == y);\n    }\n}\n',
      'debug': {
        'bytecode': '4d9d0170937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169765479947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697653799c6352799267006863765679937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169557978937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697b757c6e9f6975675479776876557a937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169547a9d6d6d5104320abd58894cae527976529376537a9c63765479937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1696e937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697b757c6e9f697568729c777704a45a12c989748c7a82549d8a',
        'sourceMap': '2:4:14:5;;;16::26;;;1:0:27:1;;;;;;',
        'logs': [],
        'requires': [],
        'functionDebug': {
          '320abd58': {
            'requires': [
              {
                'ip': 63,
                'line': 8,
              },
              {
                'ip': 84,
                'line': 13,
              },
            ],
            'sourceMap': '3:16:3:21;::::1;;;;;;;;;4:12:4:13:0;:16::17;;:12:::1;;;;;;;;;5::5:13:0;:17::18;;:12:::1;:::29:0;:27::28;;:22::29:1;:12;;;:31:9:9:0;6:20:6:21;:24::25;;:20:::1;;;;;;;;;7:16:7:17:0;;:20::21;:16:::1;;;;;;;;;:12::22;;;8:20:8:25:0;::::1;:12::27;5:31:9:9;9:15:11::0;10:16:10:17;;:12::18:1;9:15:11:9;12:12:12:13:0;:16::17;;:12:::1;;;;;;;;;13:21:13:22:0;;:8::24:1;2:4:14:5;;',
            'logs': [],
          },
          'a45a12c9': {
            'requires': [
              {
                'ip': 37,
                'line': 22,
              },
              {
                'ip': 42,
                'line': 25,
              },
            ],
            'sourceMap': '17:16:17:17;;18:12:18:13;:16::17;:12:::1;19::19:13:0;:17::18;;:12:::1;:20:23:9:0;20::20:21;:24::25;;:20:::1;;;;;;;;;21:16:21:21:0;::::1;;;;;;;;;:12::22;;;22:20:22:25:0;::::1;:12::27;19:20:23:9;;24:12:25:22:0;25:8::24:1;16:4:26:5;',
            'logs': [],
          },
        },
      },
      'functionBodies': {
        '320abd58': '70937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169765479947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697653799c6352799267006863765679937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169557978937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697b757c6e9f6975675479776876557a937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169547a9d6d6d51',
        'a45a12c9': '527976529376537a9c63765479937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1696e937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697b757c6e9f697568729c7777',
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: '2_of_3_multisig.scash',
    artifact: {
      'contractName': 'MultiSig',
      'constructorInputs': [
        {
          'name': 'pk1',
          'type': 'pubkey',
        },
        {
          'name': 'pk2',
          'type': 'pubkey',
        },
        {
          'name': 'pk3',
          'type': 'pubkey',
        },
      ],
      'abi': [
        {
          'name': 'spend',
          'selector': 'ee615eaf',
          'inputs': [
            {
              'name': 's1',
              'type': 'sig',
            },
            {
              'name': 's2',
              'type': 'sig',
            },
          ],
        },
      ],
      'bytecode': 'OP_0 OP_2ROT OP_SWAP OP_2 OP_2ROT OP_SWAP OP_6 OP_ROLL OP_3 OP_CHECKMULTISIG',
      'source': 'contract MultiSig(pubkey pk1, pubkey pk2, pubkey pk3) {\n  function spend(sig s1, sig s2) {\n    require(checkMultiSig([s1, s2], [pk1, pk2, pk3]));\n  }\n}\n',
      'debug': {
        'bytecode': '00717c52717c567a53ae',
        'sourceMap': '3:12:3:52;:27::33;;:26::34:1;:37::45:0;;:47::50;;:36::51:1;:4::54',
        'logs': [],
        'requires': [
          {
            'ip': 13,
            'line': 3,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'split_size.scash',
    artifact: {
      'contractName': 'SplitSize',
      'constructorInputs': [
        {
          'name': 'b',
          'type': 'bytes',
        },
      ],
      'abi': [
        {
          'name': 'spend',
          'selector': 'f598582f',
          'inputs': [],
        },
      ],
      'bytecode': 'OP_DUP OP_DUP OP_SIZE OP_NIP OP_2 OP_DIV OP_SPLIT OP_NIP OP_2DUP OP_EQUAL OP_NOT OP_VERIFY OP_SWAP OP_4 OP_SPLIT OP_DROP OP_EQUAL OP_NOT',
      'source': 'contract SplitSize(bytes b) {\n    function spend() {\n        bytes x = b.split(b.length / 2)[1];\n        require(x != b);\n        require(b.split(4)[0] != x);\n    }\n}\n',
      'debug': {
        'bytecode': '7676827752967f776e8791697c547f758791',
        'sourceMap': '3:18:3:27;;:26::34:1;;:37::38:0;:26:::1;:18::39;:::42;4:16:4:22:0;::::1;;:8::24;5:16:5:17:0;:24::25;:16::26:1;:::29;:::34;:8::36',
        'logs': [],
        'requires': [
          {
            'ip': 12,
            'line': 4,
          },
          {
            'ip': 19,
            'line': 5,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'cast_hash_checksig.scash',
    artifact: {
      'contractName': 'CastHashChecksig',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'hello',
          'selector': '4a6ec480',
          'inputs': [
            {
              'name': 'pk',
              'type': 'pubkey',
            },
            {
              'name': 's',
              'type': 'sig',
            },
          ],
        },
      ],
      'bytecode': 'OP_DUP OP_RIPEMD160 OP_0 OP_HASH160 OP_EQUAL OP_1 OP_NOT OP_NUMEQUALVERIFY OP_CHECKSIG',
      'source': 'contract CastHashChecksig() {\n    function hello(pubkey pk, sig s) {\n        require((ripemd160(bytes(pk)) == hash160(0x) == !true));\n        require(checkSig(s, pk));\n    }\n}\n',
      'debug': {
        'bytecode': '76a600a98751919dac',
        'sourceMap': '3:33:3:35;:17::37:1;:49::51:0;:41::52:1;:17;:57::61:0;:56:::1;:8::64;4::4:33',
        'logs': [],
        'requires': [
          {
            'ip': 7,
            'line': 3,
          },
          {
            'ip': 9,
            'line': 4,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'hodl_vault.scash',
    artifact: {
      'contractName': 'HodlVault',
      'constructorInputs': [
        {
          'name': 'ownerPk',
          'type': 'pubkey',
        },
        {
          'name': 'oraclePk',
          'type': 'pubkey',
        },
        {
          'name': 'minBlock',
          'type': 'int256',
        },
        {
          'name': 'priceTarget',
          'type': 'int256',
        },
      ],
      'abi': [
        {
          'name': 'spend',
          'selector': '5872af0e',
          'inputs': [
            {
              'name': 'ownerSig',
              'type': 'sig',
            },
            {
              'name': 'oracleSig',
              'type': 'datasig',
            },
            {
              'name': 'oracleMessage',
              'type': 'bytes8',
            },
          ],
        },
      ],
      'bytecode': 'OP_6 OP_PICK OP_SIZE OP_8 OP_EQUALVERIFY OP_DROP OP_6 OP_PICK OP_4 OP_SPLIT OP_SWAP OP_BIN2NUM OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_SWAP OP_BIN2NUM OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_OVER OP_5 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY OP_SWAP OP_CHECKLOCKTIMEVERIFY OP_DROP OP_3 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY OP_3 OP_ROLL OP_4 OP_ROLL OP_3 OP_ROLL OP_CHECKDATASIGVERIFY OP_CHECKSIG',
      'source': '// This contract forces HODLing until a certain price target has been reached\n// A minimum block is provided to ensure that oracle price entries from before this block are disregarded\n// i.e. when the BCH price was $1000 in the past, an oracle entry with the old block number and price can not be used.\n// Instead, a message with a block number and price from after the minBlock needs to be passed.\n// This contract serves as a simple example for checkDataSig-based contracts.\ncontract HodlVault(\n    pubkey ownerPk,\n    pubkey oraclePk,\n    int minBlock,\n    int priceTarget\n) {\n    function spend(\n        sig ownerSig,\n        datasig oracleSig,\n        bytes8 oracleMessage\n    ) {\n        // message: { blockHeight, price }\n        bytes4 blockHeightBin, bytes4 priceBin = oracleMessage.split(4);\n        int blockHeight = int(blockHeightBin);\n        int price = int(priceBin);\n\n        // Check that blockHeight is after minBlock and not in the future\n        require(blockHeight >= minBlock);\n        require(tx.time >= blockHeight);\n\n        // Check that current price is at least priceTarget\n        require(price >= priceTarget);\n\n        // Handle necessary signature checks\n        require(checkDataSig(\n            oracleSig,\n            oracleMessage,\n            oraclePk,\n        ));\n        require(checkSig(ownerSig, ownerPk));\n    }\n}\n',
      'debug': {
        'bytecode': '5679825888755679547f7c817621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697c817621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa16978557aa2697cb175537aa269537a547a537abbac',
        'sourceMap': '15:8:15:28;;;;;;18:49:18:62;;:69::70;:49::71:1;19:30:19:44:0;:26::45:1;;;;;;;;;20:24:20:32:0;:20::33:1;;;;;;;;;23:16:23:27:0;:31::39;;:16:::1;:8::41;24:27:24:38:0;:8::40:1;;27:25:27:36:0;;:16:::1;:8::38;31:12:31:21:0;;32::32:25;;33::33:20;;30:8:34:11:1;35::35:45',
        'logs': [],
        'requires': [
          {
            'ip': 38,
            'line': 23,
          },
          {
            'ip': 40,
            'line': 24,
          },
          {
            'ip': 45,
            'line': 27,
          },
          {
            'ip': 52,
            'line': 30,
          },
          {
            'ip': 54,
            'line': 35,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'deep_replace.scash',
    artifact: {
      'contractName': 'DeepReplace',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'hello',
          'selector': '993cadad',
          'inputs': [],
        },
      ],
      'bytecode': 'OP_1 OP_2 OP_3 OP_4 OP_5 OP_6 OP_5 OP_PICK OP_3 OP_LESSTHAN OP_IF OP_3 OP_6 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_ENDIF OP_2ROT OP_5 OP_ROLL OP_ADD OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_4 OP_ROLL OP_ADD OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_3 OP_ROLL OP_ADD OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_ROT OP_ADD OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_GREATERTHAN',
      'source': 'contract DeepReplace() {\n    function hello() {\n        int a = 1;\n        int b = 2;\n        int c = 3;\n        int d = 4;\n        int e = 5;\n        int f = 6;\n\n        if (a < 3) {\n            a = 3;\n        }\n\n        require(a > b + c + d + e + f);\n    }\n}\n',
      'debug': {
        'bytecode': '5152535455565579539f6353567a757c6b7c6b7c6b7c6b7c6c6c6c6c6871557a937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169547a937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169537a937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697b937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169a0',
        'sourceMap': '3:16:3:17;4::4;5::5;6::6;7::7;8::8;10:12:10:13;;:16::17;:12:::1;:19:12:9:0;11:16:11:17;:12::18:1;;;;;;;;;;;;;;;;10:19:12:9;14:16:14:21:0;:24::25;;:20:::1;;;;;;;;;:28::29:0;;:20:::1;;;;;;;;;:32::33:0;;:20:::1;;;;;;;;;:36::37:0;:20:::1;;;;;;;;;:8::39',
        'logs': [],
        'requires': [
          {
            'ip': 74,
            'line': 14,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'bounded_bytes.scash',
    artifact: {
      'contractName': 'BoundedBytes',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'spend',
          'selector': 'e9d75040',
          'inputs': [
            {
              'name': 'b',
              'type': 'bytes4',
            },
            {
              'name': 'i',
              'type': 'int256',
            },
          ],
        },
      ],
      'bytecode': 'OP_DUP OP_SIZE OP_4 OP_EQUALVERIFY OP_DROP OP_SWAP OP_4 OP_NUM2BIN OP_EQUAL',
      'source': 'contract BoundedBytes() {\n    function spend(bytes4 b, int i) {\n        require(b == toPaddedBytes(i, 4));\n    }\n}\n',
      'debug': {
        'bytecode': '76825488757c548087',
        'sourceMap': '2:19:2:27;;;;;3:35:3:36;:38::39;:21::40:1;:8::42',
        'logs': [],
        'requires': [
          {
            'ip': 9,
            'line': 3,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'covenant.scash',
    artifact: {
      'contractName': 'Covenant',
      'constructorInputs': [
        {
          'name': 'requiredVersion',
          'type': 'int256',
        },
      ],
      'abi': [
        {
          'name': 'spend',
          'selector': 'f598582f',
          'inputs': [],
        },
      ],
      'bytecode': 'OP_TXVERSION OP_NUMEQUALVERIFY OP_ACTIVEBYTECODE 00 OP_EQUAL',
      'source': 'contract Covenant(int requiredVersion) {\n    function spend() {\n        require(tx.version == requiredVersion);\n        require(this.activeBytecode == 0x00);\n    }\n}\n',
      'debug': {
        'bytecode': 'c29dc1010087',
        'sourceMap': '3:16:3:26;:8::47:1;4:16:4:35:0;:39::43;:8::45:1',
        'logs': [],
        'requires': [
          {
            'ip': 2,
            'line': 3,
          },
          {
            'ip': 6,
            'line': 4,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'covenant_all_fields.scash',
    artifact: {
      'contractName': 'Covenant',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'spend',
          'selector': 'f598582f',
          'inputs': [],
        },
      ],
      'bytecode': 'OP_TXLOCKTIME OP_CHECKLOCKTIMEVERIFY OP_DROP OP_TXVERSION OP_2 OP_NUMEQUALVERIFY OP_TXLOCKTIME OP_0 OP_NUMEQUALVERIFY OP_TXINPUTCOUNT OP_1 OP_NUMEQUALVERIFY OP_TXOUTPUTCOUNT OP_1 OP_NUMEQUALVERIFY OP_INPUTINDEX OP_0 OP_NUMEQUALVERIFY OP_ACTIVEBYTECODE OP_SIZE OP_NIP 2c01 OP_NUMEQUALVERIFY OP_0 OP_UTXOVALUE 1027 OP_NUMEQUALVERIFY OP_0 OP_UTXOBYTECODE OP_SIZE OP_NIP 1027 OP_NUMEQUALVERIFY OP_0 OP_OUTPOINTTXHASH 0000000000000000000000000000000000000000000000000000000000000000 OP_EQUALVERIFY OP_0 OP_OUTPOINTINDEX OP_0 OP_NUMEQUALVERIFY OP_0 OP_INPUTBYTECODE OP_SIZE OP_NIP 64 OP_NUMEQUALVERIFY OP_0 OP_INPUTSEQUENCENUMBER OP_0 OP_NUMEQUALVERIFY OP_0 OP_OUTPUTVALUE 1027 OP_NUMEQUALVERIFY OP_0 OP_OUTPUTBYTECODE OP_SIZE OP_NIP 64 OP_NUMEQUALVERIFY OP_0 OP_UTXOTOKENCATEGORY 0000000000000000000000000000000000000000000000000000000000000000 OP_EQUALVERIFY OP_0 OP_UTXOTOKENCOMMITMENT 00 OP_EQUALVERIFY OP_0 OP_UTXOTOKENAMOUNT 64 OP_NUMEQUALVERIFY OP_0 OP_OUTPUTTOKENCATEGORY 0000000000000000000000000000000000000000000000000000000000000000 OP_EQUALVERIFY OP_0 OP_OUTPUTTOKENCOMMITMENT 00 OP_EQUALVERIFY OP_0 OP_OUTPUTTOKENAMOUNT 64 OP_NUMEQUAL',
      'source': 'contract Covenant() {\n    function spend() {\n        require(tx.version == 2);\n        require(tx.locktime == 0);\n        require(tx.inputs.length == 1);\n        require(tx.outputs.length == 1);\n        require(this.activeInputIndex == 0);\n        require(this.activeBytecode.length == 300);\n        require(tx.inputs[0].value == 10000);\n        require(tx.inputs[0].lockingBytecode.length == 10000);\n        require(tx.inputs[0].outpointTransactionHash == 0x000000000000000000000000000000000000000000000000000000000000000);\n        require(tx.inputs[0].outpointIndex == 0);\n        require(tx.inputs[0].unlockingBytecode.length == 100);\n        require(tx.inputs[0].sequenceNumber == 0);\n        require(tx.outputs[0].value == 10000);\n        require(tx.outputs[0].lockingBytecode.length == 100);\n        require(tx.inputs[0].tokenCategory == 0x000000000000000000000000000000000000000000000000000000000000000);\n        require(tx.inputs[0].nftCommitment == 0x00);\n        require(tx.inputs[0].tokenAmount == 100);\n        require(tx.outputs[0].tokenCategory == 0x000000000000000000000000000000000000000000000000000000000000000);\n        require(tx.outputs[0].nftCommitment == 0x00);\n        require(tx.outputs[0].tokenAmount == 100);\n    }\n}\n',
      'debug': {
        'bytecode': 'c5b175c2529dc5009dc3519dc4519dc0009dc18277022c019d00c60210279d00c782770210279d00c82000000000000000000000000000000000000000000000000000000000000000008800c9009d00ca827701649d00cb009d00cc0210279d00cd827701649d00ce2000000000000000000000000000000000000000000000000000000000000000008800cf01008800d001649d00d12000000000000000000000000000000000000000000000000000000000000000008800d201008800d301649c',
        'sourceMap': '2:4:2:4;::::1;;3:16:3:26:0;:30::31;:8::33:1;4:16:4:27:0;:31::32;:8::34:1;5:16:5:32:0;:36::37;:8::39:1;6:16:6:33:0;:37::38;:8::40:1;7:16:7:37:0;:41::42;:8::44:1;8:16:8:35:0;:::42:1;;:46::49:0;:8::51:1;9:26:9:27:0;:16::34:1;:38::43:0;:8::45:1;10:26:10:27:0;:16::44:1;:::51;;:55::60:0;:8::62:1;11:26:11:27:0;:16::52:1;:56::121:0;:8::123:1;12:26:12:27:0;:16::42:1;:46::47:0;:8::49:1;13:26:13:27:0;:16::46:1;:::53;;:57::60:0;:8::62:1;14:26:14:27:0;:16::43:1;:47::48:0;:8::50:1;15:27:15:28:0;:16::35:1;:39::44:0;:8::46:1;16:27:16:28:0;:16::45:1;:::52;;:56::59:0;:8::61:1;17:26:17:27:0;:16::42:1;:46::111:0;:8::113:1;18:26:18:27:0;:16::42:1;:46::50:0;:8::52:1;19:26:19:27:0;:16::40:1;:44::47:0;:8::49:1;20:27:20:28:0;:16::43:1;:47::112:0;:8::114:1;21:27:21:28:0;:16::43:1;:47::51:0;:8::53:1;22:27:22:28:0;:16::41:1;:45::48:0;:8::50:1',
        'logs': [],
        'requires': [
          {
            'ip': 1,
            'line': 2,
            'message': 'Using tx.locktime requires a non-final sequence number on the spending input',
          },
          {
            'ip': 5,
            'line': 3,
          },
          {
            'ip': 8,
            'line': 4,
          },
          {
            'ip': 11,
            'line': 5,
          },
          {
            'ip': 14,
            'line': 6,
          },
          {
            'ip': 17,
            'line': 7,
          },
          {
            'ip': 22,
            'line': 8,
          },
          {
            'ip': 26,
            'line': 9,
          },
          {
            'ip': 32,
            'line': 10,
          },
          {
            'ip': 36,
            'line': 11,
          },
          {
            'ip': 40,
            'line': 12,
          },
          {
            'ip': 46,
            'line': 13,
          },
          {
            'ip': 50,
            'line': 14,
          },
          {
            'ip': 54,
            'line': 15,
          },
          {
            'ip': 60,
            'line': 16,
          },
          {
            'ip': 64,
            'line': 17,
          },
          {
            'ip': 68,
            'line': 18,
          },
          {
            'ip': 72,
            'line': 19,
          },
          {
            'ip': 76,
            'line': 20,
          },
          {
            'ip': 80,
            'line': 21,
          },
          {
            'ip': 85,
            'line': 22,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'mecenas.scash',
    artifact: {
      'contractName': 'Mecenas',
      'constructorInputs': [
        {
          'name': 'recipient',
          'type': 'bytes20',
        },
        {
          'name': 'funder',
          'type': 'bytes20',
        },
        {
          'name': 'pledge',
          'type': 'int256',
        },
        {
          'name': 'period',
          'type': 'int256',
        },
      ],
      'abi': [
        {
          'name': 'recvFunds',
          'selector': 'e8e62fca',
          'inputs': [],
        },
        {
          'name': 'reclaim',
          'selector': '2f7ef34c',
          'inputs': [
            {
              'name': 'pk',
              'type': 'pubkey',
            },
            {
              'name': 's',
              'type': 'sig',
            },
          ],
        },
      ],
      'bytecode': '537ab27500cd0376a9147b7e0288ac7e8802e803c0c6765479947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1695279947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697655795479937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169a16300cc707c947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1699d6700cc55799d51cdc0c78851cc789d686d6d7551 e8e62fca OP_DEFINE 5479a97b88547a547aac777777 2f7ef34c OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
      'source': 'contract Mecenas(bytes20 recipient, bytes20 funder, int pledge, int period) {\n    function recvFunds() {\n        require(this.age >= period);\n\n        // Check that the first output sends to the recipient\n        require(tx.outputs[0].lockingBytecode == new LockingBytecodeP2PKH(recipient));\n\n        int minerFee = 1000;\n        int currentValue = tx.inputs[this.activeInputIndex].value;\n        int changeValue = currentValue - pledge - minerFee;\n\n        // If there is not enough left for *another* pledge after this one, we send the remainder to the recipient\n        // Otherwise we send the remainder to the recipient and the change back to the contract\n        if (changeValue <= pledge + minerFee) {\n            require(tx.outputs[0].value == currentValue - minerFee);\n        } else {\n            require(tx.outputs[0].value == pledge);\n            require(tx.outputs[1].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);\n            require(tx.outputs[1].value == changeValue);\n        }\n    }\n\n    function reclaim(pubkey pk, sig s) {\n        require(hash160(pk) == funder);\n        require(checkSig(s, pk));\n    }\n}\n',
      'debug': {
        'bytecode': '4d6301537ab27500cd0376a9147b7e0288ac7e8802e803c0c6765479947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1695279947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697655795479937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169a16300cc707c947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1699d6700cc55799d51cdc0c78851cc789d686d6d755104e8e62fca890d5479a97b88547a547aac777777042f7ef34c89748c7a82549d8a',
        'sourceMap': '2:4:21:5;;;23::26;;;1:0:27:1;;;;;;',
        'logs': [],
        'requires': [],
        'functionDebug': {
          'e8e62fca': {
            'requires': [
              {
                'ip': 2,
                'line': 3,
              },
              {
                'ip': 11,
                'line': 6,
              },
              {
                'ip': 67,
                'line': 15,
              },
              {
                'ip': 73,
                'line': 17,
              },
              {
                'ip': 78,
                'line': 18,
              },
              {
                'ip': 82,
                'line': 19,
              },
            ],
            'sourceMap': '3:28:3:34;;:8::36:1;;6:27:6:28:0;:16::45:1;:49::84:0;:74::83;:49::84:1;;;:8::86;8:23:8:27:0;9:37:9:58;:27::65:1;10:26:10:38:0;:41::47;;:26:::1;;;;;;;;;:50::58:0;;:26:::1;;;;;;;;;14:12:14:23:0;:27::33;;:36::44;;:27:::1;;;;;;;;;:12;:46:16:9:0;15:31:15:32;:20::39:1;:43::66:0;;::::1;;;;;;;;;:12::68;16:15:20:9:0;17:31:17:32;:20::39:1;:43::49:0;;:12::51:1;18:31:18:32:0;:20::49:1;:63::84:0;:53::101:1;:12::103;19:31:19:32:0;:20::39:1;:43::54:0;:12::56:1;16:15:20:9;2:4:21:5;;;',
            'logs': [],
          },
          '2f7ef34c': {
            'requires': [
              {
                'ip': 4,
                'line': 24,
              },
              {
                'ip': 10,
                'line': 25,
              },
            ],
            'sourceMap': '24:24:24:26;;:16::27:1;:31::37:0;:8::39:1;25:25:25:26:0;;:28::30;;:8::33:1;23:4:26:5;;',
            'logs': [],
          },
        },
      },
      'functionBodies': {
        'e8e62fca': '537ab27500cd0376a9147b7e0288ac7e8802e803c0c6765479947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1695279947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1697655795479937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169a16300cc707c947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1699d6700cc55799d51cdc0c78851cc789d686d6d7551',
        '2f7ef34c': '5479a97b88547a547aac777777',
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'announcement.scash',
    artifact: {
      'contractName': 'Announcement',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'announce',
          'selector': '327ae4c2',
          'inputs': [],
        },
      ],
      'bytecode': '6a 6d02 OP_SIZE OP_SWAP OP_CAT OP_CAT 4120636f6e7472616374206d6179206e6f7420696e6a75726520612068756d616e206265696e67206f722c207468726f75676820696e616374696f6e2c20616c6c6f7720612068756d616e206265696e6720746f20636f6d6520746f206861726d2e OP_SIZE OP_DUP 4b OP_GREATERTHAN OP_IF 4c OP_SWAP OP_CAT OP_ENDIF OP_SWAP OP_CAT OP_CAT OP_0 OP_OUTPUTVALUE OP_0 OP_NUMEQUALVERIFY OP_0 OP_OUTPUTBYTECODE OP_EQUALVERIFY e803 OP_INPUTINDEX OP_UTXOVALUE OP_OVER OP_SUB OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_DUP OP_ROT OP_GREATERTHANOREQUAL OP_IF OP_1 OP_OUTPUTBYTECODE OP_INPUTINDEX OP_UTXOBYTECODE OP_EQUALVERIFY OP_1 OP_OUTPUTVALUE OP_OVER OP_NUMEQUALVERIFY OP_ENDIF OP_DROP OP_1',
      'source': "pragma solidcash >=0.8.0;\n\n/* This is a contract showcasing covenants outside of regular transactional use.\n * It enforces the contract to make an \"announcement\" on Memo.cash, and send the\n * remainder of contract funds back to the contract.\n */\ncontract Announcement() {\n    function announce() {\n        // Create the memo.cash announcement output\n        bytes announcement = new LockingBytecodeNullData([\n            0x6d02,\n            bytes('A contract may not injure a human being or, through inaction, allow a human being to come to harm.')\n        ]);\n\n        // Check that the first tx output matches the announcement\n        require(tx.outputs[0].value == 0);\n        require(tx.outputs[0].lockingBytecode == announcement);\n\n        // Calculate leftover money after fee (1000 sats)\n        // Check that the second tx output sends the change back if there's enough leftover for another announcement\n        int minerFee = 1000;\n        int changeAmount = tx.inputs[this.activeInputIndex].value - minerFee;\n        if (changeAmount >= minerFee) {\n            require(tx.outputs[1].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);\n            require(tx.outputs[1].value == changeAmount);\n        }\n    }\n}\n",
      'debug': {
        'bytecode': '016a026d02827c7e7e4c624120636f6e7472616374206d6179206e6f7420696e6a75726520612068756d616e206265696e67206f722c207468726f75676820696e616374696f6e2c20616c6c6f7720612068756d616e206265696e6720746f20636f6d6520746f206861726d2e8276014ba063014c7c7e687c7e7e00cc009d00cd8802e803c0c678947621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169767ba26351cdc0c78851cc789d687551',
        'sourceMap': '10:29:13:10;11:12:11:18;::::1;;;;12:18:12:118:0;:12::119:1;;;;;;;;;;;;16:27:16:28:0;:16::35:1;:39::40:0;:8::42:1;17:27:17:28:0;:16::45:1;:8::63;21:23:21:27:0;22:37:22:58;:27::65:1;:68::76:0;:27:::1;;;;;;;;;23:12:23:24:0;:28::36;:12:::1;:38:26:9:0;24:31:24:32;:20::49:1;:63::84:0;:53::101:1;:12::103;25:31:25:32:0;:20::39:1;:43::55:0;:12::57:1;23:38:26:9;8:4:27:5;',
        'logs': [],
        'requires': [
          {
            'ip': 22,
            'line': 16,
          },
          {
            'ip': 25,
            'line': 17,
          },
          {
            'ip': 47,
            'line': 24,
          },
          {
            'ip': 51,
            'line': 25,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'p2palindrome.scash',
    artifact: {
      'contractName': 'P2Palindrome',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'spend',
          'selector': 'a22501e8',
          'inputs': [
            {
              'name': 'palindrome',
              'type': 'string',
            },
          ],
        },
      ],
      'bytecode': 'OP_DUP OP_REVERSEBYTES OP_EQUAL',
      'source': 'contract P2Palindrome() {\n    function spend(string palindrome) {\n        require(palindrome.reverse() == palindrome);\n    }\n}\n',
      'debug': {
        'bytecode': '76bc87',
        'sourceMap': '3:16:3:26;:::36:1;:8::52',
        'logs': [],
        'requires': [
          {
            'ip': 3,
            'line': 3,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'num2bin_variable.scash',
    artifact: {
      'contractName': 'Num2Bin',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'spend',
          'selector': 'd085a7f9',
          'inputs': [
            {
              'name': 'size',
              'type': 'int256',
            },
          ],
        },
      ],
      'bytecode': 'OP_10 OP_SWAP OP_NUM2BIN OP_BIN2NUM OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_10 OP_NUMEQUAL',
      'source': 'contract Num2Bin() {\n    function spend(int size) {\n        bytes byte_ = toPaddedBytes(10, size);\n        require(int(byte_) == 10);\n    }\n}\n',
      'debug': {
        'bytecode': '5a7c80817621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1695a9c',
        'sourceMap': '3:36:3:38;:40::44;:22::45:1;4:16:4:26;;;;;;;;;:30::32:0;:8::34:1',
        'logs': [],
        'requires': [
          {
            'ip': 14,
            'line': 4,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'debug_messages.scash',
    artifact: {
      'contractName': 'DebugMessages',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'spend',
          'selector': 'd085a7f9',
          'inputs': [
            {
              'name': 'value',
              'type': 'int256',
            },
          ],
        },
      ],
      'bytecode': 'OP_DUP OP_1 OP_NUMEQUALVERIFY OP_1ADD OP_2 OP_NUMEQUAL',
      'source': "contract DebugMessages() {\n  function spend(int value) {\n    require(value == 1, \"Wrong value passed\");\n    console.log(value, \"test\");\n    console.log(value, \"test2\");\n    require(value + 1 == 2, \"Sum doesn't work\");\n  }\n}\n",
      'debug': {
        'bytecode': '76519d8b529c',
        'sourceMap': '3:12:3:17;:21::22;:4::46:1;6:12:6:21;:25::26:0;:4::48:1',
        'logs': [
          {
            'ip': 3,
            'line': 4,
            'data': [
              {
                'stackIndex': 0,
                'type': 'int256',
                'ip': 3,
              },
              'test',
            ],
          },
          {
            'ip': 3,
            'line': 5,
            'data': [
              {
                'stackIndex': 0,
                'type': 'int256',
                'ip': 3,
              },
              'test2',
            ],
          },
        ],
        'requires': [
          {
            'ip': 2,
            'line': 3,
            'message': 'Wrong value passed',
          },
          {
            'ip': 6,
            'line': 6,
            'message': "Sum doesn't work",
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'integer_formatting.scash',
    artifact: {
      'contractName': 'IntegerFormatting',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'test',
          'selector': '58d7eb51',
          'inputs': [],
        },
      ],
      'bytecode': '0010a5d4e800 0010a5d4e800 0010a5d4e800 0010a5d4e800 0010a5d4e800 OP_4 OP_ROLL OP_OVER OP_NUMEQUALVERIFY OP_3 OP_ROLL OP_OVER OP_NUMEQUALVERIFY OP_ROT OP_OVER OP_NUMEQUALVERIFY OP_NUMEQUAL',
      'source': 'contract IntegerFormatting() {\n    function test() {\n        int scientific1 = 1e12;\n        int scientific2 = 1E12;\n        int underscores = 1_000_000_000_000;\n        int combined = 1_0e1_1;\n\n        int regular = 1000000000000;\n\n        require(scientific1 == regular);\n        require(scientific2 == regular);\n        require(underscores == regular);\n        require(combined == regular);\n    }\n}\n',
      'debug': {
        'bytecode': '060010a5d4e800060010a5d4e800060010a5d4e800060010a5d4e800060010a5d4e800547a789d537a789d7b789d9c',
        'sourceMap': '3:26:3:30;4::4;5::5:43;6:23:6:30;8:22:8:35;10:16:10:27;;:31::38;:8::40:1;11:16:11:27:0;;:31::38;:8::40:1;12:16:12:27:0;:31::38;:8::40:1;13::13:37',
        'logs': [],
        'requires': [
          {
            'ip': 8,
            'line': 10,
          },
          {
            'ip': 12,
            'line': 11,
          },
          {
            'ip': 15,
            'line': 12,
          },
          {
            'ip': 17,
            'line': 13,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'multiline_statements.scash',
    artifact: {
      'contractName': 'MultilineStatements',
      'constructorInputs': [
        {
          'name': 'x',
          'type': 'int256',
        },
        {
          'name': 'y',
          'type': 'string',
        },
      ],
      'abi': [
        {
          'name': 'spend',
          'selector': '114c2871',
          'inputs': [
            {
              'name': 'a',
              'type': 'int256',
            },
            {
              'name': 'b',
              'type': 'string',
            },
          ],
        },
      ],
      'bytecode': 'OP_ROT OP_SWAP OP_2 OP_SUB OP_NUMEQUAL OP_IF OP_2DUP OP_EQUAL OP_ELSE OP_0 OP_ENDIF OP_IF OP_0 OP_VERIFY OP_ELSE OP_OVER 48656c6c6f20 OP_2 OP_PICK OP_CAT OP_EQUAL OP_IF OP_DUP 576f726c64 OP_EQUALVERIFY OP_ELSE OP_1 OP_0 OP_NOT OP_NOT OP_NOT OP_NUMEQUALVERIFY OP_ENDIF OP_ENDIF OP_2DROP OP_1',
      'source': 'contract MultilineStatements(\n    int x,\n    string y\n) {\n    function spend(\n        int a,\n        string b\n    ) {\n        if (a == x - 2\n         && b == y) {\n            require(false);\n        } else if (b == "Hello "\n        + y) {\n            require(\n                y == "World"\n            );\n        } else {\n            require(true == !!!false);\n        }\n    }\n}\n',
      'debug': {
        'bytecode': '7b7c52949c636e8767006863006967780648656c6c6f2052797e87637605576f726c64886751009191919d68686d51',
        'sourceMap': '9:12:9:13;:17::18;:21::22;:17:::1;:12;::10:18:0;10;::::1;9;;;10:20:12:9:0;11::11:25;:12::27:1;12:15:19:9:0;:19:12:20;:24::32;13:10:13:11;;12:24:::1;:19;13:13:17:9:0;15:16:15:17;:21::28;14:12:16:14:1;17:15:19:9:0;18:20:18:24;:31::36;:30:::1;:29;:28;:12::38;17:15:19:9;12;5:4:20:5;',
        'logs': [],
        'requires': [
          {
            'ip': 15,
            'line': 11,
          },
          {
            'ip': 26,
            'line': 14,
          },
          {
            'ip': 33,
            'line': 18,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'log_intermediate_results.scash',
    artifact: {
      'contractName': 'LogIntermediateResults',
      'constructorInputs': [
        {
          'name': 'owner',
          'type': 'pubkey',
        },
      ],
      'abi': [
        {
          'name': 'test_log_intermediate_result',
          'selector': '3813a78a',
          'inputs': [],
        },
      ],
      'bytecode': 'OP_HASH256 OP_SIZE OP_NIP 20 OP_NUMEQUAL',
      'source': 'contract LogIntermediateResults(pubkey owner) {\n    function test_log_intermediate_result() {\n        bytes32 singleHash = sha256(owner);\n        console.log(singleHash);\n        bytes32 doubleHash = sha256(singleHash);\n        require(doubleHash.length == 32, "doubleHash should be 32 bytes");\n    }\n}\n',
      'debug': {
        'bytecode': 'aa827701209c',
        'sourceMap': '3:29:5:47:1;6:16:6:33;;:37::39:0;:8::74:1',
        'logs': [
          {
            'ip': 1,
            'line': 4,
            'data': [
              {
                'stackIndex': 0,
                'type': 'bytes32',
                'ip': 1,
                'transformations': 'OP_SHA256',
              },
            ],
          },
        ],
        'requires': [
          {
            'ip': 6,
            'line': 6,
            'message': 'doubleHash should be 32 bytes',
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'double_split.scash',
    artifact: {
      'contractName': 'DoubleSplit',
      'constructorInputs': [
        {
          'name': 'pkh',
          'type': 'bytes20',
        },
      ],
      'abi': [
        {
          'name': 'spend',
          'selector': 'f598582f',
          'inputs': [],
        },
      ],
      'bytecode': 'OP_INPUTINDEX OP_UTXOBYTECODE 17 OP_SPLIT OP_DROP OP_3 OP_SPLIT OP_NIP OP_EQUAL',
      'source': 'contract DoubleSplit(bytes20 pkh) {\n    function spend() {\n        bytes actualPkh = tx.inputs[this.activeInputIndex].lockingBytecode.split(23)[0].split(3)[1];\n        require(pkh == actualPkh);\n    }\n}\n',
      'debug': {
        'bytecode': 'c0c701177f75537f7787',
        'sourceMap': '3:36:3:57;:26::74:1;:81::83:0;:26::84:1;:::87;:94::95:0;:26::96:1;:::99;4:8:4:34',
        'logs': [],
        'requires': [
          {
            'ip': 10,
            'line': 4,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'slice.scash',
    artifact: {
      'contractName': 'Slice',
      'constructorInputs': [
        {
          'name': 'pkh',
          'type': 'bytes20',
        },
      ],
      'abi': [
        {
          'name': 'spend',
          'selector': 'f598582f',
          'inputs': [],
        },
      ],
      'bytecode': 'OP_INPUTINDEX OP_UTXOBYTECODE 17 OP_SPLIT OP_DROP OP_3 OP_SPLIT OP_NIP OP_EQUAL',
      'source': 'contract Slice(bytes20 pkh) {\n    function spend() {\n        bytes actualPkh = tx.inputs[this.activeInputIndex].lockingBytecode.slice(3, 23);\n        require(pkh == actualPkh);\n    }\n}\n',
      'debug': {
        'bytecode': 'c0c701177f75537f7787',
        'sourceMap': '3:36:3:57;:26::74:1;:84::86:0;:26::87:1;;:81::82:0;:26::87:1;;4:8:4:34',
        'logs': [],
        'requires': [
          {
            'ip': 10,
            'line': 4,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'slice_optimised.scash',
    artifact: {
      'contractName': 'Slice',
      'constructorInputs': [
        {
          'name': 'data',
          'type': 'bytes32',
        },
      ],
      'abi': [
        {
          'name': 'spend',
          'selector': 'f598582f',
          'inputs': [],
        },
      ],
      'bytecode': '14 OP_SPLIT OP_DROP OP_0 14 OP_NUM2BIN OP_EQUAL',
      'source': 'contract Slice(bytes32 data) {\n    function spend() {\n        bytes20 pkh = data.slice(0, 20);\n        require(pkh == toPaddedBytes(0, 20));\n    }\n}\n',
      'debug': {
        'bytecode': '01147f750001148087',
        'sourceMap': '3:36:3:38;:22::39:1;;4:37:4:38:0;:40::42;:23::43:1;:8::45',
        'logs': [],
        'requires': [
          {
            'ip': 8,
            'line': 4,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'complex_loop.scash',
    artifact: {
      'contractName': 'Loopy',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'doLoop',
          'selector': '16821cf9',
          'inputs': [],
        },
      ],
      'bytecode': 'OP_0 OP_0 OP_0 OP_0 OP_BEGIN OP_DUP OP_UTXOVALUE OP_4 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_FROMALTSTACK OP_FROMALTSTACK OP_DUP OP_1ADD OP_NIP OP_TXOUTPUTCOUNT OP_2DUP OP_LESSTHAN OP_DUP OP_IF OP_2 OP_PICK OP_OUTPUTTOKENCATEGORY OP_0 OP_EQUAL OP_NOT OP_NIP OP_DUP OP_IF OP_4 OP_PICK OP_3 OP_PICK OP_OUTPUTVALUE OP_ADD OP_5 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_FROMALTSTACK OP_FROMALTSTACK OP_FROMALTSTACK OP_ELSE OP_3 OP_PICK OP_1ADD OP_4 OP_ROLL OP_DROP OP_SWAP OP_TOALTSTACK OP_SWAP OP_TOALTSTACK OP_SWAP OP_FROMALTSTACK OP_FROMALTSTACK OP_ENDIF OP_ENDIF OP_2DROP OP_DUP OP_TXINPUTCOUNT OP_GREATERTHANOREQUAL OP_UNTIL OP_2SWAP OP_GREATERTHAN OP_VERIFY OP_SWAP OP_0 OP_GREATERTHAN OP_NIP',
      'source': 'contract Loopy() {\n    function doLoop() {\n        int inputSum = 0;\n        int outputSum = 0;\n        int tokenCount = 0;\n        int i = 0;\n\n        do {\n            inputSum = tx.inputs[i].value;\n            i = i + 1;\n\n            int x = tx.outputs.length;\n            bool b = i < x;\n\n            if (b) {\n                b = tx.outputs[i].tokenCategory != 0x;\n\n                if (b) {\n                    outputSum = outputSum + tx.outputs[i].value;\n                } else {\n                    tokenCount = tokenCount + 1;\n                }\n\n                console.log(tokenCount);\n            }\n        } while (i < tx.inputs.length);\n\n        require(inputSum > outputSum);\n        require(tokenCount > 0);\n    }\n}\n',
      'debug': {
        'bytecode': '000000006576c6547a757c6b7c6b7c6c6c768b77c46e9f76635279d100879177766354795379cc93557a757c6b7c6b7c6b7c6c6c6c6753798b547a757c6b7c6b7c6c6c68686d76c3a26672a0697c00a077',
        'sourceMap': '3:23:3:24;4:24:4:25;5:25:5:26;6:16:6:17;8:8:26:39;9:33:9:34;:23::41:1;:12::42;;;;;;;;;;10:16:10:17:0;:::21:1;:12::22;12:20:12:37:0;13:21:13:26;::::1;15:16:15:17:0;:19:25:13;16:31:16:32;;:20::47:1;:51::53:0;:20:::1;;:16::54;18:20:18:21:0;:23:20:17;19:32:19:41;;:55::56;;:44::63:1;:32;:20::64;;;;;;;;;;;;;20:23:22:17:0;21:33:21:43;;:::47:1;:20::48;;;;;;;;;;20:23:22:17;15:19:25:13;8:11:26:9;26:17::18:0;:21::37;8:8::39:1;;28:16:28:36:0;::::1;:8::38;29:16:29:26:0;:29::30;:8::32:1;2:4:30:5',
        'logs': [
          {
            'ip': 68,
            'line': 24,
            'data': [
              {
                'stackIndex': 3,
                'type': 'int256',
                'ip': 68,
              },
            ],
          },
        ],
        'requires': [
          {
            'ip': 76,
            'line': 28,
          },
          {
            'ip': 80,
            'line': 29,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'do_while_loop_no_introspection.scash',
    artifact: {
      'contractName': 'Loopy',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'doLoop',
          'selector': '16821cf9',
          'inputs': [],
        },
      ],
      'bytecode': 'OP_0 OP_2 OP_BEGIN OP_OVER OP_1ADD OP_ROT OP_DROP OP_SWAP OP_2DUP OP_ADD OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_10 OP_LESSTHAN OP_VERIFY OP_OVER OP_10 OP_GREATERTHANOREQUAL OP_UNTIL OP_2DROP OP_1',
      'source': 'contract Loopy() {\n    function doLoop() {\n        int i = 0;\n        int x = 2;\n\n        do {\n            i = i + 1;\n            console.log(i);\n            require(i + x < 10);\n        } while (i < 10);\n    }\n}\n',
      'debug': {
        'bytecode': '005265788b7b757c6e937621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1695a9f69785aa2666d51',
        'sourceMap': '3:16:3:17;4::4;6:8:10:25;7:16:7:17;:::21:1;:12::22;;;9:20:9:25:0;::::1;;;;;;;;;:28::30:0;:20:::1;:12::32;10:17:10:18:0;:21::23;6:8::25:1;;2:4:11:5;',
        'logs': [
          {
            'ip': 8,
            'line': 8,
            'data': [
              {
                'stackIndex': 1,
                'type': 'int256',
                'ip': 8,
              },
            ],
          },
        ],
        'requires': [
          {
            'ip': 20,
            'line': 9,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'bitshift.scash',
    artifact: {
      'contractName': 'Bitshift',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'spend',
          'selector': 'f598582f',
          'inputs': [],
        },
      ],
      'bytecode': '1122334455667788 OP_4 OP_LSHIFTBIN OP_4 OP_RSHIFTBIN 0000000055667788 OP_EQUALVERIFY OP_8 OP_2 OP_RSHIFTNUM OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_1 OP_LSHIFTNUM OP_DUP 000000000000000000000000000000000000000000000000000000000000008080 OP_GREATERTHANOREQUAL OP_VERIFY OP_DUP ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f OP_LESSTHANOREQUAL OP_VERIFY OP_16 OP_NUMEQUAL',
      'source': 'contract Bitshift() {\n    function spend() {\n        bytes8 x = 0x1122334455667788;\n        bytes8 y = x << 4 >> 4;\n\n        require(y == 0x0000000055667788);\n\n        int a = 8;\n        int b = a >> 2 << 1;\n\n        require (b == 16);\n    }\n}\n',
      'debug': {
        'bytecode': '081122334455667788549854990800000000556677888858528e7621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169518d7621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169609c',
        'sourceMap': '3:19:3:37;4:24:4:25;:19:::1;:29::30:0;:19:::1;6:21:6:39:0;:8::41:1;8:16:8:17:0;9:21:9:22;:16:::1;;;;;;;;;:26::27:0;:16:::1;;;;;;;;;11:22:11:24:0;:8::26:1',
        'logs': [],
        'requires': [
          {
            'ip': 6,
            'line': 6,
          },
          {
            'ip': 30,
            'line': 11,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'type_enforcement.scash',
    artifact: {
      'contractName': 'TypeEnforcement',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'spend',
          'selector': 'e38b3ae6',
          'inputs': [
            {
              'name': 'nonEnforcedInt',
              'type': 'int256',
            },
            {
              'name': 'enforcedBool',
              'type': 'bool',
            },
            {
              'name': 'enforcedBytes',
              'type': 'bytes4',
            },
            {
              'name': 'nonEnforcedBytes',
              'type': 'bytes',
            },
          ],
        },
      ],
      'bytecode': 'OP_SWAP OP_0NOTEQUAL OP_2 OP_PICK OP_SIZE OP_4 OP_EQUALVERIFY OP_DROP OP_1 OP_NUMEQUAL OP_IF OP_DUP OP_6 OP_GREATERTHAN OP_VERIFY OP_ELSE OP_OVER OP_3 OP_PICK OP_EQUALVERIFY OP_ENDIF OP_2DROP OP_DROP OP_1',
      'source': 'contract TypeEnforcement() {\n    function spend(\n        int nonEnforcedInt,\n        bool enforcedBool,\n        bytes4 enforcedBytes,\n        bytes nonEnforcedBytes\n    ) {\n        if (enforcedBool == true) {\n            require(nonEnforcedInt > 6);\n        } else {\n            require(enforcedBytes == nonEnforcedBytes);\n        }\n    }\n}\n',
      'debug': {
        'bytecode': '7c92527982548875519c637656a0696778537988686d7551',
        'sourceMap': '4:8:4:25;;5::5:28;;;;;;8:28:8:32;:12:::1;:34:10:9:0;9:20:9:34;:37::38;:20:::1;:12::40;10:15:12:9:0;11:20:11:33;:37::53;;:12::55:1;10:15:12:9;2:4:13:5;;',
        'logs': [],
        'requires': [
          {
            'ip': 14,
            'line': 9,
          },
          {
            'ip': 19,
            'line': 11,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
  {
    fn: 'type_enforcement.scash',
    artifact: {
      'contractName': 'TypeEnforcement',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'spend',
          'selector': 'e38b3ae6',
          'inputs': [
            {
              'name': 'nonEnforcedInt',
              'type': 'int256',
            },
            {
              'name': 'enforcedBool',
              'type': 'bool',
            },
            {
              'name': 'enforcedBytes',
              'type': 'bytes4',
            },
            {
              'name': 'nonEnforcedBytes',
              'type': 'bytes',
            },
          ],
        },
      ],
      'bytecode': 'OP_SWAP OP_1 OP_NUMEQUAL OP_IF OP_DUP OP_6 OP_GREATERTHAN OP_VERIFY OP_ELSE OP_OVER OP_3 OP_PICK OP_EQUALVERIFY OP_ENDIF OP_2DROP OP_DROP OP_1',
      'source': 'contract TypeEnforcement() {\n    function spend(\n        int nonEnforcedInt,\n        bool enforcedBool,\n        bytes4 enforcedBytes,\n        bytes nonEnforcedBytes\n    ) {\n        if (enforcedBool == true) {\n            require(nonEnforcedInt > 6);\n        } else {\n            require(enforcedBytes == nonEnforcedBytes);\n        }\n    }\n}\n',
      'debug': {
        'bytecode': '7c519c637656a0696778537988686d7551',
        'sourceMap': '8:12:8:24;:28::32;:12:::1;:34:10:9:0;9:20:9:34;:37::38;:20:::1;:12::40;10:15:12:9:0;11:20:11:33;:37::53;;:12::55:1;10:15:12:9;2:4:13:5;;',
        'logs': [],
        'requires': [
          {
            'ip': 7,
            'line': 9,
          },
          {
            'ip': 12,
            'line': 11,
          },
        ],
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': false,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
    compilerOptions: { 'enforceFunctionParameterTypes':false },
  },
  {
    fn: 'msg_sig_data.scash',
    artifact: {
      'contractName': 'MsgSigDataTest',
      'constructorInputs': [],
      'abi': [
        {
          'name': 'checkSig',
          'selector': '79ede9d1',
          'inputs': [
            {
              'name': 'expectedSig',
              'type': 'bytes4',
            },
          ],
        },
        {
          'name': 'checkData',
          'selector': '8d71cec7',
          'inputs': [],
        },
        {
          'name': 'useBoth',
          'selector': '729bfbca',
          'inputs': [
            {
              'name': 'expectedSig',
              'type': 'bytes4',
            },
          ],
        },
      ],
      'bytecode': 'OP_INPUTINDEX OP_UTXOBYTECODE OP_SIZE OP_NIP 24 OP_LESSTHAN OP_IF OP_ACTIVEBYTECODE OP_SIZE OP_NIP OP_DUP 4c OP_LESSTHAN OP_IF OP_1ADD OP_ELSE OP_DUP 0001 OP_LESSTHAN OP_IF OP_2 OP_ADD OP_ELSE OP_3 OP_ADD OP_ENDIF OP_ENDIF OP_ELSE OP_0 OP_ENDIF 78825488750479ede9d17b8777 79ede9d1 OP_DEFINE 76c0ca7682777b947f75827700a077 8d71cec7 OP_DEFINE 788254887504729bfbca7b8876c0ca7682777b947f75827754a077 729bfbca OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
      'source': 'pragma solidcash >=0.10.0;\n\ncontract MsgSigDataTest() {\n    function checkSig(bytes4 expectedSig) {\n        require(msg.sig == expectedSig);\n    }\n\n    function checkData() {\n        require(msg.data.length > 0);\n    }\n\n    function useBoth(bytes4 expectedSig) {\n        require(msg.sig == expectedSig);\n        bytes data = msg.data;\n        require(data.length > 4);\n    }\n}\n',
      'debug': {
        'bytecode': 'c0c7827701249f63c1827776014c9f638b67760200019f63529367539368686700680d78825488750479ede9d17b87770479ede9d1890f76c0ca7682777b947f75827700a077048d71cec7891b788254887504729bfbca7b8876c0ca7682777b947f75827754a07704729bfbca89748c7a82549d8a',
        'sourceMap': '3::17:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;4:4:6:5;;;8::10;;;12::16;;;3:0:17:1;;;;;;',
        'logs': [],
        'requires': [],
        'functionDebug': {
          '79ede9d1': {
            'requires': [
              {
                'ip': 8,
                'line': 5,
              },
            ],
            'sourceMap': '4:22:4:40;;;;;5:16:5:23;:27::38;:8::40:1;4:4:6:5',
            'logs': [],
          },
          '8d71cec7': {
            'requires': [
              {
                'ip': 14,
                'line': 9,
              },
            ],
            'sourceMap': '9:16:9:24;;;;;;;;;;:::31:1;;:34::35:0;:8::37:1;8:4:10:5',
            'logs': [],
          },
          '729bfbca': {
            'requires': [
              {
                'ip': 7,
                'line': 13,
              },
              {
                'ip': 22,
                'line': 15,
              },
            ],
            'sourceMap': '12:21:12:39;;;;;13:16:13:23;:27::38;:8::40:1;14:21:14:29:0;;;;;;;;;;15:16:15:27:1;;:30::31:0;:8::33:1;12:4:16:5',
            'logs': [],
          },
        },
      },
      'functionBodies': {
        '79ede9d1': '78825488750479ede9d17b8777',
        '8d71cec7': '76c0ca7682777b947f75827700a077',
        '729bfbca': '788254887504729bfbca7b8876c0ca7682777b947f75827754a077',
      },
      'compiler': {
        'name': 'solidc',
        'version': version,
        'options': {
          'enforceFunctionParameterTypes': true,
          'enforceLocktimeGuard': true,
          'commitmentLimit': 128,
        },
      },
    },
  },
];
