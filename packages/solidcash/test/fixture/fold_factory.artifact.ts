export default {
  contractName: 'FoldFactory',
  constructorInputs: [
    {
      name: 'factoryOwner',
      type: 'pubkey',
    },
  ],
  abi: [
    {
      name: 'deployConfigured',
      selector: '7925033c',
      inputs: [
        {
          name: 's',
          type: 'sig',
        },
        {
          name: 'childOwner',
          type: 'bytes20',
        },
        {
          name: 'c0',
          type: 'int256',
        },
        {
          name: 'a0',
          type: 'bytes20',
        },
      ],
      modifiers: [
        'deploy',
      ],
      writesState: true,
      requiredNftIndices: [
        0,
      ],
      deployTargets: [
        {
          contractName: 'FoldChild',
          dataNftCount: 1,
          constructorArgs: [
            'childOwner',
          ],
          creationBytecode: '3200c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600518978765102ff008d9301218001207f7701008875527982011488757c76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e686868687b01147c7e5169c08bce01207f75c0ce01207f75886e7ec08bd288c08bc7c08bcd88c08bcec08bd1887c6dc0c7c0cd88c0cec0d188c0ce518aa26975c0ce01207f75517e518a9d75c0c6c0cc88c0d0c0d3a169c08bc6c08bcc88c08bd0c08bd3a1697551',
          hasFoldedChildCall: true,
        },
      ],
      signatureGuard: {
        key: {
          kind: 'constructorArg',
          name: 'factoryOwner',
        },
      },
      blockLayout: {
        blockSize: 4,
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
          {
            kind: 'deploy',
            offset: 2,
            slotIndex: 0,
          },
          {
            kind: 'deployDataNft',
            offset: 3,
            slotIndex: 0,
            nftIndex: 0,
          },
        ],
      },
    },
  ],
  bytecode: '7e00c48c6576009f6375516776d1537987637c8b7c688c00686651 OP_1 OP_DEFINE 0888c0ce01207f51887e787e OP_2 OP_DEFINE 76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68686868 83 OP_DEFINE OP_2 OP_PICK OP_SIZE 14 OP_EQUALVERIFY OP_DROP OP_3 OP_PICK OP_DUP OP_1 ff00 OP_LSHIFTNUM OP_ADD 21 OP_NUM2BIN 20 OP_SPLIT OP_NIP 00 OP_EQUALVERIFY OP_DROP OP_4 OP_PICK OP_SIZE 14 OP_EQUALVERIFY OP_DROP OP_CHECKSIGVERIFY 14 OP_SWAP OP_CAT 3200c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600518978765102ff008d9301218001207f7701008875527982011488757c76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e686868687b01147c7e5169c08bce01207f75c0ce01207f75886e7ec08bd288c08bc7c08bcd88c08bcec08bd1887c6dc0c7c0cd88c0cec0d188c0ce518aa26975c0ce01207f75517e518a9d75c0c6c0cc88c0d0c0d3a169c08bc6c08bcc88c08bd0c08bd3a1697551 OP_CAT OP_INPUTINDEX OP_2 OP_ADD OP_DUP OP_OUTPOINTINDEX OP_0 OP_EQUALVERIFY OP_OUTPOINTTXHASH 21 OP_SWAP OP_CAT 02c0ce88 OP_CAT OP_SWAP OP_CAT OP_HASH256 aa20 OP_SWAP OP_CAT 87 OP_CAT OP_INPUTINDEX OP_2 OP_ADD OP_DUP OP_OUTPOINTINDEX OP_0 OP_EQUALVERIFY OP_OUTPOINTTXHASH OP_OVER OP_INPUTINDEX OP_1ADD OP_UTXOTOKENCOMMITMENT OP_1 OP_SPLIT OP_SWAP OP_DUP 00 OP_EQUAL OP_IF OP_DROP OP_0 OP_SWAP OP_ELSE OP_DUP 4f OP_EQUAL OP_IF OP_DROP OP_1NEGATE OP_SWAP OP_ELSE OP_DUP OP_BIN2NUM OP_DUP 51 OP_GREATERTHANOREQUAL OP_SWAP 60 OP_LESSTHANOREQUAL OP_BOOLAND OP_IF OP_BIN2NUM 50 OP_SUB OP_SWAP OP_ELSE OP_DUP 4c OP_EQUAL OP_IF OP_DROP OP_1 OP_SPLIT OP_SWAP 00 OP_CAT OP_BIN2NUM OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP OP_ELSE OP_DUP 4d OP_EQUAL OP_IF OP_DROP OP_2 OP_SPLIT OP_SWAP 00 OP_CAT OP_BIN2NUM OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP OP_ELSE OP_BIN2NUM OP_SPLIT OP_SWAP OP_BIN2NUM OP_SWAP OP_ENDIF OP_ENDIF OP_ENDIF OP_ENDIF OP_ENDIF OP_DROP OP_1ADD 83 OP_INVOKE OP_INPUTINDEX OP_1ADD OP_UTXOTOKENCATEGORY 20 OP_SPLIT OP_DROP OP_INPUTINDEX OP_UTXOTOKENCATEGORY 20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_DUP OP_INPUTINDEX OP_1ADD OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY OP_INPUTINDEX OP_1ADD OP_UTXOBYTECODE OP_INPUTINDEX OP_1ADD OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_1ADD OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_1ADD OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_DROP OP_2 OP_PICK OP_INPUTINDEX OP_2 OP_ADD OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_OVER OP_2 OP_CAT OP_INPUTINDEX OP_2 OP_ADD OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_OVER 20 OP_SWAP OP_CAT 76539c63757cce01207f5288 OP_OVER OP_CAT OP_2 OP_INVOKE 8876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c6375ce01207f5288 OP_CAT OP_OVER OP_CAT OP_2 OP_INVOKE 88c0c49f63c0d1826301207f75 OP_CAT OP_OVER OP_CAT 87916967756868516763ce01207f5288 OP_CAT OP_OVER OP_CAT 7d88c0ce01207f75886775c0ce01207f5188 OP_CAT OP_OVER OP_CAT 88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc876868 OP_CAT OP_NIP OP_HASH256 aa20 OP_SWAP OP_CAT 87 OP_CAT OP_INPUTINDEX OP_3 OP_ADD OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_OVER OP_1 OP_CAT OP_INPUTINDEX OP_3 OP_ADD OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_3 OP_PICK 83 OP_INVOKE OP_5 OP_PICK 14 OP_SWAP OP_CAT OP_CAT OP_INPUTINDEX OP_3 OP_ADD OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY OP_INPUTINDEX OP_2 OP_ADD OP_OUTPOINTTXHASH OP_2 OP_1 OP_INVOKE OP_NUMEQUALVERIFY OP_DROP OP_INPUTINDEX OP_2 OP_ADD OP_OUTPOINTTXHASH OP_1 OP_1 OP_INVOKE OP_NUMEQUALVERIFY OP_DROP OP_NIP OP_NIP OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_0 OP_TXINPUTCOUNT OP_1SUB OP_BEGIN OP_DUP OP_0 OP_LESSTHAN OP_IF OP_DROP OP_1 OP_ELSE OP_DUP OP_UTXOTOKENCATEGORY OP_3 OP_PICK OP_EQUAL OP_IF OP_SWAP OP_1ADD OP_SWAP OP_ENDIF OP_1SUB OP_0 OP_ENDIF OP_UNTIL OP_TXOUTPUTCOUNT OP_1SUB OP_BEGIN OP_DUP OP_0 OP_LESSTHAN OP_IF OP_DROP OP_1 OP_ELSE OP_DUP OP_OUTPUTTOKENCATEGORY OP_3 OP_PICK OP_EQUAL OP_IF OP_SWAP OP_1SUB OP_SWAP OP_ENDIF OP_1SUB OP_0 OP_ENDIF OP_UNTIL OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_DROP OP_INPUTINDEX OP_UTXOVALUE OP_INPUTINDEX OP_OUTPUTVALUE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENAMOUNT OP_INPUTINDEX OP_OUTPUTTOKENAMOUNT OP_LESSTHANOREQUAL OP_VERIFY OP_INPUTINDEX OP_1ADD OP_UTXOVALUE OP_INPUTINDEX OP_1ADD OP_OUTPUTVALUE OP_EQUALVERIFY OP_INPUTINDEX OP_1ADD OP_UTXOTOKENAMOUNT OP_INPUTINDEX OP_1ADD OP_OUTPUTTOKENAMOUNT OP_LESSTHANOREQUAL OP_VERIFY OP_2DROP OP_DROP OP_1',
  source: '\n  import "./fold_child.scash";\n  contract FoldFactory(pubkey factoryOwner) {\n    int deployCount;\n\n    function deployConfigured(sig s, bytes20 childOwner, int c0, bytes20 a0) {\n      require(checkSig(s, factoryOwner));\n      FoldChild child = new FoldChild(childOwner);\n      child.configure(c0, a0);\n      this.deployCount = this.deployCount + 1;\n    }\n  }\n',
  debug: {
    bytecode: '1b7e00c48c6576009f6375516776d1537987637c8b7c688c0068665151890c0888c0ce01207f51887e787e52894c5b76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68686868018389527982011488755379765102ff008d9301218001207f770100887554798201148875ad01147c7e4d0f013200c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600518978765102ff008d9301218001207f7701008875527982011488757c76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e686868687b01147c7e5169c08bce01207f75c0ce01207f75886e7ec08bd288c08bc7c08bcd88c08bcec08bd1887c6dc0c7c0cd88c0cec0d188c0ce518aa26975c0ce01207f75517e518a9d75c0c6c0cc88c0d0c0d3a169c08bc6c08bcc88c08bd0c08bd3a16975517ec0529376c90088c801217c7e0402c0ce887e7c7eaa02aa207c7e01877ec0529376c90088c878c08bcf517f7c760100876375007c6776014f8763754f7c677681760151a27c0160a19a63810150947c6776014c876375517f7c01007e817f7c817c6776014d876375527f7c01007e817f7c817c67817f7c817c6868686868758b01838ac08bce01207f75c0ce01207f758876c08bd288c08bc7c08bcd88c08bcec08bd188755279c05293cd8878527ec05293d1887801207c7e0c76539c63757cce01207f5288787e528a238876cdc0c78876d1c0ce8876d3c0d0a26976ccc0c687776776529c6375ce01207f52887e787e528a0d88c0c49f63c0d1826301207f757e787e1087916967756868516763ce01207f52887e787e127d88c0ce01207f75886775c0ce01207f51887e787e1e88c0cfc0d28868c0c7c0cd88c0cec0d188c0d3c0d0a269c0c6c0cc8768687e77aa02aa207c7e01877ec05393cd8878517ec05393d188537901838a557901147c7e7ec05393d288c05293c852518a9d75c05293c851518a9d757777c0c7c0cd88c0cec0d188c0ce00c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600a26975c0c6c0cc88c0d0c0d3a169c08bc6c08bcc88c08bd0c08bd3a1696d7551',
    sourceMap: '2:2:12:3;;;;;;3;;;6:37:6:55;;;;;;:57::63;;;;;;;;;;;;;;;:65::75;;;;;;7:6:7:41:1;8:24:8:49:0;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;10:25:10:41;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;:::45:1;:6::46;;6:4:11:5:0;;;;;;;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;9:22:9:24:0;;6:4:11:5:1;;9:26:9:28:0;;6:4:11:5:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
    logs: [],
    requires: [
      {
        ip: 37,
        line: 7,
      },
    ],
    invokeDebug: {
      '-3': {
        bytecode: '76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e68686868',
        name: 'compiler helper -3',
        requires: [],
        logs: [],
        sourceMap: '3:2:12:3;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
      },
    },
  },
  fingerprint: 'b01096126bc463f25464a92d59140f80d6fab1121159d0de926c6e0a99cf6d2a',
  stateLayout: {
    variables: [
      {
        name: 'deployCount',
        type: 'int256',
        nftIndex: 0,
        fieldIndex: 0,
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
        name: 'deployConfigured',
        arity: 4,
        entryPoint: true,
        selector: '7925033c',
        calls: [],
        closure: [
          0,
        ],
        component: 0,
        recursive: false,
        reads: [
          'state:deployCount',
        ],
        writes: [
          'state:deployCount',
        ],
        effects: [
          'external-call',
        ],
        unknown: false,
        bounded: true,
        maximumDirectInvocations: 0,
        blockLayout: {
          blockSize: 4,
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
            {
              kind: 'deploy',
              offset: 2,
              slotIndex: 0,
            },
            {
              kind: 'deployDataNft',
              offset: 3,
              slotIndex: 0,
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
} as const;
