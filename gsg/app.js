// 내비게이션 토글 (모바일)
const navToggleButton = document.getElementById('navToggle');
const siteNav = document.getElementById('siteNav');
const loginBtn = document.getElementById('loginBtn');
const loginModal = document.getElementById('loginModal');

if (navToggleButton && siteNav) {
  navToggleButton.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('open');
    navToggleButton.setAttribute('aria-expanded', String(isOpen));
  });
}

// 고정 헤더 높이 계산
function getHeaderHeight() {
  const header = document.querySelector('.site-header');
  if (header) {
    const rect = header.getBoundingClientRect();
    return Math.max(0, Math.round(rect.height));
  }
  return 64; // fallback
}

function isHttpContext() {
  return location.protocol === 'http:' || location.protocol === 'https:';
}

// 부드러운 스크롤 및 현재 섹션에 따른 메뉴 하이라이트
const navLinks = Array.from(document.querySelectorAll('#siteNav a'));

navLinks.forEach((link) => {
  link.addEventListener('click', (ev) => {
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    const target = document.querySelector(href);
    if (!target) return;
    ev.preventDefault();

    // 모바일에서 메뉴 닫기
    siteNav.classList.remove('open');
    navToggleButton?.setAttribute('aria-expanded', 'false');

    const yOffset = -(getHeaderHeight() - 8); // 고정 헤더 보정 + 여백
    const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  });
});

// 현재 섹션 감지하여 메뉴 활성화
const sectionIds = ['learn', 'achievement', 'reward', 'community'];
const sectionMap = new Map(
  sectionIds.map((id) => [id, document.getElementById(id)])
);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
      }
    });
  },
  { root: null, rootMargin: '-50% 0px -45% 0px', threshold: 0 }
);

sectionMap.forEach((el) => el && observer.observe(el));

// 성과 섹션 카운터 애니메이션
function animateCounters() {
  const counters = document.querySelectorAll('.stat-value');
  counters.forEach((counter) => {
    const target = Number(counter.getAttribute('data-target')) || 0;
    const durationMs = 800;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const value = Math.round(target * progress);
      counter.textContent = String(value);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

const achievementSection = document.getElementById('achievement');
if (achievementSection) {
  const onceObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        animateCounters();
        onceObserver.disconnect();
      }
    },
    { threshold: 0.2 }
  );
  onceObserver.observe(achievementSection);
}

// 푸터 연도 자동 반영
const yearSpan = document.getElementById('year');
if (yearSpan) {
  yearSpan.textContent = String(new Date().getFullYear());
}

// 해시로 진입했을 때 헤더에 가려지지 않도록 보정
window.addEventListener('load', () => {
  const hash = window.location.hash;
  if (!hash) return;
  const target = document.querySelector(hash);
  if (!target) return;
  const yOffset = -(getHeaderHeight() - 8);
  const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
  window.scrollTo({ top: y });
});

// 로그인 모달 열기/닫기 및 간단한 유효성 검사 + 가짜 로그인 처리
function openLogin() {
  if (!loginModal) return;
  loginModal.classList.add('open');
  loginModal.setAttribute('aria-hidden', 'false');
  const firstField = loginModal.querySelector('input');
  firstField?.focus();
}
function closeLogin() {
  if (!loginModal) return;
  loginModal.classList.remove('open');
  loginModal.setAttribute('aria-hidden', 'true');
  loginBtn?.focus();
}

loginBtn?.addEventListener('click', openLogin);
loginModal?.addEventListener('click', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.matches('[data-close], .modal-backdrop')) {
    closeLogin();
  }
});

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const feedback = loginForm.querySelector('.form-feedback');
    if (!isHttpContext()) {
      if (feedback) feedback.textContent = '구글 로그인을 사용하려면 로컬 서버(http://localhost)에서 접속해야 합니다.';
      return;
    }
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
      const firebaseConfig = await window.loadFirebaseConfig();

      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (popupErr) {
        if (popupErr && popupErr.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, provider);
          return; // 리디렉션 흐름으로 전환
        }
        throw popupErr;
      }
      if (feedback) feedback.textContent = '로그인 성공!';
      closeLogin();
      setupAuthUI(auth, onAuthStateChanged, signOut);
    } catch (err) {
      if (feedback) feedback.textContent = '로그인 실패: ' + (err?.message || '오류가 발생했습니다');
    }
  });
}

async function setupAuthUI(auth, onAuthStateChanged, signOut) {
  const loginBtnEl = document.getElementById('loginBtn');
  const navEl = document.getElementById('siteNav');
  if (!loginBtnEl || !navEl) return;

  const ensureLogoutBtn = () => {
    let logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) {
      logoutBtn = document.createElement('button');
      logoutBtn.id = 'logoutBtn';
      logoutBtn.className = 'btn ghost small';
      logoutBtn.textContent = '로그아웃';
      loginBtnEl.insertAdjacentElement('afterend', logoutBtn);
    }
    return logoutBtn;
  };

  const ensureProfileBtn = () => {
    let profileBtn = document.getElementById('profileBtn');
    if (!profileBtn) {
      profileBtn = document.createElement('button');
      profileBtn.id = 'profileBtn';
      profileBtn.className = 'btn ghost small';
      profileBtn.textContent = '프로필 수정';
      loginBtnEl.insertAdjacentElement('afterend', profileBtn);
      profileBtn.onclick = () => { window.location.href = 'profile.html?edit=1'; };
    }
    return profileBtn;
  };

  onAuthStateChanged(auth, (user) => {
    const protectedLinks = navEl.querySelectorAll('a');
    protectedLinks.forEach((a) => {
      a.classList.toggle('disabled', !user);
      a.setAttribute('aria-disabled', String(!user));
      if (!user) {
        a.addEventListener('click', blockIfNoAuth);
      } else {
        a.removeEventListener('click', blockIfNoAuth);
      }
    });

    if (user) {
      loginBtnEl.style.display = 'none';
      const profileBtn = ensureProfileBtn();
      const logoutBtn = ensureLogoutBtn();
      logoutBtn.onclick = async () => {
        try { await signOut(auth); } catch {}
      };
    } else {
      loginBtnEl.style.display = '';
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) logoutBtn.remove();
      const profileBtn = document.getElementById('profileBtn');
      if (profileBtn) profileBtn.remove();
    }
  });
}

function blockIfNoAuth(e) {
  const target = e.currentTarget;
  if (target && target.getAttribute('aria-disabled') === 'true') {
    e.preventDefault();
    openLogin();
  }
}

// 페이지 로드 시 인증 상태 연결 (리디렉션 처리 포함)
window.addEventListener('load', async () => {
  if (!isHttpContext()) return;
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getAuth, onAuthStateChanged, signOut, getRedirectResult, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const firebaseConfig = await window.loadFirebaseConfig();
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    // 리디렉션 로그인 결과 처리
    try { await getRedirectResult(auth); } catch {}
    setupAuthUI(auth, onAuthStateChanged, signOut);

    // 로그인 업적 처리 (하루 1회만 네트워크 기록)
    try {
      const key = (window.firebaseData?.getLocalDateSeoulKey?.() 
        || (function(){ const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;})());
      const gateKey = `gsg_login_marked_${key}`;
      if (!localStorage.getItem(gateKey)) {
        await window.firebaseData?.markLogin?.(key);
        try { await window.firebaseData?.updateChallengesOnLogin?.(); } catch {}
        localStorage.setItem(gateKey, '1');
      }
      // 프로필 누락 시 입력 페이지로 이동 (인증된 사용자에 한해 검사)
      try {
        const uid = await window.firebaseData?.getCurrentUserUid?.();
        if (uid) {
          const prof = await window.firebaseData?.getMyProfile?.();
          if (!prof || !prof.name) {
            // 현재 페이지가 프로필 페이지가 아니면 이동
            if (!/profile\.html$/i.test(location.pathname)) {
              location.href = 'profile.html';
              return;
            }
          }
        }
      } catch {}
      const dates = await window.firebaseData?.listLoginDates?.();
      if (Array.isArray(dates)) {
        // 첫 로그인 배지 + 코인 1개
        if (dates.length === 1) {
          const has = await window.firebaseData?.hasAchievement?.('first-login');
          if (!has) {
            const r = await window.firebaseData?.awardAchievementCoinsOnce?.('first-login', { name: '첫 로그인' }, 1);
            showToast('배지 획득: 첫 로그인! +1코인', 'success');
          }
        }
        // 연속 로그인: Asia/Seoul 기준 키를 사용해 인접일 확인
        const sorted = dates.slice().sort();
        const str = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        function nextDay(s) { const [y,m,d] = s.split('-').map(Number); const t = new Date(y, m-1, d); t.setDate(t.getDate()+1); return str(t); }
        let bestStreak = 0; let curr = 0; let prev = null;
        sorted.forEach(k => { if (prev && k === nextDay(prev)) { curr += 1; } else { curr = 1; } bestStreak = Math.max(bestStreak, curr); prev = k; });
        if (bestStreak >= 3) { await window.firebaseData?.awardAchievement?.('streak-login-3', { name: '연속 로그인 3일' }); }
        if (bestStreak >= 5) { await window.firebaseData?.awardAchievement?.('streak-login-5', { name: '연속 로그인 5일' }); }
        if (bestStreak >= 10) { await window.firebaseData?.awardAchievement?.('streak-login-10', { name: '연속 로그인 10일' }); }
      }
    } catch {}
  } catch {}
});

// ===== Toast =====
function showToast(message, type = 'info', timeoutMs = 2400) {
  try {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.setAttribute('role', 'status');
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 200);
    }, timeoutMs);
  } catch {}
}

// 전역 노출
window.showToast = showToast;

// ===== Recommendations on index page =====
async function loadRecommendations() {
  const listDiff = document.getElementById('listDiff');
  const listWeak = document.getElementById('listWeak');
  const listImprove = document.getElementById('listImprove');
  const listGlobalHard = document.getElementById('listGlobalHard');
  if (!listDiff || !listWeak || !listImprove || !listGlobalHard) return;

  try {
    // load questions
    const res = await fetch('questions.json', { cache: 'no-store' });
    const questions = res.ok ? await res.json() : [];
    const flat = [];
    questions.forEach(b => (b['문항들']||[]).forEach(q => flat.push({
      id: q['문항번호'], diff: q['난이도']||'', img: q['문항주소']||'', solution: q['해설주소']||'',
      subject: b['과목'], cat: b['대분류'], sub: b['중분류'], topic: b['소분류'],
    })));

    // user answers & wrongs/favs
    let finals = [];
    let wrongs = [];
    try {
      finals = await window.firebaseData?.listFinalAnswers?.() || [];
      const wrongIds = await window.firebaseData?.listWrongs?.() || [];
      wrongs = new Set(wrongIds);
    } catch {}
    const solvedSet = new Set(finals.map(x => x.id));

    // 1) 난이도별 추천: 최근 성과 기반 단순 전략
    const recent = finals.slice(-30);
    const recentCorrectRate = recent.length ? recent.filter(x=>x.correct).length / recent.length : 0.6;
    const target = recentCorrectRate >= 0.75 ? ['♥♥♥♥', '♥♥♥♥♥']
                 : recentCorrectRate <= 0.45 ? ['♥', '♥♥']
                 : ['♥♥', '♥♥♥'];
    const byDifficulty = flat.filter(x => target.some(t => (x.diff||'').startsWith(t)) && !solvedSet.has(x.id)).slice(0, 6);

    // 2) 취약 영역 보완: 최근 틀린 소분류 상위 → 안 풀어본 문항, 없으면 과거 오답 우선
    const wrongByTopic = new Map();
    finals.filter(x => x.correct === false).forEach(x => {
      const key = [x.subject,x.cat,x.sub,x.topic].join('|');
      wrongByTopic.set(key, (wrongByTopic.get(key)||0)+1);
    });
    const weakTopics = Array.from(wrongByTopic.entries()).sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,3);
    const weakPicks = [];
    for (const key of weakTopics) {
      const [subject, cat, sub, topic] = key.split('|');
      const pool = flat.filter(q => q.subject===subject && q.cat===cat && q.sub===sub && q.topic===topic);
      const candidateUnsolved = pool.filter(q => !solvedSet.has(q.id));
      const arr = candidateUnsolved.length ? candidateUnsolved : pool.filter(q => wrongs.has(q.id));
      weakPicks.push(...arr.slice(0, 4));
    }

    // 3) 개선점 자동 제안(간단 규칙)
    const tips = [];
    if (recent.length >= 10 && recentCorrectRate < 0.5) tips.push('최근 정답률이 낮아요. 쉬운 난이도부터 다시 복습해 보세요.');
    if (weakTopics.length) tips.push('오답이 많은 소분류를 우선 복습하세요: ' + weakTopics.map(k=>k.split('|')[3]).join(', '));
    if (!tips.length) tips.push('좋아요! 현재 페이스를 유지하며 다양한 난이도의 문제를 시도해 보세요.');

    // 4) 전역 오답률 상위 문항
    let globalHard = [];
    try { globalHard = await window.firebaseData?.listGlobalWrongRatesTop?.(20) || []; } catch {}
    const mapQ = new Map(flat.map(x => [x.id, x]));
    const globalCards = (globalHard.length ? globalHard : flat.slice(0,20))
      .map(x => ({ id: x.id || x.qid || x, rate: x.wrongRate || null }));

    function cardHtml(q) {
      const meta = mapQ.get(q.id) || {};
      const text = `${meta.subject||''} / ${meta.cat||''} / ${meta.sub||''} / ${meta.topic||''}`;
      const query = new URLSearchParams({ subject: meta.subject||'', cat: meta.cat||'', sub: meta.sub||'', topic: meta.topic||'', qid: q.id });
      // 난이도는 문항 번호에 괄호로 포함되어 있어 중복 표기 제거
      return `<div class="row"><div class="line top"><div class="meta">${text}</div></div><div class="line bottom"><div class="id">${q.id}</div><div class="actions"><a class="btn ghost small" href="individual-study.html?${query.toString()}" target="_self">문제 풀기</a></div></div></div>`;
    }

    listDiff.innerHTML = byDifficulty.slice(0,6).map(q => cardHtml({ id: q.id })).join('') || '추천할 문제가 더 없습니다.';
    listWeak.innerHTML = weakPicks.slice(0,8).map(q => cardHtml({ id: q.id })).join('') || '취약 영역 추천을 만들 데이터가 부족합니다.';
    listImprove.innerHTML = tips.map(t => `<li>${t}</li>`).join('');
    listGlobalHard.innerHTML = globalCards.map(cardHtml).join('');
  } catch (err) {
    showToast('추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  }
}

window.addEventListener('load', () => { try { loadRecommendations(); } catch {} });

// ===== Hero Carousel =====
(function initCarousel() {
  const slides = Array.from(document.querySelectorAll('.carousel .slide'));
  const dots = Array.from(document.querySelectorAll('.carousel .dot'));
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  if (!slides.length || !dots.length || !prevBtn || !nextBtn) return;

  let index = 0;
  let timer = null;
  const INTERVAL = 5000;

  function show(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, si) => s.classList.toggle('active', si === index));
    dots.forEach((d, di) => {
      d.classList.toggle('active', di === index);
      d.setAttribute('aria-selected', String(di === index));
    });
    // 히어로 배경 테마 전환
    const hero = document.querySelector('.hero');
    if (hero) {
      hero.classList.remove('theme-1', 'theme-2', 'theme-3', 'theme-4');
      const themeId = slides[index].getAttribute('data-theme');
      if (themeId) hero.classList.add(`theme-${themeId}`);
    }
  }

  function next() { show(index + 1); }
  function prev() { show(index - 1); }

  function startAuto() {
    stopAuto();
    timer = setInterval(next, INTERVAL);
  }
  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  nextBtn.addEventListener('click', () => { next(); startAuto(); });
  prevBtn.addEventListener('click', () => { prev(); startAuto(); });
  dots.forEach((d) => d.addEventListener('click', () => { const i = Number(d.dataset.index||0); show(i); startAuto(); }));

  // 슬라이드 클릭 시 해당 섹션으로 이동
  slides.forEach((s) => {
    s.addEventListener('click', (e) => {
      // 버튼 클릭은 기본 동작 유지
      if (e.target.closest('.btn')) return;
      const targetSel = s.getAttribute('data-target');
      const target = targetSel && document.querySelector(targetSel);
      if (target) {
        const yOffset = -(getHeaderHeight() - 8);
        const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

  // 자동 재생 시작/정지 (가시성/포커스 고려)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAuto(); else startAuto();
  });
  window.addEventListener('focus', startAuto);
  window.addEventListener('blur', stopAuto);

  show(0);
  startAuto();
})();

