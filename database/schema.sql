-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS saju_matching CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE saju_matching;

-- 사용자 테이블
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50),
    birth_year INT NOT NULL,
    birth_month INT NOT NULL,
    birth_day INT NOT NULL,
    birth_hour INT NOT NULL,
    birth_minute INT DEFAULT 0,
    gender ENUM('male', 'female') NOT NULL,
    
    -- 사주 정보
    year_gan VARCHAR(2),
    year_ji VARCHAR(2),
    month_gan VARCHAR(2),
    month_ji VARCHAR(2),
    day_gan VARCHAR(2),
    day_ji VARCHAR(2),
    hour_gan VARCHAR(2),
    hour_ji VARCHAR(2),
    
    -- 오행 점수
    wood_score INT DEFAULT 0,
    fire_score INT DEFAULT 0,
    earth_score INT DEFAULT 0,
    metal_score INT DEFAULT 0,
    water_score INT DEFAULT 0,
    
    -- 용신
    yongsin VARCHAR(10),
    
    -- 매칭 상태
    is_waiting BOOLEAN DEFAULT TRUE,
    matched_user_id INT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (matched_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 채팅방 테이블
CREATE TABLE chat_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    compatibility_score DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_users (user1_id, user2_id)
);

-- 채팅 메시지 테이블
CREATE TABLE chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 대기열 테이블
CREATE TABLE waiting_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX idx_users_waiting ON users(is_waiting);
CREATE INDEX idx_users_gender ON users(gender);
CREATE INDEX idx_chat_rooms_users ON chat_rooms(user1_id, user2_id);
CREATE INDEX idx_messages_room ON chat_messages(room_id);
CREATE INDEX idx_waiting_joined ON waiting_queue(joined_at);