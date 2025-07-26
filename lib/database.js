const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'saju_matching',
            charset: 'utf8mb4',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    async getConnection() {
        return await this.pool.getConnection();
    }

    async query(sql, params = []) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    // 사용자 생성
    async createUser(userData) {
        const sql = `
            INSERT INTO users (
                birth_year, birth_month, birth_day, birth_hour, birth_minute, gender,
                year_gan, year_ji, month_gan, month_ji, day_gan, day_ji, hour_gan, hour_ji,
                wood_score, fire_score, earth_score, metal_score, water_score, yongsin
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            userData.birth_year, userData.birth_month, userData.birth_day, 
            userData.birth_hour, userData.birth_minute, userData.gender,
            userData.year_gan, userData.year_ji, userData.month_gan, userData.month_ji,
            userData.day_gan, userData.day_ji, userData.hour_gan, userData.hour_ji,
            userData.wood_score, userData.fire_score, userData.earth_score,
            userData.metal_score, userData.water_score, userData.yongsin
        ];
        
        const result = await this.query(sql, params);
        return result.insertId;
    }

    // 사용자 조회
    async getUser(userId) {
        const sql = 'SELECT * FROM users WHERE id = ?';
        const users = await this.query(sql, [userId]);
        return users[0];
    }

    // 대기 중인 사용자들 조회 (성별이 다른 사용자들)
    async getWaitingUsers(currentUserId, currentUserGender) {
        const oppositeGender = currentUserGender === 'male' ? 'female' : 'male';
        const sql = `
            SELECT u.* FROM users u
            LEFT JOIN waiting_queue w ON u.id = w.user_id
            WHERE u.is_waiting = TRUE 
            AND u.gender = ? 
            AND u.id != ?
            ORDER BY w.joined_at ASC
        `;
        return await this.query(sql, [oppositeGender, currentUserId]);
    }

    // 대기열에 사용자 추가
    async addToWaitingQueue(userId) {
        await this.query('UPDATE users SET is_waiting = TRUE WHERE id = ?', [userId]);
        await this.query('INSERT IGNORE INTO waiting_queue (user_id) VALUES (?)', [userId]);
    }

    // 대기열에서 사용자 제거
    async removeFromWaitingQueue(userId) {
        await this.query('UPDATE users SET is_waiting = FALSE WHERE id = ?', [userId]);
        await this.query('DELETE FROM waiting_queue WHERE user_id = ?', [userId]);
    }

    // 채팅방 생성
    async createChatRoom(user1Id, user2Id, compatibilityScore) {
        const sql = `
            INSERT INTO chat_rooms (user1_id, user2_id, compatibility_score) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE compatibility_score = ?
        `;
        const result = await this.query(sql, [user1Id, user2Id, compatibilityScore, compatibilityScore]);
        
        // 매칭된 사용자들을 대기열에서 제거
        await this.removeFromWaitingQueue(user1Id);
        await this.removeFromWaitingQueue(user2Id);
        
        // 사용자들의 매칭 상태 업데이트
        await this.query('UPDATE users SET matched_user_id = ? WHERE id = ?', [user2Id, user1Id]);
        await this.query('UPDATE users SET matched_user_id = ? WHERE id = ?', [user1Id, user2Id]);
        
        return result.insertId || await this.getChatRoomId(user1Id, user2Id);
    }

    // 채팅방 ID 조회
    async getChatRoomId(user1Id, user2Id) {
        const sql = `
            SELECT id FROM chat_rooms 
            WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
        `;
        const rooms = await this.query(sql, [user1Id, user2Id, user2Id, user1Id]);
        return rooms[0]?.id;
    }

    // 채팅방 정보 조회
    async getChatRoom(roomId) {
        const sql = `
            SELECT cr.*, 
                   u1.gender as user1_gender, u1.birth_year as user1_birth_year,
                   u2.gender as user2_gender, u2.birth_year as user2_birth_year
            FROM chat_rooms cr
            JOIN users u1 ON cr.user1_id = u1.id
            JOIN users u2 ON cr.user2_id = u2.id
            WHERE cr.id = ?
        `;
        const rooms = await this.query(sql, [roomId]);
        return rooms[0];
    }

    // 메시지 저장
    async saveMessage(roomId, senderId, message) {
        const sql = 'INSERT INTO chat_messages (room_id, sender_id, message) VALUES (?, ?, ?)';
        return await this.query(sql, [roomId, senderId, message]);
    }

    // 메시지 조회
    async getMessages(roomId, limit = 50) {
        const sql = `
            SELECT cm.*, u.gender as sender_gender
            FROM chat_messages cm
            JOIN users u ON cm.sender_id = u.id
            WHERE cm.room_id = ?
            ORDER BY cm.created_at DESC
            LIMIT ?
        `;
        const messages = await this.query(sql, [roomId, limit]);
        return messages.reverse(); // 시간순으로 정렬
    }

    // 사용자의 채팅방 조회
    async getUserChatRoom(userId) {
        const sql = `
            SELECT cr.*, 
                   CASE 
                       WHEN cr.user1_id = ? THEN cr.user2_id 
                       ELSE cr.user1_id 
                   END as partner_id
            FROM chat_rooms cr
            WHERE cr.user1_id = ? OR cr.user2_id = ?
        `;
        const rooms = await this.query(sql, [userId, userId, userId]);
        return rooms[0];
    }
}

module.exports = new Database();