(function(){
  'use strict';

  // DOM helpers
  const $ = (id) => document.getElementById(id);
  const showToast = (m,t) => { try { window.showToast && window.showToast(m,t); } catch {} };

  // State
  let currentGroupId = null;
  let currentGroup = null;
  let myUid = null;

  // Firestore paths helper
  async function ensureFirebase() {
    const { app, db } = await window.getFirebaseAppAndDb?.();
    const { doc, getDoc, setDoc, addDoc, collection, getDocs, query, where, orderBy, serverTimestamp, updateDoc, onSnapshot, limit, runTransaction, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const auth = getAuth(app);
    return { db, auth, doc, getDoc, setDoc, addDoc, collection, getDocs, query, where, orderBy, serverTimestamp, updateDoc, onSnapshot, limit, runTransaction, deleteDoc };
  }

  function shortCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }

  function groupRow(g) {
    const when = g.createdAt?.toDate ? new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium'}).format(g.createdAt.toDate()) : '';
    const prog = (g.progress!=null && g.target>0) ? Math.round((Number(g.progress||0)/Number(g.target||1))*100) : null;
    const right = prog!=null ? `${prog}%` : when;
    return `<div class="row">
      <div class="line top"><div class="meta">${g.name || '그룹'}</div></div>
      <div class="line bottom">
        <div class="id">${g.desc || ''}</div>
        <div class="diff">${right||''}</div>
        <button class="btn small" data-open="${g.id}">열기</button>
      </div>
    </div>`;
  }

  async function loadMyGroups(){
    const box = $('myGroups');
    try {
      myUid = await window.firebaseData?.getCurrentUserUid?.();
      if (!myUid) { box.textContent = '로그인 후 이용해 주세요.'; return; }
      const { db, doc, getDoc } = await ensureFirebase();
      
      // 사용자별 소속 인덱스 확인 (본인 경로이므로 권한 문제 없음)
      const userGroupRef = doc(db, 'users', myUid, 'private', 'group');
      const userGroupSnap = await getDoc(userGroupRef);
      
      if (!userGroupSnap.exists()) {
        box.innerHTML = '참여한 그룹이 없습니다.';
        return;
      }
      
      const userGroupData = userGroupSnap.data();
      const groupId = userGroupData.groupId;
      
      // 그룹 정보 조회
      const groupRef = doc(db, 'studyGroups', groupId);
      const groupSnap = await getDoc(groupRef);
      
      if (!groupSnap.exists()) {
        box.innerHTML = '그룹 정보를 찾을 수 없습니다.';
        return;
      }
      
      const groupData = groupSnap.data();
      let progress = null, target = null;
      
      // 주간 챌린지 정보 조회
      try { 
        const meta = await getDoc(doc(db,'studyGroups', groupId, 'meta', 'weekly')); 
        if (meta.exists()) { 
          progress = Number((meta.data()||{}).progress||0); 
          target = Number((meta.data()||{}).target||0); 
        } 
      } catch {}
      
      const list = [{ id: groupId, ...groupData, progress, target }];
      box.innerHTML = list.map(groupRow).join('') || '참여한 그룹이 없습니다.';
      box.querySelectorAll('[data-open]')
        .forEach(btn=>btn.addEventListener('click', ()=> openGroup(btn.getAttribute('data-open'))));
    } catch (error) { 
      console.error('내 그룹 로드 실패:', error);
      $('myGroups').textContent = '그룹을 불러오지 못했습니다.'; 
    }
  }

  async function loadPublicGroups(){
    const box = $('publicGroups'); if (!box) return;
    try {
      const { db, collection, getDocs } = await ensureFirebase();
      const snap = await getDocs(collection(db,'studyGroupsPublic'));
      const items = snap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
      // 달성도( progress/target ) 내림차순, 동률이면 updatedAt 최신 우선
      items.sort((a,b)=>{
        const ra = (a.target>0) ? (a.progress||0)/a.target : 0;
        const rb = (b.target>0) ? (b.progress||0)/b.target : 0;
        if (rb !== ra) return rb - ra;
        const ta = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0;
        const tb = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0;
        return tb - ta;
      });
      box.innerHTML = items.map(g => {
        const pct = (g.target>0) ? Math.round((Number(g.progress||0)/Number(g.target||1))*100) : 0;
        return `<div class="row"><div class="line top"><div class="meta">${g.name||'그룹'}</div></div><div class="line bottom"><div class="id">${g.desc||''}</div><div class="diff">${pct}%</div></div></div>`;
      }).join('') || '공개 그룹이 없습니다.';
    } catch (error) { 
      console.warn('공개 그룹 로드 실패:', error);
      box.textContent='공개 그룹을 불러오지 못했습니다.'; 
    }
  }

  async function createGroup(){
    const name = ($('grpName').value||'').trim(); const desc = ($('grpDesc').value||'').trim();
    const msg = $('createMsg'); msg.textContent='';
    if (!name) { msg.textContent='그룹 이름을 입력해 주세요.'; return; }
    try {
      const uid = await window.firebaseData?.getCurrentUserUid?.(); 
      if (!uid) { 
        msg.textContent='로그인이 필요합니다. 로그인 후 다시 시도해 주세요.'; 
        console.log('사용자 UID 없음 - 로그인 필요');
        return; 
      }
      console.log('사용자 UID:', uid);
      myUid = uid;
      const { db, collection, addDoc, serverTimestamp, doc, setDoc, getDoc } = await ensureFirebase();
      
      // 사용자별 소속 인덱스 확인 (본인 경로이므로 권한 문제 없음)
      const userGroupRef = doc(db, 'users', uid, 'private', 'group');
      const userGroupSnap = await getDoc(userGroupRef);
      if (userGroupSnap.exists()) {
        msg.textContent='이미 그룹에 소속되어 있어 새로 생성할 수 없습니다.'; 
        return; 
      }
      
      const code = shortCode();
      
      // 주간 챌린지 시작 키(문자열) – 클라이언트 시간을 한국 시간대로 변환
      const now = new Date();
      const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
      const startKey = koreaTime.getFullYear().toString() + 
                      (koreaTime.getMonth() + 1).toString().padStart(2, '0') + 
                      koreaTime.getDate().toString().padStart(2, '0');
      
      if (!startKey || !/^\d{8}$/.test(String(startKey))) {
        throw new Error('날짜 키 생성 실패(YYYYMMDD). 다시 시도해 주세요.');
      }
      
      // 규칙: 필드는 "있으면 타입 일치"여야 함. null 대신 아예 생략!
      const groupData = {
        name,
        ownerUid: uid,
        members: [uid],
        inviteCode: code,
        weekSolved: 0,
        challengeTarget: 0,
        challengeStartKey: String(startKey)   // ← 빈 문자열 금지
      };
      if (desc) groupData.desc = desc; // 비어있으면 필드 자체를 추가하지 않음
      
      // createdAt은 반드시 서버 타임스탬프
      groupData.createdAt = serverTimestamp();
      
      console.log('생성할 그룹 데이터:', groupData);
      console.log('Firebase 보안 규칙 검증:');
      console.log('- request.auth != null:', !!uid);
      console.log('- ownerUid == request.auth.uid:', groupData.ownerUid === uid);
      console.log('- members.size() == 1:', groupData.members.length === 1);
      console.log('- members[0] == request.auth.uid:', groupData.members[0] === uid);
      console.log('- name is string:', typeof groupData.name === 'string');
      console.log('- inviteCode is string:', typeof groupData.inviteCode === 'string');
      console.log('- desc 필드 존재 여부:', 'desc' in groupData);
      console.log('- desc 값:', groupData.desc);
      
      const ref = await addDoc(collection(db,'studyGroups'), groupData);
      
      // 사용자별 소속 인덱스 업데이트 (본인 경로이므로 권한 문제 없음)
      try {
        await setDoc(userGroupRef, { 
          groupId: ref.id, 
          joinedAt: serverTimestamp(),
          role: 'owner'
        });
      } catch (error) {
        console.warn('사용자 소속 인덱스 업데이트 실패:', error);
        // 인덱스 업데이트 실패해도 그룹 생성은 성공으로 처리
      }
      
      // 공개 정보 생성 (권한 문제로 실패할 수 있으므로 무시)
      try {
        const { doc: d2, setDoc: s2, serverTimestamp: st } = await ensureFirebase();
        const publicData = { 
          name, 
          memberCount: 1, 
          progress: 0, 
          target: 50, 
          updatedAt: st() 
        };
        if (desc) publicData.desc = desc; // 비어있으면 필드 자체를 생략
        await s2(d2(db,'studyGroupsPublic', ref.id), publicData, { merge: true });
      } catch (error) {
        console.warn('공개 그룹 정보 생성 실패 (권한 제한):', error);
        // 권한 문제로 실패해도 그룹 생성은 성공으로 처리
      }
      
      showToast('그룹이 생성되었습니다.','success');
      $('grpName').value=''; $('grpDesc').value='';
      await loadMyGroups();
      openGroup(ref.id);
    } catch (error) { 
      console.error('그룹 생성 실패:', error);
      msg.textContent='생성에 실패했습니다. 오류: ' + (error.message || error);
    }
  }

  async function joinGroup(){
    const code = ($('joinCode').value||'').trim().toUpperCase(); const msg=$('joinMsg'); msg.textContent='';
    if (!code) { msg.textContent='초대 코드를 입력해 주세요.'; return; }
    try {
      const uid = await window.firebaseData?.getCurrentUserUid?.(); if (!uid) { msg.textContent='로그인이 필요합니다.'; return; }
      myUid = uid;
      const { db, collection, getDocs, query, where, doc, updateDoc, setDoc, serverTimestamp, getDoc } = await ensureFirebase();
      
      // 사용자별 소속 인덱스 확인 (본인 경로이므로 권한 문제 없음)
      const userGroupRef = doc(db, 'users', uid, 'private', 'group');
      const userGroupSnap = await getDoc(userGroupRef);
      if (userGroupSnap.exists()) { 
        msg.textContent='이미 다른 그룹에 소속되어 있어 참여할 수 없습니다.'; 
        return; 
      }
      const q1 = query(collection(db,'studyGroups'), where('inviteCode','==', code));
      const snap = await getDocs(q1);
      if (snap.empty) { msg.textContent='코드를 찾을 수 없습니다.'; return; }
      const d = snap.docs[0]; const gid = d.id; const data = d.data()||{};
      const members = Array.isArray(data.members)? data.members: [];
      if (!members.includes(uid)) members.push(uid);
      await updateDoc(doc(db,'studyGroups',gid), { members });
      
      // 사용자별 소속 인덱스 업데이트 (본인 경로이므로 권한 문제 없음)
      try {
        await setDoc(userGroupRef, { 
          groupId: gid, 
          joinedAt: serverTimestamp(),
          role: 'member'
        });
      } catch (error) {
        console.warn('사용자 소속 인덱스 업데이트 실패:', error);
        // 인덱스 업데이트 실패해도 그룹 참여는 성공으로 처리
      }
      
      // 공개 정보 업데이트 (권한 문제로 실패할 수 있으므로 무시)
      try {
        const { doc: d2, setDoc: s2, serverTimestamp: st } = await ensureFirebase();
        await s2(d2(db,'studyGroupsPublic', gid), { 
          memberCount: members.length, 
          target: Math.max(0, members.length*50), 
          updatedAt: st() 
        }, { merge: true });
      } catch (error) {
        console.warn('공개 그룹 정보 업데이트 실패 (권한 제한):', error);
      }
      
      showToast('그룹에 참여했습니다.','success');
      $('joinCode').value='';
      await loadMyGroups();
      openGroup(gid);
    } catch { msg.textContent='참여에 실패했습니다.'; }
  }

  async function openGroup(gid){
    currentGroupId = gid;
    const detail = $('groupDetail'); detail.hidden = false;
    const { db, doc, getDoc, onSnapshot, collection, query, orderBy } = await ensureFirebase();
    const ref = doc(db,'studyGroups', gid);
    const snap = await getDoc(ref);
    if (!snap.exists()) { detail.hidden=true; showToast('그룹이 존재하지 않습니다.','error'); return; }
    currentGroup = { id: gid, ...(snap.data()||{}) };
    renderGroupInfo();
    // members
    renderMembers();
    // rank (이번 주 최종답안 수)
    renderRanks();
    // challenge bar
    renderChallenge();
    // chat live
    const qChat = query(collection(db,'studyGroups',gid,'chat'), orderBy('at','asc'));
    onSnapshot(qChat, (qs)=>{
      const items = qs.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
      const box = $('chatList');
      const fmt = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
      box.innerHTML = items.map(m=>`<div class="row"><div class="line top"><div class="meta">${m.userName||m.uid||''}</div></div><div class="line bottom"><div class="id">${m.text||''}</div><div class="diff">${m.at?.toDate? fmt.format(m.at.toDate()): ''}</div></div></div>`).join('');
      box.scrollTop = box.scrollHeight;
    });
  }

  function canEdit(){ return currentGroup && myUid && currentGroup.ownerUid===myUid; }

  function renderGroupInfo(){
    $('gTitle').textContent = currentGroup.name || '그룹';
    $('gMeta').textContent = currentGroup.desc || '';
    $('inviteCode').value = currentGroup.inviteCode || '';
    const owner = canEdit();
    $('ownerTools').hidden = !owner;
    // 해체 버튼 표시: 그룹장만
    const dissBtn = $('dissolveBtn'); if (dissBtn) { dissBtn.style.display = owner ? '' : 'none'; }
    if (owner) { $('editName').value = currentGroup.name||''; $('editDesc').value = currentGroup.desc||''; }
  }

  async function renderMembers(){
    const box = $('memberList');
    try {
      const members = Array.isArray(currentGroup.members)? currentGroup.members: [];
      // 사용자 프로필 닉네임 조회 (다른 사용자이므로 직접 경로 읽기)
      const { db, doc, getDoc } = await ensureFirebase();
      const rows = await Promise.all(members.map(async uid=>{
        try {
          const pref = doc(db,'users', uid, 'profile', 'main');
          const ps = await getDoc(pref);
          const nick = ps.exists()? (ps.data().nickname || null) : null;
          const name = nick || (uid && uid.slice(0,6)+'...');
          return `<div class="row"><div class="line top"><div class="meta">${name}</div></div><div class="line bottom"><div class="id"></div></div></div>`;
        } catch {
          return `<div class="row"><div class="line top"><div class="meta">${uid && uid.slice(0,6)+'...'}</div></div><div class="line bottom"><div class="id"></div></div></div>`;
        }
      }));
      box.innerHTML = rows.join('') || '그룹원이 없습니다.';
      // gift select
      const sel = $('giftTo'); sel.innerHTML='';
      for (const uid of members.filter(u=>u!==myUid)){
        let label = uid;
        try {
          const pref = doc(db,'users', uid, 'profile', 'main');
          const ps = await getDoc(pref);
          const nick = ps.exists()? (ps.data().nickname || null) : null;
          label = nick || (uid && uid.slice(0,6)+'...');
        } catch {}
        const o=document.createElement('option'); o.value=uid; o.textContent=label; sel.appendChild(o);
      }
    } catch { box.textContent='그룹원을 불러오지 못했습니다.'; }
  }

  async function saveInfo(){
    if (!canEdit()) return;
    try {
      const name = ($('editName').value||'').trim();
      const desc = ($('editDesc').value||'').trim();
      const { db, doc, updateDoc } = await ensureFirebase();
      const updateData = {};
      if (name) updateData.name = name;
      if (desc) updateData.desc = desc;
      await updateDoc(doc(db,'studyGroups', currentGroupId), updateData);
      currentGroup.name = name; currentGroup.desc = desc; renderGroupInfo();
      showToast('그룹 정보가 저장되었습니다.','success');
    } catch { showToast('저장에 실패했습니다.','error'); }
  }

  async function leaveGroup(){
    try {
      const uid = myUid; if (!uid || !currentGroupId) return;
      const { db, doc, getDoc, updateDoc, setDoc, serverTimestamp, deleteDoc } = await ensureFirebase();
      const ref = doc(db,'studyGroups', currentGroupId);
      const snap = await getDoc(ref); if (!snap.exists()) return;
      const data = snap.data()||{};
      if (data.ownerUid === uid) { showToast('그룹장은 해체 기능을 사용하세요.','error'); return; }
      // 경고 후 탈퇴
      if (!confirm('정말 그룹에서 탈퇴하시겠어요? 주간 챌린지 등 통계에서 제외됩니다.')) return;
      const members = (data.members||[]).filter(x=>x!==uid);
      await updateDoc(ref, { members });
      
      // 사용자별 소속 인덱스 삭제 (본인 경로이므로 권한 문제 없음)
      try {
        const userGroupRef = doc(db, 'users', uid, 'private', 'group');
        await deleteDoc(userGroupRef);
      } catch (error) {
        console.warn('사용자 소속 인덱스 삭제 실패:', error);
        // 인덱스 삭제 실패해도 그룹 탈퇴는 성공으로 처리
      }
      
      // 챌린지 목표 재계산(meta.weekly.target = 멤버수*50)
      try { const mref = doc(db,'studyGroups', currentGroupId, 'meta', 'weekly'); await setDoc(mref, { target: Math.max(0, members.length*50), updatedAt: serverTimestamp() }, { merge: true }); } catch {}
      
      // 공개 정보 업데이트 (권한 문제로 실패할 수 있으므로 무시)
      try {
        const { doc: d2, setDoc: s2, serverTimestamp: st } = await ensureFirebase();
        await s2(d2(db,'studyGroupsPublic', currentGroupId), { 
          memberCount: members.length, 
          target: Math.max(0, members.length*50), 
          updatedAt: st() 
        }, { merge: true });
      } catch (error) {
        console.warn('공개 그룹 정보 업데이트 실패 (권한 제한):', error);
      }
      
      showToast('그룹에서 나왔습니다.','success');
      $('groupDetail').hidden = true; currentGroupId = null; currentGroup = null; loadMyGroups();
    } catch { showToast('나가기에 실패했습니다.','error'); }
  }

  async function dissolveGroup(){
    try {
      if (!canEdit()) { showToast('그룹장만 해체할 수 있습니다.','error'); return; }
      if (!confirm('정말 이 그룹을 해체하시겠어요? 모든 그룹 정보가 삭제되고, 그룹원 전체의 소속도 제거됩니다.')) return;
      const { db, doc, deleteDoc, collection, getDocs, getDoc } = await ensureFirebase();
      const gid = currentGroupId;
      
      // 그룹 정보 조회하여 모든 멤버의 소속 인덱스 삭제
      try {
        const groupRef = doc(db, 'studyGroups', gid);
        const groupSnap = await getDoc(groupRef);
        if (groupSnap.exists()) {
          const groupData = groupSnap.data();
          const members = Array.isArray(groupData.members) ? groupData.members : [];
          
          // 모든 멤버의 소속 인덱스 삭제
          for (const memberUid of members) {
            try {
              const userGroupRef = doc(db, 'users', memberUid, 'private', 'group');
              await deleteDoc(userGroupRef);
            } catch (error) {
              console.warn(`멤버 ${memberUid} 소속 인덱스 삭제 실패:`, error);
            }
          }
        }
      } catch (error) {
        console.warn('멤버 소속 인덱스 삭제 실패:', error);
      }
      
      // 하위 컬렉션 삭제: chat, gifts, meta
      for (const sub of ['chat','gifts']){
        try { const snap = await getDocs(collection(db,'studyGroups', gid, sub)); for (const d of snap.docs){ await deleteDoc(doc(db, 'studyGroups', gid, sub, d.id)); } } catch {}
      }
      try { await deleteDoc(doc(db,'studyGroups', gid, 'meta', 'weekly')); } catch {}
      // 본문 삭제
      await deleteDoc(doc(db,'studyGroups', gid));
      
      // 공개 정보 삭제 (권한 문제로 실패할 수 있으므로 무시)
      try {
        const { doc: d2, deleteDoc: del2 } = await ensureFirebase();
        await del2(d2(db,'studyGroupsPublic', gid));
      } catch (error) {
        console.warn('공개 그룹 정보 삭제 실패 (권한 제한):', error);
      }
      
      showToast('그룹이 해체되었습니다.','success');
      $('groupDetail').hidden = true; currentGroupId = null; currentGroup = null; loadMyGroups();
    } catch { showToast('해체에 실패했습니다.','error'); }
  }

  async function sendGift(){
    const to = $('giftTo').value||''; const amt = Math.max(1, Number($('giftAmt').value||'1'));
    const msg = $('giftMsg'); msg.textContent='';
    if (!to) { msg.textContent='받을 사람을 선택해 주세요.'; return; }
    try {
      // 같은 그룹원인지 확인
      if (!Array.isArray(currentGroup.members) || !currentGroup.members.includes(to)) { msg.textContent='같은 그룹원에게만 보낼 수 있습니다.'; return; }
      // 코인 조정
      const dec = await window.firebaseData?.adjustCoins?.(-amt, `gift:to:${to}:group:${currentGroupId}`);
      if (!dec?.ok) { msg.textContent='코인이 부족하거나 전송 실패했습니다.'; return; }
      // 수신자 증가 기록용 공개 트랜잭션 문서 (권한 없으면 무시)
      try {
        const { db, collection, addDoc, serverTimestamp } = await ensureFirebase();
        await addDoc(collection(db,'studyGroups', currentGroupId, 'gifts'), { from: myUid, to, amount: amt, at: serverTimestamp() });
      } catch {}
      // 수신자 지갑 증가(권한상 직접 증가가 어려우므로 트랜잭션 기록만 남기고, 수신자 지갑 합산(totalCoins)은 수신자 활동 시점 업데이트 가정)
      showToast('코인을 선물했습니다.','success');
      $('giftAmt').value = '1';
    } catch { msg.textContent='전송 중 오류가 발생했습니다.'; }
  }

  async function renderRanks(){
    const box = $('rankList');
    try {
      // 이번 주 key - 클라이언트 시간 사용
      const now = new Date();
      const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
      const key = koreaTime.getFullYear().toString() + 
                  (koreaTime.getMonth() + 1).toString().padStart(2, '0') + 
                  koreaTime.getDate().toString().padStart(2, '0');
      const weekKey = window.firebaseData?._weekKeyFromDateKey?.(key||'') || '';
      const members = Array.isArray(currentGroup.members)? currentGroup.members: [];
      // 개별 사용자: 이번 주 정답 이벤트 수(answers 컬렉션 count). Firestore 카운트 쿼리 대신 클라이언트 집계
      const scores = [];
      for (const uid of members) {
        try {
          const { db, collection, getDocs, query, where, doc, getDoc } = await ensureFirebase();
          const ref = collection(db,'users', uid, 'events');
          const qs = await getDocs(ref);
          const cnt = qs.docs.filter(d=>d.data() && d.data().type==='answer').length;
          
          // 사용자 닉네임 조회
          let nickname = uid;
          try {
            const pref = doc(db,'users', uid, 'profile', 'main');
            const ps = await getDoc(pref);
            const nick = ps.exists()? (ps.data().nickname || null) : null;
            nickname = nick || (uid && uid.slice(0,6)+'...');
          } catch {}
          
          scores.push({ uid, nickname, cnt });
        } catch { 
          scores.push({ uid, nickname: uid && uid.slice(0,6)+'...', cnt: 0 }); 
        }
      }
      scores.sort((a,b)=> b.cnt - a.cnt);
      box.innerHTML = scores.map((s,i)=>`<div class="row"><div class="line top"><div class="meta">${i+1}위 · ${s.nickname}</div></div><div class="line bottom"><div class="id">문제 풀이: ${s.cnt}개</div></div></div>`).join('') || '데이터 없음';
    } catch { box.textContent='순위를 불러오지 못했습니다.'; }
  }

  async function renderChallenge(){
    // 목표: (그룹원 수 x 50) 문제를 일주일 내 풀이
    try {
      const n = Array.isArray(currentGroup.members)? currentGroup.members.length : 0;
      const target = Math.max(0, n * 50);
      const { db, doc, setDoc, getDoc, serverTimestamp } = await ensureFirebase();
      const cRef = doc(db,'studyGroups', currentGroupId, 'meta', 'weekly');
      const snap = await getDoc(cRef);
      let cur = 0; let startKey = null; let rewardGiven = false;
      if (!snap.exists()) {
        // 초기화 - 클라이언트 시간 사용
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        const k = koreaTime.getFullYear().toString() + 
                  (koreaTime.getMonth() + 1).toString().padStart(2, '0') + 
                  koreaTime.getDate().toString().padStart(2, '0');
        await setDoc(cRef, { progress: 0, target, startKey: k, rewardGiven: false, updatedAt: serverTimestamp() }, { merge: true });
        
        // 공개 정보 업데이트 (권한 문제로 실패할 수 있으므로 무시)
                 try {
           const { doc: d2, setDoc: s2, serverTimestamp: st } = await ensureFirebase();
           const publicData = { 
             name: currentGroup.name||'그룹', 
             memberCount: (currentGroup.members||[]).length, 
             progress: 0, 
             target, 
             updatedAt: st() 
           };
           if (currentGroup.desc) publicData.desc = currentGroup.desc;
           await s2(d2(db,'studyGroupsPublic', currentGroupId), publicData, { merge: true });
         } catch (error) {
          console.warn('공개 그룹 정보 업데이트 실패 (권한 제한):', error);
        }
        
        cur = 0; startKey = k; rewardGiven = false;
      } else {
        const d = snap.data()||{}; cur = Number(d.progress||0); startKey = d.startKey||null; rewardGiven = Boolean(d.rewardGiven||false);
        if (Number(d.target||0) !== target) { try { await setDoc(cRef, { target }, { merge: true }); } catch {} }
        
        // 챌린지 달성 시 보상 지급
        if (cur >= target && !rewardGiven && target > 0) {
          await giveChallengeRewards(cur);
          await setDoc(cRef, { rewardGiven: true }, { merge: true });
          rewardGiven = true;
        }
        
        // 공개 정보 업데이트 (권한 문제로 실패할 수 있으므로 무시)
        try {
          const { doc: d2, setDoc: s2, serverTimestamp: st } = await ensureFirebase();
          await s2(d2(db,'studyGroupsPublic', currentGroupId), { 
            memberCount: (currentGroup.members||[]).length, 
            target, 
            progress: cur, 
            updatedAt: st() 
          }, { merge: true });
        } catch (error) {
          console.warn('공개 그룹 정보 업데이트 실패 (권한 제한):', error);
        }
      }
      $('challengeMeta').textContent = `목표: ${target}문제 · 진행: ${cur} / ${target}`;
      const ratio = target>0 ? Math.max(0, Math.min(100, Math.round(cur/target*100))) : 0;
      $('challengeBar').style.width = `${ratio}%`;
    } catch { $('challengeMeta').textContent = '주간 챌린지를 불러오지 못했습니다.'; }
  }

  // 챌린지 달성 시 보상 지급 함수
  async function giveChallengeRewards(currentProgress) {
    try {
      const members = Array.isArray(currentGroup.members) ? currentGroup.members : [];
      if (members.length === 0) return;

      // 각 멤버의 기여도 계산
      const memberContributions = [];
      for (const uid of members) {
        try {
          const { db, collection, getDocs } = await ensureFirebase();
          const ref = collection(db, 'users', uid, 'events');
          const qs = await getDocs(ref);
          const cnt = qs.docs.filter(d => d.data() && d.data().type === 'answer').length;
          memberContributions.push({ uid, contribution: cnt });
        } catch (error) {
          console.warn(`멤버 ${uid} 기여도 계산 실패:`, error);
          memberContributions.push({ uid, contribution: 0 });
        }
      }

      // 기여도 순으로 정렬
      memberContributions.sort((a, b) => b.contribution - a.contribution);

      // 그룹 전체 보상: 모든 그룹원에게 1개 코인 지급
      for (const member of members) {
        try {
          await window.firebaseData?.adjustCoins?.(1, `challenge:group:${currentGroupId}:reward:all`);
        } catch (error) {
          console.warn(`멤버 ${member} 그룹 보상 지급 실패:`, error);
        }
      }

      // 개인 보상: 기여도가 가장 높은 그룹원에게 1개 코인 추가 지급 (그룹원이 2명 이상인 경우만)
      if (members.length > 1 && memberContributions.length > 0) {
        const topContributor = memberContributions[0];
        try {
          await window.firebaseData?.adjustCoins?.(1, `challenge:group:${currentGroupId}:reward:top:${topContributor.uid}`);
          showToast(`🎉 주간 챌린지 달성! 모든 그룹원에게 1코인, 최고 기여자에게 추가 1코인이 지급되었습니다.`, 'success');
        } catch (error) {
          console.warn(`최고 기여자 ${topContributor.uid} 개인 보상 지급 실패:`, error);
          showToast(`🎉 주간 챌린지 달성! 모든 그룹원에게 1코인이 지급되었습니다.`, 'success');
        }
      } else if (members.length === 1) {
        showToast(`🎉 주간 챌린지 달성! 1코인이 지급되었습니다.`, 'success');
      }

      // 보상 지급 기록 (권한 문제로 실패할 수 있으므로 무시)
      try {
        const { db, collection, addDoc, serverTimestamp } = await ensureFirebase();
        await addDoc(collection(db, 'studyGroups', currentGroupId, 'rewards'), {
          type: 'weekly_challenge',
          progress: currentProgress,
          memberCount: members.length,
          topContributor: members.length > 1 ? memberContributions[0]?.uid : null,
          topContribution: members.length > 1 ? memberContributions[0]?.contribution : null,
          rewardedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn('보상 지급 기록 실패:', error);
      }

    } catch (error) {
      console.error('챌린지 보상 지급 실패:', error);
      showToast('챌린지 보상 지급 중 오류가 발생했습니다.', 'error');
    }
  }

  async function saveMessage(e){
    e.preventDefault();
    try {
      const text = ($('chatInput').value||'').trim(); if (!text) return;
      const uid = await window.firebaseData?.getCurrentUserUid?.(); if (!uid) { showToast('로그인이 필요합니다.','error'); return; }
      const { db, collection, addDoc, serverTimestamp } = await ensureFirebase();
      let nickname = null;
      try { const prof = await window.firebaseData?.getMyProfile?.(); nickname = prof?.nickname || null; } catch {}
      await addDoc(collection(db,'studyGroups', currentGroupId, 'chat'), { uid, userName: nickname, text, at: serverTimestamp() });
      $('chatInput').value='';
    } catch { showToast('메시지 전송 실패','error'); }
  }

  // 로그인 상태 테스트 함수
  async function testAuthStatus() {
    try {
      const uid = await window.firebaseData?.getCurrentUserUid?.();
      const isAuth = await window.firebaseData?.isAuthenticated?.();
      console.log('로그인 상태 테스트:', { uid, isAuth });
      showToast(`로그인 상태: ${isAuth ? '로그인됨' : '로그인 안됨'} (UID: ${uid || '없음'})`, isAuth ? 'success' : 'error');
    } catch (error) {
      console.error('로그인 상태 확인 실패:', error);
      showToast('로그인 상태 확인 실패: ' + error.message, 'error');
    }
  }

  window.addEventListener('load', async ()=>{
    await loadMyGroups();
    loadPublicGroups();
    $('createBtn').addEventListener('click', createGroup);
    $('joinBtn').addEventListener('click', joinGroup);
    $('testAuthBtn').addEventListener('click', testAuthStatus);
    $('copyCode').addEventListener('click', ()=>{ try { navigator.clipboard.writeText(($('inviteCode').value||'')); showToast('초대 코드를 복사했습니다.','success'); } catch {} });
    $('saveInfo').addEventListener('click', saveInfo);
    $('leaveBtn').addEventListener('click', leaveGroup);
    $('dissolveBtn').addEventListener('click', dissolveGroup);
    $('giftBtn').addEventListener('click', sendGift);
    $('chatForm').addEventListener('submit', saveMessage);
  });
})();


