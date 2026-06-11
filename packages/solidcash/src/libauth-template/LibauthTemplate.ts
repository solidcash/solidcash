import {
  assertSuccess,
  AuthenticationInstructionPush,
  binToBase64,
  binToHex,
  decodeAuthenticationInstructions,
  Input,
  TransactionBch,
  utf8ToBin,
  WalletTemplate,
  WalletTemplateScenario,
  WalletTemplateScenarioBytecode,
  WalletTemplateScenarioOutput,
  WalletTemplateScriptLocking,
  WalletTemplateScriptUnlocking,
  WalletTemplateVariable,
} from '@bitauth/libauth';
import {
  AbiFunction,
  AbiInput,
  Artifact,
} from '@solidcash/utils';
import { EncodedConstructorArgument, EncodedFunctionArgument, encodeFunctionArguments } from '../Argument.js';
import { Contract } from '../Contract.js';
import { DebugResults, debugTemplate } from '../debugging.js';
import {
  isContractUnlocker,
  isP2PKHUnlocker,
  isStandardUnlockableUtxo,
  isUnlockableUtxo,
  LibauthOutput,
  Output,
  StandardUnlockableUtxo,
  Utxo,
} from '../interfaces.js';
import SignatureTemplate from '../SignatureTemplate.js';
import { addressToLockScript, extendedStringify, zip } from '../utils.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { zlibSync } from 'fflate';
import MockNetworkProvider from '../network/MockNetworkProvider.js';
import { addHexPrefixExceptEmpty, DEFAULT_VM_TARGET, formatBytecodeForDebugging, formatFunctionBodyForDebugging, formatParametersForDebugging, getBodyLockScriptName, getBodyUnlockScriptName, getLockScriptName, getSignatureAndPubkeyFromP2PKHInput, getUnlockScriptName, serialiseTokenDetails } from './utils.js';

// TODO: Add / improve descriptions throughout the template generation

// For OP_INVOKE contracts, libauth's Key-based signing computes coveredBytecode from the full
// redeemScript, but OP_INVOKE changes state.instructions so OP_CHECKSIG uses the function body
// as coveredBytecode. To fix this mismatch, we extract pre-computed signatures from the built
// transaction and replace SignatureTemplate entries with Uint8Array signature bytes.
// All downstream functions check `arg instanceof SignatureTemplate` - with Uint8Array substituted,
// they automatically treat signatures as WalletData instead of Key-based signing.
const resolveArgsForOpInvoke = (
  contract: Contract,
  abiFunction: AbiFunction,
  encodedArgs: EncodedFunctionArgument[],
  libauthTransaction: TransactionBch,
  inputIndex: number,
): EncodedFunctionArgument[] => {
  if (!contract.artifact.functionBodies || Object.keys(contract.artifact.functionBodies).length === 0) {
    return encodedArgs;
  }

  const unlockingBytecode = libauthTransaction.inputs[inputIndex].unlockingBytecode;
  const instructions = assertSuccess(
    decodeAuthenticationInstructions(unlockingBytecode),
  ) as AuthenticationInstructionPush[];

  // Unlocking bytecode structure (from createUnlockingBytecode):
  // Selector first, then encodedArgs reversed, then redeemScript (for P2SH)
  // Instruction order: [selector, argN-1, argN-2, ..., arg1, arg0, redeemScript]
  const numArgs = abiFunction.inputs.length;

  return encodedArgs.map((arg, i) => {
    if (!(arg instanceof SignatureTemplate)) return arg;
    const instrIndex = numArgs - i;
    return instructions[instrIndex].data;
  });
};

export const getLibauthTemplate = (
  transactionBuilder: TransactionBuilder,
): WalletTemplate => {
  if (transactionBuilder.inputs.some((input) => !isStandardUnlockableUtxo(input))) {
    throw new Error('Cannot use debugging functionality with a transaction that contains custom unlockers');
  }

  const libauthTransaction = transactionBuilder.buildLibauthTransaction();

  // Build resolved args for OP_INVOKE contracts (pre-computed signatures as Uint8Array)
  const resolvedArgsMap = new Map<number, EncodedFunctionArgument[]>();
  transactionBuilder.inputs.forEach((input, inputIndex) => {
    if (!isStandardUnlockableUtxo(input) || !isContractUnlocker(input.unlocker)) return;
    const contract = input.unlocker.contract;
    if (!contract.artifact.functionBodies || Object.keys(contract.artifact.functionBodies).length === 0) return;

    const encodedArgs = encodeFunctionArguments(input.unlocker.abiFunction, input.unlocker.params ?? []);
    const resolvedArgs = resolveArgsForOpInvoke(
      contract, input.unlocker.abiFunction, encodedArgs, libauthTransaction, inputIndex,
    );
    resolvedArgsMap.set(inputIndex, resolvedArgs);
  });

  // Build original args for OP_INVOKE contracts (with SignatureTemplates intact for body view)
  const originalArgsMap = new Map<number, EncodedFunctionArgument[]>();
  transactionBuilder.inputs.forEach((input, inputIndex) => {
    if (!isStandardUnlockableUtxo(input) || !isContractUnlocker(input.unlocker)) return;
    if (!input.unlocker.contract.artifact.functionBodies
      || Object.keys(input.unlocker.contract.artifact.functionBodies).length === 0) return;
    originalArgsMap.set(inputIndex, encodeFunctionArguments(input.unlocker.abiFunction, input.unlocker.params ?? []));
  });

  const vmTarget = transactionBuilder.provider instanceof MockNetworkProvider
    ? transactionBuilder.provider.vmTarget
    : DEFAULT_VM_TARGET;

  const template: WalletTemplate = {
    $schema: 'https://ide.bitauth.com/authentication-template-v0.schema.json',
    description: 'Imported from solidcash',
    name: 'SolidCash Generated Debugging Template',
    supported: [vmTarget],
    version: 0,
    entities: generateAllTemplateEntities(transactionBuilder, resolvedArgsMap, originalArgsMap),
    scripts: generateAllTemplateScripts(transactionBuilder, resolvedArgsMap, originalArgsMap),
    scenarios: generateAllTemplateScenarios(libauthTransaction, transactionBuilder, resolvedArgsMap, originalArgsMap),
  };

  return template;
};

export const debugLibauthTemplate = (template: WalletTemplate, transaction: TransactionBuilder): DebugResults => {
  const allArtifacts = transaction.inputs
    .map(input => isContractUnlocker(input.unlocker) ? input.unlocker.contract : undefined)
    .filter((contract): contract is Contract => Boolean(contract))
    .map(contract => contract.artifact);

  return debugTemplate(template, allArtifacts);
};

export const getBitauthUri = (template: WalletTemplate): string => {
  const base64toBase64Url = (base64: string): string => base64.replace(/\+/g, '-').replace(/\//g, '_');
  const payload = base64toBase64Url(binToBase64(zlibSync(utf8ToBin(extendedStringify(template)))));
  return `https://ide.bitauth.com/import-template/${payload}`;
};

const generateAllTemplateEntities = (
  transactionBuilder: TransactionBuilder,
  resolvedArgsMap: Map<number, EncodedFunctionArgument[]>,
  originalArgsMap: Map<number, EncodedFunctionArgument[]>,
): WalletTemplate['entities'] => {
  const entities = transactionBuilder.inputs.map((input, inputIndex) => {
    if (isP2PKHUnlocker(input.unlocker)) {
      return generateTemplateEntitiesP2PKH(inputIndex);
    }

    if (isContractUnlocker(input.unlocker)) {
      const encodedArgs = resolvedArgsMap.get(inputIndex)
        ?? encodeFunctionArguments(input.unlocker.abiFunction, input.unlocker.params ?? []);
      const p2shEntities = generateTemplateEntitiesP2SH(
        input.unlocker.contract, input.unlocker.abiFunction, encodedArgs, inputIndex,
      );

      const originalArgs = originalArgsMap.get(inputIndex);
      if (originalArgs) {
        const bodyEntities = generateTemplateEntitiesBody(
          input.unlocker.contract, input.unlocker.abiFunction, originalArgs, inputIndex,
        );
        return { ...p2shEntities, ...bodyEntities };
      }

      return p2shEntities;
    }

    throw new Error('Unknown unlocker type');
  });

  return entities.reduce((acc, entity) => ({ ...acc, ...entity }), {});
};

const generateAllTemplateScripts = (
  transactionBuilder: TransactionBuilder,
  resolvedArgsMap: Map<number, EncodedFunctionArgument[]>,
  originalArgsMap: Map<number, EncodedFunctionArgument[]>,
): WalletTemplate['scripts'] => {
  const scripts = transactionBuilder.inputs.map((input, inputIndex) => {
    if (isP2PKHUnlocker(input.unlocker)) {
      return generateTemplateScriptsP2PKH(inputIndex);
    }

    if (isContractUnlocker(input.unlocker)) {
      const encodedArgs = resolvedArgsMap.get(inputIndex)
        ?? encodeFunctionArguments(input.unlocker.abiFunction, input.unlocker.params ?? []);
      const p2shScripts = generateTemplateScriptsP2SH(
        input.unlocker.contract,
        input.unlocker.abiFunction,
        encodedArgs,
        input.unlocker.contract.encodedConstructorArgs,
        inputIndex,
      );

      const originalArgs = originalArgsMap.get(inputIndex);
      if (originalArgs) {
        const contract = input.unlocker.contract;
        const abiFunction = input.unlocker.abiFunction;
        const selectorHex = abiFunction.selector ?? '';
        const bodyScripts = {
          ...generateBodyLockScript(contract, abiFunction, selectorHex),
          ...generateBodyUnlockScript(contract, abiFunction, originalArgs, contract.encodedConstructorArgs, inputIndex),
        };
        return { ...p2shScripts, ...bodyScripts };
      }

      return p2shScripts;
    }

    throw new Error('Unknown unlocker type');
  });

  return scripts.reduce((acc, script) => ({ ...acc, ...script }), {});
};

const generateLockingBytecodeParamsMapping = (
  transactionBuilder: TransactionBuilder,
): Record<string, WalletTemplateScenarioBytecode> => {
  // Initialize bytecode mapping, this will be used to map the locking bytecode to the locking bytecode params
  const mapping: Record<string, WalletTemplateScenarioBytecode> = {};

  // We can typecast this because we check that all inputs are standard unlockable at the top of this function
  for (const input of (transactionBuilder.inputs as StandardUnlockableUtxo[])) {
    if (isContractUnlocker(input.unlocker)) {
      const lockScriptName = getLockScriptName(input.unlocker.contract);
      const lockingScriptParams = generateLockingScriptParams(input.unlocker.contract, input, lockScriptName);
      const lockingBytecode = binToHex(addressToLockScript(input.unlocker.contract.address));
      mapping[lockingBytecode] = lockingScriptParams;
    }
  }

  return mapping;
};

const generateAllTemplateScenarios = (
  libauthTransaction: TransactionBch,
  transactionBuilder: TransactionBuilder,
  resolvedArgsMap: Map<number, EncodedFunctionArgument[]>,
  originalArgsMap: Map<number, EncodedFunctionArgument[]>,
): WalletTemplate['scenarios'] => {
  const scenarios = transactionBuilder.inputs.map((input, inputIndex) => {
    if (isP2PKHUnlocker(input.unlocker)) {
      return generateTemplateScenariosP2PKH(libauthTransaction, transactionBuilder, inputIndex);
    }

    if (isContractUnlocker(input.unlocker)) {
      const encodedArgs = resolvedArgsMap.get(inputIndex)
        ?? encodeFunctionArguments(input.unlocker.abiFunction, input.unlocker.params ?? []);
      const p2shScenarios = generateTemplateScenarios(
        input.unlocker.contract,
        libauthTransaction,
        transactionBuilder,
        input.unlocker.abiFunction,
        encodedArgs,
        inputIndex,
      );

      const originalArgs = originalArgsMap.get(inputIndex);
      if (originalArgs) {
        const bodyScenarios = generateBodyScenario(
          input.unlocker.contract, libauthTransaction, transactionBuilder,
          input.unlocker.abiFunction, originalArgs, inputIndex,
        );
        return { ...p2shScenarios, ...bodyScenarios };
      }

      return p2shScenarios;
    }

    throw new Error('Unknown unlocker type');
  });

  return scenarios.reduce((acc, scenario) => ({ ...acc, ...scenario }), {});
};

const generateTemplateEntitiesP2PKH = (
  inputIndex: number,
): WalletTemplate['entities'] => {
  const lockScriptName = `p2pkh_placeholder_lock_${inputIndex}`;
  const unlockScriptName = `p2pkh_placeholder_unlock_${inputIndex}`;

  return {
    [`signer_${inputIndex}`]: {
      scripts: [lockScriptName, unlockScriptName],
      description: `P2PKH data for input ${inputIndex}`,
      name: `P2PKH Signer (input #${inputIndex})`,
      variables: {
        [`signature_${inputIndex}`]: {
          description: '',
          name: `P2PKH Signature (input #${inputIndex})`,
          type: 'WalletData',
        },
        [`public_key_${inputIndex}`]: {
          description: '',
          name: `P2PKH public key (input #${inputIndex})`,
          type: 'WalletData',
        },
      },
    },
  };
};

const generateTemplateEntitiesP2SH = (
  contract: Contract,
  abiFunction: AbiFunction,
  encodedFunctionArgs: EncodedFunctionArgument[],
  inputIndex: number,
): WalletTemplate['entities'] => {
  const entities = {
    [contract.artifact.contractName + '_input' + inputIndex + '_parameters']: {
      description: 'Contract creation and function parameters',
      name: `${contract.artifact.contractName} (input #${inputIndex})`,
      scripts: [
        getLockScriptName(contract),
        getUnlockScriptName(contract, abiFunction, inputIndex),
      ],
      variables: {
        ...createWalletTemplateVariables(contract.artifact, abiFunction, encodedFunctionArgs),
        ...generateFunctionIndexTemplateVariable(contract.artifact.abi),
      },
    },
  };

  return entities;
};

const createWalletTemplateVariables = (
  artifact: Artifact,
  abiFunction: AbiFunction,
  encodedFunctionArgs: EncodedFunctionArgument[],
  variablePrefix: string = '',
): Record<string, WalletTemplateVariable> => {
  const functionParameters = Object.fromEntries<WalletTemplateVariable>(
    abiFunction.inputs.map((input, index) => ([
      variablePrefix + input.name,
      {
        description: `"${input.name}" parameter of function "${abiFunction.name}"`,
        name: input.name,
        type: encodedFunctionArgs[index] instanceof SignatureTemplate ? 'Key' : 'WalletData',
      },
    ])),
  );

  const constructorParameters = Object.fromEntries<WalletTemplateVariable>(
    artifact.constructorInputs.map((input) => ([
      variablePrefix + input.name,
      {
        description: `"${input.name}" parameter of this contract`,
        name: input.name,
        type: 'WalletData',
      },
    ])),
  );

  return { ...functionParameters, ...constructorParameters };
};

const generateTemplateScriptsP2PKH = (
  inputIndex: number,
): WalletTemplate['scripts'] => {
  const lockScriptName = `p2pkh_placeholder_lock_${inputIndex}`;
  const unlockScriptName = `p2pkh_placeholder_unlock_${inputIndex}`;

  const scripts = {
    [unlockScriptName]: {
      passes: [`P2PKH_spend_input${inputIndex}_evaluate`],
      name: `P2PKH Unlock (input #${inputIndex})`,
      script:
        `<signature_${inputIndex}>\n<public_key_${inputIndex}>`,
      unlocks: lockScriptName,
    },
    [lockScriptName]: {
      lockingType: 'standard',
      name: `P2PKH Lock (input #${inputIndex})`,
      script:
        `OP_DUP\nOP_HASH160 <$(<public_key_${inputIndex}> OP_HASH160\n)> OP_EQUALVERIFY\nOP_CHECKSIG`,
    },
  };

  return scripts;
};

const generateTemplateScriptsP2SH = (
  contract: Contract,
  abiFunction: AbiFunction,
  encodedFunctionArgs: EncodedFunctionArgument[],
  encodedConstructorArgs: EncodedConstructorArgument[],
  inputIndex: number,
): WalletTemplate['scripts'] => {
  const unlockingScriptName = getUnlockScriptName(contract, abiFunction, inputIndex);
  const lockingScriptName = getLockScriptName(contract);

  return {
    [unlockingScriptName]: generateTemplateUnlockScript(contract, abiFunction, encodedFunctionArgs, inputIndex),
    [lockingScriptName]: generateTemplateLockScript(contract, encodedConstructorArgs),
  };
};

const generateTemplateLockScript = (
  contract: Contract,
  constructorArguments: EncodedFunctionArgument[],
): WalletTemplateScriptLocking => {
  return {
    lockingType: contract.addressType === 'p2s' ? 'standard' : contract.addressType,
    name: contract.artifact.contractName,
    script: [
      `// "${contract.artifact.contractName}" contract constructor parameters`,
      formatParametersForDebugging(contract.artifact.constructorInputs, constructorArguments),
      '',
      '// bytecode',
      formatBytecodeForDebugging(contract.artifact),
    ].join('\n'),
  };
};

const generateTemplateUnlockScript = (
  contract: Contract,
  abiFunction: AbiFunction,
  encodedFunctionArgs: EncodedFunctionArgument[],
  inputIndex: number,
): WalletTemplateScriptUnlocking => {
  const scenarioIdentifier = `${contract.artifact.contractName}_${abiFunction.name}_input${inputIndex}_evaluate`;
  const selectorHex = abiFunction.selector;

  // receive() functions should NOT push a selector - the dispatch detects receive by stack depth == M
  const functionIndexString = selectorHex && contract.artifact.abi.length > 1 && !abiFunction.isReceive
    ? ['// function selector', `<function_index> // bytes4 = <0x${selectorHex}>`, '']
    : [];

  return {
    // this unlocking script must pass our only scenario
    passes: [scenarioIdentifier],
    name: `${abiFunction.name} (input #${inputIndex})`,
    script: [
      ...functionIndexString,
      `// "${abiFunction.name}" function parameters`,
      formatParametersForDebugging(abiFunction.inputs, encodedFunctionArgs),
      '',
    ].join('\n'),
    unlocks: getLockScriptName(contract),
  };
};

const generateTemplateScenarios = (
  contract: Contract,
  libauthTransaction: TransactionBch,
  transactionBuilder: TransactionBuilder,
  abiFunction: AbiFunction,
  encodedFunctionArgs: EncodedFunctionArgument[],
  inputIndex: number,
): WalletTemplate['scenarios'] => {
  const artifact = contract.artifact;
  const encodedConstructorArgs = contract.encodedConstructorArgs;
  const scenarioIdentifier = `${artifact.contractName}_${abiFunction.name}_input${inputIndex}_evaluate`;

  const scenarios = {
    // single scenario to spend out transaction under test given the SolidCash parameters provided
    [scenarioIdentifier]: {
      name: `Evaluate ${artifact.contractName} ${abiFunction.name} (input #${inputIndex})`,
      description: 'An example evaluation where this script execution passes.',
      data: {
        // encode values for the variables defined above in `entities` property
        bytecode: {
          ...generateTemplateScenarioParametersFunctionIndex(abiFunction, contract.artifact.abi),
          ...generateTemplateScenarioParametersValues(abiFunction.inputs, encodedFunctionArgs),
          ...generateTemplateScenarioParametersValues(artifact.constructorInputs, encodedConstructorArgs),
        },
        keys: {
          privateKeys: generateTemplateScenarioKeys(abiFunction.inputs, encodedFunctionArgs),
        },
      },
      transaction: generateTemplateScenarioTransaction(contract, libauthTransaction, transactionBuilder, inputIndex),
      sourceOutputs: generateTemplateScenarioSourceOutputs(transactionBuilder, libauthTransaction, inputIndex),
    },
  };

  return scenarios;
};

const generateTemplateScenariosP2PKH = (
  libauthTransaction: TransactionBch,
  transactionBuilder: TransactionBuilder,
  inputIndex: number,
): WalletTemplate['scenarios'] => {
  const scenarioIdentifier = `P2PKH_spend_input${inputIndex}_evaluate`;
  const { signature, publicKey } = getSignatureAndPubkeyFromP2PKHInput(libauthTransaction.inputs[inputIndex]);

  const scenarios = {
    // single scenario to spend out transaction under test given the SolidCash parameters provided
    [scenarioIdentifier]: {
      name: `Evaluate P2PKH spend (input #${inputIndex})`,
      description: 'An example evaluation where this script execution passes.',
      data: {
        // encode values for the variables defined above in `entities` property
        bytecode: {
          [`signature_${inputIndex}`]: `0x${binToHex(signature)}`,
          [`public_key_${inputIndex}`]: `0x${binToHex(publicKey)}`,
        },
      },
      transaction: generateTemplateScenarioTransaction(undefined, libauthTransaction, transactionBuilder, inputIndex),
      sourceOutputs: generateTemplateScenarioSourceOutputs(transactionBuilder, libauthTransaction, inputIndex),
    },
  };

  return scenarios;
};

const generateTemplateScenarioTransaction = (
  contract: Contract | undefined,
  libauthTransaction: TransactionBch,
  transactionBuilder: TransactionBuilder,
  slotIndex: number,
): WalletTemplateScenario['transaction'] => {
  const lockingBytecodeParamsMapping = generateLockingBytecodeParamsMapping(transactionBuilder);

  const zippedInputs = zip(transactionBuilder.inputs, libauthTransaction.inputs);
  const inputs = zippedInputs.map(([csInput, libauthInput], inputIndex) => {
    return {
      outpointIndex: libauthInput.outpointIndex,
      outpointTransactionHash: binToHex(libauthInput.outpointTransactionHash),
      sequenceNumber: libauthInput.sequenceNumber,
      unlockingBytecode: generateTemplateScenarioBytecode(csInput, libauthInput, inputIndex, 'p2pkh_placeholder_unlock', slotIndex === inputIndex),
    };
  });

  const locktime = libauthTransaction.locktime;

  const zippedOutputs = zip(transactionBuilder.outputs, libauthTransaction.outputs);
  const outputs = zippedOutputs.map(([csOutput, libauthOutput]) => {
    return {
      lockingBytecode: generateTemplateScenarioTransactionOutputLockingBytecode(
        csOutput, libauthOutput, contract, lockingBytecodeParamsMapping,
      ),
      token: serialiseTokenDetails(libauthOutput.token),
      valueSatoshis: Number(libauthOutput.valueSatoshis),
    };
  });

  const version = libauthTransaction.version;

  return { inputs, locktime, outputs, version };
};

const generateTemplateScenarioSourceOutputs = (
  transactionBuilder: TransactionBuilder,
  libauthTransaction: TransactionBch,
  slotIndex: number,
): Array<WalletTemplateScenarioOutput<true>> => {
  const zippedInputs = zip(transactionBuilder.inputs, libauthTransaction.inputs);
  return zippedInputs.map(([csInput, libauthInput], inputIndex) => {
    return {
      lockingBytecode: generateTemplateScenarioBytecodeForSourceOutputs(csInput, libauthInput, inputIndex, 'p2pkh_placeholder_lock', inputIndex === slotIndex),
      valueSatoshis: Number(csInput.satoshis),
      token: serialiseTokenDetails(csInput.token),
    };
  });
};

const generateLockingScriptParams = (
  contract: Contract,
  { unlocker }: StandardUnlockableUtxo,
  lockScriptName: string,
): WalletTemplateScenarioBytecode => {
  if (isP2PKHUnlocker(unlocker)) {
    return {
      script: lockScriptName,
    };
  }

  const constructorParamsEntries = contract.artifact.constructorInputs
    .map(({ name }, index) => [
      name,
      addHexPrefixExceptEmpty(
        binToHex(unlocker.contract.encodedConstructorArgs[index]),
      ),
    ]);

  const constructorParams = Object.fromEntries(constructorParamsEntries);

  return {
    script: lockScriptName,
    overrides: {
      bytecode: { ...constructorParams },
    },
  };
};

const generateUnlockingScriptParams = (
  csInput: StandardUnlockableUtxo,
  libauthInput: Input,
  p2pkhScriptNameTemplate: string,
  inputIndex: number,
): WalletTemplateScenarioBytecode => {
  if (isP2PKHUnlocker(csInput.unlocker)) {
    const { signature, publicKey } = getSignatureAndPubkeyFromP2PKHInput(libauthInput);

    return {
      script: `${p2pkhScriptNameTemplate}_${inputIndex}`,
      overrides: {
        bytecode: {
          [`signature_${inputIndex}`]: `0x${binToHex(signature)}`,
          [`public_key_${inputIndex}`]: `0x${binToHex(publicKey)}`,
        },
      },
    };
  }

  const abiFunction = csInput.unlocker.abiFunction;
  const contract = csInput.unlocker.contract;
  let encodedFunctionArgs: EncodedFunctionArgument[] = encodeFunctionArguments(abiFunction, csInput.unlocker.params);

  // For OP_INVOKE contracts, extract pre-computed signatures from the built transaction
  // because libauth's Key-based signing uses the wrong coveredBytecode
  if (contract.artifact.functionBodies && Object.keys(contract.artifact.functionBodies).length > 0) {
    const instructions = assertSuccess(
      decodeAuthenticationInstructions(libauthInput.unlockingBytecode),
    ) as AuthenticationInstructionPush[];
    const numArgs = abiFunction.inputs.length;
    encodedFunctionArgs = encodedFunctionArgs.map((arg, i) => {
      if (!(arg instanceof SignatureTemplate)) return arg;
      // Selector first: [selector, argN-1, argN-2, ..., arg1, arg0, redeemScript]
      // instrIndex = numArgs - i
      const instrIndex = numArgs - i;
      return instructions[instrIndex].data;
    });
  }

  return {
    script: getUnlockScriptName(contract, abiFunction, inputIndex),
    overrides: {
      // encode values for the variables defined above in `entities` property
      bytecode: {
        ...generateTemplateScenarioParametersFunctionIndex(abiFunction, contract.artifact.abi),
        ...generateTemplateScenarioParametersValues(abiFunction.inputs, encodedFunctionArgs),
        ...generateTemplateScenarioParametersValues(contract.artifact.constructorInputs, contract.encodedConstructorArgs),
      },
      keys: {
        privateKeys: generateTemplateScenarioKeys(abiFunction.inputs, encodedFunctionArgs),
      },
    },
  };
};

const generateTemplateScenarioParametersValues = (
  types: readonly AbiInput[],
  encodedArgs: EncodedFunctionArgument[],
  variablePrefix: string = '',
): Record<string, string> => {
  const typesAndArguments = zip(types, encodedArgs);

  const entries = typesAndArguments
    // SignatureTemplates are handled by the 'keys' object in the scenario
    .filter(([, arg]) => !(arg instanceof SignatureTemplate))
    .map(([input, arg]) => {
      const encodedArgumentHex = binToHex(arg as Uint8Array);
      const prefixedEncodedArgument = addHexPrefixExceptEmpty(encodedArgumentHex);
      return [variablePrefix + input.name, prefixedEncodedArgument] as const;
    });

  return Object.fromEntries(entries);
};

const generateTemplateScenarioKeys = (
  types: readonly AbiInput[],
  encodedArgs: EncodedFunctionArgument[],
  variablePrefix: string = '',
): Record<string, string> => {
  const typesAndArguments = zip(types, encodedArgs);

  const entries = typesAndArguments
    .filter(([, arg]) => arg instanceof SignatureTemplate)
    .map(([input, arg]) => ([variablePrefix + input.name, binToHex((arg as SignatureTemplate).privateKey)] as const));

  return Object.fromEntries(entries);
};

// Used for generating the locking / unlocking bytecode for source outputs and inputs
const generateTemplateScenarioBytecode = (
  input: Utxo,
  libauthInput: Input,
  inputIndex: number,
  p2pkhScriptNameTemplate: string,
  insertSlot?: boolean,
): WalletTemplateScenarioBytecode | ['slot'] => {
  if (insertSlot) return ['slot'];

  if (isUnlockableUtxo(input) && isStandardUnlockableUtxo(input)) {
    return generateUnlockingScriptParams(input, libauthInput, p2pkhScriptNameTemplate, inputIndex);
  }

  // 'slot' means that we are currently evaluating this specific input,
  // {} means that it is the same script type, but not being evaluated
  return {};
};

const generateTemplateScenarioBytecodeForSourceOutputs = (
  input: Utxo,
  libauthInput: Input,
  inputIndex: number,
  p2pkhScriptNameTemplate: string,
  insertSlot?: boolean,
): WalletTemplateScenarioBytecode | ['slot'] => {
  if (insertSlot) return ['slot'];

  if (isUnlockableUtxo(input) && isStandardUnlockableUtxo(input)) {
    // If the input is a contract unlocker, we need to generate the locking bytecode params for the source outputs
    if (isContractUnlocker(input.unlocker)) {
      const lockScriptName = getLockScriptName(input.unlocker.contract);
      const lockingBytecodeParams = generateLockingScriptParams(input.unlocker.contract, input, lockScriptName);
      return lockingBytecodeParams;
    }

    // For a P2PKH unlocker, the sourceOutputs "locking bytecode params" are the same as the unlocking bytecode params
    return generateUnlockingScriptParams(input, libauthInput, p2pkhScriptNameTemplate, inputIndex);
  }

  // 'slot' means that we are currently evaluating this specific input,
  // {} means that it is the same script type, but not being evaluated
  return {};
};

const generateTemplateScenarioTransactionOutputLockingBytecode = (
  csOutput: Output,
  libauthOutput: LibauthOutput,
  contract: Contract | undefined,
  lockingBytecodeParamsMapping: Record<string, WalletTemplateScenarioBytecode>,
): string | {} => {
  // If lockingBytecodeParams is known from the mapping, return it
  const lockingBytecode = binToHex(libauthOutput.lockingBytecode);
  const lockingBytecodeParams = lockingBytecodeParamsMapping[lockingBytecode];
  if (lockingBytecodeParams) return lockingBytecodeParams;

  if (csOutput.to instanceof Uint8Array) return binToHex(csOutput.to);
  if (contract && [contract.address, contract.tokenAddress].includes(csOutput.to)) return {};
  return binToHex(addressToLockScript(csOutput.to));
};

const generateTemplateScenarioParametersFunctionIndex = (
  abiFunction: AbiFunction,
  abi: readonly AbiFunction[],
): Record<string, string> => {
  if (abi.length <= 1) return {};
  // receive() functions don't push a selector - dispatch detects them by stack depth
  if (abiFunction.isReceive) return {};
  const selector = abiFunction.selector;
  return selector ? { function_index: `0x${selector}` } : {};
};

const generateFunctionIndexTemplateVariable = (
  abi: readonly AbiFunction[],
): Record<string, WalletTemplateVariable> => {
  if (abi.length > 1) {
    return {
      function_index: {
        description: 'Script function index to execute',
        name: 'function_index',
        type: 'WalletData',
      },
    };
  }

  return {};
};

// ============================================================================
// Body view generators - expanded function body scripts for OP_INVOKE debugging
// ============================================================================

// Body entity variables are prefixed with 'body_' to avoid namespace collisions with P2SH entity
// variables. Libauth merges all entity variables into a single flat namespace
// (walletTemplateToCompilerConfiguration), so without prefixing, the body entity's Key-typed
// signature variables would overwrite the P2SH entity's WalletData-typed variables.
const BODY_VARIABLE_PREFIX = 'body_';

const generateTemplateEntitiesBody = (
  contract: Contract,
  abiFunction: AbiFunction,
  originalFunctionArgs: EncodedFunctionArgument[],
  inputIndex: number,
): WalletTemplate['entities'] => ({
  [`${contract.artifact.contractName}_body_input${inputIndex}_parameters`]: {
    description: 'Function body expanded view parameters',
    name: `${contract.artifact.contractName} ${abiFunction.name} body (input #${inputIndex})`,
    scripts: [
      getBodyLockScriptName(contract, abiFunction),
      getBodyUnlockScriptName(contract, abiFunction, inputIndex),
    ],
    variables: createWalletTemplateVariables(contract.artifact, abiFunction, originalFunctionArgs, BODY_VARIABLE_PREFIX),
  },
});

/**
 * Generates a lock script containing the expanded function body opcodes mapped to source code.
 *
 * The body view uses `lockingType: 'standard'` so the function body bytecode IS the locking
 * bytecode being evaluated. This correctly models several OP_INVOKE behaviors:
 *
 * - **OP_ACTIVEBYTECODE**: Returns `state.instructions` which OP_INVOKE sets to the function body.
 *   In the body view, `state.instructions` = lock script = function body. Match.
 * - **OP_CHECKSIG coveredBytecode**: Uses `state.instructions` same as OP_ACTIVEBYTECODE. Match.
 * - **OP_CODESEPARATOR**: Operates on per-invocation instruction pointer. Match.
 *
 * Known behavioral discrepancies (uncommon patterns, accepted trade-offs):
 * - **OP_UTXOBYTECODE on self**: Returns function body (via `['slot']`) instead of P2SH envelope.
 *   Self-preservation covenants are mitigated by overriding output locking bytecodes to reference
 *   the body lock script (both sides = function body -> comparison succeeds).
 * - **OP_INPUTBYTECODE on self**: Returns body-view unlocking bytecode (func_args + ctor_args only)
 *   instead of full P2SH unlocking bytecode (func_args + ctor_args + function_index + redeem_script).
 * - **Upper-context OP_ACTIVEBYTECODE**: No way to access the caller's active bytecode from inside
 *   the function body; OP_INVOKE saves it on the control stack but no opcode exposes it.
 */
const generateBodyLockScript = (
  contract: Contract,
  abiFunction: AbiFunction,
  selectorHex: string,
): WalletTemplate['scripts'] => ({
  [getBodyLockScriptName(contract, abiFunction)]: {
    lockingType: 'standard' as const,
    name: `${contract.artifact.contractName} ${abiFunction.name} (function body)`,
    script: formatFunctionBodyForDebugging(contract.artifact, selectorHex),
  },
});

const generateBodyUnlockScript = (
  contract: Contract,
  abiFunction: AbiFunction,
  originalFunctionArgs: EncodedFunctionArgument[],
  encodedConstructorArgs: EncodedConstructorArgument[],
  inputIndex: number,
): WalletTemplate['scripts'] => ({
  [getBodyUnlockScriptName(contract, abiFunction, inputIndex)]: {
    passes: [`${contract.artifact.contractName}_${abiFunction.name}_body_input${inputIndex}_evaluate`],
    name: `${abiFunction.name} body (input #${inputIndex})`,
    script: [
      `// "${abiFunction.name}" function parameters`,
      formatParametersForDebugging(abiFunction.inputs, originalFunctionArgs, BODY_VARIABLE_PREFIX),
      '',
      `// "${contract.artifact.contractName}" constructor parameters`,
      formatParametersForDebugging(contract.artifact.constructorInputs, encodedConstructorArgs, BODY_VARIABLE_PREFIX),
    ].join('\n'),
    unlocks: getBodyLockScriptName(contract, abiFunction),
  },
});

const generateBodyScenario = (
  contract: Contract,
  libauthTransaction: TransactionBch,
  transactionBuilder: TransactionBuilder,
  abiFunction: AbiFunction,
  originalFunctionArgs: EncodedFunctionArgument[],
  inputIndex: number,
): WalletTemplate['scenarios'] => ({
  [`${contract.artifact.contractName}_${abiFunction.name}_body_input${inputIndex}_evaluate`]: {
    name: `Evaluate ${contract.artifact.contractName} ${abiFunction.name} body (input #${inputIndex})`,
    description: 'Function body expanded view.',
    data: {
      bytecode: {
        ...generateTemplateScenarioParametersValues(abiFunction.inputs, originalFunctionArgs, BODY_VARIABLE_PREFIX),
        ...generateTemplateScenarioParametersValues(
          contract.artifact.constructorInputs, contract.encodedConstructorArgs, BODY_VARIABLE_PREFIX,
        ),
      },
      keys: {
        privateKeys: generateTemplateScenarioKeys(abiFunction.inputs, originalFunctionArgs, BODY_VARIABLE_PREFIX),
      },
    },
    transaction: generateBodyScenarioTransaction(contract, libauthTransaction, transactionBuilder, abiFunction, inputIndex),
    sourceOutputs: generateTemplateScenarioSourceOutputs(transactionBuilder, libauthTransaction, inputIndex),
  },
});

const generateBodyScenarioTransaction = (
  contract: Contract,
  libauthTransaction: TransactionBch,
  transactionBuilder: TransactionBuilder,
  abiFunction: AbiFunction,
  slotIndex: number,
): WalletTemplateScenario['transaction'] => {
  // Build a modified mapping: outputs going to the same contract reference the body lock script
  const bodyLockScriptName = getBodyLockScriptName(contract, abiFunction);
  const bodyLockingBytecodeParamsMapping = generateLockingBytecodeParamsMapping(transactionBuilder);

  // Override: map the contract's own P2SH locking bytecode to the body lock script
  const contractLockingBytecodeHex = binToHex(addressToLockScript(contract.address));
  bodyLockingBytecodeParamsMapping[contractLockingBytecodeHex] = { script: bodyLockScriptName };

  // Also handle tokenAddress if different
  if (contract.tokenAddress !== contract.address) {
    const tokenLockingBytecodeHex = binToHex(addressToLockScript(contract.tokenAddress));
    bodyLockingBytecodeParamsMapping[tokenLockingBytecodeHex] = { script: bodyLockScriptName };
  }

  const zippedInputs = zip(transactionBuilder.inputs, libauthTransaction.inputs);
  const inputs = zippedInputs.map(([csInput, libauthInput], inputIndex) => ({
    outpointIndex: libauthInput.outpointIndex,
    outpointTransactionHash: binToHex(libauthInput.outpointTransactionHash),
    sequenceNumber: libauthInput.sequenceNumber,
    unlockingBytecode: generateTemplateScenarioBytecode(csInput, libauthInput, inputIndex, 'p2pkh_placeholder_unlock', slotIndex === inputIndex),
  }));

  const zippedOutputs = zip(transactionBuilder.outputs, libauthTransaction.outputs);
  const outputs = zippedOutputs.map(([csOutput, libauthOutput]) => ({
    lockingBytecode: generateTemplateScenarioTransactionOutputLockingBytecode(
      csOutput, libauthOutput, contract, bodyLockingBytecodeParamsMapping,
    ),
    token: serialiseTokenDetails(libauthOutput.token),
    valueSatoshis: Number(libauthOutput.valueSatoshis),
  }));

  return { inputs, locktime: libauthTransaction.locktime, outputs, version: libauthTransaction.version };
};
