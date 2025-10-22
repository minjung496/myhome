const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const SajuCalculator = require('./lib/saju');
const db = require('./lib/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 사용자별 소켓 연결 관리
const userSockets = new Map();

// 매칭 서비스
class MatchingService {
    static async findMatch(currentUser) {
        try {
            const waitingUsers = await db.getWaitingUsers(currentUser.id, currentUser.gender);
            
            if (waitingUsers.length === 0) {
                return null;
            }

            // 각 대기 사용자와의 궁합 점수 계산
            let bestMatch = null;
            let bestScore = 0;

            for (const waitingUser of waitingUsers) {
                const compatibilityScore = SajuCalculator.calculateCompatibility(currentUser, waitingUser);
                
                if (compatibilityScore > bestScore) {
                    bestScore = compatibilityScore;
                    bestMatch = waitingUser;
                }
            }

            // 최소 궁합 점수 기준 (예: 30점 이상)
            if (bestScore >= 30) {
                return { user: bestMatch, score: bestScore };
            }

            return null;
        } catch (error) {
            console.error('매칭 찾기 오류:', error);
            return null;
        }
    }

    static async createMatch(user1, user2, compatibilityScore) {
        try {
            const roomId = await db.createChatRoom(user1.id, user2.id, compatibilityScore);
            
            // 매칭된 사용자들에게 알림
            const user1Socket = userSockets.get(user1.id);
            const user2Socket = userSockets.get(user2.id);

            const matchData = {
                roomId: roomId,
                partnerId: user2.id,
                partnerGender: user2.gender,
                partnerBirthYear: user2.birth_year,
                compatibilityScore: compatibilityScore
            };

            if (user1Socket) {
                user1Socket.emit('match_found', {
                    ...matchData,
                    partnerId: user2.id,
                    partnerGender: user2.gender,
                    partnerBirthYear: user2.birth_year
                });
            }

            if (user2Socket) {
                user2Socket.emit('match_found', {
                    ...matchData,
                    partnerId: user1.id,
                    partnerGender: user1.gender,
                    partnerBirthYear: user1.birth_year
                });
            }

            return roomId;
        } catch (error) {
            console.error('매칭 생성 오류:', error);
            throw error;
        }
    }
}

// API 라우트
app.post('/api/register', async (req, res) => {
    try {
        const { birthYear, birthMonth, birthDay, birthHour, birthMinute = 0, gender } = req.body;

        // 입력 검증
        if (!birthYear || !birthMonth || !birthDay || !birthHour || !gender) {
            return res.status(400).json({ error: '모든 필수 정보를 입력해주세요.' });
        }

        // 사주 계산
        const saju = SajuCalculator.calculateSaju(birthYear, birthMonth, birthDay, birthHour, birthMinute);
        const elementScores = SajuCalculator.calculateElementScores(saju);
        const yongsin = SajuCalculator.calculateYongsin(elementScores);

        // 사용자 데이터 준비
        const userData = {
            birth_year: birthYear,
            birth_month: birthMonth,
            birth_day: birthDay,
            birth_hour: birthHour,
            birth_minute: birthMinute,
            gender: gender,
            year_gan: saju.year.gan,
            year_ji: saju.year.ji,
            month_gan: saju.month.gan,
            month_ji: saju.month.ji,
            day_gan: saju.day.gan,
            day_ji: saju.day.ji,
            hour_gan: saju.hour.gan,
            hour_ji: saju.hour.ji,
            wood_score: elementScores.wood,
            fire_score: elementScores.fire,
            earth_score: elementScores.earth,
            metal_score: elementScores.metal,
            water_score: elementScores.water,
            yongsin: yongsin
        };

        // 데이터베이스에 사용자 저장
        const userId = await db.createUser(userData);
        
        // 생성된 사용자 정보 조회
        const newUser = await db.getUser(userId);

        res.json({
            success: true,
            userId: userId,
            saju: saju,
            elementScores: elementScores,
            yongsin: yongsin
        });
    } catch (error) {
        console.error('사용자 등록 오류:', error);
        res.status(500).json({ error: '사용자 등록 중 오류가 발생했습니다.' });
    }
});

app.post('/api/start-matching', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: '사용자 ID가 필요합니다.' });
        }

        const currentUser = await db.getUser(userId);
        if (!currentUser) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }

        // 이미 매칭된 사용자인지 확인
        const existingRoom = await db.getUserChatRoom(userId);
        if (existingRoom) {
            return res.json({
                success: true,
                matched: true,
                roomId: existingRoom.id,
                partnerId: existingRoom.partner_id,
                compatibilityScore: existingRoom.compatibility_score
            });
        }

        // 매칭 시도
        const match = await MatchingService.findMatch(currentUser);

        if (match) {
            // 매칭 성공
            const roomId = await MatchingService.createMatch(currentUser, match.user, match.score);
            
            res.json({
                success: true,
                matched: true,
                roomId: roomId,
                partnerId: match.user.id,
                partnerGender: match.user.gender,
                partnerBirthYear: match.user.birth_year,
                compatibilityScore: match.score
            });
        } else {
            // 매칭 상대 없음 - 대기열에 추가
            await db.addToWaitingQueue(userId);
            
            res.json({
                success: true,
                matched: false,
                message: '매칭 상대를 찾고 있습니다. 잠시만 기다려주세요.'
            });
        }
    } catch (error) {
        console.error('매칭 시작 오류:', error);
        res.status(500).json({ error: '매칭 시작 중 오류가 발생했습니다.' });
    }
});

app.get('/api/messages/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const messages = await db.getMessages(roomId);
        res.json({ success: true, messages });
    } catch (error) {
        console.error('메시지 조회 오류:', error);
        res.status(500).json({ error: '메시지를 불러오는 중 오류가 발생했습니다.' });
    }
});

// Socket.io 연결 처리
io.on('connection', (socket) => {
    console.log('사용자 연결됨:', socket.id);

    socket.on('user_connect', async (data) => {
        const { userId } = data;
        userSockets.set(parseInt(userId), socket);
        socket.userId = parseInt(userId);
        console.log(`사용자 ${userId} 소켓 연결 등록`);

        // 사용자가 연결되면 대기 중인 다른 사용자들과 매칭 시도
        try {
            const currentUser = await db.getUser(userId);
            if (currentUser && currentUser.is_waiting) {
                // 새로 연결된 사용자가 기존 대기자들과 매칭될 수 있는지 확인
                const waitingUsers = await db.getWaitingUsers(currentUser.id, currentUser.gender);
                
                for (const waitingUser of waitingUsers) {
                    const compatibilityScore = SajuCalculator.calculateCompatibility(currentUser, waitingUser);
                    
                    if (compatibilityScore >= 30) {
                        await MatchingService.createMatch(currentUser, waitingUser, compatibilityScore);
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('자동 매칭 오류:', error);
        }
    });

    socket.on('join_room', (data) => {
        const { roomId } = data;
        socket.join(roomId);
        console.log(`사용자 ${socket.userId}가 방 ${roomId}에 입장`);
    });

    socket.on('send_message', async (data) => {
        try {
            const { roomId, message } = data;
            const senderId = socket.userId;

            if (!senderId || !roomId || !message) {
                return;
            }

            // 메시지 저장
            await db.saveMessage(roomId, senderId, message);

            // 방의 모든 사용자에게 메시지 전송
            io.to(roomId).emit('new_message', {
                senderId: senderId,
                message: message,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('메시지 전송 오류:', error);
        }
    });

    socket.on('disconnect', () => {
        if (socket.userId) {
            userSockets.delete(socket.userId);
            console.log(`사용자 ${socket.userId} 연결 해제`);
        }
    });
});

// 정적 파일 제공
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // 모든 인터페이스에서 접속 허용

server.listen(PORT, HOST, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`http://localhost:${PORT} 에서 접속 가능합니다.`);
    console.log(`http://172.30.0.2:${PORT} 에서 외부 접속 가능합니다.`);
});