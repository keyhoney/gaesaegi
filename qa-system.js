(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const toast = (m,t)=>{ try{ window.showToast && window.showToast(m,t);}catch{} };

  // Firebase helpers
  async function ensureFirebase(){
    const { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy, limit, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const { app, db } = await window.getFirebaseAppAndDb();
    const auth = getAuth(app);
    return { db, auth, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy, limit, serverTimestamp };
  }

  // Load questions.json options
  let dataset = [];
  async function loadQuestions(){
    try { const r = await fetch('questions.json',{ cache:'no-store' }); return r.ok? await r.json(): []; } catch { return []; }
  }
  function unique(arr){ return Array.from(new Set(arr)); }
  function fillSelect(el, items, placeholder){ el.innerHTML = ''; const o = document.createElement('option'); o.value=''; o.textContent=placeholder; el.appendChild(o); items.forEach(v=>{ const op=document.createElement('option'); op.value=v; op.textContent=v; el.appendChild(op); }); }

  function buildHierarchy(data){
    return {
      subjects: unique(data.map(x=>x['과목'])).sort(),
      cats: (s)=> unique(data.filter(x=>x['과목']===s).map(x=>x['대분류'])).sort(),
      subs: (s,c)=> unique(data.filter(x=>x['과목']===s && x['대분류']===c).map(x=>x['중분류'])).sort(),
      topics: (s,c,m)=> unique(data.filter(x=>x['과목']===s && x['대분류']===c && x['중분류']===m).map(x=>x['소분류'])).sort(),
      questions: (s,c,m,t)=>{
        const b = data.find(x=>x['과목']===s && x['대분류']===c && x['중분류']===m && x['소분류']===t);
        return (b?.['문항들']||[]).map(q=>q['문항번호']);
      }
    };
  }

  function nicknameFromProfileDoc(data, uid){
    const n = data?.nickname || null; return n || (uid? uid.slice(0,6)+'...':'사용자');
  }

  // Render question list
  function questionRow(q){
    const when = q.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium', timeStyle:'short'}).format(q.createdAt.toDate()) : '';
    const tags = (q.tags||[]).map(t=>`#${t}`).join(' ');
    const accepted = q.acceptedAnswerId ? '채택됨' : '미채택';
    const answers = q.answers || 0;
    const statusClass = q.acceptedAnswerId ? 'status-accepted' : 'status-pending';
    return `<div class="row question-row">
      <div class="question-main">
        <div class="question-title">${q.title||'질문'}</div>
        <div class="question-meta">
          <span class="question-tags">${tags}</span>
          <span class="question-status ${statusClass}">${accepted}</span>
          <span class="question-answers">답변 ${answers}개</span>
          <span class="question-date">${when}</span>
        </div>
      </div>
      <div class="question-actions">
        <button class="btn small" data-open="${q.id}">열기</button>
      </div>
    </div>`;
  }

  let currentQuestion = null; let myUid = null;

  async function loadRanks(){
    const box = $('rankUsers'); if (!box) return;
    try {
      const { db, collection, getDocs } = await ensureFirebase();
      const usersSnap = await getDocs(collection(db,'qaStats'));
      const list = usersSnap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
      list.sort((a,b)=> (Number(b.accepted||0) - Number(a.accepted||0)) || (Number(b.answers||0) - Number(a.answers||0)) || (Number(b.questions||0) - Number(a.questions||0)) );
      const rows = await Promise.all(list.slice(0,20).map(async u=>{
        try { const prof = await getUserProfile(u.id); const name = nicknameFromProfileDoc(prof, u.id); return `<div class="row"><div class="line top"><div class="meta">${name}</div></div><div class="line bottom"><div class="id">질문 ${u.questions||0} · 답변 ${u.answers||0} · 채택 ${u.accepted||0}</div></div></div>`; } catch { return `<div class="row"><div class="line top"><div class="meta">${u.id}</div></div><div class="line bottom"><div class="id">질문 ${u.questions||0} · 답변 ${u.answers||0} · 채택 ${u.accepted||0}</div></div></div>`; }
      }));
      box.innerHTML = rows.join('') || '데이터 없음';
    } catch { box.textContent='랭킹을 불러오지 못했습니다.'; }
  }

  async function getUserProfile(uid){
    const { db, doc, getDoc } = await ensureFirebase();
    const ref = doc(db,'users', uid, 'profile', 'main');
    const snap = await getDoc(ref); return snap.exists()? (snap.data()||{}) : null;
  }

  async function postQuestion(){
    const title = $('qTitle').value.trim(); const body = $('qBody').value.trim(); const tags = $('qTags').value.split(',').map(s=>s.trim()).filter(Boolean);
    const s = $('selSubject').value; const c=$('selCat').value; const m=$('selSub').value; const t=$('selTopic').value; const q=$('selQuestion').value;
    const msg = $('askMsg'); msg.textContent='';
    try {
      const uid = await window.firebaseData?.getCurrentUserUid?.(); if (!uid) { msg.textContent='로그인이 필요합니다.'; return; }
      if (!title) { msg.textContent='제목을 입력해 주세요.'; return; }
      const { db, collection, addDoc, serverTimestamp } = await ensureFirebase();
      const ref = await addDoc(collection(db,'qaQuestions'), {
        uid, title, body: body||null, tags, subject: s||null, cat: c||null, sub: m||null, topic: t||null, qid: q||null,
        answers: 0, votes: 0, acceptedAnswerId: null, createdAt: serverTimestamp()
      });
      try { await bumpStats(uid, 'questions', 1); } catch {}
      toast('질문이 등록되었습니다.','success');
      $('qTitle').value=''; $('qBody').value=''; $('qTags').value='';
      loadQuestionsList();
    } catch { msg.textContent='등록에 실패했습니다.'; }
  }

  async function bumpStats(uid, field, delta){
    try {
      const { db, doc, setDoc, getDoc } = await ensureFirebase();
      const r = doc(db,'qaStats', uid);
      const s = await getDoc(r);
      const cur = s.exists()? (s.data()||{}) : {};
      const next = { questions: Number(cur.questions||0), answers: Number(cur.answers||0), accepted: Number(cur.accepted||0) };
      next[field] = Number(next[field]||0) + Number(delta||0);
      await setDoc(r, next, { merge: true });
    } catch {}
  }

  async function loadQuestionsList(){
    const box = $('questionList');
    try {
      const { db, collection, getDocs, query, orderBy } = await ensureFirebase();
      const qs = await getDocs(query(collection(db,'qaQuestions'), orderBy('createdAt','desc')));
      const list = qs.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
      // 검색/필터/정렬
      const text = ($('searchBox').value||'').trim().toLowerCase();
      const fsub = $('filterSubject').value||''; const facc = $('filterAccepted').value||''; const sort = $('sortBy').value||'new';
      let view = list.filter(q=>{
        const hay = `${q.title||''} ${q.body||''} ${(q.tags||[]).join(' ')}`.toLowerCase();
        if (text && !hay.includes(text)) return false;
        if (fsub && q.subject !== fsub) return false;
        if (facc === 'accepted' && !q.acceptedAnswerId) return false;
        if (facc === 'not' && q.acceptedAnswerId) return false;
        return true;
      });
      if (sort === 'popular') view.sort((a,b)=> Number(b.answers||0) - Number(a.answers||0));
      box.innerHTML = view.map(questionRow).join('') || '질문이 없습니다.';
      box.querySelectorAll('[data-open]').forEach(btn=>btn.addEventListener('click', ()=> openDetail(btn.getAttribute('data-open'))));
    } catch { box.textContent='질문을 불러오지 못했습니다.'; }
  }

  async function openDetail(qid){
    const card = $('detailCard'); card.hidden = false; $('answers').innerHTML='';
    const { db, doc, getDoc, collection, getDocs, query, orderBy } = await ensureFirebase();
    const qRef = doc(db,'qaQuestions', qid); const qs = await getDoc(qRef);
    if (!qs.exists()) { card.hidden=true; return; }
    currentQuestion = { id: qid, ...(qs.data()||{}) };
    $('dTitle').textContent = currentQuestion.title || '질문';
    try { const prof = await getUserProfile(currentQuestion.uid); const name = nicknameFromProfileDoc(prof, currentQuestion.uid); $('dMeta').textContent = `${name}`; } catch { $('dMeta').textContent = currentQuestion.uid; }
    $('dBody').textContent = currentQuestion.body || '';
    const meta = [];
    if (currentQuestion.subject) meta.push(currentQuestion.subject);
    if (currentQuestion.cat) meta.push(currentQuestion.cat);
    if (currentQuestion.sub) meta.push(currentQuestion.sub);
    if (currentQuestion.topic) meta.push(currentQuestion.topic);
    if (currentQuestion.qid) meta.push(`문항: ${currentQuestion.qid}`);
    $('dProblem').textContent = meta.join(' / ');
    const actions = $('dActions'); actions.innerHTML='';
    if (!currentQuestion.acceptedAnswerId) {
      actions.innerHTML = `<div class="muted">채택된 답변이 없습니다.</div>`;
    } else {
      actions.innerHTML = `<div class="muted">채택 완료</div>`;
    }

    // load answers
    const list = await getDocs(query(collection(db,'qaQuestions', qid, 'answers'), orderBy('createdAt','asc')));
    const rows = await Promise.all(list.docs.map(async d=>{
      const a = { id:d.id, ...(d.data()||{}) };
      const prof = await getUserProfile(a.uid).catch(()=>null);
      const name = nicknameFromProfileDoc(prof, a.uid);
      const canEdit = (myUid && myUid===a.uid);
      const canAccept = (myUid && myUid===currentQuestion.uid && !currentQuestion.acceptedAnswerId);
      const acceptBtn = canAccept ? `<button class="btn small" data-accept="${a.id}">채택</button>` : '';
      const editBtn = canEdit ? `<button class="btn small" data-edit="${a.id}">수정</button>` : '';
      const when = a.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short'}).format(a.createdAt.toDate()) : '';
      const accepted = (currentQuestion.acceptedAnswerId===a.id) ? ' · 채택됨' : '';
      return `<div class="row"><div class="line top"><div class="meta">${name}${accepted}</div></div><div class="line bottom"><div class="id">${a.body||''}</div><div class="diff">${when}</div><div class="actions">${acceptBtn}${editBtn}</div></div></div>`;
    }));
    $('answers').innerHTML = rows.join('') || '첫 번째 답변을 작성해 보세요.';
    $('answers').querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click', ()=> editAnswer(btn.getAttribute('data-edit'))));
    $('answers').querySelectorAll('[data-accept]').forEach(btn=>btn.addEventListener('click', ()=> acceptAnswer(btn.getAttribute('data-accept'))));
  }

  async function submitAnswer(e){
    e.preventDefault(); const msg = $('answerMsg'); msg.textContent='';
    try {
      const body = $('answerInput').value.trim(); if (!body) return;
      const uid = await window.firebaseData?.getCurrentUserUid?.(); if (!uid) { msg.textContent='로그인이 필요합니다.'; return; }
      const { db, collection, addDoc, serverTimestamp, doc, updateDoc } = await ensureFirebase();
      await addDoc(collection(db,'qaQuestions', currentQuestion.id, 'answers'), { uid, body, createdAt: serverTimestamp() });
      await updateDoc(doc(db,'qaQuestions', currentQuestion.id), { answers: Number(currentQuestion.answers||0) + 1 });
      currentQuestion.answers = Number(currentQuestion.answers||0) + 1;
      try { await bumpStats(uid, 'answers', 1); } catch {}
      $('answerInput').value=''; toast('답변이 등록되었습니다.','success');
      openDetail(currentQuestion.id);
    } catch { msg.textContent='등록에 실패했습니다.'; }
  }

  async function editAnswer(aid){
    const body = prompt('답변 내용을 수정하세요'); if (body==null) return;
    try {
      const uid = await window.firebaseData?.getCurrentUserUid?.();
      const { db, doc, getDoc, updateDoc } = await ensureFirebase();
      const r = doc(db,'qaQuestions', currentQuestion.id, 'answers', aid);
      const s = await getDoc(r); const d = s.data()||{}; if (d.uid !== uid) { toast('본인 답변만 수정할 수 있습니다.','error'); return; }
      await updateDoc(r, { body: String(body) }); toast('수정되었습니다.','success'); openDetail(currentQuestion.id);
    } catch { toast('수정에 실패했습니다.','error'); }
  }

  async function acceptAnswer(aid){
    if (!confirm('이 답변을 채택하시겠어요?')) return;
    try {
      const uid = await window.firebaseData?.getCurrentUserUid?.(); if (!uid) { toast('로그인이 필요합니다.','error'); return; }
      if (uid !== currentQuestion.uid) { toast('작성자만 채택할 수 있습니다.','error'); return; }
      const { db, doc, updateDoc, getDoc } = await ensureFirebase();
      await updateDoc(doc(db,'qaQuestions', currentQuestion.id), { acceptedAnswerId: aid });
      // 채택 통계 가산
      const aRef = doc(db,'qaQuestions', currentQuestion.id, 'answers', aid);
      const aSnap = await getDoc(aRef); const a = aSnap.data()||{}; const auid = a.uid; if (auid) { try { await bumpStats(auid, 'accepted', 1); } catch {} }
      toast('채택되었습니다.','success'); openDetail(currentQuestion.id);
    } catch { toast('채택에 실패했습니다.','error'); }
  }

  function wireFilters(h){
    const fs = $('filterSubject'); fillSelect(fs, h.subjects, '과목(전체)');
    $('searchBox').addEventListener('input', loadQuestionsList);
    fs.addEventListener('change', loadQuestionsList);
    $('filterAccepted').addEventListener('change', loadQuestionsList);
    $('sortBy').addEventListener('change', loadQuestionsList);
  }

  function wireAsk(h){
    const s=$('selSubject'), c=$('selCat'), m=$('selSub'), t=$('selTopic'), q=$('selQuestion');
    fillSelect(s, h.subjects, '과목');
    s.addEventListener('change', ()=>{ fillSelect(c, h.cats(s.value), '대분류'); c.disabled=false; fillSelect(m, [], '중분류'); m.disabled=true; fillSelect(t, [], '소분류'); t.disabled=true; fillSelect(q, [], '개별 문항'); q.disabled=true; });
    c.addEventListener('change', ()=>{ fillSelect(m, h.subs(s.value, c.value), '중분류'); m.disabled=false; fillSelect(t, [], '소분류'); t.disabled=true; fillSelect(q, [], '개별 문항'); q.disabled=true; });
    m.addEventListener('change', ()=>{ fillSelect(t, h.topics(s.value, c.value, m.value), '소분류'); t.disabled=false; fillSelect(q, [], '개별 문항'); q.disabled=true; });
    t.addEventListener('change', ()=>{ fillSelect(q, h.questions(s.value, c.value, m.value, t.value), '개별 문항'); q.disabled=false; });
    $('postQuestion').addEventListener('click', postQuestion);
  }

  // 로그인 상태 확인 및 UI 업데이트
  async function updateLoginStatus() {
    try {
      myUid = await window.firebaseData?.getCurrentUserUid?.();
      const isLoggedIn = !!myUid;
      
      // 질문 작성 폼 상태 업데이트
      const postBtn = $('postQuestion');
      if (postBtn) {
        if (isLoggedIn) {
          postBtn.textContent = '질문 올리기';
          postBtn.disabled = false;
          postBtn.className = 'btn primary';
        } else {
          postBtn.textContent = '로그인 후 질문 작성';
          postBtn.disabled = true;
          postBtn.className = 'btn ghost';
        }
      }
      
      // 답변 폼 상태 업데이트
      const answerInput = $('answerInput');
      const answerSubmitBtn = $('answerForm')?.querySelector('button[type="submit"]');
      if (answerInput && answerSubmitBtn) {
        if (isLoggedIn) {
          answerInput.placeholder = '답변을 입력하세요';
          answerSubmitBtn.textContent = '등록';
          answerSubmitBtn.disabled = false;
          answerSubmitBtn.className = 'btn primary';
        } else {
          answerInput.placeholder = '로그인 후 답변을 작성할 수 있습니다';
          answerSubmitBtn.textContent = '로그인 필요';
          answerSubmitBtn.disabled = true;
          answerSubmitBtn.className = 'btn ghost';
        }
      }
      
      // 로그인 안내 메시지 표시/숨김
      const loginNotice = $('loginNotice');
      if (loginNotice) {
        loginNotice.style.display = isLoggedIn ? 'none' : 'block';
      }
      
    } catch (error) {
      console.error('로그인 상태 확인 실패:', error);
    }
  }

  window.addEventListener('load', async ()=>{
    dataset = await loadQuestions(); const h = buildHierarchy(dataset);
    wireAsk(h); wireFilters(h); loadQuestionsList(); loadRanks();
    
    // 초기 로그인 상태 확인
    await updateLoginStatus();
    
    // 로그인 상태 변경 감지 (firebase-data.js에서 제공하는 경우)
    if (window.firebaseData?.onAuthStateChanged) {
      window.firebaseData.onAuthStateChanged(updateLoginStatus);
    }
    
    $('answerForm').addEventListener('submit', submitAnswer);
  });
})();


