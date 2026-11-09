const db = require('../config/database');

async function drawWinners(competitionId, adminUserId) {
  const store = db.loadStore();
  const comp = store.competitions.find(c => c.id === parseInt(competitionId, 10));
  if (!comp) throw new Error('المسابقة غير موجودة.');

  const existingWinners = store.winners.filter(w => w.competition_id === parseInt(competitionId, 10));
  if (existingWinners.length === 3) {
    const populated = existingWinners.map(w => {
      const u = store.users.find(usr => usr.id === w.user_id);
      return {
        ...w,
        full_name: u ? u.full_name : 'فائز',
        username: u ? u.username : 'user',
        city: u ? u.city : 'طرابلس',
        total_points: u ? u.total_points : 0
      };
    });
    return {
      message: 'تم اختيار الفائزين الثلاثة لهذه المسابقة مسبقاً.',
      winners: populated
    };
  }

  const eligible = store.users.filter(u => u.is_banned === 0 && u.role !== 'admin' && u.total_points > 0);
  if (eligible.length < 3) {
    throw new Error('عدد المشاركين المؤهلين أقل من 3. يلزم وجود 3 مشاركين حقيقيين على الأقل لإجراء القرعة.');
  }

  const pool = [];
  eligible.forEach(u => {
    const tickets = Math.max(1, Math.floor(u.total_points / 5));
    for (let i = 0; i < tickets; i++) pool.push(u);
  });

  const selected = [];
  const selectedIds = new Set();

  while (selected.length < 3 && pool.length > 0) {
    const rIdx = Math.floor(Math.random() * pool.length);
    const candidate = pool[rIdx];
    if (!selectedIds.has(candidate.id)) {
      selectedIds.add(candidate.id);
      selected.push(candidate);
    }
    for (let i = pool.length - 1; i >= 0; i--) {
      if (pool[i].id === candidate.id) pool.splice(i, 1);
    }
  }

  store.winners = store.winners.filter(w => w.competition_id !== parseInt(competitionId, 10));

  const winnersOutput = [];
  for (let rank = 1; rank <= 3; rank++) {
    const wUser = selected[rank - 1];
    const wId = store.winners.length > 0 ? Math.max(...store.winners.map(w => w.id)) + 1 : 1;
    const wObj = {
      id: wId,
      competition_id: parseInt(competitionId, 10),
      user_id: wUser.id,
      rank_position: rank,
      prize_name: `جهاز iPhone 18 الذكي - المركز ${rank}`,
      drawn_at: new Date().toISOString(),
      drawn_by_admin_id: adminUserId
    };
    store.winners.push(wObj);

    winnersOutput.push({
      rank_position: rank,
      prize_name: `جهاز iPhone 18 الذكي - المركز ${rank}`,
      user_id: wUser.id,
      full_name: wUser.full_name,
      username: wUser.username,
      city: wUser.city,
      total_points: wUser.total_points
    });
  }

  db.saveStore(store);

  return {
    message: 'تمت القرعة بنجاح واختيار 3 فائزين مختلفين بأجهزة iPhone 18!',
    winners: winnersOutput
  };
}

async function getWinners(competitionId) {
  const store = db.loadStore();
  const winners = store.winners.filter(w => w.competition_id === parseInt(competitionId, 10));
  return winners.map(w => {
    const u = store.users.find(usr => usr.id === w.user_id);
    return {
      rank_position: w.rank_position,
      prize_name: w.prize_name,
      drawn_at: w.drawn_at,
      full_name: u ? u.full_name : 'فائز',
      username: u ? u.username : 'user',
      city: u ? u.city : 'طرابلس',
      total_points: u ? u.total_points : 0
    };
  });
}

module.exports = {
  drawWinners,
  getWinners
};
