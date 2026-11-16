// Lesson file format: Markdown plus ":::" directive blocks.
//   :::quiz            ? question / - wrong / + correct / ! explanation
//   :::sql id=.. title=".." [ordered] [twice]     prompt, then @setup @starter @solution @check @hint sections
//   :::python id=.. title=".."                    prompt, then @starter @solution @test @hint sections
//   :::sim <name>
//   :::callout <tip|warn|info>

function parseArgs(s) {
  const args = { _: [] };
  for (const m of s.matchAll(/(\w[\w-]*)(?:=(?:"([^"]*)"|(\S+)))?/g)) {
    if (m[2] !== undefined || m[3] !== undefined) args[m[1]] = m[2] ?? m[3];
    else { args[m[1]] = true; args._.push(m[1]); }
  }
  return args;
}

function sections(body) {
  const out = { prompt: [] };
  let cur = 'prompt';
  for (const line of body) {
    const m = line.match(/^@(\w+)\s*$/);
    if (m) { cur = m[1]; out[cur] = []; } else out[cur].push(line);
  }
  for (const k in out) out[k] = out[k].join('\n').trim();
  return out;
}

function parseQuiz(body) {
  const qs = [];
  let cur = null;
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    const tag = line[0], text = line.slice(1).trim();
    if (tag === '?') { cur = { q: text, options: [], answer: -1, why: '' }; qs.push(cur); }
    else if (!cur) continue;
    else if (tag === '-') cur.options.push(text);
    else if (tag === '+') { cur.answer = cur.options.length; cur.options.push(text); }
    else if (tag === '!') cur.why = text;
    else if (cur.options.length) cur.options[cur.options.length - 1] += ' ' + line;
    else cur.q += ' ' + line;
  }
  return qs;
}

export function parseLesson(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const blocks = [];
  let md = [];
  const flush = () => { if (md.join('').trim()) blocks.push({ type: 'md', text: md.join('\n') }); md = []; };
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('```')) fence = !fence;
    const m = !fence && lines[i].match(/^:::(\w+)\s*(.*)$/);
    if (!m) { md.push(lines[i]); continue; }
    flush();
    const body = [];
    for (i++; i < lines.length && lines[i].trim() !== ':::'; i++) body.push(lines[i]);
    const args = parseArgs(m[2]);
    if (m[1] === 'quiz') blocks.push({ type: 'quiz', questions: parseQuiz(body) });
    else if (m[1] === 'sim') blocks.push({ type: 'sim', name: args._[0] });
    else if (m[1] === 'callout') blocks.push({ type: 'callout', kind: args._[0] || 'info', text: body.join('\n') });
    else if (m[1] === 'sql' || m[1] === 'python')
      blocks.push({ type: m[1], id: args.id, title: args.title || 'Challenge', ordered: !!args.ordered, twice: !!args.twice, ...sections(body) });
  }
  flush();
  return blocks;
}
