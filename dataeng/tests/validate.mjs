// Validates every lesson: quizzes are well-formed, every SQL/Python reference
// solution passes its own check, and no starter passes by accident.
// Usage: node tests/validate.mjs   (Python checks need python3 on PATH)
import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initSQL, checkChallenge } from '../js/db.js';
import { parseLesson } from '../js/parser.js';
import { LESSONS } from '../js/data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
await initSQL(require(join(root, 'vendor/sql-wasm.js')), (f) => join(root, 'vendor', f));
const tmp = mkdtempSync(join(tmpdir(), 'dataeng-'));
const py = (code) => { const f = join(tmp, 't.py'); writeFileSync(f, code); return spawnSync('python3', [f], { encoding: 'utf8' }); };

let fails = 0;
const count = { sql: 0, python: 0, quiz: 0 };
const ids = new Set();
const fail = (where, msg) => { fails++; console.error(`✗ ${where}: ${msg}`); };
const passes = (ch, sql) => { try { return checkChallenge(ch, sql); } catch (e) { return { ok: false, msg: String(e.message || e) }; } };

for (const lesson of LESSONS) {
  const blocks = parseLesson(readFileSync(join(root, lesson.file), 'utf8'));
  if (!blocks.some((b) => b.type === 'quiz')) fail(lesson.id, 'no quiz');
  for (const b of blocks) {
    const where = `${lesson.id}/${b.id || b.type}`;
    if (b.type === 'sql' || b.type === 'python') {
      if (!b.id || ids.has(b.id)) fail(where, 'missing or duplicate id');
      ids.add(b.id);
      if (!b.prompt || !b.solution || !b.hint) fail(where, 'needs prompt, solution and hint');
    }
    if (b.type === 'quiz') {
      for (const q of b.questions) {
        count.quiz++;
        if (q.answer < 0 || q.options.length < 3 || !q.why) fail(where, `malformed question: ${q.q}`);
      }
    } else if (b.type === 'sql') {
      count.sql++;
      const r = passes(b, b.solution);
      if (!r.ok) fail(where, `solution does not pass: ${r.msg}`);
      if (b.starter && passes(b, b.starter).ok) fail(where, 'starter already passes');
    } else if (b.type === 'python') {
      count.python++;
      const ok = py(`${b.solution}\n\n${b.test}\n`);
      if (ok.status !== 0) fail(where, `solution fails its test:\n${ok.stderr}`);
      if (py(`${b.starter}\n\n${b.test}\n`).status === 0) fail(where, 'starter already passes');
    }
  }
}
console.log(`${LESSONS.length} lessons · ${count.sql} SQL challenges · ${count.python} Python challenges · ${count.quiz} quiz questions`);
if (fails) { console.error(`${fails} problem(s) found`); process.exit(1); }
console.log('✓ all content valid');
