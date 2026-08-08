/* eslint-disable max-len */
import { LineToAsmMap, LineToOpcodesMap } from '@solidcash/utils';
import { Op } from '../../src/script.js';
import { hexToBin } from '@bitauth/libauth';

export interface Fixture {
  name: string;
  sourceCode: string;
  asmBytecode: string;
  sourceMap: string;
  expectedLineToOpcodeMap: LineToOpcodesMap;
  expectedLineToAsmMap: LineToAsmMap;
  expectedBitAuthScript: string;
}

export const fixtures: Fixture[] = [
  {
    name: 'TransferWithTimeout (Modified with random extra statements)',
    sourceCode: `
contract TransferWithTimeout(bytes20 senderPkh, bytes20 recipientPkh, int timeout) {
  function transfer(pubkey signingPk, sig s) {
    require(checkSig(s, signingPk));
    require(hash160(signingPk) == recipientPkh);
  }

  function timeout(pubkey signingPk, sig s) {
    require(senderPkh == 0xdeadbeef);
    require(timeout == timeout);
    require(s == s);
    require(signingPk == signingPk);
    require(checkSig(s, signingPk));
    require(hash160(signingPk) == senderPkh);
    require(tx.time >= timeout);
  }
}`,
    asmBytecode: '547a5479ad537aa97b877777 c4e6689f OP_DEFINE 7605deadbeef0001148088527953799d54795579885379547988547a5479ad537aa9887cb16d51 0ad09621 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
    sourceMap: '3:2:6:3;;;8::16;;;2:0:17:1;;;;;;',
    expectedLineToOpcodeMap: {
      '3': [hexToBin('547a5479ad537aa97b877777'), hexToBin('c4e6689f'), Op.OP_RESERVED1],
      '8': [hexToBin('7605deadbeef0001148088527953799d54795579885379547988547a5479ad537aa9887cb16d51'), hexToBin('0ad09621'), Op.OP_RESERVED1, Op.OP_DEPTH, Op.OP_1SUB, Op.OP_ROLL, Op.OP_SIZE, Op.OP_4, Op.OP_NUMEQUALVERIFY, Op.OP_RESERVED2],
    },
    expectedLineToAsmMap: {
      '3': '<0x547a5479ad537aa97b877777> <0xc4e6689f> OP_DEFINE',
      '8': '<0x7605deadbeef0001148088527953799d54795579885379547988547a5479ad537aa9887cb16d51> <0x0ad09621> OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
    },
    expectedBitAuthScript: `                                                                                                                                                                            /*                                                                                      */
                                                                                                                                                                            /* contract TransferWithTimeout(bytes20 senderPkh, bytes20 recipientPkh, int timeout) { */
<0x547a5479ad537aa97b877777> <0xc4e6689f> OP_DEFINE                                                                                                                         /*   function transfer(pubkey signingPk, sig s) {                                       */
                                                                                                                                                                            /*     require(checkSig(s, signingPk));                                                 */
                                                                                                                                                                            /*     require(hash160(signingPk) == recipientPkh);                                     */
                                                                                                                                                                            /*   }                                                                                  */
                                                                                                                                                                            /*                                                                                      */
<0x7605deadbeef0001148088527953799d54795579885379547988547a5479ad537aa9887cb16d51> <0x0ad09621> OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE /*   function timeout(pubkey signingPk, sig s) {                                        */
                                                                                                                                                                            /*     require(senderPkh == 0xdeadbeef);                                                */
                                                                                                                                                                            /*     require(timeout == timeout);                                                     */
                                                                                                                                                                            /*     require(s == s);                                                                 */
                                                                                                                                                                            /*     require(signingPk == signingPk);                                                 */
                                                                                                                                                                            /*     require(checkSig(s, signingPk));                                                 */
                                                                                                                                                                            /*     require(hash160(signingPk) == senderPkh);                                        */
                                                                                                                                                                            /*     require(tx.time >= timeout);                                                     */
                                                                                                                                                                            /*   }                                                                                  */
                                                                                                                                                                            /* }                                                                                    */`,
  },
  {
    name: 'Mecenas',
    sourceCode: `pragma solidcash >=0.8.0;

/* This is an unofficial SolidCash port of Licho's Mecenas contract. It is
 * not compatible with Licho's EC plugin, but rather meant as a demonstration
 * of covenants in SolidCash.
 * The time checking has been removed so it can be tested without time requirements.
 */
contract Mecenas(bytes20 recipient, bytes20 funder, int pledge/*, int period */) {
    function recvFunds() {
        // require(this.age >= period);

        // Check that the first output sends to the recipient
        require(tx.outputs[0].lockingBytecode == new LockingBytecodeP2PKH(recipient));

        int minerFee = 1000;
        int currentValue = tx.inputs[this.activeInputIndex].value;
        int changeValue = currentValue - pledge - minerFee;

        // If there is not enough left for *another* pledge after this one, we send the remainder to the recipient
        // Otherwise we send the remainder to the recipient and the change back to the contract
        if (changeValue <= pledge + minerFee) {
            require(tx.outputs[0].value == currentValue - minerFee);
        } else {
            require(tx.outputs[0].value == pledge);
            require(tx.outputs[1].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);
            require(tx.outputs[1].value == changeValue);
        }
    }

    function reclaim(pubkey pk, sig s) {
        require(hash160(pk) == funder);
        require(checkSig(s, pk));
    }
}`,
    asmBytecode: '00cd0376a9147b7e0288ac7e8802e803c0c676547994518a527994518a765579547993518aa16300cc707c94518a9d6700cc55799d51cdc0c78851cc789d686d6d7551 e8e62fca OP_DEFINE 5379a97b8872ac7777 2f7ef34c OP_DEFINE 7621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169 OP_1 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
    sourceMap: '9:4:28:5;;;30::33;;;8:0:34:1;;;;;;;;;',
    expectedLineToOpcodeMap: {
      '9': [hexToBin('00cd0376a9147b7e0288ac7e8802e803c0c676547994518a527994518a765579547993518aa16300cc707c94518a9d6700cc55799d51cdc0c78851cc789d686d6d7551'), hexToBin('e8e62fca'), Op.OP_RESERVED1],
      '30': [hexToBin('5379a97b8872ac7777'), hexToBin('2f7ef34c'), Op.OP_RESERVED1, hexToBin('7621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169'), Op.OP_1, Op.OP_RESERVED1, Op.OP_DEPTH, Op.OP_1SUB, Op.OP_ROLL, Op.OP_SIZE, Op.OP_4, Op.OP_NUMEQUALVERIFY, Op.OP_RESERVED2],
    },
    expectedLineToAsmMap: {
      '9': '<0x00cd0376a9147b7e0288ac7e8802e803c0c676547994518a527994518a765579547993518aa16300cc707c94518a9d6700cc55799d51cdc0c78851cc789d686d6d7551> <0xe8e62fca> OP_DEFINE',
      '30': '<0x5379a97b8872ac7777> <0x2f7ef34c> OP_DEFINE <0x7621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169> OP_1 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE',
    },
    expectedBitAuthScript: `                                                                                                                                                                                                                                                                                      /* pragma solidcash >=0.8.0;                                                                                          */
                                                                                                                                                                                                                                                                                      /*                                                                                                                    */
                                                                                                                                                                                                                                                                                      /* \\/* This is an unofficial SolidCash port of Licho's Mecenas contract. It is                                        */
                                                                                                                                                                                                                                                                                      /*  * not compatible with Licho's EC plugin, but rather meant as a demonstration                                      */
                                                                                                                                                                                                                                                                                      /*  * of covenants in SolidCash.                                                                                      */
                                                                                                                                                                                                                                                                                      /*  * The time checking has been removed so it can be tested without time requirements.                               */
                                                                                                                                                                                                                                                                                      /*  *\\/                                                                                                               */
                                                                                                                                                                                                                                                                                      /* contract Mecenas(bytes20 recipient, bytes20 funder, int pledge\\/*, int period *\\/) {                               */
<0x00cd0376a9147b7e0288ac7e8802e803c0c676547994518a527994518a765579547993518aa16300cc707c94518a9d6700cc55799d51cdc0c78851cc789d686d6d7551> <0xe8e62fca> OP_DEFINE                                                                                                                     /*     function recvFunds() {                                                                                         */
                                                                                                                                                                                                                                                                                      /*         // require(this.age >= period);                                                                            */
                                                                                                                                                                                                                                                                                      /*                                                                                                                    */
                                                                                                                                                                                                                                                                                      /*         // Check that the first output sends to the recipient                                                      */
                                                                                                                                                                                                                                                                                      /*         require(tx.outputs[0].lockingBytecode == new LockingBytecodeP2PKH(recipient));                             */
                                                                                                                                                                                                                                                                                      /*                                                                                                                    */
                                                                                                                                                                                                                                                                                      /*         int minerFee = 1000;                                                                                       */
                                                                                                                                                                                                                                                                                      /*         int currentValue = tx.inputs[this.activeInputIndex].value;                                                 */
                                                                                                                                                                                                                                                                                      /*         int changeValue = currentValue - pledge - minerFee;                                                        */
                                                                                                                                                                                                                                                                                      /*                                                                                                                    */
                                                                                                                                                                                                                                                                                      /*         // If there is not enough left for *another* pledge after this one, we send the remainder to the recipient */
                                                                                                                                                                                                                                                                                      /*         // Otherwise we send the remainder to the recipient and the change back to the contract                    */
                                                                                                                                                                                                                                                                                      /*         if (changeValue <= pledge + minerFee) {                                                                    */
                                                                                                                                                                                                                                                                                      /*             require(tx.outputs[0].value == currentValue - minerFee);                                               */
                                                                                                                                                                                                                                                                                      /*         } else {                                                                                                   */
                                                                                                                                                                                                                                                                                      /*             require(tx.outputs[0].value == pledge);                                                                */
                                                                                                                                                                                                                                                                                      /*             require(tx.outputs[1].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);            */
                                                                                                                                                                                                                                                                                      /*             require(tx.outputs[1].value == changeValue);                                                           */
                                                                                                                                                                                                                                                                                      /*         }                                                                                                          */
                                                                                                                                                                                                                                                                                      /*     }                                                                                                              */
                                                                                                                                                                                                                                                                                      /*                                                                                                                    */
<0x5379a97b8872ac7777> <0x2f7ef34c> OP_DEFINE <0x7621000000000000000000000000000000000000000000000000000000000000008080a2697620ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa169> OP_1 OP_DEFINE OP_DEPTH OP_1SUB OP_ROLL OP_SIZE OP_4 OP_NUMEQUALVERIFY OP_INVOKE /*     function reclaim(pubkey pk, sig s) {                                                                           */
                                                                                                                                                                                                                                                                                      /*         require(hash160(pk) == funder);                                                                            */
                                                                                                                                                                                                                                                                                      /*         require(checkSig(s, pk));                                                                                  */
                                                                                                                                                                                                                                                                                      /*     }                                                                                                              */
                                                                                                                                                                                                                                                                                      /* }                                                                                                                  */`,
  },
  {
    name: 'HodlVault',
    sourceCode: `// This contract forces HODLing until a certain price target has been reached
// A minimum block is provided to ensure that oracle price entries from before this block are disregarded
// i.e. when the BCH price was $1000 in the past, an oracle entry with the old block number and price can not be used.
// Instead, a message with a block number and price from after the minBlock needs to be passed.
// This contract serves as a simple example for checkDataSig-based contracts.
contract HodlVault(
    pubkey ownerPk,
    pubkey oraclePk,
    int minBlock,
    int priceTarget
) {
    function spend(
        sig ownerSig,
        datasig oracleSig,
        bytes8 oracleMessage
    ) {
        // message: { blockHeight, price }
        bytes4 blockHeightBin, bytes4 priceBin = oracleMessage.split(4);
        int blockHeight = int(blockHeightBin);
        int price = int(priceBin);

        // Check that blockHeight is after minBlock and not in the future
        require(blockHeight >= minBlock);
        require(tx.time >= blockHeight);

        // Check that current price is at least priceTarget
        require(price >= priceTarget);

        // Handle necessary signature checks
        require(checkDataSig(oracleSig, oracleMessage, oraclePk));
        require(checkSig(ownerSig, ownerPk));
    }
}`,
    asmBytecode: '7c817621000000000000000000000000000000000000000000000000000000000000008080a2 OP_1 OP_DEFINE 20ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1 OP_2 OP_DEFINE OP_6 OP_PICK OP_SIZE OP_8 OP_EQUALVERIFY OP_DROP OP_6 OP_PICK OP_4 OP_SPLIT OP_1 OP_INVOKE OP_VERIFY OP_DUP OP_2 OP_INVOKE OP_VERIFY OP_1 OP_INVOKE OP_VERIFY OP_DUP OP_2 OP_INVOKE OP_VERIFY OP_OVER OP_5 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY OP_SWAP OP_CHECKLOCKTIMEVERIFY OP_DROP OP_3 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY OP_3 OP_ROLL OP_4 OP_ROLL OP_3 OP_ROLL OP_CHECKDATASIGVERIFY OP_CHECKSIG',
    sourceMap: '6::33:1;;;;;;15:8:15:28;;;;;;18:49:18:62;;:69::70;:49::71:1;19:30:19:44:0;;:26::45:1;;;;;20:24:20:32:0;;:20::33:1;;;;;23:16:23:27:0;:31::39;;:16:::1;:8::41;24:27:24:38:0;:8::40:1;;27:25:27:36:0;;:16:::1;:8::38;30:29:30::0;;:40::53;;:55::63;;:8::66:1;31::31:45',
    expectedLineToOpcodeMap: {
      '6': [hexToBin('7c817621000000000000000000000000000000000000000000000000000000000000008080a2'), Op.OP_1, Op.OP_RESERVED1, hexToBin('20ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1'), Op.OP_2, Op.OP_RESERVED1],
      '15': [Op.OP_6, Op.OP_PICK, Op.OP_SIZE, Op.OP_8, Op.OP_EQUALVERIFY, Op.OP_DROP],
      '18': [Op.OP_6, Op.OP_PICK, Op.OP_4, Op.OP_SPLIT],
      '19': [Op.OP_1, Op.OP_RESERVED2, Op.OP_VERIFY, Op.OP_DUP, Op.OP_2, Op.OP_RESERVED2, Op.OP_VERIFY],
      '20': [Op.OP_1, Op.OP_RESERVED2, Op.OP_VERIFY, Op.OP_DUP, Op.OP_2, Op.OP_RESERVED2, Op.OP_VERIFY],
      '23': [Op.OP_OVER, Op.OP_5, Op.OP_ROLL, Op.OP_GREATERTHANOREQUAL, Op.OP_VERIFY],
      '24': [Op.OP_SWAP, Op.OP_CHECKLOCKTIMEVERIFY, Op.OP_DROP],
      '27': [Op.OP_3, Op.OP_ROLL, Op.OP_GREATERTHANOREQUAL, Op.OP_VERIFY],
      '30': [Op.OP_3, Op.OP_ROLL, Op.OP_4, Op.OP_ROLL, Op.OP_3, Op.OP_ROLL, Op.OP_CHECKDATASIGVERIFY],
      '31': [Op.OP_CHECKSIG],
    },
    expectedLineToAsmMap: {
      '6': '<0x7c817621000000000000000000000000000000000000000000000000000000000000008080a2> OP_1 OP_DEFINE <0x20ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1> OP_2 OP_DEFINE',
      '15': 'OP_6 OP_PICK OP_SIZE OP_8 OP_EQUALVERIFY OP_DROP',
      '18': 'OP_6 OP_PICK OP_4 OP_SPLIT',
      '19': 'OP_1 OP_INVOKE OP_VERIFY OP_DUP OP_2 OP_INVOKE OP_VERIFY',
      '20': 'OP_1 OP_INVOKE OP_VERIFY OP_DUP OP_2 OP_INVOKE OP_VERIFY',
      '23': 'OP_OVER OP_5 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY',
      '24': 'OP_SWAP OP_CHECKLOCKTIMEVERIFY OP_DROP',
      '27': 'OP_3 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY',
      '30': 'OP_3 OP_ROLL OP_4 OP_ROLL OP_3 OP_ROLL OP_CHECKDATASIGVERIFY',
      '31': 'OP_CHECKSIG',
    },
    expectedBitAuthScript: `                                                                                                                                                                                        /* // This contract forces HODLing until a certain price target has been reached                                          */
                                                                                                                                                                                        /* // A minimum block is provided to ensure that oracle price entries from before this block are disregarded              */
                                                                                                                                                                                        /* // i.e. when the BCH price was $1000 in the past, an oracle entry with the old block number and price can not be used. */
                                                                                                                                                                                        /* // Instead, a message with a block number and price from after the minBlock needs to be passed.                        */
                                                                                                                                                                                        /* // This contract serves as a simple example for checkDataSig-based contracts.                                          */
<0x7c817621000000000000000000000000000000000000000000000000000000000000008080a2> OP_1 OP_DEFINE <0x20ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7fa1> OP_2 OP_DEFINE /* contract HodlVault(                                                                                                    */
                                                                                                                                                                                        /*     pubkey ownerPk,                                                                                                    */
                                                                                                                                                                                        /*     pubkey oraclePk,                                                                                                   */
                                                                                                                                                                                        /*     int minBlock,                                                                                                      */
                                                                                                                                                                                        /*     int priceTarget                                                                                                    */
                                                                                                                                                                                        /* ) {                                                                                                                    */
                                                                                                                                                                                        /*     function spend(                                                                                                    */
                                                                                                                                                                                        /*         sig ownerSig,                                                                                                  */
                                                                                                                                                                                        /*         datasig oracleSig,                                                                                             */
OP_6 OP_PICK OP_SIZE OP_8 OP_EQUALVERIFY OP_DROP                                                                                                                                        /*         bytes8 oracleMessage                                                                                           */
                                                                                                                                                                                        /*     ) {                                                                                                                */
                                                                                                                                                                                        /*         // message: { blockHeight, price }                                                                             */
OP_6 OP_PICK OP_4 OP_SPLIT                                                                                                                                                              /*         bytes4 blockHeightBin, bytes4 priceBin = oracleMessage.split(4);                                               */
OP_1 OP_INVOKE OP_VERIFY OP_DUP OP_2 OP_INVOKE OP_VERIFY                                                                                                                                /*         int blockHeight = int(blockHeightBin);                                                                         */
OP_1 OP_INVOKE OP_VERIFY OP_DUP OP_2 OP_INVOKE OP_VERIFY                                                                                                                                /*         int price = int(priceBin);                                                                                     */
                                                                                                                                                                                        /*                                                                                                                        */
                                                                                                                                                                                        /*         // Check that blockHeight is after minBlock and not in the future                                              */
OP_OVER OP_5 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY                                                                                                                                    /*         require(blockHeight >= minBlock);                                                                              */
OP_SWAP OP_CHECKLOCKTIMEVERIFY OP_DROP                                                                                                                                                  /*         require(tx.time >= blockHeight);                                                                               */
                                                                                                                                                                                        /*                                                                                                                        */
                                                                                                                                                                                        /*         // Check that current price is at least priceTarget                                                            */
OP_3 OP_ROLL OP_GREATERTHANOREQUAL OP_VERIFY                                                                                                                                            /*         require(price >= priceTarget);                                                                                 */
                                                                                                                                                                                        /*                                                                                                                        */
                                                                                                                                                                                        /*         // Handle necessary signature checks                                                                           */
OP_3 OP_ROLL OP_4 OP_ROLL OP_3 OP_ROLL OP_CHECKDATASIGVERIFY                                                                                                                            /*         require(checkDataSig(oracleSig, oracleMessage, oraclePk));                                                     */
OP_CHECKSIG                                                                                                                                                                             /*         require(checkSig(ownerSig, ownerPk));                                                                          */
                                                                                                                                                                                        /*     }                                                                                                                  */
                                                                                                                                                                                        /* }                                                                                                                      */`,
  },
];
