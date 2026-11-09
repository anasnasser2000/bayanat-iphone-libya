const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./src/config/database');
const authService = require('./src/services/authService');
const quizService = require('./src/services/quizService');
const likesService = require('./src/services/likesService');
const referralService = require('./src/services/referralService');
const winnerService = require('./src/services/winnerService');

const PORT = process.env.PORT || 3000;

function parseCookies(request) {
  const list = {};
  const rc = request.headers.cookie;
  rc && rc.split(';').forEach(function( cookie ) {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  function json(data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }

  let bodyData = '';
  req.on('data', chunk => { bodyData += chunk; });
  req.on('end', async () => {
    let body = {};
    if (bodyData) {
      try { body = JSON.parse(bodyData); } catch(e) {}
    }

    const cookies = parseCookies(req);
    let user = null;
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    if (!token && cookies.token) token = cookies.token;
    if (token) {
      user = authService.verifyToken(token);
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      try {
        const result = await authService.registerUser(body);
        res.setHeader('Set-Cookie', `token=${result.token}; Path=/; HttpOnly; Max-Age=2592000`);
        return json({ success: true, message: 'تم تسجيل حسابك بنجاح!', data: result }, 201);
      } catch(e) {
        return json({ success: false, message: e.message }, 400);
      }
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      try {
        const result = await authService.loginUser(body);
        res.setHeader('Set-Cookie', `token=${result.token}; Path=/; HttpOnly; Max-Age=2592000`);
        return json({ success: true, message: 'تم تسجيل الدخول بنجاح.', data: result });
      } catch(e) {
        return json({ success: false, message: e.message }, 400);
      }
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      if (!user) return json({ success: false, message: 'غير مصرح' }, 401);
      try {
        const profile = await authService.getUserProfile(user.id);
        return json({ success: true, data: profile });
      } catch(e) {
        return json({ success: false, message: e.message }, 400);
      }
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      res.setHeader('Set-Cookie', `token=; Path=/; HttpOnly; Max-Age=0`);
      return json({ success: true, message: 'تم تسجيل الخروج' });
    }

    if (pathname === '/api/quiz/questions' && req.method === 'GET') {
      if (!user) return json({ success: false, message: 'غير مصرح' }, 401);
      try {
        const level = parsedUrl.query.level;
        const limit = parsedUrl.query.limit || 10;
        const q = await quizService.getQuestionsForUser(user.id, level, limit);
        return json({ success: true, count: q.length, data: q });
      } catch(e) {
        return json({ success: false, message: e.message }, 400);
      }
    }

    if (pathname === '/api/quiz/answer' && req.method === 'POST') {
      if (!user) return json({ success: false, message: 'غير مصرح' }, 401);
      try {
        const resData = await quizService.submitAnswer(user.id, body.question_id, body.selected_option);
        return json({ success: true, data: resData });
      } catch(e) {
        return json({ success: false, message: e.message }, 400);
      }
    }

    if (pathname === '/api/leaderboard' && req.method === 'GET') {
      const store = db.loadStore();
      const users = store.users
        .filter(u => u.is_banned === 0 && u.role !== 'admin')
        .sort((a,b) => b.total_points - a.total_points)
        .slice(0, 50)
        .map((u, idx) => ({
          rank: idx + 1,
          id: u.id,
          username: u.username,
          full_name: u.full_name,
          city: u.city,
          total_points: u.total_points,
          total_likes_received: store.likes.filter(l => l.receiver_id === u.id).length,
          is_current_user: user ? user.id === u.id : false
        }));

      return json({ success: true, count: users.length, top_three: users.slice(0, 3), data: users });
    }

    if (pathname === '/api/likes/send' && req.method === 'POST') {
      if (!user) return json({ success: false, message: 'غير مصرح' }, 401);
      try {
        const resData = await likesService.sendLike(user.id, body.receiver_id);
        return json(resData);
      } catch(e) {
        return json({ success: false, message: e.message }, 400);
      }
    }

    if (pathname === '/api/likes/info' && req.method === 'GET') {
      if (!user) return json({ success: false, message: 'غير مصرح' }, 401);
      try {
        const info = await likesService.getUserLikesInfo(user.id);
        return json({ success: true, data: info });
      } catch(e) {
        return json({ success: false, message: e.message }, 400);
      }
    }

    if (pathname === '/api/referrals/stats' && req.method === 'GET') {
      if (!user) return json({ success: false, message: 'غير مصرح' }, 401);
      try {
        const stats = await referralService.getReferralStats(user.id);
        return json({ success: true, data: stats });
      } catch(e) {
        return json({ success: false, message: e.message }, 400);
      }
    }

    if (pathname === '/api/competition/active' && req.method === 'GET') {
      const store = db.loadStore();
      let comp = store.competitions[0];
      if (!comp) {
        comp = {
          id: 1,
          title: 'مسابقة ايفونات-ليبيا الكبرى 🇱🇾',
          description: 'اربح واحدًا من 3 أجهزة iPhone 18 جديدة سعة 512GB!',
          end_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          is_active: 1
        };
        store.competitions.push(comp);
        db.saveStore(store);
      }
      const winners = await winnerService.getWinners(comp.id);
      return json({
        success: true,
        data: {
          competition: comp,
          winners,
          stats: {
            total_participants: store.users.filter(u => u.role !== 'admin').length,
            total_answers: store.user_answers.length,
            total_likes: store.likes.length
          }
        }
      });
    }

    // Admin
    if (pathname === '/api/admin/stats' && req.method === 'GET') {
      if (!user || user.role !== 'admin') return json({ success: false, message: 'غير مصرح كمدير' }, 403);
      const store = db.loadStore();
      const comp = store.competitions[0];
      const winners = comp ? await winnerService.getWinners(comp.id) : [];
      return json({
        success: true,
        data: {
          total_users: store.users.filter(u => u.role !== 'admin').length,
          total_questions: store.questions.length,
          total_answers: store.user_answers.length,
          total_likes: store.likes.length,
          active_competition: comp,
          winners
        }
      });
    }

    if (pathname === '/api/admin/users' && req.method === 'GET') {
      if (!user || user.role !== 'admin') return json({ success: false, message: 'غير مصرح كمدير' }, 403);
      const store = db.loadStore();
      return json({ success: true, count: store.users.length, data: store.users.filter(u => u.role !== 'admin') });
    }

    if (pathname.startsWith('/api/admin/users/') && pathname.endsWith('/toggle-ban') && req.method === 'POST') {
      if (!user || user.role !== 'admin') return json({ success: false, message: 'غير مصرح كمدير' }, 403);
      const targetId = parseInt(pathname.split('/')[4], 10);
      const store = db.loadStore();
      const targetUser = store.users.find(u => u.id === targetId);
      if (targetUser) {
        targetUser.is_banned = targetUser.is_banned === 1 ? 0 : 1;
        db.saveStore(store);
        return json({ success: true, message: `تم تحديث حالة الحظر لـ ${targetUser.username}`, is_banned: targetUser.is_banned });
      }
      return json({ success: false, message: 'المستخدم غير موجود' }, 404);
    }

    if (pathname.includes('/draw-winners') && req.method === 'POST') {
      if (!user || user.role !== 'admin') return json({ success: false, message: 'غير مصرح كمدير' }, 403);
      try {
        const compId = parseInt(pathname.split('/')[4], 10) || 1;
        const result = await winnerService.drawWinners(compId, user.id);
        return json({ success: true, ...result });
      } catch(e) {
        return json({ success: false, message: e.message }, 400);
      }
    }

    // Static
    let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'text/plain';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 الصفحة غير موجودة');
    }
  });
});

db.initSchema().then(() => {
  server.listen(PORT, () => {
    console.log(`
========================================================
🚀 منصة «مسابقات ايفونات-ليبيا 🇱🇾» تعمل بنجاح!
🌐 الرابط المحلي: http://localhost:${PORT}
🔑 لوحة الإدارة: http://localhost:${PORT}/admin.html
========================================================
    `);
  });
});
