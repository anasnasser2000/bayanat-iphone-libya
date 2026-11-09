const db = require('../config/database');
const crypto = require('crypto');

function generateReferralCode(username) {
  const cleanStr = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const prefix = cleanStr.substring(0, 4) || 'LY';
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${randomNum}`;
}

function createToken(payload) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 30*24*3600*1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', 'libya_secret_2026').update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const sig = crypto.createHmac('sha256', 'libya_secret_2026').update(`${parts[0]}.${parts[1]}`).digest('base64url');
    if (sig !== parts[2]) return null;
    const body = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (body.exp && body.exp < Date.now()) return null;
    return body;
  } catch(e) {
    return null;
  }
}

async function registerUser({ full_name, username, email_or_phone, password, city, referral_code, ip_address }) {
  if (!full_name || !username || !email_or_phone || !password) {
    throw new Error('يرجى تعبئة كافة الحقول المطلوبة.');
  }

  const store = db.loadStore();
  const cleanUsername = username.trim().toLowerCase();
  const cleanContact = email_or_phone.trim().toLowerCase();

  const existing = store.users.find(u => u.username === cleanUsername || u.email_or_phone === cleanContact);
  if (existing) {
    throw new Error('اسم المستخدم أو البريد الإلكتروني/رقم الهاتف مستخدم مسبقاً.');
  }

  const passwordHash = db.hashPassword(password);
  let userRefCode = generateReferralCode(username);
  while (store.users.some(u => u.referral_code === userRefCode)) {
    userRefCode = generateReferralCode(username);
  }

  let referrerId = null;
  if (referral_code) {
    const referrer = store.users.find(u => u.referral_code === referral_code.trim().toUpperCase());
    if (referrer) referrerId = referrer.id;
  }

  const newUserId = store.users.length > 0 ? Math.max(...store.users.map(u => u.id)) + 1 : 1;

  const newUser = {
    id: newUserId,
    username: cleanUsername,
    full_name: full_name.trim(),
    email_or_phone: cleanContact,
    password_hash: passwordHash,
    city: city || 'طرابلس',
    total_points: 0,
    referral_code: userRefCode,
    referred_by: referrerId,
    role: 'user',
    is_banned: 0,
    created_at: new Date().toISOString()
  };

  store.users.push(newUser);

  if (referrerId && referrerId !== newUserId) {
    const refId = store.referrals.length > 0 ? Math.max(...store.referrals.map(r => r.id)) + 1 : 1;
    store.referrals.push({
      id: refId,
      referrer_id: referrerId,
      referee_id: newUserId,
      points_awarded: 50,
      status: 'completed',
      ip_address: ip_address || '127.0.0.1',
      created_at: new Date().toISOString()
    });

    const refUser = store.users.find(u => u.id === referrerId);
    if (refUser) refUser.total_points += 50;
  }

  db.saveStore(store);

  const token = createToken({ id: newUserId, username: cleanUsername, role: 'user', full_name: full_name.trim() });

  return {
    user: {
      id: newUserId,
      username: cleanUsername,
      full_name: full_name.trim(),
      email_or_phone: cleanContact,
      city: city || 'طرابلس',
      total_points: 0,
      referral_code: userRefCode,
      role: 'user'
    },
    token
  };
}

async function loginUser({ username_or_email, password }) {
  if (!username_or_email || !password) {
    throw new Error('يرجى كتابة اسم المستخدم/البريد الإلكتروني وكلمة المرور.');
  }

  const store = db.loadStore();
  const cleanInput = username_or_email.trim().toLowerCase();

  const user = store.users.find(u => u.username === cleanInput || u.email_or_phone === cleanInput);
  if (!user) {
    throw new Error('بيانات الدخول غير صحيحة.');
  }

  if (user.is_banned === 1) {
    throw new Error('عذراً، تم إيقاف هذا الحساب نظراً لمخالفة شروط المسابقة.');
  }

  if (!db.comparePassword(password, user.password_hash)) {
    throw new Error('بيانات الدخول غير صحيحة.');
  }

  const token = createToken({ id: user.id, username: user.username, role: user.role, full_name: user.full_name });

  return {
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email_or_phone: user.email_or_phone,
      city: user.city,
      total_points: user.total_points,
      referral_code: user.referral_code,
      role: user.role
    },
    token
  };
}

async function getUserProfile(userId) {
  const store = db.loadStore();
  const user = store.users.find(u => u.id === userId);
  if (!user) throw new Error('المستخدم غير موجود.');

  const higherPoints = store.users.filter(u => u.is_banned === 0 && u.total_points > user.total_points).length;
  const userAnswers = store.user_answers.filter(a => a.user_id === userId);
  const correctCount = userAnswers.filter(a => a.is_correct === 1).length;
  const referralCount = store.referrals.filter(r => r.referrer_id === userId).length;

  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    email_or_phone: user.email_or_phone,
    city: user.city,
    total_points: user.total_points,
    referral_code: user.referral_code,
    role: user.role,
    is_banned: user.is_banned,
    rank: higherPoints + 1,
    total_answered: userAnswers.length,
    correct_answers: correctCount,
    referral_count: referralCount
  };
}

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  createToken,
  verifyToken
};
