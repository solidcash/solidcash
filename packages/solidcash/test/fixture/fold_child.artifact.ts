export default {
  contractName: 'FoldChild',
  constructorInputs: [
    {
      name: 'owner',
      type: 'bytes20',
    },
  ],
  abi: [
    {
      name: 'configure',
      selector: '78f3537b',
      inputs: [
        {
          name: 'c',
          type: 'int256',
        },
        {
          name: 'a',
          type: 'bytes20',
        },
      ],
      writesState: true,
      requiredNftIndices: [
        0,
      ],
      blockLayout: {
        blockSize: 2,
        slots: [
          {
            kind: 'master',
            offset: 0,
          },
          {
            kind: 'dataNft',
            offset: 1,
            nftIndex: 0,
          },
        ],
      },
    },
  ],
  bytecode: '00c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600 OP_1 OP_DEFINE OP_OVER OP_DUP OP_1 ff00 OP_LSHIFTNUM OP_ADD 21 OP_NUM2BIN 20 OP_SPLIT OP_NIP 00 OP_EQUALVERIFY OP_DROP OP_2 OP_PICK OP_SIZE 14 OP_EQUALVERIFY OP_DROP OP_SWAP OP_DUP OP_SIZE OP_0 OP_EQUAL OP_IF OP_2DROP 00 OP_ELSE OP_SIZE OP_1 OP_EQUAL OP_IF OP_DUP OP_1NEGATE OP_EQUAL OP_IF OP_2DROP 4f OP_ELSE OP_DUP OP_BIN2NUM OP_DUP OP_1 OP_GREATERTHANOREQUAL OP_SWAP OP_16 OP_LESSTHANOREQUAL OP_BOOLAND OP_IF OP_DROP OP_BIN2NUM 50 OP_ADD OP_1 OP_NUM2BIN OP_ELSE OP_DROP OP_1 OP_SWAP OP_CAT OP_ENDIF OP_ENDIF OP_ELSE OP_DROP OP_SIZE OP_DUP 4b OP_LESSTHANOREQUAL OP_IF OP_1 OP_NUM2BIN OP_SWAP OP_CAT OP_ELSE OP_DUP ff00 OP_LESSTHANOREQUAL OP_IF OP_2 OP_NUM2BIN OP_1 OP_SPLIT OP_DROP 4c OP_SWAP OP_CAT OP_SWAP OP_CAT OP_ELSE OP_3 OP_NUM2BIN OP_2 OP_SPLIT OP_DROP 4d OP_SWAP OP_CAT OP_SWAP OP_CAT OP_ENDIF OP_ENDIF OP_ENDIF OP_ENDIF OP_ROT 14 OP_SWAP OP_CAT OP_1 OP_VERIFY OP_INPUTINDEX OP_1ADD OP_UTXOTOKENCATEGORY 20 OP_SPLIT OP_DROP OP_INPUTINDEX OP_UTXOTOKENCATEGORY 20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_2DUP OP_CAT OP_INPUTINDEX OP_1ADD OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY OP_INPUTINDEX OP_1ADD OP_UTXOBYTECODE OP_INPUTINDEX OP_1ADD OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_1ADD OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_1ADD OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_SWAP OP_2DROP OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_1 OP_INVOKE OP_GREATERTHANOREQUAL OP_VERIFY OP_DROP OP_INPUTINDEX OP_UTXOTOKENCATEGORY 20 OP_SPLIT OP_DROP OP_1 OP_CAT OP_1 OP_INVOKE OP_NUMEQUALVERIFY OP_DROP OP_INPUTINDEX OP_UTXOVALUE OP_INPUTINDEX OP_OUTPUTVALUE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENAMOUNT OP_INPUTINDEX OP_OUTPUTTOKENAMOUNT OP_LESSTHANOREQUAL OP_VERIFY OP_INPUTINDEX OP_1ADD OP_UTXOVALUE OP_INPUTINDEX OP_1ADD OP_OUTPUTVALUE OP_EQUALVERIFY OP_INPUTINDEX OP_1ADD OP_UTXOTOKENAMOUNT OP_INPUTINDEX OP_1ADD OP_OUTPUTTOKENAMOUNT OP_LESSTHANOREQUAL OP_VERIFY OP_DROP OP_1',
  source: '\n  contract FoldChild(bytes20 owner) {\n    int counter;\n    bytes20 admin;\n\n    function configure(int c, bytes20 a) {\n      this.counter = c;\n      this.admin = a;\n      require(true);\n    }\n  }\n',
  debug: {
    bytecode: '3200c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600518978765102ff008d9301218001207f7701008875527982011488757c76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e686868687b01147c7e5169c08bce01207f75c0ce01207f75886e7ec08bd288c08bc7c08bcd88c08bcec08bd1887c6dc0c7c0cd88c0cec0d188c0ce518aa26975c0ce01207f75517e518a9d75c0c6c0cc88c0d0c0d3a169c08bc6c08bcc88c08bd0c08bd3a1697551',
    sourceMap: '2:2:11:3;;;6:23:6:28;;;;;;;;;;;;;;:30::39;;;;;;7:21:7:22;:6::23:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;8:19:8:20:0;:6::21:1;;;9:14:9:18:0;:6::20:1;6:4:10:5:0;;;;;;;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
    logs: [],
    requires: [
      {
        ip: 113,
        line: 9,
      },
    ],
  },
  fingerprint: '0e2b2c4651abc2dfe1fcada7dfb5219a8c5ba41f5cc7ccdfc998dffa0952b1b9',
  stateLayout: {
    variables: [
      {
        name: 'counter',
        type: 'int256',
        nftIndex: 0,
        fieldIndex: 0,
      },
      {
        name: 'admin',
        type: 'bytes20',
        nftIndex: 0,
        fieldIndex: 1,
      },
    ],
    dataNftCount: 1,
    commitmentLimit: 128,
  },
  compiler: {
    name: 'solidc',
    version: '0.13.1',
    options: {
      enforceFunctionParameterTypes: true,
      enforceLocktimeGuard: true,
      enforceFinalRequire: true,
      allowUnsafeOperations: false,
      commitmentLimit: 128,
      messageBus: false,
    },
  },
  invocationAnalysis: {
    version: 1,
    protocolVersions: [
      1,
    ],
    functions: [
      {
        id: 0,
        name: 'configure',
        arity: 2,
        entryPoint: true,
        selector: '78f3537b',
        calls: [],
        closure: [
          0,
        ],
        component: 0,
        recursive: false,
        reads: [],
        writes: [
          'state:admin',
          'state:counter',
        ],
        effects: [],
        unknown: false,
        bounded: true,
        maximumDirectInvocations: 0,
        blockLayout: {
          blockSize: 2,
          slots: [
            {
              kind: 'master',
              offset: 0,
            },
            {
              kind: 'dataNft',
              offset: 1,
              nftIndex: 0,
            },
          ],
        },
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
  delegateArtifact: {
    contractName: 'FoldChild',
    constructorInputs: [
      {
        name: 'owner',
        type: 'bytes20',
      },
    ],
    abi: [
      {
        name: 'configure',
        selector: '78f3537b',
        inputs: [
          {
            name: 'c',
            type: 'int256',
          },
          {
            name: 'a',
            type: 'bytes20',
          },
          {
            name: '__internal__proxyMasterIndex',
            type: 'bigint',
          },
        ],
        modifiers: [
          'delegate',
        ],
        writesState: true,
        requiredNftIndices: [
          0,
        ],
        blockLayout: {
          blockSize: 2,
          slots: [
            {
              kind: 'master',
              offset: 0,
            },
            {
              kind: 'dataNft',
              offset: 1,
              nftIndex: 0,
            },
          ],
        },
      },
    ],
    bytecode: '78765102ff008d9301218001207f770100887552798201148875748c7976ce01207f7752887676c77ccd8876c09e69c052949d7c76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e686868687b01147c7e5169c052948bce01207f75c05294ce01207f75886e7ec052948bd288c052948bc7c052948bcd88c052948bcec052948bd1887c6dc05294c7c05294cd88c05294cec05294d188c05294518ac7c0cd88c0c6c0cc88c0cec0d188c0ce01207f775288c0cfc0d288c0d0c0d3a169c0518a5294ce01207f75c0c48c6576009f6375516776d15379876376d3009c63006968688c0068666dc05294c6c05294cc88c05294d0c05294d3a169c052948bc6c052948bcc88c052948bd0c052948bd3a1696d51 78f3537b OP_DEFINE ce00c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600a26975c0 OP_1 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
    source: '\n  contract FoldChild(bytes20 owner) {\n    int counter;\n    bytes20 admin;\n\n    function configure(int c, bytes20 a) {\n      this.counter = c;\n      this.admin = a;\n      require(true);\n    }\n  }\n',
    debug: {
      bytecode: '4d550178765102ff008d9301218001207f770100887552798201148875748c7976ce01207f7752887676c77ccd8876c09e69c052949d7c76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e686868687b01147c7e5169c052948bce01207f75c05294ce01207f75886e7ec052948bd288c052948bc7c052948bcd88c052948bcec052948bd1887c6dc05294c7c05294cd88c05294cec05294d188c05294518ac7c0cd88c0c6c0cc88c0cec0d188c0ce01207f775288c0cfc0d288c0d0c0d3a169c0518a5294ce01207f75c0c48c6576009f6375516776d15379876376d3009c63006968688c0068666dc05294c6c05294cc88c05294d0c05294d3a169c052948bc6c052948bcc88c052948bd0c052948bd3a1696d510478f3537b8937ce00c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600a26975c05189748c7a82549d8a',
      sourceMap: '6:4:10:5;;;2:2:11:3;;;;;;;;;',
      logs: [],
      requires: [],
      functionDebug: {
        '78f3537b': {
          requires: [
            {
              ip: 133,
              line: 9,
            },
          ],
          logs: [],
          sourceMap: '6:23:6:28;;;;;;;;;;;;;;:30::39;;;;;;:4:10:5;;;;;;;;;;;;;;;;;;;;;;;;7:21:7:22;:6::23:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;8:19:8:20:0;:6::21:1;;;9:14:9:18:0;:6::20:1;6:4:10:5:0;;;;;;;;;;;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
        },
      },
      invokeDebug: {
        '1': {
          bytecode: 'ce00c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600a26975c0',
          name: 'outlined source span 1',
          requires: [],
          logs: [],
          sourceMap: '6:4:10:5:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
        },
      },
    },
    functionBodies: {
      '78f3537b': '78765102ff008d9301218001207f770100887552798201148875748c7976ce01207f7752887676c77ccd8876c09e69c052949d7c76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e686868687b01147c7e5169c052948bce01207f75c05294ce01207f75886e7ec052948bd288c052948bc7c052948bcd88c052948bcec052948bd1887c6dc05294c7c05294cd88c05294cec05294d188c05294518ac7c0cd88c0c6c0cc88c0cec0d188c0ce01207f775288c0cfc0d288c0d0c0d3a169c0518a5294ce01207f75c0c48c6576009f6375516776d15379876376d3009c63006968688c0068666dc05294c6c05294cc88c05294d0c05294d3a169c052948bc6c052948bcc88c052948bd0c052948bd3a1696d51',
    },
    fingerprint: '55c331ca4ac3e8d162c10a1cc0c301e71e7ec3e5283bb20bde1cf3400edc24c4',
    stateLayout: {
      variables: [
        {
          name: 'counter',
          type: 'int256',
          nftIndex: 0,
          fieldIndex: 0,
        },
        {
          name: 'admin',
          type: 'bytes20',
          nftIndex: 0,
          fieldIndex: 1,
        },
      ],
      dataNftCount: 1,
      commitmentLimit: 128,
    },
    compiler: {
      name: 'solidc',
      version: '0.13.1',
      options: {
        enforceFunctionParameterTypes: true,
        enforceLocktimeGuard: true,
        enforceFinalRequire: true,
        allowUnsafeOperations: false,
        commitmentLimit: 128,
        messageBus: false,
      },
    },
    updatedAt: '2026-08-10T21:35:31.190Z',
    delegateProxyStateOutputCountPinned: true,
    invocationAnalysis: {
      version: 1,
      protocolVersions: [
        1,
      ],
      functions: [
        {
          id: 0,
          name: 'configure',
          arity: 2,
          entryPoint: true,
          selector: '78f3537b',
          calls: [],
          closure: [
            0,
          ],
          component: 0,
          recursive: false,
          reads: [],
          writes: [
            'state:admin',
            'state:counter',
          ],
          effects: [],
          unknown: false,
          bounded: true,
          maximumDirectInvocations: 0,
          blockLayout: {
            blockSize: 2,
            slots: [
              {
                kind: 'master',
                offset: 0,
              },
              {
                kind: 'dataNft',
                offset: 1,
                nftIndex: 0,
              },
            ],
          },
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
  },
} as const;
