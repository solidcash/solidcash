import { ContractNode, InterfaceNode, SourceFileNode } from '../ast/AST.js';
import { FunctionType, Type } from '@solidcash/utils';

type Method = { parameters: { name: string; type: Type }[]; returnTypes?: Type[] };

/**
 * The interfaces and contracts a foreign function value `IFace(a).method` names, and whether such a member has a
 * function type: it must name one method another contract can call, taking the type's parameters and returning its
 * results. A call through the value binds those arguments only, so any other method would leave some to the spender.
 */
export default class ForeignMemberTypes {
  private owners = new Map<string, InterfaceNode | ContractNode>();

  constructor(source: SourceFileNode) {
    const owners = [...source.interfaceDefinitions as InterfaceNode[], ...source.importedContracts as ContractNode[],
      ...(source.contract ? [source.contract] : [])];
    for (const owner of owners) this.owners.set(owner.name, owner);
  }

  /** Whether `name` is an interface or contract a member `name(a).method` names. */
  knows(name: string): boolean {
    return this.owners.has(name);
  }

  /** True when `iface.method` names one method taking the parameters, and returning the results, of `type`. */
  fits(member: { iface: string; method: string }, type: FunctionType): boolean {
    const same = (a: Type[], b: Type[]): boolean => a.length === b.length
      && a.every((item, at) => item.toString() === b[at]!.toString());
    const owner = this.owners.get(member.iface);
    return (owner ? this.methodsNamed(owner, member.method) : []).filter((fn) => same(fn.parameters
      .filter((parameter) => !parameter.name.startsWith('__internal__')).map((parameter) => parameter.type),
    type.parameterTypes) && same(fn.returnTypes ?? [], type.returnTypes)).length === 1;
  }

  /**
   * The methods another contract can call on `owner` by `name`, its parent interfaces' included, one per signature
   * (an interface's own declaration overrides a parent's).
   */
  private methodsNamed(owner: InterfaceNode | ContractNode, name: string, seen = new Set<string>()): Method[] {
    if (seen.has(owner.name)) return [];
    seen.add(owner.name);
    const own: Method[] = owner instanceof InterfaceNode ? owner.functions.filter((fn) => fn.name === name)
      : owner.functions.filter((fn) => fn.name === name && fn.isEntryPoint);
    const inherited = owner instanceof InterfaceNode ? owner.parents.flatMap((parent) => {
      const declared = this.owners.get(parent);
      return declared ? this.methodsNamed(declared, name, seen) : [];
    }) : [];
    const bySignature = new Map<string, Method>();
    const signature = (fn: Method): string => fn.parameters.map((parameter) => parameter.type.toString()).join(',');
    for (const fn of [...inherited, ...own]) bySignature.set(signature(fn), fn);
    return [...bySignature.values()];
  }
}
