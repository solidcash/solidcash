export default {
  contractName: 'Example',
  constructorInputs: [],
  abi: [
    {
      name: 'test',
      selector: '78cae886',
      inputs: [
        {
          name: 'value',
          type: 'int256',
        },
      ],
    },
  ],
  bytecode: 'OP_DUP OP_DUP OP_1 ff00 OP_LSHIFTBIN OP_ADD 21 OP_NUM2BIN 20 OP_SPLIT OP_NIP OP_0 OP_EQUALVERIFY OP_DROP OP_1 OP_NUMEQUAL',
  source: 'contract Example() {\n  function test(int value) {\n    console.log(value, "test");\n    require(value == 1, "Wrong value passed");\n  }\n}\n',
  debug: {
    bytecode: '76765102ff00989301218001207f77008875519c',
    sourceMap: '2:16:2:25;;;;;;;;;;;;;;4:21:4:22;:4::46:1',
    logs: [
      {
        ip: 14,
        line: 3,
        data: [
          {
            stackIndex: 0,
            type: 'int256',
            ip: 14,
          },
          'test',
        ],
      },
    ],
    requires: [
      {
        ip: 16,
        line: 4,
        message: 'Wrong value passed',
      },
    ],
  },
  fingerprint: '75a5b95ae8bec1ed7b706514abfc963292c094ff875f3f19d128b4b9c07eadcb',
  compiler: {
    name: 'solidc',
    version: '0.13.1',
    options: {
      enforceFunctionParameterTypes: true,
      enforceLocktimeGuard: true,
      commitmentLimit: 128,
      messageBus: true,
    },
  },
  updatedAt: '2026-08-05T19:14:54.315Z',
  invocationAnalysis: {
    version: 1,
    protocolVersions: [
      1,
    ],
    functions: [
      {
        id: 0,
        name: 'test',
        arity: 1,
        entryPoint: true,
        selector: '78cae886',
        calls: [],
        closure: [
          0,
        ],
        component: 0,
        recursive: false,
        reads: [],
        writes: [],
        effects: [],
        unknown: false,
        bounded: true,
        maximumDirectInvocations: 0,
      },
    ],
    components: [
      {
        id: 0,
        functions: [
          0,
        ],
        recursive: false,
      },
    ],
  },
  diagnostics: [
    {
      severity: 'error',
      code: 'message-bus-route-not-synthesized',
      message: 'No message-bus route was synthesized for \'Example\': it has no message-bus batch entry point and cannot participate in a message bus. Only the direct per-function route exists. Rejected entry points - \'test\': not-examined-by-route-synthesis.',
    },
  ],
} as const;
