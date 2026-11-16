// App shell: boot, routing, dashboard, lesson pages, mock interview, glossary, search palette.
import { TIERS, LESSONS, SIMS, BADGES, GLOSSARY } from './data.js';
import { state, save, onChange, level, resetAll } from './state.js';
import { parseLesson } from './parser.js';
import { renderMD, esc } from './md.js';
import { initSQL } from './db.js';
import { el, icon, rawIcon, registerLessons, lessonById, lessonProgress, challengesOf, quizOf, tierLessons, recordQuiz, addXP, commit } from './game.js';
import { sqlChallenge, pyChallenge, sqlLab, pyLab } from './labs.js';
import { mountSim } from './sims.js';
import { mountQuiz } from './quiz.js';

const main = document.getElementById('main');
const tierOf = (id) => TIERS.find((t) => t.id === id);
const nextLesson = () => LESSONS.find((l) => !state.done[l.id]);
let cleanups = [];

// ---- sidebar --------------------------------------------------------------
function paintChrome() {
  const [, route = '', arg] = location.hash.split('/');
  const lessonTier = route === 'lesson' ? lessonById(arg)?.tier : null;
  const link = (href, ic, label, active, extra = '') => `<a href="${href}" class="${active ? 'active' : ''}">${ic}${label}${extra}</a>`;
  document.getElementById('nav').innerHTML =
    link('#/', icon('home'), 'Dashboard', route === '') +
    '<div class="nav-label">Learning path</div>' +
    TIERS.map((t) => { const ls = tierLessons(t.id), d = ls.filter((l) => state.done[l.id]).length; return `<a href="#/tier/${t.id}" data-tier="${t.id}" class="${lessonTier === t.id || (route === 'tier' && arg === t.id) ? 'active' : ''}"><span class="dot"></span>${t.name}<span class="count">${d}/${ls.length}</span></a>`; }).join('') +
    '<div class="nav-label">Practice</div>' +
    link('#/sql', icon('db'), 'SQL Lab', route === 'sql') + link('#/python', icon('code'), 'Python Lab', route === 'python') +
    link('#/sims', icon('activity'), 'Simulators', route === 'sims') + link('#/exam', icon('target'), 'Mock Interview', route === 'exam') +
    link('#/glossary', icon('list'), 'Glossary', route === 'glossary');
  const lv = level();
  document.getElementById('level-card').innerHTML = `<div class="lv">Level ${lv.index}</div><div class="title">${lv.title}</div><div class="bar"><i style="width:${lv.pct * 100}%"></i></div><div class="meta"><span>${state.xp} XP</span><span>${lv.next ? `${lv.next - state.xp} to next` : 'Max level'}</span></div>`;
  document.getElementById('theme-btn').innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon') + (state.theme === 'dark' ? 'Light' : 'Dark');
  document.documentElement.dataset.theme = state.theme;
}

// ---- dashboard ------------------------------------------------------------
function lessonCard(l) {
  const p = lessonProgress(l);
  return `<a class="card lesson-card" data-tier="${l.tier}" href="#/lesson/${l.id}"><div class="top"><span class="n">${String(l.n).padStart(2, '0')}</span><span>${l.mins} min</span>${p.complete ? `<span class="done-mark">${rawIcon('check')}</span>` : ''}</div><h3>${esc(l.title)}</h3><p>${esc(l.summary)}</p><div class="foot"><div class="bar"><i style="width:${(p.done / p.total) * 100}%"></i></div><span>${p.done}/${p.total}</span></div></a>`;
}
function tierSection(t, i) {
  const ls = tierLessons(t.id), d = ls.filter((l) => state.done[l.id]).length;
  return `<div class="section-head" data-tier="${t.id}" id="tier-${t.id}"><div class="tier-head"><span class="num">${i + 1}</span><h2>${t.name}</h2><span class="chip">${t.tag}</span></div><p>${t.desc}</p><span class="right">${d} / ${ls.length} complete</span></div><div class="grid">${ls.map(lessonCard).join('')}</div>`;
}

function dashboard(root, focusTier) {
  const done = LESSONS.filter((l) => state.done[l.id]).length, pct = done / LESSONS.length, next = nextLesson(), lv = level();
  const C = 2 * Math.PI * 62, started = state.xp > 0;
  const solved = Object.keys(state.solved).length, totalCh = LESSONS.reduce((a, l) => a + challengesOf(l).length, 0);
  root.innerHTML = `
    <section class="hero"><div><span class="eyebrow">Interactive course · runs entirely in your browser</span>
      <h1>${started ? `Welcome back, <em>${lv.title}</em>` : 'Learn data engineering <em>by doing</em>'}</h1>
      <p>Go from your first <code>SELECT</code> to designing production data platforms. Real SQL and Python in the browser, five interactive simulators, ${LESSONS.length} lessons and a quiz after every one.</p>
      <div class="cta">${next ? `<a class="btn primary lg" href="#/lesson/${next.id}">${started ? 'Continue' : 'Start learning'}: ${esc(next.title)} ${icon('arrow')}</a>` : `<a class="btn primary lg" href="#/exam">Course complete — take the mock interview ${icon('arrow')}</a>`}<a class="btn lg" href="#/sql">Open SQL Lab</a></div></div>
      <div class="ring"><svg width="150" height="150" viewBox="0 0 150 150"><defs><linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient></defs><circle class="track" cx="75" cy="75" r="62"/><circle class="fill" cx="75" cy="75" r="62" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg><div class="label"><div><b>${Math.round(pct * 100)}%</b><br><span>complete</span></div></div></div>
    </section>
    <div class="stats">
      <div class="card stat">${icon('bolt')}<div><b>${state.xp}</b><span>XP · Level ${lv.index}</span></div></div>
      <div class="card stat">${icon('book')}<div><b>${done} / ${LESSONS.length}</b><span>Lessons completed</span></div></div>
      <div class="card stat">${icon('code')}<div><b>${solved} / ${totalCh}</b><span>Challenges solved</span></div></div>
      <div class="card stat">${icon('flame')}<div><b>${state.streak.count} day${state.streak.count === 1 ? '' : 's'}</b><span>Learning streak</span></div></div>
    </div>
    ${TIERS.map(tierSection).join('')}
    <div class="section-head"><h2>Practice tools</h2><p>Explore freely — no grades.</p></div>
    <div class="grid">
      <a class="card tool-card" href="#/sql">${icon('db')}<div><h3>SQL Lab</h3><p>A real database with an e-commerce dataset. Query anything.</p></div></a>
      <a class="card tool-card" href="#/python">${icon('code')}<div><h3>Python Lab</h3><p>CPython in the browser for ETL scripts and experiments.</p></div></a>
      <a class="card tool-card" href="#/sims">${icon('activity')}<div><h3>Simulators</h3><p>DAG runs, Kafka lag, scan cost, SCD2 and Spark skew.</p></div></a>
      <a class="card tool-card" href="#/exam">${icon('target')}<div><h3>Mock Interview</h3><p>15 timed questions drawn from the whole course.</p></div></a>
    </div>
    <div class="section-head"><h2>Badges</h2><span class="right">${Object.keys(state.badges).length} / ${BADGES.length} earned</span></div>
    <div class="badges">${BADGES.map((b) => `<div class="card badge ${state.badges[b.id] ? 'earned' : ''}">${icon('award')}<div><b>${b.name}</b><span>${b.desc}</span></div></div>`).join('')}</div>`;
  if (focusTier) requestAnimationFrame(() => document.getElementById('tier-' + focusTier)?.scrollIntoView({ block: 'start' }));
}

// ---- lesson ---------------------------------------------------------------
function lessonView(root, id) {
  const lesson = lessonById(id);
  if (!lesson) return notFound(root);
  const tier = tierOf(lesson.tier), idx = LESSONS.indexOf(lesson), prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
  const wasComplete = !!state.done[lesson.id];
  root.innerHTML = `<div class="lesson" data-tier="${lesson.tier}"><article class="lesson-body">
      <div class="crumbs"><a href="#/">Dashboard</a><span>/</span><a href="#/tier/${tier.id}">${tier.name}</a><span>/</span><span>Lesson ${lesson.n} of ${LESSONS.length}</span></div>
      <span class="chip">${tier.name} · ${lesson.mins} min</span><h1 class="lesson-title">${esc(lesson.title)}</h1><p class="lesson-sub">${esc(lesson.summary)}</p>
      <div class="blocks"></div><div class="done-slot"></div>
      <div class="lesson-nav">${prev ? `<a class="btn" href="#/lesson/${prev.id}">${icon('back')} ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="btn primary" href="#/lesson/${next.id}">${esc(next.title)} ${icon('arrow')}</a>` : `<a class="btn primary" href="#/exam">Take the mock interview ${icon('arrow')}</a>`}</div>
    </article><aside class="lesson-aside"><div class="card checklist"></div></aside></div>`;
  const blocks = root.querySelector('.blocks');
  for (const b of lesson.blocks) {
    if (b.type === 'md') blocks.appendChild(el(`<div class="prose">${renderMD(b.text)}</div>`));
    else if (b.type === 'callout') blocks.appendChild(el(`<div class="callout ${b.kind}">${icon(b.kind === 'warn' ? 'alert' : b.kind === 'tip' ? 'bulb' : 'info')}<div class="prose">${renderMD(b.text)}</div></div>`));
    else if (b.type === 'sql') blocks.appendChild(sqlChallenge(b));
    else if (b.type === 'python') blocks.appendChild(pyChallenge(b));
    else if (b.type === 'sim') cleanups.push(mountSim(b.name, blocks));
    else if (b.type === 'quiz') {
      const best = state.quiz[lesson.id]?.best;
      cleanups.push(mountQuiz(blocks, b.questions.map((q, i) => ({ ...q, index: i })), {
        title: `Quiz: ${lesson.title}${best !== undefined ? ` · best ${Math.round(best * 100)}%` : ''}`,
        onDone: (results) => { recordQuiz(lesson.id, results); },
      }));
    }
  }
  const paintSide = () => {
    const p = lessonProgress(lesson), ch = challengesOf(lesson);
    root.querySelector('.checklist').innerHTML = `<h4>Lesson checklist</h4>${ch.map((c) => `<a href="#" data-goto="ch-${c.id}" class="${state.solved[c.id] ? 'done' : ''}"><span class="tick">${rawIcon('check')}</span>${esc(c.title)}</a>`).join('')}<a href="#" data-goto="quiz" class="${state.quiz[lesson.id]?.passed ? 'done' : ''}"><span class="tick">${rawIcon('check')}</span>Pass the quiz (70%)</a><div class="bar"><i style="width:${(p.done / p.total) * 100}%"></i></div><span class="muted" style="font-size:12.5px">${p.done} of ${p.total} done${p.complete ? ' · complete' : ''}</span>`;
    root.querySelector('.done-slot').innerHTML = p.complete ? `<div class="complete-banner">${icon('check')}<div><b>Lesson complete${wasComplete ? '' : ' — nice work!'}</b><br><span class="muted">${next ? `Up next: ${esc(next.title)}` : 'You have finished the course. Try the mock interview.'}</span></div></div>` : '';
  };
  root.querySelector('.checklist').addEventListener('click', (e) => { const a = e.target.closest('[data-goto]'); if (a) { e.preventDefault(); document.getElementById(a.dataset.goto)?.scrollIntoView({ block: 'start' }); } });
  paintSide();
  cleanups.push(onChangeScoped(paintSide));
}

// ---- simulators -----------------------------------------------------------
function simsView(root, id) {
  const sim = SIMS.find((s) => s.id === id);
  if (!sim) {
    root.innerHTML = `<div class="page-head"><span class="eyebrow">Practice</span><h1>Simulators</h1><p>Some ideas only click when you can poke them. Each simulator models one core concept — change the inputs and watch the system react.</p></div>
      <div class="grid">${SIMS.map((s) => `<a class="card tool-card" href="#/sims/${s.id}">${icon('activity')}<div><h3>${s.name}${state.sims[s.id] ? ' <span class="chip ok">tried</span>' : ''}</h3><p>${s.desc}</p></div></a>`).join('')}</div>`;
    return;
  }
  const lesson = lessonById(sim.lesson);
  root.innerHTML = `<div class="page-head"><div class="crumbs"><a href="#/sims">Simulators</a><span>/</span><span>${sim.name}</span></div><h1>${sim.name}</h1><p>${sim.desc} Learn the theory in <a href="#/lesson/${lesson.id}">${esc(lesson.title)}</a>.</p></div><div class="slot"></div>`;
  cleanups.push(mountSim(sim.id, root.querySelector('.slot')));
}

// ---- mock interview -------------------------------------------------------
function examView(root) {
  const pool = LESSONS.flatMap((l) => (quizOf(l)?.questions || []).map((q) => ({ ...q, tier: l.tier, tag: tierOf(l.tier).name })));
  const N = 15, MINUTES = 12;
  const intro = () => {
    const best = state.exams.reduce((m, e) => Math.max(m, e.score), 0);
    root.innerHTML = `<div class="page-head"><span class="eyebrow">Assessment</span><h1>Mock Interview</h1><p>${N} questions drawn at random from all ${pool.length} in the course — every tier from foundations to system design. You have ${MINUTES} minutes. Score 80% or more to earn the <b>Interview Ready</b> badge.</p></div>
      <div class="card" style="padding:22px;max-width:640px"><div class="kpis"><div class="kpi"><span>Attempts</span><b>${state.exams.length}</b></div><div class="kpi ${best >= 0.8 ? 'good' : ''}"><span>Best score</span><b>${state.exams.length ? Math.round(best * 100) + '%' : '—'}</b></div><div class="kpi"><span>Pass mark</span><b>80%</b></div></div>
      <button class="btn primary lg" data-start>${icon('play')} Start interview</button>
      ${state.exams.length ? `<h4 style="margin:22px 0 8px" class="eyebrow">Recent attempts</h4>${state.exams.slice(-5).reverse().map((e) => `<div class="muted" style="display:flex;justify-content:space-between;padding:4px 0"><span>${new Date(e.date).toLocaleString()}</span><b style="color:var(--${e.score >= 0.8 ? 'ok' : 'text'})">${Math.round(e.score * 100)}%</b></div>`).join('')}` : ''}</div>`;
    root.querySelector('[data-start]').onclick = start;
  };
  const start = () => {
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, N);
    root.innerHTML = '<div class="page-head"><span class="eyebrow">Assessment</span><h1>Mock Interview</h1></div><div class="slot" style="max-width:820px"></div>';
    cleanups.push(mountQuiz(root.querySelector('.slot'), picked, {
      title: 'Mock interview', passMark: 0.8, timer: MINUTES * 60, onRetry: intro,
      onDone: (results, score) => {
        state.exams.push({ date: Date.now(), score });
        addXP(results.filter((r) => r.correct).length * 5, 'Mock interview');
        commit();
        return `<div class="breakdown">${TIERS.map((t) => { const rs = results.filter((r) => r.q.tier === t.id); return rs.length ? `<div class="card" data-tier="${t.id}"><span class="chip">${t.name}</span><b>${rs.filter((r) => r.correct).length} / ${rs.length}</b></div>` : ''; }).join('')}</div>`;
      },
    }));
  };
  intro();
}

// ---- glossary -------------------------------------------------------------
function glossaryView(root, q = '') {
  root.innerHTML = `<div class="page-head"><span class="eyebrow">Reference</span><h1>Glossary</h1><p>${GLOSSARY.length} terms every data engineer should be able to explain in one sentence.</p></div><input class="search-input" type="search" placeholder="Filter terms…" value="${esc(decodeURIComponent(q))}" aria-label="Filter glossary"><div class="glossary"></div>`;
  const input = root.querySelector('input'), list = root.querySelector('.glossary');
  const paint = () => {
    const f = input.value.trim().toLowerCase(), hits = GLOSSARY.filter((g) => !f || g.term.toLowerCase().includes(f) || g.def.toLowerCase().includes(f));
    list.innerHTML = hits.map((g) => `<div class="card term"><b>${esc(g.term)}</b><p>${esc(g.def)}</p></div>`).join('') || '<p class="muted">No matching terms.</p>';
  };
  input.oninput = paint;
  paint();
}

function notFound(root) {
  root.innerHTML = `<div class="page-head"><h1>Page not found</h1><p>That page does not exist. <a href="#/">Back to the dashboard</a>.</p></div>`;
}

// ---- router ---------------------------------------------------------------
let scoped = new Set();
onChange(() => { paintChrome(); scoped.forEach((fn) => fn()); });
function onChangeScoped(fn) { scoped.add(fn); return () => scoped.delete(fn); }

const ROUTES = { '': (r) => dashboard(r), tier: (r, a) => dashboard(r, a), lesson: lessonView, sql: (r) => cleanups.push(sqlLab(r)), python: pyLab, sims: simsView, exam: examView, glossary: glossaryView };
function route() {
  cleanups.forEach((fn) => typeof fn === 'function' && fn());
  cleanups = [];
  const [, name = '', arg] = location.hash.split('/');
  main.innerHTML = '';
  window.scrollTo(0, 0);
  (ROUTES[name] || notFound)(main, arg);
  document.body.classList.remove('menu-open');
  paintChrome();
}

// ---- command palette ------------------------------------------------------
function setupPalette() {
  const box = document.getElementById('palette'), input = document.getElementById('palette-input'), list = document.getElementById('palette-list');
  const items = [
    ...LESSONS.map((l) => ({ label: l.title, kind: `${tierOf(l.tier).name} lesson`, href: `#/lesson/${l.id}`, text: l.summary })),
    { label: 'SQL Lab', kind: 'Tool', href: '#/sql' }, { label: 'Python Lab', kind: 'Tool', href: '#/python' }, { label: 'Mock Interview', kind: 'Tool', href: '#/exam' }, { label: 'Dashboard', kind: 'Page', href: '#/' },
    ...SIMS.map((s) => ({ label: s.name, kind: 'Simulator', href: `#/sims/${s.id}`, text: s.desc })),
    ...GLOSSARY.map((g) => ({ label: g.term, kind: 'Glossary', href: `#/glossary/${encodeURIComponent(g.term)}`, text: g.def })),
  ];
  let hits = [], sel = 0;
  const paint = () => {
    const f = input.value.trim().toLowerCase();
    hits = (f ? items.filter((i) => i.label.toLowerCase().includes(f)).concat(items.filter((i) => !i.label.toLowerCase().includes(f) && (i.text || '').toLowerCase().includes(f))) : items.filter((i) => i.kind !== 'Glossary')).slice(0, 12);
    sel = Math.min(sel, Math.max(hits.length - 1, 0));
    list.innerHTML = hits.map((h, i) => `<li class="${i === sel ? 'sel' : ''}" data-i="${i}">${esc(h.label)}<small>${h.kind}</small></li>`).join('') || '<li class="empty">Nothing found</li>';
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  };
  const open = () => { box.hidden = false; input.value = ''; sel = 0; paint(); input.focus(); };
  const close = () => { box.hidden = true; };
  const go = (i) => { if (hits[i]) { location.hash = hits[i].href; close(); } };
  input.oninput = () => { sel = 0; paint(); };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, hits.length - 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); paint(); }
    else if (e.key === 'Enter') go(sel);
  };
  list.onclick = (e) => { const li = e.target.closest('[data-i]'); if (li) go(+li.dataset.i); };
  box.onclick = (e) => { if (e.target === box) close(); };
  document.getElementById('search-btn').onclick = open;
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); box.hidden ? open() : close(); }
    else if (e.key === 'Escape' && !box.hidden) close();
  });
}

// ---- boot -----------------------------------------------------------------
async function boot() {
  const bootEl = document.getElementById('boot');
  try {
    document.documentElement.dataset.theme = state.theme;
    const [texts] = await Promise.all([
      Promise.all(LESSONS.map((l) => fetch(l.file).then((r) => { if (!r.ok) throw new Error(`Could not load ${l.file}`); return r.text(); }))),
      initSQL(window.initSqlJs, (f) => `vendor/${f}`),
    ]);
    LESSONS.forEach((l, i) => (l.blocks = parseLesson(texts[i])));
    registerLessons();
  } catch (e) {
    bootEl.innerHTML = `<p style="max-width:46ch;text-align:center"><b>Could not start.</b><br>${esc(e.message || e)}<br><br>This app must be served over HTTP (for example <code>python3 -m http.server</code>), not opened as a file.</p>`;
    return;
  }
  document.querySelectorAll('.brand-mark').forEach((m) => (m.innerHTML = rawIcon('db')));
  document.getElementById('menu-btn').innerHTML = icon('menu');
  document.getElementById('search-ico').outerHTML = icon('search');
  document.getElementById('menu-btn').onclick = () => document.body.classList.toggle('menu-open');
  document.getElementById('scrim').onclick = () => document.body.classList.remove('menu-open');
  document.getElementById('theme-btn').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; save(); };
  document.getElementById('reset-btn').onclick = () => { if (confirm('Erase all progress, XP, badges and saved code? This cannot be undone.')) { resetAll(); route(); } };
  setupPalette();
  bootEl.remove();
  document.querySelector('.app').hidden = false;
  window.addEventListener('hashchange', route);
  route();
}
boot();
