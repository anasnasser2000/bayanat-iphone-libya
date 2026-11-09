'use strict';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LEVELS = { '': 'الكل', easy: 'سهلة', medium: 'متوسطة', hard: 'صعبة', special: 'تحديات خاصة' };
let me = null, stats = null, level = '', cdTimer = null, current = null;

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch('/api' + path, { method, credentials: 'same-origin', body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'حدث خطأ');
  return d;
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); }
async function loadMe() { try { me = (await api('/me')); } catch { me = null; } }

const NAV = [['/', '🏠', 'الرئيسية'], ['/contests', '🎯', 'المسابقات'], ['/leaderboard', '🏆', 'المتصدرون'], ['/likes', '❤️', 'الإعجابات'], ['/account', '👤', 'حسابي'], ['/more', '☰', 'المزيد']];
const MORE = ['/more', '/friends', '/terms', '/notifications', '/help'];
function renderNav(route) {
  $('#nav').innerHTML = NAV.map(([p, i, t]) => `<a href="#${p}" class="${route === p || (p === '/more' && MORE.includes(route)) ? 'on' : ''}"><span>${i}</span>${t}</a>`).join('');
}
function phoneSvg(i) {
  const c = ['#d4af37', '#c9c9c9', '#1f1f1f'][i];
  return `<svg viewBox="0 0 100 200" role="img" aria-label="iPhone 18"><defs><linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#6b5a1e"/></linearGradient></defs>
  <rect x="4" y="4" width="92" height="192" rx="18" fill="url(#g${i})"/><rect x="10" y="10" width="80" height="180" rx="13" fill="#050505"/>
  <rect x="38" y="15" width="24" height="7" rx="3.5" fill="#222"/><circle cx="50" cy="95" r="22" fill="none" stroke="#d4af37" stroke-width="2"/><text x="50" y="102" text-anchor="middle" font-size="22" fill="#d4af37">18</text></svg>`;
}
const fmt = (n) => Number(n).toLocaleString('ar-LY');

// ---------- الصفحات ----------
const views = {
  async '/'() {
    stats = await api('/stats');
    const w = stats.winners.length ? `<div class="card"><h2>🎉 الفائزون</h2>${stats.winners.map((x) => `<div class="lb"><span class="rk">${x.rank}</span><span class="av">${esc(x.avatar)}</span><span class="nm">${esc(x.name)}</span><span class="pt">${esc(stats.prizes[x.rank - 1] || '')}</span></div>`).join('')}</div>` : '';
    return `<h1>اربح واحدًا من 3 أجهزة iPhone 18!</h1>
    <div class="phones">${[0, 1, 2].map(phoneSvg).join('')}</div>
    <p class="mut" style="text-align:center">3 فائزين مختلفين — جهاز واحد لكل فائز</p>
    ${stats.endsAt ? `<div class="card"><div class="mut" style="text-align:center">تنتهي المسابقة بعد</div><div id="cd" data-end="${esc(stats.endsAt)}"></div></div>` : ''}
    ${!stats.contestOpen ? '<div class="card err">المسابقة مغلقة حاليًا.</div>' : ''}
    <div class="row">${me ? '<a class="btn" href="#/contests">ابدأ الإجابة</a>' : (stats.registrationOpen ? '<a class="btn" href="#/register">سجّل الآن</a><a class="btn alt" href="#/login">دخول</a>' : '<div class="card err">التسجيل مغلق حاليًا.</div>')}
      <button class="btn alt" data-action="share">مشاركة 📤</button></div>
    <div class="card grid"><div class="stat"><b>${fmt(stats.users)}</b><span>مشارك</span></div><div class="stat"><b>${fmt(stats.answers)}</b><span>إجابة</span></div>
      <div class="stat"><b>${fmt(stats.questions)}</b><span>سؤال</span></div><div class="stat"><b>${fmt(stats.likes)}</b><span>إعجاب</span></div></div>
    <div class="card"><h2>الجوائز</h2><ul class="t">${stats.prizes.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>${w}`;
  },
  async '/contests'() {
    if (!me) return needLogin();
    const d = await api('/questions/next' + (level ? '?level=' + level : '')).catch((e) => ({ error: e.message }));
    const tabs = `<div class="row">${Object.entries(LEVELS).map(([k, v]) => `<button class="btn sm ${k === level ? '' : 'alt'}" data-action="level" data-v="${k}">${v}</button>`).join('')}</div>`;
    if (d.error) return `<h2>المسابقات</h2>${tabs}<div class="card err">${esc(d.error)}</div>`;
    current = d.question;
    if (!current) return `<h2>المسابقات</h2>${tabs}<div class="card">🎉 أجبت عن كل الأسئلة المتاحة في هذا المستوى. تابعنا لأسئلة جديدة!</div>`;
    return `<h2>المسابقات</h2>${tabs}<div class="card" id="qcard"><span class="pill">${LEVELS[current.level]} • ${current.points} نقطة</span>
      <h3>${esc(current.text)}</h3>${current.options.map((o, i) => `<button class="opt" data-action="answer" data-i="${i}">${esc(o)}</button>`).join('')}<div id="res"></div></div>`;
  },
  async '/leaderboard'() {
    const { leaders } = await api('/leaderboard');
    if (!leaders.length) return '<h2>المتصدرون</h2><div class="card mut">لا يوجد مشاركون بعد.</div>';
    const top = leaders.slice(0, 3), order = [top[1], top[0], top[2]], medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const pod = order.map((x) => x ? `<div class="card"><div class="big">${medals[x.rank] || ''}</div><div class="av" style="font-size:2rem">${esc(x.avatar)}</div><b>${esc(x.name)}</b><div class="pt" style="color:var(--gold2)">${fmt(x.points)} نقطة</div></div>` : '<div></div>').join('');
    return `<h2>المتصدرون</h2><div class="podium">${pod}</div><div class="card">${leaders.map(lbRow).join('')}</div>`;
  },
  async '/likes'() {
    const { leaders } = await api('/leaderboard');
    const info = me ? `<p class="mut">إعجاباتك اليوم: كل مشارك مرة واحدة يوميًا (بتوقيت ليبيا). الحد الأقصى لما يستقبله المشارك: ${me.stats.likeCap} يوميًا. استلمت اليوم: ${me.stats.likesToday}.</p>` : '<p class="mut">سجّل الدخول لتتمكن من الإعجاب.</p>';
    return `<h2>الإعجابات ❤️</h2>${info}<div class="card">${leaders.map((x) => lbRow(x, true)).join('') || '<span class="mut">لا يوجد مشاركون.</span>'}</div>`;
  },
  async '/account'() {
    if (!me) return needLogin();
    await loadMe(); const u = me.user, s = me.stats;
    return `<h2>حسابي</h2><div class="card"><div style="font-size:3rem;text-align:center">${esc(u.avatar)}</div><h3 style="text-align:center">${esc(u.displayName)}</h3><p class="mut" style="text-align:center">@${esc(u.username)}</p>
    <div class="grid"><div class="stat"><b>${fmt(u.points)}</b><span>النقاط</span></div><div class="stat"><b>#${fmt(s.rank)}</b><span>الترتيب</span></div>
    <div class="stat"><b>${fmt(s.correct)}/${fmt(s.answered)}</b><span>صحيحة/إجابات</span></div><div class="stat"><b>${fmt(s.likesToday)}</b><span>إعجابات اليوم</span></div></div></div>
    <div class="card"><h3>تعديل الملف</h3><form data-form="profile"><label>الاسم المعروض</label><input name="displayName" maxlength="40" value="${esc(u.displayName)}">
    <label>الرمز</label><div class="avs">${me.avatars.map((a) => `<button type="button" data-action="avatar" data-v="${a}" class="${a === u.avatar ? 'on' : ''}">${a}</button>`).join('')}</div><input type="hidden" name="avatar" value="${esc(u.avatar)}"><br><button class="btn">حفظ</button></form></div>
    <div class="card"><h3>آخر نشاط</h3>${me.activity.map((a) => `<div class="lb"><span class="av">${a.correct ? '✅' : '❌'}</span><span class="nm">${esc(a.text)}</span><span class="pt">+${a.points_awarded}</span></div>`).join('') || '<span class="mut">لا يوجد نشاط بعد.</span>'}</div>
    <button class="btn alt" data-action="logout">تسجيل الخروج</button>${u.role === 'admin' ? ' <a class="btn" href="/admin">لوحة الإدارة</a>' : ''}`;
  },
  async '/more'() {
    return `<h2>المزيد</h2><div class="card menu"><a href="#/friends">👥 الأصدقاء</a><a href="#/terms">📜 الشروط</a><a href="#/notifications">🔔 الإشعارات</a><a href="#/help">❓ المساعدة</a></div>`;
  },
  async '/friends'() {
    if (!me) return needLogin();
    await loadMe(); const link = `${location.origin}/?ref=${me.user.refCode}`, r = me.stats.referrals;
    return `<h2>دعوة الأصدقاء</h2><div class="card"><p>رابطك الخاص:</p><input readonly value="${esc(link)}" id="reflink">
    <div class="row"><button class="btn" data-action="copy">نسخ الرابط</button><button class="btn alt" data-action="share">مشاركة</button></div>
    <p class="mut">تُحتسب الدعوة بعد أن يسجّل صديقك ويجيب عن عدد كافٍ من الأسئلة. لا تُحتسب الدعوات المكررة أو الذاتية.</p>
    <div class="grid"><div class="stat"><b>${r.qualified}</b><span>دعوات مؤهلة</span></div><div class="stat"><b>${r.pending}</b><span>قيد الانتظار</span></div></div></div>`;
  },
  async '/terms'() { stats = await api('/stats'); return `<h2>الشروط والأحكام</h2><div class="card"><ul class="t">${stats.terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`; },
  async '/notifications'() {
    stats = await api('/stats');
    return `<h2>الإشعارات 🔔</h2>${stats.announcements.map((a) => `<div class="card">${esc(a)}</div>`).join('') || '<div class="card mut">لا توجد إشعارات حاليًا.</div>'}`;
  },
  async '/help'() {
    return `<h2>المساعدة</h2><div class="card"><h3>كيف أشارك؟</h3><p>سجّل حسابًا، ثم افتح «المسابقات» وأجب عن الأسئلة لتجمع النقاط (5 / 10 / 20 / 30 حسب الصعوبة).</p>
    <h3>كيف يُحسب الترتيب؟</h3><p>حسب مجموع النقاط. كل سؤال يُحتسب مرة واحدة فقط.</p><h3>الإعجابات</h3><p>تستطيع الإعجاب بكل مشارك مرة واحدة يوميًا، ولا يستقبل المشارك أكثر من 20 إعجابًا في اليوم (بتوقيت ليبيا).</p>
    <h3>الفائزون</h3><p>تختار الإدارة 3 فائزين مختلفين وتعلنهم في الصفحة الرئيسية.</p></div>`;
  },
  async '/login'() {
    return `<h2>تسجيل الدخول</h2><div class="card"><form data-form="login"><label>اسم المستخدم</label><input name="username" autocomplete="username" required>
    <label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" required><button class="btn">دخول</button></form>
    <p class="mut">ليس لديك حساب؟ <a href="#/register" style="color:var(--gold)">سجّل الآن</a></p></div>`;
  },
  async '/register'() {
    return `<h2>إنشاء حساب</h2><div class="card"><form data-form="register"><label>اسم المستخدم (حروف وأرقام و _)</label><input name="username" autocomplete="username" required minlength="3" maxlength="24">
    <label>الاسم المعروض</label><input name="displayName" maxlength="40"><label>كلمة المرور (8 أحرف على الأقل)</label><input name="password" type="password" autocomplete="new-password" required minlength="8">
    <button class="btn">إنشاء الحساب</button></form></div>`;
  },
};
const needLogin = () => '<div class="card">سجّل الدخول للمتابعة.<br><br><a class="btn" href="#/login">دخول</a> <a class="btn alt" href="#/register">تسجيل</a></div>';
function lbRow(x, withLike) {
  const mine = me && me.user.id === x.id;
  return `<div class="lb"><span class="rk">${x.rank}</span><span class="av">${esc(x.avatar)}</span><span class="nm">${esc(x.name)} <small class="mut">❤️ ${x.likes}</small></span><span class="pt">${fmt(x.points)}</span>
  ${withLike && !mine ? `<button class="btn sm" data-action="like" data-id="${x.id}">❤️</button>` : ''}</div>`;
}

async function route() {
  clearInterval(cdTimer);
  const p = location.hash.slice(1) || '/', fn = views[p] || views['/'];
  renderNav(views[p] ? p : '/');
  try { $('#view').innerHTML = await fn(); } catch (e) { $('#view').innerHTML = `<div class="card err">${esc(e.message)}</div>`; }
  const cd = $('#cd'); if (cd) { const end = Date.parse(cd.dataset.end); const tick = () => {
    let s = Math.max(0, Math.floor((end - Date.now()) / 1000)); const v = [['يوم', 86400], ['ساعة', 3600], ['دقيقة', 60], ['ثانية', 1]];
    cd.innerHTML = v.map(([l, n]) => { const x = Math.floor(s / n); s -= x * n; return `<div><b>${x}</b><small>${l}</small></div>`; }).join(''); };
    tick(); cdTimer = setInterval(tick, 1000); }
}

// ---------- الأحداث ----------
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action;
  try {
    if (a === 'level') { level = b.dataset.v; route(); }
    else if (a === 'answer') {
      document.querySelectorAll('.opt').forEach((o) => (o.disabled = true));
      const r = await api(`/questions/${current.id}/answer`, { method: 'POST', body: { choice: +b.dataset.i } });
      const opts = document.querySelectorAll('.opt'); opts[r.correctIndex].classList.add('ok'); if (!r.correct) b.classList.add('bad');
      $('#res').innerHTML = `<p>${r.correct ? `✅ إجابة صحيحة! +${r.pointsAwarded} نقطة` : '❌ إجابة خاطئة'} — مجموعك ${fmt(r.totalPoints)}</p><button class="btn" data-action="next">السؤال التالي</button>`;
    } else if (a === 'next') { await loadMe(); route(); }
    else if (a === 'like') { await api('/likes', { method: 'POST', body: { toUserId: +b.dataset.id } }); toast('تم الإعجاب ❤️'); await loadMe(); route(); }
    else if (a === 'logout') { await api('/logout', { method: 'POST' }); me = null; location.hash = '#/'; route(); }
    else if (a === 'avatar') { document.querySelector('[name=avatar]').value = b.dataset.v; document.querySelectorAll('.avs button').forEach((x) => x.classList.toggle('on', x === b)); }
    else if (a === 'copy') { await navigator.clipboard.writeText($('#reflink').value); toast('تم النسخ'); }
    else if (a === 'share') {
      const url = me ? `${location.origin}/?ref=${me.user.refCode}` : location.origin, text = 'اربح واحدًا من 3 أجهزة iPhone 18! 🇱🇾';
      if (navigator.share) await navigator.share({ title: text, text, url }).catch(() => {});
      else window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), '_blank', 'noopener');
    }
  } catch (err) { toast(err.message); if (a === 'answer') route(); }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
  const body = Object.fromEntries(new FormData(f)), k = f.dataset.form;
  try {
    if (k === 'profile') { await api('/me', { method: 'PATCH', body }); await loadMe(); toast('تم الحفظ'); route(); }
    else {
      if (k === 'register') body.ref = localStorage.getItem('ref') || undefined;
      await api('/' + k, { method: 'POST', body }); await loadMe(); location.hash = '#/contests'; route();
    }
  } catch (err) { toast(err.message); }
});
window.addEventListener('hashchange', route);
(async () => {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref) { localStorage.setItem('ref', ref.slice(0, 20)); history.replaceState(null, '', '/'); }
  await loadMe(); route();
})();
