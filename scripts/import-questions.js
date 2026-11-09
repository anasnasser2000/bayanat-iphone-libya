'use strict';
// الاستخدام: npm run import-questions -- ملف.json   (مصفوفة أسئلة؛ انظر db/sample-questions.json)
require('./env');
const fs = require('fs');
const { pool } = require('../server/db');
const { validateQuestion, normalizeQuestion } = require('../server/lib');
(async () => {
  const f = process.argv[2]; if (!f) throw new Error('حدد ملف JSON');
  const list = JSON.parse(fs.readFileSync(f, 'utf8'));
  list.forEach((q, i) => { const e = validateQuestion(q); if (e) throw new Error(`السؤال رقم ${i + 1}: ${e}`); });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const raw of list) { const q = normalizeQuestion(raw);
      await c.query('INSERT INTO questions(text,options,correct_index,level,points) VALUES($1,$2,$3,$4,$5)', [q.text, JSON.stringify(q.options), q.correctIndex, q.level, q.points]); }
    await c.query('COMMIT'); console.log('imported', list.length);
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
