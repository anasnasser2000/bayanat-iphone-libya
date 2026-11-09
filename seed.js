const db = require('./src/config/database');

const BASE_QUESTIONS = [
  { text: "ما هي عاصمة دولة ليبيا؟", a: "طرابلس", b: "بنغازي", c: "مصراتة", d: "سبها", correct: "a", level: "easy", points: 5, cat: "ليبيا" },
  { text: "ما هي ثاني أكبر مدينة في ليبيا من حيث عدد السكان؟", a: "مصراتة", b: "بنغازي", c: "الزاوية", d: "البيضاء", correct: "b", level: "easy", points: 5, cat: "ليبيا" },
  { text: "في أي قارة تقع ليبيا؟", a: "آسيا", b: "أوروبا", c: "إفريقيا", d: "أستراليا", correct: "c", level: "easy", points: 5, cat: "جغرافيا" },
  { text: "من هو شيخ الشهداء والبطل الوطني الليبي الشهير؟", a: "عمر المختار", b: "سليمان الباروني", c: "رمضان السويحلي", d: "أحمد الشريف", correct: "a", level: "easy", points: 5, cat: "تاريخ ليبيا" },
  { text: "ما اسم العملة الرسمية المتداولة في دولة ليبيا؟", a: "الجنيه", b: "الدرهم", c: "الريال", d: "الدينار الليبي", correct: "d", level: "easy", points: 5, cat: "اقتصاد" },
  { text: "ما هي أعلى قمة جبلية في ليبيا؟", a: "جبل بتة في الجبل الغربي", b: "قمة قوز عكرشة", c: "جبل العوينات", d: "جبل نوسو في التبستي", correct: "a", level: "hard", points: 20, cat: "جغرافيا ليبيا" },
  { text: "أين تقع الآثار الرومانية التاريخية الشهيرة في 'لبدة الكبرى'؟", a: "قرب الخمس", b: "في صبراطة", c: "في شحات", d: "في طبرق", correct: "a", level: "medium", points: 10, cat: "آثار ليبيا" },
  { text: "أي من المدن الليبية التالية تُلقب بـ 'عروس البحر المتوسط'؟", a: "طرابلس", b: "بنغازي", c: "درنة", d: "زوارة", correct: "a", level: "easy", points: 5, cat: "ثقافة ليبية" },
  { text: "ما هي المدينة التاريخية المعروفة بآثارها الإغريقية في شرق ليبيا؟", a: "شحات (قورينا)", b: "غدامس", c: "جرمة", d: "مسلاتة", correct: "a", level: "medium", points: 10, cat: "آثار ليبيا" },
  { text: "ما اسم الواحة التاريخية في الصحراء الليبية الملقبة بـ 'لؤلؤة الصحراء'؟", a: "غدامس", b: "أوجلة", c: "جالو", d: "الكفرة", correct: "a", level: "medium", points: 10, cat: "جغرافيا ليبيا" },
  { text: "أي شركة تنتج سلسلة أجهزة iPhone الحديثة؟", a: "سامسونج", b: "آبل (Apple)", c: "جوجل", d: "سوني", correct: "b", level: "easy", points: 5, cat: "تقنية" },
  { text: "ما اسم نظام التشغيل المطور حصرياً لأجهزة iPhone؟", a: "Android", b: "Windows Phone", c: "iOS", d: "macOS", correct: "c", level: "easy", points: 5, cat: "تقنية" },
  { text: "ما اسم المساعد الصوتي الذكي في أجهزة آبل؟", a: "Alexa", b: "Siri", c: "Cortana", d: "Google Assistant", correct: "b", level: "easy", points: 5, cat: "تقنية" },
  { text: "ما المعالج المصمم لأحدث أجهزة الآبل الفاخرة؟", a: "Snapdragon 8 Gen 3", b: "Apple A18 Pro", c: "Exynos 2400", d: "Dimensity 9300", correct: "b", level: "medium", points: 10, cat: "تقنية" },
  { text: "ما اسم خدمة التخزين السحابي الرسمية المدمجة في أجهزة آبل؟", a: "Google Drive", b: "OneDrive", c: "iCloud", d: "Dropbox", correct: "c", level: "easy", points: 5, cat: "تقنية" },
  { text: "ما هي التقنية التي تعتمد عليها آبل للبصمة الحيوية للوجه في أجهزة iPhone؟", a: "Face ID", b: "Touch ID", c: "Iris Scan", d: "Face Lock", correct: "a", level: "easy", points: 5, cat: "تقنية" },
  { text: "ما هو أسرع كائن حي بري في العالم؟", a: "الأسد", b: "الفهد (Chita)", c: "الغزال", d: "النمر", correct: "b", level: "easy", points: 5, cat: "علوم" },
  { text: "كم عدد كواكب المجموعة الشمسية؟", a: "7 كواكب", b: "8 كواكب", c: "9 كواكب", d: "10 كواكب", correct: "b", level: "easy", points: 5, cat: "فلك" },
  { text: "ما هو العنصر الكيميائي الذي يرمز له بالرمز (Au)؟", a: "الحديد", b: "الفضة", c: "الذهب", d: "النحاس", correct: "c", level: "medium", points: 10, cat: "كيمياء" },
  { text: "ما هو أكبر محيط في العالم من حيث المساحة؟", a: "المحيط الأطلسي", b: "المحيط الهندي", c: "المحيط الهادئ", d: "المحيط المتجمد الشمالي", correct: "c", level: "easy", points: 5, cat: "جغرافيا" },
  { text: "كم يبلغ حاصل ضرب 12 في 12؟", a: "124", b: "144", c: "134", d: "154", correct: "b", level: "easy", points: 5, cat: "رياضيات" },
  { text: "ما هي العضو الأساسي في جسم الإنسان المسؤول عن ضخ الدم؟", a: "الكبد", b: "الرئة", c: "القلب", d: "الكلى", correct: "c", level: "easy", points: 5, cat: "أحياء" },
  { text: "ما اسم الغاز الضروري لتنفس الكائنات الحية؟", a: "النيتروجين", b: "الأكسجين", c: "ثاني أكسيد الكربون", d: "الهيليوم", correct: "b", level: "easy", points: 5, cat: "علوم" },
];

function generateQuestionBank() {
  const questions = [...BASE_QUESTIONS];
  
  for (let i = 1; i <= 250; i++) {
    const a = Math.floor(Math.random() * 90) + 10;
    const b = Math.floor(Math.random() * 50) + 5;
    const opChoice = i % 3;
    let ans, text, level, pts;

    if (opChoice === 0) {
      ans = a + b;
      text = `ما هو حاصل جمع العددين (${a} + ${b})؟`;
      level = "easy";
      pts = 5;
    } else if (opChoice === 1) {
      ans = a * b;
      text = `ما هو حاصل ضرب العددين (${a} × ${b})؟`;
      level = "medium";
      pts = 10;
    } else {
      const c = Math.floor(Math.random() * 15) + 2;
      ans = (a * b) + c;
      text = `تحدي حسابي خاص: ما ناتج العملية (${a} × ${b}) + ${c}؟`;
      level = "challenge";
      pts = 30;
    }

    const correctLetter = ['a', 'b', 'c', 'd'][i % 4];
    const opts = {
      a: (ans + (correctLetter === 'a' ? 0 : 5)).toString(),
      b: (ans + (correctLetter === 'b' ? 0 : -3)).toString(),
      c: (ans + (correctLetter === 'c' ? 0 : 10)).toString(),
      d: (ans + (correctLetter === 'd' ? 0 : -8)).toString(),
    };
    opts[correctLetter] = ans.toString();

    questions.push({
      id: i,
      text,
      option_a: opts.a,
      option_b: opts.b,
      option_c: opts.c,
      option_d: opts.d,
      correct_option: correctLetter,
      level,
      points: pts,
      category: "رياضيات وحساب"
    });
  }

  const libyanCities = ["طرابلس", "بنغازي", "مصراتة", "الزاوية", "سبها", "زليتن", "البيضاء", "طبرق", "غريان", "درنة", "أجدابيا", "مسلاتة", "سرت", "الخمس", "صبراتة"];

  for (let i = 1; i <= 750; i++) {
    const city = libyanCities[i % libyanCities.length];
    const itemNum = i + 100;
    const catChoice = i % 4;

    let text, a, b, c, d, correct, level, points, cat;

    if (catChoice === 0) {
      text = `السؤال التقني رقم ${itemNum}: أي مما يلي يشير إلى تقنية النطاق العريض للجيل الخامس؟`;
      a = "5G"; b = "4G"; c = "3G"; d = "2G";
      correct = "a"; level = "easy"; points = 5; cat = "تكنولوجيا";
    } else if (catChoice === 1) {
      text = `معلومات عامة [كود ${itemNum}]: ما هي رمزية الرموز البريدية وتوزيع الخدمات الرقمية في مدينة ${city}؟`;
      a = "خدمات اتصالات رقمية متاحة"; b = "غير مدعوم"; c = "مقتصر على الشركات"; d = "تطبيق يدوي فقط";
      correct = "a"; level = "medium"; points = 10; cat = "ليبيا وتكنولوجيا";
    } else if (catChoice === 2) {
      text = `تحدي معلومات رقمية #${itemNum}: كم بت (Bit) يوجد في البايت الواحد (1 Byte)؟`;
      a = "8 بت"; b = "4 بت"; c = "16 بت"; d = "32 بت";
      correct = "a"; level = "hard"; points = 20; cat = "علوم الحاسوب";
    } else {
      text = `تحدي متقدم VIP #${itemNum}: ما المعيار العالمي الذي يقيس أداء معالجات أجهزة آبل والكمبيوتر؟`;
      a = "Geekbench Benchmark"; b = "SpeedMeter"; c = "CPUMeter"; d = "ByteCheck";
      correct = "a"; level = "challenge"; points = 30; cat = "تقنية فائقة";
    }

    questions.push({
      id: i + 250,
      text,
      option_a: a,
      option_b: b,
      option_c: c,
      option_d: d,
      correct_option: correct,
      level,
      points,
      category: cat
    });
  }

  return questions.map((q, idx) => ({ ...q, id: idx + 1 }));
}

async function runSeed() {
  console.log('🌱 جاري بدء عملية استزراع قاعدة البيانات بالأسئلة والبيانات الأولى...');
  await db.initSchema();

  const store = db.loadStore();
  const questionBank = generateQuestionBank();
  console.log(`📝 جاري إدراج ${questionBank.length} سؤال في قاعدة البيانات...`);

  store.questions = questionBank;

  const sampleUsers = [
    { name: 'محمد الصادق الترهوني', user: 'mohamed_ly', city: 'طرابلس', points: 480, ref: 'MOH1001' },
    { name: 'فاطمة مفتاح الورفلي', user: 'fatima_ly', city: 'بنغازي', points: 420, ref: 'FAT1002' },
    { name: 'علي حسن المصراتي', user: 'ali_misurata', city: 'مصراتة', points: 390, ref: 'ALI1003' },
    { name: 'سارة عبد الله الزوي', user: 'sara_kufra', city: 'الكفرة', points: 310, ref: 'SAR1004' },
    { name: 'عمر المبروك الغرياني', user: 'omar_gharyan', city: 'غريان', points: 280, ref: 'OMA1005' },
  ];

  const defaultPasswordHash = db.hashPassword('UserPassword123!');

  sampleUsers.forEach((u, idx) => {
    if (!store.users.some(usr => usr.username === u.user)) {
      store.users.push({
        id: idx + 1,
        username: u.user,
        full_name: u.name,
        email_or_phone: `${u.user}@example.com`,
        password_hash: defaultPasswordHash,
        city: u.city,
        total_points: u.points,
        referral_code: u.ref,
        role: 'user',
        is_banned: 0,
        created_at: new Date().toISOString()
      });
    }
  });

  if (!store.users.some(u => u.username === 'admin')) {
    store.users.push({
      id: 999,
      username: 'admin',
      full_name: 'مدير النظام',
      email_or_phone: 'admin@iphone-libya.ly',
      password_hash: db.hashPassword('AdminSecurePassword2026!'),
      city: 'طرابلس',
      total_points: 0,
      referral_code: 'ADMINLY',
      role: 'admin',
      is_banned: 0,
      created_at: new Date().toISOString()
    });
  }

  if (store.competitions.length === 0) {
    store.competitions.push({
      id: 1,
      title: 'مسابقة ايفونات-ليبيا الكبرى 🇱🇾',
      description: 'اربح واحدًا من 3 أجهزة iPhone 18 جديدة سعة 512GB!',
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: 1
    });
  }

  db.saveStore(store);
  console.log('✅ تم إدراج المشاركين التجريبيين والأسئلة والمدير بنجاح.');
  console.log('🎉 اكتملت عملية الاستزراع بنجاح تام!');
}

runSeed().catch((err) => {
  console.error('❌ خطأ أثناء الاستزراع:', err);
  process.exit(1);
});
