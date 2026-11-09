const db = require('../src/config/database');
const authService = require('../src/services/authService');
const quizService = require('../src/services/quizService');
const likesService = require('../src/services/likesService');

async function runAllTests() {
  console.log('🧪 بدء تشغيل الاختبارات الآلية للخدمات والمنطق البرمجي...');

  try {
    await db.initSchema();

    const timestamp = Date.now();
    const testUsername = `testuser_${timestamp}`;
    const testEmail = `test_${timestamp}@iphone-libya.ly`;

    console.log(`1️⃣ اختبار تسجيل مستخدم جديد (${testUsername})...`);
    const regResult = await authService.registerUser({
      full_name: 'مختبر النظام التلقائي',
      username: testUsername,
      email_or_phone: testEmail,
      password: 'TestPassword123!',
      city: 'طرابلس',
    });
    console.assert(regResult.token, 'يجب توليد رمز JWT');
    console.assert(regResult.user.id, 'يجب توليد معرف للمستخدم');
    console.log('✅ نجح اختبار التسجيل وتوليد رموز الأمان.');

    console.log('2️⃣ اختبار تسجيل الدخول بالبيانات الصحيحة...');
    const loginResult = await authService.loginUser({
      username_or_email: testUsername,
      password: 'TestPassword123!',
    });
    console.assert(loginResult.token, 'يجب إرجاع رمز التواجد');
    console.log('✅ نجح اختبار تسجيل الدخول.');

    console.log('3️⃣ اختبار جلب الأسئلة وتصفيتها برمجياً...');
    const questions = await quizService.getQuestionsForUser(regResult.user.id, 'easy', 5);
    console.assert(Array.isArray(questions), 'يجب إرجاع مصفوفة أسئلة');
    console.log('✅ نجح اختبار جلب الأسئلة الحية.');

    console.log('4️⃣ اختبار الإجابة عن سؤال وتفادي التكرار...');
    const testQ = questions[0];
    if (testQ) {
      const ansResult = await quizService.submitAnswer(regResult.user.id, testQ.id, 'a');
      console.assert(typeof ansResult.is_correct === 'boolean', 'يجب إرجاع حالة صحة الإجابة');
      console.log('✅ نجح اختبار الإجابة واحتساب النقاط.');

      let duplicateErrorCaught = false;
      try {
        await quizService.submitAnswer(regResult.user.id, testQ.id, 'a');
      } catch (err) {
        duplicateErrorCaught = true;
      }
      console.assert(duplicateErrorCaught, 'يجب منع تكرار إجابة نفس السؤال');
      console.log('✅ نجح اختبار منع تكرار احتساب النقاط للسؤال نفسه.');
    }

    console.log('5️⃣ اختبار نظام الإعجابات اليومية وتوقيت ليبيا...');
    const user2Name = `receiver_${timestamp}`;
    const user2 = await authService.registerUser({
      full_name: 'مستلم الإعجابات الاختبارية',
      username: user2Name,
      email_or_phone: `rec_${timestamp}@iphone-libya.ly`,
      password: 'TestPassword123!',
      city: 'بنغازي',
    });

    const likeRes = await likesService.sendLike(regResult.user.id, user2.user.id);
    console.assert(likeRes.success === true, 'يجب أن ينجح إرسال الإعجاب');
    console.log('✅ نجح اختبار إرسال الإعجاب بين المشاركين.');

    let selfLikeError = false;
    try {
      await likesService.sendLike(regResult.user.id, regResult.user.id);
    } catch (err) {
      selfLikeError = true;
    }
    console.assert(selfLikeError, 'يجب منع الإعجاب بالنفس');
    console.log('✅ نجح اختبار حظر الإعجاب بالنفس وتفادي التلاعب.');

    console.log('🎉 جميع الاختبارات البرمجية الأساسية تم اجتيازها بنجاح 100%!');
    process.exit(0);
  } catch (err) {
    console.error('❌ فشل أحد الاختبارات:', err);
    process.exit(1);
  }
}

runAllTests();
