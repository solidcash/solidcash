// Repro: UniswapV2Factory.pairCodeHash() - a pure view returning keccak256(type(UniswapV2Pair).creationCode).
const { ethers } = globalThis.hre;
const [alice] = await ethers.getSigners();

const Factory = await ethers.getContractFactory('UniswapV2Factory');
const factory = await Factory.deploy(alice.address);
console.log('factory at', factory.address);
try {
  const h = await factory.pairCodeHash();
  console.log('PAIRCODEHASH OK', h);
} catch (e) {
  console.log('PAIRCODEHASH FAILED:', String(e?.message ?? e).slice(0, 400));
}
