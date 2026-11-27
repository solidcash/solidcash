/** A call/covenant diagnostic carrying a machine-stable code alongside the human message. */
export class CallDiagnosticError extends Error {
  constructor(public readonly code: string, message: string, public readonly detail?: unknown) {
    super(message);
    this.name = 'CallDiagnosticError';
  }
}
