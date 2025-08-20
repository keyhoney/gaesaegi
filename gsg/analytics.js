(function () {
  'use strict';

  // 학습 로그 포맷(실데이터 전용)
  // localStorage.gsg_learning_logs = [{date:'YYYY-MM-DD', subject:'수학Ⅰ', correct:8, total:10}, ...]

  const LS_KEY = 'gsg_learning_logs';

  function loadLogs() {
    try {
      const data = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (Array.isArray(data)) return data;
      return [];
    } catch (_) { return []; }
  }

  function groupBy(list, keyFn) {
    const m = new Map();
    list.forEach(item => {
      const k = keyFn(item);
      const arr = m.get(k) || [];
      arr.push(item);
      m.set(k, arr);
    });
    return m;
  }

  let logs = [];
  let answeredLogs = [];
  let finalAnswers = [];
  let questions = [];

  async function loadQuestions() {
    try { const r = await fetch('questions.json', { cache: 'no-store' }); if (!r.ok) return []; return await r.json(); } catch (_) { return []; }
  }

  // 진행률(일/주/월)
  const progressChart = echarts.init(document.getElementById('progressChart'));
  const pieChart = echarts.init(document.getElementById('pieChart'));
  const countChart = echarts.init(document.getElementById('countChart'));

  function buildDailyProgress() {
    // 진행률 = (최종 제출한 고유 문항 수) / (전체 문항 수)
    const totalQuestions = questions.reduce((acc, bucket) => acc + ((bucket['문항들'] || []).length), 0);
    const byDate = new Map();
    const seen = new Set();
    finalAnswers
      .filter(r => r && r.date)
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
      .forEach(row => { if (!seen.has(row.id)) { seen.add(row.id); byDate.set(row.date, seen.size); } });
    const keys = Array.from(byDate.keys()).sort();
    const rates = keys.map(k => totalQuestions > 0 ? +((byDate.get(k) / totalQuestions) * 100).toFixed(1) : 0);
    return { keys, rates };
  }

  function renderProgress() {
    const { keys, rates } = buildDailyProgress();
    if (keys.length === 0) {
      progressChart.clear();
      progressChart.setOption({ title: { text: '데이터 없음', left: 'center', top: 'middle', textStyle: { color: '#999' } } });
      return;
    }
    progressChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: keys },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      series: [{ type: 'line', smooth: true, areaStyle: {}, data: rates }],
    });
  }

  // 정답률 분석: 단계적(과목→대분류→중분류→소분류)
  function renderPie() {
    if (logs.length === 0) {
      pieChart.clear();
      pieChart.setOption({ title: { text: '데이터 없음', left: 'center', top: 'middle', textStyle: { color: '#999' } } });
      return;
    }
    const selSubject = document.getElementById('selSubject');
    const selCat = document.getElementById('selCat');
    const selSub = document.getElementById('selSub');

    const chosenSubject = selSubject.value || null;
    const chosenCat = selCat.value || null;
    const chosenSub = selSub.value || null;

    const buckets = questions;
    let segments = [];
    if (!chosenSubject) {
      // 과목별
      const subjects = Array.from(new Set(buckets.map(b => b['과목'])));
      segments = subjects.map(s => ({ key: s, filter: (b,q) => b['과목'] === s }));
    } else if (!chosenCat) {
      const cats = Array.from(new Set(buckets.filter(b => b['과목'] === chosenSubject).map(b => b['대분류'])));
      segments = cats.map(c => ({ key: c, filter: (b,q) => b['과목'] === chosenSubject && b['대분류'] === c }));
    } else if (!chosenSub) {
      const subs = Array.from(new Set(buckets.filter(b => b['과목'] === chosenSubject && b['대분류'] === chosenCat).map(b => b['중분류'])));
      segments = subs.map(su => ({ key: su, filter: (b,q) => b['과목'] === chosenSubject && b['대분류'] === chosenCat && b['중분류'] === su }));
    } else {
      const topics = Array.from(new Set(buckets.filter(b => b['과목'] === chosenSubject && b['대분류'] === chosenCat && b['중분류'] === chosenSub).map(b => b['소분류'])));
      segments = topics.map(t => ({ key: t, filter: (b,q) => b['과목'] === chosenSubject && b['대분류'] === chosenCat && b['중분류'] === chosenSub && b['소분류'] === t }));
    }

    // 각 세그먼트 정답률 = logs에서 해당 범위에 속하는 correct/total 합
    function isInSegment(filter, b, q) { return filter(b, q); }
    const data = segments.map(seg => {
      // 해당 범위의 최종 답안만 사용: 과목/대분류/중분류/소분류 일치하는 것만
      const arr = finalAnswers.filter(r => {
        // segment에 속하는지 판단 위해 질문 메타와 비교
        const matchSeg = (() => {
          if (!chosenSubject) return seg.filter({ '과목': r.subject, '대분류': r.cat, '중분류': r.sub, '소분류': r.topic }, {});
          return seg.filter({ '과목': r.subject, '대분류': r.cat, '중분류': r.sub, '소분류': r.topic }, {});
        })();
        if (!matchSeg) return false;
        if (chosenSubject && r.subject !== chosenSubject) return false;
        if (chosenCat && r.cat !== chosenCat) return false;
        if (chosenSub && r.sub !== chosenSub) return false;
        return true;
      });
      const total = arr.length;
      const correct = arr.reduce((n, x) => n + (x.correct ? 1 : 0), 0);
      const rate = total > 0 ? +((correct / total) * 100).toFixed(1) : 0;
      return { name: seg.key, value: rate };
    });
    const labels = data.map(d => d.name);
    const values = data.map(d => d.value);
    pieChart.clear();
    pieChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c}%' },
      xAxis: { type: 'category', data: labels },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
      series: [{ type: 'bar', data: values, label: { show: true, position: 'top', formatter: '{c}%' } }]
    });
  }

  function renderCounts() {
    // 일자별 고유 문항 수: 같은 날 같은 문항을 여러 번 풀어도 1회로 계산
    const answeredLog = Array.isArray(finalAnswers) ? finalAnswers : [];
    if (answeredLog.length === 0) {
      countChart.clear();
      countChart.setOption({ title: { text: '데이터 없음', left: 'center', top: 'middle', textStyle: { color: '#999' } } });
      return;
    }
    const map = new Map();
    // 날짜별-문항별 set으로 중복 제거
    const dayToSet = new Map();
    answeredLog.forEach(r => {
      const d = r && r.date; const id = r && r.id;
      if (!d || !id) return;
      const s = dayToSet.get(d) || new Set();
      s.add(id);
      dayToSet.set(d, s);
    });
    Array.from(dayToSet.keys()).forEach(k => map.set(k, (dayToSet.get(k) || new Set()).size));
    const keys = Array.from(map.keys()).sort();
    const vals = keys.map(k => map.get(k));
    countChart.setOption({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: keys },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: vals }],
    });
  }

  function wireFilters() {
    const selSubject = document.getElementById('selSubject');
    const selCat = document.getElementById('selCat');
    const selSub = document.getElementById('selSub');
    function fillSubjects() {
      selSubject.innerHTML = '<option value="">과목 선택(전체)</option>';
      const subjects = Array.from(new Set(questions.map(b => b['과목'])));
      subjects.forEach(s => { const o=document.createElement('option'); o.value=s; o.textContent=s; selSubject.appendChild(o); });
      selCat.disabled = true; selSub.disabled = true;
    }
    function onSubject() {
      const s = selSubject.value; selCat.innerHTML = '<option value="">대분류(전체)</option>'; selSub.innerHTML = '<option value="">중분류(전체)</option>';
      if (!s) { selCat.disabled = true; selSub.disabled = true; renderPie(); return; }
      const cats = Array.from(new Set(questions.filter(b => b['과목']===s).map(b => b['대분류'])));
      cats.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; selCat.appendChild(o); }); selCat.disabled=false; selSub.disabled=true; renderPie();
    }
    function onCat() {
      const s = selSubject.value; const c = selCat.value; selSub.innerHTML = '<option value="">중분류(전체)</option>';
      if (!c) { selSub.disabled = true; renderPie(); return; }
      const subs = Array.from(new Set(questions.filter(b => b['과목']===s && b['대분류']===c).map(b => b['중분류'])));
      subs.forEach(x => { const o=document.createElement('option'); o.value=x; o.textContent=x; selSub.appendChild(o); }); selSub.disabled=false; renderPie();
    }
    function onSub() { renderPie(); }
    selSubject.addEventListener('change', onSubject);
    selCat.addEventListener('change', onCat);
    selSub.addEventListener('change', onSub);
    fillSubjects();
  }

  function onResize() { progressChart.resize(); pieChart.resize(); countChart.resize(); }

  async function init() {
    questions = await loadQuestions();
    // 파이어베이스에서만 데이터 사용
    try {
      const fLogs = await window.firebaseData?.fetchLearningLogs?.();
      const fAns = await window.firebaseData?.fetchAnsweredLogs?.();
      const finals = await window.firebaseData?.listFinalAnswers?.();
      logs = Array.isArray(fLogs) ? fLogs : [];
      answeredLogs = Array.isArray(fAns) ? fAns : [];
      finalAnswers = Array.isArray(finals) ? finals : [];
    } catch (_) { logs = []; answeredLogs = []; finalAnswers = []; }
    wireFilters();
    renderProgress();
    renderPie();
    renderCounts();
    // 인증 복구 지연 대비: 초기 데이터가 없으면 한 번 더 재시도
    if (finalAnswers.length === 0) {
      setTimeout(async () => {
        try {
          const finals = await window.firebaseData?.listFinalAnswers?.();
          finalAnswers = Array.isArray(finals) ? finals : finalAnswers;
          renderProgress();
          renderPie();
          renderCounts();
        } catch {}
      }, 1500);
    }
    window.addEventListener('resize', onResize);
  }

  init();
})();


