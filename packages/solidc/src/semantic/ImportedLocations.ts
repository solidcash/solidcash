import { LocationI } from '@solidcash/utils';
import { Node, SourceFileNode } from '../ast/AST.js';
import { generatedOriginOf, sourceFileOf } from '../ast/Location.js';

/**
 * Labels a diagnostic position with the imported file that actually declares it.
 *
 * A `Location` carries no file identity, so a diagnostic printing a bare `at line N` cites a line that is real in
 * an IMPORTED file and impossible in the file the user named (`ERC20Mock.sol` is 15 lines and reports `line 170`,
 * which is SafeMath.sol's). Keyed on the Location INSTANCE, not the node: lowering passes clone nodes but carry
 * the same Location by reference, so a clone still resolves.
 *
 * Two load-bearing ordering rules: built deepest-import-first and first-write-wins, so the file that actually
 * holds the line claims it rather than a shallower importer that only re-exports it. A specific false label is
 * worse than none.
 *
 * Single home for the mapping, shared by every traversal that reports a position. Two copies of these ordering
 * rules would drift, and one of them would then be the wrong one.
 */
export class ImportedLocations {
  // Location instance -> import path of the file that declares it. Built lazily: a compilation whose
  // diagnostics all point into the user's own file pays nothing.
  private map?: Map<object, string>;

  constructor(private root?: SourceFileNode, private rootFileId: string = '') {}

  /**
   * ` at line N` for a diagnostic, naming the imported file when line N is not in the file being compiled.
   *
   * X92. A position can be both generated and imported-looking, and GENERATED WINS. The imported label asserts
   * "line N is real in file F on disk"; a generated position is in a string that exists only inside the compiler,
   * so no file holds it and the imported label would be a SPECIFIC FALSE label naming a real file.
   */
  diagLine(location?: LocationI): string {
    const line = location?.start?.line;
    if (line === undefined) return '';
    const generated = generatedOriginOf(location);
    if (generated) return ` at line ${line} of ${generated}, not of your file`;
    const file = this.fileOf(location);
    return file ? ` at line ${line} of imported "${file}"` : ` at line ${line}`;
  }

  /** The import path declaring `location`, or undefined when it belongs to the root file being compiled. */
  fileOf(location?: LocationI): string | undefined {
    if (!location) return undefined;
    // X107. The parse stamped the file whose text it was reading; that is exact, needs no root and no ordering
    // rule, and cannot name a re-exporting intermediate. The reachability map below stays as the fallback for
    // positions built outside a parse.
    const stamped = sourceFileOf(location);
    if (stamped) return stamped;
    if (!this.root?.imports?.length) return undefined;
    this.map ??= this.build();
    return this.map.get(location as unknown as object);
  }

  private build(): Map<object, string> {
    const map = new Map<object, string>();
    const root = this.root;
    if (!root) return map;
    const seen = new Set<object>();
    const claim = (n: unknown, path: string): void => {
      if (!n || typeof n !== 'object' || seen.has(n as object)) return;
      seen.add(n as object);
      if (n instanceof Node && n.location && !map.has(n.location)) map.set(n.location, path);
      for (const value of Object.values(n as Record<string, unknown>)) {
        if (Array.isArray(value)) { for (const element of value) claim(element, path); } else claim(value, path);
      }
    };
    // Resolve a relative import path against the importing file's directory so the label is usable from the
    // root file (ERC20.sol's `../../math/SafeMath.sol` prints as `@openzeppelin/contracts/math/SafeMath.sol`).
    const resolvePath = (parent: string, child: string): string => {
      if (!child.startsWith('.')) return child;
      const cut = parent.lastIndexOf('/');
      const out = (cut > 0 ? parent.slice(0, cut) : '').split('/').filter((s) => s !== '');
      for (const seg of child.split('/')) {
        if (seg === '.' || seg === '') continue;
        if (seg === '..') out.pop();
        else out.push(seg);
      }
      // Reconstructs the resolver's canonical id, which the AST does not carry.
      return (parent.startsWith('/') ? '/' : '') + out.join('/');
    };
    const done = new Set<SourceFileNode>();
    const walkImports = (file: SourceFileNode, filePath: string, depth: number): void => {
      if (done.has(file) || depth > 24) return;
      done.add(file);
      for (const imported of file.imports ?? []) {
        if (!imported.resolvedAst) continue;
        const path = resolvePath(filePath, imported.path);
        walkImports(imported.resolvedAst, path, depth + 1);
        // Only the file's own declaration roots: the merged arrays also hold its imports' nodes, which the
        // recursion above has already claimed under their own paths.
        const ast = imported.resolvedAst as unknown as Record<string, unknown>;
        for (const key of ['contract', 'libraryContract', 'constantDefinitions', 'enumDefinitions',
          'structDefinitions', 'typeDefinitions', 'errorDefinitions', 'eventDefinitions',
          'interfaceDefinitions', 'freeFunctions', 'usingForDirectives']) {
          claim(ast[key], path);
        }
      }
    };
    walkImports(root, this.rootFileId, 0);
    return map;
  }
}
