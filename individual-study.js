(function () {
  'use strict';
  // 토스트 헬퍼
  function toast(msg, type) {
    try { window.showToast ? window.showToast(msg, type) : null; } catch {}
  }

  // 상수: 보상 정책
  const EXP_CORRECT = 100;
  const EXP_WRONG = 50;
  const POINTS_CORRECT = 50;
  const POINTS_WRONG = 25;
  const DAILY_EXP_LIMIT = 2000;
  const DAILY_POINTS_LIMIT = 1000;
  const COOLDOWN_HOURS = 72; // 제출 후 재보상 가능 시간

  // 로컬 스토리지 사용 제거. 파이어베이스에만 기록/조회합니다.

  // DOM 참조
  const $subject = document.getElementById('subjectSelect');
  const $category = document.getElementById('categorySelect');
  const $subcategory = document.getElementById('subcategorySelect');
  const $topic = document.getElementById('topicSelect');
  const $question = document.getElementById('questionSelect');

  const $questionArea = document.getElementById('questionArea');
  const $qn = document.getElementById('questionNumber');
  const $diff = document.getElementById('questionDifficulty');
  const $img = document.getElementById('questionImage');
  const $solutionLink = document.getElementById('solutionLink');
  const $favToggle = document.getElementById('favToggle');

  const $answerForm = document.getElementById('answerForm');
  const $answerInput = document.getElementById('answerInput');
  const $feedback = document.getElementById('feedback');
  const $rewardInfo = document.getElementById('rewardInfo');

  const $expToday = document.getElementById('expToday');
  const $pointsToday = document.getElementById('pointsToday');

  // 로컬 상태
  let dataset = [];
  let currentQuestion = null; // { 문항번호, 문항주소, 정답, 난이도, 해설주소 }

  // 로컬 저장 제거: 즐겨찾기/오답/로그는 전부 Firebase로

  function todayKey() { const d = new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }

  // 유틸
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async function loadDailyStats() {
    try {
      const key = await window.firebaseData?.getServerDateSeoulKey?.();
      const k = key || window.firebaseData?.getLocalDateSeoulKey?.();
      const d = await window.firebaseData?.getDailyStats?.(k);
      return { exp: Number(d?.exp||0), points: Number(d?.points||0), studyExp: Number(d?.studyExp||0), studyPoints: Number(d?.studyPoints||0) };
    } catch (_) { return { exp: 0, points: 0, studyExp: 0, studyPoints: 0 }; }
  }

  async function updateStatsUI() {
    const stats = await loadDailyStats();
    $expToday.textContent = String(stats.exp);
    // 개별 학습을 통한 포인트만 표시 (일일 한계 적용 대상)
    $pointsToday.textContent = String(stats.studyPoints);
  }

  function withinCooldown(lastDate) {
    if (!lastDate) return false;
    const lastTs = (lastDate instanceof Date) ? lastDate.getTime() : new Date(lastDate).getTime();
    if (Number.isNaN(lastTs)) return false;
    const diffMs = Date.now() - lastTs;
    const hours = diffMs / (1000 * 60 * 60);
    return hours < COOLDOWN_HOURS;
  }

  function nextEligibleTime(lastDate) {
    const last = (lastDate instanceof Date) ? lastDate.getTime() : new Date(lastDate).getTime();
    const next = last + COOLDOWN_HOURS * 60 * 60 * 1000;
    return new Date(next);
  }

  function formatTime(dt) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
  }

  // gains 계산은 서버 트랜잭션에서 수행

  async function grantRewards(isCorrect) {
    const baseExp = isCorrect ? EXP_CORRECT : EXP_WRONG;
    const basePoints = isCorrect ? POINTS_CORRECT : POINTS_WRONG;
    const applied = await window.firebaseData?.applyExpPoints?.(todayKey(), baseExp, basePoints, { exp: DAILY_EXP_LIMIT, points: DAILY_POINTS_LIMIT })
      || { expApplied: 0, ptsApplied: 0, expReached: false, ptsReached: false };
    await updateStatsUI();

    const msgs = [];
    if (applied.expApplied > 0 || applied.ptsApplied > 0) {
      msgs.push(`보상 지급: 경험치 +${applied.expApplied} exp, 포인트 +${applied.ptsApplied} pt`);
    }
    if (applied.expReached || applied.ptsReached) {
      const hits = [];
      if (applied.expReached) hits.push('경험치 일일 최대치(2,000 exp)');
      if (applied.ptsReached) hits.push('개별 학습 포인트 일일 최대치(1,000 pt)');
      msgs.push(`${hits.join(' 및 ')}에 도달하여 추가 보상이 제한됩니다.`);
    }
    return msgs.join(' ');
  }

  async function maybeAwardAnswerStreak(isCorrect) {
    try {
      // 간단: 정답 시 연속 정답 카운팅 (로컬 스토리지 보조), 5연속 시 배지 부여
      const key = 'gsg_correct_streak';
      let streak = Number(localStorage.getItem(key) || '0');
      streak = isCorrect ? streak + 1 : 0;
      localStorage.setItem(key, String(streak));
      // 단계형 배지 5/10/20
      if (streak === 5) { await window.firebaseData?.awardAchievementCoinsOnce?.('streak-correct-5', { name: '정답 5연속' }, 1); toast('배지 획득: 정답 5연속! +1코인', 'success'); }
      if (streak === 10) { await window.firebaseData?.awardAchievementCoinsOnce?.('streak-correct-10', { name: '정답 10연속' }, 2); toast('배지 획득: 정답 10연속! +2코인', 'success'); }
      if (streak === 20) { await window.firebaseData?.awardAchievementCoinsOnce?.('streak-correct-20', { name: '정답 20연속' }, 3); toast('배지 획득: 정답 20연속! +3코인', 'success'); }
      // 이벤트 기록(서버 타임스탬프)
      await window.firebaseData?.addAnswerEvent?.(!!isCorrect);
      // 문제 풀이 누적 50개 달성 배지
      const cntKey = 'gsg_answer_count';
      let cnt = Number(localStorage.getItem(cntKey) || '0') + 1;
      localStorage.setItem(cntKey, String(cnt));
      if (cnt === 50) { await window.firebaseData?.awardAchievementCoinsOnce?.('solved-50', { name: '문제 50개 풀이' }, 2); toast('배지 획득: 문제 풀이 50개! +2코인', 'success'); }
    } catch {}
  }

  function buildHierarchy(data) {
    // 과목 -> 대분류 -> 중분류 -> 소분류 -> 문항들
    // 입력 데이터는 같은 키를 가진 평면 배열이므로, 선택값 기반으로 필터링만 수행
    return {
      subjects: Array.from(new Set(data.map(x => x['과목']))).sort(),
      getCategories: subject =>
        Array.from(new Set(data.filter(x => x['과목'] === subject).map(x => x['대분류']))).sort(),
      getSubcategories: (subject, category) =>
        Array.from(new Set(
          data.filter(x => x['과목'] === subject && x['대분류'] === category)
              .map(x => x['중분류'])
        )).sort(),
      getTopics: (subject, category, subcategory) =>
        Array.from(new Set(
          data.filter(x => x['과목'] === subject && x['대분류'] === category && x['중분류'] === subcategory)
              .map(x => x['소분류'])
        )).sort(),
      getQuestions: (subject, category, subcategory, topic) => {
        const bucket = data.find(x => x['과목'] === subject && x['대분류'] === category && x['중분류'] === subcategory && x['소분류'] === topic);
        if (!bucket) return [];
        return Array.isArray(bucket['문항들']) ? bucket['문항들'] : [];
      }
    };
  }

  function option(el, value, label) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    el.appendChild(opt);
  }

  function clearSelect(el, placeholder = '선택') {
    el.innerHTML = '';
    option(el, '', placeholder);
    el.selectedIndex = 0;
  }

  function setDisabled(el, disabled) {
    el.disabled = !!disabled;
  }

  async function loadData() {
    // gsg/questions.json 사용
    const res = await fetch('questions.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('문항 데이터를 불러오지 못했습니다.');
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('문항 데이터 형식이 올바르지 않습니다.');
    return json;
  }

  function populateSubjects(h) {
    clearSelect($subject, '과목 선택');
    h.subjects.forEach(s => option($subject, s, s));
    setDisabled($category, true);
    setDisabled($subcategory, true);
    setDisabled($topic, true);
    setDisabled($question, true);
  }

  function handleSubjectChange(h) {
    const subject = $subject.value;
    clearSelect($category, '대분류 선택');
    clearSelect($subcategory, '중분류 선택');
    clearSelect($topic, '소분류 선택');
    clearSelect($question, '개별 문제 선택');
    if (!subject) {
      setDisabled($category, true);
      setDisabled($subcategory, true);
      setDisabled($topic, true);
      setDisabled($question, true);
      return;
    }
    const cats = h.getCategories(subject);
    cats.forEach(c => option($category, c, c));
    setDisabled($category, false);
    setDisabled($subcategory, true);
    setDisabled($topic, true);
    setDisabled($question, true);
  }

  function handleCategoryChange(h) {
    const subject = $subject.value;
    const category = $category.value;
    clearSelect($subcategory, '중분류 선택');
    clearSelect($topic, '소분류 선택');
    clearSelect($question, '개별 문제 선택');
    if (!category) {
      setDisabled($subcategory, true);
      setDisabled($topic, true);
      setDisabled($question, true);
      return;
    }
    const subs = h.getSubcategories(subject, category);
    subs.forEach(s => option($subcategory, s, s));
    setDisabled($subcategory, false);
    setDisabled($topic, true);
    setDisabled($question, true);
  }

  function handleSubcategoryChange(h) {
    const subject = $subject.value;
    const category = $category.value;
    const sub = $subcategory.value;
    clearSelect($topic, '소분류 선택');
    clearSelect($question, '개별 문제 선택');
    if (!sub) {
      setDisabled($topic, true);
      setDisabled($question, true);
      return;
    }
    const topics = h.getTopics(subject, category, sub);
    topics.forEach(t => option($topic, t, t));
    setDisabled($topic, false);
    setDisabled($question, true);
  }

  function handleTopicChange(h) {
    const subject = $subject.value;
    const category = $category.value;
    const sub = $subcategory.value;
    const topic = $topic.value;
    clearSelect($question, '개별 문제 선택');
    if (!topic) {
      setDisabled($question, true);
      return;
    }
    const qs = h.getQuestions(subject, category, sub, topic);
    // 개별 문제 선택 시 난이도 함께 표기 예: 20220621(♥♥♥♥♥)
    qs.forEach((q, idx) => {
      const id = q['문항번호'] || `Q${idx + 1}`;
      const diff = q['난이도'] || '';
      const label = `${id}`; // 이미 (♥...) 포함됨
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = label;
      // 실제 객체를 참조하기 위해 data-*에 인덱스 저장
      opt.dataset.index = String(idx);
      $question.appendChild(opt);
    });
    // 해당 토픽의 질문 리스트를 state에 캐싱
    $question.dataset.cache = JSON.stringify(qs);
    setDisabled($question, false);
  }

  function applyDeepLink(h) {
    const p = new URLSearchParams(location.search);
    const subject = p.get('subject');
    const cat = p.get('cat');
    const sub = p.get('sub');
    const topic = p.get('topic');
    const qid = p.get('qid');
    if (!subject && !qid) return;
    // 과목
    if (subject) {
      $subject.value = subject;
      handleSubjectChange(h);
      if (cat) {
        $category.value = cat;
        handleCategoryChange(h);
      }
      if (sub) {
        $subcategory.value = sub;
        handleSubcategoryChange(h);
      }
      if (topic) {
        $topic.value = topic;
        handleTopicChange(h);
        if (qid) {
          const match = Array.from($question.options).find(o => o.value === qid);
          if (match) {
            $question.value = qid;
            selectQuestionFromDropdown();
            return;
          }
        }
      }
    }

    // Fallback: qid만으로 역추적하여 드롭다운 자동 설정
    if (qid) {
      let found = null;
      let bucketMeta = null;
      for (const bucket of dataset) {
        const list = bucket['문항들'] || [];
        const hit = list.find(q => q['문항번호'] === qid);
        if (hit) { found = hit; bucketMeta = bucket; break; }
      }
      if (found && bucketMeta) {
        $subject.value = bucketMeta['과목'];
        handleSubjectChange(h);
        $category.value = bucketMeta['대분류'];
        handleCategoryChange(h);
        $subcategory.value = bucketMeta['중분류'];
        handleSubcategoryChange(h);
        $topic.value = bucketMeta['소분류'];
        handleTopicChange(h);
        const match = Array.from($question.options).find(o => o.value === qid);
        if (match) {
          $question.value = qid;
          selectQuestionFromDropdown();
        }
      }
    }
  }

  function selectQuestionFromDropdown() {
    const selectedValue = $question.value;
    const cache = JSON.parse($question.dataset.cache || '[]');
    const idxAttr = $question.options[$question.selectedIndex]?.dataset?.index;
    let qObj = null;
    if (idxAttr != null) {
      const idx = Number(idxAttr);
      if (!Number.isNaN(idx)) qObj = cache[idx];
    }
    if (!qObj) qObj = cache.find(x => x['문항번호'] === selectedValue) || null;
    if (!qObj) {
      $questionArea.hidden = true;
      currentQuestion = null;
      return;
    }
    currentQuestion = {
      id: qObj['문항번호'],
      img: qObj['문항주소'],
      answer: String(qObj['정답']).trim(),
      difficulty: qObj['난이도'] || '',
      solution: qObj['해설주소'] || ''
    };
    renderQuestion();
  }

  function renderQuestion() {
    if (!currentQuestion) {
      $questionArea.hidden = true;
      return;
    }
    $questionArea.hidden = false;
    $qn.textContent = currentQuestion.id || '';
    $diff.textContent = currentQuestion.difficulty || '-';
    // 이미지 경로 해석: questions.json의 'mun/..'은 gsg/mun을 참조
    const rawPath = currentQuestion.img || '';
    const normalized = rawPath.replace(/^\.\//, '');
    const resolved = /^https?:\/\//i.test(normalized)
      ? normalized
      : normalized; // 예: 'mun/20220621.png' → 현재 문서 상대경로(gsg/mun/...)
    $img.onerror = () => {
      $img.alt = '문제 이미지를 불러오지 못했습니다.';
    };
    $img.src = resolved;
    $img.alt = `${currentQuestion.id} 문제 이미지`;
    // 해설 링크는 정답 제출 후에만 노출
    $solutionLink.removeAttribute('href');
    $solutionLink.style.display = 'none';
    $feedback.textContent = '';
    $rewardInfo.textContent = '';
    $answerInput.value = '';
    $answerInput.focus();

    // 즐겨찾기 상태 반영(Firebase)
    (async () => {
      try {
        const favs = new Set(await window.firebaseData?.listFavorites?.());
        const on = favs.has(currentQuestion.id);
        $favToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
        const icon = $favToggle.querySelector('.fav-icon');
        const label = $favToggle.querySelector('.fav-label');
        if (icon) icon.textContent = on ? '★' : '☆';
        if (label) label.textContent = on ? '즐겨찾기 삭제' : '즐겨찾기 추가';
      } catch (_) {}
    })();
  }

  async function handleSubmitAnswer(evt) {
    evt.preventDefault();
    if (!currentQuestion) return;
    const userAns = ($answerInput.value || '').trim();
    if (userAns.length === 0) {
      $feedback.textContent = '정답을 입력해 주세요.';
      return;
    }

    // 보상 제한 확인: 동일 문항 72시간 쿨다운
    const last = await window.firebaseData?.getSubmissionAt?.(currentQuestion.id);
    let cooldownMsg = '';
    const eligible = !withinCooldown(last);

    const isCorrect = userAns === currentQuestion.answer;
    if (isCorrect) {
      $feedback.textContent = '축하해요. 정답입니다! 🎉';
    } else {
      $feedback.textContent = `아쉬워요. 오답입니다! 😭 정답은 ${currentQuestion.answer} 입니다.`;
    }

    // 오답 수집(Firebase)
    if (!isCorrect) {
      try { await window.firebaseData?.addWrong?.(currentQuestion.id); } catch (_) {}
    }

    // 학습 로그 기록(과목 기준)
    const subj = $subject.value || '';
    const cat = $category.value || null;
    const sub = $subcategory.value || null;
    const topic = $topic.value || null;
    // Firebase에만 기록
    try { await window.firebaseData?.addLearningLog({ date: todayKey(), subject: subj, cat, sub, topic, correct: isCorrect ? 1 : 0, total: 1 }); } catch (_) {}
    try { await window.firebaseData?.addAnsweredLog({ date: todayKey(), qid: currentQuestion.id }); } catch (_) {}

    if (eligible) {
      const msg = await grantRewards(isCorrect);
      $rewardInfo.textContent = msg;
      if (msg && msg.includes('보상 지급')) {
        toast(msg, 'success');
      }
      await window.firebaseData?.setSubmissionNow?.(currentQuestion.id);
    } else {
      const next = formatTime(nextEligibleTime(last));
      cooldownMsg = `최근 72시간 내에 이미 제출한 문제입니다. 보상은 ${next} 이후에 다시 획득할 수 있어요.`;
      $rewardInfo.textContent = cooldownMsg;
      toast('보상 쿨다운이 적용되어 포인트/경험치가 지급되지 않았습니다.', 'info');
    }

    // 업적 체크
    maybeAwardAnswerStreak(isCorrect);
    // 챌린지 업데이트(일/주/월)
    try { await window.firebaseData?.updateChallengesOnAnswer?.(isCorrect); } catch {}

    // 최종 제출 답안을 answers/{qid}로 저장(과목 필터 정확도를 위해 메타 포함)
    try {
      await window.firebaseData?.setFinalAnswer?.(currentQuestion.id, {
        subject: subj, cat, sub, topic,
        correct: isCorrect, date: todayKey(),
      });
    } catch (_) {}

    // 리더보드 갱신은 성취도 페이지 진입 시 1회만 수행하도록 더티 플래그 설정
    try { localStorage.setItem('gsg_lb_dirty', '1'); } catch {}

    // 정답 여부와 무관하게 해설 링크 노출(있을 때만)
    if (currentQuestion.solution) {
      $solutionLink.href = currentQuestion.solution;
      $solutionLink.style.display = '';
    }
  }

  function wireEvents(h) {
    $subject.addEventListener('change', () => handleSubjectChange(h));
    $category.addEventListener('change', () => handleCategoryChange(h));
    $subcategory.addEventListener('change', () => handleSubcategoryChange(h));
    $topic.addEventListener('change', () => handleTopicChange(h));
    $question.addEventListener('change', selectQuestionFromDropdown);
    $answerForm.addEventListener('submit', handleSubmitAnswer);
    $favToggle.addEventListener('click', async () => {
      if (!currentQuestion) return;
      const isOn = $favToggle.getAttribute('aria-pressed') === 'true';
      // 낙관적 UI 적용
      const iconEl = $favToggle.querySelector('.fav-icon');
      const labelEl = $favToggle.querySelector('.fav-label');
      const prevIcon = iconEl ? iconEl.textContent : '';
      const prevLabel = labelEl ? labelEl.textContent : '';
      const prevPressed = $favToggle.getAttribute('aria-pressed');
      const next = !isOn;
      $favToggle.setAttribute('aria-pressed', next ? 'true' : 'false');
      if (iconEl) iconEl.textContent = next ? '★' : '☆';
      if (labelEl) labelEl.textContent = next ? '즐겨찾기 삭제' : '즐겨찾기 추가';
      let ok = false;
      try {
        ok = isOn
          ? await window.firebaseData?.removeFavorite?.(currentQuestion.id)
          : await window.firebaseData?.addFavorite?.(currentQuestion.id);
      } catch (_) { ok = false; }
      if (!ok) {
        // 실패 시 롤백
        $favToggle.setAttribute('aria-pressed', prevPressed || 'false');
        if (iconEl) iconEl.textContent = prevIcon || '☆';
        if (labelEl) labelEl.textContent = prevLabel || '즐겨찾기 추가';
        toast('즐겨찾기 동기화에 실패했습니다. 로그인 상태를 확인하거나 잠시 후 다시 시도해 주세요.', 'error');
      } else {
        toast(next ? '즐겨찾기에 추가했어요.' : '즐겨찾기를 삭제했어요.', 'success');
      }
    });
  }

  // 초기화
  (async function init() {
    try {
      dataset = await loadData();
      const h = buildHierarchy(dataset);
      populateSubjects(h);
      wireEvents(h);
      updateStatsUI();
      applyDeepLink(h);
    } catch (err) {
      console.error(err);
      alert('문제 데이터를 불러오는 중 오류가 발생했습니다. 새로고침 후 다시 시도해 주세요.');
    }
  })();
})();


