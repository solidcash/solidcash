/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { parentPort, workerData } from 'worker_threads';

const { compileFile } = await import(workerData.compilerUrl);
const noop = () => {};
console.log = console.error = console.warn = console.info = noop;

parentPort.on('message', ({ id, file }) => {
  let error = null;
  try {
    // This bench measures language/source conformance on UNMODIFIED upstream Solidity, so the compiler's
    // covenant-safety policy is stated explicitly: the final-require rule guards a CashScript spending path
    // and is exercised by the solidc suite and the application benches, not by a conformance sweep.
    compileFile(file, { evmCompat: true, enforceFinalRequire: false });
  } catch (cause) {
    error = `${cause?.name || 'Error'}: ${String(cause?.message).split('\n')[0]}`;
  }
  parentPort.postMessage({ id, error });
});
