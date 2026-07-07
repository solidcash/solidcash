import {
  SourceFileNode,
  ContractNode,
  FunctionDefinitionNode,
  VariableDefinitionNode,
  IdentifierNode,
  Node,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';

// Whether a name is referenced (as an identifier) anywhere in a subtree.
class ReferenceFinder extends AstTraversal {
  private found = false;

  constructor(private targetName: string) { super(); }

  has(node: Node): boolean {
    this.found = false;
    this.visit(node);
    return this.found;
  }

  visitIdentifier(node: IdentifierNode): Node {
    if (node.name === this.targetName) this.found = true;
    return node;
  }
}

/**
 * Lower `transient` state vars (EIP-1153) to a per-function zero-init local. Runs AFTER inheritance flattening,
 * so a transient var declared in a base contract is lowered into the DERIVED contract's functions too (the base's
 * transient vars are merged onto `contract.transientStateVars` by InheritanceExpansion).
 *
 * BCH has no transaction-scoped contract storage, and one spend = one function execution with no cross-call, so
 * the value simply resets to 0 at the start of each spend (matching transient's zero-at-tx-start semantics) and
 * never persists. Warned per var.
 */
export default function lowerTransientStateVars(ast: SourceFileNode): SourceFileNode {
  lowerContract(ast.contract);
  return ast;
}

function lowerContract(contract: ContractNode): void {
  const transientVars = contract.transientStateVars;
  if (transientVars.length === 0) return;

  const fns = [contract.constructorDef, ...contract.functions, contract.fallbackDef, contract.receiveDef]
    .filter((f): f is FunctionDefinitionNode => !!f);

  for (const tv of transientVars) {
    const at = tv.location ? ` (line ${tv.location.start.line})` : '';
    // eslint-disable-next-line no-console
    console.log(`Warning: transient state variable '${tv.name}'${at} has no UTXO analogue; SolidCash lowers `
      + 'it to a transaction-local (zero at the start of each spend). It does not persist across spends, and '
      + 'cross-call transient state is impossible on BCH (one spend = one execution).');
    for (const fn of fns) {
      if (fn.body && new ReferenceFinder(tv.name).has(fn.body)) {
        const local = new VariableDefinitionNode(tv.type, [], tv.name);
        local.allowUnused = true;
        local.location = tv.location;
        fn.body.statements = [local, ...(fn.body.statements ?? [])];
      }
    }
  }
}
