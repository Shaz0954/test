// Shared UI helpers and the progress / XP / badge rules.
import { LESSONS, BADGES } from './data.js';
import { state, save, touchStreak } from './state.js';

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  code: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8"/>',
  book: '<path d="M2 4h7a3 3 0 0 1 3 3 3 3 0 0 1 3-3h7v15h-7a3 3 0 0 0-3 3 3 3 0 0 0-3-3H2z"/><path d="M12 7v15"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.5-4.5"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  alert: '<path d="M12 3 2 20h20zM12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
};
export const icon = (name) => `<span class="ico"><svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg></span>`;
export const rawIcon = (name) => `<svg viewBox="0 0 24 24">${ICONS[name] || ''}</svg>`;

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function toast(title, detail = '', kind = 'xp') {
  const node = el(`<div class="toast ${kind}">${icon(kind === 'badge' ? 'award' : 'bolt')}<span><b></b> <span></span></span></div>`);
  node.querySelector('b').textContent = title;
  node.querySelector('span span').textContent = detail;
  document.getElementById('toasts').appendChild(node);
  setTimeout(() => { node.classList.add('out'); setTimeout(() => node.remove(), 320); }, 3200);
}

// ---- progress model -------------------------------------------------------
export const CHALLENGES = {}; // id -> { type, lesson }
export function registerLessons() {
  for (const lesson of LESSONS)
    for (const b of lesson.blocks) if (b.type === 'sql' || b.type === 'python') CHALLENGES[b.id] = { type: b.type, lesson: lesson.id };
}
export const lessonById = (id) => LESSONS.find((l) => l.id === id);
export const challengesOf = (lesson) => lesson.blocks.filter((b) => b.type === 'sql' || b.type === 'python');
export const quizOf = (lesson) => lesson.blocks.find((b) => b.type === 'quiz');

export function lessonProgress(lesson) {
  const ch = challengesOf(lesson);
  const done = ch.filter((c) => state.solved[c.id]).length + (state.quiz[lesson.id]?.passed ? 1 : 0);
  return { done, total: ch.length + 1, complete: !!state.done[lesson.id] };
}
export const tierLessons = (tier) => LESSONS.filter((l) => l.tier === tier);
export const tierDone = (tier) => tierLessons(tier).every((l) => state.done[l.id]);

export function addXP(n, why) {
  if (n <= 0) return;
  state.xp += n;
  touchStreak();
  toast(`+${n} XP`, why);
}

function checkBadges() {
  const solved = Object.keys(state.solved);
  const ctx = {
    state, tierDone,
    sqlSolved: solved.filter((id) => CHALLENGES[id]?.type === 'sql').length,
    pySolved: solved.filter((id) => CHALLENGES[id]?.type === 'python').length,
  };
  for (const b of BADGES) {
    if (state.badges[b.id] || !b.test(ctx)) continue;
    state.badges[b.id] = Date.now();
    toast('Badge unlocked', b.name, 'badge');
  }
}

/** Call after any progress change: completes lessons, awards badges, persists. */
export function commit() {
  for (const lesson of LESSONS) {
    const p = lessonProgress(lesson);
    if (!p.complete && p.done === p.total) {
      state.done[lesson.id] = Date.now();
      addXP(30, `Lesson complete: ${lesson.title}`);
    }
  }
  checkBadges();
  save();
}

export function solveChallenge(id) {
  if (!state.solved[id]) { state.solved[id] = Date.now(); addXP(20, 'Challenge solved'); }
  commit();
}

export function recordQuiz(lessonId, results) {
  let gained = 0;
  results.forEach((r) => {
    const key = `${lessonId}:${r.index}`;
    if (r.correct && !state.qok[key]) { state.qok[key] = 1; gained += 10; }
  });
  const score = results.filter((r) => r.correct).length / results.length;
  const prev = state.quiz[lessonId] || { best: 0, passed: false };
  state.quiz[lessonId] = { best: Math.max(prev.best, score), passed: prev.passed || score >= 0.7 };
  addXP(gained, 'Quiz answers');
  commit();
  return score;
}

export function markSim(id) {
  if (state.sims[id]) return;
  state.sims[id] = 1;
  commit();
}
export function countQuery() { state.queries++; if (state.queries === 1) commit(); else save(true); }
