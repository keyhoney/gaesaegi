(function () {
  'use strict';

  function showToast(msg, type) {
    try { window.showToast && window.showToast(msg, type); } catch {}
  }

  function cardHtml(meta, id) {
    const text = `${meta.subject||''} / ${meta.cat||''} / ${meta.sub||''} / ${meta.topic||''}`;
    const query = new URLSearchParams({ subject: meta.subject||'', cat: meta.cat||'', sub: meta.sub||'', topic: meta.topic||'', qid: id });
    // 난이도는 문제 번호에 괄호로 포함되어 있어 별도 표기 제거
    return `<div class="row"><div class="line top"><div class="meta">${text}</div></div><div class="line bottom"><div class="id">${id}</div><div class="actions"><a class="btn ghost small" href="individual-study.html?${query.toString()}" target="_self">문제 풀기</a></div></div></div>`;
  }

  async function loadRecs() {
    const listDiff = document.getElementById('listDiff');
    const listWeak = document.getElementById('listWeak');
    const listImprove = document.getElementById('listImprove');
    const listGlobalHard = document.getElementById('listGlobalHard');
    if (!listDiff || !listWeak || !listImprove || !listGlobalHard) return;

    try {
      const res = await fetch('questions.json', { cache: 'no-store' });
      const questions = res.ok ? await res.json() : [];
      const flat = [];
      const byId = new Map();
      questions.forEach(b => (b['문항들']||[]).forEach(q => {
        const meta = { id: q['문항번호'], diff: q['난이도']||'', img: q['문항주소']||'', solution: q['해설주소']||'', subject: b['과목'], cat: b['대분류'], sub: b['중분류'], topic: b['소분류'] };
        flat.push(meta); byId.set(meta.id, meta);
      }));

      let finals = [];
      let wrongs = [];
      try {
        finals = await window.firebaseData?.listFinalAnswers?.() || [];
        const wrongIds = await window.firebaseData?.listWrongs?.() || [];
        wrongs = new Set(wrongIds);
      } catch {}
      const solvedSet = new Set(finals.map(x => x.id));

      // 난이도 추천
      const recent = finals.slice(-30);
      const recentCorrectRate = recent.length ? recent.filter(x=>x.correct).length / recent.length : 0.6;
      const target = recentCorrectRate >= 0.75 ? ['♥♥♥♥', '♥♥♥♥♥']
                   : recentCorrectRate <= 0.45 ? ['♥', '♥♥']
                   : ['♥♥', '♥♥♥'];
      const byDifficulty = flat.filter(x => target.some(t => (x.diff||'').startsWith(t)) && !solvedSet.has(x.id)).slice(0, 6);

      // 취약 영역
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

      // 개선점
      const tips = [];
      if (recent.length >= 10 && recentCorrectRate < 0.5) tips.push('최근 정답률이 낮아요. 쉬운 난이도부터 다시 복습해 보세요.');
      if (weakTopics.length) tips.push('오답이 많은 소분류를 우선 복습하세요: ' + weakTopics.map(k=>k.split('|')[3]).join(', '));
      if (!tips.length) tips.push('좋아요! 현재 페이스를 유지하며 다양한 난이도의 문제를 시도해 보세요.');

      // 전역 Top 20
      let globalHard = [];
      try { globalHard = await window.firebaseData?.listGlobalWrongRatesTop?.(20) || []; } catch {}
      const globalCards = (globalHard.length ? globalHard : flat.slice(0,20))
        .map(x => ({ id: x.id || x.qid || x, rate: x.wrongRate || null }))
        .filter(x => byId.has(x.id));

      // 렌더
      listDiff.innerHTML = byDifficulty.map(q => cardHtml(byId.get(q.id), q.id)).join('') || '추천할 문제가 더 없습니다.';
      listWeak.innerHTML = weakPicks.map(q => cardHtml(byId.get(q.id), q.id)).join('') || '취약 영역 추천을 만들 데이터가 부족합니다.';
      listImprove.innerHTML = tips.map(t => `<li>${t}</li>`).join('');
      listGlobalHard.innerHTML = globalCards.map(c => cardHtml(byId.get(c.id), c.id)).join('');
    } catch (err) {
      showToast('추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    }
  }

  window.addEventListener('load', () => { loadRecs(); });
})();


