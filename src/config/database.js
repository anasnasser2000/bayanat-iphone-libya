const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbFilePath = path.join(__dirname, '../../data/db_store.json');

function loadStore() {
  if (!fs.existsSync(dbFilePath)) {
    const initial = {
      users: [],
      questions: [],
      user_answers: [],
      likes: [],
      referrals: [],
      competitions: [],
      winners: [],
      settings: []
    };
    fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
    fs.writeFileSync(dbFilePath, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(dbFilePath, 'utf8'));
  } catch(e) {
    return { users: [], questions: [], user_answers: [], likes: [], referrals: [], competitions: [], winners: [], settings: [] };
  }
}

function saveStore(store) {
  fs.writeFileSync(dbFilePath, JSON.stringify(store, null, 2));
}

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'libya_salt_2026', 1000, 32, 'sha256').toString('hex');
}

function comparePassword(password, hash) {
  return hashPassword(password) === hash;
}

async function initSchema() {
  loadStore();
  console.log('✅ تم التثبت من تهيئة جداول قاعدة البيانات ومحرك التخزين المحلي بنجاح.');
}

module.exports = {
  loadStore,
  saveStore,
  hashPassword,
  comparePassword,
  initSchema
};
