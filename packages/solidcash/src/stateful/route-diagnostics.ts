/** A route/covenant diagnostic carrying a machine-stable code alongside the human message. */
export class RouteDiagnosticError extends Error {
  constructor(public readonly code: string, message: string, public readonly detail?: unknown) {
    super(message);
    this.name = 'RouteDiagnosticError';
  }
}
