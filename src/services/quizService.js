const db = require('../config/database');

async function getQuestionsForUser(userId, level = null, limit = 10) {
  const store = db.loadStore();
  const answeredQIds = new Set(store.user_answers.filter(a => a.user_id === userId).map(a => a.question_id));

  let available = store.questions.filter(q => !answeredQIds.has(q.id));
  if (level) {
    available = available.filter(q => q.level === level);
  }

  available.sort(() => 0.5 - Math.random());

  return available.slice(0, parseInt(limit, 10)).map(q => ({
    id: q.id,
    text: q.text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    level: q.level,
    points: q.points,
    category: q.category
  }));
}

async function submitAnswer(userId, questionId, selectedOption) {
  if (!questionId || !selectedOption) {
    throw new Error('بيانات الإجابة غير مكتملة.');
  }

  const optionClean = selectedOption.trim().toLowerCase();
  if (!['a', 'b', 'c', 'd'].includes(optionClean)) {
    throw new Error('خيار الإجابة غير صحيح.');
  }

  const store = db.loadStore();
  const existing = store.user_answers.find(a => a.user_id === userId && a.question_id === parseInt(questionId, 10));
  if (existing) {
    throw new Error('لقد قمت بالإجابة عن هذا السؤال سابقاً! لا يمكن تكرار الإجابة.');
  }

  const question = store.questions.find(q => q.id === parseInt(questionId, 10));
  if (!question) {
    throw new Error('السؤال المطلوب غير موجود.');
  }

  const isCorrect = question.correct_option.trim().toLowerCase() === optionClean;
  const pointsAwarded = isCorrect ? question.points : 0;

  const newAnsId = store.user_answers.length > 0 ? Math.max(...store.user_answers.map(a => a.id)) + 1 : 1;
  store.user_answers.push({
    id: newAnsId,
    user_id: userId,
    question_id: parseInt(questionId, 10),
    selected_option: optionClean,
    is_correct: isCorrect ? 1 : 0,
    points_awarded: pointsAwarded,
    answered_at: new Date().toISOString()
  });

  const user = store.users.find(u => u.id === userId);
  if (isCorrect && pointsAwarded > 0 && user) {
    user.total_points += pointsAwarded;
  }

  db.saveStore(store);

  return {
    is_correct: isCorrect,
    correct_option: question.correct_option,
    points_awarded: pointsAwarded,
    new_total_points: user ? user.total_points : 0,
    explanation: isCorrect ? 'إجابة رائعة وصحيحة! تم إضافة النقاط لرصيدك.' : `إجابة خاطئة. الإجابة الصحيحة كانت الخيار (${question.correct_option.toUpperCase()}).`
  };
}

module.exports = {
  getQuestionsForUser,
  submitAnswer
};
