window.AppState = { user: null, competition: null };

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.success) {
      window.AppState.user = data.data;
      updateUIForUser(data.data);
    } else {
      updateUIForGuest();
    }
  } catch (err) {
    updateUIForGuest();
  }
}

function updateUIForUser(user) {
  const authNav = document.getElementById('auth-nav-btn');
  if (authNav) {
    authNav.innerHTML = `<a href="profile.html" class="btn btn-outline">👤 ${user.full_name} (${user.total_points} ن)</a>`;
  }
}

function updateUIForGuest() {
  const authNav = document.getElementById('auth-nav-btn');
  if (authNav) {
    authNav.innerHTML = `<a href="profile.html#login" class="btn btn-gold">تسجيل الدخول</a>`;
  }
}

function startCountdown(targetDateStr) {
  const targetDate = new Date(targetDateStr).getTime();
  function updateTimer() {
    const now = new Date().getTime();
    const diff = targetDate - now;
    if (diff <= 0) return;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const dEl = document.getElementById('timer-days');
    const hEl = document.getElementById('timer-hours');
    const mEl = document.getElementById('timer-mins');
    const sEl = document.getElementById('timer-secs');

    if (dEl) dEl.innerText = String(days).padStart(2, '0');
    if (hEl) hEl.innerText = String(hours).padStart(2, '0');
    if (mEl) mEl.innerText = String(minutes).padStart(2, '0');
    if (sEl) sEl.innerText = String(seconds).padStart(2, '0');
  }
  updateTimer();
  setInterval(updateTimer, 1000);
}

function toggleMoreModal() {
  const modal = document.getElementById('more-modal');
  if (modal) {
    modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
  }
}

function shareSocial() {
  if (navigator.share) {
    navigator.share({
      title: 'مسابقات ايفونات-ليبيا 🇱🇾',
      text: 'اربح واحدًا من 3 أجهزة iPhone 18! اشترك الآن مجاناً.',
      url: window.location.href,
    }).catch(() => {});
  } else {
    alert('تم نسخ رابط المشاركة للحافظة!');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
