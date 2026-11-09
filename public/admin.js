'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch('/api' + path, { method, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' } });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'خطأ'); return d;
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); }
const TABS = { overview: 'الإعدادات', users: 'المشاركون', questions: 'الأسئلة', likes: 'الإعجابات', referrals: 'الإحالات', winners: 'الفائزون', audit: 'السجل' };
let tab = 'overview', qpage = 0;
const lines = (a) => (a || []).join('\n');
const toLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

async function show() {
  let me; try { me = await api('/me'); } catch { me = null; }
  if (!me || me.user.role !== 'admin') {
    $('#app').innerHTML = `<div class="card"><h3>دخول الإدارة</h3>${me ? '<p class="err">هذا الحساب ليس إداريًا.</p>' : ''}<form data-f="login"><label>اسم المستخدم</label><input name="username" required><label>كلمة المرور</label><input name="password" type="password" required><button class="btn">دخول</button></form></div>`;
    return;
  }
  const nav = `<div class="row">${Object.entries(TABS).map(([k, v]) => `<button class="btn sm ${k === tab ? '' : 'alt'}" data-tab="${k}">${v}</button>`).join('')}<button class="btn sm alt" data-a="logout">خروج</button></div>`;
  $('#app').innerHTML = nav + '<div id="pane">...</div>';
  try { $('#pane').innerHTML = await panes[tab](); } catch (e) { $('#pane').innerHTML = `<div class="card err">${esc(e.message)}</div>`; }
}
const panes = {
  async overview() {
    const o = await api('/admin/overview'), s = o.settings;
    return `<div class="card grid"><div class="stat"><b>${o.users}</b><span>مشاركون</span></div><div class="stat"><b>${o.questions}</b><span>أسئلة</span></div><div class="stat"><b>${o.answers}</b><span>إجابات</span></div><div class="stat"><b>${o.likes}</b><span>إعجابات</span></div><div class="stat"><b>${o.referrals}</b><span>إحالات مؤهلة</span></div></div>
    <div class="card"><form data-f="settings"><label><input type="checkbox" name="registration_open" ${s.registration_open ? 'checked' : ''} style="width:auto"> التسجيل مفتوح</label><br>
    <label><input type="checkbox" name="contest_open" ${s.contest_open ? 'checked' : ''} style="width:auto"> المسابقة مفتوحة</label>
    <label>موعد الانتهاء (اتركه فارغًا لإلغاء العداد)</label><input type="datetime-local" name="ends_at" value="${s.ends_at ? new Date(new Date(s.ends_at).getTime() + 2 * 3600e3).toISOString().slice(0, 16) : ''}">
    <small class="mut">التوقيت المُدخل يُعتبر بتوقيت ليبيا (UTC+2)</small>
    <label>الشروط (سطر لكل بند)</label><textarea name="terms" rows="5">${esc(lines(s.terms))}</textarea>
    <label>الجوائز (سطر لكل جائزة)</label><textarea name="prizes" rows="3">${esc(lines(s.prizes))}</textarea>
    <label>الإعلانات/الإشعارات (سطر لكل إعلان)</label><textarea name="announcements" rows="3">${esc(lines(s.announcements))}</textarea><button class="btn">حفظ الإعدادات</button></form></div>`;
  },
  async users() {
    const { users } = await api('/admin/users');
    return `<div class="card"><table><tr><th>#</th><th>الاسم</th><th>نقاط</th><th>إجابات</th><th></th></tr>${users.map((u) => `<tr><td>${u.id}</td><td>${esc(u.display_name)}<br><small class="mut">@${esc(u.username)}${u.role === 'admin' ? ' (إداري)' : ''}${u.banned ? ' ⛔' : ''}</small></td><td>${u.points}</td><td>${u.answers}</td>
    <td>${u.role === 'admin' ? '' : `<button class="btn sm alt" data-a="ban" data-id="${u.id}" data-v="${!u.banned}">${u.banned ? 'رفع الحظر' : 'حظر'}</button> <button class="btn sm alt" data-a="pts" data-id="${u.id}">نقاط±</button>`}</td></tr>`).join('')}</table></div>`;
  },
  async questions() {
    const { questions } = await api('/admin/questions?page=' + qpage);
    return `<div class="card"><h3>إضافة سؤال</h3><form data-f="question"><input name="text" placeholder="نص السؤال" required>
    <textarea name="options" rows="4" placeholder="الخيارات: سطر لكل خيار" required></textarea><input name="correct" type="number" min="1" placeholder="رقم الإجابة الصحيحة (1 = السطر الأول)" required>
    <select name="level"><option value="easy">سهلة (5)</option><option value="medium">متوسطة (10)</option><option value="hard">صعبة (20)</option><option value="special">تحدٍّ خاص (30)</option></select><button class="btn">إضافة</button></form></div>
    <div class="card"><h3>استيراد (JSON)</h3><p class="mut">مصفوفة: [{"text","options":[],"correctIndex":0,"level":"easy"}] — حتى 2000 سؤال لكل عملية.</p><input type="file" accept=".json" data-import></div>
    <div class="card"><h3>الأسئلة (${qpage + 1})</h3><table>${questions.map((x) => `<tr><td>${x.id}</td><td>${esc(x.text)}<br><small class="mut">${x.level} • ${x.points} • ${x.active ? 'فعّال' : 'معطّل'}</small></td><td><button class="btn sm alt" data-a="toggleq" data-id="${x.id}" data-v="${x.active}" data-q='${esc(JSON.stringify({ text: x.text, options: x.options, correctIndex: x.correct_index, level: x.level, points: x.points }))}'>${x.active ? 'تعطيل' : 'تفعيل'}</button></td></tr>`).join('')}</table>
    <div class="row"><button class="btn sm alt" data-a="qpage" data-v="-1">السابق</button><button class="btn sm alt" data-a="qpage" data-v="1">التالي</button></div></div>`;
  },
  async likes() { const { likes } = await api('/admin/likes'); return `<div class="card"><table>${likes.map((l) => `<tr><td>${esc(l.from_name)} ← ${esc(l.to_name)}<br><small class="mut">${esc(String(l.like_day).slice(0, 10))}</small></td><td><button class="btn sm alt" data-a="dellike" data-id="${l.id}">حذف</button></td></tr>`).join('') || '<tr><td class="mut">لا شيء</td></tr>'}</table></div>`; },
  async referrals() { const { referrals } = await api('/admin/referrals'); return `<div class="card"><table>${referrals.map((r) => `<tr><td>${esc(r.referrer)} ← ${esc(r.referred)}<br><small class="mut">${r.status}</small></td><td>${r.status !== 'rejected' ? `<button class="btn sm alt" data-a="rejref" data-id="${r.id}">رفض</button>` : ''}</td></tr>`).join('') || '<tr><td class="mut">لا شيء</td></tr>'}</table></div>`; },
  async winners() {
    const { winners } = await api('/admin/winners');
    return `<div class="card"><h3>الفائزون الحاليون</h3>${winners.map((w) => `<div class="lb"><span class="rk">${w.rank}</span><span class="nm">${esc(w.display_name)} <small class="mut">(#${w.user_id}، ${w.points} نقطة، ${w.method === 'draw' ? 'سحب' : 'يدوي'})</small></span><button class="btn sm alt" data-a="delwin" data-id="${w.rank}">إزالة</button></div>`).join('') || '<span class="mut">لم يُختر فائزون بعد.</span>'}</div>
    <div class="card"><h3>سحب عشوائي لـ 3 فائزين مختلفين</h3><form data-f="draw"><label>الحد الأدنى للنقاط للأهلية</label><input name="minPoints" type="number" min="0" value="0"><button class="btn">إجراء السحب (يستبدل الفائزين الحاليين)</button></form></div>
    <div class="card"><h3>اختيار يدوي</h3><form data-f="winner"><input name="userId" type="number" placeholder="رقم المشارك (#)" required><select name="rank"><option>1</option><option>2</option><option>3</option></select><input name="note" placeholder="ملاحظة/توثيق (اختياري)"><button class="btn">تعيين</button></form></div>`;
  },
  async audit() { const { log } = await api('/admin/audit'); return `<div class="card"><table>${log.map((l) => `<tr><td>${esc(l.action)}<br><small class="mut">${esc(l.username)} • ${new Date(l.created_at).toLocaleString('ar-LY')}</small></td><td><small>${esc(JSON.stringify(l.details))}</small></td></tr>`).join('')}</table></div>`; },
};
const ok = (m = 'تم') => { toast(m); show(); };
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; return show(); }
  const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, id = b.dataset.id;
  try {
    if (a === 'logout') { await api('/logout', { method: 'POST' }); show(); }
    else if (a === 'ban') { await api('/admin/users/' + id, { method: 'PATCH', body: { banned: b.dataset.v === 'true' } }); ok(); }
    else if (a === 'pts') { const n = parseInt(prompt('أدخل التعديل على النقاط (مثل 50 أو -20):'), 10); if (Number.isInteger(n)) { await api('/admin/users/' + id, { method: 'PATCH', body: { pointsDelta: n } }); ok(); } }
    else if (a === 'toggleq') { const q = JSON.parse(b.dataset.q); await api('/admin/questions/' + id, { method: 'PUT', body: { ...q, active: b.dataset.v !== 'true' } }); ok(); }
    else if (a === 'qpage') { qpage = Math.max(0, qpage + +b.dataset.v); show(); }
    else if (a === 'dellike') { await api('/admin/likes/' + id, { method: 'DELETE' }); ok(); }
    else if (a === 'rejref') { if (confirm('رفض الإحالة؟')) { await api('/admin/referrals/' + id + '/reject', { method: 'POST' }); ok(); } }
    else if (a === 'delwin') { await api('/admin/winners/' + id, { method: 'DELETE' }); ok(); }
  } catch (err) { toast(err.message); }
});
document.addEventListener('change', async (e) => {
  if (!e.target.matches('[data-import]')) return;
  try { const list = JSON.parse(await e.target.files[0].text()); const r = await api('/admin/questions/import', { method: 'POST', body: { questions: list } }); ok(`تم استيراد ${r.imported}`); } catch (err) { toast(err.message); }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-f]'); if (!f) return; e.preventDefault();
  const d = Object.fromEntries(new FormData(f)), k = f.dataset.f;
  try {
    if (k === 'login') { await api('/login', { method: 'POST', body: d }); show(); }
    else if (k === 'settings') {
      await api('/admin/settings', { method: 'PUT', body: { registration_open: !!d.registration_open, contest_open: !!d.contest_open,
        ends_at: d.ends_at ? new Date(d.ends_at + ':00+02:00').toISOString() : null, terms: toLines(d.terms), prizes: toLines(d.prizes), announcements: toLines(d.announcements) } }); ok('تم الحفظ');
    } else if (k === 'question') {
      await api('/admin/questions', { method: 'POST', body: { text: d.text, options: toLines(d.options), correctIndex: parseInt(d.correct, 10) - 1, level: d.level } }); ok('تمت الإضافة');
    } else if (k === 'draw') { if (confirm('تأكيد السحب؟')) { await api('/admin/winners/draw', { method: 'POST', body: { minPoints: +d.minPoints } }); ok('تم السحب'); } }
    else if (k === 'winner') { await api('/admin/winners', { method: 'POST', body: { userId: +d.userId, rank: +d.rank, note: d.note } }); ok(); }
  } catch (err) { toast(err.message); }
});
show();
