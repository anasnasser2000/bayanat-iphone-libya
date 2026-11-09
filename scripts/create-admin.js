'use strict';
// الاستخدام: ADMIN_USERNAME=name ADMIN_PASSWORD='كلمة-سر-طويلة' npm run create-admin
// لا تُحفظ كلمة المرور في أي ملف؛ تُقرأ مرة واحدة من البيئة وتُخزَّن مشفّرة (scrypt).
require('./env');
const { pool } = require('../server/db');
const { hashPassword, validUsername, genRefCode } = require('../server/lib');
(async () => {
  const u = process.env.ADMIN_USERNAME, p = process.env.ADMIN_PASSWORD;
  if (!validUsername(u)) throw new Error('ADMIN_USERNAME غير صالح (3-24 حرفًا/رقمًا/_)');
  if (!p || p.length < 12) throw new Error('ADMIN_PASSWORD يجب ألا تقل عن 12 حرفًا');
  const r = await pool.query(
    `INSERT INTO users(username, display_name, password_hash, role, ref_code) VALUES($1,$1,$2,'admin',$3)
     ON CONFLICT (lower(username)) DO UPDATE SET password_hash=EXCLUDED.password_hash, role='admin' RETURNING id`,
    [u, hashPassword(p), genRefCode()]);
  console.log('admin ready, id =', r.rows[0].id);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
