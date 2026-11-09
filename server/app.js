'use strict';
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs'), path = require('path');
const { q, tx } = require('./db');
const L = require('./lib');

const app = express();
const PROD = process.env.NODE_ENV === 'production';
const MIN_ANS = parseInt(process.env.REFERRAL_MIN_ANSWERS || '3', 10);
const BONUS = parseInt(process.env.REFERRAL_BONUS || '10', 10);
const SESSION_DAYS = 14;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
app.use(express.json({ limit: '1mb' }));

const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (res, code, msg) => res.status(code).json({ error: msg });

// ---------- جلسات ----------
const cookies = (s = '') => Object.fromEntries(s.split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, v.join('=')]));
app.use(h(async (req, res, next) => {
  const sid = cookies(req.headers.cookie).sid;
  if (sid) {
    const { rows } = await q(`SELECT u.id, u.username, u.display_name, u.role, u.points, u.avatar, u.ref_code, u.banned
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`, [L.sha256(sid)]);
    req.user = rows[0] && !rows[0].banned ? rows[0] : null;
  }
  next();
}));
// حماية CSRF: كل طلب يغيّر البيانات يحتاج ترويسة مخصصة (لا تُرسل عبر المواقع الأخرى) + SameSite=Lax
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-requested-with'] !== 'fetch') return fail(res, 403, 'طلب مرفوض');
  next();
});
const needUser = (req, res, next) => (req.user ? next() : fail(res, 401, 'سجّل الدخول أولًا'));
const needAdmin = (req, res, next) => (req.user && req.user.role === 'admin' ? next() : fail(res, 403, 'غير مصرح'));

async function startSession(res, userId) {
  const t = L.newToken();
  await q('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES($1,$2, now() + $3::int * interval \'1 day\')', [L.sha256(t), userId, SESSION_DAYS]);
  res.setHeader('Set-Cookie', `sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${PROD ? '; Secure' : ''}`);
}
async function settings() {
  const { rows } = await q('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
const publicUser = (u) => ({ id: u.id, username: u.username, displayName: u.display_name, role: u.role, points: u.points, avatar: u.avatar, refCode: u.ref_code });

// ---------- الحسابات ----------
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const regLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

app.post('/api/register', regLimiter, h(async (req, res) => {
  const s = await settings();
  if (!s.registration_open) return fail(res, 403, 'التسجيل مغلق حاليًا');
  const { username, displayName, password, ref } = req.body || {};
  if (!L.validUsername(username)) return fail(res, 400, 'اسم المستخدم: 3-24 حرفًا (حروف/أرقام/_)');
  if (!L.validPassword(password)) return fail(res, 400, 'كلمة المرور يجب ألا تقل عن 8 أحرف');
  const name = L.cleanName(displayName) || username;
  try {
    const user = await tx(async (c) => {
      const r = await c.query(`INSERT INTO users(username, display_name, password_hash, ref_code) VALUES($1,$2,$3,$4)
        RETURNING id, username, display_name, role, points, avatar, ref_code`, [username, name, L.hashPassword(password), L.genRefCode()]);
      const u = r.rows[0];
      if (typeof ref === 'string' && ref) {
        const rr = await c.query('SELECT id FROM users WHERE ref_code=$1 AND NOT banned', [ref.toUpperCase().slice(0, 20)]);
        if (rr.rowCount && rr.rows[0].id !== u.id)
          await c.query('INSERT INTO referrals(referrer_id, referred_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [rr.rows[0].id, u.id]);
      }
      return u;
    });
    await startSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (e) { if (e.code === '23505') return fail(res, 409, 'اسم المستخدم مستخدم مسبقًا'); throw e; }
}));

app.post('/api/login', authLimiter, h(async (req, res) => {
  const { username, password } = req.body || {};
  const { rows } = await q('SELECT * FROM users WHERE lower(username)=lower($1)', [String(username || '')]);
  const u = rows[0];
  // نفس الرسالة لكل الحالات لمنع كشف الحسابات
  if (!u || typeof password !== 'string' || !L.verifyPassword(password, u.password_hash) || u.banned) return fail(res, 401, 'بيانات الدخول غير صحيحة');
  await startSession(res, u.id);
  res.json({ user: publicUser(u) });
}));

app.post('/api/logout', h(async (req, res) => {
  const sid = cookies(req.headers.cookie).sid;
  if (sid) await q('DELETE FROM sessions WHERE token_hash=$1', [L.sha256(sid)]);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
}));

app.get('/api/me', needUser, h(async (req, res) => {
  const id = req.user.id, day = L.libyaDay();
  const [st, act, refs, lk] = await Promise.all([
    q('SELECT count(*)::int answered, count(*) FILTER (WHERE correct)::int correct FROM answers WHERE user_id=$1', [id]),
    q(`SELECT a.correct, a.points_awarded, a.created_at, left(qs.text, 80) AS text FROM answers a JOIN questions qs ON qs.id=a.question_id
       WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 10`, [id]),
    q(`SELECT count(*) FILTER (WHERE status='qualified')::int qualified, count(*) FILTER (WHERE status='pending')::int pending FROM referrals WHERE referrer_id=$1`, [id]),
    q('SELECT count(*)::int n FROM likes WHERE to_user=$1 AND like_day=$2', [id, day]),
  ]);
  const rank = await q('SELECT count(*)::int + 1 AS rank FROM users WHERE role=\'user\' AND NOT banned AND points > $1', [req.user.points]);
  res.json({ user: publicUser(req.user), stats: { ...st.rows[0], rank: rank.rows[0].rank, likesToday: lk.rows[0].n, likeCap: L.DAILY_LIKE_CAP, referrals: refs.rows[0] }, activity: act.rows, avatars: L.AVATARS });
}));

app.patch('/api/me', needUser, h(async (req, res) => {
  const { displayName, avatar } = req.body || {};
  const name = displayName === undefined ? req.user.display_name : L.cleanName(displayName);
  if (!name) return fail(res, 400, 'الاسم مطلوب');
  const av = avatar === undefined ? req.user.avatar : avatar;
  if (!L.AVATARS.includes(av)) return fail(res, 400, 'رمز غير مسموح');
  await q('UPDATE users SET display_name=$1, avatar=$2 WHERE id=$3', [name, av, req.user.id]);
  res.json({ ok: true });
}));

// ---------- عام ----------
app.get('/api/stats', h(async (req, res) => {
  const [s, c, w] = await Promise.all([
    settings(),
    q(`SELECT (SELECT count(*) FROM users WHERE role='user')::int users, (SELECT count(*) FROM answers)::int answers,
              (SELECT count(*) FROM questions WHERE active)::int questions, (SELECT count(*) FROM likes)::int likes`),
    q('SELECT w.rank, u.display_name, u.avatar FROM winners w JOIN users u ON u.id=w.user_id ORDER BY w.rank'),
  ]);
  res.json({ ...c.rows[0], endsAt: s.ends_at, registrationOpen: s.registration_open, contestOpen: s.contest_open,
    prizes: s.prizes, terms: s.terms, announcements: s.announcements, winners: w.rows.map((r) => ({ rank: r.rank, name: r.display_name, avatar: r.avatar })) });
}));

app.get('/api/leaderboard', h(async (req, res) => {
  const { rows } = await q(`SELECT u.id, u.display_name, u.avatar, u.points,
      (SELECT count(*) FROM likes l WHERE l.to_user=u.id)::int AS likes,
      rank() OVER (ORDER BY u.points DESC)::int AS rank
    FROM users u WHERE u.role='user' AND NOT u.banned ORDER BY u.points DESC, u.id LIMIT 50`);
  res.json({ leaders: rows.map((r) => ({ id: r.id, name: r.display_name, avatar: r.avatar, points: r.points, likes: r.likes, rank: r.rank })) });
}));

// ---------- الأسئلة ----------
app.get('/api/questions/next', needUser, h(async (req, res) => {
  const s = await settings();
  if (!s.contest_open) return fail(res, 403, 'المسابقة مغلقة حاليًا');
  const level = L.LEVEL_POINTS[req.query.level] ? req.query.level : null;
  const { rows } = await q(`SELECT id, text, options, level, points FROM questions qs WHERE active AND ($2::text IS NULL OR level=$2)
    AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.user_id=$1 AND a.question_id=qs.id) ORDER BY random() LIMIT 1`, [req.user.id, level]);
  res.json({ question: rows[0] || null });
}));

app.post('/api/questions/:id/answer', needUser, h(async (req, res) => {
  const s = await settings();
  if (!s.contest_open) return fail(res, 403, 'المسابقة مغلقة حاليًا');
  const id = parseInt(req.params.id, 10), choice = req.body && req.body.choice;
  if (!Number.isInteger(id) || !Number.isInteger(choice)) return fail(res, 400, 'طلب غير صالح');
  const out = await tx(async (c) => {
    const qr = await c.query('SELECT correct_index, points, active, jsonb_array_length(options) n FROM questions WHERE id=$1', [id]);
    const qu = qr.rows[0];
    if (!qu || !qu.active) return { code: 404, error: 'السؤال غير موجود' };
    if (choice < 0 || choice >= qu.n) return { code: 400, error: 'خيار غير صالح' };
    const correct = choice === qu.correct_index, pts = correct ? qu.points : 0;
    const ins = await c.query('INSERT INTO answers(user_id, question_id, chosen, correct, points_awarded) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [req.user.id, id, choice, correct, pts]);
    if (!ins.rowCount) return { code: 409, error: 'سبق أن أجبت عن هذا السؤال' };
    const u = await c.query('UPDATE users SET points = points + $1 WHERE id=$2 RETURNING points', [pts, req.user.id]);
    // تأهيل الإحالة بعد أن يجيب المدعو عددًا كافيًا من الأسئلة
    const ref = await c.query(`SELECT r.id, r.referrer_id FROM referrals r WHERE r.referred_id=$1 AND r.status='pending'
      AND (SELECT count(*) FROM answers WHERE user_id=$1) >= $2 FOR UPDATE`, [req.user.id, MIN_ANS]);
    if (ref.rowCount) {
      await c.query("UPDATE referrals SET status='qualified', qualified_at=now() WHERE id=$1", [ref.rows[0].id]);
      await c.query('UPDATE users SET points = points + $1 WHERE id=$2 AND NOT banned', [BONUS, ref.rows[0].referrer_id]);
    }
    return { ok: { correct, correctIndex: qu.correct_index, pointsAwarded: pts, totalPoints: u.rows[0].points } };
  });
  if (out.error) return fail(res, out.code, out.error);
  res.json(out.ok);
}));

// ---------- الإعجابات ----------
app.post('/api/likes', needUser, h(async (req, res) => {
  const to = parseInt(req.body && req.body.toUserId, 10), day = L.libyaDay();
  if (!Number.isInteger(to)) return fail(res, 400, 'طلب غير صالح');
  if (to === req.user.id) return fail(res, 400, 'لا يمكنك الإعجاب بنفسك');
  const out = await tx(async (c) => {
    // قفل صف المستلم لمنع تجاوز الحد اليومي بطلبات متزامنة
    const t = await c.query("SELECT id FROM users WHERE id=$1 AND role='user' AND NOT banned FOR UPDATE", [to]);
    if (!t.rowCount) return { code: 404, error: 'المشارك غير موجود' };
    const cnt = await c.query('SELECT count(*)::int n FROM likes WHERE to_user=$1 AND like_day=$2', [to, day]);
    if (cnt.rows[0].n >= L.DAILY_LIKE_CAP) return { code: 429, error: 'وصل هذا المشارك للحد اليومي من الإعجابات' };
    const ins = await c.query('INSERT INTO likes(from_user, to_user, like_day) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [req.user.id, to, day]);
    if (!ins.rowCount) return { code: 409, error: 'أعجبت بهذا المشارك اليوم بالفعل' };
    return { ok: true };
  });
  if (out.error) return fail(res, out.code, out.error);
  res.json({ ok: true });
}));

// ---------- الإدارة ----------
const admin = express.Router();
admin.use(needAdmin);
const audit = (req, action, details) => q('INSERT INTO audit_log(admin_id, action, details) VALUES($1,$2,$3)', [req.user.id, action, JSON.stringify(details || {})]);

admin.get('/overview', h(async (req, res) => {
  const { rows } = await q(`SELECT (SELECT count(*) FROM users WHERE role='user')::int users, (SELECT count(*) FROM questions)::int questions,
    (SELECT count(*) FROM answers)::int answers, (SELECT count(*) FROM likes)::int likes,
    (SELECT count(*) FROM referrals WHERE status='qualified')::int referrals`);
  res.json({ ...rows[0], settings: await settings() });
}));

admin.get('/users', h(async (req, res) => {
  const term = `%${String(req.query.q || '').slice(0, 30)}%`;
  const { rows } = await q(`SELECT id, username, display_name, points, banned, role, created_at,
    (SELECT count(*) FROM answers a WHERE a.user_id=u.id)::int answers FROM users u
    WHERE username ILIKE $1 OR display_name ILIKE $1 ORDER BY points DESC, id LIMIT 200`, [term]);
  res.json({ users: rows });
}));
admin.patch('/users/:id', h(async (req, res) => {
  const id = parseInt(req.params.id, 10), { banned, pointsDelta } = req.body || {};
  const t = await q('SELECT role FROM users WHERE id=$1', [id]);
  if (!t.rowCount) return fail(res, 404, 'غير موجود');
  if (t.rows[0].role === 'admin') return fail(res, 400, 'لا يمكن تعديل حساب إداري من هنا');
  if (typeof banned === 'boolean') {
    await q('UPDATE users SET banned=$1 WHERE id=$2', [banned, id]);
    if (banned) await q('DELETE FROM sessions WHERE user_id=$1', [id]);
  }
  if (Number.isInteger(pointsDelta) && Math.abs(pointsDelta) <= 10000) await q('UPDATE users SET points = GREATEST(0, points + $1) WHERE id=$2', [pointsDelta, id]);
  await audit(req, 'user.update', { id, banned, pointsDelta });
  res.json({ ok: true });
}));

admin.get('/questions', h(async (req, res) => {
  const term = `%${String(req.query.q || '').slice(0, 50)}%`, page = Math.max(0, parseInt(req.query.page || '0', 10) || 0);
  const { rows } = await q('SELECT id, text, options, correct_index, level, points, active FROM questions WHERE text ILIKE $1 ORDER BY id DESC LIMIT 50 OFFSET $2', [term, page * 50]);
  res.json({ questions: rows });
}));
const qvals = (x) => [x.text, JSON.stringify(x.options), x.correctIndex, x.level, x.points];
admin.post('/questions', h(async (req, res) => {
  const e = L.validateQuestion(req.body); if (e) return fail(res, 400, e);
  const r = await q('INSERT INTO questions(text, options, correct_index, level, points) VALUES($1,$2,$3,$4,$5) RETURNING id', qvals(L.normalizeQuestion(req.body)));
  await audit(req, 'question.create', { id: r.rows[0].id });
  res.status(201).json({ id: r.rows[0].id });
}));
admin.put('/questions/:id', h(async (req, res) => {
  const e = L.validateQuestion(req.body); if (e) return fail(res, 400, e);
  const active = req.body.active !== false;
  const r = await q('UPDATE questions SET text=$1, options=$2, correct_index=$3, level=$4, points=$5, active=$6 WHERE id=$7', [...qvals(L.normalizeQuestion(req.body)), active, parseInt(req.params.id, 10)]);
  if (!r.rowCount) return fail(res, 404, 'غير موجود');
  await audit(req, 'question.update', { id: req.params.id });
  res.json({ ok: true });
}));
admin.post('/questions/import', h(async (req, res) => {
  const list = req.body && req.body.questions;
  if (!Array.isArray(list) || !list.length || list.length > 2000) return fail(res, 400, 'أرسل مصفوفة من 1 إلى 2000 سؤال');
  for (let i = 0; i < list.length; i++) { const e = L.validateQuestion(list[i]); if (e) return fail(res, 400, `السؤال رقم ${i + 1}: ${e}`); }
  await tx(async (c) => { for (const raw of list) await c.query('INSERT INTO questions(text, options, correct_index, level, points) VALUES($1,$2,$3,$4,$5)', qvals(L.normalizeQuestion(raw))); });
  await audit(req, 'question.import', { count: list.length });
  res.json({ imported: list.length });
}));

admin.get('/likes', h(async (req, res) => {
  const { rows } = await q(`SELECT l.id, l.like_day, fu.display_name AS from_name, tu.display_name AS to_name FROM likes l
    JOIN users fu ON fu.id=l.from_user JOIN users tu ON tu.id=l.to_user ORDER BY l.id DESC LIMIT 200`);
  res.json({ likes: rows });
}));
admin.delete('/likes/:id', h(async (req, res) => { await q('DELETE FROM likes WHERE id=$1', [parseInt(req.params.id, 10)]); await audit(req, 'like.delete', { id: req.params.id }); res.json({ ok: true }); }));

admin.get('/referrals', h(async (req, res) => {
  const { rows } = await q(`SELECT r.id, r.status, r.created_at, a.display_name AS referrer, b.display_name AS referred FROM referrals r
    JOIN users a ON a.id=r.referrer_id JOIN users b ON b.id=r.referred_id ORDER BY r.id DESC LIMIT 200`);
  res.json({ referrals: rows });
}));
admin.post('/referrals/:id/reject', h(async (req, res) => {
  await tx(async (c) => {
    const r = await c.query('SELECT referrer_id, status FROM referrals WHERE id=$1 FOR UPDATE', [parseInt(req.params.id, 10)]);
    if (!r.rowCount) return;
    if (r.rows[0].status === 'qualified') await c.query('UPDATE users SET points = GREATEST(0, points - $1) WHERE id=$2', [BONUS, r.rows[0].referrer_id]);
    await c.query("UPDATE referrals SET status='rejected' WHERE id=$1", [req.params.id]);
  });
  await audit(req, 'referral.reject', { id: req.params.id });
  res.json({ ok: true });
}));

const SETTING_KEYS = { registration_open: 'bool', contest_open: 'bool', ends_at: 'date', terms: 'strings', prizes: 'strings', announcements: 'strings' };
admin.put('/settings', h(async (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) {
    const t = SETTING_KEYS[k]; if (!t) return fail(res, 400, `إعداد غير معروف: ${k}`);
    if (t === 'bool' && typeof v !== 'boolean') return fail(res, 400, `قيمة غير صالحة: ${k}`);
    if (t === 'date' && v !== null && Number.isNaN(Date.parse(v))) return fail(res, 400, 'تاريخ غير صالح');
    if (t === 'strings' && !(Array.isArray(v) && v.length <= 50 && v.every((x) => typeof x === 'string' && x.length <= 500))) return fail(res, 400, `قائمة غير صالحة: ${k}`);
    await q('INSERT INTO settings(key, value) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [k, JSON.stringify(t === 'date' && v ? new Date(v).toISOString() : v)]);
  }
  await audit(req, 'settings.update', Object.keys(req.body || {}));
  res.json({ ok: true });
}));

admin.get('/winners', h(async (req, res) => {
  const { rows } = await q('SELECT w.rank, w.user_id, w.method, w.note, w.selected_at, u.display_name, u.points FROM winners w JOIN users u ON u.id=w.user_id ORDER BY w.rank');
  res.json({ winners: rows });
}));
admin.post('/winners', h(async (req, res) => {
  const { userId, rank, note } = req.body || {};
  if (![1, 2, 3].includes(rank) || !Number.isInteger(userId)) return fail(res, 400, 'بيانات غير صالحة');
  try {
    await tx(async (c) => {
      await c.query('DELETE FROM winners WHERE rank=$1 OR user_id=$2', [rank, userId]);
      await c.query("INSERT INTO winners(rank, user_id, method, note, selected_by) VALUES($1,$2,'manual',$3,$4)", [rank, userId, String(note || '').slice(0, 300), req.user.id]);
    });
  } catch (e) { if (e.code === '23503') return fail(res, 404, 'المستخدم غير موجود'); throw e; }
  await audit(req, 'winner.set', { userId, rank });
  res.json({ ok: true });
}));
admin.post('/winners/draw', h(async (req, res) => {
  const min = Math.max(0, parseInt(req.body && req.body.minPoints, 10) || 0);
  const out = await tx(async (c) => {
    const el = await c.query("SELECT id FROM users WHERE role='user' AND NOT banned AND points >= $1", [min]);
    if (el.rowCount < 3) return null;
    const ids = L.pickWinners(el.rows.map((r) => r.id), 3);
    await c.query('DELETE FROM winners');
    for (let i = 0; i < 3; i++) await c.query("INSERT INTO winners(rank, user_id, method, note, selected_by) VALUES($1,$2,'draw',$3,$4)", [i + 1, ids[i], `سحب عشوائي بين ${el.rowCount} مؤهل (حد أدنى ${min} نقطة)`, req.user.id]);
    return ids;
  });
  if (!out) return fail(res, 400, 'يلزم 3 مشاركين مؤهلين على الأقل');
  await audit(req, 'winner.draw', { min, ids: out });
  res.json({ ok: true });
}));
admin.delete('/winners/:rank', h(async (req, res) => { await q('DELETE FROM winners WHERE rank=$1', [parseInt(req.params.rank, 10)]); await audit(req, 'winner.remove', { rank: req.params.rank }); res.json({ ok: true }); }));
admin.get('/audit', h(async (req, res) => { const { rows } = await q('SELECT a.id, a.action, a.details, a.created_at, u.username FROM audit_log a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 100'); res.json({ log: rows }); }));
app.use('/api/admin', admin);

// ---------- الصفحات + Open Graph ----------
const PUB = path.join(__dirname, '../public');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
app.get('/', (req, res, next) => {
  const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  fs.readFile(path.join(PUB, 'index.html'), 'utf8', (err, html) => err ? next(err)
    : res.type('html').send(html.replace(/\{\{BASE\}\}/g, esc(base))));
});
app.use(express.static(PUB, { index: false, maxAge: PROD ? '1h' : 0 }));
app.get('/admin', (req, res) => res.sendFile(path.join(PUB, 'admin.html')));
app.use('/api', (req, res) => fail(res, 404, 'غير موجود'));
app.use((err, req, res, next) => { // eslint-disable-line
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'JSON غير صالح');
  console.error(err); fail(res, 500, 'خطأ في الخادم');
});
module.exports = app;
