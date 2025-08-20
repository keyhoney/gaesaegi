(function () {
  'use strict';

  const BADGE_PLACEHOLDER = [
    { id: 'first-login', name: '첫 로그인', desc: '처음 로그인했습니다.', color: 'gold', icon: '★', owned: false },
    { id: 'streak-login-3', name: '연속 로그인 3일', desc: '3일 연속 로그인했습니다.', color: 'green', icon: '3', owned: false },
    { id: 'streak-login-5', name: '연속 로그인 5일', desc: '5일 연속 로그인했습니다.', color: 'green', icon: '5', owned: false },
    { id: 'streak-login-10', name: '연속 로그인 10일', desc: '10일 연속 로그인했습니다.', color: 'green', icon: '10', owned: false },
    { id: 'streak-correct-5', name: '정답 5연속', desc: '정답을 5번 연속 제출했습니다.', color: 'blue', icon: '✔', owned: false },
    { id: 'streak-correct-10', name: '정답 10연속', desc: '정답을 10번 연속 제출했습니다.', color: 'blue', icon: '✔', owned: false },
    { id: 'streak-correct-20', name: '정답 20연속', desc: '정답을 20번 연속 제출했습니다.', color: 'blue', icon: '✔', owned: false },
    { id: 'solved-50', name: '문제 50개 풀이', desc: '문제를 50개 이상 풀이했습니다.', color: 'pink', icon: '50', owned: false },
    { id: 'level-5', name: '레벨 5 달성', desc: '레벨 5에 도달했습니다.', color: 'gold', icon: '5', owned: false },
    { id: 'level-10', name: '레벨 10 달성', desc: '레벨 10에 도달했습니다.', color: 'gold', icon: '10', owned: false },
    { id: 'level-20', name: '레벨 20 달성', desc: '레벨 20에 도달했습니다.', color: 'gold', icon: '20', owned: false },
    { id: 'acc-80', name: '정답률 80%', desc: '최근 50문항 정답률 80% 이상', color: 'green', icon: '80', owned: false },
    { id: 'acc-90', name: '정답률 90%', desc: '최근 50문항 정답률 90% 이상', color: 'green', icon: '90', owned: false },
  ];

  function renderBadges(badges) {
    const el = document.getElementById('badgeList');
    if (!el) return;
    el.classList.add('badge-grid');
    const fmt = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
    const filterSel = document.getElementById('badgeFilter');
    let list = badges.slice();
    const fv = filterSel?.value || 'all';
    if (fv === 'owned') list = list.filter(b => b.owned);
    if (fv === 'not') list = list.filter(b => !b.owned);
    // 정렬 기능 제거: 배지 정의 순서를 유지

    el.innerHTML = list.map(b => {
      let when = '';
      try {
        const t = b.at?.toDate ? b.at.toDate() : (b.at ? new Date(b.at) : null);
        when = t ? fmt.format(t) : '';
      } catch {}
      const tip = `${b.desc}${when ? ` (획득: ${when})` : ''}`;
      return `
        <div class="badge-card ${b.owned ? '' : 'locked'}" title="${tip}">
          <div class="badge-icon ${b.color||'gold'}" aria-hidden="true">${b.icon||'★'}</div>
          <div>
            <div class="badge-title">${b.name}${when && b.owned ? ' · 획득' : ''}</div>
            <div class="badge-desc">${b.desc}${when && b.owned ? ` · ${when}` : ''}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function levelFromExp(totalExp) {
    // 요구 공식: 다음 레벨 필요 = 1000 * (1.2)^(현재 레벨 - 1)
    let level = 1;
    let curCap = 0;
    const need = (lvl) => 1000 * Math.pow(1.2, Math.max(0, (lvl - 1)));
    while (true) {
      const nextNeed = need(level);
      if (totalExp >= curCap + nextNeed) { curCap += nextNeed; level += 1; if (level > 300) break; }
      else break;
    }
    const nextCap = curCap + need(level);
    const curInto = totalExp - curCap;
    const percent = Math.max(0, Math.min(100, Math.round((curInto / (nextCap - curCap)) * 100)));
    return { level, curInto, curCap, nextCap, percent };
  }

  function renderLevel(totalExp) {
    const { level, percent, nextCap } = levelFromExp(totalExp);
    const lbl = document.getElementById('levelLabel');
    const bar = document.getElementById('levelBar');
    const pct = document.getElementById('levelPercent');
    const meta = document.getElementById('levelMeta');
    if (lbl) lbl.textContent = `Lv. ${level}`;
    if (bar) bar.style.width = `${percent}%`;
    if (pct) pct.textContent = `${percent}%`;
    const needToNext = Math.max(0, Math.round(nextCap - totalExp));
    if (meta) meta.innerHTML = `다음 레벨까지 남은 경험치: <strong title="총 필요치: ${Math.round(nextCap).toLocaleString()}">${needToNext.toLocaleString()} exp</strong>`;
    return level;
  }

  // 지갑 표시 제거

  async function renderChallenges() {
    try {
      const key = await window.firebaseData?.getServerDateSeoulKey?.();
      const weekKey = window.firebaseData?._weekKeyFromDateKey?.(key) || '';
      const monthKey = window.firebaseData?._monthKeyFromDateKey?.(key) || '';
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const cfg = await window.loadFirebaseConfig?.();
      const app = initializeApp(cfg);
      const db = getFirestore(app);
      // 사용자 UID는 auth에서 가져오기
      const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      const auth = getAuth(app);
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      async function read(ref) { const snap = await getDoc(ref); return snap.exists() ? snap.data() : null; }
      const daily = await read(doc(db, 'users', uid, 'challenges', `daily-${key}`));
      const weekly = await read(doc(db, 'users', uid, 'challenges', `weekly-${weekKey}`));
      const monthly = await read(doc(db, 'users', uid, 'challenges', `monthly-${monthKey}`));
      const targets = { daily: 10, weekly: 70, monthly: 300 };
      // 기간 문자열(Asia/Seoul)
      const [yy, mm, dd] = (key||'').split('-').map(Number);
      const fmtYMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
      const base = new Date(yy, (mm||1)-1, dd||1);
      const weekStart = new Date(base);
      const wday = (weekStart.getDay() + 6) % 7; // Mon=0
      weekStart.setDate(weekStart.getDate() - wday);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
      const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
      const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      const weekPeriod = `${fmtYMD.format(weekStart)} ~ ${fmtYMD.format(weekEnd)}`;
      const monthPeriod = `${fmtYMD.format(monthStart)} ~ ${fmtYMD.format(monthEnd)}`;
      const setBar = (prefix, cur, max) => {
        const ratio = Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
        const bar = document.getElementById(`${prefix}Bar`);
        const pct = document.getElementById(`${prefix}Pct`);
        if (bar) bar.style.width = `${ratio}%`;
        if (pct) pct.textContent = `${ratio}%`;
        const remain = Math.max(0, max - cur);
        const label = document.getElementById(prefix.replace('challenge','challenge'));
      };
      setBar('challengeDaily', (daily?.total||0), targets.daily);
      setBar('challengeWeekly', (weekly?.total||0), targets.weekly);
      setBar('challengeMonthly', (monthly?.total||0), targets.monthly);
      // Remaining text lines
      const dl = document.getElementById('challengeDaily');
      const wl = document.getElementById('challengeWeekly');
      const ml = document.getElementById('challengeMonthly');
      if (dl) dl.textContent = `보상: 200pt | 챌린지 달성까지 남은 문제 수: ${Math.max(0, targets.daily - (daily?.total||0))}`;
      if (wl) wl.textContent = `보상: 1코인 | 챌린지 달성까지 남은 문제 수: ${Math.max(0, targets.weekly - (weekly?.total||0))} | 기간: ${weekPeriod} (주간/월간은 하루 최대 10문제까지만 카운트됩니다)`;
      if (ml) ml.textContent = `보상: 9코인 | 챌린지 달성까지 남은 문제 수: ${Math.max(0, targets.monthly - (monthly?.total||0))} | 기간: ${monthPeriod} (주간/월간은 하루 최대 10문제까지만 카운트됩니다)`;
    } catch {}
  }

  function renderLeaderboard(items, myUid, myInfo, myRank) {
    const el = document.getElementById('leaderboard');
    if (!el) return;
    const rows = items.map((u, idx) => {
      const me = u.id === myUid ? ' (나)' : '';
      const name = u.nickname || u.displayName || `사용자${idx+1}`;
      const level = u.level || 1;
      const exp = Number(u.totalExp || 0).toLocaleString();
      return `
        <div class="row">
          <div class="line top"><div class="meta">${idx+1}위 · ${name}${me}</div></div>
          <div class="line bottom"><div class="id">Lv. ${level}</div><div class="diff">${exp} exp</div></div>
        </div>
      `;
    }).join('');
    let mine = '';
    if (myInfo && (myRank == null || myRank >= items.length)) {
      const name = myInfo.nickname || myInfo.displayName || '나';
      const level = myInfo.level || 1;
      const exp = Number(myInfo.totalExp || 0).toLocaleString();
      const r = (myRank != null) ? `${myRank+1}위` : '순위 계산중';
      mine = `
        <div class="row" style="border-color: var(--accent);">
          <div class="line top"><div class="meta">내 순위 · ${r} · ${name}</div></div>
          <div class="line bottom"><div class="id">Lv. ${level}</div><div class="diff">${exp} exp</div></div>
        </div>
      `;
    }
    el.innerHTML = (rows || '') + mine || '리더보드 데이터가 아직 없습니다.';
  }

  async function init() {
    try {
      const owned = await window.firebaseData?.listAchievements?.();
      const ownMap = new Map((owned||[]).map(x => [x.id, x]));
      const badges = BADGE_PLACEHOLDER.map(b => ({ ...b, owned: ownMap.has(b.id), at: ownMap.get(b.id)?.at }));
      renderBadges(badges);
      // 필터/정렬 상호작용
      const refilter = () => renderBadges(badges);
      document.getElementById('badgeFilter')?.addEventListener('change', refilter);
      document.getElementById('badgeSort')?.addEventListener('change', refilter);
    } catch { renderBadges(BADGE_PLACEHOLDER); }
    try {
      const sum = await window.firebaseData?.sumDailyStats?.();
      const totalExp = Number(sum?.totalExp || 0);
      const level = renderLevel(totalExp);
      // 지갑 메타는 표시하지 않음
      try { await window.firebaseData?.recordLevelProgress?.(level); } catch {}
      // 내 리더보드 갱신 시도(권한 없으면 무시)
      try {
        if (localStorage.getItem('gsg_lb_dirty') === '1') {
          await window.firebaseData?.upsertMyLeaderboard?.(Number(sum?.totalExp||0), level);
          localStorage.removeItem('gsg_lb_dirty');
        }
      } catch {}
      // 레벨 달성 배지(레벨 10=+2코인, 레벨 20=+3코인, 레벨 5=+1코인)
      try {
        if (level >= 5) await window.firebaseData?.awardAchievementCoinsOnce?.('level-5', { name: '레벨 5 달성' }, 1);
        if (level >= 10) await window.firebaseData?.awardAchievementCoinsOnce?.('level-10', { name: '레벨 10 달성' }, 2);
        if (level >= 20) await window.firebaseData?.awardAchievementCoinsOnce?.('level-20', { name: '레벨 20 달성' }, 3);
      } catch {}
    } catch {}

    try {
      const top = await window.firebaseData?.listLeaderboardTop?.(20) || [];
      // 내 uid 가져와 강조 표시
      let myUid = null;
      try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const cfg = await window.loadFirebaseConfig?.();
        const app = initializeApp(cfg);
        const auth = getAuth(app);
        myUid = auth.currentUser?.uid || null;
      } catch {}
      // 내 전체 순위 계산 시도
      let myInfo = null; let myRank = null;
      try {
        const all = await window.firebaseData?.listLeaderboardAll?.();
        myInfo = (await window.firebaseData?.getMyLeaderboard?.()) || null;
        if (all && myInfo) {
          myRank = all.findIndex(x => x.id === myInfo.id);
        }
      } catch {}
      renderLeaderboard(top, myUid, myInfo, myRank);
    } catch {
      renderLeaderboard([], null);
    }

    // 정답률 배지(최근 50 문항)
    try {
      const finals = await window.firebaseData?.listFinalAnswers?.();
      const recent = (finals||[]).slice(-50);
      const total = recent.length;
      const correct = recent.filter(x=>x.correct).length;
      const acc = total>0 ? correct/total : 0;
      if (acc >= 0.9 && total >= 10) await window.firebaseData?.awardAchievementCoinsOnce?.('acc-90', { name: '정답률 90%' }, 3);
      else if (acc >= 0.8 && total >= 10) await window.firebaseData?.awardAchievementCoinsOnce?.('acc-80', { name: '정답률 80%' }, 2);
    } catch {}

    renderChallenges();
  }

  window.addEventListener('load', init);
})();


