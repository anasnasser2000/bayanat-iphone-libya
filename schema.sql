-- مخطط قاعدة البيانات لـ «مسابقات ايفونات-ليبيا 🇱🇾»
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email_or_phone VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    city VARCHAR(100) DEFAULT 'طرابلس',
    total_points INT DEFAULT 0,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referred_by INT REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_banned INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option VARCHAR(5) NOT NULL,
    level VARCHAR(20) NOT NULL,
    points INT NOT NULL,
    category VARCHAR(100) DEFAULT 'عام',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_answers (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_option VARCHAR(5) NOT NULL,
    is_correct INT NOT NULL,
    points_awarded INT DEFAULT 0,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_question UNIQUE (user_id, question_id)
);

CREATE TABLE IF NOT EXISTS likes (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    like_date VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_daily_like UNIQUE (sender_id, receiver_id, like_date)
);

CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referee_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points_awarded INT DEFAULT 50,
    status VARCHAR(20) DEFAULT 'completed',
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competitions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NOT NULL,
    is_active INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS winners (
    id SERIAL PRIMARY KEY,
    competition_id INT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank_position INT NOT NULL,
    prize_name VARCHAR(255) DEFAULT 'جهاز iPhone 18',
    drawn_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    drawn_by_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_comp_winner UNIQUE (competition_id, rank_position)
);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_points ON users(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_likes_receiver_date ON likes(receiver_id, like_date);
CREATE INDEX IF NOT EXISTS idx_questions_level ON questions(level);
