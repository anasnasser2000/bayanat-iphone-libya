'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../server/lib');

test('يوم ليبيا يتقدم ساعتين عن UTC', () => {
  assert.equal(L.libyaDay(new Date('2026-10-20T21:59:59Z')), '2026-10-20');
  assert.equal(L.libyaDay(new Date('2026-10-20T22:00:00Z')), '2026-10-21');
});
test('تشفير كلمة المرور والتحقق', () => {
  const h = L.hashPassword('كلمة-سر-قوية-123');
  assert.ok(h.startsWith('scrypt$')); assert.ok(!h.includes('كلمة'));
  assert.ok(L.verifyPassword('كلمة-سر-قوية-123', h)); assert.ok(!L.verifyPassword('خطأ', h));
  assert.notEqual(h, L.hashPassword('كلمة-سر-قوية-123'));
});
test('التحقق من اسم المستخدم وكلمة المرور', () => {
  assert.ok(L.validUsername('أحمد_12')); assert.ok(!L.validUsername('a b')); assert.ok(!L.validUsername('ab'));
  assert.ok(L.validPassword('12345678')); assert.ok(!L.validPassword('1234567'));
});
test('التحقق من الأسئلة والنقاط', () => {
  const ok = { text: 'سؤال؟', options: ['أ', 'ب'], correctIndex: 1, level: 'hard' };
  assert.equal(L.validateQuestion(ok), null);
  assert.equal(L.normalizeQuestion(ok).points, 20);
  assert.deepEqual(Object.values(L.LEVEL_POINTS), [5, 10, 20, 30]);
  assert.ok(L.validateQuestion({ ...ok, correctIndex: 2 }));
  assert.ok(L.validateQuestion({ ...ok, points: 7 }));
  assert.ok(L.validateQuestion({ ...ok, level: 'x' }));
  assert.ok(L.validateQuestion({ ...ok, options: ['أ'] }));
});
test('ملف الأسئلة النموذجي صالح', () => {
  const list = require('../db/sample-questions.json');
  list.forEach((q) => assert.equal(L.validateQuestion(q), null));
});
test('اختيار 3 فائزين مختلفين', () => {
  for (let i = 0; i < 50; i++) { const w = L.pickWinners([1, 2, 3, 4, 5, 5, 6]); assert.equal(w.length, 3); assert.equal(new Set(w).size, 3); }
});
test('رموز الجلسة والإحالة', () => {
  assert.equal(L.newToken().length, 64); assert.equal(L.genRefCode().length, 10);
  assert.notEqual(L.newToken(), L.newToken()); assert.equal(L.sha256('a').length, 64);
});
