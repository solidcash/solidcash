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
  bytecode: 'OP_2 OP_PICK OP_SIZE 14 OP_EQUALVERIFY OP_DROP OP_SWAP OP_DUP OP_SIZE OP_0 OP_EQUAL OP_IF OP_2DROP 00 OP_ELSE OP_SIZE OP_1 OP_EQUAL OP_IF OP_DUP OP_1NEGATE OP_EQUAL OP_IF OP_2DROP 4f OP_ELSE OP_DUP OP_BIN2NUM OP_DUP OP_1 OP_GREATERTHANOREQUAL OP_SWAP OP_16 OP_LESSTHANOREQUAL OP_BOOLAND OP_IF OP_DROP OP_BIN2NUM 50 OP_ADD OP_1 OP_NUM2BIN OP_ELSE OP_DROP OP_1 OP_SWAP OP_CAT OP_ENDIF OP_ENDIF OP_ELSE OP_DROP OP_SIZE OP_DUP 4b OP_LESSTHANOREQUAL OP_IF OP_1 OP_NUM2BIN OP_SWAP OP_CAT OP_ELSE OP_DUP ff00 OP_LESSTHANOREQUAL OP_IF OP_2 OP_NUM2BIN OP_1 OP_SPLIT OP_DROP 4c OP_SWAP OP_CAT OP_SWAP OP_CAT OP_ELSE OP_3 OP_NUM2BIN OP_2 OP_SPLIT OP_DROP 4d OP_SWAP OP_CAT OP_SWAP OP_CAT OP_ENDIF OP_ENDIF OP_ENDIF OP_ENDIF OP_ROT 14 OP_SWAP OP_CAT OP_1 OP_VERIFY OP_INPUTINDEX OP_1ADD OP_UTXOTOKENCATEGORY 20 OP_SPLIT OP_DROP OP_INPUTINDEX OP_UTXOTOKENCATEGORY 20 OP_SPLIT OP_DROP OP_EQUALVERIFY OP_2DUP OP_CAT OP_INPUTINDEX OP_1ADD OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY OP_INPUTINDEX OP_1ADD OP_UTXOBYTECODE OP_INPUTINDEX OP_1ADD OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_1ADD OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_1ADD OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_SWAP OP_2DROP OP_INPUTINDEX OP_UTXOBYTECODE OP_INPUTINDEX OP_OUTPUTBYTECODE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_INPUTINDEX OP_OUTPUTTOKENCATEGORY OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENCATEGORY OP_0 OP_TXINPUTCOUNT OP_1SUB OP_BEGIN OP_DUP OP_0 OP_LESSTHAN OP_IF OP_DROP OP_1 OP_ELSE OP_DUP OP_UTXOTOKENCATEGORY OP_3 OP_PICK OP_EQUAL OP_IF OP_SWAP OP_1ADD OP_SWAP OP_ENDIF OP_1SUB OP_0 OP_ENDIF OP_UNTIL OP_TXOUTPUTCOUNT OP_1SUB OP_BEGIN OP_DUP OP_0 OP_LESSTHAN OP_IF OP_DROP OP_1 OP_ELSE OP_DUP OP_OUTPUTTOKENCATEGORY OP_3 OP_PICK OP_EQUAL OP_IF OP_SWAP OP_1SUB OP_SWAP OP_ENDIF OP_1SUB OP_0 OP_ENDIF OP_UNTIL OP_0 OP_GREATERTHANOREQUAL OP_VERIFY OP_DROP OP_INPUTINDEX OP_UTXOVALUE OP_INPUTINDEX OP_OUTPUTVALUE OP_EQUALVERIFY OP_INPUTINDEX OP_UTXOTOKENAMOUNT OP_INPUTINDEX OP_OUTPUTTOKENAMOUNT OP_LESSTHANOREQUAL OP_VERIFY OP_INPUTINDEX OP_1ADD OP_UTXOVALUE OP_INPUTINDEX OP_1ADD OP_OUTPUTVALUE OP_EQUALVERIFY OP_INPUTINDEX OP_1ADD OP_UTXOTOKENAMOUNT OP_INPUTINDEX OP_1ADD OP_OUTPUTTOKENAMOUNT OP_LESSTHANOREQUAL OP_VERIFY OP_DROP OP_1',
  source: '\n  contract FoldChild(bytes20 owner) {\n    int counter;\n    bytes20 admin;\n\n    function configure(int c, bytes20 a) {\n      this.counter = c;\n      this.admin = a;\n      require(true);\n    }\n  }\n',
  debug: {
    bytecode: '527982011488757c76820087636d01006782518763764f87636d014f6776817651a27c60a19a63758101509351806775517c7e686867758276014ba16351807c7e677602ff00a1635280517f75014c7c7e7c7e675380527f75014d7c7e7c7e686868687b01147c7e5169c08bce01207f75c0ce01207f75886e7ec08bd288c08bc7c08bcd88c08bcec08bd1887c6dc0c7c0cd88c0cec0d188c0ce00c38c6576009f6375516776ce537987637c8b7c688c006866c48c6576009f6375516776d1537987637c8c7c688c00686600a26975c0c6c0cc88c0d0c0d3a169c08bc6c08bcc88c08bd0c08bd3a1697551',
    sourceMap: '6:30:6:39;;;;;;7:21:7:22;:6::23:1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;8:19:8:20:0;:6::21:1;;;9:14:9:18:0;:6::20:1;6:4:10:5:0;;;;;;;;;;;;::::1;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;',
    logs: [],
    requires: [
      {
        ip: 96,
        line: 9,
      },
    ],
  },
  fingerprint: '2dce06eb8f8b6c29a263c4bf24ef1bc21476c42e960da631e9f95127e539e053',
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
      commitmentLimit: 128,
    },
  },
  updatedAt: '2026-06-30T17:24:32.050Z',
} as const;
