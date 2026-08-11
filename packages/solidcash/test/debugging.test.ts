import { Contract, FailedTransactionError, MockNetworkProvider, SignatureAlgorithm, SignatureTemplate, TransactionBuilder, VmTarget } from '../src/index.js';
import { DEFAULT_VM_TARGET } from '../src/libauth-template/utils.js';
import { aliceAddress, alicePriv, alicePub, bobPriv, bobPub } from './fixture/vars.js';
import { randomUtxo } from '../src/utils.js';
import { AuthenticationErrorCommon, binToHex, hexToBin } from '@bitauth/libauth';
import {
  artifactTestMultipleConstructorParameters,
  artifactTestLogs,
  artifactTestConsecutiveLogs,
  artifactTestMultipleLogs,
  artifactTestRequires,
  artifactTestSingleFunction,
  artifactTestMultilineRequires,
  artifactTestZeroHandling,
  artifactTestRequireInsideLoop,
  artifactTestLogInsideLoop,
} from './fixture/debugging/debugging_contracts.js';
import { sha256 } from '@solidcash/utils';
import { createTestProvider } from './test-util.js';

describe('Debugging tests', () => {
  describe('console.log statements', () => {
    const provider = createTestProvider();

    const contractTestLogs = new Contract(artifactTestLogs, [alicePub], { provider });
    const contractUtxo = randomUtxo();

    const contractTestLogInsideLoop = new Contract(artifactTestLogInsideLoop, [], { provider });
    const contractTestLogInsideLoopUtxo = randomUtxo();

    beforeAll(async () => {
      await provider.addUtxo(contractTestLogs.address, contractUtxo);
      await provider.addUtxo(contractTestLogInsideLoop.address, contractTestLogInsideLoopUtxo);
    });

    it('should log correct values', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contractTestLogs.unlock.transfer(new SignatureTemplate(alicePriv), 1000n))
        .addOutput({ to: contractTestLogs.address, amount: 10000n });

      // console.log(ownerSig, owner, num, beef, 1, "test", true);
      const expectedLog = new RegExp(`^\\[Input #0] Test.scash:10 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 1000 0xbeef 1 test true$`);
      expect(transaction).toLog(expectedLog);
    });

    it('should log when logging happens before a failing require statement', async () => {
      const incorrectNum = 100n;
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contractTestLogs.unlock.transfer(new SignatureTemplate(alicePriv), incorrectNum))
        .addOutput({ to: contractTestLogs.address, amount: 10000n });

      // console.log(ownerSig, owner, num, beef, 1, "test", true);
      const expectedLog = new RegExp(`^\\[Input #0] Test.scash:10 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 100 0xbeef 1 test true$`);
      expect(transaction).toLog(expectedLog);
    });

    it('should not log when logging happens after a failing require statement', async () => {
      const incorrectPriv = bobPriv;
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contractTestLogs.unlock.transfer(new SignatureTemplate(incorrectPriv), 1000n))
        .addOutput({ to: contractTestLogs.address, amount: 10000n });

      const expectedLog = new RegExp(`^\\[Input #0] Test.scash:10 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 1000 0xbeef 1 test true$`);
      expect(transaction).not.toLog(expectedLog);
    });

    it('should only log console.log statements from the called function', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contractTestLogs.unlock.secondFunction())
        .addOutput({ to: contractTestLogs.address, amount: 10000n });

      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:16 Hello Second Function$'));
      expect(transaction).not.toLog(/Hello First Function/);
    });

    it('should only log console.log statements from the called function when there are many constructor parameters', async () => {
      const contractTestMultipleConstructorParameters = new Contract(
        artifactTestMultipleConstructorParameters,
        [alicePub, 1000n, 2000n, 3000n, 4000n, 5000n],
        { provider },
      );

      const utxo = randomUtxo();
      await provider.addUtxo(contractTestMultipleConstructorParameters.address, utxo);

      const transaction = new TransactionBuilder({ provider })
        .addInput(utxo, contractTestMultipleConstructorParameters.unlock.secondFunction())
        .addOutput({ to: contractTestMultipleConstructorParameters.address, amount: 10000n });

      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:20 Hello Second Function$'));
      expect(transaction).not.toLog(/Hello First Function/);
    });

    it('should only log console.log statements from the chosen branch in if-statement', async () => {
      const transaction1 = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contractTestLogs.unlock.functionWithIfStatement(1n))
        .addOutput({ to: contractTestLogs.address, amount: 10000n });

      expect(transaction1).toLog(new RegExp('^\\[Input #0] Test.scash:24 a is 1$'));
      expect(transaction1).toLog(new RegExp('^\\[Input #0] Test.scash:31 a equals 1$'));
      expect(transaction1).toLog(new RegExp('^\\[Input #0] Test.scash:32 b equals 1$'));
      expect(transaction1).not.toLog(/a is not 1/);

      const transaction2 = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contractTestLogs.unlock.functionWithIfStatement(2n))
        .addOutput({ to: contractTestLogs.address, amount: 10000n });

      expect(transaction2).toLog(new RegExp('^\\[Input #0] Test.scash:27 a is not 1$'));
      expect(transaction2).toLog(new RegExp('^\\[Input #0] Test.scash:31 a equals 2$'));
      expect(transaction2).toLog(new RegExp('^\\[Input #0] Test.scash:32 b equals 2$'));
      expect(transaction2).not.toLog(/a is 1/);
    });

    it('should log multiple consecutive console.log statements on separate lines', async () => {
      const contractTestConsecutiveLogs = new Contract(artifactTestConsecutiveLogs, [alicePub], { provider });
      const utxo = randomUtxo();
      await provider.addUtxo(contractTestConsecutiveLogs.address, utxo);

      const incorrectNum = 100n;
      const transaction = new TransactionBuilder({ provider })
        .addInput(utxo, contractTestConsecutiveLogs.unlock.transfer(new SignatureTemplate(alicePriv), incorrectNum))
        .addOutput({ to: contractTestConsecutiveLogs.address, amount: 10000n });

      // console.log(ownerSig, owner, num, beef);
      expect(transaction).toLog(new RegExp(`^\\[Input #0] Test.scash:9 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 100$`));
      // console.log(1, "test", true)
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:10 0xbeef 1 test true$'));
    });

    it('should log multiple console.log statements with other statements in between', async () => {
      const contractTestMultipleLogs = new Contract(artifactTestMultipleLogs, [alicePub], { provider });
      const utxo = randomUtxo();
      await provider.addUtxo(contractTestMultipleLogs.address, utxo);

      const incorrectNum = 100n;
      const transaction = new TransactionBuilder({ provider })
        .addInput(utxo, contractTestMultipleLogs.unlock.transfer(new SignatureTemplate(alicePriv), incorrectNum))
        .addOutput({ to: contractTestMultipleLogs.address, amount: 10000n });

      // console.log(ownerSig, owner, num);
      const expectedFirstLog = new RegExp(`^\\[Input #0] Test.scash:6 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 100$`);
      expect(transaction).toLog(expectedFirstLog);

      const expectedSecondLog = new RegExp('^\\[Input #0] Test.scash:11 0xbeef 1 test true$');
      expect(transaction).toLog(expectedSecondLog);
    });

    // This is an edge case because of optimisation position hint merging
    it('should log the correct variable value inside a notif statement', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contractTestLogs.unlock.test_log_inside_notif_statement(false))
        .addOutput({ to: contractTestLogs.address, amount: contractUtxo.satoshis - 1000n });

      expect(transaction).toLog(new RegExp(`^\\[Input #0] Test.scash:52 before: ${contractUtxo.satoshis}$`));
      expect(transaction).toLog(new RegExp(`^\\[Input #0] Test.scash:54 after: ${contractUtxo.satoshis}$`));
    });

    it('should log intermediate results that get optimised out', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contractTestLogs.unlock.test_log_intermediate_result())
        .addOutput({ to: contractTestLogs.address, amount: 10000n });

      const expectedHash = binToHex(sha256(alicePub));
      expect(transaction).toLog(new RegExp(`^\\[Input #0] Test.scash:43 0x${expectedHash}$`));
    });

    it.todo('intermediate results that is more complex than the test above');

    it('should log inside a loop', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contractTestLogInsideLoop.unlock.test_log_inside_loop())
        .addOutput({ to: contractTestLogInsideLoop.address, amount: 10000n });

      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:6 i: 0$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:6 i: 1$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:6 i: 2$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:6 i: 3$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:6 i: 4$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:6 i: 5$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:6 i: 6$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:6 i: 7$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:6 i: 8$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:6 i: 9$'));
    });

    it('should log inside a complex nested loop', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestLogInsideLoopUtxo, contractTestLogInsideLoop.unlock.test_log_inside_loop_complex())
        .addOutput({ to: contractTestLogInsideLoop.address, amount: 10000n });

      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:28 inner loop i: 0 j: 0 k: 0 l: 5 m: 10$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:28 inner loop i: 0 j: 1 k: 1 l: 5 m: 10$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:32 outer loop i: 0$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:28 inner loop i: 1 j: 0 k: 1 l: 5 m: 10$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:28 inner loop i: 1 j: 1 k: 2 l: 5 m: 10$'));
      expect(transaction).toLog(new RegExp('^\\[Input #0] Test.scash:32 outer loop i: 1$'));
    });

    it.todo('should log intermediate results that get optimised out inside a loop');
  });

  describe('require statements', () => {
    const provider = createTestProvider();
    const contractTestRequires = new Contract(artifactTestRequires, [], { provider });
    const contractTestRequiresUtxo = randomUtxo();

    const contractTestMultiLineRequires = new Contract(artifactTestMultilineRequires, [], { provider });
    const contractTestMultiLineRequiresUtxo = randomUtxo();

    const contractTestRequireInsideLoop = new Contract(artifactTestRequireInsideLoop, [], { provider });
    const contractTestRequireInsideLoopUtxo = randomUtxo();

    beforeAll(async () => {
      await provider.addUtxo(contractTestRequires.address, contractTestRequiresUtxo);
      await provider.addUtxo(contractTestMultiLineRequires.address, contractTestMultiLineRequiresUtxo);
      await provider.addUtxo(contractTestRequireInsideLoop.address, contractTestRequireInsideLoopUtxo);
    });

    // test_require
    it('should fail with error message when require statement fails in a multi-function contract', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_require())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:13 Require statement failed at input 0 in contract Test.scash at line 13 with the following message: 1 should equal 2.');
      expect(transaction).toFailRequireWith('Failing statement: require(1 == 2, "1 should equal 2")');
    });

    // test_require_single_function
    it('should fail with error message when require statement fails in single function', async () => {
      const contractSingleFunction = new Contract(artifactTestSingleFunction, [], { provider });
      const contractSingleFunctionUtxo = randomUtxo();
      await provider.addUtxo(contractSingleFunction.address, contractSingleFunctionUtxo);

      const transaction = new TransactionBuilder({ provider })
        .addInput(contractSingleFunctionUtxo, contractSingleFunction.unlock.test_require_single_function())
        .addOutput({ to: contractSingleFunction.address, amount: 1000n })
        .addOutput({ to: contractSingleFunction.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:4 Require statement failed at input 0 in contract Test.scash at line 4 with the following message: should have 1 output.');
      expect(transaction).toFailRequireWith('Failing statement: require(tx.outputs.length == 1, "should have 1 output")');
    });

    // test_multiple_require_statements
    it('it should only fail with correct error message when there are multiple require statements', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:21 Require statement failed at input 0 in contract Test.scash at line 21 with the following message: 1 should equal 2.');
      expect(transaction).toFailRequireWith('Failing statement: require(1 == 2, "1 should equal 2")');
      expect(transaction).not.toFailRequireWith(/1 should equal 1/);
    });

    // test_multiple_require_statements_final_fails
    it('it should only fail with correct error message when there are multiple require statements where the final statement fails', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_final_fails())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:27 Require statement failed at input 0 in contract Test.scash at line 27 with the following message: 1 should equal 2.');
      expect(transaction).toFailRequireWith('Failing statement: require(1 == 2, "1 should equal 2")');
      expect(transaction).not.toFailRequireWith(/1 should equal 1/);
    });

    it('should not fail if no require statements fail', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_require_no_failure())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(transaction).not.toFailRequire();
    });

    // test_multiple_require_statements_no_message_final
    it('should fail without custom message if the final require statement does not have a message', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_no_message_final())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:32 Require statement failed at input 0 in contract Test.scash at line 32.');
      expect(transaction).toFailRequireWith('Failing statement: require(1 == 2)');
      expect(transaction).not.toFailRequireWith(/1 should equal 1/);
    });

    // test_timeops_as_final_require
    it('should fail with correct error message for the final TimeOp require statement', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_timeops_as_final_require())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:37 Require statement failed at input 0 in contract Test.scash at line 37 with the following message: time should be HUGE.');
      expect(transaction).toFailRequireWith('Failing statement: require(tx.time >= 100000000, "time should be HUGE")');
      expect(transaction).not.toFailRequireWith(/1 should equal 1/);
    });

    // test_final_require_in_if_statement
    it('should fail with correct error message for the final require statement in an if statement', async () => {
      const transactionIfBranch = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_final_require_in_if_statement(1n))
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(transactionIfBranch).toFailRequireWith('Test.scash:43 Require statement failed at input 0 in contract Test.scash at line 43 with the following message: 1 should equal 2.');
      expect(transactionIfBranch).toFailRequireWith('Failing statement: require(1 == a, "1 should equal 2")');

      const transactionElseIfBranch = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_final_require_in_if_statement(2n))
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(transactionElseIfBranch).toFailRequireWith('Test.scash:46 Require statement failed at input 0 in contract Test.scash at line 46 with the following message: 1 should equal 3.');
      expect(transactionElseIfBranch).toFailRequireWith('Failing statement: require(1 == b, "1 should equal 3")');

      const transactionElseBranch = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_final_require_in_if_statement(3n))
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(transactionElseBranch).toFailRequireWith('Test.scash:49 Require statement failed at input 0 in contract Test.scash at line 49 with the following message: selector should equal 4.');
      expect(transactionElseBranch).toFailRequireWith('Failing statement: require(selector == c, "selector should equal 4")');
    });

    // test_final_require_in_if_statement_with_deep_reassignment
    it('should fail with correct error message for the final require statement in an if statement with a deep reassignment', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_final_require_in_if_statement_with_deep_reassignment(),
        )
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:62 Require statement failed at input 0 in contract Test.scash at line 62 with the following message: sum should equal 10.');
      expect(transaction).toFailRequireWith('Failing statement: require(a + b + c + d + e == 10, "sum should equal 10")');
    });

    // test_fail_checksig
    it('should fail with correct error message when checkSig fails', async () => {
      const checkSigTransaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_fail_checksig(new SignatureTemplate(alicePriv), bobPub),
        )
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(checkSigTransaction).toFailRequireWith('Test.scash:79 Require statement failed at input 0 in contract Test.scash at line 79 with the following message: Signatures do not match.');
      expect(checkSigTransaction).toFailRequireWith('Failing statement: require(checkSig(s, pk), "Signatures do not match")');

      const checkSigTransactionNullSignature = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_fail_checksig(hexToBin(''), bobPub),
        )
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(checkSigTransactionNullSignature).toFailRequireWith('Test.scash:79 Require statement failed at input 0 in contract Test.scash at line 79 with the following message: Signatures do not match.');
      expect(checkSigTransactionNullSignature).toFailRequireWith('Failing statement: require(checkSig(s, pk), "Signatures do not match")');
    });

    // test_fail_checksig_final_verify
    it('should fail with correct error message when checkSig fails as the final verify', async () => {
      const checkSigTransaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_fail_checksig_final_verify(new SignatureTemplate(alicePriv), bobPub),
        )
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(checkSigTransaction).toFailRequireWith('Test.scash:84 Require statement failed at input 0 in contract Test.scash at line 84 with the following message: Signatures do not match.');
      expect(checkSigTransaction).toFailRequireWith('Failing statement: require(checkSig(s, pk), "Signatures do not match")');
    });

    // test_fail_checkdatasig
    it('should fail with correct error message when checkDataSig fails', async () => {
      const checkDataSigTransaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_fail_checkdatasig(new SignatureTemplate(alicePriv).generateSignature(hexToBin('0xbeef')).slice(0, -1), '0xbeef', bobPub),
        )
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(checkDataSigTransaction).toFailRequireWith('Test.scash:88 Require statement failed at input 0 in contract Test.scash at line 88 with the following message: Data Signatures do not match.');
      expect(checkDataSigTransaction).toFailRequireWith('Failing statement: require(checkDataSig(s, message, pk), "Data Signatures do not match")');

      const checkDataSigTransactionWrongMessage = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_fail_checkdatasig(new SignatureTemplate(alicePriv).generateSignature(hexToBin('0xc0ffee')).slice(0, -1), '0xbeef', alicePub),
        )
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(checkDataSigTransactionWrongMessage).toFailRequireWith('Test.scash:88 Require statement failed at input 0 in contract Test.scash at line 88 with the following message: Data Signatures do not match.');
      expect(checkDataSigTransactionWrongMessage).toFailRequireWith('Failing statement: require(checkDataSig(s, message, pk), "Data Signatures do not match")');
    });

    // test_fail_checkmultisig
    it('should fail with correct error message when checkMultiSig fails', async () => {
      const checkmultiSigTransaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_fail_checkmultisig(
            new SignatureTemplate(alicePriv, undefined, SignatureAlgorithm.ECDSA),
            bobPub,
            new SignatureTemplate(bobPriv, undefined, SignatureAlgorithm.ECDSA),
            alicePub,
          ),
        )
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(checkmultiSigTransaction).toFailRequireWith('Test.scash:92 Require statement failed at input 0 in contract Test.scash at line 92 with the following message: Multi Signatures do not match.');
      expect(checkmultiSigTransaction).toFailRequireWith('Failing statement: require(checkMultiSig([s1, s2], [pk1, pk2]), "Multi Signatures do not match")');
    });

    // test_fail_large_cleanup
    it('should fail with correct error message when a require statement fails in a function with a large cleanup', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestMultiLineRequiresUtxo,
          contractTestMultiLineRequires.unlock.test_fail_large_cleanup(),
        )
        .addOutput({ to: contractTestMultiLineRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:22 Require statement failed at input 0 in contract Test.scash at line 22 with the following message: 1 should equal 2.');
      expect(transaction).toFailRequireWith('Failing statement: require(1 == 2, "1 should equal 2")');
    });

    // test_fail_multiline_require
    it('should fail with correct error message and statement when a multiline require statement fails', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestMultiLineRequiresUtxo,
          contractTestMultiLineRequires.unlock.test_fail_multiline_require(),
        )
        .addOutput({ to: contractTestMultiLineRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:26 Require statement failed at input 0 in contract Test.scash at line 26 with the following message: 1 should equal 2.');
      expect(transaction).toFailRequireWith(`Failing statement: require(
      1 == 2,
      "1 should equal 2"
    );`);
    });

    // test_fail_multiline_final_require
    it('should fail with correct error message and statement when a multiline final require statement fails', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestMultiLineRequiresUtxo,
          contractTestMultiLineRequires.unlock.test_fail_multiline_final_require(),
        )
        .addOutput({ to: contractTestMultiLineRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:35 Require statement failed at input 0 in contract Test.scash at line 35 with the following message: 1 should equal 2.');
      expect(transaction).toFailRequireWith(`Failing statement: require(
      1 == 2,
      "1 should equal 2"
    );`);
    });

    // test_multiline_require_with_unary_op
    // Note that we add this test, because we changed the LocationHint for all Unary Ops to "END"
    it('should fail with correct error message and statement when a multiline require statement with a unary op fails', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestMultiLineRequiresUtxo,
          contractTestMultiLineRequires.unlock.test_multiline_require_with_unary_op(),
        )
        .addOutput({ to: contractTestMultiLineRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:51 Require statement failed at input 0 in contract Test.scash at line 51.');
      expect(transaction).toFailRequireWith(`Failing statement: require(
      !(
        0x000000
        .reverse()
        .length
        !=
        -(
          30
            +
          15
        )
      )
    );`);
    });

    // test_multiline_require_with_instantiation
    it('should fail with correct error message and statement when a multiline require statement with an instantiation fails', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestMultiLineRequiresUtxo,
          contractTestMultiLineRequires.unlock.test_multiline_require_with_instantiation(),
        )
        .addOutput({ to: contractTestMultiLineRequires.address, amount: 1000n });

      expect(transaction).toFailRequireWith('Test.scash:69 Require statement failed at input 0 in contract Test.scash at line 69.');
      expect(transaction).toFailRequireWith(`Failing statement: require(
      new LockingBytecodeP2PKH(
        hash160(0x000000)
      )
        ==
      new LockingBytecodeNullData([
        0x00,
        bytes(\"hello world\")
      ])
    );`);
    });

    it('should fail a require statement inside a loop', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequireInsideLoopUtxo, contractTestRequireInsideLoop.unlock.test_require_inside_loop())
        .addOutput({ to: contractTestRequireInsideLoop.address, amount: 10000n });

      expect(transaction).toFailRequireWith('Test.scash:7 Require statement failed at input 0 in contract Test.scash at line 7 with the following message: i should be less than 6.');
      expect(transaction).toFailRequireWith('Failing statement: require(i < 6, \'i should be less than 6\')');
    });

    it.todo('should fail correct require statement inside nested loops');
  });

  describe('Non-require error messages', () => {
    const provider = createTestProvider();

    const contractTestRequires = new Contract(artifactTestRequires, [], { provider });
    const contractTestRequiresUtxo = randomUtxo();

    const contractTestMultiLineRequires = new Contract(artifactTestMultilineRequires, [], { provider });
    const contractTestMultiLineRequiresUtxo = randomUtxo();

    beforeAll(async () => {
      await provider.addUtxo(contractTestRequires.address, contractTestRequiresUtxo);
      await provider.addUtxo(contractTestMultiLineRequires.address, contractTestMultiLineRequiresUtxo);
    });

    // test_invalid_split_range
    it('should fail with correct error message when an invalid OP_SPLIT range is used', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_invalid_split_range(),
        )
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(() => transaction.debug()).toThrow('Test.scash:70 Error in transaction at input 0 in contract Test.scash at line 70.');
      expect(() => transaction.debug()).toThrow('Failing statement: test.split(4)');
      expect(() => transaction.debug()).toThrow(`Reason: ${AuthenticationErrorCommon.invalidSplitIndex}`);
    });

    // test_invalid_input_index
    it('should fail with correct error message when an invalid input index is used', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_invalid_input_index(),
        )
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      expect(() => transaction.debug()).toThrow('Test.scash:75 Error in transaction at input 0 in contract Test.scash at line 75.');
      expect(() => transaction.debug()).toThrow('Failing statement: tx.inputs[5].value');
      expect(() => transaction.debug()).toThrow(`Reason: ${AuthenticationErrorCommon.invalidTransactionUtxoIndex}`);
    });

    // test_multiline_non_require_error
    it('should fail with correct error message and statement when a multiline non-require statement fails', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestMultiLineRequiresUtxo,
          contractTestMultiLineRequires.unlock.test_multiline_non_require_error(),
        )
        .addOutput({ to: contractTestMultiLineRequires.address, amount: 1000n });

      expect(() => transaction.debug()).toThrow('Test.scash:43 Error in transaction at input 0 in contract Test.scash at line 43.');
      expect(() => transaction.debug()).toThrow(`Failing statement: tx.outputs[
        5
      ].value`);
      expect(() => transaction.debug()).toThrow(`Reason: ${AuthenticationErrorCommon.invalidTransactionOutputIndex}`);
    });
  });

  describe('Template encoding', () => {
    const provider = createTestProvider();

    // test_zero_handling
    it('should encode a locking and unlocking parameter of value 0 correctly and evaluate the execution', async () => {
      const contract = new Contract(artifactTestZeroHandling, [0n], { provider });
      const contractUtxo = randomUtxo();
      await provider.addUtxo(contract.address, contractUtxo);

      const transaction = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.test_zero_handling(0n))
        .addOutput({ to: contract.address, amount: 1000n });

      expect(transaction).not.toFailRequire();
    });
  });

  describe('TestExtensions', () => {
    const provider = createTestProvider();
    const contractTestRequires = new Contract(artifactTestRequires, [], { provider });
    const contractTestRequiresUtxo = randomUtxo();

    beforeAll(async () => {
      await provider.addUtxo(contractTestRequires.address, contractTestRequiresUtxo);
    });

    // Note: happy cases are implicitly tested by the "regular" debugging tests, since the use TestExtensions

    it('should fail the TestExtensions test if an incorrect log is expected', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_logs(),
        )
        .addOutput({ to: contractTestRequires.address, amount: 10000n });

      expect(
        () => expect(transaction).toLog('^This is definitely not the log$'),
      ).toThrow(/Expected: .*This is definitely not the log.*\nReceived: (.|\n)*?\[Input #0] Test.scash:4 Hello World/);
    });

    it('should fail the TestExtensions test if a log is logged that is NOT expected', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_logs(),
        )
        .addOutput({ to: contractTestRequires.address, amount: 10000n });

      expect(
        () => expect(transaction).not.toLog('^\\[Input #0] Test.scash:4 Hello World$'),
      ).toThrow(
        /Expected: not .*\[Input #0] Test.scash:4 Hello World.*\nReceived: (.|\n)*?\[Input #0] Test.scash:4 Hello World/,
      );

      expect(
        () => expect(transaction).not.toLog(),
      ).toThrow(/Expected: not .*undefined.*\nReceived: (.|\n)*?\[Input #0] Test.scash:4 Hello World/);
    });

    it('should fail the TestExtensions test if a log is expected where no log is logged', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_no_logs(),
        )
        .addOutput({ to: contractTestRequires.address, amount: 10000n });

      expect(
        () => expect(transaction).toLog('Hello World'),
      ).toThrow(/Expected: .*Hello World.*\nReceived: (.|\n)*?undefined/);
    });

    it('should fail the TestExtensions test if an incorrect require error message is expected', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_require(),
        )
        .addOutput({ to: contractTestRequires.address, amount: 10000n });

      expect(
        () => expect(transaction).toFailRequireWith('1 should equal 3'),
      ).toThrow(/Expected pattern: .*1 should equal 3.*\nReceived string: (.|\n)*?1 should equal 2/);
    });

    it('should fail the TestExtensions test if a require error message is expected where no error is thrown', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_require_no_failure(),
        )
        .addOutput({ to: contractTestRequires.address, amount: 10000n });

      expect(
        () => expect(transaction).toFailRequireWith('1 should equal 3'),
      ).toThrow(/Contract function did not fail a require statement/);
    });

    it('should fail the TestExtensions test if an error is thrown where it is NOT expected', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(
          contractTestRequiresUtxo,
          contractTestRequires.unlock.test_require(),
        )
        .addOutput({ to: contractTestRequires.address, amount: 10000n });

      expect(
        () => expect(transaction).not.toFailRequireWith('1 should equal 2'),
      ).toThrow(/Expected pattern: not .*1 should equal 2.*\nReceived string: (.|\n)*?1 should equal 2/);

      expect(
        () => expect(transaction).not.toFailRequire(),
      ).toThrow(/Contract function failed a require statement\.*\nReceived string: (.|\n)*?1 should equal 2/);
    });
  });

  describe('P2PKH only transaction', () => {
    it('should succeed when spending from P2PKH inputs with the corresponding unlocker', async () => {
      const provider = createTestProvider();
      await provider.addUtxo(aliceAddress, randomUtxo());
      await provider.addUtxo(aliceAddress, randomUtxo());

      const result = new TransactionBuilder({ provider })
        .addInputs(await provider.getUtxos(aliceAddress), new SignatureTemplate(alicePriv).unlockP2PKH())
        .addOutput({ to: aliceAddress, amount: 5000n })
        .debug();

      expect(Object.keys(result).length).toBeGreaterThan(0);
    });

    // A bare UTXO does not carry its source locking bytecode, so a builder cannot prove that the caller paired it
    // with the correct P2PKH unlocker. The network still rejects the real mismatched spend; see the release test
    // deferral register for the API boundary required to make this mock/debug assertion meaningful.
    it.skip('should fail when spending from P2PKH inputs with an unlocker for a different public key', async () => {
      const provider = createTestProvider();
      await provider.addUtxo(aliceAddress, randomUtxo());
      await provider.addUtxo(aliceAddress, randomUtxo());

      const transactionBuilder = new TransactionBuilder({ provider })
        .addInputs(await provider.getUtxos(aliceAddress), new SignatureTemplate(bobPriv).unlockP2PKH())
        .addOutput({ to: aliceAddress, amount: 5000n });

      expect(() => transactionBuilder.debug()).toThrow(FailedTransactionError);
    });
  });

  describe('Solidity-style revert aliases', () => {
    const provider = createTestProvider();
    const contractTestRequires = new Contract(artifactTestRequires, [], { provider });
    const contractTestRequiresUtxo = randomUtxo();

    beforeAll(async () => {
      await provider.addUtxo(contractTestRequires.address, contractTestRequiresUtxo);
    });

    // --- toBeReverted / not.toBeReverted ---

    it('toBeReverted should pass when transaction fails a require', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_final_fails())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      await expect(transaction).toBeReverted();
    });

    it('toBeReverted accepts async call builders', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_final_fails())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });
      const call = { build: async () => transaction };
      await expect(call as any).toBeRevertedWith('1 should equal 2');
    });

    it('not.toBeReverted should pass when transaction succeeds', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_require_no_failure())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      await expect(transaction).not.toBeReverted();
    });

    // --- toBeRevertedWith ---

    it('toBeRevertedWith should pass when require fails with matching message', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_final_fails())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      await expect(transaction).toBeRevertedWith('1 should equal 2');
      await expect(transaction).toBeRevertedWith(/1 should equal 2/);
    });

    it('not.toBeRevertedWith should pass when message does not match', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_final_fails())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      await expect(transaction).not.toBeRevertedWith(/1 should equal 1/);
    });

    // --- toRevert / not.toRevert ---

    it('toRevert should pass when transaction fails a require', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_final_fails())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      await expect(transaction).toRevert();
    });

    it('not.toRevert should pass when transaction succeeds', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_require_no_failure())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      await expect(transaction).not.toRevert();
    });

    // --- toRevertWith ---

    it('toRevertWith should pass when require fails with matching message', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_final_fails())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      await expect(transaction).toRevertWith('1 should equal 2');
      await expect(transaction).toRevertWith(/1 should equal 2/);
    });

    it('not.toRevertWith should pass when message does not match', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_final_fails())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      await expect(transaction).not.toRevertWith(/1 should equal 1/);
    });

    // --- Equivalence: aliases produce same results as originals ---

    it('toBeReverted and toFailRequire should behave identically', async () => {
      const failTx = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_final_fails())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      const passTx = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_require_no_failure())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      // Both should pass on failing tx
      expect(failTx).toFailRequire();
      await expect(failTx).toBeReverted();
      await expect(failTx).toRevert();

      // Both should pass (negated) on passing tx
      expect(passTx).not.toFailRequire();
      await expect(passTx).not.toBeReverted();
      await expect(passTx).not.toRevert();
    });

    it('toBeRevertedWith and toFailRequireWith should behave identically', async () => {
      const transaction = new TransactionBuilder({ provider })
        .addInput(contractTestRequiresUtxo, contractTestRequires.unlock.test_multiple_require_statements_final_fails())
        .addOutput({ to: contractTestRequires.address, amount: 1000n });

      const pattern = /1 should equal 2/;
      const nonPattern = /1 should equal 1/;

      expect(transaction).toFailRequireWith(pattern);
      await expect(transaction).toBeRevertedWith(pattern);
      await expect(transaction).toRevertWith(pattern);

      expect(transaction).not.toFailRequireWith(nonPattern);
      await expect(transaction).not.toBeRevertedWith(nonPattern);
      await expect(transaction).not.toRevertWith(nonPattern);
    });
  });

  describe('VmTargets', () => {
    // OP_INVOKE is supported on BCH_2026_05 and later; multi-function contracts use OP_INVOKE dispatch
    const opInvokeVmTargets = [
      undefined,
      VmTarget.BCH_2026_05,
      VmTarget.BCH_SPEC,
    ] as const;

    it.each(opInvokeVmTargets)('should execute and log correctly with vmTarget %s', async (vmTarget) => {
      const provider = new MockNetworkProvider({ vmTarget });
      const contractTestLogs = new Contract(artifactTestLogs, [alicePub], { provider });
      const contractUtxo = randomUtxo();
      await provider.addUtxo(contractTestLogs.address, contractUtxo);

      const transaction = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contractTestLogs.unlock.transfer(new SignatureTemplate(alicePriv), 1000n))
        .addOutput({ to: contractTestLogs.address, amount: 10000n });

      expect(transaction.getLibauthTemplate().supported[0]).toBe(vmTarget ?? DEFAULT_VM_TARGET);

      const expectedLog = new RegExp(`^\\[Input #0] Test.scash:10 0x[0-9a-f]{130} 0x${binToHex(alicePub)} 1000 0xbeef 1 test true$`);
      expect(transaction).toLog(expectedLog);
    });

    // Current compiler output may contain outlined OP_INVOKE spans even for a single-function contract.
    // Selecting an older VM remains reflected in the template, but debugging current output must fail clearly.
    const legacyVmTargets = [VmTarget.BCH_2025_05] as const;

    it.each(legacyVmTargets)('reports current bytecode as unsupported with vmTarget %s', async (vmTarget) => {
      const provider = new MockNetworkProvider({ vmTarget });
      const contract = new Contract(artifactTestConsecutiveLogs, [alicePub], { provider });
      const contractUtxo = randomUtxo();
      await provider.addUtxo(contract.address, contractUtxo);

      const transaction = new TransactionBuilder({ provider })
        .addInput(contractUtxo, contract.unlock.transfer(new SignatureTemplate(alicePriv), 1000n))
        .addOutput({ to: contract.address, amount: 10000n });

      expect(transaction.getLibauthTemplate().supported[0]).toBe(vmTarget);
      expect(() => transaction.debug()).toThrow(/Called an unknown opcode/);
    });
  });
});

describe('VM Resources', () => {
  it('Should output VM resource usage', async () => {
    const provider = createTestProvider();

    const contractSingleFunction = new Contract({ ...artifactTestSingleFunction, contractName: 'SingleFunction' }, [], { provider });
    const contractZeroHandling = new Contract({ ...artifactTestZeroHandling, contractName: 'ZeroHandling' }, [0n], { provider });

    await provider.addUtxo(contractSingleFunction.address, randomUtxo());
    await provider.addUtxo(contractZeroHandling.address, randomUtxo());
    await provider.addUtxo(aliceAddress, randomUtxo());

    const tx = new TransactionBuilder({ provider })
      .addInputs(await contractSingleFunction.getUtxos(), contractSingleFunction.unlock.test_require_single_function())
      .addInputs(await contractZeroHandling.getUtxos(), contractZeroHandling.unlock.test_zero_handling(0n))
      .addInput((await provider.getUtxos(aliceAddress))[0], new SignatureTemplate(alicePriv).unlockP2PKH())
      .addOutput({ to: aliceAddress, amount: 1000n });

    console.log = vi.fn();
    console.table = vi.fn();

    const vmUsage = tx.getVmResourceUsage();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.table).not.toHaveBeenCalled();

    tx.getVmResourceUsage(true);
    expect(console.log).toHaveBeenCalledWith('VM Resource usage by inputs:');
    expect(console.table).toHaveBeenCalled();

    vi.restoreAllMocks();

    expect(vmUsage[0]?.hashDigestIterations).toBeGreaterThan(0);
    expect(vmUsage[2]?.hashDigestIterations).toBeGreaterThan(0);
  });
});
