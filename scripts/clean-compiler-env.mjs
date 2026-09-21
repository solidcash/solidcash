// Authoritative compile measurements must not inherit diagnostic or codegen switches.
export const cleanCompilerEnvironment = (environment = process.env) =>
  Object.fromEntries(Object.entries(environment).filter(([name]) => !name.startsWith('SOLIDC_')));
