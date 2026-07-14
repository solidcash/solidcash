import { readFileSync } from 'fs';
const lines = readFileSync('/tmp/bench-out.txt','utf8').split('\n');
// collect error lines (indented "    ErrName: message")
const errs = lines.filter(l => /^    \w+(Error)?: /.test(l)).map(l => l.trim());
// bucket by error type + normalized message
const norm = (e) => {
  const type = e.split(':')[0];
  let msg = e.slice(type.length+1).trim();
  // normalize: strip "at Line X, Column Y", quote contents kept as-is for tokens
  msg = msg.replace(/ at Line \d+, Column \d+.*/, '');
  return { type, msg };
};
const byType = {};
for (const e of errs) { const {type} = norm(e); byType[type] = (byType[type]||0)+1; }
console.log('=== BY ERROR TYPE ===');
for (const [t,c] of Object.entries(byType).sort((a,b)=>b[1]-a[1])) console.log(`${String(c).padStart(3)}  ${t}`);
console.log('\n=== PARSE ERRORS by normalized message ===');
const parseMsgs = {};
for (const e of errs) { const {type,msg} = norm(e); if (type==='ParseError') parseMsgs[msg]=(parseMsgs[msg]||0)+1; }
for (const [m,c] of Object.entries(parseMsgs).sort((a,b)=>b[1]-a[1])) console.log(`${String(c).padStart(3)}  ${m}`);
console.log('\n=== SEMANTIC/OTHER by normalized message ===');
const semMsgs = {};
for (const e of errs) { const {type,msg} = norm(e); if (type!=='ParseError') semMsgs[`${type}: ${msg}`]=(semMsgs[`${type}: ${msg}`]||0)+1; }
for (const [m,c] of Object.entries(semMsgs).sort((a,b)=>b[1]-a[1])) console.log(`${String(c).padStart(3)}  ${m}`);
