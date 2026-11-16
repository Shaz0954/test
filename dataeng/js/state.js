// Progress persistence (localStorage) and XP / level maths.
import { LEVELS } from './data.js';

const KEY = 'dataeng.v1';
const defaults = () => ({ xp: 0, solved: {}, quiz: {}, qok: {}, done: {}, code: {}, streak: { last: null, count: 0 }, badges: {}, sims: {}, exams: [], theme: 'dark', queries: 0 });

let stored = {};
try { stored = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* corrupted or unavailable storage: start fresh */ }
export const state = Object.assign(defaults(), stored);

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
export function save(quiet) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  if (!quiet) listeners.forEach((fn) => fn());
}
export function resetAll() {
  const theme = state.theme;
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, defaults(), { theme });
  save();
}

const today = () => new Date().toLocaleDateString('en-CA');
export function touchStreak() {
  const t = today();
  if (state.streak.last === t) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  state.streak.count = state.streak.last === y.toLocaleDateString('en-CA') ? state.streak.count + 1 : 1;
  state.streak.last = t;
}

export function level(xp = state.xp) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const next = LEVELS[i + 1];
  return { index: i + 1, title: LEVELS[i][1], floor: LEVELS[i][0], next: next ? next[0] : null, pct: next ? (xp - LEVELS[i][0]) / (next[0] - LEVELS[i][0]) : 1 };
}
