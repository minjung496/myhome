const moment = require('moment');

// 천간 배열 (갑, 을, 병, 정, 무, 기, 경, 신, 임, 계)
const HEAVENLY_STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];

// 지지 배열 (자, 축, 인, 묘, 진, 사, 오, 미, 신, 유, 술, 해)
const EARTHLY_BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

// 오행 매핑
const FIVE_ELEMENTS = {
    // 천간의 오행
    '갑': '목', '을': '목',
    '병': '화', '정': '화',
    '무': '토', '기': '토',
    '경': '금', '신': '금',
    '임': '수', '계': '수',
    
    // 지지의 오행
    '자': '수', '축': '토', '인': '목', '묘': '목',
    '진': '토', '사': '화', '오': '화', '미': '토',
    '신': '금', '유': '금', '술': '토', '해': '수'
};

// 오행 점수 매핑
const ELEMENT_SCORES = {
    '목': { wood: 100, fire: 20, earth: 0, metal: 0, water: 20 },
    '화': { wood: 20, fire: 100, earth: 20, metal: 0, water: 0 },
    '토': { wood: 0, fire: 20, earth: 100, metal: 20, water: 0 },
    '금': { wood: 0, fire: 0, earth: 20, metal: 100, water: 20 },
    '수': { wood: 20, fire: 0, earth: 0, metal: 20, water: 100 }
};

// 천을귀인 매핑 (일간별)
const CHEON_UL_GWIIN = {
    '갑': ['축', '미'], '을': ['자', '신'],
    '병': ['인', '유'], '정': ['해', '인'],
    '무': ['축', '미'], '기': ['자', '신'],
    '경': ['인', '오'], '신': ['묘', '사'],
    '임': ['인', '오'], '계': ['묘', '사']
};

// 육합 매핑
const YUKDAP = {
    '자': '축', '축': '자',
    '인': '해', '해': '인',
    '묘': '술', '술': '묘',
    '진': '유', '유': '진',
    '사': '신', '신': '사',
    '오': '미', '미': '오'
};

// 삼합 매핑
const SAMHAP = {
    '신': ['자', '진'], '자': ['신', '진'], '진': ['신', '자'], // 신자진 수국
    '인': ['오', '술'], '오': ['인', '술'], '술': ['인', '오'], // 인오술 화국
    '사': ['유', '축'], '유': ['사', '축'], '축': ['사', '유'], // 사유축 금국
    '해': ['묘', '미'], '묘': ['해', '미'], '미': ['해', '묘']  // 해묘미 목국
};

class SajuCalculator {
    // 양력 날짜를 음력으로 변환하는 간단한 근사 계산
    // 실제로는 더 정확한 음력 변환 라이브러리를 사용해야 함
    static calculateSaju(year, month, day, hour, minute = 0) {
        // 기준년도 (갑자년) 설정
        const baseYear = 1924; // 갑자년
        
        // 년주 계산
        const yearIndex = (year - baseYear) % 60;
        const yearGan = HEAVENLY_STEMS[yearIndex % 10];
        const yearJi = EARTHLY_BRANCHES[yearIndex % 12];
        
        // 월주 계산 (절기 기준이지만 간단히 월로 계산)
        const monthGanIndex = ((year - baseYear) * 12 + month - 1) % 10;
        const monthJiIndex = (month - 1) % 12;
        const monthGan = HEAVENLY_STEMS[monthGanIndex];
        const monthJi = EARTHLY_BRANCHES[monthJiIndex];
        
        // 일주 계산
        const baseDate = moment('1924-01-01');
        const targetDate = moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
        const daysDiff = targetDate.diff(baseDate, 'days');
        
        const dayGanIndex = daysDiff % 10;
        const dayJiIndex = daysDiff % 12;
        const dayGan = HEAVENLY_STEMS[dayGanIndex];
        const dayJi = EARTHLY_BRANCHES[dayJiIndex];
        
        // 시주 계산
        const hourIndex = Math.floor(hour / 2);
        const hourGanIndex = (dayGanIndex * 2 + hourIndex) % 10;
        const hourGan = HEAVENLY_STEMS[hourGanIndex];
        const hourJi = EARTHLY_BRANCHES[hourIndex % 12];
        
        return {
            year: { gan: yearGan, ji: yearJi },
            month: { gan: monthGan, ji: monthJi },
            day: { gan: dayGan, ji: dayJi },
            hour: { gan: hourGan, ji: hourJi }
        };
    }
    
    // 오행 점수 계산
    static calculateElementScores(saju) {
        const scores = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
        
        // 각 간지의 오행을 확인하고 점수 계산
        const elements = [
            FIVE_ELEMENTS[saju.year.gan],
            FIVE_ELEMENTS[saju.year.ji],
            FIVE_ELEMENTS[saju.month.gan],
            FIVE_ELEMENTS[saju.month.ji],
            FIVE_ELEMENTS[saju.day.gan],
            FIVE_ELEMENTS[saju.day.ji],
            FIVE_ELEMENTS[saju.hour.gan],
            FIVE_ELEMENTS[saju.hour.ji]
        ];
        
        elements.forEach(element => {
            const elementScore = ELEMENT_SCORES[element];
            scores.wood += elementScore.wood;
            scores.fire += elementScore.fire;
            scores.earth += elementScore.earth;
            scores.metal += elementScore.metal;
            scores.water += elementScore.water;
        });
        
        return scores;
    }
    
    // 용신 계산 (가장 부족한 오행을 용신으로 설정)
    static calculateYongsin(elementScores) {
        const elements = Object.keys(elementScores);
        let minElement = elements[0];
        let minScore = elementScores[minElement];
        
        elements.forEach(element => {
            if (elementScores[element] < minScore) {
                minScore = elementScores[element];
                minElement = element;
            }
        });
        
        const yongsinMap = {
            wood: '목',
            fire: '화',
            earth: '토',
            metal: '금',
            water: '수'
        };
        
        return yongsinMap[minElement];
    }
    
    // 궁합 점수 계산
    static calculateCompatibility(user1, user2) {
        let score = 0;
        
        // 1. 오행 보완 점수 (상대가 내가 부족한 오행을 많이 가질수록 높은 점수)
        const user1Elements = {
            wood: user1.wood_score,
            fire: user1.fire_score,
            earth: user1.earth_score,
            metal: user1.metal_score,
            water: user1.water_score
        };
        
        const user2Elements = {
            wood: user2.wood_score,
            fire: user2.fire_score,
            earth: user2.earth_score,
            metal: user2.metal_score,
            water: user2.water_score
        };
        
        // 서로의 부족한 오행을 보완해주는 정도 계산
        Object.keys(user1Elements).forEach(element => {
            const user1Lack = Math.max(0, 200 - user1Elements[element]);
            const user2Lack = Math.max(0, 200 - user2Elements[element]);
            
            score += (user1Lack * user2Elements[element] / 1000);
            score += (user2Lack * user1Elements[element] / 1000);
        });
        
        // 2. 용신 매칭 점수
        const yongsinMap = {
            '목': 'wood',
            '화': 'fire',
            '토': 'earth',
            '금': 'metal',
            '수': 'water'
        };
        
        if (user1.yongsin && user2.yongsin) {
            const user1YongsinElement = yongsinMap[user1.yongsin];
            const user2YongsinElement = yongsinMap[user2.yongsin];
            
            if (user1YongsinElement) {
                score += user2Elements[user1YongsinElement] / 50;
            }
            if (user2YongsinElement) {
                score += user1Elements[user2YongsinElement] / 50;
            }
        }
        
        // 3. 천을귀인 점수
        if (user1.day_gan && user2.day_ji) {
            const cheonUlList = CHEON_UL_GWIIN[user1.day_gan] || [];
            if (cheonUlList.includes(user2.day_ji) || cheonUlList.includes(user2.month_ji)) {
                score += 10;
            }
        }
        
        if (user2.day_gan && user1.day_ji) {
            const cheonUlList = CHEON_UL_GWIIN[user2.day_gan] || [];
            if (cheonUlList.includes(user1.day_ji) || cheonUlList.includes(user1.month_ji)) {
                score += 10;
            }
        }
        
        // 4. 일지 관계 점수
        if (user1.day_ji && user2.day_ji) {
            // 동일한 일지
            if (user1.day_ji === user2.day_ji) {
                score += 15;
            }
            
            // 육합
            if (YUKDAP[user1.day_ji] === user2.day_ji) {
                score += 20;
            }
            
            // 삼합
            const samhapList = SAMHAP[user1.day_ji] || [];
            if (samhapList.includes(user2.day_ji)) {
                score += 25;
            }
        }
        
        // 5. 천간삼기 (간단한 버전)
        if (user1.day_gan && user2.day_gan) {
            const ganElements1 = FIVE_ELEMENTS[user1.day_gan];
            const ganElements2 = FIVE_ELEMENTS[user2.day_gan];
            
            // 같은 오행이면 점수 추가
            if (ganElements1 === ganElements2) {
                score += 8;
            }
        }
        
        return Math.round(score * 100) / 100;
    }
}

module.exports = SajuCalculator;