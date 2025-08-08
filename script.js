// 통합된 수학 학습 시스템 - 모든 기능 포함

// ===== 전역 변수 =====
let categories = [];
let allQuestions = [];
let questionsData = [];
let currentQuestionIndex = -1;
let currentQuestion = null;
let userNotes = {};
let menuVisible = false;

// ===== Firebase 설정 및 초기화 =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, query, where, orderBy, limit, getDocs, deleteDoc, onSnapshot, runTransaction, increment } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
// firebase-storage 사용 제거

// ===== 통합 설정 상수 =====
const SYSTEM_CONFIG = {
  // Firebase 설정
  FIREBASE: {
    API_KEY: "AIzaSyAppDGlVLrSkUKIioS8FADsJ2KyNB5OcFw",
    AUTH_DOMAIN: "gaesaegi-math.firebaseapp.com",
    DATABASE_URL: "https://gaesaegi-math-default-rtdb.firebaseio.com",
    PROJECT_ID: "gaesaegi-math",
    STORAGE_BUCKET: "gaesaegi-math.appspot.com",
    MESSAGING_SENDER_ID: "211273803590",
    APP_ID: "1:211273803590:web:1d5eea23c7a88fdbf6e747",
    MEASUREMENT_ID: "G-QRVNX8KX2N"
  },
  
  // 성능 설정
  PERFORMANCE: {
    CACHE_DURATION: 5 * 60 * 1000, // 5분
    MAX_RETRY_COUNT: 3,
    DEBOUNCE_DELAY: 300, // 300ms
    THROTTLE_DELAY: 1000, // 1초
    RETRY_DELAY: 1000, // 1초
    BATCH_SIZE: 10
  },
  
  // 거래소 설정
  TRADING: {
    MIN_ORDER_AMOUNT: 1, // 최소 주문 수량
    MAX_ORDER_AMOUNT: 1000, // 최대 주문 수량
    PRICE_DECIMAL_PLACES: 2, // 가격 소수점 자릿수
    AMOUNT_DECIMAL_PLACES: 2, // 수량 소수점 자릿수
    MAX_ORDERS_PER_USER: 10, // 사용자당 최대 주문 수
    ORDER_EXPIRY_HOURS: 24, // 주문 만료 시간 (시간)
    TRADING_FEE_PERCENT: 0.1, // 거래 수수료 (0.1%)
    MIN_PRICE_CHANGE: 0.01, // 최소 가격 변동
    MAX_PRICE_CHANGE: 10.0, // 최대 가격 변동
    PRICE_UPDATE_INTERVAL: 5000, // 가격 업데이트 간격 (5초)
    ORDERBOOK_UPDATE_INTERVAL: 2000, // 호가창 업데이트 간격 (2초)
    TRADE_HISTORY_LIMIT: 100 // 거래 내역 최대 개수
  },
  
  // 코인 시스템 설정
  COIN: {
    INITIAL_COINS: 100,
    DAILY_LOGIN_REWARD: 1,
    PROBLEM_SOLVE_REWARD: 2,
    STREAK_BONUS: 3,
    CHALLENGE_COMPLETE_REWARD: 5,
    LEVEL_UP_REWARD: 10,
    BADGE_REWARD: 15,
    ACHIEVEMENT_REWARD: 20,
    LOTTERY_TICKET_COST: 1,
    MAX_DAILY_GIFTS: 1,
    GIFT_AMOUNT: 1
  },
  
  // UI 설정
  UI: {
    BREAKPOINTS: {
      MOBILE: 480,
      TABLET: 768,
      DESKTOP: 1024,
      LARGE_DESKTOP: 1200
    },
    ANIMATION_DURATION: 300,
    LOADING_TIMEOUT: 10000
  }
};

// ===== 에러 메시지 통합 =====
const ERROR_MESSAGES = {
  NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
  AUTH_ERROR: '인증에 실패했습니다. 다시 로그인해주세요.',
  PERMISSION_ERROR: '권한이 없습니다.',
  NOT_FOUND: '요청한 데이터를 찾을 수 없습니다.',
  VALIDATION_ERROR: '입력값이 올바르지 않습니다.',
  SERVER_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  QUOTA_EXCEEDED: '일일 사용량을 초과했습니다.',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
  INSUFFICIENT_COINS: '코인이 부족합니다.',
  INVALID_ORDER: '주문 정보가 올바르지 않습니다.',
  ORDER_LIMIT_EXCEEDED: '주문 한도를 초과했습니다.',
  TRADING_ERROR: '거래 처리 중 오류가 발생했습니다.',
  LOTTERY_ERROR: '로또 구매 중 오류가 발생했습니다.',
  GIFT_ERROR: '선물 전송 중 오류가 발생했습니다.'
};

// Firebase 설정
const firebaseConfig = {
  apiKey: SYSTEM_CONFIG.FIREBASE.API_KEY,
  authDomain: SYSTEM_CONFIG.FIREBASE.AUTH_DOMAIN,
  databaseURL: SYSTEM_CONFIG.FIREBASE.DATABASE_URL,
  projectId: SYSTEM_CONFIG.FIREBASE.PROJECT_ID,
  storageBucket: SYSTEM_CONFIG.FIREBASE.STORAGE_BUCKET,
  messagingSenderId: SYSTEM_CONFIG.FIREBASE.MESSAGING_SENDER_ID,
  appId: SYSTEM_CONFIG.FIREBASE.APP_ID,
  measurementId: SYSTEM_CONFIG.FIREBASE.MEASUREMENT_ID
};

// Firebase 앱 인스턴스
let app = null;
let auth = null;
let db = null;
// storage 제거

// Firebase 앱 초기화
async function getFirebaseApp() {
  if (!app) {
    try {
      app = initializeApp(firebaseConfig);
      console.log('Firebase 앱 초기화 성공');
    } catch (error) {
      console.error('Firebase 앱 초기화 실패:', error);
      throw error;
    }
  }
  return app;
}

// Firebase Auth 초기화
async function getFirebaseAuth() {
  if (!auth) {
    try {
      const appInstance = await getFirebaseApp();
      auth = getAuth(appInstance);
      console.log('Firebase Auth 초기화 성공');
    } catch (error) {
      console.error('Firebase Auth 초기화 실패:', error);
      throw error;
    }
  }
  return auth;
}

// Firebase Firestore 초기화
async function getFirebaseDb() {
  if (!db) {
    try {
      const appInstance = await getFirebaseApp();
      db = getFirestore(appInstance);
      console.log('Firebase Firestore 초기화 성공');
    } catch (error) {
      console.error('Firebase Firestore 초기화 실패:', error);
      throw error;
    }
  }
  return db;
}

// Firebase Storage 제거 (대체 없음)

// Firebase 설정 유효성 검사
function validateFirebaseConfig() {
  const requiredFields = [
    'apiKey', 
    'authDomain', 
    'projectId', 
    'storageBucket', 
    'messagingSenderId', 
    'appId'
  ];
  
  const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Firebase 설정에 필수 필드가 누락되었습니다: ${missingFields.join(', ')}`);
  }
  
  return true;
}

// ===== 코인 서비스 =====

/**
 * 사용자 코인 잔고 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<number>} 코인 잔고
 */
async function getUserCoins(userId) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }
    
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.coins || 0;
    }
    return 0;
  } catch (error) {
    console.error('코인 잔고 조회 실패:', error);
    throw new Error('코인 잔고를 불러올 수 없습니다.');
  }
}

/**
 * 일일 로그인 보상 지급
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} 보상 지급 성공 여부
 */
async function giveDailyLoginReward(userId) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    const userRef = doc(db, 'users', userId);
    const today = new Date().toDateString();
    let rewarded = false;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('사용자를 찾을 수 없습니다.');
      const data = snap.data();
      if (data.lastLoginDate === today) {
        rewarded = false;
        return;
      }
      rewarded = true;
      tx.update(userRef, { lastLoginDate: today, lastLogin: serverTimestamp() });
    });
    if (rewarded) {
      await addCoins(userId, SYSTEM_CONFIG.COIN.DAILY_LOGIN_REWARD, '일일 로그인 보상');
    }
    return rewarded;
    
    console.log('일일 로그인 보상 지급 완료');
    return true;
  } catch (error) {
    console.error('일일 로그인 보상 지급 실패:', error);
    return false;
  }
}

/**
 * 문제 풀이 보상 지급
 * @param {string} userId - 사용자 ID
 * @param {boolean} isCorrect - 정답 여부
 * @param {string} questionId - 문제 ID
 * @returns {Promise<number>} 지급된 코인 수량
 */
async function giveProblemSolveReward(userId, isCorrect, questionId) {
  try {
    if (!isCorrect) {
      return 0; // 오답 시 보상 없음
    }
    
    // 정답 시 기본 보상
    let reward = SYSTEM_CONFIG.COIN.PROBLEM_SOLVE_REWARD;
    
    // 연속 정답 보너스 확인
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const streak = data.correctStreak || 0;
        const newStreak = streak + 1;
        if (newStreak % 5 === 0) {
          reward += SYSTEM_CONFIG.COIN.STREAK_BONUS;
        }
        tx.update(userRef, { correctStreak: newStreak, lastCorrectQuestion: questionId });
      });
    }
    
    // 보상 지급
    await addCoins(userId, reward, `문제 정답 보상 (${questionId})`);
    
    return reward;
  } catch (error) {
    console.error('문제 풀이 보상 지급 실패:', error);
    return 0;
  }
}

/**
 * 챌린지 완료 보상 지급
 * @param {string} userId - 사용자 ID
 * @param {string} challengeType - 챌린지 타입
 * @returns {Promise<number>} 지급된 코인 수량
 */
async function giveChallengeReward(userId, challengeType) {
  try {
    const reward = SYSTEM_CONFIG.COIN.CHALLENGE_COMPLETE_REWARD;
    
    await addCoins(userId, reward, `${challengeType} 챌린지 완료`);
    
    return reward;
  } catch (error) {
    console.error('챌린지 보상 지급 실패:', error);
    return 0;
  }
}

/**
 * 레벨업 보상 지급
 * @param {string} userId - 사용자 ID
 * @param {number} newLevel - 새로운 레벨
 * @returns {Promise<number>} 지급된 코인 수량
 */
async function giveLevelUpReward(userId, newLevel) {
  try {
    const reward = SYSTEM_CONFIG.COIN.LEVEL_UP_REWARD;
    
    await addCoins(userId, reward, `레벨업 보상 (레벨 ${newLevel})`);
    
    return reward;
  } catch (error) {
    console.error('레벨업 보상 지급 실패:', error);
    return 0;
  }
}

/**
 * 배지 획득 보상 지급
 * @param {string} userId - 사용자 ID
 * @param {string} badgeName - 배지 이름
 * @returns {Promise<number>} 지급된 코인 수량
 */
async function giveBadgeReward(userId, badgeName) {
  try {
    const reward = SYSTEM_CONFIG.COIN.BADGE_REWARD;
    
    await addCoins(userId, reward, `배지 획득 보상 (${badgeName})`);
    
    return reward;
  } catch (error) {
    console.error('배지 보상 지급 실패:', error);
    return 0;
  }
}

/**
 * 업적 달성 보상 지급
 * @param {string} userId - 사용자 ID
 * @param {string} achievementName - 업적 이름
 * @returns {Promise<number>} 지급된 코인 수량
 */
async function giveAchievementReward(userId, achievementName) {
  try {
    const reward = SYSTEM_CONFIG.COIN.ACHIEVEMENT_REWARD;
    
    await addCoins(userId, reward, `업적 달성 보상 (${achievementName})`);
    
    return reward;
  } catch (error) {
    console.error('업적 보상 지급 실패:', error);
    return 0;
  }
}

/**
 * 코인 지급
 * @param {string} userId - 사용자 ID
 * @param {number} amount - 지급할 코인 수량
 * @param {string} reason - 지급 사유
 * @returns {Promise<number>} 업데이트된 코인 잔고
 */
async function addCoins(userId, amount, reason) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }
    
    if (amount <= 0) {
      throw new Error('지급할 코인 수량은 0보다 커야 합니다.');
    }
    
    if (!reason) {
      throw new Error('지급 사유가 필요합니다.');
    }
    
    const userRef = doc(db, 'users', userId);
    let newCoins = 0;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('사용자를 찾을 수 없습니다.');
      const currentCoins = snap.data().coins || 0;
      newCoins = currentCoins + amount;
      tx.update(userRef, { coins: newCoins, lastCoinUpdate: serverTimestamp() });
    });
    
    // 코인 거래 내역 저장
    await addCoinTransaction(userId, 'earn', amount, reason, newCoins);
    
    // 코인 획득 이벤트 발생
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('coinsEarned', {
        detail: {
          userId,
          amount,
          reason,
          newBalance: newCoins,
          timestamp: new Date()
        }
      }));
    }
    
    console.log(`코인 ${amount}개 지급 완료: ${reason}`);
    return newCoins;
  } catch (error) {
    console.error('코인 지급 실패:', error);
    throw new Error('코인 지급에 실패했습니다.');
  }
}

/**
 * 코인 사용
 * @param {string} userId - 사용자 ID
 * @param {number} amount - 사용할 코인 수량
 * @param {string} reason - 사용 사유
 * @returns {Promise<number>} 업데이트된 코인 잔고
 */
async function spendCoins(userId, amount, reason) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }
    
    if (amount <= 0) {
      throw new Error('사용할 코인 수량은 0보다 커야 합니다.');
    }
    
    if (!reason) {
      throw new Error('사용 사유가 필요합니다.');
    }
    
    const userRef = doc(db, 'users', userId);
    let newCoins = 0;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('사용자를 찾을 수 없습니다.');
      const currentCoins = snap.data().coins || 0;
      if (currentCoins < amount) throw new Error('코인이 부족합니다.');
      newCoins = currentCoins - amount;
      tx.update(userRef, { coins: newCoins, lastCoinUpdate: serverTimestamp() });
    });
    
    // 코인 거래 내역 저장
    await addCoinTransaction(userId, 'spend', amount, reason, newCoins);
    
    console.log(`코인 ${amount}개 사용 완료: ${reason}`);
    return newCoins;
  } catch (error) {
    console.error('코인 사용 실패:', error);
    throw new Error('코인 사용에 실패했습니다.');
  }
}

/**
 * 코인 거래 내역 저장 (내부 함수)
 * @param {string} userId - 사용자 ID
 * @param {string} type - 거래 타입 ('earn' | 'spend' | 'gift')
 * @param {number} amount - 거래 금액
 * @param {string} reason - 거래 사유
 * @param {number} balance - 거래 후 잔고
 * @returns {Promise<void>}
 */
async function addCoinTransaction(userId, type, amount, reason, balance) {
  try {
    await addDoc(collection(db, 'coin_transactions'), {
      userId: userId,
      type: type,
      amount: amount,
      reason: reason,
      balance: balance,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('거래 내역 저장 실패:', error);
    // 거래 내역 저장 실패는 코인 거래 자체를 실패시키지 않음
  }
}

/**
 * 코인 거래 내역 조회
 * @param {string} userId - 사용자 ID
 * @param {number} limitCount - 조회할 최대 개수
 * @returns {Promise<Array>} 거래 내역 배열
 */
async function getCoinHistory(userId, limitCount = 20) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    const q = query(
      collection(db, 'coin_transactions'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const history = [];
    
    querySnapshot.forEach((doc) => {
      history.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return history;
  } catch (error) {
    console.error('코인 거래 내역 조회 실패:', error);
    return [];
  }
}

/**
 * 코인 선물하기
 * @param {string} fromUserId - 선물하는 사용자 ID
 * @param {string} toUserId - 선물받는 사용자 ID
 * @param {number} amount - 선물할 코인 수량
 * @param {string} message - 선물 메시지
 * @returns {Promise<boolean>} 선물 성공 여부
 */
async function sendCoinGift(fromUserId, toUserId, amount, message = '') {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    if (!fromUserId || !toUserId || !amount) {
      throw new Error('필수 정보가 누락되었습니다.');
    }
    
    if (fromUserId === toUserId) {
      throw new Error('자기 자신에게는 선물할 수 없습니다.');
    }
    
    if (amount <= 0) {
      throw new Error('선물할 코인 수량은 0보다 커야 합니다.');
    }
    
    if (amount > SYSTEM_CONFIG.COIN.GIFT_AMOUNT) {
      throw new Error(`한 번에 선물할 수 있는 최대 코인은 ${SYSTEM_CONFIG.COIN.GIFT_AMOUNT}개입니다.`);
    }
    
    // 보내는 사용자 코인 잔고 확인
    const fromUserCoins = await getUserCoins(fromUserId);
    if (fromUserCoins < amount) {
      throw new Error('선물할 코인이 부족합니다.');
    }
    
    // 받는 사용자 존재 확인
    const toUserDoc = await getDoc(doc(db, 'users', toUserId));
    if (!toUserDoc.exists()) {
      throw new Error('받는 사용자를 찾을 수 없습니다.');
    }
    
    // 24시간 대기 제한 확인
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentGiftsQuery = query(
      collection(db, 'gift_history'),
      where('fromUserId', '==', fromUserId),
      where('toUserId', '==', toUserId),
      where('timestamp', '>=', yesterday),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const recentGiftsSnapshot = await getDocs(recentGiftsQuery);
    if (!recentGiftsSnapshot.empty) {
      const lastGift = recentGiftsSnapshot.docs[0].data();
      const lastGiftTime = lastGift.timestamp.toDate();
      const timeDiff = Date.now() - lastGiftTime.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        const remainingHours = Math.ceil(24 - hoursDiff);
        throw new Error(`같은 사용자에게는 24시간 후에 다시 선물할 수 있습니다. (${remainingHours}시간 남음)`);
      }
    }
    
    // 일일 총 선물 제한 확인
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayGiftsQuery = query(
      collection(db, 'gift_history'),
      where('fromUserId', '==', fromUserId),
      where('timestamp', '>=', today)
    );
    
    const todayGiftsSnapshot = await getDocs(todayGiftsQuery);
    if (todayGiftsSnapshot.size >= SYSTEM_CONFIG.COIN.MAX_DAILY_GIFTS) {
      throw new Error('오늘은 더 이상 선물할 수 없습니다. (하루 1회 제한)');
    }
    
    // 코인 이체
    await spendCoins(fromUserId, amount, `코인 선물 - ${toUserId}에게`);
    await addCoins(toUserId, amount, `코인 선물 받음 - ${fromUserId}로부터`);
    
    // 선물 내역 저장
    const giftData = {
      fromUserId: fromUserId,
      toUserId: toUserId,
      amount: amount,
      message: message,
      timestamp: serverTimestamp(),
      status: 'completed'
    };
    
    const giftRef = await addDoc(collection(db, 'gift_history'), giftData);
    
    console.log('코인 선물 완료:', giftRef.id);
    return {
      success: true,
      giftId: giftRef.id,
      gift: giftData
    };
    
  } catch (error) {
    console.error('코인 선물 실패:', error);
    throw error;
  }
}

/**
 * 선물 내역 조회
 * @param {string} userId - 사용자 ID
 * @param {string} type - 'sent' | 'received'
 * @param {number} limitCount - 조회할 최대 개수
 * @returns {Promise<Array>} 선물 내역 배열
 */
async function getGiftHistory(userId, type = 'received', limitCount = 20) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    const giftHistoryRef = collection(db, 'gift_history');
    let q;
    
    if (type === 'sent') {
      q = query(
        giftHistoryRef,
        where('fromUserId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    } else {
      q = query(
        giftHistoryRef,
        where('toUserId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const history = [];
    
    querySnapshot.forEach((doc) => {
      history.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return history;
  } catch (error) {
    console.error('선물 내역 조회 실패:', error);
    return [];
  }
}

/**
 * 사용자 검색 (선물용)
 * @param {string} searchTerm - 검색어
 * @param {string} currentUserId - 현재 사용자 ID (자신 제외)
 * @returns {Promise<Array>} 검색된 사용자 배열
 */
async function searchUsersForGift(searchTerm, currentUserId) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('displayName', '>=', searchTerm),
      where('displayName', '<=', searchTerm + '\uf8ff'),
      limit(10)
    );
    
    const querySnapshot = await getDocs(q);
    const users = [];
    
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      if (doc.id !== currentUserId) { // 자신 제외
        users.push({
          id: doc.id,
          displayName: userData.displayName || '익명 사용자',
          coins: userData.coins || 0,
          level: userData.level || 1
        });
      }
    });
    
    return users;
  } catch (error) {
    console.error('사용자 검색 실패:', error);
    return [];
  }
}

/**
 * 코인 변경 사항 실시간 감지
 * @param {string} userId - 사용자 ID
 * @param {Function} callback - 변경 시 호출될 콜백 함수
 * @returns {Function} 구독 해제 함수
 */
function onCoinsChange(userId, callback) {
  try {
    if (!db) {
      throw new Error('Firebase가 초기화되지 않았습니다.');
    }
    
    const userRef = doc(db, 'users', userId);
    return onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        callback(userData.coins || 0);
      }
    });
  } catch (error) {
    console.error('코인 변경 감지 실패:', error);
    return () => {}; // 빈 함수 반환
  }
}

// ===== Firebase 초기화 함수 =====
async function initializeFirebaseServices() {
  try {
    // 설정 유효성 검사
    validateFirebaseConfig();

    app = await getFirebaseApp();
    auth = await getFirebaseAuth();
    db = await getFirebaseDb();
    
    console.log('Firebase 초기화 성공');
    
    // 인증 상태 관리
    if (auth) {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          console.log("사용자 로그인됨:", user.uid);
          try {
            await loadUserData(user.uid);
            console.log("사용자 데이터 로드 완료");
          } catch (error) {
            console.error("사용자 데이터 로드 실패:", error);
          }
        } else {
          console.log("사용자 로그인되지 않음");
        }
      });
    } else {
      console.error("Firebase Auth가 초기화되지 않았습니다.");
    }
    
  } catch (error) {
    console.error('Firebase 초기화 실패:', error);
    if (typeof showError === 'function') {
      showError('서비스 초기화에 실패했습니다. 페이지를 새로고침해주세요.');
    }
  }
}

// ===== 사용자 데이터 관리 =====

// 포인트 시스템 함수
async function updateUserPoints(userId, points, reason) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    const currentPoints = userData.points || 0;
    const newPoints = currentPoints + points;
    
    await updateDoc(userRef, {
      points: newPoints,
      lastPointsUpdate: serverTimestamp()
    });
    
    // 포인트 거래 내역 저장
    await addDoc(collection(db, 'point_transactions'), {
      userId: userId,
      type: 'earn',
      amount: points,
      reason: reason,
      balance: newPoints,
      timestamp: serverTimestamp()
    });
    
    console.log(`포인트 ${points} 지급 완료: ${reason}`);
    return newPoints;
    
  } catch (error) {
    console.error('포인트 업데이트 실패:', error);
    throw error;
  }
}

// ===== 게임화 시스템 =====

/**
 * 경험치 추가 및 레벨업 체크
 * @param {string} userId - 사용자 ID
 * @param {number} exp - 추가할 경험치
 * @param {string} reason - 경험치 획득 사유
 * @returns {Promise<Object>} 레벨업 정보
 */
async function addExperience(userId, exp, reason) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    const currentExp = userData.experience || 0;
    const currentLevel = userData.level || 1;
    const newExp = currentExp + exp;
    
    // 레벨업 계산
    const newLevel = Math.floor(newExp / 100) + 1;
    const leveledUp = newLevel > currentLevel;
    
    // 사용자 데이터 업데이트
    await updateDoc(userRef, {
      experience: newExp,
      level: newLevel,
      lastExpUpdate: serverTimestamp()
    });
    
    // 경험치 획득 내역 저장
    await addDoc(collection(db, 'experience_history'), {
      userId: userId,
      amount: exp,
      reason: reason,
      totalExp: newExp,
      level: newLevel,
      timestamp: serverTimestamp()
    });
    
    // 레벨업 시 보상 지급
    if (leveledUp) {
      await giveLevelUpReward(userId, newLevel);
      console.log(`레벨업! 레벨 ${newLevel} 달성`);
    }
    
    return {
      leveledUp,
      oldLevel: currentLevel,
      newLevel: newLevel,
      oldExp: currentExp,
      newExp: newExp
    };
  } catch (error) {
    console.error('경험치 추가 실패:', error);
    throw error;
  }
}

/**
 * 배지 획득 체크 및 지급
 * @param {string} userId - 사용자 ID
 * @param {string} badgeType - 배지 타입
 * @returns {Promise<boolean>} 배지 획득 성공 여부
 */
async function checkAndGiveBadge(userId, badgeType) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    const badges = userData.badges || [];
    
    // 이미 배지를 가지고 있는지 확인
    if (badges.includes(badgeType)) {
      return false;
    }
    
    // 배지 획득 조건 확인
    let shouldGiveBadge = false;
    
    switch (badgeType) {
      case 'FIRST_LOGIN':
        shouldGiveBadge = true;
        break;
      case 'FIRST_CORRECT':
        shouldGiveBadge = userData.correctStreak >= 1;
        break;
      case 'STREAK_5':
        shouldGiveBadge = userData.correctStreak >= 5;
        break;
      case 'STREAK_10':
        shouldGiveBadge = userData.correctStreak >= 10;
        break;
      case 'LEVEL_5':
        shouldGiveBadge = userData.level >= 5;
        break;
      case 'LEVEL_10':
        shouldGiveBadge = userData.level >= 10;
        break;
      case 'COIN_COLLECTOR':
        shouldGiveBadge = userData.coins >= 100;
        break;
      case 'DAILY_LEARNER':
        // 7일 연속 로그인 체크
        const loginHistory = await getLoginHistory(userId, 7);
        shouldGiveBadge = loginHistory.length >= 7;
        break;
    }
    
    if (shouldGiveBadge) {
      // 배지 추가
      const newBadges = [...badges, badgeType];
      await updateDoc(userRef, {
        badges: newBadges
      });
      
      // 배지 보상 지급
      await giveBadgeReward(userId, badgeType);
      
      console.log(`배지 획득: ${badgeType}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('배지 체크 실패:', error);
    return false;
  }
}

/**
 * 업적 달성 체크 및 지급
 * @param {string} userId - 사용자 ID
 * @param {string} achievementType - 업적 타입
 * @returns {Promise<boolean>} 업적 달성 성공 여부
 */
async function checkAndGiveAchievement(userId, achievementType) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    const achievements = userData.achievements || [];
    
    // 이미 업적을 달성했는지 확인
    if (achievements.includes(achievementType)) {
      return false;
    }
    
    // 업적 달성 조건 확인
    let shouldGiveAchievement = false;
    
    switch (achievementType) {
      case 'PROBLEM_SOLVER':
        const solvedProblems = await getSolvedProblemsCount(userId);
        shouldGiveAchievement = solvedProblems >= 10;
        break;
      case 'PERFECT_STREAK':
        shouldGiveAchievement = userData.correctStreak >= 20;
        break;
      case 'COIN_MASTER':
        shouldGiveAchievement = userData.coins >= 500;
        break;
      case 'LEVEL_MASTER':
        shouldGiveAchievement = userData.level >= 20;
        break;
      case 'GIFT_GIVER':
        const sentGifts = await getGiftHistory(userId, 'sent');
        shouldGiveAchievement = sentGifts.length >= 5;
        break;
    }
    
    if (shouldGiveAchievement) {
      // 업적 추가
      const newAchievements = [...achievements, achievementType];
      await updateDoc(userRef, {
        achievements: newAchievements
      });
      
      // 업적 보상 지급
      await giveAchievementReward(userId, achievementType);
      
      console.log(`업적 달성: ${achievementType}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('업적 체크 실패:', error);
    return false;
  }
}

/**
 * 로그인 내역 조회
 * @param {string} userId - 사용자 ID
 * @param {number} days - 조회할 일수
 * @returns {Promise<Array>} 로그인 내역
 */
async function getLoginHistory(userId, days = 7) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const loginHistoryRef = collection(db, 'login_history');
    const q = query(
      loginHistoryRef,
      where('userId', '==', userId),
      where('timestamp', '>=', startDate),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const history = [];
    
    querySnapshot.forEach((doc) => {
      history.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return history;
  } catch (error) {
    console.error('로그인 내역 조회 실패:', error);
    return [];
  }
}

/**
 * 풀이한 문제 수 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<number>} 풀이한 문제 수
 */
async function getSolvedProblemsCount(userId) {
  try {
    const solvedProblemsRef = collection(db, 'solved_problems');
    const q = query(
      solvedProblemsRef,
      where('userId', '==', userId),
      where('isCorrect', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('풀이한 문제 수 조회 실패:', error);
    return 0;
  }
}

// 사용자 데이터 로드
async function loadUserData(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // 새 사용자 생성
      await setDoc(userRef, {
        uid: userId,
        coins: SYSTEM_CONFIG.COIN.INITIAL_COINS,
        points: 0,
        level: 1,
        experience: 0,
        badges: [],
        achievements: [],
        correctStreak: 0,
        lastLoginDate: null,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      console.log('새 사용자 데이터 생성 완료');
      
      // 새 사용자에게 환영 보상 지급
      await giveDailyLoginReward(userId);
    } else {
      // 기존 사용자의 마지막 로그인 시간 업데이트 및 일일 보상 지급
      await updateDoc(userRef, {
        lastLogin: serverTimestamp()
      });
      
      // 일일 로그인 보상 지급
      const rewardGiven = await giveDailyLoginReward(userId);
      if (rewardGiven) {
        console.log('일일 로그인 보상 지급 완료');
      }
    }
    
  } catch (error) {
    console.error('사용자 데이터 로드 실패:', error);
    throw error;
  }
}

// ===== GSG 페이지 전용 변수 및 함수들 =====
let favoriteQuestions = new Set();

// Firebase 서비스 초기화
initializeFirebaseServices();

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
  initializeMathApp();
});

// 앱 초기화
async function initializeMathApp() {
  try {
    showLoading();
    await loadQuestions();
    setupEventListeners();
    hideLoading();
  } catch (error) {
    console.error('앱 초기화 실패:', error);
    hideLoading();
    showError('데이터 로드에 실패했습니다. 페이지를 새로고침해주세요.');
  }
}

// 문제 데이터 로드
async function loadQuestions() {
  try {
    const response = await fetch('questions.json');
    if (!response.ok) {
      throw new Error('문제 데이터를 불러올 수 없습니다.');
    }
    
    const data = await response.json();
    categories = data;
    
    // 모든 문제를 평면화하여 저장
    allQuestions = [];
    data.forEach(category => {
      if (category.문항들 && Array.isArray(category.문항들)) {
        category.문항들.forEach(item => {
          // 출제년도 추출 (문항번호에서)
          const yearMatch = item.문항번호.match(/(\d{4})/);
          item.출제년도 = yearMatch ? yearMatch[1] : '2024';
          
          // 문제 제목 생성
          item.문제 = `${item.문항번호} 문제`;
          
          // 카테고리 정보 추가
          item.과목 = category.과목;
          item.대분류 = category.대분류;
          item.중분류 = category.중분류;
          item.소분류 = category.소분류;
          
          allQuestions.push(item);
        });
      }
    });
    
    questionsData = allQuestions;
    
    console.log('문제 데이터 로드 완료:', questionsData.length);
    console.log('카테고리 수:', categories.length);
    
    // 사이드바 메뉴 생성
    generateSidebarMenu();
    
    // 첫 번째 문제 자동 로드
    if (questionsData.length > 0) {
      loadQuestion(0);
    }
  } catch (error) {
    console.error('문제 데이터 로드 실패:', error);
    throw error;
  }
}

// 사이드바 메뉴 생성
function generateSidebarMenu() {
  const questionList = document.getElementById('questionList');
  if (!questionList) return;
  
  questionList.innerHTML = '';

  // 대시보드 메뉴 아이템들 추가
  const dashboardMenuItems = [
    {
      icon: 'img/info.png',
      text: '웹 이용 방법 안내',
      action: () => showInfoi()
    },
    {
      icon: 'img/ds.png',
      text: '대시보드',
      action: () => showDashboard()
    },
    {
      icon: 'img/fv.png',
      text: '다시 살펴볼 문항',
      action: () => showFavorites()
    },
    {
      icon: 'img/feedback.png',
      text: '오류 제보 및 피드백',
      action: () => showFeedback()
    }
  ];

  // 게임화 및 코인 시스템 메뉴 아이템들 추가
  const gamificationMenuItems = [
    {
      icon: 'img/fv.png',
      text: '게이미피케이션',
      action: () => showGamification()
    },
    {
      icon: 'img/fvn.png',
      text: '일일 도전 과제',
      action: () => showDailyChallenges()
    },
    {
      icon: 'img/fvy.png',
      text: '모의고사',
      action: () => showMockExam()
    },
    {
      icon: 'img/info.png',
      text: '시험 결과',
      action: () => showExamResult()
    }
  ];

  // 코인 시스템 메뉴 아이템들 추가
  const coinSystemMenuItems = [
    {
      icon: 'img/ds.png',
      text: '상점',
      action: () => showShop()
    },
    {
      icon: 'img/fv.png',
      text: '로또',
      action: () => showLottery()
    },
    {
      icon: 'img/fvn.png',
      text: '거래소',
      action: () => showTrading()
    },
    {
      icon: 'img/fvy.png',
      text: '학습 그룹',
      action: () => showStudyGroups()
    }
  ];

  // 관리 및 프로필 메뉴 아이템들 추가
  const managementMenuItems = [
    {
      icon: 'img/ds.png',
      text: '프로필',
      action: () => showProfile()
    },
    {
      icon: 'img/fv.png',
      text: '추천 시스템',
      action: () => showRecommendations()
    },
    {
      icon: 'img/fvn.png',
      text: '간격 반복 학습',
      action: () => showSpacedRepetition()
    },
    {
      icon: 'img/fvy.png',
      text: 'QA 시스템',
      action: () => showQASystem()
    }
  ];

  // 대시보드 메뉴 아이템들 생성
  dashboardMenuItems.forEach(item => {
    const li = document.createElement('li');
    li.className = 'dashboard-menu-item';
    li.innerHTML = `
      <div class="dashboard-menu-content">
        <img src="${item.icon}" alt="${item.text} 아이콘" style="width:20px; height:auto; vertical-align:middle; margin-right:8px;">
        <span>${item.text}</span>
      </div>
    `;
    li.addEventListener('click', (e) => {
      item.action();
      if (window.innerWidth <= 600) {
        document.getElementById('left').style.display = 'none';
        menuVisible = false;
      }
      e.stopPropagation();
    });
    questionList.appendChild(li);
  });

  // 구분선 추가
  const separator1 = document.createElement('li');
  separator1.className = 'menu-separator';
  separator1.innerHTML = '<hr style="border: 1px solid rgba(255,255,255,0.2); margin: 15px 0;">';
  questionList.appendChild(separator1);

  // 게임화 메뉴 아이템들 생성
  gamificationMenuItems.forEach(item => {
    const li = document.createElement('li');
    li.className = 'dashboard-menu-item';
    li.innerHTML = `
      <div class="dashboard-menu-content">
        <img src="${item.icon}" alt="${item.text} 아이콘" style="width:20px; height:auto; vertical-align:middle; margin-right:8px;">
        <span>${item.text}</span>
      </div>
    `;
    li.addEventListener('click', (e) => {
      item.action();
      if (window.innerWidth <= 600) {
        document.getElementById('left').style.display = 'none';
        menuVisible = false;
      }
      e.stopPropagation();
    });
    questionList.appendChild(li);
  });

  // 구분선 추가
  const separator2 = document.createElement('li');
  separator2.className = 'menu-separator';
  separator2.innerHTML = '<hr style="border: 1px solid rgba(255,255,255,0.2); margin: 15px 0;">';
  questionList.appendChild(separator2);

  // 코인 시스템 메뉴 아이템들 생성
  coinSystemMenuItems.forEach(item => {
    const li = document.createElement('li');
    li.className = 'dashboard-menu-item';
    li.innerHTML = `
      <div class="dashboard-menu-content">
        <img src="${item.icon}" alt="${item.text} 아이콘" style="width:20px; height:auto; vertical-align:middle; margin-right:8px;">
        <span>${item.text}</span>
      </div>
    `;
    li.addEventListener('click', (e) => {
      item.action();
      if (window.innerWidth <= 600) {
        document.getElementById('left').style.display = 'none';
        menuVisible = false;
      }
      e.stopPropagation();
    });
    questionList.appendChild(li);
  });

  // 구분선 추가
  const separator3 = document.createElement('li');
  separator3.className = 'menu-separator';
  separator3.innerHTML = '<hr style="border: 1px solid rgba(255,255,255,0.2); margin: 15px 0;">';
  questionList.appendChild(separator3);

  // 관리 및 프로필 메뉴 아이템들 생성
  managementMenuItems.forEach(item => {
    const li = document.createElement('li');
    li.className = 'dashboard-menu-item';
    li.innerHTML = `
      <div class="dashboard-menu-content">
        <img src="${item.icon}" alt="${item.text} 아이콘" style="width:20px; height:auto; vertical-align:middle; margin-right:8px;">
        <span>${item.text}</span>
      </div>
    `;
    li.addEventListener('click', (e) => {
      item.action();
      if (window.innerWidth <= 600) {
        document.getElementById('left').style.display = 'none';
        menuVisible = false;
      }
      e.stopPropagation();
    });
    questionList.appendChild(li);
  });

  // 구분선 추가
  const separator4 = document.createElement('li');
  separator4.className = 'menu-separator';
  separator4.innerHTML = '<hr style="border: 1px solid rgba(255,255,255,0.2); margin: 15px 0;">';
  questionList.appendChild(separator4);

  // 문제 트리 구조 생성
  generateQuestionTree();
}

// 문제 트리 구조 생성
function generateQuestionTree() {
  const questionList = document.getElementById('questionList');
  if (!questionList) return;

  // 과목별로 그룹핑
  const subjects = {};
  categories.forEach(category => {
    if (!subjects[category.과목]) {
      subjects[category.과목] = {};
    }
    if (!subjects[category.과목][category.대분류]) {
      subjects[category.과목][category.대분류] = {};
    }
    if (!subjects[category.과목][category.대분류][category.중분류]) {
      subjects[category.과목][category.대분류][category.중분류] = {};
    }
    if (!subjects[category.과목][category.대분류][category.중분류][category.소분류]) {
      subjects[category.과목][category.대분류][category.중분류][category.소분류] = [];
    }
    subjects[category.과목][category.대분류][category.중분류][category.소분류].push(...category.문항들);
  });

  // 트리 구조 생성
  Object.keys(subjects).forEach(subjectName => {
    const subject = subjects[subjectName];
    
    // 과목 헤더
    const subjectHeader = document.createElement('li');
    subjectHeader.className = 'category-header';
    subjectHeader.innerHTML = `
      <div class="category-title">
        <span class="category-icon">📚</span>
        <span>${subjectName}</span>
        <span class="category-count">${countQuestionsInSubject(subject)}문항</span>
        <span class="collapse-icon">▼</span>
      </div>
    `;
    questionList.appendChild(subjectHeader);

    // 과목 컨테이너
    const subjectContainer = document.createElement('div');
    subjectContainer.className = 'subcategory-container';

    Object.keys(subject).forEach(majorCategory => {
      // 대분류 헤더
      const majorHeader = document.createElement('li');
      majorHeader.className = 'subcategory-header';
      majorHeader.innerHTML = `
        <div class="category-title">
          <span class="subcategory-icon">📖</span>
          <span>${majorCategory}</span>
          <span class="category-count">${countQuestionsInMajorCategory(subject[majorCategory])}문항</span>
          <span class="collapse-icon">▼</span>
        </div>
      `;
      subjectContainer.appendChild(majorHeader);

      // 대분류 컨테이너
      const majorContainer = document.createElement('div');
      majorContainer.className = 'questions-container';

      Object.keys(subject[majorCategory]).forEach(middleCategory => {
        // 중분류 헤더
        const middleHeader = document.createElement('li');
        middleHeader.className = 'question-item';
        middleHeader.style.marginLeft = '20px';
        middleHeader.innerHTML = `
          <div class="category-title">
            <span class="question-icon">📝</span>
            <span>${middleCategory}</span>
            <span class="category-count">${countQuestionsInMiddleCategory(subject[majorCategory][middleCategory])}문항</span>
            <span class="collapse-icon">▼</span>
          </div>
        `;
        majorContainer.appendChild(middleHeader);

        // 중분류 컨테이너
        const middleContainer = document.createElement('div');
        middleContainer.className = 'questions-container';
        middleContainer.style.marginLeft = '20px';

        Object.keys(subject[majorCategory][middleCategory]).forEach(minorCategory => {
          // 소분류 헤더
          const minorHeader = document.createElement('li');
          minorHeader.className = 'question-item';
          minorHeader.style.marginLeft = '20px';
          minorHeader.innerHTML = `
            <div class="category-title">
              <span class="question-icon">📋</span>
              <span>${minorCategory}</span>
              <span class="category-count">${subject[majorCategory][middleCategory][minorCategory].length}문항</span>
              <span class="collapse-icon">▼</span>
            </div>
          `;
          middleContainer.appendChild(minorHeader);

          // 문제 컨테이너
          const questionsContainer = document.createElement('div');
          questionsContainer.className = 'questions-container';
          questionsContainer.style.marginLeft = '20px';

          // 문제 항목들
          subject[majorCategory][middleCategory][minorCategory].forEach((item, itemIndex) => {
            const li = document.createElement('li');
            li.className = 'question-item';
            li.style.marginLeft = '20px';
            li.innerHTML = `
              <div class="question-content">
                <div class="question-title">
                  <span class="question-icon">❓</span>
                  ${item.문항번호}
                </div>
                <div class="question-meta">
                  <span class="question-year">${item.출제년도 || '2024'}</span>
                  <span class="question-difficulty">${item.난이도 || '보통'}</span>
                </div>
              </div>
            `;
            
                         const questionIndex = allQuestions.findIndex(q => q.문항번호 === item.문항번호);
             li.onclick = () => {
               if (questionIndex !== -1) {
                 loadQuestion(questionIndex);
               } else {
                 console.error('문제를 찾을 수 없습니다:', item.문항번호);
               }
             };
            questionsContainer.appendChild(li);
          });

          middleContainer.appendChild(questionsContainer);

          // 소분류 클릭 이벤트 (접기/펼치기)
          minorHeader.addEventListener('click', function(e) {
            e.stopPropagation();
            const questionsContainer = this.nextElementSibling;
            const collapseIcon = this.querySelector('.collapse-icon');
            
            if (questionsContainer.classList.contains('questions-hidden')) {
              questionsContainer.classList.remove('questions-hidden');
              this.classList.remove('collapsed');
              collapseIcon.textContent = '▼';
            } else {
              questionsContainer.classList.add('questions-hidden');
              this.classList.add('collapsed');
              collapseIcon.textContent = '▶';
            }
          });
        });

        majorContainer.appendChild(middleContainer);

        // 중분류 클릭 이벤트 (접기/펼치기)
        middleHeader.addEventListener('click', function(e) {
          e.stopPropagation();
          const middleContainer = this.nextElementSibling;
          const collapseIcon = this.querySelector('.collapse-icon');
          
          if (middleContainer.classList.contains('questions-hidden')) {
            middleContainer.classList.remove('questions-hidden');
            this.classList.remove('collapsed');
            collapseIcon.textContent = '▼';
          } else {
            middleContainer.classList.add('questions-hidden');
            this.classList.add('collapsed');
            collapseIcon.textContent = '▶';
          }
        });
      });

      subjectContainer.appendChild(majorContainer);

      // 대분류 클릭 이벤트 (접기/펼치기)
      majorHeader.addEventListener('click', function(e) {
        e.stopPropagation();
        const majorContainer = this.nextElementSibling;
        const collapseIcon = this.querySelector('.collapse-icon');
        
        if (majorContainer.classList.contains('questions-hidden')) {
          majorContainer.classList.remove('questions-hidden');
          this.classList.remove('collapsed');
          collapseIcon.textContent = '▼';
        } else {
          majorContainer.classList.add('questions-hidden');
          this.classList.add('collapsed');
          collapseIcon.textContent = '▶';
        }
      });
    });

    questionList.appendChild(subjectContainer);

    // 과목 클릭 이벤트 (접기/펼치기)
    subjectHeader.addEventListener('click', function(e) {
      e.stopPropagation();
      const subjectContainer = this.nextElementSibling;
      const collapseIcon = this.querySelector('.collapse-icon');
      
      if (subjectContainer.classList.contains('subcategory-hidden')) {
        subjectContainer.classList.remove('subcategory-hidden');
        this.classList.remove('collapsed');
        collapseIcon.textContent = '▼';
      } else {
        subjectContainer.classList.add('subcategory-hidden');
        this.classList.add('collapsed');
        collapseIcon.textContent = '▶';
      }
    });
  });

  // 초기 상태: 첫 번째 과목만 펼치기
  const firstSubject = questionList.querySelector('.category-header');
  if (firstSubject) {
    firstSubject.click(); // 첫 번째 과목 펼치기
  }
}

// 과목별 문제 수 계산
function countQuestionsInSubject(subject) {
  let count = 0;
  Object.keys(subject).forEach(majorCategory => {
    count += countQuestionsInMajorCategory(subject[majorCategory]);
  });
  return count;
}

// 대분류별 문제 수 계산
function countQuestionsInMajorCategory(majorCategory) {
  let count = 0;
  Object.keys(majorCategory).forEach(middleCategory => {
    count += countQuestionsInMiddleCategory(majorCategory[middleCategory]);
  });
  return count;
}

// 중분류별 문제 수 계산
function countQuestionsInMiddleCategory(middleCategory) {
  let count = 0;
  Object.keys(middleCategory).forEach(minorCategory => {
    count += middleCategory[minorCategory].length;
  });
  return count;
}

// 문제 로드
function loadQuestion(index) {
  if (index < 0 || index >= questionsData.length) return;
  
  currentQuestionIndex = index;
  currentQuestion = questionsData[index];
  
  // iframe으로 문제 표시
  const questionFrame = document.getElementById('questionFrame');
  if (questionFrame && currentQuestion.문항주소) {
    // 이미지 파일을 iframe으로 표시하기 위해 HTML 페이지 생성
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${currentQuestion.문항번호} 문제</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background: #ffffff;
            font-family: 'Noto Sans KR', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          img {
            max-width: 100%;
            max-height: 100vh;
            object-fit: contain;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
          }
        </style>
      </head>
      <body>
        <img src="${currentQuestion.문항주소}" alt="${currentQuestion.문항번호} 문제" />
      </body>
      </html>
    `;
    
    // Blob URL 생성
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    questionFrame.style.display = 'block';
    questionFrame.classList.remove('loaded');
    questionFrame.src = url;
    
    // 로딩 완료 후 애니메이션 적용
    questionFrame.onload = function() {
      setTimeout(() => {
        questionFrame.classList.add('loaded');
      }, 100);
    };
    
    // 이전 Blob URL 정리
    if (questionFrame.dataset.previousUrl) {
      URL.revokeObjectURL(questionFrame.dataset.previousUrl);
    }
    questionFrame.dataset.previousUrl = url;
  }
  
  // 사이드바에서 현재 문제 하이라이트
  updateSidebarSelection();
  
  // 결과 영역 초기화
  const resultDiv = document.getElementById('result');
  const solutionLink = document.getElementById('solutionLink');
  if (resultDiv) resultDiv.innerHTML = '';
  if (solutionLink) solutionLink.innerHTML = '';
  
  console.log('문제 로드됨:', currentQuestion);
}

// 사이드바 선택 상태 업데이트
function updateSidebarSelection() {
  const questionItems = document.querySelectorAll('.question-item');
  questionItems.forEach(item => item.classList.remove('active'));
  
  if (currentQuestionIndex >= 0) {
    const activeItem = questionItems[currentQuestionIndex];
    if (activeItem) {
      activeItem.classList.add('active');
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 답안 입력 시 엔터키 처리
  const answerInput = document.getElementById('answer');
  if (answerInput) {
    answerInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        checkAnswer();
      }
    });
  }

  // iframe 클릭 시 전체화면 모달 표시
  const questionFrame = document.getElementById('questionFrame');
  if (questionFrame) {
    questionFrame.addEventListener('click', function() {
      showQuestionModal(currentQuestion.문항주소);
    });
  }

  // 키보드 단축키
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey || e.metaKey) return; // Ctrl/Cmd 조합은 제외
    
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        navigateToPreviousQuestion();
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateToNextQuestion();
        break;
      case 'Enter':
        if (document.activeElement !== document.getElementById('answer')) {
          e.preventDefault();
          checkAnswer();
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeQuestionModal();
        break;
    }
  });
}

// 문제 모달 표시
function showQuestionModal(questionSrc) {
  const modal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  
  if (modal && modalImage) {
    modalImage.src = questionSrc;
    modal.style.display = 'flex';
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeQuestionModal();
      }
    });
  }
}

// 문제 모달 닫기
function closeQuestionModal() {
  const modal = document.getElementById('imageModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 로딩 표시
function showLoading() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
  }
}

// 로딩 숨김
function hideLoading() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
}

// 에러 표시
function showError(message) {
  alert(message); // 추후 더 나은 에러 표시 방법으로 개선 가능
}

// 대시보드로 이동
function goToDashboard() {
  window.location.href = 'dashboard.html';
}

// 대시보드 메뉴 관련 함수들
function showInfoi() {
  loadPageInIframe('infoi.html');
}

function showDashboard() {
  loadPageInIframe('dashboard.html');
}

function showFavorites() {
  loadPageInIframe('favorite.html');
}

function showFeedback() {
  loadPageInIframe('feedback.html');
}

// 게임화 및 코인 시스템 네비게이션 함수들
function showGamification() {
  loadPageInIframe('gamification.html');
}

function showDailyChallenges() {
  loadPageInIframe('daily-challenges.html');
}

function showMockExam() {
  loadPageInIframe('mock-exam.html');
}

function showExamResult() {
  loadPageInIframe('exam-result.html');
}

function showShop() {
  loadPageInIframe('shop.html');
}

function showLottery() {
  loadPageInIframe('lottery.html');
}

function showTrading() {
  loadPageInIframe('trading.html');
}

function showStudyGroups() {
  loadPageInIframe('study-groups.html');
}

function showProfile() {
  loadPageInIframe('profile.html');
}

function showRecommendations() {
  loadPageInIframe('recommendations.html');
}

function showSpacedRepetition() {
  loadPageInIframe('spaced-repetition.html');
}

function showQASystem() {
  loadPageInIframe('qa-system.html');
}

// iframe에 페이지를 로드하는 함수
function loadPageInIframe(pageUrl) {
  const iframe = document.getElementById('questionFrame');
  const contentMain = document.querySelector('.content-main');
  
  if (iframe && contentMain) {
    // 로딩 표시
    showLoading();
    
    // iframe 표시 및 애니메이션 초기화
    iframe.style.display = 'block';
    iframe.classList.remove('loaded');
    
    // iframe 로드 완료 이벤트
    iframe.onload = function() {
      hideLoading();
      
      // iframe이 로드되면 부드러운 애니메이션으로 표시
      setTimeout(() => {
        iframe.classList.add('loaded');
      }, 100);
    };
    
    // iframe 로드 오류 처리
    iframe.onerror = function() {
      hideLoading();
      showError('페이지를 로드하는 중 오류가 발생했습니다.');
    };
    
    // 페이지 로드
    iframe.src = pageUrl;
    
    // 사이드바 선택 상태 업데이트
    updateSidebarSelection();
    
    // 페이지 제목 업데이트 (선택적)
    updatePageTitle(pageUrl);
  }
}

// 페이지 제목 업데이트 함수
function updatePageTitle(pageUrl) {
  const pageTitles = {
    'infoi.html': '웹 이용 방법 안내',
    'dashboard.html': '대시보드',
    'favorite.html': '다시 살펴볼 문항',
    'feedback.html': '오류 제보 및 피드백',
    'gamification.html': '게임화',
    'daily-challenges.html': '일일 도전',
    'mock-exam.html': '모의고사',
    'exam-result.html': '시험 결과',
    'shop.html': '상점',
    'lottery.html': '복권',
    'trading.html': '거래소',
    'study-groups.html': '스터디 그룹',
    'profile.html': '프로필',
    'recommendations.html': '추천',
    'spaced-repetition.html': '간격 반복',
    'qa-system.html': 'Q&A 시스템'
  };
  
  const title = pageTitles[pageUrl] || '페이지';
  const titleElement = document.querySelector('.content-title');
  if (titleElement) {
    titleElement.textContent = title;
  }
}

// 즐겨찾기 토글
async function toggleFavorite() {
  if (!currentQuestion) {
    alert('문제를 먼저 선택해주세요.');
    return;
  }

  const favoriteButton = document.querySelector('.favorite-button');
  const questionId = currentQuestion.문항번호;

  try {
    if (auth && auth.currentUser) {
      const userId = auth.currentUser.uid;
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const favorites = userData.favorites || [];
        
        if (favorites.includes(questionId)) {
          // 즐겨찾기에서 제거
          const updatedFavorites = favorites.filter(id => id !== questionId);
          await updateDoc(userRef, { favorites: updatedFavorites });
          favoriteQuestions.delete(questionId);
          if (favoriteButton) favoriteButton.classList.remove('active');
          console.log('즐겨찾기에서 제거:', questionId);
        } else {
          // 즐겨찾기에 추가
          const updatedFavorites = [...favorites, questionId];
          await updateDoc(userRef, { favorites: updatedFavorites });
          favoriteQuestions.add(questionId);
          if (favoriteButton) favoriteButton.classList.add('active');
          console.log('즐겨찾기에 추가:', questionId);
        }
      }
    } else {
      // 로그인하지 않은 경우 로컬에서만 처리
      if (favoriteQuestions.has(questionId)) {
        favoriteQuestions.delete(questionId);
        if (favoriteButton) favoriteButton.classList.remove('active');
        console.log('즐겨찾기에서 제거:', questionId);
      } else {
        favoriteQuestions.add(questionId);
        if (favoriteButton) favoriteButton.classList.add('active');
        console.log('즐겨찾기에 추가:', questionId);
      }
    }
  } catch (error) {
    console.error('즐겨찾기 처리 실패:', error);
    // 에러 발생 시 로컬에서만 처리
    if (favoriteQuestions.has(questionId)) {
      favoriteQuestions.delete(questionId);
      if (favoriteButton) favoriteButton.classList.remove('active');
    } else {
      favoriteQuestions.add(questionId);
      if (favoriteButton) favoriteButton.classList.add('active');
    }
  }
}

// 노트 토글
function toggleNote() {
  const rightPanel = document.getElementById('rightPanel');
  const noteToggleButton = document.getElementById('noteToggleButton');
  
  if (!rightPanel || !noteToggleButton) return;
  
  if (rightPanel.style.display === 'none' || rightPanel.style.display === '') {
    rightPanel.style.display = 'block';
    noteToggleButton.classList.add('active');
    
    // 현재 문제의 노트 로드
    if (currentQuestion && userNotes[currentQuestion.문항번호]) {
      const noteText = document.getElementById('noteText');
      if (noteText) {
        noteText.value = userNotes[currentQuestion.문항번호];
      }
    }
  } else {
    rightPanel.style.display = 'none';
    noteToggleButton.classList.remove('active');
  }
}

// 답안 확인
async function checkAnswer() {
  const answerInput = document.getElementById('answer');
  const resultDiv = document.getElementById('result');
  const solutionLink = document.getElementById('solutionLink');
  
  if (!currentQuestion) {
    alert('문제를 먼저 선택해주세요.');
    return;
  }
  
  if (!answerInput || !resultDiv) {
    console.error('필요한 DOM 요소를 찾을 수 없습니다.');
    return;
  }
  
  const userAnswer = answerInput.value.trim();
  const correctAnswer = currentQuestion.정답;
  
  if (userAnswer === '') {
    alert('답을 입력해주세요.');
    return;
  }
  
  const isCorrect = userAnswer === correctAnswer;
  
  if (isCorrect) {
    resultDiv.innerHTML = '<span style="color: #27ae60;">✓ 정답입니다!</span>';
    resultDiv.style.color = '#27ae60';
    
    // 해설 링크 표시
    if (currentQuestion.해설주소) {
      solutionLink.innerHTML = `<a href="${currentQuestion.해설주소}" target="_blank">📺 해설 영상 보기</a>`;
    }
    
    // 정답 시 포인트, 코인, 경험치 지급 및 게임화 체크
    if (auth && auth.currentUser) {
      try {
        const userId = auth.currentUser.uid;
        
        // 새로운 보상 시스템 사용
        const coinReward = await giveProblemSolveReward(userId, true, currentQuestion.문항번호);
        await updateUserPoints(userId, 10, '문제 정답');
        
        // 경험치 추가 및 레벨업 체크
        const expResult = await addExperience(userId, 5, '문제 정답');
        
        // 보상 메시지 표시
        let rewardMessage = '';
        if (coinReward > 0) {
          rewardMessage += coinReward > SYSTEM_CONFIG.COIN.PROBLEM_SOLVE_REWARD 
            ? `+${coinReward}코인 (연속 정답 보너스 포함!)`
            : `+${coinReward}코인`;
        }
        
        if (expResult.leveledUp) {
          rewardMessage += rewardMessage ? '<br>' : '';
          rewardMessage += `🎉 레벨업! 레벨 ${expResult.newLevel} 달성`;
        }
        
        if (rewardMessage) {
          resultDiv.innerHTML += `<br><small style="color: #f39c12;">${rewardMessage}</small>`;
        }
        
        // 배지 및 업적 체크
        await checkAndGiveBadge(userId, 'FIRST_CORRECT');
        await checkAndGiveBadge(userId, 'STREAK_5');
        await checkAndGiveBadge(userId, 'STREAK_10');
        await checkAndGiveAchievement(userId, 'PROBLEM_SOLVER');
        await checkAndGiveAchievement(userId, 'PERFECT_STREAK');
        
        console.log('정답 보상 지급 완료');
      } catch (error) {
        console.error('보상 지급 실패:', error);
      }
    }
  } else {
    resultDiv.innerHTML = `<span style="color: #e74c3c;">✗ 오답입니다. 정답: ${correctAnswer}</span>`;
    resultDiv.style.color = '#e74c3c';
    
    // 해설 링크 표시 (오답 시에도)
    if (currentQuestion.해설주소) {
      solutionLink.innerHTML = `<a href="${currentQuestion.해설주소}" target="_blank">📺 해설 영상 보기</a>`;
    }
    
    // 오답 시 연속 정답 수 초기화
    if (auth && auth.currentUser) {
      try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          correctStreak: 0
        });
      } catch (error) {
        console.error('연속 정답 수 초기화 실패:', error);
      }
    }
  }
  
  // 입력 필드 초기화
  answerInput.value = '';
}

// 이전 문제로 이동
function navigateToPreviousQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    loadQuestion(currentQuestionIndex);
  }
}

// 다음 문제로 이동
function navigateToNextQuestion() {
  if (currentQuestionIndex < questionsData.length - 1) {
    currentQuestionIndex++;
    loadQuestion(currentQuestionIndex);
  }
}

// 모바일 메뉴 토글
function toggleMenu() {
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenu) {
    mobileMenu.classList.toggle('open');
  }
}

// 모바일 메뉴 닫기
function closeMobileMenu() {
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenu) {
    mobileMenu.classList.remove('open');
  }
}

// 노트 저장
async function saveNote() {
  const noteText = document.getElementById('noteText');
  if (!noteText || !currentQuestion) return;
  
  const noteContent = noteText.value.trim();
  
  try {
    if (auth && auth.currentUser) {
      const userId = auth.currentUser.uid;
      const noteRef = doc(db, 'user_notes', `${userId}_${currentQuestion.문항번호}`);
      
      if (noteContent) {
        await setDoc(noteRef, {
          userId: userId,
          questionId: currentQuestion.문항번호,
          content: noteContent,
          updatedAt: serverTimestamp()
        });
        userNotes[currentQuestion.문항번호] = noteContent;
        alert('노트가 저장되었습니다.');
      } else {
        await deleteDoc(noteRef);
        delete userNotes[currentQuestion.문항번호];
        alert('노트가 삭제되었습니다.');
      }
    } else {
      // 로그인하지 않은 경우 로컬에만 저장
      if (noteContent) {
        userNotes[currentQuestion.문항번호] = noteContent;
        alert('노트가 임시 저장되었습니다. (로그인 후 영구 저장됩니다)');
      } else {
        delete userNotes[currentQuestion.문항번호];
        alert('노트가 삭제되었습니다.');
      }
    }
  } catch (error) {
    console.error('노트 저장 실패:', error);
    alert('노트 저장에 실패했습니다.');
  }
}

// 노트 삭제
function clearNote() {
  const noteText = document.getElementById('noteText');
  if (noteText) {
    noteText.value = '';
  }
}

// 전역 함수로 노출 (HTML에서 onclick으로 호출하기 위함)
window.goToDashboard = goToDashboard;
window.toggleNote = toggleNote;
window.toggleFavorite = toggleFavorite;
window.checkAnswer = checkAnswer;
window.navigateToPreviousQuestion = navigateToPreviousQuestion;
window.navigateToNextQuestion = navigateToNextQuestion;
window.toggleMenu = toggleMenu;
window.closeMobileMenu = closeMobileMenu;
window.saveNote = saveNote;
window.clearNote = clearNote;

// 코인 시스템 함수들 전역 노출
window.getUserCoins = getUserCoins;
window.addCoins = addCoins;
window.spendCoins = spendCoins;
window.getCoinHistory = getCoinHistory;
window.sendCoinGift = sendCoinGift;
window.getGiftHistory = getGiftHistory;
window.searchUsersForGift = searchUsersForGift;
window.giveDailyLoginReward = giveDailyLoginReward;
window.giveProblemSolveReward = giveProblemSolveReward;
window.giveChallengeReward = giveChallengeReward;
window.giveLevelUpReward = giveLevelUpReward;
window.giveBadgeReward = giveBadgeReward;
window.giveAchievementReward = giveAchievementReward;

// 게임화 시스템 함수들 전역 노출
window.addExperience = addExperience;
window.checkAndGiveBadge = checkAndGiveBadge;
window.checkAndGiveAchievement = checkAndGiveAchievement;
window.getLoginHistory = getLoginHistory;
window.getSolvedProblemsCount = getSolvedProblemsCount;

// 모달 외부 클릭 시 닫기
window.onclick = function(event) {
  const modal = document.getElementById('imageModal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    const modal = document.getElementById('imageModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
});

// 화면 방향 체크
function checkOrientation() {
  const rotateMessage = document.getElementById('rotateMessage');
  if (rotateMessage) {
    if (window.innerWidth < 768 && window.innerHeight < window.innerWidth) {
      rotateMessage.style.display = 'flex';
    } else {
      rotateMessage.style.display = 'none';
    }
  }
}

// 화면 크기 변경 시 방향 체크
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);

// 초기 방향 체크
checkOrientation();

// ===== 거래소 시스템 =====

/**
 * 거래소 주문 생성
 * @param {string} userId - 사용자 ID
 * @param {string} orderType - 주문 타입 ('buy' 또는 'sell')
 * @param {number} price - 주문 가격
 * @param {number} amount - 주문 수량
 * @returns {Promise<Object>} 주문 결과
 */
async function createTradingOrder(userId, orderType, price, amount) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }
    
    // 입력값 검증
    if (orderType !== 'buy' && orderType !== 'sell') {
      throw new Error('잘못된 주문 타입입니다.');
    }
    
    if (price <= 0 || amount <= 0) {
      throw new Error('가격과 수량은 0보다 커야 합니다.');
    }
    
    if (amount < SYSTEM_CONFIG.TRADING.MIN_ORDER_AMOUNT || amount > SYSTEM_CONFIG.TRADING.MAX_ORDER_AMOUNT) {
      throw new Error(`주문 수량은 ${SYSTEM_CONFIG.TRADING.MIN_ORDER_AMOUNT}~${SYSTEM_CONFIG.TRADING.MAX_ORDER_AMOUNT} 사이여야 합니다.`);
    }
    
    // 사용자 코인 잔고 확인
    const userCoins = await getUserCoins(userId);
    const totalCost = price * amount;
    const tradingFee = totalCost * SYSTEM_CONFIG.TRADING.TRADING_FEE_PERCENT;
    
    if (orderType === 'buy') {
      const requiredCoins = totalCost + tradingFee;
      if (userCoins < requiredCoins) {
        throw new Error(`코인이 부족합니다. 필요: ${requiredCoins.toFixed(2)} 코인, 보유: ${userCoins.toFixed(2)} 코인`);
      }
    }
    
    // 사용자의 기존 주문 수 확인
    const existingOrdersQuery = query(
      collection(db, 'trading_orders'),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    const existingOrdersSnapshot = await getDocs(existingOrdersQuery);
    
    if (existingOrdersSnapshot.size >= SYSTEM_CONFIG.TRADING.MAX_ORDERS_PER_USER) {
      throw new Error(`최대 주문 수(${SYSTEM_CONFIG.TRADING.MAX_ORDERS_PER_USER}개)를 초과했습니다.`);
    }
    
    // 주문 생성
    const orderData = {
      userId: userId,
      orderType: orderType,
      price: parseFloat(price.toFixed(SYSTEM_CONFIG.TRADING.PRICE_DECIMAL_PLACES)),
      amount: parseFloat(amount.toFixed(SYSTEM_CONFIG.TRADING.AMOUNT_DECIMAL_PLACES)),
      totalCost: parseFloat(totalCost.toFixed(SYSTEM_CONFIG.TRADING.PRICE_DECIMAL_PLACES)),
      tradingFee: parseFloat(tradingFee.toFixed(SYSTEM_CONFIG.TRADING.PRICE_DECIMAL_PLACES)),
      status: 'active',
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + SYSTEM_CONFIG.TRADING.ORDER_EXPIRY_HOURS * 60 * 60 * 1000)
    };
    
    const orderRef = await addDoc(collection(db, 'trading_orders'), orderData);
    
    // 거래 내역 추가
    await addCoinTransaction(
      userId,
      orderType === 'buy' ? 'trading_buy_order' : 'trading_sell_order',
      orderType === 'buy' ? -totalCost : 0,
      `${orderType === 'buy' ? '매수' : '매도'} 주문 - ${amount}개 @ ${price} 코인`,
      userCoins
    );
    
    console.log('거래소 주문 생성 성공:', orderRef.id);
    return {
      success: true,
      orderId: orderRef.id,
      order: orderData
    };
    
  } catch (error) {
    console.error('거래소 주문 생성 실패:', error);
    throw error;
  }
}

/**
 * 거래소 주문 취소
 * @param {string} userId - 사용자 ID
 * @param {string} orderId - 주문 ID
 * @returns {Promise<Object>} 취소 결과
 */
async function cancelTradingOrder(userId, orderId) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    if (!userId || !orderId) {
      throw new Error('사용자 ID와 주문 ID가 필요합니다.');
    }
    
    const orderRef = doc(db, 'trading_orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      throw new Error('주문을 찾을 수 없습니다.');
    }
    
    const orderData = orderDoc.data();
    
    if (orderData.userId !== userId) {
      throw new Error('본인의 주문만 취소할 수 있습니다.');
    }
    
    if (orderData.status !== 'active') {
      throw new Error('활성 상태의 주문만 취소할 수 있습니다.');
    }
    
    // 주문 상태를 취소로 변경
    await updateDoc(orderRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp()
    });
    
    // 매수 주문 취소 시 코인 환불
    if (orderData.orderType === 'buy') {
      const refundAmount = orderData.totalCost + orderData.tradingFee;
      await addCoins(userId, refundAmount, `매수 주문 취소 환불 - 주문 #${orderId}`);
    }
    
    console.log('거래소 주문 취소 성공:', orderId);
    return {
      success: true,
      orderId: orderId
    };
    
  } catch (error) {
    console.error('거래소 주문 취소 실패:', error);
    throw error;
  }
}

/**
 * 거래소 호가창 조회
 * @returns {Promise<Object>} 호가창 데이터
 */
async function getOrderbook() {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    // 활성 주문 조회
    const activeOrdersQuery = query(
      collection(db, 'trading_orders'),
      where('status', '==', 'active'),
      orderBy('price', 'desc')
    );
    
    const ordersSnapshot = await getDocs(activeOrdersQuery);
    const orders = [];
    
    ordersSnapshot.forEach(doc => {
      orders.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // 매수/매도 주문 분리
    const buyOrders = orders.filter(order => order.orderType === 'buy');
    const sellOrders = orders.filter(order => order.orderType === 'sell');
    
    // 가격별로 그룹화
    const buyOrderbook = {};
    const sellOrderbook = {};
    
    buyOrders.forEach(order => {
      const price = order.price;
      if (!buyOrderbook[price]) {
        buyOrderbook[price] = { price, totalAmount: 0, orderCount: 0 };
      }
      buyOrderbook[price].totalAmount += order.amount;
      buyOrderbook[price].orderCount++;
    });
    
    sellOrders.forEach(order => {
      const price = order.price;
      if (!sellOrderbook[price]) {
        sellOrderbook[price] = { price, totalAmount: 0, orderCount: 0 };
      }
      sellOrderbook[price].totalAmount += order.amount;
      sellOrderbook[price].orderCount++;
    });
    
    // 가격순으로 정렬
    const buyOrderbookArray = Object.values(buyOrderbook)
      .sort((a, b) => b.price - a.price)
      .slice(0, 10); // 상위 10개
    
    const sellOrderbookArray = Object.values(sellOrderbook)
      .sort((a, b) => a.price - b.price)
      .slice(0, 10); // 상위 10개
    
    return {
      buy: buyOrderbookArray,
      sell: sellOrderbookArray
    };
    
  } catch (error) {
    console.error('호가창 조회 실패:', error);
    throw error;
  }
}

/**
 * 거래소 거래 내역 조회
 * @param {number} limit - 조회할 거래 수
 * @returns {Promise<Array>} 거래 내역
 */
async function getTradeHistory(limit = SYSTEM_CONFIG.TRADING.TRADE_HISTORY_LIMIT) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    const tradesQuery = query(
      collection(db, 'trading_trades'),
      orderBy('createdAt', 'desc'),
      limit(limit)
    );
    
    const tradesSnapshot = await getDocs(tradesQuery);
    const trades = [];
    
    tradesSnapshot.forEach(doc => {
      trades.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return trades;
    
  } catch (error) {
    console.error('거래 내역 조회 실패:', error);
    throw error;
  }
}

/**
 * 사용자의 거래소 주문 조회
 * @param {string} userId - 사용자 ID
 * @param {string} status - 주문 상태 (선택사항)
 * @returns {Promise<Array>} 주문 목록
 */
async function getUserTradingOrders(userId, status = null) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }
    
    let ordersQuery = query(
      collection(db, 'trading_orders'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    if (status) {
      ordersQuery = query(
        collection(db, 'trading_orders'),
        where('userId', '==', userId),
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
    }
    
    const ordersSnapshot = await getDocs(ordersQuery);
    const orders = [];
    
    ordersSnapshot.forEach(doc => {
      orders.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return orders;
    
  } catch (error) {
    console.error('사용자 주문 조회 실패:', error);
    throw error;
  }
}

/**
 * 거래소 실시간 가격 업데이트
 * @returns {Promise<number>} 현재 가격
 */
async function updateTradingPrice() {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    // 최근 거래 가격 조회
    const recentTradesQuery = query(
      collection(db, 'trading_trades'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    const recentTradesSnapshot = await getDocs(recentTradesQuery);
    let currentPrice = 100; // 기본 가격
    
    if (!recentTradesSnapshot.empty) {
      const lastTrade = recentTradesSnapshot.docs[0].data();
      currentPrice = lastTrade.price;
    }
    
    // 가격 변동 시뮬레이션 (실제로는 시장 수요/공급에 따라 결정)
    const priceChange = (Math.random() - 0.5) * SYSTEM_CONFIG.TRADING.MAX_PRICE_CHANGE;
    const newPrice = Math.max(
      SYSTEM_CONFIG.TRADING.MIN_PRICE_CHANGE,
      currentPrice + priceChange
    );
    
    // 새로운 가격을 거래소 상태에 저장
    const priceRef = doc(db, 'trading_status', 'current_price');
    await setDoc(priceRef, {
      price: parseFloat(newPrice.toFixed(SYSTEM_CONFIG.TRADING.PRICE_DECIMAL_PLACES)),
      updatedAt: serverTimestamp()
    });
    
    return parseFloat(newPrice.toFixed(SYSTEM_CONFIG.TRADING.PRICE_DECIMAL_PLACES));
    
  } catch (error) {
    console.error('거래소 가격 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 거래소 매칭 엔진 (주문 매칭) - 개선된 버전
 * @returns {Promise<Array>} 매칭된 거래 목록
 */
async function processTradingMatches() {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    // 활성 주문 조회 (최근 주문 우선)
    const activeOrdersQuery = query(
      collection(db, 'trading_orders'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );
    
    const ordersSnapshot = await getDocs(activeOrdersQuery);
    const orders = [];
    
    ordersSnapshot.forEach(doc => {
      orders.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // 매수/매도 주문 분리
    const buyOrders = orders.filter(order => order.orderType === 'buy')
      .sort((a, b) => b.price - a.price); // 높은 가격순
    
    const sellOrders = orders.filter(order => order.orderType === 'sell')
      .sort((a, b) => a.price - b.price); // 낮은 가격순
    
    const matches = [];
    const processedMatches = [];
    
    // 개선된 매칭 로직
    for (const buyOrder of buyOrders) {
      if (buyOrder.amount <= 0) continue;
      
      for (const sellOrder of sellOrders) {
        if (sellOrder.amount <= 0) continue;
        
        if (buyOrder.price >= sellOrder.price) {
          // 매칭 가능
          const matchAmount = Math.min(buyOrder.amount, sellOrder.amount);
          const matchPrice = sellOrder.price; // 매도 가격 기준
          
          if (matchAmount > 0) {
            try {
              const match = {
                buyOrderId: buyOrder.id,
                sellOrderId: sellOrder.id,
                buyUserId: buyOrder.userId,
                sellUserId: sellOrder.userId,
                amount: matchAmount,
                price: matchPrice,
                totalValue: matchAmount * matchPrice
              };
              
              // 거래 처리
              await processTradeMatch(match);
              processedMatches.push(match);
              
              // 주문 수량 업데이트
              buyOrder.amount -= matchAmount;
              sellOrder.amount -= matchAmount;
              
              // 주문이 완전히 체결되면 상태 변경
              if (buyOrder.amount <= 0) {
                await updateDoc(doc(db, 'trading_orders', buyOrder.id), {
                  status: 'completed',
                  completedAt: serverTimestamp()
                });
              }
              
              if (sellOrder.amount <= 0) {
                await updateDoc(doc(db, 'trading_orders', sellOrder.id), {
                  status: 'completed',
                  completedAt: serverTimestamp()
                });
              }
              
            } catch (error) {
              console.error('개별 거래 매칭 처리 실패:', error);
              // 개별 매칭 실패 시에도 계속 진행
              continue;
            }
          }
        }
      }
    }
    
    // 매칭 결과 로깅
    if (processedMatches.length > 0) {
      console.log(`${processedMatches.length}개의 거래가 매칭되었습니다.`);
    }
    
    return processedMatches;
    
  } catch (error) {
    console.error('거래 매칭 처리 실패:', error);
    throw new Error(ERROR_MESSAGES.TRADING_ERROR + ': ' + error.message);
  }
}

/**
 * 거래 매칭 처리
 * @param {Object} match - 매칭 정보
 * @returns {Promise<void>}
 */
async function processTradeMatch(match) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    // 거래 기록 생성
    const tradeData = {
      buyOrderId: match.buyOrderId,
      sellOrderId: match.sellOrderId,
      buyUserId: match.buyUserId,
      sellUserId: match.sellUserId,
      amount: match.amount,
      price: match.price,
      totalValue: match.totalValue,
      tradingFee: match.totalValue * SYSTEM_CONFIG.TRADING.TRADING_FEE_PERCENT,
      createdAt: serverTimestamp()
    };
    
    const tradeRef = await addDoc(collection(db, 'trading_trades'), tradeData);
    
    // 코인 이체 처리
    const tradingFee = match.totalValue * SYSTEM_CONFIG.TRADING.TRADING_FEE_PERCENT;
    const netAmount = match.totalValue - tradingFee;
    
    // 매수자에게 코인 차감
    await spendCoins(match.buyUserId, match.totalValue, `거래소 매수 - ${match.amount}개 @ ${match.price} 코인`);
    
    // 매도자에게 코인 지급
    await addCoins(match.sellUserId, netAmount, `거래소 매도 - ${match.amount}개 @ ${match.price} 코인`);
    
    // 거래 수수료는 시스템에서 수집
    await addCoins('system', tradingFee, `거래소 수수료 - 거래 #${tradeRef.id}`);
    
    // 주문 상태 업데이트
    const buyOrderRef = doc(db, 'trading_orders', match.buyOrderId);
    const sellOrderRef = doc(db, 'trading_orders', match.sellOrderId);
    
    await updateDoc(buyOrderRef, {
      amount: match.amount,
      status: match.amount <= 0 ? 'completed' : 'active',
      updatedAt: serverTimestamp()
    });
    
    await updateDoc(sellOrderRef, {
      amount: match.amount,
      status: match.amount <= 0 ? 'completed' : 'active',
      updatedAt: serverTimestamp()
    });
    
    // 거래 체결 피드백 생성
    const tradeFeedback = {
      tradeId: tradeRef.id,
      amount: match.amount,
      price: match.price,
      totalValue: match.totalValue,
      buyUserId: match.buyUserId,
      sellUserId: match.sellUserId,
      timestamp: new Date()
    };
    
    // 전역 이벤트로 거래 체결 알림
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tradeExecuted', {
        detail: tradeFeedback
      }));
    }
    
    console.log('거래 매칭 처리 완료:', tradeRef.id);
    
  } catch (error) {
    console.error('거래 매칭 처리 실패:', error);
    throw error;
  }
}

// 코인 획득 애니메이션 표시 함수
function showCoinEarnedAnimation(amount, reason) {
  // 기존 애니메이션 제거
  const existingAnimations = document.querySelectorAll('.coin-earned-animation');
  existingAnimations.forEach(anim => anim.remove());
  
  const animationDiv = document.createElement('div');
  animationDiv.className = 'coin-earned-animation';
  animationDiv.innerHTML = `
    <div class="coin-animation-content">
      <div class="coin-icon">💰</div>
      <div class="coin-amount">+${amount}</div>
      <div class="coin-reason">${reason}</div>
    </div>
  `;
  
  // 스타일 적용
  animationDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #FFD700, #FFA500);
    color: #2D3748;
    padding: 20px 30px;
    border-radius: 15px;
    font-weight: bold;
    font-size: 1.2rem;
    z-index: 10001;
    box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4);
    animation: coinEarned 2s ease-out forwards;
    text-align: center;
  `;
  
  document.body.appendChild(animationDiv);
  
  // 2초 후 제거
  setTimeout(() => {
    if (animationDiv.parentNode) {
      animationDiv.remove();
    }
  }, 2000);
}

// 코인 획득 이벤트 리스너 설정
function setupCoinEarnedListener() {
  window.addEventListener('coinsEarned', (event) => {
    const { amount, reason } = event.detail;
    showCoinEarnedAnimation(amount, reason);
  });
}

// 거래소 함수들 전역 노출
window.createTradingOrder = createTradingOrder;
window.cancelTradingOrder = cancelTradingOrder;
window.getOrderbook = getOrderbook;
window.getTradeHistory = getTradeHistory;
window.getUserTradingOrders = getUserTradingOrders;
window.updateTradingPrice = updateTradingPrice;
window.processTradingMatches = processTradingMatches;

// ===== 로또 시스템 =====

/**
 * 로또 번호 생성
 * @returns {Array<number>} 로또 번호 배열 (1-45)
 */
function generateLotteryNumbers() {
  const numbers = [];
  while (numbers.length < 6) {
    const num = Math.floor(Math.random() * 45) + 1;
    if (!numbers.includes(num)) {
      numbers.push(num);
    }
  }
  return numbers.sort((a, b) => a - b);
}

/**
 * 로또 당첨 확인
 * @param {Array<number>} userNumbers - 사용자 번호
 * @param {Array<number>} winningNumbers - 당첨 번호
 * @returns {Object} 당첨 결과
 */
function checkLotteryWin(userNumbers, winningNumbers) {
  const matches = userNumbers.filter(num => winningNumbers.includes(num)).length;
  
  let prize = 0;
  let rank = 0;
  
  switch (matches) {
    case 6:
      rank = 1;
      prize = 1000; // 1등: 1000 코인
      break;
    case 5:
      rank = 2;
      prize = 100; // 2등: 100 코인
      break;
    case 4:
      rank = 3;
      prize = 50; // 3등: 50 코인
      break;
    case 3:
      rank = 4;
      prize = 10; // 4등: 10 코인
      break;
    case 2:
      rank = 5;
      prize = 5; // 5등: 5 코인
      break;
    case 1:
      rank = 6;
      prize = 1; // 6등: 1 코인
      break;
    default:
      rank = 0;
      prize = 0;
  }
  
  return {
    rank: rank,
    prize: prize,
    matches: matches,
    isWin: rank > 0
  };
}

/**
 * 로또 구매 및 추첨
 * @param {string} userId - 사용자 ID
 * @param {Array<number>} userNumbers - 사용자 선택 번호
 * @returns {Promise<Object>} 로또 결과
 */
async function buyLotteryTicket(userId, userNumbers) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }
    
    if (!userNumbers || userNumbers.length !== 6) {
      throw new Error('6개의 번호를 선택해야 합니다.');
    }
    
    // 사용자 코인 잔고 확인
    const userCoins = await getUserCoins(userId);
    const ticketCost = SYSTEM_CONFIG.COIN.LOTTERY_TICKET_COST;
    
    if (userCoins < ticketCost) {
      throw new Error('로또 구매에 필요한 코인이 부족합니다.');
    }
    
    // 코인 차감
    await spendCoins(userId, ticketCost, '로또 구매');
    
    // 당첨 번호 생성
    const winningNumbers = generateLotteryNumbers();
    
    // 당첨 확인
    const result = checkLotteryWin(userNumbers, winningNumbers);
    
    // 로또 기록 저장
    const lotteryData = {
      userId: userId,
      userNumbers: userNumbers,
      winningNumbers: winningNumbers,
      rank: result.rank,
      prize: result.prize,
      matches: result.matches,
      isWin: result.isWin,
      purchasedAt: serverTimestamp()
    };
    
    const lotteryRef = await addDoc(collection(db, 'lottery_tickets'), lotteryData);
    
    // 당첨 시 코인 지급
    if (result.isWin) {
      await addCoins(userId, result.prize, `로또 ${result.rank}등 당첨`);
    }
    
    console.log('로또 구매 완료:', lotteryRef.id);
    return {
      success: true,
      ticketId: lotteryRef.id,
      result: result,
      lotteryData: lotteryData
    };
    
  } catch (error) {
    console.error('로또 구매 실패:', error);
    throw error;
  }
}

/**
 * 사용자 로또 내역 조회
 * @param {string} userId - 사용자 ID
 * @param {number} limit - 조회할 개수
 * @returns {Promise<Array>} 로또 내역
 */
async function getUserLotteryHistory(userId, limit = 20) {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }
    
    const lotteryQuery = query(
      collection(db, 'lottery_tickets'),
      where('userId', '==', userId),
      orderBy('purchasedAt', 'desc'),
      limit(limit)
    );
    
    const lotterySnapshot = await getDocs(lotteryQuery);
    const lotteryHistory = [];
    
    lotterySnapshot.forEach(doc => {
      lotteryHistory.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return lotteryHistory;
    
  } catch (error) {
    console.error('로또 내역 조회 실패:', error);
    throw error;
  }
}

/**
 * 로또 통계 조회
 * @returns {Promise<Object>} 로또 통계
 */
async function getLotteryStats() {
  try {
    if (!db) {
      db = await getFirebaseDb();
    }
    
    // 전체 로또 티켓 수
    const totalTicketsQuery = query(collection(db, 'lottery_tickets'));
    const totalTicketsSnapshot = await getDocs(totalTicketsQuery);
    const totalTickets = totalTicketsSnapshot.size;
    
    // 당첨 통계
    const winningTicketsQuery = query(
      collection(db, 'lottery_tickets'),
      where('isWin', '==', true)
    );
    const winningTicketsSnapshot = await getDocs(winningTicketsQuery);
    const winningTickets = winningTicketsSnapshot.size;
    
    // 등수별 통계
    const rankStats = {};
    for (let rank = 1; rank <= 6; rank++) {
      const rankQuery = query(
        collection(db, 'lottery_tickets'),
        where('rank', '==', rank)
      );
      const rankSnapshot = await getDocs(rankQuery);
      rankStats[rank] = rankSnapshot.size;
    }
    
    // 총 상금 지급액
    const totalPrizeQuery = query(
      collection(db, 'lottery_tickets'),
      where('isWin', '==', true)
    );
    const totalPrizeSnapshot = await getDocs(totalPrizeQuery);
    let totalPrize = 0;
    
    totalPrizeSnapshot.forEach(doc => {
      const data = doc.data();
      totalPrize += data.prize || 0;
    });
    
    return {
      totalTickets: totalTickets,
      winningTickets: winningTickets,
      winRate: totalTickets > 0 ? (winningTickets / totalTickets * 100).toFixed(2) : 0,
      rankStats: rankStats,
      totalPrize: totalPrize
    };
    
  } catch (error) {
    console.error('로또 통계 조회 실패:', error);
    throw error;
  }
}

/**
 * 로또 당첨 확률 계산
 * @param {number} rank - 등수
 * @returns {number} 당첨 확률
 */
function calculateLotteryProbability(rank) {
  const totalNumbers = 45;
  const selectedNumbers = 6;
  
  switch (rank) {
    case 1: // 6개 모두 일치
      return 1 / (45 * 44 * 43 * 42 * 41 * 40 / (6 * 5 * 4 * 3 * 2 * 1));
    case 2: // 5개 일치
      return (6 * 39) / (45 * 44 * 43 * 42 * 41 * 40 / (6 * 5 * 4 * 3 * 2 * 1));
    case 3: // 4개 일치
      return (6 * 5 * 39 * 38 / 2) / (45 * 44 * 43 * 42 * 41 * 40 / (6 * 5 * 4 * 3 * 2 * 1));
    case 4: // 3개 일치
      return (6 * 5 * 4 * 39 * 38 * 37 / 6) / (45 * 44 * 43 * 42 * 41 * 40 / (6 * 5 * 4 * 3 * 2 * 1));
    case 5: // 2개 일치
      return (6 * 5 * 4 * 3 * 39 * 38 / 24) / (45 * 44 * 43 * 42 * 41 * 40 / (6 * 5 * 4 * 3 * 2 * 1));
    case 6: // 1개 일치
      return (6 * 5 * 4 * 3 * 2 * 39 / 120) / (45 * 44 * 43 * 42 * 41 * 40 / (6 * 5 * 4 * 3 * 2 * 1));
    default:
      return 0;
  }
}

// 로또 함수들 전역 노출
window.generateLotteryNumbers = generateLotteryNumbers;
window.checkLotteryWin = checkLotteryWin;
window.buyLotteryTicket = buyLotteryTicket;
window.getUserLotteryHistory = getUserLotteryHistory;
window.getLotteryStats = getLotteryStats;
window.calculateLotteryProbability = calculateLotteryProbability;

/**
 * 사용자 코인 초기화
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} 초기화 성공 여부
 */
async function initializeUserCoins(userId = null) {
  try {
    const db = await getFirebaseDb();
    
    if (userId) {
      // 특정 사용자 초기화
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }
      
      const userData = userDoc.data();
      if (!userData.coins) {
        await updateDoc(userRef, {
          coins: SYSTEM_CONFIG.COIN.INITIAL_COINS,
          coinHistory: [],
          lastCoinUpdate: new Date().toISOString()
        });
        console.log(`사용자 ${userId}의 코인이 초기화되었습니다.`);
      }
      
      return true;
    } else {
      // 모든 사용자 초기화
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      let updatedCount = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (!userData.coins) {
          await updateDoc(userDoc.ref, {
            coins: SYSTEM_CONFIG.COIN.INITIAL_COINS,
            coinHistory: [],
            lastCoinUpdate: new Date().toISOString()
          });
          updatedCount++;
        }
      }
      
      console.log(`${updatedCount}명의 사용자 코인이 초기화되었습니다.`);
      return updatedCount > 0;
    }
  } catch (error) {
    console.error('사용자 코인 초기화 실패:', error);
    throw error;
  }
}

// ===== Export 구문들 =====
export { 
  firebaseConfig, 
  ERROR_MESSAGES, 
  SYSTEM_CONFIG as Utils, 
  getFirebaseApp, 
  getFirebaseAuth,
  getUserCoins,
  spendCoins,
  addCoins,
  onCoinsChange,
  initializeUserCoins,
  getFirebaseDb
};

// ===== gsg.html에서 호출하는 함수들을 window 객체에 할당 =====
window.navigateToPreviousQuestionFromScript = navigateToPreviousQuestion;
window.navigateToNextQuestionFromScript = navigateToNextQuestion;
window.checkAnswerFromScript = checkAnswer;
window.toggleFavoriteFromScript = toggleFavorite;
window.saveNoteFromScript = saveNote;

// ===== 추가 전역 함수들 =====
window.showQuestionModal = showQuestionModal;
window.closeQuestionModal = closeQuestionModal;
window.toggleMenu = toggleMenu;
window.closeMobileMenu = closeMobileMenu;
window.clearNote = clearNote;
window.checkOrientation = checkOrientation;

// ===== 대시보드 관련 함수들 =====
window.exportChart = function(chartId) {
  console.log('차트 내보내기:', chartId);
  // 차트 내보내기 로직 구현
};

window.exportHeatmap = function() {
  console.log('히트맵 내보내기');
  // 히트맵 내보내기 로직 구현
};

window.rotate3DChart = function() {
  console.log('3D 차트 회전');
  // 3D 차트 회전 로직 구현
};

window.export3DChart = function() {
  console.log('3D 차트 내보내기');
  // 3D 차트 내보내기 로직 구현
};

window.toggleAdvancedViz = function() {
  console.log('고급 시각화 전환');
  // 고급 시각화 전환 로직 구현
};

window.exportAdvancedViz = function() {
  console.log('고급 시각화 내보내기');
  // 고급 시각화 내보내기 로직 구현
};

window.resetZoom = function(chartId) {
  console.log('줌 초기화:', chartId);
  // 줌 초기화 로직 구현
};

window.retryLoad = function() {
  console.log('다시 로드');
  // 다시 로드 로직 구현
};

// ===== 페이지 이동 함수들 =====
window.goToDashboard = function() {
  window.location.href = 'dashboard.html';
};

window.showInfoi = function() {
  window.location.href = 'infoi.html';
};

window.showDashboard = function() {
  window.location.href = 'dashboard.html';
};

window.showFavorites = function() {
  window.location.href = 'favorite.html';
};

window.showFeedback = function() {
  window.location.href = 'feedback.html';
};

window.showGamification = function() {
  window.location.href = 'gamification.html';
};

window.showDailyChallenges = function() {
  window.location.href = 'daily-challenges.html';
};

window.showMockExam = function() {
  window.location.href = 'mock-exam.html';
};

window.showExamResult = function() {
  window.location.href = 'exam-result.html';
};

window.showShop = function() {
  window.location.href = 'shop.html';
};

window.showLottery = function() {
  window.location.href = 'lottery.html';
};

window.showTrading = function() {
  window.location.href = 'trading.html';
};

window.showStudyGroups = function() {
  window.location.href = 'study-groups.html';
};

window.showProfile = function() {
  window.location.href = 'profile.html';
};

window.showRecommendations = function() {
  window.location.href = 'recommendations.html';
};

window.showSpacedRepetition = function() {
  window.location.href = 'spaced-repetition.html';
};

window.showQASystem = function() {
  window.location.href = 'qa-system.html';
};

// ===== 초기화 함수 =====
window.initializeMathApp = initializeMathApp;
window.loadQuestions = loadQuestions;
window.generateSidebarMenu = generateSidebarMenu;
window.generateQuestionTree = generateQuestionTree;
window.loadQuestion = loadQuestion;
window.updateSidebarSelection = updateSidebarSelection;
window.setupEventListeners = setupEventListeners;

// ===== 코인 관련 함수들 =====
window.getUserCoins = getUserCoins;
window.addCoins = addCoins;
window.spendCoins = spendCoins;
window.sendCoinGift = sendCoinGift;
window.getGiftHistory = getGiftHistory;
window.searchUsersForGift = searchUsersForGift;

// ===== 거래소 관련 함수들 =====
window.createTradingOrder = createTradingOrder;
window.cancelTradingOrder = cancelTradingOrder;
window.getOrderbook = getOrderbook;
window.getTradeHistory = getTradeHistory;
window.getUserTradingOrders = getUserTradingOrders;
window.updateTradingPrice = updateTradingPrice;

// ===== 로또 관련 함수들 =====
window.generateLotteryNumbers = generateLotteryNumbers;
window.checkLotteryWin = checkLotteryWin;
window.buyLotteryTicket = buyLotteryTicket;
window.getUserLotteryHistory = getUserLotteryHistory;
window.getLotteryStats = getLotteryStats;
window.calculateLotteryProbability = calculateLotteryProbability;

// ===== 유틸리티 함수들 =====
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showError = showError;
window.loadPageInIframe = loadPageInIframe;
window.updatePageTitle = updatePageTitle;
window.showCoinEarnedAnimation = showCoinEarnedAnimation;
window.setupCoinEarnedListener = setupCoinEarnedListener;

// ===== 사용자 데이터 관련 함수들 =====
window.loadUserData = loadUserData;
window.updateUserPoints = updateUserPoints;
window.addExperience = addExperience;
window.checkAndGiveBadge = checkAndGiveBadge;
window.checkAndGiveAchievement = checkAndGiveAchievement;
window.getLoginHistory = getLoginHistory;
window.getSolvedProblemsCount = getSolvedProblemsCount;

// ===== 관리자 데이터베이스 관리 함수들 =====

// 데이터베이스 상태 확인
async function checkDatabaseStatus() {
  try {
    const db = await getFirebaseDb();
    const collections = [
      'users',
      'coin_transactions', 
      'trading_orders',
      'trading_trades',
      'lottery_tickets',
      'user_notes',
      'gift_history'
    ];
    
    const status = {};
    
    for (const collectionName of collections) {
      try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        status[collectionName] = {
          exists: true,
          documentCount: snapshot.size
        };
      } catch (error) {
        status[collectionName] = {
          exists: false,
          documentCount: 0
        };
      }
    }
    
    return status;
  } catch (error) {
    console.error('데이터베이스 상태 확인 실패:', error);
    throw new Error('데이터베이스 상태 확인 중 오류가 발생했습니다.');
  }
}

// 코인 컬렉션 생성
async function createCoinCollections() {
  try {
    const db = await getFirebaseDb();
    const collections = [
      'coin_transactions',
      'trading_orders', 
      'trading_trades',
      'lottery_tickets',
      'gift_history'
    ];
    
    for (const collectionName of collections) {
      try {
        const collectionRef = collection(db, collectionName);
        // 빈 문서를 추가하여 컬렉션 생성
        await addDoc(collectionRef, {
          created_at: serverTimestamp(),
          type: 'collection_init'
        });
        console.log(`${collectionName} 컬렉션 생성 완료`);
      } catch (error) {
        console.log(`${collectionName} 컬렉션은 이미 존재합니다.`);
      }
    }
    
    return { success: true, message: '코인 컬렉션들이 성공적으로 생성되었습니다.' };
  } catch (error) {
    console.error('코인 컬렉션 생성 실패:', error);
    throw new Error('코인 컬렉션 생성 중 오류가 발생했습니다.');
  }
}

// 기존 사용자 코인 초기화
async function initializeExistingUsersCoins() {
  try {
    const db = await getFirebaseDb();
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    let updatedCount = 0;
    
    for (const doc of snapshot.docs) {
      try {
        await updateDoc(doc.ref, {
          coins: SYSTEM_CONFIG.COIN.INITIAL_COINS,
          last_coin_reset: serverTimestamp()
        });
        updatedCount++;
      } catch (error) {
        console.error(`사용자 ${doc.id} 코인 초기화 실패:`, error);
      }
    }
    
    return updatedCount;
  } catch (error) {
    console.error('사용자 코인 초기화 실패:', error);
    throw new Error('사용자 코인 초기화 중 오류가 발생했습니다.');
  }
}

// 전체 코인 데이터베이스 초기화
async function initializeCoinDatabase() {
  try {
    // 1. 코인 컬렉션 생성
    await createCoinCollections();
    
    // 2. 기존 사용자 코인 초기화
    const updatedUsers = await initializeExistingUsersCoins();
    
    return {
      success: true,
      updatedUsers: updatedUsers,
      message: '전체 코인 데이터베이스 초기화가 완료되었습니다.'
    };
  } catch (error) {
    console.error('전체 데이터베이스 초기화 실패:', error);
    throw new Error('전체 데이터베이스 초기화 중 오류가 발생했습니다.');
  }
}

// 데이터베이스 백업 생성 (Firestore payload 기반)
async function createDatabaseBackup() {
  try {
    const db = await getFirebaseDb();
    const collections = [
      'users',
      'coin_transactions',
      'trading_orders',
      'trading_trades', 
      'lottery_tickets',
      'user_notes',
      'gift_history'
    ];
    
    const backupId = new Date().toISOString().replace(/[:.]/g, '-');
    const summary = {};
    const payload = {};
    
    for (const collectionName of collections) {
      const colRef = collection(db, collectionName);
      const snapshot = await getDocs(colRef);
      const documents = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
      payload[collectionName] = documents;
      summary[collectionName] = documents.length;
    }

    // Firestore에 저장 (문서 크기 제한 유의)
    const metaRef = await addDoc(collection(db, 'database_backups'), {
      backupId,
      created_at: serverTimestamp(),
      summary,
      payload
    });

    return { backupId, summary, backupDocId: metaRef.id };
  } catch (error) {
    console.error('백업 생성 실패:', error);
    throw new Error('백업 생성 중 오류가 발생했습니다.');
  }
}

// 데이터베이스 백업 복원 (Firestore payload 기반)
async function restoreDatabaseBackup(backupId) {
  try {
    const db = await getFirebaseDb();
    const backupsCol = collection(db, 'database_backups');
    const q = query(backupsCol, where('backupId', '==', backupId));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('해당 백업을 찾을 수 없습니다.');
    const { payload = {} } = snap.docs[0].data();
    const restoredCollections = [];
    let totalDocuments = 0;
    for (const [collectionName, documents] of Object.entries(payload)) {
      const colRef = collection(db, collectionName);
      const existingSnapshot = await getDocs(colRef);
      await Promise.all(existingSnapshot.docs.map(d => deleteDoc(d.ref)));
      await Promise.all(documents.map(dObj => {
        const targetRef = doc(db, collectionName, dObj.id);
        return setDoc(targetRef, dObj.data);
      }));
      restoredCollections.push(collectionName);
      totalDocuments += documents.length;
    }
    return { restoredCollections, totalDocuments, backupId };
  } catch (error) {
    console.error('백업 복원 실패:', error);
    throw new Error('백업 복원 중 오류가 발생했습니다.');
  }
}

// 데이터베이스 정리
async function cleanupDatabase() {
  try {
    const db = await getFirebaseDb();
    const collections = [
      'coin_transactions',
      'trading_orders',
      'trading_trades',
      'lottery_tickets',
      'gift_history',
      'user_notes'
    ];
    
    let totalDeleted = 0;
    
    for (const collectionName of collections) {
      try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        totalDeleted += snapshot.size;
        console.log(`${collectionName}: ${snapshot.size}개 문서 삭제`);
      } catch (error) {
        console.error(`${collectionName} 정리 실패:`, error);
      }
    }
    
    return {
      success: true,
      totalDeleted: totalDeleted,
      message: `총 ${totalDeleted}개 문서가 정리되었습니다.`
    };
  } catch (error) {
    console.error('데이터베이스 정리 실패:', error);
    throw new Error('데이터베이스 정리 중 오류가 발생했습니다.');
  }
}

// ===== 관리자 함수들을 window 객체에 추가 =====
window.checkDatabaseStatus = checkDatabaseStatus;
window.createCoinCollections = createCoinCollections;
window.initializeExistingUsersCoins = initializeExistingUsersCoins;
window.initializeCoinDatabase = initializeCoinDatabase;
window.createDatabaseBackup = createDatabaseBackup;
window.restoreDatabaseBackup = restoreDatabaseBackup;
window.cleanupDatabase = cleanupDatabase;

// ===== 초기화 실행 =====
document.addEventListener('DOMContentLoaded', function() {
  console.log('script.js 로드 완료');
  
  // 페이지별 초기화
  const currentPage = window.location.pathname.split('/').pop();
  
  if (currentPage === 'gsg.html' || currentPage === '') {
    // gsg.html 페이지 초기화
    initializeMathApp();
  } else if (currentPage === 'dashboard.html') {
    // dashboard.html 페이지 초기화
    console.log('대시보드 페이지 초기화');
  }
});