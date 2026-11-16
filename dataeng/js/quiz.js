// One-question-at-a-time quiz with instant feedback. Used by lessons and the mock interview.
import { el, icon } from './game.js';
import { esc, inline } from './md.js';

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * questions: [{ q, options, answer, why, index?, tag? }]
 * opts: { title, passMark, timer (seconds), onDone(results) -> optional extra HTML, best }
 */
export function mountQuiz(root, questions, opts = {}) {
  const passMark = opts.passMark ?? 0.7;
  let i, results, order, interval, remaining;

  const box = el(`<section class="quiz" id="quiz"><header><span class="chip">Quiz</span><h3>${esc(opts.title || 'Check your understanding')}</h3><span class="timer" hidden></span><div class="dots"></div></header><div class="body"></div></section>`);
  root.appendChild(box);
  const body = box.querySelector('.body'), dots = box.querySelector('.dots'), timerEl = box.querySelector('.timer');

  const paintDots = () => { dots.innerHTML = questions.map((_, k) => `<i class="${k < results.length ? (results[k].correct ? 'ok' : 'bad') : k === i ? 'cur' : ''}"></i>`).join(''); };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function start() {
    i = 0; results = [];
    order = questions.map((q) => shuffle(q.options.map((_, k) => k)));
    if (opts.timer) {
      remaining = opts.timer; timerEl.hidden = false;
      clearInterval(interval);
      interval = setInterval(() => {
        remaining--;
        timerEl.textContent = fmt(Math.max(remaining, 0));
        timerEl.classList.toggle('low', remaining < 60);
        if (remaining <= 0) finish(true);
      }, 1000);
      timerEl.textContent = fmt(remaining);
    }
    show();
  }

  function show() {
    const q = questions[i];
    paintDots();
    body.innerHTML = `<p class="eyebrow">Question ${i + 1} of ${questions.length}${q.tag ? ` · ${esc(q.tag)}` : ''}</p><p class="q">${inline(q.q)}</p><div class="opts">${order[i].map((k, n) => `<button class="opt" data-k="${k}"><span class="key">${'ABCDEF'[n]}</span><span>${inline(q.options[k])}</span></button>`).join('')}</div><div class="why"></div><div class="next-row"></div>`;
    body.querySelectorAll('.opt').forEach((b) => (b.onclick = () => answer(+b.dataset.k)));
  }

  function answer(k) {
    const q = questions[i], correct = k === q.answer;
    results.push({ index: q.index ?? i, correct, chosen: k, q });
    body.querySelectorAll('.opt').forEach((b) => {
      b.disabled = true;
      if (+b.dataset.k === q.answer) b.classList.add('correct');
      else if (+b.dataset.k === k) b.classList.add('wrong');
    });
    body.querySelector('.why').innerHTML = `<div class="feedback ${correct ? 'ok' : 'bad'}">${icon(correct ? 'check' : 'x')}<div><b>${correct ? 'Correct.' : 'Not quite.'}</b> ${inline(q.why)}</div></div>`;
    const last = i === questions.length - 1;
    const next = el(`<button class="btn primary">${last ? 'See results' : 'Next question'} ${icon('arrow')}</button>`);
    next.onclick = () => { if (last) finish(); else { i++; show(); } };
    body.querySelector('.next-row').appendChild(next);
    next.focus();
    paintDots();
  }

  function finish(timedOut) {
    clearInterval(interval);
    while (results.length < questions.length) { const q = questions[results.length]; results.push({ index: q.index ?? results.length, correct: false, chosen: -1, q }); }
    i = questions.length; paintDots();
    const right = results.filter((r) => r.correct).length, score = right / questions.length, pass = score >= passMark;
    const extra = opts.onDone ? opts.onDone(results, score) || '' : '';
    const wrong = results.filter((r) => !r.correct);
    body.innerHTML = `<div class="quiz-result"><div class="score ${pass ? 'pass' : 'fail'}">${Math.round(score * 100)}%</div><p>${timedOut ? 'Time is up. ' : ''}${right} of ${questions.length} correct — ${pass ? 'passed!' : `you need ${Math.round(passMark * 100)}% to pass. Review and try again.`}</p>${extra}${wrong.length ? `<div class="review">${wrong.map((r) => `<div class="item"><b>${inline(r.q.q)}</b>${r.chosen >= 0 ? `<span class="yours">Your answer: ${inline(r.q.options[r.chosen])}</span><br>` : ''}<span class="ans">Correct: ${inline(r.q.options[r.q.answer])}</span><p>${inline(r.q.why)}</p></div>`).join('')}</div>` : ''}<button class="btn ${pass ? '' : 'primary'}" data-retry>${pass ? 'Retake quiz' : 'Try again'}</button></div>`;
    body.querySelector('[data-retry]').onclick = () => (opts.onRetry ? opts.onRetry() : start());
  }

  start();
  return () => clearInterval(interval);
}
