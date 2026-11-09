'use strict';
const crypto = require('crypto');

const LIBYA_OFFSET_MS = 2 * 3600 * 1000; // ليبيا UTC+2 بدون توقيت صيفي
const libyaDay = (d = new Date()) => new Date(d.getTime() + LIBYA_OFFSET_MS).toISOString().slice(0, 10);

const LEVEL_POINTS = { easy: 5, medium: 10, hard: 20, special: 30 };
const ALLOWED_POINTS = [5, 10, 20, 30];
const AVATARS = ['🦅', '🐆', '🦁', '🐎', '🐪', '⭐', '👑', '🔥', '💎', '🏆', '🌴', '🌙'];
const DAILY_LIKE_CAP = 20;

const validUsername = (u) => typeof u === 'string' && /^[A-Za-z0-9_\u0600-\u06FF]{3,24}$/.test(u);
const validPassword = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 128;
const cleanName = (s) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ').slice(0, 40) : '');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [alg, s, k] = String(stored).split('$');
  if (alg !== 'scrypt' || !s || !k) return false;
  const key = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64);
  const exp = Buffer.from(k, 'hex');
  return key.length === exp.length && crypto.timingSafeEqual(key, exp);
}
const newToken = () => crypto.randomBytes(32).toString('hex');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const genRefCode = () => crypto.randomBytes(5).toString('hex').toUpperCase();

function validateQuestion(q) {
  if (!q || typeof q !== 'object') return 'سؤال غير صالح';
  if (typeof q.text !== 'string' || q.text.trim().length < 3 || q.text.length > 500) return 'نص السؤال غير صالح';
  if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) return 'الخيارات يجب أن تكون من 2 إلى 6';
  if (q.options.some((o) => typeof o !== 'string' || !o.trim() || o.length > 200)) return 'خيار غير صالح';
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) return 'رقم الإجابة الصحيحة غير صالح';
  if (!LEVEL_POINTS[q.level]) return 'المستوى غير صالح (easy/medium/hard/special)';
  if (q.points !== undefined && !ALLOWED_POINTS.includes(q.points)) return 'النقاط يجب أن تكون 5 أو 10 أو 20 أو 30';
  return null;
}
const normalizeQuestion = (q) => ({
  text: q.text.trim(), options: q.options.map((o) => o.trim()), correctIndex: q.correctIndex,
  level: q.level, points: q.points ?? LEVEL_POINTS[q.level],
});

// اختيار n فائزين مختلفين عشوائيًا (Fisher-Yates بمصدر عشوائية آمن)
function pickWinners(ids, n = 3, rnd = crypto.randomInt) {
  const a = [...new Set(ids)];
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
module.exports = { libyaDay, LEVEL_POINTS, ALLOWED_POINTS, AVATARS, DAILY_LIKE_CAP, validUsername, validPassword, cleanName,
  hashPassword, verifyPassword, newToken, sha256, genRefCode, validateQuestion, normalizeQuestion, pickWinners };
