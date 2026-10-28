/* global hre */
// Run by `solidhat run scripts/deploy.ts --network localhost` inside this directory.
//
// Prints the CREATE nonce it read, the address it predicts, and the address the deployment produced, so the
// cross-process acceptance test can check nonce 0 → 1 and that `getNonce()` + `getCreateAddress` predicts a fresh
// process's deployment.
const runtime = (globalThis as {
  hre?: {
    ethers: {
      getSigners(count?: number): Promise<{ address: string; getNonce(): Promise<number> }[]>;
      getCreateAddress(tx: { from: string; nonce: number }): string;
      getContractFactory(artifact: unknown, signer: unknown): {
        deploy(): Promise<{ getAddress(): Promise<string> }>;
      };
    };
  };
}).hre;

try {
  const { compileString } = await import('@solidcash/solidc');
  if (runtime?.ethers === undefined) throw new Error('run through `solidhat run --network localhost`');

  const [signer] = await runtime.ethers.getSigners(1);
  const nonce = await signer.getNonce();
  const predicted = runtime.ethers.getCreateAddress({ from: signer.address, nonce });
  console.log(`NONCE ${nonce}`);
  console.log(`PREDICTED ${predicted}`);

  const artifact = compileString(
    'contract DevnetSimple() { int public counter; function increment() { this.counter = this.counter + 1; require(true); } }',
    { composition: 'direct' },
  );
  const deployed = await runtime.ethers.getContractFactory(artifact, signer).deploy();
  console.log(`DEPLOYED ${await deployed.getAddress()}`);
} catch (error) {
  console.error('DEPLOY ERROR', error);
  process.exitCode = 1;
}
