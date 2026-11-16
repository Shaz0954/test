// Tiny Markdown renderer + syntax highlighter (no dependencies).

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const KW = {
  sql: new Set('select from where group by order having limit offset join left right inner outer full cross on as and or not in is null like between distinct case when then else end with over partition rows range unbounded preceding following current row insert into values update set delete create table view index drop alter add primary key references unique if exists union all except intersect asc desc conflict do nothing explain query plan true false using merge matched replace temporary default check foreign'.split(' ')),
  python: new Set('def return if elif else for while in not and or is None True False import from as class try except finally raise with lambda yield pass break continue assert global del async await'.split(' ')),
};
const RX = {
  sql: /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(\s*\()?/g,
  python: /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|[fr]?"(?:[^"\\\n]|\\.)*"|[fr]?'(?:[^'\\\n]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(\s*\()?/g,
  generic: /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|(\b\d+(?:\.\d+)?\b)/g,
};

export function highlight(code, lang) {
  const l = lang === 'py' ? 'python' : lang;
  const rx = RX[l] || (['yaml', 'bash', 'sh', 'toml'].includes(l) ? RX.generic : null);
  if (!rx) return esc(code);
  const kw = KW[l];
  let out = '', last = 0;
  rx.lastIndex = 0;
  for (let m; (m = rx.exec(code)); ) {
    out += esc(code.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1]) out += `<span class="t-com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="t-str">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="t-num">${esc(m[3])}</span>`;
    else if (m[4]) {
      const isKw = kw && kw.has(l === 'sql' ? m[4].toLowerCase() : m[4]);
      const cls = isKw ? 't-kw' : m[5] ? 't-fn' : '';
      out += (cls ? `<span class="${cls}">${esc(m[4])}</span>` : esc(m[4])) + (m[5] || '');
    }
  }
  return out + esc(code.slice(last));
}

export function inline(s) {
  return s.split('`').map((part, i) => {
    if (i % 2) return `<code>${esc(part)}</code>`;
    return esc(part)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
  }).join('');
}

export function renderMD(src) {
  const lines = src.split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m = line.match(/^```(\w*)/))) {
      flush();
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      out.push(`<pre class="code"${m[1] ? ` data-lang="${m[1]}"` : ''}><code>${highlight(code.join('\n'), m[1])}</code></pre>`);
    } else if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
      flush(); out.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`);
    } else if (line.startsWith('|')) {
      flush();
      const rows = [];
      for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i].replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim()));
      i--;
      const head = rows[0], body = rows.slice(/^[-: ]+$/.test(rows[1]?.join('') || '') ? 2 : 1);
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d+\./.test(line), items = [];
      for (; i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length)); i++) {
        if (/^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        else items[items.length - 1] += ' ' + lines[i].trim();
      }
      i--;
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
    } else if (line.startsWith('> ')) {
      flush();
      const quote = [];
      for (; i < lines.length && lines[i].startsWith('> '); i++) quote.push(lines[i].slice(2));
      i--;
      out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
    } else if (!line.trim()) flush();
    else para.push(line.trim());
  }
  flush();
  return out.join('\n');
}
