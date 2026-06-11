import { Contract, MockNetworkProvider, SignatureTemplate, TransactionBuilder, randomUtxo } from './dist/index.js';
import TransferWithTimeout from './test/fixture/transfer_with_timeout.artifact.js';
import { alicePub, bobPub, bobPriv } from './test/fixture/vars.js';

const provider = new MockNetworkProvider();
const contract = new Contract(TransferWithTimeout, [alicePub, bobPub, 100000n], { provider });
const contractUtxo = randomUtxo();
provider.addUtxo(contract.address, contractUtxo);

const tx = new TransactionBuilder({ provider })
  .addInput(contractUtxo, contract.unlock.transfer(new SignatureTemplate(bobPriv)))
  .addOutput({ to: contract.address, amount: 10000n });

const template = await tx.template();
const lockScriptKey = Object.keys(template.scripts).find(k => k.includes('_lock') && !k.includes('body'));
const lockScript = template.scripts[lockScriptKey];
const scriptStr = lockScript.script;
const bytecodeStart = scriptStr.indexOf('// bytecode\n');
if (bytecodeStart >= 0) {
  const bytecodeSection = scriptStr.substring(bytecodeStart + 12);
  const firstLine = bytecodeSection.substring(0, bytecodeSection.indexOf('\n'));
  const spaces = firstLine.length - firstLine.trimStart().length;
  console.log('First bytecode line spaces:', spaces);
  console.log('First bytecode line first 90 chars:', JSON.stringify(firstLine.substring(0, 90)));
}

// Also check sourceOutputs
const scenarios = template.scenarios;
for (const [name, scenario] of Object.entries(scenarios)) {
  if (scenario.sourceOutputs && scenario.sourceOutputs.length > 0) {
    const first = scenario.sourceOutputs[0];
    console.log(`\nScenario ${name} sourceOutput[0]:`, JSON.stringify(first));
    break;
  }
}
