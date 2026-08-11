import fs from 'fs';
import path from 'path';
import { compileString } from '../packages/solidc/src/index.js';
import { formatArtifact } from '../packages/utils/src/index.js';
import childFixture from '../packages/solidcash/test/fixture/fold_child.artifact.js';
import factoryFixture from '../packages/solidcash/test/fixture/fold_factory.artifact.js';

const fixtureDir = path.resolve('packages/solidcash/test/fixture');
const childFile = path.join(fixtureDir, 'fold_child.artifact.ts');
const factoryFile = path.join(fixtureDir, 'fold_factory.artifact.ts');

const childSource = childFixture.source;
const factorySource = factoryFixture.source.replace(') deploy {', ') {');
const child = compileString(childSource, { messageBus: false, forceStateful: true });
const factory = compileString(factorySource, {
  messageBus: false, forceStateful: true,
  rootFileId: '/main.scash',
  importResolver: (specifier, currentFile) => {
    const directory = currentFile.slice(0, currentFile.lastIndexOf('/') + 1);
    const resolved = directory + specifier.replace('./', '');
    return resolved === '/fold_child.scash' ? { source: childSource, id: resolved } : undefined;
  },
});

delete (child as { updatedAt?: string }).updatedAt;
delete (factory as { updatedAt?: string }).updatedAt;
fs.writeFileSync(childFile, formatArtifact(child, 'ts'));
fs.writeFileSync(factoryFile, formatArtifact(factory, 'ts'));
