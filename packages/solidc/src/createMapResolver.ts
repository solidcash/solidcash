import { ResolvedImport } from '@solidcash/utils';

function normalizePath(p: string): string {
  const parts = p.split('/');
  const result: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..' && result.length > 0 && result[result.length - 1] !== '..') {
      result.pop();
    } else {
      result.push(part);
    }
  }
  return result.join('/');
}

function tryResolve(files: Record<string, string>, key: string): ResolvedImport | undefined {
  const resolved = key.endsWith('.scash') ? key : key + '.scash';
  const source = files[resolved];
  if (source === undefined) return undefined;
  return { source, id: resolved };
}

export function createMapResolver(
  files: Record<string, string>,
): (importPath: string, currentFile: string) => ResolvedImport | undefined {
  return (importPath: string, currentFile: string) => {
    const isRelative = importPath.startsWith('./') || importPath.startsWith('../');

    if (isRelative) {
      const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
      return tryResolve(files, normalizePath(dir + importPath));
    }

    // Non-relative: look up directly (npm-style key in dictionary)
    return tryResolve(files, importPath);
  };
}
