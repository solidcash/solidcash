/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { parentPort, workerData } from 'worker_threads';

const { compileFile } = await import(workerData.compilerUrl);
const noop = () => {};
console.log = console.error = console.warn = console.info = noop;

parentPort.on('message', ({ id, file }) => {
  let error = null;
  try {
    compileFile(file, { solidityImportCompat: true });
  } catch (cause) {
    error = `${cause?.name || 'Error'}: ${String(cause?.message).split('\n')[0]}`;
  }
  parentPort.postMessage({ id, error });
});
