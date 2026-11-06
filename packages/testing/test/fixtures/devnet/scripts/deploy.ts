const runtime = (globalThis as { hre?: any }).hre;
console.error('SCRIPT START', runtime?.network?.name, runtime?.network?.config?.type);
try {
  const provider = runtime.ethers.provider;
  console.error('provider', provider?.constructor?.name, provider?.network);
  const signers = await runtime.ethers.getSigners(1);
  console.error('signers', signers.length, signers[0].getAddress());
  const { compileString } = await import('@solidcash/solidc');
  const artifact = compileString(
    'contract DevnetSimple() { int public counter; function increment() { this.counter = this.counter + 1; require(true); } }',
    { composition: 'direct' },
  );
  console.error('compiled');
  const deployed = await runtime.ethers.getContractFactory(artifact, signers[0]).deploy();
  const address = await deployed.getAddress();
  console.log(`DEPLOYED ${address}`);
} catch (error) {
  console.error('DEPLOY ERROR', error);
  process.exitCode = 1;
}
