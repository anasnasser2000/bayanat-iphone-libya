const db = require('../config/database');

async function getReferralStats(userId) {
  const store = db.loadStore();
  const user = store.users.find(u => u.id === userId);
  if (!user) throw new Error('المستخدم غير موجود.');

  const refs = store.referrals.filter(r => r.referrer_id === userId);
  const list = refs.map(r => {
    const referee = store.users.find(u => u.id === r.referee_id);
    return {
      id: r.id,
      created_at: r.created_at,
      points_awarded: r.points_awarded,
      full_name: referee ? referee.full_name : 'مشارك',
      username: referee ? referee.username : 'user',
      city: referee ? referee.city : 'طرابلس',
      total_points: referee ? referee.total_points : 0
    };
  });

  const totalPoints = refs.reduce((acc, curr) => acc + (curr.points_awarded || 0), 0);

  return {
    referral_code: user.referral_code,
    total_referrals: refs.length,
    total_points_earned: totalPoints,
    list
  };
}

module.exports = {
  getReferralStats
};
