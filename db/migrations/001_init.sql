CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  points        INTEGER NOT NULL DEFAULT 0,
  avatar        TEXT NOT NULL DEFAULT '⭐',
  ref_code      TEXT NOT NULL UNIQUE,
  banned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_lower ON users (lower(username));
CREATE INDEX users_points_idx ON users (points DESC);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE questions (
  id            SERIAL PRIMARY KEY,
  text          TEXT NOT NULL,
  options       JSONB NOT NULL,
  correct_index SMALLINT NOT NULL,
  level         TEXT NOT NULL CHECK (level IN ('easy','medium','hard','special')),
  points        SMALLINT NOT NULL CHECK (points IN (5,10,20,30)),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX questions_level_idx ON questions (level) WHERE active;

-- المفتاح الأساسي (user_id, question_id) يمنع احتساب السؤال مرتين
CREATE TABLE answers (
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id    INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  chosen         SMALLINT NOT NULL,
  correct        BOOLEAN NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

-- like_day = تاريخ اليوم بتوقيت ليبيا؛ UNIQUE يمنع التكرار اليومي
CREATE TABLE likes (
  id         SERIAL PRIMARY KEY,
  from_user  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  like_day   DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user <> to_user),
  UNIQUE (from_user, to_user, like_day)
);
CREATE INDEX likes_to_day_idx ON likes (to_user, like_day);

CREATE TABLE referrals (
  id           SERIAL PRIMARY KEY,
  referrer_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id  INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified','rejected')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at TIMESTAMPTZ,
  CHECK (referrer_id <> referred_id)
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
INSERT INTO settings (key, value) VALUES
  ('registration_open', 'true'),
  ('contest_open', 'true'),
  ('ends_at', 'null'),
  ('terms', '["يجب أن يكون المشارك قد بلغ 18 عامًا.","حساب واحد فقط لكل شخص، وتُلغى الحسابات المكررة.","يُمنع التلاعب بالإعجابات أو الإحالات وتحتفظ الإدارة بحق الاستبعاد.","يختار فريق الإدارة 3 فائزين مختلفين، جهاز واحد لكل فائز."]'),
  ('prizes', '["المركز الأول: iPhone 18","المركز الثاني: iPhone 18","المركز الثالث: iPhone 18"]'),
  ('announcements', '[]');

CREATE TABLE winners (
  id          SERIAL PRIMARY KEY,
  rank        SMALLINT NOT NULL UNIQUE CHECK (rank BETWEEN 1 AND 3),
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id),
  method      TEXT NOT NULL CHECK (method IN ('manual','draw')),
  note        TEXT,
  selected_by INTEGER REFERENCES users(id),
  selected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id         SERIAL PRIMARY KEY,
  admin_id   INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
