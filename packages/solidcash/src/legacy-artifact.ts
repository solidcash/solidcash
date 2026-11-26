import { MessageBusArtifactError } from './Errors.js';

/** Refuse an artifact that publishes a message bus (0.52 and earlier) before any of it is used. */
export function refuseMessageBusArtifact(artifact: { readonly contractName?: string }): void {
  if ((artifact as { readonly messageBus?: unknown }).messageBus === undefined) return;
  throw new MessageBusArtifactError(artifact.contractName ?? '(unnamed)');
}
