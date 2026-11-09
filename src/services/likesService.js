const db = require('../config/database');
const { getLibyaDateString } = require('../config/timezone');

async function sendLike(senderId, receiverId) {
  if (parseInt(senderId, 10) === parseInt(receiverId, 10)) {
    throw new Error('لا يمكنك الإعجاب بحسابك الشخصي.');
  }

  const store = db.loadStore();
  const receiver = store.users.find(u => u.id === parseInt(receiverId, 10));
  if (!receiver) throw new Error('المشارك المستهدف غير موجود.');
  if (receiver.is_banned === 1) throw new Error('لا يمكن الإعجاب بحساب معطل.');

  const todayStr = getLibyaDateString();

  const existing = store.likes.find(l => l.sender_id === parseInt(senderId, 10) && l.receiver_id === parseInt(receiverId, 10) && l.like_date === todayStr);
  if (existing) {
    throw new Error('لقد قمت بالإعجاب بهذا المشارك اليوم بالفعل! يمكنك الإعجاب به مجدداً غداً.');
  }

  const receivedToday = store.likes.filter(l => l.receiver_id === parseInt(receiverId, 10) && l.like_date === todayStr).length;
  if (receivedToday >= 20) {
    throw new Error('وصل هذا المشارك للحد الأقصى المسموح به من الإعجابات اليومية (20 إعجاباً). حظ موفق غداً!');
  }

  const newLikeId = store.likes.length > 0 ? Math.max(...store.likes.map(l => l.id)) + 1 : 1;
  store.likes.push({
    id: newLikeId,
    sender_id: parseInt(senderId, 10),
    receiver_id: parseInt(receiverId, 10),
    like_date: todayStr,
    created_at: new Date().toISOString()
  });

  receiver.total_points += 2;
  db.saveStore(store);

  return {
    success: true,
    message: `تم إرسال الإعجاب بنجاح إلى ${receiver.full_name}!`,
    likes_received_today: receivedToday + 1,
    max_daily: 20
  };
}

async function getUserLikesInfo(userId) {
  const store = db.loadStore();
  const todayStr = getLibyaDateString();

  const receivedToday = store.likes.filter(l => l.receiver_id === userId && l.like_date === todayStr).length;
  const totalReceived = store.likes.filter(l => l.receiver_id === userId).length;
  const givenToday = store.likes.filter(l => l.sender_id === userId && l.like_date === todayStr).length;

  return {
    received_today: receivedToday,
    max_daily_allowed: 20,
    total_received: totalReceived,
    given_today: givenToday,
    libya_today_date: todayStr
  };
}

module.exports = {
  sendLike,
  getUserLikesInfo
};
