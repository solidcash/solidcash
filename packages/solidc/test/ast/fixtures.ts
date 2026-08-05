import { hexToBin } from '@bitauth/libauth';
import { BytesType, IntType, PrimitiveType } from '@solidcash/utils';
import {
  SourceFileNode,
  ContractNode,
  Ast,
  ParameterNode,
  FunctionDefinitionNode,
  BlockNode,
  RequireNode,
  BinaryOpNode,
  FunctionCallNode,
  IdentifierNode,
  VariableDefinitionNode,
  IntLiteralNode,
  StringLiteralNode,
  AssignNode,
  BranchNode,
  ArrayNode,
  CastNode,
  TimeOpNode,
  TupleAssignmentNode,
  NullaryOpNode,
  HexLiteralNode,
  UnaryOpNode,
  InstantiationNode,
  ConsoleStatementNode,
  DoWhileNode,
} from '../../src/ast/AST.js';
import { BinaryOperator, NullaryOperator, UnaryOperator } from '../../src/ast/Operator.js';
import { Class, TimeOp } from '../../src/ast/Globals.js';

interface Fixture {
  fn: string,
  ast: Ast,
}

export const fixtures: Fixture[] = [
  {
    fn: 'p2pkh.scash',
    ast: new SourceFileNode(
      new ContractNode(
        'P2PKH',
        [new ParameterNode(new BytesType(20), 'pkh')],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [new FunctionDefinitionNode(
          'spend',
          [
            new ParameterNode(PrimitiveType.PUBKEY, 'pk'),
            new ParameterNode(PrimitiveType.SIG, 's'),
          ],
          new BlockNode([
            new RequireNode(
              new BinaryOpNode(
                new FunctionCallNode(new IdentifierNode('hash160'), [new IdentifierNode('pk')]),
                BinaryOperator.EQ,
                new IdentifierNode('pkh'),
              ),
            ),
            new RequireNode(
              new FunctionCallNode(
                new IdentifierNode('checkSig'),
                [new IdentifierNode('s'), new IdentifierNode('pk')],
              ),
            ),
          ]),
        )],
      ),
    ),
  },
  {
    fn: 'reassignment.scash',
    ast: new SourceFileNode(
      new ContractNode(
        'Reassignment',
        [new ParameterNode(new IntType(true, 256), 'x'), new ParameterNode(PrimitiveType.STRING, 'y')],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [new FunctionDefinitionNode(
          'hello',
          [new ParameterNode(PrimitiveType.PUBKEY, 'pk'), new ParameterNode(PrimitiveType.SIG, 's')],
          new BlockNode([
            new VariableDefinitionNode(
              new IntType(true, 256),
              [],
              'myVariable',
              new BinaryOpNode(
                new IntLiteralNode(10n),
                BinaryOperator.MINUS,
                new IntLiteralNode(4n),
              ),
            ),
            new VariableDefinitionNode(
              new IntType(true, 256),
              [],
              'myOtherVariable',
              new BinaryOpNode(
                new IntLiteralNode(20n),
                BinaryOperator.PLUS,
                new BinaryOpNode(
                  new IdentifierNode('myVariable'),
                  BinaryOperator.MOD,
                  new IntLiteralNode(2n),
                ),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new IdentifierNode('myOtherVariable'),
                BinaryOperator.GT,
                new IdentifierNode('x'),
              ),
            ),
            new VariableDefinitionNode(
              PrimitiveType.STRING,
              [],
              'hw',
              new StringLiteralNode('Hello World', '"'),
            ),
            new AssignNode(
              new IdentifierNode('hw'),
              new BinaryOpNode(
                new IdentifierNode('hw'),
                BinaryOperator.PLUS,
                new IdentifierNode('y'),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new FunctionCallNode(new IdentifierNode('ripemd160'), [new IdentifierNode('pk')]),
                BinaryOperator.EQ,
                new FunctionCallNode(new IdentifierNode('ripemd160'), [new IdentifierNode('hw')]),
              ),
            ),
            new RequireNode(
              new FunctionCallNode(
                new IdentifierNode('checkSig'),
                [new IdentifierNode('s'), new IdentifierNode('pk')],
              ),
            ),
          ]),
        )],
      ),
    ),
  },
  {
    fn: 'multifunction_if_statements.scash',
    ast: new SourceFileNode(
      new ContractNode(
        'MultiFunctionIfStatements',
        [new ParameterNode(new IntType(true, 256), 'x'), new ParameterNode(new IntType(true, 256), 'y')],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [
          new FunctionDefinitionNode(
            'transfer',
            [new ParameterNode(new IntType(true, 256), 'a'), new ParameterNode(new IntType(true, 256), 'b')],
            new BlockNode([
              new VariableDefinitionNode(
                new IntType(true, 256),
                [],
                'd',
                new BinaryOpNode(
                  new IdentifierNode('a'),
                  BinaryOperator.PLUS,
                  new IdentifierNode('b'),
                ),
              ),
              new AssignNode(
                new IdentifierNode('d'),
                new BinaryOpNode(
                  new IdentifierNode('d'),
                  BinaryOperator.MINUS,
                  new IdentifierNode('a'),
                ),
              ),
              new BranchNode(
                new BinaryOpNode(
                  new BinaryOpNode(
                    new IdentifierNode('d'),
                    BinaryOperator.EQ,
                    new IdentifierNode('x'),
                  ),
                  BinaryOperator.AND,
                  Object.assign(new CastNode(PrimitiveType.BOOL, new IdentifierNode('x'), false), {
                    sourceCast: true,
                  }),
                ),
                new BlockNode([
                  new VariableDefinitionNode(
                    new IntType(true, 256),
                    [],
                    'c',
                    new BinaryOpNode(
                      new IdentifierNode('d'),
                      BinaryOperator.PLUS,
                      new IdentifierNode('b'),
                    ),
                  ),
                  new AssignNode(
                    new IdentifierNode('d'),
                    new BinaryOpNode(
                      new IdentifierNode('a'),
                      BinaryOperator.PLUS,
                      new IdentifierNode('c'),
                    ),
                  ),
                  new RequireNode(
                    new BinaryOpNode(
                      new IdentifierNode('c'),
                      BinaryOperator.GT,
                      new IdentifierNode('d'),
                    ),
                  ),
                ]),
                new BlockNode([
                  new AssignNode(
                    new IdentifierNode('d'),
                    new IdentifierNode('a'),
                  ),
                ]),
              ),
              new AssignNode(
                new IdentifierNode('d'),
                new BinaryOpNode(
                  new IdentifierNode('d'),
                  BinaryOperator.PLUS,
                  new IdentifierNode('a'),
                ),
              ),
              new RequireNode(
                new BinaryOpNode(
                  new IdentifierNode('d'),
                  BinaryOperator.EQ,
                  new IdentifierNode('y'),
                ),
              ),
            ]),
          ),
          new FunctionDefinitionNode(
            'timeout',
            [new ParameterNode(new IntType(true, 256), 'b')],
            new BlockNode([
              new VariableDefinitionNode(
                new IntType(true, 256),
                [],
                'd',
                new IdentifierNode('b'),
              ),
              new AssignNode(
                new IdentifierNode('d'),
                new BinaryOpNode(
                  new IdentifierNode('d'),
                  BinaryOperator.PLUS,
                  new IntLiteralNode(2n),
                ),
              ),
              new BranchNode(
                new BinaryOpNode(
                  new IdentifierNode('d'),
                  BinaryOperator.EQ,
                  new IdentifierNode('x'),
                ),
                new BlockNode([
                  new VariableDefinitionNode(
                    new IntType(true, 256),
                    [],
                    'c',
                    new BinaryOpNode(
                      new IdentifierNode('d'),
                      BinaryOperator.PLUS,
                      new IdentifierNode('b'),
                    ),
                  ),
                  new AssignNode(
                    new IdentifierNode('d'),
                    new BinaryOpNode(
                      new IdentifierNode('c'),
                      BinaryOperator.PLUS,
                      new IdentifierNode('d'),
                    ),
                  ),
                  new RequireNode(
                    new BinaryOpNode(
                      new IdentifierNode('c'),
                      BinaryOperator.GT,
                      new IdentifierNode('d'),
                    ),
                  ),
                ]),
              ),
              new AssignNode(
                new IdentifierNode('d'),
                new IdentifierNode('b'),
              ),
              new RequireNode(
                new BinaryOpNode(
                  new IdentifierNode('d'),
                  BinaryOperator.EQ,
                  new IdentifierNode('y'),
                ),
              ),
            ]),
          ),
        ],
      ),
    ),
  },
  {
    fn: '2_of_3_multisig.scash',
    ast: new SourceFileNode(
      new ContractNode(
        'MultiSig',
        [
          new ParameterNode(PrimitiveType.PUBKEY, 'pk1'),
          new ParameterNode(PrimitiveType.PUBKEY, 'pk2'),
          new ParameterNode(PrimitiveType.PUBKEY, 'pk3'),
        ],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [new FunctionDefinitionNode(
          'spend',
          [
            new ParameterNode(PrimitiveType.SIG, 's1'),
            new ParameterNode(PrimitiveType.SIG, 's2'),
          ],
          new BlockNode([
            new RequireNode(
              new FunctionCallNode(
                new IdentifierNode('checkMultiSig'),
                [
                  new ArrayNode([
                    new IdentifierNode('s1'),
                    new IdentifierNode('s2'),
                  ]),
                  new ArrayNode([
                    new IdentifierNode('pk1'),
                    new IdentifierNode('pk2'),
                    new IdentifierNode('pk3'),
                  ]),
                ],
              ),
            ),
          ]),
        )],
      ),
    ),
  },
  {
    fn: 'hodl_vault.scash',
    ast: new SourceFileNode(
      new ContractNode(
        'HodlVault',
        [
          new ParameterNode(PrimitiveType.PUBKEY, 'ownerPk'),
          new ParameterNode(PrimitiveType.PUBKEY, 'oraclePk'),
          new ParameterNode(new IntType(true, 256), 'minBlock'),
          new ParameterNode(new IntType(true, 256), 'priceTarget'),
        ],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [new FunctionDefinitionNode(
          'spend',
          [
            new ParameterNode(PrimitiveType.SIG, 'ownerSig'),
            new ParameterNode(PrimitiveType.DATASIG, 'oracleSig'),
            new ParameterNode(new BytesType(8), 'oracleMessage'),
          ],
          new BlockNode([
            new TupleAssignmentNode(
              [
                { name: 'blockHeightBin', type: new BytesType(4) },
                { name: 'priceBin', type: new BytesType(4) },
              ],
              new BinaryOpNode(
                new IdentifierNode('oracleMessage'),
                BinaryOperator.SPLIT,
                new IntLiteralNode(4n),
              ),
            ),
            new VariableDefinitionNode(
              new IntType(true, 256),
              [],
              'blockHeight',
              Object.assign(new CastNode(
                new IntType(true, 256),
                new IdentifierNode('blockHeightBin'),
                false,
              ), { sourceCast: true }),
            ),
            new VariableDefinitionNode(
              new IntType(true, 256),
              [],
              'price',
              Object.assign(new CastNode(
                new IntType(true, 256),
                new IdentifierNode('priceBin'),
                false,
              ), { sourceCast: true }),
            ),
            new RequireNode(
              new BinaryOpNode(
                new IdentifierNode('blockHeight'),
                BinaryOperator.GE,
                new IdentifierNode('minBlock'),
              ),
            ),
            new TimeOpNode(
              TimeOp.CHECK_LOCKTIME,
              new IdentifierNode('blockHeight'),
            ),
            new RequireNode(
              new BinaryOpNode(
                new IdentifierNode('price'),
                BinaryOperator.GE,
                new IdentifierNode('priceTarget'),
              ),
            ),
            new RequireNode(
              new FunctionCallNode(
                new IdentifierNode('checkDataSig'),
                [
                  new IdentifierNode('oracleSig'),
                  new IdentifierNode('oracleMessage'),
                  new IdentifierNode('oraclePk'),
                ],
              ),
            ),
            new RequireNode(
              new FunctionCallNode(
                new IdentifierNode('checkSig'),
                [
                  new IdentifierNode('ownerSig'),
                  new IdentifierNode('ownerPk'),
                ],
              ),
            ),
          ]),
        )],
      ),
    ),
  },
  {
    fn: 'covenant_all_fields.scash',
    ast: new SourceFileNode(
      new ContractNode(
        'Covenant',
        [],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [new FunctionDefinitionNode(
          'spend',
          [],
          new BlockNode([
            new RequireNode(
              new BinaryOpNode(
                new NullaryOpNode(NullaryOperator.VERSION),
                BinaryOperator.EQ,
                new IntLiteralNode(2n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new NullaryOpNode(NullaryOperator.LOCKTIME),
                BinaryOperator.EQ,
                new IntLiteralNode(0n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new NullaryOpNode(NullaryOperator.INPUT_COUNT),
                BinaryOperator.EQ,
                new IntLiteralNode(1n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new NullaryOpNode(NullaryOperator.OUTPUT_COUNT),
                BinaryOperator.EQ,
                new IntLiteralNode(1n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new NullaryOpNode(NullaryOperator.INPUT_INDEX),
                BinaryOperator.EQ,
                new IntLiteralNode(0n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.SIZE,
                  new NullaryOpNode(NullaryOperator.BYTECODE),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(300n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.INPUT_VALUE,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(10000n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.SIZE,
                  new UnaryOpNode(
                    UnaryOperator.INPUT_LOCKING_BYTECODE,
                    new IntLiteralNode(0n),
                  ),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(10000n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.INPUT_OUTPOINT_HASH,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new HexLiteralNode(hexToBin('000000000000000000000000000000000000000000000000000000000000000')),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.INPUT_OUTPOINT_INDEX,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(0n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.SIZE,
                  new UnaryOpNode(
                    UnaryOperator.INPUT_UNLOCKING_BYTECODE,
                    new IntLiteralNode(0n),
                  ),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(100n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.INPUT_SEQUENCE_NUMBER,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(0n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.OUTPUT_VALUE,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(10000n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.SIZE,
                  new UnaryOpNode(
                    UnaryOperator.OUTPUT_LOCKING_BYTECODE,
                    new IntLiteralNode(0n),
                  ),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(100n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.INPUT_TOKEN_CATEGORY,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new HexLiteralNode(hexToBin('000000000000000000000000000000000000000000000000000000000000000')),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.INPUT_NFT_COMMITMENT,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new HexLiteralNode(hexToBin('00')),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.INPUT_TOKEN_AMOUNT,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(100n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.OUTPUT_TOKEN_CATEGORY,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new HexLiteralNode(hexToBin('000000000000000000000000000000000000000000000000000000000000000')),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.OUTPUT_NFT_COMMITMENT,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new HexLiteralNode(hexToBin('00')),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.OUTPUT_TOKEN_AMOUNT,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(100n),
              ),
            ),
          ]),
        )],
      ),
    ),
  },
  {
    fn: 'mecenas.scash',
    ast: new SourceFileNode(
      new ContractNode(
        'Mecenas',
        [
          new ParameterNode(new BytesType(20), 'recipient'),
          new ParameterNode(new BytesType(20), 'funder'),
          new ParameterNode(new IntType(true, 256), 'pledge'),
          new ParameterNode(new IntType(true, 256), 'period'),
        ],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [
          new FunctionDefinitionNode(
            'recvFunds',
            [],
            new BlockNode([
              new TimeOpNode(
                TimeOp.CHECK_SEQUENCE,
                new IdentifierNode('period'),
              ),
              new RequireNode(
                new BinaryOpNode(
                  new UnaryOpNode(
                    UnaryOperator.OUTPUT_LOCKING_BYTECODE,
                    new IntLiteralNode(0n),
                  ),
                  BinaryOperator.EQ,
                  new InstantiationNode(
                    new IdentifierNode(Class.LOCKING_BYTECODE_P2PKH),
                    [new IdentifierNode('recipient')],
                  ),
                ),
              ),
              new VariableDefinitionNode(
                new IntType(true, 256),
                [],
                'minerFee',
                new IntLiteralNode(1000n),
              ),
              new VariableDefinitionNode(
                new IntType(true, 256),
                [],
                'currentValue',
                new UnaryOpNode(
                  UnaryOperator.INPUT_VALUE,
                  new NullaryOpNode(NullaryOperator.INPUT_INDEX),
                ),
              ),
              new VariableDefinitionNode(
                new IntType(true, 256),
                [],
                'changeValue',
                new BinaryOpNode(
                  new BinaryOpNode(
                    new IdentifierNode('currentValue'),
                    BinaryOperator.MINUS,
                    new IdentifierNode('pledge'),
                  ),
                  BinaryOperator.MINUS,
                  new IdentifierNode('minerFee'),
                ),
              ),
              new BranchNode(
                new BinaryOpNode(
                  new IdentifierNode('changeValue'),
                  BinaryOperator.LE,
                  new BinaryOpNode(
                    new IdentifierNode('pledge'),
                    BinaryOperator.PLUS,
                    new IdentifierNode('minerFee'),
                  ),
                ),
                new BlockNode([
                  new RequireNode(
                    new BinaryOpNode(
                      new UnaryOpNode(
                        UnaryOperator.OUTPUT_VALUE,
                        new IntLiteralNode(0n),
                      ),
                      BinaryOperator.EQ,
                      new BinaryOpNode(
                        new IdentifierNode('currentValue'),
                        BinaryOperator.MINUS,
                        new IdentifierNode('minerFee'),
                      ),
                    ),
                  ),
                ]),
                new BlockNode([
                  new RequireNode(
                    new BinaryOpNode(
                      new UnaryOpNode(
                        UnaryOperator.OUTPUT_VALUE,
                        new IntLiteralNode(0n),
                      ),
                      BinaryOperator.EQ,
                      new IdentifierNode('pledge'),
                    ),
                  ),
                  new RequireNode(
                    new BinaryOpNode(
                      new UnaryOpNode(
                        UnaryOperator.OUTPUT_LOCKING_BYTECODE,
                        new IntLiteralNode(1n),
                      ),
                      BinaryOperator.EQ,
                      new UnaryOpNode(
                        UnaryOperator.INPUT_LOCKING_BYTECODE,
                        new NullaryOpNode(NullaryOperator.INPUT_INDEX),
                      ),
                    ),
                  ),
                  new RequireNode(
                    new BinaryOpNode(
                      new UnaryOpNode(
                        UnaryOperator.OUTPUT_VALUE,
                        new IntLiteralNode(1n),
                      ),
                      BinaryOperator.EQ,
                      new IdentifierNode('changeValue'),
                    ),
                  ),
                ]),
              ),
            ]),
          ),
          new FunctionDefinitionNode(
            'reclaim',
            [
              new ParameterNode(PrimitiveType.PUBKEY, 'pk'),
              new ParameterNode(PrimitiveType.SIG, 's'),
            ],
            new BlockNode([
              new RequireNode(
                new BinaryOpNode(
                  new FunctionCallNode(
                    new IdentifierNode('hash160'),
                    [new IdentifierNode('pk')],
                  ),
                  BinaryOperator.EQ,
                  new IdentifierNode('funder'),
                ),
              ),
              new RequireNode(
                new FunctionCallNode(
                  new IdentifierNode('checkSig'),
                  [
                    new IdentifierNode('s'),
                    new IdentifierNode('pk'),
                  ],
                ),
              ),
            ]),
          ),
        ],
      ),
    ),
  },
  {
    fn: 'announcement.scash',
    ast: new SourceFileNode(
      new ContractNode(
        'Announcement',
        [],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [new FunctionDefinitionNode(
          'announce',
          [],
          new BlockNode([
            new VariableDefinitionNode(
              new BytesType(),
              [],
              'announcement',
              new InstantiationNode(
                new IdentifierNode(Class.LOCKING_BYTECODE_NULLDATA),
                [new ArrayNode([
                  new HexLiteralNode(hexToBin('6d02')),
                  Object.assign(new CastNode(
                    new BytesType(),
                    new StringLiteralNode('A contract may not injure a human being or, through inaction, allow a human being to come to harm.', '\''),
                    false,
                  ), { sourceCast: true }),
                ])],
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.OUTPUT_VALUE,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new IntLiteralNode(0n),
              ),
            ),
            new RequireNode(
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.OUTPUT_LOCKING_BYTECODE,
                  new IntLiteralNode(0n),
                ),
                BinaryOperator.EQ,
                new IdentifierNode('announcement'),
              ),
            ),
            new VariableDefinitionNode(
              new IntType(true, 256),
              [],
              'minerFee',
              new IntLiteralNode(1000n),
            ),
            new VariableDefinitionNode(
              new IntType(true, 256),
              [],
              'changeAmount',
              new BinaryOpNode(
                new UnaryOpNode(
                  UnaryOperator.INPUT_VALUE,
                  new NullaryOpNode(NullaryOperator.INPUT_INDEX),
                ),
                BinaryOperator.MINUS,
                new IdentifierNode('minerFee'),
              ),
            ),
            new BranchNode(
              new BinaryOpNode(
                new IdentifierNode('changeAmount'),
                BinaryOperator.GE,
                new IdentifierNode('minerFee'),
              ),
              new BlockNode([
                new RequireNode(
                  new BinaryOpNode(
                    new UnaryOpNode(
                      UnaryOperator.OUTPUT_LOCKING_BYTECODE,
                      new IntLiteralNode(1n),
                    ),
                    BinaryOperator.EQ,
                    new UnaryOpNode(
                      UnaryOperator.INPUT_LOCKING_BYTECODE,
                      new NullaryOpNode(NullaryOperator.INPUT_INDEX),
                    ),
                  ),
                ),
                new RequireNode(
                  new BinaryOpNode(
                    new UnaryOpNode(
                      UnaryOperator.OUTPUT_VALUE,
                      new IntLiteralNode(1n),
                    ),
                    BinaryOperator.EQ,
                    new IdentifierNode('changeAmount'),
                  ),
                ),
              ]),
            ),
          ]),
        )],
      ),
    ),
  },
  {
    fn: 'debug_messages.scash',
    ast: new SourceFileNode(
      new ContractNode(
        'DebugMessages',
        [],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [
          new FunctionDefinitionNode(
            'spend',
            [new ParameterNode(new IntType(true, 256), 'value')],
            new BlockNode([
              new RequireNode(
                new BinaryOpNode(
                  new IdentifierNode('value'),
                  BinaryOperator.EQ,
                  new IntLiteralNode(1n),
                ),
                'Wrong value passed',
              ),
              new ConsoleStatementNode([
                new IdentifierNode('value'),
                new StringLiteralNode('test', '"'),
              ]),
              new ConsoleStatementNode([
                new IdentifierNode('value'),
                new StringLiteralNode('test2', '"'),
              ]),
              new RequireNode(
                new BinaryOpNode(
                  new BinaryOpNode(
                    new IdentifierNode('value'),
                    BinaryOperator.PLUS,
                    new IntLiteralNode(1n),
                  ),
                  BinaryOperator.EQ,
                  new IntLiteralNode(2n),
                ),
                'Sum doesn\'t work',
              ),
            ]),
          ),
        ],
      ),
    ),
  },
  {
    fn: 'do_while_loop.scash',
    ast: new SourceFileNode(
      new ContractNode(
        'Loopy',
        [],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [new FunctionDefinitionNode(
          'doLoop',
          [],
          new BlockNode([
            new VariableDefinitionNode(
              new IntType(true, 256),
              [],
              'i',
              new IntLiteralNode(0n),
            ),
            new DoWhileNode(
              new BinaryOpNode(
                new IdentifierNode('i'),
                BinaryOperator.LT,
                new NullaryOpNode(NullaryOperator.INPUT_COUNT),
              ),
              new BlockNode([
                new AssignNode(
                  new IdentifierNode('i'),
                  new BinaryOpNode(
                    new IdentifierNode('i'),
                    BinaryOperator.PLUS,
                    new IntLiteralNode(1n),
                  ),
                ),
              ]),
            ),
            new ConsoleStatementNode([
              new IdentifierNode('i'),
            ]),
            new RequireNode(
              new BinaryOpNode(
                new IdentifierNode('i'),
                BinaryOperator.GT,
                new IntLiteralNode(2n),
              ),
            ),
          ]),
        )],
      ),
    ),
  },
];
