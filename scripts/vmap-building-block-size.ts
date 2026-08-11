import { Op, encodeInt, scriptToBytecode } from '@solidcash/utils';

const currentAbsence = [
  Op.OP_OVER, Op.OP_BIN2NUM,
  encodeInt(3n), Op.OP_PICK, Op.OP_BIN2NUM,
  Op.OP_LESSTHAN, Op.OP_VERIFY,
  Op.OP_DUP, Op.OP_BIN2NUM, Op.OP_DUP, Op.OP_0, Op.OP_NUMEQUAL,
  Op.OP_IF, Op.OP_DROP,
  Op.OP_ELSE,
  encodeInt(3n), Op.OP_PICK, Op.OP_BIN2NUM,
  Op.OP_SWAP, Op.OP_LESSTHAN, Op.OP_VERIFY,
  Op.OP_ENDIF,
];

// [H, slot, next] -> the same frame. Keep normalized H across both comparisons.
const cachedNormalizedHashAbsence = [
  Op.OP_OVER, Op.OP_BIN2NUM,
  encodeInt(3n), Op.OP_PICK, Op.OP_BIN2NUM,
  Op.OP_TUCK, Op.OP_LESSTHAN, Op.OP_VERIFY,
  Op.OP_OVER, Op.OP_BIN2NUM, Op.OP_DUP, Op.OP_0, Op.OP_NUMEQUAL,
  Op.OP_IF, Op.OP_2DROP,
  Op.OP_ELSE,
  Op.OP_LESSTHAN, Op.OP_VERIFY,
  Op.OP_ENDIF,
];

const currentFourItemPresence = [
  encodeInt(2n), Op.OP_PICK,
  encodeInt(4n), Op.OP_PICK,
  Op.OP_EQUAL,
];
const twoOverPresence = [Op.OP_2OVER, Op.OP_EQUAL];

// [H, address, inputIndex] -> [H, inputIndex], then read the commitment.
const currentReadAddressPin = [
  Op.OP_DUP, Op.OP_UTXOBYTECODE,
  encodeInt(2n), Op.OP_PICK, Op.OP_EQUALVERIFY,
  Op.OP_SWAP, Op.OP_DROP,
  Op.OP_UTXOTOKENCOMMITMENT,
];
const twoDupReadAddressPin = [
  Op.OP_2DUP, Op.OP_UTXOBYTECODE, Op.OP_EQUALVERIFY,
  Op.OP_NIP, Op.OP_UTXOTOKENCOMMITMENT,
];

// Write paths retain the address: [..., address, inputIndex] -> [..., address, commitment].
const currentWriteAddressPin = [
  Op.OP_DUP, Op.OP_UTXOBYTECODE,
  encodeInt(2n), Op.OP_PICK, Op.OP_EQUALVERIFY,
  Op.OP_UTXOTOKENCOMMITMENT,
];
const twoDupWriteAddressPin = [
  Op.OP_2DUP, Op.OP_UTXOBYTECODE, Op.OP_EQUALVERIFY,
  Op.OP_UTXOTOKENCOMMITMENT,
];

const size = (script: Parameters<typeof scriptToBytecode>[0]): number => scriptToBytecode(script).length;

console.log(JSON.stringify({
  absence: { current: size(currentAbsence), proposed: size(cachedNormalizedHashAbsence) },
  fourItemPresence: { current: size(currentFourItemPresence), proposed: size(twoOverPresence) },
  readAddressPin: { current: size(currentReadAddressPin), proposed: size(twoDupReadAddressPin) },
  writeAddressPin: { current: size(currentWriteAddressPin), proposed: size(twoDupWriteAddressPin) },
}, null, 2));
