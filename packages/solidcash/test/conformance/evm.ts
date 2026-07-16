// EVM reference side of the differential conformance harness.
// Compile Solidity with solc (0.8.36, matching the /Code/solidity reference), execute in
// @ethereumjs/evm - a node-less, in-memory EVM (the same engine tevm.sh wraps). No RPC, no network.
import solc from 'solc';
import { AbiCoder, FunctionFragment } from 'ethers';
import { createEVM } from '@ethereumjs/evm';
import { hexToBytes, bytesToHex, createAddressFromString } from '@ethereumjs/util';

const CONTRACT_NAME = 'C';
const SOURCE_KEY = 'C.sol';
const coder = AbiCoder.defaultAbiCoder();
const TARGET = createAddressFromString(`0x${'11'.repeat(20)}`);
const CALLER = createAddressFromString(`0x${'22'.repeat(20)}`);

export interface EvmCompiled {
  abi: ReadonlyArray<Record<string, unknown>>;
  deployedBytecode: string;
}

// Compile a Solidity source string. The contract under test must be named `C`.
export function compileEvm(source: string): EvmCompiled {
  const input = {
    language: 'Solidity',
    sources: { [SOURCE_KEY]: { content: source } },
    settings: {
      optimizer: { enabled: false },
      outputSelection: { '*': { '*': ['abi', 'evm.deployedBytecode.object'] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = ((out.errors ?? []) as Array<{ severity: string; formattedMessage: string }>)
    .filter((e) => e.severity === 'error');
  if (errors.length > 0) {
    throw new Error(`solc errors:\n${errors.map((e) => e.formattedMessage).join('\n')}`);
  }
  const contract = out.contracts?.[SOURCE_KEY]?.[CONTRACT_NAME];
  if (!contract) throw new Error(`contract "${CONTRACT_NAME}" not found - name the test contract "contract C"`);
  return { abi: contract.abi, deployedBytecode: contract.evm.deployedBytecode.object as string };
}

export interface EvmResult {
  decoded: unknown[]; // ABI-decoded return values
  rawReturn: string; // raw returndata, 0x-hex
}

// Execute a pure/view function and return its decoded outputs + raw returndata.
export async function evalEvm(
  compiled: EvmCompiled, fnName: string, args: readonly unknown[] = [],
): Promise<EvmResult> {
  const abiFn = compiled.abi.find((e) => e.type === 'function' && e.name === fnName);
  if (!abiFn) throw new Error(`function "${fnName}" not found in compiled ABI`);
  const frag = FunctionFragment.from(abiFn);
  const inputTypes = frag.inputs.map((i) => i.type);
  const outputTypes = frag.outputs.map((o) => o.type);
  const calldata = frag.selector + coder.encode(inputTypes, args as unknown[]).slice(2);

  const evm = await createEVM();
  await evm.stateManager.putCode(TARGET, hexToBytes(`0x${compiled.deployedBytecode}`));
  const res = await evm.runCall({
    to: TARGET, caller: CALLER, data: hexToBytes(calldata), gasLimit: 1_000_000_000n,
  });
  if (res.execResult.exceptionError) {
    throw new Error(`EVM reverted in ${fnName}(): ${JSON.stringify(res.execResult.exceptionError)}`);
  }
  const rawReturn = bytesToHex(res.execResult.returnValue);
  const decoded = outputTypes.length > 0 ? Array.from(coder.decode(outputTypes, rawReturn)) : [];
  return { decoded, rawReturn };
}
