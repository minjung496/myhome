class SajuMatchingApp {
    constructor() {
        this.socket = null;
        this.currentUserId = null;
        this.currentRoomId = null;
        this.currentScreen = 'registration-screen';
        
        this.init();
    }

    init() {
        this.initEventListeners();
        this.populateYearSelect();
        this.populateDaySelect();
        this.connectSocket();
    }

    initEventListeners() {
        // 생년월일 폼 제출
        document.getElementById('birth-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegistration();
        });

        // 매칭 시작 버튼
        document.getElementById('start-matching-btn').addEventListener('click', () => {
            this.startMatching();
        });

        // 메시지 전송
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        // 엔터키로 메시지 전송
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // 월 변경 시 일 옵션 업데이트
        document.getElementById('birth-month').addEventListener('change', () => {
            this.populateDaySelect();
        });
    }

    populateYearSelect() {
        const yearSelect = document.getElementById('birth-year');
        const currentYear = new Date().getFullYear();
        
        for (let year = currentYear - 80; year <= currentYear - 18; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year + '년';
            yearSelect.appendChild(option);
        }
    }

    populateDaySelect() {
        const monthSelect = document.getElementById('birth-month');
        const daySelect = document.getElementById('birth-day');
        const month = parseInt(monthSelect.value);
        
        // 기존 옵션 제거 (첫 번째 옵션 제외)
        daySelect.innerHTML = '<option value="">일</option>';
        
        if (!month) return;
        
        const daysInMonth = new Date(2023, month, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const option = document.createElement('option');
            option.value = day;
            option.textContent = day + '일';
            daySelect.appendChild(option);
        }
    }

    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('서버에 연결되었습니다.');
            if (this.currentUserId) {
                this.socket.emit('user_connect', { userId: this.currentUserId });
            }
        });

        this.socket.on('match_found', (data) => {
            console.log('매칭 성공:', data);
            this.handleMatchFound(data);
        });

        this.socket.on('new_message', (data) => {
            this.displayMessage(data.senderId, data.message, data.timestamp);
        });

        this.socket.on('disconnect', () => {
            console.log('서버와의 연결이 끊어졌습니다.');
        });
    }

    async handleRegistration() {
        const formData = {
            birthYear: parseInt(document.getElementById('birth-year').value),
            birthMonth: parseInt(document.getElementById('birth-month').value),
            birthDay: parseInt(document.getElementById('birth-day').value),
            birthHour: parseInt(document.getElementById('birth-hour').value),
            gender: document.getElementById('gender').value
        };

        // 폼 유효성 검사
        if (!formData.birthYear || !formData.birthMonth || !formData.birthDay || 
            !formData.birthHour || !formData.gender) {
            alert('모든 정보를 입력해주세요.');
            return;
        }

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.currentUserId = result.userId;
                this.displaySajuResult(result.saju, result.elementScores, result.yongsin);
                this.showScreen('saju-result-screen');
                
                // 소켓 연결 등록
                this.socket.emit('user_connect', { userId: this.currentUserId });
            } else {
                alert(result.error || '등록 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('등록 오류:', error);
            alert('등록 중 오류가 발생했습니다.');
        }
    }

    displaySajuResult(saju, elementScores, yongsin) {
        // 사주 사주 표시
        document.getElementById('year-gan').textContent = saju.year.gan;
        document.getElementById('year-ji').textContent = saju.year.ji;
        document.getElementById('month-gan').textContent = saju.month.gan;
        document.getElementById('month-ji').textContent = saju.month.ji;
        document.getElementById('day-gan').textContent = saju.day.gan;
        document.getElementById('day-ji').textContent = saju.day.ji;
        document.getElementById('hour-gan').textContent = saju.hour.gan;
        document.getElementById('hour-ji').textContent = saju.hour.ji;

        // 오행 점수 표시
        document.getElementById('wood-score').textContent = elementScores.wood;
        document.getElementById('fire-score').textContent = elementScores.fire;
        document.getElementById('earth-score').textContent = elementScores.earth;
        document.getElementById('metal-score').textContent = elementScores.metal;
        document.getElementById('water-score').textContent = elementScores.water;

        // 용신 표시
        document.getElementById('yongsin-text').textContent = yongsin;
    }

    async startMatching() {
        if (!this.currentUserId) {
            alert('사용자 정보가 없습니다.');
            return;
        }

        try {
            const response = await fetch('/api/start-matching', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: this.currentUserId })
            });

            const result = await response.json();

            if (result.success) {
                if (result.matched) {
                    // 즉시 매칭 성공
                    this.handleMatchFound({
                        roomId: result.roomId,
                        partnerId: result.partnerId,
                        partnerGender: result.partnerGender,
                        partnerBirthYear: result.partnerBirthYear,
                        compatibilityScore: result.compatibilityScore
                    });
                } else {
                    // 대기 상태
                    this.showScreen('waiting-screen');
                }
            } else {
                alert(result.error || '매칭 시작 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error('매칭 시작 오류:', error);
            alert('매칭 시작 중 오류가 발생했습니다.');
        }
    }

    handleMatchFound(data) {
        this.currentRoomId = data.roomId;
        
        // 상대방 정보 표시
        const genderText = data.partnerGender === 'male' ? '남성' : '여성';
        const age = new Date().getFullYear() - data.partnerBirthYear + 1;
        document.getElementById('partner-info-text').textContent = 
            `${genderText} (${age}세)`;
        document.getElementById('compatibility-score').textContent = 
            Math.round(data.compatibilityScore);

        // 채팅방 입장
        this.socket.emit('join_room', { roomId: this.currentRoomId });
        
        // 기존 메시지 로드
        this.loadMessages();
        
        // 채팅 화면으로 이동
        this.showScreen('chat-screen');
    }

    async loadMessages() {
        if (!this.currentRoomId) return;

        try {
            const response = await fetch(`/api/messages/${this.currentRoomId}`);
            const result = await response.json();

            if (result.success) {
                const messagesContainer = document.getElementById('chat-messages');
                messagesContainer.innerHTML = '';

                result.messages.forEach(message => {
                    this.displayMessage(
                        message.sender_id, 
                        message.message, 
                        message.created_at,
                        false // 스크롤하지 않음
                    );
                });

                // 마지막에 한 번만 스크롤
                this.scrollToBottom();
            }
        } catch (error) {
            console.error('메시지 로드 오류:', error);
        }
    }

    sendMessage() {
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();

        if (!message || !this.currentRoomId) return;

        this.socket.emit('send_message', {
            roomId: this.currentRoomId,
            message: message
        });

        messageInput.value = '';
    }

    displayMessage(senderId, message, timestamp, autoScroll = true) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        
        const isMyMessage = senderId === this.currentUserId;
        messageElement.className = `message ${isMyMessage ? 'sent' : 'received'}`;
        
        const time = new Date(timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageElement.innerHTML = `
            <div>${message}</div>
            <div class="message-time">${time}</div>
        `;

        messagesContainer.appendChild(messageElement);

        if (autoScroll) {
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showScreen(screenId) {
        // 모든 화면 숨기기
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // 지정된 화면 보이기
        document.getElementById(screenId).classList.add('active');
        this.currentScreen = screenId;
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.sajuApp = new SajuMatchingApp();
});