const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'simple.html'));
});

// 간단한 API 테스트
app.get('/api/test', (req, res) => {
    res.json({ 
        message: '서버가 정상 작동합니다!', 
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
});

// 건강 상태 확인
app.get('/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime() });
});

// 모든 인터페이스에서 리스닝
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 간단한 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📍 로컬 접속: http://localhost:${PORT}`);
    console.log(`🌐 원격 접속: http://172.30.0.2:${PORT}`);
    console.log(`🧪 테스트 API: http://172.30.0.2:${PORT}/api/test`);
});