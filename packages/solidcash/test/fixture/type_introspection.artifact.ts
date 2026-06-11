export default {
  'contractName': 'TypeIntrospection',
  'constructorInputs': [],
  'abi': [
    {
      'name': 'checkIntBounds',
      'selector': 'f3df6d1d',
      'inputs': [
        {
          'name': 'x',
          'type': 'int',
        },
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
    {
      'name': 'checkUintBounds',
      'selector': '7625ba70',
      'inputs': [
        {
          'name': 'x',
          'type': 'int',
        },
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
    {
      'name': 'checkEnumBounds',
      'selector': '91641200',
      'inputs': [
        {
          'name': 'x',
          'type': 'int',
        },
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
    {
      'name': 'checkInterfaceId',
      'selector': '93f57b1c',
      'inputs': [
        {
          'name': 'id',
          'type': 'bytes4',
        },
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
    {
      'name': 'checkContractName',
      'selector': '87f8b17b',
      'inputs': [
        {
          'name': 'name',
          'type': 'string',
        },
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
  'bytecode': '7b7bad76028080a269017fa1 f3df6d1d OP_DEFINE 7b7bad7600a26921ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00a1 7625ba70 OP_DEFINE 7b7bad7600a26952a1 91641200 OP_DEFINE 76825488757b7bad04457f154c87 93f57b1c OP_DEFINE 7b7bad1154797065496e74726f7370656374696f6e87 87f8b17b OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_INVOKE',
  'source': 'interface IToken {\n    public int supply;\n    function mint(int amount);\n    function burn(int amount);\n}\n\ncontract TypeIntrospection() {\n    enum Color { Red, Green, Blue }\n\n    function checkIntBounds(int x, pubkey pk, sig s) {\n        require(checkSig(s, pk));\n        require(x >= type(int8).min);\n        require(x <= type(int8).max);\n    }\n\n    function checkUintBounds(int x, pubkey pk, sig s) {\n        require(checkSig(s, pk));\n        require(x >= type(uint8).min);\n        require(x <= type(uint256).max);\n    }\n\n    function checkEnumBounds(int x, pubkey pk, sig s) {\n        require(checkSig(s, pk));\n        require(x >= type(Color).min);\n        require(x <= type(Color).max);\n    }\n\n    function checkInterfaceId(bytes4 id, pubkey pk, sig s) {\n        require(checkSig(s, pk));\n        require(id == type(IToken).interfaceId);\n    }\n\n    function checkContractName(string name, pubkey pk, sig s) {\n        require(checkSig(s, pk));\n        require(name == type(TypeIntrospection).name);\n    }\n}\n',
  'debug': {
    'bytecode': '0c7b7bad76028080a269017fa104f3df6d1d892a7b7bad7600a26921ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00a1047625ba7089097b7bad7600a26952a10491641200890e76825488757b7bad04457f154c870493f57b1c89167b7bad1154797065496e74726f7370656374696f6e870487f8b17b89748c7a8a',
    'sourceMap': '10:4:14:5;;;16::20;;;22::26;;;28::31;;;33::36;;;7:0:37:1;;;',
    'logs': [],
    'requires': [],
    'functionDebug': {
      '91641200': {
        'requires': [
          {
            'ip': 2,
            'line': 23,
          },
          {
            'ip': 6,
            'line': 24,
          },
          {
            'ip': 9,
            'line': 25,
          },
        ],
        'sourceMap': '23:25:23:26;:28::30;:8::33:1;24:16:24:17:0;:21::36;:16:::1;:8::38;25:21:25:36:0;:8::38:1',
        'logs': [],
      },
      'f3df6d1d': {
        'requires': [
          {
            'ip': 2,
            'line': 11,
          },
          {
            'ip': 6,
            'line': 12,
          },
          {
            'ip': 9,
            'line': 13,
          },
        ],
        'sourceMap': '11:25:11:26;:28::30;:8::33:1;12:16:12:17:0;:21::35;:16:::1;:8::37;13:21:13:35:0;:8::37:1',
        'logs': [],
      },
      '7625ba70': {
        'requires': [
          {
            'ip': 2,
            'line': 17,
          },
          {
            'ip': 6,
            'line': 18,
          },
          {
            'ip': 9,
            'line': 19,
          },
        ],
        'sourceMap': '17:25:17:26;:28::30;:8::33:1;18:16:18:17:0;:21::36;:16:::1;:8::38;19:21:19::0;:8::40:1',
        'logs': [],
      },
      '93f57b1c': {
        'requires': [
          {
            'ip': 7,
            'line': 29,
          },
          {
            'ip': 10,
            'line': 30,
          },
        ],
        'sourceMap': '28:30:28:39;;;;;29:25:29:26;:28::30;:8::33:1;30:22:30:46:0;:8::48:1',
        'logs': [],
      },
      '87f8b17b': {
        'requires': [
          {
            'ip': 2,
            'line': 34,
          },
          {
            'ip': 5,
            'line': 35,
          },
        ],
        'sourceMap': '34:25:34:26;:28::30;:8::33:1;35:24:35:52:0;:8::54:1',
        'logs': [],
      },
    },
  },
  'functionBodies': {
    '91641200': '7b7bad7600a26952a1',
    'f3df6d1d': '7b7bad76028080a269017fa1',
    '7625ba70': '7b7bad7600a26921ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00a1',
    '93f57b1c': '76825488757b7bad04457f154c87',
    '87f8b17b': '7b7bad1154797065496e74726f7370656374696f6e87',
  },
  'enums': [
    {
      'name': 'Color',
      'members': [
        {
          'name': 'Red',
          'value': 0,
        },
        {
          'name': 'Green',
          'value': 1,
        },
        {
          'name': 'Blue',
          'value': 2,
        },
      ],
    },
  ],
  'compiler': {
    'name': 'solidc',
    'version': '0.13.0-next.3',
    'options': {
      'enforceFunctionParameterTypes': true,
      'commitmentLimit': 128,
    },
  },
  'updatedAt': '2026-03-02T16:10:46.802Z',
};
