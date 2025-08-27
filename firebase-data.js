// Firebase read/write helpers for learning logs
(async function () {
  'use strict';

  // 서버 시각 오프셋 캐시(세션 단위)
  let __serverOffsetMs = null; // serverNow - clientNow
  let __serverOffsetFetchedAtMs = 0;
  const __SERVER_OFFSET_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

  async function ensureFirebase() {
    if (!(location.protocol === 'http:' || location.protocol === 'https:')) {
      throw new Error('Firebase requires http/https context');
    }
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const { collection, addDoc, writeBatch, doc, serverTimestamp, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const { app, db } = await window.getFirebaseAppAndDb();
    const auth = getAuth(app);
    return { auth, db, collection, addDoc, writeBatch, doc, serverTimestamp, getDocs, query, orderBy };
  }

  async function withUser() {
    const { auth, db, ...rest } = await ensureFirebase();
    let user = auth.currentUser;
    if (!user) {
      try {
        const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        user = await new Promise((resolve) => {
          const timeoutId = setTimeout(() => { try { unsub(); } catch {} resolve(null); }, 7000);
          const unsub = onAuthStateChanged(auth, (u) => { clearTimeout(timeoutId); try { unsub(); } catch {} resolve(u); });
        });
      } catch (_) { user = null; }
    }
    if (!user) throw new Error('Not authenticated');
    return { user, db, ...rest };
  }

  async function addLearningLog(log) {
    try {
      const { user, db, collection, addDoc, serverTimestamp } = await withUser();
      await addDoc(collection(db, 'users', user.uid, 'learningLogs'), { ...log, ts: serverTimestamp() });
      return true;
    } catch (_) { return false; }
  }

  async function addManyLearningLogs(logs) {
    try {
      const { user, db, writeBatch, doc, serverTimestamp } = await withUser();
      const batch = writeBatch(db);
      logs.forEach((l) => {
        const ref = doc(db, 'users', user.uid, 'learningLogs', crypto.randomUUID());
        batch.set(ref, { ...l, ts: serverTimestamp() });
      });
      await batch.commit();
      return true;
    } catch (_) { return false; }
  }

  async function addAnsweredLog(entry) {
    try {
      const { user, db, collection, addDoc, serverTimestamp } = await withUser();
      await addDoc(collection(db, 'users', user.uid, 'answeredLogs'), { ...entry, ts: serverTimestamp() });
      return true;
    } catch (_) { return false; }
  }

  async function addManyAnsweredLogs(entries) {
    try {
      const { user, db, writeBatch, doc, serverTimestamp } = await withUser();
      const batch = writeBatch(db);
      entries.forEach((e) => {
        const ref = doc(db, 'users', user.uid, 'answeredLogs', crypto.randomUUID());
        batch.set(ref, { ...e, ts: serverTimestamp() });
      });
      await batch.commit();
      return true;
    } catch (_) { return false; }
  }

  async function fetchLearningLogs() {
    try {
      const { user, db, collection, getDocs, query, orderBy } = await withUser();
      const snap = await getDocs(query(collection(db, 'users', user.uid, 'learningLogs'), orderBy('ts')));
      return snap.docs.map(d => d.data());
    } catch (_) { return []; }
  }

  async function fetchAnsweredLogs() {
    try {
      const { user, db, collection, getDocs, query, orderBy } = await withUser();
      const snap = await getDocs(query(collection(db, 'users', user.uid, 'answeredLogs'), orderBy('ts')));
      return snap.docs.map(d => d.data());
    } catch (_) { return []; }
  }

  // ===== Daily stats (exp/points) and submission cooldown =====
  async function getDailyStats(dateKey) {
    try {
      const { user, db } = await withUser();
      const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(db, 'users', user.uid, 'dailyStats', dateKey);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : { exp: 0, points: 0, studyExp: 0, studyPoints: 0 };
      return { 
        exp: data.exp || 0, 
        points: data.points || 0,
        studyExp: data.studyExp || 0,
        studyPoints: data.studyPoints || 0
      };
    } catch (_) { return { exp: 0, points: 0, studyExp: 0, studyPoints: 0 }; }
  }

  async function incrementDailyStats(dateKey, addExp, addPoints, caps = { exp: 2000, points: 1000 }) {
    try {
      const { user, db } = await withUser();
      const { runTransaction, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(db, 'users', user.uid, 'dailyStats', dateKey);
      const result = await runTransaction(db, async (trx) => {
        const snap = await trx.get(ref);
        const cur = snap.exists() ? snap.data() : { exp: 0, points: 0 };
        const expAvail = Math.max((caps.exp ?? 2000) - (cur.exp || 0), 0);
        const ptsAvail = Math.max((caps.points ?? 1000) - (cur.points || 0), 0);
        const expApplied = Math.min(addExp || 0, expAvail);
        const ptsApplied = Math.min(addPoints || 0, ptsAvail);
        trx.set(ref, { exp: (cur.exp || 0) + expApplied, points: (cur.points || 0) + ptsApplied }, { merge: true });
        return { expApplied, ptsApplied, expReached: expAvail === 0, ptsReached: ptsAvail === 0 };
      });
      return result;
    } catch (_) { return { expApplied: 0, ptsApplied: 0, expReached: false, ptsReached: false }; }
  }

  // 개별 학습을 통한 포인트만 일일 한계에 적용하는 함수
  async function incrementDailyStudyStats(dateKey, addExp, addPoints, caps = { exp: 2000, points: 1000 }) {
    try {
      const { user, db } = await withUser();
      const { runTransaction, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(db, 'users', user.uid, 'dailyStats', dateKey);
      const result = await runTransaction(db, async (trx) => {
        const snap = await trx.get(ref);
        const cur = snap.exists() ? snap.data() : { exp: 0, points: 0, studyExp: 0, studyPoints: 0 };
        // 개별 학습 통계는 별도로 관리
        const studyExpAvail = Math.max((caps.exp ?? 2000) - (cur.studyExp || 0), 0);
        const studyPtsAvail = Math.max((caps.points ?? 1000) - (cur.studyPoints || 0), 0);
        const expApplied = Math.min(addExp || 0, studyExpAvail);
        const ptsApplied = Math.min(addPoints || 0, studyPtsAvail);
        trx.set(ref, { 
          exp: (cur.exp || 0) + expApplied, 
          points: (cur.points || 0) + ptsApplied,
          studyExp: (cur.studyExp || 0) + expApplied,
          studyPoints: (cur.studyPoints || 0) + ptsApplied
        }, { merge: true });
        return { expApplied, ptsApplied, expReached: studyExpAvail === 0, ptsReached: studyPtsAvail === 0 };
      });
      return result;
    } catch (_) { return { expApplied: 0, ptsApplied: 0, expReached: false, ptsReached: false }; }
  }

  // 제한 없이 포인트를 추가하는 함수
  async function addPointsUnlimited(dateKey, addExp, addPoints) {
    try {
      const { user, db } = await withUser();
      const { runTransaction, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(db, 'users', user.uid, 'dailyStats', dateKey);
      const result = await runTransaction(db, async (trx) => {
        const snap = await trx.get(ref);
        const cur = snap.exists() ? snap.data() : { exp: 0, points: 0 };
        const expApplied = addExp || 0;
        const ptsApplied = addPoints || 0;
        trx.set(ref, { 
          exp: (cur.exp || 0) + expApplied, 
          points: (cur.points || 0) + ptsApplied
        }, { merge: true });
        return { expApplied, ptsApplied, expReached: false, ptsReached: false };
      });
      return result;
    } catch (_) { return { expApplied: 0, ptsApplied: 0, expReached: false, ptsReached: false }; }
  }

  async function getSubmissionAt(qid) {
    try {
      const { user, db } = await withUser();
      const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(db, 'users', user.uid, 'submissions', qid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const d = snap.data().lastAt;
      return d?.toDate ? d.toDate() : (d ? new Date(d) : null);
    } catch (_) { return null; }
  }

  async function setSubmissionNow(qid) {
    try {
      const { user, db } = await withUser();
      const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(db, 'users', user.uid, 'submissions', qid);
      await setDoc(ref, { lastAt: serverTimestamp() }, { merge: true });
      return true;
    } catch (_) { return false; }
  }

  // Mock-exam daily reward once per day
  async function maybeGrantExamReward(exp, points, dateKey) {
    try {
      const { user, db } = await withUser();
      const { getDoc, setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(db, 'users', user.uid, 'examRewards', dateKey);
      const snap = await getDoc(ref);
      if (snap.exists()) return { granted: false };
      await setDoc(ref, { exp, points, at: Date.now() });
      // 모의고사 보상은 제한 없이 지급
      await window.firebaseData?.addPointsUnlimited?.(dateKey, exp, points);
      return { granted: true };
    } catch (_) { return { granted: false }; }
  }

  window.firebaseData = {
    async getCurrentUserUid() {
      try {
        const { auth } = await ensureFirebase();
        if (auth.currentUser) return auth.currentUser.uid;
        try {
          const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
          return await new Promise((resolve) => {
            const timeoutId = setTimeout(() => { try { unsub(); } catch {} resolve(null); }, 3000);
            const unsub = onAuthStateChanged(auth, (u) => { clearTimeout(timeoutId); try { unsub(); } catch {} resolve(u ? u.uid : null); });
          });
        } catch (_) { return null; }
      } catch (_) { return null; }
    },
    async isAuthenticated() {
      return !!(await this.getCurrentUserUid());
    },
    // 로컬 클럭 기반(Asia/Seoul) 날짜키. 거래/비핵심 로직은 이 키 사용 권장
    getLocalDateSeoulKey() {
      try {
        const jsDate = new Date();
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
        return fmt.format(jsDate); // YYYY-MM-DD
      } catch { return null; }
    },
    addLearningLog,
    addManyLearningLogs,
    addAnsweredLog,
    addManyAnsweredLogs,
    fetchLearningLogs,
    fetchAnsweredLogs,
    getDailyStats,
    incrementDailyStats,
    incrementDailyStudyStats,
    addPointsUnlimited,
    getSubmissionAt,
    setSubmissionNow,
    maybeGrantExamReward,
    // 최종 제출 답안 저장(문항별 1문서)
    async setFinalAnswer(qid, payload) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { subject, cat, sub, topic, correct, date } = payload || {};
        const ref = doc(db, 'users', user.uid, 'answers', qid);
        await setDoc(ref, { subject: subject||null, cat: cat||null, sub: sub||null, topic: topic||null, correct: !!correct, date: date||null, ts: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    // ===== Wallet (coins)
    async getWallet() {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'wallet', 'main');
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : { coins: 0, totalCoins: 0 };
      } catch (_) { return { coins: 0, totalCoins: 0 }; }
    },
    async addCoins(numCoins) {
      try {
        if (!Number.isFinite(numCoins) || numCoins === 0) return { applied: 0 };
        const { user, db } = await withUser();
        const { doc, setDoc, increment, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'wallet', 'main');
        await setDoc(ref, { coins: increment(numCoins), totalCoins: numCoins>0? increment(numCoins): increment(0), updatedAt: serverTimestamp() }, { merge: true });
        return { applied: numCoins };
      } catch (_) { return { applied: 0 }; }
    },
    async adjustCoins(delta, reason) {
      try {
        if (!Number.isFinite(delta) || delta === 0) return { ok: false };
        const { user, db } = await withUser();
        const { doc, runTransaction, serverTimestamp, collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'wallet', 'main');
        const res = await runTransaction(db, async (trx) => {
          const snap = await trx.get(ref);
          const cur = snap.exists() ? (snap.data().coins||0) : 0;
          if (delta < 0 && cur + delta < 0) throw new Error('insufficient-coins');
          trx.set(ref, { coins: (cur + delta), updatedAt: serverTimestamp() }, { merge: true });
          return true;
        });
        try { await addDoc(collection(db, 'users', user.uid, 'transactions'), { type: 'coin', amount: delta, reason: reason||null, at: serverTimestamp() }); } catch {}
        return { ok: true };
      } catch (e) { return { ok: false, error: String(e&&e.message||e) }; }
    },
    async awardAchievementCoinsOnce(id, data, coins) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, getDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'achievements', id);
        const snap = await getDoc(ref);
        const exists = snap.exists();
        const alreadyCoined = exists ? !!(snap.data()||{}).coinGranted : false;
        // 업적 문서가 없으면 생성
        if (!exists) {
          await setDoc(ref, { at: serverTimestamp(), ...(data||{}) }, { merge: true });
        }
        // 코인 보상 미지급 상태면 지급
        let granted = 0;
        if (!alreadyCoined && Number(coins||0) > 0) {
          const res = await this.addCoins(Number(coins||0), `achievement:${id}`);
          granted = res?.applied || 0;
          try { await setDoc(ref, { coinGranted: true, coinAmount: Number(coins||0), coinAt: serverTimestamp() }, { merge: true }); } catch {}
        }
        return { awarded: !exists, coinsGranted: granted };
      } catch (_) { return { awarded: false, coinsGranted: 0 }; }
    },
    async recordLevelProgress(currentLevel) {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc, setDoc, serverTimestamp, increment } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'progress', 'main');
        const snap = await getDoc(ref);
        const last = snap.exists() ? Number(snap.data().lastLevel||1) : 1;
        if (currentLevel > last) {
          const diff = currentLevel - last;
          await setDoc(ref, { lastLevel: currentLevel, updatedAt: serverTimestamp() }, { merge: true });
          await this.addCoins(diff); // 1레벨업당 1코인 지급
          return { leveledUpBy: diff };
        }
        return { leveledUpBy: 0 };
      } catch (_) { return { leveledUpBy: 0 }; }
    },
    // ===== Challenges helpers
    _weekKeyFromDateKey(dateKey) {
      // dateKey: YYYY-MM-DD (Asia/Seoul)
      try {
        const [y,m,d] = dateKey.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m-1, d));
        // ISO week number
        const tmp = new Date(dt.getTime());
        tmp.setUTCHours(0,0,0,0);
        tmp.setUTCDate(tmp.getUTCDate() + 3 - ((tmp.getUTCDay() + 6) % 7));
        const week1 = new Date(Date.UTC(tmp.getUTCFullYear(),0,4));
        const weekNo = 1 + Math.round(((tmp - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6)%7)) / 7);
        return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`;
      } catch { return 'unknown'; }
    },
    _monthKeyFromDateKey(dateKey) {
      try { const [y,m] = dateKey.split('-'); return `${y}-${m}`; } catch { return 'unknown'; }
    },
    async updateChallengesOnAnswer(isCorrect) {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc, setDoc, serverTimestamp, increment } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const dateKey = await this.getServerDateSeoulKey();
        const weekKey = this._weekKeyFromDateKey(dateKey||'');
        const monthKey = this._monthKeyFromDateKey(dateKey||'');
        // helpers
        async function bumpBy(ref, dTot, dCor) {
          const snap = await getDoc(ref);
          const cur = snap.exists() ? snap.data() : { total: 0, correct: 0, rewardGiven: false };
          const total = (cur.total||0) + (dTot||0);
          const correct = (cur.correct||0) + (dCor||0);
          const data = { total, correct, updatedAt: serverTimestamp() };
          await setDoc(ref, data, { merge: true });
          return { prevTotal: (cur.total||0), total, correct, rewardGiven: !!cur.rewardGiven };
        }
        // daily (일일은 무조건 +1)
        const dRef = doc(db, 'users', user.uid, 'challenges', `daily-${dateKey}`);
        const dayBeforeSnap = await getDoc(dRef);
        const prevDayTotal = dayBeforeSnap.exists() ? (dayBeforeSnap.data().total||0) : 0;
        const day = await bumpBy(dRef, 1, isCorrect ? 1 : 0);
        // 주간/월간은 하루 최대 10문제까지만 누적 반영
        const deltaToday = prevDayTotal < 10 ? 1 : 0;
        if (!day.rewardGiven && day.total >= 10) { // 일일 목표: 10문제
          await setDoc(dRef, { rewardGiven: true }, { merge: true });
          await this.addPointsUnlimited(dateKey, 0, 200); // 200pt - 제한 없이 지급
        }
        // weekly
        const wRef = doc(db, 'users', user.uid, 'challenges', `weekly-${weekKey}`);
        const week = await bumpBy(wRef, deltaToday, isCorrect ? deltaToday : 0);
        if (!week.rewardGiven && week.total >= 70) { // 주간 목표 예시: 70문제
          await setDoc(wRef, { rewardGiven: true }, { merge: true });
          await this.addCoins(1);
        }
        // monthly
        const mRef = doc(db, 'users', user.uid, 'challenges', `monthly-${monthKey}`);
        const mon = await bumpBy(mRef, deltaToday, isCorrect ? deltaToday : 0);
        if (!mon.rewardGiven && mon.total >= 200) {
          await setDoc(mRef, { rewardGiven: true }, { merge: true });
          await this.addCoins(10);
        }
        return true;
      } catch (_) { return false; }
    },
    async updateChallengesOnLogin() {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const dateKey = await this.getServerDateSeoulKey();
        const weekKey = this._weekKeyFromDateKey(dateKey||'');
        const monthKey = this._monthKeyFromDateKey(dateKey||'');
        async function mark(ref) {
          const snap = await getDoc(ref);
          const cur = snap.exists() ? snap.data() : { days: 0, daysSet: {} };
          const daysSet = cur.daysSet || {};
          if (!daysSet[dateKey]) { daysSet[dateKey] = true; }
          const days = Object.keys(daysSet).length;
          await setDoc(ref, { daysSet, days, updatedAt: serverTimestamp() }, { merge: true });
          return { days, rewardGiven: !!cur.rewardGiven };
        }
        const wRef = doc(db, 'users', user.uid, 'challenges', `weekly-${weekKey}-login`);
        const week = await mark(wRef);
        if (!week.rewardGiven && week.days >= 7) { await setDoc(wRef, { rewardGiven: true }, { merge: true }); await this.addCoins(1); }
        const mRef = doc(db, 'users', user.uid, 'challenges', `monthly-${monthKey}-login`);
        const mon = await mark(mRef);
        if (!mon.rewardGiven && mon.days >= 25) { await setDoc(mRef, { rewardGiven: true }, { merge: true }); await this.addCoins(10); }
        return true;
      } catch (_) { return false; }
    },
    async listFinalAnswers() {
      try {
        const { user, db, collection, getDocs } = await withUser();
        const snap = await getDocs(collection(db, 'users', user.uid, 'answers'));
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async addAnswerEvent(isCorrect) {
      try {
        const { user, db, collection, addDoc, serverTimestamp } = await ensureFirebase().then(async ({ auth, db }) => {
          const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
          return { user: auth.currentUser, db, collection, addDoc, serverTimestamp };
        });
        if (!user) throw new Error('Not authenticated');
        const evRef = await addDoc(collection(db, 'users', user.uid, 'events'), { type: 'answer', correct: !!isCorrect, at: serverTimestamp() });
        // 스터디 그룹 주간 챌린지 누적 업데이트(그룹원인 모든 그룹에 +1)
        try {
          const { collection: col2, getDocs, query, where, doc, setDoc, getDoc, serverTimestamp: st } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
          const gs = await getDocs(query(col2(db,'studyGroups'), where('members','array-contains', user.uid)));
          const dateKey = await window.firebaseData?.getServerDateSeoulKey?.();
          for (const g of gs.docs) {
            try {
              const cRef = doc(db,'studyGroups', g.id, 'meta', 'weekly');
              const cs = await getDoc(cRef);
              if (!cs.exists()) { await setDoc(cRef, { progress: 1, target: (g.data()?.members?.length||0)*50, startKey: dateKey, updatedAt: st() }, { merge: true }); }
              else {
                const cur = Number((cs.data()||{}).progress||0) + 1;
                await setDoc(cRef, { progress: cur, updatedAt: st() }, { merge: true });
              }
            } catch {}
          }
        } catch {}
        return true;
      } catch (_) { return false; }
    },
    async listAchievements() {
      try {
        const { user, db, collection, getDocs } = await withUser();
        const snap = await getDocs(collection(db, 'users', user.uid, 'achievements'));
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async hasAchievement(id) {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'achievements', id);
        const snap = await getDoc(ref);
        return snap.exists();
      } catch (_) { return false; }
    },
    async getServerDateSeoulKey() {
      try {
        const nowMs = Date.now();
        if (__serverOffsetMs !== null && (nowMs - __serverOffsetFetchedAtMs) < __SERVER_OFFSET_TTL_MS) {
          const jsDate = new Date(nowMs + __serverOffsetMs);
          const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
          return fmt.format(jsDate);
        }
        const { user, db } = await withUser();
        const { doc, setDoc, getDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'time', 'now');
        await setDoc(ref, { at: serverTimestamp() }, { merge: true });
        const snap = await getDoc(ref);
        const at = snap.data()?.at;
        const serverJs = at?.toDate ? at.toDate() : new Date();
        __serverOffsetMs = serverJs.getTime() - nowMs;
        __serverOffsetFetchedAtMs = nowMs;
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
        return fmt.format(serverJs);
      } catch (_) {
        try {
          const jsDate = new Date();
          const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
          return fmt.format(jsDate);
        } catch { return null; }
      }
    },
    async getDateKeyPreferServer() {
      const k = await this.getServerDateSeoulKey();
      if (k) return k;
      return this.getLocalDateSeoulKey();
    },
    async awardAchievement(id, data) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'achievements', id);
        await setDoc(ref, { at: serverTimestamp(), ...(data||{}) }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    async markLogin(dateKey) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'logins', dateKey);
        await setDoc(ref, { at: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    async listLoginDates() {
      try {
        const { user, db, collection, getDocs } = await withUser();
        const snap = await getDocs(collection(db, 'users', user.uid, 'logins'));
        return snap.docs.map(d => d.id);
      } catch (_) { return []; }
    },
    // ===== User Profile =====
    async getMyProfile() {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'profile', 'main');
        const snap = await getDoc(ref);
        return snap.exists() ? snap.data() : null;
      } catch (_) { return null; }
    },
    async saveMyProfile(profile) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'profile', 'main');
        await setDoc(ref, { ...profile, updatedAt: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    async listGlobalWrongRatesTop(limitN = 20) {
      try {
        const { db, collection, getDocs, query, orderBy } = await ensureFirebase();
        const { limit } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'globalWrongRates');
        const q = query(ref, orderBy('wrongRate', 'desc'), orderBy('total', 'desc'), limit(limitN));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    // ===== Wallet transactions (points/coins)
    async listTransactions(limitN = 30) {
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'transactions');
        const q = query(ref, orderBy('at', 'desc'), limit(limitN));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async addPointTransaction(amount, reason) {
      try {
        const { user, db } = await withUser();
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const transactionData = { type: 'point', amount: Number(amount)||0, reason: reason||null, at: serverTimestamp() };
        await addDoc(collection(db, 'users', user.uid, 'transactions'), transactionData);
        return true;
      } catch (error) { 
        console.error('addPointTransaction 오류:', error);
        return false; 
      }
    },
    async listAllTransactions() {
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'transactions');
        const q = query(ref, orderBy('at', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (error) { 
        console.error('listAllTransactions 오류:', error);
        return []; 
      }
    },
    // ===== Items (wallet-managed)
    async listMyItems() {
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'items');
        const snap = await getDocs(query(ref, orderBy('purchasedAt', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async useItem(itemId) {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'items', itemId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return { ok: false, reason: 'not-found' };
        const d = snap.data() || {};
        if (d.used) return { ok: false, reason: 'already-used' };
        await setDoc(ref, { used: true, usedAt: serverTimestamp() }, { merge: true });
        return { ok: true, item: { id: itemId, ...d } };
      } catch (_) { return { ok: false, reason: 'error' }; }
    },
    async refundItem(itemId) {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'items', itemId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return { ok: false, reason: 'not-found' };
        const d = snap.data() || {};
        if (d.used) return { ok: false, reason: 'already-used' };
        const feeRate = 0.1;
        const refundPoints = Math.floor((Number(d.costPoints||0)) * (1 - feeRate));
        const refundCoins = Math.floor((Number(d.costCoins||0)) * (1 - feeRate));
        const dateKey = await this.getServerDateSeoulKey();
        if (refundPoints > 0) {
          // 환불 포인트는 일일 한도와 무관하게 전액 반환
                  await this.addPointsUnlimited(dateKey, 0, refundPoints);
        await this.addPointTransaction(refundPoints, `refund:item:${itemId}`);
        }
        if (refundCoins > 0) {
          await this.addCoins(refundCoins);
        }
        await deleteDoc(ref);
        return { ok: true, refundPoints, refundCoins };
      } catch (_) { return { ok: false, reason: 'error' }; }
    },
    // 누적 통계 합계 (일일 통계 합산)
    async sumDailyStats() {
      try {
        const { user, db, collection, getDocs } = await withUser();
        const ref = collection(db, 'users', user.uid, 'dailyStats');
        const snap = await getDocs(ref);
        let totalExp = 0, totalPoints = 0, days = 0, lastAt = 0;
        snap.forEach(doc => {
          const d = doc.data() || {};
          totalExp += Number(d.exp || 0);
          totalPoints += Number(d.points || 0);
          days += 1;
          const t = d.ts || d.updatedAt || null;
          const ms = t?.toDate ? t.toDate().getTime() : (t ? Number(t) : 0);
          if (!Number.isNaN(ms)) lastAt = Math.max(lastAt, ms);
        });
        return { totalExp, totalPoints, days, lastUpdated: lastAt || null };
      } catch (_) { return { totalExp: 0, totalPoints: 0, days: 0, lastUpdated: null }; }
    },
    // 리더보드 상단 조회 (권한 없으면 빈 배열)
    async listLeaderboardTop(limitN = 50) {
      try {
        const { db, collection, getDocs, query, orderBy } = await ensureFirebase();
        const { limit } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'leaderboard');
        const q = query(ref, orderBy('totalExp', 'desc'), orderBy('updatedAt', 'desc'), limit(limitN));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async listLeaderboardAll() {
      try {
        const { db, collection, getDocs, query, orderBy } = await ensureFirebase();
        const ref = collection(db, 'leaderboard');
        const q = query(ref, orderBy('totalExp', 'desc'), orderBy('updatedAt', 'desc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async getMyLeaderboard() {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'leaderboard', user.uid);
        const snap = await getDoc(ref);
        return snap.exists() ? { id: ref.id, ...(snap.data()||{}) } : null;
      } catch (_) { return null; }
    },
    // ===== Shop (points marketplace)
    async listPurchases() {
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'purchases');
        const snap = await getDocs(query(ref, orderBy('purchasedAt', 'desc')));
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async addPurchase(p) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const pid = crypto.randomUUID();
        const pref = doc(db, 'users', user.uid, 'purchases', pid);
        await setDoc(pref, { ...p, purchasedAt: serverTimestamp() }, { merge: true });
        // 보유 아이템으로도 적재(사용/환불 관리용)
        try {
          const iref = doc(db, 'users', user.uid, 'items', pid);
          await setDoc(iref, { sku: p.id || null, name: p.name, category: p.category, icon: p.icon, costPoints: p.price||0, costCoins: 0, used: false, purchasedAt: serverTimestamp() }, { merge: true });
        } catch {}
        // 포인트 거래내역 기록(차감은 가용 포인트 계산식에서 처리)
        try { 
          await this.addPointTransaction(-(Number(p.price||0)), `shop:${p.id||p.name}`); 
        } catch (error) {
          console.error('addPointTransaction 실패:', error);
        }
        return { ok: true, id: pid };
      } catch (_) { return { ok: false }; }
    },
    // ===== Effects (booster)
    async activateBooster(hours = 48) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ms = Date.now() + Number(hours||48) * 3600 * 1000;
        const ref = doc(db, 'users', user.uid, 'effects', 'booster2x');
        await setDoc(ref, { startedAt: serverTimestamp(), expiresAtMs: ms }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    async isBoosterActive() {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'effects', 'booster2x');
        const snap = await getDoc(ref);
        if (!snap.exists()) return false;
        const d = snap.data() || {};
        return Number(d.expiresAtMs || 0) > Date.now();
      } catch (_) { return false; }
    },
    async getBoosterInfo() {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'users', user.uid, 'effects', 'booster2x');
        const snap = await getDoc(ref);
        if (!snap.exists()) return { active: false };
        const d = snap.data() || {};
        return { active: Number(d.expiresAtMs||0) > Date.now(), expiresAtMs: Number(d.expiresAtMs||0) };
      } catch (_) { return { active: false }; }
    },
    // ===== Trading
    async tradingGetBalances() {
      try {
        const sum = await this.sumDailyStats();
        const w = await this.getWallet();
        // 현재 사용 가능한 코인(coins) 기준으로 반환
        return { points: Number(sum.totalPoints||0), coins: Number(w.coins||0) };
      } catch (_) { return { points: 0, coins: 0 }; }
    },
    async tradingAdjustPoints(delta, reason) {
      try {
        await this.addPointTransaction(Number(delta), reason||'trade');
        
        // 거래를 통한 포인트 획득은 제한 없이 일일 통계에 추가
        if (delta > 0) {
          const dateKey = await this.getServerDateSeoulKey();
          await this.addPointsUnlimited(dateKey, 0, delta);
        }
        
        return { expApplied: 0, ptsApplied: 0, expReached: false, ptsReached: false };
      } catch (_) { return null; }
    },
    async tradingRecordTrade(side, price, qty) {
      try {
        const { user, db } = await withUser();
        const { collection, addDoc, serverTimestamp, doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const t = { uid: user.uid, side, price: Number(price), qty: Number(qty), at: serverTimestamp() };
        await addDoc(collection(db, 'market', 'public', 'trades'), t);
        await addDoc(collection(db, 'users', user.uid, 'trades'), t);
        // ticker update
        const tickRef = doc(db, 'market', 'public', 'ticker', 'main');
        const snap = await getDoc(tickRef);
        const prev = snap.exists() ? (snap.data().lastPrice||price) : price;
        const last = Number(price);
        const change = prev ? ((last - prev) / prev) * 100 : 0;
        await setDoc(tickRef, { lastPrice: last, prevPrice: prev, changePct: change, updatedAt: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    async tradingPlaceOrder(side, price, qty) {
      try {
        const P = Number(price); const Q = Number(qty);
        if (!(P>0 && Q>0) || !Number.isFinite(P) || !Number.isFinite(Q)) return { ok: false, error: 'invalid' };
        if (!(side === 'buy' || side === 'sell')) return { ok: false, error: 'invalid' };
        if (P > 1500) return { ok: false, error: 'price-cap' };
        const bal = await this.tradingGetBalances();
        const { user, db } = await withUser();
        const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        // 예약(보증금) 처리: 체결 전까지 자산 락
        if (side === 'buy') {
          if (bal.points < P*Q) return { ok: false, error: 'insufficient-points' };
          await this.tradingAdjustPoints(-(P*Q), 'reserve:buy');
        } else {
          if (bal.coins < Q) return { ok: false, error: 'insufficient-coins' };
          await this.adjustCoins(-Q, 'reserve:sell');
        }
        const payload = { uid: String(user.uid||''), side: String(side), price: Number(P), qty: Number(Q), qtyRemaining: Number(Q), status: 'open', createdAt: serverTimestamp() };
        // 디버그 로깅 + undefined 방지
        try { console.log('order payload', payload); } catch {}
        if (Object.values(payload).some(v => v === undefined)) return { ok: false, error: 'invalid' };
        await addDoc(collection(db, 'market', 'public', 'orders'), payload);
        return { ok: true, queued: true };
      } catch (e) { return { ok: false, error: String(e&&e.message||e) }; }
    },
    async tradingListOrderbook(limitN = 10) {
      try {
        const { db, collection, getDocs } = await ensureFirebase().then(async ({ app, db }) => {
          const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
          return { db, collection, getDocs };
        });
        const ref = collection(db, 'market', 'public', 'orders');
        const snap = await getDocs(ref);
        const open = snap.docs.map(d=>d.data()).filter(o=>o && o.status==='open');
        const bidsArr = open.filter(o=>o.side==='buy');
        const asksArr = open.filter(o=>o.side==='sell');
        function agg(arr){
          const m = new Map();
          arr.forEach(o=>{ const k=Number(o.price); m.set(k,(m.get(k)||0)+Number(o.qtyRemaining||o.qty||0)); });
          return Array.from(m.entries()).sort((a,b)=>a[0]-b[0]);
        }
        const bids = agg(bidsArr).slice(-limitN).reverse();
        const asks = agg(asksArr).slice(0, limitN);
        return { bids, asks };
      } catch (_) { return { bids: [], asks: [] }; }
    },
    async subscribeOrderbook(onChange) {
      try {
        const { db } = await ensureFirebase();
        const { collection, onSnapshot, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'market', 'public', 'orders');
        const q = query(ref, where('status','==','open'));
        const unsub = onSnapshot(q, (snap)=>{
          const list = snap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
          if (typeof onChange === 'function') { try { onChange(list); } catch {} }
        }, (err)=>{ try { console.warn('orderbook snapshot error', err); } catch {} });
        return unsub;
      } catch (_) { return null; }
    },
    async tradingListMyOrders() {
      try {
        const { user, db } = await withUser();
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'market', 'public', 'orders');
        const snap = await getDocs(ref);
        const list = snap.docs
          .map(d=>({ id:d.id, ...(d.data()||{}) }))
          .filter(o=>o.uid===user.uid && o.status==='open')
          .sort((a,b)=> (Number(b.createdAt?.toMillis?.()||0) - Number(a.createdAt?.toMillis?.()||0)));
        return list;
      } catch (_) { return []; }
    },
    async tradingCancelOrder(orderId) {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc, runTransaction, serverTimestamp, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'market', 'public', 'orders', orderId);
        let orderSnapshot = null;
        let cancelled = false;
        await runTransaction(db, async (trx) => {
          const snap = await trx.get(ref);
          if (!snap.exists()) throw new Error('not-found');
          const o = snap.data();
          orderSnapshot = o;
          if (o.uid !== user.uid) throw new Error('forbidden');
          if (o.status !== 'open') throw new Error('not-open');
          trx.set(ref, { status: 'cancelled', cancelledAt: serverTimestamp() }, { merge: true });
          cancelled = true;
        });
        // 예약금 환불 (트랜잭션 성공 시에만)
        if (cancelled && orderSnapshot) {
          if (orderSnapshot.side === 'buy') {
            await this.tradingAdjustPoints(+(Number(orderSnapshot.price) * Number(orderSnapshot.qtyRemaining||orderSnapshot.qty||0)), 'cancel:buy');
          } else {
            await this.adjustCoins(+(Number(orderSnapshot.qtyRemaining||orderSnapshot.qty||0)), 'cancel:sell');
          }
        }
        return { ok: true };
      } catch (e) {
        // 상태가 이미 open이 아니면 사용자 입장에서는 취소된 것으로 처리
        try {
          const { user, db } = await withUser();
          const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
          const ref = doc(db, 'market', 'public', 'orders', orderId);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const o = snap.data();
            if (o.uid === user.uid && o.status !== 'open') return { ok:true };
          }
        } catch {}
        return { ok:false, error:String(e&&e.message||e) };
      }
    },
    // ===== Lottery =====
    // 과거 일일 회차 방식은 제거. 구매 시마다 즉시 추첨.
    async lotteryBuyTicket(pick6) {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc, setDoc, addDoc, collection, runTransaction, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        if (!Array.isArray(pick6) || pick6.length!==6) return { ok:false, error:'invalid-pick' };
        // balance check
        const w = await this.getWallet();
        if (Number(w.coins||0) < 1) return { ok:false, error:'insufficient-coins' };
        const key = await this.getServerDateSeoulKey();
        // deduct 1 coin
        await this.adjustCoins(-1, 'lottery:buy');
        // generate draw immediately
        const pool = Array.from({length:20},(_,i)=>i+1);
        for (let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
        const drawNums = pool.slice(0,6).sort((a,b)=>a-b);
        const drawBonus = pool[6];
        const ticketNums = pick6.slice().sort((a,b)=>a-b);
        // evaluate rank
        const hit = ticketNums.filter(n => drawNums.includes(n)).length;
        let rank = null;
        if (hit===6) rank = 1;
        else if (hit===5 && drawBonus && ticketNums.includes(drawBonus)) rank = 2;
        else if (hit===5) rank = 3;
        else if (hit===4) rank = 4;
        else if (hit===3) rank = 5;
        const ticket = { uid: user.uid, drawDate: key, nums: ticketNums, drawNums, drawBonus, hitCount: hit, rank, at: serverTimestamp() };
        // 사용자 티켓 기록은 필수
        await addDoc(collection(db, 'users', user.uid, 'lotteryTickets'), ticket);
        // 공개 티켓/통계는 권한 문제로 실패해도 구매는 성공 처리
        try { await addDoc(collection(db, 'lottery', 'tickets'), ticket); } catch {}
        try {
          const statsRef = doc(db, 'lottery', 'public', 'stats', 'main');
          await runTransaction(db, async (trx)=>{
            const s = await trx.get(statsRef);
            const cur = s.exists()? s.data() : { totalTickets:0, w1:0,w2:0,w3:0,w4:0,w5:0 };
            const next = { ...cur, totalTickets: (cur.totalTickets||0)+1 };
            if (rank) next[`w${rank}`] = (cur[`w${rank}`]||0) + 1;
            trx.set(statsRef, next, { merge: true });
          });
        } catch {}
        return { ok:true, rank, hit, drawNums, drawBonus, drawDate: key };
      } catch (e) { return { ok:false, error:String(e&&e.message||e) }; }
    },
    async lotteryGetLatestResult(){
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'lotteryTickets');
        const q = query(ref, orderBy('at','desc'), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return { ok:true };
        const d = snap.docs[0].data()||{};
        return { ok:true, drawDate: d.drawDate, nums: d.nums||[], drawNums: d.drawNums||[], drawBonus: d.drawBonus||null, hitCount: d.hitCount||0, rank: d.rank||null };
      } catch (e) { return { ok:false, error:String(e&&e.message||e) }; }
    },
    async lotteryListMyTickets(limitN=30){
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'lotteryTickets');
        const q = query(ref, orderBy('at','desc'), limit(limitN));
        const snap = await getDocs(q);
        return snap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async lotteryStats(){
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'lotteryTickets');
        const q = query(ref, orderBy('at', 'desc'));
        const snap = await getDocs(q);
        const tickets = snap.docs.map(d => d.data());
        
        // 개인 통계 계산
        const stats = { totalTickets: tickets.length, w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 };
        tickets.forEach(ticket => {
          const rank = Number(ticket.rank || 0);
          if (rank >= 1 && rank <= 5) {
            stats[`w${rank}`]++;
          }
        });
        
        return stats;
      } catch (_) { return { totalTickets:0,w1:0,w2:0,w3:0,w4:0,w5:0 }; }
    },
    async tradingGetTicker() {
      try {
        const { db } = await ensureFirebase();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'market', 'public', 'ticker', 'main');
        const snap = await getDoc(ref);
        return snap.exists()? snap.data(): { lastPrice: 1000, prevPrice: 1000, changePct: 0 };
      } catch (_) { return { lastPrice: 1000, prevPrice: 1000, changePct: 0 }; }
    },
    async tradingListRecentTrades(limitN = 50) {
      try {
        const { db, collection, getDocs } = await ensureFirebase().then(async ({ app, db }) => {
          const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
          return { db, collection, getDocs };
        });
        const ref = collection(db, 'market', 'public', 'trades');
        const snap = await getDocs(ref);
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }))
          .sort((a,b)=> Number(b.at?.toMillis?.()||0) - Number(a.at?.toMillis?.()||0))
          .slice(0, limitN);
      } catch (_) { return []; }
    },
    async tradingMatchOnce() {
      try {
        const { db } = await ensureFirebase();
        const { collection, getDocs, doc, runTransaction, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ordersRef = collection(db, 'market', 'public', 'orders');
        const snap = await getDocs(ordersRef);
        if (snap.empty) return { ok:false, reason:'no-orders' };
        
        // 모든 오픈 주문 가져오기
        const docs = snap.docs.filter(d => (d.data()||{}).status === 'open');
        const bids = docs.filter(d => d.data().side === 'buy');
        const asks = docs.filter(d => d.data().side === 'sell');
        if (bids.length === 0 || asks.length === 0) return { ok:false, reason:'no-orders' };
        
        // 매수/매도 주문을 가격순으로 정렬
        function tsMillis(d){ const c=d.data().createdAt; return Number(c?.toMillis?.()||0); }
        const sortedBids = bids.sort((a,b)=>{
          const pa = Number(b.data().price), pb = Number(a.data().price); // 매수: 높은 가격 우선
          if (pa !== pb) return pa - pb;
          return tsMillis(a) - tsMillis(b); // 같은 가격이면 시간순
        });
        const sortedAsks = asks.sort((a,b)=>{
          const pa = Number(a.data().price), pb = Number(b.data().price); // 매도: 낮은 가격 우선
          if (pa !== pb) return pa - pb;
          return tsMillis(a) - tsMillis(b); // 같은 가격이면 시간순
        });
        
        // 교차하는 모든 주문 찾기
        const matches = [];
        let bidIndex = 0, askIndex = 0;
        
        while (bidIndex < sortedBids.length && askIndex < sortedAsks.length) {
          const bid = sortedBids[bidIndex].data();
          const ask = sortedAsks[askIndex].data();
          const bidPrice = Number(bid.price);
          const askPrice = Number(ask.price);
          
          // 가격이 교차하지 않으면 종료
          if (bidPrice < askPrice) break;
          
          // 교차하는 주문 발견 - 매칭 생성
          const qty = Math.min(
            Number(bid.qtyRemaining || bid.qty || 0),
            Number(ask.qtyRemaining || ask.qty || 0)
          );
          
          if (qty > 0) {
            matches.push({
              bidDoc: sortedBids[bidIndex],
              askDoc: sortedAsks[askIndex],
              bid: bid,
              ask: ask,
              qty: qty,
              // 체결 가격: 기존 호가의 가격 (매도 호가가 있으면 매도가, 없으면 매수가)
              execPrice: askPrice
            });
          }
          
          // 수량이 적은 쪽의 인덱스 증가
          const bidQty = Number(bid.qtyRemaining || bid.qty || 0);
          const askQty = Number(ask.qtyRemaining || ask.qty || 0);
          
          if (bidQty <= askQty) {
            bidIndex++; // 매수 주문이 소진되거나 같으면 다음 매수로
          }
          if (askQty <= bidQty) {
            askIndex++; // 매도 주문이 소진되거나 같으면 다음 매도로
          }
        }
        
        if (matches.length === 0) return { ok:false, reason:'no-cross' };
        
        // 모든 매칭을 트랜잭션으로 처리
        await runTransaction(db, async (trx) => {
          for (const match of matches) {
            const bidRef = match.bidDoc.ref;
            const askRef = match.askDoc.ref;
            
            // 최신 상태 확인
            const bSnap = await trx.get(bidRef);
            const aSnap = await trx.get(askRef);
            
            if (!bSnap.exists() || !aSnap.exists()) continue;
            
            const b = bSnap.data();
            const a = aSnap.data();
            
            if (b.status !== 'open' || a.status !== 'open') continue;
            
            const bidQty = Number(b.qtyRemaining || b.qty || 0);
            const askQty = Number(a.qtyRemaining || a.qty || 0);
            
            if (bidQty <= 0 || askQty <= 0) continue;
            
            // 실제 거래 가능한 수량 계산
            const actualQty = Math.min(bidQty, askQty, match.qty);
            if (actualQty <= 0) continue;
            
            // 주문 상태 업데이트
            const newBidQty = bidQty - actualQty;
            const newAskQty = askQty - actualQty;
            
            trx.set(bidRef, { 
              qtyRemaining: newBidQty, 
              status: newBidQty <= 0 ? 'filled' : 'open' 
            }, { merge: true });
            
            trx.set(askRef, { 
              qtyRemaining: newAskQty, 
              status: newAskQty <= 0 ? 'filled' : 'open' 
            }, { merge: true });
            
            // 정산 문서 생성
            const setRef = doc(collection(db, 'market', 'public', 'settlements'));
            trx.set(setRef, { 
              buyerUid: b.uid, 
              sellerUid: a.uid, 
              price: match.execPrice, 
              qty: actualQty, 
              buyerClaimed: false, 
              sellerClaimed: false, 
              at: serverTimestamp() 
            });
            
            // 티커 업데이트
            const tickRef = doc(db, 'market', 'public', 'ticker', 'main');
            trx.set(tickRef, { 
              lastPrice: match.execPrice, 
              updatedAt: serverTimestamp() 
            }, { merge: true });
            
            // 거래 기록 생성
            const pubTradeRef = doc(collection(db, 'market', 'public', 'trades'));
            trx.set(pubTradeRef, { 
              side: 'trade', 
              price: match.execPrice, 
              qty: actualQty, 
              at: serverTimestamp() 
            });
            
            const buyerTradeRef = doc(collection(db, 'users', b.uid, 'trades'));
            trx.set(buyerTradeRef, { 
              side: 'buy', 
              price: match.execPrice, 
              qty: actualQty, 
              at: serverTimestamp() 
            });
            
            const sellerTradeRef = doc(collection(db, 'users', a.uid, 'trades'));
            trx.set(sellerTradeRef, { 
              side: 'sell', 
              price: match.execPrice, 
              qty: actualQty, 
              at: serverTimestamp() 
            });
          }
        });
        
        return { ok: true, matches: matches.length };
      } catch (e) { return { ok:false, error:String(e&&e.message||e) }; }
    },
    async tradingMatchWithOrders(openOrders) {
      try {
        if (!Array.isArray(openOrders) || openOrders.length===0) return { ok:false, reason:'no-orders' };
        const { db } = await ensureFirebase();
        const { doc, runTransaction, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const bids = openOrders.filter(o=>o && o.status==='open' && o.side==='buy');
        const asks = openOrders.filter(o=>o && o.status==='open' && o.side==='sell');
        if (bids.length===0 || asks.length===0) return { ok:false, reason:'no-orders' };
        function tsMillisLocal(o){ const c=o.createdAt; return Number(c?.toMillis?.()|| (typeof c==='string'? Date.parse(c): 0) ||0); }
        const bestBid = bids.sort((a,b)=>{ const pa=Number(b.price), pb=Number(a.price); if (pa!==pb) return pa-pb; return tsMillisLocal(a)-tsMillisLocal(b); })[0];
        const bestAsk = asks.sort((a,b)=>{ const pa=Number(a.price), pb=Number(b.price); if (pa!==pb) return pa-pb; return tsMillisLocal(a)-tsMillisLocal(b); })[0];
        if (Number(bestBid.price) < Number(bestAsk.price)) return { ok:false, reason:'no-cross' };
        const bidRef = doc(db, 'market', 'public', 'orders', String(bestBid.id));
        const askRef = doc(db, 'market', 'public', 'orders', String(bestAsk.id));
        await runTransaction(db, async (trx) => {
          const bSnap = await trx.get(bidRef); const aSnap = await trx.get(askRef);
          if (!bSnap.exists() || !aSnap.exists()) return;
          const b = bSnap.data(); const a = aSnap.data();
          if (b.status!=='open' || a.status!=='open') return;
          if (Number(b.price) < Number(a.price)) return; // no cross
          const qty = Math.min(Number(b.qtyRemaining||b.qty||0), Number(a.qtyRemaining||a.qty||0));
          if (!(qty>0)) return;
          const bCreated = Number(b.createdAt?.toMillis?.()||0);
          const aCreated = Number(a.createdAt?.toMillis?.()||0);
          const execPrice = (bCreated <= aCreated) ? Number(a.price) : Number(b.price);
          const nb = Number(b.qtyRemaining||b.qty||0) - qty; const na = Number(a.qtyRemaining||a.qty||0) - qty;
          trx.set(bidRef, { qtyRemaining: nb, status: nb<=0? 'filled':'open' }, { merge:true });
          trx.set(askRef, { qtyRemaining: na, status: na<=0? 'filled':'open' }, { merge:true });
          const setRef = doc(collection(db, 'market', 'public', 'settlements'));
          trx.set(setRef, { buyerUid: b.uid, sellerUid: a.uid, price: execPrice, qty, buyerClaimed:false, sellerClaimed:false, at: serverTimestamp() });
          const tickRef = doc(db, 'market', 'public', 'ticker', 'main');
          trx.set(tickRef, { lastPrice: execPrice, updatedAt: serverTimestamp() }, { merge: true });
          const pubTradeRef = doc(collection(db, 'market', 'public', 'trades'));
          trx.set(pubTradeRef, { side: 'trade', price: execPrice, qty, at: serverTimestamp() });
          const buyerTradeRef = doc(collection(db, 'users', b.uid, 'trades'));
          trx.set(buyerTradeRef, { side: 'buy', price: execPrice, qty, at: serverTimestamp() });
          const sellerTradeRef = doc(collection(db, 'users', a.uid, 'trades'));
          trx.set(sellerTradeRef, { side: 'sell', price: execPrice, qty, at: serverTimestamp() });
        });
        return { ok:true };
      } catch (e) { return { ok:false, error:String(e&&e.message||e) }; }
    },
    async subscribeTicker(onChange) {
      try {
        const { db } = await ensureFirebase();
        const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'market', 'public', 'ticker', 'main');
        const unsub = onSnapshot(ref, (snap)=>{
          if (!snap.exists()) return;
          const d = snap.data() || {};
          if (typeof onChange === 'function') { try { onChange(d); } catch {} }
        }, (err)=>{ try { console.warn('ticker snapshot error', err); } catch {} });
        return unsub;
      } catch (_) { return null; }
    },
    async tradingListMyTrades(limitN = 50) {
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'users', user.uid, 'trades');
        const q = query(ref, orderBy('at', 'desc'), limit(limitN));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async tradingListTradesSinceHours(hours = 24) {
      try {
        const { db } = await ensureFirebase();
        const { collection, getDocs, query, where, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const { Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const since = Timestamp.fromMillis(Date.now() - Number(hours||24)*3600*1000);
        const ref = collection(db, 'market', 'public', 'trades');
        const q = query(ref, where('at','>=', since), orderBy('at','asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
      } catch (_) { return []; }
    },
    async tradingListMySettlements() {
      try {
        const { user, db } = await withUser();
        const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = collection(db, 'market', 'public', 'settlements');
        const buyerSnap = await getDocs(query(ref, where('buyerUid','==',user.uid), where('buyerClaimed','==',false)));
        const sellerSnap = await getDocs(query(ref, where('sellerUid','==',user.uid), where('sellerClaimed','==',false)));
        return { buy: buyerSnap.docs.map(d=>({ id:d.id, ...(d.data()||{}) })), sell: sellerSnap.docs.map(d=>({ id:d.id, ...(d.data()||{}) })) };
      } catch (_) { return { buy:[], sell:[] }; }
    },
    async tradingClaimSettlement(settlementId) {
      try {
        const { user, db } = await withUser();
        const { doc, getDoc, runTransaction } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'market', 'public', 'settlements', settlementId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return { ok:false, error:'not-found' };
        const st = snap.data();
        if (st.buyerUid !== user.uid && st.sellerUid !== user.uid) return { ok:false, error:'forbidden' };

        // 두 역할이 동일 사용자일 수 있으므로, 아직 미청구 된 쪽을 우선 처리
        const shouldClaimSeller = (st.sellerUid === user.uid) && !st.sellerClaimed;
        const shouldClaimBuyer  = (st.buyerUid === user.uid) && !st.buyerClaimed;
        if (!shouldClaimSeller && !shouldClaimBuyer) return { ok:true };

        if (shouldClaimSeller) {
          await this.tradingAdjustPoints(+Number(st.price||0)*Number(st.qty||0), 'settle:sell');
          await runTransaction(db, async (trx) => {
            const s = await trx.get(ref); if (!s.exists()) return; const cur=s.data(); if (cur.sellerClaimed) return;
            trx.set(ref, { sellerClaimed:true }, { merge:true });
          });
        }
        if (shouldClaimBuyer) {
          await this.adjustCoins(+Number(st.qty||0), 'settle:buy');
          await runTransaction(db, async (trx) => {
            const s = await trx.get(ref); if (!s.exists()) return; const cur=s.data(); if (cur.buyerClaimed) return;
            trx.set(ref, { buyerClaimed:true }, { merge:true });
          });
        }
        return { ok:true };
      } catch (e) { return { ok:false, error:String(e&&e.message||e) }; }
    },
    async applyExpPoints(dateKey, addExp, addPoints, caps = { exp: 2000, points: 1000 }) {
      try {
        const active = await this.isBoosterActive();
        const exp = Number(addExp || 0);
        const ptsBase = Number(addPoints || 0);
        const pts = active ? ptsBase * 2 : ptsBase;
        const effectiveCaps = { exp: Number(caps.exp||2000), points: active ? Number(caps.points||1000) * 2 : Number(caps.points||1000) };
        // 개별 학습을 통한 포인트만 일일 한계에 적용
        const res = await this.incrementDailyStudyStats(dateKey, exp, pts, effectiveCaps);
        try { if ((res?.ptsApplied||0) > 0) await this.addPointTransaction(res.ptsApplied, 'earn:study'); } catch {}
        return res;
      } catch (_) { return { expApplied: 0, ptsApplied: 0, expReached: false, ptsReached: false }; }
    },
    // 내 리더보드 문서 갱신 (권한 없으면 무시)
    async upsertMyLeaderboard(totalExp, level) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, getDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const ref = doc(db, 'leaderboard', user.uid);
        const displayName = user.displayName || (user.email || '').split('@')[0] || '사용자';
        const photoURL = user.photoURL || null;
        let nickname = null;
        try {
          const pref = doc(db, 'users', user.uid, 'profile', 'main');
          const psnap = await getDoc(pref);
          nickname = psnap.exists() ? (psnap.data().nickname || null) : null;
        } catch {}
        // 변경 없음/과도한 빈도 방지: 기존 문서와 비교하거나 최근 2분 내 업데이트면 스킵
        try {
          const cur = await getDoc(ref);
          if (cur.exists()) {
            const d = cur.data() || {};
            const same = Number(d.totalExp||0) === Number(totalExp||0) && Number(d.level||0) === Number(level||0) && (d.nickname||null) === (nickname||null);
            const last = d.updatedAt?.toDate ? d.updatedAt.toDate().getTime() : 0;
            const recent = Date.now() - last < 120000; // 2분
            if (same || recent) return true;
          }
        } catch {}
        await setDoc(ref, { displayName, nickname, photoURL, totalExp: Number(totalExp)||0, level: Number(level)||1, updatedAt: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    // Favorites
    async listFavorites() {
      try {
        const { user, db, collection, getDocs } = await withUser();
        const snap = await getDocs(collection(db, 'users', user.uid, 'favorites'));
        return snap.docs.map(d => d.id);
      } catch (_) { return []; }
    },
    async addFavorite(qid) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await setDoc(doc(db, 'users', user.uid, 'favorites', qid), { ts: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    async removeFavorite(qid) {
      try {
        const { user, db } = await withUser();
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await deleteDoc(doc(db, 'users', user.uid, 'favorites', qid));
        return true;
      } catch (_) { return false; }
    },
    // Wrongs
    async listWrongs() {
      try {
        const { user, db, collection, getDocs } = await withUser();
        const snap = await getDocs(collection(db, 'users', user.uid, 'wrongs'));
        return snap.docs.map(d => d.id);
      } catch (_) { return []; }
    },
    async addWrong(qid) {
      try {
        const { user, db } = await withUser();
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await setDoc(doc(db, 'users', user.uid, 'wrongs', qid), { ts: serverTimestamp() }, { merge: true });
        return true;
      } catch (_) { return false; }
    },
    async removeWrong(qid) {
      try {
        const { user, db } = await withUser();
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await deleteDoc(doc(db, 'users', user.uid, 'wrongs', qid));
        return true;
      } catch (_) { return false; }
    },
  };
})();


