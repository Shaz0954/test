# DataEng Academy

An interactive, in-browser course that takes you from your first `SELECT` to designing production data platforms. No backend, no build step, no account — everything runs on your machine.

## What's inside

- **24 lessons in four tiers** — Beginner (foundations), Intermediate (building pipelines), Advanced (scale and streaming), Pro (production and system design).
- **38 SQL challenges** graded against a real SQLite database (WebAssembly) seeded with an e-commerce dataset. Mutating challenges run on a fresh copy each time, and idempotency challenges are executed twice before grading.
- **7 Python challenges** running real CPython (Pyodide) with hidden tests.
- **5 simulators** — an Airflow-style DAG runner, Kafka consumer lag, storage format and scan cost, SCD Type 2, and Spark shuffle skew.
- **106 quiz questions** with explanations, plus a timed 15-question **mock interview**.
- **SQL Lab and Python Lab** playgrounds, a 50-term glossary and `Ctrl/⌘ + K` search.
- XP, levels, badges and streaks, saved in your browser's `localStorage`. Light and dark themes.

## Run it

It is a static site, but it must be served over HTTP (ES modules and WebAssembly do not load from `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Any static host works (GitHub Pages, Netlify, S3…) — just publish this folder.

The SQL engine is vendored in `vendor/`, so SQL works offline. The Python runtime (~10 MB) is downloaded from the jsDelivr CDN the first time you run Python code, so Python exercises need an internet connection.

## Project layout

```text
index.html            app shell
css/styles.css        all styling (dark + light themes)
content/*.md          one Markdown file per lesson (with quiz/challenge/simulator directives)
js/app.js             routing, dashboard, lesson pages, mock interview, search
js/labs.js            code editor, SQL + Python runners, challenge widgets, playgrounds
js/sims.js            the five simulators
js/quiz.js            quiz engine
js/db.js              SQLite wrapper, deterministic dataset, answer grading
js/parser.js, md.js   lesson-file parser, Markdown renderer, syntax highlighter
js/data.js            curriculum manifest, levels, badges, glossary
js/game.js, state.js  XP / badge rules and persistence
vendor/               sql.js (SQLite compiled to WebAssembly, MIT licence)
tests/validate.mjs    content validator
```

## Writing lessons

Lessons are Markdown with a few `:::` blocks. Register a new file in `js/data.js`.

```text
:::sql id=my-id title="Challenge title" ordered
The prompt, in Markdown.
@setup      (optional) SQL run before the learner's code
@starter    code the editor starts with
@solution   reference answer — the learner's result must match its result
@check      (optional) query whose result is graded instead, for DDL/DML tasks
@hint       shown on request
:::

:::python id=my-py title="…"     sections: @starter @solution @test @hint
:::quiz                          "? question", "- wrong", "+ correct", "! explanation"
:::sim dag                       dag | kafka | scan | scd | skew
:::callout tip                   tip | warn | info
```

Flags for `:::sql`: `ordered` (row order matters) and `twice` (run the learner's SQL twice to test idempotency).

## Validate content

```bash
node tests/validate.mjs
```

Checks that every quiz is well-formed, every reference solution passes its own grader, and no starter code passes by accident. Requires Node 18+ and `python3`.
