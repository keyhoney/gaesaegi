(function () {
  'use strict';

  // Firebase만 사용

  const $tabs = document.querySelectorAll('.tab');
  const $favTab = document.getElementById('favTab');
  const $wrongTab = document.getElementById('wrongTab');
  const $favList = document.getElementById('favList');
  const $wrongList = document.getElementById('wrongList');

  async function listFavIds() { try { return await window.firebaseData?.listFavorites?.() || []; } catch (_) { return []; } }
  async function listWrongIds() { try { return await window.firebaseData?.listWrongs?.() || []; } catch (_) { return []; } }
  async function getAllFavoriteMemos() { try { return await window.firebaseData?.getAllFavoriteMemos?.() || {}; } catch (_) { return {}; } }

  function loadData() {
    return fetch('questions.json', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('로드 실패'); return r.json(); });
  }

  function findQuestionMetaIndex(dataset) {
    // id -> {과목,대분류,중분류,소분류,난이도,문항주소,해설주소}
    const map = new Map();
    dataset.forEach(bucket => {
      const subject = bucket['과목'];
      const cat = bucket['대분류'];
      const sub = bucket['중분류'];
      const topic = bucket['소분류'];
      (bucket['문항들'] || []).forEach(q => {
        map.set(q['문항번호'], {
          subject, cat, sub, topic,
          difficulty: q['난이도'] || '',
          img: q['문항주소'] || '',
          solution: q['해설주소'] || ''
        });
      });
    });
    return map;
  }

  function makeLink(m, id) {
    const q = new URLSearchParams({
      subject: m.subject,
      cat: m.cat,
      sub: m.sub,
      topic: m.topic,
      qid: id,
    });
    return `individual-study.html?${q.toString()}`;
  }

  async function renderFav(list, meta, memos = {}) {
    $favList.innerHTML = '';
    if (list.size === 0) { $favList.textContent = '즐겨찾기한 문항이 없습니다.'; return; }
    list.forEach(id => {
      const m = meta.get(id);
      if (!m) return;
      const memo = memos[id] || '';
      const hasMemo = memo.trim().length > 0;
      const row = document.createElement('div');
      row.className = `row ${hasMemo ? 'has-memo' : ''}`;
      row.innerHTML = `
        <div class="line top">
          <div class="meta">${m.subject} / ${m.cat} / ${m.sub} / ${m.topic}</div>
          ${hasMemo ? '<div class="memo-indicator" title="메모 있음">📝</div>' : ''}
        </div>
        <div class="line bottom">
          <div class="id">${id}</div>
          <div class="diff">${m.difficulty}</div>
          <div class="actions">
            <a class="btn ghost small" href="${makeLink(m, id)}" target="_self">문제 보기</a>
            <button type="button" class="btn small memo-btn" data-id="${id}">메모</button>
            <button type="button" class="btn small remove-fav" data-id="${id}">삭제</button>
          </div>
        </div>
        ${hasMemo ? `<div class="memo-preview">${memo}</div>` : ''}
      `;
      
      const rm = row.querySelector('.remove-fav');
      rm.addEventListener('click', async () => {
        await window.firebaseData?.removeFavorite?.(id);
        const ids = await listFavIds();
        const memos = await getAllFavoriteMemos();
        renderFav(new Set(ids), meta, memos);
      });
      
      const memoBtn = row.querySelector('.memo-btn');
      memoBtn.addEventListener('click', () => {
        showMemoDialog(id, memo, meta, list);
      });
      
      $favList.appendChild(row);
    });
  }

  function renderWrong(list, meta) {
    $wrongList.innerHTML = '';
    if (list.size === 0) { $wrongList.textContent = '오답 문항이 없습니다.'; return; }
    list.forEach(id => {
      const m = meta.get(id);
      if (!m) return;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="line top"><div class="meta">${m.subject} / ${m.cat} / ${m.sub} / ${m.topic}</div></div>
        <div class="line bottom"><div class="id">${id}</div><div class="diff">${m.difficulty}</div><div class="actions"><a class="btn ghost small" href="${makeLink(m, id)}" target="_self">문제 보기</a></div></div>
      `;
      $wrongList.appendChild(row);
    });
  }

  function showMemoDialog(qid, currentMemo, meta, list) {
    const m = meta.get(qid);
    if (!m) return;
    
    // 기존 다이얼로그가 있으면 제거
    const existingDialog = document.querySelector('.memo-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'memo-dialog';
    dialog.innerHTML = `
      <div class="memo-dialog-content">
        <div class="memo-dialog-header">
          <h3>메모 작성</h3>
          <button type="button" class="memo-dialog-close">&times;</button>
        </div>
        <div class="memo-dialog-body">
          <div class="memo-question-info">
            <strong>${m.subject} / ${m.cat} / ${m.sub} / ${m.topic}</strong>
            <span class="memo-question-id">문항번호: ${qid}</span>
          </div>
          <textarea class="memo-textarea" placeholder="틀린 이유, 중요한 단서, 복습 포인트 등을 기록하세요..." maxlength="500">${currentMemo}</textarea>
          <div class="memo-char-count">0/500</div>
        </div>
        <div class="memo-dialog-footer">
          <button type="button" class="btn ghost memo-cancel">취소</button>
          <button type="button" class="btn memo-save">저장</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    const textarea = dialog.querySelector('.memo-textarea');
    const charCount = dialog.querySelector('.memo-char-count');
    const saveBtn = dialog.querySelector('.memo-save');
    const cancelBtn = dialog.querySelector('.memo-cancel');
    const closeBtn = dialog.querySelector('.memo-dialog-close');
    
    // 글자 수 업데이트
    function updateCharCount() {
      const count = textarea.value.length;
      charCount.textContent = `${count}/500`;
      charCount.style.color = count > 450 ? '#e74c3c' : '#666';
    }
    
    textarea.addEventListener('input', updateCharCount);
    updateCharCount();
    
    // 저장 버튼 클릭
    saveBtn.addEventListener('click', async () => {
      const memo = textarea.value.trim();
      const success = await window.firebaseData?.saveFavoriteMemo?.(qid, memo);
      
      if (success) {
        // 성공 토스트 표시
        showToast(memo ? '메모가 저장되었습니다.' : '메모가 삭제되었습니다.');
        
        // 목록 새로고침
        const ids = await listFavIds();
        const memos = await getAllFavoriteMemos();
        renderFav(new Set(ids), meta, memos);
        
        dialog.remove();
      } else {
        showToast('메모 저장에 실패했습니다.', 'error');
      }
    });
    
    // 취소/닫기 버튼
    const closeDialog = () => dialog.remove();
    cancelBtn.addEventListener('click', closeDialog);
    closeBtn.addEventListener('click', closeDialog);
    
    // 배경 클릭으로 닫기
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) closeDialog();
    });
    
    // ESC 키로 닫기
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeDialog();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
    
    // 포커스
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }
  
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    const container = document.getElementById('toastContainer') || document.body;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function wireTabs() {
    $tabs.forEach(btn => btn.addEventListener('click', () => {
      $tabs.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const fav = tab === 'fav';
      $favTab.hidden = !fav; $wrongTab.hidden = fav;
    }));
  }

  (async function init() {
    wireTabs();
    const dataset = await loadData();
    const meta = findQuestionMetaIndex(dataset);
    const favIds = await listFavIds();
    const wrongIds = await listWrongIds();
    const memos = await getAllFavoriteMemos();
    renderFav(new Set(favIds), meta, memos);
    renderWrong(new Set(wrongIds), meta);
  })();
})();


